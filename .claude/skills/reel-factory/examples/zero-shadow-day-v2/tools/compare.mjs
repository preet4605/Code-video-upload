// before/after: render the same three shots (same times, same captions) from the original scene and from v2, run the same
// visual_metrics pipeline as scripts/visual_loop.mjs (540x960 render -> 270x480 -> frameMetrics, caption band ignored,
// 3 keyframes per shot) against templates/visual_targets.horror-day.json, write before_after.jpg (JPEG q85, the PNG was over 1.5 MB) + metrics.json.
//   node examples/zero-shadow-day-v2/tools/compare.mjs
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL, fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { frameMetrics, aggregate, deficits, DEFAULT_CAPTION_BAND } from '../../../lib/visual_metrics.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), V2 = path.resolve(HERE, '..'), ORIG = path.resolve(V2, '../zero-shadow-day'), ROOT = path.resolve(V2, '../..');
for (const f of fs.readdirSync(path.join(ROOT, 'fonts')).filter((x) => /\.ttf$/.test(x))) GlobalFonts.registerFromPath(path.join(ROOT, 'fonts', f));
const SHOTS = ['s1_hook', 's2_dadi', 's5_hand'], KEYS = [0.2, 0.5, 0.85], RW = 540, RH = 960, AW = 270, AH = 480;
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates/visual_targets.horror-day.json'), 'utf8'));
const tl = JSON.parse(fs.readFileSync(path.join(V2, 'timeline.json'), 'utf8'));
async function run(dir, rewrite) {
  let file = path.join(dir, 'scene.mjs'), tmp = null;
  if (rewrite) { // the original imports ../tools/kit.mjs relative to a project layout: load a rewritten copy placed next to v2
    tmp = path.join(V2, '_orig_scene.tmp.mjs'); fs.writeFileSync(tmp, fs.readFileSync(file, 'utf8').replace("'../tools/kit.mjs'", "'../zero-shadow-day/tools/kit.mjs'")); file = tmp;
  }
  const VC = (await import(pathToFileURL(file).href)).VideoClock, out = {};
  for (const id of SHOTS) {
    const sc = tl.scenes.find((s) => s.id === id), frames = [];
    for (const k of KEYS) {
      const t = sc.start_s + (sc.end_s - sc.start_s) * k, c = createCanvas(RW, RH); VC.setTime(t); VC.draw(c.getContext('2d'), RW, RH, tl);
      const sm = createCanvas(AW, AH); sm.getContext('2d').drawImage(c, 0, 0, AW, AH);
      frames.push({ t: +t.toFixed(2), canvas: c, m: frameMetrics(sm.getContext('2d').getImageData(0, 0, AW, AH).data, AW, AH, 4, { ignoreBands: [DEFAULT_CAPTION_BAND] }) });
    }
    const agg = aggregate(frames.map((f) => f.m)); out[id] = { frames, agg, deficits: deficits({ ...frames[0].m, ...agg, empty_cells: Object.assign(new Array(Math.round(agg.empty_cells)).fill('x')) }, T).map((d) => d.metric) };
  }
  if (tmp) fs.unlinkSync(tmp);
  return out;
}
const before = await run(ORIG, true), after = await run(V2);
const pad = 8, lab = 26, W = 6 * (RW / 2 + pad) + pad, H = 3 * (RH / 2 + lab + pad) + pad, sheet = createCanvas(W, H), s = sheet.getContext('2d');
s.fillStyle = '#141414'; s.fillRect(0, 0, W, H); s.font = '16px "Noto Sans", sans-serif'; s.fillStyle = '#ddd';
SHOTS.forEach((id, r) => { const y = pad + r * (RH / 2 + lab + pad); s.fillText(`${id}  BEFORE (original scene.mjs)`, pad, y + 18); s.fillText('AFTER (kit + cinema)', pad + 3 * (RW / 2 + pad), y + 18);
  [...before[id].frames, ...after[id].frames].forEach((f, i) => s.drawImage(f.canvas, pad + i * (RW / 2 + pad), y + lab, RW / 2, RH / 2)); });
fs.writeFileSync(path.join(V2, 'before_after.jpg'), sheet.toBuffer('image/jpeg', 85));
const keys = ['sharp_edges', 'contrast', 'saturation', 'color_bins', 'mean_luma', 'p5_luma', 'lit_fraction', 'lit_regions', 'subject_scale', 'empty_cells'];
const table = {}; for (const id of SHOTS) table[id] = { before: Object.fromEntries(keys.map((k) => [k, before[id].agg[k]])), after: Object.fromEntries(keys.map((k) => [k, after[id].agg[k]])), deficits_before: before[id].deficits, deficits_after: after[id].deficits };
fs.writeFileSync(path.join(V2, 'metrics.json'), JSON.stringify({ targets: 'templates/visual_targets.horror-day.json', keys: KEYS, table }, null, 1));
for (const id of SHOTS) { console.log(id); for (const k of keys) console.log(`  ${k.padEnd(14)} ${String(before[id].agg[k]).padStart(9)} -> ${String(after[id].agg[k]).padStart(9)}`); console.log('  deficits before:', before[id].deficits.join(',') || '-', '| after:', after[id].deficits.join(',') || '-'); }
