// shots.mjs: one function per timeline scene id. Each draws a full frame into ctx and returns { cam, post?, noCaption?, after? }.
// All figure-system calls go through the helpers at the top (so a kit API change is fixed in one place).
import * as kit from '../../../.claude/skills/reel-factory/lib/kit/index.mjs';
import { mulberry32 } from '../../../.claude/skills/reel-factory/lib/kit/util.mjs';
import * as C from './set_coach.mjs';
import { sm, lerp, cl, PAL, TAU } from './set_coach.mjs';

const { cin } = kit;
const SPEC = {
  uncle: { age: 'elder', sex: 'm', outfit: 'kurta', style: 'horror', seed: 4, colors: { a: '#f4ecd2', b: '#6a6458', c: '#9a9080' } },
  narrator: { age: 'adult', sex: 'm', outfit: 'shirt', style: 'horror', seed: 9, colors: { a: '#3a5a7a', b: '#222a33', c: '#555' } },
  boy: { age: 'child', sex: 'm', outfit: 'shirt', style: 'horror', seed: 12, colors: { a: '#6a3a2a', b: '#222', c: '#555' } },
};
const FIG = {};
const fig = (k) => (FIG[k] ??= kit.createFigure(SPEC[k]));
// one place that talks to fig.draw: st = {x, feet, height, ...}
const drawFig = (c, k, st) => fig(k).draw(c, st);
const joints = (k, st) => fig(k).joints(st);

const lightFor = (P, o = {}) => {
  const sw = P.sweep, col = sw.kind === 'sodium' ? '#ffb050' : sw.kind === 'cool' ? '#9fffd8' : '#dbe9ff', w = cl(sw.i * (o.sweepK ?? 1));
  const lamp = { x: -0.7, y: -0.45 }, win = { x: 0.92, y: -0.12 };
  const dir = { x: lerp(lamp.x, win.x, w), y: lerp(lamp.y, win.y, w) };
  return { dir, key: w > 0.15 ? col : '#6f9bff', amb: '#1a2a4c', strength: (o.base ?? 0.7) + 0.9 * w, rim: w > 0.15 ? col : '#8fb4ff', rimA: 0.8 + 0.6 * w, hard: false };
};

// ---------------- shared bay compositions ----------------
const BAYDEF = (P, extra = {}) => ({ win: C.BAY.win, lamp: C.BAY.lamp, ...extra });

function bayLights(cam, P, W, o = {}) {
  const lp = cam.project(W.lamp[0], W.lamp[1], 3), sw = P.sweep, lights = [
    { type: 'point', x: lp.sx, y: lp.sy, r: 900, color: '#4d82ff', intensity: (o.lamp ?? 0.85) * (o.lampI ?? 1) },
    { type: 'point', x: 540, y: 650, r: 1500, color: '#2c4f86', intensity: 0.30 * (o.fill ?? 1) },
    { type: 'point', x: 540, y: 1500, r: 900, color: '#2a5a66', intensity: 0.16 * (o.fill ?? 1) },
  ];
  if (sw.i > 0.02) { const wp = cam.project(lerp(1250, -250, sw.u), 700, 3), col = sw.kind === 'sodium' ? '#ff9c38' : '#cfe4ff'; lights.push({ type: 'point', x: wp.sx, y: wp.sy, r: 800, color: col, intensity: 0.95 * sw.i * (o.sweepK ?? 1) }); }
  return lights;
}

