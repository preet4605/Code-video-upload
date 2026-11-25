import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCanvas, resolveBin } from '../lib/runtime.mjs';
import { makeTmpProject } from './_tmp_project.mjs';

import {
  ICONOGRAPHY_QA_CHECKLIST,
  drawModularCharacter,
  drawMythicCutout,
  drawPolaroidFrame,
  drawXrayLens,
  drawGauge,
  drawStampSlam,
  drawCaptionBar,
  drawOrbitalTrail
} from '../lib/widgets.mjs';
import { registerBundledFonts } from '../scripts/render_and_lint.mjs';
import { measureLoudness, evaluateMasterQa } from '../scripts/master_and_qa.mjs';

const { createCanvas } = await loadCanvas();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = path.resolve(__dirname, '..');
const FFMPEG_BIN = resolveBin('ffmpeg');

// Fixture MP4 generated in a temp dir (no prebuilt outputs inside the skill folder):
// 6 s 1080x1920 colour + low-volume 440 Hz sine, AAC 48 kHz, true peak ~-20 dBTP.
let fixtureDir = null;
function sampleFixtureMp4() {
  if (fixtureDir) return path.join(fixtureDir, 'hello-15s.mp4');
  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-p3-fixture-'));
  const mp4 = path.join(fixtureDir, 'hello-15s.mp4');
  execFileSync(FFMPEG_BIN, [
    '-y', '-v', 'error',
    '-f', 'lavfi', '-i', 'color=c=0x0f172a:s=1080x1920:r=30:d=6',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=6',
    '-af', 'volume=0.1',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-ar', '48000', '-b:a', '128k',
    '-shortest', mp4
  ], { stdio: 'pipe' });
  return mp4;
}
after(() => {
  if (fixtureDir) fs.rmSync(fixtureDir, { recursive: true, force: true });
});

test('All 3 references/*.md exist and every relative link in SKILL.md resolves on disk', () => {
  for (const ref of ['widgets-and-motion.md', 'narrative-horror-reels.md', 'ffmpeg-mastering.md']) {
    const p = path.join(STUDIO_ROOT, 'references', ref);
    assert.ok(fs.existsSync(p), `Missing reference: ${ref}`);
    assert.ok(fs.statSync(p).size > 500, `Reference too small: ${ref}`);
  }

  const skillMd = fs.readFileSync(path.join(STUDIO_ROOT, 'SKILL.md'), 'utf8');
  const links = [...skillMd.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(links.length >= 7, 'Expected >= 7 relative links in SKILL.md');
  for (const rel of links) {
    if (rel.startsWith('http://') || rel.startsWith('https://')) continue;
    const target = path.resolve(STUDIO_ROOT, rel);
    assert.ok(fs.existsSync(target), `Broken SKILL.md link: ${rel}`);
  }
});

test('lib/widgets.mjs renders all 8 widgets deterministically (SHA-256 identical) and non-blank', () => {
  registerBundledFonts();
  assert.ok(Array.isArray(ICONOGRAPHY_QA_CHECKLIST) && ICONOGRAPHY_QA_CHECKLIST.length >= 3);

  const renderComposite = (t) => {
    const canvas = createCanvas(540, 960);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 540, 960);

    drawXrayLens(ctx, {
      cx: 270,
      cy: 220,
      r: 80,
      drawOuter: (c) => {
        c.fillStyle = '#1e293b';
        c.fillRect(150, 140, 240, 160);
      },
      drawInner: (c) => {
        c.fillStyle = '#38bdf8';
        c.fillRect(150, 140, 240, 160);
      }
    });

    drawModularCharacter(ctx, {
      x: 150,
      y: 440,
      scale: 0.9,
      hat: 'fedora',
      prop: 'flask',
      expression: 'shocked',
      blink: false,
      mouthOpen: 0.6
    });

    drawMythicCutout(ctx, {
      x: 370,
      y: 440,
      scale: 0.55,
      t,
      title: 'SHAKTI',
      subtitle: 'AURA'
    });

    drawPolaroidFrame(ctx, {
      x: 160,
      y: 660,
      w: 170,
      h: 190,
      angleRad: -0.06,
      label: 'LAB 1954',
      attribution: 'PHOTO: WIKIMEDIA · CC BY 4.0'
    });

    drawGauge(ctx, { x: 390, y: 660, r: 60, value01: 0.82, label: 'O2', unit: '%' });
    drawStampSlam(ctx, { x: 270, y: 120, text: 'DECLASSIFIED', progress01: 1 });
    drawOrbitalTrail(ctx, {
      cx: 270,
      cy: 300,
      points: [
        { x: -80, y: 20 },
        { x: -30, y: -15 },
        { x: 30, y: -10 },
        { x: 80, y: 25 }
      ]
    });
    drawCaptionBar(ctx, {
      width: 540,
      height: 960,
      text: 'Deterministic widgets\nrendered cleanly.',
      highlightWord: 'widgets'
    });

    return canvas.toBuffer('image/png');
  };

  const buf1 = renderComposite(1.25);
  const buf2 = renderComposite(1.25);
  const h1 = crypto.createHash('sha256').update(buf1).digest('hex');
  const h2 = crypto.createHash('sha256').update(buf2).digest('hex');
  assert.equal(h1, h2, 'Widget composite must be byte-for-byte deterministic');
  assert.ok(buf1.length > 5000, `Expected rich non-blank PNG, got ${buf1.length} bytes`);
});

