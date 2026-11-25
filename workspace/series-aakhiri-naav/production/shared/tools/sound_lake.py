# आख़िरी नाव part 2 sound bed, fully synthesized (+ processed copies of the episode's own voice clips).
# usage: python3 -I sound_lake.py <project_dir>   -> <project>/sound_bed.wav (stereo 48k)
import sys, json, subprocess, os, numpy as np
from scipy.signal import butter, sosfilt

proj = os.path.abspath(sys.argv[1])
EP = os.path.basename(proj)
TL = json.load(open(f"{proj}/timeline.json"))
CACHE = f"{proj}/cache/vo"
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
    i = int(at * SR)
    if i < 0:
        sig = sig[-i:]; i = 0
    n = min(len(sig), N - i)
    if n <= 0: return
    g = db(gain_db); l = g * np.sqrt((1 - pan) / 2) * np.sqrt(2); r = g * np.sqrt((1 + pan) / 2) * np.sqrt(2)
    L[i:i + n] += sig[:n] * l; Rr[i:i + n] += sig[:n] * r
def env_ar(n, a, r):
    e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na); e[na:] = np.exp(-np.arange(n - na) / (r * SR)); return e
def load(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)
def trim(x, thr=0.01):
    idx = np.where(np.abs(x) > thr * np.max(np.abs(x)))[0]
    return x[idx[0]: idx[-1] + 1] if len(idx) else x
def pitch(x, f):  # resample (pitch + speed together)
    n = int(len(x) / f); return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)
def echo(x, taps, tail=0.6):
    out = np.zeros(len(x) + int((max(d for d, _ in taps) + tail) * SR))
    out[:len(x)] += x
    for d, g in taps:
        i = int(d * SR); out[i:i + len(x)] += x * g
    return out
def norm(x): m = np.max(np.abs(x)); return x / m if m > 0 else x

cues = {c["name"]: c["t_s"] for c in TL["audio_cues"]}
scare_t = [c for c in TL["audio_cues"] if c.get("scare")][0]["t_s"]
lines = {l["i"]: l for l in TL["lines"]}
scene = {s["id"]: s for s in TL["scenes"]}
S = lambda k: scene[k]["start_s"]
E = lambda k: scene[k]["end_s"]

def stinger(dur=2.8, big=1.0, soft=False):
    s = np.arange(int(dur * SR)) / SR
    e = env_ar(len(s), 0.006, 0.5 * big)
    clus = sum(np.sign(np.sin(2 * np.pi * f * s * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * s)))) for f in [622, 659, 698, 932, 988])
    clus = bp(clus.astype(float), 400, 6000) * (0.05 if soft else 0.12)
    burst = hp(rng.standard_normal(len(s)), 800) * np.exp(-s * 18) * (0.18 if soft else 0.5)
    boom = np.sin(2 * np.pi * (60 * np.exp(-s * 3) + 28) * s) * np.exp(-s * 2.0) * 0.95
    return (clus * big + burst * big + boom) * e
def hit(dur=1.6):
    s = np.arange(int(dur * SR)) / SR
    return np.sin(2 * np.pi * (55 * np.exp(-s * 4) + 30) * s) * np.exp(-s * 3) + hp(rng.standard_normal(len(s)), 2000) * np.exp(-s * 40) * 0.3
def thump(f0=48, dur=0.16):
    s = np.arange(int(dur * SR)) / SR; return np.sin(2 * np.pi * (f0 + 30 * np.exp(-s * 30)) * s) * np.exp(-s * 26)
def breath_in_out(dur=1.5):
    s = np.arange(int(dur * SR)) / SR
    return bp(rng.standard_normal(len(s)), 450, 4200) * np.sin(np.pi * s / dur) ** 2
def splash(dur=0.35, lo=250, hi=2600):
    s = np.arange(int(dur * SR)) / SR
    return bp(rng.standard_normal(len(s)), lo, hi) * env_ar(len(s), 0.01, 0.09) + np.sin(2 * np.pi * (90 * np.exp(-s * 6) + 45) * s) * np.exp(-s * 9) * 0.3
def crickets(on):
    sig = np.zeros(N)
    for k, (f, rate) in enumerate([(4300, 3.1), (4650, 2.7), (3900, 3.6), (5100, 2.4)]):
        gate = (np.sin(2 * np.pi * rate * t + k) > 0.55).astype(float)
        gate = lp(gate, 40) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t + k * 2))
        am = (np.sin(2 * np.pi * 28 * t) > 0).astype(float) * 0.5 + 0.5
        sig += np.sin(2 * np.pi * f * t + 3 * np.sin(2 * np.pi * 9 * t)) * am * gate
    return sig * on

