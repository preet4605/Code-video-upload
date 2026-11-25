import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCanvas } from '../lib/runtime.mjs';

import {
  SAFE_ZONE_916,
  clampToSafeZone,
  applyAmbientCamera,
  drawCinematicVignette,
  drawEditorialCaption,
  drawCaptionBar,
  drawGauge,
  drawStampSlam,
  drawProvenanceHeader,
  drawHudBadge,
  resolveUiFont,
  getBeatPulse,
  applyHorrorCamera,
  getWalkCycle
} from '../lib/widgets.mjs';

const { createCanvas, GlobalFonts } = await loadCanvas();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = path.resolve(__dirname, '..');

test('SAFE_ZONE_916 is frozen and clampToSafeZone keeps boxes strictly inside bounds', () => {
  assert.equal(Object.isFrozen(SAFE_ZONE_916), true);
  assert.deepEqual(SAFE_ZONE_916, {
    minX: 60,
    maxX: 900,
    minY: 270,
    maxY: 1440,
    centerX: 480,
    maxWidth: 840
  });

  // Box 200x100 pushed beyond top-left and bottom-right corners
  const topLeft = clampToSafeZone(10, 20, 200, 100, 1);
  assert.equal(topLeft.x - 100 >= SAFE_ZONE_916.minX, true);
  assert.equal(topLeft.y - 50 >= SAFE_ZONE_916.minY, true);

  const botRight = clampToSafeZone(1050, 1800, 200, 100, 1);
  assert.equal(botRight.x + 100 <= SAFE_ZONE_916.maxX, true);
  assert.equal(botRight.y + 50 <= SAFE_ZONE_916.maxY, true);

  // Scaled 720p (scale = 720/1080)
  const s = 720 / 1080;
  const scaled = clampToSafeZone(0, 0, 120, 60, s);
  assert.ok(scaled.x - 60 >= SAFE_ZONE_916.minX * s - 1e-9);
  assert.ok(scaled.y - 30 >= SAFE_ZONE_916.minY * s - 1e-9);
});

test('applyAmbientCamera and drawCinematicVignette transform and render deterministically', () => {
  const renderFrame = (progress, t) => {
    const canvas = createCanvas(540, 960);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0c1932';
    ctx.fillRect(0, 0, 540, 960);

    ctx.save();
    const cam = applyAmbientCamera(ctx, 540, 960, progress, t);
    assert.ok(cam.zoom >= 1.0 && cam.zoom <= 1.045);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(180, 320, 180, 260);
    ctx.restore();

    drawCinematicVignette(ctx, 540, 960, 0.62);
    return canvas.toBuffer('image/png');
  };

  const b1 = renderFrame(0.4, 2.5);
  const b2 = renderFrame(0.4, 2.5);
  const bLater = renderFrame(0.9, 5.0);

  const h1 = crypto.createHash('sha256').update(b1).digest('hex');
  const h2 = crypto.createHash('sha256').update(b2).digest('hex');
  const hLater = crypto.createHash('sha256').update(bLater).digest('hex');

  assert.equal(h1, h2, 'applyAmbientCamera + drawCinematicVignette must be byte-identical for identical inputs');
  assert.notEqual(h1, hLater, 'Changing progress/t must alter rendered frame (prevents static freeze)');
});

