#!/usr/bin/env python3
"""CTC forced alignment of known text to speech audio -> per-word timings.

    python3 align.py --wav x.wav --text "..." --out words.json

Output: [{"word", "start", "end", "score", "raw_start", "raw_end", "cer", "hyp"}] in seconds,
one entry per whitespace-separated display token (input order, punctuation kept in `word`).

CPU only, deterministic (no sampling). Model: env ALIGN_CTC_MODEL (local dir or HF repo id),
default Harveenchadha/vakyansh-wav2vec2-hindi-him-4200 (HF cache, HF_HOME honoured).
"""
import argparse, json, os, re, sys, unicodedata

import numpy as np

DEFAULT_MODEL = "Harveenchadha/vakyansh-wav2vec2-hindi-him-4200"
SR = 16000

# ---------------------------------------------------------------- text prep
HI_NUM = (
    "शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस "
    "बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस "
    "छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चौवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस "
    "उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ "
    "छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उनासी "
    "अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे इक्यानवे बानवे तिरानवे "
    "चौरानवे पंचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे सौ"
).split()
assert len(HI_NUM) == 101
DEV_DIGITS = {ord("०") + i: str(i) for i in range(10)}


def spell_number(s):
    s = s.translate(DEV_DIGITS)
    n = int(s)
    if n <= 100:
        return [HI_NUM[n]]
    if n < 1000 and not s.startswith("0"):
        h, r = divmod(n, 100)
        return [HI_NUM[h], "सौ"] + ([HI_NUM[r]] if r else [])
    if n < 100000 and not s.startswith("0"):
        t, r = divmod(n, 1000)
        out = [HI_NUM[t], "हज़ार"]
        if r >= 100:
            h, r = divmod(r, 100)
            out += [HI_NUM[h], "सौ"]
        return out + ([HI_NUM[r]] if r else [])
    return [HI_NUM[int(c)] for c in s]  # digit-by-digit fallback


# small Hinglish dictionary (Latin -> Devanagari, for alignment only) + crude letter-rule fallback
LATIN_DICT = {
    "topic": "टॉपिक", "how": "हाउ", "to": "टू", "save": "सेव", "money": "मनी", "tension": "टेंशन",
    "video": "वीडियो", "reel": "रील", "reels": "रील्स", "phone": "फोन", "mobile": "मोबाइल",
    "internet": "इंटरनेट", "free": "फ्री", "tips": "टिप्स", "tip": "टिप", "hack": "हैक", "hacks": "हैक्स",
    "app": "ऐप", "online": "ऑनलाइन", "the": "द", "of": "ऑफ", "and": "एंड", "in": "इन", "is": "इज़",
    "for": "फॉर", "with": "विद", "you": "यू", "ai": "एआई", "ok": "ओके", "okay": "ओके", "love": "लव",
    "life": "लाइफ", "like": "लाइक", "share": "शेयर", "subscribe": "सब्सक्राइब", "follow": "फॉलो",
    "story": "स्टोरी", "horror": "हॉरर", "ghost": "घोस्ट", "night": "नाइट", "time": "टाइम",
    "business": "बिज़नेस", "job": "जॉब", "sir": "सर", "sorry": "सॉरी",
}
_MULTI = [("sh", "श"), ("ch", "च"), ("th", "थ"), ("ph", "फ"), ("kh", "ख"), ("gh", "घ"), ("ck", "क")]
_CONS = dict(zip("bcdfghjklmnpqrstvwxyz", "बकडफगहजकलमनपकरसटवक्सयज़"))
_VOW = dict(zip("aeiou", "अएइओउ"))
_MATRA = dict(zip("aeiou", ["", "े", "ि", "ो", "ु"]))


def latin_to_deva(w):
    lw = w.lower()
    if lw in LATIN_DICT:
        return LATIN_DICT[lw]
    out, i, prev_cons = "", 0, False
    while i < len(lw):
        hit = next((d for k, d in _MULTI if lw.startswith(k, i)), None)
        if hit:
            out += hit
            prev_cons, i = True, i + 2
            continue
        c = lw[i]
        if c in _VOW:
            out += _MATRA[c] if prev_cons else _VOW[c]
            prev_cons = False
        elif c in _CONS:
            out += _CONS[c]
            prev_cons = True
        i += 1
    return out


