// cinema-demo: a rainy-night alley built with lib/cinema. 6 depth planes, ONE motivated light (the street lamp),
// god rays through fog, handheld + slow push-in, film post. Same scene contract as the other examples:
//   VideoClock.setTime(t); VideoClock.draw(ctx, width, height, timeline)
// Fully deterministic: every random value comes from mulberry32 seeds or noise of (seed, t).
import * as cin from '../../lib/cinema/index.mjs';
import { mulberry32 } from '../../lib/scene3d.mjs';
import { Path2D } from '@napi-rs/canvas';

const DUR = 7;
const LAMP = { x: 735, y: 372, depth: 1.3 };       // lamp head, authored coords on its plane
const GROUND_Y = 1560;                              // feet line of the subject
const cam = cin.createCamera({});
let T = 0;

const fillB = (c, b, col) => { c.fillStyle = col; c.fillRect(b.x0, b.y0, b.w, b.h); };

// ---------------- plane 1 (far): sky ----------------
function drawSky(c, b) {
  const g = c.createLinearGradient(0, b.y0, 0, 1250);
  g.addColorStop(0, '#04060c'); g.addColorStop(0.55, '#0d1730'); g.addColorStop(1, '#2a3d63');
  fillB(c, b, g);
  // stars sprite (transparent tile), upper sky only
  c.save(); c.beginPath(); c.rect(b.x0, b.y0, b.w, 1000 - b.y0); c.clip();
  cin.fillTexture(c, 'stars', [b.x0, b.y0, b.w, 1000 - b.y0], { alpha: 0.9, scale: 1.7, ox: 0, oy: 0, seed: 21, count: 70 });
  c.restore();
  // thin cloud streaks lit by the city
  const r = mulberry32(5);
  for (let i = 0; i < 7; i++) {
    const x = r() * 1100 - 20, y = 380 + r() * 600, w = 260 + r() * 420;
    const cg = c.createRadialGradient(x, y, 0, x, y, w); cg.addColorStop(0, 'rgba(70,88,130,0.20)'); cg.addColorStop(1, 'rgba(70,88,130,0)');
    c.save(); c.translate(x, y); c.scale(1, 0.12); c.translate(-x, -y); c.fillStyle = cg; c.fillRect(x - w, y - w, w * 2, w * 2); c.restore();
  }
}

// ---------------- plane 2: distant skyline ----------------
function drawSkyline(c, b, t) {
  const r = mulberry32(99), base = 1330;
  c.fillStyle = '#0a0f1c';
  const wins = [];
  for (let x = b.x0 - 40; x < b.x1 + 40; x += 0) {
    const w = 70 + r() * 120, h = 240 + r() * 520;
    c.fillRect(x, base - h, w, h + 400);
    for (let k = 0; k < 3; k++) if (r() < 0.55) wins.push([x + 10 + r() * (w - 28), base - h + 20 + r() * (h - 40)]);
    x += w + r() * 10;
  }
  c.fillStyle = 'rgba(255,196,120,0.75)';
  for (const [x, y] of wins) if (((x * 7 + y) | 0) % 5 === 0) c.fillRect(x, y, 9, 13);
  // aircraft warning light: the one red accent
  const blink = Math.sin(t * 3.0) > 0.2 ? 1 : 0.25;
  c.fillStyle = `rgba(255,50,40,${blink})`; c.beginPath(); c.arc(345, base - 770, 6, 0, 6.3); c.fill();
}

