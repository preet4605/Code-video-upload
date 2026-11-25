// आख़िरी नाव part 2b "पानी पर": he stays on the bank; something walks toward him with no ripples, goes UNDER the water upside-down,
// he stays silent, and the lake answers in his own voice. Everything derives from t + timeline.
import {
  makeCamera, handheld, drawVignette, drawGrain, hitPulse, smooth, clamp01, lerp, chromaticAberration, hash, rgba, TAU, mix,
  paintSky, paintRidge, paintWater, paintReflection, ringsFrom, paintRing, drawBoat, drawHand, drawNarrator, drawSteam, mist, drawShore, drawWalker, punch,
  lanternWorld, windowWorld, FONT, cue, sceneOf, horizonY
} from '../lake_kit.mjs';
import { drawCaptionBar } from '/mnt/project-files/skills/code-video-studio-v6.1/lib/widgets.mjs';

let T = 0;
const BOAT = { x: 2.6, z: 12.5 };
const ep = (a, b, t) => smooth((t - a) / (b - a));
const lerpA = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));

// world time: the lake stops dead for the silence before his own voice answers
function worldTime(t, f0, f1) { if (t < f0) return t; if (t < f1) return f0 + (t - f0) * 0.04; return t - (f1 - f0) * 0.96; }

function shotAt(t, c) {
  const S = [
    [0, 5.03, [0.0, 1.5, -0.8, 0.0, -0.05, 54], [0.0, 1.5, -0.3, 0.02, -0.06, 52]],
    [5.03, 14.92, [0.0, 1.5, -0.3, 0.02, -0.06, 52], [0.0, 1.5, -0.3, 0.0, -0.05, 50]],
    [14.92, 23.67, [0.0, 1.5, -0.3, -0.01, -0.03, 50], [0.0, 1.5, -0.3, -0.03, -0.025, 38]],
    [23.67, 37.58, [0.0, 1.5, -0.3, -0.03, -0.025, 38], [0.0, 1.5, -0.2, -0.01, -0.035, 33]],
    [37.58, 46.09, [0.0, 1.5, -0.2, -0.01, -0.035, 33], [0.1, 1.5, 0.2, 0.22, -0.5, 50]],
    [46.09, 56.4, [0.1, 1.5, 0.2, 0.22, -0.5, 50], [0.0, 1.5, 0.35, 0.0, -0.5, 46]],
    [56.4, 68.29, [0.0, 1.5, 0.35, 0.0, -0.4, 46], [0.0, 1.5, -0.35, 0.0, -0.06, 50]],
    [68.29, 78.2, [0.0, 1.5, -0.35, 0.0, -0.06, 50], [0.0, 1.5, -0.6, 0.0, 0.04, 54]],
    [78.2, 82.94, [0.0, 1.5, -0.6, 0.0, 0.04, 54], [0.3, 0.6, -2.4, 0.2, 0.02, 60]],
    [82.94, 99, [0.0, 0.3, -0.5, 0.2, 0.03, 56], [0.1, 0.28, -0.4, 0.18, 0.04, 52]]
  ];
  let seg = S[S.length - 1];
  for (const s of S) if (t >= s[0] && t < s[1]) { seg = s; break; }
  const k = clamp01((t - seg[0]) / Math.max(0.01, seg[1] - seg[0]));
  const e = smooth(k);
  const L = (i) => lerp(seg[2][i], seg[3][i], e);
  let yaw = L(3);
  // he looks left at the post where he stood for three nights
  const look = ep(6.2, 7.6, t) - ep(11.4, 12.8, t);
  yaw += look * -0.92;
  return { x: L(0), y: L(1), z: L(2), yaw, pitch: L(4), fov: L(5), look };
}

function walkerAt(t) {
  if (t < 37.58) { const k = t / 37.58; return { x: lerp(-2.6, -0.5, k), z: lerp(72, 12.5, Math.pow(k, 0.92)), under: 0 }; }
  const k = ep(37.58, 46.0, t);
  return { x: lerp(-0.5, 0.1, k), z: lerp(12.5, 2.6, Math.pow(k, 0.8)), under: smooth((t - 38.6) / 2.4) };
}

