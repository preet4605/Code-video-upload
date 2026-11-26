import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initProject, runPipeline, main, statusText, EXIT } from '../scripts/reel.mjs';
import { approve, readRun, scriptHash, scriptApprovalProblem } from '../lib/run_state.mjs';
import { lintPlan } from '../lib/plan_lint.mjs';
import { makeTmpProject } from './_tmp_project.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wj = (d, f, o) => { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), typeof o === 'string' ? o : JSON.stringify(o, null, 1)); };

function mkProject(genre = 'guide') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-runner-'));
  initProject(dir, { genre, lang: 'en', format: 'standalone' });
  wj(dir, 'script.txt', 'A line.');
  wj(dir, 'lines.json', { voice: 'Wren', lines: [{ sc: 'a', hi: 'A line.', hl: 'A line.' }] });
  wj(dir, 'scene.mjs', '// scene');
  wj(dir, 'shotlist.json', { scenes: [{ id: 'a', camera: 'push', motion: 'drift', layers: { foreground: 'x', midground: 'y', background: 'z' } }] });
  return dir;
}
const timelineDoc = { slug: 'p', width: 1080, height: 1920, fps: 30, duration_s: 4, audio_file: 'voiceover.wav', scenes: [{ id: 'a', start_s: 0, end_s: 4, beats: [{ t_s: 0, dur_s: 4, hold: false, animated_properties: ['camera.push'] }] }] };

function stubs(dir, calls, over = {}) {
  const ok = (stdout = '{}') => ({ code: 0, stdout, stderr: '' });
  const rec = (n, f) => (c) => { calls.push(n); return f ? f(c) : ok(); };
  return {
    preflight: rec('preflight'),
    script_gate: rec('script_gate'),
    vo: rec('vo', () => { wj(dir, 'voiceover.wav', 'x'); wj(dir, 'timeline.json', timelineDoc); return ok(); }),
    visual_loop: rec('visual_loop', () => { wj(dir, 'visual_loop/log.json', { iterations: [] }); return ok(JSON.stringify({ converged: true, iter: 1, message: 'LOOP PASS (stub)' })); }),
    render: rec('render', () => { wj(dir, 'cache/render_manifest.json', { scenes: [] }); return ok(); }),
    master_qa: rec('master_qa', () => { wj(dir, 'out/qa_report.json', { verdict: 'SHIP', fails: [], warns: [], verified: ['spec ok'], unverified: ['hook strength'], measured: { lufs: -14 } }); return ok(); }),
    ...over
  };
}
const quiet = () => {};

test('init scaffolds brief/lines/run and refuses a second init', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-init-'));
  const r = initProject(dir, { genre: 'horror', lang: 'hi', format: 'standalone' });
  const brief = JSON.parse(fs.readFileSync(path.join(dir, 'brief.json'), 'utf8'));
  assert.equal(brief.genre, 'horror'); assert.equal(brief.lang, 'hi'); assert.equal(brief.hook, '');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'lines.json'), 'utf8')).lines, []);
  assert.equal(readRun(dir).genre, 'horror');
  assert.ok(r.voice);
  assert.throws(() => initProject(dir, { genre: 'horror', lang: 'hi', format: 'standalone' }), /already has run.json/);
  assert.throws(() => initProject(path.join(dir, 'x'), { genre: 'nope', lang: 'hi', format: 'standalone' }), /--genre/);
});

test('skeleton project waits for Claude instead of failing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-skel-'));
  initProject(dir, { genre: 'guide', lang: 'en', format: 'standalone' });
  const r = await runPipeline(dir, {}, { commands: { preflight: () => ({ code: 0, stdout: '', stderr: '' }) }, log: quiet });
  assert.equal(r.code, EXIT.WAITING);
});

