import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const S = 1080;
// penguin local space: baseline y=0, centre x=0, ~560 tall
const penguin = ({body='#040404', beak='#ff6a13', eye='#ff3a1a', eyeR=13, rim=null}={}) => `
  <g transform="scale(.82 1)">
  ${rim?`<g filter="url(#blur6)" opacity=".95">${penShape(rim)}</g>`:''}
  ${penShape(body)}
  <path d="M-26 -468 L26 -468 L0 -428Z" fill="${beak}"/>
  <circle cx="-42" cy="-498" r="${eyeR*1.6}" fill="${eye}" opacity=".35" filter="url(#blur6)"/><circle cx="42" cy="-498" r="${eyeR*1.6}" fill="${eye}" opacity=".35" filter="url(#blur6)"/>
  <circle cx="-42" cy="-498" r="${eyeR}" fill="${eye}"/><circle cx="42" cy="-498" r="${eyeR}" fill="${eye}"/>
  <circle cx="-42" cy="-498" r="${eyeR*.45}" fill="#ffe8c0"/><circle cx="42" cy="-498" r="${eyeR*.45}" fill="#ffe8c0"/>
  </g>`;
const penShape = (c) => `
  <path d="M0 -565 C 58 -565 88 -520 86 -455 C 90 -400 128 -330 148 -230 C 160 -130 140 -50 100 -20 C 60 0 -60 0 -100 -20 C -140 -50 -160 -130 -148 -230 C -128 -330 -90 -400 -86 -455 C -88 -520 -58 -565 0 -565Z" fill="${c}"/>
  <path d="M100 -340 C 160 -300 198 -200 204 -62 C 188 -52 172 -90 156 -140 C 138 -200 122 -250 92 -290Z" fill="${c}"/>
  <path d="M-100 -340 C -160 -300 -198 -200 -204 -62 C -188 -52 -172 -90 -156 -140 C -138 -200 -122 -250 -92 -290Z" fill="${c}"/>
  <ellipse cx="-58" cy="-8" rx="62" ry="18" fill="${c}"/><ellipse cx="58" cy="-8" rx="62" ry="18" fill="${c}"/>`;

