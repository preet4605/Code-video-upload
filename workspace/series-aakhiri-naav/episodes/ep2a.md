# ep2a — नाम (Branch A: wade to the boat)

**Format:** `serial` part (no vote; rejoins at ep3). **Publish:** same day as ep2b, ep2a first. **Look:** night blue, one warm cabin window, 3D scene (see bible §9).
**One-line pitch:** He wades toward a warm boat, finds the water getting *kinder* the closer he gets, and answers a voice that is almost his own.
**Scare pattern (for the no-repeat gate):** reflex answer, then lights out. Audio-led, no creature.

## Story gate block

| Field | Content (quoted lines are exact script lines) |
|---|---|
| part_question | Who is calling from the boat, and what does it want from him? |
| part_payoff | It wants one answer. He gives it: "नाम पुकारे जाने पर जवाब देना सबसे पुरानी आदत है, और मैं उससे हार गया।" |
| setup | He wades toward the dry boat with the lit window. Three nights of calling for his brother are the reason he is here. |
| clues planted (all before the twist) | C1 "तीन रात से मैं इसी किनारे से पुकार रहा था, छोटे, मैं यहीं हूँ" (his own call words, which the lake will replay in ep2b and ep5). C2 "पानी गर्म हो गया ... जो दिसंबर की झील में हो ही नहीं सकता". C3 "वह बहुत सारे लोगों का एक ही शब्द है, हाँ, हाँ, हाँ". C4 "मैं उसे लगभग पहचान गया" (the voice is his own, raised and softened). |
| escalation ×3 | warm ring that stops his shivering; the cabin murmuring "हाँ" in many voices; the jacket is body-warm and smells of his brother's hair oil |
| false_relief | "मुझे लगा कि वह ज़िंदा है, और मैं रो पड़ा।" |
| silence | 1.0 s after the false relief, then the voice |
| twist (explains hook) | The hook's "hand on my chest" becomes literal: "पानी ने मेरी छाती को उसी हाथ की तरह जकड़ लिया।" The cold at step one was the lake reaching for him, not weather. |
| ending_image | He lies on the bank, the boat resting beside him "as if it had put him there". A small hand pushed him out. |
| new question (cliff, last ≈5 s) | "तभी पीछे से एक छोटे हाथ ने मुझे किनारे की तरफ़ धकेल दिया।" Whose hand? (paid in ep3) |
| callback | hook "हाथ" returns in the grip line |
| rule status | **Rule one broken here.** The village saying "नाव की आवाज़ का जवाब मत दो" was set in ep1. |
| threat.planted_by | The warm water and the murmur are planted before the voice speaks. |
| new_facts for bible | The lake's water is warm near the boat. The cabin murmur is many voices saying "हाँ". The voice is "almost known". A small hand pushes him out of the water. |

## Script (production file: `ep2a.script.txt`)

```text
[SCENE id=hook mood=suspense]
[SFX name=water_wade_cold]
[NARRATOR] मैं पानी में उतरा, और लगा जैसे किसी ने मेरी छाती पर हाथ रख दिया हो।
[NARRATOR] साँस तेज़ हो गई, पर घबराकर हवा खींचता तो डूब जाता, इसलिए मैं धीरे-धीरे साँस लेता रहा।
[SCENE id=wade mood=suspense]
[NARRATOR] तीन रात से मैं इसी किनारे से पुकार रहा था, छोटे, मैं यहीं हूँ, और आज रात नाव उसकी जैकेट लेकर लौटी थी।
[SCENE id=warm mood=suspense]
[SFX name=warm_water_hum]
[NARRATOR] पानी गर्म हो गया, मेरी कंपकंपी थम गई, और मुझे अच्छा लगा, जो दिसंबर की झील में हो ही नहीं सकता।
[SCENE id=cabin mood=suspense]
[SFX name=murmur_haan]
[NARRATOR] केबिन के पीछे भनभनाहट थी, पास जाकर समझ आया कि वह बहुत सारे लोगों का एक ही शब्द है, हाँ, हाँ, हाँ।
[NARRATOR] सीट की लाल जैकेट गर्म थी, और उसमें नारियल के तेल की वही महक थी जो मेरे भाई के बालों में रहती थी।
[SCENE id=relief mood=calm]
[NARRATOR] मुझे लगा कि वह ज़िंदा है, और मैं रो पड़ा।
[SILENCE dur=1.0]
[SFX name=name_in_water]
[CHARACTER] इधर आ जा, बहुत ठंड है, अंदर आ जा।
[NARRATOR] नाव ने मेरा पूरा नाम लिया, वह नाम जो सिर्फ़ माँ लेती थीं, और आवाज़ इतनी नरम थी कि मैं उसे लगभग पहचान गया।
[SCENE id=break mood=climax]
[NARRATOR] नाम पुकारे जाने पर जवाब देना सबसे पुरानी आदत है, और मैं उससे हार गया। हाँ, मैं यहीं हूँ।
[SCARE name=lights_out_grip]
[SCENE id=loop mood=suspense]
[NARRATOR] बत्ती बुझ गई, और पानी ने मेरी छाती को उसी हाथ की तरह जकड़ लिया।
[NARRATOR] तभी पीछे से एक छोटे हाथ ने मुझे किनारे की तरफ़ धकेल दिया।
[NARRATOR] आँख खुली तो मैं किनारे पर पड़ा था, भीगा हुआ, और नाव मेरे बगल में खड़ी थी।
```

