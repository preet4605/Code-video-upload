#!/usr/bin/env node
// Build voiceover.wav + timeline.json (with named time events) from <project>/lines.json.
//   node scripts/build_vo.mjs --project <dir> [--force] [--dry-run]
// lines.json = { voice (name or id), model?, temperature?, sample_rate?, tempo?, lead_s?, gap?, tail_s?,
//   lines:[{sc, hi, hl, gap?, tempo?, event?, sfx?:[{name, at?:'start'|'end', dt?, gain_db?, scare?}]}], scenes_meta?, extra_sfx? }
// Each line = one Kalpa call (Devanagari `hi` is spoken; `hl` is the on-screen caption text), cached under cache/vo.
// Words are aligned inside each clip's REAL window (Kalpa has no word timestamps; in-line timing is approximate).
// Outputs are written to .tmp then renamed, so a failed run never leaves a half-written voiceover/timeline.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { alignWordsToVoicedSpans, detectVoicedSpans, rechunkCaptions } from '../lib/align.mjs';
import { synth, cacheKey, probeDuration, DEFAULT_MODEL, KalpaError } from '../lib/kalpa.mjs';
import { resolveVoice } from '../lib/voices.mjs';

const SR = 48000;
const r3 = (n) => Math.round(n * 1000) / 1000;
const ff = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status) throw new Error(r.stderr.slice(-600)); return r; };
const dur = (f) => probeDuration(f);
const pad2 = (i) => String(i).padStart(2, '0');
const TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse';

// events from clip layout: line00_start/end for every line plus lines[i].event (start) and <event>_end
export function computeEvents(layout, lines) {
  const ev = {};
  const put = (k, v) => { if (k in ev) throw new Error(`duplicate event name "${k}"`); ev[k] = r3(v); };
  for (const L of layout) {
    put(`line${pad2(L.i)}_start`, L.start_s);
    put(`line${pad2(L.i)}_end`, L.end_s);
    const name = lines[L.i].event;
    if (name) { put(name, L.start_s); put(`${name}_end`, L.end_s); }
  }
  return ev;
}

export function readSpec(proj) {
  const spec = JSON.parse(fs.readFileSync(path.join(proj, 'lines.json'), 'utf8'));
  if (!Array.isArray(spec.lines) || !spec.lines.length) throw new Error('lines.json: "lines" must be a non-empty array');
  spec.lines.forEach((l, i) => {
    if (!l.hi || !String(l.hi).trim()) throw new Error(`lines.json: line ${i} has empty "hi" text`);
    if (!l.hl) throw new Error(`lines.json: line ${i} has no "hl" caption text`);
    if (l.whisper) throw new Error(`lines.json: line ${i} uses "whisper", which the package build does not support yet`);
  });
  return spec;
}

