// Mix: stems + VO -> float stereo; sidechain-style ducking of music/ambience under VO built in JS (exact, capped depth);
// two-pass loudnorm with linear check and a gain+limiter fallback.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SR, dbToLin, clamp, resampleLinear } from './dsp.mjs';
import { readWav } from './wav.mjs';
import { LAYERS } from './synth/index.mjs';
import { DEFAULT_BUSES } from './cues.mjs';

export const DUCK_DEFAULTS = Object.freeze({ depth_db: 5, attack_s: 0.02, release_s: 0.5 });
export const DUCK_LIMITS = Object.freeze({ depth_db: [4, 6], attack_s: [0.01, 0.05], release_s: [0.3, 0.8] });
export const DUCKED_BUSES = ['music', 'ambience']; // never SFX (stingers must stay punchy) and never room tone

export function loadStems(dir) {
  const out = {};
  for (const l of LAYERS) { const f = path.join(dir, `${l}.wav`); if (fs.existsSync(f)) { const w = readWav(f); out[l] = { L: w.L, R: w.R, sr: w.sr }; } }
  return out;
}

export function readAudioAny(file, { ffmpeg = 'ffmpeg', sr = SR } = {}) {
  if (/\.wav$/i.test(file)) { try { const w = readWav(file); return { L: resampleLinear(w.L, w.sr, sr), R: resampleLinear(w.R, w.sr, sr) }; } catch { /* fall through to ffmpeg */ } }
  return decodeToFloat(ffmpeg, file, sr);
}
export function decodeToFloat(ffmpeg, file, sr = SR, extra = []) {
  const r = spawnSync(ffmpeg, ['-v', 'error', '-i', file, ...extra, '-vn', '-ac', '2', '-ar', String(sr), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0 || !r.stdout?.length) throw new Error(`cannot decode audio from ${file}: ${String(r.stderr || '').slice(0, 200)}`);
  const f = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 4));
  const n = Math.floor(f.length / 2); const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = f[i * 2]; R[i] = f[i * 2 + 1]; }
  return { L, R };
}

// Spoken spans: scene lines, else words grouped by line, else null (then QA says voice checks were not run).
export function voSpans(timeline) {
  const spans = [];
  for (const sc of timeline?.scenes || []) for (const l of sc.lines || []) if (Number.isFinite(l.start_s) && Number.isFinite(l.end_s) && l.end_s > l.start_s) spans.push([l.start_s, l.end_s]);
  if (spans.length) return spans;
  const by = new Map();
  for (const w of timeline?.words || []) { const k = w.line ?? 0; const s = by.get(k) || [Infinity, -Infinity]; s[0] = Math.min(s[0], w.start_s); s[1] = Math.max(s[1], w.end_s); by.set(k, s); }
  return [...by.values()].filter((s) => Number.isFinite(s[0]));
}

// Duck envelope from the VO's own level. Voice is "active" when its smoothed envelope is within 30 dB of its 95th percentile.
export function duckEnvelope(voL, voR, sr, cfg = {}) {
  const warnings = [];
  const pick = (k) => { const v = cfg[k] ?? DUCK_DEFAULTS[k]; const [lo, hi] = DUCK_LIMITS[k]; if (v < lo || v > hi) warnings.push(`ducking.${k}=${v} outside ${lo}-${hi}; clamped`); return clamp(v, lo, hi); };
  const depth = pick('depth_db'), atk = pick('attack_s'), rel = pick('release_s');
  const n = voL.length; const env = new Float32Array(n); const c = 1 - Math.exp(-1 / (0.03 * sr)); let e = 0;
  for (let i = 0; i < n; i++) { const a = Math.abs(voL[i]) + Math.abs(voR[i]); e += (a * 0.5 - e) * c; env[i] = e; }
  const sample = []; for (let i = 0; i < n; i += 480) sample.push(env[i]); sample.sort((a, b) => a - b);
  const p95 = sample[Math.floor(sample.length * 0.95)] || 0;
  const thr = Math.max(p95 * Math.pow(10, -30 / 20), Math.pow(10, -60 / 20) * 0.5);
  const g = new Float32Array(n); const gDuck = dbToLin(-depth); let cur = 1, active = 0;
  const ca = 1 - Math.exp(-1 / (atk * sr)), cr = 1 - Math.exp(-1 / (rel * sr));
  for (let i = 0; i < n; i++) { const on = p95 > 0 && env[i] > thr; if (on) active++; const tgt = on ? gDuck : 1; cur += (tgt - cur) * (tgt < cur ? ca : cr); g[i] = cur; }
  return { gain: g, depth_db: depth, attack_s: atk, release_s: rel, active_share: n ? active / n : 0, warnings };
}

