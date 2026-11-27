// figures/face: head, face (eyes with blink + gaze + glint, brows, nose, mouth shapes), ears and hair masses.
// Drawn in head units (head height = 1, centre of the face = 0,0, y down, facing +x). The caller has already set the
// transform to figure-local units; drawHead translates/rotates/scales into head space.
import { Path2D, smoothClosed, mix, shade, rgba, cl, lerp, mulberry32, ribbon, TAU, cin } from '../util.mjs';

export const EXPR = {
  neutral: { open: 1, brow: 0, slant: 0, mouth: 'closed', tilt: 0 },
  happy: { open: 0.9, brow: 0.3, slant: -0.2, mouth: 'smile', tilt: -0.05 },
  afraid: { open: 1.35, brow: 1, slant: 0.9, mouth: 'e', tilt: 0 },
  sad: { open: 0.8, brow: 0.5, slant: 0.9, mouth: 'frown', tilt: 0.05 },
  angry: { open: 0.75, brow: -0.7, slant: -1, mouth: 'frown', tilt: 0 },
  blank: { open: 0.95, brow: 0, slant: 0, mouth: 'closed', tilt: 0 },
  worried: { open: 1.1, brow: 0.7, slant: 0.7, mouth: 'closed', tilt: 0 },
};
export const EXPR_NAMES = Object.keys(EXPR);

function grad(c, bb, L, stops, ext = 1) {
  const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, hw = (bb[2] - bb[0]) / 2, hh = (bb[3] - bb[1]) / 2;
  const e = (Math.abs(L.x) * hw + Math.abs(L.y) * hh) * ext + 1e-6;
  const g = c.createLinearGradient(cx + L.x * e, cy + L.y * e, cx - L.x * e, cy - L.y * e);
  for (const [s, col] of stops) g.addColorStop(s, col);
  return g;
}
/** skin / cloth / hair ramp: lit -> base -> terminator -> core shadow -> bounce. */
export function formStops(base, env) {
  const key = env.key ?? '#fff1d6', amb = env.amb ?? '#27304a', k = env.strength ?? 1;
  const lit = mix(shade(base, 0.1), key, 0.22 * k), mid = base, term = env.sss ? mix(mix(shade(base, -0.2 * k), amb, 0.14), env.sss, 0.38) : mix(shade(base, -0.2 * k), amb, 0.18), core = mix(shade(base, -0.45 * k), amb, 0.3), bounce = mix(shade(base, -0.24 * k), amb, 0.25);
  return env.hard
    ? [[0, lit], [0.52, lit], [0.56, term], [0.74, core], [1, bounce]]
    : [[0, lit], [0.3, mid], [0.58, term], [0.8, core], [1, bounce]];
}
export { grad };

const jawOf = { child: 1.06, adult: 0.99, elder: 0.86 };
function outline(age, sex, asp) {
  const jw = (jawOf[age] ?? 1) * (sex === 'f' ? 0.93 : 1), sx = asp / 0.8;
  const R = [[0, -0.5], [0.18, -0.495], [0.33, -0.43], [0.405, -0.28], [0.425, -0.1], [0.42, 0.06], [0.39 * jw, 0.2], [0.33 * jw, 0.34], [0.22 * jw, 0.45], [0.1 * jw, 0.51], [0, age === 'child' ? 0.5 : 0.535]];
  const pts = R.map(([x, y]) => [x * sx * (y > 0.12 ? 1 : 1), y]);
  const Lf = R.slice(1, -1).reverse().map(([x, y]) => [-x * sx, y]);
  return [...pts, ...Lf];
}

