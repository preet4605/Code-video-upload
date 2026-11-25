# Song-reel mode (V6.2): code-drawn cinematic reel locked to a supplied song

The song is the script. Nothing here uses a voiceover. Scripts: `scripts/song_reel/` (`beat_map.py`, `sync_report.py`, `audio_continuity.py`, `cycle_check.mjs`). Reference build: `examples/song-reel-saajan/` (scene.mjs, sfx.py, build_timeline.mjs, stitch.sh, beat_map.json). All of it is Canvas 2D on a perspective drawing: say "graphic-cinematic", never "filmed".

## 0. Standing rules (Love; do not re-ask)
- **Code-drawn only.** Silhouettes, perspective tracks, fog, glow, grain, bloom, grade, aberration, scratches, letterbox. No photoreal/AI images, no stock footage. Flat vector and blocky low-poly looks were rejected: use layered parallax, rim light, backlight, volumetric beams.
- Every cut, reveal, camera move and scare lands on **measured** song events. A story separate from the song was rejected ("not even on the song").
- Complete self-contained story, no "Part 2" bait. Original characters; never copy a creator's video or a licensed character.
- No lyric captions unless lyrics are verified and timed; never reproduce lyrics. Whisper cannot read chopped phonk vocals: say so and ask Love for the lines.

## 1. Measure the song first
`python3 scripts/song_reel/beat_map.py song.mp3 beat_map.json` writes duration, tempo, real bass-hit times, onsets, vocal windows, first bass hit, a 0.5 s bass/mid/hat dB table and LUFS. It is a **starter**: validated once, it finds 69/84 hand-checked hits within 50 ms and put the drop 40 ms early, so refine the drop and missed hits from the band table.
- **Cut on real hits, not a bar grid.** The grid drifted up to 120 ms (36.95 vs real 36.83/37.37; 19.31 vs 19.26). Snap every cut to the nearest real hit and print the offsets.
- Read the band table around every section change. A "breakdown" is rarely silent (reference: ~4.5 dB quieter, melody continuing). Design to what the song does.
- The picture needs something for every section: intro onsets, riser, drop, chase hits, breakdown notes, pre-drop swell, re-drop, roll, final hit, hard cut.

## 2. Plan, send, wait
Send a beat table (time, song event, visual) plus honest limits (not heard, code-drawn, lyrics unverified). Build after approval. Ride a trend's skeleton but invert or originalise it.

## 3. Structure rules
1. **Intro lives inside the song.** Title/hook lands on the vocal onsets: words light up per onset, a rule draws on the next, credit on a later one, dissolve on the phrase's last onset. No pre-roll (it shifts all sync and breaks the in-app version where the song starts at 0:00). A light streak opens on the first hit.
2. **Outro comes after the song.** Keep the hard cut to black on the last sample, hold ~0.4 s black, then a 2-3 s end card (eyes/tagline/handle, drone, one chime, one drip), fade out. Pad the song with silence to the new length. Never cover the song's last hit.
3. **Never duck or mute the song** unless asked. A -13 dB "silence beat" at 37 s was heard as "the song cuts in the middle".
4. **Re-sync after any audio change**: re-check every cut against the real hits.
5. **SFX sit on the song's grid.** Bells, clacks, light flashes and whooshes come from onsets/hits, never a fixed clock (4 Hz lights and 0.42 s clacks clashed). Loop-style SFX (drone, rumble, whir) stay low.
6. **Hero moment**: black for 1-2 frames before the drop, first bright frame within 1 frame of the drop (end the black 10 ms early so a frame time >= drop). Reveal in slow motion (audio never slowed).
7. Text and subjects stay in the safe zone (x 60-900, y 270-1440 at 1080x1920); subject near y = 960 so bars never hide it. Title words need measured widths and spacing (two words at 190 px ran together).
8. The end card must show something from its first frame: the probe flags a fade-in from pure black as a blank frame.

## 4. Rig correctness (Love caught both by eye)
- **Facing +x: pedals turn clockwise in y-up space** (crank angle = -ph); spokes the same (`wheelAng = -scroll/r`); backgrounds scroll opposite to travel.
- **Knees point forward toward the bars, never behind the hip-pedal line**: two-bone IK `dir=+1` for legs of a rider facing +x, `dir=-1` for elbows. Flip both facing -x.
- Dark silhouettes hide limbs: thin rim stroke under legs/arms plus a soft backlight glow behind the rider.
- Run `node scripts/song_reel/cycle_check.mjs <scene.mjs>` (exports `cyclistSide`) and LOOK at the 8-angle sheet before the first full render. After the render, extract close-ups at several crank angles in every cycling shot and send one to Love. Apply the same to any limb or wheel rig. State directions from geometry, not memory.

## 5. Camera by song section
| Section | Move | Reference parameters |
|---|---|---|
| Intro / vocal phrases | Near-static, light handheld breathing; lights switch on per vocal onset | roll `sin(0.5t)*0.004` rad; no hit shake before ~2.8 s; light streak on the first hit |
| Riser | Slow push toward the vanishing point; lights die at the peak, then 1-2 black frames | camera forward 3 m and focal 980 -> 1080 over 11.52-14.79; black 14.79-14.86 |
| **Drop** | Hard cut to a backlit hero + slow-motion ramp while the camera pushes in | picture time `drop + 1.5*u^1.9`; focal 1000 -> 1120 over 1.5 s; dutch -0.05 rad |
| Chase (808 bars) | Cuts on real hits; dolly/parallax; shake and zoom punch per bass hit; alternate front-chase / side-track / mirror | shake 3 px (6 px mirror/gate) x hit pulse (decay 11/s), x `sin(91t)` y `cos(77t)`; zoom `1 + 0.04*pulse`; side scroll 230 / 900 / 1000 px/s; dutch 0.025-0.07 |
| Sung words | Static frame; the subject steps closer per word, plus a glint | mirror: 4 steps, 11 -> 2.7 m, `eo` ease |
| Last bar before breakdown | Whip: shot change on the real hit, subject huge, dutch settles | dutch 0.12 -> 0 over 36.83-37.37; chroma +10 px; distance 7 -> 3.2 m |
| Breakdown | Locked-off wide, bars open; rhythm from things passing frame (wagon gaps on onsets); then pre-drop swell | bars 1100 px; scale `1 + 0.07*sm(41.2, 41.98, t)` |
| Re-drop | Same slow-mo ramp, shorter; bars snap back | `41.98 + 0.92*u^1.6` |
| Roll / final hit | Handheld rattle, then lock on the reveal; hard cut to black on the last sample | shake 6 px |
One dominant move per section; moves start on a hit or onset; slow-mo at most twice.

