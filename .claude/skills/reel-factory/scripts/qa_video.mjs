#!/usr/bin/env node
// Measured QA on the *rendered MP4* (not on self-declared timeline fields).
// Everything uses FFmpeg built-ins; no extra dependencies.
//
//   node scripts/qa_video.mjs --input out/reel.mp4 [--project <dir>] [--platform reels|shorts|tiktok]
//                             [--safe-profile universal|ads] [--json] [--strict]
//
// Verdict: SHIP (no failing checks) or FIX (>=1 failing check). SHIP never means "perfect":
// human_review (watch with sound, on a phone) is always required and listed in the report.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveBin } from '../lib/runtime.mjs';
import { lintDirection } from '../lib/direction_lint.mjs';
import { auditProjectAudio } from '../lib/audio/audit.mjs';
import { QA_THRESHOLDS, getPlatform, getSafeProfile, DEFAULT_SAFE_PROFILE } from '../lib/profiles.mjs';

const MAXBUF = 256 * 1024 * 1024;

// ---------- pure parsers / math (unit-tested) ----------

export function parseSignalstatsYavg(text) {
  // Lines: "frame:12 pts:400 pts_time:0.4" then "lavfi.signalstats.YAVG=123.4"
  const out = [];
  let t = null;
  for (const line of String(text).split(/\r?\n/)) {
    const mt = line.match(/pts_time:([0-9.eE+-]+)/);
    if (mt) t = Number(mt[1]);
    const my = line.match(/lavfi\.signalstats\.YAVG=([0-9.eE+-]+)/);
    if (my && t !== null) out.push({ t, y: Number(my[1]) });
  }
  return out;
}

// WCAG 2.3.1-style: count opposing luminance transitions (zig-zag with swing >= delta),
// a "flash" is a pair of opposing changes. Returns the worst 1-second window.
export function countFlashes(series, delta = QA_THRESHOLDS.flashLumaDelta) {
  if (!series || series.length < 3) return { max_per_sec: 0, worst_t: 0, transitions: 0 };
  const trans = [];
  let anchor = series[0].y;
  let dir = 0;
  let extremeY = series[0].y;
  let extremeT = series[0].t;
  for (let i = 1; i < series.length; i++) {
    const { t, y } = series[i];
    if (dir >= 0 && y > extremeY) { extremeY = y; extremeT = t; }
    if (dir <= 0 && y < extremeY) { extremeY = y; extremeT = t; }
    if (dir === 0) {
      if (y - anchor >= delta) { dir = 1; extremeY = y; extremeT = t; }
      else if (anchor - y >= delta) { dir = -1; extremeY = y; extremeT = t; }
      continue;
    }
    if (dir === 1 && extremeY - y >= delta) {
      trans.push(extremeT);
      dir = -1; anchor = extremeY; extremeY = y; extremeT = t;
    } else if (dir === -1 && y - extremeY >= delta) {
      trans.push(extremeT);
      dir = 1; anchor = extremeY; extremeY = y; extremeT = t;
    }
  }
  let best = 0;
  let bestT = 0;
  for (let i = 0; i < trans.length; i++) {
    let j = i;
    while (j < trans.length && trans[j] - trans[i] < 1.0) j++;
    const n = j - i; // transitions inside a 1s window
    const flashes = n / 2;
    if (flashes > best) { best = flashes; bestT = trans[i]; }
  }
  return { max_per_sec: best, worst_t: Number(bestT.toFixed(2)), transitions: trans.length };
}

export function parseFreezedetect(stderr) {
  const res = [];
  let start = null;
  for (const line of String(stderr).split(/\r?\n/)) {
    const ms = line.match(/freeze_start:\s*([0-9.eE+-]+)/);
    const md = line.match(/freeze_duration:\s*([0-9.eE+-]+)/);
    if (ms) start = Number(ms[1]);
    if (md && start !== null) {
      res.push({ start, duration: Number(md[1]) });
      start = null;
    }
  }
  if (start !== null) res.push({ start, duration: null });
  return res;
}

