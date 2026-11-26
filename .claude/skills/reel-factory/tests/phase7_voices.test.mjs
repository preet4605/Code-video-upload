import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pickVoice, GENRES, AUDITION_LINES, GENRE_AUDIO_MOOD } from '../lib/voices.mjs';

test('voices: every genre resolves for hi/en and has an audition line and a mood', () => {
  for (const g of GENRES) {
    for (const lang of ['hi', 'en', 'hinglish']) {
      const p = pickVoice({ genre: g, lang, overridesFile: '/nonexistent.json' });
      assert.match(p.voice, /^[0-9a-f-]{36}$/);
      assert.ok(['catalog-default-unverified', 'user-chosen-default'].includes(p.source));
    }
    assert.ok(AUDITION_LINES[g].hi && AUDITION_LINES[g].en);
    assert.ok(GENRE_AUDIO_MOOD[g]);
  }
});

test('voices: user override file wins and unknown genres fall back to default', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-v-')), 'voices.json');
  fs.writeFileSync(f, JSON.stringify({ 'kalpa-labs': { horror: { hi: 'custom-horror-id' } } }));
  assert.deepEqual(pickVoice({ genre: 'horror', lang: 'hi', overridesFile: f }), { voice: 'custom-horror-id', source: 'user-override' });
  assert.equal(pickVoice({ genre: 'nope', lang: 'en', overridesFile: f }).source, 'catalog-default-unverified');
  assert.equal(pickVoice({ provider: 'edge-tts', genre: 'horror', lang: 'en', overridesFile: f }).voice, null);
});

test('detectTTS(auto): a configured Kalpa key outranks Fish and CLI fallbacks', async () => {
  const { detectTTS } = await import('../scripts/audio_timeline.mjs');
  const saved = { ...process.env };
  try {
    process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-home-'));
    process.env.TTS_PROVIDER = '';
    process.env.KALPA_API_KEY = 'test-placeholder';
    process.env.FISH_AUDIO_API_KEY = 'test-placeholder';
    assert.equal(detectTTS('auto').provider, 'kalpa-labs');
    process.env.KALPA_API_KEY = ''; // defined-but-empty so loadTtsEnv() cannot refill it from a real tts.env
    assert.equal(detectTTS('auto').provider, 'fish-audio');
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});
