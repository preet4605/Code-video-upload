// Audio audit of a rendered MP4 (or m4a) for a project that has a sound.json. Pure checks live in qa.mjs; this file gathers inputs.
// Returns null when the project has no sound.json (old projects keep their old behaviour).
import fs from 'node:fs';
import path from 'node:path';
import { loadSound, resolveCues, isScareCue } from './cues.mjs';
import { buildMix, decodeToFloat, voSpans } from './mix.mjs';
import { AUDIO_QA, voiceClarity, phoneCheck, monoFold, truePeak, shortTermLoudness, loudnessSpikes, preScareSilence, licenceManifest } from './qa.mjs';
import { SYNTH_KINDS } from './synth/index.mjs';

export function hasSoundSheet(projectDir) { return Boolean(projectDir) && fs.existsSync(path.join(projectDir, 'sound.json')); }

export function auditProjectAudio({ projectDir, media, ffmpeg = 'ffmpeg', timeline = null, targetLufs = -14, stemsDir = null, decoded = null }) {
  if (!hasSoundSheet(projectDir)) return null;
  const fails = [], warns = [], verified = [], unverified = [], values = {};
  const stems = stemsDir || path.join(projectDir, 'audio');
  let sound, res;
  try { sound = loadSound(path.join(projectDir, 'sound.json')); } catch (e) { return { fails: [`audio: ${e.message}`], warns, verified, unverified, values }; }
  res = resolveCues(sound, timeline || {}, { projectDir });
  if (res.errors.length) fails.push(...res.errors.map((e) => `audio/sound.json: ${e}`));
  const cues = res.cues;
  const fps = timeline?.fps || 30;
  let report = null;
  try { report = JSON.parse(fs.readFileSync(path.join(stems, 'cue_report.json'), 'utf8')); } catch { /* stems not rendered */ }
  if (!report) unverified.push('audio stems not rendered (run scripts/sound_design.mjs): cue timing, phone check and voice clarity not measured');
  const rep = new Map((report?.cues || []).map((c) => [c.id, c]));

  // licences
  let manifest = null; try { manifest = JSON.parse(fs.readFileSync(path.join(stems, 'licences.json'), 'utf8')); } catch { /* none */ }
  const lic = licenceManifest({ cues, manifest });
  values.licences = lic;
  if (lic.required === 0) verified.push('licences: all audio is tier-A synthesis (no third-party assets)');
  else if (lic.missing.length) fails.push(`audio: licence manifest incomplete for ${lic.missing.length} of ${lic.required} non-synth cue(s): ${lic.missing.join(', ')}`);
  else verified.push(`licences: manifest complete for ${lic.required} tier-B/C asset(s)`);

  // scare anchoring (stinger within 1 frame of its event)
  const scares = cues.filter(isScareCue);
  for (const c of scares) {
    const off = Math.abs(c.offset_s || 0);
    if (typeof c.at === 'string' && off <= 1 / fps + 1e-6) verified.push(`scare cue "${c.id}" is anchored to event "${c.at}" (offset ${off.toFixed(3)} s <= 1 frame); the visual must use the same event`);
    else warns.push(`audio: scare cue "${c.id}" is not anchored to a timeline event within 1 frame (at=${JSON.stringify(c.at)}, offset ${off} s)`);
  }

  // decoded final mix
  let dec = decoded;
  if (!dec && media) { try { dec = decodeToFloat(ffmpeg, media, 48000); } catch (e) { unverified.push(`audio: could not decode ${path.basename(media)}: ${e.message}`); } }
  const spans = voSpans(timeline);
  if (dec) {
    const tp = truePeak(dec.L, dec.R); values.true_peak = tp;
    if (tp.true_peak_dbtp > AUDIO_QA.truePeakMaxDbtp) fails.push(`audio: true peak ${tp.true_peak_dbtp} dBTP after encode (limit ${AUDIO_QA.truePeakMaxDbtp}); ${tp.clipped_samples} sample(s) at full scale`);
    else verified.push(`true peak after encode (decoded, 4x oversampled): ${tp.true_peak_dbtp} dBTP (limit ${AUDIO_QA.truePeakMaxDbtp})`);
    const st = shortTermLoudness(dec.L, dec.R); const sp = loudnessSpikes(st, targetLufs, scares.map((c) => rep.get(c.id)?.at_s ?? c.at_s)); values.short_term_max_lufs = Math.max(...st.map((p) => p.lufs));
    const bad = sp.filter((p) => !p.intended);
    if (bad.length) warns.push(`audio: short-term loudness above target+${AUDIO_QA.stSpikeLu} LU at ${bad.slice(0, 4).map((p) => `${p.t}s (${p.lufs} LUFS)`).join(', ')}${bad.length > 4 ? ` +${bad.length - 4} more` : ''}`);
    verified.push(`short-term loudness: max ${values.short_term_max_lufs} LUFS (target ${targetLufs}); ${sp.length - bad.length} intended scare spike(s), ${bad.length} unintended`);
    if (spans.length) {
      const mf = monoFold({ L: dec.L, R: dec.R, spans }); values.mono_fold = { worst_loss_db: mf.worst_loss_db, mean_corr: mf.mean_corr };
      if (mf.per_span.length) {
        if (mf.fail.length) fails.push(`audio: mono fold-down loses >= ${AUDIO_QA.monoFoldFailDb} dB of voice-band energy in ${mf.fail.length} span(s) (worst ${mf.worst_loss_db} dB, e.g. ${mf.fail[0].t0}-${mf.fail[0].t1}s): out-of-phase stereo`);
        else verified.push(`mono fold-down over ${mf.per_span.length} spoken span(s) (1-4 kHz of the final mix): worst loss ${mf.worst_loss_db} dB (limit ${AUDIO_QA.monoFoldFailDb}), mean L/R correlation ${mf.mean_corr}`);
        if (mf.mean_corr !== null && mf.mean_corr < 0) warns.push(`audio: mean L/R correlation over speech is negative (${mf.mean_corr})`);
      }
    } else unverified.push('mono fold-down not measured (no spoken spans in timeline)');
    // pre-scare silence on the final mix
    if (scares.length) {
      const ps = preScareSilence({ L: dec.L, R: dec.R, scares: scares.map((c) => ({ id: c.id, onset_s: rep.get(c.id)?.onset_s ?? c.at_s })) }); values.pre_scare = ps.per_scare;
      const measured = ps.per_scare.filter((p) => !p.skipped);
      for (const p of ps.fail) fails.push(`audio: no pre-scare silence before "${p.id}" at ${p.onset_s}s: the preceding ${AUDIO_QA.silenceBeforeScareS}s is only ${p.drop_db} dB under the previous ${AUDIO_QA.silenceSurroundS}s (need >= ${AUDIO_QA.silenceRelDb} dB)`);
      if (measured.length && !ps.fail.length) verified.push(`pre-scare silence: ${measured.length} scare(s), drops ${measured.map((p) => p.drop_db).join('/')} dB (need >= ${AUDIO_QA.silenceRelDb})`);
      for (const p of ps.per_scare.filter((x) => x.skipped)) unverified.push(`pre-scare silence for "${p.id}": ${p.skipped}`);
    }
  }

  // stems-based checks: voice clarity and phone check (need the stems; VO only for clarity)
  if (report) {
    try {
      const mix = buildMix({ projectDir, stemsDir: stems, timeline, sound, ffmpeg });
      if (mix.duck?.warnings?.length) warns.push(...mix.duck.warnings.map((w) => `audio: ${w}`));
      if (mix.vo && spans.length) {
        const vc = voiceClarity({ vo: mix.vo, bed: mix.bed, spans }); values.voice_clarity = { min_delta_db: vc.min_delta_db };
        for (const p of vc.fail) fails.push(`audio: bed only ${p.delta_db} dB under the voice (1-4 kHz) at ${p.t0}-${p.t1}s (need >= ${AUDIO_QA.voiceClarityFailDb}); speech will be masked`);
        if (vc.warn.length) warns.push(`audio: bed within ${AUDIO_QA.voiceClarityWarnDb} dB of the voice at ${vc.warn.length} span(s) (worst ${Math.min(...vc.warn.map((p) => p.delta_db))} dB)`);
        if (vc.per_span.length) verified.push(`voice clarity (measured on the stems after bus gain + ${mix.duck.depth_db} dB ducking, because VO cannot be separated from the encoded mix): min VO-over-bed ${vc.min_delta_db} dB in 1-4 kHz over ${vc.per_span.length} span(s) (fail < ${AUDIO_QA.voiceClarityFailDb}, warn < ${AUDIO_QA.voiceClarityWarnDb})`);
      } else unverified.push('voice clarity not measured (no voiceover file or no spoken spans); ducking depth unverified');
      const windows = cues.filter((c) => SYNTH_KINDS[c.kind]?.phone || (c.tags || []).includes('phone')).map((c) => { const r = rep.get(c.id); const t0 = r?.at_s ?? c.at_s; const t1 = c.kind === 'sub_drop' ? t0 + 1.2 : (r?.end_s ?? t0 + 2); return { id: c.id, kind: c.kind, t0, t1: Math.max(t1, t0 + 0.3) }; });
      if (windows.length && mix.stems_present.includes('sfx')) {
        const sfx = mix.stems_present.includes('sfx') ? loadSfx(stems, mix.buses.sfx) : null;
        const pc = phoneCheck({ L: sfx.L, R: sfx.R, windows }); values.phone = pc.per_cue;
        for (const p of pc.fail) fails.push(`audio: phone check failed for ${p.kind} "${p.id}": only ${p.band_ratio_db} dB of its energy is in 150-400 Hz (need >= ${AUDIO_QA.phoneBandRatioMinDb}) and ${p.hp200_dbfs} dBFS after a 200 Hz high-pass (floor ${AUDIO_QA.phoneHp200FloorDbfs}): inaudible on a phone speaker`);
        if (!pc.fail.length) verified.push(`phone check (200 Hz high-pass proxy, sfx stem): ${pc.per_cue.length} sub/heartbeat cue(s) keep 150-400 Hz share >= ${Math.min(...pc.per_cue.map((p) => p.band_ratio_db))} dB (limit ${AUDIO_QA.phoneBandRatioMinDb})`);
      }
    } catch (e) { unverified.push(`audio stem checks skipped: ${e.message}`); }
  }
  unverified.push('whether the sound design is good or scary: only measurable defects are gated; listen with headphones and on a phone speaker');
  return { fails, warns, verified, unverified, values };
}

import { readWav } from './wav.mjs';
import { dbToLin } from './dsp.mjs';
function loadSfx(dir, busDb) { const w = readWav(path.join(dir, 'sfx.wav')); const g = dbToLin(busDb ?? 0); return { L: w.L.map((v) => v * g), R: w.R.map((v) => v * g) }; }
