// Runtime locator: heavy deps (static ffmpeg/ffprobe in bin/, node_modules with
// @napi-rs/canvas) live OUTSIDE the skill folder so the skill stays small enough
// to be linked/synced. Override with CVS_RUNTIME_DIR.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RUNTIME_DIR = process.env.CVS_RUNTIME_DIR || path.join(os.homedir(), '.local/share/code-video-studio');

export function resolveBin(name) {
  for (const dir of [path.join(RUNTIME_DIR, 'bin'), path.join(SKILL_ROOT, 'bin')]) {
    const p = path.join(dir, name);
    try {
      if (fs.statSync(p).isFile()) return p;
    } catch {
      // not here
    }
  }
  return name;
}

function interop(mod) {
  if (mod && typeof mod.createCanvas === 'function') return mod;
  if (mod && mod.default && typeof mod.default.createCanvas === 'function') return mod.default;
  return mod;
}

let canvasPromise = null;

export function loadCanvas() {
  if (!canvasPromise) {
    canvasPromise = (async () => {
      let firstErr;
      try {
        return interop(await import('@napi-rs/canvas'));
      } catch (err) {
        firstErr = err;
      }
      try {
        const req = createRequire(path.join(RUNTIME_DIR, 'package.json'));
        const resolved = req.resolve('@napi-rs/canvas');
        return interop(await import(pathToFileURL(resolved).href));
      } catch (err) {
        const e = new Error(
          `@napi-rs/canvas not found (bare import: ${firstErr?.message}; runtime dir ${RUNTIME_DIR}: ${err.message}). ` +
            'Install it with: npm install --prefix ~/.local/share/code-video-studio @napi-rs/canvas'
        );
        e.cause = err;
        throw e;
      }
    })();
    canvasPromise.catch(() => {
      canvasPromise = null;
    });
  }
  return canvasPromise;
}
