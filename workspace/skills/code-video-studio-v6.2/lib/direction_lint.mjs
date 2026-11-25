// Direction-level lint: cheap, deterministic checks of the creative decisions that most often sink a reel.
// Returns warnings only (never errors): creative calls stay with the director, but they are always surfaced
// and they feed the SHIP/FIX verdict in scripts/qa_video.mjs.
import { getPlatform, QA_THRESHOLDS } from './profiles.mjs';
import { FORMAT_DURATION } from './story_lint.mjs';

export function lintDirection(timeline, brief = null, { platform = 'reels' } = {}) {
  const warnings = [];
  const plat = getPlatform(brief?.platform || platform);
  const dur = Number(timeline?.duration_s) || 0;

  // Hook: first words on screen / in audio fast enough
  const firstCaption = (timeline.captions || []).reduce((m, c) => Math.min(m, c.start_s), Infinity);
  const firstWord = (timeline.words || []).reduce((m, w) => Math.min(m, w.start_s), Infinity);
  const firstText = Math.min(firstCaption, firstWord);
  if (Number.isFinite(firstText) && firstText > QA_THRESHOLDS.firstCaptionMaxS) {
    warnings.push(`direction/hook: first words start at ${firstText.toFixed(2)}s (> ${QA_THRESHOLDS.firstCaptionMaxS}s). Open on the hook line; cut lead-in silence.`);
  }
  if (!Number.isFinite(firstText) && !timeline.audio_file) {
    warnings.push('direction/hook: no captions, words or audio found: nothing tells the viewer why to stay in the first 2 seconds.');
  }

  const isHorror = brief?.genre === 'horror';
  const format = brief?.format || (isHorror ? 'standalone' : null);
  // Duration band: horror and any story format use the format band (standalone 50-75 s, serial/interactive 60-90 s);
  // allow_long is implied for those ranges. Story completeness errors live in lib/story_lint.mjs.
  const [lo, hi] = format && FORMAT_DURATION[format] ? FORMAT_DURATION[format] : plat.idealDurationS;
  if (dur > 0 && (dur < lo || dur > hi) && (!brief?.allow_long || format)) {
    warnings.push(`direction/length: ${dur.toFixed(1)}s is outside the ${lo}-${hi}s band for ${format ? 'format ' + format : plat.id}. Tighten, or set brief.allow_long=true on purpose.`);
  }
  if (dur > plat.maxDurationS) {
    warnings.push(`direction/length: ${dur.toFixed(1)}s exceeds the ${plat.maxDurationS}s platform maximum for ${plat.id}.`);
  }

  // Retention: a visual change at least every ~4s. For horror, declared beats/animated_properties are NOT trusted:
  // motion is measured per scene on the render (lib/horror_measure.mjs), so this declaration check is skipped.
  if (isHorror) {
    const n = (timeline.lines || []).length || (timeline.captions || []).length;
    if (n > 0 && n < 9) warnings.push(`direction/lines: ${n} spoken lines; a complete horror story needs >= 9.`);
  }
  for (const sc of isHorror ? [] : timeline.scenes || []) {
    const d = sc.end_s - sc.start_s;
    const beats = (sc.beats || []).length;
    if (d > 4.5 && beats < Math.ceil(d / 4.5)) {
      warnings.push(`direction/pacing: scene "${sc.id}" runs ${d.toFixed(1)}s with ${beats} beat(s). Add a visible change (cut, zoom, new element) about every 4s.`);
    }
  }

  // Ending
  const last = (timeline.scenes || [])[timeline.scenes.length - 1];
  if (last) {
    const d = last.end_s - last.start_s;
    if (d > 6 && last.mood === 'calm') {
      warnings.push(`direction/ending: final scene "${last.id}" is ${d.toFixed(1)}s and calm: viewers leave before the end. End on the payoff or loop back to the hook.`);
    }
  }
  if (brief?.loop === true) {
    const hasCallback = (timeline.scenes || []).some((s) => /callback|loop|echo/i.test(s.id));
    if (!hasCallback) warnings.push('direction/loop: brief.loop=true but no scene id contains callback/loop/echo.');
  }

  // Sound design present at all
  const hasAudio = Boolean(timeline.audio_file) || (timeline.audio_cues || []).length > 0;
  if (!hasAudio) {
    warnings.push('direction/audio: no voiceover file and no audio cues. A silent or tone-only reel will not ship.');
  }

  // Caption timing honesty
  if ((timeline.words || []).length > 0 && timeline.audio_file) {
    const method = timeline.alignment?.method;
    if (!method || method === 'wpm-estimate' || method === 'linear-scale') {
      warnings.push('direction/captions: word timings are estimated, not aligned to the voiceover. Highlight-word captions and 1-3 frame anticipation will drift. Use audio_timeline.mjs alignment or provider timestamps.');
    }
  }

  // Brief present?
  if (!brief) {
    warnings.push('direction/brief: no brief.json in the project. Write the one-line hook, viewer, payoff and CTA first (see references/direction-playbook.md).');
  } else {
    for (const k of ['hook', 'payoff', 'platform']) {
      if (!brief[k]) warnings.push(`direction/brief: brief.json is missing "${k}".`);
    }
  }
  return warnings;
}
