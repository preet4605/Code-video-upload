#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNTIME_DIR, loadCanvas, resolveBin } from '../lib/runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = path.resolve(__dirname, '..');

function runCmd(cmd, args = []) {
  try {
    const out = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out: out.trim() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function findBinary(name) {
  const localBin = resolveBin(name);
  if (localBin !== name) {
    const res = runCmd(localBin, ['-version']);
    if (res.ok) return { ok: true, path: localBin, version: res.out.split('\n')[0] };
  }
  const sysWhich = runCmd('which', [name]);
  if (sysWhich.ok && sysWhich.out) {
    const res = runCmd(sysWhich.out, ['-version']);
    if (res.ok) return { ok: true, path: sysWhich.out, version: res.out.split('\n')[0] };
  }
  return { ok: false, path: null, version: null };
}

async function checkRenderer() {
  try {
    await loadCanvas();
    return { ok: true, engine: '@napi-rs/canvas', proot_safe: true };
  } catch {
    const chr = runCmd('which', ['chromium', 'chromium-browser', 'google-chrome']);
    if (chr.ok && chr.out) {
      return {
        ok: true,
        engine: 'chromium',
        path: chr.out.split('\n')[0],
        flags: ['--no-sandbox', '--disable-dev-shm-usage']
      };
    }
    return { ok: false, engine: null };
  }
}

function checkFonts() {
  const res = runCmd('fc-list', [':', 'family']);
  const families = res.ok
    ? [...new Set(res.out.split('\n').map((s) => s.trim()).filter(Boolean))]
    : [];

  const fontsDir = path.join(STUDIO_ROOT, 'fonts');
  const bundled = fs.existsSync(fontsDir)
    ? fs.readdirSync(fontsDir).filter((f) => /\.(ttf|otf)$/i.test(f)).sort()
    : [];

  const allNames = [...families, ...bundled];
  const noto = allNames.some((f) => /noto/i.test(f));
  const dejavu = allNames.some((f) => /dejavu/i.test(f));
  const devanagari = allNames.some((f) => /devanagari/i.test(f));
  const emoji = allNames.some((f) => /emoji/i.test(f));

  return {
    ok: families.length > 0 || bundled.length > 0,
    count: families.length,
    bundled,
    noto,
    dejavu,
    devanagari,
    emoji,
    sample: families.slice(0, 6)
  };
}

function loadTtsEnv() {
  const candidates = [
    path.join(os.homedir(), '.config', 'code-video-studio', 'tts.env'),
    '/root/.config/code-video-studio/tts.env'
  ];
  const envPath = candidates.find((p) => fs.existsSync(p));
  if (!envPath) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function checkTTS() {
  loadTtsEnv();
  if (process.env.FISH_AUDIO_API_KEY) {
    return {
      ok: true,
      provider: 'fish-audio',
      model: process.env.FISH_AUDIO_MODEL || 's2.1-pro-free',
      reference_id: process.env.FISH_AUDIO_REFERENCE_ID || 'b080019dc38545f39def724726386d30'
    };
  }
  for (const bin of ['espeak-ng', 'espeak', 'piper']) {
    const w = runCmd('which', [bin]);
    if (w.ok && w.out) return { ok: true, provider: bin, path: w.out };
  }
  return { ok: false, provider: null, note: 'Optional in Phase 1; master_and_qa synthesizes silent/tone bed when absent' };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const asJson = args.has('--json');

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const nodeCheck = { ok: nodeMajor >= 22, version: process.version, arch: process.arch };
  const ffmpeg = findBinary('ffmpeg');
  const ffprobe = findBinary('ffprobe');
  const renderer = await checkRenderer();
  const fonts = checkFonts();
  const tts = checkTTS();

  const coreReady = nodeCheck.ok && ffmpeg.ok && ffprobe.ok && renderer.ok;
  const report = {
    ok: coreReady,
    studio_root: STUDIO_ROOT,
    runtime_dir: RUNTIME_DIR,
    checks: { node: nodeCheck, ffmpeg, ffprobe, renderer, fonts, tts }
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`doctor: ${coreReady ? 'PASS' : 'FAIL'} (node=${nodeCheck.version}, arch=${nodeCheck.arch}, ffmpeg=${ffmpeg.ok}, ffprobe=${ffprobe.ok}, renderer=${renderer.engine || 'none'})`);
  }
  process.exit(coreReady ? 0 : 1);
}

main();
