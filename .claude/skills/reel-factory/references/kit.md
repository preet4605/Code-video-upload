# Sets and characters kit (`lib/kit/`)

One-point-perspective sets, an illustrated puppet character system and a few props, built on `lib/cinema` (camera `layer()`, `darkMask`,
`godRays`, `rimLight`, `fog`, textures, `post`). Everything is a pure function of `(seed/spec, state)`: no `Math.random`, no `Date` (a test greps for both).
Design space is 1080x1920 whatever the canvas size.

```js
import * as kit from '../../lib/kit/index.mjs';   // buildSet, SET_NAMES, VARIANTS, createFigure, LIGHTS, props, cin
const { cin } = kit;
```

## Sets

`kit.buildSet(name, opts)`; names: `schoolCourtyard villageAangan haveliCorridor templeSteps corridor stairwell roadNight street room`.
Common opts: `seed`, `tod` ('noon'|'day'|'dusk'|'night'), `palette` ('whitewash cream green blue ochre pink grey mud'), `wear` 0..1 (stains, streaks, cracks),
`variant` (see `kit.VARIANTS`: two looks per set), `props` (courtyard: `['well','tree']`), `shadowK` (sun shadow length; 0 = zero-shadow minute).

A set is `{ layers, lights, vp, groundH, upm, palette, lightsAt(cam,t), render(ctx,cam,t,{subjects}), occluder(o,cam,t), place({z,x,meters}), figureLight(cam,at,t) }`:

- `layers[]`: `{id, depth, kind:'back'|'lit'|'fg', fullBleed?, blur?, draw(c, bounds, occ, t)}`; `occ = true` draws flat black (a `godRays` occluder).
  Depth is in metres (1 m = 1 focal unit = the cinema layer depth). Every set has 3+ distinct depths and at least one real foreground layer
  (doorframe jamb, verandah pillar, neem branch, railing, cable, out-of-focus pot or bells; blurred and lit, never a flat black box).
- `lights[]`: motivated hooks in authored coords with a `depth`: `{id, kind:'sun'|'lamp'|'moon'|'window'|'door'|'diya', type:'point'|'cone'|'window'|'door'|'sun', x, y, depth, r, color, intensity, flicker}`.
  `set.lightsAt(cam, t)` projects them through the camera to screen lights for `cin.darkMask` / `godRays` (call it every frame).
- `render(ctx, cam, t, {subjects:[{depth, draw(ctx, cam)}], lit, mask})`: back layers, lit layers (through `darkMaskLayer` for night/dusk, straight for day:
  noon sets bake hard sun shadows and deep arch/eave shade), then subjects and foreground layers interleaved by depth. The subject callback runs in design space.
- `place({z, x, meters})` -> `{x, feet, height}`: where a figure of `meters` stands on the floor at depth `z` (`x` in metres). 1.6 m at z = 1.35 is 40% of frame height.
- `figureLight(cam, at)`: a figure light preset aimed at the strongest light hook (or the sun), so characters and set agree.

