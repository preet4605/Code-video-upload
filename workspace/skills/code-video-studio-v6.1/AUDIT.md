# code-video-studio V2 → V3 audit

Scope: the V2 zip as uploaded. Line numbers refer to **V2**. "Perfect every reel" is not an achievable guarantee for any tool; V3 aims at *measured* defect detection plus written, linted direction, and says plainly what it still cannot judge.

## A. Flaws found in V2 (and what V3 did)

| # | Flaw (V2 location) | Why it matters | V3 |
|---|---|---|---|
| 1 | **Gates trust self-declared fields.** `lintTimeline` (render_and_lint.mjs L86) believes `animated_properties`, `flashes_per_sec`, `hold`; `probeSceneSanity` (L335) samples ~3 frames/scene. | A scene can declare 0 flashes and strobe, or list a property it never animates. | New `scripts/qa_video.mjs` measures the rendered MP4: per-frame luma flash count (WCAG 2.3.1 style), `freezedetect`, `blackdetect`, `silencedetect`, hook motion. Verified with deliberately broken fixtures (see §C). |
| 2 | **Gate 4 could not complete.** SKILL.md Gate 4.4 requires `../reel-self-improve/` and `ig-human` (narrative doc L48): neither is in the package. | Pipeline dead-ends or is silently skipped. | Dangling refs removed. Verdict (`SHIP`/`FIX`) is built into `master_and_qa.mjs` → `out/qa_report.json`. |
| 3 | **Word timing was estimated, not measured.** `buildTimeline` (audio_timeline.mjs L298) spaces words evenly by WPM; `scaleTimelineToAudioDuration` (L437) stretches linearly; TTS is synthesized as one blob. | Highlight-word captions, 1–3-frame anticipation and SFX sync were fiction. | `lib/align.mjs`: provider VTT cues when available (edge-tts now writes them), else voiced-span weighting that anchors script punctuation breaks to real pauses; scenes, beats, SFX and captions are re-timed from it. `timeline.alignment.method` records the method; QA warns when it is approximate. **Not forced alignment by an ASR model.** |
| 4 | **Colour not tagged/converted.** Encoders (L507 `encodeSegment`, L540 pipe) used default RGB→YUV (BT.601 in swscale) with no tags; measured V2 master: `color_space` unset. No profile/rate cap. | Colour shift on phones; ingest differences. | `lib/encode.mjs`: bt709 matrix + tags, High profile, CRF 18, `-maxrate 12M`, closed GOP, AAC 192k. `ENCODER_VERSION` is folded into `sceneHash` so stale cached segments are never concatenated with new ones. |
| 5 | **Draft masters report `ok: true`.** The 540x960 hello master passed. | A draft can be posted by accident. | Manifest records `draft`; QA fails drafts and `< 720 px`; 720 px (reel-720) ships with a warning. |
| 6 | **Placeholder sine tone shipped as audio** when no VO/bgm/sfx (master_and_qa.mjs, both branches). | A 220 Hz tone is not sound design. | QA `FIX`: "placeholder tone only". All 4 V2 examples without audio flags now correctly return FIX. |
| 7 | **Safe zones wrong and duplicated.** `SAFE_ZONE_916` (widgets L1212), lint, 3 docs; top 160 px / bottom 360 px are below every published figure I found (Meta ads: ≈14% top, 35% bottom, 6% sides; TikTok/Shorts bottom 320–660 px). Lint checked only declared boxes. | Hooks, headers and captions hidden under platform UI. Real examples were affected: the horror example's header sat at y≈210, caption bar bottom crossed 1440. | One source of truth `lib/profiles.mjs` (`universal` default 60..900 × 270..1440; `ads` stricter). Widgets/lint/docs derive from it. Caption bar clamped above the zone; provenance header default moved in; example header fixed. New `out/qa_safezone_sheet.png` draws the red bands over real frames. Lint still only checks declared boxes. |
| 8 | **No direction layer.** Hook/pacing/ending/sound-design rules were prose for horror only. | "Perfect from direction" needs enforceable, genre-agnostic rules. | `brief.json` schema, `references/direction-playbook.md`, `lib/direction_lint.mjs` (first words ≤ 0.8 s, duration band, change every ~4 s, loop/callback, ending, audio present, caption-timing honesty). These are warnings in lint and QA, not hard fails. |
| 9 | **Audio QA was loudness only.** Nothing checked dead air (despite the doc warning), speech masking, or lead-in silence. | | `silencedetect` dead air (> 2 s), lead-in silence warn, voice-to-bed ≥ 9 LU (measured pre-ducking from the VO and bed stems). |
| 10 | **Voice selection was one default per language** (kalpa defaults in `synthesizeTts`). | Request: best voice per reel genre. | `--genre` + `lib/voices.mjs` + `scripts/voice_audition.mjs` (see §D). |
| 11 | **Node 24 hard requirement is false.** doctor L127 `nodeMajor >= 24`; no Node-24-only API found (grep), everything ran on 22.23.5. | False "doctor failed" on valid setups. | `>= 22`, `engines` in package.json. |
| 12 | **Test infra.** No `npm test`; `node --test tests/` fails on Node 22; `resolveBin` test fails whenever the static runtime is absent. | | `npm test` (glob), runtime test skips when RUNTIME_DIR has no ffmpeg. |
| 14 | **Caption chunks were V2's 84-char blocks, stretched.** With real alignment that makes CPS ≈ the real speech rate and would have started failing lint on dense lines. | | Captions are re-chunked from the aligned words (`rechunkCaptions`: sentence/clause breaks, speaker changes, ≤ 34 chars, orphan folding, 0.1 s lead, hold after speech, merge when a chunk exceeds 17 CPS). A dense Hinglish test (~18 chars/s raw speech) renders without lint errors. |
| 15 | **`allow_static` / `allow_black` scene flags existed in V2 but QA ignored them; `qa.json` was mentioned but unread.** | A deliberate black beat or still could never ship. | Scene `allow_static` / `allow_black` / `allow_silence` downgrade the matching failure to a warning for that scene's window; `<project>/qa.json` `{ "thresholds": {...} }` overrides numbers. Unit-tested. |
| 16 | **`auto` TTS preferred Fish/espeak over Kalpa** even with a Kalpa key configured. | The user's chosen voice would not be used on-device. | A present `KALPA_API_KEY` now ranks first; `templates/tts.env.example` ships `TTS_PROVIDER=kalpa-labs` with an empty key. |
| 13 | **Hello example shipped a hard-coded false claim** ("built on Node v24") and no brief. | | Fixed; briefs added to all 5 examples. |

