// darkpov.mjs: the 'dark-pov' layer of the upper-berth variant. It wraps the v3 shots (shots.mjs is untouched):
//   shot draws the coach -> train sway -> bar shadows -> POV foreground (his own knee + blanket) -> cin.post('horror-dark-pov') with ONE
//   motivated light driven by cues (passing sweep, then the dying tube from s5, a tiny night-lamp floor before that) -> HUD + rim light
//   drawn after the mask. All timing comes from cues.mjs / timeline events; nothing here adds an event.
import * as kit from '../../../.claude/skills/reel-factory/lib/kit/index.mjs';
import { Path2D } from '../../../.claude/skills/reel-factory/lib/kit/util.mjs';
import { sm, lerp, cl } from './set_coach.mjs';

const { cin } = kit;
const TAU2 = Math.PI * 2;

// Where the light pools sit per scene (design px, 1080x1920): face/lamp pool (where the faint night-lamp floor falls), the height the
// sweep crosses the frame, and whether the foreground knee is drawn.
export const SCENE = {
  s1_hook: { face: [400, 470, 430], sweepY: 700 },
  s2_coach: { face: [820, 640, 440], sweepY: 780 },
  s3_ticket: { face: [420, 900, 420], sweepY: 900, lamp: '#ffd9a0' },
  s4_rule: { face: [470, 620, 440], sweepY: 700 },
  s5_stop: { face: [500, 420, 420], sweepY: 700 },
  s6_eyes: { face: [345, 930, 440], sweepY: 990, lying: true },
  s7_tickets: { face: [650, 880, 420], sweepY: 880 },
  s8_itarsi: { face: [330, 560, 420], sweepY: 600 },
  s9_relief: { face: [780, 680, 420], sweepY: 680 },
  s10_bhopal: { face: [540, 520, 520], sweepY: 560, noFg: true },
  s11_ticket2: { face: [420, 1000, 400], sweepY: 840 },
  s12_loop: { face: [400, 470, 430], sweepY: 700 },
};

export const POST = { s5_stop: { lightMask: { ambient: '#111827', glow: 0.26 } }, s7_tickets: { lightMask: { ambient: '#141c2e', glow: 0.26 }, grade: { gamma: 0.96, gain: [0.95, 1.0, 1.14], saturation: 0.28, contrast: 0.35, splitTone: { shadows: '#02060c', highlights: '#c9d6ff', shadowStrength: 0.3, highlightStrength: 0.22 } } }, s8_itarsi: { grade: { gamma: 0.96, gain: [0.9, 0.95, 1.05], saturation: 0.55, contrast: 0.35, splitTone: { shadows: '#02060c', highlights: '#c9d6ff', shadowStrength: 0.3, highlightStrength: 0.22 } } }, s12_loop: { lightMask: { ambient: '#080c14', glow: 0.26 }, grade: { gamma: 0.96, gain: [0.88, 0.93, 1.05], saturation: 0.3, contrast: 0.35, splitTone: { shadows: '#02060c', highlights: '#c9d6ff', shadowStrength: 0.3, highlightStrength: 0.22 } } } };
const LAMPBOOST = { s2_coach: 1.8, s3_ticket: 1.5, s4_rule: 1.8, s5_stop: 2.4, s6_eyes: 0.9, s7_tickets: 2.3, s11_ticket2: 1.9, s9_relief: 1.6 };
const SWEEP_COL = { sodium: '#ffc489', white: '#dfe9ff', cool: '#b8ffe6' };

// dying tube from itarsi on: mostly on, drops out in short deterministic stutters (a few per second at most)
function dyingTube(t) { return Math.sin(t * 23.1) * Math.sin(t * 5.7 + 1) > 0.8 ? 0.1 : 1; }

export function tubeGate(P) {
  const stopT = P.E.stopT;
  if (P.t < stopT) return 0;
  return P.t >= P.E.itarsiT - 0.2 ? dyingTube(P.t) * 0.7 : P.tube;
}