// hair: {back, front} point lists in head units + options
function hairShapes(style, age, sx) {
  const S = (pts) => pts.map(([x, y, s]) => [x * sx, y, s]);
  const mirror = (R) => [...R, ...R.slice(1, -1).reverse().map(([x, y]) => [-x, y])];
  switch (style) {
    case 'crop': return { front: S(mirror([[0, -0.64], [0.22, -0.6], [0.43, -0.47], [0.51, -0.22], [0.5, 0.05], [0.44, -0.08], [0.39, -0.2], [0.24, -0.3], [0.05, -0.31], [-0.1, -0.3]])) };
    case 'oiled': return { front: S([[0, -0.65], [0.25, -0.6], [0.44, -0.46], [0.5, -0.2], [0.49, 0.08], [0.44, 0.05], [0.42, -0.12], [0.34, -0.26], [0.16, -0.34], [-0.06, -0.33], [-0.22, -0.28], [-0.4, -0.1], [-0.44, 0.05], [-0.49, 0.08], [-0.5, -0.2], [-0.44, -0.46], [-0.25, -0.6]]), part: [-0.04, -0.62, -0.1, -0.33] };
    case 'bob': return { back: S([[0, -0.62], [0.35, -0.56], [0.55, -0.3], [0.58, 0.1], [0.5, 0.42], [0.3, 0.5], [0, 0.45], [-0.3, 0.5], [-0.5, 0.42], [-0.58, 0.1], [-0.55, -0.3], [-0.35, -0.56]]),
      front: S([[0, -0.64], [0.32, -0.58], [0.5, -0.35], [0.54, 0], [0.5, 0.36], [0.44, 0.4], [0.42, 0.1], [0.4, -0.08], [0.28, -0.2], [0.1, -0.27], [-0.1, -0.27], [-0.28, -0.2], [-0.4, -0.08], [-0.42, 0.1], [-0.44, 0.4], [-0.5, 0.36], [-0.54, 0], [-0.5, -0.35], [-0.32, -0.58]]) };
    case 'braid': return { back: S([[0, -0.6], [0.3, -0.55], [0.5, -0.3], [0.5, 0.05], [0.36, 0.1], [0, 0.12], [-0.36, 0.1], [-0.5, 0.05], [-0.5, -0.3], [-0.3, -0.55]]),
      front: S([[0, -0.64], [0.3, -0.59], [0.5, -0.38], [0.52, -0.02], [0.46, 0.12], [0.43, -0.1], [0.36, -0.2], [0.18, -0.3], [0.02, -0.34], [-0.02, -0.34], [-0.18, -0.3], [-0.36, -0.2], [-0.43, -0.1], [-0.46, 0.12], [-0.52, -0.02], [-0.5, -0.38], [-0.3, -0.59]]), part: [0, -0.64, 0, -0.34] };
    case 'bun': return { back: null, bun: [-0.36 * sx, -0.5, 0.2],
      front: S([[0, -0.62], [0.28, -0.57], [0.46, -0.4], [0.5, -0.14], [0.47, 0.06], [0.42, -0.12], [0.36, -0.28], [0.2, -0.38], [0.02, -0.41], [-0.02, -0.41], [-0.2, -0.38], [-0.36, -0.28], [-0.42, -0.12], [-0.47, 0.06], [-0.5, -0.14], [-0.46, -0.4], [-0.28, -0.57]]), part: [0, -0.62, 0, -0.41] };
    case 'baldfringe': return { back: null, front: S([[-0.43, -0.2], [-0.5, -0.12], [-0.5, 0.06], [-0.44, 0.08], [-0.42, -0.06]]), front2: S([[0.43, -0.2], [0.5, -0.12], [0.5, 0.06], [0.44, 0.08], [0.42, -0.06]]), bald: true };
    case 'wet': return { back: S([[0, -0.62], [0.36, -0.56], [0.56, -0.3], [0.62, 0.2], [0.6, 0.62], [0.4, 0.66], [0.3, 0.3], [0, 0.2], [-0.3, 0.3], [-0.4, 0.66], [-0.6, 0.62], [-0.62, 0.2], [-0.56, -0.3], [-0.36, -0.56]]),
      front: S([[0, -0.64], [0.34, -0.59], [0.52, -0.38], [0.56, 0], [0.5, 0.2], [0.44, 0.02], [0.4, -0.12], [0.3, -0.18], [0.12, -0.2], [-0.12, -0.2], [-0.3, -0.18], [-0.4, -0.12], [-0.44, 0.02], [-0.5, 0.2], [-0.56, 0], [-0.52, -0.38], [-0.34, -0.59]]), wet: true };
    case 'wetveil': return { back: S([[0, -0.62], [0.4, -0.56], [0.62, -0.3], [0.7, 0.3], [0.72, 1.0], [0.62, 1.55], [0.46, 1.78], [0.36, 1.2], [0.3, 0.5], [0, 0.35], [-0.3, 0.5], [-0.36, 1.2], [-0.46, 1.78], [-0.62, 1.55], [-0.72, 1.0], [-0.7, 0.3], [-0.62, -0.3], [-0.4, -0.56]]),
      front: S([[0, -0.66], [0.34, -0.6], [0.54, -0.38], [0.58, 0], [0.56, 0.3], [0.46, 0.2], [0.4, -0.12], [0.3, -0.3], [0.1, -0.36], [-0.1, -0.36], [-0.3, -0.3], [-0.4, -0.12], [-0.46, 0.2], [-0.56, 0.3], [-0.58, 0], [-0.54, -0.38], [-0.34, -0.6]]), wet: true, veil: true };
    default: throw new Error(`unknown hair style "${style}"`);
  }
}
export const HAIR_STYLES = ['crop', 'oiled', 'bob', 'braid', 'bun', 'baldfringe', 'wet', 'wetveil'];

