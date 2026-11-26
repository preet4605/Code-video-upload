// Modal synthesis: impacts (wood / metal / door slam), struck rings, bells, slaps, thumps.
// A struck object = a handful of inharmonic damped sinusoids (mode ratio, amplitude, decay) + a short noise click for the contact.
import { SR, bp, hp, lp, whiteNoise, normalizePeak, expDecay, addInto, zeros, envAR } from '../dsp.mjs';

const MATERIALS = {
  wood:  { f0: 190, ratios: [1, 2.32, 3.87, 5.41, 7.2], amps: [1, 0.6, 0.4, 0.25, 0.15], taus: [0.11, 0.07, 0.045, 0.03, 0.02], click: [900, 4200], clickTau: 0.006, dur: 0.5 },
  metal: { f0: 420, ratios: [1, 2.76, 5.4, 8.93, 13.34], amps: [1, 0.7, 0.5, 0.3, 0.2], taus: [0.9, 0.6, 0.4, 0.25, 0.15], click: [2500, 9000], clickTau: 0.003, dur: 2.2 },
  door_slam: { f0: 68, ratios: [1, 1.9, 3.1, 4.4, 6.3, 9.1], amps: [1, 0.8, 0.55, 0.4, 0.25, 0.15], taus: [0.5, 0.32, 0.2, 0.14, 0.1, 0.06], click: [200, 2200], clickTau: 0.02, dur: 1.8 }
};
export const IMPACT_MATERIALS = Object.keys(MATERIALS);

export function modalBank(n, modes, sr = SR) {
  const y = new Float32Array(n);
  for (const m of modes) {
    const w = 2 * Math.PI * m.f / sr; const k = Math.exp(-1 / (m.tau * sr));
    let env = m.a; const ph = m.ph || 0;
    for (let i = 0; i < n && env > 1e-4; i++) { y[i] += env * Math.sin(w * i + ph); env *= k; }
  }
  return y;
}

export function impact(p, { sr, rng, dur }) {
  const mat = MATERIALS[p.material || 'wood'];
  if (!mat) throw new Error(`impact: unknown material "${p.material}"; known: ${IMPACT_MATERIALS.join(', ')}`);
  const f0 = (p.f0 ?? mat.f0) * (1 + 0.015 * rng.gauss());
  const size = p.size ?? 1;
  const n = Math.round((p.dur_s ?? dur ?? mat.dur) * sr);
  const modes = mat.ratios.map((r, i) => ({ f: f0 * r * (1 + 0.01 * rng.gauss()), a: mat.amps[i] * (p.brightness ?? 1) ** i, tau: mat.taus[i] * size, ph: rng.next() * 6.28 }));
  const y = modalBank(n, modes, sr);
  const nc = Math.round(mat.clickTau * 6 * sr);
  const click = bp(whiteNoise(rng, nc), mat.click[0], mat.click[1], 2, sr);
  for (let i = 0; i < nc; i++) y[i] += click[i] * Math.exp(-i / (mat.clickTau * sr)) * 1.4;
  if ((p.material || 'wood') === 'door_slam') {
    // body thud: low sweep + muffled noise, then a smaller rebound rattle in the latch
    const m = Math.round(0.3 * sr); let ph = 0;
    for (let i = 0; i < m; i++) { const t = i / sr; ph += 2 * Math.PI * (38 + 55 * Math.exp(-t * 18)) / sr; y[i] += Math.sin(ph) * Math.exp(-t * 12) * 1.6; }
    const nz = lp(whiteNoise(rng, Math.round(0.25 * sr)), 800, 2, sr); for (let i = 0; i < nz.length; i++) y[i] += nz[i] * Math.exp(-i / sr * 18) * 0.9;
    const rb = modalBank(Math.round(0.5 * sr), mat.ratios.slice(2).map((r, i) => ({ f: f0 * r * 1.7, a: 0.3 * mat.amps[i + 2], tau: 0.05, ph: 0 })), sr);
    addInto(y, rb, Math.round(0.11 * sr), 1);
  }
  return normalizePeak(y, 1);
}

