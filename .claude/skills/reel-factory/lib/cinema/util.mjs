// cinema/util: shared helpers. Everything here is deterministic (no Math.random / Date).
// Offscreen canvases are pooled per (key, w, h): one allocation per size, reused every frame.
// Effects work in screen space: `begin(ctx)` resets the transform to the 1080x1920 design space scaled to the
// real canvas, so callers pass design-space coordinates whatever the render size (1080x1920, 540x960 ...).
import { createCanvas } from '@napi-rs/canvas';
import { mulberry32, clamp01, lerp, smooth } from '../scene3d.mjs';

export { createCanvas, mulberry32, clamp01, lerp, smooth };
export const DW = 1080;
export const DH = 1920;
export const TAU = Math.PI * 2;
export const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const easeInOut = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
export const linear = (x) => clamp01(x);

const POOL = new Map();
/** Pooled offscreen canvas. Contents are NOT cleared: callers 'copy' or clearRect. */
export function pooled(key, w, h) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const k = `${key}:${w}x${h}`;
  let c = POOL.get(k);
  if (!c) { c = createCanvas(w, h); POOL.set(k, c); }
  const x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none';
  return c;
}
export function poolSize() { return POOL.size; }

/** Save + reset to design-space transform. Returns {W,H,k} (device size, device px per design px). */
export function begin(ctx) {
  const W = ctx.canvas.width, H = ctx.canvas.height, k = W / DW;
  ctx.save();
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  return { W, H, k };
}
export const end = (ctx) => ctx.restore();

/** Deterministic per-frame seed from (seed, frame number). */
export function frameSeed(seed, frame) { return (Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(frame | 0, 0xc2b2ae35)) >>> 0; }

export function parseColor(c) {
  if (Array.isArray(c)) return [c[0], c[1], c[2], c[3] ?? 1];
  if (typeof c === 'string') {
    let m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
    m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) return [0, 1, 2].map((i) => parseInt(m[1][i] + m[1][i], 16)).concat(1);
    m = /^rgba?\(([^)]+)\)/.exec(c);
    if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
  }
  return [255, 255, 255, 1];
}
export const rgba = (c, a = 1) => { const p = parseColor(c); return `rgba(${Math.round(p[0])},${Math.round(p[1])},${Math.round(p[2])},${+(a * p[3]).toFixed(4)})`; };

/** Downscaled copy of the ctx canvas (quarter res by default). Pooled. */
export function snapshot(ctx, scale = 0.25, key = 'snap') {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const c = pooled(key, W * scale, H * scale);
  const x = c.getContext('2d');
  x.globalCompositeOperation = 'copy'; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'low';
  x.drawImage(ctx.canvas, 0, 0, c.width, c.height);
  x.globalCompositeOperation = 'source-over';
  return c;
}
/** FNV-1a hash of a pixel buffer (tests). */
export function hashPixels(buf) {
  let h = 0x811c9dc5;
  for (let i = 0; i < buf.length; i++) { h ^= buf[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
