import sys, subprocess, numpy as np
from faster_whisper import WhisperModel
m = WhisperModel("small", compute_type="int8")
for f in sys.argv[1:]:
    raw = subprocess.run(["ffmpeg","-v","error","-i",f,"-f","s16le","-ac","1","-ar","16000","-"],capture_output=True).stdout
    a = np.frombuffer(raw, np.int16).astype(np.float32)/32768
    segs,_ = m.transcribe(a, language="hi", beam_size=1)
    print(f, "::", " ".join(s.text.strip() for s in segs))
