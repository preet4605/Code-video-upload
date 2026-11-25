# FFmpeg Mastering, Loudness QA & Fast Path

All post-production and final delivery run through [scripts/master_and_qa.mjs](../scripts/master_and_qa.mjs) using the static ARM64 `bin/ffmpeg` and `bin/ffprobe` from the runtime dir `~/.local/share/code-video-studio` (override `CVS_RUNTIME_DIR`; resolved by `lib/runtime.mjs`).

## 1. CLI Flags (`master_and_qa.mjs`)

- `--project <dir>`: Master a rendered project directory using `timeline.json` and `cache/render_manifest.json`.
- `--input <video.mp4>`: Run Fast Path post-only mode on an existing video file.
- `--start <s>` / `--end <s>`: Optional start (`-ss`) and end (`-to`) trim timestamps in seconds (Fast Path).
- `--lufs <I>`: Target integrated loudness in LUFS (defaults to `timeline.target_lufs` or `-16`).
- `--tp <dBTP>`: Target true-peak ceiling in dBTP (defaults to `timeline.true_peak_dbtp` or `-1.5`).
- `--subtitles <file.ass>`: Optional ASS subtitle file burned into `-vf` via `,ass='<escapedPath>':fontsdir='<STUDIO_ROOT>/fonts'` using bundled `fonts/`.
- `--bgm <path|auto|library>`: Mix background music bed; `auto` synthesizes a deterministic 48 kHz true-stereo bed (`generateBgmBed` — 3-layer night wind/rumble + dissonant bowed-string dread pad + detuned music-box + devotional sacred fifth crossfade for `horror`/`suspense` with scene-aware tension & dead-silence pre-scare drops); `library` resolves `~/.config/code-video-studio/music/<mood>.*` (falling back to `auto`) and applies `buildBgmVolumeExpression(timeline)` tension/silence automation on external tracks, ducked via `sidechaincompress`.
- `--sfx-auto`: Synthesizes 48 kHz stereo WAVs for all 17 built-in `BUILTIN_SFX_NAMES` (`pop`, `whoosh`, `thud`, `stamp_slam`, `heartbeat`, `chime`, `riser`, `footsteps_run`, `boom_hit`, plus pure-JS stereo foley `door_knock`, `door_creak`, `claw_scrape`, `violin_stinger`, `whisper_gust`, `distant_thunder`, `temple_bell`, `fan_hum`) and places them with `adelay`; scare cues trigger `0.04x` dead-silence drops `[t_s - 0.65, t_s - 0.05]`.
- `--preset <default|reel-vocal>`: `reel-vocal` targets `-14 LUFS`, `-1.5 dBTP`, `LRA=4`, and applies vocal `acompressor` + `sidechaincompress` BGM ducking.
- `--out <file.mp4>`: Optional output MP4 path override.
- `--dry-run`: Print planned FFmpeg command JSON without encoding.
- `--json`: Emit full structured QA report JSON.
- `--platform <reels|shorts|tiktok>`: platform profile for duration/fps/bitrate checks (default `reels`).
- `--safe-profile <universal|ads>`: safe-zone overlay profile for `qa_safezone_sheet.png`.
- `--strict`: exit 1 unless the measured verdict is `SHIP`.

## 2. Ordered Mastering Filter Chain

