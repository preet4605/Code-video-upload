// "एक बार" (standalone) — rendered with lib/scene3d.mjs: a lit bedroom in perspective, a moving handheld camera
// in every shot, moonlight cone + dust, a light leak under the door, fog, a silhouette at the edge of frame,
// darkness as the reveal, grain, vignette and a chromatic spike on hits.
// All state is derived from t and the timeline (captions/cues), so a real voiceover re-times everything.
import {
  makeCamera, handheld, drawQuad, drawBox, drawVolumeCone, drawDust, drawFogBanks, drawVignette, drawGrain,
  chromaticAberration, hitPulse, softenLayer, drawSleeperFromBehind, drawGhostFace, drawSilhouette, hexToLin, smooth, clamp01, lerp
} from '../../lib/scene3d.mjs';
import { drawCaptionBar } from '../../lib/widgets.mjs';

let T = 0;
const FONT = '"Noto Sans Devanagari", "Noto Sans", "DejaVu Sans", sans-serif';
const capAt = (tl, needle, fb) => { const c = (tl.captions || []).find((x) => x.text.includes(needle)); return c ? c.start_s : fb; };
const sceneOf = (tl, t) => (tl.scenes || []).find((s) => t >= s.start_s && t < s.end_s) || (tl.scenes || [])[(tl.scenes || []).length - 1];

// Room: x -2..2, y 0..2.8, z 0..5. Door on the back wall (z=5), window on the left wall (x=-2).
const ROOM = { x0: -2, x1: 2, y1: 2.8, z0: -0.5, z1: 5 };
const DOOR = { x0: 0.55, x1: 1.45, y1: 2.1, z: 5 };

function cues(tl) {
  const D = tl.duration_s || 70;
  const calls = (tl.captions || []).filter((c) => c.text.includes('बेटा')).map((c) => c.start_s);
  const scare = ((tl.audio_cues || []).find((c) => c.scare) || {}).t_s ?? D - 7;
  return {
    D, calls, scare,
    tCall: calls[0] ?? 20,
    tHaan: capAt(tl, 'हाँ', 30),
    tFeet: capAt(tl, 'दो पैर', 40),
    tOut: capAt(tl, 'बुझ गई', 44),
    tBack: capAt(tl, 'लौटीं', 47),
    tDawn: capAt(tl, 'सुबह', 55),
    tTurn: capAt(tl, 'कंबल', scare + 0.2),
    hits: [calls[0] ?? 20, capAt(tl, 'बुझ गई', 44), scare]
  };
}

function lightsFor(t, c, id) {
  const dawn = smooth((t - c.tDawn) / 2.5);
  const cloud = 0.75 + 0.25 * Math.sin(t * 0.23) * Math.sin(t * 0.071 + 1);
  const moon = { type: 'cone', pos: [-2.6, 2.7, 2.2], dir: [1, -0.55, 0.35], inner: 0.35, outer: 0.7, color: lerp(1, 0.85, dawn) ? [0.55, 0.65, 1.0] : [0.55, 0.65, 1.0], intensity: (2.4 * cloud) * (1 - 0.4 * dawn), range: 5 };
  const stripOn = (t >= c.tCall - 0.1 && t < c.tOut) ? 1 : 0;
  const flick = 0.8 + 0.2 * Math.sin(t * 21) * Math.sin(t * 3.3 + 1);
  const strip = { type: 'point', pos: [1.0, 0.04, 4.95], color: [1.0, 0.62, 0.3], intensity: 5.5 * stripOn * flick, range: 1.1, box: [[-2, 0, 2.6], [2, 0.6, 5]] };
  const clock = { type: 'point', pos: [1.75, 0.95, 1.4], color: [1, 0.08, 0.05], intensity: 0.9, range: 0.9 };
  const kitchen = { type: 'point', pos: [1.0, 1.6, 5.6], color: [1.0, 0.7, 0.4], intensity: 4.5 * dawn, range: 2.2 };
  const dawnFill = { type: 'point', pos: [-2.4, 2.0, 2.0], color: [0.6, 0.66, 0.8], intensity: 1.6 * dawn, range: 3.5 };
  return { list: [moon, strip, clock, kitchen, dawnFill], moon, strip, stripOn, dawn };
}