def clean_token(tok):
    """display token -> alignment string (NFC, no punctuation, digits spelled, Latin transliterated)"""
    core = "".join(ch for ch in unicodedata.normalize("NFC", tok) if unicodedata.category(ch)[0] in "LMN")
    if not core:
        return ""
    if re.fullmatch(r"[0-9०-९]+", core):
        return " ".join(spell_number(core))
    if re.search(r"[A-Za-z]", core):
        return latin_to_deva(re.sub(r"[^A-Za-z]", "", core))
    return core


def to_vocab(s, vocab):
    """chars -> ids; try as-is, then NFD, then strip nukta, else drop"""
    ids = []
    for ch in s:
        if ch == " ":
            ids.append(vocab["|"])
            continue
        for c in (ch, unicodedata.normalize("NFD", ch)):
            if all(x in vocab for x in c):
                ids += [vocab[x] for x in c]
                break
        else:
            base = unicodedata.normalize("NFD", ch).replace("़", "")
            ids += [vocab[x] for x in base if x in vocab]
    return ids


# ---------------------------------------------------------------- CTC
def viterbi(logp, tokens, blank):
    """logp [T,V]; tokens list of ids. Returns (state index per frame, extended label seq)."""
    T = logp.shape[0]
    ext = [blank]
    for t in tokens:
        ext += [t, blank]
    S = len(ext)
    ext = np.array(ext)
    NEG = -1e30
    dp = np.full((T, S), NEG)
    bp = np.zeros((T, S), dtype=np.int8)
    dp[0, 0] = logp[0, ext[0]]
    if S > 1:
        dp[0, 1] = logp[0, ext[1]]
    skip_ok = np.zeros(S, dtype=bool)
    for s in range(2, S):
        skip_ok[s] = ext[s] != blank and ext[s] != ext[s - 2]
    idx = np.arange(S)
    for t in range(1, T):
        prev = dp[t - 1]
        c1 = np.concatenate(([NEG], prev[:-1]))
        c2 = np.where(skip_ok, np.concatenate(([NEG, NEG], prev[:-2])), NEG)
        stack = np.stack([prev, c1, c2])
        arg = stack.argmax(0)  # ties -> lowest index: deterministic
        dp[t] = stack[arg, idx] + logp[t, ext]
        bp[t] = arg
    s = S - 1 if (S == 1 or dp[T - 1, S - 1] >= dp[T - 1, S - 2]) else S - 2
    if dp[T - 1, s] <= NEG / 2:
        raise RuntimeError("audio too short for text (T=%d frames, %d tokens)" % (T, len(tokens)))
    path = np.zeros(T, dtype=np.int64)
    for t in range(T - 1, -1, -1):
        path[t] = s
        s -= int(bp[t, s])
    return path, ext


def edit_distance(a, b):
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] != b[j - 1]))
    return d[len(b)]


# ---------------------------------------------------------------- main
def load_audio(path):
    import soundfile as sf, torch, torchaudio
    x, sr = sf.read(path, dtype="float32", always_2d=True)
    x = x.mean(1)
    if sr != SR:
        x = torchaudio.functional.resample(torch.from_numpy(x), sr, SR).numpy()
    return x


def emissions(wav, model_id):
    import torch
    from transformers import Wav2Vec2ForCTC
    model = Wav2Vec2ForCTC.from_pretrained(model_id).eval()
    x = torch.from_numpy(wav)
    x = (x - x.mean()) / (x.std() + 1e-7)
    with torch.inference_mode():
        lg = model(x[None]).logits[0]
    return torch.log_softmax(lg, -1).numpy().astype(np.float64), model.config


