// Horror look: cold desaturated theme, darkness cut only by motivated lights, dread set dressing, dutch tilt, grain.
import * as C from '../../lib/cartoon.mjs';
import { drawCaptionBar } from '../../lib/widgets.mjs';
let T = 0;
const sceneOf = (tl, t) => tl.scenes.find((s) => t >= s.start_s && t < s.end_s) || tl.scenes[tl.scenes.length - 1];
function frame(ctx, wx, wy, z, sx, sy, rot = 0) { ctx.translate(sx, sy); ctx.rotate(rot); ctx.scale(z, z); ctx.translate(-wx, -wy); }
const BED = { x: 420, y: 1330, w: 720 };
const KID = { x: BED.x - BED.w / 2 + 195, y: BED.y - 205 };
const DOOR = { x: 770, y: 600, w: 260, h: 630 };

function roomSet(ctx, t, { strip = 1, feet = 0 } = {}) {
  const P = C.PAL;
  const g = ctx.createLinearGradient(0, 0, 0, 1250); g.addColorStop(0, P.wallShade); g.addColorStop(1, P.wall);
  ctx.fillStyle = g; ctx.fillRect(-300, -300, 1680, 1560);
  // damask-ish wallpaper stripes
  ctx.strokeStyle = C.hexA('#000000', 0.18); ctx.lineWidth = 10;
  for (let x = -280; x < 1380; x += 70) { ctx.beginPath(); ctx.moveTo(x, -300); ctx.lineTo(x, 1240); ctx.stroke(); }
  ctx.fillStyle = C.hexA('#9aa5ad', 0.05);
  for (let y = 0; y < 1240; y += 110) for (let x = -245 + ((y / 110) % 2) * 35; x < 1380; x += 70) { ctx.beginPath(); ctx.ellipse(x, y, 10, 18, 0, 0, Math.PI * 2); ctx.fill(); }
  C.grime(ctx, { x: -200, y: 80, w: 1400, h: 1100, seed: 5, n: 14, a: 0.45 });
  C.cracks(ctx, { x: 600, y: 120, len: 300, seed: 3 });
  C.cracks(ctx, { x: 120, y: 900, len: 200, seed: 9 });
  C.peel(ctx, { x: 640, y: 960, s: 1 });
  C.cobweb(ctx, { x: -60, y: -40, r: 260, corner: 'tl' });
  C.shape(ctx, C.rrect(-300, 1240, 1680, 900, 0), { fill: P.floor, lw: 7 });
  ctx.strokeStyle = C.hexA('#000000', 0.55); ctx.lineWidth = 5;
  for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(i * 150 - 350, 1250); ctx.lineTo(i * 200 - 600, 2150); ctx.stroke(); }
  C.shape(ctx, C.rrect(-300, 1225, 1680, 30, 0), { fill: P.woodShade, lw: 6 });
  ctx.fillStyle = C.hexA('#000000', 0.6); for (let i = 0; i < 12; i++) for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(i * 150 - 330 + k * 40, 1290 + k * 140, 4, 0, Math.PI * 2); ctx.fill(); }
  C.bareBulb(ctx, { x: 540, y: 330, t, on: 0 });
  C.windowMoon(ctx, { x: 150, y: 330, w: 300, t });
  ctx.save(); ctx.translate(670, 400); ctx.rotate(0.14); C.wallDecor(ctx, { x: -75, y: -90 }); ctx.restore();
  C.door(ctx, { ...DOOR, strip, feet });
  C.scratches(ctx, { x: DOOR.x + 20, y: DOOR.y + 60, w: DOOR.w - 40, h: DOOR.h - 120, seed: 6 });
  C.handprint(ctx, { x: DOOR.x + 170, y: DOOR.y + 300, s: 0.9, rot: 0.25, a: 0.5 });
  C.wallClock(ctx, { x: 560, y: 760, t, r: 62 });
  C.dollFacingWall(ctx, { x: 1000, y: 1330, s: 0.9 });
  // cold moon spill
  ctx.fillStyle = C.hexA(C.PAL.moon, 0.06); ctx.beginPath(); ctx.moveTo(150, 820); ctx.lineTo(450, 820); ctx.lineTo(700, 1750); ctx.lineTo(80, 1750); ctx.closePath(); ctx.fill();
}
function lightsFor(ctx, pts) {
  // convert world points to screen pixels for the darkness mask
  const m = ctx.getTransform();
  return pts.map((p) => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f, r: p.r * Math.hypot(m.a, m.b), a: p.a, soft: p.soft }));
}

