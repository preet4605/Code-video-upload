// "Seedhiyon ki Batti / Teri Dulhan": 3D switchback stairwell, POV climb, shadows as the monster.
// Deterministic f(t). Cold-open cut: reel t = song t - 12.0 s.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SK = '/mnt/project-files/skills/code-video-studio-v6.1/';
const S3 = await import(SK + 'lib/scene3d.mjs');
const { makeCamera, drawQuad, drawBox, drawDust, drawFogBanks, drawVignette, drawGrain, softenLayer, chromaticAberration, hitPulse, handheld, lightAt, mulberry32 } = S3;

const OFFSET = 12.0;
const BM = JSON.parse(fs.readFileSync(path.join(HERE, 'beat_map.json'), 'utf8'));
const HITS = BM.sub_bass_hits.map((x) => x - OFFSET).filter((x) => x > -0.2);

// ------------------------------------------------------------------ math helpers
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const sm = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const TAU = Math.PI * 2;
const hash = (x, y = 0, z = 0) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
const fbm = (x, y, seed = 0) => vnoise(x, y, seed) * 0.55 + vnoise(x * 2.1, y * 2.1, seed + 3) * 0.3 + vnoise(x * 4.3, y * 4.3, seed + 7) * 0.15;

// ------------------------------------------------------------------ stairwell geometry (metres)
const H = 3.4, RISE = 1.7, NST = 10;           // floor height, half-flight rise, steps per half flight
const F1X = [0.1, 1.0], F2X = [1.6, 2.5];      // flight 1 / flight 2 x ranges, void between
const WX = [0, 2.6], ZF = 0.0, ZB = 5.4;       // side walls, front wall, back wall
const ZL1 = 1.2, ZL2 = 4.2;                    // flights run z 1.2..4.2, landings outside
const EYE = 1.55;
const NFLOORS = 5;

// ------------------------------------------------------------------ camera path (4 floors, floor 0 -> floor 4 door)
const wp = [];
for (let k = 0; k < 4; k++) {
  const y0 = k * H;
  wp.push([0.55, y0, 0.7], [0.55, y0, ZL1], [0.55, y0 + RISE, ZL2], [0.55, y0 + RISE, 4.62], [2.05, y0 + RISE, 4.62], [2.05, y0 + RISE, ZL2], [2.05, y0 + H, ZL1], [2.05, y0 + H, 0.7]);
}
wp.push([0.5, 4 * H, 0.7]);
const segLen = []; let S_TOTAL = 0;
for (let i = 0; i < wp.length - 1; i++) { const d = Math.hypot(wp[i + 1][0] - wp[i][0], wp[i + 1][1] - wp[i][1], wp[i + 1][2] - wp[i][2]); segLen.push(d); S_TOTAL += d; }
function pathAt(s) {
  s = cl(s, 0, S_TOTAL - 1e-6);
  let i = 0; while (i < segLen.length - 1 && s > segLen[i]) { s -= segLen[i]; i++; }
  const k = s / segLen[i], a = wp[i], b = wp[i + 1];
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}
function headingAt(s) { // smoothed horizontal heading from lookahead
  const p = pathAt(s), q = pathAt(s + 1.1), r = pathAt(Math.max(0, s - 0.3));
  const dx = q[0] - r[0], dz = q[2] - r[2];
  return Math.atan2(dx, dz);
}
// time -> arclength
const B_TIMES = [7.31, 10.25, 14.66, 17.6];
const T_TURN = 24.95, T_RUN0 = 31.0, T_ARR = 39.95;
const S_TURN_TARGET = S_TOTAL - 2.4 * (T_ARR - T_RUN0);
function v1(t) { // base speed during the climb (m/s), gated to zero in blackouts
  let v = t < 7.31 ? 1.7 : t < 10.25 ? 1.3 : t < 14.66 ? 1.2 : t < 17.6 ? 1.1 : t < 21.0 ? 0.9 : 0;
  for (const b of B_TIMES) v *= 1 - sm(b - 0.08, b + 0.12, t) * (1 - sm(b + 0.35, b + 0.75, t));
  return v * sm(2.87, 3.4, t);
}
const DT = 1 / 240; const TAB = []; { let s = 0; for (let t = 0; t <= 45; t += DT) { TAB.push(s); if (t >= 2.87 && t < T_TURN) s += v1(t) * DT; } }
const S_RAW_TURN = TAB[Math.round(T_TURN / DT)] || 20;
const K1 = S_TURN_TARGET / S_RAW_TURN;
function sAt(t) {
  if (t < T_TURN) return TAB[Math.round(t / DT)] * K1;
  if (t < T_RUN0) return S_TURN_TARGET;
  const k = cl((t - T_RUN0) / (T_ARR - T_RUN0)); // gentle ease-in then steady run
  const e = k < 0.12 ? (k * k) / (2 * 0.12) : k - 0.06;
  const norm = 1 - 0.06;
  return S_TURN_TARGET + (S_TOTAL - S_TURN_TARGET) * Math.min(1, e / norm);
}

// ------------------------------------------------------------------ lights
const WARM = [1.0, 0.62, 0.3], COLD = [0.28, 0.4, 0.7];
function bulbPower(t) {
  let p = 1;
  if (t < 0.07) p = 0.3;
  else if (t < 2.87) { // buzzing flicker on the first intro hits
    p = 0.78 + 0.22 * Math.sin(t * 31) * Math.cos(t * 11.3);
    for (const h of [0.26, 0.47, 0.52, 1.07]) if (t > h && t < h + 0.07) p *= 0.35;
  } else p = 0.94 + 0.06 * Math.sin(t * 23) * Math.cos(t * 7.1);
  for (const b of B_TIMES) {
    if (t >= b && t < b + 0.55) p = 0;
    else if (t >= b + 0.55 && t < b + 0.75) p = (Math.floor((t - b - 0.55) * 30) % 2) ? 0.75 : 0.18; // click-on flicker
  }
  return p;
}
function buildLights(kc, t, camPos) {
  const p = bulbPower(t); const L = [];
  for (let k = Math.max(0, kc - 1); k <= Math.min(NFLOORS - 1, kc + 1); k++) {
    const y0 = k * H;
    L.push({ type: 'point', pos: [1.3, y0 + 2.75, 0.55], color: WARM, intensity: 1.5 * p, range: 1.9 });
    L.push({ type: 'point', pos: [1.3, y0 + RISE + 2.75, 4.75], color: WARM, intensity: 1.5 * p, range: 1.9 });
    // cold moonlight through the window grille on the half landing
    L.push({ type: 'cone', pos: [1.3, y0 + RISE + 2.0, 5.35], dir: [0, -0.35, -1], color: COLD, intensity: 0.9, range: 4.2, inner: 0.35, outer: 0.95 });
    // timer-button LED (always on, tiny)
    L.push({ type: 'point', pos: [0.15, y0 + 1.25, 0.9], color: [1, 0.08, 0.04], intensity: 0.26, range: 1.0 });
  }
  return L;
}

