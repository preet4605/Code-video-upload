#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { videoEncodeArgs, colorFilter, ENCODER_VERSION } from '../lib/encode.mjs';
import { getSafeProfile, DEFAULT_SAFE_PROFILE } from '../lib/profiles.mjs';
import { lintDirection } from '../lib/direction_lint.mjs';
import { lintStoryProject } from '../lib/story_lint.mjs';
import crypto from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCanvas, resolveBin } from '../lib/runtime.mjs';

const { createCanvas, GlobalFonts } = await loadCanvas();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = path.resolve(__dirname, '..');
const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

export function graphemeLength(str) {
  let count = 0;
  for (const _ of graphemeSegmenter.segment(str)) count++;
  return count;
}

export function detectCpuCount() {
  const avail = typeof os.availableParallelism === 'function' ? os.availableParallelism() : 0;
  return avail > 0 ? avail : (os.cpus().length || 4);
}

export function registerBundledFonts() {
  const fontsDir = path.join(STUDIO_ROOT, 'fonts');
  if (!fs.existsSync(fontsDir)) return [];
  const registered = [];
  for (const file of fs.readdirSync(fontsDir).sort()) {
    if (/\.(ttf|otf)$/i.test(file)) {
      const fullPath = path.join(fontsDir, file);
      GlobalFonts.registerFromPath(fullPath);
      registered.push(file);
    }
  }
  return registered;
}

