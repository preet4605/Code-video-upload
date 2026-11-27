#!/usr/bin/env node
// Parallel, cache-aware renderer. Drop-in producer of cache/render_manifest.json for master_and_qa.mjs.
//   node scripts/render_parallel.mjs --project <dir> [--workers N] [--draft] [--reel-720] [--json]
//        [--chunk-s 2] [--ffmpeg-threads 1] [--verify [--verify-samples 5] [--seed 1]] [--no-cache] [--strict-cache]
//        [--skip-probe] [--skip-purity] [--no-fallback] [--dry-run]
// See references/render-speed.md. Does not modify render_and_lint.mjs; it imports its lint/probe functions.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveBin } from '../lib/runtime.mjs';
import { ENCODER_VERSION } from '../lib/encode.mjs';
import { scriptApprovalProblem } from '../lib/run_state.mjs';
import { lintStoryProject } from '../lib/story_lint.mjs';
import {
  workerMain, buildChunkPlan, readCacheEntry, pruneRenderCache, renderChunks, verifyBoundaries, verifyPurity,
  sampleFrames, concatSegments, toolVersions
} from '../lib/render_pool.mjs';
import { lintTimeline, probeSceneSanity, registerBundledFonts, detectCpuCount } from './render_and_lint.mjs';

const SCRIPT = fileURLToPath(import.meta.url);
const STUDIO_ROOT = path.resolve(path.dirname(SCRIPT), '..');

function parseArgs(argv) {
  const o = {
    project: null, workers: detectCpuCount(), draft: false, reel720: false, json: false, verify: false, verifySamples: 5, seed: 1,
    chunkS: 2, ffmpegThreads: 1, noCache: false, strictCache: false, skipProbe: false, skipPurity: false, noFallback: false,
    dryRun: false, skipStoryLint: false
  };
  const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined ? Number(v) : d);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') o.project = argv[++i];
    else if (a === '--workers') o.workers = Math.max(1, Math.min(16, Math.round(num(argv[++i], o.workers))));
    else if (a === '--draft') o.draft = true;
    else if (a === '--reel-720') o.reel720 = true;
    else if (a === '--json') o.json = true;
    else if (a === '--verify') o.verify = true;
    else if (a === '--verify-samples') o.verifySamples = Math.max(0, Math.round(num(argv[++i], 5)));
    else if (a === '--seed') o.seed = Math.round(num(argv[++i], 1));
    else if (a === '--chunk-s') o.chunkS = num(argv[++i], 2);
    else if (a === '--ffmpeg-threads') o.ffmpegThreads = Math.max(1, Math.round(num(argv[++i], 1)));
    else if (a === '--no-cache') o.noCache = true;
    else if (a === '--strict-cache') o.strictCache = true;
    else if (a === '--skip-probe') o.skipProbe = true;
    else if (a === '--skip-purity') o.skipPurity = true;
    else if (a === '--no-fallback') o.noFallback = true;
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--skip-story-lint') o.skipStoryLint = true;
  }
  return o;
}

function out(o, obj, text) {
  if (o.json) console.log(JSON.stringify(obj, null, 2));
  else console.log(text);
}

