// cinema/light: motivated lighting. The scene is multiplied by a quarter-res light map (so everything outside the
// lights goes properly dark), then a coloured glow is screened on top. God rays are a 12-tap radial zoom at
// quarter res with seeded per-frame jitter. Rim light, cast shadows and glints draw in the caller's transform.
import { Path2D as Path2DCtor } from '@napi-rs/canvas';
import { pooled, begin, end, parseColor, rgba, cl, DW, DH, frameSeed, mulberry32 } from './util.mjs';

const norm = (c) => { const p = parseColor(c), m = Math.max(p[0], p[1], p[2], 1); return [p[0] / m * 255, p[1] / m * 255, p[2] / m * 255]; };
const FALL = [[0, 1], [0.2, 0.68], [0.45, 0.3], [0.7, 0.09], [1, 0]]; // smooth, inverse-square-ish

let MAP = (a) => Math.min(1, a); // light amount -> alpha ('atop' mode uses an exponential exposure curve instead)
function radial(x, cx, cy, r, rgb, a) {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, r));
  for (const [s, v] of FALL) g.addColorStop(s, `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${MAP(v * a).toFixed(4)})`);
  return g;
}
function sector(x, L, scale) { // cone sector path
  const half = L.spread * scale, a0 = L.angle - half, a1 = L.angle + half, len = L.length * 1.05;
  x.beginPath(); x.moveTo(L.x, L.y); x.arc(L.x, L.y, len, a0, a1); x.closePath();
}
const rectOf = (L) => L.rect;

// Draws one light into x (design coordinates). gain scales the colour (1 = full multiply contribution).
function drawLight(x, L, gain) {
  const rgb = norm(L.color ?? '#ffffff'), a = (L.intensity ?? 1) * gain;
  if (L.type === 'point') {
    x.fillStyle = radial(x, L.x, L.y, L.r, rgb, a); x.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  } else if (L.type === 'cone') {
    L = { spread: 0.35, length: 900, angle: Math.PI / 2, ...L };
    // soft edge: three nested sectors; plus a small pool around the source
    for (const [s, w] of [[1.18, 0.3], [0.95, 0.4], [0.7, 0.45]]) {
      x.save(); sector(x, L, s); x.clip();
      x.fillStyle = radial(x, L.x, L.y, L.length, rgb, a * w); x.fillRect(L.x - L.length, L.y - L.length, L.length * 2, L.length * 2); x.restore();
    }
    x.fillStyle = radial(x, L.x, L.y, (L.r ?? 90), rgb, a * 0.6); x.fillRect(L.x - 300, L.y - 300, 600, 600);
  } else if (L.type === 'window') {
    const [rx, ry, rw, rh] = rectOf(L), cx = rx + rw / 2, cy = ry + rh / 2, R = Math.max(rw, rh) * (L.reach ?? 1.6);
    x.fillStyle = radial(x, cx, cy, R, rgb, a * 0.55); x.fillRect(cx - R, cy - R, R * 2, R * 2);
    // light shaft thrown by the window: parallelogram skewed along (dx,dy), fades with distance
    const dx = L.throwX ?? 0.5, len = L.throw ?? 900;
    for (const [s, w] of [[1.12, 0.25], [1, 0.35], [0.82, 0.4]]) {
      const ex = rw * (s - 1) / 2; x.save();
      x.beginPath(); x.moveTo(rx - ex, ry + rh); x.lineTo(rx + rw + ex, ry + rh); x.lineTo(rx + rw + ex + dx * len, ry + rh + len); x.lineTo(rx - ex + dx * len, ry + rh + len); x.closePath(); x.clip();
      const g = x.createLinearGradient(0, ry + rh, 0, ry + rh + len); g.addColorStop(0, `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${MAP(a * w).toFixed(4)})`); g.addColorStop(1, `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},0)`);
      x.fillStyle = g; x.fillRect(rx - 600, ry + rh, rw + 1200 + Math.abs(dx) * len, len); x.restore();
    }
    x.fillStyle = `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${MAP(a).toFixed(4)})`; x.fillRect(rx, ry, rw, rh);
  } else if (L.type === 'door') {
    const [rx, ry, rw, rh] = rectOf(L), spill = L.spill ?? 500;
    x.fillStyle = `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${MAP(a).toFixed(4)})`; x.fillRect(rx, ry, rw, rh);
    const cx = rx + rw / 2, R = Math.max(rh, spill) * 0.9;
    x.fillStyle = radial(x, cx, ry + rh * 0.55, R, rgb, a * 0.5); x.fillRect(cx - R, ry + rh * 0.55 - R, R * 2, R * 2);
    // floor spill fan in front of the door
    x.save(); x.beginPath(); x.moveTo(rx, ry + rh); x.lineTo(rx + rw, ry + rh); x.lineTo(rx + rw + spill * 0.9, ry + rh + spill * 0.7); x.lineTo(rx - spill * 0.9, ry + rh + spill * 0.7); x.closePath(); x.clip();
    const g = x.createLinearGradient(0, ry + rh, 0, ry + rh + spill * 0.7); g.addColorStop(0, `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${MAP(a * 0.8).toFixed(4)})`); g.addColorStop(1, `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},0)`);
    x.fillStyle = g; x.fillRect(rx - spill, ry + rh, rw + spill * 2, spill); x.restore();
  }
}

