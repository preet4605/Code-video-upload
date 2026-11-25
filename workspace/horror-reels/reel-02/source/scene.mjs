// Reel 2: Ranga, Part 2 "Ranga kaun thi". Original code-drawn art, blue-white palette.
import * as K from '../tools/kit.mjs';
const { cl, seg, eo, eio, lerp, TAU, RED } = K;

const FLAKES = (() => { const r = K.mulberry32(21); return Array.from({ length: 160 }, () => ({ x: r() * 1200 - 60, y: r() * 1920, r: 1.5 + r() * 4, sp: 50 + r() * 120, ph: r() * TAU })); })();
function snow(ctx, t, a = 0.8, wind = 40) {
  ctx.save();
  for (const f of FLAKES) { const y = ((f.y + t * f.sp) % 1980) - 30; const x = ((f.x + t * wind + Math.sin(t + f.ph) * 20) % 1200 + 1200) % 1200 - 60; ctx.globalAlpha = a * (0.5 + 0.5 * (f.r / 5.5)); K.circ(ctx, x, y, f.r, '#eef4ff'); }
  ctx.restore();
}

// frost creeping in from the edges; amt 0..1 (1 = almost whole screen)
const CRYST = (() => { const r = K.mulberry32(9); return Array.from({ length: 70 }, (_, i) => { const side = i % 4; return { side, u: r(), len: 0.5 + r() * 0.8, ang: (r() - 0.5) * 1.2, br: 2 + Math.floor(r() * 3) }; }); })();
function frost(ctx, amt) {
  if (amt <= 0) return;
  ctx.save();
  const d = lerp(0, 760, amt);
  const g1 = (x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(225,238,255,0.85)'); g.addColorStop(0.55, 'rgba(190,215,245,0.35)'); g.addColorStop(1, 'rgba(190,215,245,0)'); return g; };
  ctx.fillStyle = g1(0, 0, d, 0); ctx.fillRect(0, 0, d, 1920);
  ctx.fillStyle = g1(1080, 0, 1080 - d, 0); ctx.fillRect(1080 - d, 0, d, 1920);
  ctx.fillStyle = g1(0, 0, 0, d * 1.3); ctx.fillRect(0, 0, 1080, d * 1.3);
  ctx.fillStyle = g1(0, 1920, 0, 1920 - d * 1.3); ctx.fillRect(0, 1920 - d * 1.3, 1080, d * 1.3);
  ctx.strokeStyle = 'rgba(245,250,255,0.75)'; ctx.lineCap = 'round';
  for (const c of CRYST) {
    const L = c.len * d * 0.9; if (L < 6) continue;
    let x, y, a;
    if (c.side === 0) { x = 0; y = c.u * 1920; a = 0 + c.ang; } else if (c.side === 1) { x = 1080; y = c.u * 1920; a = Math.PI + c.ang; } else if (c.side === 2) { x = c.u * 1080; y = 0; a = Math.PI / 2 + c.ang; } else { x = c.u * 1080; y = 1920; a = -Math.PI / 2 + c.ang; }
    const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    for (let b = 1; b <= c.br; b++) { const k = b / (c.br + 1); const bx = lerp(x, ex, k), by = lerp(y, ey, k); const bl = L * 0.28 * (1 - k * 0.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + 0.7) * bl, by + Math.sin(a + 0.7) * bl); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a - 0.7) * bl, by + Math.sin(a - 0.7) * bl); ctx.stroke(); }
  }
  ctx.restore();
}

function cracks(ctx, p) {
  if (p <= 0) return;
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
  const r = K.mulberry32(3);
  for (let i = 0; i < 9; i++) { let x = 480, y = 760; let a = (i / 9) * TAU + r() * 0.4; ctx.beginPath(); ctx.moveTo(x, y); for (let s = 0; s < 6; s++) { const L = (40 + r() * 70) * p; a += (r() - 0.5) * 0.8; x += Math.cos(a) * L; y += Math.sin(a) * L; ctx.lineTo(x, y); } ctx.stroke(); }
  ctx.restore();
}

function mountains(ctx, t) {
  K.bg(ctx, ['#050914', '#0f1d36', '#1d3253']);
  K.glow(ctx, 300, 360, 240, '210,225,255', 0.4); K.circ(ctx, 300, 360, 56, '#e6edf9');
  [[900, 0.0022, 160, '#0d1729'], [1050, 0.003, 110, '#0a1222']].forEach(([base, f, amp, col], i) => {
    ctx.beginPath(); ctx.moveTo(0, 1920); for (let x = 0; x <= 1080; x += 12) ctx.lineTo(x, base - Math.abs(Math.sin(x * f + i * 2)) * amp - Math.sin(x * f * 3.7) * amp * 0.2); ctx.lineTo(1080, 1920); ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = 'rgba(220,235,255,0.12)'; ctx.fill();
  });
  ctx.fillStyle = '#c9d6ea'; ctx.fillRect(0, 1180, 1080, 740);
  ctx.fillStyle = vSnow(ctx); ctx.fillRect(0, 1180, 1080, 740);
}
function vSnow(ctx) { return K.vgrad(ctx, 1180, 1920, ['#8fa3c2', '#b9c8de', '#d7e1ef']); }