export function parseBlackdetect(stderr) {
  const res = [];
  for (const m of String(stderr).matchAll(/black_start:([0-9.eE+-]+)\s+black_end:([0-9.eE+-]+)\s+black_duration:([0-9.eE+-]+)/g)) {
    res.push({ start: Number(m[1]), end: Number(m[2]), duration: Number(m[3]) });
  }
  return res;
}

export function parseSilencedetect(stderr, totalDur = null) {
  const res = [];
  let start = null;
  for (const line of String(stderr).split(/\r?\n/)) {
    const ms = line.match(/silence_start:\s*([0-9.eE+-]+)/);
    const me = line.match(/silence_end:\s*([0-9.eE+-]+)\s*\|\s*silence_duration:\s*([0-9.eE+-]+)/);
    if (ms) start = Number(ms[1]);
    if (me) {
      const end = Number(me[1]);
      const dur = Number(me[2]);
      res.push({ start: start ?? Math.max(0, end - dur), end, duration: dur });
      start = null;
    }
  }
  if (start !== null && totalDur !== null) res.push({ start, end: totalDur, duration: Number((totalDur - start).toFixed(3)) });
  return res;
}

export function meanAbsDiff(a, b) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
  return s / n / 255;
}

// moov before mdat => faststart
export function hasFaststart(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(1 << 20);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    let off = 0;
    let seenMdat = false;
    while (off + 8 <= n) {
      let size = buf.readUInt32BE(off);
      const type = buf.toString('latin1', off + 4, off + 8);
      if (type === 'moov') return !seenMdat;
      if (type === 'mdat') seenMdat = true;
      if (size === 1 && off + 16 <= n) size = Number(buf.readBigUInt64BE(off + 8));
      if (size < 8) break;
      off += size;
    }
    return false;
  } finally {
    fs.closeSync(fd);
  }
}

// ---------- ffmpeg-backed measurements ----------

function run(bin, args, opts = {}) {
  return spawnSync(bin, args, { encoding: 'utf8', maxBuffer: MAXBUF, ...opts });
}