// ---------------- plane 3: alley walls ----------------
function drawBuildings(c, b, occ) {
  const wall = (x0, x1, top, tone) => {
    c.fillStyle = occ ? '#000' : tone; c.fillRect(x0, top, x1 - x0, 1900 - top);
    if (occ) return;
    cin.fillTexture(c, 'brick', [x0, top, x1 - x0, 1900 - top], { alpha: 0.85, scale: 1.5, ox: x0, oy: top, tint: '#b0b6c8' });
    // cornice + windows
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(x0, top, x1 - x0, 22);
    for (let y = top + 120; y < 1250; y += 230) for (let x = x0 + 55; x < x1 - 90; x += 140) {
      c.fillStyle = '#05070b'; c.fillRect(x, y, 70, 120);
      const g = c.createLinearGradient(x, y, x + 70, y + 120); g.addColorStop(0, 'rgba(110,135,190,0.22)'); g.addColorStop(0.5, 'rgba(110,135,190,0.02)'); g.addColorStop(1, 'rgba(110,135,190,0.10)');
      c.fillStyle = g; c.fillRect(x, y, 70, 120);
      c.fillStyle = 'rgba(40,46,60,0.9)'; c.fillRect(x - 8, y + 120, 86, 9); // sill
    }
  };
  wall(-420, 330, 210, '#252a38');        // left block
  wall(790, 1500, 420, '#232733');        // right block
  if (!occ) {
    c.strokeStyle = 'rgba(8,10,14,0.95)'; c.lineWidth = 9;                    // fire-escape rails on the left block
    for (let y = 520; y < 1200; y += 230) { c.beginPath(); c.moveTo(-20, y); c.lineTo(310, y); c.stroke(); for (let x = 0; x < 310; x += 52) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 60); c.stroke(); } }
    c.lineWidth = 12; c.beginPath(); c.moveTo(300, 480); c.lineTo(300, 1250); c.stroke();            // drainpipe
  }
}

// ---------------- plane 4: wet street + puddles ----------------
function drawGround(c, b, occ, t) {
  const top = 1195;
  c.fillStyle = occ ? '#000' : '#10131b'; c.fillRect(b.x0, top, b.w, b.y1 - top);
  if (occ) return;
  const g = c.createLinearGradient(0, top, 0, 1950); g.addColorStop(0, '#171c28'); g.addColorStop(1, '#0a0c11'); c.fillStyle = g; c.fillRect(b.x0, top, b.w, b.y1 - top);
  cin.fillTexture(c, 'stone', [b.x0, top, b.w, b.y1 - top], { alpha: 0.55, scale: 2.2, ox: 0, oy: top, tint: '#9aa3b8' });
  // perspective seams converging on the vanishing point
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3;
  for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(540 + i * 38, top); c.lineTo(540 + i * 330, 1990); c.stroke(); }
  // curbs
  c.fillStyle = '#1f2431'; c.beginPath(); c.moveTo(b.x0, top - 22); c.lineTo(b.x1, top - 22); c.lineTo(b.x1, top + 14); c.lineTo(b.x0, top + 14); c.closePath(); c.fill();
  // puddles: dark mirrors with a vertical lamp reflection (the streak is what sells "wet")
  const P = [[330, 1640, 330, 52], [760, 1470, 250, 36], [560, 1800, 420, 60], [880, 1740, 220, 40]];
  for (const [x, y, rx, ry] of P) {
    const pg = c.createLinearGradient(0, y - ry, 0, y + ry); pg.addColorStop(0, 'rgba(40,56,90,0.55)'); pg.addColorStop(1, 'rgba(10,14,24,0.85)');
    c.fillStyle = pg; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.3); c.fill();
    const rg = c.createLinearGradient(0, y - ry, 0, y + ry * 1.8); rg.addColorStop(0, 'rgba(255,196,120,0.55)'); rg.addColorStop(1, 'rgba(255,196,120,0)');
    c.save(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.3); c.clip();
    c.fillStyle = rg; const wob = Math.sin(t * 1.3 + x) * 6; c.fillRect(LAMP.x - 70 + wob - (x - 560) * 0.15, y - ry, 140, ry * 3); c.restore();
  }
}

