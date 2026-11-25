# Prompt: upgrade code-video-studio for complete, detailed horror (standalone, serial, interactive)

Paste everything below the line to an agent that has the code-video-studio skill folder.

---

You are updating the `code-video-studio` skill so that any agent using it produces **detailed, complete, frightening horror reels** and supports **three story formats**. Edit the skill files directly, run `npm test`, add tests for every new check, and give me the patched zip plus a changelog. Do not weaken existing gates.

## Why (root causes found in a v1 post-mortem)

1. Scripts were cliffhangers with CTAs ("Part 3", "agli reel wahin ki") because nothing in the skill forces a complete story.
2. Visuals were flat 2D (top-down vectors, glow circles, cards) because nothing requires depth, camera motion or a real environment.
3. QA said SHIP on flat scenes: `build_vo`-style tooling auto-declared `animated_properties` per beat, and the anti-slideshow lint trusts declarations instead of measuring the render.
4. Sound was the generic auto bed plus preset SFX, with no designed silence or timing from the words.
5. Voice was rushed (tempo >= 1.0, caption-speed cap), leaving no room for dread.
6. Stories were rushed into 35 to 45 s with 8 to 10 lines. They had setup and no real payoff.

## Story formats (new `brief.format`)

Add `format` to `templates/brief.schema.json` and to `direction_lint.mjs`: `standalone` | `serial` | `interactive`. Default `standalone`. Every format needs its own gates below.

### A. `standalone` (default)
One reel, one complete story. Hard gates (lint errors):
- No "Part N", no "next reel", no CTA before the payoff.
- Brief must contain `story`: `{ setup, rule_or_clue[], escalation[], twist, ending_image, callback }`. `twist` must explain the hook (fill `explains_hook: true`), and every `rule_or_clue` must be planted in setup/escalation before the twist (lint by line index).
- Minimum structure: >= 9 spoken lines, >= 3 escalation beats, one false-relief beat before the twist, one deliberate silence beat of 0.8 to 1.2 s, ending lands on an image or line, not a question.
- Length: 50 to 75 s. Set `allow_long` for the 60 to 75 s range automatically for horror.

