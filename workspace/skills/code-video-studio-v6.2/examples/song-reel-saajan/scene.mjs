// "Saajan Saajan": song-driven cinematic horror. Pure code, deterministic f(t). No photos, no AI images.
// Every visual event is read from beat_map.json (sub-bass hits, onsets, bar anchors).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SK = '/mnt/project-files/skills/code-video-studio-v6.2/';
const S3 = await import(SK + 'lib/scene3d.mjs');
const { drawGrain, drawVignette, mulberry32, hitPulse } = S3;
const { loadCanvas } = await import(SK + 'lib/runtime.mjs');
const { createCanvas } = await loadCanvas();

const BM = JSON.parse(fs.readFileSync(path.join(HERE, 'beat_map.json'), 'utf8'));
const HITS = BM.sub_bass_hits;           // song seconds == video seconds (full cut)
const ONS = BM.onsets;
const DROP = 14.86;
const TAU = Math.PI * 2;
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const sm = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const eo = (x) => 1 - Math.pow(1 - cl(x), 3);
const hash = (x, y = 0, z = 0) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vn(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i, seed), hash(i + 1, seed), u); }
const fbm1 = (x, seed = 0) => vn(x, seed) * 0.55 + vn(x * 2.07, seed + 5) * 0.3 + vn(x * 4.3, seed + 9) * 0.15;
const pulse = (t, decay = 10) => hitPulse(t, HITS, decay);
const lastHit = (t) => { let k = -1; for (let i = 0; i < HITS.length; i++) { if (HITS[i] <= t) k = i; else break; } return k; };
const SIL = '#02060a';

// ---------------------------------------------------------------- picture time (slow-mo ramps; audio is never slowed)
function pictureTime(t) {
  if (t >= DROP && t < DROP + 1.5) { const u = (t - DROP) / 1.5; return DROP + 1.5 * Math.pow(u, 1.9); }   // 0.0x -> 1x over 1.5 s
  if (t >= 41.98 && t < 42.9) { const u = (t - 41.98) / 0.92; return 41.98 + 0.92 * Math.pow(u, 1.6); }
  return t;
}
// cinematic band: picture height in px (rest is black bars)
const BAND = [[0, 1920], [14.78, 1920], [14.93, 584], [16.4, 584], [17.4, 900], [36.72, 900], [36.83, 584], [37.55, 584], [38.2, 1100], [41.9, 1100], [41.98, 584], [43.4, 900], [50.1, 900], [51.8, 1250], [53.35, 1250], [53.5, 584], [54.3, 584], [54.69, 1100], [57.4, 1100]];
function bandH(t) { for (let i = 0; i < BAND.length - 1; i++) { const [a, ha] = BAND[i], [b, hb] = BAND[i + 1]; if (t >= a && t < b) return lerp(ha, hb, sm(a, b, t)); } return BAND[BAND.length - 1][1]; }
// pedal phase: each 808 hit is one pedal stroke
function phi(t) {
  if (t < DROP - 0.1) return t * TAU / 1.6;
  const k = lastHit(t); if (k < 0) return t * 3;
  const h = HITS[k], h2 = HITS[Math.min(HITS.length - 1, k + 1)] || h + 0.5; const f = cl((t - h) / Math.max(0.2, h2 - h));
  return Math.PI * (k + 1.0 * (f * f * (3 - 2 * f)));
}

// ---------------------------------------------------------------- generic drawing helpers
function glow(ctx, x, y, r, rgb, a = 1, add = true) {
  ctx.save(); if (add) ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`); g.addColorStop(0.25, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a * 0.35})`); g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
