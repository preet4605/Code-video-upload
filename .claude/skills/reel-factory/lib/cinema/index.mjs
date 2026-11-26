// cinema: cinematic rendering library (camera, light, atmosphere, film, texture).
//   import * as cinema from '../../lib/cinema/index.mjs';
//   cinema.post(ctx, { t, frame, seed }, 'horror-night');   // last thing in scene.draw()
export * from './camera.mjs';
export * from './light.mjs';
export * from './atmos.mjs';
export * from './film.mjs';
export * from './texture.mjs';
export { hashPixels, pooled, frameSeed, easeInOut, easeOut, DW, DH } from './util.mjs';
import { glow, heatHaze, flushAdd } from './atmos.mjs';
import { snapshot, pooled } from './util.mjs';
import { grain, vignette, chromaticAberration, gateWeave, flicker, letterbox, dustScratches, grade, whipBlur } from './film.mjs';

/**
 * Presets: stage -> params (false/absent = skipped). Params can be overridden per call:
 *   post(ctx, info, { name: 'horror-night', grain: { amount: 0.2 }, chromaticAberration: false })
 */
export const PRESETS = {
  'horror-night': {
    grade: { gain: [0.96, 1.0, 1.06], saturation: 0.82, splitTone: { shadows: '#03121c', highlights: '#ffae6a', shadowStrength: 0.5, highlightStrength: 0.45 } },
    bloom: { threshold: 0.55, radius: 46, strength: 0.6 },
    halation: { threshold: 0.78, radius: 60, strength: 0.45 },
    chromaticAberration: { px: 3 },
    vignette: { strength: 0.72, hardness: 0.5 },
    flicker: { amount: 0.045 },
    grain: { amount: 0.5, size: 1.35 },
    dustScratches: { density: 0.8 },
  },
  // harsh noon: hard contrast, bleached colour, heat shimmer, blown highlights bloom - but the darks stay dark.
  'horror-day': {
    heatHaze: { amp: 4, centre: 0.55 },
    grade: { gamma: 0.9, gain: [1.04, 1.0, 0.9], saturation: 0.55, contrast: 0.6 },
    bloom: { threshold: 0.7, radius: 60, strength: 0.5 },
    halation: { threshold: 0.88, radius: 70, strength: 0.3, color: '#ffc070' },
    vignette: { strength: 0.38 },
    grain: { amount: 0.32, size: 1.2 },
    dustScratches: { density: 0.4 },
  },
  'warm-story': {
    grade: { gain: [1.04, 1.0, 0.93], contrast: 0.12, splitTone: { shadows: '#10202c', highlights: '#ffc58a', shadowStrength: 0.35, highlightStrength: 0.4 } },
    bloom: { threshold: 0.65, radius: 50, strength: 0.4 },
    halation: { threshold: 0.82, radius: 70, strength: 0.25 },
    vignette: { strength: 0.42 },
    grain: { amount: 0.24, size: 1.2 },
  },
  'clean-guide': {
        vignette: { strength: 0.2 },
    grain: { amount: 0.08, size: 1.1 },
  },
};

const ORDER = ['heatHaze', 'gateWeave', 'chromaticAberration', 'grade', 'glow', 'vignette', 'flicker', 'grain', 'dustScratches', 'letterbox'];

/**
 * Apply a post chain to the finished frame, in place. frameInfo: {t, frame, seed=1, cam?} (cam: a camera whose
 * velocity drives automatic whip motion blur). preset: name or {name, <stage>: params|false}.
 * Order: heatHaze, gateWeave (opt-in), CA, grade, bloom+halation (one pass), vignette, flicker, grain, dust, letterbox.
 */
export function post(ctx, frameInfo = {}, preset = 'clean-guide') {
  const name = typeof preset === 'string' ? preset : preset.name;
  const base = PRESETS[name];
  if (!base) throw new Error(`unknown cinema preset "${name}" (have ${Object.keys(PRESETS).join(', ')})`);
  const cfg = { ...base };
  if (typeof preset === 'object') for (const [k, v] of Object.entries(preset)) if (k !== 'name') cfg[k] = v === false ? false : { ...(base[k] || {}), ...v };
  const { t = 0, seed = 1 } = frameInfo, frame = frameInfo.frame ?? Math.round(t * 30);
  if (frameInfo.cam) whipBlur(ctx, frameInfo.cam);
  // one quarter-res snapshot of the incoming frame feeds every mask-type stage (split-tone, bloom, halation, CA)
  const need = (cfg.grade && cfg.grade.splitTone) || cfg.bloom || cfg.halation || cfg.chromaticAberration;
  const snap = need ? snapshot(ctx, 0.25, 'cin-snap') : null;
  // split-tone / bloom / halation masks are smooth: work at 1/8 res (derived from the quarter snapshot, ~0.5 ms)
  let snap8 = null;
  if (snap) { snap8 = pooled('cin-snap8', snap.width / 2, snap.height / 2); const x8 = snap8.getContext('2d'); x8.globalCompositeOperation = 'copy'; x8.imageSmoothingEnabled = true; x8.drawImage(snap, 0, 0, snap8.width, snap8.height); }
  // split-tone + bloom + halation all add light: accumulate at quarter res, ONE upscaled screen blit
  let addq = null;
  if (snap8 && ((cfg.grade && cfg.grade.splitTone) || cfg.bloom || cfg.halation)) { addq = pooled('cin-addq', snap8.width, snap8.height); const x = addq.getContext('2d'); x.globalCompositeOperation = 'source-over'; x.fillStyle = '#000'; x.fillRect(0, 0, addq.width, addq.height); }
  const afterGlow = ORDER.indexOf('glow');
  for (const st of ORDER) {
    if (addq && ORDER.indexOf(st) > afterGlow) { flushAdd(ctx, addq); addq = null; }
    const p = st === 'glow' ? (cfg.bloom || cfg.halation) : cfg[st]; if (!p) continue;
    switch (st) {
      case 'heatHaze': heatHaze(ctx, { t, ...p }); break;
      case 'gateWeave': gateWeave(ctx, { t, seed, ...p }); break;
      case 'grade': grade(ctx, { ...p, snap: snap8, addq }); break;
      case 'glow': glow(ctx, { bloom: cfg.bloom, halation: cfg.halation, snap: snap8, addq }); break;
      case 'chromaticAberration': chromaticAberration(ctx, { ...p, snap }); break;
      case 'vignette': vignette(ctx, p); break;
      case 'flicker': flicker(ctx, { t, seed, ...p }); break;
      case 'grain': grain(ctx, { frame, seed, ...p }); break;
      case 'dustScratches': dustScratches(ctx, { frame, seed, ...p }); break;
      case 'letterbox': letterbox(ctx, p); break;
    }
  }
  if (addq) flushAdd(ctx, addq);
}
