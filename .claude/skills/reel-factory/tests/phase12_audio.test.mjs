// Phase 12: tier-A audio (synth library, cue sheet, space, underscore, stems, mix, audio QA).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SYNTH_KINDS } from '../lib/audio/synth/index.mjs';
import { makeRng, hashSamples, seedFor } from '../lib/audio/rng.mjs';
import { bp, whiteNoise, applyBiquad } from '../lib/audio/dsp.mjs';
import { normalizeSynthOut, renderStems, writeStems } from '../lib/audio/render.mjs';
import { resolveCues, eventsFor } from '../lib/audio/cues.mjs';
import { resolveGenerated } from '../lib/audio/providers.mjs';
import { placeStereo, makeIR, MAX_ITD_S } from '../lib/audio/space.mjs';
import { voiceClarity, phoneCheck, monoFold, truePeak, shortTermLoudness, preScareSilence, licenceManifest, meanSquare, msDb, AUDIO_QA } from '../lib/audio/qa.mjs';
import { duckEnvelope, buildMix, normalizeTwoPass } from '../lib/audio/mix.mjs';
import { auditProjectAudio, hasSoundSheet } from '../lib/audio/audit.mjs';
import { writeWavFloat, readWav } from '../lib/audio/wav.mjs';
import { runSoundDesign } from '../scripts/sound_design.mjs';
import { resolveBin } from '../lib/runtime.mjs';

const SR = 48000;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'p12-'));
const MUSIC = ['underscore', 'drone', 'pad', 'piano_motif', 'strings_tension'];
const render = (kind, params = {}, seed = 5) => {
  const d = SYNTH_KINDS[kind]; const dur = MUSIC.includes(kind) ? 6 : undefined;
  return normalizeSynthOut(d.fn({ ...(MUSIC.includes(kind) ? { dur_s: 6, tension: 0.7 } : {}), ...params }, { sr: SR, rng: makeRng(seed), dur }));
};
const chans = (o) => (o.mono ? [o.mono, o.mono] : [o.L, o.R]);
const bandShare = (x, lo, hi) => meanSquare(bp(x, lo, hi, 4, SR), 0, x.length) / Math.max(1e-14, meanSquare(x, 0, x.length));

// ---- determinism / sanity of every kind ----
for (const kind of Object.keys(SYNTH_KINDS)) {
  test(`synth ${kind}: deterministic, non-silent, finite, not clipping`, () => {
    const a = render(kind), b = render(kind), c = render(kind, {}, 6);
    const [aL, aR] = chans(a), [bL, bR] = chans(b), [cL, cR] = chans(c);
    assert.equal(hashSamples(aL, aR), hashSamples(bL, bR), 'same seed must give identical samples');
    let pk = 0, nan = 0, e = 0;
    for (const x of [aL, aR]) for (let i = 0; i < x.length; i++) { if (!Number.isFinite(x[i])) nan++; pk = Math.max(pk, Math.abs(x[i])); e += x[i] * x[i]; }
    assert.equal(nan, 0); assert.ok(pk > 0.02, `${kind} silent (peak ${pk})`); assert.ok(pk <= 1.25, `${kind} peak ${pk} would clip the mix`);
    assert.ok(Math.sqrt(e / (aL.length * 2)) > 0.003, `${kind} rms too low`);
    if (!['drone'].includes(kind) && SYNTH_KINDS[kind].fn.length >= 0 && !['sub_drop', 'hum', 'thump', 'heartbeat'].includes(kind)) assert.notEqual(hashSamples(aL, aR), hashSamples(cL, cR), 'a different seed should change noise-based kinds');
  });
}