function parseArgs(argv) {
  const defaultWorkers = Math.min(4, Math.max(1, detectCpuCount()));
  const opts = {
    project: null,
    draft: false,
    reel720: false,
    dryRun: false,
    json: false,
    noCache: false,
    onlyScenes: null,
    maxChunkS: 12,
    noSegments: false,
    keepPngs: false,
    workers: defaultWorkers,
    workerChunk: null,
    verifyOnly: false,
    skipProbe: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') opts.project = argv[++i];
    else if (a === '--draft') opts.draft = true;
    else if (a === '--skip-story-lint') opts.skipStoryLint = true;
    else if (a === '--reel-720') opts.reel720 = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--no-cache') opts.noCache = true;
    else if (a === '--only-scenes' || a === '--scenes') {
      const raw = argv[++i] || '';
      opts.onlyScenes = raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
    else if (a === '--max-chunk-s') opts.maxChunkS = Number(argv[++i]);
    else if (a === '--no-segments') opts.noSegments = true;
    else if (a === '--keep-pngs') opts.keepPngs = true;
    else if (a === '--workers') {
      const n = Math.round(Number(argv[++i]));
      opts.workers = Number.isFinite(n) ? Math.min(8, Math.max(1, n)) : defaultWorkers;
    }
    else if (a === '--worker-chunk') opts.workerChunk = argv[++i];
    else if (a === '--verify-only') opts.verifyOnly = true;
    else if (a === '--skip-probe') opts.skipProbe = true;
  }
  return opts;
}

export function lintTimeline(timeline, projectDir = null) {
  const errors = [];
  const warnings = [];

  for (const key of ['version', 'slug', 'width', 'height', 'fps', 'duration_s', 'scenes']) {
    if (timeline[key] === undefined) errors.push(`Missing required field: ${key}`);
  }
  if (!Array.isArray(timeline.scenes) || timeline.scenes.length === 0) {
    errors.push('timeline.scenes must be a non-empty array');
    return { ok: false, errors, warnings, stats: {} };
  }

  let totalBeats = 0;
  let holdBeats = 0;

  // Scene continuity check: ordered, no gaps > 0.05s, no overlaps < -0.05s, covers [0, duration_s]
  const firstStart = timeline.scenes[0].start_s;
  if (Math.abs(firstStart) > 0.05) {
    errors.push(`Scene continuity: first scene starts at ${firstStart}s instead of 0s`);
  }
  for (let si = 0; si < timeline.scenes.length; si++) {
    const sc = timeline.scenes[si];
    if (si > 0) {
      const prevEnd = timeline.scenes[si - 1].end_s;
      const delta = sc.start_s - prevEnd;
      if (delta > 0.05) errors.push(`Scene continuity gap: ${prevEnd}s -> ${sc.start_s}s before ${sc.id}`);
      if (delta < -0.05) errors.push(`Scene continuity overlap: ${prevEnd}s -> ${sc.start_s}s before ${sc.id}`);
    }
  }
  const lastEnd = timeline.scenes[timeline.scenes.length - 1].end_s;
  if (Math.abs(timeline.duration_s - lastEnd) > 0.05) {
    errors.push(`Scene continuity: last scene ends at ${lastEnd}s, duration_s is ${timeline.duration_s}s`);
  }

  // 9:16 Safe-Zone Gate helper (safe margins on 1080x1920: x in [60, 900], y in [160, 1560])
  const isVertical916 = timeline.aspect === '9:16' || (timeline.width * 16 === timeline.height * 9);
  const checkBoxSafeZone = (label, box) => {
    if (!isVertical916 || !box) return;
    const prof = getSafeProfile(timeline.safe_profile || DEFAULT_SAFE_PROFILE);
    const minX = (prof.minX / 1080) * timeline.width;
    const maxX = (prof.maxX / 1080) * timeline.width;
    const minY = (prof.minY / 1920) * timeline.height;
    const maxY = (prof.maxY / 1920) * timeline.height;
    const x1 = box.x ?? 0;
    const y1 = box.y ?? 0;
    const x2 = x1 + (box.w ?? 0);
    const y2 = y1 + (box.h ?? 0);
    if (x1 < minX || x2 > maxX || y1 < minY || y2 > maxY) {
      errors.push(`9:16 safe-zone violation (${label}): [${x1},${y1}..${x2},${y2}] outside [${minX.toFixed(0)},${minY.toFixed(0)}..${maxX.toFixed(0)},${maxY.toFixed(0)}]`);
    }
  };

  for (const scene of timeline.scenes) {
    if (scene.safe_zone === false) {
      errors.push(`Scene ${scene.id}: safe_zone explicitly false`);
    }
    if (scene.focal_point) checkBoxSafeZone(`scene:${scene.id}.focal_point`, scene.focal_point);
    if (scene.caption_box) checkBoxSafeZone(`scene:${scene.id}.caption_box`, scene.caption_box);

    if (scene.end_s <= scene.start_s) {
      errors.push(`Scene ${scene.id}: end_s (${scene.end_s}) <= start_s (${scene.start_s})`);
    }
    const beats = scene.beats || [];
    if (beats.length === 0) errors.push(`Scene ${scene.id}: must have >= 1 beat`);

    for (let idx = 0; idx < beats.length; idx++) {
      const b = beats[idx];
      totalBeats++;
      const props = Array.isArray(b.animated_properties) ? b.animated_properties : [];
      const isSuspenseAmbient = scene.mood === 'suspense' && scene.ambient_motion === true;

      if (b.hold) {
        if (!isSuspenseAmbient) holdBeats++;
      } else if (props.length < 1 && !isSuspenseAmbient) {
        errors.push(`Scene ${scene.id} beat[${idx}]: must animate >= 1 property (or mark hold/suspense+ambient)`);
      }

      if (typeof b.flashes_per_sec === 'number' && b.flashes_per_sec > 3) {
        errors.push(`Scene ${scene.id} beat[${idx}]: flashes_per_sec=${b.flashes_per_sec} exceeds WCAG 2.3.1 cap (<= 3/s)`);
      }
    }
  }

  const holdRatio = totalBeats > 0 ? holdBeats / totalBeats : 0;
  if (holdRatio > 0.20) {
    errors.push(`Static hold ratio ${(holdRatio * 100).toFixed(1)}% exceeds 20% cap`);
  }

  const validCaptions = [];
  for (let i = 0; i < (timeline.captions || []).length; i++) {
    const c = timeline.captions[i];
    if (c.safe_zone === false) {
      errors.push(`Caption[${i}]: safe_zone explicitly false`);
    }
    if (c.caption_box) checkBoxSafeZone(`caption[${i}].caption_box`, c.caption_box);
    if (typeof c.start_s === 'number' && c.start_s < -0.05) {
      errors.push(`Caption[${i}]: start_s (${c.start_s}) < -0.05s`);
    }
    if (typeof c.end_s === 'number' && typeof timeline.duration_s === 'number' && c.end_s > timeline.duration_s + 0.05) {
      errors.push(`Caption[${i}]: end_s (${c.end_s}) > duration_s (${timeline.duration_s}) + 0.05s`);
    }
    const dur = c.end_s - c.start_s;
    if (dur <= 0) {
      errors.push(`Caption[${i}]: end_s <= start_s`);
      continue;
    }
    validCaptions.push({ idx: i, start_s: c.start_s, end_s: c.end_s });
    const lines = c.text.split('\n');
    if (lines.length > 2) errors.push(`Caption[${i}]: ${lines.length} lines > max 2`);
    for (const ln of lines) {
      const gLen = graphemeLength(ln);
      if (gLen > 42) errors.push(`Caption[${i}]: line length ${gLen} > max 42 chars`);
    }
    const cps = graphemeLength(c.text.replace(/\n/g, '')) / dur;
    if (cps > 18) errors.push(`Caption[${i}]: CPS ${cps.toFixed(1)} > max 18`);
  }

  validCaptions.sort((a, b) => a.start_s - b.start_s || a.end_s - b.end_s);
  for (let i = 1; i < validCaptions.length; i++) {
    const prev = validCaptions[i - 1];
    const curr = validCaptions[i];
    if (prev.end_s - curr.start_s > 0.05) {
      errors.push(`Caption overlap: caption[${prev.idx}] (${prev.end_s}s) overlaps caption[${curr.idx}] (${curr.start_s}s)`);
    }
  }

  if (projectDir && fs.existsSync(projectDir)) {
    if (timeline.audio_file) {
      const audioAbs = path.resolve(projectDir, timeline.audio_file);
      if (!fs.existsSync(audioAbs)) {
        errors.push(`Missing audio_file on disk: ${timeline.audio_file}`);
      }
    }
    const assetsPath = path.join(projectDir, 'assets.json');
    if (fs.existsSync(assetsPath)) {
      try {
        const assetsDoc = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));
        for (const asset of assetsDoc.assets || []) {
          const localRef = asset?.file || asset?.path;
          if (typeof localRef === 'string' && localRef.trim() && !/^https?:\/\//i.test(localRef)) {
            const absRef = path.resolve(projectDir, localRef);
            if (!fs.existsSync(absRef)) {
              errors.push(`Missing local asset file on disk (${asset.id || 'asset'}): ${localRef}`);
            }
          }
        }
      } catch (err) {
        errors.push(`Invalid assets.json: ${err.message}`);
      }
    }
  }

  let brief = null;
  if (projectDir && fs.existsSync(path.join(projectDir, 'brief.json'))) {
    try {
      brief = JSON.parse(fs.readFileSync(path.join(projectDir, 'brief.json'), 'utf8'));
    } catch (err) {
      errors.push(`Invalid brief.json: ${err.message}`);
    }
  }
  warnings.push(...lintDirection(timeline, brief));

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: { scenes: timeline.scenes.length, totalBeats, holdBeats, holdRatio: Number(holdRatio.toFixed(3)) }
  };
}

