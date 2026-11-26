import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { alignWordsToVoicedSpans, detectVoicedSpans, aksharaCount, wordWeight } from '../lib/align.mjs';

const mk = (txt) => txt.split(' ').map((word) => ({ word, start_s: 0, end_s: 0 }));

test('aksharaCount: clusters and independent vowels count once, matras attach', () => {
  assert.equal(aksharaCount('परछाईं'), 4); // प र छा ई
  assert.equal(aksharaCount('स्कूल'), 2); // स्कू ल
  assert.equal(aksharaCount('अंधेरा'), 3); // अं धे रा
  assert.equal(aksharaCount('क्षत्रिय'), 3); // क्ष त्रि य
  assert.ok(wordWeight('स्कूल') < wordWeight('परछाईं'));
});

test('no word interval spans a real pause (3 tone bursts, 0.3 s silences, 9 unpunctuated words)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-align-'));
  const wav = path.join(dir, 'b.wav');
  try {
    // 0.6 tone | 0.3 sil | 0.6 tone | 0.3 sil | 0.6 tone  => silences at 0.6-0.9 and 1.5-1.8, total 2.4 s
    const tone = (d) => `sine=f=440:d=${d}:r=16000`;
    const sil = (d) => `anullsrc=r=16000:cl=mono:d=${d}`;
    const r = spawnSync('ffmpeg', ['-hide_banner', '-y', '-f', 'lavfi', '-i', tone(0.6), '-f', 'lavfi', '-i', sil(0.3), '-f', 'lavfi', '-i', tone(0.6), '-f', 'lavfi', '-i', sil(0.3), '-f', 'lavfi', '-i', tone(0.6),
      '-filter_complex', '[0][1][2][3][4]concat=n=5:v=0:a=1[o]', '-map', '[o]', wav], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr?.slice(-300));
    const total = 2.4;
    const spans = detectVoicedSpans('ffmpeg', wav, total);
    assert.ok(spans.length >= 3);
    const out = alignWordsToVoicedSpans(mk('एक दो तीन चार पाँच छह सात आठ नौ'), spans);
    assert.equal(out.length, 9);
    for (const [a, b] of [[0.6, 0.9], [1.5, 1.8]]) {
      const mid = (a + b) / 2;
      for (const w of out) assert.ok(!(w.start_s < mid && w.end_s > mid), `${w.word} ${w.start_s}-${w.end_s} spans silence ${a}-${b}`);
      // stronger: no word overlaps the core of the silence at all
      for (const w of out) assert.ok(w.end_s <= a + 0.05 || w.start_s >= b - 0.05, `${w.word} ${w.start_s}-${w.end_s} intrudes into ${a}-${b}`);
    }
    let prev = 0;
    for (const w of out) {
      assert.ok(w.start_s >= prev - 1e-9 && w.end_s > w.start_s, 'monotonic');
      assert.ok(w.start_s >= 0 && w.end_s <= total + 1e-9, 'inside audio');
      prev = w.end_s;
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('short gaps (< 0.15 s) are still not split; punctuation anchoring unchanged', () => {
  // gap 0.06 between padded spans: one island, words free to cross it
  const out = alignWordsToVoicedSpans(mk('a b c d'), [[0, 1], [1.06, 2]]);
  assert.equal(out.length, 4);
  // punctuated: the break lands on the pause
  const p = alignWordsToVoicedSpans(mk('one two. three four'), [[0, 1], [1.6, 2.6]]);
  assert.ok(p[1].end_s <= 1.0001 && p[2].start_s >= 1.6 - 1e-9);
});

test('fewer words than pauses does not crash and stays in order', () => {
  const out = alignWordsToVoicedSpans(mk('a b'), [[0, 0.5], [1, 1.5], [2, 2.5], [3, 3.5]]);
  assert.equal(out.length, 2);
  assert.ok(out[0].end_s <= out[1].start_s + 1e-9);
});