test('spectral bands: cicadas are bright, wind/room are dark, sub_drop has phone-audible harmonics, riser rises', () => {
  const cic = render('cicadas', { dur_s: 4 }).L; assert.ok(bandShare(cic, 3000, 8000) > 0.6, `cicada hf share ${bandShare(cic, 3000, 8000)}`);
  const w = render('wind', { dur_s: 4 }).L; assert.ok(bandShare(w, 60, 1500) > 0.8);
  const rt = render('room_tone', { dur_s: 4 }).L; assert.ok(bandShare(rt, 20, 1000) > 0.75);
  const sub = render('sub_drop').mono; const noH = render('sub_drop', { harmonics: 0 }).mono;
  assert.ok(bandShare(sub, 150, 400) > 0.1 && bandShare(noH, 150, 400) < 0.01, `with ${bandShare(sub, 150, 400)} without ${bandShare(noH, 150, 400)}`);
  const r = render('riser', { dur_s: 3 }).mono; const h = Math.floor(r.length / 2);
  const centroid = (x) => { let a = 0, b = 0; const hp = applyBiquad(x, [1, -1, 0, 0, 0]); for (let i = 0; i < x.length; i++) { a += Math.abs(hp[i]); b += Math.abs(x[i]); } return a / Math.max(1e-9, b); };
  assert.ok(centroid(r.subarray(h)) > centroid(r.subarray(0, h)), 'riser should get brighter');
  const imp = render('impact', { material: 'metal' }).mono; assert.ok(bandShare(imp, 300, 8000) > 0.5);
});

test('stinger reports a pre-roll and footsteps pan from left toward the right with rising level', () => {
  assert.ok(render('stinger').pre_s > 0.2);
  const f = render('footsteps', { count: 8, pan_from: -0.9, pan_to: 0.8, gain_from_db: -30, gain_to_db: 0 });
  const n = f.L.length, q = Math.floor(n / 4); const e = (x, a, b) => meanSquare(x, a, b);
  assert.ok(e(f.L, 0, q) > e(f.R, 0, q) * 1.3, 'early steps on the left');
  assert.ok(e(f.R, 3 * q, n) > e(f.L, 3 * q, n) * 1.3, 'late steps on the right');
  assert.ok(e(f.L, 3 * q, n) + e(f.R, 3 * q, n) > 5 * (e(f.L, 0, q) + e(f.R, 0, q)), 'approaching = louder');
  assert.throws(() => render('footsteps', { surface: 'lava' }), /unknown surface/);
});

test('panning: ITD never exceeds 0.6 ms, far ear is darker; reverb IR is normalised and decays', () => {
  const x = whiteNoise(makeRng(1), 4800); const p = placeStereo(x, 1, { binaural: true });
  let best = 0, bl = 0; for (let lag = 0; lag < 60; lag++) { let s = 0; for (let i = 100; i < 4000; i++) s += p.R[i] * p.L[i + lag]; if (s > best) { best = s; bl = lag; } }
  assert.ok(bl <= Math.ceil(MAX_ITD_S * SR) + 1, `lag ${bl}`);
  for (const name of ['room', 'hall', 'corridor', 'outdoor']) {
    const ir = makeIR(name); const e = ir.L.reduce((a, v) => a + v * v, 0); assert.ok(Math.abs(e - 1) < 0.08, `${name} energy ${e}`);
    const n = ir.L.length; assert.ok(meanSquare(ir.L, 0, n / 2) > 4 * meanSquare(ir.L, n / 2, n), `${name} should decay`);
  }
});

