#!/usr/bin/env python3
"""Starter audio measurement for a song reel (not a replacement for listening). usage: beat_map.py song.mp3 out.json
Writes: duration_s, tempo_bpm (tracker; may be half/double time), sub_bass_hits (real bass-hit times), onsets, vocal_windows (mid-band
phrases, gaps > 0.45 s split them), first_bass_s (usually the DROP), band_table (bass/mid/hat dB per 0.5 s: read it around every section
change), loudness_lufs. Validated once: finds 69/84 of the hand-checked reference hits within 50 ms, first bass 14.83 vs real drop 14.87 -> treat as a starter, refine the drop and any missed hit from band_table.
loudness_lufs. Cut to sub_bass_hits, NOT to a bar grid: grids drift (36.95 grid vs real 36.83/37.37 on the reference song)."""
import sys, json, subprocess, re, numpy as np, librosa
from scipy.signal import find_peaks
src, out = sys.argv[1], sys.argv[2]
y, sr = librosa.load(src, sr=22050, mono=True); dur = len(y) / sr; hop = 256
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop)); f = librosa.fft_frequencies(sr=sr, n_fft=2048); tt = librosa.frames_to_time(np.arange(S.shape[1]), sr=sr, hop_length=hop)
band = lambda lo, hi: 20 * np.log10(np.sqrt((S[(f >= lo) & (f < hi)] ** 2).sum(0)) + 1e-9)
bass, mid, hat = band(30, 120), band(300, 3000), band(5000, 10000)
# bass hits: positive rise of the bass-band envelope, peak picked
rise = np.maximum(0, np.diff(bass, prepend=bass[0])); rise = np.convolve(rise, np.ones(3) / 3, 'same')
pk, _ = find_peaks(rise, height=max(2.0, np.percentile(rise, 97) * 0.5), distance=int(0.12 * sr / hop))
hits = [round(float(tt[i]), 3) for i in pk if bass[i] > np.percentile(bass, 60)]
onsets = [round(float(t), 3) for t in librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop, units='time', backtrack=False)]
tempo = float(np.atleast_1d(librosa.beat.beat_track(y=y, sr=sr)[0])[0])
# vocal/mid phrase windows
act = mid > np.percentile(mid, 40); win = []; s = None
for i, a in enumerate(act):
    if a and s is None: s = tt[i]
    if not a and s is not None:
        if win and s - win[-1][1] < 0.45: win[-1][1] = float(tt[i])
        else: win.append([float(s), float(tt[i])])
        s = None
win = [[round(a, 2), round(b, 2)] for a, b in win if b - a > 0.8]
table = []
for t in np.arange(0, dur, 0.5):
    m = (tt >= t) & (tt < t + 0.5)
    if m.any(): table.append({'t': round(float(t), 1), 'bass_db': round(float(bass[m].mean()), 1), 'mid_db': round(float(mid[m].mean()), 1), 'hat_db': round(float(hat[m].mean()), 1)})
lufs = None
try:
    r = subprocess.run(['ffmpeg', '-nostats', '-i', src, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    lufs = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1])
except Exception: pass
json.dump({'file': src, 'duration_s': round(dur, 3), 'tempo_bpm': round(tempo, 1), 'sub_bass_hits': hits, 'onsets': onsets, 'vocal_windows': win,
           'first_bass_s': hits[0] if hits else None, 'band_table': table, 'loudness_lufs': lufs}, open(out, 'w'), indent=1)
print('duration %.2f s, tempo %.1f (check half/double), %d bass hits, %d onsets, first bass hit %s, %s LUFS' % (dur, tempo, len(hits), len(onsets), hits[0] if hits else None, lufs))
