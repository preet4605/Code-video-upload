// figures: the puppet character system.
//   const kid = createFigure({ age:'child', outfit:'uniform', seed:3 });
//   kid.draw(ctx, { x:540, feet:1500, height:620, pose:'walk', t, facing:1, light:LIGHTS.noon, gaze:[1,0] });
//   kid.shadow(ctx, state, { dir:[-0.3,0.9], squash:0.4 })     // multi-part cast shadow (one alpha, no overlap darkening)
// Everything is shaped paths (tapered limb ribbons, garment outlines, hair masses), lit by one light direction through a
// lit -> terminator -> core shadow -> bounce ramp and a cinema rimLight edge per part. Deterministic in (spec.seed, state).
import { Path2D, cin, smoothClosed, ribbon, mix, shade, rgba, cl, lerp, TAU, bboxOf, mulberry32, h01 } from '../util.mjs';
import { proportions, poseAngles, solve, blinkAt, talkAt, POSE_NAMES, AGE_NAMES, STYLE_NAMES } from './rig.mjs';
import { drawHead, grad, formStops, EXPR_NAMES, HAIR_STYLES } from './face.mjs';
import { drawHand, softStops, acrossGradient } from './hand.mjs';
import { OUTFITS, OUTFIT_NAMES, drawShawl } from './cloth.mjs';
export { POSE_NAMES, AGE_NAMES, EXPR_NAMES, HAIR_STYLES, OUTFIT_NAMES, STYLE_NAMES };

export const SKINS = ['#c68b5e', '#b57a4d', '#a2663f', '#8a5434', '#d3a074'];
/** light presets. dir = from the subject toward the light, in screen space (y down). */
export const LIGHTS = {
  noon: { dir: { x: 0.28, y: -0.96 }, key: '#fff4d6', amb: '#59627a', hard: true, strength: 1.0, rim: '#fff0c8', rimA: 0.8 },
  lamp: { dir: { x: -0.88, y: -0.3 }, key: '#ffc27a', amb: '#141a2c', strength: 1.15, rim: '#ffd29a', rimA: 1 },
  moon: { dir: { x: 0.75, y: -0.55 }, key: '#b3c4ff', amb: '#0b1124', strength: 1.1, rim: '#9fb6ff', rimA: 0.9 },
  doorway: { dir: { x: 0.95, y: -0.1 }, key: '#fff6e0', amb: '#1c130e', strength: 1.2, hard: true, rim: '#fff6e0', rimA: 1 },
  overcast: { dir: { x: 0.1, y: -1 }, key: '#e6ebf2', amb: '#7b8494', strength: 0.7, rim: '#ffffff', rimA: 0.25 },
};

const nullCtx = (() => { const f = function () {}; const p = new Proxy(f, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : p), set: () => true, apply: () => p }); return p; })();
// px-aware line widths: figure parts are authored in local units (height = 1), so a stroke of 0.005 is 15 px on a 3000 px close-up. Above ~900 px tall
// every lineWidth is capped (smoothly down to ~5.5 px at 3000 px) so close-ups keep fine ink, creases and lashes instead of marker lines.
const clampCtx = (ctx, H) => {
  if (H <= 900) return ctx;
  const cap = Math.max(5.5, 99 - ((H - 900) * (99 - 5.5)) / 2100) / H;
  return new Proxy(ctx, { get(t, k) { if (k === '__raw') return t; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; }, set(t, k, v) { t[k] = k === 'lineWidth' ? Math.min(v, cap) : v; return true; } });
};
// head space is scaled by head size again, so a head line width is clamped to the same SCREEN px cap divided by (H * head size): close-up faces keep their lines
const headCtx = (raw, H, hs) => {
  if (H <= 900) return raw; const cap = Math.max(5.5, 99 - ((H - 900) * (99 - 5.5)) / 2100) / (H * hs);
  return new Proxy(raw, { get(t, k) { const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; }, set(t, k, v) { t[k] = k === 'lineWidth' ? Math.min(v, cap) : v; return true; } });
};
const norm = (v) => { const m = Math.hypot(v.x, v.y) || 1; return { x: v.x / m, y: v.y / m }; };

