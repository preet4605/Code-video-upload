import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  norm, parseScript, checkScript, checkIdea, checkCritique, checkShotlist, evaluateVisual,
  analyzeVisualField, runHorrorVisualGate, HORROR_VISUAL, CRITIQUE_QUESTIONS, wordTarget
} from '../lib/horror_gate.mjs';
import { runScriptGate } from '../scripts/script_gate.mjs';
import { resolveBin } from '../lib/runtime.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLAG = path.join(ROOT, 'examples/horror-ek-baar');
const script = fs.readFileSync(path.join(FLAG, 'script.txt'), 'utf8');
const brief = JSON.parse(fs.readFileSync(path.join(FLAG, 'brief.json'), 'utf8'));
const good = JSON.parse(fs.readFileSync(path.join(FLAG, 'critique.json'), 'utf8'));
const failIds = (r) => r.checks.filter((c) => c.severity === 'fail').map((c) => c.id);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_h_'));

test('norm: nukta and NFC variants match', () => {
  assert.equal(norm('ख़ौफ़नाक'), norm('खौफनाक'));
  assert.equal(norm('  A   b '), 'a b');
});

test('flagship script + critique pass the script gate', () => {
  const r = runScriptGate(FLAG, 'script');
  assert.equal(r.pass, true, r.fails.join('\n'));
});

test('thin script fails on length, scenes and sound', () => {
  const thin = '[SCENE id=a mood=suspense]\n[NARRATOR] रात को घर में कुछ था।\n[NARRATOR] मुझे डर लगा।\n';
  const f = failIds(checkScript(thin, brief));
  for (const id of ['not_thin_words', 'scene_count', 'sfx_designed']) assert.ok(f.includes(id), id);
});

test('cliches and AI-tells fail; one fear statement allowed, two warn', () => {
  const bad = script + '\n[NARRATOR] अचानक एक खौफनाक आवाज़ आई।\n';
  assert.ok(failIds(checkScript(bad, brief)).includes('no_cliches'));
  assert.ok(failIds(checkScript(script.replace('सुबह रसोई', 'सुबह रसोई'), brief)).length === 0);
});

test('raw digits in Hindi spoken text fail (TTS mispronounces them)', () => {
  const f = failIds(checkScript(script.replace('तीन बजकर सात मिनट', '3:07'), brief));
  assert.ok(f.includes('tts_digits'));
});

test('hook longer than 14 words fails; no folk attribution fails', () => {
  const long = script.replace('रात को कोई एक बार पुकारे... तो जवाब मत देना।', 'रात को कोई एक बार पुकारे तो जवाब मत देना क्योंकि वो बहुत बुरा होता है और कभी कोई नहीं देता।');
  assert.ok(failIds(checkScript(long, brief)).includes('hook_short'));
  const nofolk = script.replace(/नानी कहती थीं[।,]/g, '').replace(/नानी/g, 'वो');
  assert.ok(failIds(checkScript(nofolk, brief)).includes('folk_grounding'));
});

test('word target scales with duration and is not hard-coded', () => {
  assert.ok(wordTarget({ durationS: 30, lang: 'hi' }).mid < wordTarget({ durationS: 60, lang: 'hi' }).mid);
});

