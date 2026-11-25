import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const BUILTIN_SFX_NAMES = [
  'pop',
  'whoosh',
  'thud',
  'stamp_slam',
  'heartbeat',
  'chime',
  'riser',
  'footsteps_run',
  'boom_hit',
  'door_knock',
  'door_creak',
  'claw_scrape',
  'violin_stinger',
  'whisper_gust',
  'distant_thunder',
  'temple_bell',
  'fan_hum'
];

const SFX_ALIASES = {
  slam: 'stamp_slam',
  stamp: 'stamp_slam',
  hit: 'thud',
  impact: 'thud',
  boom: 'boom_hit',
  sub_drop: 'boom_hit',
  footsteps: 'footsteps_run',
  steps: 'footsteps_run',
  reveal: 'chime',
  ding: 'chime',
  bell: 'chime',
  sweep: 'whoosh',
  swoosh: 'whoosh',
  pulse: 'heartbeat',
  heart: 'heartbeat',
  rise: 'riser',
  swell: 'riser',
  drone_hit: 'thud',
  knock: 'door_knock',
  tak: 'door_knock',
  creak: 'door_creak',
  hinge: 'door_creak',
  scratch: 'claw_scrape',
  nails: 'claw_scrape',
  naakhun: 'claw_scrape',
  stinger: 'violin_stinger',
  screech: 'violin_stinger',
  jumpscare: 'violin_stinger',
  whisper: 'whisper_gust',
  breath: 'whisper_gust',
  saans: 'whisper_gust',
  thunder: 'distant_thunder',
  rumble: 'distant_thunder',
  bell_sacred: 'temple_bell',
  ghanti: 'temple_bell',
  shankh: 'temple_bell',
  ambient_fan: 'fan_hum'
};

const SFX_FILTERS = {
  pop: 'aevalsrc=0.6*sin(2*PI*(620-380*t/0.14)*t)*exp(-22*t):s=48000:d=0.14',
  whoosh: 'anoisesrc=c=pink:r=48000:d=0.35:a=0.45,bandpass=f=900:w=700,afade=t=in:st=0:d=0.12,afade=t=out:st=0.18:d=0.17',
  thud: 'aevalsrc=0.8*sin(2*PI*(95-50*t/0.3)*t)*exp(-10*t):s=48000:d=0.30',
  stamp_slam: 'aevalsrc=(0.75*sin(2*PI*(120-70*t/0.28)*t)+0.3*sin(2*PI*420*t)*exp(-40*t))*exp(-11*t):s=48000:d=0.28',
  heartbeat: "aevalsrc='(0.75*sin(2*PI*62*t)*exp(-18*t)+0.55*sin(2*PI*54*(t-0.22))*exp(-18*max(0,t-0.22))*gte(t,0.22))':s=48000:d=0.65",
  chime: 'aevalsrc=(0.45*sin(2*PI*1046.5*t)+0.25*sin(2*PI*1568*t))*exp(-7*t):s=48000:d=0.45',
  riser: 'aevalsrc=0.45*sin(2*PI*(180+700*t*t)*t)*(t/0.7):s=48000:d=0.70,afade=t=out:st=0.62:d=0.08',
  footsteps_run: "aevalsrc='0.75*(sin(2*PI*75*t)*exp(-24*t)+sin(2*PI*75*(t-0.28))*exp(-24*max(0,t-0.28))*gte(t,0.28)+sin(2*PI*75*(t-0.56))*exp(-24*max(0,t-0.56))*gte(t,0.56)+sin(2*PI*75*(t-0.84))*exp(-24*max(0,t-0.84))*gte(t,0.84))':s=48000:d=1.20",
  boom_hit: 'aevalsrc=0.9*sin(2*PI*(80-48*t/0.75)*t)*exp(-4.5*t):s=48000:d=0.75'
};

const SCARE_SFX_KEYS = new Set([
  'door_knock', 'knock', 'tak',
  'violin_stinger', 'stinger', 'screech', 'jumpscare',
  'boom_hit', 'boom',
  'door_creak', 'creak',
  'claw_scrape', 'scratch', 'nails', 'naakhun'
]);

