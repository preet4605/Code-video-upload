// sets/tunnel: one-point-perspective interior box builder. Corridor, stairwell, room and haveli arcade are parameter sets on it.
// World: P(X, Y, Z) -> authored px = vp + (X, Y)/Z with Z in metres of depth (1 m = 1 focal unit = a layer depth), X lateral px at
// Z = 1, Y px below the eye (floor = +Hf, ceiling = -Hc). The box is cut into depth segments; each segment is one layer drawn at its
// FAR edge depth and extended toward the camera (the nearer segment paints over the extension), so any push-in leaves no gaps.
// Wall objects (doors, windows, lamps, bed...) are their own layers at their own depth.
import { cin, cl, lerp, mix, shade, rgba, tweak, mulberry32, Path2D, smoothClosed, ribbon, stains, streaks, edgeAO, surface, TAU, h01, DW, DH } from '../util.mjs';
import { makeSet, makePalette, makeProj, quadPath, bbox, aoStrip, edgeLight, wallCourses } from './core.mjs';
import { archPath, barredWindow, diya, sky as skyFn } from './parts.mjs';

const opt = (o, k, d) => (o && o[k] !== undefined ? o[k] : d);
const UPM = 512;

function geometry(o, def) {
  const g = { vp: { x: opt(o, 'vpX', 540), y: opt(o, 'vpY', def.vpY ?? 860) }, W0: def.W0, Hf: def.Hf ?? 665, Hc: def.Hc ?? 870, z0: def.z0 ?? 1.0, zEnd: def.zEnd, n: def.n };
  g.P = makeProj(g.vp);
  g.zs = Array.from({ length: g.n + 1 }, (_, i) => g.z0 * Math.pow(g.zEnd / g.z0, i / g.n));
  return g;
}

// ---- wall painters ---------------------------------------------------------
// quad on the wall plane X = side*W0 between depths za (near) and zb (far), heights ya..yb (Y px below eye, ya > yb = lower to upper)
const wq = (G, side, za, zb, ya, yb) => [G.P(side * G.W0, ya, za), G.P(side * G.W0, ya, zb), G.P(side * G.W0, yb, zb), G.P(side * G.W0, yb, za)];

