// Underscore generator: drones, evolving pads, sparse piano-like motifs and tension strings, all additive/modal synthesis.
// It is underscore for horror (dark, sparse, slow), not songs: no beat, no melody longer than a few notes, lots of rests.
import { SR, mtof, lerp, clamp, smoothstep, svf, whiteNoise, lp, normalizeRms, addInto, applyBiquad, biquadCoefs } from './dsp.mjs';
import { panGains } from './space.mjs';
import { computeTensionCurve } from '../audio_sfx.mjs';

export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  whole_tone: [0, 2, 4, 6, 8, 10],
  cluster: [0, 1, 2, 3, 6]
};
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function keyToMidi(key = 'D', octave = 2) {
  if (!Object.hasOwn(NOTE, key)) throw new Error(`music: unknown key "${key}"; use C, C#, D, Eb, E, F, F#, G, Ab, A, Bb, B`);
  return 12 * (octave + 1) + NOTE[key];
}
const degreeMidi = (root, scale, deg) => { const s = SCALES[scale]; const o = Math.floor(deg / s.length); return root + s[((deg % s.length) + s.length) % s.length] + 12 * o; };

// Tension 0..1 as a Float32Array at 50 Hz over the cue. Sources: number, [{t,v}] cue-relative, or 'auto' (timeline via computeTensionCurve).
export function tensionTrack(spec, n, sr, ctx = {}) {
  const hz = 50; const m = Math.ceil(n / sr * hz) + 2; const tr = new Float32Array(m);
  for (let k = 0; k < m; k++) {
    const t = k / hz; let v;
    if (typeof spec === 'number') v = spec;
    else if (Array.isArray(spec)) { const pts = [...spec].sort((a, b) => a.t - b.t); if (t <= pts[0].t) v = pts[0].v; else if (t >= pts.at(-1).t) v = pts.at(-1).v; else { let j = 0; while (pts[j + 1].t < t) j++; v = lerp(pts[j].v, pts[j + 1].v, smoothstep(pts[j].t, pts[j + 1].t, t)); } }
    else if (ctx.autoTension) v = ctx.autoTension(t);
    else v = 0.5;
    tr[k] = clamp(v, 0, 1);
  }
  return (i) => { const x = i / sr * hz; const k = Math.floor(x); return lerp(tr[k], tr[Math.min(m - 1, k + 1)], x - k); };
}
// Build the auto-tension function (cue-relative seconds) from the timeline's moods, scares and silence drops.
export function autoTensionFrom(timeline, t0, durS) {
  if (!timeline) return null;
  const curve = computeTensionCurve(timeline, Math.max(timeline.duration_s || 0, t0 + durS));
  return (t) => clamp((curve.evalAt(t0 + t).gain - 0.04) / 1.2, 0, 1);
}

const stereoMix = (n) => ({ L: new Float32Array(n), R: new Float32Array(n) });
function addPanned(st, mono, at, pan, g = 1) { const [gl, gr] = panGains(pan); addInto(st.L, mono, at, g * gl); addInto(st.R, mono, at, g * gr); }

export function drone(p, ctx) {
  const { sr, rng } = ctx; const n = Math.round((p.dur_s ?? ctx.dur ?? 20) * sr);
  const T = tensionTrack(p.tension ?? 'auto', n, sr, ctx); const root = keyToMidi(p.key, p.octave ?? 2); const st = stereoMix(n);
  const amps = [1, 0.6, 0.42, 0.28, 0.16, 0.1];
  for (let c = 0; c < 2; c++) {
    const raw = new Float32Array(n);
    for (const [oct, w] of [[0, 1], [-1, 0.55]]) {
      const f0 = mtof(root + 12 * oct); const det = (c ? 0.31 : -0.27) * (1 + 0.5 * rng.next());
      const ph = amps.map(() => rng.next() * 6.28); const ph0 = ph.slice();
      for (let k = 0; k < amps.length; k++) {
        const f = (f0 + det) * (k + 1); const wv = 2 * Math.PI * f / sr; const vib = 0.0015 * (k + 1);
        for (let i = 0; i < n; i++) raw[i] += w * amps[k] * Math.sin(wv * i + ph0[k] + vib * Math.sin(2 * Math.PI * 0.11 * i / sr));
      }
    }
    const fc = new Float32Array(n), g = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = T(i); fc[i] = 180 + 1700 * t * t; g[i] = 0.35 + 0.65 * t; }
    const y = svf(raw, fc, 0.9, 'lp', sr);
    for (let i = 0; i < n; i++) (c ? st.R : st.L)[i] = y[i] * g[i] * Math.min(1, i / (2 * sr), (n - i) / (2 * sr));
  }
  return st;
}

