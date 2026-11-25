# ep2b — पानी पर (Branch B: stay on the shore)

**Format:** `serial` part (no vote; rejoins at ep3). **Publish:** same day as ep2a, ep2a first (tie rule). **Look:** night blue, glass-black water, the boat's lantern as the only light.
**One-line pitch:** Keeping the rule is not enough. Something walks to him *under* the lake, and when he stays silent, the lake answers in his voice.
**Scare pattern:** visual uncanny (a figure inverted under the surface), then the borrowed-voice answer.

## Story gate block

| Field | Content |
|---|---|
| part_question | What is walking toward him across the water? |
| part_payoff | It is walking under the surface, upside down: "वह पानी पर नहीं, पानी के नीचे चल रहा है, उल्टा, सिर गहराई में लटका हुआ।" |
| setup | He stays on the shore at dusk's end. The boat sits beside the bank with its lit window. |
| clues planted | C1 "छोटे, मैं यहीं हूँ" (his own call words). C2 "कोई लहर नहीं उठ रही थी". C3 "वह हर क़दम थोड़ा बाईं तरफ़ झुकाकर रखता था, ठीक मेरे छोटे भाई की तरह". C4 "आवाज़ कहीं और से आती थी" (lips and voice do not match). C5 rule one remembered: "गाँव का पहला नियम याद था". |
| escalation ×3 | the walker with the brother's lean and no ripples; the name called from the water; the face under the surface at his feet |
| false_relief | "मुझे लगा कि मैं जीत गया।" |
| silence | 1.0 s |
| twist (explains hook) | The hook says "सीधा चलकर" across the water. It was upside down beneath it. The second twist, which is the scare: "मैंने एक शब्द नहीं कहा था, पर झील से मेरी अपनी आवाज़ ने जवाब दे दिया।" |
| ending_image | A wave with no wind soaks him to the chest and shoves him up the bank, like many small hands. |
| new question (cliff) | "झील के पास मेरी आवाज़ है, और ... वह उससे किसे बुलाएगी।" |
| callback | hook "मेरी तरफ़ आने लगा" returns as the lake's answer coming *to him* |
| rule status | **Rule one is kept, and it does not save him.** The lake answers for him. In ep2a, the A viewers' narrator says exactly these words ("हाँ, मैं यहीं हूँ"). Viewers who watch both see the lake already knew what he would say. That is deliberate. |
| threat.planted_by | no ripples and the left lean come before the face |
| new_facts for bible | The walker is under the water and inverted. The voice's lips do not match its sound. The lake can answer in his voice. Small hands shove him out. |

## Script (production file: `ep2b.script.txt`)

```text
[SCENE id=hook mood=suspense]
[SFX name=lake_still_night]
[NARRATOR] मैं किनारे पर रुका रहा, और काले पानी के उस पार से कोई सीधा चलकर मेरी तरफ़ आने लगा।
[NARRATOR] तीन रात से मैं इसी जगह खड़ा होकर पुकारता रहा था, छोटे, मैं यहीं हूँ, और आज पहली बार किसी ने जवाब दिया।
[SCENE id=walk mood=suspense]
[NARRATOR] उसके पैरों के पास कोई लहर नहीं उठ रही थी, और वह हर क़दम थोड़ा बाईं तरफ़ झुकाकर रखता था, ठीक मेरे छोटे भाई की तरह।
[SCENE id=voice mood=suspense]
[SFX name=name_in_water]
[CHARACTER] तू सुन रहा है न? बस एक बार बोल दे।
[NARRATOR] मेरा पूरा नाम पानी में से आया, और मैंने दाँत भींच लिए, क्योंकि गाँव का पहला नियम याद था।
[SCENE id=under mood=suspense]
[NARRATOR] फिर वह नाव की बत्ती में आया, और मैं समझ गया कि वह पानी पर नहीं, पानी के नीचे चल रहा है, उल्टा, सिर गहराई में लटका हुआ।
[SCENE id=face mood=suspense]
[NARRATOR] वह मेरे पाँवों तक पहुँचा, और सतह के नीचे से एक सफ़ेद चेहरा मुझे देखने लगा। उसके होंठ हिलते थे, पर आवाज़ कहीं और से आती थी।
[SCENE id=relief mood=calm]
[NARRATOR] मैं बिना हिले खड़ा रहा, चेहरा लहरों में घुल गया, आवाज़ बंद हो गई, और मुझे लगा कि मैं जीत गया।
[SILENCE dur=1.0]
[SCARE name=my_voice_answers]
[CHARACTER] हाँ, मैं यहीं हूँ।
[SCENE id=loop mood=suspense]
[NARRATOR] मैंने एक शब्द नहीं कहा था, पर झील से मेरी अपनी आवाज़ ने जवाब दे दिया।
[NARRATOR] फिर बिना हवा के एक लहर चढ़ी, मुझे छाती तक भिगोकर पीछे से धकेल गई, जैसे बहुत सारे छोटे हाथ मुझे बाहर धकेल रहे हों।
[NARRATOR] तब समझ आया कि झील के पास मेरी आवाज़ है, और मुझे नहीं पता था कि वह उससे किसे बुलाएगी।
```

