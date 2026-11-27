// figures/rig: proportions, poses and a small analytic skeleton. Local units: standing height = 1, feet on y=0, y down,
// figure faces +x (the caller mirrors for facing -1). No IK except a 2-bone arm solver used by reachTo.
import { cl, lerp, smoothstep, TAU, h01 } from '../util.mjs';

// lengths are fractions of total height; they are normalised so the sum foot+shin+thigh+torso+neck+head = 1
const RAW = {
  child: { foot: 0.03, shin: 0.205, thigh: 0.195, torso: 0.245, neck: 0.03, head: 0.27, sw: 0.1, hw: 0.056, ua: 0.15, fa: 0.13, hand: 0.055, fl: 0.075, headAsp: 0.9, w: { ua: 0.05, fa: 0.04, th: 0.078, sh: 0.056 }, lean: 0, knee: 0 },
  adult: { foot: 0.03, shin: 0.245, thigh: 0.24, torso: 0.285, neck: 0.04, head: 0.16, sw: 0.118, hw: 0.058, ua: 0.17, fa: 0.145, hand: 0.058, fl: 0.085, headAsp: 0.76, w: { ua: 0.054, fa: 0.043, th: 0.088, sh: 0.06 }, lean: 0, knee: 0 },
  elder: { foot: 0.03, shin: 0.235, thigh: 0.23, torso: 0.27, neck: 0.036, head: 0.158, sw: 0.108, hw: 0.056, ua: 0.165, fa: 0.14, hand: 0.056, fl: 0.082, headAsp: 0.74, w: { ua: 0.046, fa: 0.036, th: 0.075, sh: 0.05 }, lean: 0.2, knee: 0.16 },
};
export const AGE_NAMES = Object.keys(RAW);

// horror style: adult-leaning proportions. Smaller heads, longer neck / limbs / hands, narrower build (fractions of height, renormalised).
const HORROR = {
  child: { head: 0.2, neck: 0.05, shin: 0.235, thigh: 0.22, torso: 0.26, ua: 0.17, fa: 0.15, hand: 0.062, sw: 0.092, headAsp: 0.78 },
  adult: { head: 0.134, neck: 0.056, shin: 0.256, thigh: 0.25, torso: 0.292, ua: 0.188, fa: 0.162, hand: 0.066, sw: 0.112, headAsp: 0.7 },
  elder: { head: 0.136, neck: 0.05, shin: 0.246, thigh: 0.24, torso: 0.278, ua: 0.18, fa: 0.155, hand: 0.064, sw: 0.104, headAsp: 0.7 },
};
const FIELD_STYLES = ['illustrated', 'horror'];
export const STYLE_NAMES = FIELD_STYLES;

/** style: 'illustrated' (default, story / kids) | 'horror' (adult-leaning). ghost (with horror): elongated, narrower, longer neck and arms. */
export function proportions(age = 'adult', sex = 'm', style = 'illustrated', ghost = false) {
  if (!FIELD_STYLES.includes(style)) throw new Error(`unknown style "${style}" (have ${FIELD_STYLES.join(', ')})`);
  let r = RAW[age]; if (!r) throw new Error(`unknown age "${age}" (have ${AGE_NAMES.join(', ')})`);
  if (style === 'horror') {
    r = { ...r, ...HORROR[age], w: { ...r.w } };
    if (ghost) { r.neck *= 1.32; r.ua *= 1.1; r.fa *= 1.12; r.hand *= 1.12; r.sw *= 0.9; r.head *= 0.96; r.w = Object.fromEntries(Object.entries(r.w).map(([a, b]) => [a, b * 0.86])); }
    else r.w = Object.fromEntries(Object.entries(r.w).map(([a, b]) => [a, b * 0.94]));
  }
  const tot = r.foot + r.shin + r.thigh + r.torso + r.neck + r.head, k = 1 / tot;
  const B = { age, sex, style };
  for (const key of ['foot', 'shin', 'thigh', 'torso', 'neck', 'head', 'sw', 'hw', 'ua', 'fa', 'hand', 'fl']) B[key] = r[key] * k;
  B.w = Object.fromEntries(Object.entries(r.w).map(([a, b]) => [a, b * k]));
  B.headAsp = r.headAsp; B.baseLean = r.lean; B.baseKnee = r.knee;
  if (sex === 'f') { B.sw *= 0.9; B.hw *= 1.22; B.torso *= 0.98; B.w.th *= 0.94; }
  return B;
}

