// आख़िरी नाव part 2a "नाम": he wades to the lit boat, answers the kind voice, the lights die, a small hand shoves him ashore.
// Everything derives from t + timeline. Camera: behind his shoulder (like ep1), always moving, handheld grows toward the scare.
import {
  makeCamera, handheld, drawVignette, drawGrain, hitPulse, smooth, clamp01, lerp, chromaticAberration, hash, rgba, TAU,
  paintSky, paintRidge, paintWater, paintReflection, ringsFrom, paintRing, drawBoat, drawHand, drawNarrator, drawSteam, mist, drawShore, drawGrip, punch,
  lanternWorld, windowWorld, FONT, cue, sceneOf, horizonY
} from '../lake_kit.mjs';
import { drawCaptionBar } from '/mnt/project-files/skills/code-video-studio-v6.1/lib/widgets.mjs';

let T = 0;
const BOAT = { x: -0.25, z: 17 };
const ep = (a, b, t) => smooth((t - a) / (b - a));

function wordStarts(tl, line) { return (tl.words || []).filter((w) => w.line === line).map((w) => w.start_s); }

function shotAt(t, c) {
  const dS = c.scare - 73.18;
  // piecewise camera: [t0, t1, from{x,y,z,yaw,pitch,fov}, to{...}]
  const S = [
    [0, 4.79, [0, 1.35, -3.2, 0, -0.045, 46], [0, 1.35, -1.6, 0.0, -0.05, 44]],
    [4.79, 11.68, [0, 1.3, -1.6, 0, -0.05, 44], [0, 1.1, 1.0, 0.0, -0.17, 46]],
    [11.68, 21.61, [0, 1.15, 1.0, 0, -0.1, 54], [0, 1.15, 2.4, 0, -0.08, 54]],
    [21.61, 29.02, [0, 1.1, 2.4, 0, -0.09, 54], [0, 1.0, 6.4, 0.0, -0.07, 52]],
    [29.02, 37.96, [0, 1.0, 6.4, 0, -0.04, 52], [-0.15, 0.95, 11.2, -0.02, 0.0, 48]],
    [37.96, 45.13, [-0.15, 0.95, 11.2, -0.02, 0.0, 48], [-1.8, 0.85, 14.0, -0.29, -0.14, 46]],
    [45.13, 49.49, [-1.8, 0.85, 14.0, -0.29, -0.14, 46], [-1.5, 0.9, 13.2, -0.27, -0.1, 48]],
    [49.49, 63.03, [-1.5, 0.9, 13.2, -0.27, -0.14, 48], [0.0, 1.25, 5.5, 0.0, -0.06, 48]],
    [63.03, c.scare, [0.0, 1.25, 5.5, 0.0, -0.06, 48], [0.0, 1.2, 7.2, 0.0, -0.04, 44]],
    [c.scare, 78.45 + dS, [0.0, 1.2, 7.2, 0, -0.04, 44], [0.0, 0.9, 7.8, 0.0, -0.08, 42]],
    [78.45 + dS, 99, [0.0, 0.9, 7.8, 0.0, -0.06, 42], [0.0, 1.1, 1.5, 0.0, -0.08, 56]]
  ];
  let seg = S[S.length - 1];
  for (const s of S) if (t >= s[0] && t < s[1]) { seg = s; break; }
  const k = clamp01((t - seg[0]) / Math.max(0.01, seg[1] - seg[0]));
  const e = seg === S[S.length - 1] ? Math.pow(k, 0.7) : smooth(k);
  const L = (i) => lerp(seg[2][i], seg[3][i], e);
  let yaw = L(3);
  // the glance back at the shore while he remembers calling
  const turn = ep(12.0, 14.2, t) - ep(18.8, 21.0, t);
  const pushTurn = ep(78.55 + dS, 80.2 + dS, t);
  yaw += turn * Math.PI + pushTurn * Math.PI;
  return { x: L(0), y: L(1), z: L(2), yaw, pitch: L(4), fov: L(5), turn, pushTurn };
}

