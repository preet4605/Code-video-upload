import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
import { createCanvas, GlobalFonts } from '../skill/code-video-studio/node_modules/@napi-rs/canvas/index.js';
const fontDir = path.resolve('skill/code-video-studio/fonts');
for (const f of fs.readdirSync(fontDir)) GlobalFonts.registerFromPath(path.join(fontDir, f), f.includes('Devanagari') ? 'Noto Sans Devanagari' : 'Noto Sans');
const proj = path.resolve(process.argv[2]); const tl = JSON.parse(fs.readFileSync(path.join(proj, 'timeline.json')));
const { VideoClock } = await import(pathToFileURL(path.join(proj, 'scene.mjs')));
const W = 216, H = 384, FPS = 10; const D = tl.duration_s; const diffs = []; let prev = null;
for (let t = 0; t < D; t += 1 / FPS) {
  const c = createCanvas(W, H); const ctx = c.getContext('2d'); VideoClock.setTime(t); VideoClock.draw(ctx, W, H, tl);
  const d = ctx.getImageData(0, 0, W, H).data; const g = new Float32Array(W * H); for (let i = 0; i < g.length; i++) g[i] = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
  if (prev) { let s = 0; for (let i = 0; i < g.length; i++) s += Math.abs(g[i] - prev[i]); diffs.push([t, s / g.length]); } prev = g;
}
const m = (a, b) => { const x = diffs.filter(([t]) => t >= a && t < b).map((q) => q[1]); return x.reduce((p, q) => p + q, 0) / x.length; };
console.log('first third', m(0, D / 3).toFixed(3), 'last third', m(2 * D / 3, D).toFixed(3), 'ratio', (m(2 * D / 3, D) / m(0, D / 3)).toFixed(2));
console.log([0, 10, 20, 30, 40, 50, 56].map((a) => a + ':' + m(a, a + 5).toFixed(2)).join(' '));