// ---------------- plane 5: street lamp ----------------
function drawLamp(c, b, occ, t) {
  c.fillStyle = occ ? '#000' : '#0b0d12'; c.strokeStyle = c.fillStyle;
  c.fillRect(864, 360, 26, 1450); c.fillRect(838, 1740, 78, 90); c.fillRect(850, 600, 54, 20);
  c.lineWidth = 20; c.lineCap = 'round'; c.beginPath(); c.moveTo(877, 380); c.quadraticCurveTo(850, 318, 760, 330); c.stroke();
  c.beginPath(); c.moveTo(690, 336); c.lineTo(790, 336); c.lineTo(770, 372); c.lineTo(712, 372); c.closePath(); c.fill(); // hood
}

// ---------------- plane 6: the subject (man in a coat) ----------------
const SUB = { x: 400, feet: GROUND_Y };
function bodyPath(t) {
  const x = SUB.x + Math.sin(t * 0.7) * 3, f = SUB.feet, br = Math.sin(t * 1.9) * 3;
  const p = new Path2D();
  // hat
  p.moveTo(x - 118, f - 705); p.quadraticCurveTo(x, f - 735, x + 118, f - 705); p.lineTo(x + 70, f - 712); p.quadraticCurveTo(x + 66, f - 800, x, f - 806); p.quadraticCurveTo(x - 66, f - 800, x - 70, f - 712); p.closePath();
  // head + neck (leaning slightly toward the light)
  p.moveTo(x - 58, f - 708); p.quadraticCurveTo(x - 62, f - 640, x - 36, f - 612); p.lineTo(x + 36, f - 612); p.quadraticCurveTo(x + 62, f - 640, x + 58, f - 708); p.closePath();
  // coat: raised collar, shoulders, long skirts
  p.moveTo(x - 46, f - 622); p.lineTo(x - 112, f - 590); p.quadraticCurveTo(x - 210, f - 560, x - 228, f - 420 - br);
  p.lineTo(x - 262, f - 180); p.quadraticCurveTo(x - 270, f - 90, x - 214, f - 52);
  p.lineTo(x - 70, f - 52); p.lineTo(x - 62, f); p.lineTo(x - 8, f); p.lineTo(x, f - 52); p.lineTo(x + 8, f); p.lineTo(x + 62, f); p.lineTo(x + 70, f - 52);
  p.lineTo(x + 214, f - 52); p.quadraticCurveTo(x + 270, f - 90, x + 262, f - 180); p.lineTo(x + 228, f - 420 - br);
  p.quadraticCurveTo(x + 210, f - 560, x + 112, f - 590); p.lineTo(x + 46, f - 622); p.closePath();
  return p;
}
function drawSubject(c, b, occ, t, Path2D) {
  const path = bodyPath(t);
  c.fillStyle = occ ? '#000' : '#08090d'; c.fill(path);
  if (occ) return;
  c.save(); c.clip(path);
  cin.fillTexture(c, 'fabric', [SUB.x - 300, SUB.feet - 820, 600, 840], { alpha: 0.5, scale: 1.4, ox: 0, oy: 0 });
  const g = c.createLinearGradient(SUB.x - 250, 0, SUB.x + 250, 0); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(120,140,190,0.10)');
  c.fillStyle = g; c.fillRect(SUB.x - 300, SUB.feet - 820, 600, 840); c.restore();
  // lamp is up-right of the subject: rim on that side, soft edge
  const toLamp = { x: 1, y: -0.55 };
  cin.rimLight(c, path, toLamp, { width: 5, color: '#ffc98a', alpha: 0.95 });
  // lamp-side leg of the coat catches a little more
  cin.rimLight(c, path, { x: 1, y: 0.1 }, { width: 3, color: '#ffb066', alpha: 0.5, soft: false });
}
function subjectShadow(c, b, Path2D, t) {
  const x = SUB.x, f = SUB.feet;
  const poly = [[x - 118, f - 705], [x - 66, f - 800], [x, f - 806], [x + 66, f - 800], [x + 118, f - 705], [x + 112, f - 590], [x + 228, f - 420], [x + 262, f - 180], [x + 214, f - 52], [x + 62, f], [x - 62, f], [x - 214, f - 52], [x - 262, f - 180], [x - 228, f - 420], [x - 112, f - 590]];
  const lamp = { x: LAMP.x * 1.0 - 8, y: LAMP.y, floorY: f + 40 };
  cin.castShadow(c, poly, lamp, { y: f, squash: 0.28 }, { alpha: 0.75, softness: 14 });
}

