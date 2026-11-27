// figures/cloth: outfits (school uniform, kurta, saree, coat, shirt). Each outfit has hooks the figure calls in draw order:
//   legCover(F, side, leg)  garment on a leg (or null)      torso(F)  the body garment incl. skirts/hems, folds, details
//   sleeve(F, arm)          garment on an arm (or null)     shoes: 'shoe' | 'chappal' | 'bare'
// F is the figure drawing context built in index.mjs: {c, B, J, env, part(), tp(), colors, skin, ghost, wet}.
import { ribbon, smoothClosed, shade, mix, rgba, lerp, cl, TAU, mulberry32, cin } from '../util.mjs';
const cinFill = (c, name, rect, o) => cin.fillTexture(c, name, rect, o);

// body outline in the spine frame: x across (+ = facing side), t along the spine (0 pelvis .. 1 neck base), below 0 hangs vertically
function outline(F, { chest = 0.9, waist = 0.74, hip = 1.5, hemT = 0.02, hemW = null, margin = 0.008, shoulder = 1.0, extra = {} } = {}) {
  const { B, J } = F, cw = J.cw, sw = B.sw * cw, f = B.sex === 'f', kid = B.age === 'child';
  const w = (r) => sw * r + margin;
  const shoulderW = w(shoulder), chestW = w(f ? chest * 0.88 : chest), waistW = w(f ? waist * 0.8 : kid ? 0.82 : waist), hipW = (B.hw * cw * (f ? 1.75 : 1.55) * hip / 1.5) + margin * 1.5 + 0.004;
  const R = [[0.05 * cw + 0.012, 1.0], [shoulderW * 0.82, 0.985], [shoulderW, 0.93], [chestW, 0.76], [waistW, 0.42], [hipW, 0.08]];
  const hw = hemW ?? hipW;
  R.push([hw, hemT]);
  const dt = (J.shTilt ?? 0) / B.torso; // uneven shoulders (horror ghost): the sgn=+1 side drops by dt, the other rises
  const toP = ([x, t], i) => F.tp(x, i === 1 || i === 2 ? t - dt : t), Rp = R.map(toP), Lp = R.slice().reverse().map(([x, t], i) => F.tp(-x, i === 4 || i === 5 ? t + dt : t));
  // the near shoulder gets a rounded deltoid, so the silhouette is not a coat hanger
  return [...Rp, ...Lp];
}
const outlineHem = (F, pts, hemY, hw, flare, sway) => { // append an absolute (vertical) hem under the pelvis: replaces last point pairs
  return pts;
};

