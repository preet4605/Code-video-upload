# Narrative, Character & Horror 9:16 Reels Guide

## 0. Story gates (enforced by `lib/story_lint.mjs`; errors block `render_and_lint`, draft included)

**Write the story before the scene:** `brief.story` JSON -> script lines -> shot list (`shotlist.json`) -> audio -> scene code.
Every `line` field below is an exact quote of a script line; the lint checks order by line index.

`brief.format` = `standalone` (default) | `serial` | `interactive`.

| | standalone | serial | interactive |
|---|---|---|---|
| Length | 50-75 s | 60-90 s per part | 60-90 s per part |
| Story | setup, `rule_or_clue[]` (>= 2, all before the twist), `escalation[]` (>= 3), `false_relief` (before the twist), `twist` (`explains_hook: true` + `how`), `ending_image`, `callback` | same, plus `part_question` and `part_payoff` (this part's question is ANSWERED) | same as serial |
| Structure | >= 9 spoken lines, one `[SILENCE dur=0.8-1.2]`, a `[SCARE name=...]` cue | same | same |
| Ending | image or statement; never a question, never "or was it?" | payoff first, then a NEW question in the last 3-5 s; closing line "Part N coming, follow..." | payoff first, then the fork in the last ~5 s naming A and B and how to vote |
| CTA / "part" | none before the payoff; no "Part N / next reel" at all | only in the last 5 s, after the payoff | only in the last 5 s, after the payoff |
| Extra files | - | `series.{id,part,of,bible_path,recap_line,next_hook}`, `series_bible.md` | `choice.{question,option_a,option_b,vote_channel,deadline_note}`, `branches.md`, `branch_tree.json`, bible |

**Serial** is for stories that honestly need parts, never to dodge an ending. Each part is a complete episode. Parts 2+ open with a `recap_line` (<= 8 s) unless the hook is the recap; never a title card. The bible (`## Characters`, `## Places`, `## Rules`, `## Parts`, `## Canon`, `## Open threads`) must contain every declared character/place, every `type: "rule"` clue, a `Part N` entry, and every `story.new_facts` item in the same commit.

**Interactive:** the fork must be earned (both options carry visibly different dread, written in `branches.md` with Setup/Escalation/Payoff/Dread per branch before posting). Produce the next part only after the vote, from the winner; keep the loser as an optional "what if" reel. **Reels have no poll sticker:** use `vote_channel: "pinned_comment"` (pin "A या B? कमेंट करो") or `"story_poll"` (a Story poll that links to the reel). Record votes and what followed in `branch_tree.json` and the bible.

**Forbidden:** unresolved twists, "or was it?" endings, a threat that appears without a planted reason (`story.threat.planted_by` must precede `first_seen`), a CTA before the payoff, and the same scare pattern as the previous reel (`story.scare_pattern` vs `previous_scare_pattern`).

**Extended arc:** hook -> setup with planted clues -> escalation x3 -> false relief -> silence -> snap -> payoff -> ending image / callback.

## 1. EN & Hindi/Hinglish Beat Curves

Structure 30–180s vertical storytelling and horror-science Reels around a 6-beat tension arc:
1. **Hook (`0–3s`)**: Surprising visual anomaly, question, or uncanny fact. Never start with a static title card.
2. **Uncanny Setup (`3–12s`)**: Establish setting, stakes, and character/subject inside 9:16 safe zones.
3. **Escalation (`12–35s`)**: 2–3 rising beats (gauges climbing, X-ray reveals, narrowing camera).
4. **False Relief (`35–42s`)**: Brief calm or seeming explanation before the turn.
5. **Snap / Reveal (`42–50s`)**: Stamp-slam, lighting shift, or mythic/scientific reveal.
6. **Callback (`50–60s`)**: Final twist or visual echo back to the Hook.

## 2. Audio-First Word Timing & 0–3 Frame Anticipation

- Generate `timeline.json` via `scripts/audio_timeline.mjs` with `[SCENE id=... mood=... ambient=...]`, `[NARRATOR]`, `[CHARACTER]`, `[WHISPER]`, and `[SFX name=...]`.
- **Pre-Word Anticipation**: Trigger visual reactions (eye widening, stamp slam, head turn, lightning flash) **0.03s–0.10s (1–3 frames at 30fps) BEFORE** the target word's `start_s` in `timeline.words`.
- **Word-Highlight Captions**: Pass the active word from `timeline.words` into `drawCaptionBar(..., { highlightWord })` for kinetic word-by-word emphasis.

## 3. 9:16 Safe Zones & Caption Readability

On `1080x1920` (scaled by `s = width / 1080`):
- **Keep faces, characters, badges, and captions inside**: `x: 60..900`, `y: 270..1440` (see `lib/profiles.mjs`; `ads` profile is stricter).
- Right margin (`900..1080`) is reserved for Like/Comment/Share/Remix icons; top (`0..270`) for username/audio chrome; bottom (`1440..1920`) for handle, caption description, and audio ticker.
- Captions must pass Gate 3 lint: `<= 18` CPS (grapheme clusters), `<= 2` lines, `<= 42` chars/line.

## 4. WCAG 2.3.1 Strobe Safety & Procedural Horror FX

- **Strobe Cap**: Never exceed **`<= 3` full-frame luminance flashes per second** (`flashes_per_sec <= 3` in `timeline.json`).
- **Procedural Horror FX (all deterministic from `t`)**:
  - **Seeded Film Grain**: Step `mulberry32(Math.floor(t * 15))` over sparse overlay dots (`alpha <= 0.08`).
  - **Vignette**: Radial gradient from transparent center to `rgba(0,0,0,0.75)` at corners.
  - **Flicker**: Deterministic multi-sine (`0.85 + 0.15 * Math.sin(t * 19) * Math.cos(t * 7)`), never exceeding 3Hz full-frame flashes.
  - **Dutch Angle & Handheld Shake**: Subtle `ctx.rotate(0.03 * Math.sin(t * 0.9))` + low-amplitude positional tremor.

## 5. Suspense-Aware Anti-Slideshow Rules

- Standard scenes require `>= 1` animated property per beat and static holds `<= 20%` of total beats.
- **Suspense Exception**: Slow-dread holds (`hold: true`) are allowed when `"mood": "suspense"` AND `"ambient_motion": true` are set on the scene, provided ambient camera creep, flicker, embers, or breathing rig motion remains active on screen.

## 6. Anti-AI & Human Storytelling Direction (EN & Hindi/Hinglish)

- **The Friend Test**: Every sentence must sound completely normal said out loud to a friend with zero background knowledge. If a viewer has to pause to decode a riddle, rewrite it.
- **BAD (AI Slop) vs GOOD (Human Spoken) Examples**:
  - **BAD HI**: `जबड़ा सलामत, तो हनुमान नाम ही नहीं। मास गया? साल 1। माइनस 73।`
  - **GOOD HI**: `इंद्र का वज्र उनके हनु यानी जबड़े पर लगा, तभी नाम पड़ा हनुमान। पहला, अगर सूरज का वज़न गायब हुआ, तो धरती को कोई नहीं खींचेगा...`
  - **BAD EN**: `No broken jaw, no Hanuman. Mass gone? Year 1. Minus 73.`
  - **GOOD EN**: `Indra's bolt struck his jaw — "hanu" — which is where the name Hanuman comes from. If the Sun's mass disappears, nothing holds Earth in orbit...`
- **Banned AI Script Tells**:
  - Stacking staccato 2–4 word trailer fragments without connectors (`because`, `so`, `क्योंकि`, `तो`, `यानी`).
  - Short rhetorical AI bait questions (`The result?`, `The catch?`, `Mass gone?`, `सूर्य का 1 प्रतिशत तेज?`).
  - Jumping between lore/physics facts without explaining *why* in plain everyday words.
  - Raw digits (`0-9` / `०-९`) inside Devanagari TTS lines, or Fish Audio trap words (`निगल` -> `खा जाते`, `बँटती` -> `दो रास्ते निकलते हैं`, `विज्ञान` -> `साइंस`).
  - Mixing dense English HUD badges with Hindi voiceover & Devanagari captions.
- **Mandatory Audio & MP4 Gate**: Audition raw `voiceover` before video render; never stack `[long-break]` + spliced silence + `silence_drop: true` into >2s dead audio (keep calm ambient bed `0.55x` + subtle low rumble); always watch and listen to the final mastered MP4 directly — a `SHIP` verdict alone does not catch mispronounced TTS or unpleasant SFX.
