// Reel 1: Raat 2 Baje, Part 3 "Teesra niyam toot gaya". Original code-drawn art.
import * as K from '../tools/kit.mjs';
const { cl, seg, eo, eio, lerp, TAU, RED } = K;

function bulb(ctx, x, y, lt, a = 1) {
  const sw = Math.sin(lt * 1.4) * 0.12;
  ctx.save(); ctx.translate(x, 0); ctx.rotate(sw);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, y); ctx.stroke();
  K.glow(ctx, 0, y + 20, 520, '255,180,100', 0.55 * a * K.flick(lt));
  K.circ(ctx, 0, y + 20, 22, `rgba(255,220,160,${a})`);
  ctx.restore();
}

function room(ctx, lt, warm = 1) {
  K.bg(ctx, ['#0a0809', '#16110f', '#0b0909']);
  ctx.fillStyle = '#0d0b0b'; ctx.fillRect(0, 1350, 1080, 600); // floor
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(540, 1350); ctx.lineTo(-400 + i * 235, 1920); ctx.stroke(); }
  K.glow(ctx, 760, 700, 700, '255,170,90', 0.16 * warm * K.flick(lt, 2));
}

function ruleCard(ctx, lt, p) {
  const br = 1 + 0.035 * Math.sin(lt * 2.2); ctx.save(); ctx.translate(480, 720); ctx.scale(br, br); ctx.translate(-480, -720);
  K.glow(ctx, 480, 700, 520, '224,27,36', 0.12 + 0.08 * Math.sin(lt * 3.1));
  K.slamText(ctx, 'NIYAM #3', 480, 640, 150, p, { shake: 30 });
  K.slamText(ctx, 'TOOT GAYA', 480, 800, 96, cl((p - 0.15) * 1.3), { col: '#ffffff', glowCol: '255,255,255', shake: 20 });
  K.dust(ctx, lt, 0.5, '255,120,110');
  ctx.restore();
}

