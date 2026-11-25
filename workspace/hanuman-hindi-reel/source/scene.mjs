// Original code-drawn recreation: "Bal Hanuman aur Suraj" (Hindi VO, Hinglish captions).
// All art is procedural canvas vector drawing. Deterministic: everything is f(t).
import { drawCaptionBar, mulberry32 } from '../skill/code-video-studio/lib/widgets.mjs';

let T = 0;
const TAU = Math.PI * 2;
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (x, a, b) => cl((x - a) / (b - a));
const eo = (x) => 1 - Math.pow(1 - cl(x), 3);
const eio = (x) => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const eback = (x) => { x = cl(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const lerp = (a, b, k) => a + (b - a) * k;

// ---------- palette ----------
const C = {
  fur: '#c66f2c', furD: '#9c5220', face: '#f6cf9f', dhoti: '#d8432a', band: '#f2b632', hair: '#4e2610',
  ink: '#2a1a12', blush: '#f08a7a', mouth: '#7a1d1d', tongue: '#ef6f6f',
  sunA: '#ffe37a', sunB: '#ffb21e', rayA: '#ffbf2e', rayB: '#ff8f1f',
  vayuSkin: '#8fc3ec', vayuSkinD: '#6aa3d3', white: '#fffaf0',
  rahu: '#3d2b70', rahuD: '#251a4a', eyeY: '#ffd84a',
  indraSkin: '#e2a66a', indraD: '#2f4fa8', gold: '#f4c040', goldD: '#c8901a', green: '#2f9a6a',
};

// ---------- deterministic stars ----------
const STARS = (() => { const r = mulberry32(7); return Array.from({ length: 140 }, () => ({ x: r() * 1080, y: r() * 1920, r: 1 + r() * 3.2, ph: r() * TAU })); })();
const GRAIN = (() => { const r = mulberry32(99); return Array.from({ length: 420 }, () => ({ x: r() * 1080, y: r() * 1920, w: 2 + r() * 5, a: r() })); })();

// ---------- primitives ----------
function circ(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
function ell(ctx, x, y, rx, ry, fill, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
function shadowOn(ctx, b = 18, y = 10, a = 0.22) { ctx.shadowColor = `rgba(40,20,10,${a})`; ctx.shadowBlur = b; ctx.shadowOffsetY = y; }
function shadowOff(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
function vgrad(ctx, y0, y1, stops) { const g = ctx.createLinearGradient(0, y0, 0, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; }
function bg(ctx, stops) { ctx.fillStyle = vgrad(ctx, 0, 1920, stops); ctx.fillRect(0, 0, 1080, 1920); }
function glow(ctx, x, y, r, col, a = 1) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,200,80,0)'); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore(); }

function cloud(ctx, x, y, k, col = '#ffffff', a = 1) {
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(k, k);
  shadowOn(ctx, 20, 8, 0.12);
  ctx.fillStyle = col; ctx.beginPath();
  [[-90, 10, 55], [-35, -25, 70], [35, -15, 62], [90, 12, 50], [0, 20, 60]].forEach(([cx, cy, r]) => { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, TAU); });
  ctx.fill(); shadowOff(ctx); ctx.restore();
}

function hills(ctx, t, layers) {
  layers.forEach(([base, amp, freq, col, spd], i) => {
    ctx.beginPath(); ctx.moveTo(0, 1920);
    for (let x = 0; x <= 1080; x += 20) ctx.lineTo(x, base + Math.sin(x * freq + i * 1.7 + t * spd) * amp + Math.sin(x * freq * 2.3 + i) * amp * 0.3);
    ctx.lineTo(1080, 1920); ctx.closePath(); shadowOn(ctx, 24, -6, 0.12); ctx.fillStyle = col; ctx.fill(); shadowOff(ctx);
  });
}

function stars(ctx, t, a = 1) {
  ctx.save();
  for (const s of STARS) { ctx.globalAlpha = a * (0.45 + 0.55 * Math.abs(Math.sin(t * 1.3 + s.ph))); circ(ctx, s.x, s.y, s.r, '#fff6d8'); }
  ctx.restore();
}

function grain(ctx, a = 0.05) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#5a3a1a';
  for (const g of GRAIN) ctx.fillRect(g.x, g.y, g.w, g.w * 0.6);
  ctx.restore();
}

function speedLines(ctx, t, dir = 1, col = 'rgba(255,255,255,0.7)', n = 14) {
  const r = mulberry32(31); ctx.save(); ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) { const x = r() * 1080, L = 120 + r() * 220, sp = 1400 + r() * 900; const y = (((r() * 2400 + t * sp * dir) % 2400) + 2400) % 2400 - 240; ctx.lineWidth = 3 + r() * 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - L * dir); ctx.stroke(); }
  ctx.restore();
}

function windStreams(ctx, x, y, t, k = 1, a = 1, dir = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k * dir, k); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(225,245,255,0.9)'; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const ph = (t * 1.6 + i * 0.25) % 1; const ox = ph * 260; ctx.lineWidth = 7 - i;
    ctx.globalAlpha = a * Math.sin(ph * Math.PI);
    ctx.beginPath(); ctx.moveTo(ox, -40 + i * 28); ctx.bezierCurveTo(ox + 60, -70 + i * 28, ox + 110, -10 + i * 28, ox + 170, -40 + i * 28);
    ctx.arc(ox + 170, -58 + i * 28, 18, Math.PI / 2, -Math.PI, true); ctx.stroke();
  }
  ctx.restore();
}

