#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { pickVoice, genreVoiceStyle } from '../lib/voices.mjs';
import { synth as kalpaSynth } from '../lib/kalpa.mjs';
import { whisperize, applyTempo, assembleLines, probeDuration as probeDurationFx } from '../lib/voice_fx.mjs';
import { alignWordsToVoicedSpans, alignWordsToCues, detectVoicedSpans, parseVtt, retimeTimeline } from '../lib/align.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveBin } from '../lib/runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = path.resolve(__dirname, '..');
const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

export function loadTtsEnv(envPath = null) {
  const candidates = envPath
    ? [envPath]
    : [
        path.join(os.homedir(), '.config', 'code-video-studio', 'tts.env'),
        '/root/.config/code-video-studio/tts.env'
      ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) return false;
  const content = fs.readFileSync(found, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
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
  return true;
}

export function stripTtsTags(text) {
  return String(text || '')
    .replace(/\[(?:break|long-break|whispering|laughing|sighing|excited|sad|angry|calm|pause)\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function checkDevanagariTtsText(text) {
  const clean = stripTtsTags(text);
  if (!/[\u0900-\u097F]/.test(clean)) {
    return { ok: true, matches: [], warning: null };
  }
  const matches = clean.match(/[0-9०-९]+(?:[.,][0-9०-९]+)?/g) || [];
  if (matches.length > 0) {
    const sample = matches.slice(0, 6).join(', ');
    return {
      ok: false,
      matches,
      warning: `Raw digits found inside Devanagari TTS text (${sample}): Fish Audio mispronounces digits in Hindi; spell every number in spoken Hindi words.`
    };
  }
  return { ok: true, matches: [], warning: null };
}

export function checkHumanScriptFlow(text) {
  const withoutComments = String(text || '').replace(/^\s*#.*$/gm, ' ');
  const withoutTags = stripTtsTags(
    withoutComments
      .replace(/\[(?:SCENE|SFX)\s+[^\]]*\]/gi, ' ')
      .replace(/\[(?:NARRATOR|CHARACTER|WHISPER)\]/gi, ' ')
      .replace(/\[[^\]]+\]/g, ' ')
  );

  const rawSegments = withoutTags.match(/(?:[^।!?.]|(?<=\d)\.(?=\d))+[।!?.]*/g) || [];
  const sentences = [];
  const shortQuestions = [];
  let fragmentCount = 0;

  for (const seg of rawSegments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    const body = trimmed.replace(/[।!?.\s]+$/g, '').trim();
    if (!body) continue;
    const words = body.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
    if (words.length === 0) continue;

    sentences.push(trimmed);
    if (words.length <= 3) {
      fragmentCount++;
      if (/\?\s*$/.test(trimmed)) {
        shortQuestions.push(trimmed);
      }
    }
  }

  const fragmentRatio = sentences.length > 0
    ? Math.round((fragmentCount / sentences.length) * 1000) / 1000
    : 0;
  const warnings = [];
  if (sentences.length >= 4 && fragmentRatio >= 0.4) {
    warnings.push(
      `AI-style telegraphic script detected (${Math.round(fragmentRatio * 100)}% of ${sentences.length} sentences are <=3-word fragments): rewrite into natural spoken cause-and-effect sentences.`
    );
  }
  if (shortQuestions.length >= 2) {
    warnings.push(
      `Stacked short rhetorical AI-bait questions detected (${shortQuestions.join(' / ')}): replace with plain spoken cause-and-effect.`
    );
  }

  return {
    ok: warnings.length === 0,
    fragmentRatio,
    shortQuestions,
    warnings
  };
}

export function graphemeLength(str) {
  let count = 0;
  for (const _ of graphemeSegmenter.segment(str)) count++;
  return count;
}

function splitGraphemeChunks(str, maxChars) {
  const graphemes = Array.from(graphemeSegmenter.segment(str), (s) => s.segment);
  const parts = [];
  for (let i = 0; i < graphemes.length; i += maxChars) {
    parts.push(graphemes.slice(i, i + maxChars).join(''));
  }
  return parts;
}

function parseArgs(argv) {
  const opts = {
    script: null,
    out: null,
    lang: 'en',
    tts: 'auto',
    ttsModel: null,
    preset: '1080p',
    audio: null,
    voice: null,
    genre: null,
    fps: 30,
    width: 1080,
    height: 1920,
    target_lufs: undefined,
    true_peak_dbtp: -1.5,
    slug: 'project',
    snapPauses: false,
    dryRun: false,
    json: false
  };
  let widthSet = false;
  let heightSet = false;
  let fpsSet = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--script') opts.script = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--lang') opts.lang = argv[++i];
    else if (a === '--tts') opts.tts = argv[++i];
    else if (a === '--tts-model') opts.ttsModel = argv[++i];
    else if (a === '--preset') opts.preset = argv[++i];
    else if (a === '--audio') opts.audio = argv[++i];
    else if (a === '--voice') { opts.voice = argv[++i]; opts.voiceExplicit = true; }
    else if (a === '--genre') opts.genre = argv[++i];
    else if (a === '--fps') { opts.fps = Number(argv[++i]); fpsSet = true; }
    else if (a === '--width') { opts.width = Number(argv[++i]); widthSet = true; }
    else if (a === '--height') { opts.height = Number(argv[++i]); heightSet = true; }
    else if (a === '--slug') opts.slug = argv[++i];
    else if (a === '--snap-pauses') opts.snapPauses = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--per-line') opts.perLine = true;
    else if (a === '--json') opts.json = true;
  }
  if (opts.preset === 'reel-720') {
    if (!widthSet) opts.width = 720;
    if (!heightSet) opts.height = 1280;
    if (!fpsSet) opts.fps = 30;
    if (opts.target_lufs === undefined) opts.target_lufs = -14;
    opts.true_peak_dbtp = -1.5;
  }
  if (!opts.voice) {
    const l = (opts.lang || 'en').toLowerCase();
    opts.voice = (l === 'hi' || l === 'hinglish') ? 'hi-IN-MadhurNeural' : 'en-US-AndrewNeural';
  }
  return opts;
}

function parseAttrs(raw) {
  const attrs = {};
  for (const m of raw.matchAll(/(\w+)\s*=\s*([^\s\]]+)/g)) {
    let val = m[2].replace(/^["']|["']$/g, '');
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    attrs[m[1]] = val;
  }
  return attrs;
}

export function parseScript(text) {
  const scenes = [];
  let currentScene = null;
  let currentSpeaker = 'NARRATOR';

  const ensureScene = () => {
    if (!currentScene) {
      currentScene = {
        id: `scene_${scenes.length + 1}`,
        mood: 'neutral',
        ambient_motion: true,
        items: []
      };
      scenes.push(currentScene);
    }
    return currentScene;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const sceneMatch = line.match(/^\[SCENE\s+([^\]]+)\]$/i);
    if (sceneMatch) {
      const attrs = parseAttrs(sceneMatch[1]);
      currentScene = {
        id: attrs.id || `scene_${scenes.length + 1}`,
        mood: attrs.mood || 'neutral',
        ambient_motion: attrs.ambient !== undefined ? Boolean(attrs.ambient) : true,
        items: []
      };
      scenes.push(currentScene);
      continue;
    }

    const silenceOnly = line.match(/^\[SILENCE(?:\s+([^\]]*))?\]$/i);
    if (silenceOnly) {
      const attrs = parseAttrs(silenceOnly[1] || '');
      ensureScene().items.push({ kind: 'silence', dur: Number(attrs.dur) > 0 ? Number(attrs.dur) : 1.0 });
      continue;
    }

    const sfxOnly = line.match(/^\[(SFX|SCARE)\s+([^\]]+)\]$/i);
    if (sfxOnly) {
      const attrs = parseAttrs(sfxOnly[2]);
      const scare = sfxOnly[1].toUpperCase() === 'SCARE' || attrs.scare === true || attrs.scare === 'true';
      ensureScene().items.push({ kind: 'sfx', name: attrs.name || sfxOnly[2].trim(), ...(scare ? { scare: true } : {}) });
      continue;
    }

    const spkMatch = line.match(/^\[(NARRATOR|CHARACTER|WHISPER)\]\s*(.*)$/i);
    if (spkMatch) {
      currentSpeaker = spkMatch[1].toUpperCase();
      line = spkMatch[2].trim();
      if (!line) continue;
    }

    // Extract inline [SFX name=...] tokens if present
    const inlineSfx = [];
    const cleanText = line.replace(/\[SFX\s+([^\]]+)\]/gi, (_, inner) => {
      const attrs = parseAttrs(inner);
      inlineSfx.push(attrs.name || inner.trim());
      return '';
    }).replace(/\s+/g, ' ').trim();

    for (const sfxName of inlineSfx) {
      ensureScene().items.push({ kind: 'sfx', name: sfxName });
    }
    if (cleanText) {
      ensureScene().items.push({ kind: 'line', speaker: currentSpeaker, text: cleanText });
    }
  }

  return { scenes };
}

