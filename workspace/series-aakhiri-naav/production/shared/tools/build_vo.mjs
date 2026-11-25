#!/usr/bin/env node
// Build voiceover.wav + timeline.json for one project (adapted from the pilot's build_vo for code-video-studio V6.1).
// Input: <proj>/script.txt (tagged) + <proj>/vo.json { voice, temperature, tempo, gap, fx:{ "<line idx>": "lake|lakeown|whisper" }, gaps:{ "<idx>": seconds }, extra:[{name,text,temperature}] }
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const STUDIO = '/mnt/project-files/skills/code-video-studio-v6.1';
const { alignWordsToVoicedSpans, detectVoicedSpans, rechunkCaptions } = await import(`${STUDIO}/lib/align.mjs`);

const proj = path.resolve(process.argv[2]);
const force = process.argv.includes('--force');
const cfg = JSON.parse(fs.readFileSync(path.join(proj, 'vo.json'), 'utf8'));
const script = fs.readFileSync(path.join(proj, 'script.txt'), 'utf8');
const cache = path.join(proj, 'cache', 'vo');
fs.mkdirSync(cache, { recursive: true });
const KEY = process.env.KALPA_API_KEY;
if (!KEY) { console.error('KALPA_API_KEY missing'); process.exit(2); }
const SR = 48000;
const r3 = (n) => Math.round(n * 1000) / 1000;
const ff = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status) throw new Error(r.stderr.slice(-600)); return r; };
const dur = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim());

