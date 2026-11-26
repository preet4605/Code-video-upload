// cinema/texture: seeded noise (own implementation) + cached tileable surface textures.
// - hash/value noise: original code. noise1 = smooth 1D value noise (camera handheld).
// - simplex2: 2D simplex noise after Stefan Gustavson, "Simplex noise demystified" (2005), public-domain
//   reference algorithm, re-implemented here with a seeded permutation table.
// Tiles are 256x256 (stars/snow 512) generated ONCE per (name, seed, options) with a per-pixel loop, then cached;
// per-frame use is createPattern / drawImage only. Greyscale-centred tiles are meant for overlay / soft-light /
// multiply blending over flat fills; stars/snow/frost are transparent-background sprites for source-over/screen.
import { createCanvas, mulberry32, DW, DH, cl, parseColor } from './util.mjs';

const hashInt = (x, y, s) => {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0; h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Smooth 1D value noise in [-1,1]. */
export function noise1(seed, x) {
  const i = Math.floor(x), f = x - i;
  const a = hashInt(i, 0, seed) * 2 - 1, b = hashInt(i + 1, 0, seed) * 2 - 1;
  return a + (b - a) * fade(f);
}
/** Value noise 2D in [0,1]. period>0 makes it tile with that lattice period. */
export function valueNoise(seed, x, y, period = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const w = (n) => (period ? ((n % period) + period) % period : n);
  const a = hashInt(w(xi), w(yi), seed), b = hashInt(w(xi + 1), w(yi), seed);
  const c = hashInt(w(xi), w(yi + 1), seed), d = hashInt(w(xi + 1), w(yi + 1), seed);
  const u = fade(xf), v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Fractal value noise 0..1. period = base lattice period (doubles each octave) so the result tiles. */
export function fbm(seed, x, y, octaves = 4, period = 0, gain = 0.5) {
  let amp = 0.5, sum = 0, norm = 0, f = 1, p = period;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(seed + o * 101, x * f, y * f, p); norm += amp;
    amp *= gain; f *= 2; p = p ? p * 2 : 0;
  }
  return sum / norm;
}

const G2 = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const _perm = new Map();
function perm(seed) {
  let p = _perm.get(seed);
  if (!p) {
    const r = mulberry32(seed ^ 0xabcdef), a = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    p = new Uint8Array(512); for (let i = 0; i < 512; i++) p[i] = a[i & 255];
    _perm.set(seed, p);
  }
  return p;
}
/** 2D simplex noise in [-1,1]. */
export function simplex2(seed, xin, yin) {
  const p = perm(seed), F2 = 0.5 * (Math.sqrt(3) - 1), Gc = (3 - Math.sqrt(3)) / 6;
  const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s), t = (i + j) * Gc;
  const x0 = xin - (i - t), y0 = yin - (j - t);
  const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + Gc, y1 = y0 - j1 + Gc, x2 = x0 - 1 + 2 * Gc, y2 = y0 - 1 + 2 * Gc;
  const ii = i & 255, jj = j & 255;
  const corner = (x, y, gi) => { let tt = 0.5 - x * x - y * y; if (tt < 0) return 0; tt *= tt; const g = G2[gi & 7]; return tt * tt * (g[0] * x + g[1] * y); };
  return 70 * (corner(x0, y0, p[ii + p[jj]]) + corner(x1, y1, p[ii + i1 + p[jj + j1]]) + corner(x2, y2, p[ii + 1 + p[jj + 1]]));
}
export function simplexFbm(seed, x, y, octaves = 4) {
  let a = 0.5, s = 0, f = 1, n = 0;
  for (let o = 0; o < octaves; o++) { s += a * simplex2(seed + o, x * f, y * f); n += a; a *= 0.5; f *= 2; }
  return s / n;
}

// ---------------- tiles ----------------
const TILE = 256;
const _tiles = new Map();
const lumaPx = (img, i, v, tint = null) => {
  const g = cl(v, 0, 1) * 255;
  if (tint) { img[i] = g * tint[0] / 255; img[i + 1] = g * tint[1] / 255; img[i + 2] = g * tint[2] / 255; }
  else { img[i] = img[i + 1] = img[i + 2] = g; }
  img[i + 3] = 255;
};

