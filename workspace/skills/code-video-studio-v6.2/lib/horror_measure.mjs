// Measured horror gates on the rendered MP4. Declarations (timeline beats, animated_properties) are NOT trusted:
//  1. motion floor: a horror scene may not sit below a measured motion floor for > 2.5 s (except flagged silence /
//     allow_static windows). Also reports a global camera-motion estimate per scene.
//  2. darkness: warn if > 70% of frames are unreadably dark (field mean luma < 8); fail if a scene is effectively
//     black (p98 < 12) for > 1.5 s outside a flagged blackout.
//  3. silence-before-scare: every [SCARE] cue needs a >= 20 dB level drop in the 0.5 s before it and a stinger peak
//     after it, measured on the final mixed audio.
// SHIP still does not measure fear.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { resolveBin } from './runtime.mjs';
import { analyzeVisualField, HORROR_VISUAL, summarize } from './horror_gate.mjs';

export const HORROR_MEASURE = Object.freeze({
  motionFloor: 0.0008, // normalised mean |frame diff| in the analysed field at 4 fps (calibrated, see AUDIT V5)
  maxLowMotionS: 2.5,
  darkFrameLuma: 8,
  darkFrameShareWarn: 0.7,
  blackP98: 12,
  maxBlackS: 1.5,
  scareDropDb: 20,
  scareQuietWindowS: 0.5,
  scareContextS: [2.0, 0.6], // context window = [t-2.0, t-0.6]
  stingerWindowS: 0.5,
  stingerRiseDb: 20,
  audioWinS: 0.02
});

export { cameraShift as estimateCamera } from './horror_gate.mjs';

function inWindows(t, wins) { return wins.some(([a, b]) => t >= a && t < b); }

export function evaluateMotionAndDark(samples, timeline, T = HORROR_MEASURE, sampleFps = HORROR_VISUAL.sampleFps) {
  const out = [];
  const add = (id, ok, msg, severity = 'fail') => out.push({ id, ok: !!ok, severity: ok ? 'pass' : severity, msg });
  const dt = 1 / sampleFps;
  const silenceWins = (timeline.silences || []).map((s) => [s.start_s - 0.1, s.end_s + 0.1]);
  const blackoutWins = (timeline.blackouts || []).map((s) => [s.start_s, s.end_s]);
  const perScene = [];
  for (const sc of timeline.scenes || []) {
    const ss = samples.filter((s) => s.t >= sc.start_s + 0.3 && s.t < sc.end_s - 0.1 && s.motion != null);
    if (!ss.length) continue;
    const exempt = [...silenceWins, ...(sc.allow_static ? [[sc.start_s, sc.end_s]] : [])];
    let run = 0, worst = 0, worstAt = null;
    for (const s of ss) {
      if (s.motion < T.motionFloor && !inWindows(s.t, exempt)) { run += dt; if (run > worst) { worst = run; worstAt = s.t; } } else run = 0;
    }
    let brun = 0, bworst = 0;
    for (const s of ss) {
      if (s.p98 < T.blackP98 && !inWindows(s.t, blackoutWins) && !sc.allow_black) { brun += dt; bworst = Math.max(bworst, brun); } else brun = 0;
    }
    const cam = ss.filter((s) => s.cam != null);
    const m = {
      id: sc.id,
      motion: +(ss.reduce((a, b) => a + b.motion, 0) / ss.length).toFixed(4),
      camera_px_s: cam.length ? +((cam.reduce((a, b) => a + b.cam, 0) / cam.length) * sampleFps * (1080 / HORROR_VISUAL.gw)).toFixed(1) : null,
      low_motion_run_s: +worst.toFixed(2),
      black_run_s: +bworst.toFixed(2)
    };
    perScene.push(m);
    if (worst > T.maxLowMotionS) add(`motion_${sc.id}`, false, `scene "${sc.id}" measured motion < ${T.motionFloor} for ${worst.toFixed(1)}s (ends ~${worstAt.toFixed(1)}s): static frame. Declared animated_properties do not count`);
    if (bworst > T.maxBlackS) add(`black_${sc.id}`, false, `scene "${sc.id}" effectively black (p98 < ${T.blackP98}) for ${bworst.toFixed(1)}s outside a flagged blackout`);
  }
  const dark = samples.filter((s) => s.mean < T.darkFrameLuma).length / Math.max(1, samples.length);
  if (dark > T.darkFrameShareWarn) add('dark_share', false, `${Math.round(dark * 100)}% of frames have field mean luma < ${T.darkFrameLuma}: unreadable on a phone at normal brightness`, 'warn');
  return { checks: out, perScene, dark_share: +dark.toFixed(3) };
}

