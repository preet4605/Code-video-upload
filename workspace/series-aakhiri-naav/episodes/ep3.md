# ep3 — भीगा किनारा (both paths rejoin; VOTE 2)

**Format:** `interactive` (the fork is in the last line). **Opens true on both paths:** he is on the bank, wet, with the boat beside him and a small wet handprint on his right shoulder blade. In A the hand shoved him out of the grip. In B the wave carried him with many small hands. Both leave the same mark.
**One-line pitch:** His body is shutting down on the shore while a phone rings *under the lake* and a child's hand holds it up, waving.
**Scare pattern:** hope-then-removal. A light that signals for help is taken away. No creature.

## Story gate block

| Field | Content |
|---|---|
| part_question | Whose small hand pushed him out of the water? |
| part_payoff | "वह हाथ उतना ही छोटा था जितना मेरे कंधे का निशान, यानी उसी ने मुझे बचाया था, और अब वह डूब रहा था।" |
| setup | Bank, deep night, soaked, boat beside him. |
| clues planted | C1 the handprint on his shoulder (L1). C2 the brother's ringtone, set on his birthday (L2). C3 "मेरा भाई हर चीज़ बाएँ से पकड़ता था" (left-handed; pays off in the ep5 knot and ep2b's left lean). C4 "काँपना बंद होना बुरी निशानी है". C5 **rule two set:** "अकेले झील पार मत करना, क्योंकि झील अकेले आदमी को अपना साथी दे देती है" (pays off in ep4a). |
| escalation ×3 | a green light and the ringtone under the water; a small left hand lifts the phone and signals; his own shivering stops and he starts unbuttoning |
| false_relief | "नाव की पीली बत्ती मेरे चेहरे पर पड़ी, घर के बल्ब जितनी गुनगुनी, और मुझे लगा कि सब ठीक हो जाएगा।" |
| silence | 1.0 s |
| twist (explains hook) | The hook's handprint is the brother's. He is not gone, he is *under there*, and he saved the narrator. |
| ending_image | The light sinks with the hand. The boat's lamp stays on, warm. |
| fork | A: board the boat and go to him. B: run uphill for the village. |
| callback | hook "कंधे पर ... हाथ का निशान" returns as "जितना मेरे कंधे का निशान" |
| rule status | **Rule two is set here.** It is also the cost of A: crossing alone. |
| threat.planted_by | the ringtone and the green light come before the hand |
| new_facts | Handprint on the right shoulder blade. The brother is left-handed. Brother's phone rings under the lake. Rule two. |

**Branch promise (`branches.md`):**
- **A (board):** setup: the cabin is warm and the phone-hand is mid-lake. Escalation: the cabin copies his home and answers questions he did not ask. Payoff: the oars move because his own reflection rows. Dread: companionship that is a trap, and loss of self.
- **B (run):** setup: the road is uphill, his clothes are heavy, the lake is behind him. Escalation: footsteps that step in his footprints, a locked house, his own voice at his mother's door. Payoff: the village will not open to a voice that matches the lake's. Dread: being unrecognisable to those he loves.

## Script (production file: `ep3.script.txt`)

```text
[SCENE id=hook mood=suspense]
[SFX name=shiver_breath]
[NARRATOR] मैं किनारे पर पड़ा था, भीगा हुआ, और मेरे दाएँ कंधे पर किसी बच्चे के हाथ का गीला निशान छपा था।
[SCENE id=phone mood=suspense]
[SFX name=underwater_ringtone]
[NARRATOR] तभी झील के बीच, पानी के अंदर, एक हरी रोशनी उठी, और छोटे के फ़ोन की वही घंटी बजी जो मैंने उसके जन्मदिन पर लगाई थी।
[NARRATOR] तीन रात में मैंने उस नंबर पर सैकड़ों बार फ़ोन मिलाया था, और आज उसकी घंटी बजी।
[SCENE id=hand mood=suspense]
[NARRATOR] रोशनी सतह के पास आई, तो उसे एक छोटा सफ़ेद हाथ उठाए था, बायाँ हाथ, क्योंकि मेरा भाई हर चीज़ बाएँ से पकड़ता था।
[NARRATOR] वह उसे दाएँ-बाएँ हिला रहा था, जैसे कोई डूबता हुआ मदद के लिए इशारा करे।
[SCENE id=cold mood=suspense]
[NARRATOR] उसी पल मेरी कंपकंपी रुक गई, और मैं कमीज़ के बटन खोलने लगा, जबकि मैं जानता था कि काँपना बंद होना बुरी निशानी है।
[SCENE id=rule mood=suspense]
[NARRATOR] तभी माँ की बात याद आई, कि अकेले झील पार मत करना, क्योंकि झील अकेले आदमी को अपना साथी दे देती है।
[SCENE id=relief mood=calm]
[NARRATOR] नाव की पीली बत्ती मेरे चेहरे पर पड़ी, घर के बल्ब जितनी गुनगुनी, और मुझे लगा कि सब ठीक हो जाएगा।
[SILENCE dur=1.0]
[SCARE name=phone_light_sinks]
[NARRATOR] फिर हाथ ने फ़ोन हिलाना बंद कर दिया, घंटी थम गई, और रोशनी उसी हाथ के साथ नीचे डूबने लगी।
[SCENE id=choice mood=climax]
[NARRATOR] वह हाथ उतना ही छोटा था जितना मेरे कंधे का निशान, यानी उसी ने मुझे बचाया था, और अब वह डूब रहा था।
[NARRATOR] मेरे पास दो रास्ते थे, नाव में चढ़कर उसके पास जाना, या गाँव भागकर मदद लाना, और वक़्त दोनों के लिए नहीं था।
[NARRATOR] कमेंट करो, A या B?
```