// the lights that are allowed to exist in the dark
export function darkLights(P, cfgScene) {
  const c = cfgScene, lights = [], sw = P.sweep, tube = tubeGate(P);
  // tiny night-lamp floor (before the tube starts dying): the uncle is a shape in the dark, not a lit subject
  const lampK = P.t < P.E.stopT ? 0.85 : (P.sc.id === 's7_tickets' || P.sc.id === 's8_itarsi' ? 0.7 : 0.45);
  lights.push({ type: 'point', x: c.face[0] + (P.sc.id === 's5_stop' ? 90 * Math.sin(P.t * 1.1) : 0), y: c.face[1], r: c.face[2], color: c.lamp || '#8fb0ff', intensity: lampK * (LAMPBOOST[P.sc.id] ?? 1) * (0.88 + 0.12 * Math.sin(P.t * 1.7)) });
  // s7: a low cold floor over the row of berths so the hands and tickets stay readable between sweeps (the dying tube is farther away)
  if (P.sc.id === 's7_tickets') lights.push({ type: 'point', x: 540, y: 1000, r: 760, color: '#7f9ad8', intensity: 0.4 });
  // s5: the uncle keeps a faint cold rim from the dying tube between flickers
  if (P.sc.id === 's5_stop') lights.push({ type: 'point', x: 560, y: 560, r: 640, color: '#7f9ad8', intensity: 0.3 });
  // the passing sweep: a pool that travels right -> left behind the window bars, then dies
  if (sw.i > 0.02) {
    const x = lerp(1250, -250, sw.u), col = SWEEP_COL[sw.kind] || '#fff';
    lights.push({ type: 'point', x, y: c.sweepY, r: 560, color: col, intensity: 0.9 * sw.i });
    lights.push({ type: 'point', x: x + 140, y: c.sweepY + 260, r: 380, color: col, intensity: 0.35 * sw.i });
  }
  // the dying tube: a cold wash from the ceiling (stutters at the stop, then stays hurt)
  if (tube > 0.02) {
    const warm = P.sc.id === 's8_itarsi' ? 0.35 : 0;
    lights.push({ type: 'point', x: 540, y: 240, r: 1000, color: warm ? '#cfe0ff' : '#bcd4ff', intensity: 0.8 * tube * (P.sc.id === 's9_relief' ? 1 - 0.85 * sm(0.55, 1, P.E.clock.between('relief', P.t)) : 1) });
  }
  // s6: the pale reveal. no sweep cue exists on 'eyes', so the pass rides the three existing glint cues (same event + offset as sound.json):
  // a hard narrow beam crosses the frame, is centred on his face exactly at the glint's midpoint, and is gone at the glint's end.
  if (c.lying) {
    const uS = P.E.clock.between('eyes', P.t), faceX = lerp(430, 235, cl(uS));
    for (const g of P.E.cues.glints) {
      if (P.t < g.t0 || P.t > g.t1) continue;
      const u = (P.t - g.t0) / (g.t1 - g.t0), big = g === P.E.cues.glints[2] ? 1 : 0.7, env = Math.pow(Math.sin(Math.PI * u), 0.6);
      lights.push({ type: 'point', x: faceX + (0.5 - u) * 900, y: c.sweepY, r: 330, color: '#eef2ff', intensity: 3.3 * env * big });
    }
  }
  // s10: the Bhopal board is the scare: it carries its own pool for the whole beat
  if (P.sc.id === 's10_bhopal') {
    const d = P.t - P.E.scareT;
    lights.push({ type: 'point', x: d < 1.7 ? 600 - 160 * Math.max(0, d - 0.1) : 344 - 160 * (d - 1.7) - 260 * (d - 1.7) ** 2, y: 520, r: 700, color: '#ffe9b0', intensity: 0.4 });
    lights.push({ type: 'point', x: 540, y: 1100, r: 700, color: '#6f8cc8', intensity: 0.2 });
  }
  return lights;
}

// ---- whole-frame train sway (handheld on a moving coach). Eases off while the train is halted and rolls again after Itarsi.
export function swayAmount(P) {
  const stopT = P.E.stopT, itarsiT = P.E.itarsiT;
  if (P.t < stopT) return 1;
  if (P.t < stopT + 0.5) return lerp(1, 0.3, (P.t - stopT) / 0.5);
  if (P.t < itarsiT) return 0.3;
  return lerp(0.3, 1, sm(0, 1, (P.t - itarsiT) / 1.5));
}
export function swayOffset(t, amp = 1) {
  const clack = Math.pow(Math.abs(Math.sin(Math.PI * 1.9 * t)), 10);
  return { x: amp * (5 * Math.sin(1.3 * t) + 2.5 * Math.sin(3.1 * t + 1)), y: amp * (4 * Math.sin(1.9 * t + 0.4) + 5 * clack), r: amp * 0.0035 * Math.sin(0.9 * t + 0.6) };
}
export function applySway(ctx, w, h, t, amp) {
  const o = swayOffset(t, amp), k = w / 1080;
  const tmp = cin.pooled('dp-sway', w, h), x = tmp.getContext('2d');
  x.globalCompositeOperation = 'copy'; x.drawImage(ctx.canvas, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2 + o.x * k, h / 2 + o.y * k); ctx.rotate(o.r); ctx.scale(1.035, 1.035); ctx.translate(-w / 2, -h / 2);
  ctx.drawImage(tmp, 0, 0); ctx.restore();
}

