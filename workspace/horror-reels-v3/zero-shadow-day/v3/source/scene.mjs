// "Zero Shadow Day": daylight horror. Original code-drawn art, deterministic f(t).
// A small perspective renderer draws the school courtyard in bleached noon light with analytic ground shadows
// (length = height * K, K -> 0 when the sun is at the zenith). Close-ups are 2D illustrations.
import * as K from '../tools/kit.mjs';
import { loadCanvas } from '../skill/code-video-studio/lib/runtime.mjs';
const { createCanvas } = await loadCanvas();
const { cl, seg, eo, eio, lerp, TAU, mulberry32 } = K;

// ---------------------------------------------------------------- timing helpers
let TL = null;
const LINE = (i) => (TL.scenes.flatMap((s) => s.lines).find((l) => l.i === i)) || { start_s: 0, end_s: 0 };
function W(line, word, nth = 0) {
  const ws = TL.words.filter((w) => w.line === line && w.word.replace(/[.,!?]+$/, '').toLowerCase() === word.toLowerCase());
  return (ws[nth] || ws[0] || { start_s: LINE(line).start_s }).start_s;
}
const SS = (id) => (TL.scenes.find((s) => s.id === id) || { start_s: 0 }).start_s;
const TV = () => SS('s4_minute') + 0.24;   // first shadow starts to retreat
const smooth = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const noise1 = (t, s = 0) => Math.sin(t * 1.3 + s) * 0.5 + Math.sin(t * 2.7 + s * 2.1) * 0.3 + Math.sin(t * 5.9 + s * 3.7) * 0.2;
const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// ---------------------------------------------------------------- 3D camera with near-plane clipping
const F = 820;
let CAM = { x: 0, y: 1.2, z: 0, yaw: 0, pitch: 0, roll: 0 };
function setCam(c, t, shake = 0.006, hand = 1) {
  const pr = Math.min(1, t / (TL ? TL.duration_s : 61)); shake *= 1 + 3.2 * pr * pr; hand *= 1 + 2.4 * pr * pr;
  CAM = { ...c };
  CAM.x += noise1(t * 0.7, 1) * 0.015 * hand; CAM.y += noise1(t * 0.6, 2) * 0.01 * hand;
  CAM.yaw += noise1(t * 0.5, 3) * shake; CAM.pitch += noise1(t * 0.55, 4) * shake * 0.8; CAM.roll = (c.roll || 0) + noise1(t * 0.4, 5) * shake * 0.6;
  const tr = smooth(SS('s7_whisper') + 2, TL.duration_s - 3, t); CAM.yaw += tr * 0.011 * (Math.sin(t * 19.3) + 0.6 * Math.sin(t * 31.7 + 1)); CAM.pitch += tr * 0.008 * Math.sin(t * 23.1 + 2); CAM.x += tr * 0.02 * Math.sin(t * 13.7); CAM.y += tr * 0.015 * Math.sin(t * 17.9 + 1);
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
function kBase(t) {
  if (t < SS('s3_circle')) return 0.55;
  if (t < TV()) return lerp(0.55, 0.42, eio(seg(t, SS('s3_circle'), TV())));
  return 0.42;
}
// per-kid shadow factor (index i for stagger, 'N' narrator returns on "Meri")
function shK(i, t) {
  if (t < SS('s2_dadi')) return 0.0;              // hook: flash-forward to the minute
  if (t < TV()) return kBase(t);
  const vt = TV() + 0.16 * i;
  if (t < SS('s8_relief')) return kBase(TV()) * (1 - smooth(vt, vt + 0.7, t));
  const rt = i === 0 ? W(9, 'sabki') - 0.05 : SS('s8_relief') + 0.1 + 0.12 * i;
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
    shirt: i % 4 === 3 ? [214, 208, 190] : [226, 222, 208], shorts: [34 + (kidSeed() * 12 | 0), 52, 98],
    loose: [-5 + kidSeed() * 11, 5.5 + kidSeed() * 6.5], ax, az, a, ph: kidSeed() * TAU
  };
});
const NAR = KIDS[0];
// formation 0 = loose, 1 = in the arc
function formation(t) { return t < SS('s2_dadi') ? 1 : smooth(SS('s3_circle') + 0.26, SS('s3_circle') + 4.0, t); }
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
  const wetTone = o.wet ? 0.4 : (o.grey || 0);
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
    if (o.hairFull) { ctx.beginPath(); ctx.arc(hb[0], hb[1] - hb[2] * 0.02, hb[2] * 1.04, 0, TAU); ctx.fillStyle = col(o.hair); ctx.fill(); }
    if (o.wet) { ctx.strokeStyle = 'rgba(210,225,235,0.45)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(A[0], A[1], hb[2] * 0.82, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke(); }
    // face features only when facing the camera and close enough
    const toCam = [CAM.x - px, CAM.z - pz]; const facing = (fx * toCam[0] + fz * toCam[1]) / (Math.hypot(...toCam) + 1e-6);
    if (o.face2d && facing > 0.25 && hb[2] > 7) {
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
  ctx.save(); ctx.globalAlpha = Math.min(0.95, a * 1.9) * fade;
  poly(ctx, body, 'rgb(30,26,34)');
  // legs split near the base
  const hx = bx + sx * (L + 0.14), hz = bz + sz * (L + 0.14);
  const head = []; for (let j = 0; j < 14; j++) { const q = j / 14 * TAU; head.push([hx + Math.cos(q) * 0.12 + sx * Math.cos(q) * 0.04, 0, hz + Math.sin(q) * 0.12]); }
  poly(ctx, head, 'rgb(30,26,34)');
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

const WELL = [-6.7, 7.3];   // just behind Raju's empty place at the end of the ring
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
    const slot = i === 0 ? { x: R_SLOT[0], z: R_SLOT[1] } : null;   // the narrator's free hand reaches into Raju's empty place
    return { L: f > 0.6 ? mk(Rn) : null, R: f > 0.6 ? mk(L || slot) : null };
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
  const chalk = smooth(SS('s3_circle') + 0.76, SS('s3_circle') + 3.2, t) || (t < SS('s2_dadi') ? 1 : 0);
  if (chalk > 0.01 && !opts.noChalk) {
    ctx.save(); ctx.globalAlpha = 0.7 * chalk;
    for (let j = -84; j < 64; j += 2) { const a1 = j * Math.PI / 180, a2 = (j + 1.2) * Math.PI / 180; poly(ctx, [[Math.sin(a1) * 4.5, 0, 8 + Math.cos(a1) * 4.5 - 0.05], [Math.sin(a2) * 4.5, 0, 8 + Math.cos(a2) * 4.5 - 0.05], [Math.sin(a2) * 4.5, 0, 8 + Math.cos(a2) * 4.5 + 0.05], [Math.sin(a1) * 4.5, 0, 8 + Math.cos(a1) * 4.5 + 0.05]], 'rgb(255,255,252)'); }
    ctx.restore();
  }
  if (trail) drawTrail(ctx, t, trailT0, trailEvap);
  if (opts.extraGround) opts.extraGround(ctx, t);
  // entity list
  const ents = [];
  let states = KIDS.map((k) => kidState(k, t));
  const hp = handPts(states, t);
  KIDS.forEach((k, i) => {
    if (opts.hideKids) return;
    const s = states[i];
    let o = { grey: 0.5 * smooth(TV() - 5, TV() + 2, t) * (1 - smooth(SS('s8_relief') - 0.1, SS('s8_relief') + 1.5, t)), x: s.x, z: s.z, face: s.face, h: k.h, skin: k.skin, hair: k.hair, shirt: k.shirt, shorts: k.shorts, ph: k.ph, handL: hp[i].L, handR: hp[i].R, bag: i === 0 };
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
  return { x: R_SLOT[0], z: R_SLOT[1], face: Math.atan2(ARC_C[0] - R_SLOT[0], ARC_C[1] - R_SLOT[1]), h: 1.38, skin: [150, 140, 134], hair: [14, 14, 16], shirt: [236, 238, 238], shorts: [28, 40, 78], wet: true, hairFull: true, ph: 1.3, ...extra };
}

// ---------------------------------------------------------------- scenes
const R = {};

// 1) HOOK: ground-level look at the ring of faceless children, no shadows; wet bare footprints walk toward the lens, one by one
const HOOK_PR = Array.from({ length: 12 }, (_, i) => { const u = i / 11; return { x: lerp(-0.55, 0.12, u) + (i % 2 ? 0.1 : -0.1) * 0.0, z: lerp(8.4, 5.55, u), side: i % 2 ? 1 : -1, born: 0.2 + i * 0.27 }; });
R.s1_hook = (ctx, lt, dur, t) => {
  const p = lt / dur;
  setCam({ x: lerp(0.0, -0.1, p), y: lerp(0.16, 0.2, p), z: 4.9, yaw: -0.02 - 0.02 * p, pitch: lerp(-0.06, -0.1, p), roll: 0.0 }, t, 0.005, 1.2);
  worldFrame(ctx, t, { noChalk: false, trail: false, extraGround: (c, tt) => {
    for (const q of HOOK_PR) { const age = tt - q.born; const a = smooth(0, 0.08, age) * (1 - smooth(1.8, 3.4, age)); print(c, q.x, q.z, 0, -1, q.side, a, 1.9); }
  } });
  sunGlare(ctx, 0.4, 540, -120, 1100);
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
  const tHands = W(1, 'kisi') - 0.15; const part = t < tHands ? 0 : 1; // first half: Dadi at the door; second half: the hands
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
    // close on hands: Dadi's old hand round the boy's wrist, then it lets go (red finger marks stay)
    const rel = eio(smooth(W(2, 'jayega') - 0.1, W(2, 'jayega') + 0.8, t));
    ctx.save(); ctx.translate(560, 1000); const zz = 1 + 0.06 * cl((t - tHands) / Math.max(0.5, (t - lt + dur) - tHands)); ctx.scale(zz, zz);
    ctx.save(); ctx.scale(-1, 1);
    wristBand(ctx, '#b57c55', '#3a2214', -1100);
    ctx.restore();
    // marks left by her fingers
    ctx.save(); ctx.scale(-1, 1); ctx.strokeStyle = `rgba(190,50,40,${0.55 * smooth(0.1, 0.9, rel)})`; ctx.lineWidth = 12; ctx.lineCap = 'round'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-96 + k * 50, -52); ctx.lineTo(-102 + k * 50, 56); ctx.stroke(); } ctx.restore();
    ctx.save(); ctx.scale(-1, 1); ctx.translate(0, 0); gripHand(ctx, { skin: '#8a5e40', dark: '#2d170c', open: rel, age: 1, bangles: true, t, nail: 'rgba(230,210,190,0.5)' }); ctx.restore();
    ctx.restore();
  }
  ctx.restore();
  // doorway is white-hot: light bleeds over everything slightly
  K.glow(ctx, 840, 880, 900, '255,246,210', 0.14 + 0.06 * Math.sin(t * 1.3));
};

