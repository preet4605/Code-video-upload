#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  synthesizeSfxWav,
  generateBgmBed,
  buildAudioMixFilterGraph,
  resolveSfxName,
  resolveBgmSource
} from '../lib/audio_sfx.mjs';
import { resolveBin } from '../lib/runtime.mjs';
import { videoEncodeArgs, colorFilter } from '../lib/encode.mjs';
import { runQa, measureIntegratedLufs } from './qa_video.mjs';
import { DEFAULT_SAFE_PROFILE } from '../lib/profiles.mjs';
import { runHorrorVisualGate } from '../lib/horror_gate.mjs';
import { generateHorrorBed } from './horror_sound.mjs';
import { lintStoryProject } from '../lib/story_lint.mjs';
import { runHorrorMeasuredGate } from '../lib/horror_measure.mjs';
import { runScriptGate } from './script_gate.mjs';
import { GENRE_AUDIO_MOOD } from '../lib/voices.mjs';

export { buildAudioMixFilterGraph };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = {
    project: null,
    input: null,
    start: null,
    end: null,
    lufs: null,
    tp: null,
    subtitles: null,
    bgm: null,
    bgmGain: null,
    linearLoudness: null,
    sfxAuto: false,
    preset: 'default',
    audioMood: 'none',
    noStreamCopy: false,
    out: null,
    dryRun: false,
    json: false,
    platform: 'reels',
    safeProfile: DEFAULT_SAFE_PROFILE,
    strict: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') opts.project = argv[++i];
    else if (a === '--input') opts.input = argv[++i];
    else if (a === '--start') opts.start = Number(argv[++i]);
    else if (a === '--end') opts.end = Number(argv[++i]);
    else if (a === '--lufs') opts.lufs = Number(argv[++i]);
    else if (a === '--tp') opts.tp = Number(argv[++i]);
    else if (a === '--subtitles') opts.subtitles = argv[++i];
    else if (a === '--bgm') opts.bgm = argv[++i];
    else if (a === '--bgm-gain') opts.bgmGain = Number(argv[++i]);
    else if (a === '--linear-loudness') opts.linearLoudness = true;
    else if (a === '--sfx-auto') opts.sfxAuto = true;
    else if (a === '--preset') opts.preset = argv[++i];
    else if (a === '--audio-mood') opts.audioMood = argv[++i];
    else if (a === '--no-stream-copy') opts.noStreamCopy = true;
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--platform') opts.platform = argv[++i];
    else if (a === '--safe-profile') opts.safeProfile = argv[++i];
    else if (a === '--strict') opts.strict = true;
  }
  return opts;
}

