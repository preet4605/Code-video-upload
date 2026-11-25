# Sound design bed for the "Ginti" pilot, fully synthesized (no samples).
# usage: python3 -I sound_design.py <project_dir>  -> <project>/sound_bed.wav (stereo 48k)
# Layers: room tone, ceiling fan, tube-light buzz, dread drone, sub swells, heartbeat,
# footsteps, torch click, door creak + latch, breath, stingers, and a true pre-scare drop.
import sys, json, subprocess, numpy as np
from scipy.signal import butter, sosfilt

proj = sys.argv[1]
TL = json.load(open(f"{proj}/timeline.json"))
SR = 48000
D = TL["duration_s"]
N = int(D * SR) + SR
t = np.arange(N) / SR
rng = np.random.default_rng(7)
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
def env_ar(n, a, r): e = np.ones(n); na = int(a * SR); e[:na] = np.linspace(0, 1, na); e[na:] = np.exp(-np.arange(n - na) / (r * SR)); return e

scene = {s["id"]: s for s in TL["scenes"]}
line = {l["i"]: l for s in TL["scenes"] for l in s["lines"]}
def W(li, word, nth=0):
    ws = [w for w in TL["words"] if w["line"] == li and w["word"].strip(".,!?").lower() == word.lower()]
    return (ws[nth] if len(ws) > nth else ws[0])["start_s"]
S = lambda k: scene[k]["start_s"]
E = lambda k: scene[k]["end_s"]

t_zyada = W(0, "zyada"); t29a = W(4, "29"); t29b = W(5, "29"); t_band = W(7, "band")
t_thandi = W(8, "thandi"); wh0 = line[9]["start_s"]; wh1 = line[9]["end_s"]
t_nahi_end = W(10, "nahi") + 0.4
pre_drop = (line[8]["end_s"], wh0)  # true silence before the whisper (only faint room tone)

# master envelope: everything except room tone dips to near-zero in the pre-scare window and during the whisper
duck = 1 - 0.97 * smooth(pre_drop[0] - 0.05, pre_drop[0] + 0.25, t) * (1 - smooth(wh1 - 0.02, wh1 + 0.01, t))

# 1) room tone: dark pink-ish noise, always on
n = rng.standard_normal(N); room = lp(n, 900) * 0.6 + lp(hp(n, 60), 250) * 0.8
add(room * 0.05, 0, 0, -0.1); add(lp(rng.standard_normal(N), 900) * 0.04, 0, 0, 0.3)

# 2) ceiling fan: whoosh pulsing at blade rate + motor hum; present while we are in the dorm wide shots
fan_on = np.zeros(N)
for k in ["s1_hook", "s2_dorm", "s5_count", "s6_door", "s7_relief", "s10_loop"]:
    fan_on = np.maximum(fan_on, smooth(S(k), S(k) + 0.3, t) * (1 - smooth(E(k) - 0.2, E(k), t)))
fan_on = np.maximum(fan_on, 0.35)  # still audible from close-ups, further away
blade = 0.55 + 0.45 * np.sin(2 * np.pi * 3.1 * t) ** 2
whoosh = bp(rng.standard_normal(N), 300, 1800) * blade
hum = 0.4 * np.sin(2 * np.pi * 50 * t) + 0.2 * np.sin(2 * np.pi * 100 * t + 1)
add((whoosh * 0.05 + hum * 0.008) * fan_on * duck, 0, 0, 0.15)

# 3) tube-light buzz from the corridor while the door is open, with crackles on flicker
door_open = np.clip(1 - smooth(t_band - 0.9, t_band + 0.1, t), 0, 1) * (t < S("s7_relief") + 3) + (t > S("s10_loop")) * 1.0
buzz = np.sign(np.sin(2 * np.pi * 100 * t)) * 0.3 + np.sin(2 * np.pi * 200 * t) * 0.3
buzz = bp(buzz, 90, 2500)
crk = (rng.random(N) < 0.00008).astype(float); crk = bp(np.convolve(crk, np.exp(-np.arange(600) / 80), "same"), 1500, 8000)
add((buzz * 0.012 + crk * 0.25) * door_open * duck, 0, 0, -0.2)

