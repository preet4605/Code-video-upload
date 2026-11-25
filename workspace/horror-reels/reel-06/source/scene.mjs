// Reel 6: "Highway pe lift mat dena". Original code-drawn art.
import * as K from '../tools/kit.mjs';
const { cl, seg, eo, eio, lerp, TAU, RED } = K;

const VX = 540, VY = 760; // vanishing point
// road with scrolling dashes; speed in "units/s"
function road(ctx, t, { speed = 1.2, beams = 1 } = {}) {
  K.bg(ctx, ['#020306', '#070a12', '#05060a']);
  // tree-line silhouettes
  ctx.fillStyle = '#010102';
  ctx.beginPath(); ctx.moveTo(0, VY + 10); for (let x = 0; x <= 1080; x += 30) ctx.lineTo(x, VY - 40 - Math.abs(Math.sin(x * 0.03)) * 60 - Math.abs(Math.sin(x * 0.011)) * 50); ctx.lineTo(1080, VY + 10); ctx.fill();
  // asphalt
  ctx.fillStyle = '#0d0e12'; ctx.beginPath(); ctx.moveTo(VX - 14, VY); ctx.lineTo(VX + 14, VY); ctx.lineTo(1300, 1920); ctx.lineTo(-220, 1920); ctx.fill();
  // headlight cone
  if (beams > 0) { const g = ctx.createLinearGradient(0, 1920, 0, VY); g.addColorStop(0, `rgba(255,240,200,${0.35 * beams})`); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(VX - 60, VY + 20); ctx.lineTo(VX + 60, VY + 20); ctx.lineTo(1180, 1920); ctx.lineTo(-100, 1920); ctx.fill(); }
  // center dashes (perspective)
  for (let i = 0; i < 14; i++) {
    const z = ((i / 14 + t * speed * 0.25) % 1); const k = Math.pow(z, 2.2);
    const y = lerp(VY, 1960, k); const h = lerp(4, 160, k); const w = lerp(2, 26, k);
    ctx.fillStyle = `rgba(240,220,150,${0.25 + 0.6 * k})`; ctx.fillRect(VX - w / 2, y, w, h);
  }
  // edge lines
  ctx.strokeStyle = 'rgba(230,230,230,0.35)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(VX - 10, VY); ctx.lineTo(-120, 1920); ctx.moveTo(VX + 10, VY); ctx.lineTo(1200, 1920); ctx.stroke();
}