test('drawEditorialCaption auto-scales inside [60..900], strips punctuation for highlight, and is deterministic', () => {
  const renderCap = (text, highlightWord) => {
    const canvas = createCanvas(1080, 1920);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, 1080, 1920);
    const metrics = drawEditorialCaption(ctx, {
      width: 1080,
      height: 1920,
      text,
      highlightWord
    });
    return { metrics, buf: canvas.toBuffer('image/png') };
  };

  // 36-char caption auto-scales fontSize cleanly between [24..46] inside [60..900]
  const medRes = renderCap('RAAT KE DO BAJE CHHAT PAR AAWAZ AAYI!', 'AAWAZ');
  assert.ok(medRes.metrics.fontSize >= 24 && medRes.metrics.fontSize < 46, `Expected scaled fontSize in [24..46), got ${medRes.metrics.fontSize}`);
  assert.ok(medRes.metrics.totalWidth <= medRes.metrics.maxAllowedWidth + 1e-6);
  assert.ok(medRes.metrics.leftX >= 60 && medRes.metrics.rightX <= 900);

  // Even extreme 58-char string stays strictly inside [60..900]
  const longRes = renderCap('RAAT DO BAJE CHHAT PAR KOI BHAARI QADMON SE DAUD RAHA HAI!', 'HAI');
  assert.ok(longRes.metrics.totalWidth <= longRes.metrics.maxAllowedWidth + 1e-6);
  assert.ok(longRes.metrics.leftX >= 60, `Expected leftX >= 60, got ${longRes.metrics.leftX}`);
  assert.ok(longRes.metrics.rightX <= 900, `Expected rightX <= 900, got ${longRes.metrics.rightX}`);

  // Punctuation-stripped highlightWord ('SUNO' matches 'SUNO.')
  const r1 = renderCap('AAWAZ KI LAY SUNO.', 'SUNO');
  const r2 = renderCap('AAWAZ KI LAY SUNO.', 'SUNO.');
  const h1 = crypto.createHash('sha256').update(r1.buf).digest('hex');
  const h2 = crypto.createHash('sha256').update(r2.buf).digest('hex');
  assert.equal(h1, h2, 'Trailing punctuation on highlightWord must render identically');

  // Verify highlight actually changes pixels vs unhighlighted
  const rNone = renderCap('AAWAZ KI LAY SUNO.', '');
  const hNone = crypto.createHash('sha256').update(rNone.buf).digest('hex');
  assert.notEqual(h1, hNone, 'Matched clean highlightWord must render highlight color');

  // Verify drawCaptionBar also strips trailing punctuation on highlightWord
  const cA = createCanvas(1080, 1920);
  drawCaptionBar(cA.getContext('2d'), { width: 1080, height: 1920, text: 'Listen carefully now.', highlightWord: 'now' });
  const cB = createCanvas(1080, 1920);
  drawCaptionBar(cB.getContext('2d'), { width: 1080, height: 1920, text: 'Listen carefully now.', highlightWord: 'now.' });
  assert.equal(
    crypto.createHash('sha256').update(cA.toBuffer('image/png')).digest('hex'),
    crypto.createHash('sha256').update(cB.toBuffer('image/png')).digest('hex')
  );
});

test('getBeatPulse, applyHorrorCamera, and getWalkCycle produce beat-synced deterministic choreography', () => {
  const beats = [1.0, 2.5, 4.0];
  const before = getBeatPulse(0.5, beats, 10);
  assert.equal(before.beatIndex, -1);
  assert.equal(before.intensity, 0);
  assert.equal(before.dt, Infinity);

  const onHit = getBeatPulse(2.5, beats, 10);
  assert.equal(onHit.beatIndex, 1);
  assert.equal(onHit.dt, 0);
  assert.equal(onHit.intensity, 1);

  const afterHit = getBeatPulse(2.7, beats, 10);
  assert.equal(afterHit.beatIndex, 1);
  assert.ok(afterHit.intensity > 0 && afterHit.intensity < 0.2);

  // applyHorrorCamera across all 3 modes + deterministic PNG hash
  const renderMode = (mode, t, p) => {
    const canvas = createCanvas(540, 960);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, 540, 960);
    ctx.save();
    const res = applyHorrorCamera(ctx, 540, 960, {
      t,
      p,
      mode,
      focusX: 270,
      focusY: 420,
      zoomStart: 1.0,
      zoomEnd: mode === 'snap_zoom' ? 1.32 : 1.16,
      beatTimes: beats,
      shakeAmp: 12
    });
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(210, 360, 120, 120);
    ctx.restore();
    return { res, buf: canvas.toBuffer('image/png') };
  };

  const dread = renderMode('dread_creep', 1.5, 0.5);
  assert.ok(dread.res.zoom > 1.0 && dread.res.zoom < 1.16);

  const snap = renderMode('snap_zoom', 2.55, 0.6);
  assert.ok(snap.res.zoom > 1.2);

  const shakeA = renderMode('impact_shake', 2.52, 0.5);
  const shakeB = renderMode('impact_shake', 2.52, 0.5);
  assert.equal(shakeA.res.zoom, 1.0);
  assert.ok(Math.abs(shakeA.res.sx) > 0 || Math.abs(shakeA.res.sy) > 0);
  assert.equal(
    crypto.createHash('sha256').update(shakeA.buf).digest('hex'),
    crypto.createHash('sha256').update(shakeB.buf).digest('hex')
  );

  // getWalkCycle active vs dead-stop suspense
  const stop = getWalkCycle(3.2, 0);
  assert.deepEqual(stop, { phase: 0, bobY: 0, leanRad: 0, armSwing: 0, stepHit01: 0 });

  const walk = getWalkCycle(1.0, 2.0);
  assert.ok(walk.stepHit01 > 0.99);
  assert.ok(walk.leanRad > 0);
  const walkMid = getWalkCycle(1.25, 2.0);
  assert.ok(walkMid.bobY < 0);
  assert.ok(Math.abs(walkMid.armSwing) > 0.1);
});

