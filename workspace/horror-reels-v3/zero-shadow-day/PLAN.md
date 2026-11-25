# Zero Shadow Day (Bina Parchhai ka Ek Minute): plan only, nothing rendered

Format: standalone, one complete story, target 58-62 s, 1080x1920, Aman (Kalpa) VO, code-only look, V6.2 pipeline.
Status: waiting for Love's pick. Written 2026-11-25.

## 1. What has already been used (so this avoids it)

| Used | Where |
|---|---|
| Counting an extra person | Ginti (hostel), Hostel bed, Raat 2 Baje |
| Rules ("don't do X") | Lift 13, Peepal, Teen baar khatkhatana, Chudail ke 3 tareeke, Raat 2 Baje |
| Phone / call from the dead | 3:33 Mummy ka call |
| Brides, chudail, haveli | Ranga, dulhan song reel |
| Boat / lake | Aakhiri Naav series |
| Mirror lag | Aaine mein der se jhapki |
| Road ghost | Highway lift |
| Stairwell + Dadi protector twist | song reel |
| **Everything is at night, in the dark.** | all 21 |

## 2. The five pitches

| # | Title | Hook | Twist (explains the hook) | Scare | Code-only fit | Weakness |
|---|---|---|---|---|---|---|
| 1 | **Zero Shadow Day** | "Us dopahar poore school ki parchhai gayab thi." | For one minute the dead look like the living. Raju takes a hand, one shadow returns, and it is not the narrator's | 8/10 | Excellent: shadows are pure geometry | Bright look fights the horror luma gate (allowed, warn only) |
| 2 | **Mehmaan** | "Hamare ghar mein ek mehmaan gyarah saal se ruka hai." | Every attempt to say "aap kab jaayenge" turns into an offer of tea. Reveal: he is the host, the family are the guests, and he is too polite to ask them to leave | 6/10, eerie more than scary | Good: one room, thalis, a sentence that re-routes on screen | Ghost-POV twist; dread is lower |
| 3 | **Teeka** | "Dadi roz mere kaan ke peeche kaala teeka lagati thi." | The dot is not for nazar. It is how Dadi tells her real grandchildren from what comes in wearing their face. Tonight it is missing from the narrator | 8/10 | Good: lamp, faces, kajal | Changeling is a known trope; needs a tight second pass on who the copy is |
| 4 | **Kathputli** | "Meri kathputliyan kal ka sach dikhati hain." | The show predicts a death each night. He changes it, strings pull back. The new puppet in the box is carved in his own face | 7/10 | Excellent: shadow screen, strings, diya | "We are the puppets" ending risks cliche; ends bleak |
| 5 | **Rewind** | "Is reel ko ulta dekho." | The story is told in reverse. The innocent first scene is the last thing we see | 6/10 | Good | Fights `story_lint` (expects setup first); riskiest for the pipeline. Wildcard only |

## 3. Recommendation: Zero Shadow Day

Why it wins, in order:
1. **Only daylight horror on the account.** Every other reel is a dark frame in a dark feed. A white-hot noon thumbnail is the visual outlier.
2. **A one-line rule that explains itself.** Viewers get it in one sentence: no shadows for a minute, so no way to tell dead from alive.
3. **Real phenomenon.** Zero Shadow Day is real and schools in India actually do it. This makes the fantasy feel grounded. Facts checked against science-explainer pages (not the ASI page): occurs twice a year only south of 23.5 N, lasts about 1 to 1.5 minutes, at local solar noon (not 12:00), Delhi does not get it. See Sources.
4. **Shadows are pure geometry**, so the whole look is code with no images. Camera angle, shadow length and heat haze are all analytic.
5. **Built-in clock.** The shrinking shadow is the countdown. No "ginti".
6. **Complete.** Setup, two planted clues, escalation, false relief, twist, final image, callback to the hook shot. No cliffhanger.

Originality: one web search for "zero shadow day" with horror/ghost found nothing. That is not proof nobody has done it, only that I found nothing and the account has never done it.

## 4. Story block (for `brief.json`)

