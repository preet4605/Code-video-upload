// Iteration 1: a typical quick first draft (flat fills, few props, no outlines on the set).
import { drawCaptionBar } from '../../lib/widgets.mjs';
let T = 0;
const sceneOf = (tl, t) => tl.scenes.find((s) => t >= s.start_s && t < s.end_s) || tl.scenes[tl.scenes.length - 1];
export const VideoClock = {
  setTime(s) { T = s; },
  draw(ctx, w, h, tl) {
    const t = T, s = w / 1080, id = sceneOf(tl, t).id;
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#20243f'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = '#2b2440'; ctx.fillRect(0, 1250, 1080, 670);
    if (id === 'room') {
      ctx.fillStyle = '#5a4030'; ctx.fillRect(160, 1150, 760, 260);
      ctx.fillStyle = '#4d6fa8'; ctx.fillRect(160, 1180, 760, 160);
      ctx.fillStyle = '#3a2a20'; ctx.fillRect(780, 600, 240, 640);
    } else if (id === 'door') {
      ctx.fillStyle = '#3a2a20'; ctx.fillRect(240, 300, 600, 1200);
      ctx.fillStyle = '#ffbe5c'; ctx.fillRect(250, 1490, 580, 14);
    } else {
      ctx.fillStyle = '#f5b98c'; ctx.beginPath(); ctx.arc(540, 900, 260, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(460, 880, 30, 0, Math.PI * 2); ctx.arc(620, 880, 30, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    const cap = tl.captions.find((c) => t >= c.start_s && t <= c.end_s);
    if (cap) drawCaptionBar(ctx, { width: w, height: h, text: cap.text, fontFamily: '"Noto Sans Devanagari", "DejaVu Sans", sans-serif' });
  }
};