function paintSegment(c, G, S, i, st, t) {
  const { P, W0, Hf, Hc } = G, pal = S.palette, zf = G.zs[i], zn = Math.max(0.45, G.zs[i - 1] * 0.7), zm = (zf + zn) / 2, night = pal.tod === 'night';
  const mk = (pts) => ({ pts, path: quadPath(pts), bb: bbox(pts) });
  const L = mk(wq(G, -1, zn, zf, Hf, -Hc)), R = mk(wq(G, 1, zn, zf, Hf, -Hc));
  const F = mk([P(-W0, Hf, zn), P(W0, Hf, zn), P(W0, Hf, zf), P(-W0, Hf, zf)]), C = mk([P(-W0, -Hc, zn), P(W0, -Hc, zn), P(W0, -Hc, zf), P(-W0, -Hc, zf)]);
  const tsc = 1.2 / Math.pow(zm, 0.55), wear = S.wear * 0.6;
  const dim = (col, k) => (night ? shade(col, -k) : col);
  const fogA = cl((zf - 1.5) / 14) * (st.fog ?? 0.5);
  // ceiling (an open-top street shows the sky instead)
  if (!st.openTop) surface(c, C.path, C.bb, { color: dim(st.ceil ?? shade(pal.wall, -0.1), 0.2), tex: 'plaster', texA: 0.3, scale: tsc, seed: S.seed + 2, wear: wear * 0.3, stain: '#2a2016' });
  // floor
  surface(c, F.path, F.bb, { color: dim(st.floor ?? pal.floor, 0.1), tex: st.floorTex ?? 'stone', texA: 0.5, scale: tsc * 0.9, seed: S.seed + 3, wear, stain: '#15100a' });
  floorLines(c, G, S, st, zn, zf);
  // walls (side styles)
  for (const side of [-1, 1]) {
    const W = side < 0 ? L : R, style = side < 0 ? st.left : st.right;
    if (style === 'arcade') { arcadeWall(c, G, S, st, side, zn, zf, W); continue; }
    surface(c, W.path, W.bb, { color: dim(st.wallColor?.[side] ?? pal.wall, 0.12), tex: style === 'brick' ? 'brick' : 'plaster', texA: style === 'brick' ? 0.4 : 0.3, scale: tsc, seed: S.seed + 4 + (side > 0 ? 3 : 0), wear, stain: '#2a2016' });
    // dado band: lower wall in a second colour with a top rail
    if (st.dado) {
      const dh = st.dadoH ?? 300, q = mk(wq(G, side, zn, zf, Hf, Hf - dh));
      c.save(); c.fillStyle = dim(st.dado, 0.12); c.fill(q.path); c.clip(q.path); cin.fillTexture(c, 'plaster', q.bb.slice(0, 2).concat([q.bb[2] - q.bb[0], q.bb[3] - q.bb[1]]), { alpha: 0.5, scale: tsc, ox: 0, oy: 0, seed: S.seed + 9 }); stains(c, [q.bb[0], q.bb[1], q.bb[2] - q.bb[0], q.bb[3] - q.bb[1]], S.seed + 11, { n: 6, color: '#0a0805', a: 0.25 }); c.restore();
      const a = P(side * W0, Hf - dh, zn), b = P(side * W0, Hf - dh, zf); edgeLight(c, a, b, '#fff', Math.max(2, 7 / zm), 0.35); c.strokeStyle = rgba('#000', 0.45); c.lineWidth = Math.max(1.5, 4 / zm); c.beginPath(); c.moveTo(a[0], a[1] + 4 / zm); c.lineTo(b[0], b[1] + 4 / zm); c.stroke();
    }
    if (style === 'brick') wallCourses(c, P, side * W0, -Hc, Hf, zn, zf, { rows: 14, a: 0.1 });
    // skirting
    const sk = mk(wq(G, side, zn, zf, Hf, Hf - 40)); c.fillStyle = rgba('#000', 0.35); c.fill(sk.path);
  }
  // fog toward the far end
  if (fogA > 0.01) { c.fillStyle = rgba(st.fogColor ?? pal.sky1, fogA * 0.3); for (const q of st.openTop ? [L, R, F] : [L, R, F, C]) c.fill(q.path); }
  // ambient occlusion: wall/floor, wall/ceiling, wall/wall corners
  const ao = (a0, a1, n, w, a) => aoStrip(c, a0, a1, n, w, a);
  const ww = 150 / zm;
  c.save(); c.beginPath(); c.rect(-400, -400, DW + 800, DH + 800); c.clip();
  for (const side of [-1, 1]) {
    ao(P(side * W0, Hf, zn), P(side * W0, Hf, zf), [-side * 0.8, -0.6], ww * 0.5, 0.35);   // wall/floor, spreading into the floor
    if (!st.openTop) ao(P(side * W0, -Hc, zn), P(side * W0, -Hc, zf), [-side * 0.7, 0.7], ww * 0.8, 0.4);   // wall/ceiling
  }
  c.restore();
}
function floorLines(c, G, S, st, zn, zf) {
  const { P, W0, Hf } = G, pal = S.palette;
  c.strokeStyle = rgba('#000', 0.38); c.lineWidth = 2;
  const step = st.tile ?? 0.6; // metres
  for (let X = -W0; X <= W0 + 1; X += step * UPM) { const a = P(X, Hf, zn), b = P(X, Hf, zf); c.lineWidth = Math.max(1, 3 / ((zn + zf) / 2)); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  for (let z = Math.ceil(zn / step) * step; z < zf; z += step) { const a = P(-W0, Hf, z), b = P(W0, Hf, z); c.lineWidth = Math.max(1, 4 / z); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  if (st.checker) { c.fillStyle = rgba('#000', 0.16); for (let ix = 0, X = -W0; X < W0; X += step * UPM, ix++) for (let iz = 0, z = Math.ceil(zn / step) * step - step; z < zf; z += step, iz++) if ((ix + iz) % 2 === 0) { const q = [P(X, Hf, Math.max(zn, z)), P(X + step * UPM, Hf, Math.max(zn, z)), P(X + step * UPM, Hf, Math.min(zf, z + step)), P(X, Hf, Math.min(zf, z + step))]; if (z + step > zn) { c.beginPath(); c.moveTo(...q[0]); for (const p of q.slice(1)) c.lineTo(...p); c.closePath(); c.fill(); } } }
}

// haveli arcade: a wall of arches opening onto a bright courtyard; pillars sit on the ring frames
function arcadeWall(c, G, S, st, side, zn, zf, W) {
  const { P, W0, Hf, Hc } = G, pal = S.palette, night = pal.tod === 'night';
  surface(c, W.path, W.bb, { color: shade(pal.wall, night ? -0.5 : 0), tex: 'plaster', texA: 0.5, scale: 1.2 / zf, seed: S.seed + 14, wear: S.wear, stain: '#2a2016' });
  const pitch = st.arch ?? 1.5, yS = Hf - 1.45 * UPM, yT = Hf - 2.1 * UPM;      // spring line and crown
  for (let za = Math.floor(zn / pitch) * pitch; za < zf; za += pitch) {
    const a = za + 0.28, b = za + pitch - 0.28; if (b < zn || a > zf) continue;
    const pts = []; pts.push(P(side * W0, Hf, a)); pts.push(P(side * W0, yS, a));
    for (let k = 1; k < 12; k++) { const u = k / 12; pts.push(P(side * W0, yS - (yS - yT) * Math.sin(Math.PI * u) ** 0.75 * (u < 0.5 ? 1 : 1), lerp(a, b, u))); }
    pts.push(P(side * W0, yS, b)); pts.push(P(side * W0, Hf, b));
    const path = new Path2D(); path.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) path.lineTo(p[0], p[1]); path.closePath();
    // beyond the arch: bright courtyard (sun-struck floor and sky), the only emissive thing
    c.save(); c.clip(path); const g = c.createLinearGradient(0, G.vp.y - 380, 0, G.vp.y + 480); g.addColorStop(0, night ? '#10182c' : '#f4efe0'); g.addColorStop(0.5, night ? '#1c2a48' : '#fffaf0'); g.addColorStop(1, night ? '#101018' : '#e8d9b8'); c.fillStyle = g; c.fillRect(-300, -300, DW + 600, DH + 600);
    c.fillStyle = rgba('#000', night ? 0.25 : 0.12); const t0 = P(side * W0 * 1.6, Hf, lerp(a, b, 0.5)); c.beginPath(); c.ellipse(t0[0], t0[1], 160 / zf, 24 / zf, 0, 0, TAU); c.fill(); c.restore();
    c.strokeStyle = rgba('#000', 0.55); c.lineWidth = Math.max(2, 9 / zf); c.stroke(path);
    const m = P(side * W0, yT, (a + b) / 2); c.strokeStyle = rgba(shade(pal.wall, 0.25), 0.7); c.lineWidth = Math.max(1.5, 4 / zf); c.beginPath(); c.moveTo(pts[1][0], pts[1][1]); for (const p of pts.slice(2, -2)) c.lineTo(p[0], p[1]); c.stroke();
  }
}

// ring frames: beams / pilasters / pillars at depth z (own layer so it can sit in front of the segment it bounds)
function paintFrame(c, G, S, st, z, kind) {
  const { P, W0, Hf, Hc } = G, pal = S.palette, night = pal.tod === 'night', col = night ? shade(st.frameColor ?? pal.trim, -0.35) : st.frameColor ?? pal.trim;
  const pw = (st.frameW ?? 0.22) * UPM, bh = (st.beamH ?? 0.3) * UPM, tl = P(-W0, -Hc, z), br = P(W0, Hf, z), pL = P(-W0 + pw, -Hc, z), pR = P(W0 - pw, Hf, z), bB = P(0, -Hc + bh, z);
  const frame = new Path2D(); frame.rect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);
  const hole = new Path2D(); hole.rect(pL[0], bB[1], pR[0] - pL[0], br[1] - bB[1]);
  const ring = new Path2D(); ring.rect(tl[0] - 400, tl[1] - 400, br[0] - tl[0] + 800, br[1] - tl[1] + 800); // outer extension
  c.save(); const cut = new Path2D(); cut.rect(tl[0] - 400, tl[1] - 400, br[0] - tl[0] + 800, br[1] - tl[1] + 800); cut.addPath(hole);
  c.fillStyle = col; c.fill(cut, 'evenodd'); c.clip(cut, 'evenodd');
  cin.fillTexture(c, kind === 'wood' ? 'wood' : 'plaster', [tl[0] - 400, tl[1] - 400, br[0] - tl[0] + 800, br[1] - tl[1] + 800], { alpha: 0.55, scale: 1.2 / z, ox: 0, oy: 0, seed: S.seed + 21 });
  // inner edge lit, inner reveal darkened (the thickness of the frame)
  c.strokeStyle = rgba('#fff', 0.35); c.lineWidth = Math.max(2, 6 / z); c.stroke(hole); c.restore();
  // soft AO right inside the opening on the far side
  const g = c.createLinearGradient(pL[0], 0, pL[0] + 120 / z, 0); g.addColorStop(0, rgba('#000', 0.4)); g.addColorStop(1, rgba('#000', 0)); c.fillStyle = g; c.fillRect(pL[0], bB[1], 120 / z, br[1] - bB[1]);
  const g2 = c.createLinearGradient(pR[0], 0, pR[0] - 120 / z, 0); g2.addColorStop(0, rgba('#000', 0.4)); g2.addColorStop(1, rgba('#000', 0)); c.fillStyle = g2; c.fillRect(pR[0] - 120 / z, bB[1], 120 / z, br[1] - bB[1]);
  const g3 = c.createLinearGradient(0, bB[1], 0, bB[1] + 110 / z); g3.addColorStop(0, rgba('#000', 0.5)); g3.addColorStop(1, rgba('#000', 0)); c.fillStyle = g3; c.fillRect(pL[0], bB[1], pR[0] - pL[0], 110 / z);
}

