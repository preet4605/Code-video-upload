// Reel 3: "Lift mein 13 ka button nahi hota". Original code-drawn art.
import * as K from '../tools/kit.mjs';
const { cl, seg, eo, eio, lerp, TAU, RED } = K;

const FLOORS = [15, 14, 12, 11, 10, 9, 8, 7];
// steel lift panel; show13 0..1, pressed 0..1
function panel(ctx, cx, cy, k, lt, { show13 = 1, pressed = 0 } = {}) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
  const g = ctx.createLinearGradient(-230, 0, 230, 0); g.addColorStop(0, '#3a3d44'); g.addColorStop(0.5, '#6b6f78'); g.addColorStop(1, '#2e3036');
  K.rrect(ctx, -230, -470, 460, 940, 26, g);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-230, -470, 460, 940, 26); ctx.stroke();
  // display
  K.rrect(ctx, -150, -430, 300, 110, 12, '#050505');
  const btn = (x, y, label, lit, col = '255,170,60') => {
    if (lit > 0) K.glow(ctx, x, y, 120, col, 0.55 * lit);
    K.circ(ctx, x, y, 56, '#1b1c20'); K.circ(ctx, x, y, 46, lit > 0 ? `rgba(${col},${0.25 + 0.6 * lit})` : '#2c2e34');
    ctx.strokeStyle = lit > 0 ? `rgba(${col},1)` : '#777'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 46, 0, TAU); ctx.stroke();
    K.text(ctx, label, x, y + 2, 44, lit > 0 ? '#fff' : '#c8c8c8', { weight: 800, shadow: false });
  };
  const slots = [[-90, -230], [90, -230], [-90, -90], [90, -90], [-90, 50], [90, 50], [-90, 190], [90, 190], [-90, 330], [90, 330]];
  const labels = [15, 14, '13', 12, 11, 10, 9, 8, 7, 6];
  labels.forEach((L, i) => {
    const [x, y] = slots[i];
    if (L === '13') { if (show13 > 0) { ctx.save(); ctx.globalAlpha = show13; btn(x, y, '13', 0.6 + 0.4 * Math.sin(lt * 4) + pressed, '224,27,36'); ctx.restore(); } else { K.circ(ctx, x, y, 56, '#43464d'); } }
    else btn(x, y, String(L), 0);
  });
  ctx.restore();
}
function display(ctx, cx, cy, k, s, col = '#ff4a3a') { ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); K.text(ctx, s, 0, -375, 84, col, { weight: 900, shadow: false }); ctx.restore(); }

function liftInterior(ctx, lt) {
  K.bg(ctx, ['#16181c', '#24272d', '#121316']);
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; for (let i = 0; i < 6; i++) ctx.fillRect(i * 200, 0, 4, 1920);
  K.glow(ctx, 540, 120, 700, '230,235,255', 0.28 * K.flick(lt, 1));
}

function corridor(ctx, lt, knock = 0) {
  K.bg(ctx, ['#0b0c10', '#15171c', '#0b0c0f']);
  const vx = 540, vy = 820;
  // floor / ceiling
  ctx.fillStyle = '#1b1712'; ctx.beginPath(); ctx.moveTo(0, 1920); ctx.lineTo(vx - 60, vy + 70); ctx.lineTo(vx + 60, vy + 70); ctx.lineTo(1080, 1920); ctx.fill();
  ctx.fillStyle = '#0e0f12'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(vx - 60, vy - 90); ctx.lineTo(vx + 60, vy - 90); ctx.lineTo(1080, 0); ctx.fill();
  // ceiling lights
  for (let i = 0; i < 6; i++) { const k = Math.pow(0.68, i); const y = lerp(vy - 90, 80, k); K.glow(ctx, vx, y + 20, 260 * k, '235,240,255', 0.35 * K.flick(lt, i)); K.rrect(ctx, vx - 70 * k, y, 140 * k, 16 * k, 4, 'rgba(240,245,255,0.9)'); }
  // doors both sides, shaking
  for (let i = 0; i < 5; i++) {
    const k0 = Math.pow(0.66, i), k1 = Math.pow(0.66, i + 0.55);
    for (const side of [-1, 1]) {
      const sh = knock * Math.sin(lt * 60 + i * 2 + side) * 6 * k0;
      const xa = vx + side * lerp(60, 540, k0), xb = vx + side * lerp(60, 540, k1);
      const ya0 = lerp(vy - 90, 0, k0) + 120 * k0, ya1 = lerp(vy + 70, 1920, k0) - 10;
      const yb0 = lerp(vy - 90, 0, k1) + 120 * k1, yb1 = lerp(vy + 70, 1920, k1) - 10;
      ctx.fillStyle = '#3a2a1c'; ctx.beginPath(); ctx.moveTo(xa + sh, ya0); ctx.lineTo(xb + sh, yb0); ctx.lineTo(xb + sh, yb1); ctx.lineTo(xa + sh, ya1); ctx.fill();
      ctx.strokeStyle = '#140e09'; ctx.lineWidth = 5 * k0; ctx.stroke();
    }
  }
}