function flare(ctx, x, y, I, t, cx = 540, cy = 960) {
  if (I <= 0.01) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, 420 * I, [255, 190, 110], 0.85 * I);
  glow(ctx, x, y, 120 * I, [255, 250, 235], 1.0 * I);
  const g = ctx.createLinearGradient(x - 900, y, x + 900, y); g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(0.5, `rgba(190,225,255,${0.55 * I})`); g.addColorStop(1, 'rgba(120,200,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 900, y - 5 * I - 1, 1800, 10 * I + 2);          // anamorphic streak
  for (let i = 1; i <= 4; i++) { const k = 0.35 * i; const gx = lerp(x, cx * 2 - x, k), gy = lerp(y, cy * 2 - y, k); glow(ctx, gx, gy, 38 + i * 14, i % 2 ? [120, 200, 255] : [255, 160, 90], 0.14 * I); }
  ctx.restore();
}
function fogBand(ctx, t, y, h, a, color = [90, 150, 160], speed = 14, seed = 1) {
  ctx.save();
  for (let l = 0; l < 3; l++) {
    const off = ((t * speed * (1 + l * 0.5) + hash(seed, l) * 1080) % 1400);
    for (let k = -1; k <= 1; k++) {
      const cx = off + k * 1400 - 150; const cy = y + (l - 1) * h * 0.22;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 720); g.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${a / 2.2})`); g.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
      ctx.fillStyle = g; ctx.save(); ctx.translate(cx, cy); ctx.scale(1, h / 720 * 0.9); ctx.translate(-cx, -cy); ctx.fillRect(cx - 720, cy - 720, 1440, 1440); ctx.restore();
    }
  }
  ctx.restore();
}
function sky(ctx, t, hy, { moon = true, moonX = 790, moonY = 420, tint = 1 } = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, hy); g.addColorStop(0, '#010609'); g.addColorStop(0.55, '#06222b'); g.addColorStop(1, `rgb(${Math.round(24 * tint + 8)},${Math.round(84 * tint + 20)},${Math.round(92 * tint + 20)})`);
  ctx.fillStyle = g; ctx.fillRect(-10, -10, 1100, hy + 12);
  const r = mulberry32(5); ctx.fillStyle = 'rgba(210,235,245,0.8)';
  for (let i = 0; i < 70; i++) { const x = r() * 1080, y = r() * hy * 0.7, a = 0.2 + r() * 0.6 * (0.7 + 0.3 * Math.sin(t * 2 + i)); ctx.globalAlpha = a; ctx.fillRect(x, y, 2, 2); }
  ctx.globalAlpha = 1;
  if (moon) { glow(ctx, moonX, moonY, 340, [120, 190, 210], 0.28); ctx.fillStyle = '#cfe6ea'; ctx.beginPath(); ctx.arc(moonX, moonY, 46, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(80,120,130,0.35)'; ctx.beginPath(); ctx.arc(moonX - 14, moonY - 8, 12, 0, TAU); ctx.arc(moonX + 16, moonY + 14, 8, 0, TAU); ctx.fill(); }
}
function ridge(ctx, baseY, amp, seed, scroll, col, sc = 0.0042, bottom = 1930) {
  ctx.beginPath(); ctx.moveTo(-20, bottom);
  for (let x = -20; x <= 1100; x += 10) ctx.lineTo(x, baseY - amp * fbm1((x + scroll) * sc, seed));
  ctx.lineTo(1100, bottom); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}
const gsil = (ctx, y0, y1, a, b) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };

// ---------------------------------------------------------------- characters (silhouettes with rim light)
function strokeLimb(ctx, pts, w, col = SIL) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
function ik(a, b, l1, l2, dir = 1) { const dx = b[0] - a[0], dy = b[1] - a[1]; let d = Math.hypot(dx, dy); d = Math.min(d, l1 + l2 - 1e-3); const ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d); const ang = Math.atan2(dy, dx) + dir * Math.acos(cl(ca, -1, 1)); return [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1]; }

// side-view cyclist. (x,y)=ground contact of the rear wheel centre line; k = px per metre; faces +x
export function cyclistSide(ctx, x, y, k, ph, t, { lamp = 1, rim = [255, 160, 70], dist = 0, wheelAng = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, -k);        // y up in metres
  const col = SIL, R = [-0.55, 0.34], F = [0.55, 0.34], BB = [-0.05, 0.34];
  // wheels
  for (const c of [R, F]) {
    ctx.strokeStyle = col; ctx.lineWidth = 0.045; ctx.beginPath(); ctx.arc(c[0], c[1], 0.34, 0, TAU); ctx.stroke();
    ctx.lineWidth = 0.008; ctx.strokeStyle = 'rgba(140,170,180,0.35)';
    for (let i = 0; i < 12; i++) { const a = wheelAng + (i / 12) * TAU; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + Math.cos(a) * 0.33, c[1] + Math.sin(a) * 0.33); ctx.stroke(); }
    ctx.strokeStyle = `rgba(${rim[0]},${rim[1]},${rim[2]},0.45)`; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.arc(c[0], c[1], 0.355, -0.3, 1.1); ctx.stroke();
  }
  // frame
  const S = [-0.2, 0.98], H = [0.40, 1.02];
  strokeLimb(ctx, [R, BB, S, [-0.1, 0.78], F, H, [0.3, 0.8]], 0.05, col);
  strokeLimb(ctx, [S, [-0.3, 1.0]], 0.07, col); strokeLimb(ctx, [H, [0.46, 1.03], [0.5, 0.96]], 0.04, col);
  // rider
  const hip = [-0.2, 1.03], sh = [0.1, 1.52], head = [0.2, 1.7];
  strokeLimb(ctx, [hip, sh], 0.2, col);
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(head[0], head[1], 0.115, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(head[0] - 0.02, head[1] + 0.06, 0.13, 0.09, 0.4, 0, TAU); ctx.fill();     // gamchha knot / cap
  const pa = -ph;   // bike faces +x: forward pedalling is clockwise in y-up space
  const P1 = [BB[0] + 0.17 * Math.cos(pa), BB[1] + 0.17 * Math.sin(pa)], P2 = [BB[0] - 0.17 * Math.cos(pa), BB[1] - 0.17 * Math.sin(pa)];
  const rimC = `rgba(${rim[0]},${rim[1]},${rim[2]},0.55)`; for (const P of [P2, P1]) { const kn = ik(hip, P, 0.46, 0.46, 1); strokeLimb(ctx, [hip, kn, P], 0.135, rimC); }
  for (const P of [P2, P1]) { const kn = ik(hip, P, 0.46, 0.46, 1); strokeLimb(ctx, [hip, kn, P], 0.11, col); strokeLimb(ctx, [P, [P[0] + 0.1, P[1]]], 0.05, col); }
  const el = ik(sh, [0.42, 1.01], 0.36, 0.34, -1); strokeLimb(ctx, [sh, el, [0.42, 1.01]], 0.09, col);
  // rim light along the back + head
  ctx.strokeStyle = `rgba(${rim[0]},${rim[1]},${rim[2]},0.5)`; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(hip[0] - 0.09, hip[1] + 0.04); ctx.lineTo(sh[0] - 0.09, sh[1] + 0.02); ctx.stroke();
  ctx.beginPath(); ctx.arc(head[0], head[1], 0.12, 2.0, 3.4); ctx.stroke();
  ctx.restore();
  // dynamo lamp beam (screen space, additive)
  if (lamp > 0) {
    const lx = x + 0.5 * k, ly = y - 1.0 * k;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const flick = 0.75 + 0.25 * Math.sin(ph * 2) ; const a = lamp * flick;
    const g = ctx.createLinearGradient(lx, ly, lx + 700, ly + 260); g.addColorStop(0, `rgba(255,205,130,${0.5 * a})`); g.addColorStop(1, 'rgba(255,205,130,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 760, ly - 90); ctx.lineTo(lx + 760, ly + 420); ctx.closePath(); ctx.fill();
    glow(ctx, lx, ly, 120 * lamp, [255, 210, 140], 0.9 * a); ctx.restore();
  }
}

// front/back dulhan silhouette. (x,y)=feet, h=px height, wind drives the dupatta/veil
function dulhan(ctx, x, y, h, t, { alpha = 1, rim = [255, 150, 70], rimA = 0.7, wind = 1, lean = 0, back = false, glowRed = 0.5 } = {}) {
  const k = h / 1.78; ctx.save(); ctx.translate(x, y); ctx.scale(k, -k); ctx.globalAlpha = alpha;
  const w1 = Math.sin(t * 2.1) * 0.03 * wind, w2 = Math.sin(t * 3.3 + 1) * 0.05 * wind;
  const dress = ctx.createLinearGradient(0, 0, 0, 1.5); dress.addColorStop(0, '#0a0204'); dress.addColorStop(0.6, `rgb(${Math.round(60 * glowRed)},4,8)`); dress.addColorStop(1, '#0a0204');
  // dupatta: long ribbon streaming back
  ctx.fillStyle = `rgba(${Math.round(70 * glowRed + 10)},3,9,0.92)`; ctx.beginPath(); ctx.moveTo(-0.16, 1.5);
  for (let i = 0; i <= 14; i++) { const u = i / 14; ctx.lineTo(-0.2 - u * 1.25 * wind, 1.42 - u * 0.5 + Math.sin(t * 4 - u * 6) * 0.06 * u * wind); }
  for (let i = 14; i >= 0; i--) { const u = i / 14; ctx.lineTo(-0.2 - u * 1.25 * wind, 1.28 - u * 0.5 + Math.sin(t * 4 - u * 6 + 0.6) * 0.06 * u * wind - u * 0.05); }
  ctx.closePath(); ctx.fill();
  // lehenga: flared bell with wavy hem
  ctx.fillStyle = dress; ctx.beginPath(); ctx.moveTo(-0.17, 1.02); ctx.lineTo(0.17, 1.02);
  for (let i = 0; i <= 16; i++) { const u = i / 16; ctx.lineTo(lerp(0.66, -0.66, u) + w1 * (1 - u), Math.sin(u * 18 + t * 3) * 0.022); }
  ctx.closePath(); ctx.fill();
  // torso + arms
  ctx.fillStyle = '#080204'; ctx.beginPath(); ctx.moveTo(-0.2, 1.05); ctx.lineTo(0.2, 1.05); ctx.lineTo(0.23, 1.46); ctx.lineTo(-0.23, 1.46); ctx.closePath(); ctx.fill();
  strokeLimb(ctx, [[-0.23, 1.44], [-0.3, 1.18], [-0.3 + w1, 0.94]], 0.09, '#080204'); strokeLimb(ctx, [[0.23, 1.44], [0.3, 1.18], [0.3 - w1, 0.94]], 0.09, '#080204');
  // veil / ghoonghat: bell over the head, bowed
  ctx.fillStyle = '#05010a'; ctx.beginPath(); ctx.moveTo(0, 1.84 + lean);
  ctx.bezierCurveTo(0.2 + w1, 1.84, 0.34, 1.62, 0.4 + w2, 1.16); ctx.lineTo(-0.4 + w2, 1.16); ctx.bezierCurveTo(-0.34, 1.62, -0.2 + w1, 1.84, 0, 1.84 + lean); ctx.fill();
  // rim light on the lit edge + glinting bangles (the only sparkles)
  ctx.strokeStyle = `rgba(${rim[0]},${rim[1]},${rim[2]},${rimA})`; ctx.lineWidth = 0.014; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0.4 + w2, 1.16); ctx.bezierCurveTo(0.34, 1.62, 0.2 + w1, 1.84, 0, 1.84 + lean); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.17, 1.02); for (let i = 0; i <= 8; i++) { const u = i / 8; ctx.lineTo(lerp(0.17, 0.66, u), u * 0.02 + (1 - u) * 1.02 - u * 1.0 * 0 + 0); } ctx.stroke();
  for (let i = 0; i < 6; i++) { const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 6 + i * 1.7)); ctx.fillStyle = `rgba(255,${190 + i * 8},120,${a * 0.9})`; ctx.beginPath(); ctx.arc(0.3 - w1 + (i % 2) * 0.02, 0.97 + i * 0.012, 0.014, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(-0.3 + w1 - (i % 2) * 0.02, 0.97 + i * 0.012, 0.014, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- perspective world (track, lane)
function mkCam(o) { return { f: 900, hy: 900, vx: 540, x: 0, y: 1.2, z: 0, ...o }; }
function pj(c, X, Y, Z) { const dz = Z - c.z; if (dz < 0.15) return null; const f = c.f / dz; return [c.vx + (X - c.x) * f, c.hy - (Y - c.y) * f, f]; }
function poly(ctx, c, pts, fill, stroke = null, lw = 1) { const p = pts.map((q) => pj(c, q[0], q[1], q[2])); if (p.some((q) => !q)) return; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } }
function line3(ctx, c, a, b, w, col) { const p = pj(c, a[0], a[1], a[2]), q = pj(c, b[0], b[1], b[2]); if (!p || !q) return; ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.6, w * (p[2] + q[2]) / 2); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }

function trackWorld(ctx, c, t, { scroll = 0, lightI = 0, vpGlow = 0, signal = null, far = 140, tint = 0 } = {}) {
  // ground
  const g = ctx.createLinearGradient(0, c.hy, 0, 1930); g.addColorStop(0, `rgb(${24 + tint},${70 + tint},${78 + tint})`); g.addColorStop(0.12, '#07171c'); g.addColorStop(1, '#010305');
  ctx.fillStyle = g; ctx.fillRect(-10, c.hy, 1100, 1930 - c.hy);
  // ballast bed
  poly(ctx, c, [[-2.4, 0, c.z + 1], [2.4, 0, c.z + 1], [1.5, 0, far], [-1.5, 0, far]], 'rgba(30,38,40,0.9)');
  // sleepers
  const sp = 0.62, off = scroll % sp;
  for (let n = 0; n < 160; n++) {
    const Z = c.z + 1.2 + n * sp - off; if (Z < c.z + 0.6 || Z > far) continue;
    const near = 1 - cl((Z - c.z) / far);
    poly(ctx, c, [[-1.35, 0.0, Z], [1.35, 0.0, Z], [1.35, 0.0, Z + 0.26], [-1.35, 0.0, Z + 0.26]], `rgba(8,12,12,${0.95})`);
    poly(ctx, c, [[-1.35, 0.05, Z], [1.35, 0.05, Z], [1.35, 0.05, Z + 0.05], [-1.35, 0.05, Z + 0.05]], `rgba(${60 + 140 * lightI * near},${80 + 110 * lightI * near},${80 + 70 * lightI * near},${0.18 + 0.4 * near * (0.4 + lightI)})`);
  }
  // rails with a specular line (catches the headlight)
  for (const X of [-0.72, 0.72]) {
    poly(ctx, c, [[X - 0.04, 0.16, c.z + 0.8], [X + 0.04, 0.16, c.z + 0.8], [X + 0.02, 0.16, far], [X - 0.02, 0.16, far]], '#0c1417');
    poly(ctx, c, [[X - 0.012, 0.165, c.z + 0.8], [X + 0.012, 0.165, c.z + 0.8], [X + 0.006, 0.165, far], [X - 0.006, 0.165, far]], `rgba(${150 + 105 * lightI},${180 + 60 * lightI},${200},${0.45 + 0.5 * lightI})`);
  }
  // overhead masts and the sagging wire
  const mp = 28, moff = scroll % mp;
  const masts = []; for (let n = -1; n < 8; n++) { const Z = c.z + 6 + n * mp - moff; if (Z > c.z + 0.5 && Z < far) masts.push(Z); }
  masts.sort((a, b) => b - a);
  for (const Z of masts) {
    line3(ctx, c, [3.3, 0, Z], [3.3, 6.6, Z], 0.16, '#030809'); line3(ctx, c, [3.3, 6.0, Z], [0.2, 6.2, Z], 0.08, '#030809'); line3(ctx, c, [3.3, 5.2, Z], [3.3, 6.0, Z], 0.06, '#030809');
    line3(ctx, c, [-3.3, 0, Z], [-3.3, 6.6, Z], 0.16, '#030809');
    ctx.fillStyle = 'rgba(200,225,235,0.8)'; const ip = pj(c, 0.2, 6.2, Z); if (ip) { ctx.beginPath(); ctx.arc(ip[0], ip[1], Math.max(1, 0.05 * ip[2]), 0, TAU); ctx.fill(); }
  }
  for (let i = 0; i < masts.length - 1; i++) { const Z1 = masts[i], Z2 = masts[i + 1]; for (let s = 0; s < 6; s++) { const a = s / 6, b = (s + 1) / 6; const za = lerp(Z1, Z2, a), zb = lerp(Z1, Z2, b); const sag = (u) => 0.6 * Math.sin(u * Math.PI); line3(ctx, c, [0.2, 6.2 - sag(a), za], [0.2, 6.2 - sag(b), zb], 0.03, 'rgba(10,18,20,0.9)'); } }
  // signal lamp
  if (signal) { const sp2 = pj(c, signal.x, 3.2, signal.z); if (sp2) { line3(ctx, c, [signal.x, 0, signal.z], [signal.x, 3.4, signal.z], 0.12, '#030708'); const r = Math.max(2, 0.13 * sp2[2]); glow(ctx, sp2[0], sp2[1], r * 7, signal.col, signal.on, true); ctx.fillStyle = `rgba(${signal.col[0]},${signal.col[1]},${signal.col[2]},${signal.on})`; ctx.beginPath(); ctx.arc(sp2[0], sp2[1], r, 0, TAU); ctx.fill(); } }
  if (vpGlow > 0) glow(ctx, c.vx, c.hy, 520, [255, 190, 120], vpGlow);
}

// ---------------------------------------------------------------- shots
function landscape(ctx, t, hy, scroll, o = {}) {
  sky(ctx, t, hy, o.sky);
  ridge(ctx, hy + 10, 120, 3, scroll * 0.05, '#0a2a31', 0.004, hy + 40);
  ridge(ctx, hy + 24, 90, 8, scroll * 0.12, '#06171c', 0.006, hy + 60);
  fogBand(ctx, t, hy - 10, 120, 0.22, [80, 150, 160], 6, 2);
}

// 1: lane, rear view. Vocal onsets light the village; the cyclist rolls away down the lane.
function shotLaneRear(ctx, t, pt) {
  const hy = 860; const cz = pt * 2.2; const c = mkCam({ hy, y: 1.5, z: cz, x: Math.sin(t * 0.4) * 0.05, f: 960 - 30 * sm(0, 5.4, t) });
  landscape(ctx, t, hy, cz * 8);
  // road
  ctx.fillStyle = gsil(ctx, hy, 1930, '#0d2a30', '#030608'); ctx.fillRect(-10, hy, 1100, 1930 - hy);
  poly(ctx, c, [[-2.6, 0, cz + 1], [2.6, 0, cz + 1], [1.9, 0, cz + 90], [-1.9, 0, cz + 90]], 'rgba(40,52,52,0.7)');
  // houses both sides: perspective facades with windows that ignite on vocal onsets
  const ign = ONS.filter((o) => o > 0.3 && o < 5.5);
  for (const side of [-1, 1]) {
    const facades = [];
    for (let n = 0; n < 14; n++) { const Z0 = Math.floor(cz / 6) * 6 + n * 6; facades.push(Z0); }
    facades.sort((a, b) => b - a);
    for (const Z0 of facades) {
      const id = Math.round(Z0 / 6) * (side > 0 ? 1 : -1) + 100; const hgt = 3 + hash(id, 1) * 2.4; const X = side * (3.1 + hash(id, 2) * 0.6);
      poly(ctx, c, [[X, 0, Z0], [X, 0, Z0 + 5.4], [X, hgt, Z0 + 5.4], [X, hgt + 0.4, Z0]], '#04101a');
      poly(ctx, c, [[X, hgt + 0.4, Z0], [X, hgt, Z0 + 5.4], [X + side * 0.6, hgt + 0.8, Z0 + 5.4], [X + side * 0.6, hgt + 1.2, Z0]], '#020a10');
      for (let w = 0; w < 2; w++) {
        const wz = Z0 + 0.9 + w * 2.4; const wid = (id * 7 + w) % ign.length; const tIgn = ign[wid] ?? 99; const on = sm(tIgn, tIgn + 0.1, t) * (0.7 + 0.3 * Math.sin(t * 9 + id + w));
        const lit = hash(id, 10 + w) > 0.35 ? on : 0;
        poly(ctx, c, [[X, 1.1, wz], [X, 1.1, wz + 0.8], [X, 2.1, wz + 0.8], [X, 2.1, wz]], lit > 0 ? `rgba(255,${150 + 40 * hash(id, w)},60,${0.25 + 0.7 * lit})` : 'rgba(8,24,30,0.9)');
        const p = pj(c, X, 1.6, wz + 0.4); if (p && lit > 0.2) glow(ctx, p[0], p[1], 0.9 * p[2], [255, 150, 60], 0.45 * lit);
      }
    }
  }
  // tea stall tube light
  const tIgn = 1.95; const tube = sm(tIgn, tIgn + 0.08, t) * (0.75 + 0.25 * Math.sin(t * 40));
  const tp = pj(c, 2.6, 2.4, cz + 28); if (tp) { glow(ctx, tp[0], tp[1], 300 * (tp[2] / 30), [200, 240, 255], 0.6 * tube); ctx.fillStyle = `rgba(230,250,255,${tube})`; ctx.fillRect(tp[0] - 18, tp[1] - 3, 36, 6); }
  // scratched-out shaadi poster on a wall (appears at onset 3.74)
  const pp = pj(c, -3.2, 1.8, cz + 20); if (pp) { const a = sm(3.74, 3.9, t); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#b0302a'; ctx.fillRect(pp[0] - 0.55 * pp[2] * 0.2, pp[1] - 0.8 * pp[2] * 0.2, 1.1 * pp[2] * 0.2, 1.6 * pp[2] * 0.2); ctx.fillStyle = 'rgba(20,6,6,0.9)'; ctx.beginPath(); ctx.arc(pp[0], pp[1] - 0.2 * pp[2] * 0.2, 0.3 * pp[2] * 0.2, 0, TAU); ctx.fill(); ctx.restore(); }
  // cyclist from behind (silhouette)
  const rz = cz + 7.5; const cp = pj(c, Math.sin(t * 0.7) * 0.12, 0, rz); const k = cp[2];
  const ph = phi(t); const lp = Math.sin(ph) * 0.2;
  ctx.save(); ctx.translate(cp[0], cp[1]); ctx.scale(k, -k);
  ctx.strokeStyle = SIL; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.ellipse(0, 0.34, 0.035, 0.34, 0, 0, TAU); ctx.stroke();
  strokeLimb(ctx, [[0, 0.34], [0, 1.0]], 0.05); strokeLimb(ctx, [[-0.02, 1.0], [-0.08, 1.52]], 0.34); ctx.fillStyle = SIL; ctx.beginPath(); ctx.arc(-0.06, 1.7, 0.12, 0, TAU); ctx.fill();
  strokeLimb(ctx, [[-0.1, 1.02], [-0.12, 0.7 + lp * 0.4], [-0.1, 0.36 + lp]], 0.12); strokeLimb(ctx, [[0.06, 1.02], [0.08, 0.7 - lp * 0.4], [0.07, 0.36 - lp]], 0.12);
  strokeLimb(ctx, [[-0.2, 1.46], [-0.3, 1.2], [-0.14, 1.02]], 0.08);  strokeLimb(ctx, [[0.18, 1.46], [0.3, 1.2], [0.16, 1.02]], 0.08);
  ctx.fillStyle = 'rgba(255,40,30,0.9)'; ctx.beginPath(); ctx.arc(0, 0.5, 0.025, 0, TAU); ctx.fill();   // rear reflector
  ctx.restore();
  glow(ctx, cp[0], cp[1] - 0.5 * k, 60 * k * 0.5, [255, 40, 30], 0.5 + 0.2 * Math.sin(ph * 2));
  const beam = ctx.createLinearGradient(cp[0], cp[1], cp[0], cp[1] - 420);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = (() => { const g = ctx.createRadialGradient(cp[0], cp[1] - 120, 0, cp[0], cp[1] - 120, 300); g.addColorStop(0, 'rgba(255,200,120,0.28)'); g.addColorStop(1, 'rgba(255,200,120,0)'); return g; })(); ctx.fillRect(cp[0] - 320, cp[1] - 440, 640, 440); ctx.restore();
  fogBand(ctx, t, 1000, 260, 0.2, [70, 130, 140], 10, 4);
  if (t > 0.04 && t < 0.4) glow(ctx, 540, 1100, 200, [255, 200, 120], 0.8 * (1 - (t - 0.04) / 0.36)); // dynamo lamp clicks on at 0.07
}

// 2: side tracking, cyclist profile, parallax village, a buffalo that watches him, marigold petals leading on.
function shotSide(ctx, t, pt, o = {}) {
  const hy = 1000; const speed = o.speed ?? 260; const scroll = pt * speed;
  landscape(ctx, t, hy - 40, scroll, { sky: { moonX: 300 + 0 } });
  // village skyline layer (far) + near shop fronts layer
  const layer = (par, baseY, col, seed, hmin, hmax, lit) => {
    const sc = scroll * par; const w0 = 130; const i0 = Math.floor((sc - 200) / w0);
    for (let i = i0; i < i0 + 12; i++) {
      const x = i * w0 - sc + 200; const h = hmin + hash(i, seed) * (hmax - hmin); const w = w0 - 12 + hash(i, seed + 1) * 20;
      ctx.fillStyle = col; ctx.fillRect(x, baseY - h, w, h + 400);
      if (hash(i, seed + 2) > 0.5) { ctx.beginPath(); ctx.moveTo(x - 6, baseY - h); ctx.lineTo(x + w / 2, baseY - h - 40); ctx.lineTo(x + w + 6, baseY - h); ctx.fill(); }
      if (hash(i, seed + 3) > 0.8) { ctx.fillRect(x + w * 0.3, baseY - h - 60, w * 0.35, 60); }          // water tank
      if (lit) for (let r = 0; r < 2; r++) { const on = hash(i, seed + 7 + r) > 0.45; if (on) { const wx = x + 20 + r * 50, wy = baseY - h + 24; const fl = 0.7 + 0.3 * Math.sin(t * 7 + i * 3 + r); ctx.fillStyle = `rgba(255,${140 + 30 * hash(i, r)},50,${0.85 * fl})`; ctx.fillRect(wx, wy, 22, 30); glow(ctx, wx + 11, wy + 15, 70, [255, 140, 50], 0.3 * fl); } }
    }
  };
  layer(0.2, hy - 10, '#041217', 11, 160, 300, true);
  layer(0.45, hy + 30, '#02090d', 21, 200, 360, true);
  // road + near edge
  ctx.fillStyle = gsil(ctx, hy + 40, 1930, '#0b1e23', '#010304'); ctx.fillRect(-10, hy + 40, 1100, 1930 - hy - 40);
  // shop shutters/bulbs on the mid layer: pendulum bulbs on onsets
  const bulbs = o.bulbs ?? 1;
  const sc = scroll * 0.8; const w0 = 360; const i0 = Math.floor((sc - 300) / w0);
  for (let i = i0; i < i0 + 5; i++) {
    const x = i * w0 - sc + 300; const sway = Math.sin(t * 2.3 + i) * 14 + pulse(t, 6) * 20 * Math.sin(i + t * 20);
    ctx.fillStyle = '#010507'; ctx.fillRect(x, hy - 260, 240, 330); ctx.fillRect(x - 10, hy - 280, 260, 28);
    const on = hash(i, 5) > 0.3 ? 1 : 0.0; const bx = x + 120 + sway, by = hy - 190;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 120, hy - 250); ctx.lineTo(bx, by); ctx.stroke();
    const a = bulbs * on * (0.8 + 0.2 * Math.sin(t * 13 + i)); glow(ctx, bx, by, 260, [255, 150, 50], 0.7 * a); ctx.fillStyle = `rgba(255,220,150,${a})`; ctx.beginPath(); ctx.arc(bx, by, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,150,50,${0.16 * a})`; ctx.fillRect(x, hy - 150, 240, 230);   // lit shop interior
  }
  // buffalo staring (profile -> head turns to camera as he passes), optional
  if (o.buffalo) {
    const bx = 760 - (pt - 5.44) * 40; const turn = sm(7.5, 9.3, t);
    ctx.save(); ctx.translate(bx, hy + 60); ctx.fillStyle = '#010406';
    ctx.beginPath(); ctx.ellipse(0, -110, 190, 95, 0, 0, TAU); ctx.fill();
    for (const lx of [-120, -60, 90, 150]) ctx.fillRect(lx - 14, -50, 28, 110);
    ctx.beginPath(); ctx.ellipse(-200 + 40 * turn, -150, 70 - 14 * turn, 54, -0.3 * (1 - turn), 0, TAU); ctx.fill();
    ctx.strokeStyle = '#010406'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-230 + 40 * turn, -190); ctx.quadraticCurveTo(-300 + 40 * turn, -250, -250 + 40 * turn, -300); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-170 + 40 * turn, -196); ctx.quadraticCurveTo(-120 + 40 * turn, -270, -160 + 40 * turn, -310); ctx.stroke();
    const ea = sm(8.2, 8.5, t); ctx.fillStyle = `rgba(255,70,40,${0.9 * ea})`; ctx.beginPath(); ctx.arc(-208 + 44 * turn, -158, 5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(-184 + 44 * turn, -160, 5, 0, TAU); ctx.fill();   // eye-shine
    ctx.restore();
  }
  // marigold petals on the road: appear on vocal onsets
  if (o.petals) {
    for (const ot of ONS) { if (ot < 5.5 || ot > 11.6 || t < ot) continue; const i = ONS.indexOf(ot); const x = 130 + (ot - 5.44) * 135 + 0; const ax = x - scroll * 0.0; const a = sm(ot, ot + 0.2, t); ctx.fillStyle = `rgba(210,40,30,${0.9 * a})`; for (let p = 0; p < 7; p++) { ctx.beginPath(); ctx.ellipse(ax + (p - 3) * 9, hy + 140 + hash(i, p) * 24, 7, 3.5, hash(i, p + 3) * 3, 0, TAU); ctx.fill(); } glow(ctx, ax, hy + 150, 90, [255, 60, 40], 0.3 * a); }
  }
  // dulhan running far layer
  if (o.chaser) { const c = o.chaser(t); dulhan(ctx, c.x, c.y, c.h, t, { alpha: c.a, wind: 1.6, rimA: 0.8 }); }
  // cyclist
  const ph = phi(t); const cx = o.cx ?? 560; const cyy = hy + 180; const kk = 300;
  ctx.save(); ctx.translate(0, 0); ctx.restore();
  glow(ctx, cx + 0.1 * kk, cyy - 0.8 * kk, 0.95 * kk, [120, 190, 200], 0.28, true);
  cyclistSide(ctx, cx, cyy, kk, ph, t, { lamp: 1, wheelAng: -scroll / (0.34 * kk * 0.6) });
  fogBand(ctx, t, hy + 150, 220, 0.2, [70, 140, 150], 18, 6);
}

