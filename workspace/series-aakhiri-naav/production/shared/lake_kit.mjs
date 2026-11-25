// आख़िरी नाव — shared lake world kit (deterministic: everything derives from t). Canvas 2D + scene3d camera/projection.
import { makeCamera, handheld, drawVignette, drawGrain, hitPulse, smooth, clamp01, lerp, chromaticAberration } from '/mnt/project-files/skills/code-video-studio-v6.1/lib/scene3d.mjs';
export { makeCamera, handheld, drawVignette, drawGrain, hitPulse, smooth, clamp01, lerp, chromaticAberration };

export const TAU = Math.PI * 2;
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const rgba = (r, g, b, a) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
export const mix = (a, b, k) => a.map((v, i) => lerp(v, b[i], clamp01(k)));

export function horizonY(cam) {
  const p = Math.asin(Math.max(-1, Math.min(1, cam.fwd[1])));
  return cam.height / 2 + cam.f * Math.tan(p);
}
const yawOf = (cam) => Math.atan2(cam.fwd[0], cam.fwd[2]);
const azX = (cam, az) => { const d = ((az - yawOf(cam) + Math.PI * 3) % TAU) - Math.PI; return Math.abs(d) < 1.35 ? cam.width / 2 + cam.f * Math.tan(d) : null; };