export const VideoClock = {
  setTime(s) { T = s; },
  draw(ctx, w, h, tl) {
    C.useTheme('horror');
    const t = T, s = w / 1080, sc = sceneOf(tl, t), id = sc.id;
    const u = (t - sc.start_s) / (sc.end_s - sc.start_s);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.scale(s, s);
    let L = [];
    if (id === 'room') {
      frame(ctx, 560, 980, 1.16 + 0.08 * C.ease(u), 540, 900, -0.035);
      roomSet(ctx, t);
      C.bed(ctx, { ...BED, t, kid: { expr: 'scared' }, kidLook: [1, 0], kidBlink: (t % 2.7) < 0.12 ? 1 : 0 });
      L = lightsFor(ctx, [{ x: 300, y: 560, r: 520, a: 0.95 }, { x: 900, y: 1300, r: 420, a: 1 }, { x: 560, y: 760, r: 220, a: 0.8 }, { x: KID.x + 40, y: KID.y, r: 300, a: 0.7 }]);
    } else if (id === 'door') {
      frame(ctx, 900, 1200, 1.8 + 0.3 * C.ease(u), 540, 900, 0.02);
      roomSet(ctx, t, { strip: 1, feet: C.ease((u - 0.3) / 0.3) });
      L = lightsFor(ctx, [{ x: 900, y: 1290, r: 480, a: 1, soft: 0.35 }, { x: 900, y: 950, r: 420, a: 0.7 }]);
    } else {
      frame(ctx, KID.x + 40, KID.y + 10, 2.25 + 0.3 * C.ease(u), 540, 760, -0.02);
      roomSet(ctx, t);
      C.bed(ctx, { ...BED, t, kid: { expr: 'scared', hands: true, mouthOpen: 0.5 + 0.5 * Math.sin(t * 3) }, kidLook: [1, -0.3], kidBlink: (t % 1.9) < 0.1 ? 1 : 0 });
      const dy = (t * 18) % 60;
      C.shape(ctx, (c) => { c.moveTo(KID.x + 60, KID.y - 70 + dy); c.quadraticCurveTo(KID.x + 74, KID.y - 46 + dy, KID.x + 60, KID.y - 40 + dy); c.quadraticCurveTo(KID.x + 46, KID.y - 46 + dy, KID.x + 60, KID.y - 40 + dy); }, { fill: '#9fb4c4', lw: 3 });
      L = lightsFor(ctx, [{ x: KID.x + 120, y: KID.y - 10, r: 230, a: 1, soft: 0.4 }, { x: KID.x - 90, y: KID.y - 60, r: 140, a: 0.5 }]);
    }
    ctx.restore();
    const snap = C.snapshot(ctx, w, h);
    C.darkness(ctx, w, h, { k: 0.86, lights: L });
    C.lineGlow(ctx, snap, w, h, { strength: 0.5 });
    // warm door light and cold moon re-added on top as soft glows (light, not fill)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (L[0]) { const g = ctx.createRadialGradient(L[0].x, L[0].y, 0, L[0].x, L[0].y, L[0].r * 0.6); g.addColorStop(0, id === 'room' ? 'rgba(80,95,120,0.10)' : 'rgba(255,150,70,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
    ctx.restore();
    const v = ctx.createRadialGradient(w / 2, h * 0.45, w * 0.25, w / 2, h / 2, h * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.75)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    C.grain(ctx, w, h, t, 1.1);
    const cap = tl.captions.find((c) => t >= c.start_s && t <= c.end_s);
    if (cap) drawCaptionBar(ctx, { width: w, height: h, text: cap.text, fontFamily: '"Noto Sans Devanagari", "DejaVu Sans", sans-serif' });
  }
};
