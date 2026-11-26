// sets/core: the set contract, palettes, light hooks and the shared draw helpers (perspective quads, ambient occlusion).
//
// A set is   { name, seed, tod, palette, vp:{x,y}, groundY, upm, layers[], lights[], sun, anchors, ...methods }
//   layers   [{id, depth, kind:'back'|'lit'|'fg', fullBleed?, blur?, draw(c, bounds, occ, t)}]; `occ` = true draws flat black
//            (for godRays occluders); `kind` decides how render() lights it.
//   lights   [{id, kind, type:'point'|'cone'|'window'|'door', x, y, depth, r?, rect?, color, intensity, ...}] authored coords on the
//            plane `depth`; lightsAt(cam) projects them to screen for cinema.darkMask / godRays.
//   render(ctx, cam, t, {subjects:[{depth, draw(ctx)}], lit, between})  draws everything far -> near; subjects (figures, props) slot in by depth.
//   place({z, x, age}) -> {x, feet, height}  where to put a figure so it stands on the floor at depth z with a believable scale.
import { cin, cl, lerp, mix, shade, rgba, tweak, mulberry32, Path2D, DW, DH, h01 } from '../util.mjs';

export const TODS = ['noon', 'day', 'dusk', 'night'];
const BASES = {
  whitewash: ['#e9e2cf', '#d4c9ae', '#7e6a52'], cream: ['#dccaa0', '#c3ad80', '#6b4a2a'], green: ['#a8bda0', '#8aa283', '#4a3a2a'], blue: ['#a9c0cf', '#8aa5b8', '#4d3b2d'],
  ochre: ['#d3a35e', '#b98743', '#5a3a22'], pink: ['#dca9a2', '#c48a84', '#5d3b30'], grey: ['#a7a9a8', '#8b8e8d', '#3d3d3f'], mud: ['#b88a62', '#9a7048', '#4a3220'],
};
export const PALETTES = Object.keys(BASES);

/** palette from a base name, a seed (small hue/value jitter) and a time of day. */
export function makePalette(name = 'cream', seed = 1, tod = 'noon') {
  const [wall, wall2, wood] = BASES[name] ?? BASES.cream, r = mulberry32(seed * 9 + 3);
  const j = (c) => tweak(c, { h: (r() - 0.5) * 12, s: 0.9 + r() * 0.2, l: (r() - 0.5) * 0.04 });
  const P = { name, wall: j(wall), wall2: j(wall2), wood: j(wood), trim: shade(j(wall), -0.22), floor: shade(j(wall2), -0.18), accent: ['#8c2b3f', '#2f6b86', '#b3612c', '#3e7a4d'][Math.floor(r() * 4)] };
  const T = { noon: { sky0: '#8fb4e8', sky1: '#e9f1ff', sky2: '#fff8e8', sun: '#fff4d6', amb: '#5d6478', tint: 0 },
    day: { sky0: '#7aa3d6', sky1: '#bcd3ee', sky2: '#eee6d2', sun: '#ffe9c0', amb: '#58607a', tint: 0.0 },
    dusk: { sky0: '#2c3a6e', sky1: '#c9707a', sky2: '#ffc27a', sun: '#ffb070', amb: '#2b2a4a', tint: 0.1 },
    night: { sky0: '#02040b', sky1: '#0b1530', sky2: '#233657', sun: '#a9bcff', amb: '#070c18', tint: 0.5 } }[tod];
  return { ...P, ...T, tod };
}

// ---------------------------------------------------------------- projection helpers
/** perspective: world (X,Y,Z) with Z in focal units, X/Y in px at Z=1 -> authored px. */
export const makeProj = (vp) => (X, Y, Z) => [vp.x + X / Z, vp.y + Y / Z];

export function quad(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
export const quadPath = (pts) => { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); return p; };
const bbox = (pts) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; };
export { bbox };

/** ambient-occlusion strip hugging the edge A0-A1 of a quad, spreading toward `n` (unit vector into the surface). */
export function aoStrip(c, a0, a1, n, width, alpha = 0.35, color = '#000') {
  const mx = (a0[0] + a1[0]) / 2, my = (a0[1] + a1[1]) / 2, g = c.createLinearGradient(mx, my, mx + n[0] * width, my + n[1] * width);
  g.addColorStop(0, rgba(color, alpha)); g.addColorStop(0.5, rgba(color, alpha * 0.28)); g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g; c.beginPath(); c.moveTo(a0[0], a0[1]); c.lineTo(a1[0], a1[1]); c.lineTo(a1[0] + n[0] * width, a1[1] + n[1] * width); c.lineTo(a0[0] + n[0] * width, a0[1] + n[1] * width); c.closePath(); c.fill();
}
/** thin highlight along an edge (the lit edge of a trim / corner). */
export function edgeLight(c, a0, a1, color, w = 3, alpha = 0.7) { c.strokeStyle = rgba(color, alpha); c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(a0[0], a0[1]); c.lineTo(a1[0], a1[1]); c.stroke(); }

/** brick/stone course lines inside a perspective wall quad (lines of constant height and constant depth). */
export function wallCourses(c, P, X, y0, y1, z0, z1, { rows = 8, color = '#000', a = 0.14, cols = 0, w = 2 } = {}) {
  c.strokeStyle = rgba(color, a); c.lineWidth = w;
  for (let i = 1; i < rows; i++) { const y = lerp(y0, y1, i / rows); const A = P(X, y, z0), B = P(X, y, z1); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); }
  for (let i = 1; i < cols; i++) { const z = lerp(z0, z1, i / cols); const A = P(X, y0, z), B = P(X, y1, z); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); }
}

