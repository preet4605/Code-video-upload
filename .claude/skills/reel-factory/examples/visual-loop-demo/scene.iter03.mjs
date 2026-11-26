// Iteration 3 (after critique 2): cartoon kit (outlined flat vector), characters, set dressing, graphic light, camera moves.
import * as C from '../../lib/cartoon.mjs';
import { drawCaptionBar } from '../../lib/widgets.mjs';
let T = 0;
const sceneOf = (tl, t) => tl.scenes.find((s) => t >= s.start_s && t < s.end_s) || tl.scenes[tl.scenes.length - 1];

function roomSet(ctx, t, { strip = 1, feet = 0 } = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#2a2f63'); g.addColorStop(0.62, C.PAL.wall);
  ctx.fillStyle = g; ctx.fillRect(-200, -200, 1480, 2320);
  ctx.fillStyle = C.hexA('#ffffff', 0.05);
  for (let y = 120; y < 1250; y += 90) for (let x = ((y / 90) % 2) * 45 - 200; x < 1280; x += 90) { ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); }
  C.shape(ctx, C.rrect(-220, 1240, 1520, 900, 0), { fill: C.PAL.floor, lw: 7 });
  ctx.strokeStyle = C.hexA(C.INK, 0.4); ctx.lineWidth = 5;
  for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.moveTo(i * 150 - 250, 1250); ctx.lineTo(i * 200 - 450, 2100); ctx.stroke(); }
  C.shape(ctx, C.rrect(-220, 1225, 1520, 30, 0), { fill: C.PAL.woodShade, lw: 6 });
  C.ceilingFan(ctx, { x: 540, y: 190, t });
  C.windowMoon(ctx, { x: 190, y: 330, w: 300, t });
  C.door(ctx, { x: 770, y: 600, w: 260, h: 630, strip, feet });
  C.wallClock(ctx, { x: 560, y: 700, t });
  C.wallDecor(ctx, { x: 600, y: 330 });
  ctx.fillStyle = C.hexA(C.PAL.moon, 0.08); ctx.beginPath(); ctx.moveTo(190, 820); ctx.lineTo(490, 820); ctx.lineTo(700, 1700); ctx.lineTo(120, 1700); ctx.closePath(); ctx.fill();
}
function nightGrade(ctx, k = 0.55) {
  const v = ctx.createRadialGradient(540, 1000, 300, 540, 1000, 1200);
  v.addColorStop(0, 'rgba(10,8,30,0)'); v.addColorStop(1, `rgba(10,8,30,${k})`);
  ctx.fillStyle = v; ctx.fillRect(-200, -200, 1480, 2320);
}
function push(ctx, fx, fy, z) { ctx.translate(fx, fy); ctx.scale(z, z); ctx.translate(-fx, -fy); }
// put world point (wx, wy) at screen point (sx, sy) with zoom z
function frame(ctx, wx, wy, z, sx, sy) { ctx.translate(sx, sy); ctx.scale(z, z); ctx.translate(-wx, -wy); }
const BED = { x: 420, y: 1380, w: 720 };
const KID = { x: BED.x - BED.w / 2 + 195, y: BED.y - 205 };
function doorDressing(ctx, t) {
  // switchboard + hanging school bag on the wall, slippers and a rug in the light spill
  C.shape(ctx, C.rrect(640, 820, 70, 110, 10), { fill: '#e8e1d4', lw: 5 });
  for (let i = 0; i < 2; i++) C.shape(ctx, C.rrect(654 + i * 26, 840, 16, 30, 4), { fill: '#c9c0b0', lw: 3 });
  C.line(ctx, [[620, 960], [600, 1010]], { lw: 5 });
  C.shape(ctx, C.rrect(540, 1000, 140, 170, 30), { fill: '#d9485f', shadePath: C.rrect(540, 1100, 140, 70, 0), shadeFill: '#b5374d', lw: 6 });
  C.shape(ctx, C.rrect(565, 1030, 90, 50, 12), { fill: '#f2c14e', lw: 4 });
  C.shape(ctx, C.ellipse(820, 1500, 200, 40), { fill: '#7a4a8a', shadePath: C.ellipse(820, 1520, 200, 22), shadeFill: '#5e3770', lw: 6 });
  for (let k = 0; k < 6; k++) C.line(ctx, [[640 + k * 72, 1478], [652 + k * 72, 1522]], { lw: 3, ink: C.hexA('#f2c14e', 0.8) });
  for (const [sx, rot] of [[700, -0.2], [770, 0.15]]) { ctx.save(); ctx.translate(sx, 1420); ctx.rotate(rot); C.shape(ctx, C.rrect(-24, -50, 48, 100, 22), { fill: '#3e8e7e', lw: 5 }); C.shape(ctx, C.rrect(-22, -20, 44, 14, 6), { fill: '#2b6b5e', lw: 3 }); ctx.restore(); }
}

export const VideoClock = {
  setTime(s) { T = s; },
  draw(ctx, w, h, tl) {
    C.useTheme('cartoon');
    const t = T, s = w / 1080, sc = sceneOf(tl, t), id = sc.id;
    const u = (t - sc.start_s) / (sc.end_s - sc.start_s);
    ctx.save(); ctx.scale(s, s);
    if (id === 'room') {
      push(ctx, KID.x, KID.y, 1 + 0.08 * C.ease(u));
      roomSet(ctx, t);
      C.glow(ctx, KID.x + 60, KID.y, 260, C.PAL.doorLight, 0.22);
      C.bed(ctx, { ...BED, t, kid: { expr: 'scared' }, kidLook: [1, 0], kidBlink: (t % 2.7) < 0.12 ? 1 : 0 });
      nightGrade(ctx);
    } else if (id === 'door') {
      frame(ctx, 880, 1240, 1.75 + 0.3 * C.ease(u), 540, 980);
      roomSet(ctx, t, { strip: 1, feet: C.ease((u - 0.3) / 0.3) });
      doorDressing(ctx, t);
      nightGrade(ctx, 0.65);
    } else {
      frame(ctx, KID.x + 40, KID.y - 10, 2.6 + 0.3 * C.ease(u), 540, 760);
      roomSet(ctx, t);
      C.glow(ctx, KID.x + 160, KID.y - 40, 320, C.PAL.doorLight, 0.3);
      C.bed(ctx, { ...BED, t, kid: { expr: 'scared', mouthOpen: 0.5 + 0.5 * Math.sin(t * 3) }, kidLook: [1, -0.3], kidBlink: (t % 1.9) < 0.1 ? 1 : 0 });
      // a sweat drop that slides down
      const dy = (t * 18) % 60;
      C.shape(ctx, (c) => { c.moveTo(KID.x + 60, KID.y - 70 + dy); c.quadraticCurveTo(KID.x + 74, KID.y - 46 + dy, KID.x + 60, KID.y - 40 + dy); c.quadraticCurveTo(KID.x + 46, KID.y - 46 + dy, KID.x + 60, KID.y - 70 + dy); }, { fill: '#9fd8ff', lw: 3 });
      nightGrade(ctx, 0.55);
    }
    ctx.restore();
    const cap = tl.captions.find((c) => t >= c.start_s && t <= c.end_s);
    if (cap) drawCaptionBar(ctx, { width: w, height: h, text: cap.text, fontFamily: '"Noto Sans Devanagari", "DejaVu Sans", sans-serif' });
  }
};
