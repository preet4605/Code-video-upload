#!/usr/bin/env node
// Render a project's cue sheet (sound.json) to stems, optionally mix + master + QA them.
//
//   node scripts/sound_design.mjs --project <dir> [--check] [--mix <out.m4a>] [--no-qa] [--json]
//
//   reads   <dir>/sound.json  <dir>/timeline.json  (+ timeline.audio_file for --mix)
//   writes  <dir>/audio/{sfx,music,ambience,room}.wav   48 kHz stereo float, exactly duration_s long, written atomically
//           <dir>/audio/cue_report.json  every cue's resolved time, source, render cost
//           <dir>/audio/licences.json    every tier-B/C asset with file + licence (a missing licence is an error)
//           <dir>/audio/audio_qa.json    with --mix: audio QA of the mastered mix
// Query cues (source library/earshot) are resolved beforehand by scripts/sfx_fetch.mjs into sound.lock.json; this script never fetches.
// Tier A (synth) is the default and needs nothing. Tier B/C cues need "file" + "licence" in the sheet (see references/sound.md).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadSound, resolveCues } from '../lib/audio/cues.mjs';
import { renderStems, writeStems } from '../lib/audio/render.mjs';
import { buildMix, normalizeTwoPass, encodeM4a } from '../lib/audio/mix.mjs';
import { auditProjectAudio } from '../lib/audio/audit.mjs';
import { writeWavFloat } from '../lib/audio/wav.mjs';
import { resolveBin } from '../lib/runtime.mjs';

function parseArgs(argv) {
  const o = { project: null, mix: null, check: false, qa: true, json: false, lufs: -14, tp: -1.5 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') o.project = argv[++i]; else if (a === '--mix') o.mix = argv[++i]; else if (a === '--check') o.check = true;
    else if (a === '--no-qa') o.qa = false; else if (a === '--json') o.json = true; else if (a === '--lufs') o.lufs = Number(argv[++i]); else if (a === '--tp') o.tp = Number(argv[++i]);
  }
  return o;
}

export async function runSoundDesign(o) {
  const dir = path.resolve(o.project);
  const sound = loadSound(path.join(dir, 'sound.json'));
  const timeline = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8'));
  if (o.check) {
    const r = resolveCues(sound, timeline, { projectDir: dir });
    return { ok: r.errors.length === 0, errors: r.errors, warnings: r.warnings, cues: r.cues.map((c) => ({ id: c.id, kind: c.kind, at_s: c.at_s, derived_events: c.derived_events })) };
  }
  const t0 = performance.now();
  const result = renderStems(sound, timeline, { projectDir: dir });
  const outDir = path.join(dir, 'audio');
  const written = writeStems(result, outDir);
  const out = { ok: true, stems: written, cue_report: path.join(outDir, 'cue_report.json'), licences: path.join(outDir, 'licences.json'), cues: result.report.length, warnings: result.warnings, render_ms: Math.round(performance.now() - t0), reverb_ms: Math.round(result.reverb_ms) };
  if (o.mix) {
    const ffmpeg = resolveBin('ffmpeg');
    const mix = buildMix({ projectDir: dir, stemsDir: outDir, timeline, sound, ffmpeg });
    const cache = path.join(dir, 'cache'); fs.mkdirSync(cache, { recursive: true });
    const raw = path.join(cache, 'mix_raw.wav'), norm = path.join(cache, 'mix_norm.wav');
    writeWavFloat(raw, mix.L, mix.R, mix.sr);
    const ln = normalizeTwoPass({ ffmpeg, inFile: raw, outFile: norm, I: o.lufs, TP: o.tp });
    const outFile = path.resolve(o.mix); fs.mkdirSync(path.dirname(outFile), { recursive: true });
    encodeM4a(ffmpeg, norm, outFile);
    out.mix = { file: outFile, loudnorm: ln, ducking: mix.duck ? { depth_db: mix.duck.depth_db, attack_s: mix.duck.attack_s, release_s: mix.duck.release_s } : null, buses_db: mix.buses, bytes: fs.statSync(outFile).size };
    if (o.qa) {
      const au = auditProjectAudio({ projectDir: dir, media: outFile, ffmpeg, timeline, targetLufs: o.lufs });
      if (au) { au.warns.push(...ln.warnings.map((w) => `audio: ${w}`)); out.qa = au; fs.writeFileSync(path.join(outDir, 'audio_qa.json'), JSON.stringify(au, null, 2) + '\n'); out.ok = au.fails.length === 0; }
    }
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const o = parseArgs(process.argv.slice(2));
  if (!o.project) { console.error('usage: sound_design.mjs --project <dir> [--check] [--mix <out.m4a>] [--no-qa] [--json]'); process.exit(2); }
  try {
    const r = await runSoundDesign(o);
    if (o.json) console.log(JSON.stringify(r, null, 2));
    else if (o.check) console.log(r.ok ? `sound.json OK (${r.cues.length} cues)${r.warnings.length ? '\n warnings:\n - ' + r.warnings.join('\n - ') : ''}` : `sound.json INVALID\n - ${r.errors.join('\n - ')}`);
    else {
      console.log(`SOUND ${r.ok ? 'OK' : 'FAIL'}: ${r.cues} cue(s), stems: ${Object.keys(r.stems).join(', ')} -> ${path.dirname(r.cue_report)} (${r.render_ms} ms, reverb ${r.reverb_ms} ms)`);
      if (r.mix) console.log(`MIX: ${r.mix.file} (${(r.mix.bytes / 1024).toFixed(0)} KiB), loudnorm ${r.mix.loudnorm.mode}, pass-2 ${r.mix.loudnorm.pass2_type}`);
      if (r.qa) { for (const f of r.qa.fails) console.log(` FAIL ${f}`); for (const w of r.qa.warns) console.log(` warn ${w}`); for (const v of r.qa.verified) console.log(` ok   ${v}`); for (const u of r.qa.unverified) console.log(` NOT VERIFIED ${u}`); }
    }
    process.exit(r.ok ? 0 : 1);
  } catch (e) { console.error(e.errors ? e.message : `sound_design: ${e.message}`); process.exit(1); }
}