## Timing estimate

| Line | Speaker | est. start | Text | words |
|---|---|---|---|---|
| L1 | NARRATOR |  0.0s | मैं किनारे पर रुका रहा, और काले पानी के उस पार से कोई सीधा चलकर मेरी तरफ़ आने लगा। | 19 |
| L2 | NARRATOR |  7.0s | तीन रात से मैं इसी जगह खड़ा होकर पुकारता रहा था, छोटे, मैं यहीं हूँ, और आज पहली बार किसी ने जवाब दिया। | 23 |
| L3 | NARRATOR | 15.6s | उसके पैरों के पास कोई लहर नहीं उठ रही थी, और वह हर क़दम थोड़ा बाईं तरफ़ झुकाकर रखता था, ठीक मेरे छोटे भाई की तरह। | 26 |
| L4 | CHARACTER | 25.2s | तू सुन रहा है न? बस एक बार बोल दे। | 10 |
| L5 | NARRATOR | 28.9s | मेरा पूरा नाम पानी में से आया, और मैंने दाँत भींच लिए, क्योंकि गाँव का पहला नियम याद था। | 19 |
| L6 | NARRATOR | 35.9s | फिर वह नाव की बत्ती में आया, और मैं समझ गया कि वह पानी पर नहीं, पानी के नीचे चल रहा है, उल्टा, सिर गहराई में लटका हुआ। | 28 |
| L7 | NARRATOR | 46.3s | वह मेरे पाँवों तक पहुँचा, और सतह के नीचे से एक सफ़ेद चेहरा मुझे देखने लगा। उसके होंठ हिलते थे, पर आवाज़ कहीं और से आती थी। | 27 |
| L8 | NARRATOR | 56.3s | मैं बिना हिले खड़ा रहा, चेहरा लहरों में घुल गया, आवाज़ बंद हो गई, और मुझे लगा कि मैं जीत गया। | 21 |
| — | SILENCE | 64.1s | (dead air 1.0s) |  |
| L9 | CHARACTER | 65.1s | हाँ, मैं यहीं हूँ। | 4 |
| L10 | NARRATOR | 66.6s | मैंने एक शब्द नहीं कहा था, पर झील से मेरी अपनी आवाज़ ने जवाब दे दिया। | 16 |
| L11 | NARRATOR | 72.5s | फिर बिना हवा के एक लहर चढ़ी, मुझे छाती तक भिगोकर पीछे से धकेल गई, जैसे बहुत सारे छोटे हाथ मुझे बाहर धकेल रहे हों। | 25 |
| L12 | NARRATOR | 81.7s | तब समझ आया कि झील के पास मेरी आवाज़ है, और मुझे नहीं पता था कि वह उससे किसे बुलाएगी। | 20 |

Estimated runtime ≈ **89 s** at 2.7 words/s (calibrated on aired ep1: about 150 words in 55 s). Real TTS decides; measure it at production.

**Trim ladder if the real VO runs over 88 s:** shorten L7 to "सतह के नीचे से एक सफ़ेद चेहरा मुझे देखने लगा; उसके होंठ हिलते थे, पर आवाज़ कहीं और से आती थी।" (drop the first clause), then drop "बिना हिले खड़ा रहा" in L8. Keep L3, L6, the silence, L9 and L10.

## Shot list