## B. Known gaps still in V3 (not fixed, not hidden)

- **No ASR/forced alignment.** Best case is provider cues; otherwise ±~0.15 s typical (not measured against ground truth, because no real TTS ran here). No ASR round-trip to catch mispronounced TTS: a human must listen.
- **Loudnorm is single-pass (dynamic).** Two-pass linear loudnorm is not implemented. A post-encode ebur128 check plus true-peak retry catches gross misses; the retry re-encodes AAC (small generation loss).
- **Safe-zone check is visual, not automatic**: lint only validates declared boxes; QA draws the overlay but does not detect text under it.
- **Direction rules are heuristics** (first words ≤ 0.8 s, change every ~4 s, platform duration bands). They are not performance predictions. QA cannot judge hook strength, humour, taste, pronunciation, or factual accuracy.
- **Flash detection uses whole-frame mean luma** (a reasonable, conservative proxy, not the full WCAG red-flash/area test).
- **Voice table is unverified by ear** (§D). SFX/bed quality is untested by ear.
- Two-colour scene-cut/jump-cut detection and cover-frame selection are not implemented.

- **Pacing lint counts declared `beats`** (the same self-declared weakness as #1). It is labelled "declared, not measured"; a measured frame-difference pacing check is not implemented.
- **SFX is unmeasured**: nothing checks SFX level against the voice, or placement against word onsets, beyond the pre-ducking voice-to-bed check and your ears.
- `GENRE_AUDIO_MOOD` is now wired: `--audio-mood auto` uses `brief.genre` first, then the first scene's mood.

## C. What was verified in this sandbox

- Tests: all 62 V2 tests still pass (1 skipped: static-runtime path absent here) + 23 new tests in `phase7_align`, `phase7_qa`, `phase7_voices`: 85 total, 84 pass, 1 skipped, including **deliberately broken fixtures** the gates must catch: 6-flashes/s strobe → `flash`; static colour video → `freeze` + `hook`; 3 s silent gap → `dead air`; 540x960 → `spec/draft`; placeholder tone → FIX; weak voice-to-bed → `mix`. A clean 1080x1920 fixture → SHIP.
- Alignment smoke test on synthetic speech-like audio: sentence break landed on the real 1.2 s pause (word end 2.62 s, next start 3.78 s) instead of being averaged across it.
- **Voiceover path end to end** (never exercised by the V2 examples, which have no `audio_file`): synthetic dense Hinglish speech (~16 chars/s) → `audio_timeline --audio` (alignment + re-chunk) → full 1080x1920 render (no lint errors) → master `--preset reel-vocal --bgm auto --sfx-auto --audio-mood auto`: −13.9 LUFS / −3.0 dBTP, voice-to-bed 14.9 LU measured, verdict SHIP. The audio is synthetic tone bursts, not speech, so this proves the plumbing, not intelligibility.
- `voice_audition.mjs` with the network blocked: reports `ok:false` per voice with an error instead of crashing.
- All 5 examples re-rendered at full resolution and mastered; `smoke-horror-hi` (Devanagari) through the previously untested Reel path `--preset reel-vocal --bgm auto --sfx-auto --audio-mood auto`: 1080x1920, −14.9 LUFS / −1.9 dBTP, verdict SHIP. Safe-zone sheets inspected for horror and peet examples; two layout defects found and fixed.
- CLI flags of V2 unchanged; `VideoClock` contract unchanged; new flags are additive.

**Not verified here:** ARM64 PRoot runtime; Node 24; live TTS of any provider (the sandbox proxy returns 403 for `api.kalpalabs.ai`, so the Kalpa call and the VTT path of edge-tts were exercised only through unit tests on synthetic data); Fish/ElevenLabs/Sarvam/Gemini paths; Chromium path; real-phone preview; any human listening/viewing of final audio.

## D. Voice selection

- Request: choose the best voice by reel type with the Kalpa voice `5e0c5704-590f-483b-b291-00a2415cb67e` and key supplied.
- The key was **not** written into the skill package. It was placed only in `~/.config/code-video-studio/tts.env` in this sandbox. The key was pasted in chat, so rotating it is sensible.
- Kalpa could not be reached from this sandbox (proxy 403, host not allowed), so no audio was generated; the Kalpa response shape the code expects (`audio.data_b64`) is V2's assumption and has never been exercised against the live API. Run `voice_audition.mjs` first on your device. No audio was generated and **no voice was auditioned**. Claude also cannot listen to audio, so "best voice per genre" cannot be determined by Claude. What exists: `lib/voices.mjs` maps genre → voice (narration genres → the supplied reader voice; horror/funny/motivational → the two previous defaults) as an explicit *unverified starting point*; `scripts/voice_audition.mjs` renders one genre-appropriate line per candidate voice for you to listen to; picks go in `~/.config/code-video-studio/voices.json` and override everything.
- Only three Kalpa voice IDs are known to the skill. Add more IDs to audition (`--voices id1,id2`).

## E. Files

New: `lib/profiles.mjs`, `lib/encode.mjs`, `lib/align.mjs`, `lib/direction_lint.mjs`, `lib/voices.mjs`, `scripts/qa_video.mjs`, `scripts/voice_audition.mjs`, `references/direction-playbook.md`, `references/pipeline-gates.md`, `templates/brief.schema.json`, `templates/brief.example.json`, `tests/phase7_*.test.mjs`, `examples/*/brief.json`, `AUDIT.md`.
Changed: `SKILL.md` (kept a < 4 KB router as V2's tests require; the long gate text is in `references/pipeline-gates.md`), `scripts/{render_and_lint,master_and_qa,audio_timeline,doctor}.mjs`, `lib/widgets.mjs`, `package.json`, rules/references docs, `tests/{runtime,phase5_widgets}.test.mjs` (safe-zone expectation), `examples/smoke-horror-hi/scene.mjs`.

---

# V4: horror craft, script critique, visual gates

## What was added
- `references/horror-craft.md` (spine: hook, labelled rule, relatable place, violation, visible consequence, turn + loop; banned words; code-visual techniques) and `references/script-critique.md` (idea vs script, 14 questions, bluff test).
- `lib/horror_gate.mjs` + `scripts/script_gate.mjs --mode idea|script`.
  - Mechanical script checks that ignore the critique scores: length from `target_duration_s` x WPM (`SPEECH_WPM` in profiles.mjs), >= 5 scenes, >= 3 SFX cues, hook <= 14 words, specific time, stated rule, folk attribution, domestic setting, cliché/AI-tell list, ending <= 18 words, raw digits in Hindi TTS text. Devanagari is normalised (NFC, nukta stripped) before matching.
  - Critique validator: every answer needs an exact script quote; score <= 2 blocks; `great` needs avg >= 4.2 and min >= 3; uniform or >= 4.9 sheets rejected; a flattering verdict is overruled by failed heuristics.
- Visual gates: `shotlist.json` per scene (subject, 3 layers, light, focal point in safe zone, non-static motion, >= 4 details, withheld, intensity that rises) plus measured per-scene luma, p98, edge density, and last-third/first-third motion on the MP4, with the caption band cropped out (analysed field y = 0.12H..0.65H). Writes `qa_scene_sheet.png`. Integrated in `master_and_qa` for `genre=horror`; failures force FIX. A narrated script with no voice track also forces FIX.
- Flagship `examples/horror-ek-baar` (Hindi, invented "called once" rule, framed as nani's saying, not a sourced tradition).
- `smoke-horror-hi` has `smoke_test: true`: its horror gate fails become warnings.

## V4 calibration (all numbers measured here, one flagship only)
Real scene, per scene: mean luma 16.7-22.5, p98 45.6-69.5, edge 0.0136-0.0328, escalation 1.94-1.98.
Deliberately broken variants of the same scene (draft renders): too bright mean 91-94; empty (no objects) p98 14-17, edge ~0; mud (80% black) p98 10-15, edge <= 0.0016; flat motion (frozen world clock) escalation 0.98.
Thresholds: maxMeanLuma 60 (warn 45), minP98 30, minEdge 0.008, escalation fail < 1.15 (warn < 1.4). All four broken variants fail, the real scene passes. A first edge threshold of 0.012 sat 8% under the real kitchen scene and was moved to mid-gap. The gate also caught two real defects in the first draft of the flagship (underdetailed nani flashback, motion not escalating) which were fixed in the scene, not the thresholds.

## Known gaps (V4)
- Thresholds come from one flagship plus four synthetic breakages. Bright-but-good genres (not horror) must not use these; darker or lighter horror styles may need `qa.json` `horror` overrides or `scene_allow`.
- Heuristics catch thin/cliché/ungrounded/rubber-stamped scripts. They cannot measure fear. Self-critique is the same model grading itself.
- Flagship has NO real voice here (Kalpa returned 403 in the sandbox, no local TTS): timing is a WPM estimate (60.1 s) and the gate correctly reports FIX. Generate TTS, re-run `audio_timeline`, re-render, re-master.
- Sound design (synthetic SFX: fan_hum, heartbeat, door_creak, thud, whisper_gust) is unheard. There is no walking-footsteps SFX; `door_creak` stands in. The scare depends on sound a human has not yet judged.
- Pacing lint counts declared beats (one per scene), so it warns on this reel despite constant motion.
- Foot shadows in the kitchen scene are small on a phone-sized thumbnail; check on a real phone.

---

# V5: story formats, measured horror gates, designed sound, 3D scene kit

## Gaps this update closes (from the v1 post-mortem)
| v1 root cause | V5 fix |
|---|---|
| Cliffhangers with CTAs ("Part 3", "agli reel wahin ki") | `brief.format` + `lib/story_lint.mjs`: standalone bans part/next-reel and CTA before the payoff; serial/interactive allow them only in the last 5 s, after the part's payoff. Errors block `render_and_lint` (draft included). |
| Flat 2D visuals | `lib/scene3d.mjs` (perspective camera, lit/tone-mapped quads, point + cone lights, fog, volumetric cone, dust, fog banks, CA pass, soften pass, sleeper/ghost/silhouette helpers); horror pack in direction-playbook; `shotlist.json` now needs camera move, sound cue, sync word. |
| QA trusted declared `animated_properties` | `lib/horror_measure.mjs` measures per-scene motion (+ camera estimate) on the MP4; horror skips the declaration-based pacing lint. |
| Generic bed, no designed silence | `scripts/horror_sound.mjs` bed from the timeline; `[SILENCE]`/`[SCARE]` tags; measured >= 20 dB pre-scare drop + stinger; linear loudness for horror (dynamic loudnorm was flattening the drop). |
| Rushed voice | horror tempo 0.95, temperature 0.8 (retried without it if the provider rejects it), 0.5 s line gaps, per-line TTS so pauses survive; `[WHISPER]` post-process; captions slowed, never the voice sped up. |
| 35-45 s, 8-10 lines, no payoff | >= 9 lines, >= 3 escalation beats, false relief, a silence beat, twist that explains the hook, 50-75 s standalone / 60-90 s parts. |

## V5 calibration (measured here)
- Motion floor 0.0008: a frozen-camera copy of the flagship with live grain and captions measured median 0.00012, p90 0.00039; the real scene's p10 was 0.0017. The first guess (0.0016) sat inside the real scene's range and was moved to the gap.
- Pre-scare drop on the final masters: 36.7 dB (standalone) and 36.6 dB (interactive), stinger rise 43.7 dB. The v1-style fixture (auto bed + preset SFX) measured 10.7 dB.
- The visual gates caught real defects during the build: blur smearing prop edges (hook/wake "empty"), a too-bright dawn shot, a washed-out hostel (hook mean luma 122), near-empty final shots, and motion that did not escalate (0.46-0.78). All were fixed in the scenes; no threshold was loosened.

## Voice path (stub)
A speech-band stub voice (-18.5 LUFS per line) through per-line synthesis and the documented Gate 4 master: voice-to-bed 12.8 LU, pre-scare drop 39 dB with the horror echo, -14.1 LUFS, all horror gates pass. It also exposed a borderline kitchen shot (edge 0.0073-0.0079 under voice timing), fixed by recomposing the shot.

## Before / after
`node scripts/horror_relint.mjs <dir>:<mp4>`: the reconstructed v1-style fixture (`tests/fixtures/v1-cliffhanger`, built from the post-mortem, NOT one of the user's reel-01..10) fails every group (story, script, shotlist, visual, motion, sound). Both V5 examples pass every group at 1080p; their master verdict is FIX only because no voiceover exists in the sandbox. The user's real reel-01..10 and the "Ginti" pilot were not available here: run the relint script on them.

## Still unmeasured (V5)
- Depth. A moving flat 2D scene would pass the measured gates; shotlist `layers` are declarations. The flat-visual root cause is addressed by the 3D kit, the horror pack rules and the shotlist, not by a measurement.
- Fear. Every gate is structural or physical. A human must read it aloud and watch with sound in a dark room.
- Pronunciation taste: STT per line is documented, not automated here (no local STT in the sandbox).
- Platform behaviour: pinned-comment / Story-poll mechanics, how Reels crops or compresses the dark frames.
- Twist quality: the lint proves a twist exists, is planted, and is flagged as explaining the hook; not that it is good.
- Bible consistency is entity/rule-level matching, not semantic.
- `sound_design.py` / `whisperize.py` were not supplied; both were written fresh (pure synthesis / ffmpeg phase-randomised whisper). The synthetic foley is unheard by a human.
- `--skip-story-lint` exists only to re-render legacy reels for an audit; the master still fails them.


---

# V6: visual self-improvement loop

Measured on the user's reference reels vs ours (24 frames each, 270x480): references sharp-edge detail 0.031-0.075, contrast 27-60; V5 examples 0.011-0.015 and 20-24. Targets (floors) 0.0246 / 21.3, at most 6 dead cells; aims 0.058 / 41.
Demo run (examples/visual-loop-demo/visual_loop/log.json): iteration 1 (typical flat first draft) FIX on every shot; iteration 2 (cartoon kit) caught by eye: captions covering faces and a mis-framed close-up the metrics passed; iteration 3 fixed framing; iteration 4 converged, with one regression flagged by the loop and justified in the critique (light pool reduced background edges on purpose).
Not measured: beauty, style consistency across reels, character model consistency. Human review remains final.
