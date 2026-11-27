// Parallel render pool + per-chunk segment cache for reel-factory (used by scripts/render_parallel.mjs).
//
// Design (see references/render-speed.md):
//  - The unit of work and of caching is a CHUNK: a contiguous frame range inside one scene. Chunk boundaries depend
//    only on the timeline and --chunk-s, NEVER on the worker count, so any --workers value (and any cache state)
//    produces the same chunk layout and therefore byte-identical segments.
//  - Workers are long-lived child processes (child_process.fork): each loads the scene module once, then renders
//    chunk jobs received over IPC. Every chunk gets a fresh canvas and its own ffmpeg with the exact encoder args
//    of scripts/render_and_lint.mjs (imported from lib/encode.mjs, never copied).
//  - Purity gate: every chunk also renders the frame AFTER its last frame (the next chunk's first frame) "warm",
//    unencoded, and records its pixel hash. The same frame is rendered COLD in a brand new process. If a scene keeps
//    state between frames, the two differ and the parallel output is refused.
import { spawn, fork, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { loadCanvas, resolveBin } from './runtime.mjs';
import { videoEncodeArgs, colorFilter, ENCODER_VERSION } from './encode.mjs';

export const POOL_VERSION = 'pool-1';
const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(LIB_DIR, '..');

// ------------------------------------------------------------------ chunk math
// n contiguous, near-even ranges covering [start, start+total). Earlier ranges get the remainder.
export function splitFrames(total, n, start = 0) {
  const count = Math.max(1, Math.min(Math.floor(n), Math.max(1, total)));
  const out = [];
  let cur = start;
  for (let k = 0; k < count; k++) {
    const end = k === count - 1 ? start + total : start + Math.round(((k + 1) * total) / count);
    out.push({ start: cur, count: end - cur });
    cur = end;
  }
  return out;
}

// Worker-independent split of one scene: aim for chunkFrames per chunk, never leave a runt (< ~2/3 of target).
export function planSceneChunks(startFrame, endFrame, chunkFrames) {
  const total = Math.max(1, endFrame - startFrame);
  if (!(chunkFrames > 0) || total <= chunkFrames * 1.5) return [{ start: startFrame, count: total }];
  return splitFrames(total, Math.round(total / chunkFrames), startFrame);
}

// ------------------------------------------------------------------ hashing
const sha = (...parts) => {
  const h = crypto.createHash('sha256');
  for (const p of parts) h.update(typeof p === 'string' || Buffer.isBuffer(p) ? p : JSON.stringify(p)).update('\0');
  return h.digest('hex');
};

const IMPORT_RX = /(?:\bimport\s*(?:[\w*\s{},$]*?\bfrom\s*)?|\bexport\s*(?:[\w*\s{},$]*?)\bfrom\s*|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"\n]+|\.{1,2})\1/g;

function resolveLocal(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const cand of [base, `${base}.mjs`, `${base}.js`, path.join(base, 'index.mjs'), path.join(base, 'index.js')]) {
    try { if (fs.statSync(cand).isFile()) return cand; } catch { /* next */ }
  }
  return null;
}

// Transitive closure of relative imports (static, re-export, import('...')) starting at entry files.
export function moduleGraph(entries) {
  const seen = new Map();
  const stack = entries.filter(Boolean).map((e) => path.resolve(e));
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f) || !fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    seen.set(f, src);
    if (!/\.(mjs|js|cjs)$/.test(f)) continue;
    for (const m of src.matchAll(IMPORT_RX)) {
      const r = resolveLocal(f, m[2]);
      if (r && !seen.has(r)) stack.push(r);
    }
  }
  return seen;
}

// Hash of the scene entry file(s) + every local module they pull in (project dir, lib/kit, lib/cinema, ...).
export function sourceFingerprint(entries) {
  const g = moduleGraph(entries);
  const items = [...g.entries()].map(([f, src]) => sha(src)).sort();
  return { hash: sha(items), files: [...g.keys()].sort() };
}

let FONTS_HASH = null;
export function fontsHash(fontsDir = path.join(SKILL_ROOT, 'fonts')) {
  if (FONTS_HASH) return FONTS_HASH;
  const h = crypto.createHash('sha256');
  if (fs.existsSync(fontsDir)) {
    for (const f of fs.readdirSync(fontsDir).filter((x) => /\.(ttf|otf)$/i.test(x)).sort()) h.update(f).update(fs.readFileSync(path.join(fontsDir, f)));
  }
  return (FONTS_HASH = h.digest('hex'));
}

