// "शीशा" part 1 (interactive) — a hostel room in perspective with a working mirror: the room behind the camera
// is rendered again with a reflected camera and flipped into the mirror frame. Moving camera in every shot,
// flickering tube light, moon cone + dust, fog, a silhouette that rises behind him, darkness reveal, grain,
// vignette and a chromatic spike on the stinger. All state derives from t + timeline.
import {
  makeCamera, handheld, drawQuad, drawBox, drawVolumeCone, drawDust, drawFogBanks, drawVignette, drawGrain,
  chromaticAberration, hitPulse, softenLayer, drawSilhouette, smooth, clamp01, lerp
} from '../../lib/scene3d.mjs';
import { drawCaptionBar } from '../../lib/widgets.mjs';

let T = 0;
const FONT = '"Noto Sans Devanagari", "Noto Sans", "DejaVu Sans", sans-serif';
const capAt = (tl, needle, fb) => { const c = (tl.captions || []).find((x) => x.text.includes(needle)); return c ? c.start_s : fb; };
const sceneOf = (tl, t) => (tl.scenes || []).find((s) => t >= s.start_s && t < s.end_s) || (tl.scenes || [])[(tl.scenes || []).length - 1];
const wallTex = (u, v) => 0.9 + 0.1 * Math.sin(u * 41 + v * 2) * Math.sin(v * 19);
const floorTex = (u, v) => 0.82 + 0.18 * ((Math.floor(u * 8) + Math.floor(v * 8)) % 2);

// Room x -2..2, y 0..2.8, z -3..3. Mirror on the front wall z=3 (x -0.45..0.45, y 1.15..2.0). Rohan's bed behind
// the camera at z -2.4..-0.6 on the right; the reflection shows it.
const MIR = { x0: -0.45, x1: 0.45, y0: 1.15, y1: 2.0, z: 2.98 };

function cues(tl) {
  const D = tl.duration_s || 70;
  const scare = ((tl.audio_cues || []).find((c) => c.scare) || {}).t_s ?? D - 9;
  return { D, scare, tTowel: capAt(tl, 'तौलिया', 18), tSleep: capAt(tl, 'सो रहा', 24), tRelief: capAt(tl, 'लौट आया', 33), tPhone: capAt(tl, 'फ़ोन', 37), tRise: capAt(tl, 'कोई उठा', scare + 3), tFork: capAt(tl, 'कमेंट', D - 5) };
}

function lightsFor(t, c) {
  const flick = t < c.tRelief ? (Math.sin(t * 1.7) * Math.sin(t * 0.43) > 0.82 ? 0.55 : 1) : 1; // occasional tube stutter
  const dying = 1 - smooth((t - (c.scare - 1.3)) / 0.9) * 0.92;
  const tube = { type: 'point', pos: [0, 2.6, 2.6], color: [0.85, 0.95, 1.0], intensity: 1.3 * flick * dying, range: 2.2 };
  const moon = { type: 'cone', pos: [2.6, 2.5, -0.5], dir: [-1, -0.5, 0.2], inner: 0.35, outer: 0.7, color: [0.55, 0.65, 1.0], intensity: 1.8, range: 5 };
  const phoneOn = t >= c.tPhone && t < c.tFork + 6 ? 1 : 0;
  const phone = { type: 'point', pos: [0.15, 1.25, 2.2], color: [0.75, 0.85, 1.0], intensity: 1.6 * phoneOn * (0.9 + 0.1 * Math.sin(t * 4)), range: 1.2 };
  const diwali = { type: 'point', pos: [2.1, 1.8, -1.5], color: [1.0, 0.55, 0.2], intensity: 0.7 * (0.7 + 0.3 * Math.sin(t * 3.3)), range: 2 };
  return { list: [tube, moon, phone, diwali], tube, moon, phoneOn, dying };
}

