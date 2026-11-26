#!/usr/bin/env node
// Per-effect cost table for lib/cinema at 1080x1920 (median wall ms of 12 frames, drawing flushed with a 1px read).
// usage: node examples/cinema-demo/tools/bench.mjs [--w 1080]
import { createCanvas, Path2D } from '@napi-rs/canvas';
import * as cin from '../../../lib/cinema/index.mjs';

const a = process.argv.slice(2), W = Number(a.includes('--w') ? a[a.indexOf('--w') + 1] : 1080), H = Math.round(W * 16 / 9);
const c = createCanvas(W, H), x = c.getContext('2d');
const fresh = () => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a2a4a'); g.addColorStop(1, '#8a6a4a'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = '#fff6d0'; x.beginPath(); x.arc(W * 0.7, H * 0.2, W * 0.08, 0, 6.3); x.fill(); };
const med = (f, n = 12) => { const ts = []; for (let i = 0; i < n + 2; i++) { fresh(); x.getImageData(0, 0, 1, 1); const t0 = performance.now(); f(i); x.getImageData(0, 0, 1, 1); if (i >= 2) ts.push(performance.now() - t0); } ts.sort((p, q) => p - q); return ts[n >> 1]; };
const cam = cin.createCamera({}); cam.update(1, cin.pushIn({ dur: 2, amount: 0.15 }));
const rim = new Path2D(); rim.rect(300, 800, 300, 900);
const rows = [
  ['camera.layer (plain plane)', (i) => cam.layer(x, 2, (cx, b) => { cx.fillStyle = '#345'; cx.fillRect(b.x0, b.y0, b.w, 600); })],
  ['camera.layer blur 9px (DoF)', (i) => cam.layer(x, 0.6, (cx, b) => { cx.fillStyle = '#000'; cx.fillRect(100, 1200, 400, 700); }, { blur: 9 })],
  ['darkMask (2 lights)', (i) => cin.darkMask(x, [{ type: 'point', x: 600, y: 900, r: 600, color: '#ffc080' }, { type: 'cone', x: 800, y: 100, angle: 1.9, spread: 0.4, length: 1300, color: '#ffd9a0' }])],
  ['darkMaskLayer (lit plane, 2 lights)', (i) => cin.darkMaskLayer(x, (o) => { o.fillStyle = '#556'; o.fillRect(0, 900, W, H); }, [{ type: 'point', x: 600, y: 900, r: 600, color: '#ffc080' }, { type: 'cone', x: 800, y: 100, angle: 1.9, spread: 0.4, length: 1300, color: '#ffd9a0' }])],
  ['godRays (12 samples)', (i) => cin.godRays(x, (o) => { o.fillStyle = '#000'; o.fillRect(300, 500, 100, 900); }, { x: 800, y: 200 }, { frame: i })],
  ['rimLight (path)', (i) => { x.save(); x.scale(W / 1080, W / 1080); cin.rimLight(x, rim, { x: 1, y: -0.5 }, {}); x.restore(); }],
  ['castShadow', (i) => { x.save(); x.scale(W / 1080, W / 1080); cin.castShadow(x, [[100, 900], [200, 900], [200, 600], [100, 600]], { x: 800, y: 100 }, { y: 900 }, { softness: 10 }); x.restore(); }],
  ['glint', (i) => cin.glint(x, W * 0.7, H * 0.2, { size: 46 })],
  ['fog (3 bands)', (i) => cin.fog(x, { t: i / 30 })],
  ['bloom', (i) => cin.bloom(x, {})],
  ['halation', (i) => cin.halation(x, {})],
  ['bloom+halation (one pass)', (i) => cin.glow(x, { bloom: {}, halation: {} })],
  ['heatHaze', (i) => cin.heatHaze(x, { t: i / 30 })],
  ['depthBlur (canvas, 12px)', (i) => cin.depthBlur(c, 5, 1, { px: 12 })],
  ['grain', (i) => cin.grain(x, { frame: i })],
  ['vignette (cached)', (i) => cin.vignette(x, {})],
  ['chromaticAberration', (i) => cin.chromaticAberration(x, { px: 3 })],
  ['gateWeave', (i) => cin.gateWeave(x, { t: i / 30 })],
  ['flicker', (i) => cin.flicker(x, { t: i / 30, amount: 0.2 })],
  ['letterbox', (i) => cin.letterbox(x, { fraction: 0.06 })],
  ['dustScratches', (i) => cin.dustScratches(x, { frame: i })],
  ['grade: gain+saturation', (i) => cin.grade(x, { gain: [0.96, 1, 1.06], saturation: 0.8 })],
  ['grade: contrast (self-overlay)', (i) => cin.grade(x, { contrast: 0.3 })],
  ['grade: splitTone', (i) => cin.grade(x, { splitTone: { shadows: '#03121c', highlights: '#ffae6a' } })],
  ['directionalBlur (7 taps)', (i) => cin.directionalBlur(x, { amount: 60 })],
  ['post: clean-guide', (i) => cin.post(x, { frame: i }, 'clean-guide')],
  ['post: warm-story', (i) => cin.post(x, { frame: i }, 'warm-story')],
  ['post: horror-day', (i) => cin.post(x, { frame: i, t: i / 30 }, 'horror-day')],
  ['post: horror-night', (i) => cin.post(x, { frame: i, t: i / 30 }, 'horror-night')],
];
console.log(`size ${W}x${H}, median of 12 frames (ms)`);
for (const [n, f] of rows) console.log(n.padEnd(38), med(f).toFixed(1).padStart(7));
// whole demo frame
const { VideoClock } = await import('../scene.mjs');
const dc = createCanvas(W, H), dx = dc.getContext('2d'); const ts = [];
for (let i = 0; i < 8; i++) { VideoClock.setTime(1 + i * 0.1); const t0 = performance.now(); VideoClock.draw(dx, W, H, {}); dx.getImageData(0, 0, 1, 1); if (i >= 2) ts.push(performance.now() - t0); }
ts.sort((p, q) => p - q); console.log('cinema-demo full frame (scene + post)'.padEnd(38), ts[3].toFixed(1).padStart(7));
