# Turn a voiced clip into a close, breathy whisper: keep a thin voice layer, add noise shaped by the voice envelope.
import sys, subprocess, numpy as np
src, dst = sys.argv[1], sys.argv[2]
SR = 48000
raw = subprocess.run(['ffmpeg','-v','error','-i',src,'-f','f32le','-ac','1','-ar',str(SR),'-'],capture_output=True).stdout
x = np.frombuffer(raw, np.float32).copy()
from scipy.signal import butter, sosfilt
env = np.sqrt(np.convolve(x**2, np.ones(480)/480, 'same'))
env = env / (env.max() + 1e-9)
rng = np.random.default_rng(13)
n = rng.standard_normal(len(x)).astype(np.float32)
n = sosfilt(butter(4, [1400, 7500], 'bandpass', fs=SR, output='sos'), n)
n = n / (np.abs(n).max() + 1e-9) * env**1.3
v = sosfilt(butter(2, 300, 'highpass', fs=SR, output='sos'), x)
y = 0.5 * v / (np.abs(v).max() + 1e-9) + 0.75 * n
# tiny close-room reflection
d = int(0.017 * SR); y[d:] += 0.25 * y[:-d]
y = (y / (np.abs(y).max() + 1e-9) * 0.9).astype(np.float32)
subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-c:a','pcm_s16le',dst],input=y.tobytes(),check=True)
