// props: framed inset (mirror / phone / lift display), note card, clock, diya, torch, well. All draw in design px at (x, y).
import { cin, shade, mix, rgba, TAU, Path2D, mulberry32, smoothClosed } from '../util.mjs';
import { diya as diyaPart } from '../sets/parts.mjs';

/** framedInset(c, {x,y,w,h,kind:'mirror'|'phone'|'lift', content(c,w,h), t, radius}) : clipped inner view + glass sheen + frame. */
export function framedInset(c, o) {
  const { x, y, w, h, kind = 'mirror', content, t = 0, radius = kind === 'phone' ? 36 : 10 } = o;
  c.save(); c.translate(x, y);
  const frame = { mirror: '#3a2a1c', phone: '#0b0b0d', lift: '#9a9ea4' }[kind], bw = kind === 'phone' ? 14 : kind === 'lift' ? 10 : 20;
  c.fillStyle = frame; c.beginPath(); c.roundRect(-bw, -bw, w + bw * 2, h + bw * 2, radius + bw * 0.6); c.fill();
  c.save(); c.beginPath(); c.roundRect(0, 0, w, h, radius); c.clip();
  c.fillStyle = kind === 'lift' ? '#120806' : kind === 'phone' ? '#0b1220' : '#2a3038'; c.fillRect(0, 0, w, h);
  if (content) content(c, w, h, t);
  // glass: diagonal sheen + edge darkening
  c.globalCompositeOperation = 'screen'; const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, rgba('#fff', 0.16)); g.addColorStop(0.35, rgba('#fff', 0)); g.addColorStop(0.7, rgba('#fff', 0.05)); g.addColorStop(1, rgba('#fff', 0)); c.fillStyle = g; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over';
  const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75); v.addColorStop(0, rgba('#000', 0)); v.addColorStop(1, rgba('#000', 0.4)); c.fillStyle = v; c.fillRect(0, 0, w, h);
  c.restore();
  c.strokeStyle = rgba('#fff', 0.25); c.lineWidth = 2; c.beginPath(); c.roundRect(0, 0, w, h, radius); c.stroke();
  if (kind === 'mirror') { c.strokeStyle = rgba('#d9b36a', 0.7); c.lineWidth = 3; c.strokeRect(-bw + 4, -bw + 4, w + bw * 2 - 8, h + bw * 2 - 8); }
  c.restore();
}
/** lift floor display: seven-segment-ish digits in red/amber. */
export function liftDisplay(c, o) {
  const { x, y, w = 160, h = 90, text = '3', color = '#ff4a2a', t = 0 } = o, on = 0.85 + 0.15 * Math.sin(t * 40);
  framedInset(c, { x, y, w, h, kind: 'lift', t, content: (cc, ww, hh) => { cc.fillStyle = color; cc.shadowColor = color; cc.shadowBlur = 18; cc.font = `bold ${hh * 0.78}px monospace`; cc.textAlign = 'center'; cc.textBaseline = 'middle'; cc.globalAlpha = on; cc.fillText(text, ww / 2, hh / 2 + 4); } });
}
/** paper note: slightly rotated card with a fold crease, torn edge, ink lines. */
export function noteCard(c, o) {
  const { x, y, w = 380, h = 240, rot = -0.05, lines = ['do not hold', 'anyone\'s hand'], paper = '#e9dfc4', ink = '#2a1a12', seed = 1, font = 'bold 44px "Noto Sans", sans-serif' } = o, r = mulberry32(seed);
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = rgba('#000', 0.35); c.beginPath(); c.roundRect(10, 14, w, h, 6); c.fill();
  const pts = []; for (let i = 0; i <= 10; i++) pts.push([(i / 10) * w, (r() - 0.5) * 5]); for (let i = 0; i <= 6; i++) pts.push([w + (r() - 0.5) * 4, (i / 6) * h]); for (let i = 10; i >= 0; i--) pts.push([(i / 10) * w, h + (r() - 0.5) * 6]); for (let i = 6; i >= 0; i--) pts.push([(r() - 0.5) * 4, (i / 6) * h]);
  const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) p.lineTo(q[0], q[1]); p.closePath();
  c.fillStyle = paper; c.fill(p); c.save(); c.clip(p); cin.fillTexture(c, 'plaster', [0, 0, w, h], { alpha: 0.3, scale: 0.8, ox: 0, oy: 0, seed });
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, rgba('#fff', 0.2)); g.addColorStop(1, rgba('#5a3a10', 0.25)); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = rgba('#000', 0.1); c.fillRect(0, h * 0.5 - 2, w, 4);
  c.fillStyle = ink; c.font = font; c.textAlign = 'center'; lines.forEach((l, i) => c.fillText(l, w / 2, h * 0.38 + i * 58)); c.restore();
  c.restore();
}
/** wall or table clock with hands set from t (or explicit h, m). Face is lit from upper-left. */
export function clock(c, o) {
  const { x, y, r = 90, h = 3, m = 7, glow = false, face = '#e9e2cf', t = 0 } = o;
  c.save(); c.translate(x, y);
  c.fillStyle = rgba('#000', 0.35); c.beginPath(); c.arc(8, 10, r * 1.08, 0, TAU); c.fill();
  const rg = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r * 1.1); rg.addColorStop(0, '#6b5238'); rg.addColorStop(1, '#1c120a'); c.fillStyle = rg; c.beginPath(); c.arc(0, 0, r * 1.06, 0, TAU); c.fill();
  const fg = c.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r); fg.addColorStop(0, shade(face, 0.1)); fg.addColorStop(1, shade(face, -0.25)); c.fillStyle = fg; c.beginPath(); c.arc(0, 0, r * 0.92, 0, TAU); c.fill();
  c.strokeStyle = '#2a1c10'; c.lineCap = 'round'; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; c.lineWidth = i % 3 === 0 ? r * 0.06 : r * 0.03; c.beginPath(); c.moveTo(Math.sin(a) * r * 0.72, -Math.cos(a) * r * 0.72); c.lineTo(Math.sin(a) * r * 0.82, -Math.cos(a) * r * 0.82); c.stroke(); }
  const ha = ((h % 12) + m / 60) / 12 * TAU, ma = (m / 60) * TAU;
  c.lineWidth = r * 0.07; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(ha) * r * 0.45, -Math.cos(ha) * r * 0.45); c.stroke(); c.lineWidth = r * 0.045; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(ma) * r * 0.7, -Math.cos(ma) * r * 0.7); c.stroke();
  c.fillStyle = '#b3241f'; c.beginPath(); c.arc(0, 0, r * 0.05, 0, TAU); c.fill();
  c.fillStyle = rgba('#fff', 0.35); c.beginPath(); c.ellipse(-r * 0.35, -r * 0.45, r * 0.4, r * 0.18, -0.6, 0, TAU); c.fill();
  if (glow) { c.globalCompositeOperation = 'screen'; const g = c.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 2.2); g.addColorStop(0, rgba('#ffd58a', 0.25)); g.addColorStop(1, rgba('#ffd58a', 0)); c.fillStyle = g; c.fillRect(-r * 2.2, -r * 2.2, r * 4.4, r * 4.4); }
  c.restore();
}
/** diya / oil lamp with flickering flame (emissive glow included). */
export function diya(c, o) { diyaPart(c, o.x, o.y, o.s ?? 1, o.t ?? 0, { flame: o.flame ?? true, seed: o.seed ?? 1 }); }
/** torch: a hand torch body pointing along `angle` with an emissive lens; returns the cone light for darkMask. */
export function torch(c, o) {
  const { x, y, angle = 0.3, len = 170, w = 46, color = '#fff4cf', range = 1100, spread = 0.3 } = o;
  c.save(); c.translate(x, y); c.rotate(angle);
  const g = c.createLinearGradient(0, -w / 2, 0, w / 2); g.addColorStop(0, '#6a6e76'); g.addColorStop(0.45, '#2a2c32'); g.addColorStop(1, '#0a0a0c'); c.fillStyle = g; c.beginPath(); c.roundRect(-len / 2, -w / 2, len, w, 10); c.fill();
  c.fillStyle = '#17181c'; c.beginPath(); c.roundRect(len / 2 - 10, -w * 0.72, 34, w * 1.44, 8); c.fill(); c.fillStyle = color; c.beginPath(); c.ellipse(len / 2 + 24, 0, 8, w * 0.62, 0, 0, TAU); c.fill();
  c.strokeStyle = rgba('#fff', 0.35); c.lineWidth = 3; c.beginPath(); c.moveTo(-len / 2 + 14, -w / 2 + 6); c.lineTo(len / 2 - 14, -w / 2 + 6); c.stroke(); c.restore();
  const lx = x + Math.cos(angle) * (len / 2 + 24), ly = y + Math.sin(angle) * (len / 2 + 24);
  return { type: 'cone', x: lx, y: ly, angle, spread, length: range, color, intensity: 1.0 };
}
/** a well (parapet cylinder + dark water + wooden frame). cx,cy = base centre. */
export function well(c, o) {
  const { cx, cy, rx = 150, hgt = 86, wood = '#3b2a1c', stone = '#cfc6ae' } = o, ry = rx * 0.35;
  const body = new Path2D(); body.moveTo(cx - rx, cy - hgt); body.lineTo(cx - rx, cy); body.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); body.lineTo(cx + rx, cy - hgt); body.closePath();
  const bg = c.createLinearGradient(cx - rx, 0, cx + rx, 0); bg.addColorStop(0, shade(stone, 0.05)); bg.addColorStop(0.5, shade(stone, -0.2)); bg.addColorStop(1, shade(stone, -0.6)); c.fillStyle = bg; c.fill(body);
  c.save(); c.clip(body); cin.fillTexture(c, 'brick', [cx - rx, cy - hgt - 10, rx * 2, hgt + ry + 20], { alpha: 0.5, scale: 0.9, ox: cx - rx, oy: cy - hgt }); c.restore();
  c.fillStyle = shade(stone, 0.1); c.beginPath(); c.ellipse(cx, cy - hgt, rx, ry, 0, 0, TAU); c.fill(); c.fillStyle = '#040404'; c.beginPath(); c.ellipse(cx, cy - hgt + 2, rx - 22, ry - 12, 0, 0, TAU); c.fill();
  c.strokeStyle = wood; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - rx + 20, cy - hgt + 6); c.lineTo(cx - rx + 20, cy - hgt - 230); c.moveTo(cx + rx - 20, cy - hgt + 6); c.lineTo(cx + rx - 20, cy - hgt - 230); c.moveTo(cx - rx + 8, cy - hgt - 226); c.lineTo(cx + rx - 8, cy - hgt - 226); c.stroke();
}
