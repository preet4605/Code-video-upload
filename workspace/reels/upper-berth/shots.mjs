// shots.mjs: one function per timeline scene id. Each draws a full frame into ctx and returns { cam, post?, noCaption?, after? }.
// All figure-system calls go through the helpers at the top (so a kit API change is fixed in one place).
import * as kit from '../../../.claude/skills/reel-factory/lib/kit/index.mjs';
import { mulberry32, Path2D, ribbon, smoothClosed } from '../../../.claude/skills/reel-factory/lib/kit/util.mjs';
import * as C from './set_coach.mjs';
import { sm, lerp, cl, PAL, TAU } from './set_coach.mjs';

const { cin } = kit;
const SHAWL = { color: '#6e5c48', accent: '#c0904c', side: -1, fringe: 16, drop: 0.27 };
const SPEC = {
  // the uncle: grey receding hair, thick grey moustache, deep sockets (black until a light hits them), creased face, cotton kurta with a stitched placket, wool shawl over one shoulder
  uncle: { age: 'elder', sex: 'm', outfit: 'kurta', style: 'horror', seed: 4, headScale: 1.16, skin: '#b87c50', skinGrey: 0.1, hair: { style: 'receding', color: '#a8a398' }, moustache: { color: '#cfcac0', thick: 1 }, creased: true, sockets: true, browColor: '#85817a', colors: { a: '#ffeec8', b: '#8a8068', c: '#9a9080' }, shawl: SHAWL },
  narrator: { age: 'adult', sex: 'm', outfit: 'shirt', style: 'horror', seed: 9, skin: '#b07e58', skinGrey: 0.1, colors: { a: '#3a5a7a', b: '#222a33', c: '#555' } },
  // the narrator in s12: same shirt, same skin, same build, thirty years on: grey receding hair, a thinner moustache, creases, and the uncle's shawl
  narratorAged: { age: 'elder', sex: 'm', outfit: 'shirt', style: 'horror', seed: 9, headScale: 1.16, skin: '#b07e58', skinGrey: 0.1, hair: { style: 'receding', color: '#b9b5ab' }, moustache: { color: '#c4c0b6', thick: 0.7 }, creased: true, sockets: true, browColor: '#85817a', colors: { a: '#3a5a7a', b: '#222a33', c: '#555' }, shawl: SHAWL },
  boy: { age: 'child', sex: 'm', outfit: 'shirt', style: 'horror', seed: 12, colors: { a: '#6a3a2a', b: '#222', c: '#555' } },
};
const HOOK_H = 1900;
const FIG = {};
const fig = (k) => (FIG[k] ??= kit.createFigure(SPEC[k]));
// one place that talks to fig.draw: st = {x, feet, height, ...}
const drawFig = (c, k, st) => fig(k).draw(c, st);
const joints = (k, st) => fig(k).joints(st);

const lightFor = (P, o = {}) => {
  const sw = P.sweep, col = sw.kind === 'sodium' ? '#ffb050' : sw.kind === 'cool' ? '#9fffd8' : '#dbe9ff', w = cl(sw.i * (o.sweepK ?? 1));
  const lamp = { x: -0.7, y: -0.45 }, win = { x: 0.92, y: -0.12 };
  const dir = { x: lerp(lamp.x, win.x, w), y: lerp(lamp.y, win.y, w) };
  return { dir, key: w > 0.15 ? col : '#6f9bff', amb: '#1a2a4c', strength: (o.base ?? 0.7) + 0.3 + 0.9 * w, rim: w > 0.15 ? col : '#8fb4ff', rimA: 0.8 + 0.6 * w, hard: false };
};

// two lights that make the uncle read against the teal wall: a warm window-side point (rim + warmer skin) and a pale cool one over the lamp side; hy = head height in design px
const uncleLights = (cx, hy, o = {}) => (cam) => {
  const w = cam.project(cx + 430 * (o.side ?? 1), hy + 20, 2.0), k = cam.project(cx - 330 * (o.side ?? 1), hy - 160, 2.0);
  return [{ type: 'point', x: w.sx, y: w.sy, r: 1000 * (o.r ?? 1), color: o.warm ?? '#ff9448', intensity: o.wI ?? 1.9 }, { type: 'point', x: k.sx, y: k.sy, r: 700 * (o.r ?? 1), color: o.cool ?? '#9fbcff', intensity: o.cI ?? 0.35 }];
};
// the hook framing (s1 start == s12 end): a dolly-in on the uncle, head in the upper third, lap and hands below the caption line
const hookBase = () => ({ z: 0.4, y: -230 });
// ---------------- shared bay compositions ----------------
const BAYDEF = (P, extra = {}) => ({ win: C.BAY.win, lamp: C.BAY.lamp, ...extra });

function bayLights(cam, P, W, o = {}) {
  const lp = cam.project(W.lamp[0], W.lamp[1], 3), sw = P.sweep, lights = [
    { type: 'point', x: lp.sx, y: lp.sy, r: 900, color: '#4d82ff', intensity: (o.lamp ?? 1.1) * (o.lampI ?? 1) },
    { type: 'point', x: 540, y: 650, r: 1500, color: '#2c4f86', intensity: 0.5 * (o.fill ?? 1) },
    { type: 'point', x: 540, y: 1560, r: 1100, color: '#2f6a78', intensity: 0.78 * (o.fill ?? 1) },
  ];
  if (sw.i > 0.02) { const wp = cam.project(lerp(1250, -250, sw.u), 700, 3), col = sw.kind === 'sodium' ? '#ff9c38' : '#cfe4ff'; lights.push({ type: 'point', x: wp.sx, y: wp.sy, r: 800, color: col, intensity: 0.95 * sw.i * (o.sweepK ?? 1) }); }
  return lights;
}