# 4) dread drone: detuned low cluster (A1 / Bb1 / E2-ish) with slow beating; intensity rises with the story
inten = 0.35 + 0.35 * smooth(S("s4_wall"), S("s5_count"), t) + 0.3 * smooth(S("s7_relief") + 2, S("s8_breath") + 4, t)
inten *= 1 - 0.5 * smooth(S("s7_relief"), S("s7_relief") + 1.5, t) * (1 - smooth(S("s7_relief") + 4, S("s8_breath"), t))  # false relief
drone = sum(np.sin(2 * np.pi * f * t + p) * a for f, p, a in [(55, 0, 1), (58.3, 1, 0.8), (82.4, 2, 0.4), (87.3, 0.5, 0.3), (110.2, 1.3, 0.2)])
bowed = bp(rng.standard_normal(N), 600, 1400) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.13 * t))
add((drone * 0.05 + bowed * 0.012) * inten * duck, 0, 0, 0)
add((np.sin(2 * np.pi * 220.7 * t) + np.sin(2 * np.pi * 233.1 * t)) * 0.006 * inten * duck, 0, 0, 0.4)  # tense minor second high

# 5) sub-bass swells into the key beats
for at, ln in [(t29a, 2.2), (t29b, 2.0), (line[6]["end_s"], 2.5), (t_thandi, 3.0), (t_nahi_end, 2.5)]:
    seg = np.arange(int((ln + 1.5) * SR)) / SR
    e = np.where(seg < ln, (seg / ln) ** 2, np.exp(-(seg - ln) / 0.4))
    add(np.sin(2 * np.pi * (32 + 6 * seg / ln) * seg) * e * 0.35, at - ln, 0, 0)

# 6) heartbeat: starts quiet at the wall close-up, accelerates through the count and the breath, stops dead at the drop
def thump(f0=48, dur=0.16):
    s = np.arange(int(dur * SR)) / SR; return np.sin(2 * np.pi * (f0 + 30 * np.exp(-s * 30)) * s) * np.exp(-s * 26)
hb_t = S("s4_wall") + 1.0
while hb_t < pre_drop[0] - 0.1:
    bpm = 58 + 40 * smooth(S("s4_wall"), S("s6_door"), hb_t) - 14 * smooth(S("s7_relief"), S("s7_relief") + 2, hb_t) * (1 - smooth(S("s8_breath") - 1, S("s8_breath") + 1, hb_t)) + 34 * smooth(S("s8_breath"), pre_drop[0], hb_t)
    g = -14 + 8 * smooth(S("s4_wall"), pre_drop[0], hb_t)
    add(thump(), hb_t, g, 0); add(thump(42, 0.13), hb_t + 0.24, g - 4, 0)
    hb_t += 60 / bpm

# 7) footsteps of the warden on tiles (hook + wide shot), slow, a little uneven
def step():
    s = np.arange(int(0.18 * SR)) / SR; return (bp(rng.standard_normal(len(s)), 200, 3500) * np.exp(-s * 45) + np.sin(2 * np.pi * 90 * s) * np.exp(-s * 30) * 0.6)
st = S("s1_hook") + 0.8; k = 0
while st < E("s2_dorm") - 0.3:
    add(step(), st, -16 + (k % 2) * -3, -0.3 + 0.1 * np.sin(k)); st += 0.82 + 0.08 * np.sin(k * 1.7); k += 1
for at in [S("s5_count") + 0.3, S("s5_count") + 1.2]: add(step(), at, -17, 0.1)

# 8) torch click at the very start and when it stops on my bed
def click():
    s = np.arange(int(0.05 * SR)) / SR; return hp(rng.standard_normal(len(s)), 2000) * np.exp(-s * 300) + np.sin(2 * np.pi * 2400 * s) * np.exp(-s * 200) * 0.4
