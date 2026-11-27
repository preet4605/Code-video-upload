// Phase 15: parallel renderer (scripts/render_parallel.mjs + lib/render_pool.mjs).
// chunk math, purity gate (stateful scene refused), cache keys, end-to-end equivalence on a tiny fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { splitFrames, planSceneChunks, buildChunkPlan, sampleFrames, moduleGraph, toolVersions } from '../lib/render_pool.mjs';
import { resolveBin } from '../lib/runtime.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAR = path.join(ROOT, 'scripts', 'render_parallel.mjs');
const SEQ = path.join(ROOT, 'scripts', 'render_and_lint.mjs');
const FFMPEG = resolveBin('ffmpeg');
const CPUS = (os.availableParallelism?.() || os.cpus().length || 4);

const PURE_SCENE = `import { tint } from './helper.mjs';
let t = 0;
export const VideoClock = {
  setTime(s) { t = s; },
  draw(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, tint(t)); g.addColorStop(1, '#203040');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f0e0a0'; ctx.fillRect((t * 97) % (w - 40), (t * 53) % (h - 40), 40, 40);
  }
};
`;
const HELPER = `export const tint = (t) => 'hsl(' + Math.floor((t * 90) % 360) + ',60%,45%)';\n`;
// Deliberately stateful: colour depends on how many frames this module instance has drawn.
const STATEFUL_SCENE = `let t = 0, n = 0;
export const VideoClock = {
  setTime(s) { t = s; n++; },
  draw(ctx, w, h) {
    ctx.fillStyle = 'hsl(' + ((n * 7) % 360) + ',60%,45%)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f0e0a0'; ctx.fillRect((t * 97) % (w - 40), 60, 40, 40);
  }
};
`;