const SAMPLE_RATE = 48000;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createBiquad(type, freq, q = 0.707, sr = SAMPLE_RATE) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let nb0 = 1, nb1 = 0, nb2 = 0, na1 = 0, na2 = 0;
  const setFreq = (f, nextQ = q) => {
    const f0 = Math.max(12, Math.min(sr * 0.45, f));
    const w0 = (2 * Math.PI * f0) / sr;
    const cosW = Math.cos(w0);
    const sinW = Math.sin(w0);
    const alpha = sinW / (2 * Math.max(0.15, nextQ));
    let b0, b1, b2, a0, a1, a2;
    if (type === 'bandpass') {
      b0 = alpha; b1 = 0; b2 = -alpha;
      a0 = 1 + alpha; a1 = -2 * cosW; a2 = 1 - alpha;
    } else {
      b0 = (1 - cosW) / 2; b1 = 1 - cosW; b2 = (1 - cosW) / 2;
      a0 = 1 + alpha; a1 = -2 * cosW; a2 = 1 - alpha;
    }
    nb0 = b0 / a0; nb1 = b1 / a0; nb2 = b2 / a0; na1 = a1 / a0; na2 = a2 / a0;
  };
  setFreq(freq, q);
  return {
    setFreq,
    process(x) {
      const y = nb0 * x + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      return y;
    }
  };
}

function addStereoReverb(L, R, sr = SAMPLE_RATE, wet = 0.25, decay = 0.55) {
  const n = L.length;
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  const tapsL = [29, 43, 67, 103, 149].map((ms) => Math.round((ms / 1000) * sr));
  const tapsR = [31, 47, 73, 113, 163].map((ms) => Math.round((ms / 1000) * sr));
  const dryGain = 1 - wet * 0.25;

  for (let i = 0; i < n; i++) {
    let revL = 0;
    let revR = 0;
    for (let k = 0; k < tapsL.length; k++) {
      const g = Math.pow(decay, k + 1) * 0.42;
      const idxL = i - tapsL[k];
      const idxR = i - tapsR[k];
      if (idxL >= 0) revL += (L[idxL] * 0.75 + R[idxL] * 0.25) * g;
      if (idxR >= 0) revR += (R[idxR] * 0.75 + L[idxR] * 0.25) * g;
    }
    outL[i] = dryGain * L[i] + wet * revL;
    outR[i] = dryGain * R[i] + wet * revR;
  }
  return [outL, outR];
}

export function writeStereoWav(outPath, leftF32, rightF32, sampleRate = SAMPLE_RATE) {
  const n = Math.min(leftF32.length, rightF32.length);
  const dataSize = n * 4;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 4, 'ascii');
  header.write('fmt ', 12, 4, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 4, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  const pcm = new Int16Array(n * 2);
  for (let i = 0; i < n; i++) {
    const l = Math.tanh(leftF32[i]);
    const r = Math.tanh(rightF32[i]);
    pcm[i * 2] = Math.round(Math.max(-1, Math.min(1, l)) * 32767);
    pcm[i * 2 + 1] = Math.round(Math.max(-1, Math.min(1, r)) * 32767);
  }

  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, Buffer.concat([header, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)]));
  return outPath;
}