// ---------------------------------------------------------------- sky, moon, ridge
export function paintSky(ctx, cam, t, { dusk = 0, moonAz = 0.42, moonEl = 0.42, moonDim = 1 } = {}) {
  const w = cam.width, h = cam.height, hy = horizonY(cam), s = w / 1080;
  const top = hy - cam.f * 1.1;
  const g = ctx.createLinearGradient(0, top, 0, hy);
  g.addColorStop(0, '#02040a'); g.addColorStop(0.55, '#07101f'); g.addColorStop(0.9, rgba(...mix([20, 32, 56], [58, 52, 74], dusk), 1)); g.addColorStop(1, rgba(...mix([32, 44, 72], [120, 70, 46], dusk), 1));
  ctx.fillStyle = g; ctx.fillRect(0, Math.min(0, top), w, hy - Math.min(0, top) + 4);
  // last orange sliver (ep1's sunset side, to the right)
  if (dusk > 0.02) {
    const x = azX(cam, 1.0);
    if (x !== null) {
      const r = ctx.createRadialGradient(x, hy, 0, x, hy, 520 * s);
      r.addColorStop(0, rgba(255, 140, 60, 0.55 * dusk)); r.addColorStop(0.35, rgba(190, 80, 50, 0.22 * dusk)); r.addColorStop(1, rgba(120, 40, 40, 0));
      ctx.fillStyle = r; ctx.fillRect(x - 540 * s, hy - 420 * s, 1080 * s, 440 * s);
    }
  }
  // stars
  for (let i = 0; i < 380; i++) {
    const az = (hash(i) * 2 - 1) * Math.PI, el = 0.06 + hash(i + 400) * 1.15;
    const x = azX(cam, az); if (x === null) continue;
    const y = hy - cam.f * Math.tan(el) / Math.max(0.3, Math.cos(az - yawOf(cam)));
    if (y > hy - 6 || y < -20) continue;
    const a = (0.45 + 0.55 * hash(i + 900)) * (0.7 + 0.3 * Math.sin(t * (0.6 + hash(i + 7)) + i)) * (1 - 0.85 * dusk);
    const sz = (1.4 + 2.2 * hash(i + 55) * hash(i + 56)) * s; ctx.fillStyle = rgba(225, 235, 255, a); ctx.fillRect(x, y, sz, sz);
    if (hash(i + 77) > 0.93) { ctx.fillRect(x - 3 * s, y + sz / 2 - 0.5 * s, 7 * s + sz, s); ctx.fillRect(x + sz / 2 - 0.5 * s, y - 3 * s, s, 7 * s + sz); }
  }
  // crisp cloud streaks
  for (let k = 0; k < 7; k++) { const az0 = -1.2 + hash(k + 500) * 2.4, cx = azX(cam, az0); if (cx === null) continue; const cy = hy - cam.f * (0.12 + 0.55 * hash(k + 520)), len = (180 + 260 * hash(k + 540)) * s, dr = Math.sin(t * 0.03 + k) * 40 * s; ctx.strokeStyle = rgba(120, 140, 185, 0.22); ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(cx - len / 2 + dr, cy); ctx.quadraticCurveTo(cx + dr, cy - 10 * s, cx + len / 2 + dr, cy + 2 * s); ctx.stroke(); ctx.strokeStyle = rgba(8, 14, 28, 0.55); ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(cx - len / 2 + dr, cy + 5 * s); ctx.quadraticCurveTo(cx + dr, cy - 4 * s, cx + len / 2 + dr, cy + 7 * s); ctx.stroke(); }
  // moon behind thin cloud
  const mx = azX(cam, moonAz);
  if (mx !== null && moonDim > 0.01) {
    const my = hy - cam.f * Math.tan(moonEl) / Math.max(0.3, Math.cos(moonAz - yawOf(cam)));
    const hal = ctx.createRadialGradient(mx, my, 0, mx, my, 330 * s);
    hal.addColorStop(0, rgba(150, 175, 225, 0.38 * moonDim)); hal.addColorStop(0.2, rgba(90, 115, 170, 0.14 * moonDim)); hal.addColorStop(1, rgba(60, 80, 130, 0));
    ctx.fillStyle = hal; ctx.fillRect(mx - 340 * s, my - 340 * s, 680 * s, 680 * s);
    ctx.fillStyle = rgba(214, 224, 242, 0.88 * moonDim); ctx.beginPath(); ctx.arc(mx, my, 34 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(150, 165, 195, 0.35 * moonDim); ctx.beginPath(); ctx.arc(mx + 9 * s, my - 6 * s, 9 * s, 0, TAU); ctx.fill();
    for (let k = 0; k < 3; k++) { // wisps drifting across
      const wx = mx + Math.sin(t * 0.05 + k * 2) * 120 * s, wy = my + (k - 1) * 22 * s;
      const gg = ctx.createLinearGradient(wx - 260 * s, 0, wx + 260 * s, 0); gg.addColorStop(0, 'rgba(8,14,28,0)'); gg.addColorStop(0.5, 'rgba(8,14,28,0.55)'); gg.addColorStop(1, 'rgba(8,14,28,0)');
      ctx.fillStyle = gg; ctx.fillRect(wx - 260 * s, wy - 5 * s, 520 * s, 10 * s);
    }
  }
  return { hy };
}
const ridgeEl = (az) => 0.4 * (0.03 + 0.05 * Math.sin(az * 2.1 + 1) + 0.025 * Math.sin(az * 5.3 + 2)) + 0.05 * Math.exp(-(((az - 1.15) / 0.55) ** 2)) + 0.012 * Math.sin(az * 17 + 1) * Math.exp(-(((az - 1.15) / 0.9) ** 2)) + 0.02 * Math.exp(-(((az + 1.9) / 0.5) ** 2)) + 0.004 * Math.sin(az * 70) + 0.003 * Math.sin(az * 130 + 1);
export function paintRidge(ctx, cam, { alpha = 1, lights = true, t = 0, rimA = 0.45 } = {}) {
  const w = cam.width, hy = horizonY(cam), s = w / 1080, yaw = yawOf(cam);
  ctx.beginPath(); ctx.moveTo(-2, hy + 4);
  for (let x = -2; x <= w + 12; x += 12) {
    const az = yaw + Math.atan((x - w / 2) / cam.f);
    ctx.lineTo(x, hy - cam.f * ridgeEl(az) / Math.max(0.4, Math.cos(az - yaw)));
  }
  ctx.lineTo(w + 12, hy + 4); ctx.closePath();
  const g = ctx.createLinearGradient(0, hy - 0.2 * cam.f, 0, hy + 4); g.addColorStop(0, rgba(2, 4, 9, alpha)); g.addColorStop(1, rgba(10, 16, 28, alpha));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = rgba(150, 178, 230, rimA); ctx.lineWidth = Math.max(1.5, (1 + 3 * rimA) * s); ctx.beginPath();
  for (let x = -2; x <= w + 12; x += 12) { const az = yaw + Math.atan((x - w / 2) / cam.f), y = hy - cam.f * ridgeEl(az) / Math.max(0.4, Math.cos(az - yaw)); x === -2 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
  if (lights) for (let i = 0; i < 9; i++) { // far shore lamps
    const az = -1.2 + hash(i + 3) * 1.6, x = azX(cam, az); if (x === null) continue;
    const y = hy - cam.f * (ridgeEl(az) * 0.5) - 2 * s; if (hash(i + 30) < 0.25 && Math.sin(t * 2 + i) > 0.6) continue;
    ctx.fillStyle = rgba(255, 200, 120, 0.9); ctx.fillRect(x, y, 4 * s, 4 * s);
  }
}

// ---------------------------------------------------------------- water
export function paintWater(ctx, cam, t, { moonAz = 0.42, bright = 1, dusk = 0 } = {}) {
  const w = cam.width, h = cam.height, hy = horizonY(cam), s = w / 1080, hc = Math.max(0.2, cam.pos[1]);
  if (hy >= h) return;
  const y0 = Math.max(0, hy);
  const g = ctx.createLinearGradient(0, y0, 0, h);
  g.addColorStop(0, rgba(...mix([26, 38, 64], [88, 62, 60], dusk * 0.8), 1)); g.addColorStop(0.1, 'rgb(9,15,28)'); g.addColorStop(0.5, 'rgb(4,8,15)'); g.addColorStop(1, 'rgb(2,4,8)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, w, h - y0);
  const mx = azX(cam, moonAz);
  const step = Math.max(3, 5 * s);
  for (let y = Math.max(hy + 2, 0), row = 0; y < h; y += step, row++) {
    const dy = Math.max(0.0015, (y - hy) / cam.f), D = hc / dy; // distance along the water
    const n = Math.min(26, 6 + Math.floor(D * 0.35));
    const len = Math.min(190 * s, (26 + 0.9 * D) * s * 1.1) * 0.8;
    for (let i = 0; i < n; i++) {
      const hx = hash(row * 31 + i * 7 + 1), drift = Math.sin(t * 0.5 * (0.5 + hash(i + row)) + hx * 20) * 6 * s;
      const x = hx * (w + 200 * s) - 100 * s + drift;
      let a = 0.1 + 0.2 * hash(row * 5 + i);
      if (mx !== null) a += 0.6 * Math.exp(-(((x - mx) / (95 * s * (1 + 3 / D))) ** 2)) * (0.5 + 0.5 * Math.sin(t * 1.6 + i * 1.7 + row));
      a *= bright * Math.min(1, 0.4 + 6 / D) * 0.9;
      ctx.fillStyle = rgba(150, 180, 230, a); ctx.fillRect(x, y, len * (0.35 + hash(i + 77)), Math.max(1.5, 2.4 * s));
    }
  }
  const hz = ctx.createLinearGradient(0, hy, 0, hy + 60 * s); hz.addColorStop(0, rgba(...mix([70, 85, 120], [150, 100, 80], dusk), 0.4)); hz.addColorStop(1, 'rgba(60,70,100,0)');
  ctx.fillStyle = hz; ctx.fillRect(0, hy, w, 60 * s);
}

// a vertical broken streak of a light on the water (point is the light's world position)
export function paintReflection(ctx, cam, p, t, { color = [255, 175, 80], alpha = 0.8, widthM = 0.22, lenPx = 520, wob = 1 } = {}) {
  const s = cam.width / 1080;
  const base = cam.project([p[0], 0, p[2]]), top = cam.project([p[0], -p[1], p[2]]);
  if (!base.ok) return;
  const y0 = Math.max(base.y, horizonY(cam) + 1), yEnd = Math.min(cam.height + 20, y0 + lenPx * s);
  const ppm = cam.f / base.z; // px per metre at the light's depth
  const wBase = Math.max(6 * s, widthM * ppm);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let y = y0, i = 0; y < yEnd; y += 4.5 * s, i++) {
    const k = (y - y0) / Math.max(1, yEnd - y0);
    const j = (hash(i * 3.1) - 0.5) + Math.sin(t * (1.1 + hash(i)) + i * 0.7) * 0.6;
    const wd = wBase * (0.35 + 0.9 * hash(i + 9)) * (1 + 1.6 * k) * 0.85;
    const x = base.x + j * wBase * (0.6 + 2.2 * k) * wob;
    if (hash(i + 123 + Math.floor(t * 3)) < 0.18 * k) continue; // gaps
    ctx.fillStyle = rgba(color[0], color[1], color[2], alpha * (1 - k) ** 1.3 * (0.35 + 0.65 * hash(i + 41)));
    ctx.fillRect(x - wd / 2, y, wd, Math.max(1.2, 2.6 * s));
  }
  ctx.restore();
}

export function paintRing(ctx, cam, x, z, r, alpha, { color = [160, 185, 235], squash = 1, lw = 2 } = {}) {
  if (alpha <= 0.01 || r <= 0) return;
  ctx.save(); ctx.strokeStyle = rgba(color[0], color[1], color[2], Math.min(1, alpha * 1.5)); ctx.lineWidth = Math.max(1.5, (lw + 1) * cam.width / 1080);
  ctx.beginPath(); let started = false;
  for (let i = 0; i <= 56; i++) {
    const a = (i / 56) * TAU, p = cam.project([x + Math.cos(a) * r, 0, z + Math.sin(a) * r * squash]);
    if (!p.ok) { started = false; continue; }
    if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke(); ctx.restore();
}
// rings born at times[] from (x,z), fade and widen
export function ringsFrom(ctx, cam, t, x, z, times, { life = 3.6, speed = 0.55, color, a = 0.5, squash = 1 } = {}) {
  for (const t0 of times) { const age = t - t0; if (age < 0 || age > life) continue; paintRing(ctx, cam, x, z, 0.12 + age * speed, a * (1 - age / life) ** 1.4, { color, squash }); }
}

// ---------------------------------------------------------------- boat (broadside, bow to screen-left, cabin amidships, lantern on the cabin's right)
export function boatPts(o) {
  const bob = Math.sin(o.t * 0.9 + 1) * 0.025 * (o.bob ?? 1) + (o.dy || 0);
  const P = (x, y, z) => ({ ...cam_proj(o.cam, [o.x + x, y + bob, o.z + z]) });
  return { P, bob };
}
const cam_proj = (cam, p) => cam.project(p);
export function lanternWorld(o) { return [o.x + 1.78, 1.5, o.z - 0.95]; }
export function windowWorld(o) { return [o.x + 0.25, 1.35, o.z - 0.82]; }

export function drawBoat(ctx, cam, o) {
  const { P, bob } = boatPts({ ...o, cam });
  const s = cam.width / 1080, lit = o.lit ?? 1, win = o.win ?? 1, lan = o.lantern ?? 1;
  const path = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); };
  const ok = (pts) => pts.every((p) => p.ok);
  const L = 3.6, top = (x) => 0.62 + 0.26 * Math.pow(Math.abs(x) / L, 2.2) + (x < 0 ? 0.12 * Math.pow(-x / L, 2) : 0);
  const zN = (x) => -1.0 * (1 - 0.82 * Math.pow(Math.abs(x) / L, 3.2));
  const xs = []; for (let x = -L; x <= L + 0.001; x += 0.3) xs.push(x);
  const near = xs.map((x) => P(x, top(x), zN(x))), nearB = xs.map((x) => P(x, -0.12, zN(x))).reverse(), far = xs.map((x) => P(x, top(x), -zN(x)));
  if (!ok(near) || !ok(nearB) || !ok(far)) return null;
  // far gunwale + deck
  path([...far, ...near.slice().reverse()]); ctx.fillStyle = rgba(22, 15, 10, 1); ctx.fill();
  // hull side
  path([...near, ...nearB]); const hg = ctx.createLinearGradient(0, near[8].y, 0, nearB[8].y); hg.addColorStop(0, rgba(...mix([36, 24, 17], [26, 34, 54], 1 - lit), 1)); hg.addColorStop(1, rgba(...mix([11, 7, 5], [14, 20, 36], 1 - lit), 1)); ctx.fillStyle = hg; ctx.fill();
  ctx.save(); path([...near, ...nearB]); ctx.clip();
  ctx.lineWidth = Math.max(1.5, 2.4 * s);
  for (let k = 1; k <= 3; k++) { for (const [col, dy] of [['rgba(4,2,1,0.85)', 0], ['rgba(190,135,85,0.38)', 0.025]]) { ctx.strokeStyle = col; ctx.beginPath(); xs.forEach((x, i) => { const p = P(x, top(x) - 0.2 * k - dy, zN(x)); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.stroke(); } }
  // warm wash from the lantern and window across the planks
  const lp = P(1.78, 1.5, -0.95), wp = P(0.25, 1.35, -0.82);
  if (lp.ok) { const R = (cam.f / lp.z) * 2.6; const g = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, R); g.addColorStop(0, rgba(255, 170, 80, 0.26 * lan * lit)); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(lp.x - R, lp.y - R, 2 * R, 2 * R); }
  if (wp.ok) { const R = (cam.f / wp.z) * 3.0; const g = ctx.createRadialGradient(wp.x, wp.y, 0, wp.x, wp.y, R); g.addColorStop(0, rgba(255, 190, 110, 0.2 * win * lit)); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.fillRect(wp.x - R, wp.y - R, 2 * R, 2 * R); }
  ctx.restore();
  const cold = 1 - lit;
  ctx.strokeStyle = rgba(lerp(120, 150, cold), lerp(90, 185, cold), lerp(62, 240, cold), 0.55 * (0.4 + 0.6 * lit) + 0.45 * cold); ctx.lineWidth = Math.max(1, 2.2 * s) * (1 + cold); ctx.beginPath(); near.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  // bow seat
  const seat = [P(-2.8, 0.7, -0.6), P(-2.0, 0.7, -0.6), P(-2.0, 0.64, -0.6), P(-2.8, 0.64, -0.6)];
  if (ok(seat)) { path(seat); ctx.fillStyle = '#2a1d13'; ctx.fill(); }
  // cabin
  const c0 = -0.95, c1 = 1.6, cy0 = 0.62, cy1 = 1.85, cz = -0.8;
  const cf = [P(c0, cy0, cz), P(c1, cy0, cz), P(c1, cy1, cz), P(c0, cy1, cz)];
  const roof = [P(c0 - 0.1, cy1, cz - 0.08), P(c1 + 0.1, cy1, cz - 0.08), P(c1 + 0.1, cy1 + 0.08, 0.8), P(c0 - 0.1, cy1 + 0.08, 0.8)];
  const side = [P(c0, cy0, cz), P(c0, cy0, 0.8), P(c0, cy1, 0.8), P(c0, cy1, cz)];
  if (ok(cf) && ok(roof)) {
    path(roof); ctx.fillStyle = '#120c08'; ctx.fill();
    if (ok(side)) { path(side); ctx.fillStyle = '#1b130d'; ctx.fill(); }
    path(cf); ctx.strokeStyle = rgba(lerp(150, 140, cold), lerp(105, 175, cold), lerp(66, 235, cold), 0.9); ctx.lineWidth = Math.max(2, 3 * s); ctx.stroke();
    path(cf); const cg = ctx.createLinearGradient(cf[0].x, 0, cf[1].x, 0); cg.addColorStop(0, rgba(...mix([43, 31, 22], [30, 40, 62], cold), 1)); cg.addColorStop(1, rgba(...mix([58, 42, 29], [36, 48, 74], cold), 1)); ctx.fillStyle = cg; ctx.fill();
    ctx.save(); path(cf); ctx.clip(); ctx.strokeStyle = rgba(6, 4, 3, 0.55); ctx.lineWidth = Math.max(1, 2 * s);
    for (let k = 1; k < 9; k++) { const a = P(c0, cy0 + (cy1 - cy0) * k / 9, cz), b2 = P(c1, cy0 + (cy1 - cy0) * k / 9, cz); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); ctx.stroke(); }
    ctx.restore();
    // four-pane window
    const wx0 = -0.6, wx1 = 1.1, wy0 = 1.0, wy1 = 1.7, gap = 0.05, wz = cz - 0.01;
    const fl = o.flicker ?? 1;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      const xa = wx0 + (wx1 - wx0) * (a / 2) + gap / 2, xb = wx0 + (wx1 - wx0) * ((a + 1) / 2) - gap / 2, ya = wy0 + (wy1 - wy0) * (b / 2) + gap / 2, yb = wy0 + (wy1 - wy0) * ((b + 1) / 2) - gap / 2;
      const q = [P(xa, ya, wz), P(xb, ya, wz), P(xb, yb, wz), P(xa, yb, wz)];
      if (!ok(q)) continue;
      const pg = (o.paneGlow && o.paneGlow[a * 2 + b] !== undefined ? o.paneGlow[a * 2 + b] : 1) * win * fl;
      const gr = ctx.createLinearGradient(0, q[3].y, 0, q[0].y); const dk = cold > 0.5 ? [58, 78, 118] : [8, 10, 16]; gr.addColorStop(0, rgba(...mix(dk, [255, 214, 140], pg), 1)); gr.addColorStop(1, rgba(...mix(dk, [255, 176, 90], pg), 1));
      path(q); ctx.fillStyle = gr; ctx.fill();
      if (cold > 0.5) { ctx.strokeStyle = rgba(150, 180, 235, 0.8); ctx.lineWidth = Math.max(1.5, 2.5 * s); ctx.stroke(); }
      if ((o.fog ?? 0) > 0) { path(q); ctx.fillStyle = rgba(190, 205, 225, 0.5 * o.fog); ctx.fill(); }
    }
    // palm smears on the glass from inside
    if (o.palms) {
      const pc = P(0.25, 1.35, wz); const sc = cam.f / pc.z;
      o.palms.forEach((pm, i) => { const a = clamp01(pm.a ?? 1); if (a <= 0.01) return; drawHand(ctx, pc.x + pm.x * sc, pc.y + pm.y * sc, pm.s * sc * 0.5, pm.r || 0, [225, 232, 245], 0.42 * a * (0.7 + 0.3 * Math.sin(t0(o) * 1.3 + i))); });
    }
    // lantern on the cabin's right side
    const lq = P(1.78, 1.5, -0.95);
    if (lq.ok) {
      const rr = (cam.f / lq.z) * 0.1; ctx.fillStyle = '#0d0907'; ctx.fillRect(lq.x - rr * 0.9, lq.y - rr * 1.6, rr * 1.8, rr * 3.2);
      const fx = 0.88 + 0.12 * Math.sin(o.t * 9) * Math.sin(o.t * 2.3);
      ctx.fillStyle = rgba(255, 210, 130, 0.95 * lan * fx); ctx.fillRect(lq.x - rr * 0.55, lq.y - rr * 1.1, rr * 1.1, rr * 2.2);
      const R = (cam.f / lq.z) * 1.6; const g = ctx.createRadialGradient(lq.x, lq.y, 0, lq.x, lq.y, R); g.addColorStop(0, rgba(255, 190, 100, 0.55 * lan * fx)); g.addColorStop(1, 'rgba(255,140,50,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(lq.x - R, lq.y - R, 2 * R, 2 * R); ctx.restore();
    }
  }
  // oar leaning on the cabin, coiled rope on the deck
  const oar = [P(1.9, 0.6, -0.7), P(2.0, 0.6, -0.7), P(2.05, 1.75, -0.7), P(1.95, 1.75, -0.7)];
  if (ok(oar)) { path(oar); ctx.fillStyle = '#4a3523'; ctx.fill(); ctx.strokeStyle = rgba(190, 145, 95, 0.7); ctx.lineWidth = Math.max(1.5, 2 * s); ctx.stroke(); }
  for (let k = 0; k < 4; k++) { const rp = P(-0.4 - k * 0.04, 0.72 + k * 0.03, -0.55), rr = (cam.f / (rp.z || 1)) * (0.22 - k * 0.03); if (rp.ok) { ctx.strokeStyle = rgba(190, 160, 110, 0.75); ctx.lineWidth = Math.max(1.5, 3 * s); ctx.beginPath(); ctx.ellipse(rp.x, rp.y, rr, rr * 0.3, 0, 0, TAU); ctx.stroke(); } }
  // the red jacket on the bow seat
  const jp = P(-2.4, 0.7, -0.15);
  if (jp.ok && (o.jacket ?? 1) > 0) drawJacket(ctx, jp.x, jp.y, (cam.f / jp.z) * 0.62, o.t, { breath: o.breath ?? 0.4, warm: o.warm ?? 0, lit: lit * (0.4 + 0.6 * lan) });
  return { lantern: lp, wind: wp, jacket: jp };
}
const t0 = (o) => o.t;

export function drawJacket(ctx, x, y, size, t, { breath = 0.4, warm = 0, lit = 1 } = {}) {
  const br = 1 + 0.035 * breath * Math.sin(t * 2.1), w = size * br, h = size * 0.82 * br;
  ctx.save(); ctx.translate(x, y);
  const base = [mix([88, 18, 20], [150, 30, 28], lit)];
  const col = (k) => rgba(...mix([60, 12, 14], [170, 36, 30], clamp01(lit * k + warm * 0.2)), 1);
  // hood behind the neck, body slumped on the seat, two sleeves draped over the plank
  ctx.fillStyle = col(0.5); ctx.beginPath(); ctx.ellipse(0, -h * 0.82, w * 0.2, h * 0.16, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col(0.8); ctx.beginPath();
  ctx.moveTo(-w * 0.58, h * 0.08); ctx.bezierCurveTo(-w * 0.6, -h * 0.5, -w * 0.3, -h * 0.78, 0, -h * 0.72);
  ctx.bezierCurveTo(w * 0.3, -h * 0.78, w * 0.6, -h * 0.5, w * 0.58, h * 0.08); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgba(30, 6, 8, 0.8); ctx.lineWidth = Math.max(1.5, size * 0.02); ctx.beginPath(); ctx.moveTo(0, -h * 0.72); ctx.lineTo(0, h * 0.06); ctx.stroke();
  ctx.strokeStyle = rgba(35, 6, 8, 0.45); for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-w * (0.42 - k * 0.12), -h * 0.2); ctx.quadraticCurveTo(-w * (0.3 - k * 0.1), -h * 0.05, -w * (0.38 - k * 0.1), h * 0.05); ctx.stroke(); }
  for (const sd of [-1, 1]) { ctx.fillStyle = col(sd < 0 ? 0.7 : 0.55); ctx.beginPath(); ctx.moveTo(sd * w * 0.5, -h * 0.4); ctx.quadraticCurveTo(sd * w * 0.82, -h * 0.05, sd * w * 0.66, h * 0.62); ctx.lineTo(sd * w * 0.46, h * 0.58); ctx.quadraticCurveTo(sd * w * 0.56, h * 0.05, sd * w * 0.42, -h * 0.28); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = rgba(15, 2, 4, 0.95); ctx.lineWidth = Math.max(2, size * 0.028); ctx.beginPath(); ctx.moveTo(-w * 0.58, h * 0.08); ctx.bezierCurveTo(-w * 0.6, -h * 0.5, -w * 0.3, -h * 0.78, 0, -h * 0.72); ctx.bezierCurveTo(w * 0.3, -h * 0.78, w * 0.6, -h * 0.5, w * 0.58, h * 0.08); ctx.stroke();
  ctx.fillStyle = rgba(235, 200, 190, 0.55); for (let k = 0; k < 9; k++) ctx.fillRect(-size * 0.012, -h * 0.68 + k * h * 0.08, size * 0.024, size * 0.02);
  ctx.setLineDash([size * 0.03, size * 0.03]); ctx.strokeStyle = rgba(240, 150, 130, 0.45); ctx.lineWidth = Math.max(1, size * 0.01); ctx.beginPath(); ctx.moveTo(-w * 0.5, -h * 0.05); ctx.lineTo(-w * 0.16, -h * 0.05); ctx.moveTo(w * 0.5, -h * 0.05); ctx.lineTo(w * 0.16, -h * 0.05); ctx.stroke(); ctx.setLineDash([]);
  // lit rim (it is body-warm)
  ctx.strokeStyle = rgba(255, 140, 110, 0.6 * lit); ctx.lineWidth = Math.max(2, size * 0.03); ctx.beginPath(); ctx.moveTo(-w * 0.5, -h * 0.3); ctx.bezierCurveTo(-w * 0.4, -h * 0.7, -w * 0.15, -h * 0.78, 0, -h * 0.72); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- bodies
export function drawHand(ctx, x, y, s, rot = 0, rgb = [20, 28, 40], a = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.globalAlpha = a; ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  ctx.beginPath(); ctx.ellipse(0, 0, 0.5, 0.58, 0, 0, TAU); ctx.fill();
  const fing = [[-0.34, -0.2, 0.55, -0.12], [-0.12, -0.34, 0.74, -0.03], [0.12, -0.34, 0.78, 0.04], [0.34, -0.2, 0.62, 0.12]];
  for (const [fx, fy, len, an] of fing) { ctx.save(); ctx.translate(fx, fy); ctx.rotate(an); ctx.beginPath(); ctx.roundRect(-0.085, -len, 0.17, len + 0.1, 0.085); ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.translate(-0.42, 0.12); ctx.rotate(-0.95); ctx.beginPath(); ctx.roundRect(-0.095, -0.5, 0.19, 0.6, 0.095); ctx.fill(); ctx.restore();
  ctx.restore();
}

// narrator seen from behind, bottom of frame like ep1; water overlay at waterY hides his lower body
export function drawNarrator(ctx, w, h, t, { x = 0.5, headY = 0.80, size = 1, waterY = 0.88, breath = 1, rim = [255, 170, 90], rimA = 0.45, lean = 0, sink = 0, rimSide = 0, noWater = false } = {}) {
  const s = w / 1080, cx = x * w + lean * 30 * s, hy = (headY + sink) * h, r = 92 * s * size, sw = Math.sin(t * 1.7) * 2 * breath * s;
  ctx.save();
  const body = '#02030a';
  ctx.fillStyle = body;
  // shoulders + back
  ctx.beginPath(); ctx.moveTo(cx - 330 * s * size, h + 40); ctx.bezierCurveTo(cx - 330 * s * size, hy + r * 1.7, cx - 250 * s * size, hy + r * 1.05 + sw, cx - 80 * s * size, hy + r * 0.92);
  ctx.lineTo(cx + 80 * s * size, hy + r * 0.92); ctx.bezierCurveTo(cx + 250 * s * size, hy + r * 1.05 + sw, cx + 330 * s * size, hy + r * 1.7, cx + 330 * s * size, h + 40); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + sw * 0.5, hy, r * 0.92, r * 1.02, 0, 0, TAU); ctx.fill();
  ctx.fillRect(cx - 40 * s * size, hy + r * 0.7, 80 * s * size, r * 0.5);
  // rim light on the edges facing the boat / moon
  const g = ctx.createLinearGradient(0, hy - r, 0, hy + r * 1.4); g.addColorStop(0, rgba(rim[0], rim[1], rim[2], rimA)); g.addColorStop(1, rgba(rim[0], rim[1], rim[2], 0));
  ctx.strokeStyle = g; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.ellipse(cx + sw * 0.5, hy, r * 0.92, r * 1.02, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 80 * s * size, hy + r * 0.92); ctx.bezierCurveTo(cx - 250 * s * size, hy + r * 1.05 + sw, cx - 330 * s * size, hy + r * 1.7, cx - 330 * s * size, hy + r * 3.1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 80 * s * size, hy + r * 0.92); ctx.bezierCurveTo(cx + 250 * s * size, hy + r * 1.05 + sw, cx + 330 * s * size, hy + r * 1.7, cx + 330 * s * size, hy + r * 3.1); ctx.stroke();
  if (noWater) { ctx.restore(); return { cx, hy, r, wy: h }; }
  // water hides his chest down
  const wy = waterY * h + sink * h;
  const wg = ctx.createLinearGradient(0, wy - 8 * s, 0, h); wg.addColorStop(0, 'rgba(14,22,38,0.96)'); wg.addColorStop(0.15, 'rgba(5,9,18,0.98)'); wg.addColorStop(1, 'rgba(2,3,7,1)');
  ctx.fillStyle = wg; ctx.beginPath(); ctx.moveTo(0, wy);
  for (let xx = 0; xx <= w + 20; xx += 20) ctx.lineTo(xx, wy + Math.sin(xx * 0.03 + t * 1.4) * 3 * s + Math.sin(xx * 0.011 - t * 0.7) * 4 * s);
  ctx.lineTo(w, h + 4); ctx.lineTo(0, h + 4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgba(120, 150, 205, 0.28); ctx.lineWidth = 2 * s; ctx.beginPath();
  for (let xx = 0; xx <= w + 20; xx += 20) { const yy = wy + Math.sin(xx * 0.03 + t * 1.4) * 3 * s + Math.sin(xx * 0.011 - t * 0.7) * 4 * s; xx === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); }
  ctx.stroke();
  ctx.restore();
  return { cx, hy, r, wy };
}

export function drawSteam(ctx, x, y, t, { n = 14, spread = 50, rise = 260, size = 60, alpha = 0.3, speed = 0.22, seed = 0, color = [190, 205, 230], drift = 0 } = {}) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const ph = (t * speed + hash(i + seed * 13)) % 1, a = Math.sin(ph * Math.PI) * alpha * (0.5 + 0.5 * hash(i + seed));
    const px = x + (hash(i * 3 + seed) - 0.5) * spread + Math.sin(ph * 5 + i) * spread * 0.35 + drift * ph, py = y - ph * rise, r = size * (0.5 + ph * 1.5);
    const g = ctx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, rgba(color[0], color[1], color[2], a)); g.addColorStop(1, rgba(color[0], color[1], color[2], 0));
    ctx.fillStyle = g; ctx.fillRect(px - r, py - r, 2 * r, 2 * r);
  }
  ctx.restore();
}

