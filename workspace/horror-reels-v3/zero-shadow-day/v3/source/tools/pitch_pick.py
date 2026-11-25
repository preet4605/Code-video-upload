# re-pick VO takes: good ASR match AND pitch close to one target, so the voice doesn't drift line to line
import json,subprocess,sys,os,base64,difflib,re,urllib.request,concurrent.futures as cf,numpy as np
from faster_whisper import WhisperModel
proj=sys.argv[1]; TEMP=0.65
spec=json.load(open(f'{proj}/lines.json')); key=os.environ['KALPA_API_KEY']
m=WhisperModel('small',device='cpu',compute_type='int8')
def load(f,sr=16000): return np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',f,'-ar',str(sr),'-ac','1','-f','f32le','-'],capture_output=True).stdout,dtype=np.float32)
def f0(x,sr=16000):
    fr=[];n=640
    for i in range(0,len(x)-n,n//2):
        w=x[i:i+n]
        if np.sqrt((w**2).mean())<0.02: continue
        w=w-w.mean(); c=np.correlate(w,w,'full')[n-1:]; lo,hi=sr//400,sr//70; k=lo+np.argmax(c[lo:hi])
        if c[k]>0.4*c[0]: fr.append(sr/k)
    return float(np.median(fr)) if fr else 0.0
norm=lambda s: re.sub(r'[^ऀ-ॿ ]','',s).replace('़','').strip()
def asr(f):
    seg,_=m.transcribe(load(f),language='hi',beam_size=5); return ''.join(s.text for s in seg)
def tts(text):
    for a in range(4):
        try:
            r=urllib.request.Request(f"https://api.kalpalabs.ai/v1/tts/{spec['voice']}",data=json.dumps({'text':text,'sample_rate':48000,'params':{'temperature':TEMP}}).encode(),headers={'Authorization':f'Bearer {key}','Content-Type':'application/json'})
            return base64.b64decode(json.load(urllib.request.urlopen(r,timeout=120))['audio']['data_b64'])
        except Exception as e: err=e
    raise err
def trim(i,o): subprocess.run(['ffmpeg','-v','error','-y','-i',i,'-af','silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse',o],check=True)
C={}
for i,l in enumerate(spec['lines']):
    C[i]=[]
    k=0
    while os.path.exists(f'/tmp/cand_{i}_{k}_t.wav'):
        t=f'/tmp/cand_{i}_{k}_t.wav'; C[i].append(dict(k=k,raw=f'/tmp/cand_{i}_{k}.wav',t=t,f0=f0(load(t)),sim=difflib.SequenceMatcher(None,norm(asr(t)),norm(l['hi'])).ratio())); k+=1
allf=[c['f0'] for i in C for c in C[i]]; TGT=float(np.median(allf)); print('target f0',round(TGT,1),flush=True)
def ok(c,best): return c['sim']>=best-0.04 and abs(c['f0']/TGT-1)<=0.08
for i,l in enumerate(spec['lines']):
    tries=0
    while True:
        best=max(c['sim'] for c in C[i]); good=[c for c in C[i] if ok(c,best)]
        if good or tries>=2: break
        tries+=1
        with cf.ThreadPoolExecutor(4) as ex: raws=list(ex.map(lambda _:tts(l['hi']),range(4)))
        for raw in raws:
            k=len(C[i]); p=f'/tmp/cand_{i}_{k}.wav'; open(p,'wb').write(raw); t=f'/tmp/cand_{i}_{k}_t.wav'; trim(p,t)
            C[i].append(dict(k=k,raw=p,t=t,f0=f0(load(t)),sim=difflib.SequenceMatcher(None,norm(asr(t)),norm(l['hi'])).ratio()))
    pool=good or C[i]
    pick=min(pool,key=lambda c:abs(c['f0']/TGT-1)-0.5*c['sim'])
    print(i,'pick',pick['k'],'f0',round(pick['f0']),'sim',round(pick['sim'],2),'n',len(C[i]),'in-band' if good else 'CLOSEST',flush=True)
    open(f'{proj}/cache/vo/l{i:02d}_raw.wav','wb').write(open(pick['raw'],'rb').read())
    open(f'{proj}/cache/vo/l{i:02d}.txt','w').write(f"{spec['voice']}|{spec['temperature']}|{l['hi']}")
