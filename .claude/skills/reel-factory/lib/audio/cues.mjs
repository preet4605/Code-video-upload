// Cue sheet (sound.json): load, validate, resolve against the timeline.
//   at / until : a timeline event name (resolved with lib/events.mjs makeClock) or a number of seconds.
//   Unknown kinds, unknown events, bad layers, duplicate ids, tier B/C cues without file+licence are all ERRORS (never silently skipped).
import fs from 'node:fs';
import { makeClock } from '../events.mjs';
import { SYNTH_KINDS, LAYERS, AUTOMATION_KINDS, kindNames } from './synth/index.mjs';
import { REVERB_PRESETS } from './space.mjs';

export const SOURCES = ['synth', 'generated', 'library'];
export const BUS_NAMES = ['vo', 'sfx', 'music', 'ambience', 'room'];
// Default bus trims in dB (applied at the mix; before loudnorm). Overridable in sound.json "buses".
export const DEFAULT_BUSES = Object.freeze({ vo: 0, sfx: -3, music: -12, ambience: -14, room: -26 });

export function loadSound(file) {
  let j;
  try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`sound.json: cannot read ${file}: ${e.message}`); }
  return j;
}

// Events: the timeline's native `events` (written by build_vo.mjs) win. Only when a timeline has none (older examples) do we derive
// lineNN_start / lineNN_end from scenes[].lines, the same names build_vo would write. Derived names are reported as derived.
export function eventsFor(timeline) {
  if (timeline?.events && typeof timeline.events === 'object' && Object.keys(timeline.events).length) return { events: timeline.events, derived: false };
  const ev = {};
  for (const sc of timeline?.scenes || []) for (const l of sc.lines || []) {
    const k = String(l.i).padStart(2, '0'); ev[`line${k}_start`] = l.start_s; ev[`line${k}_end`] = l.end_s;
  }
  return { events: ev, derived: true };
}

function resolveTime(spec, off, clock, used, derived, label, errors) {
  if (typeof spec === 'number') { if (!Number.isFinite(spec)) { errors.push(`${label}: not a finite number`); return null; } return spec + (off || 0); }
  if (typeof spec === 'string') {
    if (!clock) { errors.push(`${label}: "${spec}" is an event name but the timeline has no events (run scripts/build_vo.mjs) and no lines to derive them from; use seconds`); return null; }
    try { const t = clock.at(spec); used.push({ name: spec, derived }); return t + (off || 0); } catch (e) { errors.push(`${label}: ${e.message}`); return null; }
  }
  errors.push(`${label}: must be an event name or seconds`); return null;
}

