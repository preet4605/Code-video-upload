# Plan v3: code-video-studio → one-command reel generator

Status: plan only, nothing built. 2026-11-26. v2 = advisor/self attack (section 0). v3 = five research agents on public repos and docs (section 5). Research was read from public pages; nothing was run except ffmpeg filter syntax and pip availability.

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

## 5. Research merge (v3): what we adopt, from where, under what licence

Rule: copy code only from MIT/Apache/BSD. AGPL (OpenMontage) and Remotion's source-available licence: **ideas only, write our own**.

| # | Adopt | Source (licence) | Closes | Phase |
|---|---|---|---|---|
| 1 | `run.json` per project: stage, input hash, outputs, status; skip when hash+outputs match; script/plan carry `approved:{sha256}` and the renderer exits non-zero if the script changed after approval | OpenMontage idea (AGPL, idea only), MPT (MIT) | unresumable runs, forgeable checkpoints | P2 |
| 2 | Atomic outputs: write `.tmp`, ffprobe duration > 0 and decodable, then rename. Reject zero-length audio | MoneyPrinterTurbo (MIT) | half-written files, "durationInFrames must be positive" | P1 |
| 3 | Named time-events from per-line TTS durations (`line3_start`/`line3_end`); scenes use `at()`/`dur()` not raw seconds | Motion Canvas pattern (MIT) | re-TTS breaks hand timing | P1/P2 |
| 4 | Every QA gate returns `{verified:[], unverified:[]}`; final message lists unverified items; `contract_version` separate from skill version | kajisho5/ffmpeg-skill (MIT) | overclaiming SHIP | P0 |
| 5 | Capped fix loop: max 3 QA passes, then hand to the human with measured numbers; `SKILL.md` = ≤12 hard rules, rest in `references/` with "read X when Y" | browser-use/video-use (MIT), Anthropic skill-creator | endless loops, bloated SKILL.md (our 2 failing tests) | P0/P2 |
| 6 | `plan_lint` before render (repeated scenes, static seconds per scene, text-only scenes) + 4 sampled frames after render for blankness | OpenMontage idea | slideshow / flat scenes | P4 |
| 7 | Content-hash render cache per segment: hash(scene source + cfg + timeline slice + ffmpeg version) | Manim (MIT) | slow re-renders | P2 |
| 8 | Frame-pure scenes (`scene(ctx, frame, t, cfg)`, seeded PRNG per frame) then chunked parallel render, concat, mux audio once | Remotion idea (restricted, idea only), Revideo (MIT) | slow render | **later**, only if render time is a measured problem |
| 9 | Caption presets (JSON: words/page, lines, active colour, emphasis, stroke, shadow, caps, punctuation, supersized keywords), width-aware wrap, glyph centering | Captions.ai / Submagic docs, MPT (MIT) | basic captions | P4 |
| 10 | Hook lint on first 2-3 s (text present, payoff, spoken start) named "hook lint", not "retention" | OpusClip axes (marketing), Meta/Instagram 3 s + 2 s skip signals (primary) | hook strength | P4 |
| 11 | Preflight: ffmpeg, fonts, `KALPA_API_KEY`, Node version; never retry a POST after transport error (double billing) | ShortGPT/SVM issue families | install-failure class | P0/P1 |
| 12 | Two-pass loudnorm on the final mix (`I=-16:TP=-1.5:LRA=11`, then linear pass with measured values; check pass 2 says Linear) | ffmpeg strings run in sandbox, levels measured only | loudness | P4, only if a reel misses -14..-16 |

### Word timing (the open technical risk)
- Plan: forced-align the **known script text** per Kalpa line with `Harveenchadha/vakyansh-wav2vec2-hindi-him-4200` (MIT, 378 MB, 20 ms frames), CPU torch. No ASR transcript needed. Hinglish Latin words: transliterate to Devanagari for alignment only, keep display tokens.
- Verified: pip wheels download, HuggingFace reachable (ranged download returned 206), `forced_align` exists in torchaudio 2.11.1. **Not verified: the alignment itself was never run, Hindi accuracy unmeasured.** torchaudio's `forced_align` was announced as deprecated; fallback is a ~30-line numpy Viterbi.
- Gate before adopting: align 5 real Kalpa lines, compare word boundaries against the waveform energy dips and the user's ear. If it fails, keep the current estimate and use akshara-weighted allocation inside voiced spans.
- Reject: stable-ts / faster-whisper word timestamps (cross-attention, no better than now), WhisperX (too heavy), AI4Bharat IndicWav2Vec (gated), MMS_FA (CC-BY-NC, 1.26 GB).
- Mispronunciation check: greedy-decode the same emissions, per-word CER vs script. Experimental; it flags, a human judges.

### Explicitly not adopting
Remotion code or Chromium capture; OpenMontage code / 100-tool sprawl / LLM-only orchestration; Diffusion Studio (unclear licence); wholesale Motion Canvas or Revideo; editly WebGL layer and random transitions; MoviePy; stock-footage-first look (opt-in layer later at most, licence risk); auto-upload; in-memory queues; any "60% retention", fixed cut-interval or "85% watch muted" folklore; paid skill bundles (the listings showed no checkpoint or QA tooling, contents not viewable).

### Honest limits of this research
Public pages only; a fetch tool summarised many pages; star counts conflict across sites; Remotion determinism, Revideo worker split, Motion Canvas event storage unverified; no paid skill's contents seen. Safe-zone bottom margin has no official spec: verify in-app. Real retention can only be measured on the user's own account View Rate.

### Revised order
P0 (package copy, tests, gates, verified/unverified, preflight, 3-pass cap) → P1 (voice, atomic, events, **alignment test on 5 lines**) → P2 (`run.json`, hashes, runner, workflow) → **P3 spike** → P4 (plan_lint, hook lint, caption presets) → P5 acceptance. Parallel render (row 8) stays parked.