### B. `serial` (parts that need more than one reel)
Allowed when the story honestly needs parts. Do not use it to dodge writing an ending.
- Brief adds `series: { id, part, of, bible_path, recap_line, next_hook }`.
- **Each part must still be a complete, detailed episode:** its own setup, escalation and a payoff that resolves the part's question (a reveal, a death, a rule broken). The cliffhanger is only the last 3 to 5 s and must open a *new* question, not leave this one unanswered.
- The closing line is a short plain "Part 2 coming, follow so you don't miss it" (CTA allowed only in the last 5 s, after the part's payoff).
- A `recap_line` of <= 8 s opens parts 2+ unless the hook itself is the recap. Never open on a title card.
- Maintain `series_bible.md` (characters, rules of the haunting, what each part revealed, open threads, canon facts). Lint: names, places and rules in the script must match the bible; a new fact must be added to the bible in the same commit.
- Length per part: 60 to 90 s (platform max). Same structure minimums as standalone.

### C. `interactive` (audience picks the path)
- Brief adds `choice: { question, option_a, option_b, vote_channel, deadline_note }`. The reel ends on a decision point that the audience can answer in one word (A or B). The decision must be a real fork the story has already earned (the choices have visibly different dread), not a random coin toss.
- Both options must be written in advance in `branches.md`: for each branch, the next part's setup line, escalation beat and a distinct payoff. Branch parts are produced **after** the vote, using the winner, and the loser's branch is kept as an optional later "what if" reel.
- Each part is still complete and detailed (same rules as `serial`); the fork comes after the part's payoff, never instead of it.
- Be honest in the skill docs about platform mechanics: Reels have no poll sticker, so use a pinned comment ("A ya B? comment karo"), or a Story poll that links to the reel. State which one the brief uses in `vote_channel`.
- Maintain `branch_tree.json` (part, choice, option text, vote result, which part followed) and update the series bible.
- Lint: the final caption and spoken closing line must name both options and how to vote.

## Required skill changes

### 1. `references/narrative-horror-reels.md`
- Add the **story gates above** as the first section. Keep the existing 6-beat arc but extend it: hook, setup with planted clues, escalation x3, false relief, silence, snap, payoff, ending image / callback.
- Add a "write the story before the scene" rule: produce `story` JSON in the brief, then script lines, then shot list.
- Forbid: unresolved twists, "or was it?" endings, a ghost appearing without a planted reason, a CTA before the payoff, and the same jump scare pattern in consecutive reels.

### 2. `references/direction-playbook.md`
- Require a **written shot list** (`direction.md` or `shots` in brief): per shot the camera move, light source, depth layers, sound cue and the exact word it syncs to.
- Horror genre pack: ban flat top-down/diagram scenes and card UIs as the main visual. Require at least: a believable place with depth, a moving camera in every shot, a moving light, fog or particles, a silhouette or edge-of-frame threat, a reveal by darkness, grain, vignette and a chromatic spike on hits.
- Horror pace: voice tempo 0.93 to 1.0, pauses 0.4 to 1.2 s, no pause over 1.2 s without room tone. Do not cap tempo up for caption speed; slow captions down instead (keep <= 18 CPS by chunking).

### 3. `lib/direction_lint.mjs` and `scripts/qa_video.mjs` (measure, don't trust)
- **Remove trust in declared `animated_properties` for horror.** Replace with measured per-scene motion from the rendered MP4: mean frame difference and camera-motion estimate per scene. Fail a horror scene whose measured motion is below a floor for more than 2.5 s, unless it is a flagged silence beat.
- Add a **darkness/visibility check**: warn if more than 70% of frames have mean luma < 8 (unreadable on a phone), and fail if a scene is effectively black for > 1.5 s outside a flagged blackout.
- Add a **silence-before-scare check**: for every `scare` cue in the timeline, require a measured level drop of >= 20 dB in the 0.5 s before it, then a stinger peak after it.
- Add the format checks above (standalone completeness, serial bible match, interactive branches file present).
- Add a **line-count and duration gate**: warn if a horror reel has < 9 lines.
- Keep reminding in the report that SHIP does not measure fear.

### 4. Audio
- Add `scripts/horror_sound.mjs` (or port my `sound_design.py` into the skill, pure-synthesis, no samples) that builds the non-voice bed from `timeline.json` word timings and `audio_cues`: room tone, ambience specific to the place, dread drone, sub swells before key beats, a heartbeat curve (speeds up, stops on the drop), footsteps, door/creak foley, breath layers, a true pre-scare drop, stingers, and a last-second loop tail.
- `master_and_qa.mjs`: add `--bgm-gain <dB>` (the fixed -16 dB does not suit a designed bed) and compute the voice-to-bed measurement with the same gain.
- Add a `[WHISPER]` voice option that post-processes a TTS line into a breathy whisper (my `whisperize.py`).
- Voice: horror defaults to a slower tempo and `temperature` 0.75 to 0.85. Note that a speech-to-text pass should be run on every line, and mispronounced lines rewritten (not accepted).

### 5. Visual tooling
- Ship a **3D-ish scene kit** (`lib/scene3d.mjs`): perspective projection with a camera (position, yaw, pitch, roll, handheld noise), quad/box helpers, per-surface lighting from point and cone lights (torch, moon, door light) with tone mapping, distance fog, volumetric cone and dust, screen-space fog banks, and an offscreen chromatic-aberration post pass. Include the helper for close-up illustrations (sleeper from behind, soft-edged ghost face with side shadow).
- Keep everything a pure function of `t` (no `Math.random`, no state across frames) and under the existing runtime/performance rules.
- Add 2 example projects: one standalone, one interactive with a `branches.md`.

### 6. Pipeline/docs
- `SKILL.md`: make Gate 0 "choose format, write `story`, shot list, bible/branches" before any audio or scene code.
- `templates/brief.schema.json`: add `format`, `story`, `series`, `choice`, `shots`.
- `AUDIT.md`: record these as the known gaps this update closes, and list what is still unmeasured (fear, pronunciation taste, platform behaviour).
- Update `scripts/render_and_lint.mjs` so `--draft` fails fast on lint errors.

### 7. Acceptance
- Run `npm test`. All previous tests pass, and new tests cover: standalone completeness, serial bible match, interactive branches, measured-motion fail on a static scene, darkness warn, silence-before-scare fail on a scene with no drop.
- Re-lint the old v1 reels (`reel-01` to `reel-10`) and show they now FAIL on the new gates (cliffhanger, flat motion, no drop), and show the new pilot "Ginti" PASSES. Include both results in the changelog.

Deliver: patched zip, changelog, and the lint/QA outputs for the before-and-after check.
