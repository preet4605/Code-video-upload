// Word-timing alignment. Replaces "evenly spaced words, then linearly stretched to the audio length".
//
// Strategies, best first (audio_timeline.mjs picks the best available and records it in
// timeline.alignment.method so QA can tell the director how much to trust highlight-word captions):
//   1. provider-vtt            TTS provider returned per-word cues (frame accurate).
//   2. provider-sentence-vtt   provider returned sentence cues; words are weighted inside each cue.
//   3. voiced-span-weighted    no timestamps: measure where speech really is (silencedetect), spread
//                              words over the voiced time by syllable-ish weight. Silences stay silent.
//   4. wpm-estimate            legacy fallback (flagged as estimated).
// None of these is forced alignment by an ASR model. If frame-accurate highlights matter, use a
// provider that returns word timestamps, or run a local aligner and write its words into timeline.words
// (then set timeline.alignment.method to 'provider-vtt').
import { spawnSync } from 'node:child_process';

const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const glen = (s) => {
  let n = 0;
  for (const _ of seg.segment(s)) n++;
  return n;
};
const r3 = (n) => Math.round(n * 1000) / 1000;

// Devanagari akshara count: a consonant cluster (consonants joined by virama) or an independent vowel is one
// akshara; matras, anusvara, chandrabindu, visarga, nukta attach to the akshara they follow.
const DEVA_RE = /[\u0900-\u097F]/;
export function aksharaCount(core) {
  let n = 0;
  let afterVirama = false;
  for (const ch of core) {
    const c = ch.codePointAt(0);
    if (c === 0x094d) { afterVirama = true; continue; }
    const consonant = (c >= 0x0915 && c <= 0x0939) || (c >= 0x0958 && c <= 0x095f);
    const indepVowel = (c >= 0x0904 && c <= 0x0914) || c === 0x0960 || c === 0x0961;
    if (consonant) { if (!afterVirama) n++; }
    else if (indepVowel) n++;
    else if (!(c >= 0x0900 && c <= 0x097f)) n++; // Latin / digit inside a mixed token: one unit per character
    afterVirama = false;
  }
  return n;
}

export function wordWeight(word) {
  const core = String(word).replace(/[^\p{L}\p{N}\p{M}]/gu, '');
  const units = DEVA_RE.test(core) ? aksharaCount(core) : glen(core.replace(/\p{M}/gu, ''));
  return Math.max(1, units) + 1.2; // per-word onset cost
}

// ---------- voiced spans ----------

