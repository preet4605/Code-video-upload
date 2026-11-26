#!/usr/bin/env node
// reel.mjs: deterministic runner. It never writes creative content: Claude writes brief.json, script.txt,
// lines.json, shotlist.json, scene.mjs and critique.json; this script scaffolds, gates, hashes and runs the rest.
//
//   node scripts/reel.mjs init <dir> --genre <g> --lang hi|en|hinglish --format standalone|serial|interactive [--voice name]
//   node scripts/reel.mjs run <dir> [--stop-at <stage>] [--force <stage>]... [--skip visual_loop] [--draft] [--auto]
//   node scripts/reel.mjs approve <dir> script|visual
//   node scripts/reel.mjs status <dir>
//   node scripts/reel.mjs list-voices [--lang hi|en] [--live]
//
// Stages (in order): preflight, script_gate, script (CHECKPOINT), vo, plan_lint, visual_loop, visual (CHECKPOINT),
// render, master_qa, done. Each stage is idempotent: skipped when its input hash matches run.json and its outputs exist.
// Exit codes: 0 done/stopped-at, 1 stage failed, 2 usage, 3 refused (QA pass cap), 4 done but verdict is not SHIP,
// 10 waiting for a human or for Claude (checkpoint, critique, script). Protocol: references/runner.md
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hashFiles, hashString, scriptHash, visualHash, readRun, writeRun, newRun, approve, SCRIPT_FILES, VISUAL_FILES } from '../lib/run_state.mjs';
import { lintPlanProject } from '../lib/plan_lint.mjs';
import { KALPA_VOICES, pickVoice } from '../lib/voices.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = path.join(ROOT, 'scripts');
export const STAGES = ['preflight', 'script_gate', 'script', 'vo', 'plan_lint', 'visual_loop', 'visual', 'render', 'master_qa', 'done'];
export const MAX_QA_PASSES = 3;
export const EXIT = { OK: 0, FAILED: 1, USAGE: 2, REFUSED: 3, NOT_SHIP: 4, WAITING: 10 };
const GENRES = ['horror', 'funny', 'guide', 'news', 'story', 'motivational', 'default'];

const readJson = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const exists = (dir, f) => fs.existsSync(path.join(dir, f));
const tail = (s, n = 40) => String(s || '').split(/\r?\n/).filter((l, i, a) => l !== '' || i < a.length - 1).slice(-n).join('\n');

// ---------- init ----------
export function initProject(dir, { genre, lang, format, voice } = {}) {
  if (!GENRES.includes(genre)) throw new Error(`--genre must be one of ${GENRES.join('|')}`);
  if (!['hi', 'en', 'hinglish'].includes(lang)) throw new Error('--lang must be hi|en|hinglish');
  if (!['standalone', 'serial', 'interactive'].includes(format)) throw new Error('--format must be standalone|serial|interactive');
  dir = path.resolve(dir);
  if (exists(dir, 'run.json')) throw new Error(`${dir} already has run.json (refusing to overwrite)`);
  fs.mkdirSync(dir, { recursive: true });
  // brief.json starts from the template with every creative field blanked: Claude writes them.
  const base = readJson(path.join(ROOT, 'templates', 'brief.example.json'), {});
  const brief = { ...base, genre, lang, format, hook: '', payoff: '', cta: '', viewer: '', sources: [] };
  if (!exists(dir, 'brief.json')) fs.writeFileSync(path.join(dir, 'brief.json'), JSON.stringify(brief, null, 2) + '\n');
  const v = voice || pickVoice({ genre, lang: lang === 'hinglish' ? 'hi' : lang }).voice;
  if (!exists(dir, 'lines.json')) fs.writeFileSync(path.join(dir, 'lines.json'), JSON.stringify({ voice: v, lines: [] }, null, 2) + '\n');
  writeRun(dir, newRun({ genre, lang, format, voice: v }));
  return { dir, voice: v, files: ['brief.json', 'lines.json', 'run.json'], next: `Claude writes brief.json (hook, payoff, ...), script.txt, lines.json lines, shotlist.json; then: node scripts/reel.mjs run ${dir}` };
}

// ---------- stage helpers ----------
function spawnNode(script, args, { cwd = ROOT } = {}) {
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
  return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || (r.error ? String(r.error) : '') };
}

function emptySkeleton(dir) {
  const l = readJson(path.join(dir, 'lines.json'));
  return l && Array.isArray(l.lines) && l.lines.length === 0;
}

function qaReport(dir) { return readJson(path.join(dir, 'out', 'qa_report.json')); }

