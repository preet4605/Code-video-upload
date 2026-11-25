# Changelog

## V6.2.1 (25 Nov 2026)
- Voice echo is now opt-in. `--audio-mood horror`/`suspense` used to add `aecho` 45|90 ms to the narration, which sounded like an empty room (reported by Love on Zero Shadow Day). The mood now applies EQ only; pass `master_and_qa.mjs --voice-echo` to add the echo when the user asks for it. `getMoodVoiceFilter(mood, { echo })` in lib/audio_sfx.mjs. Verified: horror default measures like the dry voice; `--voice-echo` restores the 45/90 ms echo.


## V6.2 (2026-11-25): song-reel mode

### Added
- `references/song-reel-mode.md`: rules for song-locked, code-drawn cinematic reels (measure, plan, intro/outro placement, no ducking, SFX on the song's grid, rig directions, camera per song section, film-look parameters, dual deliverables, verification, posting).
- `scripts/song_reel/`: `beat_map.py` (starter audio measurement), `sync_report.py` (picture-vs-hit offsets from the finished MP4), `audio_continuity.py` (detects ducks/dropouts vs the original song), `cycle_check.mjs` (8-angle rider rig check).
- `examples/song-reel-saajan/`: the full reference build (scene.mjs, sfx.py, build_timeline.mjs, stitch.sh, beat_map.json).

### Lessons encoded (from the Saajan reel)
Pedal and knee direction, a mid-song duck heard as a cut, grid vs real hits, intro/outro placement, text on vocal onsets, code-only film look and letterbox, baked + in-app deliverables, 96 kHz AAC QA failure.

### Limits
`beat_map.py` found 69/84 hand-checked hits within 50 ms. Sync numbers come from picture motion, not ears. No true depth-of-field or 3D camera.

## V6 (2026-11-24): visual self-improvement loop

### Added
- `lib/visual_metrics.mjs`: per-frame detail metrics (sharp edges, contrast, saturation, palette bins, outline ink, focal dominance, dead cells on a 3x5 grid) with concrete fix hints per deficit.
- `scripts/style_ref.mjs`: calibrate targets from reference reels (floor = weakest reference x 0.8, aim = median). `templates/visual_targets.json` ships calibrated on the four code-made reels supplied (orbit, earth-share, "AI is not creative", Bal Hanuman). The hand-painted @doodleodon_ reel was excluded: not code.
- `scripts/visual_loop.mjs`: renders 3 keyframes per shot -> measures -> labelled `sheet.png` + deficits -> refuses the next iteration until `critique.json` (what is seen, problems, fix, 6 rubric scores) is written; rejects repeated fixes, rubber-stamp scores and unjustified regressions; flags static shots; stops at LOOP PASS (metrics + no score < 3) or 6 iterations.
- `lib/cartoon.mjs`: outlined flat-vector kit (ink outlines, shade tones, graphic light, kid/woman/nani rigs with expressions, bed, window, door with light strip + feet, clock, fan, wall decor).
- `examples/visual-loop-demo`: a real 4-iteration run (scene.iter01-04.mjs, sheets, critiques, log). Mean score 0.32 -> 0.83; detail 0.000-0.007 -> 0.030-0.058; critique min 1 -> 3.
- `references/visual-loop.md`; `tests/phase10_visual_loop.test.mjs` (6 tests).

### Changed
- `master_and_qa.mjs`: visual loop not run = warning; run but not converged = FIX.
- SKILL.md: visual loop step before the final render.

### Limits
- The critique is the same model grading its own frames; the metric floors, refusal rules and regression notes keep it honest, not perfect. Taste stays human.
- Metrics measure detail/readability, not beauty. A busy but ugly frame can pass the numbers; that is what the critique and your eye are for.
- The V5 horror examples were left as they are (by request): they fail the new loop's targets (detail ~0.002-0.007 vs floor 0.0246).

## V5 (2026-11-24): complete horror stories, three formats, measured horror gates

### Added
- `brief.format` = standalone | serial | interactive, with `story`, `series`, `choice`, `shots`, `sound` in `templates/brief.schema.json`.
- `lib/story_lint.mjs`: story completeness per format (planted clues before the twist, >= 3 escalation beats, false relief, silence beat, scare cue, twist explains hook, no question/"or was it" endings, CTA/part only after the payoff in the last 5 s, recap for parts 2+, series-bible matching, interactive branches/tree/closing line).
- `lib/horror_measure.mjs`: measured per-scene motion floor (2.5 s), camera estimate, darkness warn (> 70% frames luma < 8), blackout fail (> 1.5 s), silence-before-scare (>= 20 dB drop + stinger).
- `scripts/horror_sound.mjs`: designed horror bed from timeline.json (room tone, ambience, drone, sub swells, heartbeat curve, foley, pre-scare drop, stingers, loop tail).
- `lib/voice_fx.mjs`: whisperize, tempo, per-line assembly; `[WHISPER]` lines processed; `[SILENCE dur=]` and `[SCARE name=]` script tags.
- `lib/scene3d.mjs`: 3D-ish scene kit.
- `scripts/horror_relint.mjs`: re-lint any reel (project[:mp4]) against all V5 gates.
- Examples: `examples/horror-ek-baar` (standalone, rebuilt in 3D), `examples/horror-sheesha-interactive` (interactive, bible + branches + tree, working mirror).
- Fixture: `tests/fixtures/v1-cliffhanger` (reconstructed v1 failure modes). Tests: `tests/phase9_formats.test.mjs` (21 tests, incl. a determinism test for both scene3d examples).

### Changed
- `master_and_qa.mjs`: `--bgm horror`, `--bgm-gain <dB>` (voice-to-bed measured with the same gain), linear loudness for horror (`--linear-loudness` for others), story + measured horror gates in the verdict, SHIP-does-not-measure-fear note.
- `render_and_lint.mjs`: story lint errors fail fast, `--draft` included (`--skip-story-lint` for legacy audits only). Segment cache hash now includes the skill's `lib/*.mjs` contents and cue/silence timing, so updating the skill or re-timing a scare never reuses stale segments.
- `audio_timeline.mjs`: horror pacing (tempo 0.95, 0.5 s gaps), per-line TTS for horror (`--per-line` for others), Kalpa `temperature` with retry without it.
- `direction_lint.mjs`: horror duration band by format; declared-beat pacing check skipped for horror (measured instead); < 9 lines warning.
- `horror_gate.mjs`: shotlist requires camera, sound_cue, sync_word (must be in the script); camera-shift estimate.
- Docs: SKILL.md Gate 0 = format + story + shot list + bible/branches first; narrative-horror-reels §0 story gates; direction-playbook shot list, horror visual pack, horror pace, horror audio.

### Verified end to end with a stub voice
Per-line synthesis with a speech-band stand-in at -18.5 LUFS, mastered with the documented Gate 4 command (`--bgm horror --preset reel-vocal --audio-mood auto`): voice-to-bed 12.8 LU (>= 9), pre-scare drop 39 dB with the horror voice echo on, loudness -14.1 LUFS, all horror gates pass (only draft size/fps fail). The stub is not a voice: real TTS timing and pronunciation are still untested.

### Before / after (scripts/horror_relint.mjs)
See `tests/fixtures/v1-cliffhanger/RELINT.txt`. Relint PASS is not SHIP: it skips voiceover, resolution, fps, loudness and sync, which only `master_and_qa.mjs` checks.

### Migration
Existing horror projects without `brief.story`, `critique.json` and `shotlist.json` now fail `render_and_lint` (even `--draft`). Use `horror_relint.mjs` to audit old reels and `--skip-story-lint` only to re-render them for that audit.

### Honest limits
- Depth is NOT measured. A moving flat 2D scene would pass the measured gates; the shotlist `layers` are declarations. Root cause #2 is addressed by the kit, the docs and the shotlist, not by a measurement.
- `scripts/qa_video.mjs` on its own does not run the horror gates; they run in `master_and_qa.mjs` and `horror_relint.mjs`.

### Not verified
Live TTS (sandbox blocks api.kalpalabs.ai), human listening, a real phone in a dark room, the user's reel-01..10 and the "Ginti" pilot (not uploaded).

## V6.1 (horror look, unfinished)
- `useTheme('horror')`: cold desaturated palette, dread props (grime/cracks/peel/scratches/handprint/cobweb/bareBulb/doll), `darkness()` motivated-light mask, `snapshot()+lineGlow()` moonlit line pass, `grain()`.
- `hue_families` metric; `--mood dark` targets (`templates/visual_targets.horror.json`); `visual_loop.mjs` auto-selects horror targets when `brief.genre === 'horror'`.
- `examples/horror-look-demo`: loop STOPPED at 6 iterations without passing (edges/contrast ~0.03/6 under floor, dead lower third). Not verified as frightening. Needs human art direction.
