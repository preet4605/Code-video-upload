#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ALLOWED_LICENSES = ['CC0', 'Public domain', 'CC BY', 'CC BY-SA'];

export function isAllowedLicense(licenseStr) {
  const s = String(licenseStr || '').trim();
  if (!s) return false;
  // Strictly reject NC, ND, All rights reserved, or Fair use
  if (/\b(nc|nd)\b/i.test(s) || /noncommercial|no\s*derivatives|all\s*rights\s*reserved|fair\s*use/i.test(s)) {
    return false;
  }
  return /^(cc0|public\s*domain|pd|cc\s*by(\s*-?\s*sa)?(\s+\d+(\.\d+)?)?)$/i.test(s) ||
    /\b(cc0|public\s*domain|cc[- ]by([- ]sa)?)\b/i.test(s);
}

export function stripHtml(str) {
  return String(str || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export function formatWikimediaAttribution(artist, license) {
  const cleanArtist = stripHtml(artist) || 'Wikimedia Contributor';
  const cleanLicense = stripHtml(license) || 'CC';
  return `PHOTO: ${cleanArtist} · ${cleanLicense} · WIKIMEDIA COMMONS`;
}

export function parseWikimediaResponse(apiJson) {
  const pages = apiJson?.query?.pages;
  if (!pages || typeof pages !== 'object') return [];

  const results = [];
  for (const page of Object.values(pages)) {
    const info = page?.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata || {};
    const license = stripHtml(meta.LicenseShortName?.value || meta.License?.value || '');
    if (!isAllowedLicense(license)) continue;

    const artist = stripHtml(meta.Artist?.value || meta.Credit?.value || 'Wikimedia Contributor');
    const url = info.url || '';
    const thumbUrl = info.thumburl || url;
    const sourceUrl = info.descriptionurl || (page.title ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}` : url);

    results.push({
      title: page.title || 'Wikimedia File',
      url,
      thumbUrl,
      artist,
      license,
      attribution: formatWikimediaAttribution(artist, license),
      source_url: sourceUrl
    });
  }
  return results;
}

function buildApiUrl(query, limit = 3) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: String(Math.max(limit * 3, 6)),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1080',
    format: 'json'
  });
  return `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
}

function parseArgs(argv) {
  const opts = { query: null, out: null, limit: 3, dryRun: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--query') opts.query = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--limit') opts.limit = Number(argv[++i]);
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--json') opts.json = true;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.query || !opts.out) {
    console.error('Usage: fetch_wikimedia.mjs --query <q> --out <projectDir> [--limit 3] [--dry-run] [--json]');
    process.exit(2);
  }

  const projectDir = path.resolve(opts.out);
  const assetsJsonPath = path.join(projectDir, 'assets.json');
  const apiUrl = buildApiUrl(opts.query, opts.limit);

  if (opts.dryRun) {
    const out = { ok: true, dryRun: true, query: opts.query, limit: opts.limit, apiUrl, assetsJsonPath };
    console.log(opts.json ? JSON.stringify(out, null, 2) : `DRY-RUN: ${apiUrl}`);
    return;
  }

  const resp = await fetch(apiUrl, { headers: { 'User-Agent': 'code-video-studio/1.1' } });
  if (!resp.ok) throw new Error(`Wikimedia API failed: ${resp.status}`);
  const json = await resp.json();
  const candidates = parseWikimediaResponse(json).slice(0, opts.limit);

  const assetsDir = path.join(projectDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const existing = fs.existsSync(assetsJsonPath)
    ? JSON.parse(fs.readFileSync(assetsJsonPath, 'utf8'))
    : { version: '1.0', assets: [] };

  const added = [];
  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i];
    const dlUrl = item.thumbUrl || item.url;
    const ext = path.extname(new URL(dlUrl).pathname) || '.jpg';
    const slug = item.title.replace(/^File:/i, '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 48);
    const fileName = `${slug}${ext}`;
    const localPath = path.join(assetsDir, fileName);

    const imgResp = await fetch(dlUrl, { headers: { 'User-Agent': 'code-video-studio/1.1' } });
    if (!imgResp.ok) continue;
    fs.writeFileSync(localPath, Buffer.from(await imgResp.arrayBuffer()));

    const entry = {
      id: `wiki_${slug}`,
      tier: 3,
      type: 'wikimedia_media',
      path: `assets/${fileName}`,
      source_url: item.source_url,
      author: item.artist,
      license: item.license,
      attribution_text: item.attribution
    };
    existing.assets = existing.assets.filter((a) => a.id !== entry.id);
    existing.assets.push(entry);
    added.push(entry);
  }

  fs.writeFileSync(assetsJsonPath, JSON.stringify(existing, null, 2));
  const out = { ok: true, query: opts.query, fetched: added.length, assetsJsonPath, added };
  console.log(opts.json ? JSON.stringify(out, null, 2) : `FETCHED ${added.length} assets into ${assetsJsonPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
