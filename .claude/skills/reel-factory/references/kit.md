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

`kit.createFigure({age:'child'|'adult'|'elder', sex:'m'|'f', outfit:'uniform'|'kurta'|'saree'|'coat'|'shirt', skin, hair:{style,color}, colors:{a,b,c}, seed, variant:'normal'|'ghost', glasses, bindi, bangles})`.
Hair styles: `crop oiled bob braid bun baldfringe wet`. Proportions: child ~3.7 heads, adult/elder ~6.3; the elder stoops.

`fig.draw(ctx, state)`, `state = {x, feet, height, facing, pose, t, light, gaze:[-1..1,-1..1], expr, mouth, talk, look, reachR/reachL:[px,px], grip:{L,R}, contact}`:

- `pose`: `'stand' 'walk' 'reach' 'holdhand' 'crouch' 'turn' 'cower'` or `{name:'turn', turn:0..1}` (`turn` swings the head/body to the back view), `phase` for the walk cycle.
  `reachR`/`reachL` run a 2-bone arm solver to a screen point (hand-holding, grabbing); `grip` curls the fingers 0..1. The lowest sole is always put on `feet`.
- Face: almond eyes with blink (seeded, `blinkAt(seed,t)`), gaze, glint, brows and mouth from `expr` ('neutral happy afraid sad angry blank worried'); `talk` 0..1 drives visemes, `mouth` may be a name or an openness.
- Form: each part (limb ribbons, garment outlines, hair masses, hands) is a shaped path with a lit -> terminator -> core shadow -> bounce ramp from `light.dir`, a thin ink edge,
  fold lines, a contact shadow at the feet, and a `cin.rimLight` edge per part. `LIGHTS`: `noon` (hard), `lamp`, `moon`, `doorway`, `overcast`; or any `{dir:{x,y}, key, amb, hard, strength, rim, rimA}` with `dir` pointing from the subject toward the light.
- `fig.shadow(ctx, state, {dir:[dx,dy]} | {x,y,floorY}, {alpha, soft, squash})`: all parts projected onto the ground in one fill (no double-dark overlaps). `dir` is screen px per px of height, so `dir*k` with `k -> 0` is the shadow shrinking at the zero-shadow minute.
  Ghosts return `false` and cast nothing.
- `fig.silhouette(state)` (point lists, e.g. for occluders), `fig.bbox(state)`, `fig.joints(state)` (head, hands, ankles in px).
- `variant:'ghost'`: pale blue-grey skin, wet plastered hair with drips, wet sheen on cloth, a dark wet pool at the feet instead of a shadow, almost no idle sway, no blinking.
- Scale guidance: the main subject should be >= 22% of frame height (`height >= 0.22*1920` for a full figure) unless the shot is establishing. For hands/close-ups, draw a giant figure (height 3000 px) and let `reachR` put the hand mid-frame: `examples/zero-shadow-day-v2/scene.mjs` does this for the hand-hold.

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

- Interior walls are flat-shaded quads with a texture per segment: perspective foreshortening of the texture is approximate and the segment seams show on bare ceilings (frames, dado bands and AO hide most).
- Variants of one set differ mostly in palette, time of day and props; two stairwell / street / room looks are close siblings.
- Figures are front/3-quarter puppets: no true profile (the face fades to a back-of-head view), arms hang straight when idle, hands are small mitten-like shapes at body scale, the ghost's limbs look stiff.
- Heat haze comes from `post('horror-day')` and also wobbles straight edges of the set (arch frames); lower `heatHaze.amp` if that is unwanted.
- No crowd/animal/vehicle primitives, no cloth simulation (hems sway from the leg angles only).