// Scenes import the skill's own lib (scene3d, widgets): fold their contents into every segment hash so that
// updating the skill never reuses stale cached segments.
let LIB_HASH = null;
function libHash() {
  if (LIB_HASH) return LIB_HASH;
  const libDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib');
  const h = crypto.createHash('sha256');
  for (const f of fs.readdirSync(libDir).filter((x) => x.endsWith('.mjs')).sort()) h.update(f).update(fs.readFileSync(path.join(libDir, f)));
  LIB_HASH = h.digest('hex').slice(0, 12);
  return LIB_HASH;
}
let TIMING_CTX = '';
function sceneHash(scenePayload, overlappingCaptions, width, height, fps, sceneCode) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ scene: scenePayload, overlappingCaptions, width, height, fps, sceneCode, enc: ENCODER_VERSION, lib: libHash(), timing: TIMING_CTX }))
    .digest('hex')
    .slice(0, 12);
}

export function buildRenderPlan(timeline, { width, height, fps, sceneCode, projectDir, maxChunkS = 12, onlyScenes = null } = {}) {
  const captions = timeline.captions || [];
  // scenes may read cue/silence timing and total duration (e.g. scare time): changing them must re-render
  TIMING_CTX = JSON.stringify({ cues: timeline.audio_cues || [], silences: timeline.silences || [], d: timeline.duration_s });
  const onlySet = onlyScenes ? new Set(Array.from(onlyScenes)) : null;
  const plan = [];

  for (const scene of timeline.scenes || []) {
    if (onlySet && onlySet.size > 0 && !onlySet.has(scene.id)) continue;

    const startFrame = Math.round(scene.start_s * fps);
    const endFrame = Math.round(scene.end_s * fps);
    const totalFrames = Math.max(1, endFrame - startFrame);
    const dur = scene.end_s - scene.start_s;

    let sceneSource = sceneCode || '';
    if (projectDir) {
      const perScenePath = path.join(projectDir, 'scenes', `${scene.id}.mjs`);
      if (fs.existsSync(perScenePath)) {
        sceneSource = fs.readFileSync(perScenePath, 'utf8');
      }
    }

    const useSplit = maxChunkS > 0 && dur > maxChunkS && totalFrames > 1;
    const chunkCount = useSplit ? Math.min(Math.ceil(dur / maxChunkS), totalFrames) : 1;

    if (chunkCount === 1) {
      const overlappingCaptions = captions.filter(
        (c) => c.end_s > scene.start_s && c.start_s < scene.end_s
      );
      const hash = sceneHash(scene, overlappingCaptions, width, height, fps, sceneSource);
      const cacheDir = path.join(projectDir, 'cache', `${scene.id}_${hash}`);
      plan.push({
        id: scene.id,
        sceneId: scene.id,
        chunkIndex: 0,
        chunkCount: 1,
        startFrame,
        endFrame: startFrame + totalFrames,
        frameCount: totalFrames,
        hash,
        cacheDir,
        segmentPath: path.join(cacheDir, 'segment.mp4')
      });
    } else {
      let curFrame = startFrame;
      for (let k = 0; k < chunkCount; k++) {
        const isLast = k === chunkCount - 1;
        const targetEnd = isLast
          ? startFrame + totalFrames
          : Math.min(startFrame + totalFrames, startFrame + Math.round(((k + 1) * totalFrames) / chunkCount));
        const frameCount = Math.max(1, targetEnd - curFrame);
        const chunkEndFrame = curFrame + frameCount;
        const cStartS = curFrame / fps;
        const cEndS = chunkEndFrame / fps;
        const id = `${scene.id}__part${k}`;
        const overlappingCaptions = captions.filter(
          (c) => c.end_s > cStartS && c.start_s < cEndS
        );
        const hash = sceneHash(
          { ...scene, chunkId: id, chunkIndex: k, chunkCount, startFrame: curFrame, endFrame: chunkEndFrame },
          overlappingCaptions, width, height, fps, sceneSource
        );
        const cacheDir = path.join(projectDir, 'cache', `${id}_${hash}`);
        plan.push({
          id,
          sceneId: scene.id,
          chunkIndex: k,
          chunkCount,
          startFrame: curFrame,
          endFrame: chunkEndFrame,
          frameCount,
          hash,
          cacheDir,
          segmentPath: path.join(cacheDir, 'segment.mp4')
        });
        curFrame = chunkEndFrame;
      }
    }
  }

  return plan;
}

