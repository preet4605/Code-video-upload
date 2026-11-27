// P0: horror enforcement, verified/unverified honesty, doctor preflight, SKILL.md budget.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateVisual, applyVisualLoopGate, HORROR_VISUAL } from '../lib/horror_gate.mjs';
import { runQa, buildVerification, QA_CONTRACT_VERSION } from '../scripts/qa_video.mjs';
import { finalizeHonesty } from '../scripts/master_and_qa.mjs';
import { checkBundledFonts, checkDevanagariShaping, checkFfmpegFilters, checkTtsKeys } from '../scripts/doctor.mjs';
import { resolveBin } from '../lib/runtime.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'p0-'));
const freshShip = () => ({ verdict: 'SHIP', fails: [], warns: [], verified: [], unverified: [] });
const failIds = (r) => r.checks.filter((c) => c.severity === 'fail').map((c) => c.id);
const warnIds = (r) => r.checks.filter((c) => c.severity === 'warn').map((c) => c.id);

function synth(mean, edge, motion, t0, t1) {
  const out = [];
  for (let t = t0; t < t1; t += 0.25) out.push({ t, mean, p98: mean * 3, edge, motion });
  return out;
}
const TL = { duration_s: 30, scenes: [{ id: 'a', start_s: 0, end_s: 15 }, { id: 'b', start_s: 15, end_s: 30 }] };
// ratio = 0.00378 / 0.003 = 1.26 (the number from the shipped report): above escalationMin, below 1.4
const weak = () => [...synth(20, 0.02, 0.003, 0, 20), ...synth(20, 0.02, 0.00378, 20, 30)];

test('horror: escalation 1.26 (< 1.4) is a FAIL, not a warning', () => {
  const r = evaluateVisual(weak(), TL);
  assert.ok(failIds(r).includes('escalation'), JSON.stringify(r.checks));
  assert.ok(Math.abs(r.escalation - 1.26) < 0.03, `ratio ${r.escalation}`);
  assert.ok(!warnIds(r).includes('escalation'));
});

test('horror: explicit escape hatch (escalationWeakIsFail=false) downgrades to a warning; good escalation passes', () => {
  const r = evaluateVisual(weak(), TL, { thresholds: { ...HORROR_VISUAL, escalationWeakIsFail: false } });
  assert.ok(!failIds(r).includes('escalation'));
  assert.ok(warnIds(r).includes('escalation'));
  const good = [...synth(20, 0.02, 0.003, 0, 20), ...synth(20, 0.02, 0.008, 20, 30)];
  assert.deepEqual(failIds(evaluateVisual(good, TL)), []);
});

test('horror + no visual loop => FIX with a runnable fix hint', () => {
  const d = tmp();
  const ship = freshShip();
  const r = applyVisualLoopGate(ship, d, { genre: 'horror' }, {});
  assert.equal(r.run, false);
  assert.equal(ship.verdict, 'FIX');
  assert.ok(ship.fails.some((f) => f.includes('visual-loop: not run') && f.includes('scripts/visual_loop.mjs --project')), ship.fails.join('|'));
});

test('horror + visual loop not converged => FIX; converged => SHIP', () => {
  const d = tmp();
  fs.mkdirSync(path.join(d, 'visual_loop'));
  const log = (it) => fs.writeFileSync(path.join(d, 'visual_loop', 'log.json'), JSON.stringify({ iterations: [it] }));
  log({ iter: 1, pass: false, critique_min: 2 });
  const bad = freshShip();
  applyVisualLoopGate(bad, d, { genre: 'horror' }, {});
  assert.equal(bad.verdict, 'FIX');
  log({ iter: 2, pass: true, critique_min: 4, mean_score: 4 });
  const ok = freshShip();
  applyVisualLoopGate(ok, d, { genre: 'horror' }, {});
  assert.equal(ok.verdict, 'SHIP');
  assert.equal(ok.fails.length, 0);
});

test('non-horror genres: missing visual loop stays a warning, verdict unchanged', () => {
  for (const genre of ['funny', 'guide', 'news', 'story', undefined]) {
    const ship = freshShip();
    applyVisualLoopGate(ship, tmp(), { genre }, {});
    assert.equal(ship.verdict, 'SHIP', String(genre));
    assert.equal(ship.fails.length, 0);
    assert.ok(ship.warns.some((w) => w.includes('visual-loop: not run')));
  }
});

test('horror waivers: qa.json require_visual_loop=false and smoke_test downgrade to warnings', () => {
  const a = freshShip();
  applyVisualLoopGate(a, tmp(), { genre: 'horror' }, { require_visual_loop: false });
  assert.equal(a.verdict, 'SHIP');
  assert.ok(a.warns.some((w) => w.includes('waived')));
  const b = freshShip();
  applyVisualLoopGate(b, tmp(), { genre: 'horror', smoke_test: true }, {});
  assert.equal(b.verdict, 'SHIP');
});

function lavfiMp4(file, secs = 3) {
  const r = spawnSync(resolveBin('ffmpeg'), ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=360x640:rate=15', '-f', 'lavfi', '-i', 'sine=frequency=300:sample_rate=48000', '-t', String(secs), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-c:a', 'aac', '-ar', '48000', file]);
  assert.equal(r.status, 0, String(r.stderr));
}

