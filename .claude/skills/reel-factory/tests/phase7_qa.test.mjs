import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveBin } from '../lib/runtime.mjs';
import { SAFE_PROFILES, getSafeProfile, QA_THRESHOLDS } from '../lib/profiles.mjs';
import { SAFE_ZONE_916 } from '../lib/widgets.mjs';
import { videoEncodeArgs, colorFilter } from '../lib/encode.mjs';
import { lintDirection } from '../lib/direction_lint.mjs';
import {
  countFlashes,
  parseSignalstatsYavg,
  parseFreezedetect,
  parseBlackdetect,
  parseSilencedetect,
  runQa,
  evaluateQa
} from '../scripts/qa_video.mjs';

const ffmpeg = resolveBin('ffmpeg');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-qa-'));
const ENC = [...videoEncodeArgs({ fps: 30 }), '-pix_fmt', 'yuv420p'];

function mk(name, { w = 1080, h = 1920, vf, audio = 'tone', dur = 6 } = {}) {
  const out = path.join(TMP, name);
  const vsrc = vf || `testsrc2=s=${w}x${h}:r=30:d=${dur}`;
  const audioIn = audio === 'tone'
    ? ['-f', 'lavfi', '-i', `sine=f=300:r=48000:d=${dur}`]
    : ['-f', 'lavfi', '-i', `aevalsrc=exprs='if(between(t,1,4),0,0.3*sin(2*PI*300*t))':s=48000:d=${dur}`];
  execFileSync(ffmpeg, [
    '-y', '-v', 'error',
    '-f', 'lavfi', '-i', vsrc,
    ...audioIn,
    '-vf', colorFilter(), ...ENC,
    '-c:a', 'aac', '-ar', '48000', '-b:a', '192k', '-movflags', '+faststart', '-shortest', out
  ]);
  return out;
}

const LOUD_OK = { integrated_lufs: -14, target_lufs: -14, true_peak_dbtp: -2, true_peak_limit_dbtp: -1.5 };

test('profiles: SAFE_ZONE_916 derives from the universal profile; ads is stricter at the bottom', () => {
  const u = getSafeProfile('universal');
  assert.equal(SAFE_ZONE_916.minY, u.minY);
  assert.equal(SAFE_ZONE_916.maxY, u.maxY);
  assert.ok(SAFE_PROFILES.ads.maxY < SAFE_PROFILES.universal.maxY);
  assert.ok(u.minY >= 250, 'top must clear platform chrome (>= 250px)');
});

test('encode: flags carry bt709 tags, High profile, closed GOP and a rate cap', () => {
  const a = videoEncodeArgs({ fps: 30 }).join(' ');
  assert.match(a, /-profile:v high/);
  assert.match(a, /-colorspace bt709/);
  assert.match(a, /-maxrate 12M/);
  assert.match(a, /-sc_threshold 0/);
  assert.match(colorFilter(), /out_color_matrix=bt709/);
});

test('countFlashes: steady and slow fades pass, a 6 Hz strobe fails', () => {
  const steady = Array.from({ length: 90 }, (_, i) => ({ t: i / 30, y: 120 }));
  assert.equal(countFlashes(steady).max_per_sec, 0);
  const fade = Array.from({ length: 90 }, (_, i) => ({ t: i / 30, y: 20 + (i / 90) * 200 }));
  assert.equal(countFlashes(fade).max_per_sec, 0);
  const strobe = Array.from({ length: 90 }, (_, i) => ({ t: i / 30, y: Math.floor(i / 2.5) % 2 ? 235 : 16 }));
  assert.ok(countFlashes(strobe).max_per_sec > 3);
});

test('parsers: signalstats / freezedetect / blackdetect / silencedetect', () => {
  assert.deepEqual(parseSignalstatsYavg('frame:0 pts:0 pts_time:0\nlavfi.signalstats.YAVG=12.5\n'), [{ t: 0, y: 12.5 }]);
  assert.deepEqual(parseFreezedetect('freeze_start: 1.5\nfreeze_duration: 2.0\nfreeze_end: 3.5'), [{ start: 1.5, duration: 2 }]);
  assert.equal(parseBlackdetect('[blackdetect @ x] black_start:0 black_end:1.2 black_duration:1.2')[0].duration, 1.2);
  const s = parseSilencedetect('silence_start: 1\nsilence_end: 4 | silence_duration: 3');
  assert.equal(s[0].duration, 3);
});

test('QA fixture: a clean 1080x1920 master with real motion and sound ships', () => {
  const p = mk('good.mp4');
  const r = runQa({ mp4: p, loudness: LOUD_OK, writeSheet: false });
  assert.equal(r.verdict, 'SHIP', JSON.stringify(r.fails));
  assert.equal(r.human_review.required, true);
});

test('QA fixture: 540x960 draft is blocked from SHIP', () => {
  const p = mk('draft.mp4', { w: 540, h: 960 });
  const r = runQa({ mp4: p, loudness: LOUD_OK, writeSheet: false });
  assert.equal(r.verdict, 'FIX');
  assert.ok(r.fails.some((f) => f.startsWith('spec/draft')), r.fails.join('|'));
});

