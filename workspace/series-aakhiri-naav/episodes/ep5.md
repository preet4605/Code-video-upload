# ep5 — सुबह (finale; both paths rejoin; VOTE 3 opens Story 2)

**Format:** `interactive` (the fork is in the last line). **Path-neutral opening:** "सारी रात के बाद मैं घाट पर खड़ा था" is true for A (the boat set him down) and B (he walked down from the village).
**One-line pitch:** At dawn he finally understands what the last boat is: the lake's answer to *his own call*. Then something small and wet puts its hand in his.
**Scare pattern:** slow-burn reveal into a touch. The jump is tactile, a hand, not a sound.

## Story gate block

| Field | Content |
|---|---|
| part_question | What is the last boat, and who rows it? |
| part_payoff | "आख़िरी नाव को कोई नहीं चला रहा था, क्योंकि वह नाव नहीं, मेरी अपनी पुकार का जवाब थी।" |
| setup | Dawn at the dock. The boat is moored. The red jacket is wet. |
| clues (all before the twist) | C1 the knot is left-handed and he did not tie it. C2 the jacket was dry all night and is wet now. C3 rule three recapped in one line. C4 "तीन रात से मैं यहीं खड़ा होकर पुकारता था, लौट आ". C5 tonight the lake added a lamp and the jacket "आज बत्ती और जैकेट के साथ" (it learns what he wants). C6 the sleeve rises toward his hand. |
| escalation ×3 | the knot and the wet jacket; the rising sleeve; the realisation that the boat answers his call |
| false_relief | "मुझे लगा कि सब ख़त्म हो गया, और मैं हँस पड़ा।" after the sun, the clatter and the touch |
| silence | 1.0 s |
| twist (explains hook) | The series hook (the last boat comes back, nobody rowing) is explained: it is *his own call*, answered. |
| ending_image | A small wet hand in his left hand. In the low sun, a small shadow stands inside his shadow, in the way a boy once stepped in his footprints. The voice in his ear is his own, un-processed. |
| fork (Story 2 opener) | A: turn and look at it. B: do not look, walk it home. |
| callback | hook "सारी रात के बाद ... नाव वहाँ बँधी थी" returns as the answer to a call that was never rowed |
| rule status | **Rule three is tested and kept.** He waits for the first sun and the first human sound (a clatter of pots in the village). Before that, the boat is a call and a call will take a hand. |
| threat.planted_by | the left-handed knot, the wet jacket, and the childhood game (in the L9 line) come before the hand |
| new_facts | The boat is the lake's answer to his call. The lake learns what he wants. Dawn plus a human sound breaks the call's hold. The thing that came out has the brother's small hand and the narrator's voice. |

## Script (production file: `ep5.script.txt`)

```text
[SCENE id=hook mood=suspense]
[SFX name=dawn_wind_quiet]
[NARRATOR] सारी रात के बाद मैं घाट पर खड़ा था, और नाव वहाँ बँधी थी, जैसे कभी हिली ही न हो।
[NARRATOR] उसकी गाँठ मैंने नहीं बाँधी थी, और वह उलटे हाथ की थी, वैसी जैसी मेरा बाएँ हाथ वाला भाई बाँधता था।
[SCENE id=jacket mood=suspense]
[NARRATOR] सीट पर लाल जैकेट पड़ी थी, जो पूरी रात सूखी रही थी और अब भीगी थी, और उसकी आस्तीन धीरे-धीरे मेरी तरफ़ उठ रही थी।
[NARRATOR] गाँव की तीसरी बात याद थी, सुबह से पहले नाव को हाथ मत लगाओ, और आसमान अभी सलेटी था।
[SCENE id=wait mood=suspense]
[NARRATOR] तब समझ आया कि तीन रात से मैं यहीं खड़ा होकर पुकारता था, लौट आ, और झील मेरी पुकार को नाव बनाकर लौटा रही थी, आज बत्ती और जैकेट के साथ।
[NARRATOR] आख़िरी नाव को कोई नहीं चला रहा था, क्योंकि वह नाव नहीं, मेरी अपनी पुकार का जवाब थी।
[SCENE id=sun mood=calm]
[SFX name=steel_plate_clatter_far]
[NARRATOR] फिर पहली धूप उतरी, ऊपर किसी रसोई में बर्तन खनका, बत्ती बुझ गई, और छूने पर वह बस ठंडी, गीली जैकेट थी।
[NARRATOR] मुझे लगा कि सब ख़त्म हो गया, और मैं हँस पड़ा।
[SILENCE dur=1.0]
[SCARE name=wet_hand_in_mine]
[NARRATOR] तभी घाट की गीली लकड़ी पर छोटे पैरों के निशान उभरे, मेरे जूतों के ठीक बीच आकर रुके, जैसे बचपन में छोटा मेरे निशानों में पैर रखकर चलता था।
[SCENE id=loop mood=climax]
[NARRATOR] मेरे बाएँ हाथ में एक छोटा, ठंडा, भीगा हुआ हाथ आकर बैठ गया।
[CHARACTER] लौट आया, भैया।
[NARRATOR] वह मेरी ही आवाज़ थी, और अब मुझे तय करना था कि मैं मुड़कर उसे देखूँ या नहीं।
[NARRATOR] कमेंट करो, A या B?
```