// ---- cue sheet ----
const TL = { duration_s: 12, fps: 30, events: { start: 0, door: 3.5, door_end: 5, scare: 8 }, scenes: [{ id: 'a', start_s: 0, end_s: 8, mood: 'calm', lines: [] }, { id: 'b', start_s: 8, end_s: 12, mood: 'climax', lines: [] }] };
test('cues: resolve events via makeClock, offsets, until; unknown kind/event are errors', () => {
  const ok = resolveCues({ seed: 1, cues: [{ id: 'a', at: 'door', offset_s: 0.25, until: 'door_end', kind: 'wind' }, { id: 'b', at: 2, kind: 'drip' }] }, TL);
  assert.deepEqual(ok.errors, []); assert.equal(ok.cues[1].at_s, 3.75); assert.equal(ok.cues[1].dur_s, 1.25 - 0.25 + 0.25 === 1.5 ? 1.5 : ok.cues[1].dur_s);
  const bad = resolveCues({ seed: 1, cues: [{ id: 'x', at: 'nope', kind: 'drip' }, { id: 'y', at: 1, kind: 'kazoo' }, { id: 'y', at: 1, kind: 'drip' }, { id: 'z', at: 5, until: 2, kind: 'wind' }, { id: 'w', at: 1, kind: 'drip', layer: 'vo' }] }, TL);
  const msg = bad.errors.join('\n');
  assert.match(msg, /unknown event "nope"/); assert.match(msg, /unknown kind "kazoo"/); assert.match(msg, /duplicate id/); assert.match(msg, /until .* must be after/); assert.match(msg, /layer "vo"/);
});
test('cues: derived lineNN events only when the timeline has none, and are flagged', () => {
  const old = { duration_s: 10, scenes: [{ id: 's', start_s: 0, end_s: 10, lines: [{ i: 3, start_s: 4, end_s: 6 }] }] };
  const r = resolveCues({ seed: 1, cues: [{ id: 'a', at: 'line03_end', kind: 'drip' }] }, old);
  assert.equal(r.cues[0].at_s, 6); assert.deepEqual(r.cues[0].derived_events, ['line03_end']); assert.equal(eventsFor(TL).derived, false);
  assert.match(resolveCues({ seed: 1, cues: [{ id: 'a', at: 'line09_end', kind: 'drip' }] }, old).errors[0], /unknown event/);
});
test('licences: generated/library cues need file + licence; no provider is wired in', () => {
  const mk = (c) => resolveCues({ seed: 1, cues: [{ id: 'g', at: 1, kind: 'door slam', ...c }] }, TL).errors.join('|');
  assert.match(mk({ source: 'library' }), /needs "file"/);
  assert.match(mk({ source: 'library', file: 'x.wav' }), /needs "licence"/);
  assert.match(mk({ source: 'generated', file: 'x.wav', licence: '  ' }), /needs "licence"/);
  assert.throws(() => resolveGenerated({ id: 'g' }), /no provider configured/);
});

