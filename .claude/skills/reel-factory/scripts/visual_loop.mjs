#!/usr/bin/env node
// Visual self-improvement loop: render key frames of every shot -> measure against targets calibrated on
// reference reels -> write a labelled sheet + deficits -> the agent LOOKS at the sheet and writes a critique ->
// fixes the scene -> runs the next iteration. Stops when every shot passes the floor and the critique has no
// score below 3, or at --max-iter. A new iteration refuses to run without a valid critique of the previous one,
// and flags any shot that got worse (revert it).
//
// Usage: node scripts/visual_loop.mjs --project <dir> [--targets <json>] [--max-iter 6] [--json]
// Protocol: references/visual-loop.md
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { frameMetrics, aggregate, deficits } from '../lib/visual_metrics.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KEYS = [0.2, 0.5, 0.85];
export const RUBRIC = ['subject', 'depth', 'detail', 'light', 'character', 'composition'];
const RW = 540, RH = 960, AW = 270, AH = 480;
// Caption bar band (drawCaptionBar) is ignored: text must not count as scene detail.
const IGNORE = [[0.64, 0.82]];

let fontsDone = false;
function fonts() {
  if (fontsDone) return;
  const dir = path.join(ROOT, 'fonts');
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter((x) => /\.(ttf|otf)$/i.test(x))) GlobalFonts.registerFromPath(path.join(dir, f));
  fontsDone = true;
}

// Score vs aim (0..1 per metric, averaged): used only to detect regressions between iterations.
export function shotScore(m, T) {
  const parts = [];
  const r = (v, aim) => Math.min(1, v / aim);
  if (T.sharp_edges?.aim) parts.push(r(m.sharp_edges, T.sharp_edges.aim));
  if (T.contrast?.aim) parts.push(r(m.contrast, T.contrast.aim));
  if (T.saturation?.aim) parts.push(r(m.saturation, T.saturation.aim));
  if (T.ink?.aim) parts.push(r(m.ink, T.ink.aim));
  parts.push(1 - Math.min(1, m.empty_cells / Math.max(1, T.max_empty_cells * 2)));
  return +(parts.reduce((a, b) => a + b, 0) / parts.length).toFixed(3);
}

export function keyframeChange(frames) {
  let tot = 0, n = 0;
  // compare downscaled copies (cheap and robust to grain)
  const small = frames.map((f) => { const c = createCanvas(54, 96); c.getContext('2d').drawImage(f.canvas, 0, 0, 54, 96); return c.getContext('2d').getImageData(0, 0, 54, 96).data; });
  for (let i = 1; i < small.length; i++) {
    let d = 0;
    for (let k = 0; k < small[i].length; k += 4) d += Math.abs(small[i][k] - small[i - 1][k]) + Math.abs(small[i][k + 1] - small[i - 1][k + 1]) + Math.abs(small[i][k + 2] - small[i - 1][k + 2]);
    tot += d / (small[i].length / 4) / 765; n++;
  }
  return n ? tot / n : 0;
}

export function validateCritique(c, shotIds, prev = null, regressed = []) {
  const errs = [];
  if (!c || !Array.isArray(c.shots)) return ['critique.json missing or has no "shots" array'];
  for (const id of shotIds) {
    const s = c.shots.find((x) => x.id === id);
    if (!s) { errs.push(`shot "${id}" not critiqued`); continue; }
    if (!s.seen || String(s.seen).length < 25) errs.push(`shot "${id}": "seen" must describe what is actually in the frame (>= 25 chars)`);
    if (!s.fix || String(s.fix).length < 15) errs.push(`shot "${id}": "fix" must name a concrete change (>= 15 chars)`);
    if (regressed.includes(id) && (!s.regression_note || String(s.regression_note).length < 15)) errs.push(`shot "${id}" regressed in the metrics: add "regression_note" justifying the trade, or revert the change`);
    for (const k of RUBRIC) if (!Number.isInteger(s.scores?.[k]) || s.scores[k] < 1 || s.scores[k] > 5) errs.push(`shot "${id}": scores.${k} must be 1-5`);
    if (prev) {
      const p = prev.shots?.find((x) => x.id === id);
      if (p && p.fix && s.fix && p.fix.trim().toLowerCase() === s.fix.trim().toLowerCase()) errs.push(`shot "${id}": same fix as last iteration; if it did not work, try something else`);
    }
  }
  const all = c.shots.flatMap((s) => RUBRIC.map((k) => s.scores?.[k]).filter(Number.isInteger));
  if (all.length >= 12 && new Set(all).size === 1) errs.push('every score is identical: rubber-stamp critique');
  return errs;
}

