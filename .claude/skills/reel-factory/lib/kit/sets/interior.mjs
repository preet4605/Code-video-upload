// sets/interior: corridor, stairwell, room, haveli arcade (parameter sets on tunnel.mjs).
import { cin, cl, lerp, mix, shade, rgba, mulberry32, Path2D, smoothClosed, ribbon, stains, surface, TAU, DW, DH } from '../util.mjs';
import { quadPath, bbox, aoStrip, edgeLight } from './core.mjs';
import { archPath, diya } from './parts.mjs';
import { buildTunnel, UPM, jambFg, wq } from './tunnel.mjs';

const opt = (o, k, d) => (o && o[k] !== undefined ? o[k] : d);
const winLight = (G, side, z, w, sill, h, color, intensity) => { // screen-ish rect of a wall window for darkMask
  const { P, W0, Hf } = G, X = side * W0, a = P(X, Hf - sill * UPM - h * UPM, z - w / 2), b = P(X, Hf - sill * UPM, z + w / 2);
  return { id: `win${z}`, kind: 'window', type: 'window', x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]), depth: 1, color, intensity, throw: 520, throwX: side * -260, reach: 700 };
};

// ============================================================ corridor / hallway
export function corridor(o = {}) {
  const variant = opt(o, 'variant', 'hostel');
  const V = {
    hostel: { palette: 'green', dado: '#4f7a62', door: '#6a4a2c', lamps: [2.1, 4.5, 7.0], endLight: true },
    school: { palette: 'cream', dado: '#6b4a2a', door: '#3f2a1a', lamps: [2.4, 5.2], endLight: false },
    hospital: { palette: 'grey', dado: '#5d7f8c', door: '#7d8f98', lamps: [2.0, 4.2, 6.6], endLight: true },
  }[variant] ?? {};
  const def = {
    name: 'corridor', palette: opt(o, 'palette', V.palette), W0: 1.15 * UPM, zEnd: 9, n: 6, vpY: 850, wear: 0.55,
    style: { left: 'plain', right: 'plain', dado: V.dado, dadoH: 330, tile: 0.6, checker: variant !== 'school', frames: variant === 'school' ? 'wood' : null, frameW: 0.16, beamH: 0.22, fog: 0.8 },
    end(c, G, S, st, t) {
      const { P, Hf } = G, zE = G.zEnd, w = 0.55 * UPM, tl = P(-w, Hf - 2.0 * UPM, zE), br = P(w, Hf, zE);
      if (V.endLight) { c.fillStyle = '#fff2c4'; c.fillRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]); const g = c.createRadialGradient((tl[0] + br[0]) / 2, (tl[1] + br[1]) / 2, 0, (tl[0] + br[0]) / 2, (tl[1] + br[1]) / 2, 90); g.addColorStop(0, rgba('#fff', 0.6)); g.addColorStop(1, rgba('#fff', 0)); c.fillStyle = g; c.fillRect(tl[0] - 90, tl[1] - 90, br[0] - tl[0] + 180, br[1] - tl[1] + 180); }
      else { c.fillStyle = '#020202'; c.fillRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]); }
      c.strokeStyle = rgba('#000', 0.7); c.lineWidth = 3; c.strokeRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);
    },
    items({ G, S, r, lights, pal }) {
      const items = [];
      [2.3, 4.6, 7.0].forEach((z, i) => items.push({ type: 'door', side: -1, z: z + (r() - 0.5) * 0.3, number: 101 + i * 2 + Math.round(r() * 3), color: V.door, lightStrip: i === 1 && variant !== 'school', open: false }));
      [1.9, 3.9, 6.1].forEach((z, i) => items.push({ type: 'window', side: 1, z, w: 1.0, h: 1.3, sill: 0.9, moon: i === 0, curtain: i === 1 ? '#7a2e2e' : null }));
      V.lamps.forEach((z, i) => items.push({ type: 'lamp', z, kind: variant === 'school' ? 'bulb' : 'tube', flicker: i === 1, on: i === 2 && V.lamps.length > 2 ? 0 : 1, seed: S.seed + i, dz: 0.03 }));
      // notice board between the windows
      items.push({ id: 'board', type: 'board', z: 5.0, dz: 0.05, draw(c, G2, S2) { const { P, W0, Hf } = G2, X = W0 - 3, q = [P(X, Hf - 1.9 * UPM, 4.55), P(X, Hf - 1.9 * UPM, 5.45), P(X, Hf - 1.0 * UPM, 5.45), P(X, Hf - 1.0 * UPM, 4.55)]; c.fillStyle = '#6e5538'; c.fill(quadPath(q)); const inner = [P(X, Hf - 1.85 * UPM, 4.6), P(X, Hf - 1.85 * UPM, 5.4), P(X, Hf - 1.05 * UPM, 5.4), P(X, Hf - 1.05 * UPM, 4.6)]; c.fillStyle = '#9b8456'; c.fill(quadPath(inner)); for (let k = 0; k < 5; k++) { const z0 = 4.65 + (k % 3) * 0.26, y0 = Hf - (1.78 - Math.floor(k / 3) * 0.42) * UPM, pq = [P(X, y0, z0), P(X, y0, z0 + 0.2), P(X, y0 + 0.28 * UPM, z0 + 0.2), P(X, y0 + 0.28 * UPM, z0)]; c.fillStyle = ['#e8e2d0', '#d8c9a0', '#cfd8dc'][k % 3]; c.fill(quadPath(pq)); } } });
      // ceiling pipe run
      items.push({ id: 'pipe', type: 'pipe', z: 4.2, dz: -3.8, draw(c, G2) { const { P, Hc } = G2; c.strokeStyle = '#2b2b2d'; for (const [X, w] of [[-0.8 * UPM, 20], [-0.7 * UPM, 12]]) { const a = P(X, -Hc + 70, 0.5), b = P(X, -Hc + 70, 9); c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.strokeStyle = rgba('#fff', 0.12); c.lineWidth = w * 0.25; c.beginPath(); c.moveTo(a[0], a[1] - w * 0.2); c.lineTo(b[0], b[1] - w * 0.2); c.stroke(); c.strokeStyle = '#2b2b2d'; } } });
      return items;
    },
    lights({ G, items, S }) {
      const { P, Hc } = G, out = [];
      for (const it of items) {
        if (it.type === 'lamp' && it.on !== 0) { const p = P(0, -Hc, it.z); out.push({ id: `lamp${it.z}`, kind: 'lamp', type: 'point', x: p[0], y: p[1] + 80, depth: 1, r: 470, color: S.palette.tod === 'night' ? '#cfe6ff' : '#ffe9c0', intensity: 0.62, flicker: it.flicker ? 0.35 : 0.03, seed: it.seed }); }
        if (it.type === 'window') out.push(winLight(G, it.side, it.z, it.w, it.sill, it.h, '#7f97e0', 0.6));
        if (it.type === 'door' && it.lightStrip) { const a = G.P(-G.W0, G.Hf - 2.05 * UPM, it.z - 0.5), b = G.P(-G.W0, G.Hf, it.z + 0.5); out.push({ id: 'doorstrip', kind: 'door', type: 'door', x: a[0], y: a[1], w: Math.abs(b[0] - a[0]), h: b[1] - a[1], depth: 1, color: '#ffd58a', intensity: 0.8, spill: 360 }); }
      }
      if (V.endLight) { const a = G.P(-0.55 * UPM, G.Hf - 2.0 * UPM, G.zEnd), b = G.P(0.55 * UPM, G.Hf, G.zEnd); out.push({ id: 'end', kind: 'door', type: 'door', x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1], depth: 1, color: '#fff0c0', intensity: 0.9, spill: 600 }); }
      return out;
    },
    foreground({ pal, S }) { return [{ id: 'fg-jamb', depth: 0.55, blur: 7, draw: jambFg(-1, pal, S.seed, { w: 170, color: pal.wood }) }, { id: 'fg-cable', depth: 0.7, blur: 5, draw(c, b) { c.strokeStyle = rgba('#060606', 0.95); c.lineCap = 'round'; c.lineWidth = 7; c.beginPath(); c.moveTo(DW + 40, 160); c.bezierCurveTo(820, 300, 560, 140, 240, 260); c.stroke(); c.lineWidth = 6; c.beginPath(); c.moveTo(DW + 40, 240); c.bezierCurveTo(840, 380, 600, 230, 300, 350); c.stroke(); } }]; },
  };
  return buildTunnel(o, def);
}

