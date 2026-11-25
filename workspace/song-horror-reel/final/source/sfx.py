#!/usr/bin/env python3
# Synthesised SFX track for the stairwell reel (reel time, 48 kHz stereo). No stock audio.
import numpy as np, json, sys
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000; DUR = 42.36
rng = np.random.default_rng(11)
bm = json.load(open('beat_map.json'))
HITS = [h - 12.0 for h in bm['sub_bass_hits'] if h - 12.0 > 0.2]
N = int(DUR * SR); L = np.zeros(N); R = np.zeros(N)

def put(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR);
    if i >= N: return
    e = min(N, i + len(sig)); s = sig[: e - i] * gain
    L[i:e] += s * (1 - max(0, pan)); R[i:e] += s * (1 + min(0, pan))

def env(n, a=0.002, d=0.1):
    t = np.arange(n) / SR; return np.minimum(1, t / a) * np.exp(-t / d)
def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)
def lp(x, f): return sosfilt(butter(2, f, btype='low', fs=SR, output='sos'), x)

def thud(dur=0.18, f0=95, vol=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * (f0 * np.exp(-t * 14)) * t) * np.exp(-t / 0.05)
    nz = lp(rng.standard_normal(n), 900) * np.exp(-t / 0.012) * 0.5
    return (body + nz) * vol
def bangles(dur=0.9, n_hits=7, vol=1.0, tightness=1.0):
    n = int(dur * SR); out = np.zeros(n)
    for k in range(n_hits):
        off = int(abs(rng.normal(0, 0.12 / tightness)) * SR * (k + 1) * 0.35);
        f = rng.choice([2900, 3600, 4300, 5200, 6100, 7000]) * rng.uniform(0.97, 1.03)
        m = int(0.35 * SR); t = np.arange(m) / SR
        s = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t)) * np.exp(-t / rng.uniform(0.05, 0.14)) * rng.uniform(0.4, 1)
        if off + m < n: out[off:off + m] += s
    return out * vol
def drip(vol=1.0):
    n = int(0.4 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * (1400 + 1800 * np.exp(-t * 55)) * t) * np.exp(-t / 0.035)
    # small room tail
    tail = lp(rng.standard_normal(n), 3000) * np.exp(-t / 0.12) * 0.05
    return (s + tail) * vol
def click(vol=1.0):
    n = int(0.12 * SR); t = np.arange(n) / SR
    return (bp(rng.standard_normal(n), 1800, 6500) * np.exp(-t / 0.006) + np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.02) * 0.6) * vol
def wetstep(vol=1.0):
    n = int(0.3 * SR); t = np.arange(n) / SR
    return (lp(rng.standard_normal(n), 1400) * np.exp(-t / 0.05) * np.minimum(1, t / 0.003) + bp(rng.standard_normal(n), 500, 2500) * np.exp(-t / 0.02) * 0.4) * vol
def shatter(vol=1.0):
    n = int(1.4 * SR); out = np.zeros(n)
    for k in range(40):
        off = int((rng.random() ** 2) * 0.9 * SR); f = rng.uniform(2500, 9000); m = int(0.25 * SR); t = np.arange(m) / SR
        s = np.sin(2 * np.pi * f * t) * np.exp(-t / rng.uniform(0.01, 0.07)) * rng.uniform(0.2, 1)
        if off + m < n: out[off:off + m] += s
    lowc = lp(rng.standard_normal(n), 900) * np.exp(-np.arange(n) / SR / 0.1) * 0.5
    return (out * 0.35 + lowc) * vol
def slam(vol=1.0):
    n = int(1.2 * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * (70 * np.exp(-t * 5)) * t) * np.exp(-t / 0.22)
    wood = bp(rng.standard_normal(n), 120, 900) * np.exp(-t / 0.08)
    return (body * 1.1 + wood * 0.6) * vol
def buzz(dur, vol=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * 100 * t) + 0.6 * np.sin(2 * np.pi * 200 * t) + 0.3 * np.sin(2 * np.pi * 300 * t)) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t))
    return (s * 0.5 + bp(rng.standard_normal(n), 2000, 6000) * 0.08) * vol