// the uncle seated across the bay: torso above the seat, lap drape, shawl. o: {cx, lap, H, lean, eyeLight, gaze, expr, who}
function seatedFigure(c, P, o) {
  const H = o.H ?? 1700, pel = H * 0.5236, feet = o.lap + pel, who = o.who ?? 'uncle';
  const light = o.light ?? lightFor(P);
  const st = { x: o.cx, feet, height: H, facing: 1, pose: 'stand', t: P.t, light, gaze: o.gaze ?? [-0.3, 0.05], expr: o.expr ?? 'blank', talk: o.talkK ?? 0, look: o.look ?? 0.12, eyeLight: o.eyeLight ?? 0, contact: false,
    angles: { lean: o.lean ?? -0.02, headTilt: o.tilt ?? 0.0, shL: 0.1, shR: -0.1, elL: 0.55, elR: 0.5 }, reachL: [o.cx - H * 0.2, o.lap - H * 0.06], reachR: [o.cx + H * 0.2, o.lap - H * 0.05], grip: { L: 0.2, R: 0.25 } };
  c.save(); c.beginPath(); c.rect(-400, -400, 1900, o.lap + 400 - H * 0.03); c.clip(); drawFig(c, who, st); c.restore();
  // lap: cloth over the thighs, foreshortened toward the camera
  const lw = H * 0.46, x0 = o.cx - lw, x1 = o.cx + lw, y0 = o.lap - H * 0.05;
  const base = o.lapCol ?? '#8f8774';
  c.save(); const g = c.createLinearGradient(0, y0, 0, y0 + 220); g.addColorStop(0, base); g.addColorStop(1, '#2a2620');
  c.fillStyle = g; c.beginPath(); c.moveTo(x0 + 30, y0 + 40); c.bezierCurveTo(x0 + 60, y0 - 10, x0 + lw * 0.7, y0 - 24, o.cx, y0 - 14); c.bezierCurveTo(o.cx + lw * 0.7, y0 - 24, x1 - 60, y0 - 4, x1 - 20, y0 + 50); c.lineTo(x1 + 40, y0 + 240); c.lineTo(x0 - 30, y0 + 240); c.closePath(); c.fill();
  c.clip(); cin.fillTexture(c, 'fabric', [x0 - 40, y0 - 30, lw * 2 + 80, 300], { blend: 'overlay', alpha: 0.6, scale: 1.1, seed: 8 });
  c.strokeStyle = 'rgba(10,8,5,0.55)'; c.lineWidth = 4; for (let i = 0; i < 6; i++) { const fx = x0 + 60 + (i * (lw * 2 - 120)) / 5; c.beginPath(); c.moveTo(fx, y0 + 5 + (i % 2) * 8); c.quadraticCurveTo(fx + 14, y0 + 100, fx - 10 + (i - 2.5) * 8, y0 + 230); c.stroke(); }
  c.restore();
  if (o.shawl !== false) shawl(c, joints(who, st), H, o.shawlCol ?? '#474c52');
}
function shawl(c, J, H, col) {
  const [sx, sy] = J.neck, L = J.shoulderL, R = J.shoulderR, s = H / 1700;
  c.save(); const g = c.createLinearGradient(L[0], sy, R[0], sy + 500 * s); g.addColorStop(0, col); g.addColorStop(1, '#17191c'); c.fillStyle = g;
  c.beginPath(); c.moveTo(sx - 70 * s, sy - 8 * s);
  c.bezierCurveTo(L[0] - 70 * s, sy - 26 * s, L[0] - 120 * s, sy + 90 * s, L[0] - 90 * s, sy + 300 * s);
  c.lineTo(L[0] - 30 * s, sy + 390 * s); c.bezierCurveTo(sx - 110 * s, sy + 330 * s, sx - 40 * s, sy + 170 * s, sx - 6 * s, sy + 90 * s);
  c.bezierCurveTo(sx + 30 * s, sy + 170 * s, sx + 70 * s, sy + 330 * s, R[0] + 40 * s, sy + 380 * s); c.lineTo(R[0] + 100 * s, sy + 300 * s);
  c.bezierCurveTo(R[0] + 130 * s, sy + 90 * s, R[0] + 60 * s, sy - 26 * s, sx + 70 * s, sy - 8 * s); c.bezierCurveTo(sx + 30 * s, sy + 26 * s, sx - 30 * s, sy + 26 * s, sx - 70 * s, sy - 8 * s); c.closePath(); c.fill();
  c.save(); c.clip(); cin.fillTexture(c, 'fabric', [L[0] - 200 * s, sy - 40 * s, (R[0] - L[0]) + 400 * s, 520 * s], { blend: 'overlay', alpha: 0.75, scale: 0.9, seed: 21 });
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 3; for (let i = 0; i < 9; i++) { const fx = L[0] - 80 * s + i * ((R[0] - L[0] + 160 * s) / 8); c.beginPath(); c.moveTo(fx, sy + 20 * s); c.quadraticCurveTo(fx + 6, sy + 190 * s, fx - 4, sy + 380 * s); c.stroke(); }
  c.restore(); c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3; c.stroke(); c.restore();
}

