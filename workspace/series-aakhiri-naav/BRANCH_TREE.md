# आख़िरी नाव — Branch tree

```
ep1  ख़ाली नाव  (AIRED)                                   → कमेंट करो, A या B?
 ├── A: नाव तक जाओ     → ep2a  नाम        (answers the voice; the lights die)
 └── B: किनारे रुको     → ep2b  पानी पर     (silent; the lake answers in his voice)
        both rejoin on the bank, soaked, the boat beside him
        → ask (both reels, comments pooled): A उसे छूकर देखो / B झील को पुकारो  → picks the ep3 OPENER (light fork)
        → ep3  भीगा किनारा  (a phone rings under the lake)    → कमेंट करो, A या B?
 ├── A: नाव में चढ़ो     → ep4a  दो प्याले    (the kitchen cabin; his reflection rows)
 └── B: गाँव भागो       → ep4b  ऊपर की सड़क  (his mother will not open the door)
        both rejoin at the dock at first light
        → ep5  सुबह  (the boat is his own call; a small wet hand)  → कमेंट करो, A या B?
 ├── A: मुड़कर देखो     → Story 2, ep1a
 └── B: बिना देखे चलो   → Story 2, ep1b
```

**Standing rule (bible §7b):** every part ends with an A/B ask that changes the next video. Full forks after ep1, ep3, ep5; light forks (alternate 12-15 s opener, same body) after ep2 and ep4.

Publish order: ep1 (aired) → ep2a then ep2b (same day) → ep3 → ep4a then ep4b (same day) → ep5. "First posted wins a tie" means 2a and 4a go first.

## Rejoin invariants (so ep3 and ep5 are true on both paths)

**Into ep3 (the bank):** wet to the chest or more; the boat resting beside him; a small wet handprint on his right shoulder blade; the lake has his voice (he gave it in A, it borrowed it in B); the brother's phone is still under the lake.
**Into ep5 (the dock):** the boat tied to the post with a left-handed knot he did not tie; the jacket now wet; the sky not yet bright; the three nights of calling from the shore (planted in ep2a and ep2b).

## Fork 1 — after ep1 (aired)

| | A: नाव तक जाओ (ep2a) | B: किनारे रुको (ep2b) |
|---|---|---|
| Setup | He wades into the cold toward the lit boat. | He stays on the bank. Something walks toward him across the lake. |
| Escalation | The water gets *warmer* near the boat; the cabin murmurs "हाँ" in many voices; the jacket is body-warm. | The walker has no ripples and the brother's left lean; his full name is called from the water; a face looks up from under the surface. |
| Payoff | He answers by reflex ("हाँ, मैं यहीं हूँ"). Lights out. The water grips his chest like a hand. | Under the surface, upside down. He keeps silent, and the lake answers in his own voice anyway. |
| Dread | Being kind to by something that wants one word; the reflex you cannot stop. | Doing everything right and losing anyway; hearing your own voice answer without you. |

## Fork 2 — after ep3

| | A: नाव में चढ़ो (ep4a) | B: गाँव भागो (ep4b) |
|---|---|---|
| Setup | The cabin is warm and the green phone-light is sinking out on the lake. | A steep road, wet clothes, the lake behind him. |
| Escalation | The cabin is his mother's kitchen with the door handle on the wrong side; a red jacket sits at the table and breathes; the cabin answers with words he did not say. | Footsteps in step with his, a small print inside each of his; a first house with dark windows and someone holding their breath behind the door. |
| Payoff | The oars move because *his reflection* rows. The "companion" the lake gave him is himself. Wet footprints on the deck. | His mother will not open: the lake has been knocking at that door in his voice for three nights. His voice calls from behind him. He leads it away from her door. |
| Dread | A comfort that is built from your own memory and wrong in small ways; self-loss. | Being unrecognisable to the person who loves you most; the village's silence. |

## Fork 3 — after ep5 (Story 2 opener; the labels are proposals)

| | A: मुड़कर देखो | B: बिना देखे चलो |
|---|---|---|
| Setup | He turns his head to the small thing holding his hand. | He keeps his eyes front and walks the hand up the hill. |
| Direction | The face, and what it needs from him. | The mother's door, and who speaks first. |
| Dread | Being seen by the thing he called. | Bringing the lake into the one safe house. |

## Vote bookkeeping (`branch_tree.json` is the machine copy)

Record each vote when the window closes: the winning branch, the tally, and the date. The loser is kept as an optional "what if" reel. Both branches are pre-produced.
