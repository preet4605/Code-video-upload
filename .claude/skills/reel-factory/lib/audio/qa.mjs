// Audio QA as pure functions of Float32 L/R (no ffmpeg), so every check can be tested against a deliberately broken fixture.
// Thresholds live in AUDIO_QA so docs and tests quote one source.
import { SR, bp, hp, lp, applyBiquad, linToDb, clamp } from './dsp.mjs';

export const AUDIO_QA = Object.freeze({
  voiceClarityFailDb: 10,   // bed within 10 dB of VO (1-4 kHz, per spoken span) = FAIL; speech is masked
  voiceClarityWarnDb: 12,   // within 12 dB = warn (research target: bed >= 12 dB under VO)
  voiceBand: [1000, 4000],
  phoneBand: [150, 400],
  // Phone check: share of a sub/heartbeat cue's energy that sits in 150-400 Hz (what a phone speaker reproduces).
  // Calibrated on this package's synths (see references/sound.md): pure 40-80 Hz sweep ~ -40 dB, sub_drop with harmonics ~ -8 dB.
  phoneBandRatioMinDb: -20,
  phoneHp200FloorDbfs: -60, // after a 200 Hz high-pass the cue must still reach this RMS level (absolute floor: it is audible at all)
  monoFoldFailDb: 3,        // mono fold-down may not lose >= 3 dB of voice-band energy over spoken spans
  truePeakMaxDbtp: -1,
  stSpikeLu: 3,             // short-term (3 s) loudness above target + 3 LU is flagged
  silenceBeforeScareS: 0.5,
  silenceRelDb: 10,         // the 0.5 s before a scare must sit >= 10 dB under the preceding 4 s
  silenceSurroundS: 4
});

const ms = (x, a, b) => { let s = 0; const i0 = Math.max(0, Math.round(a)), i1 = Math.min(x.length, Math.round(b)); for (let i = i0; i < i1; i++) s += x[i] * x[i]; return s / Math.max(1, i1 - i0); };
const msDb = (v) => 10 * Math.log10(Math.max(1e-14, v));
const mono = (L, R) => { const m = new Float32Array(L.length); for (let i = 0; i < m.length; i++) m[i] = (L[i] + R[i]) * 0.5; return m; };

// ---- 1. voice clarity: VO vs non-VO energy in 1-4 kHz per spoken span ----
export function voiceClarity({ vo, bed, sr = SR, spans, cfg = AUDIO_QA }) {
  const [lo, hi] = cfg.voiceBand;
  const v = bp(mono(vo.L, vo.R), lo, hi, 2, sr), b = bp(mono(bed.L, bed.R), lo, hi, 2, sr);
  const per = [];
  for (const [t0, t1] of spans) {
    const vd = msDb(ms(v, t0 * sr, t1 * sr)), bd = msDb(ms(b, t0 * sr, t1 * sr));
    if (vd < -70) continue; // no speech energy here (a pause the timeline called a line)
    per.push({ t0: r2(t0), t1: r2(t1), vo_db: r1(vd), bed_db: r1(bd), delta_db: r1(vd - bd) });
  }
  const min = per.length ? Math.min(...per.map((p) => p.delta_db)) : null;
  return { per_span: per, min_delta_db: min, fail: per.filter((p) => p.delta_db < cfg.voiceClarityFailDb), warn: per.filter((p) => p.delta_db >= cfg.voiceClarityFailDb && p.delta_db < cfg.voiceClarityWarnDb) };
}

// ---- 2. phone check: sub hits / heartbeats must keep 150-400 Hz content ----
export function phoneCheck({ L, R, sr = SR, windows, cfg = AUDIO_QA }) {
  const m = mono(L, R); const band = bp(m, cfg.phoneBand[0], cfg.phoneBand[1], 4, sr); const h200 = hp(m, 200, 4, sr);
  const per = windows.map((w) => {
    const a = w.t0 * sr, b = w.t1 * sr; const full = ms(m, a, b), bd = ms(band, a, b), hh = ms(h200, a, b);
    const ratio = msDb(bd) - msDb(full), floor = msDb(hh) / 1; // msDb already 10log10 of mean square = dBFS RMS
    return { id: w.id, kind: w.kind, t0: r2(w.t0), t1: r2(w.t1), band_ratio_db: r1(ratio), hp200_dbfs: r1(floor), pass: ratio >= cfg.phoneBandRatioMinDb && floor >= cfg.phoneHp200FloorDbfs && full > 1e-12 };
  });
  return { per_cue: per, fail: per.filter((p) => !p.pass) };
}

