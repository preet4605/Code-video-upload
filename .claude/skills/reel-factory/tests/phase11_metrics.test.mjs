// Phase 11 visual metrics: lit subject, subject scale, caption-band exclusion, shot similarity, look-aware targets.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { frameMetrics, deficits, shotFingerprint, reelSimilarity, selectTargetsFile, DEFAULT_CAPTION_BAND } from '../lib/visual_metrics.mjs';
import { buildTargets } from '../scripts/style_ref.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tpl = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'templates', n), 'utf8'));
const W = 270, H = 480, BAND = [DEFAULT_CAPTION_BAND];

// RGBA frame helpers (deterministic, no canvas needed)
function frame(bg = [4, 4, 6]) {
  const b = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { b[i * 4] = bg[0]; b[i * 4 + 1] = bg[1]; b[i * 4 + 2] = bg[2]; b[i * 4 + 3] = 255; }
  return b;
}
function rect(b, x0, y0, x1, y1, c) {
  for (let y = Math.round(y0 * H); y < Math.round(y1 * H); y++) for (let x = Math.round(x0 * W); x < Math.round(x1 * W); x++) { const i = (y * W + x) * 4; b[i] = c[0]; b[i + 1] = c[1]; b[i + 2] = c[2]; }
  return b;
}
function wall(seed = 1, stripes = true) { // dim gradient wall; stripes = seeded vertical features that make backdrops distinguishable
  const b = frame();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, v = 30 + Math.floor((y / H) * 40); b[i] = v; b[i + 1] = v - 6; b[i + 2] = v - 10; }
  for (let k = 0; stripes && k < 6; k++) { const x0 = ((k * 37 + seed * 53) % 80) / 100; rect(b, x0, 0.05, x0 + 0.03, 0.6, [10, 10, 14]); }
  return b;
}
function caption(b) { rect(b, 0.1, 0.68, 0.9, 0.76, [255, 255, 255]); for (let k = 0; k < 10; k++) rect(b, 0.14 + k * 0.07, 0.70, 0.16 + k * 0.07, 0.74, [0, 0, 0]); return b; }
const M = (b) => frameMetrics(b, W, H, 4, { ignoreBands: BAND });

test('a black frame with a caption fails lit_fraction and lit_regions; a lit pool passes', () => {
  const T = tpl('visual_targets.horror.json');
  const black = M(caption(frame()));
  assert.equal(black.lit_fraction, 0);
  assert.equal(black.lit_regions, 0);
  const ids = deficits(black, T).map((d) => d.metric);
  assert.ok(ids.includes('lit_fraction') && ids.includes('lit_regions'));
  assert.match(deficits(black, T).find((d) => d.metric === 'lit_fraction').hint, /motivated light pool/);
  const pooled = frame();
  rect(pooled, 0.3, 0.2, 0.7, 0.6, [200, 150, 90]);
  const m = M(caption(pooled));
  assert.ok(m.lit_fraction > 0.1 && m.lit_regions >= 1);
  assert.ok(!deficits(m, T).some((d) => d.metric === 'lit_fraction' || d.metric === 'lit_regions'));
});

test('subject_scale: a tiny figure fails the floor with a concrete hint, a large one passes, establishing is exempt', () => {
  const T = tpl('visual_targets.horror.json');
  const small = wall(1, false); rect(small, 0.47, 0.5, 0.53, 0.58, [220, 200, 180]);        // 8% tall figure
  const large = wall(1, false); rect(large, 0.3, 0.12, 0.7, 0.58, [220, 200, 180]);          // 46% tall figure
  const ms = M(small), ml = M(large);
  assert.ok(ms.subject_scale < 0.22, `small ${ms.subject_scale}`);
  assert.ok(ml.subject_scale >= 0.3, `large ${ml.subject_scale}`);
  const d = deficits(ms, T).find((x) => x.metric === 'subject_scale');
  assert.ok(d && /move camera closer/.test(d.hint) && /22%/.test(d.hint));
  assert.ok(!deficits(ml, T).some((x) => x.metric === 'subject_scale'));
  assert.ok(!deficits({ ...ms, establishing: true }, T).some((x) => x.metric === 'subject_scale'));
  assert.equal(M(frame()).subject_scale, 0, 'an empty black frame has no subject');
});

test('caption band is excluded: adding a caption does not change edges, contrast, saturation or lit metrics', () => {
  const base = wall(3); rect(base, 0.3, 0.12, 0.7, 0.55, [200, 80, 60]);
  const a = M(base), b = M(caption(Buffer.from(base)));
  assert.ok(Math.abs(a.sharp_edges - b.sharp_edges) < 0.0005, `${a.sharp_edges} vs ${b.sharp_edges}`);
  assert.ok(Math.abs(a.contrast - b.contrast) < 0.5);
  assert.ok(Math.abs(a.saturation - b.saturation) < 0.01);
  assert.ok(Math.abs(a.lit_fraction - b.lit_fraction) < 0.005);
  assert.equal(a.subject_scale, b.subject_scale);
  // sanity: without the band the caption WOULD inflate edges (so the exclusion is doing real work)
  const raw = frameMetrics(caption(Buffer.from(base)), W, H, 4);
  assert.ok(raw.sharp_edges > a.sharp_edges * 1.2);
});

