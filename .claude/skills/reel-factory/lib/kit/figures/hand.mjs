// figures/hand: a shaped, jointed hand (palm, four fingers with three phalanges each, a two-segment thumb) usable at body scale and as a close-up.
// Shading is a broad soft gradient across each finger (lit edge -> mid -> soft terminator -> bounce), never hard bands. Line widths are
// clamped in SCREEN px (the caller passes `px` = screen px per local unit), so a 3000 px close-up does not get 10 px ink.
//   body scale (hand < ~55 px): separated fingers with a gap and a fan, a distinct thumb; close-up: knuckles, creases, nails, wet highlights.
import { smoothClosed, ribbon, mix, shade, rgba, cl, lerp, TAU } from '../util.mjs';

/** soft skin ramp across a form: lit edge -> mid -> terminator -> core -> bounce. `sss` tints the terminator (subsurface). */
export function softStops(base, env, sss) {
  const key = env.key ?? '#fff1d6', amb = env.amb ?? '#27304a', k = Math.min(1.2, env.strength ?? 1);
  const lit = mix(shade(base, 0.08), key, 0.18 * k), term = mix(shade(base, -0.16 * k), amb, 0.14), core = mix(shade(base, -0.38 * k), amb, 0.24), bounce = mix(shade(base, -0.2 * k), amb, 0.2);
  const t2 = sss ? mix(term, sss, 0.4) : term;
  return [[0, lit], [0.28, mix(lit, base, 0.6)], [0.52, base], [0.74, t2], [0.9, core], [1, bounce]];
}

/** linear gradient ACROSS a limb segment (lit edge first, by the light direction L), so every limb reads as a rounded form whatever its bbox. */
export function acrossGradient(c, pts, w, L, stops) {
  const a = pts[0], b = pts[pts.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, d = nx * L.x + ny * L.y, sg = d >= 0 ? 1 : -1;
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], hw = w * 0.62, g = c.createLinearGradient(m[0] + nx * sg * hw, m[1] + ny * sg * hw, m[0] - nx * sg * hw, m[1] - ny * sg * hw);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}

/**
 * drawHand(c, {p:[x,y], ang, size, curl 0..1, curls?:[i,m,r,l], spread 0..1, thumb 0..1, side:+1|-1, skin, env, px, wet, sss})
 * `ang` is the direction the fingers point, measured from straight down (like arm angles). size = hand length (wrist to fingertip).
 * `px` = screen px per local unit (figure height in px); `curls` overrides per-finger curl (index, middle, ring, little), `thumbTuck` 0..1.
 */