const DSP_SFX_SYNTHS = {
  door_knock(sr = SAMPLE_RATE) {
    const n = Math.round(1.3 * sr);
    let L = new Float32Array(n);
    let R = new Float32Array(n);
    const rng = mulberry32(9001);
    const hits = [0.0, 0.34, 0.68];
    const lp = createBiquad('lowpass', 1800, 0.8, sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let s = 0;
      for (let k = 0; k < hits.length; k++) {
        const dt = t - hits[k];
        if (dt >= 0 && dt < 0.28) {
          const wood =
            0.55 * Math.sin(2 * Math.PI * 165 * dt) * Math.exp(-32 * dt) +
            0.35 * Math.sin(2 * Math.PI * 310 * dt) * Math.exp(-44 * dt) +
            0.22 * Math.sin(2 * Math.PI * 680 * dt) * Math.exp(-62 * dt) +
            0.20 * (rng() * 2 - 1) * Math.exp(-90 * dt);
          s += wood * (1 - 0.08 * k);
        }
      }
      const f = lp.process(s);
      L[i] = f * 0.95;
      R[i] = f * 0.88;
    }
    [L, R] = addStereoReverb(L, R, sr, 0.35, 0.58);
    return [L, R];
  },

  door_creak(sr = SAMPLE_RATE) {
    const dur = 1.4;
    const n = Math.round(dur * sr);
    let L = new Float32Array(n);
    let R = new Float32Array(n);
    const rng = mulberry32(9002);
    const bp = createBiquad('bandpass', 620, 4.5, sr);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.sin((t / dur) * Math.PI);
      const stickSlip = 0.5 + 0.5 * Math.sin(2 * Math.PI * (7.5 + 4 * Math.sin(t * 3.1)) * t);
      const fInst = 290 + 180 * Math.sin(t * 2.4) + 55 * stickSlip;
      phase += (2 * Math.PI * fInst) / sr;
      const saw = ((phase / Math.PI) % 2) - 1;
      const raw = (0.6 * saw + 0.25 * Math.sin(phase * 2.02) + 0.12 * (rng() * 2 - 1)) * stickSlip * env;
      const filtered = bp.process(raw) * 1.4;
      L[i] = filtered * (0.75 + 0.25 * Math.sin(t * 2.2));
      R[i] = filtered * (0.75 - 0.25 * Math.sin(t * 2.2));
    }
    [L, R] = addStereoReverb(L, R, sr, 0.32, 0.6);
    return [L, R];
  },

  claw_scrape(sr = SAMPLE_RATE) {
    const dur = 0.95;
    const n = Math.round(dur * sr);
    let L = new Float32Array(n);
    let R = new Float32Array(n);
    const rng = mulberry32(9003);
    const bp1 = createBiquad('bandpass', 2400, 6.0, sr);
    const bp2 = createBiquad('bandpass', 3600, 7.0, sr);
    const bursts = [0.04, 0.30, 0.58];
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let env = 0;
      for (const b of bursts) {
        const dt = t - b;
        if (dt >= 0 && dt < 0.22) env += Math.sin((dt / 0.22) * Math.PI);
      }
      if (i % 1200 === 0) {
        bp1.setFreq(1800 + rng() * 1400, 6.0);
        bp2.setFreq(2800 + rng() * 1400, 7.0);
      }
      const noise = rng() * 2 - 1;
      const sig = (bp1.process(noise) + 0.85 * bp2.process(noise)) * env * 1.6;
      const pan = 0.5 + 0.35 * Math.sin(t * 8.0);
      L[i] = sig * (1 - pan * 0.4);
      R[i] = sig * (0.6 + pan * 0.4);
    }
    [L, R] = addStereoReverb(L, R, sr, 0.3, 0.55);
    return [L, R];
  },

  violin_stinger(sr = SAMPLE_RATE) {
    const dur = 1.2;
    const n = Math.round(dur * sr);
    let L = new Float32Array(n);
    let R = new Float32Array(n);
    const rng = mulberry32(9004);
    const bp = createBiquad('bandpass', 1800, 1.5, sr);
    const freqs = [740, 784, 1046]; // F#5, G5, C6
    let p0 = 0, p1 = 0, p2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const attack = Math.min(1, t / 0.025);
      const decay = Math.exp(-3.1 * t);
      const vib = 1 + 0.012 * Math.sin(2 * Math.PI * 6.5 * t);
      p0 += (2 * Math.PI * freqs[0] * vib) / sr;
      p1 += (2 * Math.PI * freqs[1] * (2 - vib)) / sr;
      p2 += (2 * Math.PI * freqs[2] * vib) / sr;
      const saw0 = ((p0 / Math.PI) % 2) - 1;
      const saw1 = ((p1 / Math.PI) % 2) - 1;
      const saw2 = ((p2 / Math.PI) % 2) - 1;
      const bow = bp.process(rng() * 2 - 1) * 0.55;
      const val = (0.34 * saw0 + 0.34 * saw1 + 0.28 * saw2 + bow) * attack * decay;
      L[i] = val * 0.9 + 0.1 * saw1 * decay;
      R[i] = val * 0.9 + 0.1 * saw0 * decay;
    }
    [L, R] = addStereoReverb(L, R, sr, 0.42, 0.65);
    return [L, R];
  },

  whisper_gust(sr = SAMPLE_RATE) {
    const dur = 1.3;
    const n = Math.round(dur * sr);
    let L = new Float32Array(n);
    let R = new Float32Array(n);
    const rng = mulberry32(9005);
    const bp = createBiquad('bandpass', 340, 0.9, sr);
    const lp = createBiquad('lowpass', 750, 0.707, sr);
    let brown = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const u = t / dur;
      const env = Math.pow(Math.sin(u * Math.PI), 1.5);
      if (i % 800 === 0) bp.setFreq(340 + 240 * Math.sin(u * Math.PI), 0.9);
      const w = rng() * 2 - 1;
      brown = (brown + 0.08 * w) / 1.08;
      const breath = lp.process(bp.process(brown)) * env * 0.55;
      const panAngle = u * (Math.PI / 2);
      L[i] = breath * Math.cos(panAngle);
      R[i] = breath * Math.sin(panAngle);
    }
    [L, R] = addStereoReverb(L, R, sr, 0.30, 0.45);
    return [L, R];
  },

  distant_thunder(sr = SAMPLE_RATE) {
    const dur = 2.4;
    const n = Math.round(dur * sr);
    let L = new Float32Array(n);
    let R = new Float32Array(n);
    const rng = mulberry32(9006);
    const lpL = createBiquad('lowpass', 160, 0.7, sr);
    const lpR = createBiquad('lowpass', 175, 0.7, sr);
    let brown = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const w = rng() * 2 - 1;
      brown = (brown + 0.04 * w) / 1.04;
      const rumbleEnv =
        Math.exp(-1.5 * t) * (0.65 + 0.35 * Math.sin(2 * Math.PI * 2.1 * t) * Math.exp(-0.9 * t)) *
        Math.min(1, t / 0.08);
      const sub = 0.25 * Math.sin(2 * Math.PI * (42 - 8 * (t / dur)) * t);
      L[i] = (lpL.process(brown * 4.2) + sub) * rumbleEnv;
      R[i] = (lpR.process((brown + 0.1 * w) * 4.0) + sub * 0.95) * rumbleEnv;
    }
    [L, R] = addStereoReverb(L, R, sr, 0.4, 0.68);
    return [L, R];
  },

  temple_bell(sr = SAMPLE_RATE) {
    const dur = 2.2;
    const n = Math.round(dur * sr);
    let L = new Float32Array(n);
    let R = new Float32Array(n);
    const f0 = 528;
    const partials = [
      [1.0, 0.50, 1.3],
      [2.0, 0.28, 1.9],
      [2.4, 0.18, 2.5],
      [3.0, 0.14, 3.2],
      [4.18, 0.10, 4.4]
    ];
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const attack = Math.min(1, t / 0.006);
      let sL = 0;
      let sR = 0;
      for (let p = 0; p < partials.length; p++) {
        const [mult, amp, dec] = partials[p];
        const env = Math.exp(-dec * t) * attack;
        sL += amp * env * Math.sin(2 * Math.PI * (f0 * mult) * t);
        sR += amp * env * Math.sin(2 * Math.PI * (f0 * mult + 0.7) * t);
      }
      L[i] = sL * 0.85;
      R[i] = sR * 0.85;
    }
    [L, R] = addStereoReverb(L, R, sr, 0.38, 0.64);
    return [L, R];
  },

  fan_hum(sr = SAMPLE_RATE) {
    const dur = 2.0;
    const n = Math.round(dur * sr);
    let L = new Float32Array(n);
    let R = new Float32Array(n);
    const rng = mulberry32(9008);
    const bp = createBiquad('bandpass', 240, 1.4, sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.min(1, t / 0.15) * Math.min(1, (dur - t) / 0.15);
      const bladeLfo = 0.65 + 0.35 * Math.sin(2 * Math.PI * 3.8 * t);
      const air = bp.process(rng() * 2 - 1) * 0.45 * bladeLfo;
      const motor = 0.28 * Math.sin(2 * Math.PI * 58 * t) + 0.12 * Math.sin(2 * Math.PI * 116 * t);
      L[i] = (motor + air) * env;
      R[i] = (motor * 0.96 + air * (0.85 + 0.15 * Math.cos(2 * Math.PI * 3.8 * t))) * env;
    }
    return [L, R];
  }
};

