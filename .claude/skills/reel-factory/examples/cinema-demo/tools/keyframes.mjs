#!/usr/bin/env node
// Render 6 keyframes of the cinema demo into keyframes.png (contact sheet) and print visual_metrics vs the horror
// targets (same measurement path as scripts/visual_loop.mjs: 270x480 analysis copy, 4 channels).
// usage: node examples/cinema-demo/tools/keyframes.mjs [--w 540] [--targets templates/visual_targets.horror.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { frameMetrics, aggregate, deficits } from '../../../lib/visual_metrics.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DEMO = path.resolve(HERE, '..'), ROOT = path.resolve(DEMO, '../..');
const a = process.argv.slice(2), get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const W = Number(get('--w', 540)), H = Math.round(W * 16 / 9);
const T = JSON.parse(fs.readFileSync(path.resolve(ROOT, get('--targets', 'templates/visual_targets.horror.json')), 'utf8'));
const { VideoClock } = await import(pathToFileURL(path.join(DEMO, 'scene.mjs')).href);
const tl = JSON.parse(fs.readFileSync(path.join(DEMO, 'timeline.json'), 'utf8'));
const times = [0.2, 1.4, 2.6, 3.8, 5.0, 6.6];
const frames = [], metrics = [];
for (const t of times) {
  const c = createCanvas(W, H); VideoClock.setTime(t); VideoClock.draw(c.getContext('2d'), W, H, tl);
  frames.push(c);
  const s = createCanvas(270, 480); s.getContext('2d').drawImage(c, 0, 0, 270, 480);
  metrics.push(frameMetrics(s.getContext('2d').getImageData(0, 0, 270, 480).data, 270, 480, 4, {}));
}
const pad = 12, cols = 3, rows = 2, tw = Math.round(W * 0.62), th = Math.round(H * 0.62);
const sheet = createCanvas(pad + cols * (tw + pad), pad + rows * (th + pad)), x = sheet.getContext('2d');
x.fillStyle = '#101010'; x.fillRect(0, 0, sheet.width, sheet.height);
frames.forEach((f, i) => { const cx = pad + (i % cols) * (tw + pad), cy = pad + Math.floor(i / cols) * (th + pad); x.drawImage(f, cx, cy, tw, th); x.fillStyle = '#fff'; x.font = '16px sans-serif'; x.fillText(`t=${times[i]}s`, cx + 8, cy + 20); });
fs.writeFileSync(path.join(DEMO, 'keyframes.png'), sheet.toBuffer('image/png'));
const agg = aggregate(metrics), def = deficits({ ...agg, empty_cells: metrics.reduce((w, m) => (m.empty_cells.length > w.length ? m.empty_cells : w), []) }, T);
console.log(JSON.stringify({ per_frame: metrics.map((m, i) => ({ t: times[i], sharp_edges: +m.sharp_edges.toFixed(4), contrast: +m.contrast.toFixed(2), mean_luma: +m.mean_luma.toFixed(1), saturation: +m.saturation.toFixed(3), color_bins: m.color_bins, focal: +m.focal.toFixed(2), hue_families: m.hue_families, empty_cells: m.empty_cells.length })), aggregate: agg, targets: { sharp_edges: T.sharp_edges, contrast: T.contrast, saturation: T.saturation, color_bins: T.color_bins, focal: T.focal, mean_luma: T.mean_luma, hue_families: T.hue_families, max_empty_cells: T.max_empty_cells }, deficits: def.map((d) => `${d.metric} ${d.value} (${d.target})`) }, null, 1));