## Timing estimate

| Line | Speaker | est. start | Text | words |
|---|---|---|---|---|
| L1 | NARRATOR |  0.0s | मैं किनारे पर पड़ा था, भीगा हुआ, और मेरे दाएँ कंधे पर किसी बच्चे के हाथ का गीला निशान छपा था। | 21 |
| L2 | NARRATOR |  7.8s | तभी झील के बीच, पानी के अंदर, एक हरी रोशनी उठी, और छोटे के फ़ोन की वही घंटी बजी जो मैंने उसके जन्मदिन पर लगाई थी। | 26 |
| L3 | NARRATOR | 17.4s | तीन रात में मैंने उस नंबर पर सैकड़ों बार फ़ोन मिलाया था, और आज उसकी घंटी बजी। | 17 |
| L4 | NARRATOR | 23.7s | रोशनी सतह के पास आई, तो उसे एक छोटा सफ़ेद हाथ उठाए था, बायाँ हाथ, क्योंकि मेरा भाई हर चीज़ बाएँ से पकड़ता था। | 24 |
| L5 | NARRATOR | 32.6s | वह उसे दाएँ-बाएँ हिला रहा था, जैसे कोई डूबता हुआ मदद के लिए इशारा करे। | 15 |
| L6 | NARRATOR | 38.1s | उसी पल मेरी कंपकंपी रुक गई, और मैं कमीज़ के बटन खोलने लगा, जबकि मैं जानता था कि काँपना बंद होना बुरी निशानी है। | 24 |
| L7 | NARRATOR | 47.0s | तभी माँ की बात याद आई, कि अकेले झील पार मत करना, क्योंकि झील अकेले आदमी को अपना साथी दे देती है। | 22 |
| L8 | NARRATOR | 55.2s | नाव की पीली बत्ती मेरे चेहरे पर पड़ी, घर के बल्ब जितनी गुनगुनी, और मुझे लगा कि सब ठीक हो जाएगा। | 21 |
| — | SILENCE | 63.0s | (dead air 1.0s) |  |
| L9 | NARRATOR | 64.0s | फिर हाथ ने फ़ोन हिलाना बंद कर दिया, घंटी थम गई, और रोशनी उसी हाथ के साथ नीचे डूबने लगी। | 20 |
| L10 | NARRATOR | 71.4s | वह हाथ उतना ही छोटा था जितना मेरे कंधे का निशान, यानी उसी ने मुझे बचाया था, और अब वह डूब रहा था। | 23 |
| L11 | NARRATOR | 79.9s | मेरे पास दो रास्ते थे, नाव में चढ़कर उसके पास जाना, या गाँव भागकर मदद लाना, और वक़्त दोनों के लिए नहीं था। | 23 |
| L12 | NARRATOR | 88.4s | कमेंट करो, A या B? | 5 |

Estimated runtime ≈ **90 s** at 2.7 words/s (calibrated on aired ep1: about 150 words in 55 s). Real TTS decides; measure it at production.

**Trim ladder if the real VO runs over 88 s:** drop the clause "जबकि मैं जानता था कि काँपना बंद होना बुरी निशानी है" from L6, then "घर के बल्ब जितनी गुनगुनी" from L8. Never cut L1, L4, L7, L10, L11.

## Shot list

