// Story-format lint: standalone | serial | interactive.
// Runs on script.txt + brief.json (+ timeline.json, series bible, branches) BEFORE any audio or frames.
// Errors block render_and_lint (draft included) and make master_and_qa FIX. Warnings are surfaced only.
// Honest scope: this proves the story is STRUCTURALLY complete (planted clues before the twist, a payoff
// before any cliffhanger/CTA, a fork that comes after the payoff). It cannot prove the twist is good.
import fs from 'node:fs';
import path from 'node:path';
import { norm, words } from './horror_gate.mjs';

export const FORMATS = ['standalone', 'serial', 'interactive'];
export const FORMAT_DURATION = Object.freeze({
  standalone: [50, 75],
  serial: [60, 90],
  interactive: [60, 90]
});
export const SILENCE_BEAT = Object.freeze({ min: 0.8, max: 1.2 });
export const MIN_SPOKEN_LINES = 9;
export const MIN_ESCALATION = 3;

const PART_RX = /\bpart\s*[0-9०-९]+|\bpart\s+(two|three|2|3)|पार्ट\s*[0-9०-९]*|भाग\s*[0-9०-९]+|next reel|next part|agli reel|अगली\s*(रील|reel|वीडियो|पार्ट|कड़ी|कडी)|to be continued|जारी रहेगा|wahin ki/i;
const CTA_RX = /\bfollow\b|फ़ॉलो|फॉलो|\bcomment\b|कमेंट|\blike\b|लाइक|subscribe|सब्सक्राइब|\bshare\b|शेयर|\bsave\b|सेव कर/i;
const QUESTION_END_RX = /[?？]\s*["'”’]*\s*$/;
const OR_WAS_IT_RX = /or was it|was it really|या फिर\s*नहीं|क्या सच में|सच था या/i;
const VOTE_RX = /comment|कमेंट|poll|पोल|vote|वोट|बताओ|लिखो/i;

// Ordered events from a script: spoken lines, silence beats, sfx/scare cues.
export function parseStoryScript(text = '') {
  const events = [];
  const lines = [];
  let scene = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const sc = line.match(/^\[SCENE\s+([^\]]*)\]/i);
    if (sc) { scene = (sc[1].match(/id=(\S+)/) || [])[1] || null; events.push({ kind: 'scene', id: scene }); continue; }
    const si = line.match(/^\[SILENCE(?:\s+([^\]]*))?\]$/i);
    if (si) {
      const dur = Number(((si[1] || '').match(/dur=([0-9.]+)/) || [])[1] || 1.0);
      events.push({ kind: 'silence', dur, afterLine: lines.length - 1, scene });
      continue;
    }
    const sx = line.match(/^\[(SFX|SCARE)\s+([^\]]+)\]$/i);
    if (sx) {
      const name = (sx[2].match(/name=(\S+)/) || [])[1] || sx[2].trim();
      const scare = sx[1].toUpperCase() === 'SCARE' || /scare=(true|1)/i.test(sx[2]);
      events.push({ kind: 'sfx', name, scare, afterLine: lines.length - 1, scene });
      continue;
    }
    const sp = line.match(/^\[(NARRATOR|CHARACTER|WHISPER)\]\s*(.*)$/i);
    const body = (sp ? sp[2] : line).replace(/\[(SFX|SCARE)\s+[^\]]+\]/gi, '').replace(/\s+/g, ' ').trim();
    if (!body) continue;
    lines.push({ text: body, speaker: sp ? sp[1].toUpperCase() : 'NARRATOR', scene });
    events.push({ kind: 'line', idx: lines.length - 1, text: body, scene });
  }
  return { events, lines };
}

function readMaybe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function readJson(p) { const t = readMaybe(p); if (t == null) return null; try { return JSON.parse(t); } catch { return undefined; } }

// Find the first spoken line containing the quote (normalised). -1 if absent.
export function locate(lines, quote, from = 0) {
  const q = norm(quote || '');
  if (q.length < 3) return -1;
  for (let i = Math.max(0, from); i < lines.length; i++) if (norm(lines[i].text).includes(q)) return i;
  return -1;
}

const itemLine = (it) => (it && typeof it === 'object' ? it.line : null);

