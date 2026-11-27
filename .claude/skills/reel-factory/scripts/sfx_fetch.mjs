#!/usr/bin/env node
// EXPLICIT fetch step for real-recording cues. Render, --check and the audit never fetch; they read sound.lock.json + audio/library/.
//
//   node scripts/sfx_fetch.mjs --project <dir> [--dry-run] [--pick N] [--refresh] [--use <cueId>=<k>] [--cache-dir <d>] [--json]
//
// Handles cues in <dir>/sound.json that have no "file" and either
//   source "library" + "query"                     Openverse (cc0 / pdm / by only), ranked, top N downloaded to <dir>/audio/library/
//   source "library" + "query" + "library_index"   your own folder, indexed by scripts/sfx_index.mjs (no network)
//   source "earshot" (or generated + provider earshot) + "query" or params.sound   rendered locally by the earshot CLI
// Writes <dir>/sound.lock.json (chosen file + licence + the candidate list; swap with --use cue=k, offline) and <dir>/CREDITS.txt.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readLock, writeLock } from '../lib/audio/lock.mjs';
import { writeCredits } from '../lib/audio/credits.mjs';
import { eventsFor } from '../lib/audio/cues.mjs';
import { makeClock } from '../lib/events.mjs';
import * as openverse from '../lib/audio/sources/openverse.mjs';
import { rank } from '../lib/audio/sources/rank.mjs';
import { isEarshotCue, resolveGenerated, findEarshot, earshotEnabled } from '../lib/audio/providers.mjs';
import { resolveBin } from '../lib/runtime.mjs';

function parseArgs(argv) {
  const o = { project: null, dryRun: false, pick: 3, refresh: false, use: [], cacheDir: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') o.project = argv[++i]; else if (a === '--dry-run') o.dryRun = true; else if (a === '--pick') o.pick = Number(argv[++i]);
    else if (a === '--refresh') o.refresh = true; else if (a === '--use') o.use.push(argv[++i]); else if (a === '--cache-dir') o.cacheDir = argv[++i]; else if (a === '--json') o.json = true;
  }
  return o;
}

function spanOf(cue, timeline) { // seconds a bed has to fill, or null
  try {
    const ev = eventsFor(timeline); if (!Object.keys(ev.events).length && (typeof cue.at === 'string' || typeof cue.until === 'string')) return null;
    const clock = Object.keys(ev.events).length ? makeClock({ events: ev.events }) : null;
    const t = (v, off) => (typeof v === 'number' ? v : clock.at(v)) + (off || 0);
    return cue.until !== undefined ? t(cue.until, cue.until_offset_s) - t(cue.at, cue.offset_s) : null;
  } catch { return null; }
}

const candOf = (file, licence, extra = {}) => ({ file, licence, ...extra });

