# Widgets & Motion Choreography

All reusable 2D explainer, physics, horror, and character widgets live in [lib/widgets.mjs](../lib/widgets.mjs) and run deterministically inside `VideoClock.draw(ctx, width, height, timeline)` with zero `Math.random()` or `Date.now()`.

## 1. Numeric Easing & Math Primitives (`lib/widgets.mjs`)

- `mulberry32(seed)`: Deterministic seeded PRNG for particles, stars, trees, and film grain.
- `clamp01(v)`, `lerp(a, b, t)`: Normalized interpolation primitives.
- `easeOutCubic(t)`: Standard UI/title entrance (`1 - Math.pow(1 - t, 3)`).
- `easeOutBack(t)`: Overshoot spring for stamps, badges, and pop-ins.
- `easeInOutQuad(t)`: Smooth camera pan, zoom, and dolly transitions.

## 2. 2D Camera Rig

Wrap scene layers in a deterministic camera transform before drawing world elements:
- **Pan / Zoom / Dolly**: `ctx.translate(width / 2, height / 2); ctx.scale(zoom, zoom); ctx.translate(-camX, -camY);`
- **Handheld / Horror Shake**: Use `Math.sin(t * 23) * amp` + `Math.cos(t * 31) * amp` (seeded, never `Math.random()`).
- **Tracking Camera**: Set `camX = lerp(camX, targetX, 1)` analytically at `t` (e.g., following an orbital projectile or character).

## 3. Reusable Explainer, Physics & Horror Widgets

- **`drawXrayLens(ctx, { cx, cy, r, drawOuter, drawInner })`**: Renders `drawOuter(ctx)`, then clips a circular magnifying lens (`ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip(); drawInner(ctx); ctx.restore()`) and draws the metallic rim + handle.
- **`drawGauge(ctx, { x, y, r, value01, label, unit })`**: Semi-circular O2 / horror / speedometer gauge with color zones and animated needle.
- **`drawStampSlam(ctx, { x, y, text, color, angleRad, progress01 })`**: Bold bordered stamp with `ctx.measureText()` auto-padding and `easeOutBack` slam-in scale.
- **`drawCaptionBar(ctx, { width, height, text, highlightWord, fontFamily })`**: 9:16 safe-zone bottom caption bar (always ends above `y = 1440 - 12`) with yellow highlight pill on `highlightWord` and measured padding.
- **`drawOrbitalTrail(ctx, { cx, cy, points, headColor, trailColor })`**: Glowing orbital/projectile trajectory from a deterministic physics solver with a bright leading head.
- **`drawPolaroidFrame(ctx, { x, y, w, h, angleRad, image, label, attribution })`**: Angled Tier 3 Wikimedia/PD photo frame with automatic top-left CC attribution.
- **`drawModularCharacter(ctx, opts)` & `drawMythicCutout(ctx, opts)`**: Tier 1 parametric SVG/Canvas character and Tier 2 illustrated cutout with divine aura rays & parallax embers.

## 4. v1.1 Editorial Themes & Widgets (`lib/widgets.mjs`)

- **`EDITORIAL_THEMES`**: 4 curated palettes (`horror`, `science-doc`, `editorial-light`, `vintage-warm`), each providing `{ bg, surface, accent, secondary, text, muted }`.
- **`drawProvenanceHeader(ctx, { width, height, text, dotColor, maxWidth })`**: Safe-zone top pill (`• ARTISTIC DEPICTION`) that auto-scales/truncates via `ctx.measureText()` so it never exceeds `maxWidth`.
- **`drawHudBadge(ctx, { x, y, text, bgColor, textColor, borderColor, progress01 })`**: `easeOutBack` pop-in badge with measured horizontal/vertical padding.
- **`drawChecklistCard(ctx, { x, y, w, title, items, checkedCount, theme })`**: Light/dark titled card with animated green checkmarks and `measureText()` row truncation.
- **`drawQuoteCard(ctx, { x, y, w, quote, author, accentColor })`**: Rounded card with an 8px left accent bar and `measureText()` word-wrapping inside `w - 56`.
- **`drawColorSwatch(ctx, { x, y, size, color, label, sublabel })`**: White-framed color chip card with `easeOutBack` entrance.
- **`drawIconGridCounter(ctx, { x, y, cols, rows, activeCount, activeColor, label })`**: Centered grid of `cols * rows` status cells for visual statistics.
- **`drawWaveformOscilloscope(ctx, { x, y, w, h, t, amp, color, label, mode })`**: Purely deterministic `t`-driven `'voice'` envelope or `'heartbeat'` ECG P-QRS-T waveform.
- **`SAFE_ZONE_916` & `clampToSafeZone(x, y, boxW, boxH, scale)`**: Clamps centered elements strictly inside 9:16 safe bounds (`x: 60..900`, `y: 270..1440`).
- **`applyAmbientCamera(ctx, width, height, progress01, t, opts)`**: Deterministic slow zoom (`1.0 -> 1.045`) + micro-drift (wrap in `ctx.save()`/`ctx.restore()`) guaranteeing `freeze_count: 0`.
- **`drawCinematicVignette(ctx, width, height, strength)`**: Radial dark edge vignette for instant atmospheric depth.
- **`drawEditorialCaption(ctx, opts)`**: Auto-scaled uppercase stroke-outlined captions centered at `SAFE_ZONE_916.centerX` with punctuation-stripped `highlightWord`.
- **`getBeatPulse(t, beatTimes, decay)`**: Deterministic beat-impulse helper returning `{ dt, intensity, beatIndex }` synced to footstep/knock/slam/lyric timestamps.
- **`applyHorrorCamera(ctx, width, height, opts)`**: Beat-synced horror camera rig supporting `'dread_creep'` (escalating push-in toward `focusX, focusY`), `'snap_zoom'` (`easeOutBack` shock reveal), and `'impact_shake'` (damped beat jolt).
- **`getWalkCycle(t, stepsPerSec)`**: Beat-matched locomotion returning `{ phase, bobY, leanRad, armSwing, stepHit01 }` (snaps cleanly to `0` when `stepsPerSec <= 0`).

## 5. Counters, Social Cards & Rewind Loops

- **Animated Counters**: Drive `Math.round(lerp(startVal, endVal, easeOutCubic(p)))` with tabular monospace font (`"DejaVu Sans Mono"` or `"Noto Sans"`).
- **Social Comment Cards**: Draw rounded cards using `ctx.measureText()` for bubble width inside `x: 60..900`.
- **Rewind Loops**: Map `t` backwards (`tEff = duration - (t - rewindStart) * speed`) for crisp visual callbacks without duplicating scene code.