# ---- clips from this episode's own voice (the lake only has what he said)
calls = trim(load(f"{CACHE}/x_calls_raw.wav"))
calls = bp(calls, 180, 5200)
line_clip = lambda i: load(f"{CACHE}/l{str(i).zfill(2)}.wav")

duck = np.ones(N)  # master duck for the true pre-scare silence (room tone excluded)

# ================================================================= common night-lake bed
n = rng.standard_normal(N)
wind = bp(n, 200, 1100) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.09 * t + 1.1) * np.sin(2 * np.pi * 0.031 * t))
add(lp(n, 700) * 0.035 + wind * 0.05, 0, 0, -0.1)
add(lp(rng.standard_normal(N), 800) * 0.03, 0, 0, 0.3)
lap = lp(rng.standard_normal(N), 650) * (0.35 + 0.65 * np.sin(2 * np.pi * 0.31 * t) ** 2) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.113 * t + 2))
cr_on = 1 - smooth(20.0, 23.5, t) if EP == "ep2a" else 1 - smooth(31, 37, t)       # insects hush as the lake turns wrong
add(crickets(cr_on) * 0.02, 0, 0, 0.0)
drone = sum(np.sin(2 * np.pi * f * t + p) * a for f, p, a in [(55, 0, 1), (58.3, 1, 0.8), (82.4, 2, 0.4), (87.3, 0.5, 0.3), (110.2, 1.3, 0.2)])

