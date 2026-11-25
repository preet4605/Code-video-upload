# Sound bed for "Zero Shadow Day": fully synthesized (no samples). usage: python3 -I sound_design.py <project_dir>
# World of sound: cicadas + loo wind outdoors, a muffled kitchen, a total audio dead zone while the shadows are gone,
# heartbeat + drip on hot stone, a true pre-scare drop, whisper bed, stingers.
import sys, json, numpy as np
from scipy.signal import butter, sosfilt

proj = sys.argv[1]
TL = json.load(open(f"{proj}/timeline.json"))
SR = 48000
D = TL["duration_s"]
N = int(D * SR) + SR
t = np.arange(N) / SR
rng = np.random.default_rng(11)
L = np.zeros(N); Rr = np.zeros(N)

def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "bandpass", fs=SR, output="sos"), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, "lowpass", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "highpass", fs=SR, output="sos"), x)
def db(x): return 10 ** (x / 20)
def smooth(a, b, x): k = np.clip((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k)
def add(sig, at, gain_db=0, pan=0.0):
    i = int(at * SR); n = min(len(sig), N - i)
    if n <= 0 or i < 0: return
    g = db(gain_db); l = g * np.sqrt((1 - pan) / 2) * np.sqrt(2); r = g * np.sqrt((1 + pan) / 2) * np.sqrt(2)
    L[i:i + n] += sig[:n] * l; Rr[i:i + n] += sig[:n] * r
def env_ar(n, a, r): e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na); e[na:] = np.exp(-np.arange(n - na) / (r * SR)); return e

scene = {s["id"]: s for s in TL["scenes"]}
line = {l["i"]: l for s in TL["scenes"] for l in s["lines"]}
def W(li, word, nth=0):
    ws = [w for w in TL["words"] if w["line"] == li and w["word"].strip(".,!?").lower() == word.lower()]
    return (ws[nth] if len(ws) > nth else ws[0])["start_s"]
S = lambda k: scene[k]["start_s"]
E = lambda k: scene[k]["end_s"]

t_cut = W(5, "ho") + 0.12                  # the last shadow is gone: every outdoor sound dies
t_back = S("s8_relief") + 0.05            # shadows return: the world comes back
pre0 = line[7]["end_s"] + 0.02             # true silence before the whisper
scare = line[8]["start_s"]                 # [SCARE] cue
wh0, wh1 = line[8]["start_s"], line[8]["end_s"]
t_stinger = wh1 - 0.2                      # eyes open

# --- master "everything" envelope: dead zone + pre-scare drop (room tone excepted)
dead = smooth(t_cut - 0.004, t_cut + 0.012, t) * (1 - smooth(t_back - 0.01, t_back + 0.2, t))
def window(a, b): return smooth(a - 0.01, a + 0.02, t) * (1 - smooth(b - 0.01, b + 0.01, t))
drop = window(pre0, scare - 0.02)          # 0..1 inside the pre-scare silence

# 1) cicadas: pulsed 3-8 kHz buzz with slow swells; level follows the story
def cicada(seed):
    r = np.random.default_rng(seed)
    n = bp(r.standard_normal(N), 3200, 7800, 3)
    pulse = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * (78 + 12 * np.sin(2 * np.pi * 0.07 * t + seed)) * t))
    pulse = lp(pulse, 400, 1)
    swell = 0.62 + 0.38 * np.sin(2 * np.pi * 0.13 * t + seed) * np.sin(2 * np.pi * 0.047 * t + 2 * seed)
    return n * pulse * swell
cic = cicada(1); cic2 = cicada(2)
kit = lp(cic, 900, 2)                           # heard through the doorway in the kitchen
k_gain = np.zeros(N)
k_gain += 0.85 * window(0, S("s2_dadi"))
k_gain += 0.0 * t
k_gain += (0.16 + 0.14 * smooth(S("s2_dadi") + 6, E("s2_dadi"), t)) * window(S("s2_dadi"), S("s3_circle"))
k_gain += (0.7 + 0.5 * smooth(S("s3_circle"), t_cut - 0.5, t)) * window(S("s3_circle"), t_cut)
k_gain += (0.9 - 0.45 * smooth(S("s9_twist"), E("s9_twist"), t)) * window(t_back, E("s9_twist"))
k_gain += (0.42 - 0.22 * smooth(S("s10_gate"), E("s11_loop"), t)) * window(E("s9_twist"), D + 1)
outdoor = cic * k_gain
kitchen_mix = kit * 4.5 * window(S("s2_dadi"), S("s3_circle")) * (0.16 + 0.14 * smooth(S("s2_dadi") + 6, E("s2_dadi"), t))
cic_out = np.where((t > S("s2_dadi")) & (t < S("s3_circle")), kitchen_mix, outdoor)
add(cic_out * 0.22, 0, 0, -0.35); add(cic2 * k_gain * (t < S("s2_dadi") + 0.0 + (t > S("s3_circle"))) * 0.14, 0, 0, 0.4)

