// Generated-audio adapters. resolveGenerated(cue, ctx) -> { file: <path relative to the project>, licence: {...}, meta }
//
//   earshot (Leonxlnx/earshot, MIT): cue.source "earshot" (or source "generated" + provider "earshot"). Local CLI, no network, no model.
//     Detected via EARSHOT_BIN or `earshot` on PATH. Disable with REEL_EARSHOT=off. Same version + design + seed + duration -> same samples (verified).
//     Rendering happens in the explicit step (scripts/sfx_fetch.mjs) and is recorded in sound.lock.json; render itself never calls earshot.
//   anything else: still no paid provider; throws `no provider configured`.
//
// Licence basis (checked 2026-11-27 against the repo's README and the four data/*/CREDITS.md + docs/CREDITS_FIT.md): "Everything earshot renders ...
// belongs to whoever rendered it: free for any use, commercial too, without credit"; the recordings behind learned sounds are "all CC0 or an
// explicit public-domain dedication". Author-declared, not independently verified per recording: see references/sound.md.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const EARSHOT_LICENCE = 'rendered output (MIT tool); parts per CREDITS.md';
export const EARSHOT_URL = 'https://github.com/Leonxlnx/earshot';
export const isEarshotCue = (cue) => cue?.source === 'earshot' || (cue?.source === 'generated' && String(cue?.provider || '').toLowerCase() === 'earshot');

const defaultRun = (bin, args) => spawnSync(bin, args, { encoding: 'utf8', timeout: 180000, maxBuffer: 16 << 20 }); // array args, never a shell

export function earshotEnabled(env = process.env) { return !/^(off|0|false|disabled)$/i.test(String(env.REEL_EARSHOT ?? '')); }

// -> { bin, version } or null (not installed / not runnable)
export function findEarshot({ env = process.env, run = defaultRun } = {}) {
  const bin = env.EARSHOT_BIN || 'earshot';
  try { const r = run(bin, ['--version']); if (r.status === 0) return { bin, version: String(r.stdout || r.stderr).trim() }; } catch { /* absent */ }
  return null;
}

export function earshotRequest(cue, { durS = null } = {}) {
  const p = cue.params || {};
  const want = String(cue.query || p.want || '').trim(); const design = p.sound ? String(p.sound) : null;
  if (!want && !design) throw new Error(`cue "${cue.id}": earshot cue needs "query" (words) or params.sound (a design id from \`earshot sounds\`; more reliable than words)`);
  const seed = Number.isInteger(p.seed) ? p.seed : 1; const dur = Number.isFinite(p.dur_s) ? p.dur_s : (Number.isFinite(durS) && durS > 0 ? durS : null);
  return { want, design, seed, dur_s: dur };
}

export function resolveGenerated(cue, ctx = {}) {
  if (!isEarshotCue(cue)) throw new Error(`no provider configured: cue "${cue?.id}" asks for generated audio but no tier-B provider is installed. Import the file yourself (source "library" + licence), use source "earshot" (local tool) or a tier-A synth kind.`);
  const { projectDir, env = process.env, run = defaultRun, durS = null } = ctx;
  if (!projectDir) throw new Error('resolveGenerated(earshot): ctx.projectDir is required');
  if (!earshotEnabled(env)) throw new Error(`cue "${cue.id}": the earshot adapter is disabled (REEL_EARSHOT=${env.REEL_EARSHOT}); unset it or use a library/synth cue`);
  const found = findEarshot({ env, run });
  if (!found) throw new Error(`cue "${cue.id}": earshot is not installed. In a venv: pip install "earshot @ git+https://github.com/Leonxlnx/earshot" (about 350 MB; do NOT add the 2.2 GB "listen" extra), then set EARSHOT_BIN=<venv>/bin/earshot. The name "earshot" on PyPI is a different project.`);
  const req = earshotRequest(cue, { durS });
  const key = crypto.createHash('sha256').update(JSON.stringify({ v: found.version, ...req })).digest('hex'); const short = key.slice(0, 16);
  const rel = `audio/library/earshot_${short}.wav`; const abs = path.join(projectDir, rel); const metaFile = `${abs}.json`;
  let meta = null, cacheHit = false;
  if (fs.existsSync(abs) && fs.existsSync(metaFile)) { try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); cacheHit = true; } catch { meta = null; } }
  if (!meta) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const tmp = path.join(path.dirname(abs), `.tmp-${process.pid}-${short}.wav`);
    const args = ['make']; if (req.want) args.push(req.want); if (req.design) args.push('--sound', req.design);
    args.push('--seed', String(req.seed)); if (req.dur_s) args.push('--dur', String(req.dur_s)); if (cue.params?.loop !== true) args.push('--no-loop'); args.push('-o', tmp, '--json');
    const r = run(found.bin, args);
    if (r.status !== 0 || !fs.existsSync(tmp)) { fs.rmSync(tmp, { force: true }); throw new Error(`earshot failed for cue "${cue.id}": ${String(r.stderr || r.stdout).trim().slice(0, 300)}`); }
    let j = {}; try { j = JSON.parse(r.stdout); } catch { /* summary only */ }
    fs.renameSync(tmp, abs);
    const take = (j.takes || [])[0] || {};
    const guess = !req.design && (!(j.why || []).includes('named') && ((j.unknown || []).length > 0 || /\bguess\b/.test(String(j.summary || '') + String(r.stdout || ''))));
    meta = { design: j.sound ?? take.id ?? req.design, seed: take.seed ?? req.seed, dur_s: take.dur_s ?? null, why: j.why ?? [], unknown_words: j.unknown ?? [], guessed_pick: guess, checks_ok: take.checks?.ok ?? null, sha256: crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex') };
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n');
  }
  return {
    file: rel, cache_hit: cacheHit, meta,
    licence: { name: EARSHOT_LICENCE, licence: EARSHOT_LICENCE, id: 'earshot', provider: 'earshot', url: EARSHOT_URL, credit: null, proof: `${EARSHOT_URL}#licence`, version: found.version, request: req, request_sha256: key, design: meta.design, seed: meta.seed, sha256: meta.sha256, guessed_pick: Boolean(meta.guessed_pick), quality: 'rendered', retrieved_at: new Date().toISOString() }
  };
}
