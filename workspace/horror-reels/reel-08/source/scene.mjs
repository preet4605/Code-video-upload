// Reel 8: "Hostel mein ek bed zyada". Top-down dorm, original code-drawn art.
import * as K from '../tools/kit.mjs';
const { cl, seg, eo, eio, lerp, TAU, RED } = K;

// 4 columns x 8 rows grid; slot 31 (bottom-right corner) is the empty corner bed; slot 13 is "mine"
const COLS = 5, ROWS = 6, BW = 130, BH = 200, GX = 35, GY = 18, X0 = 480 - (COLS * BW + (COLS - 1) * GX) / 2, Y0 = 470;
const CORNER = COLS * ROWS - 1, MINE = 12, DOOR = 25;
const pos = (i) => [X0 + (i % COLS) * (BW + GX), Y0 + Math.floor(i / COLS) * (BH * 0.78 + GY)];

function bedTop(ctx, x, y, { occupied = true, glow = 0, tag = null, lift = 0 } = {}) {
  ctx.save(); ctx.translate(x, y);
  K.rrect(ctx, 0, 0, BW, BH * 0.78, 10, '#2a2620');
  K.rrect(ctx, 8, 8, BW - 16, BH * 0.78 - 16, 8, '#47433c');
  K.rrect(ctx, 22, 16, BW - 44, 40, 14, '#d8d2c4');
  if (occupied) {
    ctx.save(); ctx.translate(BW / 2, 95); ctx.scale(1 + lift * 0.08, 1 + lift * 0.12);
    K.ell(ctx, 0, -10, 44, 52, '#5d6b8a'); K.ell(ctx, 0, -58, 22, 18, '#1a1512');
    ctx.restore();
  }
  if (glow > 0) { ctx.strokeStyle = `rgba(224,27,36,${glow})`; ctx.lineWidth = 8; ctx.strokeRect(-6, -6, BW + 12, BH * 0.78 + 12); }
  if (tag) K.text(ctx, tag, BW / 2, BH * 0.78 + 26, 28, glow > 0 ? RED : '#bbb', { weight: 900 });
  ctx.restore();
}

function dorm(ctx, lt, { cornerOcc = 0, mineAt = MINE, cornerGlow = 0, mineGlow = 0 } = {}) {
  K.bg(ctx, ['#0b0b0d', '#121216', '#0a0a0c']);
  ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 2; for (let y = 0; y < 2400; y += 90) { ctx.beginPath(); ctx.moveTo(-100, y); ctx.lineTo(1200, y); ctx.stroke(); }
  { const [dx, dy] = pos(DOOR); K.rrect(ctx, dx + 20, dy + BH * 0.78 - 20, BW - 40, 26, 4, '#5a3a22'); K.text(ctx, 'DARWAZA', dx + BW / 2, dy + BH * 0.4, 24, '#777', { weight: 800 }); }
  for (let i = 0; i < COLS * ROWS; i++) {
    let slot = i; if (i === DOOR) continue;
    if (i === MINE && mineAt !== MINE) continue;
    if (i === CORNER) { if (mineAt === CORNER) continue; }
    const [x, y] = pos(slot);
    if (i === CORNER) bedTop(ctx, x, y, { occupied: cornerOcc > 0.5, lift: cornerOcc > 0.5 ? 0.5 + 0.5 * Math.sin(lt * 1.6) : 0, glow: cornerGlow, tag: cornerGlow > 0 ? 'KONA' : null });
    else bedTop(ctx, x, y, { occupied: true, lift: 0.3 * Math.sin(lt * 1.3 + i) });
  }
  if (mineAt !== MINE) { const [x, y] = pos(mineAt); const [ex, ey] = pos(MINE); bedTop(ctx, x, y, { occupied: true, glow: mineGlow, tag: 'MERA BED' }); K.rrect(ctx, ex, ey, BW, BH * 0.78, 10, 'rgba(255,255,255,0.04)'); ctx.setLineDash([12, 10]); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 4; ctx.strokeRect(ex, ey, BW, BH * 0.78); ctx.setLineDash([]); }
}

function torch(ctx, cx, cy, ang, a = 1) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, 0, 0, -1300); g.addColorStop(0, `rgba(255,240,200,${0.5 * a})`); g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.lineTo(260, -1300); ctx.lineTo(-260, -1300); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function counter(ctx, n, warn = 0) {
  K.rrect(ctx, 340, 280, 280, 140, 20, 'rgba(0,0,0,0.85)');
  ctx.strokeStyle = warn > 0 ? RED : '#444'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(340, 280, 280, 140, 20); ctx.stroke();
  K.text(ctx, String(n), 480, 352, 104, warn > 0 ? '#ff4a3a' : '#fff', { weight: 900, shadow: false });
}

