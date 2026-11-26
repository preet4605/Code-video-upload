import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseScript, buildTimeline, wrapCaptionLines, graphemeLength } from '../scripts/audio_timeline.mjs';
import { lintTimeline, registerBundledFonts } from '../scripts/render_and_lint.mjs';
import { loadCanvas } from '../lib/runtime.mjs';

const { createCanvas, GlobalFonts } = await loadCanvas();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = path.resolve(__dirname, '..');

test('SKILL.md has valid frontmatter and < 1800 estimated tokens', () => {
  const s = fs.readFileSync(path.join(STUDIO_ROOT, 'SKILL.md'), 'utf8');
  assert.ok(s.startsWith('---'), 'SKILL.md must start with YAML frontmatter');
  assert.match(s, /^name:\s*reel-factory/m);
  const estTokens = Math.ceil(s.length / 4);
  assert.ok(estTokens < 1800, `SKILL.md token estimate ${estTokens} >= 1800`);
});

test('Bundled Noto & Devanagari fonts exist and have valid TTF headers', () => {
  const fontsDir = path.join(STUDIO_ROOT, 'fonts');
  for (const name of ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf', 'NotoSansDevanagari-Bold.ttf']) {
    const p = path.join(fontsDir, name);
    assert.ok(fs.existsSync(p), `Missing bundled font: ${name}`);
    const buf = fs.readFileSync(p);
    assert.ok(buf.length > 30000, `${name} too small (${buf.length} bytes)`);
    const magic = buf.subarray(0, 4);
    const isTtf = magic[0] === 0x00 && magic[1] === 0x01 && magic[2] === 0x00 && magic[3] === 0x00;
    const isOtf = magic.toString('ascii') === 'OTTO';
    assert.ok(isTtf || isOtf, `${name} invalid font magic: ${magic.toString('hex')}`);
  }
});

test('audio_timeline.mjs parses English script and passes lintTimeline()', () => {
  const script = `
[SCENE id=hook mood=energetic ambient=true]
[NARRATOR] Why do satellites never fall into the Earth?
[SFX name=whoosh]
[SCENE id=orbit mood=neutral ambient=true]
[NARRATOR] Gravity bends their path into a continuous circle.
`;
  const parsed = parseScript(script);
  const tl = buildTimeline(parsed, { lang: 'en', slug: 'en-test', fps: 30, width: 1080, height: 1920 });
  assert.equal(tl.scenes.length, 2);
  assert.ok(tl.words.length >= 10);
  assert.ok(tl.audio_cues.some((c) => c.type === 'sfx' && c.name === 'whoosh'));
  const lint = lintTimeline(tl);
  assert.equal(lint.ok, true, `Lint errors: ${lint.errors.join('; ')}`);
});