// ---- the sweep seen through the window bars: vertical slats of shadow riding with the light, so lit areas read as striped
export function barShadows(ctx, w, h, P) {
  const sw = P.sweep; if (sw.i < 0.03) return;
  const k = w / 1080, off = lerp(1250, -250, sw.u) * 0.35;
  ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0); ctx.globalCompositeOperation = 'multiply';
  for (let x = -200 + (off % 150); x < 1300; x += 150) { const g = ctx.createLinearGradient(x, 0, x + 54, 0); const a = 0.62 * Math.min(1, sw.i * 1.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.25, `rgba(8,10,16,${a})`); g.addColorStop(0.75, `rgba(8,10,16,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x, 0, 54, 1920); }
  ctx.restore();
}

// ---- POV foreground: the narrator's own raised knee (right) and the blanket over his shoulder (left). Near-black; the rim catches the light.
function fgPaths(t) {
  const s = swayOffset(t * 1.0 + 3, 2.4), bx = s.x * 1.6, by = s.y * 1.6;
  return { bx, by };
}
// POV foreground: a wide blanket with a diagonal fold over his lap, and his own hand resting on the blanket edge (back of the hand, knuckles,
// four fingers and a thumb, nails). Everything is drawn AFTER the light mask (overlay) so it is not erased by the dark: lit from the right,
// only as strongly as the light that passes, with a faint floor so it never vanishes. s6 (lying on his side): blanket edge only, no hand.
const BLANKET = (bx, by) => { const p = new Path2D(); p.moveTo(-140, 2050); p.lineTo(-140, 1805 + by); p.bezierCurveTo(60 + bx, 1790 + by, 240 + bx, 1775 + by, 430 + bx, 1738 + by); p.bezierCurveTo(600 + bx, 1706 + by, 700 + bx, 1668 + by, 880 + bx, 1646 + by); p.bezierCurveTo(1010 + bx, 1630 + by, 1120 + bx, 1640 + by, 1230, 1650 + by); p.lineTo(1230, 2050); p.closePath(); return p; };
const capsule = (c, x0, y0, x1, y1, w0, w1) => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, p = new Path2D();
  p.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); p.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2); p.arc(x1, y1, w1 / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true); p.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2); p.arc(x0, y0, w0 / 2, Math.atan2(ny, nx) + Math.PI, Math.atan2(ny, nx), true); p.closePath(); return p; };
export function drawForeground() { /* the whole foreground is drawn post-mask in drawRim */ }
export function drawRim(ctx, w, h, P, cfgScene, tube) {
  if (cfgScene.noFg) return;
  const a = Math.min(0.9, 0.2 + P.sweep.i * 0.7 + tube * 0.25 + (cfgScene.lying ? P.glint * 0.5 : 0));
  const k = w / 1080, { bx, by } = fgPaths(P.t), col = P.sweep.i > 0.05 ? SWEEP_COL[P.sweep.kind] || '#dfe9ff' : '#9bb6ff';
  const lit = (P.sc.id === 's8_itarsi' || P.sc.id === 's12_loop') ? 0.75 : 1, fa = (0.45 + 0.4 * a) * lit;
  ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const bl = BLANKET(bx * 0.6, by * 0.6);
  ctx.save(); ctx.clip(bl); ctx.globalCompositeOperation = 'source-over';
  const cloth = ctx.createLinearGradient(1180, 0, -100, 0); cloth.addColorStop(0, `rgba(150,166,210,${fa})`); cloth.addColorStop(0.55, `rgba(62,72,104,${fa})`); cloth.addColorStop(1, `rgba(20,24,38,${fa})`);
  ctx.fillStyle = cloth; ctx.fillRect(-200, 1600, 1500, 460);
  const fall = ctx.createLinearGradient(0, 1640, 0, 1960); fall.addColorStop(0, 'rgba(0,0,0,0)'); fall.addColorStop(1, 'rgba(4,5,10,0.75)'); ctx.fillStyle = fall; ctx.fillRect(-200, 1600, 1500, 460);
  cin.fillTexture(ctx, 'fabric', [-150, 1620, 1400, 440], { blend: 'overlay', alpha: 0.85, scale: 1.3, seed: 17 });
  // one big diagonal fold (dark trough, light crest on its right edge) plus two smaller ones
  for (const [x0, y0, x1, y1, wd] of [[760, 1700, 520, 2000, 56], [980, 1670, 880, 2000, 38], [330, 1790, 170, 2000, 34]]) {
    ctx.strokeStyle = 'rgba(3,4,9,0.6)'; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x0 + bx * 0.6, y0 + by * 0.6); ctx.quadraticCurveTo((x0 + x1) / 2 + 40, (y0 + y1) / 2, x1, y1); ctx.stroke();
    ctx.strokeStyle = `rgba(190,205,245,${a * 0.38})`; ctx.lineWidth = wd * 0.28; ctx.beginPath(); ctx.moveTo(x0 + wd * 0.5 + bx * 0.6, y0 + by * 0.6); ctx.quadraticCurveTo((x0 + x1) / 2 + 40 + wd * 0.5, (y0 + y1) / 2, x1 + wd * 0.5, y1); ctx.stroke();
  }
  ctx.strokeStyle = `rgba(190,205,245,${a * 0.14})`; ctx.lineWidth = 3; ctx.setLineDash([9, 7]); for (let y = 1660; y < 2000; y += 20) { ctx.beginPath(); ctx.moveTo(-120, y + 12 + by * 0.6); ctx.lineTo(1200, y - 28 + by * 0.6); ctx.stroke(); } ctx.setLineDash([]);
  ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(-200, 1560, 1500, 420); ctx.clip(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = col; ctx.globalAlpha = a * 0.3; ctx.lineWidth = 14; ctx.stroke(bl); ctx.globalAlpha = Math.min(1, a * 0.9); ctx.lineWidth = 3.5; ctx.stroke(bl); ctx.restore();
  if (!cfgScene.lying) { // his hand on the blanket edge
    const hx = 360 + bx * 1.1, hy = 1790 + by * 1.1;
    const skin = (x, y, x2, y2) => { const g = ctx.createLinearGradient(x, y, x2, y2); g.addColorStop(0, `rgba(196,186,200,${Math.min(1, fa + 0.2)})`); g.addColorStop(1, `rgba(78,72,92,${Math.min(1, fa + 0.2)})`); return g; };
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.12);
    ctx.fillStyle = 'rgba(2,3,6,0.55)'; ctx.beginPath(); ctx.ellipse(10, 20, 120, 150, 0, 0, TAU2); ctx.fill(); // contact shadow on the cloth
    const back = new Path2D(); back.moveTo(-72, 250); back.bezierCurveTo(-96, 150, -92, 40, -78, -12); back.lineTo(78, -12); back.bezierCurveTo(96, 40, 92, 150, 70, 250); back.closePath();
    const fingers = [[-58, -4, -66, -108, 40, 33], [-20, -8, -22, -128, 42, 34], [20, -8, 24, -120, 40, 33], [58, -4, 70, -92, 34, 28]].map(([x0, y0, x1, y1, w0, w1]) => capsule(ctx, x0, y0, x1, y1, w0, w1));
    const thumb = capsule(ctx, 70, 78, 150, -6, 44, 32);
    for (const sh of [...fingers, thumb, back]) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = skin(-90, -120, 110, 240); ctx.fill(sh); ctx.strokeStyle = 'rgba(6,6,12,0.7)'; ctx.lineWidth = 3.5; ctx.stroke(sh); }
    ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = `rgba(215,225,255,${a * 0.5})`; ctx.lineWidth = 3;
    for (const [x0, y0, x1, y1] of [[-58, -4, -66, -108], [-20, -8, -22, -128], [20, -8, 24, -120], [58, -4, 70, -92]]) { ctx.beginPath(); ctx.moveTo(x0 + 16, y0 + 6); ctx.lineTo(x1 + 12, y1 + 4); ctx.stroke(); } // right-edge sheen on each finger
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(8,8,14,0.55)'; ctx.lineWidth = 3;
    for (const [x0, y0, x1, y1] of [[-58, -4, -66, -108], [-20, -8, -22, -128], [20, -8, 24, -120], [58, -4, 70, -92]]) { for (const f of [0.38, 0.68]) { const cx = x0 + (x1 - x0) * f, cy = y0 + (y1 - y0) * f; ctx.beginPath(); ctx.moveTo(cx - 13, cy); ctx.lineTo(cx + 13, cy); ctx.stroke(); } }
    ctx.fillStyle = 'rgba(214,206,214,0.75)'; for (const [x, y] of [[-66, -108], [-22, -128], [24, -120], [70, -92]]) { ctx.beginPath(); ctx.ellipse(x, y - 8, 10, 13, 0, 0, TAU2); ctx.fill(); } // nails
    ctx.strokeStyle = 'rgba(8,8,14,0.45)'; ctx.lineWidth = 3; for (const [x, y] of [[-56, 40], [-20, 34], [18, 34], [54, 40]]) { ctx.beginPath(); ctx.arc(x, y, 14, 0.2, Math.PI - 0.2); ctx.stroke(); } // knuckle creases
    ctx.restore();
  }
  ctx.restore();
}

// ---- HUD: the clock of coach S7. Derived only from timeline events and scene boundaries.
const fmt = (m) => { m = ((Math.floor(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export function hudState(P) {
  const E = P.E, t = P.t, sc = P.tl.scenes, st = (id) => sc.find((s) => s.id === id).start_s;
  // clock at scene starts (minutes after 00:00; negative = before midnight); ticks through the minutes in 0.7 s at each boundary
  const marks = [[0, -8], [st('s2_coach'), 31], [st('s3_ticket'), 68], [st('s4_rule'), 101], [E.stopT, 120]];
  let m = marks[0][1];
  for (let i = 1; i < marks.length; i++) { if (t >= marks[i][0]) m = marks[i][1]; else if (t > marks[i][0] - 0.7) m = lerp(marks[i - 1][1], marks[i][1], sm(marks[i][0] - 0.7, marks[i][0], t)); }
  const frozen = t >= E.stopT;
  const flicking = P.E.cues.flicks.some((f) => t >= f.t0 && t < f.t1);
  let o = { label: 'S7', value: fmt(m), wrong: 0, a: 1 };
  if (frozen) o.wrong = flicking || P.glint > 0.1 ? 1 : 0.55;
  if (t >= E.itarsiT - 0.1) { o = { label: 'STATION', value: 'ITARSI', wrong: 0, a: sm(0, 0.4, t - (E.itarsiT - 0.1)) }; }
  if (t >= E.reliefT) { // eyes close: the clock runs on without him (lost time)
    const u = sm(0.34, 0.95, E.clock.between('relief', t)), mm = lerp(170, 268, u);
    o = { label: 'S7', value: fmt(mm), wrong: u > 0.05 && u < 0.99 ? 0.4 : 0, a: 1 };
  }
  if (t >= E.scareT) o = { label: '', value: '', wrong: 0, a: 0 };
  const twist = E.clock.at('twist');
  const end = P.tl.duration_s, morph = sm(end - 1.5, end - 0.2, t);
  if (t >= twist - 0.05) { o = { label: 'STATION', value: 'BHOPAL → passed', wrong: (t - twist) < 0.5 ? 1 : 0, redEdge: 1, a: sm(0, 0.25, t - twist + 0.05) * (1 - morph), big: true }; if (morph > 0.5) o = { label: 'S7', value: '23:52', wrong: 0, a: morph }; }
  return o;
}
export function drawHud(ctx, w, h, P) {
  const o = hudState(P); if (!o.a || o.a <= 0.01) return;
  const k = w / 1080; ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0);
  // steady 'wrong' (frozen clock) is drawn red WITHOUT the chromatic split (the split smears small digits at phone size); the split only fires on glitch beats (wrong = 1)
  const steady = o.wrong > 0 && o.wrong < 1, bigH = o.big;
  const r = kit.props.hud(ctx, { label: o.label, value: o.value, x: bigH ? 480 : 270, y: bigH ? 340 : 330, scale: bigH ? 1.1 : 1.15, wrong: steady ? 0 : o.wrong, a: o.a, t: P.t, valueSize: bigH ? 52 : 54, labelSize: bigH ? 26 : 24, seed: 3 });
  if (r && (steady || o.redEdge && !o.wrong)) { ctx.save(); ctx.globalAlpha = o.a; ctx.strokeStyle = 'rgba(224,27,36,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18 * (bigH ? 1.1 : 1.15)); ctx.stroke(); ctx.restore(); }
  ctx.restore();
}
