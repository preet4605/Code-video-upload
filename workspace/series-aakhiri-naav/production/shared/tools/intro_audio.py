import sys, numpy as np, subprocess
from scipy.signal import butter, lfilter
from scipy.io import wavfile
d = sys.argv[1]; SR = 48000
sr, vo = wavfile.read(f'{d}/voiceover.wav'); vo = vo.astype(np.float32); vo = vo[:, 0] if vo.ndim > 1 else vo
if vo.dtype != np.float32 or abs(vo).max() > 2: vo = vo / 32768.0
assert sr == SR, sr
n = len(vo); rng = np.random.default_rng(7)
w = rng.standard_normal(n).astype(np.float32)
b, a = butter(2, 500 / (SR / 2), 'low'); lap = lfilter(b, a, w); lap /= np.abs(lap).max()
env = 0.55 + 0.45 * np.sin(2 * np.pi * 0.23 * np.arange(n) / SR + 1.3)
lap = lap * env
t = np.arange(n) / SR
drone = 0.5 * np.sin(2 * np.pi * 55 * t) + 0.3 * np.sin(2 * np.pi * 82.5 * t + 0.7)
bed = 0.05 * lap + 0.012 * drone
fade = np.minimum(1, t / 0.2) * np.minimum(1, (n / SR - t) / 0.25)
bed = bed * fade
mix = vo * 0.9 + bed
wavfile.write(f'{d}/intro_mix_raw.wav', SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