export async function buildVo(proj, { force = false, dryRun = false, fetchImpl, sleep, apiKey, log = console.error, concurrency = 3 } = {}) {
  proj = path.resolve(proj);
  const spec = readSpec(proj);
  const lines = spec.lines;
  const voice = resolveVoice(spec.voice);
  if (!voice) throw new Error('lines.json: "voice" missing (name like "Aman" or a voice id)');
  const model = spec.model || DEFAULT_MODEL;
  const temperature = spec.temperature ?? 0.7;
  const sampleRate = spec.sample_rate || SR;
  const cache = path.join(proj, 'cache', 'vo');
  const rawOf = (i) => path.join(cache, `l${pad2(i)}_raw.wav`);

  if (dryRun) {
    const plan = lines.map((l, i) => {
      const key = cacheKey({ voice, model, temperature, sampleRate, text: l.hi });
      const meta = `${rawOf(i)}.key`;
      const cached = !force && fs.existsSync(rawOf(i)) && fs.existsSync(meta) && fs.readFileSync(meta, 'utf8').trim() === key;
      return { line: i, chars: [...l.hi].length, cached };
    });
    return { dry_run: true, voice, model, temperature, sample_rate: sampleRate, calls_needed: plan.filter((p) => !p.cached).length, chars_to_send: plan.filter((p) => !p.cached).reduce((a, p) => a + p.chars, 0), plan };
  }

  fs.mkdirSync(cache, { recursive: true });
  // 1. synth (bounded concurrency; cache hits make no call)
  const synthed = new Array(lines.length);
  let next = 0, failure = null;
  await Promise.all(Array.from({ length: Math.min(concurrency, lines.length) }, async () => {
    while (!failure) {
      const i = next++;
      if (i >= lines.length) return;
      try { synthed[i] = await synth({ text: lines[i].hi, voice, model, temperature, sampleRate, out: rawOf(i), force, fetchImpl, sleep, apiKey, log }); }
      catch (e) { failure = failure || new Error(`line ${i}: ${e.message}`, { cause: e }); }
    }
  }));
  if (failure) throw failure;

  // 2. trim silence, optional tempo cap (caption reading speed <= ~15.5 chars/s), mono 48k
  const clips = [];
  for (let i = 0; i < lines.length; i++) {
    const id = pad2(i);
    const raw = rawOf(i), pre = path.join(cache, `l${id}_pre.wav`), trim = path.join(cache, `l${id}.wav`);
    ff(['-i', raw, '-af', TRIM, pre]);
    const preD = dur(pre);
    if (!(preD > 0.05)) throw new KalpaError(`line ${i}: TTS audio is silent/zero-length after trimming (${preD || 0}s)`, { type: 'empty_audio' });
    const chars = [...lines[i].hl].length;
    const want = lines[i].tempo ?? spec.tempo ?? 1.0;
    const tempo = Math.round((want < 1 ? want : Math.max(1.0, Math.min(want, (15.5 * preD) / chars))) * 1000) / 1000;
    ff(['-i', raw, '-af', `${TRIM}${tempo !== 1 ? `,atempo=${tempo}` : ''},aresample=${SR}`, '-ac', '1', '-c:a', 'pcm_s16le', trim]);
    const d = dur(trim);
    if (!(d > 0.05)) throw new KalpaError(`line ${i}: processed clip has zero length`, { type: 'empty_audio' });
    clips.push({ file: trim, d });
  }

  // 3. layout
  let t = spec.lead_s ?? 0.12;
  const lead = t;
  const layout = [];
  for (let i = 0; i < lines.length; i++) {
    layout.push({ i, start_s: r3(t), end_s: r3(t + clips[i].d) });
    t += clips[i].d + (lines[i].gap ?? spec.gap ?? 0.3);
  }
  const lastEnd = layout[layout.length - 1].end_s;
  const total = r3(lastEnd + (spec.tail_s ?? 1.6));

  // 4. concat with exact silences -> tmp, validate, rename later
  const silences = {};
  const sil = (d) => { const k = d.toFixed(3); if (!silences[k]) { const f = path.join(cache, `sil_${k}.wav`); ff(['-f', 'lavfi', '-i', `anullsrc=r=${SR}:cl=mono`, '-t', k, '-c:a', 'pcm_s16le', f]); silences[k] = f; } return silences[k]; };
  const parts = [sil(lead)];
  for (let i = 0; i < lines.length; i++) {
    parts.push(clips[i].file);
    parts.push(sil(i < lines.length - 1 ? (lines[i].gap ?? spec.gap ?? 0.3) : (total - lastEnd)));
  }
  const listFile = path.join(cache, 'concat.txt');
  fs.writeFileSync(listFile, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
  const vo = path.join(proj, 'voiceover.wav');
  const voTmp = path.join(proj, `voiceover.${process.pid}.tmp.wav`);
  const tlTmp = path.join(proj, `timeline.${process.pid}.tmp.json`);
  try {
    ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-c:a', 'pcm_s16le', '-ar', String(SR), '-ac', '1', voTmp]);
    const voD = dur(voTmp);
    if (!(voD > 0)) throw new KalpaError('voiceover.wav has zero length', { type: 'empty_audio' });

    // 5. words per line aligned inside that clip's real window
    const words = [];
    for (const L of layout) {
      const clip = clips[L.i];
      const spans = detectVoicedSpans('ffmpeg', clip.file, clip.d).map(([a, b]) => [a + L.start_s, b + L.start_s]);
      const ws = lines[L.i].hl.split(/\s+/).filter(Boolean).map((w) => ({ word: w, start_s: L.start_s, end_s: L.end_s, speaker: `L${L.i}` }));
      for (const w of alignWordsToVoicedSpans(ws, spans)) words.push({ ...w, line: L.i });
    }
    let caps = rechunkCaptions(words, total, { maxChars: 30, maxMergedChars: 60, maxCps: 17, lead: 0.08, holdAfterS: 0.35 });
    caps = caps.map((c) => ({ ...c, line: Number(c.speaker.slice(1)), speaker: 'NARRATOR' }));
    for (const w of words) w.speaker = 'NARRATOR';

    // 6. scenes from consecutive line groups
    const order = [];
    for (const L of layout) { const sc = lines[L.i].sc; const last = order[order.length - 1]; if (!last || last.id !== sc) order.push({ id: sc, lines: [] }); order[order.length - 1].lines.push(L); }
    const meta = spec.scenes_meta || {};
    const scenes = order.map((s, k) => {
      const start = k === 0 ? 0 : r3(s.lines[0].start_s - 0.1);
      const end = k === order.length - 1 ? total : r3(order[k + 1].lines[0].start_s - 0.1);
      const d = end - start;
      const nb = Math.max(1, Math.round(d / 2.2));
      const beats = Array.from({ length: nb }, (_, b) => ({
        t_s: r3(start + (d * b) / nb), dur_s: r3(d / nb), hold: false, flashes_per_sec: meta[s.id]?.flashes ?? 0,
        animated_properties: ['camera.push', 'flicker.light', 'grain.seed', ...(meta[s.id]?.props || [])]
      }));
      return { id: s.id, start_s: start, end_s: end, mood: meta[s.id]?.mood || 'suspense', ambient_motion: true, lines: s.lines.map((l) => ({ i: l.i, start_s: l.start_s, end_s: l.end_s })), beats };
    });

    // 7. sfx cues
    const audio_cues = [];
    for (const L of layout) for (const s of lines[L.i].sfx || []) {
      const base = s.at === 'end' ? L.end_s : L.start_s;
      audio_cues.push({ type: 'sfx', name: s.name, t_s: r3(Math.max(0, Math.min(total - 0.2, base + (s.dt || 0)))), gain_db: s.gain_db ?? -6, ...(s.scare ? { scare: true } : {}) });
    }
    for (const s of spec.extra_sfx || []) audio_cues.push({ type: 'sfx', name: s.name, t_s: s.t_s === 'end' ? r3(total - (s.before_end ?? 1)) : s.t_s, gain_db: s.gain_db ?? -6 });

    const timeline = {
      version: '1.0', slug: path.basename(proj), aspect: '9:16', width: 1080, height: 1920, fps: 30, duration_s: total,
      target_lufs: -14, true_peak_dbtp: -1.5, audio_file: 'voiceover.wav',
      tts: { provider: 'kalpa-labs', model, voice, temperature, sample_rate: sampleRate },
      alignment: { method: 'voiced-span-weighted', line_anchored: true, note: 'One TTS clip per line, so line windows are exact; word timing inside a line is voiced-span weighted (Kalpa gives no word timestamps).' },
      events: computeEvents(layout, lines),
      scenes, words, captions: caps, audio_cues
    };
    fs.writeFileSync(tlTmp, JSON.stringify(timeline, null, 1));
    fs.renameSync(voTmp, vo);
    fs.renameSync(tlTmp, path.join(proj, 'timeline.json'));
    return { duration_s: total, lines: layout.length, calls_made: synthed.filter((s) => !s.cached).length, cache_hits: synthed.filter((s) => s.cached).length, line_durations_s: clips.map((c) => r3(c.d)), scenes: scenes.map((s) => `${s.id} ${s.start_s}-${s.end_s}`), captions: caps.length, events: Object.keys(timeline.events).length };
  } finally {
    fs.rmSync(voTmp, { force: true });
    fs.rmSync(tlTmp, { force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const pi = a.indexOf('--project');
  if (pi < 0 || !a[pi + 1]) { console.error('Usage: build_vo.mjs --project <dir> [--force] [--dry-run]'); process.exit(2); }
  try {
    try { (await import('./audio_timeline.mjs')).loadTtsEnv?.(); } catch { /* optional */ }
    const dry = a.includes('--dry-run');
    if (!dry && !process.env.KALPA_API_KEY) { console.error('KALPA_API_KEY missing (put it in ~/.config/code-video-studio/tts.env)'); process.exit(2); }
    console.log(JSON.stringify(await buildVo(a[pi + 1], { force: a.includes('--force'), dryRun: dry }), null, 1));
  } catch (e) {
    console.error(`build_vo failed: ${e.message}`);
    process.exit(e.cause?.type === 'allowance_exhausted' ? 3 : 1);
  }
}