function house(ctx, x, y, k, lit = 1, doorOpen = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = '#121a2a'; ctx.fillRect(-110, -170, 220, 170);
  ctx.beginPath(); ctx.moveTo(-140, -165); ctx.lineTo(0, -280); ctx.lineTo(140, -165); ctx.fill();
  ctx.fillStyle = '#e8eef8'; ctx.beginPath(); ctx.moveTo(-145, -160); ctx.lineTo(0, -282); ctx.lineTo(145, -160); ctx.lineTo(120, -160); ctx.lineTo(0, -255); ctx.lineTo(-120, -160); ctx.fill();
  ctx.fillStyle = `rgba(255,190,100,${0.9 * lit})`; ctx.fillRect(40, -130, 46, 46);
  if (lit > 0) K.glow(ctx, 63, -107, 90, '255,180,90', 0.35 * lit);
  ctx.fillStyle = doorOpen > 0 ? `rgba(255,190,100,${0.8 * doorOpen})` : '#0a0f1a'; ctx.fillRect(-60, -110, 60, 110);
  ctx.restore();
}

function bride(ctx, x, y, k, { veil = 1, a = 1 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.globalAlpha *= a;
  ctx.fillStyle = '#7a0c12';
  ctx.beginPath(); ctx.moveTo(-90, 0); ctx.bezierCurveTo(-80, -200, -60, -380, -40, -430); ctx.lineTo(40, -430); ctx.bezierCurveTo(60, -380, 80, -200, 90, 0); ctx.closePath(); ctx.fill();
  K.ell(ctx, 0, -470, 40, 50, '#1a0a0c');
  // veil
  ctx.fillStyle = `rgba(190,20,30,${0.85 * veil})`; ctx.beginPath(); ctx.moveTo(-55, -520); ctx.quadraticCurveTo(0, -560, 55, -520); ctx.bezierCurveTo(95, -400, 110, -280, 100, -200); ctx.lineTo(-100, -200); ctx.bezierCurveTo(-110, -280, -95, -400, -55, -520); ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,90,0.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-55, -520); ctx.quadraticCurveTo(0, -560, 55, -520); ctx.stroke();
  ctx.restore();
}

function thermo(ctx, x, y, v) {
  K.rrect(ctx, x - 150, y - 70, 300, 140, 22, 'rgba(6,12,24,0.8)');
  const val = Math.round(lerp(4, -12, v));
  K.text(ctx, `${val}°C`, x, y + 4, 92, val < 0 ? '#9fd3ff' : '#fff', { weight: 900 });
}