/**
 * spec: {age:'child'|'adult'|'elder', sex:'m'|'f', outfit, skin, hair:{style,color}, colors:{a,b,c}, seed, variant:'normal'|'ghost',
 *        glasses, bindi, bangles, style:'illustrated'|'horror', hair.style 'receding' (grey elder, M hairline), moustache:{color,thick}, creased (deep elder face),
 *        headScale (head size multiplier at constant height), sockets (eyes stay black until state.eyeLight lights them), skinGrey (0..1, horror desaturation, default 0.3), shawl:{color,accent,side,drop,fringe} (wool drape over one shoulder)}
 * style 'illustrated' (default): big-headed story / kids puppets. style 'horror': adult-leaning proportions (smaller head, longer neck / limbs),
 * low-key faces (eyes in shadow, no catchlight unless state.eyeLight says a motivated source lights them, no pupils at distance), desaturated skin,
 * darker cloth, stronger silhouette + rim. horror + variant 'ghost': elongated, wet hair falling over the face, pale grey-green skin with a subsurface
 * tint (never metallic), uneven shoulders and a tilted head, no shadow of any kind.
 */
export function createFigure(spec = {}) {
  const age = spec.age ?? 'adult', sex = spec.sex ?? 'm', seed = spec.seed ?? 1, ghost = spec.variant === 'ghost', style = spec.style ?? 'illustrated', horror = style === 'horror';
  const B = proportions(age, sex, style, ghost);
  if (spec.headScale && spec.headScale !== 1) { // a bigger / smaller head at the same total height (the other lengths are renormalised)
    const ks = ['foot', 'shin', 'thigh', 'torso', 'neck', 'head']; B.head *= spec.headScale; const sum = ks.reduce((q, k) => q + B[k], 0); for (const k of ks) B[k] /= sum;
  }
  const outfitName = spec.outfit ?? 'shirt', O = OUTFITS[outfitName];
  if (!O) throw new Error(`unknown outfit "${outfitName}" (${OUTFIT_NAMES.join(', ')})`);
  let skin = spec.skin ?? SKINS[Math.floor(h01(seed, 5) * SKINS.length)];
  let colors = { ...O.defaults, ...(spec.colors || {}) };
  const hairSpec = { style: spec.hair?.style ?? (sex === 'f' ? 'bob' : age === 'elder' ? 'baldfringe' : age === 'child' ? 'crop' : 'oiled'), color: spec.hair?.color ?? (age === 'elder' ? '#cfcac0' : '#14100e') };
  if (ghost && !horror) { skin = '#9fa9a8'; hairSpec.style = 'wet'; hairSpec.color = '#0b0d10'; colors = Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, mix(shade(v, -0.18), '#6f7d88', 0.45)])); }
  if (horror && !ghost) { // desaturated skin, darker and flatter cloth
    skin = shade(mix(skin, '#7c756e', spec.skinGrey ?? 0.3), -0.06);
    colors = Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, mix(shade(v, -0.3), '#4a4744', 0.22)]));
    hairSpec.color = shade(hairSpec.color, -0.25);
  }
  if (horror && ghost) { // pale grey-green, wet dark grey-green cloth, hair plastered over the face
    skin = '#a4ad9c'; hairSpec.style = 'wetveil'; hairSpec.color = '#090b0b';
    colors = Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, mix(shade(v, -0.34), '#4a554e', 0.55)]));
  }
  const SSS = horror && ghost ? '#6c7b50' : null;
  const asp = B.headAsp;

  function build(c, st, dry) {
    const H = st.height ?? 600, facing = st.facing ?? 1, t = st.t ?? 0;
    const still = ghost ? 0.12 : 1; // uncanny stillness: ghosts barely move
    const pose = typeof st.pose === 'string' ? st.pose : st.pose?.name ?? 'stand';
    const poseOpts = { ...(typeof st.pose === 'object' ? st.pose : {}), t };
    if (pose === 'walk' && poseOpts.phase === undefined) poseOpts.phase = st.phase ?? t * TAU * 0.95;
    if (pose === 'turn' && poseOpts.turn === undefined) poseOpts.turn = st.turn ?? 0;
    const a = { ...poseAngles(pose, poseOpts, B), ...(st.angles || {}) };
    const breath = Math.sin(t * 1.9 + seed) * still, sway = Math.sin(t * 0.7 + seed * 2) * 0.004 * still;
    if (!st.angles?.lean) a.lean += breath * 0.004;
    if (st.look !== undefined) a.look = st.look;
    if (ghost && !horror && !st.angles) a.headTilt += 0.1;
    if (horror && ghost && !st.angles) { a.headTilt += 0.17; a.lean += 0.035; a.shTilt = 0.024; a.shL -= 0.04; a.elL += 0.06; a.elR += 0.1; a.handL = 0.45; a.handR = 0.3; }
    const light = st.light ?? LIGHTS.noon, L = norm({ x: light.dir.x * facing, y: light.dir.y });
    const Lf = norm({ x: L.x + (L.x >= 0 ? 0.45 : -0.45), y: L.y * 0.45 });
    const env = { L, Lf, key: light.key, amb: horror ? shade(light.amb ?? '#27304a', -0.32) : light.amb, hard: !!light.hard && !ghost, strength: (light.strength ?? 1) * (horror ? 1.12 : 1), rim: light.rim ?? '#ffe3b8', rimA: (light.rimA ?? 1) * (ghost ? (horror ? 0.4 : 0.6) : horror ? 1.45 : 1), sss: SSS, horror, ghost };
    const eyeLight = st.eyeLight ?? (horror ? 0 : 1);
    const px = H; // screen px per local unit: ink / rim widths are clamped in px so a 3000 px close-up does not get 10 px lines
    const inkW = cl(0.0034 * px, 0.9, 3.4) / px, rimWpx = (w) => cl(w * px * (horror && !ghost ? 1.25 : 1), 1.2, horror ? 8 : 7) / px;
    // reach targets are given in screen px: convert to local units
    const toLocal = (p) => (p ? [((p[0] - st.x) * facing) / H, (p[1] - st.feet) / H] : null);
    const J = solve(B, a, { sway, reachR: toLocal(st.reachR), reachL: toLocal(st.reachL) });
    const parts = [];
    const tp = (x, ty) => ty >= 0 ? [J.P[0] + J.side[0] * x + J.up[0] * ty * B.torso, J.P[1] + J.side[1] * x + J.up[1] * ty * B.torso]
      : [J.P[0] + x, J.P[1] - ty * -B.torso * 1 * 1 * -1 * -1];
    const F = {
      c, B, J, env, colors, skin, ghost, tp, H, parts,
      part(pts, base, o = {}) {
        parts.push(pts);
        if (dry) return null;
        const path = o.sharp ? (() => { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); return p; })() : smoothClosed(pts);
        const bb = bboxOf(pts);
        c.fillStyle = o.across && (horror || ghost) ? acrossGradient(c, o.across, o.acrossW, env.L, softStops(base, env, SSS)) : grad(c, bb, env.Lf, formStops(base, env)); c.fill(path);
        c.save(); c.clip(path);
        if (o.tex) cin.fillTexture(c, 'plaster', [bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]], { alpha: ghost ? 0.22 : 0.34, scale: 0.7 / H, ox: 0, oy: 0, seed: 5 });
        if (o.fold) o.fold(c, path);
        if (ghost && !horror) { c.globalCompositeOperation = 'screen'; const g = c.createLinearGradient(bb[0], bb[1], bb[0] + (bb[2] - bb[0]) * 0.4, bb[3]); g.addColorStop(0, rgba('#cfe3f0', 0.1)); g.addColorStop(0.5, rgba('#cfe3f0', 0.01)); g.addColorStop(1, rgba('#cfe3f0', 0.07)); c.fillStyle = g; c.fillRect(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]); c.globalCompositeOperation = 'source-over'; }
        c.restore();
        if (o.ink !== false) { c.strokeStyle = rgba(shade(base, -0.72), 0.7); c.lineWidth = inkW; c.lineJoin = 'round'; c.stroke(path); }
        if (o.rim !== false) cin.rimLight(c, path, env.L, { width: rimWpx(o.rimW ?? 0.009), color: env.rim, alpha: env.rimA * (o.rimA ?? 1), soft: ghost });
        return path;
      },
    };
    const W = B.w;
    // ---- pieces
    const legSkin = (leg) => F.part(ribbon([leg.hip, leg.knee, leg.ank], [W.th, W.sh * 1.08, W.sh * 0.62], { n: 8, bulge: 0.08 }), skin, { tex: null, across: [leg.hip, leg.ank], acrossW: W.th });
    const shoe = (leg, kind) => {
      const k = leg.shinA, fwd = [Math.cos(k), -Math.sin(k)], dn = [Math.sin(k), Math.cos(k)], a0 = leg.ank, p = (f, d) => [a0[0] + fwd[0] * f + dn[0] * d, a0[1] + fwd[1] * f + dn[1] * d];
      const fo = B.foot, fl = B.fl;
      if (kind === 'shoe') {
        if (O.sock) F.part(ribbon([p(0, -0.05), p(0, fo * 0.3)], [W.sh * 0.7, W.sh * 0.7], { n: 3, cap: 2 }), '#e9e6de', { tex: null });
        F.part([p(-0.03, -0.012), p(0.03, -0.012), p(0.05, fo * 0.45), p(fl * 0.98, fo * 0.55), p(fl * 1.02, fo * 0.9), p(-0.012, fo * 1.02), p(-0.034, fo * 0.8)], ghost ? '#20262c' : '#17130f', { tex: null, rimW: 0.007 });
        F.part([p(-0.034, fo * 0.88), p(fl * 1.02, fo * 0.92), p(fl * 1.0, fo * 1.04), p(-0.03, fo * 1.04)], '#050505', { tex: null, rim: false });
      } else if (kind === 'chappal') {
        F.part([p(-0.024, fo * 0.1), p(0.025, fo * 0.1), p(fl * 0.95, fo * 0.55), p(fl, fo * 0.95), p(-0.012, fo * 1.0), p(-0.03, fo * 0.8)], skin, { tex: null, rimW: 0.006 });
        F.part([p(-0.032, fo * 0.9), p(fl * 1.02, fo * 0.92), p(fl, fo * 1.06), p(-0.03, fo * 1.06)], '#4a3622', { tex: null, rim: false });
        F.part([p(0.0, fo * 0.1), p(fl * 0.55, fo * 0.55), p(fl * 0.5, fo * 0.7), p(-0.01, fo * 0.3)], '#4a3622', { tex: null, rim: false });
      } else {
        F.part([p(-0.026, 0), p(0.026, 0), p(0.05, fo * 0.35), p(fl * 0.95, fo * 0.55), p(fl, fo * 0.95), p(-0.01, fo * 1.0), p(-0.034, fo * 0.8)], skin, { tex: null, rimW: 0.006 });
      }
    };
    const drawLeg = (leg, side) => { legSkin(leg); shoe(leg, O.shoes); O.legCover(F, side, leg); };
    const armSkin = (arm) => F.part(ribbon([[arm.S[0] + (arm.E[0] - arm.S[0]) * 0.1, arm.S[1] + (arm.E[1] - arm.S[1]) * 0.1], arm.E, arm.W], [W.ua * 0.98, W.fa * 1.05, W.fa * 0.7], { n: 8, bulge: 0.07 }), skin, { tex: null, across: [arm.S, arm.W], acrossW: W.ua * 1.1 });
    const handCurl = (side) => (side < 0 ? a.handL : a.handR);
    const hand = (arm, side, grip) => { if (dry) return; const k = side < 0 ? 'L' : 'R'; drawHand(c, { p: arm.W, ang: arm.dirA, size: B.hand * 1.15, curl: grip ?? handCurl(side), curls: st.curls?.[k], thumbTuck: st.thumbTuck?.[k] ?? 0, spread: st.spread ?? 0.3, thumb: 0.4, side: 1, skin, env, px, wet: ghost, sss: SSS }); };
    const bangles = (arm) => { if (!spec.bangles || dry) return; c.strokeStyle = '#d6a43a'; c.lineWidth = 0.007; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(arm.W[0] - Math.sin(arm.dirA) * 0.008 * i, arm.W[1] - Math.cos(arm.dirA) * 0.008 * i, 0.019, 0, TAU); c.stroke(); } };
    const wetSpots = (arm) => { // a few small soft highlights on the lit side of a wet limb (never a band)
      if (dry || !ghost) return; const dx = arm.W[0] - arm.S[0], dy = arm.W[1] - arm.S[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, sg = nx * env.L.x + ny * env.L.y >= 0 ? 1 : -1, ang = Math.atan2(dy, dx);
      for (const [u, len] of [[0.22, 0.05], [0.5, 0.035], [0.74, 0.045]]) { const cx0 = arm.S[0] + dx * u + nx * sg * W.fa * 0.28, cy0 = arm.S[1] + dy * u + ny * sg * W.fa * 0.28; c.save(); c.translate(cx0, cy0); c.rotate(ang); c.scale(1, 0.28); const g = c.createRadialGradient(0, 0, 0, 0, 0, len); g.addColorStop(0, rgba('#eef6ee', 0.42)); g.addColorStop(1, rgba('#eef6ee', 0)); c.fillStyle = g; c.beginPath(); c.arc(0, 0, len, 0, TAU); c.fill(); c.restore(); }
    };
    const drawArm = (arm, side) => { armSkin(arm); wetSpots(arm); hand(arm, side, st.grip?.[side < 0 ? 'L' : 'R']); O.sleeve(F, arm); bangles(arm); };
    // contact shadow of an arm on the torso (AO) - painted just before the near arm
    const armAO = (arm, torsoPath) => { if (dry || !torsoPath) return; c.save(); c.clip(torsoPath); c.strokeStyle = rgba('#000', 0.28); c.lineCap = 'round'; c.lineWidth = W.ua * 1.2; c.beginPath(); c.moveTo(arm.S[0] - env.L.x * 0.012, arm.S[1] - env.L.y * 0.012); c.lineTo(arm.E[0] - env.L.x * 0.012, arm.E[1] - env.L.y * 0.012); c.lineTo(arm.W[0] - env.L.x * 0.012, arm.W[1] - env.L.y * 0.012); c.stroke(); c.restore(); };

    if (st.__only === 'hands') { if (!dry) { hand(J.AL, -1, st.grip?.L); hand(J.AR, 1, st.grip?.R); } return { J, parts, a }; }
    // ---- draw order: far arm/leg first, near last; the side that faces the light is the "near" side so rim reads
    const farLeg = J.L, nearLeg = J.R, farArm = J.AL, nearArm = J.AR;
    // soft contact shadows under the feet (grounding)
    if (!dry && st.contact !== false && !ghost) { for (const leg of [farLeg, nearLeg]) { c.save(); c.translate((leg.heel[0] + leg.toe[0]) / 2, 0); const g = c.createRadialGradient(0, 0, 0, 0, 0, 0.11); g.addColorStop(0, rgba('#000', 0.5 * (st.contactA ?? 1))); g.addColorStop(1, rgba('#000', 0)); c.scale(1, 0.18); c.fillStyle = g; c.fillRect(-0.12, -0.12, 0.24, 0.24); c.restore(); } }
    // wet pool for ghosts
    if (!dry && ghost && !horror) { c.save(); const g = c.createRadialGradient(0, 0.004, 0, 0, 0.004, 0.2); g.addColorStop(0, rgba('#0a1014', 0.55)); g.addColorStop(0.7, rgba('#10181d', 0.35)); g.addColorStop(1, rgba('#10181d', 0)); c.scale(1, 0.16); c.fillStyle = g; c.fillRect(-0.22, -0.22, 0.44, 0.44); c.restore(); }
    // horror ghost: no shadow of any kind; only a faint pale sheen of wet floor under the feet, drawn ABOVE the ground line
    if (!dry && ghost && horror) { c.save(); c.translate(0, -0.004); const g = c.createRadialGradient(0, 0, 0, 0, 0, 0.16); g.addColorStop(0, rgba('#b9c8bd', 0.13)); g.addColorStop(1, rgba('#b9c8bd', 0)); c.scale(1, 0.1); c.fillStyle = g; c.fillRect(-0.18, -0.18, 0.36, 0.18); c.restore(); }
    drawLeg(farLeg, -1);
    drawArm(farArm, -1);
    drawLeg(nearLeg, 1);
    // braid / back hair accessory behind the torso
    // torso garment (also covers the top of both legs)
    const torsoPath = O.torso(F);
    // neck
    const nb = [J.N[0] + J.up[0] * 0.01, J.N[1] + J.up[1] * 0.01];
    F.part(ribbon([nb, [J.NT[0], J.NT[1]]], [B.sw * 0.5, B.sw * 0.44], { n: 3, cap: 2 }), skin, { tex: null, rim: false });
    // chin shadow on the neck/collar is painted by the head's own shading; head:
    const hsz = B.head, look = a.look, gaze = st.gaze ?? [0, 0], mouthOpen = st.talk !== undefined ? talkAt(seed, t, st.talk) : null;
    const headSpec = { browColor: spec.browColor, c: J.HC, size: hsz, asp, tilt: J.headTilt, look, age, sex, skin, hair: hairSpec, horror, headPx: hsz * px, eyeLight, px, sss: SSS, expr: st.expr ?? (ghost ? 'blank' : 'neutral'), blinkOpen: ghost ? 0.92 : blinkAt(seed, t), gaze, mouth: st.mouth ?? mouthOpen ?? undefined, env: { ...env, L: env.L }, ghost, seed, t, glasses: spec.glasses, bindi: spec.bindi, moustache: spec.moustache, creased: spec.creased, sockets: spec.sockets };
    // braid hangs from the back of the head over the near shoulder
    if (!dry && hairSpec.style === 'braid') { const a0 = [J.HC[0] - Math.cos(J.headTilt) * hsz * 0.3, J.HC[1] + hsz * 0.25], mid = [a0[0] - 0.02 + Math.sin(t * 1.1) * 0.004 * still, J.N[1] + 0.05], endp = [J.N[0] - 0.04 + Math.sin(t * 1.1 + 1) * 0.008 * still, J.P[1] - 0.02]; const bp = ribbon([a0, mid, endp], [0.05, 0.05, 0.036], { n: 10 }); const path = smoothClosed(bp); c.save(); c.fillStyle = grad(c, bboxOf(bp), env.L, formStops(hairSpec.color, env)); c.fill(path); c.clip(path); c.strokeStyle = rgba('#fff', 0.16); c.lineWidth = 0.006; for (let i = 0; i < 9; i++) { const y = lerp(a0[1], endp[1], i / 9); c.beginPath(); c.moveTo(mid[0] - 0.03, y); c.quadraticCurveTo(mid[0], y + 0.025, mid[0] + 0.03, y); c.stroke(); } c.restore(); c.fillStyle = '#b3241f'; c.beginPath(); c.arc(endp[0], endp[1], 0.02, 0, TAU); c.fill(); }
    parts.push(headPoly(J.HC, hsz, asp, J.headTilt));
    if (!dry) drawHead(horror && c.__raw ? headCtx(c.__raw, H, hsz) : c, headSpec);
    armAO(nearArm, torsoPath);
    drawArm(nearArm, 1);
    if (spec.shawl) { const sp = drawShawl(F, { ...spec.shawl, seed }); if (sp) parts.push(sp); }
    // drips for ghosts: from hems and fingertips
    if (!dry && ghost) { for (let i = 0; i < 5; i++) { const ph = (t * 0.5 + i * 0.21) % 1, x = (i - 2) * 0.05, y0 = J.P[1] + B.thigh * 0.5; c.fillStyle = rgba('#cfe3f0', 0.7 * (1 - ph)); c.beginPath(); c.ellipse(x, y0 + ph * (-y0 - 0.02), 0.005, 0.011, 0, 0, TAU); c.fill(); } }
    return { J, parts, a };
  }
  const headPoly = (c, s, asp_, tilt) => { const o = []; for (let i = 0; i < 12; i++) { const th = (i / 12) * TAU, x = Math.cos(th) * s * asp_ * 0.55, y = Math.sin(th) * s * 0.58; o.push([c[0] + x * Math.cos(tilt) - y * Math.sin(tilt), c[1] + x * Math.sin(tilt) + y * Math.cos(tilt)]); } return o; };

  const fig = {
    spec, B, ghost, age, sex, style,
    /** Draw the figure. state: {x, feet, height, facing, pose, t, light, gaze:[-1..1,-1..1], expr, mouth, talk, look, reachR:[px,px], contact} */
    draw(ctx, st) {
      const H = st.height ?? 600, facing = st.facing ?? 1;
      ctx.save(); ctx.translate(st.x, st.feet); ctx.scale(H * facing, H);
      const r = build(clampCtx(ctx, H), st, false); ctx.restore(); return r;
    },
    /** Draw only the two hands (after a cloth that covers them): same pose, light and skin as draw(). */
    hands(ctx, st) { const H = st.height ?? 600, facing = st.facing ?? 1; ctx.save(); ctx.translate(st.x, st.feet); ctx.scale(H * facing, H); build(clampCtx(ctx, H), { ...st, __only: 'hands' }, false); ctx.restore(); },
    /** Joint positions in screen px (design space). */
    joints(st) {
      const H = st.height ?? 600, facing = st.facing ?? 1, r = build(nullCtx, { ...st, x: st.x ?? 0, feet: st.feet ?? 0 }, true), J = r.J;
      const m = (p) => [st.x + p[0] * H * facing, st.feet + p[1] * H];
      return { head: m(J.HC), neck: m(J.N), pelvis: m(J.P), handL: m(J.AL.W), handR: m(J.AR.W), shoulderL: m(J.AL.S), shoulderR: m(J.AR.S), ankleL: m(J.L.ank), ankleR: m(J.R.ank), topY: st.feet - H, J };
    },
    /** Silhouette parts in screen px: array of point lists (for shadows, occluders, bbox). */
    silhouette(st) {
      const H = st.height ?? 600, facing = st.facing ?? 1, r = build(nullCtx, st, true);
      return r.parts.map((pts) => pts.map((p) => [st.x + p[0] * H * facing, st.feet + p[1] * H]));
    },
    bbox(st) { const pts = fig.silhouette(st).flat(); const b = bboxOf(pts); return { x0: b[0], y0: b[1], x1: b[2], y1: b[3], w: b[2] - b[0], h: b[3] - b[1] }; },
    /** Cast shadow on the ground line y=feet. sun: {dir:[dx,dy]} screen px per px of height (|dir|->0 = sun at the zenith) or {x,y,floorY} point light. */
    shadow(ctx, st, sun, o = {}) {
      if (ghost) return false; // the wrong ones cast nothing, whatever the light
      const { alpha = 0.6, soft = 6, color = '#000', squash = 0.4 } = o, gy = st.feet;
      const parts = fig.silhouette(st), path = new Path2D();
      for (const pts of parts) {
        const pr = pts.map(([x, y]) => {
          const h = Math.max(0, gy - y);
          if (sun.dir) return [x + sun.dir[0] * h, gy + sun.dir[1] * h * squash];
          const Hs = Math.max(40, gy - sun.y), r = Math.min(h / Math.max(20, Hs - h), 4);
          return [x + (x - sun.x) * r, gy + (gy - (sun.floorY ?? gy + 90)) * r * squash];
        });
        path.moveTo(pr[0][0], pr[0][1]); for (let i = 1; i < pr.length; i++) path.lineTo(pr[i][0], pr[i][1]); path.closePath();
      }
      ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineJoin = 'round';
      const steps = soft > 1 ? 3 : 1;
      for (let i = 0; i < steps; i++) { const grow = soft * (steps - 1 - i) * 0.7; ctx.globalAlpha = (alpha / steps) * (steps === 1 ? 1 : 1.5); ctx.fill(path, 'nonzero'); if (grow > 0) { ctx.lineWidth = grow * 2; ctx.stroke(path); } }
      ctx.restore(); return true;
    },
  };
  return fig;
}
