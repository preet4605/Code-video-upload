// Cinematic building blocks: heartbeat, riser, sub drop, stinger (with reverse swell), tone/hum beds.
import { SR, bp, hp, lp, svf, whiteNoise, normalizePeak, addInto, lerp, dbToLin, clamp, envAR, smoothstep } from '../dsp.mjs';
import { thump } from './modal.mjs';

// Lub-dub with two envelopes. Each thump carries a 150-300 Hz knock so a phone speaker (no output below ~150 Hz) still plays the beat.
export function heartbeat(p, ctx) {
  const { sr, rng, dur } = ctx; const total = Math.round((p.dur_s ?? dur ?? 6) * sr); const y = new Float32Array(total);
  const b0 = p.bpm_from ?? 56, b1 = p.bpm_to ?? b0; const g0 = p.gain_from_db ?? -10, g1 = p.gain_to_db ?? 0;
  let t = p.lead_s ?? 0.02;
  while (t < total / sr - 0.3) {
    const u = clamp(t / (total / sr), 0, 1); const bpm = lerp(b0, b1, u); const g = dbToLin(lerp(g0, g1, u));
    const gap = Math.min(0.23, 0.3 * 60 / bpm);
    addInto(y, thump({ f0: 48, knock: p.knock ?? 0.55 }, ctx), Math.round(t * sr), g);
    addInto(y, thump({ f0: 40, dur_s: 0.14, knock: p.knock ?? 0.55 }, ctx), Math.round((t + gap) * sr), g * 0.63);
    t += 60 / bpm * (1 + 0.015 * rng.gauss());
  }
  return normalizePeak(y, 1);
}

// Riser: noise band sweeping up exponentially + rising tone stack. Amplitude grows u^p; ends hard or with tail_s of silence.
export function riser(p, { sr, rng, dur }) {
  const n = Math.round((p.dur_s ?? dur ?? 3) * sr); const a = p.from_hz ?? 250, b = p.to_hz ?? 9000;
  const fc = new Float32Array(n), q = new Float32Array(n); for (let i = 0; i < n; i++) { const u = i / n; fc[i] = a * Math.pow(b / a, u); q[i] = 1.2 + 4 * u; }
  const nz = svf(whiteNoise(rng, n), fc, q, 'bp', sr); const y = new Float32Array(n);
  const f0 = p.pitch_from ?? 90, f1 = p.pitch_to ?? 540, tonal = p.tonal ?? 0.5; let ph = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const u = i / n; const f = f0 * Math.pow(f1 / f0, u); let s = 0;
    for (let h = 0; h < 4; h++) { ph[h] += 2 * Math.PI * f * (h + 1) * (1 + 0.003 * h) / sr; s += Math.sin(ph[h]) / (h + 1); }
    y[i] = (nz[i] * 1.2 + tonal * 0.5 * s) * Math.pow(u, p.curve ?? 2.2);
  }
  const tail = Math.round((p.tail_s ?? 0.02) * sr); for (let i = 0; i < Math.min(tail, n); i++) y[n - 1 - i] *= i / tail;
  return normalizePeak(y, 1);
}

// Sub drop: 80->40 Hz sweep + its 2nd/3rd harmonics (so phones, which cannot reproduce 40 Hz, still hear a thud) + 150-300 Hz knock layer.
export function sub_drop(p, { sr, rng, dur }) {
  const n = Math.round((p.dur_s ?? dur ?? 2.2) * sr); const y = new Float32Array(n);
  const fa = p.from_hz ?? 80, fb = p.to_hz ?? 40, harm = p.harmonics ?? 1; let ph = 0, pk = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr; const f = fb + (fa - fb) * Math.exp(-t * 2.2); ph += 2 * Math.PI * f / sr; const env = Math.min(1, t / 0.004) * Math.exp(-t / 0.85);
    const s = Math.sin(ph) + harm * (0.5 * Math.sin(2 * ph) + 0.35 * Math.sin(3 * ph + 0.4));
    const kn = harm * 0.7 * Math.sin(2 * Math.PI * (150 + 140 * Math.exp(-t * 7)) * t) * Math.exp(-t / 0.28);
    y[i] = ((harm > 0 ? Math.tanh(1.6 * s * env) : Math.sin(ph) * env) + kn * Math.min(1, t / 0.003)) * 0.8;
  }
  const c = bp(whiteNoise(rng, Math.round(0.03 * sr)), 200, 900, 2, sr); for (let i = 0; i < c.length; i++) y[i] += c[i] * Math.exp(-i / sr * 120) * harm * 0.8;
  return normalizePeak(y, 1);
}