export const VideoClock = {
  setTime(s) { T = s; },
  draw(ctx, width, height, tl) {
    const t = T, D = tl.duration_s || 83.5, s = width / 1080;
    const c = { scare: cue(tl, 'lights_out_grip', 73.2) };
    const dS = c.scare - 73.18;
    const slap = cue(tl, 'small_hand_slap', 78.55), voiceT = cue(tl, 'name_in_water', 49.6);
    const hit = hitPulse(t, [c.scare, slap], 7);
    const prog = clamp01(t / D);
    const sc = sceneOf(tl, t); const id = sc ? sc.id : 'hook';
    const dark = t >= c.scare;
    const afterGrip = t >= c.scare + 0.0;
    const sh = shotAt(t, c);
    const amp = 0.45 + 2.2 * prog * prog + (t > c.scare ? 9 : 0) * (1 - ep(c.scare + 4.5, c.scare + 5.2, t)) + 8 * hit + (t >= slap ? 12 * (1 - ep(slap, slap + 2.2, t)) : 0);
    const cam = makeCamera({ pos: [sh.x, sh.y, sh.z], yaw: sh.yaw, pitch: sh.pitch, fov: sh.fov - 5 * hit, width, height, shake: handheld(t, amp, 2) });
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);

    const dusk = 1 - smooth((t - 2) / 26);                // last orange light dies over the first half
    const warm = ep(21.8, 24.2, t) * (1 - ep(c.scare - 0.05, c.scare + 0.1, t)); // the lake turns body-warm
    const win = dark ? 0 : 1 - 0.0 * warm;
    const voiceOn = t >= voiceT - 0.05 && t < c.scare;
    // lights state
    const lanternOn = t < c.scare ? 1 : (t > 80.2 + dS ? 0.28 + 0.07 * Math.sin(t * 7) : 0);
    const winPulse = (t > 29.1 && t < 49.4) ? 0.82 + 0.18 * Math.sin(t * 5.3) * Math.sin(t * 1.7) : 1; // murmur
    const lakeWords = wordStarts(tl, 7);
    const wordGlow = (() => { let g = 0; for (const w0 of lakeWords) { const a = t - w0; if (a >= 0 && a < 0.5) g = Math.max(g, 1 - a / 0.5); } return g; })();

    // ---- world
    paintSky(ctx, cam, t, { dusk, moonEl: 0.24, moonAz: dark ? lerp(0.42, 0.06, ep(c.scare, c.scare + 1.4, t)) : 0.42, moonDim: dark ? 1.5 : 1 });
    paintRidge(ctx, cam, { t, rimA: dark ? 1 : 0.45 });
    paintWater(ctx, cam, dark ? t + (t - c.scare) * 1.6 : t, { dusk, bright: dark ? 3.2 : 1 });
    const boatO = { x: BOAT.x, z: BOAT.z, t, lit: dark ? 0 : 1, win: dark ? 0 : win * winPulse, lantern: lanternOn, warm, breath: 0.2 + warm * 0.8 + (t > 38 ? 0.8 : 0), flicker: 1, bob: 1 };
    if (t >= 29.1 && t < 49.4) {
      boatO.fog = ep(29.4, 33, t) * 0.7 * (1 - ep(48, 49.4, t));
      boatO.palms = [[-0.45, 0.12, 0.28, -0.2], [-0.1, -0.12, 0.3, 0.1], [0.3, 0.18, 0.27, 0.25], [0.55, -0.1, 0.3, -0.15], [-0.25, 0.3, 0.25, 0.05], [0.05, 0.28, 0.27, -0.1], [0.62, 0.25, 0.25, 0.2]]
        .map((p, i) => ({ x: p[0], y: p[1], s: p[2], r: p[3], a: ep(30.0 + i * 0.7, 31.0 + i * 0.7, t) * (1 - ep(46.5, 49, t)) }));
    }
    if (voiceOn) boatO.paneGlow = [0.35 + wordGlow, 0.5 + wordGlow * 0.8, 0.3 + wordGlow * 0.9, 0.45 + wordGlow * 0.7].map((v) => clamp01(v));
    if (t >= voiceT - 0.05 && t < c.scare) boatO.win = win * (0.5 + 0.5 * Math.max(wordGlow, (t > lakeWords[lakeWords.length - 1] + 0.6 ? 0.75 : 0.35) + 0.1 * Math.sin(t * 2)));
    // reflections of the light on the black water
    if (!dark || lanternOn > 0.05) paintReflection(ctx, cam, lanternWorld({ x: BOAT.x, z: BOAT.z }), t, { color: [255, 170, 80], alpha: 0.75 * lanternOn, widthM: 0.3, lenPx: 640 });
    if (!dark) paintReflection(ctx, cam, windowWorld({ x: BOAT.x, z: BOAT.z }), t, { color: [255, 195, 120], alpha: 0.55 * (boatO.win), widthM: 0.9, lenPx: 560, wob: 1.4 });
    // ripples: his own breathing rings, the voice rings under the boat
    const nz = cam.pos[2];
    if (t < 29) ringsFrom(ctx, cam, t, cam.pos[0], nz + 0.7, Array.from({ length: 24 }, (_, i) => 0.3 + i * 1.25), { life: 3.4, speed: 0.5, a: 0.5 });
    if (voiceOn) ringsFrom(ctx, cam, t, BOAT.x + 0.3, BOAT.z - 1.4, lakeWords, { life: 2.8, speed: 1.1, a: 0.55, color: [255, 200, 130], squash: 1 });
    if (t >= 45) ringsFrom(ctx, cam, t, cam.pos[0], nz + 0.8, [47, 52, 56.5, 60, 66.3, 69.4], { life: 3, speed: 0.55, a: 0.45 });
    if (dark) {
      const hy2 = horizonY(cam), pl = 0.85 + 0.15 * Math.sin(t * 5.5), top = hy2 - 640 * s, bot = hy2 + 60 * s, gl = ctx.createLinearGradient(0, top, 0, bot);
      gl.addColorStop(0, 'rgba(120,160,225,0)'); gl.addColorStop(0.45, rgba(165, 198, 245, 0.85 * pl)); gl.addColorStop(0.8, rgba(140, 175, 232, 0.7 * pl)); gl.addColorStop(1, 'rgba(70,100,160,0)');
      ctx.save(); ctx.fillStyle = gl; ctx.fillRect(0, top, width, bot - top); ctx.restore();
      ctx.strokeStyle = rgba(210, 230, 255, 0.95); ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(0, hy2); ctx.lineTo(width, hy2); ctx.stroke();
    }
    const bd = drawBoat(ctx, cam, boatO);
    if (turnShore(sh)) drawShore(ctx, cam, t, { x: 0, z: -8.5, lamp: 1 });
    // low mist along the water
    mist(ctx, width, height, t, { y: horizonY(cam) + 30 * s, hh: 90 * s, alpha: 0.1 + 0.05 * warm, color: warm > 0.2 ? [180, 165, 160] : [110, 130, 170] });
    // warm steam off the water near the boat
    if (warm > 0.02) {
      for (let k = 0; k < 6; k++) {
        const p = cam.project([BOAT.x - 3 + k * 1.2, 0, BOAT.z - 2 - (k % 2) * 3.5]);
        if (p.ok) drawSteam(ctx, p.x, p.y, t, { n: 10, spread: 160 * s, rise: 320 * s, size: 74 * s, alpha: 0.34 * warm, speed: 0.12, seed: k, color: [255, 205, 150], drift: 20 * s });
      }
    }
    if (!dark) { ctx.fillStyle = rgba(0, 0, 8, 0.17 * ep(8, 24, t)); ctx.fillRect(0, 0, width, height); }
    // warm grade
    if (warm > 0.01) { ctx.fillStyle = rgba(255, 140, 60, 0.04 * warm); ctx.fillRect(0, 0, width, height); }

    // his right hand reaches for the jacket (jacket + relief)
    if (t >= 40.2 && t < 49.4) {
      const a = ep(40.2, 43.6, t), p0 = [width * 0.78, height * 1.02], p1 = bd && bd.jacket ? [bd.jacket.x + 20 * s, bd.jacket.y + 26 * s] : [width * 0.45, height * 0.6];
      const hx = lerp(p0[0], p1[0], a), hy = lerp(p0[1], p1[1], a) + Math.sin(t * 22) * 1.8 * s * (1 - a);
      drawHand(ctx, hx, hy, 175 * s * lerp(1.2, 0.8, a), -0.35, [6, 8, 14], 1);
      ctx.save(); ctx.strokeStyle = rgba(255, 150, 90, 0.4); ctx.lineWidth = 2 * s; ctx.restore();
    }
    // relief: one steady beat of light and a tear-glint
    // the breath on "हाँ"
    const hanT = (tl.words || []).filter((w) => w.line === 10).map((w) => w.start_s)[0] ?? 72.9;
    if (t >= hanT - 0.1 && t < c.scare + 0.2) drawSteam(ctx, width * 0.5, height * 0.79, t - hanT, { n: 12, spread: 80 * s, rise: 300 * s, size: 70 * s, alpha: 0.5, speed: 0.7, seed: 4 });

    // ---- grip: black water, pale fingers closing, a single dead flicker
    if (dark) {
      const g = t - c.scare;
      ctx.fillStyle = `rgba(0,0,4,${(t < slap ? 0.16 : lerp(0.16, 0.1, ep(slap, slap + 3.5, t))) - 0.04 * Math.sin(t * 6)})`; ctx.fillRect(0, 0, width, height);
      if (t < slap + 0.1) {
        const amt = ep(c.scare + 0.15, c.scare + 3.9, t);
        const cxn = width * 0.5, cyn = height * 0.9;
        { const lg = ctx.createRadialGradient(cxn, cyn - 120 * s, 20 * s, cxn, cyn - 120 * s, 620 * s); lg.addColorStop(0, rgba(110, 150, 215, 0.34 + 0.08 * Math.sin(t * 9))); lg.addColorStop(1, 'rgba(60,90,150,0)'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = lg; ctx.fillRect(0, 0, width, height); ctx.restore(); }
        drawGrip(ctx, cxn, cyn, width, t, amt, { a: 1 });
        for (let k = 0; k < 5; k++) { const r = lerp(520, 140, smooth(amt)) * s * (1 - k * 0.12); paintRing(ctx, cam, cam.pos[0], cam.pos[2] + 0.8, 0.6 + (1 - amt) * 2.2 + k * 0.2, 0.0); }
        // pressure vignette tightens
        const rg = ctx.createRadialGradient(width / 2, height * 0.88, 80 * s, width / 2, height * 0.88, lerp(900, 520, smooth(amt)) * s); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.6, 'rgba(0,0,2,0.25)'); rg.addColorStop(1, 'rgba(0,0,2,0.55)');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, width, height);
      }
      // moon line stays so it is not a flat black
    }
    if (!dark && t > c.scare - 6) { /* the pre-scare drain: the light thins without flashing */ ctx.fillStyle = rgba(0, 0, 6, 0.1 * ep(c.scare - 6, c.scare - 0.2, t)); ctx.fillRect(0, 0, width, height); }

    // ---- him (back of head, bottom of frame like ep1); fades out while his head is turned to the shore
    const visN = 1 - clamp01(sh.turn * 1.6);
    const sink = t < 11.7 ? lerp(0.0, 0.07, ep(0, 8, t)) : 0.07;
    if (visN > 0.02) {
      ctx.save(); ctx.globalAlpha = visN;
      const lean = t > 63 && t < c.scare ? 1 : 0;
      drawNarrator(ctx, width, height, t, { x: 0.5 + (t > 63 ? 0.02 : 0), headY: 0.865 + (t > 63 ? -0.012 * ep(63, 72.5, t) : 0), size: 1.35, waterY: 0.945, breath: 1 + 3 * hit, sink: sink * 0.35, rimA: dark ? 0.55 : 0.5, rim: dark ? [150, 175, 225] : warm > 0.3 ? [255, 190, 130] : [255, 170, 90], lean: lean * 0.15 });
      ctx.restore();
      // breath steam from him
      const bAmt = (t < 12 ? 1 : t < 45 ? 0.8 : 0.5) * (dark ? 0.3 : 1);
      if (!(warm > 0.3 && t < 45)) drawSteam(ctx, width * 0.5, height * 0.80, t, { n: 7, spread: 40 * s, rise: 120 * s, size: 34 * s, alpha: 0.22 * bAmt * visN, speed: 0.34 });
    }
    // the small wet hand: a pale print on his right shoulder blade, then the shove
  if (t >= slap) {
    const a = clamp01((t - slap) / 0.12), fadeOut = 1 - ep(slap + 3.2, slap + 4.4, t);
    const hx = width * 0.58, hy = height * 0.86;
    drawHand(ctx, hx, hy - 22 * s * (1 - a), 120 * s, 0.25, [170, 190, 220], 0.6 * a * fadeOut);
    // drips
    ctx.fillStyle = rgba(170, 190, 220, 0.5 * a * fadeOut); for (let k = 0; k < 4; k++) { const dx = (k - 1.5) * 30 * s; ctx.fillRect(hx + dx, hy + 70 * s, 3 * s, (30 + 40 * hash(k)) * s * clamp01((t - slap) / 0.9)); }
    // surge: spray streaks
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 60; k++) { const ph = ((t - slap) * 2.4 + hash(k)) % 1, x = hash(k + 5) * width, y = lerp(height * 0.95, height * 0.55, ph); ctx.fillStyle = rgba(150, 175, 215, 0.25 * (1 - ph)); ctx.fillRect(x, y, 2 * s, (40 + 60 * hash(k + 9)) * s); }
    ctx.restore();
  }
    // ---- finish
    punch(ctx, width, height, 0);
    drawVignette(ctx, width, height, 0.84 + 0.1 * prog);
    drawGrain(ctx, width, height, t, 0.9 + 0.7 * prog);
    if (hit > 0.05) chromaticAberration(ctx, width, height, 12 * hit * s);
    // final cut to black on the last word
    const endFade = ep(D - 0.55, D - 0.05, t); if (endFade > 0) { ctx.fillStyle = rgba(0, 0, 0, endFade); ctx.fillRect(0, 0, width, height); }
    const cap = (tl.captions || []).find((x) => t >= x.start_s && t <= x.end_s);
    if (cap) drawCaptionBar(ctx, { width, height, text: cap.text, highlightWord: cap.highlight || '', fontFamily: FONT });
  }
};
function turnShore(sh) { return sh.turn > 0.05 || sh.pushTurn > 0.05; }