// 3: the crossing. static low camera pushing in; the signal lamp snaps off at the riser peak.
function shotCrossing(ctx, t, pt) {
  const k = cl((t - 11.52) / 3.3);
  const c = mkCam({ hy: 900, y: 0.55, z: -k * 3, f: 980 + 100 * k });
  sky(ctx, t, 900, { moonX: 330, moonY: 380 }); ridge(ctx, 912, 100, 3, 0, '#0a2a31', 0.004, 940); ridge(ctx, 922, 70, 8, 0, '#06171c', 0.006, 950);
  const sig = { x: -3.6, z: 22, col: [255, 40, 30], on: t < 14.79 ? 0.9 + 0.1 * Math.sin(t * 9) : 0 };
  trackWorld(ctx, c, t, { scroll: 0, lightI: 0.08 + 0.2 * sm(12, 14.8, t), signal: sig, vpGlow: 0.15 * sm(11.5, 14.7, t) });
  // crossing barrier boom (striped), pole at left
  poly(ctx, c, [[-3.4, 0, 6], [-3.2, 0, 6], [-3.2, 1.6, 6], [-3.4, 1.6, 6]], '#020608');
  for (let i = 0; i < 10; i++) { const x0 = -3.3 + i * 0.66, x1 = x0 + 0.66; poly(ctx, c, [[x0, 1.55, 6], [x1, 1.55, 6], [x1, 1.7, 6], [x0, 1.7, 6]], i % 2 ? '#c8c8c0' : '#1a0c0c'); }
  // far veil (barely there) on the rails, growing as the riser builds
  const va = sm(12.8, 14.7, t); const dp = pj(c, 0, 0, 60); if (va > 0) dulhan(ctx, dp[0], dp[1], 1.78 * dp[2], t, { alpha: 0.9 * va, rimA: 0.2, wind: 0.4, glowRed: 0.9 });
  fogBand(ctx, t, 930, 160, 0.3, [80, 150, 160], 8, 3);
  // riser: haze brightens and the whole frame leans into the horizon
  glow(ctx, 540, 900, 700 * sm(13, 14.78, t), [255, 200, 130], 0.25 * sm(13, 14.78, t));
}

