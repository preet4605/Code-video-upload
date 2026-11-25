#!/usr/bin/env python3
# Synthesised SFX track for the stairwell reel (reel time, 48 kHz stereo). No stock audio.
import numpy as np, json, sys
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000; DUR = 57.3
rng = np.random.default_rng(11)
bm = json.load(open('beat_map.json'))
HITS = [h for h in bm['sub_bass_hits'] if h > 0.2]
ONS = bm['onsets']
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


def horn(dur=1.8, vol=1.0):
    n=int(dur*SR); t=np.arange(n)/SR
    s=sum(np.sin(2*np.pi*f*t) for f in (311,392,466))*np.minimum(1,t/0.03)*np.exp(-t/0.9)
    return s*0.3*vol
def bell(vol=1.0):
    n=int(0.5*SR); t=np.arange(n)/SR
    return (np.sin(2*np.pi*1650*t)+0.5*np.sin(2*np.pi*2480*t))*np.exp(-t/0.12)*vol
def rumble(dur, vol=1.0):
    n=int(dur*SR); t=np.arange(n)/SR
    return lp(rng.standard_normal(n),120)*(0.7+0.3*np.sin(2*np.pi*4*t))*vol*3
def clack(vol=1.0):
    n=int(0.1*SR); t=np.arange(n)/SR
    return bp(rng.standard_normal(n),600,4000)*np.exp(-t/0.012)*vol
def whir(dur, vol=1.0):
    n=int(dur*SR); t=np.arange(n)/SR
    return bp(rng.standard_normal(n),700,2200)*(0.6+0.4*np.sin(2*np.pi*9*t))*vol*0.5
def riser(dur, vol=1.0):
    n=int(dur*SR); t=np.arange(n)/SR
    return bp(rng.standard_normal(n),800,6000)*(t/dur)**2*vol
# intro: dynamo click then whir
put(click(1.0),0.07,0.8); put(whir(14.0,1.0),0.4,0.05)
moving=lambda t:(0.3<t<14.7) or (15.0<t<37.2) or (42.0<t<50.1)
for h in HITS:
    if moving(h): put(thud(0.16,85,0.8),h,0.5)
# lane lights: tick on each vocal onset (phrase A and B)
for o in ONS:
    if 0.3<o<11.6: put(click(0.5),o,0.18)
# crossing riser then silence gap, train horn on the drop
put(riser(3.0,1.0),11.8,0.25)
put(horn(2.2,1.0),14.87,0.8); put(thud(0.5,45,1.0),14.87,1.0); put(rumble(3.0,1.0),14.87,0.25)
put(whir(34.0,1.0),15.2,0.07)
# chase: bangles on every bar, bulb pops in the market
bars=[14.90,16.37,17.84,19.31,20.78,22.25,23.72,25.19,26.66,28.13,29.60,31.07,32.54,34.01,35.48,36.83]
for i,b in enumerate(bars): put(bangles(0.8,6,0.9,1.0+i*0.15),b+0.04,0.25,pan=-0.4)
for b in bars[3:8]: put(shatter(0.3),b,0.15)
# mirror words
for w in (28.46,29.34,30.0,30.64,35.18,35.94): put(bangles(0.9,8,1.0,1.5),w,0.4)
# look back
put(thud(0.5,50,1.0),36.83,0.9); put(bangles(1.2,9,1.0,2),36.85,0.4); put(thud(0.6,45,1.0),37.37,0.8)
# breakdown: crossing bell + goods train
tr=[o for o in ONS if 37.5<o<41.9]
for k,t in enumerate(tr):
    if k%2==0: put(bell(1.0),t,0.18)
put(rumble(4.6,1.0),37.37,0.22)
for t in [o for o in ONS if 38.25<o<41.9]: put(clack(1.0),t,0.16)
for o in ONS:
    if 40.0<=o<41.95: put(bangles(0.3,3,0.7,3),o,0.22)
# re-drop
put(thud(0.6,45,1.0),41.98,1.0); put(slam(1.0),41.98,0.35)
for b in (43.21,44.68,46.15,47.62,49.09): put(click(1.0),b,0.35); put(bangles(0.6,5,0.9,2),b,0.2)
# gate rattle on the roll, latch, open on the hit
for k in range(14): put(click(0.8),50.19+k*0.04,0.4); put(bangles(0.25,3,0.8,3),50.19+k*0.04,0.18)
put(slam(1.0),52.03,0.7)
put(thud(0.7,40,1.0),53.5,1.0); put(bangles(0.8,9,1.0,3),53.5,0.4); put(drip(1.0),53.0,0.3)

# end card (after the song's hard cut): drone swell, eyes tick, bangle, drip
def drone(dur,vol=1.0):
    n=int(dur*SR); t=np.arange(n)/SR
    return (np.sin(2*np.pi*55*t)+0.5*np.sin(2*np.pi*82.5*t)+0.25*np.sin(2*np.pi*110*t))*(np.minimum(1,t/1.2)*np.exp(-np.maximum(0,t-1.8)/0.8))*vol
put(thud(0.6,45,1.0),54.70,0.6); put(drone(2.6,1.0),54.70,0.35)
put(click(1.0),54.95,0.5); put(bangles(1.0,6,1.0,1.2),55.3,0.3,pan=0.2); put(drip(1.0),56.2,0.4)
# intro: sub swell under the title and a soft tick when the streak opens
put(riser(0.8,1.0),0.0,0.0)
# gentle room reverb
ir = np.zeros(int(0.5 * SR)); ir[0] = 1
t = np.arange(len(ir)) / SR
ir += lp(rng.standard_normal(len(ir)), 2500) * np.exp(-t / 0.12) * 0.12
Lw = fftconvolve(L, ir)[:N]; Rw = fftconvolve(R, ir)[:N]
pk = max(np.abs(Lw).max(), np.abs(Rw).max())
Lw, Rw = Lw / pk * 0.5, Rw / pk * 0.5
# hard end at 54.30
e=int(54.30*SR); e2=int(54.70*SR); Lw[e:e2]=0; Rw[e:e2]=0; f=int(0.01*SR); Lw[e-f:e]*=np.linspace(1,0,f); Rw[e-f:e]*=np.linspace(1,0,f); g=int(0.4*SR); Lw[-g:]*=np.linspace(1,0,g); Rw[-g:]*=np.linspace(1,0,g)
import soundfile as sf
sf.write('sfx.wav', np.stack([Lw, Rw], 1), SR, subtype='PCM_16')
print('ok', HITS[:3], len(HITS))