// camera helper: composes the scene's base move + handheld rumble
const rumble = (P, seed = 3, amp = 0.8) => { const still = P.t >= P.E.stopT + 0.9 && P.t < P.E.itarsiT - 1.2 ? 0 : 1; return cin.handheldMove(seed, amp * (P.t >= P.E.stopT + 0.9 && P.t < P.E.itarsiT - 1.2 ? 0.0 : 1)); };

const rumbleK = (P) => { const t = P.t, a = P.E.stopT, b = P.E.itarsiT; return t < a ? 1 : t < a + 0.9 ? 1 - sm(a, a + 0.9, t) : t < b - 1.2 ? 0 : sm(b - 1.2, b + 0.5, t); };
const rumbleMove = (P, seed = 3, amp = 0.8) => (t) => cin.handheld(seed, amp * rumbleK(P), t);
const joltMove = (P) => (t) => { const d = t - P.E.stopT; return d >= 0 && d < 1.6 ? { y: 22 * Math.exp(-d * 4.2) * Math.cos(d * 17), roll: 0.004 * Math.exp(-d * 3) * Math.sin(d * 13) } : {}; };

function bayFrame(ctx, P, o) {
  const cam = cin.createCamera({}), W = o.W ?? BAYDEF(P), S = { t: P.t, ext: o.ext ?? 'night', sweep: o.noSweep ? { i: 0 } : P.sweep, lampI: o.lampI ?? 1, fanOn: o.fanOn ?? 1, board: o.board, boardText: o.boardText, slideSpeed: o.slideSpeed, boardOn: o.boardOn, boardFrac: o.boardFrac, boardW: o.boardW };
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
  const light = lightFor(P, { base: 0.75 * (1 - 0.55 * (o.closer ?? 0)) });
  const figs = o.figs ?? ((c) => seatedFigure(c, P, { cx: 400, lap: 1235, H: 2050, light, expr: 'blank', gaze: [0.1, 0.0], who: 'uncle' }));
  return bayFrame(ctx, P, { moves: o.moves, figs });
}

// ------------------------------------------------------------ ticket insert (s3, s11): same framing for the visual rhyme
function bgBayBlur(c, b, S) {
  c.fillStyle = '#060b14'; c.fillRect(b.x0 - 4, b.y0 - 4, b.w + 8, b.h + 8);
  C.bayWall(c, b, S, { win: [520, 260, 460, 760], lamp: [210, 420] });
  c.save(); c.globalCompositeOperation = 'destination-over'; C.drawExterior(c, [520, 260, 460, 760], S); c.restore();
  C.bayBackrest(c, b, S); C.baySeat(c, b, S);
  c.fillStyle = 'rgba(2,6,14,0.5)'; c.fillRect(b.x0, b.y0, b.w, b.h);
}
function ticketShot(ctx, P, o) {
  const cam = cin.createCamera({}), S = { t: P.t, ext: 'night', sweep: P.sweep, lampI: 1 };
  const p = P.lt / P.dur, rack = sm(0.04, 0.82, p);
  cam.update(P.t, cin.pushIn({ t0: P.sc.start_s, dur: P.dur, amount: 0.1 }), cin.handheldMove(6, 0.45));
  cam.layer(ctx, 3, (c, b) => bgBayBlur(c, b, S), { blur: lerp(3, 11, rack) });
  const Lf = lightFor(P, { base: 0.8 }), who = o.who;
  cam.layer(ctx, 1.0, (c) => {
    // ticket first (fingers overlap its right edge), then the giant arm
    c.save(); c.translate(360, 930); c.rotate(-0.11 + Math.sin(P.t * 1.1) * 0.012); drawTicketBig(c, o, P); c.restore();
    drawFig(c, who, { x: 1560, feet: 3500, height: 3600, facing: -1, pose: 'holdhand', t: P.t, light: Lf, reachR: [610, 1030 + Math.sin(P.t * 1.3) * 5], grip: { R: 0.62 }, look: 2.9, contact: false, expr: 'blank' });
  }, { blur: lerp(8, 0, rack) });
  C.sweepOverlay(ctx, S, { win: [520, 0, 460] }, 0.4);
  cin.fog(ctx, { t: P.t, depthBands: 1, density: 0.05, color: '#4a6080', seed: 6 });
  cam.layer(ctx, 0.6, (c, b) => { chainFg(c, S); }, { blur: 9 });
  return { cam };
}
const chainFg = (c, S) => { C.chain(c, 80, -40, 900, { sway: Math.sin(S.t * 0.9) * 0.7, link: 60, w: 26, col: '#2c3841' }); };
function drawTicketBig(c, o, P) { C.drawTicket(c, -330, -215, 660, 430, { age: o.age, date: o.date, pnr: o.pnr, route: o.route, name: o.name, berth: o.berth, seed: o.seed }); }

