// Visual self-improvement loop: metrics, calibration, critique enforcement, regression notes, convergence.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { frameMetrics, deficits } from '../lib/visual_metrics.mjs';
import { buildTargets } from '../scripts/style_ref.mjs';
import { runVisualLoop, validateCritique } from '../scripts/visual_loop.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMO = path.join(ROOT, 'examples/visual-loop-demo');
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates/visual_targets.json'), 'utf8'));

function demoCopy(sceneFile) {
  // must live under examples/ so the scene's ../../lib imports resolve
  const d = fs.mkdtempSync(path.join(ROOT, 'examples', '.vl_test_'));
  for (const f of ['timeline.json', 'brief.json']) fs.copyFileSync(path.join(DEMO, f), path.join(d, f));
  fs.copyFileSync(path.join(DEMO, sceneFile), path.join(d, 'scene.mjs'));
  return d;
}
const good = (id, extra = {}) => ({ id, seen: 'a description of what is actually visible in the frame', problems: [], fix: 'a concrete change to the scene', scores: { subject: 4, depth: 3, detail: 4, light: 4, character: 3, composition: 4 }, ...extra });

test('frameMetrics: flat frame has no edges and is all dead cells; a busy frame has detail', () => {
  const W = 90, H = 160;
  const flat = Buffer.alloc(W * H * 3, 60);
  const m = frameMetrics(flat, W, H, 3);
  assert.equal(m.sharp_edges, 0);
  assert.equal(m.empty_cells.length, 15);
  const busy = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) { const v = ((i % W) >> 2) % 2 ^ ((Math.floor(i / W) >> 2) % 2) ? 230 : 20; busy[i * 3] = v; busy[i * 3 + 1] = v; busy[i * 3 + 2] = v; }
  const b = frameMetrics(busy, W, H, 3);
  assert.ok(b.sharp_edges > 0.1 && b.empty_cells.length === 0 && b.contrast > 80);
  assert.ok(deficits({ ...m }, T).some((d) => d.metric === 'sharp_edges'));
});

test('buildTargets: floors from the weakest reference, aims from the median, palette cap', () => {
  const mk = (e, c) => ({ file: 'x', agg: { sharp_edges: e, contrast: c, saturation: 0.4, color_bins: 20, focal: 3, ink: 0.03, empty_cells: 2 } });
  const t = buildTargets([mk(0.03, 30), mk(0.06, 50), mk(0.07, 40)]);
  assert.equal(t.sharp_edges.min, 0.024);
  assert.equal(t.sharp_edges.aim, 0.06);
  assert.equal(t.contrast.min, 24);
  assert.equal(t.color_bins.max, 28);
});

test('shipped targets come from the four reference code reels and reject the V5 look', () => {
  assert.equal(T.calibrated_from.length, 4);
  const v5 = { sharp_edges: 0.0109, contrast: 20.2, saturation: 0.34, color_bins: 11, focal: 6.8, ink: 0.007, empty_cells: Array(11).fill('x') };
  const ids = deficits(v5, T).map((d) => d.metric);
  assert.ok(ids.includes('sharp_edges') && ids.includes('contrast') && ids.includes('empty_cells'));
});

test('validateCritique: missing shot, short seen, bad scores, rubber stamp, repeated fix, missing regression note', () => {
  const ids = ['a', 'b', 'c'];
  assert.deepEqual(validateCritique({ shots: [good('a'), good('b'), good('c', { scores: { subject: 3, depth: 4, detail: 2, light: 4, character: 3, composition: 5 } })] }, ids), []);
  assert.ok(validateCritique({ shots: [good('a'), good('b')] }, ids).some((e) => e.includes('"c" not critiqued')));
  assert.ok(validateCritique({ shots: [good('a', { seen: 'ok' }), good('b'), good('c')] }, ids).some((e) => e.includes('seen')));
  assert.ok(validateCritique({ shots: [good('a', { scores: { subject: 9 } }), good('b'), good('c')] }, ids).some((e) => e.includes('scores')));
  const stamp = { shots: ids.map((id) => good(id, { scores: { subject: 5, depth: 5, detail: 5, light: 5, character: 5, composition: 5 } })) };
  assert.ok(validateCritique(stamp, ids).some((e) => e.includes('rubber-stamp')));
  const prev = { shots: [good('a', { fix: 'same fix again' })] };
  assert.ok(validateCritique({ shots: [good('a', { fix: 'same fix again' }), good('b'), good('c')] }, ids, prev).some((e) => e.includes('same fix')));
  assert.ok(validateCritique({ shots: [good('a'), good('b'), good('c')] }, ids, null, ['b']).some((e) => e.includes('regression_note')));
});

test('loop end to end: a flat first draft fails, the next iteration is blocked without a critique, the fixed scene converges', async () => {
  const d = demoCopy('scene.iter01.mjs');
  try {
    const r1 = await runVisualLoop({ projectDir: d });
    assert.equal(r1.pass, false);
    assert.ok(r1.failing.find((f) => f.id === 'door').deficits.some((x) => x.startsWith('sharp_edges')));
    assert.ok(r1.failing.some((f) => f.deficits.some((x) => x.startsWith('key_change'))), 'static first draft is flagged');
    assert.ok(fs.existsSync(path.join(d, 'visual_loop/iter_01/sheet.png')));
    const blocked = await runVisualLoop({ projectDir: d });
    assert.equal(blocked.blocked, true);
    fs.writeFileSync(path.join(d, 'visual_loop/iter_01/critique.json'), JSON.stringify({ shots: ['room', 'door', 'face'].map((id) => good(id, { scores: { subject: 1, depth: 1, detail: 1, light: 2, character: 1, composition: 2 } })) }));
    fs.copyFileSync(path.join(DEMO, 'scene.iter04.mjs'), path.join(d, 'scene.mjs'));
    const r2 = await runVisualLoop({ projectDir: d });
    assert.equal(r2.pass, true, JSON.stringify(r2.failing));
    fs.writeFileSync(path.join(d, 'visual_loop/iter_02/critique.json'), JSON.stringify({ shots: ['room', 'door', 'face'].map((id) => good(id, { fix: 'accepted after the rebuild, no further change' })) }));
    const r3 = await runVisualLoop({ projectDir: d });
    assert.equal(r3.converged, true);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('the shipped demo log shows the loop improving and converging', () => {
  const log = JSON.parse(fs.readFileSync(path.join(DEMO, 'visual_loop/log.json'), 'utf8'));
  const it = log.iterations;
  assert.ok(it.length >= 3);
  assert.equal(it[0].pass, false);
  assert.equal(it[it.length - 1].pass, true);
  assert.ok(it[it.length - 1].critique_min >= 3);
  assert.ok(it[it.length - 1].mean_score > it[0].mean_score * 2);
});
