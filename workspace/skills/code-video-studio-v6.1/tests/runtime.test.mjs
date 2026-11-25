import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { RUNTIME_DIR, resolveBin, loadCanvas } from '../lib/runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_MJS = path.resolve(__dirname, '../lib/runtime.mjs');

test('resolveBin("ffmpeg") returns an existing file under RUNTIME_DIR', (t) => {
  // Only meaningful where the static ARM64 runtime is installed; elsewhere resolveBin falls back to PATH.
  if (!fs.existsSync(path.join(RUNTIME_DIR, 'bin', 'ffmpeg'))) {
    t.skip('no static ffmpeg in RUNTIME_DIR (system ffmpeg is used instead)');
    return;
  }
  const p = resolveBin('ffmpeg');
  assert.ok(path.isAbsolute(p), `Expected absolute path, got ${p}`);
  assert.ok(p.startsWith(path.join(RUNTIME_DIR, 'bin') + path.sep), `${p} not under ${RUNTIME_DIR}/bin`);
  assert.ok(fs.statSync(p).isFile());
});

test('loadCanvas() provides a working createCanvas function', async () => {
  const mod = await loadCanvas();
  assert.equal(typeof mod.createCanvas, 'function');
  const c = mod.createCanvas(4, 4);
  assert.equal(c.width, 4);
});

test('CVS_RUNTIME_DIR override is honored', () => {
  const fake = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-rt-'));
  try {
    const out = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const m = await import(${JSON.stringify(pathToFileURL(RUNTIME_MJS).href)}); console.log(JSON.stringify({ dir: m.RUNTIME_DIR, bin: m.resolveBin('cvs-no-such-bin') }));`
      ],
      { encoding: 'utf8', env: { ...process.env, CVS_RUNTIME_DIR: fake } }
    );
    const res = JSON.parse(out.trim());
    assert.equal(res.dir, fake);
    assert.equal(res.bin, 'cvs-no-such-bin');
  } finally {
    fs.rmSync(fake, { recursive: true, force: true });
  }
});