// 4: DROP. headlight blasts on behind her, backlit dulhan on the rails.
function shotDrop(ctx, t, pt) {
  const u = cl((pt - DROP) / 1.5);
  const c = mkCam({ hy: 960, y: 0.35, z: 0, f: 1000 + 120 * u, x: 0 });
  sky(ctx, t, 960, { moonX: 330, moonY: 400, tint: 1.3 }); ridge(ctx, 968, 90, 3, 0, '#0a2a31', 0.004, 990);
  const L = 0.7 + 0.3 * sm(0, 0.1, pt - DROP);
  trackWorld(ctx, c, t, { scroll: 0, lightI: 1, vpGlow: 0.9 * L });
  // volumetric headlight shaft from the vanishing point
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) { const g = ctx.createLinearGradient(540, 960, 540, 1930); g.addColorStop(0, `rgba(255,220,160,${0.30 - i * 0.05})`); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; const sp = 70 + i * 90; ctx.beginPath(); ctx.moveTo(530, 960); ctx.lineTo(550, 960); ctx.lineTo(540 + sp * 4.2, 1930); ctx.lineTo(540 - sp * 4.2, 1930); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  const Zd = 7 - 2.4 * u; const dp = pj(c, 0, 0, Zd);
  dulhan(ctx, dp[0], dp[1], 1.78 * dp[2], t, { alpha: 1, rimA: 1, wind: 2.4, glowRed: 0.8 });
  // dust in the beam
  const r = mulberry32(31); ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 90; i++) { const x = 540 + (r() - 0.5) * 700 * (0.2 + (i % 7) / 7), y = 960 + r() * 800 + ((t * 40 * (0.3 + r())) % 120); ctx.fillStyle = `rgba(255,225,170,${0.1 + r() * 0.35})`; ctx.fillRect(x, y, 2.2, 2.2); } ctx.restore();
  fogBand(ctx, t, 1010, 150, 0.35, [200, 170, 130], 12, 9);
  flare(ctx, 540, 960, 1.0 * L * (0.85 + 0.15 * Math.sin(t * 30)), t);
}