const dirA = (a) => [Math.sin(a), Math.cos(a)]; // angle from straight down, + toward +x (facing)

/** Named pose -> raw angles. p: phase (radians, walk), t seconds. */
export function poseAngles(name, o = {}, B) {
  const p = o.phase ?? 0, t = o.t ?? 0, amp = o.amp ?? 1;
  const base = { lean: B.baseLean, hipL: -0.03, hipR: 0.03, kneeL: B.baseKnee, kneeR: B.baseKnee, shL: 0.07, shR: -0.06, elL: 0.12, elR: 0.1, headTilt: 0, look: 0.3, crouch: 0, handL: 0.2, handR: 0.2 };
  switch (name) {
    case 'stand': return base;
    case 'walk': {
      const s = Math.sin(p), c = Math.cos(p);
      return { ...base, lean: base.lean + 0.05, hipR: 0.5 * s, hipL: -0.5 * s, kneeR: B.baseKnee + 0.06 + 0.7 * Math.max(0, c), kneeL: B.baseKnee + 0.06 + 0.7 * Math.max(0, -c),
        shR: -0.55 * s * amp, shL: 0.55 * s * amp, elR: 0.25 + 0.35 * Math.max(0, s), elL: 0.25 + 0.35 * Math.max(0, -s), look: 0.25, headTilt: 0.02 * c };
    }
    case 'reach': return { ...base, lean: base.lean + 0.1, shR: 1.4, elR: 0.12, handR: 0.0, shL: 0.1, look: 0.45, hipL: -0.1, hipR: 0.12 };
    case 'holdhand': return { ...base, lean: base.lean + 0.04, shR: 0.75, elR: 0.1, handR: 0.0, look: 0.5 };
    case 'crouch': return { ...base, lean: 0.5, hipL: 1.15, hipR: 1.25, kneeL: 2.1, kneeR: 2.2, shR: 0.95, shL: 0.85, elR: 0.7, elL: 0.8, headTilt: -0.2, look: 0.5 };
    case 'turn': { const k = o.turn ?? 0; return { ...base, look: lerp(0.3, 3.0, cl(k)), hipL: -0.03 - 0.05 * k, hipR: 0.03 + 0.06 * k, lean: base.lean + 0.02 * k, headTilt: 0.04 * Math.sin(k * Math.PI) }; }
    case 'cower': return { ...base, lean: base.lean + 0.18, shL: 1.9, shR: 1.8, elL: 1.5, elR: 1.6, hipL: -0.1, hipR: 0.15, kneeL: 0.3, kneeR: 0.35, look: 0.3, headTilt: -0.12 };
    default: throw new Error(`unknown pose "${name}" (stand walk reach holdhand crouch turn cower)`);
  }
}
export const POSE_NAMES = ['stand', 'walk', 'reach', 'holdhand', 'crouch', 'turn', 'cower'];

// 2-bone arm solver: shoulder S, target T (local) -> shoulder angle a and elbow bend e (>=0, forearm bends toward +x/down)
export function armIK(S, T, ua, fa) {
  let dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy);
  const reach = ua + fa - 1e-4; if (d > reach) { dx *= reach / d; dy *= reach / d; d = reach; }
  d = Math.max(d, Math.abs(ua - fa) + 1e-3);
  const base = Math.atan2(dx, dy); // angle from down
  const cosA = cl((ua * ua + d * d - fa * fa) / (2 * ua * d), -1, 1), A = Math.acos(cosA);
  const cosE = cl((ua * ua + fa * fa - d * d) / (2 * ua * fa), -1, 1), E = Math.PI - Math.acos(cosE);
  // bend so the elbow sits below/behind the straight line: shoulder angle is base - A (elbow more toward down/back)
  return { a: base - A, e: E };
}

function leg(B, hx, hip, knee) {
  const k = hip - knee; // shin angle
  const knee_ = [hx + Math.sin(hip) * B.thigh, Math.cos(hip) * B.thigh];
  const [sx, sy] = dirA(k), ank = [knee_[0] + sx * B.shin, knee_[1] + sy * B.shin];
  const fwd = [Math.cos(k), -Math.sin(k)], dn = [sx, sy];
  const heel = [ank[0] + dn[0] * B.foot - fwd[0] * 0.018, ank[1] + dn[1] * B.foot - fwd[1] * 0.018];
  const toe = [ank[0] + dn[0] * B.foot * 0.55 + fwd[0] * B.fl, ank[1] + dn[1] * B.foot * 0.55 + fwd[1] * B.fl];
  return { hip: [hx, 0], knee: knee_, ank, heel, toe, shinA: k, thighA: hip };
}

