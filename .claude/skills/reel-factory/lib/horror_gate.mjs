// Horror craft gate: script heuristics + critique validator. Deterministic, no network.
// Honest scope: this catches thin / cliche / ungrounded / rubber-stamped scripts.
// It cannot prove a script is scary. A human must read it aloud.
import { SPEECH_WPM } from './profiles.mjs';

// NFC, strip nukta (so ख़ == ख), strip zero-width, collapse space, lowercase.
export function norm(s = '') {
  return String(s)
    .normalize('NFC')
    .replace(/़/g, '')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function words(s = '') {
  return norm(s).split(/[\s,.;:!?।…"'()\[\]—-]+/u).filter(Boolean);
}

export function parseScript(text = '') {
  const scenes = [];
  let cur = null;
  const ensure = () => cur || (cur = scenes[scenes.push({ id: 'scene_' + (scenes.length + 1), mood: 'suspense', lines: [], sfx: [] }) - 1]);
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const sc = line.match(/^\[SCENE\s+([^\]]*)\]/i);
    if (sc) {
      const id = (sc[1].match(/id=(\S+)/) || [])[1];
      const mood = (sc[1].match(/mood=(\S+)/) || [])[1];
      cur = scenes[scenes.push({ id: id || 'scene_' + (scenes.length + 1), mood: mood || 'suspense', lines: [], sfx: [] }) - 1];
      continue;
    }
    if (/^\[SILENCE(\s+[^\]]*)?\]$/i.test(line)) continue;
    const sfx = line.match(/^\[(?:SFX|SCARE)\s+([^\]]+)\]$/i);
    if (sfx) { ensure().sfx.push(((sfx[1].match(/name=(\S+)/) || [])[1]) || sfx[1].trim()); continue; }
    const sp = line.match(/^\[(NARRATOR|CHARACTER|WHISPER)\]\s*(.*)$/i);
    let body = sp ? sp[2] : line;
    body = body.replace(/\[SFX\s+([^\]]+)\]/gi, (_, i) => { ensure().sfx.push(((i.match(/name=(\S+)/) || [])[1]) || i.trim()); return ''; }).replace(/\s+/g, ' ').trim();
    if (body) ensure().lines.push(body);
  }
  return { scenes, lines: scenes.flatMap((s) => s.lines) };
}

