// dark-pov style: cinema preset determinism, targets selection, calibrated template, diegetic HUD widget.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import * as cin from '../lib/cinema/index.mjs';
import { selectTargetsFile } from '../lib/visual_metrics.mjs';
import { hud, HUD_SAFE } from '../lib/kit/props/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of fs.readdirSync(path.join(ROOT, 'fonts'))) if (/\.ttf$/i.test(f)) GlobalFonts.registerFromPath(path.join(ROOT, 'fonts', f));
const hashCanvas = (c) => cin.hashPixels(c.getContext('2d').getImageData(0, 0, c.width, c.height).data);
const lum = (c, x, y, w = 1, h = 1) => { const d = c.getContext('2d').getImageData(x, y, w, h).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; return s / (d.length / 4); };

function scene() {
  const c = createCanvas(270, 480), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 270, 480); g.addColorStop(0, '#3a5a8a'); g.addColorStop(1, '#8a6a3a'); x.fillStyle = g; x.fillRect(0, 0, 270, 480);
  x.fillStyle = '#c8c8d8'; x.fillRect(100, 150, 70, 110);
  return c;
}
const lights = [{ type: 'point', x: 540, y: 700, r: 420, color: '#dfe9ff', intensity: 1.4 }];

test('horror-dark-pov preset is deterministic, frame-dependent, and one light dominates', () => {
  const run = (frame, ls = lights) => { const c = scene(); cin.post(c.getContext('2d'), { t: frame / 30, frame, seed: 5, lights: ls }, 'horror-dark-pov'); return c; };
  const a = run(7), b = run(7), d = run(8);
  assert.equal(hashCanvas(a), hashCanvas(b), 'same inputs, same pixels');
  assert.notEqual(hashCanvas(a), hashCanvas(d), 'a different frame moves the grain');
  // lit pool centre (design 540,700 -> 135,175) far brighter than the far corner; corner stays near black
  const centre = lum(a, 120, 160, 30, 30), corner = lum(a, 2, 440, 30, 30);
  assert.ok(centre > corner * 4 && corner < 25, `centre ${centre.toFixed(1)} corner ${corner.toFixed(1)}`);
  // no lights = ambient floor only: the whole frame is dark (mean well under the reference's brightest frames)
  const dark = run(7, []);
  assert.ok(lum(dark, 0, 0, 270, 480) < 30, 'ambient floor only stays dark');
});

test('overlay runs after the light mask: an emissive overlay survives total darkness', () => {
  const c = scene();
  cin.post(c.getContext('2d'), { t: 0, frame: 0, seed: 1, lights: [], overlay: (x) => { x.fillStyle = '#ffffff'; x.fillRect(100, 200, 40, 40); } }, 'horror-dark-pov');
  assert.ok(lum(c, 110, 210, 20, 20) > 120, 'overlay is not multiplied away');
  assert.ok(lum(c, 10, 10, 20, 20) < 30);
});

test('selectTargetsFile: dark-pov selects the new template; night/day/visual.look unchanged', () => {
  assert.equal(selectTargetsFile({ genre: 'horror', look: 'dark-pov' }), 'visual_targets.horror-dark-pov.json');
  assert.equal(selectTargetsFile({ genre: 'horror', look: 'Dark_POV' }), 'visual_targets.horror-dark-pov.json');
  assert.equal(selectTargetsFile({ genre: 'horror', visual: { look: 'dark-pov' } }), 'visual_targets.horror-dark-pov.json');
  assert.equal(selectTargetsFile({ genre: 'horror', look: 'night' }), 'visual_targets.horror.json');
  assert.equal(selectTargetsFile({ genre: 'horror', look: 'day' }), 'visual_targets.horror-day.json');
  assert.equal(selectTargetsFile({ genre: 'funny' }), 'visual_targets.json');
});

test('dark-pov template follows the style_ref rule on the reference numbers', () => {
  const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates/visual_targets.horror-dark-pov.json'), 'utf8')), r = T.calibrated_from[0];
  assert.equal(T.margin, 0.8); assert.equal(T.mood, 'dark'); assert.equal(T.look, 'dark-pov');
  for (const k of ['sharp_edges', 'contrast', 'saturation']) assert.ok(Math.abs(T[k].min - r[k] * 0.8) < 1e-3 + r[k] * 0.01, k);
  assert.ok(Math.abs(T.lit_fraction.min - r.lit_fraction * 0.8) < 2e-3);
  assert.ok(Math.abs(T.mean_luma.max - r.mean_luma * 1.15) < 0.2);
  assert.ok(T.notes && T.notes.focal && T.notes.reused_backdrop_check_disabled, 'known conflicts are documented');
  const brief = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates/brief.schema.json'), 'utf8'));
  assert.match(brief.properties.look.description, /dark-pov/);
});

test('hud: red state is red-dominant, normal is not, output deterministic, position clamped to the safe zone', () => {
  const draw = (o) => { const c = createCanvas(1080, 1920), x = c.getContext('2d'); x.fillStyle = '#101018'; x.fillRect(0, 0, 1080, 1920); const r = hud(x, o); return { c, r }; };
  const px = (c, r) => { const d = c.getContext('2d').getImageData(Math.floor(r.x), Math.floor(r.y), Math.ceil(r.w), Math.ceil(r.h)).data; let R = 0, B = 0; for (let i = 0; i < d.length; i += 4) { R += d[i]; B += d[i + 2]; } return { R, B }; };
  const red = draw({ label: 'S7', value: '02:00', wrong: 1, t: 0.4 }), ok = draw({ label: 'S7', value: '02:00', wrong: 0, t: 0.4 });
  const a = px(red.c, red.r), b = px(ok.c, ok.r);
  assert.ok(a.R > a.B * 1.4, 'red state is red-dominant');
  assert.ok(b.R < b.B * 1.4 + 1, 'normal state is not red');
  assert.equal(hashCanvas(draw({ label: 'S7', value: '02:00', wrong: 1, t: 0.4 }).c), hashCanvas(red.c));
  assert.notEqual(hashCanvas(draw({ label: 'S7', value: '02:00', wrong: 1, t: 0.9 }).c), hashCanvas(red.c), 'jitter depends on t');
  const far = draw({ label: 'X', value: 'ITARSI', x: 5000, y: -300 }).r;
  assert.ok(far.clamped && far.x >= HUD_SAFE.x0 - 1e-6 && far.x + far.w <= HUD_SAFE.x1 + 1e-6 && far.y >= HUD_SAFE.y0 - 1e-6 && far.y + far.h <= HUD_SAFE.y1 + 1e-6);
  assert.equal(hud(createCanvas(10, 10).getContext('2d'), { value: '1', a: 0 }), null);
});
