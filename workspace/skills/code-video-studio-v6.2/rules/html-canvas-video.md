# HTML5 / Canvas 2D Video Rules

## 1. `VideoClock.setTime(seconds)` Contract

Every project's `scene.mjs` must export `VideoClock` matching `scripts/render_and_lint.mjs`:

```js
let currentTime = 0;

export const VideoClock = {
  setTime(seconds) {
    currentTime = seconds;
  },
  draw(ctx, width, height, timeline) {
    const t = currentTime;
    const s = width / 1080; // scale factor relative to 1080px base width
    // Pure deterministic draw from `t` and `timeline`
  }
};
```

- **Constant Frame Rate (CFR)**: `render_and_lint.mjs` computes `tSeconds = (startFrame + localIdx) / fps` and calls `VideoClock.setTime(tSeconds)` followed by `VideoClock.draw(ctx, width, height, timeline)`.
- **Stateless Frames**: Never accumulate state across frames (`x += vx` per call breaks crash-resume and draft/full parity). Compute positions analytically as `f(t)`.

## 2. Determinism Ban-List

Never use non-deterministic APIs inside `scene.mjs`:
- **Banned**: `Math.random()`, `Date.now()`, `performance.now()`, `new Date()`, `setTimeout`, `setInterval`, `requestAnimationFrame`, or unpaused CSS `transition`/`animation`.
- **Required**: Use a seeded PRNG (`mulberry32`) keyed by a fixed seed or scene index:

```js
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

## 3. Font Registration & Pill/Badge Padding

On ARM64 PRoot, only DejaVu system fonts are preinstalled. `scripts/render_and_lint.mjs` auto-registers all bundled `.ttf`/`.otf` files from `STUDIO_ROOT/fonts/`. For standalone scene scripts, register fonts relative to `import.meta.url` (never `process.cwd()`):

```js
// @napi-rs/canvas lives in ~/.local/share/code-video-studio/node_modules — load it via lib/runtime.mjs.
import { loadCanvas } from '../lib/runtime.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { GlobalFonts } = await loadCanvas();

const STUDIO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
GlobalFonts.registerFromPath(path.join(STUDIO_ROOT, 'fonts/NotoSans-Bold.ttf'), 'Noto Sans');
GlobalFonts.registerFromPath(path.join(STUDIO_ROOT, 'fonts/NotoSansDevanagari-Bold.ttf'), 'Noto Sans Devanagari');
```

- **Measured Pill Padding**: Never hardcode pill/badge widths for dynamic text. Set `ctx.font` first, call `const textW = ctx.measureText(label).width`, and size the container as `Math.max(minW, textW + 100 * s)` so text never touches or overflows pill borders.

## 4. 9:16 Reels/Shorts Safe-Zone Coordinates (`1080x1920`)

Single source of truth: `lib/profiles.mjs` (`SAFE_PROFILES`; `SAFE_ZONE_916` in `lib/widgets.mjs` derives from it). Keep faces, primary subjects, badges and captions inside:
- **`universal` (default, organic IG/Shorts/TikTok)**: `x: 60..900`, `y: 270..1440` (top 270 clears username/audio chrome; bottom 480 clears caption/audio ticker/action bar; right 180 clears the button rail).
- **`ads` (Meta Reels/Stories ads)**: `x: 65..900`, `y: 270..1248` (Meta's guide: top ~14%, bottom ~35%, sides ~6%).
- Scale all coordinates by `s = width / 1080` so `540x960` drafts match `1080x1920` finals.
- Platform UI changes. After every master open `out/qa_safezone_sheet.png` (red bands) and check on a real phone.

## 5. Optional Headless Chromium (PRoot Flags)

If a scene requires DOM/CSS/KaTeX/SVG-filter rendering via headless Chromium instead of pure `@napi-rs/canvas`, always launch with PRoot-safe flags:

```text
--no-sandbox --disable-dev-shm-usage --headless=new
```
