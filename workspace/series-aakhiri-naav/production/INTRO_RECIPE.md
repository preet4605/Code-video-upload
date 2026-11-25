# Choice-recap intro: how to make it (standing rule, SERIES_BIBLE §7a)

Work dir = a copy of `production/shared/` next to episode folders (scene imports `../lake_kit.mjs`).
1. `mkdir introNX; script.txt` = 4 NARRATOR lines (see bible); `vo.json`: voice 1eb6c010-34e0-477c-9d24-e915f853359e, temperature 0.7, tempo 1.12, gap 0.12, lead_s 0.1, tail_s 0.2, gaps {"0":0.22,"1":0.1,"2":0.18}, fx {}; copy any brief.json.
2. `KALPA_API_KEY=... node tools/build_vo.mjs introNX` (key only in env).
3. `sed "s/__CHOICE__/A/" tools/intro_scene.tpl.mjs > introNX/scene.mjs` (A or B). Edit card labels (LABEL map) for later votes.
4. `node <skill>/scripts/render_and_lint.mjs --project introNX --skip-story-lint --json`; the silent clip is `introNX/cache/recap_*/segment.mp4`.
5. `python3 -I tools/intro_audio.py introNX` then loudnorm to -14 -> `intro_mix.wav`; mux with the clip (crf 17, bt709, aac 192k).
6. Stitch: `ffmpeg -i intro_full.mp4 -i epNX.mp4 -filter_complex "[0:a]volume=1.6dB[ia];[0:v][ia][1:v][1:a]concat=n=2:v=1:a=1[v][a0];[a0]aresample=96000,alimiter=limit=0.74:attack=2:release=40:level=0,aresample=48000[a]" -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart out.mp4`
7. Check: `ffmpeg -i out.mp4 -af ebur128=peak=true -f null -` -> ~ -14.5 LUFS, peak <= -2 dBFS. A plain concat without the limiter gave +1.1 dBFS peak (AAC overshoot), so keep the limiter.

## Outro (SERIES_BIBLE §7b)
Same pipeline with `outro2/` (script.txt = 4 lines, scene.mjs = night lake + cards). Note: frame 0 must not be black (the render probe rejects it), so the fade-in starts at 35% brightness. Final stitch of all three parts in one pass:
`ffmpeg -i intro_full.mp4 -i epNX.mp4 -i outro_full.mp4 -filter_complex "[0:a]volume=1.6dB[ia];[2:a]volume=1.4dB[oa];[0:v][ia][1:v][1:a][2:v][oa]concat=n=3:v=1:a=1[v][a0];[a0]aresample=96000,alimiter=limit=0.74:attack=2:release=40:level=0,aresample=48000[a]" -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart epNX_final.mp4`
