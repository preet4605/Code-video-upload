# Source Repository Licenses & Clean-Room Safeguards

*Extracted from `PLAN.md` (verification snapshot: 2026-11-21 via raw GitHub `LICENSE` / `ATTRIBUTION.md` files).*

All code, schemas, and rules in `code-video-studio` v1 are authored **clean-room** on **Node >=22 + HTML5/SVG/Canvas 2D/GSAP/KaTeX + FFmpeg**. No source code is copied from restricted-license repositories.

## 1. Verified License Matrix (All 19 Audited Repos)

| Repository | Verified License | Clean-Room Policy for `code-video-studio` v1 |
| :--- | :--- | :--- |
| **`heygen-com/hyperframes`** | Apache-2.0 | Adapt numeric motion & review-loop concepts cleanly; author original rules & examples |
| **`OpenMontageInc/OpenMontage`** | **AGPL-3.0** | **CONCEPTS ONLY — ZERO CODE REUSE.** Learn pipeline gating & pivot/blink QA ideas clean-room |
| **`Vincentwei1021/video-shotcraft`** | Apache-2.0 *(Caveat: `references/shots/ATTRIBUTION.md` grants NO license for the 124 third-party promo shot cards)* | **Taxonomy & 8-stage director concepts only; import NO shot cards or third-party promo references** |
| **`kajisho5/ffmpeg-skill`** | MIT | Adapt `probe → --dry-run --json → check → look` contract & ordered filter chain cleanly |
| **`remotion-dev/skills`** | **No `LICENSE` file in repo** *(Remotion engine has separate company/commercial license)* | Not used in v1 (v2 future extension only; surface Remotion engine commercial terms if ever enabled) |
| **`feitangyuan/onetake`** | **PolyForm Noncommercial 1.0.0** | **CONCEPTS ONLY — ZERO CODE REUSE.** Use original `window.VideoClock.setTime(seconds)` symbol & clean-room pacing rules |
| **`digitalsamba/claude-code-video-toolkit`** | MIT | Reference "trustworthy text" overlay discipline cleanly (v1 uses HTML/Canvas/FFmpeg instead of MoviePy/Blender) |
| **`EL4CTEO/blender-skills`** | MIT | Deferred to v2 (`Blender bpy` future extension) |
| **`vincentsch/explainroo`** | MIT | Adapt local-first audio-driven timeline concepts cleanly |
| **`adithya-s-k/manim_skill`** | MIT | Deferred to v2 (`ManimCE` future extension) |
| **`mromidev/claude-animated-shorts`** | MIT | Adapt beat curves, pre-word anticipation, procedural SFX/ducking, & black/white/frozen/pop QA concepts cleanly |
| **`kevinbadi/claude-codes-influencers`** | MIT | Adapt declarative rig schema, 7-pose/9-mouth/5-eye layering, & 3-round model-sheet QA concepts into Node/SVG |
| **`OpenFaceFX/OpenFaceFX`** | MIT | Reference viseme/mouth-cue mapping concepts cleanly (v1 Node pipeline uses amplitude/phoneme timing without Python 3.8 deps) |
| **`DanielSWolf/rhubarb-lip-sync`** | MIT | Optional desktop lip-sync backend concept (`A..X` cues) |
| **`JohnHeibel/ClaudeAnimationBase`** | MIT | Adapt boiling linework & emotion/view model-sheet concepts cleanly |
| **`jtydhr88/screenwriting-skills`** | MIT | Adapt multi-speaker dialogue & suspense dramaturgy concepts cleanly |
| **`pixiv/three-vrm`** | MIT | Deferred to v2 (optional 3D VRM avatars) |
| **`gyoridavid/short-video-maker`** | MIT | Reference 9:16 caption timing concepts cleanly |
| **`lemomo-ai/lemo-animi`** | **CC BY-NC 4.0** *(Non-Commercial only)* | **CONCEPTS ONLY — ZERO CODE REUSE.** Conceptual "on twos" cadence & unified sound-sheet structure only |

## 2. Target Release License for `code-video-studio` v1
- **Recommended**: **MIT** (or **Apache-2.0**), ensuring zero AGPL-3.0 or Noncommercial (PolyForm / CC BY-NC) taint.
- **Bundled Runtime Dependencies**:
  - `GSAP` (standard GSAP license — free for standard/non-paywalled tools; verify if commercial SaaS).
  - `KaTeX` (MIT), `FFmpeg` (LGPL-2.1+ / GPL-2+ system binary), `Chromium` (BSD-style), `Noto Fonts` (SIL OFL 1.1).
  - Wikimedia Commons / Public-Domain assets tracked in `assets.json` with automatic top-left CC attribution rendered on-screen.