export function resolveCues(sound, timeline, { projectDir = null } = {}) {
  const errors = [], warnings = [];
  if (!sound || typeof sound !== 'object') return { errors: ['sound.json must be an object'], warnings, cues: [] };
  if (!Number.isFinite(sound.seed)) warnings.push('sound.json: no numeric "seed"; using 1');
  const seed = Number.isFinite(sound.seed) ? sound.seed : 1;
  if (!Array.isArray(sound.cues)) return { errors: ['sound.json: "cues" must be an array'], warnings, cues: [] };
  for (const b of Object.keys(sound.buses || {})) if (!BUS_NAMES.includes(b)) errors.push(`buses.${b}: unknown bus (known: ${BUS_NAMES.join(', ')})`);
  let clock = null, derived = false;
  const ev = eventsFor(timeline);
  if (Object.keys(ev.events).length) { clock = makeClock({ events: ev.events }); derived = ev.derived; }
  const ids = new Set(); const cues = [];
  const dur = Number(timeline?.duration_s);
  sound.cues.forEach((c, idx) => {
    const id = c?.id; const L0 = `cue[${idx}]${id ? ` "${id}"` : ''}`;
    if (!id || typeof id !== 'string') { errors.push(`${L0}: missing string id`); return; }
    if (ids.has(id)) { errors.push(`${L0}: duplicate id`); return; }
    ids.add(id);
    const e0 = errors.length; const used = [];
    const isAuto = AUTOMATION_KINDS.includes(c.kind);
    const src = c.source ?? 'synth';
    if (!SOURCES.includes(src)) errors.push(`${L0}: source "${src}" must be one of ${SOURCES.join(', ')}`);
    if (src === 'synth' && !isAuto && !Object.hasOwn(SYNTH_KINDS, c.kind)) errors.push(`${L0}: unknown kind "${c.kind}"; known: ${kindNames().join(', ')}`);
    if (src !== 'synth' && (!c.kind || typeof c.kind !== 'string')) errors.push(`${L0}: needs a "kind" label (free text for ${src} cues)`);
    const def = SYNTH_KINDS[c.kind];
    const layer = c.layer ?? def?.layer ?? (isAuto ? 'sfx' : null);
    if (!isAuto && !LAYERS.includes(layer)) errors.push(`${L0}: layer "${layer}" must be one of ${LAYERS.join(', ')}`);
    if (src !== 'synth') {
      if (!c.file || typeof c.file !== 'string') errors.push(`${L0}: ${src} cue needs "file" (the audio you generated or imported)`);
      else if (projectDir && !fs.existsSync(resolveFile(projectDir, c.file))) errors.push(`${L0}: file not found: ${c.file}`);
      const lic = c.licence;
      const okLic = (typeof lic === 'string' && lic.trim()) || (lic && typeof lic === 'object' && String(lic.name || lic.id || '').trim());
      if (!okLic) errors.push(`${L0}: ${src} cue needs "licence" (string, or {name, url?, credit?, proof?}); a missing licence is an error`);
    }
    const at = resolveTime(c.at, c.offset_s, clock, used, derived, `${L0}.at`, errors);
    let until = null;
    if (c.until !== undefined) until = resolveTime(c.until, c.until_offset_s, clock, used, derived, `${L0}.until`, errors);
    if (at !== null && at < 0) errors.push(`${L0}: starts at ${at.toFixed(3)} s (< 0); fix at/offset_s`);
    if (at !== null && until !== null && until <= at) errors.push(`${L0}: until (${until.toFixed(3)}) must be after at (${at.toFixed(3)})`);
    if (at !== null && Number.isFinite(dur) && at > dur) warnings.push(`${L0}: starts at ${at.toFixed(2)} s, after the timeline ends (${dur.toFixed(2)} s); it will not be heard`);
    if (c.pan !== undefined && !(typeof c.pan === 'number' || (c.pan && typeof c.pan === 'object' && Number.isFinite(c.pan.from) && Number.isFinite(c.pan.to)))) errors.push(`${L0}: pan must be a number -1..1 or {from,to}`);
    if (typeof c.pan === 'number' && Math.abs(c.pan) > 1) errors.push(`${L0}: pan ${c.pan} outside -1..1`);
    if (c.reverb && c.reverb !== false) { const pr = typeof c.reverb === 'string' ? c.reverb : c.reverb.preset; if (!REVERB_PRESETS[pr]) errors.push(`${L0}: reverb preset "${pr}" unknown (known: ${Object.keys(REVERB_PRESETS).join(', ')})`); }
    if (c.tags !== undefined && !Array.isArray(c.tags)) errors.push(`${L0}: tags must be an array`);
    const curve = [];
    for (const [k, g] of (c.gain_curve || []).entries()) {
      const t = resolveTime(g.at, g.offset_s, clock, used, derived, `${L0}.gain_curve[${k}].at`, errors);
      if (t !== null) { if (!Number.isFinite(g.db)) errors.push(`${L0}.gain_curve[${k}]: db must be a number`); else curve.push({ t, db: g.db }); }
    }
    if (errors.length > e0) return;
    cues.push({ ...c, source: src, layer, at_s: at, until_s: until, dur_s: until !== null ? until - at : null, gain_curve_resolved: curve, tags: c.tags || [], derived_events: used.filter((u) => u.derived).map((u) => u.name), events_used: used.map((u) => u.name) });
  });
  cues.sort((a, b) => a.at_s - b.at_s || (a.id < b.id ? -1 : 1));
  return { errors, warnings, cues, seed, derived_events: derived };
}

export function resolveFile(projectDir, f) { return f.startsWith('/') ? f : `${projectDir}/${f}`; }
export const isScareCue = (cue) => (cue.tags || []).includes('scare');
