// Upar Wali Berth: overnight sleeper coach S7. Code-drawn: lib/cinema camera layers + lib/kit figures + set_coach.mjs.
// Contract: VideoClock.setTime(t); VideoClock.draw(ctx, w, h, timeline). Deterministic f(t). All timing from timeline events (makeClock) via cues.mjs.
import * as kit from '../../../.claude/skills/reel-factory/lib/kit/index.mjs';
import { makeClock } from '../../../.claude/skills/reel-factory/lib/events.mjs';
import * as K from '../../../.claude/skills/reel-factory/examples/zero-shadow-day/tools/kit.mjs';
import { resolveCues, sweepAt, tubeAt, glintAt } from './cues.mjs';
import * as C from './set_coach.mjs';
import { shots } from './shots.mjs';

const { cin } = kit;
let T = 0, ctxCache = null;
function env(timeline) {
  if (ctxCache?.tl === timeline) return ctxCache;
  const clock = makeClock(timeline), cues = resolveCues(clock);
  ctxCache = { tl: timeline, clock, cues, stopT: clock.at('stop'), itarsiT: clock.at('itarsi'), scareT: clock.at('scare'), reliefT: clock.at('relief') };
  return ctxCache;
}

// local-contrast ("clarity") pass: unsharp mask on luma, so lit edges, bars, seams and ink lines hold a hard edge against the dark. Deterministic.
function clarity(ctx, w, h, amount = 1.4, rad = 7) {
  const r = Math.max(1, Math.round(rad * w / 1080)), id = ctx.getImageData(0, 0, w, h), d = id.data, n = w * h;
  let a = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) a[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
  const box = (src, dst, horiz) => { const L = horiz ? w : h, M = horiz ? h : w, st = horiz ? 1 : w, ln = horiz ? w : 1; for (let m = 0; m < M; m++) { const base = m * ln; let acc = 0; for (let k = -r; k <= r; k++) acc += src[base + Math.min(L - 1, Math.max(0, k)) * st]; for (let k = 0; k < L; k++) { dst[base + k * st] = acc / (2 * r + 1); acc += src[base + Math.min(L - 1, k + r + 1) * st] - src[base + Math.max(0, k - r) * st]; } } };
  box(a, b, true); box(b, a, false); const blur = new Float32Array(n); blur.set(a);
  for (let i = 0, j = 0; i < n; i++, j += 4) { const l = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2], dl = amount * (l - blur[i]); d[j] = Math.max(0, Math.min(255, d[j] + dl)); d[j + 1] = Math.max(0, Math.min(255, d[j + 1] + dl)); d[j + 2] = Math.max(0, Math.min(255, d[j + 2] + dl)); }
  ctx.putImageData(id, 0, 0);
}
export const DURATION = 68.698;
export const VideoClock = {
  setTime(s) { T = s; },
  draw(ctx, width, height, timeline) {
    const E = env(timeline), t = Math.max(0, Math.min(T, timeline.duration_s - 1e-3)), scenes = timeline.scenes;
    const sc = scenes.find((s) => t >= s.start_s && t < s.end_s) || scenes[scenes.length - 1];
    const lt = t - sc.start_s, dur = sc.end_s - sc.start_s, frame = Math.round(t * 30);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    const shot = shots[sc.id] || shots.s1_hook;
    const out = shot(ctx, { t, lt, dur, sc, frame, E, w: width, h: height, tl: timeline, sweep: sweepAt(E.cues, t), glint: glintAt(E.cues, t), tube: t >= E.itarsiT - 0.2 ? 1 : tubeAt(E.cues, t, E.stopT) });
    const cam = out?.cam, preset = out?.post ?? { name: 'horror-night', grade: { contrast: 0.3 } };
    if (!out?.noPost) cin.post(ctx, { t, frame, seed: 5, cam }, preset);
    if (!out?.noPost) clarity(ctx, width, height, out?.clarity ?? 3.4, out?.clarityR ?? 4);
    if (out?.after) out.after(ctx);
    if (!out?.noCaption) {
      const s = width / 1080; ctx.save(); ctx.setTransform(s, 0, 0, s, 0, 0);
      const [cap, wd] = K.captionAt(timeline, t);
      if (cap) { const g = ctx.createLinearGradient(0, 1130, 0, 1460); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 1130, 1080, 330); K.horrorCaption(ctx, cap, wd, 1290); }
      ctx.restore();
    }
  },
};