| Shot | Lines | Frame and action | Camera | Light | Sound | I |
|---|---|---|---|---|---|---|
| S1 | L1 | Over his shoulder. The lake is flat black. Far off, a vertical pale line moves across the surface, evenly, upright, no wake. | Handheld, slow push. | The boat's lantern is the only light; a long amber streak lies on the water toward the walker. | Wind low. The lap of the water on the bank. A very faint, even tick, like steps. | 2 |
| S2 | L2 | Him from the front, mouth shut, breath steam. Cut to the shoreline: three faint ghost marks of where he stood on other nights. | Slow rack from his face to the shoreline. | Lantern rim on his cheek. | His own old call, late and tiny from far away: "छोटे, मैं यहीं हूँ". | 2 |
| S3 | L3 | The walker near the lantern's edge. Feet touch the surface, no ripple ring at all. Each step leans slightly left. | Long lens, compressed, slight sway. | Backlit by the lantern, silhouette only. | The ticks get louder, one per step. Silence between. | 3 |
| S4 | L4 | Close on the water in front of him. The name arrives as a rising air bubble, then the voice, near, kind, from the water. | Low angle at the water line, creeping forward. | Lantern shimmer on the surface. | `name_in_water`. Then the voice: his VO pitched up a little, warm, 0.7 s tail. | 3 |
| S5 | L5 | His jaw clenches. His thumb pressed to his lip. | Tight close-up, static. | Lantern warm on one side, blue moon on the other. | The voice repeats at a lower level, softer, angrier. His own heartbeat, fast. | 3 |
| S6 | L6 | The walker reaches the lantern ring. The picture flips: it is under the surface, feet to the underside of the water, head hanging into the deep. The lantern reflection runs across its legs like a ceiling. | A slow tilt-down through the surface line (a single in-water split-level shot). | Underwater green-black, the amber lantern streak bending. | Water goes muffled when the frame passes under. The ticks become slow knocks against the underside of the surface. | 4 |
| S7 | L7 | At his feet, a white face an arm's length below the surface, looking up. The water ripples distort it. Never fully resolved. | Directly overhead, locked, a slight creep. | A faint lantern glow on the face, nothing else. | The voice plays from beside the camera, not from the mouth. The mouth moves 0.3 s off. | 4 |
| S8 | L8 | The face dissolves into the lake's ripples. The surface goes still. The lantern drifts. | Pull back to the wide. | Moon, dull. | Voice stops. The lake settles. He exhales. | 1 |
| S9 | SILENCE | Hold on the wide, flat black water. Nothing moves. | Static. | Dark. | 1.0 s of room tone only. The pre-scare drop is ≥ 20 dB. | 1 |
| S10 | L9 → SCARE | From the water: his own voice, clean, close: "हाँ, मैं यहीं हूँ." His head whips toward it. | Snap turn handheld. | A 4-frame flash of the lantern streak (not full-frame, local). | Dry, loud, his own voice. Stinger: sub drop plus a glass crack. A chromatic spike. | 5 |
| S11 | L10 | His face. Mouth shut, shaking. | Slow push-in. | Blue, dull. | Nothing except the lap of the water. | 3 |
| S12 | L11 | A wave with no wind behind it climbs the bank. It hits him chest high and shoves him up the slope; many small pale hand shapes press into his back through the water. | Low and fast, a speed ramp. | Moon plus the lantern slipping behind the wave. | Wave roar with no wind bed. A tiny crowd of wet slaps. | 5 |
| S13 | L12 | He lies on the mud. The boat has nosed in beside him. The lantern is off. | Handheld, slow push. | Moon, trace of amber returning in the window. | The lake settles. A low loop tail. | 3 |

## Cards and caption

- Hook card: **"किनारे पर मैं। पानी पर कोई।"** (the old card; the twist later makes it ironic.)
- IG caption (Hinglish, with ep2a): `Maine B chuna. Kinare par ruka raha. Rule maana, ek lafz nahi bola. 🤐\nPhir bhi jheel ne meri awaaz mein jawab de diya.\nEk baar poori dekho, aakhri 5 second mat chhodna 👀\nA chunne wale ka reel bhi aaj hi hai.\n#AakhiriNaav #HindiHorror #HorrorReels #DoomsdayHorror`

## Continuity and risks

- The walker's lean is **left**, matching the brother (left-handed; planted again in ep3 and paid in ep5).
- The face is never fully resolved. Do not show eyes, only the pale oval and mouth movement.
- The A-branch narrator says the same line as the lake here. Do not change one without the other.
- Risk: the under-surface flip (S6) is the hardest render shot. Fallback: a stylised overhead cutaway with a water-distortion shader, not a true split-level.
