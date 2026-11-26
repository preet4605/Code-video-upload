# code-video-studio: full gate contract

Lean router for deterministic 2D video production on **Node >= 22 + `@napi-rs/canvas`**; `bin/ffmpeg` + `node_modules` runtime in `~/.local/share/code-video-studio` (ARM64 PRoot; Chromium optional). Load **only** the rule or reference file needed for the active task.

## Fast Path (Post-Processing Only)

For trimming, 9:16 reframing, LUFS loudness normalization, or ASS/SRT caption burn-in on existing footage, skip Gates 1–3 and run Gate 4 directly:

```bash
node scripts/master_and_qa.mjs --project <dir> --json
```

See [ffmpeg-mastering.md](ffmpeg-mastering.md) for ordered filter chains and platform presets.

## What "industry level" means here (and what it does not)

No tool can guarantee a reel is perfect or will perform. This skill guarantees that the *known, measurable* failure classes are caught on the **rendered MP4** (flashes, frozen/black frames, dead air, draft resolution, placeholder audio, voice masked by music, bad colour tags, safe-zone overlap is shown visually) and that creative decisions (hook, pacing, ending, sound design, caption honesty) are written down and linted. A `SHIP` verdict means "no measured defect". **A human must still watch it with sound on a phone** (checklist is printed in every report).

## 4-Gate Production Contract

### Gate 0 — Brief & Direction (before any script)
1. Write `brief.json` ([brief.schema.json](../templates/brief.schema.json), example: [brief.example.json](../templates/brief.example.json)): platform, genre, viewer, hook, payoff, cta, loop, sources.
2. Follow [direction-playbook.md](direction-playbook.md): hook by 0.8 s, a visible change about every 4 s, end on payoff/callback, genre pack, audio rules.
3. Pick the voice by genre: `--genre horror|funny|guide|news|story|motivational` on `audio_timeline.mjs`. The default voice table is unverified by ear: audition with `node scripts/voice_audition.mjs --genre <g> --lang <l> --out <dir>` and pin your choice in `~/.config/code-video-studio/voices.json` (see `lib/voices.mjs`). API keys live in `~/.config/code-video-studio/tts.env`, never in the skill folder.

### Gate 1 — Preflight & Timed Audio
1. Run `node scripts/doctor.mjs --json` to verify `node >= 22`, `ffmpeg`, `ffprobe`, `@napi-rs/canvas` (or Chromium), fonts, and TTS.
2. **Human Script Rule (Anti-AI)**: Write natural spoken storytelling as if explaining to a friend — complete cause-and-effect sentences, zero 2–3 word cryptic riddle fragments, zero one-word rhetorical questions (`"Mass gone?"`, `"The result?"`), zero unexplained jargon/formulas, and zero raw digits (`0-9`/`०-९`) inside Devanagari TTS text (spell all numbers in Hindi words). Match on-screen HUD language to spoken audio, and audition raw VO before rendering. See [references/narrative-horror-reels.md](narrative-horror-reels.md) §6.
3. **Audio Mode Rule**:
   - **Copy-a-Reel**: Extract & reuse the reference audio (`ffmpeg -i ref.mp4 -vn -c:a copy ref_audio.m4a` → `audio_timeline.mjs --audio ref_audio.m4a`) and master WITHOUT `--bgm auto --sfx-auto`.
   - **From-Scratch**: Synthesize voiceover with the active configured TTS provider (`--tts auto` via `~/.config/code-video-studio/tts.env` or local CLI, swappable anytime) AND master with `--preset reel-vocal --audio-mood <genre> --bgm auto --sfx-auto`.
4. Build `timeline.json` ([timeline.schema.json](../templates/timeline.schema.json)) with `node scripts/audio_timeline.mjs --script <file> --out <dir> --lang <en|hi|hinglish> --genre <genre> [--preset reel-720] [--tts auto|<provider>|none] [--audio <file>]`. Word timings are **aligned to the real audio** (provider cues when available, else voiced-span weighting anchored on real pauses); `timeline.alignment.method` records which, and QA warns when it is only approximate. Audition raw VO before rendering.
5. Fetch CC Tier 3 media with `node scripts/fetch_wikimedia.mjs --query <q> --out <dir>` and log all Tier 2/3 assets in `assets.json` ([assets.schema.json](../templates/assets.schema.json)).