function eye(c, side, o) {
  const { cx, cy, w, h, open, gaze, tilt, L, iris, ghost, look, ink, sclera, horror = false, headPx = 999, eyeLight = 1 } = o;
  const cf = Math.max(0, Math.cos(look) + 0.12), squeeze = side === o.nearSide ? 0.55 + 0.45 * Math.min(1, cf * 1.3) : Math.max(0.0, 0.5 * Math.min(1, cf * 1.6));
  if (squeeze < 0.12) return;
  const ew = w * squeeze, oh = h * open;
  if (horror && headPx < 70) { // too far for an eye: a shadowed socket, no pupil, no glint
    c.save(); c.translate(cx, cy); c.rotate(tilt * side * -1); const g = c.createRadialGradient(0, 0, 0, 0, 0, ew * 1.5); g.addColorStop(0, rgba('#040302', 0.78)); g.addColorStop(1, rgba('#040302', 0)); c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, ew * 1.5, Math.max(h * 1.6, ew * 0.6), 0, 0, TAU); c.fill(); c.restore(); return;
  }
  c.save(); c.translate(cx, cy); c.rotate(tilt * side * -1);
  const top = (x) => -oh * 1.5 * (1 - Math.pow(x / ew, 2) * 0.7), bot = (x) => oh * 0.95 * (1 - Math.pow(x / ew, 2) * 0.85);
  const path = new Path2D(); path.moveTo(-ew, 0.006);
  path.bezierCurveTo(-ew * 0.55, -oh * 1.9, ew * 0.55, -oh * 1.9, ew, 0.006); path.bezierCurveTo(ew * 0.55, oh * 1.2, -ew * 0.55, oh * 1.2, -ew, 0.006); path.closePath();
  c.fillStyle = sclera; c.fill(path);
  c.save(); c.clip(path);
  // lid shadow on the sclera + iris
  const ir = h * 1.55 * (ghost ? 0.85 : 1) * (horror ? 0.82 : 1), gx = cl(gaze[0], -1, 1) * (ew - ir * 0.55) * 0.9, gy = cl(gaze[1], -1, 1) * oh * 0.55;
  c.fillStyle = iris; c.beginPath(); c.arc(gx, gy, ir, 0, TAU); c.fill();
  const ig = c.createRadialGradient(gx, gy + ir * 0.35, ir * 0.1, gx, gy, ir); ig.addColorStop(0, rgba('#ffffff', ghost ? 0.05 : 0.22)); ig.addColorStop(1, rgba('#000', 0.35)); c.fillStyle = ig; c.beginPath(); c.arc(gx, gy, ir, 0, TAU); c.fill();
  c.fillStyle = '#050403'; c.beginPath(); c.arc(gx, gy, ir * (ghost ? 0.38 : horror ? 0.4 : 0.52), 0, TAU); c.fill();
  const lg = c.createLinearGradient(0, -oh * 1.8, 0, oh * 0.4); lg.addColorStop(0, 'rgba(20,10,6,0.55)'); lg.addColorStop(0.5, 'rgba(20,10,6,0.08)'); lg.addColorStop(1, 'rgba(20,10,6,0)'); c.fillStyle = lg; c.fillRect(-ew, -oh * 2, ew * 2, oh * 3);
  if (horror) { const lg2 = c.createLinearGradient(0, -oh * 1.8, 0, oh); lg2.addColorStop(0, 'rgba(0,0,0,0.6)'); lg2.addColorStop(0.55, 'rgba(0,0,0,0.3)'); lg2.addColorStop(1, 'rgba(0,0,0,0.18)'); c.fillStyle = lg2; c.fillRect(-ew, -oh * 2, ew * 2, oh * 3); }
  if (!ghost && open > 0.35 && (!horror || eyeLight > 0.05)) { c.fillStyle = rgba('#fff', 0.95 * (horror ? Math.min(1, eyeLight) : 1)); c.beginPath(); c.arc(gx + (L.x >= 0 ? 1 : -1) * ir * 0.34, gy - ir * 0.36, Math.max(0.006, ir * (horror ? 0.15 : 0.24)), 0, TAU); c.fill(); c.fillStyle = rgba('#fff', horror ? 0 : 0.5); c.beginPath(); c.arc(gx - (L.x >= 0 ? 1 : -1) * ir * 0.3, gy + ir * 0.4, ir * 0.1, 0, TAU); c.fill(); }
  c.restore();
  c.strokeStyle = ink; c.lineCap = 'round'; c.lineWidth = Math.max(0.011, h * 0.36);
  c.beginPath(); c.moveTo(-ew, 0.006); c.bezierCurveTo(-ew * 0.55, -oh * 1.9, ew * 0.55, -oh * 1.9, ew, 0.006); c.stroke();
  c.lineWidth = h * 0.2; c.globalAlpha = 0.55; c.beginPath(); c.moveTo(-ew * 0.8, 0.012); c.bezierCurveTo(-ew * 0.5, oh * 1.15, ew * 0.5, oh * 1.15, ew * 0.85, 0.012); c.stroke(); c.globalAlpha = 1;
  // outer-corner lash flick
  c.lineWidth = h * 0.3; c.beginPath(); const ox = side * ew; c.moveTo(ox, 0.004); c.lineTo(ox + side * h * 0.55, -h * 0.35); c.stroke();
  c.restore();
}

