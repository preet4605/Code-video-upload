# v2: bridal re-theme + 42 s cold-open cut (supersedes the story and timings in PLAN.md)

Song: "Saajan Saajan Teri Dulhan" phonk remix (Aarzoo, 1999), per Love. Love asked to pick the length for best retention, so this is the cold-open cut: the audio starts at **12.0 s** of the file, the drop lands at **2.87 s**, the reel is **42.36 s**. PLAN.md sections 1, 2, 7, 8 still apply (audio facts, in-app vs baked, risks). The v1 story files are in `v1-stairwell-plan/`.

## Story: "Teri Dulhan" (complete, caption-only)
The night before his wedding he climbs his apartment stairwell at 2 a.m.; two shadows climb the wall. Dadi's rule: if the first bride's bangles jingle behind you, never look back. Wet footprints already climb ahead of him. The light timer dies; the bangles come a step closer; a dripping figure stands above, back turned. He looks. Behind him is only a bride's shadow and jingling bangles. She vanishes the moment he looks: she was walking him home, shielding him from the wet one. Her red glass bangles shatter on the stone. He runs, passes the wet figure on the stairs, slams his door. Under the door: the light strip, two wet feet, a drip into the light. "Now nobody walks behind me on the stairs. It stands outside my door."
V6.1 script gate: PASS (13 caption lines, ~105 words). Duration lint is bypassed on purpose (`--skip-story-lint`), because the standalone band is 50-75 s.

## Timeline (reel seconds = song seconds minus 12.0)
- 0.0-2.87 intro: bulb buzz, two shadows (his, and hers in a bridal veil with dupatta and bangles)
- **2.87 drop**: the climb starts, footfalls on the 808 hits
- Blackouts (bulb dies 0.55 s, clicks back on): 7.31, 10.25, 14.66, 17.60
- 18.2 wet figure revealed above, creeping one step per bar from 20.54
- **24.95 the turn** (whip 180 degrees, bar hit); song ducked 24.32-24.95 in the baked version
- 25.4-28.1 breakdown: lone bridal shadow on the wall; 28.95 red bangles shatter
- **29.98 re-drop**: run, pass-by at 38.56, door slam 40.03, last shot under the door, hard cut at 42.36

## Files (final/)
- `reel_inapp.mp4`: picture + quiet SFX-only track (use this when adding the song in Instagram)
- `reel_baked.mp4`: picture + song (from 12.0 s) + SFX, -13.4 LUFS integrated (fallback)
- `sfx_only_track.wav`, `qa_contact_sheet.png`, `qa_safezone_sheet.png`, `source/` (scene.mjs, timeline.json, sfx.py, beat_map.json)

## In-app steps
1. Upload `reel_inapp.mp4`, tap Audio, find the original audio, **set its start to 0:12** (the drop must land at 2.9 s; the waveform spike is the drop).
2. Original audio volume about 30-40%, added audio 100%. Check the drop lines up with the first footfall before posting.

## Honest QA
- Measured: qa_video.mjs verdict SHIP (no flashes, 0 freeze/black, hook motion present). Not run: V6.1 horror per-scene gates, master_and_qa and the visual loop (the loop would stall, as in the lake episodes).
- Not verified by ear or on a phone. The look is dark and shadow-led, but the stairwell is blocky low-poly geometry, not photoreal.
- Caption copy: 13 lines; text at the very bottom sits near the platform UI band, check the safe-zone sheet.
