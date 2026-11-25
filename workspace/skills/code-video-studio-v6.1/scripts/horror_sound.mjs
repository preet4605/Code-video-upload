#!/usr/bin/env node
// Designed horror sound bed, synthesised from timeline.json (no samples, no network, deterministic).
// Layers: room tone, place ambience, dread drone (rises over the reel), sub swells before key beats,
// heartbeat curve (speeds up toward each scare, STOPS on the drop), foley from cues (footsteps/slippers,
// door creak/knock, thud, breath, whisper gust), a true pre-scare drop (-45 dB), stingers on [SCARE] cues,
// room-tone-only [SILENCE] beats and a rising loop tail into the hook.
// Usage: node scripts/horror_sound.mjs --project <dir> [--out <wav>] [--json]
// Then master with: --bgm horror (generated automatically) [--bgm-gain -8]
// HONEST LIMIT: synthesis is controllable and measurable, not realistic. Listen; swap in licensed foley
// (log it in assets.json) for any layer that sounds fake.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SR = 48000;
export const DROP_DB = -45; // pre-scare level relative to the bed
export const DROP_LEAD_S = 0.6; // drop starts this long before the scare hits
const TAU = Math.PI * 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const dbToLin = (db) => Math.pow(10, db / 20);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

// Canonical foley kinds for cue names.
const FOLEY = {
  footsteps: 'steps', footsteps_walk: 'steps', footsteps_run: 'steps_fast', slippers: 'steps', steps: 'steps',
  door_creak: 'creak', creak: 'creak', door: 'creak', door_knock: 'knock', knock: 'knock',
  thud: 'thud', impact: 'thud', boom_hit: 'thud', hit: 'thud',
  breath: 'breath', breathing: 'breath', whisper_gust: 'gust', whisper: 'gust', wind: 'gust',
  heartbeat: 'heartbeat_hit', violin_stinger: 'stinger', stinger: 'stinger', scream: 'stinger', claw_scrape: 'scrape',
  fan_hum: 'ambience_fan', temple_bell: 'bell', distant_thunder: 'thunder', riser: 'riser'
};

export function planBed(timeline, brief = {}) {
  const D = Number(timeline.duration_s) || 30;
  const cues = timeline.audio_cues || [];
  const scares = cues.filter((c) => c.type === 'sfx' && c.scare).map((c) => c.t_s).sort((a, b) => a - b);
  const silences = (timeline.silences || cues.filter((c) => c.type === 'silence').map((c) => ({ start_s: c.t_s, end_s: c.t_s + (c.dur_s || 1) })));
  const foley = [];
  const unmapped = [];
  for (const c of cues) {
    if (c.type !== 'sfx') continue;
    const kind = c.scare ? 'stinger' : FOLEY[c.name];
    if (!kind) { unmapped.push(c.name); foley.push({ kind: 'thud', t: c.t_s, name: c.name }); continue; }
    foley.push({ kind, t: c.t_s, name: c.name });
  }
  const amb = brief?.sound?.ambience || brief?.story?.ambience || [];
  const ambience = new Set(Array.isArray(amb) ? amb : []);
  if (foley.some((f) => f.kind === 'ambience_fan')) ambience.add('fan');
  // key beats for sub swells: scares, thuds, creaks, climax scene starts
  const swells = [
    ...scares,
    ...foley.filter((f) => ['thud', 'creak', 'knock'].includes(f.kind)).map((f) => f.t),
    ...(timeline.scenes || []).filter((s) => s.mood === 'climax').map((s) => s.start_s + 0.3)
  ].filter((t) => t > 1).sort((a, b) => a - b);
  // heartbeat windows: up to 12 s before each scare, stopping at the drop
  const hb = scares.map((t, i) => ({ start: Math.max(i ? scares[i - 1] + 2 : 2, t - 12), end: t - DROP_LEAD_S }))
    .filter((w) => w.end - w.start > 2);
  return { D, scares, silences, foley, unmapped, ambience: [...ambience], swells, heartbeat: hb };
}

