import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
import { createFigure, LIGHTS } from '../../../lib/kit/figures/index.mjs';
const W=1080,H=720; const c=createCanvas(W,H), x=c.getContext('2d');
x.fillStyle='#c9c3b4'; x.fillRect(0,0,W,H); x.fillStyle='#a89f88'; x.fillRect(0,640,W,80);
const mode=process.argv[3]||'a';
if(mode==='a'){
const specs=[{age:'child',outfit:'uniform',seed:3},{age:'child',sex:'f',outfit:'uniform',seed:4},{age:'adult',outfit:'kurta',seed:5},{age:'elder',sex:'f',outfit:'saree',seed:6,hair:{style:'bun'}},{age:'elder',outfit:'kurta',seed:7,glasses:true},{age:'adult',outfit:'coat',seed:8}];
specs.forEach((s,i)=>{ const f=createFigure(s); f.draw(x,{x:100+i*170,feet:690,height:i<2?330:480,pose:'stand',t:0.3,light:LIGHTS.noon}); });
} else {
// big close ups
const f1=createFigure({age:'child',outfit:'uniform',seed:3}), f2=createFigure({age:'elder',sex:'f',outfit:'saree',seed:6,hair:{style:'bun'},bangles:true}), f3=createFigure({age:'child',outfit:'uniform',seed:3,variant:'ghost'});
f1.draw(x,{x:200,feet:1500,height:1500,pose:'stand',t:0.3,light:LIGHTS.noon,expr:'afraid',gaze:[0.6,0.2]});
f2.draw(x,{x:560,feet:1500,height:1500,pose:'stand',t:1.3,light:LIGHTS.lamp,expr:'worried',talk:1});
f3.draw(x,{x:900,feet:1500,height:1500,pose:'stand',t:1.3,light:LIGHTS.noon});
}
fs.writeFileSync(process.argv[2],c.toBuffer('image/png'));