## Timing estimate

| Line | Speaker | est. start | Text | words |
|---|---|---|---|---|
| L1 | NARRATOR |  0.0s | मैं पानी में उतरा, और लगा जैसे किसी ने मेरी छाती पर हाथ रख दिया हो। | 16 |
| L2 | NARRATOR |  5.9s | साँस तेज़ हो गई, पर घबराकर हवा खींचता तो डूब जाता, इसलिए मैं धीरे-धीरे साँस लेता रहा। | 17 |
| L3 | NARRATOR | 12.2s | तीन रात से मैं इसी किनारे से पुकार रहा था, छोटे, मैं यहीं हूँ, और आज रात नाव उसकी जैकेट लेकर लौटी थी। | 23 |
| L4 | NARRATOR | 20.7s | पानी गर्म हो गया, मेरी कंपकंपी थम गई, और मुझे अच्छा लगा, जो दिसंबर की झील में हो ही नहीं सकता। | 21 |
| L5 | NARRATOR | 28.5s | केबिन के पीछे भनभनाहट थी, पास जाकर समझ आया कि वह बहुत सारे लोगों का एक ही शब्द है, हाँ, हाँ, हाँ। | 22 |
| L6 | NARRATOR | 36.7s | सीट की लाल जैकेट गर्म थी, और उसमें नारियल के तेल की वही महक थी जो मेरे भाई के बालों में रहती थी। | 23 |
| L7 | NARRATOR | 45.2s | मुझे लगा कि वह ज़िंदा है, और मैं रो पड़ा। | 10 |
| — | SILENCE | 48.9s | (dead air 1.0s) |  |
| L8 | CHARACTER | 49.9s | इधर आ जा, बहुत ठंड है, अंदर आ जा। | 9 |
| L9 | NARRATOR | 53.2s | नाव ने मेरा पूरा नाम लिया, वह नाम जो सिर्फ़ माँ लेती थीं, और आवाज़ इतनी नरम थी कि मैं उसे लगभग पहचान गया। | 24 |
| L10 | NARRATOR | 62.1s | नाम पुकारे जाने पर जवाब देना सबसे पुरानी आदत है, और मैं उससे हार गया। हाँ, मैं यहीं हूँ। | 19 |
| L11 | NARRATOR | 69.1s | बत्ती बुझ गई, और पानी ने मेरी छाती को उसी हाथ की तरह जकड़ लिया। | 15 |
| L12 | NARRATOR | 74.7s | तभी पीछे से एक छोटे हाथ ने मुझे किनारे की तरफ़ धकेल दिया। | 13 |
| L13 | NARRATOR | 79.5s | आँख खुली तो मैं किनारे पर पड़ा था, भीगा हुआ, और नाव मेरे बगल में खड़ी थी। | 17 |

Estimated runtime ≈ **86 s** at 2.7 words/s (calibrated on aired ep1: about 150 words in 55 s). Real TTS decides; measure it at production.

**Trim ladder if the real VO runs over 88 s:** drop L5's clause "पास जाकर समझ आया कि" first, then L2's second half "इसलिए मैं धीरे-धीरे साँस लेता रहा". Never cut L1, L7, the silence, L10, L11 or L12.

## Shot list (camera, light, sound per shot)

Focal points stay inside x 60–900, y 270–1250 (caption lane owns the band below).

