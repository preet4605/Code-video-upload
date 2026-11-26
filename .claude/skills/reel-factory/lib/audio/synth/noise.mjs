// Noise-based beds and swells: wind, rain, room tone, whoosh, noise swell, crackle, breath, cicadas.
import { SR, bp, hp, lp, svf, whiteNoise, pinkish, slowRandom, normalizePeak, normalizeRms, addInto, clamp, dbToLin, lerp } from '../dsp.mjs';
import { placeMoving } from '../space.mjs';

const BED_RMS = 0.1; // beds are normalised to about -20 dBFS RMS; cue gain_db is relative to that

// Gusting wind: pink-ish noise through a bandpass whose centre and level follow a slow gust signal, plus a faint whistle.
export function wind(p, { sr, rng, dur }) {
  const n = Math.round((p.dur_s ?? dur ?? 10) * sr); const out = [];
  const gust = slowRandom(rng, n, sr, p.gust_hz ?? 0.12, 4);
  for (let c = 0; c < 2; c++) {
    const g = new Float32Array(n), fc = new Float32Array(n);
    for (let i = 0; i < n; i++) { g[i] = Math.pow(gust[i], p.gust_shape ?? 1.6); fc[i] = (p.f_lo ?? 160) + ((p.f_hi ?? 900) - (p.f_lo ?? 160)) * g[i]; }
    const y = svf(pinkish(rng, n), fc, 1.4, 'bp', sr); const wh = svf(whiteNoise(rng, n), fc.map((v) => v * 2.7), 22, 'bp', sr);
    for (let i = 0; i < n; i++) y[i] = (y[i] * (0.25 + g[i]) + wh[i] * 0.05 * g[i] * g[i]);
    out.push(normalizeRms(y, BED_RMS));
  }
  return { L: out[0], R: out[1] };
}

export function rain(p, { sr, rng, dur }) {
  const n = Math.round((p.dur_s ?? dur ?? 10) * sr); const out = []; const dens = p.intensity ?? 0.6;
  for (let c = 0; c < 2; c++) {
    const hiss = bp(whiteNoise(rng, n), 1800, 9500, 2, sr);
    const am = slowRandom(rng, n, sr, 3, 3); const y = new Float32Array(n);
    for (let i = 0; i < n; i++) y[i] = hiss[i] * (0.7 + 0.3 * am[i]);
    const drops = Math.round(n / sr * 180 * dens);
    for (let d = 0; d < drops; d++) { const at = Math.floor(rng.next() * (n - 400)); const a = rng.uniform(0.3, 1) * 3; const f = rng.uniform(2500, 7000); for (let i = 0; i < 300; i++) y[at + i] += Math.sin(2 * Math.PI * f * i / sr) * Math.exp(-i / 40) * a * 0.04; }
    const rum = lp(whiteNoise(rng, n), 220, 2, sr); for (let i = 0; i < n; i++) y[i] += rum[i] * 0.25;
    out.push(normalizeRms(y, BED_RMS));
  }
  return { L: out[0], R: out[1] };
}

// Room tone: never digital silence. Dark noise + faint mains hum + a very slow breathing of the level.
export function room_tone(p, { sr, rng, dur }) {
  const n = Math.round((p.dur_s ?? dur ?? 10) * sr); const out = [];
  for (let c = 0; c < 2; c++) {
    const y = lp(whiteNoise(rng, n), p.lowpass_hz ?? 700, 2, sr); const m = slowRandom(rng, n, sr, 0.05, 2);
    const hz = p.hum_hz ?? 50;
    for (let i = 0; i < n; i++) y[i] = y[i] * (0.85 + 0.3 * m[i]) + 0.12 * Math.sin(2 * Math.PI * hz * i / sr) + 0.05 * Math.sin(2 * Math.PI * hz * 2 * i / sr + 1);
    out.push(normalizeRms(y, BED_RMS));
  }
  return { L: out[0], R: out[1] };
}

// Generic shaped noise swell: swoosh, chalk scrape, gust, reversed swell, hiss. shape: hann | rise | fall | rise_cubic
export function noise_swell(p, { sr, rng, dur }) {
  const n = Math.round((p.dur_s ?? dur ?? 1.2) * sr);
  let y = p.dark ? lp(whiteNoise(rng, n), p.hi ?? 400, p.order ?? 2, sr) : bp(whiteNoise(rng, n), p.lo ?? 300, p.hi ?? 3000, p.order ?? 2, sr);
  const sh = p.shape || 'hann';
  for (let i = 0; i < n; i++) { const u = i / n; y[i] *= sh === 'rise' ? u * u : sh === 'rise_cubic' ? u ** 3 : sh === 'fall' ? (1 - u) ** 2 : Math.sin(Math.PI * u) ** 2; }
  return normalizePeak(y, 1);
}

export function whoosh(p, { sr, rng, dur }) {
  const n = Math.round((p.dur_s ?? dur ?? 0.7) * sr);
  const fc = new Float32Array(n); const a = p.from_hz ?? 500, b = p.to_hz ?? 3500;
  for (let i = 0; i < n; i++) fc[i] = a * Math.pow(b / a, i / n);
  const y = svf(whiteNoise(rng, n), fc, 1.8, 'bp', sr);
  for (let i = 0; i < n; i++) y[i] *= Math.exp(-Math.pow((i / n - (p.peak ?? 0.45)) / 0.22, 2));
  normalizePeak(y, 1);
  return placeMoving(y, p.pan_from ?? -0.8, p.pan_to ?? 0.8);
}

