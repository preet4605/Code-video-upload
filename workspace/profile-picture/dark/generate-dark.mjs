import fs from 'fs';
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const S=1080;
const penShape=(c)=>`
  <path d="M0 -565 C 58 -565 88 -520 86 -455 C 90 -400 128 -330 148 -230 C 160 -130 140 -50 100 -20 C 60 0 -60 0 -100 -20 C -140 -50 -160 -130 -148 -230 C -128 -330 -90 -400 -86 -455 C -88 -520 -58 -565 0 -565Z" fill="${c}"/>
  <path d="M100 -340 C 160 -300 198 -200 204 -62 C 188 -52 172 -90 156 -140 C 138 -200 122 -250 92 -290Z" fill="${c}"/>
  <path d="M-100 -340 C -160 -300 -198 -200 -204 -62 C -188 -52 -172 -90 -156 -140 C -138 -200 -122 -250 -92 -290Z" fill="${c}"/>
  <ellipse cx="-58" cy="-8" rx="62" ry="18" fill="${c}"/><ellipse cx="58" cy="-8" rx="62" ry="18" fill="${c}"/>`;
const q=(a,c,b,t)=>(1-t)*(1-t)*a+2*(1-t)*t*c+t*t*b;
// grin: crescent mouth + teeth hanging from the upper lip
const grin=(x1,x2,y,depth,n,{mouth='#7a0000',glow='#ff1c1c',teeth='#f4e6d0'}={})=>{
  const m=(x1+x2)/2, up=y+depth*.4, lo=y+depth;
  let t='';
  for(let i=0;i<n;i++){const a=(i+.08)/n,b=(i+.92)/n,c=(i+.5)/n;
    const ax=q(x1,m,x2,a),ay=q(y,up,y,a),bx=q(x1,m,x2,b),by=q(y,up,y,b),cx=q(x1,m,x2,c),cy=q(y,up,y,c);
    const L=(depth*.6)*(1-Math.abs(c-.5)*1.1)*(0.9+0.2*((i*7)%3)/2);
    t+=`<path d="M${ax} ${ay} L${cx} ${cy+L} L${bx} ${by}Z" fill="${teeth}"/>`;}
  return `<path d="M${x1} ${y} Q${m} ${lo*2-y} ${x2} ${y} Q${m} ${up*2-y} ${x1} ${y}Z" fill="${glow}" opacity=".55" filter="url(#b14)"/>
  <path d="M${x1} ${y} Q${m} ${lo*2-y} ${x2} ${y} Q${m} ${up*2-y} ${x1} ${y}Z" fill="${mouth}"/>${t}`;
};
const eye=(cx,cy,r,rot,{core='#ffd9c0',glow='#ff1a12',dim=1}={})=>`<g transform="translate(${cx} ${cy}) rotate(${rot})" opacity="${dim}">
  <ellipse rx="${r*2.4}" ry="${r*1.7}" fill="${glow}" opacity=".5" filter="url(#b24)"/>
  <ellipse rx="${r*1.25}" ry="${r*.8}" fill="${glow}"/><ellipse rx="${r*.7}" ry="${r*.42}" fill="${core}"/></g>`;