export function pad(p, ctx) {
  const { sr, rng } = ctx; const n = Math.round((p.dur_s ?? ctx.dur ?? 20) * sr); const st = stereoMix(n);
  const T = tensionTrack(p.tension ?? 'auto', n, sr, ctx); const scale = p.scale ?? 'phrygian'; const root = keyToMidi(p.key, p.octave ?? 3);
  const beat = 60 / (p.tempo ?? 56); const noteLen = Math.max(5, 8 * beat); let t = 0, deg = 0;
  const hs = [1, 0.5, 0.3, 0.18];
  while (t < n / sr) {
    const tens = T(Math.round(t * sr)); const voices = 2 + Math.round(2 * tens);
    const len = noteLen * rng.uniform(0.9, 1.3); const nn = Math.round(len * sr); const grid = [0, 4, 1, 5, 2];
    for (let v = 0; v < voices; v++) {
      const d = deg + grid[v % grid.length] + (v >= 4 ? 7 : 0); const f0 = mtof(degreeMidi(root, scale, d));
      const mono = new Float32Array(nn); const det = [0, 0.4 + 0.3 * rng.next(), -0.45];
      for (const dt of det) for (let k = 0; k < hs.length; k++) { const w = 2 * Math.PI * (f0 * (k + 1) + dt * (k + 1)) / sr; const ph = rng.next() * 6.28; const a = hs[k] / det.length; for (let i = 0; i < nn; i++) mono[i] += a * Math.sin(w * i + ph); }
      for (let i = 0; i < nn; i++) { const u = i / nn; mono[i] *= Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 2); }
      const dark = applyBiquad(mono, biquadCoefs('lp', 700 + 2200 * tens, 0.7, sr));
      addPanned(st, dark, Math.round(t * sr), (v / Math.max(1, voices - 1) - 0.5) * 1.2, 0.5 / Math.sqrt(voices));
    }
    deg = (deg + rng.pick([0, 1, -1, 2, 3, -2])) ; deg = clamp(deg, -3, 5);
    t += len * 0.6;
  }
  return st;
}

// Piano-ish note by modal synthesis: inharmonic partials with per-partial decay + a soft hammer noise.
export function pianoNote(f0, rng, sr, { dur = 3, vel = 0.7, B = 0.0004 } = {}) {
  const n = Math.round(dur * sr); const y = new Float32Array(n);
  for (let k = 1; k <= 14; k++) {
    const f = k * f0 * Math.sqrt(1 + B * k * k); if (f > 9000) break;
    const a = vel * Math.pow(k, -1.15) * (k === 2 ? 0.8 : 1); const tau = (dur * 0.5) / (1 + 0.9 * (k - 1)) * (f0 < 200 ? 1.4 : 1);
    const w = 2 * Math.PI * f / sr; const ph = rng.next() * 0.5; const kk = Math.exp(-1 / (tau * sr)); let e = a;
    for (let i = 0; i < n && e > 1e-4; i++) { y[i] += e * Math.sin(w * i + ph); e *= kk; }
  }
  const h = lp(whiteNoise(rng, Math.round(0.02 * sr)), 2500, 2, sr); for (let i = 0; i < h.length; i++) y[i] += h[i] * Math.exp(-i / (0.004 * sr)) * 0.25 * vel;
  const att = Math.round(0.002 * sr); for (let i = 0; i < att; i++) y[i] *= i / att;
  return y;
}

export function piano_motif(p, ctx) {
  const { sr, rng } = ctx; const n = Math.round((p.dur_s ?? ctx.dur ?? 20) * sr); const st = stereoMix(n);
  const T = tensionTrack(p.tension ?? 'auto', n, sr, ctx); const scale = p.scale ?? 'phrygian'; const root = keyToMidi(p.key, p.octave ?? 4);
  const beat = 60 / (p.tempo ?? 56); let t = (p.first_s ?? 1.5) * rng.uniform(0.8, 1.2), deg = rng.int(0, 3);
  while (t < n / sr - 1.5) {
    const tens = T(Math.round(t * sr)); const hold = rng.next() < 0.45 + 0.35 * tens; // rests are the point
    if (hold) { t += beat * rng.pick([1, 2, 3]); continue; }
    deg = clamp(deg + rng.pick([-2, -1, -1, 0, 1, 2, 3]), -4, 9);
    const m = degreeMidi(root, scale, deg); const vel = 0.35 + 0.35 * rng.next();
    const note = pianoNote(mtof(m), rng, sr, { dur: 3.5, vel });
    const pan = rng.uniform(-0.4, 0.4); addPanned(st, note, Math.round(t * sr), pan, 0.7);
    if (tens > 0.65 && rng.next() < 0.35) addPanned(st, pianoNote(mtof(m + 1), rng, sr, { dur: 2.5, vel: vel * 0.6 }), Math.round((t + 0.03) * sr), pan, 0.5); // minor-2nd cluster
    t += beat * rng.pick([2, 3, 4, 5]);
  }
  return st;
}