# 0.07 bulb snaps on, buzzes through the cold open
put(click(1.0), 0.07, 0.8); put(buzz(2.8, 1.0), 0.1, 0.22)
for h in (0.26, 0.47, 1.07): put(click(0.6), h, 0.35)
# her bangles, once, so the viewer can half-hear it in the intro
put(bangles(1.0, 6, 1.0), 1.55, 0.18, pan=0.5)
# climb: each footfall on a sub-bass hit while he moves
moving = lambda t: (2.9 < t < 7.2) or (7.9 < t < 10.2) or (10.8 < t < 14.6) or (15.2 < t < 17.5) or (18.2 < t < 21.0) or (31.2 < t < 39.7)
for h in HITS:
    if moving(h): put(thud(0.16, 85, 0.8), h, 0.5)
# bangles one step closer every blackout cycle
for t, tight in ((4.4, 1.0), (6.1, 1.0), (12.6, 1.0), (13.4, 1.2), (16.1, 1.2), (17.1, 1.4), (19.6, 1.6), (20.8, 1.6), (22.2, 1.8), (23.0, 2.0), (23.7, 2.0)):
    put(bangles(0.9, 7, 0.9, tight), t, 0.35, pan=-0.4)
# blackouts: click off/on, thump
for b in (7.31, 10.25, 14.66, 17.6):
    put(click(1.1), b, 0.8); put(thud(0.3, 55, 0.6), b, 0.7); put(click(1.2), b + 0.62, 0.9); put(click(0.8), b + 0.72, 0.6)
# wet prints: drips
for t in (8.9, 9.7, 10.6, 12.1, 18.5, 19.6, 20.3, 21.4, 22.3, 33.8, 35.2): put(drip(0.8), t, 0.3, pan=rng.uniform(-0.5, 0.5))
# the figure above: slow wet steps, one per bar from 20.5
for i, t in enumerate(np.arange(20.54, 24.9, 1.47)): put(wetstep(0.9), t, 0.35, pan=0.3)
# --- the turn (24.95): everything stops, a single bangle ring, then glass
put(bangles(1.2, 5, 1.0, 0.5), 25.7, 0.3, pan=0.0)
put(bangles(1.6, 6, 0.8, 0.6), 27.0, 0.22, pan=-0.2)
put(shatter(1.0), 28.95, 0.9)
put(drip(1.0), 29.5, 0.3)
# re-drop: scoop and run (his own bangle fragments rattle), wet steps closing
for h in HITS:
    if 31.2 < h < 39.7: pass
for t in np.arange(31.2, 38.5, 0.52): put(bangles(0.4, 3, 0.7, 2.0), t, 0.18, pan=-0.2)
for i, t in enumerate(np.arange(34.6, 38.6, 0.55)): put(wetstep(1.0), t, 0.45 + 0.04 * i, pan=0.4)
for t in (38.4, 38.52): put(shatter(0.5), t, 0.0)
put(bangles(0.7, 9, 1.0, 3.0), 38.55, 0.4, pan=0.0)  # pass-by
# door
for k in range(7): put(click(0.6), 38.19 + k * 0.08, 0.35)
put(slam(1.0), 40.03, 1.0)
put(drip(1.0), 41.7, 0.6)
put(drip(0.9), 42.0, 0.4)

# gentle room reverb
ir = np.zeros(int(0.5 * SR)); ir[0] = 1
t = np.arange(len(ir)) / SR
ir += lp(rng.standard_normal(len(ir)), 2500) * np.exp(-t / 0.12) * 0.12
Lw = fftconvolve(L, ir)[:N]; Rw = fftconvolve(R, ir)[:N]
pk = max(np.abs(Lw).max(), np.abs(Rw).max())
Lw, Rw = Lw / pk * 0.5, Rw / pk * 0.5
# hard end at 42.36 with a short fade so it is clean
f = int(0.02 * SR); Lw[-f:] *= np.linspace(1, 0, f); Rw[-f:] *= np.linspace(1, 0, f)
import soundfile as sf
sf.write('sfx.wav', np.stack([Lw, Rw], 1), SR, subtype='PCM_16')
print('ok', HITS[:3], len(HITS))
