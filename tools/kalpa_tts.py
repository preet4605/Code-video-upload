#!/usr/bin/env python3
"""Kalpa TTS helper. Usage: kalpa_tts.py [-g genre] [-v voice] [-t temp] [-r rate] out.wav < text
Text via stdin or --text. Key from $KALPA_API_KEY. Hindi text: use Devanagari."""
import argparse, base64, json, os, sys, urllib.request, urllib.error

VOICES = {  # kalpa-tts-1 Hindi voices
    "aman": "1eb6c010-34e0-477c-9d24-e915f853359e",
    "kiara": "5e0c5704-590f-483b-b291-00a2415cb67e",
    "sana": "902b3219-1f67-40f2-80b9-0c2a28600615",
    "arjun": "18c26f49-9f9c-400c-bec9-7467f28e1db5",
    "nikhil": "13604d2a-7a9e-4524-b3b7-32d6372f0e56",
    "dev": "bc22cae9-0935-4420-bd31-1fd360fc5e71",
    "wren": "dda5319f-3b81-4124-b69e-9241eb510b77",
}
GENRE_VOICE = {"horror": "aman"}  # default voice per genre

p = argparse.ArgumentParser()
p.add_argument("out")
p.add_argument("-g", "--genre", default="")
p.add_argument("-v", "--voice", default="")
p.add_argument("-t", "--temp", type=float, default=0.9)
p.add_argument("-r", "--rate", type=int, default=24000)
p.add_argument("--text")
a = p.parse_args()
name = (a.voice or GENRE_VOICE.get(a.genre, "kiara")).lower()
vid = VOICES.get(name, name)
text = (a.text or sys.stdin.read()).strip()
req = urllib.request.Request(
    f"https://api.kalpalabs.ai/v1/tts/{vid}",
    data=json.dumps({"text": text, "model": "kalpa-tts-1",
                     "params": {"temperature": a.temp}, "sample_rate": a.rate}).encode(),
    headers={"Authorization": f"Bearer {os.environ['KALPA_API_KEY']}",
             "Content-Type": "application/json"})
try:
    d = json.load(urllib.request.urlopen(req, timeout=120))
except urllib.error.HTTPError as e:
    sys.exit(f"HTTP {e.code}: {e.read().decode()[:300]}")
open(a.out, "wb").write(base64.b64decode(d["audio"]["data_b64"]))
print(f"{name} -> {a.out} ({d['usage']['output_audio_seconds']}s)")
