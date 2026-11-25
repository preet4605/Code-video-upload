import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { lintTimeline } from '../scripts/render_and_lint.mjs';
import { measureLoudness, evaluateMasterQa } from '../scripts/master_and_qa.mjs';
import { resolveBin } from '../lib/runtime.mjs';
import { makeTmpProject } from './_tmp_project.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = path.resolve(__dirname, '..');
const FFMPEG_BIN = resolveBin('ffmpeg');
const FFPROBE_BIN = resolveBin('ffprobe');
const tmpProjects = [];
after(() => {
  for (const t of tmpProjects) t.cleanup();
});

const SMOKE_PROJECTS = [
  'smoke-horror-hi',
  'smoke-physics-orbit',
  'smoke-character-mythic'
];

for (const slug of SMOKE_PROJECTS) {
  test(`Phase 4 smoke project "${slug}" passes Gate 3 lint, determinism audit, and Gate 4 FFmpeg/LUFS/contact-sheet QA`, () => {
    // Render + master into a temp copy so nothing is written inside the skill folder.
    const tmp = makeTmpProject(slug);
    tmpProjects.push(tmp);
    const projDir = tmp.dir;
    const timelinePath = path.join(projDir, 'timeline.json');
    const assetsPath = path.join(projDir, 'assets.json');
    const scenePath = path.join(projDir, 'scene.mjs');
    const outMp4 = path.join(projDir, 'out', `${slug}.mp4`);
    const contactSheet = path.join(projDir, 'out', 'qa_contact_sheet.png');

    assert.ok(fs.existsSync(timelinePath), `Missing timeline.json for ${slug}`);
    assert.ok(fs.existsSync(assetsPath), `Missing assets.json for ${slug}`);
    assert.ok(fs.existsSync(scenePath), `Missing scene.mjs for ${slug}`);

    // 1. Verify timeline passes Gate 3 lintTimeline()
    const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    assert.equal(timeline.slug, slug);
    assert.equal(timeline.duration_s, 10.0);
    const lint = lintTimeline(timeline);
    assert.equal(lint.ok, true, `${slug} failed lintTimeline: ${lint.errors.join('; ')}`);

    // 2. Verify scene.mjs contains zero non-deterministic calls
    const sceneCode = fs.readFileSync(scenePath, 'utf8');
    assert.ok(!sceneCode.includes('Math.random'), `${slug}/scene.mjs must not use Math.random`);
    assert.ok(!sceneCode.includes('Date.now'), `${slug}/scene.mjs must not use Date.now`);
    assert.ok(!sceneCode.includes('requestAnimationFrame'), `${slug}/scene.mjs must not use requestAnimationFrame`);

    // 3. Verify assets.json has valid entries and tier-specific governance metadata
    const assetsData = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));
    assert.ok(Array.isArray(assetsData.assets) && assetsData.assets.length >= 2, `${slug}/assets.json must list assets`);
    for (const a of assetsData.assets) {
      assert.ok(a.id && typeof a.tier === 'number' && a.type && a.license, `Invalid asset entry in ${slug}: ${JSON.stringify(a)}`);
    }
    if (slug === 'smoke-horror-hi') {
      assert.ok(
        assetsData.assets.some((a) => a.tier === 3 && a.attribution && a.attribution.includes('CC BY 4.0')),
        'smoke-horror-hi assets.json must log Tier 3 CC attribution'
      );
    }
    if (slug === 'smoke-character-mythic') {
      assert.ok(
        assetsData.assets.some((a) => a.tier === 2 && a.iconography_qa_passed === true),
        'smoke-character-mythic assets.json must log Tier 2 mythic cutout with iconography_qa_passed: true'
      );
    }

    // 4. Render (draft scale keeps it fast on ARM64) + master, then verify rendered MP4 and 3x2 contact sheet exist and are non-empty
    execFileSync('node', [path.join(STUDIO_ROOT, 'scripts/render_and_lint.mjs'), '--project', projDir, '--reel-720', '--draft', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    execFileSync('node', [path.join(STUDIO_ROOT, 'scripts/master_and_qa.mjs'), '--project', projDir, '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    assert.ok(fs.existsSync(outMp4), `Missing mastered MP4: ${outMp4}`);
    assert.ok(fs.statSync(outMp4).size > 10000, `MP4 too small: ${outMp4}`);
    assert.ok(fs.existsSync(contactSheet), `Missing contact sheet: ${contactSheet}`);
    assert.ok(fs.statSync(contactSheet).size > 5000, `Contact sheet too small: ${contactSheet}`);

    // 5. Verify ffprobe streams & duration (~10s)
    const probeRaw = execFileSync(
      FFPROBE_BIN,
      ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', outMp4],
      { encoding: 'utf8' }
    );
    const probe = JSON.parse(probeRaw);
    const vStream = probe.streams.find((s) => s.codec_type === 'video');
    const aStream = probe.streams.find((s) => s.codec_type === 'audio');
    const duration = Number(probe.format.duration);

    assert.ok(vStream, `No video stream in ${outMp4}`);
    assert.equal(vStream.codec_name, 'h264');
    assert.equal(vStream.pix_fmt, 'yuv420p');
    assert.ok(aStream, `No audio stream in ${outMp4}`);
    assert.equal(aStream.codec_name, 'aac');
    assert.equal(aStream.sample_rate, '48000');
    assert.ok(Math.abs(duration - 10.0) <= 0.5, `Expected duration ~10.0s, got ${duration}s`);

    // 6. Verify ebur128 loudness QA (true_peak_dbtp <= -1.2 and integrated_lufs within ±2.0 LU of target)
    const targetLufs = timeline.target_lufs ?? -16;
    const truePeak = timeline.true_peak_dbtp ?? -1.5;
    const loud = measureLoudness(FFMPEG_BIN, outMp4);

    assert.ok(Number.isFinite(loud.integrated_lufs), `Non-finite integrated_lufs for ${slug}: ${loud.integrated_lufs}`);
    assert.ok(Number.isFinite(loud.true_peak_dbtp), `Non-finite true_peak_dbtp for ${slug}: ${loud.true_peak_dbtp}`);
    assert.ok(loud.true_peak_dbtp <= -1.2, `${slug} true_peak_dbtp ${loud.true_peak_dbtp} > -1.2 dBTP`);
    assert.ok(
      Math.abs(loud.integrated_lufs - targetLufs) <= 2.0,
      `${slug} integrated_lufs ${loud.integrated_lufs} outside ±2.0 LU of ${targetLufs}`
    );

    const qa = evaluateMasterQa({
      vStream,
      aStream,
      contactSheetExists: true,
      loud,
      targetLufs,
      truePeak
    });
    assert.equal(qa.qaPass, true, `${slug} evaluateMasterQa failed: ${JSON.stringify(qa)}`);
  });
}
