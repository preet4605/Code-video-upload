// Zero Shadow Day v2, shot 2 (s2_dadi): the dark kitchen with ONE blinding doorway. The doorway is the only light: a hard shaft on the floor, dust in the
// air, god-rays that Dadi and the narrator cut into. Wide frame: Dadi (61% of the frame height) as a near-silhouette with one clean rim, the narrator's
// back in the foreground. Close frame (second half): a medium close-up of Dadi's face half-lit by the door, one hand raised in warning.
// Everything is drawn in 1080x1920 design space; the framing (push + handheld) is a plain transform shared with the god-rays.
import * as kit from '../../lib/kit/index.mjs';
import { mulberry32 } from '../../lib/scene3d.mjs';

const { cin } = kit;
const TAU = Math.PI * 2, cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k, sm = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k); };

const DOOR = { x: 836, y: 330, w: 176, h: 1000 };          // the blinding slab (wide frame), floor line at y = 1330
const FLOOR_Y = 1330;
const LIGHT = { x: 0.88, y: -0.18 };                        // screen direction from the subjects toward the door (right, slightly up)
const norm = (v) => { const m = Math.hypot(v.x, v.y) || 1; return { x: v.x / m, y: v.y / m }; };
const LN = norm(LIGHT);

let dadi = null, boy = null, dust = null;
const figs = () => {
  dadi ??= kit.createFigure({ age: 'elder', sex: 'f', outfit: 'saree', seed: 21, hair: { style: 'bun' }, bangles: true, colors: { a: '#6a1d2a', b: '#9c7a32', c: '#c9a24d' }, style: 'horror' });
  boy ??= kit.createFigure({ age: 'child', outfit: 'uniform', seed: 22, style: 'horror' });
  if (!dust) { // dust motes inside the lit air: rejection-sampled in the wedge between the door and the camera (seeded, drawn once)
    const r = mulberry32(77), wedge = [[836, 330], [1012, 330], [1100, 1100], [1100, 1920], [120, 1920], [560, 1330]], inside = (x, y) => { let c = false; for (let i = 0, j = wedge.length - 1; i < wedge.length; j = i++) { const [xi, yi] = wedge[i], [xj, yj] = wedge[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
    dust = []; for (let n = 0; n < 4000 && dust.length < 170; n++) { const x = 120 + r() * 980, y = 330 + r() * 1590; if (inside(x, y)) dust.push({ x, y, s: 1 + r() * 2.6, ph: r() * TAU, sp: 0.2 + r() * 0.5, a: 0.25 + r() * 0.55 }); }
  }
};

// ---- framing: a slow push and a little handheld, as one transform of the design space
const frame = (t, lt, dur, amt, cx, cy) => { const p = lt / dur, s = 1 + amt * p, hx = Math.sin(t * 0.9 + 1) * 3.5 + Math.sin(t * 2.3) * 1.2, hy = Math.sin(t * 0.7 + 4) * 3; return { s, cx, cy, hx, hy }; };
const applyFrame = (c, f) => { c.translate(f.cx + f.hx, f.cy + f.hy); c.scale(f.s, f.s); c.translate(-f.cx, -f.cy); };
const mapPt = (f, x, y) => [f.cx + f.hx + (x - f.cx) * f.s, f.cy + f.hy + (y - f.cy) * f.s];

// ---- the room: wall, floor, door, shaft (design space)
function room(c, t, f, closeUp) {
  const door = closeUp ? { x: 760, y: -140, w: 420, h: 1730 } : DOOR, floorY = closeUp ? 1590 : FLOOR_Y, dx = door.x + door.w / 2, dy = door.y + door.h * 0.5;
  // wall: dark mud plaster, a little warm near the door (bounce), never lit directly
  let g = c.createLinearGradient(0, 0, 0, floorY); g.addColorStop(0, '#120a06'); g.addColorStop(0.55, '#26170d'); g.addColorStop(1, '#1a0f08');
  c.fillStyle = g; c.fillRect(-200, -200, 1480, floorY + 200);
  cin.fillTexture(c, 'plaster', [-200, -200, 1480, floorY + 200], { alpha: 0.5, scale: 2.2, ox: 0, oy: 0, seed: 14 });
  // floor
  g = c.createLinearGradient(0, floorY, 0, 1920 + 200); g.addColorStop(0, '#1f140c'); g.addColorStop(1, '#0b0705'); c.fillStyle = g; c.fillRect(-200, floorY, 1480, 1920 + 200 - floorY);
  c.save(); c.beginPath(); c.rect(-200, floorY, 1480, 700); c.clip(); cin.fillTexture(c, 'stone', [-200, floorY, 1480, 700], { alpha: 0.42, scale: 2.4, ox: 0, oy: 0, seed: 15 }); c.restore();
  c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(-200, floorY - 6, 1480, 8); // skirting shadow line
  if (!closeUp) { // shelf with steel plates (top-left) and a water pot: dim shapes, rim-lit on the side facing the door
    c.fillStyle = '#17100a'; c.fillRect(-20, 640, 330, 22);
    for (let i = 0; i < 6; i++) { const x = 20 + i * 52, y = 640; c.fillStyle = '#2a2622'; c.beginPath(); c.ellipse(x, y - 14, 24, 10, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,238,200,0.35)'; c.beginPath(); c.ellipse(x + 8, y - 15, 10, 3, 0, 0, TAU); c.fill(); c.fillStyle = '#35302a'; c.fillRect(x - 24, y - 14, 48, 14); }
    const pg = c.createRadialGradient(210, 1150, 10, 190, 1170, 190); pg.addColorStop(0, '#6a3a20'); pg.addColorStop(0.6, '#241209'); pg.addColorStop(1, '#0a0503'); c.fillStyle = pg; c.beginPath(); c.ellipse(190, 1180, 120, 150, 0, 0, TAU); c.fill();
    c.fillStyle = '#0d0703'; c.beginPath(); c.ellipse(190, 1040, 62, 18, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,230,190,0.5)'; c.lineWidth = 4; c.beginPath(); c.ellipse(190, 1180, 120, 150, 0, -0.5, 0.35); c.stroke();
  }
  // warm bounce on the wall around the door (screen), strongest right at the jamb
  c.save(); c.globalCompositeOperation = 'screen'; g = c.createRadialGradient(dx, dy, door.w * 0.4, dx, dy, closeUp ? 1100 : 820); g.addColorStop(0, 'rgba(210,150,80,0.55)'); g.addColorStop(0.45, 'rgba(120,70,34,0.22)'); g.addColorStop(1, 'rgba(60,30,14,0)'); c.fillStyle = g; c.fillRect(-300, -300, 1700, 2500); c.restore();
  // the hard shaft on the floor: a trapezoid with razor edges from the door base toward the camera, then the lit floor texture inside it
  const near = closeUp ? [[560, 1920], [1200, 1920]] : [[420, 1920], [1160, 1920]], sh = [[door.x, floorY], [door.x + door.w, floorY], near[1], near[0]];
  c.save(); c.beginPath(); c.moveTo(...sh[0]); for (const p of sh.slice(1)) c.lineTo(...p); c.closePath(); c.clip();
  g = c.createLinearGradient(0, floorY, 0, 1920); g.addColorStop(0, 'rgba(255,244,214,0.92)'); g.addColorStop(0.35, 'rgba(255,222,170,0.5)'); g.addColorStop(1, 'rgba(235,190,130,0.3)'); c.fillStyle = g; c.fillRect(-100, floorY, 1400, 700);
  cin.fillTexture(c, 'stone', [-100, floorY, 1400, 700], { alpha: 0.35, scale: 2.4, ox: 0, oy: 0, seed: 15, blend: 'multiply' });
  c.restore();
  // the door: dark reveal, blown-out slab, lit inner jamb
  c.fillStyle = '#0a0604'; c.fillRect(door.x - 34, door.y - 34, door.w + 68, door.h + 34 + 34);
  c.fillStyle = '#e8d6ae'; c.fillRect(door.x - 6, door.y, 14, door.h); // the thickness of the wall catching the light
  c.fillStyle = '#fffef4'; c.fillRect(door.x + 8, door.y, door.w - 8, door.h);
  g = c.createRadialGradient(dx, dy, 0, dx, dy, door.h * 0.7); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,248,225,0.4)'); c.fillStyle = g; c.fillRect(door.x + 8, door.y, door.w - 8, door.h);
  // glow bleeding over the edges of the opening
  c.save(); c.globalCompositeOperation = 'screen'; g = c.createRadialGradient(dx, dy, door.w * 0.3, dx, dy, closeUp ? 700 : 520); g.addColorStop(0, 'rgba(255,240,200,0.55)'); g.addColorStop(1, 'rgba(255,220,160,0)'); c.fillStyle = g; c.fillRect(-300, -300, 1700, 2500); c.restore();
  return { door, dx, dy, floorY };
}

// ---- dust in the air: tiny warm specks that only exist inside the lit wedge; slow drift, a glint now and then
function motes(c, t, closeUp) {
  c.save(); c.globalCompositeOperation = 'screen';
  for (const d of dust) {
    const x = d.x + Math.sin(t * d.sp + d.ph) * 14 + t * 2.2 * (d.s - 1.2), y = d.y + Math.cos(t * d.sp * 0.8 + d.ph) * 18 - ((t * 5 * d.sp) % 40);
    const near = 1 - cl((Math.hypot(x - (closeUp ? 900 : 920), y - 800) - 200) / 900), a = d.a * (0.4 + 0.6 * near) * (0.55 + 0.45 * Math.sin(t * 1.7 + d.ph * 3));
    if (a < 0.06) continue;
    const r = d.s * (closeUp ? 1.5 : 1.15); const g = c.createRadialGradient(x, y, 0, x, y, r * 2.2); g.addColorStop(0, `rgba(255,240,205,${a})`); g.addColorStop(1, 'rgba(255,230,180,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.2, 0, TAU); c.fill();
  }
  c.restore();
}

// ---- a figure as a near-silhouette: draw it, crush it toward black, keep a trace of cloth, then ONE clean rim on the edge that faces the door
function silhouetteFigure(ctx, k, drawFig, { body = 'rgba(10,6,4,0.9)', warm = 0.16, rim = '#fff3d6', rimPx = 5, half = null } = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height, a = cin.pooled('zsd-sil-a', W, H), ax = a.getContext('2d');
  ax.setTransform(1, 0, 0, 1, 0, 0); ax.globalCompositeOperation = 'source-over'; ax.clearRect(0, 0, W, H);
  ax.save(); ax.setTransform(k, 0, 0, k, 0, 0); drawFig(ax); ax.restore();
  ax.globalCompositeOperation = 'source-atop';
  if (half) { // hard-ish terminator: left of the line is in shadow (the door light does not reach it)
    const nx = Math.cos(half.ang), ny = Math.sin(half.ang), g = ax.createLinearGradient((half.x - nx * half.soft) * k, (half.y - ny * half.soft) * k, (half.x + nx * half.soft) * k, (half.y + ny * half.soft) * k);
    g.addColorStop(0, 'rgba(8,4,3,0.82)'); g.addColorStop(0.5, 'rgba(8,4,3,0.55)'); g.addColorStop(1, 'rgba(8,4,3,0)'); ax.fillStyle = g; ax.fillRect(0, 0, W, H);
    ax.fillStyle = 'rgba(40,22,12,0.14)'; ax.fillRect(0, 0, W, H);
    if (half.fadeY !== undefined) { const fg = ax.createLinearGradient(0, half.fadeY * k, 0, (half.fadeY + 700) * k); fg.addColorStop(0, 'rgba(6,3,2,0)'); fg.addColorStop(1, 'rgba(6,3,2,0.85)'); ax.fillStyle = fg; ax.fillRect(0, 0, W, H); } // below the face the door light has dropped off
  } else { ax.fillStyle = body; ax.fillRect(0, 0, W, H);
    const g = ax.createLinearGradient(W * 0.2, 0, W, 0); g.addColorStop(0, 'rgba(255,190,120,0)'); g.addColorStop(1, `rgba(255,190,120,${warm})`); ax.fillStyle = g; ax.fillRect(0, 0, W, H); }
  ax.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(a, 0, 0);
  const m = cin.pooled('zsd-sil-m', W, H), mx = m.getContext('2d'); // saturated alpha mask: partly transparent cloth must not leave a halo on the far edge
  mx.setTransform(1, 0, 0, 1, 0, 0); mx.globalCompositeOperation = 'source-over'; mx.clearRect(0, 0, W, H); for (let i = 0; i < 5; i++) mx.drawImage(a, 0, 0);
  const b = cin.pooled('zsd-sil-b', W, H), bx = b.getContext('2d');
  for (const [px, al] of [[rimPx * 2.6, 0.32], [rimPx, 0.95]]) {
    bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'source-over'; bx.clearRect(0, 0, W, H); bx.drawImage(m, 0, 0);
    bx.globalCompositeOperation = 'source-in'; bx.fillStyle = rim; bx.fillRect(0, 0, W, H);
    bx.globalCompositeOperation = 'destination-out'; bx.drawImage(m, -LN.x * px * k, -LN.y * px * k);
    ctx.globalAlpha = al; ctx.drawImage(b, 0, 0);
  }
  ctx.restore();
}

const sil = (o) => (c, pts) => { for (const part of pts) { c.beginPath(); c.moveTo(part[0][0], part[0][1]); for (const q of part.slice(1)) c.lineTo(q[0], q[1]); c.closePath(); c.fill(); } };

// ---- the shot -------------------------------------------------------------------------------------------------------------------------------------
export function shotDadi(ctx, t, lt, dur, w) {
  figs();
  const k = ctx.canvas.width / 1080, closeUp = lt >= 6.2, cam = cin.createCamera({});
  const DUR_A = 6.2, f = closeUp ? frame(t, lt - DUR_A, dur - DUR_A, 0.1, 700, 700) : frame(t, lt, DUR_A, 0.07, 700, 900);
  cam.update(t, cin.pushIn({ t0: 0, dur, amount: 0.06 }), cin.handheldMove(9, 0.4));
  ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1080, 1920);
  ctx.save(); applyFrame(ctx, f);
  const R = room(ctx, t, f, closeUp);
  const lightS = { ...kit.LIGHTS.doorway, dir: LIGHT, key: '#fff6e0', amb: '#120a07', strength: 0.5, hard: false, rim: '#fff3d6', rimA: 0 };

  let dadiSt, boySt = null, occl;
  if (!closeUp) {
    dadiSt = { x: 690, feet: 1480, height: 1240, facing: -1, pose: 'stand', t, light: lightS, gaze: [-0.7, 0.1], expr: 'worried', look: 0.55 };
    boySt = { x: 250, feet: 2010, height: 1500, facing: 1, pose: { name: 'turn', turn: 1 }, t, light: lightS, look: 3.0 };
    // shadows on the lit floor, thrown toward the camera and a little left (point light at the door)
    const L0 = { x: R.dx, y: R.dy, floorY: R.floorY };
    ctx.save(); ctx.beginPath(); ctx.moveTo(DOOR.x, FLOOR_Y); ctx.lineTo(DOOR.x + DOOR.w, FLOOR_Y); ctx.lineTo(1160, 1920); ctx.lineTo(420, 1920); ctx.closePath(); ctx.clip();
    dadi.shadow(ctx, dadiSt, L0, { alpha: 0.6, soft: 10, squash: 0.55 });
    ctx.restore();
    occl = (o) => { o.fillStyle = '#000'; sil()(o, dadi.silhouette(dadiSt)); sil()(o, boy.silhouette(boySt)); };
    // dust sits behind the figures, godRays are added over everything, then the figures stay near black on top
    motes(ctx, t, false);
    ctx.restore(); // leave the frame transform for the god-rays (screen space)
    cin.godRays(ctx, (o) => { o.save(); applyFrame(o, f); occl(o); o.restore(); }, { x: mapPt(f, R.dx, R.dy)[0], y: mapPt(f, R.dx, R.dy)[1] }, {
      samples: 16, decay: 0.94, density: 0.9, intensity: 0.55, color: '#ffe6bd', frame: Math.round(t * 30), seed: 4,
      source: (o) => { o.save(); applyFrame(o, f); o.fillStyle = '#fff'; o.fillRect(DOOR.x + 8, DOOR.y, DOOR.w - 8, DOOR.h); o.restore(); },
    });
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.save(); applyFrame(ctx, f);
    silhouetteFigure(ctx, k * 1, (c) => { c.save(); applyFrame(c, f); dadi.draw(c, dadiSt); c.restore(); }, { rimPx: 4.5 });
    silhouetteFigure(ctx, k * 1, (c) => { c.save(); applyFrame(c, f); boy.draw(c, boySt); c.restore(); }, { body: 'rgba(8,5,3,0.9)', rimPx: 5.5, warm: 0.1 });
    ctx.restore();
  } else {
    // medium close-up: Dadi's face and raised hand, half in the shaft
    const base = { x: 540, feet: 3300, height: 3300, facing: 1, pose: 'stand', t, light: { ...lightS, strength: 0.85, amb: '#1a0f0a', rimA: 0.35 }, gaze: [-0.8, 0.05], expr: 'worried', look: 0.2, talk: 0.45, eyeLight: 0.8,
      reachR: [840, 470 + Math.sin(t * 2.2) * 10], grip: { R: 0.92 }, curls: { R: [0, 1, 1, 1] }, thumbTuck: { R: 1 }, spread: 0.2 };
    const h0 = dadi.joints(base).head; // place the head: centre of the frame, upper half (the caption band stays on her chest)
    dadiSt = { ...base, x: base.x + (520 - h0[0]), feet: base.feet + (650 - h0[1]) };
    occl = (o) => { o.fillStyle = '#000'; sil()(o, dadi.silhouette(dadiSt)); };
    motes(ctx, t, true);
    ctx.restore();
    cin.godRays(ctx, (o) => { o.save(); applyFrame(o, f); occl(o); o.restore(); }, { x: mapPt(f, R.dx, R.dy)[0], y: mapPt(f, R.dx, R.dy)[1] }, {
      samples: 14, decay: 0.94, density: 0.9, intensity: 0.4, color: '#ffe6bd', frame: Math.round(t * 30), seed: 4,
      source: (o) => { o.save(); applyFrame(o, f); o.fillStyle = '#fff'; o.fillRect(R.door.x + 8, R.door.y, R.door.w - 8, R.door.h); o.restore(); },
    });
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.save(); applyFrame(ctx, f);
    const hj = dadi.joints(dadiSt).head;
    silhouetteFigure(ctx, k, (c) => { c.save(); applyFrame(c, f); dadi.draw(c, dadiSt); c.restore(); }, { rimPx: 6, half: { x: hj[0] + 6, y: hj[1], ang: 0.1, soft: 34, fadeY: hj[1] + 380 } });
    ctx.restore();
  }
  ctx.restore();
  return cam;
}