// woman in white on the roadside; depth 0 (far) .. 1 (near), hand waving
function woman(ctx, depth, lt, { side = 1, a = 1 } = {}) {
  const k = Math.pow(depth, 1.6);
  const x = VX + side * lerp(40, 520, k), y = lerp(VY + 10, 1700, k), s = lerp(0.08, 1.4, k);
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(s, s);
  K.glow(ctx, 0, -300, 420, '230,235,255', 0.25);
  ctx.fillStyle = '#e9ecf2';
  ctx.beginPath(); ctx.moveTo(-80, 0); ctx.bezierCurveTo(-80, -220, -60, -420, -40, -470); ctx.lineTo(40, -470); ctx.bezierCurveTo(60, -420, 80, -220, 80, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0b0b0d'; K.ell(ctx, 0, -520, 40, 52, '#0b0b0d');
  ctx.beginPath(); ctx.moveTo(-44, -540); ctx.bezierCurveTo(-70, -420, -60, -300, -40, -240); ctx.lineTo(40, -240); ctx.bezierCurveTo(60, -300, 70, -420, 44, -540); ctx.fill(); // long hair
  ctx.fillStyle = '#d8dce6'; ctx.beginPath(); ctx.moveTo(-50, -540); ctx.quadraticCurveTo(0, -590, 50, -540); ctx.lineTo(70, -420); ctx.lineTo(-70, -420); ctx.closePath(); ctx.fill(); // pallu over head
  // raised waving arm
  const w = Math.sin(lt * 4) * 0.25;
  ctx.save(); ctx.translate(-side * 50, -430); ctx.rotate(-side * (2.4 + w));
  ctx.fillStyle = '#e9ecf2'; ctx.fillRect(-12, 0, 24, 170); K.ell(ctx, 0, 180, 18, 24, '#c9b8a8');
  ctx.restore();
  ctx.restore();
}

function milestone(ctx, depth, label) {
  const k = Math.pow(depth, 1.6); const x = VX - lerp(40, 520, k), y = lerp(VY + 10, 1700, k), s = lerp(0.08, 1.4, k);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#e8e4da'; ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(-70, -160); ctx.arc(0, -160, 70, Math.PI, 0); ctx.lineTo(70, 0); ctx.fill();
  ctx.fillStyle = '#d63a1e'; ctx.beginPath(); ctx.arc(0, -160, 70, Math.PI, 0); ctx.fill();
  K.text(ctx, label, 0, -100, 44, '#111', { weight: 900, shadow: false });
  ctx.restore();
}

function cabin(ctx, lt) {
  // dashboard silhouette + steering wheel at bottom
  ctx.fillStyle = '#050505'; ctx.fillRect(0, 1500, 1080, 420);
  ctx.strokeStyle = '#0c0c0c'; ctx.lineWidth = 40; ctx.beginPath(); ctx.arc(540, 1900, 300, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  K.glow(ctx, 760, 1560, 80, '120,255,150', 0.35);
}

function sideMirror(ctx, x, y, s, lt, reveal) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-20, 150, 40, 140);
  K.rrect(ctx, -190, -150, 380, 300, 60, '#121212');
  ctx.save(); ctx.beginPath(); ctx.roundRect(-170, -130, 340, 260, 50); ctx.clip();
  K.bg(ctx, ['#05060a', '#0a0c14', '#07080b']);
  // inside of the truck cabin, back seat
  ctx.fillStyle = '#16120f'; ctx.fillRect(-170, 20, 340, 120);
  if (reveal > 0) {
    ctx.globalAlpha = reveal;
    ctx.fillStyle = '#e9ecf2'; ctx.beginPath(); ctx.moveTo(-30, 140); ctx.bezierCurveTo(-35, 40, -20, -10, 0, -20); ctx.bezierCurveTo(30, -10, 40, 40, 40, 140); ctx.fill();
    K.ell(ctx, 5, -50, 26, 34, '#0b0b0d'); ctx.fillStyle = '#d8dce6'; ctx.beginPath(); ctx.moveTo(-26, -60); ctx.quadraticCurveTo(5, -96, 36, -60); ctx.lineTo(44, 0); ctx.lineTo(-34, 0); ctx.fill();
    K.eyesPair(ctx, 5, -48, 0.4, reveal);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(200,210,230,0.25)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(-170, -130, 340, 260, 50); ctx.stroke();
  ctx.restore();
}

const R = {
  hook(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 1000, z0: 1.05, z1: 1.0 });
    road(ctx, lt);
    woman(ctx, lerp(0.55, 0.8, eio(lt / dur)), lt);
    ctx.restore();
    K.slamText(ctx, 'GAADI MAT ROKNA', 480, 420, 86, eo(seg(lt, dur * 0.55, dur * 0.7)), { shake: 16 });
  },
  rule(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 1000, z1: 1.04, kick: 0.05 });
    road(ctx, lt);
    cabin(ctx, lt);
    ctx.restore();
    // dashboard clock + rule card
    K.rrect(ctx, 300, 1000, 360, 130, 18, 'rgba(0,0,0,0.8)'); K.text(ctx, lt < dur * 0.5 ? '11:58 PM' : '12:04 AM', 480, 1066, 64, '#7dffa0', { weight: 900, shadow: false });
    const p = eo(seg(lt, dur * 0.45, dur * 0.6));
    if (p > 0) { ctx.save(); ctx.translate(480, 520); ctx.scale(p, p); K.rrect(ctx, -360, -110, 720, 220, 20, 'rgba(235,225,205,0.95)'); K.text(ctx, "PAPPU BHAIYA KA NIYAM", 0, -45, 46, RED, { weight: 900, shadow: false }); K.text(ctx, '12 ke baad lift nahi', 0, 40, 54, '#222', { weight: 800, shadow: false }); ctx.restore(); }
  },
  woman(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 1000, z0: 1.0, z1: 1.06 });
    road(ctx, lt);
    // she approaches as we drive, then whooshes past
    const d = eio(seg(lt, 0.2, dur * 0.95));
    if (d < 0.98) woman(ctx, lerp(0.15, 1.05, d), lt);
    ctx.restore();
  },
  repeat(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 1000, z0: 1.0, z1: 1.1 });
    road(ctx, lt, { speed: 1.6 });
    // three passes, each with a milestone, she is always there
    const n = 3; const ph = (lt / dur) * n; const i = Math.min(n - 1, Math.floor(ph)); const q = ph - i;
    milestone(ctx, lerp(0.2, 1.0, q), `KM ${52 + i * 10}`);
    woman(ctx, lerp(0.1, 0.95, q), lt, { a: 1 });
    ctx.restore();
    K.rrect(ctx, 330, 360, 300, 110, 16, 'rgba(0,0,0,0.7)'); K.text(ctx, `+${(i + 1) * 10} km`, 480, 416, 60, '#ffd27a', { weight: 900 });
  },
  mirror(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fx: 560, fy: 720, z0: 1.0, z1: 1.25 });
    road(ctx, lt);
    cabin(ctx, lt);
    // empty roadside now
    sideMirror(ctx, 560, 720, 1.15, lt, eo(seg(lt, dur * 0.45, dur * 0.65)));
    ctx.restore();
    const e = seg(lt, 0.3, 0.8); if (lt < dur * 0.45) K.text(ctx, 'Sadak khaali...', 480, 420, 58, '#fff', { weight: 800, a: e });
  },
  twist(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fx: 560, fy: 720, z0: 1.25, z1: 1.45 });
    road(ctx, lt); cabin(ctx, lt);
    sideMirror(ctx, 560, 720, 1.15, lt, 1);
    ctx.restore();
  },
  cta_loop(ctx, lt, dur) {
    const loopAt = dur - 1.9;
    ctx.save(); K.camera(ctx, lt, dur, { fy: 1000, z0: 1.0, z1: 1.03 });
    road(ctx, lt);
    if (lt >= loopAt) woman(ctx, lerp(0.4, 0.6, eio(seg(lt, loopAt, dur))), lt);
    ctx.restore();
    if (lt < loopAt) {
      K.text(ctx, 'Tum kya karte?', 480, 400, 62, '#fff', { weight: 900 });
      K.choiceCards(ctx, 'Gaadi roko', 'Mirror mat dekho', eo(seg(lt, 0.1, 0.9)), lt);
    }
  }
};

export const VideoClock = K.makeClock(R, { badge: 'HIGHWAY HORROR' });
