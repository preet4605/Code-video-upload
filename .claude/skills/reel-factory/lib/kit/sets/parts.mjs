// sets/parts: reusable drawn parts (sky, ground plane, pillars, arches, barred windows, trees, foliage, lamps, diyas).
import { cin, cl, lerp, mix, shade, rgba, tweak, mulberry32, Path2D, smoothClosed, ribbon, stains, streaks, edgeAO, surface, TAU, h01, DW, DH } from '../util.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { quad, quadPath, aoStrip, edgeLight } from './core.mjs';

/** vertical sky gradient + optional sun glare / stars+moon / clouds. */
export function sky(c, b, pal, { seed = 1, sunX = 760, sunY = 120, moon = false, clouds = 0.5, horizonY = 900 } = {}) {
  const g = c.createLinearGradient(0, b.y0, 0, horizonY + 120);
  g.addColorStop(0, pal.sky0); g.addColorStop(0.65, pal.sky1); g.addColorStop(1, pal.sky2);
  c.fillStyle = g; c.fillRect(b.x0, b.y0, b.w, b.h);
  const r = mulberry32(seed * 5 + 1);
  if (pal.tod === 'night') {
    cin.fillTexture(c, 'stars', [b.x0, b.y0, b.w, Math.min(b.h, horizonY - b.y0)], { alpha: 0.85, scale: 1.6, ox: 0, oy: 0, seed: seed + 11, count: 70 });
    if (moon) { const mx = sunX, my = sunY; const gg = c.createRadialGradient(mx, my, 0, mx, my, 260); gg.addColorStop(0, rgba('#cfdcff', 0.55)); gg.addColorStop(1, rgba('#cfdcff', 0)); c.fillStyle = gg; c.fillRect(mx - 260, my - 260, 520, 520); c.fillStyle = '#eef3ff'; c.beginPath(); c.arc(mx, my, 44, 0, TAU); c.fill(); c.fillStyle = rgba('#9fb0d8', 0.4); for (const [dx, dy, rr] of [[-12, -8, 10], [14, 10, 8], [4, -18, 6]]) { c.beginPath(); c.arc(mx + dx, my + dy, rr, 0, TAU); c.fill(); } }
  } else {
    if (clouds > 0) for (let i = 0; i < 7; i++) { const x = r() * 1200 - 60, y = 160 + r() * (horizonY - 360), w = 160 + r() * 340; c.save(); c.translate(x, y); c.scale(1, 0.18); const cg = c.createRadialGradient(0, 0, 0, 0, 0, w); cg.addColorStop(0, rgba('#fff', 0.5 * clouds)); cg.addColorStop(1, rgba('#fff', 0)); c.fillStyle = cg; c.fillRect(-w, -w, w * 2, w * 2); c.restore(); }
    if (pal.tod === 'noon' || pal.tod === 'day' || pal.tod === 'dusk') { const gg = c.createRadialGradient(sunX, sunY, 0, sunX, sunY, 700); gg.addColorStop(0, rgba(pal.sun, pal.tod === 'noon' ? 0.95 : 0.7)); gg.addColorStop(0.25, rgba(pal.sun, 0.35)); gg.addColorStop(1, rgba(pal.sun, 0)); c.fillStyle = gg; c.fillRect(sunX - 700, sunY - 700, 1400, 1400); }
  }
}

const GCACHE = new Map();
/**
 * Perspective ground plane, rendered ONCE into a cached canvas (texture warped per scanline strip so cells shrink with depth,
 * joints converging on the vanishing point, stains/cracks scaled by depth) and blitted by every layer from its own base line.
 * z is in metres of depth (screen y = vp.y + groundH / z; upm px per metre at z = 1).
 * cfg: {color, tex, texA, wm (cell size in metres), joints:'slabs'|'planks'|'none', wear, stain, decor(c, W)}; W = {vp,groundH,upm,toScreen(X,Z)}
 */