// Caption that contains a quote: used for timing checks on the real timeline.
function captionTimes(timeline, quote) {
  const q = norm(quote || '');
  if (!timeline || q.length < 3) return null;
  const caps = (timeline.captions || []).filter((c) => norm(c.text.replace(/\n/g, ' ')).includes(q) || q.includes(norm(c.text.replace(/\n/g, ' '))));
  if (!caps.length) return null;
  return { start: Math.min(...caps.map((c) => c.start_s)), end: Math.max(...caps.map((c) => c.end_s)) };
}

export function parseBible(md = '') {
  const sec = {};
  let key = null;
  for (const line of String(md).split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) { key = norm(h[1]).replace(/[^a-z ]/g, '').trim(); sec[key] = []; continue; }
    const b = line.match(/^\s*[-*]\s+(.+)$/);
    if (key && b) sec[key].push(b[1].trim());
  }
  const pick = (...names) => Object.entries(sec).filter(([k]) => names.some((n) => k.startsWith(n))).flatMap(([, v]) => v);
  return {
    characters: pick('characters', 'character'),
    places: pick('places', 'place'),
    rules: pick('rules', 'rule'),
    parts: pick('parts', 'part', 'revealed'),
    canon: pick('canon', 'facts'),
    open: pick('open threads', 'open')
  };
}