// Words that signal told-not-shown / AI-tell horror. Matched on normalized text.
export const CLICHES = [
  'अचानक', 'खौफनाक', 'भयानक', 'डरावना', 'रहस्यमय', 'सन्नाटा छा गया', 'रूह काँप', 'रूह कांप', 'खून जम',
  'suddenly', 'eerie', 'spine-chilling', 'spine chilling', 'terrifying', 'creepy', 'chilling', 'blood ran cold',
  'little did', 'dark and stormy', 'mysterious', 'bone-chilling', 'shiver down'
].map(norm);
const FEAR_TELLS = ['डर लगा', 'डर गया', 'डर गई', 'घबरा', 'scared', 'terrified', 'afraid', 'frightened', 'fear'].map(norm);
// norm() strips the nukta (U+093C), so patterns must be matched without it too;
// otherwise words like खिड़की, दरवाज़ा, सीढ़ी can never match normalised text.
const deNukta = (rx) => new RegExp(rx.source.replace(/\u093C/g, ''), rx.flags);
const TIME_RX = /(\d{1,2}[:.]\d{2})|बजकर|मिनट|बजे|आधी रात|midnight|\ba\.?m\b|\bat \d|o'clock|तीन बजे|दो बजे|रात के/;
const RULE_RX = deNukta(/मत |कभी न|नियम|रूल|never|don'?t|do not|must not|rule|\bonly\b|सिर्फ़|सिर्फ/);
const FOLK_RX = deNukta(/कहा जाता|कहते हैं|कहती थी|कहते थे|मान्यता|नानी|दादी|बुज़ुर्ग|बुजुर्ग|they say|folk|old belief|elders|grandmother|my nani|my dadi|superstition|अंधविश्वास|पुरानी बात|\bnani\b|\bdadi\b|invented (family )?rule|folk belief/);
const DOMESTIC_RX = deNukta(/घर|कमरा|रसोई|दरवाज़ा|दरवाजा|बिस्तर|खिड़की|छत|सीढ़ी|सीढ़ियाँ|आँगन|पंखा|room|kitchen|door|bed|window|hallway|stairs|fan|apartment|flat|house|home/);

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function wordTarget({ durationS = 45, lang = 'hi' } = {}) {
  const wpm = SPEECH_WPM[lang] || SPEECH_WPM.hi;
  const mid = (durationS * wpm) / 60;
  return { wpm, mid: Math.round(mid), min: Math.max(80, Math.round(mid * 0.6)), max: Math.round(mid * 1.15) };
}

// Each check: { id, ok, severity: 'fail'|'warn', msg }
export function checkScript(text, brief = {}) {
  const p = parseScript(text);
  const all = p.lines;
  const joined = all.join(' ');
  const n = norm(joined);
  const wc = words(joined).length;
  const tgt = wordTarget({ durationS: brief.target_duration_s || brief.duration_s || 45, lang: brief.lang || 'hi' });
  const sfxCount = p.scenes.reduce((a, s) => a + s.sfx.length, 0);
  const out = [];
  const add = (id, ok, msg, severity = 'fail') => out.push({ id, ok: !!ok, severity: ok ? 'pass' : severity, msg });

  add('not_thin_words', wc >= tgt.min && wc <= tgt.max,
    `${wc} spoken words; need ${tgt.min}-${tgt.max} for ~${brief.target_duration_s || brief.duration_s || 45}s at ${tgt.wpm} wpm`);
  add('scene_count', p.scenes.length >= 5, `${p.scenes.length} scenes; need >= 5 distinct locations/beats`);
  add('sfx_designed', sfxCount >= 3, `${sfxCount} SFX cues; horror needs >= 3 designed sound events (sound carries the scare)`);
  const hookWords = all.length ? words(all[0]).length : 0;
  add('hook_short', hookWords > 0 && hookWords <= 14, `hook is ${hookWords} words; must be <= 14`);
  add('specific_time', TIME_RX.test(norm(joined)), 'no specific time (e.g. 3:07, तीन बजे) — dread needs a clock');
  add('rule_stated', RULE_RX.test(n), 'no explicit rule/prohibition (the night rule the viewer can remember)');
  add('folk_grounding', FOLK_RX.test(n), 'no folk/elder attribution (कहा जाता है / नानी कहती थी); label belief as belief, never as fact');
  add('domestic_setting', DOMESTIC_RX.test(n), 'no relatable domestic setting (room, kitchen, door)');
  const found = CLICHES.filter((c) => n.includes(c));
  add('no_cliches', found.length === 0, `cliche/AI-tell words: ${found.join(', ')}`);
  const tells = FEAR_TELLS.filter((c) => n.includes(c)).length;
  add('shown_not_told', tells <= 1, `${tells} direct fear statements ("डर लगा"); show the object, not the emotion`, 'warn');
  const HI_NUMS = /(?:^|\s)(दो|तीन|चार|पाँच|पांच|छह|छः|सात|आठ|नौ|दस|ग्यारह|बारह|तेरह|इक्कीस|सौ|हज़ार|हजार|ढाई|डेढ़|डेढ|साढ़े|साढे|two|three|four|five|seven|eleven|twelve)(?=[\s,.।!?"]|$)/gu;
  const digits = (joined.match(/[0-9०-९]+/g) || []).length + (norm(joined).match(HI_NUMS) || []).length;
  add('specificity', digits >= 2, `${digits} concrete numbers/times; add specifics (a time, two cups, counting to eleven)`, 'warn');
  if (/[\u0900-\u097F]/.test(joined)) {
    const raw = joined.match(/[0-9०-९]+/g) || [];
    add('tts_digits', raw.length === 0, `raw digits in Hindi spoken text (${raw.slice(0, 4).join(', ')}): TTS mispronounces them; spell as words (तीन बजकर सात मिनट). Show digits on screen instead`);
  }
  const last = all[all.length - 1] || '';
  const lastW = words(last);
  const hookSet = new Set(words(all[0] || '').filter((w) => w.length > 2));
  const echo = lastW.filter((w) => hookSet.has(w)).length;
  add('ending_short', lastW.length > 0 && lastW.length <= 18, `ending line is ${lastW.length} words; end hard, <= 18`);
  add('ending_echoes_hook', echo >= 1, 'last line shares no content word with the hook (no loop/callback)', 'warn');
  // sentence rhythm: horror needs short lines. Warn if the median line is long.
  const lens = all.map((l) => words(l).length).sort((a, b) => a - b);
  const med = lens[Math.floor(lens.length / 2)] || 0;
  add('short_lines', med <= 12, `median line is ${med} words; use clipped lines for dread`, 'warn');
  return { checks: out, stats: { words: wc, scenes: p.scenes.length, sfx: sfxCount, target: tgt }, parsed: p };
}

// ---- Idea mode ---------------------------------------------------------------
const IDEA_SECTIONS = ['logline', 'myth', 'beats', 'scare', 'ending'];
export function checkIdea(md = '') {
  const out = [];
  const add = (id, ok, msg, severity = 'fail') => out.push({ id, ok: !!ok, severity: ok ? 'pass' : severity, msg });
  const secs = {};
  let key = null;
  for (const line of String(md).split(/\r?\n/)) {
    const h = line.match(/^#{1,3}\s*(.+)$/);
    if (h) {
      const t = norm(h[1]);
      key = IDEA_SECTIONS.find((k) => t.startsWith(k) || t.startsWith('the ' + k)) || t;
      secs[key] = '';
    } else if (key) secs[key] += line + '\n';
  }
  for (const k of IDEA_SECTIONS) add('idea_' + k, (secs[k] || '').trim().length >= 25, `idea needs a "${k}" section (>= 25 chars)`);
  const beats = (secs.beats || '').split(/\n/).filter((l) => /^\s*(\d+[.)]|[-*])\s+\S/.test(l)).length;
  add('idea_beats', beats >= 6, `${beats} beats; need >= 6 (hook, rule, violation, escalation, turn, ending)`);
  add('idea_labelled', /\bidea\b|\bpitch\b/i.test(md.slice(0, 400)), 'label the deliverable IDEA/PITCH in the first lines so it is not mistaken for a script', 'warn');
  const n = norm(md);
  const found = CLICHES.filter((c) => n.includes(c));
  add('no_cliches', found.length === 0, `cliche/AI-tell words: ${found.join(', ')}`);
  add('folk_grounding', FOLK_RX.test(n), 'myth/rule must be labelled as folk belief or invented, never presented as verified fact');
  return { checks: out, stats: { beats } };
}

// ---- Critique validator ------------------------------------------------------
export const CRITIQUE_QUESTIONS = {
  stranger_test: 'A stranger hears only the first 3 seconds: do they stay, and can they say what the reel is about?',
  myth_grounding: 'Is the rule rooted in a labelled belief or a clear invented rule, not vague "something is wrong"?',
  relatability: 'Could the viewer be in this exact place tonight (own room, own mother, own door)?',
  violation: 'Is there one clear moment where the rule is broken or nearly broken?',
  consequence: 'Does the violation cause a concrete, physical consequence (not a mood)?',
  escalation: 'Does each beat raise stakes or reduce safety? Name beat N+1 being worse than N.',
  withholding: 'What is never shown or explained? Is the scariest thing left implied?',
  specificity: 'Which 3 details are so concrete they could not appear in any other horror script?',
  the_turn: 'Is there a late reveal that recontextualizes the opening line?',
  sound_scare: 'Does the scare land through a designed sound event (or its absence), not just narration?',
  ending_loop: 'Does the last line be short, final, and echo the hook so the viewer rewatches?',
  cliche_scan: 'List any cliche, adjective-for-fear, or AI-sounding line you kept, or confirm none.',
  code_visual_feasible: 'Can every scare be drawn in a 2D canvas (silhouette, light, gap, text) without video footage?',
  bluff_plot_without_adjectives: 'Strip every adjective: is there still a plot? List >= 4 plot events as exact quotes.'
};
const QIDS = Object.keys(CRITIQUE_QUESTIONS);

export function checkCritique(critique, scriptText, { mode = 'script', heuristicFails = 0 } = {}) {
  const out = [];
  const add = (id, ok, msg, severity = 'fail') => out.push({ id, ok: !!ok, severity: ok ? 'pass' : severity, msg });
  if (!critique || typeof critique !== 'object') {
    add('critique_present', false, 'critique.json missing or unreadable');
    return { checks: out, avg: 0, min: 0 };
  }
  add('critique_mode', critique.mode === mode, `critique.mode "${critique.mode}" != "${mode}" (idea vs script must be declared)`);
  const hay = norm(scriptText);
  const qs = Array.isArray(critique.answers) ? critique.answers : [];
  const byId = Object.fromEntries(qs.map((q) => [q.id, q]));
  const missing = QIDS.filter((id) => !byId[id]);
  add('critique_complete', missing.length === 0, `unanswered questions: ${missing.join(', ')}`);
  const scores = [];
  for (const id of QIDS) {
    const q = byId[id];
    if (!q) continue;
    const sc = q.score;
    if (!Number.isInteger(sc) || sc < 1 || sc > 5) { add('score_' + id, false, `${id}: score must be integer 1-5`); continue; }
    scores.push(sc);
    if (sc <= 2) add('score_' + id, false, `${id} scored ${sc}: REWRITE required`);
    const needsQuote = id !== 'cliche_scan' && id !== 'code_visual_feasible';
    if (needsQuote) {
      const ev = norm(q.evidence || '');
      const ok = ev.length >= 6 && hay.includes(ev);
      add('evidence_' + id, ok, `${id}: evidence quote ${ev ? 'not found verbatim in script' : 'missing'}`);
    } else if (!(q.note || q.evidence)) {
      add('note_' + id, false, `${id}: needs a note`);
    }
  }
  const plot = byId.bluff_plot_without_adjectives;
  const pe = Array.isArray(plot && plot.plot_events) ? plot.plot_events : [];
  const peOk = pe.length >= 4 && pe.every((e) => norm(e).length >= 6 && hay.includes(norm(e)));
  add('plot_events', peOk, `bluff test: need >= 4 plot_events, each an exact script quote (got ${pe.length})`);
  const wl = critique.weakest_line || {};
  const wlOk = wl.quote && wl.rewrite && hay.includes(norm(wl.quote)) && norm(wl.rewrite) !== norm(wl.quote);
  add('weakest_line', wlOk, 'weakest_line needs an exact script quote plus a different rewrite');
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const min = scores.length ? Math.min(...scores) : 0;
  add('uniform_scores', !(scores.length >= 8 && new Set(scores).size === 1), 'every answer has the same score: rubber-stamp, differentiate', 'fail');
  add('no_perfect_sheet', !(scores.length && avg >= 4.9), 'average >= 4.9 is not credible self-critique');
  const v = critique.verdict;
  add('verdict_valid', ['great', 'workable', 'rewrite', 'bluff'].includes(v), 'verdict must be great|workable|rewrite|bluff');
  if (v === 'great') add('verdict_earned', avg >= 4.2 && min >= 3, `"great" needs avg >= 4.2 and min >= 3 (got ${avg.toFixed(2)} / ${min})`);
  if (['great', 'workable'].includes(v)) add('verdict_vs_scores', min >= 3, `verdict "${v}" but a score is ${min} (<3)`);
  if (['great', 'workable'].includes(v) && heuristicFails > 0) add('verdict_vs_heuristics', false, `critique says "${v}" but ${heuristicFails} measured heuristic check(s) failed: the heuristics win`);
  if (['rewrite', 'bluff'].includes(v)) add('verdict_blocks', false, `critique verdict is "${v}": do not ship, rewrite first`);
  return { checks: out, avg: +avg.toFixed(2), min };
}

export function summarize(checks) {
  const fails = checks.filter((c) => c.severity === 'fail').map((c) => `${c.id}: ${c.msg}`);
  const warns = checks.filter((c) => c.severity === 'warn').map((c) => `${c.id}: ${c.msg}`);
  return { pass: fails.length === 0, fails, warns };
}

// =============================================================================
// Visual gates
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveBin } from './runtime.mjs';
import { getSafeProfile } from './profiles.mjs';

// Thresholds are decisions calibrated on the flagship vs. deliberately broken variants
// (see AUDIT.md "V4 calibration"). Override per project: qa.json { "horror": { ... } }.
export const HORROR_VISUAL = Object.freeze({
  sampleFps: 4,
  fieldTop: 0.12, // analysed band: top..bottom fraction of frame height.
  fieldBottom: 0.65, // Excludes the caption bar (starts ~0.665H) and platform UI.
  gw: 144, gh: 128,
  maxMeanLuma: 60, // scene mean luma above this => "not dark enough for horror" (FAIL)
  warnMeanLuma: 45,
  minP98: 30, // 98th percentile luma below this => mud, nothing readable (FAIL)
  minEdge: 0.008, // fraction of pixels with strong gradient below this => empty frame (FAIL)
  escalationMin: 1.15, // last-third motion / first-third motion below this => FAIL
  escalationWarn: 1.4, // last-third / first-third motion below this is "weak escalation"
  // Horror enforcement: weak escalation (< escalationWarn) is a FAIL, not a warning. Escape hatch:
  // qa.json { "horror": { "escalationWeakIsFail": false } } (or lower "escalationWarn"): then it is a warning again.
  escalationWeakIsFail: true
});

export function checkShotlist(shotlist, timeline, { safeProfile = 'universal', scriptText = null } = {}) {
  const out = [];
  const add = (id, ok, msg, severity = 'fail') => out.push({ id, ok: !!ok, severity: ok ? 'pass' : severity, msg });
  if (!shotlist || !Array.isArray(shotlist.scenes)) {
    add('shotlist_present', false, 'shotlist.json missing: declare subject/layers/light/focal/motion/details/withheld per scene');
    return { checks: out };
  }
  const by = Object.fromEntries(shotlist.scenes.map((x) => [x.id, x]));
  const sp = getSafeProfile(safeProfile);
  const ints = [];
  for (const sc of timeline.scenes || []) {
    const e = by[sc.id];
    if (!e) { add('shot_' + sc.id, false, `scene "${sc.id}" has no shotlist entry`); continue; }
    const miss = [];
    if (!e.subject || String(e.subject).length < 8) miss.push('subject');
    for (const l of ['foreground', 'midground', 'background']) if (!e.layers || !e.layers[l] || String(e.layers[l]).length < 5) miss.push('layers.' + l);
    if (!e.light_source || String(e.light_source).length < 5) miss.push('light_source');
    if (!e.withheld || String(e.withheld).length < 8) miss.push('withheld');
    if (!e.motion || /^(none|static)$/i.test(String(e.motion).trim())) miss.push('motion (static is not allowed)');
    const det = Array.isArray(e.details) ? e.details.filter((d) => String(d).trim().length >= 6) : [];
    if (new Set(det).size < 4) miss.push(`details (${det.length}/4 distinct)`);
    const fp = e.focal_point;
    if (!Array.isArray(fp) || fp.length !== 2) miss.push('focal_point [x,y] in 1080x1920 units');
    else if (fp[0] < sp.minX || fp[0] > sp.maxX || fp[1] < sp.minY || fp[1] > sp.maxY) miss.push(`focal_point ${fp} outside safe zone`);
    if (!e.camera || /^(none|static|locked)$/i.test(String(e.camera).trim()) || String(e.camera).length < 6) miss.push('camera (a move: push-in, pan, dolly, handheld...)');
    if (!e.sound_cue || String(e.sound_cue).length < 3) miss.push('sound_cue');
    if (!e.sync_word) miss.push('sync_word');
    else if (scriptText != null && !norm(scriptText).includes(norm(e.sync_word))) miss.push(`sync_word "${e.sync_word}" not in script`);
    if (!Number.isInteger(e.intensity) || e.intensity < 1 || e.intensity > 5) miss.push('intensity 1-5');
    else ints.push(e.intensity);
    add('shot_' + sc.id, miss.length === 0, `scene "${sc.id}" shotlist incomplete: ${miss.join(', ')}`);
  }
  if (ints.length >= 4) {
    const half = Math.floor(ints.length / 2);
    const early = Math.max(...ints.slice(0, half)), late = Math.max(...ints.slice(half));
    add('intensity_escalates', late > early && new Set(ints).size >= 3, `declared intensity must rise toward the end and vary (${ints.join(',')})`);
  }
  return { checks: out };
}

// Global camera translation between consecutive field frames (px at gw wide), coarse SAD search.
export function cameraShift(prev, cur, gw, gh, r = 3) {
  let best = Infinity, bx = 0, by = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      let sad = 0, n = 0;
      for (let y = r; y < gh - r; y += 2) {
        for (let x = r; x < gw - r; x += 2) { sad += Math.abs(cur[y * gw + x] - prev[(y + dy) * gw + (x + dx)]); n++; }
      }
      sad /= n;
      if (sad < best - 1e-9) { best = sad; bx = dx; by = dy; }
    }
  }
  return Math.hypot(bx, by);
}

