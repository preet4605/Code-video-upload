#!/usr/bin/env node
// Index your OWN sound library so cues can use it: node scripts/sfx_index.mjs --dir <folder> [--out <index.json>]
// Writes {path, rel, duration_s, sample_rate, channels, lufs, peak_dbfs, tags (from file/folder names), sha256, licence} per file.
// Licence you fill (first hit wins): <file>.licence.json | <folder>/licences.json  {"<relative path|filename>": <licence>, "default": <licence>}.
// A file without a licence is indexed with licence:null; a cue that picks it fails at sound_design time (a missing licence is an error).
// Cue: { "source":"library", "layer":"sfx", "kind":"door", "query":"coach door slam", "library_index":"audio/my_index.json", "at":... }, then scripts/sfx_fetch.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildIndex } from '../lib/audio/sources/localindex.mjs';
import { resolveBin } from '../lib/runtime.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const a = process.argv.slice(2); const get = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const dir = get('--dir'); if (!dir) { console.error('usage: sfx_index.mjs --dir <folder> [--out <index.json>]'); process.exit(2); }
  try {
    const idx = buildIndex(dir, { ffmpeg: resolveBin('ffmpeg'), ffprobe: resolveBin('ffprobe') });
    const out = path.resolve(get('--out') || path.join(dir, 'sfx_index.json')); fs.writeFileSync(out, JSON.stringify(idx, null, 2) + '\n');
    const nolic = idx.entries.filter((e) => !e.licence).length;
    console.log(`indexed ${idx.entries.length} file(s) -> ${out}${idx.skipped.length ? `; skipped ${idx.skipped.length} unreadable` : ''}${nolic ? `\nWARNING ${nolic} file(s) have no licence: fill <file>.licence.json or licences.json before using them (a cue without a licence is an error)` : ''}`);
    for (const s of idx.skipped) console.error(` skipped ${s.rel}: ${s.error}`);
  } catch (e) { console.error(`sfx_index: ${e.message}`); process.exit(1); }
}
