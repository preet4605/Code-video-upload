# sound-demo: 20 s night corridor (audio only, tier A)

No picture, no voiceover: it exists to exercise `sound.json` and the audio QA.

* Timeline: `timeline.json` carries a native `events` object (`start, steps_start, creak, heart_start, riser_start, silence_start, scare, end`); every cue in `sound.json` anchors to one of them.
* Sound: room tone + gusting wind + `phrygian` underscore (tension from the scene moods), three drips, footsteps approaching from hard left with level/brightness rising, a door creak, a heartbeat 54 -> 104 bpm, a 3 s riser, a 0.65 s designed silence (a `drop` cue), then stinger + sub drop (tagged `scare`) in a hall reverb.
* Rebuild: `node scripts/sound_design.mjs --project examples/sound-demo --mix examples/sound-demo/demo_mix.m4a` (about 8 s; stems go to `audio/*.wav`, git-ignored).
* QA at the time of writing: true peak -1.65 dBTP, pre-scare silence drop 37.9 dB, phone check -9.8 dB share, loudnorm pass 2 reported dynamic (LRA 18 LU) so the fixed-gain + limiter fallback was used. Nobody has listened to it: judge it with headphones and on a phone speaker.
