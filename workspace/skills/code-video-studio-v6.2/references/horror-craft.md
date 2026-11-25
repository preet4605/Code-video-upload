# Horror craft: what makes a code-rendered reel actually scary

Read this before writing any horror idea or script. A horror reel is **one rule, one violation, one consequence, one turn**. Mood words are not horror. Gate: `scripts/script_gate.mjs`; critique questions: [script-critique.md](script-critique.md).

## 1. The spine (all six, in order)

1. **Hook (<= 14 words, in the first 3 s):** state the rule or the wrongness. "Raat ko koi ek baar pukare, to jawab mat dena."
2. **Rule, grounded:** a belief the viewer half-recognises: a nani/dadi saying, a night rule, a household taboo. Say *"कहा जाता है / नानी कहती थीं"*. **Label it** as folk belief or an invented family rule. Never present an invented rule as sourced fact or pin it on a region/community without a source.
3. **Relatable place:** the viewer's own room, own mother, own door, own 3 a.m. clock. Domestic beats supernatural: kitchen, fan, bed, light under the door.
4. **Violation:** the rule is broken or nearly broken, by the narrator *or someone they love* (the second is worse).
5. **Consequence you can see or hear:** a footstep, a missing weight on the bed, a light that goes out. Not "a strange feeling".
6. **The turn + loop:** a late fact that recontextualises the first line, and a last line (<= 18 words) that echoes the hook so the viewer rewatches.

## 2. Craft rules

- **Withhold.** Never show or explain the thing. Light strips, shadows, gaps, silence. The viewer's imagination does the work; a code-drawn monster loses to it every time.
- **Specific beats scary adjectives.** 3:07, two warm cups, counting to eleven, two feet in the light strip. If a detail could sit in any horror script, cut it.
- **Short lines.** Median line <= 12 words. Clipped rhythm. One idea per line.
- **Sound carries the scare.** Plan >= 3 designed sound events (call, footsteps, door, light dying) and **silence** before the worst one. Narration describes; sound lands.
- **Escalate by removing safety.** Each beat: less safe than the last (voice -> loved one answers -> she walks away -> she doesn't return -> the voice comes back).
- **One violation.** Two stacked reversals are unreadable at 60 s read aloud. Cut the weaker.
- **Banned:** *अचानक, खौफनाक, भयानक, डरावना, रहस्यमय, suddenly, eerie, creepy, spine-chilling*, "I was so scared". Show the object, not the emotion. At most one direct fear statement.
- **Hindi TTS:** spell every number in words in the *spoken* script (तीन बजकर सात मिनट). Put digits on screen instead (the clock reads 3:07).

## 3. Making it look like horror in code (all deterministic from `t`)

- **Darkness is the base, light is the subject.** Mean luma of the visible field around 15-25/255; one motivated source per scene (moon, a light strip, a diya).
- **Layers every scene:** foreground (dust, steam, foot shadows), midground (the subject), background (window, door). Declare them in `shotlist.json`.
- **Rim light** on the dark figure's edge is what makes a silhouette readable. Without it the figure is mud.
- **Camera:** slow push-in over the whole reel, extra push per scene, and a handheld tremble that *grows* (`~prog^2`). Static horror is not horror.
- **Motion escalates:** the last third must move more than the first third (the gate measures this).
- **Grain + vignette** on top (`mulberry32(Math.floor(t*14))`), under the caption bar.
- **Strip lights/flicker are local and under 3 Hz of full-frame change** (WCAG). No full-frame strobe.
- Keep the focal point in the safe zone and the **action above y = 0.65 H**: the caption bar owns the band below it and the visual gate does not measure it.

## 4. Idea vs script

- "Give me an idea / concept / brainstorm" -> **Idea mode** (pitch, labelled IDEA). Never dress a pitch as a script.
- "Write the script / make the reel" -> **Script mode** (full spoken script + SFX + scenes + critique).
- Unclear -> ask one short question, or deliver the idea and say it is an idea.
- A thin reel (< 5 scenes, < ~80 spoken words, no designed sound) is never an acceptable answer to a horror request.

## 5. What the gates cannot do

They catch thin, clichéd, ungrounded, rubber-stamped, too-bright, empty, or flat-motion horror. They cannot prove it is scary. Read the script aloud once, then watch the render **with sound on a phone in a dark room**.