## Timing estimate

| Line | Speaker | est. start | Text | words |
|---|---|---|---|---|
| L1 | NARRATOR |  0.0s | सारी रात के बाद मैं घाट पर खड़ा था, और नाव वहाँ बँधी थी, जैसे कभी हिली ही न हो। | 20 |
| L2 | NARRATOR |  7.4s | उसकी गाँठ मैंने नहीं बाँधी थी, और वह उलटे हाथ की थी, वैसी जैसी मेरा बाएँ हाथ वाला भाई बाँधता था। | 21 |
| L3 | NARRATOR | 15.2s | सीट पर लाल जैकेट पड़ी थी, जो पूरी रात सूखी रही थी और अब भीगी थी, और उसकी आस्तीन धीरे-धीरे मेरी तरफ़ उठ रही थी। | 25 |
| L4 | NARRATOR | 24.4s | गाँव की तीसरी बात याद थी, सुबह से पहले नाव को हाथ मत लगाओ, और आसमान अभी सलेटी था। | 19 |
| L5 | NARRATOR | 31.5s | तब समझ आया कि तीन रात से मैं यहीं खड़ा होकर पुकारता था, लौट आ, और झील मेरी पुकार को नाव बनाकर लौटा रही थी, आज बत्ती और जैकेट के साथ। | 31 |
| L6 | NARRATOR | 43.0s | आख़िरी नाव को कोई नहीं चला रहा था, क्योंकि वह नाव नहीं, मेरी अपनी पुकार का जवाब थी। | 18 |
| L7 | NARRATOR | 49.6s | फिर पहली धूप उतरी, ऊपर किसी रसोई में बर्तन खनका, बत्ती बुझ गई, और छूने पर वह बस ठंडी, गीली जैकेट थी। | 22 |
| L8 | NARRATOR | 57.8s | मुझे लगा कि सब ख़त्म हो गया, और मैं हँस पड़ा। | 11 |
| — | SILENCE | 61.9s | (dead air 1.0s) |  |
| L9 | NARRATOR | 62.9s | तभी घाट की गीली लकड़ी पर छोटे पैरों के निशान उभरे, मेरे जूतों के ठीक बीच आकर रुके, जैसे बचपन में छोटा मेरे निशानों में पैर रखकर चलता था। | 29 |
| L10 | NARRATOR | 73.6s | मेरे बाएँ हाथ में एक छोटा, ठंडा, भीगा हुआ हाथ आकर बैठ गया। | 13 |
| L11 | CHARACTER | 78.4s | लौट आया, भैया। | 3 |
| L12 | NARRATOR | 79.5s | वह मेरी ही आवाज़ थी, और अब मुझे तय करना था कि मैं मुड़कर उसे देखूँ या नहीं। | 18 |
| L13 | NARRATOR | 86.2s | कमेंट करो, A या B? | 5 |

Estimated runtime ≈ **88 s** at 2.7 words/s (calibrated on aired ep1: about 150 words in 55 s). Real TTS decides; measure it at production.

**Trim ladder if the real VO runs over 88 s:** cut "वैसी जैसी मेरा बाएँ हाथ वाला भाई बाँधता था" from L2 (ep3 already planted the left hand), then drop "जो पूरी रात सूखी रही थी और" from L3. Never cut L5, L6, the silence, L9, L10, L11, L12.

**Sound reveal (this is the trick):** every "lake voice" in this series is the narrator's own VO, processed. L11 (`लौट आया, भैया।`) is the **same voice with every effect removed**: dry, close, no pre-delay. The audience hears that the kind voice was the narrator all along, matching L12 "वह मेरी ही आवाज़ थी".

## Shot list

