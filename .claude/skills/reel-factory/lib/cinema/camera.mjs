// cinema/camera: a parallax camera for stacks of 2D planes in the 1080x1920 design space.
//
// Model. A layer is authored "as seen at rest" (camera at 0,0,0): its art is a normal 1080x1920 drawing. Its depth
// d is a distance in focal units (d=1: the reference plane; 2: twice as far). With camera (x, y, z, roll):
//   scale  sc = d / (d - z)          zoom of the plane (push-in grows near planes more than far ones)
//   shift  p  = focal / (d - z)      parallax: a camera move of x px shifts the plane by x*p px (far planes move less)
//   screen = centre + R(roll) * ( sc*(u - centre) - (x, y)*p )
// project(u, v, d) is exactly this map. Moves are pure functions of t (no state): compose them in cam.update().
import { DW, DH, easeInOut, clamp01, lerp, pooled, begin, end } from './util.mjs';
import { noise1 } from './texture.mjs';
import { depthBlur } from './atmos.mjs';

const CX = DW / 2, CY = DH / 2;
const MIN_GAP = 0.04;

const prog = (t, t0, dur) => (dur <= 0 ? (t >= t0 ? 1 : 0) : clamp01((t - t0) / dur));

// ---------- moves: each is (t) => partial {x?, y?, z?, roll?} ----------
/** Move the camera along z (depth units) from -> to. */
export const dolly = ({ t0 = 0, dur = 1, from = 0, to = 0.2, ease = easeInOut } = {}) => (t) => ({ z: lerp(from, to, ease(prog(t, t0, dur))) });
/** Push in so the reference plane (d=1) is `amount` larger at the end (0.15 -> x1.15). Optional `from` amount. */
export const pushIn = ({ t0 = 0, dur = 1, amount = 0.15, from = 0, ease = easeInOut } = {}) => (t) => {
  const a = lerp(from, amount, ease(prog(t, t0, dur)));
  return { z: 1 - 1 / (1 + a) };
};
/** Truck/pan in px at the reference plane. */
export const pan = ({ t0 = 0, dur = 1, from = 0, to = 100, ease = easeInOut } = {}) => (t) => ({ x: lerp(from, to, ease(prog(t, t0, dur))) });
/** Crane / pedestal: vertical move in px (positive = camera down the frame). */
export const crane = ({ t0 = 0, dur = 1, from = 0, to = 100, ease = easeInOut } = {}) => (t) => ({ y: lerp(from, to, ease(prog(t, t0, dur))) });
/** Dutch angle: roll (radians) eased in over dur. */
export const dutch = ({ t0 = 0, dur = 1, angle = 0.08, from = 0, ease = easeInOut } = {}) => (t) => ({ roll: lerp(from, angle, ease(prog(t, t0, dur))) });
/** Handheld shake as data: seeded smooth noise. amp 1 ~ a steady operator (about 6 px, 0.2 deg). */
export function handheld(seed, amp, t) {
  const f = 0.55;
  return {
    x: noise1(seed * 7 + 1, t * f * 1.0) * 7 * amp + noise1(seed * 7 + 2, t * 4.3) * 1.6 * amp,
    y: noise1(seed * 7 + 3, t * f * 1.3) * 5 * amp + noise1(seed * 7 + 4, t * 5.1) * 1.4 * amp,
    roll: noise1(seed * 7 + 5, t * f * 0.8) * 0.0035 * amp,
  };
}
/** handheld as a composable move. */
export const handheldMove = (seed = 1, amp = 1) => (t) => handheld(seed, amp, t);
/** Whip pan: out-and-back offset of `dist` px over dur starting t0 (cut at the midpoint t0+dur/2). */
export const whip = (t0 = 0, dur = 0.3, dir = 1, { dist = 1100 } = {}) => (t) => {
  const u = prog(t, t0, dur);
  if (u <= 0 || u >= 1) return {};
  return { x: dir * dist * Math.pow(Math.sin(Math.PI * u), 2) };
};
/** Whip progress 0..1 (for cutting scenes at 0.5). */
export const whipProgress = (t, t0, dur) => prog(t, t0, dur);

const add = (a, b) => ({ x: (a.x || 0) + (b.x || 0), y: (a.y || 0) + (b.y || 0), z: (a.z || 0) + (b.z || 0), roll: (a.roll || 0) + (b.roll || 0) });
const evalMoves = (t, moves) => moves.reduce((acc, m) => add(acc, typeof m === 'function' ? m(t) || {} : m || {}), {});

export function createCamera({ focal = 1, x = 0, y = 0, z = 0, roll = 0 } = {}) {
  const base = { x, y, z, roll };
  const cam = {
    focal,
    state: { x, y, z, roll },
    /** velocity in px/frame at the reference plane (for motion blur) */
    velocity: { x: 0, y: 0, roll: 0 },
    set(p) { Object.assign(cam.state, p); return cam; },
    /** state = base + sum(moves(t)); also derives velocity from the previous 1/30 s. */
    update(t, ...moves) {
      const a = evalMoves(t, moves), b = evalMoves(t - 1 / 30, moves);
      cam.state = { x: base.x + a.x, y: base.y + a.y, z: base.z + a.z, roll: base.roll + a.roll };
      cam.velocity = { x: a.x - b.x, y: a.y - b.y, roll: a.roll - b.roll };
      return cam;
    },
    project(px, py, d) { return project(cam, px, py, d); },
    layer(ctx, depth, drawFn, opts) { return layer(cam, ctx, depth, drawFn, opts); },
    /** Apply the plane transform to ctx for depth d (no clipping): for drawing several things on one plane. */
    apply(ctx, depth) { const m = planeMatrix(cam, depth); if (!m) return false; ctx.translate(CX, CY); ctx.rotate(cam.state.roll); ctx.translate(m.tx, m.ty); ctx.scale(m.sc, m.sc); ctx.translate(-CX, -CY); return true; },
    /** Smallest scale at which the authored rect still covers the frame at depth d (<=1 means free). */
    coverScale(depth) { const m = planeMatrix(cam, depth); return m ? coverOf(cam, m) : Infinity; },
  };
  return cam;
}

