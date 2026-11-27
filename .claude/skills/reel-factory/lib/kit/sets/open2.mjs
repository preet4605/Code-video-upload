// sets/open2: village aangan, street/alley, road at night, temple steps.
import { cin, cl, lerp, mix, shade, rgba, mulberry32, Path2D, smoothClosed, ribbon, stains, streaks, surface, TAU, DW, DH } from '../util.mjs';
import { makeSet, makePalette, quadPath, bbox, aoStrip, edgeLight } from './core.mjs';
import { sky, makeGround, pillar, archPath, barredWindow, foliage, tree, diya } from './parts.mjs';
import { buildTunnel, UPM, jambFg } from './tunnel.mjs';

const opt = (o, k, d) => (o && o[k] !== undefined ? o[k] : d);
const sunOf = (o) => { const k = opt(o, 'shadowK', 0.6); return { dir: [-0.62 * k, 0.55 * k], k }; };

// =================================================================== village house + aangan
export function villageAangan(o = {}) {
  const seed = opt(o, 'seed', 1), tod = opt(o, 'tod', 'noon'), pal = makePalette(opt(o, 'palette', 'mud'), seed, tod), wear = opt(o, 'wear', 0.55), night = tod === 'night' || tod === 'dusk';
  const vp = { x: 540, y: 800 }, groundH = 640, S = { vp, groundH, palette: pal, wear, seed }, gy = (z) => vp.y + groundH / z, sun = sunOf(o);
  S.ground = makeGround(S, { color: mix(pal.floor, '#9a7a56', 0.4), tex: 'plaster', texA: 0.55, wm: 0.8, joints: 'none', wear: 0.7, stain: '#3b2a18' });
  const layers = [];
  layers.push({ id: 'sky', depth: 8, kind: 'back', fullBleed: true, draw: (c, b) => sky(c, b, pal, { seed, sunX: 300, sunY: 140, moon: tod === 'night', horizonY: gy(8) }) });
  layers.push({ id: 'fields', depth: 6, kind: 'lit', draw: (c, b, occ) => {
    const y = gy(6), r = mulberry32(seed + 7);
    if (occ) { c.fillStyle = '#000'; c.fillRect(b.x0, y - 60, b.w, 80); S.ground.blit(c, b, 6, true); return; }
    c.fillStyle = night ? '#0c1410' : mix(pal.sky2, '#7c8f58', 0.6); c.fillRect(b.x0, y - 24, b.w, 40);
    for (const x of [90, 300, 880, 1010]) { c.strokeStyle = night ? '#080d0a' : '#4a5a38'; c.lineWidth = 7; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 8, y - 70, x - 4, y - 150); c.stroke(); for (let k = 0; k < 7; k++) { const a = -2.6 + k * 0.45; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 4, y - 150); c.quadraticCurveTo(x - 4 + Math.cos(a) * 40, y - 150 + Math.sin(a) * 25 - 14, x - 4 + Math.cos(a) * 80, y - 150 + Math.sin(a) * 60); c.stroke(); } }
    S.ground.blit(c, b, 6);
  } });
  layers.push({ id: 'house', depth: 3.6, kind: 'lit', draw: (c, b, occ, t) => {
    const gyb = gy(3.6), top = gyb - 330, x0 = 40, x1 = 1060;
    if (occ) { c.fillStyle = '#000'; c.fillRect(x0 - 200, top - 120, x1 - x0 + 400, gyb - top + 120); S.ground.blit(c, b, 3.6, true); return; }
    const wallC = night ? shade(pal.wall, -0.5) : pal.wall;
    surface(c, quadPath([[x0, top], [x1, top], [x1, gyb], [x0, gyb]]), [x0, top, x1, gyb], { color: wallC, tex: 'plaster', texA: 0.5, scale: 1.0, seed: seed + 2, wear: wear * 0.9, stain: '#2a1a0c' });
    // plinth + dung-cake circles on the wall
    c.fillStyle = shade(wallC, -0.25); c.fillRect(x0, gyb - 46, x1 - x0, 46); c.fillStyle = rgba('#000', 0.3); c.fillRect(x0, gyb - 6, x1 - x0, 6);
    const r = mulberry32(seed + 31); for (let i = 0; i < 14; i++) { const cx = 780 + (i % 5) * 50, cy = top + 120 + Math.floor(i / 5) * 46; c.fillStyle = shade(wallC, -0.3 - r() * 0.1); c.beginPath(); c.ellipse(cx, cy, 22, 18, 0, 0, TAU); c.fill(); c.fillStyle = rgba('#fff', 0.1); c.beginPath(); c.ellipse(cx - 5, cy - 5, 10, 6, 0, 0, TAU); c.fill(); }
    // clay-tile roof: overhang with a hard shadow under it
    const roofY = top - 6; c.fillStyle = night ? '#2c1710' : '#9a4a2c'; c.beginPath(); c.moveTo(x0 - 130, roofY + 40); c.lineTo(x0 + 70, roofY - 130); c.lineTo(x1 - 70, roofY - 130); c.lineTo(x1 + 130, roofY + 40); c.closePath(); c.fill();
    c.save(); c.clip(); c.strokeStyle = rgba('#000', 0.3); c.lineWidth = 3; for (let y = roofY - 120; y < roofY + 40; y += 14) { c.beginPath(); c.moveTo(x0 - 130, y); c.lineTo(x1 + 130, y); c.stroke(); } for (let x = x0 - 120; x < x1 + 130; x += 22) { c.beginPath(); c.moveTo(x, roofY - 130); c.lineTo(x - (x - 540) * 0.1, roofY + 40); c.stroke(); } c.restore();
    c.fillStyle = shade('#9a4a2c', -0.3); c.fillRect(x0 - 130, roofY + 36, x1 - x0 + 260, 14);
    const eg = c.createLinearGradient(0, roofY + 40, 0, roofY + 200); eg.addColorStop(0, rgba('#000', 0.75)); eg.addColorStop(1, rgba('#000', 0)); c.fillStyle = eg; c.fillRect(x0, roofY + 50, x1 - x0, 150);
    // verandah (osara) on the left: wooden posts and deep shade, a door at the back
    const vx0 = x0 + 20, vx1 = 600; c.fillStyle = '#0c0805'; c.fillRect(vx0, top + 40, vx1 - vx0, gyb - top - 40 - 46);
    c.fillStyle = '#2a1c10'; c.fillRect(vx0 + 120, top + 120, 110, gyb - top - 120 - 46); c.fillStyle = '#080503'; c.fillRect(vx0 + 130, top + 130, 90, gyb - top - 130 - 46);
    for (const px of [vx0, vx0 + 190, vx1 - 30]) { c.fillStyle = shade(pal.wood, night ? -0.3 : -0.1); c.fillRect(px - 15, top + 30, 30, gyb - top - 30 - 46); c.fillStyle = rgba('#fff', 0.22); c.fillRect(px - 15, top + 30, 5, gyb - top - 30 - 46); c.fillStyle = rgba('#000', 0.35); c.fillRect(px + 8, top + 30, 7, gyb - top - 30 - 46); }
    c.fillStyle = shade(pal.wood, -0.2); c.fillRect(vx0 - 20, top + 24, vx1 - vx0 + 60, 26);
    // window with a wooden shutter on the right + a lit one at dusk
    barredWindow(c, 660, top + 90, 90, 120, pal, { inner: night ? '#c8903a' : '#0a0807', glow: night ? '#e2a850' : null, bars: 3, frame: shade(pal.wood, -0.1) });
    S.ground.blit(c, b, 3.6);
    const sg = c.createLinearGradient(0, gyb, 0, gyb + 30 + 60 * sun.k); sg.addColorStop(0, rgba('#000', 0.45)); sg.addColorStop(1, rgba('#000', 0)); c.fillStyle = sg; c.fillRect(b.x0, gyb, b.w, 30 + 60 * sun.k);
  } });
  layers.push({ id: 'wall-tree', depth: 2.6, kind: 'lit', draw: (c, b, occ) => {
    const gyb = gy(2.6), wt = gyb - 190;
    if (occ) { c.fillStyle = '#000'; c.fillRect(840, wt, 600, 190); c.fillRect(-300, wt, 360, 190); tree(c, 150, gyb, 560, pal, { seed, occ: true, spread: 0.8 }); return; }
    const wallC = night ? shade(pal.wall2, -0.5) : pal.wall2;
    surface(c, quadPath([[840, wt], [1500, wt], [1500, gyb], [840, gyb]]), [840, wt, 1500, gyb], { color: wallC, tex: 'plaster', texA: 0.5, scale: 1.0, seed: seed + 5, wear, stain: '#2a1a0c' });
    surface(c, quadPath([[-300, wt], [60, wt], [60, gyb], [-300, gyb]]), [-300, wt, 60, gyb], { color: wallC, tex: 'plaster', texA: 0.5, scale: 1.0, seed: seed + 6, wear, stain: '#2a1a0c' });
    S.ground.blit(c, b, 2.6);
    c.fillStyle = shade(wallC, -0.15); c.fillRect(840, wt - 12, 660, 16);
    c.save(); c.translate(150 - 90 * sun.k, gyb + 30); c.scale(1, 0.24); const g = c.createRadialGradient(0, 0, 0, 0, 0, 330); g.addColorStop(0, rgba('#000', 0.55)); g.addColorStop(1, rgba('#000', 0)); c.fillStyle = g; c.fillRect(-330, -330, 660, 660); c.restore();
    tree(c, 150, gyb, 560, pal, { seed: seed + 2, spread: 0.8, leaf: night ? '#101c12' : '#58803f', lit: night ? '#26402c' : '#b9d870' });
  } });
  layers.push({ id: 'tulsi', depth: 2.0, kind: 'lit', draw: (c, b, occ, t) => {
    const gyb = gy(2.0), cx = 700;
    S.ground.blit(c, b, 2.0, occ); if (occ) { c.fillStyle = '#000'; c.fillRect(cx - 90, gyb - 220, 180, 230); return; }
    // tulsi chabutra: a small whitewashed platform with niche and a plant
    c.save(); c.fillStyle = rgba('#000', 0.45); c.translate(cx - 90 * sun.k, gyb + 6); c.scale(1, 0.25); c.beginPath(); c.ellipse(0, 0, 130 + 70 * sun.k, 90, 0, 0, TAU); c.fill(); c.restore();
    const bx0 = cx - 80, bx1 = cx + 80, g = c.createLinearGradient(bx0, 0, bx1, 0); g.addColorStop(0, shade(pal.wall, 0.08)); g.addColorStop(0.6, pal.wall); g.addColorStop(1, shade(pal.wall, -0.45)); c.fillStyle = g; c.fillRect(bx0, gyb - 130, 160, 130); c.fillStyle = shade(pal.wall, 0.12); c.fillRect(bx0 - 12, gyb - 142, 184, 18); c.fillStyle = rgba('#000', 0.3); c.fillRect(bx0 - 12, gyb - 124, 184, 5);
    c.fillStyle = '#0a0705'; c.fillRect(cx - 28, gyb - 100, 56, 60); c.fillStyle = shade(pal.accent, 0); c.fillRect(bx0, gyb - 20, 160, 20);
    foliage(c, cx, gyb - 190, 70, 56, pal, { seed: seed + 9, n: 26, leaf: '#3c6a2e', lit: '#9ccb55', dark: '#14240e', size: 0.6 });
    diya(c, cx, gyb - 74, 0.55, t, { flame: night, seed });
  } });
  layers.push({ id: 'charpai', depth: 1.6, kind: 'lit', draw: (c, b, occ, t) => {
    const gyb = gy(1.6), x0 = 120, x1 = 460, y = gyb - 120;
    S.ground.blit(c, b, 1.6, occ); if (occ) { c.fillStyle = '#000'; c.fillRect(x0, y - 20, x1 - x0, 150); return; }
    c.save(); c.fillStyle = rgba('#000', 0.45); c.translate(0, 0); c.beginPath(); c.moveTo(x0 + 10, gyb + 4); c.lineTo(x1 + 10, gyb + 4); c.lineTo(x1 - 150 * sun.k, gyb + 60 + 40 * sun.k); c.lineTo(x0 - 150 * sun.k, gyb + 60 + 40 * sun.k); c.closePath(); c.fill(); c.restore();
    // charpai: frame, woven rope top (diagonal weave), four tapered legs
    c.fillStyle = shade(pal.wood, -0.1); for (const lx of [x0 + 10, x1 - 28]) { c.fillRect(lx, y + 14, 18, 106); }
    const top = [[x0, y], [x1, y], [x1 + 30, y + 34], [x0 - 30, y + 34]]; c.fillStyle = shade(pal.wood, 0.0); c.fill(quadPath(top)); c.save(); c.clip(quadPath(top)); c.strokeStyle = '#b79c6a'; c.lineWidth = 3; for (let i = -10; i < 30; i++) { c.beginPath(); c.moveTo(x0 - 30 + i * 18, y); c.lineTo(x0 - 30 + i * 18 + 60, y + 34); c.stroke(); c.beginPath(); c.moveTo(x0 - 30 + i * 18 + 60, y); c.lineTo(x0 - 30 + i * 18, y + 34); c.stroke(); } c.restore(); c.strokeStyle = shade(pal.wood, -0.35); c.lineWidth = 8; c.stroke(quadPath(top));
    c.fillStyle = shade(pal.wood, -0.3); c.fillRect(x0 - 30, y + 30, x1 - x0 + 60, 14); for (const lx of [x0 - 22, x1 + 14]) c.fillRect(lx, y + 36, 16, 84);
    // folded blanket
    c.fillStyle = pal.accent; c.beginPath(); c.roundRect(x0 + 40, y - 26, 150, 32, 10); c.fill(); c.fillStyle = rgba('#000', 0.25); c.fillRect(x0 + 44, y - 4, 142, 8);
  } });
  layers.push({ id: 'fg-matka', depth: 0.6, kind: 'fg', blur: 8, draw: (c, b) => {
    // out-of-focus earthen pot at the bottom right with a bright rim, and a hanging rope
    const x = 940, y = 1900, g = c.createRadialGradient(x - 60, y - 220, 20, x, y - 100, 260); g.addColorStop(0, '#c97a45'); g.addColorStop(0.6, '#7a3a1c'); g.addColorStop(1, '#1d0d06'); c.fillStyle = g; c.beginPath(); c.ellipse(x, y - 130, 200, 230, 0, 0, TAU); c.fill(); c.fillStyle = '#2a1209'; c.beginPath(); c.ellipse(x, y - 330, 110, 28, 0, 0, TAU); c.fill(); c.strokeStyle = rgba('#fff', 0.3); c.lineWidth = 6; c.beginPath(); c.ellipse(x, y - 330, 110, 28, 0, Math.PI * 1.1, Math.PI * 1.8); c.stroke();
    c.strokeStyle = '#2a1c10'; c.lineWidth = 8; c.beginPath(); c.moveTo(-20, 220); c.quadraticCurveTo(300, 360, 700, 180); c.stroke();
    for (let i = 0; i < 4; i++) { c.fillStyle = ['#d8d0c0', '#8c2b3f', '#2f6b86', '#d9a441'][i]; c.beginPath(); c.moveTo(120 + i * 150, 270 + Math.sin(i) * 20); c.lineTo(200 + i * 150, 270 + Math.sin(i) * 20); c.lineTo(190 + i * 150, 470); c.lineTo(110 + i * 150, 470); c.closePath(); c.fill(); }
  } });
  const lights = night ? [{ id: 'lantern', kind: 'lamp', type: 'point', x: 640, y: gy(2.0) - 130, depth: 1, r: 620, color: '#ffbb6a', intensity: 1.0, flicker: 0.06, seed: 3 }, { id: 'room', kind: 'lamp', type: 'point', x: 705, y: gy(3.6) - 200, depth: 1, r: 420, color: '#d9a050', intensity: 0.6 }, { id: 'sky', kind: 'moon', type: 'point', x: 300, y: 200, depth: 1, r: 1500, color: tod === 'dusk' ? '#ff9a68' : '#7f96d8', intensity: 0.42 }] : [{ id: 'sun', kind: 'sun', type: 'sun', dir: [0.3, -0.95], color: pal.sun }];
  return makeSet({ name: 'villageAangan', seed, tod, palette: pal, wear, vp, groundH, upm: UPM, layers, lights, sun, groundY: gy(1.4), params: o, gy, ambient: tod === 'dusk' ? '#2a1d2e' : undefined, forceMask: night });
}

