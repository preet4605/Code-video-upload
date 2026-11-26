// Shared horror visual kit for the Doomsday Horror series. Original code-drawn art; deterministic f(t).
// All coordinates in a 1080x1920 design space (caller scales).
import { mulberry32 } from '../../../lib/widgets.mjs';
export { mulberry32 };

export const TAU = Math.PI * 2;
export const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const seg = (x, a, b) => cl((x - a) / (b - a));
export const eo = (x) => 1 - Math.pow(1 - cl(x), 3);
export const eio = (x) => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const eback = (x) => { x = cl(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const lerp = (a, b, k) => a + (b - a) * k;

export const RED = '#e01b24';
export const FONT = '"Noto Sans", "DejaVu Sans", sans-serif';

// slow, never-strobing light flicker in 0.78..1
export function flick(t, ph = 0) {
  const v = 0.9 + 0.06 * Math.sin(t * 7.1 + ph) * Math.cos(t * 2.3 + ph * 2) + 0.04 * Math.sin(t * 13.7 + ph);
  return cl(v, 0.78, 1);
}

export function fill(ctx, col) { ctx.fillStyle = col; ctx.fillRect(-200, -200, 1480, 2320); }
export function vgrad(ctx, y0, y1, stops) { const g = ctx.createLinearGradient(0, y0, 0, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; }
export function bg(ctx, stops) { ctx.fillStyle = vgrad(ctx, 0, 1920, stops); ctx.fillRect(-200, -200, 1480, 2320); }

export function glow(ctx, x, y, r, rgb, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.35})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function circ(ctx, x, y, r, col) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); ctx.fillStyle = col; ctx.fill(); }
export function ell(ctx, x, y, rx, ry, col, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); ctx.fillStyle = col; ctx.fill(); }
export function rrect(ctx, x, y, w, h, r, col) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = col; ctx.fill(); }

const GRAIN = (() => { const r = mulberry32(4242); return Array.from({ length: 900 }, () => ({ x: r() * 1080, y: r() * 1920, s: 1 + r() * 2.5 })); })();
export function grain(ctx, t, a = 0.07) {
  const r = mulberry32(Math.floor(t * 15) + 7);
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 420; i++) { const g = GRAIN[Math.floor(r() * GRAIN.length)]; ctx.fillRect((g.x + r() * 40) % 1080, g.y, g.s, g.s); }
  ctx.restore();
}

export function vignette(ctx, strength = 0.8, cx = 540, cy = 860) {
  const g = ctx.createRadialGradient(cx, cy, 260, cx, cy, 1200);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, `rgba(0,0,0,${strength * 0.45})`); g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g; ctx.fillRect(-200, -200, 1480, 2320);
}

const DUST = (() => { const r = mulberry32(77); return Array.from({ length: 60 }, () => ({ x: r() * 1080, y: r() * 1920, r: 1 + r() * 2.5, sp: 8 + r() * 22, ph: r() * TAU })); })();
export function dust(ctx, t, a = 0.35, rgb = '255,230,190') {
  ctx.save();
  for (const d of DUST) {
    const y = ((d.y - t * d.sp) % 1920 + 1920) % 1920; const x = d.x + Math.sin(t * 0.6 + d.ph) * 18;
    ctx.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.9 + d.ph))); circ(ctx, x, y, d.r, `rgb(${rgb})`);
  }
  ctx.restore();
}

// camera: slow push toward focus + tiny handheld drift; kick = 0..1 shake impulse
export function camera(ctx, lt, dur, { fx = 540, fy = 900, z0 = 1.0, z1 = 1.04, kick = 0, dutch = 0 } = {}) {
  const z = lerp(z0, z1, eio(lt / Math.max(0.5, dur)));
  const sx = Math.sin(lt * 0.83) * 5 + Math.sin(lt * 47) * 14 * kick;
  const sy = Math.cos(lt * 0.61) * 4 + Math.cos(lt * 39) * 10 * kick;
  ctx.translate(fx + sx, fy + sy); ctx.rotate(dutch * Math.sin(lt * 0.5)); ctx.scale(z, z); ctx.translate(-fx, -fy);
}
export const kickAt = (lt, at, len = 0.45) => (lt >= at && lt < at + len ? 1 - (lt - at) / len : 0);