// Stage table: hash(dir, ctx) -> string; outputs(dir) -> [relative paths]; run(dir, ctx) -> {code, stdout, stderr} (spawnable, injectable).
const DEFS = {
  preflight: { hash: () => hashString(`doctor:${process.version}`), outputs: () => [], run: (dir) => spawnNode('doctor.mjs', ['--json']) },
  script_gate: {
    hash: (dir) => hashFiles(dir, [...SCRIPT_FILES, 'critique.json', 'shotlist.json']),
    outputs: () => [],
    run: (dir) => spawnNode('script_gate.mjs', [dir, '--mode', 'script', '--json'])
  },
  vo: {
    hash: (dir) => hashFiles(dir, ['lines.json']),
    outputs: () => ['voiceover.wav', 'timeline.json'],
    run: (dir) => spawnNode('build_vo.mjs', ['--project', dir])
  },
  plan_lint: {
    hash: (dir) => hashFiles(dir, ['timeline.json', 'shotlist.json', 'brief.json']),
    outputs: () => [],
    run: (dir) => {
      const r = lintPlanProject(dir);
      return { code: r.pass ? 0 : 1, stdout: JSON.stringify(r), stderr: r.pass ? '' : r.fails.join('\n'), result: r };
    }
  },
  visual_loop: {
    hash: (dir) => hashFiles(dir, VISUAL_FILES),
    outputs: () => ['visual_loop/log.json'],
    run: (dir) => spawnNode('visual_loop.mjs', ['--project', dir, '--json'])
  },
  render: {
    hash: (dir, ctx) => hashString(hashFiles(dir, ['scene.mjs', 'timeline.json', 'brief.json']) + (ctx.draft ? ':draft' : ':full')),
    outputs: () => ['cache/render_manifest.json'],
    run: (dir, ctx) => spawnNode('render_and_lint.mjs', ['--project', dir, '--json', ...(ctx.draft ? ['--draft'] : [])])
  },
  master_qa: {
    hash: (dir) => hashFiles(dir, ['cache/render_manifest.json', 'timeline.json', 'brief.json', 'qa.json', 'voiceover.wav']),
    outputs: () => ['out/qa_report.json'],
    run: (dir) => {
      const brief = readJson(path.join(dir, 'brief.json'), {});
      const tl = readJson(path.join(dir, 'timeline.json'), {});
      const args = ['--project', dir, '--json', '--platform', brief.platform || 'reels'];
      if (tl.audio_file) args.push('--bgm', brief.genre === 'horror' ? 'horror' : 'auto', '--sfx-auto', '--preset', 'reel-vocal', '--audio-mood', 'auto');
      return spawnNode('master_and_qa.mjs', args);
    }
  }
};

function waiting(log, lines) { lines.forEach((l) => log(l)); return { code: EXIT.WAITING, waiting: true }; }

