#!/usr/bin/env node
// kit-gallery: contact sheets of every set (2 variants) and every figure age/outfit/pose under two lights.
//   node examples/kit-gallery/render.mjs [outDir] [--tile 360]      -> sets.jpg, figures.jpg (JPEG q85: the PNGs were over 1.5 MB)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import * as kit from '../../lib/kit/index.mjs';
import { drawHand } from '../../lib/kit/figures/hand.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SUBJECT_Z = { schoolCourtyard: 1.35, villageAangan: 1.35, haveliCorridor: 1.7, templeSteps: 1.45, corridor: 1.7, stairwell: 1.7, roadNight: 1.8, street: 1.7, room: 1.7 };
let fontsDone = false;
const fonts = () => { if (fontsDone) return; fontsDone = true; const d = path.join(HERE, '../../fonts'); for (const f of fs.readdirSync(d).filter((x) => /\.ttf$/.test(x))) GlobalFonts.registerFromPath(path.join(d, f)); };

/** Render one set variant to a canvas (tw x th), with an adult figure and the matching post look. */
export function renderSetTile(name, vopts, tw = 360, { t = 1, withFigure = true } = {}) {
  const th = Math.round(tw * 16 / 9), set = kit.buildSet(name, vopts), c = createCanvas(tw, th), x = c.getContext('2d');
  const cam = kit.cin.createCamera({}); cam.update(t, () => ({}));
  const z = SUBJECT_Z[name] ?? 1.6, p = set.place({ z, x: 0.15, meters: 1.6 });
  const fig = kit.createFigure({ age: 'adult', outfit: 'kurta', seed: 5 });
  x.fillStyle = '#000'; x.fillRect(0, 0, tw, th);
  set.render(x, cam, t, { subjects: withFigure ? [{ depth: z, draw: (cx) => {
    const L = set.figureLight(cam, [p.x, p.feet - 200], t), st = { ...p, pose: 'stand', t, light: L, gaze: [0.5, 0], expr: 'worried' };
    if (set.sun) fig.shadow(cx, st, { dir: set.sun.dir }, { alpha: 0.6 });
    fig.draw(cx, st);
  } }] : [] });
  const tod = set.palette.tod; kit.cin.post(x, { t, frame: Math.round(t * 30), seed: 5 }, tod === 'noon' || tod === 'day' ? 'horror-day' : tod === 'dusk' ? 'warm-story' : 'horror-night');
  return { canvas: c, set };
}

export function renderSetsSheet(outPath, { tile = 360, cols = 6 } = {}) {
  fonts();
  const names = kit.SET_NAMES, cells = [];
  for (const n of names) kit.VARIANTS[n].forEach((v, i) => cells.push({ n, i, v }));
  const th = Math.round(tile * 16 / 9), pad = 8, lab = 22, rows = Math.ceil(cells.length / cols);
  const sheet = createCanvas(cols * (tile + pad) + pad, rows * (th + lab + pad) + pad), s = sheet.getContext('2d');
  s.fillStyle = '#141414'; s.fillRect(0, 0, sheet.width, sheet.height); s.font = '15px "Noto Sans", sans-serif'; s.fillStyle = '#ddd';
  cells.forEach(({ n, i, v }, k) => {
    const cx = pad + (k % cols) * (tile + pad), cy = pad + Math.floor(k / cols) * (th + lab + pad);
    const { canvas } = renderSetTile(n, v, tile); s.drawImage(canvas, cx, cy + lab); s.fillText(`${n} ${i + 1}: ${Object.entries(v).map(([a, b]) => `${a}=${Array.isArray(b) ? b.join('/') : b}`).join(' ')}`.slice(0, 52), cx, cy + 15);
  });
  if (outPath) fs.writeFileSync(outPath, outPath.endsWith('.jpg') ? sheet.toBuffer('image/jpeg', 85) : sheet.toBuffer('image/png'));
  return sheet;
}

const CHARS = [
  { label: 'child boy uniform', spec: { age: 'child', outfit: 'uniform', seed: 3 }, h: 0.62 },
  { label: 'child girl uniform', spec: { age: 'child', sex: 'f', outfit: 'uniform', seed: 4, hair: { style: 'braid' } }, h: 0.62 },
  { label: 'adult m kurta', spec: { age: 'adult', outfit: 'kurta', seed: 5 }, h: 0.9 },
  { label: 'adult f saree', spec: { age: 'adult', sex: 'f', outfit: 'saree', seed: 8, bindi: true, bangles: true }, h: 0.9 },
  { label: 'adult m coat', spec: { age: 'adult', outfit: 'coat', seed: 9, glasses: true }, h: 0.9 },
  { label: 'elder f saree', spec: { age: 'elder', sex: 'f', outfit: 'saree', seed: 6, hair: { style: 'bun' }, bangles: true }, h: 0.86 },
  { label: 'ghost child (wrong)', spec: { age: 'child', outfit: 'uniform', seed: 3, variant: 'ghost' }, h: 0.62 },
];
const POSES = ['stand', 'walk', 'reach', 'crouch', { name: 'turn', turn: 0.55 }, 'cower'];

