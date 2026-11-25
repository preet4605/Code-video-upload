# Plan: code-video-studio → one-command reel generator

Status: plan only, nothing built. Written 2026-11-25. Reviewed by the advisor model before writing.

## 1. Facts (checked in this session)

| Fact | Evidence |
|---|---|
| The skills synced into the Claude app are prose only (`SKILL.md`). The runtime lives at `workspace/skills/code-video-studio-v6.2/` on branch `claude/project-thread-n78b4s` (plus `.zip`). | `ls-tree`; `/mnt/project-files` does not exist here |
| Runtime: ~9,000 lines JS, 127 tests, bundled Noto Sans Devanagari font, `@napi-rs/canvas`. | extracted to scratch |
| `doctor` passes (Node 22.23.5, ffmpeg, canvas). `npm test`: 124 pass, 2 fail, 1 skipped. | ran it |
| The 2 failures are the same check: `SKILL.md` is 6,110 bytes, limit 5,500. V6.2 added text without trimming. Not a runtime bug. | test output |
| Kalpa is already wired in (`audio_timeline.mjs`), but: whole script synthesized as one blob; voice table marked "unverified"; does not send `model` or `sample_rate`; Aman is only the "previous Hindi default". | read code |
| No ASR installed (`faster_whisper`, `whisper`, `librosa` all missing). Word timing is approximate (±0.15 s typical, per its own AUDIT). Kalpa gives no word timestamps. | import checks, AUDIT.md |
| Prior post-mortem (same branch) already names the real failures: cliffhangers, flat 2D scenes, QA trusting declared motion, generic sound, rushed voice, stories too short. v6.1/v6.2 added gates for most. | `skill-update-prompt.md`, `qa_report.json` |

Consequence: this is not a rewrite. Most gates exist. The gaps are below.

## 2. What "simple command" can honestly mean

Brief, script and scene code are creative steps Claude writes. Code cannot do them. So:

`reel "idea" --genre horror --lang hi` = one command that runs every deterministic stage, and **stops at two human checkpoints** (script approved, visual loop passed) unless `--auto`. `--auto` output is labelled UNREVIEWED.

Not promised: fear, humour, taste, pronunciation. Gates catch measured defects only. Visuals are code-drawn graphics, never "filmed". Done = a reel the user watched on a phone with sound and approved. Not before.

## 3. Phases (in order, each shippable)

**P0 · One source of truth (small)**
- Bring the package into this branch at `.claude/skills/code-video-studio/`. Today it exists only on another branch; the container is ephemeral and the org-synced copies are not ours to edit.
- Fix the 2 tests properly: move V6.2 song-mode text from `SKILL.md` into `references/`, get under 5,500 bytes.
- Regression: rebuild `zero-shadow-day/final` from its committed source; compare duration, QA verdict, and frame hashes against the committed mp4.
- Ship a zip so the user can re-upload to the app.

**P1 · Kalpa voice stage (medium)**
- Synthesize **per line**, not per script. Line durations come from WAV length (exact). Designed silences become exact gaps. A bad line is retried alone.
- Cache by hash(text, voice, temp, model) in the project folder; the free allowance is 1,000 minutes and expires 3 months after org creation.
- Send `model: kalpa-tts-1`, `sample_rate`, `params.temperature`; surface API errors (402 do-not-retry, 429 Retry-After, `context_length_exceeded`).
- Replace the voice table with the live catalog (verified IDs): horror hi = **Aman**; Kiara/Sana/Arjun/Nikhil/Dev available; Wren etc. for English. Keep user overrides.
- Measure line-to-line voice drift (loudness spread, pitch spread) over a 10-line test. Decide temperature from that, not by guess.
- Word-level captions: exact per line, approximate inside a line. State which in QA. Try `faster-whisper` only if its model can be downloaded through the proxy; otherwise skip and say so.

**P2 · Orchestrator (medium)**
- `scripts/reel.mjs`: resumable stages with `state.json`: brief → script → gates (`story_lint`, `direction_lint`, `script_gate`) → **checkpoint 1** → TTS → timeline → scene → `visual_loop` → **checkpoint 2** → render → master + QA → contact sheet → caption.
- Reuse, don't rebuild: existing scripts are the stages.
- Caption/hashtags via the installed `ig-caption` + `ig-human`, not new code.

**P3 · Scene kits (largest, riskiest)**
- This is where visual quality comes from. Today each `scene.mjs` is hand-drawn per reel.
- Mine the 21 existing reels' `scene.mjs` and `kit.mjs` for shared parts; extract per-genre kits (room, corridor, courtyard, silhouettes, fog, light, camera moves). Do not invent from scratch.
- Measured by `visual_metrics` against calibrated targets. Report before/after on a fixed shot list.
- Risk: kits can make output samey. Cap by requiring each reel to vary palette, camera and one signature element.

**P4 · Measured QA gaps (its own AUDIT lists these)**
- Pacing measured from frame differences, not declared `beats`.
- SFX level vs voice, and SFX placement vs word onsets.
- Automatic text-under-safe-zone detection (today: drawn overlay, human looks).
- Two-pass loudnorm.
- Each new check needs a deliberately broken fixture that fails it.

**P5 · Acceptance**
- 3 reels, each from one command: horror Hindi (Aman), funny Hinglish, guide English.
- You watch each with sound. Pass = you would post it. Anything less: the gap goes back into P1–P4.
- Cost: ~1 min of Kalpa audio per reel plus retries; negligible against 1,000 min.

## 4. Order and cost

P0 → P1 → P2 gives the working command with the best voice, no new visuals. Do these first. P3 is the real quality lever and the real time sink; start it only after P0–P2 work. P4 can interleave.

## 5. Decisions needed from you

1. Approve P0–P2 now? (P3 afterwards, separately.)
2. OK to commit the package (~9k lines + fonts + examples) into this branch?
3. Which 3 acceptance reels?
