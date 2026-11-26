// cinema/atmos: fog bands, bloom, halation, depth-of-field blur, heat haze. Heavy work runs at quarter/half
// resolution and is composited back; no per-pixel JS per frame (the fog noise tile is generated once and cached).
import { createCanvas, pooled, begin, end, snapshot, parseColor, rgba, cl, DW, DH } from './util.mjs';
import { fbm } from './texture.mjs';

// ---- fog tile: tileable fbm, white with alpha = cloud density (cached) ----
const _fog = new Map();
function fogTile(seed, color) {
  const key = `${seed}|${color}`;
  let c = _fog.get(key);
  if (c) return c;
  const N = 256; c = createCanvas(N, N);
  const x = c.getContext('2d'), id = x.createImageData(N, N), col = parseColor(color);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const v = fbm(seed, i / N * 4, j / N * 4, 5, 4);
    const a = cl((v - 0.30) / 0.45, 0, 1);
    const k = (j * N + i) * 4; id.data[k] = col[0]; id.data[k + 1] = col[1]; id.data[k + 2] = col[2]; id.data[k + 3] = a * a * (3 - 2 * a) * 255;
  }
  x.putImageData(id, 0, 0); _fog.set(key, c); return c;
}

/**
 * Layered ground fog: `depthBands` drifting noise bands (far bands small, slow, faint; near bands big, fast, thick)
 * concentrated around `horizon` (fraction of frame height). Built at quarter res, ONE upscaled blit.
 * opts: {depthBands=3, density=0.35, color='#8a9bb5', t=0, horizon=0.62, height=0.38, seed=11, wind=1}
 */
export function fog(ctx, o = {}) {
  const { depthBands = 3, density = 0.35, color = '#8a9bb5', t = 0, horizon = 0.62, height = 0.38, seed = 11, wind = 1 } = o;
  const { W, H } = begin(ctx);
  const qw = Math.round(W / 4), qh = Math.round(H / 4), kk = qw / DW;
  const tile = fogTile(seed, color);
  const acc = pooled('cin-fogacc', qw, qh), ax = acc.getContext('2d');
  ax.clearRect(0, 0, qw, qh);
  const band = pooled('cin-fogband', qw, qh), x = band.getContext('2d');
  for (let b = 0; b < depthBands; b++) {
    const f = depthBands === 1 ? 1 : b / (depthBands - 1);     // 0 far .. 1 near
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, qw, qh);
    const sc = (1.1 + f * 2.2) * kk * 1.4;                      // tile scale grows toward the camera
    const size = 256 * sc, off = (t * wind * (6 + f * 26) * kk + b * 97 * kk) % size;
    const yo = (b * 53 * kk) % size;
    for (let ty = -size + (-yo % size); ty < qh; ty += size) for (let tx = -size - off; tx < qw; tx += size) x.drawImage(tile, tx, ty, size + 0.5, size + 0.5);
    const cy = (horizon + (f - 0.5) * 0.10) * qh, ext = height * qh * (0.6 + 0.6 * f);
    x.globalCompositeOperation = 'destination-in';
    const g = x.createLinearGradient(0, cy - ext, 0, cy + ext);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, qw, qh); x.globalCompositeOperation = 'source-over';
    ax.globalAlpha = cl(density * (0.5 + 0.7 * f), 0, 1); ax.drawImage(band, 0, 0);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(acc, 0, 0, W, H);
  end(ctx);
}

function brightPassFrom(q, threshold, key) {
  const out = pooled(key, q.width, q.height), x = out.getContext('2d');
  const c = 3, a = (0.5 * (1 - 1 / c)) / Math.max(0.05, threshold);
  x.globalCompositeOperation = 'copy'; x.filter = `brightness(${a.toFixed(3)}) contrast(${c})`;
  x.drawImage(q, 0, 0); x.filter = 'none'; x.globalCompositeOperation = 'source-over';
  return out;
}
/** Bright-pass at quarter res (soft knee: 0 below threshold, ~0.67 at white). Returns a pooled canvas. */
export function brightPass(ctx, threshold = 0.6, key = 'cin-bp') { return brightPassFrom(snapshot(ctx, 0.25, 'cin-snap'), threshold, key); }