function foldLines(c, F, base, seeds, { n = 4, y0 = 0.4, y1 = -0.05, spread = 0.06, a = 0.28 } = {}) {
  const r = mulberry32(seeds);
  c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) - 0.5) * 2 * spread * (1 + r() * 0.5) + (r() - 0.5) * 0.01, a0 = F.tp(x, y0), a1 = F.tp(x * 1.6 + (r() - 0.5) * 0.02, y1), m = [(a0[0] + a1[0]) / 2 + (r() - 0.5) * 0.02, (a0[1] + a1[1]) / 2];
    c.strokeStyle = rgba(shade(base, -0.7), a * (0.6 + r() * 0.6)); c.lineWidth = 0.007 + r() * 0.004; c.beginPath(); c.moveTo(a0[0], a0[1]); c.quadraticCurveTo(m[0], m[1], a1[0], a1[1]); c.stroke();
    c.strokeStyle = rgba(shade(base, 0.5), a * 0.55); c.lineWidth = 0.004; c.beginPath(); c.moveTo(a0[0] + F.env.L.x * 0.008, a0[1] + F.env.L.y * 0.008); c.quadraticCurveTo(m[0] + F.env.L.x * 0.008, m[1] + F.env.L.y * 0.008, a1[0] + F.env.L.x * 0.008, a1[1] + F.env.L.y * 0.008); c.stroke();
  }
}
const creases = (c, pts, base, a = 0.3, k = 3, w = 0.012) => { // short crescent wrinkles across a limb at a joint
  c.strokeStyle = rgba(shade(base, -0.7), a); c.lineWidth = 0.005; c.lineCap = 'round';
  for (let i = 0; i < k; i++) { const dy = (i - (k - 1) / 2) * 0.012; c.beginPath(); c.moveTo(pts[0] - w, pts[1] + dy); c.quadraticCurveTo(pts[0], pts[1] + dy + 0.008, pts[0] + w, pts[1] + dy); c.stroke(); }
};
function legGarment(F, side, leg, kind, color, o = {}) {
  const { B, c } = F, w = B.w;
  if (kind === 'none') return;
  const hip = leg.hip, knee = leg.knee, ank = leg.ank;
  let pts, ws;
  if (kind === 'shorts') { const m = [lerp(hip[0], knee[0], 0.7), lerp(hip[1], knee[1], 0.7)]; pts = [hip, m]; ws = [w.th + 0.026, w.th * 0.96 + 0.026]; }
  else if (kind === 'skirtleg') return;
  else { const end = [lerp(knee[0], ank[0], o.upTo ?? 0.96), lerp(knee[1], ank[1], o.upTo ?? 0.96)]; pts = [hip, knee, end]; ws = [w.th + 0.022, w.sh + 0.02 + (o.loose ?? 0), (kind === 'churidar' ? w.sh * 0.62 : w.sh * 0.88) + 0.012 + (o.loose ?? 0) * 0.5]; }
  const rp = ribbon(pts, ws, { n: 8, bulge: 0.04, cap: 1 });
  F.part(rp, color, { tex: 'fabric', fold: (c2) => {
    c2.strokeStyle = rgba(shade(color, -0.7), 0.3); c2.lineWidth = 0.005; c2.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const dy = i * 0.014; c2.beginPath(); c2.moveTo(knee[0] - 0.03, knee[1] + 0.01 + dy); c2.quadraticCurveTo(knee[0] + 0.006, knee[1] + 0.02 + dy, knee[0] + 0.03, knee[1] + 0.008 + dy); c2.stroke(); }
    if (kind === 'churidar') for (let i = 0; i < 5; i++) { const y = lerp(knee[1], ank[1], 0.62 + i * 0.07); c2.beginPath(); c2.moveTo(ank[0] - 0.03, y); c2.quadraticCurveTo(ank[0], y + 0.007, ank[0] + 0.03, y); c2.stroke(); }
    c2.strokeStyle = rgba(shade(color, -0.7), 0.25); c2.beginPath(); c2.moveTo(lerp(hip[0], knee[0], 0.4), lerp(hip[1], knee[1], 0.4)); c2.lineTo(lerp(knee[0], ank[0], 0.8), lerp(knee[1], ank[1], 0.8)); c2.stroke();
  } });
}
function sleeveHorror(F, arm, color, loose) { // cotton kurta sleeve: woven texture, long pulled folds, elbow wrinkles, a stitched cuff band with a button
  const { B, env } = F, H = F.H, [sx, sy] = arm.S, [ex, ey] = arm.E, [wx, wy] = arm.W, r = mulberry32(59);
  const ws = [B.w.ua + loose * 2 + 0.01, B.w.fa + loose * 1.6 + 0.006, B.w.fa * 0.82 + loose];
  F.part(ribbon([arm.S, arm.E, arm.W], ws, { n: 8, bulge: 0.05, cap: 1 }), color, { tex: false, across: [arm.S, arm.W], acrossW: ws[0], fold: (c2) => {
    cinFill(c2, 'plaster', [-0.9, -1.3, 1.8, 1.6], { blend: 'overlay', alpha: 0.5, scale: 2.2 / H, seed: 3 });
    const seg = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    c2.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const o = (i - 2) * 0.012, a = seg(arm.S, arm.E, 0.08), b = seg(arm.E, arm.W, 0.72), m = arm.E; const nx = -(wy - sy), ny = wx - sx, nl = Math.hypot(nx, ny) || 1;
      c2.strokeStyle = rgba('#000', 0.2 + 0.08 * (i % 2)); c2.lineWidth = 0.009; c2.beginPath(); c2.moveTo(a[0] + nx / nl * o, a[1] + ny / nl * o); c2.quadraticCurveTo(m[0] + nx / nl * o * 1.8, m[1] + ny / nl * o * 1.8, b[0] + nx / nl * o * 0.8, b[1] + ny / nl * o * 0.8); c2.stroke();
      c2.strokeStyle = rgba(mix(color, env.key ?? '#fff', 0.5), 0.12); c2.lineWidth = 0.005; c2.beginPath(); c2.moveTo(a[0] + nx / nl * (o + 0.006), a[1] + ny / nl * (o + 0.006)); c2.quadraticCurveTo(m[0] + nx / nl * (o * 1.8 + 0.006), m[1] + ny / nl * (o * 1.8 + 0.006), b[0] + nx / nl * (o * 0.8 + 0.006), b[1] + ny / nl * (o * 0.8 + 0.006)); c2.stroke(); }
    for (let i = 0; i < 6; i++) { c2.strokeStyle = rgba(shade(color, -0.75), 0.38); c2.lineWidth = 0.0055; const k = (i - 2.5) * 0.011, ang = Math.atan2(wy - ey, wx - ex) + 0.0; c2.beginPath(); c2.moveTo(ex - 0.034 + Math.cos(ang) * k * 0.4 - Math.sin(ang) * 0.0, ey + k - 0.002); c2.quadraticCurveTo(ex + 0.002, ey + k + 0.014, ex + 0.034, ey + k - 0.002); c2.stroke(); }
  } });
  const k0 = 0.83, a = [ex + (wx - ex) * k0, ey + (wy - ey) * k0], cw = B.w.fa * 0.86 + loose * 0.6 + 0.004;
  F.part(ribbon([a, arm.W], [cw, cw * 0.98], { n: 3, cap: 2 }), shade(color, 0.05), { tex: false, fold: (c2) => {
    c2.setLineDash([0.006, 0.005]); c2.strokeStyle = rgba(shade(color, -0.7), 0.55); c2.lineWidth = 0.003; c2.beginPath(); c2.moveTo(a[0], a[1]); c2.lineTo(arm.W[0], arm.W[1]); c2.stroke(); c2.setLineDash([]);
    c2.fillStyle = '#d8d0bb'; c2.beginPath(); c2.arc((a[0] + arm.W[0]) / 2, (a[1] + arm.W[1]) / 2, 0.006, 0, TAU); c2.fill();
  } });
}
function sleeve(F, arm, color, { len = 1, loose = 0.012, cuff = null, horror = false } = {}) {
  if (horror && len >= 1 && F.env.horror) return sleeveHorror(F, arm, color, loose);
  const { B } = F, end = len >= 1 ? arm.W : [lerp(arm.S[0], arm.E[0], len), lerp(arm.S[1], arm.E[1], len)];
  const pts = len >= 1 ? [arm.S, arm.E, arm.W] : [arm.S, end];
  const ws = len >= 1 ? [B.w.ua + loose * 2 + 0.01, B.w.fa + loose * 1.6 + 0.006, B.w.fa * 0.82 + loose] : [B.w.ua + loose * 2 + 0.01, B.w.ua * 0.95 + loose * 2];
  const rp = ribbon(pts, ws, { n: 8, bulge: 0.05, cap: 1 });
  F.part(rp, color, { tex: 'fabric', fold: (c2) => {
    if (len >= 1) creases(c2, [arm.E[0], arm.E[1]], color, 0.34, 3, 0.03);
    else { c2.strokeStyle = rgba(shade(color, -0.7), 0.28); c2.lineWidth = 0.005; c2.beginPath(); c2.moveTo(arm.S[0], arm.S[1] + 0.02); c2.lineTo(end[0], end[1] - 0.01); c2.stroke(); }
    if (cuff) { c2.strokeStyle = cuff; c2.lineWidth = 0.012; c2.beginPath(); c2.arc(end[0], end[1], 0.026, 0, TAU); c2.stroke(); }
  } });
}