# 2) loo (hot wind): low-mid noise swells; out in the dead zone
wind = bp(rng.standard_normal(N), 120, 1100, 2) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.09 * t + 1.0)) ** 1.5
w_gain = 0.8 * (1 - dead) * (1 - 0.8 * window(S("s2_dadi") + 0.2, S("s3_circle") - 0.3))
add(wind * w_gain * 0.16, 0, 0, 0.15)

# 3) room tone (never digital silence): very low dark noise, always present
room = lp(rng.standard_normal(N), 700) * 0.6
add(room * 0.0035, 0, 0, 0)

# 4) kitchen: embers crackle, steel clink, Dadi's bangles
def click(f=2400, d=0.02):
    s = np.arange(int(d * SR)) / SR; return hp(rng.standard_normal(len(s)), 1500) * np.exp(-s * 260) + np.sin(2 * np.pi * f * s) * np.exp(-s * 300) * 0.25
pt = S("s2_dadi") + 0.2
while pt < E("s2_dadi") - 0.1:
    add(click(rng.uniform(1800, 4200)), pt, -26 + rng.uniform(-5, 4), rng.uniform(-0.8, -0.2)); pt += rng.exponential(0.32)
def ring(f, dur=1.2, a=1.0):
    s = np.arange(int(dur * SR)) / SR
    return (np.sin(2 * np.pi * f * s) + 0.5 * np.sin(2 * np.pi * f * 2.76 * s) + 0.3 * np.sin(2 * np.pi * f * 5.4 * s)) * np.exp(-s * 5) * a
add(ring(2200, 0.9, 0.12), S("s2_dadi") + 1.0, -22, 0.35)           # a steel thali nudged
t_rel = W(1, "pakadna") + 0.2
for k, f in enumerate([2800, 3300, 2500, 3000]): add(ring(f, 0.5, 0.1), t_rel + 0.05 * k, -20 - 2 * k, 0.1)   # bangles when she lets go
add(lp(rng.standard_normal(int(0.7 * SR)), 300) * np.sin(np.pi * np.arange(int(0.7 * SR)) / (0.7 * SR)) ** 2 * 0.2, S("s2_dadi") + 0.3, -18, -0.2)  # a swoosh into the dark room

# 5) school bell (far) at the start of the courtyard, kids shuffling into the line, chalk
def bell(dur=3.0):
    s = np.arange(int(dur * SR)) / SR
    return sum(np.sin(2 * np.pi * f * s) * np.exp(-s * d) * a for f, d, a in [(620, 1.6, 1), (1210, 2.4, 0.5), (1745, 3.2, 0.3), (2310, 4.5, 0.2)]) * (1 + 0.15 * np.sin(2 * np.pi * 7 * s))
add(lp(bell(), 5000) * 0.18, S("s3_circle") + 0.15, -8, 0.5)
def shuffle(): s = np.arange(int(0.2 * SR)) / SR; return bp(rng.standard_normal(len(s)), 300, 2500) * np.exp(-s * 28) * (1 + rng.uniform(-0.3, 0.3))
st = S("s3_circle") + 0.6
while st < S("s3_circle") + 5.0:
    add(shuffle(), st, -22 + rng.uniform(-4, 3), rng.uniform(-0.9, 0.9)); st += rng.uniform(0.08, 0.3)
add(bp(rng.standard_normal(int(1.2 * SR)), 2500, 7000) * np.sin(np.pi * np.arange(int(1.2 * SR)) / (1.2 * SR)) ** 2 * 0.1, S("s3_circle") + 2.3, -22, 0.2)  # chalk scrape
# a tightening ring: high tone that rises as the shadows retreat (s3 end -> cut)
ring_g = smooth(S("s4_minute") - 0.5, t_cut - 0.02, t) * (1 - smooth(t_cut - 0.006, t_cut + 0.006, t))
f_r = 2800 + 2600 * smooth(S("s4_minute"), t_cut, t)
add(np.sin(2 * np.pi * np.cumsum(f_r) / SR) * 0.05 * ring_g, 0, -14, 0.0)
# every cicada pulse gets faster as the minute begins (visual: shadows shrinking)
add(bp(rng.standard_normal(N), 5000, 9000) * np.sin(2 * np.pi * 140 * t) ** 2 * ring_g * 0.08, 0, -16, 0.1)