/**
 * Plunge the finished scene into darkness except for motivated light pools.
 * lights: [{type:'point', x,y,r,color,intensity}, {type:'cone', x,y,angle,spread,length,color,intensity},
 *          {type:'window', rect:[x,y,w,h], color,intensity,throw,throwX,reach}, {type:'door', rect:[x,y,w,h], spill,...}]
 * (design-space coords). opts: {ambient:'#070b16' (what unlit areas are multiplied by), glow:0.35 (coloured screen
 * pass strength), flicker:1 (multiplies all intensities)}. Multiplies an OPAQUE frame by a quarter-res light map, then
 * screens a coloured glow (so dark materials stay dark and keep their texture; light only reveals them).
 * Cost: ~2 quarter-res canvases + 2 full-res blits. For frames with transparent areas use darkMaskLayer.
 */
export function darkMask(ctx, lights = [], o = {}) {
  const { ambient = '#070b16', glow = 0.35, flicker = 1 } = o;
  const { W, H } = begin(ctx);
  const qw = Math.round(W / 4), qh = Math.round(H / 4), q = qw / DW;
  const lm = pooled('cin-lm', qw, qh), x = lm.getContext('2d');
  const amb = parseColor(ambient);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
  x.globalCompositeOperation = 'source-over'; x.fillStyle = `rgb(${amb[0]},${amb[1]},${amb[2]})`; x.fillRect(0, 0, qw, qh);
  x.globalCompositeOperation = 'lighter';
  x.save(); x.scale(q, q); for (const L of lights) drawLight(x, L, flicker * (L.flicker ?? 1)); x.restore();
  ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(lm, 0, 0, W, H);
  if (glow > 0) {
    const lg = pooled('cin-lg', qw, qh), g = lg.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, qw, qh); g.globalCompositeOperation = 'lighter';
    g.save(); g.scale(q, q); for (const L of lights) drawLight(g, L, glow * flicker * (L.flicker ?? 1)); g.restore();
    ctx.globalCompositeOperation = 'screen'; ctx.drawImage(lg, 0, 0, W, H);
  }
  end(ctx);
}

/**
 * darkMask for planes that must keep transparent areas (so an emissive backdrop - sky, skyline - can show through
 * and stay unlit). drawFn(offCtx) draws the LIT planes on a transparent pooled canvas (e.g. with cam.layer(offCtx,...));
 * they are lit by `lights` (same lights/opts as darkMask) and composited onto ctx source-over.
 * Cost: darkMask + 3 extra full-res blits (~20 ms).
 */