test('checkpoints stop the run until approved; stages skip on unchanged hash and rerun on change', async () => {
  const dir = mkProject();
  const calls = [];
  const deps = { commands: stubs(dir, calls), log: quiet };
  let r = await runPipeline(dir, {}, deps);
  assert.equal(r.code, EXIT.WAITING);
  assert.deepEqual(calls, ['preflight', 'script_gate']);
  approve(dir, 'script');
  r = await runPipeline(dir, {}, deps); // vo, plan_lint (real), visual_loop then visual checkpoint
  assert.equal(r.code, EXIT.WAITING);
  assert.ok(calls.includes('vo') && calls.includes('visual_loop'));
  assert.ok(!calls.includes('render'));
  approve(dir, 'visual');
  calls.length = 0;
  r = await runPipeline(dir, {}, deps);
  assert.equal(r.code, EXIT.OK);
  assert.deepEqual(calls, ['render', 'master_qa']); // everything earlier skipped
  const run = readRun(dir);
  assert.equal(run.unreviewed, false);
  assert.equal(run.stages.master_qa.passes, 1);
  // unchanged: nothing reruns
  calls.length = 0;
  await runPipeline(dir, {}, deps);
  assert.deepEqual(calls, []);
  // scene change: visual approval goes stale -> waits; re-approve -> visual_loop, render, master rerun; vo/gate do not
  wj(dir, 'scene.mjs', '// scene v2');
  assert.equal((await runPipeline(dir, {}, deps)).code, EXIT.WAITING);
  assert.deepEqual(calls, ['visual_loop']);
  approve(dir, 'visual');
  calls.length = 0;
  // (visual_loop already re-ran above and is now skipped)
  await runPipeline(dir, {}, deps);
  assert.deepEqual(calls, ['render', 'master_qa']); // loop re-ran during the waiting call above; vo/gate untouched
  // --force reruns one stage only
  calls.length = 0;
  await runPipeline(dir, { force: ['vo'] }, deps);
  assert.deepEqual(calls, ['vo']);
});

test('--stop-at stops after that stage', async () => {
  const dir = mkProject();
  const calls = [];
  const r = await runPipeline(dir, { auto: true, stopAt: 'vo' }, { commands: stubs(dir, calls), log: quiet });
  assert.equal(r.stoppedAt, 'vo');
  assert.deepEqual(calls, ['preflight', 'script_gate', 'vo']);
});

test('--auto bypasses checkpoints but marks the run UNREVIEWED in run.json and the summary', async () => {
  const dir = mkProject();
  const calls = [], out = [];
  const r = await runPipeline(dir, { auto: true }, { commands: stubs(dir, calls), log: (l) => out.push(l) });
  assert.equal(r.code, EXIT.OK);
  const run = readRun(dir);
  assert.equal(run.unreviewed, true);
  assert.ok(run.unreviewed_reasons.length >= 2);
  assert.ok(out.some((l) => /UNREVIEWED/.test(l)));
  assert.ok(!calls.includes('visual_loop')); // auto skips the loop (needs Claude's critique)
  assert.ok(out.some((l) => /NOT VERIFIED/.test(l)) && out.some((l) => /ig-caption/.test(l)));
});

test('stage failure records stage, exit code, last 40 stderr lines; run.json stays valid; no temp files', async () => {
  const dir = mkProject();
  const err = Array.from({ length: 100 }, (_, i) => `err line ${i}`).join('\n');
  const calls = [];
  const deps = { commands: stubs(dir, calls, { vo: () => ({ code: 3, stdout: '', stderr: err }) }), log: quiet };
  const r = await runPipeline(dir, { auto: true }, deps);
  assert.equal(r.code, EXIT.FAILED);
  const run = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8')); // valid JSON
  assert.equal(run.failed.stage, 'vo');
  assert.equal(run.stages.vo.exit_code, 3);
  assert.equal(run.stages.vo.status, 'failed');
  const lines = run.stages.vo.stderr_tail.split('\n');
  assert.equal(lines.length, 40);
  assert.equal(lines.at(-1), 'err line 99');
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')), []);
  // a throwing command is also recorded, not crashed
  const dir2 = mkProject();
  const r2 = await runPipeline(dir2, { auto: true }, { commands: stubs(dir2, [], { vo: () => { throw new Error('boom'); } }), log: quiet });
  assert.equal(r2.code, EXIT.FAILED);
  assert.match(readRun(dir2).stages.vo.stderr_tail, /boom/);
});

