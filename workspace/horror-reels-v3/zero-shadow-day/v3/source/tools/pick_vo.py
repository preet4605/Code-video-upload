# generate N TTS candidates per line, score by ASR similarity, keep the best raw clip; set exact tempo so durations match v1 timing
import json,subprocess,sys,os,base64,difflib,re,urllib.request,concurrent.futures as cf,numpy as np
from faster_whisper import WhisperModel
proj=sys.argv[1]; N=int(sys.argv[2]); TEMP=float(sys.argv[3]); FREE='--free' in sys.argv
spec=json.load(open(f'{proj}/lines.json')); tl=json.load(open('/tmp/timeline_v1.json'))
tgt={l['i']:l['end_s']-l['start_s'] for s in tl['scenes'] for l in s['lines']}
key=os.environ['KALPA_API_KEY']; m=WhisperModel('small',device='cpu',compute_type='int8')
def tts(text):
    for a in range(4):
        try:
            r=urllib.request.Request(f"https://api.kalpalabs.ai/v1/tts/{spec['voice']}",data=json.dumps({'text':text,'sample_rate':48000,'params':{'temperature':TEMP}}).encode(),headers={'Authorization':f'Bearer {key}','Content-Type':'application/json'})
            return base64.b64decode(json.load(urllib.request.urlopen(r,timeout=120))['audio']['data_b64'])
        except Exception as e: err=e
    raise err
def trim(inp,out):
    subprocess.run(['ffmpeg','-v','error','-y','-i',inp,'-af','silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse',out],check=True)
def dur(f): return float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f],capture_output=True,text=True).stdout)
def asr(f):
    b=subprocess.run(['ffmpeg','-v','error','-i',f,'-ar','16000','-ac','1','-f','f32le','-'],capture_output=True).stdout
    seg,_=m.transcribe(np.frombuffer(b,dtype=np.float32),language='hi',beam_size=5); return ''.join(s.text for s in seg)
norm=lambda s: re.sub(r'[^ऀ-ॿ ]','',s).replace('।','').replace('़','').strip()
os.makedirs(f'{proj}/cache/vo',exist_ok=True)
for i,l in enumerate(spec['lines']):
    cands=[]
    with cf.ThreadPoolExecutor(4) as ex: raws=list(ex.map(lambda _:tts(l['hi']),range(N)))
    for k,raw in enumerate(raws):
        p=f'/tmp/cand_{i}_{k}.wav'; open(p,'wb').write(raw); t=f'/tmp/cand_{i}_{k}_t.wav'; trim(p,t)
        d=dur(t); sim=difflib.SequenceMatcher(None,norm(asr(t)),norm(l['hi'])).ratio()
        pen=0 if FREE else max(0,abs(d/tgt[i]-1)-0.08)*2          # prefer clips that already fit the old timing
        cands.append((sim-pen,sim,d,k,p))
    cands.sort(reverse=True); best=cands[0]
    print(i,'scores',[(round(c[1],2),round(c[2],2)) for c in cands],'-> pick',best[3],flush=True)
    open(f'{proj}/cache/vo/l{i:02d}_raw.wav','wb').write(open(best[4],'rb').read())
    open(f'{proj}/cache/vo/l{i:02d}.txt','w').write(f"{spec['voice']}|{spec['temperature']}|{l['hi']}")
    l.pop('exact_tempo',None)
    if not FREE: l['tempo']=round(max(0.8,min(1.25,best[2]/tgt[i])),4); l['exact_tempo']=True
json.dump(spec,open(f'{proj}/lines.json','w'),ensure_ascii=False,indent=1)