// 5: chase along the track, camera in front of the cyclist, the dulhan running behind him in the headlight.
function shotTrackFront(ctx, t, pt, o = {}) {
  const sp = o.speed ?? 14; const scroll = pt * sp;
  const c = mkCam({ hy: o.hy ?? 880, y: o.camY ?? 0.7, z: 0, f: 1000, x: o.camX ?? 0 });
  sky(ctx, t, c.hy, { moonX: 700, moonY: 360 }); ridge(ctx, c.hy + 8, 100, 3, scroll, '#0a2a31', 0.004, c.hy + 40);
  trackWorld(ctx, c, t, { scroll: -scroll, lightI: 0.9, vpGlow: 0.8 });
  // cyclist riding toward camera (front view), pedal-driven
  const z = o.z ?? 5.5; const cp = pj(c, o.cyX ?? 0.05, 0, z); const k = cp[2]; const ph = phi(t); const sw = Math.sin(ph) * 0.05;
  const hh = 0.7 + 0.0; ctx.save(); ctx.translate(cp[0], cp[1]); ctx.scale(k, -k);
  ctx.strokeStyle = SIL; ctx.lineWidth = 0.045; ctx.beginPath(); ctx.ellipse(0, 0.34, 0.04, 0.34, 0, 0, TAU); ctx.stroke();
  strokeLimb(ctx, [[0, 0.34], [0, 1.0]], 0.05); strokeLimb(ctx, [[-0.4, 1.03], [0.4, 1.03]], 0.04);
  strokeLimb(ctx, [[0, 1.0 + sw], [0.01, 1.55]], 0.36); ctx.fillStyle = SIL; ctx.beginPath(); ctx.arc(0, 1.74, 0.12, 0, TAU); ctx.fill();
  const l1 = Math.sin(ph) * 0.22, l2 = -l1; strokeLimb(ctx, [[-0.1, 1.04], [-0.14 - 0.03, 0.7 + l1 * 0.5], [-0.1, 0.38 + l1]], 0.13); strokeLimb(ctx, [[0.1, 1.04], [0.14 + 0.03, 0.7 + l2 * 0.5], [0.1, 0.38 + l2]], 0.13);
  strokeLimb(ctx, [[-0.22, 1.5], [-0.34, 1.26], [-0.4, 1.03]], 0.09); strokeLimb(ctx, [[0.22, 1.5], [0.34, 1.26], [0.4, 1.03]], 0.09);
  ctx.strokeStyle = 'rgba(255,170,90,0.5)'; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.arc(0, 1.74, 0.125, 3.6, 5.5); ctx.stroke();
  ctx.restore();
  // dynamo lamp toward the camera
  glow(ctx, cp[0], cp[1] - 1.0 * k, 160, [255, 215, 150], 0.85 * (0.8 + 0.2 * Math.sin(ph * 2)));
  // the dulhan behind him (huge in the headlight), closer each bar
  const closeness = o.chaseK ? o.chaseK(t) : 0.5; const dz = lerp(26, 8, closeness); const dp = pj(c, 0.0 + Math.sin(t * 4) * 0.05, 0, dz);
  dulhan(ctx, dp[0], dp[1], 1.78 * dp[2], t, { alpha: 1, rimA: 0.9, wind: 2.8, glowRed: 0.8 });
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { const g = ctx.createLinearGradient(540, c.hy, 540, 1930); g.addColorStop(0, `rgba(255,215,150,${0.25 - i * 0.06})`); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(528, c.hy); ctx.lineTo(552, c.hy); ctx.lineTo(540 + (90 + i * 90) * 4.2, 1930); ctx.lineTo(540 - (90 + i * 90) * 4.2, 1930); ctx.closePath(); ctx.fill(); } ctx.restore();
  fogBand(ctx, t, c.hy + 120, 200, 0.28, [150, 140, 120], 14, 7);
  flare(ctx, 540, c.hy, 0.7 * (0.85 + 0.15 * Math.sin(t * 26)), t);
}