export function probeMedia(ffprobe, p) {
  return JSON.parse(execFileSync(ffprobe, ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', p], { encoding: 'utf8', maxBuffer: MAXBUF }));
}

export function measureFlashes(ffmpeg, p, thresholds = QA_THRESHOLDS) {
  const r = run(ffmpeg, ['-v', 'error', '-i', p, '-an', '-vf', 'scale=270:-2,signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-']);
  const series = parseSignalstatsYavg(r.stdout || '');
  return { series_len: series.length, ...countFlashes(series, thresholds.flashLumaDelta), series };
}

export function measureFreezes(ffmpeg, p, minS = 0.5) {
  const r = run(ffmpeg, ['-hide_banner', '-i', p, '-an', '-vf', `freezedetect=n=-60dB:d=${minS}`, '-f', 'null', '-']);
  return parseFreezedetect(r.stderr || '');
}

export function measureBlack(ffmpeg, p) {
  const r = run(ffmpeg, ['-hide_banner', '-i', p, '-an', '-vf', 'blackdetect=d=0.2:pic_th=0.98:pix_th=0.10', '-f', 'null', '-']);
  return parseBlackdetect(r.stderr || '');
}

export function measureSilence(ffmpeg, p, db = QA_THRESHOLDS.silenceDb, minS = 0.5, totalDur = null) {
  const r = run(ffmpeg, ['-hide_banner', '-i', p, '-vn', '-af', `silencedetect=n=${db}dB:d=${minS}`, '-f', 'null', '-']);
  return parseSilencedetect(r.stderr || '', totalDur);
}

export function measureIntegratedLufs(ffmpeg, p) {
  const r = run(ffmpeg, ['-hide_banner', '-nostats', '-i', p, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const m = [...String(r.stderr || '').matchAll(/I:\s*(-?[0-9.]+)\s*LUFS/g)].pop();
  const lra = [...String(r.stderr || '').matchAll(/LRA:\s*(-?[0-9.]+)\s*LU/g)].pop();
  return { integrated_lufs: m ? Number(m[1]) : null, lra: lra ? Number(lra[1]) : null };
}

export function measureHookMotion(ffmpeg, p, windowS = QA_THRESHOLDS.hookMotionWindowS) {
  const W = 108;
  const H = 192;
  const r = spawnSync(ffmpeg, ['-v', 'error', '-i', p, '-t', String(windowS + 0.1), '-an', '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: MAXBUF });
  const buf = r.stdout || Buffer.alloc(0);
  const fsz = W * H;
  const frames = Math.floor(buf.length / fsz);
  if (frames < 2) return { frames, motion: 0 };
  const first = buf.subarray(0, fsz);
  let best = 0;
  for (let i = 1; i < frames; i++) {
    best = Math.max(best, meanAbsDiff(first, buf.subarray(i * fsz, (i + 1) * fsz)));
  }
  return { frames, motion: Number(best.toFixed(5)) };
}

export function makeSafeZoneSheet(ffmpeg, p, outPng, profileName = DEFAULT_SAFE_PROFILE) {
  const z = getSafeProfile(profileName);
  const boxes = [
    `drawbox=x=0:y=0:w=iw:h=ih*${z.minY}/1920:color=red@0.40:t=fill`,
    `drawbox=x=0:y=ih*${z.maxY}/1920:w=iw:h=ih*(1920-${z.maxY})/1920:color=red@0.40:t=fill`,
    `drawbox=x=0:y=0:w=iw*${z.minX}/1080:h=ih:color=red@0.40:t=fill`,
    `drawbox=x=iw*${z.maxX}/1080:y=0:w=iw*(1080-${z.maxX})/1080:h=ih:color=red@0.40:t=fill`
  ].join(',');
  const probe = JSON.parse(execFileSync(resolveBin('ffprobe'), ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', p], { encoding: 'utf8' }));
  const dur = Number(probe.format?.duration) || 6;
  const fpsTile = 6 / Math.max(dur, 1);
  const r = run(ffmpeg, ['-y', '-v', 'error', '-i', p, '-an', '-vf', `fps=${fpsTile.toFixed(5)},scale=360:-2,${boxes},tile=3x2`, '-frames:v', '1', outPng]);
  return r.status === 0 && fs.existsSync(outPng);
}

// ---------- honesty contract: what was measured vs what was not ----------

// Version of the qa_report.json contract (fields verified/unverified). Distinct from the skill version.
export const QA_CONTRACT_VERSION = '1.0';

// Never measured by any gate in this package. Always listed; a human must judge these.
export const ALWAYS_UNVERIFIED = Object.freeze([
  'hook strength (only first-2s motion is measured, not whether a stranger stops scrolling)',
  'fear / humour / emotional effect',
  'pronunciation and voice acting of the narration',
  'taste, originality and visual beauty',
  'factual accuracy of on-screen claims and numbers',
  'how it looks and sounds on a real phone'
]);

export function buildVerification({ probe, flashes, freezes, black, silence, hook, loudness, mix, timeline, thresholds = QA_THRESHOLDS, placeholderAudio = false } = {}) {
  const verified = [];
  const unverified = [...ALWAYS_UNVERIFIED];
  const v = probe?.streams?.find((s) => s.codec_type === 'video');
  const a = probe?.streams?.find((s) => s.codec_type === 'audio');
  const dur = Number(probe?.format?.duration) || 0;
  if (v) verified.push(`spec: ${v.codec_name} ${v.pix_fmt} ${v.width}x${v.height}, ${dur.toFixed(2)}s`);
  else unverified.push('spec: no video stream probed');
  if (a) verified.push(`audio spec: ${a.codec_name} ${a.sample_rate} Hz`);
  if (flashes) verified.push(`flashes: max ${Number(flashes.max_per_sec || 0).toFixed(1)}/s (cap ${thresholds.maxFlashesPerSec})`);
  else unverified.push('flash check skipped');
  if (freezes) verified.push(`freeze: ${freezes.length} segment(s) >= 0.5s (cap ${thresholds.maxFreezeS}s)`);
  else unverified.push('freeze check skipped');
  if (black) verified.push(`black frames: ${black.length} segment(s)`);
  else unverified.push('black-frame check skipped');
  if (silence) verified.push(`dead air: ${silence.length} silent segment(s) below ${thresholds.silenceDb} dB`);
  else unverified.push('dead-air check skipped');
  if (hook && hook.frames >= 2) verified.push(`hook motion (first ${thresholds.hookMotionWindowS}s): ${hook.motion} (min ${thresholds.hookMinMotion})`);
  else unverified.push('hook motion check skipped (too few frames)');
  if (loudness && loudness.integrated_lufs !== null && loudness.integrated_lufs !== undefined) {
    verified.push(`loudness: ${loudness.integrated_lufs} LUFS` + (loudness.true_peak_dbtp != null ? `, true peak ${loudness.true_peak_dbtp} dBTP` : ''));
    if (loudness.true_peak_dbtp == null) unverified.push('true peak not measured');
  } else unverified.push('loudness not measured');
  if (mix && mix.vo_to_bed_lu != null) verified.push(`voice over bed: ${mix.vo_to_bed_lu} LU (min ${thresholds.minVoiceToBedLu})`);
  else unverified.push('voice-vs-bed level not measured (no voiceover+bed pair)');
  if (placeholderAudio) unverified.push('audio is a placeholder tone: real sound design not present');
  if (timeline?.words?.length && timeline.audio_file) {
    const m = timeline.alignment?.method;
    verified.push(`caption alignment method: ${m || 'unknown'}`);
    if (!m || m === 'wpm-estimate' || m === 'linear-scale' || m === 'voiced-span-weighted') unverified.push(`word timing is approximate (${m || 'unknown'}), not frame-accurate`);
  } else if (!timeline) unverified.push('timeline.json absent: caption timing, scene pacing and direction lint not checked');
  return { contract_version: QA_CONTRACT_VERSION, verified, unverified };
}

// ---------- the verdict ----------

export function evaluateQa({ probe, flashes, freezes, black, silence, hook, loudness, mix, timeline, brief, platform, faststart, thresholds = QA_THRESHOLDS, placeholderAudio = false, draftManifest = false, allowances = {} }) {
  const fails = [];
  const warns = [];
  const inWindow = (list, a, b) => (list || []).some(([s0, e0]) => a < e0 + 0.05 && b > s0 - 0.05);
  // Deliberate creative choices (scene.allow_static / allow_black / allow_silence) downgrade to warnings.
  const soften = (kind, a, b, msg) => {
    if (inWindow(allowances[kind], a, b)) warns.push(`${msg} [allowed by scene.allow_${kind}]`);
    else fails.push(msg);
  };
  const plat = getPlatform(platform);
  const v = probe?.streams?.find((s) => s.codec_type === 'video');
  const a = probe?.streams?.find((s) => s.codec_type === 'audio');
  const dur = Number(probe?.format?.duration) || 0;

  // Spec
  if (!v) fails.push('spec: no video stream');
  else {
    if (v.codec_name !== 'h264') fails.push(`spec: video codec ${v.codec_name} (need h264)`);
    if (v.pix_fmt !== 'yuv420p') fails.push(`spec: pix_fmt ${v.pix_fmt} (need yuv420p)`);
    if (v.width * 16 !== v.height * 9) warns.push(`spec: ${v.width}x${v.height} is not exactly 9:16`);
    if (v.width < plat.minWidth || draftManifest) {
      fails.push(`spec/draft: ${v.width}x${v.height} is a draft render (ship needs width >= ${plat.minWidth}, 1080 recommended). Re-render without --draft.`);
    } else if (v.width < thresholds.minWidthShip) {
      warns.push(`spec: ${v.width}px wide is above the ${plat.minWidth}px minimum but below the recommended ${thresholds.minWidthShip}px (reel-720 preset).`);
    }
    const fpsNum = (() => {
      const [n, d] = String(v.avg_frame_rate || v.r_frame_rate || '0/1').split('/').map(Number);
      return d ? n / d : n;
    })();
    if (fpsNum && fpsNum < plat.minFps - 0.01) fails.push(`spec: ${fpsNum.toFixed(2)} fps below ${plat.minFps} fps minimum for ${plat.id}`);
    if (v.color_space !== 'bt709') warns.push(`spec/color: color_space="${v.color_space || 'unset'}" (expected bt709): colours may shift on phones.`);
    if (v.profile && !/high/i.test(v.profile)) warns.push(`spec: H.264 profile ${v.profile} (High recommended)`);
    const kbps = Number(v.bit_rate) / 1000;
    if (kbps && kbps > plat.maxVideoKbps) warns.push(`spec: video bitrate ${Math.round(kbps)} kbps above ${plat.maxVideoKbps} kbps`);
  }
  if (!a) fails.push('audio: no audio stream');
  else {
    if (a.codec_name !== 'aac') fails.push(`audio: codec ${a.codec_name} (need aac)`);
    if (String(a.sample_rate) !== '48000') fails.push(`audio: sample rate ${a.sample_rate} (need 48000)`);
  }
  if (v && a) {
    const vd = Number(v.duration);
    const ad = Number(a.duration);
    if (vd && ad && Math.abs(vd - ad) > 0.15) fails.push(`sync: video ${vd.toFixed(2)}s vs audio ${ad.toFixed(2)}s differ by > 0.15s`);
  }
  if (faststart === false) warns.push('spec: moov atom is not at the start (+faststart missing)');
  if (dur > plat.maxDurationS) fails.push(`length: ${dur.toFixed(1)}s exceeds ${plat.maxDurationS}s for ${plat.id}`);

  // Flashes (measured)
  if (flashes && flashes.max_per_sec > thresholds.maxFlashesPerSec) {
    fails.push(`flash: ${flashes.max_per_sec.toFixed(1)} flashes/s near ${flashes.worst_t}s (WCAG 2.3.1 cap ${thresholds.maxFlashesPerSec}/s)`);
  }

  // Freezes
  for (const f of freezes || []) {
    const d = f.duration ?? Math.max(0, dur - f.start);
    if (d > thresholds.maxFreezeS) soften('static', f.start, f.start + d, `freeze: identical frames for ${d.toFixed(2)}s from ${f.start.toFixed(2)}s`);
  }

  // Black frames (ignore intentional fades touching start/end up to 0.1s)
  for (const b of black || []) {
    const touchesEdge = b.start < 0.1 || b.end > dur - 0.1;
    if (b.duration > thresholds.maxBlackS && !touchesEdge) soften('black', b.start, b.end, `black: ${b.duration.toFixed(2)}s black from ${b.start.toFixed(2)}s`);
    else if (b.start < 0.1 && b.duration > 0.2) soften('black', b.start, b.end, `black: opens on ${b.duration.toFixed(2)}s of black (hook is lost)`);
    else if (b.end > dur - 0.1 && b.duration > 1.0) warns.push(`black: ends with ${b.duration.toFixed(2)}s black`);
  }

  // Dead air
  for (const s of silence || []) {
    if (s.start < 0.05 && s.duration > 0.35) warns.push(`audio: ${s.duration.toFixed(2)}s of silence at the very start (cut lead-in)`);
    if (s.duration > thresholds.maxSilenceS && s.start >= 0.05) soften('silence', s.start, s.end ?? s.start + s.duration, `audio: ${s.duration.toFixed(2)}s dead air at ${s.start.toFixed(2)}s (< ${thresholds.silenceDb} dB)`);
  }

  // Loudness
  if (loudness) {
    const target = Number(timeline?.target_lufs ?? -16);
    if (loudness.integrated_lufs !== null && Math.abs(loudness.integrated_lufs - (loudness.target_lufs ?? target)) > 2.0) {
      fails.push(`loudness: ${loudness.integrated_lufs} LUFS vs target ${loudness.target_lufs ?? target}`);
    }
    if (loudness.true_peak_dbtp !== null && loudness.true_peak_dbtp !== undefined && loudness.true_peak_dbtp > (loudness.true_peak_limit_dbtp ?? -1.5) + 0.3) {
      fails.push(`loudness: true peak ${loudness.true_peak_dbtp} dBTP over limit`);
    }
  }
  if (placeholderAudio) fails.push('audio: placeholder tone only (no voiceover, music or SFX). A sine tone is not sound design.');
  if (mix && mix.vo_to_bed_lu !== null && mix.vo_to_bed_lu !== undefined && mix.vo_to_bed_lu < thresholds.minVoiceToBedLu) {
    fails.push(`mix: voice is only ${mix.vo_to_bed_lu.toFixed(1)} LU above the bed before ducking (need >= ${thresholds.minVoiceToBedLu}); music will mask speech`);
  }

  // Hook
  if (hook && hook.frames >= 2 && hook.motion < thresholds.hookMinMotion) {
    fails.push(`hook: almost nothing moves in the first ${thresholds.hookMotionWindowS}s (motion ${hook.motion}). The first frame must already be doing something.`);
  }

  // Caption honesty
  if (timeline?.words?.length && timeline.audio_file) {
    const m = timeline.alignment?.method;
    if (!m || m === 'wpm-estimate' || m === 'linear-scale') warns.push('captions: word timings estimated, not aligned to the voiceover');
    else if (m === 'voiced-span-weighted') warns.push('captions: word timings aligned by voiced-span weighting (approximate: +/-0.15s typical); use provider timestamps for frame-accurate highlights');
  }

  const verdict = fails.length === 0 ? 'SHIP' : 'FIX';
  return {
    verdict,
    fails,
    warns,
    human_review: {
      required: true,
      checklist: [
        'Watch the whole master once on a phone with sound ON, then once muted.',
        'First 2 seconds: would a stranger stop scrolling? Is the hook understood without sound?',
        'Listen for mispronounced words, harsh SFX, music masking speech, clicks at cuts.',
        'Open qa_safezone_sheet.png: no caption, face or badge under the red bands.',
        'Every on-screen claim/number matches the voiceover and a source.',
        'Last second: does it loop or land a payoff, not fade into nothing?'
      ]
    }
  };
}

export function runQa({ mp4, projectDir = null, platform = 'reels', safeProfile = DEFAULT_SAFE_PROFILE, loudness = null, mix = null, placeholderAudio = false, draftManifest = false, writeSheet = true }) {
  const ffmpeg = resolveBin('ffmpeg');
  const ffprobe = resolveBin('ffprobe');
  const probe = probeMedia(ffprobe, mp4);
  const dur = Number(probe.format?.duration) || 0;
  let timeline = null;
  let brief = null;
  if (projectDir) {
    const tp = path.join(projectDir, 'timeline.json');
    if (fs.existsSync(tp)) timeline = JSON.parse(fs.readFileSync(tp, 'utf8'));
    const bp = path.join(projectDir, 'brief.json');
    if (fs.existsSync(bp)) brief = JSON.parse(fs.readFileSync(bp, 'utf8'));
  }
  let thresholds = QA_THRESHOLDS;
  if (projectDir && fs.existsSync(path.join(projectDir, 'qa.json'))) {
    const q = JSON.parse(fs.readFileSync(path.join(projectDir, 'qa.json'), 'utf8'));
    thresholds = { ...QA_THRESHOLDS, ...(q.thresholds || {}) };
  }
  const allowances = { static: [], black: [], silence: [] };
  for (const sc of timeline?.scenes || []) {
    for (const k of Object.keys(allowances)) if (sc[`allow_${k}`] === true) allowances[k].push([sc.start_s, sc.end_s]);
  }
  const fl = measureFlashes(ffmpeg, mp4, thresholds);
  const { series, ...flashes } = fl;
  const hook = measureHookMotion(ffmpeg, mp4);
  const freezes = measureFreezes(ffmpeg, mp4, 0.5);
  const black = measureBlack(ffmpeg, mp4);
  const silence = measureSilence(ffmpeg, mp4, thresholds.silenceDb, 0.5, dur);
  const res = evaluateQa({
    probe,
    flashes,
    freezes,
    black,
    silence,
    hook,
    loudness,
    mix,
    timeline,
    brief,
    platform: brief?.platform || platform,
    faststart: hasFaststart(mp4),
    placeholderAudio,
    draftManifest,
    thresholds,
    allowances
  });
  if (timeline) res.warns.push(...lintDirection(timeline, brief, { platform }));
  const outDir = path.dirname(mp4);
  let safeSheet = null;
  if (writeSheet) {
    const p = path.join(outDir, 'qa_safezone_sheet.png');
    if (makeSafeZoneSheet(ffmpeg, mp4, p, safeProfile)) safeSheet = p;
  }
  const honesty = buildVerification({ probe, flashes, freezes, black, silence, hook, loudness, mix, timeline, thresholds, placeholderAudio });
  // Audio audit (only for projects that have a sound.json cue sheet; otherwise nothing changes).
  let audioAudit = null;
  if (projectDir) {
    try { audioAudit = auditProjectAudio({ projectDir, media: mp4, ffmpeg, timeline, targetLufs: loudness?.target_lufs ?? timeline?.target_lufs ?? -14 }); }
    catch (e) { honesty.unverified.push(`audio audit crashed: ${e.message}`); }
    if (audioAudit) {
      res.fails.push(...audioAudit.fails); res.warns.push(...audioAudit.warns);
      honesty.verified.push(...audioAudit.verified); honesty.unverified.push(...audioAudit.unverified);
      honesty.verified = [...new Set(honesty.verified)]; honesty.unverified = [...new Set(honesty.unverified)];
      if (res.fails.length) res.verdict = 'FIX';
    }
  }
  return {
    ...res,
    ...honesty,
    measured: {
      flashes,
      hook,
      mix,
      audio: audioAudit ? audioAudit.values : undefined,
      duration_s: dur
    },
    safe_zone_sheet: safeSheet,
    safe_profile: safeProfile,
    platform: brief?.platform || platform
  };
}

function parseArgs(argv) {
  const o = { input: null, project: null, platform: 'reels', safeProfile: DEFAULT_SAFE_PROFILE, json: false, strict: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input') o.input = argv[++i];
    else if (a === '--project') o.project = argv[++i];
    else if (a === '--platform') o.platform = argv[++i];
    else if (a === '--safe-profile') o.safeProfile = argv[++i];
    else if (a === '--json') o.json = true;
    else if (a === '--strict') o.strict = true;
  }
  return o;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.input) {
    console.error('Usage: qa_video.mjs --input <video.mp4> [--project <dir>] [--platform reels|shorts|tiktok] [--safe-profile universal|ads] [--json] [--strict]');
    process.exit(2);
  }
  const mp4 = path.resolve(o.input);
  const draft = o.project && fs.existsSync(path.join(o.project, 'cache', 'render_manifest.json'))
    ? Boolean(JSON.parse(fs.readFileSync(path.join(o.project, 'cache', 'render_manifest.json'), 'utf8')).draft)
    : false;
  const loud = measureIntegratedLufs(resolveBin('ffmpeg'), mp4);
  const report = runQa({
    mp4,
    projectDir: o.project ? path.resolve(o.project) : null,
    platform: o.platform,
    safeProfile: o.safeProfile,
    loudness: { integrated_lufs: loud.integrated_lufs, target_lufs: null, true_peak_dbtp: null },
    draftManifest: draft
  });
  console.log(o.json ? JSON.stringify(report, null, 2) : `QA ${report.verdict}${report.fails.length ? '\n - ' + report.fails.join('\n - ') : ''}${report.warns.length ? '\nwarnings:\n - ' + report.warns.join('\n - ') : ''}\nNOT VERIFIED (a human must judge):\n - ${report.unverified.join('\n - ')}`);
  if (o.strict && report.verdict !== 'SHIP') process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main();
}