export function probeSceneSanity({ VideoClock, timeline, width, height, fps = 30, targetSceneIds = null } = {}) {
  const defects = [];
  const scenes = timeline?.scenes || [];
  if (scenes.length === 0) return { ok: true, defects };

  const targetSet = targetSceneIds && targetSceneIds.length > 0 ? new Set(targetSceneIds) : null;
  const targeted = targetSet ? scenes.filter((s) => targetSet.has(s.id)) : scenes;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const renderSample = (sceneId, t) => {
    try {
      ctx.clearRect(0, 0, width, height);
      VideoClock.setTime(t);
      VideoClock.draw(ctx, width, height, timeline);
    } catch (err) {
      defects.push({
        severity: 'error',
        code: 'render_exception',
        scene_id: sceneId,
        t_s: Number(t.toFixed(3)),
        message: err?.message || String(err)
      });
      return null;
    }

    const rgba = ctx.getImageData(0, 0, width, height).data;
    const hash = crypto.createHash('sha256').update(rgba).digest('hex');

    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let y = 0; y < height; y += 4) {
      const rowOffset = y * width * 4;
      for (let x = 0; x < width; x += 4) {
        const idx = rowOffset + x * 4;
        const lum = 0.2126 * rgba[idx] + 0.7152 * rgba[idx + 1] + 0.0722 * rgba[idx + 2];
        sum += lum;
        sumSq += lum * lum;
        count++;
      }
    }
    const yAvg = count > 0 ? sum / count : 0;
    const yStd = count > 0 ? Math.sqrt(Math.max(0, sumSq / count - yAvg * yAvg)) : 0;
    return { hash, yAvg, yStd };
  };

  let checkedFirstMidpoint = false;

  // Frame 0 determinism & blank check if scene 0 is targeted
  if (scenes[0] && (!targetSet || targetSet.has(scenes[0].id))) {
    const f0a = renderSample(scenes[0].id, 0);
    const f0b = renderSample(scenes[0].id, 0);
    if (f0a && f0b && f0a.hash !== f0b.hash) {
      defects.push({
        severity: 'error',
        code: 'nondeterministic_render',
        scene_id: scenes[0].id,
        t_s: 0,
        message: 'Frame 0 produced different pixel hashes across two identical draws'
      });
    }
    if (f0a && scenes[0].allow_black !== true && f0a.yAvg < 6 && f0a.yStd < 2.0) {
      defects.push({
        severity: 'error',
        code: 'blank_or_black_frame',
        scene_id: scenes[0].id,
        t_s: 0,
        message: `Frame 0 appears blank/black (yAvg=${f0a.yAvg.toFixed(2)}, yStd=${f0a.yStd.toFixed(2)})`
      });
    }
  }

  for (const sc of targeted) {
    const dur = Math.max(0, sc.end_s - sc.start_s);
    const maxSafeEnd = Math.max(sc.start_s, sc.end_s - 1 / Math.max(1, fps));
    const clampSample = (ts) => Math.max(sc.start_s, Math.min(maxSafeEnd, ts));
    const sampleTimes = dur >= 1.0
      ? [
          clampSample(sc.start_s + 0.15 * dur),
          clampSample(sc.start_s + 0.50 * dur),
          clampSample(sc.start_s + 0.85 * dur)
        ]
      : [
          clampSample(sc.start_s + Math.min(0.05, dur * 0.1)),
          clampSample(sc.start_s + dur * 0.5),
          clampSample(sc.end_s - Math.min(0.05, dur * 0.1))
        ];
    const tMid = sampleTimes[1];
    const hashes = [];

    for (let si = 0; si < sampleTimes.length; si++) {
      const ts = sampleTimes[si];
      const s = renderSample(sc.id, ts);
      if (s) {
        hashes.push(s.hash);
        if (sc.allow_black !== true && s.yAvg < 6 && s.yStd < 2.0) {
          defects.push({
            severity: 'error',
            code: 'blank_or_black_frame',
            scene_id: sc.id,
            t_s: Number(ts.toFixed(3)),
            message: `Sampled frame appears blank/black (yAvg=${s.yAvg.toFixed(2)}, yStd=${s.yStd.toFixed(2)})`
          });
        }
        // Check midpoint determinism on first sampled midpoint (and any scene midpoint)
        if (si === 1 && !checkedFirstMidpoint) {
          checkedFirstMidpoint = true;
          const s2 = renderSample(sc.id, ts);
          if (s2 && s2.hash !== s.hash) {
            defects.push({
              severity: 'error',
              code: 'nondeterministic_render',
              scene_id: sc.id,
              t_s: Number(ts.toFixed(3)),
              message: `Midpoint t=${ts.toFixed(3)}s produced different pixel hashes across two draws`
            });
          }
        }
      }

      if (typeof VideoClock.checkInvariants === 'function') {
        try {
          const inv = VideoClock.checkInvariants(ts, timeline);
          if (Array.isArray(inv) && inv.length > 0) {
            defects.push({
              severity: 'error',
              code: 'scene_invariant_failed',
              scene_id: sc.id,
              t_s: Number(ts.toFixed(3)),
              message: inv.join('; ')
            });
          } else if (inv && inv.ok === false) {
            const msg = Array.isArray(inv.errors) ? inv.errors.join('; ') : (inv.message || 'Invariant failed');
            defects.push({
              severity: 'error',
              code: 'scene_invariant_failed',
              scene_id: sc.id,
              t_s: Number(ts.toFixed(3)),
              message: msg
            });
          }
        } catch (err) {
          defects.push({
            severity: 'error',
            code: 'scene_invariant_failed',
            scene_id: sc.id,
            t_s: Number(ts.toFixed(3)),
            message: err?.message || String(err)
          });
        }
      }
    }

    const allHold = Array.isArray(sc.beats) && sc.beats.length > 0 && sc.beats.every((b) => Boolean(b.hold));
    if (dur >= 1.5 && sc.allow_static !== true && !allHold && hashes.length === 3) {
      if (hashes[0] === hashes[1] && hashes[1] === hashes[2]) {
        defects.push({
          severity: 'error',
          code: 'frozen_scene',
          scene_id: sc.id,
          t_s: Number(tMid.toFixed(3)),
          message: `Scene ${sc.id} (${dur.toFixed(2)}s) produced identical frames across start/mid/end`
        });
      }
    }
  }

  return { ok: defects.length === 0, defects };
}