test('measureLoudness() verifies hello-15s.mp4 and Fast Path --input --dry-run --json succeeds', () => {
  const sampleMp4 = sampleFixtureMp4();
  const loud = measureLoudness(FFMPEG_BIN, sampleMp4);

  assert.ok(Number.isFinite(loud.integrated_lufs), `Expected finite integrated_lufs, got ${loud.integrated_lufs}`);
  assert.ok(Number.isFinite(loud.true_peak_dbtp), `Expected finite true_peak_dbtp, got ${loud.true_peak_dbtp}`);
  assert.ok(loud.true_peak_dbtp <= -1.2, `Expected true_peak_dbtp <= -1.2, got ${loud.true_peak_dbtp}`);

  const raw = execFileSync(
    'node',
    [path.join(STUDIO_ROOT, 'scripts/master_and_qa.mjs'), '--input', sampleMp4, '--start', '1', '--end', '5', '--lufs', '-14', '--dry-run', '--json'],
    { encoding: 'utf8' }
  );
  const res = JSON.parse(raw);
  assert.equal(res.ok, true);
  assert.equal(res.dryRun, true);
  assert.equal(res.mode, 'fast-path');
  assert.equal(res.targetLufs, -14);
});

test('drawCaptionBar() wraps and scales 42-character captions strictly inside pill box at 1080x1920 and 540x960 without overflow', () => {
  registerBundledFonts();
  const caption42Words = 'MYTHIC COSMIC HORROR SATELLITE ORBITS NOW!'; // 42 chars
  const caption42TwoLines = 'MYTHIC COSMIC HORROR SATELLITE ORBITS NOW!\nGRAVITY BENDS THEIR PATH INTO FULL ORBITS!'; // two 42-char lines
  const caption42Token = 'W'.repeat(42); // 42 wide uppercase chars without spaces
  assert.equal(caption42Words.length, 42);
  assert.equal(caption42Token.length, 42);

  for (const [width, height] of [
    [1080, 1920],
    [540, 960]
  ]) {
    const s = width / 1080;
    for (const text of [caption42Words, caption42TwoLines, caption42Token]) {
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      const layout = drawCaptionBar(ctx, {
        width,
        height,
        text,
        highlightWord: 'HORROR'
      });

      assert.ok(layout, 'Expected layout metrics from drawCaptionBar');
      assert.equal(layout.boxW, Math.round(width * 0.76));
      assert.ok(layout.boxX >= Math.round(60 * s), `boxX ${layout.boxX} < safe zone ${60 * s}`);
      assert.ok(layout.boxX + layout.boxW <= Math.round(900 * s), `box right ${layout.boxX + layout.boxW} > safe zone ${900 * s}`);
      assert.ok(layout.lines.length >= 1 && layout.lines.length <= 2, `Expected 1..2 lines, got ${layout.lines.length}`);
      assert.ok(
        layout.maxLineWidth <= layout.boxW - 36 * s + 0.5,
        `Line width ${layout.maxLineWidth} exceeded inner box limit ${layout.boxW - 36 * s} at ${width}x${height}`
      );

      // Verify zero rendered pixels exist outside [boxX, boxX + boxW] in the caption band
      const y0 = Math.max(0, Math.floor(layout.boxY));
      const y1 = Math.min(height, Math.ceil(layout.boxY + layout.boxH));
      const img = ctx.getImageData(0, y0, width, y1 - y0).data;
      let overflowPixels = 0;
      for (let y = 0; y < y1 - y0; y++) {
        for (let x = 0; x < width; x++) {
          if (x >= layout.boxX - 1 && x <= layout.boxX + layout.boxW + 1) continue;
          const idx = (y * width + x) * 4;
          if (img[idx] > 0 || img[idx + 1] > 0 || img[idx + 2] > 0) {
            overflowPixels++;
          }
        }
      }
      assert.equal(overflowPixels, 0, `Expected 0 pixels outside pill box at ${width}x${height}, found ${overflowPixels}`);
    }
  }
});