// ---- wall objects -----------------------------------------------------------
function doorOnWall(c, G, S, it, t) {
  const { P, W0, Hf } = G, pal = S.palette, side = it.side, w = (it.w ?? 0.95), h = (it.h ?? 2.05) * UPM, za = it.z - w / 2, zb = it.z + w / 2, night = pal.tod === 'night';
  const X = side * (W0 - 2), col = it.color ?? pal.wood, base = night ? shade(col, -0.3) : col;
  // frame (a slightly larger quad), recess, door leaf, planks, handle
  const q = (e, yb, yt) => [P(X, yb, za - e), P(X, yb, zb + e), P(X, yt, zb + e), P(X, yt, za - e)];
  const frame = quadPath(q(0.07, Hf, Hf - h - 0.07 * UPM)); c.fillStyle = shade(col, -0.15); c.fill(frame);
  const leafQ = q(0, Hf, Hf - h), leaf = quadPath(leafQ), bb = bbox(leafQ);
  if (it.open) { // ajar: dark gap + bright sliver of light (light strip)
    c.fillStyle = '#030201'; c.fill(leaf);
    const gap = quadPath([P(X, Hf, zb - 0.16), P(X, Hf, zb), P(X, Hf - h, zb), P(X, Hf - h, zb - 0.16)]); c.fillStyle = rgba(it.lightColor ?? '#ffe3a0', 0.92); c.fill(gap);
  } else {
    surface(c, leaf, bb, { color: base, tex: 'wood', texA: 0.7, scale: 1.1 / it.z, seed: S.seed + 31 + Math.round(it.z * 3), wear: S.wear * 0.7, stain: '#0e0804' });
    c.save(); c.clip(leaf); c.strokeStyle = rgba('#000', 0.4); c.lineWidth = Math.max(1.5, 4 / it.z);
    for (let k = 1; k < 5; k++) { const y = Hf - (h * k) / 5, a = P(X, y, za), b = P(X, y, zb); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    // panel inset
    const pin = quadPath([P(X, Hf - h * 0.12, za + 0.14), P(X, Hf - h * 0.12, zb - 0.14), P(X, Hf - h * 0.48, zb - 0.14), P(X, Hf - h * 0.48, za + 0.14)]); c.strokeStyle = rgba('#000', 0.5); c.lineWidth = Math.max(2, 5 / it.z); c.stroke(pin);
    const pin2 = quadPath([P(X, Hf - h * 0.55, za + 0.14), P(X, Hf - h * 0.55, zb - 0.14), P(X, Hf - h * 0.9, zb - 0.14), P(X, Hf - h * 0.9, za + 0.14)]); c.stroke(pin2);
    c.restore();
    if (it.number) { const n = P(X, Hf - h * 0.78, it.z), s = Math.max(10, 38 / it.z); c.fillStyle = rgba('#e9dfc0', 0.9); c.fillRect(n[0] - s * 0.8, n[1] - s * 0.6, s * 1.6, s * 1.2); c.fillStyle = '#2a2018'; c.font = `bold ${s}px sans-serif`; c.textAlign = 'center'; c.fillText(String(it.number), n[0], n[1] + s * 0.36); }
    const hd = P(X, Hf - h * 0.46, zb - 0.12), hs = Math.max(4, 14 / it.z); c.fillStyle = '#b9a373'; c.beginPath(); c.arc(hd[0], hd[1], hs, 0, TAU); c.fill(); c.fillStyle = rgba('#fff', 0.7); c.beginPath(); c.arc(hd[0] - hs * 0.3, hd[1] - hs * 0.3, hs * 0.35, 0, TAU); c.fill();
    if (it.lightStrip) { // light spilling under the door
      const strip = quadPath([P(X, Hf - 6, za), P(X, Hf - 6, zb), P(X, Hf, zb), P(X, Hf, za)]); c.fillStyle = rgba(it.lightColor ?? '#ffd58a', 0.95); c.fill(strip);
      const fl = quadPath([P(X, Hf, za), P(X, Hf, zb), P(side * (W0 - 0.7 * UPM), Hf, zb + 0.05), P(side * (W0 - 0.9 * UPM), Hf, za - 0.1)]); c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = rgba(it.lightColor ?? '#ffd58a', 0.28); c.fill(fl); c.restore();
    }
  }
  // lit edge on the frame
  edgeLight(c, P(X, Hf, za - 0.07), P(X, Hf - h - 0.07 * UPM, za - 0.07), '#fff', Math.max(2, 5 / it.z), 0.3);
}
function windowOnWall(c, G, S, it, t) {
  const { P, W0, Hf } = G, pal = S.palette, side = it.side, w = it.w ?? 1.1, h = (it.h ?? 1.2) * UPM, y0 = Hf - (it.sill ?? 0.95) * UPM, za = it.z - w / 2, zb = it.z + w / 2, night = pal.tod === 'night', X = side * (W0 - 2);
  const q = (e, yb, yt) => [P(X, yb, za - e), P(X, yb, zb + e), P(X, yt, zb + e), P(X, yt, za - e)];
  const outer = quadPath(q(0.06, y0 + 0.06 * UPM, y0 - h - 0.06 * UPM)); c.fillStyle = shade(pal.trim, night ? -0.3 : 0); c.fill(outer);
  const glassQ = q(0, y0, y0 - h), glass = quadPath(glassQ); c.save(); c.clip(glass);
  const mid = P(X, y0 - h / 2, it.z), g = c.createLinearGradient(0, mid[1] - h / it.z / 2, 0, mid[1] + h / it.z / 2);
  if (night) { g.addColorStop(0, '#16224a'); g.addColorStop(1, '#4a5f96'); } else { g.addColorStop(0, '#fffbe8'); g.addColorStop(1, '#dfe9ff'); }
  c.fillStyle = g; c.fillRect(-300, -300, DW + 600, DH + 600);
  if (night && it.moon) { const mpos = P(X, y0 - h * 0.62, it.z - w * 0.1), r = Math.max(8, 52 / it.z); const gg = c.createRadialGradient(mpos[0], mpos[1], 0, mpos[0], mpos[1], r * 4); gg.addColorStop(0, rgba('#dfe8ff', 0.9)); gg.addColorStop(1, rgba('#dfe8ff', 0)); c.fillStyle = gg; c.fillRect(mpos[0] - r * 4, mpos[1] - r * 4, r * 8, r * 8); c.fillStyle = '#f4f7ff'; c.beginPath(); c.arc(mpos[0], mpos[1], r, 0, TAU); c.fill(); }
  c.restore();
  // mullions + bars
  c.strokeStyle = '#120e0a'; c.lineWidth = Math.max(2, 7 / it.z);
  for (let k = 1; k < 4; k++) { const a = P(X, y0, lerp(za, zb, k / 4)), b = P(X, y0 - h, lerp(za, zb, k / 4)); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  { const a = P(X, y0 - h / 2, za), b = P(X, y0 - h / 2, zb); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  c.strokeStyle = rgba('#000', 0.6); c.lineWidth = Math.max(2, 6 / it.z); c.stroke(glass);
  // sill slab catches light
  edgeLight(c, P(X, y0 + 0.04 * UPM, za - 0.08), P(X, y0 + 0.04 * UPM, zb + 0.08), '#fff', Math.max(2, 7 / it.z), 0.5);
  if (it.curtain) { const col = it.curtain, pts = [P(X, y0 + 0.2 * UPM, za - 0.12), P(X, y0 + 0.2 * UPM, za + 0.28), P(X, y0 - h - 0.1 * UPM, za + 0.2), P(X, y0 - h - 0.1 * UPM, za - 0.12)]; c.fillStyle = night ? shade(col, -0.4) : col; c.fill(quadPath(pts)); c.strokeStyle = rgba('#000', 0.3); c.lineWidth = 3; for (let k = 1; k < 4; k++) { const a = P(X, y0 + 0.2 * UPM, lerp(za - 0.12, za + 0.28, k / 4)), b = P(X, y0 - h - 0.1 * UPM, lerp(za - 0.12, za + 0.2, k / 4)); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); } }
}
function ceilingLamp(c, G, S, it, t) {
  const { P, Hc } = G, p = P(it.x ?? 0, -Hc, it.z), s = Math.max(14, 90 / it.z), on = it.on ?? 1, night = S.palette.tod === 'night';
  const fl = it.flicker ? 0.55 + 0.45 * (cin.noise1(it.seed ?? 3, t * 9) > -0.1 ? 1 : 0.2) : 1;
  if (it.kind === 'bulb') { c.strokeStyle = '#111'; c.lineWidth = Math.max(1.5, 4 / it.z); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0], p[1] + 0.45 * UPM / it.z); c.stroke(); const bx = p[0], by = p[1] + 0.5 * UPM / it.z; c.fillStyle = rgba('#fff3c0', on * fl); c.beginPath(); c.arc(bx, by, s * 0.22, 0, TAU); c.fill(); return; }
  // tube light fixture lying along X
  c.fillStyle = '#2a2a28'; c.fillRect(p[0] - s * 1.7, p[1] - 2, s * 3.4, s * 0.26);
  c.fillStyle = on ? rgba('#e8f4ff', 0.95 * fl) : '#3a3d3e'; c.fillRect(p[0] - s * 1.6, p[1] + s * 0.02, s * 3.2, s * 0.18);
}
function bareGlow(ctx, cam, L, t) { /* emissive glow painted after the mask */ }

