# Render speed: scripts/render_parallel.mjs

Parallel, cache-aware renderer. Writes the same `cache/render_manifest.json` that `master_and_qa.mjs` reads
(`width,height,fps,draft,scenes[]` with `segmentPath,startFrame,frameCount`), so master/QA work unchanged.
`render_and_lint.mjs` is untouched.

```
node scripts/render_parallel.mjs --project <dir> [--workers N] [--draft] [--reel-720] [--json]
     [--chunk-s 2] [--ffmpeg-threads 1] [--verify [--verify-samples 5] [--seed 1]]
     [--no-cache] [--strict-cache] [--skip-probe] [--skip-purity] [--no-fallback] [--dry-run]
```

## How it works
- Each scene is cut into chunks of about `--chunk-s` seconds (no runts). The layout depends only on the timeline and
  `--chunk-s`, never on `--workers`, so any worker count gives the same segments and the same cache keys.
- `--workers` (default = CPU count) persistent child processes (`child_process.fork`) each load the scene once and render
  chunk jobs, longest first. Each chunk: fresh canvas, own ffmpeg, the exact args of render_and_lint (`videoEncodeArgs`,
  `colorFilter` imported from `lib/encode.mjs`, `-video_track_timescale 30000`, `-an`), closed GOP at the chunk start.
  x264 `-threads` is pinned (`--ffmpeg-threads`, default 1) because x264 output depends on thread count.
- Segments are joined with the ffmpeg concat demuxer (`-c copy`) into `cache/render/video_concat.mp4` (also in the manifest as
  `videoPath`). Audio is never encoded here. Same lint, story lint, approval lock and probe as render_and_lint.

## Purity rule (read this before authoring scenes)
A worker starting at frame N must draw exactly what a sequential render draws at frame N. Therefore a scene must be a pure
function of time: `setTime(t)` + `draw()` may not depend on how many frames were drawn before, on module-level counters or
accumulators, on `Math.random()`/`Date.now()`, or on pixels left on the canvas from the previous frame (paint the full frame;
seed any randomness from the frame index or `t`, e.g. `mulberry32(seed ^ frame)`).

Gate, run on EVERY run: every chunk also renders the next chunk's first frame warm (right after its own frames, not encoded)
and hashes the pixels; a brand-new process renders that frame cold. Any difference means the scene is stateful: the message names
the scene id and frame, parallel output is refused, `cache/render` is deleted and it falls back to
`render_and_lint.mjs --workers 1 --no-cache --max-chunk-s 0` (sequential, warm). `--no-fallback` exits 1 instead.
Proven-pure boundaries are remembered in the chunk's `done.json` and not re-probed while its cache key is unchanged.
"Warm" here means warm from the chunk start; it catches state that accumulates, not every possible dependency.
`--verify` is the stronger check: first frame of every chunk + `--verify-samples` seeded random frames, rendered warm from
frame 0 in one sequential process vs cold in fresh processes. It costs about one sequential render of the reel up to the last
sample, so use it when you add or change a scene, not on every render.

## Segment cache (`<project>/cache/render/<id>_<key>/`)
Key = sha256 of: scene.mjs (and `scenes/<id>.mjs`) plus the transitive closure of relative imports (project modules,
`lib/kit`, `lib/cinema`, ... static, re-export and `import()`); the scene's own timeline slice; captions overlapping the chunk;
all non-scene/non-caption timeline fields (`words`, `audio_cues`, `silences`, `duration_s`) and the id/start/end of the other
scenes; the slice of the scene that owns the chunk's probe frame (so only the last chunk of the previous scene is invalidated
by an edit to the next); `fonts/`; `assets.json`; ENCODER_VERSION + `lib/encode.mjs` source; ffmpeg version line;
@napi-rs/canvas version; width/height/fps/draft/ffmpeg threads; chunk range. Unchanged key and valid `done.json` = reuse.
Stale dirs of the same pattern are pruned. Consequences:
- Editing a shared `scene.mjs` (or any module it imports) re-renders every chunk, by design. Per-scene savings come from
  edits to the timeline slice, or from per-scene files in `scenes/<id>.mjs`.
- Limits: files a scene reads at runtime with `fs` (other than assets.json) are not tracked, and a scene that reads OTHER
  scenes' timeline data (zero-shadow-day reads every scene's `lines`) is not invalidated when those change. Use
  `--strict-cache` (hash the whole timeline) or `--no-cache` for such reels.

## Measured (4 cores, ffmpeg 6.1.1, Node 22; box shared, load noisy: another agent ran tests/renders at times)
zero-shadow-day, 1080x1920, 1836 frames (~0.1 s/frame draw, cheap look), full render incl. lint+probe:

| tool | workers | wall |
|---|---|---|
| render_and_lint (existing) | 1 | 232 s |
| render_and_lint (existing) | 4 | 101 s |
| render_parallel, chunk-s 3 | 1 / 2 / 4 | 273 s / 153 s / 112 s |
| render_parallel, chunk-s 2 (default) | 4 | 115 s (render 95 s, purity gate 13.5 s, lint+probe 6.4 s) |

cinema-demo (one 7 s scene, 210 frames, ~0.35 s/frame): render_and_lint 1 worker 73 s and 4 workers 72 s (one scene is
one chunk, so no parallelism); render_parallel w=1 78 s, chunk-s 3 (2 chunks) 42 s, chunk-s 2 (4 chunks) 32 s.

Cache (zero-shadow-day, w=4): all chunks cached 6.7 s (lint+probe+concat); after editing ONE scene's timeline slice (s5_hand)
19.6 s (4 of 30 chunks re-rendered).

Honest reading: the existing tool already runs scene chunks in parallel (default 4 workers), and on this box the work is
CPU-bound (render ~100 ms + RGBA->yuv/x264 ~120 ms CPU per frame), so parallel speedup tops out near 2.3-2.6x on 4 cores.
The gains of render_parallel are (1) reels with one long or few scenes, (2) cache keys that include imported modules and
lib/kit/cinema (the existing hash only covers lib/*.mjs top level and scene.mjs), (3) the purity gate, (4) ~12% purity overhead
on cheap frames, ~2-3% on 0.5 s/frame looks. It is not faster than render_and_lint at equal worker counts on many-scene reels.

Equivalence: decoded-frame md5 is identical across workers 1/2/4 (verified on both examples), and identical to render_and_lint
when the chunk layout and thread count match (test). Against a differently chunked, differently threaded render the bytes cannot
match (closed GOP at chunk starts, x264 rate-control state, thread count): zero-shadow-day SSIM 0.9980 (below the 0.999 target),
cinema-demo 0.9918 (grainy film look), frame count and duration equal (1836 / 61.2 s, 210 / 7.0 s).

## Running examples from a scratch copy
zero-shadow-day imports `../tools/kit.mjs` and `../../lib/...`, so the folder must sit at `examples/<name>/` with
`examples/tools -> zero-shadow-day/tools` and `lib` next to `examples`; its `voiceover.wav` is gitignored (lint needs the file).