function fixture({ stateful = false, scenes = [['a', 0, 1], ['b', 1, 2]], extra = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp15-'));
  const timeline = {
    version: 1, slug: 'rp15', width: 270, height: 480, fps: 30, duration_s: scenes[scenes.length - 1][2],
    scenes: scenes.map(([id, s, e]) => ({ id, start_s: s, end_s: e, mood: 'calm', beats: [{ id: `${id}_b`, start_s: s, end_s: e, type: 'move', animated_properties: ['bg.hue', 'box.x'] }] })),
    captions: [], audio_cues: [], silences: [], ...extra
  };
  fs.writeFileSync(path.join(dir, 'timeline.json'), JSON.stringify(timeline, null, 1));
  fs.writeFileSync(path.join(dir, 'scene.mjs'), stateful ? STATEFUL_SCENE : PURE_SCENE);
  fs.writeFileSync(path.join(dir, 'helper.mjs'), HELPER);
  return { dir, timeline, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const par = (dir, args = []) => spawnSync(process.execPath, [PAR, '--project', dir, '--json', '--skip-probe', ...args], { encoding: 'utf8' });
function frameMd5(file) {
  return execFileSync(FFMPEG, ['-v', 'error', '-i', file, '-map', '0:v:0', '-f', 'framemd5', '-'], { encoding: 'utf8' })
    .split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split(',').pop().trim());
}
const probeFrames = (file) => Number(execFileSync(FFMPEG.replace(/ffmpeg$/, 'ffprobe'), ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());

// ---------------------------------------------------------------- chunk math
test('splitFrames: contiguous, exact cover, near-even, never empty', () => {
  for (const [total, n] of [[2061, 4], [100, 3], [7, 7], [5, 9], [1, 4], [90, 1]]) {
    const parts = splitFrames(total, n, 10);
    assert.equal(parts[0].start, 10);
    assert.equal(parts.reduce((s, p) => s + p.count, 0), total);
    parts.forEach((p, i) => { assert.ok(p.count >= 1); if (i) assert.equal(p.start, parts[i - 1].start + parts[i - 1].count); });
    const counts = parts.map((p) => p.count);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `uneven: ${counts}`);
    assert.equal(parts.length, Math.min(n, total));
  }
});

test('planSceneChunks: short scenes stay whole, long ones split without runts, independent of workers', () => {
  assert.deepEqual(planSceneChunks(30, 120, 90), [{ start: 30, count: 90 }]);       // 90 <= 1.5*90
  assert.deepEqual(planSceneChunks(0, 135, 90), [{ start: 0, count: 135 }]);        // exactly 1.5x stays whole
  const p = planSceneChunks(0, 350, 90);                                             // ~3.9 -> 4 chunks
  assert.equal(p.length, 4);
  assert.equal(p.reduce((s, c) => s + c.count, 0), 350);
  assert.ok(p.every((c) => c.count >= 0.66 * 90 && c.count <= 1.5 * 90), JSON.stringify(p));
  assert.deepEqual(planSceneChunks(0, 350, 90), p);                                  // deterministic
  assert.deepEqual(planSceneChunks(5, 6, 90), [{ start: 5, count: 1 }]);
});

test('sampleFrames: seeded, unique, in range', () => {
  const a = sampleFrames(2000, 5, 7); const b = sampleFrames(2000, 5, 7); const c = sampleFrames(2000, 5, 8);
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  assert.equal(new Set(a).size, 5); assert.ok(a.every((f) => f >= 0 && f < 2000));
  assert.equal(sampleFrames(3, 10, 1).length, 3);
});

// ---------------------------------------------------------------- cache key
test('cache key: changes with scene source / imported module / own timeline slice / globals, otherwise stable', () => {
  const fx = fixture({ scenes: [['a', 0, 1], ['b', 1, 2]] });
  try {
    const plan = (tl = fx.timeline, o = {}) => {
      fs.writeFileSync(path.join(fx.dir, 'timeline.json'), JSON.stringify(tl));
      return buildChunkPlan(tl, { projectDir: fx.dir, width: 270, height: 480, fps: 30, chunkFrames: 15, ...o });
    };
    const keys = (p) => Object.fromEntries(p.map((x) => [x.id, x.hash]));
    const base = keys(plan());
    assert.deepEqual(keys(plan()), base, 'identical inputs, identical keys');
    assert.ok(Object.keys(base).length >= 4, 'scenes were split into chunks');
    assert.deepEqual(keys(plan(fx.timeline, { chunkFrames: 15 })), base);

    // unrelated file in the project dir: no change
    fs.writeFileSync(path.join(fx.dir, 'notes.txt'), 'x');
    assert.deepEqual(keys(plan()), base);

    // own timeline slice of scene b: only b's chunks change
    const tlB = structuredClone(fx.timeline); tlB.scenes[1].mood = 'tense';
    const kb = keys(plan(tlB));
    // a's LAST chunk legitimately changes too: its purity probe renders b's first frame (tail context).
    for (const id of Object.keys(base)) {
      if (id.startsWith('a') && !id.endsWith('part1')) assert.equal(kb[id], base[id], `${id} must be reused`);
      else assert.notEqual(kb[id], base[id], `${id} must change`);
    }

    // imported local module changes every chunk
    const helper = path.join(fx.dir, 'helper.mjs');
    fs.writeFileSync(helper, HELPER + '// edit\n');
    const kh = keys(plan());
    for (const id of Object.keys(base)) assert.notEqual(kh[id], base[id]);
    assert.ok(moduleGraph([path.join(fx.dir, 'scene.mjs')]).has(helper));
    fs.writeFileSync(helper, HELPER);
    assert.deepEqual(keys(plan()), base, 'reverting restores the keys');

    // scene source edit and global timeline fields change everything
    fs.writeFileSync(path.join(fx.dir, 'scene.mjs'), PURE_SCENE + '// edit\n');
    for (const [id, k] of Object.entries(keys(plan()))) assert.notEqual(k, base[id]);
    fs.writeFileSync(path.join(fx.dir, 'scene.mjs'), PURE_SCENE);
    const tlG = structuredClone(fx.timeline); tlG.words = [{ word: 'hi', start_s: 0.1, end_s: 0.2 }];
    for (const [id, k] of Object.entries(keys(plan(tlG)))) assert.notEqual(k, base[id]);
    // geometry/draft/threads participate
    plan(fx.timeline);
    assert.notDeepEqual(keys(plan(fx.timeline, { width: 135, height: 240 })), base);
    assert.notDeepEqual(keys(plan(fx.timeline, { ffmpegThreads: 3 })), base);
    assert.notDeepEqual(keys(plan(fx.timeline, { draft: true })), base);
    assert.ok(toolVersions().ffmpeg);
  } finally { fx.cleanup(); }
});

test('cache key: lib/cinema and lib/kit sources are part of the graph of a scene that imports them', () => {
  const g = moduleGraph([path.join(ROOT, 'examples/cinema-demo/scene.mjs')]);
  const files = [...g.keys()].map((f) => path.relative(ROOT, f));
  assert.ok(files.some((f) => f.startsWith(path.join('lib', 'cinema'))), files.join(','));
});

// ---------------------------------------------------------------- purity gate
test('purity: stateful scene is refused (--no-fallback) and names the scene id; pure scene passes', () => {
  const bad = fixture({ stateful: true });
  const good = fixture();
  try {
    const r = par(bad.dir, ['--workers', '2', '--chunk-s', '0.5', '--no-fallback']);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const j = JSON.parse(r.stdout);
    assert.equal(j.ok, false);
    assert.match(j.error, /PURITY FAIL/);
    assert.match(j.error, /scene\(s\) \[(a|b)(, (a|b))?\]/, 'names the scene id');
    assert.equal(fs.existsSync(path.join(bad.dir, 'cache', 'render_manifest.json')), false, 'no parallel manifest left behind');

    const ok = par(good.dir, ['--workers', '2', '--chunk-s', '0.5', '--no-fallback']);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    const jo = JSON.parse(ok.stdout);
    assert.equal(jo.purity.boundary.ok, true);
    assert.ok(jo.purity.boundary.checked >= 3);
  } finally { bad.cleanup(); good.cleanup(); }
});

test('purity: --verify (warm-from-0 vs cold) fails loudly on a stateful scene, passes on a pure one', () => {
  const bad = fixture({ stateful: true });
  const good = fixture();
  try {
    const r = par(bad.dir, ['--verify', '--no-fallback', '--chunk-s', '0.5', '--workers', '2']);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(JSON.parse(r.stdout).error, /PURITY FAIL \(--verify\): scene\(s\) \[.*\]/);
    const ok = par(good.dir, ['--verify', '--no-fallback', '--chunk-s', '0.5', '--workers', '2']);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    const v = JSON.parse(ok.stdout).purity.verify;
    assert.equal(v.ok, true); assert.ok(v.checked >= 5);
  } finally { bad.cleanup(); good.cleanup(); }
});

test('purity: without --no-fallback a stateful scene falls back to the sequential renderer and still produces a manifest', () => {
  const bad = fixture({ stateful: true });
  try {
    const r = par(bad.dir, ['--workers', '2', '--chunk-s', '0.5']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stderr, /parallel output REFUSED; falling back to sequential/);
    const m = JSON.parse(fs.readFileSync(path.join(bad.dir, 'cache', 'render_manifest.json'), 'utf8'));
    assert.ok(!m.renderer, 'manifest was written by render_and_lint, not render_parallel');
    assert.equal(m.scenes.reduce((s, x) => s + x.frameCount, 0), 60);
  } finally { bad.cleanup(); }
});

// ---------------------------------------------------------------- end to end
test('e2e: parallel (3 workers) == parallel (1 worker) == render_and_lint on the same chunk layout; cache hits afterwards', () => {
  const fx = fixture();
  const seqFx = fixture();
  try {
    const r3 = par(fx.dir, ['--workers', '3', '--chunk-s', '0.5', '--ffmpeg-threads', String(CPUS)]);
    assert.equal(r3.status, 0, r3.stdout + r3.stderr);
    const j3 = JSON.parse(r3.stdout);
    assert.equal(j3.chunks, 4); assert.equal(j3.chunksRendered, 4); assert.equal(j3.totalFrames, 60);
    const v3 = j3.videoPath;
    assert.equal(probeFrames(v3), 60);

    // manifest contract used by master_and_qa
    const m = JSON.parse(fs.readFileSync(path.join(fx.dir, 'cache', 'render_manifest.json'), 'utf8'));
    assert.equal(m.width, 270); assert.equal(m.fps, 30); assert.equal(m.draft, false);
    let at = 0;
    for (const s of m.scenes) { assert.equal(s.startFrame, at); at += s.frameCount; assert.ok(fs.existsSync(s.segmentPath)); }
    assert.equal(at, 60);

    // sequential render_and_lint with identical chunk boundaries (maxChunkS 0.5 -> 2 chunks/scene) and identical x264 threads
    const rs = spawnSync(process.execPath, [SEQ, '--project', seqFx.dir, '--workers', '1', '--max-chunk-s', '0.5', '--skip-probe', '--json'], { encoding: 'utf8' });
    assert.equal(rs.status, 0, rs.stdout + rs.stderr);
    const seqManifest = JSON.parse(fs.readFileSync(path.join(seqFx.dir, 'cache', 'render_manifest.json'), 'utf8'));
    assert.deepEqual(seqManifest.scenes.map((s) => [s.startFrame, s.frameCount]), m.scenes.map((s) => [s.startFrame, s.frameCount]));
    const seqVideo = path.join(seqFx.dir, 'cache', 'seq_concat.mp4');
    const list = path.join(seqFx.dir, 'cache', 'seq.txt');
    fs.writeFileSync(list, seqManifest.scenes.map((s) => `file '${s.segmentPath}'`).join('\n') + '\n');
    execFileSync(FFMPEG, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-an', seqVideo]);
    assert.deepEqual(frameMd5(v3), frameMd5(seqVideo), 'decoded frames identical to render_and_lint');

    // worker count must not change a single decoded pixel
    fs.rmSync(path.join(fx.dir, 'cache'), { recursive: true, force: true });
    const r1 = par(fx.dir, ['--workers', '1', '--chunk-s', '0.5', '--ffmpeg-threads', String(CPUS)]);
    assert.equal(r1.status, 0, r1.stdout + r1.stderr);
    assert.deepEqual(frameMd5(JSON.parse(r1.stdout).videoPath), frameMd5(v3));

    // re-run: everything cached
    const again = JSON.parse(par(fx.dir, ['--workers', '3', '--chunk-s', '0.5', '--ffmpeg-threads', String(CPUS)]).stdout);
    assert.equal(again.chunksRendered, 0); assert.equal(again.cacheHits, 4);

    // touch scene b's slice: only b (+ a's last chunk, whose tail frame is b's first) re-render; scene a's first chunk is reused
    const tl = JSON.parse(fs.readFileSync(path.join(fx.dir, 'timeline.json'), 'utf8')); tl.scenes[1].mood = 'tense';
    fs.writeFileSync(path.join(fx.dir, 'timeline.json'), JSON.stringify(tl));
    const touched = JSON.parse(par(fx.dir, ['--workers', '3', '--chunk-s', '0.5', '--ffmpeg-threads', String(CPUS)]).stdout);
    assert.equal(touched.cacheHits, 1);
    assert.equal(touched.chunksRendered, 3);
  } finally { fx.cleanup(); seqFx.cleanup(); }
});