// ------------------------------------------------------------------ materials / textures
const wallTex = (seed, dadoV) => (u, v) => {
  const g = fbm(u * 6, v * 5, seed);
  let k = 0.62 + g * 0.55;
  k *= 1 - 0.55 * Math.pow(fbm(u * 3 + 9, v * 0.8, seed + 11), 2.4) * (1 - v); // seepage streaks from the top
  if (Math.abs(v - dadoV) < 0.012) k *= 1.5; // dado line
  if (g > 0.78) k *= 0.55; // peeling patches
  return k;
};
const TEX = [wallTex(1, 0.36), wallTex(2, 0.36), wallTex(3, 0.36)];
const baseWall = '#7d7762', baseDado = '#1f3835';

// ------------------------------------------------------------------ figures as shadow silhouettes (u,v metres, v up)
function ellipse(cx, cy, rx, ry, n = 14) { return Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * TAU) * rx, cy + Math.sin((i / n) * TAU) * ry]); }
function narratorPolys(t, ph) {
  const sw = Math.sin(ph) * 0.22, sw2 = -sw;
  return [
    [[-0.23, 1.46], [0.23, 1.46], [0.2, 0.95], [-0.2, 0.95]],
    [[-0.14, 1.44], [0.14, 1.44], [0.12, 1.72], [0.0, 1.8], [-0.12, 1.72]],
    [[-0.34, 1.38], [-0.2, 1.46], [-0.2, 0.9], [-0.36, 0.9]], // backpack
    [[-0.2, 0.95], [-0.02, 0.95], [-0.02 + sw, 0.04], [-0.2 + sw, 0.04]],
    [[0.02, 0.95], [0.2, 0.95], [0.2 + sw2, 0.04], [0.02 + sw2, 0.04]],
    [[0.2, 1.4], [0.32, 1.38], [0.46, 1.5], [0.4, 1.56]] // arm on the rail
  ];
}
function dulhanPolys(t) {
  const w = Math.sin(t * 1.7) * 0.05, w2 = Math.sin(t * 2.3 + 1) * 0.07;
  const hem = []; for (let i = 0; i <= 12; i++) { const u = lerp(-0.62, 0.62, i / 12); hem.push([u, 0.0 + Math.sin(i * 1.9 + t * 2) * 0.025]); }
  return [
    [[-0.14, 1.0], [0.14, 1.0], ...hem.slice().reverse().map(([u, v]) => [u, v]), ...[]].length ? [[-0.15, 1.02], [0.15, 1.02], ...hem.slice().reverse()] : [],
    [[-0.17, 1.48], [0.17, 1.48], [0.15, 1.0], [-0.15, 1.0]],
    // veil / ghoonghat: bell over head and shoulders, bowed forward
    [[0.0, 1.86], [0.15 + w, 1.8], [0.3, 1.55], [0.36, 1.28], [-0.36, 1.28], [-0.3, 1.55], [-0.15 + w, 1.8]],
    // nath/maang tikka hint: tiny teardrop above forehead
    ellipse(0.0, 1.88, 0.025, 0.045, 8),
    // dupatta trailing behind
    [[-0.2, 1.45], [-0.5 + w2, 1.1], [-0.95 + w2 * 1.6, 0.6], [-1.05 + w2 * 2, 0.2], [-0.8 + w2 * 1.4, 0.5], [-0.42, 0.95], [-0.15, 1.3]],
    // arm raised, bangled wrist
    [[0.17, 1.42], [0.34, 1.2], [0.46, 1.36], [0.54, 1.5], [0.6, 1.5], [0.48, 1.25], [0.32, 1.1], [0.2, 1.3]],
    ...[0, 1, 2, 3, 4].map((i) => ellipse(0.55 + i * 0.012, 1.5 - i * 0.03 + Math.sin(t * 6 + i) * 0.006, 0.035, 0.035, 8)),
    [[0.6, 1.5], [0.64, 1.38], [0.66, 1.3], [0.62, 1.34]] // kalira dangling
  ];
}
function wetPolys(t, front) {
  const sway = Math.sin(t * 0.9) * 0.03;
  const hair = [[-0.18, 1.62], [0.18, 1.62], [0.2, 1.1], [0.16, 0.55 + Math.sin(t * 1.3) * 0.03], [0.05, 0.42], [-0.06, 0.5], [-0.17, 0.62], [-0.22, 1.1]];
  return [
    [[-0.28, 1.5], [0.28, 1.5], [0.3, 0.98], [0.2, 0.9], [-0.2, 0.9], [-0.3, 0.98]],
    ellipse(sway, 1.6, 0.13, 0.15, 12), hair,
    [[-0.3, 1.5], [-0.42, 1.0], [-0.4, 0.46], [-0.33, 0.46], [-0.26, 1.0], [-0.22, 1.42]],
    [[0.3, 1.5], [0.42, 1.0], [0.4, 0.46], [0.33, 0.46], [0.26, 1.0], [0.22, 1.42]],
    [[-0.2, 0.92], [-0.02, 0.92], [-0.02, 0.0], [-0.2, 0.0]],
    [[0.02, 0.92], [0.2, 0.92], [0.2, 0.0], [0.02, 0.0]]
  ];
}