// wet hair plastered down over the face: tapered strands from the hairline, one slit where a pale eye shows through
function veil(c, { seed, sx, ox, hairC, env, t, L }) {
  const r = mulberry32(seed * 17 + 3), gapSide = r() < 0.5 ? -1 : 1, gapX = gapSide * 0.185 * sx + ox, gapW = 0.06, N = 26, key = env.key ?? '#dfe8e0';
  const strands = [];
  for (let i = 0; i < N; i++) {
    const x0 = -0.5 * sx + ((i + (r() - 0.5) * 0.9) / (N - 1)) * 1.0 * sx, edge = Math.abs(x0) > 0.37 * sx, dg = Math.abs(x0 - gapX), inGap = dg < gapW;
    const len = inGap ? 0.0 + r() * 0.05 : edge ? 0.75 + r() * 0.9 : (0.18 + r() * 0.42) * (dg < 0.17 ? 0.7 : 1.0) + (r() < 0.25 ? 0.25 : 0);
    strands.push({ x0, y0: -0.62, y1: -0.3 + len + 0.12, bend: (r() - 0.5) * 0.09, w0: 0.07 + r() * 0.07, edge, hr: r() });
  }
  strands.sort((a, b) => a.y1 - b.y1); // long strands on top of short ones
  c.save();
  for (const s of strands) {
    const dir = Math.sign(s.x0) || 1, mid = [s.x0 + s.bend * 0.6 + (s.edge ? dir * 0.05 : 0), (s.y0 + s.y1) / 2], end = [s.x0 + s.bend + (s.edge ? dir * 0.03 : 0), s.y1];
    const rp = ribbon([[s.x0, s.y0], mid, end], [s.w0, s.w0 * 0.9, s.w0 * 0.12], { n: 10, cap: 1 }), path = smoothClosed(rp);
    const g = c.createLinearGradient(s.x0 - L.x * 0.08, 0, s.x0 + L.x * 0.08, 0); g.addColorStop(0, mix(hairC, key, 0.1)); g.addColorStop(0.45, hairC); g.addColorStop(1, shade(hairC, -0.25));
    c.fillStyle = g; c.fill(path); c.strokeStyle = rgba('#000', 0.3); c.lineWidth = 0.0035; c.stroke(path);
    const hy = s.y0 + (s.y1 - s.y0) * (0.55 + 0.25 * s.hr), hg = c.createRadialGradient(mid[0] + L.x * 0.012, hy, 0, mid[0] + L.x * 0.012, hy, 0.06);
    hg.addColorStop(0, rgba(key, 0.2)); hg.addColorStop(1, rgba(key, 0)); c.save(); c.clip(path); c.fillStyle = hg; c.fillRect(mid[0] - 0.1, hy - 0.08, 0.2, 0.16); c.restore();
  }
  c.restore();
}