// 6: handlebar mirror. her veil is closer behind his shoulder on every sung word.
function shotMirror(ctx, t, pt) {
  const cxm = 540, cym = 930, R = 360;
  // blurred bokeh background (village lamps)
  ctx.fillStyle = '#010608'; ctx.fillRect(-10, -10, 1100, 1940);
  const r = mulberry32(8); for (let i = 0; i < 26; i++) { const x = r() * 1080, y = 300 + r() * 1200, rad = 40 + r() * 90, a = 0.1 + r() * 0.25; const tt = (x * 0.003 + t * 0.2); glow(ctx, (x - t * 80 * (0.3 + r())) % 1180, y, rad, i % 3 ? [255, 150, 60] : [90, 200, 220], a * (0.7 + 0.3 * Math.sin(t * 3 + i))); }
  // mirror content: the track receding with the veil closer on each word
  const words = [28.46, 29.34, 30.0, 30.64, 35.18, 35.94];
  let step = 0; for (const w of words) if (t >= w - 0.02) step++;
  const kk = cl(step / 4);
  ctx.save(); ctx.beginPath(); ctx.arc(cxm, cym, R, 0, TAU); ctx.clip();
  ctx.translate(cxm - R, cym - R); ctx.scale((R * 2) / 1080, (R * 2) / 1080 * 1.0);
  const c = mkCam({ hy: 540, y: 0.7, z: 0, f: 700, x: 0 });
  sky(ctx, t, 540, { moonX: 780, moonY: 220 }); trackWorld(ctx, c, t, { scroll: -t * 14, lightI: 0.6, vpGlow: 0.5, far: 120 });
  const dz = lerp(11, 2.7, eo(kk)); const dp = pj(c, 0.0, 0, dz); dulhan(ctx, dp[0], dp[1], 1.78 * dp[2] * 1.05, t, { alpha: 1, rimA: 1, wind: 2, glowRed: 0.9 });
  // shoulder in the mirror edge
  ctx.fillStyle = SIL; ctx.beginPath(); ctx.ellipse(120, 1080, 260, 190, 0.3, 0, TAU); ctx.fill();
  ctx.restore();
  // glass sheen + bezel
  const g = ctx.createLinearGradient(cxm - R, cym - R, cxm + R, cym + R); g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(0.35, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(100,200,220,0.08)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cxm, cym, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#05080a'; ctx.lineWidth = 34; ctx.beginPath(); ctx.arc(cxm, cym, R + 17, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,160,80,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cxm, cym, R + 30, -2.5, -0.9); ctx.stroke();
  // handlebar + stem
  ctx.strokeStyle = '#020507'; ctx.lineWidth = 46; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(60, 1380); ctx.quadraticCurveTo(540, 1250, 1020, 1400); ctx.stroke();
  ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(cxm, cym + R + 30); ctx.lineTo(cxm + 20, 1290); ctx.stroke();
  // bangle flicker on the sung words
  for (const w of words) { const d = t - w; if (d > 0 && d < 0.25) glow(ctx, 540 + (hash(w * 10) - 0.5) * 300, 930 + (hash(w * 7) - 0.5) * 300, 160, [255, 200, 120], 0.5 * (1 - d / 0.25)); }
}

// 7: look back. whip: the dulhan is enormous, filling the frame.
function shotLookBack(ctx, t, pt) {
  const k = sm(36.83, 37.37, t);
  const c = mkCam({ hy: 900, y: 1.3, z: 0, f: 900, x: 0 });
  sky(ctx, t, 900, { moonX: 300, moonY: 340 }); trackWorld(ctx, c, t, { scroll: 0, lightI: 0.5, vpGlow: 0.2 });
  const dp = pj(c, 0, 0, lerp(7, 3.2, k)); dulhan(ctx, dp[0], dp[1], 1.78 * dp[2], t, { alpha: 1, rimA: 1, wind: 3, glowRed: 0.9, lean: 0.01 });
  fogBand(ctx, t, 980, 180, 0.3, [120, 150, 150], 10, 3);
  glow(ctx, 540, 900, 520, [255, 190, 120], 0.2);
}

// 8: the goods train. glimpses of her through the gaps, one per hat tick.
function shotTrain(ctx, t) {
  const hy = 1040; const gaps = ONS.filter((o) => o > 38.25 && o < 41.9);
  // far side: foggy field, her standing there, a little closer each time
  sky(ctx, t, hy, { moonX: 820, moonY: 420, tint: 1.2 }); ridge(ctx, hy + 6, 90, 3, 0, '#0a2a31', 0.004, hy + 40);
  ctx.fillStyle = gsil(ctx, hy, 1930, '#0b2227', '#010305'); ctx.fillRect(-10, hy, 1100, 1930 - hy);
  fogBand(ctx, t, hy + 20, 160, 0.35, [100, 160, 170], 5, 2);
  const gi = gaps.filter((g) => g <= t + 0.05).length; const closeK = cl(gi / gaps.length);
  dulhan(ctx, 540 + (hash(gi, 3) - 0.5) * 60, hy + 40 + closeK * 40, lerp(430, 640, closeK), t, { alpha: 1, rimA: 0.6, wind: 1.2, glowRed: 0.9 });
  // train: left to right; gap centres cross x=540 on the hat onsets
  const V = 1500; const gw = 64; const wy0 = hy - 520, wy1 = hy + 70;
  const xAt = (g) => 540 + V * (t - g);
  const body = (x0, x1, loco) => {
    if (x1 < -50 || x0 > 1130) return;
    ctx.fillStyle = loco ? '#020608' : '#03090c'; ctx.fillRect(x0, wy0, x1 - x0, wy1 - wy0);
    ctx.fillStyle = 'rgba(160,200,210,0.07)'; for (let rr = 0; rr < 6; rr++) ctx.fillRect(x0, wy0 + 30 + rr * 92, x1 - x0, 5);        // ribs
    ctx.fillStyle = 'rgba(90,50,30,0.25)'; ctx.fillRect(x0, wy1 - 70, x1 - x0, 70);                                                      // rust band
    ctx.fillStyle = 'rgba(255,170,80,0.35)'; ctx.fillRect(x0, wy0 - 3, x1 - x0, 3);                                                      // roof rim from the crossing light
    ctx.fillStyle = '#010304'; ctx.fillRect(x0 + 40, wy1, 140, 40); ctx.fillRect(x1 - 180, wy1, 140, 40);                                // bogies
  };
  // wagons between consecutive gap centres
  const centres = [38.0, ...gaps, 41.98 + 0.0].map((g) => xAt(g));
  // locomotive first (right-most), then wagons
  const locoX1 = xAt(37.9), locoX0 = locoX1 - 1100; if (t >= 37.37) { body(locoX0, locoX1, true); glow(ctx, locoX1 - 30, wy0 + 330, 330, [255, 220, 160], 0.7); ctx.fillStyle = '#fff2d0'; ctx.beginPath(); ctx.arc(locoX1 - 30, wy0 + 330, 22, 0, TAU); ctx.fill(); flare(ctx, locoX1 - 30, wy0 + 330, 0.5, t); }
  for (let i = 0; i < centres.length - 1; i++) { const x1 = centres[i] - gw / 2, x0 = centres[i + 1] + gw / 2; body(x0, x1, false); }
  // flashing crossing lights + boom (near)
  const on = ONS.filter((o) => o >= 37.37 && o <= t).length % 2; glow(ctx, 160, hy - 440, 200, [255, 30, 20], on ? 0.8 : 0.1); glow(ctx, 330, hy - 440, 200, [255, 30, 20], on ? 0.1 : 0.8);
  ctx.fillStyle = '#010304'; ctx.fillRect(100, hy - 520, 28, 700); ctx.fillStyle = '#c8c8c0'; for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#c8c8c0' : '#1a0c0c'; ctx.fillRect(100 + i * 110, hy + 130, 110, 24); }
  fogBand(ctx, t, hy + 200, 200, 0.2, [90, 150, 160], 12, 6);
}

// 9: wedding lane. festoon lights die one by one behind him, her hem races by in the far layer.
function festoon(ctx, t, y0, dead) {
  for (let s = 0; s < 6; s++) {
    const x0 = s * 220 - 40, x1 = x0 + 260; const lit = cl(1 - (dead - s)) ; const on = dead <= s ? 1 : 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, y0 + 110, x1, y0); ctx.stroke();
    for (let i = 0; i <= 8; i++) { const u = i / 8; const x = lerp(x0, x1, u), y = y0 + 2 * u * (1 - u) * 110; const a = on * (0.7 + 0.3 * Math.sin(t * 9 + i * 2 + s)); if (a > 0.02) { glow(ctx, x, y, 80, i % 3 === 0 ? [255, 60, 50] : [255, 190, 80], 0.6 * a); ctx.fillStyle = `rgba(255,235,190,${a})`; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); } }
  }
}