add(click(), 0.05, -8, -0.2); add(click(), W(3, "torch"), -12, 0.2)

# 9) door: long creak then latch + low thud
cd = 1.0; s = np.arange(int(cd * SR)) / SR
f = 380 + 140 * np.sin(2 * np.pi * 0.7 * s) + 60 * np.sin(2 * np.pi * 6 * s)
creak = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * (rng.random(len(s)) < 0.5 + 0.4 * np.sin(2 * np.pi * 37 * s))
creak = bp(creak.astype(float), 300, 3000) * np.sin(np.pi * s / cd) ** 0.6
add(creak * 0.35, t_band - 1.0, -4, 0.5)
s = np.arange(int(0.6 * SR)) / SR
latch = hp(rng.standard_normal(len(s)), 1500) * np.exp(-s * 120) * 0.6 + np.sin(2 * np.pi * 70 * s) * np.exp(-s * 12)
add(latch, t_band + 0.05, -2, 0.4)

# 10) cold breath behind him (synced to the visual puffs: period 1/0.42 s from scene start), right side, close
for k2 in range(8):
    bt = S("s8_breath") + (k2 + 0.0) / 0.42 * 1.0 - 0.6
    if bt < t_thandi - 0.6 or bt > pre_drop[0] - 0.6: continue
    s = np.arange(int(1.1 * SR)) / SR
    br = bp(rng.standard_normal(len(s)), 500, 4500) * np.sin(np.pi * s / 1.1) ** 2
    add(br * 0.3, bt, -6, 0.75)

# 11) whisper bed: barely-there low air under the whisper so it is not digital silence
add(lp(rng.standard_normal(int((wh1 - wh0 + 0.4) * SR)), 400) * 0.015, wh0 - 0.2, 0, 0)

# 12) stingers
def stinger(dur=2.6, big=1.0):
    s = np.arange(int(dur * SR)) / SR
    e = env_ar(len(s), 0.006, 0.55 * big)
    clus = sum(np.sign(np.sin(2 * np.pi * f * s * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * s)))) for f in [622, 659, 698, 932, 988])
    clus = bp(clus.astype(float), 400, 6000) * 0.12
    burst = hp(rng.standard_normal(len(s)), 800) * np.exp(-s * 18) * 0.5
    boom = np.sin(2 * np.pi * (60 * np.exp(-s * 3) + 28) * s) * np.exp(-s * 2.2) * 0.9
    return (clus * big + burst * big + boom) * e
def hit(dur=1.6):
    s = np.arange(int(dur * SR)) / SR
    return np.sin(2 * np.pi * (55 * np.exp(-s * 4) + 30) * s) * np.exp(-s * 3) + hp(rng.standard_normal(len(s)), 2000) * np.exp(-s * 40) * 0.3
add(hit(), t_zyada - 0.04, -6, 0)
add(hit(), t29a - 0.05, -3, 0)
add(hit(), t29b - 0.05, -2, 0)
add(stinger(3.0, 1.0), wh1 + 0.02, 0, 0)
add(stinger(2.4, 0.6), t_nahi_end, -3, 0)
# reverse swell into the final head-turn
s = np.arange(int(1.4 * SR)) / SR; rev = bp(rng.standard_normal(len(s)), 300, 5000) * (s / 1.4) ** 3
add(rev * 0.5, t_nahi_end - 1.4, -6, 0)

# 13) very end: fan + room only, one faint whispered breath as the loop point
s = np.arange(int(0.9 * SR)) / SR
add(bp(rng.standard_normal(len(s)), 700, 5000) * np.sin(np.pi * s / 0.9) ** 2 * 0.2, D - 1.2, -6, 0.8)

out = np.stack([L, Rr], 1)[: int(D * SR)]
out = out / np.max(np.abs(out)) * db(-1.0)
raw = (out * 32767).astype(np.int16).tobytes()
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-", f"{proj}/sound_bed.wav"], input=raw, check=True)
print("ok", f"{proj}/sound_bed.wav", round(D, 2))
