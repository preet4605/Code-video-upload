// cartoon: outlined flat-vector style kit (uniform dark outline, flat fills, one shade tone, graphic light).
// Characters are rigs: posed by params (expression, look, blink, breath, tilt), reused in every shot.
// All coordinates are in 1080x1920 reference units; call inside ctx.scale(width/1080, ...). Pure functions of params.

export let INK = '#24180f';
export const PAL = ({
  night: '#1c2147', night2: '#262c5e', night3: '#323a73', star: '#fff6d6',
  wall: '#3a3f73', wallShade: '#2e3260', floor: '#4a3b5c', floorShade: '#3b2e4a',
  wood: '#8a5a3c', woodShade: '#6b432b', woodLight: '#a8724e',
  skin: '#f5b98c', skinShade: '#e09a6c', blush: '#ff8f8f',
  hair: '#2b1d1a', hairShine: '#4a3530',
  sari: '#d9485f', sariShade: '#b5374d', kurta: '#4a90d9', kurtaShade: '#3874b5',
  blanket: '#5b8fd6', blanketShade: '#4673b3', blanketPat: '#7fb0ef', pillow: '#f4ecdf', pillowShade: '#d9cdb9',
  doorLight: '#ffbe5c', moon: '#fff1b8', red: '#ff4646', white: '#fffaf0', ghost: '#cfd6e6', ghostShade: '#9aa6c2',
  curtain: '#c0475f', curtainShade: '#9c3449', sky0: '#141838', sky1: '#2b3170', cloud: '#3d4589', fan: '#8f7ca2', fanShade: '#6f5d82', moonShade: '#f2dc8c', wallDot: 0.05
});
const BASE = { ...PAL, ink: '#24180f' };
// Themes swap the palette for a whole frame. 'horror': cold, desaturated, crushed, accents only in motivated light.
export const THEMES = Object.freeze({
  cartoon: BASE,
  horror: {
    ...BASE, ink: '#040405',
    night: '#07080c', night2: '#0d0f15', night3: '#141821', star: '#b8c2cc',
    wall: '#232a30', wallShade: '#161b20', floor: '#2b2d33', floorShade: '#1d1f24',
    wood: '#3a2f27', woodShade: '#241d18', woodLight: '#4a3d33',
    skin: '#cdbbaa', skinShade: '#9a897a', blush: '#7a5a5a',
    hair: '#0c0b0b', hairShine: '#2a2828',
    blanket: '#3a4450', blanketShade: '#262d36', blanketPat: '#4a5562', pillow: '#a9a69c', pillowShade: '#7c7a73',
    doorLight: '#ffad55', moon: '#d6dee6', red: '#d42a2a', white: '#bdb8ac',
    curtain: '#2c2a2e', curtainShade: '#1c1b1e', blushOff: true, sky0: '#06080d', sky1: '#141a26', cloud: '#1d2430', fan: '#2f3238', fanShade: '#1f2125', moonShade: '#aab4bf', wallDot: 0.025
  }
});
export function useTheme(name = 'cartoon') {
  const th = THEMES[name] || BASE;
  Object.assign(PAL, th);
  INK = th.ink;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const ease = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Core primitive: fill a path, optionally shade part of it (clip), then outline it.
export function shape(ctx, path, { fill, lw = 6, ink = null, shadePath = null, shadeFill = null, noOutline = false } = {}) {
  ctx.beginPath(); path(ctx);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (shadePath && shadeFill) {
    ctx.save(); ctx.beginPath(); path(ctx); ctx.clip();
    ctx.beginPath(); shadePath(ctx); ctx.fillStyle = shadeFill; ctx.fill();
    ctx.restore();
  }
  if (!noOutline) { ctx.beginPath(); path(ctx); ctx.lineWidth = lw; ctx.strokeStyle = ink || INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}
export const rrect = (x, y, w, h, r) => (c) => c.roundRect(x, y, w, h, r);
export const ellipse = (x, y, rx, ry, rot = 0) => (c) => c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
export const poly = (pts) => (c) => { c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.closePath(); };
export function line(ctx, pts, { lw = 6, ink = null } = {}) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.lineWidth = lw; ctx.strokeStyle = ink || INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}
export function glow(ctx, x, y, r, color, a = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(color, a)); g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
export function hexA(hex, a) {
  const h = hex.replace('#', ''); const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function sparkle(ctx, x, y, r, color = PAL.star, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill(); ctx.restore();
}
export function starfield(ctx, { x0 = 0, y0 = 0, w = 1080, h = 1920, n = 80, seed = 3, t = 0 } = {}) {
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * w, y = y0 + r() * h, s = 2 + r() * 5, ph = r() * 6.3;
    const tw = 0.55 + 0.45 * Math.sin(t * (1 + r() * 2) + ph);
    if (s > 5.2) sparkle(ctx, x, y, s * 2.2, PAL.star, tw); else { ctx.fillStyle = hexA(PAL.star, 0.5 + 0.5 * tw); ctx.beginPath(); ctx.arc(x, y, s * 0.6, 0, Math.PI * 2); ctx.fill(); }
  }
}
export function rays(ctx, x, y, { n = 14, r0 = 60, r1 = 1400, color = '#ffd98a', a = 0.18, t = 0, spin = 0.05 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * spin);
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n;
    ctx.beginPath(); ctx.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0); ctx.lineTo(Math.cos(a0) * r1, Math.sin(a0) * r1);
    ctx.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1); ctx.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0); ctx.closePath();
    ctx.fillStyle = hexA(color, a); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Faces. expr: 'calm' | 'smile' | 'scared' | 'shock' | 'sleep' | 'wrong' (too-wide eyes, flat mouth)