// horror kurta: woven cotton, a stitched placket with real buttons, a collar opening, body folds that pull around the waist, chest pocket, side seams
function kurtaDetail(F, c2, base, hemY) {
  const { J, B, env } = F, H = F.H, r = mulberry32(41);
  const cwq = (x, t) => F.tp(x * J.cw, t);
  // woven texture (fine cotton)
  cinFill(c2, 'plaster', [-0.8, -1.2, 1.6, 1.4], { blend: 'overlay', alpha: 0.5, scale: 2.2 / H, seed: 3 }); cinFill(c2, 'fabric', [-0.8, -1.2, 1.6, 1.4], { blend: 'overlay', alpha: 0.22, scale: 2.4 / H, seed: 3 });
  // broad soft fold bands (light + shade), vertical, following the body: gives the torso volume instead of a flat panel
  for (let i = -3; i <= 3; i++) {
    const x0 = i * 0.032 + (r() - 0.5) * 0.012, a = cwq(x0, 0.82), b = cwq(x0 * 1.5 + (i < 0 ? -0.012 : 0.012), 0.0), w = 0.02 + r() * 0.012;
    const g = c2.createLinearGradient(a[0] - w, 0, a[0] + w, 0); g.addColorStop(0, rgba('#000', 0)); g.addColorStop(0.45, rgba('#000', 0.2 + 0.06 * (i % 2))); g.addColorStop(0.62, rgba(mix(base, env.key ?? '#fff', 0.5), 0.1)); g.addColorStop(1, rgba('#000', 0));
    c2.fillStyle = g; c2.beginPath(); c2.moveTo(a[0] - w, a[1]); c2.lineTo(a[0] + w, a[1]); c2.lineTo(b[0] + w * 1.2, b[1]); c2.lineTo(b[0] - w * 1.2, b[1]); c2.closePath(); c2.fill();
  }
  // sitting creases: arcs across the belly where the cloth bunches
  c2.lineCap = 'round';
  for (let i = 0; i < 4; i++) { const t = 0.34 - i * 0.07, a = cwq(-0.11 - i * 0.012, t), b = cwq(0.11 + i * 0.012, t - 0.015), m = cwq(0.0, t + 0.035); c2.strokeStyle = rgba(shade(base, -0.75), 0.34); c2.lineWidth = 0.006; c2.beginPath(); c2.moveTo(a[0], a[1]); c2.quadraticCurveTo(m[0], m[1], b[0], b[1]); c2.stroke(); c2.strokeStyle = rgba(mix(base, env.key ?? '#fff', 0.5), 0.14); c2.lineWidth = 0.004; c2.beginPath(); c2.moveTo(a[0], a[1] + 0.006); c2.quadraticCurveTo(m[0], m[1] + 0.006, b[0], b[1] + 0.006); c2.stroke(); }
  // placket: a stitched strip from the collar to the belly with five buttons
  const pw = 0.021, top = 0.985, bot = 0.12, p0 = cwq(0.004, top), p1 = cwq(0.004, bot);
  const strip = [[p0[0] - pw, p0[1]], [p0[0] + pw, p0[1]], [p1[0] + pw, p1[1]], [p1[0] - pw, p1[1]]];
  c2.fillStyle = rgba(mix(base, '#ffffff', 0.12), 0.9); c2.beginPath(); strip.forEach((p, i) => (i ? c2.lineTo(p[0], p[1]) : c2.moveTo(p[0], p[1]))); c2.closePath(); c2.fill();
  c2.strokeStyle = rgba(shade(base, -0.7), 0.62); c2.lineWidth = 0.0036; c2.stroke();
  c2.setLineDash([0.007, 0.006]); c2.strokeStyle = rgba(shade(base, -0.6), 0.55); c2.lineWidth = 0.0028;
  for (const k of [-0.72, 0.72]) { c2.beginPath(); c2.moveTo(p0[0] + k * pw, p0[1]); c2.lineTo(p1[0] + k * pw, p1[1]); c2.stroke(); }
  c2.setLineDash([]);
  c2.strokeStyle = rgba(shade(base, -0.85), 0.8); c2.lineWidth = 0.004; c2.beginPath(); c2.moveTo(p0[0] + 0.0, p0[1]); c2.lineTo(p1[0], p1[1]); c2.stroke();   // the opening seam
  for (let i = 0; i < 5; i++) {
    const q = cwq(0.004, 0.9 - i * 0.155), br = 0.0125;
    c2.fillStyle = rgba('#000', 0.35); c2.beginPath(); c2.arc(q[0] + 0.002, q[1] + 0.003, br * 1.12, 0, TAU); c2.fill();
    const bg = c2.createRadialGradient(q[0] - br * 0.3, q[1] - br * 0.3, 0, q[0], q[1], br); bg.addColorStop(0, '#f1ead6'); bg.addColorStop(1, '#8d846e'); c2.fillStyle = bg; c2.beginPath(); c2.arc(q[0], q[1], br, 0, TAU); c2.fill();
    c2.strokeStyle = rgba('#1c1710', 0.8); c2.lineWidth = 0.0026; c2.stroke(); c2.fillStyle = rgba('#1c1710', 0.85); for (const [dx, dy] of [[-0.0035, -0.0032], [0.0035, -0.0032], [-0.0035, 0.0036], [0.0035, 0.0036]]) { c2.beginPath(); c2.arc(q[0] + dx, q[1] + dy, 0.0014, 0, TAU); c2.fill(); }
  }
  // V opening at the neck (the collar band stands up around it) + a stitched chest pocket on the wearer's left and a side seam
  const n0 = cwq(-0.05, 1.0), n1 = cwq(0.05, 1.0), n2 = cwq(0.004, 0.86); c2.fillStyle = rgba('#050403', 0.78); c2.beginPath(); c2.moveTo(n0[0], n0[1]); c2.lineTo(n1[0], n1[1]); c2.lineTo(n2[0], n2[1]); c2.closePath(); c2.fill();
  const k0 = cwq(-0.19, 0.64), k1 = cwq(-0.08, 0.64), k2 = cwq(-0.08, 0.5), k3 = cwq(-0.19, 0.5); c2.strokeStyle = rgba(shade(base, -0.7), 0.5); c2.lineWidth = 0.0034; c2.setLineDash([0.006, 0.005]); c2.beginPath(); c2.moveTo(k0[0], k0[1]); c2.lineTo(k1[0], k1[1]); c2.lineTo(k2[0], k2[1]); c2.lineTo(k3[0], k3[1]); c2.stroke(); c2.setLineDash([]);
  for (const s of [-1, 1]) { const a = cwq(s * 0.2, 0.5), b = cwq(s * 0.25, -0.2); c2.strokeStyle = rgba(shade(base, -0.7), 0.3); c2.lineWidth = 0.004; c2.beginPath(); c2.moveTo(a[0], a[1]); c2.lineTo(b[0], b[1]); c2.stroke(); }
}
function cin_fill(c2, rect, scale, alpha, seed) { cinFill(c2, 'fabric', rect, { blend: 'overlay', alpha, scale, seed }); }