function encodeSegment(ffmpegBin, cacheDir, fps, segmentPath, ffmpegThreads = 0) {
  const tmpSeg = `${segmentPath}.tmp.mp4`;
  try {
    const threadArgs = ffmpegThreads > 0 ? ['-threads', String(ffmpegThreads)] : [];
    execFileSync(
      ffmpegBin,
      [
        '-y',
        '-framerate', String(fps),
        '-i', path.join(cacheDir, 'frame_%06d.png'),
        '-vf', colorFilter(),
        '-pix_fmt', 'yuv420p',
        '-r', String(fps),
        ...videoEncodeArgs({ fps }),
        ...threadArgs,
        '-video_track_timescale', '30000',
        '-an',
        '-f', 'mp4',
        tmpSeg
      ],
      { stdio: 'pipe' }
    );
    fs.renameSync(tmpSeg, segmentPath);
  } catch (err) {
    if (fs.existsSync(tmpSeg)) fs.rmSync(tmpSeg, { force: true });
    throw err;
  }
}

async function renderChunkToSegmentPipe({ ffmpegBin, VideoClock, timeline, width, height, fps, item, ffmpegThreads = 1 }) {
  fs.mkdirSync(item.cacheDir, { recursive: true });
  const tmpSeg = `${item.segmentPath}.tmp.mp4`;
  const donePath = path.join(item.cacheDir, 'done.json');
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  let stderrBuf = Buffer.alloc(0);
  let procErr = null;
  let closed = false;

  const proc = spawn(
    ffmpegBin,
    [
      '-y',
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-s', `${width}x${height}`,
      '-r', String(fps),
      '-i', 'pipe:0',
      '-vf', colorFilter(),
      '-pix_fmt', 'yuv420p',
      '-r', String(fps),
      ...videoEncodeArgs({ fps }),
      '-threads', String(Math.max(1, ffmpegThreads)),
      '-video_track_timescale', '30000',
      '-an',
      '-f', 'mp4',
      tmpSeg
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] }
  );

  proc.stderr.on('data', (chunk) => {
    stderrBuf = Buffer.concat([stderrBuf, chunk]).subarray(-8192);
  });
  proc.on('error', (err) => {
    procErr = procErr || err;
  });
  proc.stdin.on('error', (err) => {
    if (err && err.code !== 'EPIPE') {
      procErr = procErr || err;
    }
  });

  const procClosed = new Promise((resolve) => {
    proc.once('close', (code, signal) => {
      closed = true;
      resolve({ code, signal });
    });
  });

  const cleanupTmp = () => {
    try {
      if (!closed) proc.kill('SIGKILL');
    } catch {
      // ignore
    }
    try {
      if (fs.existsSync(tmpSeg)) fs.rmSync(tmpSeg, { force: true });
    } catch {
      // ignore
    }
  };
  const onSigterm = () => {
    cleanupTmp();
    process.exit(1);
  };
  process.once('SIGTERM', onSigterm);

  try {
    for (let localIdx = 0; localIdx < item.frameCount; localIdx++) {
      if (closed || procErr) break;
      const globalFrame = item.startFrame + localIdx;
      const tSeconds = globalFrame / fps;
      VideoClock.setTime(tSeconds);
      VideoClock.draw(ctx, width, height, timeline);
      const raw = canvas.data();
      if (!closed && !procErr && proc.stdin.writable) {
        const ok = proc.stdin.write(raw);
        if (!ok && !closed && !procErr) {
          await Promise.race([
            once(proc.stdin, 'drain').catch(() => {}),
            procClosed
          ]);
        }
      }
    }

    if (proc.stdin.writable && !proc.stdin.writableEnded) {
      proc.stdin.end();
    }
    const { code, signal } = await procClosed;
    if (procErr) throw procErr;
    if (code !== 0) {
      throw new Error(`ffmpeg rawvideo pipe failed (code=${code}, signal=${signal}): ${stderrBuf.toString('utf8').trim()}`);
    }
    if (!fs.existsSync(tmpSeg) || fs.statSync(tmpSeg).size <= 0) {
      throw new Error(`ffmpeg rawvideo pipe produced empty segment: ${tmpSeg}`);
    }
    fs.renameSync(tmpSeg, item.segmentPath);
    fs.writeFileSync(
      donePath,
      JSON.stringify({
        id: item.id,
        sceneId: item.sceneId,
        frameCount: item.frameCount,
        width,
        height,
        fps,
        segmentsEnabled: true,
        pipeMode: 'rgba'
      }, null, 2)
    );
  } catch (err) {
    cleanupTmp();
    throw err;
  } finally {
    process.removeListener('SIGTERM', onSigterm);
  }
}