function drawWorld(ctx, cam, L, t, c, { inMirror = false, sleeper = 0, risen = 0 } = {}) {
  const fill = inMirror ? [{ type: 'point', pos: [0.9, 1.9, 0.2], color: [0.7, 0.8, 1.0], intensity: 0.7 * L.dying + 0.25, range: 3.0 }] : [];
  const o = { lights: [...L.list, ...fill], ambient: inMirror ? [0.02, 0.022, 0.032] : [0.012, 0.013, 0.02], fog: { density: inMirror ? 0.06 : 0.13, start: 1, colorLin: [0.004, 0.005, 0.009] } };
  drawQuad(ctx, cam, [[-2, 2.8, -3], [2, 2.8, -3], [2, 2.8, 3], [-2, 2.8, 3]], { ...o, base: '#1f2228', nx: 12, ny: 12 });
  drawQuad(ctx, cam, [[-2, 0, 3], [2, 0, 3], [2, 0, -3], [-2, 0, -3]], { ...o, base: '#3b3a37', texture: floorTex, nx: 16, ny: 16 });
  if (!inMirror) drawQuad(ctx, cam, [[2, 0, 3], [-2, 0, 3], [-2, 2.8, 3], [2, 2.8, 3]], { ...o, base: '#3d444d', texture: wallTex, nx: 16, ny: 14 }); // mirror wall (the reflected camera is behind it)
  drawQuad(ctx, cam, [[-2, 0, -3], [2, 0, -3], [2, 2.8, -3], [-2, 2.8, -3]], { ...o, base: '#363d46', texture: wallTex, nx: 14, ny: 12 });
  drawQuad(ctx, cam, [[-2, 0, 3], [-2, 0, -3], [-2, 2.8, -3], [-2, 2.8, 3]], { ...o, base: '#3a414a', texture: wallTex, nx: 14, ny: 12 });
  drawQuad(ctx, cam, [[2, 0, -3], [2, 0, 3], [2, 2.8, 3], [2, 2.8, -3]], { ...o, base: '#3a414a', texture: wallTex, nx: 14, ny: 12 });
  if (!inMirror) softenLayer(ctx, cam.width, cam.height, 5 * (cam.width / 1080));
  // window with diwali lights (right wall, behind)
  drawQuad(ctx, cam, [[1.99, 1.0, -1.0], [1.99, 1.0, -2.2], [1.99, 2.2, -2.2], [1.99, 2.2, -1.0]].reverse(), { base: '#000', lights: [], ambient: [0, 0, 0], emissive: [0.04, 0.05, 0.12], nx: 1, ny: 1, cull: false });
  for (let i = 0; i < 7; i++) {
    const p = cam.project([1.97, 2.1 - Math.sin(i / 6 * Math.PI) * 0.12, -1.05 - i * 0.19]);
    if (!p.ok) continue;
    const on = Math.sin(t * 2.4 + i * 1.3) > -0.2;
    ctx.fillStyle = on ? `rgba(255,${150 + (i % 3) * 30},60,0.9)` : 'rgba(80,40,20,0.6)';
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, cam.f * 0.025 / p.z), 0, Math.PI * 2); ctx.fill();
  }
  // Rohan's bed (behind camera, right) and the narrator's bed (left)
  drawBox(ctx, cam, [0.1, 0, -2.6], [1.3, 0.48, -0.6], { base: '#2e3646', ...o });
  drawBox(ctx, cam, [-1.9, 0, -2.6], [-0.9, 0.48, -0.6], { base: '#2e3646', ...o });
  drawBox(ctx, cam, [0.25, 0.48, -2.55], [1.15, 0.62, -2.15], { base: '#5d6576', ...o });
  if (sleeper > 0) {
    // the shape in Rohan's bed: a breathing blanket hump (and later, risen)
    const br = 0.05 * Math.sin(t * 1.6);
    const h = lerp(0.3 + br, 1.6, risen);
    const top = 0.48 + Math.max(0.12, (0.3 + br) * (1 - risen));
    drawBox(ctx, cam, [0.35, 0.48, -2.05], [1.05, top, -0.8], { base: '#56637c', ...o });
    // rim along the blanket ridge so the breathing reads in the dark
    const a = cam.project([0.4, top, -2.0]), b = cam.project([1.0, top, -0.85]);
    if (a.ok && b.ok) { ctx.strokeStyle = 'rgba(170,195,240,0.55)'; ctx.lineWidth = Math.max(2, cam.f * 0.006 / a.z); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    if (risen > 0.02) {
      const near = smooth((t - c.tRise - 1.2) / Math.max(1, c.D - c.tRise - 2));
      const p = cam.project([lerp(0.7, 0.2, near), 0, lerp(-1.2, 1.4, near)]);
      if (p.ok) drawSilhouette(ctx, { x: p.x, y: p.y, h: (cam.f * h) / p.z, rim: [160, 185, 240], rimAlpha: 0.65, sway: Math.sin(t * 2.6) * 10 * (1 + 2 * near) + Math.sin(t * 7.1) * 4 * near });
    }
  }
  // washbasin + tap under the mirror, mirror frame, towel
  if (!inMirror) {
  drawBox(ctx, cam, [-0.5, 0.75, 2.55], [0.5, 0.92, 3.0], { base: '#6c7076', ...o });
  drawBox(ctx, cam, [-0.05, 0.92, 2.85], [0.05, 1.08, 2.95], { base: '#8a8f96', ...o });
  drawBox(ctx, cam, [MIR.x0 - 0.05, MIR.y0 - 0.05, 2.95], [MIR.x1 + 0.05, MIR.y1 + 0.05, 2.99], { base: '#1c1a18', ...o });
  }
  // hostel clutter: posters, a timetable, a backpack, clothes on a line, a bucket, slippers (sharp detail)
  drawBox(ctx, cam, [1.97, 1.2, 0.4], [2.0, 1.95, 1.0], { base: '#5a3f2c', ...o });
  drawBox(ctx, cam, [1.96, 1.3, 0.48], [1.975, 1.85, 0.92], { base: '#8a7a5a', ...o });
  drawBox(ctx, cam, [-2.0, 1.4, -1.6], [-1.97, 2.1, -0.9], { base: '#2a4a5a', ...o });
  drawBox(ctx, cam, [-1.99, 1.5, -1.5], [-1.96, 1.95, -1.0], { base: '#c0b090', ...o });
  drawBox(ctx, cam, [1.5, 0, 0.2], [1.85, 0.5, 0.45], { base: '#24324a', ...o });
  drawBox(ctx, cam, [1.55, 0.5, 0.25], [1.8, 0.6, 0.4], { base: '#1a2436', ...o });
  for (let i = 0; i < 4; i++) drawBox(ctx, cam, [-1.5 + i * 0.32, 1.9 - (i % 2) * 0.1, -2.95], [-1.32 + i * 0.32, 2.3, -2.9], { base: ['#6a3030', '#3a5a6a', '#6a6a5a', '#4a3a6a'][i], ...o });
  drawBox(ctx, cam, [-1.6, 2.3, -2.95], [-0.3, 2.32, -2.9], { base: '#888888', ...o });
  drawBox(ctx, cam, [-0.6, 0, 1.6], [-0.3, 0.35, 1.9], { base: '#3a6a8a', ...o });
  drawBox(ctx, cam, [0.3, 0, 1.2], [0.42, 0.04, 1.45], { base: '#7a4a2a', ...o });
  drawBox(ctx, cam, [0.46, 0, 1.22], [0.58, 0.04, 1.47], { base: '#7a4a2a', ...o });
  // desk + books (left wall)
  drawBox(ctx, cam, [-1.95, 0, 0.4], [-1.3, 0.75, 1.6], { base: '#3a2d22', ...o });
  for (let i = 0; i < 4; i++) drawBox(ctx, cam, [-1.9, 0.75, 0.5 + i * 0.14], [-1.6, 0.98 - i * 0.03, 0.6 + i * 0.14], { base: ['#5a2626', '#26405a', '#4a4a26', '#2a2a2a'][i], ...o });
  // ceiling fan
  for (let k = 0; k < 3; k++) {
    const a = t * 3.4 + (k * Math.PI * 2) / 3, dx = Math.cos(a), dz = Math.sin(a), px = -dz * 0.08, pz = dx * 0.08;
    drawQuad(ctx, cam, [[px, 2.6, pz], [dx * 0.7 + px, 2.6, dz * 0.7 + pz], [dx * 0.7 - px, 2.6, dz * 0.7 - pz], [-px, 2.6, -pz]], { base: '#16171b', ...o, cull: false, nx: 2, ny: 1 });
  }
  drawVolumeCone(ctx, cam, { apex: [2.05, 2.1, -1.6], dir: [-1, -0.55, 0.25], length: 3.2, radius: 0.9, color: [150, 175, 240], alpha: 0.16 });
  drawDust(ctx, cam, { min: [-1, 0.5, -2], max: [1.8, 2.4, 2], count: 70, seed: inMirror ? 3 : 9, t, lights: [L.moon, L.tube] });
}

