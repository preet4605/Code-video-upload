import fs from 'fs';
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const names={D1:'D1 · Red Rim Grin',D2:'D2 · Eyes + Grin Only',D3:'D3 · Emerging From the Dark'};
const img=k=>'data:image/png;base64,'+fs.readFileSync(k+'.png').toString('base64');
const circ=(k,px)=>`<div><img class="c" style="width:${px}px;height:${px}px" src="${img(k)}"><span>${px}px</span></div>`;
const col=k=>`<div class="col"><div class="t">${names[k]}</div><img class="full" src="${img(k)}">
<div class="row dark">${circ(k,110)}${circ(k,64)}${circ(k,40)}</div><div class="row light">${circ(k,110)}${circ(k,64)}${circ(k,40)}</div></div>`;
const html=`<body style="margin:0;background:#161616;font-family:Inter,Arial,sans-serif;color:#ddd"><style>.wrap{display:flex;gap:40px;padding:40px;width:max-content}.col{width:420px}.t{font-size:22px;margin-bottom:12px;font-weight:600}.full{width:420px;height:420px;border-radius:6px}
.row{display:flex;gap:28px;align-items:flex-end;margin-top:14px;padding:12px;border-radius:8px}.dark{background:#000}.light{background:#f2f2f2}.light span{color:#555}.row div{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;color:#999}.c{border-radius:50%}</style>
<div class="wrap">${['D1','D2','D3'].map(col).join('')}</div></body>`;
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1480,height:860}});
await p.setContent(html);await p.screenshot({path:'preview2.png'});await b.close();