// ------------------------------------------------------------ aisle (s2)
function aisleShot(ctx, P, o = {}) {
  const cam = cin.createCamera({}), S = { t: P.t, tube: P.tube, sweep: P.sweep, lampI: 1, fanOn: 1 }, k = ctx.canvas.width / 1080;
  const dolly = (t) => ({ z: 0.16 * sm(P.sc.start_s, P.sc.end_s, t) });
  cam.update(P.t, dolly, rumbleMove(P, 5, 1.5), cin.pan({ t0: P.sc.start_s, dur: P.dur, from: -18, to: 22 }));
  cam.layer(ctx, 3, (c, b) => C.drawAisle(c, S), { fullBleed: false });
  cin.fog(ctx, { t: P.t, depthBands: 2, density: 0.1, color: '#3a5578', horizon: 0.45, height: 0.35, seed: 3 });
  cam.layer(ctx, 0.62, (c) => C.aisleFore(c, S), { blur: 10 });
  return { cam };
}

// ------------------------------------------------------------ MCU rule (s4)
function ruleShot(ctx, P) {
  const E = P.E, u = E.clock.between('rule', P.t), W = { win: [60, 360, 380, 700], lamp: [930, 560] };
  const lean = sm(0.05, 0.75, u), H = lerp(3000, 3500, lean), cx = lerp(640, 560, lean), head = lerp(760, 840, lean), feet = head + 0.9157 * H;
  const light = { ...lightFor(P, { base: 0.8 }), dir: { x: -0.9 * Math.max(0.3, P.sweep.i) - 0.25, y: -0.2 }, rimA: 1.5 };
  const figs = (c) => { const st = { x: cx, feet, height: H, facing: 1, pose: 'stand', t: P.t, light, gaze: [-0.15, 0.1], expr: 'blank', look: 0.0, eyeLight: 0, contact: false, angles: { lean: lerp(-0.02, 0.1, lean), headTilt: lerp(0, 0.06, lean), shL: 0.1, shR: -0.1 } }; drawFig(c, 'uncle', st); shawl(c, joints('uncle', st), H, '#59606a'); };
  const cam = bayFrame(ctx, P, { W, moves: [cin.pushIn({ t0: P.sc.start_s, dur: P.dur, amount: 0.06 }), cin.handheldMove(5, 0.9)], figs, noSeat: true, upper: false, bgBlur: 7, fg: false, fog: 0.05 });
  return { cam };
}

// ------------------------------------------------------------ s5 stop: the tubes flicker, the train halts, the window is black fog
function stopShot(ctx, P) {
  const tube = P.tube, W = { win: [150, 400, 780, 800], lamp: [130, 300] };
  const figs = (c) => seatedFigure(c, P, { cx: 330, lap: 1300, H: 1800, light: { ...lightFor(P, { base: 0.8 }), strength: 0.6 + 0.6 * tube }, expr: 'blank', gaze: [0.1, 0], who: 'uncle', lean: 0.02 });
  const fogDrift = (t) => ({});
  const cam = bayFrame(ctx, P, { W, ext: 'fog', noSweep: true, noSeat: false, upper: false, lightK: 0.5 + 0.7 * tube, ambient: '#05080f', figs,
    moves: [cin.pushIn({ t0: P.sc.start_s, dur: P.dur, amount: 0.07 }), rumbleMove(P, 7, 1.4), joltMove(P), cin.handheldMove(9, 0.12)],
    afterLight: (ctx2, cam2) => { // the ceiling tube fixture itself: emissive, flickering
      const k = ctx2.canvas.width / 1080, q = cam2.project(540, 120, 1.5); ctx2.save(); ctx2.setTransform(k, 0, 0, k, 0, 0); ctx2.globalCompositeOperation = 'screen';
      const g = ctx2.createRadialGradient(q.sx, q.sy + 40, 20, q.sx, q.sy + 160, 760 * q.scale); g.addColorStop(0, `rgba(200,225,255,${0.55 * tube})`); g.addColorStop(1, 'rgba(120,160,230,0)'); ctx2.fillStyle = g; ctx2.fillRect(0, 0, 1080, 1100);
      ctx2.globalCompositeOperation = 'source-over'; const w = 640 * q.scale; ctx2.fillStyle = '#0b0f13'; ctx2.fillRect(q.sx - w / 2 - 14, q.sy - 22, w + 28, 62); ctx2.fillStyle = `rgba(${Math.round(150 + 100 * tube)},${Math.round(180 + 70 * tube)},${Math.round(215 + 40 * tube)},${0.25 + 0.75 * tube})`; ctx2.fillRect(q.sx - w / 2, q.sy - 8, w, 34); ctx2.restore();
    } });
  return { cam };
}

