// CREDITS.txt: attribution lines for every CC-BY item (CC0 / PDM listed too, optional). The audit fails a BY item that has no line.
// The generated block sits between markers so lines a human adds around it survive a re-run.
import fs from 'node:fs';
import path from 'node:path';

export const CREDITS_BEGIN = '# BEGIN sfx_fetch (generated; edit outside this block)';
export const CREDITS_END = '# END sfx_fetch';

const licId = (lic) => {
  if (!lic || typeof lic === 'string') {
    const s = String(lic || '').toLowerCase();
    if (/\bcc[- ]?0\b|public domain dedication|\bcc0\b/.test(s)) return 'cc0';
    if (/\bpdm\b|public domain mark|^public ?domain/.test(s)) return 'pdm';
    if (/\bcc[- ]?by\b/.test(s)) return 'by';
    return null;
  }
  const id = String(lic.id || lic.license || '').toLowerCase();
  if (['cc0', 'pdm', 'by'].includes(id)) return id;
  return licId(String(lic.name || ''));
};
export { licId };
export const needsCredit = (lic) => licId(lic) === 'by' || /\bcc[- ]?by\b/i.test(typeof lic === 'string' ? lic : String(lic?.name || ''));

export function creditLine(item) {
  const l = item.licence || {};
  const id = licId(l);
  if (l.provider === 'earshot') return `earshot ${l.version || ''} design "${l.design || '?'}" seed ${l.seed ?? '?'}: rendered output of ${l.url} (MIT tool; its recordings are CC0 / public domain per the repo's CREDITS.md) [${item.file}]`;
  const title = item.title ? `"${item.title}"` : path.basename(item.file || '');
  if (l.attribution) return `${l.attribution}${l.foreign_landing_url ? ` <${l.foreign_landing_url}>` : ''} [${item.file}]`;
  const who = l.creator || l.credit || 'unknown creator';
  const name = l.name || id || 'licence?';
  return `${title} by ${who}, ${name}${l.url ? ` (${l.url})` : ''}${l.proof || l.foreign_landing_url ? ` <${l.proof || l.foreign_landing_url}>` : ''} [${item.file}]`;
}

// items: [{ file, title?, licence }] (the chosen file of each cue).
export function buildCredits(items) {
  const uniq = new Map(); for (const it of items) if (it.file && !uniq.has(it.file)) uniq.set(it.file, it);
  const all = [...uniq.values()];
  const by = all.filter((i) => needsCredit(i.licence)); const free = all.filter((i) => !needsCredit(i.licence));
  const out = [CREDITS_BEGIN, 'Sound effects and ambience: attribution required (CC BY)', ...(by.length ? by.map((i) => `- ${creditLine(i)}`) : ['- (none)']), '', 'Optional credit (CC0 / public domain; no attribution required):', ...(free.length ? free.map((i) => `- ${creditLine(i)}`) : ['- (none)']), CREDITS_END];
  return out.join('\n') + '\n';
}

export function writeCredits(projectDir, items) {
  const p = path.join(projectDir, 'CREDITS.txt'); const block = buildCredits(items);
  let cur = ''; try { cur = fs.readFileSync(p, 'utf8'); } catch { /* new */ }
  const a = cur.indexOf(CREDITS_BEGIN), b = cur.indexOf(CREDITS_END);
  const next = a >= 0 && b > a ? cur.slice(0, a) + block + cur.slice(b + CREDITS_END.length).replace(/^\n/, '') : (cur ? cur.replace(/\n*$/, '\n\n') : '') + block;
  const tmp = `${p}.tmp-${process.pid}`; fs.writeFileSync(tmp, next); fs.renameSync(tmp, p); return p;
}

// Audit helper: which BY items lack a line in CREDITS.txt? A line counts if it contains the landing URL, detail URL, sha256, or the file path.
export function missingCredits(projectDir, entries) {
  let txt = ''; try { txt = fs.readFileSync(path.join(projectDir, 'CREDITS.txt'), 'utf8'); } catch { /* absent */ }
  const out = [];
  for (const e of entries) {
    if (!needsCredit(e.licence)) continue;
    const l = e.licence && typeof e.licence === 'object' ? e.licence : {};
    const keys = [l.foreign_landing_url, l.detail_url, l.sha256, e.file, l.proof].filter((k) => typeof k === 'string' && k.length > 6);
    if (!txt || !keys.some((k) => txt.includes(k))) out.push(e.id);
  }
  return out;
}