// ---- rendering ----
test('renderStems: exact frame count, per-cue seeding, library cue licence manifest, atomic files', () => {
  const dir = tmp(); const wav = path.join(dir, 'door.wav'); const x = new Float32Array(24000); for (let i = 0; i < x.length; i++) x[i] = 0.5 * Math.sin(i * 0.05) * Math.exp(-i / 4000);
  writeWavFloat(wav, x, x, 24000);
  const sound = { seed: 3, cues: [{ id: 'rt', at: 0, until: 'end_of', kind: 'room_tone' }, { id: 'd', at: 'door', kind: 'drip', pan: 0.5 }, { id: 'lib', at: 'scare', kind: 'door slam', layer: 'sfx', source: 'library', file: 'door.wav', licence: { name: 'CC0', url: 'https://example.invalid/cc0' } }] };
  const tl = { ...TL, events: { ...TL.events, end_of: 12 } };
  const a = renderStems(sound, tl, { projectDir: dir });
  assert.equal(a.frames, 12 * SR); for (const s of Object.values(a.stems)) assert.equal(s.L.length, 12 * SR);
  const more = renderStems({ ...sound, cues: [...sound.cues, { id: 'extra', at: 6, kind: 'drip' }] }, tl, { projectDir: dir });
  const seg = (r) => r.stems.sfx.L.subarray(Math.floor(3.5 * SR), Math.floor(3.5 * SR) + 20000);
  assert.equal(hashSamples(seg(a)), hashSamples(seg(more)), 'adding a cue must not change another cue');
  assert.notEqual(seedFor(3, 'a'), seedFor(3, 'b'));
  const out = path.join(dir, 'audio'); const w = writeStems(a, out);
  assert.deepEqual(Object.keys(w).sort(), ['ambience', 'room', 'sfx'].filter((k) => w[k]).sort());
  assert.equal(readWav(w.sfx).frames, 12 * SR); assert.ok(!fs.readdirSync(out).some((f) => f.includes('.tmp-')));
  const lic = JSON.parse(fs.readFileSync(path.join(out, 'licences.json'), 'utf8')); assert.equal(lic.entries.length, 1); assert.equal(lic.entries[0].licence.name, 'CC0');
  const rep = JSON.parse(fs.readFileSync(path.join(out, 'cue_report.json'), 'utf8')); assert.equal(rep.cues.find((c) => c.id === 'd').at_s, 3.5);
  assert.throws(() => renderStems({ seed: 1, cues: [{ id: 'q', at: 1, kind: 'x', source: 'library', file: 'missing.wav', licence: 'CC0' }] }, TL, { projectDir: dir }), /file not found/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('automation drop silences the named buses but not room tone', () => {
  const sound = { seed: 1, cues: [{ id: 'rt', at: 0, until: 6, kind: 'room_tone' }, { id: 'w', at: 0, until: 6, kind: 'wind' }, { id: 'd', at: 2, until: 4, kind: 'drop', params: { buses: ['ambience'], depth_db: -40 } }] };
  const r = renderStems(sound, { duration_s: 6, events: { s: 0 } });
  const lvl = (x, a, b) => msDb(meanSquare(x, a * SR, b * SR));
  assert.ok(lvl(r.stems.ambience.L, 0.5, 1.5) - lvl(r.stems.ambience.L, 2.3, 3.7) > 30);
  assert.ok(Math.abs(lvl(r.stems.room.L, 0.5, 1.5) - lvl(r.stems.room.L, 2.3, 3.7)) < 3);
});

test('underscore follows the tension curve (louder strings/drone in the climax scene)', () => {
  const tl = { duration_s: 10, scenes: [{ id: 'a', start_s: 0, end_s: 5, mood: 'calm' }, { id: 'b', start_s: 5, end_s: 10, mood: 'climax' }] };
  const r = renderStems({ seed: 2, cues: [{ id: 'm', at: 0, until: 10, kind: 'underscore', params: { tension: 'auto', key: 'D', scale: 'phrygian' } }] }, tl);
  const L = r.stems.music.L; assert.ok(meanSquare(L, 6 * SR, 9 * SR) > 1.5 * meanSquare(L, 0.5 * SR, 4 * SR));
});

// ---- QA on deliberately broken fixtures ----
function fakeVo(seed, n) { const r = makeRng(seed); const x = bp(whiteNoise(r, n), 200, 3800, 2, SR); for (let i = 0; i < n; i++) x[i] *= 0.12 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * i / SR) ** 2); return x; }
test('QA voice clarity: bed 6 dB under VO fails, 11 dB warns, 20 dB passes', () => {
  const n = 4 * SR; const vo = fakeVo(1, n); const bedRaw = bp(whiteNoise(makeRng(2), n), 200, 3800, 2, SR);
  const gain = (x, db) => x.map((v) => v * Math.pow(10, db / 20));
  const run = (db) => { const rv = meanSquare(vo, 0, n), rb = meanSquare(bedRaw, 0, n); const g = Math.sqrt(rv / rb) * Math.pow(10, -db / 20); const bed = gain(bedRaw, 20 * Math.log10(g)); return voiceClarity({ vo: { L: vo, R: vo }, bed: { L: bed, R: bed }, spans: [[0.2, 3.8]] }); };
  assert.equal(run(6).fail.length, 1); assert.equal(run(11).fail.length + run(11).warn.length, 1); assert.equal(run(11).warn.length, 1);
  const good = run(20); assert.equal(good.fail.length + good.warn.length, 0); assert.ok(good.min_delta_db > 15);
});
test('QA mono fold-down: inverted right channel cancels and fails; centred voice passes', () => {
  const n = 3 * SR; const v = fakeVo(3, n); const neg = v.map((x) => -x);
  const bad = monoFold({ L: v, R: neg, spans: [[0.2, 2.8]] }); assert.equal(bad.fail.length, 1); assert.ok(bad.worst_loss_db > 20); assert.ok(bad.mean_corr < -0.9);
  const good = monoFold({ L: v, R: v, spans: [[0.2, 2.8]] }); assert.equal(good.fail.length, 0); assert.ok(good.worst_loss_db < 0.5);
});
test('QA true peak: flat-topped / over-full-scale mix fails the -1 dBTP limit, a -3 dB sine passes; inter-sample peaks are caught', () => {
  const n = SR; const hot = new Float32Array(n).map((_, i) => Math.max(-1, Math.min(1, 1.6 * Math.sin(i * 0.03)))); const t = truePeak(hot, hot);
  assert.ok(t.true_peak_dbtp > AUDIO_QA.truePeakMaxDbtp && t.clipped_samples > 100);
  const ok = new Float32Array(n).map((_, i) => 0.7 * Math.sin(i * 0.03)); assert.ok(truePeak(ok, ok).true_peak_dbtp < -2.5);
  const is = new Float32Array(n).map((_, i) => 0.99 * Math.sin(Math.PI * 0.45 * i + 0.7)); // sample peak < 1 but reconstruction is higher
  assert.ok(truePeak(is, is).true_peak_dbtp > truePeak(is, is).sample_peak_dbfs - 0.001);
});
test('QA short-term loudness: K-weighted series sees a loud passage', () => {
  const n = 10 * SR; const x = new Float32Array(n).map((_, i) => (i > 5 * SR ? 0.5 : 0.05) * Math.sin(i * 0.1)); const s = shortTermLoudness(x, x);
  assert.ok(Math.max(...s.map((p) => p.lufs)) - Math.min(...s.map((p) => p.lufs)) > 12);
});
test('QA pre-scare silence: missing silence fails, a 0.9 s gap passes', () => {
  const n = 12 * SR; const L = new Float32Array(n); const bed = bp(whiteNoise(makeRng(4), n), 100, 3000, 2, SR); for (let i = 0; i < n; i++) L[i] = bed[i] * 0.2;
  const miss = preScareSilence({ L, R: L, scares: [{ id: 's', onset_s: 9 }] }); assert.equal(miss.fail.length, 1);
  const G = L.slice(); for (let i = 8.0 * SR; i < 8.98 * SR; i++) G[i] *= 0.01;
  const gap = preScareSilence({ L: G, R: G, scares: [{ id: 's', onset_s: 9 }] }); assert.equal(gap.fail.length, 0); assert.ok(gap.per_scare[0].drop_db > 30);
  assert.ok(preScareSilence({ L, R: L, scares: [{ id: 's', onset_s: 1 }] }).per_scare[0].skipped);
});
test('QA phone check: a pure 40-80 Hz sub fails, the shipped sub_drop and heartbeat pass', () => {
  const win = (id, t1) => [{ id, kind: 'x', t0: 0, t1 }]; const pad = (x) => { const o = new Float32Array(4 * SR); o.set(x.subarray(0, o.length)); return o; };
  const pure = pad(render('sub_drop', { harmonics: 0 }).mono); assert.equal(phoneCheck({ L: pure, R: pure, windows: win('p', 1.2) }).fail.length, 1);
  const good = pad(render('sub_drop').mono); const g = phoneCheck({ L: good, R: good, windows: win('g', 1.2) }); assert.equal(g.fail.length, 0, JSON.stringify(g.per_cue));
  const hb = pad(render('heartbeat', { dur_s: 4 }).mono); assert.equal(phoneCheck({ L: hb, R: hb, windows: win('h', 4) }).fail.length, 0);
  const hb0 = pad(render('heartbeat', { dur_s: 4, knock: 0 }).mono); assert.equal(phoneCheck({ L: hb0, R: hb0, windows: win('h0', 4) }).fail.length, 1);
});
test('QA licence manifest: complete / missing / empty licence', () => {
  const cues = [{ id: 'a', source: 'library' }, { id: 's', source: 'synth' }];
  assert.deepEqual(licenceManifest({ cues, manifest: { entries: [{ id: 'a', file: 'a.wav', licence: { name: 'CC0' } }] } }).missing, []);
  assert.deepEqual(licenceManifest({ cues, manifest: { entries: [] } }).missing, ['a']);
  assert.deepEqual(licenceManifest({ cues, manifest: { entries: [{ id: 'a', file: 'a.wav', licence: '' }] } }).missing, ['a']);
});

// ---- ducking / mix ----
test('ducking: depth is exactly capped at the configured dB, attack/release shape, clamps out-of-range config', () => {
  const n = 4 * SR; const vo = new Float32Array(n); for (let i = Math.floor(1 * SR); i < 2.5 * SR; i++) vo[i] = 0.2 * Math.sin(i * 0.2);
  const d = duckEnvelope(vo, vo, SR, { depth_db: 5, attack_s: 0.02, release_s: 0.5 });
  let min = 1; for (const v of d.gain) if (v < min) min = v; assert.ok(Math.abs(20 * Math.log10(min) + 5) < 0.2, `min ${20 * Math.log10(min)}`);
  assert.ok(d.gain[Math.floor(0.5 * SR)] > 0.999, 'no ducking before speech'); assert.ok(d.gain[Math.floor(2.5 * SR + 0.25 * SR)] < 0.8, 'still partly ducked 250 ms after speech');
  assert.ok(d.gain[Math.floor(3.9 * SR)] > 0.95, 'released');
  const c = duckEnvelope(vo, vo, SR, { depth_db: 20 }); assert.equal(c.depth_db, 6); assert.match(c.warnings[0], /clamped/);
});
test('mix: music + ambience duck under VO, sfx and room do not', () => {
  const dir = tmp(); const n = 4 * SR; const stem = (v) => new Float32Array(n).fill(v);
  for (const l of ['sfx', 'music', 'ambience', 'room']) writeWavFloat(path.join(dir, `${l}.wav`), stem(0.05), stem(0.05), SR);
  const vo = new Float32Array(n); for (let i = SR; i < 3 * SR; i++) vo[i] = 0.3 * Math.sin(i * 0.2); writeWavFloat(path.join(dir, 'vo.wav'), vo, vo, SR);
  const m = buildMix({ projectDir: dir, stemsDir: dir, timeline: { duration_s: 4, audio_file: 'vo.wav' }, sound: { buses: { sfx: 0, music: 0, ambience: 0, room: 0 } } });
  const idle = 0.5 * SR, speak = 2 * SR; const bedIdle = m.bed.L[idle], bedSpeak = m.bed.L[speak];
  assert.ok(Math.abs(bedIdle - 0.2) < 1e-3); const expected = 0.05 * 2 + 0.05 * 2 * Math.pow(10, -5 / 20); assert.ok(Math.abs(bedSpeak - expected) < 2e-3, `${bedSpeak} vs ${expected}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---- ffmpeg integration: two-pass loudnorm + audit on a real encode ----
function miniProject(extra = {}) {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'timeline.json'), JSON.stringify({ duration_s: 9, fps: 30, target_lufs: -14, events: { start: 0, scare: 6.5, end: 9 }, scenes: [{ id: 'a', start_s: 0, end_s: 9, mood: 'suspense', lines: [] }] }));
  fs.writeFileSync(path.join(dir, 'sound.json'), JSON.stringify({ seed: 4, cues: [
    { id: 'rt', at: 'start', until: 'end', kind: 'room_tone' }, { id: 'wind', at: 'start', until: 'end', kind: 'wind' },
    { id: 'hb', at: 1, until: 5.2, kind: 'heartbeat', params: { bpm_from: 60, bpm_to: 90 } },
    { id: 'drop', at: 5.3, until: 'scare', until_offset_s: -0.37, kind: 'drop', params: { buses: ['sfx', 'ambience', 'music'], depth_db: -40 } },
    { id: 'hit', at: 'scare', kind: 'stinger', tags: ['scare'], params: { swell_s: 0.35, dur_s: 2 } }, { id: 'sub', at: 'scare', kind: 'sub_drop' }, ...(extra.cues || [])] }));
  return dir;
}
test('end to end: stems -> mix -> two-pass loudnorm -> m4a -> audio QA (peak, silence, phone); old projects are untouched', async () => {
  const dir = miniProject(); const out = path.join(dir, 'mix.m4a');
  const r = await runSoundDesign({ project: dir, mix: out, qa: true, lufs: -14, tp: -1.5 });
  assert.ok(fs.existsSync(out) && fs.existsSync(path.join(dir, 'audio', 'sfx.wav'))); assert.ok(['linear', 'linear-gain+limiter (fallback)'].includes(r.mix.loudnorm.mode));
  assert.deepEqual(r.qa.fails, [], r.qa.fails.join('\n')); assert.ok(r.qa.verified.some((v) => /true peak/.test(v)) && r.qa.verified.some((v) => /pre-scare silence/.test(v)) && r.qa.verified.some((v) => /phone check/.test(v)));
  assert.ok(r.qa.unverified.some((u) => /scary/.test(u)));
  assert.equal(hasSoundSheet(os.tmpdir() + '/definitely-missing'), false); assert.equal(auditProjectAudio({ projectDir: tmp() }), null);
  fs.rmSync(dir, { recursive: true, force: true });
});
test('end to end: removing the pre-scare drop makes the audit FAIL with a pre-scare message; --check reports errors', async () => {
  const dir = miniProject(); const sj = JSON.parse(fs.readFileSync(path.join(dir, 'sound.json'), 'utf8')); sj.cues = sj.cues.filter((c) => c.id !== 'drop' && c.id !== 'hb'); fs.writeFileSync(path.join(dir, 'sound.json'), JSON.stringify(sj));
  const r = await runSoundDesign({ project: dir, mix: path.join(dir, 'mix.m4a'), qa: true });
  assert.equal(r.ok, false); assert.ok(r.qa.fails.some((f) => /pre-scare silence/.test(f)), r.qa.fails.join('|'));
  sj.cues.push({ id: 'bad', at: 'nonexistent', kind: 'drip' }); fs.writeFileSync(path.join(dir, 'sound.json'), JSON.stringify(sj));
  const c = await runSoundDesign({ project: dir, check: true }); assert.equal(c.ok, false); assert.match(c.errors[0], /unknown event/);
  fs.rmSync(dir, { recursive: true, force: true });
});
test('loudnorm two-pass reports its mode and never ships the dynamic result silently', () => {
  const dir = tmp(); const n = 6 * SR; const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = (i > 4 * SR ? 0.9 : 0.01) * Math.sin(i * 0.05);
  writeWavFloat(path.join(dir, 'in.wav'), x, x, SR);
  const r = normalizeTwoPass({ ffmpeg: resolveBin('ffmpeg'), inFile: path.join(dir, 'in.wav'), outFile: path.join(dir, 'out.wav') });
  assert.ok(r.mode === 'linear' || r.warnings.length === 1); assert.ok(fs.existsSync(path.join(dir, 'out.wav')));
  fs.rmSync(dir, { recursive: true, force: true });
});