// ---- builder ------------------------------------------------------------------
function buildTunnel(o, def) {
  const seed = opt(o, 'seed', 1), tod = opt(o, 'tod', def.tod ?? 'night'), pal = makePalette(opt(o, 'palette', def.palette), seed, tod), wear = opt(o, 'wear', def.wear ?? 0.5);
  const G = geometry(o, def), { P, W0, Hf, Hc, zs } = G, S = { vp: G.vp, palette: pal, seed, wear };
  const st = { fog: 0.6, ...def.style, ...(o.style || {}) };
  const night = tod === 'night', layers = [], lights = [], r = mulberry32(seed * 101 + 7);
  // back wall (farthest layer): fills the visible window, then the end-of-corridor content
  layers.push({ id: 'end', depth: G.zEnd, kind: 'lit', order: -1, draw: (c, b, occ, t) => {
    if (occ) { c.fillStyle = '#000'; c.fillRect(b.x0, b.y0, b.w, b.h); return; }
    const zE = G.zEnd, tl = P(-W0, -Hc, zE), br = P(W0, Hf, zE), bbq = [tl[0], tl[1], br[0], br[1]];
    if (!st.openTop) { c.fillStyle = night ? shade(pal.wall, -0.5) : pal.wall; c.fillRect(b.x0, b.y0, b.w, b.h);
    surface(c, quadPath([tl, [br[0], tl[1]], br, [tl[0], br[1]]]), bbq, { color: night ? shade(st.endColor ?? pal.wall, -0.45) : st.endColor ?? pal.wall, tex: 'plaster', texA: 0.5, scale: 0.5, seed: seed + 5, wear, stain: '#2a2016' }); }
    def.end?.(c, G, S, st, t, o);
  } });
  if (st.openTop) layers.push({ id: 'sky', depth: G.zEnd + 3, kind: 'back', fullBleed: true, draw: (c, b) => skyFn(c, b, pal, { seed, sunX: 640, sunY: 160, moon: night, horizonY: G.vp.y, clouds: 0.3 }) });
  // segments + frames
  for (let i = 1; i <= G.n; i++) layers.push({ id: `seg${i}`, depth: zs[i], kind: 'lit', order: 0, draw: (c, b, occ, t) => { if (occ) { paintOcc(c, G, i, st.openTop); return; } paintSegment(c, G, S, i, st, t); } });
  if (st.frames) for (let i = 1; i < G.n; i++) if (!st.frameSkip?.includes(i)) layers.push({ id: `frame${i}`, depth: zs[i] - 0.001, kind: 'lit', order: 1, draw: (c, b, occ) => { if (occ) { paintFrameOcc(c, G, zs[i], st); return; } paintFrame(c, G, S, st, zs[i], st.frames); } });
  const items = def.items ? def.items({ G, S, st, r, o, lights, seed, pal }) : [];
  for (const it of items) layers.push({ id: it.id ?? it.type, depth: it.z - (it.dz ?? 0.06), kind: 'lit', order: 2, draw: (c, b, occ, t) => { if (occ) { if (it.occ) it.occ(c, G); return; } if (it.type === 'door') doorOnWall(c, G, S, it, t); else if (it.type === 'window') windowOnWall(c, G, S, it, t); else if (it.type === 'lamp') ceilingLamp(c, G, S, it, t); else it.draw(c, G, S, t); } });
  for (const L of def.lights?.({ G, S, items, r, o }) ?? []) lights.push(L);
  for (const fgd of def.foreground?.({ G, S, st, r, o, pal }) ?? []) layers.push({ id: fgd.id, depth: fgd.depth, kind: 'fg', blur: fgd.blur ?? 6, draw: fgd.draw });
  const set = makeSet({ name: def.name, seed, tod, palette: pal, wear, vp: G.vp, groundH: Hf, upm: UPM, layers, lights, geom: G, groundY: G.P(0, Hf, 1.6)[1], params: o, ambient: opt(o, 'ambient', def.ambient ?? (night ? '#0d1424' : '#4a4e5c')), glow: def.glow ?? 0.14, forceMask: def.forceMask ?? night, anchors: { subject: { z: 2.0, x: 0 }, end: { z: G.zEnd } } });
  set.P = P; set.items = items;
  set.place = ({ z = 2, x = 0, meters = 1.6 } = {}) => ({ x: G.vp.x + (x * UPM) / z, feet: G.vp.y + Hf / z, height: (meters * UPM) / z });
  return set;
}
function paintOcc(c, G, i, openTop) { const { P, W0, Hf, Hc, zs } = G, zf = zs[i], zn = Math.max(0.45, zs[i - 1] * 0.7); c.fillStyle = '#000'; for (const q of [wq(G, -1, zn, zf, Hf, -Hc), wq(G, 1, zn, zf, Hf, -Hc), [P(-W0, Hf, zn), P(W0, Hf, zn), P(W0, Hf, zf), P(-W0, Hf, zf)], ...(openTop ? [] : [[P(-W0, -Hc, zn), P(W0, -Hc, zn), P(W0, -Hc, zf), P(-W0, -Hc, zf)]])]) { c.beginPath(); c.moveTo(...q[0]); for (const p of q.slice(1)) c.lineTo(...p); c.closePath(); c.fill(); } }
function paintFrameOcc(c, G, z, st) { const { P, W0, Hf, Hc } = G, pw = (st.frameW ?? 0.22) * UPM, bh = (st.beamH ?? 0.3) * UPM; c.fillStyle = '#000'; let a = P(-W0, -Hc, z), b = P(-W0 + pw, Hf, z); c.fillRect(a[0] - 400, a[1] - 400, b[0] - a[0] + 400, b[1] - a[1] + 800); a = P(W0 - pw, -Hc, z); b = P(W0, Hf, z); c.fillRect(a[0], a[1] - 400, b[0] - a[0] + 400, b[1] - a[1] + 800); a = P(-W0, -Hc, z); b = P(W0, -Hc + bh, z); c.fillRect(a[0] - 400, a[1] - 400, b[0] - a[0] + 800, b[1] - a[1] + 400); }