- **Setup:** school courtyard in central India on Zero Shadow Day. Narrator is a class-eight boy.
- **Clue 1 (rule):** Dadi, that morning: don't hold anyone's hand today. For one minute the dead and living look alike, and only one shadow returns.
- **Clue 2:** Last year on this day Raju stood alone at the school well and never came back.
- **Clue 3:** Master ji forces everyone into a circle, holding hands "so nobody wanders."
- **Escalation 1:** shadows shrink to nothing, cicadas swell.
- **Escalation 2:** a hand takes his. Cold, in 40 degree heat.
- **Escalation 3:** it is Raju. Wet hair, a drop falling on hot stone.
- **Silence:** all sound dies as the last shadow goes (1.0 s).
- **Scare:** Raju whispers Dadi's rule back at him.
- **False relief:** shadows return, one appears under the narrator's feet, he breathes out.
- **Twist (explains hook):** he lets go and steps back. The shadow does not follow. It stays joined to Raju's feet. Raju took the one shadow that returned.
- **Ending image:** gate, Mummy hugs Raju who answers to the narrator's name. The narrator stands in the empty bright courtyard, hand raised, no shadow, nobody turns.
- **Callback:** last shot returns to the foot-level shot of the hook: wet footprints evaporating on hot stone, now the narrator's.
- **Last line:** a statement to the viewer, not a question and not a CTA.

## 5. Script (13 lines, about 128 words)

Estimated 62-66 s from the pilot's pace (118 words = 59.9 s). If it runs long, cut line 10, then trim line 3. Spoken Devanagari / on-screen Hinglish.

1. Us dopahar, poore school ki parchhai gayab thi.
   - उस दोपहर, पूरे स्कूल की परछाईं गायब थी।
2. Dadi ne kaha tha, aaj kisi ka haath mat pakadna.
   - दादी ने कहा था, आज किसी का हाथ मत पकड़ना।
3. Us ek minute mein zinda aur murde mein koi farak nahi rehta, aur parchhai sirf ek hi lautti hai.
   - उस एक मिनट में ज़िंदा और मुर्दे में कोई फ़र्क़ नहीं रहता, और परछाईं सिर्फ़ एक ही लौटती है।
4. Par master ji ne sabke haath pakadwa diye.
   - पर मास्टर जी ने सबके हाथ पकड़वा दिए।
5. Pichle saal isi din, Raju kuen pe akela tha. Wapas nahi aaya.
   - पिछले साल इसी दिन, राजू कुएँ पे अकेला था। वापस नहीं आया।
6. Phir ek ek karke, sabki parchhai gayab ho gayi. `[SILENCE dur=1.0]`
   - फिर एक एक करके, सबकी परछाईं गायब हो गई।
7. Kisi ne mera haath pakda. Thanda haath, is garmi mein bhi.
   - किसी ने मेरा हाथ पकड़ा। ठंडा हाथ, इस गर्मी में भी।
8. Wo Raju tha. Baal geele, boond tapakti hui.
   - वो राजू था। बाल गीले, बूँद टपकती हुई।
9. `[WHISPER]` Usne dheere se kaha, ek hi parchhai lautti hai. `[SCARE name=raju_whisper]`
   - उसने धीरे से कहा, एक ही परछाईं लौटती है।
10. Parchhaiyan lautin. Meri bhi. Maine lambi saans li.
    - परछाइयाँ लौटीं। मेरी भी। मैंने लंबी साँस ली।
11. Maine haath chhudaya. Meri parchhai Raju ke pairon se judi rahi.
    - मैंने हाथ छुड़ाया। मेरी परछाईं राजू के पैरों से जुड़ी रही।
12. Mummy ne use mera naam lekar gale lagaya. Mujhe kisi ne nahi dekha.
    - मम्मी ने उसे मेरा नाम लेकर गले लगाया। मुझे किसी ने नहीं देखा।
13. Parchhai gayab ho, to kisi ka haath mat pakadna.
    - परछाईं गायब हो, तो किसी का हाथ मत पकड़ना।

Notes: line 1 is the hook (spoken in the first 2.5 s). Line 3 plants the rule that line 9 pays off. "Dopahar" rather than "barah baje" because real solar noon varies by city. The hook scorer (`ig-reel/hookscore.py`) rated all five candidate hooks as weak (best 43.9), but it looked English-tuned, so treat it as relative only. The final hook is a visual contradiction (bright school, no shadows), which that scorer cannot read.

## 6. Shot list