// ---------- run ----------
export async function runPipeline(dir, opts = {}, { commands = {}, log = console.log } = {}) {
  dir = path.resolve(dir);
  const run = readRun(dir);
  if (!run) { log(`no run.json in ${dir}: run "reel.mjs init" first`); return { code: EXIT.USAGE }; }
  const force = new Set(opts.force || []);
  const skip = new Set(opts.skip || []);
  const auto = !!opts.auto;
  const stopAt = opts.stopAt || null;
  if (stopAt && !STAGES.includes(stopAt)) { log(`unknown stage "${stopAt}"; stages: ${STAGES.join(', ')}`); return { code: EXIT.USAGE }; }
  for (const f of [...force, ...skip]) if (!STAGES.includes(f)) { log(`unknown stage "${f}"; stages: ${STAGES.join(', ')}`); return { code: EXIT.USAGE }; }
  const ctx = { draft: !!opts.draft, auto };
  run.stages = run.stages || {};
  run.approvals = run.approvals || {};
  const reasons = new Set(run.unreviewed_reasons || []);
  const save = () => { run.unreviewed = reasons.size > 0; run.unreviewed_reasons = [...reasons]; run.updated_at = new Date().toISOString(); writeRun(dir, run); };
  const stopHere = (name) => stopAt === name;
  const finish = (r) => { save(); return r; };

  for (const name of STAGES) {
    // ----- checkpoints -----
    if (name === 'script' || name === 'visual') {
      const cur = name === 'script' ? scriptHash(dir) : visualHash(dir);
      const ap = run.approvals[name];
      if (ap?.sha256 === cur) log(`[${name}] approved ${ap.at}`);
      else if (auto) { reasons.add(`${name} checkpoint bypassed by --auto`); log(`[${name}] CHECKPOINT bypassed by --auto: run is UNREVIEWED`); }
      else {
        const what = name === 'script'
          ? `Show the user script.txt (and lines.json captions). After they approve: node scripts/reel.mjs approve ${dir} script`
          : `Show the user the latest visual_loop/iter_*/sheet.png (and a draft render if useful). After they approve: node scripts/reel.mjs approve ${dir} visual`;
        const why = ap ? `${name} changed after approval (hash differs)` : `${name} not approved yet`;
        run.stages[name] = { status: 'waiting', at: new Date().toISOString(), reason: why };
        log(`[${name}] CHECKPOINT: ${why}`);
        save();
        return waiting(log, [what]);
      }
      run.stages[name] = { status: 'ok', at: new Date().toISOString(), approved: !!ap && ap.sha256 === cur, input_hash: cur };
      if (stopHere(name)) { save(); return { code: EXIT.OK, stoppedAt: name }; }
      continue;
    }

    if (name === 'done') {
      save();
      return summarize(dir, run, ctx, log);
    }

    // ----- skips -----
    if (name === 'visual_loop' && (auto || skip.has('visual_loop'))) {
      reasons.add(auto ? 'visual loop skipped by --auto' : 'visual loop skipped by --skip');
      run.stages[name] = { status: 'skipped', reason: auto ? '--auto' : '--skip', at: new Date().toISOString() };
      log('[visual_loop] skipped (' + (auto ? '--auto' : '--skip') + '): horror QA will FIX a skipped loop');
      if (stopHere(name)) { save(); return { code: EXIT.OK, stoppedAt: name }; }
      continue;
    }
    if (name === 'vo' && !exists(dir, 'lines.json')) {
      run.stages[name] = { status: 'skipped', reason: 'no lines.json (no voiceover to build)', at: new Date().toISOString() };
      log('[vo] skipped: no lines.json');
      if (stopHere(name)) { save(); return { code: EXIT.OK, stoppedAt: name }; }
      continue;
    }
    if (name === 'script_gate' && !exists(dir, 'script.txt') && !exists(dir, 'lines.json')) {
      run.stages[name] = { status: 'skipped', reason: 'no script.txt or lines.json (no spoken script)', at: new Date().toISOString() };
      log('[script_gate] skipped: no script.txt / lines.json');
      if (stopHere(name)) { save(); return { code: EXIT.OK, stoppedAt: name }; }
      continue;
    }
    if (name === 'script_gate' && !exists(dir, 'script.txt') && emptySkeleton(dir)) {
      return finish(waiting(log, ['[script_gate] WAITING: only the empty skeleton exists.', `Claude writes brief.json, script.txt and lines.json lines in ${dir}, then re-run: node scripts/reel.mjs run ${dir}`]));
    }
    if (name === 'visual_loop' || name === 'render') {
      if (!exists(dir, 'scene.mjs')) return finish(waiting(log, [`[${name}] WAITING: scene.mjs missing. Claude writes ${path.join(dir, 'scene.mjs')}, then re-run.`]));
    }
    if (ctx.draft && name === 'master_qa') {
      log('[master_qa] not run: --draft renders are never mastered or shipped (rule 7). Re-run without --draft for the final.');
      run.draft_only = true; save();
      return { code: EXIT.OK, draft: true };
    }

    const def = DEFS[name];
    const prev = run.stages[name];
    const hash = def.hash(dir, ctx);
    const outputsOk = def.outputs(dir).every((o) => exists(dir, o));
    if (!force.has(name) && prev?.status === 'ok' && prev.input_hash === hash && outputsOk) {
      log(`[${name}] skipped (inputs unchanged)`);
      if (stopHere(name)) { save(); return { code: EXIT.OK, stoppedAt: name }; }
      continue;
    }

    // ----- QA pass cap -----
    if (name === 'master_qa' && (prev?.passes || 0) >= MAX_QA_PASSES && !force.has('master_qa')) {
      const q = qaReport(dir);
      log(`[master_qa] REFUSED: ${prev.passes} QA passes already run (cap ${MAX_QA_PASSES}). Stop fixing automatically and hand this to the human.`);
      if (q) printQa(q, log);
      log(`To run another pass anyway (human decision): node scripts/reel.mjs run ${dir} --force master_qa`);
      return finish({ code: EXIT.REFUSED, refused: true });
    }

    log(`[${name}] running...`);
    const t0 = Date.now();
    let res;
    try { res = commands[name] ? await commands[name]({ dir, ctx, opts }) : def.run(dir, ctx); }
    catch (e) { res = { code: 1, stdout: '', stderr: String(e?.stack || e) }; }
    const entry = { status: 'ok', input_hash: hash, at: new Date().toISOString(), duration_ms: Date.now() - t0, runs: (prev?.runs || 0) + 1 };
    if (name === 'master_qa') entry.passes = (prev?.passes || 0) + 1;

    // visual_loop: exit codes mean "iteration result", not failure; read the JSON
    if (name === 'visual_loop') {
      let j = null;
      try { j = JSON.parse(res.stdout); } catch { /* fall through to failure */ }
      if (!j) return failStage(dir, run, name, entry, res, log, save);
      if (j.converged) {
        Object.assign(run.stages, { [name]: { ...entry, result: j.message } });
        log(`[visual_loop] ${j.message}`);
      } else {
        run.stages[name] = { ...entry, status: 'waiting', result: j };
        if (j.blocked) return finish(waiting(log, ['[visual_loop] BLOCKED: critique the last iteration first.', ...(j.errors || []).map((e) => ' - ' + e), j.hint || '', `then re-run: node scripts/reel.mjs run ${dir}`]));
        if (j.stopped) return finish(waiting(log, [`[visual_loop] ${j.message}`, 'Escalate to the human: new style/reference or art direction.']));
        const failing = (j.failing || []).map((f) => ` FIX ${f.id}: ${f.deficits.join('; ')}`);
        return finish(waiting(log, [`[visual_loop] ITERATION ${j.iter}: ${j.pass ? 'metrics PASS (critique still needed)' : 'FIX'}  mean score ${j.mean_score}`, ...(j.regressions || []).map((r) => ' REGRESSION ' + r), ...failing, `Claude: ${j.next}`, `then re-run: node scripts/reel.mjs run ${dir}`]));
      }
    } else if (res.code !== 0) {
      return failStage(dir, run, name, entry, res, log, save);
    } else {
      run.stages[name] = entry;
      if (name === 'plan_lint') {
        const r = res.result || JSON.parse(res.stdout || '{}');
        entry.warns = r.warns || [];
        (r.warns || []).forEach((w) => log(`  plan warn: ${w}`));
      }
      if (name === 'render' && !auto) { reasons.clear(); } // fully approved render clears an older UNREVIEWED mark
    }
    log(`[${name}] ok`);
    save();
    if (stopHere(name)) return { code: EXIT.OK, stoppedAt: name };
  }
  save();
  return { code: EXIT.OK };
}

