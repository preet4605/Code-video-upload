import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BUILTIN_SFX_NAMES,
  synthesizeSfxWav,
  generateBgmBed,
  buildAudioMixFilterGraph,
  resolveBgmSource,
  buildBgmVolumeExpression
} from '../lib/audio_sfx.mjs';
import { resolveBin } from '../lib/runtime.mjs';
import { makeTmpProject } from './_tmp_project.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = path.resolve(__dirname, '..');
const FFMPEG = resolveBin('ffmpeg');
const FFPROBE = resolveBin('ffprobe');
const tmpProjects = [];
after(() => {
  for (const t of tmpProjects) t.cleanup();
});

function assertValidWav(wavPath) {
  assert.ok(fs.existsSync(wavPath), `Missing WAV: ${wavPath}`);
  const buf = fs.readFileSync(wavPath);
  assert.ok(buf.length > 1000, `WAV too small: ${buf.length}`);
  assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(buf.subarray(8, 12).toString('ascii'), 'WAVE');

  const raw = execFileSync(
    FFPROBE,
    ['-v', 'quiet', '-print_format', 'json', '-show_streams', wavPath],
    { encoding: 'utf8' }
  );
  const probe = JSON.parse(raw);
  const a = probe.streams.find((s) => s.codec_type === 'audio');
  assert.ok(a, 'Expected audio stream');
  assert.equal(a.sample_rate, '48000');
  assert.equal(a.channels, 2);
}

