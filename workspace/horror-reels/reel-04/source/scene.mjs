// Reel 4: "Chudail ko pehchanne ke 3 tareeke". Original code-drawn art.
import * as K from '../tools/kit.mjs';
const { cl, seg, eo, eio, lerp, TAU, RED } = K;

function night(ctx, lt) {
  K.bg(ctx, ['#040406', '#0c0a10', '#120d0c']);
  K.glow(ctx, 540, 500, 700, '120,90,160', 0.12 * K.flick(lt));
  ctx.fillStyle = '#0e0b0a'; ctx.fillRect(0, 1380, 1080, 540);
}
// expanding sound rings (a call); n calls, each starting at times[]
function rings(ctx, x, y, lt, times, rgb = '224,27,36') {
  for (const t0 of times) {
    const p = (lt - t0) / 1.4; if (p < 0 || p > 1) continue;
    for (let k = 0; k < 3; k++) { const q = p - k * 0.12; if (q <= 0) continue; ctx.strokeStyle = `rgba(${rgb},${0.8 * (1 - q)})`; ctx.lineWidth = 8 * (1 - q) + 2; ctx.beginPath(); ctx.arc(x, y, 60 + q * 420, 0, TAU); ctx.stroke(); }
  }
}
function ruleNum(ctx, n, title, lt) {
  const p = eo(seg(lt, 0, 0.35));
  K.slamText(ctx, `NIYAM ${n}`, 480, 420, 120, p, { shake: 18 });
  K.text(ctx, title, 480, 540, 56, '#fff', { weight: 800, a: seg(lt, 0.3, 0.7) });
}
function daadi(ctx, x, y, k, lt) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(0.05 * Math.sin(lt * 1.2));
  ctx.fillStyle = '#060505';
  ctx.beginPath(); ctx.moveTo(-140, 0); ctx.bezierCurveTo(-150, -200, -90, -330, 0, -360); ctx.bezierCurveTo(70, -370, 120, -300, 130, -220); ctx.lineTo(150, 0); ctx.closePath(); ctx.fill();
  K.ell(ctx, 40, -380, 55, 62, '#060505');
  ctx.beginPath(); ctx.moveTo(-20, -430); ctx.quadraticCurveTo(60, -470, 120, -400); ctx.lineTo(150, -200); ctx.lineTo(-30, -300); ctx.fill(); // pallu
  ctx.restore();
}
function lantern(ctx, x, y, lt) { K.glow(ctx, x, y, 320, '255,170,70', 0.55 * K.flick(lt, 3)); K.rrect(ctx, x - 26, y - 40, 52, 80, 10, 'rgba(255,200,110,0.95)'); ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.strokeRect(x - 26, y - 40, 52, 80); }