// ------------------------------------------------------------------ renderer state per frame
let T = 0;
let CAMF = null;
function frameCam(t, w, h) {
  const s = sAt(t);
  const hd = headingAt(s);
  const pos = pathAt(s);
  let yaw = hd, pitch = 0.08, fov = 66, roll = 0, off = [0, 0, 0];
  // flight pitch
  const p0 = pathAt(s), p1 = pathAt(s + 0.9);
  const run = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
  pitch = Math.atan2(p1[1] - p0[1], Math.max(0.2, run)) * 0.7 + 0.04;
  let sprint = sm(2.87, 3.6, t) * (t < T_TURN ? 1 : 0);
  // special shots
  if (t < 2.87) { // hook: low, still, looking up flight 1 toward the back wall
    const k = t / 2.87;
    return { pos: [0.55, EYE + 0.05 - 0.05 * k, 0.95 + 0.25 * k], yaw: 0.02 - 0.02 * k, pitch: 0.16 + 0.02 * k, fov: 62 - 3 * k, roll: 0.012, s: 0, hd: 0 };
  }
  if (t >= 8.5 && t < 11.9) { // prints: low, looking down at the steps
    const k = sm(8.5, 9.1, t) * (1 - sm(11.3, 11.9, t));
    pitch = lerp(pitch, -0.62, k); off = [0, -0.55 * k, 0]; fov = lerp(fov, 58, k);
  }
  if (t >= 18.2 && t < T_TURN) { // reveal: look up/right across the void
    const k = sm(18.2, 18.7, t) * (1 - sm(21.6, 22.6, t));
    yaw += 0.12 * k; pitch += 0.12 * k; fov = lerp(fov, 60, k);
  }
  if (t >= T_TURN && t < 25.4) { // whip-turn 180 degrees
    const k = sm(T_TURN, 25.35, t); yaw = hd + Math.PI * k; pitch = lerp(pitch, 0.0, k); roll = Math.sin(k * Math.PI) * 0.12;
  } else if (t >= 25.4 && t < T_RUN0 - 0.9) { // breakdown: facing back down the flight, creeping
    yaw = hd + Math.PI; pitch = 0.0 + 0.01 * (t - 25.4);
    fov = 62 - 2 * sm(25.4, 29, t);
  } else if (t >= T_RUN0 - 0.9 && t < T_RUN0 + 0.4) { // whip back round and dip to the shards
    const k = sm(T_RUN0 - 0.9, T_RUN0 + 0.4, t); yaw = hd + Math.PI * (1 - k); pitch = lerp(0.0, pitch, k);
    const dip = Math.sin(clampDip(t)) ; off = [0, -0.35 * dip, 0];
  }
  if (t >= 29.98 && t < 31.2) { const k = 1 - sm(29.98, 30.9, t); pitch = lerp(pitch, -0.7, k); off = [0, -0.5 * k, 0]; }
  if (t >= T_RUN0) { sprint = 1.2; fov = 70; }
  // handheld + hit kick
  const amp = 0.55 + 1.4 * sm(12, T_TURN, t) + (t >= T_RUN0 ? 1.4 : 0);
  const hh = handheld(t, amp, 3);
  const kick = hitPulse(t, HITS, 14) * (t > 2.87 && (t < T_TURN || t > 29.9) ? 1 : 0);
  // step bob while moving
  const sp = (sAt(t + 0.02) - sAt(t - 0.02)) / 0.04;
  const bob = Math.sin(s * 8.4) * 0.045 * cl(sp / 1.3) * (1 + sprint * 0.6);
  const sway = Math.sin(s * 4.2) * 0.03 * cl(sp / 1.3);
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const camPos = [pos[0] + off[0] + right[0] * sway + hh.pos[0], pos[1] + EYE + off[1] + bob - kick * 0.06 + hh.pos[1], pos[2] + off[2] + right[2] * sway];
  return { pos: camPos, yaw: yaw + hh.yaw + sway * 0.02, pitch: pitch + hh.pitch - kick * 0.025, fov: fov - kick * 2.5, roll: roll + hh.roll, s, hd };
}
const clampDip = (t) => cl((t - (T_RUN0 - 0.9)) / 1.3) * Math.PI;

// ------------------------------------------------------------------ drawing helpers
function q(ctx, cam, pts, o) { return drawQuad(ctx, cam, pts, o); }
function polyScreen(ctx, cam, pts, fill, stroke = null, lw = 2) {
  const pr = pts.map((p) => cam.project(p)); if (pr.some((p) => !p.ok)) return false;
  ctx.beginPath(); ctx.moveTo(pr[0].x, pr[0].y); for (let i = 1; i < pr.length; i++) ctx.lineTo(pr[i].x, pr[i].y); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  return true;
}
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function floorItems(k, cam, lights, items, W) {
  const y0 = k * H; const ex = { lights, ambient: [0.004, 0.005, 0.008], exposure: 1.15, fog: { start: 3, density: 0.05, colorLin: [0.006, 0.01, 0.014] } };
  const wall = (p0, p1, p2, p3, base, seed, nx = 8, ny = 6, nrm = [0, 0, 1]) => {
    // split into dado (lower, teal) and upper (limewash) so the oil-paint band reads
    const mixp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    const dv = 0.36;
    items.push({ d: dist3(cam.pos, mixp(mixp(p0, p1, 0.5), mixp(p3, p2, 0.5), 0.5)) + 100, wall: true, draw: () => {
      q(ctx0, cam, [p0, p1, mixp(p1, p2, dv), mixp(p0, p3, dv)], { ...ex, normal: nrm, cull: false, base: baseDado, nx, ny: 3, texture: (u, v) => TEX[seed % 3](u, v * dv) });
      q(ctx0, cam, [mixp(p0, p3, dv), mixp(p1, p2, dv), p2, p3], { ...ex, normal: nrm, cull: false, base, nx, ny, texture: (u, v) => TEX[seed % 3](u, dv + v * (1 - dv)) });
    } });
  };
  const yb = y0, yt = y0 + 2 * H; // wall spans this floor's two half-levels
  // left wall (x=0), right wall (x=2.6), back wall (z=5.4), front wall (z=0)
  wall([WX[0], yb, ZF], [WX[0], yb, ZB], [WX[0], yt, ZB], [WX[0], yt, ZF], baseWall, k, 16, 10, [1, 0, 0]);
  wall([WX[1], yb, ZB], [WX[1], yb, ZF], [WX[1], yt, ZF], [WX[1], yt, ZB], baseWall, k + 1, 16, 10, [-1, 0, 0]);
  wall([WX[0], yb, ZB], [WX[1], yb, ZB], [WX[1], yt, ZB], [WX[0], yt, ZB], baseWall, k + 2, 12, 10, [0, 0, -1]);
  wall([WX[1], yb, ZF], [WX[0], yb, ZF], [WX[0], yt, ZF], [WX[1], yt, ZF], baseWall, k, 12, 10, [0, 0, 1]);
}
let ctx0 = null;

function buildScene(ctx, cam, lights, t, kc, W, Hh) {
  ctx0 = ctx;
  const items = [];
  for (let k = Math.max(0, kc - 1); k <= Math.min(NFLOORS - 1, kc + 1); k++) floorItems(k, cam, lights, items, W);
  // walls first (always behind everything else)
  items.sort((a, b) => b.d - a.d);
  const ex = { lights, ambient: [0.004, 0.005, 0.008], exposure: 1.15, fog: { start: 3, density: 0.05, colorLin: [0.006, 0.01, 0.014] } };
  for (const it of items) it.draw();
  return ex;
}

