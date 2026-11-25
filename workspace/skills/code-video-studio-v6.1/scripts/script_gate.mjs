#!/usr/bin/env node
// Usage: node scripts/script_gate.mjs <project_dir> --mode idea|script [--json]
// script mode reads script.txt + critique.json ; idea mode reads idea.md (+ critique.json optional)
import fs from 'node:fs';
import path from 'node:path';
import { checkScript, checkIdea, checkCritique, summarize } from '../lib/horror_gate.mjs';
import { lintStoryProject } from '../lib/story_lint.mjs';

export function runScriptGate(dir, mode) {
  const rd = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return null; } };
  let brief = {};
  try { brief = JSON.parse(rd('brief.json') || '{}'); } catch { /* ignore */ }
  const all = [];
  let text;
  if (mode === 'idea') {
    text = rd('idea.md');
    if (text == null) return { pass: false, fails: ['idea.md missing'], warns: [], checks: [] };
    all.push(...checkIdea(text).checks);
  } else {
    text = rd('script.txt');
    if (text == null) return { pass: false, fails: ['script.txt missing'], warns: [], checks: [] };
    all.push(...checkScript(text, brief).checks);
  }
  const hFails = all.filter((c) => c.severity === 'fail').length;
  let critiqueRaw = rd('critique.json');
  let critique = null;
  try { critique = critiqueRaw ? JSON.parse(critiqueRaw) : null; } catch { critique = null; }
  if (mode === 'script' || critique) all.push(...checkCritique(critique, text, { mode, heuristicFails: hFails }).checks);
  const out = { ...summarize(all), checks: all, mode };
  if (mode === 'script') {
    const st = lintStoryProject(dir);
    out.fails.push(...st.errors);
    out.warns.push(...(st.warns || []));
    out.pass = out.fails.length === 0;
    out.story = st;
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const dir = process.argv[2];
  const mi = process.argv.indexOf('--mode');
  const mode = mi > 0 ? process.argv[mi + 1] : null;
  if (!dir || !['idea', 'script'].includes(mode)) {
    console.error('usage: script_gate.mjs <project_dir> --mode idea|script [--json]');
    process.exit(2);
  }
  const r = runScriptGate(dir, mode);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`SCRIPT GATE (${mode}): ${r.pass ? 'PASS (heuristic only; a human must read it aloud)' : 'FAIL'}`);
    r.fails.forEach((f) => console.log(' FAIL ' + f));
    r.warns.forEach((w) => console.log(' warn ' + w));
  }
  process.exit(r.pass ? 0 : 1);
}
