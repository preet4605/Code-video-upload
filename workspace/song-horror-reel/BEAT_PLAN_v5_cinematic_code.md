# v5: "desi Batman" trend research + song-driven horror direction, cinematic code look (for approval, nothing rendered)

v5 = v4 plus section 2b (the cinematic look). Love ruled out photoreal/AI images: everything stays code-drawn. The beat table in section 3 is unchanged.

Replaces v3 and the stairwell/dadi version. No voiceover. Baked MP4 contains the song.

## 1. What the trend is (from news coverage; I cannot watch Instagram)

Sources: [The Tribune](https://www.tribuneindia.com/news/trending/the-og-sajan-desi-batman-takes-over-instagram-madhuri-dixits-1999-saajan-saajan-his-new-anthem/), [The Open Press](https://theopenpress.in/article/saajan-saajan-batman-viral-trend-sujal-jaiswar-desi-batman), [Aaj Tak](https://www.aajtak.in/trending/story/desi-batman-sajan-sajan-viral-video-ai-or-real-instagram-tstf-dskc-2699344-2026-11-18), [Navbharat Live](https://navbharatlive.com/viral/desi-batman-viral-video-sujal-jaiswar-ai-vfx-kns18). (Samaa returned 403.)

- **Origin:** a numbered series by creator Sujal Jaiswar (Part 4 was circulating around 18 Nov). The audio is a remix of "Saajan Saajan Teri Dulhan" (Aarzoo, 1999). The most popular clip is reported at 16.2 M views (Tribune; one figure, unverified).
- **Format of the top clip:** a Batman-masked ordinary Indian man brushes his teeth by a village railway track and sees a missing-boy poster; cut to the Joker in an autorickshaw luring the boy with a lollipop; Batman suits up at home, rides a **buffalo** after him; rescue and a fistfight. Other episodes: village markets, tea stalls, bicycles, a "Desi Superman". Short mini-film, real desi locations and props, cinematic grade, AI-assisted VFX (reportedly small budgets, shot live plus AI compositing).
- **Why it works (as the coverage says):** the **contrast** between a romantic Bollywood song and a dead-serious action story, the desi setting and props (railway track, rickshaw, tea stall, buffalo), and a cinematic look that costs almost nothing. Other creators copied the audio, including for edits of ordinary people.
- **Not in any source I could read:** how creators sync the song, which beat gets the reveal, or any horror versions. I could not find a creator breakdown. So the sync below is **my inference from the song's measured structure**, not a documented trend rule: a quiet intro for setup, the 14.87 s drop as the hero/reveal moment, the 808 as movement, a breakdown for the pause. I would like to check this against one real reference clip. If Love can send a link to a desi-Batman clip, I will match its cut pattern.

## 2. Direction chosen: ride the trend's skeleton, invert the tone

Same skeleton, original character, horror instead of comedy:
1. **Mundane desi routine, then wrongness** (trend: teeth-brushing and a missing poster). Ours: a cyclist riding home through a village lane at night, a wedding poster on a wall, a railway crossing ahead.
2. **Villain reveal on the drop** (trend: the Joker, the suit-up). Ours: the dulhan appears on the track on the exact drop.
3. **Chase on a desi vehicle through desi locales** (trend: buffalo, markets, tea stall). Ours: a rusty cycle with a dynamo lamp through the railway track, market lane and tea stall.
4. **Showdown beat on the re-drop**, then a **button ending** that fits the hard cut.
The horror twist on the trend's own joke: a sweet bridal song under real dread. Original character and art only: an ordinary cyclist and a ghostly dulhan. No Batman, no cape or bat motifs.

**Why this should beat a random horror edit on this audio:** viewers already know this song as "desi cinematic action"; the audio tells them to expect an escalating chase, and the reel pays it off with a scare instead of a gag. It reuses the settings and the stage order they recognise, so it reads as part of the trend within 2 s.

**The cycle gives a built-in sync device:** the pedal stroke is the 808 hit, and the dynamo lamp pulses with each stroke, so the light literally beats with the song.


## 2b. Cinematic code look (replaces the blocky lit-box renderer)

**Why the old look failed:** flat-shaded 3D boxes. Film depth comes from layered silhouettes, haze and light, so I drop the box geometry and build each shot as **stacked parallax layers** (far to near) with real atmosphere between them, all drawn in code with curves, gradients and blur.

| Cinematic device | How it is done in code | Where it lands |
|---|---|---|
| Silhouette-led frames | Cut-out layers: mountains/treeline, village roofs and a water tower, OHE masts with sagging catenary wires, rails and sleepers in true perspective, a train as a lit-window silhouette. Cyclist and dulhan are rim-lit silhouettes with simulated cloth (veil, dupatta, hem) and pedalling legs. Faces never shown. | all shots |
| Volumetric light | Headlight and lamp shafts: layered additive cones with dust motes caught in them | drop 14.87, train breakdown |
| Haze / fog | 3-4 drifting fog planes between layers, denser toward the horizon | all |
| Bloom + lens flare | Blur-and-add pass on highlights; horizontal anamorphic streak and ghost discs on the headlight and bulbs | headlight, bulbs |
| Teal-orange / sodium grade | Colour curves: teal shadows, sodium-orange highlights, red kept as the one saturated accent (the dulhan) | whole reel |
| Shallow depth of field | Background and foreground layers rendered blurred by distance; focus pulls between layers on beats | reveal, mirror moments |
| Chromatic aberration + grain | RGB split growing toward frame edges, hit-driven spikes; film grain, gate weave, vignette | hits |
| Slow-motion ramps | Picture speed ramps to ~0.3x for ~0.5 s after the drop, back to 1x before the next bar. Edit points stay locked to the audio (audio is never slowed) | 14.87, 41.98 |
| Camera language | Low hero angles from rail level, dutch angles, push-ins, whip pans and a crane-up, each on a bar anchor or vocal onset | beat table |
| Anamorphic bars | See the note below | drop onward |

**Honest challenge on 2.39:1 letterbox:** a 2.39 picture inside a 1080x1920 frame is only 1080x452. That discards about 76% of the screen and shrinks the shots to a thin strip on a phone. Recommended instead: full-frame 9:16 for the intro, then **black bars slide in on the 14.87 drop** to a taller 1.85:1-style band (1080x584) and widen back out on the breakdown, with **lyric/caption text in the bottom bar** so it stays out of the picture. If Love specifically wants the full 2.39 strip all the way, I can do it, but it will look small.

**What code cannot do here (be clear):**
- No real character performance: the dulhan and the cyclist are rigged silhouettes (pedalling, swaying cloth, head turns), not filmed or AI video of a body.
- No photoreal textures: the look is graphic-cinematic (like a film-noir or animated-feature background), not live-action footage like the original trend.
- Faces stay hidden; the scares come from light, silhouette and timing.

**Risk control:** before the full build I can render a single look-test frame of the 14.87 s drop reveal (train headlight, dulhan on the rails) so Love can judge the look before I spend time on the rest. Say "do the look test" or just "approved" to go straight to the full build.

## 3. Beat plan (full 54.36 s; time = song time = video time)

Full length, because the vocal runs 0.3-14.1 s and the audio then starts at 0:00 in the app with no scrubbing. The measured hits and onsets are in `beat_map.json`.

| Time | Song event | Lyric (TBD, see 5) | Visual |
|---|---|---|---|
| 0.00-0.30 | silence, first hit 0.07 | | Black. A dynamo lamp clicks on at 0.07. |
| 0.30-5.44 | vocal phrase A, onsets 0.53, 0.86, 1.42, 1.95, 2.30, 3.32, 3.74, 4.81 | | Rear view of a man cycling slowly down a dark village lane, one lamp. **Each onset lights one thing:** a tube light at a tea stall, a shuttered shop, a faded shaadi poster (the bride's face scratched out). |
| 5.44-11.52 | vocal phrase B, onsets 6.34, 6.69, 7.27, 7.80, 8.17, 8.73, 9.08, 9.64 | | He passes the stall and a buffalo that stares at him; **red marigold petals on the road start at each onset**, leading toward the railway crossing. |
| 11.52-14.14 | vocal phrase C, riser | | Crossing barrier up, signal lamp, rails shining. Camera pushes in on the track as the riser builds. A far-off red veil, barely visible. |
| 14.79-14.87 | riser peak, gap | | Signal lamp snaps off. One black beat. |
| **14.87** | **DROP** | | **A train headlight blasts on behind the track; backlit, the dulhan stands on the rails, arms hanging, veil moving.** He stands on the pedals. |
| 14.90-26.66 | bar hits 14.90, 16.37, 17.84, 19.31, 20.78, 22.25, 23.72, 25.19, 26.66 | | **Chase through desi locales, one per 2-3 bars on the anchors:** along the tracks (14.90), market lane with swinging bulbs and shut stalls (19.31), tea stall and an autorickshaw (22.25). Each hit: pedal stroke, lamp pulse, a bulb pops. She is a little closer in the back-reflector glow on each bar. |
| 26.0-31.46 | vocal "...yaad aa raha hai" (heard, unconfirmed), words ~28.46, 29.34, 30.0, 30.64 | | **Cycle mirror / rear reflector:** on each word the veil is closer behind his shoulder, never a face. Bangle chime on 28.46 and 29.34. |
| 31.5-37.4 | drop continues, vocal repeat ~35.18, 35.94 | | Back onto the track, sleepers flying past, her shadow on the rails ahead of him. |
| **36.95-37.40** | last bar | | He looks back on the 36.95 hit. |
| 37.40-41.90 | breakdown, hat roll, quiet 39.4-40.4 | | **Level crossing, barrier down, a goods train passing.** Silence beat (baked version ducks the song 0.6 s before). Through the gaps between wagons, **single-frame glimpses of her standing on the far side, one glimpse per hat tick** (hi-hat onsets 40.0-41.9). |
| **41.98** | **RE-DROP** | | The last wagon clears on the hit. The far side is empty. The barrier rises. He rides on. |
| 41.98-50.2 | bars 43.21, 44.68, 46.15, 47.62, 49.09 | | Final stretch to his house with wedding lights (toran, diyas). On each hit a light behind him dies; her hem passes the cycle's shadow. |
| 50.19-50.74 | roll | | He drops the cycle, fumbles the gate latch; bangles rattle in sync. |
| 52.03 | bar | | Gate opens on the hit; he rushes into the courtyard, the doli and a lit mandap in front. |
| 53.50-54.30 | last hit, **hard cut 54.30** | | He turns: she is in the doli, veil in front of her. On the last hit her hand lifts the veil; **cut to black on the exact last sample** (the song cuts too). |

Ending is a **complete image** (she waited at his home); no "part 2" bait.

## 4. Sync method
- All visual events come from `beat_map.json`, not hand timing. Frame-locked at 30 fps (every hit within one frame, 33 ms). Cuts only on bar anchors; flame/petal/reflection events on vocal onsets; train glimpses on hi-hat onsets.
- Before showing Love, I will extract the finished MP4's audio onsets and the scene's event times, and print the per-event offset, so sync is measured.

## 5. What I could not verify
- **Lyric text.** Lyric sites would not return lyrics and Whisper cannot read this chopped vocal. I only have the vocal phrase timings. Captions stay off until Love pastes the lines sung in this clip.
- **Trend sync mechanics** (section 1).
- **Look.** My renderer is code-drawn 3D (fog, grain, light, silhouettes), not filmed or AI video like the real trend, so I rely on silhouettes, backlight, fog and railway geometry rather than detail. The earlier stairwell looked blocky; the new set (rails, poles, lane, cycle POV, train light) will be simpler geometry but needs your eye.
- **Risk:** this is a bigger build than the stairwell (4 sets). If Love wants less risk, cut to two sets (railway track + lane).

## 6. Files after approval
`reel_baked.mp4` (song inside; the file to judge sync), `reel_inapp.mp4` (SFX only, add the song at 0:00 in Instagram), sync-offset report, QA sheets.
