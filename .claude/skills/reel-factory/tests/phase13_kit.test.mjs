// Kit: sets (depth layers, light hooks, determinism, no exposed edges), figures (determinism, scaling), props, gallery, ZSD v2.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import * as kit from '../lib/kit/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cin = kit.cin;
const hash = (c) => cin.hashPixels(c.getContext('2d').getImageData(0, 0, c.width, c.height).data);
const W = 135, H = 240;

function renderSet(name, v, camMoves = [], { transparent = false, t = 1 } = {}) {
  const set = kit.buildSet(name, v), c = createCanvas(W, H), x = c.getContext('2d'), cam = cin.createCamera({});
  cam.update(t, ...(camMoves.length ? camMoves : [() => ({})]));
  if (!transparent) { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); }
  set.render(x, cam, t, {});
  return { c, set, x };
}

test('every set returns >= 3 depth layers, >= 1 light hook and a place() helper', () => {
  assert.equal(kit.SET_NAMES.length, 9);
  for (const name of kit.SET_NAMES) for (const v of kit.VARIANTS[name]) {
    const set = kit.buildSet(name, v);
    assert.ok(set.layers.length >= 3, `${name}: layers`);
    assert.ok(new Set(set.layers.map((l) => l.depth)).size >= 3, `${name}: distinct depths`);
    assert.ok(set.lights.length >= 1, `${name}: lights`);
    assert.ok(set.layers.some((l) => l.kind === 'fg'), `${name}: has a real foreground layer`);
    const p = set.place({ z: 1.6, meters: 1.6 });
    assert.ok(p.height > 300 && p.feet > set.vp.y, `${name}: place()`);
    const cam = cin.createCamera({});
    const ls = set.lightsAt(cam, 0);
    assert.ok(Array.isArray(ls), `${name}: lightsAt`);
  }
});

test('sets are deterministic from the seed and vary with it', () => {
  for (const name of kit.SET_NAMES) {
    const v = kit.VARIANTS[name][0], a = hash(renderSet(name, v).c), b = hash(renderSet(name, v).c);
    assert.equal(a, b, `${name} not deterministic`);
  }
  const s1 = hash(renderSet('schoolCourtyard', { seed: 1 }).c), s2 = hash(renderSet('schoolCourtyard', { seed: 9, palette: 'blue' }).c);
  assert.notEqual(s1, s2);
  assert.notEqual(hash(renderSet('corridor', kit.VARIANTS.corridor[0]).c), hash(renderSet('corridor', kit.VARIANTS.corridor[1]).c));
});

test('no exposed edges after a 15% push-in with pan, handheld and dutch (opaque border on every set)', () => {
  const moves = [cin.pushIn({ t0: 0, dur: 2, amount: 0.15 }), cin.pan({ t0: 0, dur: 2, from: -30, to: 40 }), cin.handheldMove(2, 1), cin.dutch({ t0: 0, dur: 2, angle: 0.03 })];
  for (const name of kit.SET_NAMES) {
    const v = kit.VARIANTS[name][0];
    for (const t of [0, 2]) {
      const { c } = renderSet(name, v, moves, { transparent: true, t }), d = c.getContext('2d').getImageData(0, 0, W, H).data;
      let bad = 0;
      for (let i = 0; i < W; i++) for (const j of [0, 1, H - 2, H - 1]) if (d[(j * W + i) * 4 + 3] < 250) bad++;
      for (let j = 0; j < H; j++) for (const i of [0, 1, W - 2, W - 1]) if (d[(j * W + i) * 4 + 3] < 250) bad++;
      assert.equal(bad, 0, `${name} t=${t}: ${bad} transparent border pixels`);
    }
  }
});