test('critique: rubber-stamp, missing evidence, low score, wrong mode, flattering verdict all fail', () => {
  const clone = () => JSON.parse(JSON.stringify(good));
  const stamp = clone(); stamp.answers.forEach((a) => { a.score = 5; });
  assert.ok(failIds(checkCritique(stamp, script)).some((i) => ['uniform_scores', 'no_perfect_sheet'].includes(i)));
  const noEv = clone(); noEv.answers[0].evidence = 'यह लाइन स्क्रिप्ट में नहीं है';
  assert.ok(failIds(checkCritique(noEv, script)).includes('evidence_stranger_test'));
  const low = clone(); low.answers[4].score = 2;
  const lr = checkCritique(low, script);
  assert.ok(failIds(lr).includes('score_consequence'));
  assert.ok(failIds(lr).includes('verdict_vs_scores'));
  const mode = clone(); mode.mode = 'idea';
  assert.ok(failIds(checkCritique(mode, script)).includes('critique_mode'));
  const flatter = clone(); flatter.verdict = 'great';
  assert.ok(failIds(checkCritique(flatter, script, { heuristicFails: 2 })).includes('verdict_vs_heuristics'));
  const bluff = clone(); bluff.verdict = 'bluff';
  assert.ok(failIds(checkCritique(bluff, script)).includes('verdict_blocks'));
  const noPlot = clone(); noPlot.answers.find((a) => a.id === 'bluff_plot_without_adjectives').plot_events = ['एक'];
  assert.ok(failIds(checkCritique(noPlot, script)).includes('plot_events'));
  const missing = clone(); missing.answers.pop();
  assert.ok(failIds(checkCritique(missing, script)).includes('critique_complete'));
  assert.equal(Object.keys(CRITIQUE_QUESTIONS).length, 14);
});

test('idea mode: example passes; a script submitted as an idea fails', () => {
  const idea = fs.readFileSync(path.join(ROOT, 'templates/horror-idea.example.md'), 'utf8');
  assert.deepEqual(failIds(checkIdea(idea)), []);
  assert.ok(failIds(checkIdea(script)).length >= 5);
  const d = tmp();
  fs.writeFileSync(path.join(d, 'idea.md'), idea);
  assert.equal(runScriptGate(d, 'idea').pass, true);
});

test('script gate: missing critique fails script mode', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'script.txt'), script);
  fs.writeFileSync(path.join(d, 'brief.json'), JSON.stringify(brief));
  const r = runScriptGate(d, 'script');
  assert.equal(r.pass, false);
  assert.ok(r.fails.some((f) => f.startsWith('critique_present')));
});

const timeline = JSON.parse(fs.readFileSync(path.join(FLAG, 'timeline.json'), 'utf8'));
const shot = JSON.parse(fs.readFileSync(path.join(FLAG, 'shotlist.json'), 'utf8'));

test('shotlist: flagship passes; missing scene, static motion, 3 details, off-safe focal all fail', () => {
  assert.deepEqual(failIds(checkShotlist(shot, timeline)), []);
  const c = () => JSON.parse(JSON.stringify(shot));
  const a = c(); a.scenes.pop();
  assert.ok(failIds(checkShotlist(a, timeline)).some((i) => i.startsWith('shot_')));
  const b = c(); b.scenes[0].motion = 'static';
  assert.ok(failIds(checkShotlist(b, timeline)).includes('shot_hook'));
  const d = c(); d.scenes[1].details = d.scenes[1].details.slice(0, 3);
  assert.ok(failIds(checkShotlist(d, timeline)).includes('shot_nani'));
  const e = c(); e.scenes[2].focal_point = [1050, 1800];
  assert.ok(failIds(checkShotlist(e, timeline)).includes('shot_wake'));
  const f = c(); f.scenes.forEach((s) => { s.intensity = 3; });
  assert.ok(failIds(checkShotlist(f, timeline)).includes('intensity_escalates'));
  assert.ok(failIds(checkShotlist(null, timeline)).includes('shotlist_present'));
});

function synth(mean, edge, motion, t0, dur) {
  const out = [];
  for (let t = t0; t < dur; t += 0.25) out.push({ t, mean, p98: mean * 3, edge, motion });
  return out;
}
const TL = { duration_s: 30, scenes: [{ id: 'a', start_s: 0, end_s: 15 }, { id: 'b', start_s: 15, end_s: 30 }] };

