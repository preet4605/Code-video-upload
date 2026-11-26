# QA honesty: verified / unverified, horror enforcement, waivers

## qa_report.json contract (contract_version "1.0")
`contract_version` versions this report shape, separate from the skill version. Existing fields (`verdict`, `fails`, `warns`, `measured`, `human_review`, `horror`, `visual_loop`) are unchanged. Added:
- `verified: [...]` checks actually measured on the MP4, with values (spec, flashes/s, freezes, black, dead air, hook motion, LUFS/true peak, voice-over-bed LU, visual-loop result, horror escalation).
- `unverified: [...]` what no gate measures (hook strength, fear/humour, pronunciation, taste, factual accuracy, real phone playback) plus any check skipped in this run (no timeline, no loudness, no voice+bed pair, placeholder audio, approximate word timing, visual loop not run).
The final CLI summary prints the `unverified` list. Never present SHIP as more than "no measured defect".

## Horror enforcement (brief.genre === "horror")
- Visual loop not run (`visual_loop/log.json` missing or empty) -> FIX with `run scripts/visual_loop.mjs --project <dir>`. Run but not converged -> FIX (all genres).
- Motion escalation (last third / first third) below `escalationWarn` 1.4 -> FAIL (below `escalationMin` 1.15 was already FAIL). Non-horror genres: unchanged.
- `smoke_test: true` briefs downgrade both to warnings.

### Waivers (explicit; tell the user)
In the project `qa.json`:
```json
{ "require_visual_loop": false, "horror": { "escalationWeakIsFail": false } }
```
- `require_visual_loop: false` -> "not run" becomes a warning tagged `[waived ...]`.
- `horror.escalationWeakIsFail: false` -> weak escalation becomes a warning; or lower `horror.escalationWarn` (e.g. 1.2). Other horror thresholds live in `HORROR_VISUAL` (`lib/horror_gate.mjs`); per-scene `scene_allow` and `thresholds` also exist.
A waiver is a decision for the human, not a way to get SHIP.

## Fix-pass cap
At most 3 QA fix passes. After the third, stop, give the human the verdict, the measured numbers and the unverified list.