export function getMoodVoiceFilter(mood = 'none') {
  const m = String(mood || 'none').toLowerCase().trim();
  if (m === 'horror' || m === 'suspense') {
    return 'equalizer=f=120:t=q:w=1.2:g=3.5,equalizer=f=3200:t=q:w=1.5:g=2.0,aecho=0.8:0.75:45|90:0.18|0.10';
  }
  if (m === 'documentary' || m === 'science-doc') {
    return 'equalizer=f=140:t=q:w=1.2:g=2.0,equalizer=f=4000:t=q:w=1.4:g=2.5';
  }
  if (m === 'editorial' || m === 'editorial-light') {
    return 'highpass=f=85,equalizer=f=5000:t=q:w=1.5:g=3.0';
  }
  if (m === 'vintage' || m === 'vintage-warm') {
    return 'lowpass=f=7500,equalizer=f=220:t=q:w=1.2:g=3.0';
  }
  return '';
}

export function resolveSfxName(name) {
  const key = String(name || 'pop').toLowerCase().trim();
  if (SFX_FILTERS[key] || DSP_SFX_SYNTHS[key]) return key;
  if (SFX_ALIASES[key]) return SFX_ALIASES[key];
  return 'pop';
}

export function synthesizeSfxWav(ffmpegBin, name, outPath) {
  const canonical = resolveSfxName(name);
  if (DSP_SFX_SYNTHS[canonical]) {
    const [L, R] = DSP_SFX_SYNTHS[canonical](SAMPLE_RATE);
    writeStereoWav(outPath, L, R, SAMPLE_RATE);
    return { name: canonical, outPath };
  }
  const lavfiExpr = SFX_FILTERS[canonical];
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  execFileSync(
    ffmpegBin,
    ['-y', '-f', 'lavfi', '-i', lavfiExpr, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', outPath],
    { stdio: 'pipe' }
  );
  return { name: canonical, outPath };
}

function isScareCue(cue) {
  if (!cue || cue.type !== 'sfx') return false;
  const raw = String(cue.name || '').toLowerCase().trim();
  const canonical = resolveSfxName(raw);
  return SCARE_SFX_KEYS.has(raw) || SCARE_SFX_KEYS.has(canonical);
}

export function computeTensionCurve(timeline, durationS = 10) {
  const dur = Math.max(0.5, Number(durationS) || timeline?.duration_s || 10);
  const scenes = Array.isArray(timeline?.scenes) ? timeline.scenes : [];
  const cues = Array.isArray(timeline?.audio_cues) ? timeline.audio_cues : [];

  const silenceWindows = [];
  for (const sc of scenes) {
    const m = String(sc.mood || '').toLowerCase();
    if (sc.silence_drop === true || m === 'silence') {
      silenceWindows.push({ start_s: sc.start_s, end_s: sc.end_s });
    }
  }
  for (const cue of cues) {
    if (isScareCue(cue) && typeof cue.t_s === 'number' && cue.t_s >= 0 && cue.t_s <= dur) {
      silenceWindows.push({
        start_s: Math.max(0, cue.t_s - 0.65),
        end_s: Math.max(0, cue.t_s - 0.05)
      });
    }
  }

  const devotionalWindows = [];
  for (const sc of scenes) {
    const tag = `${sc.id || ''} ${sc.mood || ''}`;
    if (/devotional|chalisa|hanuman|sacred/i.test(tag)) {
      devotionalWindows.push({ start_s: sc.start_s, end_s: sc.end_s });
    }
  }

  const sceneGainAt = (sc, t) => {
    const m = String(sc.mood || 'neutral').toLowerCase();
    if (sc.silence_drop === true || m === 'silence') return 0.04;
    if (m === 'calm' || m === 'neutral') return 0.55;
    if (m === 'climax') return 1.25;
    if (m === 'suspense' || m === 'horror') {
      const span = Math.max(0.05, sc.end_s - sc.start_s);
      const u = Math.max(0, Math.min(1, (t - sc.start_s) / span));
      return 0.80 + 0.35 * u;
    }
    return 1.0;
  };

  const evalAt = (t) => {
    let baseGain = 0.95;
    if (scenes.length > 0) {
      let idx = scenes.findIndex((s) => t >= s.start_s && t < s.end_s);
      if (idx === -1) idx = t < scenes[0].start_s ? 0 : scenes.length - 1;
      const sc = scenes[idx];
      baseGain = sceneGainAt(sc, t);
      // 0.15s smooth cross-ramp at scene boundary
      const ramp = 0.15;
      if (idx > 0 && t - sc.start_s < ramp) {
        const u = Math.max(0, Math.min(1, (t - sc.start_s) / ramp));
        const prevG = sceneGainAt(scenes[idx - 1], sc.start_s);
        baseGain = prevG + (baseGain - prevG) * u;
      }
    }

    // Apply pre-scare dead-silence drop (0.04x with 0.08s smooth ramp into drop)
    let dropFactor = 1.0;
    for (const w of silenceWindows) {
      if (t >= w.start_s && t <= w.end_s) {
        const fadeIn = Math.min(1, (t - w.start_s) / 0.08);
        const fadeOut = Math.min(1, (w.end_s - t) / 0.03);
        const depth = Math.min(fadeIn, fadeOut);
        const g = 1.0 - (1.0 - 0.04) * Math.max(0, Math.min(1, depth));
        if (g < dropFactor) dropFactor = g;
      }
    }

    let devotionalMix = 0;
    for (const dw of devotionalWindows) {
      if (t >= dw.start_s && t <= dw.end_s) {
        const uIn = Math.min(1, (t - dw.start_s) / 0.4);
        const uOut = Math.min(1, (dw.end_s - t) / 0.4);
        devotionalMix = Math.max(devotionalMix, Math.min(uIn, uOut));
      }
    }

    return { gain: baseGain * dropFactor, devotionalMix };
  };

  return { durationS: dur, scenes, silenceWindows, devotionalWindows, evalAt };
}

function synthesizeHorrorSoundscape(durationS, outPath, timeline = null) {
  const dur = Math.max(0.5, Number(durationS) || 10);
  const n = Math.round(dur * SAMPLE_RATE);
  let L = new Float32Array(n);
  let R = new Float32Array(n);
  const rng = mulberry32(48064);
  const curve = computeTensionCurve(timeline, dur);

  // Layer 1 filters: swept bandpass night wind + deep rumble lowpass
  const windBpL = createBiquad('bandpass', 380, 1.9, SAMPLE_RATE);
  const windBpR = createBiquad('bandpass', 420, 1.9, SAMPLE_RATE);
  const rumbleLp = createBiquad('lowpass', 85, 0.7, SAMPLE_RATE);
  const padLp = createBiquad('lowpass', 360, 0.75, SAMPLE_RATE);

  // Pink/brown noise state
  let b0 = 0, b1 = 0, b2 = 0, brown = 0;

  // Layer 3: sparse detuned music-box schedule (-12 cents)
  const detuneRatio = Math.pow(2, -12 / 1200);
  const notes = [293.66, 349.23, 415.30, 392.00, 311.13, 293.66]; // D4, F4, Ab4, G4, Eb4, D4
  const boxEvents = [];
  let cursor = 0.65;
  let noteIdx = 0;
  while (cursor < dur - 0.5) {
    boxEvents.push({
      t: cursor,
      freq: notes[noteIdx % notes.length] * detuneRatio,
      pan: (noteIdx % 2 === 0 ? -0.35 : 0.35)
    });
    cursor += 1.85 + rng() * 0.75;
    noteIdx++;
  }

  let evPtr = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const white = rng() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.96300 * b1 + white * 0.2965164;
    b2 = 0.57000 * b2 + white * 1.0526913;
    const pink = (b0 + b1 + b2 + white * 0.1848) * 0.14;
    brown = (brown + 0.03 * white) / 1.03;

    // Modulate wind bandpass center slowly (opposite L/R phase for stereo drift)
    if (i % 480 === 0) {
      const fL = 440 + 210 * Math.sin(2 * Math.PI * 0.13 * t);
      const fR = 440 + 210 * Math.cos(2 * Math.PI * 0.13 * t);
      windBpL.setFreq(fL, 1.9);
      windBpR.setFreq(fR, 1.9);
      padLp.setFreq(240 + 220 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.09 * t)), 0.8);
    }

    const thunderPhase = (t % 5.5) / 5.5;
    const thunderSwell = thunderPhase < 0.32 ? Math.sin((thunderPhase / 0.32) * Math.PI) * 0.45 : 0;
    const rumble = rumbleLp.process(brown * (2.6 + thunderSwell * 2.5));
    const windL = windBpL.process(pink) * 0.42;
    const windR = windBpR.process(pink * 0.95 + white * 0.02) * 0.42;

    // Layer 2: Dissonant bowed-string dread pad (D1=36.7, A1=55, Eb2=77.8, Ab2=103.8 Hz)
    const dreadVoices = [36.7, 55.0, 77.8, 103.8];
    let padL = 0;
    let padR = 0;
    for (let v = 0; v < dreadVoices.length; v++) {
      const fL = dreadVoices[v] - 0.25;
      const fR = dreadVoices[v] + 0.25;
      const sawL = ((t * fL) % 1) * 2 - 1;
      const sawR = ((t * fR) % 1) * 2 - 1;
      padL += sawL * 0.12;
      padR += sawR * 0.12;
    }
    const dreadSwell = 0.65 + 0.35 * Math.sin(2 * Math.PI * 0.18 * t);
    const filteredPadL = padLp.process(padL) * dreadSwell;
    const filteredPadR = padLp.process(padR) * dreadSwell;

    // Sacred pure-fifth crossfade drone (C2=65.4, G2=98, C3=130.8 Hz)
    const { gain, devotionalMix } = curve.evalAt(t);
    let sacL = 0;
    let sacR = 0;
    if (devotionalMix > 0.001) {
      const sac =
        0.35 * Math.sin(2 * Math.PI * 65.4 * t) +
        0.24 * Math.sin(2 * Math.PI * 98.0 * t) +
        0.16 * Math.sin(2 * Math.PI * 130.8 * t);
      sacL = sac;
      sacR = sac * 0.98 + 0.04 * Math.sin(2 * Math.PI * 65.6 * t);
    }

    const padOutL = filteredPadL * (1 - devotionalMix) + sacL * devotionalMix;
    const padOutR = filteredPadR * (1 - devotionalMix) + sacR * devotionalMix;

    // Layer 3: Haunting detuned music-box
    while (evPtr < boxEvents.length && boxEvents[evPtr].t + 1.8 < t) evPtr++;
    let boxL = 0;
    let boxR = 0;
    for (let e = evPtr; e < boxEvents.length && boxEvents[e].t <= t; e++) {
      const dt = t - boxEvents[e].t;
      if (dt >= 0 && dt < 1.8) {
        const bEnv = Math.min(1, dt / 0.004) * Math.exp(-3.4 * dt);
        const f = boxEvents[e].freq;
        const tone = (0.65 * Math.sin(2 * Math.PI * f * dt) + 0.25 * Math.sin(2 * Math.PI * (f * 2.01) * dt)) * bEnv * 0.22;
        const p = boxEvents[e].pan;
        boxL += tone * (0.5 - p * 0.45);
        boxR += tone * (0.5 + p * 0.45);
      }
    }

    const envEdge = Math.min(1, t / 0.35) * Math.min(1, (dur - t) / 0.45);
    const totalScale = gain * envEdge;
    L[i] = (rumble + windL + padOutL + boxL * (1 - devotionalMix)) * totalScale;
    R[i] = (rumble * 0.97 + windR + padOutR + boxR * (1 - devotionalMix)) * totalScale;
  }

  [L, R] = addStereoReverb(L, R, SAMPLE_RATE, 0.28, 0.58);
  writeStereoWav(outPath, L, R, SAMPLE_RATE);
  return outPath;
}