// ---- foreground helpers ------------------------------------------------------
function jambFg(side, pal, seed, { w = 150, color = pal.wood } = {}) {
  return (c, b) => {
    const x0 = side < 0 ? -40 : DW - w + 40, g = c.createLinearGradient(x0, 0, x0 + w, 0);
    if (side < 0) { g.addColorStop(0, shade(color, -0.55)); g.addColorStop(0.7, shade(color, -0.3)); g.addColorStop(1, shade(color, 0.05)); } else { g.addColorStop(0, shade(color, 0.05)); g.addColorStop(0.3, shade(color, -0.3)); g.addColorStop(1, shade(color, -0.6)); }
    c.fillStyle = g; c.fillRect(x0, b.y0, w, b.h); c.save(); c.beginPath(); c.rect(x0, b.y0, w, b.h); c.clip(); cin.fillTexture(c, 'wood', [x0, b.y0, w, b.h], { alpha: 0.6, scale: 1.4, ox: 0, oy: 0, seed: seed + 41 }); stains(c, [x0, b.y0, w, b.h], seed + 42, { n: 10, color: '#050302', a: 0.35 }); c.restore();
    c.fillStyle = rgba('#fff', 0.5); c.fillRect(side < 0 ? x0 + w - 6 : x0, b.y0, 6, b.h);                               // lit inner edge
    c.fillStyle = shade(color, -0.4); c.fillRect(b.x0, b.y0 - 10, b.w, 110); c.fillStyle = rgba('#fff', 0.25); c.fillRect(b.x0, 100 - 0, b.w, 5);   // lintel
  };
}

export { buildTunnel, UPM, jambFg, paintFrame, doorOnWall, windowOnWall, ceilingLamp, arcadeWall, geometry, wq };