# 6) the dead zone: a very low sub bed that only pressure-fills the silence; heartbeat; evaporating ticks
sub = (np.sin(2 * np.pi * 38 * t) + 0.7 * np.sin(2 * np.pi * 41.5 * t + 1)) * 0.05
sub_env = dead * smooth(t_cut, t_cut + 2.5, t) * (1 - drop) * (1 - smooth(wh0 + 0.4, wh0 + 1.2, t) * 0) 
add(sub * sub_env * (1 + 1.2 * smooth(S("s6_raju"), pre0, t)), 0, -4, 0)
def thump(f0=48, dur=0.16):
    s = np.arange(int(dur * SR)) / SR; return np.sin(2 * np.pi * (f0 + 30 * np.exp(-s * 30)) * s) * np.exp(-s * 26)
hb = t_cut + 0.8
while hb < pre0 - 0.05:
    bpm = 52 + 30 * smooth(t_cut, pre0, hb); g = -20 + 10 * smooth(t_cut, pre0, hb)
    add(thump(), hb, g, 0); add(thump(40, 0.13), hb + 0.23, g - 4, 0); hb += 60 / bpm
# wet grip when the hand is taken
tg = W(6, "pakda") - 0.05
s_ = np.arange(int(0.35 * SR)) / SR
add(bp(rng.standard_normal(len(s_)), 200, 1800) * np.exp(-s_ * 14) * 0.5 + np.sin(2 * np.pi * 62 * s_) * np.exp(-s_ * 12) * 0.6, tg, -8, 0.3)
# drops of water on hot stone: plink + sizzle (period matches the visual: impact at t = (n + 0.55) / 0.55)
def drip():
    s = np.arange(int(0.5 * SR)) / SR
    plink = np.sin(2 * np.pi * (1500 - 900 * np.exp(-s * 40)) * s) * np.exp(-s * 38)
    siz = hp(rng.standard_normal(len(s)), 3500) * np.exp(-s * 7) * 0.5
    return plink * 0.6 + siz
n = 0
while True:
    ti = (n + 0.55) / 0.55
    if ti > pre0 - 0.2: break
    if ti > S("s6_raju") + 0.2: add(drip(), ti, -14, 0.0)
    n += 1
for ti in [W(6, "pakda") + 1.1, W(6, "pakda") + 2.6, W(6, "thanda") + 0.5]: add(drip(), ti, -22, 0.4)

# 7) pre-scare drop: everything but room tone is gone for ~1.1 s (see `drop`), applied at the end to all layers except room
# 8) whisper bed + the swell that leads into the open-eyes stinger
swn = int((wh1 - wh0 + 0.6) * SR); s_ = np.arange(swn) / SR
swell_env = (s_ / (wh1 - wh0 + 0.3)) ** 2.2
pad = sum(np.sin(2 * np.pi * f * s_ + p) * a for f, p, a in [(55, 0, 1), (58.3, 1, 0.8), (82.4, 2, 0.4), (110.2, 1.3, 0.25), (233.1, 0.4, 0.05), (220.7, 0, 0.05)])
add(pad * swell_env * 0.07, wh0 - 0.05, -8, 0)
add(lp(rng.standard_normal(swn), 400) * 0.015, wh0 - 0.2, 0, 0)
def hit(dur=1.6):
    s = np.arange(int(dur * SR)) / SR
    return np.sin(2 * np.pi * (55 * np.exp(-s * 4) + 30) * s) * np.exp(-s * 3) + hp(rng.standard_normal(len(s)), 2000) * np.exp(-s * 40) * 0.3
def stinger(dur=2.8, big=1.0):
    s = np.arange(int(dur * SR)) / SR
    e = env_ar(len(s), 0.006, 0.5 * big)
    clus = sum(np.sign(np.sin(2 * np.pi * f * s * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * s)))) for f in [622, 659, 698, 932, 988])
    clus = bp(clus.astype(float), 400, 6000) * 0.12
    burst = hp(rng.standard_normal(len(s)), 800) * np.exp(-s * 18) * 0.5
    boom = np.sin(2 * np.pi * (60 * np.exp(-s * 3) + 28) * s) * np.exp(-s * 2.2) * 0.9
    return (clus * big + burst * big + boom) * e