// ============================================================ stairwell
export function stairwell(o = {}) {
  const variant = opt(o, 'variant', 'flats'), N = 12, rise = 0.17 * UPM, run = 0.3, z0 = 1.25;
  const def = {
    name: 'stairwell', palette: opt(o, 'palette', variant === 'flats' ? 'ochre' : 'blue'), W0: 0.95 * UPM, Hc: 1700, zEnd: z0 + N * run + 1.0, n: 5, z0: 1.0, vpY: 800, wear: 0.6,
    style: { left: 'plain', right: 'plain', dado: variant === 'flats' ? '#6d3b22' : '#35505f', dadoH: 360, fog: 0.9, floor: '#3a352f', tile: 0.5 },
    end(c, G, S, st, t) {
      const { P, Hf } = G, zE = G.zEnd, y = Hf - N * rise, w = 0.8 * UPM, tl = P(-w, y - 2.1 * UPM, zE), br = P(w, y, zE);
      // landing: a window with a hard shaft of light and a door
      const win = P(-0.2 * UPM, y - 1.9 * UPM, zE), win2 = P(0.5 * UPM, y - 0.9 * UPM, zE); c.fillStyle = S.palette.tod === 'night' ? '#31416e' : '#fff6dc'; c.fillRect(win[0], win[1], win2[0] - win[0], win2[1] - win[1]); c.strokeStyle = '#120e0a'; c.lineWidth = 5; c.strokeRect(win[0], win[1], win2[0] - win[0], win2[1] - win[1]); c.beginPath(); c.moveTo((win[0] + win2[0]) / 2, win[1]); c.lineTo((win[0] + win2[0]) / 2, win2[1]); c.stroke();
    },
    items({ G, S, r, pal }) {
      const items = [], { P, W0, Hf } = G;
      for (let i = N - 1; i >= 0; i--) {
        const za = z0 + i * run, zb = za + run, y = Hf - (i + 1) * rise, yPrev = Hf - i * rise;
        items.push({ id: `step${i}`, type: 'step', z: za + 0.001, dz: 0.001, draw(c, G2, S2) {
          const tread = [P(-W0, y, za), P(W0, y, za), P(W0, y, zb), P(-W0, y, zb)], riser = [P(-W0, yPrev, za), P(W0, yPrev, za), P(W0, y, za), P(-W0, y, za)];
          const night = S2.palette.tod === 'night';
          surface(c, quadPath(tread), bbox(tread), { color: night ? '#3d3a35' : '#8a8478', tex: 'stone', texA: 0.5, scale: 0.8 / za, seed: S2.seed + 50 + i, wear: S2.wear, stain: '#100c08' });
          surface(c, quadPath(riser), bbox(riser), { color: night ? '#2a2723' : '#6a645a', tex: 'plaster', texA: 0.5, scale: 0.8 / za, seed: S2.seed + 70 + i, wear: S2.wear, stain: '#100c08' });
          edgeLight(c, P(-W0, y, za), P(W0, y, za), '#fff', Math.max(2, 5 / za), 0.55);       // lit nosing
          aoStrip(c, P(-W0, y, zb), P(W0, y, zb), [0, -1], 70 / zb, 0.4);                        // occluded inner corner of each step
          // worn centre, chipped corners
          c.save(); c.clip(quadPath(tread)); const m = P(0, y, (za + zb) / 2), g = c.createRadialGradient(m[0], m[1], 0, m[0], m[1], 260 / za); g.addColorStop(0, rgba('#fff', 0.1)); g.addColorStop(1, rgba('#fff', 0)); c.fillStyle = g; c.fillRect(m[0] - 300, m[1] - 100, 600, 200); c.restore();
        } });
      }
      // railing on the right: posts and a sloped handrail
      const X = W0 - 0.14 * UPM;
      for (let i = 0; i < N; i += 1) {
        const za = z0 + i * run + 0.15, y = Hf - (i + 1) * rise;
        items.push({ id: `post${i}`, type: 'post', z: za, dz: -0.1, draw(c, G2) { const a = P(X, y, za), b = P(X, y - 0.95 * UPM, za); c.strokeStyle = '#1b1a1c'; c.lineWidth = Math.max(2, 14 / za); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.strokeStyle = rgba('#fff', 0.2); c.lineWidth = Math.max(1, 4 / za); c.beginPath(); c.moveTo(a[0] - 2 / za, a[1]); c.lineTo(b[0] - 2 / za, b[1]); c.stroke(); if (i === N - 1 || i === 0) return; const nz = za + run, ny = Hf - (i + 2) * rise, a2 = P(X, y - 0.95 * UPM, za), b2 = P(X, ny - 0.95 * UPM, nz); c.strokeStyle = '#2b2a2c'; c.lineWidth = Math.max(3, 20 / za); c.beginPath(); c.moveTo(a2[0], a2[1]); c.lineTo(b2[0], b2[1]); c.stroke(); c.strokeStyle = rgba('#fff', 0.3); c.lineWidth = Math.max(1, 5 / za); c.beginPath(); c.moveTo(a2[0] - 3, a2[1] - 4 / za); c.lineTo(b2[0] - 3, b2[1] - 4 / za); c.stroke(); } });
      }
      // wall light on the left at mid-height + graffiti stain
      items.push({ id: 'sconce', type: 'lamp2', z: 3.2, dz: 0.2, draw(c, G2, S2, t) { const p = P(-W0 + 6, Hf - 2.2 * UPM + 3.2 * rise * 0.6, 3.2), s = Math.max(10, 70 / 3.2); c.fillStyle = '#1a1a18'; c.fillRect(p[0] - s * 0.3, p[1] - s * 0.5, s * 0.6, s); c.fillStyle = rgba('#ffe7a8', 0.95); c.fillRect(p[0] - s * 0.18, p[1] - s * 0.4, s * 0.36, s * 0.8); } });
      return items;
    },
    lights({ G, S }) { const { P, W0, Hf } = G, p = P(-W0 + 20, Hf - 2.2 * UPM + 3.2 * rise * 0.6, 3.2), y = Hf - N * rise; const a = G.P(-0.2 * UPM, y - 1.9 * UPM, G.zEnd), b = G.P(0.5 * UPM, y - 0.9 * UPM, G.zEnd); return [{ id: 'sconce', kind: 'lamp', type: 'point', x: p[0] + 40, y: p[1], depth: 1, r: 430, color: '#ffcf86', intensity: 0.8, flicker: 0.05, seed: 4 }, { id: 'landing', kind: 'window', type: 'window', x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1], depth: 1, color: '#9fb4ff', intensity: 0.5, throw: 520, throwX: 200, reach: 640 }]; },
    foreground({ pal, S }) { return [{ id: 'fg-rail', depth: 0.6, blur: 7, draw(c, b) { c.strokeStyle = '#0a0a0b'; c.lineCap = 'round'; c.lineWidth = 28; c.beginPath(); c.moveTo(-40, 1560); c.lineTo(420, 1500); c.stroke(); c.lineWidth = 16; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(40 + i * 110, 1540 - i * 14); c.lineTo(40 + i * 110, 1960); c.stroke(); } c.strokeStyle = rgba('#fff', 0.22); c.lineWidth = 5; c.beginPath(); c.moveTo(-40, 1548); c.lineTo(420, 1488); c.stroke(); } }, { id: 'fg-jamb', depth: 0.55, blur: 8, draw: jambFg(1, pal, S.seed, { w: 120 }) }]; },
  };
  return buildTunnel(o, def);
}