const defs=`<defs>
 <filter id="b6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
 <filter id="b14" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
 <filter id="b24" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="24"/></filter>
 <filter id="b80" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="80"/></filter>
 <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="11"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .6 -.2"/></filter>
 <radialGradient id="vig" cx="50%" cy="50%" r="72%"><stop offset="50%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".85"/></radialGradient>
</defs>`;
const wrap=(i)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${defs}${i}<rect width="${S}" height="${S}" fill="url(#vig)"/><rect width="${S}" height="${S}" filter="url(#grain)" opacity=".12"/></svg>`;

// D1: red-lit silhouette, grin, eyes
const D1=wrap(`
 <rect width="${S}" height="${S}" fill="#020102"/>
 <ellipse cx="540" cy="760" rx="520" ry="360" fill="#7a0808" opacity=".75" filter="url(#b80)"/>
 <ellipse cx="540" cy="520" rx="300" ry="420" fill="#a01010" opacity=".38" filter="url(#b80)"/>
 <g transform="translate(540 960) scale(1.3)">
  <g filter="url(#b6)" opacity=".95">${penShape('#ff2a1a')}</g>
  <g transform="scale(.97 1)"><g transform="scale(.82 1)">${penShape('#020102')}</g></g>
 </g>
 <g transform="translate(540 960) scale(1.3)">
  ${eye(-33,-505,13,14)}${eye(33,-505,13,-14)}
  ${grin(-62,62,-470,70,9)}
 </g>`);

// D2: nothing but eyes and a grin, penguin head outline barely there
const D2=wrap(`
 <rect width="${S}" height="${S}" fill="#010001"/>
 <ellipse cx="540" cy="500" rx="360" ry="440" fill="#5a0606" opacity=".55" filter="url(#b80)"/>
 <path d="M540 90 C 760 90 850 270 850 470 C 850 700 740 930 540 990 C 340 930 230 700 230 470 C 230 270 320 90 540 90Z" fill="#030102" stroke="#ff2a1a" stroke-opacity=".7" stroke-width="5"/>
 <path d="M540 90 C 760 90 850 270 850 470 C 850 700 740 930 540 990 C 340 930 230 700 230 470 C 230 270 320 90 540 90Z" fill="none" stroke="#ff2a1a" stroke-width="22" opacity=".28" filter="url(#b14)"/>
 ${eye(385,400,50,16)}${eye(695,400,50,-16)}
 <path d="M510 480 L570 480 L540 560Z" fill="#6b1d08"/>
 ${grin(300,780,650,230,13)}`);

// D3: face emerging from the dark, lit from one side
const bust=`M540 175 C 690 175 760 300 752 430 C 748 520 700 590 690 640 C 800 690 900 790 960 1080 L120 1080 C 180 790 280 690 390 640 C 380 590 332 520 328 430 C 320 300 390 175 540 175Z`;
const D3=wrap(`
 <rect width="${S}" height="${S}" fill="#010001"/>
 <linearGradient id="side" x1="0" y1="0" x2="1" y2="0.15"><stop offset="0" stop-color="#8a1010"/><stop offset=".42" stop-color="#2a0505"/><stop offset=".62" stop-color="#050101"/><stop offset="1" stop-color="#010001"/></linearGradient>
 <linearGradient id="rim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff3a22"/><stop offset=".5" stop-color="#ff3a22" stop-opacity=".25"/><stop offset=".7" stop-color="#ff3a22" stop-opacity="0"/></linearGradient>
 <ellipse cx="300" cy="500" rx="300" ry="500" fill="#7a0808" opacity=".5" filter="url(#b80)"/>
 <path d="${bust}" fill="url(#side)"/>
 <path d="${bust}" fill="none" stroke="url(#rim)" stroke-width="22" opacity=".5" filter="url(#b6)"/>
 <path d="${bust}" fill="none" stroke="url(#rim)" stroke-width="6"/>
 ${eye(440,410,52,14)}${eye(645,410,40,-12,{core:'#ff5040',glow:'#7a0808',dim:.55})}
 <path d="M510 478 L570 478 L540 548Z" fill="#7a2a0e" opacity=".8"/>
 ${grin(400,700,585,120,10,{teeth:'#e9d6bb'})}
 <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset=".85" stop-color="#000" stop-opacity=".6"/></linearGradient><rect width="1080" height="1080" fill="url(#fade)"/>`);

fs.writeFileSync('D1.svg',D1);fs.writeFileSync('D2.svg',D2);fs.writeFileSync('D3.svg',D3);
const b=await chromium.launch();const p=await b.newPage({viewport:{width:S,height:S}});
for(const k of ['D1','D2','D3']){await p.setContent(`<body style="margin:0;background:#000">${fs.readFileSync(k+'.svg','utf8')}</body>`);await p.screenshot({path:k+'.png'});}
await b.close();
