// Single timing source for picture AND sound. Every time here is "timeline event + offset": scene.mjs resolves them with makeClock,
// _dev/gen_sound.mjs writes the same (event, offset) pairs into sound.json, so a whoosh can never drift off its light sweep.
// Deterministic: no Math.random, no Date.

// Passing lights seen through the window bars. kind: sodium (orange street lamp) | white (tube / LED mast) | cool (signal lamp).
// shot says where the picture shows them (s3/s4 ... see scene.mjs); dir +1 sweeps left->right, -1 right->left.
export const SWEEP_DEFS = [
  { id: 'sw_hook1', ev: 'hook', off: 1.15, dur: 1.15, kind: 'sodium', dir: -1, amp: 1.0 },
  { id: 'sw_hook2', ev: 'hook', off: 3.35, dur: 0.8, kind: 'white', dir: -1, amp: 1.0 },
  { id: 'sw_hook3', ev: 'hook', off: 4.75, dur: 1.2, kind: 'sodium', dir: -1, amp: 0.9 },
  { id: 'sw_coach1', ev: 'line02_start', off: 0.55, dur: 0.9, kind: 'white', dir: -1, amp: 0.8 },
  { id: 'sw_coach2', ev: 'line02_start', off: 2.2, dur: 1.2, kind: 'sodium', dir: -1, amp: 0.9 },
  { id: 'sw_coach3', ev: 'line02_start', off: 3.7, dur: 0.7, kind: 'white', dir: -1, amp: 0.8 },
  { id: 'sw_tick1', ev: 'clue_ticket', off: 0.9, dur: 1.1, kind: 'sodium', dir: -1, amp: 0.85 },
  { id: 'sw_tick2', ev: 'line04_start', off: 0.7, dur: 0.9, kind: 'white', dir: -1, amp: 0.8 },
  { id: 'sw_rule1', ev: 'rule', off: 1.3, dur: 1.2, kind: 'sodium', dir: -1, amp: 1.0 },
  { id: 'sw_rule2', ev: 'rule', off: 3.9, dur: 0.9, kind: 'white', dir: -1, amp: 1.0 },
  { id: 'sw_rule3', ev: 'rule', off: 5.9, dur: 1.2, kind: 'sodium', dir: -1, amp: 0.9 },
  { id: 'sw_itarsi1', ev: 'itarsi', off: 0.1, dur: 1.4, kind: 'sodium', dir: -1, amp: 1.0 },
  { id: 'sw_itarsi2', ev: 'itarsi', off: 1.2, dur: 1.2, kind: 'white', dir: -1, amp: 1.0 },
  { id: 'sw_bhopal1', ev: 'scare', off: 0.0, dur: 0.55, kind: 'white', dir: -1, amp: 1.3 },
  { id: 'sw_bhopal2', ev: 'scare', off: 0.45, dur: 0.6, kind: 'sodium', dir: -1, amp: 1.2 },
  { id: 'sw_bhopal3', ev: 'scare', off: 1.1, dur: 0.9, kind: 'white', dir: -1, amp: 1.0 },
  { id: 'sw_loop1', ev: 'loop', off: 0.7, dur: 1.15, kind: 'sodium', dir: -1, amp: 1.0 },
  { id: 'sw_loop2', ev: 'loop', off: 2.9, dur: 0.8, kind: 'white', dir: -1, amp: 1.0 },
  { id: 'sw_loop3', ev: 'loop', off: 4.2, dur: 1.2, kind: 'sodium', dir: -1, amp: 0.9 },
];

// Tube-light flicker bursts while the train brakes to a halt (seconds after `stop`).
export const FLICK_DEFS = [
  { ev: 'stop', off: 0.05, len: 0.55 }, { ev: 'stop', off: 1.0, len: 0.16 }, { ev: 'stop', off: 1.75, len: 0.5 }, { ev: 'stop', off: 3.2, len: 0.22 },
];

// Eye glints in s6 (the night lamp catches the wet of his eye as he turns to follow the camera).
export const GLINT_DEFS = [
  { ev: 'eyes', off: 1.0, len: 0.5 }, { ev: 'eyes', off: 2.4, len: 0.55 }, { ev: 'eyes', off: 3.9, len: 0.7 },
];

// Paper rustles (s7: every hand's ticket stirs together; s3/s11: the one in the insert).
export const RUSTLE_DEFS = [
  { id: 'rust_clue', ev: 'clue_ticket', off: 0.15 }, { id: 'rust_t1', ev: 'tickets', off: 0.5 }, { id: 'rust_t2', ev: 'tickets', off: 1.9 },
  { id: 'rust_twist', ev: 'twist', off: 0.0 },
];

const mk = (clock, d) => ({ ...d, t0: clock.at(d.ev) + d.off, t1: clock.at(d.ev) + d.off + (d.dur ?? d.len ?? 0) });
export function resolveCues(clock) {
  return {
    sweeps: SWEEP_DEFS.map((d) => mk(clock, d)),
    flicks: FLICK_DEFS.map((d) => mk(clock, d)),
    glints: GLINT_DEFS.map((d) => mk(clock, d)),
    rustles: RUSTLE_DEFS.map((d) => ({ ...d, t0: clock.at(d.ev) + d.off })),
  };
}

const sm = (x) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
// strongest sweep at time t -> { i: 0..1 intensity, u: 0..1 progress, kind, dir } (i = 0 when none)
export function sweepAt(cues, t) {
  let best = { i: 0, u: 0, kind: 'white', dir: -1 };
  for (const s of cues.sweeps) {
    if (t < s.t0 || t > s.t1) continue;
    const u = (t - s.t0) / (s.t1 - s.t0), i = Math.pow(Math.sin(Math.PI * u), 1.4) * s.amp;
    if (i > best.i) best = { i, u, kind: s.kind, dir: s.dir };
  }
  return best;
}
// flicker gate for the tube lights: 0 = dark, 1 = lit. Before `stop` always lit; inside a burst it chops at ~14 Hz; between bursts it stays dim.
export function tubeAt(cues, t, stopT) {
  if (t < stopT) return 1;
  for (const f of cues.flicks) if (t >= f.t0 && t < f.t1) return Math.abs(Math.sin((t - f.t0) * 38)) > 0.45 ? 1 : 0.08;
  return 0.5; // halted: one tube left barely alive
}
export function glintAt(cues, t) {
  for (const g of cues.glints) if (t >= g.t0 && t <= g.t1) return Math.sin(Math.PI * (t - g.t0) / (g.t1 - g.t0));
  return 0;
}
export { sm };