// Global level envelope: pre-scare drop and silence beats.
function envelopeAt(t, plan) {
  let g = 1;
  for (const s of plan.scares) {
    const a = s - DROP_LEAD_S;
    if (t >= a - 0.08 && t < s) g = Math.min(g, t < a ? 1 - (1 - dbToLin(DROP_DB)) * ((t - (a - 0.08)) / 0.08) : dbToLin(DROP_DB));
  }
  for (const si of plan.silences) {
    if (t >= si.start_s && t < si.end_s) g = Math.min(g, 0.35);
  }
  return g;
}

export function renderBed(plan, { seed = 1337 } = {}) {
  const N = Math.ceil(plan.D * SR);
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  const rndL = mulberry32(seed), rndR = mulberry32(seed + 1), rndW = mulberry32(seed + 2);
  // --- room tone + wind + drone (continuous) ---
  let lpL = 0, lpR = 0, wind = 0, wind2 = 0;
  const hasFan = plan.ambience.includes('fan');
  const hasCrickets = plan.ambience.includes('crickets');
  const hasRain = plan.ambience.includes('rain');
  const hasFridge = plan.ambience.includes('fridge');
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const prog = t / plan.D;
    const env = envelopeAt(t, plan);
    // room tone: dark noise (never below this, so no dead air)
    const nL = rndL() * 2 - 1, nR = rndR() * 2 - 1;
    lpL += 0.035 * (nL - lpL); lpR += 0.035 * (nR - lpR);
    const room = 0.05;
    // wind/air: slow band noise with gusts
    const nw = rndW() * 2 - 1;
    wind += 0.004 * (nw - wind); wind2 += 0.02 * (wind - wind2);
    const gust = 0.55 + 0.45 * Math.sin(TAU * 0.07 * t + 1.3) * Math.sin(TAU * 0.031 * t);
    // dread drone: E1 + tritone + slow beating, swelling with progress
    const dl = (0.35 + 0.65 * smooth(prog));
    const drone = (Math.sin(TAU * 41.2 * t) * 0.5 + Math.sin(TAU * 41.6 * t + 0.7) * 0.35 + Math.sin(TAU * 58.3 * t) * 0.22 * smooth(prog) + Math.sin(TAU * 82.4 * t) * 0.12)
      * (0.7 + 0.3 * Math.sin(TAU * 0.11 * t));
    let ambL = 0, ambR = 0;
    if (hasFan) { const f = Math.sin(TAU * 50 * t) * 0.22 + Math.sin(TAU * 100 * t) * 0.08; const swish = 0.6 + 0.4 * Math.sin(TAU * 3.6 * t); ambL += (f + lpL * 1.4 * swish) * 0.5; ambR += (f + lpR * 1.4 * swish) * 0.5; }
    if (hasFridge) { const f = Math.sin(TAU * 60 * t) * 0.12 + Math.sin(TAU * 120 * t) * 0.05; ambL += f; ambR += f; }
    if (hasRain) { ambL += (nL - lpL) * 0.05; ambR += (nR - lpR) * 0.05; }
    if (hasCrickets) {
      const ph = (t * 2.3) % 1; const on = ph < 0.18 ? Math.sin(TAU * 26 * t) > 0 ? 1 : 0 : 0;
      const c = on * Math.sin(TAU * 4400 * t) * 0.03; ambL += c; ambR += c * 0.7;
    }
    // loop tail: rising swell into the hook over the last 1.2 s
    const tail = smooth((t - (plan.D - 1.2)) / 1.2);
    const tailSig = tail * (wind * 6 + Math.sin(TAU * (41.2 + 30 * tail) * t) * 0.3);
    const otherGain = env;
    const roomGain = Math.max(env, dbToLin(DROP_DB));
    L[i] = (lpL * room * 6) * roomGain + (wind2 * 4 * gust * 0.5 + drone * 0.16 * dl + ambL * 0.5 + tailSig * 0.5) * otherGain;
    R[i] = (lpR * room * 6) * roomGain + (wind2 * 4 * gust * 0.45 + drone * 0.16 * dl + ambR * 0.5 + tailSig * 0.5) * otherGain;
  }
  const add = (startS, durS, fn, pan = 0) => {
    const a = Math.max(0, Math.floor(startS * SR)), b = Math.min(N, Math.floor((startS + durS) * SR));
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
    for (let i = a; i < b; i++) { const v = fn((i - a) / SR, i / SR) * envelopeAt(i / SR, plan); L[i] += v * gl * 1.41; R[i] += v * gr * 1.41; }
  };
  const nr = mulberry32(seed + 9);
  // --- sub swells: build 2.5 s into each key beat, stop at the drop ---
  for (const k of plan.swells) add(k - 2.5, 2.5, (u) => Math.sin(TAU * 33 * u) * 0.35 * Math.pow(u / 2.5, 2.2));
  // --- heartbeat: lub-dub, bpm 62 -> 132, stops on the drop ---
  for (const w of plan.heartbeat) {
    let t = w.start;
    while (t < w.end - 0.3) {
      const p = (t - w.start) / (w.end - w.start);
      const bpm = 62 + 70 * p * p;
      const amp = 0.22 + 0.35 * p;
      add(t, 0.18, (u) => Math.sin(TAU * 52 * u) * Math.exp(-u * 26) * amp);
      add(t + 0.2, 0.18, (u) => Math.sin(TAU * 46 * u) * Math.exp(-u * 30) * amp * 0.7);
      t += 60 / bpm;
    }
  }
  // --- foley ---
  for (const f of plan.foley) {
    if (f.kind === 'steps' || f.kind === 'steps_fast') {
      const n = f.kind === 'steps' ? 6 : 9, gap = f.kind === 'steps' ? 0.58 : 0.3;
      for (let k = 0; k < n; k++) {
        const pan = -0.6 + 1.2 * (k / (n - 1));
        let lp = 0;
        add(f.t + k * gap, 0.12, (u) => { lp += 0.25 * ((nr() * 2 - 1) - lp); return (lp * 1.6 + Math.sin(TAU * 90 * u) * 0.4) * Math.exp(-u * 38) * (0.55 - 0.03 * k); }, pan);
      }
    } else if (f.kind === 'creak') {
      add(f.t, 1.4, (u) => { const fr = 180 + 260 * Math.sin(u * 2.1) + 40 * Math.sin(TAU * 7 * u); const pulse = Math.max(0, Math.sin(TAU * (28 + 10 * u) * u)); return Math.sin(TAU * fr * u) * pulse * 0.35 * Math.sin(Math.PI * u / 1.4); }, 0.4);
    } else if (f.kind === 'knock') {
      for (let k = 0; k < 3; k++) add(f.t + k * 0.28, 0.15, (u) => (Math.sin(TAU * 140 * u) + (nr() * 2 - 1) * 0.4) * Math.exp(-u * 45) * 0.6, 0.3);
    } else if (f.kind === 'thud') {
      add(f.t, 0.6, (u) => (Math.sin(TAU * (70 - 30 * u) * u) * 0.8 + (nr() * 2 - 1) * 0.2 * Math.exp(-u * 60)) * Math.exp(-u * 7) * 0.7);
    } else if (f.kind === 'breath') {
      for (let k = 0; k < 2; k++) { let lp = 0; add(f.t + k * 1.5, 1.2, (u) => { lp += 0.08 * ((nr() * 2 - 1) - lp); return lp * Math.sin(Math.PI * u / 1.2) * 0.9; }, -0.2); }
    } else if (f.kind === 'gust') {
      let lp = 0; add(f.t, 2.2, (u) => { lp += 0.05 * ((nr() * 2 - 1) - lp); return lp * 2.2 * Math.sin(Math.PI * u / 2.2); }, -0.5);
    } else if (f.kind === 'heartbeat_hit') {
      add(f.t, 0.6, (u) => Math.sin(TAU * 52 * u) * Math.exp(-u * 20) * 0.5 + (u > 0.22 ? Math.sin(TAU * 46 * (u - 0.22)) * Math.exp(-(u - 0.22) * 22) * 0.35 : 0));
    } else if (f.kind === 'scrape') {
      let lp = 0; add(f.t, 0.9, (u) => { lp += 0.4 * ((nr() * 2 - 1) - lp); return lp * Math.sin(TAU * (900 - 500 * u) * u) * 0.4 * Math.sin(Math.PI * u / 0.9); }, 0.5);
    } else if (f.kind === 'bell') {
      add(f.t, 3.0, (u) => (Math.sin(TAU * 523 * u) + 0.5 * Math.sin(TAU * 1307 * u)) * Math.exp(-u * 1.4) * 0.18);
    } else if (f.kind === 'thunder') {
      let lp = 0; add(f.t, 3.0, (u) => { lp += 0.01 * ((nr() * 2 - 1) - lp); return lp * 9 * Math.exp(-u * 1.1); });
    } else if (f.kind === 'riser') {
      add(f.t, 2.0, (u) => Math.sin(TAU * (200 + 400 * u * u) * u) * 0.12 * (u / 2));
    } else if (f.kind === 'stinger') {
      // dissonant high cluster + scraped noise + sub hit, starting exactly on the cue (bypasses the drop)
      const a0 = Math.floor(f.t * SR), len = Math.floor(2.4 * SR);
      let lp = 0;
      for (let i = 0; i < len && a0 + i < N; i++) {
        const u = i / SR;
        const vib = 1 + 0.012 * Math.sin(TAU * 6.5 * u);
        const cl = (Math.sin(TAU * 1975 * vib * u) + Math.sin(TAU * 2093 * vib * u) + Math.sin(TAU * 2217 * u)) * 0.11 * Math.exp(-u * 1.3);
        lp += 0.3 * ((nr() * 2 - 1) - lp);
        const sc = lp * 0.5 * Math.exp(-u * 4);
        const sub = Math.sin(TAU * (48 - 14 * u) * u) * 0.9 * Math.exp(-u * 3.2);
        const v = (cl + sc + sub) * Math.min(1, u / 0.004);
        L[a0 + i] += v; R[a0 + i] += v * 0.92;
      }
    }
    // ambience_fan is handled in the continuous layer
  }
  // normalise to a fixed bed reference (-3 dBFS peak), soft clip safety
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = peak > 0 ? dbToLin(-3) / peak : 1;
  for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * g * 1.05) / Math.tanh(1.05); R[i] = Math.tanh(R[i] * g * 1.05) / Math.tanh(1.05); }
  return { L, R, N };
}