export function makeGround(S, cfg = {}) {
  const { vp, groundH, upm = 512, palette: pal, seed } = S;
  const c0 = { color: pal.floor, tex: 'stone', texA: 0.45, wm: 0.6, joints: 'slabs', wear: S.wear ?? 0.4, stain: '#1a140c', fade: pal.sky2, fadeA: pal.tod === 'night' ? 0 : 0.35, ...cfg };
  const key = [seed, vp.y, groundH, c0.color, c0.tex, c0.texA, c0.wm, c0.joints, c0.wear, c0.stain, pal.tod, cfg.id ?? ''].join('|');
  const X0 = -520, X1 = DW + 520, Y0 = Math.floor(vp.y) - 4, Y1 = DH + 560, w = X1 - X0, h = Y1 - Y0;
  const make = () => {
    const canvas = createCanvas(w, h), c = canvas.getContext('2d');
    c.translate(-X0, -Y0);
    c.fillStyle = c0.color; c.fillRect(X0, Y0, w, h);
    const pat = c0.tex ? cin.pattern(c, c0.tex, { seed: seed + 3 }) : null;
    for (let y = Y0 + 1; y < Y1; y += 6) {
      const ym = y + 3, z = groundH / Math.max(2, ym - vp.y), sx = (upm * c0.wm) / (256 * z), sy = (c0.wm * groundH) / (256 * z * z), py = (z * 256) / c0.wm;
      if (!pat) break;
      c.save(); c.beginPath(); c.rect(X0, y, w, 6.6); c.clip(); c.translate(vp.x, ym - py * sy); c.scale(sx, sy);
      c.globalCompositeOperation = 'overlay'; c.globalAlpha = c0.texA; c.fillStyle = pat; c.fillRect((X0 - vp.x) / sx, py - 4 / sy, w / sx, 8 / sy); c.restore();
    }
    // distance fade toward the horizon, darkening toward the camera
    const g = c.createLinearGradient(0, Y0, 0, Y1); g.addColorStop(0, rgba(c0.fade, c0.fadeA)); g.addColorStop(0.35, rgba(c0.fade, 0)); g.addColorStop(1, rgba('#000', 0.18)); c.fillStyle = g; c.fillRect(X0, Y0, w, h);
    // joints
    const jc = rgba(shade(c0.color, -0.62), pal.tod === 'night' ? 0.6 : 0.42), wm = c0.wm, zmin = groundH / (Y1 - vp.y);
    if (c0.joints === 'slabs') {
      c.strokeStyle = jc; c.lineCap = 'butt';
      for (let Xm = -12 * wm * 5; Xm <= 12 * wm * 5; Xm += wm * 2) { const xa = vp.x + (Xm * upm) / zmin; c.lineWidth = 1.6; c.beginPath(); c.moveTo(vp.x + (Xm * upm) / 14, vp.y + groundH / 14); c.lineTo(xa, Y1); c.stroke(); }
      for (let z = zmin; z < 14; z += wm * 2) { const y = vp.y + groundH / z; c.lineWidth = 1 + (y - vp.y) / 380; c.beginPath(); c.moveTo(X0, y); c.lineTo(X1, y); c.stroke(); }
    } else if (c0.joints === 'planks') {
      c.strokeStyle = jc; for (let Xm = -8; Xm <= 8; Xm += wm) { const xa = vp.x + (Xm * upm) / zmin; c.lineWidth = 1.8; c.beginPath(); c.moveTo(vp.x + (Xm * upm) / 14, vp.y + groundH / 14); c.lineTo(xa, Y1); c.stroke(); }
    }
    // stains + cracks, scaled by depth
    const r = mulberry32(seed * 13 + 5), nS = Math.round(10 + c0.wear * 36), nC = Math.round(c0.wear * 26);
    for (let i = 0; i < nS; i++) { const Zm = 0.6 + r() * 12, Xm = (r() - 0.5) * 9, x = vp.x + (Xm * upm) / Zm, y = vp.y + groundH / Zm, rx = (60 + r() * 220) * 1.4 / Zm, ry = rx * Math.min(1, groundH / (Zm * upm)); const gg = c.createRadialGradient(x, y, 0, x, y, rx); gg.addColorStop(0, rgba(c0.stain, 0.12 + c0.wear * 0.2)); gg.addColorStop(1, rgba(c0.stain, 0)); c.save(); c.translate(x, y); c.scale(1, ry / rx); c.translate(-x, -y); c.fillStyle = gg; c.fillRect(x - rx, y - rx, rx * 2, rx * 2); c.restore(); }
    c.strokeStyle = rgba('#000', 0.42); c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 0; i < nC; i++) { let Zm = 0.7 + r() * 10, Xm = (r() - 0.5) * 8; c.beginPath(); c.lineWidth = Math.max(0.8, 2.4 / Zm); let [x, y] = [vp.x + (Xm * upm) / Zm, vp.y + groundH / Zm]; c.moveTo(x, y); for (let k = 0; k < 6; k++) { Xm += (r() - 0.5) * 0.35; Zm += (r() - 0.35) * 0.35; Zm = Math.max(0.45, Zm); c.lineTo(vp.x + (Xm * upm) / Zm, vp.y + groundH / Zm); } c.stroke(); }
    if (c0.decor) c0.decor(c, { vp, groundH, upm, toScreen: (Xm, Zm) => [vp.x + (Xm * upm) / Zm, vp.y + groundH / Zm], r: mulberry32(seed * 29 + 7) });
    return canvas;
  };
  let canvas = null;
  return {
    cfg: c0,
    /** paint the ground from depth z down to the bottom of `b`. occ -> flat black. */
    blit(c, b, z, occ = false) {
      const y0 = vp.y + groundH / z, yb = b.y1 + 4;
      if (yb <= y0) return;
      if (occ) { c.fillStyle = '#000'; c.fillRect(b.x0, y0, b.w, yb - y0); return; }
      if (!canvas) { const hit = GCACHE.get(key); canvas = hit ?? make(); if (!hit) GCACHE.set(key, canvas); }
      c.save(); c.beginPath(); c.rect(b.x0, y0, b.w, yb - y0); c.clip();
      c.fillStyle = c0.color; c.fillRect(b.x0, y0, b.w, yb - y0);
      c.drawImage(canvas, X0, Y0);
      c.restore();
    },
  };
}

