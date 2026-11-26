// "Zero Shadow Day": daylight horror. Original code-drawn art, deterministic f(t).
// A small perspective renderer draws the school courtyard in bleached noon light with analytic ground shadows
// (length = height * K, K -> 0 when the sun is at the zenith). Close-ups are 2D illustrations.
import * as K from '../tools/kit.mjs';
import { loadCanvas } from '../../lib/runtime.mjs';
const { createCanvas } = await loadCanvas();
const { cl, seg, eo, eio, lerp, TAU, mulberry32 } = K;

// ---------------------------------------------------------------- timing helpers
let TL = null;
const LINE = (i) => (TL.scenes.flatMap((s) => s.lines).find((l) => l.i === i)) || { start_s: 0, end_s: 0 };
function W(line, word, nth = 0) {
  const ws = TL.words.filter((w) => w.line === line && w.word.replace(/[.,!?]+$/, '').toLowerCase() === word.toLowerCase());
  return (ws[nth] || ws[0] || { start_s: LINE(line).start_s }).start_s;
}
const smooth = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const noise1 = (t, s = 0) => Math.sin(t * 1.3 + s) * 0.5 + Math.sin(t * 2.7 + s * 2.1) * 0.3 + Math.sin(t * 5.9 + s * 3.7) * 0.2;
const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// ---------------------------------------------------------------- 3D camera with near-plane clipping
const F = 820;
let CAM = { x: 0, y: 1.2, z: 0, yaw: 0, pitch: 0, roll: 0 };
function setCam(c, t, shake = 0.006, hand = 1) {
  const pr = Math.min(1, t / 61); shake *= 1 + 3.2 * pr * pr; hand *= 1 + 2.4 * pr * pr;
  CAM = { ...c };
  CAM.x += noise1(t * 0.7, 1) * 0.015 * hand; CAM.y += noise1(t * 0.6, 2) * 0.01 * hand;
  CAM.yaw += noise1(t * 0.5, 3) * shake; CAM.pitch += noise1(t * 0.55, 4) * shake * 0.8; CAM.roll = (c.roll || 0) + noise1(t * 0.4, 5) * shake * 0.6;
}
function cs(x, y, z) {
  const dx = x - CAM.x, dy = y - CAM.y, dz = z - CAM.z;
  const cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw);
  const x1 = dx * cy - dz * sy, z1 = dx * sy + dz * cy;
  const cp = Math.cos(CAM.pitch), sp = Math.sin(CAM.pitch);
  return [x1, dy * cp - z1 * sp, dy * sp + z1 * cp];
}
function sp2([x1, y1, z2]) {
  const cr = Math.cos(CAM.roll), sr = Math.sin(CAM.roll);
  return [540 + (x1 * cr - y1 * sr) * F / z2, 960 - (x1 * sr + y1 * cr) * F / z2, z2];
}
const P = (x, y, z) => sp2(cs(x, y, z));
const NEAR = 0.12;
function clipPoly(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ain = a[2] >= NEAR, bin = b[2] >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) { const k = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + k * (b[0] - a[0]), a[1] + k * (b[1] - a[1]), NEAR]); }
  }
  return out;
}
// world polygon (array of [x,y,z]) -> filled path; returns screen pts or null
function poly(ctx, wpts, fill, stroke = null, lw = 1) {
  const cp = clipPoly(wpts.map((p) => cs(p[0], p[1], p[2])));
  if (cp.length < 3) return null;
  const sp = cp.map(sp2);
  ctx.beginPath(); ctx.moveTo(sp[0][0], sp[0][1]); for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i][0], sp[i][1]); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  return sp;
}
function line3(ctx, a, b, col, lw) {
  let A = cs(...a), B = cs(...b);
  if (A[2] < NEAR && B[2] < NEAR) return;
  if (A[2] < NEAR) { const k = (NEAR - A[2]) / (B[2] - A[2]); A = [A[0] + k * (B[0] - A[0]), A[1] + k * (B[1] - A[1]), NEAR]; }
  if (B[2] < NEAR) { const k = (NEAR - B[2]) / (A[2] - B[2]); B = [B[0] + k * (A[0] - B[0]), B[1] + k * (A[1] - B[1]), NEAR]; }
  const a2 = sp2(A), b2 = sp2(B);
  ctx.beginPath(); ctx.moveTo(a2[0], a2[1]); ctx.lineTo(b2[0], b2[1]); ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.6, lw * F / ((a2[2] + b2[2]) / 2)); ctx.stroke();
}
// round-capped limb between two world points; r in metres
function cap(ctx, a, b, ra, rb, col, edge = null) {
  const A = P(...a), B = P(...b);
  if (A[2] < NEAR || B[2] < NEAR) return;
  const w = (ra * F / A[2] + rb * F / B[2]);
  ctx.lineCap = 'round';
  if (edge) { ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.strokeStyle = edge; ctx.lineWidth = w + 2.2; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
}
function ball(ctx, p, r, col, edge = null) {
  const A = P(...p); if (A[2] < NEAR) return null;
  const rr = r * F / A[2];
  ctx.beginPath(); ctx.arc(A[0], A[1], rr, 0, TAU); ctx.fillStyle = col; ctx.fill();
  if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1.6; ctx.stroke(); }
  return [A[0], A[1], rr];
}

// ---------------------------------------------------------------- palette
const HAZE = [243, 238, 224];
const GROUND = [226, 214, 192];
const WALL = [244, 240, 226];
const DADO = [128, 160, 190];
const SKIN = [[150, 100, 70], [170, 118, 82], [128, 84, 58], [160, 108, 74], [140, 92, 64]];
const hazeMix = (c, d, k = 0.028) => mix3(c, HAZE, 1 - Math.exp(-d * k));

// ---------------------------------------------------------------- shadow factor K (shadow length per metre of height)
const SUN = [-0.32, -0.95]; // ground direction a shadow points: toward camera, slightly left
const T_VANISH = 24.15;     // first shadow starts to retreat
function kBase(t) {
  if (t < 15.64) return 0.55;
  if (t < T_VANISH) return lerp(0.55, 0.42, eio(seg(t, 15.64, T_VANISH)));
  return 0.42;
}
// per-kid shadow factor (index i for stagger, 'N' narrator returns on "Meri")
function shK(i, t) {
  if (t < 3.95) return 0.0;              // hook: flash-forward to the minute
  if (t < T_VANISH) return kBase(t);
  const vt = T_VANISH + 0.16 * i;
  if (t < 42.5) return kBase(T_VANISH) * (1 - smooth(vt, vt + 0.7, t));
  const rt = i === 0 ? W(9, 'Meri') - 0.05 : 42.6 + 0.12 * i;
  return 0.8 * smooth(rt, rt + 1.0, t);
}