test('evaluateVisual: good passes; bright, mud, empty and flat motion each fail', () => {
  const ok = [...synth(20, 0.02, 0.003, 0, 10), ...synth(20, 0.02, 0.003, 10, 20), ...synth(20, 0.02, 0.008, 20, 30)];
  assert.deepEqual(failIds(evaluateVisual(ok, TL)), []);
  const bright = ok.map((s) => ({ ...s, mean: 90, p98: 200 }));
  assert.ok(failIds(evaluateVisual(bright, TL)).includes('bright_a'));
  const mud = ok.map((s) => ({ ...s, p98: 12 }));
  assert.ok(failIds(evaluateVisual(mud, TL)).includes('mud_a'));
  const empty = ok.map((s) => ({ ...s, edge: 0.001 }));
  assert.ok(failIds(evaluateVisual(empty, TL)).includes('empty_a'));
  const flat = ok.map((s) => ({ ...s, motion: 0.004 }));
  assert.ok(failIds(evaluateVisual(flat, TL)).includes('escalation'));
  const allowed = evaluateVisual(bright, TL, { sceneAllow: { a: ['bright'], b: ['bright'] } });
  assert.ok(!failIds(allowed).some((i) => i.startsWith('bright_')));
});

function lavfi(file, src, secs = 4) {
  const r = spawnSync(resolveBin('ffmpeg'), ['-v', 'error', '-y', '-f', 'lavfi', '-i', src, '-t', String(secs), '-pix_fmt', 'yuv420p', '-an', file]);
  assert.equal(r.status, 0, String(r.stderr));
}

test('analyzeVisualField separates dark-detailed, bright and empty-dark real videos', () => {
  const d = tmp();
  const dark = path.join(d, 'dark.mp4'), bright = path.join(d, 'bright.mp4'), empty = path.join(d, 'empty.mp4');
  lavfi(dark, 'testsrc2=size=360x640:rate=15,eq=brightness=-0.42:contrast=0.9');
  lavfi(bright, 'testsrc2=size=360x640:rate=15,eq=brightness=0.25');
  lavfi(empty, 'color=c=0x0c0c0c:size=360x640:rate=15');
  const m = (f) => { const s = analyzeVisualField(f); return { mean: s.reduce((a, b) => a + b.mean, 0) / s.length, edge: s.reduce((a, b) => a + b.edge, 0) / s.length, p98: s.reduce((a, b) => a + b.p98, 0) / s.length }; };
  const md = m(dark), mb = m(bright), me = m(empty);
  assert.ok(mb.mean > md.mean + 30, `${mb.mean} vs ${md.mean}`);
  assert.ok(me.edge < HORROR_VISUAL.minEdge, `empty edge ${me.edge}`);
  assert.ok(md.edge > HORROR_VISUAL.minEdge, `dark edge ${md.edge}`);
});

test('smoke_test brief downgrades visual-gate fails to warnings; real horror briefs do not', () => {
  const d = tmp();
  const mp4 = path.join(d, 'x.mp4');
  lavfi(mp4, 'color=c=0x0c0c0c:size=360x640:rate=15', 6);
  const tl = { duration_s: 6, scenes: [{ id: 'a', start_s: 0, end_s: 3 }, { id: 'b', start_s: 3, end_s: 6 }] };
  fs.writeFileSync(path.join(d, 'timeline.json'), JSON.stringify(tl));
  fs.writeFileSync(path.join(d, 'brief.json'), JSON.stringify({ genre: 'horror', smoke_test: true }));
  const smoke = runHorrorVisualGate({ mp4, projectDir: d, writeSheet: false });
  assert.equal(smoke.pass, true);
  assert.ok(smoke.warns.some((w) => w.startsWith('[smoke]')));
  fs.writeFileSync(path.join(d, 'brief.json'), JSON.stringify({ genre: 'horror' }));
  const real = runHorrorVisualGate({ mp4, projectDir: d, writeSheet: false });
  assert.equal(real.pass, false);
  assert.ok(real.fails.some((f) => f.startsWith('shotlist_present')));
});

test('parseScript reads scenes, speakers and inline SFX', () => {
  const p = parseScript('[SCENE id=x mood=calm]\n[NARRATOR] a b [SFX name=thud] c\n[SFX name=door_creak]\n');
  assert.equal(p.scenes.length, 1);
  assert.deepEqual(p.scenes[0].sfx, ['thud', 'door_creak']);
  assert.equal(p.lines[0], 'a b c');
});