export function wrapCaptionLines(text, maxChars = 42, maxLines = 2) {
  const rawWords = text.split(/\s+/).filter(Boolean);
  const tokens = [];
  for (const w of rawWords) {
    if (graphemeLength(w) <= maxChars) tokens.push(w);
    else tokens.push(...splitGraphemeChunks(w, maxChars));
  }

  const chunks = [];
  let lines = [];

  for (const tok of tokens) {
    if (lines.length === 0) {
      lines.push(tok);
      continue;
    }
    const cur = lines[lines.length - 1];
    const candidate = `${cur} ${tok}`;
    if (graphemeLength(candidate) <= maxChars) {
      lines[lines.length - 1] = candidate;
    } else if (lines.length < maxLines) {
      lines.push(tok);
    } else {
      chunks.push(lines.join('\n'));
      lines = [tok];
    }
  }
  if (lines.length > 0) chunks.push(lines.join('\n'));
  return chunks;
}

export function buildTimeline(parsed, opts = {}) {
  const lang = (opts.lang || 'en').toLowerCase();
  const fps = opts.fps || 30;
  const width = opts.width || 1080;
  const height = opts.height || 1920;
  const slug = opts.slug || 'project';
  const style = genreVoiceStyle(opts.genre);
  const wpm = Math.round((lang === 'en' ? 145 : 135) * style.tempo);
  const secPerWord = 60 / wpm;
  const lineDurations = Array.isArray(opts.lineDurations) ? opts.lineDurations : null;
  let lineCounter = 0;
  const silencesOut = [];
  const lineSpans = [];

  const round3 = (n) => Math.round(n * 1000) / 1000;
  const scenesOut = [];
  const wordsOut = [];
  const captionsOut = [];
  const audioCuesOut = [];

  let cursor = 0;

  for (const sc of parsed.scenes) {
    const sceneStart = round3(cursor);
    cursor += 0.25; // scene lead-in

    for (const item of sc.items) {
      if (item.kind === 'sfx') {
        audioCuesOut.push({ type: 'sfx', name: item.name, t_s: round3(cursor), gain_db: -6, ...(item.scare ? { scare: true } : {}) });
        continue;
      }
      if (item.kind === 'silence') {
        // A designed silence: no voice, the bed carries room tone only. Extra gap already added after the last line.
        const s0 = round3(cursor);
        cursor += item.dur;
        silencesOut.push({ start_s: s0, end_s: round3(cursor), dur_s: item.dur });
        audioCuesOut.push({ type: 'silence', t_s: s0, dur_s: item.dur });
        continue;
      }

      const visualText = stripTtsTags(item.text);
      const tokens = visualText.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) continue;

      const captionChunks = wrapCaptionLines(visualText, 42, 2);
      const totalChars = graphemeLength(visualText);
      const wpmDur = tokens.length * secPerWord;
      const minSafeDur = totalChars / 16.0; // strictly under 18 CPS cap
      // Never speed the voice up for caption speed: a measured TTS line keeps its own length,
      // and captions are re-chunked/held instead (<= 16 CPS by construction).
      const measured = lineDurations ? lineDurations[lineCounter] : null;
      const lineDur = Number.isFinite(measured) && measured > 0 ? Math.max(measured, 0.4) : Math.max(wpmDur, minSafeDur, 0.8);
      const lineStart = cursor;
      lineSpans.push({ index: lineCounter, speaker: item.speaker, text: visualText, start_s: round3(lineStart), dur_s: round3(lineDur) });
      lineCounter++;
      const wordStep = lineDur / tokens.length;

      for (let wi = 0; wi < tokens.length; wi++) {
        const ws = round3(lineStart + wi * wordStep);
        const we = round3(lineStart + (wi + 1) * wordStep);
        wordsOut.push({ word: tokens[wi], start_s: ws, end_s: we, speaker: item.speaker });
      }

      // Split lineDur proportionally across captionChunks by grapheme length
      let capCursor = lineStart;
      const chunkTotalChars = captionChunks.reduce((acc, c) => acc + graphemeLength(c.replace(/\n/g, '')), 0) || 1;
      for (const chunk of captionChunks) {
        const cLen = graphemeLength(chunk.replace(/\n/g, ''));
        const cDur = Math.max((cLen / chunkTotalChars) * lineDur, cLen / 16.0);
        captionsOut.push({
          speaker: item.speaker,
          text: chunk,
          start_s: round3(capCursor),
          end_s: round3(capCursor + cDur),
          safe_zone: true
        });
        capCursor += cDur;
      }

      cursor = Math.max(lineStart + lineDur, capCursor) + style.lineGapS;
    }

    cursor += style.sceneTailS; // scene tail
    const sceneEnd = round3(Math.max(cursor, sceneStart + 1.0));
    cursor = sceneEnd;

    const beatDur = round3(sceneEnd - sceneStart);
    const animProps = sc.ambient_motion
      ? ['camera.drift', 'ambient.particles', 'caption.reveal']
      : ['camera.push', 'caption.reveal'];

    scenesOut.push({
      id: sc.id,
      start_s: sceneStart,
      end_s: sceneEnd,
      mood: sc.mood || 'neutral',
      ambient_motion: Boolean(sc.ambient_motion),
      beats: [
        {
          t_s: sceneStart,
          dur_s: beatDur,
          hold: false,
          flashes_per_sec: 0,
          animated_properties: animProps
        }
      ]
    });
  }

  const defaultLufs = opts.preset === 'reel-720' ? -14 : -16;
  return {
    version: '1.0',
    slug,
    aspect: width < height ? '9:16' : width === height ? '1:1' : '16:9',
    width,
    height,
    fps,
    duration_s: round3(cursor),
    target_lufs: opts.target_lufs ?? defaultLufs,
    true_peak_dbtp: opts.true_peak_dbtp ?? -1.5,
    audio_file: opts.audio_file || null,
    alignment: { method: lineDurations ? 'per-line-concat' : 'wpm-estimate' },
    voice_style: style,
    silences: silencesOut,
    lines: lineSpans,
    scenes: scenesOut,
    words: wordsOut,
    captions: captionsOut,
    audio_cues: audioCuesOut
  };
}

