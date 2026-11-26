# Cinema library (`lib/cinema/`)

Camera, light, atmosphere and film look for code-drawn scenes. Everything is a pure function of `(seed, frame or t)`:
no `Math.random`, no `Date`, same inputs give the same pixels (a test greps the library for both). Pooled offscreen
canvases are allocated once per size, never per frame. No new dependencies; the simplex noise is a re-implementation of
Stefan Gustavson's public-domain reference algorithm (credited in `texture.mjs`).

```js
import * as cin from '../../lib/cinema/index.mjs';
```

Space: all positions are the 1080x1920 design space whatever the real canvas size (`ctx.canvas.width/1080` is applied
internally, so 540x960 drafts work). Effects reset the ctx transform; they are screen-space and ignore a camera
transform you applied yourself. `rimLight`, `castShadow`, `glint` and the plane callbacks draw in the transform that is
current when you call them.

Pipeline shape (see `examples/cinema-demo/scene.mjs`): emissive backdrop planes, then lit planes through
`darkMaskLayer`, fog between depth groups, `godRays`, subject, near mist, rain/motes, emissive highlights, foreground
plane, and last `post()`.

## camera.mjs

```js
const cam = cin.createCamera({ focal: 1, x: 0, y: 0, z: 0, roll: 0 });
cam.update(t, cin.pushIn({ dur: 7, amount: 0.14 }), cin.pan({ dur: 7, from: -26, to: 34 }), cin.handheldMove(7, 0.9));
cam.layer(ctx, 2.6, (c, bounds) => drawBuildings(c, bounds));            // plane at depth 2.6
cam.layer(ctx, 6, drawSky, { fullBleed: true });                           // backdrop: scale auto-raised, no exposed edge
const { sx, sy, scale } = cam.project(735, 372, 1.3);                      // where a point on a plane lands on screen
```

A plane is authored "as seen at rest". Depth `d` is in focal units (1 = reference plane). With camera `(x, y, z, roll)`:
`scale = d/(d-z)`, parallax shift `= focal/(d-z)` px per px of camera move, `screen = centre + R(roll)*(scale*(u-centre) - (x,y)*shift)`.
`project(u, v, d)` returns that map. Planes at `d <= z + 0.04` are skipped (`layer` returns false).

- `layer(ctx, depth, drawFn(ctx, bounds), opts)`: `bounds` = visible window of the plane in authored coords (+4 px); fill backdrops to
  it. `opts.fullBleed`: art is a full 1080x1920 backdrop; the scale is raised by a closed-form cover test (push, pan, roll,
  handheld included) so no edge is ever exposed (unit-tested: zero transparent edge pixels after a 15 % push-in with pan, handheld and dutch).
  `opts.blur` px depth-of-field (renders the plane to a pooled canvas), `opts.haze {color, amount}` fog laid over everything
  drawn so far (so farther planes get hazier), `opts.alpha`, `opts.op` composite operation (e.g. `'destination-over'`).
- `cam.apply(ctx, depth)` plane transform without clipping; `cam.coverScale(depth)`; `visibleBounds(cam, depth)`.
- Moves, all `(t) => {x?,y?,z?,roll?}` and pure: `dolly({t0,dur,from,to})`, `pushIn({t0,dur,amount})` (amount 0.15 = reference plane x1.15),
  `pan({from,to})`, `crane({from,to})` (y), `dutch({angle})`, `handheld(seed, amp, t)` (data) / `handheldMove(seed, amp)`
  (about 7 px and 0.2 degrees at amp 1, seeded smooth noise), `whip(t0, dur, dir, {dist})` (out-and-back offset; cut at `t0+dur/2`),
  `whipProgress`. `cam.update` sums them on top of the base camera and derives `cam.velocity` (px/frame) which `post()`
  turns into whip motion blur when `frameInfo.cam` is passed.

## light.mjs

