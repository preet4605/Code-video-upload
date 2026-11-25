// Pilot v2: "Ginti" (the hostel night count). Original code-drawn art, deterministic f(t).
// A small perspective renderer draws the dorm in 3D so the camera can dolly, pan and shake;
// close-ups are hand-built 2D illustrations. Post: CA split, fog, grain, vignette, captions.
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
const smooth = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const noise1 = (t, s = 0) => Math.sin(t * 1.3 + s) * 0.5 + Math.sin(t * 2.7 + s * 2.1) * 0.3 + Math.sin(t * 5.9 + s * 3.7) * 0.2;

// ---------------------------------------------------------------- 3D camera
const F = 820; // focal length (px)
let CAM = { x: 0, y: 1.2, z: 0, yaw: 0, pitch: 0, roll: 0 };
function setCam(c, t, shake = 0.012, hand = 1) {
  CAM = { ...c };
  CAM.x += noise1(t * 0.7, 1) * 0.02 * hand; CAM.y += noise1(t * 0.6, 2) * 0.015 * hand;
  CAM.yaw += noise1(t * 0.5, 3) * shake; CAM.pitch += noise1(t * 0.55, 4) * shake * 0.8; CAM.roll = (c.roll || 0) + noise1(t * 0.4, 5) * shake * 0.6;
}
function P(x, y, z) {
  let dx = x - CAM.x, dy = y - CAM.y, dz = z - CAM.z;
  const cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw);
  let x1 = dx * cy - dz * sy, z1 = dx * sy + dz * cy;
  const cp = Math.cos(CAM.pitch), sp = Math.sin(CAM.pitch);
  let y1 = dy * cp - z1 * sp, z2 = dy * sp + z1 * cp;
  const zz = Math.max(0.05, z2);
  const cr = Math.cos(CAM.roll), sr = Math.sin(CAM.roll);
  const sx = (x1 * cr - y1 * sr) * F / zz, syy = (x1 * sr + y1 * cr) * F / zz;
  return [540 + sx, 960 - syy, z2];
}
function quad(ctx, pts, fill) {
  const pp = pts.map((p) => P(...p));
  if (pp.some((p) => p[2] < 0.08)) return null;
  ctx.beginPath(); ctx.moveTo(pp[0][0], pp[0][1]); for (let i = 1; i < pp.length; i++) ctx.lineTo(pp[i][0], pp[i][1]); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); return pp;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ---------------------------------------------------------------- lighting
// lights recomputed per frame
let L = { torch: null, door: 0, doorFlick: 1, moon: 0.28, amb: 0.05, tube: 0 };
const WINDOWS = [3.2, 8.3, 13.4, 18.5]; // left wall window z centres
function lightAt(x, y, z) {
  let b = L.amb, warm = 0;
  // moonlight patches from left windows falling to the right and down
  for (const wz of WINDOWS) {
    const px = x + 3 - (2.4 - y) * 0.9; // shaft slants
    const m = Math.exp(-((z - wz - 0.2) ** 2) / 0.35) * Math.exp(-(px * px) / 4.5);
    b += L.moon * m;
  }
  if (L.door > 0) { const d = Math.hypot(x, y - 1.2, z - 25.4); b += L.door * L.doorFlick * 2.6 / (1 + d * d * 0.18); }
  if (L.torch) {
    const T = L.torch;
    const v = [x - T.p[0], y - T.p[1], z - T.p[2]]; const d = Math.hypot(...v) + 1e-6;
    const a = [T.a[0] - T.p[0], T.a[1] - T.p[1], T.a[2] - T.p[2]]; const da = Math.hypot(...a);
    const c = (v[0] * a[0] + v[1] * a[1] + v[2] * a[2]) / (d * da);
    const cone = smooth(0.955, 0.992, c);
    const k = T.k * cone * 3.2 / (1 + d * d * 0.35);
    b += k; warm += k;
  }
  return [b, warm];
}
function shade(rgb, x, y, z, extra = 0) {
  const [b0, warm] = lightAt(x, y, z); const b = b0 + extra;
  // distance fog toward near-black blue
  const dz = Math.max(0, z - CAM.z); const fog = 1 - Math.exp(-dz * 0.035);
  const tm = 1.25 * (1 - Math.exp(-b * 2.0)); const wm = Math.min(1, warm);
  const r = rgb[0] * tm * (1 + wm * 0.22), g = rgb[1] * tm * (1 + wm * 0.1), bl = rgb[2] * tm * (1 - wm * 0.12);
  const fr = 10, fg = 12, fb = 18;
  return `rgb(${Math.min(255, lerp(r, fr, fog)) | 0},${Math.min(255, lerp(g, fg, fog)) | 0},${Math.min(255, lerp(bl, fb, fog)) | 0})`;
}

// ---------------------------------------------------------------- dorm geometry
const NB = 14, BZ0 = 1.6, BDZ = 1.7; // beds per side
const bedZ = (i) => BZ0 + i * BDZ;
const MY_BED = { side: 1, i: 0 }; // right side, first bed by the corner (nearest the camera end)
const R0 = mulberry32(91);
const STAINS = Array.from({ length: 70 }, () => ({ side: R0() < 0.5 ? -1 : 1, z: R0() * 25, y: 0.3 + R0() * 2.6, r: 0.1 + R0() * 0.5, a: 0.15 + R0() * 0.35 }));
const CRACKS = Array.from({ length: 16 }, () => { const side = R0() < 0.5 ? -1 : 1, z = R0() * 24, y = 1.8 + R0() * 1.2; const pts = [[z, y]]; for (let k = 0; k < 6; k++) { const p = pts[pts.length - 1]; pts.push([p[0] + (R0() - 0.5) * 0.4, p[1] - R0() * 0.25]); } return { side, pts }; });
const BEDINFO = Array.from({ length: 2 * NB }, (_, k) => ({ ph: R0() * TAU, rate: 0.9 + R0() * 0.5, bucket: R0() < 0.45, slip: R0() < 0.6, locker: R0() < 0.5, curl: 0.7 + R0() * 0.5 }));

