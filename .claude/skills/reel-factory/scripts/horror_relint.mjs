#!/usr/bin/env node
// Re-lint finished horror reels against the V5 gates (story format, script/critique, shotlist, measured video+audio).
// Usage: node scripts/horror_relint.mjs <project_dir>[:<rendered.mp4>] [...] [--json]
// A project without an MP4 gets the text gates only. Reels made before V5 are expected to FAIL; that is the point.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runScriptGate } from './script_gate.mjs';
import { runHorrorVisualGate } from '../lib/horror_gate.mjs';
import { runHorrorMeasuredGate } from '../lib/horror_measure.mjs';

export function relintOne(spec) {
  const [dir, mp4Arg] = spec.split(':');
  const projectDir = path.resolve(dir);
  let mp4 = mp4Arg ? path.resolve(mp4Arg) : null;
  if (!mp4) {
    const outDir = path.join(projectDir, 'out');
    const found = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => f.endsWith('.mp4')) : [];
    if (found.length) mp4 = path.join(outDir, found[0]);
  }
  const res = { project: dir, mp4, groups: {} };
  const sg = runScriptGate(projectDir, 'script');
  const story = sg.fails.filter((f) => f.startsWith('story/'));
  const script = sg.fails.filter((f) => !f.startsWith('story/'));
  res.groups.story = { pass: story.length === 0, fails: story };
  res.groups.script = { pass: script.length === 0, fails: script };
  if (mp4 && fs.existsSync(mp4)) {
    const vg = runHorrorVisualGate({ mp4, projectDir, writeSheet: false });
    const hm = runHorrorMeasuredGate({ mp4, projectDir });
    const shot = vg.fails.filter((f) => /^shot|shotlist|intensity/.test(f));
    res.groups.shotlist = { pass: shot.length === 0, fails: shot };
    res.groups.visual = { pass: vg.fails.length - shot.length === 0, fails: vg.fails.filter((f) => !shot.includes(f)) };
    const motion = hm.fails.filter((f) => /^motion_|^black_/.test(f));
    const sound = hm.fails.filter((f) => /^scare_/.test(f));
    res.groups.motion = { pass: motion.length === 0, fails: motion, per_scene: hm.per_scene };
    res.groups.sound = { pass: sound.length === 0, fails: sound, scares: hm.scares };
  } else {
    res.groups.video = { pass: false, fails: ['no rendered MP4 given: measured gates not run'] };
  }
  res.pass = Object.values(res.groups).every((g) => g.pass);
  return res;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const args = process.argv.slice(2).filter((a) => a !== '--json');
  if (!args.length) { console.error('usage: horror_relint.mjs <project_dir>[:<mp4>] [...] [--json]'); process.exit(2); }
  const all = args.map(relintOne);
  if (process.argv.includes('--json')) console.log(JSON.stringify(all, null, 2));
  else for (const r of all) {
    console.log(`\n${r.pass ? 'PASS' : 'FAIL'}  ${r.project}${r.mp4 ? '  (' + path.basename(r.mp4) + ')' : ''}`);
    for (const [k, g] of Object.entries(r.groups)) {
      console.log(`  ${g.pass ? 'ok  ' : 'FAIL'} ${k}${g.pass ? '' : ':'}`);
      for (const f of g.fails.slice(0, 6)) console.log(`         - ${f.slice(0, 170)}`);
      if (g.fails.length > 6) console.log(`         - ... ${g.fails.length - 6} more`);
    }
  }
  console.log('\nNote: relint PASS means the story/script/shotlist/visual/motion/sound gates pass. It is NOT a SHIP verdict:\nmaster_and_qa.mjs also checks voiceover, resolution, fps, loudness, sync and platform spec.');
  process.exit(all.every((r) => r.pass) ? 0 : 1);
}