/** Solve joints for angle set `a` and body yaw `look`. Returns joints in local units with the lowest sole on y = 0. */
export function solve(B, a, { crouchDrop = 0, sway = 0, reachR = null, reachL = null } = {}) {
  const cw = Math.max(0.42, Math.abs(Math.cos(a.look)) * 0.58 + 0.42);
  const hxs = B.hw * cw;
  const L = leg(B, -hxs, a.hipL, a.kneeL), R = leg(B, hxs, a.hipR, a.kneeR);
  const low = Math.max(L.heel[1], L.toe[1], R.heel[1], R.toe[1]);
  const py = -low, P = [sway, py];
  const shift = (l) => { for (const k of ['hip', 'knee', 'ank', 'heel', 'toe']) l[k] = [l[k][0] + P[0], l[k][1] + P[1]]; return l; };
  shift(L); shift(R);
  const lean = a.lean, up = [Math.sin(lean), -Math.cos(lean)], side = [Math.cos(lean), Math.sin(lean)];
  const N = [P[0] + up[0] * B.torso, P[1] + up[1] * B.torso];
  const swx = B.sw * cw, yawShift = Math.sin(a.look) * B.sw * 0.28;
  const tilt = a.shTilt ?? 0, S = (sgn) => [N[0] + side[0] * (swx * sgn * 0.9 + yawShift) + up[0] * (-0.062 - tilt * sgn), N[1] + side[1] * (swx * sgn * 0.9 + yawShift) + up[1] * (-0.062 - tilt * sgn)];
  const SL = S(-1), SR = S(1);
  const arm = (Sh, ang, el, ik) => {
    if (ik) { const s = armIK(Sh, ik, B.ua, B.fa); ang = s.a; el = s.e; }
    const [x1, y1] = dirA(ang), E = [Sh[0] + x1 * B.ua, Sh[1] + y1 * B.ua];
    const [x2, y2] = dirA(ang + el), Wr = [E[0] + x2 * B.fa, E[1] + y2 * B.fa];
    const H = [Wr[0] + x2 * B.hand * 0.6, Wr[1] + y2 * B.hand * 0.6];
    return { S: Sh, E, W: Wr, H, a: ang, el, dirA: ang + el };
  };
  const AL = arm(SL, a.shL, a.elL, reachL), AR = arm(SR, a.shR, a.elR, reachR);
  const hl = a.lean + a.headTilt, hup = [Math.sin(hl), -Math.cos(hl)];
  const NT = [N[0] + hup[0] * B.neck, N[1] + hup[1] * B.neck];
  const HH = B.head, HC = [NT[0] + hup[0] * HH * 0.47, NT[1] + hup[1] * HH * 0.47];
  return { P, N, NT, HC, headTilt: hl, cw, up, side, L, R, AL, AR, look: a.look, lean, shTilt: tilt };
}

/** Blink: openness 0..1, deterministic from (seed, t). A blink lasts 0.16 s every ~2.8-5 s. */
export function blinkAt(seed, t) {
  let k = Math.floor(t / 3.1), best = 1;
  for (let i = k - 1; i <= k + 1; i++) {
    const t0 = i * 3.1 + 0.4 + h01(seed, i, 7) * 2.4, d = t - t0;
    if (d >= 0 && d < 0.16) best = Math.min(best, Math.abs(d / 0.08 - 1));
    if (h01(seed, i, 9) > 0.8 && d >= 0.24 && d < 0.4) best = Math.min(best, Math.abs((d - 0.24) / 0.08 - 1));
  }
  return cl(best * 1.15 - 0.1 + (best > 0.9 ? 0.1 : 0), 0, 1);
}
/** Mouth openness for talking: bursts of syllables. */
export function talkAt(seed, t, amp = 1) {
  const syl = Math.max(0, Math.sin(t * 17 + h01(seed, 1) * 6) * 0.5 + Math.sin(t * 9.3 + 2) * 0.35 + 0.2);
  const phrase = smoothstep(0.1, 0.4, Math.sin(t * 1.7 + h01(seed, 2) * 6) * 0.5 + 0.5);
  return cl(syl * phrase * amp, 0, 1);
}
