# Script critique: great script, bluff, or just an idea?

Run **after** writing and **before** rendering. The same model wrote the script, so its self-scores are biased: the gate therefore (a) runs mechanical checks that ignore your scores, (b) requires verbatim script quotes as evidence, and (c) lets a failed heuristic overrule a flattering verdict.

## Step 0: which deliverable was asked for?

| User said | Deliver | Gate |
|---|---|---|
| idea, concept, brainstorm, "what should the reel be about" | `idea.md`, labelled **IDEA**: sections *Logline, Myth/Rule, Beats (>= 6), The scare, Ending* | `script_gate.mjs <dir> --mode idea` |
| script, write the reel, make it | `script.txt` (+ `brief.json`, `critique.json`, `shotlist.json`) | `script_gate.mjs <dir> --mode script` |

Never answer a script request with an idea, or an idea request with a half-script.

## Step 1: answer the 14 questions in `critique.json`

`{ "mode":"script", "verdict":"great|workable|rewrite|bluff", "answers":[{ "id", "score":1-5, "evidence":"<exact script quote>", "note" }], "weakest_line":{ "quote","rewrite" } }`

| id | question |
|---|---|
| stranger_test | Hears only the first 3 s: do they stay, and can they say what it is about? |
| myth_grounding | Is the rule rooted in a labelled belief or a clear invented rule? |
| relatability | Could the viewer be in this exact place tonight? |
| violation | One clear moment the rule is broken? |
| consequence | Concrete, physical consequence (not a mood)? |
| escalation | Is beat N+1 worse than beat N? |
| withholding | What is never shown? Is the scariest thing implied? |
| specificity | Name 3 details that appear in no other horror script. |
| the_turn | Late reveal that recontextualises the opening? |
| sound_scare | Does a designed sound event (or silence) land the scare? |
| ending_loop | Last line short, final, echoes the hook? |
| cliche_scan | Any cliché / fear-adjective / AI-sounding line kept? |
| code_visual_feasible | Can every scare be drawn on a 2D canvas? |
| bluff_plot_without_adjectives | Strip every adjective: still a plot? List >= 4 events as exact quotes in `plot_events`. |

## Step 2: scoring rules the gate enforces

- Score <= 2 on anything: **rewrite**, do not render.
- `great` needs average >= 4.2 and no score below 3. `workable` needs no score below 3.
- Evidence must be an exact quote that exists in `script.txt` (Devanagari is normalised: NFC, nukta ignored).
- All-equal scores, or an average >= 4.9, are rejected as rubber-stamping.
- `weakest_line` is mandatory: a real line plus a different rewrite. Apply the rewrite if it is better.
- A `great`/`workable` verdict with any failed heuristic is rejected: **the heuristics win**.
- `critique.mode` must equal the CLI `--mode`.

## Step 3: bluff test (answer honestly)

A *bluff* script has atmosphere but no event: lots of "the air felt heavy", no rule, no violation, no consequence. If the plot-events list is thin, or the same events survive only with the adjectives, the verdict is `bluff`. Rewrite from the spine in [horror-craft.md](horror-craft.md).

## Step 4: human read-aloud (not automatable)

Read it aloud once at speaking pace. If you stumble, a line is too long. If the room doesn't go quiet at the turn, the turn is not working. A PASS from the gate means "not obviously broken", never "scary".