export async function runSfxFetch(o, deps = {}) {
  const dir = path.resolve(o.project); const log = deps.log || (() => {});
  const sound = JSON.parse(fs.readFileSync(path.join(dir, 'sound.json'), 'utf8'));
  let timeline = null; try { timeline = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8')); } catch { /* optional */ }
  const lock = readLock(dir); lock.version = 1;
  const cacheDir = o.cacheDir || deps.cacheDir || openverse.defaultCacheDir();
  const ov = deps.openverse || openverse;
  const ffmpeg = deps.ffmpeg || resolveBin('ffmpeg'), ffprobe = deps.ffprobe || resolveBin('ffprobe');
  const summary = { project: dir, dry_run: Boolean(o.dryRun), fetched: [], skipped: [], errors: [], swapped: [] };

  for (const u of o.use || []) { // offline swap to another stored candidate
    const [id, k] = String(u).split('='); const e = lock.entries[id]; const c = e?.candidates?.[Number(k)];
    if (!e || !c) { summary.errors.push(`--use ${u}: no such cue/candidate in sound.lock.json`); continue; }
    e.chosen = Number(k); e.file = c.file; e.licence = c.licence; summary.swapped.push({ id, chosen: e.chosen, file: e.file });
  }

  const todo = [];
  for (const c of sound.cues || []) {
    if (!c?.id || c.file) continue;
    const isE = isEarshotCue(c); const isLib = c.source === 'library' && c.query;
    if (!isE && !isLib) continue;
    const e = lock.entries[c.id];
    const have = e && (e.query ?? null) === (c.query ?? null) && e.file && (e.file.startsWith('/') || fs.existsSync(path.join(dir, e.file)));
    if (have && !o.refresh) { summary.skipped.push({ id: c.id, reason: 'already in sound.lock.json' }); continue; }
    todo.push(c);
  }

  if (o.dryRun) {
    summary.plan = todo.map((c) => ({ id: c.id, kind: isEarshotCue(c) ? 'earshot' : c.library_index ? 'local-index' : 'openverse', query: c.query ?? c.params?.sound, span_s: spanOf(c, timeline), pick: o.pick }));
    summary.earshot = todo.some(isEarshotCue) ? { enabled: earshotEnabled(), found: findEarshot() } : undefined;
    return summary;
  }

  let stop = null;
  for (const c of todo) {
    if (stop) { summary.errors.push(`${c.id}: not fetched (${stop})`); continue; }
    try {
      const span = spanOf(c, timeline);
      let entry;
      if (isEarshotCue(c)) {
        const r = (deps.resolveGenerated || resolveGenerated)(c, { projectDir: dir, durS: span, ...(deps.earshotCtx || {}) });
        entry = { query: c.query, source: 'earshot', chosen: 0, file: r.file, licence: r.licence, candidates: [candOf(r.file, r.licence, { design: r.meta?.design, guessed_pick: r.meta?.guessed_pick })] };
      } else if (c.library_index) {
        const idx = JSON.parse(fs.readFileSync(path.resolve(dir, c.library_index), 'utf8'));
        const items = idx.entries.map((x) => ({ id: x.id, title: x.rel, tags: x.tags, duration_s: x.duration_s, licence_id: String(x.licence?.id || '').toLowerCase(), preview: false, raw: x }));
        const ranked = rank(items, { query: c.query, cueTags: c.tags || [], wantDurS: c.want_dur_s ?? span, isBed: span !== null }).slice(0, Math.max(1, o.pick || 3));
        if (!ranked.length) throw new Error(`no match in ${c.library_index}`);
        // copy/convert into the project (48 kHz stereo WAV) so the project stays self-contained and renders without the library mounted
        const cands = ranked.map((r, k) => {
          const x = r.it.raw; const rel = `audio/library/${c.id}_${k}_${x.sha256.slice(0, 8)}.wav`; fs.mkdirSync(path.join(dir, 'audio/library'), { recursive: true });
          const cv = spawnSync(ffmpeg, ['-v', 'error', '-y', '-i', x.path, '-vn', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', path.join(dir, rel)], { encoding: 'utf8' });
          if (cv.status !== 0) throw new Error(`cannot convert ${x.path}: ${(cv.stderr || '').slice(0, 160)}`);
          return candOf(rel, x.licence ?? null, { score: r.score, parts: r.parts, duration_s: x.duration_s, sha256: x.sha256, original: x.path });
        });
        entry = { query: c.query, source: 'local-index', chosen: 0, file: cands[0].file, licence: cands[0].licence, candidates: cands };
      } else {
        const sr = await ov.search(c.query, { licences: c.licences || openverse.DEFAULT_LICENCES, minDurationS: c.min_dur_s ?? 0, maxDurationS: c.max_dur_s ?? Infinity }, { cacheDir, ...(deps.net || {}) });
        if (!sr.results.length) throw new Error(`Openverse returned nothing usable for "${c.query}" (${sr.total_returned} result(s); licences rejected: ${JSON.stringify(sr.rejected_licences)})`);
        const items = sr.results.map((r) => ({ id: r.id, title: r.title, tags: (r.tags || []).map((t) => (typeof t === 'string' ? t : t?.name)), duration_s: Number(r.duration) / 1000, licence_id: String(r.license).toLowerCase(), preview: openverse.isPreview(r), raw: r }));
        const ranked = rank(items, { query: c.query, cueTags: c.tags || [], wantDurS: c.want_dur_s ?? span, isBed: span !== null });
        const cands = []; const failed = [];
        for (const r of ranked) {
          if (cands.length >= Math.max(1, o.pick || 3)) break;
          try {
            const d = await ov.download(r.it.raw, { cacheDir, ffmpeg, ffprobe }, deps.net || {});
            const rel = `audio/library/${c.id}_${cands.length}_${d.sha256.slice(0, 8)}.wav`;
            fs.mkdirSync(path.join(dir, 'audio/library'), { recursive: true }); fs.copyFileSync(d.wav, path.join(dir, rel));
            cands.push(candOf(rel, d.licence, { score: r.score, parts: r.parts, matched: r.matched, duration_s: Math.round(d.duration_s * 1000) / 1000, title: r.it.title, cache_hit: d.cache_hit, quality: d.quality, ...(d.original_error ? { original_error: d.original_error } : {}) }));
          } catch (e) { if (e instanceof openverse.RateLimitError) throw e; failed.push({ title: r.it.title, error: e.message }); }
        }
        if (!cands.length) throw new Error(`all ${ranked.length} candidate(s) failed validation/download for "${c.query}": ${JSON.stringify(failed.slice(0, 3))}`);
        entry = { query: c.query, source: 'openverse', chosen: 0, file: cands[0].file, licence: cands[0].licence, candidates: cands, ...(failed.length ? { rejected_downloads: failed } : {}) };
      }
      entry.fetched_at = new Date().toISOString(); lock.entries[c.id] = entry;
      summary.fetched.push({ id: c.id, source: entry.source, file: entry.file, licence: entry.licence?.name ?? entry.licence, candidates: entry.candidates.length });
    } catch (e) {
      summary.errors.push(`${c.id}: ${e.message}`);
      if (e instanceof openverse.RateLimitError) stop = 'rate limited';
    }
  }

  if (summary.fetched.length || summary.swapped.length) writeLock(dir, lock);
  const items = Object.values(lock.entries).filter((e) => e.file).map((e) => ({ file: e.file, title: e.candidates?.[e.chosen ?? 0]?.title ?? e.licence?.title, licence: e.licence }));
  if (items.length && (summary.fetched.length || summary.swapped.length)) summary.credits = writeCredits(dir, items);
  summary.ok = summary.errors.length === 0;
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const o = parseArgs(process.argv.slice(2));
  if (!o.project) { console.error('usage: sfx_fetch.mjs --project <dir> [--dry-run] [--pick N] [--refresh] [--use cue=k] [--cache-dir d] [--json]'); process.exit(2); }
  try {
    const r = await runSfxFetch(o, { log: (m) => console.error(m) });
    if (o.json) console.log(JSON.stringify(r, null, 2));
    else {
      if (r.dry_run) { console.log(`DRY RUN (no network, nothing written): ${r.plan.length} cue(s) to resolve`); for (const p of r.plan) console.log(` - ${p.id}: ${p.kind} "${p.query}"${p.span_s ? ` span ${p.span_s.toFixed(1)} s` : ''}, top ${p.pick}`); if (r.earshot) console.log(` earshot: enabled=${r.earshot.enabled} found=${r.earshot.found ? r.earshot.found.version : 'no'}`); }
      for (const f of r.fetched) console.log(`FETCHED ${f.id} -> ${f.file} [${f.licence}] (${f.candidates} candidate(s))`);
      for (const s of r.swapped) console.log(`SWAPPED ${s.id} -> candidate ${s.chosen} (${s.file})`);
      for (const s of r.skipped) console.log(`skip ${s.id}: ${s.reason}`);
      for (const e of r.errors) console.error(`ERROR ${e}`);
      if (r.credits) console.log(`CREDITS ${r.credits}`);
    }
    process.exit(r.errors.length ? 1 : 0);
  } catch (e) { console.error(`sfx_fetch: ${e.message}`); process.exit(1); }
}