// ---------------------------------------------------------------- the people
const NK = 13, ARC_R = 4.5, ARC_C = [0, 8];
const arcPos = (i) => { const a = (-65 + 10.83 * i) * Math.PI / 180; return [ARC_C[0] + ARC_R * Math.sin(a), ARC_C[1] + ARC_R * Math.cos(a), a]; };
const R_SLOT = (() => { const a = -77.5 * Math.PI / 180; return [ARC_C[0] + ARC_R * Math.sin(a), ARC_C[1] + ARC_R * Math.cos(a)]; })();
const kidSeed = mulberry32(2024);
const KIDS = Array.from({ length: NK }, (_, i) => {
  const [ax, az, a] = arcPos(i);
  return {
    i, h: 1.32 + kidSeed() * 0.22, skin: SKIN[i % 5], hair: [24 + (kidSeed() * 14 | 0), 20, 20],
    shirt: i % 4 === 3 ? [236, 232, 214] : [250, 248, 238], shorts: [34 + (kidSeed() * 12 | 0), 52, 98],
    loose: [-5 + kidSeed() * 11, 5.5 + kidSeed() * 6.5], ax, az, a, ph: kidSeed() * TAU
  };
});
const NAR = KIDS[0];
// formation 0 = loose, 1 = in the arc
function formation(t) { return t < 3.95 ? 1 : smooth(15.9, 20.2, t); }
function kidPos(k, t) {
  const f = formation(t);
  const kk = clamp01(f + 0 * k.i);
  const wob = (1 - kk) * 0.25;
  const x = lerp(k.loose[0] + Math.sin(t * 0.5 + k.ph) * wob, k.ax, eio(kk));
  const z = lerp(k.loose[1] + Math.cos(t * 0.45 + k.ph) * wob, k.az, eio(kk));
  const face = kk > 0.5 ? lerp(Math.atan2(-Math.sin(k.a), -Math.cos(k.a)), Math.atan2(-Math.sin(k.a), -Math.cos(k.a)), 1) : k.ph;
  return { x, z, kk, face };
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function legWalk(t, k, speed) { return Math.sin(t * speed + k.ph) * 0.18; }

// draw one person (kid, adult, ghost). o: {x,z,face,h,skin,hair,shirt,shorts,handsL,handsR,wet,sari,bag,walk,bow}
function drawPerson(ctx, o, t) {
  const fx = Math.sin(o.face), fz = Math.cos(o.face);          // facing direction
  const rx = fz, rz = -fx;                                      // right-hand direction
  const h = o.h, hip = h * 0.46, sh = h * 0.84, hd = h * 0.94;
  const breathe = Math.sin(t * 1.6 + (o.ph || 0)) * 0.006;
  const lw = o.walk ? Math.sin(t * o.walk) * 0.2 : 0;
  const px = o.x, pz = o.z;
  const col = (c, a = 1) => rgb(c, a);
  const skin = o.skin, edge = 'rgba(70,52,40,0.35)';
  const shirt = o.shirt, shorts = o.shorts;
  const wetTone = o.wet ? 0.4 : 0;
  const sk = wetTone ? mix3(skin, [150, 148, 146], wetTone) : skin;
  // legs
  const lf = [px - rx * 0.07 + fx * lw, 0, pz - rz * 0.07 + fz * lw], rf = [px + rx * 0.07 - fx * lw, 0, pz + rz * 0.07 - fz * lw];
  if (!o.sari) {
    cap(ctx, [px - rx * 0.07, hip, pz - rz * 0.07], lf, 0.06, 0.046, col(sk), edge);
    cap(ctx, [px + rx * 0.07, hip, pz + rz * 0.07], rf, 0.06, 0.046, col(sk), edge);
    // shoes
    cap(ctx, [lf[0], 0.02, lf[2]], [lf[0] + fx * 0.1, 0.02, lf[2] + fz * 0.1], 0.04, 0.04, 'rgb(46,40,38)');
    cap(ctx, [rf[0], 0.02, rf[2]], [rf[0] + fx * 0.1, 0.02, rf[2] + fz * 0.1], 0.04, 0.04, 'rgb(46,40,38)');
    // shorts
    cap(ctx, [px - rx * 0.06, hip + 0.02, pz - rz * 0.06], [px - rx * 0.065, hip - 0.2, pz - rz * 0.065], 0.07, 0.065, col(shorts));
    cap(ctx, [px + rx * 0.06, hip + 0.02, pz + rz * 0.06], [px + rx * 0.065, hip - 0.2, pz + rz * 0.065], 0.07, 0.065, col(shorts));
  } else {
    // sari: long cone from waist to ground
    const wst = [px, hip + 0.08, pz];
    const sp = [[px - rx * 0.3, 0.02, pz - rz * 0.3], [px + rx * 0.3, 0.02, pz + rz * 0.3], [px + rx * 0.14, hip + 0.1, pz + rz * 0.14], [px - rx * 0.14, hip + 0.1, pz - rz * 0.14]];
    poly(ctx, sp, col(o.sari), 'rgba(90,60,70,0.4)', 1.4);
    cap(ctx, [lf[0], 0.02, lf[2]], [lf[0] + fx * 0.1, 0.02, lf[2] + fz * 0.1], 0.04, 0.04, 'rgb(60,40,34)');
  }
  // torso
  const torsoCol = o.sari ? o.sariTop || o.sari : shirt;
  const tw = o.sari ? 0.135 : 0.13;
  cap(ctx, [px, hip + 0.02, pz], [px, sh + breathe, pz], tw, tw * 0.95, col(wetTone ? mix3(torsoCol, [190, 196, 200], 0.55) : torsoCol), 'rgba(80,70,60,0.45)');
  if (o.bag) { cap(ctx, [px + rx * 0.14, hip + 0.14, pz + rz * 0.14], [px + rx * 0.17, hip - 0.04, pz + rz * 0.17 - fz * 0.04], 0.07, 0.09, 'rgb(150,40,40)', 'rgba(70,20,20,0.6)'); cap(ctx, [px + rx * 0.15, hip + 0.1, pz + rz * 0.15], [px - rx * 0.1, sh, pz - rz * 0.1], 0.012, 0.012, 'rgb(110,30,30)'); }
  // neck + head
  cap(ctx, [px, sh, pz], [px, hd - 0.09, pz], 0.035, 0.035, col(sk));
  const headC = [px + (o.bow ? fx * 0.04 : 0), hd + (o.bow ? -0.02 : 0), pz + (o.bow ? fz * 0.04 : 0)];
  const hr = 0.118;
  const hb = ball(ctx, headC, hr, col(sk), edge);
  if (hb) {
    // hair cap: shifted away from the viewer's face direction
    const A = P(headC[0] - fx * 0.025, headC[1] + 0.035, headC[2] - fz * 0.025);
    ctx.beginPath(); ctx.arc(A[0], A[1], hb[2] * 1.02, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fillStyle = col(o.hair); ctx.fill();
    if (o.wet) { ctx.strokeStyle = 'rgba(210,225,235,0.45)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(A[0], A[1], hb[2] * 0.82, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke(); }
    // face features only when facing the camera and close enough
    const toCam = [CAM.x - px, CAM.z - pz]; const facing = (fx * toCam[0] + fz * toCam[1]) / (Math.hypot(...toCam) + 1e-6);
    if (facing > 0.25 && hb[2] > 7) {
      const ex = hb[2] * 0.34, ey = hb[0], yy = hb[1] + hb[2] * 0.08;
      ctx.fillStyle = 'rgba(30,22,20,0.9)';
      const dx = (rx * (CAM.z - pz) - rz * (CAM.x - px)) > 0 ? 1 : -1;
      ctx.beginPath(); ctx.arc(hb[0] - ex * 0.9, yy, Math.max(1, hb[2] * 0.075), 0, TAU); ctx.arc(hb[0] + ex * 0.9, yy, Math.max(1, hb[2] * 0.075), 0, TAU); ctx.fill();
      if (hb[2] > 14) { ctx.strokeStyle = 'rgba(60,34,30,0.7)'; ctx.lineWidth = Math.max(1, hb[2] * 0.05); ctx.beginPath(); ctx.moveTo(hb[0] - ex * 0.5, hb[1] + hb[2] * 0.5); ctx.quadraticCurveTo(hb[0], hb[1] + hb[2] * (o.mouth ?? 0.58), hb[0] + ex * 0.5, hb[1] + hb[2] * 0.5); ctx.stroke(); }
    }
  }
  // arms
  const shL = [px - rx * 0.16, sh - 0.02, pz - rz * 0.16], shR = [px + rx * 0.16, sh - 0.02, pz + rz * 0.16];
  const dL = o.handL || [px - rx * 0.2 + fx * 0.04, hip - 0.04, pz - rz * 0.2 + fz * 0.04];
  const dR = o.handR || [px + rx * 0.2 + fx * 0.04, hip - 0.04, pz + rz * 0.2 + fz * 0.04];
  const armCol = o.sari ? col(o.sariTop || o.sari) : col(shirt);
  for (const [s0, d] of [[shL, dL], [shR, dR]]) {
    const el = [(s0[0] + d[0]) / 2, (s0[1] + d[1]) / 2 - 0.05, (s0[2] + d[2]) / 2];
    cap(ctx, s0, el, 0.05, 0.044, armCol, 'rgba(80,70,60,0.4)');
    cap(ctx, el, d, 0.043, 0.036, col(sk), edge);
    ball(ctx, d, 0.042, col(sk));
  }
}

// ground shadow of a standing figure (analytic projection onto y = 0)
function drawShadow(ctx, o, K, a = 0.5, bag = false) {
  const H = o.h * 0.9, Kf = K;
  const bx = o.sx ?? o.x, bz = o.sz ?? o.z;           // shadow base (can differ: stolen shadow)
  const ux = o.dx ?? SUN[0], uz = o.dz ?? SUN[1];
  const ln = Math.hypot(ux, uz); const sx = ux / ln, sz = uz / ln;
  const px = -sz, pz = sx;
  const fade = smooth(0.015, 0.12, Kf);
  // contact blob (always very small)
  const cr = 0.16;
  const blob = []; for (let j = 0; j < 14; j++) { const q = j / 14 * TAU; blob.push([bx + Math.cos(q) * cr, 0, bz + Math.sin(q) * cr * 0.8]); }
  poly(ctx, blob, `rgba(60,52,48,${0.16 + 0.1 * fade})`);
  if (fade < 0.01) return;
  const L = H * Kf;
  const wb = 0.2, wt = 0.11;
  const tx = bx + sx * L, tz = bz + sz * L;
  const body = [[bx + px * wb, 0, bz + pz * wb], [bx - px * wb, 0, bz - pz * wb], [tx - px * wt, 0, tz - pz * wt], [tx + px * wt, 0, tz + pz * wt]];
  ctx.save(); ctx.globalAlpha = Math.min(0.85, a * 1.5) * fade;
  poly(ctx, body, 'rgb(58,50,60)');
  // legs split near the base
  const hx = bx + sx * (L + 0.14), hz = bz + sz * (L + 0.14);
  const head = []; for (let j = 0; j < 14; j++) { const q = j / 14 * TAU; head.push([hx + Math.cos(q) * 0.12 + sx * Math.cos(q) * 0.04, 0, hz + Math.sin(q) * 0.12]); }
  poly(ctx, head, 'rgb(58,50,60)');
  if (bag) { const mx = bx + sx * L * 0.42, mz = bz + sz * L * 0.42; poly(ctx, [[mx + px * 0.1, 0, mz + pz * 0.1], [mx + px * 0.34, 0, mz + pz * 0.34], [mx + px * 0.36 + sx * 0.18, 0, mz + pz * 0.36 + sz * 0.18], [mx + px * 0.1 + sx * 0.2, 0, mz + pz * 0.1 + sz * 0.2]], 'rgb(58,50,60)'); }
  ctx.restore();
}

// ---------------------------------------------------------------- scenery
const crackRng = mulberry32(555);
const CRACKS = Array.from({ length: 26 }, () => { let x = -9 + crackRng() * 18, z = 1 + crackRng() * 15; const pts = [[x, z]]; for (let j = 0; j < 4; j++) { x += (crackRng() - 0.5) * 1.1; z += (crackRng() - 0.2) * 0.9; pts.push([x, z]); } return pts; });
const STAINS = Array.from({ length: 22 }, () => ({ x: -9 + crackRng() * 18, z: 1 + crackRng() * 15, r: 0.8 + crackRng() * 1.8, a: 0.03 + crackRng() * 0.05 }));

function drawGround(ctx, t, haze = 1) {
  // sky above the horizon, concrete below
  const hz = Math.max(-200, Math.min(2200, 960 + F * Math.tan(CAM.pitch)));
  const sky = ctx.createLinearGradient(0, 0, 0, hz + 1);
  sky.addColorStop(0, '#fffdf2'); sky.addColorStop(0.55, '#fbf6e2'); sky.addColorStop(1, '#f2ecd8');
  ctx.fillStyle = sky; ctx.fillRect(-100, -100, 1300, 2200);
  const gr = ctx.createLinearGradient(0, hz, 0, Math.max(hz + 1, 1920));
  gr.addColorStop(0, rgb(HAZE)); gr.addColorStop(0.18, rgb(mix3(HAZE, GROUND, 0.55))); gr.addColorStop(1, rgb(GROUND));
  ctx.fillStyle = gr; ctx.fillRect(-100, hz, 1300, 2200 - hz > 0 ? 2200 : 1);
  // stains and tile joints (far to near)
  for (const s of STAINS) { const c = []; for (let j = 0; j < 12; j++) { const q = j / 12 * TAU; c.push([s.x + Math.cos(q) * s.r, 0, s.z + Math.sin(q) * s.r * 0.7]); } poly(ctx, c, `rgba(150,128,100,${s.a})`); }
  ctx.lineCap = 'butt';
  for (let x = -12; x <= 12; x += 1.8) line3(ctx, [x, 0, 0.3], [x, 0, 17], 'rgba(150,134,110,0.35)', 0.012);
  for (let z = 1; z <= 17; z += 1.8) line3(ctx, [-12, 0, z], [12, 0, z], 'rgba(150,134,110,0.35)', 0.012);
  for (const c of CRACKS) for (let j = 0; j + 1 < c.length; j++) line3(ctx, [c[j][0], 0, c[j][1]], [c[j + 1][0], 0, c[j + 1][1]], 'rgba(90,76,62,0.5)', 0.01);
}

function drawWall(ctx, t) {
  const Z = 16.5;
  const sh = (c, k = 1) => rgb(hazeMix(c, Z - CAM.z).map((v) => v * k));
  poly(ctx, [[-16, 0, Z], [16, 0, Z], [16, 4.2, Z], [-16, 4.2, Z]], sh(WALL));
  poly(ctx, [[-16, 0, Z], [16, 0, Z], [16, 1.0, Z], [-16, 1.0, Z]], sh(DADO));
  poly(ctx, [[-16, 1.0, Z], [16, 1.0, Z], [16, 1.06, Z], [-16, 1.06, Z]], sh([90, 120, 150]));
  poly(ctx, [[-16, 3.9, Z], [16, 3.9, Z], [16, 4.25, Z], [-16, 4.25, Z]], sh([205, 196, 176]));
  for (const wx of [-10.5, -7, 3.2, 6.8, 10.2]) {
    poly(ctx, [[wx - 0.7, 1.5, Z - 0.02], [wx + 0.7, 1.5, Z - 0.02], [wx + 0.7, 3.0, Z - 0.02], [wx - 0.7, 3.0, Z - 0.02]], sh([96, 100, 108]), sh([180, 176, 160]), 3);
    for (const bx of [-0.35, 0, 0.35]) line3(ctx, [wx + bx, 1.5, Z - 0.03], [wx + bx, 3.0, Z - 0.03], 'rgba(235,235,225,0.85)', 0.03);
    line3(ctx, [wx - 0.7, 2.25, Z - 0.03], [wx + 0.7, 2.25, Z - 0.03], 'rgba(235,235,225,0.85)', 0.03);
  }
  // gate (arch) at x = -2.2: bright daylight beyond
  const gx = -2.2;
  poly(ctx, [[gx - 1.0, 0, Z - 0.03], [gx + 1.0, 0, Z - 0.03], [gx + 1.0, 2.6, Z - 0.03], [gx - 1.0, 2.6, Z - 0.03]], 'rgb(255,252,238)', sh([150, 140, 120]), 4);
  poly(ctx, [[gx - 1.1, 2.6, Z - 0.04], [gx + 1.1, 2.6, Z - 0.04], [gx + 1.1, 2.8, Z - 0.04], [gx - 1.1, 2.8, Z - 0.04]], sh([170, 150, 130]));
  // second door on the right (kids exit)
  poly(ctx, [[4.2, 0, Z - 0.03], [5.6, 0, Z - 0.03], [5.6, 2.3, Z - 0.03], [4.2, 2.3, Z - 0.03]], 'rgb(120,100,84)', sh([90, 76, 66]), 3);
  // board
  poly(ctx, [[-1.1, 3.0, Z - 0.03], [1.1, 3.0, Z - 0.03], [1.1, 3.6, Z - 0.03], [-1.1, 3.6, Z - 0.03]], sh([60, 90, 80]), sh([220, 210, 190]), 3);
}

function drawTree(ctx, t, K) {
  const tx = -9.2, tz = 12.5;
  // under-canopy shade (stays at noon: tree shade is a disc, not a thin shadow)
  const sc = []; for (let j = 0; j < 24; j++) { const q = j / 24 * TAU; sc.push([tx + Math.cos(q) * 2.3 + SUN[0] * K * 3.5, 0, tz + Math.sin(q) * 1.9 + SUN[1] * K * 3.5]); }
  poly(ctx, sc, 'rgba(70,86,64,0.32)');
  cap(ctx, [tx, 0, tz], [tx + 0.1, 3.2, tz], 0.26, 0.17, 'rgb(98,82,66)', 'rgba(60,48,40,0.5)');
  cap(ctx, [tx + 0.1, 2.4, tz], [tx + 1.3, 3.6, tz - 0.3], 0.1, 0.07, 'rgb(98,82,66)');
  const blobs = [[0, 4.4, 0, 1.7], [-1.4, 3.8, 0.2, 1.4], [1.5, 4.0, -0.2, 1.5], [0.2, 5.1, 0.4, 1.3], [-0.6, 3.5, -0.8, 1.2], [1.1, 3.4, 0.7, 1.2]];
  for (const b of blobs) { const A = ball(ctx, [tx + b[0], b[1], tz + b[2]], b[3], rgb(hazeMix([112, 140, 84], tz - CAM.z, 0.02))); if (A) { ctx.fillStyle = 'rgba(250,250,215,0.14)'; ctx.beginPath(); ctx.arc(A[0] - A[2] * 0.25, A[1] - A[2] * 0.3, A[2] * 0.62, 0, TAU); ctx.fill(); } }
}

const WELL = [6.2, 7.6];
function drawWell(ctx, t) {
  const [wx, wz] = WELL; const Rr = 0.95, H = 0.78, N = 26;
  const ring = (r, y) => Array.from({ length: N }, (_, j) => { const q = j / N * TAU; return [wx + Math.cos(q) * r, y, wz + Math.sin(q) * r]; });
  const base = ring(Rr, 0), top = ring(Rr, H);
  for (let j = 0; j < N; j++) {
    const j2 = (j + 1) % N; const q = (j + 0.5) / N * TAU; const nx = Math.cos(q), nz = Math.sin(q);
    if (nx * (CAM.x - wx) + nz * (CAM.z - wz) < Rr * 0.2) continue;
    const lit = 0.78 + 0.22 * Math.max(0, nx * 0.4 + nz * -0.9);
    poly(ctx, [base[j], base[j2], top[j2], top[j]], rgb(hazeMix([214, 202, 180], wz - CAM.z).map((v) => v * lit)), 'rgba(110,96,80,0.3)', 1);
  }
  poly(ctx, ring(Rr + 0.08, H + 0.05), 'rgb(236,228,208)', 'rgba(110,96,80,0.45)', 1.5);
  poly(ctx, ring(Rr - 0.22, H + 0.05), 'rgb(14,16,18)');
  poly(ctx, ring(Rr - 0.4, H + 0.05), 'rgb(4,6,8)');
  // rope fence
  const posts = Array.from({ length: 7 }, (_, j) => { const q = (j / 7) * TAU + 0.3; return [wx + Math.cos(q) * 2.3, wz + Math.sin(q) * 2.3]; });
  for (let j = 0; j < 7; j++) {
    const p = posts[j], p2 = posts[(j + 1) % 7];
    line3(ctx, [p[0], 0, p[1]], [p[0], 0.9, p[1]], 'rgb(120,96,70)', 0.07);
    for (const hy of [0.8, 0.5]) line3(ctx, [p[0], hy, p[1]], [p2[0], hy - 0.07, p2[1]], 'rgba(180,70,60,0.85)', 0.02);
  }
}

// ---------------------------------------------------------------- wet footprints (Raju's trail, then the narrator's)
const TRAIL = (() => {
  const pts = []; const n = 22;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    // from the well to Raju's slot, bending in front of the arc
    const x = lerp(WELL[0] - 0.4, R_SLOT[0] + 0.15, u), z = lerp(WELL[1] - 1.1, R_SLOT[1] - 0.15, u) - Math.sin(u * Math.PI) * 0.9;
    pts.push({ x, z, side: i % 2 ? 1 : -1 });
  }
  for (let i = 0; i < n - 1; i++) { pts[i].dx = pts[i + 1].x - pts[i].x; pts[i].dz = pts[i + 1].z - pts[i].z; }
  pts[n - 1].dx = pts[n - 2].dx; pts[n - 1].dz = pts[n - 2].dz;
  return pts;
})();
function print(ctx, x, z, dx, dz, side, a, s = 1) {
  if (a < 0.02) return;
  const L = Math.hypot(dx, dz) + 1e-6; const fx = dx / L, fz = dz / L, rx = fz, rz = -fx;
  const cx = x + rx * 0.1 * side, cz = z + rz * 0.1 * side;
  // a bare foot: ball + arch-less sole, heel, five toes (local coords: u along the walking direction, v sideways)
  const blob = (u, v, ru, rv, al) => { const c = []; for (let j = 0; j < 12; j++) { const q = j / 12 * TAU; const lu = (u + Math.cos(q) * ru) * s, lv = (v + Math.sin(q) * rv) * s; c.push([cx + fx * lu + rx * lv, 0, cz + fz * lu + rz * lv]); } poly(ctx, c, `rgba(58,44,36,${a * al})`); };
  blob(0.0, 0.0, 0.05, 0.04 * side * side, 0.9);      // heel
  blob(0.15, 0.005, 0.085, 0.05, 0.85);                // ball of the foot
  for (let k = 0; k < 5; k++) blob(0.27 + (k === 0 ? 0.015 : k === 4 ? -0.02 : 0), (k - 2) * 0.028 * side * -1 - 0.0, 0.017 - k * 0.0012, 0.014, 0.85);
}
function drawTrail(ctx, t, t0 = 0, evap = 6) {
  // prints nearest the well are oldest and evaporate first
  for (let i = 0; i < TRAIL.length; i++) {
    const p = TRAIL[i];
    const born = t0 + i * 0.06;
    const life = lerp(1.5, 7.5, i / (TRAIL.length - 1)) * (evap / 6);
    const age = t - born;
    const a = smooth(0, 0.15, age) * (1 - smooth(life * 0.4, life, age));
    print(ctx, p.x, p.z, p.dx, p.dz, p.side, 0.95 * a, 1.5);
  }
}

// ---------------------------------------------------------------- courtyard (3D) scene
function kidState(k, t) {
  const p = kidPos(k, t);
  const f = formation(t);
  const R = arcPos(k.i);
  // facing: toward the arc centre when in formation
  const face = Math.atan2(ARC_C[0] - p.x, ARC_C[1] - p.z) * f + (1 - f) * k.ph;
  return { ...p, face, f };
}
function handPts(states, t) {
  // hands joined between neighbours at arc formation; free otherwise
  return states.map((s, i) => {
    const f = s.f; const L = states[i - 1], Rn = states[i + 1];
    const hh = 0.7 + 0.03 * Math.sin(t * 1.3 + i);
    const mk = (n) => n ? [(s.x + n.x) / 2, hh, (s.z + n.z) / 2] : null;
    return { L: f > 0.6 ? mk(L) : null, R: f > 0.6 ? mk(Rn) : null };
  });
}
// state shared for the current frame
function worldFrame(ctx, t, opts = {}) {
  const { showR = false, rState = null, exit = 0, narr = null, mum = null, master = false, trail = true, trailT0 = -20, trailEvap = 8, noWall = false, narrOnly = false } = opts;
  drawGround(ctx, t);
  if (!noWall) drawWall(ctx, t);
  drawTree(ctx, t, 0.4 * (shK(1, t) > 0.05 ? 1 : 0.2));
  drawWell(ctx, t);
  // chalk arc
  const chalk = smooth(16.4, 19, t) || (t < 3.95 ? 1 : 0);
  if (chalk > 0.01 && !opts.noChalk) {
    ctx.save(); ctx.globalAlpha = 0.7 * chalk;
    for (let j = -62; j < 64; j += 2) { const a1 = j * Math.PI / 180, a2 = (j + 1.2) * Math.PI / 180; poly(ctx, [[Math.sin(a1) * 4.5, 0, 8 + Math.cos(a1) * 4.5 - 0.05], [Math.sin(a2) * 4.5, 0, 8 + Math.cos(a2) * 4.5 - 0.05], [Math.sin(a2) * 4.5, 0, 8 + Math.cos(a2) * 4.5 + 0.05], [Math.sin(a1) * 4.5, 0, 8 + Math.cos(a1) * 4.5 + 0.05]], 'rgb(255,255,252)'); }
    ctx.restore();
  }
  if (trail) drawTrail(ctx, t, trailT0, trailEvap);
  // entity list
  const ents = [];
  let states = KIDS.map((k) => kidState(k, t));
  const hp = handPts(states, t);
  KIDS.forEach((k, i) => {
    if (opts.hideKids) return;
    const s = states[i];
    let o = { x: s.x, z: s.z, face: s.face, h: k.h, skin: k.skin, hair: k.hair, shirt: k.shirt, shorts: k.shorts, ph: k.ph, handL: hp[i].L, handR: hp[i].R, bag: i === 0 };
    if (narr && i === 0) o = { ...o, ...narr };
    if (opts.exit && i > 0) { const q = eio(seg(t, opts.exit, opts.exit + 3.6) - 0.04 * i); if (q > 0) { o.x = lerp(s.x, 4.9, q); o.z = lerp(s.z, 15.3, q); o.walk = 7; o.face = Math.atan2(4.9 - s.x, 15.3 - s.z); o.handL = null; o.handR = null; } }
    ents.push({ o, i, kind: 'kid' });
  });
  if (showR && rState) ents.push({ o: rState, i: 'R', kind: 'R' });
  if (mum) ents.push({ o: mum, i: 'M', kind: 'M' });
  if (master) ents.push({ o: master, i: 'MJ', kind: 'MJ' });
  // shadows first (all on the ground, under everyone)
  for (const e of ents) {
    if (e.kind === 'kid') { const K0 = shK(e.i, t); drawShadow(ctx, { ...e.o, dx: SUN[0], dz: SUN[1], ...(e.i === 0 && opts.nShadow ? opts.nShadow : {}) }, K0, 0.5, e.i === 0); }
    else if (e.kind === 'M') drawShadow(ctx, { ...e.o }, mum.K ?? 0.8, 0.5);
    else if (e.kind === 'R' && opts.rShadow) drawShadow(ctx, { ...e.o, ...opts.rShadow }, opts.rShadow.K, 0.5, true);
    else if (e.kind === 'MJ') drawShadow(ctx, { ...e.o }, master.K ?? 0.5, 0.5);
  }
  ents.sort((a, b) => Math.hypot(b.o.x - CAM.x, b.o.z - CAM.z) - Math.hypot(a.o.x - CAM.x, a.o.z - CAM.z));
  for (const e of ents) drawPerson(ctx, e.o, t);
  return states;
}

function sunGlare(ctx, a = 0.5, x = 540, y = -80, r = 900) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,240,${a})`); g.addColorStop(0.4, `rgba(255,252,225,${a * 0.35})`); g.addColorStop(1, 'rgba(255,252,225,0)');
  ctx.fillStyle = g; ctx.fillRect(-100, -100, 1300, 2200);
}
function rState(t, extra = {}) {
  // Raju stands in the slot beside the narrator
  return { x: R_SLOT[0], z: R_SLOT[1], face: Math.atan2(ARC_C[0] - R_SLOT[0], ARC_C[1] - R_SLOT[1]), h: 1.38, skin: [150, 140, 134], hair: [14, 14, 16], shirt: [236, 238, 238], shorts: [28, 40, 78], wet: true, ph: 1.3, ...extra };
}

// ---------------------------------------------------------------- scenes
const R = {};

// 1) HOOK: foot-level crawl across the white courtyard; the school's shadows are gone; wet prints evaporate
R.s1_hook = (ctx, lt, dur, t) => {
  const p = lt / dur;
  const cams = [0.4, 0.14, 6.1, -0.45, 0.05]; setCam({ x: lerp(cams[0], cams[0] - 1.0, eio(p)), y: cams[1], z: lerp(cams[2], cams[2] + 0.6, eio(p)), yaw: cams[3] - 0.06 * p, pitch: cams[4], roll: 0.02 }, t, 0.006, 1.3);
  worldFrame(ctx, t, { noChalk: false, trailT0: -2.2, trailEvap: 6 });
  sunGlare(ctx, 0.5, 540, -120, 1100);
  // context stamp, fades out
  const a = smooth(0.15, 0.6, lt) * (1 - smooth(2.6, 3.4, lt));
  K.text(ctx, 'ZERO SHADOW DAY', 540, 345, 40, '#ffffff', { a, weight: 900 });
};

// 2) DADI: dark kitchen, blown-out doorway, the hand that lets go
R.s2_dadi = (ctx, lt, dur, t) => {
  const rng = mulberry32(31);
  ctx.save();
  const z = lerp(1.0, 1.1, lt / dur); ctx.translate(540, 900); ctx.scale(z, z); ctx.translate(-540, -900);
  // back wall
  const g = ctx.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#2b1f17'); g.addColorStop(1, '#1b130f'); ctx.fillStyle = g; ctx.fillRect(-100, -100, 1300, 2200);
  // mud-plaster texture
  for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(${90 + rng() * 40},${66 + rng() * 30},${48},${0.06 + rng() * 0.06})`; ctx.beginPath(); ctx.ellipse(rng() * 1080, rng() * 1500 + 100, 40 + rng() * 120, 14 + rng() * 40, rng(), 0, TAU); ctx.fill(); }
  // shelf with steel utensils
  ctx.fillStyle = '#3a2a1e'; ctx.fillRect(60, 560, 520, 18);
  for (let i = 0; i < 5; i++) { const x = 110 + i * 96; ctx.fillStyle = 'rgba(190,190,184,0.85)'; ctx.beginPath(); ctx.ellipse(x, 540, 36, 18, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(120,120,116,0.7)'; ctx.fillRect(x - 36, 540, 72, 20); }
  // matka
  ctx.fillStyle = '#6a3b26'; ctx.beginPath(); ctx.ellipse(160, 1100, 90, 100, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#4a2818'; ctx.fillRect(110, 1000, 100, 20);
  // chulha with embers
  ctx.fillStyle = '#2a1d16'; ctx.fillRect(60, 1180, 300, 150); const em = 0.6 + 0.4 * Math.sin(t * 3.1) * Math.cos(t * 1.7); K.glow(ctx, 210, 1215, 220, '255,120,40', 0.35 * em);
  // blown-out doorway on the right
  ctx.fillStyle = '#fffbea'; ctx.fillRect(700, 330, 280, 1100);
  K.glow(ctx, 840, 880, 700, '255,250,220', 0.5);
  // light shaft onto the floor
  ctx.save(); ctx.globalCompositeOperation = 'screen'; const sg = ctx.createLinearGradient(840, 700, 300, 1500); sg.addColorStop(0, 'rgba(255,248,215,0.55)'); sg.addColorStop(1, 'rgba(255,248,215,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(700, 430); ctx.lineTo(980, 430); ctx.lineTo(420, 1750); ctx.lineTo(-60, 1750); ctx.closePath(); ctx.fill(); ctx.restore();
  K.dust(ctx, t, 0.55, '255,240,200');
  // two-shot: Dadi (rim-lit by the door) and the boy
  const sway = Math.sin(t * 0.8) * 4;
  const part = lt < 6.2 ? 0 : 1; // first half: Dadi at the door; second half: the hands
  const dadi = (x, y, s) => {
    ctx.save(); ctx.translate(x + sway, y); ctx.scale(s, s);
    ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.moveTo(-170, 900); ctx.quadraticCurveTo(-190, 380, -60, 250); ctx.quadraticCurveTo(0, 170, 70, 250); ctx.quadraticCurveTo(190, 380, 170, 900); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d9d2c0'; ctx.globalAlpha = 0.14; ctx.beginPath(); ctx.moveTo(60, 250); ctx.quadraticCurveTo(190, 380, 170, 900); ctx.lineTo(120, 900); ctx.quadraticCurveTo(140, 400, 40, 270); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#241813'; ctx.beginPath(); ctx.arc(0, 190, 75, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(-6, 100, 40, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,245,215,0.7)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 190, 75, -0.2, 1.1); ctx.stroke();
    ctx.restore();
  };
  if (part === 0) {
    dadi(430, 520, 1.15);
    // the boy, small, back to camera in the foreground
    ctx.fillStyle = '#120d0a'; ctx.beginPath(); ctx.ellipse(230, 1430, 90, 340, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(230, 1060, 70, 0, TAU); ctx.fill();
  } else {
    // close on hands: Dadi's old hand around the boy's wrist, then it lets go
    const rel = smooth(W(1, 'pakadna') - 0.1, W(1, 'pakadna') + 0.5, t);
    const open = rel;
    ctx.save(); ctx.translate(540, 1000); const zz = 1 + 0.06 * (lt - 6.2) / (dur - 6.2); ctx.scale(zz, zz);
    // boy's forearm
    ctx.fillStyle = '#b57c55'; ctx.beginPath(); ctx.moveTo(-420, 120); ctx.quadraticCurveTo(-100, 60, 260, 140); ctx.lineTo(260, 270); ctx.quadraticCurveTo(-100, 250, -420, 300); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c8905f'; ctx.beginPath(); ctx.ellipse(300, 205, 85, 70, 0.1, 0, TAU); ctx.fill();
    // Dadi's hand coming from the top-left, fingers wrapped around the wrist
    const lift = open * 140;
    ctx.save(); ctx.translate(-40, -110 - lift * 0.5); ctx.rotate(0.12 + open * 0.2);
    ctx.fillStyle = '#9a6c4c'; ctx.beginPath(); ctx.moveTo(-340, -160); ctx.quadraticCurveTo(-120, -190, 120, -80); ctx.lineTo(120, 70 + lift); ctx.quadraticCurveTo(-120, 150 + lift, -340, 200); ctx.closePath(); ctx.fill();
    for (let f = 0; f < 4; f++) { const fy = -40 + f * 56 + lift * (f / 3); ctx.beginPath(); ctx.strokeStyle = '#8b5f42'; ctx.lineWidth = 42; ctx.lineCap = 'round'; ctx.moveTo(60, fy); ctx.quadraticCurveTo(150, fy + 20 + lift * 0.3, 190 + lift * 0.6, fy + 80 + lift); ctx.stroke(); }
    // wrinkles + bangles
    ctx.strokeStyle = 'rgba(60,36,24,0.45)'; ctx.lineWidth = 3; for (let w = 0; w < 7; w++) { ctx.beginPath(); ctx.moveTo(-200 + w * 40, -100 + w * 4); ctx.quadraticCurveTo(-180 + w * 40, -60, -190 + w * 40, 10); ctx.stroke(); }
    for (let b = 0; b < 4; b++) { ctx.strokeStyle = b % 2 ? '#c9a24a' : '#7a3a2a'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(-290 + b * 18, -140); ctx.lineTo(-290 + b * 18, 190); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
  }
  ctx.restore();
  // doorway is white-hot: light bleeds over everything slightly
  K.glow(ctx, 840, 880, 900, '255,246,210', 0.14 + 0.06 * Math.sin(t * 1.3));
};

// 3) CIRCLE: master ji lines everyone up and makes them hold hands; the well in the background
R.s3_circle = (ctx, lt, dur, t) => {
  const p = lt / dur;
  setCam({ x: lerp(0.6, -0.4, p), y: lerp(1.2, 2.6, eio(p)), z: lerp(0.4, 1.6, p), yaw: lerp(-0.05, 0.08, eio(seg(p, 0.45, 1))), pitch: lerp(0.0, -0.18, eio(p)) }, t, 0.006);
  const mj = { x: 1.4, z: lerp(6.6, 7.6, eio(seg(t, 15.8, 19))), face: Math.atan2(-1.4, 4.8) + Math.sin(t * 0.9) * 0.2, h: 1.72, skin: [140, 94, 66], hair: [30, 28, 28], shirt: [196, 178, 126], shorts: [96, 84, 70], ph: 0.4, handL: [1.4 - 0.5, 1.4 + 0.2 * Math.sin(t * 2.2), 7.5], K: kBase(t) };
  worldFrame(ctx, t, { master: mj, trail: false });
  sunGlare(ctx, 0.35 + 0.15 * smooth(20, 23.9, t), 540, -100, 1000);
  // slow look at the well on the "Raju" line
  const wl = smooth(LINE(4).start_s - 0.1, LINE(4).start_s + 0.9, t) * (1 - smooth(LINE(4).end_s - 0.6, LINE(4).end_s, t));
  if (wl > 0.01) { ctx.save(); ctx.globalAlpha = 0.35 * wl; const vg = ctx.createRadialGradient(780, 760, 80, 780, 760, 640); vg.addColorStop(0, 'rgba(255,255,240,0)'); vg.addColorStop(1, 'rgba(30,30,40,0.85)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, 1080, 1920); ctx.restore(); }
};

// 4) THE MINUTE: overhead view; shadows retreat into the feet; the sun disc blooms
R.s4_minute = (ctx, lt, dur, t) => {
  const p = lt / dur;
  ctx.fillStyle = rgb(GROUND); ctx.fillRect(-100, -100, 1300, 2200);
  const sc = lerp(1.35, 0.95, eio(p));
  ctx.save(); ctx.translate(540, 900); ctx.scale(sc, sc); ctx.rotate(lerp(-0.08, 0.04, p)); ctx.translate(-540, -900);
  // top view: world (x,z) -> px; the arc centre sits in the middle
  const m = 128; const T = (x, z) => [540 + (x - ARC_C[0]) * m, 900 - (z - 10.3) * m];
  // paving, cracks, stains
  for (const s of STAINS) { const [x, y] = T(s.x, s.z); ctx.fillStyle = `rgba(150,128,100,${s.a * 1.4})`; ctx.beginPath(); ctx.ellipse(x, y, s.r * m, s.r * m * 0.8, 0, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = 'rgba(150,134,110,0.4)'; ctx.lineWidth = 2;
  for (let x = -12; x <= 12; x += 1.8) { const [a, b] = T(x, -2); const [c, d] = T(x, 20); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
  for (let z = -2; z <= 20; z += 1.8) { const [a, b] = T(-12, z); const [c, d] = T(12, z); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(90,76,62,0.5)'; ctx.lineWidth = 2.4; for (const cr of CRACKS) { ctx.beginPath(); cr.forEach((q, j) => { const [x, y] = T(q[0], q[1]); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }
  // chalk arc
  ctx.strokeStyle = 'rgba(255,255,252,0.85)'; ctx.lineWidth = 7; ctx.beginPath(); for (let a = -63; a <= 63; a += 3) { const [x, y] = T(Math.sin(a * Math.PI / 180) * 4.5, 8 + Math.cos(a * Math.PI / 180) * 4.5); a === -63 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
  // well (round, from above)
  { const [x, y] = T(WELL[0], WELL[1]); ctx.fillStyle = '#ebe3d0'; ctx.beginPath(); ctx.arc(x, y, 0.95 * m, 0, TAU); ctx.fill(); ctx.fillStyle = '#050709'; ctx.beginPath(); ctx.arc(x, y, 0.62 * m, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(110,96,80,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 0.95 * m, 0, TAU); ctx.stroke(); }
  // evaporating prints
  ctx.fillStyle = 'rgba(84,66,52,0.5)'; TRAIL.forEach((q, j) => { const [x, y] = T(q.x, q.z); const a = (1 - smooth(0, 0.8, p)) * (j / TRAIL.length); ctx.globalAlpha = 0.6 * a; ctx.beginPath(); ctx.ellipse(x, y, 7, 11, Math.atan2(q.dx, q.dz) * -1, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1;
  // shadows (top view: ellipses stretched toward the sun direction), then kids
  const states = KIDS.map((k) => kidState(k, t));
  const heads = [];
  states.forEach((s, i) => {
    const [x, y] = T(s.x, s.z); const k = KIDS[i];
    const Kf = shK(i, t);
    const len = k.h * 0.9 * Kf * m; const ang = Math.atan2(-SUN[1], SUN[0]); // screen direction of shadow
    const dxs = SUN[0] * m, dys = -SUN[1] * m;
    const n = Math.hypot(dxs, dys);
    ctx.fillStyle = 'rgba(70,60,70,0.5)';
    { const un = Math.hypot(...SUN); const ang = Math.atan2(-SUN[1], SUN[0]); ctx.beginPath(); ctx.ellipse(x + SUN[0] / un * len * 0.5, y - SUN[1] / un * len * 0.5, 16 + len * 0.5, 17, ang, 0, TAU); }
    ctx.globalAlpha = smooth(0.012, 0.1, Kf); ctx.fill(); ctx.globalAlpha = 1;
    // shoulders + head
    heads.push({ x, y, k, i, s });
  });
  // Raju: a head that appears at the arc end as the last shadow goes; he never had a shadow
  const rA = smooth(T_VANISH + 0.16 * 12 + 0.6, T_VANISH + 0.16 * 12 + 1.6, t);
  const [rx, ry] = T(R_SLOT[0], R_SLOT[1]);
  for (const hd of heads) {
    const { x, y, k } = hd;
    ctx.fillStyle = 'rgb(250,248,238)'; ctx.beginPath(); ctx.ellipse(x, y, 38, 22, Math.atan2(-hd.s.z + 8, hd.s.x) * 0 + (hd.s.face) * -1 + Math.PI / 2, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(k.hair); ctx.beginPath(); ctx.arc(x, y, 21, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(80,70,60,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 38, 22, (hd.s.face) * -1 + Math.PI / 2, 0, TAU); ctx.stroke();
  }
  // joined hands along the arc
  ctx.strokeStyle = 'rgb(150,100,70)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  heads.slice(0, -1).forEach((h, i) => { const n = heads[i + 1]; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(n.x, n.y); ctx.globalCompositeOperation = 'source-over'; ctx.stroke(); });
  if (rA > 0.01) {
    ctx.globalAlpha = rA; ctx.fillStyle = 'rgb(226,232,232)'; ctx.beginPath(); ctx.ellipse(rx, ry, 38, 22, 1.2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgb(12,14,16)'; ctx.beginPath(); ctx.arc(rx, ry, 21, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(150,150,150,0.8)'; ctx.lineWidth = 5; const [nx, ny] = [heads[0].x, heads[0].y]; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(rx, ry); ctx.stroke();
    // a damp ring on the stone under him
    ctx.strokeStyle = 'rgba(70,60,50,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(rx, ry, 30 + 12 * Math.sin(t * 3), 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // the sun directly overhead: the light blooms and flattens
  const bloom = smooth(0.5, 0.95, p);
  ctx.fillStyle = `rgba(255,252,235,${0.28 * bloom})`; ctx.fillRect(0, 0, 1080, 1920);
  sunGlare(ctx, 0.35 + 0.5 * bloom, 540, 900, 900);
};

// ---- 2D close-ups
function handsCU(ctx, t, lt, dur) {
  const p = lt / dur;
  // blown-out stone background with heat bokeh
  const g = ctx.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#fdf9e8'); g.addColorStop(1, '#e9dfc6'); ctx.fillStyle = g; ctx.fillRect(-100, -100, 1300, 2200);
  const rng = mulberry32(88);
  for (let i = 0; i < 26; i++) { ctx.fillStyle = `rgba(255,255,245,${0.08 + rng() * 0.1})`; ctx.beginPath(); ctx.arc(rng() * 1080, rng() * 1920, 40 + rng() * 120, 0, TAU); ctx.fill(); }
  ctx.save(); ctx.translate(540, 900); const z = 1 + 0.12 * eio(p); ctx.scale(z, z); ctx.translate(-540, -900);
  // the narrator's hand (warm) hanging into frame from the left
  const bob = Math.sin(t * 1.8) * 4;
  ctx.save(); ctx.translate(400, 980 + bob); ctx.rotate(-0.12);
  ctx.fillStyle = '#c28a5e'; ctx.beginPath(); ctx.moveTo(-460, -70); ctx.lineTo(-40, -90); ctx.quadraticCurveTo(100, -100, 150, -20); ctx.quadraticCurveTo(190, 80, 100, 130); ctx.lineTo(-40, 140); ctx.lineTo(-460, 120); ctx.closePath(); ctx.fill();
  for (let f = 0; f < 4; f++) { ctx.strokeStyle = '#c28a5e'; ctx.lineWidth = 46; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(110, -60 + f * 50); ctx.lineTo(210 + f * 6, -60 + f * 50 + 10); ctx.stroke(); }
  // shirt cuff
  ctx.fillStyle = '#f7f5ea'; ctx.fillRect(-520, -150, 120, 320);
  ctx.restore();
  // Raju's hand from the right: pale grey, wet, fingers curled over the narrator's
  const grip = smooth(0.0, 0.35, p);
  ctx.save(); ctx.translate(lerp(900, 640, eo(grip)), 940 + bob * 0.6); ctx.rotate(0.12);
  const skin = '#aeb2b0', dark = '#8d9494';
  ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(500, -90); ctx.lineTo(120, -110); ctx.quadraticCurveTo(-130, -120, -190, -10); ctx.quadraticCurveTo(-230, 90, -120, 150); ctx.lineTo(120, 160); ctx.lineTo(500, 130); ctx.closePath(); ctx.fill();
  for (let f = 0; f < 4; f++) { const y = -70 + f * 52; ctx.strokeStyle = skin; ctx.lineWidth = 48; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-120, y); ctx.quadraticCurveTo(-300, y - 10, -330 + f * 6, y + 40); ctx.stroke(); ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-190, y + 20); ctx.lineTo(-300, y + 30); ctx.stroke(); ctx.fillStyle = '#7f8da0'; ctx.beginPath(); ctx.ellipse(-325 + f * 6, y + 34, 12, 17, 0.4, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = skin; ctx.lineWidth = 50; ctx.beginPath(); ctx.moveTo(60, -110); ctx.quadraticCurveTo(-60, -230, -230, -190); ctx.stroke();
  ctx.fillStyle = '#e4e8e8'; ctx.fillRect(380, -170, 160, 340);
  // water beads + highlights
  const wr = mulberry32(5); for (let i = 0; i < 36; i++) { const bx = -250 + wr() * 640, by = -110 + wr() * 250; const ph = (t * 0.7 + wr() * 3) % 1; ctx.fillStyle = `rgba(235,246,255,${0.65 * (1 - ph)})`; ctx.beginPath(); ctx.ellipse(bx, by, 4 + wr() * 7, 3 + wr() * 5, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(60,70,80,${0.4 * (1 - ph)})`; ctx.lineWidth = 1.5; ctx.stroke(); }
  // drips off the knuckles
  for (let d = 0; d < 3; d++) { const ph = ((t * 0.9 + d * 0.37) % 1); const dx = -300 + d * 90; ctx.fillStyle = 'rgba(220,235,245,0.8)'; ctx.beginPath(); ctx.ellipse(dx, 150 + ph * 420, 5, 9 + ph * 6, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.restore();
  // steam rising off the wet skin in the heat
  const sr = mulberry32(9);
  for (let i = 0; i < 18; i++) { const x = 380 + sr() * 360, ph = ((t * 0.35 + sr() * 4) % 1); ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - ph)})`; ctx.lineWidth = 10 + sr() * 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, 940 - ph * 40); ctx.quadraticCurveTo(x + Math.sin(t * 2 + i) * 30, 800 - ph * 220, x + Math.sin(t * 1.5 + i) * 50, 620 - ph * 300); ctx.stroke(); }
}
R.s5_hand = (ctx, lt, dur, t) => { handsCU(ctx, t, lt, dur); sunGlare(ctx, 0.3, 900, -60, 900); };

// Raju portrait, 2D. cx,cy = face centre; s = scale; eyes 0..1 open; lookUp 0..1; drip time
function portrait(ctx, cx, cy, s, t, o = {}) {
  const eyes = o.eyes ?? 0.1, bow = o.bow ?? 0.4;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  const skin = '#aab0ae', skinD = '#8e9692', hair = '#0d0f12';
  // back hair
  ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(0, -60, 250, 270, 0, 0, TAU); ctx.fill();
  // neck + collar
  ctx.fillStyle = skinD; ctx.fillRect(-85, 190, 170, 220);
  ctx.fillStyle = '#dfe4e4'; ctx.beginPath(); ctx.moveTo(-330, 520); ctx.quadraticCurveTo(-230, 330, -90, 300); ctx.lineTo(0, 400); ctx.lineTo(90, 300); ctx.quadraticCurveTo(230, 330, 330, 520); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(70,80,86,0.5)'; ctx.lineWidth = 5; ctx.stroke();
  // ears
  ctx.fillStyle = skinD; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 218, 20, 36, 54, 0, 0, TAU); ctx.fill(); }
  // face
  ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(0, 270); ctx.bezierCurveTo(-230, 250, -250, 40, -215, -90); ctx.bezierCurveTo(-170, -230, 170, -230, 215, -90); ctx.bezierCurveTo(250, 40, 230, 250, 0, 270); ctx.fill();
  // cheek shadows (backlit, hard)
  { const sg = ctx.createLinearGradient(-230, 0, 230, 0); sg.addColorStop(0, 'rgba(70,84,92,0)'); sg.addColorStop(0.55, 'rgba(70,84,92,0)'); sg.addColorStop(1, 'rgba(70,84,92,0.35)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(0, 270); ctx.bezierCurveTo(-230, 250, -250, 40, -215, -90); ctx.bezierCurveTo(-170, -230, 170, -230, 215, -90); ctx.bezierCurveTo(250, 40, 230, 250, 0, 270); ctx.fill(); }
  // fringe of wet hair with strands
  ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(-235, -40); ctx.bezierCurveTo(-210, -260, 210, -260, 235, -40); ctx.bezierCurveTo(170, -120, 90, -150, 20, -90); ctx.bezierCurveTo(-60, -160, -170, -120, -235, -40); ctx.fill();
  // wet locks: triangular tips hanging over the forehead and down the temples
  ctx.fillStyle = hair;
  const locks = [[-205, -60, 150], [-160, -100, 30], [-110, -115, -26], [-55, -100, -40], [0, -95, -30], [55, -100, -42], [110, -112, -22], [160, -100, 24], [205, -60, 150]];
  locks.forEach((q, i) => { ctx.beginPath(); ctx.moveTo(q[0] - 30, q[1] - 10); ctx.lineTo(q[0] + 30, q[1] - 10); ctx.quadraticCurveTo(q[0] + 14 * (i % 2 ? 1 : -1), (q[1] + q[2]) / 2, q[0] + (i % 3 - 1) * 5, q[2]); ctx.quadraticCurveTo(q[0] - 18 * (i % 2 ? 1 : -1), (q[1] + q[2]) / 2, q[0] - 30, q[1] - 10); ctx.fill(); });
  ctx.strokeStyle = 'rgba(215,232,244,0.65)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; locks.forEach((q, i) => { ctx.beginPath(); ctx.moveTo(q[0] + 4, q[1] - 6); ctx.lineTo(q[0] + 4, (q[1] + q[2]) / 2); ctx.stroke(); });
  // brows
  ctx.strokeStyle = '#15171a'; ctx.lineWidth = 14; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 40, 4 - (1 - eyes) * 2); ctx.quadraticCurveTo(sx * 110, -30, sx * 170, -4); ctx.stroke(); }
  // eyes
  for (const sx of [-1, 1]) {
    const ex = sx * 105, ey = 56;
    ctx.fillStyle = '#e9ecea'; ctx.beginPath(); ctx.ellipse(ex, ey, 52, 26 * Math.max(0.12, eyes), 0, 0, TAU); ctx.fill();
    if (eyes > 0.2) { ctx.fillStyle = '#0b0c0e'; ctx.beginPath(); ctx.arc(ex + (o.look || 0) * 6, ey, 22 * Math.min(1, eyes * 1.2), 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(ex + 7, ey - 7, 5, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#17191c'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(ex, ey, 52, 26 * Math.max(0.12, eyes), 0, Math.PI, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(80,110,130,0.35)'; ctx.beginPath(); ctx.ellipse(ex, ey + 40, 56, 16, 0, 0, TAU); ctx.fill();
  }
  // nose + mouth (slightly blue lips)
  ctx.strokeStyle = 'rgba(60,72,80,0.5)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-14, 70); ctx.quadraticCurveTo(-26, 150, -8, 160); ctx.quadraticCurveTo(14, 170, 26, 150); ctx.stroke();
  ctx.fillStyle = '#6c7f8e'; ctx.beginPath(); ctx.ellipse(0, 212, 54, 12 + (o.mouth || 0) * 14, 0, 0, TAU); ctx.fill();
  // wet sheen + water running down the face
  ctx.fillStyle = 'rgba(235,246,255,0.5)'; for (const [x, y, r] of [[-130, -30, 9], [150, 20, 7], [-60, 150, 8], [110, 140, 6], [30, -20, 6]]) { ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.5, 0, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = 'rgba(225,240,250,0.5)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-150, -60); ctx.quadraticCurveTo(-170, 60, -140, 160); ctx.stroke();
  ctx.restore();
}

// 6) RAJU: wet hair, the drop that never stops falling onto hot stone
R.s6_raju = (ctx, lt, dur, t) => {
  const p = lt / dur;
  const g = ctx.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#fffdf0'); g.addColorStop(0.6, '#f3ecd8'); g.addColorStop(1, '#e2d6bb'); ctx.fillStyle = g; ctx.fillRect(-100, -100, 1300, 2200);
  const rng = mulberry32(61); for (let i = 0; i < 20; i++) { ctx.fillStyle = `rgba(255,255,245,${0.08 + rng() * 0.1})`; ctx.beginPath(); ctx.arc(rng() * 1080, rng() * 1100, 30 + rng() * 110, 0, TAU); ctx.fill(); }
  // hot stone slab, bottom: cracks + drops hit it and flash to steam
  ctx.fillStyle = '#e6dcc2'; ctx.fillRect(0, 1180, 1080, 740);
  ctx.strokeStyle = 'rgba(110,94,74,0.45)'; ctx.lineWidth = 3; for (const c of CRACKS.slice(0, 6)) { ctx.beginPath(); c.forEach((q, j) => { const x = 140 + (q[0] + 9) * 45, y = 1230 + (q[1]) * 36; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }
  const push = 1 + 0.07 * eio(p);
  ctx.save(); ctx.translate(540, 880); ctx.scale(push, push); ctx.translate(-540, -880);
  // bowed head, half out of frame at the top: we mostly see the forehead and wet hair
  portrait(ctx, 540, 520 + (1 - eio(seg(p, 0, 0.5))) * 30, 1.5, t, { eyes: 0.12, bow: 0.5, look: 0 });
  // the drop: forms at the tip of a strand, falls, hits the stone, puffs steam
  const tip = [470, 1020]; const T0 = (t * 0.55) % 1; // loop period 1.8 s
  const fall = smooth(0.0, 0.2, T0), drop = smooth(0.2, 0.55, T0);
  if (T0 < 0.55) { const y = lerp(tip[1] + 10, 1260, drop * drop); ctx.fillStyle = 'rgba(230,244,255,0.95)'; ctx.beginPath(); ctx.ellipse(tip[0], y, 9 * (0.5 + fall * 0.5), 14 * (0.5 + fall * 0.5) * (1 + drop * 0.9), 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(70,90,110,0.55)'; ctx.lineWidth = 2; ctx.stroke(); }
  if (T0 >= 0.55) { const q = (T0 - 0.55) / 0.45; ctx.fillStyle = `rgba(70,56,46,${0.55 * (1 - q)})`; ctx.beginPath(); ctx.ellipse(tip[0], 1262, 30 * (1 - q * 0.8), 10 * (1 - q * 0.8), 0, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - q)})`; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tip[0] - 20, 1250 - q * 20); ctx.quadraticCurveTo(tip[0] - 40, 1180 - q * 160, tip[0] - 10, 1100 - q * 200); ctx.stroke(); ctx.beginPath(); ctx.moveTo(tip[0] + 20, 1250 - q * 20); ctx.quadraticCurveTo(tip[0] + 44, 1190 - q * 140, tip[0] + 14, 1120 - q * 190); ctx.stroke(); }
  ctx.restore();
  sunGlare(ctx, 0.35, 540, -120, 1000);
};

// 7) WHISPER: silence, then his eyes lift
R.s7_whisper = (ctx, lt, dur, t) => {
  const p = lt / dur;
  const g = ctx.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#fffdf0'); g.addColorStop(1, '#ece3cb'); ctx.fillStyle = g; ctx.fillRect(-100, -100, 1300, 2200);
  const wl0 = LINE(8).start_s, wl1 = LINE(8).end_s;
  const open = smooth(wl1 - 1.1, wl1 - 0.2, t);                  // eyes open on the last words
  const push = 1 + 0.2 * eio(p);
  const kick = K.kickAt(lt, wl1 - 0.35, 0.5);
  ctx.save(); ctx.translate(540, 760); ctx.scale(push, push); ctx.translate(-540, -760);
  portrait(ctx, 540 + Math.sin(t * 0.9) * 3, 720, 1.85, t, { eyes: lerp(0.14, 0.95, open), look: 0, mouth: smooth(wl0, wl0 + 0.3, t) * (0.5 + 0.5 * Math.sin(t * 9)) * (t < wl1 ? 1 : 0) });
  ctx.restore();
  sunGlare(ctx, 0.28, 540, -80, 900);
  // heavy dark rim to isolate the face in the white
  const v = ctx.createRadialGradient(540, 760, 300, 540, 760, 1100); v.addColorStop(0, 'rgba(40,36,44,0)'); v.addColorStop(1, `rgba(40,36,44,${0.35 + 0.35 * open})`); ctx.fillStyle = v; ctx.fillRect(-100, -100, 1300, 2200);
  // scare: eyes open + a very short exposure dip (never a full flash)
  if (kick > 0) { ctx.fillStyle = `rgba(20,16,24,${0.5 * kick})`; ctx.fillRect(0, 0, 1080, 1920); }
};

// 8) RELIEF: wind, cicadas back, shadows grow back from every pair of feet
R.s8_relief = (ctx, lt, dur, t) => {
  const p = lt / dur;
  setCam({ x: lerp(-0.6, -1.4, p), y: lerp(1.25, 1.1, p), z: lerp(5.0, 6.2, eio(p)), yaw: lerp(-0.62, -0.7, p), pitch: -0.05 }, t, 0.005);
  worldFrame(ctx, t, { showR: true, rState: rState(t, { handL: null, handR: [(R_SLOT[0] + NAR.ax) / 2, 0.72, (R_SLOT[1] + NAR.az) / 2] }), trail: false });
  sunGlare(ctx, 0.28, 540, -100, 1000);
};

// 9) TWIST: he lets go, steps back, and his shadow stays with Raju
const STEP = { from: null };
function narratorStep(t) {
  const q = eio(seg(t, W(10, 'chhudaya') - 0.05, W(10, 'chhudaya') + 1.3)); // stepping back
  const bx = NAR.ax - 0.9 * 0.9, bz = NAR.az + 0.42 * 0.9 + 0.05; // backward direction (-0.906, 0.42)
  return { x: lerp(NAR.ax, NAR.ax - 0.95, q), z: lerp(NAR.az, NAR.az + 0.45, q), q };
}
function twistState(t) {
  const st = narratorStep(t);
  const slide = eio(seg(t, W(10, 'Meri') - 0.1, W(10, 'Raju') + 0.4));
  // the stolen shadow: base slides from where the narrator stood to Raju's feet
  const base = [lerp(NAR.ax, R_SLOT[0], slide), lerp(NAR.az, R_SLOT[1], slide)];
  return { st, slide, base };
}
R.s9_twist = (ctx, lt, dur, t) => {
  const p = lt / dur; const ts = twistState(t);
  setCam({ x: lerp(-2.4, -2.7, p), y: lerp(1.95, 1.8, p), z: lerp(6.5, 6.8, p), yaw: lerp(-0.6, -0.66, p), pitch: lerp(-0.38, -0.42, p) }, t, 0.005);
  const narr = { x: ts.st.x, z: ts.st.z, handR: null, handL: null, bag: true };
  const rS = rState(t, {});
  rS.handL = null; rS.handR = null;
  worldFrame(ctx, t, { showR: true, rState: rS, narr, nShadow: { sx: ts.base[0], sz: ts.base[1] }, hideKids: false, trail: false, rShadow: null });
  sunGlare(ctx, 0.22, 540, -100, 900);
};

// 10) GATE: Mummy takes Raju in her arms and uses the narrator's name; nobody turns to look at him
R.s10_gate = (ctx, lt, dur, t) => {
  const p = lt / dur;
  const NX = 0.9, NZ = 7.4;
  setCam({ x: lerp(0.5, 0.2, p), y: lerp(1.2, 1.12, p), z: lerp(4.2, 4.7, p), yaw: lerp(-0.04, -0.09, p), pitch: -0.04 }, t, 0.005);
  // Raju walks to Mummy at the gate (carrying the narrator's bag), Mummy opens her arms
  const walk = eio(seg(t, 51.6, 54.2));
  const hugged = smooth(54.0, 54.6, t);
  const gx = -2.2, gz = 15.2;
  const rx = lerp(R_SLOT[0], gx + 0.35, walk), rz = lerp(R_SLOT[1], gz - 0.55, walk);
  const rS = rState(t, { x: rx, z: rz, face: Math.atan2(gx - rx, gz - rz), wet: walk < 1 ? true : true, bag: true, walk: walk > 0.02 && walk < 0.98 ? 6 : 0, handL: null, handR: null });
  const mum = { x: gx, z: gz, face: Math.atan2(rx - gx, rz - gz) + Math.PI * 0, h: 1.52, skin: [160, 108, 74], hair: [24, 18, 18], shirt: [200, 90, 110], shorts: [0, 0, 0], sari: [214, 96, 120], sariTop: [214, 96, 120], ph: 0.2, K: 0.8,
    handL: [gx - 0.3 + 0.15 * hugged, 1.0, gz - 0.2 - 0.2 * hugged], handR: [gx + 0.3 - 0.1 * hugged, 1.0, gz - 0.25 - 0.2 * hugged] };
  // the narrator: no shadow, nobody sees him
  const narr = { x: NX, z: NZ, face: 0.1, handR: [NX + 0.12, 0.5, NZ + 0.05], handL: null, bag: false, ph: 0.4 };
  worldFrame(ctx, t, { showR: true, rState: rS, mum, narr, exit: 51.6, nShadow: { sx: 0, sz: 0 }, hideKids: false, trail: false, rShadow: { K: 0.8 } });
  sunGlare(ctx, 0.22, 540, -100, 900);
};

// 11) LOOP: the narrator alone in the white courtyard, no shadow; wet prints at his feet; the same crawl as the hook
R.s11_loop = (ctx, lt, dur, t) => {
  const p = lt / dur;
  const tilt = eio(seg(p, 0.35, 0.95));
  const NX = -0.2, NZ = 4.4;
  setCam({ x: -0.15, y: lerp(0.22, 1.05, tilt), z: NZ - 1.6, yaw: 0.0, pitch: lerp(0.03, 0.0, tilt) }, t, 0.007, 1.3);
  const narr = { x: NX, z: NZ, h: NAR.h, skin: NAR.skin, hair: NAR.hair, shirt: NAR.shirt, shorts: NAR.shorts, face: Math.PI, handR: [NX - 0.5, lerp(0.5, 1.35, eio(seg(p, 0.55, 0.9))), NZ - 0.1], handL: null, bag: false, ph: 0.4, mouth: 0.5 };
  // the courtyard is empty: only the narrator exists, in a lower (post-noon) sun, and he casts nothing
  drawGround(ctx, t); drawWall(ctx, t); drawTree(ctx, t, 0.8); drawWell(ctx, t);
  // his wet prints: appear one after another at his feet and evaporate
  for (let i = 0; i < 6; i++) { const born = LINE(12).start_s - 0.6 + i * 0.35; const age = t - born; const a = smooth(0, 0.2, age) * (1 - smooth(1.2, 3.2, age)); print(ctx, NX + (i % 2 ? 0.22 : -0.22), NZ - 0.9 + i * 0.28 - 0.5, 0, 1, i % 2 ? 1 : -1, a * 0.9); }
  drawShadow(ctx, { x: NX, z: NZ, h: 1.35 }, 0, 0.5);       // contact blob only: no shadow at all
  drawPerson(ctx, narr, t);
  sunGlare(ctx, 0.3, 540, -100, 900);
};

const MOTE = (() => { const r = mulberry32(404); return Array.from({ length: 70 }, () => ({ x: r() * 1080, y: r() * 1500 + 150, r: 1.5 + r() * 3.2, sp: 20 + r() * 50, ph: r() * TAU })); })();
function motes(ctx, t, a) {
  ctx.save();
  for (const m of MOTE) { const x = ((m.x + t * m.sp * 1.4) % 1160) - 40, y = m.y + Math.sin(t * 1.3 + m.ph) * 28 - (t * m.sp * 0.5 % 40); ctx.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + m.ph))); ctx.fillStyle = 'rgb(130,112,92)'; ctx.beginPath(); ctx.arc(x, y, m.r, 0, TAU); ctx.fill(); }
  ctx.restore();
}
// ---------------------------------------------------------------- post: heat haze, bloom, bleach grade, grain, captions
let BUF = null;
function bufs(w, h) {
  if (!BUF || BUF.w !== w) BUF = { w, h, scene: createCanvas(w, h), small: createCanvas(Math.round(w / 6), Math.round(h / 6)), tmp: createCanvas(w, h) };
  return BUF;
}
const SHIMMER = { s1_hook: 1.0, s3_circle: 0.7, s4_minute: 0.5, s5_hand: 1.0, s6_raju: 0.6, s7_whisper: 0.2, s8_relief: 0.9, s9_twist: 1.0, s10_gate: 1.0, s11_loop: 1.0, s2_dadi: 0.15 };
function caKick(t) {
  const w8 = LINE(8);
  let a = 0.8;
  a += 7 * Math.max(0, 1 - Math.abs(t - (w8.end_s - 0.3)) / 0.4);
  a += 3.5 * Math.max(0, 1 - Math.abs(t - W(10, 'judi')) / 0.5);
  return a;
}

export const VideoClock = {
  _t: 0,
  setTime(sec) { this._t = sec; },
  draw(ctx, width, height, timeline) {
    TL = timeline; const t = this._t; const s = width / 1080;
    const scenes = timeline.scenes; const sc = scenes.find((x) => t >= x.start_s && t < x.end_s) || scenes[scenes.length - 1];
    const lt = t - sc.start_s, dur = sc.end_s - sc.start_s;
    const B = bufs(width, height);
    const c = B.scene.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.filter = 'none';
    c.fillStyle = '#fff'; c.fillRect(0, 0, width, height);
    c.save(); c.scale(s, s); R[sc.id](c, lt, dur, t, sc); if (t > 42.5) motes(c, t, 0.35 + 0.35 * smooth(42.5, 60, t)); c.restore();
    // cut: short dip from white-hot (never a hard flash): fade in from a bright wash
    const inA = 1 - cl(lt / 0.16); if (inA > 0 && sc.start_s > 0) { c.fillStyle = `rgba(255,252,240,${inA * 0.6})`; c.fillRect(0, 0, width, height); }
    // heat shimmer: horizontal strips pushed by a travelling sine; stronger near the horizon band
    const amp = (SHIMMER[sc.id] ?? 0.5) * 5 * s;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
    const strip = Math.max(4, Math.round(6 * s));
    for (let y = 0; y < height; y += strip) {
      const near = 0.5 + 0.5 * Math.exp(-Math.pow((y / height - 0.52) / 0.3, 2));
      const dx = Math.sin(y * 0.05 / s + t * 3.1) * amp * near + Math.sin(y * 0.021 / s - t * 1.7) * amp * 0.6 * near;
      ctx.drawImage(B.scene, 0, y, width, strip, dx, y, width, strip);
    }
    ctx.restore();
    // bloom: downsample, blur, add back
    const sm = B.small.getContext('2d'); sm.setTransform(1, 0, 0, 1, 0, 0); sm.filter = 'none'; sm.clearRect(0, 0, B.small.width, B.small.height); sm.drawImage(ctx.canvas ?? B.scene, 0, 0, B.small.width, B.small.height);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.30; ctx.filter = `blur(${Math.round(10 * s)}px)`; ctx.drawImage(B.small, 0, 0, width, height); ctx.filter = 'none'; ctx.restore();
    // bleach-bypass: pull the saturation down and add a little contrast
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,0.38)'; ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over'; ctx.restore();
    // chromatic split on the scare / the twist
    const ca = caKick(t);
    if (ca > 1.2) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.16 * Math.min(1, (ca - 1) / 4);
      const d = (ca - 1) * s; ctx.drawImage(B.scene, -d, 0); ctx.drawImage(B.scene, d, 0); ctx.restore();
    }
    ctx.save(); ctx.scale(s, s);
    K.grain(ctx, t, 0.07); K.vignette(ctx, 0.28);
    { const [cap, w] = K.captionAt(timeline, t); if (cap) { const g = ctx.createLinearGradient(0, 1120, 0, 1460); g.addColorStop(0, 'rgba(30,26,34,0)'); g.addColorStop(0.5, 'rgba(30,26,34,0.34)'); g.addColorStop(1, 'rgba(30,26,34,0)'); ctx.fillStyle = g; ctx.fillRect(0, 1120, 1080, 340); K.horrorCaption(ctx, cap, w, 1290); } }
    ctx.restore();
  }
};