| Shot | Lines | Frame and action | Camera | Light | Sound | I |
|---|---|---|---|---|---|---|
| S1 | L1 | Face down on wet mud, then rolling onto his back. On his right shoulder blade, through the sodden shirt, the dark print of a small hand: four short fingers and a thumb. | Handheld macro on the print, then a pull to his face. | Moon, cold blue, no amber. | Chattering teeth, laboured breathing, lake lap. Wind off the water, faint. | 2 |
| S2 | L2 | The lake centre. A green point rises slowly through the black water like a slow bubble. | Static long lens, a 2% creep. | The green glow is the only light in the water. | A muffled, specific ringtone from below the surface. It is a cheap birthday-song loop. | 3 |
| S3 | L3 | His hand in the mud holds his own dead phone, black. Cut to the phone's cracked screen reflecting the green light. | Insert close-up. | Green on glass. | The ringtone sharpens. His own breath catches. | 3 |
| S4 | L4 | The green light breaks the surface held by a small white hand at the end of a thin forearm. It is the left hand. A cricket sticker on the phone case. | Slow push-in on the hand. | Green up-light on the wrist, wet shine. | Water dripping off the phone case. The ringtone loud now. | 4 |
| S5 | L5 | The hand swings the light left, right, left, right. Slow, exact, tired. | Locked, a long lens. | Green sweeps across the water. The beam does not reach him. | The arm's strokes in the water. A shaky breath with every swing. | 4 |
| S6 | L6 | His fingers fumble at a shirt button. His hands stop shaking. Then he stops shivering. He pulls the shirt open. | Close on the hands, then a pull to his chest. | Cold. His skin turns waxy in the green. | The chatter of teeth stops. Silence in the chest. A slow heart. | 4 |
| S7 | L7 | A memory insert: a kitchen, steel cups, a mother's back at the stove, two boys' shadows in a doorway. Her hand lifts a warning finger. The brother reaches for the older one's hand. | Soft handheld, warm, slightly overexposed. | Warm kitchen bulb, 2700 K, the same as the cabin lamp. | Her voice, dry and close, but only as a murmur under the VO. Stove tick. | 2 |
| S8 | L8 | The boat's window lights him from the left. His face softens. Steam from the cabin vent curls over him. | Slow push on his face. | Warm light, the only amber in the shot. | A faint kettle tone from the cabin. A gentle inhale. | 1 |
| S9 | SILENCE | He looks up. The green light is still held out. | Static. | Green and amber balance. | Room tone only. The pre-scare drop is ≥ 20 dB. | 1 |
| S10 | L9 → SCARE | The hand stops mid-swing. The ringtone cuts. The light starts to sink as the hand sinks. | A very slow tilt-down following it. | The green dims to nothing. | Ringtone cut. Stinger: a low swell and the sound of an arm slipping under water. | 5 |
| S11 | L10 | Back to the print on his shoulder, then to the sinking hand, matched in size. | Match cut between the two. | Blue, with the last of the green. | A held breath. | 3 |
| S12 | L11 | Split view: left, the boat's lit window; right, the dark slope up to the village with no light. He is in the middle. | Locked wide, then a slow push toward his face. | Amber on the left, cold black on the right. | The cabin's warm hum on one side, the wind on the other. | 4 |
| S13 | L12 → ask | Hold on his face as the vote cards fade in: "A नाव में चढ़ो · B गाँव भागो". | Static, a slow breathing creep. | Soft key. | Last spoken line is dry. The bed rises into the loop tail. | 2 |

## Cards and caption

- Hook card (frame one): **"भीगे कपड़े। कंधे पर छोटा हाथ।"** (new; the old card "रुकती हुई कंपकंपी" is moved to S6 as a mid-card.)
- Choice card: **A नाव में चढ़ो · B गाँव भागो**. The words A and B are Latin on screen and in speech.
- Last spoken line: `कमेंट करो, A या B?` — exactly this, no rewording.
- IG caption: `Kinare par pada tha. Kandhe par kisi bachche ke haath ka geela nishaan. 🖐️\nPaani ke neeche se ek phone baj raha tha. Ek chhota haath use hila raha tha.\nA: Naav mein chadho, uske paas jao.\nB: Gaon bhaago, madad lao.\nComment karo A ya B. 24 ghante mein jo jeetega, wahi agla reel. 👇\n#AakhiriNaav #HindiHorror #HorrorReels #DoomsdayHorror`
- Pinned comment (ONE comment, count + both links + the tie rule): `A = Naav mein chadho (ep4a). B = Gaon bhaago (ep4b). Vote A ya B comment karo. Tie hone par jis ka reel pehle post hua woh jeetega: A. Count yahan update hoga.` Update the count by editing the comment.

## Continuity and risks

- The brother's cricket sticker on the phone case is new canon; ep5 does not need it, but keep it so the phone is identifiable.
- Ep3 does not use the boat's hull. He never touches the boat before dawn (rule three stays untested until ep5).
- Risk: viewers may choose B in large numbers (it is the sensible option). Both are pre-produced, so the vote only decides publish order, not what exists.
- The paradoxical-undressing beat (S6) is a documented hypothermia behaviour; the "feeling light" is a character perception, not a medical claim.