function failStage(dir, run, name, entry, res, log, save) {
  run.stages[name] = { ...entry, status: 'failed', exit_code: res.code, stderr_tail: tail(res.stderr || res.stdout, 40) };
  run.failed = { stage: name, exit_code: res.code, at: new Date().toISOString() };
  // a master_qa that ran and produced a report still gets its numbers printed
  log(`[${name}] FAILED (exit ${res.code})`);
  log(run.stages[name].stderr_tail);
  if (name === 'master_qa') { const q = qaReport(dir); if (q) printQa(q, log); }
  save();
  return { code: EXIT.FAILED, failedStage: name };
}

function printQa(q, log) {
  log(`QA verdict: ${q.verdict}`);
  (q.fails || []).forEach((f) => log(` FAIL ${f}`));
  (q.warns || []).forEach((w) => log(` warn ${w}`));
  if (q.measured) log(' measured: ' + JSON.stringify(q.measured).slice(0, 1500));
}

function summarize(dir, run, ctx, log) {
  const q = qaReport(dir);
  const tl = readJson(path.join(dir, 'timeline.json'), {});
  log('');
  log(`=== DONE ${run.unreviewed ? '(UNREVIEWED: ' + (run.unreviewed_reasons || []).join('; ') + ')' : ''}`);
  if (run.unreviewed) log('UNREVIEWED: a human has not approved this reel at every checkpoint.');
  if (q) {
    printQa(q, log);
    log('VERIFIED (measured on the MP4):');
    (q.verified || []).forEach((v) => log(' + ' + (typeof v === 'string' ? v : JSON.stringify(v))));
    log('NOT VERIFIED (a human must judge; watch with sound on a phone):');
    (q.unverified || []).forEach((v) => log(' - ' + (typeof v === 'string' ? v : JSON.stringify(v))));
  } else log('No out/qa_report.json: master_qa has not produced a report.');
  const mp4 = path.join(dir, 'out', `${tl.slug || path.basename(dir)}.mp4`);
  log(`Outputs: ${mp4}${exists(dir, 'out/qa_report.json') ? ', ' + path.join(dir, 'out', 'qa_report.json') : ''}${exists(dir, 'out/qa_contact_sheet.png') ? ', ' + path.join(dir, 'out', 'qa_contact_sheet.png') : ''}`);
  log('Next (manual): write the caption with the ig-caption skill, run it through ig-human, then a human watches the MP4 with sound on a phone.');
  return { code: q && q.verdict && q.verdict !== 'SHIP' ? EXIT.NOT_SHIP : EXIT.OK, done: true, verdict: q?.verdict || null };
}