function renderChunkWithPngs({ ffmpegBin, VideoClock, timeline, width, height, fps, item, noSegments, ffmpegThreads = 0 }) {
  fs.mkdirSync(item.cacheDir, { recursive: true });
  const donePath = path.join(item.cacheDir, 'done.json');
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  for (let localIdx = 0; localIdx < item.frameCount; localIdx++) {
    const globalFrame = item.startFrame + localIdx;
    const tSeconds = globalFrame / fps;
    VideoClock.setTime(tSeconds);
    VideoClock.draw(ctx, width, height, timeline);
    const frameName = `frame_${String(localIdx).padStart(6, '0')}.png`;
    fs.writeFileSync(path.join(item.cacheDir, frameName), canvas.toBuffer('image/png'));
  }
  if (!noSegments) {
    encodeSegment(ffmpegBin, item.cacheDir, fps, item.segmentPath, ffmpegThreads);
  }
  fs.writeFileSync(
    donePath,
    JSON.stringify({
      id: item.id,
      sceneId: item.sceneId,
      frameCount: item.frameCount,
      width,
      height,
      fps,
      segmentsEnabled: !noSegments
    }, null, 2)
  );
}

function isReusableEntry(entry, requireSegment, requirePngs = false) {
  if (!entry || !entry.cacheDir || !entry.frameCount) return false;
  const donePath = path.join(entry.cacheDir, 'done.json');
  if (!fs.existsSync(donePath)) return false;
  let done;
  try {
    done = JSON.parse(fs.readFileSync(donePath, 'utf8'));
  } catch {
    return false;
  }
  if (done.frameCount !== entry.frameCount) return false;

  if (requireSegment && !requirePngs) {
    return Boolean(
      entry.segmentPath &&
      fs.existsSync(entry.segmentPath) &&
      fs.statSync(entry.segmentPath).size > 0
    );
  }

  for (let i = 0; i < entry.frameCount; i++) {
    if (!fs.existsSync(path.join(entry.cacheDir, `frame_${String(i).padStart(6, '0')}.png`))) {
      return false;
    }
  }
  if (requireSegment) {
    return Boolean(
      entry.segmentPath &&
      fs.existsSync(entry.segmentPath) &&
      fs.statSync(entry.segmentPath).size > 0
    );
  }
  return true;
}

