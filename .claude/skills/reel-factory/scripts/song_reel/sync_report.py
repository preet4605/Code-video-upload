#!/usr/bin/env python3
"""Measure picture-vs-song sync from a FINISHED video. usage: sync_report.py video.mp4 beat_map.json [drop_s] [hit_lo hit_hi]
Prints: first-bright-frame offset at the drop, and per-hit offset of the largest frame-to-frame change near each bass hit."""
import sys, subprocess, json, numpy as np
vid, bm_path = sys.argv[1], sys.argv[2]
drop = float(sys.argv[3]) if len(sys.argv) > 3 else None
lo, hi = (float(sys.argv[4]), float(sys.argv[5])) if len(sys.argv) > 5 else (0, 1e9)
fps = 30
raw = subprocess.run(['ffmpeg','-v','error','-i',vid,'-vf','scale=108:192,format=gray','-f','rawvideo','-'],capture_output=True).stdout
v = np.frombuffer(raw, np.uint8).reshape(-1, 192, 108).astype(float); m = v.mean((1, 2)); e = np.abs(np.diff(v, axis=0)).mean((1, 2))
bm = json.load(open(bm_path)); H = [h for h in bm['sub_bass_hits'] if lo < h < min(hi, len(m)/fps - 0.3)]
if drop:
    a, b = int((drop-0.15)*fps), int((drop+0.35)*fps); i = a + np.argmax(np.diff(m)[a:b]); print('drop frame %.4f vs %.2f: %+.0f ms' % ((i+1)/fps, drop, ((i+1)/fps-drop)*1000))
o = []
for h in H:
    a, b = int((h-0.2)*fps), int((h+0.2)*fps); j = a + np.argmax(e[a:b]); o.append(((j+1)/fps - h)*1000)
o = np.array(o); print('hits %d: median %+.0f ms, within 1 frame (34 ms): %d/%d' % (len(o), np.median(o), (np.abs(o) <= 34).sum(), len(o)))
for h, d in zip(H, o):
    if abs(d) > 34: print('  off: hit %.2f s -> %+.0f ms' % (h, d))
