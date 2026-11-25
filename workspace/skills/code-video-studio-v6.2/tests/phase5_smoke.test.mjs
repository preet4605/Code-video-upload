import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTmpProject } from './_tmp_project.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = path.resolve(__dirname, '..');
// Temp copy: render/master outputs (cache/, out/) must never land in the skill folder.
const TMP = makeTmpProject('smoke-peet-editorial');
const PROJECT_DIR = TMP.dir;
after(() => TMP.cleanup());

test('smoke-peet-editorial renders cleanly at --reel-720 --draft (360x640 @ 15fps)', () => {
  const raw = execFileSync(
    'node',
    [
      path.join(STUDIO_ROOT, 'scripts/render_and_lint.mjs'),
      '--project', PROJECT_DIR,
      '--reel-720',
      '--draft',
      '--json'
    ],
    { encoding: 'utf8' }
  );
  const res = JSON.parse(raw);
  assert.equal(res.ok, true);
  assert.equal(res.lint.ok, true);
  assert.equal(res.width, 360);
  assert.equal(res.height, 640);
  assert.equal(res.fps, 15);
});

test('smoke-peet-editorial masters cleanly with --preset reel-vocal --bgm auto --sfx-auto', () => {
  const raw = execFileSync(
    'node',
    [
      path.join(STUDIO_ROOT, 'scripts/master_and_qa.mjs'),
      '--project', PROJECT_DIR,
      '--preset', 'reel-vocal',
      '--bgm', 'auto',
      '--sfx-auto',
      '--json'
    ],
    { encoding: 'utf8' }
  );
  const res = JSON.parse(raw);
  assert.equal(res.ok, true);
  assert.equal(res.audio_qa.pass, true);
  assert.equal(res.ffprobe.audio.sample_rate, '48000');
  assert.equal(res.ffprobe.video.codec, 'h264');
  assert.equal(res.ffprobe.video.pix_fmt, 'yuv420p');
  assert.ok(fs.existsSync(path.join(PROJECT_DIR, 'out/qa_contact_sheet.png')));
});

test('SKILL.md is < 5500 bytes and all relative markdown links resolve on disk', () => {
  const skillPath = path.join(STUDIO_ROOT, 'SKILL.md');
  const size = fs.statSync(skillPath).size;
  assert.ok(size < 5500, `SKILL.md size ${size} >= 5500 bytes`);

  const content = fs.readFileSync(skillPath, 'utf8');
  const links = [...content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(links.length >= 7);
  for (const rel of links) {
    if (rel.startsWith('http://') || rel.startsWith('https://')) continue;
    assert.ok(fs.existsSync(path.resolve(STUDIO_ROOT, rel)), `Broken link in SKILL.md: ${rel}`);
  }
});