- `darkMask(ctx, lights, {ambient:'#070b16', glow:0.35, flicker:1})`: multiplies an opaque frame by a quarter-res light map
  (unlit areas go to `ambient`), then screens a coloured glow. Lights (design coords):
  `{type:'point', x,y,r,color,intensity}`, `{type:'cone', x,y,angle,spread,length,color,intensity}` (angle 0 = +x, pi/2 = down),
  `{type:'window', rect:[x,y,w,h], throw, throwX, reach}` (rect + skewed floor shaft), `{type:'door', rect, spill}` (strip + floor fan).
  Light stacks additively, soft falloff. Dark materials stay dark (it is a multiply): give surfaces real albedo.
- `darkMaskLayer(ctx, drawFn(offCtx), lights, opts)`: same, for planes with transparent areas (so a sky/skyline painted before
  stays unlit and emissive). Extra cost: three full-res blits.
- `godRays(ctx, occluder, {x,y}, {samples:12, decay:0.93, density:0.85, intensity:0.5, color, radius:360, source, frame, seed})`:
  radial zoom of an occlusion image at quarter res. `occluder` = fn drawing BLACK silhouettes in design coords on the quarter-res
  ctx (use `cam.layer(o, ...)` with the same draw functions, flat black) or a canvas whose alpha is the blocker. Per-frame jitter
  of the sample start from `(seed, frame)` removes banding without flicker.
- `rimLight(ctx, path2d, lightDir, {width:5, color, alpha, soft})`: edge facing the light (`lightDir` points from the subject toward
  the light). The path must be ONE non-self-overlapping outline (even-odd cut): author a silhouette as a single contour.
- `castShadow(ctx, polygon, light, {y, squash}, {alpha, softness, color})`: standing polygon projected onto a ground line from a point
  light `{x,y,floorY}` or directional `{dir:[dx,dy]}`; returns the projected points.
- `glint(ctx, x, y, {size, color, alpha, rot, t})`: sparkle with anamorphic streak (additive).

## atmos.mjs

- `fog(ctx, {depthBands:3, density:0.35, color, t, horizon:0.62, height:0.38, seed, wind})`: drifting fbm bands, far = small/slow/faint,
  near = large/fast/thick; quarter res, one upscaled blit. Call it between depth groups so foreground stays crisp.
- `bloom(ctx, {threshold:0.6, radius:40, strength:0.6})`, `halation(ctx, {threshold:0.8, radius:70, strength:0.5, color:'#ff5a1e'})`,
  `glow(ctx, {bloom, halation, snap, addq})` both in one pass; `brightPass`, `flushAdd` for building chains.
- `depthBlur(layerCanvas, depth, focusDepth, {strength|px})`: returns a blurred pooled canvas (or the input when in focus).
- `heatHaze(ctx, {t, amp:4, strip:8, centre:0.55, spread:0.3, speed})`: strip displacement shimmer.

## film.mjs

- `grain(ctx,{frame,seed,amount:0.35,size:1.3})`: seeded noise canvas generated once, moved by a per-frame seeded offset, blended overlay (pure black stays black, tested).
- `vignette({strength,radius,centerX,centerY,color,hardness})` (cached per parameter set), `chromaticAberration({px})` (left/right 16 % feathered strips, red out, blue in),
  `gateWeave({t,seed,amp})` / `gateWeaveOffset`, `flicker({t,seed,amount,rate})` / `flickerValue`, `letterbox({top,bottom}|{fraction})`,
  `dustScratches({frame,seed,density})` (held 2 frames),
  `directionalBlur({angle,amount,taps})`, `whipBlur(ctx, cam)`.
- `grade(ctx, {gamma, gain, lift, saturation, contrast, splitTone:{shadows,highlights,shadowStrength,highlightStrength}})` built from blend modes:
  gain<1 multiply and gain>1 colour-dodge are exact scales; lift is an exact screen; saturation<1 is the `saturation` blend (exact); gamma
  is a soft-light approximation; `saturation>1` and `contrast` use a full-frame self-overlay (approximate, 15-20 ms); split-tone masks are
  quarter-res luma ramps (shadow colour is ADDED: use dark colours, it lifts blacks by that amount).

## texture.mjs