// ------------------------------------------------------------ s6 eyes: he lies on his side, the camera trucks sideways, his eyes stay on the lens
function eyesShot(ctx, P) {
  const E = P.E, u = E.clock.between('eyes', P.t), camX = lerp(-170, 170, sm(0, 1, u)), g = P.glint, W = { win: [660, 330, 360, 700], lamp: [150, 480] };
  const H = 2100, px = 1160, py = 1000, light = { dir: { x: -0.7, y: -0.5 }, key: '#9bb8ff', amb: '#3a4a74', strength: 1.1 + 0.5 * g, rim: '#a8c4ff', rimA: 1.3, hard: false };
  const gaze = [clampG(-camX / 260), 0.35 * Math.sin(P.t * 0.7)];
  const figs = (c) => {
    c.fillStyle = '#444a50'; c.beginPath(); c.ellipse(px - 0.392 * H + 70, py + 120, 230, 100, 0.05, 0, TAU); c.fill(); c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.ellipse(px - 0.392 * H + 60, py + 150, 190, 60, 0.05, 0, TAU); c.fill();
    c.save(); c.translate(px, py); c.rotate(-Math.PI / 2); c.translate(-px, -py);
    const st = { x: px, feet: py + 0.5236 * H, height: H, facing: 1, pose: 'stand', t: P.t, light, gaze: [0.0, clampG(-camX / 300)], expr: 'blank', look: 0.0, eyeLight: 0.15 + 0.85 * g, contact: false, angles: { lean: 0.0, headTilt: -0.05 } };
    drawFig(c, 'uncle', st); c.restore();
    // glint on both eyes (additive), brighter when the lamp catches the wet of them
    const hd = joints('uncle', st).head; const ex = [[-0.205, -0.045], [0.04, -0.045]];
  };
  const mid = (c) => { // mattress, pillow and the blanket pulled to his chin
    c.fillStyle = '#10181c'; c.fillRect(-100, 1150, 1300, 120); C.rexineRect(c, -80, 1180, 1240, 120, { r: 16, seams: 4, seed: 5 });
    const g2 = c.createLinearGradient(0, 940, 0, 1190); g2.addColorStop(0, '#6a3a4c'); g2.addColorStop(1, '#2a1620'); c.fillStyle = g2; c.beginPath(); c.moveTo(640, 1190); c.bezierCurveTo(640, 960, 760, 930, 960, 960); c.bezierCurveTo(1120, 990, 1190, 1070, 1210, 1190); c.closePath(); c.fill();
    c.save(); c.clip(); cin.fillTexture(c, 'fabric', [400, 880, 820, 320], { blend: 'overlay', alpha: 0.7, scale: 1.0, seed: 7 }); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 4; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(520 + i * 110, 930 + (i % 2) * 14); c.quadraticCurveTo(540 + i * 110, 1060, 500 + i * 110, 1190); c.stroke(); } c.restore();
    
  };
  const cam = bayFrame(ctx, P, { W, noSweep: true, noSeat: true, upper: true, moves: [cin.pan({ t0: P.sc.start_s, dur: P.dur, from: -170, to: 170 }), cin.pushIn({ t0: P.sc.start_s, dur: P.dur, amount: 0.05 }), cin.handheldMove(4, 0.1)], figs, mid, ext: 'fog', lightK: 1.5 + 0.4 * g, fgChain: false,
    afterLight: (c2, cam2) => { // the glint itself
      if (g < 0.02) return; const k = c2.canvas.width / 1080; c2.save(); c2.setTransform(k, 0, 0, k, 0, 0);
      const st = { x: px, feet: py + 0.5236 * H, height: H }; for (const dy of [-70, 78]) { const q = cam2.project(px - 0.392 * H + 18 + (dy > 0 ? 0 : 0), py + dy - 48, 2.0); cin.glint(c2, q.sx, q.sy, { size: 70 * g * q.scale, alpha: g, t: P.t }); } c2.restore();
    } });
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
  const lights = [{ type: 'point', x: 540, y: 760, r: 1200, color: '#3d68b8', intensity: 1.3 * k }, { type: 'point', x: 540, y: 1450, r: 900, color: '#2d6a70', intensity: 0.7 * k }, { type: 'point', x: 540, y: 1000, r: 700, color: '#ffb84a', intensity: 0.12 + 0.35 * esc }];
  cin.darkMaskLayer(ctx, (o2) => {
    cam.layer(o2, 1.45, (c, b) => { const hands = C.rowBerths(c, b, S); for (const h of hands) C.dangleHand(c, h, S); });
  }, lights, { ambient: '#0a1020', glow: 0.25 });
  cin.fog(ctx, { t: P.t, depthBands: 2, density: 0.08, color: '#4a6080', seed: 9 });
  cam.layer(ctx, 0.7, (c, b) => { for (let i = Math.floor(b.x0 / 1500) - 1; i <= Math.ceil(b.x1 / 1500); i++) { C.steelBar(c, i * 1500 + 700, -40, i * 1500 + 700, 2000, 46, '#222c33'); C.chain(c, i * 1500 + 760, -40, 760, { sway: Math.sin(P.t + i) * 0.6, link: 54, w: 24, col: '#2c3841' }); } c.fillStyle = '#05090c'; c.fillRect(b.x0, 1830, b.w, 140); }, { blur: 8 });
  return { cam };
}

