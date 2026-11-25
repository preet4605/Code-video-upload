# ep4a — दो प्याले (Branch A: inside the boat)

**Format:** `serial` part (no vote; rejoins at ep5). **Publish:** same day as ep4b, ep4a first. **Look:** the one warm, safe-looking episode. Everything is amber and tender. The horror is that it is *accurate*.
**One-line pitch:** The boat's cabin is his mother's kitchen, built from his memory with small mistakes. The warm companion in the second chair is a red jacket with nobody in it, and the "oars that move by themselves" are being pulled by his own reflection.
**Scare pattern:** domestic uncanny, then a reflection reveal. No jump on the visual. The jolt is the shore sliding away.

## Story gate block

| Field | Content |
|---|---|
| part_question | Is it safe inside, and what is the "someone" the boat has set a cup for? |
| part_payoff | "झील ने मुझे साथी दे दिया था, और वह साथी मैं ही था; इसीलिए नाव को कोई चलाता नहीं दिखता था।" |
| setup | He climbs aboard because his body needs the heat and the hand is out there. |
| clues planted | C1 mother's saying from ep3: "झील अकेले आदमी को अपना साथी दे देती है". C2 the handle on the wrong side of the door. C3 two cups, one handle broken exactly like his own. C4 the jacket sits and breathes. C5 "वह मेरी गूँज नहीं थी, वह मेरे सवाल का बनाया हुआ जवाब था" (the cabin composes answers). |
| escalation ×3 | the cabin is a copy of his home with errors; the jacket is seated opposite and breathing; the cabin answers a question in a voice he did not give it |
| false_relief | "माँ की बात के उलट, मैं अकेला नहीं था।" (the rule says he should be alone; the lake has fixed that) |
| silence | 1.0 s |
| twist (explains hook) | The "companion" is his own reflection, rowing the boat from the water. This explains the series hook: **नाव को कोई चलाता नहीं दिखता** because the rower is in the reflection. |
| ending_image | The chair is empty. The second cup is upside down. Wet footsteps on the deck behind him. |
| new question (cliff) | "डेक पर मेरे पीछे गीले पैरों की आहट थी।" Who is on the deck? (answered in ep5 by the small wet prints) |
| callback | hook "गर्मी ... उँगलियाँ दर्द से जलने लगीं" returns as the tea in his hands |
| rule status | **Rule two broken.** He is on the lake with no one but the lake's company. |
| threat.planted_by | rule two plant in ep3 and the wrong handle come before the jacket moves |
| new_facts | The cabin is a memory copy of the kitchen. The cabin answers with composed words. The oars are pulled by his reflection. |

