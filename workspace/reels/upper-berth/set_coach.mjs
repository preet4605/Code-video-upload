// set_coach: an Indian Railways sleeper coach at night, built from lib/cinema camera layers + texture tiles (no kit set).
// Everything is a pure function of (state S, t). Design space 1080x1920. Layers are authored "as seen at rest"; scene.mjs places them
// at depths with cam.layer(). Pieces:
//   bay (looking across the bay at the opposite lower berth): wall + window with bars, backrest, seat cushion, upper berth underside,
//     chains, fan, night lamp, foreground knee / berth edge / chain
//   aisle (one-point perspective down the coach): berths with curtains and sleepers, side berths, tube lights, fans, floor
//   berthRow (lateral track): lower / middle berths with sleepers and one dangling hand each
//   props: paper ticket, station boards, sweep light overlay, exterior (night, fog, station, Bhopal)
import * as kit from '../../../.claude/skills/reel-factory/lib/kit/index.mjs';
import { mulberry32 } from '../../../.claude/skills/reel-factory/lib/kit/util.mjs';

const { cin } = kit;
export const TAU = Math.PI * 2;
export const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const sm = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const FONT_EN = '"Noto Sans", "DejaVu Sans", sans-serif', FONT_HI = '"Noto Sans Devanagari", "Noto Sans", sans-serif';

export const PAL = {
  rexine: '#2e6a6c', rexineHi: '#4b9a96', rexineLo: '#14302f', steel: '#5b6a74', steelLo: '#232c33', wall: '#8d9a94', wallLo: '#46514f',
  lampBlue: '#4a86ff', sodium: '#ffa43c', white: '#d6e8ff', paper: '#e9dcb2', yellow: '#d9b53a',
};

const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const vgrad = (c, y0, y1, stops) => { const g = c.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const hgrad = (c, x0, x1, stops) => { const g = c.createLinearGradient(x0, 0, x1, 0); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const tex = (c, name, r, o = {}) => cin.fillTexture(c, name, r, { blend: 'overlay', alpha: 0.5, scale: 1.4, ox: 0, oy: 0, seed: 3, ...o });

// ---------- materials ----------
export function rexineRect(c, x, y, w, h, { r = 18, hi = PAL.rexineHi, base = PAL.rexine, lo = PAL.rexineLo, seams = 0, piping = true, sheen = 0.5, seed = 4 } = {}) {
  c.save(); rr(c, x, y, w, h, r); c.fillStyle = vgrad(c, y, y + h, [[0, hi], [0.18, base], [0.8, lo], [1, '#07100f']]); c.fill(); c.clip();
  tex(c, 'fabric', [x, y, w, h], { alpha: 0.55, scale: 1.1, seed, tint: '#9ab' });
  // leather-grain mottling + glossy vertical sheen
  c.globalCompositeOperation = 'screen'; const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0.1, 'rgba(255,255,255,0)'); g.addColorStop(0.32, `rgba(180,235,230,${0.16 * sheen})`); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(0.78, `rgba(180,235,230,${0.09 * sheen})`); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x, y, w, h);
  c.globalCompositeOperation = 'source-over';
  for (let i = 1; i <= seams; i++) { const sx = x + (w * i) / (seams + 1); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(sx, y + 6); c.lineTo(sx, y + h - 6); c.stroke(); c.strokeStyle = 'rgba(190,240,235,0.16)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(sx + 3, y + 6); c.lineTo(sx + 3, y + h - 6); c.stroke(); c.setLineDash([9, 7]); c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx - 9, y + 8); c.lineTo(sx - 9, y + h - 8); c.stroke(); c.setLineDash([]); }
  c.restore();
  if (piping) { c.save(); rr(c, x, y, w, h, r); c.strokeStyle = 'rgba(0,0,0,0.65)'; c.lineWidth = 5; c.stroke(); rr(c, x + 3, y + 3, w - 6, h - 6, Math.max(2, r - 3)); c.strokeStyle = 'rgba(160,225,220,0.20)'; c.lineWidth = 2; c.stroke(); c.restore(); }
}
export function steelBar(c, x0, y0, x1, y1, w = 14, col = PAL.steel) {
  c.save(); c.lineCap = 'round'; c.strokeStyle = '#05080a'; c.lineWidth = w + 5; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = 'rgba(220,240,255,0.35)'; c.lineWidth = Math.max(2, w * 0.22); c.beginPath(); c.moveTo(x0 - w * 0.2, y0); c.lineTo(x1 - w * 0.2, y1); c.stroke(); c.restore();
}
export function chain(c, x, y0, y1, { sway = 0, link = 34, w = 15, col = '#8996a0' } = {}) {
  c.save(); const n = Math.max(2, Math.round((y1 - y0) / (link * 0.78)));
  for (let i = 0; i < n; i++) {
    const u = i / n, cx = x + sway * Math.sin(u * 2.2) * 8 * u, cy = y0 + (y1 - y0) * u + link * 0.4;
    c.save(); c.translate(cx, cy); c.rotate(i % 2 ? 0 : 0.04 * sway); c.scale(i % 2 ? 0.38 : 1, 1);
    c.beginPath(); c.ellipse(0, 0, w, link * 0.52, 0, 0, TAU); c.strokeStyle = '#05080a'; c.lineWidth = w * 0.62 + 4; c.stroke(); c.strokeStyle = col; c.lineWidth = w * 0.62; c.stroke();
    c.strokeStyle = 'rgba(235,245,255,0.45)'; c.lineWidth = 2; c.beginPath(); c.ellipse(-w * 0.12, -2, w * 0.7, link * 0.42, 0, 3.4, 5.0); c.stroke(); c.restore();
  }
  c.restore();
}
export function curtain(c, x, y, w, h, { col = '#5a2a3a', hi = '#9a5468', t = 0, sway = 0.3, seed = 2, folds = 0, open = 0 } = {}) {
  c.save(); const n = folds || Math.max(4, Math.round(w / 34)), fw = w / n, r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const ph = r() * TAU, sx = Math.sin(t * 0.8 + ph) * sway * 6 * (0.3 + (y + h) / 2000), x0 = x + i * fw + sx * (i / n), x1 = x0 + fw + 1;
    const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, col); g.addColorStop(0.45, hi); g.addColorStop(1, '#0a0508');
    c.fillStyle = g; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.lineTo(x1 + (r() - 0.5) * 8 + sx * 0.5, y + h); c.lineTo(x0 + (r() - 0.5) * 8 + sx * 0.5, y + h); c.closePath(); c.fill();
  }
  c.save(); c.beginPath(); c.rect(x - 14, y, w + 28, h); c.clip(); tex(c, 'fabric', [x - 14, y, w + 28, h], { alpha: 0.55, scale: 1.2, seed: seed + 5 }); c.restore();
  c.fillStyle = vgrad(c, y + h * 0.7, y + h, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.55)']]); c.fillRect(x - 6, y + h * 0.7, w + 12, h * 0.3);
  c.fillStyle = '#2b3036'; c.fillRect(x - 10, y - 8, w + 20, 14); // rod
  c.restore();
}
export function fanDisc(c, cx, cy, r, t, { blades = 3, on = 1 } = {}) {
  c.save(); c.translate(cx, cy); const a0 = t * 7 * on;
  for (let i = 0; i < blades; i++) { c.save(); c.rotate(a0 + (i * TAU) / blades); const g = c.createLinearGradient(0, 0, r, 0); g.addColorStop(0, '#222a30'); g.addColorStop(1, '#0d1114'); c.fillStyle = g; c.beginPath(); c.moveTo(0, -r * 0.1); c.quadraticCurveTo(r * 0.5, -r * 0.24, r, -r * 0.16); c.lineTo(r, r * 0.14); c.quadraticCurveTo(r * 0.5, r * 0.12, 0, r * 0.1); c.closePath(); c.fill(); c.strokeStyle = 'rgba(160,190,210,0.25)'; c.lineWidth = 2; c.stroke(); c.restore(); }
  c.fillStyle = '#10151a'; c.beginPath(); c.arc(0, 0, r * 0.2, 0, TAU); c.fill(); c.strokeStyle = 'rgba(180,200,220,0.4)'; c.lineWidth = 2; c.stroke(); c.restore();
}
const ellipseGlow = (c, x, y, rx, ry, col, a) => { c.save(); c.translate(x, y); c.scale(1, ry / rx); const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0)); c.fillStyle = g; c.fillRect(-rx, -rx, rx * 2, rx * 2); c.restore(); };