export function writeWav(outPath, L, R) {
  const N = L.length;
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, buf);
  return outPath;
}

export function generateHorrorBed(projectDir, outPath = null) {
  const timeline = JSON.parse(fs.readFileSync(path.join(projectDir, 'timeline.json'), 'utf8'));
  let brief = {};
  try { brief = JSON.parse(fs.readFileSync(path.join(projectDir, 'brief.json'), 'utf8')); } catch { /* */ }
  const plan = planBed(timeline, brief);
  const { L, R } = renderBed(plan);
  const out = outPath || path.join(projectDir, 'cache', 'sfx', 'horror_bed.wav');
  writeWav(out, L, R);
  const report = { out, duration_s: plan.D, scares: plan.scares, silences: plan.silences, foley: plan.foley.map((f) => `${f.name}->${f.kind}@${f.t}`), unmapped: plan.unmapped, ambience: plan.ambience, heartbeat_windows: plan.heartbeat };
  fs.writeFileSync(out.replace(/\.wav$/, '.json'), JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const a = process.argv.slice(2);
  const proj = a[a.indexOf('--project') + 1];
  if (!proj || a.indexOf('--project') < 0) { console.error('usage: horror_sound.mjs --project <dir> [--out <wav>] [--json]'); process.exit(2); }
  const out = a.includes('--out') ? a[a.indexOf('--out') + 1] : null;
  const r = generateHorrorBed(proj, out);
  console.log(a.includes('--json') ? JSON.stringify(r, null, 2) : `HORROR BED: ${r.out} (${r.duration_s}s, ${r.scares.length} scare(s), unmapped: ${r.unmapped.join(',') || 'none'})`);
}