// 10: the gate. his hand shakes the latch, bangles rattle in sync with the roll.
function shotGate(ctx, t) {
  ctx.fillStyle = gsil(ctx, 0, 1920, '#031014', '#010304'); ctx.fillRect(-10, -10, 1100, 1940);
  // warm light from the courtyard through the bars
  glow(ctx, 540, 900, 760, [255, 160, 70], 0.4 + 0.1 * Math.sin(t * 11));
  for (let i = -1; i < 12; i++) { const x = i * 100 + 20; ctx.fillStyle = '#010304'; ctx.fillRect(x, 0, 24, 1920); ctx.fillStyle = 'rgba(255,170,90,0.35)'; ctx.fillRect(x + 20, 0, 3, 1920); }
  const shake = (t > 50.19 && t < 50.74) ? Math.sin(t * 90) * 12 : Math.sin(t * 5) * 2;
  ctx.fillStyle = '#010304'; ctx.fillRect(0, 860, 1080, 34); ctx.fillRect(0, 1300, 1080, 34);
  // latch + padlock
  ctx.save(); ctx.translate(540 + shake, 1000); ctx.fillStyle = '#020507'; ctx.fillRect(-120, -20, 240, 40); ctx.beginPath(); ctx.arc(60, 90, 70, 0, TAU); ctx.fill(); ctx.fillRect(-10, 70, 140, 130);
  ctx.strokeStyle = 'rgba(255,170,90,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(60, 90, 72, -2.6, -0.8); ctx.stroke(); ctx.restore();
  // his hand: silhouette fingers
  ctx.save(); ctx.translate(300 + shake * 1.5, 1180); ctx.fillStyle = SIL; ctx.beginPath(); ctx.ellipse(0, 0, 90, 55, -0.3, 0, TAU); ctx.fill();
  for (let f = 0; f < 4; f++) { strokeLimb(ctx, [[60, -10 + f * 12], [140 + f * 6, -20 + f * 10 + Math.sin(t * 60 + f) * 6], [200, 20 + f * 10]], 26, SIL); }
  ctx.restore();
  // bangles rattling
  const rr = (t > 50.19 && t < 50.74) ? 1 : 0.15; for (let i = 0; i < 10; i++) { const a = rr * Math.abs(Math.sin(t * 40 + i)); glow(ctx, 760 + Math.sin(i * 2) * 60, 1120 + i * 8, 40, [255, 190, 110], 0.5 * a); }
  // her veil shadow slides over the bars from behind
  const sa = sm(51.0, 52.0, t); if (sa > 0) { ctx.fillStyle = `rgba(0,0,0,${0.6 * sa})`; ctx.beginPath(); ctx.ellipse(540 + (1 - sa) * 500, 1100, 220, 700, 0.1, 0, TAU); ctx.fill(); }
  fogBand(ctx, t, 1300, 200, 0.2, [150, 120, 90], 10, 5);
}

