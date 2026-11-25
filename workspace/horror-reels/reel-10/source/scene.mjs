// Reel 10: "Teen baar khatkhatana" (Raat 2 Baje season finale). Original code-drawn art.
import * as K from '../tools/kit.mjs';
const { cl, seg, eo, eio, lerp, TAU, RED } = K;

// knock counter dots; hits = array of times (scene-local); max 3 slots
function knockDots(ctx, lt, hits, { y = 420, third = false } = {}) {
  const n = third ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const x = 480 + (i - (n - 1) / 2) * 170; const on = hits[i] !== undefined && lt >= hits[i];
    const pop = on ? 1 + 0.35 * (1 - cl((lt - hits[i]) / 0.25)) : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop);
    ctx.strokeStyle = i === 2 ? RED : '#ddd'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 52, 0, TAU); ctx.stroke();
    if (on) { K.circ(ctx, 0, 0, 44, i === 2 ? RED : '#f2f2f2'); K.glow(ctx, 0, 0, 140, i === 2 ? '224,27,36' : '255,255,255', 0.3); }
    K.text(ctx, String(i + 1), 0, 2, 50, on ? '#111' : '#bbb', { weight: 900, shadow: false });
    ctx.restore();
  }
}
// knock wave on the door surface
function knockWave(ctx, x, y, lt, hits) { for (const h of hits) { const p = (lt - h) / 0.7; if (p < 0 || p > 1) continue; ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - p)})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, 30 + p * 220, 0, TAU); ctx.stroke(); } }

function hallInside(ctx, lt, { open = 0, light = 1 } = {}) {
  K.bg(ctx, ['#0d0a09', '#1d1613', '#0e0b0a']);
  ctx.fillStyle = '#120e0c'; ctx.fillRect(0, 1340, 1080, 600);
  // night outside through the open door: empty porch
  if (open > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(330, 520, 320, 820); ctx.clip();
    K.bg(ctx, ['#03050a', '#0b1220', '#0d1424']); K.glow(ctx, 520, 640, 140, '200,210,240', 0.35); ctx.fillStyle = '#05070b'; ctx.fillRect(330, 1180, 320, 200);
    ctx.restore();
  }
  K.door(ctx, 330, 520, 320, 820, open, { leaf: '#17120f', lightRGB: '40,55,85', light: 0.25 });
  if (open === 0) { K.circ(ctx, 600, 940, 13, '#776'); K.lightUnderDoor(ctx, 330, 1340, 320, 0.25 * light, '160,180,230'); }
  K.glow(ctx, 900, 300, 500, '255,170,90', 0.12 * K.flick(lt));
  K.glow(ctx, 490, 760, 620, '255,160,90', 0.22 * K.flick(lt, 3));
}

function room(ctx, lt, figA = 0) {
  K.bg(ctx, ['#080606', '#130e0c', '#080606']);
  ctx.fillStyle = '#0d0a09'; ctx.fillRect(0, 1340, 1080, 600);
  K.bed(ctx, 380, 1250, 0.9, { covered: false });
  // stairs edge on the right + a figure standing in the corner, face toward us
  ctx.fillStyle = '#050404'; for (let i = 0; i < 6; i++) ctx.fillRect(760 + i * 40, 1340 - i * 110, 400, 110);
  if (figA > 0) K.figure(ctx, 640, 1340, 1.2, { col: `rgba(2,2,3,${figA})`, eyes: figA, hair: true });
}