export function face(ctx, { x, y, s = 1, expr = 'calm', look = [0, 0], blink = 0, ink = null, mouthOpen = 0 } = {}) {
  ink = ink || INK;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const ex = 34, ey = -6;
  const eyeOpen = expr === 'sleep' ? 0 : 1 - blink;
  for (const side of [-1, 1]) {
    const cx = side * ex;
    if (eyeOpen < 0.15) {
      line(ctx, [[cx - 14, ey + 2], [cx, ey + 8], [cx + 14, ey + 2]], { lw: 5, ink });
    } else {
      const ry = (expr === 'wrong' ? 22 : expr === 'shock' || expr === 'scared' ? 17 : 15) * eyeOpen;
      const rx = expr === 'wrong' ? 18 : 13;
      shape(ctx, ellipse(cx, ey, rx, ry), { fill: expr === 'wrong' ? '#f4f1e8' : '#1d140f', lw: 4, ink });
      if (expr === 'wrong') { ctx.fillStyle = '#120c08'; ctx.beginPath(); ctx.arc(cx + look[0] * 4, ey + look[1] * 4, 4, 0, Math.PI * 2); ctx.fill(); }
      else {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - 4 + look[0] * 3, ey - 6 * eyeOpen + look[1] * 3, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 5 + look[0] * 3, ey + 4 * eyeOpen + look[1] * 3, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (expr === 'scared' || expr === 'shock') line(ctx, [[cx - 12 * side, ey - 36], [cx + 12 * side, ey - 28]], { lw: 5, ink });
  }
  if (expr !== 'wrong' && expr !== 'sleep' && !PAL.blushOff) { ctx.fillStyle = hexA(PAL.blush, 0.55); for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * 52, 22, 14, 8, 0, 0, Math.PI * 2); ctx.fill(); } }
  // mouth
  if (expr === 'smile') { ctx.beginPath(); ctx.arc(0, 18, 14, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 5; ctx.strokeStyle = ink; ctx.stroke(); }
  else if (expr === 'scared') shape(ctx, ellipse(0, 28, 9, 7 + 6 * mouthOpen), { fill: '#7a2f2f', lw: 4, ink });
  else if (expr === 'shock') shape(ctx, ellipse(0, 30, 12, 14), { fill: '#7a2f2f', lw: 4, ink });
  else if (expr === 'wrong') { if (mouthOpen > 0.05) shape(ctx, rrect(-26, 26, 52, 6 + 30 * mouthOpen, 4), { fill: '#0b0706', lw: 4, ink }); else line(ctx, [[-26, 30], [26, 30]], { lw: 4, ink }); }
  else if (expr === 'sleep') line(ctx, [[-8, 24], [8, 24]], { lw: 4, ink });
  else { ctx.beginPath(); ctx.arc(0, 20, 9, 0.2 * Math.PI, 0.8 * Math.PI); ctx.lineWidth = 4.5; ctx.strokeStyle = ink; ctx.stroke(); }
  ctx.restore();
}

// Kid head (front), with tuft of hair. Origin = centre of head.
export function kidHead(ctx, { x, y, s = 1, expr = 'calm', look, blink = 0, tilt = 0, mouthOpen = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(s, s);
  for (const side of [-1, 1]) shape(ctx, ellipse(side * 92, 8, 18, 24), { fill: PAL.skin, lw: 5 });
  shape(ctx, ellipse(0, 0, 95, 88), { fill: PAL.skin, shadePath: ellipse(40, 40, 90, 70), shadeFill: PAL.skinShade, lw: 6 });
  shape(ctx, (c) => { c.moveTo(-92, -10); c.bezierCurveTo(-98, -80, -40, -105, 0, -100); c.bezierCurveTo(50, -105, 100, -70, 92, -12); c.bezierCurveTo(70, -48, 40, -60, 10, -52); c.bezierCurveTo(-10, -70, -50, -50, -92, -10); c.closePath(); }, { fill: PAL.hair, lw: 6 });
  shape(ctx, (c) => { c.moveTo(-6, -96); c.quadraticCurveTo(-20, -140, 18, -150); c.quadraticCurveTo(0, -126, 14, -98); c.closePath(); }, { fill: PAL.hair, lw: 5 });
  ctx.strokeStyle = PAL.hairShine; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(-20, -64, 30, 3.6, 4.4); ctx.stroke();
  face(ctx, { x: 0, y: 14, s: 1, expr, look, blink, mouthOpen });
  ctx.restore();
}

// Woman head (front). hairBun on top. variant 'nani' = white hair + glasses.
export function womanHead(ctx, { x, y, s = 1, expr = 'calm', look, blink = 0, tilt = 0, variant = 'mom', mouthOpen = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(s, s);
  const hair = variant === 'nani' ? '#e9e4dc' : PAL.hair;
  const hairShade = variant === 'nani' ? '#c9c2b6' : PAL.hairShine;
  shape(ctx, ellipse(0, -96, 46, 40), { fill: hair, lw: 6 });
  shape(ctx, (c) => { c.moveTo(-100, 40); c.bezierCurveTo(-120, -60, -70, -112, 0, -110); c.bezierCurveTo(70, -112, 120, -60, 100, 40); c.closePath(); }, { fill: hair, lw: 6 });
  shape(ctx, ellipse(0, 6, 88, 92), { fill: PAL.skin, shadePath: ellipse(40, 46, 80, 70), shadeFill: PAL.skinShade, lw: 6 });
  shape(ctx, (c) => { c.moveTo(-90, 0); c.bezierCurveTo(-92, -76, -30, -98, 0, -94); c.bezierCurveTo(30, -98, 92, -76, 90, 0); c.bezierCurveTo(60, -40, 20, -60, 0, -58); c.bezierCurveTo(-20, -60, -60, -40, -90, 0); c.closePath(); }, { fill: hair, lw: 6 });
  ctx.strokeStyle = hairShade; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(-30, -62, 34, 3.5, 4.3); ctx.stroke();
  shape(ctx, ellipse(0, -40, 7, 7), { fill: PAL.red, lw: 3 }); // bindi
  face(ctx, { x: 0, y: 22, s: 0.95, expr, look, blink, mouthOpen });
  if (variant === 'nani') { ctx.lineWidth = 5; ctx.strokeStyle = INK; for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * 32, 16, 24, 0, Math.PI * 2); ctx.stroke(); } line(ctx, [[-8, 16], [8, 16]], { lw: 5 }); }
  ctx.restore();
}

// Woman lying on her side, seen from behind (hair bun towards camera). Origin = head centre.
export function womanBackLying(ctx, { x, y, s = 1, breath = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  shape(ctx, ellipse(0, 0, 92, 86), { fill: PAL.hair, lw: 6 });
  shape(ctx, ellipse(-60, -40, 44, 38), { fill: PAL.hair, lw: 6 });
  ctx.strokeStyle = PAL.hairShine; ctx.lineWidth = 7;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(10, 10, 40 + i * 16, 3.5 + i * 0.1, 4.6); ctx.stroke(); }
  shape(ctx, ellipse(78, 30, 16, 22), { fill: PAL.skin, lw: 5 });
  ctx.restore();
}

// Bed seen from the foot end in 3/4: headboard, mattress, two pillows, blanket with two humps.
export function bed(ctx, { x = 540, y = 1180, w = 860, t = 0, kid = { expr: 'calm' }, mom = 'sleep', momUp = 0, wrongFace = 0, kidLook = [0, 0], kidBlink = 0, blanketTug = 0 } = {}) {
  const hw = w / 2;
  // headboard
  shape(ctx, rrect(x - hw, y - 420, w, 300, 40), { fill: PAL.wood, shadePath: rrect(x - hw, y - 220, w, 120, 0), shadeFill: PAL.woodShade, lw: 7 });
  shape(ctx, rrect(x - hw + 40, y - 380, w - 80, 170, 26), { fill: PAL.woodLight, lw: 5 });
  for (const sx of [-1, 1]) shape(ctx, ellipse(x + sx * (hw - 60), y - 440, 26, 26), { fill: PAL.wood, lw: 6 });
  // mattress side
  shape(ctx, rrect(x - hw - 20, y + 60, w + 40, 150, 30), { fill: PAL.wood, shadePath: rrect(x - hw - 20, y + 150, w + 40, 60, 0), shadeFill: PAL.woodShade, lw: 7 });
  // pillows
  shape(ctx, rrect(x - hw + 30, y - 230, 330, 130, 60), { fill: PAL.pillow, shadePath: rrect(x - hw + 30, y - 150, 330, 60, 0), shadeFill: PAL.pillowShade, lw: 6 });
  shape(ctx, rrect(x + hw - 360, y - 230, 330, 130, 60), { fill: PAL.pillow, shadePath: rrect(x + hw - 360, y - 150, 330, 60, 0), shadeFill: PAL.pillowShade, lw: 6 });
  // heads on pillows
  const b = Math.sin(t * 1.6) * 3;
  kidHead(ctx, { x: x - hw + 195, y: y - 205 + b, s: 0.78, expr: kid.expr, look: kidLook, blink: kidBlink, tilt: -0.08, mouthOpen: kid.mouthOpen || 0 });
  if (momUp < 0.02) {
    if (wrongFace > 0.02) womanHead(ctx, { x: x + hw - 195, y: y - 205, s: 0.8, expr: 'wrong', tilt: 0.1, mouthOpen: wrongFace > 0.6 ? (wrongFace - 0.6) / 0.4 : 0 });
    else womanBackLying(ctx, { x: x + hw - 195, y: y - 205 + Math.sin(t * 1.3 + 1) * 3, s: 0.8 });
  }
  // blanket: two humps (the right hump flattens when mom gets up)
  const tug = blanketTug;
  shape(ctx, (c) => {
    c.moveTo(x - hw - 10, y + 90);
    c.lineTo(x - hw - 10, y - 110);
    c.bezierCurveTo(x - hw + 60, y - 170 - b, x - 120, y - 170 - b, x - 30, y - 120);
    const h2 = lerp(150, 40, momUp);
    c.bezierCurveTo(x + 40, y - 80 - h2 + tug * 30, x + hw - 60, y - 60 - h2, x + hw + 10, y - 110 + momUp * 60);
    c.lineTo(x + hw + 10, y + 90); c.closePath();
  }, { fill: PAL.blanket, shadePath: rrect(x - hw - 20, y + 10, w + 40, 100, 0), shadeFill: PAL.blanketShade, lw: 7 });
  if (kid.hands) {
    for (const [hx, rot] of [[x - hw + 140, -0.25], [x - hw + 255, 0.25]]) {
      ctx.save(); ctx.translate(hx, y - 128); ctx.rotate(rot);
      shape(ctx, rrect(-26, -12, 52, 34, 14), { fill: PAL.skin, shadePath: rrect(-26, 8, 52, 14, 0), shadeFill: PAL.skinShade, lw: 5 });
      for (let k = 0; k < 4; k++) line(ctx, [[-18 + k * 12, -12], [-18 + k * 12, 4]], { lw: 3 });
      ctx.restore();
    }
  }
  // blanket pattern (stitched stars) + fold lines = detail
  const r = mulberry32(21);
  for (let i = 0; i < 18; i++) {
    const px = x - hw + 40 + r() * (w - 80), py = y - 60 + r() * 120;
    ctx.fillStyle = PAL.blanketPat; ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = hexA(INK, 0.45); ctx.lineWidth = 5;
  for (const fx of [-0.55, -0.2, 0.25, 0.6]) { ctx.beginPath(); ctx.moveTo(x + fx * hw, y + 80); ctx.quadraticCurveTo(x + fx * hw + 20, y - 10, x + fx * hw - 10, y - 70); ctx.stroke(); }
}

// Window with curtains, moon and stars; drawn as a framed panel.
export function windowMoon(ctx, { x, y, w = 360, h = 460, t = 0, moon = 1 } = {}) {
  shape(ctx, rrect(x - 18, y - 18, w + 36, h + 36, 18), { fill: PAL.woodShade, lw: 7 });
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, PAL.sky0); g.addColorStop(1, PAL.sky1);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  starfield(ctx, { x0: x, y0: y, w, h, n: 26, seed: 8, t });
  glow(ctx, x + w * 0.66, y + h * 0.3, 160, PAL.moon, 0.35 * moon);
  shape(ctx, ellipse(x + w * 0.66, y + h * 0.3, 52, 52), { fill: PAL.moon, shadePath: ellipse(x + w * 0.66 + 26, y + h * 0.3 - 8, 44, 48), shadeFill: PAL.moonShade, lw: 5 });
  const cx = x + ((t * 9) % (w + 300)) - 150;
  shape(ctx, (c) => { c.ellipse(cx, y + h * 0.38, 90, 26, 0, 0, Math.PI * 2); c.ellipse(cx + 60, y + h * 0.34, 60, 24, 0, 0, Math.PI * 2); }, { fill: PAL.cloud, lw: 5 });
  ctx.restore();
  shape(ctx, rrect(x + w / 2 - 7, y, 14, h, 2), { fill: PAL.woodShade, lw: 5 });
  shape(ctx, rrect(x, y + h / 2 - 7, w, 14, 2), { fill: PAL.woodShade, lw: 5 });
  shape(ctx, rrect(x, y, w, h, 10), { fill: null, lw: 7 });
  // curtains
  const sw = Math.sin(t * 0.8) * 8;
  for (const side of [-1, 1]) {
    const cx0 = side < 0 ? x - 150 : x + w + 150;
    shape(ctx, (c) => { c.moveTo(cx0, y - 50); c.lineTo(cx0 - side * 120, y - 50); c.quadraticCurveTo(cx0 - side * (90 + sw), y + h * 0.5, cx0 - side * (130 + sw), y + h + 60); c.lineTo(cx0, y + h + 60); c.closePath(); },
      { fill: PAL.curtain, shadePath: rrect(cx0 - (side < 0 ? 0 : 50), y - 50, 50, h + 120, 0), shadeFill: PAL.curtainShade, lw: 6 });
    for (let k = 1; k < 3; k++) line(ctx, [[cx0 - side * k * 36, y - 40], [cx0 - side * (k * 34 + sw * 0.5), y + h + 50]], { lw: 3.5, ink: hexA(INK, 0.6) });
  }
  shape(ctx, rrect(x - 170, y - 70, w + 340, 22, 11), { fill: PAL.wood, lw: 6 });
}

export function door(ctx, { x, y, w = 300, h = 640, strip = 0, feet = 0, open = 0, kitchen = null } = {}) {
  shape(ctx, rrect(x - 22, y - 22, w + 44, h + 22, 10), { fill: PAL.woodShade, lw: 7 });
  if (open > 0) {
    ctx.fillStyle = PAL.doorLight; ctx.fillRect(x, y, w, h);
    if (kitchen) kitchen(ctx, x, y, w, h);
    shape(ctx, poly([[x, y], [x + w * (1 - open * 0.8), y + 30 * open], [x + w * (1 - open * 0.8), y + h - 20 * open], [x, y + h]]), { fill: PAL.wood, lw: 7 });
  } else {
    shape(ctx, rrect(x, y, w, h, 6), { fill: PAL.wood, shadePath: rrect(x + w * 0.62, y, w, h, 0), shadeFill: PAL.woodShade, lw: 7 });
    shape(ctx, rrect(x + 36, y + 40, w - 72, h * 0.36, 10), { fill: PAL.woodLight, lw: 5 });
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = hexA(INK, 0.35); ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const gx = x + 14 + i * (w - 28) / 8; ctx.beginPath(); ctx.moveTo(gx, y + 6); ctx.bezierCurveTo(gx + 8, y + h * 0.3, gx - 8, y + h * 0.6, gx + 4, y + h - 6); ctx.stroke(); }
    ctx.restore();
    shape(ctx, rrect(x + 36, y + h * 0.5, w - 72, h * 0.42, 10), { fill: PAL.woodLight, lw: 5 });
    shape(ctx, ellipse(x + 36, y + h * 0.47, 12, 12), { fill: PAL.woodLight === '#4a3d33' ? '#6b5a3a' : '#f2c14e', lw: 4 });
  }
  if (strip > 0) {
    glow(ctx, x + w / 2, y + h + 6, 280, PAL.doorLight, 0.5 * strip);
    ctx.fillStyle = hexA('#fff0c4', strip); ctx.fillRect(x + 4, y + h - 8, w - 8, 12);
    ctx.fillStyle = hexA(PAL.doorLight, 0.28 * strip);
    ctx.beginPath(); ctx.moveTo(x + 4, y + h + 4); ctx.lineTo(x + w - 4, y + h + 4); ctx.lineTo(x + w + 130, y + h + 200); ctx.lineTo(x - 130, y + h + 200); ctx.closePath(); ctx.fill();
    if (feet > 0) {
      ctx.fillStyle = hexA('#140d09', feet);
      for (const fx of [x + w * 0.3, x + w * 0.58]) {
        ctx.fillRect(fx, y + h - 8, 44, 12);
        ctx.beginPath(); ctx.moveTo(fx, y + h + 4); ctx.lineTo(fx + 44, y + h + 4); ctx.lineTo(fx + 44 + (fx - x - w / 2) * 0.7, y + h + 200); ctx.lineTo(fx + (fx - x - w / 2) * 0.7, y + h + 200); ctx.closePath(); ctx.fill();
      }
    }
  }
}