// shadow casting onto the wall ahead of the camera
function wallPlane(cam) {
  const dx = cam.fwd[0], dz = cam.fwd[2];
  if (Math.abs(dz) >= Math.abs(dx)) return dz > 0 ? { ax: 'z', v: ZB, lim: [WX[0], WX[1]] } : { ax: 'z', v: ZF, lim: [WX[0], WX[1]] };
  return dx > 0 ? { ax: 'x', v: WX[1], lim: [ZF, ZB] } : { ax: 'x', v: WX[0], lim: [ZF, ZB] };
}
function castShadow(ctx, cam, polysLocal, figPos, faceDir, alpha, plane, lightPos, kScale = 1, softness = 1) {
  // figure drawn as billboard in a plane parallel to the wall; mirrored so it faces along faceDir
  const lat = plane.ax === 'z' ? [1, 0, 0] : [0, 0, 1];
  const wallV = plane.v;
  ctx.save();
  // clip to the wall region around the camera
  const yLo = cam.pos[1] - 6, yHi = cam.pos[1] + 6;
  const c = plane.ax === 'z' ? [[plane.lim[0], yLo, wallV], [plane.lim[1], yLo, wallV], [plane.lim[1], yHi, wallV], [plane.lim[0], yHi, wallV]] : [[wallV, yLo, plane.lim[0]], [wallV, yLo, plane.lim[1]], [wallV, yHi, plane.lim[1]], [wallV, yHi, plane.lim[0]]];
  const cp = c.map((p) => cam.project(p)); if (cp.some((p) => !p.ok)) { /* partially behind camera: skip clip */ } else { ctx.beginPath(); ctx.moveTo(cp[0].x, cp[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(cp[i].x, cp[i].y); ctx.closePath(); ctx.clip(); }
  for (const poly of polysLocal) {
    const pts = poly.map(([u, v]) => {
      const world = [figPos[0] + lat[0] * u * faceDir * kScale, figPos[1] + v * kScale, figPos[2] + lat[2] * u * faceDir * kScale];
      // central projection from the light onto the wall plane
      const dax = plane.ax === 'z' ? 2 : 0;
      const denom = world[dax] - lightPos[dax]; if (Math.abs(denom) < 1e-3) return null;
      const k = (wallV - lightPos[dax]) / denom;
      return [lightPos[0] + (world[0] - lightPos[0]) * k, lightPos[1] + (world[1] - lightPos[1]) * k, lightPos[2] + (world[2] - lightPos[2]) * k];
    });
    if (pts.some((p) => !p)) continue;
    const pr = pts.map((p) => cam.project(p)); if (pr.some((p) => !p.ok)) continue;
    ctx.beginPath(); ctx.moveTo(pr[0].x, pr[0].y); for (let i = 1; i < pr.length; i++) ctx.lineTo(pr[i].x, pr[i].y); ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(0,0,0,${0.22 * alpha * softness})`; ctx.lineWidth = 26 * (cam.width / 1080) * softness; ctx.stroke();
    ctx.strokeStyle = `rgba(0,0,0,${0.3 * alpha})`; ctx.lineWidth = 10 * (cam.width / 1080) * softness; ctx.stroke();
    ctx.fillStyle = `rgba(2,3,4,${0.86 * alpha})`; ctx.fill();
  }
  ctx.restore();
}

function drawSteps(ctx, cam, k, lights, t, items) {
  const y0 = k * H; const dy = RISE / NST, dz = (ZL2 - ZL1) / NST;
  const ex = { lights, ambient: [0.004, 0.005, 0.008], exposure: 1.15, fog: { start: 3, density: 0.05, colorLin: [0.006, 0.01, 0.014] } };
  for (let f = 0; f < 2; f++) {
    for (let i = 0; i < NST; i++) {
      const x0 = f === 0 ? F1X[0] : F2X[0], x1 = f === 0 ? F1X[1] : F2X[1];
      const yTop = y0 + (f === 0 ? 0 : RISE) + (i + 1) * dy;
      const zA = f === 0 ? ZL1 + i * dz : ZL2 - (i + 1) * dz, zB = zA + dz;
      const mid = [(x0 + x1) / 2, yTop, (zA + zB) / 2];
      items.push({ d: dist3(cam.pos, mid), draw: () => {
        // slab under the step (solid stair body down to previous level), then tread with a bright nosing
        drawBox(ctx, cam, [x0, yTop - 0.17, zA], [x1, yTop, zB], { ...ex, base: '#4b4843', nx: 3, ny: 2, texture: (u, v) => 0.7 + fbm(u * 8 + i, v * 4 + f * 9 + k, 5) * 0.5 });
        const nz0 = f === 0 ? zB - 0.045 : zA, nz1 = f === 0 ? zB : zA + 0.045;
        drawQuad(ctx, cam, [[x0, yTop + 0.002, nz0], [x1, yTop + 0.002, nz0], [x1, yTop + 0.002, nz1], [x0, yTop + 0.002, nz1]], { ...ex, base: '#8a857c', nx: 4, ny: 1, cull: false, normal: [0, 1, 0] });
        // wet footprints climbing ahead of him (planted clue): alternate left/right, bare feet
        const foot = i % 2 === 0 ? 0.3 : 0.7; const fx = lerp(x0, x1, foot);
        const fc = [fx, yTop + 0.004, (zA + zB) / 2];
        const toe = f === 0 ? 1 : -1;
        const wetA = 0.78 * (1 - sm(0, 1, 0) * 0);
        polyScreen(ctx, cam, [[fc[0] - 0.045, fc[1], fc[2] - 0.11 * toe], [fc[0] + 0.045, fc[1], fc[2] - 0.11 * toe], [fc[0] + 0.05, fc[1], fc[2] + 0.07 * toe], [fc[0] + 0.03, fc[1], fc[2] + 0.12 * toe], [fc[0] - 0.03, fc[1], fc[2] + 0.12 * toe], [fc[0] - 0.05, fc[1], fc[2] + 0.07 * toe]], `rgba(6,9,10,${wetA})`, 'rgba(150,170,185,0.35)', 1.2);
        // glint
        polyScreen(ctx, cam, [[fc[0] - 0.01, fc[1], fc[2] + 0.02 * toe], [fc[0] + 0.02, fc[1], fc[2] + 0.02 * toe], [fc[0] + 0.02, fc[1], fc[2] + 0.06 * toe], [fc[0] - 0.01, fc[1], fc[2] + 0.06 * toe]], 'rgba(190,210,225,0.25)');
      } });
      // handrail posts on the void side
      const px = f === 0 ? x1 - 0.03 : x0 + 0.03; const pz = (zA + zB) / 2;
      items.push({ d: dist3(cam.pos, [px, yTop + 0.45, pz]) - 0.4, draw: () => drawBox(ctx, cam, [px - 0.012, yTop, pz - 0.012], [px + 0.012, yTop + 0.9, pz + 0.012], { ...ex, base: '#101214', nx: 1, ny: 2, exposure: 2.4 }) });
    }
    // sloped handrail
    const xr = f === 0 ? F1X[1] - 0.03 : F2X[0] + 0.03;
    const a = [xr, y0 + (f === 0 ? 0 : RISE) + 0.9, f === 0 ? ZL1 : ZL2], b = [xr, y0 + (f === 0 ? RISE : H) + 0.9, f === 0 ? ZL2 : ZL1];
    items.push({ d: dist3(cam.pos, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]) - 0.5, draw: () => polyScreen(ctx, cam, [[a[0] - 0.025, a[1], a[2]], [a[0] + 0.025, a[1], a[2]], [b[0] + 0.025, b[1], b[2]], [b[0] - 0.025, b[1], b[2]]], 'rgba(10,11,13,0.95)', 'rgba(110,120,130,0.25)', 1) });
    // sloped soffit above (underside of the flight 3.2 m up)
    const sx0 = f === 0 ? F1X[0] : F2X[0], sx1 = f === 0 ? F1X[1] : F2X[1];
    const sa = f === 0 ? [ZL1, y0 + H - 0.2] : [ZL2, y0 + RISE + H - 0.2], sb = f === 0 ? [ZL2, y0 + RISE + H - 0.2] : [ZL1, y0 + 2 * H - 0.2];
    items.push({ d: dist3(cam.pos, [(sx0 + sx1) / 2, (sa[1] + sb[1]) / 2, (sa[0] + sb[0]) / 2]) + 0.8, draw: () => drawQuad(ctx, cam, [[sx0, sa[1], sa[0]], [sx0, sb[1], sb[0]], [sx1, sb[1], sb[0]], [sx1, sa[1], sa[0]]], { ...ex, base: '#3b3b3c', nx: 3, ny: 6, cull: false, normal: [0, -1, 0] }) });
  }
  // floor landing slab + half landing slab (+ ceilings)
  const slab = (x0, x1, z0, z1, y, base) => {
    items.push({ d: dist3(cam.pos, [(x0 + x1) / 2, y, (z0 + z1) / 2]) + 0.2, draw: () => {
      drawQuad(ctx, cam, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]].reverse(), { ...ex, base, nx: 6, ny: 5, cull: false, normal: [0, 1, 0], texture: (u, v) => 0.7 + fbm(u * 5 + k, v * 5, 14) * 0.6 });
      drawQuad(ctx, cam, [[x0, y - 0.2, z0], [x1, y - 0.2, z0], [x1, y - 0.2, z1], [x0, y - 0.2, z1]], { ...ex, base: '#3a3a3c', nx: 4, ny: 4, cull: false, normal: [0, -1, 0] });
    } });
  };
  slab(WX[0], WX[1], ZF, ZL1, y0 + H, '#4d4b47'); // this floor's landing (top) = next floor's landing at y0+H
  slab(WX[0], WX[1], ZL2, ZB, y0 + RISE, '#4d4b47');
  if (k === 0) slab(WX[0], WX[1], ZF, ZL1, y0, '#4d4b47');
}

function drawDecor(ctx, cam, k, lights, t, items) {
  const y0 = k * H; const ex = { lights, ambient: [0.004, 0.005, 0.008], exposure: 1.15, fog: { start: 3, density: 0.05, colorLin: [0.006, 0.01, 0.014] } };
  const door = () => {
    // flat door on the left wall at the landing
    const dd = dist3(cam.pos, [0, y0 + 1, 0.65]) + 99.5;
    items.push({ d: dd, draw: () => {
      const dz0 = 0.22, dz1 = 1.1, dh = 2.05;
      drawQuad(ctx, cam, [[0.005, y0, dz0 - 0.07], [0.005, y0, dz1 + 0.07], [0.005, y0 + dh + 0.07, dz1 + 0.07], [0.005, y0 + dh + 0.07, dz0 - 0.07]], { ...ex, base: '#1a110b', nx: 3, ny: 4, cull: false, normal: [1, 0, 0] });
      drawQuad(ctx, cam, [[0.012, y0, dz0], [0.012, y0, dz1], [0.012, y0 + dh, dz1], [0.012, y0 + dh, dz0]], { ...ex, base: '#4a2a17', nx: 5, ny: 8, cull: false, normal: [1, 0, 0], texture: (u, v) => 0.65 + fbm(u * 3, v * 14, 21 + k) * 0.7 });
      // 'Subh Labh' sticker (red + gold) and nameplate
      polyScreen(ctx, cam, [[0.016, y0 + 1.9, 0.5], [0.016, y0 + 1.9, 0.82], [0.016, y0 + 2.0, 0.82], [0.016, y0 + 2.0, 0.5]], 'rgba(165,28,20,0.92)', 'rgba(220,170,60,0.9)', 2);
      polyScreen(ctx, cam, [[0.016, y0 + 1.5, 0.6], [0.016, y0 + 1.5, 0.72], [0.016, y0 + 1.56, 0.72], [0.016, y0 + 1.56, 0.6]], 'rgba(200,190,150,0.7)');
      // shoe rack
      drawBox(ctx, cam, [0.04, y0, 1.15], [0.3, y0 + 0.5, 1.5], { ...ex, base: '#2b2018', nx: 2, ny: 2 });
    } });
    // steel lift door on the front wall (taped paper sign)
    items.push({ d: dist3(cam.pos, [1.8, y0 + 1, 0]) + 99.5, draw: () => {
      drawQuad(ctx, cam, [[2.4, y0, 0.005], [1.3, y0, 0.005], [1.3, y0 + 2.1, 0.005], [2.4, y0 + 2.1, 0.005]], { ...ex, base: '#5d6368', nx: 6, ny: 8, cull: false, normal: [0, 0, 1], texture: (u, v) => 0.7 + fbm(u * 2, v * 9, 33) * 0.6 });
      polyScreen(ctx, cam, [[1.95, y0 + 1.45, 0.012], [1.75, y0 + 1.45, 0.012], [1.75, y0 + 1.75, 0.012], [1.95, y0 + 1.75, 0.012]], 'rgba(215,210,190,0.85)', 'rgba(30,30,30,0.6)', 1);
      for (let r = 0; r < 4; r++) polyScreen(ctx, cam, [[1.92, y0 + 1.7 - r * 0.06, 0.013], [1.78, y0 + 1.7 - r * 0.06, 0.013], [1.78, y0 + 1.68 - r * 0.06, 0.013], [1.92, y0 + 1.68 - r * 0.06, 0.013]], 'rgba(20,20,20,0.7)');
    } });
    // timer button plate + LED
    items.push({ d: dist3(cam.pos, [0.02, y0 + 1.25, 0.9]) + 99.4, draw: () => {
      drawQuad(ctx, cam, [[0.01, y0 + 1.15, 0.84], [0.01, y0 + 1.15, 0.96], [0.01, y0 + 1.35, 0.96], [0.01, y0 + 1.35, 0.84]], { ...ex, base: '#d8d2c2', nx: 1, ny: 2, cull: false, normal: [1, 0, 0] });
      const led = cam.project([0.02, y0 + 1.3, 0.9]); if (led.ok) { const g = ctx.createRadialGradient(led.x, led.y, 0, led.x, led.y, 60 * cam.width / 1080 * (1 / Math.max(0.6, led.z * 0.45))); g.addColorStop(0, 'rgba(255,50,30,0.9)'); g.addColorStop(0.2, 'rgba(255,40,20,0.35)'); g.addColorStop(1, 'rgba(255,30,10,0)'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(led.x - 90, led.y - 90, 180, 180); ctx.restore(); }
    } });
  };
  door();
  // electric meter box + hanging wires on the right wall at the half landing
  items.push({ d: dist3(cam.pos, [2.6, y0 + RISE + 1.5, 3.5]) + 99.5, draw: () => {
    drawBox(ctx, cam, [2.5, y0 + RISE + 1.3, 3.3], [2.6, y0 + RISE + 1.9, 3.9], { ...ex, base: '#38393a', nx: 2, ny: 3 });
    for (let w = 0; w < 3; w++) { const ph = w * 1.3; polyScreen(ctx, cam, [[2.58, y0 + RISE + 1.3, 3.4 + w * 0.15], [2.57, y0 + RISE + 0.7 + Math.sin(t * 0.7 + ph) * 0.02, 3.4 + w * 0.15 + 0.03], [2.57, y0 + RISE + 0.65, 3.42 + w * 0.15], [2.58, y0 + RISE + 1.3, 3.41 + w * 0.15]], 'rgba(8,8,9,0.9)', 'rgba(8,8,9,0.9)', 2); }
  } });
  // window grille on the back wall at the half landing (cold light + bars)
  items.push({ d: dist3(cam.pos, [1.3, y0 + RISE + 1.8, 5.4]) + 99.6, draw: () => {
    const wy = y0 + RISE + 1.3, wx0 = 0.7, wx1 = 1.9, wh = 1.1;
    drawQuad(ctx, cam, [[wx0, wy, 5.395], [wx1, wy, 5.395], [wx1, wy + wh, 5.395], [wx0, wy + wh, 5.395]].reverse(), { ...ex, base: '#0d1420', nx: 4, ny: 4, emissive: [0.012, 0.024, 0.05], cull: false, normal: [0, 0, -1] });
    for (let i = 0; i <= 5; i++) { const x = lerp(wx0, wx1, i / 5); polyScreen(ctx, cam, [[x - 0.012, wy, 5.38], [x + 0.012, wy, 5.38], [x + 0.012, wy + wh, 5.38], [x - 0.012, wy + wh, 5.38]], 'rgba(5,6,8,0.95)'); }
    for (let i = 0; i <= 3; i++) { const y = lerp(wy, wy + wh, i / 3); polyScreen(ctx, cam, [[wx0, y - 0.012, 5.38], [wx1, y - 0.012, 5.38], [wx1, y + 0.012, 5.38], [wx0, y + 0.012, 5.38]], 'rgba(5,6,8,0.95)'); }
  } });
}

// ------------------------------------------------------------------ the wet figure (silhouette billboard, never lit)
function drawWet(ctx, cam, pos, t, front, alpha = 1, scale = 1) {
  const polys = wetPolys(t, front);
  const right = cam.right;
  ctx.save();
  for (const poly of polys) {
    const pts = poly.map(([u, v]) => [pos[0] + right[0] * u * scale, pos[1] + v * scale, pos[2] + right[2] * u * scale]);
    const pr = pts.map((p) => cam.project(p)); if (pr.some((p) => !p.ok)) continue;
    ctx.beginPath(); ctx.moveTo(pr[0].x, pr[0].y); for (let i = 1; i < pr.length; i++) ctx.lineTo(pr[i].x, pr[i].y); ctx.closePath();
    ctx.fillStyle = `rgba(2,3,4,${alpha})`; ctx.fill();
    ctx.strokeStyle = `rgba(120,150,190,${0.34 * alpha})`; ctx.lineWidth = 2.5 * cam.width / 1080; ctx.stroke(); // cold rim
  }
  // drips falling from fingertips/hair
  for (let i = 0; i < 5; i++) {
    const ph = (t * 0.9 + i * 0.37) % 1; const u = (i - 2) * 0.12;
    const p = cam.project([pos[0] + right[0] * u * scale, pos[1] + 0.5 * scale - ph * 0.5 * scale, pos[2] + right[2] * u * scale]);
    if (p.ok) { ctx.fillStyle = `rgba(190,215,235,${0.65 * (1 - ph) * alpha})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, 2.2 * cam.width / 1080, 5 * cam.width / 1080, 0, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ shot renderers
function renderStairs(ctx, w, h, t) {
  const cf = frameCam(t, w, h);
  const cam = makeCamera({ pos: cf.pos, yaw: cf.yaw, pitch: cf.pitch, roll: cf.roll, fov: cf.fov, width: w, height: h });
  const kc = cl(Math.floor((cf.pos[1]) / H), 0, NFLOORS - 1);
  const lights = buildLights(kc, t, cf.pos);
  ctx.fillStyle = '#020304'; ctx.fillRect(0, 0, w, h);
  buildScene(ctx, cam, lights, t, kc, w, h);
  // shadows on the wall ahead (drawn right after the walls, before steps/rails occlude them)
  const lightP = bulbPower(t) > 0.05;
  if (lightP) {
    const plane = wallPlane(cam);
    const fwdH = Math.hypot(cam.fwd[0], cam.fwd[2]) || 1; const fx = cam.fwd[0] / fwdH, fz = cam.fwd[2] / fwdH;
    const Ls = [cam.pos[0] - fx * 6, pathAt(cf.s)[1] + 0.55, cam.pos[2] - fz * 6];
    const base = pathAt(cf.s); const gy = base[1];
    // narrator just behind the camera; dulhan 0.9 m behind him along the path (world-fixed)
    const nPos = [cam.pos[0] - fx * 0.12, gy, cam.pos[2] - fz * 0.12];
    const sd = Math.max(0, cf.s - 0.9); const dpp = pathAt(sd); const lat0 = plane.ax === 'z' ? [1, 0, 0] : [0, 0, 1]; const dPos = [dpp[0] + lat0[0] * 0.42, dpp[1], dpp[2] + lat0[2] * 0.42];
    const faceDir = plane.ax === 'z' ? 1 : (plane.v > 1 ? -1 : 1);
    const ph = cf.s * 4.2;
    const sp = (sAt(t + 0.02) - sAt(t - 0.02)) / 0.04;
    const nAlpha = (t >= 25.4 && t < T_RUN0 - 0.9) ? 0 : 1; // after the turn his own shadow is behind the camera
    const dFade = t < 28.1 ? 1 : (1 - sm(28.1, 29.1, t));
    if (nAlpha > 0 && t < T_TURN + 0.4 || t > T_RUN0) castShadow(ctx, cam, narratorPolys(t, ph * (sp > 0.1 ? 1 : 0.0)), nPos, faceDir, 0.92, plane, Ls, 1.0, 1.0);
    // her shadow: lags a half step and moves slightly out of rhythm
    const dBase = (t >= T_TURN + 0.3 && t < T_RUN0 - 0.9) ? [dPos[0], gy, dPos[2]] : [dPos[0], pathAt(sd)[1], dPos[2]];
    const dAlpha = (t < T_RUN0 - 0.9 ? 1 : 0) * dFade * (t >= 0 ? 1 : 0);
    if (dAlpha > 0) {
      let dp = dBase; let lightForHer = Ls;
      if (t >= T_TURN + 0.3 && t < T_RUN0) { // facing back down the flight: light sits behind the new view direction
        lightForHer = [cam.pos[0] - fx * 6, gy + 0.55, cam.pos[2] - fz * 6];
        dp = [cam.pos[0] + fx * 1.4 + lat0[0] * 0.2, gy, cam.pos[2] + fz * 1.4 + lat0[2] * 0.2];
      }
      const slide = sm(28.6, 29.8, t) * 0.8; // slides off the wall as she goes
      castShadow(ctx, cam, dulhanPolys(t), [dp[0] + (plane.ax === 'z' ? slide : 0), dp[1], dp[2] + (plane.ax === 'x' ? slide : 0)], faceDir, dAlpha * (t > 24 ? 1 : 1), plane, lightForHer, 1.0, 1.3);
    }
  }
  // steps, rails, decor, figure sorted far-to-near
  const items = [];
  for (let k = Math.max(0, kc - 1); k <= Math.min(NFLOORS - 1, kc + 1); k++) { drawSteps(ctx, cam, k, lights, t, items); drawDecor(ctx, cam, k, lights, t, items); }
  // wet figure
  const wetShow = (t >= 18.2 && t < T_TURN) || (t >= 34.4 && t < 38.7);
  if (wetShow) {
    let sw, lat = 0, front = false, sc = 1;
    if (t < T_TURN) { const bars = Math.max(0, Math.floor((t - 20.54) / 1.47) + (t > 20.54 ? 1 : 0)); const prog = t > 20.54 ? Math.min(1, (t - 20.54) / 1.47) : 0; sw = cf.s + 3.3 - 0.3 * (Math.max(0, (t - 20.54)) / 1.47); sw = Math.max(cf.s + 1.3, sw); }
    else { const k = (t - 34.4) / (38.56 - 34.4); const sPass = sAt(38.56); sw = sPass + 0 - 0; const sNow = cf.s; sw = sNow + lerp(6.0, 0.55, Math.pow(cl(k), 1.0)); front = true; lat = 0.32 * sm(0.6, 1, k); }
    const wpPos = pathAt(sw); const hd = headingAt(sw);
    const right = [Math.cos(hd), 0, -Math.sin(hd)];
    const pos = [wpPos[0] + right[0] * lat, wpPos[1], wpPos[2] + right[2] * lat];
    items.push({ d: dist3(cam.pos, [pos[0], pos[1] + 0.9, pos[2]]), draw: () => drawWet(ctx, cam, pos, t, front, 1, 1) });
  }
  items.sort((a, b) => b.d - a.d);
  for (const it of items) if (!it.wall) it.draw();
  return { cam, cf, lights };
}

function bangleShards(ctx, w, h, t) {
  // red glass bangle shards falling onto the step in front of the camera (breakdown -> re-drop)
  const t0 = 28.95; if (t < t0 || t > 31.6) return;
  const lt = t - t0; const r = mulberry32(77);
  const s = w / 1080; ctx.save();
  const fade = 1 - sm(30.7, 31.6, t);
  for (let i = 0; i < 26; i++) {
    const x0 = 540 + (r() - 0.5) * 360, vx = (r() - 0.5) * 140, tf = 0.25 + r() * 0.3, size = (10 + r() * 22);
    const fy = 1050 + r() * 130; const ph = lt / tf;
    let y, x = x0 + vx * Math.min(lt, tf + 0.5), a = fade;
    if (lt < tf) y = lerp(200 + r() * 100, fy, ph * ph); else { const b = lt - tf; y = fy - Math.abs(Math.sin(b * 9)) * 40 * Math.exp(-b * 4); }
    const rot = r() * TAU + lt * (r() - 0.5) * 6;
    ctx.save(); ctx.translate(x * s, y * s); ctx.rotate(rot); ctx.scale(s, s);
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * (0.35 + r() * 0.5)); ctx.arc(0, 0, size * 0.62, Math.PI * (0.35 + r() * 0.5), 0, true); ctx.closePath();
    ctx.fillStyle = 'rgba(190,18,26,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,170,130,0.75)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function renderInterior(ctx, w, h, t) {
  // inside the flat: camera low at the door gap; the stair light strip under the door
  const lt = t - 40.03;
  const cam = makeCamera({ pos: [0.0, 0.32 - 0.02 * lt, -1.4 + 0.1 * lt], yaw: 0, pitch: -0.1, roll: 0.01, fov: 62, width: w, height: h, shake: handheld(t, 0.5, 9) });
  ctx.fillStyle = '#010101'; ctx.fillRect(0, 0, w, h);
  const strip = 0.55 + 0.1 * Math.sin(t * 17) * Math.cos(t * 5);
  const lights = [{ type: 'point', pos: [0, 0.03, 0.05], color: WARM, intensity: 1.9 * strip, range: 2.4, box: [[-1.6, -0.1, -2.4], [1.6, 0.2, 0.2]] }];
  const ex = { lights, ambient: [0.003, 0.003, 0.004], exposure: 1.6, fog: { start: 1, density: 0.07, colorLin: [0.003, 0.004, 0.006] } };
  // floor (dark tiles, the light spreading in a wedge)
  drawQuad(ctx, cam, [[-2.2, 0, 0], [2.2, 0, 0], [2.2, 0, -4], [-2.2, 0, -4]].reverse(), { ...ex, base: '#4a4642', nx: 14, ny: 14, cull: false, normal: [0, 1, 0], texture: (u, v) => 0.6 + 0.5 * (((Math.floor(u * 8) + Math.floor(v * 8)) & 1) ? 1 : 0.7) + fbm(u * 6, v * 6, 4) * 0.3 });
  // door leaf (dark wood) with the gap at the bottom
  drawQuad(ctx, cam, [[-1.1, 0.06, 0], [1.1, 0.06, 0], [1.1, 2.2, 0], [-1.1, 2.2, 0]], { ...ex, base: '#2a1a10', nx: 6, ny: 10, cull: false, normal: [0, 0, -1], emissive: [0.004, 0.003, 0.002], texture: (u, v) => 0.5 + fbm(u * 3, v * 16, 41) * 0.7 });
  // the light strip itself (warm) beneath the door
  polyScreen(ctx, cam, [[-1.1, 0, 0.002], [1.1, 0, 0.002], [1.1, 0.06, 0.002], [-1.1, 0.06, 0.002]], `rgba(255,${Math.round(170 + 30 * strip)},90,${0.88 * strip})`);
  // bolt + latch
  drawBox(ctx, cam, [0.78, 1.0, -0.03], [0.96, 1.05, 0.0], { ...ex, base: '#222', nx: 1, ny: 1, exposure: 2.5 });
  // two wet feet standing outside, breaking the strip after the hit at 53.5-12.0 = 41.5
  const hit = t > 41.5; const a = sm(41.5, 41.58, t);
  if (hit) {
    const sc = cam.project([0.0, 0.0, 0.0]); const pL = cam.project([-0.34, 0.0, 0.0]), pR = cam.project([0.34, 0.0, 0.0]);
    ctx.save(); ctx.globalAlpha = a;
    for (const [cx, sgn] of [[-0.22, -1], [0.22, 1]]) {
      const p0 = cam.project([cx - 0.11, 0.0, 0.0]), p1 = cam.project([cx + 0.11, 0.0, 0.0]), p2 = cam.project([cx + 0.12, 0.06, 0.0]), p3 = cam.project([cx - 0.12, 0.06, 0.0]);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.closePath(); ctx.fillStyle = 'rgba(0,0,0,0.98)'; ctx.fill();
      // water dripping off them into the light
      const dr = (t * 1.3 + (sgn > 0 ? 0.4 : 0)) % 1;
      const dp = cam.project([cx + sgn * 0.02, 0.0, 0.01]);
      ctx.fillStyle = `rgba(200,225,245,${0.9 * (1 - dr)})`; ctx.beginPath(); ctx.ellipse(dp.x, dp.y - dr * 40 * w / 1080 + 10, 3 * w / 1080, 7 * w / 1080, 0, 0, TAU); ctx.fill();
    }
    // wet pool spreading on the floor, catching the light
    const pp = cam.project([0.0, 0.0, -0.05]); const sp = Math.min(1, (t - 41.5) / 0.8);
    const g = ctx.createRadialGradient(pp.x, pp.y + 8, 0, pp.x, pp.y + 8, 260 * sp * w / 1080); g.addColorStop(0, 'rgba(255,190,110,0.30)'); g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = g; ctx.fillRect(pp.x - 300, pp.y - 60, 600, 200); ctx.restore();
  }
  return { cam };
}

// ------------------------------------------------------------------ composite per frame
function post(ctx, w, h, t, cf) {
  const s = w / 1080;
  const hp = hitPulse(t, HITS, 11) * (t > 2.87 && t < 40.5 ? 1 : 0);
  softenLayer(ctx, w, h, 3.4 * s);
  // volumetric bulb halo + dust
  // colour grade: teal shadows, warm highlights
  ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(30,70,80,0.30)'; ctx.fillRect(0, 0, w, h); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(205,215,225,1)'; ctx.fillRect(0, 0, w, h); ctx.restore();
  drawFogBanks(ctx, w, h, { t, y: h * 0.62, h: h * 0.22, alpha: 0.10, color: [120, 140, 150], layers: 3, speed: 9 });
  if (hp > 0.04) chromaticAberration(ctx, w, h, 5 * s * hp + (t >= T_TURN && t < 25.5 ? 10 * s : 0));
  drawGrain(ctx, w, h, t, 1.1, 15);
  drawVignette(ctx, w, h, 0.82);
  // hit flash on the bulb side: warm bloom, never a full-frame flash
  if (hp > 0.1 && t > 2.87) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(w / 2, h * 0.36, 0, w / 2, h * 0.36, w * 0.8); g.addColorStop(0, `rgba(255,170,90,${0.07 * hp})`); g.addColorStop(1, 'rgba(255,170,90,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore(); }
}

const FONT = '"Noto Sans Devanagari","Noto Sans","DejaVu Sans",sans-serif';
function caption(ctx, w, h, t, timeline) {
  const cap = (timeline.captions || []).find((c) => t >= c.start_s && t < c.end_s); if (!cap) return;
  const s = w / 1080; const lines = cap.text.split('\n'); const size = 52, step = 72, y = 1262;
  const a = sm(cap.start_s, cap.start_s + 0.12, t) * (1 - sm(cap.end_s - 0.1, cap.end_s, t));
  ctx.save(); ctx.scale(s, s); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, y - 150, 0, y + 150); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, y - 150, 1080, 300);
  ctx.font = `900 ${size}px ${FONT}`; ctx.textBaseline = 'middle';
  const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width)); const sc = Math.min(1, 800 / maxW);
  ctx.translate(480, y - ((lines.length - 1) * step * sc) / 2); ctx.scale(sc, sc);
  const clean = (x) => String(x || '').replace(/[.,?!;:'"()।]+$/g, '');
  const red = clean(cap.red);
  lines.forEach((ln, i) => {
    const words = ln.split(' '); const spw = ctx.measureText(' ').width; const Wd = ctx.measureText(ln).width; let x = -Wd / 2; const yy = i * step;
    for (const wd of words) {
      const ww = ctx.measureText(wd).width;
      ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(0,0,0,0.92)'; ctx.strokeText(wd, x, yy);
      ctx.fillStyle = clean(wd) === red ? '#ff3b3b' : '#ffffff'; ctx.fillText(wd, x, yy);
      x += ww + spw;
    }
  });
  ctx.restore();
}

export const VideoClock = {
  setTime(sec) { T = sec; },
  draw(ctx, width, height, timeline) {
    const t = T;
    let cf = null;
    ctx.save();
    if (t >= 40.03) renderInterior(ctx, width, height, t);
    else renderStairs(ctx, width, height, t);
    bangleShards(ctx, width, height, t);
    post(ctx, width, height, t, cf);
    ctx.restore();
    caption(ctx, width, height, t, timeline);
    // hard black at the very first frame so the bulb snaps on at 0.07 s
  }
};
