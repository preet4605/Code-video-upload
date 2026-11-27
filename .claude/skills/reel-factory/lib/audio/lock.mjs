// sound.lock.json: the resolved result of the explicit fetch step (scripts/sfx_fetch.mjs). Render, --check and the audit read ONLY this
// (plus the files under audio/library/), so a deterministic re-render never needs the network or earshot.
//   { version:1, entries:{ <cueId>: { query, source, chosen:<index>, file, licence, candidates:[{file, licence, score, ...}], fetched_at } } }
import fs from 'node:fs';
import path from 'node:path';

export const LOCK_NAME = 'sound.lock.json';
export const lockPath = (projectDir) => path.join(projectDir, LOCK_NAME);

export function readLock(projectDir) {
  try { const j = JSON.parse(fs.readFileSync(lockPath(projectDir), 'utf8')); return j && typeof j === 'object' && j.entries ? j : { version: 1, entries: {} }; } catch { return { version: 1, entries: {} }; }
}

export function writeLock(projectDir, lock) {
  const p = lockPath(projectDir); const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(lock, null, 2) + '\n'); fs.renameSync(tmp, p);
}

// Fill `file` + `licence` of query cues from the lock. A cue's own file/licence always wins. Marks a stale lock (query changed) on the cue.
export function applyLock(sound, lock) {
  if (!lock?.entries || !Array.isArray(sound?.cues)) return sound;
  for (const c of sound.cues) {
    const e = lock.entries[c?.id];
    if (!e || c.file) continue;
    if (c.query !== undefined && e.query !== undefined && e.query !== c.query) { c._lock_stale = { locked: e.query, now: c.query }; continue; }
    c.file = e.file; if (c.licence === undefined) c.licence = e.licence;
    c._lock = { chosen: e.chosen ?? 0, candidates: (e.candidates || []).length };
  }
  return sound;
}