const R = {
  hook(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 800, z0: 1.08, z1: 1.0, kick: K.kickAt(lt, 0, 0.4) });
    night(ctx, lt);
    // dark doorway at the end of a lane
    K.door(ctx, 400, 560, 160, 280, 0.0, { leaf: '#020203' });
    rings(ctx, 480, 700, lt, [0.0, 1.0]);
    ctx.restore();
    K.slamText(ctx, 'NAAM x2', 480, 420, 140, eo(lt / 0.35), { shake: 24 });
    const p3 = eo(seg(lt, 2.0, 2.4)); if (p3 > 0) K.slamText(ctx, '3rd = MAT SUNNA', 480, 1000, 72, p3, { col: '#fff', glowCol: '255,255,255' });
  },
  intro(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 1000, z1: 1.07 });
    K.bg(ctx, ['#0a0605', '#1a0f09', '#0b0706']);
    K.glow(ctx, 640, 960, 600, '255,150,60', 0.25 * K.flick(lt));
    daadi(ctx, 420, 1420, 1.25, lt); lantern(ctx, 700, 1150, lt);
    K.dust(ctx, lt, 0.3);
    ctx.restore();
    // three slots that fill as she speaks
    const p = eo(seg(lt, dur * 0.6, dur * 0.9));
    for (let i = 0; i < 3; i++) { const q = cl(p * 3 - i); K.rrect(ctx, 200 + i * 200 - 70, 400, 140, 140, 20, `rgba(224,27,36,${0.2 + 0.7 * q})`); K.text(ctx, String(i + 1), 200 + i * 200, 472, 90, '#fff', { weight: 900, a: 0.4 + 0.6 * q }); }
  },
  rule1(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 1200, z0: 1.0, z1: 1.1 });
    night(ctx, lt);
    // dirt path, footprints march toward the house but toes point backwards
    ctx.fillStyle = '#1a130e'; ctx.beginPath(); ctx.moveTo(300, 1920); ctx.lineTo(500, 700); ctx.lineTo(580, 700); ctx.lineTo(780, 1920); ctx.fill();
    K.door(ctx, 470, 520, 140, 180, 0, { leaf: '#050404' }); K.glow(ctx, 540, 610, 150, '255,170,70', 0.25);
    const n = Math.floor(seg(lt, 0.6, dur * 0.8) * 9);
    for (let i = 0; i < n; i++) { const k = 1 - i / 8; const y = lerp(760, 1780, k); const x = 540 + (i % 2 ? 26 : -26) * lerp(0.4, 1.6, k); K.footprint(ctx, x, y, 0, lerp(0.5, 1.8, k), cl((seg(lt, 0.6, dur * 0.8) * 9 - i) * 2), { wet: false, reversed: true }); }
    // arrows: walking direction vs toe direction
    const a = seg(lt, dur * 0.5, dur * 0.6);
    if (a > 0) { K.text(ctx, 'chalna ↑', 780, 1000, 46, '#fff', { a }); K.text(ctx, 'ungliyan ↓', 780, 1080, 46, RED, { a }); }
    ctx.restore();
    ruleNum(ctx, 1, 'Ulte pair', lt);
  },
  rule2(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 950, z0: 1.0, z1: 1.06 });
    night(ctx, lt);
    K.door(ctx, 340, 720, 280, 520, 0, { leaf: '#0f0c0b' }); K.lightUnderDoor(ctx, 340, 1240, 280, 0.6);
    const c1 = dur * 0.35, c2 = dur * 0.55;
    rings(ctx, 480, 980, lt, [c1, c2], '255,200,150');
    // call counter: 1, 2, then crossed 3
    const show = (i, t0) => { const q = eo(seg(lt, t0, t0 + 0.3)); if (q > 0) { K.circ(ctx, 280 + i * 200, 650, 55 * q, i < 2 ? 'rgba(255,200,150,0.9)' : 'rgba(224,27,36,0.9)'); K.text(ctx, i < 2 ? `"Beta"` : '3?', 280 + i * 200, 652, 34, '#111', { weight: 900, shadow: false, a: q }); } };
    show(0, c1); show(1, c2); show(2, dur * 0.8);
    if (lt > dur * 0.85) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(645, 600); ctx.lineTo(715, 700); ctx.moveTo(715, 600); ctx.lineTo(645, 700); ctx.stroke(); }
    ctx.restore();
    ruleNum(ctx, 2, 'Mummy ki awaaz, sirf 2 baar', lt);
  },
  rule3(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 1000, z0: 1.0, z1: 1.12 });
    K.bg(ctx, ['#060405', '#120c0a', '#0a0706']);
    // inside looking out through an open door; she waits beyond the threshold
    ctx.translate(0, -170);
    ctx.fillStyle = '#1b2236'; ctx.fillRect(310, 640, 340, 700); K.glow(ctx, 480, 900, 300, '150,170,220', 0.25);
    K.figure(ctx, 480, 1330, 1.05, { col: '#020203', eyes: eo(seg(lt, dur * 0.3, dur * 0.5)) });
    ctx.strokeStyle = '#050404'; ctx.lineWidth = 36; ctx.strokeRect(310, 640, 340, 700);
    // threshold line glows
    K.glow(ctx, 480, 1345, 260, '224,27,36', 0.25 + 0.15 * Math.sin(lt * 3)); ctx.fillStyle = RED; ctx.fillRect(310, 1338, 340, 8);
    // her hand stops at the threshold
    K.shadowHand(ctx, 480, 1300 - 40 * eo(seg(lt, dur * 0.5, dur * 0.7)), 0.7, Math.PI, 0.9);
    ctx.restore();
    ruleNum(ctx, 3, 'Andar tum bulaoge', lt);
  },
  twist(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { z0: 1.0, z1: 1.2 });
    night(ctx, lt); K.glow(ctx, 480, 800, 750, '170,20,30', 0.7 + 0.15 * Math.sin(lt * 2));
    K.door(ctx, 330, 560, 300, 620, 0, { leaf: '#0a0606' }); K.lightUnderDoor(ctx, 330, 1180, 300, 0.9, '255,80,60');
    rings(ctx, 480, 800, lt, [0.2, 1.3]);
    K.eyesPair(ctx, 480, 800, 1.3, eo(seg(lt, dur * 0.6, dur * 0.85)));
    ctx.restore();
  },
  cta_loop(ctx, lt, dur) {
    const loopAt = dur - 1.8;
    ctx.save(); K.camera(ctx, lt, dur, { z1: 1.03 });
    K.bg(ctx, ['#0a0605', '#1a0f09', '#0b0706']); daadi(ctx, 820, 1500, 0.9, lt); lantern(ctx, 640, 1340, lt);
    ctx.restore();
    if (lt < loopAt) {
      const p = eback2(seg(lt, 0.1, 0.6));
      ctx.save(); ctx.translate(480, 640); ctx.scale(p, p);
      K.rrect(ctx, -380, -170, 760, 340, 30, 'rgba(12,10,14,0.92)'); ctx.strokeStyle = RED; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(-380, -170, 760, 340, 30); ctx.stroke();
      K.text(ctx, 'Tumhari daadi ka niyam?', 0, -70, 54, '#fff', { weight: 900 });
      K.text(ctx, 'Comment karo 👇'.replace(' 👇', ''), 0, 20, 46, '#ffb0a0', { weight: 800 });
      K.text(ctx, 'Best wala = agli reel', 0, 100, 40, '#ccc', { weight: 700 });
      ctx.restore();
    } else {
      ctx.fillStyle = `rgba(0,0,0,${0.7 * seg(lt, loopAt, loopAt + 0.3)})`; ctx.fillRect(0, 0, 1080, 1920);
      rings(ctx, 480, 700, lt, [loopAt + 0.1, loopAt + 0.9]);
      K.text(ctx, 'NAAM x2', 480, 420, 140, RED, { weight: 900, a: seg(lt, loopAt + 0.2, loopAt + 0.6) });
    }
  }
};
function eback2(x) { return K.eback(x); }

export const VideoClock = K.makeClock(R, { badge: 'DAADI KE NIYAM' });
