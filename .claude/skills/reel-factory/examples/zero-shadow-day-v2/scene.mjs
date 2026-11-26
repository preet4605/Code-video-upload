// Zero Shadow Day v2: three shots remade with lib/kit (sets + puppet figures) and lib/cinema (camera, light, post).
// Same timeline.json / captions / timing as ../zero-shadow-day. Shots: s1_hook (courtyard wide), s2_dadi (doorway kitchen, then the
// hands), s5_hand (the hand-hold). Any other time falls back to the s1 composition (only these three are remade).
// Contract: VideoClock.setTime(t); VideoClock.draw(ctx, w, h, timeline). Deterministic f(t).
import * as kit from '../../lib/kit/index.mjs';
import { buildTunnel, UPM } from '../../lib/kit/sets/tunnel.mjs';
import { quadPath, bbox } from '../../lib/kit/sets/core.mjs';
import { drawHand } from '../../lib/kit/figures/hand.mjs';
import * as K from '../zero-shadow-day/tools/kit.mjs';

const { cin } = kit;
const TAU = Math.PI * 2, cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k, sm = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const T_VANISH = 24.15; // story clock: the shadows retreat here (from the original scene)

// ------------------------------------------------------------------ shot 1: courtyard, children holding hands, no shadows, wet footprints
let courtyard = null, kids = null;
function shotHook(ctx, t, lt, dur, w) {
  courtyard ??= kit.buildSet('schoolCourtyard', { tod: 'noon', seed: 7, palette: 'whitewash', shadowK: 0, props: ['well', 'tree'] });
  kids ??= [{ age: 'child', outfit: 'uniform', seed: 11 }, { age: 'child', sex: 'f', outfit: 'uniform', seed: 12, hair: { style: 'braid' } }, { age: 'child', outfit: 'uniform', seed: 13 }, { age: 'child', sex: 'f', outfit: 'uniform', seed: 14, hair: { style: 'bob' } }, { age: 'child', outfit: 'uniform', seed: 15 }].map((s) => kit.createFigure(s));
  const S = courtyard, p = lt / dur, cam = cin.createCamera({});
  cam.update(t, cin.pushIn({ t0: 0, dur, amount: 0.12 }), cin.pan({ t0: 0, dur, from: 24, to: -18 }), cin.handheldMove(3, 0.8));
  const Z = 1.32, light = { ...kit.LIGHTS.noon, strength: 1.1 };
  const SP = 0.68, xs = [-2, -1, 0, 1, 2].map((i) => S.place({ z: Z, x: i * SP - 0.1, meters: 1.12 }));
  const trail = () => { // wet bare footprints in front of the line, evaporating in sequence
    const k = ctx.canvas.width / 1080; ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0);
    for (let i = 0; i < 14; i++) {
      const Zm = 0.74 + i * 0.045 + 0.0, Xm = -0.55 + i * 0.085 + (i % 2 ? 0.1 : -0.1) * 1, side = i % 2 ? 1 : -1;
      const px = cam.project(S.vp.x + (Xm * UPM) / (Zm + 0.1), S.vp.y + S.groundH / (Zm + 0.1), Z + 0.1);
      const evap = sm(0.25 + i * 0.05, 0.8 + i * 0.05, p + 0.12), a = (1 - evap) * 0.75; if (a < 0.02) continue;
      const sc = px.scale * 2.0 / (Zm + 0.1) * 0.62;
      ctx.save(); ctx.translate(px.sx, px.sy); ctx.rotate(0.15 * side); ctx.scale(sc, sc * 0.55);
      ctx.fillStyle = `rgba(40,36,32,${a * 0.6})`; ctx.beginPath(); ctx.ellipse(0, 18, 20, 42, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(side * 3, -38, 24, 26, 0, 0, TAU); ctx.fill();
      for (let q = 0; q < 5; q++) { ctx.beginPath(); ctx.ellipse(-24 + q * 12, -72 + Math.abs(q - 2) * 6, 7 - Math.abs(q - 2), 8, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = `rgba(255,255,255,${a * 0.5})`; ctx.beginPath(); ctx.ellipse(-8, -30, 6, 24, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  };
  const sub = [{ depth: Z + 0.1, draw: (c) => trail() }];
  kids.forEach((f, i) => sub.push({ depth: Z, draw: (c) => {
    const base = xs[i], at = [(xs[i].x + (xs[Math.min(4, i + 1)].x)) / 2, base.feet - base.height * 0.46], atL = [(xs[i].x + xs[Math.max(0, i - 1)].x) / 2, base.feet - base.height * 0.46];
    const q = cam.project(base.x, base.feet, Z), ph = cam.project(base.x, base.feet - base.height, Z), hh = (q.sy - ph.sy);
    const st = { x: q.sx, feet: q.sy, height: hh, pose: 'stand', t: t + i * 0.37, light, gaze: [0.3 + 0.1 * i, 0.05], expr: i === 2 ? 'worried' : 'neutral', contact: true, contactA: 0.28,
      reachR: i < 4 ? [(cam.project(at[0], at[1], Z)).sx, (cam.project(at[0], at[1], Z)).sy] : undefined, reachL: i > 0 ? [(cam.project(atL[0], atL[1], Z)).sx, (cam.project(atL[0], atL[1], Z)).sy] : undefined };
    f.draw(c, st);
  } }));
  S.render(ctx, cam, t, { subjects: sub });
  return cam;
}

// ------------------------------------------------------------------ shot 2: the dark kitchen, blown-out doorway, Dadi, then the hands
function kitchenDef() {
  return {
    name: 'kitchen', tod: 'noon', palette: 'mud', W0: 1.25 * UPM, Hc: 780, zEnd: 5.2, n: 3, z0: 1.0, vpY: 870, wear: 0.7, forceMask: true, ambient: '#2a1c12', glow: 0.22,
    style: { left: 'plain', right: 'plain', dado: null, fog: 0.2, floor: '#6a4c36', floorTex: 'stone', tile: 0.9, ceil: '#2a1d14', wallColor: { '-1': '#9a7656', 1: '#8a6a4e' } },
    end(c, G, S) { const { P, Hf } = G, zE = G.zEnd, a = P(-0.9 * UPM, Hf - 2.2 * UPM, zE), b = P(0.9 * UPM, Hf, zE); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); },
    items({ G, S }) {
      const { P, W0, Hf } = G, it = [];
      it.push({ id: 'shelf', type: 'shelf', z: 2.9, dz: 0.1, draw(c) { const X = -W0 + 2, y = Hf - 1.55 * UPM; const q = [P(X, y, 2.0), P(X, y, 3.9), P(X, y + 0.06 * UPM, 3.9), P(X, y + 0.06 * UPM, 2.0)]; c.fillStyle = '#3a2a1c'; c.fill(quadPath(q));
        for (let k = 0; k < 6; k++) { const z = 2.15 + k * 0.3, p = P(X + 0.08 * UPM, y, z), r = 0.17 * UPM / z; const g = c.createLinearGradient(p[0] - r, 0, p[0] + r, 0); g.addColorStop(0, '#f2f2ee'); g.addColorStop(0.5, '#a9aca8'); g.addColorStop(1, '#4a4c4c'); c.fillStyle = g; c.beginPath(); c.ellipse(p[0], p[1] - r * 0.55, r * 0.55, r * 0.9, 0, 0, TAU); c.fill(); c.fillStyle = '#d5d7d2'; c.beginPath(); c.ellipse(p[0], p[1] - r * 1.35, r * 0.55, r * 0.2, 0, 0, TAU); c.fill(); } } });
      it.push({ id: 'matka', type: 'matka', z: 2.6, dz: 0.1, draw(c) { const p = P(-W0 + 0.55 * UPM, Hf, 2.6), r = 0.32 * UPM / 2.6; const g = c.createRadialGradient(p[0] - r * 0.3, p[1] - r * 1.2, r * 0.1, p[0], p[1] - r, r * 1.3); g.addColorStop(0, '#d08a55'); g.addColorStop(0.6, '#7a3a1c'); g.addColorStop(1, '#1d0d06'); c.fillStyle = g; c.beginPath(); c.ellipse(p[0], p[1] - r * 0.95, r, r * 1.05, 0, 0, TAU); c.fill(); c.fillStyle = '#2a1209'; c.beginPath(); c.ellipse(p[0], p[1] - r * 1.9, r * 0.5, r * 0.14, 0, 0, TAU); c.fill(); } });
      it.push({ id: 'chulha', type: 'chulha', z: 3.6, dz: 0.1, draw(c, G2, S2, t) { const p = P(-W0 + 0.5 * UPM, Hf, 3.6), w = 0.7 * UPM / 3.6, h = 0.5 * UPM / 3.6; c.fillStyle = '#3a281b'; c.fillRect(p[0] - w, p[1] - h, w * 2, h); c.fillStyle = '#16100b'; c.fillRect(p[0] - w * 0.55, p[1] - h * 0.8, w * 1.1, h * 0.5);
        const em = 0.65 + 0.35 * Math.sin(t * 3.1) * Math.cos(t * 1.7); c.save(); c.globalCompositeOperation = 'screen'; const g = c.createRadialGradient(p[0], p[1] - h * 0.55, 0, p[0], p[1] - h * 0.55, w * 2.4); g.addColorStop(0, `rgba(255,140,50,${0.7 * em})`); g.addColorStop(1, 'rgba(255,100,20,0)'); c.fillStyle = g; c.fillRect(p[0] - w * 3, p[1] - h * 3, w * 6, h * 6); c.restore(); } });
      // the doorway: blown out white, floor shaft
      it.push({ id: 'door', type: 'doorway', z: 2.5, dz: 0.05, draw(c, G2, S2, t) { const X = W0 - 2, za = 1.9, zb = 3.1, h = 2.2 * UPM, q = [P(X, Hf, za), P(X, Hf, zb), P(X, Hf - h, zb), P(X, Hf - h, za)];
        c.fillStyle = '#2a1c12'; c.fill(quadPath([P(X, Hf, za - 0.12), P(X, Hf, zb + 0.12), P(X, Hf - h - 0.12 * UPM, zb + 0.12), P(X, Hf - h - 0.12 * UPM, za - 0.12)]));
        c.fillStyle = '#fffef0'; c.fill(quadPath(q)); c.save(); c.clip(quadPath(q)); const m = P(X, Hf - h / 2, 2.5), g = c.createRadialGradient(m[0], m[1], 0, m[0], m[1], 400); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,250,225,1)'); c.fillStyle = g; c.fillRect(m[0] - 500, m[1] - 700, 1000, 1400); c.restore();
        c.save(); c.globalCompositeOperation = 'screen'; const sh = quadPath([P(X, Hf, za), P(X, Hf, zb), P(X - 1.9 * UPM, Hf, zb - 0.5), P(X - 1.6 * UPM, Hf, za - 0.9)]); c.fillStyle = 'rgba(255,248,215,0.62)'; c.fill(sh); c.restore(); } });
      return it;
    },
    lights({ G }) { const a = G.P(G.W0, G.Hf - 2.2 * UPM, 1.9), b = G.P(G.W0, G.Hf, 3.1), e = G.P(-G.W0 + 0.5 * UPM, G.Hf - 0.2 * UPM, 3.6); return [{ id: 'door', kind: 'door', type: 'door', x: Math.min(a[0], b[0]), y: a[1], w: Math.abs(b[0] - a[0]), h: b[1] - a[1], depth: 1, color: '#fff6dc', intensity: 1.25, spill: 900 }, { id: 'ember', kind: 'lamp', type: 'point', x: e[0], y: e[1], depth: 1, r: 420, color: '#ff8a3a', intensity: 0.7, flicker: 0.15, seed: 2 }]; },
    foreground({ pal }) { return [{ id: 'fg-pot', depth: 0.6, blur: 8, draw(c, b) { const g = c.createRadialGradient(140, 1760, 20, 140, 1820, 330); g.addColorStop(0, '#9a5a30'); g.addColorStop(0.6, '#3a1c0c'); g.addColorStop(1, '#0a0503'); c.fillStyle = g; c.beginPath(); c.ellipse(120, 1840, 260, 290, 0, 0, TAU); c.fill(); c.fillStyle = '#e6ddc8'; c.fillRect(940, 0, 220, 60); } }]; },
  };
}
let kitchen = null, dadi = null, boy = null;
function closeHands(ctx, t, lt, o) {
  // two giant figures whose arms meet in the middle of the frame: shapes, sleeves, skin and rim all come from the figure system
  const { a, b, light, aSpec, bSpec, aTarget, bTarget, grip, aHeight, bHeight, aX, bX, aFeet, bFeet, aFace, bFace } = o;
  b.draw(ctx, { x: bX, feet: bFeet, height: bHeight, facing: bFace ?? -1, pose: 'holdhand', t, light, reachR: bTarget, grip: { R: grip }, look: 2.9, contact: false });
  a.draw(ctx, { x: aX, feet: aFeet, height: aHeight, facing: aFace ?? 1, pose: 'holdhand', t, light, reachR: aTarget, grip: { R: o.aGrip ?? 0.25 }, look: 2.9, contact: false });
}
function shotDadi(ctx, t, lt, dur, w) {
  kitchen ??= buildTunnel({ seed: 5 }, kitchenDef());
  dadi ??= kit.createFigure({ age: 'elder', sex: 'f', outfit: 'saree', seed: 21, hair: { style: 'bun' }, bangles: true, colors: { a: '#7a2230', b: '#b88a3a', c: '#d9b25a' } });
  boy ??= kit.createFigure({ age: 'child', outfit: 'uniform', seed: 22 });
  const S = kitchen, cam = cin.createCamera({}), part = lt < 6.2 ? 0 : 1;
  const k = ctx.canvas.width / 1080;
  if (part === 0) {
    cam.update(t, cin.pushIn({ t0: 0, dur: 6.2, amount: 0.1 }), cin.handheldMove(9, 0.5));
    const pd = S.place({ z: 1.45, x: 0.5, meters: 1.5 }), pb = S.place({ z: 1.08, x: -0.5, meters: 1.1 });
    const lightD = { ...kit.LIGHTS.doorway, key: '#fff8e4', rimA: 1.2 }, lightB = { ...kit.LIGHTS.doorway, amb: '#2a1a10' };
    S.render(ctx, cam, t, { subjects: [
      { depth: 1.45, draw: (c) => { const q = cam.project(pd.x, pd.feet, 1.45), h = pd.height * q.scale; dadi.shadow(c, { x: q.sx, feet: q.sy, height: h, t, pose: 'stand' }, { x: S.vp.x + 1.7 * UPM / 2.3, y: S.vp.y - 300, floorY: q.sy + 60 }, { alpha: 0.5, soft: 14, squash: 0.35, ghostShadow: true }); dadi.draw(c, { x: q.sx, feet: q.sy, height: h, facing: -1, pose: 'stand', t, light: lightD, gaze: [0.6, 0.1], expr: 'worried', look: 0.9 }); } },
      { depth: 1.08, draw: (c) => { const q = cam.project(pb.x, pb.feet, 1.08), h = pb.height * q.scale; boy.draw(c, { x: q.sx, feet: q.sy, height: h, facing: 1, pose: { name: 'turn', turn: 0.75 }, t, light: lightB, look: 2.5 }); } },
    ] });
    const g = ctx.createRadialGradient(540 * k, 960 * k, 100 * k, 540 * k, 960 * k, 1300 * k);
    cin.motesBox?.(ctx);
  } else {
    // the tight push on the hands: Dadi's fingers loosen on the boy's wrist
    const p = sm(6.2, 11.2, lt + 0), grip = lerp(0.95, 0.1, sm(0.4, 0.95, (lt - 6.2) / (dur - 6.2)));
    ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 1080, 0); g.addColorStop(0, '#120a06'); g.addColorStop(0.55, '#3a281a'); g.addColorStop(1, '#fff2d0'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
    cin.fillTexture(ctx, 'plaster', [0, 0, 1080, 1920], { alpha: 0.5, scale: 2.4, ox: 0, oy: 0, seed: 14 });
    const push = 1 + 0.1 * sm(6.2, dur, lt); ctx.translate(540, 940); ctx.scale(push, push); ctx.translate(-540, -940);
    const light = { ...kit.LIGHTS.doorway, key: '#fff6dc', rimA: 1.3 };
    dadi.draw(ctx, { x: 1180, feet: 3200, height: 3700, facing: -1, pose: 'holdhand', t, light, reachR: [560, 1010 + Math.sin(t * 1.4) * 4], grip: { R: grip }, look: 2.9, contact: false });
    boy.draw(ctx, { x: -420, feet: 2400, height: 2900, facing: 1, pose: 'holdhand', t, light, reachR: [470, 1040], grip: { R: 0.1 }, look: 2.9, contact: false });
    ctx.restore();
  }
  return cam;
}

// ------------------------------------------------------------------ shot 5: the pale wet hand takes the narrator's hand (no shadows left)
let hold = null;
function shotHand(ctx, t, lt, dur, w) {
  courtyard ??= kit.buildSet('schoolCourtyard', { tod: 'noon', seed: 7, palette: 'whitewash', shadowK: 0, props: ['well', 'tree'] });
  hold ??= { n: kit.createFigure({ age: 'child', outfit: 'uniform', seed: 3 }), r: kit.createFigure({ age: 'child', outfit: 'uniform', seed: 31, variant: 'ghost' }) };
  const k = ctx.canvas.width / 1080, p = lt / dur;
  // out-of-focus, bleached courtyard behind
  const half = Math.round(w / 2), bgc = shotBackdrop(half, Math.round(ctx.canvas.height / 2), t);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = `blur(${Math.max(2, 7 * k)}px)`; ctx.drawImage(bgc, 0, 0, ctx.canvas.width, ctx.canvas.height); ctx.filter = 'none'; ctx.restore();
  ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0);
  const push = 1 + 0.12 * p; ctx.translate(540, 930); ctx.scale(push, push); ctx.translate(-540, -930);
  const light = { ...kit.LIGHTS.noon, dir: { x: 0.2, y: -1 }, strength: 1.1 }, bob = Math.sin(t * 1.8) * 5, grip = lerp(0.2, 0.95, sm(0, 0.35, p));
  hold.n.draw(ctx, { x: -330, feet: 2300, height: 3000, facing: 1, pose: 'holdhand', t, light, reachR: [470, 1000 + bob], grip: { R: 0.2 }, look: 2.9, contact: false });
  hold.r.draw(ctx, { x: 1420 + lerp(260, 0, sm(0, 0.35, p)), feet: 2500, height: 3000, facing: -1, pose: 'holdhand', t, light, reachR: [560 + lerp(260, 0, sm(0, 0.35, p)), 990 + bob * 0.6], grip: { R: grip }, look: 2.9, contact: false });
  ctx.restore();
  // steam in the heat off wet skin
  ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0); for (let i = 0; i < 16; i++) { const x = 380 + (i * 47) % 380, ph = ((t * 0.35 + i * 0.17) % 1); ctx.strokeStyle = `rgba(255,255,255,${0.3 * (1 - ph)})`; ctx.lineWidth = 12 + (i % 4) * 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, 900 - ph * 40); ctx.quadraticCurveTo(x + Math.sin(t * 2 + i) * 30, 760 - ph * 200, x + Math.sin(t * 1.5 + i) * 50, 560 - ph * 260); ctx.stroke(); } ctx.restore();
}
const BG = new Map();
function shotBackdrop(w, h, t) {
  const key = `${w}x${h}`; let c = BG.get(key);
  if (!c) { c = cin.createCanvas ? cin.createCanvas(w, h) : null; }
  if (!c) { const m = kit.cin.pooled('zsd-bg', w, h); c = m; }
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  const cam = cin.createCamera({}); cam.update(t, () => ({ z: 0.25 }));
  courtyard.render(x, cam, t, { subjects: [] }); return c;
}

