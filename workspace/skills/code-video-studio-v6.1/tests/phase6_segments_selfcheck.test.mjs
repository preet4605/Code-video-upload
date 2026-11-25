import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  lintTimeline,
  buildRenderPlan,
  probeSceneSanity,
  pruneStaleSceneCaches,
  detectCpuCount
} from '../scripts/render_and_lint.mjs';
import { resolveBin } from '../lib/runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = path.resolve(__dirname, '..');

function makeTimeline(scenes, captions = [], durationS = null) {
  const dur = durationS ?? scenes[scenes.length - 1].end_s;
  return {
    version: '1.0',
    slug: 'phase6-test',
    aspect: '9:16',
    width: 180,
    height: 320,
    fps: 10,
    duration_s: dur,
    target_lufs: -16,
    true_peak_dbtp: -1.5,
    audio_file: null,
    scenes,
    captions,
    words: [],
    audio_cues: []
  };
}

test('buildRenderPlan() splits 25s scene at maxChunkS=10 into 3 frame-contiguous chunks', () => {
  const tl = makeTimeline([
    {
      id: 'long_scene',
      start_s: 0,
      end_s: 25,
      mood: 'suspense',
      ambient_motion: true,
      beats: [{ t_s: 0, dur_s: 25, hold: false, flashes_per_sec: 0, animated_properties: ['camera.drift'] }]
    }
  ]);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_plan_'));
  try {
    const plan = buildRenderPlan(tl, {
      width: 180,
      height: 320,
      fps: 10,
      sceneCode: 'export const VideoClock = {};',
      projectDir: tmpDir,
      maxChunkS: 10
    });

    assert.equal(plan.length, 3);
    assert.deepEqual(plan.map((c) => c.id), ['long_scene__part0', 'long_scene__part1', 'long_scene__part2']);
    assert.equal(plan[0].startFrame, 0);
    assert.equal(plan[0].endFrame, plan[1].startFrame);
    assert.equal(plan[1].endFrame, plan[2].startFrame);
    assert.equal(plan[2].endFrame, 250);
    assert.equal(plan.reduce((s, c) => s + c.frameCount, 0), 250);
    assert.ok(plan.every((c) => c.sceneId === 'long_scene' && c.chunkCount === 3));
    assert.ok(plan.every((c) => c.segmentPath.endsWith('segment.mp4')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('lintTimeline() rejects overlapping & out-of-bounds captions and missing project files', () => {
  const baseScenes = [
    {
      id: 's1',
      start_s: 0,
      end_s: 4,
      mood: 'neutral',
      ambient_motion: false,
      beats: [{ t_s: 0, dur_s: 4, hold: false, flashes_per_sec: 0, animated_properties: ['caption.reveal'] }]
    }
  ];

  const badBounds = makeTimeline(baseScenes, [
    { text: 'Too early', start_s: -0.2, end_s: 1.5, safe_zone: true },
    { text: 'Too late', start_s: 2.0, end_s: 4.5, safe_zone: true }
  ]);
  const resBounds = lintTimeline(badBounds);
  assert.equal(resBounds.ok, false);
  assert.ok(resBounds.errors.some((e) => e.includes('< -0.05s')));
  assert.ok(resBounds.errors.some((e) => e.includes('> duration_s')));

  const badOverlap = makeTimeline(baseScenes, [
    { text: 'First caption', start_s: 0.2, end_s: 2.2, safe_zone: true },
    { text: 'Second caption', start_s: 1.8, end_s: 3.5, safe_zone: true }
  ]);
  const resOverlap = lintTimeline(badOverlap);
  assert.equal(resOverlap.ok, false);
  assert.ok(resOverlap.errors.some((e) => e.includes('Caption overlap')));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_lint_dir_'));
  try {
    const missingAudioTl = makeTimeline(baseScenes, [{ text: 'Clean caption', start_s: 0.5, end_s: 3.0, safe_zone: true }]);
    missingAudioTl.audio_file = 'missing_vo.wav';
    const resAudio = lintTimeline(missingAudioTl, tmpDir);
    assert.equal(resAudio.ok, false);
    assert.ok(resAudio.errors.some((e) => e.includes('Missing audio_file')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('probeSceneSanity() catches nondeterminism, black frame, frozen scene, checkInvariants failure, and passes clean animated scenes', () => {
  const tl = makeTimeline([
    {
      id: 's1',
      start_s: 0,
      end_s: 2.0,
      mood: 'neutral',
      ambient_motion: false,
      beats: [{ t_s: 0, dur_s: 2.0, hold: false, flashes_per_sec: 0, animated_properties: ['box.x'] }]
    }
  ]);

  let tCur = 0;

  // 1. Nondeterminism
  const randClock = {
    setTime(s) { tCur = s; },
    draw(ctx, w, h) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(20 + Math.random() * 40, 40 + tCur * 20, 40, 40);
    }
  };
  const randRes = probeSceneSanity({ VideoClock: randClock, timeline: tl, width: 180, height: 320, fps: 10 });
  assert.equal(randRes.ok, false);
  assert.ok(randRes.defects.some((d) => d.code === 'nondeterministic_render'));

  // 2. Solid black frame
  const blackClock = {
    setTime(s) { tCur = s; },
    draw(ctx, w, h) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
    }
  };
  const blackRes = probeSceneSanity({ VideoClock: blackClock, timeline: tl, width: 180, height: 320, fps: 10 });
  assert.equal(blackRes.ok, false);
  assert.ok(blackRes.defects.some((d) => d.code === 'blank_or_black_frame'));

  // 3. Frozen scene
  const frozenClock = {
    setTime(s) { tCur = s; },
    draw(ctx, w, h) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(40, 80, 100, 100);
    }
  };
  const frozenRes = probeSceneSanity({ VideoClock: frozenClock, timeline: tl, width: 180, height: 320, fps: 10 });
  assert.equal(frozenRes.ok, false);
  assert.ok(frozenRes.defects.some((d) => d.code === 'frozen_scene'));

  // 4. checkInvariants failure
  const invClock = {
    setTime(s) { tCur = s; },
    draw(ctx, w, h) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(20 + tCur * 30, 80, 50, 50);
    },
    checkInvariants() {
      return { ok: false, errors: ['stamp overlaps header'] };
    }
  };
  const invRes = probeSceneSanity({ VideoClock: invClock, timeline: tl, width: 180, height: 320, fps: 10 });
  assert.equal(invRes.ok, false);
  assert.ok(invRes.defects.some((d) => d.code === 'scene_invariant_failed'));

  // 5. Clean animated scene
  const cleanClock = {
    setTime(s) { tCur = s; },
    draw(ctx, w, h) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(20 + tCur * 40, 80 + tCur * 20, 60, 60);
    },
    checkInvariants() {
      return { ok: true, errors: [] };
    }
  };
  const cleanRes = probeSceneSanity({ VideoClock: cleanClock, timeline: tl, width: 180, height: 320, fps: 10 });
  assert.equal(cleanRes.ok, true, `Expected clean pass, got ${JSON.stringify(cleanRes.defects)}`);
  assert.equal(cleanRes.defects.length, 0);
});

test('E2E 2-scene segmented render + stream-copy master + --only-scenes s2 surgical re-render', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_p6_e2e_'));
  try {
    const tl = makeTimeline(
      [
        {
          id: 's1',
          start_s: 0,
          end_s: 1.0,
          mood: 'neutral',
          ambient_motion: false,
          beats: [{ t_s: 0, dur_s: 1.0, hold: false, flashes_per_sec: 0, animated_properties: ['box.x'] }]
        },
        {
          id: 's2',
          start_s: 1.0,
          end_s: 2.0,
          mood: 'energetic',
          ambient_motion: false,
          beats: [{ t_s: 1.0, dur_s: 1.0, hold: false, flashes_per_sec: 0, animated_properties: ['box.y'] }]
        }
      ],
      [
        { text: 'Scene 1', start_s: 0.1, end_s: 0.9, safe_zone: true },
        { text: 'Scene 2', start_s: 1.1, end_s: 1.9, safe_zone: true }
      ],
      2.0
    );
    fs.writeFileSync(path.join(tmpDir, 'timeline.json'), JSON.stringify(tl, null, 2));

    const makeSceneSrc = (s2Color) => `
let curT = 0;
export const VideoClock = {
  setTime(s) { curT = s; },
  draw(ctx, w, h) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    if (curT < 1.0) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(20 + curT * 80, 90, 50, 50);
    } else {
      ctx.fillStyle = '${s2Color}';
      ctx.fillRect(50, 50 + (curT - 1.0) * 140, 60, 60);
    }
  }
};
`;
    fs.writeFileSync(path.join(tmpDir, 'scene.mjs'), makeSceneSrc('#facc15'));

    const render1Raw = execFileSync(
      'node',
      [path.join(STUDIO_ROOT, 'scripts/render_and_lint.mjs'), '--project', tmpDir, '--json'],
      { encoding: 'utf8' }
    );
    const render1 = JSON.parse(render1Raw);
    assert.equal(render1.ok, true);
    assert.equal(render1.segmentsEnabled, true);
    assert.equal(render1.manifest.length, 2);
    assert.ok(fs.existsSync(render1.manifest[0].segmentPath));
    assert.ok(fs.existsSync(render1.manifest[1].segmentPath));

    const master1Raw = execFileSync(
      'node',
      [path.join(STUDIO_ROOT, 'scripts/master_and_qa.mjs'), '--project', tmpDir, '--json'],
      { encoding: 'utf8' }
    );
    const master1 = JSON.parse(master1Raw);
    assert.equal(master1.ok, true);
    assert.equal(master1.stitch_mode, 'stream-copy');
    assert.ok(fs.existsSync(master1.outMp4));

    // Modify scene 2 and surgically re-render ONLY s2
    fs.writeFileSync(path.join(tmpDir, 'scene.mjs'), makeSceneSrc('#ef4444'));
    const render2Raw = execFileSync(
      'node',
      [path.join(STUDIO_ROOT, 'scripts/render_and_lint.mjs'), '--project', tmpDir, '--only-scenes', 's2', '--json'],
      { encoding: 'utf8' }
    );
    const render2 = JSON.parse(render2Raw);
    assert.equal(render2.ok, true);
    assert.equal(render2.manifest[0].id, 's1');
    assert.equal(render2.manifest[0].reusedFromManifest, true);
    assert.equal(render2.manifest[0].cacheHit, true);
    assert.equal(render2.manifest[1].id, 's2');
    assert.equal(render2.manifest[1].cacheHit, false);

    const master2Raw = execFileSync(
      'node',
      [path.join(STUDIO_ROOT, 'scripts/master_and_qa.mjs'), '--project', tmpDir, '--json'],
      { encoding: 'utf8' }
    );
    const master2 = JSON.parse(master2Raw);
    assert.equal(master2.ok, true);
    assert.equal(master2.stitch_mode, 'stream-copy');
    assert.equal(typeof master2.audio_qa.loudness_retries, 'number');

    // Shift s1/s2 boundary in timeline.json and run --only-scenes s2 -> detects mismatch & re-renders s1 automatically
    tl.scenes[0].end_s = 1.4;
    tl.scenes[0].beats[0].dur_s = 1.4;
    tl.scenes[1].start_s = 1.4;
    tl.scenes[1].end_s = 2.4;
    tl.scenes[1].beats[0].t_s = 1.4;
    tl.scenes[1].beats[0].dur_s = 1.0;
    tl.captions[1].start_s = 1.5;
    tl.captions[1].end_s = 2.3;
    tl.duration_s = 2.4;
    fs.writeFileSync(path.join(tmpDir, 'timeline.json'), JSON.stringify(tl, null, 2));

    const renderShiftRaw = execFileSync(
      'node',
      [path.join(STUDIO_ROOT, 'scripts/render_and_lint.mjs'), '--project', tmpDir, '--only-scenes', 's2', '--json'],
      { encoding: 'utf8' }
    );
    const renderShift = JSON.parse(renderShiftRaw);
    assert.equal(renderShift.ok, true);
    assert.equal(renderShift.manifest[0].id, 's1');
    assert.equal(renderShift.manifest[0].frameCount, 14);
    assert.equal(renderShift.manifest[0].reusedFromManifest, undefined);
    assert.equal(renderShift.manifest[0].cacheHit, false);
    assert.equal(renderShift.manifest[1].id, 's2');
    assert.equal(renderShift.manifest[1].frameCount, 10);

    const masterShiftRaw = execFileSync(
      'node',
      [path.join(STUDIO_ROOT, 'scripts/master_and_qa.mjs'), '--project', tmpDir, '--json'],
      { encoding: 'utf8' }
    );
    const masterShift = JSON.parse(masterShiftRaw);
    assert.equal(masterShift.ok, true);
    assert.equal(masterShift.stitch_mode, 'stream-copy');
    assert.ok(Math.abs(masterShift.ffprobe.duration - 2.4) <= 0.15, `Expected ~2.4s duration, got ${masterShift.ffprobe.duration}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('RGBA pipe writes 0 PNGs, --workers 2 produces monotonic H.264 segments, stale caches auto-prune, and --keep-pngs writes PNGs', () => {
  const ffprobeBin = resolveBin('ffprobe');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_p6_pipe_'));
  const findPngs = (dir) => {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) out.push(...findPngs(p));
      else if (ent.name.endsWith('.png')) out.push(p);
    }
    return out;
  };
  try {
    const tl = makeTimeline(
      [
        { id: 's1', start_s: 0, end_s: 1.0, mood: 'neutral', ambient_motion: false, beats: [{ t_s: 0, dur_s: 1.0, hold: false, flashes_per_sec: 0, animated_properties: ['box.x'] }] },
        { id: 's2', start_s: 1.0, end_s: 2.0, mood: 'energetic', ambient_motion: false, beats: [{ t_s: 1.0, dur_s: 1.0, hold: false, flashes_per_sec: 0, animated_properties: ['box.y'] }] },
        { id: 's3', start_s: 2.0, end_s: 3.0, mood: 'calm', ambient_motion: false, beats: [{ t_s: 2.0, dur_s: 1.0, hold: false, flashes_per_sec: 0, animated_properties: ['box.x'] }] }
      ],
      [
        { text: 'One', start_s: 0.1, end_s: 0.9, safe_zone: true },
        { text: 'Two', start_s: 1.1, end_s: 1.9, safe_zone: true },
        { text: 'Three', start_s: 2.1, end_s: 2.9, safe_zone: true }
      ],
      3.0
    );
    fs.writeFileSync(path.join(tmpDir, 'timeline.json'), JSON.stringify(tl, null, 2));
    fs.writeFileSync(path.join(tmpDir, 'scene.mjs'), `
let curT = 0;
export const VideoClock = {
  setTime(s) { curT = s; },
  draw(ctx, w, h) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = curT < 1 ? '#38bdf8' : curT < 2 ? '#facc15' : '#22c55e';
    ctx.fillRect(20 + (curT % 1) * 90, 60 + (curT % 1) * 80, 50, 50);
  }
};
`);

    // 1. Default segmented render -> raw RGBA pipe, 0 PNGs in cache/
    const r1 = JSON.parse(execFileSync(
      'node',
      [path.join(STUDIO_ROOT, 'scripts/render_and_lint.mjs'), '--project', tmpDir, '--workers', '1', '--json'],
      { encoding: 'utf8' }
    ));
    assert.equal(r1.ok, true);
    assert.equal(r1.pipeMode, 'rgba');
    assert.equal(findPngs(path.join(tmpDir, 'cache')).length, 0, 'Expected 0 PNG files in cache/ in default pipe mode');
    for (const seg of r1.manifest) {
      const done = JSON.parse(fs.readFileSync(path.join(seg.cacheDir, 'done.json'), 'utf8'));
      assert.equal(done.pipeMode, 'rgba');
      const probe = JSON.parse(execFileSync(ffprobeBin, ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=codec_name,nb_read_frames', '-of', 'json', seg.segmentPath], { encoding: 'utf8' }));
      assert.equal(probe.streams[0].codec_name, 'h264');
      assert.equal(Number(probe.streams[0].nb_read_frames), seg.frameCount);
    }

    // 2. --workers 2 parallel render across 3 chunks + master_and_qa monotonic PTS/DTS
    const r2 = JSON.parse(execFileSync(
      'node',
      [path.join(STUDIO_ROOT, 'scripts/render_and_lint.mjs'), '--project', tmpDir, '--workers', '2', '--no-cache', '--json'],
      { encoding: 'utf8' }
    ));
    assert.equal(r2.ok, true);
    assert.equal(r2.workers, 2);
    assert.equal(findPngs(path.join(tmpDir, 'cache')).length, 0);
    assert.deepEqual(r2.manifest.map((m) => m.frameCount), r1.manifest.map((m) => m.frameCount));

    const m2 = JSON.parse(execFileSync(
      'node',
      [path.join(STUDIO_ROOT, 'scripts/master_and_qa.mjs'), '--project', tmpDir, '--json'],
      { encoding: 'utf8' }
    ));
    assert.equal(m2.ok, true);
    assert.equal(m2.stitch_mode, 'stream-copy');
    assert.ok(fs.existsSync(m2.contactSheet));
    const pktRaw = execFileSync(ffprobeBin, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts,dts', '-of', 'json', m2.outMp4], { encoding: 'utf8' });
    const pkts = JSON.parse(pktRaw).packets || [];
    assert.ok(pkts.length >= 30);
    for (let i = 1; i < pkts.length; i++) {
      assert.ok(Number(pkts[i].dts) > Number(pkts[i - 1].dts), `Non-monotonic DTS at packet ${i}`);
    }

    // 3. Stale scene cache pruning while active cache stays intact
    const staleDir = path.join(tmpDir, 'cache', 's2_deadbeefcafe');
    fs.mkdirSync(staleDir, { recursive: true });
    fs.writeFileSync(path.join(staleDir, 'done.json'), '{}');
    const rPrune = JSON.parse(execFileSync(
      'node',
      [path.join(STUDIO_ROOT, 'scripts/render_and_lint.mjs'), '--project', tmpDir, '--workers', '2', '--json'],
      { encoding: 'utf8' }
    ));
    assert.equal(rPrune.prunedDirs, 1);
    assert.equal(fs.existsSync(staleDir), false, 'Stale cache dir must be pruned');
    assert.ok(fs.existsSync(rPrune.manifest[1].segmentPath), 'Active cache dir must stay intact');

    // 4. --keep-pngs writes frame_%06d.png files for backward compatibility
    const rKeep = JSON.parse(execFileSync(
      'node',
      [path.join(STUDIO_ROOT, 'scripts/render_and_lint.mjs'), '--project', tmpDir, '--only-scenes', 's1', '--keep-pngs', '--no-cache', '--workers', '1', '--json'],
      { encoding: 'utf8' }
    ));
    assert.equal(rKeep.pipeMode, 'png');
    assert.ok(fs.existsSync(path.join(rKeep.manifest[0].cacheDir, 'frame_000000.png')));
    assert.equal(pruneStaleSceneCaches(path.join(tmpDir, 'cache'), rKeep.manifest), 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detectCpuCount() survives PRoot (>=1) and default --workers uses it', () => {
  const cpu = detectCpuCount();
  assert.ok(Number.isInteger(cpu) && cpu >= 1, `detectCpuCount() must be >= 1, got ${cpu}`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_p6_cpu_'));
  try {
    const tl = makeTimeline(
      [
        { id: 's1', start_s: 0, end_s: 1.0, mood: 'neutral', ambient_motion: false, beats: [{ t_s: 0, dur_s: 1.0, hold: false, flashes_per_sec: 0, animated_properties: ['box.x'] }] },
        { id: 's2', start_s: 1.0, end_s: 2.0, mood: 'calm', ambient_motion: false, beats: [{ t_s: 1.0, dur_s: 1.0, hold: false, flashes_per_sec: 0, animated_properties: ['box.y'] }] }
      ],
      [],
      2.0
    );
    fs.writeFileSync(path.join(tmpDir, 'timeline.json'), JSON.stringify(tl, null, 2));
    fs.writeFileSync(path.join(tmpDir, 'scene.mjs'), `
let curT = 0;
export const VideoClock = {
  setTime(s) { curT = s; },
  draw(ctx, w, h) {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(10 + (curT % 1) * 40, 20, 40, 40);
  }
};
`);
    const r = JSON.parse(execFileSync(
      'node',
      [path.join(STUDIO_ROOT, 'scripts/render_and_lint.mjs'), '--project', tmpDir, '--json'],
      { encoding: 'utf8' }
    ));
    assert.equal(r.ok, true);
    assert.equal(r.workers, Math.min(4, cpu, tl.scenes.length), `default workers must be min(4, ${cpu}, ${tl.scenes.length} chunks), got ${r.workers}`);
    if (cpu > 1) {
      assert.ok(r.workers > 1, `Expected default --workers > 1 on multi-core PRoot (cpu=${cpu})`);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('worker failure with --workers 2 leaves zero *.tmp.mp4 files in cache/', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_p6_fail_'));
  const findTmp = (dir) => {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) out.push(...findTmp(p));
      else if (ent.name.endsWith('.tmp.mp4')) out.push(p);
    }
    return out;
  };
  try {
    const tl = makeTimeline(
      [
        { id: 's1', start_s: 0, end_s: 1.0, mood: 'neutral', ambient_motion: false, beats: [{ t_s: 0, dur_s: 1.0, hold: false, flashes_per_sec: 0, animated_properties: ['box.x'] }] },
        { id: 's2', start_s: 1.0, end_s: 2.0, mood: 'calm', ambient_motion: false, beats: [{ t_s: 1.0, dur_s: 1.0, hold: false, flashes_per_sec: 0, animated_properties: ['box.y'] }] },
        { id: 's3', start_s: 2.0, end_s: 3.0, mood: 'calm', ambient_motion: false, beats: [{ t_s: 2.0, dur_s: 1.0, hold: false, flashes_per_sec: 0, animated_properties: ['box.x'] }] }
      ],
      [],
      3.0
    );
    fs.writeFileSync(path.join(tmpDir, 'timeline.json'), JSON.stringify(tl, null, 2));
    // s1 throws mid-render; s2/s3 would otherwise succeed in sibling workers.
    fs.writeFileSync(path.join(tmpDir, 'scene.mjs'), `
let curT = 0;
export const VideoClock = {
  setTime(s) { curT = s; },
  draw(ctx, w, h) {
    if (curT >= 0.05 && curT < 0.95) throw new Error('boom from s1');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(20 + (curT % 1) * 50, 30, 40, 40);
  }
};
`);
    let failed = false;
    try {
      execFileSync(
        'node',
        [path.join(STUDIO_ROOT, 'scripts/render_and_lint.mjs'), '--project', tmpDir, '--workers', '2', '--no-cache', '--json'],
        { encoding: 'utf8', stdio: 'pipe' }
      );
    } catch (err) {
      failed = true;
      assert.notEqual(err.status, 0, 'Render must exit non-zero when a worker throws');
    }
    assert.equal(failed, true, 'Expected the --workers 2 render to fail');
    const leftovers = findTmp(path.join(tmpDir, 'cache'));
    assert.deepEqual(leftovers, [], `Expected zero *.tmp.mp4 leftovers, found: ${leftovers.join(', ')}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