// ============================================================ room (bed, window with moon, door with light strip)
export function room(o = {}) {
  const variant = opt(o, 'variant', 'bedroom');
  const def = {
    name: 'room', palette: opt(o, 'palette', variant === 'bedroom' ? 'blue' : 'pink'), W0: 1.7 * UPM, Hc: 880, zEnd: 5.4, n: 3, z0: 1.0, vpY: 880, wear: opt(o, 'wear', 0.4),
    style: { left: 'plain', right: 'plain', dado: null, fog: 0.4, floor: '#4a3a2c', floorTex: 'wood', tile: 0.9, endColor: null },
    end(c, G, S, st, t) {
      const { P, Hf } = G, zE = G.zEnd, night = S.palette.tod === 'night';
      // door (left of centre) with a light strip underneath, clock above, a calendar
      const dx = -0.9 * UPM, dw = 0.9 * UPM, dh = 2.0 * UPM, tl = P(dx, Hf - dh, zE), br = P(dx + dw, Hf, zE);
      c.fillStyle = shade(S.palette.wood, -0.15); c.fillRect(tl[0] - 14, tl[1] - 14, br[0] - tl[0] + 28, br[1] - tl[1] + 14);
      surface(c, quadPath([tl, [br[0], tl[1]], br, [tl[0], br[1]]]), [tl[0], tl[1], br[0], br[1]], { color: night ? shade(S.palette.wood, -0.1) : S.palette.wood, tex: 'wood', texA: 0.7, scale: 0.4, seed: S.seed + 61, wear: 0.4, stain: '#0e0804' });
      c.strokeStyle = rgba('#000', 0.45); c.lineWidth = 3; for (const [a, b, d, e] of [[0.1, 0.1, 0.9, 0.45], [0.1, 0.55, 0.9, 0.9]]) c.strokeRect(tl[0] + (br[0] - tl[0]) * a, tl[1] + (br[1] - tl[1]) * b, (br[0] - tl[0]) * (d - a), (br[1] - tl[1]) * (e - b));
      c.fillStyle = '#c6b27a'; c.beginPath(); c.arc(br[0] - 14, tl[1] + (br[1] - tl[1]) * 0.5, 7, 0, TAU); c.fill();
      c.fillStyle = '#ffd58a'; c.fillRect(tl[0] + 3, br[1] - 5, br[0] - tl[0] - 6, 5); c.globalCompositeOperation = 'screen'; const sg = c.createLinearGradient(0, br[1], 0, br[1] + 70); sg.addColorStop(0, rgba('#ffd58a', 0.5)); sg.addColorStop(1, rgba('#ffd58a', 0)); c.fillStyle = sg; c.fillRect(tl[0] - 20, br[1], br[0] - tl[0] + 40, 70); c.globalCompositeOperation = 'source-over';
      // wall clock
      const ck = P(0.6 * UPM, Hf - 1.9 * UPM, zE), cr = 0.2 * UPM / zE * 1.0 * 3.2; c.fillStyle = '#e9e2cf'; c.beginPath(); c.arc(ck[0], ck[1], cr, 0, TAU); c.fill(); c.strokeStyle = '#2a2018'; c.lineWidth = 5; c.stroke(); c.lineWidth = 4; c.beginPath(); c.moveTo(ck[0], ck[1]); c.lineTo(ck[0], ck[1] - cr * 0.7); c.moveTo(ck[0], ck[1]); c.lineTo(ck[0] + cr * 0.45, ck[1] + cr * 0.1); c.stroke();
      // framed picture
      const f = P(1.1 * UPM, Hf - 1.6 * UPM, zE), f2 = P(1.7 * UPM, Hf - 0.9 * UPM, zE); c.fillStyle = '#2a1d12'; c.fillRect(f[0], f[1], f2[0] - f[0], f2[1] - f[1]); c.fillStyle = night ? '#4a5a7a' : '#9aa7b8'; c.fillRect(f[0] + 8, f[1] + 8, f2[0] - f[0] - 16, f2[1] - f[1] - 16);
    },
    items({ G, S, r }) {
      const items = [], { P, W0, Hf } = G;
      items.push({ type: 'window', side: 1, z: 3.1, w: 1.5, h: 1.45, sill: 0.95, moon: true, curtain: opt(o, 'curtain', '#6b3a4a'), dz: 0.05 });
      items.push({ id: 'bed', type: 'bed', z: 3.3, dz: 0.0, draw(c, G2, S2, t) {
        const night = S2.palette.tod === 'night', X0 = -W0 + 0.08 * UPM, X1 = -W0 + 1.15 * UPM, za = 2.0, zb = 4.6, top = Hf - 0.56 * UPM, base = Hf - 0.25 * UPM;
        const rect = (q, col, tex) => { c.fillStyle = col; c.fill(quadPath(q)); };
        const blanket = S2.palette.accent, sheet = night ? shade('#d8d0c4', -0.2) : '#d8d0c4';
        // frame legs + side panel (facing the room) + foot panel + mattress top
        rect([P(X1, Hf, za), P(X1, Hf, zb), P(X1, base, zb), P(X1, base, za)], shade(S2.palette.wood, -0.2));
        rect([P(X0, base, za), P(X1, base, za), P(X1, Hf, za), P(X0, Hf, za)], shade(S2.palette.wood, -0.35));
        const side = [P(X1, base, za), P(X1, base, zb), P(X1, top, zb), P(X1, top, za)]; rect(side, sheet);
        const foot = [P(X0, base, za), P(X1, base, za), P(X1, top, za), P(X0, top, za)]; rect(foot, shade(sheet, -0.12));
        const topq = [P(X0, top, za), P(X1, top, za), P(X1, top, zb), P(X0, top, zb)]; surface(c, quadPath(topq), bbox(topq), { color: night ? shade(blanket, -0.25) : blanket, tex: 'fabric', texA: 0.4, scale: 0.8 / za, seed: S2.seed + 81, wear: 0.1 });
        // blanket folds as lines converging along the bed, a pillow, a sleeping mound
        c.strokeStyle = rgba('#000', 0.28); c.lineWidth = Math.max(2, 5 / za); for (const k of [0.25, 0.5, 0.75]) { const a = P(lerp(X0, X1, k), top, za), b = P(lerp(X0, X1, k), top, zb); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
        const pil = [P(X0 + 0.1 * UPM, top - 0.07 * UPM, 4.1), P(X1 - 0.1 * UPM, top - 0.07 * UPM, 4.1), P(X1 - 0.1 * UPM, top, 4.55), P(X0 + 0.1 * UPM, top, 4.55)]; c.fillStyle = night ? shade('#e8e2d6', -0.25) : '#e8e2d6'; c.fill(smoothClosed(pil)); c.strokeStyle = rgba('#000', 0.3); c.lineWidth = 3; c.stroke(smoothClosed(pil));
        const headA = P(X0, Hf, zb), headB = P(X1, Hf - 1.0 * UPM, zb); c.fillStyle = shade(S2.palette.wood, -0.25); c.fillRect(headA[0], headB[1], headB[0] - headA[0], headA[1] - headB[1]);
        c.fillStyle = rgba('#fff', 0.15); c.fillRect(headA[0], headB[1], 4, headA[1] - headB[1]);
        aoStrip(c, P(X0, Hf, za), P(X1, Hf, za), [0, 1], 40, 0.5);
        const sh = quadPath([P(X1, Hf, za), P(X1 + 0.6 * UPM, Hf, za + 0.1), P(X1 + 0.6 * UPM, Hf, zb + 0.1), P(X1, Hf, zb)]); c.fillStyle = rgba('#000', 0.3); c.fill(sh);
      } });
      items.push({ id: 'rug', type: 'rug', z: 3.0, dz: 0.5, draw(c, G2, S2) { const q = [P(-0.5 * UPM, Hf, 2.0), P(0.9 * UPM, Hf, 2.0), P(0.9 * UPM, Hf, 3.9), P(-0.5 * UPM, Hf, 3.9)]; c.fillStyle = shade(S2.palette.accent, -0.25); c.fill(quadPath(q)); c.strokeStyle = rgba('#e6c97a', 0.6); c.lineWidth = 4; const q2 = [P(-0.42 * UPM, Hf, 2.1), P(0.82 * UPM, Hf, 2.1), P(0.82 * UPM, Hf, 3.8), P(-0.42 * UPM, Hf, 3.8)]; c.stroke(quadPath(q2)); } });
      return items;
    },
    lights({ G, items, S }) {
      const w = items.find((i) => i.type === 'window'), out = [winLight(G, 1, w.z, w.w, w.sill, w.h, '#8aa2ff', 0.85)];
      const a = G.P(-0.9 * UPM, G.Hf - 2.0 * UPM, G.zEnd), b = G.P(0, G.Hf, G.zEnd); out.push({ id: 'doorstrip', kind: 'door', type: 'door', x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1], depth: 1, color: '#ffd58a', intensity: 0.85, spill: 500 });
      const bl = G.P(-1.0 * UPM, G.Hf - 0.9 * UPM, 2.8); out.push({ id: 'bedside', kind: 'lamp', type: 'point', x: bl[0], y: bl[1], depth: 1, r: 420, color: '#ffbf7a', intensity: 0.55, flicker: 0.03, seed: 5 });
      return out;
    },
    foreground({ pal, S }) { return [{ id: 'fg-post', depth: 0.58, blur: 8, draw(c, b) { const g = c.createLinearGradient(DW - 200, 0, DW + 40, 0); g.addColorStop(0, shade(pal.wood, -0.1)); g.addColorStop(0.6, shade(pal.wood, -0.45)); g.addColorStop(1, '#050302'); c.fillStyle = g; c.fillRect(DW - 190, b.y0, 260, b.h); c.fillStyle = rgba('#fff', 0.25); c.fillRect(DW - 190, b.y0, 5, b.h); c.fillStyle = shade(pal.wood, -0.3); c.beginPath(); c.arc(DW - 60, 640, 62, 0, TAU); c.fill(); c.fillStyle = rgba('#fff', 0.18); c.beginPath(); c.arc(DW - 85, 615, 20, 0, TAU); c.fill(); } }]; },
  };
  return buildTunnel(o, def);
}

