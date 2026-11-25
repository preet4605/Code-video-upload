// आख़िरी नाव: choice-ask outro (A/B cards over the night lake).
import {
  makeCamera, handheld, drawVignette, drawGrain, smooth, clamp01, lerp, rgba,
  paintSky, paintRidge, paintWater, paintReflection, ringsFrom, drawBoat, drawNarrator, mist,
  lanternWorld, windowWorld, FONT
} from '../lake_kit.mjs';
import { drawCaptionBar } from '/mnt/project-files/skills/code-video-studio-v6.1/lib/widgets.mjs';

let T = 0;
const BOAT = { x: -0.25, z: 17 };
const ep = (a, b, t) => smooth((t - a) / (b - a));
const LABEL = { A: 'उसे छूकर देखो', B: 'झील को पुकारो' };

function drawCard(ctx, s, x, y, w, h, key, appear, state, pulse) {
  // state: 0 neutral, 1 chosen, -1 dimmed
  const al = appear * (state < 0 ? 0.42 : 1);
  if (al <= 0.01) return;
  const sc = 1 + (state > 0 ? 0.05 : 0), rise = (1 - appear) * 40 * s;
  const cx = x + w / 2, cy = y + h / 2 + rise;
  ctx.save();
  ctx.globalAlpha = al; ctx.translate(cx, cy); ctx.scale(sc, sc);
  const hx = -w / 2, hy = -h / 2, r = 26 * s;
  if (state > 0) { ctx.shadowColor = rgba(255, 190, 110, 0.55 + 0.15 * pulse); ctx.shadowBlur = 38 * s; }
  ctx.fillStyle = rgba(8, 14, 30, 0.86); ctx.beginPath(); ctx.roundRect(hx, hy, w, h, r); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = (state > 0 ? 4 : 2) * s; ctx.strokeStyle = state > 0 ? rgba(255, 196, 120, 0.95) : rgba(150, 175, 225, 0.55);
  ctx.beginPath(); ctx.roundRect(hx, hy, w, h, r); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = state > 0 ? rgba(255, 205, 140, 1) : rgba(190, 205, 235, 0.95);
  ctx.font = `800 ${112 * s}px ${FONT}`; ctx.fillText(key, 0, -h * 0.12);
  ctx.fillStyle = rgba(240, 244, 255, 0.98); ctx.font = `700 ${42 * s}px ${FONT}`; ctx.fillText(LABEL[key], 0, h * 0.3);
  ctx.restore();
}

export const VideoClock = {
  setTime(s) { T = s; },
  draw(ctx0, width, height, tl) {
    const t = T, D = tl.duration_s || 9, s = width / 1080;
    const ctx = ctx0;
    const L = tl.lines || [];
    const lt = (i, d) => (L[i] ? L[i].start_s : d);
    const prog = clamp01(t / D);
    const cam = makeCamera({ pos: [0, 1.35, lerp(-3.7, -3.2, smooth(prog))], yaw: 0, pitch: lerp(-0.045, -0.05, prog), fov: 46, width, height, shake: handheld(t, 0.5, 2) });
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    paintSky(ctx, cam, t, { dusk: 0, moonEl: 0.24, moonAz: 0.42, moonDim: 1.5 });
    paintRidge(ctx, cam, { t, rimA: 1 });
    paintWater(ctx, cam, t, { dusk: 0, bright: 1.8 });
    const boatO = { x: BOAT.x, z: BOAT.z, t, lit: 0, win: 0, lantern: 0.3 + 0.07 * Math.sin(t * 7), warm: 0, breath: 0.2, flicker: 1, bob: 1 };
    paintReflection(ctx, cam, lanternWorld({ x: BOAT.x, z: BOAT.z }), t, { color: [255, 170, 80], alpha: 0.22, widthM: 0.3, lenPx: 560 });
    ringsFrom(ctx, cam, t, cam.pos[0], cam.pos[2] + 0.7, Array.from({ length: 6 }, (_, i) => 0.3 + i * 1.25), { life: 3.4, speed: 0.5, a: 0.5 });
    drawBoat(ctx, cam, boatO);
    mist(ctx, width, height, t, { y: height * 0.54, hh: 90 * s, alpha: 0.1, color: [110, 130, 170] });
    drawNarrator(ctx, width, height, t, { x: 0.5, headY: 0.865, size: 1.35, waterY: 0.945, breath: 1, sink: 0.05, rimA: 0.55, rim: [150, 175, 225], lean: 0 });

    // ---- the ask: heading, two cards, then the final line makes them alternate
    const tHead = lt(0, 0.1), tA = lt(1, 2.4), tB = lt(2, 4.0), tAsk = lt(3, 5.4);
    const asking = t >= tAsk;
    const blink = asking ? (Math.floor((t - tAsk) / 0.7) % 2 === 0 ? 1 : 2) : 0;
    const pulse = Math.sin(t * 6);
    const ha = ep(tHead, tHead + 0.3, t);
    if (ha > 0.01) {
      ctx.save(); ctx.globalAlpha = ha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${44 * s}px ${FONT}`; const txt = 'अब तुम बताओ', tw = ctx.measureText(txt).width + 70 * s;
      ctx.fillStyle = rgba(8, 14, 30, 0.82); ctx.beginPath(); ctx.roundRect(width / 2 - tw / 2, 300 * s, tw, 76 * s, 38 * s); ctx.fill();
      ctx.fillStyle = rgba(255, 205, 140, 1); ctx.fillText(txt, width / 2, 339 * s); ctx.restore();
    }
    const cw = 400 * s, ch = 270 * s, y0 = 408 * s;
    drawCard(ctx, s, 70 * s, y0, cw, ch, 'A', ep(tA - 0.05, tA + 0.35, t), blink === 1 ? 1 : 0, pulse);
    drawCard(ctx, s, 490 * s, y0, cw, ch, 'B', ep(tB - 0.05, tB + 0.35, t), blink === 2 ? 1 : 0, pulse);
    if (asking) {
      const ka = ep(tAsk, tAsk + 0.4, t);
      ctx.save(); ctx.globalAlpha = ka; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 ${46 * s}px ${FONT}`; const q = 'कमेंट में A या B लिखो', qw = ctx.measureText(q).width + 70 * s, qy = y0 + ch + 40 * s;
      ctx.fillStyle = rgba(8, 14, 30, 0.88); ctx.beginPath(); ctx.roundRect(width / 2 - qw / 2, qy, qw, 80 * s, 40 * s); ctx.fill();
      ctx.fillStyle = rgba(255, 205, 140, 1); ctx.fillText(q, width / 2, qy + 41 * s);
      ctx.restore();
    }
    const fin = 0.35 + 0.65 * ep(0, 0.45, t); if (fin < 1) { ctx.fillStyle = rgba(0, 0, 0, 1 - fin); ctx.fillRect(0, 0, width, height); }
    drawVignette(ctx, width, height, 0.84);
    drawGrain(ctx, width, height, t, 0.9);
    const cap = (tl.captions || []).find((x) => t >= x.start_s && t <= x.end_s);
    if (cap) drawCaptionBar(ctx, { width, height, text: cap.text, highlightWord: cap.highlight || '', fontFamily: FONT });
  }
};
