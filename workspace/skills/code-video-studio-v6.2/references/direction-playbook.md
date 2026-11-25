# Direction Playbook (brief → hook → pacing → sound → ship)

Rules here are decisions with numbers, not folklore. Items marked **[lint]** or **[qa]** are enforced by
`lib/direction_lint.mjs` / `scripts/qa_video.mjs`; everything else is a checklist for the director (you).
Nothing here guarantees a reel performs. It removes the known ways a reel fails before anyone sees it.

## 1. Brief first (60 seconds, `brief.json`, schema: `templates/brief.schema.json`)

Fill all of: **platform, genre, viewer, hook, payoff, cta (optional), loop**. **[lint]** warns when missing.
- **Hook** ≤ 12 words, understandable with sound off, true to the payoff (no bait you do not pay off).
- **Payoff** is one concrete thing the viewer gets: a reveal, an answer, a laugh, a result.
- One CTA at most. A CTA spoken before the payoff costs retention.

## 1b. Shot list (required for horror; `shotlist.json`, checked by `lib/horror_gate.mjs`)

Per scene: `subject`, `layers.{foreground,midground,background}`, `light_source`, `focal_point` [x,y] in the safe zone, `motion`, `camera` (a move, never static), `sound_cue`, `sync_word` (an exact word of the script the shot syncs to), >= 4 `details`, `withheld`, `intensity` 1-5 rising toward the end.

**Horror genre pack (visuals):** flat top-down plans, diagrams and card UIs are banned as the main visual. Every reel needs: a believable place with depth (use `lib/scene3d.mjs`: perspective camera, lit quads, point/cone lights, fog), a moving camera in every shot (handheld that grows), a moving light (flicker, cloud, dying strip), fog or particles, a silhouette or edge-of-frame threat, a reveal by darkness, grain, vignette and a chromatic spike on hits (`chromaticAberration`). Declared `animated_properties` prove nothing: motion, darkness and the pre-scare drop are measured on the MP4 (`lib/horror_measure.mjs`).

**Horror pace (voice):** tempo 0.93-1.0 (default 0.95), provider temperature 0.75-0.85, pauses 0.4-1.2 s between lines; any pause over 1.2 s must carry room tone (the horror bed does). Never speed the voice up to meet caption speed: slow and re-chunk the captions instead (<= 18 CPS). Horror voices are synthesised per line (`audio_timeline.mjs --genre horror`), so pauses and `[SILENCE]` beats survive into the real voice track. Run a speech-to-text pass on every line (e.g. whisper.cpp) and REWRITE mispronounced lines; do not accept them.

## 2. Hook (0–3 s)

- Words on screen **and** in audio by **0.8 s** **[lint]**. Cut lead-in silence (>0.35 s at start warns **[qa]**).
- Something visibly moves in the first **0.5 s** **[qa]** (measured on the MP4, not declared).
- Never open on a logo, title card, black, or a still **[qa: black/freeze]**.
- Open mid-action or on the strangest image; explain after. The first frame is also the thumbnail: check it.

## 3. Pacing and retention

- A visible change (cut, zoom, new element, caption emphasis) at least every **~4 s** **[lint]**.
- Target 15–45 s for most reels; ideal band comes from the platform profile (`lib/profiles.mjs`) **[lint]**. Longer only on purpose (`brief.allow_long`).
- Build the 6-beat arc from `narrative-horror-reels.md` §1 for horror/story; for guide/news use: Hook → Promise → 3 steps/facts → Payoff → Loop.
- End on the payoff or a callback to the hook (`loop: true` needs a scene id containing `callback`/`loop`/`echo`) **[lint]**. Do not fade out on a calm 6 s outro.

## 4. Genre packs (starting points, tune by ear and eye)