export function drawHand(c, o) {
  const { p, ang = 0, size = 0.06, curl = 0.2, spread = 0.2, thumb = 0.3, side = 1, skin, env, px = 600, wet = false, sss = null, curls = null, thumbTuck = 0 } = o;
  const S = size, hp = S * px, close = hp >= 55;
  const clampPx = (v, a, b) => cl(v, a, b) / px;
  const lw = clampPx(S * px * 0.03, 0.9, close ? 2.0 : 2.4);
  const soft = { ...env, hard: false };
  const stops = softStops(skin, soft, sss), ink = rgba(shade(skin, wet ? -0.8 : -0.72), close ? 0.5 : 0.7);
  const L = rotL(env.L, ang);
  c.save(); c.translate(p[0], p[1]); c.rotate(-ang);

  const palmW = S * 0.47, palmH = S * 0.5, gap = 0.15 * S;
  const cu = curls ?? [curl, curl, curl, curl];
  const fl = [0.44, 0.5, 0.46, 0.37], fw = [0.1, 0.104, 0.098, 0.082];
  const fan = (0.35 + spread * 2.6) * 0.075;
  // ---- fingers: base on the palm's top edge, three phalanges
  const fingers = [0, 1, 2, 3].map((i) => {
    const bx = side * (0.172 - i * 0.115) * S, by = palmH * 0.9, cv = cl(cu[i]);
    let a = side * (1.5 - i) * fan + (i === 3 ? -side * 0.03 : 0), x = bx, y = by;
    const pts = [[x, y]], seg = [0.5, 0.3, 0.2].map((f) => f * fl[i] * S * 1.0), bend = [0.5, 1.05, 0.8];
    const ws = [fw[i] * S * 1.04, fw[i] * S * 0.97, fw[i] * S * 0.86, fw[i] * S * 0.68];
    for (let j = 0; j < 3; j++) { a += cv * bend[j] * side * 0.95; x += Math.sin(a) * seg[j]; y += Math.cos(a) * seg[j] * (1 - 0.18 * cv); pts.push([x, y]); }
    // fist (palm view): the fingers fold down over the palm, middle phalanges lying toward the wrist; blended in for curl > ~0.4
    const k = cl((cv - 0.4) / 0.5), kk = k * k * (3 - 2 * k);
    if (kk > 0) { const fist = [[bx, by], [bx + side * 0.01 * S, by + 0.07 * S], [bx + side * 0.012 * S, by - 0.06 * S], [bx + side * 0.01 * S, by - fl[i] * S * 0.55 - 0.02 * S]]; for (let j = 1; j < 4; j++) pts[j] = [lerp(pts[j][0], fist[j][0], kk), lerp(pts[j][1], fist[j][1], kk)]; }
    return { pts, ws, a, i };
  });
  // darker web between finger bases (so gaps read as shadow, not as a fused mitten)
  c.fillStyle = rgba(shade(skin, -0.6), 0.55);
  const wb = fingers.map((f) => f.pts[0]), wt = fingers.map((f) => f.pts[1]);
  c.beginPath(); c.moveTo(wb[0][0] + gap * 0.2 * side, wb[0][1] - palmH * 0.1);
  for (let i = 0; i < 4; i++) c.lineTo(wt[i][0] - side * 0.0, lerp(wb[i][1], wt[i][1], 0.45));
  for (let i = 3; i >= 0; i--) c.lineTo(wb[i][0], wb[i][1] - palmH * 0.1);
  c.closePath(); c.fill();

  const shadeAcross = (pts, w) => acrossGradient(c, pts, w, L, stops);
  const limb = (pts, ws, { nail = false, creases = true } = {}) => {
    const path = smoothClosed(ribbon(pts, ws, { n: 5, cap: 5, bulge: 0.04 }));
    c.fillStyle = shadeAcross(pts, ws[0]); c.fill(path);
    c.strokeStyle = ink; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(path);
    if (close && creases) { // joint creases + soft knuckle highlight
      c.strokeStyle = rgba(shade(skin, -0.62), 0.38); c.lineWidth = lw * 0.75; c.lineCap = 'round';
      for (let j = 1; j < pts.length - 1; j++) { const q = pts[j], w2 = ws[j] * 0.3; c.beginPath(); c.moveTo(q[0] - w2, q[1] - w2 * 0.1); c.quadraticCurveTo(q[0], q[1] + w2 * 0.35, q[0] + w2, q[1] - w2 * 0.1); c.stroke(); }
    }
    if (nail && close) {
      const e = pts[pts.length - 1], q = pts[pts.length - 2], da = Math.atan2(e[0] - q[0], e[1] - q[1]), nw = ws[ws.length - 1] * 0.34, nl = ws[ws.length - 1] * 0.5;
      c.save(); c.translate(e[0] - Math.sin(da) * nl * 0.7, e[1] - Math.cos(da) * nl * 0.7); c.rotate(-da);
      c.fillStyle = wet ? rgba('#59655f', 0.75) : rgba(mix(skin, '#e9d9cc', 0.35), 0.6); c.beginPath(); c.ellipse(0, 0, nw, nl, 0, 0, TAU); c.fill();
      c.strokeStyle = rgba(shade(skin, -0.7), 0.4); c.lineWidth = lw * 0.6; c.stroke(); c.restore();
    }
    return path;
  };
  // far to near: little finger first, index last, so the thumb-side edge overlaps
  const folded = (f) => cl(cu[f.i]) > 0.62;
  [...fingers].reverse().filter((f) => !folded(f)).forEach((f) => limb(f.pts, f.ws, { nail: true }));

  // ---- palm (drawn over the finger roots)
  const palm = smoothClosed([[-palmW * 0.42, 0.0], [palmW * 0.42, 0.0], [palmW * 0.55, palmH * 0.42], [palmW * 0.54, palmH * 0.97], [-palmW * 0.54, palmH * 0.97], [-palmW * 0.56, palmH * 0.42]]);
  const bb = [-palmW / 2, 0, palmW / 2, palmH];
  { const cx = 0, cy = palmH / 2, hw = palmW * 0.62, hh = palmH * 0.62, e = Math.abs(L.x) * hw + Math.abs(L.y) * hh + 1e-6, g = c.createLinearGradient(cx + L.x * e, cy + L.y * e, cx - L.x * e, cy - L.y * e); for (const [t, col] of stops) g.addColorStop(t, col); c.fillStyle = g; }
  c.fill(palm); c.strokeStyle = ink; c.lineWidth = lw; c.stroke(palm);

  [...fingers].reverse().filter(folded).forEach((f) => limb(f.pts, f.ws, { nail: true })); // folded fingers lie over the palm

  // ---- thumb: two segments out from the palm's thumb side, bends toward the fingers when tucked
  { const open = cl(thumb) * (1 - thumbTuck), a0 = side * (0.28 + 0.62 * open), a1 = a0 - side * (0.2 + 0.55 * thumbTuck + 0.25 * cl(curl)), b = [side * palmW * 0.5, palmH * 0.16];
    const tk = thumbTuck; let m = [b[0] + Math.sin(a0) * S * 0.2, b[1] + Math.cos(a0) * S * 0.2], e = [m[0] + Math.sin(a1) * S * 0.18, m[1] + Math.cos(a1) * S * 0.18];
    if (tk > 0) { const t2 = [-side * palmW * 0.1, palmH * 0.72]; m = [lerp(m[0], side * palmW * 0.1, tk), lerp(m[1], palmH * 0.3, tk)]; e = [lerp(e[0], t2[0], tk), lerp(e[1], t2[1], tk)]; }
    limb([b, m, e], [S * 0.14, S * 0.125, S * 0.1], { nail: true }); }

  if (close) {
    // soft knuckle bumps on the palm edge, back-of-hand tendon hints
    c.fillStyle = rgba(mix(skin, env.key ?? '#fff', 0.5), wet ? 0.1 : 0.12);
    for (const f of fingers) { c.beginPath(); c.ellipse(f.pts[0][0], f.pts[0][1] - palmH * 0.12, fw[f.i] * S * 0.5, fw[f.i] * S * 0.33, 0, 0, TAU); c.fill(); }
    c.strokeStyle = rgba(shade(skin, -0.5), 0.14); c.lineWidth = lw * 0.9; c.lineCap = 'round';
    for (const f of fingers.slice(0, 3)) { c.beginPath(); c.moveTo(f.pts[0][0] * 0.7, palmH * 0.1); c.lineTo(f.pts[0][0], palmH * 0.78); c.stroke(); }
  }
  if (wet) { // a few small, soft wet highlights (never a continuous band): on the back of the hand and the lit side of the proximal phalanges
    const key = env.key ?? '#f4fbf4', lit = L.x * side >= 0 ? 1 : -1;
    const spots = [[0.1 * S * side, palmH * 0.62, 0.05 * S, 0.1 * S], [-0.1 * S * side, palmH * 0.8, 0.04 * S, 0.07 * S], [0, palmH * 0.28, 0.06 * S, 0.05 * S], ...fingers.slice(0, 3).map((f) => [f.pts[1][0] + lit * f.ws[1] * 0.18, f.pts[1][1], 0.022 * S, 0.075 * S])];
    for (const [X, Y, rx, ry] of spots) {
      const g = c.createRadialGradient(X, Y, 0, X, Y, ry); g.addColorStop(0, rgba(mix(key, '#ffffff', 0.4), 0.5)); g.addColorStop(1, rgba(key, 0));
      c.save(); c.translate(X, Y); c.scale(rx / ry, 1); c.translate(-X, -Y); c.fillStyle = g; c.beginPath(); c.arc(X, Y, ry, 0, TAU); c.fill(); c.restore();
    }
  }
  c.restore();
}
function rotL(L, ang) { const ca = Math.cos(ang), sa = Math.sin(ang); return { x: L.x * ca - L.y * sa, y: L.x * sa + L.y * ca }; }