function drawFace(ctx, x, y, s, t, a, mouthT) {
  // pale oval under the surface, seen through moving water (banded wobble); its pupils look straight up at the camera
  const bands = 36, H = 560 * s;
  for (let i = 0; i < bands; i++) {
    const y0 = y - H / 2 + (H / bands) * i;
    ctx.save(); ctx.beginPath(); ctx.rect(x - 420 * s, y0, 840 * s, H / bands + 1); ctx.clip();
    ctx.translate(Math.sin(i * 0.5 + t * 2.2) * 7 * s, 0);
    ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(3,6,12,0.92)'; ctx.lineWidth = 7 * s;
    for (let k = 0; k < 11; k++) { ctx.beginPath(); ctx.moveTo(x + (k - 5) * 24 * s, y - 190 * s); ctx.bezierCurveTo(x + (k - 5) * 40 * s + Math.sin(t * 1.3 + k) * 30 * s, y - 310 * s, x + (k - 5) * 58 * s, y - 400 * s, x + (k - 5) * 70 * s + Math.sin(t + k * 2) * 42 * s, y - 520 * s); ctx.stroke(); }
    const g = ctx.createRadialGradient(x, y - 40 * s, 20 * s, x, y, 240 * s); g.addColorStop(0, 'rgb(196,210,226)'); g.addColorStop(1, 'rgb(70,92,120)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 128 * s, y - 70 * s); ctx.bezierCurveTo(x - 128 * s, y - 210 * s, x + 128 * s, y - 210 * s, x + 128 * s, y - 70 * s); ctx.bezierCurveTo(x + 124 * s, y + 90 * s, x + 60 * s, y + 215 * s, x, y + 232 * s); ctx.bezierCurveTo(x - 60 * s, y + 215 * s, x - 124 * s, y + 90 * s, x - 128 * s, y - 70 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(5,9,16,0.96)';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sd * 54 * s, y - 36 * s, 30 * s, 44 * s, sd * 0.12, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(225,235,245,0.95)'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sd * 54 * s + Math.sin(t * 0.9) * 3 * s, y - 40 * s + 8 * s, 6 * s, 0, TAU); ctx.fill(); }
    const mo = 0.35 + 0.65 * Math.abs(Math.sin(mouthT * 3.7) * Math.sin(mouthT * 1.1 + 1));
    ctx.fillStyle = 'rgba(8,12,20,0.95)'; ctx.beginPath(); ctx.ellipse(x, y + 120 * s, 26 * s, (4 + 26 * mo) * s, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

export const VideoClock = {
  setTime(s) { T = s; },
  draw(ctx, width, height, tl) {
    const tR = T, D = tl.duration_s || 87.7, s = width / 1080;
    const c = { scare: cue(tl, 'my_voice_answers', 65.0), wave: cue(tl, 'wave_no_wind', 74.6), knock: cue(tl, 'water_knock', 46.2) };
    const t = worldTime(tR, c.scare - 0.65, c.scare + 0.25);   // frozen lake for the silence
    const hit = hitPulse(tR, [c.scare, c.wave + 3.0, c.knock], 7);
    const prog = clamp01(tR / D);
    const sh = shotAt(tR, c);
    const amp = 0.5 + 2.4 * prog * prog + 7 * hit + 3 * ep(c.wave, c.wave + 2, tR) * (1 - ep(c.wave + 4.5, c.wave + 5.5, tR));
    const cam = makeCamera({ pos: [sh.x, sh.y, sh.z], yaw: sh.yaw, pitch: sh.pitch, fov: sh.fov - 4 * hit, width, height, shake: handheld(tR, amp, 5) });
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);

    const dusk = 1 - smooth((tR - 2) / 30);
    const wk = walkerAt(tR);
    const answered = tR >= c.scare;
    const window_ = tR >= c.scare && tR < c.scare + 0.5 ? 1.0 : 0.82 + 0.06 * Math.sin(tR * 2.1);
    const win = 0.85 * window_;

    paintSky(ctx, cam, t, { dusk, moonEl: 0.22, moonAz: 0.12 });
    paintRidge(ctx, cam, { t });
    paintWater(ctx, cam, t, { dusk, moonAz: 0.12 });
    const boatO = { x: BOAT.x, z: BOAT.z, t, lit: 1, win, lantern: 1, jacket: 0, flicker: 1, bob: 0.6, dy: 0 };
    paintReflection(ctx, cam, lanternWorld(boatO), t, { color: [255, 170, 80], alpha: 0.7, widthM: 0.3, lenPx: 620 });
    paintReflection(ctx, cam, windowWorld(boatO), t, { color: [255, 195, 120], alpha: 0.5 * win, widthM: 0.9, lenPx: 540, wob: 1.4 });

    // his own ripples lapping at the bank; the walker's feet make none
    const lap = Array.from({ length: 30 }, (_, i) => 0.4 + i * 1.5);
    ringsFrom(ctx, cam, t, 0.0, 1.7, lap, { life: 3.2, speed: 0.38, a: 0.5 });
    // the lake answers: rings burst from far out
    if (tR >= c.scare) ringsFrom(ctx, cam, t, -1.2, 30, [c.scare + 0.0, c.scare + 0.5, c.scare + 1.1, c.scare + 1.8], { life: 5.5, speed: 3.2, a: 0.5, color: [200, 215, 245] });
    if (tR >= c.knock && tR < c.scare - 0.6) ringsFrom(ctx, cam, t, wk.x, wk.z + 0.4, [c.knock, c.knock + 1.4, c.knock + 3.1, c.knock + 5.2, c.knock + 7.5], { life: 2.6, speed: 0.5, a: 0.4, color: [200, 215, 245] });

    drawBoat(ctx, cam, boatO);
    drawShore(ctx, cam, t, { x: -1.4, z: 1.2, lamp: 1, postOnly: true });
    mist(ctx, width, height, t, { y: horizonY(cam) + 26 * s, hh: 80 * s, alpha: 0.11, color: [110, 130, 170] });

    // ---- the walker
    const showWalker = tR < 58.5;
    if (showWalker) {
      const inv = wk.under > 0.5;
      const fadeFace = 1 - ep(56.0, 58.4, tR);
      if (!inv) { const sc = cam.f; drawWalker(ctx, cam, tR, { x: wk.x, z: wk.z, alpha: 1, stepT: tR * 1.4, lean: 0.14, pale: 0, scale: lerp(2.6, 1.3, ep(0, 37.5, tR)) }); }
      else { drawWalker(ctx, cam, tR, { x: wk.x, z: wk.z, inverted: true, alpha: 0.62 * fadeFace * (1 - ep(45.2, 47.2, tR)) * (0.8 + 0.2 * Math.sin(tR * 2)), pale: 0.85, stepT: tR * 1.0, lean: 0.14 }); }
      // pale glow under the surface around it
      if (inv) { const p = cam.project([wk.x, 0, wk.z]); if (p.ok) { const R = (cam.f / p.z) * 1.6; const g = ctx.createRadialGradient(p.x, p.y + R * 0.5, 0, p.x, p.y + R * 0.5, R); g.addColorStop(0, rgba(150, 190, 225, 0.35 * fadeFace)); g.addColorStop(1, 'rgba(100,140,190,0)'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(p.x - R, p.y - R, 2 * R, 2.4 * R); ctx.restore(); } }
      // its face looks up at him, through the water (the body has sunk away; only the face rises)
      if (tR >= 47.0 && tR < 58.4) {
        const fa = ep(47.0, 49.2, tR) * (1 - ep(55.6, 57.6, tR));
        const rise = lerp(0.62, 0.52, ep(47, 56, tR));
        if (fa > 0.01) drawFace(ctx, width * 0.5 + Math.sin(tR * 0.7) * 26 * s, height * rise, 1.0 + 0.18 * ep(47, 56, tR), tR, 0.9 * fa, tR);
      }
    }
    if (tR < 24) { ctx.fillStyle = rgba(0, 0, 8, 0.22 * ep(2, 8, tR)); ctx.fillRect(0, 0, width, height); }
    // low light mist across
    if (tR > 60 && tR < c.scare - 0.5) { ctx.fillStyle = rgba(0, 0, 6, 0.08); ctx.fillRect(0, 0, width, height); }

    // ---- the post he called from (when he glances left, memory of the three nights)
    // (drawn above in drawShore with postOnly)

    // ---- the wave with no wind, and the many small hands in its foam
    if (tR >= c.wave) {
      const k = (tR - c.wave) / 3.4, hy = horizonY(cam);
      const up = ep(0, 1, clamp01(k)) * (1 - ep(1.05, 1.5, k)) + (k >= 1.05 ? 0 : 0);
      const crest = lerp(height * 0.75, -height * 0.15, smooth(clamp01(k))) - 24 * s * Math.sin(tR * 3);
      const wd = clamp01(k * 4) * (1 - ep(1.15, 1.75, k));
      if (wd > 0.01) {
        const g = ctx.createLinearGradient(0, crest, 0, height); g.addColorStop(0, rgba(60, 88, 128, wd)); g.addColorStop(0.2, rgba(22, 36, 62, wd)); g.addColorStop(1, rgba(8, 14, 28, wd));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, height); ctx.lineTo(0, crest);
        for (let x = 0; x <= width + 30; x += 30) ctx.lineTo(x, crest + Math.sin(x * 0.02 + tR * 3) * 16 * s + Math.sin(x * 0.007 - tR) * 24 * s);
        ctx.lineTo(width, height); ctx.closePath(); ctx.fill();
        // foam line and small hands in it
        ctx.strokeStyle = rgba(190, 205, 230, 0.55 * wd); ctx.lineWidth = 5 * s; ctx.beginPath();
        for (let x = 0; x <= width + 30; x += 30) { const y = crest + Math.sin(x * 0.02 + tR * 3) * 16 * s + Math.sin(x * 0.007 - tR) * 24 * s; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
        for (let i = 0; i < 16; i++) {
          const x = (i + 0.5) / 16 * width, y = crest + Math.sin(x * 0.02 + tR * 3) * 16 * s + Math.sin(x * 0.007 - tR) * 24 * s + 18 * s;
          const sc = (92 + 46 * hash(i)) * s * (0.5 + 0.7 * smooth(clamp01((k - 0.2) * 2)));
          drawHand(ctx, x, y + Math.sin(tR * 4 + i) * 6 * s, sc, (hash(i + 4) - 0.5) * 0.9 + Math.PI * 0.0, [200, 214, 236], 0.85 * wd * smooth(clamp01((k - 0.15) * 3)));
        }
        // spray
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let q = 0; q < 40; q++) { const ph = (tR * 1.4 + hash(q)) % 1; ctx.fillStyle = rgba(170, 190, 225, 0.3 * wd * (1 - ph)); ctx.fillRect(hash(q + 3) * width, crest + 40 * s + ph * 300 * s, 2 * s, (30 + 50 * hash(q + 9)) * s); }
        ctx.restore();
      }
    }

    // ---- him, from behind, on the bank (no water line)
    const sink = tR >= c.wave + 2.5 ? ep(c.wave + 2.5, c.wave + 3.4, tR) * 0.1 : 0;
    const lowered = tR >= 82.94;
    if (!lowered) {
      const yB = sh.pitch < -0.3 ? 0.935 : 0.865;
      drawNarrator(ctx, width, height, tR, { x: 0.5, headY: yB + sink, size: 1.35, waterY: 0.98, breath: 0.4 + 3 * hit, noWater: true, rim: [255, 170, 90], rimA: 0.5 });
      const steamOn = !(tR > c.scare - 0.9 && tR < c.scare - 0.0); // he holds his breath through the silence
      if (steamOn && yB < 0.9) drawSteam(ctx, width * 0.5, height * 0.80, tR, { n: 7, spread: 40 * s, rise: 120 * s, size: 34 * s, alpha: 0.24, speed: 0.32 });
    } else {
      // mud-level close: his wet hand in the mud, wet hair, the boat beside him
      const k = ep(82.94, 84.5, tR);
      const mg = ctx.createLinearGradient(0, height * 0.7, 0, height); mg.addColorStop(0, 'rgba(40,30,22,0)'); mg.addColorStop(0.25, 'rgba(46,34,25,0.97)'); mg.addColorStop(1, '#14100c');
      ctx.fillStyle = mg; ctx.fillRect(0, height * 0.68, width, height * 0.32);
      drawHand(ctx, width * 0.36 - 3 * s, height * 0.9 - 3 * s, 190 * s, 1.0, [200, 150, 100], 0.7);
      drawHand(ctx, width * 0.36, height * 0.9, 190 * s, 1.0, [10, 9, 10], 1);
      const wl = ctx.createRadialGradient(width * 0.75, height * 0.74, 0, width * 0.75, height * 0.74, 520 * s); wl.addColorStop(0, 'rgba(255,170,90,0.28)'); wl.addColorStop(1, 'rgba(255,140,60,0)'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = wl; ctx.fillRect(0, height * 0.5, width, height * 0.5); ctx.restore();
      ctx.fillStyle = '#05060a'; ctx.beginPath(); ctx.ellipse(width * 0.1, height * 0.95, 240 * s, 110 * s, -0.3, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(120, 150, 200, 0.5); ctx.lineWidth = 2 * s;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(width * (0.05 + i * 0.06), height * 0.9); ctx.lineTo(width * (0.05 + i * 0.06) + 8 * s, height * (0.9 + 0.012 * (i % 3)) + 40 * s); ctx.stroke(); }
      // drips from his sleeve
      ctx.fillStyle = rgba(160, 185, 220, 0.6); for (let i = 0; i < 3; i++) { const ph = (tR * 0.8 + i * 0.33) % 1; ctx.fillRect(width * (0.45 + i * 0.05), height * (0.88 + ph * 0.08), 3 * s, 10 * s); }
      // far out on the lake, a ring that nobody made
      const rp = cam.project([-2, 0, 40]);
      if (rp.ok) { const ph = ((tR - 84.0) * 0.35) % 1; if (tR > 84.0) { ctx.strokeStyle = rgba(190, 210, 240, 0.5 * (1 - ph)); ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.ellipse(rp.x, rp.y, 20 * s + ph * 110 * s, 4 * s + ph * 20 * s, 0, 0, TAU); ctx.stroke(); } }
    }

    // ---- the answer: window flare and a hard dark beat, then the world resumes
    if (tR >= c.scare && tR < c.scare + 0.7) { ctx.fillStyle = rgba(255, 230, 190, 0.16 * (1 - (tR - c.scare) / 0.7)); ctx.fillRect(0, 0, width, height); }
    punch(ctx, width, height, 0);
    drawVignette(ctx, width, height, 0.84 + 0.1 * prog);
    drawGrain(ctx, width, height, tR, 0.9 + 0.7 * prog);
    if (hit > 0.05) chromaticAberration(ctx, width, height, 12 * hit * s);
    const endFade = ep(D - 0.7, D - 0.1, tR); if (endFade > 0) { ctx.fillStyle = rgba(0, 0, 0, endFade); ctx.fillRect(0, 0, width, height); }
    const cap = (tl.captions || []).find((x) => tR >= x.start_s && tR <= x.end_s);
    if (cap) drawCaptionBar(ctx, { width, height, text: cap.text, highlightWord: cap.highlight || '', fontFamily: FONT });
  }
};