/** round pillar with cylinder shading (light from the left unless lightDir given) + capital and base. */
export function pillar(c, x, yTop, yBot, w, pal, { color = pal.wall, lightX = -1, cap = true, shadeA = 0.5 } = {}) {
  const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, shade(color, lightX < 0 ? 0.12 : -0.35 * shadeA)); g.addColorStop(0.4, color); g.addColorStop(0.75, shade(color, -0.3 * shadeA)); g.addColorStop(1, shade(color, lightX < 0 ? -0.5 * shadeA : 0.1));
  c.fillStyle = g; c.fillRect(x - w / 2, yTop, w, yBot - yTop);
  if (cap) {
    c.fillStyle = shade(color, -0.05); c.fillRect(x - w * 0.72, yTop - w * 0.18, w * 1.44, w * 0.3); c.fillRect(x - w * 0.62, yTop + w * 0.12, w * 1.24, w * 0.14);
    c.fillStyle = shade(color, -0.1); c.fillRect(x - w * 0.7, yBot - w * 0.22, w * 1.4, w * 0.22); c.fillRect(x - w * 0.6, yBot - w * 0.42, w * 1.2, w * 0.2);
    c.fillStyle = rgba('#000', 0.28); c.fillRect(x - w * 0.72, yTop + w * 0.12, w * 1.44, w * 0.08);
  }
  c.fillStyle = rgba('#000', 0.1); c.fillRect(x + w * 0.2, yTop, w * 0.3, yBot - yTop);
}
/** arch opening path: rect with a semicircular (or pointed) head. */
export function archPath(x0, x1, yBase, yTop, pointed = false) {
  const p = new Path2D(), w = x1 - x0, r = w / 2, yc = yTop + r;
  p.moveTo(x0, yBase); p.lineTo(x0, yc);
  if (pointed) { p.quadraticCurveTo(x0, yTop + r * 0.25, (x0 + x1) / 2, yTop - r * 0.35); p.quadraticCurveTo(x1, yTop + r * 0.25, x1, yc); } else p.arc((x0 + x1) / 2, yc, r, Math.PI, 0);
  p.lineTo(x1, yBase); p.closePath(); return p;
}
/** barred window: dark opening, frame, vertical bars, sill. */
export function barredWindow(c, x, y, w, h, pal, { inner = '#0d0b0a', bars = 5, frame = pal.trim, glow = null, sill = true } = {}) {
  c.fillStyle = frame; c.fillRect(x - 8, y - 8, w + 16, h + 16);
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, inner); g.addColorStop(1, shade(inner, 0.08)); c.fillStyle = g; c.fillRect(x, y, w, h);
  if (glow) { const gg = c.createLinearGradient(0, y, 0, y + h); gg.addColorStop(0, rgba(glow, 0.9)); gg.addColorStop(1, rgba(glow, 0.55)); c.fillStyle = gg; c.fillRect(x, y, w, h); }
  c.fillStyle = rgba('#000', 0.45); c.fillRect(x, y, w, h * 0.12);
  c.strokeStyle = '#17120e'; c.lineWidth = Math.max(2, w * 0.05);
  for (let i = 1; i <= bars; i++) { const bx = x + (w * i) / (bars + 1); c.beginPath(); c.moveTo(bx, y); c.lineTo(bx, y + h); c.stroke(); }
  c.lineWidth = 3; c.beginPath(); c.moveTo(x, y + h * 0.5); c.lineTo(x + w, y + h * 0.5); c.stroke();
  if (sill) { c.fillStyle = shade(frame, 0.12); c.fillRect(x - 12, y + h + 6, w + 24, 10); c.fillStyle = rgba('#000', 0.3); c.fillRect(x - 12, y + h + 16, w + 24, 12); }
}
/** foliage mass: clusters of leaf blobs, dark core, lit tops (light from `lx`), dappled gaps. */
export function foliage(c, cx, cy, rx, ry, pal, { seed = 5, n = 70, leaf = '#3f6a35', lit = '#9bc45a', dark = '#14260f', lx = -0.4, gaps = 0.0, size = 1 } = {}) {
  const r = mulberry32(seed);
  c.save();
  // base mass
  const pts = []; for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; pts.push([cx + Math.cos(a) * rx * (0.88 + r() * 0.22), cy + Math.sin(a) * ry * (0.88 + r() * 0.22)]); }
  c.fillStyle = mix(dark, leaf, 0.3); c.fill(smoothClosed(pts));
  const bl = [];
  for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()); bl.push([cx + Math.cos(a) * rx * d * 0.95, cy + Math.sin(a) * ry * d * 0.95, (22 + r() * 36) * size, r()]); }
  bl.sort((p, q) => p[1] - q[1]);
  for (const [x, y, s, k] of bl) {
    const up = cl(((cy - y) / ry) * 0.5 + 0.5 + (x - cx) / rx * lx * 0.3), col = mix(mix(dark, leaf, 0.4 + k * 0.4), lit, Math.pow(up, 2.2) * (pal.tod === 'night' ? 0.25 : 0.9));
    c.fillStyle = col; c.beginPath(); c.ellipse(x, y, s, s * 0.62, (k - 0.5) * 1.2, 0, TAU); c.fill();
    c.fillStyle = rgba('#000', 0.25); c.beginPath(); c.ellipse(x + s * 0.15, y + s * 0.3, s * 0.8, s * 0.3, (k - 0.5) * 1.2, 0, TAU); c.fill();
  }
  c.restore();
}
/** neem-like tree: trunk + branches + canopy; returns trunk base x for shadows. */
export function tree(c, x, groundY, h, pal, { seed = 4, spread = 1, trunkW = 54, leaf = '#46703a', lit = '#a9cf62', occ = false } = {}) {
  const r = mulberry32(seed);
  const trunk = ribbon([[x, groundY + 8], [x + 8, groundY - h * 0.25], [x - 6, groundY - h * 0.45], [x + 4, groundY - h * 0.6]], [trunkW * 1.25, trunkW, trunkW * 0.8, trunkW * 0.55], { n: 10, cap: 1 });
  const tp = smoothClosed(trunk);
  if (occ) { c.fillStyle = '#000'; c.fill(tp); foliage(c, x, groundY - h * 0.78, 330 * spread, 190 * spread, pal, { seed, n: 12, leaf: '#000', lit: '#000', dark: '#000', size: 3 }); return; }
  const tg = c.createLinearGradient(x - trunkW, 0, x + trunkW, 0); tg.addColorStop(0, shade('#5a4636', 0.1)); tg.addColorStop(0.5, '#3d2f24'); tg.addColorStop(1, '#1a130e'); c.fillStyle = tg; c.fill(tp);
  c.save(); c.clip(tp); c.strokeStyle = rgba('#000', 0.35); c.lineWidth = 3; for (let i = 0; i < 12; i++) { const bx = x - trunkW * 0.5 + r() * trunkW; c.beginPath(); c.moveTo(bx, groundY); c.bezierCurveTo(bx + 6, groundY - h * 0.2, bx - 6, groundY - h * 0.4, bx + 3, groundY - h * 0.62); c.stroke(); } c.restore();
  c.strokeStyle = '#2a2018'; c.lineCap = 'round';
  for (const [dx, dy, w] of [[-170, -0.7, 22], [170, -0.72, 20], [-60, -0.88, 16], [90, -0.9, 16]]) { c.lineWidth = w; c.beginPath(); c.moveTo(x, groundY - h * 0.5); c.quadraticCurveTo(x + dx * 0.5, groundY - h * 0.62, x + dx * spread, groundY + dy * h * 1.0); c.stroke(); }
  foliage(c, x, groundY - h * 0.78, 330 * spread, 190 * spread, pal, { seed, n: 90, leaf, lit, dark: shade(leaf, -0.7), size: 1.1 });
}
/** warm lamp (bulb + shade + glow drawn emissive by the caller). */
export function diya(c, x, y, s, t, { flame = true, seed = 1 } = {}) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const bowl = new Path2D(); bowl.moveTo(-30, -6); bowl.quadraticCurveTo(-26, 22, 0, 24); bowl.quadraticCurveTo(26, 22, 30, -6); bowl.quadraticCurveTo(0, 6, -30, -6); bowl.closePath();
  const g = c.createLinearGradient(-30, 0, 30, 0); g.addColorStop(0, '#c7733b'); g.addColorStop(0.55, '#8a4624'); g.addColorStop(1, '#3d1c0d'); c.fillStyle = g; c.fill(bowl);
  c.fillStyle = '#ffb25a'; c.beginPath(); c.ellipse(0, -6, 28, 6, 0, 0, TAU); c.fill(); c.fillStyle = '#4b2711'; c.beginPath(); c.ellipse(0, -5, 20, 3.5, 0, 0, TAU); c.fill();
  if (flame) {
    const fl = 1 + 0.12 * Math.sin(t * 11 + seed * 3) + 0.06 * Math.sin(t * 23 + seed);
    const gg = c.createRadialGradient(0, -34, 0, 0, -34, 70 * fl); gg.addColorStop(0, rgba('#fff0c0', 0.8)); gg.addColorStop(0.3, rgba('#ffa83a', 0.35)); gg.addColorStop(1, rgba('#ff7a20', 0)); c.globalCompositeOperation = 'screen'; c.fillStyle = gg; c.fillRect(-80, -120, 160, 160); c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#ffb347'; c.beginPath(); c.moveTo(-9, -7); c.quadraticCurveTo(-12, -30 * fl, 0, -52 * fl); c.quadraticCurveTo(12, -30 * fl, 9, -7); c.closePath(); c.fill();
    c.fillStyle = '#fff4cc'; c.beginPath(); c.moveTo(-4, -7); c.quadraticCurveTo(-5, -22 * fl, 0, -34 * fl); c.quadraticCurveTo(5, -22 * fl, 4, -7); c.closePath(); c.fill();
  }
  c.restore();
}
/** drifting dust / pollen motes in a light area (screen space, call after everything, additive). */
export function motes(ctx, t, box, { n = 50, color = '#fff2d0', seed = 7, a = 0.5 } = {}) {
  const k = ctx.canvas.width / 1080, r = mulberry32(seed);
  ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) { const x = box[0] + r() * box[2] + Math.sin(t * 0.4 + i) * 20, y = box[1] + (r() * box[3] + t * (6 + r() * 14)) % box[3], s = 1 + r() * 2.2; ctx.fillStyle = rgba(color, a * (0.4 + 0.6 * Math.sin(t * 1.3 + i * 1.7) ** 2) * (r() * 0.7 + 0.3)); ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); }
  ctx.restore();
}
export { quad, quadPath, aoStrip, edgeLight };
