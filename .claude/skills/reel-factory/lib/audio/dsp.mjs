// Small DSP toolbox on Float32Array. Own code (RBJ cookbook biquads, radix-2 FFT, Chamberlin SVF); no dependencies.
export const SR = 48000;
export const dbToLin = (db) => Math.pow(10, db / 20);
export const linToDb = (x) => 20 * Math.log10(Math.max(1e-12, x));
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smoothstep = (a, b, x) => { const k = clamp((x - a) / (b - a || 1e-9), 0, 1); return k * k * (3 - 2 * k); };
export const lerp = (a, b, k) => a + (b - a) * k;
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const zeros = (n) => new Float32Array(Math.max(0, Math.round(n)));

// ---- biquads ----
export function biquadCoefs(type, f, q = 0.7071, sr = SR, gainDb = 0) {
  const fc = clamp(f, 10, sr * 0.49);
  const w = 2 * Math.PI * fc / sr, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; } // constant 0 dB peak
  else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }
  else if (type === 'lowshelf') { const s = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) - (A - 1) * cw + s); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - s); a0 = (A + 1) + (A - 1) * cw + s; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - s; }
  else throw new Error(`biquad: unknown type ${type}`);
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
export function applyBiquad(x, c) {
  const y = new Float32Array(x.length);
  let z1 = 0, z2 = 0;
  const [b0, b1, b2, a1, a2] = c;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const o = b0 * v + z1;
    z1 = b1 * v - a1 * o + z2;
    z2 = b2 * v - a2 * o;
    y[i] = o;
  }
  return y;
}
// Butterworth-ish cascade: order 2 (one stage) or 4 (two stages, Q 0.54 / 1.31).
function cascade(type, x, f, order, sr) {
  const qs = order >= 4 ? [0.5412, 1.3066] : [0.7071];
  let y = x;
  for (const q of qs) y = applyBiquad(y, biquadCoefs(type, f, q, sr));
  return y;
}
export const lp = (x, f, order = 2, sr = SR) => cascade('lp', x, f, order, sr);
export const hp = (x, f, order = 2, sr = SR) => cascade('hp', x, f, order, sr);
export function bp(x, lo, hi, order = 2, sr = SR) { return lp(hp(x, lo, order, sr), hi, order, sr); }
export const resonator = (x, f, q, sr = SR) => applyBiquad(x, biquadCoefs('bp', f, q, sr));

// State-variable filter with per-sample cutoff (Float32Array or number) and Q. mode: 'bp' | 'lp' | 'hp'.
export function svf(x, fc, q = 2, mode = 'bp', sr = SR) {
  const y = new Float32Array(x.length);
  let lo = 0, bd = 0;
  const fa = typeof fc === 'number' ? null : fc;
  const qa = typeof q === 'number' ? null : q;
  for (let i = 0; i < x.length; i++) {
    const f = 2 * Math.sin(Math.PI * Math.min(0.2, (fa ? fa[i] : fc) / sr));
    const d = 1 / (qa ? qa[i] : q);
    lo += f * bd;
    const hi = x[i] - lo - d * bd;
    bd += f * hi;
    y[i] = mode === 'lp' ? lo : mode === 'hp' ? hi : bd * d; // bp scaled ~unity at resonance
  }
  return y;
}

