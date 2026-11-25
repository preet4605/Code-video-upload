// scene3d: a small "3D-ish" kit for horror scenes on a 2D canvas. Pure functions of their inputs (and t):
// no Math.random, no Date.now, no visual state carried across frames. (Offscreen buffers for the CA pass are
// cached per size; they hold no state between frames.)
//
// World: x right, y up, z forward (metres-ish). A room is a handful of lit quads drawn far-to-near.
//   const cam = makeCamera({ pos:[0,1.2,-2], yaw:0, pitch:-0.05, fov:62, width, height });
//   drawQuad(ctx, cam, [p0,p1,p2,p3], { base:'#3a3f4a', lights, ambient, fog });
// Lights: { type:'point'|'cone', pos:[x,y,z], color:[r,g,b] 0..1, intensity, range, dir:[x,y,z], inner, outer }
// (inner/outer are cone half-angles in radians). Lighting is per subdivided cell with Reinhard tone mapping.
import { createCanvas } from '@napi-rs/canvas';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const normz = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const v3 = { sub, add: add3, mul: mul3, dot, cross, len, norm: normz };

export function hexToLin(hex) {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return c.map((v) => Math.pow(v, 2.2));
}
const toSrgb = (v) => Math.round(255 * Math.pow(clamp01(v), 1 / 2.2));

// Deterministic handheld noise: sum of incommensurate sines (no RNG).
export function handheld(t, amp = 1, seed = 0) {
  const s = seed * 1.7;
  const n = (f, p) => Math.sin(t * f + p + s) * 0.6 + Math.sin(t * f * 2.31 + p * 1.7 + s) * 0.3 + Math.sin(t * f * 5.13 + p * 0.3) * 0.1;
  return { yaw: n(0.9, 0.2) * 0.010 * amp, pitch: n(1.13, 1.4) * 0.007 * amp, roll: n(0.71, 2.2) * 0.006 * amp, pos: [n(0.5, 3.1) * 0.012 * amp, n(0.63, 0.7) * 0.01 * amp, 0] };
}

export function makeCamera({ pos = [0, 1.2, -2], yaw = 0, pitch = 0, roll = 0, fov = 60, width = 1080, height = 1920, shake = null } = {}) {
  let p = pos, yw = yaw, pt = pitch, rl = roll;
  if (shake) { p = add3(pos, shake.pos); yw += shake.yaw; pt += shake.pitch; rl += shake.roll; }
  const cy = Math.cos(yw), sy = Math.sin(yw), cp = Math.cos(pt), sp = Math.sin(pt);
  const fwd = [sy * cp, sp, cy * cp];
  let right = normz(cross([0, 1, 0], fwd));
  let up = cross(fwd, right);
  const cr = Math.cos(rl), sr = Math.sin(rl);
  const r2 = add3(mul3(right, cr), mul3(up, sr));
  const u2 = add3(mul3(up, cr), mul3(right, -sr));
  right = r2; up = u2;
  const f = (height / 2) / Math.tan((fov * Math.PI / 180) / 2);
  return {
    pos: p, fwd, right, up, f, width, height,
    toCam(w) { const d = sub(w, p); return [dot(d, right), dot(d, up), dot(d, fwd)]; },
    project(w) {
      const c = this.toCam(w);
      return { x: width / 2 + (f * c[0]) / c[2], y: height / 2 - (f * c[1]) / c[2], z: c[2], ok: c[2] > 0.05 };
    }
  };
}

// Light reaching a surface point with normal n. Returns linear RGB (before base colour).
export function lightAt(pt, n, lights = [], ambient = [0.02, 0.02, 0.03]) {
  const out = [ambient[0], ambient[1], ambient[2]];
  for (const L of lights) {
    if (!L || !(L.intensity > 0)) continue;
    const d = sub(L.pos, pt);
    const dist = len(d) || 1e-3;
    const l = mul3(d, 1 / dist);
    const ndl = Math.max(0, dot(n, l)) * (L.wrap ? 0.5 + 0.5 * dot(n, l) : 1);
    if (ndl <= 0 && !L.wrap) continue;
    let k = L.intensity * ndl / (1 + (dist * dist) / ((L.range || 3) * (L.range || 3)));
    if (L.type === 'cone') {
      const cosA = dot(mul3(l, -1), normz(L.dir));
      const ci = Math.cos(L.inner ?? 0.3), co = Math.cos(L.outer ?? 0.5);
      k *= smooth((cosA - co) / Math.max(1e-4, ci - co));
    }
    if (L.box) { // optional axis-aligned light box (e.g. light leaking under a door only reaches the floor near it)
      const [mn, mx] = L.box;
      if (pt[0] < mn[0] || pt[0] > mx[0] || pt[1] < mn[1] || pt[1] > mx[1] || pt[2] < mn[2] || pt[2] > mx[2]) k = 0;
    }
    out[0] += L.color[0] * k; out[1] += L.color[1] * k; out[2] += L.color[2] * k;
  }
  return out;
}

