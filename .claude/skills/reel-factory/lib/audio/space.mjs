// Space: equal-power + binaural-ish panning (ITD <= 0.6 ms, ILD, head-shadow lowpass) and synthetic convolution reverb.
import { SR, dbToLin, clamp, lp, applyBiquad, biquadCoefs, whiteNoise, hp, convolveFFT, delayFrac } from './dsp.mjs';
import { makeRng } from './rng.mjs';

export const MAX_ITD_S = 0.0006;

// pan: -1 hard left .. +1 hard right. Centre is unity gain in both channels (matches the ZSD recipe).
export function panGains(pan) {
  const p = clamp(pan, -1, 1); const a = (p + 1) * Math.PI / 4;
  return [Math.SQRT2 * Math.cos(a), Math.SQRT2 * Math.sin(a)];
}

// Static placement of a mono signal. binaural adds the cues of a head: far ear is delayed (<= 0.6 ms), 3 dB quieter and darker.
// Use it for point SFX only. ITD on VO/beds would comb when folded to mono.
export function placeStereo(x, pan = 0, { binaural = false, sr = SR } = {}) {
  const [gl, gr] = panGains(pan);
  const n = x.length;
  let L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = x[i] * gl; R[i] = x[i] * gr; }
  if (!binaural || Math.abs(pan) < 0.02) return { L, R };
  const a = Math.abs(clamp(pan, -1, 1));
  const delay = a * (MAX_ITD_S - 0.00015) * sr; // the head-shadow lowpass adds ~0.15 ms of group delay: total stays <= 0.6 ms
  const ild = dbToLin(-3 * a);
  const fc = 20000 * Math.pow(3200 / 20000, a); // head shadow: 20 kHz -> 3.2 kHz as the source moves to the side
  const shadow = (s) => { const f = applyBiquad(s, biquadCoefs('lp', Math.min(fc, sr * 0.45), 0.6, sr)); const o = delayFrac(f, delay); for (let i = 0; i < o.length; i++) o[i] *= ild; return o; };
  const trim = (s) => s.subarray(0, n);
  if (pan > 0) L = trim(shadow(L)); else R = trim(shadow(R));
  const fix = (s) => (s.length === n ? s : s.slice(0, n));
  return { L: fix(L), R: fix(R) };
}

// Moving source (whoosh, passer-by): per-sample pan from -> to, no ITD.
export function placeMoving(x, panFrom, panTo) {
  const n = x.length; const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { const [gl, gr] = panGains(panFrom + (panTo - panFrom) * (i / Math.max(1, n - 1))); L[i] = x[i] * gl; R[i] = x[i] * gr; }
  return { L, R };
}

export const REVERB_PRESETS = {
  room: { rt60: 0.55, predelay: 0.006, early: [[0.011, 0.7], [0.017, 0.55], [0.023, 0.5], [0.031, 0.4], [0.042, 0.3], [0.055, 0.25]], hiDecay: 0.55, loDecay: 1.1, damp: 7000 },
  hall: { rt60: 2.3, predelay: 0.024, early: [[0.021, 0.6], [0.034, 0.5], [0.049, 0.45], [0.067, 0.4], [0.083, 0.3], [0.109, 0.25], [0.131, 0.2]], hiDecay: 0.5, loDecay: 1.2, damp: 5500 },
  corridor: { rt60: 1.5, predelay: 0.004, early: [], flutter: { every: 0.034, count: 9, decay: 0.68 }, hiDecay: 0.45, loDecay: 1.15, damp: 4500 },
  outdoor: { rt60: 0.45, predelay: 0.012, early: [[0.19, 0.35], [0.31, 0.2]], hiDecay: 0.35, loDecay: 0.9, damp: 3500 }
};
const irCache = new Map();

export function makeIR(preset, { sr = SR, seed = 4242 } = {}) {
  const key = `${preset}|${sr}|${seed}`;
  if (irCache.has(key)) return irCache.get(key);
  const P = REVERB_PRESETS[preset];
  if (!P) throw new Error(`unknown reverb preset "${preset}"; known: ${Object.keys(REVERB_PRESETS).join(', ')}`);
  const len = Math.round((P.predelay + P.rt60 * 1.15 + 0.3) * sr);
  const chans = [0, 1].map((c) => {
    const rng = makeRng(seed + c * 7919 + P.rt60 * 1000);
    const ir = new Float32Array(len);
    const nz = whiteNoise(rng, len);
    const low = lp(nz, 1400, 2, sr), high = hp(nz, 1400, 2, sr);
    const t0 = Math.round(P.predelay * sr);
    for (let i = t0; i < len; i++) {
      const t = (i - t0) / sr;
      const ramp = Math.min(1, t / 0.025); // density builds up over 25 ms
      const dl = Math.exp(-6.908 * t / (P.rt60 * P.loDecay)), dh = Math.exp(-6.908 * t / (P.rt60 * P.hiDecay));
      ir[i] = (low[i] * dl * 1.3 + high[i] * dh * 0.55) * ramp;
    }
    const damp = lp(ir, P.damp, 2, sr);
    const taps = [...P.early];
    if (P.flutter) for (let k = 1; k <= P.flutter.count; k++) taps.push([P.flutter.every * k * (c ? 1.07 : 1), Math.pow(P.flutter.decay, k)]);
    for (const [d, a] of taps) { const j = Math.round((P.predelay + d * (1 + 0.08 * (rng.next() - 0.5))) * sr); if (j < len) damp[j] += a * (c ? -1 : 1) * (0.8 + 0.4 * rng.next()) * 4; }
    return damp;
  });
  let e = 0; for (const ch of chans) for (let i = 0; i < ch.length; i++) e += ch[i] * ch[i];
  const g = 1 / Math.sqrt(e / 2);
  for (const ch of chans) for (let i = 0; i < ch.length; i++) ch[i] *= g;
  const res = { L: chans[0], R: chans[1], preset };
  irCache.set(key, res);
  return res;
}

// Convolve a (mono or stereo) send with the preset IR. Output is trimmed to the send length + tail (caller trims to the timeline).
export function reverbSend(sendL, sendR, preset, { sr = SR, seed = 4242 } = {}) {
  const ir = makeIR(preset, { sr, seed });
  return { L: convolveFFT(sendL, ir.L), R: convolveFFT(sendR, ir.R) };
}
