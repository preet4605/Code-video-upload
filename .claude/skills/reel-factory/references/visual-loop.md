# Visual self-improvement loop (required before the final render)

Goal: every shot at least as detailed and readable as the plainest of the reference reels the targets were
calibrated on (`templates/visual_targets.json`, from `scripts/style_ref.mjs`), and judged good by eye.
SHIP never means "beautiful"; it means the measured floor is met and the critique found no weak shot.

## Calibrate (once per look)
`node scripts/style_ref.mjs ref1.mp4 ref2.mp4 ... --out <project>/visual_targets.json --name <look>`
Use 2-5 reels whose look you want (code-made reels if the reel will be code-made). Floors = weakest reference x 0.8;
aims = median reference. Default targets ship calibrated on four code-made reels. Never lower targets to pass.

## Loop
1. `node scripts/visual_loop.mjs --project <dir>` renders 3 keyframes per shot (20/50/85%), measures detail
   (sharp edges), contrast, saturation, palette, outline ink, focal dominance, dead grid cells and keyframe change,
   and writes `visual_loop/iter_NN/sheet.png` + `report.json` with deficits and concrete hints.
2. **Look at the sheet** (Read the PNG). Write `visual_loop/iter_NN/critique.json`:
   `{ "shots": [ { "id", "seen": "what is actually in the frame", "problems": [], "fix": "the concrete change",
   "scores": { "subject", "depth", "detail", "light", "character", "composition" } (1-5 or "n/a"), "regression_note"? } ] }`.
   Use `"n/a"` (or `null`) only for a criterion that truly does not apply to the shot (e.g. `character` on black silence,
   a station board or a ticket insert). n/a is excluded from the "no score below 3" rule and from averages, a shot must
   still have at least 3 scored criteria, and every n/a is recorded in `log.json` (`critique_na`) and listed under
   `unverified` in `qa_report.json`. It is not a way to dodge a low score.
   Judge what metrics cannot: captions covering faces, wrong framing, unreadable expressions, a subject that does
   not dominate, cropped props, style drift.
3. Apply the fixes in `scene.mjs`, run again. The next iteration refuses to run until the critique is valid; a
   repeated fix for a still-failing shot is rejected; a shot whose score drops needs a `regression_note` or a revert.
4. Stop at `LOOP PASS` (metrics pass + no critique score below 3), or `LOOP STOPPED` at 6 iterations: change the
   approach (style, framing, assets), do not keep nudging.
5. `master_and_qa.mjs` reports the loop: not run = warning; run but not converged = FIX, unless qa.json `accept_unconverged_loop` carries a reason (WARN + recorded waiver, see qa-honesty.md).

## Fixes that move the numbers (and the look)
- Detail: outline every shape (`lib/cartoon.mjs` `shape()`), add patterns/texture marks, set dressing, props.
- Dead areas: fill with dressing or reframe (`frame(world point -> screen point, zoom)`).
- Focal: a light pool on the subject, darken the surround, rim light, the subject is the busiest area.
- Contrast: real darks + a bright key, never mid-grey fills.
- Captions: keep faces and key action above y = 0.64 H.
- Static: push/pan, blink/breath, light flicker; three identical keyframes fail.

## Look-aware targets
`visual_loop.mjs` picks the template from `brief.json`: `genre: horror` + `look: day|daylight|noon|bright|sunny|midday`
-> `visual_targets.horror-day.json` (no mean_luma ceiling; needs true blacks `p5_luma <= 80`, contrast >= 32,
saturation >= 0.19, subject >= 22% height); any other horror look (`night`, `interior`, unset) ->
`visual_targets.horror.json`; everything else -> `visual_targets.json`. `--targets` or a project
`visual_targets.json` overrides. A daylight horror reel MUST set `"look": "day"` in its brief, otherwise it is judged as night horror.

## Metrics added in phase 11 (all computed outside the caption band 0.64-0.82 H, also the 1px edge row bordering it and key_change)
- `lit_fraction`: share of pixels with luma >= 48. `lit_regions`: 4-connected lit blobs (>= 2 cells) on a 9x16 grid,
  a cell is lit at >= 20% lit pixels. Floors (night horror): >= 0.02 and >= 1. Hint: add a motivated light pool.
  Catches only truly black frames; a dim glow rectangle still passes (see table), that is what the similarity check is for.