test('qa_report has contract_version, verified and unverified; finalize adds horror FIX end to end', () => {
  const d = tmp();
  const mp4 = path.join(d, 'x.mp4');
  lavfiMp4(mp4);
  fs.writeFileSync(path.join(d, 'brief.json'), JSON.stringify({ genre: 'horror' }));
  const ship = runQa({ mp4, projectDir: d, loudness: { integrated_lufs: -16, target_lufs: -16, true_peak_dbtp: -3, true_peak_limit_dbtp: -1.5 }, writeSheet: false });
  assert.equal(ship.contract_version, QA_CONTRACT_VERSION);
  assert.equal(QA_CONTRACT_VERSION, '1.0');
  assert.ok(Array.isArray(ship.verified) && ship.verified.length >= 4, JSON.stringify(ship.verified));
  assert.ok(ship.verified.some((v) => /loudness: -16 LUFS/.test(v)), 'verified entries carry values');
  assert.ok(Array.isArray(ship.unverified));
  for (const k of ['hook strength', 'fear', 'pronunciation', 'taste', 'factual']) assert.ok(ship.unverified.some((u) => u.includes(k)), k);
  assert.ok(ship.measured && 'verdict' in ship && Array.isArray(ship.fails), 'legacy fields kept');
  finalizeHonesty(ship, d, { genre: 'horror' }, {});
  assert.equal(ship.verdict, 'FIX');
  assert.ok(ship.unverified.some((u) => u.includes('visual-loop not run')));
  // same clip as a funny reel: loop missing is not a failure
  const ok = runQa({ mp4, projectDir: null, writeSheet: false });
  finalizeHonesty(ok, d, { genre: 'funny' }, {});
  assert.ok(!ok.fails.some((f) => f.includes('visual-loop')));
});

test('buildVerification lists skipped checks as unverified', () => {
  const v = buildVerification({ probe: { streams: [], format: { duration: '3' } } });
  assert.equal(v.contract_version, '1.0');
  assert.ok(v.unverified.includes('loudness not measured'));
  assert.ok(v.unverified.some((u) => u.includes('flash check skipped')));
});

test('doctor: bundled fonts, Devanagari shaping, ffmpeg filters, TTS key presence (no value leak)', async () => {
  assert.equal(checkBundledFonts().ok, true);
  const broken = checkBundledFonts(tmp());
  assert.equal(broken.ok, false);
  assert.ok(broken.missing.includes('NotoSansDevanagari-Bold.ttf'));
  const sh = await checkDevanagariShaping();
  assert.equal(sh.ok, true);
  assert.ok(sh.width > 0);
  assert.equal((await checkDevanagariShaping(tmp())).ok, false);
  const f = checkFfmpegFilters(resolveBin('ffmpeg'));
  assert.equal(f.ok, true, `missing ${f.missing}`);
  assert.equal(checkFfmpegFilters(resolveBin('ffmpeg'), ['loudnorm', 'no_such_filter_xyz']).ok, false);
  const prev = process.env.KALPA_API_KEY;
  process.env.KALPA_API_KEY = 'SECRET-VALUE-123';
  const t = checkTtsKeys();
  assert.equal(t.KALPA_API_KEY, 'set');
  assert.ok(!JSON.stringify(t).includes('SECRET-VALUE-123'));
  if (prev === undefined) delete process.env.KALPA_API_KEY; else process.env.KALPA_API_KEY = prev;
});

test('doctor --json keeps existing keys and adds the P0 checks', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'doctor.mjs'), '--json'], { encoding: 'utf8' });
  const j = JSON.parse(r.stdout);
  for (const k of ['node', 'ffmpeg', 'ffprobe', 'renderer', 'fonts', 'tts', 'bundled_fonts', 'devanagari_shaping', 'ffmpeg_filters', 'tts_keys']) assert.ok(k in j.checks, k);
  assert.ok(['set', 'not set'].includes(j.checks.tts_keys.KALPA_API_KEY));
});

test('SKILL.md: < 5500 bytes, <= 12 hard rules, every relative link resolves, honest contract kept', () => {
  const p = path.join(ROOT, 'SKILL.md');
  const s = fs.readFileSync(p, 'utf8');
  assert.ok(fs.statSync(p).size < 5500);
  assert.match(s, /^name:\s*reel-factory/m);
  const rules = s.split('## Hard rules')[1].split('\n## ')[0].split('\n').filter((l) => /^\d+\.\s/.test(l));
  assert.ok(rules.length >= 1 && rules.length <= 12, `${rules.length} rules`);
  assert.ok(rules.some((r) => /Max 3 QA fix passes/.test(r)));
  assert.match(s, /never "filmed"/);
  assert.ok((s.match(/READ \[/g) || []).length >= 6);
  const links = [...s.matchAll(/\]\(([^)#]+)\)/g)].map((m) => m[1]).filter((l) => !/^https?:/.test(l));
  assert.ok(links.length >= 7);
  for (const l of links) assert.ok(fs.existsSync(path.join(ROOT, l)), `broken link ${l}`);
  assert.ok(fs.existsSync(path.join(ROOT, 'references', 'song-reel-mode.md')));
});

test('horror_gate: nukta words in setting/rule/folk lists match normalised script text', async () => {
  const { norm } = await import('../lib/horror_gate.mjs');
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../lib/horror_gate.mjs', import.meta.url), 'utf8'));
  const m = src.match(/const DOMESTIC_RX = deNukta\((\/.*\/[a-z]*)\);/);
  assert.ok(m, 'DOMESTIC_RX must be wrapped in deNukta');
  const deNukta = (rx) => new RegExp(rx.source.replace(/़/g, ''), rx.flags);
  const rx = deNukta(eval(m[1]));
  for (const w of ['खिड़की से भोपाल दिखा', 'दरवाज़ा खुला', 'सीढ़ी पर']) assert.ok(rx.test(norm(w)), `should match: ${w}`);
});