export function statusText(dir) {
  dir = path.resolve(dir);
  const run = readRun(dir);
  if (!run) return `no run.json in ${dir}`;
  const out = [`project ${dir}`, `genre ${run.genre} lang ${run.lang} format ${run.format}${run.unreviewed ? '  UNREVIEWED (' + (run.unreviewed_reasons || []).join('; ') + ')' : ''}`];
  for (const s of STAGES) {
    const st = run.stages?.[s];
    if (!st) { out.push(`  ${s.padEnd(12)} -`); continue; }
    out.push(`  ${s.padEnd(12)} ${st.status}${st.runs ? ` runs=${st.runs}` : ''}${st.passes ? ` passes=${st.passes}` : ''}${st.reason ? ` (${st.reason})` : ''}${st.exit_code != null ? ` exit=${st.exit_code}` : ''}`);
  }
  for (const k of ['script', 'visual']) {
    const ap = run.approvals?.[k];
    const cur = k === 'script' ? scriptHash(dir) : visualHash(dir);
    out.push(`  approval ${k}: ${ap ? (ap.sha256 === cur ? `valid since ${ap.at}` : 'STALE (inputs changed after approval)') : 'none'}`);
  }
  if (run.failed) out.push(`  last failure: ${run.failed.stage} exit ${run.failed.exit_code}`);
  return out.join('\n');
}

export async function listVoices({ lang = null, live = false, log = console.log } = {}) {
  let rows = Object.entries(KALPA_VOICES).map(([id, v]) => ({ id, name: v.name, langs: v.langs, source: 'bundled catalog (not judged by ear)' }));
  if (live) {
    const { listVoices: fetchVoices } = await import('../lib/kalpa.mjs');
    try { (await import('./audio_timeline.mjs')).loadTtsEnv?.(); } catch { /* optional */ }
    const live = await fetchVoices();
    log(JSON.stringify(live, null, 1));
    return live;
  }
  if (lang) rows = rows.filter((r) => r.langs.includes(lang === 'hinglish' ? 'hi' : lang));
  rows.forEach((r) => log(`${r.name.padEnd(8)} ${r.langs.join(',').padEnd(4)} ${r.id}`));
  return rows;
}

// ---------- CLI ----------
function parse(argv) {
  const o = { _: [], force: [], skip: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--genre') o.genre = argv[++i];
    else if (a === '--lang') o.lang = argv[++i];
    else if (a === '--format') o.format = argv[++i];
    else if (a === '--voice') o.voice = argv[++i];
    else if (a === '--stop-at') o.stopAt = argv[++i];
    else if (a === '--force') o.force.push(argv[++i]);
    else if (a === '--skip') o.skip.push(argv[++i]);
    else if (a === '--auto') o.auto = true;
    else if (a === '--draft') o.draft = true;
    else if (a === '--live') o.live = true;
    else o._.push(a);
  }
  return o;
}

export async function main(argv, deps = {}) {
  const o = parse(argv);
  const [cmd, dir, arg] = o._;
  const usage = 'usage: reel.mjs init|run|approve|status <dir> ... | list-voices  (see header of scripts/reel.mjs)';
  try {
    if (cmd === 'init' && dir) { const r = initProject(dir, o); console.log(JSON.stringify(r, null, 1)); return EXIT.OK; }
    if (cmd === 'run' && dir) return (await runPipeline(dir, o, deps)).code;
    if (cmd === 'approve' && dir && ['script', 'visual'].includes(arg)) {
      const ap = approve(path.resolve(dir), arg);
      console.log(`approved ${arg}: sha256 ${ap.sha256} at ${ap.at}`);
      return EXIT.OK;
    }
    if (cmd === 'status' && dir) { console.log(statusText(dir)); return EXIT.OK; }
    if (cmd === 'list-voices') { await listVoices({ lang: o.lang, live: o.live }); return EXIT.OK; }
  } catch (e) { console.error(`reel.mjs ${cmd}: ${e.message}`); return EXIT.FAILED; }
  console.error(usage);
  return EXIT.USAGE;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