test('drawStampSlam renders Devanagari ink pixels and hits opaque alpha at p=0.15 peak', () => {
  GlobalFonts.registerFromPath(path.join(STUDIO_ROOT, 'fonts/NotoSansDevanagari-Bold.ttf'));
  const c = createCanvas(480, 240);
  const ctx = c.getContext('2d');
  drawStampSlam(ctx, { x: 240, y: 120, text: 'गुलाम', color: '#ef4444', progress01: 0.15 });
  const data = ctx.getImageData(0, 0, 480, 240).data;
  let maxA = 0;
  let redTextPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > maxA) maxA = data[i + 3];
    if (data[i] > 180 && data[i + 1] < 90 && data[i + 3] >= 200) redTextPixels++;
  }
  assert.ok(maxA >= 220, `Expected opaque peak alpha >= 220 (0.9*255), got ${maxA}`);
  assert.ok(redTextPixels > 20, `Expected non-blank Devanagari crimson ink pixels, got ${redTextPixels}`);
});

test('drawGauge supports custom/negative ranges and displayText deterministically', () => {
  const renderGauge = (opts) => {
    const c = createCanvas(320, 260);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 320, 260);
    drawGauge(ctx, { x: 160, y: 140, r: 95, ...opts });
    return c.toBuffer('image/png');
  };

  const negA = renderGauge({ minVal: -20, maxVal: 30, value01: 0.16, unit: '°C', label: 'TEMP' });
  const negB = renderGauge({ minVal: -20, maxVal: 30, value01: 0.16, unit: '°C', label: 'TEMP' });
  const pos = renderGauge({ minVal: -20, maxVal: 30, value01: 0.96, unit: '°C', label: 'TEMP' });
  const disp = renderGauge({ value01: 0.5, displayText: '−12°C', label: 'SUHU' });

  const hA = crypto.createHash('sha256').update(negA).digest('hex');
  const hB = crypto.createHash('sha256').update(negB).digest('hex');
  const hPos = crypto.createHash('sha256').update(pos).digest('hex');
  const hDisp = crypto.createHash('sha256').update(disp).digest('hex');

  assert.equal(hA, hB);
  assert.notEqual(hA, hPos);
  assert.notEqual(hA, hDisp);

  // Edge case: non-numeric/NaN inputs never throw or render NaN
  const nanCanvas = createCanvas(320, 260);
  const nanCtx = nanCanvas.getContext('2d');
  let renderedText = '';
  const origFillText = nanCtx.fillText.bind(nanCtx);
  nanCtx.fillText = (txt, ...rest) => {
    renderedText += String(txt) + '|';
    return origFillText(txt, ...rest);
  };
  drawGauge(nanCtx, { x: 160, y: 140, r: 95, minVal: 'bad', maxVal: 'bad', value01: Number.NaN, label: 'SAFE' });
  assert.equal(renderedText.includes('NaN'), false, `drawGauge rendered NaN: ${renderedText}`);
});