export function generateBgmBed(ffmpegBin, { mood = 'horror', durationS = 10, outPath, timeline = null }) {
  const dur = Math.max(0.5, Number(durationS) || 10);
  const m = String(mood || 'horror').toLowerCase();

  if (m === 'horror' || m === 'suspense') {
    synthesizeHorrorSoundscape(dur, outPath, timeline);
    return { mood: m, durationS: dur, outPath };
  }

  let expr;
  if (m === 'science-doc') {
    expr = `aevalsrc=(0.35*sin(2*PI*110*t)+0.22*sin(2*PI*165*t))*(0.65+0.35*sin(2*PI*2.0*t)):s=48000:d=${dur}`;
  } else if (m === 'editorial-light' || m === 'energetic') {
    expr = `aevalsrc=(0.30*sin(2*PI*220*t)+0.20*sin(2*PI*330*t))*(0.55+0.45*sin(2*PI*2.5*t)):s=48000:d=${dur}`;
  } else {
    // vintage-warm / calm
    expr = `aevalsrc=(0.32*sin(2*PI*196*t)+0.20*sin(2*PI*293.6*t))*(0.8+0.2*sin(2*PI*0.6*t)):s=48000:d=${dur}`;
  }

  const fadeOutStart = Math.max(0, dur - 0.5).toFixed(3);
  const lavfi = `${expr},lowpass=f=1800,afade=t=in:st=0:d=0.4,afade=t=out:st=${fadeOutStart}:d=0.5`;

  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  execFileSync(
    ffmpegBin,
    ['-y', '-f', 'lavfi', '-i', lavfi, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', outPath],
    { stdio: 'pipe' }
  );
  return { mood: m, durationS: dur, outPath };
}

export function resolveBgmSource(bgmOpt, mood = 'horror') {
  if (!bgmOpt) return { mode: 'none', path: null };
  const raw = String(bgmOpt).trim();
  if (raw === 'auto') return { mode: 'auto', path: null };

  if (raw === 'library') {
    const dirs = [
      path.join(os.homedir(), '.config', 'code-video-studio', 'music'),
      '/root/.config/code-video-studio/music'
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir)
        .filter((f) => /\.(mp3|wav|m4a|flac|ogg)$/i.test(f))
        .sort();
      if (files.length === 0) continue;
      const m = String(mood || 'horror').toLowerCase();
      const matchMood = files.find((f) => path.parse(f).name.toLowerCase() === m);
      const matchHorror = files.find((f) => path.parse(f).name.toLowerCase() === 'horror');
      const chosen = matchMood || matchHorror || files[0];
      return { mode: 'file', path: path.join(dir, chosen) };
    }
    return { mode: 'auto', path: null };
  }

  return { mode: 'file', path: path.resolve(raw) };
}