const GEN = {
  // soft mottled wall: low-frequency blotches + fine grit, grey-centred
  plaster(img, S, o) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const u = x / TILE, v = y / TILE;
      const b = fbm(S, u * 4, v * 4, 4, 4) - 0.5, g = valueNoise(S + 9, u * 128, v * 128, 128) - 0.5;
      lumaPx(img, (y * TILE + x) * 4, 0.5 + b * 0.9 + g * 0.28);
    }
  },
  // long-grain planks: stretched noise along x, plank seams every 64 px
  wood(img, S) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const u = x / TILE, v = y / TILE, plank = Math.floor(y / 64);
      const off = hashInt(plank, 3, S) * 8;
      const ring = Math.sin((fbm(S, (u + off) * 2, v * 16, 3, 2) * 14 + v * 40) * 1.0) * 0.5 + 0.5;
      const grain = valueNoise(S + 5, u * 8 + off, v * 128, 128) - 0.5;
      const seam = Math.min(y % 64, 64 - (y % 64)) < 1.5 ? -0.35 : 0;
      lumaPx(img, (y * TILE + x) * 4, 0.5 + (ring - 0.5) * 0.35 + grain * 0.3 + seam + (hashInt(plank, 8, S) - 0.5) * 0.18);
    }
  },
  // irregular flagstones via cellular distance, mottled, dark cracks
  stone(img, S) {
    const N = 6, pts = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) pts.push([(i + hashInt(i, j, S)) / N, (j + hashInt(i, j, S + 1)) / N, hashInt(i, j, S + 2)]);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const u = x / TILE, v = y / TILE; let d1 = 9, d2 = 9, id = 0;
      for (const p of pts) for (const ox of [-1, 0, 1]) for (const oy of [-1, 0, 1]) {
        const dx = u - (p[0] + ox), dy = v - (p[1] + oy), d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; id = p[2]; } else if (d < d2) d2 = d;
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1);
      const crack = edge < 0.012 ? -0.35 : edge < 0.03 ? -0.12 : 0;
      lumaPx(img, (y * TILE + x) * 4, 0.5 + (id - 0.5) * 0.25 + (fbm(S + 4, u * 8, v * 8, 4, 8) - 0.5) * 0.5 + crack);
    }
  },
  // running-bond bricks with mortar and per-brick tone
  brick(img, S) {
    const bw = 64, bh = 32;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const row = Math.floor(y / bh), xo = (x + (row % 2) * (bw / 2)) % TILE, col = Math.floor(xo / bw);
      const mx = xo % bw, my = y % bh, mortar = mx < 3 || my < 3;
      const tone = hashInt(col, row, S) - 0.5;
      const g = (fbm(S + 2, x / 32, y / 32, 3, 8) - 0.5) * 0.35 + (hashInt(x, y, S + 7) - 0.5) * 0.12;
      lumaPx(img, (y * TILE + x) * 4, mortar ? 0.32 + g * 0.5 : 0.62 + tone * 0.35 + g);
    }
  },
  // woven cloth: crossing threads
  fabric(img, S) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const th = 4, a = Math.sin((x / th) * Math.PI), b = Math.sin((y / th) * Math.PI);
      const over = (Math.floor(x / th) + Math.floor(y / th)) % 2 === 0;
      const w = over ? a * 0.5 + 0.5 : b * 0.5 + 0.5;
      lumaPx(img, (y * TILE + x) * 4, 0.5 + (w - 0.5) * 0.45 + (valueNoise(S, x / 2, y / 2, 128) - 0.5) * 0.2);
    }
  },
  // transparent sprite: sparse points, a few with a soft halo, colour-varied
  stars(img, S, o) {
    const r = mulberry32(S), n = o.count ?? 90, sz = o.size;
    for (let i = 0; i < n; i++) {
      const cx = r() * sz, cy = r() * sz, br = Math.pow(r(), 2.2), tint = r();
      const R = 0.7 + br * 1.8, col = tint < 0.2 ? [255, 214, 180] : tint < 0.4 ? [180, 205, 255] : [255, 255, 255];
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const X = Math.round(cx) + dx, Y = Math.round(cy) + dy; if (X < 0 || Y < 0 || X >= sz || Y >= sz) continue;
        const d = Math.hypot(X - cx, Y - cy), a = Math.max(0, 1 - d / R) * (0.35 + 0.65 * br);
        const k = (Y * sz + X) * 4; const na = Math.min(255, img[k + 3] + a * 255);
        if (a > 0 && na >= img[k + 3]) { img[k] = col[0]; img[k + 1] = col[1]; img[k + 2] = col[2]; img[k + 3] = na; }
      }
    }
  },
  snow(img, S, o) {
    const r = mulberry32(S), n = o.count ?? 70, sz = o.size;
    for (let i = 0; i < n; i++) {
      const cx = r() * sz, cy = r() * sz, R = 1 + r() * 2.6, br = 0.45 + r() * 0.55;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const X = ((Math.round(cx) + dx) % sz + sz) % sz, Y = ((Math.round(cy) + dy) % sz + sz) % sz;
        const a = Math.pow(Math.max(0, 1 - Math.hypot(Math.round(cx) + dx - cx, Math.round(cy) + dy - cy) / R), 1.4) * br;
        const k = (Y * sz + X) * 4; if (a * 255 > img[k + 3]) { img[k] = 240; img[k + 1] = 246; img[k + 2] = 255; img[k + 3] = a * 255; }
      }
    }
  },
  // crystalline frost: ridged noise, alpha-coded, cool white
  frost(img, S) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const u = x / TILE, v = y / TILE;
      const r1 = 1 - Math.abs(fbm(S, u * 6, v * 6, 4, 6) * 2 - 1), r2 = 1 - Math.abs(valueNoise(S + 3, u * 24, v * 24, 24) * 2 - 1);
      const a = cl(Math.pow(r1, 5) * 0.8 + Math.pow(r2, 7) * 0.5 + (fbm(S + 8, u * 3, v * 3, 3, 3) - 0.5) * 0.4, 0, 1);
      const k = (y * TILE + x) * 4; img[k] = 215; img[k + 1] = 235; img[k + 2] = 255; img[k + 3] = a * 255;
    }
  },
};
export const TEXTURE_NAMES = Object.keys(GEN);
const SPRITES = new Set(['stars', 'snow']);

