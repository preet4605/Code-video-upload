// Door creak (stick-slip friction through a moving resonance), footsteps on surfaces, cloth/foot shuffles.
import { SR, bp, hp, lp, svf, whiteNoise, slowRandom, normalizePeak, normalizeRms, expDecay, addInto, dbToLin, lerp, clamp } from '../dsp.mjs';
import { modalBank } from './modal.mjs';
import { placeStereo } from '../space.mjs';

// Stick-slip: a bow/hinge sticks, builds tension, slips. Model: slip-event pulse train with irregular rate, each event a random-amplitude
// impulse, excited into a state-variable bandpass whose centre drifts (the "voice" of the hinge); stick pauses gate the output.
export function creak(p, { sr, rng, dur }) {
  const n = Math.round((p.dur_s ?? dur ?? 2.5) * sr);
  const wander = slowRandom(rng, n, sr, 0.9, 4), wander2 = slowRandom(rng, n, sr, 1.7, 3), stick = slowRandom(rng, n, sr, 1.3, 4);
  const imp = new Float32Array(n); let phase = 0;
  const base = p.slip_hz ?? 38;
  for (let i = 0; i < n; i++) {
    phase += (base * (0.4 + 1.4 * wander2[i])) / sr; // slip rate irregular: 0.4x .. 1.8x
    if (phase >= 1) { phase -= 1; imp[i] = 0.4 + 0.6 * rng.next(); }
  }
  // soften impulses into short sawtooth-like pulses (a slip is not a click)
  const pulse = lp(imp, 3000, 2, sr);
  const f1 = new Float32Array(n), f2 = new Float32Array(n);
  const lo = p.f_lo ?? 420, hi = p.f_hi ?? 1100;
  for (let i = 0; i < n; i++) { f1[i] = lo + (hi - lo) * wander[i]; f2[i] = f1[i] * 2.35 + 200 * wander2[i]; }
  const a = svf(pulse, f1, p.q ?? 14, 'bp', sr), b = svf(pulse, f2, (p.q ?? 14) * 1.3, 'bp', sr);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n; const bow = Math.sin(Math.PI * t) ** 0.7; // opens, peaks mid-swing, ends
    const gate = clamp((stick[i] - 0.33) * 4.5, 0, 1); // stick phases are quiet
    y[i] = (a[i] + 0.55 * b[i]) * bow * gate;
  }
  const air = bp(whiteNoise(rng, n), 1800, 6000, 2, sr); for (let i = 0; i < n; i++) y[i] += air[i] * 0.02 * Math.sin(Math.PI * i / n);
  return normalizePeak(y, 1);
}

export const SURFACES = {
  wood:     { f0: 150, ratios: [1, 2.3, 3.9], taus: [0.06, 0.04, 0.025], click: [700, 3500], noiseG: 0.5, grains: 0, lp: 7000 },
  concrete: { f0: 95,  ratios: [1, 1.7, 3.1], taus: [0.05, 0.03, 0.02], click: [1500, 6000], noiseG: 0.7, grains: 0, lp: 9000 },
  tile:     { f0: 210, ratios: [1, 2.6, 4.4], taus: [0.04, 0.03, 0.02], click: [2500, 8000], noiseG: 0.8, grains: 0, lp: 11000 },
  gravel:   { f0: 110, ratios: [1, 2.0], taus: [0.04, 0.025], click: [1200, 6000], noiseG: 0.2, grains: 26, lp: 8000 },
  grass:    { f0: 80,  ratios: [1, 1.8], taus: [0.05, 0.03], click: [300, 2000], noiseG: 0.3, grains: 6, lp: 3500 },
  carpet:   { f0: 70,  ratios: [1, 1.6], taus: [0.05, 0.03], click: [200, 1200], noiseG: 0.2, grains: 0, lp: 2200 }
};

