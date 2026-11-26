# Sound: cue sheet, tier-A synthesis, mix and audio QA

Decision (maintainer): **code-only audio.** Tier A (own-code synthesis, free, deterministic) is the product. Tier C (files you import by hand, with a licence record) stays supported. Tier B (paid generators) is a documented stub: `lib/audio/providers.mjs` exports `resolveGenerated(cue) -> {file, licence}` and it throws `no provider configured`. No provider code, no API calls. Known limit: realistic foley (doors, cloth, footsteps on real surfaces) from pure synthesis stays "game-like"; the modal/friction models below are decent for horror texture, not a substitute for recordings. If a scene needs real foley, import a licensed file (tier C).

## Pipeline

```
sound.json + timeline.json --scripts/sound_design.mjs--> <project>/audio/{sfx,music,ambience,room}.wav  (48 kHz stereo float, exactly duration_s long, linear)
                                                         cue_report.json  licences.json
stems + timeline.audio_file (VO) --master_and_qa.mjs (--stems <dir> or auto-detect <project>/audio)--> bus gains -> ducking -> two-pass loudnorm -> AAC in the MP4
audio-only:  node scripts/sound_design.mjs --project <dir> --mix out.m4a   (renders, mixes, masters, runs the audio QA; writes audio/audio_qa.json)
validate:    node scripts/sound_design.mjs --project <dir> --check
```

Projects without `sound.json` behave exactly as before.

## sound.json (schema: `templates/sound.schema.json`)

`{ seed, buses:{vo,sfx,music,ambience,room}, ducking?, space?, cues:[...] }`. A cue: `id` (unique, also the seed key), `at` (timeline event name from `timeline.events`, or seconds), `offset_s`, `until`/`until_offset_s` (beds, drops), `layer`, `kind`, `params`, `gain_db` (relative to the kind default), `gain_curve:[{at,offset_s,db}]` (time-varying bed level; interpolated in linear amplitude, `db <= -90` = silent), `pan` (-1..1 or `{from,to}`), `reverb` (`"room"|"hall"|"corridor"|"outdoor"`, `{preset,send_db}` or `false`), `filter:{lp_hz,hp_hz}`, `tags`, `source` (`synth` default, `generated`, `library`), `file`, `licence`.

