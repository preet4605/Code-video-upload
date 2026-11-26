// sets/open: open-ground one-point-perspective sets. Each builder returns a set (see core.mjs) built from depth layers:
// sky -> far horizon -> main mass -> side masses -> mid props -> ground detail -> foreground. Every lit layer paints the ground
// from its own base line down, so the ground is continuous whatever the depth stack does under a push-in.
import { cin, cl, lerp, mix, shade, rgba, tweak, mulberry32, Path2D, smoothClosed, ribbon, stains, streaks, edgeAO, surface, TAU, h01, DW, DH } from '../util.mjs';
import { makeSet, makePalette, makeProj, quadPath, bbox, aoStrip, edgeLight } from './core.mjs';
import { sky, makeGround, pillar, archPath, barredWindow, foliage, tree, diya } from './parts.mjs';

const opt = (o, k, d) => (o && o[k] !== undefined ? o[k] : d);
const fillB = (c, b, col) => { c.fillStyle = col; c.fillRect(b.x0, b.y0, b.w, b.h); };
const blk = (c) => { c.fillStyle = '#000'; };

/** Sun hard shadow vector (px per px of height) for a given set: sun low/behind -> shadows fall toward the camera. */
function sunOf(o) { const k = opt(o, 'shadowK', 0.6); return { dir: [-0.62 * k, 0.55 * k], k }; }

