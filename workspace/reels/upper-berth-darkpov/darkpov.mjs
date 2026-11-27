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

export const POST = { s12_loop: { lightMask: { ambient: '#080c14', glow: 0.26 } }, s5_stop: { lightMask: { ambient: '#111827', glow: 0.26 } }, s7_tickets: { lightMask: { ambient: '#141c2e', glow: 0.26 } } };
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
const KNEE = (bx, by) => { const p = new Path2D(); p.moveTo(560 + bx, 2000); p.bezierCurveTo(600 + bx, 1760 + by, 720 + bx, 1590 + by, 900 + bx, 1578 + by); p.bezierCurveTo(1040 + bx, 1570 + by, 1170 + bx, 1650 + by, 1200 + bx, 2000); p.closePath(); return p; };
const BLANKET = (bx, by) => { const p = new Path2D(); p.moveTo(-120 + bx, 2000); p.bezierCurveTo(-90 + bx, 1790 + by, 80 + bx, 1690 + by, 270 + bx, 1712 + by); p.bezierCurveTo(400 + bx, 1730 + by, 500 + bx, 1830 + by, 540 + bx, 2000); p.closePath(); return p; };

export function drawForeground(ctx, w, h, P, cfgScene) {
  if (cfgScene.noFg) return;
  const k = w / 1080, { bx, by } = fgPaths(P.t);
  ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0); ctx.globalCompositeOperation = 'source-over';
  const lying = cfgScene.lying;
  for (const [p, y0] of [[KNEE(bx, by), 1580], [BLANKET(bx, by), 1700]]) {
    if (lying && y0 === 1580) continue; // lying on his side: only the blanket edge
    const g = ctx.createLinearGradient(0, y0, 0, 2000); g.addColorStop(0, '#0e1118'); g.addColorStop(1, '#030407');
    ctx.fillStyle = g; ctx.fill(p);
    ctx.save(); ctx.clip(p); cin.fillTexture(ctx, 'fabric', [-150, y0 - 20, 1400, 480], { blend: 'overlay', alpha: 0.5, scale: 1.4, seed: 17 });
    // folds
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const fx = (y0 === 1580 ? 640 : 40) + i * 110 + bx; ctx.beginPath(); ctx.moveTo(fx, y0 + 40); ctx.quadraticCurveTo(fx + 30, y0 + 180 + by, fx - 20, 2000); ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
}
// Foreground drawn AFTER the mask (so it is not darkened away): his own raised knee (trouser cloth: centre seam, kneecap sheen, creases
// radiating from the cap) and the blanket (a checked weave with deep folds). Lit only as much as the light that is passing, with a faint floor.
export function drawRim(ctx, w, h, P, cfgScene, tube) {
  if (cfgScene.noFg) return;
  const a = Math.min(0.9, 0.2 + P.sweep.i * 0.7 + tube * 0.25 + (cfgScene.lying ? P.glint * 0.5 : 0));
  const k = w / 1080, { bx, by } = fgPaths(P.t), col = P.sweep.i > 0.05 ? SWEEP_COL[P.sweep.kind] || '#dfe9ff' : '#9bb6ff';
  ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [p, y0] of [[KNEE(bx, by), 1580], [BLANKET(bx, by), 1700]]) {
    const isKnee = y0 === 1580; if (cfgScene.lying && isKnee) continue;
    ctx.save(); ctx.clip(p);
    // body of the cloth: a real filled, lit form (dusty blue-grey wool for the blanket, darker trouser cloth for the knee), lit from above
    ctx.globalCompositeOperation = 'source-over';
    const cloth = ctx.createLinearGradient(0, y0 - 10, 0, y0 + 330), top = isKnee ? [118, 134, 180] : [128, 144, 188], fa = (0.45 + 0.4 * a) * ((P.sc.id === 's8_itarsi' || P.sc.id === 's10_bhopal' || P.sc.id === 's12_loop') ? 0.7 : 1);
    cloth.addColorStop(0, `rgba(${top},${fa})`); cloth.addColorStop(0.5, `rgba(${top.map((v) => v * 0.4 | 0)},${fa})`); cloth.addColorStop(1, `rgba(6,8,14,0.92)`);
    ctx.fillStyle = cloth; ctx.fillRect(-200, y0 - 40, 1500, 460);
    cin.fillTexture(ctx, 'fabric', [-150, y0 - 20, 1400, 440], { blend: 'overlay', alpha: 0.85, scale: 1.3, seed: 17 });
    if (isKnee) { // broad sheen on the kneecap, soft shadow-and-highlight wrinkles across the cap, the seam of the trouser leg
      const cx = 905 + bx, cy = 1665 + by, sh = ctx.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, 230); sh.addColorStop(0, `rgba(190,205,245,${a * 0.5})`); sh.addColorStop(1, 'rgba(190,205,245,0)');
      ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(cx, cy, 230, 130, 0, 0, TAU2); ctx.fill();
      for (let i = 0; i < 4; i++) { const yy = cy - 70 + i * 34 + by * 0.2; ctx.strokeStyle = 'rgba(3,4,9,0.55)'; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(cx - 150 + i * 14, yy + 18); ctx.quadraticCurveTo(cx, yy - 22, cx + 150 - i * 14, yy + 18); ctx.stroke(); ctx.strokeStyle = `rgba(185,200,240,${a * 0.28})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx - 140 + i * 14, yy + 3); ctx.quadraticCurveTo(cx, yy - 37, cx + 140 - i * 14, yy + 3); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(3,4,9,0.5)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(cx + 10, cy + 80); ctx.lineTo(cx - 4, 1990); ctx.stroke();
    } else { // blanket: wide soft folds (dark trough + light crest) and a knit grain
      for (let i = 0; i < 4; i++) { const fx = 80 + i * 135 + bx; ctx.strokeStyle = 'rgba(3,4,9,0.55)'; ctx.lineWidth = 34; ctx.beginPath(); ctx.moveTo(fx, y0 + 20); ctx.quadraticCurveTo(fx + 50, y0 + 150 + by, fx - 10, 1995); ctx.stroke(); ctx.strokeStyle = `rgba(185,200,240,${a * 0.3})`; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(fx + 30, y0 + 25); ctx.quadraticCurveTo(fx + 80, y0 + 150 + by, fx + 20, 1995); ctx.stroke(); }
      ctx.strokeStyle = `rgba(190,205,245,${a * 0.14})`; ctx.lineWidth = 3; ctx.setLineDash([9, 7]); for (let y = y0 + 6; y < 2000; y += 20) { ctx.beginPath(); ctx.moveTo(-120, y + by); ctx.lineTo(600, y + 8 + by); ctx.stroke(); } ctx.setLineDash([]);
    }
    ctx.restore();
    // edge: soft glow then a crisp line
    ctx.globalCompositeOperation = 'screen'; ctx.save(); ctx.beginPath(); ctx.rect(-200, y0 - 60, 1500, 440); ctx.clip();
    ctx.strokeStyle = col; ctx.globalAlpha = a * 0.28; ctx.lineWidth = 16; ctx.stroke(p);
    ctx.globalAlpha = Math.min(1, a * 0.95); ctx.lineWidth = 4; ctx.stroke(p); ctx.restore();
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