test('synthesizeSfxWav produces valid 48 kHz stereo WAVs for all 17 built-in SFX', () => {
  assert.equal(BUILTIN_SFX_NAMES.length, 17);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_sfx_'));
  try {
    for (const name of BUILTIN_SFX_NAMES) {
      const outPath = path.join(tmpDir, `${name}.wav`);
      synthesizeSfxWav(FFMPEG, name, outPath);
      assertValidWav(outPath);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('generateBgmBed produces valid 3s stereo 48 kHz WAVs for horror and editorial-light', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_bgm_'));
  try {
    for (const mood of ['horror', 'editorial-light']) {
      const outPath = path.join(tmpDir, `bgm_${mood}.wav`);
      generateBgmBed(FFMPEG, { mood, durationS: 3, outPath });
      assertValidWav(outPath);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('buildAudioMixFilterGraph wires sidechaincompress, adelay, amix, acompressor, and loudnorm', () => {
  const { filterComplex, mapAudioLabel } = buildAudioMixFilterGraph({
    voiceInputIdx: 1,
    bgmInputIdx: 2,
    sfxEntries: [
      { inputIdx: 3, t_s: 1.2, gain_db: -4 },
      { inputIdx: 4, t_s: 4.5, gain_db: -6 }
    ],
    bgmGainDb: -16,
    targetLufs: -14,
    truePeak: -1.5,
    lra: 4,
    vocalPreset: true
  });

  assert.equal(mapAudioLabel, '[aout]');
  assert.ok(filterComplex.includes('sidechaincompress'));
  assert.ok(filterComplex.includes('adelay=1200|1200'));
  assert.ok(filterComplex.includes('amix=inputs=4:duration=first:normalize=0'));
  assert.ok(filterComplex.includes('acompressor'));
  assert.ok(filterComplex.includes('loudnorm=I=-14:TP=-1.5:LRA=4'));
});

test('End-to-end master_and_qa.mjs --preset reel-vocal --bgm auto --sfx-auto on smoke-horror-hi', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_reel_mix_'));
  const outMp4 = path.join(tmpDir, 'reel_mix.mp4');
  const proj = makeTmpProject('smoke-horror-hi');
  tmpProjects.push(proj);
  try {
    execFileSync(
      'node',
      [path.join(STUDIO_ROOT, 'scripts/render_and_lint.mjs'), '--project', proj.dir, '--reel-720', '--draft', '--json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const raw = execFileSync(
      'node',
      [
        path.join(STUDIO_ROOT, 'scripts/master_and_qa.mjs'),
        '--project', proj.dir,
        '--preset', 'reel-vocal',
        '--bgm', 'auto',
        '--sfx-auto',
        '--out', outMp4,
        '--json'
      ],
      { encoding: 'utf8' }
    );
    const report = JSON.parse(raw);
    assert.equal(report.ok, true);
    assert.equal(report.preset, 'reel-vocal');
    assert.equal(report.ffprobe.audio.sample_rate, '48000');
    assert.equal(report.audio_qa.pass, true);
    assert.ok(
      Math.abs(report.audio_qa.integrated_lufs - (-14)) <= 2.0,
      `Expected LUFS near -14, got ${report.audio_qa.integrated_lufs}`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Horror generateBgmBed is true stereo, byte-deterministic, and drops < 25% RMS before door_knock scare cue', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_horror_bgm_'));
  try {
    const timeline = {
      duration_s: 3.5,
      scenes: [
        { id: 's1', start_s: 0, end_s: 2.0, mood: 'suspense' },
        { id: 's2', start_s: 2.0, end_s: 3.5, mood: 'climax' }
      ],
      audio_cues: [{ type: 'sfx', name: 'door_knock', t_s: 2.5 }]
    };

    const p1 = path.join(tmpDir, 'horror1.wav');
    const p2 = path.join(tmpDir, 'horror2.wav');
    generateBgmBed(FFMPEG, { mood: 'horror', durationS: 3.5, outPath: p1, timeline });
    generateBgmBed(FFMPEG, { mood: 'horror', durationS: 3.5, outPath: p2, timeline });
    assertValidWav(p1);

    const b1 = fs.readFileSync(p1);
    const b2 = fs.readFileSync(p2);
    assert.equal(
      crypto.createHash('sha256').update(b1).digest('hex'),
      crypto.createHash('sha256').update(b2).digest('hex'),
      'Horror soundscape must be byte-deterministic'
    );

    const sr = 48000;
    const pcm = new Int16Array(b1.buffer, b1.byteOffset + 44, (b1.length - 44) / 2);
    let stereoDiffs = 0;
    for (let i = 0; i < pcm.length; i += 2) {
      if (pcm[i] !== pcm[i + 1]) stereoDiffs++;
    }
    assert.ok(stereoDiffs > pcm.length * 0.1, 'Expected true stereo L !== R');

    const rmsRange = (t0, t1) => {
      const i0 = Math.floor(t0 * sr);
      const i1 = Math.min(pcm.length / 2, Math.floor(t1 * sr));
      let sumSq = 0;
      for (let idx = i0; idx < i1; idx++) {
        const l = pcm[idx * 2] / 32767;
        const r = pcm[idx * 2 + 1] / 32767;
        sumSq += 0.5 * (l * l + r * r);
      }
      return Math.sqrt(sumSq / Math.max(1, i1 - i0));
    };

    const rmsNormal = rmsRange(0.5, 1.5);
    const rmsSilenceDrop = rmsRange(1.95, 2.40);
    assert.ok(rmsNormal > 0.01, `Expected audible normal bed RMS, got ${rmsNormal}`);
    assert.ok(
      rmsSilenceDrop < rmsNormal * 0.25,
      `Expected pre-scare silence drop RMS (${rmsSilenceDrop.toFixed(4)}) < 25% of normal RMS (${rmsNormal.toFixed(4)})`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('buildBgmVolumeExpression emits eval=frame volume filter and resolveBgmSource falls back to auto', () => {
  const tl = {
    scenes: [
      { id: 's1', start_s: 0, end_s: 2.0, mood: 'calm' },
      { id: 's2', start_s: 2.0, end_s: 5.0, mood: 'climax' }
    ],
    audio_cues: [{ type: 'sfx', name: 'violin_stinger', t_s: 3.5 }]
  };
  const volExpr = buildBgmVolumeExpression(tl);
  assert.ok(volExpr.startsWith("volume='") && volExpr.endsWith("':eval=frame"));
  assert.ok(volExpr.includes('between(t,'));
  assert.ok(volExpr.includes('0.05'));

  const resolved = resolveBgmSource('library', 'horror');
  assert.equal(resolved.mode, 'auto');
  assert.equal(resolved.path, null);
});

test('whisper_gust produces warm, gentle low-mid stereo air breeze without harsh high-freq screech', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_whisper_'));
  try {
    const p1 = path.join(tmpDir, 'whisper1.wav');
    const p2 = path.join(tmpDir, 'whisper2.wav');
    synthesizeSfxWav(FFMPEG, 'whisper_gust', p1);
    synthesizeSfxWav(FFMPEG, 'whisper_gust', p2);
    assertValidWav(p1);

    const b1 = fs.readFileSync(p1);
    const b2 = fs.readFileSync(p2);
    assert.equal(
      crypto.createHash('sha256').update(b1).digest('hex'),
      crypto.createHash('sha256').update(b2).digest('hex'),
      'whisper_gust must be deterministic'
    );

    const pcm = new Int16Array(b1.buffer, b1.byteOffset + 44, (b1.length - 44) / 2);
    let sumSq = 0;
    let diffSq = 0;
    let peak = 0;
    let prevMono = 0;
    const frames = pcm.length / 2;
    for (let i = 0; i < frames; i++) {
      const l = pcm[i * 2] / 32767;
      const r = pcm[i * 2 + 1] / 32767;
      assert.ok(Number.isFinite(l) && Number.isFinite(r));
      const mono = 0.5 * (l + r);
      sumSq += mono * mono;
      if (i > 0) {
        const d = mono - prevMono;
        diffSq += d * d;
      }
      prevMono = mono;
      peak = Math.max(peak, Math.abs(l), Math.abs(r));
    }

    const rms = Math.sqrt(sumSq / frames);
    const diffRms = Math.sqrt(diffSq / Math.max(1, frames - 1));
    const highFreqRatio = diffRms / Math.max(1e-9, rms);

    assert.ok(rms > 0.001 && rms < 0.08, `Expected gentle non-zero RMS in (0.001..0.08), got ${rms}`);
    assert.ok(peak > 0.005 && peak < 0.35, `Expected gentle peak < 0.35, got ${peak}`);
    assert.ok(highFreqRatio < 0.14, `Expected warm low-mid spectral ratio < 0.14, got ${highFreqRatio}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
