// Reel 7: "Aaine mein der se jhapki". Original code-drawn art.
import * as K from '../tools/kit.mjs';
const { cl, seg, eo, eio, lerp, TAU, RED } = K;

// blink amount 0 (open) .. 1 (closed) for blinks at given times
function blinkAt(t, times, len = 0.22) { let b = 0; for (const t0 of times) { const p = (t - t0) / len; if (p >= 0 && p <= 1) b = Math.max(b, Math.sin(p * Math.PI)); } return b; }

function face(ctx, x, y, s, { blink = 0, smile = 0, skin = '#cfc6bd', hair = '#0b0909', eyesGlow = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // hair back
  ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(0, -10, 210, 270, 0, 0, TAU); ctx.fill();
  ctx.fillRect(-210, -10, 420, 420);
  K.ell(ctx, 0, 0, 160, 210, skin);
  // shading
  const g = ctx.createRadialGradient(-40, -60, 40, 0, 0, 230); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 160, 210, 0, 0, TAU); ctx.fill();
  // fringe
  ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(-170, -40); ctx.quadraticCurveTo(-120, -230, 0, -220); ctx.quadraticCurveTo(130, -230, 170, -40); ctx.quadraticCurveTo(60, -150, -170, -40); ctx.fill();
  // eyes
  for (const ex of [-62, 62]) {
    const h = 26 * (1 - blink);
    ctx.fillStyle = '#f1ece6'; ctx.beginPath(); ctx.ellipse(ex, -10, 42, Math.max(1.5, h), 0, 0, TAU); ctx.fill();
    if (h > 6) { K.circ(ctx, ex, -10, Math.min(18, h * 0.8), eyesGlow > 0 ? `rgba(200,20,20,1)` : '#1a120e'); K.circ(ctx, ex + 5, -15, 4, 'rgba(255,255,255,0.8)'); }
    ctx.strokeStyle = '#2a1d18'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(ex, -10, 42, Math.max(1.5, h), 0, Math.PI, TAU); ctx.stroke();
    if (eyesGlow > 0) K.glow(ctx, ex, -10, 60, '255,40,30', 0.4 * eyesGlow);
  }
  // nose + mouth
  ctx.strokeStyle = 'rgba(60,40,35,0.6)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(-10, 70); ctx.lineTo(8, 74); ctx.stroke();
  ctx.strokeStyle = '#3a1d1a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-50 - smile * 25, 120 - smile * 18); ctx.quadraticCurveTo(0, 120 + smile * 45, 50 + smile * 25, 120 - smile * 18); ctx.stroke();
  if (smile > 0.5) { ctx.fillStyle = `rgba(240,235,225,${(smile - 0.5) * 2})`; ctx.beginPath(); ctx.moveTo(-60, 108); ctx.quadraticCurveTo(0, 150, 60, 108); ctx.quadraticCurveTo(0, 128, -60, 108); ctx.fill(); }
  ctx.restore();
}

function mirrorFrame(ctx, x, y, w, h, fn) {
  ctx.save();
  K.rrect(ctx, x - 30, y - 30, w + 60, h + 60, 40, '#2a2016');
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#1d2128'); g.addColorStop(1, '#0d0f13'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  fn();
  // glass sheen
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.moveTo(x, y + h * 0.3); ctx.lineTo(x + w * 0.4, y); ctx.lineTo(x + w * 0.55, y); ctx.lineTo(x, y + h * 0.5); ctx.fill();
  ctx.restore();
}

function bathroom(ctx, lt) {
  K.bg(ctx, ['#0b0c0e', '#15171a', '#0a0b0c']);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 2;
  for (let y = 0; y < 1920; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1080, y); ctx.stroke(); }
  for (let x = 0; x < 1080; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1920); ctx.stroke(); }
  K.glow(ctx, 480, 300, 600, '235,240,255', 0.25 * K.flick(lt));
}

// mirror scene: viewer's head from behind at bottom, reflection face inside the mirror
function mirrorScene(ctx, lt, { lag = 0, smile = 0, blinks = [], eyesGlow = 0 } = {}) {
  bathroom(ctx, lt);
  mirrorFrame(ctx, 170, 420, 620, 800, () => face(ctx, 480, 820, 1.25, { blink: blinkAt(lt, blinks.map((b) => b + lag)), smile, eyesGlow }));
  // the real person's head from behind (silhouette), bottom-left
  ctx.fillStyle = '#060606'; K.ell(ctx, 300, 1640, 240, 300, '#060606'); ctx.fillRect(60, 1700, 480, 400);
}