export function darkMaskLayer(ctx, drawFn, lights = [], o = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const off = pooled('cin-lit', W, H), ox = off.getContext('2d');
  ox.clearRect(0, 0, W, H);
  drawFn(ox);
  ox.setTransform(1, 0, 0, 1, 0, 0); ox.globalAlpha = 1; ox.globalCompositeOperation = 'source-over';
  const b = pooled('cin-litb', W, H), bx = b.getContext('2d');
  bx.fillStyle = '#000'; bx.fillRect(0, 0, W, H); bx.drawImage(off, 0, 0);
  darkMask(bx, lights, o);
  bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalAlpha = 1; bx.globalCompositeOperation = 'destination-in'; bx.drawImage(off, 0, 0); bx.globalCompositeOperation = 'source-over';
  const { } = begin(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(b, 0, 0);
  end(ctx);
}

/**
 * Volumetric light shafts (radial zoom blur of an occlusion image) at quarter res.
 * occluder: function(x2d) drawing BLACK silhouettes in design coords, or a canvas whose alpha is the blocker.
 * lightPos: {x,y}. opts: {samples=12, decay=0.93, density=0.85 (how far rays reach toward the frame edge),
 *   intensity=0.5, color='#ffd9a0', radius=360 (emitter glow), source: fn(x2d) draw the emitter in white (default a
 *   radial glow), frame=0, seed=1 (jitter)}.
 */
export function godRays(ctx, occluder, lightPos, o = {}) {
  const { samples = 12, decay = 0.93, density = 0.85, intensity = 0.5, color = '#ffd9a0', radius = 360, frame = 0, seed = 1 } = o;
  const { W, H } = begin(ctx);
  const qw = Math.round(W / 4), qh = Math.round(H / 4), q = qw / DW;
  const occ = pooled('cin-occ', qw, qh), ox = occ.getContext('2d');
  ox.globalCompositeOperation = 'source-over'; ox.fillStyle = '#000'; ox.fillRect(0, 0, qw, qh);
  ox.save(); ox.scale(q, q);
  if (o.source) o.source(ox);
  else { const g = ox.createRadialGradient(lightPos.x, lightPos.y, 0, lightPos.x, lightPos.y, radius); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ox.fillStyle = g; ox.fillRect(lightPos.x - radius, lightPos.y - radius, radius * 2, radius * 2); }
  if (typeof occluder === 'function') occluder(ox);
  else if (occluder) { ox.filter = 'brightness(0)'; ox.drawImage(occluder, 0, 0, DW, DH); ox.filter = 'none'; }
  ox.restore();
  const acc = pooled('cin-acc', qw, qh), ax = acc.getContext('2d');
  ax.globalCompositeOperation = 'source-over'; ax.fillStyle = '#000'; ax.fillRect(0, 0, qw, qh);
  ax.globalCompositeOperation = 'lighter'; ax.imageSmoothingEnabled = true; ax.imageSmoothingQuality = 'low';
  const jit = mulberry32(frameSeed(seed, frame))(), lx = lightPos.x * q, ly = lightPos.y * q;
  const step = density / samples; let wsum = 0; const ws = [];
  for (let i = 0; i < samples; i++) { const w = Math.pow(decay, i); ws.push(w); wsum += w; }
  for (let i = 0; i < samples; i++) {
    const f = 1 - (i + jit) * step;
    ax.globalAlpha = Math.min(1, ws[i] / wsum * 1.6);
    ax.setTransform(f, 0, 0, f, lx * (1 - f), ly * (1 - f));
    ax.drawImage(occ, 0, 0);
  }
  ax.setTransform(1, 0, 0, 1, 0, 0); ax.globalAlpha = 1;
  const c = norm(color);
  ax.globalCompositeOperation = 'multiply'; ax.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; ax.fillRect(0, 0, qw, qh);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = cl(intensity, 0, 1); ctx.drawImage(acc, 0, 0, W, H);
  end(ctx);
}

/**
 * Rim light: a thin bright edge on the side of `path` that faces the light. Draws in the CALLER's transform.
 * lightDir = vector from the subject TOWARD the light, e.g. {x:1,y:-0.4} (light up-right of the subject).
 * opts: {width=5, color='#ffd9a8', alpha=1, soft=true (second wider, fainter pass)}.
 */
export function rimLight(ctx, path, lightDir, o = {}) {
  const { width = 5, color = '#ffd9a8', alpha = 1, soft = true } = o;
  const m = Math.hypot(lightDir.x, lightDir.y) || 1, dx = lightDir.x / m, dy = lightDir.y / m;
  ctx.save();
  ctx.clip(path);
  ctx.globalCompositeOperation = 'screen';
  const passes = soft ? [[width * 2.6, 0.28], [width, 1]] : [[width, 1]];
  for (const [w, a] of passes) {
    const cut = new Path2DCtor();
    cut.rect(-20000, -20000, 40000, 40000);
    cut.addPath(path, { a: 1, b: 0, c: 0, d: 1, e: -dx * w, f: -dy * w });
    ctx.globalAlpha = (ctx.globalAlpha || 1) * 1; ctx.fillStyle = rgba(color, a * alpha);
    ctx.fill(cut, 'evenodd');
  }
  ctx.restore();
}

/**
 * Cast a shadow of a standing polygon (design coords, y down) onto a ground line.
 * light: {x,y} point light (shadow stretches away from it) or {dir:[dx,dy]} directional: the screen-space
 * direction the shadow falls per unit of height (dy>0 = toward the camera).
 * ground: {y, squash=0.35 (how much the floor foreshortens depth)}. opts: {alpha=0.55, softness=6, color='#000'}.
 * Draws in the caller's transform.
 */
export function castShadow(ctx, polygon, light, ground, o = {}) {
  const { alpha = 0.55, softness = 6, color = '#000' } = o;
  const gy = ground.y, sq = ground.squash ?? 0.35;
  const pts = polygon.map(([px, py]) => {
    const h = Math.max(0, gy - py);
    if (light.dir) return [px + light.dir[0] * h * 0.9, gy + light.dir[1] * h * sq];
    const H = Math.max(40, gy - light.y), r = Math.min(h / Math.max(20, H - h), 4);
    const lfy = light.floorY ?? gy + 90;
    const fx = px, fy = gy;
    return [fx + (fx - light.x) * r, fy + (fy - lfy) * r * sq];
  });
  ctx.save();
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  const steps = softness > 1 ? 3 : 1;
  for (let i = 0; i < steps; i++) {
    const grow = softness * (steps - 1 - i) * 0.7;
    ctx.globalAlpha = alpha / steps * (steps === 1 ? 1 : 1.5);
    path(); ctx.lineWidth = Math.max(0.1, grow * 2); ctx.fill(); if (grow > 0) ctx.stroke();
  }
  ctx.restore();
  return pts;
}

/** Specular glint: a point sparkle with a long horizontal anamorphic streak. opts: {size=40, color, alpha, rot, t}. */
export function glint(ctx, x, y, o = {}) {
  const { size = 40, color = '#fff6e0', alpha = 1, rot = 0, t = 0 } = o;
  const tw = 0.85 + 0.15 * Math.sin(t * 9 + x * 0.013 + y * 0.007), s = size * tw;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalCompositeOperation = 'lighter';
  const c = parseColor(color), col = (a) => `rgba(${c[0]},${c[1]},${c[2]},${(a * alpha).toFixed(3)})`;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s); g.addColorStop(0, col(1)); g.addColorStop(0.2, col(0.55)); g.addColorStop(1, col(0));
  ctx.fillStyle = g; ctx.fillRect(-s, -s, s * 2, s * 2);
  for (const [len, th, a] of [[s * 3.2, s * 0.07, 0.8], [s * 1.5, s * 0.05, 0.6]]) {
    const hg = ctx.createLinearGradient(-len, 0, len, 0); hg.addColorStop(0, col(0)); hg.addColorStop(0.5, col(a)); hg.addColorStop(1, col(0));
    ctx.fillStyle = hg; ctx.fillRect(-len, -th, len * 2, th * 2);
    ctx.save(); ctx.rotate(Math.PI / 2); ctx.fillRect(-len * 0.45, -th, len * 0.9, th * 2); ctx.restore();
  }
  ctx.restore();
}