// ---------- text ----------
export function slamText(ctx, text, x, y, size, p, { col = RED, glowCol = '224,27,36', shake = 0, align = 'center', weight = 900, stroke = true } = {}) {
  if (p <= 0) return;
  const k = lerp(1.7, 1, eo(p));
  ctx.save(); ctx.translate(x + Math.sin(p * 90) * shake * (1 - p), y); ctx.scale(k, k);
  ctx.globalAlpha = cl(p * 2.2);
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.shadowColor = `rgba(${glowCol},0.9)`; ctx.shadowBlur = 34;
  if (stroke) { ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(text, 0, 0); }
  ctx.fillStyle = col; ctx.fillText(text, 0, 0);
  ctx.restore();
}

export function text(ctx, s, x, y, size, col = '#fff', { align = 'center', weight = 800, a = 1, shadow = true } = {}) {
  ctx.save(); ctx.globalAlpha *= a; ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 16; }
  ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.restore();
}

// big white horror caption, active word in red. Centered in safe zone (x 60..900).
export function horrorCaption(ctx, cap, activeWord, y = 1265) {
  if (!cap) return;
  const lines = cap.text.split('\n');
  const size = 54; const step = 70;
  ctx.save(); ctx.font = `900 ${size}px ${FONT}`; ctx.textBaseline = 'middle';
  let maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  let scale = Math.min(1, 800 / maxW);
  ctx.translate(480, y - ((lines.length - 1) * step * scale) / 2); ctx.scale(scale, scale);
  const clean = (w) => String(w || '').replace(/[.,?!;:'"()]+$/g, '').toLowerCase();
  const aw = clean(activeWord);
  lines.forEach((ln, i) => {
    const words = ln.split(' '); const sp = ctx.measureText(' ').width;
    const W = ctx.measureText(ln).width; let x = -W / 2; const yy = i * step;
    for (const w of words) {
      const ww = ctx.measureText(w).width;
      ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(0,0,0,0.92)'; ctx.strokeText(w, x, yy);
      ctx.fillStyle = aw && clean(w) === aw ? '#ff3b3b' : '#ffffff'; ctx.fillText(w, x, yy);
      x += ww + sp;
    }
  });
  ctx.restore();
}

export function captionAt(timeline, t) {
  const cap = (timeline.captions || []).find((c) => t >= c.start_s && t < c.end_s);
  if (!cap) return [null, ''];
  const w = (timeline.words || []).find((x) => x.line === cap.line && t >= x.start_s && t < x.end_s);
  return [cap, w ? w.word : ''];
}

// ---------- props ----------
export function door(ctx, x, y, w, h, open = 0, { lightRGB = '255,190,110', light = 1, frame = '#0b0b0e', leaf = '#151318' } = {}) {
  // opening (light)
  ctx.save();
  if (open > 0) { ctx.fillStyle = `rgba(${lightRGB},${0.85 * light})`; ctx.fillRect(x, y, w, h); }
  else { ctx.fillStyle = leaf; ctx.fillRect(x, y, w, h); }
  // leaf swinging (perspective trapezoid)
  if (open > 0) {
    const lw = w * (1 - open * 0.82);
    ctx.fillStyle = leaf; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + lw, y + h * 0.04 * open); ctx.lineTo(x + lw, y + h - h * 0.04 * open); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = frame; ctx.lineWidth = 18; ctx.strokeRect(x - 9, y - 9, w + 18, h + 18);
  ctx.restore();
}

export function lightUnderDoor(ctx, x, y, w, a = 1, rgb = '255,190,110') {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = `rgba(${rgb},0.95)`; ctx.fillRect(x, y - 6, w, 8);
  const g = ctx.createLinearGradient(0, y, 0, y + 140); g.addColorStop(0, `rgba(${rgb},0.45)`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w + 120, y + 140); ctx.lineTo(x - 120, y + 140); ctx.closePath(); ctx.fill(); ctx.restore();
}

export function bed(ctx, x, y, k = 1, { covered = false, breath = 0, col = '#1d1a24', sheet = '#2b2836' } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  rrect(ctx, -330, -40, 660, 120, 14, col); // base
  rrect(ctx, -350, -220, 40, 300, 10, col); // headboard
  rrect(ctx, 310, -110, 30, 190, 8, col);
  rrect(ctx, -300, -90, 600, 70, 30, sheet); // mattress
  ell(ctx, -230, -110, 70, 34, '#3a3646'); // pillow
  if (covered) {
    const b = 1 + 0.04 * Math.sin(breath * 1.6);
    ctx.save(); ctx.translate(20, -110); ctx.scale(1, b);
    ctx.beginPath(); ctx.moveTo(-270, 40); ctx.bezierCurveTo(-260, -70, -150, -60, -90, -30); ctx.bezierCurveTo(0, -60, 160, -40, 270, 30); ctx.lineTo(270, 50); ctx.lineTo(-270, 50); ctx.closePath();
    ctx.fillStyle = '#4a4458'; ctx.fill();
    ctx.restore();
    // hair on pillow
    ctx.fillStyle = '#0a0a0c'; ctx.beginPath(); ctx.ellipse(-245, -130, 52, 30, -0.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function footprint(ctx, x, y, rot, s = 1, a = 1, { wet = true, reversed = false } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot + (reversed ? Math.PI : 0)); ctx.scale(s, s); ctx.globalAlpha *= a;
  const col = wet ? 'rgba(120,170,200,0.55)' : 'rgba(10,10,10,0.8)';
  ell(ctx, 0, 0, 18, 30, col); ell(ctx, 0, 36, 14, 18, col);
  [[-14, -38, 7], [-4, -44, 6], [6, -44, 5.5], [14, -40, 5], [20, -33, 4.5]].forEach(([dx, dy, r]) => circ(ctx, dx, dy, r, col));
  if (wet) { ctx.globalAlpha *= 0.5; ell(ctx, -3, -4, 6, 14, 'rgba(220,240,255,0.5)'); }
  ctx.restore();
}

// tall featureless silhouette; eyes 0..1
export function figure(ctx, x, y, k = 1, { eyes = 0, col = '#050507', hair = true, eyeRGB = '255,60,40', lean = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(lean);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(-70, 0); ctx.bezierCurveTo(-80, -260, -90, -430, -55, -470); ctx.quadraticCurveTo(0, -500, 55, -470); ctx.bezierCurveTo(90, -430, 80, -260, 70, 0); ctx.closePath(); ctx.fill();
  ell(ctx, 0, -540, 52, 66, col);
  if (hair) { ctx.beginPath(); ctx.moveTo(-58, -560); ctx.bezierCurveTo(-110, -420, -100, -300, -80, -220); ctx.lineTo(80, -220); ctx.bezierCurveTo(100, -300, 110, -420, 58, -560); ctx.closePath(); ctx.fill(); }
  if (eyes > 0) {
    glow(ctx, -20, -545, 40, eyeRGB, 0.5 * eyes); glow(ctx, 20, -545, 40, eyeRGB, 0.5 * eyes);
    ell(ctx, -20, -545, 9, 4.5, `rgba(${eyeRGB},${eyes})`); ell(ctx, 20, -545, 9, 4.5, `rgba(${eyeRGB},${eyes})`);
  }
  ctx.restore();
}

export function eyesPair(ctx, x, y, s = 1, a = 1, rgb = '255,60,40', blink = 1) {
  if (a <= 0) return;
  ctx.save(); glow(ctx, x - 26 * s, y, 50 * s, rgb, 0.45 * a); glow(ctx, x + 26 * s, y, 50 * s, rgb, 0.45 * a);
  ell(ctx, x - 26 * s, y, 11 * s, 5 * s * blink, `rgba(${rgb},${a})`); ell(ctx, x + 26 * s, y, 11 * s, 5 * s * blink, `rgba(${rgb},${a})`);
  ctx.restore();
}

export function shadowHand(ctx, x, y, s = 1, rot = 0, a = 0.85) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.globalAlpha *= a; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(0, 0, 40, 55, 0, 0, TAU); ctx.fill();
  [-30, -12, 6, 24].forEach((dx, i) => { ctx.beginPath(); ctx.moveTo(dx - 7, -30); ctx.quadraticCurveTo(dx + 4, -120 - i * 6, dx + 10, -170 + i * 8); ctx.lineTo(dx + 14, -168 + i * 8); ctx.quadraticCurveTo(dx + 12, -110, dx + 9, -30); ctx.fill(); });
  ctx.beginPath(); ctx.moveTo(35, 0); ctx.quadraticCurveTo(80, -30, 100, -80); ctx.lineTo(106, -76); ctx.quadraticCurveTo(90, -20, 40, 20); ctx.fill();
  ctx.restore();
}

// A / B choice cards
export function choiceCards(ctx, a, b, p, lt) {
  if (p <= 0) return;
  const draw = (label, txt, y, d, col) => {
    const q = eback(cl((p - d) * 2.2)); if (q <= 0) return;
    ctx.save(); ctx.translate(480, y); ctx.scale(q, q);
    rrect(ctx, -390, -70, 780, 140, 28, 'rgba(12,10,14,0.92)');
    ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(-390, -70, 780, 140, 28); ctx.stroke();
    circ(ctx, -310, 0, 46, col); text(ctx, label, -310, 2, 56, '#fff', { weight: 900, shadow: false });
    text(ctx, txt, 50, 2, 44, '#fff', { weight: 800 });
    ctx.restore();
  };
  draw('A', a, 560, 0, RED); draw('B', b, 740, 0.15, '#7b5cff');
  const pulse = 0.6 + 0.4 * Math.sin(lt * 5);
  text(ctx, 'Comment karo 👇'.replace(' 👇', ''), 480, 900, 46, `rgba(255,255,255,${0.6 + 0.4 * pulse})`, { weight: 800 });
}

// series badge (top-left, inside safe zone)
export function seriesBadge(ctx, label, a = 1) {
  ctx.save(); ctx.globalAlpha *= a; ctx.font = `800 34px ${FONT}`; const w = ctx.measureText(label).width + 44;
  rrect(ctx, 80, 300, w, 58, 12, 'rgba(224,27,36,0.9)'); text(ctx, label, 80 + w / 2, 330, 34, '#fff', { weight: 800, shadow: false }); ctx.restore();
}

export function rain(ctx, t, a = 0.25, n = 120) {
  const r = mulberry32(5); ctx.save(); ctx.strokeStyle = `rgba(180,200,230,${a})`; ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) { const x = r() * 1180 - 50; const sp = 1400 + r() * 800; const y = ((r() * 2000 + t * sp) % 2100) - 100; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 10, y + 40); ctx.stroke(); }
  ctx.restore();
}

// standard post-pass: grain + vignette + caption
export function post(ctx, t, timeline, { vig = 0.85, grainA = 0.06, capY = 1265 } = {}) {
  grain(ctx, t, grainA); vignette(ctx, vig);
  const [cap, w] = captionAt(timeline, t);
  if (cap) { const g = ctx.createLinearGradient(0, capY - 170, 0, capY + 170); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, capY - 170, 1080, 340); }
  horrorCaption(ctx, cap, w, capY);
}

// run one reel: R = { sceneId: (ctx, lt, dur, t, sc) }
export function makeClock(R, { badge = null, postOpts = {} } = {}) {
  let T = 0;
  return {
    setTime(sec) { T = sec; },
    draw(ctx, width, height, timeline) {
      const t = T; const s = width / 1080;
      const scenes = timeline.scenes || [];
      const sc = scenes.find((x) => t >= x.start_s && t < x.end_s) || scenes[scenes.length - 1];
      const lt = t - sc.start_s; const dur = sc.end_s - sc.start_s;
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1080, 1920);
      ctx.save(); (R[sc.id] || Object.values(R)[0])(ctx, lt, dur, t, sc); ctx.restore();
      // short dip-from-black on each cut (never a full flash)
      const inA = 1 - cl(lt / 0.18); if (inA > 0 && sc.start_s > 0) { ctx.fillStyle = `rgba(0,0,0,${inA * 0.7})`; ctx.fillRect(0, 0, 1080, 1920); }
      if (badge) seriesBadge(ctx, badge, 0.95);
      post(ctx, t, timeline, postOpts);
      ctx.restore();
    }
  };
}
