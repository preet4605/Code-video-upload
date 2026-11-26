// cinema/film: the photographic layer. Every effect is a handful of full-frame blits or fills (no per-pixel loops per
// frame). Grain is a pre-generated seeded tile moved by a seeded per-frame offset. All of it is a pure function of
// (seed, frame/t): same inputs, same pixels.
import { Path2D } from '@napi-rs/canvas';
import { createCanvas, pooled, begin, end, snapshot, parseColor, rgba, cl, DW, DH, frameSeed, mulberry32 } from './util.mjs';
import { noise1 } from './texture.mjs';

// ---------- grain ----------
// One noise canvas per (seed, size) generated ONCE (a per-pixel loop at cache time), padded so a per-frame seeded
// offset + flip can slide over the frame: per frame it is a single drawImage.
const _grain = new Map();
const PAD = 256;
function grainCanvas(seed, W, H, scale) {
  const key = `${seed}|${W}x${H}|${scale}`;
  let c = _grain.get(key);
  if (c) return c;
  const nw = Math.ceil((W + PAD) / scale), nh = Math.ceil((H + PAD) / scale);
  const raw = createCanvas(nw, nh), x = raw.getContext('2d'), id = x.createImageData(nw, nh), r = mulberry32(seed ^ 0x51ed);
  for (let i = 0; i < nw * nh; i++) {
    const v = 128 + ((r() + r() + r()) / 3 - 0.5) * 2 * 120; // ~gaussian around mid grey
    id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  c = createCanvas(W + PAD, H + PAD);
  const cx = c.getContext('2d'); cx.imageSmoothingEnabled = true; cx.drawImage(raw, 0, 0, W + PAD, H + PAD);
  _grain.set(key, c); return c;
}
/**
 * Film grain: mid-grey noise, per-frame seeded offset/flip, blended overlay (true blacks and pure whites stay
 * clean, mid-tones carry the grain). opts: {frame=0, seed=1, amount=0.35, size=1.3 (grain size in px)}.
 */
export function grain(ctx, o = {}) {
  const { frame = 0, seed = 1, amount = 0.35, size = 1.3 } = o;
  const { W, H, k } = begin(ctx);
  const g = grainCanvas(seed, W, H, Math.max(0.5, size * k));
  const rnd = mulberry32(frameSeed(seed, frame)), ox = rnd() * PAD, oy = rnd() * PAD, fx = rnd() < 0.5, fy = rnd() < 0.5;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = cl(amount * 0.55, 0, 1);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  ctx.translate(fx ? W + ox : -ox, fy ? H + oy : -oy); ctx.scale(fx ? -1 : 1, fy ? -1 : 1);
  ctx.drawImage(g, 0, 0);
  ctx.restore();
  end(ctx);
}

// Vignettes are cached as a full-size canvas per parameter set: a radial-gradient fill costs ~15 ms per frame,
// a cached blit ~7 ms.
const _vig = new Map();
/** Radial darkening. opts: {strength=0.6, radius=1.0 (1 = reaches corners), centerX=.5, centerY=.46, color='#000', hardness=0.55}. */
export function vignette(ctx, o = {}) {
  const { strength = 0.6, radius = 1.0, centerX = 0.5, centerY = 0.46, color = '#000', hardness = 0.55 } = o;
  const W = ctx.canvas.width, H = ctx.canvas.height, key = [W, H, strength, radius, centerX, centerY, color, hardness].join('|');
  let c = _vig.get(key);
  if (!c) {
    c = createCanvas(W, H);
    const x = c.getContext('2d'), k = W / DW, cx = centerX * W, cy = centerY * H, R = Math.hypot(DW, DH) * 0.5 * radius * k;
    const g = x.createRadialGradient(cx, cy, R * 0.25, cx, cy, R);
    g.addColorStop(0, rgba(color, 0)); g.addColorStop(hardness, rgba(color, strength * 0.35)); g.addColorStop(1, rgba(color, strength));
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    if (_vig.size > 8) _vig.clear();
    _vig.set(key, c);
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.drawImage(c, 0, 0); ctx.restore();
}

/**
 * Lateral chromatic aberration (fringes grow
 * toward the edges). Only the left/right 20% strips are processed (red pushed outward, blue inward), at quarter
 * res. opts: {px=3 (shift, design px), snap}.
 */
export function chromaticAberration(ctx, o = {}) {
  const { px = 3 } = o;
  if (!(px > 0.2)) return;
  const { W, H } = begin(ctx);
  const hw = Math.round(W / 4), hh = Math.round(H / 4);
  const src = o.snap ?? snapshot(ctx, 0.25, 'cin-snap');
  const FEATHER = 0.22; // fraction of the width on each side that carries the effect (strongest at the very edge)
  const ramp = (x) => { const g = x.createLinearGradient(0, 0, hw, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(FEATHER, 'rgba(0,0,0,0)'); g.addColorStop(1 - FEATHER, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); return g; };
  const chan = (key, col) => {
    const c = pooled(key, hw, hh), x = c.getContext('2d');
    x.globalCompositeOperation = 'copy'; x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, hw, hh);
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = ramp(x); x.fillRect(0, 0, hw, hh); // premultiplied: colour fades out with the ramp
    x.globalCompositeOperation = 'source-over';
    return c;
  };
  const R = chan('cin-ca-r', '#ff0000'), B = chan('cin-ca-b', '#0000ff');
  const d = px * (W / DW), sw = Math.round(hw * FEATHER), dw = Math.round(W * FEATHER);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
  // keep green everywhere, but fade the red/blue of the ORIGINAL out toward the edges (multiply by a feathered colour)
  const mg = ctx.createLinearGradient(0, 0, W, 0);
  mg.addColorStop(0, '#00ff00'); mg.addColorStop(FEATHER, '#ffffff'); mg.addColorStop(1 - FEATHER, '#ffffff'); mg.addColorStop(1, '#00ff00');
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = mg;
  ctx.fillRect(0, 0, dw, H); ctx.fillRect(W - dw, 0, dw, H);
  // ...and add the red plane pushed outward and the blue plane pushed inward, with the same feather
  ctx.globalCompositeOperation = 'lighter';
  for (const [cv, out] of [[R, 1], [B, -1]]) {
    ctx.drawImage(cv, 0, 0, sw, hh, -out * d, 0, dw, H);
    ctx.drawImage(cv, hw - sw, 0, sw, hh, W - dw + out * d, 0, dw, H);
  }
  end(ctx);
}

/** Pure gate-weave offset (design px / radians) for time t. */
export function gateWeaveOffset(t, seed = 1, amp = 1) {
  return { x: noise1(seed * 3 + 1, t * 9) * 1.6 * amp, y: noise1(seed * 3 + 2, t * 11) * 1.2 * amp, rot: noise1(seed * 3 + 3, t * 5) * 0.0008 * amp };
}
/** Projector gate weave: whole frame jitters by ~1-2 px with a 1.5% overscan so no edge shows. */
export function gateWeave(ctx, o = {}) {
  const { t = 0, seed = 1, amp = 1 } = o;
  const { W, H, k } = begin(ctx);
  const off = gateWeaveOffset(t, seed, amp);
  const src = pooled('cin-gw', W, H), x = src.getContext('2d');
  x.globalCompositeOperation = 'copy'; x.drawImage(ctx.canvas, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(W / 2 + off.x * k, H / 2 + off.y * k); ctx.rotate(off.rot); ctx.scale(1.015, 1.015); ctx.translate(-W / 2, -H / 2);
  ctx.globalCompositeOperation = 'copy'; ctx.drawImage(src, 0, 0);
  end(ctx);
}

/** Pure flicker multiplier around 0 (-amount..amount) at time t. */
export function flickerValue(t, seed = 1, amount = 0.06, rate = 14) { return (noise1(seed * 5 + 1, t * rate) * 0.7 + noise1(seed * 5 + 2, t * rate * 2.7) * 0.3) * amount; }
/** Exposure flicker: brief +/- exposure pulses (never a strobe at sane amounts). opts: {t, seed, amount=0.06, rate=14}. */
export function flicker(ctx, o = {}) {
  const { t = 0, seed = 1, amount = 0.06, rate = 14 } = o;
  const v = flickerValue(t, seed, amount, rate);
  const { W, H } = begin(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (v >= 0) { ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(255,248,235,${v.toFixed(4)})`; } else { ctx.fillStyle = `rgba(0,0,0,${(-v).toFixed(4)})`; }
  ctx.fillRect(0, 0, W, H);
  end(ctx);
}

/** Black bars. opts: {top=0, bottom=0} design px, or {fraction: 0.07} of height each. */
export function letterbox(ctx, o = {}) {
  const top = o.top ?? (o.fraction != null ? o.fraction * DH : 0), bottom = o.bottom ?? top;
  const { } = begin(ctx);
  ctx.fillStyle = o.color ?? '#000';
  if (top > 0) ctx.fillRect(0, 0, DW, top);
  if (bottom > 0) ctx.fillRect(0, DH - bottom, DW, bottom);
  end(ctx);
}

/** Seeded dust specks, hairs and the occasional vertical scratch, held for 2 frames each (like real prints). */
export function dustScratches(ctx, o = {}) {
  const { frame = 0, seed = 1, density = 1, alpha = 0.55 } = o;
  const { } = begin(ctx);
  const r = mulberry32(frameSeed(seed + 77, Math.floor(frame / 2)));
  ctx.globalCompositeOperation = 'screen';
  const n = Math.round((3 + r() * 9) * density);
  for (let i = 0; i < n; i++) {
    const x = r() * DW, y = r() * DH, s = 1 + r() * 2.6, dark = r() < 0.4;
    ctx.globalCompositeOperation = dark ? 'source-over' : 'screen';
    ctx.fillStyle = dark ? `rgba(0,0,0,${alpha * 0.7})` : `rgba(235,235,225,${alpha * (0.4 + r() * 0.5)})`;
    ctx.beginPath(); ctx.ellipse(x, y, s, s * (0.5 + r()), r() * 3, 0, Math.PI * 2); ctx.fill();
  }
  if (r() < 0.55 * density) { // hair
    const x = r() * DW, y = r() * DH, len = 20 + r() * 50, a = r() * Math.PI * 2;
    ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = `rgba(230,230,220,${alpha * 0.5})`; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + r() * 14, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  if (r() < 0.22 * density) { // scratch
    const x = r() * DW, h = 300 + r() * 1200, y0 = r() * (DH - h), wob = (r() - 0.5) * 8;
    ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = `rgba(240,240,230,${alpha * 0.35})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + wob, y0 + h); ctx.stroke();
  }
  end(ctx);
}

const hex2 = (c, d = [0, 0, 0]) => (c == null ? d : parseColor(c).slice(0, 3));
/**
 * Colour grade built from blend modes (no per-pixel loop).
 *  gamma    >1 brightens mids, <1 darkens (soft-light approximation, exact at 1)
 *  gain     number | [r,g,b] 0..2 : exact scale (multiply below 1, colour-dodge above 1)
 *  lift     colour | [r,g,b] 0..255: added toward that colour in the darks via screen (raises blacks - keep small)
 *  saturation  <1: blend-mode desaturate (cheap, exact). >1: soft-light self-overlay (approximate, ~20 ms)
 *  contrast 0..1 : overlay of the frame on itself (S-curve; with saturation<1 this is a bleach-bypass look)
 *  splitTone {shadows, highlights, shadowStrength=0.6, highlightStrength=0.6}: luma-limited tints via quarter-res
 *            masks. Shadow colour is ADDED (screen) so use dark colours (e.g. '#0a2438'); highlight colour is
 *            multiplied onto the highlight mask then screened.
 */
export function grade(ctx, o = {}) {
  const { lift, gamma = 1, gain, splitTone, saturation = 1, contrast = 0 } = o; // o.snap / o.addq: shared quarter-res inputs (see post)
  const { W, H } = begin(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const fill = (op, style, a = 1) => { ctx.globalCompositeOperation = op; ctx.globalAlpha = a; ctx.fillStyle = style; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; };
  if (gamma !== 1) { if (gamma > 1) fill('soft-light', '#fff', cl(gamma - 1)); else fill('soft-light', '#000', cl((1 - gamma) / 0.5)); }
  if (gain != null) {
    const g = typeof gain === 'number' ? [gain, gain, gain] : gain;
    const lo = g.map((v) => Math.round(cl(Math.min(v, 1), 0, 1) * 255)), hi = g.map((v) => Math.round(cl(v > 1 ? 1 - 1 / v : 0, 0, 0.95) * 255));
    if (lo.some((v) => v < 255)) fill('multiply', `rgb(${lo})`);
    if (hi.some((v) => v > 0)) fill('color-dodge', `rgb(${hi})`);
  }
  if (lift != null) { const c = typeof lift === 'number' ? [lift, lift, lift] : hex2(lift); fill('screen', `rgb(${c.map((v) => Math.round(v))})`); }
  if (saturation < 1) fill('saturation', 'rgb(128,128,128)', cl(1 - saturation));
  else if (saturation > 1) { // boost: soft-light of the frame on itself (costs a full copy + blit)
    const src = pooled('cin-gs', W, H), x = src.getContext('2d'); x.globalCompositeOperation = 'copy'; x.drawImage(ctx.canvas, 0, 0);
    ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = cl((saturation - 1) * 1.5); ctx.drawImage(src, 0, 0); ctx.globalAlpha = 1;
  }
  if (contrast > 0) {
    const src = pooled('cin-gc', W, H), x = src.getContext('2d'); x.globalCompositeOperation = 'copy'; x.drawImage(ctx.canvas, 0, 0);
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = cl(contrast); ctx.drawImage(src, 0, 0); ctx.globalAlpha = 1;
  }
  if (splitTone) {
    const q = o.snap ?? snapshot(ctx, 0.25, 'cin-snap'), m = pooled('cin-gm', q.width, q.height);
    const m2 = pooled('cin-gm2', q.width, q.height), m2x = m2.getContext('2d');
    const dst = o.addq ?? m, dx = dst.getContext('2d');
    if (!o.addq) { dx.globalCompositeOperation = 'source-over'; dx.fillStyle = '#000'; dx.fillRect(0, 0, m.width, m.height); }
    const tint = (filter, col, a) => {
      m2x.globalCompositeOperation = 'copy'; m2x.filter = filter; m2x.drawImage(q, 0, 0); m2x.filter = 'none';
      m2x.globalCompositeOperation = 'multiply'; m2x.fillStyle = col; m2x.fillRect(0, 0, m2.width, m2.height);
      dx.globalCompositeOperation = 'lighter'; dx.globalAlpha = a; dx.drawImage(m2, 0, 0); dx.globalAlpha = 1;
    };
    if (splitTone.shadows) tint('grayscale(1) invert(1) contrast(4)', rgba(splitTone.shadows, 1), splitTone.shadowStrength ?? 0.6);
    if (splitTone.highlights) tint('grayscale(1) contrast(4)', rgba(splitTone.highlights, 1), splitTone.highlightStrength ?? 0.6);
    if (!o.addq) { ctx.globalCompositeOperation = 'screen'; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low'; ctx.drawImage(m, 0, 0, W, H); } // one upscale for both tints
  }
  end(ctx);
}

/**
 * Directional (motion) blur: averages `taps` copies of the frame offset along `angle` over `amount` design px.
 * Cost ~ taps full-frame blits. opts: {angle=0 (rad), amount=40, taps=7}. Use on whips and impacts only.
 */
export function directionalBlur(ctx, o = {}) {
  const { angle = 0, amount = 40, taps = 7 } = o;
  if (!(amount > 0.8)) return;
  const { W, H, k } = begin(ctx);
  const src = pooled('cin-db', W, H), x = src.getContext('2d');
  x.globalCompositeOperation = 'copy'; x.drawImage(ctx.canvas, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dx = Math.cos(angle) * amount * k, dy = Math.sin(angle) * amount * k;
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < taps; i++) {
    const f = taps === 1 ? 0 : i / (taps - 1) - 0.5;
    ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(src, dx * f, dy * f);
  }
  end(ctx);
}
/** Convenience: motion blur from camera velocity (px per frame at the reference plane). */
export function whipBlur(ctx, cam, o = {}) {
  const v = cam.velocity, sp = Math.hypot(v.x, v.y);
  if (sp < (o.threshold ?? 12)) return false;
  directionalBlur(ctx, { angle: Math.atan2(v.y, v.x), amount: Math.min(o.max ?? 160, sp * (o.shutter ?? 0.5) * 1.0), taps: o.taps ?? 7 });
  return true;
}
