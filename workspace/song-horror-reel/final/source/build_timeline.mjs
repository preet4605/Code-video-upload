// Builds timeline.json for the cold-open cut (song offset 12.0 s). Captions-only, no voiceover.
import fs from 'node:fs';
const DUR = 42.36, FPS = 30;
const S = (id, a, b, mood, props) => ({ id, start_s: a, end_s: b, mood, ambient_motion: true, beats: splitBeats(a, b, props) });
function splitBeats(a, b, props) {
  const n = Math.max(1, Math.round((b - a) / 1.5)); const d = (b - a) / n;
  return Array.from({ length: n }, (_, i) => ({ t_s: Number((i * d).toFixed(3)), dur_s: Number(d.toFixed(3)), hold: false, flashes_per_sec: 0, animated_properties: props }));
}
const P = ['camera.path', 'camera.handheld', 'bulb.flicker', 'shadow.sway', 'dust.drift', 'grain.seed'];
const scenes = [
  S('hook', 0, 2.87, 'suspense', ['bulb.flicker', 'shadow.sway', 'camera.push', 'grain.seed', 'dust.drift']),
  S('rule', 2.87, 8.5, 'suspense', P),
  S('prints', 8.5, 11.9, 'suspense', [...P, 'drip.fall']),
  S('chase1', 11.9, 14.7, 'suspense', P),
  S('blackout', 14.7, 18.2, 'suspense', P),
  S('above', 18.2, 24.95, 'suspense', [...P, 'figure.step']),
  S('turn', 24.95, 25.4, 'climax', ['camera.whip', 'ca.hit', 'grain.seed']),
  S('relief', 25.4, 28.1, 'calm', ['shadow.sway', 'bulb.flicker', 'dust.drift', 'camera.creep']),
  S('twist', 28.1, 29.98, 'suspense', ['shadow.fade', 'shards.fall', 'bulb.flicker', 'camera.creep']),
  S('chase2', 29.98, 40.03, 'climax', [...P, 'figure.step', 'ca.hit']),
  S('door_loop', 40.03, DUR, 'suspense', ['drip.fall', 'light.strip', 'grain.seed', 'camera.creep'])
];
// captions: [text with \n, start, end, red word]
const C = [
  ['शादी से एक रात पहले,\nसीढ़ियों पर मेरे पीछे कोई चल रहा था।', 0.1, 3.6, 'पीछे'],
  ['दादी कहती थीं, पहली दुल्हन की\nचूड़ियाँ बजें, तो मुड़कर मत देखना।', 3.8, 8.2, 'मुड़कर'],
  ['गीले पैरों के निशान\nमुझसे आगे चढ़ रहे थे।', 8.5, 11.6, 'गीले'],
  ['हर क़दम पर पीछे\nचूड़ियाँ छनक रही थीं।', 11.9, 14.4, 'चूड़ियाँ'],
  ['बत्ती बुझती, और चूड़ियाँ\nएक क़दम पास आ जातीं।', 14.7, 18.0, 'पास'],
  ['ऊपर कोई खड़ा था, पीठ मेरी तरफ़,\nपानी टपकता हुआ।', 18.3, 21.9, 'पीठ'],
  ['मैंने मुड़कर देख लिया।', 23.9, 25.3, 'देख'],
  ['पीछे बस एक परछाईं थी,\nऔर छनकती चूड़ियाँ।', 25.5, 28.0, 'परछाईं'],
  ['देखते ही वो चली गईं। वो मुझे घर छोड़ने आई थीं,\nगीले साये से बचाकर।', 28.1, 32.0, 'बचाकर'],
  ['टूटी चूड़ियाँ उठाईं\nऔर भागा।', 32.2, 35.4, 'भागा'],
  ['अब सीढ़ियों पर मेरे पीछे\nकोई नहीं चलता।', 36.0, 38.6, 'नहीं'],
  ['वो दरवाज़े के बाहर\nखड़ा रहता है।', 38.8, 42.3, 'दरवाज़े']
];
const captions = C.map(([text, a, b, red], i) => ({ speaker: 'NARRATOR', text, start_s: a, end_s: b, safe_zone: true, line: i, red }));
const cues = [
  ['bulb_buzz_two_shadows', 0.07, -12], ['drip_slow', 9.6, -14], ['timer_light_click', 7.9, -10], ['bangles_shatter_stone', 28.95, -4],
  ['wet_step_descend', 36.0, -10], ['door_bolt_drip_under_door', 40.03, -3]
].map(([name, t, g]) => ({ type: 'sfx', name, t_s: t, gain_db: g }));
const tl = { version: '1.0', slug: 'dulhan-stairs', aspect: '9:16', width: 1080, height: 1920, fps: FPS, duration_s: DUR, target_lufs: -14, true_peak_dbtp: -1.5, audio_file: null, scenes, lines: captions.map((c) => ({ i: c.line, speaker: 'NARRATOR', text: c.text.replace(/\n/g, ' '), start_s: c.start_s, end_s: c.end_s })), words: [], captions, audio_cues: cues };
fs.writeFileSync('timeline.json', JSON.stringify(tl, null, 1));
console.log('ok', scenes.length, captions.length);