export function shade(baseLin, light, { exposure = 1.6, fog = null, depth = 0, emissive = null } = {}) {
  let c = [baseLin[0] * light[0], baseLin[1] * light[1], baseLin[2] * light[2]];
  if (emissive) c = add3(c, emissive);
  c = c.map((v) => { const e = v * exposure; return e / (1 + e); });
  if (fog) {
    const f = 1 - Math.exp(-Math.max(0, depth - (fog.start || 0)) * (fog.density || 0.15));
    const fc = fog.colorLin || [0.01, 0.012, 0.02];
    c = c.map((v, i) => lerp(v, fc[i], clamp01(f)));
  }
  return `rgb(${toSrgb(c[0])},${toSrgb(c[1])},${toSrgb(c[2])})`;
}

// Lit quad, subdivided into nx*ny cells (each shaded at its centre). Corners in order p0->p1->p2->p3.
export function drawQuad(ctx, cam, corners, { base = '#444', baseLin = null, lights = [], ambient, fog = null, nx = 8, ny = 8, exposure = 1.6, emissive = null, normal = null, cull = true, texture = null } = {}) {
  const [p0, p1, p2, p3] = corners;
  const n = normal || normz(cross(sub(p1, p0), sub(p3, p0)));
  const centre = mul3(add3(add3(p0, p1), add3(p2, p3)), 0.25);
  if (cull && dot(n, sub(cam.pos, centre)) <= 0) return 0;
  const bl = baseLin || hexToLin(base);
  const at = (u, v) => add3(add3(mul3(p0, (1 - u) * (1 - v)), mul3(p1, u * (1 - v))), add3(mul3(p2, u * v), mul3(p3, (1 - u) * v)));
  let drawn = 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const u0 = i / nx, u1 = (i + 1) / nx, v0 = j / ny, v1 = (j + 1) / ny;
      const w = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
      const pr = w.map((q) => cam.project(q));
      if (pr.some((q) => !q.ok)) continue;
      const c = at((u0 + u1) / 2, (v0 + v1) / 2);
      let bcol = bl;
      if (texture) { const k = texture((u0 + u1) / 2, (v0 + v1) / 2); bcol = [bl[0] * k, bl[1] * k, bl[2] * k]; }
      ctx.fillStyle = shade(bcol, lightAt(c, n, lights, ambient), { exposure, fog, depth: cam.toCam(c)[2], emissive });
      ctx.beginPath();
      ctx.moveTo(pr[0].x, pr[0].y);
      for (let k = 1; k < 4; k++) ctx.lineTo(pr[k].x, pr[k].y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1; ctx.stroke(); // hide seams between cells
      drawn++;
    }
  }
  return drawn;
}

// Axis-aligned box; faces culled against the camera. Draws the far faces first.
export function drawBox(ctx, cam, min, max, opts = {}) {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const faces = [
    [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]].reverse(), // top (normal +y)
    [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]].reverse(), // front (-z)
    [[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]].reverse(), // back (+z)
    [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]].reverse(), // left (-x)
    [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]].reverse() // right (+x)
  ];
  const c = (f) => mul3(f.reduce((a, b) => add3(a, b), [0, 0, 0]), 0.25);
  faces.sort((a, b) => len(sub(c(b), cam.pos)) - len(sub(c(a), cam.pos)));
  let d = 0;
  for (const f of faces) d += drawQuad(ctx, cam, f, { nx: 4, ny: 4, ...opts, ...(opts.faceOpts ? opts.faceOpts : {}) });
  return d;
}

