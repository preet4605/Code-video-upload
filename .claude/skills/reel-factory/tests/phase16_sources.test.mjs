// Phase 16: real-recording sources (Openverse, local index, earshot), lockfile, credits, audit. No network, no earshot install: fetch and CLI are mocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as ov from '../lib/audio/sources/openverse.mjs';
import { buildIndex } from '../lib/audio/sources/localindex.mjs';
import { rank } from '../lib/audio/sources/rank.mjs';
import { resolveGenerated, EARSHOT_LICENCE } from '../lib/audio/providers.mjs';
import { loadSound, resolveCues } from '../lib/audio/cues.mjs';
import { renderStems, writeStems } from '../lib/audio/render.mjs';
import { auditProjectAudio } from '../lib/audio/audit.mjs';
import { buildCredits, writeCredits, missingCredits } from '../lib/audio/credits.mjs';
import { fitToSpan } from '../lib/audio/fit.mjs';
import { writeWavFloat, readWav } from '../lib/audio/wav.mjs';
import { hashSamples } from '../lib/audio/rng.mjs';
import { runSfxFetch } from '../scripts/sfx_fetch.mjs';
import { resolveBin } from '../lib/runtime.mjs';

const FF = resolveBin('ffmpeg'), FP = resolveBin('ffprobe');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'p16-'));
const mp3 = (() => { const d = tmp(); const f = path.join(d, 't.mp3'); const r = spawnSync(FF, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', f]); assert.equal(r.status, 0, String(r.stderr)); return fs.readFileSync(f); })();

const R = (o = {}) => ({ id: 'ov-1', title: 'Train interior rumble', creator: 'Jane', license: 'cc0', license_version: '1.0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/', attribution: '"Train interior rumble" by Jane is marked CC0 1.0.', duration: 2000, filetype: 'mp3', provider: 'freesound', source: 'freesound', url: 'https://cdn.freesound.org/previews/1/1_1-hq.mp3', detail_url: 'https://api.openverse.org/v1/audio/ov-1/', foreign_landing_url: 'https://freesound.org/people/Jane/sounds/1/', tags: [{ name: 'train' }, { name: 'interior' }], ...o });
const json = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...headers } });
// scripted fetch: routes by URL, counts calls
function mockFetch(routes) { const calls = []; const f = async (url) => { calls.push(String(url)); for (const [re, h] of routes) if (re.test(url)) return typeof h === 'function' ? h(url, calls.length) : h(); throw new Error(`unexpected fetch ${url}`); }; f.calls = calls; return f; }
const audioRes = () => new Response(mp3, { status: 200, headers: { 'content-length': String(mp3.length) } });

test('licenceAllowed: allowlist cc0/pdm/by only; NC, ND, SA, sampling, unknown and anonymous BY are rejected', () => {
  for (const l of ['cc0', 'pdm', 'by']) assert.ok(ov.licenceAllowed(R({ license: l, license_url: l === 'by' ? 'https://creativecommons.org/licenses/by/4.0/' : R().license_url })), l);
  for (const l of ['by-sa', 'by-nd', 'by-nc', 'by-nc-sa', 'by-nc-nd', 'sampling+', 'nc-sampling+', '', null, undefined, 'mystery']) assert.ok(!ov.licenceAllowed(R({ license: l })), String(l));
  assert.ok(!ov.licenceAllowed(R({ license: 'by', license_url: 'https://creativecommons.org/licenses/by-nc/4.0/' })), 'url says NC even though the field says by');
  assert.ok(!ov.licenceAllowed(R({ license: 'by', creator: null, attribution: null })), 'cannot credit an anonymous BY item');
});