function whichExists(bin) {
  try {
    const p = execFileSync('which', [bin], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return p || null;
  } catch {
    return null;
  }
}

function normalizeTtsProvider(name) {
  const s = String(name || '').trim().toLowerCase();
  return s === 'kalpa' ? 'kalpa-labs' : s;
}

export function listTtsProviders() {
  loadTtsEnv();
  return [
    { id: 'fish-audio', kind: 'api', envVar: 'FISH_AUDIO_API_KEY', available: Boolean(process.env.FISH_AUDIO_API_KEY) },
    { id: 'kalpa-labs', kind: 'api', available: Boolean(process.env.KALPA_API_KEY), env: 'KALPA_API_KEY', envVar: 'KALPA_API_KEY' },
    { id: 'edge-tts', kind: 'cli', available: Boolean(whichExists('edge-tts')) },
    { id: 'espeak-ng', kind: 'cli', available: Boolean(whichExists('espeak-ng')) },
    { id: 'espeak', kind: 'cli', available: Boolean(whichExists('espeak')) },
    { id: 'piper', kind: 'cli', available: Boolean(whichExists('piper')) },
    { id: 'elevenlabs', kind: 'api', envVar: 'ELEVENLABS_API_KEY', available: Boolean(process.env.ELEVENLABS_API_KEY) },
    { id: 'gemini', kind: 'api', envVar: 'GEMINI_API_KEY', available: Boolean(process.env.GEMINI_API_KEY) },
    { id: 'sarvam', kind: 'api', envVar: 'SARVAM_API_KEY', available: Boolean(process.env.SARVAM_API_KEY) }
  ];
}

export function scaleTimelineToAudioDuration(timeline, audioDurationS) {
  const targetDur = Math.round(Number(audioDurationS) * 1000) / 1000;
  const origDur = Number(timeline.duration_s) || 1;
  const factor = targetDur / origDur;
  const r3 = (n) => Math.round(n * 1000) / 1000;

  const scaled = structuredClone(timeline);
  scaled.duration_s = targetDur;

  if (Array.isArray(scaled.scenes) && scaled.scenes.length > 0) {
    let prevEnd = 0;
    for (let i = 0; i < scaled.scenes.length; i++) {
      const sc = scaled.scenes[i];
      const isLast = i === scaled.scenes.length - 1;
      sc.start_s = r3(prevEnd);
      sc.end_s = isLast ? targetDur : r3(Math.max(sc.start_s + 0.05, sc.end_s * factor));
      prevEnd = sc.end_s;
      if (Array.isArray(sc.beats)) {
        for (const b of sc.beats) {
          b.t_s = r3(b.t_s * factor);
          b.dur_s = r3(Math.max(0.05, b.dur_s * factor));
        }
      }
    }
  }

  for (const w of scaled.words || []) {
    w.start_s = r3(w.start_s * factor);
    w.end_s = r3(Math.max(w.start_s + 0.01, w.end_s * factor));
  }
  for (const c of scaled.captions || []) {
    c.start_s = r3(c.start_s * factor);
    c.end_s = r3(Math.max(c.start_s + 0.05, c.end_s * factor));
  }
  for (const cue of scaled.audio_cues || []) {
    cue.t_s = r3(cue.t_s * factor);
  }

  return scaled;
}

export function detectVocalPauses(audioPath) {
  const ffmpegBin = resolveBin('ffmpeg');
  const res = spawnSync(
    ffmpegBin,
    [
      '-i', audioPath,
      '-af', 'highpass=f=300,lowpass=f=3400,silencedetect=n=-32dB:d=0.07',
      '-f', 'null', '-'
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  if (res.status !== 0) {
    throw new Error(`detectVocalPauses failed: ${(res.stderr || '').slice(0, 300)}`);
  }
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const pauses = [];
  let curStart = null;
  for (const line of (res.stderr || '').split(/\r?\n/)) {
    const ms = line.match(/silence_start:\s*([0-9.eE+-]+)/);
    const me = line.match(/silence_end:\s*([0-9.eE+-]+)\s*\|\s*silence_duration:\s*([0-9.eE+-]+)/);
    if (ms) {
      curStart = Number(ms[1]);
    } else if (me) {
      const end = Number(me[1]);
      const dur = Number(me[2]);
      const start = curStart !== null && Number.isFinite(curStart) ? curStart : end - dur;
      pauses.push({
        start: r3(start),
        end: r3(end),
        duration: r3(dur),
        mid: r3((start + end) / 2)
      });
      curStart = null;
    }
  }
  return pauses;
}

export function snapSceneBoundariesToPauses(timeline, pauses = [], maxShiftS = 1.0) {
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const out = structuredClone(timeline);
  const scenes = out.scenes || [];
  const validPauses = (Array.isArray(pauses) ? pauses : []).filter(
    (p) => p && Number.isFinite(p.start) && Number.isFinite(p.end)
  );
  if (scenes.length <= 1 || validPauses.length === 0) {
    return out;
  }

  const fps = out.fps || 30;
  const dur = Number(out.duration_s) || scenes[scenes.length - 1].end_s;
  const origScenes = scenes.map((s) => ({ id: s.id, start_s: s.start_s, end_s: s.end_s }));

  // Snap internal boundaries i = 1 .. scenes.length - 1
  for (let i = 1; i < scenes.length; i++) {
    const origCut = origScenes[i].start_s;
    let bestMid = null;
    let bestDiff = Infinity;
    for (const p of validPauses) {
      const mid = Number.isFinite(p.mid) ? p.mid : ((p.start + p.end) / 2);
      if (!Number.isFinite(mid)) continue;
      const diff = Math.abs(mid - origCut);
      if (diff <= maxShiftS && diff < bestDiff) {
        bestDiff = diff;
        bestMid = mid;
      }
    }
    if (bestMid === null) continue;
    const quantized = r3(Math.round(bestMid * fps) / fps);
    const minCut = r3(scenes[i - 1].start_s + 0.2);
    const maxCut = r3(origScenes[i].end_s - 0.2);
    if (quantized >= minCut && quantized <= maxCut && Math.abs(quantized - origCut) <= maxShiftS) {
      scenes[i - 1].end_s = quantized;
      scenes[i].start_s = quantized;
    }
  }
  scenes[0].start_s = 0;
  scenes[scenes.length - 1].end_s = r3(dur);

  const findOrigSceneIdx = (t) => {
    for (let k = 0; k < origScenes.length; k++) {
      if (t >= origScenes[k].start_s && (t < origScenes[k].end_s || k === origScenes.length - 1)) return k;
    }
    return 0;
  };
  const remapTime = (t, k) => {
    const os = origScenes[k];
    const ns = scenes[k];
    const oSpan = Math.max(0.001, os.end_s - os.start_s);
    const nSpan = Math.max(0.001, ns.end_s - ns.start_s);
    const frac = (t - os.start_s) / oSpan;
    return r3(ns.start_s + Math.max(0, Math.min(1, frac)) * nSpan);
  };

  for (let k = 0; k < scenes.length; k++) {
    const sc = scenes[k];
    if (!Array.isArray(sc.beats)) continue;
    for (const b of sc.beats) {
      const bStart = remapTime(b.t_s, k);
      const bEnd = remapTime(b.t_s + b.dur_s, k);
      b.t_s = bStart;
      b.dur_s = r3(Math.max(0.05, bEnd - bStart));
    }
  }

  let prevCapEnd = 0;
  for (const c of out.captions || []) {
    const mid = (c.start_s + c.end_s) / 2;
    const k = findOrigSceneIdx(mid);
    let ns = remapTime(c.start_s, k);
    let ne = remapTime(c.end_s, k);
    if (ns < prevCapEnd) ns = prevCapEnd;
    if (ne <= ns) ne = r3(Math.min(scenes[k].end_s, ns + 0.05));
    c.start_s = ns;
    c.end_s = ne;
    prevCapEnd = ne;
  }

  for (const w of out.words || []) {
    const k = findOrigSceneIdx((w.start_s + w.end_s) / 2);
    w.start_s = remapTime(w.start_s, k);
    w.end_s = r3(Math.max(w.start_s + 0.01, remapTime(w.end_s, k)));
  }

  for (const cue of out.audio_cues || []) {
    const k = findOrigSceneIdx(cue.t_s);
    cue.t_s = remapTime(cue.t_s, k);
  }

  return out;
}

export async function synthesizeTts({ provider, text, lang = 'en', voice = null, ttsModel = null, outPath, temperature = null }) {
  loadTtsEnv();
  const activeProvider = normalizeTtsProvider(provider);
  if (!activeProvider || activeProvider === 'none') {
    return { ok: false, provider: 'wpm-fallback', audio_file: null };
  }
  const resolvedVoice = voice || ((lang === 'hi' || lang === 'hinglish') ? 'hi-IN-MadhurNeural' : 'en-US-AndrewNeural');

  if (activeProvider === 'kalpa-labs' && process.env.KALPA_API_KEY) {
    const isDefaultEdgeVoice = voice === 'hi-IN-MadhurNeural' || voice === 'en-US-AndrewNeural';
    const isHi = (lang || '').toLowerCase() === 'hi' || (lang || '').toLowerCase() === 'hinglish';
    const defaultVoiceId = isHi
      ? (process.env.KALPA_VOICE_ID_HI || process.env.KALPA_VOICE_ID || '1eb6c010-34e0-477c-9d24-e915f853359e')
      : (process.env.KALPA_VOICE_ID_EN || process.env.KALPA_VOICE_ID || 'dda5319f-3b81-4124-b69e-9241eb510b77');
    const voiceId = (voice && !isDefaultEdgeVoice) ? voice : defaultVoiceId;
    const cleanText = stripTtsTags(text);
    // Shared client: sends model + sample_rate + params.temperature, maps API errors (402 never retried, 429 honours Retry-After).
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    await kalpaSynth({
      text: cleanText, voice: voiceId, model: /^kalpa/.test(ttsModel || '') ? ttsModel : 'kalpa-tts-1',
      temperature: Number.isFinite(temperature) ? temperature : undefined,
      sampleRate: Number(process.env.KALPA_SAMPLE_RATE) || 48000, out: outPath, force: true
    });
    return { ok: true, provider: 'kalpa-labs', audio_file: outPath };
  }

  if (activeProvider === 'fish-audio' && process.env.FISH_AUDIO_API_KEY) {
    const isDefaultEdgeVoice = voice === 'hi-IN-MadhurNeural' || voice === 'en-US-AndrewNeural';
    const refId = (voice && !isDefaultEdgeVoice)
      ? voice
      : (process.env.FISH_AUDIO_REFERENCE_ID || 'b080019dc38545f39def724726386d30');
    const model = ttsModel || process.env.FISH_AUDIO_MODEL || 's2.1-pro-free';
    const resp = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FISH_AUDIO_API_KEY}`,
        model,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, reference_id: refId, format: 'mp3' })
    });
    if (!resp.ok) {
      const errBody = (await resp.text()).slice(0, 200);
      throw new Error(`Fish Audio TTS failed: ${resp.status} ${errBody}`);
    }
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(await resp.arrayBuffer()));
    return { ok: true, provider: 'fish-audio', audio_file: outPath };
  }

  if (activeProvider === 'edge-tts' && whichExists('edge-tts')) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    const vttPath = `${outPath}.vtt`;
    try {
      execFileSync('edge-tts', ['--voice', resolvedVoice, '--text', text, '--write-media', outPath, '--write-subtitles', vttPath], { stdio: 'pipe' });
    } catch {
      execFileSync('edge-tts', ['--voice', resolvedVoice, '--text', text, '--write-media', outPath], { stdio: 'pipe' });
    }
    return { ok: true, provider: 'edge-tts', audio_file: outPath, cues_file: fs.existsSync(vttPath) ? vttPath : null };
  }
  if ((activeProvider === 'espeak-ng' || activeProvider === 'espeak') && whichExists(activeProvider)) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    execFileSync(activeProvider, ['-w', outPath, text], { stdio: 'pipe' });
    return { ok: true, provider: activeProvider, audio_file: outPath };
  }
  if (activeProvider === 'elevenlabs' && process.env.ELEVENLABS_API_KEY) {
    const voiceId = voice || '21m00Tcm4TlvDq8ikWAM';
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' })
    });
    if (!resp.ok) throw new Error(`ElevenLabs TTS failed: ${resp.status}`);
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(await resp.arrayBuffer()));
    return { ok: true, provider: 'elevenlabs', audio_file: outPath };
  }
  if (activeProvider === 'sarvam' && process.env.SARVAM_API_KEY) {
    const resp = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': process.env.SARVAM_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: [text], target_language_code: 'hi-IN', speaker: voice || 'meera' })
    });
    if (!resp.ok) throw new Error(`Sarvam TTS failed: ${resp.status}`);
    const data = await resp.json();
    const b64 = data.audios?.[0];
    if (!b64) throw new Error('Sarvam TTS returned no audio');
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
    return { ok: true, provider: 'sarvam', audio_file: outPath };
  }
  if (activeProvider === 'gemini' && process.env.GEMINI_API_KEY) {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: { responseModalities: ['AUDIO'] }
        })
      }
    );
    if (!resp.ok) throw new Error(`Gemini TTS failed: ${resp.status}`);
    const data = await resp.json();
    const b64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) throw new Error('Gemini TTS returned no inline audio');
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
    return { ok: true, provider: 'gemini', audio_file: outPath };
  }

  return { ok: false, provider: 'wpm-fallback', audio_file: null };
}

function probeAudioDuration(audioPath) {
  const ffprobe = resolveBin('ffprobe');
  const raw = execFileSync(
    ffprobe,
    ['-v', 'quiet', '-print_format', 'json', '-show_format', audioPath],
    { encoding: 'utf8' }
  );
  const parsed = JSON.parse(raw);
  return Number(parsed.format?.duration);
}

export function detectTTS(preference) {
  if (preference === 'none') return null;
  const providers = listTtsProviders();
  if (preference === 'auto') {
    const envPref = normalizeTtsProvider(process.env.TTS_PROVIDER || '');
    if (envPref === 'none') return null;
    if (envPref) {
      const envMatch = providers.find((p) => p.id === envPref && p.available);
      if (envMatch) return { provider: envMatch.id };
    }
    // A configured Kalpa key means the user chose it: it outranks CLI fallbacks (espeak etc.) and Fish.
    const kalpa = providers.find((p) => p.id === 'kalpa-labs' && p.available);
    if (kalpa) return { provider: 'kalpa-labs' };
    const fish = providers.find((p) => p.id === 'fish-audio' && p.available);
    if (fish) return { provider: 'fish-audio' };
    const cliReady = providers.find((p) => p.kind === 'cli' && p.available);
    if (cliReady) return { provider: cliReady.id };
    const anyApi = providers.find((p) => p.kind === 'api' && p.available);
    return anyApi ? { provider: anyApi.id } : null;
  }
  const normPref = normalizeTtsProvider(preference);
  const match = providers.find((p) => p.id === normPref && p.available);
  return match ? { provider: match.id } : null;
}

export function applyAlignment(timeline, audioPath, { cuesFile = null } = {}) {
  const words = timeline.words || [];
  if (!words.length || !audioPath) return timeline;
  const ffmpegBin = resolveBin('ffmpeg');
  try {
    let aligned = null;
    if (cuesFile && fs.existsSync(cuesFile)) {
      aligned = alignWordsToCues(words, parseVtt(fs.readFileSync(cuesFile, 'utf8')), timeline.duration_s);
    }
    if (!aligned) {
      const spans = detectVoicedSpans(ffmpegBin, audioPath, timeline.duration_s);
      aligned = { words: alignWordsToVoicedSpans(words, spans), method: 'voiced-span-weighted' };
    }
    const out = retimeTimeline(timeline, words, aligned.words);
    out.alignment = { method: aligned.method };
    return out;
  } catch (err) {
    return { ...timeline, alignment: { method: 'linear-scale', error: String(err.message || err).slice(0, 200) } };
  }
}

// Horror (and --per-line): synthesize every spoken line separately, slow it to the genre tempo, whisperize
// [WHISPER] lines, then place each clip at its timeline offset. Designed pauses and [SILENCE] beats survive into
// the real voice track, and word timing is exact per line (alignment.method = per-line-concat).
export async function synthesizePerLine({ parsed, opts, outDir, synthFn, voice = null, temperature = null }) {
  const style = genreVoiceStyle(opts.genre);
  const tmp = path.join(outDir, 'cache', 'vo_lines');
  fs.mkdirSync(tmp, { recursive: true });
  const lines = parsed.scenes.flatMap((sc) => sc.items.filter((it) => it.kind === 'line'));
  const clips = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = path.join(tmp, `line_${String(i).padStart(3, '0')}_raw.wav`);
    const res = await synthFn({ text: lines[i].text, outPath: raw, voice, temperature, index: i });
    if (!res || !res.ok) throw new Error(`per-line TTS failed on line ${i + 1}`);
    let cur = res.audio_file || raw;
    if (Math.abs(style.tempo - 1) > 0.005) cur = applyTempo(cur, path.join(tmp, `line_${String(i).padStart(3, '0')}_tempo.wav`), style.tempo);
    if (lines[i].speaker === 'WHISPER') cur = whisperize(cur, path.join(tmp, `line_${String(i).padStart(3, '0')}_whisper.wav`));
    clips.push({ path: cur, dur: probeDurationFx(cur) });
  }
  let timeline = buildTimeline(parsed, { ...opts, audio_file: null, lineDurations: clips.map((c) => c.dur) });
  const placed = timeline.lines.map((ln, i) => ({ path: clips[i].path, start_s: ln.start_s }));
  const rel = 'voiceover.wav';
  assembleLines(placed, timeline.duration_s, path.join(outDir, rel));
  timeline.audio_file = rel;
  timeline.alignment = { method: 'per-line-concat', note: 'line timing exact; words spread linearly inside each line. Run an STT pass per line and rewrite mispronounced lines.' };
  return timeline;
}

async function main() {
  loadTtsEnv();
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.script || !opts.out) {
    console.error('Usage: audio_timeline.mjs --script <file> --out <dir> [--lang en|hi|hinglish] [--genre horror|funny|guide|news|story|motivational] [--tts auto|fish-audio|kalpa-labs|none] [--preset 1080p|reel-720] [--audio <file>] [--dry-run] [--json]');
    process.exit(2);
  }

  const scriptText = fs.readFileSync(path.resolve(opts.script), 'utf8');
  const parsed = parseScript(scriptText);
  const rawSpokenText = parsed.scenes
    .flatMap((sc) => sc.items.filter((it) => it.kind === 'line').map((it) => it.text))
    .join(' ');
  const ttsCheck = checkDevanagariTtsText(rawSpokenText);
  const ttsWarnings = ttsCheck.ok ? [] : [ttsCheck.warning];
  if (!ttsCheck.ok) {
    console.warn('[WARN]', ttsCheck.warning);
  }
  const flow = checkHumanScriptFlow(scriptText);
  if (!flow.ok) {
    for (const w of flow.warnings) {
      console.warn('[WARN]', w);
    }
  }
  const tts = detectTTS(opts.tts);
  let timeline = buildTimeline(parsed, { ...opts, audio_file: null });
  let activeProvider = tts ? tts.provider : 'wpm-fallback';

  if (opts.audio) {
    const srcAudio = path.resolve(opts.audio);
    const dur = probeAudioDuration(srcAudio);
    const ext = path.extname(srcAudio) || '.wav';
    const relName = `voiceover${ext}`;
    if (!opts.dryRun) {
      const outDir = path.resolve(opts.out);
      fs.mkdirSync(outDir, { recursive: true });
      const destAudio = path.join(outDir, relName);
      if (path.resolve(srcAudio) !== path.resolve(destAudio)) {
        fs.copyFileSync(srcAudio, destAudio);
      }
    }
    timeline = scaleTimelineToAudioDuration(timeline, dur);
    timeline.audio_file = relName;
    timeline.alignment = { method: 'linear-scale' };
    timeline = applyAlignment(timeline, srcAudio);
    if (opts.snapPauses) {
      const pauses = detectVocalPauses(srcAudio);
      timeline = snapSceneBoundariesToPauses(timeline, pauses);
    }
    activeProvider = 'external-audio';
  } else if (!opts.dryRun && tts && (genreVoiceStyle(opts.genre).perLine || opts.perLine)) {
    const outDir = path.resolve(opts.out);
    let voiceForSynth = opts.voice;
    if (!opts.voiceExplicit && tts.provider === 'kalpa-labs') {
      const pick = pickVoice({ provider: 'kalpa-labs', genre: opts.genre || 'default', lang: opts.lang });
      if (pick.voice) voiceForSynth = pick.voice;
    }
    const style = genreVoiceStyle(opts.genre);
    timeline = await synthesizePerLine({
      parsed,
      opts,
      outDir,
      voice: voiceForSynth,
      temperature: style.temperature,
      synthFn: ({ text, outPath, voice, temperature }) => synthesizeTts({ provider: tts.provider, text, lang: opts.lang, voice, ttsModel: opts.ttsModel, outPath, temperature })
    });
    activeProvider = `${tts.provider} per-line (tempo ${style.tempo})`;
  } else if (!opts.dryRun && tts) {
    const outDir = path.resolve(opts.out);
    const ext = (tts.provider === 'fish-audio' || tts.provider === 'edge-tts' || tts.provider === 'elevenlabs') ? '.mp3' : '.wav';
    const relName = `voiceover${ext}`;
    const outAudio = path.join(outDir, relName);
    const plainText = timeline.words.map((w) => w.word).join(' ');
    const synthText = tts.provider === 'fish-audio' ? rawSpokenText : plainText;
    let voiceForSynth = opts.voice;
    if (!opts.voiceExplicit && tts.provider === 'kalpa-labs') {
      const pick = pickVoice({ provider: 'kalpa-labs', genre: opts.genre || 'default', lang: opts.lang });
      if (pick.voice) voiceForSynth = pick.voice;
      activeProvider = `kalpa-labs (voice ${String(pick.voice).slice(0, 8)}, ${pick.source})`;
    }
    const synth = await synthesizeTts({
      provider: tts.provider,
      text: synthText,
      lang: opts.lang,
      voice: voiceForSynth,
      ttsModel: opts.ttsModel,
      outPath: outAudio
    });
    if (synth.ok) {
      const dur = probeAudioDuration(outAudio);
      timeline = scaleTimelineToAudioDuration(timeline, dur);
      timeline.audio_file = relName;
      timeline.alignment = { method: 'linear-scale' };
      timeline = applyAlignment(timeline, outAudio, { cuesFile: synth.cues_file || null });
      if (opts.snapPauses) {
        const pauses = detectVocalPauses(outAudio);
        timeline = snapSceneBoundariesToPauses(timeline, pauses);
      }
    }
  }

  if (opts.dryRun) {
    const out = {
      ok: true,
      dryRun: true,
      ttsProvider: activeProvider,
      script_warnings: flow.warnings,
      ...(ttsWarnings.length > 0 ? { tts_warnings: ttsWarnings } : {}),
      timeline
    };
    console.log(opts.json ? JSON.stringify(out, null, 2) : `DRY-RUN OK: ${timeline.scenes.length} scenes, ${timeline.duration_s}s`);
    return;
  }

  const outDir = path.resolve(opts.out);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'timeline.json');
  fs.writeFileSync(outPath, JSON.stringify(timeline, null, 2));

  const res = {
    ok: true,
    ttsProvider: activeProvider,
    timelinePath: outPath,
    duration_s: timeline.duration_s,
    scenes: timeline.scenes.length,
    words: timeline.words.length,
    captions: timeline.captions.length,
    audio_file: timeline.audio_file,
    script_warnings: flow.warnings,
    ...(ttsWarnings.length > 0 ? { tts_warnings: ttsWarnings } : {})
  };
  console.log(opts.json ? JSON.stringify(res, null, 2) : `TIMELINE OK: ${outPath} (${timeline.duration_s}s)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