// ---------- exterior (what the window shows) ----------
// S.ext: 'night' | 'fog' | 'station' | 'bhopal' | 'dark'; S.t; S.sweep {i,u,kind}; S.board {x01 (0 right ..1 rest), blur}
export function drawExterior(c, r, S) {
  const [x, y, w, h] = r, t = S.t; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  const mode = S.ext;
  if (mode === 'night') {
    c.fillStyle = vgrad(c, y, y + h, [[0, '#050a18'], [0.55, '#122040'], [1, '#22385e']]); c.fillRect(x, y, w, h);
    const rg = mulberry32(21);
    // far hills and tree line
    c.fillStyle = '#04070d'; c.beginPath(); c.moveTo(x, y + h); for (let i = 0; i <= 16; i++) c.lineTo(x + (w * i) / 16, y + h * (0.66 + 0.06 * Math.sin(i * 1.3 + t * 0.15) + 0.04 * rg())); c.lineTo(x + w, y + h); c.closePath(); c.fill();
    // scattered village lights slide past, parallax by size
    for (let i = 0; i < 22; i++) { const sp = 60 + rg() * 180, sx = rg() * (w + 200), yy = y + h * (0.58 + rg() * 0.3), px = x + w - ((sx + t * sp) % (w + 200)) + 100; const s = 2 + sp / 60; c.fillStyle = rg() < 0.6 ? 'rgba(255,190,100,0.9)' : 'rgba(200,225,255,0.85)'; c.beginPath(); c.arc(px, yy, s, 0, TAU); c.fill(); ellipseGlow(c, px, yy, s * 7, s * 7, 'rgba(255,180,90,A)', 0.25); }
    // railway masts: thin dark verticals that flick past
    for (let i = 0; i < 3; i++) { const px = x + w - ((i * 337 + t * 520) % (w + 300)) + 150; c.fillStyle = '#020306'; c.fillRect(px, y, 7 + i * 3, h); }
    for (let k = 0; k < 6; k++) { const yy = y + h * (0.1 + k * 0.14); c.fillStyle = 'rgba(190,210,235,0.06)'; c.fillRect(x, yy + Math.sin(t * 11 + k) * 2, w, 3); }
  } else if (mode === 'fog' || mode === 'dark') {
    const k = mode === 'dark' ? 0 : 1; c.fillStyle = vgrad(c, y, y + h, [[0, '#04060a'], [1, '#0b0f14']]); c.fillRect(x, y, w, h);
    const rg = mulberry32(8); for (let i = 0; i < 12; i++) { const fx = x + rg() * w + Math.sin(t * 0.17 + i) * 60, fy = y + rg() * h + Math.cos(t * 0.13 + i * 2) * 40, R = 180 + rg() * 260; ellipseGlow(c, fx, fy, R, R * 0.75, 'rgba(108,126,140,A)', 0.11 * k); }
    c.fillStyle = 'rgba(160,185,200,0.03)'; c.fillRect(x, y + h * 0.5, w, h * 0.5);
  } else if (mode === 'station' || mode === 'bhopal') {
    const warm = mode === 'station', bd = S.board || { x01: 1, blur: 0 };
    c.fillStyle = vgrad(c, y, y + h, warm ? [[0, '#1b1710'], [0.5, '#6d5a36'], [1, '#c7a45a']] : [[0, '#06090f'], [0.5, '#1a2536'], [1, '#52667f']]); c.fillRect(x, y, w, h);
    const slide = (S.slideSpeed ?? 0) * t, rg = mulberry32(warm ? 41 : 43);
    // roof beams + lamps along the platform
    c.fillStyle = 'rgba(8,8,6,0.7)'; c.fillRect(x, y, w, h * 0.12); for (let i = 0; i < 6; i++) { const px = x + w - ((i * 260 + slide * 0.6) % (w + 260)) + 100; c.fillRect(px, y, 14, h * 0.62); }
    for (let i = 0; i < 5; i++) { const px = x + w - ((i * 300 + slide * 0.8 + 90) % (w + 300)) + 120, py = y + h * 0.16; ellipseGlow(c, px, py, 230, 190, warm ? 'rgba(255,214,140,A)' : 'rgba(210,235,255,A)', 0.95); c.fillStyle = '#fff6dc'; c.beginPath(); c.ellipse(px, py, 34, 12, 0, 0, TAU); c.fill(); }
    // people on the platform (dark shapes with tiny rim)
    if (warm) for (let i = 0; i < 7; i++) { const px = x + 40 + rg() * (w - 80) + Math.sin(t * 0.4 + i) * 6, hh = 150 + rg() * 90; c.fillStyle = 'rgba(14,10,6,0.88)'; c.beginPath(); c.ellipse(px, y + h * 0.72 - hh, 17, 21, 0, 0, TAU); c.fill(); c.fillRect(px - 20, y + h * 0.72 - hh + 18, 40, hh - 18); }
    // platform floor
    c.fillStyle = warm ? 'rgba(40,30,18,0.8)' : 'rgba(5,8,12,0.85)'; c.fillRect(x, y + h * 0.72, w, h * 0.28);
    if (S.boardOn !== false) {
      const bw = Math.min(w * 0.96, S.boardW ?? 560), bh = bw * 0.36, bx = lerp(x + w + bw * 0.6, x + w / 2, bd.x01), by = y + h * (S.boardFrac ?? 0.42);
      const blur = bd.blur || 0; const taps = blur > 0 ? 11 : 1;
      for (let i = 0; i < taps; i++) { const o = taps > 1 ? (i / (taps - 1) - 0.5) * blur : 0; c.save(); c.globalAlpha = taps > 1 ? (i === (taps >> 1) ? 0.5 : 0.16) : 1; stationBoard(c, bx + o - bw / 2, by - bh / 2, bw, bh, S.boardText ?? ['इटारसी', 'ITARSI', 'ITARSI JN']); c.restore(); }
      // post
      c.fillStyle = '#16120a'; c.fillRect(bx - 8, by + bh / 2, 16, h);
    }
    if (blurStreak(S)) { c.globalCompositeOperation = 'screen'; for (let k = 0; k < 14; k++) { const yy = y + rg() * h, L = 200 + rg() * 600, xx = x + w - ((rg() * 900 + t * 3000 * rg()) % (w + L)) ; c.fillStyle = `rgba(255,240,200,${0.05 + 0.2 * rg()})`; c.fillRect(xx, yy, L, 3 + rg() * 5); } c.globalCompositeOperation = 'source-over'; }
  }
  // moving glare from lights passing the window
  const sw = S.sweep;
  if (sw && sw.i > 0.01 && mode !== 'fog' && mode !== 'dark') {
    const gx = lerp(x + w + 120, x - 120, sw.u); const col = sw.kind === 'sodium' ? 'rgba(255,164,60,A)' : sw.kind === 'cool' ? 'rgba(120,255,200,A)' : 'rgba(214,232,255,A)';
    c.globalCompositeOperation = 'screen'; ellipseGlow(c, gx, y + h * 0.34, 320, 420, col, 0.9 * sw.i); ellipseGlow(c, gx, y + h * 0.34, 90, 100, col, sw.i); c.globalCompositeOperation = 'source-over';
  }
  c.restore();
}
const blurStreak = (S) => S.ext === 'bhopal' && (S.board?.blur ?? 0) > 20;

