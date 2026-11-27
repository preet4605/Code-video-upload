// Local library index (the user's OWN recordings): path, duration, loudness, filename tags, sha256, licence (from sidecars).
//   buildIndex(dir, {ffmpeg, ffprobe}) -> { version, root, generated_at, entries:[{id, path, rel, duration_s, sample_rate, channels, lufs, peak_dbfs, tags, sha256, licence|null}] }
// Licence sources, first hit wins: <file>.licence.json  >  <dir>/licences.json  { "<relative path or filename>": <licence> | "default": <licence> }.
// No licence = the entry is kept but licence:null; a cue that uses it fails at sound_design time (existing rule).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tokens } from './rank.mjs';

export const AUDIO_EXT = new Set(['.wav', '.flac', '.mp3', '.ogg', '.m4a', '.aif', '.aiff', '.opus']);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else if (e.isFile() && AUDIO_EXT.has(path.extname(e.name).toLowerCase())) yield p;
  }
}

export function measure(file, { ffmpeg = 'ffmpeg', ffprobe = 'ffprobe' } = {}) {
  const p = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type,sample_rate,channels:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  if (p.status !== 0) throw new Error(`ffprobe failed: ${(p.stderr || '').trim().slice(0, 160)}`);
  const j = JSON.parse(p.stdout); const a = (j.streams || []).find((s) => s.codec_type === 'audio'); const duration_s = Number(j.format?.duration);
  if (!a || !(duration_s > 0)) throw new Error('no decodable audio / zero duration');
  const e = spawnSync(ffmpeg, ['-nostats', '-hide_banner', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const txt = e.stderr || ''; const tail = txt.slice(txt.lastIndexOf('Summary:'));
  const num = (re) => { const m = tail.match(re); return m ? Number(m[1]) : null; };
  const lufs = num(/I:\s+(-?[\d.]+)\s+LUFS/), peak = num(/Peak:\s+(-?[\d.]+)\s+dBFS/);
  return { duration_s: Math.round(duration_s * 1000) / 1000, sample_rate: Number(a.sample_rate), channels: a.channels, lufs: Number.isFinite(lufs) ? lufs : null, peak_dbfs: Number.isFinite(peak) ? peak : null };
}

function licenceFor(file, root) {
  try { return JSON.parse(fs.readFileSync(`${file}.licence.json`, 'utf8')); } catch { /* none */ }
  const rel = path.relative(root, file).split(path.sep).join('/');
  for (let d = path.dirname(file); d.startsWith(root); d = path.dirname(d)) {
    try { const m = JSON.parse(fs.readFileSync(path.join(d, 'licences.json'), 'utf8')); const v = m[rel] ?? m[path.basename(file)] ?? m.default; if (v) return v; } catch { /* none */ }
    if (d === root) break;
  }
  return null;
}

export function buildIndex(dir, { ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', now = () => new Date().toISOString() } = {}) {
  const root = path.resolve(dir); const entries = []; const skipped = [];
  for (const f of walk(root)) {
    try {
      const m = measure(f, { ffmpeg, ffprobe }); const rel = path.relative(root, f).split(path.sep).join('/');
      const sha = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
      entries.push({ id: sha.slice(0, 12), path: f, rel, ...m, tags: [...new Set(tokens(rel.replace(/\.[^.]+$/, '')))], sha256: sha, licence: licenceFor(f, root) });
    } catch (e) { skipped.push({ rel: path.relative(root, f), error: e.message }); }
  }
  return { version: 1, root, generated_at: now(), entries, skipped };
}
