# v3: song-driven "Dulhan" reel, beat-by-beat plan (for approval, nothing rendered)

Replaces the stairwell / dadi / wet-figure story completely. No voiceover, no separate plot. The song is the script: every vocal phrase, every 808 hit and the 14.9 s drop trigger a visual event, and the baked MP4 contains the song.

## What I could and could not get from the audio

- **Timings are measured** (signal analysis): vocal phrases, drop, breakdown, hits. Exact lists in `beat_map.json`.
- **The words are NOT reliable.** I cannot listen, and Whisper turns this chopped phonk vocal into garbage. The only phrases it repeated across runs: roughly "...kya doge" (~10-14 s) and "...yaad aa raha hai" (twice at ~28.5-31.3 s, again ~35.2-37.4 s). The title words "saajan saajan teri dulhan" did not show up in any run. The lyric site search returned no lyrics (they are copyrighted), so I have not verified "tujhko pukare" or any other line.
- So lyric captions below are marked **TBD**. If Love pastes the lyric lines sung in this clip (even rough, in Hindi or Roman), I time them to the phrase windows. Until then the visuals follow the measured phrase windows and the song's meaning (a bride calling her beloved).

## Concept (all from the song)
A ghostly dulhan calling her saajan. The viewer is the saajan, first person, walking a dark haveli bridal wing toward her voice. She is never shown face-on: only a red lehenga hem, bangled mehndi hand, veil, her shadow and her reflection. Her voice (the vocal chops) lights the diyas; the 808 is her footsteps; the drop is the door slamming open and her coming for him; the song's hard cut at 54.3 s is the veil lifting.

Set (3D, fog, grain, diya light, marigold petals, mirror, doli, mehndi handprints). Red is the only saturated colour.

## Length
**Full 54.36 s, not the 42 s cut.** The intro is not dead air: the vocal starts at 0.3 s and carries three phrases, so the lyric lines live in 0-14 s. The cold open would remove the lines the video is built on. The audio then also starts at 0:00 in the app, so there is no scrubbing and no sync guess. If Love still wants the short cut, it drops phrases A and B.

## Beat plan (time = song time = video time)

| Time | Song event (measured) | Lyric | Visual |
|---|---|---|---|
| 0.00-0.30 | silence, first hit 0.07 | | Black. A single diya flame ignites on the 0.07 hit. |
| 0.30-5.44 | vocal phrase A (onsets 0.53, 0.86, 1.42, 1.95, 2.30, 3.32, 3.74, 4.81) | TBD (heard garbled) | Slow push through a haveli doorway into the bridal room. **Each vocal onset lights one diya**, so her voice literally lights the corridor. At the phrase end a red dupatta shadow slides across the far wall. |
| 5.44-11.52 | vocal phrase B (onsets 6.34, 6.69, 7.27, 7.80, 8.17, 8.73, 9.08, 9.64) | TBD | Camera creeps down the corridor. **A red mehndi handprint appears on the wall on each onset**, one step ahead of the camera, leading him. Marigold petals drift. A bangle chime under each print. |
| 11.52-14.14 | vocal phrase C ("kya doge" heard), riser | TBD | The prints stop at a closed door. Every diya leans toward the door as the riser builds. Camera push-in on the door; the keyhole glows red. |
| 14.79-14.87 | riser peak, 0.08 s gap | | All flames sucked out. One black beat. |
| **14.87** | **DROP** | | **The door slams open on the hit.** Lights flare. She is at the far end of a long corridor, back turned, in a lehenga and veil. Hard whip: he runs. |
| 14.90-26.66 | 808 on every bar (14.90, 16.37, 17.84, 19.31, 20.78, 22.25, 23.72, 25.19, 26.66) | | Run through the haveli. **Each bar hit = she is one step closer** behind him: camera shake + a diya blows out, her bangle sound on the off-beat. Every cut is on a bar anchor. Chromatic split on each hit. |
| 26.0-31.46 | vocal chop "…yaad aa raha hai" (heard), words at ~28.46, 29.34, 30.0, 30.64 | TBD | He stops at a mirror. **On each word her reflection is closer behind his shoulder** (veil, red hem, hand with bangles), never the face. Bangle chime on 28.46 and 29.34. |
| 31.5-37.4 | drop continues, vocal repeats ~35.18, 35.94 | TBD | He runs again, mirror to mirror down a corridor of mirrors; her reflection is in every one, one frame ahead of him. |
| **36.95-37.40** | last bar before breakdown | | He turns. Hard whip on the 36.95 hit. |
| 37.40-41.90 | breakdown: bass thins, quietest ~39.4-40.4 | | **Silence beat.** Baked version ducks the song and keeps only bangles. She stands inches behind him in the mirror, veil slowly lifting from the chin up across the riser. Face stays hidden: veil lifts to dark. |
| **41.98** | **RE-DROP** | | **The mirror shatters on the hit**, red glass everywhere. She is gone from the reflection and her hand is on his shoulder in frame. |
| 41.98-50.2 | 808, bars 43.21, 44.68, 46.15, 47.62, 49.09 | | Last run for the door; each hit a step, a door slam, a diya dying; she keeps pace, her shadow overtaking him on the walls. |
| 50.19-50.74 | roll | | His hand on the door latch rattling, bangles rattling in sync. |
| 52.03 | bar | | Door opens on the hit into white-out light? No: into the bridal room again, the doli, the first diya (loop). |
| 53.50-54.30 | last hit, **hard cut at 54.30** | | She is directly in front of him, veil in frame. On the final hit the veil is lifted by her hand; **cut to black on the exact last sample** (the song cuts too). |

## Sync method (so it is actually on the song)
- All visual events come from `beat_map.json` (84 sub-bass hits, 199 onsets, bar anchors, phrase windows), not hand timing. Frame-locked at 30 fps (hit lands within 1 frame, 33 ms).
- Cuts and camera moves only on bar anchors; flame, handprint and reflection events on vocal onsets.
- Verification before I show it: I extract the audio envelope of the finished MP4 and the visual-event times and print the per-event offset, so mis-sync is measured, not guessed.

## Audio deliverables
- `reel_baked.mp4`: the song (full 54.36 s) plus quiet bangles/footsteps/glass, drop un-ducked, 0.6 s duck before the 37.4 s breakdown. This is the file to judge sync on.
- `reel_inapp.mp4`: same picture with only the SFX, for adding the song in Instagram at start 0:00 (kept for trend attribution). It will sound "off" if played by itself, because the song is not in it.

## Needed from Love (one thing)
The actual lyric lines sung in this clip, so captions are correct. If not available, I ship with no lyric captions (visuals only), and add them later.
