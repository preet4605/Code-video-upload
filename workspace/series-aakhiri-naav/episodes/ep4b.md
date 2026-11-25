# ep4b — ऊपर की सड़क (Branch B: run for the village)

**Format:** `serial` part (no vote; rejoins at ep5). **Publish:** same day as ep4a, ep4a second. **Look:** cold, steep, dark road; one lit window at the end. The only episode with a human voice besides the narrator.
**One-line pitch:** He reaches his own mother's door, and she will not open it, because for three nights the lake has been knocking there in his voice.
**Scare pattern:** social horror (the door that will not open), then his own voice calling from behind him.

## Story gate block

| Field | Content |
|---|---|
| part_question | Will the village take him in? |
| part_payoff | No. "तीन रात से मेरे बेटे की आवाज़ इसी दरवाज़े पर आ रही है, पर मेरा बेटा नियम जानता है, वह बोलता नहीं।" His mother tells him to stay silent and keep out until morning. |
| setup | He runs uphill, away from the lake. His wet clothes are heavy. |
| clues planted | C1 footsteps in step with his own. C2 the small footprint inside every big print. C3 the childhood game: "बचपन में छोटा मेरे ही निशानों में पैर रखकर चलता था". C4 the dark windows. C5 mother: "अगर तू मेरा बेटा है तो चुप रह". C6 **rule three set** in her words: "सुबह से पहले नाव को हाथ मत लगाना, चाहे वह तेरे भाई की जैकेट ही क्यों न लौटाए". |
| escalation ×3 | the matched footsteps and inner footprints; the unopened door with someone holding their breath; the mother's reason for refusing |
| false_relief | "माँ काँप रही थीं, पर वह ज़िंदा थीं और घर में थीं, और मैं माथा टिकाकर चुपचाप रो पड़ा।" |
| silence | 1.0 s |
| twist (explains hook) | The village windows are dark because everyone is *listening*, and his voice is no proof: the lake owns it. "वह मेरी अपनी आवाज़ थी, मेरे ठीक पीछे, अँधेरे से" |
| ending_image | He leads the voice away, downhill, so it does not stand at his mother's door. |
| new question (cliff) | "मैं उसी झील की तरफ़ उतरता गया जिससे भागकर आया था।" What waits at the dock at first light? |
| callback | hook "मेरे पीछे ... क़दम" returns as the voice behind him |
| rule status | **Rule two kept** (he never crosses). **Rule three set here.** |
| threat.planted_by | the lake's voice is planted by his mother's "तीन रात" line before it speaks behind him |
| new_facts | His mother is alive and locked in. The lake has been calling at her door in his voice for three nights. The village's silence is a defence. The brother used to step in his footprints. |

## Script (production file: `ep4b.script.txt`)

```text
[SCENE id=hook mood=suspense]
[SFX name=run_gravel_breath]
[NARRATOR] मैं ऊपर की सड़क पर भागा, और मेरे पीछे किसी के क़दम मेरे क़दमों के साथ-साथ पड़ रहे थे।
[NARRATOR] मैं रुका तो क़दम भी रुके, और सड़क पर मेरे जूतों के हर निशान के अंदर एक छोटा-सा निशान दबा था।
[NARRATOR] बचपन में छोटा मेरे ही निशानों में पैर रखकर चलता था, कहता था कि तुम्हारे पीछे चलने में डर नहीं लगता।
[SCENE id=door mood=suspense]
[NARRATOR] पहले घर पर मैंने दरवाज़ा पीटा, पर अंदर कोई नहीं बोला, और खिड़कियाँ काली थीं, जैसे कोई भीतर साँस रोके खड़ा हो।
[SFX name=latch_breath_behind_door]
[CHARACTER] तू कौन है?
[NARRATOR] वह माँ की आवाज़ थी, और मैं बोलने ही वाला था कि उन्होंने फुसफुसाकर कहा, अगर तू मेरा बेटा है तो चुप रह।
[CHARACTER] तीन रात से मेरे बेटे की आवाज़ इसी दरवाज़े पर आ रही है, पर मेरा बेटा नियम जानता है, वह बोलता नहीं।
[CHARACTER] सुबह तक दरवाज़ा नहीं खुलेगा, और सुबह से पहले नाव को हाथ मत लगाना, चाहे वह तेरे भाई की जैकेट ही क्यों न लौटाए।
[SCENE id=relief mood=calm]
[NARRATOR] माँ काँप रही थीं, पर वह ज़िंदा थीं और घर में थीं, और मैं माथा टिकाकर चुपचाप रो पड़ा।
[SILENCE dur=1.0]
[SCARE name=my_voice_behind_me]
[CHARACTER] माँ, दरवाज़ा खोलो, मैं हूँ।
[SCENE id=chase mood=climax]
[NARRATOR] वह मेरी अपनी आवाज़ थी, मेरे ठीक पीछे, अँधेरे से, और अंदर किसी ने कुंडी पर हाथ रख दिया।
[NARRATOR] जब तक मैं यहाँ खड़ा था, वह आवाज़ माँ के दरवाज़े पर रुकती, इसलिए मैं नीचे की तरफ़ दौड़ा, ताकि वह मेरे पीछे आए।
[SCENE id=loop mood=suspense]
[NARRATOR] सूरज निकलने में देर थी, और मैं उसी झील की तरफ़ उतरता गया जिससे भागकर आया था।
```