/** Assemble a set object from builder output. */
export function makeSet(def) {
  const set = { subjectsDefault: [], ...def };
  set.layers.sort((a, b) => b.depth - a.depth || (a.order ?? 0) - (b.order ?? 0));
  set.lightsAt = (cam, t = 0) => lightsAt(set, cam, t);
  set.render = (ctx, cam, t, o = {}) => render(set, ctx, cam, t, o);
  set.occluder = (o, cam, t = 0, filter) => { for (const L of set.layers) if (L.kind !== 'back' && (!filter || filter(L))) cam.layer(o, L.depth, (c, b) => L.draw(c, b, true, t), { fullBleed: L.fullBleed }); };
  set.place = ({ z = 1.4, x = 0, meters = 1.6 } = {}) => ({ x: set.vp.x + x / z, feet: set.vp.y + set.groundH / z, height: (meters * set.upm) / z });
  set.figureLight = (cam, at = [540, 1200], t = 0) => figureLight(set, cam, at, t);
  return set;
}

function lightsAt(set, cam, t) {
  const out = [];
  for (const L of set.lights) {
    if (L.type === 'sun') continue;
    const fl = L.flicker ? 1 + L.flicker * (cin.noise1(L.seed ?? 3, t * 8) * 0.6 + cin.noise1((L.seed ?? 3) + 1, t * 1.7) * 0.4) : 1;
    const p = cam.project(L.x, L.y, L.depth); if (!p.visible) continue;
    const sc = p.scale;
    if (L.type === 'point') out.push({ type: 'point', x: p.sx, y: p.sy, r: L.r * sc, color: L.color, intensity: (L.intensity ?? 1) * fl });
    else if (L.type === 'cone') out.push({ type: 'cone', x: p.sx, y: p.sy, angle: L.angle, spread: L.spread, length: L.length * sc, color: L.color, intensity: (L.intensity ?? 1) * fl });
    else if (L.type === 'window' || L.type === 'door') { const q = cam.project(L.x + L.w, L.y + L.h, L.depth); out.push({ type: L.type, rect: [p.sx, p.sy, q.sx - p.sx, q.sy - p.sy], color: L.color, intensity: (L.intensity ?? 1) * fl, throw: L.throw, throwX: L.throwX, reach: L.reach, spill: L.spill }); }
  }
  return out;
}

function figureLight(set, cam, at, t) {
  // pick the strongest light and aim the figure's key at it; fill/ambient from the palette
  const ls = set.lights.filter((L) => L.type !== 'sun');
  const sun = set.lights.find((L) => L.type === 'sun');
  if (sun) return { dir: { x: sun.dir[0], y: sun.dir[1] }, key: sun.color, amb: set.palette.amb, hard: true, strength: 1, rim: sun.color, rimA: 0.8 };
  let best = null, bs = -1;
  for (const L of ls) { const p = cam.project(L.x + (L.w ?? 0) / 2, L.y + (L.h ?? 0) / 2, L.depth), d = Math.hypot(p.sx - at[0], p.sy - at[1]) + 1, s = (L.intensity ?? 1) * (L.r ?? 500) / d; if (s > bs) { bs = s; best = { p, L }; } }
  if (!best) return { dir: { x: 0.3, y: -1 }, key: '#fff', amb: set.palette.amb, strength: 0.8 };
  const dx = best.p.sx - at[0], dy = best.p.sy - at[1], m = Math.hypot(dx, dy) || 1;
  return { dir: { x: dx / m, y: dy / m }, key: best.L.color, amb: set.palette.amb, strength: 1.1, rim: best.L.color, rimA: 1 };
}

function render(set, ctx, cam, t, o) {
  const subj = (o.subjects || []).map((s) => ({ ...s, kind: 'subject' }));
  const lit = o.lit ?? set.palette.tod === 'night' || set.palette.tod === 'dusk' || set.forceMask;
  const lights = lit ? set.lightsAt(cam, t) : null;
  const lopt = { ambient: set.ambient ?? set.palette.amb, glow: set.glow ?? 0.3, ...(o.mask || {}) };
  const backs = set.layers.filter((L) => L.kind === 'back'), mids = set.layers.filter((L) => L.kind === 'lit'), fgs = set.layers.filter((L) => L.kind === 'fg');
  for (const L of backs) cam.layer(ctx, L.depth, (c, b) => L.draw(c, b, false, t), { fullBleed: L.fullBleed });
  const drawMids = (cx) => { for (const L of mids) cam.layer(cx, L.depth, (c, b) => L.draw(c, b, false, t), { fullBleed: L.fullBleed }); };
  // lit layers: either through the dark mask (night / dusk) or straight (day, hard sun baked into the art)
  if (lit) cin.darkMaskLayer(ctx, (x) => { drawMids(x); }, lights, lopt); else drawMids(ctx);
  if (o.afterWorld) o.afterWorld(ctx, lights);
  // subjects are sorted far -> near and interleaved with foreground layers by depth
  const rest = [...subj, ...fgs.map((L) => ({ kind: 'fg', depth: L.depth, L }))].sort((a, b) => b.depth - a.depth);
  for (const s of rest) {
    if (s.kind === 'fg') cam.layer(ctx, s.L.depth, (c, b) => s.L.draw(c, b, false, t), { fullBleed: s.L.fullBleed, blur: s.L.blur });
    else s.draw(ctx, cam);
  }
}