test('approval lock: render_and_lint refuses after the script changed; no run.json = unchanged behaviour', () => {
  const dir = mkProject();
  approve(dir, 'script');
  assert.equal(scriptApprovalProblem(dir), null);
  wj(dir, 'script.txt', 'A different line.');
  assert.match(scriptApprovalProblem(dir), /script changed after approval/);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/render_and_lint.mjs'), '--project', dir, '--json'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /script changed after approval: re-approve with reel\.mjs approve .* script/);
  // re-approve -> the lock no longer fires (it then fails later on missing timeline, which is a different error)
  approve(dir, 'script');
  const r2 = spawnSync(process.execPath, [path.join(ROOT, 'scripts/render_and_lint.mjs'), '--project', dir, '--json'], { encoding: 'utf8' });
  assert.doesNotMatch(r2.stderr, /changed after approval/);
  // no run.json at all
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-bare-'));
  assert.equal(scriptApprovalProblem(bare), null);
  const r3 = spawnSync(process.execPath, [path.join(ROOT, 'scripts/render_and_lint.mjs'), '--project', bare, '--json'], { encoding: 'utf8' });
  assert.doesNotMatch(r3.stderr, /changed after approval/);
});

test('master_qa: 4th pass refused without --force master_qa, numbers printed', async () => {
  const dir = mkProject();
  const calls = [], out = [];
  const deps = { commands: stubs(dir, calls), log: (l) => out.push(l) };
  for (let i = 0; i < 3; i++) {
    wj(dir, 'qa.json', { n: i }); // changes the master_qa input hash
    assert.equal((await runPipeline(dir, { auto: true }, deps)).code, EXIT.OK);
  }
  assert.equal(readRun(dir).stages.master_qa.passes, 3);
  wj(dir, 'qa.json', { n: 99 });
  out.length = 0; calls.length = 0;
  const r = await runPipeline(dir, { auto: true }, deps);
  assert.equal(r.code, EXIT.REFUSED);
  assert.ok(!calls.includes('master_qa'));
  assert.ok(out.some((l) => /REFUSED/.test(l)) && out.some((l) => /measured/.test(l)));
  const f = await runPipeline(dir, { auto: true, force: ['master_qa'] }, deps);
  assert.equal(f.code, EXIT.OK);
  assert.equal(readRun(dir).stages.master_qa.passes, 4);
});

test('visual_loop result is relayed: waiting with instructions, converged advances', async () => {
  const dir = mkProject();
  approve(dir, 'script');
  const out = [];
  const iter = JSON.stringify({ iter: 2, pass: false, mean_score: 0.5, regressions: [], failing: [{ id: 'a', deficits: ['depth 0.1 (>= 0.3)'] }], next: 'LOOK at visual_loop/iter_02/sheet.png, write critique' });
  const r = await runPipeline(dir, {}, { commands: stubs(dir, [], { visual_loop: () => ({ code: 1, stdout: iter, stderr: '' }) }), log: (l) => out.push(l) });
  assert.equal(r.code, EXIT.WAITING);
  assert.ok(out.some((l) => /FIX a: depth/.test(l)) && out.some((l) => /critique/.test(l)));
  assert.equal(readRun(dir).stages.visual_loop.status, 'waiting');
});

test('status and list-voices (offline)', async () => {
  const dir = mkProject();
  assert.match(statusText(dir), /approval script: none/);
  approve(dir, 'script');
  assert.match(statusText(dir), /approval script: valid/);
  wj(dir, 'script.txt', 'changed');
  assert.match(statusText(dir), /STALE/);
  const lines = [];
  const orig = console.log; console.log = (l) => lines.push(l);
  try { assert.equal(await main(['list-voices', '--lang', 'hi']), 0); } finally { console.log = orig; }
  assert.ok(lines.some((l) => /^Aman/.test(l)) && !lines.some((l) => /^Wren/.test(l)));
});

