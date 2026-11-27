// Render a cue sheet to stems (sfx / music / ambience / room): 48 kHz stereo float, exactly round(duration_s * sr) frames, linear (no limiter).
import fs from 'node:fs';
import path from 'node:path';
import { SR, dbToLin, clamp, lp, hp, addInto, resampleLinear, curveEnv, smoothstep, peakOf } from './dsp.mjs';
import { makeRng, seedFor } from './rng.mjs';
import { placeStereo, placeMoving, reverbSend, panGains, REVERB_PRESETS } from './space.mjs';
import { SYNTH_KINDS, LAYERS } from './synth/index.mjs';
import { resolveCues, resolveFile } from './cues.mjs';
import { autoTensionFrom } from './music.mjs';
import { resolveGenerated } from './providers.mjs';
import { readWav, writeWavFloat } from './wav.mjs';
import { fitToSpan, normalizeRms } from './fit.mjs';

export function normalizeSynthOut(o) {
  if (o instanceof Float32Array) return { mono: o, pre_s: 0 };
  if (o?.x instanceof Float32Array) return { mono: o.x, pre_s: o.pre_s || 0 };
  if (o?.L instanceof Float32Array) return { L: o.L, R: o.R, pre_s: o.pre_s || 0 };
  throw new Error('synth returned an unsupported value');
}

// One cue -> placed stereo (before cue gain), with pre-roll seconds.
export function renderCueAudio(cue, sound, timeline, { sr = SR, projectDir = null } = {}) {
  let out; const def = SYNTH_KINDS[cue.kind];
  if (cue.source === 'synth') {
    const ctx = { sr, rng: makeRng(seedFor(sound.seed ?? 1, cue.id)), dur: cue.dur_s ?? undefined, timeline };
    if (def.auto_tension) ctx.autoTension = autoTensionFrom(timeline, cue.at_s, cue.dur_s ?? (cue.params?.dur_s ?? def.dur_s));
    out = normalizeSynthOut(def.fn(cue.params || {}, ctx));
  } else {
    let file = cue.file;
    if (!file) file = resolveGenerated(cue).file;
    const w = readWav(resolveFile(projectDir ?? '.', file));
    out = w.mono ? { mono: resampleLinear(w.L, w.sr, sr), pre_s: 0 } : { L: resampleLinear(w.L, w.sr, sr), R: resampleLinear(w.R, w.sr, sr), pre_s: 0 };
    // `until` on a file cue = a bed: trim to the span, or loop with an equal-power crossfade when the file is shorter. One-shots play once.
    if (cue.dur_s) {
      const n = Math.round(cue.dur_s * sr); const xf = Math.round((cue.params?.loop_xfade_s ?? 0.5) * sr);
      if (out.mono) out.mono = fitToSpan(out.mono, n, xf); else { out.L = fitToSpan(out.L, n, xf); out.R = fitToSpan(out.R, n, xf); }
    }
    if (Number.isFinite(cue.normalize_rms_db)) { const g = normalizeRms(out.mono ? [out.mono] : [out.L, out.R], cue.normalize_rms_db); const sc = (x) => x.map((v) => v * g); if (out.mono) out.mono = sc(out.mono); else { out.L = sc(out.L); out.R = sc(out.R); } }
  }
  let L, R;
  const pan = cue.pan ?? 0;
  if (out.mono) {
    if (typeof pan === 'object') ({ L, R } = placeMoving(out.mono, pan.from, pan.to));
    else ({ L, R } = placeStereo(out.mono, pan, { binaural: Boolean(def?.binaural) && cue.layer === 'sfx' && cue.binaural !== false, sr }));
  } else {
    L = out.L; R = out.R;
    if (typeof pan === 'number' && pan !== 0) { const [gl, gr] = panGains(pan); L = L.map((v) => v * gl / Math.SQRT2); R = R.map((v) => v * gr / Math.SQRT2); }
  }
  if (cue.filter?.lp_hz) { L = lp(L, cue.filter.lp_hz, 2, sr); R = lp(R, cue.filter.lp_hz, 2, sr); }
  if (cue.filter?.hp_hz) { L = hp(L, cue.filter.hp_hz, 2, sr); R = hp(R, cue.filter.hp_hz, 2, sr); }
  return { L, R, pre_s: out.pre_s };
}

function dropEnvelope(N, sr, cues) { // per-bus multipliers from automation cues (kind "drop")
  const env = {};
  for (const c of cues) {
    if (c.kind !== 'drop') continue;
    const p = c.params || {}; const depth = dbToLin(p.depth_db ?? -40); const rin = p.ramp_in_s ?? 0.03, rout = p.ramp_out_s ?? 0.02;
    const t1 = c.until_s ?? c.at_s + (p.dur_s ?? 1);
    for (const bus of p.buses ?? ['sfx', 'music', 'ambience']) {
      const e = env[bus] ??= new Float32Array(N).fill(1);
      const i0 = Math.max(0, Math.floor((c.at_s - rin) * sr)), i1 = Math.min(N, Math.ceil((t1 + rout) * sr));
      for (let i = i0; i < i1; i++) { const t = i / sr; const w = smoothstep(c.at_s - rin, c.at_s, t) * (1 - smoothstep(t1, t1 + rout, t)); e[i] *= 1 - (1 - depth) * w; }
    }
  }
  return env;
}