export function buildBgmVolumeExpression(timeline) {
  const scenes = Array.isArray(timeline?.scenes) ? timeline.scenes : [];
  const cues = Array.isArray(timeline?.audio_cues) ? timeline.audio_cues : [];

  const sceneTerms = [];
  const silenceDrops = [];

  for (const sc of scenes) {
    const m = String(sc.mood || 'neutral').toLowerCase();
    const s = Number(sc.start_s || 0).toFixed(3);
    const e = Number(sc.end_s || 0).toFixed(3);
    if (sc.silence_drop === true || m === 'silence') {
      silenceDrops.push(`between(t,${s},${e})`);
    } else if (m === 'calm' || m === 'neutral') {
      sceneTerms.push(`0.55*between(t,${s},${e})`);
    } else if (m === 'climax') {
      sceneTerms.push(`1.25*between(t,${s},${e})`);
    } else {
      sceneTerms.push(`1.0*between(t,${s},${e})`);
    }
  }

  for (const cue of cues) {
    if (isScareCue(cue) && typeof cue.t_s === 'number' && cue.t_s >= 0) {
      const ws = Math.max(0, cue.t_s - 0.65).toFixed(3);
      const we = Math.max(0, cue.t_s - 0.05).toFixed(3);
      silenceDrops.push(`between(t,${ws},${we})`);
    }
  }

  const baseExpr = sceneTerms.length > 0 ? `(${sceneTerms.join('+')})` : '1.0';
  const expr = silenceDrops.length > 0
    ? `if(gt(${silenceDrops.join('+')},0),0.05,${baseExpr})`
    : baseExpr;
  return `volume='${expr}':eval=frame`;
}

