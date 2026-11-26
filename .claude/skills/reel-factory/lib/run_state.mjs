// run.json: per-project stage state, input hashes and approvals (used by scripts/reel.mjs and the render lock).
// Writes are atomic (tmp + rename). Hashes are sha256 over file bytes, never over mtimes.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const RUN_FILE = 'run.json';
export const RUN_VERSION = 1;
// What an approval covers. Script: the words. Visual: the picture and its timing.
export const SCRIPT_FILES = ['lines.json', 'brief.json', 'script.txt']; // script.txt only if present
export const VISUAL_FILES = ['scene.mjs', 'timeline.json'];

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// sha256 over "name:filehash" lines for every file in `files` (absent files contribute "absent"), order-fixed.
export function hashFiles(dir, files) {
  const h = crypto.createHash('sha256');
  for (const f of files) {
    let part = 'absent';
    try { part = sha(fs.readFileSync(path.join(dir, f))); } catch { /* absent */ }
    h.update(`${f}:${part}\n`);
  }
  return h.digest('hex');
}
export const hashString = (s) => sha(Buffer.from(String(s)));
export const scriptHash = (dir) => hashFiles(dir, SCRIPT_FILES);
export const visualHash = (dir) => hashFiles(dir, VISUAL_FILES);

export function runPath(dir) { return path.join(dir, RUN_FILE); }

export function readRun(dir) {
  try { return JSON.parse(fs.readFileSync(runPath(dir), 'utf8')); } catch { return null; }
}

// Atomic write: temp file in the same directory, then rename. A crash leaves the old run.json intact.
export function writeRun(dir, run) {
  const tmp = path.join(dir, `.${RUN_FILE}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(run, null, 2) + '\n');
    fs.renameSync(tmp, runPath(dir));
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

export function newRun(extra = {}) {
  return { version: RUN_VERSION, created_at: new Date().toISOString(), unreviewed: false, approvals: {}, stages: {}, ...extra };
}

export function approve(dir, which) {
  const run = readRun(dir);
  if (!run) throw new Error(`no ${RUN_FILE} in ${dir}: run reel.mjs init first`);
  const sha256 = which === 'script' ? scriptHash(dir) : which === 'visual' ? visualHash(dir) : null;
  if (!sha256) throw new Error('approve target must be "script" or "visual"');
  run.approvals = run.approvals || {};
  run.approvals[which] = { sha256, at: new Date().toISOString(), files: which === 'script' ? SCRIPT_FILES : VISUAL_FILES };
  writeRun(dir, run);
  return run.approvals[which];
}

// Returns null when fine (or no run.json / no script approval: backward compatible), else the error message.
export function scriptApprovalProblem(dir) {
  const run = readRun(dir);
  const ap = run?.approvals?.script;
  if (!ap?.sha256) return null;
  if (scriptHash(dir) === ap.sha256) return null;
  return `script changed after approval: re-approve with reel.mjs approve ${dir} script`;
}
