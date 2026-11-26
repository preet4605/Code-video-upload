import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
import { createFigure, LIGHTS } from '../../../lib/kit/figures/index.mjs';
const W=1080,H=720; const c=createCanvas(W,H), x=c.getContext('2d');
x.fillStyle='#c9c3b4'; x.fillRect(0,0,W,H); x.fillStyle='#a89f88'; x.fillRect(0,600,W,120);
const specs=[{age:'child',outfit:'uniform',seed:3},{age:'child',sex:'f',outfit:'uniform',seed:4},{age:'adult',outfit:'kurta',seed:5},{age:'elder',sex:'f',outfit:'saree',seed:6,hair:{style:'bun'}},{age:'elder',outfit:'kurta',seed:7,glasses:true},{age:'adult',outfit:'coat',seed:8}];
specs.forEach((s,i)=>{ const f=createFigure(s); f.draw(x,{x:100+i*170,feet:640,height:i<2?330:480,pose:'stand',t:0.3,light:LIGHTS.noon}); });
fs.writeFileSync(process.argv[2],c.toBuffer('image/png'));
