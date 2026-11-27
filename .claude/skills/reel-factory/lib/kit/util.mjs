// kit/util: shared helpers for sets, figures and props. Pure functions of their inputs (no Math.random / Date).
import { Path2D } from '@napi-rs/canvas';
import * as cin from '../cinema/index.mjs';
import { mulberry32 } from '../scene3d.mjs';

export { cin, Path2D, mulberry32 };
export const DW = 1080, DH = 1920, TAU = Math.PI * 2;
export const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smoothstep = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k); };

// ---- colour: hex <-> rgb, mix, shade (k<0 darken toward black, k>0 lighten toward white) ----
export function rgbOf(c) {
  if (Array.isArray(c)) return c.slice(0, 3);
  let m = /^#([0-9a-f]{6})$/i.exec(c); if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = /^#([0-9a-f]{3})$/i.exec(c); if (m) return [0, 1, 2].map((i) => parseInt(m[1][i] + m[1][i], 16));
  m = /^rgba?\(([^)]+)\)/.exec(c); if (m) return m[1].split(',').slice(0, 3).map(Number);
  return [128, 128, 128];
}
export const hex = (r) => '#' + r.map((v) => Math.round(cl(v, 0, 255)).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, k) => { const A = rgbOf(a), B = rgbOf(b); return hex(A.map((v, i) => v + (B[i] - v) * k)); };
export const shade = (c, k) => (k < 0 ? mix(c, '#000000', -k) : mix(c, '#ffffff', k));
export const rgba = (c, a = 1) => { const [r, g, b] = rgbOf(c); return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${+a.toFixed(3)})`; };
/** rotate hue / scale saturation a little (palette jitter). h in degrees. */
export function tweak(c, { h = 0, s = 1, l = 0 } = {}) {
  const [r, g, b] = rgbOf(c).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let H = 0; if (d) { H = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; H *= 60; }
  let L = (mx + mn) / 2, S = d ? d / (1 - Math.abs(2 * L - 1)) : 0;
  H = (H + h + 360) % 360; S = cl(S * s); L = cl(L + l);
  const C = (1 - Math.abs(2 * L - 1)) * S, X = C * (1 - Math.abs(((H / 60) % 2) - 1)), m = L - C / 2;
  const [R, G, B] = H < 60 ? [C, X, 0] : H < 120 ? [X, C, 0] : H < 180 ? [0, C, X] : H < 240 ? [0, X, C] : H < 300 ? [X, 0, C] : [C, 0, X];
  return hex([(R + m) * 255, (G + m) * 255, (B + m) * 255]);
}

// ---- smooth closed / open paths through points (midpoint quadratic: rounded, never overshoots) ----
export function smoothClosed(pts, sharp = 0) {
  const p = new Path2D(), n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]); p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const c = pts[i], m = mid(c, pts[(i + 1) % n]); if (c[2]) p.lineTo(c[0], c[1]); p.quadraticCurveTo(c[0], c[1], m[0], m[1]); }
  p.closePath(); return p;
}
export function polyPath(pts) { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); return p; }
export function bboxOf(pts) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; }

/** Catmull-Rom resample of a polyline (+ per-point widths) to `n` samples. */
export function resample(pts, ws, n = 12) {
  const out = [], wo = [], m = pts.length - 1;
  const g = (i) => pts[Math.max(0, Math.min(m, i))];
  for (let s = 0; s <= n; s++) {
    const u = (s / n) * m, i = Math.min(m - 1, Math.floor(u)), f = u - i;
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
    out.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
    wo.push(ws[i] + (ws[Math.min(m, i + 1)] - ws[i]) * (f * f * (3 - 2 * f)));
  }
  return [out, wo];
}
/** Closed outline of a ribbon along a polyline with widths, round caps. Returns points (feed to smoothClosed). */
export function ribbon(pts, ws, { n = 12, bulge = 0, cap = 3 } = {}) {
  const [P, W] = resample(pts, ws, n), L = [], R = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const s = i / (P.length - 1), w = (W[i] / 2) * (1 + bulge * Math.sin(Math.PI * s));
    L.push([P[i][0] - ty * w, P[i][1] + tx * w]); R.push([P[i][0] + ty * w, P[i][1] - tx * w]);
  }
  const arc = (c, w, a0) => { const o = []; for (let k = 1; k < cap; k++) { const a = a0 - (Math.PI * k) / cap; o.push([c[0] + Math.cos(a) * w / 2, c[1] + Math.sin(a) * w / 2]); } return o; }; // from the L side round the tip to the R side
  const e = P.length - 1, d1 = Math.atan2(P[e][1] - P[e - 1][1], P[e][0] - P[e - 1][0]), d0 = Math.atan2(P[0][1] - P[1][1], P[0][0] - P[1][0]);
  return [...L, ...arc(P[e], W[e], d1 + Math.PI / 2), ...R.reverse(), ...arc(P[0], W[0], d0 + Math.PI / 2)];
}

// ---- seeded blotches: stains, damp, dirt (cheap radial gradients, no per-pixel work) ----
export function stains(c, rect, seed, { n = 10, color = '#2a2218', a = 0.2, rmin = 30, rmax = 120, squash = 1 } = {}) {
  const r = mulberry32(seed), [x, y, w, h] = rect;
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  for (let i = 0; i < n; i++) {
    const cx = x + r() * w, cy = y + r() * h, rad = rmin + r() * (rmax - rmin);
    c.save(); c.translate(cx, cy); c.scale(1, squash); const g = c.createRadialGradient(0, 0, 0, 0, 0, rad);
    g.addColorStop(0, rgba(color, a * (0.5 + r() * 0.5))); g.addColorStop(1, rgba(color, 0)); c.fillStyle = g; c.fillRect(-rad, -rad, rad * 2, rad * 2); c.restore();
  }
  c.restore();
}
/** vertical water streaks running down from a top edge. */
export function streaks(c, rect, seed, { n = 8, color = '#1a1812', a = 0.22, w = 6 } = {}) {
  const r = mulberry32(seed), [x, y, rw, rh] = rect;
  c.save(); c.beginPath(); c.rect(x, y, rw, rh); c.clip(); c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const sx = x + r() * rw, len = rh * (0.15 + r() * 0.6), ww = w * (0.5 + r()), g = c.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, rgba(color, 0)); g.addColorStop(0.15, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
    c.strokeStyle = g; c.lineWidth = ww; c.beginPath(); c.moveTo(sx, y); c.lineTo(sx + (r() - 0.5) * 14, y + len); c.stroke();
  }
  c.restore();
}
/** darkening gradient hugging one edge of a rect (ambient occlusion). side: 't','b','l','r'. */
export function edgeAO(c, rect, side, size, a = 0.4, color = '#000') {
  const [x, y, w, h] = rect; let g, rr;
  if (side === 't') { g = c.createLinearGradient(0, y, 0, y + size); rr = [x, y, w, size]; }
  else if (side === 'b') { g = c.createLinearGradient(0, y + h, 0, y + h - size); rr = [x, y + h - size, w, size]; }
  else if (side === 'l') { g = c.createLinearGradient(x, 0, x + size, 0); rr = [x, y, size, h]; }
  else { g = c.createLinearGradient(x + w, 0, x + w - size, 0); rr = [x + w - size, y, size, h]; }
  g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0)); c.fillStyle = g; c.fillRect(...rr);
}
/** Fill a path with a flat colour, a texture tile blended over it, and optional stains. */
export function surface(c, path, bbox, { color, tex = 'plaster', texA = 0.6, scale = 1.4, seed = 3, tint, blend = 'overlay', wear = 0, stain = '#1a140c' } = {}) {
  const [x0, y0, x1, y1] = bbox, w = x1 - x0, h = y1 - y0;
  c.save(); c.fillStyle = color; c.fill(path); c.clip(path);
  if (tex) cin.fillTexture(c, tex, [x0, y0, w, h], { alpha: texA, scale, ox: 0, oy: 0, seed, tint, blend });
  if (wear > 0.02) {
    stains(c, [x0, y0, w, h], seed * 7 + 1, { n: Math.round(3 + wear * 9), color: stain, a: 0.05 + wear * 0.14, rmin: 40, rmax: 170 });
    streaks(c, [x0, y0, w, h], seed * 7 + 2, { n: Math.round(wear * 9), color: stain, a: 0.08 + wear * 0.14, w: 7 });
  }
  c.restore();
}
export const lerpPt = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
/** deterministic 0..1 hash of integers. */
export function h01(a, b = 0, c = 0) { let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)) >>> 0; h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0; h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