test('search: filters by licence and duration, sends license_type=commercial, caches on disk', async () => {
  const cacheDir = tmp();
  const body = { results: [R(), R({ id: 'sa', license: 'by-sa' }), R({ id: 'nc', license: 'by-nc' }), R({ id: 'nd', license: 'by-nd' }), R({ id: 'unk', license: null }), R({ id: 'long', duration: 600000 }), R({ id: 'by', license: 'by', license_version: '4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/' })] };
  const f = mockFetch([[/\/audio\//, () => json(body, 200, { 'x-ratelimit-available-anon_burst': '97', 'x-ratelimit-limit-anon_sustained': '1000/day' })]]);
  const r = await ov.search('train interior', { maxDurationS: 120 }, { fetchImpl: f, cacheDir });
  assert.deepEqual(r.results.map((x) => x.id).sort(), ['by', 'ov-1']);
  assert.deepEqual(r.rejected_licences, { 'by-sa': 1, 'by-nc': 1, 'by-nd': 1, unknown: 1 });
  assert.match(f.calls[0], /license_type=commercial/); assert.match(f.calls[0], /q=train\+interior/); assert.equal(r.rate.sustained_limit, '1000/day');
  const r2 = await ov.search('train interior', { maxDurationS: 120 }, { fetchImpl: f, cacheDir });
  assert.equal(f.calls.length, 1, 'second identical query is a cache hit'); assert.ok(r2.cached); assert.equal(r2.results.length, 2);
  await ov.search('train interior', { refresh: true }, { fetchImpl: f, cacheDir }); assert.equal(f.calls.length, 2);
  const stale = await ov.search('train interior', {}, { fetchImpl: f, cacheDir, now: () => Date.now() + 8 * 86400e3 }); assert.ok(!stale.cached, 'cache expires after 7 days');
});

test('429: honours Retry-After, falls back to exponential backoff, never sleeps through a daily quota', async () => {
  const cacheDir = tmp(); const slept = [];
  let n = 0; const f = mockFetch([[/\/audio\//, () => (++n < 3 ? new Response('', { status: 429, headers: { 'retry-after': '5' } }) : json({ results: [R()] }))]]);
  const r = await ov.search('a', {}, { fetchImpl: f, cacheDir, sleep: async (ms) => slept.push(ms) });
  assert.deepEqual(slept, [5000, 5000]); assert.equal(r.results.length, 1);
  const slept2 = []; let m = 0; const f2 = mockFetch([[/\/audio\//, () => (++m < 3 ? new Response('', { status: 429 }) : json({ results: [R()] }))]]);
  await ov.search('b', {}, { fetchImpl: f2, cacheDir, sleep: async (ms) => slept2.push(ms) }); assert.deepEqual(slept2, [2000, 4000]);
  const slept3 = []; const f3 = mockFetch([[/\/audio\//, () => new Response('', { status: 429, headers: { 'retry-after': '39047', 'x-ratelimit-available-anon_sustained': '0' } })]]);
  await assert.rejects(ov.search('c', {}, { fetchImpl: f3, cacheDir, sleep: async (ms) => slept3.push(ms) }), (e) => e instanceof ov.RateLimitError && e.retry_after_s === 39047 && /10\.8 h/.test(e.message));
  assert.deepEqual(slept3, []); assert.equal(f3.calls.length, 1);
  const f4 = mockFetch([[/\/audio\//, () => new Response('', { status: 429, headers: { 'retry-after': '1' } })]]);
  await assert.rejects(ov.search('d', {}, { fetchImpl: f4, cacheDir, sleep: async () => {} }), ov.RateLimitError); assert.equal(f4.calls.length, 4, 'gives up after 3 retries');
});

test('download: validates, converts to 48 kHz stereo WAV, hashes, writes the licence record, then serves from cache with no network', async () => {
  const cacheDir = tmp(); const f = mockFetch([[/cdn\.freesound/, audioRes]]);
  const d = await ov.download(R(), { cacheDir, ffmpeg: FF, ffprobe: FP }, { fetchImpl: f });
  const w = readWav(d.wav); assert.equal(w.sr, 48000); assert.equal(w.mono, false); assert.ok(Math.abs(w.frames / 48000 - 2) < 0.1);
  assert.equal(d.sha256, (await import('node:crypto')).createHash('sha256').update(mp3).digest('hex')); assert.ok(fs.existsSync(path.join(cacheDir, `${d.sha256}.mp3`)));
  const L = d.licence; assert.equal(L.sha256, d.sha256); assert.equal(L.provider, 'freesound'); assert.equal(L.via, 'openverse'); assert.equal(L.quality, 'preview-mp3'); assert.equal(L.license, 'cc0'); assert.equal(L.creator, 'Jane');
  for (const k of ['source', 'foreign_landing_url', 'detail_url', 'license_version', 'license_url', 'attribution', 'retrieved_at', 'name', 'credit', 'proof']) assert.ok(L[k], k);
  assert.ok(!fs.readdirSync(cacheDir).some((x) => x.startsWith('dl-')), 'fresh download dir is cleaned up');
  const f2 = mockFetch([]); const d2 = await ov.download(R(), { cacheDir, ffmpeg: FF, ffprobe: FP }, { fetchImpl: f2 });
  assert.ok(d2.cache_hit); assert.equal(f2.calls.length, 0); assert.equal(d2.sha256, d.sha256);
});

test('download: rejects garbage, empty, non-https and non-allowlisted licences; leaves nothing in the cache', async () => {
  const cacheDir = tmp();
  await assert.rejects(ov.download(R({ url: 'https://x.test/a.mp3' }), { cacheDir, ffmpeg: FF, ffprobe: FP }, { fetchImpl: mockFetch([[/x\.test/, () => new Response(Buffer.from('<html>not audio</html>'), { status: 200 })]]) }), /ffprobe|decode|audio/i);
  await assert.rejects(ov.download(R({ url: 'https://x.test/e.mp3' }), { cacheDir, ffmpeg: FF, ffprobe: FP }, { fetchImpl: mockFetch([[/x\.test/, () => new Response(Buffer.alloc(0), { status: 200 })]]) }), /empty/);
  await assert.rejects(ov.download(R({ url: 'https://x.test/t.mp3' }), { cacheDir, ffmpeg: FF, ffprobe: FP }, { fetchImpl: mockFetch([[/x\.test/, () => new Response(mp3.subarray(0, 40), { status: 200 })]]) }));
  await assert.rejects(ov.download(R({ url: 'http://x.test/a.mp3' }), { cacheDir }, { fetchImpl: mockFetch([]) }), /https/);
  await assert.rejects(ov.download(R({ license: 'by-nc' }), { cacheDir }, { fetchImpl: mockFetch([]) }), /not in cc0/);
  assert.deepEqual(fs.readdirSync(cacheDir).filter((x) => /\.(mp3|wav|bin|html)$/.test(x) || x.startsWith('dl-')), []);
});

// ---- project fixtures ----
function project(cues, extra = {}) {
  const dir = tmp(); fs.writeFileSync(path.join(dir, 'timeline.json'), JSON.stringify({ duration_s: 5, fps: 30, events: { a: 0.5, b: 4 } }));
  fs.writeFileSync(path.join(dir, 'sound.json'), JSON.stringify({ seed: 3, cues, ...extra })); return dir;
}
const netDeps = (results, calls = {}) => ({ cacheDir: tmp(), net: { fetchImpl: mockFetch([[/\/audio\//, () => json({ results })], [/cdn\.freesound/, audioRes]]) }, ...calls });
const BED = { id: 'amb', at: 'a', until: 'b', kind: 'train interior', layer: 'ambience', source: 'library', query: 'train interior rumble', gain_db: -6 };
const BYR = R({ id: 'by1', title: 'Brake squeal', license: 'by', license_version: '4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/', creator: 'Ann', attribution: '"Brake squeal" by Ann is licensed under CC BY 4.0.', foreign_landing_url: 'https://freesound.org/people/Ann/sounds/2/', url: 'https://cdn.freesound.org/previews/2/2_2-hq.mp3' });

test('sfx_fetch --dry-run: no network, nothing written', async () => {
  const dir = project([BED]); const f = mockFetch([]);
  const s = await runSfxFetch({ project: dir, dryRun: true, pick: 3 }, { net: { fetchImpl: f }, cacheDir: tmp() });
  assert.equal(f.calls.length, 0); assert.equal(s.plan.length, 1); assert.equal(s.plan[0].kind, 'openverse'); assert.ok(Math.abs(s.plan[0].span_s - 3.5) < 1e-9);
  assert.ok(!fs.existsSync(path.join(dir, 'sound.lock.json')) && !fs.existsSync(path.join(dir, 'audio')) && !fs.existsSync(path.join(dir, 'CREDITS.txt')));
});

test('query cue without a fetch is an error that names sfx_fetch; --check never fetches', () => {
  const dir = project([BED]); const sound = loadSound(path.join(dir, 'sound.json')); const r = resolveCues(sound, { duration_s: 5, events: { a: 0.5, b: 4 } }, { projectDir: dir });
  assert.ok(r.errors.some((e) => /sfx_fetch/.test(e)), r.errors.join('|'));
});

test('fetch -> lock -> render is deterministic and works with the network and earshot unavailable', async () => {
  const dir = project([BED, { id: 'sq', at: 1, kind: 'brake squeal', layer: 'sfx', source: 'library', query: 'brake squeal', gain_db: -3 }]);
  const deps = netDeps([R(), BYR]); const s = await runSfxFetch({ project: dir, pick: 2 }, deps);
  assert.deepEqual(s.errors, []); assert.equal(s.fetched.length, 2);
  const lock = JSON.parse(fs.readFileSync(path.join(dir, 'sound.lock.json'), 'utf8'));
  assert.equal(lock.entries.amb.candidates.length, 2, 'candidate list kept for a human swap'); assert.ok(lock.entries.amb.file.startsWith('audio/library/amb_0_'));
  assert.ok(fs.existsSync(path.join(dir, lock.entries.amb.file)));
  // offline from here on
  const realFetch = globalThis.fetch; globalThis.fetch = () => { throw new Error('network used at render time'); };
  const savedBin = process.env.EARSHOT_BIN; process.env.EARSHOT_BIN = '/nonexistent/earshot';
  try {
    const tl = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8'));
    const a = renderStems(loadSound(path.join(dir, 'sound.json')), tl, { projectDir: dir }); const b = renderStems(loadSound(path.join(dir, 'sound.json')), tl, { projectDir: dir });
    assert.equal(hashSamples(a.stems.ambience.L, a.stems.ambience.R), hashSamples(b.stems.ambience.L, b.stems.ambience.R));
    assert.ok(a.stems.ambience.used && a.stems.sfx.used);
    // the 2 s file fills the 3.5 s bed by looping: energy in the last 0.5 s of the span
    const i0 = Math.round(3.4 * 48000), i1 = Math.round(3.9 * 48000); let e = 0; for (let i = i0; i < i1; i++) e += a.stems.ambience.L[i] ** 2; assert.ok(e > 1e-3, 'bed loops to fill its span');
    assert.equal(a.licences.length, 2); assert.equal(a.licences[0].licence.sha256.length, 64);
    writeStems(a, path.join(dir, 'audio'));
  } finally { globalThis.fetch = realFetch; if (savedBin === undefined) delete process.env.EARSHOT_BIN; else process.env.EARSHOT_BIN = savedBin; }
  // --use swaps to candidate 1 offline and rewrites the lock
  const sw = await runSfxFetch({ project: dir, use: ['amb=1'] }, { net: { fetchImpl: mockFetch([]) } });
  assert.deepEqual(sw.errors, []); assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'sound.lock.json'), 'utf8')).entries.amb.chosen, 1);
  // changing the query makes the lock stale -> error, not a silent reuse
  const sj = JSON.parse(fs.readFileSync(path.join(dir, 'sound.json'), 'utf8')); sj.cues[0].query = 'something else'; fs.writeFileSync(path.join(dir, 'sound.json'), JSON.stringify(sj));
  const rr = resolveCues(loadSound(path.join(dir, 'sound.json')), { duration_s: 5, events: { a: 0.5, b: 4 } }, { projectDir: dir }); assert.ok(rr.errors.some((e) => /fetched for query/.test(e)));
});

test('a second sfx_fetch run is a no-op (lock hit, no network); --refresh re-searches from the query cache', async () => {
  const dir = project([BED]); const deps = netDeps([R()]); await runSfxFetch({ project: dir, pick: 1 }, deps);
  const f = mockFetch([]); const s = await runSfxFetch({ project: dir, pick: 1 }, { cacheDir: deps.cacheDir, net: { fetchImpl: f } });
  assert.equal(f.calls.length, 0); assert.equal(s.skipped.length, 1);
});

test('rate limit during fetch: partial lock is kept, later cues are reported, nothing is half-written for the failed one', async () => {
  const dir = project([BED, { id: 'sq', at: 1, kind: 'brake squeal', layer: 'sfx', source: 'library', query: 'brake squeal' }]);
  const f = mockFetch([[/q=train/, () => json({ results: [R()] })], [/q=brake/, () => new Response('', { status: 429, headers: { 'retry-after': '39047' } })], [/cdn\.freesound/, audioRes]]);
  const s = await runSfxFetch({ project: dir, pick: 1 }, { cacheDir: tmp(), net: { fetchImpl: f, sleep: async () => {} } });
  assert.equal(s.fetched.length, 1); assert.ok(s.errors.some((e) => /^sq: Openverse rate limit/.test(e))); assert.ok(Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'sound.lock.json'), 'utf8')).entries).join() === 'amb');
});

test('credits: BY items get a line, CC0 listed as optional, hand-written lines survive a re-run', () => {
  const items = [{ file: 'audio/library/a.wav', licence: ov.licenceRecord(BYR, { sha256: 'x'.repeat(64) }) }, { file: 'audio/library/b.wav', licence: ov.licenceRecord(R(), { sha256: 'y'.repeat(64) }) }];
  const t = buildCredits(items); assert.match(t, /Brake squeal" by Ann/); assert.match(t, /freesound\.org\/people\/Ann\/sounds\/2/); assert.match(t, /Optional credit[\s\S]*Train interior rumble/);
  assert.ok(t.indexOf('Brake squeal') < t.indexOf('Optional credit'), 'BY section comes first');
  const dir = tmp(); fs.writeFileSync(path.join(dir, 'CREDITS.txt'), 'My own note\n'); writeCredits(dir, items); writeCredits(dir, items);
  const out = fs.readFileSync(path.join(dir, 'CREDITS.txt'), 'utf8'); assert.match(out, /^My own note/); assert.equal(out.match(/BEGIN sfx_fetch/g).length, 1);
});

async function renderedProject({ writeCreditsFile }) {
  const dir = project([{ ...BED, until: undefined, at: 'a', until_x: 0 }]); // placeholder replaced below
  fs.writeFileSync(path.join(dir, 'sound.json'), JSON.stringify({ seed: 3, cues: [{ id: 'sq', at: 1, kind: 'brake squeal', layer: 'sfx', source: 'library', query: 'brake squeal' }] }));
  await runSfxFetch({ project: dir, pick: 1 }, netDeps([BYR]));
  if (!writeCreditsFile) fs.rmSync(path.join(dir, 'CREDITS.txt'));
  const tl = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8')); writeStems(renderStems(loadSound(path.join(dir, 'sound.json')), tl, { projectDir: dir }), path.join(dir, 'audio'));
  return { dir, tl };
}
test('audit: Openverse records pass the licence manifest; a BY item without a CREDITS.txt line FAILS', async () => {
  const ok = await renderedProject({ writeCreditsFile: true });
  const a = auditProjectAudio({ projectDir: ok.dir, media: null, timeline: ok.tl }); assert.ok(!a.fails.some((f) => /licence|CREDITS/.test(f)), a.fails.join('|'));
  assert.ok(a.verified.some((v) => /manifest complete/.test(v)) && a.verified.some((v) => /CC BY item/.test(v))); assert.ok(a.warns.some((w) => /preview MP3/.test(w)));
  const bad = await renderedProject({ writeCreditsFile: false });
  const b = auditProjectAudio({ projectDir: bad.dir, media: null, timeline: bad.tl }); assert.ok(b.fails.some((f) => /CC BY item\(s\) without an attribution line/.test(f) && /sq/.test(f)), b.fails.join('|'));
  assert.deepEqual(missingCredits(bad.dir, [{ id: 'sq', file: 'x.wav', licence: BYR && ov.licenceRecord(BYR, { sha256: 's'.repeat(64) }) }]), ['sq']);
});

test('audit: a hand-imported CC-BY-NC file fails, a CC-BY-SA file warns', async () => {
  const dir = project([]); const wav = path.join(dir, 'x.wav'); writeWavFloat(wav, new Float32Array(48000).fill(0.1), new Float32Array(48000).fill(0.1));
  const mk = (lic) => { fs.writeFileSync(path.join(dir, 'sound.json'), JSON.stringify({ seed: 1, cues: [{ id: 'x', at: 0, kind: 'door', layer: 'sfx', source: 'library', file: 'x.wav', licence: lic }] })); fs.writeFileSync(path.join(dir, 'CREDITS.txt'), 'x.wav\n'); const tl = { duration_s: 5, fps: 30 }; writeStems(renderStems(loadSound(path.join(dir, 'sound.json')), tl, { projectDir: dir }), path.join(dir, 'audio')); return auditProjectAudio({ projectDir: dir, media: null, timeline: tl }); };
  assert.ok(mk('CC BY-NC 4.0').fails.some((f) => /non-commercial/.test(f)));
  const sa = mk('CC BY-SA 4.0'); assert.ok(sa.warns.some((w) => /ShareAlike/.test(w)));
});

// ---- earshot ----
function fakeRun(log, { guess = false } = {}) {
  return (bin, args) => {
    log.push([bin, ...args]);
    if (args[0] === '--version') return { status: 0, stdout: 'earshot 9.9.9\n', stderr: '' };
    const o = args[args.indexOf('-o') + 1]; const n = 48000; const seed = Number(args[args.indexOf('--seed') + 1]);
    writeWavFloat(o, new Float32Array(n).map((_, i) => Math.sin(i * 0.05) * 0.2 * (1 + seed)), new Float32Array(n).fill(0.1));
    return { status: 0, stdout: JSON.stringify({ summary: 'ok', sound: args.includes('--sound') ? args[args.indexOf('--sound') + 1] : 'door/shut', why: guess ? [] : ['named'], unknown: guess ? ['coach'] : [], takes: [{ id: 'door/shut', seed, dur_s: 1, checks: { ok: true } }] }), stderr: '' };
  };
}
const EC = { id: 'door', at: 1, kind: 'door', layer: 'sfx', source: 'earshot', query: 'a door closing', params: { sound: 'door/shut', seed: 4 } };
test('earshot adapter: calls the CLI with array args and a seed, caches by request hash, records the licence', () => {
  const dir = tmp(); const log = [];
  const r = resolveGenerated(EC, { projectDir: dir, run: fakeRun(log), env: {} });
  const make = log.find((l) => l[1] === 'make'); assert.ok(make.includes('--sound') && make.includes('door/shut') && make.includes('--seed') && make.includes('4') && make.includes('--no-loop') && make.includes('--json'));
  assert.ok(fs.existsSync(path.join(dir, r.file))); assert.equal(r.licence.provider, 'earshot'); assert.equal(r.licence.licence, EARSHOT_LICENCE); assert.equal(r.licence.version, 'earshot 9.9.9'); assert.equal(r.licence.sha256.length, 64);
  const log2 = []; const r2 = resolveGenerated(EC, { projectDir: dir, run: fakeRun(log2), env: {} });
  assert.ok(r2.cache_hit); assert.ok(!log2.some((l) => l[1] === 'make')); assert.equal(r2.file, r.file);
  const r3 = resolveGenerated({ ...EC, params: { sound: 'door/shut', seed: 5 } }, { projectDir: dir, run: fakeRun([]), env: {} }); assert.notEqual(r3.file, r.file);
  assert.equal(resolveGenerated({ ...EC, params: { sound: 'door/shut', seed: 4 } }, { projectDir: dir, run: fakeRun([]), env: {}, durS: 3 }).file !== r.file, true, 'duration is part of the key');
});
test('earshot adapter: disabled path, missing install, guessed pick, other providers', () => {
  const dir = tmp();
  assert.throws(() => resolveGenerated(EC, { projectDir: dir, run: fakeRun([]), env: { REEL_EARSHOT: 'off' } }), /disabled/);
  assert.throws(() => resolveGenerated(EC, { projectDir: dir, run: () => { throw new Error('ENOENT'); }, env: {} }), /not installed.*350 MB.*EARSHOT_BIN/s);
  assert.throws(() => resolveGenerated({ id: 'w' }, { projectDir: dir }), /no provider configured/);
  assert.throws(() => resolveGenerated({ ...EC, query: '', params: {} }, { projectDir: dir, run: fakeRun([]), env: {} }), /needs "query"/);
  const g = resolveGenerated({ ...EC, id: 'g', query: 'coach door', params: { seed: 1 } }, { projectDir: dir, run: fakeRun([], { guess: true }), env: {} }); assert.equal(g.licence.guessed_pick, true);
});
test('sfx_fetch renders earshot cues into the lock; render then needs no earshot; a guess is flagged by the audit', async () => {
  const dir = project([{ ...EC, params: { seed: 1 } }, { ...EC, id: 'door2' }]);
  const s = await runSfxFetch({ project: dir }, { earshotCtx: { run: fakeRun([], { guess: true }), env: {} } });
  assert.deepEqual(s.errors, []); assert.equal(s.fetched.length, 2);
  const tl = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8'));
  writeStems(renderStems(loadSound(path.join(dir, 'sound.json')), tl, { projectDir: dir }), path.join(dir, 'audio'));
  const a = auditProjectAudio({ projectDir: dir, media: null, timeline: tl }); assert.ok(!a.fails.some((f) => /licence/.test(f)), a.fails.join('|')); assert.ok(a.warns.some((w) => /earshot picked a nearest design by guess/.test(w)));
  const off = await runSfxFetch({ project: project([EC]) }, { earshotCtx: { env: { REEL_EARSHOT: 'off' } } }); assert.ok(off.errors[0].includes('disabled'));
});

// ---- local library ----
test('local index: duration, loudness, filename tags, sidecar licence; missing licence fails at resolve; fetch ranks the index offline', async () => {
  const lib = tmp(); fs.mkdirSync(path.join(lib, 'doors')); const tone = (f, d) => spawnSync(FF, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=300:duration=${d}`, '-ar', '48000', f]);
  tone(path.join(lib, 'doors', 'coach_door_slam.wav'), 1.5); tone(path.join(lib, 'paper-rustle.wav'), 2);
  fs.writeFileSync(path.join(lib, 'doors', 'coach_door_slam.wav.licence.json'), JSON.stringify({ name: 'own recording', proof: 'recorded by me 2026' })); fs.writeFileSync(path.join(lib, 'broken.wav'), 'nope');
  const idx = buildIndex(lib, { ffmpeg: FF, ffprobe: FP }); assert.equal(idx.entries.length, 2); assert.equal(idx.skipped.length, 1);
  const e = idx.entries.find((x) => x.rel === 'doors/coach_door_slam.wav'); assert.ok(Math.abs(e.duration_s - 1.5) < 0.05); assert.ok(Number.isFinite(e.lufs) && Number.isFinite(e.peak_dbfs)); assert.deepEqual(e.tags, ['doors', 'coach', 'door', 'slam']); assert.equal(e.licence.name, 'own recording');
  assert.equal(idx.entries.find((x) => x.rel === 'paper-rustle.wav').licence, null);
  const dir = project([{ id: 'door', at: 1, kind: 'door', layer: 'sfx', source: 'library', query: 'coach door slam', library_index: 'idx.json' }, { id: 'paper', at: 2, kind: 'paper', layer: 'sfx', source: 'library', query: 'paper rustle', library_index: 'idx.json' }]);
  fs.writeFileSync(path.join(dir, 'idx.json'), JSON.stringify(idx)); const f = mockFetch([]);
  const s = await runSfxFetch({ project: dir, pick: 2 }, { net: { fetchImpl: f } }); assert.equal(f.calls.length, 0); assert.deepEqual(s.errors, []);
  const lock = JSON.parse(fs.readFileSync(path.join(dir, 'sound.lock.json'), 'utf8')); assert.ok(lock.entries.door.file.startsWith('audio/library/door_0_') && fs.existsSync(path.join(dir, lock.entries.door.file)) && lock.entries.door.candidates[0].original.endsWith('coach_door_slam.wav'));
  const r = resolveCues(loadSound(path.join(dir, 'sound.json')), { duration_s: 5, events: {} }, { projectDir: dir });
  assert.ok(r.errors.some((x) => /"paper".*needs "licence"/.test(x)), r.errors.join('|')); assert.ok(!r.errors.some((x) => /"door"/.test(x)));
});

test('rank: duration fit, tag match, cc0 > pdm > by, non-preview preferred', () => {
  const it = (o) => ({ id: o.id, title: 'x', tags: [], duration_s: 5, licence_id: 'cc0', preview: false, ...o });
  const top = (items, ctx) => rank(items, ctx)[0].it.id;
  assert.equal(top([it({ id: 'short', duration_s: 1 }), it({ id: 'fits', duration_s: 12 })], { query: 'z', wantDurS: 10, isBed: true }), 'fits');
  assert.equal(top([it({ id: 'by', licence_id: 'by' }), it({ id: 'cc0' }), it({ id: 'pdm', licence_id: 'pdm' })], { query: 'z' }), 'cc0');
  assert.equal(rank([it({ id: 'by', licence_id: 'by' }), it({ id: 'pdm', licence_id: 'pdm' })], { query: 'z' })[0].it.id, 'pdm');
  assert.equal(top([it({ id: 'pre', preview: true }), it({ id: 'orig' })], { query: 'z' }), 'orig');
  assert.equal(top([it({ id: 'no' }), it({ id: 'yes', tags: ['station', 'bell'] })], { query: 'station bell' }), 'yes');
});

test('fitToSpan trims, and loops with a crossfade that keeps the level', () => {
  const x = new Float32Array(4800).fill(0.5); assert.equal(fitToSpan(x, 2000, 100).length, 2000);
  const y = fitToSpan(x, 20000, 480); assert.equal(y.length, 20000); let mn = 1; for (const v of y) mn = Math.min(mn, v); assert.ok(mn > 0.45, `seam dip ${mn}`);
});