// Stinger: reverse swell (pre-roll, ends exactly on the hit) + dissonant cluster + noise burst + boom + sub. at = the hit.
// Returns pre_s so the renderer and the pre-scare silence QA know the cue's first audible sample is at - pre_s.
export function stinger(p, { sr, rng, dur }) {
  const big = p.big ?? 1; const post = Math.round((p.dur_s ?? dur ?? 2.8) * sr); const pre = Math.round((p.swell_s ?? 0.35) * sr);
  const y = new Float32Array(pre + post);
  if (pre > 0) { const sw = bp(whiteNoise(rng, pre), 600, 7000, 2, sr); for (let i = 0; i < pre; i++) y[i] += sw[i] * Math.pow(i / pre, 3) * 0.55; }
  const s = new Float32Array(post); const freqs = p.cluster_hz ?? [622, 659, 698, 932, 988];
  for (const f of freqs) for (let i = 0; i < post; i++) s[i] += Math.sign(Math.sin(2 * Math.PI * f * (i / sr) * (1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * i / sr))));
  const clus = bp(s, 400, 6000, 2, sr); const burst = hp(whiteNoise(rng, post), 800, 2, sr);
  const env = envAR(post, 0.006, 0.5 * big, sr);
  let ph = 0, ph2 = 0;
  for (let i = 0; i < post; i++) {
    const t = i / sr; ph += 2 * Math.PI * (60 * Math.exp(-t * 3) + 28) / sr; ph2 += 2 * Math.PI * (200 * Math.exp(-t * 6) + 160) / sr;
    const boom = Math.sin(ph) * Math.exp(-t * 2.2) * 0.9 + 0.35 * Math.sin(ph2) * Math.exp(-t * 9);
    y[pre + i] += (clus[i] * 0.12 * big + burst[i] * Math.exp(-t * 18) * 0.5 * big) * env[i] * 6 + boom * 1.4;
  }
  normalizePeak(y, 1);
  return { x: y, pre_s: pre / sr };
}

// Sum of sines with optional linear glide per partial: sub beds, pads, rising ring tones.
// params: freqs [{f, f_to?, amp, phase}], shape flat|swell_in|swell_out|hann, power, dur_s
export function hum(p, { sr, dur }) {
  const n = Math.round((p.dur_s ?? dur ?? 4) * sr); const y = new Float32Array(n);
  for (const o of p.freqs ?? [{ f: 55, amp: 1 }, { f: 58.3, amp: 0.8 }]) {
    let ph = o.phase ?? 0; const f1 = o.f_to ?? o.f;
    for (let i = 0; i < n; i++) { ph += 2 * Math.PI * lerp(o.f, f1, i / n) / sr; y[i] += (o.amp ?? 1) * Math.sin(ph); }
  }
  const sh = p.shape || 'flat', pw = p.power ?? 2.2;
  for (let i = 0; i < n; i++) { const u = i / n; y[i] *= sh === 'swell_in' ? Math.pow(u, pw) : sh === 'swell_out' ? Math.pow(1 - u, pw) : sh === 'hann' ? Math.sin(Math.PI * u) ** 2 : Math.min(1, i / (0.02 * sr), (n - i) / (0.02 * sr)); }
  return normalizePeak(y, 1);
}

export const KINDS = {
  heartbeat: { fn: heartbeat, dur_s: 6, gain_db: -6, layer: 'sfx', binaural: false, phone: true, note: 'params: dur_s, bpm_from, bpm_to, gain_from_db, gain_to_db, knock' },
  riser: { fn: riser, dur_s: 3, gain_db: -10, layer: 'sfx', binaural: false, note: 'params: dur_s 2-4, from_hz, to_hz, pitch_from, pitch_to, tonal, curve, tail_s' },
  sub_drop: { fn: sub_drop, dur_s: 2.2, gain_db: -4, layer: 'sfx', binaural: false, phone: true, note: 'params: from_hz, to_hz, harmonics 0..1 (0 = pure sub, fails the phone check)' },
  stinger: { fn: stinger, dur_s: 2.8, gain_db: -3, layer: 'sfx', binaural: false, note: 'params: big, swell_s (reverse swell before the hit), cluster_hz' },
  hum: { fn: hum, dur_s: 4, gain_db: -12, layer: 'ambience', note: 'params: freqs [{f,f_to,amp,phase}], shape flat|swell_in|swell_out|hann, power' }
};