// A wool shawl draped over one shoulder: a collar roll round the neck and a hanging panel with a woven border, folds and a fringe.
// o: {color, accent, side (-1 far / +1 near shoulder), drop (hang length, local), fringe}
export function drawShawl(F, o = {}) {
  const { c, J, B, env } = F, H = F.H, col = o.color ?? '#6a5a48', acc = o.accent ?? '#b98a4a', s = o.side ?? -1, drop = o.drop ?? 0.27, r = mulberry32(o.seed ?? 5);
  const v = J.side, u = J.up, N = J.N, sh = s < 0 ? J.AL.S : J.AR.S, out = [v[0] * s, v[1] * s];
  const at = (b, ko, ku) => [b[0] + out[0] * ko + u[0] * ku, b[1] + out[1] * ko + u[1] * ku];
  const roll = [at(N, 0.075 * J.cw * 1.0 * -1 * -1, 0.026), at(N, 0.0, 0.052), at(N, -0.062, 0.03), at(N, -0.07, -0.012), at(N, 0.0, -0.034), at(N, 0.085, -0.012)];
  const pts = [at(N, 0.0, 0.05), at(sh, 0.035, 0.05), at(sh, 0.07, -0.01), at(sh, 0.078, -0.1), at(sh, 0.074, -drop * 0.8), at(sh, 0.058, -drop), at(sh, 0.015, -drop - 0.01), at(sh, -0.025, -drop * 0.96), at(sh, -0.04, -drop * 0.6), at(N, -0.035, -0.05), at(N, -0.058, 0.0)];
  // contact shadow on the kurta below the drape
  if (c.fill) { c.save(); c.fillStyle = rgba('#000', 0.3); c.beginPath(); pts.forEach((p, i) => { const q = [p[0] + 0.012, p[1] + 0.016]; i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); c.fill(); c.restore(); }
  const wool = (c2, poly) => {
    cinFill(c2, 'fabric', [-0.9, -1.3, 1.8, 1.6], { blend: 'overlay', alpha: 0.55, scale: 3.4 / H, seed: 12 });
    cinFill(c2, 'plaster', [-0.9, -1.3, 1.8, 1.6], { blend: 'soft-light', alpha: 0.6, scale: 5 / H, seed: 6 });
    // check lines: a loose plaid so it reads as woven wool, not a flat blanket
    c2.lineCap = 'butt'; c2.strokeStyle = rgba(shade(col, 0.55), 0.18); c2.lineWidth = 0.0032;
    const a0 = at(sh, 0.0, 0.1), step = 0.034;
    for (let i = -6; i < 14; i++) { const q = at(sh, 0.12 - i * step * 0.62, 0.1 - i * step); c2.beginPath(); c2.moveTo(q[0] - u[1] * 0.4, q[1] + u[0] * 0.4); c2.lineTo(q[0] + u[1] * 0.4, q[1] - u[0] * 0.4); c2.stroke(); }
    c2.strokeStyle = rgba(shade(col, -0.7), 0.22); for (let i = -4; i < 10; i++) { const q = at(sh, 0.12 - i * step * 0.9, 0.1); c2.beginPath(); c2.moveTo(q[0], q[1] + 0.5); c2.lineTo(q[0] - out[0] * 0.01, q[1] - 0.8); c2.stroke(); }
    // woven border bands along the hem and the outer edge
    for (const [ko, w, cc, a] of [[0.0, 0.016, acc, 0.9], [0.022, 0.006, shade(col, -0.7), 0.8], [-0.012, 0.005, shade(acc, 0.3), 0.7]]) {
      const hemA = at(sh, 0.1, -drop + 0.03 + ko), hemB = at(sh, -0.08, -drop + 0.03 + ko); c2.strokeStyle = rgba(cc, a); c2.lineWidth = w; c2.beginPath(); c2.moveTo(hemA[0], hemA[1]); c2.quadraticCurveTo((hemA[0] + hemB[0]) / 2, (hemA[1] + hemB[1]) / 2 + 0.004, hemB[0], hemB[1]); c2.stroke();
    }
    // folds: soft dark / light pairs from the shoulder to the hem
    for (let i = 0; i < 5; i++) {
      const k0 = -0.03 + i * 0.026, a = at(sh, k0, 0.03), b = at(sh, k0 + (i - 2) * 0.012, -drop * 0.92), m = at(sh, k0 + (r() - 0.5) * 0.02, -drop * 0.45);
      c2.strokeStyle = rgba('#000', 0.34); c2.lineWidth = 0.011; c2.beginPath(); c2.moveTo(a[0], a[1]); c2.quadraticCurveTo(m[0], m[1], b[0], b[1]); c2.stroke();
      c2.strokeStyle = rgba(mix(col, env.key ?? '#fff', 0.55), 0.18); c2.lineWidth = 0.006; c2.beginPath(); c2.moveTo(a[0] + out[0] * 0.013, a[1] + out[1] * 0.013); c2.quadraticCurveTo(m[0] + out[0] * 0.013, m[1] + out[1] * 0.013, b[0] + out[0] * 0.013, b[1] + out[1] * 0.013); c2.stroke();
    }
  };
  F.part(roll, shade(col, -0.1), { tex: false, fold: (c2) => wool(c2) });
  F.part(pts, col, { tex: false, fold: (c2) => wool(c2) });
  // fringe: twisted tassels hanging from the hem, then a soft fuzz along the shoulder edge
  const hemA = at(sh, 0.07, -drop), hemB = at(sh, -0.04, -drop * 0.97), n = o.fringe ?? 16;
  c.save(); c.lineCap = 'round';
  for (let i = 0; i < n; i++) { const k = i / (n - 1), x = hemA[0] + (hemB[0] - hemA[0]) * k, y = hemA[1] + (hemB[1] - hemA[1]) * k, len = 0.03 + r() * 0.022, bend = (r() - 0.5) * 0.012;
    c.strokeStyle = rgba(i % 2 ? shade(col, -0.45) : mix(acc, col, 0.4), 0.95); c.lineWidth = 0.0045; c.beginPath(); c.moveTo(x, y - 0.004); c.quadraticCurveTo(x + bend, y + len * 0.5, x + bend * 1.6 + u[0] * 0, y + len); c.stroke(); }
  c.restore();
  return pts;
}

// ---------------------------------------------------------------- outfits
export const OUTFITS = {
  // white half-sleeve shirt, navy shorts (boy / child) or pinafore skirt (girl), tie, black shoes + white socks
  uniform: {
    shoes: 'shoe', defaults: { a: '#ebe8de', b: '#1f2b52', c: '#8c2027' },
    legCover(F, side, leg) { if (F.B.sex === 'f') return; legGarment(F, side, leg, F.B.age === 'child' ? 'shorts' : 'pants', F.colors.b, { loose: 0.002 }); },
    sock: true,
    torso(F) {
      const { c, colors, B, J } = F, f = B.sex === 'f';
      // skirt / pinafore or shirt tail over shorts
      if (f) {
        const hipP = F.tp(0, 0.1), lw = B.hw * J.cw * 2.4, hemY = J.P[1] + B.thigh * 0.8, sway = (J.L.thighA + J.R.thighA) * 0.02;
        const pts = [F.tp(-B.hw * 1.8 * J.cw, 0.46), F.tp(B.hw * 1.8 * J.cw, 0.46), [hipP[0] + lw + 0.015 + sway, hemY - 0.01], [hipP[0] + lw * 0.6 + sway, hemY + 0.008], [hipP[0], hemY + 0.014], [hipP[0] - lw * 0.6 + sway, hemY + 0.008], [hipP[0] - lw - 0.015 + sway, hemY - 0.01]];
        F.part(pts, colors.b, { tex: 'fabric', fold: (c2) => { for (let i = -3; i <= 3; i++) { c2.strokeStyle = rgba(shade(colors.b, -0.65), 0.3); c2.lineWidth = 0.005; c2.beginPath(); const a = F.tp(i * 0.018, 0.3); c2.moveTo(a[0], a[1]); c2.quadraticCurveTo(a[0] + i * 0.006, (a[1] + hemY) / 2, hipP[0] + i * lw * 0.32 + sway, hemY); c2.stroke(); } } });
      }
      const pts = outline(F, { chest: 0.92, waist: 0.82, hip: 1.45, hemT: f ? 0.2 : 0.04 });
      F.part(pts, colors.a, { tex: 'fabric', fold: (c2) => {
        foldLines(c2, F, colors.a, 11, { n: 4, y0: 0.5, y1: 0.1, spread: 0.05 });
        // belt for shorts, pocket + collar + tie
        if (!f) { c2.fillStyle = shade(colors.b, -0.3); const a = F.tp(-0.12, 0.08), b = F.tp(0.12, 0.08); c2.strokeStyle = shade(colors.b, -0.5); c2.lineWidth = 0.014; c2.beginPath(); c2.moveTo(a[0], a[1]); c2.lineTo(b[0], b[1]); c2.stroke(); }
        const pk = F.tp(0.07 * J.cw, 0.7); c2.strokeStyle = rgba(shade(colors.a, -0.5), 0.5); c2.lineWidth = 0.005; c2.strokeRect(pk[0] - 0.02, pk[1] - 0.02, 0.04, 0.045);
        // tie
        const t0 = F.tp(0, 0.98), t1 = F.tp(0.012 * J.cw, 0.5), t2 = F.tp(0.0, 0.42);
        c2.fillStyle = colors.c; c2.beginPath(); c2.moveTo(t0[0] - 0.014, t0[1]); c2.lineTo(t0[0] + 0.014, t0[1]); c2.lineTo(t1[0] + 0.022, t1[1]); c2.lineTo(t2[0], t2[1]); c2.lineTo(t1[0] - 0.022, t1[1]); c2.closePath(); c2.fill();
        c2.strokeStyle = rgba('#000', 0.35); c2.lineWidth = 0.004; c2.stroke();
      } });
      // collar points
      const n0 = F.tp(0, 1.02), cl_ = [[F.tp(-0.012, 1.02), F.tp(-0.06 * J.cw - 0.01, 0.9), F.tp(-0.015, 0.86)], [F.tp(0.012, 1.02), F.tp(0.06 * J.cw + 0.01, 0.9), F.tp(0.015, 0.86)]];
      for (const tri of cl_) F.part(tri.map((p) => [p[0], p[1]]), shade(colors.a, 0.08), { sharp: true, tex: null, ink: true });
    },
    sleeve(F, arm) { sleeve(F, arm, F.colors.a, { len: 0.55, loose: 0.01 }); },
  },
  // long kurta to the knee with a band collar and placket + loose pyjama
  kurta: {
    shoes: 'chappal', defaults: { a: '#cdb98f', b: '#e8e2d2', c: '#6b4a2a' },
    legCover(F, side, leg) { legGarment(F, side, leg, 'churidar', F.colors.b, { loose: 0.012 }); },
    torso(F) {
      const { colors, B, J } = F, base = colors.a;
      const top = outline(F, { chest: 0.95, waist: 0.9, hip: 1.45, hemT: 0.0, margin: 0.012 });
      const hemY = J.P[1] + B.thigh * 0.95, sway = (J.L.thighA + J.R.thighA) * 0.03, hw = B.hw * J.cw * 2.15 + 0.012;
      const n = top.length / 2, right = top.slice(0, n - 1), left = top.slice(n + 1);
      const hemP = [[hw + 0.012 + sway, hemY - 0.01], [hw * 0.5 + sway, hemY + 0.01], [sway, hemY + 0.014], [-hw * 0.5 + sway, hemY + 0.01], [-hw - 0.012 + sway, hemY - 0.01]];
      const pts = [...right, ...hemP, ...left];
      F.part(pts, base, { tex: F.env.horror ? false : 'fabric', fold: (c2) => {
        if (F.env.horror) kurtaDetail(F, c2, base, hemY);
        foldLines(c2, F, base, 17, { n: 5, y0: 0.45, y1: -0.45, spread: 0.07 });
        if (!F.env.horror) { const a = F.tp(0.004, 0.98), b = F.tp(0.004, -0.4); c2.strokeStyle = rgba(shade(base, -0.6), 0.55); c2.lineWidth = 0.006; c2.beginPath(); c2.moveTo(a[0], a[1]); c2.lineTo(b[0], b[1]); c2.stroke(); }
        if (!F.env.horror) for (let i = 0; i < 4; i++) { const p = F.tp(0.004, 0.86 - i * 0.2); c2.fillStyle = shade(base, -0.45); c2.beginPath(); c2.arc(p[0], p[1], 0.008, 0, TAU); c2.fill(); }
        const pkR = F.tp(0.1 * J.cw + 0.02, -0.08); c2.strokeStyle = rgba(shade(base, -0.6), 0.35); c2.lineWidth = 0.005; c2.beginPath(); c2.moveTo(pkR[0] - 0.03, pkR[1] - 0.04); c2.lineTo(pkR[0], pkR[1] + 0.05); c2.stroke();
        // hem hang shadow
        const g = c2.createLinearGradient(0, hemY - 0.18, 0, hemY + 0.02); g.addColorStop(0, rgba('#000', 0)); g.addColorStop(1, rgba('#000', 0.18)); c2.fillStyle = g; c2.fillRect(-0.4, hemY - 0.18, 0.8, 0.22);
      } });
      // mandarin collar
      const nb = F.tp(0, 1.01); F.part(ribbon([F.tp(-0.058 * J.cw - 0.01, 0.99), F.tp(0, 1.0 - 0.006), F.tp(0.058 * J.cw + 0.01, 0.99)], [0.022, 0.022, 0.022], { n: 6, cap: 2 }), shade(base, 0.06), { tex: null });
    },
    sleeve(F, arm) { sleeve(F, arm, F.colors.a, { len: 1, loose: 0.016, horror: true }); },
  },
  saree: {
    shoes: 'bare', defaults: { a: '#8c2b3f', b: '#d9a441', c: '#e8c36a' },
    legCover() {},
    torso(F) {
      const { c, colors, B, J } = F, sarees = colors.a, blouse = colors.b, trim = colors.c;
      const hemY = -0.012, w0 = B.hw * J.cw * 1.9, hipC = F.tp(0, 0.1), sway = (J.L.thighA + J.R.thighA) * 0.025;
      const sk = [F.tp(-B.hw * 1.8 * J.cw, 0.5), F.tp(B.hw * 1.8 * J.cw, 0.5), [hipC[0] + w0 + 0.03 + sway + J.R.thighA * 0.06, hemY - 0.03], [hipC[0] + w0 * 0.55 + sway, hemY], [hipC[0] + sway, hemY + 0.006], [hipC[0] - w0 * 0.55 + sway, hemY], [hipC[0] - w0 - 0.03 + sway + J.L.thighA * 0.06, hemY - 0.03]];
      F.part(sk, sarees, { tex: 'fabric', fold: (c2) => {
        for (let i = -4; i <= 4; i++) { const a = F.tp(i * 0.012, 0.46), b = [hipC[0] + i * w0 * 0.26 + sway, hemY - 0.004]; c2.strokeStyle = rgba(shade(sarees, -0.65), 0.3 + (Math.abs(i) < 2 ? 0.1 : 0)); c2.lineWidth = 0.006; c2.beginPath(); c2.moveTo(a[0], a[1]); c2.quadraticCurveTo(a[0] + i * 0.004, (a[1] + b[1]) / 2, b[0], b[1]); c2.stroke(); c2.strokeStyle = rgba(shade(sarees, 0.45), 0.18); c2.lineWidth = 0.004; c2.beginPath(); c2.moveTo(a[0] + 0.006, a[1]); c2.quadraticCurveTo(a[0] + i * 0.004 + 0.006, (a[1] + b[1]) / 2, b[0] + 0.006, b[1]); c2.stroke(); }
        c2.fillStyle = trim; c2.fillRect(-0.5, hemY - 0.04, 1, 0.03); c2.fillStyle = shade(sarees, -0.4); c2.fillRect(-0.5, hemY - 0.052, 1, 0.01);
      } });
      // blouse
      const bl = outline(F, { chest: 0.92, waist: 0.82, hip: 1.1, hemT: 0.34, margin: 0.006 });
      F.part(bl, blouse, { tex: 'fabric', fold: (c2) => { foldLines(c2, F, blouse, 5, { n: 3, y0: 0.7, y1: 0.4, spread: 0.04 }); } });
      // pallu: diagonal drape from the far shoulder over the chest to the near hip and a hanging end
      const p0 = F.tp(-B.sw * J.cw * 0.95, 0.98), p1 = F.tp(B.sw * J.cw * 0.3, 0.62), p2 = F.tp(B.hw * J.cw * 1.4, 0.2), p3 = F.tp(B.hw * J.cw * 1.6 + 0.02, -0.4 + 0.0);
      F.part(ribbon([p0, p1, p2, p3], [0.07, 0.078, 0.085, 0.09], { n: 10 }), shade(sarees, 0.06), { tex: 'fabric', fold: (c2) => { c2.strokeStyle = trim; c2.lineWidth = 0.012; c2.beginPath(); c2.moveTo(p1[0] - 0.03, p1[1] - 0.04); c2.quadraticCurveTo(p2[0] - 0.02, p2[1], p3[0] - 0.035, p3[1] + 0.04); c2.stroke(); foldLines(c2, F, sarees, 9, { n: 3, y0: 0.7, y1: 0.0, spread: 0.07, a: 0.2 }); } });
    },
    sleeve(F, arm) { sleeve(F, arm, F.colors.b, { len: 0.6, loose: 0.006 }); },
  },
  coat: {
    shoes: 'shoe', defaults: { a: '#3d3c44', b: '#d5cdb8', c: '#2a2a31' },
    legCover(F, side, leg) { legGarment(F, side, leg, 'pants', F.colors.c, { loose: 0.0 }); },
    torso(F) {
      const { colors, B, J } = F, base = colors.a;
      const top = outline(F, { chest: 1.0, waist: 0.96, hip: 1.6, hemT: 0.0, margin: 0.016, shoulder: 1.08 });
      const hemY = J.P[1] + B.thigh * 1.18 + B.shin * 0.1, sway = (J.L.thighA + J.R.thighA) * 0.04, hw = B.hw * J.cw * 2.5 + 0.02;
      const n = top.length / 2, right = top.slice(0, n - 1), left = top.slice(n + 1);
      const flapR = (J.R.thighA) * 0.12, flapL = (J.L.thighA) * 0.12;
      const hemP = [[hw + 0.018 + sway + flapR, hemY - 0.012], [hw * 0.4 + sway, hemY + 0.006], [-hw * 0.4 + sway, hemY + 0.006], [-hw - 0.018 + sway + flapL, hemY - 0.012]];
      // inner shirt / opening: draw the coat as two panels with a dark opening
      F.part([...right, ...hemP, ...left], base, { tex: 'fabric', fold: (c2) => {
        const a = F.tp(0, 1.0), b = F.tp(0, -0.9);
        c2.fillStyle = shade(colors.b, -0.35); c2.beginPath(); const l0 = F.tp(-0.05, 0.96), l1 = F.tp(0.05, 0.96), l2 = F.tp(0.02, -0.1), l3 = F.tp(0.0, -0.9); c2.moveTo(l0[0], l0[1]); c2.lineTo(l1[0], l1[1]); c2.lineTo(l2[0] + 0.01, hemY); c2.lineTo(l3[0] - 0.012, hemY); c2.closePath(); c2.fill();
        c2.fillStyle = colors.b; c2.beginPath(); c2.moveTo(l0[0], l0[1]); c2.lineTo(l1[0], l1[1]); const m = F.tp(0.01, 0.55); c2.lineTo(m[0], m[1]); c2.closePath(); c2.fill();
        foldLines(c2, F, base, 23, { n: 6, y0: 0.5, y1: -0.7, spread: 0.1, a: 0.32 });
        for (let i = 0; i < 3; i++) { const p = F.tp(0.045, 0.62 - i * 0.2); c2.fillStyle = shade(base, -0.5); c2.beginPath(); c2.arc(p[0], p[1], 0.01, 0, TAU); c2.fill(); }
        const g = c2.createLinearGradient(0, hemY - 0.25, 0, hemY + 0.02); g.addColorStop(0, rgba('#000', 0)); g.addColorStop(1, rgba('#000', 0.2)); c2.fillStyle = g; c2.fillRect(-0.5, hemY - 0.25, 1, 0.28);
      } });
      // lapels
      for (const s of [-1, 1]) F.part([F.tp(0.004, 1.0), F.tp(s * 0.085 * J.cw - 0.0, 0.93), F.tp(s * 0.05 * J.cw, 0.5), F.tp(0.0, 0.58)], shade(base, 0.07), { sharp: true, tex: null });
    },
    sleeve(F, arm) { sleeve(F, arm, F.colors.a, { len: 1, loose: 0.02 }); },
  },
  shirt: {
    shoes: 'shoe', defaults: { a: '#7d8fa8', b: '#2d2f38', c: '#222' },
    legCover(F, side, leg) { legGarment(F, side, leg, 'pants', F.colors.b); },
    torso(F) {
      const { colors, B, J } = F; const pts = outline(F, { chest: 0.95, waist: 0.86, hip: 1.45, hemT: 0.05 });
      F.part(pts, colors.a, { tex: 'fabric', fold: (c2) => { foldLines(c2, F, colors.a, 31, { n: 4, y0: 0.55, y1: 0.08, spread: 0.05 }); const a = F.tp(0.004, 0.98), b = F.tp(0.004, 0.06); c2.strokeStyle = rgba(shade(colors.a, -0.6), 0.45); c2.lineWidth = 0.005; c2.beginPath(); c2.moveTo(a[0], a[1]); c2.lineTo(b[0], b[1]); c2.stroke(); } });
      for (const s of [-1, 1]) F.part([F.tp(s * 0.012, 1.02), F.tp(s * (0.06 * J.cw + 0.01), 0.9), F.tp(s * 0.015, 0.86)], shade(colors.a, 0.08), { sharp: true, tex: null });
    },
    sleeve(F, arm) { sleeve(F, arm, F.colors.a, { len: 1, loose: 0.008 }); },
  },
};
export const OUTFIT_NAMES = Object.keys(OUTFITS);