let TOOL_VERSIONS = null;
export function toolVersions(ffmpegBin = resolveBin('ffmpeg')) {
  if (TOOL_VERSIONS) return TOOL_VERSIONS;
  let ffmpeg = 'unknown';
  try { ffmpeg = execFileSync(ffmpegBin, ['-version'], { encoding: 'utf8' }).split('\n')[0]; } catch { /* keep unknown */ }
  let canvas = 'unknown';
  try {
    const req = createRequire(import.meta.url);
    canvas = JSON.parse(fs.readFileSync(path.join(path.dirname(req.resolve('@napi-rs/canvas/package.json')), 'package.json'), 'utf8')).version;
  } catch {
    try { canvas = JSON.parse(fs.readFileSync(path.join(SKILL_ROOT, 'node_modules/@napi-rs/canvas/package.json'), 'utf8')).version; } catch { /* unknown */ }
  }
  const encoderSrc = sha(fs.readFileSync(path.join(LIB_DIR, 'encode.mjs')));
  return (TOOL_VERSIONS = { ffmpeg, canvas, encoderSrc, pool: POOL_VERSION, encoder: ENCODER_VERSION });
}

// The scene (timeline) a global frame falls in; frames past the end/in gaps map to the nearest scene.
export function sceneAtFrame(timeline, fps, frame) {
  const scenes = timeline.scenes || [];
  let best = scenes[scenes.length - 1];
  for (const s of scenes) {
    if (frame >= Math.round(s.start_s * fps) && frame < Math.round(s.end_s * fps)) { best = s; break; }
  }
  return best;
}

// Plan: one item per chunk, with a cache key that changes iff something that can change its pixels changes.
//   key = scene source graph + scene's own timeline slice + captions overlapping the chunk + global timeline fields
//         (words/audio_cues/silences/duration_s/... everything except scenes+captions) + structure of the other scenes
//         + tail-frame scene slice + fonts + encoder + ffmpeg/canvas versions + width/height/fps/draft/threads.
// strict=true hashes the whole timeline instead of the slices (use when scenes read other scenes' data).
export function buildChunkPlan(timeline, {
  projectDir, width, height, fps, draft = false, chunkFrames = 90, ffmpegThreads = 1,
  sceneCode = null, strict = false, cacheSubdir = path.join('cache', 'render'), versions = null
} = {}) {
  const ver = versions || toolVersions();
  const scenes = timeline.scenes || [];
  const captions = timeline.captions || [];
  const { scenes: _s, captions: _c, ...globalFields } = timeline;
  const structure = scenes.map((s) => [s.id, s.start_s, s.end_s]);
  const sceneEntry = path.join(projectDir, 'scene.mjs');
  const baseFp = sourceFingerprint([sceneEntry]).hash;
  const totalFrames = Math.round(timeline.duration_s * fps);
  const assetsPath = path.join(projectDir, 'assets.json');
  const assetsHash = fs.existsSync(assetsPath) ? sha(fs.readFileSync(assetsPath)) : null;
  const common = {
    width, height, fps, draft: Boolean(draft), ffmpegThreads, ver, fonts: fontsHash(), assets: assetsHash,
    global: strict ? timeline : globalFields, structure: strict ? null : structure
  };
  const plan = [];
  const cacheRoot = path.join(projectDir, cacheSubdir);
  for (const scene of scenes) {
    const startFrame = Math.round(scene.start_s * fps);
    const endFrame = Math.round(scene.end_s * fps);
    let entryFp = baseFp;
    const perScene = path.join(projectDir, 'scenes', `${scene.id}.mjs`);
    if (fs.existsSync(perScene)) entryFp = sha(baseFp, sourceFingerprint([perScene]).hash);
    if (sceneCode != null) entryFp = sha(entryFp, sceneCode);
    const ranges = planSceneChunks(startFrame, endFrame, chunkFrames);
    ranges.forEach((r, k) => {
      const chunkEnd = r.start + r.count;
      const id = ranges.length > 1 ? `${scene.id}__part${k}` : scene.id;
      const tailFrame = chunkEnd < totalFrames ? chunkEnd : null;
      const cs = r.start / fps;
      const ce = chunkEnd / fps;
      const tailScene = tailFrame != null ? sceneAtFrame(timeline, fps, tailFrame) : null;
      const key = sha({
        src: entryFp,
        scene: strict ? null : scene,
        captions: strict ? null : captions.filter((c) => c.end_s > cs && c.start_s < ce),
        tail: tailScene && tailScene.id !== scene.id && !strict ? tailScene : null,
        range: [r.start, r.count, ranges.length, k],
        id,
        ...common
      }).slice(0, 16);
      const cacheDir = path.join(cacheRoot, `${id}_${key}`);
      plan.push({
        id, sceneId: scene.id, chunkIndex: k, chunkCount: ranges.length,
        startFrame: r.start, endFrame: chunkEnd, frameCount: r.count,
        tailFrame, hash: key, cacheDir, segmentPath: path.join(cacheDir, 'segment.mp4')
      });
    });
  }
  return plan;
}