// blurred, optionally tinted copy of a bright-pass canvas, written into target (additively)
function blurInto(target, src, blurPx, alpha, tint) {
  const t = pooled('cin-blur', src.width, src.height), x = t.getContext('2d');
  x.globalCompositeOperation = 'copy'; x.filter = `blur(${blurPx.toFixed(2)}px)`; x.drawImage(src, 0, 0); x.filter = 'none';
  // the blur leaves translucent borders: put it on black first so the tint multiply cannot leak at the edges
  x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#000'; x.fillRect(0, 0, t.width, t.height);
  if (tint) { x.globalCompositeOperation = 'multiply'; x.fillStyle = tint; x.fillRect(0, 0, t.width, t.height); }
  x.globalCompositeOperation = 'source-over';
  const tx = target.getContext('2d'); tx.globalCompositeOperation = 'lighter'; tx.globalAlpha = cl(alpha, 0, 1); tx.drawImage(t, 0, 0); tx.globalAlpha = 1;
}
export function flushAdd(ctx, glowCanvas) {
  const { W, H } = begin(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(glowCanvas, 0, 0, W, H);
  end(ctx);
}
/**
 * Bloom and/or halation in ONE pass (a single full-res blit). opts: {bloom: {threshold,radius,strength}|false,
 * halation: {threshold,radius,strength,color}|false, snap: optional shared quarter-res snapshot,
 * addq: optional quarter-res additive accumulator canvas (then nothing is drawn to ctx; the caller flushes it with flushAdd)}.
 */
export function glow(ctx, o = {}) {
  const q = o.snap ?? snapshot(ctx, 0.25, 'cin-snap');
  const k = q.width / DW, qw = q.width, qh = q.height; // blur radii are in design px; work at the snapshot's resolution
  const acc = o.addq ?? pooled('cin-glow', qw, qh), ax = acc.getContext('2d');
  if (!o.addq) { ax.globalCompositeOperation = 'source-over'; ax.fillStyle = '#000'; ax.fillRect(0, 0, qw, qh); }
  if (o.bloom) { const b = o.bloom, bp = brightPassFrom(q, b.threshold ?? 0.6, 'cin-bp'); blurInto(acc, bp, Math.max(0.4, (b.radius ?? 40) * k), b.strength ?? 0.6, null); }
  if (o.halation) { const h = o.halation, bp = brightPassFrom(q, h.threshold ?? 0.8, 'cin-bp2'); blurInto(acc, bp, Math.max(0.4, (h.radius ?? 70) * k), h.strength ?? 0.5, h.color ?? '#ff5a1e'); }
  if (!o.addq) flushAdd(ctx, acc);
}
/** Glow around highlights. opts: {threshold=0.6, radius=40 (design px), strength=0.6}. */
export function bloom(ctx, o = {}) { glow(ctx, { bloom: o }); }
/** Film halation: warm red-orange fringe bleeding from very bright areas. opts: {threshold=0.8, radius=70, strength=0.5, color}. */
export function halation(ctx, o = {}) { glow(ctx, { halation: o }); }

/**
 * Depth-of-field: blur a layer canvas according to |1/depth - 1/focusDepth|. Returns a canvas (the input itself when
 * in focus). opts: {px} fixed blur px (device px) overriding the depth rule; {strength=14} px per unit of 1/d difference.
 * Large blurs are done at half res (the result is soft anyway).
 */
export function depthBlur(layerCanvas, depth, focusDepth = 1, o = {}) {
  const px = o.px ?? Math.abs(1 / depth - 1 / focusDepth) * (o.strength ?? 14) * (layerCanvas.width / DW);
  if (px < 0.4) return layerCanvas;
  const W = layerCanvas.width, H = layerCanvas.height;
  const out = pooled('cin-dof', W, H), x = out.getContext('2d');
  if (px > 6) {
    const h = pooled('cin-dof-h', W / 2, H / 2), hx = h.getContext('2d');
    hx.globalCompositeOperation = 'copy'; hx.filter = `blur(${(px / 2).toFixed(2)}px)`; hx.drawImage(layerCanvas, 0, 0, W / 2, H / 2); hx.filter = 'none';
    x.globalCompositeOperation = 'copy'; x.imageSmoothingEnabled = true; x.drawImage(h, 0, 0, W, H);
  } else { x.globalCompositeOperation = 'copy'; x.filter = `blur(${px.toFixed(2)}px)`; x.drawImage(layerCanvas, 0, 0); x.filter = 'none'; }
  x.globalCompositeOperation = 'source-over';
  return out;
}

/**
 * Heat-haze shimmer: horizontal strips of the frame displaced by travelling sines, strongest near `centre`
 * (fraction of height). opts: {t, amp=4 (design px), strip=8, centre=0.55, spread=0.3, speed=1}.
 */
export function heatHaze(ctx, o = {}) {
  const { t = 0, amp = 4, strip = 8, centre = 0.55, spread = 0.3, speed = 1 } = o;
  const { W, H, k } = begin(ctx);
  const src = pooled('cin-haze', W, H), sx = src.getContext('2d');
  sx.globalCompositeOperation = 'copy'; sx.drawImage(ctx.canvas, 0, 0); sx.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const st = Math.max(2, Math.round(strip * k));
  ctx.globalCompositeOperation = 'source-over';
  for (let y = 0; y < H; y += st) {
    const near = 0.25 + 0.75 * Math.exp(-Math.pow((y / H - centre) / spread, 2));
    const dx = (Math.sin(y / k * 0.05 + t * 3.1 * speed) + 0.6 * Math.sin(y / k * 0.021 - t * 1.7 * speed)) * amp * k * near;
    ctx.drawImage(src, 0, y, W, st, dx, y, W, st);
  }
  end(ctx);
}
export { rgba };