if EP == "ep2a":
    cue_name_t = cues["name_in_water"]; t_haan10 = lines[10]["end_s"]
    pre = (lines[10]["end_s"] + 0.04, scare_t - 0.02)
    # water lapping, closer as he gets to the boat
    add(lap * (0.05 + 0.05 * smooth(10, 30, t)), 0, 0, 0.05)
    inten = 0.28 + 0.4 * smooth(S("warm"), S("jacket"), t) + 0.3 * smooth(S("voice"), scare_t, t)
    inten *= 1 - 0.55 * smooth(S("relief") - 0.5, S("relief") + 1.5, t) * (1 - smooth(S("voice"), S("voice") + 2, t))
    add((drone * 0.05) * inten, 0, 0, 0)
    add((np.sin(2 * np.pi * 220.7 * t) + np.sin(2 * np.pi * 233.1 * t)) * 0.005 * inten, 0, 0, 0.4)
    # 0.1 wading in: cold shock gasp + deliberate steps
    add(bp(rng.standard_normal(int(0.7 * SR)), 450, 3800) * np.linspace(0.1, 1, int(0.7 * SR)) ** 2 * np.sin(np.linspace(0.3, 3.1, int(0.7 * SR))), 0.28, -6, 0.1)
    for k in range(7): add(splash(0.45, 200, 2200), 0.1 + k * 0.62, -12 - 2 * (k > 3), 0.05 * ((k % 2) * 2 - 1))
    # slow controlled breaths while he forces them (breath scene)
    for k in range(5):
        bt = S("breath") + 0.2 + k * 1.55
        if bt < E("breath") - 0.8: add(breath_in_out(1.35), bt, -9, 0.05)
    # three nights of calling, far and thin, from behind (the shore)
    for k, (dt, g, p) in enumerate([(0.0, -16, -0.8), (1.6, -21, -0.75), (3.4, -26, -0.7)]):
        c = echo(lp(calls, 3200) * 0.9, [(0.8, 0.45), (1.6, 0.22)], 1.0)
        add(c, cues["old_calls_echo"] + 0.3 + dt * 1.5, g, p)
    # lake goes warm: low shimmer hum swells, small bubbling
    wr = smooth(cues["warm_water_hum"], cues["warm_water_hum"] + 2.5, t) * (1 - smooth(scare_t - 0.4, scare_t - 0.1, t))
    hum = (np.sin(2 * np.pi * 92 * t) + 0.5 * np.sin(2 * np.pi * 138.2 * t + 1) + 0.35 * np.sin(2 * np.pi * 184.1 * t + 2)) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * t))
    add(hum * 0.03 * wr, 0, 0, 0)
    bub = (rng.random(N) < 0.0012).astype(float); bub = bp(np.convolve(bub, np.exp(-np.arange(1800) / 260), "same"), 400, 2600)
    add(bub * 0.6 * wr * (t > cues["warm_water_hum"]), 0, -10, 0.3)
    # the cabin murmur: dozens of "haan", pitch-shifted copies of his own, thickening, panned wide; it hushes the instant the kind voice speaks
    hanclips = [trim(load(f"{CACHE}/x_haan{k}_raw.wav")) for k in (1, 2, 3)]
    m0, m1 = cues["murmur_haan"], lines[7]["start_s"] - 0.06
    tt = m0
    while tt < m1:
        dens = 2.4 + 12 * smooth(m0, m1, tt)
        c = hanclips[int(rng.integers(0, 3))]
        f = float(rng.uniform(0.82, 1.28)); c = lp(pitch(c, f), 3400)
        c = echo(c, [(0.12, 0.4), (0.27, 0.2)], 0.3)
        wob = smooth(S("cabin"), E("cabin"), tt)
        add(c, tt, -22 + 7 * wob + float(rng.uniform(-3, 3)) - 2 * (tt > E("jacket")), float(rng.uniform(-0.9, 0.9)))
        tt += rng.exponential(1 / dens)
    # the jacket scene: his pulse arrives, quiet and warm
    hb = S("jacket") + 0.5
    while hb < lines[6]["end_s"] + 0.3:
        g = -17 + 5 * smooth(S("jacket"), E("relief"), hb)
        add(thump(), hb, g, 0); add(thump(42, 0.13), hb + 0.24, g - 4, 0); hb += 60 / (66 + 10 * smooth(S("jacket"), E("relief"), hb))
    add(bp(rng.standard_normal(int(0.9 * SR)), 800, 4500) * np.sin(np.linspace(0, np.pi, int(0.9 * SR))) ** 2, S("jacket") + 2.2, -22, 0.2)  # cloth rustle as he touches it
    add(bp(rng.standard_normal(int(0.5 * SR)), 1200, 5000) * np.sin(np.linspace(0, np.pi, int(0.5 * SR))) ** 2, lines[6]["start_s"] + 1.0, -17, 0.1)  # a sob
    # the voice in the water: reverse swell in, wet sub under it
    s = np.arange(int(1.6 * SR)) / SR
    add(bp(rng.standard_normal(len(s)), 250, 3000) * (s / 1.6) ** 3 * 0.5, cue_name_t - 1.5, -10, 0.1)
    add(np.sin(2 * np.pi * 61 * np.arange(int(5 * SR)) / SR) * np.exp(-np.arange(int(5 * SR)) / SR / 2.2) * 0.3, cue_name_t, -9, 0)
    # the long breath before the answer, then the reflex word's sub swell
    for at, ln in [(lines[9]["start_s"] + 3.0, 3.0), (lines[10]["start_s"] - 0.1, 0.3)]:
        sw = np.arange(int((ln + 1.2) * SR)) / SR
        e = np.where(sw < ln, (sw / ln) ** 2, np.exp(-(sw - ln) / 0.3))
        add(np.sin(2 * np.pi * (32 + 6 * sw / ln) * sw) * e * 0.4, at - ln + ln * 0.1, -3, 0)
    hb = lines[8]["end_s"]
    while hb < pre[0] - 0.1:
        g = -13 + 6 * smooth(lines[8]["end_s"], pre[0], hb)
        add(thump(), hb, g, 0); add(thump(42, 0.13), hb + 0.22, g - 4, 0); hb += 60 / (74 + 36 * smooth(lines[8]["end_s"], pre[0], hb))
    # true pre-scare drop: everything but a thread of room tone dies for the beat before the lights go
    duck *= 1 - 0.9995 * smooth(pre[0], pre[0] + 0.05, t) * (1 - smooth(scare_t - 0.015, scare_t + 0.01, t))
    # SCARE: lights out
    add(stinger(3.4, 1.0), scare_t, 0, 0)
    add(hit(2.4), scare_t, -3, 0)
    # the grip: low compression, the water squeezing, his breath cut off
    g0 = scare_t; g1 = cues["small_hand_slap"]
    gs = np.arange(int((g1 - g0 + 0.5) * SR)) / SR
    grip = np.sin(2 * np.pi * (34 + 16 * smooth(0, g1 - g0, gs + g0 - g0) ) * gs) * (0.3 + 0.7 * smooth(0, g1 - g0, gs))
    add(grip * 0.4, g0, -7, 0)
    add(bp(rng.standard_normal(len(gs)), 120, 900) * smooth(0, g1 - g0, gs) * 0.5, g0, -12, 0)
    for k in range(10): add(splash(0.5, 100, 700), g0 + 0.4 + k * 0.4, -20 + k * 0.5, 0.0)
    for k, bt in enumerate(np.linspace(g0 + 0.8, g1 - 0.4, 8)): add(thump(), bt, -10 + k, 0); add(thump(42, 0.13), bt + 0.14 - 0.01 * k, -14 + k, 0)
    # the small hand: wet slap + a surge of water toward the bank
    hs = g1
    s = np.arange(int(0.5 * SR)) / SR
    add(bp(rng.standard_normal(len(s)), 600, 6000) * np.exp(-s * 40) * 0.9 + np.sin(2 * np.pi * 140 * s) * np.exp(-s * 25) * 0.7, hs, -2, 0.25)
    sg = np.arange(int(4.6 * SR)) / SR
    add(bp(rng.standard_normal(len(sg)), 200, 3800) * np.sin(np.pi * np.clip(sg / 4.6, 0, 1)) ** 0.8 * 0.6, hs + 0.05, -6, 0)
    add(hit(1.6), hs + 0.02, -8, 0)
    # final: hard cut (the video fades to black on the last word)
    duck *= 1 - smooth(D - 0.18, D - 0.02, t) * 0.95

