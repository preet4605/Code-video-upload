#!/usr/bin/env node
// Calibrate visual targets from reference reels whose look you want (videos or images).
// Usage: node scripts/style_ref.mjs <ref1.mp4> [ref2.mp4 ...] --out templates/visual_targets.json [--name my-style] [--margin 0.8]
// Each target = the weakest reference x margin (min) / the busiest reference x 1.4 (palette cap), so a reel must
// look at least roughly as detailed as the plainest reference you gave. Never edit targets down to pass a reel.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolveBin } from '../lib/runtime.mjs';
import { frameMetrics, aggregate, DEFAULT_CAPTION_BAND } from '../lib/visual_metrics.mjs';

export const AW = 270, AH = 480;

export function sampleFrames(file, n = 24) {
  const ffprobe = resolveBin('ffprobe'), ffmpeg = resolveBin('ffmpeg');
  const isImg = /\.(png|jpe?g|webp)$/i.test(file);
  const d = isImg ? 0 : Number(spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout) || 0;
  const times = isImg ? [0] : Array.from({ length: n }, (_, i) => (d * (i + 0.5)) / n);
  const out = [];
  for (const t of times) {
    const r = spawnSync(ffmpeg, ['-v', 'error', ...(isImg ? [] : ['-ss', t.toFixed(2)]), '-i', file, '-frames:v', '1', '-vf', `scale=${AW}:${AH}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 24 });
    if (r.stdout && r.stdout.length === AW * AH * 3) out.push(frameMetrics(r.stdout, AW, AH, 3, { ignoreBands: [DEFAULT_CAPTION_BAND] })); // captions are not scene detail
  }
  return out;
}

export function buildTargets(refStats, { margin = 0.8, name = 'custom', mood = null } = {}) {
  const pick = (k) => refStats.map((r) => r.agg[k] ?? 0);
  const min = (k) => +(Math.min(...pick(k)) * margin).toFixed(4);
  const med = (k) => { const v = pick(k).slice().sort((a, b) => a - b); const m = v.length >> 1; return +(v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2).toFixed(4); };
  return {
    name,
    calibrated_from: refStats.map((r) => ({ file: path.basename(r.file), ...r.agg })),
    margin,
    sharp_edges: { min: min('sharp_edges'), aim: med('sharp_edges') },
    contrast: { min: min('contrast'), aim: med('contrast') },
    saturation: { min: min('saturation'), aim: med('saturation') },
    color_bins: { min: Math.max(6, Math.floor(Math.min(...pick('color_bins')) * margin)), max: Math.ceil(Math.max(...pick('color_bins')) * 1.4) },
    focal: { min: +(Math.min(...pick('focal')) * margin).toFixed(2) },
    ink: { aim: med('ink') },
    aim_empty_cells: Math.round(med('empty_cells')),
    max_empty_cells: Math.max(1, Math.round(Math.max(...pick('empty_cells')) + 1)),
    // lit subject / subject scale floors, only when the reference stats carry them (floor = weakest reference x margin)
    ...(pick('subject_scale').every((v) => v > 0) ? { subject_scale: { min: +Math.min(0.22, Math.min(...pick('subject_scale')) * margin).toFixed(3) } } : {}),
    ...(mood === 'dark' && pick('lit_fraction').every((v) => v > 0) ? { lit_fraction: { min: +(Math.min(...pick("lit_fraction")) * margin).toFixed(4) }, lit_regions: { min: 1 } } : {}),
    ...(mood === 'dark' ? {
      // dark looks (horror): cap brightness and the number of hues, so a bright multicolour frame fails
      mood: 'dark',
      mean_luma: { max: +(Math.max(...pick('mean_luma')) * 1.15).toFixed(1), aim: med('mean_luma') },
      hue_families: { max: Math.ceil(Math.max(...pick('hue_families'))) + 1 }
    } : {})
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const a = process.argv.slice(2);
  const outI = a.indexOf('--out'), nameI = a.indexOf('--name'), mI = a.indexOf('--margin'), moodI = a.indexOf('--mood');
  const skip = new Set([outI, nameI, mI, moodI].filter((i) => i >= 0).flatMap((i) => [i, i + 1]));
  const files = a.filter((x, i) => !skip.has(i) && !x.startsWith('--'));
  if (!files.length || outI < 0) { console.error('usage: style_ref.mjs <ref.mp4|png> ... --out <targets.json> [--name n] [--margin 0.8] [--mood dark]'); process.exit(2); }
  const stats = files.map((f) => { const fr = sampleFrames(f); return { file: f, agg: aggregate(fr) }; });
  const T = buildTargets(stats, { margin: mI >= 0 ? Number(a[mI + 1]) : 0.8, name: nameI >= 0 ? a[nameI + 1] : 'custom', mood: moodI >= 0 ? a[moodI + 1] : null });
  fs.mkdirSync(path.dirname(path.resolve(a[outI + 1])), { recursive: true });
  fs.writeFileSync(a[outI + 1], JSON.stringify(T, null, 2));
  for (const s of stats) console.log(path.basename(s.file).padEnd(30), JSON.stringify(s.agg));
  console.log('targets ->', a[outI + 1]);
}
