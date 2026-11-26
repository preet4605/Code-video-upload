# CTC forced alignment spike (Hindi word timings)

Status: SPIKE, NOT ADOPTED. No script is shipped here. On the measurements below CTC did not clearly beat
`lib/align.mjs`, so only these numbers are kept. The working prototype (`align.py`, eval drivers) is in the
session scratchpad: `/tmp/claude-0/-home-user-Code-video-upload/6be59769-edf3-573e-b19d-8511ff23b6e4/scratchpad/align/keep/`.

## What was tested
- Model `Harveenchadha/vakyansh-wav2vec2-hindi-him-4200` (licence field: MIT; Wav2Vec2ForCTC, 67-char Devanagari vocab,
  20 ms frames at 16 kHz). `pytorch_model.bin` 378 MB (the repo also holds a ~1.9 GB `language_model/` that is not needed).
- Install (CPU): torch 2.15.0+cpu, torchaudio 2.11.1+cpu, transformers 5.24.1, huggingface_hub 2.5.0, numpy, soundfile.
  venv 983 MB (torch alone 777 MB), install about 36 s wall on this sandbox, model download about 12 s.
- Own numpy Viterbi (no torchaudio forced_align). Deterministic: repeated runs and 1 vs 4 threads gave byte-identical JSON.
- Audio: 6 Kalpa lines (voice Aman, kalpa-tts-1, T=0.7, 24 kHz), each synthesised twice: natural, and with ' ... ' between 3 groups.
  Lines: 1 plain, 1 with Devanagari English loanwords (फ़ोन, इंटरनेट), 1 with a numeral (25), 1 Hinglish with Latin words, 2 more plain.

## Findings that contradict the research notes
- The CTC blank is id 0 (`<s>`), NOT `pad` id 1. With blank=1 every word got score 0.1-0.4 and garbage greedy output; blank=0
  gave scores 0.9-1.0 and exact greedy text. (The prototype detects blank as the most frequent argmax class.)
- The model never emits nukta (़) and mixes chandrabindu/anusvara (जाऊँगा -> जाऊंगा): CER must be compared modulo those or it false-flags.

## Numbers
Reference = ffmpeg `silencedetect` (highpass 120 Hz, -35 dB, d=0.12 s), internal silences >= 0.3 s, on the ' ... ' versions.
Scored only on the 4 lines (l1, l3, l4, l6) with exactly 2 such silences: 8 boundaries x (word end, next word start) = 16 errors.
Lines l2 and l5 had only 1 such silence (the other boundary was not a measurable pause) and were not scored.

| Aligner | mean abs err | median | max | note |
|---|---|---|---|---|
| lib/align.mjs, text with commas at group ends | 20 ms | 20 | 20 | CIRCULAR: it uses the same silencedetect, error = its own 20 ms edge pad |
| lib/align.mjs, text without punctuation | 375 ms | 351 | 871 | cannot place a pause with no punctuation cue |
| CTC raw (spike span) | 108 ms | 63 | 317 | ends early (signed mean -150 ms), starts late (+66 ms) |
| CTC, end stretched to next start (cap 0.12 s) | 81 ms | 71 | 197 | |

The pre-set bar (mean < 60 ms and < half the estimate's) is NOT met: the estimate is exact by construction on this test,
and CTC is 81-108 ms. This test cannot show CTC beating the estimate; it only shows CTC alone is not as accurate as
silence-snapping at pause edges.

Less circular signals (not a ground truth, no human listen-check was done):
- Words whose span contains the midpoint of a real silence (>= 0.12 s, 33 silences over natural+paused files): CTC raw 3,
  CTC extended 9, estimate with commas 20, estimate without punctuation 33.
- Natural-speech lines only, silences >= 0.15 s (10 of them): estimate (no punctuation) straddles 10/10, CTC raw 1, CTC extended 2.
  Example: l3 the estimate shows "कल" over 2.33-3.15 s while the audio is silent 2.57-3.14 s; CTC puts it at 3.13-3.29.
  Caveat: real scripts carry punctuation, which the estimate uses; the no-punctuation case is the estimate's worst case.
- Mean |CTC start - estimate start| on 64 natural words: 118 ms (median 80, max 801). Which one is right was not measured.
- Nearest-gap error vs those 33 silences: CTC raw 115 ms, CTC ext 105, estimate(commas) 115, estimate(plain) 222 (selection-biased, indicative only).

CPU (4.4 s clip, 4-core box, 1 thread): CTC whole CLI 4.1 s user + 0.4 s sys = about 1.0 CPU s per audio second, dominated
by import/model load (about 3 s); inference alone is a fraction of that. Estimate: ffmpeg silencedetect 0.04 s + node 4 ms.
Wall time with 4 threads was slower (7.4 s) than with 1.

Failure/edge cases seen:
- Latin Hinglish words (topic, how to save money, tension) aligned with scores >= 0.86 via dictionary transliteration; word
  boundaries looked plausible against silences but were not verified. The rule-based fallback for words not in the small dict is crude and untested.
- Numeral 25 spelled पच्चीस: scored OK but its span (0.44-1.01 s) is 570 ms vs the estimate's 390 ms; unverified which is right.
- Nukta words (फ़ोन, सिर्फ़, ज़िंदगी): align fine; raw CER false-flags them unless normalised.
- Greedy-CER flags after normalisation, over 6 natural lines (64 words): पेन (hyp पहन) and हैं (hyp है) only. Whether these are
  real TTS mispronunciations or model errors was not checked by ear. Lowest word scores 0.67-0.80 sat on the same loanword/nukta words.
- Word start is the spike frame of the first char: plosive-initial words can start late (e.g. बिना about 160 ms after the silence end in l6).

## Verdict
Not a clear win; do not replace `alignWordsToVoicedSpans` on this evidence. CTC clearly avoids captions sitting across real
pauses when the script has no punctuation, which the estimate cannot do, but raw CTC edges are 60-150 ms biased and the sample is
6 lines / 16 boundaries from one voice. A hybrid (CTC word order and proportions, snapped to silencedetect edges) looks plausible but is
untested. Unverified: accuracy inside pause-free speech (no ground truth), other voices/speakers/noise, longer lines, human listen-check.
