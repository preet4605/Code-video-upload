# Style: dark POV (reference: "Ginti" pilot, Doomsday | Horror)

Measured on the user's own reel (59.9 s, 1080x1920, 30 fps; 24 sampled frames at 270x480 via `scripts/style_ref.mjs` + `lib/visual_metrics.mjs`, caption band excluded). Template: `templates/visual_targets.horror-dark-pov.json`, selected by `brief.look = "dark-pov"`. Cinema preset: `horror-dark-pov`. HUD widget: `kit.props.hud`.

## Reference numbers

| metric | mean over frames | per-frame range |
|---|---|---|
| mean_luma | 19.0 | 10.2 to 40.3 |
| p5_luma (true black) | 4.0 | 0 to 12 |
| lit_fraction (luma >= 48) | 0.058 | 0 to 0.214 |
| lit_regions | 1 | |
| saturation | 0.198 | 0.09 to 0.41 |
| contrast (luma sd) | 17.0 | 7.3 to 35.0 |
| hue_families | 0.83 (0 to 3, median 0) | one cold base, a warm torch, red on hits |
| sharp_edges | 0.0031 | 0.000 to 0.006 |
| color_bins | 8.3 | |
| focal | 8.2 | |
| subject_scale | 0.17 | 0.06 to 0.34 |
| empty cells (of 15) | 13.0 | |
| cuts (ffmpeg scene, 0.08) | 9 in 59.9 s (0.15/s, mean shot 6.7 s) at 6.63 13.33 21.7 24.87 28.0 34.43 41.9 48.9 51.83; at 0.2 only 1 (cuts are dips to black). Motion is continuous handheld inside each shot. | |
| captions | white, active word red, mid-frame: centre y 1290 (67% of height), above the bottom UI zone | |
| HUD | pill centre (480, 360) = 44% x, 19% y; 302x130 px = 28% x 6.8% of frame; dark pill 72% black, 3 px stroke white 25% (red when wrong), small grey label + 82 px value; turns red + chromatic split on the hit | |
| loudness | -14.1 LUFS integrated, LRA 2.7 LU, true peak +0.5 dBFS (over the -1.5 dBTP target: a flaw, do not copy), mean -16.1 dB | |

The reference is near empty by the detail metrics (sharp_edges 0.003, 13 of 15 cells empty). Its floors (x 0.8) are therefore loose. That is the part to improve, not copy.

## What works (keep)

1. Near-total darkness; the only light is one motivated source (the warden's torch). You see only what the light reveals.
2. POV from the narrator's own bed with the back of his head as a dark foreground silhouette with one thin rim light.
3. Continuous handheld, dips to black at cuts, exposure flicker well under strobe rate.
4. A diegetic HUD counter (`GINTI 16/29/28`) that turns red when it is wrong; it builds dread and carries the plot.
5. Captions mid-frame, one red active word.
6. One hard reveal: a pale featureless face behind him, after a deliberate pre-scare drop.

## Weak in the reference (improve)

Blocky low-poly set silhouettes, set detail barely readable, flat (little depth, no texture), 13 of 15 grid cells empty.

## What was adopted / improved in code

- `cinema` preset `horror-dark-pov`: a light mask (`frameInfo.lights`, ambient floor `#0b0f18`) runs before bloom and grade, so nothing re-lights the dark; blue-black desaturation (0.4), crushed mids, vignette 0.9, grain 0.8, CA 2.2 px. `frameInfo.overlay(ctx)` draws HUD/rim light after the mask and before grain.
- `kit.props.hud`: diegetic pill (label + value), red + seeded chromatic jitter, clamped into the safe zone (x 60..900, y 270..1440), vector arrow for `->` (Noto Sans has no U+2192).
- Improvement over the reference: real drawn set detail (grain, fabric, window slats, tickets) visible only inside the light pools: lit frames reach sharp_edges 0.01 to 0.04, 3 to 12 times the reference.

## Template calibration (rule: floor = reference x 0.8)

`node scripts/style_ref.mjs <ref.mp4> --out templates/visual_targets.horror-dark-pov.json --name horror-dark-pov --margin 0.8 --mood dark`. One reference only: re-run with more dark-POV references before treating it as a genre norm. Known conflicts (also written into the JSON `notes`):

- `focal.min 6.56` and `color_bins.max 12` come from a near-empty reference: more readable detail lowers focal and raises bins. Real reels with readable detail miss them (upper-berth-darkpov: focal 4.2 to 7.9, bins up to 13.7). Do not add detail outside the pools to chase them.
- `mean_luma.max 21.8` is below the reference's own brightest frames (40): sweep peaks and the scare board can exceed it on a keyframe.
- `similarity.backdrop_share_max = 1.0`: the masked-backdrop test cannot work in near-black frames; the reference itself clusters 9 of 9 shots as one backdrop.
- `p5_luma.max 12` is added by hand (reference worst frame), not by the style_ref rule.