| Shot | Lines | Frame and action | Camera | Light | Sound | I |
|---|---|---|---|---|---|---|
| S1 | L1 | Dawn. Mist on the water. The dock boards are wet. The boat sits tied to the post as if painted there, no wake, no ripple against the hull. | Slow forward tracking along the dock from his POV. | Ash-grey dawn. No amber. The cabin window is lit, tiny and yellow. | Wind drops to nothing. A single rope creak. | 2 |
| S2 | L2 | Macro on the knot: a thick wet rope, a reversed loop. His thumb traces it. | Macro push. | Grey, soft. | Wet rope fibre. His breath. | 3 |
| S3 | L3 | The red jacket on the bow seat, soaked, dark red. Drips fall from the cuffs. One sleeve lifts a few centimetres toward him, then waits. | Slow push to the sleeve. | Cold light on the wet cloth. | Dripping. A very faint exhale from the collar. | 4 |
| S4 | L4 | His hand stops a hand's-breadth from the jacket. His wrist trembles. The sky above the hills is a flat slate. | Low angle past his hand to the sky. | Flat dawn, a thin cold line on the horizon. | His breath. Silence. | 3 |
| S5 | L5 | Three ghost exposures of him on the shore, three nights, mouth open: "छोटे, लौट आ". Behind each one, a boat: dark and empty on nights one and two, lit and carrying the jacket tonight. | Slow lateral dolly through the ghost layers. | Moon blue for the ghosts, amber only on tonight's boat. | His own old calls, layered, each one answered a beat late by a creak. | 4 |
| S6 | L6 | He says the word "लौट आ" under his breath. The lake answers: concentric rings spread from the dock, and the boat's lamp pulses in time. The rings are the shape of his voice. | Top-down over the water, slow push. | The lamp pulses 2700 K, rings pale. | His whisper, then a ring of sound answering it from the hull. | 5 |
| S7 | L7 | The first sun hits the hills. Far above in the village, a plate clatters in a kitchen. The lamp dies. He touches the jacket and it is only cold wet cloth. | Cut to the sun striking the hull, then a close-up of his hand on the cloth. | A warm shaft of real sun for the first time in the series. | The clatter. Birdsong, a first one. The lamp's hum cuts. | 2 |
| S8 | L8 | He laughs and wipes his face. His shoulders drop. | Static medium. | Warm sun on one cheek. | A relieved breath. Birdsong rises. Then SILENCE (1.0 s). | 1 |
| S9 | SILENCE | The empty dock, wet boards. | Static wide. | Sun on the boards. | 1.0 s of room tone. The pre-scare drop is ≥ 20 dB. | 1 |
| S10 | L9 → SCARE | Small wet footprints appear one by one on the boards, coming from the water toward him. The last one lands inside the sole of his own wet print. | Locked on his shoes. | Low sun, raking. | A wet, small step. Another. A third. Stinger: a low swell and a small, very close wet *pat*. | 5 |
| S11 | L10 | His left hand. A small, cold, wet hand slides into it. His fingers jerk, then do not pull away. | Macro on the two hands, a slow push. | Sun on wet skin. | Water drips. His breath hitches. | 5 |
| S12 | L11–L12 | His face. He does not turn. His eyes slide sideways. A voice at his shoulder, dry and clean: "लौट आया, भैया." | Slow push-in on his face. | Sun on his cheek, a small shadow across his left shoulder. | The voice is **unprocessed**: the narrator's own TTS with no effect. The bed drops out under it. | 5 |
| S13 | L13 | His long shadow across the dock. A small shadow stands inside it, standing in its footprint. The vote cards fade in: "A मुड़कर देखो · B बिना देखे चलो". | Static wide from the front, a very slow push. | Low sun behind them. | The last line is dry. A low drone and a single bird. | 4 |

## Cards and caption

- Hook card (frame one): **"सुबह हो गई। जैकेट भीगी है।"** (the old card, kept.)
- Choice card: **A मुड़कर देखो · B बिना देखे चलो.** Placeholder labels; Love confirms before posting (the old bible had "नाव में लौटो · झील पार करो"; these new ones follow from the ending).
- Last spoken line: `कमेंट करो, A या B?` exactly.
- IG caption: `Subah ho gayi. Jacket geeli thi. Aur mere haath mein ek chhota, thanda haath aa baitha. 🖐️\nAakhri naav ko koi nahi chala raha tha. Woh meri hi pukaar ka jawab thi.\nA: Mudkar dekho.\nB: Bina dekhe chalo.\nComment karo A ya B. Jo jeetega, wahi se Story 2 shuru hogi. 👇\n#AakhiriNaav #HindiHorror #HorrorReels #DoomsdayHorror`
- Pinned comment: `A = Mudkar dekho (Story 2, ep1a). B = Bina dekhe chalo (Story 2, ep1b). Comment karo A ya B. Tie ho toh jis ki ask pehle post hui woh jeetegi: A. Count yahan update hoga.`

## Continuity and risks

- The jacket must be **dark and soaked** here and dry in ep1 and ep4a. Match the ep1 red.
- The sun is the only warm natural light in the series. Do not use it earlier.
- The thing's identity is never confirmed: small hand, narrator's voice, a small shadow in his shadow. Story 2 owns the answer.
- Risk: "the boat was my own call" is an abstraction. S5–S6 must show it as a picture (the ripples are the waveform of his voice), not tell it.