// parse script: scenes, lines, silences, sfx, scare
const lines = []; const scenes = []; let curScene = null; const sfx = []; let scare = null; const silAfter = {};
for (const raw of script.split(/\r?\n/)) {
  const l = raw.trim(); if (!l) continue;
  let m;
  if ((m = l.match(/^\[SCENE\s+([^\]]*)\]/))) { curScene = (m[1].match(/id=(\S+)/) || [])[1]; const mood = (m[1].match(/mood=(\S+)/) || [])[1] || 'suspense'; scenes.push({ id: curScene, mood }); continue; }
  if ((m = l.match(/^\[SILENCE(?:\s+([^\]]*))?\]/))) { silAfter[lines.length - 1] = Number(((m[1] || '').match(/dur=([0-9.]+)/) || [])[1] || 1); continue; }
  if ((m = l.match(/^\[SFX\s+([^\]]*)\]/))) { sfx.push({ name: (m[1].match(/name=(\S+)/) || [])[1], line: lines.length }); continue; }
  if ((m = l.match(/^\[SCARE\s+([^\]]*)\]/))) { scare = { name: (m[1].match(/name=(\S+)/) || [])[1], afterLine: lines.length - 1 }; continue; }
  if ((m = l.match(/^\[(NARRATOR|CHARACTER|WHISPER)\]\s*(.*)$/))) lines.push({ speaker: m[1], text: m[2], sc: curScene });
}
async function tts(text, out, temperature) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`https://api.kalpalabs.ai/v1/tts/${cfg.voice}`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, sample_rate: 48000, params: { temperature } }) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      const j = await res.json(); const b64 = j?.audio?.data_b64; if (!b64) throw new Error('no audio');
      fs.writeFileSync(out, Buffer.from(b64, 'base64')); return;
    } catch (e) { console.error(`tts attempt ${attempt}: ${e.message}`); if (attempt === 4) throw e; await new Promise((r) => setTimeout(r, 1500 * attempt)); }
  }
}
const need = [...lines.map((ln, i) => ({ id: `l${String(i).padStart(2, '0')}`, text: ln.text, temp: cfg.temperature })), ...(cfg.extra || []).map((e) => ({ id: `x_${e.name}`, text: e.text, temp: e.temperature ?? cfg.temperature }))];
await Promise.all(need.map(async (n) => {
  const raw = path.join(cache, `${n.id}_raw.wav`), tag = path.join(cache, `${n.id}.txt`), key = `${cfg.voice}|${n.temp}|${n.text}`;
  if (force || !fs.existsSync(raw) || !fs.existsSync(tag) || fs.readFileSync(tag, 'utf8') !== key) { await tts(n.text, raw, n.temp); fs.writeFileSync(tag, key); }
}));
const TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse';
const FX = {
  // the lake's kind voice: his own voice, a little higher, a little late, a cold tail, tiny word-join dropouts
  lake: 'rubberband=pitch=1.1225,highpass=f=150,lowpass=f=5200,aecho=0.8:0.55:700|1400:0.28|0.14,volume=enable=\'between(t,0.62,0.66)+between(t,1.21,1.25)+between(t,1.83,1.87)\':volume=0',
  lakechild: 'rubberband=pitch=1.335,highpass=f=220,lowpass=f=5600,aecho=0.8:0.55:700|1400:0.3|0.15',
  lakeown: 'highpass=f=120,lowpass=f=6500,aecho=0.8:0.5:600|1200:0.22|0.10'
};
const clips = [];
for (let i = 0; i < lines.length; i++) {
  const id = `l${String(i).padStart(2, '0')}`;
  const raw = path.join(cache, `${id}_raw.wav`), out = path.join(cache, `${id}.wav`);
  const tempo = cfg.tempoByLine?.[i] ?? cfg.tempo ?? 1;
  ff(['-i', raw, '-af', `${TRIM}${tempo !== 1 ? `,atempo=${tempo}` : ''},aresample=${SR}`, '-ac', '1', '-c:a', 'pcm_s16le', out]);
  const fx = cfg.fx?.[i];
  if (fx && FX[fx]) {
    const o2 = path.join(cache, `${id}_fx.wav`);
    // pad the tail so echo tails are not cut, then keep the fx file as the clip
    ff(['-i', out, '-af', `apad=pad_dur=1.6,${FX[fx]}`, '-ac', '1', '-c:a', 'pcm_s16le', o2]);
    fs.copyFileSync(o2, out);
  }
  clips.push({ file: out, d: dur(out), dryD: dur(out) });
}
// layout: line windows use the DRY speech length (echo tails overlap the following gap)
const dryDur = clips.map((c, i) => (cfg.fx?.[i] ? c.d - 1.6 : c.d));
const lead = cfg.lead_s ?? 0.12;
let t = lead; const layout = [];
for (let i = 0; i < lines.length; i++) {
  layout.push({ i, start_s: r3(t), end_s: r3(t + dryDur[i]) });
  const sil = silAfter[i] ?? 0;
  t += dryDur[i] + (cfg.gaps?.[i] ?? cfg.gap ?? 0.4) + sil;
}
const lastEnd = layout[layout.length - 1].end_s;
const total = r3(lastEnd + (cfg.tail_s ?? 1.4));
// mix clips onto a timeline (amix of delayed clips so echo tails may overlap)
const args = []; const chains = [];
clips.forEach((c, i) => { args.push('-i', c.file); chains.push(`[${i}:a]aformat=sample_rates=${SR}:channel_layouts=mono,adelay=${Math.round(layout[i].start_s * 1000)}[c${i}]`); });
const mix = clips.map((_, i) => `[c${i}]`).join('') + `amix=inputs=${clips.length}:normalize=0:duration=longest,apad,atrim=0:${total.toFixed(3)}[out]`;
const vo = path.join(proj, 'voiceover.wav');
ff([...args, '-filter_complex', chains.join(';') + ';' + mix, '-map', '[out]', '-ar', String(SR), '-ac', '1', '-c:a', 'pcm_s16le', vo]);
// words per line (Devanagari)
const words = [];
for (const L of layout) {
  const clip = clips[L.i];
  const spans = detectVoicedSpans('ffmpeg', clip.file, clip.d).map(([a, b]) => [a + L.start_s, b + L.start_s]).filter(([a]) => a < L.end_s + 0.05);
  const ws = lines[L.i].text.split(/\s+/).filter(Boolean).map((w) => ({ word: w, start_s: L.start_s, end_s: L.end_s, speaker: `L${L.i}` }));
  for (const w of alignWordsToVoicedSpans(ws, spans)) words.push({ ...w, line: L.i });
}
let caps = rechunkCaptions(words, total, { maxChars: 30, maxMergedChars: 60, maxCps: 17, lead: 0.08, holdAfterS: 0.35 });
caps = caps.map((c) => ({ ...c, line: Number(c.speaker.slice(1)), speaker: lines[Number(c.speaker.slice(1))].speaker }));
for (const w of words) w.speaker = lines[w.line].speaker;
// scenes
const order = [];
for (const L of layout) { const sc = lines[L.i].sc; const last = order[order.length - 1]; if (!last || last.id !== sc) order.push({ id: sc, lines: [] }); order[order.length - 1].lines.push(L); }
const moodOf = Object.fromEntries(scenes.map((s) => [s.id, s.mood]));
const tscenes = order.map((s, k) => {
  const start = k === 0 ? 0 : r3(s.lines[0].start_s - 0.1);
  const end = k === order.length - 1 ? total : r3(order[k + 1].lines[0].start_s - 0.1);
  const d = end - start, nb = Math.max(1, Math.round(d / 2.2));
  const beats = Array.from({ length: nb }, (_, b) => ({ t_s: r3(start + (d * b) / nb), dur_s: r3(d / nb), hold: false, flashes_per_sec: 0, animated_properties: ['camera.push', 'flicker.light', 'grain.seed', 'water.ripple'] }));
  return { id: s.id, start_s: start, end_s: end, mood: moodOf[s.id] || 'suspense', ambient_motion: true, lines: s.lines.map((l) => ({ i: l.i, start_s: l.start_s, end_s: l.end_s })), beats };
});
const audio_cues = sfx.map((s) => ({ type: 'sfx', name: s.name, t_s: r3(layout[Math.min(s.line, layout.length - 1)].start_s), gain_db: -6 }));
if (scare) audio_cues.push({ type: 'sfx', name: scare.name, t_s: r3(layout[scare.afterLine].end_s + (silAfter[scare.afterLine] || 0) + (cfg.scare_dt ?? 0.15)), gain_db: 0, scare: true });
const timeline = { version: '1.0', slug: path.basename(proj), aspect: '9:16', width: 1080, height: 1920, fps: 30, duration_s: total, target_lufs: -14, true_peak_dbtp: -1.5, audio_file: 'voiceover.wav',
  alignment: { method: 'voiced-span-weighted', line_anchored: true, note: 'One TTS clip per line; word timing inside a line is voiced-span weighted.' },
  scenes: tscenes, lines: lines.map((l, i) => ({ i, speaker: l.speaker, text: l.text, start_s: layout[i].start_s, end_s: layout[i].end_s })), words, captions: caps, audio_cues };
fs.writeFileSync(path.join(proj, 'timeline.json'), JSON.stringify(timeline, null, 1));
console.log(JSON.stringify({ duration_s: total, lines: layout.map((l) => `${l.i}:${l.start_s}-${l.end_s}`), scenes: tscenes.map((s) => `${s.id} ${s.start_s}-${s.end_s}`), captions: caps.length }));
