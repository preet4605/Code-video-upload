// V5: story formats (standalone / serial / interactive), measured motion/darkness/silence-before-scare,
// horror sound bed, whisper, per-line voice assembly, draft fail-fast, linear loudness graph.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { lintStory, lintStoryProject, parseStoryScript, parseBible, parseBranches } from '../lib/story_lint.mjs';
import { evaluateMotionAndDark, evaluateScares, audioEnvelope, HORROR_MEASURE } from '../lib/horror_measure.mjs';
import { planBed, renderBed, writeWav, SR } from '../scripts/horror_sound.mjs';
import { whisperize } from '../lib/voice_fx.mjs';
import { buildAudioMixFilterGraph } from '../lib/audio_sfx.mjs';
import { parseScript, buildTimeline, synthesizePerLine } from '../scripts/audio_timeline.mjs';
import { resolveBin } from '../lib/runtime.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAND = path.join(ROOT, 'examples/horror-ek-baar');
const INTER = path.join(ROOT, 'examples/horror-sheesha-interactive');
const rd = (p) => fs.readFileSync(p, 'utf8');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cvs_v5_'));
const errIds = (r) => r.errors.map((e) => e.split(':')[0].replace('story/', ''));
const ffmpeg = (args) => { const r = spawnSync(resolveBin('ffmpeg'), ['-v', 'error', '-y', ...args]); assert.equal(r.status, 0, String(r.stderr)); };

function copyProject(src) {
  const d = tmp();
  for (const f of fs.readdirSync(src)) {
    const p = path.join(src, f);
    if (fs.statSync(p).isFile()) fs.copyFileSync(p, path.join(d, f));
  }
  return d;
}
const S = { brief: JSON.parse(rd(path.join(STAND, 'brief.json'))), scriptText: rd(path.join(STAND, 'script.txt')), timeline: JSON.parse(rd(path.join(STAND, 'timeline.json'))) };

// ---------------- standalone ----------------
test('standalone flagship is a complete story', () => {
  const r = lintStoryProject(STAND);
  assert.equal(r.ok, true, r.errors.join('\n'));
  assert.ok(r.spoken_lines >= 9);
});

test('standalone: cliffhanger / part / CTA before payoff fail', () => {
  const script = S.scriptText.replace('[NARRATOR] एक बार।', '[NARRATOR] पार्ट 2 जल्द, फ़ॉलो करो।');
  const r = lintStory({ ...S, scriptText: script });
  assert.ok(errIds(r).includes('no_parts'));
  const early = S.scriptText.replace('[NARRATOR] मैं सो गया।', '[NARRATOR] मैं सो गया। फ़ॉलो करो।');
  assert.ok(errIds(lintStory({ ...S, scriptText: early })).includes('cta_before_payoff'));
});

test('standalone: question ending, or-was-it, clue after twist, no silence, too few lines all fail', () => {
  const q = lintStory({ ...S, scriptText: S.scriptText.replace('[NARRATOR] एक बार।', '[NARRATOR] क्या वो माँ थी?') });
  assert.ok(errIds(q).includes('ending_question'));
  const brief = JSON.parse(JSON.stringify(S.brief));
  brief.story.rule_or_clue[2].line = 'कंबल हिला';
  assert.ok(errIds(lintStory({ ...S, brief })).some((i) => i.startsWith('clue_planted')));
  assert.ok(errIds(lintStory({ ...S, scriptText: S.scriptText.replace(/\[SILENCE dur=1.0\]\n/g, '') })).includes('silence_beat'));
  const thin = S.scriptText.split('\n').filter((l) => !/^\[(NARRATOR|WHISPER)\]/.test(l)).join('\n') + '\n[NARRATOR] रात को कोई एक बार पुकारे... तो जवाब मत देना।\n';
  assert.ok(errIds(lintStory({ ...S, scriptText: thin })).includes('lines_min'));
  const noTwist = JSON.parse(JSON.stringify(S.brief)); noTwist.story.twist.explains_hook = false;
  assert.ok(errIds(lintStory({ ...S, brief: noTwist })).includes('twist_explains_hook'));
  const noStory = { ...S.brief }; delete noStory.story;
  const ns = lintStory({ ...S, brief: noStory });
  assert.ok(errIds(ns).includes('story_missing'));
  const longT = { ...S.timeline, duration_s: 41 };
  assert.ok(errIds(lintStory({ ...S, timeline: longT })).includes('duration'));
});