export function strings_tension(p, ctx) {
  const { sr, rng } = ctx; const n = Math.round((p.dur_s ?? ctx.dur ?? 20) * sr); const st = stereoMix(n);
  const T = tensionTrack(p.tension ?? 'auto', n, sr, ctx);
  let mx = 0; for (let i = 0; i < n; i += 480) mx = Math.max(mx, T(i));
  if (mx < 0.15) return st; // nothing to play
  const root = keyToMidi(p.key, p.octave ?? 4); const notes = [root, root + 1, root + 6, root + 13].slice(0, 3);
  notes.forEach((m, vi) => {
    const f0 = mtof(m) * (1 + (rng.next() - 0.5) * 0.009); const mono = new Float32Array(n); const H = 10;
    const ph = new Float64Array(H).map(() => rng.next() * 6.28); const vph = rng.next() * 6.28; const glide = rng.uniform(-0.5, 0.5);
    const amp = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = T(i); amp[i] = Math.pow(t, 2.2) * Math.min(1, i / (1.5 * sr), (n - i) / (1.5 * sr)); }
    for (let k = 0; k < H; k++) {
      let phase = ph[k]; const a = 1 / (k + 1);
      for (let i = 0; i < n; i++) {
        const t = i / sr; const f = f0 * (1 + 0.006 * Math.sin(2 * Math.PI * 5.3 * t + vph) * Math.min(1, t / 2) + 0.0059 * glide * T(i));
        phase += 2 * Math.PI * f * (k + 1) / sr; mono[i] += a * Math.sin(phase);
      }
    }
    const fc = new Float32Array(n); for (let i = 0; i < n; i++) fc[i] = 500 + 3500 * Math.pow(T(i), 1.5);
    const y = svf(mono, fc, 0.8, 'lp', sr); for (let i = 0; i < n; i++) y[i] *= amp[i];
    addPanned(st, y, 0, (vi - 1) * 0.55, 0.45);
  });
  return st;
}

// Everything together. layers: {drone,pad,motif,strings} booleans (default all true). Normalised to ~ -20 dBFS RMS like other beds.
export function underscore(p, ctx) {
  const n = Math.round((p.dur_s ?? ctx.dur ?? 20) * ctx.sr); const out = stereoMix(n); const lay = { drone: true, pad: true, motif: true, strings: true, ...(p.layers || {}) };
  const sub = (name) => ({ ...ctx, rng: ctx.rng.fork(name) });
  const parts = [];
  if (lay.drone) parts.push([drone(p, sub('drone')), 1]);
  if (lay.pad) parts.push([pad(p, sub('pad')), 0.55]);
  if (lay.motif) parts.push([piano_motif(p, sub('motif')), 0.5]);
  if (lay.strings) parts.push([strings_tension(p, sub('strings')), 0.6]);
  for (const [s, g] of parts) for (let i = 0; i < n; i++) { out.L[i] += s.L[i] * g; out.R[i] += s.R[i] * g; }
  const e = Math.sqrt((out.L.reduce((a, v) => a + v * v, 0) + out.R.reduce((a, v) => a + v * v, 0)) / (2 * n)) || 1;
  const g = 0.1 / e; for (let i = 0; i < n; i++) { out.L[i] *= g; out.R[i] *= g; }
  return out;
}

function normStereo(st, target = 0.1) {
  const n = st.L.length; let e = 0; for (let i = 0; i < n; i++) e += st.L[i] * st.L[i] + st.R[i] * st.R[i];
  e = Math.sqrt(e / (2 * n)); if (e > 1e-9) { const g = target / e; for (let i = 0; i < n; i++) { st.L[i] *= g; st.R[i] *= g; } }
  return st;
}
const std = (fn) => (p, ctx) => normStereo(fn(p, ctx));
const common = 'params: key (C..B), scale minor|phrygian|locrian|harmonic_minor|whole_tone|cluster, tempo, tension (0..1 | [{t,v}] | "auto" = timeline mood/scare curve), dur_s';
export const KINDS = {
  underscore: { fn: underscore, dur_s: 20, gain_db: -12, layer: 'music', bed: true, stereo: true, auto_tension: true, note: `${common}, layers {drone,pad,motif,strings}` },
  drone: { fn: std(drone), dur_s: 20, gain_db: -14, layer: 'music', bed: true, stereo: true, auto_tension: true, note: common },
  pad: { fn: std(pad), dur_s: 20, gain_db: -16, layer: 'music', bed: true, stereo: true, auto_tension: true, note: common },
  piano_motif: { fn: std(piano_motif), dur_s: 20, gain_db: -16, layer: 'music', bed: true, stereo: true, auto_tension: true, note: common },
  strings_tension: { fn: std(strings_tension), dur_s: 20, gain_db: -16, layer: 'music', bed: true, stereo: true, auto_tension: true, note: common }
};