export function wallClock(ctx, { x, y, r = 78, label = '3:07', glowA = 1, t = 0 } = {}) {
  glow(ctx, x, y, r * 2.4, PAL.red, 0.25 * glowA);
  shape(ctx, rrect(x - r * 1.5, y - r * 0.75, r * 3, r * 1.5, 22), { fill: '#2a1c22', lw: 7 });
  shape(ctx, rrect(x - r * 1.3, y - r * 0.55, r * 2.6, r * 1.1, 14), { fill: '#120b0e', lw: 4 });
  ctx.fillStyle = hexA(PAL.red, 0.85 + 0.15 * Math.sin(t * 6)); ctx.font = `bold ${Math.round(r * 0.95)}px "DejaVu Sans Mono", monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y + 4);
}

export function ceilingFan(ctx, { x, y, t = 0, speed = 3 } = {}) {
  line(ctx, [[x, y - 140], [x, y]], { lw: 10 });
  const blades = [0, 1, 2].map((k) => t * speed + (k * Math.PI * 2) / 3).sort((a, b) => Math.sin(a) - Math.sin(b));
  for (const a of blades) {
    const ex = Math.cos(a) * 250, ey = Math.sin(a) * 60;
    const px = -Math.sin(a) * 26, py = Math.cos(a) * 7;
    shape(ctx, (c) => { c.moveTo(x + px * 0.6, y + py * 0.6); c.lineTo(x + ex + px, y + ey + py); c.quadraticCurveTo(x + ex * 1.06, y + ey * 1.06, x + ex - px, y + ey - py); c.lineTo(x - px * 0.6, y - py * 0.6); c.closePath(); },
      { fill: Math.sin(a) > 0 ? PAL.fan : PAL.fanShade, lw: 5 });
  }
  shape(ctx, ellipse(x, y, 42, 24), { fill: PAL.fan, shadePath: ellipse(x, y + 12, 42, 14), shadeFill: PAL.fanShade, lw: 6 });
}

// Wall decor: framed photo + calendar + shelf with objects = detail density
export function wallDecor(ctx, { x, y, t = 0 } = {}) {
  shape(ctx, rrect(x, y, 150, 180, 8), { fill: PAL.woodShade, lw: 6 });
  shape(ctx, rrect(x + 18, y + 18, 114, 144, 4), { fill: PAL.pillow, lw: 4 });
  womanHead(ctx, { x: x + 75, y: y + 92, s: 0.36, variant: 'nani', expr: 'smile' });
  line(ctx, [[x + 75, y - 30], [x + 30, y], [x + 75, y - 30], [x + 120, y]], { lw: 4 });
  shape(ctx, rrect(x + 210, y + 20, 130, 170, 6), { fill: PAL.white, lw: 6 });
  shape(ctx, rrect(x + 210, y + 20, 130, 40, 6), { fill: PAL.red, lw: 6 });
  ctx.fillStyle = INK;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) ctx.fillRect(x + 224 + c * 23, y + 76 + r * 26, 12, 12);
}


// ---------------------------------------------------------------------------------------------
// Dread set dressing (deterministic from seed). All drawn in the current theme's ink.
export function grime(ctx, { x, y, w, h, seed = 1, n = 9, a = 0.35 } = {}) {
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const cx = x + r() * w, cy = y + r() * h, rx = 30 + r() * 90, ry = 20 + r() * 70;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(rx, ry));
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, r() * 3, 0, Math.PI * 2); ctx.fill();
  }
  // drip streaks
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineCap = 'round';
  for (let i = 0; i < Math.ceil(n / 2); i++) { const sx = x + r() * w, sy = y + r() * h * 0.5; ctx.lineWidth = 3 + r() * 5; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (r() - 0.5) * 10, sy + 60 + r() * 160); ctx.stroke(); }
}
export function cracks(ctx, { x, y, len = 220, seed = 2, lw = 3 } = {}) {
  const r = mulberry32(seed);
  const branch = (px, py, ang, l, depth) => {
    let cx = px, cy = py;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    const steps = 5;
    for (let i = 0; i < steps; i++) { ang += (r() - 0.5) * 0.9; cx += Math.cos(ang) * l / steps; cy += Math.sin(ang) * l / steps; ctx.lineTo(cx, cy); }
    ctx.lineWidth = lw * (depth ? 0.6 : 1); ctx.strokeStyle = INK; ctx.stroke();
    if (depth < 2) for (let k = 0; k < 2; k++) branch(px + (cx - px) * (0.3 + r() * 0.5), py + (cy - py) * (0.3 + r() * 0.5), ang + (r() - 0.5) * 2, l * 0.45, depth + 1);
  };
  branch(x, y, Math.PI / 2 + (r() - 0.5), len, 0);
}
export function peel(ctx, { x, y, s = 1 } = {}) {
  // a curled strip of wallpaper showing the pale plaster under it
  shape(ctx, (c) => { c.moveTo(x, y); c.lineTo(x + 70 * s, y); c.lineTo(x + 60 * s, y + 160 * s); c.lineTo(x + 10 * s, y + 150 * s); c.closePath(); }, { fill: '#5a5a52', lw: 4 });
  shape(ctx, (c) => { c.moveTo(x + 10 * s, y + 150 * s); c.quadraticCurveTo(x + 40 * s, y + 230 * s, x + 80 * s, y + 190 * s); c.quadraticCurveTo(x + 55 * s, y + 175 * s, x + 60 * s, y + 160 * s); c.closePath(); }, { fill: PAL.wall, shadePath: ellipse(x + 50 * s, y + 200 * s, 30 * s, 20 * s), shadeFill: PAL.wallShade, lw: 4 });
}
export function scratches(ctx, { x, y, w, h, seed = 4, n = 14, a = 0.55 } = {}) {
  const r = mulberry32(seed);
  ctx.strokeStyle = `rgba(190,170,150,${a})`; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const sx = x + r() * w, sy = y + r() * h * 0.6, l = 40 + r() * 120;
    ctx.lineWidth = 1.5 + r() * 2;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (r() - 0.5) * 30, sy + l); ctx.stroke();
  }
  // a set of four parallel claw lines
  const cx = x + w * 0.55, cy = y + h * 0.35;
  ctx.lineWidth = 3.5; ctx.strokeStyle = `rgba(200,180,160,${a + 0.2})`;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(cx + k * 16, cy); ctx.quadraticCurveTo(cx + k * 16 + 10, cy + 90, cx + k * 14 + 4, cy + 190); ctx.stroke(); }
}
export function handprint(ctx, { x, y, s = 1, rot = 0, a = 0.6, color = '#7a1e1e' } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.globalAlpha = a; ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(0, 0, 34, 40, 0, 0, Math.PI * 2); ctx.fill();
  const fingers = [[-30, -52, 0.35, 44], [-11, -66, 0.12, 50], [9, -66, -0.05, 50], [27, -54, -0.25, 44], [42, -6, -1.0, 34]];
  for (const [fx, fy, fr, fl] of fingers) { ctx.save(); ctx.translate(fx, fy); ctx.rotate(fr); ctx.beginPath(); ctx.roundRect(-7, -fl / 2, 14, fl, 7); ctx.fill(); ctx.restore(); }
  ctx.globalAlpha = a * 0.7; for (let i = 0; i < 3; i++) { ctx.fillRect(-20 + i * 18, 30, 5, 40 + i * 25); }
  ctx.restore();
}
export function cobweb(ctx, { x, y, r = 160, corner = 'tl', a = 0.35 } = {}) {
  const sx = corner.includes('r') ? -1 : 1, sy = corner.includes('b') ? -1 : 1;
  ctx.strokeStyle = `rgba(200,205,210,${a})`; ctx.lineWidth = 1.6;
  const spokes = 6;
  for (let i = 0; i <= spokes; i++) { const ang = (i / spokes) * Math.PI / 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sx * Math.cos(ang) * r, y + sy * Math.sin(ang) * r); ctx.stroke(); }
  for (let k = 1; k <= 5; k++) {
    ctx.beginPath();
    for (let i = 0; i <= spokes; i++) { const ang = (i / spokes) * Math.PI / 2, rr = (k / 5) * r * (0.92 + 0.08 * Math.sin(i * 3 + k)); const px = x + sx * Math.cos(ang) * rr, py = y + sy * Math.sin(ang) * rr; if (i === 0) ctx.moveTo(px, py); else ctx.quadraticCurveTo(x + sx * Math.cos(ang - 0.13) * rr * 0.9, y + sy * Math.sin(ang - 0.13) * rr * 0.9, px, py); }
    ctx.stroke();
  }
}
export function bareBulb(ctx, { x, y, t = 0, on = 0, sway = 1 } = {}) {
  const a = Math.sin(t * 0.9) * 0.05 * sway;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  line(ctx, [[0, -400], [0, 0]], { lw: 4 });
  shape(ctx, rrect(-14, -8, 28, 26, 4), { fill: '#3a3530', lw: 4 });
  if (on > 0) { glow(ctx, 0, 48, 260, '#ffd08a', 0.45 * on); }
  shape(ctx, ellipse(0, 48, 30, 36), { fill: on > 0 ? '#ffe2a8' : '#3c4046', lw: 4 });
  line(ctx, [[-8, 30], [0, 52], [8, 30]], { lw: 2.5, ink: on > 0 ? '#c98a3a' : '#1a1c1f' });
  ctx.restore();
}
// A small doll sitting with its back to us, facing the wall (an everyday object made wrong).
export function dollFacingWall(ctx, { x, y, s = 1 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  shape(ctx, rrect(-40, -10, 80, 90, 30), { fill: '#6b4f5a', shadePath: rrect(10, -10, 40, 90, 0), shadeFill: '#4f3943', lw: 5 });
  shape(ctx, ellipse(0, -46, 42, 44), { fill: '#2a1f1a', lw: 5 });
  for (const sx of [-1, 1]) shape(ctx, rrect(sx * 30 - 8, -80, 16, 70, 8), { fill: '#2a1f1a', lw: 4 });
  shape(ctx, rrect(-36, 72, 30, 18, 8), { fill: '#bdb8ac', lw: 4 }); shape(ctx, rrect(6, 72, 30, 18, 8), { fill: '#bdb8ac', lw: 4 });
  ctx.restore();
}

// Darkness mask: everything is night except pools cut by motivated lights. lights: [{x,y,r,soft}]
import { createCanvas as _cc } from '@napi-rs/canvas';
const _mask = new Map();
export function darkness(ctx, w, h, { k = 0.78, lights = [], tint = 'rgba(2,4,10,1)' } = {}) {
  const key = `${w}x${h}`;
  if (!_mask.has(key)) _mask.set(key, _cc(w, h));
  const m = _mask.get(key), mc = m.getContext('2d');
  mc.setTransform(1, 0, 0, 1, 0, 0);
  mc.globalCompositeOperation = 'copy'; mc.globalAlpha = 1;
  mc.fillStyle = tint; mc.fillRect(0, 0, w, h);
  mc.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    const g = mc.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
    g.addColorStop(0, `rgba(0,0,0,${L.a ?? 1})`); g.addColorStop(L.soft ?? 0.5, `rgba(0,0,0,${(L.a ?? 1) * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    mc.fillStyle = g; mc.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = k; ctx.drawImage(m, 0, 0); ctx.restore();
}
export function grain(ctx, w, h, t, amp = 1) {
  const r = mulberry32(Math.floor(t * 12) * 7919 + 3);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 900; i++) { const a = (0.03 + r() * 0.06) * amp; ctx.fillStyle = r() > 0.5 ? `rgba(200,210,220,${a})` : `rgba(0,0,0,${a * 1.6})`; ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  ctx.restore();
}

// Moonlit line pass (horror): snapshot the lit drawing before the darkness mask, then add its edges back as faint
// cold lines. Darkness keeps the mood; the lines keep the detail readable (thin bright lines on black).
const _snap = new Map();
export function snapshot(ctx, w, h) {
  const k = `${w}x${h}`;
  if (!_snap.has(k)) _snap.set(k, _cc(w, h));
  const c = _snap.get(k), x = c.getContext('2d');
  x.globalCompositeOperation = 'copy'; x.drawImage(ctx.canvas, 0, 0);
  return c;
}
const _half = new Map();
export function lineGlow(ctx, snap, w, h, { color = [150, 172, 205], strength = 0.55, threshold = 22, scale = 0.5 } = {}) {
  const hw = Math.max(2, Math.round(w * scale)), hh = Math.max(2, Math.round(h * scale));
  const k = `${hw}x${hh}`;
  if (!_half.has(k)) _half.set(k, [_cc(hw, hh), _cc(hw, hh)]);
  const [small, out] = _half.get(k);
  const sx = small.getContext('2d');
  sx.globalCompositeOperation = 'copy'; sx.drawImage(snap, 0, 0, hw, hh);
  const src = sx.getImageData(0, 0, hw, hh).data;
  const ox = out.getContext('2d');
  const img = ox.createImageData(hw, hh);
  const d = img.data;
  const lum = new Float32Array(hw * hh);
  for (let i = 0; i < hw * hh; i++) lum[i] = (src[i * 4] + src[i * 4 + 1] + src[i * 4 + 2]) / 3;
  for (let y = 1; y < hh - 1; y++) {
    for (let x = 1; x < hw - 1; x++) {
      const i = y * hw + x;
      const gx = lum[i + 1] - lum[i - 1], gy = lum[i + hw] - lum[i - hw];
      const g = Math.abs(gx) + Math.abs(gy);
      if (g < threshold) continue;
      const a = Math.min(1, (g - threshold) / 90) * strength;
      d[i * 4] = color[0]; d[i * 4 + 1] = color[1]; d[i * 4 + 2] = color[2]; d[i * 4 + 3] = Math.round(a * 255);
    }
  }
  ox.putImageData(img, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = true; ctx.drawImage(out, 0, 0, w, h); ctx.restore();
}