// =================================================================== school courtyard (verandah arches + well)
export function schoolCourtyard(o = {}) {
  const seed = opt(o, 'seed', 1), tod = opt(o, 'tod', 'noon'), pal = makePalette(opt(o, 'palette', 'whitewash'), seed, tod), wear = opt(o, 'wear', 0.45), night = tod === 'night';
  const vp = { x: 540, y: opt(o, 'vpY', 790) }, groundH = 640, S = { vp, groundH, palette: pal, wear, seed }, gy = (z) => vp.y + groundH / z;
  S.ground = makeGround(S, { color: pal.floor, tex: 'stone', texA: 0.5, wm: 0.55, joints: 'slabs' });
  const sun = sunOf(o), accent = opt(o, 'dado', pal.accent === '#8c2b3f' ? '#2f6b86' : pal.accent), arches = opt(o, 'arches', 5);
  const props = opt(o, 'props', ['well', 'tree']);
  const layers = [];
  layers.push({ id: 'sky', depth: 8, kind: 'back', fullBleed: true, draw: (c, b) => sky(c, b, pal, { seed, sunX: opt(o, 'sunX', 800), sunY: night ? 220 : 110, moon: night, horizonY: gy(8) }) });
  // far horizon: low houses + trees, hazy
  layers.push({ id: 'horizon', depth: 6, kind: 'lit', draw: (c, b, occ) => {
    const y = gy(6), r = mulberry32(seed * 3 + 1), hz = night ? '#0b1020' : mix(pal.sky2, '#9aa28e', 0.55);
    c.fillStyle = occ ? '#000' : hz;
    for (let x = b.x0 - 50; x < b.x1 + 50;) { const w = 60 + r() * 110, h = 30 + r() * 80; c.fillRect(x, y - h, w, h + 6); if (r() < 0.45 && !occ) { c.fillStyle = shade(hz, -0.12); c.beginPath(); c.arc(x + w / 2, y - h, 20 + r() * 24, Math.PI, 0); c.fill(); c.fillStyle = hz; } x += w + r() * 20; }
    if (occ) { S.ground.blit(c, b, 6, true); return; }
    foliage(c, 110, y - 28, 150, 52, pal, { seed: seed + 5, n: 24, leaf: night ? '#0f1a14' : '#6b8a5c', lit: night ? '#1b2c22' : '#9fb783', dark: night ? '#060a08' : '#44603c', size: 0.8 });
    S.ground.blit(c, b, 6);
    // distance haze
    const g = c.createLinearGradient(0, y - 120, 0, y + 30); g.addColorStop(0, rgba(pal.sky2, 0)); g.addColorStop(1, rgba(pal.sky2, night ? 0.1 : 0.5)); c.fillStyle = g; c.fillRect(b.x0, y - 120, b.w, 150);
  } });
  // main mass: the school building with a verandah of arches
  layers.push({ id: 'school', depth: 4.2, kind: 'lit', draw: (c, b, occ, t) => {
    const gyb = gy(4.2), top = gyb - 372, x0 = -380, x1 = DW + 380;
    if (occ) { c.fillStyle = '#000'; c.fillRect(x0, top - 30, x1 - x0, gyb - top + 30); S.ground.blit(c, b, 4.2, true); return; }
    const wallC = night ? shade(pal.wall, -0.55) : pal.wall;
    surface(c, quadPath([[x0, top], [x1, top], [x1, gyb], [x0, gyb]]), [x0, top, x1, gyb], { color: wallC, tex: 'plaster', texA: 0.55, scale: 1.2, seed: seed + 2, wear, stain: '#3a2c1c' });
    // roof slab + parapet
    c.fillStyle = shade(wallC, -0.12); c.fillRect(x0, top - 34, x1 - x0, 34); c.fillStyle = rgba('#000', 0.35); c.fillRect(x0, top - 6, x1 - x0, 6); c.fillStyle = shade(wallC, 0.12); c.fillRect(x0, top - 34, x1 - x0, 5);
    for (let x = -40; x < x1; x += 120) { c.fillStyle = shade(wallC, -0.08); c.fillRect(x, top - 70, 62, 36); }
    // blue dado band (plinth)
    c.fillStyle = night ? shade(accent, -0.5) : accent; c.fillRect(x0, gyb - 54, x1 - x0, 54); c.fillStyle = rgba('#fff', 0.18); c.fillRect(x0, gyb - 54, x1 - x0, 4); c.fillStyle = rgba('#000', 0.3); c.fillRect(x0, gyb - 6, x1 - x0, 6);
    // verandah arcade
    const vx0 = 60, vx1 = DW - 60, n = arches, pw = 38, span = (vx1 - vx0 - pw) / n;
    c.fillStyle = shade(wallC, -0.1); c.fillRect(vx0 - 10, top + 18, vx1 - vx0 + 20, 70);       // entablature
    c.fillStyle = rgba('#000', 0.55); c.fillRect(vx0 - 10, top + 84, vx1 - vx0 + 20, 6);
    for (let i = 0; i < n; i++) {
      const ax0 = vx0 + pw / 2 + i * span + pw / 2 - pw * 0.0, ax1 = vx0 + pw / 2 + (i + 1) * span - pw / 2, ap = archPath(ax0 + 2, ax1 - 2, gyb - 54, top + 108);
      // deep shade inside the verandah: hard black at the top, a little bounce at the floor
      const ig = c.createLinearGradient(0, top + 100, 0, gyb - 54); ig.addColorStop(0, '#050403'); ig.addColorStop(0.7, night ? '#0c0a09' : '#1a1410'); ig.addColorStop(1, night ? '#161210' : '#3a2e24');
      c.fillStyle = ig; c.fill(ap);
      c.save(); c.clip(ap);
      // back wall of the verandah: door + window barely visible
      const cx = (ax0 + ax1) / 2;
      if (i % 2 === 0) { c.fillStyle = rgba('#6a5a48', 0.55); c.fillRect(cx - 30, gyb - 54 - 190, 60, 190); c.fillStyle = '#0a0806'; c.fillRect(cx - 24, gyb - 54 - 184, 48, 184); }
      else { barredWindow(c, cx - 38, gyb - 54 - 190, 76, 110, pal, { inner: '#070605', bars: 3, sill: false }); }
      // a bright sun patch lying on the verandah floor near the opening edge
      const fg = c.createLinearGradient(0, gyb - 100, 0, gyb - 54); fg.addColorStop(0, rgba(pal.sun, 0)); fg.addColorStop(1, rgba(pal.sun, night ? 0.04 : 0.28)); c.fillStyle = fg; c.fillRect(ax0, gyb - 100, ax1 - ax0, 46);
      c.restore();
      // arch rim: bright lit edge on the sun side, dark soffit line inside
      c.strokeStyle = rgba(shade(wallC, 0.2), 0.9); c.lineWidth = 3; c.stroke(ap); c.strokeStyle = rgba('#000', 0.6); c.lineWidth = 5; c.save(); c.clip(ap); c.stroke(ap); c.restore();
    }
    for (let i = 0; i <= n; i++) pillar(c, vx0 + pw / 2 + i * span, top + 92, gyb - 54, pw, pal, { color: night ? shade(pal.wall, -0.45) : shade(pal.wall, 0.03), cap: true, shadeA: night ? 0.3 : 0.7 });
    // eave shadow band under the roof: the hardest shadow in the picture
    const eg = c.createLinearGradient(0, top + 90, 0, top + 190); eg.addColorStop(0, rgba('#000', 0.55)); eg.addColorStop(1, rgba('#000', 0)); c.fillStyle = eg; c.fillRect(x0, top + 90, vx0 - 10 - x0, 100); c.fillRect(vx1 + 10, top + 90, x1 - vx1 - 10, 100);
    // wings: barred windows left and right with sills + notice board
    for (const [wx0, wx1] of [[-330, vx0 - 70], [vx1 + 70, x1 - 50]]) for (let x = wx0 + 40; x < wx1 - 80; x += 190) barredWindow(c, x, top + 150, 100, 150, pal, { inner: night ? '#c8903a' : '#0a0807', glow: night ? '#d9a050' : null, bars: 4 });
    c.fillStyle = '#2d3b2a'; c.fillRect(vx1 + 90, top + 360 - 130 + 0, 0, 0);
    // bell / school sign
    c.fillStyle = shade(wallC, -0.2); c.fillRect(vx0 + 2 * span, top - 62, span * 1.4, 26); c.fillStyle = rgba('#fff', 0.5); c.fillRect(vx0 + 2 * span + 10, top - 54, span * 1.4 - 20, 8);
    S.ground.blit(c, b, 4.2);
    // contact shadow of the building on the ground + eave pool
    const sg = c.createLinearGradient(0, gyb, 0, gyb + 34 + 70 * sun.k); sg.addColorStop(0, rgba('#000', night ? 0.35 : 0.5)); sg.addColorStop(1, rgba('#000', 0)); c.fillStyle = sg; c.fillRect(b.x0, gyb, b.w, 34 + 70 * sun.k);
  } });
  // side masses: boundary walls with a gate on the left; right: tree
  layers.push({ id: 'sides', depth: 2.8, kind: 'lit', draw: (c, b, occ, t) => {
    const gyb = gy(2.8), wt = gyb - 330;
    const wallC = night ? shade(pal.wall2, -0.55) : pal.wall2;
    if (occ) { c.fillStyle = '#000'; c.fillRect(-300, wt, 640, 330); c.fillRect(840, wt, 600, 330); if (props.includes('tree')) tree(c, 930, gyb, 760, pal, { seed, occ: true }); return; }
    // left wall + gate pillars
    surface(c, quadPath([[-300, wt], [330, wt], [330, gyb], [-300, gyb]]), [-300, wt, 330, gyb], { color: wallC, tex: 'brick', texA: 0.35, scale: 1.1, seed: seed + 4, wear, stain: '#2a1d12' });
    c.fillStyle = shade(wallC, -0.2); c.fillRect(-300, wt - 18, 640, 24); c.fillStyle = rgba('#fff', 0.2); c.fillRect(-300, wt - 18, 640, 4);
    c.fillStyle = rgba(accent, 0.9); c.fillRect(-300, gyb - 46, 640, 46);
    // gate: two pillars and a dark opening
    pillar(c, 330, wt - 50, gyb, 54, pal, { color: wallC, cap: true, lightX: -1, shadeA: 0.6 });
    // right side: boundary wall behind the tree
    surface(c, quadPath([[840, wt + 60], [1500, wt + 60], [1500, gyb], [840, gyb]]), [840, wt, 1500, gyb], { color: wallC, tex: 'brick', texA: 0.35, scale: 1.1, seed: seed + 6, wear, stain: '#2a1d12' });
    c.fillStyle = shade(wallC, -0.2); c.fillRect(840, wt + 42, 660, 24);
    c.fillStyle = rgba(accent, 0.9); c.fillRect(840, gyb - 46, 660, 46);
    S.ground.blit(c, b, 2.8);
    const sg = c.createLinearGradient(0, gyb, 0, gyb + 40 + 80 * sun.k); sg.addColorStop(0, rgba('#000', 0.45)); sg.addColorStop(1, rgba('#000', 0)); c.fillStyle = sg; c.fillRect(-300, gyb, 640, 40 + 80 * sun.k); c.fillRect(840, gyb, 660, 40 + 80 * sun.k);
    if (props.includes('tree')) {
      // canopy shadow pool under the tree (dappled), then the tree
      c.save(); c.translate(930 - 120 * sun.k, gyb + 60); c.scale(1, 0.26); const g = c.createRadialGradient(0, 0, 0, 0, 0, 420); g.addColorStop(0, rgba('#000', 0.6)); g.addColorStop(0.7, rgba('#000', 0.4)); g.addColorStop(1, rgba('#000', 0)); c.fillStyle = g; c.fillRect(-420, -420, 840, 840); c.restore();
      tree(c, 930, gyb, 760, pal, { seed, leaf: night ? '#0f1c14' : '#4b7a3b', lit: night ? '#26402f' : '#b4d86a' });
    }
  } });
  if (props.includes('well')) layers.push({ id: 'well', depth: 2.1, kind: 'lit', draw: (c, b, occ, t) => {
    const gyb = gy(2.1), cx = 300, wy = gyb + 16, rx = 150, ry = 52, hgt = 86;
    if (occ) { S.ground.blit(c, b, 2.1, true); c.fillStyle = '#000'; c.fillRect(cx - rx, wy - hgt - 250, rx * 2, hgt + 250); return; }
    S.ground.blit(c, b, 2.1);
    // ground shadow (short at noon, long otherwise)
    c.save(); c.fillStyle = rgba('#000', 0.5); c.translate(cx + 30 - 150 * sun.k, wy + 20); c.scale(1, 0.3); c.beginPath(); c.ellipse(0, 0, rx * 1.1 + 40 * sun.k, rx * 0.9, 0, 0, TAU); c.fill(); c.restore();
    // parapet cylinder: brick wall, lit rim, dark water inside
    const body = new Path2D(); body.moveTo(cx - rx, wy - hgt); body.lineTo(cx - rx, wy); body.ellipse(cx, wy, rx, ry, 0, Math.PI, 0, true); body.lineTo(cx + rx, wy - hgt); body.closePath();
    const bg = c.createLinearGradient(cx - rx, 0, cx + rx, 0); bg.addColorStop(0, shade(pal.wall, 0.04)); bg.addColorStop(0.45, pal.wall2); bg.addColorStop(1, shade(pal.wall2, -0.55)); c.fillStyle = bg; c.fill(body);
    c.save(); c.clip(body); cin.fillTexture(c, 'brick', [cx - rx, wy - hgt - 10, rx * 2, hgt + ry + 20], { alpha: 0.5, scale: 0.9, ox: cx - rx, oy: wy - hgt, seed: seed + 8 }); stains(c, [cx - rx, wy - hgt, rx * 2, hgt + ry], seed + 9, { n: 8, color: '#2a2418', a: 0.25 }); c.restore();
    c.fillStyle = shade(pal.wall, 0.12); c.beginPath(); c.ellipse(cx, wy - hgt, rx, ry, 0, 0, TAU); c.fill();
    c.fillStyle = '#050505'; c.beginPath(); c.ellipse(cx, wy - hgt + 2, rx - 22, ry - 12, 0, 0, TAU); c.fill();
    const wg = c.createRadialGradient(cx, wy - hgt - 4, 4, cx, wy - hgt + 4, rx - 20); wg.addColorStop(0, rgba('#6a7d8a', 0.25)); wg.addColorStop(1, rgba('#000', 0)); c.fillStyle = wg; c.beginPath(); c.ellipse(cx, wy - hgt + 2, rx - 22, ry - 12, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba('#fff', 0.55); c.lineWidth = 3; c.beginPath(); c.ellipse(cx, wy - hgt, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.7); c.stroke();
    // wooden frame + pulley + rope
    c.strokeStyle = '#3b2a1c'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - rx + 20, wy - hgt + 6); c.lineTo(cx - rx + 20, wy - hgt - 230); c.moveTo(cx + rx - 20, wy - hgt + 6); c.lineTo(cx + rx - 20, wy - hgt - 230); c.moveTo(cx - rx + 8, wy - hgt - 226); c.lineTo(cx + rx - 8, wy - hgt - 226); c.stroke();
    c.strokeStyle = rgba('#fff', 0.2); c.lineWidth = 4; c.beginPath(); c.moveTo(cx - rx + 14, wy - hgt - 10); c.lineTo(cx - rx + 14, wy - hgt - 224); c.stroke();
    c.fillStyle = '#1d1712'; c.beginPath(); c.arc(cx, wy - hgt - 226, 24, 0, TAU); c.fill(); c.strokeStyle = '#6a5a48'; c.lineWidth = 4; c.stroke();
    c.strokeStyle = '#6b5a3a'; c.lineWidth = 5; c.beginPath(); c.moveTo(cx - 22, wy - hgt - 226); c.lineTo(cx - 22, wy - hgt - 40); c.stroke(); c.fillStyle = '#4a4a50'; c.fillRect(cx - 36, wy - hgt - 40, 28, 30);
    // rope fence: posts + sagging rope in front
    for (const sx of [-1, 1]) { c.fillStyle = '#3b2a1c'; c.fillRect(cx + sx * (rx + 70) - 7, wy + 30 - 110, 14, 130); }
    c.strokeStyle = '#b5a07a'; c.lineWidth = 5; c.beginPath(); c.moveTo(cx - rx - 70, wy + 30 - 96); c.quadraticCurveTo(cx, wy + 30 - 40, cx + rx + 70, wy + 30 - 96); c.stroke();
  } });
  layers.push({ id: 'near-ground', depth: 1.5, kind: 'lit', draw: (c, b, occ) => {
    S.ground.blit(c, b, 1.5);
    if (occ) return;
    // chalk arc and a few hand-scuffs on the concrete
    c.save(); c.strokeStyle = rgba('#fff', 0.35); c.lineWidth = 6; c.lineCap = 'round'; c.setLineDash([26, 14]); c.beginPath(); c.ellipse(540, gy(1.5) + 560, 470, 170, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); c.restore();
  } });
  // foreground: a neem branch, sunlit leaves, blurred (never a flat box)
  layers.push({ id: 'fg-branch', depth: 0.62, kind: 'fg', blur: 7, draw: (c, b) => {
    c.strokeStyle = '#1c150f'; c.lineCap = 'round'; c.lineWidth = 30; c.beginPath(); c.moveTo(1240, -40); c.bezierCurveTo(1000, 40, 820, 120, 640, 90); c.stroke(); c.lineWidth = 16; c.beginPath(); c.moveTo(940, 60); c.quadraticCurveTo(840, 200, 760, 250); c.stroke();
    foliage(c, 930, 130, 300, 130, pal, { seed: seed + 21, n: 40, leaf: night ? '#0c1812' : '#3d6a30', lit: night ? '#1d3226' : '#b5d96a', dark: '#0a1409', size: 1.5 });
    const g = c.createLinearGradient(0, -40, 0, 420); g.addColorStop(0, rgba('#000', 0.35)); g.addColorStop(1, rgba('#000', 0)); c.fillStyle = g; c.fillRect(0, -40, DW, 460);
  } });
  layers.push({ id: 'fg-corner', depth: 0.55, kind: 'fg', blur: 9, draw: (c, b) => {
    // out-of-focus verandah pillar at the left edge: lit rim, plaster, never a flat box
    const x = -30, w = 150, g = c.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, shade(pal.wall, -0.6)); g.addColorStop(0.55, shade(pal.wall, -0.2)); g.addColorStop(1, shade(pal.wall, 0.1));
    c.fillStyle = g; c.fillRect(x - w, b.y0, w * 2, b.h); c.save(); c.beginPath(); c.rect(x - w, b.y0, w * 2, b.h); c.clip(); cin.fillTexture(c, 'plaster', [x - w, b.y0, w * 2, b.h], { alpha: 0.5, scale: 1.4, ox: 0, oy: 0, seed: seed + 51 }); c.restore();
    c.fillStyle = rgba('#fff', 0.5); c.fillRect(x + w - 10, b.y0, 10, b.h); c.fillStyle = shade(pal.wall, -0.15); c.fillRect(x - w, 1560, w * 2 + 20, 70); c.fillStyle = rgba(accent, 0.8); c.fillRect(x - w, 1700, w * 2 + 20, 220);
  } });
  const lights = [];
  if (night) {
    lights.push({ id: 'moon', kind: 'moon', type: 'point', x: 800, y: 300, depth: 8, r: 1500, color: '#7f96d8', intensity: 0.45 });
    lights.push({ id: 'lamp', kind: 'lamp', type: 'point', x: 120, y: gy(2.8) - 250, depth: 2.8, r: 640, color: '#ffc27a', intensity: 0.95, flicker: 0.04, seed: seed + 3 });
    lights.push({ id: 'room', kind: 'window', type: 'point', x: 540, y: gy(4.2) - 140, depth: 4.2, r: 520, color: '#d9a050', intensity: 0.5 });
  } else lights.push({ id: 'sun', kind: 'sun', type: 'sun', dir: [0.28, -0.96], color: pal.sun });
  return makeSet({ name: 'schoolCourtyard', seed, tod, palette: pal, wear, vp, groundH, upm: 512, layers, lights, sun, groundY: gy(1.3), params: o, anchors: { subject: { z: 1.3, x: 0 }, well: { x: 300, z: 2.1 }, tree: { x: 930, z: 2.8 } }, gy });
}