function sparkle(ctx, x, y, r, rot = 0, col = '#fff3a8') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.28 : r; const a = (i / 8) * TAU; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function stamp(ctx, text, x, y, p, col = '#ff4d2e', size = 150, rot = -0.12) {
  if (p <= 0) return;
  const k = eback(p); ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k);
  ctx.fillStyle = '#fff1c2'; ctx.beginPath();
  for (let i = 0; i < 24; i++) { const rr = i % 2 ? size * 0.95 : size * 1.35; const a = (i / 24) * TAU; ctx.lineTo(Math.cos(a) * rr * 1.25, Math.sin(a) * rr * 0.8); }
  ctx.closePath(); shadowOn(ctx, 20, 10, 0.25); ctx.fill(); shadowOff(ctx);
  ctx.font = `900 ${size}px "Noto Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 16; ctx.strokeStyle = C.ink; ctx.strokeText(text, 0, 6); ctx.fillStyle = col; ctx.fillText(text, 0, 6);
  ctx.restore();
}

function bubble(ctx, text, x, y, p, size = 64) {
  if (p <= 0) return;
  ctx.save(); ctx.translate(x, y); const k = eback(p); ctx.scale(k, k);
  ctx.font = `800 ${size}px "Noto Sans", sans-serif`; const w = ctx.measureText(text).width + 70, h = size + 50;
  shadowOn(ctx, 16, 8, 0.2); ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-20, h / 2 - 4); ctx.lineTo(-40, h / 2 + 34); ctx.lineTo(10, h / 2 - 4); ctx.fill(); shadowOff(ctx);
  ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 4); ctx.restore();
}

// ---------- characters ----------
function eyes(ctx, kind, dx, y, r, look = [0, 0], t = 0) {
  for (const sx of [-1, 1]) {
    const x = sx * dx;
    ctx.save();
    if (kind === 'closed' || kind === 'happy') {
      ctx.strokeStyle = C.ink; ctx.lineWidth = r * 0.32; ctx.lineCap = 'round'; ctx.beginPath();
      if (kind === 'closed') ctx.arc(x, y - r * 0.2, r * 0.8, 0.15 * Math.PI, 0.85 * Math.PI); else ctx.arc(x, y + r * 0.4, r * 0.8, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    } else if (kind === 'squeeze') {
      ctx.strokeStyle = C.ink; ctx.lineWidth = r * 0.3; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(x - sx * r * 0.8, y - r * 0.6); ctx.lineTo(x + sx * r * 0.6, y); ctx.lineTo(x - sx * r * 0.8, y + r * 0.6); ctx.stroke();
    } else {
      const big = kind === 'wide' || kind === 'sparkle' ? 1.3 : 1;
      ell(ctx, x, y, r * big, r * 1.2 * big, '#ffffff');
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(42,26,18,0.5)'; ctx.stroke();
      const pr = kind === 'shrink' ? r * 0.35 : r * 0.62 * big;
      circ(ctx, x + look[0] * r * 0.35, y + look[1] * r * 0.35, pr, C.ink);
      circ(ctx, x + look[0] * r * 0.35 - pr * 0.35, y + look[1] * r * 0.35 - pr * 0.4, pr * 0.32, '#ffffff');
      if (kind === 'sparkle') sparkle(ctx, x + look[0] * r * 0.35 + pr * 0.25, y + pr * 0.2, pr * 0.7, t * 3, '#fff6b0');
    }
    ctx.restore();
  }
}

function mouthShape(ctx, kind, x, y, w, open = 0) {
  ctx.save();
  if (kind === 'smile' || kind === 'grin') {
    ctx.strokeStyle = C.ink; ctx.lineWidth = w * 0.16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y - w * 0.3, w * 0.6, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    if (kind === 'grin') { ctx.beginPath(); ctx.arc(x, y - w * 0.3, w * 0.6, 0.2 * Math.PI, 0.8 * Math.PI); ctx.closePath(); ctx.fillStyle = C.mouth; ctx.fill(); }
  } else if (kind === 'frown') {
    ctx.strokeStyle = C.ink; ctx.lineWidth = w * 0.16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y + w * 0.5, w * 0.5, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke();
  } else if (kind === 'flat') {
    ctx.strokeStyle = C.ink; ctx.lineWidth = w * 0.14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - w * 0.35, y); ctx.lineTo(x + w * 0.35, y); ctx.stroke();
  } else {
    const h = kind === 'wail' ? w * (0.7 + 0.3 * open) : w * (0.2 + 0.6 * open);
    const ww = kind === 'o' ? w * 0.45 : w * 0.62;
    ell(ctx, x, y + h * 0.2, ww, h, C.mouth);
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y + h * 0.2, ww, h, 0, 0, TAU); ctx.clip(); ell(ctx, x, y + h * 0.95, ww * 0.7, h * 0.5, C.tongue); ctx.restore();
  }
  ctx.restore();
}

function talk(t, a, b, speed = 15) { return t >= a && t <= b ? 0.25 + 0.75 * Math.abs(Math.sin(t * speed)) : 0; }

// Baby: origin at head centre, head radius 100*k
function baby(ctx, x, y, k, o = {}) {
  const t = T; const { eye = 'open', mouth = 'smile', open = 0, cheeks = 0, tilt = 0, arms = 0, chin = false, tears = 0, look = [0, 0], tail = true, body = true, glowA = 0, legs = 0 } = o;
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(k, k);
  if (glowA > 0) glow(ctx, 0, 40, 420, 'rgba(255,190,70,0.85)', glowA);
  if (body) {
    if (tail) { ctx.strokeStyle = C.furD; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(45, 200); ctx.bezierCurveTo(150, 230 + Math.sin(t * 3) * 10, 170, 110, 125, 95 + Math.sin(t * 3) * 8); ctx.arc(140, 95, 15, Math.PI, 0.2 * Math.PI, false); ctx.stroke(); }
    // legs
    const lk = Math.sin(t * 9) * 14 * legs;
    ell(ctx, -38, 250 + lk, 30, 22, C.fur); ell(ctx, 38, 250 - lk, 30, 22, C.fur);
    ell(ctx, -46, 262 + lk, 22, 14, C.face); ell(ctx, 46, 262 - lk, 22, 14, C.face);
    shadowOn(ctx, 14, 8, 0.18); ell(ctx, 0, 165, 78, 88, C.fur); shadowOff(ctx);
    ell(ctx, 0, 160, 50, 55, C.face);
    // dhoti
    ctx.beginPath(); ctx.moveTo(-76, 190); ctx.quadraticCurveTo(0, 175, 76, 190); ctx.quadraticCurveTo(80, 250, 40, 252); ctx.lineTo(0, 232); ctx.lineTo(-40, 252); ctx.quadraticCurveTo(-80, 250, -76, 190); ctx.fillStyle = C.dhoti; ctx.fill();
    ctx.fillStyle = C.band; ctx.fillRect(-74, 186, 148, 14);
    // arms
    for (const sx of [-1, 1]) {
      const ang = lerp(0.5, -1.9, arms) * sx; const ax = sx * 66, ay = 120;
      const hx = ax + Math.sin(ang) * 80 * sx * sx, hy = ay + Math.cos(ang) * 80;
      ctx.strokeStyle = C.fur; ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx, hy); ctx.stroke();
      circ(ctx, hx, hy, 22, C.face);
    }
    // necklace
    ctx.strokeStyle = C.band; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 88, 48, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke(); circ(ctx, 0, 136, 10, '#e2463a');
  }
  // ears
  for (const sx of [-1, 1]) { circ(ctx, sx * 104, -6, 36, C.fur); circ(ctx, sx * 104, -6, 21, C.face); }
  shadowOn(ctx, 16, 8, 0.2); circ(ctx, 0, 0, 102, C.fur); shadowOff(ctx);
  // face mask
  ctx.fillStyle = C.face; ctx.beginPath(); ctx.arc(-36, -16, 44, 0, TAU); ctx.arc(36, -16, 44, 0, TAU); ctx.fill(); ell(ctx, 0, 36, 74 + cheeks * 22, 56 + cheeks * 10, C.face);
  // hair tuft
  ctx.fillStyle = C.hair; ctx.beginPath(); ctx.moveTo(-26, -96); ctx.quadraticCurveTo(-10, -150, 22, -142); ctx.quadraticCurveTo(-2, -128, 8, -100); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(24, -128, 13, 0, TAU); ctx.fill();
  // tilak
  ell(ctx, 0, -64, 6, 13, '#e2463a');
  eyes(ctx, eye, 36, -14, 21, look, t);
  // cheeks
  if (cheeks > 0) {
    for (const sx of [-1, 1]) {
      const r = 34 + cheeks * 26; const gx = sx * (56 + cheeks * 8), gy = 42;
      const g = ctx.createRadialGradient(gx, gy, 2, gx, gy, r); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#ffc24a'); g.addColorStop(1, '#f08a3a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, r, 0, TAU); ctx.fill();
    }
  } else { ell(ctx, -60, 34, 18, 11, 'rgba(240,120,110,0.55)'); ell(ctx, 60, 34, 18, 11, 'rgba(240,120,110,0.55)'); }
  mouthShape(ctx, cheeks > 0.4 && mouth === 'smile' ? 'flat' : mouth, 0, 54, 34, open);
  if (tears > 0) { ctx.save(); ctx.globalAlpha = tears; for (const sx of [-1, 1]) { const d = (t * 1.4) % 1; ell(ctx, sx * 52, 10 + d * 60, 9, 14, '#7cc7ff'); } ctx.restore(); }
  if (chin) { ctx.strokeStyle = '#8a3c18'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 104, 16, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
  ctx.restore();
}

function sun(ctx, x, y, r, o = {}) {
  const t = T; const { face = 'smile', open = 0, mango = 0, sweat = 0, look = [0, 0], rot = t * 0.25, raysA = 1 } = o;
  ctx.save(); ctx.translate(x, y);
  glow(ctx, 0, 0, r * 2.4, 'rgba(255,214,90,0.7)', 0.9);
  if (mango < 1) {
    ctx.save(); ctx.globalAlpha = (1 - mango) * raysA; ctx.rotate(rot);
    for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; const L = r * (i % 2 ? 1.42 : 1.62) + Math.sin(t * 4 + i) * r * 0.04; ctx.fillStyle = i % 2 ? C.rayB : C.rayA; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.13) * r * 0.9, Math.sin(a - 0.13) * r * 0.9); ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L); ctx.lineTo(Math.cos(a + 0.13) * r * 0.9, Math.sin(a + 0.13) * r * 0.9); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 1 - mango;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); g.addColorStop(0, C.sunA); g.addColorStop(1, C.sunB);
    shadowOn(ctx, 24, 10, 0.18); circ(ctx, 0, 0, r, g); shadowOff(ctx);
    // face
    ctx.scale(r / 160, r / 160);
    ctx.strokeStyle = '#a8560c'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    const browUp = face === 'shock' || face === 'scared' ? -22 : 0;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 30, -62 + browUp); ctx.quadraticCurveTo(sx * 58, -78 + browUp - (face === 'scared' ? sx * -10 : 0), sx * 86, -60 + browUp); ctx.stroke(); }
    eyes(ctx, face === 'shock' || face === 'scared' ? 'wide' : face === 'calm' ? 'happy' : face === 'dizzy' ? 'squeeze' : 'open', 56, -22, 22, look, t);
    ell(ctx, -92, 34, 22, 13, 'rgba(240,110,70,0.5)'); ell(ctx, 92, 34, 22, 13, 'rgba(240,110,70,0.5)');
    ell(ctx, 0, -104, 7, 16, '#d8432a');
    mouthShape(ctx, face === 'shock' ? 'wail' : face === 'scared' ? (open > 0 ? 'open' : 'frown') : open > 0 ? 'open' : face === 'dizzy' ? 'flat' : 'smile', 0, 52, 40, open);
    if (sweat > 0) { ctx.globalAlpha = (1 - mango) * sweat; const d = (t * 0.9) % 1; ell(ctx, 120, -60 + d * 60, 13, 20, '#8ad3ff'); ell(ctx, -128, -30 + ((d + 0.5) % 1) * 50, 10, 16, '#8ad3ff'); }
    ctx.restore();
  }
  if (mango > 0) {
    ctx.save(); ctx.globalAlpha = mango; ctx.rotate(-0.25);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.2, r * 0.1, 0, 0, r * 1.2); g.addColorStop(0, '#ffe066'); g.addColorStop(0.6, '#ffa21a'); g.addColorStop(1, '#f06a1c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -r * 1.05); ctx.bezierCurveTo(r * 1.05, -r * 1.0, r * 1.05, r * 0.9, 0, r * 1.0); ctx.bezierCurveTo(-r * 0.95, r * 1.05, -r * 1.1, -r * 0.2, -r * 0.55, -r * 0.75); ctx.quadraticCurveTo(-r * 0.3, -r * 1.05, 0, -r * 1.05); ctx.fill();
    ell(ctx, -r * 0.35, -r * 0.35, r * 0.18, r * 0.3, 'rgba(255,255,255,0.45)', -0.5);
    ell(ctx, r * 0.1, -r * 1.12, r * 0.32, r * 0.12, '#3f9a3a', -0.5);
    ctx.strokeStyle = '#6b3a12'; ctx.lineWidth = r * 0.06; ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 1.0); ctx.lineTo(-r * 0.12, -r * 1.2); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function vayu(ctx, x, y, k, o = {}) {
  const t = T; const { mood = 'kind', blow = 0, open = 0, arms = 0, holding = false, eye = null } = o;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  // cloud seat
  cloud(ctx, 0, 250, 1.3, '#f4fbff');
  // scarf
  ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-80, 90);
  for (let i = 1; i <= 6; i++) ctx.lineTo(-80 - i * 45, 90 + Math.sin(t * 5 + i) * 18 - i * 6); ctx.stroke();
  // torso
  shadowOn(ctx, 16, 8, 0.18); ctx.fillStyle = C.vayuSkin; ctx.beginPath(); ctx.moveTo(-95, 80); ctx.quadraticCurveTo(0, 50, 95, 80); ctx.lineTo(120, 250); ctx.quadraticCurveTo(0, 280, -120, 250); ctx.closePath(); ctx.fill(); shadowOff(ctx);
  ctx.fillStyle = '#e8f4ff'; ctx.beginPath(); ctx.moveTo(-120, 220); ctx.quadraticCurveTo(0, 200, 120, 220); ctx.lineTo(125, 260); ctx.quadraticCurveTo(0, 285, -125, 260); ctx.fill();
  // arms
  const armA = holding ? 0 : arms;
  for (const sx of [-1, 1]) { ctx.strokeStyle = C.vayuSkinD; ctx.lineWidth = 40; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx * 90, 100); ctx.lineTo(sx * (130 + 60 * armA), holding ? 200 : 180 - 120 * armA); ctx.stroke(); circ(ctx, sx * (130 + 60 * armA), holding ? 200 : 180 - 120 * armA, 24, C.vayuSkin); }
  // head
  shadowOn(ctx, 16, 8, 0.18); circ(ctx, 0, -30, 88, C.vayuSkin); shadowOff(ctx);
  // swirl hair (wind)
  ctx.strokeStyle = C.white; ctx.lineWidth = 16; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const hx = -60 + i * 60, hy = -112 - (i === 1 ? 14 : 0); ctx.beginPath(); ctx.arc(hx, hy, 26, Math.PI * 0.9 + Math.sin(t * 3 + i) * 0.2, Math.PI * 2.5); ctx.stroke(); }
  // beard: wind curls
  ctx.fillStyle = C.white; ctx.beginPath(); ctx.moveTo(-70, 0); ctx.quadraticCurveTo(-80, 90, -20, 120); ctx.quadraticCurveTo(0, 150 + Math.sin(t * 4) * 6, 25, 118); ctx.quadraticCurveTo(80, 90, 70, 0); ctx.quadraticCurveTo(0, 40, -70, 0); ctx.fill();
  ctx.strokeStyle = '#d6ecff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(-25, 70, 14, 0, 1.6 * Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(25, 80, 12, Math.PI, 2.6 * Math.PI); ctx.stroke();
  // brows
  ctx.strokeStyle = C.white; ctx.lineWidth = 14; const angry = mood === 'angry' ? 1 : 0;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 18, -66 + angry * 14); ctx.lineTo(sx * 62, -76 - angry * 6); ctx.stroke(); }
  eyes(ctx, eye || (mood === 'happy' ? 'happy' : mood === 'worried' ? 'open' : mood === 'angry' ? 'shrink' : 'open'), 36, -40, 16, mood === 'angry' ? [0, -0.6] : [0, 0], t);
  // mouth / blow
  if (blow > 0) { ell(ctx, 0, 30, 14, 16, '#3a5a8a'); for (const sx of [-1, 1]) ell(ctx, sx * 40, 22, 22 * blow, 18 * blow, 'rgba(160,210,255,0.8)'); }
  else if (open > 0) mouthShape(ctx, 'open', 0, 26, 24, open);
  else if (mood === 'angry') mouthShape(ctx, 'frown', 0, 30, 26);
  else ell(ctx, 0, 28, 14, 6, '#3a5a8a');
  ctx.restore();
}

function rahu(ctx, x, y, k, o = {}) {
  const t = T; const { eye = 'open', mouth = 'open', open = 0.3, look = [0, 0], sweat = 0 } = o;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  // smoke tail
  for (let i = 0; i < 6; i++) { ctx.globalAlpha = 0.5 - i * 0.07; circ(ctx, Math.sin(t * 3 + i) * 20, 110 + i * 45, 70 - i * 9, '#5b4a9a'); }
  ctx.globalAlpha = 1;
  // spiky hair
  ctx.fillStyle = C.rahuD; ctx.beginPath();
  for (let i = 0; i <= 16; i++) { const a = Math.PI + (i / 16) * Math.PI; const rr = i % 2 ? 125 : 175 + Math.sin(t * 6 + i) * 8; ctx.lineTo(Math.cos(a) * rr * 1.05, Math.sin(a) * rr - 10); }
  ctx.closePath(); ctx.fill();
  shadowOn(ctx, 18, 8, 0.3); ell(ctx, 0, 0, 120, 130, C.rahu); shadowOff(ctx);
  ctx.strokeStyle = '#1a1236'; ctx.lineWidth = 12; ctx.lineCap = 'round';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 20, -54); ctx.lineTo(sx * 80, -70); ctx.stroke(); }
  for (const sx of [-1, 1]) { ell(ctx, sx * 48, -18, 30, 34, C.eyeY); }
  if (eye !== 'squeeze') { for (const sx of [-1, 1]) circ(ctx, sx * 48 + look[0] * 10, -14 + look[1] * 10, eye === 'shrink' ? 7 : 13, '#1a1236'); }
  else eyes(ctx, 'squeeze', 48, -18, 22);
  mouthShape(ctx, mouth, 0, 60, 46, open);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-26, 56); ctx.lineTo(-16, 80); ctx.lineTo(-6, 56); ctx.fill(); ctx.beginPath(); ctx.moveTo(26, 56); ctx.lineTo(16, 80); ctx.lineTo(6, 56); ctx.fill();
  if (sweat > 0) { ctx.globalAlpha = sweat; const d = (t * 1.5) % 1; ell(ctx, 120, -60 + d * 60, 14, 20, '#8ad3ff'); ell(ctx, -125, -40 + ((d + 0.4) % 1) * 50, 11, 16, '#8ad3ff'); }
  ctx.restore();
}

function vajra(ctx, x, y, k, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k);
  ctx.fillStyle = C.gold; ctx.strokeStyle = C.goldD; ctx.lineWidth = 4;
  ctx.fillRect(-10, -60, 20, 120); ctx.strokeRect(-10, -60, 20, 120); circ(ctx, 0, 0, 20, '#ffd76a');
  for (const sy of [-1, 1]) {
    circ(ctx, 0, sy * 62, 16, C.gold);
    for (const sx of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(0, sy * 70); ctx.quadraticCurveTo(sx * 36, sy * 92, sx * 14, sy * 128); ctx.lineWidth = 10; ctx.strokeStyle = C.gold; ctx.stroke(); }
  }
  ctx.restore();
}

function crown(ctx, y, w, h) {
  ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(-w * 0.38, y - h * 0.65); ctx.lineTo(-w * 0.18, y - h * 0.5); ctx.lineTo(0, y - h); ctx.lineTo(w * 0.18, y - h * 0.5); ctx.lineTo(w * 0.38, y - h * 0.65); ctx.lineTo(w / 2, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.goldD; ctx.lineWidth = 5; ctx.stroke(); circ(ctx, 0, y - h * 0.35, h * 0.11, '#e2463a'); circ(ctx, 0, y - h * 0.95, h * 0.07, '#3fb8a8');
}

function indra(ctx, x, y, k, o = {}) {
  const t = T; const { mood = 'proud', open = 0, throwA = 0, bow = 0, seated = false, holdVajra = true, eye = null } = o;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(bow * 0.25);
  if (!seated) {
    ctx.fillStyle = C.indraD; ctx.beginPath(); ctx.moveTo(-70, 180); ctx.lineTo(70, 180); ctx.lineTo(80, 380); ctx.lineTo(10, 380); ctx.lineTo(0, 260); ctx.lineTo(-10, 380); ctx.lineTo(-80, 380); ctx.closePath(); ctx.fill();
    ell(ctx, -45, 392, 34, 14, C.indraSkin); ell(ctx, 45, 392, 34, 14, C.indraSkin);
  }
  shadowOn(ctx, 16, 8, 0.2); ctx.fillStyle = C.indraSkin; ctx.beginPath(); ctx.moveTo(-80, 70); ctx.quadraticCurveTo(0, 50, 80, 70); ctx.lineTo(70, 190); ctx.lineTo(-70, 190); ctx.closePath(); ctx.fill(); shadowOff(ctx);
  ctx.strokeStyle = C.green; ctx.lineWidth = 24; ctx.beginPath(); ctx.moveTo(-70, 80); ctx.lineTo(60, 185); ctx.stroke();
  ctx.fillStyle = C.gold; ctx.fillRect(-72, 170, 144, 20);
  // arms
  const rA = -0.2 - throwA * 2.6; // right arm raise
  ctx.strokeStyle = C.indraSkin; ctx.lineWidth = 36; ctx.lineCap = 'round';
  const rx = 80 + Math.sin(-rA) * 0 + 90 * Math.cos(rA + 1.3), ry = 80 + 110 * Math.sin(rA + 1.3);
  ctx.beginPath(); ctx.moveTo(78, 85); ctx.lineTo(rx, ry); ctx.stroke(); circ(ctx, rx, ry, 22, C.indraSkin);
  const lx = bow > 0 ? -10 : -130, ly = bow > 0 ? 120 : 170;
  ctx.beginPath(); ctx.moveTo(-78, 85); ctx.lineTo(lx, ly); ctx.stroke(); circ(ctx, lx, ly, 22, C.indraSkin);
  if (bow > 0) circ(ctx, 10, 120, 22, C.indraSkin);
  if (holdVajra) vajra(ctx, rx, ry - 10, 0.55, -0.4 + throwA);
  // head
  shadowOn(ctx, 14, 6, 0.2); circ(ctx, 0, -10, 72, C.indraSkin); shadowOff(ctx);
  crown(ctx, -60, 120, 130);
  for (const sx of [-1, 1]) circ(ctx, sx * 72, 10, 12, C.gold);
  eyes(ctx, eye || (mood === 'shock' ? 'wide' : mood === 'sorry' ? 'closed' : 'open'), 28, -14, 13, [0, 0], t);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 9; ctx.lineCap = 'round';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 6, 28); ctx.quadraticCurveTo(sx * 30, 18, sx * 44, 34); ctx.stroke(); ctx.beginPath(); ctx.arc(sx * 48, 28, 6, 0, TAU); ctx.stroke(); }
  mouthShape(ctx, open > 0 ? 'open' : mood === 'sorry' ? 'frown' : mood === 'shock' ? 'o' : 'smile', 0, 48, 22, open);
  if (mood === 'sorry') { ctx.globalAlpha = 0.8; const d = (t * 0.9) % 1; ell(ctx, 70, -40 + d * 40, 10, 15, '#8ad3ff'); ctx.globalAlpha = 1; }
  ctx.restore();
}

function airavat(ctx, x, y, k, o = {}) {
  const t = T; const { bounce = 0, rider = true, rasgulla = 0 } = o;
  ctx.save(); ctx.translate(x, y + Math.abs(Math.sin(t * 5)) * -14 * bounce); ctx.scale(k, k);
  if (rider) { ctx.save(); indra(ctx, 30, -330, 0.75, { seated: true, ...(o.indraO || {}) }); ctx.restore(); }
  // legs
  for (const lx of [-120, -50, 60, 130]) { ctx.fillStyle = '#e9eef7'; ctx.beginPath(); ctx.roundRect(lx - 28, 60, 56, 120, 22); ctx.fill(); }
  shadowOn(ctx, 26, 12, 0.18);
  const g = ctx.createRadialGradient(-60, -60, 20, 0, 0, 260); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d9e2f2');
  ell(ctx, 0, 0, 230, 160, g); shadowOff(ctx);
  // cloth
  ctx.fillStyle = '#e0457b'; ctx.beginPath(); ctx.moveTo(-110, -150); ctx.lineTo(130, -150); ctx.lineTo(150, 40); ctx.lineTo(-130, 40); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.gold; ctx.fillRect(-130, 30, 280, 16); for (let i = 0; i < 7; i++) circ(ctx, -110 + i * 42, 58, 9, C.gold);
  // head
  shadowOn(ctx, 20, 10, 0.18); circ(ctx, -230, -40, 110, g); shadowOff(ctx);
  ell(ctx, -150, -40, 70, 95, '#eef2fa'); ell(ctx, -150, -40, 48, 70, '#f6c6d6');
  ctx.strokeStyle = '#e4ebf6'; ctx.lineWidth = 46; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-290, 20); ctx.quadraticCurveTo(-330, 160, -270, 170 + Math.sin(t * 3) * 10); ctx.stroke();
  ctx.strokeStyle = '#fffdf4'; ctx.lineWidth = 10; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-270 + i * 18, 30); ctx.quadraticCurveTo(-330 + i * 10, 50 + i * 14, -350 + i * 16, 10 + i * 22); ctx.stroke(); }
  eyes(ctx, 'happy', 0, -70, 14); circ(ctx, -255, -70, 12, C.ink);
  circ(ctx, -270, -110, 18, C.gold);
  if (rasgulla > 0) {
    ctx.globalAlpha = rasgulla; const gg = ctx.createRadialGradient(-80, -80, 10, 0, 0, 280); gg.addColorStop(0, '#fffef6'); gg.addColorStop(1, '#f2e6c8');
    ell(ctx, -40, -10, 300, 230, gg); ell(ctx, -140, -100, 60, 30, 'rgba(255,255,255,0.9)', -0.5);
    ctx.fillStyle = 'rgba(240,190,90,0.6)'; ell(ctx, -40, 190, 330, 50, 'rgba(240,190,90,0.6)');
  }
  ctx.restore();
}

function brahma(ctx, x, y, k, o = {}) {
  const t = T; const { open = 0, bless = 0 } = o;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  shadowOn(ctx, 16, 8, 0.2); ctx.fillStyle = '#e8743a'; ctx.beginPath(); ctx.moveTo(-110, 60); ctx.quadraticCurveTo(0, 30, 110, 60); ctx.lineTo(140, 330); ctx.quadraticCurveTo(0, 350, -140, 330); ctx.closePath(); ctx.fill(); shadowOff(ctx);
  ctx.strokeStyle = '#f2d06a'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(-100, 80); ctx.lineTo(90, 320); ctx.stroke();
  // raised blessing hand
  ctx.strokeStyle = '#e8b07a'; ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(100, 90); ctx.lineTo(170, 90 - 110 * bless); ctx.stroke(); circ(ctx, 170, 80 - 110 * bless, 26, '#f0c08c');
  if (bless > 0.5) glow(ctx, 170, 60 - 110 * bless, 120, 'rgba(255,240,150,0.9)', bless);
  // lotus
  ctx.save(); ctx.translate(-150, 160); for (let i = -2; i <= 2; i++) { ctx.save(); ctx.rotate(i * 0.35); ell(ctx, 0, -30, 16, 36, '#f59ab7'); ctx.restore(); } ctx.restore();
  for (const [hx, sc, z] of [[-78, 0.78, 0], [78, 0.78, 0], [0, 1, 1]]) {
    ctx.save(); ctx.translate(hx, -20 + (z ? 0 : 6)); ctx.scale(sc, sc);
    shadowOn(ctx, 12, 6, 0.18); circ(ctx, 0, 0, 60, '#e8b07a'); shadowOff(ctx);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-50, 14); ctx.quadraticCurveTo(-46, 100, 0, 118); ctx.quadraticCurveTo(46, 100, 50, 14); ctx.quadraticCurveTo(0, 40, -50, 14); ctx.fill();
    crown(ctx, -44, 80, 70);
    eyes(ctx, z ? 'happy' : 'closed', 22, -10, 10);
    if (z && open > 0) mouthShape(ctx, 'open', 0, 40, 16, open);
    ctx.restore();
  }
  ctx.restore();
}

function godSilhouette(ctx, x, y, k, col, halo) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  glow(ctx, 0, -70, 110, halo, 0.9);
  ctx.fillStyle = col; circ(ctx, 0, -70, 46, col);
  ctx.beginPath(); ctx.moveTo(-60, -20); ctx.quadraticCurveTo(0, -40, 60, -20); ctx.lineTo(80, 160); ctx.lineTo(-80, 160); ctx.closePath(); ctx.fill();
  crown(ctx, -105, 70, 60);
  circ(ctx, 70, 40, 24, '#fff3b0');
  ctx.restore();
}

// ---------- backgrounds ----------
function village(ctx, t, light = 1) {
  bg(ctx, light > 0.5 ? ['#ffd9a8', '#ffeccc', '#fff6e4'] : ['#24305e', '#3a4478', '#55507e']);
  sun(ctx, 820, 520 - eo(t / 6) * 80, 90, { face: 'calm', raysA: 0.8 });
  hills(ctx, t, [[1180, 40, 0.006, '#9bc98a', 0.1], [1290, 30, 0.009, '#7db46c', 0.15], [1420, 20, 0.012, '#5f9a55', 0.2]]);
  for (const [hx, hy, hk] of [[170, 1300, 1], [360, 1330, 0.8]]) {
    ctx.save(); ctx.translate(hx, hy); ctx.scale(hk, hk); shadowOn(ctx, 14, 8, 0.2);
    ctx.fillStyle = '#e9c59a'; ctx.fillRect(-80, -40, 160, 120); ctx.fillStyle = '#b8743a'; ctx.beginPath(); ctx.moveTo(-110, -30); ctx.lineTo(0, -130); ctx.lineTo(110, -30); ctx.closePath(); ctx.fill(); shadowOff(ctx);
    ctx.fillStyle = '#6a3a1a'; ctx.fillRect(-20, 20, 40, 60); ctx.restore();
  }
  for (let i = 0; i < 3; i++) { const bx = ((t * 40 + i * 150) % 1300) - 100, by = 380 + i * 40; ctx.strokeStyle = '#6a4a3a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bx - 18, by); ctx.quadraticCurveTo(bx - 9, by - 12 + Math.sin(t * 8 + i) * 6, bx, by); ctx.quadraticCurveTo(bx + 9, by - 12 + Math.sin(t * 8 + i) * 6, bx + 18, by); ctx.stroke(); }
}

function mangoTree(ctx, x, y, k, t, ripe = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = '#7a4a26'; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-18, -260); ctx.lineTo(18, -260); ctx.lineTo(30, 0); ctx.fill();
  shadowOn(ctx, 20, 10, 0.18);
  [[-120, -300, 120], [0, -380, 150], [120, -300, 120], [-60, -230, 100], [70, -230, 100]].forEach(([cx, cy, r], i) => circ(ctx, cx + Math.sin(t * 1.2 + i) * 4, cy, r, i % 2 ? '#4f9a46' : '#5fae52'));
  shadowOff(ctx);
  const r = mulberry32(5);
  for (let i = 0; i < 9; i++) { const mx = -180 + r() * 360, my = -420 + r() * 230; ell(ctx, mx, my + Math.sin(t * 2 + i) * 3, 16, 22, ripe ? '#ffb21e' : '#8fd05a', 0.3); }
  ctx.restore();
}

function spaceBg(ctx, t, tint = 0) { bg(ctx, tint ? ['#0d0b24', '#1b1646', '#2b1f52'] : ['#070a1c', '#121a3c', '#1d2450']); stars(ctx, t); }
function skyBg(ctx, t, k = 1) { bg(ctx, [`rgb(${lerp(90, 120, k)},${lerp(150, 190, k)},${lerp(220, 240, k)})`, '#bfe2ff', '#e8f6ff']); }
function heavenBg(ctx, t) {
  bg(ctx, ['#f9e7c4', '#fff4dd', '#fffaf0']);
  ctx.save(); ctx.globalAlpha = 0.25; ctx.translate(540, 700); ctx.rotate(t * 0.05); for (let i = 0; i < 16; i++) { ctx.rotate(TAU / 16); ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-60, -1400); ctx.lineTo(60, -1400); ctx.fill(); } ctx.restore();
  // torana gate
  ctx.save(); ctx.translate(540, 1150); shadowOn(ctx, 20, 10, 0.15);
  ctx.fillStyle = '#e9b44c'; ctx.fillRect(-340, -560, 50, 560); ctx.fillRect(290, -560, 50, 560);
  for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? '#d8432a' : '#e9b44c'; ctx.beginPath(); ctx.roundRect(-400, -600 + i * 70, 800, 40, 20); ctx.fill(); }
  shadowOff(ctx); for (let i = 0; i < 7; i++) { ctx.fillStyle = '#ff8a3a'; ctx.beginPath(); ctx.moveTo(-300 + i * 100, -460); ctx.lineTo(-280 + i * 100, -420 + Math.sin(t * 3 + i) * 6); ctx.lineTo(-260 + i * 100, -460); ctx.fill(); }
  ctx.restore();
  for (let i = 0; i < 6; i++) cloud(ctx, -60 + i * 230 + Math.sin(t * 0.6 + i) * 20, 1240 + (i % 2) * 40, 1.6, '#ffffff');
}

// ---------- scene renderers ----------
const R = {};

R.sun_hook = (ctx, lt, L) => {
  bg(ctx, ['#ffcf6a', '#ffb347', '#ff9a3a']);
  ctx.save(); ctx.globalAlpha = 0.3; ctx.translate(480, 640); ctx.rotate(lt * 0.15); for (let i = 0; i < 20; i++) { ctx.rotate(TAU / 20); ctx.fillStyle = '#fff0b0'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-50, -1500); ctx.lineTo(50, -1500); ctx.fill(); } ctx.restore();
  const wob = Math.sin(lt * 18) * 6 * seg(lt, 0, 0.3);
  sun(ctx, 480 + wob, 640, 230, { face: 'scared', open: talk(lt, L[0].a, L[0].b, 14), sweat: 1, look: [0, 0.8] });
  // baby's giant mouth rising from bottom
  const up = eo(lt / 3.4);
  ctx.save(); ctx.translate(480, 1900 - up * 420);
  baby(ctx, 0, 0, 3.2 + up * 0.4, { mouth: 'wail', open: 1, eye: 'sparkle', look: [0, -1], body: false });
  ctx.restore();
};

R.quiet_morning = (ctx, lt) => {
  village(ctx, lt);
  mangoTree(ctx, 760, 1320, 1.1, lt);
  ctx.save(); ctx.globalAlpha = 0.6; for (let i = 0; i < 5; i++) cloud(ctx, ((lt * 20 + i * 260) % 1400) - 200, 260 + (i % 3) * 90, 0.7);
  ctx.restore();
};

R.baby_wakes = (ctx, lt, L) => {
  village(ctx, lt + 4);
  mangoTree(ctx, 820, 1250, 0.9, lt);
  // cradle mat
  ell(ctx, 420, 1190, 230, 50, '#d8432a'); ell(ctx, 420, 1182, 210, 38, '#f2b632');
  const open = seg(lt, 0.6, 1.2);
  const second = lt > L[1].a - 0.15;
  baby(ctx, 420, 1000, 0.95, { eye: open < 0.5 ? 'closed' : 'open', mouth: open < 0.5 ? 'smile' : 'o', look: second ? [1, 0] : [0, 0] });
  if (open < 0.5) { ctx.font = '800 60px "Noto Sans"'; ctx.fillStyle = 'rgba(80,60,120,0.6)'; ctx.fillText('z', 540, 870 - lt * 30); }
  // Anjana silhouette walking away with basket
  if (second) {
    const w = seg(lt, L[1].a - 0.15, L[1].b + 0.5); const ax = 640 + w * 320;
    ctx.save(); ctx.globalAlpha = 1 - seg(w, 0.85, 1); ctx.translate(ax, 1140); ctx.fillStyle = '#c0436a';
    ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(50, 0); ctx.lineTo(30, -180); ctx.lineTo(-30, -180); ctx.fill(); circ(ctx, 0, -220, 40, '#a86a3a'); circ(ctx, 0, -235, 38, '#3a1d0e');
    ctx.fillStyle = '#b8843a'; ctx.beginPath(); ctx.ellipse(0, -270, 60, 18, 0, 0, Math.PI); ctx.fill(); ctx.restore();
  }
};

R.hungry = (ctx, lt, L) => {
  bg(ctx, ['#ffe1b8', '#ffd1a0', '#ffc488']);
  ctx.save(); ctx.globalAlpha = 0.25; for (let i = 0; i < 9; i++) circ(ctx, 480, 760, 140 + i * 90 + (lt * 60) % 90, i % 2 ? '#ffb070' : '#ffe0b0'); ctx.restore();
  const cry = lt > L[1].a - 0.1;
  const z = 1.6 + eo(lt / 4) * 0.15;
  baby(ctx, 480, 720 + Math.sin(lt * 20) * (cry ? 6 : 0), z, { eye: cry ? 'squeeze' : 'wide', mouth: cry ? 'wail' : 'o', open: cry ? talk(lt, L[1].a, L[1].b, 10) : 0.3, tears: cry ? 1 : 0, arms: cry ? 0.8 : 0.2 });
  // tummy rumble lines
  if (!cry) { ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = seg((lt * 2 + i * 0.3) % 1, 0, 1); ctx.globalAlpha = 1 - a; ctx.beginPath(); ctx.arc(480, 720 + 165 * z, 140 + a * 60 + i * 10, -0.3 + Math.PI, 0.3 + Math.PI, true); ctx.stroke(); } ctx.globalAlpha = 1; }
};

R.raw_mangoes = (ctx, lt) => {
  bg(ctx, ['#c9ecff', '#e6f7ff', '#f4fff0']);
  const z = 1 + eo(lt / 4) * 0.5;
  ctx.save(); ctx.translate(480, 700); ctx.scale(z, z); ctx.translate(-480, -700); mangoTree(ctx, 480, 1300, 1.5, lt); ctx.restore();
  baby(ctx, 300, 1180, 0.75, { eye: 'open', mouth: 'frown', look: [0.6, -0.8] });
  ctx.save(); ctx.globalAlpha = seg(lt, 1.2, 1.6); ctx.font = '900 72px "Noto Sans"'; ctx.fillStyle = '#3f8a2a'; ctx.textAlign = 'center'; ctx.lineWidth = 12; ctx.strokeStyle = '#fff'; ctx.strokeText('KACHCHE!', 640, 470); ctx.fillText('KACHCHE!', 640, 470); ctx.restore();
};

R.sky_mango = (ctx, lt, L) => {
  skyBg(ctx, lt);
  for (let i = 0; i < 4; i++) cloud(ctx, ((lt * 30 + i * 330) % 1400) - 200, 1000 + (i % 2) * 120, 1.1);
  const m = seg(lt, 1.0, 2.2);
  sun(ctx, 480, 560 + Math.sin(lt * 2) * 10, 170 + eo(lt / 3) * 30, { mango: m, face: 'smile' });
  for (let i = 0; i < 6; i++) sparkle(ctx, 480 + Math.cos(i + lt) * 300, 560 + Math.sin(i * 1.7 + lt) * 260, 18 + 10 * Math.sin(lt * 4 + i), lt + i);
  const shout = lt > L[1].a - 0.1;
  baby(ctx, 480, 1150 - (shout ? eback(seg(lt, L[1].a - 0.1, L[1].a + 0.4)) * 60 : 0), 0.9 + (shout ? 0.15 : 0), { eye: 'sparkle', mouth: shout ? 'open' : 'o', open: shout ? 1 : 0.3, look: [0, -1], arms: shout ? 1 : 0.3 });
};

R.jump = (ctx, lt) => {
  const p = eio(lt / 4.5);
  skyBg(ctx, lt, 1 - p);
  // ground & trees falling away
  ctx.save(); ctx.translate(0, p * 1600);
  hills(ctx, 0, [[1400, 30, 0.008, '#7db46c', 0], [1500, 20, 0.012, '#5f9a55', 0]]);
  mangoTree(ctx, 220, 1500, 0.9, lt); mangoTree(ctx, 880, 1520, 0.8, lt);
  ctx.restore();
  for (let i = 0; i < 6; i++) { const cy = ((i * 380 + lt * 900) % 2600) - 400; cloud(ctx, (i * 237) % 1000, cy, 1 + (i % 3) * 0.3); }
  speedLines(ctx, lt, 1);
  baby(ctx, 480 + Math.sin(lt * 3) * 30, 900 - eback(seg(lt, 0, 0.6)) * 120, 1, { eye: 'sparkle', mouth: 'grin', arms: 1, look: [0, -1], legs: 1 });
};

R.vayu_follow = (ctx, lt, L) => {
  bg(ctx, ['#5aa0e6', '#8cc4f2', '#c9e6ff']);
  for (let i = 0; i < 5; i++) cloud(ctx, ((i * 300 - lt * 260) % 1500 + 1500) % 1500 - 200, 300 + i * 260, 0.9 + (i % 2) * 0.4, '#ffffff', 0.9);
  speedLines(ctx, lt, -1, 'rgba(255,255,255,0.5)', 10);
  const second = lt > L[1].a - 0.1;
  baby(ctx, 650 + Math.sin(lt * 2) * 20, 560 + Math.sin(lt * 3) * 20, 0.85, { eye: 'sparkle', mouth: 'grin', arms: 1, look: [0.6, -0.8], tilt: 0.3, legs: 1 });
  const vx = 300 + Math.sin(lt * 2 + 0.6) * 25, vy = 1000 + Math.sin(lt * 3 + 1) * 25;
  vayu(ctx, vx, vy, 0.9, { blow: second ? 0 : 1, arms: second ? 1 : 0.3, mood: second ? 'worried' : 'kind', eye: second ? 'open' : null });
  if (!second) windStreams(ctx, vx + 60, vy - 80, lt, 1.2, 1);
  if (second) { // "pehli cycle" — a little dashed path & ghost bicycle wheels
    ctx.save(); ctx.globalAlpha = seg(lt, L[1].a, L[1].a + 0.4); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 10; for (const cx of [560, 760]) { ctx.beginPath(); ctx.arc(cx, 760 + Math.sin(lt * 3) * 20, 70, 0, TAU); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(560, 760); ctx.lineTo(650, 680); ctx.lineTo(760, 760); ctx.stroke(); ctx.restore();
  }
};

R.surya_duty = (ctx, lt, L) => {
  bg(ctx, ['#ffcf6a', '#ffe5a6', '#fff4d8']);
  for (let i = 0; i < 4; i++) cloud(ctx, ((i * 330 + lt * 30) % 1400) - 200, 1180 + (i % 2) * 120, 1.2);
  const sec = lt > L[1].a - 0.2; const g = seg(lt, L[1].a, L[1].b);
  const shake = sec ? Math.sin(lt * 25) * 8 * g : 0;
  sun(ctx, 480 + shake, 640, 200, { face: sec && g > 0.4 ? 'shock' : 'calm', sweat: g, look: [0, 1] });
  if (!sec) { ctx.save(); ctx.translate(700, 860); ctx.rotate(0.15); ctx.fillStyle = '#fff'; shadowOn(ctx, 10, 6, 0.2); ctx.beginPath(); ctx.roundRect(-70, -90, 140, 180, 14); ctx.fill(); shadowOff(ctx); ctx.fillStyle = '#c8901a'; ctx.fillRect(-30, -100, 60, 24); ctx.strokeStyle = '#9ab'; ctx.lineWidth = 6; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-45, -40 + i * 35); ctx.lineTo(45 - (i === 3 ? 30 : 0), -40 + i * 35); ctx.stroke(); } ctx.strokeStyle = '#3a9a4a'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-50, -45); ctx.lineTo(-40, -32); ctx.lineTo(-25, -55); ctx.stroke(); ctx.restore(); }
  if (sec) { const z = 0.6 + g * 3.2; ctx.save(); ctx.translate(480, 1700 - g * 400); baby(ctx, 0, 0, z, { mouth: 'wail', open: 1, eye: 'sparkle', look: [0, -1], body: false }); ctx.restore(); }
};

R.blackout = (ctx, lt, L) => {
  const d = seg(lt, 0, 0.7);
  spaceBg(ctx, lt);
  ctx.save(); ctx.globalAlpha = 1 - d; bg(ctx, ['#ffcf6a', '#ffe5a6', '#fff4d8']); ctx.restore();
  // dark village rooftops
  ctx.fillStyle = '#141a36';
  for (let i = 0; i < 6; i++) { const x = i * 190 - 40, h = 220 + (i % 3) * 60; ctx.fillRect(x, 1500 - h, 160, h + 500); ctx.beginPath(); ctx.moveTo(x - 20, 1500 - h); ctx.lineTo(x + 80, 1500 - h - 90); ctx.lineTo(x + 180, 1500 - h); ctx.fill(); }
  const sec = lt > L[1].a - 0.2;
  // one window with a candle + someone asking
  const wx = 400, wy = 1120;
  ctx.fillStyle = sec ? '#f2b84a' : '#2a3258'; ctx.fillRect(wx, wy, 140, 120);
  if (sec) { glow(ctx, wx + 70, wy + 60, 200, 'rgba(255,190,80,0.7)', 0.8); circ(ctx, wx + 70, wy + 70, 32, '#5a3a2a'); ell(ctx, wx + 110, wy + 90, 7, 18, '#fff'); ell(ctx, wx + 110, wy + 66, 7, 12, '#ffcc33'); bubble(ctx, 'Bijli gayi kya?', 560, 900, seg(lt, L[1].a, L[1].a + 0.35), 58); }
};

R.glow = (ctx, lt) => {
  spaceBg(ctx, lt, 1);
  const pulse = 0.85 + 0.15 * Math.sin(lt * 3);
  baby(ctx, 480, 760 + Math.sin(lt * 1.5) * 20, 1.35 + eo(lt / 5) * 0.15, { eye: 'open', mouth: 'smile', cheeks: 1, glowA: pulse, look: [0, 0], arms: 0.2 });
  for (let i = 0; i < 4; i++) { const a = lt * 0.6 + i * TAU / 4; const x = 480 + Math.cos(a) * 360, y = 760 + Math.sin(a) * 220; ell(ctx, x, y, 22, 12, '#c8743a'); ctx.save(); ctx.globalAlpha = 0.9; ell(ctx, x, y - 22, 9, 18, '#ffcc33'); glow(ctx, x, y - 22, 70, 'rgba(255,190,80,0.8)', 0.8); ctx.restore(); }
};

R.rahu_arrives = (ctx, lt, L) => {
  spaceBg(ctx, lt, 1);
  const inP = eo(seg(lt, 0, 1.6));
  const lookAround = lt < L[1].a ? Math.sin(lt * 2.5) : 0;
  rahu(ctx, -200 + inP * 520, 640 + Math.sin(lt * 2) * 20, 1.15, { look: [lookAround, 0], mouth: 'open', open: talk(lt, L[1].a + 2.2, L[1].a + 2.6, 0) ? 0.2 : 0.2 });
  const sec = lt > L[1].a + 1.0;
  if (lt > L[1].a && lt < L[1].a + 1.6) { ctx.font = '900 110px "Noto Sans"'; ctx.fillStyle = '#ffd84a'; ctx.fillText('?', 470 + Math.sin(lt * 5) * 10, 430); ctx.fillText('?', 560, 400); }
  ctx.save(); ctx.globalAlpha = seg(lt, L[1].a + 1.0, L[1].a + 1.6);
  baby(ctx, 640, 1130, 0.85, { eye: 'open', mouth: 'smile', cheeks: 0.8, glowA: 0.6, look: [-1, -0.4] });
  ctx.restore();
  if (sec) { ctx.strokeStyle = 'rgba(255,216,74,0.7)'; ctx.lineWidth = 6; ctx.setLineDash([16, 16]); ctx.beginPath(); ctx.moveTo(600, 1060); ctx.lineTo(380, 720); ctx.stroke(); ctx.setLineDash([]); }
};

R.rahu_flees = (ctx, lt, L) => {
  spaceBg(ctx, lt, 1);
  const flee = seg(lt, L[1].a - 0.2, L[1].b);
  const lunge = eback(seg(lt, 0, 0.35));
  rahu(ctx, 330 - eio(flee) * 900, 640 - flee * 200, 1.1 - flee * 0.3, { eye: flee > 0 ? 'shrink' : 'open', mouth: 'wail', open: 1, sweat: 1, look: [-1, 0] });
  if (flee > 0) { ctx.save(); ctx.globalAlpha = 0.7; speedLines(ctx, lt, 1, 'rgba(180,160,255,0.6)', 8); ctx.restore(); }
  baby(ctx, 620 - lunge * 120, 1050 - lunge * 80, 0.95 + lunge * 0.15, { eye: 'sparkle', mouth: lt < L[0].b + 0.2 ? 'open' : 'grin', open: 1, arms: 1, look: [-1, -0.5], tilt: -0.2 * lunge, cheeks: 0.6 });
  stamp(ctx, 'JAMUN!', 500, 380, seg(lt, 0.05, 0.3), '#7b3fbf', 120);
};

R.rahu_complains = (ctx, lt, L) => {
  heavenBg(ctx, lt);
  indra(ctx, 640, 760, 0.95, { mood: 'shock' });
  rahu(ctx, 250 + Math.sin(lt * 14) * 10, 620, 0.8, { mouth: 'wail', open: talk(lt, L[0].a, L[0].b, 16), sweat: 1, eye: 'open', look: [1, 0] });
};

R.airavat = (ctx, lt, L) => {
  spaceBg(ctx, lt);
  const sec = lt > L[1].a - 0.1;
  const inP = eo(seg(lt, 0, 1.4));
  const z = sec ? 1.25 + eo(seg(lt, L[1].a, L[1].b)) * 0.25 : 0.85;
  cloud(ctx, 560 + (1 - inP) * 700, 1260, 2.2 * z / 0.85 * 0.85, '#ffffff');
  airavat(ctx, 600 + (1 - inP) * 700, 1000 + (sec ? 60 : 0), z, { bounce: 1, rider: true });
  if (sec) { const words = ['BADA', 'SAFED', 'GOL!']; words.forEach((w, i) => { const lp = seg(lt, L[1].a + i * 0.8, L[1].a + i * 0.8 + 0.3); stamp(ctx, w, 260 + i * 220, 380 + (i % 2) * 90, lp, ['#2f4fa8', '#7a8aa8', '#e0457b'][i], 60, -0.1 + i * 0.1); }); }
};

R.rasgulla = (ctx, lt, L) => {
  spaceBg(ctx, lt, 1);
  const r = seg(lt, L[1].a - 0.3, L[1].a + 0.2);
  airavat(ctx, 640, 520, 0.7, { rider: true, rasgulla: r, bounce: 0.5 });
  baby(ctx, 420, 1120 - eback(seg(lt, L[1].a, L[1].a + 0.4)) * 60, 1.05, { eye: 'sparkle', mouth: lt > L[1].a ? 'open' : 'o', open: lt > L[1].a ? 1 : 0.3, look: [0.8, -1], arms: lt > L[1].a ? 1 : 0.4, glowA: 0.4 });
  for (let i = 0; i < 5; i++) sparkle(ctx, 420 + Math.cos(i * 1.3 + lt * 2) * 200, 1050 + Math.sin(i * 2 + lt * 2) * 140, 20, lt * 2 + i);
};

R.vajra = (ctx, lt, L) => {
  spaceBg(ctx, lt, 1);
  const thr = seg(lt, 0.2, 1.0); const fly = seg(lt, 1.0, 1.55); const hit = lt > 1.55;
  indra(ctx, 780, 560, 0.75, { mood: 'shock', throwA: eo(thr), holdVajra: thr < 1 });
  if (thr >= 1 && !hit) vajra(ctx, lerp(820, 470, eio(fly)), lerp(380, 1010, eio(fly)), 0.7, fly * 12);
  const shake = hit ? Math.sin(lt * 40) * 14 * (1 - seg(lt, 1.55, 2.3)) : 0;
  const hic = lt > L[1].a - 0.1;
  baby(ctx, 420 + shake, 900, 1.0, { eye: hit ? 'squeeze' : 'sparkle', mouth: hic ? 'o' : hit ? 'wail' : 'o', open: 0.8, cheeks: hic ? 0 : 0.9, chin: hit, look: [0.5, -0.5], arms: 0.5 });
  if (hit) { glow(ctx, 420, 1010, 160, 'rgba(255,240,180,0.9)', 1 - seg(lt, 1.6, 2.4)); stamp(ctx, 'TAK!', 650, 1080, seg(lt, 1.55, 1.8), '#ff4d2e', 110, 0.15); }
  if (hic) { const p = seg(lt, L[1].a - 0.1, L[1].a + 0.6); bubble(ctx, 'HIC!', 240, 700, p, 70); sun(ctx, 420, 950 - eo(p) * 650, 30 + eo(p) * 110, { face: 'dizzy' }); }
};

R.sun_back = (ctx, lt, L) => {
  const k = seg(lt, 0, 1.2);
  spaceBg(ctx, lt); ctx.save(); ctx.globalAlpha = k; bg(ctx, ['#ffcf6a', '#ffe5a6', '#fff4d8']); ctx.restore();
  for (let i = 0; i < 4; i++) cloud(ctx, ((i * 330 + lt * 30) % 1400) - 200, 1200 + (i % 2) * 120, 1.2, '#fff', k);
  const g = lt > L[0].b + 0.05;
  sun(ctx, 480, 680 + Math.sin(lt * 1.5) * 10, 210, { face: g ? 'smile' : 'dizzy', open: talk(lt, L[0].b + 0.2, L[0].b + 1.6, 12), sweat: 1, rot: lt * 0.4 });
  if (!g) for (let i = 0; i < 3; i++) sparkle(ctx, 480 + Math.cos(lt * 4 + i * 2.1) * 140, 420 + Math.sin(lt * 4 + i * 2.1) * 30, 22, lt * 3, '#fff7c0');
};

R.falling = (ctx, lt, L) => {
  skyBg(ctx, lt, 0.6);
  const sec = lt > L[1].a - 0.1;
  for (let i = 0; i < 6; i++) { const cy = ((i * 380 - lt * (sec ? 100 : 900)) % 2600 + 2600) % 2600 - 400; cloud(ctx, (i * 237) % 1000, cy, 1 + (i % 3) * 0.3); }
  if (!sec) { speedLines(ctx, lt, -1, 'rgba(255,255,255,0.6)'); baby(ctx, 480 + Math.sin(lt * 2) * 30, 600 + lt * 60, 0.9, { eye: 'closed', mouth: 'flat', tilt: lt * 1.2, chin: true, arms: 0.6 }); }
  else {
    const c = eo(seg(lt, L[1].a - 0.1, L[1].a + 0.7));
    vayu(ctx, 480, 1300 - c * 300, 1.05, { holding: true, mood: 'worried', open: talk(lt, L[1].a + 1.5, L[1].a + 2.1, 10) });
    baby(ctx, 480, 1150 - c * 300, 0.6, { eye: 'closed', mouth: 'flat', tilt: 1.3, chin: true, body: true });
  }
};

R.wind_stops = (ctx, lt, L) => {
  const stopP = seg(lt, 1.6, 3.0);
  bg(ctx, [`rgb(${lerp(140, 110, stopP)},${lerp(180, 120, stopP)},${lerp(220, 150, stopP)})`, '#c6cbd6', '#e4e1dc']);
  // frozen leaves
  const r = mulberry32(12);
  for (let i = 0; i < 14; i++) { const fx = r() * 1080, fy = r() * 1300 + 200; const mv = 1 - stopP; ell(ctx, fx + Math.sin(lt * 4 + i) * 60 * mv + lt * 200 * mv % 200, fy + Math.cos(lt * 3 + i) * 30 * mv, 18, 9, '#6fae52', i); }
  if (stopP < 1) { ctx.save(); ctx.globalAlpha = 1 - stopP; windStreams(ctx, 120, 500, lt, 1.4, 1); windStreams(ctx, 520, 1250, lt + 0.4, 1.2, 1); ctx.restore(); }
  const sec = lt > L[1].a - 0.1;
  vayu(ctx, 480, 960, sec ? 1.25 : 1.05, { holding: true, mood: 'angry', open: sec ? talk(lt, L[1].a, L[1].b, 11) : 0 });
  baby(ctx, 480, 1110 + (sec ? 40 : 0), sec ? 0.72 : 0.6, { eye: 'closed', mouth: 'flat', tilt: 1.3, chin: true });
  if (!sec) { ctx.save(); ctx.globalAlpha = 0.85; indra(ctx, 860, 380, 0.45, { mood: 'shock' }); ctx.restore(); }
};

R.gods_come = (ctx, lt, L) => {
  heavenBg(ctx, lt);
  const sec = lt > L[1].a - 0.2;
  const cols = [['#5a7fd0', 'rgba(150,190,255,0.8)'], ['#c0436a', 'rgba(255,170,200,0.8)'], ['#3f9a6a', 'rgba(160,255,200,0.8)'], ['#d08a2a', 'rgba(255,220,140,0.8)']];
  cols.forEach(([c, h], i) => { const side = i % 2 ? 1 : -1; const p = eo(seg(lt, i * 0.35, i * 0.35 + 1.2)); const x = 480 + side * (700 - p * (300 + (i > 1 ? 120 : 0))); godSilhouette(ctx, x, 980 + (i > 1 ? 80 : 0) + Math.abs(Math.sin(lt * 8 + i)) * -14 * (1 - p), 0.9, c, h); });
  vayu(ctx, 480, 920, 0.8, { holding: true, mood: 'worried' });
  baby(ctx, 480, 1040, 0.5, { eye: 'closed', mouth: 'flat', tilt: 1.3, chin: true, glowA: sec ? seg(lt, L[1].a + 1, L[1].b) : 0 });
  if (sec) { const b = eo(seg(lt, L[1].a - 0.2, L[1].a + 0.6)); ctx.save(); ctx.globalAlpha = b; brahma(ctx, 480, 380 + (1 - b) * 60, 0.75, { open: talk(lt, L[1].a + 0.8, L[1].b, 12), bless: seg(lt, L[1].a + 1, L[1].a + 1.6) }); ctx.restore(); }
};

R.indra_sorry = (ctx, lt, L) => {
  heavenBg(ctx, lt);
  indra(ctx, 480, 520, 1.05, { mood: 'sorry', bow: 0.4 + Math.sin(lt * 2) * 0.05, holdVajra: false, open: talk(lt, L[0].a + 2.2, L[0].b, 12) });
  const p = seg(lt, L[0].a + 2.4, L[0].b);
  if (p > 0) { vajra(ctx, 480, 1150, 0.9 + 0.1 * Math.sin(lt * 4), Math.sin(lt * 2) * 0.2); glow(ctx, 480, 1150, 200, 'rgba(255,230,140,0.9)', p); }
};

R.surya_teach = (ctx, lt, L) => {
  bg(ctx, ['#ffd27a', '#ffe9b8', '#fff7e6']);
  sun(ctx, 640, 600, 190, { face: lt < L[0].a + 2.3 ? 'scared' : 'smile', sweat: 1, open: talk(lt, L[0].a + 3.4, L[0].b, 12), look: [-1, 0.4] });
  // book
  const b = eback(seg(lt, L[0].a + 3.1, L[0].a + 3.6));
  if (b > 0) { ctx.save(); ctx.translate(380, 940); ctx.scale(b, b); ctx.rotate(-0.15); shadowOn(ctx, 14, 8, 0.25); ctx.fillStyle = '#d8432a'; ctx.beginPath(); ctx.roundRect(-110, -80, 220, 160, 12); ctx.fill(); shadowOff(ctx); ctx.fillStyle = '#fff6e0'; ctx.fillRect(-100, -70, 95, 140); ctx.fillRect(5, -70, 95, 140); ctx.fillStyle = '#c8901a'; ctx.font = '800 54px "Noto Sans Devanagari", "Noto Sans"'; ctx.textAlign = 'center'; ctx.fillText('क', -52, 20); ctx.fillText('ख', 52, 20); ctx.restore(); }
  baby(ctx, 260, 1180, 0.6, { eye: 'open', mouth: 'smile', look: [1, -1] });
};

R.name = (ctx, lt, L) => {
  bg(ctx, ['#ffe7c2', '#ffd6a0', '#ffc88a']);
  const z = 2.2 + eo(lt / 5) * 0.3;
  const sec = lt > L[1].a - 0.15;
  baby(ctx, 480, 520 - (sec ? 0 : eo(lt / 3) * 80), sec ? 1.5 : z, { eye: sec ? 'happy' : 'closed', mouth: 'smile', chin: true, body: sec });
  if (!sec) { const cy = 520 - eo(lt / 3) * 80 + 104 * z; ctx.save(); ctx.strokeStyle = '#fff3a8'; ctx.lineWidth = 8; ctx.setLineDash([18, 12]); ctx.lineDashOffset = -lt * 40; ctx.beginPath(); ctx.arc(480, cy, 80 + Math.sin(lt * 4) * 6, 0, TAU); ctx.stroke(); ctx.restore(); sparkle(ctx, 580, cy - 60, 26, lt * 2); }
  if (sec) {
    const p = eback(seg(lt, L[1].a - 0.15, L[1].a + 0.5));
    ctx.save(); ctx.translate(480, 1060); ctx.scale(p, p);
    ctx.font = '900 150px "Noto Sans"'; ctx.textAlign = 'center'; ctx.lineWidth = 22; ctx.strokeStyle = '#7a2a10'; ctx.strokeText('HANUMAN', 0, 0);
    const g = ctx.createLinearGradient(0, -110, 0, 20); g.addColorStop(0, '#ffe066'); g.addColorStop(1, '#ff8a1f'); ctx.fillStyle = g; ctx.fillText('HANUMAN', 0, 0);
    ctx.restore();
    for (let i = 0; i < 6; i++) sparkle(ctx, 480 + Math.cos(i + lt) * 380, 1000 + Math.sin(i * 2 + lt) * 120, 22, lt * 2 + i);
  }
};

R.smiles = (ctx, lt, L) => {
  const br = seg(lt, 3.6, 5.2);
  bg(ctx, ['#9fd3ff', '#d4ecff', '#fff6e4']);
  hills(ctx, lt, [[1350, 30, 0.008, '#8cc47a', 0.3], [1460, 20, 0.012, '#6fae5c', 0.4]]);
  windStreams(ctx, 80, 380, lt, 1.2, 0.5 + br * 0.5); windStreams(ctx, 600, 1300, lt + 0.3, 1, br);
  vayu(ctx, 480, 820, 1.05, { holding: true, mood: lt > 1.3 ? 'happy' : 'kind' });
  baby(ctx, 480, 990, 0.62, { eye: lt > 0.3 ? 'happy' : 'closed', mouth: 'grin', tilt: 0.5, chin: true, arms: 0.7 });
  if (br > 0) { ctx.save(); ctx.globalAlpha = br * (1 - seg(lt, 5.4, 6.4)); for (let i = 0; i < 5; i++) cloud(ctx, 150 + i * 190, 520 - br * 120 + (i % 2) * 60, 0.35); ctx.restore(); }
};

R.more = (ctx, lt) => {
  heavenBg(ctx, lt);
  vayu(ctx, 400, 860, 0.95, { holding: true, mood: 'happy', open: talk(lt, 0.6, 2.4, 11), eye: 'happy' });
  baby(ctx, 400, 1000, 0.6, { eye: 'open', mouth: 'smile', look: [1, -1], tilt: 0.3, chin: true });
  const p = seg(lt, 1.6, 2.6);
  sun(ctx, 860, 330, 90, { face: p > 0 ? 'scared' : 'smile', sweat: p, look: [-1, 1] });
  if (p > 0) { ctx.strokeStyle = 'rgba(42,26,18,0.5)'; ctx.lineWidth = 6; ctx.setLineDash([14, 12]); ctx.beginPath(); ctx.moveTo(450, 960); ctx.lineTo(780, 400); ctx.stroke(); ctx.setLineDash([]); }
};

R.sun_hides = (ctx, lt) => {
  bg(ctx, ['#ffd27a', '#ffe9b8', '#fff7e6']);
  const h = eio(seg(lt, 0.6, 2.4));
  sun(ctx, 480 + h * 90, 640 + h * 160, 180, { face: 'scared', sweat: 1, look: [-1, 0] });
  cloud(ctx, 520, 860, 2.6 + h * 0.3, '#ffffff');
  if (h > 0.95) { ctx.save(); ctx.translate(520, 720); ctx.font = '900 80px "Noto Sans"'; ctx.fillStyle = 'rgba(42,26,18,0.6)'; ctx.fillText('. . .', -60, -140 + Math.sin(lt * 3) * 6); ctx.restore(); }
};

R.outro = (ctx, lt) => {
  village(ctx, lt + 10);
  mangoTree(ctx, 800, 1320, 0.9, lt, 1);
  baby(ctx, 330, 1080, 0.8, { eye: 'happy', mouth: 'grin', arms: 0.6 + 0.3 * Math.sin(lt * 8), legs: 0.3 });
  const p = eback(seg(lt, 0.1, 0.6));
  ctx.save(); ctx.translate(480, 480); ctx.scale(p, p);
  shadowOn(ctx, 24, 12, 0.25); ctx.fillStyle = 'rgba(255,250,240,0.95)'; ctx.beginPath(); ctx.roundRect(-380, -170, 760, 340, 40); ctx.fill(); shadowOff(ctx);
  ctx.textAlign = 'center'; ctx.fillStyle = '#7a2a10'; ctx.font = '800 62px "Noto Sans"'; ctx.fillText('Katha pasand aayi?', 0, -60);
  const pulse = 1 + 0.05 * Math.sin(lt * 6); ctx.save(); ctx.translate(0, 70); ctx.scale(pulse, pulse); ctx.fillStyle = '#d8432a'; ctx.beginPath(); ctx.roundRect(-210, -55, 420, 110, 55); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '900 64px "Noto Sans"'; ctx.fillText('FOLLOW', 0, 22); ctx.restore();
  ctx.restore();
};

function linesFor(scene, t0) { return (scene.lines || []).map((l) => ({ a: l.start_s - t0, b: l.end_s - t0 })); }

export const VideoClock = {
  setTime(sec) { T = sec; },
  draw(ctx, width, height, timeline) {
    const t = T; const s = width / 1080;
    const scenes = timeline.scenes || [];
    const sc = scenes.find((x) => t >= x.start_s && t < x.end_s) || scenes[scenes.length - 1];
    const lt = t - sc.start_s;
    const L = linesFor(sc, sc.start_s);
    while (L.length < 3) L.push({ a: 99, b: 99 });
    const dur = sc.end_s - sc.start_s;
    ctx.save(); ctx.scale(s, s);
    // gentle camera push per scene + small pop on entry
    const push = 1 + 0.035 * (lt / Math.max(1, dur)) + 0.04 * (1 - eo(lt / 0.35));
    ctx.translate(540, 900); ctx.scale(push, push); ctx.translate(-540, -900);
    (R[sc.id] || R.quiet_morning)(ctx, lt, L);
    ctx.restore();
    ctx.save(); ctx.scale(s, s); grain(ctx, 0.045);
    const v = ctx.createRadialGradient(540, 900, 600, 540, 900, 1250); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,20,10,0.28)'); ctx.fillStyle = v; ctx.fillRect(0, 0, 1080, 1920);
    ctx.restore();
    // captions (Hinglish), active-word highlight
    const cap = (timeline.captions || []).find((c) => t >= c.start_s && t < c.end_s);
    if (cap) {
      const w = (timeline.words || []).find((x) => x.line === cap.line && t >= x.start_s && t < x.end_s);
      drawCaptionBar(ctx, { width, height, text: cap.text, highlightWord: w ? w.word : '' });
    }
  }
};
