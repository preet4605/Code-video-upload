# Runner: scripts/reel.mjs

Deterministic stages only. Claude writes `brief.json`, `script.txt`, `lines.json` lines, `shotlist.json`, `scene.mjs`, `critique.json`; the runner never writes creative content.

```
node scripts/reel.mjs init <dir> --genre <g> --lang hi|en|hinglish --format standalone|serial|interactive [--voice Aman]
node scripts/reel.mjs run <dir> [--stop-at <stage>] [--force <stage>] [--skip visual_loop] [--draft] [--auto]
node scripts/reel.mjs approve <dir> script|visual
node scripts/reel.mjs status <dir>
node scripts/reel.mjs list-voices [--lang hi|en] [--live]     # offline unless --live
```

## Stages, in order
`preflight` (doctor) -> `script_gate` -> **`script` checkpoint** -> `vo` (build_vo.mjs) -> `plan_lint` -> `visual_loop` -> **`visual` checkpoint** -> `render` (render_and_lint.mjs) -> `master_qa` (master_and_qa.mjs) -> `done`.

- Each stage records an input hash in `<dir>/run.json` and is skipped when the hash matches and its outputs exist (`--force <stage>` reruns just that stage). Hashes are sha256 of file bytes.
- `script_gate` is skipped when there is no `script.txt` and no `lines.json` (silent/visual-only reel). `vo` is skipped when there is no `lines.json`. An `init` skeleton (empty `lines`) makes the run WAIT for Claude to write the script.
- `visual_loop` needs Claude's `critique.json` between iterations, so each `run` advances at most one iteration, then stops and prints the sheet to look at. Rerun after writing the critique. If the picture is unchanged since the last iteration (same scene source graph + timeline + keyframe pixels) the run prints `REFUSED: picture unchanged since iteration N`, waits (exit 10), consumes no iteration and records the attempt in `visual_loop/log.json` (`unchanged_attempts`): fix the scene, or escalate / waive via qa.json `accept_unconverged_loop`. It is required before the visual checkpoint; `--skip visual_loop` or `--auto` skips it and marks the run UNREVIEWED (horror QA will FIX a skipped loop).
- `--draft` renders at draft size and stops before `master_qa`: a draft is never mastered or shipped.
- `master_qa` command: `--bgm auto` (horror: `--bgm horror`) `--sfx-auto --preset reel-vocal --audio-mood auto --platform <brief.platform>` when the timeline has audio, otherwise defaults.

## Approvals and the lock
`approve <dir> script` stores sha256 over `lines.json + brief.json + script.txt (if present)`; `approve <dir> visual` over `scene.mjs + timeline.json`, each with a timestamp, in `run.json`. A changed input makes the approval STALE and the run waits again. `render_and_lint.mjs` refuses to render (exit 1) when `run.json` has `approvals.script` and the script hash differs: "script changed after approval: re-approve with reel.mjs approve <dir> script". No `run.json` or no script approval = unchanged behaviour. Note: `vo` rewrites `timeline.json`, which stales a visual approval; approve visual after the audio is built.

`--auto` bypasses both checkpoints and the visual loop but sets `unreviewed: true` (+ `unreviewed_reasons`) in `run.json` and prints UNREVIEWED in the final summary. A later non-auto render clears the mark only if that render actually runs after real approvals. Tell the user when a reel is UNREVIEWED.

## Exit codes
0 done or stopped at `--stop-at`; 1 stage failed (run.json holds `failed.stage`, `exit_code`, last 40 stderr lines); 2 usage; 3 refused (QA pass cap); 4 finished but verdict is not SHIP; 10 waiting (checkpoint, critique, script, scene.mjs). `run.json` is written atomically (tmp + rename), so a crash leaves the previous valid file.

## QA pass cap
`run.json` counts `stages.master_qa.passes`. After 3 passes a 4th is refused unless `--force master_qa`; the runner prints the measured numbers. At the cap: stop fixing, give the human the verdict, numbers and the `unverified` list (SKILL rule 10).

## plan_lint (lib/plan_lint.mjs, runs after `vo`)
Reads `timeline.json` scenes/beats and optional `shotlist.json` (`id, camera, motion, details, layers.foreground|midground|background`). Warns on: repeated scene ids; one backdrop (`layers.background`, else scene id) in > 40% of shots; no declared camera move (`shotlist.camera` or a `camera.*` beat property); no motion for > 4 s; text-only shots (only title/text/caption/label/counter properties, no layers/details); a missing foreground layer when the shotlist uses `layers`. Horror: backdrop > 50% or more than 2 static shots are FAILS (stage fails, exit 1). Everything else is a warning stored in `run.json`. It is a cheap plan check, not a measure of how the picture looks.

## Final summary
`done` prints the QA verdict, fails/warns, `verified` and `unverified` lists, output paths (`out/<slug>.mp4`, `out/qa_report.json`, contact sheet) and the manual next step: caption via `ig-caption`, then `ig-human`, then a human watches with sound on a phone.
