// Candidate ranking shared by Openverse results and local-library index entries.
// score = 0.40 duration fit + 0.30 tag/word match + 0.20 licence preference (cc0 > pdm > by) + 0.10 non-preview.
const STOP = new Set(['the', 'and', 'with', 'for', 'sound', 'sounds', 'effect', 'sfx', 'audio', 'of', 'a', 'an', 'in', 'on']);
export const tokens = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
const LIC_PREF = { cc0: 1, pdm: 0.8, by: 0.5 };

export function durationFit(d, want, isBed) {
  if (!(d > 0)) return 0;
  if (!(want > 0)) return d >= 0.3 && d <= 10 ? 1 : 0.6;
  if (isBed) return d >= want ? (d > want * 4 ? 0.85 : 1) : d / want; // a bed shorter than its span has to loop
  return Math.min(d, want) / Math.max(d, want);
}

// item: { title, tags:[string], duration_s, licence_id, preview }
export function scoreItem(item, { query, cueTags = [], wantDurS = null, isBed = false }) {
  const want = [...new Set([...tokens(query), ...cueTags.flatMap(tokens)])];
  const hay = new Set([...tokens(item.title), ...(item.tags || []).flatMap(tokens)]);
  const hit = want.filter((w) => hay.has(w) || [...hay].some((h) => h.startsWith(w) || w.startsWith(h) && h.length > 3));
  const tag = want.length ? hit.length / want.length : 0;
  const dur = durationFit(item.duration_s, wantDurS, isBed);
  const lic = LIC_PREF[item.licence_id] ?? 0; const np = item.preview ? 0 : 1;
  const score = 0.4 * dur + 0.3 * tag + 0.2 * lic + 0.1 * np;
  return { score: Math.round(score * 1000) / 1000, parts: { duration: Math.round(dur * 100) / 100, tags: Math.round(tag * 100) / 100, licence: lic, non_preview: np }, matched: hit };
}

export function rank(items, ctx) {
  return items.map((it, i) => ({ it, i, ...scoreItem(it, ctx) })).sort((a, b) => b.score - a.score || (a.it.id < b.it.id ? -1 : a.it.id > b.it.id ? 1 : a.i - b.i));
}