test('standalone horror needs a [SCARE] cue', () => {
  const r = lintStory({ ...S, scriptText: S.scriptText.replace('[SCARE name=violin_stinger]', '[SFX name=violin_stinger]') });
  assert.ok(errIds(r).includes('scare_cue'));
});

// ---------------- serial ----------------
function serialProject({ bibleExtra = '', script = null, brief = null } = {}) {
  const d = tmp();
  const sc = script || S.scriptText.replace('[NARRATOR] एक बार।', '[NARRATOR] एक बार।\n[NARRATOR] पर नानी कहाँ गईं? पार्ट 2 आ रहा है, फ़ॉलो करो।');
  const b = brief || {
    ...JSON.parse(JSON.stringify(S.brief)),
    format: 'serial',
    series: { id: 'ek-baar', part: 1, of: 2, bible_path: 'series_bible.md', recap_line: '', next_hook: 'पर नानी कहाँ गईं?' }
  };
  b.story.part_question = 'मेरे बगल में कौन लेटा था?';
  b.story.part_payoff = { line: 'उसने मेरी तरफ़ मुँह किया' };
  b.story.characters = ['नानी'];
  b.story.places = ['रसोई'];
  b.story.new_facts = ['the once-caller lies down in the mother\'s place'];
  fs.writeFileSync(path.join(d, 'script.txt'), sc);
  fs.writeFileSync(path.join(d, 'brief.json'), JSON.stringify(b));
  fs.writeFileSync(path.join(d, 'series_bible.md'), `# bible\n## Characters\n- नानी: grandmother\n- माँ: mother\n## Places\n- रसोई: kitchen\n## Rules\n- humans always call twice\n- a once-caller is not human\n## Parts\n- Part 1: the once-caller lies down in the mother's place\n## Canon\n- the once-caller lies down in the mother's place\n${bibleExtra}`);
  return d;
}

test('serial: complete part with cliffhanger after payoff + matching bible passes', () => {
  const r = lintStoryProject(serialProject());
  assert.equal(r.ok, true, r.errors.join('\n'));
});

test('serial: bible mismatches fail (character, missing part entry, new fact not recorded)', () => {
  const d = serialProject();
  const b = JSON.parse(rd(path.join(d, 'brief.json')));
  b.story.characters = ['चाचा'];
  b.story.new_facts = ['the clock always stops at 3:07'];
  fs.writeFileSync(path.join(d, 'brief.json'), JSON.stringify(b));
  fs.writeFileSync(path.join(d, 'series_bible.md'), rd(path.join(d, 'series_bible.md')).replace('- Part 1: the once-caller lies down in the mother\'s place\n', ''));
  const ids = errIds(lintStoryProject(d));
  for (const id of ['bible_character', 'bible_new_fact', 'bible_part_entry']) assert.ok(ids.includes(id), id);
  const nob = serialProject(); fs.rmSync(path.join(nob, 'series_bible.md'));
  assert.ok(errIds(lintStoryProject(nob)).includes('bible_missing'));
});

test('serial: cliffhanger before the payoff / same question / part 2 without recap fail', () => {
  const early = S.scriptText.replace('[NARRATOR] मैं सो गया।', '[NARRATOR] मैं सो गया।\n[NARRATOR] पर नानी कहाँ गईं?');
  const ids = errIds(lintStoryProject(serialProject({ script: early })));
  assert.ok(ids.includes('cliff_after_payoff') || ids.includes('cliff_position'));
  const d = serialProject();
  const b = JSON.parse(rd(path.join(d, 'brief.json')));
  b.series.next_hook = 'पर नानी कहाँ गईं?'; b.story.part_question = 'पर नानी कहाँ गईं?';
  b.series.part = 2; b.series.recap_line = '';
  fs.writeFileSync(path.join(d, 'brief.json'), JSON.stringify(b));
  const ids2 = errIds(lintStoryProject(d));
  assert.ok(ids2.includes('cliff_new_question'));
  assert.ok(ids2.includes('series_recap_line'));
});