export function mist(ctx, w, h, t, { y, hh, alpha = 0.12, color = [110, 130, 170], layers = 3 }) {
  ctx.save();
  for (let k = 0; k < layers; k++) {
    const yy = y + k * hh * 0.22, off = (t * (8 + k * 5) + k * 300) % (w * 1.4);
    for (let i = -1; i < 3; i++) {
      const cx = i * w * 0.7 - off + w * 0.7;
      ctx.save(); ctx.translate(cx, yy); ctx.scale(1, hh / (w * 0.5) * 0.55);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.5); g.addColorStop(0, rgba(color[0], color[1], color[2], alpha / (1 + k * 0.5))); g.addColorStop(1, rgba(color[0], color[1], color[2], 0));
      ctx.fillStyle = g; ctx.fillRect(-w * 0.5, -w * 0.5, w, w); ctx.restore();
    }
  }
  ctx.restore();
}

// shoreline: mud bank, mooring post with three notches and a lamp, reeds, footprints; viewed from the water looking back
export function drawShore(ctx, cam, t, { x = 0, z = -8, lamp = 1, postOnly = false } = {}) {
  const s = cam.width / 1080, pts = [];
  if (!postOnly) {
  const near = cam.project([x - 40, 0, z]), far = cam.project([x + 40, 0.9, z - 30]);
  const a = cam.project([x - 30, 0, z]), b = cam.project([x + 30, 0, z]), c = cam.project([x + 30, 2.2, z - 12]), d = cam.project([x - 30, 2.2, z - 12]);
  if (!(a.ok && b.ok && c.ok && d.ok)) { /* bank band not visible */ } else {
  const g = ctx.createLinearGradient(0, d.y, 0, a.y); g.addColorStop(0, '#05070b'); g.addColorStop(0.5, '#0d0f10'); g.addColorStop(1, '#171410');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
  // hillside behind the bank with a few village windows
  const hill = [cam.project([x - 60, 0, z - 14]), cam.project([x + 60, 0, z - 14]), cam.project([x + 60, 26, z - 60]), cam.project([x - 60, 18, z - 60])];
  if (hill.every((p) => p.ok)) { ctx.fillStyle = '#04060a'; ctx.beginPath(); ctx.moveTo(hill[0].x, hill[0].y); hill.slice(1).forEach((p) => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill(); }
  for (let i = 0; i < 10; i++) { const p = cam.project([x - 34 + hash(i + 2) * 68, 6 + hash(i + 8) * 12, z - 50]); if (p.ok && Math.sin(t * 0.3 + i * 3) > -0.8) { ctx.fillStyle = rgba(255, 190, 100, 0.95); ctx.fillRect(p.x, p.y, 5 * s, 5 * s); } }
  }
  }
  // reeds
  ctx.strokeStyle = '#06080a'; ctx.lineWidth = Math.max(1.5, 3 * s);
  for (let i = 0; i < (postOnly ? 38 : 90); i++) { const rx = postOnly ? x - 3.2 + hash(i + 50) * 2.6 : x - 14 + hash(i + 50) * 28, p = cam.project([rx, 0, z + 0.2 + hash(i) * 0.6]), q = cam.project([rx + Math.sin(t * 1.1 + i) * 0.12, 1.3 + hash(i + 3), z + 0.2]); if (p.ok && q.ok) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); } }
  // mooring post + notches + lamp
  const pb = cam.project([x - 1.2, 0.2, z + 0.4]), pt = cam.project([x - 1.2, 1.7, z + 0.4]);
  if (pb.ok && pt.ok) {
    const pw = Math.max(5 * s, (cam.f / pb.z) * 0.12); ctx.fillStyle = '#1b130d'; ctx.fillRect(pb.x - pw / 2, pt.y, pw, pb.y - pt.y);
    ctx.strokeStyle = rgba(230, 200, 150, 0.7); ctx.lineWidth = Math.max(1.5, 2 * s);
    for (let k = 0; k < 3; k++) { const yy = pt.y + (pb.y - pt.y) * (0.28 + k * 0.1); ctx.beginPath(); ctx.moveTo(pb.x - pw / 2, yy); ctx.lineTo(pb.x + pw / 2, yy); ctx.stroke(); }
    const fl = 0.85 + 0.15 * Math.sin(t * 8.3) * Math.sin(t * 2.9), R = (cam.f / pb.z) * 2.4 * lamp;
    const lg = ctx.createRadialGradient(pt.x, pt.y - 6 * s, 0, pt.x, pt.y - 6 * s, R); lg.addColorStop(0, rgba(255, 190, 110, 0.5 * fl * lamp)); lg.addColorStop(1, 'rgba(255,140,50,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = lg; ctx.fillRect(pt.x - R, pt.y - R, 2 * R, 2 * R); ctx.restore();
    ctx.fillStyle = rgba(255, 220, 150, 0.95 * lamp * fl); ctx.beginPath(); ctx.arc(pt.x, pt.y - 6 * s, Math.max(3, (cam.f / pb.z) * 0.06), 0, TAU); ctx.fill();
  }
  // footprints in the mud (three nights of standing)
  ctx.fillStyle = rgba(4, 4, 5, 0.85); ctx.strokeStyle = rgba(190, 170, 140, 0.55); ctx.lineWidth = Math.max(1, 1.8 * s);
  for (let i = 0; i < 14; i++) { const p = cam.project([x - 3 + hash(i + 20) * 4.2, 0.02, z + 0.5 + hash(i + 40) * 1.8]); if (p.ok) { const rr = Math.max(2, (cam.f / p.z) * 0.12); ctx.beginPath(); ctx.ellipse(p.x, p.y, rr, rr * 0.45, 0, 0, TAU); ctx.fill(); ctx.stroke(); } }
}

