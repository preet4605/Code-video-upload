// Zero Shadow Day v2: three shots remade with lib/kit (sets + puppet figures) and lib/cinema (camera, light, post).
// Same timeline.json / captions / timing as ../zero-shadow-day. Shots: s1_hook (courtyard wide), s2_dadi (doorway kitchen, then the
// hands), s5_hand (the hand-hold). Any other time falls back to the s1 composition (only these three are remade).
// Contract: VideoClock.setTime(t); VideoClock.draw(ctx, w, h, timeline). Deterministic f(t).
import * as kit from '../../lib/kit/index.mjs';
import { shotDadi } from './dadi_shot.mjs';
import * as K from '../zero-shadow-day/tools/kit.mjs';

const { cin } = kit;
const UPM = 512;
const TAU = Math.PI * 2, cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k, sm = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const T_VANISH = 24.15; // story clock: the shadows retreat here (from the original scene)

// ------------------------------------------------------------------ shot 1: courtyard, children holding hands, no shadows, wet footprints
let courtyard = null, kids = null;
function shotHook(ctx, t, lt, dur, w) {
  courtyard ??= kit.buildSet('schoolCourtyard', { tod: 'noon', seed: 7, palette: 'whitewash', shadowK: 0, props: ['well', 'tree'] });
  kids ??= [{ age: 'child', outfit: 'uniform', seed: 11 }, { age: 'child', sex: 'f', outfit: 'uniform', seed: 12, hair: { style: 'braid' } }, { age: 'child', outfit: 'uniform', seed: 13 }, { age: 'child', sex: 'f', outfit: 'uniform', seed: 14, hair: { style: 'bob' } }, { age: 'child', outfit: 'uniform', seed: 15 }].map((s) => kit.createFigure({ ...s, style: 'horror' }));
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

// ------------------------------------------------------------------ shot 2: see dadi_shot.mjs (one blinding doorway, Dadi near-silhouette, then her face half-lit)

// ------------------------------------------------------------------ shot 5: the pale wet hand takes the narrator's hand (no shadows left)
let hold = null;
function shotHand(ctx, t, lt, dur, w) {
  courtyard ??= kit.buildSet('schoolCourtyard', { tod: 'noon', seed: 7, palette: 'whitewash', shadowK: 0, props: ['well', 'tree'] });
  hold ??= { n: kit.createFigure({ age: 'child', outfit: 'uniform', seed: 3, style: 'horror' }), r: kit.createFigure({ age: 'child', outfit: 'uniform', seed: 31, variant: 'ghost', style: 'horror' }) };
  const k = ctx.canvas.width / 1080, p = lt / dur;
  // out-of-focus, bleached courtyard behind
  const half = Math.round(w / 2), bgc = shotBackdrop(half, Math.round(ctx.canvas.height / 2), t);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = `blur(${Math.max(2, 7 * k)}px)`; ctx.drawImage(bgc, 0, 0, ctx.canvas.width, ctx.canvas.height); ctx.filter = 'none'; ctx.restore();
  ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0);
  const push = 1.4 + 0.14 * p; ctx.translate(560, 1090); ctx.scale(push, push); ctx.translate(-540, -1060);
  const light = { ...kit.LIGHTS.noon, dir: { x: 0.2, y: -1 }, strength: 1.1 }, ghostLight = { ...light, key: '#f2f6ee', amb: '#4d5a58', rimA: 0.5 }, bob = Math.sin(t * 1.8) * 5, grip = lerp(0.2, 0.8, sm(0, 0.4, p));
  // the narrator's hand hangs in from the left; the ghost's body is off the right edge: only its long, pale arm reaches in and closes on his wrist
  const ap = sm(0, 0.35, p), nx = 410 + Math.sin(t * 1.3) * 3;
  hold.n.draw(ctx, { x: -420, feet: 3000, height: 3000, facing: 1, pose: 'holdhand', t, light, reachR: [nx, 1110 + bob], grip: { R: 0.3 }, look: 2.9, contact: false });
  hold.r.draw(ctx, { x: 1960 + lerp(240, 0, ap), feet: 3300, height: 3300, facing: -1, pose: 'holdhand', t, light: ghostLight, reachR: [nx + 120 + lerp(240, 0, ap), 1085 + bob * 0.6], grip: { R: grip }, look: 2.9, contact: false });
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