const fp = (b) => shotFingerprint([{ buf: b, w: W, h: H, ch: 4 }, { buf: b, w: W, h: H, ch: 4 }, { buf: b, w: W, h: H, ch: 4 }], { ignoreBands: BAND });
test('reelSimilarity: the same backdrop under different figures is flagged as reused; varied backdrops are not', () => {
  const same = [0.2, 0.5, 0.7, 0.35, 0.6].map((x, i) => { const b = wall(1); rect(b, x - 0.06, 0.3, x + 0.06, 0.55, [230, 230, 230 - i * 10]); return { id: `s${i}`, fp: fp(caption(b)) }; });
  const r = reelSimilarity(same);
  assert.equal(r.reused_backdrop, true);
  assert.ok(r.backdrop_share > 0.4 && r.backdrop_clusters[0].length >= 4);
  const bgs = [[30, 20, 60], [120, 40, 30], [20, 90, 50], [200, 190, 120], [10, 10, 10]];
  const varied = bgs.map((c, i) => { const b = frame(c); for (let k = 0; k < 5; k++) rect(b, (k * 0.17 + i * 0.05) % 0.9, 0.1 + 0.15 * i % 0.5, ((k * 0.17 + i * 0.05) % 0.9) + 0.06, 0.3 + 0.1 * k, [255 - 40 * i, 40 * k, 90 + 20 * i]); return { id: `v${i}`, fp: fp(caption(b)) }; });
  const rv = reelSimilarity(varied);
  assert.equal(rv.reused_backdrop, false);
});

test('reelSimilarity: adjacent near-identical shots are flagged, a real cut is not; captions do not matter', () => {
  const a = wall(2); rect(a, 0.4, 0.2, 0.6, 0.55, [240, 220, 200]);
  const a2 = Buffer.from(a); rect(a2, 0.41, 0.2, 0.61, 0.55, [240, 220, 200]);
  const c = frame([120, 30, 30]); rect(c, 0.1, 0.1, 0.9, 0.35, [20, 20, 160]);
  const r = reelSimilarity([{ id: 'one', fp: fp(caption(a)) }, { id: 'two', fp: fp(a2) }, { id: 'three', fp: fp(c) }]);
  assert.deepEqual(r.near_duplicates.map((d) => `${d.a}/${d.b}`), ['one/two']);
  assert.equal(r.top_pairs[0].a, 'one');
  assert.ok(r.top_pairs[0].hash_sim > 0.9);
});

test('look-aware targets: brief.look and genre select the template', () => {
  assert.equal(selectTargetsFile({ genre: 'horror' }), 'visual_targets.horror.json');
  assert.equal(selectTargetsFile({ genre: 'horror', look: 'night' }), 'visual_targets.horror.json');
  assert.equal(selectTargetsFile({ genre: 'horror', look: 'interior' }), 'visual_targets.horror.json');
  assert.equal(selectTargetsFile({ genre: 'horror', look: 'day' }), 'visual_targets.horror-day.json');
  assert.equal(selectTargetsFile({ genre: 'horror', look: 'Daylight' }), 'visual_targets.horror-day.json');
  assert.equal(selectTargetsFile({ genre: 'funny', look: 'day' }), 'visual_targets.json');
  assert.equal(selectTargetsFile({}), 'visual_targets.json');
  for (const n of ['visual_targets.json', 'visual_targets.horror.json', 'visual_targets.horror-day.json']) assert.ok(fs.existsSync(path.join(ROOT, 'templates', n)));
});

test('horror-day template: bright allowed, but needs true blacks, contrast and saturation', () => {
  const T = tpl('visual_targets.horror-day.json');
  assert.equal(T.mean_luma, undefined);
  const bleached = { sharp_edges: 0.05, contrast: 25, mean_luma: 205, saturation: 0.06, color_bins: 15, focal: 3, hue_families: 1, empty_cells: [], p5_luma: 160, subject_scale: 0.4, lit_fraction: 1, lit_regions: 1, ink: 0.03 };
  const ids = deficits(bleached, T).map((d) => d.metric);
  assert.ok(ids.includes('p5_luma') && ids.includes('contrast') && ids.includes('saturation'));
  assert.ok(!ids.includes('mean_luma'));
  const good = { ...bleached, contrast: 50, saturation: 0.25, p5_luma: 25 };
  assert.deepEqual(deficits(good, T), []);
  // the night template still rejects the same bright frame on luma
  assert.ok(deficits(good, tpl('visual_targets.horror.json')).some((d) => d.metric === 'mean_luma'));
});

test('buildTargets carries subject_scale / lit floors only when the references have them', () => {
  const mk = (e) => ({ file: 'x', agg: { sharp_edges: e, contrast: 30, saturation: 0.4, color_bins: 20, focal: 3, ink: 0.03, empty_cells: 2, mean_luma: 20, hue_families: 1, lit_fraction: 0.3, subject_scale: 0.4 } });
  const t = buildTargets([mk(0.03), mk(0.06)], { mood: 'dark' });
  assert.equal(t.subject_scale.min, 0.22);
  assert.ok(t.lit_fraction.min > 0 && t.lit_regions.min === 1);
  const old = buildTargets([{ file: 'x', agg: { sharp_edges: 0.03, contrast: 30, saturation: 0.4, color_bins: 20, focal: 3, ink: 0.03, empty_cells: 2 } }]);
  assert.equal(old.subject_scale, undefined);
});