// Volumetric light cone (screen-space, additive). Pass alpha ~0.05-0.2.
export function drawVolumeCone(ctx, cam, { apex, dir, length = 3, radius = 1, color = [180, 200, 255], alpha = 0.12, steps = 10 } = {}) {
  const d = normz(dir);
  const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const a = normz(cross(d, ref)), b = cross(d, a);
  const ap = cam.project(apex);
  if (!ap.ok) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let s = steps; s >= 1; s--) {
    const k = s / steps;
    const centre = add3(apex, mul3(d, length * k));
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const th = (i / 16) * Math.PI * 2;
      pts.push(cam.project(add3(centre, add3(mul3(a, Math.cos(th) * radius * k), mul3(b, Math.sin(th) * radius * k)))));
    }
    if (pts.some((q) => !q.ok)) continue;
    ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${(alpha / steps) * (1.2 - k)})`;
    ctx.beginPath();
    ctx.moveTo(ap.x, ap.y);
    for (const q of pts) ctx.lineTo(q.x, q.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Dust motes inside a world box; brightness from the lights (bright only where a light reaches them).
export function drawDust(ctx, cam, { min, max, count = 60, seed = 7, t = 0, lights = [], size = 3, drift = 0.04 } = {}) {
  const r = mulberry32(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const bx = r(), by = r(), bz = r(), ph = r() * 6.28;
    const p = [
      lerp(min[0], max[0], (bx + Math.sin(t * 0.21 + ph) * drift + 1) % 1),
      lerp(min[1], max[1], (by - ((t * 0.012 + ph) % 1) + 1) % 1),
      lerp(min[2], max[2], (bz + Math.cos(t * 0.17 + ph) * drift + 1) % 1)
    ];
    const q = cam.project(p);
    if (!q.ok) continue;
    const L = lightAt(p, normz(sub(cam.pos, p)), lights, [0, 0, 0]);
    const lum = Math.min(1, (L[0] + L[1] + L[2]) * 0.6);
    if (lum < 0.02) continue;
    const sz = Math.max(1, (size * cam.f) / (q.z * 900));
    ctx.fillStyle = `rgba(${Math.round(200 + 55 * L[0])},${Math.round(200 + 55 * L[1])},${Math.round(210 + 45 * L[2])},${0.65 * lum})`;
    ctx.beginPath(); ctx.arc(q.x, q.y, sz, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// Screen-space fog banks: soft horizontal bands that drift. y and height in pixels.
export function drawFogBanks(ctx, width, height, { t = 0, y = height * 0.7, h = height * 0.25, alpha = 0.12, color = [150, 165, 190], layers = 3, speed = 12 } = {}) {
  ctx.save();
  for (let l = 0; l < layers; l++) {
    const off = ((t * speed * (1 + l * 0.6)) % width);
    for (let k = -1; k <= 1; k++) {
      const cx = off + k * width + l * width * 0.33;
      const g = ctx.createRadialGradient(cx, y + l * h * 0.15, 0, cx, y + l * h * 0.15, width * 0.6);
      g.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${alpha / layers})`);
      g.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(cx - width * 0.6, y - h, width * 1.2, h * 2.2);
    }
  }
  ctx.restore();
}

export function drawVignette(ctx, w, h, strength = 0.85) {
  const g = ctx.createRadialGradient(w / 2, h * 0.46, w * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.6, `rgba(0,0,0,${(strength * 0.35).toFixed(3)})`);
  g.addColorStop(1, `rgba(0,0,0,${strength.toFixed(3)})`);
  ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
}

export function drawGrain(ctx, w, h, t, amp = 1, fps = 14) {
  const r = mulberry32(Math.floor(t * fps) * 7919 + 13);
  const s = w / 1080;
  ctx.save();
  for (let i = 0; i < 700; i++) {
    const a = (0.025 + r() * 0.05) * amp;
    ctx.fillStyle = r() > 0.5 ? `rgba(220,228,245,${a})` : `rgba(0,0,0,${a * 1.8})`;
    ctx.fillRect(r() * w, r() * h, (1.5 + r() * 2) * s, (1.5 + r() * 2) * s);
  }
  ctx.restore();
}

// Soften the lit-cell geometry (hides per-cell shading steps). Call right after the room, before overlays.
export function softenLayer(ctx, w, h, px = 4) {
  if (!(px > 0.3)) return;
  const src = buf(w, h, 'soft');
  const sctx = src.getContext('2d');
  sctx.globalCompositeOperation = 'copy';
  sctx.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = `blur(${px.toFixed(1)}px)`;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(src, 0, 0);
  ctx.restore();
}