/** Cached tile canvas. opts: {seed, tint:[r,g,b]|'#hex' (multiplies greyscale tiles), count (stars/snow)} */
export function tile(name, opts = {}) {
  if (!GEN[name]) throw new Error(`unknown texture "${name}" (have ${TEXTURE_NAMES.join(', ')})`);
  const seed = opts.seed ?? 1337;
  const tint = opts.tint ? parseColor(opts.tint).slice(0, 3) : null;
  const key = `${name}|${seed}|${tint ? tint.join(',') : ''}|${opts.count ?? ''}`;
  let c = _tiles.get(key);
  if (c) return c;
  const size = SPRITES.has(name) ? 512 : TILE;
  c = createCanvas(size, size);
  const x = c.getContext('2d'), id = x.createImageData(size, size);
  if (SPRITES.has(name)) GEN[name](id.data, seed, { ...opts, size });
  else {
    GEN[name](id.data, seed, opts);
    if (tint) for (let i = 0; i < id.data.length; i += 4) { id.data[i] = id.data[i] * tint[0] / 255; id.data[i + 1] = id.data[i + 1] * tint[1] / 255; id.data[i + 2] = id.data[i + 2] * tint[2] / 255; }
  }
  x.putImageData(id, 0, 0);
  _tiles.set(key, c);
  return c;
}

/** CanvasPattern ('repeat') for the tile. Use ctx.translate/scale before fillRect to position/scale it. */
export function pattern(ctx, name, opts = {}) { return ctx.createPattern(tile(name, opts), 'repeat'); }

/**
 * Fill a design-space rect with a texture. opts: {blend:'overlay', alpha:1, scale:1, ox, oy, seed, tint}.
 * Pattern space is anchored to (ox,oy) so the texture sticks to the surface it is painted on.
 */
export function fillTexture(ctx, name, rect, opts = {}) {
  const [x, y, w, h] = rect;
  ctx.save();
  ctx.globalCompositeOperation = opts.blend ?? (SPRITES.has(name) || name === 'frost' ? 'source-over' : 'overlay');
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.fillStyle = pattern(ctx, name, opts);
  ctx.translate(opts.ox ?? x, opts.oy ?? y); ctx.scale(opts.scale ?? 1, opts.scale ?? 1);
  const s = opts.scale ?? 1;
  ctx.fillRect((x - (opts.ox ?? x)) / s, (y - (opts.oy ?? y)) / s, w / s, h / s);
  ctx.restore();
}
export const _internal = { hashInt, DW, DH };