// =================================================================== street / alley
export function street(o = {}) {
  const variant = opt(o, 'variant', 'wet'), tod = opt(o, 'tod', 'night');
  const def = {
    name: 'street', tod, palette: opt(o, 'palette', variant === 'wet' ? 'grey' : 'ochre'), W0: (variant === 'wet' ? 1.45 : 1.15) * UPM, Hc: 3200, Hf: 665, zEnd: 11, n: 6, z0: 1.0, vpY: 860, wear: opt(o, 'wear', 0.65),
    style: { openTop: true, left: variant === 'wet' ? 'brick' : 'plain', right: variant === 'wet' ? 'plain' : 'brick', dado: null, tile: 1.0, floor: variant === 'wet' ? '#2a2c32' : '#6b5a44', fog: 0.9, wallColor: {} },
    end(c, G, S, st, t) { const { P, Hf } = G, zE = G.zEnd, a = P(-1.3 * UPM, Hf - 8 * UPM, zE), b = P(1.3 * UPM, Hf, zE); c.fillStyle = S.palette.tod === 'night' ? '#0a0e18' : shade(S.palette.wall, -0.3); c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); const g = c.createRadialGradient(540, G.vp.y + 20, 0, 540, G.vp.y + 20, 220); g.addColorStop(0, rgba(S.palette.tod === 'night' ? '#ffc27a' : '#ffffff', 0.7)); g.addColorStop(1, rgba('#ffc27a', 0)); c.fillStyle = g; c.fillRect(300, G.vp.y - 200, 480, 420); },
    items({ G, S, r, pal }) {
      const { P, W0, Hf } = G, items = [];
      // shopfronts with shutters on the left, lit windows with curtains above on both sides
      [2.2, 3.9, 5.9, 8.2].forEach((z, i) => items.push({ id: `shop${i}`, type: 'shop', z, draw(c, G2, S2) {
        const X = -W0 + 2, w = 0.9, za = z - w / 2, zb = z + w / 2, h = 2.2 * UPM, q = [P(X, Hf, za), P(X, Hf, zb), P(X, Hf - h, zb), P(X, Hf - h, za)], night = S2.palette.tod === 'night';
        c.fillStyle = shade(['#2f6b86', '#8c2b3f', '#3e7a4d', '#b3612c'][(i + S2.seed) % 4], night ? -0.35 : -0.05); c.fill(quadPath(q)); c.save(); c.clip(quadPath(q)); c.strokeStyle = rgba('#000', 0.4); c.lineWidth = Math.max(1.5, 4 / z); for (let k = 1; k < 14; k++) { const y = Hf - (h * k) / 14, a = P(X, y, za), b = P(X, y, zb); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); } c.restore();
        const sign = [P(X, Hf - h - 0.1 * UPM, za - 0.1), P(X, Hf - h - 0.1 * UPM, zb + 0.1), P(X, Hf - h - 0.5 * UPM, zb + 0.1), P(X, Hf - h - 0.5 * UPM, za - 0.1)]; c.fillStyle = night ? '#d9c070' : '#e8d28a'; c.fill(quadPath(sign)); c.strokeStyle = '#2a1c10'; c.lineWidth = 3; c.stroke(quadPath(sign));
        if (night) { c.save(); c.globalCompositeOperation = 'screen'; const m = P(X, Hf - h - 0.3 * UPM, z), gg = c.createRadialGradient(m[0], m[1], 0, m[0], m[1], 180 / z); gg.addColorStop(0, rgba('#ffd27a', 0.5)); gg.addColorStop(1, rgba('#ffd27a', 0)); c.fillStyle = gg; c.fillRect(m[0] - 200, m[1] - 200, 400, 400); c.restore(); }
      } }));
      [2.9, 5.0, 7.4].forEach((z, i) => items.push({ type: 'window', side: 1, z, w: 0.9, h: 1.2, sill: 2.0 + (i % 2) * 0.3, moon: false, curtain: i === 1 ? '#8c2b3f' : null }));
      [3.6, 6.4].forEach((z, i) => items.push({ type: 'window', side: -1, z, w: 0.85, h: 1.1, sill: 3.1, moon: false }));
      // overhead wires crossing the street
      [2.6, 4.6, 7.2].forEach((z, i) => items.push({ id: `wire${i}`, type: 'wire', z, dz: -0.2, draw(c, G2) { const a = P(-W0, -1.4 * UPM + i * 40, z), b = P(W0, -1.2 * UPM + i * 30, z), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 60 / z]; c.strokeStyle = rgba('#050505', 0.9); c.lineWidth = Math.max(1.5, 4 / z); c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(m[0], m[1] + 40 / z, b[0], b[1]); c.stroke(); } }));
      // wall lamp on the right
      items.push({ id: 'walllamp', type: 'wlamp', z: 3.4, dz: 0.2, draw(c, G2, S2, t) { const p = P(W0 - 6, Hf - 2.6 * UPM, 3.4), s = Math.max(10, 70 / 3.4); c.fillStyle = '#1a1a18'; c.fillRect(p[0] - s * 0.9, p[1] - s * 0.4, s * 0.9, s * 0.25); c.fillStyle = '#2a2a28'; c.beginPath(); c.moveTo(p[0] - s * 1.3, p[1] - s * 0.1); c.lineTo(p[0] - s * 0.3, p[1] - s * 0.1); c.lineTo(p[0] - s * 0.5, p[1] + s * 0.3); c.lineTo(p[0] - s * 1.1, p[1] + s * 0.3); c.closePath(); c.fill(); c.fillStyle = '#fff2c0'; c.fillRect(p[0] - s * 1.0, p[1] + s * 0.25, s * 0.4, s * 0.1); } });
      // puddles with reflected light (wet variant) + bin
      if (variant === 'wet') [[-0.4, 2.6, 0.9], [0.5, 4.2, 1.2], [-0.6, 6.5, 1.3]].forEach(([X, z, w], i) => items.push({ id: `puddle${i}`, type: 'puddle', z, dz: 0.3, draw(c, G2) { const a = P((X - w / 2) * UPM, Hf, z - 0.5), b = P((X + w / 2) * UPM, Hf, z + 0.5), cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2; c.save(); c.translate(cx, cy); c.scale(1, 0.14 + 0.1 * (2 / z)); const g = c.createRadialGradient(0, 0, 0, 0, 0, Math.abs(b[0] - a[0]) * 0.6); g.addColorStop(0, rgba('#ffd9a0', 0.55)); g.addColorStop(0.6, rgba('#8aa0c8', 0.35)); g.addColorStop(1, rgba('#8aa0c8', 0)); c.fillStyle = g; c.beginPath(); c.arc(0, 0, Math.abs(b[0] - a[0]) * 0.6, 0, TAU); c.fill(); c.restore(); c.fillStyle = rgba('#ffd9a0', 0.4); c.fillRect(cx - 8 / z, cy - 6, 16 / z, 90 / z); } }));
      items.push({ id: 'bin', type: 'bin', z: 3.0, dz: 0.2, draw(c, G2, S2) { const p = P(-W0 + 0.35 * UPM, Hf, 3.0), w = 0.4 * UPM / 3, h = 0.8 * UPM / 3; const g = c.createLinearGradient(p[0] - w, 0, p[0] + w, 0); g.addColorStop(0, '#3e5a46'); g.addColorStop(1, '#0c140e'); c.fillStyle = g; c.fillRect(p[0] - w, p[1] - h, w * 2, h); c.fillStyle = '#17241b'; c.fillRect(p[0] - w * 1.1, p[1] - h - 10, w * 2.2, 14); } });
      return items;
    },
    lights({ G, S }) { const { P, W0, Hf } = G, p = P(W0 - 6, Hf - 2.6 * UPM, 3.4); const out = [{ id: 'lamp', kind: 'lamp', type: 'point', x: p[0] - 60, y: p[1] + 40, depth: 1, r: 640, color: '#ffc27a', intensity: 1.0, flicker: 0.06, seed: 6 }]; if (S.palette.tod === 'night') out.push({ id: 'moon', kind: 'moon', type: 'point', x: 540, y: 80, depth: 1, r: 1400, color: '#6f86d0', intensity: 0.35 }); else out.push({ id: 'sun', kind: 'sun', type: 'sun', dir: [0.6, -0.8], color: '#ffe9c0' }); return out; },
    foreground({ pal, S }) { return [{ id: 'fg-pole', depth: 0.58, blur: 9, draw(c, b) { const x = 40, w = 70, g = c.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, '#2a2c30'); g.addColorStop(0.6, '#0e0f12'); g.addColorStop(1, '#050506'); c.fillStyle = g; c.fillRect(x - w, b.y0, w * 2, b.h); c.fillStyle = rgba('#fff', 0.3); c.fillRect(x - w, b.y0, 4, b.h); c.strokeStyle = '#0a0a0a'; c.lineWidth = 14; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + w, 300 + i * 60); c.bezierCurveTo(400, 340 + i * 60, 700, 220 + i * 50, 1160, 400 + i * 70); c.stroke(); } } }]; },
  };
  return buildTunnel(o, def);
}