const R = {
  hook(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { z0: 1.08, z1: 1.0, kick: K.kickAt(lt, 0, 0.5) });
    room(ctx, lt, 0.6); bulb(ctx, 540, 260, lt, 0.7);
    ctx.restore();
    ruleCard(ctx, lt, eo(lt / 0.35));
    K.glow(ctx, 480, 700, 600, '224,27,36', 0.18 * (1 - cl(lt / 1.2)));
  },
  recap(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 1100, z1: 1.05 });
    room(ctx, lt);
    // window with moon
    ctx.fillStyle = '#1b2433'; ctx.fillRect(640, 430, 260, 360); K.glow(ctx, 770, 560, 180, '170,190,230', 0.4);
    ctx.strokeStyle = '#090909'; ctx.lineWidth = 16; ctx.strokeRect(640, 430, 260, 360); ctx.beginPath(); ctx.moveTo(770, 430); ctx.lineTo(770, 790); ctx.moveTo(640, 610); ctx.lineTo(900, 610); ctx.stroke();
    const empty = seg(lt, dur * 0.62, dur * 0.72);
    K.bed(ctx, 480, 1200, 1.05, { covered: empty < 0.5, breath: lt });
    // ceiling shake + dust when the noise comes
    const shake = Math.max(0, Math.sin(lt * 3)) * seg(lt, 0.8, 1.6) * (1 - empty);
    for (let i = 0; i < 18; i++) { const r = K.mulberry32(i + 3); const x = 120 + r() * 800; const y = 280 + ((lt * (90 + r() * 80) + r() * 400) % 700); ctx.globalAlpha = 0.5 * shake; K.circ(ctx, x, y, 2 + r() * 3, '#bba'); }
    ctx.globalAlpha = 1;
    // rule note
    const p = eo(seg(lt, 0.2, 0.7));
    ctx.save(); ctx.translate(480, 470 - (1 - p) * 60); ctx.globalAlpha = p; ctx.rotate(-0.03);
    K.rrect(ctx, -330, -95, 660, 190, 14, 'rgba(235,225,205,0.95)');
    K.text(ctx, 'NIYAM #3', 0, -38, 64, RED, { weight: 900, shadow: false });
    K.text(ctx, 'Bistar mat chhodna', 0, 42, 48, '#2a1a12', { weight: 800, shadow: false });
    if (empty > 0) { ctx.strokeStyle = RED; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(-280, 50); ctx.lineTo(-280 + 560 * empty, 30); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
  },
  stairs(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 520, z0: 1.0, z1: 1.12 });
    K.bg(ctx, ['#060506', '#0d0a09', '#070606']);
    const open = eio(seg(lt, dur * 0.64, dur * 0.8));
    // door at top
    K.glow(ctx, 540, 470, 520, '190,210,255', 0.35 * open);
    K.door(ctx, 450, 330, 180, 290, open, { lightRGB: '150,170,220' });
    // stairs in perspective
    for (let i = 0; i < 12; i++) {
      const k = i / 11; const y = 640 + Math.pow(k, 1.3) * 1100; const hw = lerp(110, 520, k); const h = lerp(18, 90, k);
      ctx.fillStyle = `rgb(${18 + i * 2},${15 + i * 2},${14 + i * 2})`; ctx.fillRect(540 - hw, y, hw * 2, h);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(540 - hw, y, hw * 2, 3);
      if (open > 0) { ctx.fillStyle = `rgba(150,170,220,${0.12 * open * (1 - k)})`; ctx.fillRect(540 - hw, y, hw * 2, h); }
    }
    ctx.fillStyle = '#030303'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(430, 640); ctx.lineTo(20, 1920); ctx.lineTo(0, 1920); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1080, 0); ctx.lineTo(650, 640); ctx.lineTo(1060, 1920); ctx.lineTo(1080, 1920); ctx.fill();
    // Riya climbing (only between cuts; static silhouette that rises in steps)
    const step = Math.floor(seg(lt, dur * 0.3, dur * 0.62) * 4) / 4;
    if (lt > dur * 0.3) K.figure(ctx, 540, lerp(1700, 1250, step), lerp(1.2, 0.9, step), { col: '#020203', hair: true });
    ctx.restore();
    // clock 2:03
    const c = 1 - seg(lt, dur * 0.28, dur * 0.34);
    if (c > 0) { ctx.save(); ctx.globalAlpha = c; K.rrect(ctx, 300, 820, 360, 170, 20, 'rgba(0,0,0,0.75)'); K.text(ctx, '2:03', 480, 905, 120, RED, { weight: 900 }); K.glow(ctx, 480, 905, 260, '224,27,36', 0.25); ctx.restore(); }
  },
  roof(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 1150, z0: 1.0, z1: 1.18 });
    K.bg(ctx, ['#05070d', '#0d1424', '#121826']);
    K.glow(ctx, 760, 380, 260, '200,210,240', 0.5); K.circ(ctx, 760, 380, 70, '#dfe4f0');
    // parapet + water tank
    ctx.fillStyle = '#07080b'; ctx.fillRect(0, 880, 1080, 70); ctx.fillRect(110, 640, 230, 240); K.ell(ctx, 225, 640, 115, 30, '#07080b');
    ctx.fillStyle = '#0f131c'; ctx.fillRect(0, 950, 1080, 970);
    ctx.fillStyle = 'rgba(120,140,180,0.06)'; for (let i = 0; i < 8; i++) ctx.fillRect(0, 990 + i * 120, 1080, 2);
    // reversed wet footprints appearing one by one (toes point back toward the camera)
    const n = Math.floor(seg(lt, 0.4, dur * 0.55) * 8);
    for (let i = 0; i < n; i++) {
      const k = i / 7; const x = 480 + (i % 2 ? 50 : -50) * lerp(0.6, 1.4, k); const y = lerp(1000, 1640, k);
      K.footprint(ctx, x, y, 0, lerp(0.7, 1.5, k), cl((seg(lt, 0.4, dur * 0.55) * 8 - i) * 2), { reversed: true });
    }
    // toes highlight on the second line
    const hl = seg(lt, dur * 0.55, dur * 0.7);
    if (hl > 0) { K.glow(ctx, 480 + 50 * 1.4, 1640 + 60, 160, '224,27,36', 0.35 * hl * (0.7 + 0.3 * Math.sin(lt * 4))); }
    ctx.restore();
    const ar = seg(lt, dur * 0.6, dur * 0.75);
    if (ar > 0) { K.slamText(ctx, 'ULTE PAIR', 480, 560, 110, ar, { shake: 16 }); }
  },
  bed(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 1100, z0: 1.0, z1: 1.1 });
    room(ctx, lt, 0.7);
    // doorway light cast on floor (Riya stands in the doorway behind camera)
    ctx.fillStyle = 'rgba(255,200,130,0.12)'; ctx.beginPath(); ctx.moveTo(380, 1920); ctx.lineTo(470, 1350); ctx.lineTo(620, 1350); ctx.lineTo(760, 1920); ctx.fill();
    const covered = lt > dur * 0.4;
    K.bed(ctx, 520, 1180, 1.1, { covered, breath: lt });
    // Riya's shadow stretched across floor
    ctx.save(); ctx.globalAlpha = 0.85; ctx.translate(560, 1920); ctx.scale(1, -0.55); K.figure(ctx, 0, 0, 1.1, { col: '#000', hair: true }); ctx.restore();
    ctx.restore();
  },
  twist(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fx: 300, fy: 1060, z0: 1.4, z1: 1.75, kick: K.kickAt(lt, 0, 0.4) * 0.5 });
    room(ctx, lt, 0.4);
    K.bed(ctx, 520, 1180, 1.1, { covered: true, breath: lt });
    // eyes open under the hair on the pillow
    K.eyesPair(ctx, 270, 1062, 0.55, eo(seg(lt, 0.5, 1.0)), '255,60,40', 1);
    ctx.restore();
  },
  cta_loop(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { z0: 1.0, z1: 1.03 });
    room(ctx, lt, 0.35); K.bed(ctx, 520, 1400, 0.8, { covered: true, breath: lt });
    ctx.restore();
    const loopAt = dur - 1.75;
    if (lt < loopAt) {
      K.text(ctx, 'Asli Riya kaun?', 480, 400, 64, '#fff', { weight: 900 });
      K.choiceCards(ctx, 'Upar wali Riya', 'Bistar wali Riya', eo(seg(lt, 0.1, 0.9)), lt);
    } else {
      // loop: same red rule card as frame 1
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, 1080, 1920);
      ruleCard(ctx, lt, eo((lt - loopAt) / 0.35));
    }
  }
};

export const VideoClock = K.makeClock(R, { badge: 'RAAT 2 BAJE · PART 3' });
