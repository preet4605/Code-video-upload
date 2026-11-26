// Pre-render plan lint: cheap checks on timeline.json (+ optional shotlist.json) before any frame is drawn.
// Warnings by default. Horror: a backdrop reused in > 50% of shots, or > 2 static shots, are FAILS.
//
// Fields read (nothing else is invented):
//   timeline.json  scenes[]: { id, start_s, end_s, beats[]: { t_s, dur_s, hold, animated_properties[] } }
//   shotlist.json  scenes[]: { id, camera?, motion?, details?, layers?: { foreground, midground, background }, subject? }
// Definitions:
//   backdrop        shotlist layers.background (normalised); without a shotlist, scene ids stand in (repeat = same id).
//   declared camera shotlist `camera` text non-empty, or a timeline beat property starting with "camera.".
//   motion          shotlist `motion` text non-empty, or any beat with animated_properties and hold !== true.
//   static shot     no declared camera move AND (no motion) -- or a held run (hold beats / no animated beat) > 4 s.
//   text-only       every animated property of the shot is a text one (title|text|caption|label|headline|counter|cta)
//                   and the shotlist (if any) lists no layers/details.
//   missing layers  shotlist has a `layers` field on any shot, and this shot lacks a non-empty foreground.
import fs from 'node:fs';
import path from 'node:path';

const TEXT_PROP = /^(title|text|caption|label|headline|counter|cta)(\.|$)/i;
const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
const nonEmpty = (v) => (Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== '');

export const PLAN_LIMITS = { backdropShare: 0.4, horrorBackdropShare: 0.5, maxHoldS: 4, horrorMaxStatic: 2 };

function readJson(dir, f) { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } }

/** Pure function: lintPlan({timeline, shotlist, brief}) -> { pass, fails[], warns[], stats }. */
export function lintPlan({ timeline, shotlist = null, brief = {} } = {}) {
  const fails = [], warns = [];
  const horror = brief?.genre === 'horror';
  const tScenes = timeline?.scenes || [];
  const sScenes = shotlist?.scenes || [];
  const byId = new Map(sScenes.map((s) => [s.id, s]));
  const shots = (tScenes.length ? tScenes : sScenes).map((t) => ({ id: t.id, t, s: byId.get(t.id) || (tScenes.length ? null : t) }));
  if (!shots.length) return { pass: false, fails: ['plan_lint: no scenes in timeline.json or shotlist.json'], warns, stats: {} };
  const bad = (msg, hard = false) => (horror && hard ? fails : warns).push(msg);
  const n = shots.length;

  // repeated scene ids
  const idCount = {};
  for (const s of shots) idCount[s.id] = (idCount[s.id] || 0) + 1;
  for (const [id, c] of Object.entries(idCount)) if (c > 1) warns.push(`scene id "${id}" appears ${c} times (ids must be unique)`);

  // backdrop reuse
  const useLayers = sScenes.some((s) => s.layers);
  const keyOf = (s) => (useLayers ? norm(s.s?.layers?.background) : norm(s.id)) || null;
  const counts = {};
  for (const s of shots) { const k = keyOf(s); if (k) counts[k] = (counts[k] || 0) + 1; }
  let topKey = null, topShare = 0;
  for (const [k, c] of Object.entries(counts)) if (c / n > topShare) { topShare = c / n; topKey = k; }
  if (n >= 3 && topKey && counts[topKey] > 1) {
    if (topShare > PLAN_LIMITS.horrorBackdropShare) bad(`backdrop "${topKey}" reused in ${Math.round(topShare * 100)}% of shots (horror limit 50%)`, true);
    else if (topShare > PLAN_LIMITS.backdropShare) warns.push(`backdrop "${topKey}" reused in ${Math.round(topShare * 100)}% of shots (limit 40%)`);
  }

  // per shot: camera / motion / holds / text-only / layers
  let staticShots = 0;
  const perShot = [];
  for (const sh of shots) {
    const beats = sh.t?.beats || [];
    const props = beats.flatMap((b) => b.animated_properties || []);
    const camDeclared = nonEmpty(sh.s?.camera) || props.some((p) => /^camera\./i.test(p));
    const motion = nonEmpty(sh.s?.motion) || beats.some((b) => (b.animated_properties || []).length && b.hold !== true);
    // longest held run: consecutive beats that are hold or animate nothing
    let run = 0, longest = 0;
    for (const b of beats) { if (b.hold === true || !(b.animated_properties || []).length) { run += b.dur_s || 0; longest = Math.max(longest, run); } else run = 0; }
    if (!beats.length && !motion) longest = (sh.t?.end_s ?? 0) - (sh.t?.start_s ?? 0);
    const isStatic = !camDeclared && !motion;
    const heldTooLong = longest > PLAN_LIMITS.maxHoldS;
    if (!camDeclared) warns.push(`shot "${sh.id}": no declared camera move`);
    if (heldTooLong) warns.push(`shot "${sh.id}": no motion for ${longest.toFixed(1)} s (limit ${PLAN_LIMITS.maxHoldS} s)`);
    if (isStatic || heldTooLong) staticShots++;
    const textOnly = props.length > 0 && props.every((p) => TEXT_PROP.test(p)) && !(nonEmpty(sh.s?.layers) || nonEmpty(sh.s?.details));
    if (textOnly) warns.push(`shot "${sh.id}": text-only (only text properties animate, no layers/details)`);
    if (useLayers && !nonEmpty(sh.s?.layers?.foreground)) warns.push(`shot "${sh.id}": no foreground layer declared`);
    perShot.push({ id: sh.id, camera: camDeclared, motion, longest_hold_s: +longest.toFixed(2), text_only: textOnly });
  }
  if (horror && staticShots > PLAN_LIMITS.horrorMaxStatic) fails.push(`${staticShots} static shots (horror limit ${PLAN_LIMITS.horrorMaxStatic}): add camera moves or motion`);
  else if (staticShots > 0) warns.push(`${staticShots} static shot(s)`);
  return { pass: fails.length === 0, fails, warns, stats: { shots: n, top_backdrop: topKey, top_backdrop_share: +topShare.toFixed(2), static_shots: staticShots, per_shot: perShot } };
}

export function lintPlanProject(dir) {
  const timeline = readJson(dir, 'timeline.json');
  if (!timeline) return { pass: false, fails: ['plan_lint: timeline.json missing or invalid'], warns: [], stats: {} };
  return lintPlan({ timeline, shotlist: readJson(dir, 'shotlist.json'), brief: readJson(dir, 'brief.json') || {} });
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: plan_lint.mjs <project_dir>'); process.exit(2); }
  const r = lintPlanProject(path.resolve(dir));
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.pass ? 0 : 1);
}