**Explain-it-once note:** ep4a explains *the oars* (his reflection pulls them). Ep5 explains *the boat* (it is the lake's answer to his call). They are two layers, not two contradictory answers. ep4a is mechanism, ep5 is meaning.

## Script (production file: `ep4a.script.txt`)

```text
[SCENE id=hook mood=suspense]
[SFX name=cabin_warm_tone]
[NARRATOR] मैं नाव में चढ़ा, और अंदर इतनी गर्मी थी कि मेरी जमी उँगलियाँ दर्द से जलने लगीं।
[SCENE id=kitchen mood=suspense]
[NARRATOR] वह केबिन नहीं, हमारे घर की रसोई थी, वही पीली बत्ती, वही स्टील की थाली, बस दरवाज़े का हैंडल उलटी तरफ़ था।
[NARRATOR] मेज़ पर दो प्याले थे, दोनों से भाप उठ रही थी, और एक का हैंडल वहीं से टूटा था जहाँ मेरे प्याले का टूटा है।
[SCENE id=jacket mood=suspense]
[NARRATOR] सामने की कुर्सी पर लाल जैकेट बैठी थी, आस्तीनें मेज़ पर टिकी थीं, और कॉलर में कोई नहीं था, फिर भी वह साँस ले रही थी।
[NARRATOR] मैंने काँपती आवाज़ में पूछा, तू ठीक है न?
[CHARACTER] ठीक हूँ, भैया।
[NARRATOR] वह मेरी गूँज नहीं थी, वह मेरे सवाल का बनाया हुआ जवाब था।
[SCENE id=relief mood=calm]
[NARRATOR] फिर भी मैंने चाय का घूँट लिया, क्योंकि उसमें माँ के हाथ की अदरक थी, और माँ की बात के उलट, मैं अकेला नहीं था।
[SILENCE dur=1.0]
[SFX name=oars_creak_slow]
[SCARE name=shore_slides_away]
[NARRATOR] खिड़की के बाहर चप्पू चरमराए, और किनारा पीछे फिसलने लगा।
[SCENE id=reflection mood=climax]
[NARRATOR] मैंने नीचे पानी में नाव का प्रतिबिंब देखा, और उसमें चप्पू मेरे हाथों में थे, मैं पसीने में डूबा उन्हें खींच रहा था।
[NARRATOR] झील ने मुझे साथी दे दिया था, और वह साथी मैं ही था; इसीलिए नाव को कोई चलाता नहीं दिखता था।
[SCENE id=loop mood=suspense]
[NARRATOR] मैं मुड़ा, तो कुर्सी ख़ाली थी, दूसरा प्याला उलटा पड़ा था, और डेक पर मेरे पीछे गीले पैरों की आहट थी।
```

## Timing estimate

| Line | Speaker | est. start | Text | words |
|---|---|---|---|---|
| L1 | NARRATOR |  0.0s | मैं नाव में चढ़ा, और अंदर इतनी गर्मी थी कि मेरी जमी उँगलियाँ दर्द से जलने लगीं। | 17 |
| L2 | NARRATOR |  6.3s | वह केबिन नहीं, हमारे घर की रसोई थी, वही पीली बत्ती, वही स्टील की थाली, बस दरवाज़े का हैंडल उलटी तरफ़ था। | 22 |
| L3 | NARRATOR | 14.4s | मेज़ पर दो प्याले थे, दोनों से भाप उठ रही थी, और एक का हैंडल वहीं से टूटा था जहाँ मेरे प्याले का टूटा है। | 25 |
| L4 | NARRATOR | 23.7s | सामने की कुर्सी पर लाल जैकेट बैठी थी, आस्तीनें मेज़ पर टिकी थीं, और कॉलर में कोई नहीं था, फिर भी वह साँस ले रही थी। | 26 |
| L5 | NARRATOR | 33.3s | मैंने काँपती आवाज़ में पूछा, तू ठीक है न? | 9 |
| L6 | CHARACTER | 36.7s | ठीक हूँ, भैया। | 3 |
| L7 | NARRATOR | 37.8s | वह मेरी गूँज नहीं थी, वह मेरे सवाल का बनाया हुआ जवाब था। | 13 |
| L8 | NARRATOR | 42.6s | फिर भी मैंने चाय का घूँट लिया, क्योंकि उसमें माँ के हाथ की अदरक थी, और माँ की बात के उलट, मैं अकेला नहीं था। | 25 |
| — | SILENCE | 51.9s | (dead air 1.0s) |  |
| L9 | NARRATOR | 52.9s | खिड़की के बाहर चप्पू चरमराए, और किनारा पीछे फिसलने लगा। | 10 |
| L10 | NARRATOR | 56.6s | मैंने नीचे पानी में नाव का प्रतिबिंब देखा, और उसमें चप्पू मेरे हाथों में थे, मैं पसीने में डूबा उन्हें खींच रहा था। | 23 |
| L11 | NARRATOR | 65.1s | झील ने मुझे साथी दे दिया था, और वह साथी मैं ही था; इसीलिए नाव को कोई चलाता नहीं दिखता था। | 21 |
| L12 | NARRATOR | 72.9s | मैं मुड़ा, तो कुर्सी ख़ाली थी, दूसरा प्याला उलटा पड़ा था, और डेक पर मेरे पीछे गीले पैरों की आहट थी। | 21 |

Estimated runtime ≈ **81 s** at 2.7 words/s (calibrated on aired ep1: about 150 words in 55 s). Real TTS decides; measure it at production.

**Trim ladder if the real VO runs over 88 s:** cut "वही स्टील की थाली" from L2, then "आस्तीनें मेज़ पर टिकी थीं" from L4. Keep L7, L8, the silence, L10 and L11.

## Shot list

| Shot | Lines | Frame and action | Camera | Light | Sound | I |
|---|---|---|---|---|---|---|
| S1 | L1 | He hauls himself over the gunwale and falls into the cabin. His blue, numb fingers on a steel stove. | Handheld, close, a shaky first beat then calm. | Amber heat, the first warm light on his face. The wrong-colour shadow of the window on the wall. | His breath. Fingers cracking as they thaw. A kettle tone. | 2 |
| S2 | L2 | A slow reveal of the cabin as his kitchen: the yellow bulb, steel plates on a rack, the calendar. The door handle is on the wrong side. | Slow lateral dolly, then a stop on the handle. | Warm 2700 K bulb, soft shadows. | A fridge hum that should not be here. Clock ticking, slightly off tempo. | 2 |
| S3 | L3 | The table: two steel cups, steam. One handle is snapped in a specific place. He looks at his own hand: his own cup at home has the same break. | Top-down on the table, then a push on the broken handle. | Warm key, steam backlit. | The soft clink of a cup. Steam hiss. | 3 |
| S4 | L4 | The opposite chair: the red jacket sits upright, sleeves on the table. The collar is empty. It breathes: the shoulders lift and fall. | Slow push-in from his POV, 2% over 6 s. | Lamp warm, soft shadow in the collar (pure black inside). | Cloth breathing. A tiny wet click in the collar. | 4 |
| S5 | L5–L6 | He asks. The jacket's collar leans toward him. "ठीक हूँ, भैया" comes back from the cabin walls, not the collar. | Medium two-shot: him and the jacket across the table. | Warm, still. | `[CHARACTER]` his own VO raised 5 semitones (child-like), a 0.7 s tail from the walls. | 4 |
| S6 | L7 | He realises. His eyes go to the walls: the wood grain pulses once, like a throat. | Tight on his face, then a slow rack to the wall. | Warm, unchanged. | Silence on the narration. A single low note under the voice. | 4 |
| S7 | L8 | He drinks. Ginger. Steam fogs his face. He lets his shoulders drop. The only still-frame beat of the episode. | Static close-up. | Soft, warm, the best light of the series. | Everything quiets. Then the SILENCE (1.0 s). The kettle stops. | 1 |
| S8 | SILENCE | He sits, cup in hand, eyes closed. | Static. | Warm. | 1.0 s of room tone. A tiny crack of wood. | 1 |
| S9 | L9 → SCARE | The oars creak outside. The cabin window slides: the shore dock lantern is moving away. | A slow lateral drift along with the window, then a snap-focus to the lantern shrinking. | The lantern is pulled to a pinpoint. | Slow oar creak. Stinger: a low swell and the *click* of an oar slipping into its lock. | 5 |
| S10 | L10 | Over the side, the water: the boat's reflection. In it, the cabin window shows him seated. On the oar bench, a second man rows hard, face to the shore, sweat running down his neck: it is him. | Top-down on the water, the boat's reflection fills the frame. | The lamp's amber streak across the water; the reflection's rower in cold blue. | The creak is on every pull of the reflection's oars. A slow, tired breath. | 5 |
| S11 | L11 | Cut inside: the cup in his hand. The tea trembles in time with the rower's pull. | Macro of the surface of the tea. | Warm. | Each pull a ring in the tea. | 4 |
| S12 | L12 | He turns. The chair is empty. The second cup lies on its side, the tea still running off the table. Behind him, on the deck outside the door, a wet footprint appears, then another, small. | Slow whip-pan to the empty chair, then to the door. | Warm cabin; the deck outside is dark. | A wet step on wood. A second. A third, nearer. | 5 |

## Cards and caption

- Hook card: **"दो प्याले। एक मेहमान।"** (the old card, kept.)
- No choice card. No ask.
- IG caption (Hinglish, with ep4b): `A: Naav mein chadha. Andar bahut garmi thi. Do pyaale chai ke. ☕\nAur samne ki kursi par ek jacket baithi thi, jisme koi nahi tha.\nEk baar poori dekho, aakhri 5 second mat chhodna 👀\nB wala reel bhi aaj hi hai.\n#AakhiriNaav #HindiHorror #HorrorReels #DoomsdayHorror`

## Continuity and risks

- The red jacket is dry here. In ep5 it is wet on the bow seat: the boat has come home between ep4a and ep5. Do not show the jacket wet in this episode.
- The wet footprints at the end belong to the brother's feet, per the ep5 payoff. Keep them small.
- Risk: S10 relies on a reflection that moves differently from the real boat. Render the reflection as a second pass with the narrator at the oar bench. If it cannot be done cleanly, fall back to a reflection of the *window* only: the reflected cabin shows him at the oars.