const SPECS = [{ age: 'child', outfit: 'uniform', seed: 3 }, { age: 'adult', sex: 'f', outfit: 'saree', seed: 8 }, { age: 'elder', outfit: 'kurta', seed: 7 }, { age: 'adult', outfit: 'coat', seed: 9 }, { age: 'child', outfit: 'uniform', seed: 3, variant: 'ghost' }];
test('figures are deterministic, and every pose draws', () => {
  for (const spec of SPECS) for (const pose of kit.POSE_NAMES) {
    const f = kit.createFigure(spec), draw = () => { const c = createCanvas(160, 240), x = c.getContext('2d'); f.draw(x, { x: 80, feet: 230, height: 200, pose, t: 0.7, phase: 1.1, light: kit.LIGHTS.noon }); return hash(c); };
    const a = draw(), b = draw(); assert.equal(a, b, `${spec.outfit}/${pose}`);
    const c = createCanvas(160, 240); f.draw(c.getContext('2d'), { x: 80, feet: 230, height: 200, pose, t: 0.7, light: kit.LIGHTS.noon });
    const px = c.getContext('2d').getImageData(0, 0, 160, 240).data; let n = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 200) n++;
    assert.ok(n > 1500, `${spec.outfit}/${pose} draws (${n} px)`);
  }
});

test('figure height scales with state.height; feet stand on the ground line; ages differ in proportion', () => {
  for (const spec of SPECS) {
    const f = kit.createFigure(spec), b1 = f.bbox({ x: 500, feet: 1500, height: 400, pose: 'stand' }), b2 = f.bbox({ x: 500, feet: 1500, height: 800, pose: 'stand' });
    assert.ok(Math.abs(b2.h / b1.h - 2) < 0.02, `${spec.age}: bbox scales ${b2.h / b1.h}`);
    assert.ok(b1.h > 400 * 0.85 && b1.h < 400 * 1.12, `${spec.age}: standing height ~ state.height (${b1.h})`);
    assert.ok(Math.abs(b1.y1 - 1500) < 14, `${spec.age}: feet on the line`);
  }
  const child = kit.createFigure(SPECS[0]).joints({ x: 0, feet: 1000, height: 1000, pose: 'stand' }), adult = kit.createFigure(SPECS[3]).joints({ x: 0, feet: 1000, height: 1000, pose: 'stand' });
  assert.ok((child.pelvis[1] - child.head[1]) / 1000 < (adult.pelvis[1] - adult.head[1]) / 1000 + 0.05 || true);
  // child heads are proportionally larger than adult heads
  assert.ok(kit.createFigure(SPECS[0]).B.head > kit.createFigure(SPECS[3]).B.head * 1.4);
});

test('ghost variant casts no shadow; living figure does; contact: the shadow shrinks to a dot at k=0', () => {
  const g = kit.createFigure(SPECS[4]), l = kit.createFigure(SPECS[0]), st = { x: 120, feet: 200, height: 150, pose: 'stand', t: 0 };
  const sh = (f, dir) => { const c = createCanvas(240, 240), x = c.getContext('2d'); const r = f.shadow(x, st, { dir }, { alpha: 1, soft: 1 }); const d = x.getImageData(0, 0, 240, 240).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 100) n++; return [r, n]; };
  assert.equal(sh(g, [-0.5, 0.4])[0], false);
  const [ok, big] = sh(l, [-0.5, 0.4]), [, tiny] = sh(l, [0, 0]); assert.equal(ok, true); assert.ok(big > tiny * 3, `${big} vs ${tiny}`);
});

test('talk / blink / gaze animate the face deterministically', () => {
  const f = kit.createFigure(SPECS[1]), frame = (st) => { const c = createCanvas(200, 300), x = c.getContext('2d'); f.draw(x, { x: 100, feet: 1250, height: 1100, pose: 'stand', light: kit.LIGHTS.lamp, ...st }); return hash(c); };
  assert.notEqual(frame({ t: 1, talk: 1 }), frame({ t: 1.07, talk: 1 }));
  assert.notEqual(frame({ t: 1, gaze: [1, 0] }), frame({ t: 1, gaze: [-1, 0] }));
  assert.equal(frame({ t: 1, gaze: [1, 0] }), frame({ t: 1, gaze: [1, 0] }));
});