// ------------------------------------------------------------ s8 Itarsi
function itarsiShot(ctx, P) {
  const E = P.E, u = E.clock.between('itarsi', P.t), W = { win: [150, 300, 840, 900], lamp: [90, 470] };
  const arrive = sm(0.0, 0.26, u), rise = sm(0.52, 0.66, u), walk = sm(0.62, 0.97, u), smile = sm(0.56, 0.7, u);
  const warm = sm(0.02, 0.3, u) * (1 - 0.2 * sm(0.8, 1, u));
  const H = 1850, seatedFeet = 1235 + 0.5236 * H, standFeet = 2040;
  const light = { ...lightFor(P, { base: 0.5 + 0.6 * warm }), key: '#ffd7a0', amb: '#3a2a1e', strength: 0.45 + 0.5 * warm, rim: '#ffe2b0', rimA: 1.0 + warm };
  const figs = (c) => {
    const feet = lerp(seatedFeet, standFeet, rise), cx = lerp(520, -330, walk), hh = H * lerp(1, 0.82, walk);
    const st = { x: cx, feet: lerp(feet, standFeet - 90, walk), height: hh, facing: walk > 0.02 ? -1 : 1, pose: walk > 0.02 ? 'walk' : 'stand', t: P.t, light, gaze: [-0.2, 0], expr: smile > 0.3 ? 'happy' : 'blank', look: 0.1, eyeLight: 0.3 + 0.6 * warm, contact: false, phase: P.t * 5.2,
      angles: walk > 0.02 ? undefined : { lean: lerp(-0.02, 0.0, rise), shL: 0.1, shR: -0.1, elL: lerp(0.55, 0.15, rise), elR: lerp(0.5, 0.15, rise) } };
    c.save(); c.beginPath(); c.rect(-600, -400, 2400, lerp(1235 - 0.03 * H + 400, 3000, rise)); c.clip(); drawFig(c, 'uncle', st); c.restore();
    if (rise < 0.98) { c.save(); c.globalAlpha = 1 - rise; const lw = H * 0.46, y0 = 1235 - H * 0.05; c.fillStyle = '#9a917c'; c.beginPath(); c.moveTo(cx - lw + 30, y0 + 40); c.bezierCurveTo(cx - lw + 60, y0 - 10, cx - lw * 0.3, y0 - 24, cx, y0 - 14); c.bezierCurveTo(cx + lw * 0.3, y0 - 24, cx + lw - 60, y0 - 4, cx + lw - 20, y0 + 50); c.lineTo(cx + lw + 40, y0 + 240); c.lineTo(cx - lw - 30, y0 + 240); c.closePath(); c.fill(); c.restore(); }
    const jt = joints('uncle', st); shawl(c, jt, hh, '#5d636c');
  };
  const board = { x01: lerp(-0.9, 1.0, 1 - Math.pow(1 - arrive, 2.4)), blur: 40 * (1 - arrive) };
  const sweepSpeed = (1 - arrive) * 900 + 40;
  const cam = bayFrame(ctx, P, { W, ext: 'station', board, boardText: ['इटारसी', 'ITARSI', 'ITARSI JN'], slideSpeed: sweepSpeed, upper: false, fill: 1 + 0.4 * warm, lightK: 1 + 0.1 * warm, figs, boardFrac: 0.26, boardW: 720,
    moves: [cin.pushIn({ t0: P.sc.start_s, dur: P.dur, amount: 0.07 }), rumbleMove(P, 11, 1.2 * (1 - arrive) + 0.3), cin.handheldMove(12, 0.3)],
    extraLights: (cam2) => { const q = cam2.project(560, 760, 3); return [{ type: 'point', x: q.sx, y: q.sy, r: 1400, color: '#ffc078', intensity: 0.7 * warm }, { type: 'cone', x: q.sx, y: q.sy, angle: 1.9, spread: 0.9, length: 1500, color: '#ffd9a0', intensity: 0.4 * warm }]; },
    afterLight: (c2) => { const k = c2.canvas.width / 1080; c2.save(); c2.setTransform(k, 0, 0, k, 0, 0); c2.globalCompositeOperation = 'screen'; const g = c2.createRadialGradient(560, 740, 100, 560, 900, 1250); g.addColorStop(0, `rgba(255,205,140,${0.1 * warm})`); g.addColorStop(1, 'rgba(255,170,90,0)'); c2.fillStyle = g; c2.fillRect(0, 0, 1080, 1920); c2.restore(); },
    sweepStrength: 0.4 });
  return { cam, post: { name: 'horror-night', grade: { gain: [1 + 0.1 * warm, 1.0, 1.06 - 0.2 * warm], saturation: 0.82 + 0.25 * warm, splitTone: { shadows: '#03121c', highlights: '#ffb26a', shadowStrength: 0.5 - 0.2 * warm, highlightStrength: 0.45 + 0.3 * warm } } } };
}