else:  # ep2b
    cue_name_t = cues["name_in_water"]
    pre = (lines[7]["end_s"] + 0.02, scare_t - 0.01)
    add(lap * (0.08 + 0.05 * smooth(5, 25, t)), 0, 0, 0.0)
    inten = 0.28 + 0.4 * smooth(S("walk"), S("under"), t) + 0.3 * smooth(S("under"), S("relief") - 2, t)
    inten *= 1 - 0.6 * smooth(S("relief"), S("relief") + 2, t) * (1 - smooth(scare_t, scare_t + 1, t))
    add((drone * 0.05) * inten, 0, 0, 0)
    add((np.sin(2 * np.pi * 220.7 * t) + np.sin(2 * np.pi * 233.1 * t)) * 0.005 * inten, 0, 0, 0.4)
    # slow held breaths on the bank
    for k in range(int(D // 3)):
        bt = 0.6 + k * 3.1
        if bt < pre[0] - 2 or bt > scare_t + 3: add(breath_in_out(1.4), bt, -14, 0.0) if bt < pre[0] - 2 else None
    # three nights of calling from this bank, faint and doubled by the lake
    for k, (dt, g, p) in enumerate([(0.0, -15, 0.2), (1.9, -21, 0.35), (4.0, -27, 0.5)]):
        c = echo(lp(calls, 3400) * 0.9, [(0.7, 0.45), (1.5, 0.22)], 1.0)
        add(c, cues["old_calls_echo"] + 0.3 + dt, g, p)
    # footsteps that do not splash: dry ticks coming nearer; the left-leaning gait is slightly uneven
    st = cues["step_ticks"]; k = 0
    while st < S("under") + 4.0:
        near = smooth(S("walk"), S("under") + 1, st)
        s = np.arange(int(0.12 * SR)) / SR
        tick = (bp(rng.standard_normal(len(s)), 1500, 5200) * np.exp(-s * 70) + np.sin(2 * np.pi * 760 * s) * np.exp(-s * 55) * 0.5)
        add(tick, st, -29 + 14 * near, -0.2 + 0.1 * np.sin(k * 1.9)); st += 0.78 + (0.24 if k % 2 else 0.0) - 0.15 * near; k += 1
    # the name out of the lake: reverse swell + wet sub
    s = np.arange(int(1.6 * SR)) / SR
    add(bp(rng.standard_normal(len(s)), 250, 3000) * (s / 1.6) ** 3 * 0.5, cue_name_t - 1.5, -10, 0.0)
    add(np.sin(2 * np.pi * 58 * np.arange(int(4 * SR)) / SR) * np.exp(-np.arange(int(4 * SR)) / SR / 1.8) * 0.3, cue_name_t, -10, 0)
    # it comes under the surface: sinking drone, muffled water
    u0, u1 = S("under"), E("under")
    us = np.arange(int((u1 - u0 + 1) * SR)) / SR
    add(np.sin(2 * np.pi * (96 - 40 * smooth(0, u1 - u0, us)) * us) * smooth(0, 2, us) * 0.22, u0, -8, 0)
    add(lp(rng.standard_normal(len(us)), 420) * smooth(0, 2.5, us) * 0.2, u0, -10, 0)
    # knocks from below the surface, three of them
    for k, off in enumerate([0.0, 0.62, 1.4]):
        s = np.arange(int(0.6 * SR)) / SR
        kn = lp(rng.standard_normal(len(s)), 600) * np.exp(-s * 38) * 0.6 + np.sin(2 * np.pi * (170 - 40 * s) * s) * np.exp(-s * 20) * 0.9
        add(kn, cues["water_knock"] + off, -4 - k, 0.0)
    # the voice that comes from elsewhere: the lake's own line, far, behind him and to the right, while the mouth moves
    ll = echo(lp(line_clip(3), 3800), [(0.5, 0.35), (1.1, 0.18)], 1.0)
    add(ll, S("face") + 2.2, -17, 0.8)
    add(ll[::-1] * 0.5, S("face") + 5.5, -23, -0.8)
    # the face: a thin sub pressure and a slow heartbeat that the narrator hears in his own ears
    hb = S("face") + 0.8
    while hb < E("face") - 0.4:
        g = -14 + 5 * smooth(S("face"), E("face"), hb)
        add(thump(), hb, g, 0); add(thump(42, 0.13), hb + 0.24, g - 4, 0); hb += 60 / (66 + 28 * smooth(S("face"), E("face"), hb));
    # relief: the water settles, then true silence for the beat before his own voice
    add(bp(rng.standard_normal(int(1.4 * SR)), 300, 2500) * (np.linspace(1, 0, int(1.4 * SR)) ** 2), S("relief") + 0.6, -14, 0.0)
    duck *= 1 - 0.9995 * smooth(pre[0], pre[0] + 0.05, t) * (1 - smooth(scare_t - 0.01, scare_t + 0.01, t))
    # SCARE: his own voice from the lake. Soft top, huge sub.
    add(stinger(3.4, 0.8, soft=True), scare_t, 0, 0)
    add(hit(2.6), scare_t, -2, 0)
    # and the lake keeps saying it, thin and far, out in the dark
    ho = line_clip(8)
    far = echo(lp(ho, 3600), [(0.9, 0.4), (1.9, 0.2), (3.1, 0.1)], 1.2)
    add(far, scare_t + 3.2, -17, -0.7)
    # the wave with no wind
    w0 = cues["wave_no_wind"]; wc = w0 + 3.4
    ws = np.arange(int(3.6 * SR)) / SR
    rush = bp(rng.standard_normal(len(ws)), 180, 3200) * (ws / 3.4).clip(0, 1) ** 2.2 * 0.8
    add(rush, w0, -5, 0)
    add(np.sin(2 * np.pi * (30 + 14 * ws / 3.4) * ws) * (ws / 3.4).clip(0, 1) ** 2 * 0.5, w0, -6, 0)
    cr = np.arange(int(3.2 * SR)) / SR
    add(bp(rng.standard_normal(len(cr)), 120, 5000) * np.exp(-cr * 1.6) * 0.95 + np.sin(2 * np.pi * (52 * np.exp(-cr * 1.5) + 24) * cr) * np.exp(-cr * 1.4), wc, -2, 0)
    add(hit(1.8), wc, -5, 0)
    # many small hands slapping the water: a cluster of fast pats just after the crash
    for k in range(34):
        s = np.arange(int(0.2 * SR)) / SR
        pat = bp(rng.standard_normal(len(s)), 900, 6500) * np.exp(-s * 55) * 0.5 + np.sin(2 * np.pi * 320 * s) * np.exp(-s * 30) * 0.3
        add(pat, wc + 0.15 + k * 0.095 + float(rng.uniform(-0.03, 0.03)), -17 + float(rng.uniform(-3, 2)), float(rng.uniform(-0.9, 0.9)))
    # the water drains away; mud-level hush for the last line
    dr = np.arange(int(3.0 * SR)) / SR
    add(lp(rng.standard_normal(len(dr)), 900) * np.exp(-dr * 1.1) * 0.5, wc + 0.8, -10, 0)
    duck *= 1 - smooth(D - 0.2, D - 0.02, t) * 0.95

# ================================================================= finish
mix_l, mix_r = L * duck, Rr * duck
# keep a thread of room tone through the true silence (so it is silence, not a dropout)
tone = lp(rng.standard_normal(N), 380) * 0.0015
mix_l += tone * (1 - duck) * 1.0; mix_r += tone * (1 - duck) * 0.9
out = np.stack([mix_l, mix_r], 1)[: int(D * SR)]
out = out / np.max(np.abs(out)) * db(-1.0)
import wave
pcm = (np.clip(out, -1, 1) * 32767).astype("<i2")
with wave.open(f"{proj}/sound_bed.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("ok", EP, D)