const R = {
  hook(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fx: 450, fy: 820, z0: 1.25, z1: 1.35, kick: K.kickAt(lt, 0, 0.4) });
    liftInterior(ctx, lt); panel(ctx, 480, 900, 1.0, lt, { show13: 1 }); ctx.save(); ctx.globalAlpha = 1 - seg(lt, 0.9, 1.2); display(ctx, 480, 900, 1.0, '13'); ctx.restore();
    ctx.restore();
    K.slamText(ctx, 'MAT DABAANA', 480, 420, 104, eo(seg(lt, 1.2, 1.6)), { shake: 18 });
  },
  setup(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { z1: 1.05 });
    K.bg(ctx, ['#04060c', '#0b1224', '#101a30']);
    // building with floor numbers; 13 is missing
    K.rrect(ctx, 250, 260, 460, 1500, 8, '#0b0d13');
    const labels = [16, 15, 14, 12, 11, 10, 9, 8];
    labels.forEach((L, i) => {
      const y = 330 + i * 170;
      for (let w = 0; w < 4; w++) { const on = (K.mulberry32(i * 7 + w)() > 0.45); ctx.fillStyle = on ? `rgba(255,190,110,${0.8 * K.flick(lt, i + w)})` : '#141824'; ctx.fillRect(290 + w * 100, y, 70, 90); }
      const hl = (L === 14 || L === 12) ? seg(lt, 1.0, 2.0) : 0;
      K.text(ctx, String(L), 800, y + 45, 56, hl > 0 ? `rgb(255,${lerp(255, 60, hl)},${lerp(255, 50, hl)})` : 'rgba(255,255,255,0.7)', { weight: 900 });
    });
    const p = eo(seg(lt, 2.2, 2.8));
    if (p > 0) { ctx.save(); ctx.globalAlpha = p; ctx.strokeStyle = RED; ctx.lineWidth = 8; ctx.setLineDash([16, 12]); ctx.beginPath(); ctx.moveTo(760, 330 + 2 * 170 + 100); ctx.lineTo(900, 330 + 2 * 170 + 100); ctx.stroke(); ctx.setLineDash([]); K.text(ctx, '13 ?', 860, 330 + 2 * 170 + 60 + 70, 54, RED, { weight: 900 }); ctx.restore(); }
    ctx.restore();
  },
  lift(ctx, lt, dur) {
    const show = seg(lt, dur * 0.38, dur * 0.48);
    const press = seg(lt, dur * 0.82, dur * 0.92);
    ctx.save(); K.camera(ctx, lt, dur, { fx: 480, fy: 900, z0: 1.0, z1: lerp(1.0, 1.3, 1) });
    liftInterior(ctx, lt); panel(ctx, 480, 920, 1.0, lt, { show13: show, pressed: press });
    display(ctx, 480, 920, 1.0, show < 0.5 ? '1' : (press > 0 ? '13' : '1'));
    // hand reaching towards 13 (moves slowly, finger points)
    const reach = eio(seg(lt, dur * 0.55, dur * 0.9));
    const hx = lerp(1000, 420, reach), hy = lerp(1500, 860, reach);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.75);
    K.rrect(ctx, -40, 0, 80, 520, 30, '#0a0a0b'); K.ell(ctx, 0, -10, 48, 60, '#0a0a0b'); K.rrect(ctx, -12, -150, 26, 140, 12, '#0a0a0b');
    ctx.restore();
    ctx.restore();
    const c = 1 - seg(lt, dur * 0.3, dur * 0.36);
    if (c > 0) { ctx.save(); ctx.globalAlpha = c; K.rrect(ctx, 320, 300, 320, 140, 18, 'rgba(0,0,0,0.75)'); K.text(ctx, '1:00 AM', 480, 372, 72, RED, { weight: 900 }); ctx.restore(); }
  },
  corridor(ctx, lt, dur) {
    const knock = seg(lt, dur * 0.45, dur * 0.5) * (0.5 + 0.5 * Math.abs(Math.sin(lt * 2.2)));
    const open = eio(seg(lt, 0, 1.2));
    ctx.save(); K.camera(ctx, lt, dur, { fy: 820, z0: 1.0, z1: 1.12, kick: knock * 0.25 });
    corridor(ctx, lt, knock);
    // lift doors sliding open in the foreground
    ctx.fillStyle = '#5b5f68'; ctx.fillRect(-100, -100, 640 - 640 * open, 2200); ctx.fillRect(540 + 640 * open, -100, 640, 2200);
    ctx.restore();
    if (lt > dur * 0.5) K.slamText(ctx, 'KHAT  KHAT', 480, 420, 96, eo(seg(lt, dur * 0.5, dur * 0.56)), { shake: 22 });
  },
  home(ctx, lt, dur) {
    const close = eio(seg(lt, 0.2, 1.2));
    ctx.save(); K.camera(ctx, lt, dur, { fy: 820, z0: 1.0, z1: 0.94, kick: 0.2 });
    corridor(ctx, lt, 1);
    ctx.fillStyle = '#5b5f68'; ctx.fillRect(-100, -100, 640 * close, 2200); ctx.fillRect(1180 - 640 * close, -100, 640, 2200);
    ctx.restore();
    if (close > 0.9) { const n = 13 + Math.floor(seg(lt, 1.3, dur - 0.4) * 1.99); ctx.save(); K.rrect(ctx, 330, 600, 300, 160, 18, '#050505'); K.text(ctx, String(n === 13 ? 13 : n), 480, 682, 110, '#ff4a3a', { weight: 900, shadow: false }); K.text(ctx, '▲', 480, 820, 60, '#ff4a3a', { shadow: false, a: 0.5 + 0.5 * Math.sin(lt * 8) }); ctx.restore(); }
  },
  twist(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 900, z0: 1.0, z1: 1.16 });
    K.bg(ctx, ['#0b0907', '#17110c', '#0a0807']);
    // home doorway with warm light, Mummy backlit
    ctx.fillStyle = 'rgba(255,190,120,0.95)'; ctx.fillRect(330, 560, 420, 860); K.glow(ctx, 540, 1000, 700, '255,180,100', 0.35);
    K.figure(ctx, 540, 1430, 1.45, { col: '#0a0705', hair: true, eyes: eo(seg(lt, dur * 0.7, dur * 0.9)) * 0.9 });
    ctx.strokeStyle = '#050403'; ctx.lineWidth = 26; ctx.strokeRect(330, 560, 420, 860);
    // floor sign beside door
    K.rrect(ctx, 790, 760, 160, 110, 10, '#0a0a0a'); K.text(ctx, '13', 870, 816, 72, RED, { weight: 900, shadow: false, a: seg(lt, dur * 0.65, dur * 0.75) });
    K.text(ctx, '14', 870, 816, 72, '#ddd', { weight: 900, shadow: false, a: 1 - seg(lt, dur * 0.65, dur * 0.75) });
    ctx.restore();
  },
  cta_loop(ctx, lt, dur) {
    const loopAt = dur - 1.9;
    ctx.save(); K.camera(ctx, lt, dur, { fx: 450, fy: 820, z0: 1.0, z1: lt < loopAt ? 1.0 : 1.3 });
    liftInterior(ctx, lt);
    const z = lt < loopAt ? 0.75 : lerp(0.75, 1.0, eio(seg(lt, loopAt, dur)));
    panel(ctx, 480, lt < loopAt ? 1250 : lerp(1250, 900, eio(seg(lt, loopAt, dur))), z, lt, { show13: 1 });
    ctx.restore();
    if (lt < loopAt) {
      K.text(ctx, 'Tumhari building mein 13?', 480, 400, 54, '#fff', { weight: 900 });
      K.choiceCards(ctx, 'Haan, hai', 'Nahi, skip hai', eo(seg(lt, 0.1, 0.9)), lt);
    }
  }
};

export const VideoClock = K.makeClock(R, { badge: 'DOOMSDAY HORROR' });