function walls(ctx) {
  // floor tiles
  for (let z = 0; z < 25.5; z += 0.85) {
    for (let x = -3; x < 3; x += 0.75) {
      const c = ((Math.round(z / 0.85) + Math.round(x / 0.75)) & 1) ? [70, 66, 60] : [58, 55, 50];
      quad(ctx, [[x, 0, z], [x + 0.75, 0, z], [x + 0.75, 0, z + 0.85], [x, 0, z + 0.85]], shade(c, x + 0.37, 0, z + 0.4));
    }
  }
  // side walls in strips (lighting varies along z)
  for (const side of [-1, 1]) {
    for (let z = 0; z < 25.5; z += 0.5) {
      quad(ctx, [[3 * side, 0, z], [3 * side, 0, z + 0.5], [3 * side, 1.1, z + 0.5], [3 * side, 1.1, z]], shade([58, 74, 70], 3 * side, 0.5, z + 0.25)); // dado (green oil paint)
      quad(ctx, [[3 * side, 1.1, z], [3 * side, 1.1, z + 0.5], [3 * side, 3.2, z + 0.5], [3 * side, 3.2, z]], shade([150, 146, 132], 3 * side, 2, z + 0.25)); // whitewash
    }
  }
  // ceiling
  for (let z = 0; z < 25.5; z += 1) quad(ctx, [[-3, 3.2, z], [3, 3.2, z], [3, 3.2, z + 1], [-3, 3.2, z + 1]], shade([110, 108, 100], 0, 3.1, z + 0.5));
  // damp stains and cracks
  for (const s of STAINS) {
    const p = P(3 * s.side, s.y, s.z); if (p[2] < 0.3) continue;
    const r = s.r * F / p[2];
    const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
    g.addColorStop(0, `rgba(30,26,18,${s.a * 0.6})`); g.addColorStop(1, 'rgba(30,26,18,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p[0], p[1], r * 0.45, r, 0, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(15,12,10,0.6)'; ctx.lineWidth = 1.5;
  for (const c of CRACKS) { ctx.beginPath(); c.pts.forEach(([z, y], k) => { const p = P(3 * c.side, y, z); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.stroke(); }
  // windows (left wall) with bars + night sky
  for (const wz of WINDOWS) {
    const sky = (0.35 + L.moon) * 1.0;
    quad(ctx, [[-2.99, 1.35, wz - 0.55], [-2.99, 1.35, wz + 0.55], [-2.99, 2.55, wz + 0.55], [-2.99, 2.55, wz - 0.55]], `rgb(${30 * sky | 0},${42 * sky | 0},${64 * sky | 0})`);
    for (let k = 0; k <= 6; k++) { const z = wz - 0.55 + k * 0.183; quad(ctx, [[-2.98, 1.35, z - 0.015], [-2.98, 1.35, z + 0.015], [-2.98, 2.55, z + 0.015], [-2.98, 2.55, z - 0.015]], '#0b0c0e'); }
    quad(ctx, [[-2.98, 1.93, wz - 0.55], [-2.98, 1.93, wz + 0.55], [-2.98, 1.97, wz + 0.55], [-2.98, 1.97, wz - 0.55]], '#0b0c0e');
  }
  // far wall + door
  quad(ctx, [[-3, 0, 25.5], [3, 0, 25.5], [3, 3.2, 25.5], [-3, 3.2, 25.5]], shade([120, 116, 104], 0, 1.5, 25.2));
  const open = L.doorOpen ?? 0;
  const corridor = 0.6 + 0.4 * L.doorFlick;
  quad(ctx, [[-0.6, 0, 25.5], [0.6, 0, 25.5], [0.6, 2.2, 25.5], [-0.6, 2.2, 25.5]], open > 0.02 ? `rgb(${170 * corridor | 0},${190 * corridor | 0},${170 * corridor | 0})` : '#050506');
  // door leaf swings into the room on a hinge at x=-0.6
  const ang = open * 1.45; const lx = -0.6 + Math.cos(ang) * 1.2, lz = 25.5 - Math.sin(ang) * 1.2;
  quad(ctx, [[-0.6, 0, 25.5], [lx, 0, lz], [lx, 2.2, lz], [-0.6, 2.2, 25.5]], shade([62, 44, 30], (lx - 0.6) / 2, 1.1, (lz + 25.5) / 2));
}

function fan(ctx, z, t, speed = 1.1) {
  const top = P(0, 3.2, z), bot = P(0, 2.85, z); if (bot[2] < 0.3) return;
  ctx.strokeStyle = '#141414'; ctx.lineWidth = Math.max(1, 0.04 * F / bot[2]); ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(bot[0], bot[1]); ctx.stroke();
  const a0 = t * speed * TAU;
  for (let k = 0; k < 3; k++) {
    const a = a0 + k * TAU / 3; const c = Math.cos(a), s = Math.sin(a); const c2 = Math.cos(a + 0.22), s2 = Math.sin(a + 0.22);
    quad(ctx, [[0.08 * c, 2.84, z + 0.08 * s], [0.75 * c, 2.86, z + 0.75 * s], [0.75 * c2, 2.86, z + 0.75 * s2], [0.08 * c2, 2.84, z + 0.08 * s2]], shade([60, 58, 52], 0, 2.8, z));
  }
  const hub = P(0, 2.83, z); K.circ(ctx, hub[0], hub[1], 0.09 * F / hub[2], '#1b1a18');
}

// one bed; occupant: 0 none, 1 sleeper, 2 sleeper + second body behind (the 29th)
function bed(ctx, side, i, t, { occupant = 1, breathe = 1, still = 0, extra = 0 } = {}) {
  const z = bedZ(i), info = BEDINFO[i + (side > 0 ? NB : 0)];
  const xi = 1.05 * side, xo = 2.95 * side, zn = z - 0.45, zf = z + 0.45;
  const x0 = Math.min(xi, xo), x1 = Math.max(xi, xo);
  const S = (rgb, x, y, zz, e = 0) => shade(rgb, x, y, zz, e + extra);
  // shadow under bed
  quad(ctx, [[x0, 0.005, zn], [x1, 0.005, zn], [x1, 0.005, zf], [x0, 0.005, zf]], 'rgba(0,0,0,0.55)');
  // bucket + slippers in the aisle
  if (info.bucket) { const bx = 0.85 * side; const p = quad(ctx, [[bx - 0.13, 0, z - 0.25], [bx + 0.13, 0, z - 0.25], [bx + 0.13, 0.3, z - 0.25], [bx - 0.13, 0.3, z - 0.25]], S([40, 70, 120], bx, 0.15, z - 0.25)); }
  if (info.slip) { for (const dz of [0.1, 0.24]) quad(ctx, [[0.8 * side, 0.01, z + dz], [0.55 * side, 0.01, z + dz], [0.55 * side, 0.01, z + dz + 0.1], [0.8 * side, 0.01, z + dz + 0.1]], S([90, 40, 30], 0.7 * side, 0, z)); }
  // legs
  for (const lx of [xi, xo]) for (const lz of [zn, zf]) quad(ctx, [[lx, 0, lz], [lx, 0.5, lz], [lx + 0.04, 0.5, lz], [lx + 0.04, 0, lz]], '#0e0e10');
  // mattress: near face, aisle end face, top
  quad(ctx, [[x0, 0.38, zn], [x1, 0.38, zn], [x1, 0.55, zn], [x0, 0.55, zn]], S([70, 64, 56], (x0 + x1) / 2, 0.45, zn));
  quad(ctx, [[xi, 0.38, zn], [xi, 0.38, zf], [xi, 0.55, zf], [xi, 0.55, zn]], S([62, 58, 50], xi, 0.45, z));
  quad(ctx, [[x0, 0.55, zn], [x1, 0.55, zn], [x1, 0.55, zf], [x0, 0.55, zf]], S([120, 112, 98], (x0 + x1) / 2, 0.55, z));
  // pillow
  const px = 2.55 * side;
  quad(ctx, [[px - 0.28, 0.62, z - 0.32], [px + 0.28, 0.62, z - 0.32], [px + 0.28, 0.62, z + 0.32], [px - 0.28, 0.62, z + 0.32]], S([170, 166, 150], px, 0.62, z));
  // occupant(s): blanket body = thick stroked centreline; head on pillow
  const br = breathe * (1 - still) * 0.035 * Math.sin(t * info.rate * 1.9 + info.ph);
  const body = (dz, col, hb = 0) => {
    const pts = []; for (let k = 0; k <= 10; k++) { const u = k / 10; const x = lerp(2.35, 1.25, u) * side; const y = 0.62 + 0.16 * Math.sin(Math.PI * Math.min(1, u * 1.25)) * info.curl + (u < 0.6 ? br + hb : 0); pts.push(P(x, y, z + dz + Math.sin(u * 3) * 0.05)); }
    if (pts.some((p) => p[2] < 0.15)) return;
    const w = 0.5 * F / pts[4][2];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    // blanket fold highlights
    ctx.lineWidth = w * 0.08; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    for (const f of [0.3, 0.55, 0.75]) { const a = pts[Math.round(f * 10)]; ctx.beginPath(); ctx.moveTo(a[0] - w * 0.2, a[1] - w * 0.3); ctx.quadraticCurveTo(a[0], a[1], a[0] + w * 0.15, a[1] + w * 0.35); ctx.stroke(); }
  };
  if (occupant >= 2) body(0.2, S([46, 44, 52], 1.8 * side, 0.7, z + 0.2), 0.03 * Math.sin(t * 2.3)); // second shape, out of sync breathing
  if (occupant >= 1) {
    body(-0.05, S([58, 64, 84], 1.8 * side, 0.7, z));
    const h = P(2.5 * side, 0.74, z - 0.05); if (h[2] > 0.15) K.circ(ctx, h[0], h[1], 0.12 * F / h[2], S([24, 18, 14], 2.5 * side, 0.74, z));
    if (occupant >= 2) { const h2 = P(2.62 * side, 0.78, z + 0.2); if (h2[2] > 0.15) K.circ(ctx, h2[0], h2[1], 0.12 * F / h2[2], S([14, 12, 12], 2.6 * side, 0.78, z + 0.2)); }
  }
  // iron head rail at the wall end
  const hx = 2.93 * side;
  for (let k = 0; k <= 5; k++) { const zz = zn + k * 0.18; quad(ctx, [[hx, 0.55, zz - 0.012], [hx, 1.05, zz - 0.012], [hx, 1.05, zz + 0.012], [hx, 0.55, zz + 0.012]], '#121214'); }
  quad(ctx, [[hx, 1.02, zn], [hx, 1.07, zn], [hx, 1.07, zf], [hx, 1.02, zf]], '#18181a');
  // steel almirah between some beds
  if (info.locker) { const lz = z + 0.85; quad(ctx, [[2.6 * side, 0, lz - 0.02], [2.95 * side, 0, lz - 0.02], [2.95 * side, 1.8, lz - 0.02], [2.6 * side, 1.8, lz - 0.02]], S([70, 78, 80], 2.8 * side, 1, lz)); quad(ctx, [[2.6 * side, 0, lz - 0.02], [2.6 * side, 0, lz + 0.3], [2.6 * side, 1.8, lz + 0.3], [2.6 * side, 1.8, lz - 0.02]], S([56, 62, 64], 2.6 * side, 1, lz + 0.15)); }
}

function warden(ctx, x, z, t, { torchUp = 0 } = {}) {
  const f = P(x, 0, z), h = P(x, 1.78, z); if (f[2] < 0.4) return;
  const sc = F / f[2]; const sway = Math.sin(t * 1.3) * 0.02 * sc;
  ctx.save(); ctx.fillStyle = '#050506';
  // long shadow toward camera from door light
  if (L.door > 0.05) { const s1 = P(x - 0.3, 0.003, z), s2 = P(x + 0.3, 0.003, z), s3 = P(x + 0.5, 0.003, Math.max(CAM.z + 0.6, z - 7)), s4 = P(x - 0.5, 0.003, Math.max(CAM.z + 0.6, z - 7)); ctx.globalAlpha = 0.55 * L.door; ctx.beginPath(); ctx.moveTo(s1[0], s1[1]); ctx.lineTo(s2[0], s2[1]); ctx.lineTo(s3[0], s3[1]); ctx.lineTo(s4[0], s4[1]); ctx.fill(); ctx.globalAlpha = 1; }
  const cx = f[0] + sway, top = h[1];
  ctx.beginPath(); // coat body
  ctx.moveTo(cx - 0.16 * sc, f[1]); ctx.lineTo(cx - 0.26 * sc, top + 0.32 * sc); ctx.quadraticCurveTo(cx, top + 0.18 * sc, cx + 0.26 * sc, top + 0.32 * sc); ctx.lineTo(cx + 0.18 * sc, f[1]); ctx.closePath(); ctx.fill();
  K.ell(ctx, cx, top + 0.1 * sc, 0.1 * sc, 0.12 * sc, '#050506'); // head
  K.ell(ctx, cx, top + 0.01 * sc, 0.13 * sc, 0.03 * sc, '#050506'); // cap brim
  // rim light from door
  if (L.door > 0.05) { ctx.strokeStyle = `rgba(200,220,200,${0.35 * L.door * L.doorFlick})`; ctx.lineWidth = 0.015 * sc; ctx.beginPath(); ctx.moveTo(cx - 0.26 * sc, top + 0.32 * sc); ctx.quadraticCurveTo(cx, top + 0.18 * sc, cx + 0.26 * sc, top + 0.32 * sc); ctx.stroke(); }
  // arm + torch
  const hand = P(x + 0.28, 1.15 + torchUp * 0.25, z - 0.25);
  ctx.strokeStyle = '#050506'; ctx.lineWidth = 0.09 * sc; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + 0.2 * sc, top + 0.4 * sc); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
  ctx.restore();
}

// volumetric torch cone (additive) + lit dust inside the beam + lens glare when it faces camera
const BEAMDUST = (() => { const r = mulberry32(5); return Array.from({ length: 140 }, () => ({ u: r(), a: r() * TAU, rr: Math.sqrt(r()), ph: r() * TAU })); })();
function torchBeam(ctx, t, k = 1) {
  const T = L.torch; if (!T || T.k <= 0) return;
  const p = P(...T.p); if (p[2] < 0.1) return;
  const a = [T.a[0] - T.p[0], T.a[1] - T.p[1], T.a[2] - T.p[2]]; const da = Math.hypot(...a); const dir = a.map((v) => v / da);
  // perpendicular basis
  const up = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = [dir[1] * up[2] - dir[2] * up[1], dir[2] * up[0] - dir[0] * up[2], dir[0] * up[1] - dir[1] * up[0]]; const ul = Math.hypot(...u); u.forEach((v, i) => (u[i] = v / ul));
  const v2 = [dir[1] * u[2] - dir[2] * u[1], dir[2] * u[0] - dir[0] * u[2], dir[0] * u[1] - dir[1] * u[0]];
  const len = da, rad = len * 0.16;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const N = 18; const ring = [];
  for (let i = 0; i < N; i++) { const an = (i / N) * TAU; const q = [T.a[0] + (u[0] * Math.cos(an) + v2[0] * Math.sin(an)) * rad, T.a[1] + (u[1] * Math.cos(an) + v2[1] * Math.sin(an)) * rad, T.a[2] + (u[2] * Math.cos(an) + v2[2] * Math.sin(an)) * rad]; ring.push(P(...q)); }
  if (ring.every((q) => q[2] > 0.1)) {
    const end = P(...T.a);
    const g = ctx.createLinearGradient(p[0], p[1], end[0], end[1]); g.addColorStop(0, `rgba(255,236,200,${0.22 * k * T.k})`); g.addColorStop(1, `rgba(255,236,200,${0.04 * k * T.k})`);
    ctx.fillStyle = g;
    for (let i = 0; i < N; i++) { const q1 = ring[i], q2 = ring[(i + 1) % N]; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.closePath(); ctx.globalAlpha = 0.18; ctx.fill(); }
    ctx.globalAlpha = 1;
    // pool where it lands
    const pr = rad * F / end[2]; K.glow(ctx, end[0], end[1], pr * 1.4, '255,226,180', 0.16 * T.k);
    // dust motes
    for (const d of BEAMDUST) {
      const s = (d.u + t * 0.02) % 1; const rr = d.rr * rad * s * 0.95; const an = d.a + t * 0.15;
      const q = P(T.p[0] + a[0] * s + (u[0] * Math.cos(an) + v2[0] * Math.sin(an)) * rr, T.p[1] + a[1] * s + (u[1] * Math.cos(an) + v2[1] * Math.sin(an)) * rr + Math.sin(t + d.ph) * 0.03, T.p[2] + a[2] * s + (u[2] * Math.cos(an) + v2[2] * Math.sin(an)) * rr);
      if (q[2] < 0.15) continue; ctx.globalAlpha = 0.5 * T.k * (0.5 + 0.5 * Math.sin(t * 2 + d.ph)); K.circ(ctx, q[0], q[1], Math.max(0.6, 0.012 * F / q[2]), '#fff2d8');
    }
  }
  // glare when the torch points toward the camera
  const toCam = [CAM.x - T.p[0], CAM.y - T.p[1], CAM.z - T.p[2]]; const dc = Math.hypot(...toCam);
  const facing = (toCam[0] * dir[0] + toCam[1] * dir[1] + toCam[2] * dir[2]) / dc;
  const gl = smooth(0.93, 0.997, facing) * T.k;
  ctx.globalAlpha = 1; K.glow(ctx, p[0], p[1], 26 + gl * 300, '255,240,215', 0.35 + gl * 0.5);
  if (gl > 0.5) { ctx.globalAlpha = (gl - 0.5) * 0.4; ctx.fillStyle = 'rgba(255,230,200,0.5)'; ctx.fillRect(p[0] - 500, p[1] - 1.5, 1000, 3); }
  ctx.restore();
}

function moonShafts(ctx, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const wz of WINDOWS) {
    const a = 0.05 * L.moon / 0.28 * (0.85 + 0.15 * Math.sin(t * 0.3 + wz));
    const q = [P(-2.98, 2.55, wz - 0.5), P(-2.98, 2.55, wz + 0.5), P(0.6, 0.0, wz + 0.9), P(0.6, 0.0, wz - 0.1)];
    if (q.some((p) => p[2] < 0.2)) continue;
    const g = ctx.createLinearGradient(q[0][0], q[0][1], q[3][0], q[3][1]); g.addColorStop(0, `rgba(140,170,230,${a})`); g.addColorStop(1, 'rgba(140,170,230,0)');
    ctx.fillStyle = g; ctx.beginPath(); q.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// slow drifting fog banks (screen space, parallax by layer)
const FOG = (() => { const r = mulberry32(33); return Array.from({ length: 14 }, (_, i) => ({ x: r() * 1400 - 160, y: 500 + r() * 1300, r: 260 + r() * 420, sp: 6 + r() * 18, layer: i % 3, ph: r() * TAU })); })();
function fog(ctx, t, a = 0.08, rgb = '150,165,190') {
  ctx.save();
  for (const f of FOG) { const x = ((f.x + t * f.sp * (1 + f.layer)) % 1600) - 260; const y = f.y + Math.sin(t * 0.2 + f.ph) * 40; const g = ctx.createRadialGradient(x, y, 0, x, y, f.r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(x - f.r, y - f.r, f.r * 2, f.r * 2); }
  ctx.restore();
}

// whole dorm, painter's order far to near. opts: still (breathing stops), occupied29, bedExtra
function dorm(ctx, t, o = {}) {
  walls(ctx);
  for (const fz of [21, 14.5, 8]) fan(ctx, fz, t, o.fanSpeed ?? 1.05);
  moonShafts(ctx, t);
  const items = [];
  for (const side of [-1, 1]) for (let i = 0; i < NB; i++) items.push({ side, i, z: bedZ(i) });
  items.sort((a, b) => b.z - a.z);
  for (const it of items) {
    const mine = it.side === MY_BED.side && it.i === MY_BED.i;
    let occ = 1; if (mine) occ = o.mineOcc ?? 1;
    bed(ctx, it.side, it.i, t, { occupant: occ, still: o.still || 0, extra: (o.bedExtra && o.bedExtra(it)) || 0 });
    if (o.wardenAt && Math.abs(o.wardenAt[1] - it.z) < BDZ / 2 && it.side === 1) warden(ctx, o.wardenAt[0], o.wardenAt[1], t, o);
  }
  if (o.wardenAt && o.wardenAt[1] > bedZ(NB - 1) + BDZ / 2) warden(ctx, o.wardenAt[0], o.wardenAt[1], t, o);
  torchBeam(ctx, t);
}

// ---------------------------------------------------------------- HUD: the count
function counter(ctx, n, red = 0, a = 1, pop = 0) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(480, 360); const k = 1 + pop * 0.35; ctx.scale(k, k);
  K.rrect(ctx, -150, -64, 300, 128, 20, 'rgba(6,6,8,0.72)');
  ctx.strokeStyle = red ? `rgba(224,27,36,${0.6 + 0.4 * red})` : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(-150, -64, 300, 128, 20); ctx.stroke();
  K.text(ctx, 'GINTI', -78, 0, 30, 'rgba(255,255,255,0.65)', { weight: 800 });
  K.text(ctx, String(n), 52, 2, 82, red ? '#ff2a2a' : '#f2ece0', { weight: 900 });
  ctx.restore();
}

// ---------------------------------------------------------------- close-up illustrations
const PLASTER = (() => { const r = mulberry32(12); return Array.from({ length: 220 }, () => ({ x: r() * 1300 - 110, y: r() * 2100 - 90, r: 4 + r() * 40, a: r() * 0.18, d: r() < 0.5 })); })();
const TALLY = (() => { const r = mulberry32(8); const out = []; for (let g = 0; g < 7; g++) for (let k = 0; k < 5; k++) out.push({ g, k, j: (r() - 0.5) * 6, l: 70 + r() * 16 }); return out; })();
function wallTexture(ctx, lit) {
  K.bg(ctx, ['#2b2a26', '#3a3832', '#24231f']);
  for (const p of PLASTER) { ctx.fillStyle = p.d ? `rgba(0,0,0,${p.a})` : `rgba(255,250,235,${p.a * 0.5})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.7, p.x, 0, TAU); ctx.fill(); }
  // peeling paint edge
  ctx.fillStyle = 'rgba(70,92,86,0.55)'; ctx.beginPath(); ctx.moveTo(-100, 1280); for (let x = -100; x <= 1180; x += 40) ctx.lineTo(x, 1250 + Math.sin(x * 0.05) * 14 + Math.sin(x * 0.17) * 8); ctx.lineTo(1180, 2100); ctx.lineTo(-100, 2100); ctx.fill();
  // scratched tally marks: someone counted nights here (detail)
  ctx.strokeStyle = 'rgba(15,12,10,0.7)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (const m of TALLY) { const gx = 560 + m.g * 52, gy = 640 + (m.g % 2) * 6; if (m.k < 4) { ctx.beginPath(); ctx.moveTo(gx + m.k * 9 + m.j * 0.3, gy); ctx.lineTo(gx + m.k * 9 + m.j, gy + m.l); ctx.stroke(); } else { ctx.beginPath(); ctx.moveTo(gx - 6, gy + 14); ctx.lineTo(gx + 36, gy + m.l - 12); ctx.stroke(); } }
  ctx.strokeStyle = 'rgba(10,8,6,0.65)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(140, 380); ctx.lineTo(190, 520); ctx.lineTo(170, 640); ctx.lineTo(230, 760); ctx.lineTo(210, 900); ctx.stroke();
}
function sleeperFromBehind(ctx, x, y, k, lt, { col = '#0d0c10', breathe = 1, rim = 0 } = {}) {
  const br = Math.sin(lt * 1.7) * 6 * breathe;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  // blanket over shoulder and back, with soft gradient volume
  const bg = ctx.createLinearGradient(0, 0, 0, 520); bg.addColorStop(0, '#1a1a22'); bg.addColorStop(1, col);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-560, 560); ctx.bezierCurveTo(-520, 160 - br, -260, 60 - br, -40, 90 - br); ctx.bezierCurveTo(200, 120 - br, 430, 250, 660, 560); ctx.closePath(); ctx.fill();
  // folds
  ctx.lineCap = 'round';
  for (const f of [[-380, 330, 1], [-170, 250, 0.8], [90, 260, 1], [320, 380, 0.7]]) { ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 14 * f[2]; ctx.beginPath(); ctx.moveTo(f[0], f[1] + 90); ctx.quadraticCurveTo(f[0] + 50, f[1] - 40 - br, f[0] + 150, f[1] - 90 - br); ctx.stroke(); ctx.strokeStyle = 'rgba(120,130,160,0.07)'; ctx.lineWidth = 6 * f[2]; ctx.beginPath(); ctx.moveTo(f[0] + 18, f[1] + 80); ctx.quadraticCurveTo(f[0] + 68, f[1] - 46 - br, f[0] + 166, f[1] - 92 - br); ctx.stroke(); }
  // neck
  ctx.fillStyle = '#1a1310'; ctx.beginPath(); ctx.moveTo(-110, 60 - br); ctx.quadraticCurveTo(-60, 20 - br, 20, 70 - br); ctx.lineTo(10, 120 - br); ctx.lineTo(-120, 120 - br); ctx.fill();
  // head: back of skull, hair as a dark mass with fine strands
  ctx.save(); ctx.translate(-50, -50 - br * 0.5); ctx.rotate(-0.18);
  const hg = ctx.createRadialGradient(-30, -40, 10, 0, 0, 150); hg.addColorStop(0, '#16120f'); hg.addColorStop(1, '#060505');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(0, 0, 112, 128, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 112, 128, 0, 0, TAU); ctx.clip();
  const rr = mulberry32(3); ctx.lineWidth = 1.6;
  for (let i = 0; i < 40; i++) { const sx = -110 + rr() * 220; ctx.strokeStyle = `rgba(48,42,38,${0.05 + rr() * 0.1})`; ctx.beginPath(); ctx.moveTo(sx * 0.4, -128); ctx.quadraticCurveTo(sx, -20, sx * 1.05 + 10, 130); ctx.stroke(); }
  ctx.restore();
  // ear, partly lit
  K.ell(ctx, 96, 20, 16, 30, '#2a1c16', 0.2);
  if (rim > 0) { ctx.strokeStyle = `rgba(170,195,240,${rim})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 112, 128, 0, -1.4, 0.2); ctx.stroke(); }
  ctx.restore();
  if (rim > 0) { ctx.strokeStyle = `rgba(150,175,230,${rim * 0.8})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-40, 90 - br); ctx.bezierCurveTo(200, 120 - br, 430, 250, 660, 560); ctx.stroke(); }
  ctx.restore();
}
// head-and-shoulders shadow shape (soft) for the wall
function bustShadow(ctx, x, y, k, rot, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.filter = 'blur(10px)'; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k); ctx.fillStyle = '#030203';
  ctx.beginPath(); ctx.ellipse(0, -150, 105, 125, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-60, -40); ctx.quadraticCurveTo(-90, 30, -330, 120); ctx.lineTo(-360, 400); ctx.lineTo(360, 400); ctx.lineTo(330, 120); ctx.quadraticCurveTo(90, 30, 60, -40); ctx.fill();
  ctx.restore();
}
const FACEN = (() => { const r = mulberry32(21); return Array.from({ length: 260 }, () => ({ x: (r() - 0.5) * 230, y: (r() - 0.5) * 330, s: 1 + r() * 3, a: r() })); })();
function ghostFace(ctx, x, y, k, p, lt, eyes = 1) {
  if (p <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(-0.1); ctx.globalAlpha = p;
  // skin: soft-edged, dissolves into the dark
  const g = ctx.createRadialGradient(20, -20, 10, 0, 10, 175); g.addColorStop(0, 'rgba(196,200,198,1)'); g.addColorStop(0.5, 'rgba(132,138,140,0.95)'); g.addColorStop(0.85, 'rgba(50,54,58,0.6)'); g.addColorStop(1, 'rgba(10,10,12,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 10, 118, 168, 0, 0, TAU); ctx.fill();
  // skin texture
  for (const n of FACEN) { ctx.fillStyle = `rgba(30,32,34,${0.08 * n.a})`; ctx.fillRect(n.x, n.y, n.s, n.s); }
  // sunken eye sockets, cheek hollows, nose shadow (soft gradients, no hard shapes)
  const sock = (sx) => { const s2 = ctx.createRadialGradient(sx, -28, 2, sx, -24, 52); s2.addColorStop(0, 'rgba(0,0,0,1)'); s2.addColorStop(0.55, 'rgba(10,10,14,0.85)'); s2.addColorStop(1, 'rgba(20,20,26,0)'); ctx.fillStyle = s2; ctx.fillRect(sx - 60, -90, 120, 130); };
  sock(-44); sock(46);
  for (const cx of [-62, 64]) { const h = ctx.createRadialGradient(cx, 60, 2, cx, 60, 60); h.addColorStop(0, 'rgba(20,22,26,0.5)'); h.addColorStop(1, 'rgba(20,22,26,0)'); ctx.fillStyle = h; ctx.fillRect(cx - 60, 0, 120, 120); }
  const ns = ctx.createLinearGradient(0, 0, 18, 0); ns.addColorStop(0, 'rgba(30,30,34,0.45)'); ns.addColorStop(1, 'rgba(30,30,34,0)'); ctx.fillStyle = ns; ctx.fillRect(-4, -10, 24, 70);
  // eyes: tiny wet catchlights staring, pupils wide
  if (eyes > 0) { for (const ex of [-44, 46]) { K.ell(ctx, ex, -26, 15 * eyes + 4, 9 * eyes + 2, `rgba(205,210,205,${0.85 * eyes})`); K.circ(ctx, ex + 1, -26, 8, `rgba(0,0,0,${eyes})`); K.circ(ctx, ex + 4, -29, 2.2, `rgba(255,255,255,${eyes})`); } }
  // mouth: slightly open, too long, breathing
  const m = 2 + 3 * (0.5 + 0.5 * Math.sin(lt * 3.1));
  const mg = ctx.createRadialGradient(6, 96, 1, 6, 96, 60); mg.addColorStop(0, 'rgba(0,0,0,0.95)'); mg.addColorStop(0.6, 'rgba(10,8,10,0.6)'); mg.addColorStop(1, 'rgba(10,8,10,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(6, 98, 34, m + 6, 0.04, 0, TAU); ctx.fill();
  // side shadow: half of the face stays in darkness
  const sd = ctx.createLinearGradient(-130, 0, 60, 0); sd.addColorStop(0, 'rgba(2,2,4,0.97)'); sd.addColorStop(0.55, 'rgba(2,2,4,0.55)'); sd.addColorStop(1, 'rgba(2,2,4,0)');
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 10, 118, 168, 0, 0, TAU); ctx.clip(); ctx.fillStyle = sd; ctx.fillRect(-180, -220, 260, 440); ctx.restore();
  // wet hair framing the face: two filled curtains whose inner edge follows the face oval, plus a few strands
  ctx.fillStyle = '#030305';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(0, -215);
    for (let y = -200; y <= 260; y += 10) { const e = Math.sqrt(Math.max(0, 1 - ((y - 10) / 175) ** 2)); const w = Math.sin(y * 0.07 + side + lt * 0.6) * 6; const inner = side * (Math.max(28, 98 * e * (y < -60 ? 0.55 + (y + 200) / 310 : 0.92)) + w); ctx.lineTo(inner, y); }
    ctx.quadraticCurveTo(side * 120, 330, side * 170, 340); ctx.bezierCurveTo(side * 260, 200, side * 250, -150, side * 150, -230); ctx.quadraticCurveTo(side * 70, -260, 0, -215); ctx.closePath(); ctx.fill();
  }
  const hr = mulberry32(44); ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) { const sx = (hr() - 0.5) * 110; ctx.strokeStyle = `rgba(3,3,5,${0.35 + hr() * 0.3})`; ctx.lineWidth = 1.2 + hr() * 1.6; ctx.beginPath(); ctx.moveTo(sx * 0.3, -200); ctx.bezierCurveTo(sx, -90, sx * 1.3 + Math.sin(lt + i) * 5, 40, sx * 1.1, 60 + hr() * 120); ctx.stroke(); }
  ctx.restore();
}
function breathPuffs(ctx, lt, x0, y0, dirx, a = 1) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let n = 0; n < 4; n++) {
    const c = (lt * 0.42 + n * 0.25) % 1; const k = Math.sin(Math.PI * c);
    const x = x0 + dirx * c * 260, y = y0 - c * 50 + Math.sin(lt * 2 + n) * 10;
    K.glow(ctx, x, y, 40 + c * 120, '200,215,235', 0.12 * k * a);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- shots
const R = {
  // HOOK: low dolly down the aisle toward the door; torch sweeping from the far end; count flips to red 29
  s1_hook(ctx, lt, dur, t) {
    const zy = W(0, 'zyada');
    setCam({ x: -0.15, y: 0.95, z: lerp(-0.5, 1.6, eio(lt / dur)), yaw: 0.0, pitch: 0.06 }, t, 0.01);
    const sweep = Math.sin(lt * 0.9) * 2.1;
    L = { amb: 0.07, moon: 0.42, door: 0.55, doorFlick: K.flick(t * 1.6, 1), doorOpen: 0.85, torch: { p: [0.35, 1.2, 15.5], a: [sweep, 0.5, lerp(10, 6, lt / dur)], k: 1 } };
    dorm(ctx, t, { wardenAt: [0.15, 15.8], torchUp: 0 });
    fog(ctx, t, 0.045);
    const n = t < zy - 0.05 ? Math.min(28, Math.floor(6 + lt * 5.2)) : 29;
    counter(ctx, n, t >= zy - 0.05 ? 1 : 0, cl(lt / 0.3), K.kickAt(t, zy - 0.05, 0.35));
  },
  // WIDE: slow lateral crane over the beds, 28 sleepers breathing, torch stepping bed to bed, count ticks
  s2_dorm(ctx, lt, dur, t) {
    const pr = eio(lt / dur);
    setCam({ x: lerp(-1.2, 0.6, pr), y: 2.7, z: lerp(-1.5, 0.5, pr), yaw: lerp(0.12, -0.05, pr), pitch: -0.28 }, t, 0.008);
    // torch dwells on each bed in turn (left/right alternating, walking toward camera)
    const step = lt * 3.4; const k = Math.floor(step); const f = step - k; const ease = eio(cl(f * 2.2));
    const bedTarget = (j) => [((j % 2) ? 1 : -1) * 2.0, 0.65, bedZ(NB - 1 - Math.floor(j / 2) % NB)];
    const A = bedTarget(k), B = bedTarget(k + 1);
    const a = [lerp(A[0], B[0], ease), 0.65, lerp(A[2], B[2], ease)];
    const wz = lerp(22, 12, pr);
    L = { amb: 0.075, moon: 0.48, door: 0.4, doorFlick: K.flick(t * 1.6, 1), doorOpen: 0.85, torch: { p: [0.2, 1.25, wz], a, k: 1 } };
    dorm(ctx, t, { wardenAt: [0.0, wz + 0.25] });
    fog(ctx, t, 0.04);
    counter(ctx, Math.min(28, 1 + Math.floor(step)), 0, 1, f < 0.12 ? 1 - f / 0.12 : 0);
  },
  // CLOSE: narrator facing the wall; torch arrives and lingers; his shadow on the wall has TWO heads
  s4_wall(ctx, lt, dur, t) {
    const tTorch = W(3, 'torch') - TL.scenes.find((s) => s.id === 's4_wall').start_s;
    const arrive = smooth(tTorch - 0.4, tTorch + 0.6, lt);
    const sw = Math.sin(lt * 1.1) * 30 * (1 - arrive) + Math.sin(lt * 7) * 4 * arrive; // the warden's hand trembles a little
    const z = lerp(1.0, 1.12, eio(lt / dur));
    ctx.save(); K.camera(ctx, lt, dur, { fx: 520, fy: 860, z0: z, z1: z + 0.02 }); ctx.translate(Math.sin(lt * 0.7) * 6, Math.cos(lt * 0.5) * 5);
    wallTexture(ctx);
    // darkness then torch pool on the wall
    ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(-200, -200, 1480, 2320);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, 560 + sw, 720, 520 * (0.5 + arrive * 0.6), '255,220,170', 0.55 * arrive); ctx.restore();
    // shadows cast on the wall by the sleeper (and by what lies behind him)
    const sh = arrive;
    bustShadow(ctx, 470 + sw * 0.6, 1010, 1.0, -0.05, 0.75 * sh);
    // second head: behind his, a little higher, tilted toward him; appears only while the torch lingers
    const second = smooth(tTorch + 0.9, tTorch + 2.2, lt);
    bustShadow(ctx, 640 + sw * 0.75, 900, 1.02, 0.22 + Math.sin(lt * 0.6) * 0.02, 0.72 * sh * second);
    // moon rim on pillow and the sleeper himself, foreground
    K.rrect(ctx, -100, 1150, 1300, 300, 60, '#2a2824');
    sleeperFromBehind(ctx, 470, 1100, 1.0, lt, { rim: 0.25 + arrive * 0.4 });
    ctx.restore();
    fog(ctx, t, 0.04);
  },
  // LOW ANGLE: warden in the aisle with the torch on us; 29 slams; second count, slower, torch shaking
  s5_count(ctx, lt, dur, t) {
    const st = TL.scenes.find((s) => s.id === 's5_count').start_s;
    const n1 = W(4, '29') - st, n2 = W(5, '29') - st;
    const kick = K.kickAt(lt, n1 - 0.05, 0.4) + K.kickAt(lt, n2 - 0.05, 0.4);
    setCam({ x: 0.55, y: 0.8, z: lerp(-0.6, 0.3, eio(lt / dur)), yaw: 0.02, pitch: 0.12 }, t, 0.012 + kick * 0.03);
    const shake = lt > n1 ? 0.25 : 0.08;
    const aim = [0.6 + Math.sin(lt * 9) * shake * 0.4, 0.9 + Math.sin(lt * 11) * shake * 0.25, 0.0];
    L = { amb: 0.065, moon: 0.42, door: 0.45, doorFlick: K.flick(t * 1.8, 3), doorOpen: 0.85, torch: { p: [0.45, 1.25, 4.6], a: aim, k: 1 } };
    dorm(ctx, t, { wardenAt: [0.2, 4.9], still: smooth(n1, n1 + 0.8, lt) * 0.6 });
    fog(ctx, t, 0.045);
    const c = lt < n1 - 0.05 ? 28 : (lt < n2 - 0.6 ? 29 : (lt < n2 - 0.05 ? Math.min(28, 20 + Math.floor((lt - (n2 - 0.6)) * 14)) : 29));
    counter(ctx, c, c === 29 ? 1 : 0, 1, kick);
  },
  // FROM MY BED looking back at the door: the warden says it; nobody moves; breathing in every bed stops
  s6_door(ctx, lt, dur, t) {
    const st = TL.scenes.find((s) => s.id === 's6_door').start_s;
    const endLine = LINE(6).end_s - st;
    setCam({ x: 1.3, y: 1.0, z: lerp(0.4, 1.3, eio(lt / dur)), yaw: lerp(-0.05, 0.02, lt / dur), pitch: 0.02 }, t, 0.008);
    const stillK = smooth(endLine - 0.2, endLine + 0.4, lt);
    L = { amb: 0.065, moon: 0.44, door: 0.85, doorFlick: K.flick(t * 2.2, 5) * (lt > endLine ? 0.8 + 0.2 * Math.sin(t * 23) : 1), doorOpen: 0.85, torch: { p: [0.1, 1.0, 24.6], a: [0.4, 0.0, 20.0], k: 0.8 } };
    dorm(ctx, t, { wardenAt: [-0.1, 24.9], still: 0.4 + stillK * 0.6 });
    fog(ctx, t, 0.05);
    counter(ctx, 29, 1, 1 - smooth(endLine, endLine + 0.5, lt));
  },
  // DOOR CLOSES: light strip narrows to nothing; moonlight only; false calm, fan keeps turning
  s7_relief(ctx, lt, dur, t) {
    const st = TL.scenes.find((s) => s.id === 's7_relief').start_s;
    const close = smooth(W(7, 'band') - st - 0.9, W(7, 'band') - st + 0.15, lt);
    setCam({ x: lerp(1.2, 1.7, eio(lt / dur)), y: lerp(1.1, 2.0, eio(lt / dur)), z: lerp(1.0, 0.2, eio(lt / dur)), yaw: lerp(0.0, -0.25, eio(lt / dur)), pitch: lerp(0.0, -0.3, eio(lt / dur)) }, t, 0.006);
    L = { amb: 0.065, moon: 0.48, door: 0.7 * (1 - close), doorFlick: K.flick(t * 1.6, 5), doorOpen: 0.85 * (1 - close), torch: null };
    dorm(ctx, t, { fanSpeed: 0.95 });
    fog(ctx, t, 0.045, '120,140,180');
  },
  // EXTREME CLOSE: his neck in moonlight, cold breath arriving from the dark behind him; the blanket behind rises
  s8_breath(ctx, lt, dur, t) {
    const st = TL.scenes.find((s) => s.id === 's8_breath').start_s;
    const tb = W(8, 'thandi') - st;
    const p = eio(lt / dur);
    ctx.save(); K.camera(ctx, lt, dur, { fx: 560, fy: 820, z0: 1.15, z1: 1.45, dutch: 0.03 });
    K.bg(ctx, ['#06070a', '#0b0d12', '#050608']);
    // pillow + moon rim
    K.rrect(ctx, -100, 1100, 1300, 320, 60, '#1d1e22');
    // the shape behind him: rises slowly, out of sync with his breathing
    const rise = smooth(tb + 0.4, dur, lt);
    { const mg = ctx.createRadialGradient(820, 760 - rise * 90, 20, 820, 820 - rise * 90, 420); mg.addColorStop(0, 'rgba(14,15,20,1)'); mg.addColorStop(0.7, 'rgba(8,9,12,0.9)'); mg.addColorStop(1, 'rgba(6,7,10,0)');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(820, 900 - rise * 90, 380, 300 + rise * 40, -0.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(140,160,210,${0.12 + rise * 0.2})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(820, 900 - rise * 90, 380, 300 + rise * 40, -0.2, 3.6, 4.6); ctx.stroke(); }
    sleeperFromBehind(ctx, 430, 1060, 1.12, lt, { rim: 0.55, breathe: 1 - smooth(tb, tb + 0.5, lt) * 0.85 });
    // cold breath from behind, hitting his neck
    breathPuffs(ctx, lt, 760, 980, -1, smooth(tb - 0.3, tb + 0.3, lt));
    // goosebumps sparkle on neck in moonlight
    ctx.restore();
    fog(ctx, t, 0.05, '120,140,180');
  },
  // REVEAL: a pale face slides out of the dark right behind his head, eyes open on the last word; stinger
  s9_whisper(ctx, lt, dur, t) {
    const st = TL.scenes.find((s) => s.id === 's9_whisper').start_s;
    const endW = LINE(9).end_s - st;
    const appear = smooth(0.0, endW, lt);
    const snap = smooth(endW - 0.02, endW + 0.08, lt);
    const kick = K.kickAt(lt, endW, 0.5);
    ctx.save(); K.camera(ctx, lt, dur, { fx: 600, fy: 760, z0: 1.3, z1: 1.55, kick });
    K.bg(ctx, ['#040406', '#08090c', '#030304']);
    ghostFace(ctx, 690 - snap * 40, 700 + (1 - appear) * 60, 1.25 + snap * 0.35, 0.15 + appear * 0.85, lt, snap);
    sleeperFromBehind(ctx, 420, 1080, 1.15, lt, { rim: 0.5, breathe: 0 });
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, 640, 690, 420, '120,150,200', 0.08 + snap * 0.1); ctx.restore();
  },
  // NEXT NIGHT (callback to the hook): same aisle, torch counts a clean 28; my corner bed holds someone facing the wall; its head turns
  s10_loop(ctx, lt, dur, t) {
    const st = TL.scenes.find((s) => s.id === 's10_loop').start_s;
    const t28 = W(10, '28') - st; const tNahi = W(10, 'nahi') - st;
    const turnT = tNahi + 0.4;
    const pr = eio(lt / dur);
    // reverse dolly: start at the far end, end close on the corner bed
    setCam({ x: lerp(-0.2, 0.2, pr), y: lerp(1.0, 1.3, pr), z: lerp(-0.4, -1.1, pr), yaw: lerp(0, 0.32, smooth(t28, tNahi, lt)), pitch: lerp(0.05, -0.12, smooth(t28, tNahi, lt)) }, t, 0.01);
    const aimMine = smooth(t28 - 0.2, t28 + 1.2, lt);
    const sweep = [Math.sin(lt * 1.6) * 2, 0.6, lerp(12, 4, cl(lt / t28))];
    const a = [lerp(sweep[0], 2.2, aimMine), 0.7, lerp(sweep[2], bedZ(0), aimMine)];
    L = { amb: 0.07, moon: 0.44, door: 0.5, doorFlick: K.flick(t * 1.6, 1), doorOpen: 0.85, torch: { p: [0.3, 1.25, 7.5], a, k: 1 } };
    dorm(ctx, t, { wardenAt: [0.1, 7.8] });
    // the thing on my bed turns its head toward the camera at the end
    const turn = smooth(turnT, turnT + 1.2, lt);
    if (turn > 0) { const h = P(2.5, 0.8, bedZ(0) - 0.05); if (h[2] > 0.2) { const sc = F / h[2] * 0.0016; ctx.save(); ctx.globalAlpha = turn; ghostFace(ctx, h[0] - 4, h[1] - 6, sc * 0.9, 1, lt, turn); ctx.restore(); } }
    fog(ctx, t, 0.045);
    const n = lt < t28 ? Math.min(28, Math.floor(10 + lt * 7)) : 28;
    counter(ctx, n, 0, 1, K.kickAt(lt, t28 - 0.05, 0.35));
  }
};

// ---------------------------------------------------------------- frame + post (CA split, grain, vignette, captions)
let BUF = null;
function bufs(w, h) {
  if (!BUF || BUF.w !== w) BUF = { w, h, scene: createCanvas(w, h), ch: createCanvas(w, h) };
  return BUF;
}
function caAmount(t) {
  const kicks = [W(0, 'zyada'), W(4, '29'), W(5, '29'), LINE(9).end_s, W(10, 'nahi') + 0.4];
  let a = 1.5; for (const k of kicks) a += 9 * Math.max(0, 1 - Math.abs(t - k) / 0.35);
  const sc = TL.scenes.find((s) => t >= s.start_s && t < s.end_s);
  if (sc && (sc.id === 's8_breath' || sc.id === 's9_whisper')) a += 2.5;
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
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.fillStyle = '#000'; c.fillRect(0, 0, width, height);
    c.save(); c.scale(s, s); R[sc.id](c, lt, dur, t, sc); c.restore();
    // cut: brief dip from black (never a flash)
    const inA = 1 - cl(lt / 0.2); if (inA > 0 && sc.start_s > 0) { c.fillStyle = `rgba(0,0,0,${inA * 0.8})`; c.fillRect(0, 0, width, height); }
    // chromatic aberration: R and B planes pushed apart, G centred
    const d = caAmount(t) * s;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    const ch = B.ch.getContext('2d');
    for (const [col, dx] of [['#ff0000', -d], ['#00ff00', 0], ['#0000ff', d]]) {
      ch.globalCompositeOperation = 'source-over'; ch.drawImage(B.scene, 0, 0);
      ch.globalCompositeOperation = 'multiply'; ch.fillStyle = col; ch.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(B.ch, dx, dx * 0.3);
    }
    ctx.restore();
    ctx.save(); ctx.scale(s, s);
    // flicker of exposure on the whole frame (slow, never a strobe)
    const ex = 1 - K.flick(t * 0.7, 9); if (ex > 0) { ctx.fillStyle = `rgba(0,0,0,${ex * 0.6})`; ctx.fillRect(0, 0, 1080, 1920); }
    K.post(ctx, t, timeline, { vig: 0.8, grainA: 0.08, capY: 1290 });
    ctx.restore();
  }
};
