// Copies examples/<slug> into an OS temp dir so renders/masters/voiceovers never
// write cache/ or out/ inside the skill folder (keeps the skill small for syncing).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDIO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['out', 'cache']);

export function makeTmpProject(slug) {
  const src = path.join(STUDIO_ROOT, 'examples', slug);
  if (!fs.existsSync(src)) throw new Error(`No example project: ${src}`);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-'));
  const dir = path.join(root, 'examples', slug);
  fs.cpSync(src, dir, {
    recursive: true,
    filter: (p) => path.relative(src, p).split(path.sep)[0] === '' || !SKIP.has(path.relative(src, p).split(path.sep)[0])
  });
  // scene.mjs imports '../../lib/widgets.mjs'; fonts resolve relative to the project too.
  fs.symlinkSync(path.join(STUDIO_ROOT, 'lib'), path.join(root, 'lib'), 'dir');
  fs.symlinkSync(path.join(STUDIO_ROOT, 'fonts'), path.join(root, 'fonts'), 'dir');
  const cleanup = () => fs.rmSync(root, { recursive: true, force: true });
  return { root, dir, cleanup };
}
