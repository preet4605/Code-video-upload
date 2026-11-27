// Railway coach sounds (tier A, pure synthesis): wheel clack over rail joints, low rumble + rattle, brake screech,
// failing tube-light buzz, platform murmur, paper crinkle. Deterministic: every random value comes from the cue's rng.
import { bp, hp, lp, svf, whiteNoise, pinkish, slowRandom, normalizePeak, normalizeRms, addInto, expDecay, clamp, lerp } from '../dsp.mjs';

const BED_RMS = 0.1;
const TAU = Math.PI * 2;

// One rail-joint strike: metal tick (high-passed noise) + two inharmonic modes + a body thump.
function strike(rng, sr, hard = 1) {
  const m = Math.round(0.16 * sr), y = new Float32Array(m);
  const tick = hp(whiteNoise(rng, m), 1400, 2, sr), e1 = expDecay(m, 0.006, sr), e2 = expDecay(m, 0.045, sr), e3 = expDecay(m, 0.07, sr);
  const f1 = rng.uniform(150, 190), f2 = f1 * rng.uniform(2.3, 2.6), f3 = rng.uniform(52, 70);
  for (let i = 0; i < m; i++) {
    const t = i / sr;
    y[i] = tick[i] * e1[i] * 0.55 + Math.sin(TAU * f1 * t) * e2[i] * 0.5 + Math.sin(TAU * f2 * t) * e2[i] * 0.22 + Math.sin(TAU * f3 * t) * e3[i] * 0.7;
  }
  for (let i = 0; i < m; i++) y[i] *= hard;
  return y;
}

// Wheel clack: "tadak-tadak ... tadak-tadak": each rail joint is crossed by two axles of one bogie, then the second bogie.
// params: dur_s, rate_hz (joints per second at the start), rate_to (at the end; slow it to a stop), pattern (strike offsets as a
// fraction of the joint period), jitter (0..0.2), spread (stereo spread 0..1).
export function train_clack(p, { sr, rng, dur }) {
  const D = p.dur_s ?? dur ?? 10, n = Math.round(D * sr), L = new Float32Array(n), R = new Float32Array(n);
  const r0 = p.rate_hz ?? 1.9, r1 = p.rate_to ?? r0, pat = p.pattern ?? [0, 0.1, 0.56, 0.66], jit = p.jitter ?? 0.04, spread = p.spread ?? 0.5;
  let t = rng.uniform(0, 1 / r0);
  while (t < D) {
    const rate = lerp(r0, r1, clamp(t / D, 0, 1)), period = 1 / Math.max(0.05, rate);
    pat.forEach((o, k) => {
      const at = t + o * period + rng.uniform(-jit, jit) * 0.05;
      if (at >= D) return;
      const hard = (k % 2 ? 0.8 : 1) * rng.uniform(0.75, 1.1);
      const s = strike(rng, sr, hard), pan = rng.uniform(-spread, spread) * 0.5, gl = 1 - Math.max(0, pan), gr = 1 + Math.min(0, pan);
      addInto(L, s, at * sr, gl); addInto(R, s, at * sr + 0.0003 * sr, gr);
    });
    t += period * rng.uniform(1 - jit, 1 + jit);
  }
  // a little bed of low rumble so the clack is never dry
  const bed = lp(whiteNoise(rng, n), 140, 2, sr);
  for (let i = 0; i < n; i++) { L[i] += bed[i] * 0.05; R[i] += bed[(i + 977) % n] * 0.05; }
  return { L: normalizeRms(L, BED_RMS), R: normalizeRms(R, BED_RMS) };
}