// Chromatic aberration spike: split R and B by `px` pixels. Use only on hits (a few frames).
const _buf = new Map();
function buf(w, h, k) {
  const key = `${w}x${h}:${k}`;
  if (!_buf.has(key)) _buf.set(key, createCanvas(w, h));
  return _buf.get(key);
}
export function chromaticAberration(ctx, w, h, px = 6) {
  if (!(px > 0.25)) return;
  const src = buf(w, h, 'src');
  const sctx = src.getContext('2d');
  sctx.globalCompositeOperation = 'copy';
  sctx.drawImage(ctx.canvas, 0, 0);
  const chan = (col, key) => {
    const c = buf(w, h, key), x = c.getContext('2d');
    x.globalCompositeOperation = 'copy'; x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, w, h);
    return c;
  };
  const R = chan('#ff0000', 'r'), G = chan('#00ff00', 'g'), B = chan('#0000ff', 'b');
  ctx.save();
  ctx.globalCompositeOperation = 'copy';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(R, px, 0);
  ctx.drawImage(G, 0, 0);
  ctx.drawImage(B, -px, px * 0.3);
  ctx.restore();
}

// Hit envelope for CA/shake: 1 at the hit, decays over ~0.35 s.
export function hitPulse(t, hits = [], decay = 9) {
  let v = 0;
  for (const h of hits) { const d = t - h; if (d >= -0.03 && d < 0.8) v = Math.max(v, Math.exp(-Math.max(0, d) * decay)); }
  return v;
}

// Close-up: a sleeper under a blanket seen from behind (head, hair, shoulder), rim-lit. Coords in px.
export function drawSleeperFromBehind(ctx, { x, y, scale = 1, t = 0, breath = 1, rim = [150, 180, 240], rimAlpha = 0.6, blanket = '#1a2233', hair = '#07080b' } = {}) {
  const s = scale, b = Math.sin(t * 1.4) * 5 * s * breath;
  ctx.save();
  ctx.fillStyle = blanket;
  ctx.beginPath();
  ctx.moveTo(x - 330 * s, y + 220 * s);
  ctx.bezierCurveTo(x - 320 * s, y - 40 * s - b, x + 40 * s, y - 120 * s - b, x + 360 * s, y - 30 * s);
  ctx.lineTo(x + 380 * s, y + 220 * s);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 5 * s;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 200 * s + i * 120 * s, y + 200 * s); ctx.quadraticCurveTo(x - 160 * s + i * 110 * s, y - 20 * s - b, x - 60 * s + i * 120 * s, y - 70 * s - b); ctx.stroke(); }
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.ellipse(x + 170 * s, y - 120 * s - b, 120 * s, 105 * s, -0.25, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 60 * s, y - 120 * s - b); ctx.quadraticCurveTo(x + 30 * s, y - 10 * s - b, x + 110 * s, y + 30 * s - b); ctx.quadraticCurveTo(x + 220 * s, y - 10 * s - b, x + 285 * s, y - 100 * s - b); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = `rgba(${rim[0]},${rim[1]},${rim[2]},${rimAlpha})`; ctx.lineWidth = 6 * s;
  ctx.beginPath(); ctx.ellipse(x + 170 * s, y - 120 * s - b, 121 * s, 106 * s, -0.25, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 320 * s, y + 200 * s); ctx.bezierCurveTo(x - 310 * s, y - 30 * s - b, x + 40 * s, y - 110 * s - b, x + 60 * s, y - 112 * s - b); ctx.stroke();
  ctx.restore();
}