const R = {
  hook(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 820, z0: 1.1, z1: 1.18 });
    mirrorScene(ctx, lt, { lag: 0.35, blinks: [0.5, 2.2] });
    ctx.restore();
    // left: real blink indicator, right: reflection indicator
    const r = blinkAt(lt, [0.5, 2.2]), f = blinkAt(lt, [0.85, 2.55]);
    K.text(ctx, r > 0.3 ? 'TUM: blink' : 'TUM', 260, 1110, 42, '#fff', { weight: 800, a: 0.9 });
    K.text(ctx, f > 0.3 ? 'WO: blink' : 'WO', 700, 1110, 42, RED, { weight: 900, a: 0.9 });
  },
  test(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 820, z0: 1.0, z1: 1.06 });
    mirrorScene(ctx, lt, { lag: 0, blinks: [dur * 0.35, dur * 0.62, dur * 0.85] });
    ctx.restore();
    K.rrect(ctx, 290, 300, 380, 100, 16, 'rgba(0,0,0,0.7)'); K.text(ctx, 'TEST: blink', 480, 352, 56, '#fff', { weight: 900 });
    if (lt > dur * 0.6) K.text(ctx, 'Saath = Normal ✓', 480, 1110, 46, '#8ef0a4', { weight: 900, a: seg(lt, dur * 0.6, dur * 0.7) });
  },
  test2(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 820, z0: 1.06, z1: 1.2 });
    mirrorScene(ctx, lt, { lag: 0.4, blinks: [dur * 0.3] });
    ctx.restore();
    K.slamText(ctx, 'WO TUM NAHI HO', 480, 340, 84, eo(seg(lt, dur * 0.6, dur * 0.72)), { shake: 18 });
  },
  neha(ctx, lt, dur) {
    const smile = eio(seg(lt, dur * 0.5, dur * 0.7));
    ctx.save(); K.camera(ctx, lt, dur, { fy: 900, z0: 1.0, z1: 1.25 });
    mirrorScene(ctx, lt, { lag: 0.45, blinks: [dur * 0.2], smile });
    ctx.restore();
    K.rrect(ctx, 330, 300, 300, 90, 16, 'rgba(0,0,0,0.7)'); K.text(ctx, 'NEHA', 480, 347, 56, '#fff', { weight: 900 });
  },
  twist(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fx: 700, fy: 760, z0: 1.0, z1: 1.18 });
    K.bg(ctx, ['#0a0d14', '#151b26', '#0b0d12']);
    // dawn window
    ctx.fillStyle = '#3a4560'; ctx.fillRect(110, 450, 260, 360); K.glow(ctx, 240, 630, 260, '255,190,150', 0.35);
    ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 14; ctx.strokeRect(110, 450, 260, 360);
    // sleeping Neha
    K.bed(ctx, 430, 1360, 0.95, { covered: true, breath: lt });
    // wall mirror: her reflection is standing, awake, smiling
    mirrorFrame(ctx, 560, 420, 340, 520, () => face(ctx, 730, 690, 0.65, { smile: 1, eyesGlow: eo(seg(lt, dur * 0.5, dur * 0.8)) }));
    ctx.restore();
    K.rrect(ctx, 330, 300, 300, 90, 16, 'rgba(0,0,0,0.7)'); K.text(ctx, '5:30 AM', 480, 347, 54, '#ffd27a', { weight: 900 });
  },
  cta_loop(ctx, lt, dur) {
    const loopAt = dur - 1.8;
    ctx.save(); K.camera(ctx, lt, dur, { fy: 820, z0: 1.0, z1: lt < loopAt ? 1.02 : 1.1 });
    mirrorScene(ctx, lt, { lag: 0.35, blinks: [loopAt + 0.4] });
    ctx.restore();
    if (lt < loopAt) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, 1080, 1920);
      K.text(ctx, 'Tumhara result?', 480, 400, 62, '#fff', { weight: 900 });
      K.choiceCards(ctx, 'Normal', 'Der se', eo(seg(lt, 0.1, 0.9)), lt);
    }
  }
};

export const VideoClock = K.makeClock(R, { badge: null });