// the thing walking across the lake: a narrow child-sized silhouette with a left lean, no ripples
export function drawWalker(ctx, cam, t, { x = 0, z = 30, inverted = false, alpha = 1, pale = 0, stepT = 0, lean = 0.13, sub = 0, scale = 1 } = {}) {
  const foot = cam.project([x, 0, z]), head = cam.project([x, 1.3, z]);
  if (!foot.ok || !head.ok) return null;
  const H = Math.abs(foot.y - head.y) * scale, sg = inverted ? -1 : 1; // inverted hangs below the waterline
  if (!inverted) { ctx.save(); ctx.fillStyle = rgba(1, 3, 8, 0.7 * alpha); ctx.beginPath(); ctx.ellipse(foot.x, foot.y + 2, H * 0.5, H * 0.07, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.translate(foot.x, foot.y); ctx.globalAlpha = alpha;
  ctx.rotate(lean * (inverted ? -1 : 1) + Math.sin(stepT * 2.2) * 0.025);
  const col = pale > 0 ? rgba(...mix([4, 6, 12], [170, 190, 215], pale), 1) : '#03050a';
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round';
  const u = H, st = Math.sin(stepT * 2.2), up = (v) => v * u * -sg;
  ctx.lineWidth = u * 0.085; ctx.beginPath(); ctx.moveTo(-u * 0.045, up(0.45)); ctx.lineTo(-u * 0.055 + st * u * 0.03, up(0.0)); ctx.moveTo(u * 0.045, up(0.45)); ctx.lineTo(u * 0.055 - st * u * 0.03, up(0.0)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-u * 0.13, up(0.46)); ctx.lineTo(-u * 0.11, up(0.82)); ctx.lineTo(u * 0.11, up(0.82)); ctx.lineTo(u * 0.13, up(0.46)); ctx.closePath(); ctx.fill();
  ctx.lineWidth = u * 0.06; ctx.beginPath(); ctx.moveTo(-u * 0.12, up(0.8)); ctx.lineTo(-u * 0.17, up(0.5)); ctx.moveTo(u * 0.12, up(0.8)); ctx.lineTo(u * 0.17, up(0.5)); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, up(0.93), u * 0.1, u * 0.115, 0, 0, TAU); ctx.fill();
  if (!inverted) { ctx.strokeStyle = rgba(150, 175, 225, 0.55); ctx.lineWidth = Math.max(1.5, u * 0.012); ctx.beginPath(); ctx.ellipse(0, up(0.93), u * 0.1, u * 0.115, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-u * 0.11, up(0.82)); ctx.lineTo(-u * 0.13, up(0.46)); ctx.stroke(); }
  ctx.restore();
  return { foot, head, H };
}

// ---------------------------------------------------------------- grip: pale water-fingers closing on his chest
export function drawGrip(ctx, cx, cy, w, t, amt, { a = 1 } = {}) {
  const s = w / 1080; if (amt <= 0) return;
  ctx.save(); ctx.lineCap = 'round';
  for (let side = -1; side <= 1; side += 2) for (let i = 0; i < 4; i++) {
    const y = cy - 110 * s + i * 62 * s, rad = lerp(520, 150, smooth(amt)) * s, wob = Math.sin(t * 3 + i * 1.7 + side) * 5 * s;
    ctx.strokeStyle = rgba(190, 212, 245, 0.85 * a * clamp01(amt * 1.5)); ctx.lineWidth = 58 * s * (1 - i * 0.1);
    ctx.beginPath(); ctx.moveTo(cx + side * (rad + 160 * s), y + 90 * s); ctx.quadraticCurveTo(cx + side * (rad + 40 * s), y + wob, cx + side * rad * 0.6, y + 18 * s + wob * 0.5); ctx.stroke();
    ctx.strokeStyle = rgba(10, 16, 28, 0.9 * a); ctx.lineWidth = 30 * s * (1 - i * 0.1);
    ctx.beginPath(); ctx.moveTo(cx + side * (rad + 160 * s), y + 90 * s); ctx.quadraticCurveTo(cx + side * (rad + 40 * s), y + wob, cx + side * rad * 0.6, y + 18 * s + wob * 0.5); ctx.stroke();
  }
  ctx.restore();
}

export const FONT = '"Noto Sans Devanagari", "Noto Sans", "DejaVu Sans", sans-serif';
export const capAt = (tl, needle, fb) => { const c = (tl.captions || []).find((x) => x.text.includes(needle)); return c ? c.start_s : fb; };
export const sceneOf = (tl, t) => (tl.scenes || []).find((s) => t >= s.start_s && t < s.end_s) || (tl.scenes || [])[(tl.scenes || []).length - 1];
export const cue = (tl, name, fb) => { const c = (tl.audio_cues || []).find((x) => x.name === name); return c ? c.t_s : fb; };
export const lineAt = (tl, i) => (tl.lines || [])[i];

// S-curve contrast: overlay the frame onto itself (darker darks, brighter keys), then a thin unsharp pass of crisp rim lines is already in the shapes
export function punch(ctx, w, h, amt = 0.7) {
  if (amt <= 0 || process.env.NO_PUNCH === "1") return;
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = amt; ctx.drawImage(ctx.canvas, 0, 0, w, h); ctx.restore();
}
