# Direction brief: "Ginti" pilot

**Viewer:** Hindi-speaking hostel/college students, 17 to 25, scrolling at night.
**Hook (0 to 1 s):** The torch is already sweeping a dark dorm and the GINTI counter is ticking. The counter flips to red **29** on "zyada".
**Payoff:** The 29th was lying behind the narrator in his own bed. The next night the count is a clean 28, and he isn't in it.
**Loop:** The last shot repeats the opening aisle shot and torch, so the replay feels like "the next night" again.
**Rule for the series:** each reel is one complete story with setup, rising dread, a twist that explains the hook, and an ending that lands. A Part 2 only when the story truly needs one.

## Shot list

| # | Time | Shot | Camera | Light and detail | Sound |
|---|---|---|---|---|---|
| 1 | 0 to 6.6 s | Low view down the dorm aisle toward the open door. Warden backlit, torch sweeping the beds. | Slow dolly forward, handheld drift | Corridor tube light flickers. Moon shafts through barred windows. Fog, beam dust, a fan turning | Torch click at 0 s, warden footsteps, fan whoosh, tube buzz, low hit on "zyada" |
| 2 | 6.6 to 13.3 s | High wide over all 28 beds. The torch stops bed by bed, and the counter ticks with each stop. | Lateral crane with a slight yaw | Sleepers breathing out of sync. Buckets, slippers, steel almirahs, damp stains, cracks | Footsteps, fan, drone starting |
| 3 | 13.3 to 21.7 s | Close-up of the narrator from behind, facing a scarred wall with nights scratched into it as tally marks | Slow push-in | The torch pool arrives and lingers. **His shadow on the wall grows a second head.** | Heartbeat starts slow, torch click on "torch" |
| 4 | 21.7 to 28 s | Low angle up the aisle, torch pointed into the lens | Push-in, shake kick on each "29" | Lens glare, chromatic split on the hits, every sleeper's breathing slows | Sub swell into each "29", low hit |
| 5 | 28 to 34.4 s | From the narrator's bed back to the door: "jo is kamre ka nahi hai..." | Creep forward | **All breathing stops** after the line. The tube light stutters | 1.2 s of held silence with only the fan and buzz |
| 6 | 34.4 to 41.9 s | The door closes and the light strip shrinks to nothing. Moonlight only, a false calm | Rising, turning crane toward his corner | Fan keeps turning | Long door creak, latch thud, heartbeat eases (false relief) |
| 7 | 41.9 to 48.9 s | Extreme close-up of his neck in moonlight. Cold breath puffs arrive from the dark, and the mound behind him rises | Push-in with a dutch tilt | His breathing stops on "thandi saans" | Close breaths panned right, heartbeat racing, sub swell |
| 8 | 47.8 to 49 s | **Pre-scare drop** | Held | | Everything cut except faint room tone (measured −37.6 dB mean) |
| 9 | 49 to 51.8 s | A pale face slides out of the dark behind his head during the whisper. **The eyes open on the last word.** | Push plus shake kick | Half the face stays in shadow, wet hair framing it | Whisper "Warden ne sahi gina tha", then a dissonant cluster stinger with a sub boom |
| 10 | 51.8 to 59.9 s | Callback to the opening aisle. The torch counts a clean 28, then settles on his corner bed. The figure there turns its face to camera | Reverse dolly and pan to the corner | | Reverse swell, then a second stinger on the turn and a last breath at the loop point |

## Pacing

- There is a visible change at least every 4 s: counter ticks, torch stops, cuts and kicks.
- The voice is slowed to 0.96x and the pauses are deliberate (0.4 to 1.2 s). Silence is never longer than 1.2 s, and room tone keeps it from being dead air.
- Captions are Hinglish with the active word in red, placed above the bottom UI zone.

## What is built in code (no stock footage, no samples)

- **Visuals:** a small perspective renderer for the dorm (28 iron beds, almirahs, tiles, windows, ceiling fans, door), per-surface torch, moon and corridor lighting, volumetric beam with dust, fog banks, film grain, vignette, slow exposure flicker (well under the strobe limit), chromatic aberration that spikes on hits, and handheld camera noise.
- **Sound:** `tools/sound_design.py` synthesizes room tone, fan, tube buzz, a detuned dread drone, sub swells, heartbeat, footsteps, torch clicks, door creak and latch, breaths, and stingers. All of it is timed from the word timings in `timeline.json`, so it follows the voice if the voice changes.