// ============================================================ haveli corridor with jharokha windows
export function haveliCorridor(o = {}) {
  const variant = opt(o, 'variant', 'day'), tod = opt(o, 'tod', variant === 'day' ? 'noon' : 'night');
  const def = {
    name: 'haveliCorridor', tod, palette: opt(o, 'palette', variant === 'day' ? 'ochre' : 'pink'), W0: 1.25 * UPM, Hc: 880, zEnd: 9.5, n: 6, z0: 1.0, vpY: 860, wear: opt(o, 'wear', 0.5), forceMask: false,
    style: { left: 'arcade', right: 'plain', dado: null, arch: 1.55, fog: 0.5, floor: '#b49a74', tile: 0.5, checker: true, wallColor: {} },
    end(c, G, S, st, t) {
      const { P, Hf } = G, zE = G.zEnd, night = S.palette.tod === 'night', tl = P(-0.7 * UPM, Hf - 2.4 * UPM, zE), br = P(0.7 * UPM, Hf, zE), p = archPath(tl[0], br[0], br[1], tl[1]);
      c.fillStyle = night ? '#101a30' : '#fff7e2'; c.fill(p); c.strokeStyle = rgba('#000', 0.6); c.lineWidth = 4; c.stroke(p);
    },
    items({ G, S, r, pal }) {
      const { P, W0, Hf } = G, items = [], night = pal.tod === 'night';
      // pillars between arches (left wall)
      for (let za = 1.55; za < 9.2; za += 1.55) items.push({ id: `pillar${za.toFixed(1)}`, type: 'pillar', z: za, dz: -0.18, draw(c, G2, S2) {
        const X = -W0 + 2, w = 0.3 * UPM / za, a = P(X + 0.18 * UPM, Hf, za), b = P(X + 0.18 * UPM, Hf - 2.25 * UPM, za), x = a[0];
        const g = c.createLinearGradient(x - w, 0, x + w, 0); const col = night ? shade(pal.wall, -0.5) : pal.wall;
        g.addColorStop(0, shade(col, -0.45)); g.addColorStop(0.35, shade(col, 0.1)); g.addColorStop(0.7, shade(col, -0.1)); g.addColorStop(1, shade(col, -0.55)); c.fillStyle = g; c.fillRect(x - w, b[1], w * 2, a[1] - b[1]);
        c.fillStyle = shade(col, -0.2); c.fillRect(x - w * 1.35, b[1] - w * 0.5, w * 2.7, w * 0.8); c.fillRect(x - w * 1.3, a[1] - w * 0.6, w * 2.6, w * 0.6); c.fillStyle = rgba('#000', 0.3); c.fillRect(x - w * 1.35, b[1] + w * 0.3, w * 2.7, w * 0.15);
      } });
      // jharokha windows on the right wall + niches
      [2.7, 5.6].forEach((z, i) => items.push({ id: `jharokha${i}`, type: 'jharokha', z, dz: 0.05, draw(c, G2, S2, t) {
        const X = W0 - 2, depth = 0.34 * UPM, Xf = W0 - depth, za = z - 0.62, zb = z + 0.62, y0 = Hf - 0.95 * UPM, y1 = Hf - 2.15 * UPM, col = night ? shade(pal.wall2, -0.45) : pal.wall2;
        // side face of the box (perspective), the front face, a canopy and brackets
        const sideQ = [P(X, y0, za), P(Xf, y0, za), P(Xf, y1, za), P(X, y1, za)], frontQ = [P(Xf, y0, za), P(Xf, y0, zb), P(Xf, y1, zb), P(Xf, y1, za)];
        c.fillStyle = shade(col, -0.25); c.fill(quadPath(sideQ));
        surface(c, quadPath(frontQ), bbox(frontQ), { color: col, tex: 'plaster', texA: 0.5, scale: 1 / z, seed: S2.seed + 90 + i, wear: S2.wear * 0.5, stain: '#2a2016' });
        // arched openings with jaali lattice, bright behind
        for (let k = 0; k < 3; k++) { const a = lerp(za + 0.1, zb - 0.1, k / 3 + 0.02), b = lerp(za + 0.1, zb - 0.1, (k + 1) / 3 - 0.02), pts = [P(Xf - 2, y0 - 0.12 * UPM, a), P(Xf - 2, y0 - 0.12 * UPM, b)]; for (let j = 0; j <= 10; j++) { const u = j / 10; pts.push(P(Xf - 2, y1 + 0.25 * UPM - Math.sin(Math.PI * u) * 0.25 * UPM, lerp(b, a, u))); } const path = quadPath(pts); c.save(); c.fillStyle = night ? '#d9a050' : '#fff4d0'; c.fill(path); c.clip(path); c.strokeStyle = rgba('#3a2a18', 0.75); c.lineWidth = Math.max(1.2, 3.2 / z); for (let q = -8; q <= 16; q++) { const u = q / 8, A = P(Xf - 2, y1, lerp(a, b, u)), B = P(Xf - 2, y0, lerp(a, b, u + 0.5)), C = P(Xf - 2, y0, lerp(a, b, u - 0.5)); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.moveTo(A[0], A[1]); c.lineTo(C[0], C[1]); c.stroke(); } c.restore(); c.strokeStyle = rgba('#000', 0.6); c.lineWidth = Math.max(2, 5 / z); c.stroke(path); }
        // canopy (chhajja) and corbel brackets below
        const can = [P(Xf - 0.1 * UPM, y1 - 0.06 * UPM, za - 0.15), P(Xf - 0.1 * UPM, y1 - 0.06 * UPM, zb + 0.15), P(Xf - 0.1 * UPM, y1 - 0.22 * UPM, zb + 0.05), P(Xf - 0.1 * UPM, y1 - 0.22 * UPM, za - 0.05)]; c.fillStyle = shade(col, -0.1); c.fill(quadPath(can)); edgeLight(c, can[0], can[1], '#fff', 3, 0.5);
        for (let k = 0; k < 4; k++) { const zk = lerp(za + 0.1, zb - 0.1, k / 3), a = P(Xf, y0, zk), b = P(X + 0.04 * UPM, y0 + 0.28 * UPM, zk); c.strokeStyle = shade(col, -0.35); c.lineWidth = Math.max(3, 14 / z); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
        edgeLight(c, P(Xf, y0, za), P(Xf, y0, zb), '#fff', 3, 0.4);
      } }));
      // diya niches along the wall
      [1.7, 4.1, 7.0].forEach((z, i) => items.push({ id: `niche${i}`, type: 'niche', z, dz: 0.05, draw(c, G2, S2, t) { const X = W0 - 2, q = [P(X, Hf - 1.4 * UPM, z - 0.22), P(X, Hf - 1.4 * UPM, z + 0.22), P(X, Hf - 1.0 * UPM, z + 0.22), P(X, Hf - 1.0 * UPM, z - 0.22)]; c.fillStyle = '#120c08'; c.fill(quadPath(q)); const m = P(X, Hf - 1.04 * UPM, z); diya(c, m[0], m[1], Math.max(0.15, 0.45 / z), t, { seed: i + 2 }); } }));
      // sun patches on the floor under each arch (day)
      if (!night) for (let za = 1.55; za < 9; za += 1.55) items.push({ id: `sun${za.toFixed(1)}`, type: 'sunpatch', z: za + 0.7, dz: 0.5, draw(c, G2) { const a = za + 0.28, b = za + 1.27, q = [P(-W0, Hf, a), P(-W0 + 1.4 * UPM, Hf, a + 0.45), P(-W0 + 1.4 * UPM, Hf, b + 0.45), P(-W0, Hf, b)]; c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = rgba('#fff0c8', 0.55); c.fill(quadPath(q)); c.restore(); } });
      return items;
    },
    lights({ G, items }) {
      const out = [];
      if (tod === 'night') { const p = G.P(0, -G.Hc + 300, 3.2); out.push({ id: 'lantern', kind: 'lamp', type: 'point', x: p[0], y: p[1], depth: 1, r: 700, color: '#ffc27a', intensity: 0.95, flicker: 0.1, seed: 9 }); out.push({ id: 'courtyard', kind: 'moon', type: 'point', x: 20, y: G.vp.y, depth: 1, r: 900, color: '#6f86d0', intensity: 0.55 }); }
      else out.push({ id: 'sun', kind: 'sun', type: 'sun', dir: [0.8, -0.6], color: '#fff3d0' });
      return out;
    },
    foreground({ pal, S }) { return [{ id: 'fg-pillar', depth: 0.56, blur: 9, draw(c, b) { const x = -10, w = 190, g = c.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, shade(pal.wall, -0.65)); g.addColorStop(0.6, shade(pal.wall, -0.4)); g.addColorStop(1, shade(pal.wall, 0.05)); c.fillStyle = g; c.fillRect(x - w, b.y0, w * 2, b.h); c.save(); c.beginPath(); c.rect(x - w, b.y0, w * 2, b.h); c.clip(); cin.fillTexture(c, 'plaster', [x - w, b.y0, w * 2, b.h], { alpha: 0.5, scale: 1.3, ox: 0, oy: 0, seed: S.seed + 44 }); c.restore(); c.fillStyle = rgba('#fff', 0.45); c.fillRect(x + w - 8, b.y0, 8, b.h); } }]; },
  };
  return buildTunnel(o, def);
}