test('QA fixture: a strobing scene is caught from the pixels, not from declared flashes_per_sec', () => {
  const p = mk('strobe.mp4', { vf: "color=c=black:s=1080x1920:r=30:d=6,geq=lum='if(lt(mod(floor(T*12),2),1),235,16)':cb=128:cr=128" });
  const r = runQa({ mp4: p, loudness: LOUD_OK, writeSheet: false });
  assert.equal(r.verdict, 'FIX');
  assert.ok(r.fails.some((f) => f.startsWith('flash:')), r.fails.join('|'));
});

test('QA fixture: a frozen scene and a static opening are caught', () => {
  const p = mk('frozen.mp4', { vf: 'color=c=0x336699:s=1080x1920:r=30:d=6' });
  const r = runQa({ mp4: p, loudness: LOUD_OK, writeSheet: false });
  assert.equal(r.verdict, 'FIX');
  assert.ok(r.fails.some((f) => f.startsWith('freeze:')), r.fails.join('|'));
  assert.ok(r.fails.some((f) => f.startsWith('hook:')), r.fails.join('|'));
});

test('QA fixture: 3 s of dead air is caught', () => {
  const p = mk('silent.mp4', { audio: 'gap' });
  const r = runQa({ mp4: p, loudness: LOUD_OK, writeSheet: false });
  assert.equal(r.verdict, 'FIX');
  assert.ok(r.fails.some((f) => f.startsWith('audio:') && /dead air/.test(f)), r.fails.join('|'));
});

test('QA: placeholder tone audio and music masking speech both fail', () => {
  const p = mk('good2.mp4');
  const r1 = runQa({ mp4: p, loudness: LOUD_OK, placeholderAudio: true, writeSheet: false });
  assert.ok(r1.fails.some((f) => /placeholder tone/.test(f)));
  const r2 = runQa({ mp4: p, loudness: LOUD_OK, mix: { vo_to_bed_lu: 4 }, writeSheet: false });
  assert.ok(r2.fails.some((f) => f.startsWith('mix:')));
});

test('QA: safe-zone sheet is written when requested', () => {
  const p = mk('sheet.mp4');
  const r = runQa({ mp4: p, loudness: LOUD_OK, writeSheet: true });
  assert.ok(r.safe_zone_sheet && fs.existsSync(r.safe_zone_sheet));
});

test('evaluateQa: duration beyond platform max fails', () => {
  const r = evaluateQa({
    probe: { streams: [{ codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p', width: 1080, height: 1920, avg_frame_rate: '30/1', color_space: 'bt709', profile: 'High' }, { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000' }], format: { duration: '400' } },
    platform: 'reels'
  });
  assert.ok(r.fails.some((f) => f.startsWith('length:')));
});

test('direction lint: flags late hook, missing brief, long static scenes and estimated captions', () => {
  const tl = {
    duration_s: 75,
    audio_file: 'voiceover.mp3',
    alignment: { method: 'wpm-estimate' },
    words: [{ word: 'hi', start_s: 2.4, end_s: 2.6 }],
    captions: [{ text: 'hi', start_s: 2.4, end_s: 3 }],
    scenes: [{ id: 's1', start_s: 0, end_s: 75, mood: 'calm', beats: [{ t_s: 0, dur_s: 75, animated_properties: ['x'] }] }]
  };
  const w = lintDirection(tl, null).join('\n');
  assert.match(w, /direction\/hook/);
  assert.match(w, /direction\/length/);
  assert.match(w, /direction\/pacing/);
  assert.match(w, /direction\/ending/);
  assert.match(w, /direction\/captions/);
  assert.match(w, /direction\/brief/);
  assert.ok(QA_THRESHOLDS.firstCaptionMaxS < 2.4);
});

test('QA: scene.allow_static / allow_black / allow_silence turn deliberate choices into warnings; qa.json overrides thresholds', () => {
  const base = {
    probe: { streams: [{ codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p', width: 1080, height: 1920, avg_frame_rate: '30/1', color_space: 'bt709', profile: 'High', duration: '10' }, { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', duration: '10' }], format: { duration: '10' } },
    platform: 'reels',
    freezes: [{ start: 3, duration: 2.5 }],
    black: [{ start: 4, end: 5.2, duration: 1.2 }],
    silence: [{ start: 6, end: 9, duration: 3 }]
  };
  const strict = evaluateQa(base);
  assert.equal(strict.verdict, 'FIX');
  assert.equal(strict.fails.length, 3, strict.fails.join('|'));
  const allowed = evaluateQa({ ...base, allowances: { static: [[2, 6]], black: [[3.5, 6]], silence: [[5, 10]] } });
  assert.equal(allowed.verdict, 'SHIP', allowed.fails.join('|'));
  assert.ok(allowed.warns.filter((w) => /allowed by scene/.test(w)).length === 3);
  const relaxed = evaluateQa({ ...base, thresholds: { ...QA_THRESHOLDS, maxFreezeS: 5, maxBlackS: 2, maxSilenceS: 4 } });
  assert.equal(relaxed.verdict, 'SHIP');
});