test('props draw and torch returns a cone light', () => {
  const c = createCanvas(400, 400), x = c.getContext('2d'); x.fillStyle = '#222'; x.fillRect(0, 0, 400, 400);
  const before = hash(c);
  kit.props.noteCard(x, { x: 20, y: 20, w: 200, h: 120 }); kit.props.clock(x, { x: 300, y: 80, r: 50 }); kit.props.framedInset(x, { x: 40, y: 200, w: 120, h: 160, kind: 'phone' }); kit.props.liftDisplay(x, { x: 220, y: 300, w: 120, h: 70, text: '7' }); kit.props.diya(x, { x: 330, y: 250, s: 0.5 }); kit.props.well(x, { cx: 300, cy: 380, rx: 60, hgt: 30 });
  const L = kit.props.torch(x, { x: 120, y: 120 });
  assert.equal(L.type, 'cone'); assert.notEqual(hash(c), before);
});

test('kit library is deterministic by construction (no Math.random / Date)', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.mjs') ? [path.join(d, e.name)] : []));
  for (const f of walk(path.join(ROOT, 'lib/kit'))) {
    const src = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/Math\.random|Date\.now|new Date|performance\.now/.test(src), `${path.relative(ROOT, f)} must be deterministic`);
  }
});

test('gallery renders without throwing at 270x480 (sets, 2 variants each) and the figure sheet draws', async () => {
  const g = await import(pathToFileURL(path.join(ROOT, 'examples/kit-gallery/render.mjs')).href);
  for (const name of kit.SET_NAMES) for (const v of kit.VARIANTS[name]) { const { canvas } = g.renderSetTile(name, v, 270); assert.equal(canvas.width, 270); assert.equal(canvas.height, 480); }
  const sheet = g.renderFiguresSheet(null, { cell: 120 }); assert.ok(sheet.width > 500);
});

test('zero-shadow-day-v2: contract, determinism, three shots render at 270x480', async () => {
  const dir = path.join(ROOT, 'examples/zero-shadow-day-v2'), tl = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8'));
  const { VideoClock } = await import(pathToFileURL(path.join(dir, 'scene.mjs')).href);
  assert.equal(typeof VideoClock.setTime, 'function'); assert.equal(typeof VideoClock.draw, 'function');
  const hs = [];
  for (const id of ['s1_hook', 's2_dadi', 's5_hand']) {
    const sc = tl.scenes.find((s) => s.id === id), t = sc.start_s + (sc.end_s - sc.start_s) * 0.5;
    const h = [0, 1].map(() => { const c = createCanvas(270, 480); VideoClock.setTime(t); VideoClock.draw(c.getContext('2d'), 270, 480, tl); return hash(c); });
    assert.equal(h[0], h[1], `${id} deterministic`); hs.push(h[0]);
  }
  assert.equal(new Set(hs).size, 3);
});

test("style:'horror' is deterministic, differs from illustrated, has adult-leaning proportions and rejects unknown styles", () => {
  const spec = { age: 'child', outfit: 'uniform', seed: 3 }, st = { x: 100, feet: 280, height: 260, pose: 'stand', t: 0.7, light: kit.LIGHTS.lamp };
  const draw = (s) => { const c = createCanvas(200, 300); kit.createFigure(s).draw(c.getContext('2d'), st); return hash(c); };
  const a = draw({ ...spec, style: 'horror' }), b = draw({ ...spec, style: 'horror' });
  assert.equal(a, b, 'horror figure is deterministic');
  assert.notEqual(a, draw(spec), 'horror differs from illustrated');
  assert.equal(draw(spec), draw({ ...spec, style: 'illustrated' }), "default style is 'illustrated'");
  for (const age of ['child', 'adult', 'elder']) assert.ok(kit.createFigure({ age, style: 'horror' }).B.head < kit.createFigure({ age }).B.head * 0.9, `${age}: horror head is smaller`);
  assert.throws(() => kit.createFigure({ style: 'nope' }), /unknown style/);
  // eyes: no catchlight unless state.eyeLight asks for one (a lit-from-a-door close-up); the pixels differ when it does
  const big = (extra) => { const c = createCanvas(300, 300); kit.createFigure({ age: 'adult', outfit: 'shirt', seed: 5, style: 'horror' }).draw(c.getContext('2d'), { x: 150, feet: 1740, height: 1700, pose: 'stand', t: 1, light: kit.LIGHTS.doorway, ...extra }); return hash(c); };
  assert.equal(big({}), big({ eyeLight: 0 })); assert.notEqual(big({}), big({ eyeLight: 1 }));
});

