import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alignWordsToVoicedSpans,
  alignWordsToCues,
  parseVoicedSpans,
  parseVtt,
  retimeTimeline
} from '../lib/align.mjs';

const W = (s) => s.split(' ').map((word) => ({ word, start_s: 0, end_s: 0 }));

test('voiced spans: silences are excluded and tails kept', () => {
  const spans = parseVoicedSpans('silence_start: 1.5\nsilence_end: 2.0 | silence_duration: 0.5', 4, { pad: 0 });
  assert.deepEqual(spans, [[0, 1.5], [2.0, 4]]);
});

test('alignment: a sentence break in the script lands on the real pause, not across it', () => {
  const words = W('Last night the clock stopped. My grandmother said hello again');
  const spans = [[0, 2.6], [3.8, 6.8]];
  const out = alignWordsToVoicedSpans(words, spans);
  const stopped = out.find((w) => w.word === 'stopped.');
  const my = out.find((w) => w.word === 'My');
  assert.ok(stopped.end_s <= 2.65, `stopped. ends at ${stopped.end_s}`);
  assert.ok(my.start_s >= 3.75, `My starts at ${my.start_s}`);
  for (let i = 1; i < out.length; i++) assert.ok(out[i].start_s >= out[i - 1].end_s - 1e-6);
});

test('alignment: a single continuous voice span still spreads words monotonically', () => {
  const out = alignWordsToVoicedSpans(W('one two three four five six'), [[0.1, 3.1]]);
  assert.ok(out[0].start_s >= 0.1 && out[5].end_s <= 3.1 + 1e-6);
  for (let i = 1; i < out.length; i++) assert.ok(out[i].start_s >= out[i - 1].end_s - 1e-6);
});

test('VTT: parsed cues drive per-word and sentence-level alignment', () => {
  const vtt = 'WEBVTT\n\n00:00:00.200 --> 00:00:01.400\nhello there my friend\n\n00:00:02.000 --> 00:00:03.200\nhow are you today\n';
  const cues = parseVtt(vtt);
  assert.equal(cues.length, 2);
  const r = alignWordsToCues(W('hello there my friend how are you today'), cues, 4);
  assert.equal(r.method, 'provider-sentence-vtt');
  assert.ok(r.words[4].start_s >= 2.0 - 1e-6);
  const perWord = parseVtt(['WEBVTT', ...'a b c'.split(' ').map((w, i) => `\n00:00:0${i}.000 --> 00:00:0${i}.500\n${w}`)].join('\n'));
  const r2 = alignWordsToCues(W('a b c'), perWord, 3);
  assert.equal(r2.method, 'provider-vtt');
  assert.equal(r2.words[2].start_s, 2);
});

test('retimeTimeline: scenes stay continuous, SFX follow the words, captions track speech and respect CPS', () => {
  const oldWords = [
    { word: 'Hello', start_s: 0.25, end_s: 1.0 },
    { word: 'world.', start_s: 1.0, end_s: 2.0 },
    { word: 'Again', start_s: 2.5, end_s: 3.5 },
    { word: 'now.', start_s: 3.5, end_s: 4.5 }
  ];
  const newWords = [
    { word: 'Hello', start_s: 0.1, end_s: 0.6 },
    { word: 'world.', start_s: 0.6, end_s: 1.2 },
    { word: 'Again', start_s: 3.0, end_s: 3.6 },
    { word: 'now.', start_s: 3.6, end_s: 4.2 }
  ];
  const tl = {
    duration_s: 5,
    scenes: [
      { id: 'a', start_s: 0, end_s: 2.25, beats: [{ t_s: 0, dur_s: 2.25, animated_properties: ['x'] }] },
      { id: 'b', start_s: 2.25, end_s: 5, beats: [{ t_s: 2.25, dur_s: 2.75, animated_properties: ['x'] }] }
    ],
    captions: [
      { text: 'Hello world.', start_s: 0.25, end_s: 2 },
      { text: 'Again now.', start_s: 2.5, end_s: 4.5 }
    ],
    audio_cues: [{ type: 'sfx', name: 'thud', t_s: 2.5 }]
  };
  const out = retimeTimeline(tl, oldWords, newWords);
  assert.equal(out.scenes[0].start_s, 0);
  assert.equal(out.scenes[0].end_s, out.scenes[1].start_s);
  assert.equal(out.scenes[1].end_s, 5);
  assert.ok(Math.abs(out.audio_cues[0].t_s - 3.0) < 0.05, `sfx at ${out.audio_cues[0].t_s}`);
  assert.ok(out.captions[0].start_s <= 0.1 && out.captions[0].start_s >= 0, 'caption appears at/just before the first word');
  assert.ok(out.captions[1].start_s <= 3.0 && out.captions[1].start_s >= 2.8);
  assert.equal(out.captions[0].text, 'Hello world.');
  assert.ok(out.captions[0].end_s <= out.captions[1].start_s);
  for (const c of out.captions) assert.ok(c.text.replace(/\s/g, '').length / (c.end_s - c.start_s) <= 18);
});

test('rechunkCaptions: dense speech yields word-boundary chunks that respect line/char caps and CPS where physically possible', async () => {
  const { rechunkCaptions } = await import('../lib/align.mjs');
  const text = 'Raat ke teen baje jab lab band hui, tab ek anokhi awaaz aayi. Wo awaaz kisi insaan ki nahi thi, balki dewaar ke andar se aa rahi thi.'.split(' ');
  let t0 = 0.2;
  const words = text.map((word) => { const d = 0.06 * (word.length + 1.2); const w = { word, start_s: t0, end_s: t0 + d, speaker: 'NARRATOR' }; t0 += d; return w; });
  const caps = rechunkCaptions(words, t0 + 0.5);
  assert.ok(caps.length >= 3);
  for (let i = 0; i < caps.length; i++) {
    const lines = caps[i].text.split('\n');
    assert.ok(lines.length <= 2 && lines.every((l) => [...l].length <= 42));
    const cps = caps[i].text.replace(/\s/g, '').length / (caps[i].end_s - caps[i].start_s);
    assert.ok(cps <= 18, `caption ${i} cps ${cps.toFixed(1)}`);
    if (i) assert.ok(caps[i].start_s >= caps[i - 1].end_s - 0.05);
  }
  assert.equal(caps.map((c) => c.text.replace('\n', ' ')).join(' '), text.join(' '));
});
