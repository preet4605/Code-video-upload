// figures/hand: a shaped hand (palm + four fingers + thumb as tapered ribbons) usable at body scale and as a close-up.
import { smoothClosed, ribbon, mix, shade, rgba, cl, lerp, cin } from '../util.mjs';
import { grad, formStops } from './face.mjs';

/**
 * drawHand(c, {p:[x,y], ang, size, curl 0..1, spread 0..1, thumb 0..1, side:+1|-1, skin, env, grip?})
 * `ang` is the direction the fingers point, measured from straight down (like arm angles). size = hand length (wrist to fingertip).
 */
export function drawHand(c, o) {
  const { p, ang = 0, size = 0.06, curl = 0.2, spread = 0.2, thumb = 0.3, side = 1, skin, env } = o;
  const S = size;
  c.save(); c.translate(p[0], p[1]); c.rotate(-ang);
  const stops = formStops(skin, env), ink = rgba(shade(skin, -0.75), 0.7), parts = [];
  // fingers: lengths and offsets across the palm (index nearest the thumb side)
  const fl = [0.46, 0.5, 0.47, 0.38], fx = [-0.255, -0.085, 0.085, 0.25];
  const palmW = S * 0.58, palmH = S * 0.5;
  // curl bends fingers toward the palm normal (toward -x? no: toward the viewer => shorten + hook): emulate by foreshortening and bending to the thumb side
  const fingers = [0, 1, 2, 3].map((i) => {
    const base = [fx[i] * S, palmH * 0.86], seg = (fl[i] * S) / 3, pts = [base]; let [x, y] = base, a = (i - 1.5) * spread * 0.2 * side;
    for (let j = 0; j < 3; j++) { a += curl * (0.35 + j * 0.5) * side * 1.0; y += Math.cos(a) * seg * (1 - 0.3 * curl * j); x += Math.sin(a) * seg; pts.push([x, y]); }
    return pts;
  });
  const th = [[palmW * 0.42 * side, palmH * 0.25], [palmW * 0.62 * side + side * S * 0.12 * thumb, palmH * 0.55], [palmW * 0.55 * side + side * S * 0.2 * thumb, palmH * 0.95 + S * 0.1 * (1 - thumb)]];
  // draw order: thumb behind palm for open, fingers, palm
  const shape = (pts, ws, ink_ = true) => {
    const path = smoothClosed(ribbon(pts, ws, { n: 6, cap: 3 })), bb = [Math.min(...pts.map((q) => q[0])) - S * 0.1, Math.min(...pts.map((q) => q[1])) - S * 0.1, Math.max(...pts.map((q) => q[0])) + S * 0.1, Math.max(...pts.map((q) => q[1])) + S * 0.1];
    c.fillStyle = grad(c, bb, rotL(env.L, ang), stops); c.fill(path); if (ink_) { c.strokeStyle = ink; c.lineWidth = Math.max(0.0022, S * 0.03); c.stroke(path); } return path;
  };
  const fw = [S * 0.15, S * 0.13, S * 0.11, S * 0.085];
  fingers.forEach((f, i) => shape(f, [fw[i] * 1.05, fw[i], fw[i] * 0.88, fw[i] * 0.7]));
  const palm = smoothClosed([[-palmW / 2, 0.0], [palmW / 2, 0.0], [palmW * 0.56, palmH * 0.5], [palmW * 0.46, palmH * 0.95], [-palmW * 0.46, palmH * 0.95], [-palmW * 0.56, palmH * 0.5]]);
  c.fillStyle = grad(c, [-palmW / 2, 0, palmW / 2, palmH], rotL(env.L, ang), stops); c.fill(palm); c.strokeStyle = ink; c.lineWidth = Math.max(0.0022, S * 0.03); c.stroke(palm);
  shape(th, [S * 0.17, S * 0.15, S * 0.12]);
  // knuckle creases
  c.strokeStyle = rgba(shade(skin, -0.6), 0.4); c.lineWidth = Math.max(0.0016, S * 0.018);
  for (let i = 0; i < 4; i++) { const [x, y] = fingers[i][1]; c.beginPath(); c.moveTo(x - fw[i] * 0.3, y); c.lineTo(x + fw[i] * 0.3, y); c.stroke(); }
  c.restore();
}
function rotL(L, ang) { const ca = Math.cos(ang), sa = Math.sin(ang); return { x: L.x * ca - L.y * sa, y: L.x * sa + L.y * ca }; }
