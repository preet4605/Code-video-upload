// Openverse audio source (anonymous API, https://api.openverse.org/v1/audio/). Fetching is an EXPLICIT step (scripts/sfx_fetch.mjs);
// nothing in render / --check / audit imports this file.
//   search(term, {licences, minDurationS, maxDurationS, pageSize, refresh}, deps)  -> { results, cached, rate }
//   download(result, {cacheDir, ffmpeg, ffprobe}, deps)                             -> { wav, sha256, source_file, licence, ... }
// Licence policy is an ALLOWLIST (cc0, pdm, by). by-sa, by-nd, *-nc*, sampling+, null and unknown values are dropped, because
// `license_type=commercial` alone still lets SA and ND through. This account is monetised.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const API = 'https://api.openverse.org/v1';
export const DEFAULT_LICENCES = Object.freeze(['cc0', 'pdm', 'by']);
export const LICENCE_NAMES = Object.freeze({ cc0: 'CC0 1.0', pdm: 'Public Domain Mark 1.0', by: 'CC BY' });
export const MAX_DOWNLOAD_BYTES = 60 * 1024 * 1024;
export const QUERY_TTL_S = 7 * 86400;

export class RateLimitError extends Error {
  constructor(msg, retryAfterS) { super(msg); this.name = 'RateLimitError'; this.retry_after_s = retryAfterS; }
}

export function defaultCacheDir() {
  return process.env.REEL_SFX_CACHE || path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'reel-factory', 'sfx');
}

