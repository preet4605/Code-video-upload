# 3-Tier Character & Asset System

Every external, illustrated, or procedural asset used in a project **must** be declared in `assets.json` matching `templates/assets.schema.json`.

## Tier 1 — Parametric Modular SVG / Canvas Builder

Use Tier 1 for fast, zero-dependency, 100% deterministic characters, props, and icons:
- **Human & Explainer Rigs**: Swappable parameters for skin tone, outfit palette, hair/turban/crown, handheld props (mic, lens, pointer, book), `5–7` body poses, blink intervals, and `9`-shape mouth/jaw sync driven by `timeline.json` speech envelopes.
- **Secondary Cast**: Cartoon animals, birds/ants, silhouettes, and schematic diagrams drawn via reusable `ctx` / SVG helper functions.
- **Boiling Linework (Indie/Horror)**: Apply small seeded vertex jitter stepped on twos (`Math.floor(t * 12)`) for hand-drawn energy without non-deterministic flicker.
- **Provenance**: Log as `"tier": 1`, `"type": "procedural_canvas"` or `"procedural_svg"`, `"license": "MIT"`.

## Tier 2 — Hybrid Illustrated Cutouts + Code Animation (Gods & Mythic Beasts)

Use Tier 2 for ornate cultural/mythological figures (e.g., **Lord Hanuman**, **Shri Krishna**) and giant mythic beasts where pure parametric shapes look overly simplistic:
- **Layered Cutout Architecture**: Supply style-locked transparent PNG/SVG layers (`backdrop`, `aura/halo`, `torso`, `head`, `arms/weapons`, `foreground_particles`) and animate them in code with:
  - Radial divine aura / volumetric light rays
  - 2.5D depth parallax and slow camera dolly/push-in
  - Rim lighting, particle embers, and subtle breathing transforms
- **Mandatory Iconography & Respect QA Checklist** (must pass before final master):
  1. **Traditional Attributes**: Verify accurate iconography, weapons, mudras, tilak, crown/ornaments, and attire for the figure depicted.
  2. **Respectful Proportions**: Ensure dignified framing, balanced anatomy, and zero caricature distortion.
  3. **Clean Alpha Edges**: No white halos, jagged cutouts, or severed-limb seams when layers rotate around pivot points.
  4. **Record Verification**: Set `"respect_qa_passed": true` in `assets.json` after visual inspection of `qa_contact_sheet.png`.

## Tier 3 — Curated Public-Domain / Wikimedia Commons Media

Use Tier 3 for historical, scientific, or documentary photography:
- **Framing**: Present photos inside Polaroid or parchment frames with subtle 2.5D tilt/shadow and Ken Burns pan/zoom.
- **Automatic CC Attribution**: Read `attribution_text` (e.g., `"Photo: Author / CC BY-SA 4.0"`) from `assets.json` and render it cleanly in the top-left corner of the frame (`x: 70*s, y: 290*s` inside the 9:16 safe zone).
- **Required `assets.json` Fields**: `id`, `tier: 3`, `type: "wikimedia_media"`, `path`, `source_url`, `author`, `license`, and `attribution_text`.