function pct(hist, total, p) {
  let acc = 0;
  const target = total * p;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= target) return i; }
  return 255;
}

export function analyzeVisualField(mp4, { thresholds = HORROR_VISUAL, withCamera = false } = {}) {
  const ffmpeg = resolveBin('ffmpeg');
  const T = thresholds;
  const vf = `fps=${T.sampleFps},crop=iw:ih*${(T.fieldBottom - T.fieldTop).toFixed(3)}:0:ih*${T.fieldTop},scale=${T.gw}:${T.gh}:flags=area,format=gray`;
  const r = spawnSync(ffmpeg, ['-v', 'error', '-i', mp4, '-an', '-vf', vf, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 29 });
  if (r.status !== 0) throw new Error('horror visual analysis failed: ' + String(r.stderr).slice(0, 300));
  const buf = r.stdout;
  const N = T.gw * T.gh;
  const frames = Math.floor(buf.length / N);
  const out = [];
  let prev = null;
  for (let f = 0; f < frames; f++) {
    const px = buf.subarray(f * N, (f + 1) * N);
    const hist = new Uint32Array(256);
    let sum = 0, edges = 0, diff = 0;
    for (let i = 0; i < N; i++) {
      const v = px[i];
      hist[v]++; sum += v;
      const x = i % T.gw;
      if (x < T.gw - 1 && i + T.gw < N) {
        const g = Math.abs(v - px[i + 1]) + Math.abs(v - px[i + T.gw]);
        if (g > 24) edges++;
      }
      if (prev) diff += Math.abs(v - prev[i]);
    }
    out.push({ t: f / T.sampleFps, mean: sum / N, p98: pct(hist, N, 0.98), edge: edges / N, motion: prev ? diff / N / 255 : null, cam: withCamera && prev ? cameraShift(prev, px, T.gw, T.gh) : null });
    prev = Buffer.from(px);
  }
  return out;
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export function evaluateVisual(samples, timeline, { thresholds = HORROR_VISUAL, sceneAllow = {} } = {}) {
  const T = thresholds;
  const out = [];
  const add = (id, ok, msg, severity = 'fail') => out.push({ id, ok: !!ok, severity: ok ? 'pass' : severity, msg });
  const perScene = [];
  for (const sc of timeline.scenes || []) {
    const ss = samples.filter((s) => s.t >= sc.start_s + 0.25 && s.t < sc.end_s - 0.1);
    if (!ss.length) { add('vis_' + sc.id, false, `scene "${sc.id}" too short to measure`, 'warn'); continue; }
    const m = {
      id: sc.id,
      mean: +avg(ss.map((s) => s.mean)).toFixed(1),
      p98: +avg(ss.map((s) => s.p98)).toFixed(1),
      edge: +avg(ss.map((s) => s.edge)).toFixed(4),
      motion: +avg(ss.filter((s) => s.motion != null).map((s) => s.motion)).toFixed(4)
    };
    perScene.push(m);
    const allow = new Set(sceneAllow[sc.id] || []);
    if (m.mean > T.maxMeanLuma) add(`bright_${sc.id}`, allow.has('bright'), `scene "${sc.id}" mean luma ${m.mean} > ${T.maxMeanLuma}: too bright for horror (allow: "bright")`, allow.has('bright') ? 'warn' : 'fail');
    else if (m.mean > T.warnMeanLuma) add(`bright_${sc.id}`, false, `scene "${sc.id}" mean luma ${m.mean} is on the bright side (> ${T.warnMeanLuma})`, 'warn');
    if (m.p98 < T.minP98) add(`mud_${sc.id}`, allow.has('mud'), `scene "${sc.id}" p98 luma ${m.p98} < ${T.minP98}: mud, nothing readable (allow: "mud")`, allow.has('mud') ? 'warn' : 'fail');
    if (m.edge < T.minEdge) add(`empty_${sc.id}`, allow.has('empty'), `scene "${sc.id}" edge density ${m.edge} < ${T.minEdge}: empty/underdetailed frame (allow: "empty")`, allow.has('empty') ? 'warn' : 'fail');
  }
  const D = timeline.duration_s || (samples.length / T.sampleFps);
  const mo = (a, b) => avg(samples.filter((s) => s.motion != null && s.t >= a && s.t < b).map((s) => s.motion));
  const first = mo(0.25, D / 3), last = mo((2 * D) / 3, D - 1.5);
  const ratio = first > 0 ? last / first : 0;
  if (ratio < T.escalationMin) add('escalation', false, `motion does not escalate: last-third / first-third = ${ratio.toFixed(2)} (< ${T.escalationMin})`);
  else if (ratio < T.escalationWarn) add('escalation', false, `weak escalation ${ratio.toFixed(2)} (< ${T.escalationWarn})${T.escalationWeakIsFail === false ? '' : ': horror must escalate (qa.json horror.escalationWeakIsFail=false to accept)'}`, T.escalationWeakIsFail === false ? 'warn' : 'fail');
  else add('escalation', true, `escalation ${ratio.toFixed(2)}`);
  return { checks: out, perScene, escalation: +ratio.toFixed(2) };
}

export function makeSceneSheet(mp4, timeline, outPng) {
  const ffmpeg = resolveBin('ffmpeg');
  const tmp = fs.mkdtempSync(path.join(path.dirname(outPng), '.sheet_'));
  try {
    const files = [];
    let k = 0;
    for (const sc of timeline.scenes || []) {
      for (const f of [0.15, 0.5, 0.88]) {
        const t = sc.start_s + (sc.end_s - sc.start_s) * f;
        const fp = path.join(tmp, `f_${String(k++).padStart(3, '0')}.png`);
        spawnSync(ffmpeg, ['-v', 'error', '-y', '-ss', t.toFixed(2), '-i', mp4, '-frames:v', '1', '-vf', 'scale=270:-2', fp]);
        if (fs.existsSync(fp)) files.push(fp);
      }
    }
    if (!files.length) return null;
    const rows = Math.ceil(files.length / 3);
    const r = spawnSync(ffmpeg, ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(tmp, 'f_%03d.png'), '-vf', `tile=3x${rows}:padding=6:color=0x202020`, '-frames:v', '1', outPng]);
    return r.status === 0 ? outPng : null;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Whole visual gate for a project + rendered MP4. smoke_test briefs get fails downgraded to warns.
export function runHorrorVisualGate({ mp4, projectDir, writeSheet = true }) {
  const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(projectDir, f), 'utf8')); } catch { return null; } };
  const timeline = rd('timeline.json') || { scenes: [] };
  const brief = rd('brief.json') || {};
  const qa = rd('qa.json') || {};
  const thresholds = { ...HORROR_VISUAL, ...(qa.horror || {}) };
  const checks = [];
  let scriptText = null;
  try { scriptText = fs.readFileSync(path.join(projectDir, 'script.txt'), 'utf8'); } catch { /* none */ }
  const shot = checkShotlist(rd('shotlist.json'), timeline, { scriptText });
  checks.push(...shot.checks);
  const samples = analyzeVisualField(mp4, { thresholds });
  const ev = evaluateVisual(samples, timeline, { thresholds, sceneAllow: qa.scene_allow || {} });
  checks.push(...ev.checks);
  let sheet = null;
  if (writeSheet) sheet = makeSceneSheet(mp4, timeline, path.join(path.dirname(mp4), 'qa_scene_sheet.png'));
  const smoke = brief.smoke_test === true;
  const s = summarize(checks);
  if (smoke) return { pass: true, fails: [], warns: [...s.fails.map((x) => '[smoke] ' + x), ...s.warns], perScene: ev.perScene, escalation: ev.escalation, sheet, smoke: true };
  return { ...s, perScene: ev.perScene, escalation: ev.escalation, sheet, smoke: false };
}