// true only for an allowlisted, unrestricted-commercial licence
export function licenceAllowed(r, allow = DEFAULT_LICENCES) {
  const lic = String(r?.license ?? '').toLowerCase().trim();
  if (!allow.includes(lic)) return false;
  const url = String(r?.license_url ?? '').toLowerCase();
  if (/(^|[\/-])(nc|nd|sa)([\/-]|$)|by-n[cd]|by-sa|sampling/.test(url.replace(/https?:\/\/creativecommons\.org\/(licenses|publicdomain)\//, ''))) return false; // belt and braces on the URL
  if (lic === 'by' && !(r.creator || r.attribution)) return false; // cannot credit an anonymous BY item
  return true;
}

export const isPreview = (r) => /\/previews?\//i.test(String(r?.url ?? '')) || /preview/i.test(String(r?.url ?? ''));

export function licenceRecord(r, { sha256, retrievedAt = new Date().toISOString() } = {}) {
  const id = String(r.license).toLowerCase(); const ver = r.license_version ? String(r.license_version) : '';
  return {
    name: id === 'by' ? `CC BY ${ver}`.trim() : (id === 'cc0' ? LICENCE_NAMES.cc0 : `${LICENCE_NAMES.pdm}`),
    id, url: r.license_url || null, credit: r.attribution || (r.creator ? `by ${r.creator}` : null), proof: r.foreign_landing_url || r.detail_url || null,
    sha256, provider: r.provider || null, source: r.source || null, via: 'openverse', openverse_id: r.id || null,
    foreign_landing_url: r.foreign_landing_url || null, detail_url: r.detail_url || null,
    license: id, license_version: ver || null, license_url: r.license_url || null,
    creator: r.creator || null, attribution: r.attribution || null, title: r.title || null,
    retrieved_at: retrievedAt, quality: isPreview(r) ? 'preview-mp3' : 'original'
  };
}

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const sleepReal = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'reel-factory-sfx-fetch/1 (local video tooling; contact not provided)';

// fetch with 429 handling: honour Retry-After up to maxWaitS (default 60 s); longer -> RateLimitError (a daily quota must not hang a render for hours).
export async function fetchWithBackoff(url, { fetchImpl = fetch, sleep = sleepReal, retries = 3, maxWaitS = 60, baseS = 2, log = () => {} } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(url, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow' });
    if (res.status !== 429) return res;
    const ra = Number(res.headers?.get?.('retry-after'));
    const wait = Number.isFinite(ra) && ra > 0 ? ra : baseS * 2 ** attempt;
    const avail = res.headers?.get?.('x-ratelimit-available-anon_sustained');
    if (wait > maxWaitS) throw new RateLimitError(`Openverse rate limit (HTTP 429): Retry-After ${Math.round(wait)} s (~${(wait / 3600).toFixed(1)} h)${avail !== undefined && avail !== null ? `, anon_sustained available=${avail}` : ''}. Not waiting; run sfx_fetch again later, or use a registered Openverse client (OPENVERSE_TOKEN) or your own library (sfx_index.mjs).`, wait);
    if (attempt >= retries) throw new RateLimitError(`Openverse still answering 429 after ${retries} retries`, wait);
    log(`429: waiting ${wait}s (attempt ${attempt + 1}/${retries})`);
    await sleep(wait * 1000);
  }
}

export function rateInfo(res) {
  const h = (k) => res.headers?.get?.(k) ?? null;
  return { burst_limit: h('x-ratelimit-limit-anon_burst'), burst_available: h('x-ratelimit-available-anon_burst'), sustained_limit: h('x-ratelimit-limit-anon_sustained'), sustained_available: h('x-ratelimit-available-anon_sustained') };
}

export async function search(term, { licences = DEFAULT_LICENCES, minDurationS = 0, maxDurationS = Infinity, pageSize = 20, page = 1, refresh = false } = {}, deps = {}) {
  const { fetchImpl = fetch, cacheDir = defaultCacheDir(), now = () => Date.now(), token = process.env.OPENVERSE_TOKEN } = deps;
  const q = String(term || '').trim(); if (!q) throw new Error('openverse.search: empty query');
  const allow = licences.map((l) => String(l).toLowerCase());
  const params = new URLSearchParams({ q, license_type: 'commercial', page_size: String(pageSize), page: String(page) });
  const key = sha(`${API}/audio/?${params}`); const qdir = path.join(cacheDir, 'queries'); const qfile = path.join(qdir, `${key}.json`);
  let raw = null, cached = false, rate = null;
  if (!refresh) { try { const c = JSON.parse(fs.readFileSync(qfile, 'utf8')); if (now() / 1000 - c.fetched_at_s < QUERY_TTL_S) { raw = c.results; cached = true; } } catch { /* miss */ } }
  if (!raw) {
    const fetchOpts = { ...deps, fetchImpl: token ? ((u, o) => fetchImpl(u, { ...o, headers: { ...o.headers, authorization: `Bearer ${token}` } })) : fetchImpl };
    const res = await fetchWithBackoff(`${API}/audio/?${params}`, fetchOpts);
    rate = rateInfo(res);
    if (!res.ok) throw new Error(`Openverse search failed: HTTP ${res.status}`);
    const j = await res.json(); raw = Array.isArray(j?.results) ? j.results : [];
    fs.mkdirSync(qdir, { recursive: true }); fs.writeFileSync(qfile, JSON.stringify({ q, params: params.toString(), fetched_at_s: Math.floor(now() / 1000), results: raw }));
  }
  const rejected = {};
  const results = raw.filter((r) => {
    if (!licenceAllowed(r, allow)) { const k = String(r?.license ?? 'unknown'); rejected[k] = (rejected[k] || 0) + 1; return false; }
    const d = Number(r.duration) / 1000;
    if (Number.isFinite(d) && d > 0) { if (d < minDurationS || d > maxDurationS) return false; }
    return Boolean(r.url);
  });
  return { results, cached, rate, total_returned: raw.length, rejected_licences: rejected };
}

function probe(ffprobe, file) {
  const r = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type,duration,sample_rate,channels:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffprobe cannot read the download: ${(r.stderr || '').trim().slice(0, 200)}`);
  const j = JSON.parse(r.stdout || '{}'); const a = (j.streams || []).find((s) => s.codec_type === 'audio');
  if (!a) throw new Error('download has no audio stream');
  const dur = Number(j.format?.duration ?? a.duration);
  if (!(dur > 0)) throw new Error('download has no duration (empty or truncated)');
  return { duration_s: dur, sample_rate: Number(a.sample_rate), channels: a.channels };
}

// Download one result into the cache and convert it to 48 kHz stereo WAV. The raw bytes are hashed; the cache is content-addressed
// (<sha>.<ext> original, <sha>.wav converted) and urls.json maps url -> sha so a second call needs no network.
export async function download(r, { cacheDir = defaultCacheDir(), ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', allow = DEFAULT_LICENCES } = {}, deps = {}) {
  const { fetchImpl = fetch } = deps;
  if (!licenceAllowed(r, allow)) throw new Error(`refusing to download "${r?.title}": licence "${r?.license}" is not in ${allow.join('/')}`);
  const url = String(r.url); if (!/^https:\/\//i.test(url)) throw new Error(`refusing non-https download URL: ${url}`);
  fs.mkdirSync(cacheDir, { recursive: true });
  const idxFile = path.join(cacheDir, 'urls.json'); let idx = {}; try { idx = JSON.parse(fs.readFileSync(idxFile, 'utf8')); } catch { /* none */ }
  let hash = idx[url]; let cacheHit = false; let ext = null;
  const find = (h) => fs.readdirSync(cacheDir).find((f) => f.startsWith(`${h}.`) && !f.endsWith('.wav'));
  if (hash && find(hash) && fs.existsSync(path.join(cacheDir, `${hash}.wav`))) { cacheHit = true; ext = path.extname(find(hash)).slice(1); }
  else {
    const res = await fetchWithBackoff(url, deps);
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status} for ${url}`);
    const len = Number(res.headers?.get?.('content-length')); if (len > MAX_DOWNLOAD_BYTES) throw new Error(`download too large (${len} bytes)`);
    const buf = Buffer.from(await res.arrayBuffer()); if (!buf.length) throw new Error('download is empty'); if (buf.length > MAX_DOWNLOAD_BYTES) throw new Error('download too large');
    hash = sha(buf); ext = (r.filetype || path.extname(new URL(url).pathname).slice(1) || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
    const fresh = fs.mkdtempSync(path.join(cacheDir, 'dl-')); // fresh dir: untrusted bytes never land next to anything we execute
    try {
      const tmp = path.join(fresh, `in.${ext}`); fs.writeFileSync(tmp, buf);
      probe(ffprobe, tmp);
      const wavTmp = path.join(fresh, 'out.wav');
      const c = spawnSync(ffmpeg, ['-v', 'error', '-y', '-i', tmp, '-vn', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', wavTmp], { encoding: 'utf8' });
      if (c.status !== 0 || (c.stderr || '').trim()) throw new Error(`audio does not decode cleanly: ${(c.stderr || '').trim().slice(0, 200)}`);
      fs.renameSync(tmp, path.join(cacheDir, `${hash}.${ext}`)); fs.renameSync(wavTmp, path.join(cacheDir, `${hash}.wav`));
    } finally { fs.rmSync(fresh, { recursive: true, force: true }); }
    idx[url] = hash; fs.writeFileSync(idxFile, JSON.stringify(idx, null, 1));
  }
  const wav = path.join(cacheDir, `${hash}.wav`); const info = probe(ffprobe, wav);
  if (info.sample_rate !== 48000 || info.channels !== 2) throw new Error(`converted file is ${info.sample_rate} Hz / ${info.channels} ch, expected 48000 / 2`);
  return { wav, sha256: hash, source_file: path.join(cacheDir, `${hash}.${ext}`), duration_s: info.duration_s, cache_hit: cacheHit, licence: licenceRecord(r, { sha256: hash }) };
}