async function renderShots(projectDir, timeline, iterTag) {
  fonts();
  const mod = await import(pathToFileURL(path.join(projectDir, 'scene.mjs')).href + `?iter=${iterTag}`);
  const VC = mod.VideoClock;
  const shots = [];
  for (const sc of timeline.scenes || []) {
    const frames = [];
    for (const k of KEYS) {
      const t = sc.start_s + (sc.end_s - sc.start_s) * k;
      const c = createCanvas(RW, RH);
      VC.setTime(t);
      VC.draw(c.getContext('2d'), RW, RH, timeline);
      const small = createCanvas(AW, AH);
      small.getContext('2d').drawImage(c, 0, 0, AW, AH);
      const data = small.getContext('2d').getImageData(0, 0, AW, AH).data;
      frames.push({ t: +t.toFixed(2), canvas: c, m: frameMetrics(data, AW, AH, 4, { ignoreBands: IGNORE }) });
    }
    shots.push({ id: sc.id, frames });
  }
  return shots;
}

function drawSheet(shots, results, outPng, iter) {
  const tw = 216, th = 384, pad = 10, label = 150;
  const W = pad + KEYS.length * (tw + pad) + 470, H = pad + shots.length * (th + pad);
  const c = createCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#141414'; x.fillRect(0, 0, W, H);
  shots.forEach((s, r) => {
    const y = pad + r * (th + pad);
    s.frames.forEach((f, i) => x.drawImage(f.canvas, pad + i * (tw + pad), y, tw, th));
    const res = results.find((q) => q.id === s.id);
    const lx = pad + KEYS.length * (tw + pad) + 6;
    x.fillStyle = res.pass ? '#7ee787' : '#ff7b72'; x.font = 'bold 22px "DejaVu Sans", sans-serif';
    x.fillText(`${res.pass ? 'PASS' : 'FIX '}  ${s.id}`, lx, y + 28);
    x.fillStyle = '#ddd'; x.font = '15px "DejaVu Sans Mono", monospace';
    const m = res.metrics;
    const lines = [`iter ${iter}  score ${res.score}${res.delta != null ? ` (${res.delta >= 0 ? '+' : ''}${res.delta})` : ''}`,
      `edges ${m.sharp_edges}  contrast ${m.contrast}`, `sat ${m.saturation}  bins ${m.color_bins}  ink ${m.ink}`, `focal ${m.focal}  empty ${m.empty_cells}`];
    lines.forEach((l, i) => x.fillText(l, lx, y + 58 + i * 22));
    x.fillStyle = '#ffb86b'; x.font = '14px "DejaVu Sans", sans-serif';
    let yy = y + 58 + lines.length * 22 + 10;
    for (const d of res.deficits.slice(0, 4)) {
      const words = `- ${d.metric} ${d.value} (${d.target}): ${d.hint}`.split(' ');
      let ln = '';
      for (const w of words) { if (x.measureText(ln + w).width > 450) { x.fillText(ln, lx, yy); yy += 18; ln = ''; } ln += w + ' '; }
      x.fillText(ln, lx, yy); yy += 22;
      if (yy > y + th - 10) break;
    }
  });
  fs.writeFileSync(outPng, c.toBuffer('image/png'));
}