// 11: courtyard and doli. last hit: she lifts the veil; cut to black on the final sample.
function shotDoli(ctx, t) {
  const close = sm(53.45, 53.55, t);
  ctx.fillStyle = gsil(ctx, 0, 1920, '#041216', '#010304'); ctx.fillRect(-10, -10, 1100, 1940);
  glow(ctx, 540, 900, 900, [255, 150, 60], 0.35 * (1 - close * 0.4));
  // mandap pillars + garlands
  for (const x of [120, 960]) { ctx.fillStyle = '#010304'; ctx.fillRect(x - 24, 360, 48, 1100); for (let i = 0; i < 12; i++) { const y = 420 + i * 82; ctx.fillStyle = i % 2 ? 'rgba(220,120,20,0.7)' : 'rgba(200,40,30,0.7)'; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill(); } }
  ctx.strokeStyle = 'rgba(210,100,20,0.8)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(120, 420); ctx.quadraticCurveTo(540, 640, 960, 420); ctx.stroke();
  for (let i = 0; i < 7; i++) { const x = 220 + i * 100; const fl = 0.7 + 0.3 * Math.sin(t * 8 + i * 2); glow(ctx, x, 1320, 120, [255, 150, 50], 0.7 * fl); ctx.fillStyle = `rgba(255,220,150,${fl})`; ctx.beginPath(); ctx.ellipse(x, 1318, 7, 16, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#010304'; ctx.beginPath(); ctx.ellipse(x, 1348, 28, 12, 0, 0, TAU); ctx.fill(); }
  // doli (palanquin), curtains
  const dx = 540, dy = 1260; ctx.fillStyle = '#020508'; ctx.fillRect(dx - 260, dy - 340, 520, 380); ctx.beginPath(); ctx.moveTo(dx - 300, dy - 340); ctx.quadraticCurveTo(dx, dy - 560, dx + 300, dy - 340); ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,80,0.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(dx - 300, dy - 340); ctx.quadraticCurveTo(dx, dy - 560, dx + 300, dy - 340); ctx.stroke();
  const lift = sm(53.55, 54.28, t);
  // she grows into frame on the final hit; the veil edge lifts into black
  const h = lerp(560, 1250, close); const yy = lerp(dy + 30, 1700, close);
  dulhan(ctx, 540, yy, h, t, { alpha: 1, rimA: 1, wind: 0.7, glowRed: 1, lean: 0 });
  if (lift > 0) { ctx.fillStyle = `rgba(0,0,0,${0.95 * lift})`; ctx.beginPath(); ctx.ellipse(540, yy - h * 0.82, 140 * (0.6 + lift), 150 * lift + 10, 0, 0, TAU); ctx.fill(); glow(ctx, 540, yy - h * 0.8, 200, [255, 40, 30], 0.9 * lift); const ey = yy - h * 0.8; for (const ex of [-34, 34]) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 540 + ex, ey, 26, [255, 80, 60], 1.0 * lift); ctx.fillStyle = `rgba(255,170,150,${lift})`; ctx.beginPath(); ctx.ellipse(540 + ex, ey, 6, 4, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = `rgba(190,150,130,${lift})`; ctx.beginPath(); ctx.ellipse(540 + 150 * (0.6 + lift), yy - h * 0.7, 20, 46, 0.5, 0, TAU); ctx.fill(); }
  fogBand(ctx, t, 1350, 220, 0.25, [150, 120, 90], 9, 8);
}


// ---------------------------------------------------------------- intro title (on the vocal onsets) and end card
const FONT = '"Noto Sans Devanagari", "Noto Sans", sans-serif';
function titleText(ctx, str, x, y, size, a, red = 0.9) {
  if (a <= 0.002) return;
  ctx.save(); ctx.globalAlpha = cl(a); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${size}px ${FONT}`;
  ctx.shadowColor = `rgba(255,30,20,${red})`; ctx.shadowBlur = size * 0.5; ctx.fillStyle = 'rgba(255,40,30,0.55)'; ctx.fillText(str, x, y);
  ctx.shadowBlur = size * 0.12; ctx.shadowColor = 'rgba(255,200,140,0.9)'; ctx.fillStyle = '#f6e6d0'; ctx.fillText(str, x, y); ctx.restore();
}
// light value for an element that flares on an onset then settles
const onFlare = (t, on) => { const d = t - on; return d < 0 ? 0 : 0.78 + 0.22 * Math.exp(-d * 9) + 0.5 * Math.exp(-d * 22) * (Math.sin(d * 120) > 0 ? 1 : 0.5); };
function drawIntro(ctx, t) {
  if (t > 5.0) return;
  // anamorphic light streak as the dynamo clicks on at 0.07
  if (t >= 0.07 && t < 0.9) { const k = (t - 0.07) / 0.83; const wd = 1080 * (0.15 + 0.85 * eo(k)); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(540 - wd / 2, 0, 540 + wd / 2, 0); g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(0.5, `rgba(210,235,255,${0.85 * (1 - k)})`); g.addColorStop(1, 'rgba(120,200,255,0)'); ctx.fillStyle = g; ctx.fillRect(540 - wd / 2, 960 - 3, wd, 6 * (1 - k) + 1); ctx.restore(); }
  const out = 1 - sm(4.40, 4.81, t);          // dissolve on the last phrase-A onset
  const f1 = onFlare(t, 0.53) * out, f2 = onFlare(t, 0.86) * out, f3 = onFlare(t, 1.95) * out;
  titleText(ctx, 'साजन', 235, 500, 140, f1);
  titleText(ctx, 'साजन', 705, 500, 140, f2);
  // red thread underline draws on 1.42, bangle glint on 2.30
  const ul = sm(1.42, 2.1, t) * out; if (ul > 0) { ctx.save(); ctx.globalAlpha = ul; ctx.strokeStyle = 'rgba(255,40,30,0.9)'; ctx.lineWidth = 4; ctx.shadowColor = 'rgba(255,40,30,0.9)'; ctx.shadowBlur = 18; ctx.beginPath(); ctx.moveTo(470 - 330 * ul, 592); ctx.lineTo(470 + 330 * ul, 592); ctx.stroke(); ctx.restore(); }
  titleText(ctx, 'एक देसी हॉरर', 470, 662, 60, f3 * 0.9, 0.5);
  // credit line on 3.32
  titleText(ctx, '@doomsday_penguin', 470, 728, 36, onFlare(t, 3.32) * out * 0.7, 0.25);
}
function drawEndCard(ctx, t) {
  if (t < 54.70) return;
  const u = t - 54.70;
  ctx.fillStyle = '#010305'; ctx.fillRect(-10, -10, 1100, 1940);
  glow(ctx, 540, 900, 700, [255, 40, 30], 0.12 + 0.12 * sm(0, 0.8, u));
  // her eyes open in the dark, a slow blink
  const blink = u > 1.5 && u < 1.62 ? 0.15 : 1; const ea = sm(0, 0.12, u) * blink;
  for (const ex of [-46, 46]) { glow(ctx, 540 + ex, 820, 70, [255, 50, 40], 0.9 * ea); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,190,170,${ea})`; ctx.beginPath(); ctx.ellipse(540 + ex, 820, 9, 5, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  titleText(ctx, 'रात को अकेले मत लौटना', 540, 1010, 62, sm(0.8, 1.4, u));
  titleText(ctx, '@doomsday_penguin', 540, 1110, 42, sm(1.4, 2.0, u) * 0.85, 0.3);
  // bangle chime flicker
  fadeOutEnd(ctx, t);
}
function fadeOutEnd(ctx, t) { const k = sm(56.9, 57.3, t); if (k > 0) { ctx.fillStyle = `rgba(0,0,0,${k})`; ctx.fillRect(-10, -10, 1100, 1940); } }

// ---------------------------------------------------------------- shot router
const R = {
  rear: (c, t, pt) => shotLaneRear(c, t, pt),
  side1: (c, t, pt) => shotSide(c, t, pt, { buffalo: true, petals: true, speed: 230, bulbs: 0.9 }),
  cross: (c, t, pt) => shotCrossing(c, t, pt),
  drop: (c, t, pt) => shotDrop(c, t, pt),
  front1: (c, t, pt) => shotTrackFront(c, t, pt, { chaseK: (tt) => cl((tt - 15) / 12), hy: 880, camY: 0.65 }),
  market: (c, t, pt) => shotSide(c, t, pt, { speed: 900, bulbs: 1, chaser: (tt) => ({ x: 120 + 140 * Math.sin(tt * 0.5), y: 1150, h: lerp(330, 460, cl((tt - 19.3) / 7)), a: 1 }) }),
  mirror: (c, t, pt) => shotMirror(c, t, pt),
  front2: (c, t, pt) => shotTrackFront(c, t, pt, { chaseK: (tt) => cl(0.45 + (tt - 31.5) / 12), hy: 820, camY: 0.3, camX: 0.5, speed: 16, cyX: -0.2 }),
  look: (c, t, pt) => shotLookBack(c, t, pt),
  train: (c, t, pt) => shotTrain(c, t),
  wedding: (c, t, pt) => { shotSide(c, t, pt, { speed: 1000, bulbs: 0.5, chaser: (tt) => ({ x: lerp(100, 260, cl((tt - 42) / 8)), y: 1150, h: lerp(330, 500, cl((tt - 42) / 8)), a: 1 }) }); festoon(c, t, 540, Math.max(0, (lastHit(t) - lastHit(41.98)) / 1.6)); },
  gate: (c, t) => shotGate(c, t),
  doli: (c, t) => shotDoli(c, t),
  endcard: () => {}
};
export const SHOTS = [[0, 5.44, 'rear'], [5.44, 11.52, 'side1'], [11.52, 14.79, 'cross'], [14.79, 14.86, null], [14.86, 16.37, 'drop'], [16.37, 19.26, 'front1'], [19.26, 26.0, 'market'], [26.0, 31.5, 'mirror'], [31.5, 36.83, 'front2'], [36.83, 37.37, 'look'], [37.37, 41.98, 'train'], [41.98, 50.19, 'wedding'], [50.19, 52.03, 'gate'], [52.03, 54.3, 'doli'], [54.3, 57.4, 'endcard']];
function shotAt(t) { for (const s of SHOTS) if (t >= s[0] && t < s[1]) return s; return SHOTS[SHOTS.length - 1]; }

// ---------------------------------------------------------------- post
const _b = new Map();
function buf(w, h, key) { const k = `${w}x${h}:${key}`; if (!_b.has(k)) _b.set(k, createCanvas(w, h)); return _b.get(k); }
function bloom(ctx, w, h, amt) {
  const sw = Math.round(w / 4), sh = Math.round(h / 4); const b = buf(sw, sh, 'bloom'); const bc = b.getContext('2d');
  bc.globalCompositeOperation = 'copy'; bc.filter = 'brightness(0.9) contrast(2.4) blur(7px)'; bc.drawImage(ctx.canvas, 0, 0, sw, sh); bc.filter = 'none';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = amt; ctx.drawImage(b, 0, 0, w, h); ctx.restore();
}
function chroma(ctx, w, h, px) {
  if (px < 0.4) return; const src = buf(w, h, 'cs'); const sc = src.getContext('2d'); sc.globalCompositeOperation = 'copy'; sc.drawImage(ctx.canvas, 0, 0);
  const ch = (col, key) => { const c = buf(w, h, key), x = c.getContext('2d'); x.globalCompositeOperation = 'copy'; x.drawImage(src, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, w, h); return c; };
  const Rr = ch('#ff0000', 'cr'), Gg = ch('#00ff00', 'cg'), Bb = ch('#0000ff', 'cb');
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Rr, px, 0); ctx.drawImage(Gg, 0, 0); ctx.drawImage(Bb, -px, px * 0.3); ctx.restore();
}

export const VideoClock = {
  setTime(sec) { this.t = sec; },
  t: 0,
  draw(ctx, w, h, timeline) {
    const t = this.t; const s = w / 1080; const pt = pictureTime(t);
    const shot = shotAt(t);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#010305'; ctx.fillRect(0, 0, w, h);
    ctx.scale(s, s);
    // camera shake on hits + whip blur at cuts
    const hp = pulse(t, 11) * (t > 2.8 ? 1 : 0);
    const sh = (shot[2] === 'mirror' || shot[2] === 'gate' ? 6 : 3) * hp;
    ctx.save(); ctx.translate(Math.sin(t * 91) * sh, Math.cos(t * 77) * sh);
    const dutch = (shot[2] === 'drop' ? -0.05 : shot[2] === 'front2' ? 0.07 : shot[2] === 'look' ? 0.12 * (1 - sm(36.83, 37.37, t)) : shot[2] === 'market' ? 0.025 : 0.0);
    ctx.translate(540, 960); ctx.rotate(dutch + Math.sin(t * 0.5) * 0.004); { const pz = (shot[2] === 'train' ? 0.07 * sm(41.2, 41.98, t) : 0); ctx.scale(1 + 0.04 * hp + pz, 1 + 0.04 * hp + pz); } ctx.translate(-540, -960);
    if (shot[2]) R[shot[2]](ctx, t, pt);
    ctx.restore();
    ctx.restore();
    // post chain at pixel scale
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    // whip blur at shot starts
    for (const sa of SHOTS) { const d = t - sa[0]; if (sa[2] && d >= 0 && d < 0.12 && sa[0] > 0) { const k = 1 - d / 0.12; const b = buf(w, h, 'wb'); const bc = b.getContext('2d'); bc.globalCompositeOperation = 'copy'; bc.drawImage(ctx.canvas, 0, 0); ctx.globalAlpha = 0.5 * k; for (let i = -3; i <= 3; i++) if (i) ctx.drawImage(b, i * 30 * k * s, 0); ctx.globalAlpha = 1; } }
    bloom(ctx, w, h, 0.55 + 0.4 * hp);
    // teal-orange grade
    ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(25,95,105,0.28)'; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(214,226,232)'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over';
    chroma(ctx, w, h, (1.2 + 6 * hp + (t >= 36.83 && t < 37.37 ? 10 : 0)) * s);
    ctx.save(); ctx.scale(s, s); drawIntro(ctx, t); drawEndCard(ctx, t); ctx.restore();
    drawVignette(ctx, w, h, 0.78); drawGrain(ctx, w, h, t, 1.15, 15);
    // gate weave / scratches
    const r = mulberry32(Math.floor(t * 12) + 3); if (r() > 0.88) { ctx.fillStyle = 'rgba(220,235,240,0.08)'; ctx.fillRect(r() * w, 0, 1.2 * s, h); }
    // anamorphic bars (picture band), lit edge
    const bh = bandH(t); const bar = (h - bh) / 2;
    if (bar > 1) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, bar * s * (h / (1920 * s))); ctx.fillRect(0, h - bar * s * (h / (1920 * s)), w, bar * s * (h / (1920 * s))); }
    // hard black frame at the very end and in the pre-drop gap
    if ((t >= 54.30 && t < 54.70) || t >= 57.3 || (t >= 14.79 && t < 14.86)) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); }
    ctx.restore();
  }
};