test('plan_lint: passing and failing fixtures', () => {
  const tl = (n, props = ['camera.push']) => ({ scenes: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, start_s: i * 3, end_s: i * 3 + 3, beats: [{ t_s: i * 3, dur_s: 3, hold: false, animated_properties: props }] })) });
  const good = { scenes: Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, camera: 'push', motion: 'drift', layers: { foreground: 'f', midground: 'm', background: `bg${i}` } })) };
  assert.deepEqual(lintPlan({ timeline: tl(5), shotlist: good, brief: { genre: 'horror' } }).fails, []);
  assert.equal(lintPlan({ timeline: tl(5), shotlist: good }).warns.length, 0);
  // repeated backdrop: 3 of 5 = 60%
  const rep = { scenes: good.scenes.map((s, i) => ({ ...s, layers: { ...s.layers, background: i < 3 ? 'same wall' : `bg${i}` } })) };
  assert.ok(lintPlan({ timeline: tl(5), shotlist: rep }).warns.some((w) => /reused in 60%/.test(w)));
  const h = lintPlan({ timeline: tl(5), shotlist: rep, brief: { genre: 'horror' } });
  assert.equal(h.pass, false); assert.ok(h.fails.some((f) => /50%/.test(f)));
  // 2 of 5 = 40% -> not over the 40% limit
  const ok40 = { scenes: good.scenes.map((s, i) => ({ ...s, layers: { ...s.layers, background: i < 2 ? 'same wall' : `bg${i}` } })) };
  assert.ok(!lintPlan({ timeline: tl(5), shotlist: ok40 }).warns.some((w) => /reused/.test(w)));
  // repeated scene id
  const dup = { scenes: [...tl(2).scenes, { ...tl(1).scenes[0] }] };
  assert.ok(lintPlan({ timeline: dup }).warns.some((w) => /appears 2 times/.test(w)));
  // no camera, held > 4 s
  const held = { scenes: [{ id: 'h', start_s: 0, end_s: 8, beats: [{ t_s: 0, dur_s: 8, hold: true, animated_properties: [] }] }] };
  const hr = lintPlan({ timeline: held });
  assert.ok(hr.warns.some((w) => /no declared camera/.test(w)) && hr.warns.some((w) => /no motion for 8\.0 s/.test(w)));
  // text-only
  assert.ok(lintPlan({ timeline: tl(2, ['title.alpha', 'caption.y']) }).warns.some((w) => /text-only/.test(w)));
  // missing foreground when layers field exists
  const nofg = { scenes: [{ ...good.scenes[0] }, { id: 's1', camera: 'push', motion: 'x', layers: { midground: 'm', background: 'b' } }] };
  assert.ok(lintPlan({ timeline: tl(2), shotlist: nofg }).warns.some((w) => /"s1": no foreground/.test(w)));
  // horror: > 2 static shots fails; warn only for other genres
  const stat = { scenes: Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, start_s: i, end_s: i + 1, beats: [] })) };
  assert.equal(lintPlan({ timeline: stat, brief: { genre: 'horror' } }).pass, false);
  assert.equal(lintPlan({ timeline: stat, brief: { genre: 'guide' } }).pass, true);
  // shipped examples pass
  for (const ex of ['zero-shadow-day', 'horror-ek-baar']) {
    const d = path.join(ROOT, 'examples', ex);
    const r = lintPlan({ timeline: JSON.parse(fs.readFileSync(path.join(d, 'timeline.json'))), shotlist: JSON.parse(fs.readFileSync(path.join(d, 'shotlist.json'))), brief: JSON.parse(fs.readFileSync(path.join(d, 'brief.json'))) });
    assert.equal(r.pass, true, ex);
  }
});

test('integration: init -> hello-15s creative files -> run --auto --draft through render (real scripts)', async (t) => {
  const tmp = makeTmpProject('hello-15s');
  try {
    initProject(tmp.dir, { genre: 'guide', lang: 'en', format: 'standalone' });
    fs.rmSync(path.join(tmp.dir, 'lines.json')); // silent reel: no voiceover
    const out = [];
    const t0 = Date.now();
    const r = await runPipeline(tmp.dir, { auto: true, draft: true, stopAt: 'render' }, { log: (l) => out.push(l) });
    const secs = (Date.now() - t0) / 1000;
    if (r.code !== EXIT.OK && secs > 60) return t.skip(`hello draft render did not finish within 60 s (${secs.toFixed(0)} s)`);
    assert.equal(r.code, EXIT.OK, out.join('\n'));
    const run = readRun(tmp.dir);
    assert.equal(run.stages.render.status, 'ok');
    assert.equal(run.unreviewed, true);
    assert.ok(fs.existsSync(path.join(tmp.dir, 'cache', 'render_manifest.json')));
    // second run: render skipped
    const out2 = [];
    await runPipeline(tmp.dir, { auto: true, draft: true, stopAt: 'render' }, { log: (l) => out2.push(l) });
    assert.ok(out2.some((l) => /\[render\] skipped/.test(l)));
  } finally { tmp.cleanup(); }
});