// ------------------------------------------------------------ s9 relief: the lids close, the coach dims, black through the silence
function reliefShot(ctx, P) {
  const E = P.E, u = E.clock.between('relief', P.t), W = { win: [600, 330, 400, 720], lamp: [150, 520] };
  const close = sm(0.16, 0.86, u), warm = 1 - sm(0.0, 0.5, u), dim = 1 - 0.85 * sm(0.4, 1.0, u);
  const figs = (c) => { // the uncle's seat, empty: his shawl folded where he sat, his chappals on the floor
    c.fillStyle = '#4a4f57'; c.beginPath(); c.moveTo(150, 1240); c.bezierCurveTo(160, 1120, 420, 1090, 560, 1150); c.bezierCurveTo(640, 1190, 660, 1230, 680, 1250); c.closePath(); c.fill(); c.save(); c.clip(); cin.fillTexture(c, 'fabric', [140, 1080, 560, 200], { blend: 'overlay', alpha: 0.8, scale: 1.0, seed: 22 }); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 4; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(210 + i * 100, 1130); c.quadraticCurveTo(220 + i * 100, 1190, 200 + i * 100, 1245); c.stroke(); } c.restore();
  };
  const cam = bayFrame(ctx, P, { W, ext: 'station', board: { x01: 1, blur: 0 }, boardOn: false, noSweep: true, figs, lightK: dim * (0.7 + 0.5 * warm), fill: 1, moves: [cin.pushIn({ t0: P.sc.start_s, dur: P.dur, amount: 0.06 }), cin.handheldMove(14, 0.3)],
    extraLights: (cam2) => { const q = cam2.project(800, 700, 3); return [{ type: 'point', x: q.sx, y: q.sy, r: 1300, color: '#ffbd70', intensity: 0.9 * warm * dim }]; },
    afterLight: (c2) => { const k = c2.canvas.width / 1080; c2.save(); c2.setTransform(k, 0, 0, k, 0, 0); c2.globalCompositeOperation = 'screen'; const g = c2.createRadialGradient(800, 700, 80, 800, 760, 900); g.addColorStop(0, `rgba(255,190,120,${0.22 * warm})`); g.addColorStop(1, 'rgba(255,160,80,0)'); c2.fillStyle = g; c2.fillRect(0, 0, 1080, 1920); c2.restore(); } });
  return { cam, after: (c2) => {
    eyelids(c2, close);
    // through the closed lids: only the blue night lamp survives as a faint, steady glow
    const k = c2.canvas.width / 1080; c2.save(); c2.setTransform(k, 0, 0, k, 0, 0); c2.globalCompositeOperation = 'screen'; const a = 0.5 * sm(0.5, 0.9, u); const g = c2.createRadialGradient(170, 540, 0, 170, 540, 260); g.addColorStop(0, `rgba(60,110,230,${a})`); g.addColorStop(1, 'rgba(40,80,200,0)'); c2.fillStyle = g; c2.fillRect(0, 0, 1080, 1100); c2.restore();
  } };
}