test('parseBible / parseBranches read sections', () => {
  const b = parseBible('## Characters\n- A: x\n## Rules\n- r1\n## Parts\n- Part 1: y');
  assert.deepEqual(b.characters, ['A: x']); assert.deepEqual(b.rules, ['r1']); assert.equal(b.parts.length, 1);
  const br = parseBranches('## A\n- Setup: aaaaaaaaaaaa\n- Payoff: pppppppppppp\n## B\n- Setup: bbbbbbbbbbb');
  assert.ok(br.A.setup && br.A.payoff && br.B.setup);
});

// ---------------- interactive ----------------
test('interactive example passes: fork after payoff, both options + vote named, branches + tree present', () => {
  const r = lintStoryProject(INTER);
  assert.equal(r.ok, true, r.errors.join('\n'));
});

test('interactive: missing branches, identical payoffs, unnamed options, fork before payoff, bad vote channel fail', () => {
  const d = copyProject(INTER);
  fs.rmSync(path.join(d, 'branches.md'));
  assert.ok(errIds(lintStoryProject(d)).includes('branches_missing'));
  const d2 = copyProject(INTER);
  const bm = rd(path.join(d2, 'branches.md'));
  const payA = bm.match(/## A[\s\S]*?- Payoff: (.+)/)[1];
  fs.writeFileSync(path.join(d2, 'branches.md'), bm.replace(/(## B[\s\S]*?- Payoff: ).+/, `$1${payA}`));
  assert.ok(errIds(lintStoryProject(d2)).includes('branch_distinct'));
  const d3 = copyProject(INTER);
  fs.writeFileSync(path.join(d3, 'script.txt'), rd(path.join(d3, 'script.txt')).replace('मुड़ूँ, या देखता रहूँ? A या B, कमेंट करो।', 'मुड़ूँ, या देखता रहूँ?'));
  const ids3 = errIds(lintStoryProject(d3));
  assert.ok(ids3.includes('closing_names_options'));
  const d4 = copyProject(INTER);
  const b = JSON.parse(rd(path.join(d4, 'brief.json'))); b.choice.vote_channel = 'poll_sticker';
  b.story.part_payoff = { line: 'मुड़ूँ, या देखता रहूँ' };
  fs.writeFileSync(path.join(d4, 'brief.json'), JSON.stringify(b));
  const ids4 = errIds(lintStoryProject(d4));
  assert.ok(ids4.includes('vote_channel'));
  assert.ok(ids4.includes('fork_after_payoff'));
  const d5 = copyProject(INTER); fs.rmSync(path.join(d5, 'branch_tree.json'));
  assert.ok(errIds(lintStoryProject(d5)).includes('branch_tree_missing'));
});

test('parseStoryScript records silences and scare cues in order', () => {
  const p = parseStoryScript('[NARRATOR] a b c\n[SILENCE dur=1.0]\n[SCARE name=x]\n[NARRATOR] d e f');
  assert.deepEqual(p.events.map((e) => e.kind), ['line', 'silence', 'sfx', 'line']);
  assert.equal(p.events[2].scare, true);
});

// ---------------- measured gates ----------------
const TL2 = { duration_s: 12, scenes: [{ id: 'a', start_s: 0, end_s: 6 }, { id: 'b', start_s: 6, end_s: 12 }], silences: [{ start_s: 7, end_s: 8 }] };
const samp = (fn) => Array.from({ length: 48 }, (_, i) => ({ t: i / 4, ...fn(i / 4) }));

test('measured motion: a static scene fails regardless of declarations; a flagged silence beat is exempt', () => {
  const declared = { ...TL2, scenes: TL2.scenes.map((s) => ({ ...s, beats: [{ animated_properties: ['camera.drift'] }] })) };
  const st = samp(() => ({ mean: 25, p98: 60, motion: 0.0002 }));
  const ids = evaluateMotionAndDark(st, declared).checks.filter((c) => c.severity === 'fail').map((c) => c.id);
  assert.ok(ids.includes('motion_a') && ids.includes('motion_b'));
  const sil = samp((t) => ({ mean: 25, p98: 60, motion: t >= 6.9 && t < 8.1 ? 0.0001 : 0.004 }));
  assert.equal(evaluateMotionAndDark(sil, TL2).checks.filter((c) => c.severity === 'fail').length, 0);
});

test('darkness: >70% unreadable frames warns; > 1.5 s effectively black fails unless flagged blackout', () => {
  const dark = samp(() => ({ mean: 4, p98: 30, motion: 0.004 }));
  assert.ok(evaluateMotionAndDark(dark, TL2).checks.some((c) => c.id === 'dark_share' && c.severity === 'warn'));
  const black = samp((t) => ({ mean: t > 1 && t < 4 ? 1 : 25, p98: t > 1 && t < 4 ? 3 : 60, motion: 0.004 }));
  assert.ok(evaluateMotionAndDark(black, TL2).checks.some((c) => c.id === 'black_a' && c.severity === 'fail'));
  const flagged = { ...TL2, blackouts: [{ start_s: 0.5, end_s: 4.5 }] };
  assert.ok(!evaluateMotionAndDark(black, flagged).checks.some((c) => c.id === 'black_a'));
});

test('silence-before-scare: no drop fails, a designed drop + stinger passes (measured on real audio)', () => {
  const d = tmp();
  const flat = path.join(d, 'flat.wav'), good = path.join(d, 'good.wav');
  ffmpeg(['-f', 'lavfi', '-i', 'aevalsrc=0.3*sin(2*PI*220*t):s=16000:d=6', flat]);
  ffmpeg(['-f', 'lavfi', '-i', "aevalsrc='if(lt(t,2.4),0.3*sin(2*PI*220*t),if(lt(t,3),0.001*sin(2*PI*220*t),0.8*sin(2*PI*1900*t)*exp(-2*(t-3))))':s=16000:d=6", good]);
  const tl = { audio_cues: [{ type: 'sfx', name: 'violin_stinger', scare: true, t_s: 3 }] };
  const bad = evaluateScares(audioEnvelope(flat), tl).checks.filter((c) => c.severity === 'fail').map((c) => c.id);
  assert.ok(bad.includes('scare_drop_0') && bad.includes('scare_stinger_0'));
  assert.equal(evaluateScares(audioEnvelope(good), tl).checks.filter((c) => c.severity === 'fail').length, 0);
});

test('horror_sound bed: deterministic, pre-scare drop >= 20 dB, stinger after, silence beat keeps room tone', () => {
  const tl = { duration_s: 10, scenes: [{ id: 'a', start_s: 0, end_s: 10, mood: 'suspense' }], silences: [{ start_s: 3, end_s: 4 }], audio_cues: [{ type: 'sfx', name: 'slippers', t_s: 1 }, { type: 'sfx', name: 'violin_stinger', scare: true, t_s: 6 }] };
  const plan = planBed(tl, { sound: { ambience: ['fan'] } });
  assert.deepEqual(plan.scares, [6]);
  const a = renderBed(plan), b = renderBed(plan);
  assert.equal(Buffer.from(a.L.buffer).equals(Buffer.from(b.L.buffer)), true);
  const d = tmp(); const w = path.join(d, 'bed.wav');
  writeWav(w, a.L, a.R);
  const env = audioEnvelope(w);
  const r = evaluateScares(env, tl);
  assert.equal(r.checks.filter((c) => c.severity === 'fail').length, 0, JSON.stringify(r.scares));
  let p = 0, n = 0;
  for (let i = Math.floor(3.2 * SR); i < Math.floor(3.8 * SR); i++) { p += a.L[i] * a.L[i]; n++; }
  assert.ok(10 * Math.log10(p / n) > -60, 'room tone continues through a silence beat');
});

test('whisperize removes the voiced pitch (440 Hz energy share drops)', () => {
  const d = tmp(); const src = path.join(d, 's.wav'), out = path.join(d, 'w.wav');
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1', src]);
  whisperize(src, out);
  const share = (f) => {
    const r = spawnSync(resolveBin('ffmpeg'), ['-v', 'error', '-i', f, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-']);
    const x = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 4));
    let re = 0, im = 0, tot = 0;
    for (let i = 0; i < x.length; i++) { re += x[i] * Math.cos((2 * Math.PI * 440 * i) / 16000); im += x[i] * Math.sin((2 * Math.PI * 440 * i) / 16000); tot += x[i] * x[i]; }
    return (re * re + im * im) / (x.length * tot / 2);
  };
  assert.ok(share(out) < share(src) * 0.5, `${share(out)} vs ${share(src)}`);
});

test('per-line voice: designed pauses and silences survive into the voice track; horror is slower', () => {
  const parsed = parseScript('[SCENE id=a mood=suspense]\n[NARRATOR] एक दो तीन चार\n[SILENCE dur=1.0]\n[WHISPER] पाँच छह\n');
  const d = tmp();
  const synthFn = async ({ outPath, index }) => { ffmpeg(['-f', 'lavfi', '-i', `sine=frequency=${300 + index * 100}:sample_rate=48000:duration=1.2`, outPath]); return { ok: true, audio_file: outPath }; };
  return synthesizePerLine({ parsed, opts: { genre: 'horror', lang: 'hi' }, outDir: d, synthFn }).then((tl) => {
    assert.equal(tl.alignment.method, 'per-line-concat');
    assert.equal(tl.silences.length, 1);
    const vo = path.join(d, tl.audio_file);
    const env = audioEnvelope(vo);
    const sil = tl.silences[0];
    assert.ok(levelDb(env, sil.start_s + 0.1, sil.end_s - 0.1) < -60, 'silence beat is silent in the voice track');
    assert.ok(tl.lines[0].dur_s > 1.2, 'horror tempo slows the line (atempo < 1)');
    const fast = buildTimeline(parsed, { genre: 'guide', lang: 'hi' }), slow = buildTimeline(parsed, { genre: 'horror', lang: 'hi' });
    assert.ok(slow.duration_s > fast.duration_s);
  });
});
import { levelDb } from '../lib/horror_measure.mjs';

test('linear loudness graph keeps dynamics (gain + limiter, no loudnorm); measureOnly has no normalisation', () => {
  const g = buildAudioMixFilterGraph({ voiceInputIdx: 1, bgmInputIdx: 2, bgmGainDb: -8, linearGainDb: 3.2, truePeak: -1.5 });
  assert.ok(g.filterComplex.includes('volume=3.20dB,alimiter'));
  assert.ok(!g.filterComplex.includes('loudnorm'));
  assert.ok(g.filterComplex.includes('volume=-8dB'));
  const m = buildAudioMixFilterGraph({ voiceInputIdx: 1, bgmInputIdx: 2, measureOnly: true });
  assert.ok(!m.filterComplex.includes('loudnorm') && !m.filterComplex.includes('alimiter'));
});

test('render_and_lint --draft fails fast on story lint errors (before any frame)', () => {
  const d = copyProject(STAND);
  fs.writeFileSync(path.join(d, 'script.txt'), rd(path.join(d, 'script.txt')).replace('[NARRATOR] एक बार।', '[NARRATOR] पार्ट 2 के लिए फ़ॉलो करो।'));
  const r = spawnSync('node', [path.join(ROOT, 'scripts/render_and_lint.mjs'), '--project', d, '--draft', '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('story/no_parts'));
  assert.ok(!fs.existsSync(path.join(d, 'cache')) || fs.readdirSync(path.join(d, 'cache')).length === 0);
});

test('HORROR_MEASURE thresholds are the calibrated ones', () => {
  assert.equal(HORROR_MEASURE.motionFloor, 0.0008);
  assert.equal(HORROR_MEASURE.scareDropDb, 20);
});

test('scene3d examples are deterministic: a frame does not depend on frames drawn before it', async () => {
  const { createCanvas } = await import('@napi-rs/canvas');
  for (const dir of [STAND, INTER]) {
    const tl = JSON.parse(rd(path.join(dir, 'timeline.json')));
    const { VideoClock } = await import(path.join(dir, 'scene.mjs'));
    const frame = (t) => { const c = createCanvas(180, 320); VideoClock.setTime(t); VideoClock.draw(c.getContext('2d'), 180, 320, tl); return c.toBuffer('image/png'); };
    const scare = (tl.audio_cues.find((c) => c.scare) || {}).t_s;
    const cold = frame(scare + 0.05); // a chromatic-aberration hit frame uses the cached offscreen buffers
    frame(10); frame(scare + 0.1); frame(3);
    const warm = frame(scare + 0.05);
    assert.ok(cold.equals(warm), `${path.basename(dir)} frame depends on history`);
  }
});