function wallTex(u, v) { return 0.9 + 0.1 * Math.sin(u * 37 + v * 3) * Math.sin(v * 23); }
function floorTex(u, v) { return 0.8 + 0.2 * (Math.floor(u * 7) % 2) + 0.05 * Math.sin(v * 40); }

function drawRoom(ctx, cam, L, t, c, { doorOpen = 0, bed = true } = {}) {
  const amb = [0.012, 0.013, 0.02];
  const fog = { density: 0.12, start: 1.0, colorLin: [0.004, 0.005, 0.009] };
  const o = { lights: L.list, ambient: amb, fog };
  const { x0, x1, y1, z0, z1 } = ROOM;
  drawQuad(ctx, cam, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], { ...o, base: '#2b2f38', nx: 14, ny: 14 }); // ceiling
  drawQuad(ctx, cam, [[x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0]], { ...o, base: '#3a3530', texture: floorTex, nx: 18, ny: 18 }); // floor
  drawQuad(ctx, cam, [[x1, 0, z1], [x0, 0, z1], [x0, y1, z1], [x1, y1, z1]], { ...o, base: '#4a4f5c', texture: wallTex, nx: 18, ny: 16 }); // back wall
  drawQuad(ctx, cam, [[x0, 0, z1], [x0, 0, z0], [x0, y1, z0], [x0, y1, z1]], { ...o, base: '#454a56', texture: wallTex, nx: 16, ny: 14 }); // left wall
  drawQuad(ctx, cam, [[x1, 0, z0], [x1, 0, z1], [x1, y1, z1], [x1, y1, z0]], { ...o, base: '#454a56', texture: wallTex, nx: 16, ny: 14 }); // right wall
  softenLayer(ctx, cam.width, cam.height, 5 * (cam.width / 1080)); // soften only the big lit planes
  // window on the left wall (emissive night sky / dawn)
  const sky = L.dawn > 0 ? [0.05 + 0.16 * L.dawn, 0.07 + 0.18 * L.dawn, 0.16 + 0.2 * L.dawn] : [0.05, 0.07, 0.16];
  drawQuad(ctx, cam, [[x0 + 0.01, 1.0, 3.0], [x0 + 0.01, 1.0, 1.6], [x0 + 0.01, 2.25, 1.6], [x0 + 0.01, 2.25, 3.0]], { base: '#000000', lights: [], ambient: [0, 0, 0], emissive: sky, nx: 2, ny: 2 });
  // window mullions
  for (const z of [1.6, 2.3, 3.0]) drawBox(ctx, cam, [x0, 1.0, z - 0.03], [x0 + 0.05, 2.25, z + 0.03], { base: '#0b0c10', lights: L.list, ambient: amb });
  drawBox(ctx, cam, [x0, 1.6, 1.6], [x0 + 0.05, 1.66, 3.0], { base: '#0b0c10', lights: L.list, ambient: amb });
  // door: frame, leaf (swings open at dawn), light strip under it
  drawBox(ctx, cam, [DOOR.x0 - 0.08, 0, z1 - 0.06], [DOOR.x0, DOOR.y1 + 0.08, z1], { base: '#1d1b19', ...o });
  drawBox(ctx, cam, [DOOR.x1, 0, z1 - 0.06], [DOOR.x1 + 0.08, DOOR.y1 + 0.08, z1], { base: '#1d1b19', ...o });
  drawBox(ctx, cam, [DOOR.x0 - 0.08, DOOR.y1, z1 - 0.06], [DOOR.x1 + 0.08, DOOR.y1 + 0.08, z1], { base: '#1d1b19', ...o });
  if (doorOpen > 0) {
    // kitchen beyond: warm, deep
    drawQuad(ctx, cam, [[DOOR.x1, 0, z1 + 1.4], [DOOR.x0, 0, z1 + 1.4], [DOOR.x0, DOOR.y1, z1 + 1.4], [DOOR.x1, DOOR.y1, z1 + 1.4]], { base: '#6a4a2c', lights: L.list, ambient: [0.05, 0.03, 0.02], nx: 4, ny: 4 });
    drawQuad(ctx, cam, [[DOOR.x0, 0, z1 + 1.4], [DOOR.x1, 0, z1 + 1.4], [DOOR.x1, 0, z1], [DOOR.x0, 0, z1]], { base: '#4a3826', lights: L.list, ambient: [0.05, 0.03, 0.02], nx: 3, ny: 3 });
    const a = doorOpen * 1.25;
    const hx = DOOR.x0, w = DOOR.x1 - DOOR.x0;
    drawQuad(ctx, cam, [[hx, 0, z1 - 0.02], [hx + Math.cos(a) * w, 0, z1 - 0.02 - Math.sin(a) * w], [hx + Math.cos(a) * w, DOOR.y1, z1 - 0.02 - Math.sin(a) * w], [hx, DOOR.y1, z1 - 0.02]], { base: '#2d2620', ...o, cull: false, nx: 3, ny: 6 });
  } else {
    drawQuad(ctx, cam, [[DOOR.x1, 0.02, z1 - 0.02], [DOOR.x0, 0.02, z1 - 0.02], [DOOR.x0, DOOR.y1, z1 - 0.02], [DOOR.x1, DOOR.y1, z1 - 0.02]], { base: '#2d2620', ...o, nx: 4, ny: 8 });
    // panels + handle
    drawBox(ctx, cam, [DOOR.x0 + 0.1, 1.25, z1 - 0.05], [DOOR.x1 - 0.1, 1.95, z1 - 0.03], { base: '#241e19', ...o });
    drawBox(ctx, cam, [DOOR.x0 + 0.1, 0.2, z1 - 0.05], [DOOR.x1 - 0.1, 1.1, z1 - 0.03], { base: '#241e19', ...o });
    drawBox(ctx, cam, [DOOR.x0 + 0.06, 1.0, z1 - 0.1], [DOOR.x0 + 0.12, 1.05, z1 - 0.04], { base: '#8a7044', ...o });
    if (L.stripOn) {
      const f = L.strip.intensity / 5.5;
      drawQuad(ctx, cam, [[DOOR.x1 - 0.02, 0, z1 - 0.025], [DOOR.x0 + 0.02, 0, z1 - 0.025], [DOOR.x0 + 0.02, 0.025, z1 - 0.025], [DOOR.x1 - 0.02, 0.025, z1 - 0.025]], { base: '#000000', lights: [], ambient: [0, 0, 0], emissive: [1.6 * f, 0.9 * f, 0.4 * f], nx: 1, ny: 1 });
    }
  }
  // wall details: skirting, a hanging calendar, switchboard, a framed photo (sharp, after the soften pass)
  drawBox(ctx, cam, [x0, 0, z1 - 0.04], [x1, 0.1, z1], { base: '#1a1816', ...o });
  drawBox(ctx, cam, [-1.2, 1.3, z1 - 0.03], [-0.6, 1.95, z1 - 0.01], { base: '#8d8577', ...o });
  drawBox(ctx, cam, [-1.18, 1.85, z1 - 0.035], [-0.62, 1.93, z1 - 0.02], { base: '#6b1f1f', ...o });
  drawBox(ctx, cam, [0.1, 1.1, z1 - 0.03], [0.34, 1.32, z1 - 0.01], { base: '#cfc8b8', ...o });
  drawBox(ctx, cam, [x1 - 0.03, 1.4, 2.4], [x1, 2.0, 3.1], { base: '#2a1f17', ...o });
  drawBox(ctx, cam, [x1 - 0.04, 1.47, 2.47], [x1 - 0.02, 1.93, 3.03], { base: '#5a5a62', ...o });
  // by the door (seen in the floor-level kitchen shot): doormat, shoe rack with slippers, a bucket, a switchboard
  drawBox(ctx, cam, [1.6, 0, 4.4], [1.95, 0.55, 4.95], { base: '#2b241e', ...o });
  for (let k = 0; k < 2; k++) drawBox(ctx, cam, [1.62, 0.18 + k * 0.2, 4.42], [1.93, 0.2 + k * 0.2, 4.93], { base: '#3c332a', ...o });
  drawBox(ctx, cam, [1.65, 0.2, 4.5], [1.77, 0.24, 4.75], { base: '#6a3a2a', ...o });
  drawBox(ctx, cam, [1.79, 0.2, 4.52], [1.91, 0.24, 4.77], { base: '#6a3a2a', ...o });
  drawBox(ctx, cam, [-0.4, 0, 4.55], [-0.1, 0.32, 4.85], { base: '#2c4a5e', ...o });
  drawBox(ctx, cam, [1.6, 1.0, 4.96], [1.8, 1.18, 4.99], { base: '#b8b0a0', ...o });
  // dresser + red clock (right wall), bed (left, foreground)
  drawBox(ctx, cam, [1.4, 0, 1.0], [1.95, 0.85, 1.9], { base: '#2a231d', ...o });
  drawQuad(ctx, cam, [[1.6, 0.88, 1.25], [1.6, 0.88, 1.55], [1.6, 1.02, 1.55], [1.6, 1.02, 1.25]].reverse(), { base: '#000000', lights: [], ambient: [0, 0, 0], emissive: [0.9, 0.04, 0.03], nx: 1, ny: 1, cull: false });
  if (bed) {
    drawBox(ctx, cam, [-1.9, 0, -0.5], [-0.75, 0.45, 2.0], { base: '#2b3242', ...o });
    drawBox(ctx, cam, [-1.95, 0, 1.95], [-0.7, 0.62, 2.05], { base: '#1c1916', ...o }); // footboard
  }
  // ceiling fan: rotating blades (motion even in still shots)
  const fc = [0, 2.55, 2.6];
  for (let k = 0; k < 3; k++) {
    const a = t * 3.2 + (k * Math.PI * 2) / 3;
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz * 0.09, pz = dx * 0.09;
    drawQuad(ctx, cam, [[fc[0] + px, fc[1], fc[2] + pz], [fc[0] + dx * 0.75 + px, fc[1], fc[2] + dz * 0.75 + pz], [fc[0] + dx * 0.75 - px, fc[1], fc[2] + dz * 0.75 - pz], [fc[0] - px, fc[1], fc[2] - pz]], { base: '#15161a', ...o, cull: false, nx: 2, ny: 1 });
  }
}