function oneStep(surface, rng, sr, hard = 1) {
  const S = SURFACES[surface]; if (!S) throw new Error(`footsteps: unknown surface "${surface}"; known: ${Object.keys(SURFACES).join(', ')}`);
  const n = Math.round(0.4 * sr);
  const y = modalBank(n, S.ratios.map((r, i) => ({ f: S.f0 * r * (1 + 0.04 * rng.gauss()), a: 1 / (1 + i * 0.6), tau: S.taus[i] * (0.8 + 0.4 * rng.next()), ph: 0 })), sr);
  const nc = Math.round(0.03 * sr); const c = bp(whiteNoise(rng, nc), S.click[0], S.click[1], 2, sr);
  for (let i = 0; i < nc; i++) y[i] += c[i] * Math.exp(-i / (0.007 * sr)) * S.noiseG * 2.2 * hard;
  for (let g = 0; g < S.grains; g++) { // loose-surface grains scattered through the step
    const at = Math.round(rng.uniform(0, 0.18) * sr); const gl = Math.round(0.006 * sr); const gn = hp(whiteNoise(rng, gl), 2500, 2, sr);
    for (let i = 0; i < gl; i++) y[at + i] += gn[i] * Math.exp(-i / (0.0015 * sr)) * rng.uniform(0.15, 0.5);
  }
  const toe = Math.round(rng.uniform(0.07, 0.11) * sr); // toe/forefoot touches down shortly after the heel
  const t2 = modalBank(Math.round(0.2 * sr), [{ f: S.f0 * 1.3, a: 0.45, tau: S.taus[0] * 0.8, ph: 0 }], sr);
  addInto(y, t2, toe, 1);
  return lp(y, S.lp, 2, sr);
}

// Footsteps travelling from pan_from to pan_to with level and darkness following distance. Returns stereo (binaural per step).
export function footsteps(p, { sr, rng, dur }) {
  const surface = p.surface || 'wood';
  const count = p.count ?? 8; const iv = p.interval_s ?? 0.58; const jit = p.jitter ?? 0.08;
  const total = Math.round(((p.dur_s ?? dur ?? (count * iv + 0.6))) * sr);
  const L = new Float32Array(total), R = new Float32Array(total);
  const g0 = p.gain_from_db ?? -24, g1 = p.gain_to_db ?? 0, pf = p.pan_from ?? -0.8, pt = p.pan_to ?? 0.1;
  const dist0 = p.muffle_from_hz ?? 1800, dist1 = p.muffle_to_hz ?? 12000; // far = dull, near = bright
  let t = p.lead_s ?? 0.05;
  for (let k = 0; k < count; k++) {
    const u = count > 1 ? k / (count - 1) : 1; const e = u * u * 0.4 + u * 0.6; // approach accelerates slightly in level
    const step = oneStep(surface, rng, sr, lerp(0.6, 1.2, u));
    const sm = lp(step, lerp(dist0, dist1, e), 2, sr);
    const side = (k % 2 ? 1 : -1) * 0.04;
    const pl = placeStereo(sm, clamp(lerp(pf, pt, u) + side, -1, 1), { binaural: true, sr });
    const g = dbToLin(lerp(g0, g1, e));
    const at = Math.round(t * sr);
    addInto(L, pl.L, at, g); addInto(R, pl.R, at, g);
    t += iv * (1 + jit * rng.gauss());
    if (at + step.length >= total) break;
  }
  const pk = Math.max(...[L, R].map((a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
  if (pk > 0) for (let i = 0; i < total; i++) { L[i] /= pk; R[i] /= pk; }
  return { L, R };
}

// Cloth / shoe shuffles: bandpassed noise puffs at random intervals.
export function shuffle(p, { sr, rng, dur }) {
  const total = Math.round((p.dur_s ?? dur ?? 1.5) * sr); const y = new Float32Array(total);
  const [i0, i1] = p.interval_s ?? [0.08, 0.3]; let t = 0;
  const [lo, hi] = p.band ?? [300, 2500];
  while (t < total / sr - 0.2) {
    const n = Math.round(0.2 * sr); const s = bp(whiteNoise(rng, n), lo, hi, 2, sr); const g = (1 + rng.uniform(-0.3, 0.3)) * rng.uniform(0.4, 1);
    for (let i = 0; i < n; i++) s[i] *= Math.exp(-i / sr * 28);
    addInto(y, s, Math.round(t * sr), g);
    t += rng.uniform(i0, i1);
  }
  return normalizePeak(y, 1);
}

export const KINDS = {
  creak: { fn: creak, dur_s: 2.5, gain_db: -10, layer: 'sfx', binaural: true, note: 'params: dur_s, slip_hz, f_lo, f_hi, q' },
  footsteps: { fn: footsteps, dur_s: 5, gain_db: -8, layer: 'sfx', binaural: false, stereo: true, note: 'params: surface wood|concrete|tile|gravel|grass|carpet, count, interval_s, jitter, gain_from_db, gain_to_db, pan_from, pan_to, muffle_from_hz, muffle_to_hz' },
  shuffle: { fn: shuffle, dur_s: 1.5, gain_db: -22, layer: 'sfx', binaural: true, note: 'params: dur_s, interval_s [min,max], band [lo,hi]' }
};