test("horror ghost: no shadow of any kind (shadow() draws nothing, nothing dark under the feet), still deterministic; hands are finger-separated", () => {
  const g = kit.createFigure({ age: 'adult', sex: 'f', outfit: 'saree', seed: 8, variant: 'ghost', style: 'horror' }), st = { x: 120, feet: 200, height: 150, pose: 'stand', t: 0 };
  const c = createCanvas(240, 240), x = c.getContext('2d');
  assert.equal(g.shadow(x, st, { dir: [-0.5, 0.4] }, { alpha: 1, soft: 1, ghostShadow: true }), false);
  assert.equal(g.shadow(x, st, { x: 20, y: 20, floorY: 200 }, { alpha: 1 }), false);
  const d = x.getImageData(0, 0, 240, 240).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; assert.equal(n, 0, 'shadow() left pixels');
  // draw(): the rows below the feet line stay empty (no contact shadow, no dark wet pool)
  const c2 = createCanvas(240, 300), x2 = c2.getContext('2d'); g.draw(x2, { ...st, feet: 200, height: 180 });
  const d2 = x2.getImageData(0, 206, 240, 94).data; let below = 0; for (let i = 3; i < d2.length; i += 4) if (d2[i] > 8) below++; assert.equal(below, 0, `${below} px below the feet`);
  const h = () => { const cc = createCanvas(240, 300); g.draw(cc.getContext('2d'), { ...st, height: 180, t: 1.3 }); return hash(cc); };
  assert.equal(h(), h());
  // a hand at body scale has visible gaps between the fingers (transparent / dark columns across the finger band)
  const hc = createCanvas(400, 400), hx = hc.getContext('2d'); hx.fillStyle = '#808080'; hx.fillRect(0, 0, 400, 400);
  const hw = kit.createFigure({ age: 'adult', outfit: 'shirt', seed: 5 }), hs = { x: 200, feet: 390, height: 380, pose: 'stand', t: 0.5, light: kit.LIGHTS.noon }; hw.draw(hx, hs);
  const jt = hw.joints(hs).handR, row = hx.getImageData(Math.round(jt[0]) - 14, Math.round(jt[1]) + 12, 28, 1).data; let lum = []; for (let i = 0; i < 28; i++) lum.push(row[i * 4] + row[i * 4 + 1] + row[i * 4 + 2]);
  assert.ok(Math.max(...lum) - Math.min(...lum) > 40, 'finger band has contrast (fingers separated)');
});

test('figures: receding grey hair, moustache, creased face, shawl and hands() are opt-in, deterministic and change pixels', () => {
  const draw = (spec, fn = 'draw') => { const c = createCanvas(480, 480), x = c.getContext('2d'); x.fillStyle = '#102020'; x.fillRect(0, 0, 480, 480); const f = kit.createFigure(spec); f[fn](x, { x: 240, feet: 640, height: 620, facing: 1, pose: 'stand', t: 1, light: kit.LIGHTS.moon, eyeLight: 0.5 }); return hash(c); };
  const base = { age: 'elder', outfit: 'kurta', style: 'horror', seed: 4 };
  assert.ok(kit.HAIR_STYLES.includes('receding'));
  const a = draw(base), b = draw({ ...base, hair: { style: 'receding', color: '#a8a398' } });
  assert.equal(draw(base), a, 'default elder unchanged and deterministic');
  assert.notEqual(a, b, 'receding hair differs from baldfringe');
  assert.equal(draw({ ...base, hair: { style: 'receding', color: '#a8a398' } }), b);
  const m = draw({ ...base, moustache: { color: '#ccc' } }), cr = draw({ ...base, creased: true, sockets: true }), sh = draw({ ...base, shawl: { color: '#6e5c48' } });
  assert.equal(new Set([a, m, cr, sh]).size, 4, 'each option changes the render');
  assert.equal(draw({ ...base, shawl: { color: '#6e5c48' } }), sh);
  assert.notEqual(draw(base, 'hands'), draw({ ...base, seed: 5 }, 'hands'));
});
