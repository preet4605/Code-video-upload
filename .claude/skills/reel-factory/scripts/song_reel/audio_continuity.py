#!/usr/bin/env python3
"""Prove the song plays continuously and unaltered in the baked file. usage: audio_continuity.py baked.mp4 original_song.mp3 [song_end_s]
Fails if any 100 ms window is >3 dB below the file's median offset vs the original (a duck/dropout)."""
import sys, subprocess, numpy as np, soundfile as sf, tempfile, os
vid, song = sys.argv[1], sys.argv[2]; end = float(sys.argv[3]) if len(sys.argv) > 3 else None
def load(p):
    t = tempfile.mktemp(suffix='.wav'); subprocess.run(['ffmpeg','-v','error','-y','-i',p,'-ac','1','-ar','48000',t], check=True); x, sr = sf.read(t); os.remove(t); return x, sr
a, sr = load(vid); o, _ = load(song); w = sr // 10; n = int((end or len(o)/sr) - 0.1) * sr
d = np.array([20*np.log10(np.sqrt((a[i:i+w]**2).mean())+1e-9) - 20*np.log10(np.sqrt((o[i:i+w]**2).mean())+1e-9) for i in range(0, n - w, w)])
bad = np.where(d < np.median(d) - 3)[0]
print('median offset %.1f dB, windows >3 dB below: %d of %d' % (np.median(d), len(bad), len(d)))
for i in bad[:20]: print('  dip at %.1f s (%.1f dB)' % (i*0.1, d[i]))
sys.exit(1 if len(bad) else 0)
