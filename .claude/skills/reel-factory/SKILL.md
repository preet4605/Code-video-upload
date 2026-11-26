---
name: reel-factory
description: Use whenever the user wants a code-made 9:16 Reel, Short or TikTok built from scratch or from footage - horror, funny, guide, news or story; English, Hindi or Hinglish; voiceover with aligned captions; song-locked cinematic reels (V6.2 song-reel mode); code-drawn cinematic video. Brief-first direction, deterministic Canvas + FFmpeg render, measured SHIP/FIX QA that lists what it did not verify. Trigger on "make a reel", "horror reel", "reel from this song", "fix this reel's QA". Node >=22.
---

# reel-factory

Runtime: Node >= 22, `@napi-rs/canvas`, ffmpeg/ffprobe. Run `node scripts/doctor.mjs --json` first.

**Honest contract:** gates catch *measured* defects on the rendered MP4 only; `SHIP` = none found. They do not measure hook strength, fear, humour, pronunciation, taste or facts (`qa_report.json` lists them under `unverified`). A human watches with sound on a phone. Visuals are code-drawn, never "filmed".

## Hard rules

1. Story before code: `brief.json` -> `script.txt` -> `shotlist.json`. No audio or scene code before the script is approved.
2. `script_gate.mjs <dir> --mode script` must pass. Read the script aloud; spoken-friend test; digits spelled out in Devanagari for TTS.
3. No `Math.random` / `Date.now` in scenes; renders are deterministic.
4. Safe zone x 60..900, y 270..1440 (see `lib/profiles.mjs`). Nothing important under platform UI.
5. Voice stays dry: no echo or reverb on narration unless the user asks (`--voice-echo`).
6. API keys only in `~/.config/code-video-studio/tts.env` (never in the skill folder or chat). Never print a key.
7. Never ship a `--draft` render. Final = full-size render + `master_and_qa.mjs`.
8. Horror: the visual loop (`scripts/visual_loop.mjs`) must reach `LOOP PASS`, motion must escalate, pre-scare drop >= 20 dB. Skipped loop or weak escalation = FIX. Waivers only via `qa.json` and must be told to the user.
9. Song-locked reels: cut on measured hits, never a bar grid; never duck the song.
10. Max 3 QA fix passes. Then stop and hand the reel to the human with the measured numbers and the `unverified` list.
11. Never claim fear, humour, quality or "perfect". Report the verdict, the numbers, and what was not verified.
12. Original work only: no copied creators, characters or lyrics. Clean-room MIT; no AGPL / NonCommercial code (`LICENSES.md`).

## Workflow (two human checkpoints)

1. **Preflight** `doctor.mjs`. **Brief** (genre, lang, duration, story block): [brief schema](templates/brief.schema.json).
2. **Script** + critique + `script_gate`. **CHECKPOINT 1: user approves the script.** (`--auto` skips it; label output UNREVIEWED.)
3. **Audio**: `node scripts/audio_timeline.mjs --script <f> --out <dir> --lang <en|hi|hinglish> --genre <g>` -> `timeline.json` with aligned words. Keys: [tts.env.example](templates/tts.env.example).
4. **Scene code** (`scene.mjs`, `VideoClock.setTime/draw`). Draft: `node scripts/render_and_lint.mjs --project <dir> --draft --json`.
5. **Visual loop** `node scripts/visual_loop.mjs --project <dir>` -> read the sheet -> write `critique.json` -> fix -> repeat to `LOOP PASS`. **CHECKPOINT 2: user sees the visual result.**
6. **Final** `render_and_lint.mjs --project <dir> --json`, then `node scripts/master_and_qa.mjs --project <dir> --bgm auto --sfx-auto --preset reel-vocal --audio-mood auto --platform reels --json` (horror: `--bgm horror`). Fix FIX items (rule 10), re-master.
7. **Human review** with sound on a phone. Caption/hashtags via the `ig-caption` and `ig-human` skills if installed.

Fast path for existing footage: `node scripts/master_and_qa.mjs --input <video.mp4> --json`.

## References (read only when needed)

- READ [pipeline-gates.md](references/pipeline-gates.md) WHEN a gate fails or you need the full gate list.
- READ [direction-playbook.md](references/direction-playbook.md) WHEN writing the brief, shotlist or choosing a genre style.
- READ [horror-craft.md](references/horror-craft.md) and [script-critique.md](references/script-critique.md) WHEN genre is horror or a critique is requested.
- READ [narrative-horror-reels.md](references/narrative-horror-reels.md) WHEN writing EN/HI story scripts, serial or interactive formats.
- READ [visual-loop.md](references/visual-loop.md) WHEN running or interpreting the visual loop.
- READ [widgets-and-motion.md](references/widgets-and-motion.md) WHEN building scenes, widgets or camera moves.
- READ [ffmpeg-mastering.md](references/ffmpeg-mastering.md) WHEN loudness, mixing, QA flags or `qa.json` thresholds matter.
- READ [qa-honesty.md](references/qa-honesty.md) WHEN reading `qa_report.json`, `verified`/`unverified` or horror waivers.
- READ [song-reel-mode.md](references/song-reel-mode.md) WHEN the user supplies a song and wants the picture locked to it (no voiceover).
- READ [html-canvas-video.md](rules/html-canvas-video.md) and [character-assets.md](rules/character-assets.md) WHEN writing scene code or characters.
- Known gaps: `AUDIT.md`. Tests: `npm test`.
