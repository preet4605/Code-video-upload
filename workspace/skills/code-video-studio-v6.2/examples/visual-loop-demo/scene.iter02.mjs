// Iteration 2: cartoon kit (outlined flat vector), characters, set dressing, graphic light, camera moves.
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

export const VideoClock = {
  setTime(s) { T = s; },
  draw(ctx, w, h, tl) {
    C.useTheme('cartoon');
    const t = T, s = w / 1080, sc = sceneOf(tl, t), id = sc.id;
    const u = (t - sc.start_s) / (sc.end_s - sc.start_s);
    ctx.save(); ctx.scale(s, s);
    if (id === 'room') {
      push(ctx, 540, 1100, 1 + 0.08 * C.ease(u));
      roomSet(ctx, t);
      C.bed(ctx, { x: 400, y: 1560, w: 700, t, kid: { expr: 'scared' }, kidLook: [1, 0], kidBlink: (t % 2.7) < 0.12 ? 1 : 0 });
      nightGrade(ctx);
    } else if (id === 'door') {
      push(ctx, 900, 1240, 1.9 + 0.35 * C.ease(u));
      roomSet(ctx, t, { strip: 1, feet: C.ease((u - 0.3) / 0.3) });
      nightGrade(ctx, 0.7);
    } else {
      push(ctx, 400, 1360, 2.3 + 0.25 * C.ease(u));
      roomSet(ctx, t);
      C.bed(ctx, { x: 400, y: 1560, w: 700, t, kid: { expr: 'scared', mouthOpen: 0.5 + 0.5 * Math.sin(t * 3) }, kidLook: [1, -0.3], kidBlink: (t % 1.9) < 0.1 ? 1 : 0 });
      nightGrade(ctx, 0.6);
    }
    ctx.restore();
    const cap = tl.captions.find((c) => t >= c.start_s && t <= c.end_s);
    if (cap) drawCaptionBar(ctx, { width: w, height: h, text: cap.text, fontFamily: '"Noto Sans Devanagari", "DejaVu Sans", sans-serif' });
  }
};