| Shot | Lines | Frame and action | Camera | Light | Sound | I |
|---|---|---|---|---|---|---|
| S1 | L1 | Waterline POV, waist-deep. He takes the first step in. The dry boat sits ~30 m out with its four-pane window lit. Ep1's red-jacket bow is at frame left. | Handheld at chest height. On the word "छाती" the frame dips 6 frames (cold shock), then recovers. Slow push-in over the whole shot. | Single motivated source: sodium-yellow cabin window. Faint cyan moon rim on the water. Mean luma ≈ 15/255. | Clipped gasp, water displacement, a sub thump on "हाथ". Wind off the lake. | 2 |
| S2 | L2 | Close on his sternum and two flat hands pressing it. Breath steam, ripples cut by the rhythm of his breathing. | Locked off, then a 3% creep. This is deliberate calm. | Rim light on his wet collar from the cabin. | A counted slow breath: 4 s in, 6 s out. A heartbeat under it, slightly fast. | 2 |
| S3 | L3 | Wide from behind. Three faint ghost exposures of the same silhouette on the shore (three nights), each with a lantern at a different height. | Slow dolly back, ghost layers cross-fade. | Cold moon, one lantern per ghost. | His own call, distant and late: "छोटे... मैं यहीं हूँ" three times, at −30 dB under the VO. The lake already stores this. | 2 |
| S4 | L4 | The warm ring: ~5 m out the chop stops at an exact circle. Inside it the surface is glassy and gives off thin steam. He steps across the line. | Over-shoulder follow. At the line his tremor stops: the camera shake drops to zero for a full second. | Steam lit amber from the cabin. His breath cloud vanishes as he crosses. | Wind cuts to silence at the line (a hard low-pass). A soft 110 Hz warm hum starts. His teeth stop chattering. | 3 |
| S5 | (L5 visual only) | The hull: a hand-wide black gap between the planks and the water. Ash from the lantern lifts and falls in time with air moving in and out. The boat breathes. | Low slow pan along the hull. | Hull lit from above, the gap pure black. | Slow breath in and out, one cycle per 5 s, under the hum. | 3 |
| S6 | L5 | The window. Glass fogged from inside. He leans in. The lamp flickers in step with each "हाँ" of the murmur. | Push-in on the glass, 80 cm over 5 s. | Lamp warm 2700 K, fog diffusion, no visible shapes inside. | The hum resolves into 12–20 whispers, all his own voice at different pitches, saying "हाँ" in a loose rhythm. | 3 |
| S7 | L6 | His hand on the red jacket on the bow seat. The nap of the fabric flattens as if someone just sat there. | Macro orbit of about 20°. | Lamp bounce, warm. | Fabric rustle, a tiny warm exhale from the collar. | 3 |
| S8 | L7 | His face. Tears. His breath finally settles. This is the only locked-off shot in the episode. | Static. | Soft cabin key, no rim. | Murmur drops out. Only breath. Then the SILENCE (1.0 s): the frame holds near-black, heartbeat stops. | 1 |
| S9 | L8–L9 | The window again. The lamp dims and swells with each word of the voice. No figure inside. | Slow push toward the glass. | Lamp only. | `name_in_water`: his own full name reversed under water, unintelligible. Then the voice: his VO pitched slightly up, 0.7 s pre-delay tail. | 4 |
| S10 | L10 → SCARE | Extreme close on his lips and breath. He says "हाँ, मैं यहीं हूँ." Hard cut to black as the lamp dies. | Static close-up, then cut. | Lamp dies over 6 frames. **Fade to black, never white.** | Voice dry. Stinger: sub drop plus a glass crack. A 4-frame chromatic spike. Pre-scare drop ≥ 20 dB. | 5 |
| S11 | L11 | Black water POV. Five pale finger-shaped pressure marks bloom across his chest and clamp. | Tight on the chest, bubbles rising. | None except the pale marks. | Muffled pressure thump, a slow squeeze. | 5 |
| S12 | L12 | A small wet palm lands on his right shoulder blade and shoves. | Whip forward with a speed ramp. | Dark. | Small hand slap, wet. Water rushing past. | 5 |
| S13 | L13 | The bank. Him face down, gasping. The boat nosing the mud beside him, window dark. In the glass a faint amber returns (the lamp relights itself). | Handheld on his back, push-in 3% over 4 s. | Moon only, then a trace of amber in the glass. | The lake breathing. A low loop tail. | 3 |

## Cards and caption

- Hook card (frame one): **"पानी में कदम। साँस पर ध्यान।"** (the old card, kept; it fits the shot).
- No choice card. No ask.
- IG caption (Hinglish, posted with ep2b): `Maine A chuna. Naav tak gaya. Aur us awaaz ko jawab de diya. 🌊\nEk baar poori dekho, aakhri 5 second mat chhodna 👀\nB chunne wale ka raasta alag tha, uska reel bhi aaj hi hai.\n#AakhiriNaav #HindiHorror #HorrorReels #DoomsdayHorror`
- Pinned comment: none on this one. Pin the vote count on ep1.

## Continuity and risks

- Ep1 gave the narrator numb hands from cold. S1–S4 keep the cold visible until the warm ring.
- The jacket is still **dry** here and **warm**. It is wet only at dawn (ep5).
- He never says his brother's name aloud in any episode. "छोटे" is a nickname and is allowed.
- Risk: the "warm water" clue is the one a viewer will question. S4 sells it with a visible ring and steam, not with words.
