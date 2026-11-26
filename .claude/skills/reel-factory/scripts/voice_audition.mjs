#!/usr/bin/env node
// Synthesize the same genre-appropriate line with every candidate voice so a human can LISTEN and pick.
//   node scripts/voice_audition.mjs --genre horror --lang hi --out /tmp/aud [--voices id1,id2]
// Needs KALPA_API_KEY in ~/.config/code-video-studio/tts.env (never in the skill folder).
import fs from 'node:fs';
import path from 'node:path';
import { synthesizeTts, loadTtsEnv } from './audio_timeline.mjs';
import { AUDITION_LINES, KALPA_VOICES, GENRES, pickVoice } from '../lib/voices.mjs';

const a = process.argv.slice(2);
const get = (k, d = null) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const genre = get('--genre', 'default');
const lang = get('--lang', 'hi');
const out = path.resolve(get('--out', './voice_auditions'));
if (!GENRES.includes(genre)) {
  console.error(`genre must be one of: ${GENRES.join(', ')}`);
  process.exit(2);
}
loadTtsEnv();
const ids = (get('--voices') ? get('--voices').split(',') : Object.keys(KALPA_VOICES).filter((id) => KALPA_VOICES[id].langs.includes(lang === 'hi' || lang === 'hinglish' ? 'hi' : 'en'))).filter(Boolean);
const text = AUDITION_LINES[genre][lang === 'hi' ? 'hi' : 'en'];
fs.mkdirSync(out, { recursive: true });
const rows = [];
for (const id of ids) {
  const file = path.join(out, `${genre}_${lang}_${id.slice(0, 8)}.wav`);
  try {
    const r = await synthesizeTts({ provider: 'kalpa-labs', text, lang, voice: id, outPath: file });
    rows.push({ voice: id, label: KALPA_VOICES[id]?.name || 'custom', ok: r.ok, file: r.ok ? file : null });
  } catch (e) {
    rows.push({ voice: id, label: KALPA_VOICES[id]?.name || 'custom', ok: false, error: String(e.message).slice(0, 160) });
  }
}
const current = pickVoice({ provider: 'kalpa-labs', genre, lang });
console.log(JSON.stringify({ genre, lang, text, current_pick: current, auditions: rows, next: 'Listen, then pin your pick in ~/.config/code-video-studio/voices.json (see lib/voices.mjs header).' }, null, 2));
