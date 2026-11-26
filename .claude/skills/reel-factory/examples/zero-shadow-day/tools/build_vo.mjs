#!/usr/bin/env node
// Build voiceover.wav + timeline.json for one reel project.
// Input: <project>/lines.json = { voice, temperature, tail_s, lines:[{sc, hi, hl, gap?, sfx?:[{name, at?:'start'|'end', dt?, gain_db?}]}], scenes_meta?:{id:{mood}} }
// Each line = one Kalpa TTS call (Devanagari spoken), Hinglish words aligned inside that clip's real window.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { alignWordsToVoicedSpans, detectVoicedSpans, rechunkCaptions } from '../../../lib/align.mjs';

const proj = path.resolve(process.argv[2]);
const force = process.argv.includes('--force');
const spec = JSON.parse(fs.readFileSync(path.join(proj, 'lines.json'), 'utf8'));
const cache = path.join(proj, 'cache', 'vo');
fs.mkdirSync(cache, { recursive: true });
const KEY = process.env.KALPA_API_KEY;
if (!KEY) { console.error('KALPA_API_KEY missing'); process.exit(2); }
const SR = 48000;
const r3 = (n) => Math.round(n * 1000) / 1000;
const ff = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status) throw new Error(r.stderr.slice(-600)); return r; };
const dur = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim());

async function tts(text, out) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`https://api.kalpalabs.ai/v1/tts/${spec.voice}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sample_rate: 48000, params: { temperature: spec.temperature ?? 0.7 } })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      const j = await res.json();
      const b64 = j?.audio?.data_b64;
      if (!b64) throw new Error('no audio in response');
      fs.writeFileSync(out, Buffer.from(b64, 'base64'));
      return;
    } catch (e) {
      console.error(`tts attempt ${attempt} failed: ${e.message}`);
      if (attempt === 4) throw e;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

const lines = spec.lines;
const clips = [];
await Promise.all(lines.map(async (ln, i) => {
  const raw = path.join(cache, `l${String(i).padStart(2, '0')}_raw.wav`);
  const tag = path.join(cache, `l${String(i).padStart(2, '0')}.txt`);
  const key = `${spec.voice}|${spec.temperature}|${ln.hi}`;
  if (force || !fs.existsSync(raw) || !fs.existsSync(tag) || fs.readFileSync(tag, 'utf8') !== key) {
    await tts(ln.hi, raw);
    fs.writeFileSync(tag, key);
  }
}));
for (let i = 0; i < lines.length; i++) {
  const id = String(i).padStart(2, '0');
  const raw = path.join(cache, `l${id}_raw.wav`);
  const trim = path.join(cache, `l${id}.wav`);
  // trimmed duration at 1x, then cap tempo so caption reading speed stays <= ~16 chars/s
  const pre = path.join(cache, `l${id}_pre.wav`);
  ff(['-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse', pre]);
  const chars = [...lines[i].hl].length;
  const want = lines[i].tempo ?? spec.tempo ?? 1.0;
  const tempo = Math.round((want < 1 ? want : Math.max(1.0, Math.min(want, (15.5 * dur(pre)) / chars))) * 1000) / 1000;
  // trim leading/trailing silence, resample, mono, optional tempo
  ff(['-i', raw, '-af', `silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse${tempo !== 1 ? `,atempo=${tempo}` : ''},aresample=${SR}`, '-ac', '1', '-c:a', 'pcm_s16le', trim]);
  if (lines[i].whisper) {
    const w = path.join(cache, `l${id}_w.wav`);
    const r = spawnSync('python3', ['-I', path.join(path.dirname(new URL(import.meta.url).pathname), 'whisperize.py'), trim, w], { encoding: 'utf8' });
    if (r.status) throw new Error(r.stderr);
    fs.copyFileSync(w, trim);
  }
  clips.push({ file: trim, d: dur(trim) });
}

// lay out
const lead = spec.lead_s ?? 0.12;
let t = lead;
const layout = [];
for (let i = 0; i < lines.length; i++) {
  layout.push({ i, start_s: r3(t), end_s: r3(t + clips[i].d) });
  t += clips[i].d + (lines[i].gap ?? spec.gap ?? 0.3);
}
const lastEnd = layout[layout.length - 1].end_s;
const total = r3(lastEnd + (spec.tail_s ?? 1.6));

// concat with exact silences
const parts = [];
const listFile = path.join(cache, 'concat.txt');
const silences = {};
const sil = (d) => { const k = d.toFixed(3); if (!silences[k]) { const f = path.join(cache, `sil_${k}.wav`); ff(['-f', 'lavfi', '-i', `anullsrc=r=${SR}:cl=mono`, '-t', k, '-c:a', 'pcm_s16le', f]); silences[k] = f; } return silences[k]; };
parts.push(sil(lead));
for (let i = 0; i < lines.length; i++) {
  parts.push(clips[i].file);
  const g = i < lines.length - 1 ? (lines[i].gap ?? spec.gap ?? 0.3) : (total - lastEnd);
  parts.push(sil(g));
}
fs.writeFileSync(listFile, parts.map((p) => `file '${p}'`).join('\n'));
const vo = path.join(proj, 'voiceover.wav');
ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-c:a', 'pcm_s16le', '-ar', String(SR), '-ac', '1', vo]);

// words per line, aligned to voiced spans of that clip
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

// scenes from line groups
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

// sfx cues
const audio_cues = [];
for (const L of layout) for (const s of lines[L.i].sfx || []) {
  const base = s.at === 'end' ? L.end_s : L.start_s;
  audio_cues.push({ type: 'sfx', name: s.name, t_s: r3(Math.max(0, Math.min(total - 0.2, base + (s.dt || 0)))), gain_db: s.gain_db ?? -6, ...(s.scare ? { scare: true } : {}) });
}
for (const s of spec.extra_sfx || []) audio_cues.push({ type: 'sfx', name: s.name, t_s: s.t_s === 'end' ? r3(total - (s.before_end ?? 1)) : s.t_s, gain_db: s.gain_db ?? -6 });

const timeline = {
  version: '1.0', slug: path.basename(proj), aspect: '9:16', width: 1080, height: 1920, fps: 30, duration_s: total,
  target_lufs: -14, true_peak_dbtp: -1.5, audio_file: 'voiceover.wav',
  alignment: { method: 'voiced-span-weighted', line_anchored: true, note: 'One TTS clip per line, so line windows are exact; word timing inside a line is voiced-span weighted.' },
  scenes, words, captions: caps, audio_cues
};
fs.writeFileSync(path.join(proj, 'timeline.json'), JSON.stringify(timeline, null, 1));
console.log(JSON.stringify({ duration_s: total, lines: layout.length, scenes: scenes.map((s) => `${s.id} ${s.start_s}-${s.end_s}`), captions: caps.length }, null, 1));