// Mono power envelope of an audio/video file, in dBFS per window.
export function audioEnvelope(file, winS = HORROR_MEASURE.audioWinS, sr = 16000) {
  const r = spawnSync(resolveBin('ffmpeg'), ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'], { maxBuffer: 1 << 29 });
  if (r.status !== 0) throw new Error('audio decode failed: ' + String(r.stderr).slice(0, 200));
  const f = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 4));
  const W = Math.max(1, Math.round(winS * sr));
  const out = new Float64Array(Math.floor(f.length / W));
  for (let w = 0; w < out.length; w++) {
    let p = 0;
    for (let i = w * W; i < (w + 1) * W; i++) p += f[i] * f[i];
    out[w] = p / W;
  }
  return { power: out, winS };
}

const toDb = (p) => (p > 1e-12 ? 10 * Math.log10(p) : -120);

export function levelDb(env, a, b) {
  const i0 = Math.max(0, Math.floor(a / env.winS)), i1 = Math.min(env.power.length, Math.ceil(b / env.winS));
  if (i1 <= i0) return -120;
  let s = 0;
  for (let i = i0; i < i1; i++) s += env.power[i];
  return toDb(s / (i1 - i0));
}
export function peakDb(env, a, b) {
  const i0 = Math.max(0, Math.floor(a / env.winS)), i1 = Math.min(env.power.length, Math.ceil(b / env.winS));
  let m = 0;
  for (let i = i0; i < i1; i++) m = Math.max(m, env.power[i]);
  return toDb(m);
}

export function evaluateScares(env, timeline, T = HORROR_MEASURE) {
  const out = [];
  const add = (id, ok, msg, severity = 'fail') => out.push({ id, ok: !!ok, severity: ok ? 'pass' : severity, msg });
  const scares = (timeline.audio_cues || []).filter((c) => c.type === 'sfx' && c.scare);
  const measured = [];
  scares.forEach((c, i) => {
    const t = c.t_s;
    const context = levelDb(env, t - T.scareContextS[0], t - T.scareContextS[1]);
    const quiet = levelDb(env, t - T.scareQuietWindowS, t - 0.02);
    const peak = peakDb(env, t, t + T.stingerWindowS);
    const drop = context - quiet;
    const rise = peak - quiet;
    measured.push({ t, context_db: +context.toFixed(1), quiet_db: +quiet.toFixed(1), drop_db: +drop.toFixed(1), stinger_peak_db: +peak.toFixed(1), rise_db: +rise.toFixed(1) });
    add(`scare_drop_${i}`, drop >= T.scareDropDb, `scare at ${t.toFixed(2)}s: level drops only ${drop.toFixed(1)} dB in the 0.5 s before it (need >= ${T.scareDropDb}). Cut the bed and voice before the hit (--bgm horror does this)`);
    add(`scare_stinger_${i}`, rise >= T.stingerRiseDb, `scare at ${t.toFixed(2)}s: no stinger peak after it (rise ${rise.toFixed(1)} dB, need >= ${T.stingerRiseDb})`);
  });
  return { checks: out, scares: measured };
}

export function runHorrorMeasuredGate({ mp4, projectDir }) {
  const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(projectDir, f), 'utf8')); } catch { return null; } };
  const timeline = rd('timeline.json') || { scenes: [] };
  const brief = rd('brief.json') || {};
  const qa = rd('qa.json') || {};
  const T = { ...HORROR_MEASURE, ...(qa.horror_measure || {}) };
  const samples = analyzeVisualField(mp4, { withCamera: true });
  const md = evaluateMotionAndDark(samples, timeline, T);
  const env = audioEnvelope(mp4);
  const sc = evaluateScares(env, timeline, T);
  const lines = (timeline.lines || []).length || (timeline.captions || []).length;
  const checks = [...md.checks, ...sc.checks];
  if (lines < 9) checks.push({ id: 'line_count', ok: false, severity: 'warn', msg: `${lines} spoken lines; a complete horror story needs >= 9` });
  const s = summarize(checks);
  const res = { ...s, per_scene: md.perScene, dark_share: md.dark_share, scares: sc.scares, note: 'Measured gates catch static, black and undropped scares. SHIP does not measure fear: watch it with sound on a phone.' };
  if (brief.smoke_test === true) return { ...res, pass: true, fails: [], warns: [...s.fails.map((x) => '[smoke] ' + x), ...s.warns] };
  return res;
}