- `p5_luma`: 5th percentile luma (daylight horror must keep real blacks: `max`).
- `subject_scale`: height of the heaviest salient blob / frame height. Saliency on a 54x96 average-pool =
  0.4 local contrast (cell vs 5x5 mean) + 0.3 edge magnitude + 0.3 colour distance from the row's background (median of
  the 4 leftmost + 4 rightmost cells), thresholded at 0.4, blobs merged across 1 cell. Floor 0.22 (horror templates);
  per shot override `subject_scale_min` or tag `establishing: true` / `tags:["establishing"]` in timeline.json scenes.
  Not in `visual_targets.json` (cartoon/bright reference set not calibrated for it).
  Limits: textured architecture (tall stripes, a tree) counts as salient; a crowd of tiny figures merged with a tree reads
  as 0.2-0.3. It reliably flags frames whose largest salient thing is small (< 0.15), not every wide shot.
- Shot fingerprints per keyframe (20/50/85%): dHash 9x8 on grayscale (bit = left brighter by > 2), 4x4x4 colour
  histogram, 9x8 per-cell mean colour. Shot distance = mean over same-index keyframes.
  `near_duplicate`: ADJACENT shots with hash similarity >= 0.88 and histogram distance <= 0.2 (whole frame, caption band masked).
  `reused_backdrop`: same, but with the caption band, the central 40% and the subject box masked; backdrop match =
  hash sim >= 0.85, cell colour diff <= 0.05, >= 20 comparable bits; union-find clusters; flagged when the biggest
  cluster is > 40% of shots (reels of >= 4 shots). Deficits land on the duplicate / later cluster members; the sheet footer lists the
  3 most similar pairs. Thresholds can be overridden in the targets file (`similarity`).

## Calibration (Zero Shadow Day, reel-01/02/06, Hanuman; keyframe means per shot; spike REPORT.md as the human judgement)
| reel / shot (REPORT verdict) | lit_fraction | p5 | subject_scale | note |
|---|---|---|---|---|
| ZSD s2_dadi (strong) | 0.485 | 20 | 0.50 | passes all new floors |
| ZSD s6_raju / s7_whisper (readable close-ups) | 1.0 / 0.86 | 55 / 40 | 0.35 / 0.33 | pass day template p5 |
| ZSD s1,s3,s5,s8,s9,s10,s11 courtyard wide (weak) | 1.0 | 144-171 | 0.23-0.51 | p5 fails (no true blacks); scale does NOT catch them (group+tree merge) |
| ZSD s4_minute | 1.0 | 171 | 0.198 | scale fails |
| reel-01 hook/recap/bed/twist/cta (dark rectangles) | 0.14/0.12/0.04/0.09/0.07 | 3-4 | 0.09/0.15/0.05/0.05/0.10 | lit floor passes; scale fails; bed,twist,cta,recap one backdrop cluster (4/7) |
| reel-01 stairs / roof (strong) | 0.03 / 0.05 | 2 / 6 | 0.10 / 0.11 | scale fails (false positive: small lit subject by design) |
| reel-02 village/cast_out/trail (weak) | 0.35/0.32/0.36 | 8-9 | 0.07/0.10/0.10 | scale fails; one backdrop 3/7; cast_out/trail near-duplicate |
| reel-02 hook / warning (strong) | 0.98 / 0.65 | 54 / 20 | 0.43 / 0.28 | pass |
| reel-06 all shots | 0.03-0.07 | 1-1.7 | 0.11-0.22 | 6/7 scale fail; backdrop 7/7; mirror/twist near-duplicate (0.889) |
| Hanuman (default template, not scored) | 0.05-1.0 | 16-174 | 0.14-0.45 | 8 shots share one sky backdrop (0.286, not flagged) |
Floors were chosen at the gap between the REPORT's strong and weak shots, not to make reels pass; the known misses are listed above.

## Limits
The critique is the same model grading its own frames; the hard metrics and the refusal rules keep it honest,
not perfect. Taste is still human: watch the final MP4 on a phone.