// Rumble: brown-ish low noise, two beating sub tones, a coach rattle band that wanders in level.
// params: dur_s, rattle 0..1, f_lo
export function train_rumble(p, { sr, rng, dur }) {
  const D = p.dur_s ?? dur ?? 10, n = Math.round(D * sr), out = [];
  const rattle = p.rattle ?? 0.5, f0 = p.f_lo ?? 36;
  for (let c = 0; c < 2; c++) {
    const low = lp(whiteNoise(rng, n), 95, 3, sr), mid = bp(whiteNoise(rng, n), 180, 520, 2, sr), rat = bp(whiteNoise(rng, n), 650, 2100, 2, sr);
    const g1 = slowRandom(rng, n, sr, 0.33, 4), g2 = slowRandom(rng, n, sr, 1.7, 3), y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr, bump = Math.pow(0.5 + 0.5 * Math.sin(TAU * 1.9 * t + c), 6); // joint cadence felt through the floor
      y[i] = low[i] * (0.9 + 0.8 * g1[i]) * (0.75 + 0.5 * bump) + mid[i] * 0.45 * g2[i]
        + rat[i] * rattle * 0.5 * g2[i] * g2[i] * (0.4 + 0.9 * bump)
        + (Math.sin(TAU * f0 * t) + Math.sin(TAU * (f0 * 1.034) * t + c)) * 0.6;
    }
    out.push(normalizeRms(y, BED_RMS));
  }
  return { L: out[0], R: out[1] };
}

// Brake screech: a squealing resonance sliding down with a stick-slip shudder, then a hiss of steam and a long fall-off.
// params: dur_s, from_hz, to_hz, shudder_hz
export function brake_screech(p, { sr, rng, dur }) {
  const D = p.dur_s ?? dur ?? 3.2, n = Math.round(D * sr), out = [];
  const f0 = p.from_hz ?? 2650, f1 = p.to_hz ?? 1350, sh = p.shudder_hz ?? 11;
  for (let c = 0; c < 2; c++) {
    const y = new Float32Array(n), wob = slowRandom(rng, n, sr, 3.1, 4), am = slowRandom(rng, n, sr, 7, 3);
    const hiss = bp(whiteNoise(rng, n), 2200, 7800, 2, sr), rub = bp(whiteNoise(rng, n), 600, 1800, 2, sr);
    let ph1 = rng.next() * TAU, ph2 = rng.next() * TAU, ph3 = rng.next() * TAU;
    for (let i = 0; i < n; i++) {
      const u = i / n, t = i / sr, f = lerp(f0, f1, Math.pow(u, 0.7)) * (1 + 0.025 * (wob[i] - 0.5) + (c ? 0.004 : 0));
      ph1 += TAU * f / sr; ph2 += TAU * f * 1.51 / sr; ph3 += TAU * f * 2.03 / sr;
      const env = Math.min(1, u / 0.06) * Math.pow(1 - u, 0.9), stick = 0.55 + 0.45 * Math.pow(0.5 + 0.5 * Math.sin(TAU * sh * t + c), 2);
      y[i] = env * stick * ((Math.sin(ph1) + 0.55 * Math.sin(ph2) + 0.3 * Math.sin(ph3)) * (0.5 + 0.6 * am[i]) * 0.5 + hiss[i] * 0.22 + rub[i] * 0.3);
    }
    out.push(normalizePeak(y, 0.95));
  }
  return { L: out[0], R: out[1] };
}

// Tube-light buzz: 100 Hz ballast hum with odd harmonics and an ignition tick on every re-strike. A flicker is [start_s, len_s];
// `flicks` is given in seconds from the cue start (the scene's flicker times are the same list).
export function tube_buzz(p, { sr, rng, dur }) {
  const D = p.dur_s ?? dur ?? 3, n = Math.round(D * sr), y = new Float32Array(n);
  const flicks = p.flicks ?? [[0.1, 0.25], [0.7, 0.12], [1.1, 0.5]], hum = p.hum_hz ?? 100;
  const gate = new Float32Array(n).fill(p.base ?? 0.25);
  for (const [s, l] of flicks) for (let i = Math.round(s * sr); i < Math.min(n, Math.round((s + l) * sr)); i++) { const k = (i / sr - s) * 38; gate[i] = Math.abs(Math.sin(k)) > 0.45 ? 1 : 0.05; }
  const buzz = bp(whiteNoise(rng, n), 2500, 6000, 2, sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr, h = Math.sin(TAU * hum * t) + 0.5 * Math.sin(TAU * hum * 2 * t + 0.4) + 0.35 * Math.sin(TAU * hum * 3 * t + 1) + 0.2 * Math.sin(TAU * hum * 5 * t);
    y[i] = (h * 0.5 + buzz[i] * 0.6 * (0.5 + 0.5 * Math.abs(Math.sin(TAU * hum * t)))) * gate[i];
  }
  for (const [s] of flicks) { const m = Math.round(0.03 * sr), tk = hp(whiteNoise(rng, m), 1800, 2, sr), e = expDecay(m, 0.006, sr); for (let i = 0; i < m; i++) tk[i] *= e[i] * 1.4; addInto(y, tk, s * sr, 1); }
  const d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = y[i];
  return normalizePeak(d, 0.9);
}

