// Karplus-Strong plucks and water drips.
import { SR, lp, hp, whiteNoise, normalizePeak, addInto, zeros } from '../dsp.mjs';

// Karplus-Strong: delay line with a damped-averaging feedback loop. decay 0..1 (closer to 1 rings longer), bright 0..1.
export function ks(freq, n, rng, { decay = 0.996, bright = 0.5, sr = SR } = {}) {
  const N = Math.max(2, Math.round(sr / freq)); const buf = new Float32Array(N);
  for (let i = 0; i < N; i++) buf[i] = rng.gauss();
  // pre-filter the excitation: darker pluck = more smoothing
  const sm = 1 - bright; for (let k = 0; k < 3; k++) { let prev = 0; for (let i = 0; i < N; i++) { buf[i] = buf[i] * (1 - sm * 0.5) + prev * sm * 0.5; prev = buf[i]; } }
  const y = new Float32Array(n); let idx = 0, last = 0;
  for (let i = 0; i < n; i++) { const cur = buf[idx]; y[i] = cur; const nxt = decay * 0.5 * (cur + last); buf[idx] = nxt; last = cur; idx = (idx + 1) % N; }
  return y;
}

export function pluck(p, { sr, rng, dur }) {
  const n = Math.round((p.dur_s ?? dur ?? 2) * sr);
  const y = ks(p.f ?? 220, n, rng, { decay: p.decay ?? 0.997, bright: p.bright ?? 0.45, sr });
  return normalizePeak(lp(y, p.lowpass_hz ?? 6000, 2, sr), 1);
}

// Drip: bubble "plink" (rising chirp like a water bubble resonance) + sizzle hiss + a quiet KS ring in the pipe/room.
export function drip(p, { sr, rng, dur }) {
  const n = Math.round((p.dur_s ?? dur ?? 0.6) * sr); const y = new Float32Array(n);
  const f0 = p.f ?? 1500; let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr; const f = p.chirp === 'up' ? f0 * (0.7 + 0.8 * (1 - Math.exp(-t * 60))) : f0 - (f0 * 0.6) * Math.exp(-t * 40);
    ph += 2 * Math.PI * f / sr; y[i] = Math.sin(ph) * Math.exp(-t * 38) * 0.6;
  }
  const hiss = hp(whiteNoise(rng, n), 3500, 2, sr); for (let i = 0; i < n; i++) y[i] += hiss[i] * Math.exp(-i / sr * 7) * (p.sizzle ?? 0.5);
  if (p.pipe !== false) { const r = ks(f0 * (p.pipe_ratio ?? 0.5), n, rng, { decay: 0.99, bright: 0.2, sr }); for (let i = 0; i < n; i++) y[i] += r[i] * 0.08 * Math.exp(-i / sr * 5); }
  return normalizePeak(y, 1);
}

export const KINDS = {
  pluck: { fn: pluck, dur_s: 2, gain_db: -14, layer: 'sfx', binaural: false, note: 'params: f, decay, bright, lowpass_hz' },
  drip: { fn: drip, dur_s: 0.6, gain_db: -14, layer: 'sfx', binaural: true, note: 'params: f, chirp up|down, sizzle, pipe' }
};