// Refuse parallel output: run the existing sequential renderer (one process, scenes rendered in order, warm).
function fallbackSequential(o, projectDir, reason) {
  console.error(`render_parallel: ${reason}\nrender_parallel: parallel output REFUSED; falling back to sequential render_and_lint.mjs (--workers 1 --no-cache --max-chunk-s 0).`);
  fs.rmSync(path.join(projectDir, 'cache', 'render'), { recursive: true, force: true });
  const args = [path.join(STUDIO_ROOT, 'scripts', 'render_and_lint.mjs'), '--project', projectDir, '--workers', '1', '--no-cache', '--max-chunk-s', '0'];
  if (o.draft) args.push('--draft');
  if (o.reel720) args.push('--reel-720');
  if (o.json) args.push('--json');
  if (o.skipProbe) args.push('--skip-probe');
  if (o.skipStoryLint) args.push('--skip-story-lint');
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.project) {
    console.error('Usage: render_parallel.mjs --project <dir> [--workers N] [--draft] [--reel-720] [--json] [--verify] [--chunk-s 2] [--ffmpeg-threads 1] [--no-cache] [--strict-cache] [--no-fallback]');
    process.exit(2);
  }
  const t0 = Date.now();
  const projectDir = path.resolve(o.project);
  const approvalProblem = scriptApprovalProblem(projectDir);
  if (approvalProblem) { out(o, { ok: false, error: approvalProblem }, approvalProblem); process.exit(1); }
  const timelinePath = path.join(projectDir, 'timeline.json');
  const sceneModulePath = path.join(projectDir, 'scene.mjs');
  const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));

  // ---- same lint gates as render_and_lint (timeline lint + story lint) ----
  const lint = lintTimeline(timeline, projectDir);
  const story = o.skipStoryLint ? { ok: true, errors: [], warns: ['story lint skipped (--skip-story-lint)'] } : lintStoryProject(projectDir);
  if (!story.ok) { lint.ok = false; lint.errors = [...(lint.errors || []), ...story.errors]; }
  lint.story = story;
  if (!lint.ok) {
    if (o.json) console.log(JSON.stringify({ ok: false, lint }, null, 2)); else console.error('LINT FAILED:\n' + lint.errors.join('\n'));
    process.exit(1);
  }

  // ---- geometry: identical rules to render_and_lint ----
  const isVertical = timeline.aspect === '9:16' || (timeline.width * 16 === timeline.height * 9);
  let bw = timeline.width; let bh = timeline.height;
  if (o.reel720 && isVertical) { bw = 720; bh = 1280; }
  const scale = o.draft ? 0.5 : 1.0;
  const width = Math.round(bw * scale);
  const height = Math.round(bh * scale);
  const fps = o.draft ? Math.min(15, timeline.fps) : (o.reel720 ? 30 : timeline.fps);

  const ffmpegBin = resolveBin('ffmpeg');
  const versions = toolVersions(ffmpegBin);
  const chunkFrames = Math.max(1, Math.round(o.chunkS * fps));
  const plan = buildChunkPlan(timeline, {
    projectDir, width, height, fps, draft: o.draft, chunkFrames, ffmpegThreads: o.ffmpegThreads, strict: o.strictCache, versions
  });
  const totalFrames = plan.reduce((s, p) => s + p.frameCount, 0);
  const cacheRoot = path.join(projectDir, 'cache', 'render');

  if (o.dryRun) {
    out(o, { ok: true, dryRun: true, width, height, fps, workers: o.workers, chunkFrames, totalFrames, plan }, `DRY-RUN OK: ${plan.length} chunks, ${totalFrames} frames (${width}x${height}@${fps})`);
    return;
  }

  registerBundledFonts();
  if (!o.skipProbe) {
    const { VideoClock } = await import(pathToFileURL(sceneModulePath).href);
    if (!VideoClock || typeof VideoClock.setTime !== 'function' || typeof VideoClock.draw !== 'function') {
      throw new Error('scene.mjs must export VideoClock with setTime(seconds) and draw(ctx, width, height)');
    }
    const probe = probeSceneSanity({ VideoClock, timeline, width, height, fps });
    if (!probe.ok) {
      if (o.json) console.log(JSON.stringify({ ok: false, lint, probe }, null, 2));
      else console.error('PROBE FAILED:\n' + probe.defects.map((d) => `[${d.code}] ${d.scene_id}@${d.t_s}s: ${d.message}`).join('\n'));
      process.exit(1);
    }
  }

  const initMsg = {
    type: 'init', sceneModulePath, timelinePath, width, height, fps, ffmpegBin, ffmpegThreads: o.ffmpegThreads,
    fontsDir: path.join(STUDIO_ROOT, 'fonts')
  };
  const timing = { lintProbeS: (Date.now() - t0) / 1000 };

  // ---- --verify: warm-from-0 vs cold for the first frame of every chunk + seeded random frames (before rendering) ----
  let verify = null;
  if (o.verify) {
    const tv = Date.now();
    const frames = [...new Set([...plan.map((p) => p.startFrame), ...sampleFrames(totalFrames, o.verifySamples, o.seed)])].sort((a, b) => a - b);
    verify = await verifyPurity(SCRIPT, initMsg, { timeline, fps, frames, size: o.workers });
    verify.seconds = Number(((Date.now() - tv) / 1000).toFixed(1));
    if (!verify.ok) {
      const ids = [...new Set(verify.mismatches.map((m) => m.sceneId))].join(', ');
      const msg = `PURITY FAIL (--verify): scene(s) [${ids}] render differently warm-from-0 vs cold start: ` +
        verify.mismatches.map((m) => `frame ${m.frame} (t=${m.t_s}s, scene ${m.sceneId})`).join('; ') +
        '. Scenes must be pure functions of time (see references/render-speed.md).';
      if (o.noFallback) { out(o, { ok: false, error: msg, verify }, msg); process.exit(1); }
      fallbackSequential(o, projectDir, msg);
    }
  }

  // ---- cache lookup, render the misses on the pool ----
  const entries = plan.map((item) => {
    const done = o.noCache ? null : readCacheEntry(item);
    return { ...item, cacheHit: Boolean(done), tailHash: done?.tailHash || null, purityVerified: Boolean(done?.purityVerified) };
  });
  const misses = entries.filter((e) => !e.cacheHit);
  const tr = Date.now();
  if (misses.length > 0) {
    fs.mkdirSync(cacheRoot, { recursive: true });
    for (const m of misses) fs.rmSync(m.cacheDir, { recursive: true, force: true });
    const results = await renderChunks(SCRIPT, initMsg, misses, o.workers, (item, r, n, total) => {
      if (!o.json) process.stderr.write(`  [${n}/${total}] ${item.id} ${item.frameCount}f ${(r.ms / 1000).toFixed(1)}s\n`);
    });
    for (const m of misses) m.tailHash = results.get(m.id)?.tailHash ?? null;
  }
  timing.renderS = (Date.now() - tr) / 1000;

  // ---- automatic purity gate on every chunk boundary (cheap) ----
  let boundary = { ok: true, checked: 0, mismatches: [], skipped: true };
  if (!o.skipPurity) {
    const tb = Date.now();
    const tails = new Map(entries.map((e) => [e.id, e.tailHash]));
    // A chunk whose key is unchanged and whose boundary was already proven pure is not probed again (the key covers every input of the cold render).
    const todo = entries.filter((e) => !e.purityVerified);
    boundary = await verifyBoundaries(SCRIPT, initMsg, { timeline, fps, plan: todo, tailHashes: tails, size: o.workers });
    boundary.reused = entries.filter((e) => e.purityVerified && e.tailFrame != null).length;
    if (boundary.ok) {
      for (const e of todo) {
        const dp = path.join(e.cacheDir, 'done.json');
        try { const d = JSON.parse(fs.readFileSync(dp, 'utf8')); d.purityVerified = true; fs.writeFileSync(dp, JSON.stringify(d, null, 2)); } catch { /* cache entry vanished; re-verified next run */ }
      }
    }
    boundary.seconds = Number(((Date.now() - tb) / 1000).toFixed(1));
    timing.purityS = boundary.seconds;
    if (!boundary.ok) {
      const ids = [...new Set(boundary.mismatches.map((m) => m.sceneId))].join(', ');
      const msg = `PURITY FAIL: scene(s) [${ids}] are not pure functions of time. ` +
        boundary.mismatches.map((m) => `frame ${m.frame} (t=${m.t_s}s, scene ${m.sceneId}) differs when rendered warm after chunk ${m.chunk} vs cold-started`).join('; ') +
        '. A worker that starts mid-reel would draw different pixels than a sequential render.';
      if (o.noFallback) { out(o, { ok: false, error: msg, boundary }, msg); fs.rmSync(cacheRoot, { recursive: true, force: true }); process.exit(1); }
      fallbackSequential(o, projectDir, msg);
    }
  }

  // ---- concat (stream copy) + manifest ----
  const tc = Date.now();
  const videoPath = path.join(cacheRoot, 'video_concat.mp4');
  concatSegments(ffmpegBin, entries.map((e) => e.segmentPath), path.join(cacheRoot, 'segments_concat.txt'), videoPath);
  timing.concatS = (Date.now() - tc) / 1000;
  const prunedDirs = pruneRenderCache(cacheRoot, entries);

  const manifestSlots = entries.map(({ tailHash, ...e }) => e);
  const manifestPath = path.join(projectDir, 'cache', 'render_manifest.json');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify({
    width, height, fps, draft: Boolean(o.draft), encoder: ENCODER_VERSION, segmentsEnabled: true, pipeMode: 'rgba',
    renderer: 'render_parallel', videoPath, scenes: manifestSlots
  }, null, 2));
  timing.totalS = (Date.now() - t0) / 1000;

  const result = {
    ok: true, width, height, fps, workers: Math.min(o.workers, Math.max(1, misses.length)), pipeMode: 'rgba', segmentsEnabled: true,
    prunedDirs, lint, renderedScenes: manifestSlots.length, chunks: plan.length, chunksRendered: misses.length, cacheHits: plan.length - misses.length,
    totalFrames, chunkFrames, ffmpegThreads: o.ffmpegThreads, purity: { boundary, verify }, timing, videoPath, manifest: manifestSlots
  };
  out(o, result, `RENDER OK (parallel): ${width}x${height}@${fps}, ${plan.length} chunks (${misses.length} rendered, ${plan.length - misses.length} cached), ${totalFrames} frames, ${timing.totalS.toFixed(1)}s; purity boundary ${boundary.checked} checked`);
}

if (process.argv.includes('--pool-worker')) {
  workerMain();
} else if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

export { parseArgs };