def align(wav_path, text, model_id=None, max_ext=0.12, gap=0.02):
    from huggingface_hub import hf_hub_download
    model_id = model_id or os.environ.get("ALIGN_CTC_MODEL", DEFAULT_MODEL)
    vp = os.path.join(model_id, "vocab.json") if os.path.isdir(model_id) else hf_hub_download(model_id, "vocab.json")
    vocab = json.load(open(vp, encoding="utf-8"))
    wav = load_audio(wav_path)
    dur = len(wav) / SR
    logp, cfg = emissions(wav, model_id)
    # NOTE measured: this model's CTC blank is id 0 (<s>), NOT config.pad_token_id (1). Detect it as the
    # most frequent argmax class so another checkpoint also works.
    blank = int(np.bincount(logp.argmax(1), minlength=logp.shape[1]).argmax())
    frame = dur / logp.shape[0]

    display = text.split()
    cleaned = [clean_token(t) for t in display]
    flat, spans = [], []
    for c in cleaned:
        ids = to_vocab(c, vocab) if c else []
        if not ids:
            spans.append(None)
            continue
        if flat:
            flat.append(vocab["|"])
        spans.append((len(flat), len(flat) + len(ids) - 1))
        flat += ids
    path, ext = viterbi(logp, flat, blank)
    tok_frames = {}
    for t, s in enumerate(path):
        if s % 2 == 1:
            tok_frames.setdefault(s // 2, []).append(t)
    words = []
    for k, sp in enumerate(spans):
        if sp is None:
            words.append({"word": display[k], "start": None, "end": None, "score": 0.0, "_t": None})
            continue
        frs = [f for j in range(sp[0], sp[1] + 1) for f in tok_frames.get(j, [])]
        a, b = min(frs), max(frs) + 1
        sc = float(np.mean([np.exp(logp[t, ext[path[t]]]) for t in frs]))
        words.append({"word": display[k], "start": a * frame, "end": b * frame, "score": round(sc, 3), "_t": (a, b)})
    prev_end = 0.0
    for w in words:  # punctuation-only tokens: zero-length at the previous boundary
        if w["start"] is None:
            w["start"] = w["end"] = prev_end
        else:
            prev_end = w["end"]
    for w in words:
        w["raw_start"], w["raw_end"] = round(w["start"], 3), round(w["end"], 3)
    # CTC spikes are peaky: stretch each end toward the next start (capped), keep `gap` before it
    for i, w in enumerate(words[:-1]):
        w["end"] = max(w["end"], min(w["end"] + max_ext, words[i + 1]["start"] - gap))
    words[-1]["end"] = min(dur, words[-1]["end"] + min(max_ext, 0.05))
    # greedy-decode CER per word over its own frames (mispronunciation / text-mismatch flag)
    am = logp.argmax(1)
    inv = {v: k for k, v in vocab.items()}
    for i, w in enumerate(words):
        t = w.pop("_t")
        if t is None or not cleaned[i]:
            continue
        out, p = [], -1
        for x in am[t[0]:t[1]]:
            if x != p and x != blank:
                out.append(inv[int(x)])
            p = x
        hyp = "".join(c for c in out if c != "|")
        ref = "".join(inv[j] for j in to_vocab(cleaned[i], vocab) if inv[j] != "|")
        w["cer"] = round(edit_distance(hyp, ref) / max(1, len(ref)), 2)
        w["hyp"] = hyp
    for w in words:
        w["start"], w["end"] = round(w["start"], 3), round(w["end"], 3)
    return words, dur


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--wav", required=True)
    ap.add_argument("--text", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default=None)
    ap.add_argument("--max-ext", type=float, default=0.12, help="max seconds a word end is stretched toward the next word")
    ap.add_argument("--threads", type=int, default=1)
    a = ap.parse_args()
    import torch
    torch.set_num_threads(a.threads)
    words, dur = align(a.wav, a.text, a.model, max_ext=a.max_ext)
    json.dump(words, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    low = [w["word"] for w in words if w["score"] < 0.3]
    print("aligned %d words over %.2fs; low-score words: %s" % (len(words), dur, low or "none"), file=sys.stderr)


if __name__ == "__main__":
    main()