export function stationBoard(c, x, y, w, h, [hi, en, sub]) {
  c.save(); c.fillStyle = '#0c0a05'; rr(c, x - 8, y - 8, w + 16, h + 16, 10); c.fill();
  c.fillStyle = '#e8c13a'; rr(c, x, y, w, h, 7); c.fill(); c.save(); rr(c, x, y, w, h, 7); c.clip(); tex(c, 'plaster', [x, y, w, h], { alpha: 0.4, seed: 9, scale: 1.1 }); c.fillStyle = vgrad(c, y, y + h, [[0, 'rgba(255,255,255,0.25)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.3)']]); c.fillRect(x, y, w, h); c.restore();
  c.strokeStyle = '#111'; c.lineWidth = 4; c.strokeRect(x + 10, y + 10, w - 20, h - 20);
  c.fillStyle = '#16120a'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `700 ${h * 0.34}px ${FONT_HI}`; c.fillText(hi, x + w / 2, y + h * 0.3);
  c.font = `700 ${h * 0.3}px ${FONT_EN}`; c.fillText(en, x + w / 2, y + h * 0.62);
  if (sub) { c.font = `600 ${h * 0.1}px ${FONT_EN}`; c.fillText(sub, x + w / 2, y + h * 0.88); }
  c.restore();
}

// ---------- the bay (looking across at the opposite lower berth) ----------
// W = { win:[x,y,w,h] } window rect at rest; lamp:[x,y]
export const BAY = { win: [600, 330, 400, 720], lamp: [150, 520] };