// ---- Visual-loop enforcement ---------------------------------------------------
// scripts/visual_loop.mjs writes <project>/visual_loop/log.json. Horror may not SHIP without a converged loop.
// Escape hatch (explicit): qa.json { "require_visual_loop": false } downgrades "not run" to a warning.
// qa.json { accept_unconverged_loop: { reason, by, date } } (non-empty reason) downgrades "not converged" to a recorded WARN.
// smoke_test briefs also downgrade. Non-horror genres: not run = warning (unchanged), unconverged = FIX.
function remainingFailures(projectDir, last) {
  const out = [];
  try {
    const rep = JSON.parse(fs.readFileSync(path.join(projectDir, 'visual_loop', `iter_${String(last.iter).padStart(2, '0')}`, 'report.json'), 'utf8'));
    for (const r of rep.shots || []) if (r.pass === false) out.push(`${r.id}: ${(r.deficits || []).map((d) => `${d.metric} ${d.value} (${d.target})`).join(', ') || 'failed'}`);
  } catch {
    for (const r of last?.shots || []) if (r.pass === false) out.push(`${r.id}: failed (no report.json)`);
  }
  return out;
}
export function applyVisualLoopGate(ship, projectDir, brief = {}, qa = {}) {
  const horror = !!brief && brief.genre === 'horror';
  const required = horror && qa.require_visual_loop !== false && brief.smoke_test !== true;
  let vlog = null;
  try { vlog = JSON.parse(fs.readFileSync(path.join(projectDir, 'visual_loop', 'log.json'), 'utf8')); } catch { /* not run */ }
  const iters = vlog && Array.isArray(vlog.iterations) ? vlog.iterations : [];
  if (!iters.length) {
    if (required) {
      ship.fails.push(`visual-loop: not run (required for horror). Fix: run scripts/visual_loop.mjs --project ${projectDir} and iterate until LOOP PASS`);
      ship.verdict = 'FIX';
    } else {
      const why = horror ? (brief.smoke_test === true ? ' [smoke_test]' : ' [waived by qa.json require_visual_loop=false]') : '';
      ship.warns.push(`visual-loop: not run${why}. Run scripts/visual_loop.mjs --project <dir> and iterate until LOOP PASS (references/visual-loop.md)`);
    }
    return { run: false, required };
  }
  const last = iters[iters.length - 1];
  ship.visual_loop = { iterations: iters.length, last_pass: last?.pass ?? false, critique_min: last?.critique_min ?? null, mean_score: last?.mean_score ?? null };
  if (last?.critique_na?.length) ship.visual_loop.critique_na = last.critique_na;
  if (!(last && last.pass && (last.critique_min ?? 0) >= 3)) {
    const msg = `visual-loop: not converged (iteration ${last?.iter}: metrics ${last?.pass ? 'pass' : 'fail'}, critique min ${last?.critique_min ?? 'missing'})`;
    const w = qa.accept_unconverged_loop;
    const reason = w && typeof w === 'object' && typeof w.reason === 'string' ? w.reason.trim() : '';
    if (reason) {
      const remaining = remainingFailures(projectDir, last);
      const waiver = { type: 'accept_unconverged_loop', reason, by: w.by ?? null, date: w.date ?? null, iteration: last?.iter ?? null, metrics_pass: !!last?.pass, critique_min: last?.critique_min ?? null, remaining_failing: remaining };
      ship.waivers = [...(ship.waivers || []), waiver];
      ship.visual_loop.waived_unconverged = true;
      ship.warns.push(`${msg} [WAIVED accept_unconverged_loop by ${waiver.by || '?'} ${waiver.date || '?'}: ${reason}] Remaining failing shots: ${remaining.length ? remaining.join('; ') : 'none in metrics (critique min below 3 only)'}`);
      ship.unverified = ship.unverified || [];
      ship.unverified.push(`visual-loop did NOT converge; accepted by waiver (${waiver.by || '?'}, ${waiver.date || '?'}): ${reason}. Remaining failing shots: ${remaining.length ? remaining.join('; ') : 'critique only'}`);
    } else {
      ship.fails.push(`${msg}. Run scripts/visual_loop.mjs until LOOP PASS${w ? ' (accept_unconverged_loop ignored: "reason" is empty)' : ''}`);
      ship.verdict = 'FIX';
    }
  }
  return { run: true, required };
}