### Gate 2 — Deterministic Scene Code & 3-Tier Assets
1. Implement `scene.mjs` exporting `VideoClock.setTime(seconds)` and `draw(ctx, width, height, timeline)` per [html-canvas-video.md](../rules/html-canvas-video.md).
2. Follow the determinism ban-list (no `Math.random()`, `Date.now()`, `requestAnimationFrame`, or CSS transitions).
3. Build characters and media using the 3-Tier system in [character-assets.md](../rules/character-assets.md).

### Gate 3 — Segmented Render, Self-Check & Surgical Re-Render
1. Run preflight + runtime probe (`--verify-only`) or draft render first (`540x960 @ 15fps`):
   ```bash
   node scripts/render_and_lint.mjs --project <dir> --draft --json
   ```
2. Rendering encodes H.264 High, bt709-tagged, closed GOP, rate-capped (`lib/encode.mjs`; `ENCODER_VERSION` is part of the cache hash). `render_and_lint.mjs` enforces: `lintTimeline()` (motion, `<= 20%` static holds, WCAG `<= 3` flashes/s, captions `<= 18` CPS / `<= 2` lines / `<= 42` chars / no overlaps, plus direction warnings from `lib/direction_lint.mjs`), `probeSceneSanity()`, auto sub-chunking (`--max-chunk-s 12`), and per-chunk H.264 `segment.mp4` caching.
3. Surgical fix: pass `--only-scenes id1,id2` to re-render only edited scenes while reusing cached manifests. Omit `--draft` for full render (`1080x1920` or `--reel-720`).

### Gate 4 — Stream-Copy Master & Measured SHIP/FIX QA
1. Render **without `--draft`** for anything you will post, then master:
   ```bash
   node scripts/master_and_qa.mjs --project <dir> --bgm auto --sfx-auto --preset reel-vocal --audio-mood auto --platform reels --json
   ```
   Add `--strict` to exit non-zero unless the verdict is `SHIP`. `--safe-profile ads` uses the stricter Meta-ads zone.
2. Output: H.264 High `yuv420p` bt709, 48 kHz AAC 192k `+faststart`, `-14 LUFS` / `-1.5 dBTP` (reel-vocal), plus `out/qa_contact_sheet.png`, `out/qa_safezone_sheet.png` (red bands = platform UI) and `out/qa_report.json`.
3. `scripts/qa_video.mjs` (also runnable standalone: `--input <mp4> --project <dir>`) measures the MP4: spec/draft/fps/colour tags, WCAG flashes from per-frame luminance, `freezedetect`, `blackdetect`, `silencedetect` (dead air > 2 s), hook motion in the first 0.5 s, A/V length, loudness/true peak, voice-vs-bed level, placeholder-tone audio. **FIX** = at least one failing check; fix the cause, re-render the affected scenes (`--only-scenes`), re-master.
4. Human review (always): open both contact sheets, then watch with sound on a phone using the checklist in the report. `SHIP` alone does not catch mispronounced TTS, taste, or a weak hook.

## Progressive Disclosure Map

- **Engine & Determinism**: [rules/html-canvas-video.md](../rules/html-canvas-video.md)
- **3-Tier Characters & Provenance**: [rules/character-assets.md](../rules/character-assets.md)
- **Explainer / Physics / Horror Widgets**: [references/widgets-and-motion.md](widgets-and-motion.md)
- **Direction (brief, hook, pacing, genres, audio, captions, ship checklist)**: [references/direction-playbook.md](direction-playbook.md)
- **EN/HI Storytelling & Horror Reels**: [references/narrative-horror-reels.md](narrative-horror-reels.md)
- **FFmpeg Mastering & Captions**: [references/ffmpeg-mastering.md](ffmpeg-mastering.md)
- **Safe zones, platforms, QA thresholds (single source of truth)**: [lib/profiles.mjs](../lib/profiles.mjs)
- **Schemas & Example**: [templates/brief.schema.json](../templates/brief.schema.json), [templates/timeline.schema.json](../templates/timeline.schema.json), [templates/assets.schema.json](../templates/assets.schema.json), [examples/hello-15s/](../examples/hello-15s/timeline.json)

## Clean-Room & Licensing Note

All scripts, rules, and widgets are authored clean-room under MIT. Never copy code from AGPL-3.0 (`OpenMontage`), PolyForm Noncommercial (`onetake`), or CC BY-NC 4.0 (`lemo-animi`) repositories.
