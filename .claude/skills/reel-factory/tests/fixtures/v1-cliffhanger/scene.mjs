// v1-style: flat top-down plan, glow circles and a card. It barely moves (only the caption changes),
// but buildTimeline still declares animated_properties for every beat.
import { drawCaptionBar } from '../../../lib/widgets.mjs';
let T = 0;
export const VideoClock = {
  setTime(s) { T = s; },
  draw(ctx, w, h, tl) {
    const s = w / 1080;
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2a3350'; ctx.lineWidth = 6 * s; ctx.strokeRect(200 * s, 500 * s, 680 * s, 700 * s);
    ctx.fillStyle = '#1b2236'; ctx.fillRect(560 * s, 1150 * s, 160 * s, 50 * s);
    const g = ctx.createRadialGradient(540 * s, 850 * s, 0, 540 * s, 850 * s, 200 * s);
    g.addColorStop(0, 'rgba(255,60,60,0.35)'); g.addColorStop(1, 'rgba(255,60,60,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(260 * s, 330 * s, 560 * s, 120 * s);
    const cap = (tl.captions || []).find((c) => T >= c.start_s && T <= c.end_s);
    if (cap) drawCaptionBar(ctx, { width: w, height: h, text: cap.text, fontFamily: '"Noto Sans Devanagari", "Noto Sans", sans-serif' });
  }
};