// A chunk is reusable iff its done.json matches and the segment exists (and carries the tail-frame hash if needed).
export function readCacheEntry(item) {
  try {
    const done = JSON.parse(fs.readFileSync(path.join(item.cacheDir, 'done.json'), 'utf8'));
    if (done.frameCount !== item.frameCount || done.hash !== item.hash) return null;
    if (item.tailFrame != null && !done.tailHash) return null;
    if (!fs.existsSync(item.segmentPath) || fs.statSync(item.segmentPath).size <= 0) return null;
    return done;
  } catch { return null; }
}

// Remove chunk dirs of the same scene that no longer match the plan (stale hashes). Only touches <cacheRoot>.
export function pruneRenderCache(cacheRoot, plan) {
  if (!fs.existsSync(cacheRoot)) return 0;
  const keep = new Set(plan.map((p) => path.resolve(p.cacheDir)));
  let n = 0;
  for (const ent of fs.readdirSync(cacheRoot, { withFileTypes: true })) {
    if (!ent.isDirectory() || !/_[0-9a-f]{16}$/.test(ent.name)) continue;
    const abs = path.resolve(cacheRoot, ent.name);
    if (!keep.has(abs)) { fs.rmSync(abs, { recursive: true, force: true }); n++; }
  }
  return n;
}

// ------------------------------------------------------------------ worker (runs inside the forked child)
function registerFonts(GlobalFonts, fontsDir) {
  if (!fs.existsSync(fontsDir)) return;
  for (const f of fs.readdirSync(fontsDir).sort()) if (/\.(ttf|otf)$/i.test(f)) GlobalFonts.registerFromPath(path.join(fontsDir, f));
}

