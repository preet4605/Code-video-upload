// Single source of truth for safe zones, platform export profiles and QA thresholds.
// Reference frame is 1080x1920. Everything else scales by width/1080.
//
// Safe-zone numbers are cross-checked against Meta's Reels ads guide (top 14%,
// bottom 35%, sides 6%) and creator-side measurements of TikTok / Shorts UI
// (bottom 320-660 px, right rail ~120-185 px). Platforms change their UI;
// always eyeball qa_safezone_sheet.png and a real phone preview before posting.

export const REF_W = 1080;
export const REF_H = 1920;

// "universal" = works for organic IG Reels / YT Shorts / TikTok. Default.
// "ads"       = Meta Reels/Stories ad placements (largest bottom reserve).
export const SAFE_PROFILES = Object.freeze({
  universal: Object.freeze({ minX: 60, maxX: 900, minY: 270, maxY: 1440 }),
  ads: Object.freeze({ minX: 65, maxX: 900, minY: 270, maxY: 1248 })
});

export const DEFAULT_SAFE_PROFILE = 'universal';

export function getSafeProfile(name = DEFAULT_SAFE_PROFILE) {
  return SAFE_PROFILES[name] || SAFE_PROFILES[DEFAULT_SAFE_PROFILE];
}

// Bumped whenever encoder flags change, so cached segments are never mixed
// across encoder settings (it is folded into sceneHash).
export const ENCODER_VERSION = 'enc-2';

export const PLATFORMS = Object.freeze({
  reels: Object.freeze({ id: 'reels', maxDurationS: 180, idealDurationS: [7, 60], minFps: 30, targetLufs: -14, truePeak: -1.5, minWidth: 720, maxVideoKbps: 12000 }),
  shorts: Object.freeze({ id: 'shorts', maxDurationS: 180, idealDurationS: [15, 58], minFps: 24, targetLufs: -14, truePeak: -1.5, minWidth: 720, maxVideoKbps: 12000 }),
  tiktok: Object.freeze({ id: 'tiktok', maxDurationS: 180, idealDurationS: [9, 60], minFps: 24, targetLufs: -14, truePeak: -1.5, minWidth: 720, maxVideoKbps: 12000 })
});

export function getPlatform(name = 'reels') {
  return PLATFORMS[name] || PLATFORMS.reels;
}

// Thresholds used by scripts/qa_video.mjs. Every number here is a decision, not a law.
// Override per project with <project>/qa.json: { "thresholds": { "maxSilenceS": 3 } }.
// Per-scene creative exceptions: scene.allow_static / allow_black / allow_silence = true (downgrade to warnings).
export const QA_THRESHOLDS = Object.freeze({
  maxFlashesPerSec: 3, // WCAG 2.3.1
  flashLumaDelta: 40, // 0-255 YAVG swing that counts as a flash transition
  maxFreezeS: 1.2, // identical frames longer than this => FIX
  maxBlackS: 0.5, // black frames longer than this (outside first/last 0.1s)
  maxSilenceS: 2.0, // dead audio longer than this
  silenceDb: -45,
  hookMotionWindowS: 0.5, // something must visibly change in this window
  hookMinMotion: 0.004, // normalised mean abs frame difference
  firstCaptionMaxS: 0.8, // first on-screen words by this time
  minVoiceToBedLu: 9, // speech must sit this many LU above the bed
  minWidthShip: 1080 // below this the master is a draft
});

// Spoken pace used to size scripts from a target duration (words per minute).
// Hindi/Hinglish read slower than English because words are longer.
export const SPEECH_WPM = Object.freeze({ hi: 135, hinglish: 140, en: 150 });