function mirrorPoly(cam) {
  const pts = [[MIR.x0, MIR.y0, MIR.z], [MIR.x1, MIR.y0, MIR.z], [MIR.x1, MIR.y1, MIR.z], [MIR.x0, MIR.y1, MIR.z]].map((p) => cam.project(p));
  return pts.every((p) => p.ok) ? pts : null;
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
    const hit = hitPulse(t, [c.scare, c.tTowel], 8);
    const s = width / 1080;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);

    if (id === 'dadi') {
      // memory: candle-lit wall, dadi covering a mirror with cloth
      const fl = 0.92 + 0.08 * Math.sin(t * 9) * Math.sin(t * 2.3);
      const cam = makeCamera({ pos: [lerp(-0.1, 0.05, local), 1.2, lerp(-0.5, -0.1, local)], yaw: 0.05, pitch: -0.05, fov: 58, width, height, shake: handheld(t, 0.35, 4) });
      const candle = { type: 'point', pos: [-0.5, 0.9, 1.8], color: [1, 0.58, 0.25], intensity: 3 * fl, range: 2.4 };
      const o = { lights: [candle], ambient: [0.005, 0.004, 0.004], fog: { density: 0.1, start: 1, colorLin: [0.003, 0.002, 0.002] } };
      drawQuad(ctx, cam, [[2, 0, 3], [-2, 0, 3], [-2, 2.8, 3], [2, 2.8, 3]], { ...o, base: '#6a5848', texture: wallTex, nx: 14, ny: 12 });
      drawQuad(ctx, cam, [[-2, 0, 3], [2, 0, 3], [2, 0, -1], [-2, 0, -1]], { ...o, base: '#4a3a2c', texture: floorTex, nx: 10, ny: 10 });
      softenLayer(ctx, width, height, 5 * s);
      drawBox(ctx, cam, [0.1, 1.0, 2.9], [0.9, 2.0, 2.98], { base: '#1a1512', ...o });
      const cover = smooth(local * 1.4);
      drawQuad(ctx, cam, [[0.05, 2.05, 2.88], [0.95, 2.05, 2.88], [0.95, 2.05 - 1.1 * cover, 2.88], [0.05, 2.05 - 1.1 * cover, 2.88]].reverse(), { base: '#8a3030', ...o, cull: false, nx: 3, ny: 4 });
      const sh = cam.project([0.9, 0, 2.97]);
      drawSilhouette(ctx, { x: sh.x, y: sh.y, h: height * 0.62, fill: 'rgba(0,0,0,0.75)', sway: Math.sin(t * 1.5) * 8 });
      const dp = cam.project([0.5, 0, 2.2]);
      drawSilhouette(ctx, { x: dp.x, y: dp.y, h: height * 0.4, fill: '#0e0a06', rim: [255, 170, 90], rimAlpha: 0.7 * fl });
      const fp = cam.project([-0.5, 0.95, 1.8]);
      const g = ctx.createRadialGradient(fp.x, fp.y, 0, fp.x, fp.y, 50 * s);
      g.addColorStop(0, `rgba(255,220,150,${0.95 * fl})`); g.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = g; ctx.fillRect(fp.x - 60 * s, fp.y - 60 * s, 120 * s, 120 * s);
      drawDust(ctx, cam, { min: [-1.2, 0.4, 1.0], max: [1.2, 2.4, 2.8], count: 60, seed: 5, t, lights: [candle] });
    } else {
      const L = lightsFor(t, c);
      const shake = handheld(t, 0.35 + 6.5 * prog * prog * prog + 3.5 * hit, 3);
      const shots = {
        hook: { from: [0.35, 1.45, 0.6], to: [0.25, 1.42, 1.5], yaw: [-0.08, -0.04], pitch: [0.02, 0.05], fov: 60 },
        room: { from: [0.3, 1.4, 0.1], to: [0.25, 1.42, 1.3], yaw: [-0.75, 0.0], pitch: [-0.12, 0.04], fov: 62 },
        mirror: { from: [0.1, 1.5, 1.4], to: [0.05, 1.55, 2.0], yaw: [0, 0], pitch: [0.06, 0.08], fov: 56 },
        relief: { from: [0.05, 1.55, 2.0], to: [0.1, 1.5, 1.6], yaw: [0, 0.02], pitch: [0.08, 0.06], fov: 58 },
        phone: { from: [0.1, 1.5, 1.6], to: [0.05, 1.55, 2.15], yaw: [0.02, 0], pitch: [0.04, -0.02], fov: 54 },
        eyes: { from: [0.05, 1.56, 2.15], to: [0.03, 1.58, 2.45], yaw: [0, 0], pitch: [-0.02, -0.06], fov: 50 },
        fork: { from: [0.03, 1.58, 2.4], to: [0.0, 1.58, 2.6], yaw: [0, 0], pitch: [-0.06, -0.1], fov: 48 }
      }[id];
      const e = smooth(local);
      const cam = makeCamera({ pos: shots.from.map((v, i) => lerp(v, shots.to[i], e)), yaw: lerp(shots.yaw[0], shots.yaw[1], e), pitch: lerp(shots.pitch[0], shots.pitch[1], e), fov: shots.fov - 6 * hit, width, height, shake });
      const sleeper = t >= c.tTowel ? 1 : 0;
      const risen = smooth((t - c.tRise) / 1.6);
      drawWorld(ctx, cam, L, t, c, { sleeper: 0, risen: 0 });
      // mirror: reflected camera (z mirrored about the mirror plane), rendered into the frame, flipped
      const poly = mirrorPoly(cam);
      const towel = 1 - smooth((t - c.tTowel) / 0.7);
      if (poly) {
        const mz = MIR.z;
        const rcam = makeCamera({ pos: [cam.pos[0], cam.pos[1], 2 * mz - cam.pos[2]], yaw: Math.PI - lerp(shots.yaw[0], shots.yaw[1], e), pitch: lerp(shots.pitch[0], shots.pitch[1], e), fov: shots.fov - 6 * hit, width, height, shake });
        ctx.save();
        ctx.beginPath(); ctx.moveTo(poly[0].x, poly[0].y); for (const p of poly.slice(1)) ctx.lineTo(p.x, p.y); ctx.closePath(); ctx.clip();
        ctx.save();
        ctx.translate(width, 0); ctx.scale(-1, 1);
        drawWorld(ctx, rcam, L, t, c, { inMirror: true, sleeper, risen });
        // the eyes (after the stinger): two glints on the pillow end of Rohan's bed
        const eo = smooth((t - c.scare) / 0.25);
        if (eo > 0 && risen < 0.3) {
          const ep = rcam.project([0.7, 0.72, -2.0]);
          if (ep.ok) for (const dx of [-1, 1]) {
            const r = (cam.f * 0.035) / ep.z;
            const gl = ctx.createRadialGradient(ep.x + dx * r * 2.2, ep.y, 0, ep.x + dx * r * 2.2, ep.y, r * 3);
            gl.addColorStop(0, `rgba(235,238,240,${0.95 * eo})`); gl.addColorStop(1, 'rgba(235,238,240,0)');
            ctx.fillStyle = gl; ctx.fillRect(ep.x + dx * r * 2.2 - r * 3, ep.y - r * 3, r * 6, r * 6);
          }
        }
        // his own reflection: a silhouette facing us, lit by the phone when it glows
        const hp = rcam.project([cam.pos[0] - 0.45, 0, cam.pos[2] - 0.05]);
        if (hp.ok) drawSilhouette(ctx, { x: hp.x, y: hp.y, h: (rcam.f * 1.75) / hp.z, fill: '#07080b', rim: L.phoneOn ? [170, 195, 240] : [120, 140, 170], rimAlpha: L.phoneOn ? 0.7 : 0.35 });
        ctx.restore();
        // glass tint + towel over the mirror
        ctx.fillStyle = 'rgba(120,140,160,0.06)'; ctx.fillRect(0, 0, width, height);
        if (towel > 0) {
          const tp = [[MIR.x0 - 0.02, MIR.y1 + 0.02, 2.95], [MIR.x1 + 0.02, MIR.y1 + 0.02, 2.95], [MIR.x1 + 0.02, MIR.y1 + 0.02 - 0.9 * towel - 0.4 * (1 - towel), 2.9 - 0.3 * (1 - towel)], [MIR.x0 - 0.02, MIR.y1 + 0.02 - 0.9 * towel - 0.6 * (1 - towel), 2.9 - 0.3 * (1 - towel)]].map((p) => cam.project(p));
          if (tp.every((p) => p.ok)) {
            ctx.fillStyle = '#3a3631';
            ctx.beginPath(); ctx.moveTo(tp[0].x, tp[0].y); for (const p of tp.slice(1)) ctx.lineTo(p.x + Math.sin(t * 3 + p.x) * 4 * s, p.y); ctx.closePath(); ctx.fill();
          }
        }
        ctx.restore();
      }
      // narrator's shoulder from behind (foreground), phone in hand after the message
      drawSilhouette(ctx, { x: width * 0.1, y: height * 1.38, h: height * 0.75, fill: '#040507', rim: [150, 175, 230], rimAlpha: 0.35 });
      if (L.phoneOn) {
        const px = width * 0.68, py = height * 0.74;
        const gl = ctx.createRadialGradient(px, py, 0, px, py, 260 * s);
        gl.addColorStop(0, 'rgba(170,200,255,0.35)'); gl.addColorStop(1, 'rgba(170,200,255,0)');
        ctx.fillStyle = gl; ctx.fillRect(px - 260 * s, py - 260 * s, 520 * s, 520 * s);
        ctx.fillStyle = '#0b0d12'; ctx.beginPath(); ctx.roundRect(px - 70 * s, py - 130 * s, 140 * s, 260 * s, 18 * s); ctx.fill();
        ctx.fillStyle = 'rgba(190,210,245,0.9)'; ctx.beginPath(); ctx.roundRect(px - 60 * s, py - 118 * s, 120 * s, 236 * s, 12 * s); ctx.fill();
        ctx.fillStyle = '#2c3e64'; ctx.beginPath(); ctx.roundRect(px - 50 * s, py - 60 * s, 96 * s, 34 * s, 10 * s); ctx.fill();
      }
      drawFogBanks(ctx, width, height, { t, y: height * 0.7, h: height * 0.16, alpha: 0.08 + 0.06 * prog, color: [110, 125, 160] });
      // after the stinger the room drains to dark except the mirror glints/phone
      const drain = 0.22 * smooth((t - c.scare) / 1.2);
      if (drain > 0) { ctx.fillStyle = `rgba(0,0,0,${drain})`; ctx.fillRect(0, 0, width, height); }
    }
    drawVignette(ctx, width, height, 0.82);
    drawGrain(ctx, width, height, t, 0.9 + 0.7 * prog);
    if (hit > 0.05) chromaticAberration(ctx, width, height, 14 * hit * s);
    const cap = (timeline.captions || []).find((x) => t >= x.start_s && t <= x.end_s);
    if (cap) drawCaptionBar(ctx, { width, height, text: cap.text, highlightWord: cap.highlight || '', fontFamily: FONT });
  }
};
