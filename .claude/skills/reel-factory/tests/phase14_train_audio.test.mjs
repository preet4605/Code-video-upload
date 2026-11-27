// Phase 14: railway synth kinds (train_clack, train_rumble, brake_screech, tube_buzz, station_murmur, paper_crinkle).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SYNTH_KINDS } from '../lib/audio/synth/index.mjs';
import { makeRng, hashSamples } from '../lib/audio/rng.mjs';
import { bp, lp } from '../lib/audio/dsp.mjs';
import { normalizeSynthOut } from '../lib/audio/render.mjs';
import { meanSquare } from '../lib/audio/qa.mjs';

const SR = 48000;
const KINDS = ['train_clack', 'train_rumble', 'brake_screech', 'tube_buzz', 'station_murmur', 'paper_crinkle'];
const render = (kind, params = {}, seed = 5) => normalizeSynthOut(SYNTH_KINDS[kind].fn(params, { sr: SR, rng: makeRng(seed), dur: undefined }));
const chan = (o) => (o.mono ? o.mono : o.L);
const share = (x, lo, hi) => meanSquare(bp(x, lo, hi, 4, SR), 0, x.length) / Math.max(1e-14, meanSquare(x, 0, x.length));

test('all six kinds are registered with a layer and a note', () => {
  for (const k of KINDS) { assert.ok(SYNTH_KINDS[k], k); assert.ok(['sfx', 'ambience'].includes(SYNTH_KINDS[k].layer)); assert.ok(SYNTH_KINDS[k].note); }
});

for (const k of KINDS) {
  test(`${k}: deterministic, finite, audible, not clipping, seed-dependent`, () => {
    const p = k === 'tube_buzz' ? {} : { dur_s: 3 };
    const a = render(k, p), b = render(k, p), c = render(k, p, 9);
    const A = [chan(a), a.R ?? chan(a)], B = [chan(b), b.R ?? chan(b)], C = [chan(c), c.R ?? chan(c)];
    assert.equal(hashSamples(A[0], A[1]), hashSamples(B[0], B[1]));
    assert.notEqual(hashSamples(A[0], A[1]), hashSamples(C[0], C[1]));
    let pk = 0; for (const x of A) for (let i = 0; i < x.length; i++) { assert.ok(Number.isFinite(x[i])); pk = Math.max(pk, Math.abs(x[i])); }
    assert.ok(pk > 0.05 && pk <= 1.25, `${k} peak ${pk}`);
  });
}

test('train_clack: strikes follow the joint rate (4 per joint) and slow down with rate_to', () => {
  const countOnsets = (x) => { const e = bp(x, 1400, 9000, 2, SR); let n = 0, last = -1, th = 0; for (let i = 0; i < e.length; i++) th = Math.max(th, Math.abs(e[i]));
    for (let i = 0; i < e.length; i++) if (Math.abs(e[i]) > th * 0.35 && i - last > 0.04 * SR) { n++; last = i; } return n; };
  const fast = countOnsets(render('train_clack', { dur_s: 8, rate_hz: 2.4 }).L), slow = countOnsets(render('train_clack', { dur_s: 8, rate_hz: 1.0 }).L);
  assert.ok(fast > slow * 1.8, `fast ${fast} slow ${slow}`);
  assert.ok(fast >= 8 * 2.4 * 4 * 0.6, `fast ${fast} too few strikes`);
  const stopping = render('train_clack', { dur_s: 8, rate_hz: 2.4, rate_to: 0.3 }).L, half = stopping.length >> 1;
  assert.ok(countOnsets(stopping.subarray(0, half)) > countOnsets(stopping.subarray(half)) * 1.5, 'clack does not slow toward the stop');
});

test('train_rumble is low-heavy; brake_screech lives in the kHz band; tube_buzz carries 100 Hz; crinkle is bright', () => {
  const rum = render('train_rumble', { dur_s: 4 }).L; assert.ok(share(rum, 20, 700) > 0.8, `rumble low share ${share(rum, 20, 700)}`);
  const scr = render('brake_screech', { dur_s: 3 }).L; assert.ok(share(scr, 1000, 9000) > 0.7, `screech band share ${share(scr, 1000, 9000)}`);
  const tube = chan(render('tube_buzz', { dur_s: 2, flicks: [], base: 1 })); assert.ok(share(tube, 80, 330) > 0.25, `tube hum share ${share(tube, 80, 330)}`);
  const cr = chan(render('paper_crinkle', {})); assert.ok(share(cr, 1500, 12000) > 0.6, `crinkle hf share ${share(cr, 1500, 12000)}`);
  const mur = render('station_murmur', { dur_s: 4 }).L; assert.ok(share(mur, 250, 3000) > 0.7, `murmur voice-band share ${share(mur, 250, 3000)}`);
});

test('tube_buzz flicker gate: level is much lower between flicks than during one', () => {
  const x = chan(render('tube_buzz', { dur_s: 2, flicks: [[0.5, 0.4]], base: 0.05 })), ms = (a, b) => meanSquare(x, Math.round(a * SR), Math.round(b * SR));
  assert.ok(ms(0.55, 0.85) > ms(1.2, 1.8) * 6, `${ms(0.55, 0.85)} vs ${ms(1.2, 1.8)}`);
  assert.ok(lp(x, 20, 2, SR).length === x.length);
});