const hashRgba = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function renderChunk(S, item) {
  const { createCanvas, VideoClock, timeline, width, height, fps, ffmpegBin, ffmpegThreads } = S;
  fs.mkdirSync(item.cacheDir, { recursive: true });
  const tmpSeg = `${item.segmentPath}.tmp.mp4`;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  // Same argv as renderChunkToSegmentPipe in scripts/render_and_lint.mjs (encoder flags come from lib/encode.mjs).
  const proc = spawn(ffmpegBin, [
    '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', String(fps), '-i', 'pipe:0',
    '-vf', colorFilter(), '-pix_fmt', 'yuv420p', '-r', String(fps),
    ...videoEncodeArgs({ fps }),
    '-threads', String(Math.max(1, ffmpegThreads)),
    '-video_track_timescale', '30000', '-an', '-f', 'mp4', tmpSeg
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = Buffer.alloc(0);
  let procErr = null;
  let closed = false;
  proc.stderr.on('data', (c) => { stderr = Buffer.concat([stderr, c]).subarray(-8192); });
  proc.on('error', (e) => { procErr = procErr || e; });
  proc.stdin.on('error', (e) => { if (e && e.code !== 'EPIPE') procErr = procErr || e; });
  const procClosed = new Promise((res) => proc.once('close', (code, signal) => { closed = true; res({ code, signal }); }));
  try {
    for (let i = 0; i < item.frameCount; i++) {
      if (closed || procErr) break;
      VideoClock.setTime((item.startFrame + i) / fps);
      VideoClock.draw(ctx, width, height, timeline);
      const raw = canvas.data();
      if (!closed && !procErr && proc.stdin.writable) {
        if (!proc.stdin.write(raw) && !closed && !procErr) await Promise.race([once(proc.stdin, 'drain').catch(() => {}), procClosed]);
      }
    }
    // Purity probe: the frame the NEXT chunk starts on, rendered warm, never encoded.
    let tailHash = null;
    if (item.tailFrame != null) {
      VideoClock.setTime(item.tailFrame / fps);
      VideoClock.draw(ctx, width, height, timeline);
      tailHash = hashRgba(canvas.data());
    }
    if (proc.stdin.writable && !proc.stdin.writableEnded) proc.stdin.end();
    const { code, signal } = await procClosed;
    if (procErr) throw procErr;
    if (code !== 0) throw new Error(`ffmpeg failed for chunk ${item.id} (code=${code}, signal=${signal}): ${stderr.toString('utf8').trim()}`);
    if (!fs.existsSync(tmpSeg) || fs.statSync(tmpSeg).size <= 0) throw new Error(`ffmpeg produced an empty segment for ${item.id}`);
    fs.renameSync(tmpSeg, item.segmentPath);
    fs.writeFileSync(path.join(item.cacheDir, 'done.json'), JSON.stringify({
      id: item.id, sceneId: item.sceneId, hash: item.hash, frameCount: item.frameCount, startFrame: item.startFrame,
      tailFrame: item.tailFrame, tailHash, width, height, fps, segmentsEnabled: true, pipeMode: 'rgba', renderer: 'render_parallel'
    }, null, 2));
    return { tailHash };
  } catch (err) {
    try { if (!closed) proc.kill('SIGKILL'); } catch { /* ignore */ }
    fs.rmSync(tmpSeg, { force: true });
    throw err;
  }
}

// Render frames in order on ONE fresh canvas, hashing the requested ones ("warm" = state carried from frame `from`).
function hashFrames(S, frames, from = null) {
  const { createCanvas, VideoClock, timeline, width, height, fps } = S;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const want = [...new Set(frames)].sort((a, b) => a - b);
  const out = {};
  const first = from == null ? want[0] : from;
  const last = want[want.length - 1];
  const wantSet = new Set(want);
  for (let f = first; f <= last; f++) {
    if (from == null && !wantSet.has(f)) continue;     // cold: render only the requested frames, in order
    VideoClock.setTime(f / fps);
    VideoClock.draw(ctx, width, height, timeline);
    if (wantSet.has(f)) out[f] = hashRgba(canvas.data());
  }
  return out;
}

export async function workerMain() {
  let S = null;
  const send = (m) => process.send(m);
  process.on('message', async (msg) => {
    try {
      if (msg.type === 'init') {
        const canvasMod = await loadCanvas();
        registerFonts(canvasMod.GlobalFonts, msg.fontsDir);
        const sceneMod = await import(pathToFileURL(msg.sceneModulePath).href);
        const { VideoClock } = sceneMod;
        if (!VideoClock || typeof VideoClock.setTime !== 'function' || typeof VideoClock.draw !== 'function') {
          throw new Error('scene.mjs must export VideoClock with setTime(seconds) and draw(ctx, width, height)');
        }
        const timeline = JSON.parse(fs.readFileSync(msg.timelinePath, 'utf8'));
        S = { createCanvas: canvasMod.createCanvas, VideoClock, timeline, width: msg.width, height: msg.height, fps: msg.fps, ffmpegBin: msg.ffmpegBin, ffmpegThreads: msg.ffmpegThreads };
        send({ type: 'ready' });
      } else if (msg.type === 'chunk') {
        const t0 = Date.now();
        const r = await renderChunk(S, msg.item);
        send({ type: 'done', id: msg.item.id, ms: Date.now() - t0, ...r });
      } else if (msg.type === 'hashes') {
        send({ type: 'done', hashes: hashFrames(S, msg.frames, msg.from ?? null) });
      } else if (msg.type === 'exit') {
        process.exit(0);
      }
    } catch (err) {
      send({ type: 'error', error: err?.stack || String(err) });
    }
  });
}

// ------------------------------------------------------------------ parent side
export class WorkerHandle {
  constructor(script, initMsg) {
    this.child = fork(script, ['--pool-worker'], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    this.stderr = '';
    this.child.stderr.on('data', (d) => { this.stderr = (this.stderr + d).slice(-4000); });
    this.pending = null;
    this.dead = false;
    this.child.on('message', (m) => {
      const p = this.pending;
      if (!p) return;
      this.pending = null;
      if (m.type === 'error') p.reject(new Error(m.error));
      else p.resolve(m);
    });
    this.child.on('exit', (code, sig) => {
      this.dead = true;
      if (this.pending) {
        const p = this.pending; this.pending = null;
        p.reject(new Error(`render worker exited (code=${code}, signal=${sig}): ${this.stderr.trim()}`));
      }
    });
    this.ready = this.request(initMsg);
  }
  request(msg) {
    return new Promise((resolve, reject) => {
      if (this.dead) return reject(new Error('render worker is dead'));
      this.pending = { resolve, reject };
      this.child.send(msg);
    });
  }
  kill() { try { this.child.kill('SIGKILL'); } catch { /* gone */ } }
}

// Run chunk jobs on `size` persistent workers; longest chunks first. Resolves to Map(id -> {tailHash, ms}).
export async function renderChunks(script, initMsg, items, size, onProgress = null) {
  const results = new Map();
  if (items.length === 0) return results;
  const queue = [...items].sort((a, b) => b.frameCount - a.frameCount);
  const n = Math.max(1, Math.min(size, queue.length));
  const workers = Array.from({ length: n }, () => new WorkerHandle(script, initMsg));
  let failed = null;
  try {
    await Promise.all(workers.map(async (w) => {
      await w.ready;
      while (!failed) {
        const item = queue.shift();
        if (!item) break;
        try {
          const r = await w.request({ type: 'chunk', item });
          results.set(item.id, r);
          if (onProgress) onProgress(item, r, results.size, items.length);
        } catch (err) { failed = failed || err; throw err; }
      }
    }));
  } catch (err) {
    workers.forEach((w) => w.kill());
    throw err;
  }
  workers.forEach((w) => { try { w.child.send({ type: 'exit' }); } catch { /* gone */ } });
  return results;
}

// COLD hashes: every frame is rendered by its own brand-new process (nothing carried over, not even module state).
export async function coldHashes(script, initMsg, frames, size) {
  const uniq = [...new Set(frames)];
  const out = {};
  const queue = [...uniq];
  const run = async () => {
    while (queue.length) {
      const f = queue.shift();
      const w = new WorkerHandle(script, initMsg);
      try {
        await w.ready;
        const r = await w.request({ type: 'hashes', frames: [f] });
        out[f] = r.hashes[f];
      } finally { w.kill(); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, uniq.length)) }, run));
  return out;
}

// WARM hashes from frame 0: one fresh process renders 0..max(frames) in order (this is "sequential").
export async function warmHashesFrom0(script, initMsg, frames) {
  if (frames.length === 0) return {};
  const w = new WorkerHandle(script, initMsg);
  try {
    await w.ready;
    return (await w.request({ type: 'hashes', frames, from: 0 })).hashes;
  } finally { w.kill(); }
}

// Seeded sample of frames (mulberry32) for --verify.
export function sampleFrames(total, count, seed = 1) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const set = new Set();
  while (set.size < Math.min(count, total)) set.add(Math.floor(rnd() * total));
  return [...set].sort((x, y) => x - y);
}

