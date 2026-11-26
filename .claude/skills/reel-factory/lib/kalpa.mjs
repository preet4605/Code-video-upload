// Kalpa Labs TTS client (kalpa-tts-1). One place for request shape, error mapping, retry, cache and atomic write.
// POST https://api.kalpalabs.ai/v1/tts/{voice_id}  Authorization: Bearer $KALPA_API_KEY
//   body {text(1-8000), model, params:{temperature 0-1.5}, sample_rate}  ->  {request_id, audio:{format:'wav',sample_rate,data_b64}, usage}
// Errors {error:{type,message,request_id}}: 401 auth, 402 allowance_exhausted (NEVER retried), 403, 404, 422,
// 400 context_length_exceeded (split the line), 429 (Retry-After honoured), 500/502/503 (retried).
// Kalpa returns NO word timestamps. The API key is read from the environment and is never logged or put in errors.
//
// Retry policy: only 429, 500/502/503 and network errors that happened BEFORE any response (fetch rejects with
// TypeError). A client-side timeout/abort AFTER the request was sent is NOT retried by default: the server may
// already have billed it, so retrying could double-bill (opt in with retryOnTimeout). Max 4 attempts.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const KALPA_BASE = 'https://api.kalpalabs.ai';
export const DEFAULT_MODEL = 'kalpa-tts-1';
export const SAMPLE_RATES = Object.freeze([8000, 16000, 22050, 24000, 32000, 44100, 48000]);
export const MAX_TEXT = 8000;
export const MAX_ATTEMPTS = 4;

export class KalpaError extends Error {
  constructor(message, { status = null, type = 'unknown', requestId = null, retryAfterS = null } = {}) {
    super(message);
    this.name = 'KalpaError';
    this.status = status;
    this.type = type;
    this.requestId = requestId;
    this.retryAfterS = retryAfterS;
  }
}

const TYPE_BY_STATUS = { 400: 'invalid_request', 401: 'auth', 402: 'allowance_exhausted', 403: 'forbidden', 404: 'not_found', 422: 'invalid', 429: 'rate_limited', 500: 'server', 502: 'server', 503: 'server' };
const RETRYABLE = new Set([429, 500, 502, 503]);

export function cacheKey({ voice, model, temperature, sampleRate, text }) {
  return crypto.createHash('sha256').update([voice, model, temperature ?? '', sampleRate, text].join('|')).digest('hex');
}

export function probeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const d = Number((r.stdout || '').trim());
  return r.status === 0 && Number.isFinite(d) ? d : NaN;
}

// Valid = ffprobe reports duration > 0 AND ffmpeg can decode it end to end.
export function validateWav(file) {
  const d = probeDuration(file);
  if (!(d > 0)) throw new KalpaError(`TTS audio is empty or unreadable (duration ${Number.isFinite(d) ? d : 'n/a'}): ${path.basename(file)}`, { type: 'empty_audio' });
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.status !== 0 || (r.stderr || '').trim()) throw new KalpaError(`TTS audio is not decodable: ${path.basename(file)}`, { type: 'undecodable_audio' });
  return d;
}

function parseRetryAfter(h) {
  if (h == null) return null;
  const n = Number(h);
  if (Number.isFinite(n)) return Math.max(0, n);
  const t = Date.parse(h);
  return Number.isFinite(t) ? Math.max(0, (t - Date.now()) / 1000) : null;
}

async function toError(res) {
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error body */ }
  const e = body?.error || {};
  const type = e.type || TYPE_BY_STATUS[res.status] || 'unknown';
  const hint = res.status === 402 ? ' (allowance exhausted: not retried)' : res.status === 400 && type === 'context_length_exceeded' ? ' (split the line into shorter pieces)' : '';
  return new KalpaError(`Kalpa ${res.status} ${type}: ${String(e.message || res.statusText || 'error').slice(0, 200)}${hint}`, {
    status: res.status, type, requestId: e.request_id ?? null, retryAfterS: parseRetryAfter(res.headers?.get?.('retry-after'))
  });
}

/**
 * Synthesize one clip to `out` (wav). Returns { file, cached, duration_s, cache_key, request_id, usage }.
 * opts: apiKey, fetchImpl, sleep, force, timeoutMs, retryOnTimeout, backoffMs, log
 */