// Generic struck ring (steel thali, bangles, glass): params f, ratios, tau, dur_s
export function ring(p, { sr, rng, dur }) {
  const f = p.f ?? 2200; const ratios = p.ratios ?? [1, 2.76, 5.4]; const amps = p.amps ?? [1, 0.5, 0.3];
  const tau = p.tau ?? 0.2; const n = Math.round((p.dur_s ?? dur ?? 1) * sr);
  const y = modalBank(n, ratios.map((r, i) => ({ f: f * r * (1 + 0.004 * rng.gauss()), a: amps[i] ?? 0.2, tau: tau / (1 + i * 0.5), ph: rng.next() * 6.28 })), sr);
  const nc = Math.round(0.004 * sr); const c = hp(whiteNoise(rng, nc), 3000, 2, sr);
  for (let i = 0; i < nc; i++) y[i] += c[i] * 0.4 * (1 - i / nc);
  return normalizePeak(y, 1);
}

// Bell / chime with beating (slight detune pairs) and a faint tremolo, ZSD recipe: partials 620/1210/1745/2310 Hz.
export function bell(p, { sr, rng, dur }) {
  const f = p.f ?? 620; const n = Math.round((p.dur_s ?? dur ?? 3) * sr);
  const parts = p.partials ?? [[1, 1.6, 1], [1.95, 2.4, 0.5], [2.81, 3.2, 0.3], [3.72, 4.5, 0.2]];
  const y = new Float32Array(n); const trem = p.tremolo_hz ?? 7;
  for (const [r, d, a] of parts) for (const det of [0, 1.7]) {
    const w = 2 * Math.PI * (f * r + det * (r > 1 ? 1 : 0.3)) / sr; const ph = rng.next() * 6.28;
    for (let i = 0; i < n; i++) y[i] += a * (det ? 0.5 : 1) * Math.sin(w * i + ph) * Math.exp(-i / sr * d / (p.sustain ?? 1));
  }
  for (let i = 0; i < n; i++) y[i] *= 1 + 0.15 * Math.sin(2 * Math.PI * trem * i / sr);
  const strike = hp(whiteNoise(rng, Math.round(0.01 * sr)), 2000, 2, sr); for (let i = 0; i < strike.length; i++) y[i] += strike[i] * 0.3 * (1 - i / strike.length);
  return normalizePeak(lp(y, p.lowpass_hz ?? 5000, 2, sr), 1);
}

// Wet slap (bare foot on wet stone): body thump + mid noise.
export function slap(p, { sr, rng }) {
  const n = Math.round((p.dur_s ?? 0.25) * sr); const y = bp(whiteNoise(rng, n), 150, 1800, 2, sr);
  for (let i = 0; i < n; i++) y[i] = y[i] * Math.exp(-i / sr * 38) + Math.sin(2 * Math.PI * (p.f ?? 110) * i / sr) * Math.exp(-i / sr * 40) * 0.7;
  return normalizePeak(y, 1);
}

// Single low thump (heart / chest / fist on a door). Has a 150-300 Hz knock layer so a phone speaker still plays it.
export function thump(p, { sr, rng }) {
  const f0 = p.f0 ?? 48; const n = Math.round((p.dur_s ?? 0.18) * sr); const y = new Float32Array(n); let ph = 0, ph2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += 2 * Math.PI * (f0 + 30 * Math.exp(-t * 30)) / sr; ph2 += 2 * Math.PI * (f0 * 3.4 + 90 * Math.exp(-t * 40)) / sr;
    y[i] = Math.sin(ph) * Math.exp(-t * 26) + (p.knock ?? 0.35) * Math.sin(ph2) * Math.exp(-t * 55);
  }
  const k = bp(whiteNoise(rng, n), 180, 420, 2, sr); for (let i = 0; i < n; i++) y[i] += k[i] * Math.exp(-i / sr * 90) * 0.5;
  return normalizePeak(y, 1);
}

export const KINDS = {
  impact: { fn: impact, dur_s: 1.2, gain_db: -6, layer: 'sfx', binaural: true, note: 'params: material wood|metal|door_slam, f0, size, brightness' },
  ring: { fn: ring, dur_s: 1.2, gain_db: -12, layer: 'sfx', binaural: true, note: 'params: f, ratios[], amps[], tau' },
  bell: { fn: bell, dur_s: 3, gain_db: -10, layer: 'sfx', binaural: true, note: 'params: f, partials, tremolo_hz, lowpass_hz' },
  slap: { fn: slap, dur_s: 0.25, gain_db: -13, layer: 'sfx', binaural: true, note: 'params: f' },
  thump: { fn: thump, dur_s: 0.18, gain_db: -14, layer: 'sfx', binaural: false, note: 'params: f0, knock' }
};