// Full purity check used by --verify and by tests: warm-from-0 vs cold, for chunk starts + seeded random frames.
export async function verifyPurity(script, initMsg, { timeline, fps, frames, size = 2 }) {
  const warm = await warmHashesFrom0(script, initMsg, frames);
  const cold = await coldHashes(script, initMsg, frames, size);
  const mismatches = [];
  for (const f of frames) {
    if (warm[f] !== cold[f]) {
      const sc = sceneAtFrame(timeline, fps, f);
      mismatches.push({ frame: f, t_s: Number((f / fps).toFixed(3)), sceneId: sc?.id ?? null, warm: warm[f], cold: cold[f] });
    }
  }
  return { ok: mismatches.length === 0, checked: frames.length, mismatches };
}

// Boundary check from chunk results: warm tail hash (rendered after the chunk's frames) vs cold render in a new process.
export async function verifyBoundaries(script, initMsg, { timeline, fps, plan, tailHashes, size = 2 }) {
  const items = plan.filter((p) => p.tailFrame != null && tailHashes.get(p.id));
  const cold = await coldHashes(script, initMsg, items.map((p) => p.tailFrame), size);
  const mismatches = [];
  for (const p of items) {
    if (tailHashes.get(p.id) !== cold[p.tailFrame]) {
      // the frame belongs to the NEXT chunk's range; the stateful scene is the one that draws it
      const sc = sceneAtFrame(timeline, fps, p.tailFrame);
      mismatches.push({ chunk: p.id, frame: p.tailFrame, t_s: Number((p.tailFrame / fps).toFixed(3)), sceneId: sc?.id ?? p.sceneId, previousSceneId: p.sceneId });
    }
  }
  return { ok: mismatches.length === 0, checked: items.length, mismatches };
}

// ffmpeg concat demuxer, stream copy. Segments already share codec params, timescale and closed GOPs.
export function concatSegments(ffmpegBin, segmentPaths, listPath, outPath) {
  fs.mkdirSync(path.dirname(listPath), { recursive: true });
  fs.writeFileSync(listPath, segmentPaths.map((p) => `file '${String(p).replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  const tmp = `${outPath}.tmp.mp4`;
  execFileSync(ffmpegBin, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-an', '-f', 'mp4', tmp], { stdio: 'pipe' });
  fs.renameSync(tmp, outPath);
}