// window-side rim light for the uncle: warm sodium-ish rim from the window (dir.x > 0 = window on the right), cool key; a passing sweep lights him fully and hits his eyes
const uncleLight = (P, o = {}) => {
  const sw = P.sweep, w = cl(sw.i), col = sw.kind === 'sodium' ? '#ffb050' : '#dbe9ff', side = o.side ?? 1;
  return { dir: { x: 0.82 * side, y: -0.3 }, key: w > 0.12 ? col : (o.key ?? '#9db6e6'), amb: '#1f2e52', strength: (o.base ?? 0.85) + 0.8 * w, rim: w > 0.12 ? col : (o.rim ?? '#ffbe85'), rimA: (o.rimA ?? 0.3) + 0.6 * w, hard: false };
};
// the uncle seated across the bay: torso above the seat, lap drape over the thighs, then his hands resting on the cloth. o: {cx, lap, H, lean, eyeLight, gaze, expr, who}
function seatedFigure(c, P, o) {
  const H = o.H ?? 1700, pel = H * 0.5236, feet = o.lap + pel, who = o.who ?? 'uncle';
  const light = o.light ?? uncleLight(P);
  const st = { x: o.cx, feet, height: H, facing: 1, pose: 'stand', t: P.t, light, gaze: o.gaze ?? [-0.3, 0.05], expr: o.expr ?? 'blank', talk: o.talkK ?? 0, look: o.look ?? 0.12, eyeLight: o.eyeLight ?? cl(P.sweep.i * 1.15), contact: false,
    angles: { lean: o.lean ?? -0.02, headTilt: o.tilt ?? 0.0, shL: 0.1, shR: -0.1, elL: 0.55, elR: 0.5 }, reachL: [o.cx - H * 0.2, o.lap - H * 0.075], reachR: [o.cx + H * 0.2, o.lap - H * 0.07], grip: { L: 0.3, R: 0.34 } };
  c.save(); c.beginPath(); c.rect(-400, -400, 1900, o.lap + 400 - H * 0.03); c.clip(); drawFig(c, who, st); c.restore();
  // lap: cloth over the thighs, foreshortened toward the camera
  const lw = H * 0.46, x0 = o.cx - lw, x1 = o.cx + lw, y0 = o.lap - H * 0.05;
  const base = o.lapCol ?? '#b9ae94';
  c.save(); const g = c.createLinearGradient(0, y0, 0, y0 + 220); g.addColorStop(0, base); g.addColorStop(1, '#2a2620');
  c.fillStyle = g; c.beginPath(); c.moveTo(x0 + 30, y0 + 40); c.bezierCurveTo(x0 + 60, y0 - 10, x0 + lw * 0.7, y0 - 24, o.cx, y0 - 14); c.bezierCurveTo(o.cx + lw * 0.7, y0 - 24, x1 - 60, y0 - 4, x1 - 20, y0 + 50); c.lineTo(x1 + 40, y0 + 240); c.lineTo(x0 - 30, y0 + 240); c.closePath(); c.fill();
  c.clip(); cin.fillTexture(c, 'fabric', [x0 - 40, y0 - 30, lw * 2 + 80, 300], { blend: 'overlay', alpha: 0.6, scale: 2.4, seed: 8 });
  c.strokeStyle = 'rgba(10,8,5,0.5)'; c.lineWidth = 4; for (let i = 0; i < 7; i++) { const fx = x0 + 60 + (i * (lw * 2 - 120)) / 6; c.beginPath(); c.moveTo(fx, y0 + 5 + (i % 2) * 8); c.quadraticCurveTo(fx + 14, y0 + 100, fx - 10 + (i - 3) * 8, y0 + 230); c.stroke(); c.strokeStyle = 'rgba(255,240,210,0.12)'; c.lineWidth = 3; c.beginPath(); c.moveTo(fx + 8, y0 + 8); c.quadraticCurveTo(fx + 22, y0 + 100, fx - 2 + (i - 3) * 8, y0 + 225); c.stroke(); c.strokeStyle = 'rgba(10,8,5,0.5)'; c.lineWidth = 4; }
  c.restore();
  fig(who).hands(c, st);
}

// camera helper: composes the scene's base move + handheld rumble
const rumble = (P, seed = 3, amp = 0.8) => { const still = P.t >= P.E.stopT + 0.9 && P.t < P.E.itarsiT - 1.2 ? 0 : 1; return cin.handheldMove(seed, amp * (P.t >= P.E.stopT + 0.9 && P.t < P.E.itarsiT - 1.2 ? 0.0 : 1)); };

const rumbleK = (P) => { const t = P.t, a = P.E.stopT, b = P.E.itarsiT; return t < a ? 1 : t < a + 0.9 ? 1 - sm(a, a + 0.9, t) : t < b - 1.2 ? 0 : sm(b - 1.2, b + 0.5, t); };
const rumbleMove = (P, seed = 3, amp = 0.8) => (t) => cin.handheld(seed, amp * rumbleK(P), t);
const joltMove = (P) => (t) => { const d = t - P.E.stopT; return d >= 0 && d < 1.6 ? { y: 22 * Math.exp(-d * 4.2) * Math.cos(d * 17), roll: 0.004 * Math.exp(-d * 3) * Math.sin(d * 13) } : {}; };

function bayFrame(ctx, P, o) {
  const cam = cin.createCamera({}), W = o.W ?? BAYDEF(P), S = { t: P.t, ext: o.ext ?? 'night', sweep: o.noSweep ? { i: 0 } : P.sweep, lampI: o.lampI ?? 1, fanOn: o.fanOn ?? 1, board: o.board, boardText: o.boardText, slideSpeed: o.slideSpeed, boardOn: o.boardOn, boardFrac: o.boardFrac, boardW: o.boardW, boardCx: o.boardCx, boardLit: o.boardLit };
  cam.update(P.t, ...(o.moves || []));
  const lk = o.lightK ?? 1, bl = o.bgBlur ? { blur: o.bgBlur } : {};
  cam.layer(ctx, 3, (c, b) => C.drawExterior(c, W.win, S), bl);
  const lights = bayLights(cam, P, W, { lampI: (o.lampI ?? 1) * lk, sweepK: o.noSweep ? 0 : 1, fill: (o.fill ?? 1) * lk });
  if (o.extraLights) lights.push(...o.extraLights(cam));
  cin.darkMaskLayer(ctx, (o2) => {
    cam.layer(o2, 3, (c, b) => C.bayWall(c, b, S, W), bl);
    if (!o.noSeat) cam.layer(o2, 2.4, (c, b) => C.bayBackrest(c, b, S), bl);
    if (o.figs) cam.layer(o2, 2.0, (c) => o.figs(c, cam, S));
    if (!o.noSeat) cam.layer(o2, 1.8, (c, b) => C.baySeat(c, b, S), bl);
    if (o.mid) cam.layer(o2, 1.8, (c, b) => o.mid(c, b, S));
    if (o.upper !== false) cam.layer(o2, 1.5, (c, b) => C.bayUpper(c, b, S), bl);
    if (o.top) cam.layer(o2, 1.5, (c, b) => o.top(c, b, S));
  }, lights, { ambient: o.ambient ?? '#04070e', glow: 0.22 });
  { const k = ctx.canvas.width / 1080; ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0); const lp = cam.project(W.lamp[0], W.lamp[1], 3); ctx.translate(lp.sx - W.lamp[0], lp.sy - W.lamp[1]); C.bayLampGlow(ctx, { ...S, lampI: (o.lampI ?? 1) * lk }, W); ctx.restore(); }
  if (!o.noSweep) { const wp = cam.project(W.win[0], W.win[1], 3), sc = cam.project(0, 0, 3).scale; C.sweepOverlay(ctx, S, { win: [wp.sx, 0, W.win[2] * sc] }, o.sweepStrength ?? 0.55); }
  if (o.seatLines) { const k = ctx.canvas.width / 1080; ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0); const q = cam.project(0, 0, 1.8); ctx.translate(q.sx, q.sy); ctx.scale(q.scale, q.scale); ctx.strokeStyle = 'rgba(150,205,215,0.42)'; ctx.lineWidth = 3; for (const y of [1330, 1556, 1584]) { ctx.beginPath(); ctx.moveTo(-80, y); ctx.lineTo(1160, y); ctx.stroke(); } for (let i = 1; i <= 5; i++) { const x = -80 + 1240 * i / 6; ctx.beginPath(); ctx.moveTo(x, 1336); ctx.lineTo(x, 1552); ctx.stroke(); } ctx.restore(); }
  if (o.afterLight) o.afterLight(ctx, cam);
  cin.fog(ctx, { t: P.t, depthBands: 2, density: o.fog ?? 0.07, color: '#4a6080', horizon: 0.55, height: 0.5, seed: 4 });
  if (o.fg !== false) cam.layer(ctx, 0.6, (c, b) => C.bayFore(c, b, S, { chain: o.fgChain }), { blur: 6 });
  return cam;
}