export function buildAudioMixFilterGraph({
  voiceInputIdx = null,
  bgmInputIdx = null,
  sfxEntries = [],
  bgmGainDb = -16,
  targetLufs = -16,
  truePeak = -1.5,
  lra = 11,
  vocalPreset = false,
  audioMood = 'none',
  timeline = null,
  applyExternalTension = false,
  linearGainDb = null, // number => linear normalisation (gain + limiter), keeps designed dynamics (horror drops)
  measureOnly = false // true => no normalisation at all (used to measure the raw mix)
} = {}) {
  const chains = [];
  const mixInputs = [];
  const bgmTensionFilter = timeline && applyExternalTension ? `,${buildBgmVolumeExpression(timeline)}` : '';

  if (voiceInputIdx !== null && voiceInputIdx !== undefined) {
    const moodFilter = audioMood && audioMood !== 'none' ? getMoodVoiceFilter(audioMood) : '';
    const voSteps = [];
    if (moodFilter) voSteps.push(moodFilter);
    if (vocalPreset) voSteps.push('acompressor=threshold=-18dB:ratio=3:attack=5:release=60');
    voSteps.push('aformat=sample_rates=48000:channel_layouts=stereo');
    const voFilter = `[${voiceInputIdx}:a]${voSteps.join(',')}`;

    if (bgmInputIdx !== null && bgmInputIdx !== undefined) {
      chains.push(`${voFilter},asplit=2[vo_mix][vo_sc]`);
      mixInputs.push('[vo_mix]');
      chains.push(`[${bgmInputIdx}:a]volume=${bgmGainDb}dB${bgmTensionFilter},aformat=sample_rates=48000:channel_layouts=stereo[bgm_lvl]`);
      chains.push('[bgm_lvl][vo_sc]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=250[bgm_duck]');
      mixInputs.push('[bgm_duck]');
    } else {
      chains.push(`${voFilter}[vo_mix]`);
      mixInputs.push('[vo_mix]');
    }
  } else if (bgmInputIdx !== null && bgmInputIdx !== undefined) {
    chains.push(`[${bgmInputIdx}:a]volume=${bgmGainDb}dB${bgmTensionFilter},aformat=sample_rates=48000:channel_layouts=stereo[bgm_duck]`);
    mixInputs.push('[bgm_duck]');
  }

  sfxEntries.forEach((entry, i) => {
    const ms = Math.max(0, Math.round((entry.t_s || 0) * 1000));
    const gainDb = entry.gain_db ?? -4;
    const label = `[sfx_${i}]`;
    chains.push(`[${entry.inputIdx}:a]adelay=${ms}|${ms},volume=${gainDb}dB,aformat=sample_rates=48000:channel_layouts=stereo${label}`);
    mixInputs.push(label);
  });

  if (mixInputs.length === 0) {
    throw new Error('buildAudioMixFilterGraph requires at least one audio bus (voice, bgm, or sfx)');
  }

  const limitLin = Math.pow(10, (truePeak - 0.6) / 20).toFixed(4);
  const finalStage = measureOnly
    ? 'anull'
    : (Number.isFinite(linearGainDb)
      ? `volume=${linearGainDb.toFixed(2)}dB,alimiter=limit=${limitLin}:attack=1:release=60:level=disabled`
      : `loudnorm=I=${targetLufs}:TP=${truePeak}:LRA=${lra}`);
  if (mixInputs.length === 1) {
    chains.push(`${mixInputs[0]}${finalStage}[aout]`);
  } else {
    chains.push(`${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:normalize=0[mixed]`);
    chains.push(`[mixed]${finalStage}[aout]`);
  }

  return {
    filterComplex: chains.join(';'),
    mapAudioLabel: '[aout]'
  };
}