const R = {
  hook(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { z0: 1.06, z1: 1.0 });
    mountains(ctx, lt); snow(ctx, lt, 0.6);
    bride(ctx, 480, 1820, 1.0, { a: 0.95 });
    ctx.restore();
    frost(ctx, 0.75 - 0.1 * eo(seg(lt, 0.2, 2))); cracks(ctx, eo(seg(lt, 0.05, 0.5)));
    K.slamText(ctx, 'RANGA', 480, 520, 150, eo(lt / 0.35), { col: '#dff1ff', glowCol: '140,200,255', shake: 20 });
    K.slamText(ctx, 'ek dulhan thi', 480, 660, 74, eo(seg(lt, 1.2, 1.6)), { col: RED, shake: 10 });
  },
  recap(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { z1: 1.06 });
    K.bg(ctx, ['#03060c', '#0a1426', '#0d1a2e']);
    K.door(ctx, 330, 700, 300, 560, 0, { leaf: '#101a2c' });
    frost(ctx, 0.25 + 0.35 * seg(lt, 0.5, dur));
    snow(ctx, lt, 0.25, 10);
    ctx.restore();
    thermo(ctx, 480, 500, eio(seg(lt, 0.6, dur * 0.7)));
  },
  village(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 1200, z0: 1.0, z1: 1.08 });
    mountains(ctx, lt);
    house(ctx, 170, 1230, 0.8, K.flick(lt)); house(ctx, 820, 1220, 0.75, K.flick(lt, 2)); house(ctx, 500, 1180, 0.6, 0.9);
    // waiting bride with a diya, second half she is alone in the dark
    const late = seg(lt, dur * 0.5, dur * 0.56);
    bride(ctx, 470, 1800, 0.8);
    K.glow(ctx, 535, 1690, 140, '255,170,70', 0.6 * (1 - late * 0.7) * K.flick(lt, 4)); K.circ(ctx, 535, 1692, 10, `rgba(255,210,120,${1 - late * 0.7})`);
    snow(ctx, lt, 0.7);
    ctx.restore();
    if (late > 0) { K.rrect(ctx, 250, 420, 460, 120, 18, 'rgba(6,12,24,0.8)'); K.text(ctx, 'Baraat: 0', 480, 482, 72, '#fff', { weight: 900 }); }
  },
  cast_out(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 1100, z1: 1.05, kick: K.kickAt(lt, dur - 1.25, 0.35) + K.kickAt(lt, dur - 0.65, 0.35) });
    mountains(ctx, lt);
    // a row of doors that go dark one by one
    const shut = seg(lt, dur * 0.45, dur - 0.5);
    for (let i = 0; i < 5; i++) { const x = 120 + i * 190; const on = shut * 5 < i + 1 ? 1 : 0; house(ctx, x, 1250 - (i % 2) * 30, 0.62, on * K.flick(lt, i), 0); }
    // villagers' pointing shadows in first half
    const accuse = 1 - seg(lt, dur * 0.4, dur * 0.5);
    for (let i = 0; i < 3; i++) K.figure(ctx, 180 + i * 330, 1900, 1.1, { col: `rgba(0,0,0,${0.9 * accuse})`, hair: false });
    bride(ctx, 480, 1820, 0.7, { a: 0.9 });
    snow(ctx, lt, 0.9, 80);
    ctx.restore();
    if (accuse > 0.3) K.slamText(ctx, 'MANHOOS', 480, 520, 120, eo(seg(lt, 0.9, 1.3)), { shake: 18 });
  },
  trail(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 1300, z0: 1.0, z1: 1.12 });
    mountains(ctx, lt);
    for (let i = 0; i < 4; i++) house(ctx, 150 + i * 260, 1230, 0.55, 0, 0);
    // empty spot where she stood + a drag line that branches to every door
    const p = eio(seg(lt, dur * 0.3, dur * 0.9));
    ctx.strokeStyle = 'rgba(70,90,130,0.85)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const tx = 150 + i * 260 - 18, ty = 1235; const sx = 480, sy = 1800;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      const N = 30; for (let s = 1; s <= Math.floor(N * p); s++) { const k = s / N; ctx.lineTo(lerp(sx, tx, k) + Math.sin(k * 9 + i) * 14, lerp(sy, ty, eo(k))); }
      ctx.stroke();
    }
    K.ell(ctx, 480, 1810, 90, 22, 'rgba(70,90,130,0.5)');
    snow(ctx, lt, 0.45, 20);
    ctx.restore();
  },
  warning(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 950, z0: 1.0, z1: 1.14, kick: K.kickAt(lt, dur - 0.45, 0.4) });
    K.bg(ctx, ['#05070c', '#0c1220', '#0a0e18']);
    K.door(ctx, 330, 600, 320, 640, 0, { leaf: '#121a2a' });
    K.circ(ctx, 600, 940, 14, '#556');
    K.lightUnderDoor(ctx, 330, 1240, 320, 0.5, '170,200,255');
    ctx.restore();
    frost(ctx, 0.2 + 0.5 * eio(seg(lt, 0, dur)));
    thermo(ctx, 480, 450, 0.6 + 0.4 * seg(lt, 0, dur));
  },
  cta_loop(ctx, lt, dur) {
    const loopAt = dur - 1.9;
    ctx.save(); K.camera(ctx, lt, dur, { z1: 1.03 });
    mountains(ctx, lt); snow(ctx, lt, 0.5);
    bride(ctx, 480, 1850, 0.8, { a: 0.5 + 0.5 * seg(lt, loopAt, dur) });
    ctx.restore();
    if (lt < loopAt) {
      K.text(ctx, 'Gaon walon ko maafi?', 480, 400, 60, '#fff', { weight: 900 });
      K.choiceCards(ctx, 'Haan, maaf karo', 'Na, kabhi nahi', eo(seg(lt, 0.1, 0.9)), lt);
      frost(ctx, 0.2);
    } else {
      frost(ctx, lerp(0.2, 0.7, eio(seg(lt, loopAt, dur))));
      K.text(ctx, 'RANGA', 480, 520, 150, '#dff1ff', { weight: 900, a: seg(lt, loopAt + 0.4, loopAt + 1.2) });
    }
  }
};

export const VideoClock = K.makeClock(R, { badge: 'RANGA · PART 2' });