// ---- helpers shared by several shots
const eyelids = (ctx, k, soft = 60) => {
  if (k <= 0.001) return; const s = ctx.canvas.width / 1080; ctx.save(); ctx.setTransform(s, 0, 0, s, 0, 0);
  const H = 1920, edge = k * H * 0.53; // each lid covers up to just past the middle
  for (const dir of [-1, 1]) {
    const yE = dir < 0 ? edge : H - edge, bow = 90 * (1 - k * 0.6) * dir; ctx.save();
    ctx.beginPath(); if (dir < 0) { ctx.moveTo(-40, -40); ctx.lineTo(1120, -40); ctx.lineTo(1120, yE); ctx.quadraticCurveTo(540, yE + bow * 2, -40, yE); } else { ctx.moveTo(-40, H + 40); ctx.lineTo(1120, H + 40); ctx.lineTo(1120, yE); ctx.quadraticCurveTo(540, yE + bow * 2, -40, yE); }
    ctx.closePath(); ctx.fillStyle = '#000'; ctx.fill();
    const g = ctx.createLinearGradient(0, yE - dir * soft, 0, yE + dir * (soft * 0.5) + bow); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.9)'); ctx.fillStyle = g; ctx.fillRect(0, Math.min(yE - dir * soft, yE + bow), 1080, soft * 2 + Math.abs(bow));
    ctx.restore();
  }
  ctx.restore();
};
const flash = (ctx, a, col = '255,246,226') => { if (a <= 0.003) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(${col},${a})`; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); };

// the hook framing, shared by s1 and s12 (so the loop matches). who: 'uncle'|'narrator'; k: closeness 0..1
function hookFrame(ctx, P, o) {
  const light = uncleLight(P, { base: 0.85 * (1 - 0.3 * (o.closer ?? 0)) });
  const figs = o.figs ?? ((c) => seatedFigure(c, P, { cx: 400, lap: 1235, H: HOOK_H, light, expr: 'blank', gaze: [0.1, 0.0], who: 'uncle' }));
  return bayFrame(ctx, P, { fill: 0.85, moves: o.moves, figs, extraLights: uncleLights(400, 450) });
}

// ------------------------------------------------------------ ticket insert (s3, s11): same framing for the visual rhyme
// out-of-focus backdrop: the bay wall + window and, behind the ticket, the person it belongs to (uncle: grey, moustache; narrator: young, blue shirt)
function bgBayBlur(c, b, S) {
  c.fillStyle = '#060b14'; c.fillRect(b.x0 - 4, b.y0 - 4, b.w + 8, b.h + 8);
  C.bayWall(c, b, S, { win: [640, 300, 380, 700], lamp: [150, 420] });
  c.save(); c.globalCompositeOperation = 'destination-over'; C.drawExterior(c, [640, 300, 380, 700], S); c.restore();
  C.bayBackrest(c, b, S); C.baySeat(c, b, S);
  c.fillStyle = 'rgba(8,14,26,0.35)'; c.fillRect(b.x0, b.y0, b.w, b.h);
}
function ticketShot(ctx, P, o) {
  const cam = cin.createCamera({}), S = { t: P.t, ext: 'night', sweep: P.sweep, lampI: 1 };
  const p = P.lt / P.dur, rack = sm(0.04, 0.82, p);
  cam.update(P.t, cin.pushIn({ t0: P.sc.start_s, dur: P.dur, amount: 0.07 }), cin.handheldMove(6, 0.4));
  cin.darkMaskLayer(ctx, (o2) => {
    cam.layer(o2, 3, (c, b) => bgBayBlur(c, b, S), { blur: lerp(4, 8, rack) });
    // the holder, far out of focus behind the paper: his face sits above the ticket in the dark, eyes black
    cam.layer(o2, 2.2, (c) => seatedFigure(c, P, { cx: 470, lap: 1380, H: 2300, who: o.who === 'uncle' ? 'uncle' : 'narrator', light: uncleLight(P, { base: 0.9 }), look: 0.05, gaze: [0, 0.1], eyeLight: 0 }), { blur: lerp(8, 12, rack) });
  }, [{ type: 'point', x: 200, y: 400, r: 1000, color: '#4d82ff', intensity: 0.9 }, { type: 'point', x: 540, y: 900, r: 1500, color: '#37588e', intensity: 0.75 }, { type: 'point', x: 480, y: 1450, r: 1000, color: '#4a6ea8', intensity: 0.6 }, { type: 'point', x: 900, y: 700, r: 900, color: '#ff9448', intensity: 0.5 + 0.9 * P.sweep.i }], { ambient: '#04070e', glow: 0.2 });
  // the berth edge under the ticket: crisp rexine seams and piping (set dressing for the lower third, below the caption line)
  cam.layer(ctx, 1.3, (c, b) => { C.rexineRect(c, -80, 1500, 1260, 300, { r: 26, seams: 5, hi: '#2f7a76', base: '#1d5654', lo: '#0a1f20', seed: 21 }); c.fillStyle = '#090e11'; c.fillRect(-80, 1790, 1260, 200); C.steelBar(c, -80, 1840, 1160, 1840, 22, '#33414a'); }, { blur: 0 });
  // the ticket and the hand that holds it: sharp from the first frame (only the background racks)
  cam.layer(ctx, 1.0, (c) => holdTicket(c, o, P), { blur: 0 });
  C.sweepOverlay(ctx, S, { win: [640, 0, 380] }, 0.35);
  cin.fog(ctx, { t: P.t, depthBands: 1, density: 0.04, color: '#4a6080', seed: 6 });
  cam.layer(ctx, 0.6, (c, b) => { chainFg(c, S); }, { blur: 9 });
  return { cam, clarity: 1.6, post: { name: 'horror-night', grade: { contrast: 0.2, saturation: 0.7 } } };
}
// skin / sleeve palettes for the hands (uncle: warm brown + cream kurta; narrator: lighter + blue shirt)
const HAND_SKIN = { uncle: ['#c08a5e', '#8a5a3a', '#3a2214'], narrator: ['#c89870', '#94663f', '#3a2214'] };
function holdTicket(c, o, P) {
  const who = o.who, tkW = 740, tkH = tkW * 430 / 640, cx = 450, cy = 840, rot = -0.07 + Math.sin(P.t * 1.1) * 0.008;
  const skin = HAND_SKIN[who], env = { L: { x: 0.8, y: -0.5 }, key: '#ffd2a0', amb: '#2a3a60', strength: 1.0, hard: false };
  const hx = 945 + Math.sin(P.t * 1.3) * 3, hy = 1165 + Math.sin(P.t * 1.7) * 4, phi = -0.82;
  const fill = (path, g, ink = true) => { c.fillStyle = g; c.fill(path); if (ink) { c.strokeStyle = 'rgba(14,8,4,0.8)'; c.lineWidth = 3; c.lineJoin = 'round'; c.stroke(path); } };
  const lg = (x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([k, col]) => g.addColorStop(k, col)); return g; };
  // ---- hand and forearm, local frame: origin at the wrist, fingers toward -y
  c.save(); c.translate(hx, hy); c.rotate(phi);
  // forearm (bare skin between cuff and wrist) and sleeve
  const sleeveCol = who === 'uncle' ? ['#d9cfb4', '#6e6650'] : ['#4a6e98', '#1e3250'];
  { const fa = new Path2D(); fa.moveTo(-52, 150); fa.bezierCurveTo(-58, 220, -66, 300, -72, 380); fa.lineTo(72, 380); fa.bezierCurveTo(66, 300, 60, 220, 54, 150); fa.closePath(); fill(fa, lg(-70, 0, 70, 0, [[0, skin[0]], [0.6, skin[1]], [1, skin[2]]])); }
  // sleeve: cloth with folds, a stitched cuff band, a button
  { const sl = new Path2D(); sl.moveTo(-84, 224); sl.bezierCurveTo(-110, 300, -150, 420, -170, 620); sl.lineTo(190, 620); sl.bezierCurveTo(170, 420, 120, 300, 86, 220); sl.closePath(); c.save(); c.fillStyle = lg(-150, 0, 160, 0, [[0, sleeveCol[0]], [0.55, who === 'uncle' ? '#b2a88e' : '#3a5a82'], [1, sleeveCol[1]]]); c.fill(sl); c.strokeStyle = 'rgba(14,8,4,0.8)'; c.lineWidth = 3; c.stroke(sl); c.clip(sl);
    cin.fillTexture(c, who === 'uncle' ? 'plaster' : 'fabric', [-200, 200, 400, 440], { blend: 'overlay', alpha: 0.5, scale: 1.4, seed: 4 });
    if (who !== 'uncle') { c.strokeStyle = 'rgba(190,215,245,0.12)'; c.lineWidth = 3; for (let i = -6; i < 7; i++) { c.beginPath(); c.moveTo(i * 26 - 60, 220); c.lineTo(i * 30 - 70, 640); c.stroke(); } }
    for (let i = 0; i < 6; i++) { const fx = -90 + i * 36; c.strokeStyle = 'rgba(0,0,0,0.34)'; c.lineWidth = 9; c.beginPath(); c.moveTo(fx * 0.7, 235 + (i % 2) * 14); c.quadraticCurveTo(fx * 1.1 + 12, 380, fx * 1.5 + 20, 610); c.stroke(); c.strokeStyle = 'rgba(255,240,210,0.13)'; c.lineWidth = 5; c.beginPath(); c.moveTo(fx * 0.7 + 10, 238 + (i % 2) * 14); c.quadraticCurveTo(fx * 1.1 + 22, 380, fx * 1.5 + 30, 610); c.stroke(); }
    // cuff band
    c.fillStyle = who === 'uncle' ? 'rgba(236,228,206,0.55)' : 'rgba(30,50,80,0.5)'; c.beginPath(); c.moveTo(-96, 214); c.lineTo(98, 208); c.lineTo(112, 282); c.lineTo(-110, 292); c.closePath(); c.fill(); c.strokeStyle = 'rgba(14,8,4,0.75)'; c.lineWidth = 3; c.stroke();
    c.setLineDash([10, 8]); c.strokeStyle = 'rgba(30,20,10,0.55)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-104, 270); c.lineTo(104, 262); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#e6dfca'; c.strokeStyle = '#2a2014'; c.lineWidth = 2.5; c.beginPath(); c.arc(60, 246, 11, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#2a2014'; for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { c.beginPath(); c.arc(60 + dx, 246 + dy, 1.6, 0, TAU); c.fill(); }
    c.restore(); }
  // back of the hand: palm bulk, knuckle ridge, tendons, wrinkles
  { const bh = new Path2D(); bh.moveTo(-62, 168); bh.bezierCurveTo(-92, 100, -104, 20, -96, -40); bh.bezierCurveTo(-60, -66, 70, -66, 98, -36); bh.bezierCurveTo(104, 30, 90, 110, 62, 168); bh.closePath();
    fill(bh, lg(-100, -40, 100, 120, [[0, skin[0]], [0.5, mixc(skin[0], skin[1], 0.6)], [1, skin[2]]]));
    c.save(); c.clip(bh); c.strokeStyle = 'rgba(40,20,10,0.22)'; c.lineWidth = 4; c.lineCap = 'round'; for (let i = 0; i < 4; i++) { const x = -60 + i * 40; c.beginPath(); c.moveTo(x, -44); c.quadraticCurveTo(x * 0.7, 60, x * 0.45, 150); c.stroke(); }
    c.strokeStyle = 'rgba(255,225,190,0.16)'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { const x = -60 + i * 40 + 6; c.beginPath(); c.moveTo(x, -42); c.quadraticCurveTo(x * 0.7, 60, x * 0.45 + 4, 148); c.stroke(); }
    for (let i = 0; i < 4; i++) { const x = -66 + i * 44; c.fillStyle = 'rgba(255,225,190,0.16)'; c.beginPath(); c.ellipse(x, -34, 20, 13, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(40,20,10,0.35)'; c.lineWidth = 2.5; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x - 12, -34 + k * 6 - 2); c.quadraticCurveTo(x, -34 + k * 6 + 5, x + 12, -34 + k * 6 - 2); c.stroke(); } }
    cin.fillTexture(c, 'plaster', [-120, -80, 240, 260], { blend: 'multiply', alpha: 0.18, scale: 1.2, seed: 8 });
    c.restore(); }
  // fingers: they run on behind the paper, only the first joints show past its right edge (tapered ribbons with knuckle bumps, a slight curl)
  for (const [fx, ln, w, lean] of [[66, 150, 50, 0.16], [22, 178, 54, 0.07], [-22, 172, 52, -0.02], [-64, 132, 46, -0.12]]) {
    const pts = [[fx, -34], [fx + lean * ln * 0.35, -34 - ln * 0.36], [fx + lean * ln * 0.75, -34 - ln * 0.68], [fx + lean * ln * 1.2, -34 - ln]], ws = [w, w * 0.9, w * 0.86, w * 0.72];
    const fp = smoothClosed(ribbon(pts, ws, { n: 6, bulge: 0.07, cap: 5 }));
    fill(fp, lg(fx - w / 2, 0, fx + w / 2, 0, [[0, skin[0]], [0.4, mixc(skin[0], skin[1], 0.45)], [1, skin[1]]]), false); c.strokeStyle = 'rgba(14,8,4,0.55)'; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke(fp);
    c.save(); c.clip(fp); c.strokeStyle = 'rgba(40,20,10,0.45)'; c.lineWidth = 2.4; c.lineCap = 'round';
    for (const k of [0.36, 0.68]) for (let m = 0; m < 3; m++) { const q = [pts[0][0] + (pts[3][0] - pts[0][0]) * k, pts[0][1] + (pts[3][1] - pts[0][1]) * k]; c.beginPath(); c.moveTo(q[0] - w * 0.3, q[1] - 6 + m * 5); c.quadraticCurveTo(q[0], q[1] - 1 + m * 5, q[0] + w * 0.3, q[1] - 6 + m * 5); c.stroke(); }
    c.strokeStyle = 'rgba(255,225,190,0.2)'; c.lineWidth = 5; c.beginPath(); c.moveTo(fx - w * 0.16, -40); c.lineTo(pts[3][0] - w * 0.16, pts[3][1]); c.stroke(); c.restore();
  }
  c.restore();
  // ---- the ticket on top of the fingers
  c.save(); c.translate(cx, cy); c.rotate(rot);
  C.drawTicket(c, -tkW / 2, -tkH / 2, tkW, tkH, { age: o.age, date: o.date, pnr: o.pnr, route: o.route, name: o.name, berth: o.berth, seed: o.seed });
  c.restore();
  // ---- the thumb pressing the paper from the front, with its nail, joint creases and a contact shadow on the print
  c.save(); c.translate(hx, hy); c.rotate(phi);
  { c.save(); c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(-124, -72, 62, 96, 0.28, 0, TAU); c.fill(); c.restore();
    const tp = [[-66, 128], [-104, 58], [-116, -24], [-102, -104]], tw = [76, 66, 60, 52];
    const th = smoothClosed(ribbon(tp, tw, { n: 8, bulge: 0.06, cap: 5 }));
    fill(th, lg(-150, -60, -40, 40, [[0, skin[0]], [0.45, mixc(skin[0], skin[1], 0.5)], [1, skin[1]]]), false); c.strokeStyle = 'rgba(14,8,4,0.6)'; c.lineWidth = 2.2; c.lineJoin = 'round'; c.stroke(th);
    c.save(); c.clip(th); c.strokeStyle = 'rgba(40,20,10,0.45)'; c.lineWidth = 2.6; c.lineCap = 'round'; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(-142, 14 + k * 6); c.quadraticCurveTo(-110, 24 + k * 6, -76, 12 + k * 6); c.stroke(); }
    c.strokeStyle = 'rgba(255,225,190,0.2)'; c.lineWidth = 7; c.beginPath(); c.moveTo(-136, 92); c.quadraticCurveTo(-148, 0, -128, -96); c.stroke(); c.restore();
    // nail
    const nl = new Path2D(); nl.moveTo(-126, -96); nl.bezierCurveTo(-132, -134, -84, -142, -80, -108); nl.bezierCurveTo(-80, -82, -104, -66, -120, -76); nl.closePath(); c.fillStyle = lg(-120, -140, -80, -70, [[0, '#ecd2bd'], [1, '#b99478']]); c.fill(nl); c.strokeStyle = 'rgba(40,20,10,0.5)'; c.lineWidth = 2.2; c.stroke(nl); c.fillStyle = 'rgba(255,255,255,0.28)'; c.beginPath(); c.ellipse(-110, -112, 10, 5, -0.4, 0, TAU); c.fill(); }
  c.restore();
}
const mixc = (a, b, k) => { const A = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), B = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16)); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const chainFg = (c, S) => { C.chain(c, 80, -40, 900, { sway: Math.sin(S.t * 0.9) * 0.7, link: 60, w: 26, col: '#2c3841' }); };

// ------------------------------------------------------------ aisle (s2)
function aisleShot(ctx, P, o = {}) {
  const cam = cin.createCamera({}), S = { t: P.t, tube: P.tube, sweep: P.sweep, lampI: 1, fanOn: 1 }, k = ctx.canvas.width / 1080;
  const dolly = (t) => ({ z: 0.1 + 0.3 * sm(P.sc.start_s, P.sc.end_s, t) });
  cam.update(P.t, dolly, rumbleMove(P, 5, 1.5), cin.pan({ t0: P.sc.start_s, dur: P.dur, from: -18, to: 22 }));
  cam.layer(ctx, 3, (c, b) => C.drawAisle(c, S), { fullBleed: false });
  cin.fog(ctx, { t: P.t, depthBands: 2, density: 0.1, color: '#3a5578', horizon: 0.45, height: 0.35, seed: 3 });
  cam.layer(ctx, 0.62, (c) => C.aisleFore(c, S), { blur: 4 });
  return { cam, clarity: 3.4, clarityR: 6, post: { name: 'horror-night', grade: { contrast: 0.9, gain: [1.35, 1.35, 1.45] } } };
}

// ------------------------------------------------------------ MCU rule (s4)
function ruleShot(ctx, P) {
  const E = P.E, u = E.clock.between('rule', P.t), W = { win: [60, 360, 380, 700], lamp: [930, 560] };
  const lean = sm(0.05, 0.75, u), H = lerp(3000, 3500, lean), cx = lerp(640, 560, lean), head = lerp(760, 840, lean), feet = head + 0.9157 * H;
  const light = uncleLight(P, { side: -1, base: 0.9, rimA: 0.45, rim: '#e8a870' });
  const figs = (c) => { const st = { x: cx, feet, height: H, facing: 1, pose: 'stand', t: P.t, light, gaze: [-0.15, 0.1], expr: 'blank', look: 0.0, eyeLight: cl(P.sweep.i * 1.2), contact: false, angles: { lean: lerp(-0.02, 0.1, lean), headTilt: lerp(0, 0.06, lean), shL: 0.1, shR: -0.1 } }; drawFig(c, 'uncle', st); };
  const cam = bayFrame(ctx, P, { W, moves: [cin.pushIn({ t0: P.sc.start_s, dur: P.dur, amount: 0.06 }), cin.handheldMove(5, 0.9)], figs, noSeat: true, upper: false, bgBlur: 3, fg: false, fog: 0.05 });
  return { cam, clarity: 5.2, clarityR: 6 };
}

// ------------------------------------------------------------ s5 stop: the tubes flicker, the train halts, the window is black fog
function stopShot(ctx, P) {
  const tube = P.tube, W = { win: [150, 400, 780, 800], lamp: [130, 300] };
  const figs = (c) => seatedFigure(c, P, { cx: 560, lap: 1380, H: 2350, light: uncleLight(P, { side: 0.55, base: 0.9 + 0.5 * tube, rimA: 1.1 + 0.6 * tube, rim: '#bcd4ff', key: '#b4c8f0' }), expr: 'blank', gaze: [0.1, 0], who: 'uncle', lean: 0.02, eyeLight: 0.1 * tube });
  const fogDrift = (t) => ({});
  const cam = bayFrame(ctx, P, { W, ext: 'fog', noSweep: true, noSeat: false, upper: false, lightK: 0.32 + 0.5 * tube, ambient: '#05080f', figs,
    moves: [() => ({ z: 0.3, y: -140 }), cin.pushIn({ t0: P.sc.start_s, dur: P.dur, amount: 0.07 }), rumbleMove(P, 7, 1.4), joltMove(P), cin.handheldMove(9, 0.12)], extraLights: uncleLights(560, 330, { side: 1, warm: '#cfe0ff', wI: 1.3, cool: '#9fbcff', cI: 0.6 }),
    afterLight: (ctx2, cam2) => { // the ceiling tube fixture itself: emissive, flickering
      const k = ctx2.canvas.width / 1080, q = cam2.project(540, 120, 1.5); ctx2.save(); ctx2.setTransform(k, 0, 0, k, 0, 0); ctx2.globalCompositeOperation = 'screen';
      const g = ctx2.createRadialGradient(q.sx, q.sy + 40, 20, q.sx, q.sy + 160, 760 * q.scale); g.addColorStop(0, `rgba(200,225,255,${0.55 * tube})`); g.addColorStop(1, 'rgba(120,160,230,0)'); ctx2.fillStyle = g; ctx2.fillRect(0, 0, 1080, 1100);
      ctx2.globalCompositeOperation = 'source-over'; const w = 640 * q.scale; ctx2.fillStyle = '#0b0f13'; ctx2.fillRect(q.sx - w / 2 - 14, q.sy - 22, w + 28, 62); ctx2.fillStyle = `rgba(${Math.round(150 + 100 * tube)},${Math.round(180 + 70 * tube)},${Math.round(215 + 40 * tube)},${0.25 + 0.75 * tube})`; ctx2.fillRect(q.sx - w / 2, q.sy - 8, w, 34); ctx2.restore();
    } });
  return { cam, post: { name: 'horror-night', grade: { contrast: 0.9, gain: [1.3, 1.3, 1.4] } } };
}

// ------------------------------------------------------------ s6 eyes: he lies on his side, the camera trucks sideways, his eyes stay on the lens
function eyesShot(ctx, P) {
  const E = P.E, u = E.clock.between('eyes', P.t), camX = lerp(-170, 170, sm(0, 1, u)), g = P.glint, W = { win: [660, 330, 360, 700], lamp: [150, 480] };
  const H = 2500, px = 1330, py = 960, light = { dir: { x: -0.7, y: -0.5 }, key: '#9bb8ff', amb: '#3a4a74', strength: 1.1 + 0.5 * g, rim: '#a8c4ff', rimA: 1.3, hard: false };
  const gaze = [clampG(-camX / 260), 0.35 * Math.sin(P.t * 0.7)];
  const figs = (c) => {
    c.fillStyle = '#444a50'; c.beginPath(); c.ellipse(px - 0.392 * H + 70, py + 120, 230, 100, 0.05, 0, TAU); c.fill(); c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.ellipse(px - 0.392 * H + 60, py + 150, 190, 60, 0.05, 0, TAU); c.fill();
    c.save(); c.translate(px, py); c.rotate(-Math.PI / 2); c.translate(-px, -py);
    const st = { x: px, feet: py + 0.5236 * H, height: H, facing: 1, pose: 'stand', t: P.t, light, gaze: [0.0, clampG(-camX / 300)], expr: 'blank', look: 0.0, eyeLight: 0.15 + 0.85 * g, contact: false, angles: { lean: 0.0, headTilt: -0.05 } };
    drawFig(c, 'uncle', st);
    if (g > 0.02) { const hd = joints('uncle', st).head; for (const sx of [-1, 1]) cin.glint(c, hd[0] + sx * 0.03 * H, hd[1] + 0.004 * H, { size: 26 * g, alpha: 0.9 * g, t: P.t }); }
    c.restore();
  };
  const mid = (c) => { // mattress, pillow and the blanket pulled to his chin
    c.fillStyle = '#10181c'; c.fillRect(-100, 1150, 1300, 120); C.rexineRect(c, -80, 1180, 1240, 120, { r: 16, seams: 4, seed: 5 });
    const g2 = c.createLinearGradient(0, 940, 0, 1190); g2.addColorStop(0, '#6a3a4c'); g2.addColorStop(1, '#2a1620'); c.fillStyle = g2; c.beginPath(); c.moveTo(640, 1190); c.bezierCurveTo(640, 960, 760, 930, 960, 960); c.bezierCurveTo(1120, 990, 1190, 1070, 1210, 1190); c.closePath(); c.fill();
    c.save(); c.clip(); cin.fillTexture(c, 'fabric', [400, 880, 820, 320], { blend: 'overlay', alpha: 0.7, scale: 1.0, seed: 7 }); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 4; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(520 + i * 110, 930 + (i % 2) * 14); c.quadraticCurveTo(540 + i * 110, 1060, 500 + i * 110, 1190); c.stroke(); } c.restore();
    
  };
  const cam = bayFrame(ctx, P, { W, noSweep: true, noSeat: true, upper: true, moves: [cin.pan({ t0: P.sc.start_s, dur: P.dur, from: -170, to: 170 }), cin.pushIn({ t0: P.sc.start_s, dur: P.dur, amount: 0.05 }), cin.handheldMove(4, 0.1)], figs, mid, ext: 'fog', lightK: 1.5 + 0.4 * g, fgChain: false
  });
  return { cam };
}
const clampG = (v) => Math.max(-1, Math.min(1, v));

// ------------------------------------------------------------ s7 tickets: lateral track along the berths
function ticketsShot(ctx, P) {
  const E = P.E, u = E.clock.between('tickets', P.t), esc = sm(0.0, 1.0, u), S = { t: P.t, escal: esc, tube: P.tube };
  const cam = cin.createCamera({}), x0 = P.sc.start_s, ease = (v) => Math.pow(v, 1.5);
  const track = (t) => ({ x: -600 + 3700 * ease(cl((t - x0) / P.dur)) });
  cam.update(P.t, track, cin.pushIn({ t0: x0, dur: P.dur, amount: 0.05 }), cin.handheldMove(2, 0.35 + 0.6 * esc));
  const k = 0.55 + 0.45 * P.tube;
  cam.layer(ctx, 3, (c, b) => C.rowBack(c, b, S));
  const lights = [{ type: 'point', x: 540, y: 760, r: 1200, color: '#3d68b8', intensity: 1.0 * k }, { type: 'point', x: 540, y: 1450, r: 900, color: '#2d6a70', intensity: 0.5 * k }, { type: 'point', x: 540, y: 900, r: 1300, color: '#ffb84a', intensity: 0.4 + 0.45 * esc }, { type: 'point', x: 540, y: 1500, r: 1100, color: '#ffa844', intensity: 0.28 + 0.3 * esc }];
  cin.darkMaskLayer(ctx, (o2) => {
    cam.layer(o2, 1.45, (c, b) => { const hands = C.rowBerths(c, b, S); for (const h of hands) C.dangleHand(c, h, S); });
  }, lights, { ambient: '#0a1020', glow: 0.25 });
  cin.fog(ctx, { t: P.t, depthBands: 2, density: 0.08, color: '#4a6080', seed: 9 });
  cam.layer(ctx, 0.7, (c, b) => { for (let i = Math.floor(b.x0 / 1500) - 1; i <= Math.ceil(b.x1 / 1500); i++) { C.steelBar(c, i * 1500 + 700, -40, i * 1500 + 700, 2000, 46, '#222c33'); C.chain(c, i * 1500 + 760, -40, 760, { sway: Math.sin(P.t + i) * 0.6, link: 54, w: 24, col: '#2c3841' }); } c.fillStyle = '#05090c'; c.fillRect(b.x0, 1830, b.w, 140); }, { blur: 8 });
  return { cam, post: { name: 'horror-night', grade: { contrast: 0.9, gain: [1.4, 1.4, 1.5] } } };
}

// ------------------------------------------------------------ s8 Itarsi
function itarsiShot(ctx, P) {
  const E = P.E, u = E.clock.between('itarsi', P.t), W = { win: [150, 300, 840, 900], lamp: [90, 470] };
  const arrive = sm(0.0, 0.26, u), rise = sm(0.52, 0.66, u), walk = sm(0.62, 0.97, u), smile = sm(0.56, 0.7, u);
  const warm = 0.7 * sm(0.02, 0.3, u) * (1 - 0.2 * sm(0.8, 1, u));
  const H = 1850, seatedFeet = 1235 + 0.5236 * H, standFeet = 2040;
  const light = { ...lightFor(P, { base: 0.5 + 0.6 * warm }), key: '#ffd7a0', amb: '#3a2a1e', strength: 0.45 + 0.5 * warm, rim: '#ffe2b0', rimA: 1.0 + warm };
  const figs = (c) => {
    const feet = lerp(seatedFeet, standFeet, rise), cx = lerp(520, -330, walk), hh = H * lerp(1, 0.82, walk);
    const st = { x: cx, feet: lerp(feet, standFeet - 90, walk), height: hh, facing: walk > 0.02 ? -1 : 1, pose: walk > 0.02 ? 'walk' : 'stand', t: P.t, light, gaze: [-0.2, 0], expr: smile > 0.3 ? 'happy' : 'blank', look: 0.1, eyeLight: 0.3 + 0.6 * warm, contact: false, phase: P.t * 5.2,
      angles: walk > 0.02 ? undefined : { lean: lerp(-0.02, 0.0, rise), shL: 0.1, shR: -0.1, elL: lerp(0.55, 0.15, rise), elR: lerp(0.5, 0.15, rise) } };
    c.save(); c.beginPath(); c.rect(-600, -400, 2400, lerp(1235 - 0.03 * H + 400, 3000, rise)); c.clip(); drawFig(c, 'uncle', st); c.restore();
    if (rise < 0.98) { c.save(); c.globalAlpha = 1 - rise; const lw = H * 0.46, y0 = 1235 - H * 0.05; c.fillStyle = '#9a917c'; c.beginPath(); c.moveTo(cx - lw + 30, y0 + 40); c.bezierCurveTo(cx - lw + 60, y0 - 10, cx - lw * 0.3, y0 - 24, cx, y0 - 14); c.bezierCurveTo(cx + lw * 0.3, y0 - 24, cx + lw - 60, y0 - 4, cx + lw - 20, y0 + 50); c.lineTo(cx + lw + 40, y0 + 240); c.lineTo(cx - lw - 30, y0 + 240); c.closePath(); c.fill(); c.restore(); }
  };
  const board = { x01: lerp(-0.9, 1.0, 1 - Math.pow(1 - arrive, 2.4)), blur: 40 * (1 - arrive) };
  const sweepSpeed = (1 - arrive) * 900 + 40;
  const cam = bayFrame(ctx, P, { W, ext: 'station', board, boardText: ['इटारसी', 'ITARSI', 'ITARSI JN'], slideSpeed: sweepSpeed, upper: false, seatLines: true, ambient: '#0a1420', fill: 1 + 0.4 * warm, lightK: 0.9 + 0.1 * warm, figs, boardFrac: 0.26, boardW: 720,
    moves: [cin.pushIn({ t0: P.sc.start_s, dur: P.dur, amount: 0.07 }), rumbleMove(P, 11, 1.2 * (1 - arrive) + 0.3), cin.handheldMove(12, 0.3)],
    extraLights: (cam2) => { const q = cam2.project(560, 760, 3); return [{ type: 'point', x: q.sx, y: q.sy, r: 1400, color: '#ffc078', intensity: 0.42 * warm }, { type: 'cone', x: q.sx, y: q.sy, angle: 1.9, spread: 0.9, length: 1500, color: '#ffd9a0', intensity: 0.22 * warm }]; },
    afterLight: (c2) => { const k = c2.canvas.width / 1080; c2.save(); c2.setTransform(k, 0, 0, k, 0, 0); c2.globalCompositeOperation = 'screen'; const g = c2.createRadialGradient(560, 740, 100, 560, 900, 1250); g.addColorStop(0, `rgba(255,205,140,${0.1 * warm})`); g.addColorStop(1, 'rgba(255,170,90,0)'); c2.fillStyle = g; c2.fillRect(0, 0, 1080, 1920); c2.restore(); },
    sweepStrength: 0.4 });
  return { cam, clarity: 1.0, post: { name: 'horror-night', grade: { contrast: 0.3, gain: [0.86 + 0.1 * warm, 0.84, 0.9 - 0.2 * warm], saturation: 0.75 + 0.1 * warm, splitTone: { shadows: '#03121c', highlights: '#ffb26a', shadowStrength: 0.5 - 0.2 * warm, highlightStrength: 0.45 + 0.3 * warm } } } };
}

// ------------------------------------------------------------ s9 relief: the lids close, the coach dims, black through the silence
function reliefShot(ctx, P) {
  const E = P.E, u = E.clock.between('relief', P.t), W = { win: [600, 330, 400, 720], lamp: [150, 520] };
  const close = sm(0.34, 0.95, u), warm = 1 - sm(0.0, 0.7, u), dim = 1 - 0.85 * sm(0.55, 1.0, u);
  const figs = (c) => { // the uncle's seat, empty: his shawl folded where he sat, his chappals on the floor
    c.fillStyle = '#8b9199'; c.strokeStyle = '#0a0705'; c.lineWidth = 5; c.beginPath(); c.moveTo(120, 1245); c.bezierCurveTo(130, 1060, 430, 1020, 600, 1110); c.bezierCurveTo(700, 1170, 720, 1230, 740, 1250); c.closePath(); c.fill(); c.stroke(); c.save(); c.clip(); cin.fillTexture(c, 'fabric', [120, 1040, 640, 220], { blend: 'overlay', alpha: 0.8, scale: 1.0, seed: 22 }); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 4; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(210 + i * 100, 1130); c.quadraticCurveTo(220 + i * 100, 1190, 200 + i * 100, 1245); c.stroke(); } c.restore();
  };
  const cam = bayFrame(ctx, P, { W, ext: 'station', board: { x01: 1, blur: 0 }, boardOn: false, noSweep: true, figs, lightK: dim * (0.7 + 0.5 * warm), fill: 1, moves: [cin.pushIn({ t0: P.sc.start_s, dur: P.dur, amount: 0.06 }), cin.handheldMove(14, 0.3)],
    extraLights: (cam2) => { const q = cam2.project(800, 700, 3), q2 = cam2.project(400, 1150, 2); return [{ type: 'point', x: q.sx, y: q.sy, r: 1300, color: '#ffbd70', intensity: 0.9 * warm * dim }, { type: 'point', x: q2.sx, y: q2.sy, r: 700, color: '#9fb4e8', intensity: 0.9 * dim }]; },
    afterLight: (c2) => { const k = c2.canvas.width / 1080; c2.save(); c2.setTransform(k, 0, 0, k, 0, 0); c2.globalCompositeOperation = 'screen'; const g = c2.createRadialGradient(800, 700, 80, 800, 760, 900); g.addColorStop(0, `rgba(255,190,120,${0.22 * warm})`); g.addColorStop(1, 'rgba(255,160,80,0)'); c2.fillStyle = g; c2.fillRect(0, 0, 1080, 1920); c2.restore(); } });
  return { cam, after: (c2) => {
    eyelids(c2, close);
    // through the closed lids: only the blue night lamp survives as a faint, steady glow
    const k = c2.canvas.width / 1080; c2.save(); c2.setTransform(k, 0, 0, k, 0, 0); c2.globalCompositeOperation = 'screen'; const a = 1.0 * sm(0.5, 0.9, u); const g = c2.createRadialGradient(170, 540, 0, 170, 540, 330); g.addColorStop(0, `rgba(80,130,255,${a})`); g.addColorStop(0.4, `rgba(60,110,240,${a * 0.6})`); g.addColorStop(1, 'rgba(40,80,200,0)'); c2.fillStyle = g; c2.fillRect(0, 0, 1080, 1100); c2.restore();
  } };
}

// ------------------------------------------------------------ s10 Bhopal: the scare. Black, then ONE hard hit on the event (white flash + camera jolt),
// then the yellow BHOPAL board slides left at a walking pace and stays fully readable for ~1.4 s; motion blur only as it leaves.
function bhopalShot(ctx, P) {
  const E = P.E, d = P.t - E.scareT, W = { win: [60, 340, 960, 900], lamp: [900, 500], bars: 3, barW: 7, rail: false };
  if (d < 0) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); return { noPost: true, noCaption: true }; }
  const cx = d < 1.7 ? 600 - 160 * Math.max(0, d - 0.1) : (() => { const q = d - 1.7; return 344 - 160 * q - 260 * q * q; })();
  const blur = 62 * sm(1.9, 3.0, d), board = { x01: 1, blur };
  const jolt = (t) => { const k = t - E.scareT; return k >= 0 ? { y: 64 * Math.exp(-k * 9) * Math.cos(k * 50), roll: 0.018 * Math.exp(-k * 8) * Math.sin(k * 35), z: 0.07 * Math.exp(-k * 10) } : {}; };
  const cam = bayFrame(ctx, P, { W, ext: 'bhopal', boardFrac: 0.2, boardW: 700, board, boardCx: cx, boardLit: 1, boardText: ['भोपाल', 'BHOPAL', 'BHOPAL JN'], slideSpeed: 260, upper: false, noSeat: false, seatLines: true, ambient: '#0a1420', lightK: 0.9, fill: 0.9, sweepStrength: 0.3, fg: true,
    moves: [() => ({ z: 0.18, y: -40 }), jolt, cin.handheldMove(15, 0.35)], figs: (c) => {} });
  const a = d < 0.07 ? 0.95 : 0.95 * Math.exp(-(d - 0.07) * 14);
  return { cam, clarity: 1.8, after: (c2) => flash(c2, a), post: { name: 'horror-night', grade: { contrast: 0.3 } } };
}

// ------------------------------------------------------------ s12 loop: same framing as s1, the narrator sits where the uncle sat
function loopShot(ctx, P) {
  const E = P.E, end = E.tl?.duration_s ?? P.tl.duration_s, back = sm(0, 1, (P.t - E.clock.at('loop')) / (end - E.clock.at('loop')));
  const morph = sm(end - 1.5, end - 0.15, P.t), talkK = E.clock.between('loop', P.t) < 1 ? 0.5 + 0.5 * Math.sin(P.t * 13) * Math.sin(P.t * 4.1) : 0;
  const light = uncleLight(P, { base: 0.85 });
  const figs = (c) => {
    const base = { cx: 400, lap: 1235, H: HOOK_H, light, gaze: [0.1, 0], expr: 'blank' };
    if (morph < 0.99) { c.save(); c.globalAlpha = 1 - morph; seatedFigure(c, P, { ...base, who: 'narratorAged', lapCol: '#3a4a60', look: 0.12, talkK, expr: 'blank' }); c.restore(); }
    if (morph > 0.01) { c.save(); c.globalAlpha = morph; seatedFigure(c, P, { ...base, who: 'uncle' }); c.restore(); }
  };
  // pull back from a close push to the s1 start state; handheld phase lands on 0 at the last frame
  const dEnd = P.t - end;
  const cam = bayFrame(ctx, P, { fill: 0.6, moves: [hookBase, (t) => ({ z: 0.1 * (1 - sm(0, 1, back)) }), (t) => cin.handheld(3, 0.7, dEnd)], figs, extraLights: uncleLights(400, 450) });
  return { cam };
}

export const shots = {
  s1_hook(ctx, P) {
    const lineStart = P.E.clock.at('line01_start'), closer = sm(lineStart - 0.2, lineStart + 1.6, P.t);
    const light = uncleLight(P, { base: 0.85 * (1 - 0.3 * closer) });
    const cam = bayFrame(ctx, P, { fill: 0.85, moves: [hookBase, cin.pushIn({ t0: 0, dur: P.dur, amount: 0.1 }), () => ({ z: 0.08 * closer }), cin.handheldMove(3, 0.7)], figs: (c) => seatedFigure(c, P, { cx: 400, lap: 1235, H: HOOK_H, light, expr: 'blank', gaze: [0.1, 0], who: 'uncle' }), extraLights: uncleLights(400, 450) });
    return { cam };
  },
  s2_coach: (ctx, P) => aisleShot(ctx, P),
  s3_ticket: (ctx, P) => ticketShot(ctx, P, { who: 'uncle', age: 1, date: '14-06-2014', pnr: '4521368790', route: 'ITARSI JN  -  DELHI', name: 'RAMESH CHANDRA', berth: 'LB/33', seed: 1 }),
  s4_rule: ruleShot,
  s5_stop: stopShot,
  s6_eyes: eyesShot,
  s7_tickets: ticketsShot,
  s8_itarsi: itarsiShot,
  s9_relief: reliefShot,
  s10_bhopal: bhopalShot,
  s11_ticket2(ctx, P) { const E = P.E, age = sm(E.clock.at('twist') - 0.1, E.clock.at('twist_end') - 0.3, P.t); return ticketShot(ctx, P, { who: 'narrator', age: 0.12 + 0.88 * age, date: '14-06-2026', pnr: '2681945307', route: 'DELHI  -  BHOPAL JN', name: 'ARJUN VERMA', berth: 'LB/34', seed: 3 }); },
  s12_loop: loopShot,
};