export function buildMix({ projectDir, stemsDir, timeline, sound = {}, ffmpeg = 'ffmpeg', sr = SR }) {
  const stems = loadStems(stemsDir || path.join(projectDir, 'audio'));
  const buses = { ...DEFAULT_BUSES, ...(sound.buses || {}) };
  const N = Math.round((timeline?.duration_s ?? 0) * sr) || Math.max(0, ...Object.values(stems).map((s) => s.L.length));
  let vo = null;
  if (timeline?.audio_file) {
    const f = path.join(projectDir, timeline.audio_file);
    if (fs.existsSync(f)) { const a = readAudioAny(f, { ffmpeg, sr }); const L = new Float32Array(N), R = new Float32Array(N); L.set(a.L.subarray(0, N)); R.set(a.R.subarray(0, N)); vo = { L, R }; }
  }
  for (const s of Object.values(stems)) if (s.sr !== sr) throw new Error(`stem sample rate ${s.sr} != ${sr}; re-render stems with sound_design.mjs`);
  const gv = dbToLin(buses.vo);
  const voBus = vo ? { L: vo.L.map((v) => v * gv), R: vo.R.map((v) => v * gv) } : null;
  const duck = voBus ? duckEnvelope(voBus.L, voBus.R, sr, sound.ducking || {}) : null;
  const bed = { L: new Float32Array(N), R: new Float32Array(N) };
  for (const [layer, s] of Object.entries(stems)) {
    const g = dbToLin(buses[layer] ?? 0); const d = duck && DUCKED_BUSES.includes(layer) ? duck.gain : null; const m = Math.min(N, s.L.length);
    for (let i = 0; i < m; i++) { const k = g * (d ? d[i] : 1); bed.L[i] += s.L[i] * k; bed.R[i] += s.R[i] * k; }
  }
  const L = new Float32Array(N), R = new Float32Array(N);
  for (let i = 0; i < N; i++) { L[i] = bed.L[i] + (voBus ? voBus.L[i] : 0); R[i] = bed.R[i] + (voBus ? voBus.R[i] : 0); }
  return { sr, L, R, vo: voBus, bed, duck, buses, stems_present: Object.keys(stems), frames: N };
}

// ---------- loudness ----------
function parseLoudnormJson(stderr) {
  const m = String(stderr).match(/\{[^{}]*"input_i"[^{}]*\}/s);
  if (!m) return null; try { return JSON.parse(m[0]); } catch { return null; }
}
const num = (v) => Number(v);

// Two-pass loudnorm on a WAV. Pass 2 is forced linear; if ffmpeg still reports dynamic (LRA too wide, true peak would clip), we
// do NOT ship the dynamic result (it would pull designed pre-scare silence back up): we apply one fixed gain + limiter instead and warn.
export function normalizeTwoPass({ ffmpeg, inFile, outFile, I = -14, TP = -1.5, LRA = 11 }) {
  const warnings = [];
  const p1 = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-i', inFile, '-af', `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const m = parseLoudnormJson(p1.stderr);
  if (!m) throw new Error('loudnorm pass 1 produced no measurement');
  const mi = num(m.input_i), mtp = num(m.input_tp), mlra = num(m.input_lra), mth = num(m.input_thresh), off = num(m.target_offset);
  const lraT = clamp(Math.max(LRA, Math.ceil(mlra) + 1), 1, 50);
  const wav = ['-c:a', 'pcm_f32le', '-f', 'wav'];
  const tmp = `${outFile}.tmp-${process.pid}`;
  const af2 = `loudnorm=I=${I}:TP=${TP}:LRA=${lraT}:measured_I=${mi}:measured_TP=${mtp}:measured_LRA=${mlra}:measured_thresh=${mth}:offset=${off}:linear=true:print_format=json,aresample=48000`;
  const p2 = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-y', '-i', inFile, '-af', af2, '-ar', '48000', ...wav, tmp], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const s2 = parseLoudnormJson(p2.stderr);
  const type = s2?.normalization_type ?? 'unknown';
  let mode = 'linear';
  if (p2.status !== 0 || type !== 'linear') {
    mode = 'linear-gain+limiter (fallback)';
    warnings.push(`loudnorm pass 2 reported "${type}" normalization (measured LRA ${mlra}, TP ${mtp}); using one fixed gain + limiter instead so designed silences are preserved`);
    const gain = clamp(I - mi, -30, 30); const lim = Math.pow(10, (TP - 1.0) / 20).toFixed(4); // 1 dB extra headroom: AAC encoding overshoots the limiter ceiling by a few tenths of a dB
    const p3 = spawnSync(ffmpeg, ['-hide_banner', '-y', '-i', inFile, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=${lim}:attack=1:release=60:level=disabled`, '-ar', '48000', ...wav, tmp], { encoding: 'utf8' });
    if (p3.status !== 0) throw new Error(`fallback normalization failed: ${String(p3.stderr).slice(-200)}`);
  }
  fs.renameSync(tmp, outFile);
  return { mode, pass1: { input_i: mi, input_tp: mtp, input_lra: mlra, input_thresh: mth, target_offset: off }, pass2_type: type, pass2_output: s2 ? { output_i: num(s2.output_i), output_tp: num(s2.output_tp), output_lra: num(s2.output_lra) } : null, lra_target: lraT, warnings };
}

export function encodeM4a(ffmpeg, inWav, outFile) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-y', '-i', inWav, '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', outFile], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`aac encode failed: ${String(r.stderr).slice(-200)}`);
  return outFile;
}