export function renderStems(sound, timeline, { sr = SR, projectDir = null, onCue = null } = {}) {
  const r = resolveCues(sound, timeline, { projectDir });
  if (r.errors.length) { const e = new Error(`sound.json invalid:\n - ${r.errors.join('\n - ')}`); e.errors = r.errors; throw e; }
  const dur = Number(timeline?.duration_s); if (!(dur > 0)) throw new Error('timeline.duration_s missing');
  const N = Math.round(dur * sr);
  const stems = Object.fromEntries(LAYERS.map((l) => [l, { L: new Float32Array(N), R: new Float32Array(N), used: false }]));
  const sends = new Map(); const report = []; const licences = [];
  for (const cue of r.cues) {
    if (cue.kind === 'drop') { report.push(entry(cue, { onset: cue.at_s, end: cue.until_s ?? cue.at_s, ms: 0 })); continue; }
    const t0 = performance.now();
    const def = SYNTH_KINDS[cue.kind];
    const a = renderCueAudio(cue, sound, timeline, { sr, projectDir });
    const startS = cue.at_s - a.pre_s; const i0 = Math.round(startS * sr); const n = a.L.length;
    const g = dbToLin(cue.gain_db ?? def?.gain_db ?? 0);
    const env = new Float32Array(n).fill(g);
    const bedLike = def?.bed || (cue.source !== 'synth' && cue.dur_s);
    const fi = Math.round((cue.fade_in_s ?? (bedLike ? 0.02 : 0.002)) * sr), fo = Math.round((cue.fade_out_s ?? (bedLike ? 0.02 : 0.002)) * sr);
    for (let i = 0; i < Math.min(fi, n); i++) env[i] *= i / fi;
    for (let i = 0; i < Math.min(fo, n); i++) env[n - 1 - i] *= i / fo;
    if (cue.gain_curve_resolved.length) { const ce = curveEnv(cue.gain_curve_resolved.map((p) => ({ t: p.t, g: p.db <= -90 ? 0 : dbToLin(p.db) })), n, sr, startS); for (let i = 0; i < n; i++) env[i] *= ce[i]; }
    const L = new Float32Array(n), R = new Float32Array(n);
    for (let i = 0; i < n; i++) { L[i] = a.L[i] * env[i]; R[i] = a.R[i] * env[i]; }
    const st = stems[cue.layer]; st.used = true;
    addInto(st.L, L, i0, 1); addInto(st.R, R, i0, 1);
    const rv = cue.reverb === false ? null : (cue.reverb ?? sound.space?.[cue.layer] ?? null);
    if (rv) {
      const preset = typeof rv === 'string' ? rv : rv.preset; const send = dbToLin(typeof rv === 'string' ? -12 : (rv.send_db ?? -12));
      const key = `${cue.layer}|${preset}`; let s = sends.get(key); if (!s) { s = { layer: cue.layer, preset, L: new Float32Array(N), R: new Float32Array(N) }; sends.set(key, s); }
      addInto(s.L, L, i0, send); addInto(s.R, R, i0, send);
    }
    const ms = performance.now() - t0;
    const aud = n / sr - a.pre_s;
    report.push(entry(cue, { onset: startS, end: cue.at_s + aud, ms }));
    if (cue.source !== 'synth') licences.push({ id: cue.id, kind: cue.kind, source: cue.source, file: cue.file, licence: cue.licence, ...(cue.query ? { query: cue.query } : {}) });
    onCue?.(cue, ms);
  }
  const tR = performance.now();
  for (const s of [...sends.values()].sort((x, y) => (x.layer + x.preset < y.layer + y.preset ? -1 : 1))) {
    const w = reverbSend(s.L, s.R, s.preset, { sr, seed: sound.seed ?? 1 }); const st = stems[s.layer];
    for (let i = 0; i < N; i++) { st.L[i] += w.L[i]; st.R[i] += w.R[i]; }
  }
  const reverbMs = performance.now() - tR;
  const drop = dropEnvelope(N, sr, r.cues);
  for (const [bus, e] of Object.entries(drop)) { const st = stems[bus]; if (!st) continue; for (let i = 0; i < N; i++) { st.L[i] *= e[i]; st.R[i] *= e[i]; } }
  return { stems, report, licences, sr, frames: N, duration_s: dur, reverb_ms: reverbMs, warnings: r.warnings, derived_events: r.derived_events, seed: r.seed };
}

function entry(cue, { onset, end, ms }) {
  return { id: cue.id, kind: cue.kind, layer: cue.layer, source: cue.source, at: cue.at, at_s: round(cue.at_s), onset_s: round(onset), end_s: round(end), until_s: cue.until_s === null ? undefined : round(cue.until_s), gain_db: cue.gain_db, pan: cue.pan ?? 0, tags: cue.tags, events: cue.events_used, derived_events: cue.derived_events.length ? cue.derived_events : undefined, file: cue.file, render_ms: round(ms) };
}
const round = (x) => Math.round(x * 1000) / 1000;

export function writeStems(result, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const written = {};
  for (const [layer, s] of Object.entries(result.stems)) {
    const file = path.join(outDir, `${layer}.wav`);
    if (s.used) { writeWavFloat(file, s.L, s.R, result.sr); written[layer] = file; }
    else if (fs.existsSync(file)) fs.rmSync(file); // a stale stem from an earlier sheet must not sneak into the mix
  }
  const atomic = (name, obj) => { const p = path.join(outDir, name); const tmp = `${p}.tmp-${process.pid}`; fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n'); fs.renameSync(tmp, p); };
  atomic('cue_report.json', { duration_s: result.duration_s, sample_rate: result.sr, frames: result.frames, seed: result.seed, derived_events: result.derived_events, warnings: result.warnings, stems: Object.keys(written), cues: result.report });
  atomic('licences.json', { generated_by: 'sound_design.mjs', note: 'Every non-synth cue (tier B generated / tier C library) with its file and licence. Tier-A synth cues need none.', entries: result.licences });
  return written;
}
