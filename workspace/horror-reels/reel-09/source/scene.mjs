// Reel 9: "Peepal ke neeche mat sona". Original code-drawn art.
import * as K from '../tools/kit.mjs';
const { cl, seg, eo, eio, lerp, TAU, RED } = K;

// deterministic tree: trunk + branch skeleton + leaf mass + hanging threads
const BR = (() => { const r = K.mulberry32(17); const out = []; const grow = (x, y, a, len, w, d) => { if (d === 0 || len < 30) return; const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len; out.push({ x, y, ex, ey, w }); grow(ex, ey, a - 0.35 - r() * 0.3, len * (0.68 + r() * 0.1), w * 0.66, d - 1); grow(ex, ey, a + 0.35 + r() * 0.3, len * (0.68 + r() * 0.1), w * 0.66, d - 1); }; grow(540, 1250, -Math.PI / 2, 330, 90, 7); return out; })();
const LEAF = (() => { const r = K.mulberry32(5); return BR.filter((b) => b.w < 14).map((b) => ({ x: b.ex, y: b.ey, r: 50 + r() * 60 })); })();
const THREADS = (() => { const r = K.mulberry32(33); return BR.filter((b) => b.w > 9 && b.w < 40 && b.ey < 900).slice(0, 26).map((b, i) => ({ x: lerp(b.x, b.ex, 0.6), y: lerp(b.y, b.ey, 0.6), len: 110 + r() * 160, col: i === 7 ? '#050505' : (r() > 0.3 ? '#c4161c' : '#e8a317'), ph: r() * TAU, black: i === 7 })); })();

function tree(ctx, lt, { light = 0.6, dawn = 0, blackHL = 0 } = {}) {
  ctx.save(); ctx.translate(540, 1330); ctx.scale(0.66, 0.66); ctx.translate(-540, -1330);
  ctx.fillStyle = dawn > 0 ? '#1a1612' : '#0c111c';
  ctx.globalAlpha = 0.9; for (const l of LEAF) { ctx.beginPath(); ctx.arc(l.x + Math.sin(lt * 0.7 + l.x) * 4, l.y, l.r, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.strokeStyle = dawn > 0 ? '#14110e' : '#020202'; ctx.lineCap = 'round';
  for (const b of BR) { ctx.lineWidth = b.w; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.ex, b.ey); ctx.stroke(); }
  // roots
  ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(380, 1330); ctx.quadraticCurveTo(500, 1200, 520, 1100); ctx.lineTo(560, 1100); ctx.quadraticCurveTo(590, 1200, 720, 1330); ctx.fill();
  // threads swaying
  for (const th of THREADS) {
    const sw = Math.sin(lt * 1.3 + th.ph) * 0.18;
    const ex = th.x + Math.sin(sw) * th.len, ey = th.y + Math.cos(sw) * th.len;
    ctx.strokeStyle = th.col; ctx.lineWidth = th.black ? 5 + 4 * blackHL : 4; ctx.beginPath(); ctx.moveTo(th.x, th.y); ctx.quadraticCurveTo(th.x + Math.sin(sw) * th.len * 0.3, th.y + th.len * 0.6, ex, ey); ctx.stroke();
    if (th.black && blackHL > 0) K.glow(ctx, ex, ey, 120, '224,27,36', 0.4 * blackHL);
  }
  ctx.restore();
}

function sky(ctx, lt, dawn = 0) {
  if (dawn > 0) K.bg(ctx, ['#4b5468', '#8b7d78', '#c09a7e']); else K.bg(ctx, ['#020308', '#070b16', '#0b0f19']);
  if (dawn === 0) { K.glow(ctx, 820, 330, 220, '210,220,255', 0.35); K.circ(ctx, 820, 330, 48, '#d9e0ef'); }
  ctx.fillStyle = dawn > 0 ? '#2a221c' : '#050506'; ctx.fillRect(0, 1320, 1080, 600);
}

function lantern(ctx, x, y, lt, a = 1) { K.glow(ctx, x, y, 360, '255,160,60', 0.5 * a * K.flick(lt, 2)); K.rrect(ctx, x - 22, y - 34, 44, 68, 8, `rgba(255,190,90,${a})`); }

function sleeper(ctx, x, y, k, lt) { ctx.save(); ctx.translate(x, y); ctx.scale(k, k); K.ell(ctx, 0, 0, 170, 40, '#3a3d4a'); K.ell(ctx, -175, -6, 34, 30, '#0c0a09'); ctx.restore(); }

function tag(ctx, x, y, s, p) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(0.06 * Math.sin(p * 3)); ctx.scale(s, s);
  ctx.strokeStyle = '#050505'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, -500); ctx.lineTo(0, -120); ctx.stroke();
  K.rrect(ctx, -260, -130, 520, 260, 18, '#d9cbb0');
  ctx.strokeStyle = '#8a7558'; ctx.lineWidth = 4; ctx.strokeRect(-245, -115, 490, 230);
  K.text(ctx, 'MONU', 0, -40, 96, '#1a0f0a', { weight: 900, shadow: false, a: seg(p, 0.1, 0.4) });
  K.text(ctx, 'Tareekh: AAJ', 0, 60, 62, RED, { weight: 900, shadow: false, a: seg(p, 0.55, 0.8) });
  ctx.restore();
}