1. **Probe & Validate** (`ffprobe` on inputs; never guess codecs or dimensions).
2. **Lossless-First Concat / Trim**: Concatenate rendered PNGs (`-f concat`) or trim existing MP4s (`-ss ... -to ...`).
3. **Video Format & Subtitles**: Enforce constant FPS, `libx264` High profile (`lib/encode.mjs`: CRF 18, `-maxrate 12M`, closed GOP, bt709 matrix + tags), `-pix_fmt yuv420p`, `-movflags +faststart`, and when `--subtitles <file.ass>` is passed, append `,ass='<path>':fontsdir='<STUDIO_ROOT>/fonts'` with bundled `NotoSans-Regular.ttf`, `NotoSans-Bold.ttf`, and `NotoSansDevanagari-Bold.ttf`.
4. **Loudness Normalization & True-Peak Ceiling**:
   - **Mobile / Reels / Shorts (default)**: `-16 LUFS`, `-1.5 dBTP` (`loudnorm=I=-16:TP=-1.5:LRA=11`)
   - **Web / YouTube**: `-14 LUFS`, `-1.5 dBTP` (`loudnorm=I=-14:TP=-1.5:LRA=11`)
   - **Sample Rate / bitrate**: Always pass `-ar 48000` (AAC `192k`).
   - Known limit: loudnorm runs single-pass (dynamic). Two-pass linear loudnorm is not implemented; a post-encode `ebur128` check and a true-peak retry catch gross misses.

## 3. Post-Encode `ebur128` Loudness Verification & `qaPass` Gates

After encoding, `master_and_qa.mjs` runs `measureLoudness()` via FFmpeg:

```text
ffmpeg -i out.mp4 -af ebur128=peak=true -f null -
```

It parses integrated loudness (`I: ... LUFS`) and true peak (`Peak: ... dBFS`) into `audio_qa` and enforces the following strict `qaPass` thresholds via `evaluateMasterQa()`:
- **Video Stream**: `vStream.codec_name === 'h264'` and `vStream.pix_fmt === 'yuv420p'`.
- **Audio Stream**: `aStream.codec_name === 'aac'` and `aStream.sample_rate === '48000'` (`48000 Hz`).
- **True Peak Ceiling**: `audio_qa.true_peak_dbtp <= truePeak + 0.3` (`<= TP + 0.3 dBTP`).
- **Integrated Loudness Bounds**: `audio_qa.integrated_lufs` within `±2.0 LU` of `targetLufs` (`|integrated_lufs - targetLufs| <= 2.0` when `integrated_lufs > -60`).
- **Contact Sheet**: `qa_contact_sheet.png` exists on disk.

## 4. Fast Path (`--input` Post-Only Mode) & Project Mode Examples

Skip Gates 1–3 when trimming, burning subtitles, normalizing, or generating a contact sheet for an existing video:

```bash
node scripts/master_and_qa.mjs \
  --input path/to/raw.mp4 \
  --start 2.0 --end 17.0 \
  --lufs -16 --tp -1.5 \
  --subtitles path/to/captions.ass \
  --out path/to/master.mp4 \
  --json
```

Use `--dry-run --json` (with `--project <dir>` or `--input <video.mp4>`) to inspect `plannedCommand` without writing files.

## 5. Contact-Sheet & `ffprobe` QA

Every `master_and_qa.mjs` run produces:
- `out/qa_contact_sheet.png`: `3x2` tile grid sampled evenly across the video.
- `ffprobe` JSON summary verifying `h264`, `yuv420p`, `aac`, `48000 Hz`, duration, and dimensions.
- Inspect `qa_contact_sheet.png` in a clean review pass before declaring delivery.

## 6. Measured SHIP/FIX verdict (`scripts/qa_video.mjs`)

Runs automatically after every project master and writes `out/qa_report.json`. Checks on the rendered MP4: codec/pix_fmt/aac/48 kHz, `>= 720 px` and not a draft manifest (1080 recommended), fps vs platform, bt709 tag (warn), High profile (warn), bitrate cap (warn), A/V length match (`<= 0.15 s`), duration vs platform max, WCAG flashes from per-frame luma (`<= 3/s`), `freezedetect` (`> 1.2 s`), `blackdetect`, `silencedetect` (`> 2 s` dead air, lead-in warn), first-0.5 s motion, loudness/true-peak, voice-to-bed `>= 9 LU`, placeholder tone audio. Thresholds live in `lib/profiles.mjs` (`QA_THRESHOLDS`). Always followed by human review.