// Platform murmur: several distant voices (formant-filtered pink noise gated into phrases) and the odd clang. params: dur_s, voices
export function station_murmur(p, { sr, rng, dur }) {
  const D = p.dur_s ?? dur ?? 6, n = Math.round(D * sr), V = p.voices ?? 6, out = [new Float32Array(n), new Float32Array(n)];
  for (let v = 0; v < V; v++) {
    const f1 = rng.uniform(380, 720), f2 = rng.uniform(1100, 2000), base = pinkish(rng, n), a = bp(base, f1 * 0.8, f1 * 1.25, 2, sr), b = bp(base, f2 * 0.8, f2 * 1.25, 2, sr);
    const phr = slowRandom(rng, n, sr, rng.uniform(0.15, 0.35), 3), syl = rng.uniform(3.2, 5.4), ph = rng.next() * TAU, pan = rng.uniform(-0.9, 0.9), gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < n; i++) {
      const talk = clamp((phr[i] - 0.42) * 4, 0, 1), s = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(TAU * syl * i / sr + ph + 2 * phr[i]), 1.5), x = (a[i] + 0.5 * b[i]) * talk * s;
      out[0][i] += x * gl; out[1][i] += x * gr;
    }
  }
  return { L: normalizeRms(out[0], BED_RMS), R: normalizeRms(out[1], BED_RMS) };
}

// Paper crinkle: dense, decaying micro-clicks with random band centres. params: dur_s, density
export function paper_crinkle(p, { sr, rng, dur }) {
  const D = p.dur_s ?? dur ?? 0.9, n = Math.round(D * sr), y = new Float32Array(n), dens = p.density ?? 1;
  const nc = Math.round(70 * D * dens);
  for (let k = 0; k < nc; k++) {
    const u = Math.pow(rng.next(), 1.4), at = Math.floor(u * (n - 600)), m = Math.round(rng.uniform(0.002, 0.012) * sr), c = lp(hp(whiteNoise(rng, m), rng.uniform(1800, 4500), 2, sr), rng.uniform(7000, 10000), 2, sr), e = expDecay(m, m / sr / 3, sr);
    const amp = rng.uniform(0.2, 1) * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, at / n))) * (rng.next() < 0.12 ? 2.2 : 1);
    for (let i = 0; i < m; i++) y[at + i] += c[i] * e[i] * amp;
  }
  const soft = lp(whiteNoise(rng, n), 900, 2, sr), env = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = i / n; env[i] = Math.sin(Math.PI * Math.min(1, u * 1.1)) ** 2; y[i] += soft[i] * 0.012 * env[i]; }
  return normalizePeak(y, 0.9);
}

export const KINDS = {
  train_clack: { fn: train_clack, dur_s: 10, gain_db: -10, layer: 'ambience', bed: true, stereo: true, note: 'params: dur_s, rate_hz, rate_to, pattern [fractions], jitter, spread' },
  train_rumble: { fn: train_rumble, dur_s: 10, gain_db: -10, layer: 'ambience', bed: true, stereo: true, note: 'params: dur_s, rattle 0..1, f_lo' },
  brake_screech: { fn: brake_screech, dur_s: 3.2, gain_db: -8, layer: 'sfx', stereo: true, note: 'params: dur_s, from_hz, to_hz, shudder_hz' },
  tube_buzz: { fn: tube_buzz, dur_s: 3, gain_db: -14, layer: 'sfx', binaural: false, note: 'params: dur_s, flicks [[start_s,len_s]], hum_hz, base' },
  station_murmur: { fn: station_murmur, dur_s: 6, gain_db: -12, layer: 'ambience', bed: true, stereo: true, note: 'params: dur_s, voices' },
  paper_crinkle: { fn: paper_crinkle, dur_s: 0.9, gain_db: -10, layer: 'sfx', binaural: true, note: 'params: dur_s, density' },
};