function mouth(c, o) {
  const { x, y, w, m, skin, ink, L, ghost } = o;
  const lip = ghost ? (o.horror ? '#59635a' : '#5c6a72') : mix(skin, o.horror ? '#6a3532' : '#8e2f2f', o.horror ? 0.4 : 0.55), lipD = shade(lip, -0.35);
  c.save(); c.translate(x, y); c.lineCap = 'round'; c.lineJoin = 'round';
  const open = typeof m === 'number' ? m : { a: 0.85, o: 0.7, e: 0.4 }[m] ?? 0;
  if (open > 0.06) {
    const ww = w * (m === 'o' ? 0.55 : m === 'e' ? 1.08 : 0.9 + 0.1 * open), hh = w * 0.5 * open;
    const p = new Path2D(); p.moveTo(-ww, 0); p.bezierCurveTo(-ww * 0.5, -hh * 0.35, ww * 0.5, -hh * 0.35, ww, 0); p.bezierCurveTo(ww * 0.6, hh * 1.25, -ww * 0.6, hh * 1.25, -ww, 0); p.closePath();
    c.fillStyle = '#240c0c'; c.fill(p); c.save(); c.clip(p);
    if (m !== 'o' && !ghost) { c.fillStyle = '#efe8dc'; c.fillRect(-ww, -hh * 0.4, ww * 2, hh * 0.5); }
    c.fillStyle = ghost ? '#3b4650' : '#a8434a'; c.beginPath(); c.ellipse(0, hh * 1.0, ww * 0.55, hh * 0.45, 0, 0, TAU); c.fill(); c.restore();
    c.strokeStyle = lipD; c.lineWidth = w * 0.12; c.stroke(p);
    c.strokeStyle = rgba(lip, 0.9); c.lineWidth = w * 0.14; c.beginPath(); c.moveTo(-ww * 0.6, hh * 1.18); c.quadraticCurveTo(0, hh * 1.5, ww * 0.6, hh * 1.18); c.stroke();
  } else {
    const k = m === 'smile' ? 1 : m === 'frown' ? -1 : 0.12;
    c.strokeStyle = lipD; c.lineWidth = w * 0.13; c.beginPath(); c.moveTo(-w, -k * w * 0.1); c.quadraticCurveTo(0, w * 0.1 * (k > 0 ? 1.4 : 0.2) + (k < 0 ? -w * 0.18 : 0), w, -k * w * 0.1); c.stroke();
    c.strokeStyle = rgba(lip, 0.8); c.lineWidth = w * 0.22; c.beginPath(); c.moveTo(-w * 0.5, w * 0.17 - k * w * 0.02); c.quadraticCurveTo(0, w * 0.3 + (k < 0 ? -w * 0.12 : 0), w * 0.5, w * 0.17 - k * w * 0.02); c.stroke();
  }
  c.restore();
}

/**
 * Draw the head. o: {c:[x,y], size, asp, tilt, look, age, sex, skin, hair:{style,color}, expr, blinkOpen, gaze:[x,y]|null, mouth,
 * env:{L:{x,y}, key, amb, hard, strength, rim, rimW}, ghost, seed, t, ink, eyeColor, glasses, bindi, wetDrip}
 */