| # | Time | Shot | Camera | Light / detail | Sound |
|---|---|---|---|---|---|
| 1 | 0-3.5 | Foot-level crawl across white-hot courtyard. Shadows under shoes are shrinking. A trail of **wet footprints** from the well evaporates | Low dolly, handheld drift | Overexposed noon, heat shimmer, dust | Cicada drone, loo wind, tick of a stopwatch |
| 2 | 3.5-12 | Dark kitchen, diya. Dadi's hand grips the narrator's wrist and lets go | Slow push-in | Only dark interior scene, one lamp | Low room tone, her breath |
| 3 | 12-20 | School courtyard. Master ji lines kids into a circle, hands joined. The rope-fenced well sits in the background | Slow crane up | Hard noon, chalk circle | Bell far away, shuffling |
| 4 | 20-29 | The minute starts. Camera rises overhead as shadows retreat into feet. A chalk mark shows shadow length | Rising overhead | Sun disc blooms | Cicadas swell |
| 5 | 29-31 | **Silence 1.0 s.** Last shadow goes. Cicadas cut dead | Held | Flat, shimmer only | Pre-scare drop, at least 20 dB |
| 6 | 31-37 | Close on hands. A small hand takes his. Water beads and steams off hot skin | Push-in | Heat haze | Faint drip-sizzle, heartbeat |
| 7 | 37-43 | Raju's face half in frame. Wet hair, a drop falls on stone and vanishes | Slow tilt up | Bleached, backlit | Whisper, then dissonant stinger |
| 8 | 43-48 | False relief. Wind, cicadas back. Shadows grow back from every pair of feet | Pull back wide | Warm | Normal day, bell |
| 9 | 48-53 | Twist. He releases and steps back. His shadow stays joined to Raju's. Two bodies, one shadow | Ground-level, low | Hard shadow | Sub swell, cicadas thin out |
| 10 | 53-62 | Gate: Mummy hugs Raju, long shadow. Narrator alone in bright courtyard, hand raised, no shadow. Cut to foot-level, wet prints evaporate (callback to shot 1) | Reverse dolly then low crawl | Empty white | Cicadas loop, last drip |

## 7. Production notes against V6.2

- **Brightness gate:** `lib/horror_gate.mjs` fails a scene whose mean luma is above 60. That would fail most of this reel. The gate has an escape: scenes may declare `allow: ["bright"]`, which turns it into a warning. Declare it on the daylight scenes and keep the Dadi kitchen scene dark. Also needs: horror BGM bed or silence rule check, last scene id containing `loop`, first scene mood `suspense`.
- **Look (code-only):** analytic shadows (length = height / tan(sun elevation), elevation sweeps to 90 degrees and back), sun bloom, heat-haze displacement, bleach-bypass grade, seeded grain, vignette. Kids are low-poly 3D from `lib/scene3d.mjs`. No AI or photoreal images.
- **Sound (synthesised):** cicada drone, loo wind, footsteps on stone, chalk, bell, drip-sizzle, heartbeat, stingers. Same approach as the Ginti sound bed.
- **Gates to expect:** `script_gate --mode script` and `story_lint` pass (clues before twist, threat planted by Raju mention before first seen, ending is a statement). Strobe cap: the sun bloom and scare flash must stay below 3 flashes per second.
- **Not measurable:** whether it is scary. Needs a listen on a phone with sound.

## 8. Risks and unknowns

- Facts: zero shadow timing was checked on secondary sites only. I did not check the Astronomical Society of India dates. The reel names no city and no date.
- Body-swap is an old trope. The novelty is the shadow mechanism and the daylight setting.
- Ending leaves the narrator as the one who is gone. It is a complete ending, but sad. Raju is a child who died, so keep imagery non-graphic.
- The hand-holding reveal can read as comedy if pacing is loose. The silence and the pre-scare drop have to be measured, not assumed.
- Length estimate is a guess until the VO is generated.

## 9. Open questions for Love

1. Approve Zero Shadow Day, or pick another pitch, or ask for a mix.
2. Boy narrator named in-story? (Plan uses no name; Mummy says "mera naam", never spoken.)
3. Caption CTA (comment only, none in video): "Tumhare school mein parchhai wala din kab aata hai?" Fine to use?

## Sources
- https://www.scienceabc.com/eyeopeners/what-is-the-zero-shadow-day.html
- https://www.deccanherald.com/india/karnataka/bengaluru/bengaluru-witnessed-zero-shadow-day-today-all-you-need-to-know-2992091
- https://www.imsc.res.in/outreach/resources/ZSD_poster.pdf