function project(cam, p) { return cam.project(p); }
function shadowPoly(ctx, cam, pts, alpha) {
  const pr = pts.map((p) => cam.project(p));
  if (pr.some((q) => !q.ok)) return;
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath(); ctx.moveTo(pr[0].x, pr[0].y); for (const q of pr.slice(1)) ctx.lineTo(q.x, q.y); ctx.closePath(); ctx.fill();
}

function drawNaniRoom(ctx, w, h, t, sc) {
  const flick = 0.82 + 0.18 * Math.sin(t * 17) * Math.sin(t * 5.3);
  const local = t - sc.start_s;
  const cam = makeCamera({ pos: [lerp(-0.3, 0.1, local / 10), 1.1, lerp(-0.6, 0.2, local / 10)], yaw: 0.06 - 0.01 * local, pitch: -0.04, fov: 58, width: w, height: h, shake: handheld(t, 0.8, 2) });
  const diya = { type: 'point', pos: [-0.6, 0.55, 2.2], color: [1.0, 0.55, 0.22], intensity: 3.2 * flick, range: 2.6 };
  const L = { list: [diya], dawn: 0, stripOn: 0 };
  const o = { lights: L.list, ambient: [0.006, 0.005, 0.005], fog: { density: 0.1, start: 1, colorLin: [0.004, 0.003, 0.002] } };
  drawQuad(ctx, cam, [[-2, 0, 4], [2, 0, 4], [2, 0, -1], [-2, 0, -1]].reverse().reverse(), { ...o, base: '#5a4636', texture: floorTex, nx: 8, ny: 8, cull: false });
  drawQuad(ctx, cam, [[2, 0, 4], [-2, 0, 4], [-2, 2.8, 4], [2, 2.8, 4]], { ...o, base: '#6a5a4a', texture: wallTex, nx: 10, ny: 10 });
  drawQuad(ctx, cam, [[-2, 0, 4], [-2, 0, -1], [-2, 2.8, -1], [-2, 2.8, 4]], { ...o, base: '#5e5042', texture: wallTex, nx: 6, ny: 6 });
  drawQuad(ctx, cam, [[2, 0, -1], [2, 0, 4], [2, 2.8, 4], [2, 2.8, -1]], { ...o, base: '#5e5042', texture: wallTex, nx: 6, ny: 6 });
  softenLayer(ctx, w, h, 5 * (w / 1080));
  // shelf with pots and a framed photo on the back wall
  drawBox(ctx, cam, [-1.4, 1.6, 3.8], [0.6, 1.66, 4.0], { base: '#3a2a1c', ...o });
  for (let i = 0; i < 4; i++) drawBox(ctx, cam, [-1.3 + i * 0.5, 1.66, 3.82], [-1.05 + i * 0.5, 1.95, 3.98], { base: '#6a4a30', ...o });
  drawBox(ctx, cam, [0.9, 1.3, 3.92], [1.5, 2.1, 3.99], { base: '#2a1e14', ...o });
  // the diya flame (emissive) and the nani silhouette with her huge shadow on the back wall
  const fp = cam.project([-0.6, 0.6, 2.2]);
  const g = ctx.createRadialGradient(fp.x, fp.y, 0, fp.x, fp.y, 60 * (w / 1080));
  g.addColorStop(0, `rgba(255,220,140,${0.95 * flick})`); g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g; ctx.fillRect(fp.x - 80, fp.y - 80, 160, 160);
  const sp = cam.project([0.6, 0.0, 3.98]);
  drawSilhouette(ctx, { x: sp.x, y: sp.y, h: (h * 0.62), fill: 'rgba(0,0,0,0.78)', sway: Math.sin(t * 1.7) * 8 });
  const np = cam.project([0.0, 0.0, 2.6]);
  drawSilhouette(ctx, { x: np.x, y: np.y, h: h * 0.36, fill: '#0d0905', rim: [255, 170, 90], rimAlpha: 0.75 * flick });
  drawDust(ctx, cam, { min: [-1.5, 0.3, 1.0], max: [1.5, 2.4, 3.5], count: 70, seed: 5, t, lights: L.list });
}