export function drawHead(c, o) {
  const { size: HS, age = 'adult', sex = 'm', look = 0.3, env, ghost = false, t = 0, seed = 1, horror = false, headPx = 999, eyeLight = 1 } = o;
  const ex = EXPR[o.expr ?? 'neutral'] ?? EXPR.neutral, sx = o.asp / 0.8, skin = o.skin, ink = shade(skin, -0.78);
  const L = { x: env.L.x, y: env.L.y }, Lf = env.Lf ?? L;
  const cosL = Math.cos(look), sinL = Math.sin(look), front = cosL > -0.12, ox = Math.sign(sinL || 1) * Math.min(1, Math.abs(sinL)) * 0.2 * sx;
  c.save(); c.translate(o.c[0], o.c[1]); c.rotate(o.tilt); c.scale(HS, HS);
  const hs = hairShapes(o.hair.style, age, sx), hairC = o.hair.color, hairStops = [[0, mix(shade(hairC, 0.18), env.key ?? '#fff', 0.08)], [0.45, hairC], [0.8, shade(hairC, -0.35)], [1, shade(hairC, -0.2)]];
  const hairFill = (pts, bb = [-0.6, -0.7, 0.6, 0.7]) => { const p = smoothClosed(pts); c.fillStyle = grad(c, bb, Lf, hairStops); c.fill(p); return p; };
  // --- back hair / bun
  if (hs.back) { const p = hairFill(hs.back); c.save(); c.clip(p); c.fillStyle = rgba('#000', 0.28); c.fillRect(-1, -1, 2, 2); c.restore(); cin.rimLight(c, p, { x: L.x, y: L.y }, { width: 0.018, color: env.rim ?? '#ffe3b8', alpha: 0.7 * (env.rimA ?? 1), soft: false }); }
  if (hs.bun) { const [bx, by, br] = hs.bun; c.fillStyle = grad(c, [bx - br, by - br, bx + br, by + br], L, hairStops); c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fill(); c.strokeStyle = rgba('#fff', 0.14); c.lineWidth = 0.012; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(bx, by, br * (0.4 + i * 0.22), 0.6, 2.6); c.stroke(); } }
  // --- ears
  const earY = 0.04;
  for (const s of [-1, 1]) {
    const visible = s * sinL < 0.55; if (!visible) continue;
    const ex_ = s * 0.42 * sx; c.fillStyle = shade(skin, -0.12); c.beginPath(); c.ellipse(ex_, earY, 0.07 * (age === 'child' ? 1.2 : 1), 0.1, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(shade(skin, -0.5), 0.55); c.lineWidth = 0.012; c.beginPath(); c.arc(ex_ + s * 0.005, earY, 0.04, -1.6, 1.4 * s); c.stroke();
  }
  // --- face
  const face = smoothClosed(outline(age, sex, o.asp)), bb = [-0.5 * sx, -0.5, 0.5 * sx, 0.54];
  c.fillStyle = grad(c, bb, Lf, formStops(skin, { ...env, hard: false, strength: (env.strength ?? 1) * 0.8 })); c.fill(face);
  c.save(); c.clip(face);
  if (front) {
    const k = 1, eyeY = age === 'child' ? 0.075 : 0.035, eyeX = 0.185 * sx, w = (age === 'child' ? 0.098 : 0.088) * (sex === 'f' ? 1.05 : 1) * (horror ? 0.86 : 1), h = (age === 'child' ? 0.055 : 0.044) * (horror ? 0.8 : 1);
    // soft shadow pockets: eye sockets, under nose, under lip, jaw
    for (const s of [-1, 1]) { const g = c.createRadialGradient(s * eyeX + ox, eyeY - 0.01, 0.01, s * eyeX + ox, eyeY - 0.01, 0.17); g.addColorStop(0, rgba(shade(skin, horror ? -0.85 : -0.6), horror ? (ghost ? 0.62 : 0.55) : ghost ? 0.4 : 0.22 * k)); g.addColorStop(1, rgba(shade(skin, -0.6), 0)); c.fillStyle = g; c.fillRect(s * eyeX + ox - 0.2, eyeY - 0.2, 0.4, 0.4); }
    if (horror) { const bg = c.createLinearGradient(0, -0.22, 0, 0.16); bg.addColorStop(0, rgba('#000', 0.62)); bg.addColorStop(0.55, rgba('#000', 0.38)); bg.addColorStop(1, rgba('#000', 0)); c.fillStyle = bg; c.fillRect(-0.6, -0.3, 1.2, 0.5); } // brow-ridge shadow: eyes sit in the dark
    const nY = eyeY + 0.17, mY = age === 'child' ? 0.3 : 0.305;
    c.globalAlpha = k;
    // cheeks blush / hollows
    if (!ghost && !horror && age !== 'elder') for (const s of [-1, 1]) { const g = c.createRadialGradient(s * 0.26 * sx + ox, 0.18, 0, s * 0.26 * sx + ox, 0.18, 0.14); g.addColorStop(0, rgba('#c0504a', 0.16)); g.addColorStop(1, rgba('#c0504a', 0)); c.fillStyle = g; c.fillRect(s * 0.26 * sx + ox - 0.2, 0, 0.4, 0.4); }
    if (age === 'elder') for (const s of [-1, 1]) { const g = c.createRadialGradient(s * 0.3 * sx + ox, 0.2, 0, s * 0.3 * sx + ox, 0.2, 0.15); g.addColorStop(0, rgba(shade(skin, -0.6), 0.28)); g.addColorStop(1, rgba(shade(skin, -0.6), 0)); c.fillStyle = g; c.fillRect(s * 0.3 * sx + ox - 0.2, 0.02, 0.4, 0.4); }
    // forehead wrinkles for elder
    if (age === 'elder') { c.strokeStyle = rgba(shade(skin, -0.6), 0.3); c.lineWidth = 0.008; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-0.2 * sx + ox, -0.2 + i * 0.045); c.quadraticCurveTo(ox, -0.215 + i * 0.045, 0.2 * sx + ox, -0.2 + i * 0.045); c.stroke(); } }
    const mood = o.expr ?? 'neutral';
    // brows
    const browCol = o.browColor ?? (age === 'elder' ? (horror ? '#9a968f' : '#d8d4cc') : shade(o.hair.color, horror ? -0.1 : 0.04));
    for (const s of [-1, 1]) {
      const bx = s * eyeX + ox, by = eyeY - 0.105 - ex.brow * 0.018, inner = s * (-0.1 * sx), slant = ex.slant;
      const pts = [[bx - s * 0.1 * sx - (s * 0.0), by + slant * 0.03 * (s === 1 ? 1 : 1)], [bx, by - 0.012 - Math.max(0, ex.brow) * 0.018], [bx + s * 0.11 * sx, by + 0.008 - slant * 0.012 + (mood === 'angry' ? 0.008 : 0)]];
      // inner end is the end nearest the nose: x = bx - s*0.1; raise it for worry/fear, lower for anger
      pts[0][1] = by - slant * 0.045 * (mood === 'angry' ? -1 : 1) * 1 + (mood === 'angry' ? 0.03 : 0);
      const rp = smoothClosed(ribbon(pts, [age === 'elder' ? 0.03 : 0.036, 0.034, 0.014], { n: 6, cap: 3 })); c.fillStyle = browCol; c.fill(rp);
    }
    // eyes
    const eyeCommon = { w, h, L, ghost, look, ink, horror, headPx, eyeLight, sclera: ghost ? (horror ? '#aeb6a8' : '#cfd6d2') : horror ? '#aaa395' : '#ece6da', iris: o.eyeColor ?? (ghost ? '#1a1d1f' : '#2b1a0f'), nearSide: sinL >= 0 ? -1 : 1 };
    const open = cl(o.blinkOpen * ex.open, 0, 1.4), gz = o.gaze ?? [0, 0];
    for (const s of [-1, 1]) eye(c, s, { ...eyeCommon, cx: s * eyeX + ox, cy: eyeY, open: Math.max(open, 0.04), gaze: [gz[0] + (ghost ? 0 : 0), gz[1]], tilt: ex.tilt });
    // nose: shadow on the side away from the light, tip highlight on the lit side
    c.lineCap = 'round'; const ns = L.x >= 0 ? -1 : 1, nx = ox * 1.25;
    c.strokeStyle = rgba(shade(skin, -0.62), 0.42); c.lineWidth = 0.014; c.beginPath(); c.moveTo(nx + ns * 0.04, eyeY + 0.05); c.quadraticCurveTo(nx + ns * 0.06, nY - 0.03, nx + ns * 0.045, nY); c.stroke();
    c.strokeStyle = rgba(shade(skin, -0.7), 0.6); c.lineWidth = 0.017; c.beginPath(); c.moveTo(nx - 0.05, nY + 0.012); c.quadraticCurveTo(nx, nY + 0.04, nx + 0.05, nY + 0.012); c.stroke();
    c.fillStyle = rgba(shade(skin, -0.7), 0.5); for (const s of [-1, 1]) { c.beginPath(); c.ellipse(nx + s * 0.028, nY + 0.018, 0.012, 0.007, 0, 0, TAU); c.fill(); }
    c.fillStyle = rgba(mix(skin, env.key ?? '#fff', 0.55), 0.35); c.beginPath(); c.ellipse(nx - ns * 0.014, nY - 0.02, 0.012, 0.03, 0, 0, TAU); c.fill();
    // mouth
    let m = o.mouth ?? ex.mouth; if (typeof m === 'string' && EXPR[m]) m = EXPR[m].mouth;
    mouth(c, { x: ox * 1.1, y: mY, w: (age === 'child' ? 0.085 : 0.1) * (sex === 'f' ? 0.92 : 1), m, skin, ink, L, ghost, horror });
    if (age === 'elder') { c.strokeStyle = rgba(shade(skin, -0.6), 0.3); c.lineWidth = 0.009; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(nx + s * 0.07, nY + 0.01); c.quadraticCurveTo(nx + s * 0.13, nY + 0.12, nx + s * 0.1, mY + 0.03); c.stroke(); } }
    if (o.bindi) { c.fillStyle = '#b3241f'; c.beginPath(); c.arc(ox, eyeY - 0.12, 0.016, 0, TAU); c.fill(); }
    if (ghost) { c.fillStyle = rgba('#10181c', 0.28); for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * eyeX + ox, eyeY + 0.07, 0.1, 0.04, 0, 0, TAU); c.fill(); } }
    if (o.glasses) { c.strokeStyle = '#1b1714'; c.lineWidth = 0.014; for (const s of [-1, 1]) { c.beginPath(); c.roundRect(s * eyeX + ox - 0.13, eyeY - 0.075, 0.26, 0.15, 0.04); c.stroke(); c.fillStyle = rgba('#cfe0ee', 0.1); c.fill(); } c.beginPath(); c.moveTo(ox - 0.05, eyeY - 0.02); c.lineTo(ox + 0.05, eyeY - 0.02); c.stroke(); }
    c.globalAlpha = 1;
  } else {
    // back of the head: just a darker skin tone under the hair
    c.fillStyle = rgba('#000', 0.3); c.fillRect(-1, -1, 2, 2);
  }
  // soft lit-side sheen
  c.globalCompositeOperation = 'screen'; const sg = c.createRadialGradient(L.x * 0.28 * sx, L.y * 0.2 - 0.06, 0.01, L.x * 0.28 * sx, L.y * 0.2 - 0.06, 0.4); sg.addColorStop(0, rgba(env.key ?? '#fff', horror ? 0.05 : ghost ? 0.1 : 0.14)); sg.addColorStop(1, rgba(env.key ?? '#fff', 0)); c.fillStyle = sg; c.fillRect(-1, -1, 2, 2); c.globalCompositeOperation = 'source-over';
  c.restore();
  cin.rimLight(c, face, { x: L.x, y: L.y }, { width: 0.016, color: env.rim ?? '#ffe3b8', alpha: 0.55 * (env.rimA ?? 1), soft: false });
  // --- front hair
  const drawFront = (pts) => {
    const p = hairFill(pts); c.save(); c.clip(p);
    // strand lines from the crown, light + dark
    const r = mulberry32(seed * 31 + 5); c.lineCap = 'round';
    for (let i = 0; i < 16; i++) { const a = -0.5 + (i / 15) * 1.0 * Math.PI + 0.0, rr = 0.2 + r() * 0.4, x0 = Math.cos(a - Math.PI / 2) * 0.1, y0 = -0.5 + r() * 0.06; c.strokeStyle = rgba(i % 2 ? shade(hairC, 0.3) : '#000', i % 2 ? 0.16 : 0.2); c.lineWidth = 0.007; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(Math.cos(a - Math.PI / 2) * rr * 0.9, -0.2, Math.cos(a - Math.PI / 2) * rr * 1.25, 0.0 + r() * 0.1); c.stroke(); }
    // sheen band
    c.globalCompositeOperation = 'screen'; const g = c.createLinearGradient(-0.3 * sx, -0.6, 0.35 * sx, -0.2); g.addColorStop(0, rgba('#fff', 0)); g.addColorStop(0.5, rgba(env.key ?? '#fff', hs.wet ? 0.5 : 0.22)); g.addColorStop(1, rgba('#fff', 0)); c.fillStyle = g; c.fillRect(-0.7, -0.8, 1.4, 0.8); c.globalCompositeOperation = 'source-over';
    c.restore();
    cin.rimLight(c, p, { x: L.x, y: L.y }, { width: 0.02, color: env.rim ?? '#ffe3b8', alpha: 0.85 * (env.rimA ?? 1), soft: true });
  };
  if (hs.bald) { drawFront(hs.front); drawFront(hs.front2); c.save(); c.globalCompositeOperation = 'screen'; const g = c.createRadialGradient(L.x * 0.16, -0.4, 0.01, L.x * 0.16, -0.4, 0.22); g.addColorStop(0, rgba(env.key ?? '#fff', 0.4)); g.addColorStop(1, rgba(env.key ?? '#fff', 0)); c.fillStyle = g; c.fillRect(-0.5, -0.7, 1, 0.5); c.restore(); }
  else if (cosL > -0.2 || true) drawFront(hs.front);
  if (hs.veil) veil(c, { seed, sx, ox, hairC, env, t, L });
  if (hs.part) { c.strokeStyle = rgba('#000', 0.45); c.lineWidth = 0.012; c.beginPath(); c.moveTo(hs.part[0] * sx + ox * 0.6, hs.part[1]); c.lineTo(hs.part[2] * sx + ox * 0.6, hs.part[3]); c.stroke(); }
  if (hs.wet) { // plastered locks over the forehead and temples, drips
    const lr = mulberry32(seed * 13 + 1); c.fillStyle = hairC;
    const locks = [[-0.44, -0.08, 0.2], [-0.32, -0.16, 0.14], [-0.2, -0.2, 0.17], [-0.06, -0.2, 0.12], [0.08, -0.2, 0.18], [0.22, -0.19, 0.12], [0.34, -0.14, 0.17], [0.45, -0.06, 0.24]];
    for (const [lx, ly, len] of locks) { const bend = (lr() - 0.5) * 0.07; c.beginPath(); c.moveTo(lx - 0.045, ly - 0.04); c.lineTo(lx + 0.045, ly - 0.04); c.bezierCurveTo(lx + 0.05 + bend, ly + len * 0.4, lx + 0.02 + bend, ly + len * 0.85, lx + bend * 1.4 + 0.006, ly + len); c.quadraticCurveTo(lx + bend * 1.4 - 0.012, ly + len * 0.9, lx - 0.03 + bend, ly + len * 0.5); c.bezierCurveTo(lx - 0.05, ly + len * 0.2, lx - 0.05, ly, lx - 0.045, ly - 0.04); c.fill(); c.strokeStyle = rgba('#dfeaf2', 0.5); c.lineWidth = 0.008; c.beginPath(); c.moveTo(lx + 0.015, ly); c.quadraticCurveTo(lx + 0.02 + bend, ly + len * 0.5, lx + bend, ly + len * 0.85); c.stroke(); }
    // drips: fall from the lock tips on a loop
    for (let i = 0; i < 4; i++) { const [lx, ly, len] = locks[i * 2 + 1 - (i === 3 ? 1 : 0)], ph = ((t * 0.45 + i * 0.27) % 1), y = ly + len + ph * 0.5; c.fillStyle = rgba('#cfe3f0', 0.8 * (1 - ph)); c.beginPath(); c.ellipse(lx, y, 0.008, 0.016, 0, 0, TAU); c.fill(); }
  }
  c.restore();
}
