---
name: code-video-studio
description: Make deterministic 9:16 Reels/Shorts/TikToks in code (horror, funny, guide, news, story; EN/Hindi/Hinglish), including song-synced cinematic reels locked to a supplied song (V6.2 song-reel mode), with brief-first direction, aligned captions and measured SHIP/FIX QA. Node >=22 + Canvas + FFmpeg.
---

# code-video-studio

Lean router. Runtime: **Node >= 22 + `@napi-rs/canvas`**, ffmpeg/ffprobe (`~/.local/share/code-video-studio` or PATH). Load only the file the task needs. Full gate text: [pipeline-gates.md](references/pipeline-gates.md).

**Honest contract:** no tool guarantees a perfect reel. Gates catch *measured* defects on the rendered MP4; `SHIP` = none found. A human must still watch it with sound on a phone.

## Fast Path (trim / reframe / loudness / captions on existing footage)

```bash
node scripts/master_and_qa.mjs --input <video.mp4> --json
```

## Gates

**0 Story before anything** — `brief.json` ([schema](templates/brief.schema.json)) with `format` (`standalone` default / `serial` / `interactive`) and a `story` block, then `script.txt`, then `shotlist.json`, and for serial/interactive the `series_bible.md` / `branches.md` + `branch_tree.json`. No audio or scene code before this. Rules: [narrative-horror-reels.md](references/narrative-horror-reels.md) §0, [direction-playbook.md](references/direction-playbook.md). Horror: [horror-craft.md](references/horror-craft.md); idea asked -> `idea.md`; script asked -> also `critique.json` ([script-critique.md](references/script-critique.md)). `node scripts/script_gate.mjs <dir> --mode script` must pass. Visuals: [scene3d.mjs](lib/scene3d.mjs), never flat diagrams/cards. Gates cannot prove it is scary: read it aloud, watch with sound.

**Visual loop (before the final render):** `node scripts/visual_loop.mjs --project <dir>` -> read `visual_loop/iter_NN/sheet.png` -> write `critique.json` -> fix -> repeat until `LOOP PASS` ([visual-loop.md](references/visual-loop.md)). Targets come from reference reels (`scripts/style_ref.mjs`). Outlined vector kit: `lib/cartoon.mjs`.

**1 Preflight + audio**
1. `node scripts/doctor.mjs --json`.
2. Script: spoken-friend test, no riddle fragments, digits spelled out in Devanagari ([narrative-horror-reels.md](references/narrative-horror-reels.md) §6).
3. `node scripts/audio_timeline.mjs --script <f> --out <dir> --lang <en|hi|hinglish> --genre <horror|funny|guide|news|story|motivational>` builds `timeline.json` with words aligned to the real audio (`timeline.alignment.method` says how well).
4. Voices: keys only in `~/.config/code-video-studio/tts.env` (copy [tts.env.example](templates/tts.env.example); `TTS_PROVIDER=kalpa-labs`; never in this folder). Genre voice table is unverified by ear: `node scripts/voice_audition.mjs --genre <g> --lang <l> --out <dir>`, listen, pin picks in `voices.json` ([voices.mjs](lib/voices.mjs)).
5. Copy-a-Reel: reuse reference audio, master without `--bgm auto --sfx-auto`. From scratch: `--preset reel-vocal --bgm auto --sfx-auto`; horror: `--bgm horror [--bgm-gain -8]` (designed bed, linear loudness).
6. Media: `scripts/fetch_wikimedia.mjs`; log Tier 2/3 assets in `assets.json` ([schema](templates/assets.schema.json)).

**2 Scene code** — `scene.mjs` exports `VideoClock.setTime/draw` ([html-canvas-video.md](rules/html-canvas-video.md)); no `Math.random`/`Date.now`; characters per [character-assets.md](rules/character-assets.md); widgets in [widgets-and-motion.md](references/widgets-and-motion.md). Safe zones come from [profiles.mjs](lib/profiles.mjs) (default x 60..900, y 270..1440).

**3 Render + lint**
```bash
node scripts/render_and_lint.mjs --project <dir> --draft --json   # iterate
node scripts/render_and_lint.mjs --project <dir> --json           # final (never ship a draft)
```
Lints timeline, captions (<= 18 CPS, 2 lines, 42 chars), direction warnings, scene sanity. `--only-scenes a,b` re-renders edited scenes.

**4 Master + measured QA**
```bash
node scripts/master_and_qa.mjs --project <dir> --bgm auto --sfx-auto --preset reel-vocal --audio-mood auto --platform reels --json
```
Horror adds measured per-scene motion, darkness and a >= 20 dB pre-scare drop (`horror_relint.mjs` re-checks old reels). Writes `out/<slug>.mp4`, `qa_report.json`, `qa_contact_sheet.png`, `qa_safezone_sheet.png` (red = platform UI). `verdict: FIX` lists failures (flashes, freeze, black, dead air, draft size, placeholder tone, music over voice, spec). Fix, re-render, re-master; `--strict` exits non-zero unless SHIP. Then do the human review checklist in the report.

## Song-reel mode (V6.2): a reel locked to a supplied song

When the user supplies a song/trend audio and wants the picture locked to it (no voiceover), skip the voice/caption path and follow [song-reel-mode.md](references/song-reel-mode.md): measure the song (`scripts/song_reel/beat_map.py`), cut on real bass hits (never a bar grid), intro inside the song and outro after it, never duck the song, SFX on the song's grid, correct rig directions (`cycle_check.mjs`), camera moves per song section and the code-only film look, both deliverables (baked + in-app SFX-only), then verify with `sync_report.py` and `audio_continuity.py`. Reference build: `examples/song-reel-saajan/`.

## Map

- Direction & genres: [direction-playbook.md](references/direction-playbook.md)
- Mastering & QA flags: [ffmpeg-mastering.md](references/ffmpeg-mastering.md)
- Horror craft + script critique: [horror-craft.md](references/horror-craft.md), [script-critique.md](references/script-critique.md); EN-HI storytelling: [narrative-horror-reels.md](references/narrative-horror-reels.md)
- Tests: `npm test`. Audit of V2 and known gaps: `AUDIT.md`

## Licensing

Clean-room MIT. Never copy code from AGPL (`OpenMontage`), PolyForm Noncommercial (`onetake`) or CC BY-NC (`lemo-animi`) repos. See `LICENSES.md`.
