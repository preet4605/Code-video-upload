import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseScript,
  buildTimeline,
  listTtsProviders,
  detectTTS,
  synthesizeTts,
  scaleTimelineToAudioDuration,
  detectVocalPauses,
  snapSceneBoundariesToPauses,
  stripTtsTags,
  checkDevanagariTtsText,
  checkHumanScriptFlow
} from '../scripts/audio_timeline.mjs';
import { lintTimeline } from '../scripts/render_and_lint.mjs';
import {
  isAllowedLicense,
  formatWikimediaAttribution,
  parseWikimediaResponse
} from '../scripts/fetch_wikimedia.mjs';
import { resolveBin } from '../lib/runtime.mjs';
import { makeTmpProject } from './_tmp_project.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = path.resolve(__dirname, '..');
const FFMPEG = resolveBin('ffmpeg');

test('audio_timeline.mjs --preset reel-720 --dry-run --json produces 720x1280 @ 30fps, -14 LUFS', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_p5_r720_'));
  const scriptPath = path.join(tmpDir, 'script.txt');
  fs.writeFileSync(scriptPath, '[SCENE id=hook mood=horror ambient=true]\n[NARRATOR] Raat ke teen baje sensor trigger hua.');
  try {
    const raw = execFileSync(
      'node',
      [
        path.join(STUDIO_ROOT, 'scripts/audio_timeline.mjs'),
        '--script', scriptPath,
        '--out', tmpDir,
        '--lang', 'hinglish',
        '--preset', 'reel-720',
        '--tts', 'none',
        '--dry-run',
        '--json'
      ],
      { encoding: 'utf8' }
    );
    const out = JSON.parse(raw);
    assert.equal(out.ok, true);
    assert.equal(out.timeline.width, 720);
    assert.equal(out.timeline.height, 1280);
    assert.equal(out.timeline.fps, 30);
    assert.equal(out.timeline.target_lufs, -14);
    assert.equal(out.timeline.true_peak_dbtp, -1.5);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('scaleTimelineToAudioDuration() scales 10s timeline to 14.5s with exact continuity', () => {
  const parsed = parseScript(`
[SCENE id=s1 mood=suspense ambient=true]
[NARRATOR] First scene narration line.
[SFX name=thud]
[SCENE id=s2 mood=energetic ambient=true]
[NARRATOR] Second scene narration line.
`);
  const base = buildTimeline(parsed, { lang: 'en', fps: 30, width: 720, height: 1280 });
  const scaled = scaleTimelineToAudioDuration(base, 14.5);

  assert.equal(scaled.duration_s, 14.5);
  assert.equal(scaled.scenes[0].start_s, 0);
  assert.equal(scaled.scenes[scaled.scenes.length - 1].end_s, 14.5);
  for (let i = 1; i < scaled.scenes.length; i++) {
    assert.equal(scaled.scenes[i].start_s, scaled.scenes[i - 1].end_s);
  }
  const lint = lintTimeline(scaled);
  assert.equal(lint.ok, true, `Lint failed after scaling: ${lint.errors.join('; ')}`);
});

test('audio_timeline.mjs --audio <3s-wav> probes duration, sets audio_file, and writes timeline.json', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_p5_aud_'));
  const wavPath = path.join(tmpDir, 'input_vo.wav');
  const scriptPath = path.join(tmpDir, 'script.txt');
  const outDir = path.join(tmpDir, 'proj');
  execFileSync(FFMPEG, ['-y', '-f', 'lavfi', '-t', '3.0', '-i', 'sine=frequency=440:sample_rate=48000', wavPath], { stdio: 'pipe' });
  fs.writeFileSync(scriptPath, '[SCENE id=s1 mood=neutral ambient=true]\n[NARRATOR] Short audio sync test.');

  try {
    const raw = execFileSync(
      'node',
      [
        path.join(STUDIO_ROOT, 'scripts/audio_timeline.mjs'),
        '--script', scriptPath,
        '--out', outDir,
        '--audio', wavPath,
        '--preset', 'reel-720',
        '--json'
      ],
      { encoding: 'utf8' }
    );
    const res = JSON.parse(raw);
    assert.equal(res.ok, true);
    assert.ok(Math.abs(res.duration_s - 3.0) <= 0.1, `Expected ~3.0s duration, got ${res.duration_s}`);
    assert.equal(res.audio_file, 'voiceover.wav');
    assert.ok(fs.existsSync(path.join(outDir, 'timeline.json')));
    assert.ok(fs.existsSync(path.join(outDir, 'voiceover.wav')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('listTtsProviders() returns expected CLI + API provider descriptors', () => {
  const providers = listTtsProviders();
  const ids = providers.map((p) => p.id);
  for (const expected of ['edge-tts', 'espeak-ng', 'piper', 'elevenlabs', 'gemini', 'sarvam']) {
    assert.ok(ids.includes(expected), `Missing TTS provider: ${expected}`);
  }
});

test('render_and_lint.mjs --project examples/hello-15s --reel-720 --dry-run --json outputs 720x1280 @ 30fps', () => {
  const hello = makeTmpProject('hello-15s');
  after(() => hello.cleanup());
  const raw = execFileSync(
    'node',
    [
      path.join(STUDIO_ROOT, 'scripts/render_and_lint.mjs'),
      '--project', hello.dir,
      '--reel-720',
      '--dry-run',
      '--json'
    ],
    { encoding: 'utf8' }
  );
  const res = JSON.parse(raw);
  assert.equal(res.ok, true);
  assert.equal(res.width, 720);
  assert.equal(res.height, 1280);
  assert.equal(res.fps, 30);
});

test('parseWikimediaResponse() & isAllowedLicense() filter CC-only and strip HTML from artist', () => {
  assert.equal(isAllowedLicense('CC BY-SA 4.0'), true);
  assert.equal(isAllowedLicense('Public domain'), true);
  assert.equal(isAllowedLicense('CC0'), true);
  assert.equal(isAllowedLicense('CC BY-NC 4.0'), false);
  assert.equal(isAllowedLicense('CC BY-ND 4.0'), false);
  assert.equal(isAllowedLicense('All rights reserved'), false);

  assert.equal(
    formatWikimediaAttribution('<a href="https://example.com">Jane Doe</a>', 'CC BY 4.0'),
    'PHOTO: Jane Doe · CC BY 4.0 · WIKIMEDIA COMMONS'
  );

  const mockApi = {
    query: {
      pages: {
        1: {
          title: 'File:Moon_1969.jpg',
          imageinfo: [{
            url: 'https://upload.wikimedia.org/moon.jpg',
            thumburl: 'https://upload.wikimedia.org/thumb/moon.jpg',
            descriptionurl: 'https://commons.wikimedia.org/wiki/File:Moon_1969.jpg',
            extmetadata: {
              Artist: { value: '<a href="https://commons.wikimedia.org/wiki/User:NASA">NASA Archive</a>' },
              LicenseShortName: { value: 'Public domain' }
            }
          }]
        },
        2: {
          title: 'File:Lab_Photo.jpg',
          imageinfo: [{
            url: 'https://upload.wikimedia.org/lab.jpg',
            extmetadata: {
              Artist: { value: '<span>Dr. Rao</span>' },
              LicenseShortName: { value: 'CC BY-SA 4.0' }
            }
          }]
        },
        3: {
          title: 'File:NonComm.jpg',
          imageinfo: [{
            url: 'https://upload.wikimedia.org/nc.jpg',
            extmetadata: {
              Artist: { value: 'Someone' },
              LicenseShortName: { value: 'CC BY-NC 4.0' }
            }
          }]
        },
        4: {
          title: 'File:NoDeriv.jpg',
          imageinfo: [{
            url: 'https://upload.wikimedia.org/nd.jpg',
            extmetadata: {
              Artist: { value: 'Someone' },
              LicenseShortName: { value: 'CC BY-ND 4.0' }
            }
          }]
        }
      }
    }
  };

  const parsed = parseWikimediaResponse(mockApi);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].artist, 'NASA Archive');
  assert.equal(parsed[1].artist, 'Dr. Rao');
  assert.equal(parsed[1].attribution, 'PHOTO: Dr. Rao · CC BY-SA 4.0 · WIKIMEDIA COMMONS');
});

test('listTtsProviders() includes fish-audio with FISH_AUDIO_API_KEY', () => {
  const providers = listTtsProviders();
  const fish = providers.find((p) => p.id === 'fish-audio');
  assert.ok(fish, 'Expected fish-audio in listTtsProviders()');
  assert.equal(fish.envVar, 'FISH_AUDIO_API_KEY');
  assert.equal(fish.kind, 'api');
});

test('stripTtsTags() strips Fish Audio control tags cleanly', () => {
  assert.equal(stripTtsTags('Hello [break] world [whispering] test'), 'Hello world test');
});

test('buildTimeline() strips [break] from visual captions while preserving scene continuity', () => {
  const parsed = parseScript(`
[SCENE id=s1 mood=suspense ambient=true]
[NARRATOR] Raat ke teen baje [break] light band hui.
[SCENE id=s2 mood=energetic ambient=true]
[WHISPER] Kisi ne [whispering] darwaza khola.
`);
  const tl = buildTimeline(parsed, { lang: 'hinglish', preset: 'reel-720', slug: 'tag-test' });
  assert.equal(tl.captions.some((c) => c.text.includes('[break]') || c.text.includes('[whispering]')), false);
  assert.equal(tl.words.some((w) => w.word.includes('[break]') || w.word.includes('[whispering]')), false);
  assert.equal(lintTimeline(tl).ok, true);
});

test('SKILL.md uses config-driven tts.env, stays < 5500 bytes, and zero hardcoded API secrets exist', () => {
  const skillPath = path.join(STUDIO_ROOT, 'SKILL.md');
  const content = fs.readFileSync(skillPath, 'utf8');
  assert.ok(content.includes('tts.env'), 'SKILL.md must reference config-driven tts.env');
  assert.ok(fs.statSync(skillPath).size < 5500, 'SKILL.md must stay < 5500 bytes');

  const needles = [['sk', 'fish', ''].join('-'), ['sk', 'live', ''].join('-')];
  const scanDir = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name === 'bin' || ent.name === '.git') continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) scanDir(full);
      else if (/\.(mjs|js|md|json|txt)$/i.test(ent.name)) {
        const txt = fs.readFileSync(full, 'utf8');
        for (const needle of needles) {
          assert.equal(txt.includes(needle), false, `Hardcoded API key found in ${full}`);
        }
      }
    }
  };
  scanDir(STUDIO_ROOT);
});