export function parseVoicedSpans(stderr, totalDur, { pad = 0.02 } = {}) {
  const sil = [];
  let start = null;
  for (const line of String(stderr).split(/\r?\n/)) {
    const ms = line.match(/silence_start:\s*([0-9.eE+-]+)/);
    const me = line.match(/silence_end:\s*([0-9.eE+-]+)/);
    if (ms) start = Number(ms[1]);
    if (me && start !== null) {
      sil.push([Math.max(0, start), Number(me[1])]);
      start = null;
    }
  }
  if (start !== null) sil.push([Math.max(0, start), totalDur]);
  const spans = [];
  let cur = 0;
  for (const [a, b] of sil) {
    if (a - cur > 0.03) spans.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (totalDur - cur > 0.03) spans.push([cur, totalDur]);
  // soften edges so words do not start exactly on the first audible sample
  return spans.map(([a, b]) => [Math.max(0, a - pad), Math.min(totalDur, b + pad)]);
}

export function detectVoicedSpans(ffmpegBin, audioPath, totalDur, { db = -35, minSilence = 0.1 } = {}) {
  const res = spawnSync(
    ffmpegBin,
    ['-hide_banner', '-i', audioPath, '-vn', '-af', `highpass=f=120,silencedetect=n=${db}dB:d=${minSilence}`, '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  if (res.status !== 0) throw new Error(`detectVoicedSpans failed: ${(res.stderr || '').slice(0, 300)}`);
  const spans = parseVoicedSpans(res.stderr, totalDur);
  return spans.length ? spans : [[0, totalDur]];
}

// voiced-time -> real time
function voicedToReal(spans, vt, isStart = false) {
  // A boundary that falls exactly between two spans belongs to the NEXT span for a word start
  // and to the PREVIOUS span for a word end, so words never straddle a pause.
  let acc = 0;
  for (let i = 0; i < spans.length; i++) {
    const [a, b] = spans[i];
    const len = b - a;
    const inside = isStart ? vt < acc + len - 1e-9 : vt <= acc + len + 1e-9;
    if (inside || i === spans.length - 1) return a + Math.max(0, Math.min(len, vt - acc));
    acc += len;
  }
  return spans[spans.length - 1][1];
}

const BREAK_RE = /[.,;:!?\u0964\u2014]["'\u201d)]?$/;

// Silences this long (after the 0.02 s edge padding of each span, i.e. ~0.15 s raw) are real pauses: no word may span one.
export const ISLAND_GAP = 0.11;
const MIN_ISLAND_S = 0.08;

// Merge spans separated by short gaps into "islands" of continuous speech; drop click-sized islands.
function toIslands(spans) {
  const isl = [];
  for (const sp of spans) {
    const last = isl[isl.length - 1];
    if (last && sp[0] - last[last.length - 1][1] < ISLAND_GAP) last.push(sp);
    else isl.push([sp]);
  }
  const dur = (g) => g.reduce((x, [a, b]) => x + (b - a), 0);
  const kept = isl.filter((g) => dur(g) >= MIN_ISLAND_S);
  return kept.length ? kept : isl;
}

// Split a word group over the islands of its spans so no word crosses a real pause.
function distributeGroup(words, idxs, spans, out) {
  let isl = toIslands(spans);
  if (isl.length > idxs.length) { // more pauses than words: keep the longest islands, in time order
    const dur = (g) => g.reduce((x, [a, b]) => x + (b - a), 0);
    const keep = new Set([...isl].sort((a, b) => dur(b) - dur(a)).slice(0, idxs.length));
    isl = isl.filter((g) => keep.has(g));
  }
  if (isl.length <= 1) return distribute(words, idxs, isl.length ? isl[0] : spans, out);
  const dur = isl.map((g) => g.reduce((x, [a, b]) => x + (b - a), 0));
  const totalD = dur.reduce((x, y) => x + y, 0);
  const w = idxs.map((i) => wordWeight(words[i].word));
  const W = w.reduce((x, y) => x + y, 0);
  const cum = [];
  w.reduce((a, x, k) => (cum[k] = a + x), 0);
  const cuts = []; // word index (within idxs) after which island j ends
  let cd = 0, prev = -1;
  for (let j = 0; j < isl.length - 1; j++) {
    cd += dur[j];
    const target = cd / totalD;
    const lo = prev + 1;
    const hi = idxs.length - 1 - (isl.length - 1 - j); // leave >= 1 word for each later island
    let best = lo, bestD = Infinity;
    for (let k = lo; k <= hi; k++) {
      const d = Math.abs(cum[k] / W - target);
      if (d < bestD) { bestD = d; best = k; }
    }
    cuts.push(best);
    prev = best;
  }
  cuts.push(idxs.length - 1);
  let from = 0;
  cuts.forEach((c, j) => {
    distribute(words, idxs.slice(from, c + 1), isl[j], out);
    from = c + 1;
  });
}

function distribute(words, idxs, spans, out) {
  if (!idxs.length || !spans.length) return;
  const total = spans.reduce((x, [a, b]) => x + (b - a), 0);
  const w = idxs.map((i) => wordWeight(words[i].word));
  const wsum = w.reduce((x, y) => x + y, 0);
  let acc = 0;
  idxs.forEach((i, k) => {
    const v0 = (acc / wsum) * total;
    acc += w[k];
    const v1 = (acc / wsum) * total;
    out[i] = { ...words[i], start_s: r3(voicedToReal(spans, v0, true)), end_s: r3(voicedToReal(spans, v1, false)) };
  });
}

/**
 * words: [{word,start_s,end_s,...}] -> same words, re-timed over the voiced spans.
 * Real pauses (>= phraseGap) are matched to punctuation breaks in the text, so a sentence break in
 * the script lands on the pause in the audio instead of being averaged across it.
 */
export function alignWordsToVoicedSpans(words, spans, { phraseGap = 0.25 } = {}) {
  if (!words.length) return [];
  const out = new Array(words.length);
  // phrase segments: merge spans separated by short gaps
  const segs = [];
  for (const sp of spans) {
    const last = segs[segs.length - 1];
    if (last && sp[0] - last[last.length - 1][1] < phraseGap) last.push(sp);
    else segs.push([sp]);
  }
  const segDur = segs.map((g) => g.reduce((x, [a, b]) => x + (b - a), 0));
  const totalV = segDur.reduce((x, y) => x + y, 0) || 1;
  const weights = words.map((w) => wordWeight(w.word));
  const wsum = weights.reduce((x, y) => x + y, 0);
  const cumW = [];
  weights.reduce((acc, w, i) => (cumW[i] = acc + w), 0);

  // choose a word break for each internal segment boundary
  const chosen = []; // { after: wordIndex, seg: segmentIndex }
  let cumV = 0;
  let prevAfter = -1;
  for (let j = 0; j < segs.length - 1; j++) {
    cumV += segDur[j];
    const target = cumV / totalV;
    let best = -1;
    let bestD = Infinity;
    for (let i = prevAfter + 1; i < words.length - 1; i++) {
      if (!BREAK_RE.test(words[i].word)) continue;
      const d = Math.abs(cumW[i] / wsum - target);
      if (d < bestD) { bestD = d; best = i; }
    }
    // only accept a break that is plausibly this pause (within 20% of the text), else treat the pause as a mid-sentence breath
    if (best >= 0 && bestD <= 0.2) {
      chosen.push({ after: best, seg: j });
      prevAfter = best;
    }
  }
  let wStart = 0;
  let sStart = 0;
  const bounds = [...chosen, { after: words.length - 1, seg: segs.length - 1 }];
  for (const bnd of bounds) {
    const idxs = [];
    for (let i = wStart; i <= bnd.after; i++) idxs.push(i);
    const spansForGroup = segs.slice(sStart, bnd.seg + 1).flat();
    distributeGroup(words, idxs, spansForGroup, out);
    wStart = bnd.after + 1;
    sStart = bnd.seg + 1;
  }
  return out.map((w, i) => w || { ...words[i] });
}

// ---------- provider VTT / cues ----------

function vttTime(s) {
  const m = String(s).trim().match(/^(?:(\d+):)?(\d+):(\d+)[.,](\d+)$/);
  if (!m) return NaN;
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number('0.' + m[4]);
}

export function parseVtt(text) {
  const cues = [];
  const blocks = String(text).replace(/\r/g, '').split(/\n\n+/);
  for (const b of blocks) {
    const lines = b.split('\n').filter(Boolean);
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti < 0) continue;
    const [a, c] = lines[ti].split('-->');
    const start = vttTime(a);
    const end = vttTime(c.trim().split(/\s+/)[0]);
    const txt = lines.slice(ti + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (Number.isFinite(start) && Number.isFinite(end) && txt) cues.push({ start, end, text: txt });
  }
  return cues;
}

/** Map script words onto provider cues. Returns { words, method } or null if cues are unusable. */
export function alignWordsToCues(words, cues, totalDur) {
  if (!words.length || !cues.length) return null;
  const nw = words.length;
  const ratio = cues.length / nw;
  if (ratio >= 0.85 && ratio <= 1.15) {
    // per-word cues: take them in order (provider words may be split/merged slightly; index-map)
    const out = words.map((w, i) => {
      const c = cues[Math.min(cues.length - 1, Math.round((i / Math.max(1, nw - 1)) * (cues.length - 1)))];
      return { ...w, start_s: r3(c.start), end_s: r3(Math.max(c.end, c.start + 0.03)) };
    });
    return { words: out, method: 'provider-vtt' };
  }
  // sentence-level cues: assign each word to the cue whose cumulative text share contains its midpoint
  const cueChars = cues.map((c) => Math.max(1, glen(c.text.replace(/\s+/g, ''))));
  const totalChars = cueChars.reduce((x, y) => x + y, 0);
  const wordChars = words.map((w) => Math.max(1, glen(w.word.replace(/[^\p{L}\p{N}]/gu, ''))));
  const wordsTotal = wordChars.reduce((x, y) => x + y, 0);
  const cum = [];
  cueChars.reduce((acc, n, i) => (cum[i] = acc + n), 0);
  const groups = cues.map(() => []);
  let before = 0;
  words.forEach((w, i) => {
    const mid = ((before + wordChars[i] / 2) / wordsTotal) * totalChars;
    before += wordChars[i];
    let ci = cum.findIndex((c) => mid < c);
    if (ci < 0) ci = cues.length - 1;
    groups[ci].push(i);
  });
  const out = new Array(nw);
  groups.forEach((idxs, ci) => {
    if (!idxs.length) return;
    const gw = idxs.map((i) => wordWeight(words[i].word));
    const gsum = gw.reduce((x, y) => x + y, 0) || 1;
    const span = Math.max(0.05, cues[ci].end - cues[ci].start);
    let a = cues[ci].start;
    idxs.forEach((i, k) => {
      const s0 = a;
      a += (gw[k] / gsum) * span;
      out[i] = { ...words[i], start_s: r3(s0), end_s: r3(a) };
    });
  });
  return { words: out, method: 'provider-sentence-vtt' };
}

// ---------- retime the rest of the timeline from new word times ----------

function makeMapper(xs, ys) {
  // monotone piecewise-linear map old-time -> new-time
  const ax = [];
  const ay = [];
  for (let i = 0; i < xs.length; i++) {
    if (ax.length && xs[i] <= ax[ax.length - 1]) continue;
    ax.push(xs[i]);
    ay.push(Math.max(ys[i], ay.length ? ay[ay.length - 1] : 0));
  }
  return (t) => {
    if (t <= ax[0]) return ay[0] + (t - ax[0]);
    if (t >= ax[ax.length - 1]) return ay[ay.length - 1] + (t - ax[ax.length - 1]);
    let lo = 0;
    let hi = ax.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ax[mid] <= t) lo = mid;
      else hi = mid;
    }
    const f = (t - ax[lo]) / (ax[hi] - ax[lo]);
    return ay[lo] + f * (ay[hi] - ay[lo]);
  };
}

/**
 * oldWords/newWords are index-aligned. Scenes, beats, SFX cues follow the speech via a monotone map.
 * Captions are re-timed to the words they contain.
 */
export function retimeTimeline(timeline, oldWords, newWords, { maxCps = 17, holdAfterS = 0.5 } = {}) {
  const t = structuredClone(timeline);
  const dur = t.duration_s;
  const xs = [0];
  const ys = [0];
  for (let i = 0; i < oldWords.length; i++) {
    xs.push(oldWords[i].start_s, oldWords[i].end_s);
    ys.push(newWords[i].start_s, newWords[i].end_s);
  }
  xs.push(dur);
  ys.push(dur);
  const map = makeMapper(xs, ys);

  t.words = newWords;
  let prevEnd = 0;
  (t.scenes || []).forEach((sc, i, arr) => {
    const oldStart = sc.start_s;
    const oldEnd = sc.end_s;
    sc.start_s = i === 0 ? 0 : r3(prevEnd);
    sc.end_s = i === arr.length - 1 ? dur : r3(Math.max(sc.start_s + 0.05, map(oldEnd)));
    prevEnd = sc.end_s;
    const k = (sc.end_s - sc.start_s) / Math.max(1e-6, oldEnd - oldStart);
    for (const b of sc.beats || []) {
      b.t_s = r3(sc.start_s + (b.t_s - oldStart) * k);
      b.dur_s = r3(Math.max(0.05, b.dur_s * k));
    }
  });
  for (const cue of t.audio_cues || []) cue.t_s = r3(Math.max(0, map(cue.t_s)));

  // Captions: re-chunk from the ALIGNED words (short, word-boundary, CPS-safe) instead of stretching V2 chunks.
  if (newWords.length) t.captions = rechunkCaptions(newWords, dur, { maxCps, holdAfterS });
  return t;
}

const SENT_END = /[.!?\u0964]["'\u201d)]?$/;
const CLAUSE_END = /[,;:\u2014]["'\u201d)]?$/;

function twoLines(text) {
  if (glen(text) <= 22) return text;
  const words = text.split(' ');
  let best = 0;
  let bestD = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(glen(words.slice(0, i).join(' ')) - glen(words.slice(i).join(' ')));
    if (d < bestD) { bestD = d; best = i; }
  }
  return best ? `${words.slice(0, best).join(' ')}\n${words.slice(best).join(' ')}` : text;
}

/**
 * Build readable captions from aligned words: break at sentence ends / clause ends / ~maxChars / speaker change,
 * appear up to `lead` s before the first word, hold after speech, never overlap, and merge neighbours when a
 * chunk would exceed maxCps. Remaining violations (speech faster than maxCps) are left for lint to report.
 */
export function rechunkCaptions(words, dur, { maxChars = 34, maxMergedChars = 76, maxCps = 17, lead = 0.1, holdAfterS = 0.5 } = {}) {
  const chunks = [];
  let cur = null;
  const flush = () => { if (cur) { chunks.push(cur); cur = null; } };
  for (const w of words) {
    const wl = glen(w.word);
    if (cur && (cur.speaker !== w.speaker || glen(cur.words.join(' ')) + 1 + wl > maxChars)) flush();
    if (!cur) cur = { speaker: w.speaker, words: [], start: w.start_s, end: w.end_s };
    cur.words.push(w.word);
    cur.end = w.end_s;
    const chars = glen(cur.words.join(' '));
    if (SENT_END.test(w.word) || (CLAUSE_END.test(w.word) && chars >= maxChars * 0.6)) flush();
  }
  flush();

  const timed = (list) => {
    list.forEach((c, i) => {
      const next = list[i + 1];
      const prev = list[i - 1];
      c.s = Math.max(prev ? prev.e + 0.02 : 0, c.start - lead);
      c.e = Math.max(c.s + 0.05, Math.min(dur, c.end + holdAfterS));
      if (next) c.e = Math.min(c.e, Math.max(c.s + 0.05, next.start - lead - 0.02));
    });
  };
  // two passes so `prev.e` exists
  chunks.forEach((c) => { c.s = c.start; c.e = c.end; });
  timed(chunks);
  timed(chunks);
  // same formula as lint: text with the inserted line break removed (spaces count)
  const cps = (c) => {
    const joined = c.words.join(' ');
    return (glen(joined) - (glen(joined) > 22 ? 1 : 0)) / Math.max(0.05, c.e - c.s);
  };
  // fold orphans (<= 2 words) into a neighbour in the same sentence
  for (let k = chunks.length - 1; k >= 0; k--) {
    const c = chunks[k];
    if (c.words.length > 2) continue;
    const prev = chunks[k - 1];
    if (prev && prev.speaker === c.speaker && !SENT_END.test(prev.words[prev.words.length - 1]) && glen(`${prev.words.join(' ')} ${c.words.join(' ')}`) <= maxMergedChars) {
      prev.words = [...prev.words, ...c.words];
      prev.end = c.end;
      chunks.splice(k, 1);
    }
  }
  timed(chunks);
  timed(chunks);
  for (let guard = 0; guard < 50; guard++) {
    const i = chunks.findIndex((c, k) => cps(c) > maxCps && chunks[k + 1] && chunks[k + 1].speaker === c.speaker && glen(`${c.words.join(' ')} ${chunks[k + 1].words.join(' ')}`) <= maxMergedChars);
    if (i < 0) break;
    const m = chunks[i];
    const n = chunks[i + 1];
    m.words = [...m.words, ...n.words];
    m.end = n.end;
    chunks.splice(i + 1, 1);
    timed(chunks);
    timed(chunks);
  }
  return chunks.map((c) => ({
    speaker: c.speaker || 'NARRATOR',
    text: twoLines(c.words.join(' ')),
    start_s: r3(c.s),
    end_s: r3(c.e),
    safe_zone: true
  }));
}
