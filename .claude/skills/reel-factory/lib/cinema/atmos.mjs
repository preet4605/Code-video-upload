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
 * concentrated around `horizon` (fraction of frame height). Drawn at half res then upscaled.
 * opts: {depthBands=3, density=0.35, color='#8a9bb5', t=0, horizon=0.62, height=0.38, seed=11, wind=1}
 */
export function fog(ctx, o = {}) {
  const { depthBands = 3, density = 0.35, color = '#8a9bb5', t = 0, horizon = 0.62, height = 0.38, seed = 11, wind = 1 } = o;
  const { W, H, k } = begin(ctx);
  const hw = Math.round(W / 2), hh = Math.round(H / 2), kk = hw / DW;
  const tile = fogTile(seed, color);
  for (let b = 0; b < depthBands; b++) {
    const f = depthBands === 1 ? 1 : b / (depthBands - 1);     // 0 far .. 1 near
    const band = pooled(`cin-fog${b}`, hw, hh), x = band.getContext('2d');
    x.clearRect(0, 0, hw, hh);
    const sc = (1.1 + f * 2.2) * kk * 1.4;                      // tile scale grows toward the camera
    const size = 256 * sc, off = (t * wind * (6 + f * 26) * kk + b * 97 * kk) % size;
    const yo = (b * 53 * kk) % size;
    x.globalAlpha = 1;
    for (let ty = -size + (-yo % size); ty < hh; ty += size) for (let tx = -size - off; tx < hw; tx += size) x.drawImage(tile, tx, ty, size + 0.5, size + 0.5);
    // vertical envelope around the horizon (far bands sit nearer the horizon line)
    const cy = (horizon + (f - 0.5) * 0.10) * hh, ext = height * hh * (0.6 + 0.6 * f);
    x.globalCompositeOperation = 'destination-in';
    const g = x.createLinearGradient(0, cy - ext, 0, cy + ext);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, hw, hh); x.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = cl(density * (0.5 + 0.7 * f), 0, 1);
    ctx.drawImage(band, 0, 0, DW, DH);
  }
  end(ctx);
}

/** Bright-pass at quarter res (soft knee). Returns a pooled canvas; pass it to bloom/halation to share the work. */
export function brightPass(ctx, threshold = 0.6, key = 'cin-bp') {
  const q = snapshot(ctx, 0.25, 'cin-snap');
  const out = pooled(key, q.width, q.height), x = out.getContext('2d');
  const c = 3, a = (0.5 * (1 - 1 / c)) / Math.max(0.05, threshold);
  x.globalCompositeOperation = 'copy'; x.filter = `brightness(${a.toFixed(3)}) contrast(${c})`;
  x.drawImage(q, 0, 0); x.filter = 'none'; x.globalCompositeOperation = 'source-over';
  return out;
}

function addBlurred(ctx, src, blurPx, mode, alpha, tint = null) {
  const { W, H } = begin(ctx);
  const t = pooled('cin-blur', src.width, src.height), x = t.getContext('2d');
  x.globalCompositeOperation = 'copy'; x.filter = `blur(${blurPx.toFixed(2)}px)`; x.drawImage(src, 0, 0); x.filter = 'none';
  if (tint) { x.globalCompositeOperation = 'multiply'; x.fillStyle = tint; x.fillRect(0, 0, t.width, t.height); x.globalCompositeOperation = 'source-over'; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = mode; ctx.globalAlpha = cl(alpha, 0, 1); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(t, 0, 0, W, H);
  end(ctx);
}

/** Glow around highlights. opts: {threshold=0.6, radius=40 (design px), strength=0.6, bright}. */
export function bloom(ctx, o = {}) {
  const { threshold = 0.6, radius = 40, strength = 0.6 } = o;
  const k = ctx.canvas.width / DW;
  const bp = o.bright ?? brightPass(ctx, threshold);
  addBlurred(ctx, bp, Math.max(0.5, radius * k * 0.25), 'screen', strength);
}

/** Film halation: warm red-orange fringe bleeding from very bright areas. opts: {threshold=0.8, radius=70, strength=0.5, color}. */
export function halation(ctx, o = {}) {
  const { threshold = 0.8, radius = 70, strength = 0.5, color = '#ff5a1e' } = o;
  const k = ctx.canvas.width / DW;
  const bp = o.bright ?? brightPass(ctx, threshold, 'cin-bp2');
  addBlurred(ctx, bp, Math.max(0.5, radius * k * 0.25), 'screen', strength, color);
}

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
  ctx.globalCompositeOperation = 'copy';
  for (let y = 0; y < H; y += st) {
    const near = 0.25 + 0.75 * Math.exp(-Math.pow((y / H - centre) / spread, 2));
    const dx = (Math.sin(y / k * 0.05 + t * 3.1 * speed) + 0.6 * Math.sin(y / k * 0.021 - t * 1.7 * speed)) * amp * k * near;
    ctx.drawImage(src, 0, y, W, st, dx, y, W, st);
  }
  end(ctx);
}
export { rgba };