test('applyHorrorCamera dread_creep responds to beatTimes while preserving beatless behavior', () => {
  const measure = (beatTimes) => {
    let tx = 0;
    let ty = 0;
    let zoom = 1;
    const stub = {
      translate(x, y) { tx += x; ty += y; },
      scale(z) { zoom *= z; }
    };
    const res = applyHorrorCamera(stub, 720, 1280, {
      t: 3.02,
      p: 0.5,
      mode: 'dread_creep',
      focusX: 360,
      focusY: 640,
      zoomStart: 1.0,
      zoomEnd: 1.12,
      beatTimes,
      shakeAmp: 10
    });
    return { tx, ty, zoom, res };
  };

  const noBeat = measure([]);
  const withBeat = measure([3.0]);
  assert.ok(withBeat.zoom > noBeat.zoom, `Expected dread_creep beat push-in (${withBeat.zoom} > ${noBeat.zoom})`);
  assert.ok(
    Math.abs(withBeat.res.sx - noBeat.res.sx) > 0.05 || Math.abs(withBeat.res.sy - noBeat.res.sy) > 0.05,
    'Expected measurable dread_creep transform shift on beat'
  );
});

test('drawProvenanceHeader and drawHudBadge auto-select Devanagari font and respect custom fontFamily', () => {
  GlobalFonts.registerFromPath(path.join(STUDIO_ROOT, 'fonts/NotoSansDevanagari-Bold.ttf'));
  GlobalFonts.registerFromPath(path.join(STUDIO_ROOT, 'fonts/NotoSans-Bold.ttf'));

  assert.ok(resolveUiFont('सूर्य ग्रहण').includes('Noto Sans Devanagari'));
  assert.equal(resolveUiFont('SOLAR ECLIPSE').includes('Devanagari'), false);
  assert.equal(resolveUiFont('सूर्य', '"CustomFont", sans-serif'), '"CustomFont", sans-serif');

  const trackFonts = (ctx) => {
    const fonts = [];
    const origDesc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), 'font');
    let curFont = ctx.font;
    Object.defineProperty(ctx, 'font', {
      get() { return curFont; },
      set(v) {
        fonts.push(String(v));
        curFont = v;
        if (origDesc?.set) origDesc.set.call(ctx, v);
      },
      configurable: true
    });
    return fonts;
  };

  // 1. Devanagari provenance header + shrink-to-fit while loop + rendered ink pixels
  const c1 = createCanvas(1080, 400);
  const ctx1 = c1.getContext('2d');
  const provFonts = trackFonts(ctx1);
  const prov = drawProvenanceHeader(ctx1, {
    width: 1080,
    height: 1920,
    text: 'सूर्य का असली आकार और तापमान',
    maxWidth: 260
  });
  assert.ok(prov.pillW <= 260);
  assert.ok(provFonts.length >= 2, 'Expected shrink-to-fit font updates inside while loop');
  assert.ok(provFonts.every((f) => f.includes('Noto Sans Devanagari')), `Expected Devanagari font in loop: ${provFonts.join(' | ')}`);

  // 2. Devanagari HUD badge renders non-blank ink and respects custom fontFamily override
  const c2 = createCanvas(480, 240);
  const ctx2 = c2.getContext('2d');
  const badgeFonts = trackFonts(ctx2);
  const bRes = drawHudBadge(ctx2, { x: 240, y: 120, text: 'सूर्य ग्रहण' });
  assert.ok(bRes.boxW > 80 && bRes.boxH > 40);
  assert.ok(badgeFonts.some((f) => f.includes('Noto Sans Devanagari')));

  const imgData = ctx2.getImageData(0, 0, 480, 240).data;
  let whitePixels = 0;
  for (let i = 0; i < imgData.length; i += 4) {
    if (imgData[i] > 230 && imgData[i + 1] > 230 && imgData[i + 2] > 230 && imgData[i + 3] > 200) {
      whitePixels++;
    }
  }
  assert.ok(whitePixels > 30, `Expected visible Devanagari HUD badge text pixels, got ${whitePixels}`);

  const c3 = createCanvas(480, 240);
  const ctx3 = c3.getContext('2d');
  const customFonts = trackFonts(ctx3);
  drawHudBadge(ctx3, { x: 240, y: 120, text: 'सूर्य', fontFamily: '"DejaVu Sans", sans-serif' });
  assert.ok(customFonts.some((f) => f.includes('"DejaVu Sans", sans-serif')));
});