test('master_and_qa.mjs supports --subtitles with bundled fontsdir + --tp and enforces 48000 Hz & ±2.0 LU qaPass gates', () => {
  const sampleMp4 = sampleFixtureMp4();
  const hello = makeTmpProject('hello-15s');
  after(() => hello.cleanup());
  const helloProject = hello.dir;
  const subFile = path.join(helloProject, 'captions.ass');
  const expectedFontsDir = path.join(STUDIO_ROOT, 'fonts');

  // 1. Fast Path --input with --subtitles and --tp
  const fastRaw = execFileSync(
    'node',
    [
      path.join(STUDIO_ROOT, 'scripts/master_and_qa.mjs'),
      '--input', sampleMp4,
      '--lufs', '-14',
      '--tp', '-1.0',
      '--subtitles', subFile,
      '--dry-run',
      '--json'
    ],
    { encoding: 'utf8' }
  );
  const fastRes = JSON.parse(fastRaw);
  assert.equal(fastRes.ok, true);
  assert.equal(fastRes.truePeak, -1.0);
  const fastVfIdx = fastRes.plannedCommand.indexOf('-vf');
  assert.ok(fastVfIdx !== -1, 'Expected -vf in Fast Path plannedCommand');
  const fastVf = fastRes.plannedCommand[fastVfIdx + 1];
  assert.ok(fastVf.includes("ass='") && fastVf.includes(`:fontsdir='${expectedFontsDir}'`), `Unexpected Fast Path -vf: ${fastVf}`);

  // 2. Project mode --project with --subtitles
  const projRaw = execFileSync(
    'node',
    [
      path.join(STUDIO_ROOT, 'scripts/master_and_qa.mjs'),
      '--project', helloProject,
      '--subtitles', subFile,
      '--dry-run',
      '--json'
    ],
    { encoding: 'utf8' }
  );
  const projRes = JSON.parse(projRaw);
  assert.equal(projRes.ok, true);
  const projVfIdx = projRes.plannedCommand.indexOf('-vf');
  assert.ok(projVfIdx !== -1, 'Expected -vf in Project mode plannedCommand');
  const projVf = projRes.plannedCommand[projVfIdx + 1];
  assert.ok(projVf.includes("ass='") && projVf.includes(`:fontsdir='${expectedFontsDir}'`), `Unexpected Project -vf: ${projVf}`);

  // 3. evaluateMasterQa enforces 48000 Hz sample rate, ±2.0 LU integrated loudness, and truePeak + 0.3 dBTP
  const baseV = { codec_name: 'h264', pix_fmt: 'yuv420p' };
  const baseA = { codec_name: 'aac', sample_rate: '48000' };

  assert.equal(
    evaluateMasterQa({
      vStream: baseV,
      aStream: baseA,
      contactSheetExists: true,
      loud: { integrated_lufs: -15.6, true_peak_dbtp: -1.4 },
      targetLufs: -16,
      truePeak: -1.5
    }).qaPass,
    true
  );

  // Rejects non-48000 Hz audio sample rate
  assert.equal(
    evaluateMasterQa({
      vStream: baseV,
      aStream: { codec_name: 'aac', sample_rate: '44100' },
      contactSheetExists: true,
      loud: { integrated_lufs: -16.0, true_peak_dbtp: -1.5 },
      targetLufs: -16,
      truePeak: -1.5
    }).qaPass,
    false
  );

  // Rejects integrated LUFS outside ±2.0 LU of targetLufs (when > -60)
  assert.equal(
    evaluateMasterQa({
      vStream: baseV,
      aStream: baseA,
      contactSheetExists: true,
      loud: { integrated_lufs: -18.5, true_peak_dbtp: -1.5 },
      targetLufs: -16,
      truePeak: -1.5
    }).qaPass,
    false
  );

  // Rejects true peak > truePeak + 0.3
  assert.equal(
    evaluateMasterQa({
      vStream: baseV,
      aStream: baseA,
      contactSheetExists: true,
      loud: { integrated_lufs: -16.0, true_peak_dbtp: -1.1 },
      targetLufs: -16,
      truePeak: -1.5
    }).qaPass,
    false
  );
});

test('drawPolaroidFrame() fits long CC attribution strictly inside maxAllowedWidth (innerW - 24) in <= 2 lines', () => {
  registerBundledFonts();
  const canvas = createCanvas(540, 960);
  const ctx = canvas.getContext('2d');
  const res = drawPolaroidFrame(ctx, {
    x: 270,
    y: 480,
    w: 360,
    h: 340,
    angleRad: -0.05,
    label: 'SECTOR 4 · 03:00 AM',
    attribution: 'PHOTO: Demo Archive · CC BY 4.0 · WIKIMEDIA COMMONS'
  });

  assert.ok(res, 'Expected layout metrics from drawPolaroidFrame');
  assert.equal(res.maxAllowedWidth, 360 - 18 * 2 - 24);
  assert.ok(res.attrLines.length >= 1 && res.attrLines.length <= 2, `Expected 1..2 lines, got ${res.attrLines.length}`);
  assert.ok(
    res.attrMaxWidth <= res.maxAllowedWidth,
    `Expected attrMaxWidth (${res.attrMaxWidth}) <= maxAllowedWidth (${res.maxAllowedWidth})`
  );
});