export function bayWall(c, b, S, W = BAY) {
  const [wx, wy, ww, wh] = W.win;
  c.fillStyle = vgrad(c, 0, 1500, [[0, '#38423f'], [0.5, '#56635d'], [1, '#2a3331']]); c.fillRect(b.x0 - 4, b.y0 - 4, b.w + 8, 1620 - b.y0);
  tex(c, 'plaster', [b.x0, 0, b.w, 1560], { alpha: 0.55, scale: 1.6, seed: 6, tint: '#bcd' });
  // laminate panel seams and a steel rail
  c.strokeStyle = 'rgba(0,0,0,0.38)'; c.lineWidth = 4; for (const sx of [-40, 520, 1080]) { c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx, 1600); c.stroke(); }
  c.fillStyle = '#313a3e'; c.fillRect(b.x0 - 4, 1060, b.w + 8, 26); c.fillStyle = 'rgba(200,225,240,0.2)'; c.fillRect(b.x0 - 4, 1062, b.w + 8, 3);
  // window frame
  c.fillStyle = '#1a2025'; rr(c, wx - 34, wy - 34, ww + 68, wh + 68, 22); c.fill(); c.strokeStyle = 'rgba(190,215,235,0.28)'; c.lineWidth = 3; rr(c, wx - 30, wy - 30, ww + 60, wh + 60, 20); c.stroke();
  // hole for the emissive exterior
  c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.fillRect(wx, wy, ww, wh); c.restore();
  // glass reflections, bars (vertical) and shutter rails
  c.fillStyle = 'rgba(150,190,230,0.07)'; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + ww * 0.45, wy); c.lineTo(wx, wy + wh * 0.5); c.closePath(); c.fill();
  const n = 5; for (let i = 0; i < n; i++) { const bx = wx + ((i + 0.5) * ww) / n; steelBar(c, bx, wy - 6, bx, wy + wh + 6, 16, '#46525c'); }
  steelBar(c, wx - 8, wy + wh * 0.34, wx + ww + 8, wy + wh * 0.34, 9, '#3a454e');
  c.fillStyle = '#10151a'; c.fillRect(wx - 34, wy + wh + 30, ww + 68, 40); c.fillStyle = 'rgba(190,220,240,0.22)'; c.fillRect(wx - 34, wy + wh + 30, ww + 68, 4);
  // window curtain, pulled to the side
  curtain(c, wx + ww - 70, wy - 30, 120, wh + 150, { col: '#4a2a44', hi: '#8a5a7c', t: S.t, seed: 11, sway: 0.5 });
  // fold-down table below the window
  c.fillStyle = vgrad(c, wy + wh + 70, wy + wh + 100, [[0, '#2a3338'], [1, '#161c20']]); c.fillRect(wx - 34, wy + wh + 70, ww + 68, 30);
  // reading lamp / blue night lamp plate on the left partition
  const [lx, ly] = W.lamp; c.fillStyle = '#14191d'; rr(c, lx - 54, ly - 36, 108, 72, 14); c.fill(); c.strokeStyle = 'rgba(190,215,235,0.3)'; c.lineWidth = 2; rr(c, lx - 52, ly - 34, 104, 68, 13); c.stroke();
  // luggage hooks
  c.fillStyle = '#0a0d10'; for (const hx of [260, 340, 420]) { c.beginPath(); c.arc(hx, 700, 9, 0, TAU); c.fill(); }
}
export function bayLampGlow(c, S, W = BAY) { // emissive: after the dark mask
  const [lx, ly] = W.lamp, k = S.lampI ?? 1;
  c.save(); c.globalCompositeOperation = 'screen'; ellipseGlow(c, lx, ly, 330, 330, 'rgba(70,130,255,A)', 0.8 * k); c.globalCompositeOperation = 'source-over';
  c.fillStyle = `rgba(150,200,255,${0.95 * k})`; rr(c, lx - 34, ly - 15, 68, 30, 10); c.fill(); c.restore();
}
export function bayBackrest(c, b, S) { // the opposite lower berth's back cushion, leaning on the partition
  rexineRect(c, -60, 700, 760, 620, { r: 36, seams: 3, hi: '#3d8680', base: '#255d5e', lo: '#10292a', seed: 12 });
  c.fillStyle = '#10181b'; c.fillRect(-60, 1250, 760, 80);
}
export function baySeat(c, b, S) {
  // seat top (foreshortened) + front face, piping, steel frame underneath, shadow
  c.fillStyle = vgrad(c, 1240, 1330, [[0, '#4c9b95'], [1, '#2a6664']]); c.beginPath(); c.moveTo(-60, 1330); c.lineTo(80, 1242); c.lineTo(1000, 1242); c.lineTo(1150, 1330); c.closePath(); c.fill();
  c.save(); c.beginPath(); c.moveTo(-60, 1330); c.lineTo(80, 1242); c.lineTo(1000, 1242); c.lineTo(1150, 1330); c.closePath(); c.clip(); tex(c, 'fabric', [-60, 1240, 1220, 90], { alpha: 0.55, seed: 14, scale: 1.0 }); c.restore();
  rexineRect(c, -80, 1328, 1240, 230, { r: 22, seams: 5, hi: '#34807b', base: '#1f5859', lo: '#0b1e1f', seed: 13 });
  c.fillStyle = '#0a1013'; c.fillRect(-80, 1556, 1240, 180);
  steelBar(c, -80, 1580, 1160, 1580, 24, '#3a464e'); steelBar(c, 130, 1580, 130, 1900, 22, '#3a464e'); steelBar(c, 950, 1580, 950, 1900, 22, '#3a464e');
  c.fillStyle = vgrad(c, 1556, 1760, [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(-80, 1556, 1240, 200);
  // a bag under the berth
  c.fillStyle = '#17110c'; rr(c, 640, 1650, 280, 190, 24); c.fill(); c.strokeStyle = 'rgba(160,120,80,0.35)'; c.lineWidth = 3; rr(c, 650, 1660, 260, 170, 20); c.stroke();
}
export function bayUpper(c, b, S) { // underside of the middle / upper berth over our heads, its hanging chain, a ceiling fan
  c.fillStyle = vgrad(c, -20, 330, [[0, '#0d1418'], [0.8, '#2b363c'], [1, '#12191d']]); c.fillRect(b.x0 - 4, -30, b.w + 8, 360);
  tex(c, 'plaster', [b.x0, -30, b.w, 360], { alpha: 0.5, seed: 17, scale: 1.3 });
  rexineRect(c, -40, 250, 700, 120, { r: 20, seams: 0, hi: '#2f7a76', base: '#1d5252', lo: '#0a1f20', seed: 15 });
  steelBar(c, 700, 300, 1090, 230, 12, '#44515a'); steelBar(c, -40, 60, 1100, 60, 10, '#303b43');
  chain(c, 96, 360, 820, { sway: Math.sin(S.t * 0.9) * 0.5 }); chain(c, 1030, 300, 700, { sway: Math.sin(S.t * 0.7 + 1) * 0.5 });
  c.fillStyle = '#10161a'; rr(c, 20, 820, 150, 46, 14); c.fill(); // chain hook plate
  fanDisc(c, 890, 150, 150, S.t, { on: S.fanOn ?? 1 });
}
export function bayFore(c, b, S, o = {}) { // narrator's knee (jeans) rising into the lower-left, chain edge, berth lip at the bottom
  c.save();
  const g = c.createLinearGradient(0, 1500, 0, 1960); g.addColorStop(0, '#16202b'); g.addColorStop(1, '#05080c'); c.fillStyle = g;
  c.beginPath(); c.moveTo(-160, 1980); c.lineTo(-160, 1560); c.bezierCurveTo(-60, 1440, 220, 1420, 360, 1520); c.bezierCurveTo(440, 1590, 470, 1760, 520, 1980); c.closePath(); c.fill();
  c.save(); c.clip(); tex(c, 'fabric', [-160, 1400, 700, 600], { alpha: 0.7, scale: 1.6, seed: 5, tint: '#6a88b8' }); c.globalCompositeOperation = 'screen'; ellipseGlow(c, 160, 1500, 260, 110, 'rgba(110,160,230,A)', 0.22); c.restore();
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 4; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-80 + i * 90, 1560 + i * 20); c.quadraticCurveTo(60 + i * 90, 1650 + i * 15, 130 + i * 70, 1800); c.stroke(); }
  rexineRect(c, 400, 1740, 900, 260, { r: 26, seams: 2, hi: '#2a6f6b', base: '#18494a', lo: '#071516', seed: 16, sheen: 0.8 });
  c.restore();
  if (o.chain !== false) chain(c, 1010, -40, 520, { sway: Math.sin(S.t * 0.8) * 0.7, link: 46, w: 21, col: '#2c3841' });
}