export function parseBranches(md = '') {
  const out = {};
  let cur = null;
  for (const line of String(md).split(/\r?\n/)) {
    const h = line.match(/^##\s*(?:option\s*|branch\s*)?([AB])\b/i);
    if (h) { cur = h[1].toUpperCase(); out[cur] = {}; continue; }
    const f = line.match(/^\s*[-*]?\s*(setup|escalation|payoff|dread)\s*:\s*(.+)$/i);
    if (cur && f) out[cur][f[1].toLowerCase()] = f[2].trim();
  }
  return out;
}

function structureChecks({ lines, events, err, warn, genre }) {
  if (lines.length < MIN_SPOKEN_LINES) err('lines_min', `${lines.length} spoken lines; a complete horror story needs >= ${MIN_SPOKEN_LINES}`);
  const sil = events.filter((e) => e.kind === 'silence');
  if (!sil.some((e) => e.dur >= SILENCE_BEAT.min && e.dur <= SILENCE_BEAT.max)) err('silence_beat', `no deliberate [SILENCE dur=${SILENCE_BEAT.min}-${SILENCE_BEAT.max}] beat`);
  sil.filter((e) => e.dur > SILENCE_BEAT.max).forEach((e) => warn('silence_long', `[SILENCE dur=${e.dur}] is over ${SILENCE_BEAT.max}s: the bed must carry room tone through it`));
  if (genre === 'horror') {
    const scares = events.filter((e) => e.kind === 'sfx' && e.scare);
    if (!scares.length) err('scare_cue', 'no [SCARE name=...] cue: the main scare must be a designed sound event');
    for (const s of scares) {
      const evIdx = events.indexOf(s);
      const prev = events.slice(0, evIdx).reverse().find((e) => e.kind !== 'sfx');
      if (!prev || prev.kind !== 'silence') warn('scare_after_silence', `[SCARE ${s.name}] is not directly preceded by a [SILENCE]: the pre-scare drop will be measured and may fail`);
    }
  }
}

function storyChecks({ story, lines, events, err, warn, genre }) {
  if (!story || typeof story !== 'object') {
    err('story_missing', 'brief.story missing: write { setup, rule_or_clue[], escalation[], false_relief, twist, ending_image, callback } before the script');
    structureChecks({ lines, events, err, warn, genre });
    return null;
  }
  const need = ['setup', 'rule_or_clue', 'escalation', 'false_relief', 'twist', 'ending_image', 'callback'];
  for (const k of need) if (story[k] == null || (Array.isArray(story[k]) && !story[k].length)) err('story_' + k, `brief.story.${k} missing`);
  const idx = {};
  const at = (label, it, from = 0) => {
    const q = itemLine(it);
    if (!q) { err(`line_${label}`, `story.${label} needs "line": an exact quote of the script line where it happens`); return -1; }
    const i = locate(lines, q, from);
    if (i < 0) err(`line_${label}`, `story.${label} line not found in script: "${q}"`);
    return i;
  };
  idx.twist = at('twist', story.twist);
  if (story.twist && story.twist.explains_hook !== true) err('twist_explains_hook', 'story.twist.explains_hook must be true: the twist must answer the hook');
  if (story.twist && (!story.twist.how || String(story.twist.how).length < 15)) err('twist_how', 'story.twist.how: one sentence on HOW the twist explains the hook');
  const clues = Array.isArray(story.rule_or_clue) ? story.rule_or_clue : [];
  if (clues.length < 2) err('clues_min', `${clues.length} rule_or_clue items; need >= 2 planted before the twist`);
  clues.forEach((c, i) => {
    const li = at(`rule_or_clue[${i}]`, c);
    if (li >= 0 && idx.twist >= 0 && li >= idx.twist) err(`clue_planted_${i}`, `rule_or_clue[${i}] is first planted at line ${li + 1}, not before the twist (line ${idx.twist + 1})`);
  });
  const esc = Array.isArray(story.escalation) ? story.escalation : [];
  if (esc.length < MIN_ESCALATION) err('escalation_min', `${esc.length} escalation beats; need >= ${MIN_ESCALATION}`);
  const escIdx = esc.map((e, i) => at(`escalation[${i}]`, e));
  if (new Set(escIdx.filter((i) => i >= 0)).size < Math.min(esc.length, MIN_ESCALATION)) err('escalation_distinct', 'escalation beats must sit on distinct lines');
  escIdx.forEach((li, i) => { if (li >= 0 && idx.twist >= 0 && li >= idx.twist) err(`escalation_order_${i}`, `escalation[${i}] (line ${li + 1}) comes after the twist`); });
  for (let i = 1; i < escIdx.length; i++) if (escIdx[i] >= 0 && escIdx[i - 1] >= 0 && escIdx[i] < escIdx[i - 1]) err('escalation_order', 'escalation beats are listed out of script order');
  idx.relief = at('false_relief', story.false_relief);
  if (idx.relief >= 0 && idx.twist >= 0 && idx.relief >= idx.twist) err('false_relief_order', 'false_relief must come before the twist');
  const lastEsc = Math.max(-1, ...escIdx);
  if (idx.relief >= 0 && lastEsc >= 0 && idx.relief < escIdx[0]) warn('false_relief_early', 'false_relief sits before the escalation starts; relief works best after the last escalation beat');
  // the callback echoes earlier words by design: search for it after the twist
  idx.callback = at('callback', story.callback, Math.max(0, idx.twist + 1));
  if (idx.callback >= 0 && idx.twist >= 0 && idx.callback < idx.twist) err('callback_order', 'callback must come after the twist');
  if (!story.ending_image || String(story.ending_image.text || story.ending_image).length < 10) err('ending_image', 'story.ending_image: describe the final image');
  if (story.threat && itemLine(story.threat.first_seen) && itemLine(story.threat.planted_by)) {
    const a = locate(lines, itemLine(story.threat.planted_by)), b = locate(lines, itemLine(story.threat.first_seen));
    if (a < 0 || b < 0 || a >= b) err('threat_planted', 'the threat appears before its reason is planted (story.threat.planted_by must precede first_seen)');
  }
  if (story.scare_pattern && story.previous_scare_pattern && norm(story.scare_pattern) === norm(story.previous_scare_pattern)) {
    err('scare_pattern_repeat', `same scare pattern as the previous reel ("${story.scare_pattern}")`);
  }
  structureChecks({ lines, events, err, warn, genre });
  const last = lines[lines.length - 1];
  return { idx, last };
}

export function lintStory({ brief = {}, scriptText = '', timeline = null, projectDir = null } = {}) {
  const errors = [];
  const warns = [];
  const err = (id, msg) => errors.push(`story/${id}: ${msg}`);
  const warn = (id, msg) => warns.push(`story/${id}: ${msg}`);
  const format = brief.format || 'standalone';
  if (!FORMATS.includes(format)) { err('format', `brief.format "${format}" must be ${FORMATS.join('|')}`); return { ok: false, errors, warns, format }; }
  const { events, lines } = parseStoryScript(scriptText);
  if (!lines.length) { err('script', 'script.txt has no spoken lines'); return { ok: false, errors, warns, format }; }
  const story = brief.story;
  const r = storyChecks({ story, lines, events, err, warn, genre: brief.genre });
  const twistIdx = r ? r.idx.twist : -1;
  const lastLine = lines[lines.length - 1];
  const D = Number(timeline?.duration_s) || null;

  // duration band per format
  const [lo, hi] = FORMAT_DURATION[format];
  if (D && (D < lo || D > hi)) err('duration', `${D.toFixed(1)}s is outside the ${lo}-${hi}s band for format "${format}"`);

  const partIdx = lines.map((l, i) => (PART_RX.test(l.text) ? i : -1)).filter((i) => i >= 0);
  const ctaIdx = lines.map((l, i) => (CTA_RX.test(l.text) ? i : -1)).filter((i) => i >= 0);

  if (format === 'standalone') {
    if (partIdx.length) err('no_parts', `standalone reel mentions a part/next reel at line ${partIdx[0] + 1}: "${lines[partIdx[0]].text}"`);
    const early = ctaIdx.filter((i) => twistIdx < 0 || i <= twistIdx);
    if (early.length) err('cta_before_payoff', `CTA at line ${early[0] + 1} comes before the payoff`);
    if (QUESTION_END_RX.test(lastLine.text)) err('ending_question', `ending is a question ("${lastLine.text}"): land on an image or a statement`);
    if (lines.slice(-2).some((l) => OR_WAS_IT_RX.test(l.text))) err('ending_or_was_it', '"or was it?" style ending: resolve the twist');
    if (brief.series || brief.choice) warn('format_extra', 'standalone brief carries series/choice fields; they are ignored');
  }

  if (format === 'serial' || format === 'interactive') {
    const s = brief.series;
    if (!s) err('series', 'brief.series missing: { id, part, of, bible_path, recap_line, next_hook }');
    else {
      for (const k of ['id', 'part', 'of', 'bible_path', 'next_hook']) if (s[k] == null || s[k] === '') err('series_' + k, `brief.series.${k} missing`);
      if (Number(s.part) > 1 && !s.recap_line && s.hook_is_recap !== true) err('series_recap_line', 'part 2+ needs series.recap_line (or series.hook_is_recap=true)');
      if (Number(s.part) > Number(s.of) && format === 'serial') err('series_part', `part ${s.part} > of ${s.of}`);
      // payoff of THIS part before the cliffhanger
      const payIdx = r ? locate(lines, itemLine(story?.part_payoff) || itemLine(story?.twist)) : -1;
      if (!story?.part_question || String(story.part_question).length < 10) err('part_question', 'story.part_question: the question THIS part answers');
      if (!itemLine(story?.part_payoff)) err('part_payoff', 'story.part_payoff.line: the line where this part\'s question is answered (reveal, death, rule broken)');
      const hookIdx = locate(lines, s.next_hook);
      if (s.next_hook && hookIdx < 0) err('next_hook_line', `series.next_hook not found in script: "${s.next_hook}"`);
      if (hookIdx >= 0 && payIdx >= 0 && hookIdx <= payIdx) err('cliff_after_payoff', 'the cliffhanger/next_hook comes before this part\'s payoff');
      if (story?.part_question && s.next_hook && norm(story.part_question) === norm(s.next_hook)) err('cliff_new_question', 'next_hook repeats this part\'s question; the cliffhanger must open a NEW question');
      if (hookIdx >= 0 && hookIdx < lines.length - 3) err('cliff_position', `next_hook is at line ${hookIdx + 1} of ${lines.length}; the cliffhanger is only the last few lines`);
      const early = ctaIdx.filter((i) => payIdx < 0 || i <= payIdx);
      if (early.length) err('cta_before_payoff', `CTA at line ${early[0] + 1} comes before this part's payoff`);
      const earlyPart = partIdx.filter((i) => payIdx < 0 || i <= payIdx);
      if (earlyPart.length) err('part_mention_early', `"part/next" mentioned at line ${earlyPart[0] + 1}, before this part's payoff`);
      if (D && timeline) {
        const tHook = captionTimes(timeline, s.next_hook);
        if (tHook && tHook.start < D - 5.5) err('cliff_last_5s', `cliffhanger starts at ${tHook.start.toFixed(1)}s; it may only occupy the last 3-5 s (from ${(D - 5).toFixed(1)}s)`);
        for (const i of ctaIdx) {
          const t = captionTimes(timeline, lines[i].text);
          if (t && t.start < D - 5.5) err('cta_last_5s', `CTA line ${i + 1} starts at ${t.start.toFixed(1)}s; CTA is allowed only in the last 5 s`);
        }
        if (Number(s.part) > 1 && s.recap_line && s.hook_is_recap !== true) {
          const tr = captionTimes(timeline, s.recap_line);
          if (!tr) err('recap_missing', 'recap_line not found in captions');
          else if (tr.start > 0.8 || tr.end > 8.0) err('recap_timing', `recap must open the reel and end by 8 s (got ${tr.start.toFixed(1)}-${tr.end.toFixed(1)}s)`);
        }
      }
      if (/title|card|intro/i.test(String((timeline?.scenes || [])[0]?.id || events.find((e) => e.kind === 'scene')?.id || ''))) err('title_open', 'never open on a title card');
      if (format === 'serial') {
        const closing = lastLine.text;
        if (!(PART_RX.test(closing) || CTA_RX.test(closing))) warn('closing_line', 'serial closing line should be a short plain "Part N coming, follow..."');
        if (words(closing).length > 14) warn('closing_short', `closing line is ${words(closing).length} words; keep it short`);
      }
      // series bible
      const bp = projectDir && s.bible_path ? path.resolve(projectDir, s.bible_path) : null;
      const bibleMd = bp ? readMaybe(bp) : null;
      if (!bibleMd) err('bible_missing', `series bible not found at ${s.bible_path || '(none)'}`);
      else {
        const bible = parseBible(bibleMd);
        const inList = (list, x) => list.some((e) => norm(e).includes(norm(x)));
        for (const c of story?.characters || []) if (!inList(bible.characters, c)) err('bible_character', `character "${c}" is not in the bible (## Characters)`);
        for (const p of story?.places || []) if (!inList(bible.places, p)) err('bible_place', `place "${p}" is not in the bible (## Places)`);
        for (const [i, c] of (story?.rule_or_clue || []).entries()) {
          if (c && c.type === 'rule' && !inList(bible.rules, c.text || '')) err('bible_rule', `rule_or_clue[${i}] is a rule not recorded in the bible (## Rules): "${c.text}"`);
        }
        for (const f of story?.new_facts || []) if (!inList([...bible.canon, ...bible.parts, ...bible.rules, ...bible.characters, ...bible.places], f)) err('bible_new_fact', `new fact not added to the bible: "${f}"`);
        if (!bible.parts.some((p) => new RegExp(`part\\s*${s.part}\\b|पार्ट\\s*${s.part}`, 'i').test(p))) err('bible_part_entry', `bible has no "## Parts" entry for part ${s.part} (what it revealed)`);
        const names = [...bible.characters, ...bible.places].map((e) => e.split(/[:(—-]/)[0].trim()).filter((n) => n.length >= 2);
        const scriptNorm = norm(lines.map((l) => l.text).join(' '));
        const declared = new Set([...(story?.characters || []), ...(story?.places || [])].map(norm));
        for (const n of names) if (scriptNorm.includes(norm(n)) && !declared.has(norm(n))) warn('bible_undeclared', `script uses bible name "${n}" but story.characters/places does not list it`);
      }
    }
  }

  if (format === 'interactive') {
    const c = brief.choice;
    if (!c) err('choice', 'brief.choice missing: { question, option_a, option_b, vote_channel, deadline_note }');
    else {
      for (const k of ['question', 'option_a', 'option_b', 'vote_channel', 'deadline_note']) if (!c[k]) err('choice_' + k, `brief.choice.${k} missing`);
      if (c.vote_channel && !['pinned_comment', 'story_poll'].includes(c.vote_channel)) err('vote_channel', 'vote_channel must be pinned_comment or story_poll (Reels have no poll sticker)');
      if (c.option_a && c.option_b && norm(c.option_a) === norm(c.option_b)) err('choice_distinct', 'option_a and option_b are the same');
      const qIdx = locate(lines, c.question);
      const payIdx = locate(lines, itemLine(story?.part_payoff) || itemLine(story?.twist));
      if (c.question && qIdx < 0) err('choice_line', 'choice.question is not spoken in the script');
      if (qIdx >= 0 && payIdx >= 0 && qIdx <= payIdx) err('fork_after_payoff', 'the fork comes before this part\'s payoff; the vote never replaces the payoff');
      const closing = lines.slice(-2).map((l) => l.text).join(' ');
      const namesBoth = (txt) => {
        const n = norm(txt);
        const hasA = (c.option_a && n.includes(norm(c.option_a))) || /(^|[\s"'(])a([\s,.।:)"']|$)/i.test(txt);
        const hasB = (c.option_b && n.includes(norm(c.option_b))) || /(^|[\s"'(])b([\s,.।:)"']|$)/i.test(txt);
        return hasA && hasB && VOTE_RX.test(txt);
      };
      if (!namesBoth(closing)) err('closing_names_options', 'spoken closing must name both options (A/B) and how to vote (comment/poll)');
      const finalCap = timeline ? (timeline.captions || []).slice(-2).map((x) => x.text).join(' ') : closing;
      if (!namesBoth(finalCap)) err('caption_names_options', 'final caption must name both options (A/B) and how to vote');
      const bmd = projectDir ? readMaybe(path.join(projectDir, 'branches.md')) : null;
      if (!bmd) err('branches_missing', 'branches.md missing: write both branches before posting');
      else {
        const b = parseBranches(bmd);
        for (const k of ['A', 'B']) {
          if (!b[k]) { err('branch_' + k, `branches.md has no "## ${k}" section`); continue; }
          for (const f of ['setup', 'escalation', 'payoff', 'dread']) if (!b[k][f] || b[k][f].length < 10) err(`branch_${k}_${f}`, `branch ${k} needs a "${f}:" line`);
        }
        if (b.A && b.B && b.A.payoff && b.B.payoff && norm(b.A.payoff) === norm(b.B.payoff)) err('branch_distinct', 'both branches have the same payoff: not a real fork');
        if (b.A && b.B && b.A.dread && b.B.dread && norm(b.A.dread) === norm(b.B.dread)) err('branch_dread', 'both branches promise the same dread: the choice must be earned');
      }
      const tree = projectDir ? readJson(path.join(projectDir, 'branch_tree.json')) : null;
      if (tree === null) err('branch_tree_missing', 'branch_tree.json missing');
      else if (tree === undefined) err('branch_tree_json', 'branch_tree.json is not valid JSON');
      else {
        const nodes = Array.isArray(tree.nodes) ? tree.nodes : [];
        const part = Number(brief.series?.part);
        const node = nodes.find((n) => Number(n.part) === part);
        if (!node) err('branch_tree_node', `branch_tree.json has no node for part ${part}`);
        else for (const k of ['choice', 'option_a', 'option_b']) if (!node[k]) err('branch_tree_' + k, `branch_tree node for part ${part} missing "${k}"`);
      }
    }
  }
  return { ok: errors.length === 0, errors, warns, format, spoken_lines: lines.length };
}

export function lintStoryProject(projectDir) {
  const rd = (f) => readMaybe(path.join(projectDir, f));
  let brief = {};
  try { brief = JSON.parse(rd('brief.json') || '{}'); } catch { /* */ }
  const script = rd('script.txt');
  let timeline = null;
  try { timeline = JSON.parse(rd('timeline.json') || 'null'); } catch { /* */ }
  const applies = brief.genre === 'horror' || Boolean(brief.format);
  if (!applies) return { ok: true, errors: [], warns: [], skipped: true };
  if (brief.smoke_test === true) return { ok: true, errors: [], warns: ['story: smoke_test brief, story lint skipped'], skipped: true };
  if (script == null) return { ok: false, errors: ['story/script: script.txt missing (horror and any brief.format need the script in the project)'], warns: [] };
  return lintStory({ brief, scriptText: script, timeline, projectDir });
}