export function renderFiguresSheet(outPath, { cell = 300 } = {}) {
  fonts();
  const ch = Math.round(cell * 1.45), pad = 6, lab = 20, cols = 7, rows = 6;
  const sheet = createCanvas(cols * (cell + pad) + pad, rows * (ch + lab + pad) + pad), s = sheet.getContext('2d');
  s.fillStyle = '#141414'; s.fillRect(0, 0, sheet.width, sheet.height); s.font = '14px "Noto Sans", sans-serif';
  const bg = (x, y, w, h, kind) => { const g = s.createLinearGradient(0, y, 0, y + h); if (kind === 'noon') { g.addColorStop(0, '#e9e2cf'); g.addColorStop(1, '#bfb298'); } else { g.addColorStop(0, '#0d1424'); g.addColorStop(1, '#1d1a20'); } s.fillStyle = g; s.fillRect(x, y, w, h); if (kind === 'noon') { s.fillStyle = 'rgba(80,66,44,0.35)'; s.fillRect(x, y + h * 0.9, w, h * 0.1); } else { s.fillStyle = 'rgba(255,170,90,0.10)'; s.fillRect(x, y + h * 0.9, w, h * 0.1); } };
  const cellAt = (r, k) => [pad + k * (cell + pad), pad + r * (ch + lab + pad) + lab];
  const draw = (r, k, fig, label, kind, st) => {
    const [x, y] = cellAt(r, k); s.save(); s.beginPath(); s.rect(x, y, cell, ch); s.clip(); bg(x, y, cell, ch, kind);
    const H = st.height; if (kind === 'noon') fig.shadow(s, { ...st, x: x + cell / 2, feet: y + ch * 0.9 }, { dir: [-0.45, 0.4] }, { alpha: 0.5 });
    fig.draw(s, { ...st, x: x + cell / 2, feet: y + ch * 0.9, light: kind === 'noon' ? kit.LIGHTS.noon : kit.LIGHTS.lamp });
    s.restore(); s.fillStyle = '#ddd'; s.fillText(label, x, y - 5);
  };
  CHARS.forEach((c, k) => { const f = kit.createFigure(c.spec); for (const [r, kind] of [[0, 'noon'], [1, 'lamp']]) draw(r, k, f, r === 0 ? c.label : `${c.label} / lamp`, kind, { height: ch * c.h, pose: 'stand', t: 0.6, gaze: [0.4, 0], expr: c.spec.variant === 'ghost' ? 'blank' : k % 2 ? 'worried' : 'neutral', talk: k === 2 ? 1 : undefined }); });
  const kid = kit.createFigure({ age: 'child', outfit: 'uniform', seed: 3 }), eld = kit.createFigure({ age: 'elder', outfit: 'kurta', seed: 7, glasses: true });
  POSES.forEach((p, k) => { const nm = typeof p === 'string' ? p : p.name; draw(2, k, kid, `child ${nm}`, 'noon', { height: ch * 0.66, pose: p, t: 0.4, phase: 0.8 + k, gaze: [0.7, 0], expr: nm === 'cower' || nm === 'crouch' ? 'afraid' : 'neutral' }); draw(3, k, eld, `elder ${nm}`, 'lamp', { height: ch * 0.88, pose: p, t: 0.9, phase: 1.3 + k, gaze: [-0.5, 0.2], expr: nm === 'cower' ? 'afraid' : 'worried',  }); });
  // row 4: style 'horror' (adult-leaning proportions, low-key faces, desaturated, darker cloth) next to the illustrated default; the ghost has no shadow and a pale sheen instead of a pool
  const HORROR = [
    { label: 'illustrated adult m (default)', spec: { age: 'adult', outfit: 'kurta', seed: 5 }, h: 0.9 },
    { label: 'horror adult m kurta', spec: { age: 'adult', outfit: 'kurta', seed: 5, style: 'horror' }, h: 0.9 },
    { label: 'horror adult f saree', spec: { age: 'adult', sex: 'f', outfit: 'saree', seed: 8, bindi: true, bangles: true, style: 'horror' }, h: 0.9 },
    { label: 'horror child uniform', spec: { age: 'child', outfit: 'uniform', seed: 3, style: 'horror' }, h: 0.66 },
    { label: 'horror elder f saree', spec: { age: 'elder', sex: 'f', outfit: 'saree', seed: 6, hair: { style: 'bun' }, bangles: true, style: 'horror' }, h: 0.88 },
    { label: 'horror ghost child', spec: { age: 'child', outfit: 'uniform', seed: 3, variant: 'ghost', style: 'horror' }, h: 0.78 },
    { label: 'horror ghost f saree', spec: { age: 'adult', sex: 'f', outfit: 'saree', seed: 8, variant: 'ghost', style: 'horror' }, h: 0.92 },
  ];
  HORROR.forEach((c, k) => draw(4, k, kit.createFigure(c.spec), c.label, 'lamp', { height: ch * c.h, pose: 'stand', t: 0.6, gaze: [0.4, 0], expr: k % 2 ? 'worried' : 'neutral' }));
  // row 5: hands, close (soft shading, jointed fingers, nails, wet ghost hand) and at body scale zoomed x3 (separated fingers + thumb)
  { const hy = ch * 0.55, env = { L: { x: 0.7, y: -0.5 }, key: '#fff4d8', amb: '#2a3040', strength: 1, hard: true };
    const hands = [['hand: open (illustrated skin)', '#b57a4d', 0.1, false, null], ['hand: ghost wet, open', '#a4ad9c', 0.0, true, null], ['hand: ghost wet, half curled', '#a4ad9c', 0.5, true, null], ['hand: index raised, fist', '#a2663f', 0.95, false, [0, 1, 1, 1]]];
    hands.forEach(([label, skin, curl, wet, curls], k) => { const [x, y] = cellAt(5, k); s.save(); s.beginPath(); s.rect(x, y, cell, ch); s.clip(); bg(x, y, cell, ch, 'lamp'); s.translate(x + cell * 0.5, y + ch * (curls ? 0.78 : 0.14)); const S = cell * 0.9; s.scale(S, S); drawHand(s, { p: [0, 0], ang: curls ? Math.PI : 0.15, size: 1, curl, curls, thumbTuck: curls ? 1 : 0, spread: 0.3, thumb: 0.4, side: 1, skin, env, px: S, wet, sss: wet ? '#6c7b50' : null }); s.restore(); s.fillStyle = '#ddd'; s.fillText(label, x, y - 5); });
    [['body-scale hands x3: illustrated', 'illustrated', 4], ['body-scale hands x3: horror', 'horror', 5]].forEach(([label, style, k]) => {
      const [x, y] = cellAt(5, k), z = 3, tmp = createCanvas(cell * z, ch * z), t = tmp.getContext('2d'); bg2(t, cell * z, ch * z); const f = kit.createFigure({ age: 'adult', outfit: 'shirt', seed: 5, style }), H = ch * 0.8 * z, st = { x: cell * z / 2, feet: ch * 0.95 * z, height: H, pose: 'stand', t: 0.6, light: kit.LIGHTS.lamp, gaze: [0.4, 0] }; f.draw(t, st);
      const jt = f.joints(st).handR; s.save(); s.beginPath(); s.rect(x, y, cell, ch); s.clip(); s.drawImage(tmp, jt[0] - cell / 2, jt[1] - ch * 0.35, cell, ch, x, y, cell, ch); s.restore(); s.fillStyle = '#ddd'; s.fillText(label, x, y - 5); });
  }
  if (outPath) fs.writeFileSync(outPath, outPath.endsWith('.jpg') ? sheet.toBuffer('image/jpeg', 85) : sheet.toBuffer('image/png'));
  return sheet;
}
function bg2(t, w, h) { const g = t.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0d1424'); g.addColorStop(1, '#1d1a20'); t.fillStyle = g; t.fillRect(0, 0, w, h); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), out = args.find((a) => !a.startsWith('--')) ?? HERE, ti = args.indexOf('--tile'), tile = ti >= 0 ? +args[ti + 1] : 360;
  fs.mkdirSync(out, { recursive: true });
  let t0 = performance.now(); renderSetsSheet(path.join(out, 'sets.jpg'), { tile }); console.log('sets.jpg', ((performance.now() - t0) / 1000).toFixed(1), 's');
  t0 = performance.now(); renderFiguresSheet(path.join(out, 'figures.jpg')); console.log('figures.jpg', ((performance.now() - t0) / 1000).toFixed(1), 's');
}