// ---------- the sweep light that rakes across everything ----------
const tmpCanvas = (w, h) => cin.pooled('coach-sweep', w, h);
export function sweepOverlay(ctx, S, W = BAY, strength = 1) {
  const sw = S.sweep; if (!sw || sw.i < 0.01) return;
  const k = ctx.canvas.width / 1080, o = tmpCanvas(ctx.canvas.width, ctx.canvas.height), c = o.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, o.width, o.height); c.setTransform(k, 0, 0, k, 0, 0);
  const col = sw.kind === 'sodium' ? [255, 160, 60] : sw.kind === 'cool' ? [120, 255, 200] : [205, 228, 255];
  // a slanted band of light thrown through the window bars: pool centre travels with the lamp outside
  const cx = lerp(1250, -250, sw.u), a = 0.40 * sw.i * strength;
  const g = c.createLinearGradient(cx - 230, 0, cx + 230, 0); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g; c.beginPath(); c.moveTo(cx - 230 + 120, 0); c.lineTo(cx + 230 + 120, 0); c.lineTo(cx + 230 - 150, 1920); c.lineTo(cx - 230 - 150, 1920); c.closePath(); c.fill();
  // bar shadows: window bars chop the band into stripes
  c.globalCompositeOperation = 'destination-out'; c.fillStyle = 'rgba(0,0,0,0.78)';
  const [wx, , ww] = W.win, n = 5; for (let i = 0; i < n; i++) { const bx = wx + ((i + 0.5) * ww) / n; c.save(); c.transform(1, 0, -0.14, 1, 0, 0); c.fillRect(bx - 20 - 0.14 * 400 + (cx - 600) * 0.18, 0, 40, 1920); c.restore(); }
  c.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; ctx.drawImage(o, 0, 0); ctx.restore();
}

// ---------- tickets ----------
// IR-style computer ticket on aged paper. age 0 = crisp cream, 1 = deeply yellowed with foxing. lines are drawn in dark print.
export function drawTicket(c, x, y, w, h, { age = 1, date = '14-06-2014', pnr = '4521368790', seed = 1, name = 'RAMESH CHANDRA', berth = 'LB/33', fade = 1, route = 'ITARSI JN  -  DELHI' } = {}) {
  const r = mulberry32(seed + 77); c.save(); c.translate(x, y);
  const a = cl(age);
  const base = [lerp(238, 214, a), lerp(230, 176, a), lerp(205, 96, a)].map((v) => Math.round(v)), edge = [lerp(220, 150, a), lerp(205, 108, a), lerp(170, 44, a)].map((v) => Math.round(v));
  // drop shadow
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.moveTo(14, h + 8); c.lineTo(w + 20, h + 14); c.lineTo(w + 12, h + 34); c.lineTo(8, h + 28); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(0, 6); for (let i = 1; i <= 14; i++) c.lineTo((w * i) / 14, (i % 2 ? 2 : 0) + r() * 5); c.lineTo(w, h - 5); for (let i = 14; i >= 0; i--) c.lineTo((w * i) / 14, h - ((i % 2) ? 2 : 0) - r() * 5); c.closePath();
  const g = c.createRadialGradient(w * 0.45, h * 0.4, 20, w * 0.5, h * 0.5, w * 0.75); g.addColorStop(0, `rgb(${base})`); g.addColorStop(1, `rgb(${edge})`); c.fillStyle = g; c.fill(); c.save(); c.clip();
  tex(c, 'plaster', [0, 0, w, h], { alpha: 0.45 + 0.3 * a, scale: 0.9, seed: 31 });
  // foxing, creases and a coffee ring when old
  for (let i = 0; i < Math.round(26 * a); i++) { const fx = r() * w, fy = r() * h, fr = 4 + r() * 16; const fg = c.createRadialGradient(fx, fy, 0, fx, fy, fr); fg.addColorStop(0, `rgba(120,70,20,${0.28 * a})`); fg.addColorStop(1, 'rgba(120,70,20,0)'); c.fillStyle = fg; c.fillRect(fx - fr, fy - fr, fr * 2, fr * 2); }
  c.strokeStyle = `rgba(80,50,20,${0.18 + 0.2 * a})`; c.lineWidth = 2; c.beginPath(); c.moveTo(w * 0.34, 0); c.lineTo(w * 0.36, h); c.stroke(); c.beginPath(); c.moveTo(0, h * 0.58); c.lineTo(w, h * 0.55); c.stroke();
  c.strokeStyle = `rgba(255,250,230,${0.25 - 0.1 * a})`; c.lineWidth = 2; c.beginPath(); c.moveTo(w * 0.34 + 3, 0); c.lineTo(w * 0.36 + 3, h); c.stroke();
  // print
  const ink = `rgba(${lerp(24, 70, a)},${lerp(22, 48, a)},${lerp(30, 30, a)},${0.92 * fade})`; c.fillStyle = ink; c.textBaseline = 'alphabetic';
  c.font = `700 ${h * 0.085}px ${FONT_EN}`; c.textAlign = 'left'; c.fillText('INDIAN RAILWAYS', w * 0.05, h * 0.13);
  c.font = `600 ${h * 0.05}px ${FONT_EN}`; c.textAlign = 'right'; c.fillText('e-RESERVATION SLIP', w * 0.95, h * 0.13);
  c.fillRect(w * 0.05, h * 0.165, w * 0.9, 3);
  c.textAlign = 'left'; c.font = `600 ${h * 0.056}px ${FONT_EN}`; c.fillText('PNR', w * 0.05, h * 0.27); c.font = `800 ${h * 0.1}px "DejaVu Sans Mono", ${FONT_EN}`; c.fillText(pnr, w * 0.05, h * 0.38);
  c.font = `600 ${h * 0.056}px ${FONT_EN}`; c.fillText('DATE OF JOURNEY', w * 0.58, h * 0.27); c.font = `800 ${h * 0.115}px ${FONT_EN}`; c.fillText(date, w * 0.58, h * 0.395);
  c.font = `600 ${h * 0.05}px ${FONT_EN}`; c.fillText('CLASS', w * 0.05, h * 0.5); c.fillText('COACH', w * 0.32, h * 0.5); c.fillText('BERTH', w * 0.6, h * 0.5);
  c.font = `800 ${h * 0.11}px ${FONT_EN}`; c.fillText('SL', w * 0.05, h * 0.62); c.fillText('S7', w * 0.32, h * 0.62); c.fillText(berth, w * 0.6, h * 0.62);
  c.font = `600 ${h * 0.055}px ${FONT_EN}`; c.fillText('PASSENGER', w * 0.05, h * 0.74); c.font = `700 ${h * 0.066}px ${FONT_EN}`; c.fillText(name, w * 0.05, h * 0.82);
  c.font = `600 ${h * 0.05}px ${FONT_EN}`; c.fillText(route, w * 0.05, h * 0.92);
  for (let i = 0; i < 46; i++) { const bw = 1 + r() * 3.2; c.fillRect(w * 0.6 + i * 4.3 - 0, h * 0.7, bw, h * 0.2); }
  c.restore(); c.restore();
}

