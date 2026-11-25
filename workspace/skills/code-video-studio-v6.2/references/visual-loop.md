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
   "scores": { "subject", "depth", "detail", "light", "character", "composition" } (1-5), "regression_note"? } ] }`.
   Judge what metrics cannot: captions covering faces, wrong framing, unreadable expressions, a subject that does
   not dominate, cropped props, style drift.
3. Apply the fixes in `scene.mjs`, run again. The next iteration refuses to run until the critique is valid; a
   repeated fix for a still-failing shot is rejected; a shot whose score drops needs a `regression_note` or a revert.
4. Stop at `LOOP PASS` (metrics pass + no critique score below 3), or `LOOP STOPPED` at 6 iterations: change the
   approach (style, framing, assets), do not keep nudging.
5. `master_and_qa.mjs` reports the loop: not run = warning; run but not converged = FIX.

## Fixes that move the numbers (and the look)
- Detail: outline every shape (`lib/cartoon.mjs` `shape()`), add patterns/texture marks, set dressing, props.
- Dead areas: fill with dressing or reframe (`frame(world point -> screen point, zoom)`).
- Focal: a light pool on the subject, darken the surround, rim light, the subject is the busiest area.
- Contrast: real darks + a bright key, never mid-grey fills.
- Captions: keep faces and key action above y = 0.64 H.
- Static: push/pan, blink/breath, light flicker; three identical keyframes fail.

## Limits
The critique is the same model grading its own frames; the hard metrics and the refusal rules keep it honest,
not perfect. Taste is still human: watch the final MP4 on a phone.
