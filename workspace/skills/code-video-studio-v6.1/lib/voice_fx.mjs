// Voice post-processing with ffmpeg only (no samples, no network).
//  - whisperize: phase-randomised STFT (removes the voiced pitch, keeps the spectral envelope = breathy whisper),
//    band-limited, with a trace of the dry voice for intelligibility.
//  - applyTempo: pitch-preserving tempo change (atempo), used for slower horror delivery.
//  - assembleLines: place per-line clips at exact timeline offsets into one voiceover track.
// HONEST LIMIT: a processed whisper is not an acted whisper. Listen to it; if it sounds robotic, ask the TTS
// provider for a whisper style instead or re-record.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { resolveBin } from './runtime.mjs';

function ff(args) {
  const r = spawnSync(resolveBin('ffmpeg'), ['-v', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + String(r.stderr).slice(0, 400));
}

export const WHISPER_FILTER = [
  "[0:a]aformat=sample_rates=48000:channel_layouts=mono,asplit=2[w][d]",
  "[w]afftfilt=real='hypot(re,im)*cos(2*PI*random(0))':imag='hypot(re,im)*sin(2*PI*random(1))':win_size=256:overlap=0.75,highpass=f=350,lowpass=f=7500,volume=6dB[wh]",
  "[d]highpass=f=200,volume=-16dB[dry]",
  "[wh][dry]amix=inputs=2:normalize=0,alimiter=limit=0.89[out]"
].join(';');

export function whisperize(inPath, outPath) {
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  ff(['-i', inPath, '-filter_complex', WHISPER_FILTER, '-map', '[out]', '-ar', '48000', '-ac', '1', outPath]);
  return outPath;
}

export function applyTempo(inPath, outPath, tempo = 1.0) {
  const t = Math.min(2, Math.max(0.5, Number(tempo) || 1));
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  ff(['-i', inPath, '-af', `atempo=${t.toFixed(3)},aformat=sample_rates=48000:channel_layouts=mono`, '-ar', '48000', '-ac', '1', outPath]);
  return outPath;
}

export function probeDuration(p) {
  const r = spawnSync(resolveBin('ffprobe'), ['-v', 'quiet', '-print_format', 'json', '-show_format', p], { encoding: 'utf8' });
  return Number(JSON.parse(r.stdout || '{}').format?.duration) || 0;
}

// clips: [{ path, start_s }]. Output is mono 48 kHz WAV of exactly durationS.
export function assembleLines(clips, durationS, outPath) {
  if (!clips.length) throw new Error('assembleLines: no clips');
  const args = [];
  const chains = [];
  clips.forEach((c, i) => {
    args.push('-i', c.path);
    const ms = Math.max(0, Math.round(c.start_s * 1000));
    chains.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=mono,adelay=${ms}[c${i}]`);
  });
  const mix = clips.map((_, i) => `[c${i}]`).join('') + `amix=inputs=${clips.length}:normalize=0:duration=longest,apad,atrim=0:${durationS.toFixed(3)}[out]`;
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  ff([...args, '-filter_complex', chains.join(';') + ';' + mix, '-map', '[out]', '-ar', '48000', '-ac', '1', outPath]);
  return outPath;
}
