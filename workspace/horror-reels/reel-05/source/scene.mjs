// Reel 5: "3:33 pe Mummy ka call". Original code-drawn art; generic phone UI.
import * as K from '../tools/kit.mjs';
const { cl, seg, eo, eio, lerp, TAU, RED } = K;

// generic smartphone; mode: 'incoming' | 'active'
function phone(ctx, cx, cy, k, lt, { mode = 'incoming', callT = 0, ring = 1 } = {}) {
  ctx.save(); ctx.translate(cx + (mode === 'incoming' ? Math.sin(lt * 40) * 4 * ring : 0), cy); ctx.scale(k, k);
  K.glow(ctx, 0, 0, 560, '120,170,255', 0.25);
  K.rrect(ctx, -250, -500, 500, 1000, 60, '#0a0a0c');
  const g = ctx.createLinearGradient(0, -470, 0, 470); g.addColorStop(0, '#1b2a4a'); g.addColorStop(1, '#0b0f1e');
  K.rrect(ctx, -228, -478, 456, 956, 46, g);
  K.rrect(ctx, -60, -462, 120, 26, 13, '#000');
  K.text(ctx, '3:33 AM', 0, -380, 44, '#fff', { weight: 700, shadow: false });
  // avatar
  K.circ(ctx, 0, -200, 100, '#2c3f66'); K.circ(ctx, 0, -230, 40, '#8ea4cc'); K.ell(ctx, 0, -150, 66, 40, '#8ea4cc');
  K.text(ctx, 'Mummy', 0, -40, 70, '#fff', { weight: 800, shadow: false });
  if (mode === 'incoming') {
    K.text(ctx, 'calling...', 0, 30, 40, '#aab', { weight: 600, shadow: false, a: 0.6 + 0.4 * Math.sin(lt * 5) });
    for (let r = 0; r < 2; r++) { const q = ((lt * 0.9 + r * 0.5) % 1); ctx.strokeStyle = `rgba(80,220,120,${0.6 * (1 - q) * ring})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(120, 330, 56 + q * 70, 0, TAU); ctx.stroke(); }
    K.circ(ctx, -120, 330, 56, '#e0303a'); K.circ(ctx, 120, 330, 56, '#2fbf5a');
    K.text(ctx, '✕', -120, 332, 44, '#fff', { shadow: false }); K.text(ctx, '✆', 120, 334, 50, '#fff', { shadow: false });
  } else {
    const s = Math.floor(callT); K.text(ctx, `00:${String(s).padStart(2, '0')}`, 0, 30, 44, '#7fe0a0', { weight: 700, shadow: false });
    // waveform of her whisper
    ctx.strokeStyle = '#7fe0a0'; ctx.lineWidth = 4; ctx.beginPath();
    for (let x = -180; x <= 180; x += 6) { const a = 30 * Math.abs(Math.sin(lt * 7 + x * 0.05)) * Math.sin(x * 0.2 + lt * 13); ctx.lineTo(x, 170 + a); } ctx.stroke();
    K.circ(ctx, 0, 350, 56, '#e0303a'); K.text(ctx, '✕', 0, 352, 44, '#fff', { shadow: false });
  }
  ctx.restore();
}

function bedroom(ctx, lt) {
  K.bg(ctx, ['#05060a', '#0c0e16', '#07080c']);
  ctx.fillStyle = '#0a0b10'; ctx.fillRect(0, 1400, 1080, 520);
}

function roomDoor(ctx, x, y, w, h, lt, { knock = 0, feet = 0 } = {}) {
  const sh = knock * Math.sin(lt * 55) * 5;
  ctx.save(); ctx.translate(sh, 0);
  K.door(ctx, x, y, w, h, 0, { leaf: '#151217' });
  K.circ(ctx, x + w - 40, y + h * 0.52, 12, '#665');
  ctx.restore();
  K.lightUnderDoor(ctx, x, y + h, w, 0.85 * K.flick(lt, 5), '255,200,140');
  // two feet shadows breaking the light
  if (feet > 0) { ctx.save(); ctx.globalAlpha = feet; ctx.fillStyle = '#000'; ctx.fillRect(x + w * 0.3, y + h - 7, w * 0.12, 9); ctx.fillRect(x + w * 0.55, y + h - 7, w * 0.12, 9); ctx.restore(); }
}

const R = {
  hook(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 800, z0: 1.12, z1: 1.0 });
    bedroom(ctx, lt);
    phone(ctx, 480, 730, 0.85, lt, { mode: 'incoming' });
    ctx.restore();
  },
  hook2(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 900, z1: 1.06 });
    bedroom(ctx, lt);
    // the wall to Mummy's room: her door slightly open, she is asleep (bed shape)
    ctx.fillStyle = '#121520'; ctx.fillRect(200, 520, 560, 820);
    K.bed(ctx, 500, 1180, 0.8, { covered: true, breath: lt });
    K.glow(ctx, 900, 700, 300, '120,170,255', 0.3 * (0.6 + 0.4 * Math.sin(lt * 6)));
    ctx.restore();
    phone(ctx, 860, 520, 0.32, lt, { mode: 'incoming' });
    K.text(ctx, 'Mummy: so rahi hai', 480, 420, 52, '#fff', { weight: 800, a: seg(lt, 0.3, 0.8) });
  },
  call(ctx, lt, dur) {
    ctx.save(); K.camera(ctx, lt, dur, { fy: 800, z0: 1.0, z1: 1.1 });
    bedroom(ctx, lt);
    phone(ctx, 480, 730, 0.85, lt, { mode: 'active', callT: lt });
    ctx.restore();
    const w = seg(lt, dur * 0.45, dur * 0.55);
    if (w > 0) { ctx.save(); ctx.globalAlpha = cl(w * 2); K.rrect(ctx, 90, 820, 780, 200, 24, 'rgba(0,0,0,0.8)'); ctx.restore(); K.slamText(ctx, 'DARWAZA', 480, 870, 84, w, { shake: 10 }); K.slamText(ctx, 'MAT KHOLNA', 480, 965, 84, w, { shake: 10 }); }
  },
  door(ctx, lt, dur) {
    const knock = K.kickAt(lt, dur * 0.25, 0.8) + K.kickAt(lt, dur - 0.6, 0.6);
    ctx.save(); K.camera(ctx, lt, dur, { fy: 900, z0: 1.0, z1: 1.1, kick: knock * 0.6 });
    bedroom(ctx, lt);
    roomDoor(ctx, 330, 520, 300, 660, lt, { knock, feet: seg(lt, dur * 0.4, dur * 0.55) });
    ctx.restore();
    if (lt > dur * 0.25) K.slamText(ctx, 'KHAT KHAT', 480, 400, 100, eo(seg(lt, dur * 0.25, dur * 0.32)), { shake: 20 });
  },
  twist(ctx, lt, dur) {
    // split: phone left, door right
    ctx.save(); K.camera(ctx, lt, dur, { z0: 1.0, z1: 1.04 });
    bedroom(ctx, lt);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 540, 1920); ctx.clip(); phone(ctx, 270, 860, 0.62, lt, { mode: 'active', callT: 14 + lt }); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(540, 0, 540, 1920); ctx.clip(); roomDoor(ctx, 640, 560, 330, 640, lt, { feet: 1, knock: K.kickAt(lt, dur * 0.6, 0.5) }); ctx.restore();
    ctx.fillStyle = RED; ctx.fillRect(536, 300, 8, 1100);
    ctx.restore();
    K.text(ctx, 'MUMMY #1', 270, 420, 52, '#7fe0a0', { weight: 900, a: seg(lt, 0.2, 0.6) });
    K.text(ctx, 'MUMMY #2', 780, 420, 52, '#ffb070', { weight: 900, a: seg(lt, dur * 0.35, dur * 0.45) });
  },
  cta_loop(ctx, lt, dur) {
    const loopAt = dur - 1.8;
    ctx.save(); K.camera(ctx, lt, dur, { fy: 800, z0: 1.0, z1: lt < loopAt ? 1.0 : 1.12 });
    bedroom(ctx, lt);
    if (lt >= loopAt) phone(ctx, 480, 730, lerp(0.7, 0.85, eio(seg(lt, loopAt, loopAt + 0.6))), lt, { mode: 'incoming' });
    ctx.restore();
    if (lt < loopAt) {
      K.text(ctx, 'Tum kiski sunoge?', 480, 400, 62, '#fff', { weight: 900 });
      K.choiceCards(ctx, 'Phone wali Mummy', 'Darwaze wali', eo(seg(lt, 0.1, 0.9)), lt);
    }
  }
};

export const VideoClock = K.makeClock(R, { badge: 'DOOMSDAY HORROR' });