// ============================================================================================================
// aisle: one-point perspective down the coach. Eye 1.35 m above floor, aisle +-1.05 m. Z in metres from the lens.
// ============================================================================================================
const AF = 980, AVX = 540, AVY = 800;
export const AP = (x, Y, z) => [AVX + (x * AF) / z, AVY + (Y * AF) / z];
const quad = (c, pts, fill) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } };
export function drawAisle(c, S) {
  const t = S.t, tube = S.tube ?? 1, sw = S.sweep ?? { i: 0, u: 0, kind: 'white' }, ZF = 15.5;
  c.fillStyle = '#02040a'; c.fillRect(-300, -300, 1700, 2500);
  // far end wall + door + exit lamp
  quad(c, [AP(-1.05, -1.0, ZF), AP(1.05, -1.0, ZF), AP(1.05, 1.4, ZF), AP(-1.05, 1.4, ZF)], '#10181b');
  { const a = AP(-0.3, -0.5, ZF), b = AP(0.3, 1.4, ZF); c.fillStyle = '#0a1214'; c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); c.strokeStyle = '#2d3b40'; c.lineWidth = 3; c.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    const e = AP(0, -0.62, ZF); ellipseGlow(c, e[0], e[1], 60, 40, 'rgba(60,255,150,A)', 0.55 * (0.8 + 0.2 * Math.sin(t * 2))); c.fillStyle = 'rgba(120,255,180,0.9)'; c.fillRect(e[0] - 14, e[1] - 6, 28, 12); }
  // floor and ceiling
  { const g = c.createLinearGradient(0, AVY, 0, 1920); g.addColorStop(0, '#0b1316'); g.addColorStop(1, '#222d30'); quad(c, [AP(-1.05, 1.4, 0.5), AP(1.05, 1.4, 0.5), AP(1.05, 1.4, ZF), AP(-1.05, 1.4, ZF)], g);
    quad(c, [AP(-0.38, 1.4, 0.5), AP(0.38, 1.4, 0.5), AP(0.38, 1.4, ZF), AP(-0.38, 1.4, ZF)], 'rgba(60,90,100,0.38)'); // runner
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3; for (let z = 0.8; z < ZF; z += 0.9) { const a = AP(-1.05, 1.4, z), b = AP(1.05, 1.4, z); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); } }
  { const g = c.createLinearGradient(0, 0, 0, AVY); g.addColorStop(0, '#0a0f12'); g.addColorStop(1, '#1a2428'); quad(c, [AP(-1.05, -1.05, 0.5), AP(1.05, -1.05, 0.5), AP(1.05, -1.05, ZF), AP(-1.05, -1.05, ZF)], g); }
  // right wall (side berths + windows), far to near
  const wall = c.createLinearGradient(0, 0, 0, 1920); wall.addColorStop(0, '#16201f'); wall.addColorStop(1, '#222d2b');
  quad(c, [AP(1.05, -1.05, 0.5), AP(1.05, -1.05, ZF), AP(1.05, 1.4, ZF), AP(1.05, 1.4, 0.5)], wall);
  quad(c, [AP(-1.05, -1.05, 0.5), AP(-1.05, -1.05, ZF), AP(-1.05, 1.4, ZF), AP(-1.05, 1.4, 0.5)], '#070c0f');
  for (let k = 8; k >= 0; k--) { // windows on the right wall
    const z0 = 1.3 + k * 1.75, z1 = z0 + 1.05; if (z0 > ZF) continue;
    const lag = Math.abs(sw.u - clampLag(k / 8)), glare = sw.i * Math.max(0, 1 - lag * 2.2);
    const pts = [AP(1.05, -0.62, z0), AP(1.05, -0.62, z1), AP(1.05, 0.05, z1), AP(1.05, 0.05, z0)];
    const wg = c.createLinearGradient(0, pts[0][1], 0, pts[3][1]); wg.addColorStop(0, '#0a1424'); wg.addColorStop(1, '#16253c'); quad(c, pts, wg);
    if (glare > 0.02) { c.save(); quad(c, pts); c.clip(); const col = sw.kind === 'sodium' ? 'rgba(255,170,70,A)' : 'rgba(215,232,255,A)'; ellipseGlow(c, (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[3][1]) / 2, Math.abs(pts[1][0] - pts[0][0]) * 1.2 + 30, (pts[3][1] - pts[0][1]) * 1.1 + 20, col, glare); c.restore(); }
    c.strokeStyle = '#05080a'; c.lineWidth = Math.max(2, 20 / z0); for (let b = 1; b <= 4; b++) { const f = b / 5, a = AP(1.05, -0.62, lerpv(z0, z1, f)), d = AP(1.05, 0.05, lerpv(z0, z1, f)); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(d[0], d[1]); c.stroke(); }
    c.lineWidth = Math.max(3, 40 / z0); quad(c, pts); c.stroke();
    // blue floor glow under the window and light patch on the lower berth
    if (glare > 0.05) { const p = AP(0.6, 1.4, (z0 + z1) / 2); c.save(); c.globalCompositeOperation = 'screen'; ellipseGlow(c, p[0], p[1], 320 / z0, 60 / z0 + 10, sw.kind === 'sodium' ? 'rgba(255,150,60,A)' : 'rgba(190,215,255,A)', 0.7 * glare); c.restore(); }
  }
  // side berths on the right: lower (blanket lumps) and upper (underside, chain)
  for (let k = 7; k >= 0; k--) {
    const z0 = 1.3 + k * 1.75, z1 = z0 + 1.45; if (z0 > ZF) continue;
    // lower berth slab top + front, sleeper lump
    quad(c, [AP(0.38, 0.62, z0), AP(0.38, 0.62, z1), AP(1.05, 0.62, z1), AP(1.05, 0.62, z0)], '#1f5a5a');
    quad(c, [AP(0.38, 0.62, z0), AP(0.38, 0.62, z1), AP(0.38, 0.86, z1), AP(0.38, 0.86, z0)], '#0f2f30');
    if (k !== 3) { const col = ['#5a2a3a', '#2a3f66', '#4a4a2a', '#3a2a55'][k % 4]; quad(c, [AP(0.45, 0.62, z0 + 0.1), AP(0.45, 0.62, z1 - 0.1), AP(0.45, 0.28, z1 - 0.2), AP(0.45, 0.2, z0 + 0.45), AP(0.45, 0.3, z0 + 0.2)], shade2(col, 0.9)); quad(c, [AP(0.45, 0.62, z0 + 0.1), AP(0.45, 0.2, z0 + 0.45), AP(1.0, 0.2, z0 + 0.45), AP(1.0, 0.62, z0 + 0.1)], shade2(col, 0.55)); const hp = AP(0.7, 0.26, z0 + 0.38), hr = 150 / (z0 + 0.4); c.fillStyle = '#6a5848'; c.beginPath(); c.ellipse(hp[0], hp[1], hr * 0.3, hr * 0.36, 0.2, 0, TAU); c.fill(); }
    // upper berth: dark underside + hanging chain
    quad(c, [AP(0.38, -0.46, z0), AP(0.38, -0.46, z1), AP(1.05, -0.46, z1), AP(1.05, -0.46, z0)], '#0b1011'); quad(c, [AP(0.38, -0.46, z0), AP(0.38, -0.46, z1), AP(0.38, -0.3, z1), AP(0.38, -0.3, z0)], '#16373a');
    const ch = AP(0.38, -0.46, z0 + 0.1), ch2 = AP(0.38, -1.05, z0 + 0.1); c.strokeStyle = 'rgba(150,170,180,0.6)'; c.lineWidth = Math.max(2, 14 / z0); c.setLineDash([Math.max(3, 18 / z0), Math.max(2, 8 / z0)]); c.beginPath(); c.moveTo(ch[0], ch[1]); c.lineTo(ch2[0], ch2[1]); c.stroke(); c.setLineDash([]);
  }
  // left bays: three berth ends per bay (lower, middle, upper); curtains; feet out of the curtains
  const LX = -1.05; const palette = ['#5a2a3a', '#2a3f66', '#3b5a3a', '#4a3a2a', '#35305a'];
  for (let k = 8; k >= 0; k--) {
    const z0 = 1.15 + k * 1.75, z1 = z0 + 0.62; if (z0 > ZF) continue;
    for (let lvl = 0; lvl < 3; lvl++) {
      const Yt = [0.4, -0.25, -0.9][lvl] + 0.0, Yb = Yt + 0.46;
      quad(c, [AP(LX, Yt, z0), AP(LX, Yt, z1), AP(LX, Yb, z1), AP(LX, Yb, z0)], lvl === 2 ? '#0b1114' : '#0f2c2d');
      const occupied = (k * 3 + lvl) % 5 !== 2;
      if (occupied) { const col = palette[(k + lvl) % 5]; quad(c, [AP(LX, Yt - 0.06, z0 + 0.04), AP(LX, Yt - 0.06, z1 - 0.04), AP(LX, Yb - 0.02, z1 - 0.04), AP(LX, Yb - 0.02, z0 + 0.04)], shade2(col, 0.7)); quad(c, [AP(LX + 0.5, Yt - 0.12, z0 + 0.04), AP(LX, Yt - 0.06, z0 + 0.04), AP(LX, Yb - 0.02, z0 + 0.04), AP(LX + 0.5, Yb - 0.02, z0 + 0.1)], shade2(col, 0.4)); }
      // curtain over some berths with the hem swaying; feet poke out under it
      if ((k + lvl * 2) % 3 === 0) { const a = AP(LX + 0.01, Yt - 0.12, z0 - 0.05), b = AP(LX + 0.01, Yb + 0.1, z1 + 0.05); c.save(); curtain(c, a[0] - 4, a[1], Math.abs(b[0] - a[0]) + 8, b[1] - a[1], { col: '#3a2030', hi: '#6a3d55', t, seed: k * 7 + lvl, sway: 0.4, folds: 3 }); c.restore();
        if (occupied && (k + lvl) % 2 === 0) { const f = AP(LX + 0.04, Yb + 0.04, (z0 + z1) / 2), s = 180 / ((z0 + z1) / 2); c.fillStyle = '#74604f'; c.beginPath(); c.ellipse(f[0] - s * 0.04, f[1] + s * 0.07, s * 0.1, s * 0.15, -0.1, 0, TAU); c.fill(); c.beginPath(); c.ellipse(f[0] + s * 0.12, f[1] + s * 0.06, s * 0.1, s * 0.14, 0.1, 0, TAU); c.fill(); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(f[0] - s * 0.16, f[1] - s * 0.02, s * 0.38, s * 0.04); } }
    }
    // partition post between bays
    const pa = AP(LX, -1.05, z1 + 0.04), pb = AP(LX, 1.4, z1 + 0.04); steelBar(c, pa[0], pa[1], pb[0], pb[1], Math.max(3, 28 / z1), '#394650');
  }
  // ceiling tubes (flicker) and fans
  for (let i = 0; i < 4; i++) { const z0 = 2.4 + i * 3.1, z1 = z0 + 1.1, g = tube * (i === 1 || i === 2 ? S.tubeB ?? 1 : 1);
    quad(c, [AP(-0.12, -1.04, z0), AP(0.12, -1.04, z0), AP(0.12, -1.04, z1), AP(-0.12, -1.04, z1)], `rgba(${Math.round(170 + 80 * g)},${Math.round(190 + 60 * g)},${Math.round(215 + 40 * g)},${0.35 + 0.65 * g})`);
    const p = AP(0, -1.04, (z0 + z1) / 2); c.save(); c.globalCompositeOperation = 'screen'; ellipseGlow(c, p[0], p[1] + 30, 520 / z0, 260 / z0, 'rgba(150,200,255,A)', 0.5 * g); ellipseGlow(c, p[0], p[1] + 520 / z0, 400 / z0, 110 / z0, 'rgba(120,170,255,A)', 0.25 * g); c.restore(); }
  for (let i = 0; i < 3; i++) { const z = 1.7 + i * 4.1, p = AP(0, -1.0, z), s = 210 / z; c.save(); c.translate(p[0], p[1]); c.scale(1, 0.12); fanDisc(c, 0, 0, s, t + i, { on: S.fanOn ?? 1 }); c.restore(); }
  // blue night lamps down the wall
  for (let i = 0; i < 5; i++) { const p = AP(1.04, -0.92, 1.0 + i * 3.0), s = 1 / (1.0 + i * 3.0); c.save(); c.globalCompositeOperation = 'screen'; ellipseGlow(c, p[0], p[1], 150 * s + 20, 150 * s + 20, 'rgba(70,130,255,A)', 0.75 * (S.lampI ?? 1)); c.restore(); c.fillStyle = 'rgba(160,205,255,0.95)'; c.fillRect(p[0] - 14 * s - 3, p[1] - 6 * s - 2, 28 * s + 6, 12 * s + 4); }
}
const lerpv = (a, b, k) => a + (b - a) * k;
const clampLag = (k) => 0.15 + 0.7 * k;
const shade2 = (hex, k) => { const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`; };
export function aisleFore(c, S) { // near berth post + chain at left, curtain edge at right (out of focus)
  steelBar(c, 40, -60, 40, 2000, 52, '#2f3a42'); chain(c, 150, -40, 1200, { sway: Math.sin(S.t * 1.1) * 0.7, link: 54, w: 24, col: '#6b7a85' });
  curtain(c, 880, -40, 260, 2100, { col: '#2a1824', hi: '#5a3348', t: S.t, seed: 5, sway: 0.8, folds: 5 });
}

// ============================================================================================================
// berth row: lateral track along the berths. Bay period BP; sleepers with one dangling hand each, each holding a ticket.
// ============================================================================================================
export const BP = 900;
export function rowBack(c, b, S) {
  c.fillStyle = vgrad(c, 0, 1920, [[0, '#18221f'], [0.5, '#2b3836'], [1, '#101716']]); c.fillRect(b.x0 - 4, -20, b.w + 8, 2000); tex(c, 'plaster', [b.x0, 0, b.w, 1920], { alpha: 0.5, seed: 8, scale: 1.4, tint: '#9ab' });
  const i0 = Math.floor(b.x0 / BP) - 1, i1 = Math.ceil(b.x1 / BP) + 1;
  for (let i = i0; i <= i1; i++) {
    const x = i * BP; steelBar(c, x, -20, x, 1960, 34, '#313c45');
    // window with bars between the berth stacks (cold light, the tube still out)
    c.fillStyle = '#0a1018'; rr(c, x + 160, 330, 320, 420, 14); c.fill(); c.fillStyle = vgrad(c, 330, 750, [[0, '#0b1424'], [1, '#18283f']]); c.fillRect(x + 172, 342, 296, 396);
    for (let k = 0; k < 5; k++) steelBar(c, x + 190 + k * 62, 336, x + 190 + k * 62, 744, 12, '#3a4650');
    c.fillStyle = 'rgba(70,130,255,0.9)'; rr(c, x + 640, 300, 70, 34, 10); c.fill(); c.save(); c.globalCompositeOperation = 'screen'; ellipseGlow(c, x + 675, 317, 260, 260, 'rgba(70,130,255,A)', 0.6); c.restore();
  }
}
const SKIN_DIM = '#8a7260';
export function rowBerths(c, b, S) {
  const i0 = Math.floor(b.x0 / BP) - 1, i1 = Math.ceil(b.x1 / BP) + 1, r0 = mulberry32(9);
  const hands = [];
  for (let i = i0; i <= i1; i++) for (let lvl = 0; lvl < 2; lvl++) {
    const x = i * BP + (lvl ? 40 : -60), y = lvl ? 1330 : 600, r = mulberry32(i * 13 + lvl * 7 + 100), col = ['#5a2a3a', '#2a3f66', '#4a4a2a', '#3a2a55', '#2d5a52'][(i * 2 + lvl + 40) % 5];
    // berth: rexine edge, mattress, blanket lump with a head on a pillow
    rexineRect(c, x - 40, y + 30, BP - 60, 130, { r: 14, seams: 3, seed: i + lvl * 3 + 2 });
    c.fillStyle = '#0a1013'; c.fillRect(x - 40, y + 150, BP - 60, 40);
    c.fillStyle = shade2(col, 0.62); c.beginPath(); c.moveTo(x - 20, y + 34); c.bezierCurveTo(x + 20, y - 150 - r() * 30, x + 330, y - 190 - r() * 30, x + 520, y - 120); c.bezierCurveTo(x + 640, y - 90, x + 720, y - 40, x + 790, y + 34); c.closePath(); c.fill();
    c.save(); c.clip(); tex(c, 'fabric', [x - 20, y - 220, 830, 270], { alpha: 0.7, scale: 1.0, seed: i + 30 }); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 4; for (let f = 0; f < 5; f++) { c.beginPath(); c.moveTo(x + 80 + f * 130, y - 160 + f * 10); c.quadraticCurveTo(x + 100 + f * 130, y - 60, x + 70 + f * 130, y + 30); c.stroke(); } c.restore();
    c.fillStyle = '#4a4e52'; c.beginPath(); c.ellipse(x + 90, y - 110, 100, 62, -0.1, 0, TAU); c.fill(); c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.ellipse(x + 70, y - 120, 56, 34, -0.1, 0, TAU); c.fill(); // head turned away under the blanket edge
    hands.push({ x: x + 500 + (r() - 0.5) * 80, y: y + 30, lvl, r: r(), i });
  }
  return hands;
}
// dangling arm + hand + the same yellow ticket. t drives the slow sway; glow rises with S.escal (0..1)
export function dangleHand(c, h, S) {
  const sway = Math.sin(S.t * 1.3 + h.r * 6) * 0.05, x = h.x, y = h.y, L = 150 + h.r * 20;
  c.save(); c.translate(x, y); c.rotate(sway); c.scale(1.35, 1.35);
  // sleeve hanging over the edge, then forearm and hand
  const g = c.createLinearGradient(-40, 0, 40, 0); g.addColorStop(0, '#b9b09a'); g.addColorStop(1, '#4a4638'); c.fillStyle = g; c.beginPath(); c.moveTo(-44, -20); c.quadraticCurveTo(-52, 70, -38, 140); c.lineTo(38, 140); c.quadraticCurveTo(52, 70, 44, -20); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3; c.stroke();
  const sg = c.createLinearGradient(-26, 0, 26, 0); sg.addColorStop(0, '#8a7260'); sg.addColorStop(1, '#3a2c22'); c.fillStyle = sg; c.beginPath(); c.moveTo(-26, 130); c.lineTo(-22, 130 + L * 0.55); c.lineTo(22, 130 + L * 0.55); c.lineTo(26, 130); c.closePath(); c.fill();
  // hand: palm + curled fingers + thumb
  c.translate(0, 130 + L * 0.55); c.fillStyle = sg; c.beginPath(); c.moveTo(-24, 0); c.quadraticCurveTo(-34, 50, -22, 86); c.lineTo(22, 86); c.quadraticCurveTo(34, 50, 24, 0); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2; c.stroke();
  for (let f = 0; f < 4; f++) { const fx = -19 + f * 12.7, fl = 52 + (f === 1 || f === 2 ? 8 : 0) - (f === 3 ? 8 : 0); c.beginPath(); c.moveTo(fx, 78); c.quadraticCurveTo(fx + 2 + sway * 20, 78 + fl * 0.7, fx - 2, 78 + fl); c.lineWidth = 11; c.lineCap = 'round'; c.strokeStyle = '#3a2c22'; c.stroke(); c.lineWidth = 8; c.strokeStyle = sg; c.stroke(); }
  // ticket pinched between thumb and fingers
  const a = S.escal ?? 0; c.save(); c.translate(-4, 80); c.rotate(-0.12 + sway * 2); c.shadowColor = `rgba(255,200,70,${0.2 + 0.5 * a})`; c.shadowBlur = 18 + 24 * a; drawTicket(c, -64, -4, 140, 92, { age: 1, seed: h.i + h.lvl, fade: 0.9 }); c.restore();
  c.restore();
}