// =================================================================== road / highway at night
export function roadNight(o = {}) {
  const seed = opt(o, 'seed', 1), variant = opt(o, 'variant', 'highway'), tod = opt(o, 'tod', 'night'), pal = makePalette(opt(o, 'palette', 'grey'), seed, tod), wear = opt(o, 'wear', 0.45);
  const vp = { x: opt(o, 'vpX', 540), y: 820 }, groundH = 640, S = { vp, groundH, palette: pal, wear, seed }, gy = (z) => vp.y + groundH / z, wet = variant === 'rain';
  const laneW = 3.4;
  S.ground = makeGround(S, { color: wet ? '#14161c' : '#25272c', tex: 'stone', texA: 0.22, wm: 1.4, joints: 'none', wear: 0.35, stain: '#050505', fade: pal.sky1, fadeA: 0.5, id: variant,
    decor(c, W) {
      const { vp: v, groundH: gh, upm } = W, sc = (Xm, Zm) => W.toScreen(Xm, Zm), line = (X0m, X1m, z0, z1, col, a) => { const q = [sc(X0m, z0), sc(X1m, z0), sc(X1m, z1), sc(X0m, z1)]; c.fillStyle = rgba(col, a); c.beginPath(); c.moveTo(...q[0]); for (const p of q.slice(1)) c.lineTo(...p); c.closePath(); c.fill(); };
      for (let z = 0.5; z < 40; z += 3) line(-0.06, 0.06, z, z + 1.6, '#e8e0c0', 0.85);        // dashed centre line
      line(-laneW - 0.07, -laneW + 0.07, 0.5, 40, '#e8e0c0', 0.8); line(laneW - 0.07, laneW + 0.07, 0.5, 40, '#e8e0c0', 0.8);                // edge lines
      line(laneW + 0.2, laneW + 6, 0.5, 40, '#3a3a34', 0.7); line(-laneW - 6, -laneW - 0.2, 0.5, 40, '#3a3a34', 0.7);                      // gravel shoulders
      if (wet) { c.globalCompositeOperation = 'screen'; for (const [X, col] of [[1.2, '#ffb25a'], [-1.4, '#ff3a2a'], [0.0, '#cfe0ff']]) { const a = sc(X - 0.5, 1.2), b = sc(X + 0.5, 30); const g = c.createLinearGradient(0, a[1], 0, v.y + 4); g.addColorStop(0, rgba(col, 0.5)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.beginPath(); c.moveTo(a[0] - 40, a[1] + 700); c.lineTo(a[0] + 40, a[1] + 700); c.lineTo(b[0] + 6, b[1]); c.lineTo(b[0] - 6, b[1]); c.closePath(); c.fill(); } c.globalCompositeOperation = 'source-over'; }
    } });
  const layers = [], lamps = [], zl = [2.4, 5.6, 10.0, 17.0];
  layers.push({ id: 'sky', depth: 9, kind: 'back', fullBleed: true, draw: (c, b) => { sky(c, b, pal, { seed, sunX: 800, sunY: 220, moon: !wet, horizonY: vp.y, clouds: 0.2 }); const g = c.createRadialGradient(540, vp.y, 0, 540, vp.y, 520); g.addColorStop(0, rgba('#ffa860', wet ? 0.5 : 0.35)); g.addColorStop(1, rgba('#ffa860', 0)); c.fillStyle = g; c.fillRect(0, vp.y - 520, DW, 700); } });
  layers.push({ id: 'treeline', depth: 7, kind: 'lit', draw: (c, b, occ) => {
    const y = gy(7), r = mulberry32(seed + 3); c.fillStyle = occ ? '#000' : '#05080a';
    for (let x = b.x0 - 40; x < b.x1 + 40;) { const w = 40 + r() * 80, h = 20 + r() * 70; c.beginPath(); c.ellipse(x + w / 2, y, w * 0.7, h, 0, Math.PI, 0); c.fill(); x += w * 0.8; }
    if (!occ) { c.fillStyle = 'rgba(255,196,120,0.8)'; for (const [x, yy] of [[130, -30], [330, -14], [780, -26], [940, -12]]) c.fillRect(x, y + yy, 6, 5); }
    S.ground.blit(c, b, 7, occ);
  } });
  // lamp posts, guard rails and reflector posts each on their own depth
  for (const z of zl) {
    const px = 3.9 + 0.0;
    layers.push({ id: `lamp${z}`, depth: z, kind: 'lit', draw: (c, b, occ, t) => {
      const base = [vp.x + (px * UPM) / z, gy(z)], top = [base[0], base[1] - (7.5 * UPM) / z], w = 0.16 * UPM / z, arm = (2.2 * UPM) / z;
      c.strokeStyle = occ ? '#000' : '#08090b'; c.lineCap = 'round'; c.lineWidth = Math.max(2, w); c.beginPath(); c.moveTo(base[0], base[1]); c.lineTo(top[0], top[1]); c.stroke(); c.lineWidth = Math.max(1.5, w * 0.7); c.beginPath(); c.moveTo(top[0], top[1]); c.quadraticCurveTo(top[0] - arm * 0.3, top[1] - arm * 0.2, top[0] - arm, top[1] + arm * 0.05); c.stroke();
      c.fillStyle = occ ? '#000' : '#14151a'; c.fillRect(top[0] - arm - w * 1.4, top[1] + arm * 0.02, w * 2.2, w * 0.8);
      if (!occ) { c.fillStyle = '#fff1c0'; c.fillRect(top[0] - arm - w * 1.1, top[1] + arm * 0.02 + w * 0.7, w * 1.6, w * 0.3); }
    } });
    lamps.push({ id: `lamp${z}`, kind: 'lamp', type: 'point', x: vp.x + (px * UPM) / z - (2.2 * UPM) / z, y: gy(z) - (7.4 * UPM) / z + 30, depth: 1, r: Math.max(120, 900 / z), color: '#ffb25a', intensity: Math.min(1.0, 0.35 + 1.4 / z), flicker: z === zl[1] ? 0.3 : 0.03, seed: z });
  }
  for (const side of [-1, 1]) for (let z = 1.6; z < 20; z += 1.7) layers.push({ id: `post${side}${z.toFixed(1)}`, depth: z, kind: 'lit', draw: (c, b, occ) => {
    const x = vp.x + (side * 4.5 * UPM) / z, y = gy(z), h = (0.9 * UPM) / z, w = (0.08 * UPM) / z; c.fillStyle = occ ? '#000' : '#16171b'; c.fillRect(x - w, y - h, w * 2, h);
    if (!occ) { c.fillStyle = side < 0 ? '#ff3a2a' : '#fff0b0'; c.fillRect(x - w * 0.9, y - h * 0.85, w * 1.8, h * 0.14); }
  } });
  layers.push({ id: 'guard', depth: 1.5, kind: 'lit', draw: (c, b, occ) => {
    S.ground.blit(c, b, 1.5, occ);
    for (const side of [-1, 1]) { const a = [vp.x + (side * 4.5 * UPM) / 0.7, vp.y + (groundH - 0.55 * UPM) / 0.7], bb = [vp.x + (side * 4.5 * UPM) / 30, vp.y + (groundH - 0.55 * UPM) / 30]; c.strokeStyle = occ ? '#000' : '#4a4d54'; c.lineWidth = 16; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(bb[0], bb[1]); c.stroke(); if (!occ) { c.strokeStyle = rgba('#fff', 0.3); c.lineWidth = 4; c.beginPath(); c.moveTo(a[0], a[1] - 6); c.lineTo(bb[0], bb[1] - 1); c.stroke(); } }
  } });
  layers.push({ id: 'fg-bush', depth: 0.6, kind: 'fg', blur: 8, draw: (c, b) => { foliage(c, 80, 1800, 300, 220, pal, { seed: seed + 8, n: 40, leaf: '#0d1a12', lit: '#27402e', dark: '#050a07', size: 1.6 }); foliage(c, 1030, 1880, 250, 160, pal, { seed: seed + 9, n: 30, leaf: '#0d1a12', lit: '#2a4430', dark: '#050a07', size: 1.5 }); } });
  const lights = [...lamps, { id: 'glow', kind: 'city', type: 'point', x: 540, y: vp.y, depth: 1, r: 900, color: '#ffa860', intensity: 0.4 }, { id: 'sky', kind: 'moon', type: 'point', x: 540, y: 120, depth: 1, r: 1600, color: '#6f86d0', intensity: 0.3 }];
  return makeSet({ name: 'roadNight', seed, tod, palette: pal, wear, vp, groundH, upm: UPM, layers, lights, groundY: gy(1.8), params: o, gy, forceMask: true, ambient: '#0a0d16', glow: 0.18 });
}

// =================================================================== temple steps
export function templeSteps(o = {}) {
  const seed = opt(o, 'seed', 1), variant = opt(o, 'variant', 'dusk'), tod = opt(o, 'tod', variant === 'dusk' ? 'dusk' : 'night'), pal = makePalette(opt(o, 'palette', 'cream'), seed, tod), wear = opt(o, 'wear', 0.5);
  const vp = { x: 540, y: 820 }, groundH = 640, S = { vp, groundH, palette: pal, wear, seed }, gy = (z) => vp.y + groundH / z, N = 9, rise = 0.18 * UPM, run = 0.42, z0 = 1.5;
  S.ground = makeGround(S, { color: shade(pal.floor, -0.1), tex: 'stone', texA: 0.5, wm: 0.7, joints: 'slabs', wear: 0.5 });
  const layers = [], lights = [];
  layers.push({ id: 'sky', depth: 10, kind: 'back', fullBleed: true, draw: (c, b) => sky(c, b, pal, { seed, sunX: 540, sunY: 700, moon: tod === 'night', horizonY: vp.y }) });
  layers.push({ id: 'tower', depth: 5.4, kind: 'lit', draw: (c, b, occ) => {
    const gb = gy(5.4) - N * rise / 5.4 * 0, cx = 540, base = gy(5.4) - 160, col = tod === 'night' ? shade(pal.wall, -0.55) : tod === 'dusk' ? mix(pal.wall, '#a05a4a', 0.5) : pal.wall;
    if (occ) { c.fillStyle = '#000'; c.fillRect(cx - 330, base - 700, 660, 860); S.ground.blit(c, b, 5.4, true); return; }
    // shikhara: stacked tiers narrowing upward, doorway glowing
    const tiers = 9; for (let i = 0; i < tiers; i++) { const w = 330 - i * 30, y = base - i * 66, h = 70; c.fillStyle = shade(col, -i * 0.025); c.fillRect(cx - w, y - h, w * 2, h); c.fillStyle = rgba('#000', 0.4); c.fillRect(cx - w, y - 8, w * 2, 8); c.fillStyle = rgba('#fff', 0.2); c.fillRect(cx - w, y - h, w * 2, 4); for (let k = -3; k <= 3; k++) { c.fillStyle = rgba('#000', 0.25); c.fillRect(cx + k * (w / 3.5) - 4, y - h + 10, 8, h - 20); } }
    c.fillStyle = shade(col, -0.1); c.beginPath(); c.ellipse(cx, base - tiers * 66 - 20, 90, 60, 0, Math.PI, 0); c.fill(); c.fillRect(cx - 3, base - tiers * 66 - 120, 6, 70); c.fillStyle = '#d9a441'; c.beginPath(); c.arc(cx, base - tiers * 66 - 128, 10, 0, TAU); c.fill();
    surface(c, quadPath([[cx - 330, base], [cx + 330, base], [cx + 330, base + 160], [cx - 330, base + 160]]), [cx - 330, base, cx + 330, base + 160], { color: col, tex: 'plaster', texA: 0.4, scale: 1, seed: seed + 3, wear, stain: '#1a1008' });
    const dp = archPath(cx - 80, cx + 80, base + 160, base + 10); const dg = c.createLinearGradient(0, base + 10, 0, base + 160); dg.addColorStop(0, '#ffd27a'); dg.addColorStop(1, '#ff8a2a'); c.fillStyle = dg; c.fill(dp); c.strokeStyle = rgba('#2a1408', 0.9); c.lineWidth = 8; c.stroke(dp);
    c.fillStyle = '#080402'; c.beginPath(); c.moveTo(cx - 14, base + 160); c.lineTo(cx - 8, base + 60); c.lineTo(cx + 8, base + 60); c.lineTo(cx + 14, base + 160); c.closePath(); c.fill();
    S.ground.blit(c, b, 5.4);
  } });
  // banyan roots and foliage on the left, parapet on the right
  layers.push({ id: 'banyan', depth: 3.2, kind: 'lit', draw: (c, b, occ) => {
    const gyb = gy(3.2); if (occ) { c.fillStyle = '#000'; c.fillRect(-100, gyb - 700, 300, 700); S.ground.blit(c, b, 3.2, true); return; }
    S.ground.blit(c, b, 3.2);
    tree(c, 70, gyb, 760, pal, { seed: seed + 4, spread: 0.85, trunkW: 90, leaf: tod === 'night' ? '#0e1a12' : '#3f6a35', lit: tod === 'night' ? '#26402c' : '#a9cf62' });
    c.strokeStyle = '#2a1e14'; c.lineWidth = 8; for (let i = 0; i < 7; i++) { const x = 180 + i * 26; c.beginPath(); c.moveTo(x, gyb - 560 + i * 12); c.bezierCurveTo(x + 14, gyb - 400, x - 12, gyb - 220, x + 4, gyb - 20); c.stroke(); }
    c.fillStyle = shade(pal.wall, -0.2); c.fillRect(780, gyb - 120, 400, 124); c.fillStyle = rgba('#fff', 0.2); c.fillRect(780, gyb - 120, 400, 5);
  } });
  for (let i = N - 1; i >= 0; i--) {
    const za = z0 + i * run, zb = za + run, yTop = vp.y + (groundH - (i + 1) * rise) / za, yTop2 = vp.y + (groundH - (i + 1) * rise) / zb;
    layers.push({ id: `step${i}`, depth: za, kind: 'lit', order: 1, draw: (c, b, occ, t) => {
      const W = 2.2 * UPM, Hh = (i + 1) * rise, P3 = (X, Y, z) => [vp.x + X / z, vp.y + (groundH - Y) / z];
      const tread = [P3(-W, Hh, za), P3(W, Hh, za), P3(W, Hh, zb), P3(-W, Hh, zb)], riser = [P3(-W, Hh - rise, za), P3(W, Hh - rise, za), P3(W, Hh, za), P3(-W, Hh, za)];
      if (occ) { c.fillStyle = '#000'; for (const q of [tread, riser]) c.fill(quadPath(q)); return; }
      const night = tod === 'night';
      surface(c, quadPath(tread), bbox(tread), { color: night ? '#3a3730' : shade(pal.floor, 0.08), tex: 'stone', texA: 0.5, scale: 0.8 / za, seed: seed + 20 + i, wear, stain: '#1a1008' });
      surface(c, quadPath(riser), bbox(riser), { color: night ? '#2a2822' : shade(pal.floor, -0.2), tex: 'plaster', texA: 0.5, scale: 0.8 / za, seed: seed + 40 + i, wear, stain: '#1a1008' });
      // red-white kumkum stripe on the riser edge + lit nosing
      c.fillStyle = rgba('#b3241f', 0.7); const k0 = P3(-W, Hh - rise * 0.5, za), k1 = P3(W, Hh - rise * 0.5, za); c.fillRect(k0[0], k0[1] - 3 / za, k1[0] - k0[0], 6 / za);
      edgeLight(c, P3(-W, Hh, za), P3(W, Hh, za), '#fff', Math.max(2, 5 / za), 0.5); aoStrip(c, P3(-W, Hh, zb), P3(W, Hh, zb), [0, -1], 60 / zb, 0.4);
      // diyas on alternating steps
      if (i % 2 === 1) for (const X of [-1.1 * UPM, 1.0 * UPM]) { const p = P3(X, Hh, za + run * 0.5); diya(c, p[0], p[1], Math.max(0.12, 0.42 / za), t, { seed: i + X }); }
      // marigold garland band on the riser
      if (i % 3 === 0) { c.fillStyle = '#f0a020'; for (let k = 0; k < 18; k++) { const p = P3(-W + (k / 17) * 2 * W, Hh - rise * 0.25, za); c.beginPath(); c.arc(p[0], p[1] + Math.sin(k) * 2, Math.max(2, 8 / za), 0, TAU); c.fill(); } }
    } });
  }
  layers.push({ id: 'fg-bells', depth: 0.6, kind: 'fg', blur: 9, draw: (c, b) => {
    c.strokeStyle = '#1a120a'; c.lineWidth = 22; c.beginPath(); c.moveTo(-40, 90); c.lineTo(DW + 40, 130); c.stroke();
    for (const x of [200, 520, 860]) { c.strokeStyle = '#2a1c10'; c.lineWidth = 6; c.beginPath(); c.moveTo(x, 100); c.lineTo(x, 260); c.stroke(); const g = c.createRadialGradient(x - 20, 300, 10, x, 330, 110); g.addColorStop(0, '#f0c25a'); g.addColorStop(0.6, '#a87420'); g.addColorStop(1, '#3a2408'); c.fillStyle = g; c.beginPath(); c.moveTo(x - 90, 400); c.quadraticCurveTo(x - 100, 270, x, 250); c.quadraticCurveTo(x + 100, 270, x + 90, 400); c.closePath(); c.fill(); c.fillStyle = '#1a120a'; c.beginPath(); c.ellipse(x, 400, 90, 14, 0, 0, TAU); c.fill(); }
  } });
  const day = tod === 'dusk';
  lights.push({ id: 'door', kind: 'door', type: 'door', x: 460, y: gy(5.4) - 150, w: 160, h: 150, depth: 5.4, color: '#ffb25a', intensity: 1.0, spill: 700 }, { id: 'sky', kind: day ? 'sun' : 'moon', type: 'point', x: 540, y: 600, depth: 1, r: 1500, color: day ? '#ff9a68' : '#7f96d8', intensity: day ? 0.6 : 0.4 });
  for (let i = 1; i < N; i += 2) { const za = z0 + i * run + run * 0.5, p = [vp.x + (-1.1 * UPM) / za, vp.y + (groundH - (i + 1) * rise) / za - 20]; lights.push({ id: `diya${i}`, kind: 'diya', type: 'point', x: p[0], y: p[1], depth: 1, r: Math.max(110, 330 / za), color: '#ffa840', intensity: 0.8, flicker: 0.12, seed: i }); }
  return makeSet({ name: 'templeSteps', seed, tod, palette: pal, wear, vp, groundH, upm: UPM, layers, lights, groundY: gy(1.3), params: o, gy, forceMask: true, ambient: day ? '#3a2a3e' : '#0b1020', glow: 0.2 });
}
