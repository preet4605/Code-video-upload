#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

const REQUIRED_FONTS = ['NotoSansDevanagari-Bold.ttf', 'NotoSans-Bold.ttf', 'NotoSans-Regular.ttf'];
const REQUIRED_FILTERS = ['loudnorm', 'sidechaincompress', 'ebur128', 'freezedetect', 'blackdetect', 'silencedetect'];

export function checkBundledFonts(fontsDir = path.join(STUDIO_ROOT, 'fonts')) {
  const missing = REQUIRED_FONTS.filter((f) => !fs.existsSync(path.join(fontsDir, f)));
  return { ok: missing.length === 0, required: REQUIRED_FONTS, missing };
}

export async function checkDevanagariShaping(fontsDir = path.join(STUDIO_ROOT, 'fonts')) {
  const text = '\u0928\u092E\u0938\u094D\u0924\u0947'; // नमस्ते
  try {
    const canvasMod = await loadCanvas();
    const { createCanvas, GlobalFonts } = canvasMod;
    const fp = path.join(fontsDir, 'NotoSansDevanagari-Bold.ttf');
    if (!fs.existsSync(fp)) return { ok: false, width: 0, error: 'font file missing' };
    GlobalFonts.registerFromPath(fp, 'DoctorDevanagari');
    const ctx = createCanvas(200, 100).getContext('2d');
    ctx.font = '48px DoctorDevanagari';
    const width = ctx.measureText(text).width;
    return { ok: width > 0, width: Number(width.toFixed(1)), sample: text };
  } catch (err) {
    return { ok: false, width: 0, error: String(err.message || err).slice(0, 160) };
  }
}

export function checkFfmpegFilters(ffmpegBin, wanted = REQUIRED_FILTERS) {
  const res = runCmd(ffmpegBin, ['-hide_banner', '-filters']);
  if (!res.ok) return { ok: false, missing: wanted, error: 'ffmpeg -filters failed' };
  const have = new Set(res.out.split('\n').map((l) => l.trim().split(/\s+/)[1]).filter(Boolean));
  const missing = wanted.filter((f) => !have.has(f));
  return { ok: missing.length === 0, required: wanted, missing };
}

// Presence only. The value is never read into the report.
export function checkTtsKeys() {
  loadTtsEnv();
  const kalpa = Boolean(process.env.KALPA_API_KEY);
  return { ok: kalpa, KALPA_API_KEY: kalpa ? 'set' : 'not set', note: kalpa ? 'Kalpa TTS available' : 'No KALPA_API_KEY: voiceover must come from another provider or captions-only (brief.silent=true)' };
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

  const bundled_fonts = checkBundledFonts();
  const devanagari_shaping = await checkDevanagariShaping();
  const ffmpeg_filters = ffmpeg.ok ? checkFfmpegFilters(ffmpeg.path) : { ok: false, missing: REQUIRED_FILTERS, error: 'ffmpeg not found' };
  const tts_keys = checkTtsKeys();

  const coreReady = nodeCheck.ok && ffmpeg.ok && ffprobe.ok && renderer.ok;
  const warnings = [];
  if (!bundled_fonts.ok) warnings.push(`bundled fonts missing: ${bundled_fonts.missing.join(', ')}`);
  if (!devanagari_shaping.ok) warnings.push('Devanagari text did not measure (canvas shaping/font problem): Hindi captions will be wrong');
  if (!ffmpeg_filters.ok) warnings.push(`ffmpeg lacks filters: ${ffmpeg_filters.missing.join(', ')}`);
  if (!tts_keys.ok) warnings.push('KALPA_API_KEY not set');
  const report = {
    ok: coreReady,
    studio_root: STUDIO_ROOT,
    runtime_dir: RUNTIME_DIR,
    checks: { node: nodeCheck, ffmpeg, ffprobe, renderer, fonts, tts, bundled_fonts, devanagari_shaping, ffmpeg_filters, tts_keys },
    preflight_ready: coreReady && bundled_fonts.ok && devanagari_shaping.ok && ffmpeg_filters.ok,
    warnings
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`doctor: ${coreReady ? 'PASS' : 'FAIL'} (node=${nodeCheck.version}, arch=${nodeCheck.arch}, ffmpeg=${ffmpeg.ok}, ffprobe=${ffprobe.ok}, renderer=${renderer.engine || 'none'})`);
    for (const w of warnings) console.log(`  warning: ${w}`);
  }
  process.exit(coreReady ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