// ---- 3. mono fold-down over spoken spans (voice band) ----
export function monoFold({ L, R, sr = SR, spans, cfg = AUDIO_QA }) {
  const [lo, hi] = cfg.voiceBand; const l = bp(L, lo, hi, 2, sr), r = bp(R, lo, hi, 2, sr); const mid = mono(l, r);
  let worst = 0, corrSum = 0, corrN = 0; const per = [];
  for (const [t0, t1] of spans) {
    const a = t0 * sr, b = t1 * sr; const eL = ms(l, a, b), eR = ms(r, a, b), eM = ms(mid, a, b);
    if (msDb((eL + eR) / 2) < -70) continue;
    const loss = msDb((eL + eR) / 2) - msDb(eM); worst = Math.max(worst, loss);
    let sLR = 0; const i0 = Math.max(0, Math.round(a)), i1 = Math.min(l.length, Math.round(b)); for (let i = i0; i < i1; i++) sLR += l[i] * r[i];
    const corr = sLR / Math.max(1e-14, Math.sqrt(eL * eR) * Math.max(1, i1 - i0)); corrSum += corr; corrN++;
    per.push({ t0: r2(t0), t1: r2(t1), loss_db: r1(loss), corr: Math.round(corr * 100) / 100 });
  }
  return { per_span: per, worst_loss_db: per.length ? r1(worst) : null, mean_corr: corrN ? Math.round(corrSum / corrN * 100) / 100 : null, fail: per.filter((p) => p.loss_db >= cfg.monoFoldFailDb) };
}

// ---- 4. true peak (4x oversampled, 16-tap windowed sinc) ----
const TP_TAPS = (() => { const P = []; for (let ph = 1; ph < 4; ph++) { const h = []; for (let k = -8; k < 8; k++) { const x = k + 1 - ph / 4; const s = Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x); const w = 0.5 + 0.5 * Math.cos(Math.PI * x / 9); h.push(s * w); } P.push(h); } return P; })();
export function truePeak(L, R) {
  let sp = 0; for (const x of [L, R]) for (let i = 0; i < x.length; i++) sp = Math.max(sp, Math.abs(x[i]));
  let tp = sp; const thr = sp * 0.4;
  for (const x of [L, R]) for (let i = 8; i < x.length - 8; i++) {
    if (Math.abs(x[i]) < thr && Math.abs(x[i + 1]) < thr) continue;
    for (const h of TP_TAPS) { let s = 0; for (let k = 0; k < 16; k++) s += x[i - 7 + k] * h[k]; if (Math.abs(s) > tp) tp = Math.abs(s); }
  }
  let clipped = 0; for (const x of [L, R]) for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) >= 0.9995) clipped++;
  return { true_peak_dbtp: r2(linToDb(tp)), sample_peak_dbfs: r2(linToDb(sp)), clipped_samples: clipped };
}

// ---- 5. short-term loudness (BS.1770 K-weighting, 3 s windows every 0.5 s, 48 kHz) ----
const K1 = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585];
const K2 = [1, -2, 1, -1.99004745483398, 0.99007225036621];
export function shortTermLoudness(L, R, sr = SR) {
  if (sr !== 48000) throw new Error('shortTermLoudness expects 48 kHz audio');
  const kw = (x) => applyBiquad(applyBiquad(x, K1), K2); const kl = kw(L), kr = kw(R);
  const blk = Math.round(0.1 * sr), nb = Math.floor(L.length / blk); const e = new Float64Array(nb);
  for (let b = 0; b < nb; b++) e[b] = ms(kl, b * blk, (b + 1) * blk) + ms(kr, b * blk, (b + 1) * blk);
  const win = Math.min(30, nb); const out = [];
  for (let b = win; b <= nb; b += 5) { let s = 0; for (let k = b - win; k < b; k++) s += e[k]; out.push({ t: r2(b * 0.1), lufs: r1(-0.691 + msDb(s / win)) }); }
  if (!out.length) out.push({ t: 0, lufs: -120 });
  return out;
}
export function loudnessSpikes(series, target, scareTimes = [], cfg = AUDIO_QA) {
  const lim = target + cfg.stSpikeLu;
  return series.filter((p) => p.lufs > lim).map((p) => ({ ...p, intended: scareTimes.some((t) => t <= p.t + 0.001 && t >= p.t - 3.0) }));
}

// ---- 6. horror: >= 0.5 s relative silence before each cue tagged scare ----
export function preScareSilence({ L, R, sr = SR, scares, cfg = AUDIO_QA }) {
  const m = mono(L, R); const per = [];
  for (const s of scares) {
    const t = s.onset_s; const w0 = t - cfg.silenceBeforeScareS, w1 = t - 0.02;
    if (w0 - cfg.silenceSurroundS < -0.001 && w0 < 1.0) { per.push({ id: s.id, onset_s: r2(t), skipped: 'not enough lead-in before the scare to measure surrounding level' }); continue; }
    const sur = msDb(ms(m, Math.max(0, w0 - cfg.silenceSurroundS) * sr, w0 * sr)); const win = msDb(ms(m, w0 * sr, w1 * sr));
    const drop = sur - win; const trivially = sur < -60;
    per.push({ id: s.id, onset_s: r2(t), surround_db: r1(sur), window_db: r1(win), drop_db: r1(drop), pass: trivially || drop >= cfg.silenceRelDb });
  }
  return { per_scare: per, fail: per.filter((p) => p.pass === false) };
}

// ---- 7. licence manifest ----
export function licenceManifest({ cues, manifest }) {
  const need = cues.filter((c) => c.source && c.source !== 'synth');
  const have = new Map((manifest?.entries || []).map((e) => [e.id, e]));
  const missing = [];
  for (const c of need) {
    const e = have.get(c.id);
    const lic = e?.licence;
    const ok = e && e.file && ((typeof lic === 'string' && lic.trim()) || (lic && String(lic.name || lic.id || '').trim()));
    if (!ok) missing.push(c.id);
  }
  return { required: need.length, missing };
}

const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
export { ms as meanSquare, msDb };