function planeMatrix(cam, d) {
  const { x, y, z } = cam.state, gap = d - z;
  if (gap < MIN_GAP) return null; // plane is behind / at the lens
  const sc = d / gap, p = cam.focal / gap;
  return { sc, p, tx: -x * p, ty: -y * p };
}

/** Screen position + scale of the point (u,v) lying on the plane at depth d. */
export function project(cam, u, v, d) {
  const m = planeMatrix(cam, d);
  if (!m) return { sx: NaN, sy: NaN, scale: Infinity, visible: false };
  const r = cam.state.roll, c = Math.cos(r), s = Math.sin(r);
  const ex = m.sc * (u - CX) + m.tx, ey = m.sc * (v - CY) + m.ty;
  return { sx: CX + c * ex - s * ey, sy: CY + s * ex + c * ey, scale: m.sc, visible: true };
}

// scale needed so the authored [0,DW]x[0,DH] rect covers the frame
function coverOf(cam, m) {
  const r = cam.state.roll, c = Math.cos(r), s = Math.sin(r);
  let need = 0;
  for (const [ex, ey] of [[-CX, -CY], [CX, -CY], [-CX, CY], [CX, CY]]) {
    const qx = c * ex + s * ey - m.tx, qy = -s * ex + c * ey - m.ty; // R^-1 e - shift  (u-centre = q / sc)
    need = Math.max(need, Math.abs(qx) / CX, Math.abs(qy) / CY);
  }
  return need;
}

/** Visible window of the plane in authored coordinates (with margin px), for drawFn to fill. */
export function visibleBounds(cam, depth, margin = 4) {
  const m = planeMatrix(cam, depth); if (!m) return null;
  const r = cam.state.roll, c = Math.cos(r), s = Math.sin(r);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [ex, ey] of [[-CX, -CY], [CX, -CY], [-CX, CY], [CX, CY]]) {
    const u = CX + (c * ex + s * ey - m.tx) / m.sc, v = CY + (-s * ex + c * ey - m.ty) / m.sc;
    x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v);
  }
  x0 -= margin; y0 -= margin; x1 += margin; y1 += margin;
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/**
 * Draw a 2D plane at `depth`. drawFn(ctx, bounds) draws in authored coordinates.
 * opts: fullBleed (default false) the art is a full 1080x1920 backdrop: its scale is raised if needed so it always
 *         covers the frame (automatic overscan) - no exposed edges whatever the move (push, pan, roll).
 *       Otherwise `bounds` = the visible window in authored coords (+margin): fill gradients/rects to it.
 *       op: globalCompositeOperation for the plane (e.g. 'destination-over' to slip a plane BEHIND what is drawn);
 *       blur: px of depth-of-field blur (0 = none); haze: {color, amount} fog laid over everything drawn so far
 *       AFTER this plane (so farther planes get hazier); alpha.
 * Returns false when the plane is behind the lens (nothing drawn).
 */
export function layer(cam, ctx, depth, drawFn, opts = {}) {
  const m = planeMatrix(cam, depth);
  if (!m) return false;
  const { W, H, k } = begin(ctx);
  let sc = m.sc, bounds;
  if (opts.fullBleed) { sc = Math.max(sc, coverOf(cam, m) * (1 + 3 / CX)); bounds = { x0: 0, y0: 0, x1: DW, y1: DH, w: DW, h: DH }; }
  else bounds = visibleBounds(cam, depth);
  const setup = (x) => { x.translate(CX, CY); x.rotate(cam.state.roll); x.translate(m.tx, m.ty); x.scale(sc, sc); x.translate(-CX, -CY); };
  if (opts.fullBleed) {
    // recompute the bounds in the (possibly enlarged) plane so edge fills stay inside
    bounds = { x0: -2, y0: -2, x1: DW + 2, y1: DH + 2, w: DW + 4, h: DH + 4 };
  }
  if (opts.blur > 0.4) {
    const off = pooled('cin-layer', W, H), ox = off.getContext('2d');
    ox.clearRect(0, 0, W, H); ox.save(); ox.setTransform(k, 0, 0, k, 0, 0); setup(ox);
    drawFn(ox, bounds); ox.restore();
    const blurred = depthBlur(off, depth, opts.focus ?? 1, { px: opts.blur * k, direct: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = opts.alpha ?? 1; if (opts.op) ctx.globalCompositeOperation = opts.op; ctx.drawImage(blurred, 0, 0);
  } else {
    ctx.globalAlpha = opts.alpha ?? 1; if (opts.op) ctx.globalCompositeOperation = opts.op;
    setup(ctx); drawFn(ctx, bounds);
  }
  if (opts.haze && opts.haze.amount > 0) {
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.globalAlpha = Math.min(1, opts.haze.amount); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = opts.haze.color ?? '#8090a8'; ctx.fillRect(0, 0, DW, DH);
  }
  end(ctx);
  return true;
}