const R = {
  hook(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 900, z0: 1.08, z1: 1.0 });
    sky(ctx, lt); tree(ctx, lt); lantern(ctx, 700, 1240, lt, 0.8);
    ctx.restore();
        K.slamText(ctx, 'MAT SONA', 480, 1120, 120, eo(seg(lt, dur * 0.75, dur * 0.85)), { shake: 18 });
  },
  setup(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 800, z0: 1.05, z1: 1.2 });
    sky(ctx, lt); tree(ctx, lt); lantern(ctx, 700, 1240, lt);
    ctx.restore();
    const p = eo(seg(lt, dur * 0.62, dur * 0.72));
    if (p > 0) { ctx.save(); ctx.translate(480, 1080); ctx.scale(p, p); K.rrect(ctx, -330, -80, 660, 160, 16, 'rgba(235,225,205,0.95)'); K.text(ctx, 'NIYAM', 0, -30, 44, RED, { weight: 900, shadow: false }); K.text(ctx, 'Raat ko neeche mat sona', 0, 35, 46, '#222', { weight: 800, shadow: false }); ctx.restore(); }
  },
  monu(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 1250, z0: 1.0, z1: 1.12 });
    sky(ctx, lt); tree(ctx, lt);
    const sleep = seg(lt, dur * 0.55, dur * 0.65);
    if (sleep < 0.5) { K.figure(ctx, 640, 1340, 0.75, { col: '#0a0908', hair: false }); }
    else sleeper(ctx, 600, 1320, 0.8, lt);
    lantern(ctx, 820, 1300, lt, 1 - sleep * 0.8);
    ctx.restore();
    if (sleep < 0.5) K.text(ctx, 'haha, kuch nahi hota', 480, 420, 50, '#fff', { weight: 800, a: seg(lt, 0.4, 0.9) });
  },
  morning(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fx: 480, fy: 900, z0: 1.0, z1: 1.3 });
    sky(ctx, lt, 1); tree(ctx, lt, { dawn: 1, blackHL: seg(lt, dur * 0.5, dur * 0.7) });
    // Monu sitting, head tilted up toward the black thread
    ctx.save(); ctx.translate(620, 1330); ctx.fillStyle = '#1b1512';
    ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(-60, -170); ctx.quadraticCurveTo(0, -200, 60, -170); ctx.lineTo(80, 0); ctx.fill();
    K.ell(ctx, 0, -230, 46, 54, '#1b1512'); ctx.restore();
    ctx.restore();
  },
  twist(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { z0: 1.0, z1: 1.08 });
    K.bg(ctx, ['#4b5468', '#8b7d78', '#c09a7e']); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, 1080, 1920);
    tag(ctx, 480, 760, 1.1, seg(lt, 0, dur));
    ctx.restore();
  },
  cta_loop(ctx, lt, dur) {
    const loopAt = dur - 1.9;
    ctx.save(); K.camera(ctx, lt, dur, { fy: 900, z0: 1.0, z1: lt < loopAt ? 1.0 : 1.08 });
    sky(ctx, lt); tree(ctx, lt); lantern(ctx, 700, 1240, lt, 0.8);
    ctx.restore();
    if (lt < loopAt) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, 1080, 1920);
      K.text(ctx, 'Tumhare gaon ka ped?', 480, 400, 60, '#fff', { weight: 900 });
      K.choiceCards(ctx, 'Peepal / Imli', 'Bargad', eo(seg(lt, 0.1, 0.9)), lt);
    }
  }
};

export const VideoClock = K.makeClock(R, { badge: 'GAON KI KAHANI' });