// ---- generators / envelopes ----
export function whiteNoise(rng, n) { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = rng.gauss(); return o; }
export function pinkish(rng, n) { // Paul Kellet economy filter
  const o = new Float32Array(n); let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) { const w = rng.gauss(); b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; o[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25; }
  return o;
}
// Slow random control signal 0..1: sum of a few sines with random rates/phases (deterministic, band-limited).
export function slowRandom(rng, n, sr, rateHz = 0.2, partials = 3) {
  const o = new Float32Array(n);
  const ps = Array.from({ length: partials }, (_, k) => ({ f: rateHz * (0.5 + rng.next() * 1.5) * (1 + k * 0.7), p: rng.next() * 6.283, a: 1 / (1 + k * 0.6) }));
  const tot = ps.reduce((s, p) => s + p.a, 0);
  for (let i = 0; i < n; i++) { let v = 0; const t = i / sr; for (const p of ps) v += p.a * Math.sin(6.2831853 * p.f * t + p.p); o[i] = 0.5 + 0.5 * v / tot; }
  return o;
}
export function envAR(n, a, r, sr = SR) { // linear attack, exponential release (time constant r)
  const e = new Float32Array(n); const na = Math.max(1, Math.round(a * sr));
  for (let i = 0; i < n; i++) e[i] = i < na ? i / na : Math.exp(-(i - na) / (r * sr));
  return e;
}
export function expDecay(n, tau, sr = SR) { const e = new Float32Array(n); for (let i = 0; i < n; i++) e[i] = Math.exp(-i / (tau * sr)); return e; }
export function hann(n) { const e = new Float32Array(n); for (let i = 0; i < n; i++) e[i] = Math.pow(Math.sin(Math.PI * (i + 0.5) / n), 2); return e; }
export function mulInPlace(x, e) { const n = Math.min(x.length, e.length); for (let i = 0; i < n; i++) x[i] *= e[i]; return x; }
export function scaleInPlace(x, g) { for (let i = 0; i < x.length; i++) x[i] *= g; return x; }
export function peakOf(x) { let p = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > p) p = a; } return p; }
export function rmsOf(x, a = 0, b = x.length) { let s = 0; const n = Math.max(1, b - a); for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / n); }
export function normalizePeak(x, target = 1) { const p = peakOf(x); if (p > 0) scaleInPlace(x, target / p); return x; }
export function normalizeRms(x, targetRms) { const r = rmsOf(x); if (r > 0) scaleInPlace(x, targetRms / r); return x; }
export function addInto(dst, src, at = 0, gain = 1) {
  const i0 = Math.round(at);
  for (let i = Math.max(0, -i0); i < src.length && i0 + i < dst.length; i++) dst[i0 + i] += src[i] * gain;
  return dst;
}
// Fractional delay (linear interpolation).
export function delayFrac(x, d) {
  const n = x.length + Math.ceil(d) + 1; const y = new Float32Array(n); const di = Math.floor(d); const fr = d - di;
  for (let i = 0; i < x.length; i++) { y[i + di] += x[i] * (1 - fr); y[i + di + 1] += x[i] * fr; }
  return y;
}
export function resampleLinear(x, srIn, srOut) {
  if (srIn === srOut) return x;
  const n = Math.round(x.length * srOut / srIn); const y = new Float32Array(n); const r = srIn / srOut;
  for (let i = 0; i < n; i++) { const p = i * r; const k = Math.floor(p); const f = p - k; y[i] = (x[k] ?? 0) * (1 - f) + (x[k + 1] ?? x[k] ?? 0) * f; }
  return y;
}

// ---- FFT (in-place radix-2, Float64Array re/im) and block convolution ----
export function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = 2 * Math.PI / len * (inverse ? 1 : -1); const wr = Math.cos(ang), wi = Math.sin(ang); const h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const a = i + k, b = a + h; const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
const nextPow2 = (n) => { let p = 1; while (p < n) p <<= 1; return p; };
// Uniform-block overlap-add FFT convolution; silent input blocks are skipped (reverb sends are sparse).
export function convolveFFT(x, ir, block = 16384) {
  const out = new Float32Array(x.length + ir.length - 1);
  const size = nextPow2(block + ir.length - 1);
  const hr = new Float64Array(size), hi = new Float64Array(size);
  for (let i = 0; i < ir.length; i++) hr[i] = ir[i];
  fft(hr, hi);
  const ar = new Float64Array(size), ai = new Float64Array(size);
  for (let s = 0; s < x.length; s += block) {
    const e = Math.min(x.length, s + block);
    let any = false; ar.fill(0); ai.fill(0);
    for (let i = s; i < e; i++) { const v = x[i]; if (v !== 0) any = true; ar[i - s] = v; }
    if (!any) continue;
    fft(ar, ai);
    for (let k = 0; k < size; k++) { const r = ar[k] * hr[k] - ai[k] * hi[k]; ai[k] = ar[k] * hi[k] + ai[k] * hr[k]; ar[k] = r; }
    fft(ar, ai, true);
    const m = Math.min(size, out.length - s);
    for (let i = 0; i < m; i++) out[s + i] += ar[i];
  }
  return out;
}

// Piecewise gain envelope from [{t, g}] breakpoints (linear amplitude, smoothstep between), sampled for n samples starting at t0.
export function curveEnv(points, n, sr, t0) {
  const e = new Float32Array(n);
  const p = [...points].sort((a, b) => a.t - b.t);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + i / sr;
    while (k < p.length - 1 && t >= p[k + 1].t) k++;
    if (t <= p[0].t) e[i] = p[0].g;
    else if (k >= p.length - 1) e[i] = p[p.length - 1].g;
    else e[i] = lerp(p[k].g, p[k + 1].g, smoothstep(p[k].t, p[k + 1].t, t));
  }
  return e;
}
