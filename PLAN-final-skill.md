# Plan v2: code-video-studio → one-command reel generator

Status: plan only, nothing built. 2026-11-25. v1 was attacked by the advisor and by me; changes are in section 0.

## 0. What the fight changed

| v1 claim | Found | Change |
|---|---|---|
| P1 "build per-line Kalpa TTS" | Already exists: `zero-shadow-day/final/source/tools/build_vo.mjs` (145 lines): one Kalpa call per line, cache, 4 retries, per-line window alignment, SFX per line. Used on shipped reels. | P1 becomes **promote + harden**: move into package, add `model`, put model in cache key, tests. |
| P2 "reel.mjs runs brief → script" | A Node script cannot write a script. `make.sh` (13 lines) already runs render+master+verdict but hardcodes `/mnt/attach/...`. | Split: **SKILL.md workflow** (Claude drives, 2 checkpoints) + **deterministic runner** (promoted `make.sh`, path-independent). |
| P3 "mine 21 reels for kits" | 26 scene files, ~18 distinct reels. `kit.mjs` (255 lines) is byte-identical in v2 pilot and v3: it is a 2D prop kit (door, bed, glow, grain, camera), not a depth kit, and has not evolved. | P3 starts with a **spike**, not a build. See P3. |
| Install at `.claude/skills/code-video-studio/` | Collides with `anthropic-skills:code-video-studio`. | Name it `reel-factory`. |
| Regression by frame hash | Canvas output can differ across machines. | Compare duration + measured QA fields + `ssim >= 0.97` vs committed mp4. |
| P4 = wish list from AUDIT | Not tied to an observed failure. | Cut to the 3 items with evidence (below). |
| (missing) | Shipped `qa_report.json`: **SHIP** with `visual-loop: not run` and `escalation 1.26 < 1.4` as warnings. "Flat 2D" was a named root cause. Gates exist, are not enforced. | New P0 item: enforce for horror. |

Still true from v1: package lives only on branch `claude/project-thread-n78b4s`; `doctor` passes; tests 124 pass / 2 fail (both: `SKILL.md` 6,110 B > 5,500 limit); no ASR installed; Kalpa gives no word timestamps (word timing inside a line is approximate, ~±0.15 s).

## 1. What "simple command" honestly means

`/reel-factory "idea" --genre horror --lang hi` = Claude writes brief, script, scene code (creative, not code), the runner does everything else. It stops twice for the user: **script approved**, **visual loop passed**. `--auto` skips stops and labels output UNREVIEWED.
Not promised: fear, humour, taste, pronunciation. Visuals are code-drawn, never "filmed". Done = user watched on a phone with sound and would post it.

## 2. Phases

**P0 · One source of truth + enforce what exists** (small)
- Copy package into `.claude/skills/reel-factory/`. Exclude the `.zip` and `visual_loop` PNG sheets (package is 11 MB; build zip on demand).
- Fix the 2 tests: move V6.2 song-mode text into `references/`, `SKILL.md` < 5,500 B.
- Horror: skipped `visual_loop` → **FIX**; escalation < 1.4 → **FAIL** (currently warn). Add a broken fixture that must fail each.
- Regression: rebuild `zero-shadow-day/final`; pass if duration matches, QA fields match, `ssim >= 0.97`.

**P1 · Voice: promote `build_vo.mjs`** (small–medium)
- Move into package. Add `model: kalpa-tts-1`; include model + sample_rate in cache key; map API errors (402 never retry, 429 honor Retry-After).
- Replace the "unverified" voice table with the live catalog (horror hi = Aman, user's choice).
- Per-line vs single call: **do not decide by measurement.** Send the user a 4-line A/B (same text, same voice) and let the ear pick. Existing reels used per-line and the reported complaint was echo, not splicing.

**P2 · Runner + SKILL workflow** (medium)
- Runner: promoted `make.sh`, uses the package path, runs gate → VO → render → master → QA → contact sheet; resumable via `state.json`.
- Workflow in `SKILL.md` (kept short, details in `references/`): brief → script → `script_gate` → **checkpoint 1** → runner VO → scene code → `visual_loop` → **checkpoint 2** → render/QA → caption via installed `ig-caption` + `ig-human`.

**P3 · Visual quality: spike first** (the real risk)
- Spike (≤ 1 session): take one shipped scene (`zero-shadow-day/final` and one `horror-reels/reel-0x`), run `visual_loop`, record metrics vs `visual_targets.horror.json`. Output: a table of which targets fail and why.
- Decide from the table: extend `kit.mjs` with depth (layered parallax, rim light, volumetric beam) only where metrics fail. If metrics already pass, P3 shrinks to documentation.
- Guard against samey output: each reel must vary palette, camera move and one signature element.

**P4 · QA gaps with evidence only**
1. Pacing measured from frame differences (the declared-`beats` check is self-reported; AUDIT lists it).
2. Text-under-safe-zone auto-detect (today a human reads the sheet).
3. Anything the P5 reels actually fail on. Two-pass loudnorm, SFX-onset checks: not unless a reel fails on them.

**P5 · Acceptance**
3 reels, one command each: horror Hindi (Aman), funny Hinglish, guide English. User watches with sound. Anything short of "would post" → gap goes back into P1–P4. ~1 min Kalpa audio per reel vs a 1,000 min allowance.

## 3. Order
P0 → P1 → P2 gives the working command with the proven voice and enforced gates. P3 spike next, before any visual build. P4 interleaves.

## 4. Decisions needed
1. Go on P0–P2? 2. Commit the package (11 MB minus zip/sheets) to this branch as `reel-factory`? 3. Which 3 acceptance reels? 4. Send the 4-line voice A/B first?