// ---------------- plane 7 (near): out-of-focus foreground ----------------
function drawForeground(c, b, occ) {
  c.fillStyle = '#020203';
  // bin and railing bottom-left, cable across the top-right
  c.beginPath(); c.moveTo(-120, 2100); c.lineTo(-120, 1420); c.lineTo(60, 1400); c.lineTo(300, 1430); c.lineTo(340, 2100); c.closePath(); c.fill();
  c.fillRect(-120, 1380, 500, 38);
  c.lineWidth = 14; c.strokeStyle = '#020203'; c.beginPath(); c.moveTo(1200, 160); c.quadraticCurveTo(820, 330, 420, 120); c.stroke();
  c.beginPath(); c.moveTo(1200, 260); c.quadraticCurveTo(900, 420, 560, 240); c.stroke();
}

// ---------------- motes drifting through the light cone (screen space, after the mask) ----------------
function motes(ctx, t, lampS) {
  const k = ctx.canvas.width / 1080;
  const r = mulberry32(404);
  ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 70; i++) {
    const u = r(), v = r(), sp = 6 + r() * 16, ph = r() * 6.3;
    // spawn inside the cone that runs from the lamp toward the subject
    const dist = 120 + u * 900, ang = 1.95 + (v - 0.5) * 0.7;
    const x = lampS.x + Math.cos(ang) * dist + Math.sin(t * 0.5 + ph) * 22, y = lampS.y + Math.sin(ang) * dist + ((t * sp) % 60);
    const a = 0.55 * (1 - dist / 1100) * (0.5 + 0.5 * Math.sin(t * 1.1 + ph));
    ctx.fillStyle = `rgba(255,214,150,${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(x, y, 1.2 + r() * 1.8, 0, 6.3); ctx.fill();
  }
  ctx.restore();
}

export const VideoClock = {
  setTime(s) { T = s; },
  draw(ctx, width, height, timeline) {
    const t = Math.min(DUR, Math.max(0, T)), frame = Math.round(t * 30);
    const P2D = Path2D;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);

    cam.update(t,
      cin.pushIn({ t0: 0, dur: DUR, amount: 0.14 }),
      cin.pan({ t0: 0, dur: DUR, from: -26, to: 34 }),
      cin.handheldMove(7, 0.9));
    const lampS = cam.project(LAMP.x, LAMP.y, LAMP.depth);

    // nearer planes first onto a transparent canvas; sky + skyline are painted BEHIND afterwards (they are emissive)
    cam.layer(ctx, 2.6, (c, b) => drawBuildings(c, b, false));
    cam.layer(ctx, 1.9, (c, b) => drawGround(c, b, false, t), { fullBleed: false });
    cam.layer(ctx, 1.3, (c, b) => drawLamp(c, b, false, t));
    cam.layer(ctx, 1.1, (c, b) => subjectShadow(c, b, P2D, t));
    cam.layer(ctx, 1.1, (c, b) => drawSubject(c, b, false, t, P2D));

    // light: everything not reached by the lamp goes dark
    const flick = 1 + 0.04 * cin.noise1(3, t * 9) + (cin.noise1(8, t * 1.3) > 0.82 ? -0.18 : 0); // slightly sick lamp
    cin.darkMask(ctx, [
      { type: 'point', x: lampS.sx, y: lampS.sy + 20, r: 620, color: '#ffc27a', intensity: 0.75 * flick },
      { type: 'cone', x: lampS.sx, y: lampS.sy + 30, angle: 1.95, spread: 0.42, length: 1500, color: '#ffd29a', intensity: 1.0 * flick },
    ], { ambient: '#0b1120', glow: 0.5, atop: true });

  },
};
export const DURATION = DUR;