Builders: `tunnel.mjs` (interior box: ring segments drawn at their far edge and extended toward the camera so a push-in never opens a gap; wall objects are their own layers;
corridor, stairwell, room, haveli arcade and the alley are parameter sets on it) and `open.mjs/open2.mjs` (sky / horizon / mass / side masses / ground detail / foreground; one cached
perspective ground per set, blitted from each layer's base line). Surfaces use cinema `plaster brick wood stone fabric` tiles plus seeded stains and streaks, edge highlights and AO strips in corners.

```js
const set = kit.buildSet('corridor', { variant: 'hostel', seed: 3 });
const cam = cin.createCamera({});
cam.update(t, cin.pushIn({ dur: 6, amount: 0.12 }), cin.handheldMove(3, 0.8));
const p = set.place({ z: 1.6, x: 0.1, meters: 1.6 });
set.render(ctx, cam, t, { subjects: [{ depth: 1.6, draw: (c) => fig.draw(c, { ...p, pose: 'walk', t, light: set.figureLight(cam, [p.x, p.feet - 200]) }) }] });
cin.post(ctx, { t, frame, seed: 5, cam }, 'horror-night');
```

## Figures

`kit.createFigure({age:'child'|'adult'|'elder', sex:'m'|'f', outfit:'uniform'|'kurta'|'saree'|'coat'|'shirt', skin, hair:{style,color}, colors:{a,b,c}, seed, variant:'normal'|'ghost', glasses, bindi, bangles, style:'illustrated'|'horror'})`.
Hair styles: `crop oiled bob braid bun baldfringe wet wetveil`. Proportions: child ~3.7 heads, adult/elder ~6.3; the elder stoops.

**`style`**: `'illustrated'` (default; the big-headed story / kids puppets) or `'horror'`. Horror = adult-leaning proportions (head 0.134 of height for adults, 0.2 for children; longer neck, limbs and hands; narrower build), low-key faces
(brow-ridge shadow, eyes in the dark, smaller lids, **no catchlight unless `state.eyeLight` > 0**, i.e. a motivated source such as a door lights the face; below ~70 px of head height the eyes are shadowed sockets with no pupils),
desaturated skin, darker cloth, 1.45x rim light. Use it for every living figure in a horror reel; keep `illustrated` for story / funny. `horror` + `variant:'ghost'`: elongated (neck x1.3, arms x1.1), pale grey-green skin with a faint
subsurface tint at the terminator (soft ramps only, never hard bands or a screen overlay: it reads as wet skin, not chrome), hair `wetveil` (wet strands plastered over the face, one slit where a pale eye shows), uneven shoulders, tilted head, a few small
soft wet highlights on limbs and hands, **no shadow and no wet pool** (`fig.shadow` returns false for any ghost; a faint pale sheen above the floor line is the only thing at the feet).

`fig.draw(ctx, state)`, `state = {x, feet, height, facing, pose, t, light, gaze:[-1..1,-1..1], expr, mouth, talk, look, reachR/reachL:[px,px], grip:{L,R}, contact}`:

- `pose`: `'stand' 'walk' 'reach' 'holdhand' 'crouch' 'turn' 'cower'` or `{name:'turn', turn:0..1}` (`turn` swings the head/body to the back view), `phase` for the walk cycle.
  `reachR`/`reachL` run a 2-bone arm solver to a screen point (hand-holding, grabbing); `grip` curls the fingers 0..1. The lowest sole is always put on `feet`.
- Face: almond eyes with blink (seeded, `blinkAt(seed,t)`), gaze, glint, brows and mouth from `expr` ('neutral happy afraid sad angry blank worried'); `talk` 0..1 drives visemes, `mouth` may be a name or an openness.
- Form: each part (limb ribbons, garment outlines, hair masses, hands) is a shaped path with a lit -> terminator -> core shadow -> bounce ramp from `light.dir`, a thin ink edge,
  fold lines, a contact shadow at the feet, and a `cin.rimLight` edge per part. `LIGHTS`: `noon` (hard), `lamp`, `moon`, `doorway`, `overcast`; or any `{dir:{x,y}, key, amb, hard, strength, rim, rimA}` with `dir` pointing from the subject toward the light.
- `fig.shadow(ctx, state, {dir:[dx,dy]} | {x,y,floorY}, {alpha, soft, squash})`: all parts projected onto the ground in one fill (no double-dark overlaps). `dir` is screen px per px of height, so `dir*k` with `k -> 0` is the shadow shrinking at the zero-shadow minute.
  Ghosts return `false` and cast nothing.
- `fig.silhouette(state)` (point lists, e.g. for occluders), `fig.bbox(state)`, `fig.joints(state)` (head, hands, ankles in px).
- `variant:'ghost'` (illustrated): pale blue-grey skin, wet plastered hair with drips, a dark wet pool at the feet instead of a shadow, almost no idle sway, no blinking. Prefer `style:'horror'` + ghost (above).
- Hands: `state.grip {L,R}` curls 0..1 (a fold-over-the-palm fist above ~0.5), `state.curls {R:[index,middle,ring,little]}` per-finger curl (`[0,1,1,1]` = raised index), `state.thumbTuck {R}` 0..1, `state.spread`. A hand is a palm + four fingers with three phalanges and a two-segment thumb; at body scale the fingers are separated by a gap and a fan with a distinct thumb, in close-ups it adds creases, nails and (ghost) small wet highlights; shading is a soft gradient across each finger. Line widths are clamped in screen px (ink 0.9-3.4 px, rim 1.2-8 px, and every `lineWidth` above ~900 px figure height is capped toward ~5.5 px at 3000 px), so a giant close-up does not get 10 px ink.
- Scale guidance: the main subject should be >= 22% of frame height (`height >= 0.22*1920` for a full figure) unless the shot is establishing. For hands/close-ups, draw a giant figure (height 3000 px) and let `reachR` put the hand mid-frame; keep the figure's head OFF frame (a 3000 px head and its hair is a black mass in a corner): `examples/zero-shadow-day-v2/scene.mjs` s5 puts the ghost's body past the right edge and only its long arm reaches in. A near-silhouette against a bright door (`examples/zero-shadow-day-v2/dadi_shot.mjs`): draw the figure to a pooled canvas, crush it with `source-atop`, then cut ONE rim by subtracting the alpha mask shifted away from the light.

## Gallery and the ZSD v2 comparison

`node examples/kit-gallery/render.mjs [outDir]` writes `sets.jpg` (every set, 2 variants) and `figures.jpg` (ages / outfits / poses, the `horror` row, hand close-ups and body-scale hands x3); JPEG q85 keeps each sheet under 1.5 MB.
`node examples/zero-shadow-day-v2/tools/compare.mjs` renders the original ZSD scene and v2 side by side into `before_after.jpg` and `metrics.json` (the visual_metrics pipeline on 3 keyframes per shot).

## Props (`kit.props`)

`framedInset(c,{x,y,w,h,kind:'mirror'|'phone'|'lift', content(c,w,h,t)})`, `liftDisplay(c,{x,y,text})`, `noteCard(c,{x,y,w,h,rot,lines})`, `clock(c,{x,y,r,h,m,glow})`,
`diya(c,{x,y,s,t})`, `torch(c,{x,y,angle})` (returns a cone light for `darkMask`), `well(c,{cx,cy,rx})`. Bicycles and anything needing IK were skipped.

## Cost (measured here: shared 4-core box, 1080x1920, median of 8 frames, canvas flushed with `getImageData`; `node examples/kit-gallery/_dev/bench.mjs` style)

| element | ms | element | ms |
| --- | ---: | --- | ---: |
| set frame (`render`, no post): schoolCourtyard | 216 | figure child 620 px | 13 |
| villageAangan | 152 | figure adult walking 900 px | 22 |
| haveliCorridor | 220 | figure saree 900 px | 24 |
| templeSteps (night mask) | 162 | ghost 620 px | 17 |
| corridor (20 layers, mask) | 403 | giant figure 3000 px (close-up) | 40 |
| stairwell (33 layers, mask) | 346 | `fig.shadow` 900 px | 3 |
| roadNight | 132 | noteCard / clock / framedInset | 4 / 0.3 / 2.4 |
| street | 211 | `post('horror-day')` | 94 |
| room | 167 | first frame of a set (textures, ground cache) | 230-1600 |

A full shot frame is about 0.35-0.55 s at 1080x1920 (set + figures + post); 540x960 drafts are about a quarter. Sets with many lit layers (corridor, stairwell) are the slow ones:
the dark mask runs once but every wall segment and wall object is its own full-canvas layer.

## Known weak points

- Interior walls are flat-shaded quads: perspective foreshortening of the texture is approximate. Each segment layer paints its surfaces from the camera plane out to its far edge with the texture origin / scale / stains anchored to the whole box and fog as a continuous depth gradient, so bare ceilings, floors and walls show no segment seams (checked on haveli and room with a 15% push-in); the price is more fill per layer (corridor 20+ layers is the slow one). Wall objects and frames are still separate layers, so a very large camera move can still show a parallax step at an object edge.
- Variant B of stairwell (`office`: day, grey, 9 wide steps), street (`dry`: dusk, narrower alley with the brick wall on the other side) and room (`girls`: day, window on the left wall) change time of day, palette and layout; roadNight, corridor, templeSteps and villageAangan variants are still palette / prop swaps.
- Figures are front/3-quarter puppets: no true profile (the face fades to a back-of-head view), `turn` swings only the head (a "back" view still shows the shirt front and tie; fine as a near-silhouette, wrong in light), arms hang straight when idle, the horror face is stylised (long jaw on elders), a thumb overlaps the palm face rather than wrapping.
- Heat haze comes from `post('horror-day')` and also wobbles straight edges of the set (arch frames); lower `heatHaze.amp` if that is unwanted.
- No crowd/animal/vehicle primitives, no cloth simulation (hems sway from the leg angles only).