// 3) CIRCLE: from inside the ring, a slow turn across the faceless children holding hands; it ends on the empty gap by the well
R.s3_circle = (ctx, lt, dur, t) => {
  const p = lt / dur;
  const turn = eio(seg(t, LINE(4).start_s - 0.5, LINE(4).start_s + 1.6));
  setCam({ x: lerp(-0.2, 0.3, p) - 1.6 * turn, y: lerp(1.15, 1.0, p), z: lerp(6.0, 7.2, eio(p)) + 0.6 * turn, yaw: lerp(-0.12, 0.0, eio(seg(p, 0, 0.55))) - 1.12 * turn, pitch: lerp(0.0, -0.03, p) }, t, 0.005, 1.4);
  const mj = { x: lerp(1.2, 1.0, p), z: lerp(9.4, 10.2, eio(seg(t, SS('s3_circle') + 0.16, SS('s3_circle') + 3.2))), face: Math.atan2(-1.0, -0.4) + Math.sin(t * 0.9) * 0.15, h: 1.72, skin: [140, 94, 66], hair: [30, 28, 28], shirt: [180, 164, 118], shorts: [96, 84, 70], ph: 0.4, handL: [0.4, 1.4 + 0.2 * Math.sin(t * 2.2), 10.0], K: kBase(t) };
  worldFrame(ctx, t, { master: mj, trail: false });
  sunGlare(ctx, 0.3 + 0.15 * smooth(LINE(4).start_s, SS('s4_minute'), t), 540, -100, 1000);
  // darkness leans in on the well on the "Raju" line
  const wl = smooth(LINE(4).start_s - 0.1, LINE(4).start_s + 0.9, t) * (1 - smooth(LINE(4).end_s - 0.6, LINE(4).end_s, t));
  if (wl > 0.01) { ctx.save(); ctx.globalAlpha = 0.5 * wl; const vg = ctx.createRadialGradient(400, 900, 80, 400, 900, 640); vg.addColorStop(0, 'rgba(255,255,240,0)'); vg.addColorStop(1, 'rgba(10,10,20,0.9)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, 1080, 1920); ctx.restore(); }
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
  const rA = smooth(TV() + 0.16 * 12 + 0.6, TV() + 0.16 * 12 + 1.6, t);
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


// ---------------------------------------------------------------- a hand gripping a wrist (canonical: victim's wrist band lies along x, y in [-62, 62]; gripper arrives from above)
function gripHand(ctx, o) {
  const { skin, dark, open = 0, age = 0, wet = false, t = 0, bangles = false, nail = 'rgba(250,236,230,0.55)' } = o;
  ctx.save(); ctx.translate(0, -open * 190); ctx.rotate(-open * 0.3);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // forearm, coming down from the upper right
  ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(-40, -96); ctx.lineTo(150, -96); ctx.lineTo(300, -760); ctx.lineTo(100, -760); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(-40, -96); ctx.lineTo(100, -760); ctx.stroke(); ctx.globalAlpha = 1;
  if (bangles) for (let b = 0; b < 5; b++) { const y = -190 - b * 34; const x0 = lerp(-40, 100, (y + 96) / -664), x1 = lerp(150, 300, (y + 96) / -664); ctx.strokeStyle = b % 2 ? '#d1ab52' : '#8a3b2c'; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(x0 - 6, y); ctx.lineTo(x1 + 6, y - 10); ctx.stroke(); ctx.strokeStyle = 'rgba(255,240,200,0.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y - 5); ctx.lineTo(x1, y - 14); ctx.stroke(); }
  if (age) { ctx.strokeStyle = dark; ctx.globalAlpha = 0.4 * age; ctx.lineWidth = 3; for (let w = 0; w < 9; w++) { const y = -300 + w * 22; ctx.beginPath(); ctx.moveTo(20 + w * 1.5, y); ctx.quadraticCurveTo(70 + w * 2, y + 8, 120 + w * 3, y - 4); ctx.stroke(); } ctx.globalAlpha = 1; }
  // back of the hand
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(55, -98, 112, 66, -0.05, 0, TAU); ctx.fill();
  if (age) { ctx.strokeStyle = dark; ctx.globalAlpha = 0.45; ctx.lineWidth = 3; for (let v = 0; v < 3; v++) { ctx.beginPath(); ctx.moveTo(-10 + v * 50, -140); ctx.quadraticCurveTo(10 + v * 50, -100, -4 + v * 48, -70); ctx.stroke(); } ctx.globalAlpha = 1; }
  // four fingers wrapped round the wrist; they swing off when the grip opens
  const xs = [96, 46, -4, -54], len = [150, 168, 160, 134];
  for (let f = 0; f < 4; f++) {
    ctx.save(); ctx.translate(xs[f], -84); ctx.rotate(-open * (0.55 + 0.14 * f));
    const L = len[f];
    ctx.strokeStyle = dark; ctx.globalAlpha = 0.55; ctx.lineWidth = 48; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-3, L); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.strokeStyle = skin; ctx.lineWidth = 44; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-3, L); ctx.stroke();
    ctx.strokeStyle = dark; ctx.globalAlpha = 0.55; ctx.lineWidth = 3; for (const yy of [L * 0.34, L * 0.66]) { ctx.beginPath(); ctx.moveTo(-17, yy); ctx.quadraticCurveTo(-3, yy + 6, 14, yy - 2); ctx.stroke(); } ctx.globalAlpha = 1;
    ctx.fillStyle = nail; ctx.beginPath(); ctx.ellipse(-3, L - 4, 13, 10, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // thumb pressing on the front
  ctx.save(); ctx.translate(142, -64); ctx.rotate(2.1 - open * 0.7);
  ctx.strokeStyle = dark; ctx.globalAlpha = 0.55; ctx.lineWidth = 52; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 96); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.strokeStyle = skin; ctx.lineWidth = 47; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 96); ctx.stroke();
  ctx.restore();
  if (wet) { const wr = mulberry32(5); for (let i = 0; i < 30; i++) { const bx = -90 + wr() * 260, by = -150 + wr() * 260; const ph = (t * 0.7 + wr() * 3) % 1; ctx.fillStyle = `rgba(235,246,255,${0.6 * (1 - ph)})`; ctx.beginPath(); ctx.ellipse(bx, by, 3 + wr() * 6, 2 + wr() * 5, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(50,60,70,${0.35 * (1 - ph)})`; ctx.lineWidth = 1.4; ctx.stroke(); } }
  ctx.restore();
}
// the victim's forearm + relaxed hand lying along x (ends at x = 520)
function wristBand(ctx, skin, dark, x0 = -900) {
  ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(x0, -66); ctx.lineTo(430, -60); ctx.quadraticCurveTo(470, -58, 500, -30); ctx.lineTo(520, 40); ctx.quadraticCurveTo(500, 90, 430, 80); ctx.lineTo(x0, 70); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = dark; ctx.globalAlpha = 0.4; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, 66); ctx.lineTo(430, 78); ctx.stroke(); ctx.globalAlpha = 1;
  for (let f = 0; f < 3; f++) { ctx.strokeStyle = skin; ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(470, -34 + f * 34); ctx.lineTo(560 - f * 6, -22 + f * 40 + 20); ctx.stroke(); }
}

// ---- 2D close-ups
function handsCU(ctx, t, lt, dur) {
  const p = lt / dur;
  // blown-out stone background with heat bokeh
  const g = ctx.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#f6f1dd'); g.addColorStop(1, '#cfc4a8'); ctx.fillStyle = g; ctx.fillRect(-100, -100, 1300, 2200);
  const rng = mulberry32(88);
  for (let i = 0; i < 20; i++) { ctx.fillStyle = `rgba(255,255,245,${0.06 + rng() * 0.08})`; ctx.beginPath(); ctx.arc(rng() * 1080, rng() * 1920, 40 + rng() * 120, 0, TAU); ctx.fill(); }
  ctx.save(); ctx.translate(540, 900); const z = 1 + 0.16 * eio(p); ctx.scale(z, z); ctx.translate(-540, -900);
  const bob = Math.sin(t * 1.8) * 3;
  ctx.save(); ctx.translate(380, 960 + bob); ctx.rotate(-0.06);
  // the narrator's wrist, shirt cuff at the left
  wristBand(ctx, '#bd8658', '#5a3a26', -900);
  ctx.fillStyle = '#d9d4c2'; ctx.fillRect(-900, -118, 560, 236); ctx.strokeStyle = 'rgba(60,50,40,0.5)'; ctx.lineWidth = 4; ctx.strokeRect(-900, -118, 560, 236);
  // cold hand arrives from above and takes the wrist
  const grip = eo(smooth(0.0, 0.3, p));
  ctx.save(); ctx.translate(120, lerp(-520, 0, grip));
  gripHand(ctx, { skin: '#9fa6a5', dark: '#4c5a5e', wet: true, t, nail: 'rgba(110,130,150,0.8)' });
  ctx.restore();
  // blue-white pressure marks round the wrist, and drips off the knuckles
  if (grip > 0.95) { ctx.strokeStyle = 'rgba(150,170,190,0.35)'; ctx.lineWidth = 5; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-90 + k * 50, -64); ctx.lineTo(-96 + k * 50, 66); ctx.stroke(); } }
  for (let d = 0; d < 3; d++) { const ph = ((t * 0.9 + d * 0.37) % 1); const dx = -40 + d * 70; ctx.fillStyle = 'rgba(220,235,245,0.85)'; ctx.beginPath(); ctx.ellipse(dx, 80 + ph * 460, 5, 9 + ph * 6, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.restore();
  // steam rising off the wet skin in the heat
  const sr = mulberry32(9);
  for (let i = 0; i < 14; i++) { const x = 380 + sr() * 360, ph = ((t * 0.35 + sr() * 4) % 1); ctx.strokeStyle = `rgba(255,255,255,${0.28 * (1 - ph)})`; ctx.lineWidth = 10 + sr() * 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, 940 - ph * 40); ctx.quadraticCurveTo(x + Math.sin(t * 2 + i) * 30, 800 - ph * 220, x + Math.sin(t * 1.5 + i) * 50, 620 - ph * 300); ctx.stroke(); }
}
R.s5_hand = (ctx, lt, dur, t) => { handsCU(ctx, t, lt, dur); sunGlare(ctx, 0.3, 900, -60, 900); };

// Raju portrait, 2D. cx,cy = face centre; s = scale; eyes 0..1 open; lookUp 0..1; drip time
function portrait(ctx, cx, cy, s, t, o = {}) {
  const eyes = o.eyes ?? 0.1, bow = o.bow ?? 0.4;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  const skin = '#97a19f', skinD = '#78837f', hair = '#080a0c';
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
  const locks = [[-205, -60, 190], [-160, -100, 62], [-110, -115, 18], [-55, -100, 10], [0, -95, 30], [55, -100, 6], [110, -112, 22], [160, -100, 60], [205, -60, 190]];
  locks.forEach((q, i) => { ctx.beginPath(); ctx.moveTo(q[0] - 30, q[1] - 10); ctx.lineTo(q[0] + 30, q[1] - 10); ctx.quadraticCurveTo(q[0] + 14 * (i % 2 ? 1 : -1), (q[1] + q[2]) / 2, q[0] + (i % 3 - 1) * 5, q[2]); ctx.quadraticCurveTo(q[0] - 18 * (i % 2 ? 1 : -1), (q[1] + q[2]) / 2, q[0] - 30, q[1] - 10); ctx.fill(); });
  ctx.strokeStyle = 'rgba(215,232,244,0.65)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; locks.forEach((q, i) => { ctx.beginPath(); ctx.moveTo(q[0] + 4, q[1] - 6); ctx.lineTo(q[0] + 4, (q[1] + q[2]) / 2); ctx.stroke(); });
  // hollow sockets (top-lit noon: the eyes sit in black)
  for (const sx of [-1, 1]) { const sg = ctx.createRadialGradient(sx * 105, 52, 8, sx * 105, 52, 92); sg.addColorStop(0, 'rgba(10,16,20,0.78)'); sg.addColorStop(0.6, 'rgba(14,20,26,0.5)'); sg.addColorStop(1, 'rgba(14,20,26,0)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(sx * 105, 52, 96, 64, 0, 0, TAU); ctx.fill(); }
  // eyes
  for (const sx of [-1, 1]) {
    const ex = sx * 105, ey = 56;
    ctx.fillStyle = '#eef2ef'; ctx.beginPath(); ctx.ellipse(ex, ey, 56, 32 * Math.max(0.12, eyes), 0, 0, TAU); ctx.fill();
    if (eyes > 0.2) { ctx.fillStyle = '#050607'; ctx.beginPath(); ctx.arc(ex + (o.look || 0) * 6, ey, 11 * Math.min(1, eyes * 1.2), 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(150,40,40,0.35)'; ctx.lineWidth = 2; for (let v = 0; v < 5; v++) { const q = v * 1.2 + (sx > 0 ? 0.3 : 1.1); ctx.beginPath(); ctx.moveTo(ex + Math.cos(q) * 54, ey + Math.sin(q) * 20 * eyes); ctx.lineTo(ex + Math.cos(q) * 30, ey + Math.sin(q) * 11 * eyes); ctx.stroke(); } }
    ctx.strokeStyle = '#17191c'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(ex, ey, 52, 26 * Math.max(0.12, eyes), 0, Math.PI, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(80,110,130,0.35)'; ctx.beginPath(); ctx.ellipse(ex, ey + 40, 56, 16, 0, 0, TAU); ctx.fill();
  }
  // bowed head: a curtain of wet hair hides the whole face except the mouth
  if (o.hide) {
    ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(-240, -120); ctx.lineTo(240, -120); ctx.lineTo(236, 150);
    for (let k = 0; k < 9; k++) { const x0 = 236 - k * 59, x1 = x0 - 59; ctx.lineTo(x0 - 20, 150 + 46 + (k % 3) * 22); ctx.lineTo(x1, 150 + (k % 2) * 8); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(215,232,244,0.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.moveTo(-200 + k * 55, -40); ctx.lineTo(-200 + k * 55 + 3, 120); ctx.stroke(); }
  }
  // nose + mouth (slightly blue lips)
  if (!o.hide) { ctx.strokeStyle = 'rgba(60,72,80,0.5)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-14, 70); ctx.quadraticCurveTo(-26, 150, -8, 160); ctx.quadraticCurveTo(14, 170, 26, 150); ctx.stroke(); }
  ctx.fillStyle = '#4c5d6b'; ctx.beginPath(); ctx.ellipse(0, 212, 54, 12 + (o.mouth || 0) * 22, 0, 0, TAU); ctx.fill(); if ((o.mouth || 0) > 0.08) { ctx.fillStyle = '#05080a'; ctx.beginPath(); ctx.ellipse(0, 214, 38, (o.mouth || 0) * 17, 0, 0, TAU); ctx.fill(); }
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
  portrait(ctx, 540, 560 + (1 - eio(seg(p, 0, 0.5))) * 30, 1.5, t, { eyes: 0.12, bow: 0.5, look: 0, hide: true });
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
  const slide = eio(seg(t, W(10, 'parchhai') - 0.1, W(10, 'Raju') + 0.4));
  // the stolen shadow: base slides from where the narrator stood to Raju's feet
  const base = [lerp(NAR.ax, R_SLOT[0], slide), lerp(NAR.az, R_SLOT[1], slide)];
  return { st, slide, base };
}
R.s9_twist = (ctx, lt, dur, t) => {
  const p = lt / dur; const ts = twistState(t);
  const cx = -2.7, cz = 6.9;
  setCam({ x: lerp(cx, cx + 0.2, p), y: lerp(0.62, 0.7, p), z: lerp(cz, cz + 0.2, p), yaw: lerp(-0.52, -0.46, p), pitch: lerp(-0.06, -0.04, p) }, t, 0.004, 1.2);
  const narr = { x: ts.st.x, z: ts.st.z, handR: null, handL: null, bag: true };
  const rS = rState(t, {});
  rS.handL = null; rS.handR = null;
  worldFrame(ctx, t, { showR: true, rState: rS, narr, nShadow: { sx: ts.base[0], sz: ts.base[1] }, hideKids: false, trail: false, rShadow: null });
  sunGlare(ctx, 0.2, 540, -100, 900);
};

// 10) GATE: Mummy walks in and takes Raju in her arms, using the narrator's name; the narrator stands small and shadowless behind them
R.s10_gate = (ctx, lt, dur, t) => {
  const p = lt / dur;
  setCam({ x: lerp(-1.6, -1.75, p), y: lerp(1.0, 0.95, p), z: lerp(5.6, 5.9, p), yaw: lerp(-0.28, -0.3, p), pitch: -0.02 }, t, 0.004, 1.2);
  const g0 = SS('s10_gate'); const mw = eio(seg(t, g0 + 0.1, g0 + 2.6));
  const hugged = smooth(g0 + 2.6, g0 + 3.3, t);
  const rj = [R_SLOT[0] + 0.25 * eio(seg(t, g0 + 2.0, g0 + 2.8)), R_SLOT[1] + 0.05];
  const mm = [lerp(-2.4, R_SLOT[0] + 0.78, mw), lerp(14.8, R_SLOT[1] + 0.02, mw)];
  const mface = Math.atan2(rj[0] - mm[0], rj[1] - mm[1]);
  const sdx = Math.cos(mface), sdz = -Math.sin(mface);   // sideways
  const rS = rState(t, { x: rj[0], z: rj[1], face: mface + Math.PI, wet: true, bag: true, handL: [mm[0] + sdx * 0.16, 1.0, mm[1] + sdz * 0.16], handR: [mm[0] - sdx * 0.16, 1.0, mm[1] - sdz * 0.16] });
  const mum = { x: mm[0], z: mm[1], face: mface, walk: mw > 0.02 && mw < 0.98 ? 6 : 0, h: 1.55, skin: [160, 108, 74], hair: [24, 18, 18], shirt: [200, 90, 110], shorts: [0, 0, 0], sari: [200, 84, 108], sariTop: [200, 84, 108], ph: 0.2, K: 0.8,
    handL: [lerp(mm[0] + sdx * 0.3, rj[0] - sdx * 0.14, hugged), lerp(1.0, 1.05, hugged), lerp(mm[1] + sdz * 0.3, rj[1] - sdz * 0.14, hugged)], handR: [lerp(mm[0] - sdx * 0.3, rj[0] + sdx * 0.14, hugged), lerp(1.0, 1.05, hugged), lerp(mm[1] - sdz * 0.3, rj[1] + sdz * 0.14, hugged)] };
  const NX = -0.9, NZ = 11.0;
  const narr = { x: NX, z: NZ, face: Math.PI + 0.2, handR: [NX + 0.1, 0.5, NZ + 0.05], handL: null, bag: false, ph: 0.4 };
  worldFrame(ctx, t, { showR: true, rState: rS, mum, narr, exit: g0 + 0.6, nShadow: { sx: 0, sz: 0 }, hideKids: false, trail: false, rShadow: { K: 0.8 } });
  sunGlare(ctx, 0.2, 540, -100, 900);
};

// 11) LOOP: the narrator alone in the white courtyard, no shadow; wet prints at his feet; the same crawl as the hook
R.s11_loop = (ctx, lt, dur, t) => {
  const p = lt / dur;
  const tilt = eio(seg(p, 0.35, 0.95));
  const NX = -0.2, NZ = 4.4;
  setCam({ x: -0.15, y: lerp(0.22, 1.05, tilt), z: NZ - lerp(1.9, 1.2, eio(p)), yaw: 0.0, pitch: lerp(0.03, 0.0, tilt) }, t, 0.007, 1.3);
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
const SHIMMER = { s1_hook: 0.5, s3_circle: 0.25, s4_minute: 0.3, s5_hand: 0.35, s6_raju: 0.3, s7_whisper: 0.1, s8_relief: 0.25, s9_twist: 0.2, s10_gate: 0.2, s11_loop: 0.3, s2_dadi: 0.1 };
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
    c.save(); c.scale(s, s); R[sc.id](c, lt, dur, t, sc); if (t > SS('s7_whisper') + 2) motes(c, t, 0.35 + 0.5 * smooth(SS('s7_whisper') + 2, TL.duration_s - 1, t)); c.restore();
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
    ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,0.55)'; ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over'; ctx.restore();
    // chromatic split on the scare / the twist
    const ca = caKick(t);
    if (ca > 1.2) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.16 * Math.min(1, (ca - 1) / 4);
      const d = (ca - 1) * s; ctx.drawImage(B.scene, -d, 0); ctx.drawImage(B.scene, d, 0); ctx.restore();
    }
    ctx.save(); ctx.scale(s, s);
    if (sc.id !== 's2_dadi') {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply';
      const gg = ctx.createLinearGradient(0, 0, 0, height); gg.addColorStop(0, 'rgb(214,212,204)'); gg.addColorStop(0.45, 'rgb(150,148,140)'); gg.addColorStop(1, 'rgb(96,94,92)');
      ctx.fillStyle = gg; ctx.fillRect(0, 0, width, height); ctx.restore();
    }
    { const amp = 0.04 + 0.16 * smooth(SS('s7_whisper') + 2, TL.duration_s - 1, t); const fl = amp * (0.5 + 0.5 * Math.sin(t * 8.3) * Math.sin(t * 5.1 + 1)); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(0,0,0,${fl})`; ctx.fillRect(0, 0, width, height); ctx.restore(); }
    K.grain(ctx, t, 0.09); K.vignette(ctx, 0.6);
    { const [cap, w] = K.captionAt(timeline, t); if (cap) { const g = ctx.createLinearGradient(0, 1120, 0, 1460); g.addColorStop(0, 'rgba(30,26,34,0)'); g.addColorStop(0.5, 'rgba(30,26,34,0.34)'); g.addColorStop(1, 'rgba(30,26,34,0)'); ctx.fillStyle = g; ctx.fillRect(0, 1120, 1080, 340); K.horrorCaption(ctx, cap, w, 1290); } }
    ctx.restore();
  }
};
