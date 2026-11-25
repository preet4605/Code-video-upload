import fs from 'node:fs';
const DUR=57.3, FPS=30;
const SH=[[0,5.44,'lane_rear'],[5.44,11.52,'side_tea'],[11.52,14.79,'crossing'],[14.79,16.37,'drop'],[16.37,19.26,'chase_track'],[19.26,26,'chase_market'],[26,31.5,'mirror'],[31.5,36.83,'chase_track2'],[36.83,37.37,'lookback'],[37.37,41.98,'train_wait'],[41.98,50.19,'wedding_lane'],[50.19,52.03,'gate'],[52.03,54.3,"doli"],[54.3,DUR,"endcard_loop"]];
const P=['camera.path','camera.handheld','bulb.flicker','fog.drift','grain.seed','ca.hit'];
const scenes=SH.map(([a,b,id])=>{const n=Math.max(1,Math.round((b-a)/1.5));const d=(b-a)/n;return {id,start_s:a,end_s:b,mood:b<14.8?'suspense':'climax',ambient_motion:true,beats:Array.from({length:n},(_,i)=>({t_s:Number((i*d).toFixed(3)),dur_s:Number(d.toFixed(3)),hold:false,flashes_per_sec:0,animated_properties:P}))}});
const tl={version:'1.0',slug:'dulhan-rail',aspect:'9:16',width:1080,height:1920,fps:FPS,duration_s:DUR,target_lufs:-14,true_peak_dbtp:-1.5,audio_file:null,scenes,lines:[],words:[],captions:[],audio_cues:[]};
fs.writeFileSync('timeline.json',JSON.stringify(tl,null,1));console.log('ok',scenes.length);