const SHOTS = { s1_hook: shotHook, s2_dadi: shotDadi, s5_hand: shotHand };
const SHIMMER = { s1_hook: 1.0, s2_dadi: 0.15, s5_hand: 1.0 };
let T = 0;
export const VideoClock = {
  setTime(sec) { T = sec; },
  draw(ctx, width, height, timeline) {
    const t = T, scenes = timeline.scenes, sc = scenes.find((s) => t >= s.start_s && t < s.end_s) || scenes[scenes.length - 1];
    const id = SHOTS[sc.id] ? sc.id : 's1_hook', lt = t - sc.start_s, dur = sc.end_s - sc.start_s, frame = Math.round(t * 30);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    const cam = SHOTS[id](ctx, t, id === sc.id ? lt : lt % 4, id === sc.id ? dur : 4, width);
    // cut: a short dip from white-hot (never a hard flash)
    const inA = 1 - cl(lt / 0.16); if (inA > 0 && sc.start_s > 0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(255,252,240,${inA * 0.5})`; ctx.fillRect(0, 0, width, height); ctx.restore(); }
    cin.post(ctx, { t, frame, seed: 5, cam }, { name: 'horror-day', heatHaze: { amp: 4 * (SHIMMER[id] ?? 0.5), centre: 0.55 }, grade: { gamma: 1.0, gain: [1.0, 0.98, 0.92], saturation: 0.62, contrast: 0.7 } });
    const s = width / 1080; ctx.save(); ctx.setTransform(s, 0, 0, s, 0, 0);
    { const [cap, wd] = K.captionAt(timeline, t); if (cap) { const g = ctx.createLinearGradient(0, 1120, 0, 1460); g.addColorStop(0, 'rgba(30,26,34,0)'); g.addColorStop(0.5, 'rgba(30,26,34,0.34)'); g.addColorStop(1, 'rgba(30,26,34,0)'); ctx.fillStyle = g; ctx.fillRect(0, 1120, 1080, 340); K.horrorCaption(ctx, cap, wd, 1290); } }
    ctx.restore();
  },
};
export const DURATION = 61.213;