const R = {
  hook(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 900, z0: 1.08, z1: 1.0, kick: K.kickAt(lt, 0.0, 0.3) + K.kickAt(lt, 0.45, 0.3) });
    hallInside(ctx, lt, { light: 0.4 });
    knockWave(ctx, 490, 900, lt, [0.0, 0.45]);
    ctx.restore();
    const showThird = lt < dur * 0.45;
    knockDots(ctx, lt, showThird ? [0.0, 0.45, dur * 0.25] : [0.0, 0.45], { third: true });
    K.text(ctx, showThird ? 'INSAAN' : 'YE', 480, 560, 58, showThird ? '#fff' : RED, { weight: 900 });
  },
  rule(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 900, z1: 1.06 });
    hallInside(ctx, lt);
    ctx.restore();
    const p = eo(seg(lt, dur * 0.25, dur * 0.4));
    ctx.save(); ctx.translate(480, 470); ctx.scale(p, p);
    K.rrect(ctx, -340, -100, 680, 200, 14, 'rgba(235,225,205,0.95)');
    K.text(ctx, 'AAKHRI NIYAM', 0, -40, 58, RED, { weight: 900, shadow: false });
    K.text(ctx, '2 khatke = mat kholna', 0, 40, 46, '#2a1a12', { weight: 800, shadow: false });
    ctx.restore();
  },
  riya(ctx, lt, dur) {
    const hits = [dur - 0.6, dur - 0.25];
    ctx.save(); K.camera(ctx, lt, dur, { fy: 900, z0: 1.0, z1: 1.1, kick: K.kickAt(lt, hits[0], 0.3) + K.kickAt(lt, hits[1], 0.3) });
    hallInside(ctx, lt);
    knockWave(ctx, 490, 900, lt, hits);
    ctx.restore();
    K.rrect(ctx, 330, 1040, 300, 110, 18, 'rgba(0,0,0,0.8)'); K.text(ctx, '2:00 AM', 480, 1096, 66, RED, { weight: 900, shadow: false });
    knockDots(ctx, lt, hits, { y: 540 });
  },
  third(ctx, lt, dur) {
    const hits = [0.1, 0.45, dur * 0.25];
    const open = eio(seg(lt, dur * 0.8, dur));
    ctx.save(); K.camera(ctx, lt, dur, { fy: 900, z0: 1.0, z1: 1.12, kick: K.kickAt(lt, hits[2], 0.4) });
    hallInside(ctx, lt, { open });
    knockWave(ctx, 490, 900, lt, hits);
    // Riya's hand on the handle
    if (lt > dur * 0.6) K.shadowHand(ctx, 610, 1000, 0.7, -0.3, 0.95);
    ctx.restore();
    knockDots(ctx, lt, hits, { third: true });
  },
  outside(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fx: 490, fy: 900, z0: 1.12, z1: 1.35 });
    hallInside(ctx, lt, { open: 1 });
    ctx.restore();
    K.text(ctx, 'KHAALI', 480, 420, 80, '#dfe6f5', { weight: 900, a: seg(lt, 0.4, 0.9) });
  },
  twist(ctx, lt, dur) {
    // camera turns to face the room
    const turn = eio(seg(lt, 0, 0.7));
    ctx.save(); K.camera(ctx, lt, dur, { fx: 600, fy: 900, z0: 1.0, z1: 1.15, kick: K.kickAt(lt, dur - 0.9, 0.4) });
    ctx.save(); ctx.translate(-1080 * (1 - turn), 0); room(ctx, lt, eo(seg(lt, dur * 0.5, dur * 0.8))); ctx.restore();
    if (turn < 1) { ctx.save(); ctx.translate(1080 * turn, 0); hallInside(ctx, lt, { open: 1 }); ctx.restore(); }
    ctx.restore();
    if (lt > dur * 0.6) K.slamText(ctx, 'ANDAR SE', 480, 420, 120, eo(seg(lt, dur * 0.6, dur * 0.7)), { shake: 22 });
  },
  cta_loop(ctx, lt, dur) {
    const loopAt = dur - 1.9;
    ctx.save(); K.camera(ctx, lt, dur, { fy: 900, z0: 1.0, z1: lt < loopAt ? 1.02 : 1.08 });
    if (lt < loopAt) room(ctx, lt, 0.6); else hallInside(ctx, lt, { light: 0.4 });
    ctx.restore();
    if (lt < loopAt) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, 1080, 1920);
      K.text(ctx, 'SEASON 1 KHATAM', 480, 400, 62, RED, { weight: 900 });
      K.choiceCards(ctx, 'Riya bachti hai', 'Ghar jeet jaata hai', eo(seg(lt, 0.1, 0.9)), lt);
      const f = seg(lt, dur * 0.55, dur * 0.65);
      if (f > 0) { const pl = 1 + 0.05 * Math.sin(lt * 6); ctx.save(); ctx.translate(480, 1020); ctx.scale(pl * f, pl * f); K.rrect(ctx, -200, -50, 400, 100, 50, RED); K.text(ctx, 'FOLLOW', 0, 3, 56, '#fff', { weight: 900, shadow: false }); ctx.restore(); }
    } else {
      const h = [loopAt + 0.2, loopAt + 0.65];
      knockDots(ctx, lt, h, { third: true });
    }
  }
};

export const VideoClock = K.makeClock(R, { badge: 'RAAT 2 BAJE · FINALE' });
