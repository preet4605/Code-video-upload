// Genre -> voice selection for TTS, plus per-genre audition lines.
//
// HONEST LIMIT: this catalog only knows voice IDs you have supplied or that shipped as defaults. Claude cannot
// listen to audio, so the genre->voice mapping below is a STARTING POINT, not a verified "best voice".
// Run scripts/voice_audition.mjs, listen, then pin your pick in ~/.config/code-video-studio/voices.json:
//   { "kalpa-labs": { "horror": { "hi": "<voice-id>", "en": "<voice-id>" }, "guide": { "hi": "<voice-id>" } } }
// Overrides always win. API keys never go in this file or in the skill folder (use tts.env).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const GENRES = ['horror', 'funny', 'guide', 'news', 'story', 'motivational', 'default'];

export const KALPA_VOICES = Object.freeze({
  '5e0c5704-590f-483b-b291-00a2415cb67e': { label: 'reader (user-supplied; sample line is a story/news reader prompt)', langs: ['hi', 'en'], source: 'user' },
  '1eb6c010-34e0-477c-9d24-e915f853359e': { label: 'previous Hindi default', langs: ['hi'], source: 'skill-default' },
  'dda5319f-3b81-4124-b69e-9241eb510b77': { label: 'previous English default', langs: ['en'], source: 'skill-default' }
});

// Starting-point table (unverified by ear). Narration-style genres use the reader voice;
// horror/funny keep the previous defaults until the user audition-picks something better.
const KALPA_DEFAULTS = {
  guide: { hi: '5e0c5704-590f-483b-b291-00a2415cb67e', en: '5e0c5704-590f-483b-b291-00a2415cb67e' },
  news: { hi: '5e0c5704-590f-483b-b291-00a2415cb67e', en: '5e0c5704-590f-483b-b291-00a2415cb67e' },
  story: { hi: '5e0c5704-590f-483b-b291-00a2415cb67e', en: '5e0c5704-590f-483b-b291-00a2415cb67e' },
  horror: { hi: '1eb6c010-34e0-477c-9d24-e915f853359e', en: 'dda5319f-3b81-4124-b69e-9241eb510b77' },
  funny: { hi: '1eb6c010-34e0-477c-9d24-e915f853359e', en: 'dda5319f-3b81-4124-b69e-9241eb510b77' },
  motivational: { hi: '1eb6c010-34e0-477c-9d24-e915f853359e', en: 'dda5319f-3b81-4124-b69e-9241eb510b77' },
  default: { hi: '5e0c5704-590f-483b-b291-00a2415cb67e', en: 'dda5319f-3b81-4124-b69e-9241eb510b77' }
};

// Post-processing mood per genre (maps to getMoodVoiceFilter / --audio-mood in master_and_qa.mjs)
export const GENRE_AUDIO_MOOD = Object.freeze({ horror: 'horror', funny: 'editorial', guide: 'documentary', news: 'documentary', story: 'vintage', motivational: 'editorial', default: 'none' });

export const AUDITION_LINES = Object.freeze({
  horror: { hi: 'कल रात घड़ी ठीक तीन बजे रुक गई, और तभी मुझे अपने पीछे किसी के साँस लेने की आवाज़ सुनाई दी।', en: 'Last night the clock stopped at exactly three, and that is when I heard someone breathing right behind me.' },
  funny: { hi: 'मैंने सोचा आज से डाइट शुरू करूँगा, फिर याद आया कि आज तो सोमवार नहीं है, तो कल से करेंगे।', en: 'I decided to start my diet today, then remembered it is not Monday, so obviously we start tomorrow.' },
  guide: { hi: 'सबसे पहले सेटिंग्स खोलिए, फिर प्राइवेसी में जाइए, और वहाँ से लोकेशन बंद कर दीजिए। बस, हो गया।', en: 'First open Settings, then go to Privacy, and turn Location off from there. That is all it takes.' },
  news: { hi: 'आज सुबह सरकार ने नई नीति का एलान किया, जिसका असर अगले महीने से दिखना शुरू होगा।', en: 'This morning the government announced a new policy, and its effects will start showing from next month.' },
  story: { hi: 'बहुत समय पहले एक छोटे से गाँव में एक बूढ़ा दर्ज़ी रहता था, जिसकी सुई कभी ग़लत नहीं चलती थी।', en: 'A long time ago, in a small village, there lived an old tailor whose needle never once went wrong.' },
  motivational: { hi: 'हार तब नहीं होती जब आप गिरते हैं, हार तब होती है जब आप उठना छोड़ देते हैं।', en: 'You do not lose when you fall. You lose when you decide not to get back up.' },
  default: { hi: 'नमस्ते! आज आपके लिए क्या पढ़ूँ? कोई कहानी, कोई ख़बर, या आपका अपना संदेश?', en: 'Hello! What should I read for you today? A story, some news, or your own message?' }
});

function normLang(lang) {
  const l = String(lang || 'en').toLowerCase();
  return l === 'hi' || l === 'hinglish' ? 'hi' : 'en';
}

function loadOverrides(file) {
  const p = file || path.join(os.homedir(), '.config', 'code-video-studio', 'voices.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

export function pickVoice({ provider = 'kalpa-labs', genre = 'default', lang = 'en', overridesFile = null } = {}) {
  const g = GENRES.includes(genre) ? genre : 'default';
  const l = normLang(lang);
  const ov = loadOverrides(overridesFile)?.[provider]?.[g]?.[l];
  if (ov) return { voice: ov, source: 'user-override' };
  if (provider === 'kalpa-labs') return { voice: KALPA_DEFAULTS[g][l], source: 'catalog-default-unverified' };
  return { voice: null, source: 'provider-default' };
}

// Delivery style per genre. Horror is slower, with room between lines for dread.
// tempo < 1 slows the voice (atempo); temperature is sent to providers that accept it (Kalpa: retried without it on 4xx).
export const GENRE_VOICE_STYLE = Object.freeze({
  horror: Object.freeze({ tempo: 0.95, temperature: 0.8, lineGapS: 0.5, sceneTailS: 0.3, perLine: true }),
  default: Object.freeze({ tempo: 1.0, temperature: null, lineGapS: 0.2, sceneTailS: 0.25, perLine: false })
});
export const HORROR_TEMPO_RANGE = Object.freeze([0.93, 1.0]);
export const HORROR_TEMPERATURE_RANGE = Object.freeze([0.75, 0.85]);
export const HORROR_PAUSE_RANGE_S = Object.freeze([0.4, 1.2]);

export function genreVoiceStyle(genre) {
  return GENRE_VOICE_STYLE[genre] || GENRE_VOICE_STYLE.default;
}