// Poisson clicks (embers, crackle, ticks), randomly panned. rate_hz clicks per second.
export function crackle(p, { sr, rng, dur }) {
  const n = Math.round((p.dur_s ?? dur ?? 5) * sr); const L = new Float32Array(n), R = new Float32Array(n);
  let t = 0; const [pl, pr] = p.pan_range ?? [-0.8, 0.8];
  while (t < n / sr - 0.05) {
    const f = rng.uniform(1800, 4200); const m = Math.round(0.02 * sr); const c = hp(whiteNoise(rng, m), 1500, 2, sr); const s = new Float32Array(m);
    for (let i = 0; i < m; i++) s[i] = c[i] * Math.exp(-i / sr * 260) + Math.sin(2 * Math.PI * f * i / sr) * Math.exp(-i / sr * 300) * 0.25;
    const g = dbToLin(rng.uniform(-9, 4)); const pan = rng.uniform(pl, pr); const gl = Math.SQRT2 * Math.cos((pan + 1) * Math.PI / 4), gr = Math.SQRT2 * Math.sin((pan + 1) * Math.PI / 4);
    addInto(L, s, Math.round(t * sr), g * gl); addInto(R, s, Math.round(t * sr), g * gr);
    t += rng.exp(1 / (p.rate_hz ?? 3));
  }
  let pk = 1e-9; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); for (let i = 0; i < n; i++) { L[i] /= pk; R[i] /= pk; }
  return { L, R };
}

// Breathing: filtered-noise inhale/exhale cycles with a throat-formant bandpass; trembling (shaky) optional.
export function breath(p, { sr, rng, dur }) {
  const n = Math.round((p.dur_s ?? dur ?? 6) * sr); const y = new Float32Array(n);
  const per = 60 / (p.rate_bpm ?? 14); const f1 = p.formant_hz ?? 900;
  const raw = whiteNoise(rng, n); const a = svf(raw, f1, 2.2, 'bp', sr), b = svf(raw, f1 * 2.3, 3, 'bp', sr);
  const tr = p.shaky ?? 0.0;
  for (let i = 0; i < n; i++) {
    const ph = (i / sr % per) / per; // 0..1 within a breath
    const inh = ph < 0.38 ? Math.sin(Math.PI * ph / 0.38) ** 1.5 * 0.6 : 0;
    const exh = ph > 0.5 && ph < 0.95 ? Math.sin(Math.PI * (ph - 0.5) / 0.45) ** 2 : 0;
    const shake = 1 + tr * Math.sin(2 * Math.PI * 9 * i / sr);
    y[i] = (a[i] + 0.5 * b[i]) * (inh + exh) * shake;
  }
  return normalizePeak(lp(y, 5000, 2, sr), 1);
}

// Cicada bed (ZSD recipe): 3.2-7.8 kHz noise gated by a ~78 Hz pulse train that drifts, with slow swells. Stereo = two cicadas.
export function cicadas(p, { sr, rng, dur }) {
  const n = Math.round((p.dur_s ?? dur ?? 10) * sr); const out = [];
  for (let c = 0; c < 2; c++) {
    const nz = bp(whiteNoise(rng, n), 3200, 7800, 3, sr); const pulse = new Float32Array(n); let ph = rng.next() * 6.28;
    const base = (p.pulse_hz ?? 78) * (c ? 1.07 : 1); const ph0 = rng.next() * 6.28;
    for (let i = 0; i < n; i++) { const t = i / sr; ph += 2 * Math.PI * (base + 12 * Math.sin(2 * Math.PI * 0.07 * t + ph0)) / sr; pulse[i] = 0.5 + 0.5 * Math.sign(Math.sin(ph)); }
    const pl = lp(pulse, 400, 1, sr); const y = new Float32Array(n); const s1 = rng.next() * 6.28, s2 = rng.next() * 6.28;
    for (let i = 0; i < n; i++) { const t = i / sr; y[i] = nz[i] * pl[i] * (0.62 + 0.38 * Math.sin(2 * Math.PI * 0.13 * t + s1) * Math.sin(2 * Math.PI * 0.047 * t + s2)); }
    out.push(normalizeRms(y, BED_RMS * (c ? 0.65 : 1)));
  }
  return { L: out[0], R: out[1] };
}

export const KINDS = {
  wind: { fn: wind, dur_s: 10, gain_db: -8, layer: 'ambience', bed: true, stereo: true, note: 'params: gust_hz, gust_shape, f_lo, f_hi' },
  rain: { fn: rain, dur_s: 10, gain_db: -8, layer: 'ambience', bed: true, stereo: true, note: 'params: intensity 0..1' },
  room_tone: { fn: room_tone, dur_s: 10, gain_db: -14, layer: 'room', bed: true, stereo: true, note: 'params: lowpass_hz, hum_hz' },
  noise_swell: { fn: noise_swell, dur_s: 1.2, gain_db: -12, layer: 'sfx', binaural: true, note: 'params: lo, hi, dark, shape hann|rise|rise_cubic|fall, order' },
  whoosh: { fn: whoosh, dur_s: 0.7, gain_db: -8, layer: 'sfx', stereo: true, note: 'params: from_hz, to_hz, pan_from, pan_to, peak' },
  crackle: { fn: crackle, dur_s: 5, gain_db: -26, layer: 'ambience', bed: true, stereo: true, note: 'params: rate_hz, pan_range' },
  breath: { fn: breath, dur_s: 6, gain_db: -14, layer: 'sfx', binaural: true, note: 'params: rate_bpm, formant_hz, shaky' },
  cicadas: { fn: cicadas, dur_s: 10, gain_db: -10, layer: 'ambience', bed: true, stereo: true, note: 'params: pulse_hz' }
};