// Soft-edged ghost face with a hard side shadow, half-hidden under a blanket edge. Withholding: keep alpha low,
// show it for < 2 s. No clean outlines: everything is soft gradients so it reads as a face in the dark, not a mask.
export function drawGhostFace(ctx, { x, y, scale = 1, alpha = 0.8, t = 0, side = -1, mouthOpen = 0, cover = 0.35, blanket = '#1b2231' } = {}) {
  const s = scale;
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x + side * 18 * s, y - 20 * s, 6 * s, x, y, 175 * s);
  g.addColorStop(0, 'rgba(178,186,192,0.9)');
  g.addColorStop(0.45, 'rgba(112,120,128,0.62)');
  g.addColorStop(0.8, 'rgba(40,44,50,0.25)');
  g.addColorStop(1, 'rgba(10,12,14,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, 150 * s, 195 * s, 0.06 * side, 0, Math.PI * 2); ctx.fill();
  // eye sockets: soft radial dark pools, slightly asymmetric
  for (const [ex, ey, r] of [[-46, -34, 34], [50, -28, 30]]) {
    const eg = ctx.createRadialGradient(x + ex * s, y + ey * s, 2 * s, x + ex * s, y + ey * s, r * s);
    eg.addColorStop(0, 'rgba(0,0,0,0.98)'); eg.addColorStop(0.6, 'rgba(0,0,0,0.8)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(x + ex * s, y + ey * s, r * s, 0, Math.PI * 2); ctx.fill();
  }
  // tiny eye glints that drift (the only "alive" detail)
  ctx.fillStyle = 'rgba(220,225,230,0.55)';
  ctx.beginPath(); ctx.arc(x - 42 * s + Math.sin(t * 0.9) * 2 * s, y - 36 * s, 2.6 * s, 0, Math.PI * 2); ctx.fill();
  // mouth: soft dark slit that opens
  const mg = ctx.createRadialGradient(x + 4 * s, y + 80 * s, 1, x + 4 * s, y + 80 * s, (16 + 26 * mouthOpen) * s);
  mg.addColorStop(0, 'rgba(0,0,0,0.95)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(x + 4 * s, y + 80 * s, 26 * s, (8 + 30 * mouthOpen) * s, 0, 0, Math.PI * 2); ctx.fill();
  // side shadow: half the face falls into black
  const sh = ctx.createLinearGradient(x + side * 20 * s, y, x - side * 160 * s, y);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.5, 'rgba(0,0,0,0.7)'); sh.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(x, y, 160 * s, 205 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // blanket edge over the lower face
  if (cover > 0) {
    ctx.save();
    ctx.fillStyle = blanket;
    const cy = y + (195 - 390 * cover) * s;
    ctx.beginPath(); ctx.moveTo(x - 420 * s, y + 460 * s);
    ctx.bezierCurveTo(x - 400 * s, cy + 60 * s, x - 150 * s, cy - 40 * s + Math.sin(t * 1.3) * 3 * s, x + 20 * s, cy - 10 * s);
    ctx.bezierCurveTo(x + 200 * s, cy + 10 * s, x + 380 * s, cy + 120 * s, x + 420 * s, y + 460 * s);
    ctx.lineTo(x + 420 * s, y + 4000 * s); ctx.lineTo(x - 420 * s, y + 4000 * s);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(150,175,225,0.28)'; ctx.lineWidth = 5 * s;
    ctx.beginPath(); ctx.moveTo(x - 400 * s, cy + 140 * s); ctx.bezierCurveTo(x - 300 * s, cy + 10 * s, x - 150 * s, cy - 36 * s, x + 20 * s, cy - 8 * s); ctx.stroke();
    ctx.restore();
  }
}

// Upright silhouette (person) at a projected position. h = height in px.
export function drawSilhouette(ctx, { x, y, h = 600, rim = null, rimAlpha = 0.5, fill = '#020304', sway = 0 } = {}) {
  const w = h * 0.28;
  ctx.save();
  ctx.translate(x + sway, y);
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.ellipse(0, -h + w * 0.42, w * 0.32, w * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, -h + w * 0.95); ctx.quadraticCurveTo(-w * 0.62, -h * 0.5, -w * 0.38, 0);
  ctx.lineTo(w * 0.38, 0); ctx.quadraticCurveTo(w * 0.62, -h * 0.5, w * 0.5, -h + w * 0.95); ctx.closePath(); ctx.fill();
  if (rim) {
    ctx.strokeStyle = `rgba(${rim[0]},${rim[1]},${rim[2]},${rimAlpha})`; ctx.lineWidth = Math.max(2, h * 0.008);
    ctx.beginPath(); ctx.moveTo(-w * 0.5, -h + w * 0.95); ctx.quadraticCurveTo(-w * 0.62, -h * 0.5, -w * 0.38, 0); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -h + w * 0.42, w * 0.33, w * 0.41, 0, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
  }
  ctx.restore();
}