export async function synth({ text, voice, model = DEFAULT_MODEL, temperature, sampleRate = 48000, out, apiKey, fetchImpl, sleep, force = false, timeoutMs = 120000, retryOnTimeout = false, backoffMs = 1500, log = () => {} }) {
  if (typeof text !== 'string' || !text.length) throw new KalpaError('text is empty', { type: 'invalid' });
  if ([...text].length > MAX_TEXT) throw new KalpaError(`text is ${[...text].length} chars; Kalpa max is ${MAX_TEXT}. Split the line.`, { type: 'context_length_exceeded' });
  if (!voice) throw new KalpaError('voice id missing', { type: 'invalid' });
  if (!SAMPLE_RATES.includes(sampleRate)) throw new KalpaError(`sample_rate ${sampleRate} not one of ${SAMPLE_RATES.join(',')}`, { type: 'invalid' });
  if (temperature != null && !(temperature >= 0 && temperature <= 1.5)) throw new KalpaError(`temperature ${temperature} outside 0..1.5`, { type: 'invalid' });
  if (!out) throw new KalpaError('out path missing', { type: 'invalid' });
  out = path.resolve(out);
  const key = cacheKey({ voice, model, temperature, sampleRate, text });
  const meta = `${out}.key`;

  if (!force && fs.existsSync(out) && fs.existsSync(meta) && fs.readFileSync(meta, 'utf8').trim() === key) {
    try { return { file: out, cached: true, duration_s: validateWav(out), cache_key: key }; } catch { /* corrupt cache: regenerate */ }
  }

  const KEY = apiKey ?? process.env.KALPA_API_KEY;
  if (!KEY) throw new KalpaError('KALPA_API_KEY missing (put it in ~/.config/code-video-studio/tts.env)', { status: 401, type: 'auth' });
  const doFetch = fetchImpl || globalThis.fetch;
  const wait = sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const body = JSON.stringify({ text, model, sample_rate: sampleRate, ...(temperature != null ? { params: { temperature } } : {}) });

  let last;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await doFetch(`${KALPA_BASE}/v1/tts/${encodeURIComponent(voice)}`, {
        method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body,
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (e) {
      const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
      last = new KalpaError(`Kalpa network error: ${timedOut ? 'timeout' : String(e?.cause?.code || e?.message || e).slice(0, 120)}`, { type: timedOut ? 'timeout' : 'network' });
      if ((timedOut && !retryOnTimeout) || attempt === MAX_ATTEMPTS) throw last;
      log(`kalpa attempt ${attempt} failed (${last.type}), retrying`);
      await wait(backoffMs * attempt);
      continue;
    }
    if (!res.ok) {
      last = await toError(res);
      if (!RETRYABLE.has(res.status) || attempt === MAX_ATTEMPTS) throw last;
      const delayMs = last.retryAfterS != null ? last.retryAfterS * 1000 : backoffMs * attempt;
      log(`kalpa ${res.status}, retry ${attempt}/${MAX_ATTEMPTS - 1} in ${Math.round(delayMs)}ms`);
      await wait(delayMs);
      continue;
    }
    let j;
    try { j = await res.json(); } catch { throw new KalpaError('Kalpa returned a non-JSON success body', { status: res.status, type: 'bad_response' }); }
    const b64 = j?.audio?.data_b64;
    if (!b64) throw new KalpaError('Kalpa response has no audio.data_b64', { status: res.status, type: 'bad_response', requestId: j?.request_id ?? null });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const tmp = `${out}.${process.pid}.tmp.wav`;
    try {
      fs.writeFileSync(tmp, Buffer.from(b64, 'base64'));
      const duration_s = validateWav(tmp);
      fs.renameSync(tmp, out);
      fs.writeFileSync(meta, key);
      return { file: out, cached: false, duration_s, cache_key: key, request_id: j.request_id ?? null, usage: j.usage ?? null };
    } catch (e) {
      try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
      try { fs.rmSync(meta, { force: true }); } catch { /* ignore */ }
      throw e;
    }
  }
  throw last;
}

export async function listVoices({ apiKey, fetchImpl } = {}) {
  const KEY = apiKey ?? process.env.KALPA_API_KEY;
  if (!KEY) throw new KalpaError('KALPA_API_KEY missing', { status: 401, type: 'auth' });
  const res = await (fetchImpl || globalThis.fetch)(`${KALPA_BASE}/v1/voices`, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw await toError(res);
  return res.json();
}
