---
name: reel-factory
description: Use whenever the user wants a code-made 9:16 Reel, Short or TikTok built from scratch or from footage - horror, funny, guide, news or story; English, Hindi or Hinglish; voiceover with aligned captions; song-locked cinematic reels (V6.2 song-reel mode); code-drawn cinematic video. Brief-first direction, deterministic Canvas + FFmpeg render, measured SHIP/FIX QA that lists what it did not verify. Trigger on "make a reel", "horror reel", "reel from this song", "fix this reel's QA". Node >=22.
---

# reel-factory

Runtime: Node >= 22, `@napi-rs/canvas`, ffmpeg/ffprobe. Run `node scripts/doctor.mjs --json` first.

**Honest contract:** gates catch *measured* defects on the rendered MP4 only; `SHIP` = none found. They do not measure hook strength, fear, humour, pronunciation, taste or facts (`qa_report.json` lists them under `unverified`). A human watches with sound on a phone. Visuals are code-drawn, never "filmed".

## Hard rules

1. Story before code: `brief.json` -> `script.txt` + `lines.json` -> `shotlist.json`. No audio or scene code before the script is approved.
2. `script_gate` must pass. Read the script aloud; spoken-friend test; Hindi lines in Devanagari, digits spelled out.
3. Deterministic: no `Math.random` / `Date.now`. Scene and sound timing come from timeline events (`lib/events.mjs`), never hand-typed seconds.
4. Build scenes from `lib/kit` (sets, figures, props) + `lib/cinema` (camera, light, atmosphere, film). Main subject >= 22% of frame height unless establishing. Safe zone x 60..900, y 270..1440.
5. Voice stays dry (no echo unless asked). Kalpa per line via `build_vo.mjs`; horror Hindi default voice Aman.
6. Keys only in env / `~/.config/code-video-studio/tts.env`. Never print a key.
7. Never ship a `--draft` render. Final = full render + `master_and_qa.mjs`.
8. Horror: visual loop must reach `LOOP PASS`, motion must escalate, >= 0.5 s relative silence before each sound scare. Waivers only via `qa.json`, told to the user.
9. Sound is code-only (`sound.json` cues, tier A synthesis). Imported library files need a licence record. Song-locked reels: cut on measured hits, never duck the song.
10. Max 3 QA fix passes. Then stop and hand over the measured numbers and the `unverified` list.
11. Never claim fear, humour, quality or "perfect". Report verdict, numbers, and what was not verified.
12. Original work only: no copied creators, characters or lyrics; no AGPL / NonCommercial code (`LICENSES.md`).

## Workflow: `scripts/reel.mjs` runs every deterministic stage

1. `node scripts/reel.mjs init <dir> --genre <g> --lang <hi|en|hinglish>`. Claude writes `brief.json`, `script.txt`, `lines.json`.
2. `node scripts/reel.mjs run <dir>` gates the script and stops. **CHECKPOINT 1: user approves** -> `reel.mjs approve <dir> script`.
3. `run` again: per-line Kalpa voice -> `voiceover.wav`, `timeline.json` with `events`.
4. Claude writes `shotlist.json`, `scene.mjs` and `sound.json`; `node scripts/sound_design.mjs --project <dir>` renders stems.
5. `run`: plan lint + visual loop (Claude writes `critique.json` per iteration). **CHECKPOINT 2: user sees the sheet** -> `approve <dir> visual`.
6. `run`: render -> master + QA (stems auto-detected). `--auto` skips checkpoints and marks the run UNREVIEWED.
7. Human watches with sound on a phone. Caption via `ig-caption` + `ig-human`.

Fast path for existing footage: `node scripts/master_and_qa.mjs --input <video.mp4> --json`.

## References (read only when needed)

- READ [pipeline-gates.md](references/pipeline-gates.md) WHEN a gate fails or you need the full gate list.
- READ [direction-playbook.md](references/direction-playbook.md) WHEN writing the brief, shotlist or choosing a genre style.
- READ [horror-craft.md](references/horror-craft.md) and [script-critique.md](references/script-critique.md) WHEN genre is horror or a critique is requested.
- READ [narrative-horror-reels.md](references/narrative-horror-reels.md) WHEN writing EN/HI story scripts, serial or interactive formats.
- READ [runner.md](references/runner.md) WHEN running stages, approvals, exit codes or resuming.
- READ [voice-stage.md](references/voice-stage.md) WHEN writing `lines.json`, choosing voices or using timeline events.
- READ [kit.md](references/kit.md) and [cinema.md](references/cinema.md) WHEN writing scene code.
- READ [sound.md](references/sound.md) WHEN writing `sound.json`, choosing SFX/music or reading audio QA.
- READ [visual-loop.md](references/visual-loop.md) WHEN running or interpreting the visual loop.
- READ [widgets-and-motion.md](references/widgets-and-motion.md) WHEN building scenes, widgets or camera moves.
- READ [ffmpeg-mastering.md](references/ffmpeg-mastering.md) WHEN loudness, mixing, QA flags or `qa.json` thresholds matter.
- READ [qa-honesty.md](references/qa-honesty.md) WHEN reading `qa_report.json`, `verified`/`unverified` or horror waivers.
- READ [song-reel-mode.md](references/song-reel-mode.md) WHEN the user supplies a song and wants the picture locked to it (no voiceover).
- READ [html-canvas-video.md](rules/html-canvas-video.md) and [character-assets.md](rules/character-assets.md) WHEN writing scene code or characters.
- Known gaps: `AUDIT.md`. Tests: `npm test`.
