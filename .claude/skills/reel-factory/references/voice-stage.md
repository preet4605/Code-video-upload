# Voice stage (P1)

`node scripts/build_vo.mjs --project <dir> [--force] [--dry-run]` turns `<dir>/lines.json` into `voiceover.wav` + `timeline.json`.

## lines.json
`{ voice: "Aman" | id, model?: "kalpa-tts-1", temperature?: 0.7, sample_rate?: 48000, tempo?, lead_s?, gap?, tail_s?, lines: [{ sc, hi, hl, gap?, tempo?, event?, sfx?: [{name, at?: "start"|"end", dt?, gain_db?, scare?}] }], scenes_meta?, extra_sfx? }`
`hi` is the spoken text (Devanagari for Hindi); `hl` is the caption text (Hinglish/Latin). One Kalpa call per line.

## Behaviour
- Cache: `cache/vo/lNN_raw.wav` + `.key` (sha256 of voice|model|temperature|sampleRate|text). Unchanged lines never call the API again. `--force` re-synthesizes. `--dry-run` reports calls and characters needed, needs no key.
- Errors: 402 allowance_exhausted is never retried (exit 3). 429 honours Retry-After; 5xx and pre-response network errors retry, 4 attempts max. A client timeout is not retried (the server may already have billed it, so a retry could double-bill). 400 context_length_exceeded: split the line (max 8000 chars).
- Zero-length, undecodable or silent audio is a hard error; outputs are written to `.tmp` and renamed, so a failed run leaves no partial `voiceover.wav`/`timeline.json`.
- Kalpa returns no word timestamps: line windows are exact, word timing inside a line is approximate (~0.15 s).
- Voices: names resolve via `lib/voices.mjs` (11 verified ids). Only horror/hi = Aman was chosen by ear; the rest are unjudged starting points.
- `whisper` per line is not supported in the package build (error).

## Time events for scene code
`timeline.events` has `line00_start`, `line00_end`, ... for every line, plus `<event>` / `<event>_end` for any `lines[i].event`.
```js
import fs from 'node:fs';
import { makeClock } from '../lib/events.mjs';
const clock = makeClock(JSON.parse(fs.readFileSync('timeline.json', 'utf8')));
// inside draw(t):
const k = clock.between('line03', t);          // 0..1 while line 3 is spoken
const flash = Math.abs(t - clock.at('reveal')) < 0.08; // beat on a named line start
const hold = clock.dur('line03');              // seconds the line lasts
// clock.at('nope') throws: unknown event "nope"; did you mean: ...
```
`at(name)` = a point; `dur(name)`/`between(name, t)` need a span (`lineNN`, or `x_start`+`x_end`, or `x`+`x_end`). Unknown names throw.