`noise1(seed,x)`, `valueNoise(seed,x,y,period)`, `fbm(seed,x,y,octaves,period)`, `simplex2`, `simplexFbm`. Cached 256 px tiles (512 for sprites):
`tile(name,{seed,tint,count})`, `pattern(ctx,name,opts)`, `fillTexture(ctx,name,[x,y,w,h],{blend,alpha,scale,ox,oy,seed,tint})`;
names `plaster wood stone brick fabric` (grey-centred: use `overlay`/`soft-light`/`multiply` over a flat fill) and `stars snow frost`
(transparent sprites, source-over). Generated once per `(name, seed, options)` with a per-pixel loop (about 10-40 ms), then free.

## post(ctx, frameInfo, preset)

`cin.post(ctx, { t, frame, seed, cam }, 'horror-night')`; preset is a name or `{ name, stage: params | false }` to override
(`{name:'horror-night', grain:{amount:0.2}, chromaticAberration:false}`). Order: heatHaze, gateWeave (opt-in), CA, grade, bloom+halation
(one pass), vignette, flicker, grain, dustScratches, letterbox. `PRESETS` is exported. One quarter-res snapshot feeds CA, split-tone,
bloom and halation, and the three additive passes share one 1/8-res accumulator and one upscaled blit.

| preset | look |
| --- | --- |
| `horror-night` | desaturated, teal shadows / warm highlights, bloom + halation, edge CA, heavy vignette, flicker, strong grain, dust |
| `horror-day` | harsh noon: heat shimmer, bleach-bypass (sat 0.55 + self-overlay contrast), hard bloom, light vignette; blacks stay black |
| `warm-story` | warm gain, soft bloom, gentle halation, split-tone, light grain |
| `clean-guide` | vignette + a trace of grain only |

## Cost (measured here: 4 cores, shared box, 1080x1920, median of 12 frames incl. flush; `node examples/cinema-demo/tools/bench.mjs`)

| call | ms | call | ms |
| --- | ---: | --- | ---: |
| `cam.layer` plain plane | 0.3 | `bloom` standalone (includes its own snapshot) | 45 |
| `cam.layer` with `blur` 9 px | 37 | `halation` standalone | 34 |
| `darkMask` (2 lights) | 25 | `bloom`+`halation` one pass | 38 |
| `darkMaskLayer` (2 lights) | 49 | `heatHaze` | 34 |
| `godRays` 12 samples | 15 | `depthBlur` 12 px | 23 |
| `rimLight`, `castShadow`, `glint` | < 1 | `grain` | 6 |
| `fog` 3 bands | 17 | `vignette` (cached) | 7 |
| `chromaticAberration` | 28 | `gateWeave` | 36 |
| `grade` gain+saturation | 11 | `grade` contrast | 22 |
| `grade` splitTone | 34 | `directionalBlur` 7 taps | 46 |
| `flicker` | 3 | `letterbox`, `dustScratches` | < 1 |
| **`post` clean-guide** | **19** | **`post` warm-story** | **67** |
| **`post` horror-day** | **104** | **`post` horror-night** | **100** |

Standalone numbers include work that `post()` shares, so the chain costs less than the sum. A whole demo frame (scene + post) is about 0.4 s at
full size (210 frames, about 90 s); draft at 540x960 is about a quarter of that. Timing is noisy when other jobs run on the box.
The performance gate in `tests/phase11_cinema.test.mjs` (horror-night <= 120 ms median over 10 frames, best of 3 attempts) prints the number.

## Gotchas

- Canvas drawing is queued: to time or hash a frame read pixels (`getImageData`) first.
- `drawImage` of a full frame costs 7-10 ms and blend fills 2-7 ms; `ctx.filter` at full size is expensive (blur 8 px ~ 39 ms): the library
  only filters quarter/1/8-res copies.
- `fillRect` with a pattern is slow in this canvas (about 45 ms full frame): grain therefore blits a cached canvas.
- Effects assume an OPAQUE frame unless stated (`darkMaskLayer` is the exception): clear/paint a backdrop before layers.
- Metrics note: `lib/visual_metrics.mjs` targets (sharp_edges, contrast) were calibrated on outlined flat-colour references; a soft filmic frame scores low on them
  by construction (see the demo numbers).