export async function runVisualLoop({ projectDir, targetsPath = null, maxIter = 6 } = {}) {
  const tlPath = path.join(projectDir, 'timeline.json');
  const timeline = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
  let genre = ''; try { genre = JSON.parse(fs.readFileSync(path.join(projectDir, 'brief.json'), 'utf8')).genre || ''; } catch {}
  const dflt = path.join(ROOT, 'templates', genre === 'horror' ? 'visual_targets.horror.json' : 'visual_targets.json');
  const tp = targetsPath || (fs.existsSync(path.join(projectDir, 'visual_targets.json')) ? path.join(projectDir, 'visual_targets.json') : dflt);
  const T = JSON.parse(fs.readFileSync(tp, 'utf8'));
  const loopDir = path.join(projectDir, 'visual_loop');
  fs.mkdirSync(loopDir, { recursive: true });
  const logPath = path.join(loopDir, 'log.json');
  const log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : { targets: path.relative(projectDir, tp), iterations: [] };
  const iter = log.iterations.length + 1;
  const ids = (timeline.scenes || []).map((s) => s.id);
  const prevEntry = log.iterations[log.iterations.length - 1] || null;
  if (prevEntry) {
    const prevDir = path.join(loopDir, `iter_${String(prevEntry.iter).padStart(2, '0')}`);
    let crit = null;
    try { crit = JSON.parse(fs.readFileSync(path.join(prevDir, 'critique.json'), 'utf8')); } catch { /* */ }
    let prevCrit = null;
    if (prevEntry.iter > 1) { try { prevCrit = JSON.parse(fs.readFileSync(path.join(loopDir, `iter_${String(prevEntry.iter - 1).padStart(2, '0')}`, 'critique.json'), 'utf8')); } catch { /* */ } }
    const regressedIds = (prevEntry.regressions || []).map((r) => r.split(' ')[0]);
    const errs = validateCritique(crit, ids, prevCrit, regressedIds);
    if (errs.length) return { blocked: true, iter, errors: errs.map((e) => `iteration ${prevEntry.iter} critique: ${e}`), hint: `look at ${path.relative(projectDir, path.join(prevDir, 'sheet.png'))}, then write ${path.relative(projectDir, path.join(prevDir, 'critique.json'))} (see references/visual-loop.md)` };
    prevEntry.critique_min = Math.min(...crit.shots.flatMap((s) => RUBRIC.map((k) => s.scores[k])));
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
    if (prevEntry.pass && prevEntry.critique_min >= 3) return { converged: true, iter: prevEntry.iter, message: `LOOP PASS at iteration ${prevEntry.iter}: metrics pass and no critique score below 3. Final check is human.` };
  }
  if (iter > maxIter) return { stopped: true, iter, message: `LOOP STOPPED after ${maxIter} iterations without converging: escalate (new style/reference, or human art direction)` };
  const shots = await renderShots(projectDir, timeline, `${iter}_${Date.now()}`);
  const results = shots.map((s) => {
    const agg = aggregate(s.frames.map((f) => f.m));
    const emptyUnion = [...new Set(s.frames.flatMap((f) => f.m.empty_cells))];
    const worstEmpty = s.frames.reduce((a, f) => (f.m.empty_cells.length > a.length ? f.m.empty_cells : a), []);
    const m = { ...agg, empty_cells: worstEmpty };
    const def = deficits(m, T);
    // keyframes must differ: a shot whose three keys are nearly identical is a still image, not a shot
    const keyDiff = keyframeChange(s.frames);
    if (keyDiff < (T.min_key_change ?? 0.01)) def.push({ metric: 'key_change', value: +keyDiff.toFixed(4), target: `>= ${T.min_key_change ?? 0.01}`, hint: 'the shot does not change between its keyframes: move the camera (push/pan), animate a character (blink, breath, turn) or a light (flicker, sweep)' });
    const score = shotScore({ ...agg, empty_cells: worstEmpty.length }, T);
    const prev = prevEntry?.shots?.find((q) => q.id === s.id);
    return { id: s.id, pass: def.length === 0, score, delta: prev ? +(score - prev.score).toFixed(3) : null, metrics: { ...agg, empty_cells: worstEmpty.length }, empty_where: emptyUnion, deficits: def };
  });
  const regressions = results.filter((r) => r.delta != null && r.delta < -0.03).map((r) => `${r.id} got worse (${r.delta}): revert that change or justify it in the critique`);
  const iterDir = path.join(loopDir, `iter_${String(iter).padStart(2, '0')}`);
  fs.mkdirSync(iterDir, { recursive: true });
  drawSheet(shots, results, path.join(iterDir, 'sheet.png'), iter);
  const pass = results.every((r) => r.pass);
  const entry = { iter, pass, mean_score: +(results.reduce((a, r) => a + r.score, 0) / results.length).toFixed(3), regressions, shots: results.map(({ id, pass: p, score, metrics }) => ({ id, pass: p, score, metrics })) };
  fs.writeFileSync(path.join(iterDir, 'report.json'), JSON.stringify({ ...entry, shots: results, targets: T.name }, null, 2));
  log.iterations.push(entry);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  return {
    iter, pass, mean_score: entry.mean_score, regressions,
    failing: results.filter((r) => !r.pass).map((r) => ({ id: r.id, deficits: r.deficits.map((d) => `${d.metric} ${d.value} (${d.target})`) })),
    next: `LOOK at ${path.relative(projectDir, path.join(iterDir, 'sheet.png'))}, write ${path.relative(projectDir, path.join(iterDir, 'critique.json'))}, fix scene.mjs, run again`
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const a = process.argv.slice(2);
  const get = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : null);
  const proj = get('--project');
  if (!proj) { console.error('usage: visual_loop.mjs --project <dir> [--targets <json>] [--max-iter 6] [--json]'); process.exit(2); }
  const r = await runVisualLoop({ projectDir: path.resolve(proj), targetsPath: get('--targets'), maxIter: Number(get('--max-iter') || 6) });
  if (a.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else if (r.blocked) { console.log('BLOCKED: critique the last iteration first'); r.errors.forEach((e) => console.log(' - ' + e)); console.log(r.hint); }
  else if (r.converged || r.stopped) console.log(r.message);
  else {
    console.log(`ITERATION ${r.iter}: ${r.pass ? 'metrics PASS' : 'FIX'}  mean score ${r.mean_score}`);
    r.regressions.forEach((x) => console.log(' REGRESSION ' + x));
    r.failing.forEach((f) => console.log(` FIX ${f.id}: ${f.deficits.join('; ')}`));
    console.log(r.next);
  }
  process.exit(r.blocked ? 3 : r.converged ? 0 : r.stopped ? 1 : r.pass ? 0 : 1);
}