const darkMask = (ctx, a) => { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(-200, -200, 1480, 2320); };

const R = {
  hook(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 900, z0: 1.0, z1: 1.04, kick: K.kickAt(lt, dur - 0.9, 0.4) });
    dorm(ctx, lt, { cornerOcc: 1 }); darkMask(ctx, 0.55);
    torch(ctx, 480, 1900, Math.sin(lt * 1.5) * 0.4);
    ctx.restore();
    const n = lt < dur * 0.62 ? 28 : 29; counter(ctx, n, n === 29 ? 1 : 0);
  },
  setup(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 900, z0: 1.0, z1: 1.06 });
    dorm(ctx, lt); darkMask(ctx, 0.6);
    const sweep = (lt / dur) * 2.2; torch(ctx, 480, 1900, -0.45 + (sweep % 1) * 0.9);
    ctx.restore();
    counter(ctx, Math.min(28, Math.floor(seg(lt, 0, dur * 0.85) * 28) + 1), 0);
  },
  count(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 900, z0: 1.04, z1: 1.1, kick: K.kickAt(lt, dur * 0.4, 0.4) });
    dorm(ctx, lt, { cornerOcc: 1 }); darkMask(ctx, 0.6);
    torch(ctx, 480, 1900, -0.45 + ((lt / dur) * 2 % 1) * 0.9);
    ctx.restore();
    const n = lt < dur * 0.4 ? 27 + Math.floor(seg(lt, 0, dur * 0.4) * 2) : 29; counter(ctx, Math.min(29, n), n >= 29 ? 1 : 0);
  },
  corner(ctx, lt, dur) {
    const [cx, cy] = pos(CORNER);
    ctx.save(); K.camera(ctx, lt, dur, { fx: cx - 120, fy: cy - 60, z0: 1.05, z1: 1.35 });
    dorm(ctx, lt, { cornerOcc: 1, cornerGlow: seg(lt, 0.3, 0.8) }); darkMask(ctx, 0.5);
    torch(ctx, 480, 1900, 0.32);
    ctx.restore();
  },
  twist(ctx, lt, dur) {
    const moved = lt > dur * 0.42;
    const [cx, cy] = pos(CORNER);
    ctx.save(); K.camera(ctx, lt, dur, { fx: moved ? cx - 120 : 540, fy: moved ? cy - 60 : 900, z0: 1.0, z1: moved ? 1.25 : 1.0 });
    // morning light
    K.bg(ctx, ['#1a1c22', '#24262c', '#1a1b20']);
    dorm(ctx, lt, { cornerOcc: 0, mineAt: moved ? CORNER : MINE, mineGlow: moved ? 1 : 0 });
    ctx.fillStyle = 'rgba(255,220,170,0.06)'; ctx.fillRect(-200, -200, 1480, 2320);
    ctx.restore();
    K.rrect(ctx, 330, 290, 300, 100, 18, 'rgba(0,0,0,0.75)'); K.text(ctx, '6:00 AM', 480, 342, 58, '#ffd27a', { weight: 900 });
  },
  cta_loop(ctx, lt, dur) {
    const loopAt = dur - 1.8;
    ctx.save(); K.camera(ctx, lt, dur, { fy: 900, z1: 1.03 });
    dorm(ctx, lt, { cornerOcc: 1 }); darkMask(ctx, 0.6); torch(ctx, 480, 1900, Math.sin(lt * 1.5) * 0.4);
    ctx.restore();
    if (lt < loopAt) {
      const p = K.eback(seg(lt, 0.1, 0.6));
      ctx.save(); ctx.translate(480, 680); ctx.scale(p, p);
      K.rrect(ctx, -380, -150, 760, 300, 30, 'rgba(12,10,14,0.92)'); ctx.strokeStyle = RED; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(-380, -150, 760, 300, 30); ctx.stroke();
      K.text(ctx, 'Tumhare hostel ka naam?', 0, -50, 52, '#fff', { weight: 900 });
      K.text(ctx, 'Agli reel wahin ki', 0, 40, 46, '#ffb0a0', { weight: 800 });
      ctx.restore();
    } else counter(ctx, 28, 0);
  }
};

export const VideoClock = K.makeClock(R, { badge: null });