## 6. Film look (post chain order)
1. **Whip blur** first 0.12 s of each shot: 6 ghosts at `i*30*k` px (k = 1 - d/0.12), alpha `0.5*k`.
2. **Bloom**: quarter-res, `brightness(0.9) contrast(2.4) blur(7px)`, additive `0.55 + 0.4*hitPulse`.
3. **Grade**: `soft-light` rgba(25,95,105,0.28), then `multiply` rgb(214,226,232). Warm practicals (255,150-190,60-110); one saturated red as the only strong colour for horror.
4. **Chromatic aberration** `1.2 + 6*hitPulse` px (R +x, B -x and +0.3 y), +10 px during a whip.
5. **Vignette** 0.78, **grain** `drawGrain(ctx,w,h,t,1.15,15)`, **scratch** pale vertical line alpha 0.08 on ~12% of frames at 12 fps.
6. **Letterbox bars** (picture-band height, drawn last): 1920 intro, 584 on hero/drop frames and last hit, 900 chase, 1100 breakdown, 1250 approaching the ending. Snap in 0.15 s at drops, ease 0.7-1.0 s elsewhere. A 2.39:1 band in 9:16 is too small on a phone.
7. Hard black frames: pre-drop gap and the song's hard cut.
In-scene: **lens flare** (additive r 420 amber 0.85 + r 120 white, anamorphic streak 1800x10 blue-white, 4 mirrored ghost discs alpha 0.14); **light shafts** (4 additive gradients 0.30/0.25/0.20/0.15 from the vanishing point, 90 dust motes); **fog** (`fogBand`, 3 drifting layers 5-14 px/s, alpha 0.2-0.35, plus a front band); **rim light** amber on lit edges; **parallax** (3+ layers at par 0.3-1.0); practical lights pulse with `hitPulse`.
Not done (offer, do not claim): true depth-of-field/rack focus (V6.1 `softenLayer` exists; the reference fakes depth with fog and bloom), real 3D camera orbit, motion blur beyond the whip.

## 7. Build loop
- `scene.mjs` exports `VideoClock {setTime, draw}`, deterministic f(t), seeded hash only; reads `beat_map.json` beside it. Router = `[start,end,shotId]` on real hits; `timeline.json` mirrors it (last scene id contains `loop`); duration = song + end card; no captions.
- Stills first (`still.mjs` pattern: 360-540 px at every section start/mid/hit), contact sheets, mean luma, composition, text overlap.
- `render_and_lint.mjs --project <dir> --skip-story-lint` makes segments only; concat from `render.json`'s manifest. No `manifest` means read `probe.defects`.
- Scene cache hashes scene.mjs only; clear it if a helper file changes.

## 8. Deliverables (both, always)
- `reel_baked.mp4`: padded song + synthesised SFX (~0.55), loudnorm -14, **48 kHz AAC**, `+faststart`. Judge sync on this file.
- `reel_inapp.mp4`: same picture, SFX only (~-18 LUFS) for adding the song at 0:00 in Instagram; sounds off alone, say so; Business accounts may hide the audio. The Instagram API via Windsor can post only the baked file (unconfirmed): baked = no trend-audio attribution and copyright mute risk; in-app = trend placement. Recommend, let Love choose.
- Mix: `ffmpeg -i song.wav -af apad=whole_dur=<L>`, then `amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5,aresample=48000`. A 96 kHz AAC fails QA.

## 9. Verify before sending (measured)
1. `python3 scripts/song_reel/sync_report.py reel_baked.mp4 beat_map.json <drop_s> <lo> <hi>`: drop offset and per-hit offsets; fix or report any hit > 34 ms.
2. `python3 scripts/song_reel/audio_continuity.py reel_baked.mp4 song.mp3 <song_end_s>`: 0 windows > 3 dB below the median, else exit 1.
3. `node scripts/qa_video.mjs --input X --project Y --platform reels --json` and the safe-zone sheet. No-voiceover warnings are expected; real FAILs (sample rate) are not.
4. Contact sheet of the whole reel plus close-ups of the intro, hero shot, breakdown, outro and rig.
Report honestly: not heard or watched on a phone, sync proxies are picture-motion based, code-drawn look.

## 10. Posting
ig-caption rules: short, punchy, one ask (`Share this ...` is what caption.py recognises), 3-5 hashtags (cap is 5), search phrases in plain sentences, no link; a long prose caption was rejected ("like a note in a book"). Cover = a full-frame still (letterboxed hero frames crop badly). Host the MP4 in the Code-video-upload repo (shell `git push` works; GitHub MCP file tools are text-only), post with Windsor `create_video_post` (`thumb_offset` ms for the cover). A timed-out call has an unknown outcome: never retry blindly; Windsor reads are cached, so have Love check the profile and re-check later. Pinning a comment needs the app.