test('detectTTS("auto") honors TTS_PROVIDER from environment cleanly', () => {
  const prevTts = process.env.TTS_PROVIDER;
  const prevGemini = process.env.GEMINI_API_KEY;
  try {
    process.env.GEMINI_API_KEY = 'dummy-gemini-key';
    process.env.TTS_PROVIDER = 'gemini';
    assert.deepEqual(detectTTS('auto'), { provider: 'gemini' });

    process.env.TTS_PROVIDER = 'none';
    assert.equal(detectTTS('auto'), null);
  } finally {
    if (prevTts === undefined) delete process.env.TTS_PROVIDER;
    else process.env.TTS_PROVIDER = prevTts;
    if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevGemini;
  }
});

test('detectVocalPauses() finds vocal-band gap in synthetic WAV and snapSceneBoundariesToPauses() snaps drifted cuts cleanly', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_p5_snap_'));
  const wavPath = path.join(tmpDir, 'two_tone_gap.wav');
  try {
    // 0.0-1.0s 600Hz tone, 1.0-1.3s silence, 1.3-2.3s 600Hz tone
    execFileSync(
      FFMPEG,
      [
        '-y',
        '-f', 'lavfi', '-i', 'sine=frequency=600:sample_rate=48000:duration=1.0',
        '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono:d=0.3',
        '-f', 'lavfi', '-i', 'sine=frequency=600:sample_rate=48000:duration=1.0',
        '-filter_complex', '[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]',
        '-map', '[out]',
        wavPath
      ],
      { stdio: 'pipe' }
    );
    const pauses = detectVocalPauses(wavPath);
    assert.ok(pauses.length >= 1, 'Expected at least 1 detected vocal pause in two-tone WAV');
    assert.ok(pauses.some((p) => p.mid >= 1.0 && p.mid <= 1.3), `Expected pause mid in [1.0, 1.3], got ${JSON.stringify(pauses)}`);

    // Snap drifted scene cuts (11.0, 16.0) to detected pauses (11.6, 16.77) while keeping captions aligned
    const tl = {
      version: '1.0',
      slug: 'snap-test',
      aspect: '9:16',
      width: 720,
      height: 1280,
      fps: 30,
      duration_s: 22.0,
      scenes: [
        { id: 's1', start_s: 0, end_s: 11.0, mood: 'suspense', ambient_motion: true, beats: [{ t_s: 0, dur_s: 11.0, hold: false, animated_properties: ['cam'] }] },
        { id: 's2', start_s: 11.0, end_s: 16.0, mood: 'suspense', ambient_motion: true, beats: [{ t_s: 11.0, dur_s: 5.0, hold: false, animated_properties: ['cam'] }] },
        { id: 's3', start_s: 16.0, end_s: 22.0, mood: 'neutral', ambient_motion: true, beats: [{ t_s: 16.0, dur_s: 6.0, hold: false, animated_properties: ['cam'] }] }
      ],
      captions: [
        { text: 'Scene one line', start_s: 0.5, end_s: 10.5, safe_zone: true },
        { text: 'Scene two line', start_s: 11.2, end_s: 15.8, safe_zone: true },
        { text: 'Scene three line', start_s: 16.2, end_s: 21.5, safe_zone: true }
      ]
    };
    const snapped = snapSceneBoundariesToPauses(tl, [
      { start: 11.55, end: 11.65, duration: 0.1, mid: 11.6 },
      { start: 16.72, end: 16.82, duration: 0.1, mid: 16.77 }
    ], 1.0);

    assert.equal(snapped.scenes[0].start_s, 0);
    assert.equal(snapped.scenes[0].end_s, 11.6);
    assert.equal(snapped.scenes[1].start_s, 11.6);
    assert.equal(snapped.scenes[1].end_s, 16.767); // 16.77 quantized to 30fps (503/30)
    assert.equal(snapped.scenes[2].start_s, 16.767);
    assert.equal(snapped.scenes[2].end_s, 22.0);
    assert.ok(snapped.captions[1].start_s >= 11.6 && snapped.captions[1].end_s <= 16.767);
    assert.ok(snapped.captions[2].start_s >= 16.767);
    assert.equal(lintTimeline(snapped).ok, true);

    // Edge case: pauses=[null] or malformed entries must return cleanly without throwing
    const untouched = snapSceneBoundariesToPauses(tl, [null, undefined, { start: 'bad' }]);
    assert.equal(untouched.scenes[0].end_s, 11.0);
    assert.equal(untouched.scenes[1].end_s, 16.0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('checkDevanagariTtsText() catches raw digits in Hindi Devanagari TTS text and passes spoken words or English', () => {
  const bad = checkDevanagariTtsText('साल 1। [break] माइनस 73।');
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.matches, ['1', '73']);
  assert.ok(bad.warning && bad.warning.includes('Fish Audio'));

  const badDevaDigit = checkDevanagariTtsText('कुल ९ ग्रह हैं।');
  assert.equal(badDevaDigit.ok, false);
  assert.deepEqual(badDevaDigit.matches, ['९']);

  const goodHi = checkDevanagariTtsText('साल भर में माइनस तिहत्तर डिग्री');
  assert.equal(goodHi.ok, true);
  assert.deepEqual(goodHi.matches, []);
  assert.equal(goodHi.warning, null);

  const goodEn = checkDevanagariTtsText('Year 1: -73');
  assert.equal(goodEn.ok, true);
  assert.deepEqual(goodEn.matches, []);
  assert.equal(goodEn.warning, null);

  // CLI dry-run emits warning to stderr and tts_warnings in JSON
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_hi_digit_'));
  const scriptPath = path.join(tmpDir, 'script.txt');
  fs.writeFileSync(scriptPath, '[SCENE id=s1 mood=suspense ambient=true]\n[NARRATOR] साल 1। माइनस 73।');
  try {
    const raw = execFileSync(
      'node',
      [
        path.join(STUDIO_ROOT, 'scripts/audio_timeline.mjs'),
        '--script', scriptPath,
        '--out', tmpDir,
        '--lang', 'hi',
        '--tts', 'none',
        '--dry-run',
        '--json'
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const out = JSON.parse(raw);
    assert.equal(out.ok, true);
    assert.ok(Array.isArray(out.tts_warnings) && out.tts_warnings.length === 1);
    assert.ok(out.tts_warnings[0].includes('Fish Audio'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('checkHumanScriptFlow() flags telegraphic AI fragments and stacked short questions, passes natural human scripts', () => {
  const aiSlop = checkHumanScriptFlow(
    '[SCENE id=s1 mood=suspense ambient=true]\n[NARRATOR] [break] मास गया? साल 1। माइनस 73। एक ब्लैक होल। हवा सलामत।'
  );
  assert.equal(aiSlop.ok, false);
  assert.ok(aiSlop.fragmentRatio >= 0.4, `Expected fragmentRatio >= 0.4, got ${aiSlop.fragmentRatio}`);
  assert.deepEqual(aiSlop.shortQuestions, ['मास गया?']);
  assert.ok(aiSlop.warnings.length >= 1);

  const stackedQ = checkHumanScriptFlow('Mass gone? The result? Everything freezes fast.');
  assert.equal(stackedQ.ok, false);
  assert.deepEqual(stackedQ.shortQuestions, ['Mass gone?', 'The result?']);
  assert.ok(stackedQ.warnings.some((w) => w.includes('rhetorical')));

  const humanHi = checkHumanScriptFlow(
    '# Comment ignored\n[SCENE id=s1 mood=suspense ambient=true]\n[NARRATOR] इंद्र का वज्र उनके हनु यानी जबड़े पर लगा, तभी उनका नाम हनुमान पड़ा। अगर सूरज का वज़न गायब हो गया, तो धरती को कोई नहीं खींचेगा और हम सीधे अंतरिक्ष में निकल जाएंगे।'
  );
  assert.equal(humanHi.ok, true);
  assert.equal(humanHi.fragmentRatio, 0);
  assert.deepEqual(humanHi.shortQuestions, []);
  assert.deepEqual(humanHi.warnings, []);

  const humanEn = checkHumanScriptFlow(
    "Indra's bolt struck his jaw, which is where the name Hanuman comes from. If the Sun's mass disappears, nothing holds Earth in orbit at 29.78 km/s anymore."
  );
  assert.equal(humanEn.ok, true);
  assert.equal(humanEn.warnings.length, 0);

  // CLI dry-run attaches script_warnings to JSON output
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_flow_'));
  const scriptPath = path.join(tmpDir, 'script.txt');
  fs.writeFileSync(scriptPath, '[SCENE id=s1 mood=suspense ambient=true]\n[NARRATOR] मास गया? साल एक। माइनस तिहत्तर। एक ब्लैक होल। हवा सलामत।');
  try {
    const raw = execFileSync(
      'node',
      [
        path.join(STUDIO_ROOT, 'scripts/audio_timeline.mjs'),
        '--script', scriptPath,
        '--out', tmpDir,
        '--lang', 'hi',
        '--tts', 'none',
        '--dry-run',
        '--json'
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const out = JSON.parse(raw);
    assert.equal(out.ok, true);
    assert.ok(Array.isArray(out.script_warnings) && out.script_warnings.length >= 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('listTtsProviders(), detectTTS("kalpa"), and synthesizeTts() support Kalpa Labs cleanly', async () => {
  const prevKey = process.env.KALPA_API_KEY;
  const prevHi = process.env.KALPA_VOICE_ID_HI;
  const prevEn = process.env.KALPA_VOICE_ID_EN;
  const prevTts = process.env.TTS_PROVIDER;
  const origFetch = globalThis.fetch;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_kalpa_'));

  try {
    process.env.KALPA_API_KEY = 'dummy-kalpa-key';
    delete process.env.KALPA_VOICE_ID_HI;
    delete process.env.KALPA_VOICE_ID_EN;

    const providers = listTtsProviders();
    const kalpa = providers.find((p) => p.id === 'kalpa-labs');
    assert.ok(kalpa, 'Expected kalpa-labs in listTtsProviders()');
    assert.equal(kalpa.kind, 'api');
    assert.equal(kalpa.available, true);
    assert.equal(kalpa.env, 'KALPA_API_KEY');

    assert.deepEqual(detectTTS('kalpa'), { provider: 'kalpa-labs' });
    assert.deepEqual(detectTTS('kalpa-labs'), { provider: 'kalpa-labs' });
    process.env.TTS_PROVIDER = 'kalpa';
    assert.deepEqual(detectTTS('auto'), { provider: 'kalpa-labs' });

    const calls = [];
    const fakeWav = Buffer.from('RIFF\x00\x00\x00\x00WAVEfmt ', 'ascii');
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({ audio: { data_b64: fakeWav.toString('base64') } })
      };
    };

    const outHi = path.join(tmpDir, 'vo_hi.wav');
    const resHi = await synthesizeTts({
      provider: 'kalpa',
      text: 'नमस्ते [break] दुनिया',
      lang: 'hi',
      voice: 'hi-IN-MadhurNeural',
      outPath: outHi
    });
    assert.equal(resHi.ok, true);
    assert.equal(resHi.provider, 'kalpa-labs');
    assert.equal(calls[0].url, 'https://api.kalpalabs.ai/v1/tts/1eb6c010-34e0-477c-9d24-e915f853359e');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer dummy-kalpa-key');
    assert.deepEqual(JSON.parse(calls[0].init.body), { text: 'नमस्ते दुनिया' });
    assert.deepEqual(fs.readFileSync(outHi), fakeWav);

    const outEn = path.join(tmpDir, 'vo_en.wav');
    const resEn = await synthesizeTts({
      provider: 'kalpa-labs',
      text: 'Hello [whispering] world',
      lang: 'en',
      voice: 'en-US-AndrewNeural',
      outPath: outEn
    });
    assert.equal(resEn.ok, true);
    assert.equal(calls[1].url, 'https://api.kalpalabs.ai/v1/tts/dda5319f-3b81-4124-b69e-9241eb510b77');
    assert.deepEqual(JSON.parse(calls[1].init.body), { text: 'Hello world' });
  } finally {
    globalThis.fetch = origFetch;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (prevKey === undefined) delete process.env.KALPA_API_KEY;
    else process.env.KALPA_API_KEY = prevKey;
    if (prevHi === undefined) delete process.env.KALPA_VOICE_ID_HI;
    else process.env.KALPA_VOICE_ID_HI = prevHi;
    if (prevEn === undefined) delete process.env.KALPA_VOICE_ID_EN;
    else process.env.KALPA_VOICE_ID_EN = prevEn;
    if (prevTts === undefined) delete process.env.TTS_PROVIDER;
    else process.env.TTS_PROVIDER = prevTts;
  }
});