function escapeFilterPath(p) {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

function buildAssFilter(subtitlesOpt) {
  if (!subtitlesOpt) return '';
  const resolvedSub = path.resolve(subtitlesOpt);
  const fontsDir = path.join(STUDIO_ROOT, 'fonts');
  const escapedPath = escapeFilterPath(resolvedSub);
  const escapedFontsDir = escapeFilterPath(fontsDir);
  return `,ass='${escapedPath}':fontsdir='${escapedFontsDir}'`;
}

export function evaluateMasterQa({ vStream, aStream, contactSheetExists, loud, targetLufs, truePeak }) {
  const peakPass =
    loud &&
    loud.true_peak_dbtp !== null &&
    Number.isFinite(loud.true_peak_dbtp) &&
    loud.true_peak_dbtp <= truePeak + 0.3;
  const lufsPass =
    loud &&
    loud.integrated_lufs !== null &&
    Number.isFinite(loud.integrated_lufs) &&
    (loud.integrated_lufs <= -60 || Math.abs(loud.integrated_lufs - targetLufs) <= 2.0);
  const loudPass = Boolean(peakPass && lufsPass);

  const qaPass = Boolean(
    vStream && vStream.codec_name === 'h264' && vStream.pix_fmt === 'yuv420p' &&
    aStream && aStream.codec_name === 'aac' && aStream.sample_rate === '48000' &&
    contactSheetExists &&
    loudPass
  );

  return { qaPass, loudPass, peakPass: Boolean(peakPass), lufsPass: Boolean(lufsPass) };
}

export function measureLoudness(ffmpegBin, mediaPath) {
  const res = spawnSync(ffmpegBin, ['-i', mediaPath, '-af', 'ebur128=peak=true', '-f', 'null', '-'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const log = res.stderr || '';
  const iMatches = [...log.matchAll(/I:\s*([-\d.]+)\s*LUFS/g)];
  const pMatches = [...log.matchAll(/Peak:\s*([-\d.]+)\s*dBFS/g)];

  const integrated_lufs = iMatches.length > 0 ? Number(iMatches[iMatches.length - 1][1]) : null;
  const true_peak_dbtp = pMatches.length > 0 ? Number(pMatches[pMatches.length - 1][1]) : null;
  return { integrated_lufs, true_peak_dbtp };
}

function probeMedia(ffprobeBin, mediaPath) {
  const raw = execFileSync(ffprobeBin, [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    mediaPath
  ], { encoding: 'utf8' });
  return JSON.parse(raw);
}

function runFastPath(opts, ffmpeg, ffprobe) {
  const inputPath = path.resolve(opts.input);
  const parsed = path.parse(inputPath);
  const outMp4 = opts.out ? path.resolve(opts.out) : path.join(parsed.dir, `${parsed.name}_master.mp4`);
  const outDir = path.dirname(outMp4);
  const contactSheet = path.join(outDir, 'qa_contact_sheet.png');
  const targetLufs = opts.lufs ?? -16;
  const truePeak = opts.tp ?? -1.5;
  const assFilter = buildAssFilter(opts.subtitles);

  const trimArgs = [];
  if (typeof opts.start === 'number' && !Number.isNaN(opts.start)) trimArgs.push('-ss', String(opts.start));
  if (typeof opts.end === 'number' && !Number.isNaN(opts.end)) trimArgs.push('-to', String(opts.end));

  const ffmpegEncodeArgs = [
    '-y',
    ...trimArgs,
    '-i', inputPath,
    '-vf', `${colorFilter()}${assFilter}`,
    '-af', `loudnorm=I=${targetLufs}:TP=${truePeak}:LRA=11`,
    '-pix_fmt', 'yuv420p', ...videoEncodeArgs({ fps: 30 }),
    '-c:a', 'aac', '-ar', '48000', '-b:a', '192k',
    '-movflags', '+faststart',
    outMp4
  ];

  if (opts.dryRun) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      mode: 'fast-path',
      input: inputPath,
      outMp4,
      contactSheet,
      targetLufs,
      truePeak,
      subtitles: opts.subtitles ? path.resolve(opts.subtitles) : null,
      plannedCommand: [ffmpeg, ...ffmpegEncodeArgs]
    }, null, 2));
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  execFileSync(ffmpeg, ffmpegEncodeArgs, { stdio: 'pipe' });

  const probe = probeMedia(ffprobe, outMp4);
  const vStream = probe.streams.find((s) => s.codec_type === 'video');
  const aStream = probe.streams.find((s) => s.codec_type === 'audio');
  const nbFrames = Number(vStream?.nb_frames) || Math.max(6, Math.round(Number(probe.format.duration || 6) * 30));
  const tileStep = Math.max(1, Math.floor(nbFrames / 6));

  execFileSync(ffmpeg, [
    '-y',
    '-i', outMp4,
    '-vf', `select='not(mod(n,${tileStep}))',scale=360:-1,tile=3x2`,
    '-frames:v', '1',
    contactSheet
  ], { stdio: 'pipe' });

  const loud = measureLoudness(ffmpeg, outMp4);
  const { qaPass, loudPass } = evaluateMasterQa({
    vStream,
    aStream,
    contactSheetExists: fs.existsSync(contactSheet),
    loud,
    targetLufs,
    truePeak
  });

  const report = {
    ok: qaPass,
    mode: 'fast-path',
    outMp4,
    contactSheet,
    audio_qa: {
      integrated_lufs: loud.integrated_lufs,
      target_lufs: targetLufs,
      lufs_tolerance_lu: 2.0,
      true_peak_dbtp: loud.true_peak_dbtp,
      true_peak_limit_dbtp: truePeak,
      pass: loudPass
    },
    ffprobe: {
      duration: Number(probe.format.duration),
      size_bytes: Number(probe.format.size),
      video: vStream ? { codec: vStream.codec_name, pix_fmt: vStream.pix_fmt, width: vStream.width, height: vStream.height } : null,
      audio: aStream ? { codec: aStream.codec_name, sample_rate: aStream.sample_rate } : null
    }
  };

  const ship = runQa({
    mp4: outMp4,
    projectDir: null,
    platform: opts.platform,
    safeProfile: opts.safeProfile,
    loudness: { integrated_lufs: loud.integrated_lufs, target_lufs: targetLufs, true_peak_dbtp: loud.true_peak_dbtp, true_peak_limit_dbtp: truePeak }
  });
  report.verdict = ship.verdict;
  report.ship = ship;

  console.log(opts.json ? JSON.stringify(report, null, 2) : `MASTER QA ${qaPass ? 'PASS' : 'FAIL'} | VERDICT ${ship.verdict}: ${outMp4}`);
  if (!qaPass) process.exit(1);
  if (opts.strict && ship.verdict !== 'SHIP') process.exit(1);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const ffmpeg = resolveBin('ffmpeg');
  const ffprobe = resolveBin('ffprobe');

  if (opts.input) {
    return runFastPath(opts, ffmpeg, ffprobe);
  }

  if (!opts.project) {
    console.error('Usage: master_and_qa.mjs (--project <dir> | --input <video.mp4>) [--start <s>] [--end <s>] [--lufs <I>] [--tp <dBTP>] [--subtitles <file.ass>] [--out <file.mp4>] [--dry-run] [--json]');
    process.exit(2);
  }

  const projectDir = path.resolve(opts.project);
  const timeline = JSON.parse(fs.readFileSync(path.join(projectDir, 'timeline.json'), 'utf8'));
  const manifestPath = path.join(projectDir, 'cache', 'render_manifest.json');
  const hasManifest = fs.existsSync(manifestPath);

  if (!hasManifest && !opts.dryRun) {
    throw new Error(`Missing render_manifest.json at ${manifestPath}. Run render_and_lint.mjs first.`);
  }

  const manifest = hasManifest
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : {
        width: timeline.width,
        height: timeline.height,
        fps: timeline.fps,
        scenes: []
      };

  const outDir = path.join(projectDir, 'out');
  const outMp4 = opts.out ? path.resolve(opts.out) : path.join(outDir, `${timeline.slug}.mp4`);
  const contactSheet = path.join(outDir, 'qa_contact_sheet.png');

  const canStreamCopy =
    !opts.noStreamCopy &&
    !opts.subtitles &&
    manifest.scenes.length > 0 &&
    manifest.scenes.every((s) => s.segmentPath && fs.existsSync(s.segmentPath));
  const stitchMode = canStreamCopy ? 'stream-copy' : 'png-reencode';

  const concatTxt = path.join(projectDir, 'cache', 'frames_concat.txt');
  const segmentsConcatTxt = path.join(projectDir, 'cache', 'segments_concat.txt');
  const segmentLines = canStreamCopy
    ? manifest.scenes.map((s) => `file '${String(s.segmentPath).replace(/'/g, "'\\''")}'`)
    : [];

  const frameDur = (1 / manifest.fps).toFixed(6);
  const lines = [];
  let totalFrames = 0;
  for (const s of manifest.scenes) {
    if (!canStreamCopy) {
      for (let i = 0; i < s.frameCount; i++) {
        const fp = path.join(s.cacheDir, `frame_${String(i).padStart(6, '0')}.png`);
        lines.push(`file '${fp.replace(/'/g, "'\\''")}'`);
        lines.push(`duration ${frameDur}`);
      }
    }
    totalFrames += s.frameCount;
  }
  if (!canStreamCopy && manifest.scenes.length > 0) {
    const last = manifest.scenes[manifest.scenes.length - 1];
    const lastFp = path.join(last.cacheDir, `frame_${String(last.frameCount - 1).padStart(6, '0')}.png`);
    lines.push(`file '${lastFp.replace(/'/g, "'\\''")}'`);
  } else if (manifest.scenes.length === 0) {
    totalFrames = Math.round(timeline.duration_s * manifest.fps);
  }

  const isReelVocal = opts.preset === 'reel-vocal';
  const targetLufs = opts.lufs ?? (isReelVocal ? -14 : (timeline.target_lufs ?? -16));
  const truePeak = opts.tp ?? (isReelVocal ? -1.5 : (timeline.true_peak_dbtp ?? -1.5));
  const lra = isReelVocal ? 4 : 11;
  const vocalPreset = isReelVocal;
  const durationS = timeline.duration_s;
  const assFilter = buildAssFilter(opts.subtitles);

  const hasAudioFile = timeline.audio_file && fs.existsSync(path.join(projectDir, timeline.audio_file));
  const rawMood = String(opts.audioMood || 'none').toLowerCase().trim();
  let audioMood = rawMood || 'none';
  if (audioMood === 'auto') {
    let briefGenre = null;
    try {
      briefGenre = JSON.parse(fs.readFileSync(path.join(projectDir, 'brief.json'), 'utf8')).genre || null;
    } catch {
      // no brief: fall back to scene mood below
    }
    if (briefGenre && GENRE_AUDIO_MOOD[briefGenre]) audioMood = GENRE_AUDIO_MOOD[briefGenre];
  }
  if (audioMood === 'auto') {
    const sceneMood = String(timeline.scenes?.[0]?.mood || 'none').toLowerCase().trim();
    if (sceneMood === 'suspense' || sceneMood === 'climax' || sceneMood === 'horror') audioMood = 'horror';
    else if (sceneMood === 'energetic' || sceneMood === 'editorial') audioMood = 'editorial';
    else if (sceneMood === 'calm' || sceneMood === 'vintage') audioMood = 'vintage';
    else if (sceneMood === 'science-doc' || sceneMood === 'documentary') audioMood = 'documentary';
    else audioMood = 'none';
  }
  const useMultiTrack = Boolean(opts.bgm || opts.sfxAuto || isReelVocal || audioMood !== 'none');

  let ffmpegEncodeArgs;
  let placeholderAudio = false;
  let bgmPath = null;
  let horrorBed = null;
  let sfxEntries = [];
  let briefForAudio = {};
  try { briefForAudio = JSON.parse(fs.readFileSync(path.join(projectDir, 'brief.json'), 'utf8')); } catch { /* none */ }
  const isHorror = briefForAudio.genre === 'horror';
  const useLinear = opts.linearLoudness === true || (opts.linearLoudness !== false && isHorror);
  const bgmGainDb = Number.isFinite(opts.bgmGain) ? opts.bgmGain : (opts.bgm === 'horror' ? -8 : -16);
  const videoInputArgs = canStreamCopy
    ? ['-f', 'concat', '-safe', '0', '-i', segmentsConcatTxt]
    : ['-f', 'concat', '-safe', '0', '-i', concatTxt];
  const videoCodecArgs = canStreamCopy
    ? ['-c:v', 'copy']
    : ['-vf', `fps=${manifest.fps},${colorFilter()}${assFilter}`, '-pix_fmt', 'yuv420p', ...videoEncodeArgs({ fps: manifest.fps })];

  if (!useMultiTrack) {
    placeholderAudio = !hasAudioFile;
    const audioInputArgs = hasAudioFile
      ? ['-i', path.join(projectDir, timeline.audio_file)]
      : ['-f', 'lavfi', '-t', String(durationS), '-i', 'sine=frequency=220:sample_rate=48000'];
    const audioFilter = hasAudioFile
      ? `loudnorm=I=${targetLufs}:TP=${truePeak}:LRA=${lra}`
      : `volume=-26dB,afade=t=in:st=0:d=0.5,afade=t=out:st=${Math.max(0, durationS - 0.5)}:d=0.5,loudnorm=I=${targetLufs}:TP=${truePeak}:LRA=${lra}`;

    ffmpegEncodeArgs = [
      '-y',
      ...videoInputArgs,
      ...audioInputArgs,
      '-map', '0:v', '-map', '1:a',
      ...videoCodecArgs,
      '-af', audioFilter,
      '-c:a', 'aac', '-ar', '48000', '-b:a', '192k',
      '-movflags', '+faststart',
      '-shortest',
      outMp4
    ];
  } else {
    const extraInputs = [];
    let nextInputIdx = 1;
    let voiceInputIdx = null;
    let bgmInputIdx = null;

    if (hasAudioFile) {
      extraInputs.push('-i', path.join(projectDir, timeline.audio_file));
      voiceInputIdx = nextInputIdx++;
    }

    const sfxDir = path.join(projectDir, 'cache', 'sfx');
    let applyExternalTension = false;
    if (opts.bgm === 'horror') {
      // Designed bed from the timeline; it already contains the foley/stingers, so preset SFX are skipped.
      fs.mkdirSync(sfxDir, { recursive: true });
      const rep = generateHorrorBed(projectDir, path.join(sfxDir, 'horror_bed.wav'));
      bgmPath = rep.out;
      horrorBed = rep;
      extraInputs.push('-i', bgmPath);
      bgmInputIdx = nextInputIdx++;
    } else if (opts.bgm) {
      const mood = (timeline.scenes && timeline.scenes[0]?.mood) || 'horror';
      const bgmResolved = resolveBgmSource(opts.bgm, mood);
      if (bgmResolved.mode === 'auto') {
        bgmPath = path.join(sfxDir, `bgm_${mood}.wav`);
        if (!opts.dryRun) {
          generateBgmBed(ffmpeg, { mood, durationS, outPath: bgmPath, timeline });
        }
      } else if (bgmResolved.mode === 'file') {
        bgmPath = bgmResolved.path;
        applyExternalTension = true;
      }
      if (bgmPath) {
        extraInputs.push('-i', bgmPath);
        bgmInputIdx = nextInputIdx++;
      }
    }

    if (opts.sfxAuto && opts.bgm !== 'horror') {
      const sfxCues = (timeline.audio_cues || []).filter(
        (c) => c.type === 'sfx' && typeof c.t_s === 'number' && c.t_s >= 0 && c.t_s <= durationS
      );
      const uniquePaths = new Map();
      for (const cue of sfxCues) {
        const canonical = resolveSfxName(cue.name);
        let wavPath = uniquePaths.get(canonical);
        if (!wavPath) {
          wavPath = path.join(sfxDir, `${canonical}.wav`);
          if (!opts.dryRun) {
            synthesizeSfxWav(ffmpeg, canonical, wavPath);
          }
          uniquePaths.set(canonical, wavPath);
        }
        extraInputs.push('-i', wavPath);
        sfxEntries.push({ inputIdx: nextInputIdx++, t_s: cue.t_s, gain_db: cue.gain_db ?? -4 });
      }
    }

    if (voiceInputIdx === null && bgmInputIdx === null && sfxEntries.length === 0) {
      extraInputs.push('-f', 'lavfi', '-t', String(durationS), '-i', 'sine=frequency=220:sample_rate=48000');
      voiceInputIdx = nextInputIdx++;
      placeholderAudio = true;
    }

    const graphArgs = {
      voiceInputIdx,
      bgmInputIdx,
      sfxEntries,
      bgmGainDb,
      targetLufs,
      truePeak,
      lra,
      vocalPreset,
      audioMood,
      timeline,
      applyExternalTension: applyExternalTension && opts.bgm !== 'horror'
    };
    let linearGainDb = null;
    if (useLinear && !opts.dryRun) {
      // Pass 1: render the raw mix (no normalisation), measure it, then apply ONE fixed gain + limiter.
      // Dynamic loudnorm would pull a designed -20 dB pre-scare drop back up.
      const pre = buildAudioMixFilterGraph({ ...graphArgs, measureOnly: true });
      const rawMix = path.join(projectDir, 'cache', 'mix_raw.wav');
      fs.mkdirSync(path.dirname(rawMix), { recursive: true });
      execFileSync(ffmpeg, ['-y', ...extraInputs, '-filter_complex', pre.filterComplex.replace(/\[(\d+):a\]/g, (m, n) => `[${Number(n) - 1}:a]`), '-map', pre.mapAudioLabel, '-t', String(durationS), '-ar', '48000', rawMix], { stdio: 'pipe' });
      const I = measureIntegratedLufs(ffmpeg, rawMix).integrated_lufs;
      linearGainDb = Number.isFinite(I) ? Math.max(-30, Math.min(30, targetLufs - I)) : 0;
    }
    const { filterComplex, mapAudioLabel } = buildAudioMixFilterGraph({ ...graphArgs, linearGainDb });

    ffmpegEncodeArgs = [
      '-y',
      ...videoInputArgs,
      ...extraInputs,
      '-filter_complex', filterComplex,
      '-map', '0:v', '-map', mapAudioLabel,
      ...videoCodecArgs,
      '-c:a', 'aac', '-ar', '48000', '-b:a', '192k',
      '-movflags', '+faststart',
      '-shortest',
      outMp4
    ];
  }

  if (opts.dryRun) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      manifestPresent: hasManifest,
      stitch_mode: stitchMode,
      outMp4,
      contactSheet,
      totalFrames,
      targetLufs,
      truePeak,
      preset: opts.preset,
      audioMood,
      bgm: bgmPath,
      sfxCount: sfxEntries.length,
      subtitles: opts.subtitles ? path.resolve(opts.subtitles) : null,
      plannedCommand: [ffmpeg, ...ffmpegEncodeArgs]
    }, null, 2));
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'cache'), { recursive: true });
  if (canStreamCopy) {
    fs.writeFileSync(segmentsConcatTxt, segmentLines.join('\n') + '\n');
  } else {
    fs.writeFileSync(concatTxt, lines.join('\n') + '\n');
  }

  execFileSync(ffmpeg, ffmpegEncodeArgs, { stdio: 'pipe' });

  let loud = measureLoudness(ffmpeg, outMp4);
  let loudnessRetries = 0;
  const needsPeakRetry = (m) =>
    m &&
    m.true_peak_dbtp !== null &&
    Number.isFinite(m.true_peak_dbtp) &&
    (isReelVocal ? m.true_peak_dbtp > truePeak : m.true_peak_dbtp > truePeak + 0.3);

  for (let attempt = 1; attempt <= 2 && needsPeakRetry(loud); attempt++) {
    loudnessRetries = attempt;
    const retryTp = Number((truePeak - attempt * 0.4).toFixed(2));
    const tmpOut = path.join(outDir, `${path.parse(outMp4).name}.retry_${attempt}.tmp.mp4`);
    try {
      execFileSync(
        ffmpeg,
        [
          '-y',
          '-i', outMp4,
          '-c:v', 'copy',
          '-af', useLinear ? `alimiter=limit=${Math.pow(10, (retryTp - 0.6) / 20).toFixed(4)}:attack=1:release=60:level=disabled` : `loudnorm=I=${targetLufs}:TP=${retryTp}:LRA=${lra}`,
          '-c:a', 'aac', '-ar', '48000', '-b:a', '192k',
          '-movflags', '+faststart',
          '-f', 'mp4',
          tmpOut
        ],
        { stdio: 'pipe' }
      );
      fs.renameSync(tmpOut, outMp4);
      loud = measureLoudness(ffmpeg, outMp4);
    } finally {
      if (fs.existsSync(tmpOut)) fs.rmSync(tmpOut, { force: true });
    }
  }

  const scenesList = Array.isArray(timeline.scenes) ? timeline.scenes : [];
  let contactTimestamps;
  if (scenesList.length >= 2 && scenesList.length <= 12) {
    contactTimestamps = scenesList.map((sc) =>
      Math.max(0, Math.min(Math.max(0, durationS - 0.05), (sc.start_s + sc.end_s) / 2))
    );
  } else {
    const tileCount = Math.min(12, Math.max(6, scenesList.length || 6));
    contactTimestamps = Array.from({ length: tileCount }, (_, i) =>
      ((i + 0.5) / tileCount) * Math.max(0.5, durationS)
    );
  }
  const frameSet = [];
  for (const ts of contactTimestamps) {
    let fIdx = Math.min(Math.max(0, totalFrames - 1), Math.round(ts * manifest.fps));
    while (frameSet.includes(fIdx) && fIdx + 1 < totalFrames) fIdx++;
    if (!frameSet.includes(fIdx)) frameSet.push(fIdx);
  }
  frameSet.sort((a, b) => a - b);
  const cols = Math.min(4, Math.max(1, frameSet.length));
  const rows = Math.ceil(Math.max(1, frameSet.length) / cols);
  const selectExpr = frameSet.map((f) => `eq(n\\,${f})`).join('+') || 'eq(n\\,0)';
  execFileSync(ffmpeg, [
    '-y',
    '-i', outMp4,
    '-vf', `select='${selectExpr}',scale=360:-1,tile=${cols}x${rows}`,
    '-fps_mode', 'vfr',
    '-frames:v', '1',
    contactSheet
  ], { stdio: 'pipe' });

  const probe = probeMedia(ffprobe, outMp4);
  const vStream = probe.streams.find((s) => s.codec_type === 'video');
  const aStream = probe.streams.find((s) => s.codec_type === 'audio');
  const { qaPass, loudPass } = evaluateMasterQa({
    vStream,
    aStream,
    contactSheetExists: fs.existsSync(contactSheet),
    loud,
    targetLufs,
    truePeak
  });

  // Measured QA on the rendered MP4 + voice-vs-bed level check -> SHIP / FIX verdict
  let mix = null;
  if (hasAudioFile && bgmPath && fs.existsSync(bgmPath)) {
    const vo = measureIntegratedLufs(ffmpeg, path.join(projectDir, timeline.audio_file)).integrated_lufs;
    const bed = measureIntegratedLufs(ffmpeg, bgmPath).integrated_lufs;
    if (vo !== null && bed !== null) mix = { vo_lufs: vo, bed_gain_db: bgmGainDb, bed_lufs_after_gain: Number((bed + bgmGainDb).toFixed(1)), vo_to_bed_lu: Number((vo - (bed + bgmGainDb)).toFixed(1)) };
  }
  const ship = runQa({
    mp4: outMp4,
    projectDir,
    platform: opts.platform,
    safeProfile: opts.safeProfile,
    loudness: { integrated_lufs: loud.integrated_lufs, target_lufs: targetLufs, true_peak_dbtp: loud.true_peak_dbtp, true_peak_limit_dbtp: truePeak },
    mix,
    placeholderAudio,
    draftManifest: Boolean(manifest.draft)
  });
  // Horror craft gates: script heuristics + critique, shotlist, measured per-scene visuals.
  let briefObj = {};
  try { briefObj = JSON.parse(fs.readFileSync(path.join(projectDir, 'brief.json'), 'utf8')); } catch { /* no brief */ }
  if (briefObj.genre === 'horror') {
    const smoke = briefObj.smoke_test === true;
    const sg = fs.existsSync(path.join(projectDir, 'script.txt')) || !smoke ? runScriptGate(projectDir, 'script') : { pass: true, fails: [], warns: ['[smoke] no script.txt'] };
    const vg = runHorrorVisualGate({ mp4: outMp4, projectDir, writeSheet: true });
    // A narrated script with no real voice track is not shippable: timing is only an estimate.
    if (!timeline.audio_file && briefObj.silent !== true && fs.existsSync(path.join(projectDir, 'script.txt'))) {
      vg.fails.push(`no voiceover: script.txt has narration but timeline.audio_file is empty (alignment ${timeline.alignment?.method || 'wpm-estimate'}). Generate TTS (audio_timeline --tts auto) and re-render, or set brief.silent=true for a captions-only reel`);
    }
    const st = lintStoryProject(projectDir);
    const hm = runHorrorMeasuredGate({ mp4: outMp4, projectDir });
    if (!smoke) {
      vg.fails.push(...hm.fails);
      sg.fails.push(...st.errors.filter((e) => !sg.fails.includes(e)));
    }
    vg.warns.push(...hm.warns);
    sg.warns.push(...(st.warns || []));
    const tag = (arr, p) => arr.map((x) => `${p}${smoke ? '[smoke] ' : ''}${x}`);
    ship.horror = { script: { pass: sg.fails.length === 0, fails: sg.fails, warns: sg.warns }, story: { format: st.format || null, errors: st.errors || [], warns: st.warns || [] }, measured: { per_scene: hm.per_scene, dark_share: hm.dark_share, scares: hm.scares, note: hm.note }, visual: { pass: vg.fails.length === 0, fails: vg.fails, warns: vg.warns, per_scene: vg.perScene, escalation: vg.escalation, scene_sheet: vg.sheet } };
    ship.warns.push('horror: SHIP means no measured defect was found. It does not measure fear; watch it with sound on a phone in a dark room.');
    if (smoke) {
      ship.warns.push(...tag(sg.fails, 'horror-script: '), ...tag(vg.warns, 'horror-visual: '));
    } else {
      ship.fails.push(...tag(sg.fails, 'horror-script: '), ...tag(vg.fails, 'horror-visual: '));
      ship.warns.push(...tag(sg.warns, 'horror-script: '), ...tag(vg.warns, 'horror-visual: '));
      if (sg.fails.length || vg.fails.length) ship.verdict = 'FIX';
    }
  }
  // Visual self-improvement loop status (scripts/visual_loop.mjs). Missing -> warning; run but not converged -> FIX.
  try {
    const vlog = JSON.parse(fs.readFileSync(path.join(projectDir, 'visual_loop', 'log.json'), 'utf8'));
    const last = vlog.iterations[vlog.iterations.length - 1];
    ship.visual_loop = { iterations: vlog.iterations.length, last_pass: last?.pass ?? false, critique_min: last?.critique_min ?? null, mean_score: last?.mean_score ?? null };
    if (!(last && last.pass && (last.critique_min ?? 0) >= 3)) {
      ship.fails.push(`visual-loop: not converged (iteration ${last?.iter}: metrics ${last?.pass ? 'pass' : 'fail'}, critique min ${last?.critique_min ?? 'missing'}). Run scripts/visual_loop.mjs until LOOP PASS`);
      ship.verdict = 'FIX';
    }
  } catch {
    ship.warns.push('visual-loop: not run. Run scripts/visual_loop.mjs --project <dir> and iterate until LOOP PASS (references/visual-loop.md)');
  }
  fs.writeFileSync(path.join(outDir, 'qa_report.json'), JSON.stringify(ship, null, 2));

  const report = {
    ok: qaPass,
    verdict: ship.verdict,
    ship,
    stitch_mode: stitchMode,
    outMp4,
    horror_bed: horrorBed,
    loudness_mode: useLinear ? 'linear (gain + limiter)' : 'loudnorm',
    contactSheet,
    preset: opts.preset,
    audioMood,
    bgm: bgmPath,
    sfxCount: sfxEntries.length,
    audio_qa: {
      integrated_lufs: loud.integrated_lufs,
      target_lufs: targetLufs,
      lufs_tolerance_lu: 2.0,
      true_peak_dbtp: loud.true_peak_dbtp,
      true_peak_limit_dbtp: truePeak,
      loudness_retries: loudnessRetries,
      pass: loudPass
    },
    ffprobe: {
      duration: Number(probe.format.duration),
      size_bytes: Number(probe.format.size),
      video: vStream ? { codec: vStream.codec_name, pix_fmt: vStream.pix_fmt, width: vStream.width, height: vStream.height } : null,
      audio: aStream ? { codec: aStream.codec_name, sample_rate: aStream.sample_rate } : null
    }
  };

  console.log(opts.json ? JSON.stringify(report, null, 2) : `MASTER QA ${qaPass ? 'PASS' : 'FAIL'} | VERDICT ${ship.verdict}: ${outMp4}${ship.fails.length ? '\n - ' + ship.fails.join('\n - ') : ''}`);
  if (!qaPass) process.exit(1);
  if (opts.strict && ship.verdict !== 'SHIP') process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main();
}