## Timing estimate

| Line | Speaker | est. start | Text | words |
|---|---|---|---|---|
| L1 | NARRATOR |  0.0s | मैं ऊपर की सड़क पर भागा, और मेरे पीछे किसी के क़दम मेरे क़दमों के साथ-साथ पड़ रहे थे। | 19 |
| L2 | NARRATOR |  7.0s | मैं रुका तो क़दम भी रुके, और सड़क पर मेरे जूतों के हर निशान के अंदर एक छोटा-सा निशान दबा था। | 21 |
| L3 | NARRATOR | 14.8s | बचपन में छोटा मेरे ही निशानों में पैर रखकर चलता था, कहता था कि तुम्हारे पीछे चलने में डर नहीं लगता। | 21 |
| L4 | NARRATOR | 22.6s | पहले घर पर मैंने दरवाज़ा पीटा, पर अंदर कोई नहीं बोला, और खिड़कियाँ काली थीं, जैसे कोई भीतर साँस रोके खड़ा हो। | 22 |
| L5 | CHARACTER | 30.7s | तू कौन है? | 3 |
| L6 | NARRATOR | 31.9s | वह माँ की आवाज़ थी, और मैं बोलने ही वाला था कि उन्होंने फुसफुसाकर कहा, अगर तू मेरा बेटा है तो चुप रह। | 23 |
| L7 | CHARACTER | 40.4s | तीन रात से मेरे बेटे की आवाज़ इसी दरवाज़े पर आ रही है, पर मेरा बेटा नियम जानता है, वह बोलता नहीं। | 22 |
| L8 | CHARACTER | 48.5s | सुबह तक दरवाज़ा नहीं खुलेगा, और सुबह से पहले नाव को हाथ मत लगाना, चाहे वह तेरे भाई की जैकेट ही क्यों न लौटाए। | 24 |
| L9 | NARRATOR | 57.4s | माँ काँप रही थीं, पर वह ज़िंदा थीं और घर में थीं, और मैं माथा टिकाकर चुपचाप रो पड़ा। | 19 |
| — | SILENCE | 64.4s | (dead air 1.0s) |  |
| L10 | CHARACTER | 65.4s | माँ, दरवाज़ा खोलो, मैं हूँ। | 5 |
| L11 | NARRATOR | 67.3s | वह मेरी अपनी आवाज़ थी, मेरे ठीक पीछे, अँधेरे से, और अंदर किसी ने कुंडी पर हाथ रख दिया। | 19 |
| L12 | NARRATOR | 74.3s | जब तक मैं यहाँ खड़ा था, वह आवाज़ माँ के दरवाज़े पर रुकती, इसलिए मैं नीचे की तरफ़ दौड़ा, ताकि वह मेरे पीछे आए। | 24 |
| L13 | NARRATOR | 83.2s | सूरज निकलने में देर थी, और मैं उसी झील की तरफ़ उतरता गया जिससे भागकर आया था। | 17 |

Estimated runtime ≈ **90 s** at 2.7 words/s (calibrated on aired ep1: about 150 words in 55 s). Real TTS decides; measure it at production.

**Trim ladder if the real VO runs over 88 s:** cut "और खिड़कियाँ काली थीं, जैसे कोई भीतर साँस रोके खड़ा हो" from L4, then "कहता था कि तुम्हारे पीछे चलने में डर नहीं लगता" from L3 (do **not** cut L3 entirely; ep5 reuses the footprint game). Never cut L7, L8, the silence, L10.

**Voice cast:** mother = a female Kalpa voice (see the `kalpa-tts-voices` memory), dry, close, whispered, with a door-muffle filter (low-pass ~2 kHz plus a faint wood resonance). The "behind me" voice is the **narrator's own VO**, processed through the lake chain (bible §10).

## Shot list