| Genre | Pace | Camera/visual | Voice | Bed | SFX |
|---|---|---|---|---|---|
| horror | slow VO, pauses ≤ 1.2 s, dead air < 2 s | dread_creep push-in, vignette, grain, no strobe | low, calm, close; `--genre horror` | `--audio-mood horror` | sparse, one hit per beat, silence before the scare |
| funny | fast, 160+ wpm, no gaps | snap cuts, bold stamps, bounce easing | bright, deadpan on the punchline | light, off-beat, low | comic hit exactly on the punchline word (anticipate 1–3 frames) |
| guide | steady, one step per ~4 s | big numbered steps, highlight the control being used | clear, neutral | very low bed or none | tick/pop on each step |
| news/explainer | medium, plain sentences | one chart/number per beat, source line | neutral, steady | documentary bed low | minimal |
| story | medium, longer pauses between sentences | slow parallax, warm palette | warm | soft bed | foley only where it carries the story |

Voice selection: `--genre <genre>` on `audio_timeline.mjs` picks a voice via `lib/voices.mjs`. The default table is **unverified by ear**: run `scripts/voice_audition.mjs`, listen, and pin your pick in `~/.config/code-video-studio/voices.json`.

## 5. Script (see `narrative-horror-reels.md` §6 for the Anti-AI rules)

- Spoken-friend test: every sentence works out loud to someone with zero context.
- Digits as words inside Devanagari TTS lines **[script check]**.
- Read the VO aloud once before generating audio. Re-generate any line TTS mispronounces (rewrite the word; do not live with it).

## 6. Audio design

**Horror:** master with `--bgm horror` (designed bed from `scripts/horror_sound.mjs`: room tone, place ambience from `brief.sound.ambience`, rising drone, sub swells, heartbeat that speeds up and stops on the drop, foley from cues, a -45 dB pre-scare drop, stingers on `[SCARE]`, a loop tail). Tune its level with `--bgm-gain <dB>` (default -8 for the horror bed). Horror masters use linear loudness (one gain + limiter), because dynamic loudnorm would pull the designed drop back up. The QA requires >= 20 dB of drop in the 0.5 s before each scare and a stinger peak after it.


- Voice leads. Bed ≥ **9 LU** below speech before ducking **[qa: mix]**. Duck 6:1 under voice (already in the mix graph).
- One idea per SFX; never stack three hits on one beat. Place SFX on the visual hit frame, or 1–3 frames **before** it for impact.
- No placeholder tone: a reel with no voice, bed or SFX is **FIX** **[qa]**.
- Dead air > 2 s **[qa]**. Deliberate silence ≤ 1.2 s, then something must resume.
- Target −14 LUFS / −1.5 dBTP for reels/shorts/tiktok (`--preset reel-vocal`). Platforms re-normalise; clean peaks matter more than chasing loudness.

## 7. Captions

- ≤ 2 lines, ≤ 42 chars/line, ≤ 18 CPS **[lint]**; caption lane inside the safe zone (`lib/profiles.mjs`, default `universal`: x 60..900, y 270..1440).
- Word highlight only means something if timings are aligned: check `timeline.alignment.method`.
  `provider-vtt` = trustworthy · `provider-sentence-vtt` / `voiced-span-weighted` = approximate (±~0.15 s) · `wpm-estimate`/`linear-scale` = drift is expected. **[qa warns]**
- Mixed language: keep on-screen text in the same script/language as the VO.

## 8. Safe zones

Source of truth: `lib/profiles.mjs`. `universal` (default) = organic IG/Shorts/TikTok; `ads` = Meta ad placements (bottom 672 px reserved).
Open `out/qa_safezone_sheet.png` after every master: nothing important under the red bands. Platform UI changes; re-check against a real phone preview.

## 9. Ship checklist (human review is always required)

`master_and_qa.mjs` prints `verdict: SHIP|FIX` and writes `out/qa_report.json`. **SHIP means no measured defect was found, not that the reel is good.** Then:
1. Watch once with sound on a phone, once muted.
2. Would a stranger stop in the first 2 s?
3. Listen for mispronunciations, harsh SFX, music over speech, clicks at cuts.
4. Check every number/claim against `brief.sources`.
5. Check cover frame, caption text for typos, and the last second.