test('audio_timeline.mjs handles Hindi/Hinglish + tags + CLI --dry-run --json', () => {
  const script = `
[SCENE id=dread mood=suspense ambient=true]
[NARRATOR] रात के तीन बजे जब लैब की लाइट बंद हुई...
[SFX name=drone_hit]
[WHISPER] Kisi ne sensor trigger kiya tha.
`;
  const parsed = parseScript(script);
  const tl = buildTimeline(parsed, { lang: 'hinglish', slug: 'hi-test', fps: 30, width: 1080, height: 1920 });
  assert.equal(tl.scenes[0].mood, 'suspense');
  assert.ok(tl.words.some((w) => w.speaker === 'WHISPER'));
  const lint = lintTimeline(tl);
  assert.equal(lint.ok, true, `Lint errors: ${lint.errors.join('; ')}`);

  const tmpFile = path.join(os.tmpdir(), `cvs_test_script_${process.pid}.txt`);
  fs.writeFileSync(tmpFile, script);
  try {
    const raw = execFileSync(
      'node',
      [path.join(STUDIO_ROOT, 'scripts/audio_timeline.mjs'), '--script', tmpFile, '--out', os.tmpdir(), '--lang', 'hinglish', '--tts', 'none', '--dry-run', '--json'],
      { encoding: 'utf8' }
    );
    const cliOut = JSON.parse(raw);
    assert.equal(cliOut.ok, true);
    assert.equal(cliOut.dryRun, true);
    assert.equal(cliOut.timeline.scenes.length, 1);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

function baseTimeline() {
  return {
    version: '1.0',
    slug: 'lint-test',
    aspect: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    duration_s: 4,
    scenes: [
      {
        id: 's1',
        start_s: 0,
        end_s: 2,
        mood: 'neutral',
        ambient_motion: false,
        beats: [{ t_s: 0, dur_s: 2, hold: false, flashes_per_sec: 0, animated_properties: ['x'] }]
      },
      {
        id: 's2',
        start_s: 2,
        end_s: 4,
        mood: 'neutral',
        ambient_motion: false,
        beats: [{ t_s: 2, dur_s: 2, hold: false, flashes_per_sec: 0, animated_properties: ['y'] }]
      }
    ],
    captions: [{ text: 'Valid short caption.', start_s: 0.2, end_s: 1.8, safe_zone: true }]
  };
}

test('lintTimeline() rejects >20% static holds, WCAG >3 flashes/s, CPS >18, >2 lines, gaps/overlaps, and 9:16 safe-zone violations', () => {
  // 1. >20% static holds
  const tHold = baseTimeline();
  tHold.scenes[0].beats[0].hold = true;
  assert.equal(lintTimeline(tHold).ok, false);

  // 2. WCAG >3 flashes/s
  const tFlash = baseTimeline();
  tFlash.scenes[0].beats[0].flashes_per_sec = 4;
  assert.equal(lintTimeline(tFlash).ok, false);

  // 3. CPS > 18
  const tCps = baseTimeline();
  tCps.captions[0] = { text: 'This sentence is way too fast for one sec.', start_s: 0.5, end_s: 1.5 };
  assert.equal(lintTimeline(tCps).ok, false);

  // 4. >2 caption lines
  const tLines = baseTimeline();
  tLines.captions[0] = { text: 'Line 1\nLine 2\nLine 3', start_s: 0.1, end_s: 1.9 };
  assert.equal(lintTimeline(tLines).ok, false);

  // 5. Scene gap / overlap
  const tGap = baseTimeline();
  tGap.scenes[1].start_s = 2.5;
  assert.equal(lintTimeline(tGap).ok, false);

  const tOverlap = baseTimeline();
  tOverlap.scenes[1].start_s = 1.5;
  assert.equal(lintTimeline(tOverlap).ok, false);

  // 6. 9:16 safe-zone violation
  const tSafe = baseTimeline();
  tSafe.scenes[0].focal_point = { x: 920, y: 500, w: 100, h: 100 };
  assert.equal(lintTimeline(tSafe).ok, false);
});

test('lintTimeline() accepts valid mood="suspense" + ambient_motion=true holds', () => {
  const tSuspense = baseTimeline();
  tSuspense.scenes[0].mood = 'suspense';
  tSuspense.scenes[0].ambient_motion = true;
  tSuspense.scenes[0].beats[0].hold = true;
  tSuspense.scenes[0].beats[0].animated_properties = [];
  const res = lintTimeline(tSuspense);
  assert.equal(res.ok, true, `Expected suspense+ambient to pass, got: ${res.errors.join('; ')}`);
});

test('wrapCaptionLines() preserves 100% of characters on 60-char words without leading empty line', () => {
  const longUrl = 'https://example.com/very/long/path/that/exceeds/sixty/chars123';
  const chunks = wrapCaptionLines(longUrl, 42, 2);
  assert.ok(chunks.length >= 1);
  assert.ok(!chunks[0].startsWith('\n'), 'Must not emit a leading empty line');
  const joined = chunks.join('').replace(/\n/g, '');
  assert.equal(joined, longUrl, 'Must preserve 100% of characters');
  for (const chunk of chunks) {
    for (const ln of chunk.split('\n')) {
      assert.ok(graphemeLength(ln) <= 42, `Line exceeded 42 graphemes: ${ln}`);
    }
  }
});

test('Devanagari grapheme-cluster length counts visible clusters accurately for 42-char & 18-CPS limits', () => {
  // 42+ UTF-16 code units, <= 42 visible grapheme clusters
  const hindiLine = 'भारत की नदियों में छिपा है रहस्य और विज्ञान';
  assert.ok(hindiLine.length > 42, `Expected UTF-16 length > 42, got ${hindiLine.length}`);
  const gLen = graphemeLength(hindiLine);
  assert.ok(gLen <= 42, `Expected grapheme length <= 42, got ${gLen}`);

  const tl = baseTimeline();
  tl.captions = [{ text: hindiLine, start_s: 0.1, end_s: 2.5, safe_zone: true }];
  const res = lintTimeline(tl);
  assert.equal(res.ok, true, `Expected Devanagari caption to pass lint, got: ${res.errors.join('; ')}`);
});

test('Runtime Devanagari glyph render via GlobalFonts.registerFromPath produces non-zero ink pixels', () => {
  const registered = registerBundledFonts();
  assert.ok(registered.includes('NotoSansDevanagari-Bold.ttf'));
  GlobalFonts.registerFromPath(path.join(STUDIO_ROOT, 'fonts/NotoSansDevanagari-Bold.ttf'), 'Noto Sans Devanagari');

  const canvas = createCanvas(400, 120);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 400, 120);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px "Noto Sans Devanagari"';
  ctx.fillText('भारत की नदियाँ', 20, 75);

  const pixels = ctx.getImageData(0, 0, 400, 120).data;
  let litPixels = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > 20 || pixels[i + 1] > 20 || pixels[i + 2] > 20) litPixels++;
  }
  assert.ok(litPixels > 100, `Expected >100 rendered Devanagari ink pixels, got ${litPixels}`);
});

test('audio_timeline.mjs CLI executes cleanly via pathToFileURL even with spaces in path', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs spaced dir '));
  const scriptPath = path.join(tmpDir, 'my script.txt');
  const symlinkPath = path.join(tmpDir, 'audio timeline.mjs');
  fs.writeFileSync(scriptPath, '[SCENE id=s1 mood=neutral ambient=true]\n[NARRATOR] Hello world.');
  fs.symlinkSync(path.join(STUDIO_ROOT, 'scripts/audio_timeline.mjs'), symlinkPath);
  try {
    const raw = execFileSync(
      'node',
      [symlinkPath, '--script', scriptPath, '--out', tmpDir, '--tts', 'none', '--dry-run', '--json'],
      { encoding: 'utf8' }
    );
    const parsed = JSON.parse(raw);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.dryRun, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