add(hit(), scare, -5, 0)                       # the [SCARE] cue: a dark thud under the first word
add(stinger(3.2, 1.0), t_stinger, 0, 0)        # eyes open
# 9) the world returns: bell-less relief, a gust, murmur of kids
gust = bp(rng.standard_normal(int(1.6 * SR)), 200, 2500) * np.sin(np.pi * np.arange(int(1.6 * SR)) / (1.6 * SR)) ** 2
add(gust * 0.2, t_back - 0.1, -10, 0.0)
murm = bp(rng.standard_normal(N), 250, 1800) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.7 * t)) ** 2
add(murm * 0.03 * window(t_back, E("s8_relief")), 0, -4, 0.1)
for k in range(5): add(shuffle(), t_back + 0.5 + 0.4 * k, -24, rng.uniform(-0.6, 0.6))
# 10) twist: his shadow slides across the stone: dry scrape + air, a sub swell into the hit
t_sl0 = W(10, "Meri") - 0.1; t_sl1 = W(10, "Raju") + 0.4
sln = int((t_sl1 - t_sl0 + 0.3) * SR); s_ = np.arange(sln) / SR
add(bp(rng.standard_normal(sln), 900, 5000) * np.sin(np.pi * s_ / s_[-1]) ** 1.5 * 0.1, t_sl0, -12, 0.3)
tw_end = line[10]["end_s"]; ln_ = 2.4; s_ = np.arange(int((ln_ + 1.4) * SR)) / SR
add(np.sin(2 * np.pi * (32 + 8 * s_ / ln_) * s_) * np.where(s_ < ln_, (s_ / ln_) ** 2, np.exp(-(s_ - ln_) / 0.45)) * 0.45, tw_end - ln_, 0, 0)
add(hit(), tw_end, -4, 0)
# 10b) hook: something barefoot and wet walks toward the lens, one step per print (matches HOOK_PR in scene.mjs: born = 0.2 + 0.27 i)
def wetstep():
    s = np.arange(int(0.3 * SR)) / SR
    return bp(rng.standard_normal(len(s)), 120, 1400) * np.exp(-s * 30) + hp(rng.standard_normal(len(s)), 2500) * np.exp(-s * 70) * 0.35 + np.sin(2 * np.pi * 90 * s) * np.exp(-s * 34) * 0.8
for i in range(12):
    add(wetstep(), 0.2 + 0.27 * i + 0.03, -26 + 17 * (i / 11) ** 1.4, -0.15 + 0.02 * i)
add(lp(rng.standard_normal(int(3.6 * SR)), 200) * np.linspace(0, 1, int(3.6 * SR)) ** 2 * 0.05, 0, -6, 0)   # low dread swell under the hook
# 11) gate: wet slaps of Raju's bare feet, kids walking off, cloth rustle at the hug
def slap():
    s = np.arange(int(0.25 * SR)) / SR; return bp(rng.standard_normal(len(s)), 150, 1800) * np.exp(-s * 38) + np.sin(2 * np.pi * 110 * s) * np.exp(-s * 40) * 0.7
tt = 51.7
while tt < 54.2: add(slap(), tt, -13, -0.3); tt += 0.52
tt = S("s10_gate") + 0.3
while tt < E("s10_gate") - 0.3: add(shuffle(), tt, -25 + rng.uniform(-4, 2), rng.uniform(0.1, 0.9)); tt += rng.uniform(0.12, 0.35)
add(bp(rng.standard_normal(int(0.9 * SR)), 800, 6000) * np.sin(np.pi * np.arange(int(0.9 * SR)) / (0.9 * SR)) ** 2 * 0.07, 54.1, -12, -0.4)
# 12) loop tail: his prints evaporating (hiss) and a last drip, a low reversed swell into the replay
for i in range(6):
    born = line[12]["start_s"] - 0.6 + i * 0.35
    add(drip(), born + 0.05, -20, -0.1 + 0.05 * i)
s_ = np.arange(int(2.4 * SR)) / SR
add(lp(rng.standard_normal(len(s_)), 1200) * (s_ / s_[-1]) ** 3 * 0.12, D - 2.5, -8, 0)
add(hp(rng.standard_normal(int(1.6 * SR)), 4000) * np.exp(-np.arange(int(1.6 * SR)) / SR * 3) * 0.1, D - 1.3, -14, 0.1)

# apply the pre-scare drop to everything except the room tone (rebuild: room tone is added again below)
keep = 1 - 0.995 * drop
L *= keep; Rr *= keep
add(room * 0.0035, 0, 0, 0)

peak = max(np.abs(L).max(), np.abs(Rr).max(), 1e-9)
sc = 1.0
L = np.nan_to_num(L); Rr = np.nan_to_num(Rr)
out = np.tanh(np.stack([L[:int(D * SR)], Rr[:int(D * SR)]], 1) * 0.6) * 0.95  # soft limiter: ambience stays linear, stingers saturate gently
import wave
pcm = (np.clip(out, -1, 1) * 32767).astype("<i2")
w = wave.open(f"{proj}/sound_bed.wav", "wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
print("wrote sound_bed.wav", D, "peak scale", round(sc, 3), "t_cut", round(t_cut, 2), "pre0", round(pre0, 2), "scare", round(scare, 2))