// ------------------------------------------------------------ s10 Bhopal: hard cut from black on the scare, board whips away to the left
function bhopalShot(ctx, P) {
  const E = P.E, d = P.t - E.scareT; const W = { win: [60, 340, 960, 900], lamp: [900, 500] };
  if (d < 0) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); return { noPost: true, noCaption: true }; }
  const u = cl(d / 2.4), slide = 1 + 3.2 * Math.pow(u, 1.35), board = { x01: slide, blur: 30 + 190 * Math.pow(sm(0, 0.5, d), 0.8) };
  const whipX = 520 * Math.exp(-d * 7.5), cam = bayFrame(ctx, P, { W, ext: 'bhopal', boardFrac: 0.3, boardW: 820, board, boardText: ['भोपाल', 'BHOPAL', 'BHOPAL JN'], slideSpeed: 3200, upper: false, noSeat: false, lightK: 1.3, fill: 1.4, sweepStrength: 0.9, fg: true,
    moves: [(t) => ({ x: whipX, roll: 0.03 * Math.exp(-d * 6) }), cin.handheldMove(15, 1.2)],
    figs: (c) => {} });
  return { cam, after: (c2) => flash(c2, 0.7 * Math.exp(-d * 18)) };
}

// ------------------------------------------------------------ s12 loop: same framing as s1, the narrator sits where the uncle sat
function loopShot(ctx, P) {
  const E = P.E, end = E.tl?.duration_s ?? P.tl.duration_s, back = sm(0, 1, (P.t - E.clock.at('loop')) / (end - E.clock.at('loop')));
  const morph = sm(end - 1.5, end - 0.15, P.t), talkK = E.clock.between('loop', P.t) < 1 ? 0.5 + 0.5 * Math.sin(P.t * 13) * Math.sin(P.t * 4.1) : 0;
  const light = lightFor(P, { base: 0.75 });
  const figs = (c) => {
    const base = { cx: 400, lap: 1235, H: 2050, light, gaze: [0.1, 0], expr: 'blank' };
    if (morph < 0.99) { c.save(); c.globalAlpha = 1 - morph; seatedFigure(c, P, { ...base, who: 'narrator', lapCol: '#32465e', shawlCol: '#474c52', look: 0.12, talkK, expr: 'blank' }); c.restore(); }
    if (morph > 0.01) { c.save(); c.globalAlpha = morph; seatedFigure(c, P, { ...base, who: 'uncle' }); c.restore(); }
  };
  // pull back from a close push to the s1 start state; handheld phase lands on 0 at the last frame
  const dEnd = P.t - end;
  const cam = bayFrame(ctx, P, { moves: [(t) => ({ z: 0.1 * (1 - sm(0, 1, back)) * 1.0 + (0.12 - 0.12) }), (t) => cin.handheld(3, 0.7, dEnd)], figs });
  return { cam };
}

export const shots = {
  s1_hook(ctx, P) {
    const lineStart = P.E.clock.at('line01_start'), closer = sm(lineStart - 0.2, lineStart + 1.6, P.t);
    const light = lightFor(P, { base: 0.75 * (1 - 0.55 * closer) });
    const cam = bayFrame(ctx, P, { moves: [cin.pushIn({ t0: 0, dur: P.dur, amount: 0.12 }), () => ({ z: 0.1 * closer }), cin.handheldMove(3, 0.7)], figs: (c) => seatedFigure(c, P, { cx: 400, lap: 1235, H: 2050, light, expr: 'blank', gaze: [0.1, 0], who: 'uncle' }) });
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