export function pruneStaleSceneCaches(cacheRoot, activeEntries = []) {
  if (!cacheRoot || !fs.existsSync(cacheRoot)) return 0;
  const activeDirs = new Set(
    activeEntries
      .map((e) => (e && e.cacheDir ? path.resolve(e.cacheDir) : null))
      .filter(Boolean)
  );
  const activeSceneIds = new Set(
    activeEntries
      .map((e) => e && (e.sceneId || e.id))
      .filter(Boolean)
  );

  let prunedDirs = 0;
  for (const ent of fs.readdirSync(cacheRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const m = ent.name.match(/^(.+?)(?:__part\d+|_p\d+)?_([0-9a-f]{8,16})$/i);
    if (!m) continue;
    const sceneId = m[1];
    if (!activeSceneIds.has(sceneId)) continue;
    const absDir = path.resolve(cacheRoot, ent.name);
    if (!activeDirs.has(absDir)) {
      fs.rmSync(absDir, { recursive: true, force: true });
      prunedDirs++;
    }
  }
  return prunedDirs;
}

async function runWithConcurrency(items, limit, workerFn) {
  const maxConc = Math.max(1, Math.min(limit, items.length));
  let nextIdx = 0;
  let aborted = false;

  const runner = async () => {
    while (!aborted) {
      const idx = nextIdx++;
      if (idx >= items.length) return;
      try {
        await workerFn(items[idx], idx);
      } catch (err) {
        aborted = true;
        throw err;
      }
    }
  };

  await Promise.all(Array.from({ length: maxConc }, () => runner()));
}

async function runWorkerChunk(payloadPath) {
  const payload = JSON.parse(fs.readFileSync(path.resolve(payloadPath), 'utf8'));
  registerBundledFonts();
  const { VideoClock } = await import(pathToFileURL(payload.sceneModulePath).href);
  if (!VideoClock || typeof VideoClock.setTime !== 'function' || typeof VideoClock.draw !== 'function') {
    throw new Error('scene.mjs must export VideoClock with setTime(seconds) and draw(ctx, width, height)');
  }
  const timeline = JSON.parse(fs.readFileSync(payload.timelinePath, 'utf8'));
  const ffmpegBin = resolveBin('ffmpeg');

  if (!payload.noSegments && !payload.keepPngs) {
    await renderChunkToSegmentPipe({
      ffmpegBin,
      VideoClock,
      timeline,
      width: payload.width,
      height: payload.height,
      fps: payload.fps,
      item: payload.item,
      ffmpegThreads: payload.ffmpegThreads
    });
  } else {
    renderChunkWithPngs({
      ffmpegBin,
      VideoClock,
      timeline,
      width: payload.width,
      height: payload.height,
      fps: payload.fps,
      item: payload.item,
      noSegments: payload.noSegments,
      ffmpegThreads: payload.ffmpegThreads
    });
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.workerChunk) {
    await runWorkerChunk(opts.workerChunk);
    return;
  }

  if (!opts.project) {
    console.error('Usage: render_and_lint.mjs --project <dir> [--draft] [--reel-720] [--only-scenes id1,id2] [--max-chunk-s 12] [--workers 1..8] [--keep-pngs] [--no-segments] [--verify-only] [--skip-probe] [--dry-run] [--json]');
    process.exit(2);
  }

  const projectDir = path.resolve(opts.project);
  const timelinePath = path.join(projectDir, 'timeline.json');
  const sceneModulePath = path.join(projectDir, 'scene.mjs');

  const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
  const lint = lintTimeline(timeline, projectDir);
  // Story-format lint (horror / any brief.format) blocks every render, --draft included, before a frame is drawn.
  // --skip-story-lint exists only to re-render legacy (pre-V5) reels for an audit; master_and_qa still FAILs them.
  const story = opts.skipStoryLint ? { ok: true, errors: [], warns: ['story lint skipped (--skip-story-lint)'] } : lintStoryProject(projectDir);
  if (!story.ok) {
    lint.ok = false;
    lint.errors = [...(lint.errors || []), ...story.errors];
  }
  lint.story = story;
  if (!lint.ok) {
    if (opts.json) console.log(JSON.stringify({ ok: false, lint }, null, 2));
    else console.error('LINT FAILED:\n' + lint.errors.join('\n'));
    process.exit(1);
  }

  const isVertical = timeline.aspect === '9:16' || (timeline.width * 16 === timeline.height * 9);
  let baseWidth = timeline.width;
  let baseHeight = timeline.height;
  if (opts.reel720 && isVertical) {
    baseWidth = 720;
    baseHeight = 1280;
  }
  const scale = opts.draft ? 0.5 : 1.0;
  const width = Math.round(baseWidth * scale);
  const height = Math.round(baseHeight * scale);
  const fps = opts.draft ? Math.min(15, timeline.fps) : (opts.reel720 ? 30 : timeline.fps);

  const sceneCode = fs.readFileSync(sceneModulePath, 'utf8');
  const fullPlan = buildRenderPlan(timeline, {
    width,
    height,
    fps,
    sceneCode,
    projectDir,
    maxChunkS: Number.isFinite(opts.maxChunkS) ? opts.maxChunkS : 12,
    onlyScenes: null
  });

  if (opts.dryRun) {
    const plan = opts.onlyScenes && opts.onlyScenes.length > 0
      ? fullPlan.filter((p) => opts.onlyScenes.includes(p.sceneId))
      : fullPlan;
    const out = { ok: true, dryRun: true, width, height, fps, workers: opts.workers, keepPngs: opts.keepPngs, segmentsEnabled: !opts.noSegments, lint, plan };
    console.log(opts.json ? JSON.stringify(out, null, 2) : `DRY-RUN OK: ${plan.length} chunks (${width}x${height}@${fps})`);
    return;
  }

  registerBundledFonts();

  const { VideoClock } = await import(pathToFileURL(sceneModulePath).href);
  if (!VideoClock || typeof VideoClock.setTime !== 'function' || typeof VideoClock.draw !== 'function') {
    throw new Error('scene.mjs must export VideoClock with setTime(seconds) and draw(ctx, width, height)');
  }

  if (!opts.skipProbe || opts.verifyOnly) {
    const probe = probeSceneSanity({
      VideoClock,
      timeline,
      width,
      height,
      fps,
      targetSceneIds: opts.onlyScenes
    });
    if (opts.verifyOnly) {
      const verifyOut = { ok: lint.ok && probe.ok, lint, probe };
      console.log(opts.json ? JSON.stringify(verifyOut, null, 2) : `VERIFY ${verifyOut.ok ? 'PASS' : 'FAIL'}: ${probe.defects.length} defects`);
      process.exit(verifyOut.ok ? 0 : 1);
    }
    if (!probe.ok) {
      if (opts.json) console.log(JSON.stringify({ ok: false, lint, probe }, null, 2));
      else console.error('PROBE FAILED:\n' + probe.defects.map((d) => `[${d.code}] ${d.scene_id}@${d.t_s}s: ${d.message}`).join('\n'));
      process.exit(1);
    }
  }

  const cacheRoot = path.join(projectDir, 'cache');
  const manifestPath = path.join(cacheRoot, 'render_manifest.json');
  const existingManifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : null;
  const manifestMatches = Boolean(
    existingManifest &&
    existingManifest.width === width &&
    existingManifest.height === height &&
    existingManifest.fps === fps &&
    Array.isArray(existingManifest.scenes)
  );
  const onlySet = opts.onlyScenes && opts.onlyScenes.length > 0 ? new Set(opts.onlyScenes) : null;
  const requirePngs = opts.noSegments || opts.keepPngs;
  const usePipeMode = !opts.noSegments && !opts.keepPngs;
  const ffmpegBin = resolveBin('ffmpeg');

  // Group fullPlan by sceneId preserving timeline scene order
  const sceneOrder = [];
  const byScene = new Map();
  for (const item of fullPlan) {
    if (!byScene.has(item.sceneId)) {
      byScene.set(item.sceneId, []);
      sceneOrder.push(item.sceneId);
    }
    byScene.get(item.sceneId).push(item);
  }

  const manifestSlots = [];
  const chunksToRender = [];

  for (const sceneId of sceneOrder) {
    const isTargeted = !onlySet || onlySet.has(sceneId);
    const curEntries = byScene.get(sceneId);
    if (!isTargeted && manifestMatches) {
      const prevEntries = existingManifest.scenes.filter((e) => (e.sceneId || e.id) === sceneId);
      const boundariesMatch =
        prevEntries.length === curEntries.length &&
        prevEntries.every((prev, idx) =>
          prev.startFrame === curEntries[idx].startFrame &&
          prev.frameCount === curEntries[idx].frameCount &&
          isReusableEntry(prev, !opts.noSegments, requirePngs)
        );
      if (boundariesMatch) {
        for (const prev of prevEntries) {
          manifestSlots.push({ ...prev, reusedFromManifest: true, cacheHit: true });
        }
        continue;
      }
    }

    for (const item of curEntries) {
      const cacheHit = !opts.noCache && isReusableEntry(item, !opts.noSegments, requirePngs);
      const entry = { ...item, cacheHit };
      if (opts.noSegments) delete entry.segmentPath;
      manifestSlots.push(entry);
      if (!cacheHit) {
        chunksToRender.push(item);
      }
    }
  }

  const effectiveWorkers = Math.min(opts.workers, Math.max(1, chunksToRender.length));
  const ffmpegThreads = Math.max(1, Math.floor(detectCpuCount() / effectiveWorkers));

  if (chunksToRender.length > 0) {
    if (effectiveWorkers <= 1) {
      for (const item of chunksToRender) {
        if (usePipeMode) {
          await renderChunkToSegmentPipe({
            ffmpegBin,
            VideoClock,
            timeline,
            width,
            height,
            fps,
            item,
            ffmpegThreads
          });
        } else {
          renderChunkWithPngs({
            ffmpegBin,
            VideoClock,
            timeline,
            width,
            height,
            fps,
            item,
            noSegments: opts.noSegments,
            ffmpegThreads
          });
        }
      }
    } else {
      fs.mkdirSync(cacheRoot, { recursive: true });
      const activeChildren = new Set();
      const payloadFiles = [];
      const scriptFile = fileURLToPath(import.meta.url);
      try {
        await runWithConcurrency(chunksToRender, effectiveWorkers, (item, idx) => new Promise((resolve, reject) => {
          const payloadPath = path.join(cacheRoot, `.worker_${process.pid}_${idx}.json`);
          payloadFiles.push(payloadPath);
          fs.writeFileSync(payloadPath, JSON.stringify({
            projectDir,
            sceneModulePath,
            timelinePath,
            width,
            height,
            fps,
            noSegments: opts.noSegments,
            keepPngs: opts.keepPngs,
            ffmpegThreads,
            item
          }));

          const child = spawn(
            process.execPath,
            [scriptFile, '--worker-chunk', payloadPath],
            { stdio: ['ignore', 'ignore', 'pipe'] }
          );
          activeChildren.add(child);
          let errBuf = Buffer.alloc(0);
          child.stderr.on('data', (d) => {
            errBuf = Buffer.concat([errBuf, d]).subarray(-8192);
          });
          child.on('error', (err) => {
            activeChildren.delete(child);
            reject(err);
          });
          child.on('close', (code, signal) => {
            activeChildren.delete(child);
            if (code === 0) resolve();
            else reject(new Error(`Worker chunk ${item.id} failed (code=${code}, signal=${signal}): ${errBuf.toString('utf8').trim()}`));
          });
        }));
      } catch (err) {
        const kids = Array.from(activeChildren);
        for (const ch of kids) {
          try { ch.kill('SIGTERM'); } catch { /* ignore */ }
        }
        await Promise.race([
          Promise.all(kids.map((ch) => new Promise((resolve) => {
            if (ch.exitCode !== null || ch.signalCode !== null) return resolve();
            ch.once('exit', resolve);
          }))),
          new Promise((resolve) => setTimeout(resolve, 1500))
        ]);
        for (const ch of kids) {
          if (ch.exitCode === null && ch.signalCode === null) {
            try { ch.kill('SIGKILL'); } catch { /* ignore */ }
          }
        }
        for (const item of chunksToRender) {
          const stray = `${item.segmentPath}.tmp.mp4`;
          try {
            if (fs.existsSync(stray)) fs.rmSync(stray, { force: true });
          } catch {
            // ignore
          }
        }
        throw err;
      } finally {
        for (const pf of payloadFiles) {
          if (fs.existsSync(pf)) fs.rmSync(pf, { force: true });
        }
      }
    }
  }

  fs.mkdirSync(cacheRoot, { recursive: true });
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ width, height, fps, draft: Boolean(opts.draft), encoder: ENCODER_VERSION, segmentsEnabled: !opts.noSegments, pipeMode: usePipeMode ? 'rgba' : 'png', scenes: manifestSlots }, null, 2)
  );
  const prunedDirs = pruneStaleSceneCaches(cacheRoot, manifestSlots);

  const result = {
    ok: true,
    width,
    height,
    fps,
    workers: effectiveWorkers,
    pipeMode: usePipeMode ? 'rgba' : 'png',
    segmentsEnabled: !opts.noSegments,
    prunedDirs,
    lint,
    renderedScenes: manifestSlots.length,
    manifest: manifestSlots
  };
  console.log(opts.json ? JSON.stringify(result, null, 2) : `RENDER OK: ${width}x${height}@${fps}, ${manifestSlots.length} chunks`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