| Shot | Lines | Frame and action | Camera | Light | Sound | I |
|---|---|---|---|---|---|---|
| S1 | L1 | He sprints uphill along a gravel road. A signboard reads गाँव with its arrow pointing *down toward the lake*. The camera is ahead of him, looking back. | Dolly backwards in front of him, shaky. | Moon, blue-grey, long shadows. | His breath, boots on gravel, and a second set of boots one beat behind, perfectly in step. | 3 |
| S2 | L2 | He stops. The second set stops one beat later. Macro on the gravel: his heel print, and inside it a small, dark, wet print pressed in. | Whip-stop, then a macro push on the print. | Cold moon, a raking low angle that makes the print read as a hollow. | Silence, then one step. | 4 |
| S3 | L3 | A flash of memory: a muddy field, two boys, the smaller one stepping in the older one's prints, arms out for balance. | Soft handheld, a warm washed-out look. | Dusky amber, low sun. | A child's laugh (very short, dry, no echo). It stops on a cut. | 2 |
| S4 | L4 | The first house. He pounds the door. Black windows. A curtain's edge does not move, but behind the glass a hint of someone breathing fogs it. | Close on his fists, then a slow push on the window. | A thin line of moon on the glass. | Pounding. No reply. A single held breath from behind the door. | 3 |
| S5 | L5 | Close on the keyhole, a darkness with a faint warm glint. | Static macro. | Warm glint inside, nothing visible. | Mother, whispered, close, at the keyhole: "तू कौन है?" | 4 |
| S6 | L6 | He opens his mouth. Her whisper stops it. He shuts his teeth. | Tight on his face. | Moon, hard. | Her whisper, pressed against the wood: "अगर तू मेरा बेटा है तो चुप रह।" | 4 |
| S7 | L7 | The door's wood grain, a hand pressed flat on the inside (the paint shifts slightly). The line is quiet and shaky. | Static on the door's surface. | Dull. | Her voice, close and trembling. | 4 |
| S8 | L8 | Her second whisper gives the rule. The camera finds the lower hinge, where a damp rag has been stuffed in the gap so no sound leaks. | A slow tilt down the door to the hinge. | Dull. | The rule, then silence. A hand withdraws from the door. | 3 |
| S9 | L9 | He leans his forehead on the door, crying without sound. A second, cooler thread of light appears: the first lit window further up the lane. | Static, then a slow rack to the distant lit window. | Cold on him, one warm distant window. | His silent sobs. A muffled sob from inside. | 2 |
| S10 | SILENCE | He wipes his face. The lane is empty. | Static wide. | Moon. | 1.0 s of room tone. The pre-scare drop is ≥ 20 dB. | 1 |
| S11 | L10 → SCARE | From the dark behind him, in his own voice: "माँ, दरवाज़ा खोलो, मैं हूँ." | Snap-focus: his back, a dark gap behind. Nothing visible. | Black behind him. | The voice is dry, warm, kind, a little louder than natural. Stinger: sub drop plus a glass crack. A chromatic spike. | 5 |
| S12 | L11 | Inside the door the latch rattles. A hand is on it. He looks at the door, then at the dark. | Whip between the latch's shadow under the door and the dark lane. | A thin warm strip of lamplight appears at the bottom of the door. | The latch scrapes a tooth up. | 5 |
| S13 | L12 | He chooses: he turns and runs downhill. The matched footsteps follow him away from the door. | Handheld, pursuit from behind him, fast. | Moon only. | His run, the second set of steps behind. The latch is let go. A hard exhale from inside. | 4 |
| S14 | L13 | The lake from the top of the road: flat, black, the dock a thin line. Sky not yet grey. He walks in. | Static wide from the ridge, slow push. | A first hint of grey on the far hills. | Dawn wind begins. The lake silent. | 3 |

## Cards and caption

- Hook card: **"सड़क ऊपर जाती है। तीर नीचे।"** (the old card, kept; S1's signboard pays it.)
- No choice card. No ask.
- IG caption (Hinglish, with ep4a): `B: Gaon ki taraf bhaaga. Pehle ghar par darwaza peeta. Maa ne nahi kholaa. 🚪\nKyunki teen raat se jheel unke darwaze par mere awaaz mein aa rahi thi.\nEk baar poori dekho, aakhri 5 second mat chhodna 👀\nA wala reel bhi aaj hi hai.\n#AakhiriNaav #HindiHorror #HorrorReels #DoomsdayHorror`

## Continuity and risks

- **New canon: the narrator's mother is alive and speaks, off screen.** She never appears on screen. The A path never meets her, so ep5 only needs a clatter of kitchen pots in the village as its "first morning sound".
- The brother's "step in my footprints" game is stated again inside ep5's script, so A-path viewers still get it.
- Risk: three speakers (narrator, mother, lake voice) in 80 s. Keep the mother's lines under 8 s each and make the lake voice audibly different (pitched, with the splice gaps).
