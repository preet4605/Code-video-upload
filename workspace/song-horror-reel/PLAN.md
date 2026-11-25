# "Seedhiyon ki Batti" horror reel: plan on the trending song

Status: PLAN ONLY. Nothing rendered. Waiting for Love's approval.
Account: @doomsday_penguin. Format: 9:16, 1080x1920, 30 fps, **54.36 s** (the song's exact length), Hindi captions, no voiceover.
Files in this folder: `PLAN.md` (this), `beat_map.json` (every hit and bar time), `brief.json`, `script.txt`, `critique.json` (all pass the V6.1 script gate), `audio_spectrogram.png`, `song_original_audio.mp3`.

## 1. What the song is (measured, not heard)

I cannot listen to audio. Everything below comes from signal analysis of the mp3 (librosa, ffmpeg) plus a Whisper pass.

| Fact | Value |
|---|---|
| Duration | 54.36 s, 44.1 kHz stereo, 128 kb/s, metadata title is a numeric id: it is an Instagram "Original audio", not a label release |
| Loudness | -11.4 LUFS integrated, loudness range 4.7 LU (loud, compressed) |
| Tempo | tracker says ~162 BPM (beat every 0.37 s). The drum feel is half-time (81 BPM) with a 3-3-2 swung 808 pattern. **One bar = 1.47 s.** |
| Key centre | E, bass note ~82 Hz (E2) |
| Genre feel | phonk / trap drop with a breathy, vocal-chop intro |
| Hard cut | the file ends abruptly at 54.3 s, no tail, so the reel must end on a hard cut |

**Structure (this drives every edit)**

| Time | Section | What happens |
|---|---|---|
| 0.00-14.90 | Intro, 10 bars | No sub-bass. Pad plus sparse vocal chops, strongest 0.3-5.4 s. First sound at 0.07 s. A riser peaks at ~14.8 s. |
| **14.90** | **DROP** | 808 sub-bass lands. Loudest, densest stretch starts. |
| 14.90-37.40 | Drop 1, ~15 bars | Sub-bass hit every bar. Bar anchors every 1.47 s: 14.90, 16.37, 17.84, 19.31, 20.78, 22.25, 23.72, 25.19, 26.66, 28.13, 29.60, 31.07, 32.54, 34.01, 35.48, 36.95. |
| 37.40-41.90 | Breakdown | Bass thins, hats and a riser. Quietest point ~39.4-40.4 s. |
| **41.98** | **RE-DROP** | 808 returns. |
| 41.98-54.30 | Drop 2 | Bar anchors 43.21, 44.68, 46.15, 47.62, 49.09, 50.56, 52.03, 53.50. Snare-style roll at 50.19-50.74. |

Full lists (84 sub-bass hits, 199 onsets) are in `beat_map.json`. The build must re-read exact onsets from the audio file rather than trust my bar math to the frame.

**Lyrics / language: low confidence.** The vocal is a sparse chopped female chant, probably Hindi/Urdu. Whisper (forced Hindi) heard roughly "...chaand... taaron... kya doge", but its own no-speech score was 0.56-0.94 and the Hindi text is garbled, so treat it as unreadable. The story is built so it does not depend on the lyrics. **Please tell me the song name or meaning if you know it**, so we do not pair a devotional or sensitive line with a ghost story.

**Three things in the audio that shape the plan**

1. **The song is never silent.** The breakdown is only ~4.5 dB quieter than the drop, so a real "silence before the scare" cannot come from the song. Fix: make the silence **visual** (one second of an empty lit landing and a lone shadow), or bake the song and duck it for one second (see section 2).
2. **14.9 s of intro before the drop is a retention risk.** The hook must work visually in the first 2 s with the sound off (two shadows on a wall). Optional cold-open cut in section 8.
3. **No dead air.** The 808 pattern is footsteps. We use it that way.

## 2. Bake the song in, or add it in the app?

**Recommendation: post with the song added inside Instagram, keep a baked MP4 as the fallback.**

| | In-app audio (recommended) | Baked into the MP4 |
|---|---|---|
| Trend attribution and audio-page reach | Kept | Lost (it becomes your own original audio) |
| Beat sync | Good if the audio starts at 0:00. The song is 54.36 s and the reel is 54.36 s, so no scrubbing, but **check on the phone that the drop lands on the flash at 14.9 s** before posting | Perfect, frame-locked |
| Silence-before-scare | Not possible (cannot duck someone else's audio) | Possible, 1 s duck at 37.4 s |
| Our own sound effects | Baked as a quiet SFX-only track, mixed in-app (set original audio around 30-40%) | Baked, ducked correctly |
| Licensing | Safe: it is an Original audio, used the normal way | Re-uploading someone's audio inside a video is the part to avoid if the original creator did not clear it |

Unknown I cannot check from here: if @doomsday_penguin is a **Business** account, Instagram can hide some audios in the picker. Test that the audio appears before we spend render time. If it does not, we ship the baked version.

Deliverables on approval: `reel_inapp.mp4` (video + quiet SFX track) and `reel_baked.mp4` (full mix), same picture.

## 3. The story (complete, no "part 2")

Format: standalone, loop ending. Language: Hindi (Devanagari captions, red emphasis words). The scare is the one broken rule: **do not look back.**

**One line:** at 2 a.m. he climbs a dark apartment stairwell with two shadows on the wall. His dead dadi's rule says never look back. He looks, and learns the one behind him was walking him home.

- **Hook (0.3 s):** "रात के दो बजे, सीढ़ियों पर मेरे पीछे कोई चल रहा था।"
- **Rule (invented family rule, labelled as dadi's):** "...पीछे कोई चले, तो मुड़कर मत देखना।" Dadi is shown only as a key-bunch jingle.
- **Planted clues, before any scare:** the key-bunch jingle (dadi tied her keys at her waist), wet bare footprints already climbing **ahead** of him.
- **Escalation x4:** jingle on every step, the timer light dies every landing and the sound gets one step closer, a dripping figure stands above with its back turned, trapped between the two.
- **Violation:** "मैंने मुड़कर देख लिया।"
- **False relief:** only dadi's shadow and her keys are behind him.
- **Twist (explains the hook):** she vanishes the moment he looks. She was escorting him home, shielding him from the wet one above.
- **Payoff:** the wet figure comes down the opposite flight, passes within arm's reach. He makes the door.
- **Ending image and callback:** under the door, the light strip, two wet feet, a drip falling into the light. Last line inverts the hook: "...मेरे पीछे कोई नहीं चलता। वो दरवाज़े के बाहर खड़ा रहता है।"

What is never shown: the wet figure's face, dadi's body. Dadi appears only as a shadow, jingle and falling keys. The wet figure appears only as a back, drips and footprints.

Rewatch trick: in the first 10 s the second shadow already has a swinging key-bunch at its waist. Almost nobody will see it the first time.

### Captions (13 lines, about 140 words, passes the V6.1 script gate)

| # | Show at | Caption (Devanagari) | Meaning |
|---|---|---|---|
| 1 | 0.3-3.4 | रात के दो बजे, सीढ़ियों पर मेरे पीछे कोई चल रहा था। | At 2 a.m. someone was walking behind me on the stairs |
| 2 | 3.6-5.6 | लिफ्ट बंद, घर पाँचवीं मंज़िल पर। | Lift off, my home is on the fifth floor |
| 3 | 5.8-10.6 | तीन साल पहले गुज़री दादी चाबियाँ छनकाते हुए कहती थीं, पीछे कोई चले, तो मुड़कर मत देखना। | Dadi, gone three years, used to say it, jingling her keys: if someone walks behind you, don't turn and look |
| 4 | 10.8-14.4 | गेट से गीले पैरों के निशान मुझसे आगे चढ़ रहे थे। | Wet footprints from the gate were climbing ahead of me |
| 5 | 15.4-18.6 | हर क़दम पर पीछे चाबियाँ छनक रही थीं। | At every step, keys jingled behind me |
| 6 | 19.8-23.6 | बत्ती हर मंज़िल पर बुझती, और आवाज़ एक क़दम पास आ जाती। | The light died on every floor and the sound came one step closer |
| 7 | 26.0-30.2 | ऊपर कोई खड़ा था, पीठ मेरी तरफ़, पैरों से पानी टपकता हुआ। | Someone stood above, back to me, water dripping from their feet |
| 8 | 31.3-35.6 | आगे वो, पीछे वो, नीचे जाने का रास्ता नहीं। | Him ahead, her behind, no way down |
| 9 | 36.3-37.7 | मैंने मुड़कर देख लिया। | I turned and looked |
| 10 | 37.8-40.2 | पीछे दादी की परछाईं थी, और छनकती चाबियाँ। | Behind me was dadi's shadow, and jingling keys |
| 11 | 40.3-44.3 | देखते ही वो चली गईं। वो मुझे घर छोड़ने आई थीं, ऊपर वाले से बचाकर। | The moment I looked, she was gone. She had come to see me home, shielding me from the one above |
| 12 | 44.6-48.4 | मेरे और उसके बीच कोई नहीं था। मैंने चाबियाँ उठाईं, भागा। | Nobody between me and it now. I picked up the keys and ran |
| 13a | 48.8-51.3 | अब सीढ़ियों पर मेरे पीछे कोई नहीं चलता। | Now nobody walks behind me on the stairs |
| 13b | 51.4-54.2 | वो दरवाज़े के बाहर खड़ा रहता है। | It stands outside my door |

Caption speed target is <= 18 characters per second, two lines max, 42 characters per line. The lint in the build will check this. If line 3 is too dense on screen, split it across 5.8-10.6 s as two cards.

## 4. Shot list, locked to the song

Camera is mostly first person behind his shoulder (hood silhouette), handheld tremor that grows toward the end. Each footstep, light snap and lens hit lands on a **sub-bass hit** from `beat_map.json`. Blackouts are at least 4 s apart, so no strobe problem.

| # | Time | Song event | Picture | Sound effects (quiet, under the song) |
|---|---|---|---|---|
| 1 | 0.00-2.30 | silence, 0.07 first hit, vocal 0.3 | Black. A bare bulb buzzes on at 0.07. Low angle up a switchback stairwell. His back on the first landing. **Two shadows on the wall**; the second is a half-step out of rhythm. | bulb buzz, one soft footstep on 0.53 and 0.86 |
| 2 | 2.30-5.40 | vocal phrase 1 | Slow push-in as he climbs. Timer button with a red LED on the wall. Hand-lettered sign "LIFT BAND HAI" on a steel lift door. | footsteps on the onsets |
| 3 | 5.40-9.50 | vocal phrase 2 | Landing two. Peeling oil-paint dado, rusted railing, shoe rack. Second shadow has a pallu and a swinging key bunch. | key jingle once at ~7.0 |
| 4 | 9.50-14.80 | pad swell, riser | Tilt down: small bare wet footprints climbing the steps, edges drying. A drip falls into frame at 12.0 and ripples. At 14.79 the timer light clicks off. Black. | drip at 12.0, riser swell |
| 5 | 14.90-19.30 | **DROP** | One beat of black, then the bulb snaps on with the first 808. Whip-follow up a flight. Each footfall = a sub-bass hit with dust puff and camera bob. | footsteps on the hits |
| 6 | 19.31-22.25 | bar | **Blackout 1** on 19.31: only the red LED. Light re-clicks at ~20.0. The second shadow is bigger. | timer click, jingle one step closer |
| 7 | 22.25-26.66 | bars | Landing three to four, orbiting camera, lens chromatic hit on every bar. **Blackout 2** at 25.19. | jingle louder |
| 8 | 26.66-28.13 | bar | Light re-clicks: on the landing above, a **silhouette, back to us**, rim-lit by a window grille. Water drips off its feet into the light strip. | drip, slow |
| 9 | 28.13-34.01 | 4 bars | Vertigo push (field of view widens while the camera moves in) on bars 28.13 and 31.07. The figure above turns its shoulders a few degrees per bar, never its face. The shadow behind grows. | jingle trembles |
| 10 | 34.01-36.95 | build | Tremor ramps. Close on his hand whitening on the rail. Two quick hits at 36.43, 36.83 are his breath. | |
| 11 | **36.95-37.40** | **bar hit** | **The turn.** 180 degree whip with chromatic smear on the hit. The landing behind him is lit and empty. | |
| 12 | 37.40-40.30 | breakdown | **Visual silence:** 1 s hold on the empty landing, then on the wall a **lone shadow with no body**: saree, pallu, keys at the waist. Held through the quietest point 39.4-40.4. | jingle, very quiet |
| 13 | 40.30-41.90 | riser | The shadow thins like a dying light and slides off the wall. Keys drop on stone at ~41.0, land in the light strip. | keys fall, stone tail |
| 14 | **41.98** | **RE-DROP** | Hit. His hand scoops the keys. Bolt up the flight. | his own jingle (same notes as hers) |
| 15 | 42.90-46.15 | bars 43.21, 44.68 | Run. From 44.7 the wet figure enters on the **opposite switchback flight, descending**, back to us, hair wet. | wet steps, slow drip |
| 16 | 46.15-48.60 | bar 47.62 | Pass-by across the stairwell void, an arm's length apart. On the 47.62 hit, a spray of drops across the lens. We see a back and wet hair only. | drops, breath |
| 17 | 48.60-52.03 | bars 49.09, 50.56, roll 50.19-50.74 | Last flight. Fumbling the key; the snare roll is the key rattling in the lock. Door opens and slams on **52.03**. | key rattle on the roll, door slam on 52.03 |
| 18 | 52.03-54.30 | bar 53.50, hard cut | Inside, camera low at the door gap. The light strip under the door. At 53.50 two shadow blocks of feet stand in it. A drip falls into the strip at ~53.66. **Hard cut on 54.30 with the song**; no fade. | drip, nothing else |

Hook check (0-2 s, sound off): bulb snaps on, the climb, two shadows on one wall, caption 1. A viewer can say what it is about.

## 5. Visuals (answers "flat vector is not scary")

No flat cards and no top-down diagrams. Built with `scene3d.mjs` (perspective quads and boxes, point and cone lights, fog, volume cone, dust, grain, vignette, chromatic aberration).

- **Set:** a real switchback stairwell with a central void, 5 floors visible, concrete steps with chipped edges, oil-paint dado stripe, rusted railing, steel lift door, electric meter box, hanging wires, nameplates, shoe racks, a window grille on the landing, a "Subh Labh" sticker over a door.
- **One motivated light:** a warm 40 W bulb with a faulty timer plus a red timer-LED glow and cold moonlight through the grille for rim light. Mean luma kept dark, around 15-25/255.
- **Shadows are the monster:** shadows are projected onto the wall quad analytically, so the second shadow can behave wrongly (half-step off, growing, standing alone).
- **Motion every frame:** handheld tremor ramping with the song, dust in the cone, drips, hair and pallu sway, camera follow and orbit on the hits. Per-hit pulse (lens chromatic, bulb flare) driven directly by the sub-bass list.
- **Figures** are rim-lit silhouettes only: his hood from behind, the wet figure from behind, never faces.
- **Safe zones:** action stays inside x 60-900, y 270-1440, caption bar below y ~1250 per profile.

## 6. Sound plan

- The song is the bed. All other sound is quiet foley: key jingles (three distinct kinds: dadi's, his, rattle in the lock), drips, wet steps, timer-light clicks, bulb buzz, door slam, stone key fall.
- Synthesised, same method as the Ginti pilot (`sound_design.py`), no stock audio.
- In-app route: SFX track baked at low level, song added over it. Baked route: song ducked 1.0 s at 37.4-38.4 s so the turn has a real hole before the shadow scene.

## 7. Posting copy

**Caption (Hinglish):**
```
Dadi ka rule: peeche koi chale, toh mudke mat dekhna. 👣
Maine dekh liya.
Aapki building ki seedhiyon pe kabhi light bujhi hai? Comment mein batao. 👇
```
**Hashtags:** `#horrorreels #hindihorror #horrorstoryinhindi #bhootiya #haunted #darkreels #creepyreels #scarystories #nightmare #doomsdaypenguin`

**Cover frame:** t = 8.0 s (two shadows on the wall, key bunch visible).
**Pinned comment idea:** "2 baje seedhiyon pe peeche se chaabiyon ki awaaz aaye toh kya karoge? 👇"

## 8. Risks, honest

| Risk | Detail | What we do |
|---|---|---|
| Retention in the 14.9 s intro | Slow bass-less intro | Strong visual hook plus beats on every vocal onset. **Optional cold-open cut:** start the audio at ~12.0 s so the drop lands at ~2.9 s; the reel becomes ~42 s and loses captions 3-4. Say the word if you want that version instead. |
| Beat sync after in-app audio | Possible 0.1-0.3 s offset | Check on the phone before posting; baked fallback exists |
| Business-account audio restrictions | Not checked | Verify the audio shows in the picker first |
| Trope | Dead-relative protector is familiar | The key jingle, timer light and wet footprints are the fresh parts |
| Gate adaptation | The V6.1 script gate expects spoken voiceover | `script.txt` lists captions as `[NARRATOR]` lines. The gate passes, but no voiceover will be made |
| Not verified by ear or eye | No render yet | Watch with sound on a phone in a dark room before posting |

## 9. Build steps once approved (about the same effort as the Ginti pilot)

1. `npm install` in the V6.1 skill folder, `doctor.mjs`.
2. Convert `beat_map.json` into the scene's hit list; confirm every bar anchor against the real onsets.
3. Write `scene.mjs` (stairwell, shadows, figures, drips) and `shotlist.json`.
4. Synthesise the SFX track, render draft, visual loop until PASS, final render.
5. Master both versions, QA contact sheet and safe-zone sheet, then hand over for your watch with sound.
