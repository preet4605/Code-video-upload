import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { synth, cacheKey, KalpaError } from '../lib/kalpa.mjs';
import { makeClock } from '../lib/events.mjs';
import { buildVo, computeEvents } from '../scripts/build_vo.mjs';
import { resolveVoice, pickVoice, KALPA_VOICES } from '../lib/voices.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rf-vo-'));
function wav(file, secs, kind = 'sine') {
  const src = kind === 'sine' ? `sine=frequency=300:sample_rate=48000:duration=${secs}` : `anullsrc=r=48000:cl=mono`;
  const args = ['-v', 'error', '-y', '-f', 'lavfi', '-i', src, ...(kind === 'sine' ? [] : ['-t', String(secs)]), '-c:a', 'pcm_s16le', file];
  assert.equal(spawnSync('ffmpeg', args).status, 0);
  return file;
}
const okRes = (b64) => new Response(JSON.stringify({ request_id: 'r1', audio: { format: 'wav', sample_rate: 48000, data_b64: b64 }, usage: { output_audio_seconds: 1 } }), { status: 200 });
const errRes = (status, type, headers = {}) => new Response(JSON.stringify({ error: { type, message: 'm', request_id: 'rq' } }), { status, headers });
const b64Of = (secs, kind) => fs.readFileSync(wav(path.join(tmp(), 'x.wav'), secs, kind)).toString('base64');
function emptyWavB64() {
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(48000, 24); h.writeUInt32LE(96000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(0, 40);
  return h.toString('base64');
}
const noSleep = () => { const calls = []; const f = async (ms) => { calls.push(ms); }; f.calls = calls; return f; };
const base = (dir) => ({ text: 'नमस्ते', voice: 'v1', apiKey: 'k', out: path.join(dir, 'a.wav') });

test('kalpa: request shape carries model, sample_rate, params.temperature and bearer key', async () => {
  const dir = tmp(); let seen;
  const fetchImpl = async (url, init) => { seen = { url, init }; return okRes(b64Of(0.5)); };
  await synth({ ...base(dir), temperature: 0.7, fetchImpl });
  assert.equal(seen.url, 'https://api.kalpalabs.ai/v1/tts/v1');
  const b = JSON.parse(seen.init.body);
  assert.deepEqual([b.model, b.sample_rate, b.params.temperature], ['kalpa-tts-1', 48000, 0.7]);
  assert.equal(seen.init.headers.Authorization, 'Bearer k');
});

test('kalpa: 402 is never retried and is typed allowance_exhausted', async () => {
  const dir = tmp(); let n = 0;
  await assert.rejects(synth({ ...base(dir), sleep: noSleep(), fetchImpl: async () => { n++; return errRes(402, 'allowance_exhausted'); } }), (e) => e instanceof KalpaError && e.type === 'allowance_exhausted' && e.status === 402);
  assert.equal(n, 1);
});

test('kalpa: 429 honours Retry-After, 503 is retried, 4 attempts max', async () => {
  const dir = tmp(); const sleep = noSleep(); let n = 0;
  const r = await synth({ ...base(dir), sleep, fetchImpl: async () => { n++; return n === 1 ? errRes(429, 'rate_limited', { 'Retry-After': '7' }) : n === 2 ? errRes(503, 'server') : okRes(b64Of(0.5)); } });
  assert.equal(n, 3); assert.equal(sleep.calls[0], 7000); assert.ok(r.duration_s > 0.4);
  let m = 0;
  await assert.rejects(synth({ ...base(tmp()), sleep: noSleep(), fetchImpl: async () => { m++; return errRes(503, 'server'); } }), /503/);
  assert.equal(m, 4);
});

test('kalpa: 401/422/400 are not retried; a timeout is not retried (double-bill risk)', async () => {
  for (const [s, t] of [[401, 'auth'], [422, 'invalid'], [400, 'context_length_exceeded']]) {
    let n = 0;
    await assert.rejects(synth({ ...base(tmp()), sleep: noSleep(), fetchImpl: async () => { n++; return errRes(s, t); } }), (e) => e.status === s && e.type === t);
    assert.equal(n, 1);
  }
  let n = 0;
  await assert.rejects(synth({ ...base(tmp()), sleep: noSleep(), fetchImpl: async () => { n++; throw Object.assign(new Error('t'), { name: 'TimeoutError' }); } }), (e) => e.type === 'timeout');
  assert.equal(n, 1);
  n = 0; // pre-response network failure is retried
  await synth({ ...base(tmp()), sleep: noSleep(), fetchImpl: async () => { n++; if (n === 1) throw new TypeError('fetch failed'); return okRes(b64Of(0.5)); } });
  assert.equal(n, 2);
});

test('kalpa: cache hit skips the call; changed model/text/temperature/sampleRate misses; key never in errors', async () => {
  const dir = tmp(); let n = 0;
  const fetchImpl = async () => { n++; return okRes(b64Of(0.5)); };
  const a = await synth({ ...base(dir), fetchImpl });
  const b = await synth({ ...base(dir), fetchImpl });
  assert.equal(a.cached, false); assert.equal(b.cached, true); assert.equal(n, 1);
  await synth({ ...base(dir), model: 'kalpa-tts-2', fetchImpl }); assert.equal(n, 2);
  await synth({ ...base(dir), sampleRate: 24000, fetchImpl }); assert.equal(n, 3);
  const k = { voice: 'v', model: 'm', temperature: 0.5, sampleRate: 48000, text: 't' };
  for (const ch of [{ voice: 'w' }, { model: 'n' }, { temperature: 0.6 }, { sampleRate: 24000 }, { text: 'u' }]) assert.notEqual(cacheKey(k), cacheKey({ ...k, ...ch }));
  await assert.rejects(synth({ ...base(tmp()), apiKey: 'SECRET-KEY-123', fetchImpl: async () => errRes(401, 'auth') }), (e) => !e.message.includes('SECRET-KEY-123'));
});

test('kalpa: atomic write leaves no partial file on invalid/zero-length audio', async () => {
  for (const b64 of [Buffer.from('not a wav at all').toString('base64'), emptyWavB64()]) {
    const dir = tmp();
    await assert.rejects(synth({ ...base(dir), fetchImpl: async () => okRes(b64) }), (e) => e instanceof KalpaError);
    assert.deepEqual(fs.readdirSync(dir), []);
  }
  const dir = tmp();
  await assert.rejects(synth({ ...base(dir), fetchImpl: async () => new Response(JSON.stringify({ audio: {} }), { status: 200 }) }), /no audio/);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('voices: verified catalog, Aman is horror hi, names resolve', () => {
  assert.equal(Object.keys(KALPA_VOICES).length, 11);
  assert.equal(resolveVoice('aman'), '1eb6c010-34e0-477c-9d24-e915f853359e');
  assert.equal(resolveVoice('custom-id'), 'custom-id');
  const p = pickVoice({ genre: 'horror', lang: 'hi', overridesFile: '/nonexistent.json' });
  assert.equal(p.voice, resolveVoice('Aman')); assert.equal(p.source, 'user-chosen-default');
  assert.equal(pickVoice({ genre: 'horror', lang: 'en', overridesFile: '/nonexistent.json' }).voice, resolveVoice('Wren'));
});

test('events: computed from real clip durations, with named lines and spans', () => {
  const layout = [{ i: 0, start_s: 0.15, end_s: 2.15 }, { i: 1, start_s: 2.6, end_s: 4.1 }];
  const ev = computeEvents(layout, [{}, { event: 'reveal' }]);
  assert.deepEqual(ev, { line00_start: 0.15, line00_end: 2.15, line01_start: 2.6, line01_end: 4.1, reveal: 2.6, reveal_end: 4.1 });
  assert.throws(() => computeEvents(layout, [{ event: 'x' }, { event: 'x' }]), /duplicate/);
});

test('clock: at/dur/between and clear errors', () => {
  const c = makeClock({ events: { line00_start: 1, line00_end: 3, boom: 5, boom_end: 6 } });
  assert.equal(c.at('line00_start'), 1);
  assert.equal(c.dur('line00'), 2);
  assert.equal(c.dur('boom'), 1);
  assert.equal(c.between('line00', 2), 0.5);
  assert.equal(c.between('line00', 0), 0); assert.equal(c.between('line00', 9), 1);
  assert.throws(() => c.at('line9_start'), /unknown event "line9_start"/);
  assert.throws(() => c.dur('nope'), /unknown event/);
  assert.throws(() => makeClock({}), /no events/);
});

function project(lines, extra = {}) {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'lines.json'), JSON.stringify({ voice: 'Aman', temperature: 0.8, lead_s: 0.2, gap: 0.5, tail_s: 1, ...extra, lines }));
  return dir;
}

test('build_vo: mocked end to end - events match real durations, second run uses cache, outputs atomic', async () => {
  const dir = project([{ sc: 'a', hi: 'एक', hl: 'ek', event: 'hit' }, { sc: 'b', hi: 'दो', hl: 'do', gap: 0.4 }]);
  const durs = [1.2, 0.8]; let n = 0;
  const fetchImpl = async () => okRes(b64Of(durs[n++]));
  const r = await buildVo(dir, { fetchImpl, concurrency: 1, log: () => {} });
  assert.equal(r.calls_made, 2);
  const tl = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8'));
  const d0 = tl.events.line00_end - tl.events.line00_start, d1 = tl.events.line01_end - tl.events.line01_start;
  assert.ok(Math.abs(d0 - 1.2) < 0.05 && Math.abs(d1 - 0.8) < 0.05, `${d0} ${d1}`);
  assert.equal(tl.events.line00_start, 0.2);
  assert.ok(Math.abs(tl.events.line01_start - (tl.events.line00_end + 0.5)) < 0.002);
  assert.equal(tl.events.hit, tl.events.line00_start);
  assert.equal(tl.tts.voice, resolveVoice('Aman'));
  assert.ok(Math.abs(tl.duration_s - (tl.events.line01_end + 1)) < 0.002);
  const voD = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(dir, 'voiceover.wav')], { encoding: 'utf8' }).stdout);
  assert.ok(Math.abs(voD - tl.duration_s) < 0.05);
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f.includes('.tmp')), []);
  const r2 = await buildVo(dir, { fetchImpl: async () => { throw new Error('must not call'); }, log: () => {} });
  assert.equal(r2.calls_made, 0); assert.equal(r2.cache_hits, 2);
  const dry = await buildVo(dir, { dryRun: true });
  assert.equal(dry.calls_needed, 0);
});

test('build_vo: silent audio is a hard error and writes no outputs; 402 aborts', async () => {
  const dir = project([{ sc: 'a', hi: 'एक', hl: 'ek' }]);
  await assert.rejects(buildVo(dir, { fetchImpl: async () => okRes(b64Of(1, 'silence')), log: () => {} }), /silent|zero-length/);
  assert.ok(!fs.existsSync(path.join(dir, 'voiceover.wav')) && !fs.existsSync(path.join(dir, 'timeline.json')));
  const dir2 = project([{ sc: 'a', hi: 'एक', hl: 'ek' }]);
  await assert.rejects(buildVo(dir2, { fetchImpl: async () => errRes(402, 'allowance_exhausted'), sleep: noSleep(), log: () => {} }), /402/);
});