const defs = `<defs>
 <filter id="blur6"><feGaussianBlur stdDeviation="6"/></filter>
 <filter id="blur30" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>
 <filter id="blur80" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="80"/></filter>
 <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 -.18"/></filter>
 <radialGradient id="vig" cx="50%" cy="50%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".75"/></radialGradient>
 <radialGradient id="moon" cx="42%" cy="38%" r="75%"><stop offset="0%" stop-color="#ffb347"/><stop offset="45%" stop-color="#ff6a13"/><stop offset="100%" stop-color="#b3200e"/></radialGradient>
 <radialGradient id="bgA" cx="50%" cy="42%" r="80%"><stop offset="0%" stop-color="#3a0e08"/><stop offset="55%" stop-color="#12060a"/><stop offset="100%" stop-color="#030203"/></radialGradient>
 <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffa646" stop-opacity=".95"/><stop offset="100%" stop-color="#ff6a13" stop-opacity=".12"/></linearGradient>
</defs>`;
const finish = `<rect width="${S}" height="${S}" fill="url(#vig)"/><rect width="${S}" height="${S}" filter="url(#grain)" opacity=".10"/>`;
const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${defs}${inner}${finish}</svg>`;

// A: penguin against a blood-orange moon
const A = wrap(`
 <rect width="${S}" height="${S}" fill="url(#bgA)"/>
 <circle cx="540" cy="440" r="430" fill="#ff5a10" opacity=".55" filter="url(#blur80)"/>
 <circle cx="540" cy="440" r="385" fill="url(#moon)"/>
 <g fill="#8a1608" opacity=".28"><circle cx="420" cy="360" r="46"/><circle cx="640" cy="540" r="62"/><circle cx="470" cy="580" r="30"/><circle cx="650" cy="330" r="26"/></g>
 <path d="M0 925 C 200 905 380 935 540 923 C 720 911 900 939 1080 917 L1080 1080 L0 1080Z" fill="#030203"/>
 <g transform="translate(540 950) scale(1.14)">${penguin({rim:'#ff7a1a'})}</g>`);

// B: bust close-up, eyes in the dark
const eyeB = (cx)=>`<g transform="translate(${cx} 410)">
  <circle r="100" fill="#ff5a10" opacity=".6" filter="url(#blur30)"/>
  <circle r="58" fill="#ffd9a0"/><circle r="58" fill="url(#moon)" opacity=".5"/>
  <ellipse rx="13" ry="42" fill="#050505"/></g>`;
const bust = `M540 175 C 690 175 760 300 752 430 C 748 520 700 590 690 640 C 800 690 900 790 960 1080 L120 1080 C 180 790 280 690 390 640 C 380 590 332 520 328 430 C 320 300 390 175 540 175Z`;
const B = wrap(`
 <rect width="${S}" height="${S}" fill="#050405"/>
 <circle cx="540" cy="500" r="480" fill="#4a1008" opacity=".8" filter="url(#blur80)"/>
 <path d="${bust}" fill="none" stroke="#ff6a13" stroke-width="26" opacity=".5" filter="url(#blur6)"/>
 <path d="${bust}" fill="#060505" stroke="#ff6a13" stroke-opacity=".95" stroke-width="7"/>
 ${eyeB(440)}${eyeB(640)}
 <path d="M500 520 C 520 505 560 505 580 520 L540 700Z" fill="#ff6a13"/>
 <path d="M500 520 C 520 560 560 560 580 520" stroke="#050505" stroke-width="7" fill="none"/>
 <path d="M540 548 L540 690" stroke="#8a1608" stroke-width="5"/>`);

// C: lamp-lit wall, the shadow is not a penguin
const arm = `<path d="M44 -525 L64 -512 L104 -300 L118 -70 L132 -8 L116 -4 L108 -40 L100 -12 L90 -70 L84 -300 L50 -430Z"/>`;
const human = `<g fill="#000">
  <ellipse cx="0" cy="-598" rx="34" ry="50"/>
  <path d="M-24 -636 C -44 -650 -66 -652 -80 -676 C -50 -676 -26 -664 -8 -644Z M24 -636 C 44 -650 66 -652 80 -676 C 50 -676 26 -664 8 -644Z"/>
  <path d="M-14 -552 L14 -552 L50 -520 L44 -380 L38 -250 L28 -12 L6 -12 L0 -240 L-6 -12 L-28 -12 L-38 -250 L-44 -380 L-50 -520Z"/>
  ${arm}<g transform="scale(-1 1)">${arm}</g></g>`;
const C = wrap(`
 <rect width="${S}" height="${S}" fill="#050407"/>
 <radialGradient id="wall" cx="10%" cy="6%" r="100%"><stop offset="0%" stop-color="#ffd089"/><stop offset="30%" stop-color="#ff8a2a"/><stop offset="70%" stop-color="#8f2a0c"/><stop offset="100%" stop-color="#1a0806"/></radialGradient>
 <rect width="${S}" height="${S}" fill="url(#wall)"/>
 <!-- floor -->
 <rect y="935" width="${S}" height="150" fill="#030203"/>
 <!-- the shadow (taller, human, wrong) -->
 <g transform="translate(660 940) scale(1.2)" opacity=".96">${human}</g>
 <g transform="translate(430 940) scale(.9)">${penguin({rim:'#ffd089'})}</g>`);

fs.writeFileSync('A.svg',A);fs.writeFileSync('B.svg',B);fs.writeFileSync('C.svg',C);
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:S,height:S}});
for (const k of ['A','B','C']) { await p.setContent(`<body style="margin:0;background:#000">${fs.readFileSync(k+'.svg','utf8')}</body>`); await p.screenshot({path:k+'.png'}); }
await b.close();
