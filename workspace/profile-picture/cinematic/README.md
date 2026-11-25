# Cinematic dark profile picture options (25 Nov 2026)

Code only: a GLSL raymarched 3D scene (SDF head, real point lights, specular, AO, volumetric fog) rendered in headless Chromium, then film post in numpy (bloom, anamorphic streaks, bokeh, chromatic aberration, grade, vignette, grain). No photos, no AI images.

1. cine-1-face.png: full head, most atmosphere
2. cine-2-face-tight.png: tight crop, best at 40px (recommended)
3. cine-3-penguin.png: penguin body with the same face, keeps the handle tie but face is small

Rebuild: see source/build.sh (needs playwright + numpy + pillow).