* Unknown kind, unknown event, duplicate id, bad layer, `until` before `at`, missing file/licence on a non-synth cue are all **errors** (nothing is silently skipped).
* Each cue is seeded from `hash(seed, cue.id)`: same sheet = identical samples; adding a cue never changes another cue's noise.
* `kind: "drop"` is automation, not a sound: it multiplies the named buses (default sfx, music, ambience; room tone stays) down by `depth_db` between `at` and `until`. That is how the pre-scare silence and the ZSD dead zone are made.
* Tags: `scare` (QA demands >= 0.5 s relative silence before the cue's first audible sample and checks event anchoring), `accent` (an intended loudness spike), `phone` (run the phone check on it). `sub_drop` and `heartbeat` get the phone check automatically.
* Events: `timeline.events` (written by `build_vo.mjs`) wins. Only if a timeline has none (older examples) are `lineNN_start/_end` derived from `scenes[].lines`; the cue report marks those as `derived_events`.
* A stinger returns a pre-roll (`swell_s`, reverse swell): `at` is the hit, `onset_s` in the cue report is the first audible sample. The silence check uses the onset.

## Tier A kinds (`lib/audio/synth/*.mjs`, `lib/audio/music.mjs`)

| kind | method | notes |
|---|---|---|
| impact | modal bank (inharmonic modes, per-mode decay) + contact click | material wood / metal / door_slam (adds body thud + latch rebound) |
| ring, bell | modal partials, detuned pairs, tremolo | steel thali, bangles, school bell (ZSD partials) |
| creak | stick-slip impulse train (irregular rate) -> two moving state-variable resonators, stick pauses gate the output | |
| footsteps | modal heel + toe + filtered click + grain scatter, per-step binaural pan, distance darkening | surfaces wood, concrete, tile, gravel, grass, carpet |
| shuffle, slap, thump | band-passed noise puffs / wet slap / chest thump with 150-300 Hz knock | |
| drip, pluck | chirp + sizzle + Karplus-Strong pipe ring; KS pluck | |
| wind, rain, room_tone, cicadas, crackle | noise beds (state-variable filter driven by gust signal, Poisson drops, pulse-gated 3-8 kHz) | beds are normalised to ~ -20 dBFS RMS; stereo decorrelated |
| heartbeat | lub-dub, two envelopes, bpm and level ramps, knock layer | phone-checked |
| breath | formant-filtered inhale/exhale | |
| riser | exponential band sweep + rising tone stack | |
| sub_drop | 80 -> 40 Hz sweep + 2nd/3rd harmonics + 150-300 Hz knock, `harmonics: 0` = pure sub | phone-checked |
| stinger | reverse swell + dissonant cluster + burst + boom | `pre_s` |
| whoosh, noise_swell, hum | moving-pan sweep; shaped noise (swoosh, scrape, gust, reverse swell); sum of glides (sub bed, pad, rising ring) | |
| underscore, drone, pad, piano_motif, strings_tension | additive/modal; key, scale (minor, phrygian, locrian, harmonic_minor, whole_tone, cluster), tempo, `tension` (0..1, `[{t,v}]`, or `"auto"` = `computeTensionCurve` from scene moods, scares and silence drops) | sparse by design: most beats are rests, strings only sound when tension > ~0.15 |

Space: `lib/audio/space.mjs`. Pan = equal-power; point SFX also get a head model (ITD <= 0.6 ms including filter delay, up to 3 dB ILD, head-shadow lowpass down to 3.2 kHz). Never applied to VO or beds (a 0.6 ms ITD folds to mono with a comb notch). Reverb = synthetic IR (decaying noise with low/high-band decay times, early reflections, flutter taps for the corridor), FFT overlap-add convolution, one convolution per (layer, preset) send, never per cue.

Render cost (ms per second of audio, one core, Node 22, measured): impact 27, ring 6, bell 20, slap 20, thump 19, creak 22, footsteps 8, shuffle 7, pluck 2, drip 12, wind 26, rain 18, room_tone 10, noise_swell 4, whoosh 16, crackle 2, breath 9, cicadas 13, heartbeat 4, riser 17, sub_drop 7, stinger 18, hum 6, drone 44, pad 73, piano_motif 7, strings_tension 106, underscore (all four) 237. Reverb adds roughly 0.3 s per 20 s stem per preset used. A 61 s reel renders in ~5 s without music.

## Mix

Bus trims (dB, default vo 0, sfx -3, music -12, ambience -14, room -26). Music and ambience duck under the VO with an envelope built in JS from the VO level: depth 5 dB (allowed 4-6), attack 20 ms (10-50), release 500 ms (300-800); out-of-range values are clamped with a warning. SFX and room tone never duck. (`sidechaincompress` cannot cap its gain reduction, so it is not used.) Then two-pass `loudnorm` I=-14, TP=-1.5 (headroom for AAC overshoot; QA limit is -1 dBTP). Pass 2 is forced `linear=true`; if ffmpeg reports `dynamic` (LRA too wide or the gain would exceed the true-peak ceiling) the dynamic result is **not** shipped, because it pulls designed silences back up. A fixed gain + limiter is used instead and a warning is recorded. Horror mixes with a designed 40 dB drop usually take this path (the demo does: LRA 18 LU).

## Audio QA (only when the project has a sound.json; goes into `verified`/`unverified`/`fails`/`warns`)

| check | definition | verdict |
|---|---|---|
| voice clarity | per spoken span (scene lines), VO vs everything-non-VO, 1-4 kHz RMS, measured on the **stems after bus gain + ducking** (VO cannot be separated from the encoded mix) | fail < 10 dB, warn < 12 dB |
| phone check | for each sub_drop / heartbeat / `phone`-tagged cue, in the sfx stem: share of window energy in 150-400 Hz (4th-order band-pass) and level after a 200 Hz high-pass | fail if share < **-20 dB** or hp200 < -60 dBFS |
| mono fold-down | final mix, spoken spans, 1-4 kHz: loss of mid=(L+R)/2 vs mean(L,R) energy; mean L/R correlation | fail >= 3 dB, warn if correlation < 0. Needs a VO file, else unverified |
| true peak | decoded final AAC, 4x oversampled | fail > -1 dBTP |
| short-term loudness | BS.1770 K-weighting, 3 s windows every 0.5 s | warn > target + 3 LU; windows containing a `scare`/`accent` cue are labelled intended |
| pre-scare silence | window [onset-0.5 s, onset-0.02 s] vs the 80th-percentile 100 ms block power of the preceding 4 s | fail if drop < 10 dB (skipped if no lead-in) |
| scare anchoring | `scare` cue uses an event name with offset within 1 frame | verified / warn |
| licences | every non-synth cue present in `audio/licences.json` with file + licence | fail if incomplete |

Phone-check calibration (why X = -20 dB): rendered with this package's synths, 150-400 Hz share is -9.3 dB for `sub_drop` (harmonics 1), -13 (0.5), -17.7 (0.2), **-26.8 dB for a pure sweep (harmonics 0)**; heartbeat -9.7 dB with the knock layer, -20.6 dB without. -20 sits between the working and the broken cases. It is a proxy for a phone speaker (no real speaker model).

Unverified forever (always listed): whether it sounds good or scary; stinger timing against the *picture* (only event anchoring is checked); how it sounds on a real phone.

## Tier C (library files)

Cue with `source: "library"`, `file` (WAV, any rate, mono or stereo; resampled linearly), `licence` (`"CC0"` or `{name,url,credit,proof}`). Rendered through the same gain/pan/filter/reverb chain and recorded in `audio/licences.json`. Sonniss GDC bundles, Freesound CC0/CC-BY, Pixabay (keep the licence proof) are fine; BBC Sound Effects (non-commercial) and the YouTube Audio Library (YouTube only) are not. Never use MusicGen/AudioGen weights, AudioLDM 2, Tango, or unofficial Suno/Udio wrappers.

## What was checked spectrally (nobody listened)

Each kind: deterministic hash, finite, peak <= 1.25, RMS floor; band shares (cicadas 3-8 kHz, wind/room < 1.5 kHz, sub_drop 150-400 Hz, metal impact > 300 Hz), riser brightening, footstep pan/level trajectory, IR energy and decay, ITD bound, duck depth/attack/release, mix routing. Quality of timbre is unknown.