export const VideoClock = {
  setTime(s) { T = s; },
  draw(ctx, width, height, timeline) {
    const t = T;
    const c = cues(timeline);
    const sc = sceneOf(timeline, t);
    const id = sc ? sc.id : 'hook';
    const local = sc ? clamp01((t - sc.start_s) / Math.max(0.1, sc.end_s - sc.start_s)) : 0;
    const prog = clamp01(t / c.D);
    const hit = hitPulse(t, c.hits, 8);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);

    if (id === 'nani') {
      drawNaniRoom(ctx, width, height, t, sc);
    } else {
      const L = lightsFor(t, c, id);
      const shake = handheld(t, 0.8 + 2.2 * prog * prog + 3 * hit, 1);
      // per-shot camera moves (all moving): position, yaw, pitch, fov
      const shots = {
        hook: { from: [-0.4, 1.05, 0.35], to: [-0.2, 1.0, 1.3], yaw: [0.16, 0.2], pitch: [-0.05, -0.08], fov: 64 },
        wake: { from: [-0.6, 0.85, 0.1], to: [-0.5, 0.82, 0.55], yaw: [0.28, 0.24], pitch: [-0.02, -0.06], fov: 60 },
        still: { from: [-0.55, 0.8, 0.4], to: [-0.45, 0.78, 0.75], yaw: [0.24, 0.3], pitch: [-0.06, -0.1], fov: 58 },
        kitchen: { from: [0.15, 0.32, 2.1], to: [0.45, 0.24, 3.05], yaw: [0.16, 0.1], pitch: [-0.03, -0.01], fov: 60 },
        return: { from: [-0.5, 0.95, 0.2], to: [-0.45, 0.9, 0.5], yaw: [0.26, 0.1], pitch: [-0.06, -0.14], fov: 62 },
        morning: { from: [-0.5, 1.0, 0.3], to: [-0.4, 0.95, 0.9], yaw: [0.22, -0.55], pitch: [-0.06, -0.2], fov: 60 },
        reveal_callback: { from: [-0.45, 0.85, 0.85], to: [-0.4, 0.82, 0.65], yaw: [-0.7, -0.78], pitch: [-0.26, -0.3], fov: 54 }
      }[id] || { from: [-0.4, 1.0, 0.4], to: [-0.3, 1.0, 0.8], yaw: [0.2, 0.2], pitch: [-0.06, -0.06], fov: 60 };
      const e = smooth(local);
      const cam = makeCamera({
        pos: [lerp(shots.from[0], shots.to[0], e), lerp(shots.from[1], shots.to[1], e), lerp(shots.from[2], shots.to[2], e)],
        yaw: lerp(shots.yaw[0], shots.yaw[1], id === 'morning' ? smooth((t - (c.scare - 4.5)) / 3) : e),
        pitch: lerp(shots.pitch[0], shots.pitch[1], e),
        fov: shots.fov - 4 * hit, width, height, shake
      });
      drawRoom(ctx, cam, L, t, c, { doorOpen: id === 'morning' || id === 'reveal_callback' ? smooth((t - c.tDawn) / 1.6) : 0, bed: !(id === 'reveal_callback' || (id === 'morning' && t > c.scare - 4.5)) });
      // the real mother, far away in the kitchen at dawn (the twist, seen small)
      if ((id === 'morning') && t > c.tDawn + 0.6) {
        const mp = cam.project([1.05, 0, 6.1]);
        if (mp.ok) drawSilhouette(ctx, { x: mp.x, y: mp.y, h: (cam.f * 1.55) / mp.z, fill: '#1a120b', rim: [255, 190, 120], rimAlpha: 0.6 });
      }
      // feet in the light strip + their long shadows on our side of the door
      if (id === 'kitchen' && L.stripOn && t > c.tFeet + 0.8) {
        for (const fx of [0.82, 1.16]) {
          shadowPoly(ctx, cam, [[fx - 0.06, 0.003, 4.98], [fx + 0.06, 0.003, 4.98], [fx + 0.06 + (fx - 1) * 0.6, 0.003, 3.4], [fx - 0.06 + (fx - 1) * 0.6, 0.003, 3.4]], 0.82);
          shadowPoly(ctx, cam, [[fx - 0.06, 0.0, 4.975], [fx + 0.06, 0.0, 4.975], [fx + 0.06, 0.026, 4.975], [fx - 0.06, 0.026, 4.975]], 0.97);
        }
      }
      // the thing that came back: crosses from the door to the bed, rim-lit, at the edge of frame
      if (id === 'return') {
        const u = smooth((t - c.tBack) / 3.5);
        const wp = [lerp(1.0, -0.1, u), 0, lerp(4.6, 1.9, u)];
        const p = cam.project(wp);
        if (p.ok && u > 0 && u < 1) drawSilhouette(ctx, { x: p.x, y: p.y, h: (cam.f * 1.6) / p.z, rim: [150, 175, 235], rimAlpha: 0.55 * (L.moon.intensity / 2.4), sway: Math.sin(t * 2.1) * 6 });
      }
      drawVolumeCone(ctx, cam, { apex: [-2.05, 2.1, 2.3], dir: [1, -0.62, 0.3], length: 3.4, radius: 1.0, color: [150, 175, 240], alpha: 0.22 * (L.moon.intensity / 2.4) * (1 - 0.6 * L.dawn) });
      drawDust(ctx, cam, { min: [-1.8, 0.4, 1.2], max: [0.8, 2.3, 3.6], count: 90, seed: 11, t, lights: [L.moon] });
      if (L.stripOn) drawVolumeCone(ctx, cam, { apex: [1.0, 0.02, 4.98], dir: [0, 0.05, -1], length: 1.2, radius: 0.35, color: [255, 160, 80], alpha: 0.18 * (L.strip.intensity / 5.5) });
      drawFogBanks(ctx, width, height, { t, y: height * 0.62, h: height * 0.18, alpha: 0.10 + 0.06 * prog, color: [110, 125, 160] });

      // foreground close-ups (mother from behind / the thing beside him)
      const s = width / 1080;
      if (id === 'wake' || (id === 'still' && t < c.tHaan + 0.6)) {
        drawSleeperFromBehind(ctx, { x: width * 0.62, y: height * 0.73, scale: 1.05 * s, t, rimAlpha: 0.5 * (L.moon.intensity / 2.4) });
      }
      if (id === 'still' && t >= c.tHaan + 0.6) {
        const u = smooth((t - c.tHaan - 0.6) / 1.8);
        drawSleeperFromBehind(ctx, { x: width * 0.62, y: height * (0.73 + 0.25 * u), scale: 1.05 * s, t, rimAlpha: 0.5 * (1 - u) });
        drawSilhouette(ctx, { x: width * (0.7 + 0.1 * u), y: height * 0.98, h: height * (0.4 + 0.35 * u), rim: [150, 180, 240], rimAlpha: 0.5 });
      }
      if (id === 'return' && t > c.tBack + 3.5) {
        const u = smooth((t - c.tBack - 3.5) / 1.5);
        drawSleeperFromBehind(ctx, { x: width * 0.62, y: height * (0.95 - 0.22 * u), scale: 1.05 * s, t, breath: 0.2, rimAlpha: 0.45 });
      }
      if (id === 'morning') drawSleeperFromBehind(ctx, { x: width * (0.62 - 0.55 * smooth((t - (c.scare - 4.5)) / 3)), y: height * 0.73, scale: 1.05 * s, t, breath: 0, rimAlpha: 0.4 + 0.2 * L.dawn, blanket: '#232b3c' });
      if (id === 'reveal_callback') {
        const turn = smooth((t - c.scare) / 0.9);
        // reveal by darkness: the dawn light drains as it turns
        ctx.fillStyle = `rgba(0,0,0,${0.55 * turn})`; ctx.fillRect(0, 0, width, height);
        if (turn < 0.4) drawSleeperFromBehind(ctx, { x: width * 0.5, y: height * 0.78, scale: 1.25 * s, t, breath: 0, rimAlpha: 0.5 * (1 - turn), blanket: '#232b3c' });
        const callT = c.calls[c.calls.length - 1] ?? c.scare + 3;
        drawGhostFace(ctx, { x: width * 0.56, y: height * 0.55, scale: 1.3 * s, alpha: 0.78 * turn, cover: 0.3 + 0.1 * (1 - turn), blanket: '#232b3c', t, side: -1, mouthOpen: clamp01((t - callT) / 0.4) * (1 - clamp01((t - callT - 0.9) / 0.4)) });
      }
    }
    // end fade (never fully black), vignette, grain, chromatic spike on hits
    const tail = clamp01((t - (c.D - 1.2)) / 1.2);
    if (tail > 0) { ctx.fillStyle = `rgba(0,0,0,${0.7 * tail})`; ctx.fillRect(0, 0, width, height); }
    drawVignette(ctx, width, height, 0.82);
    drawGrain(ctx, width, height, t, 0.9 + 0.7 * prog);
    if (hit > 0.05) chromaticAberration(ctx, width, height, 14 * hit * (width / 1080));

    const cap = (timeline.captions || []).find((x) => t >= x.start_s && t <= x.end_s);
    if (cap) drawCaptionBar(ctx, { width, height, text: cap.text, highlightWord: cap.highlight || '', fontFamily: FONT });
  }
};
