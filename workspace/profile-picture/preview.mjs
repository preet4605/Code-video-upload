import fs from 'fs';
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const names={A:'A · Blood Moon',B:'B · Eyes in the Dark',C:'C · Wrong Shadow'};
const img=k=>'data:image/png;base64,'+fs.readFileSync(k+'.png').toString('base64');
const col=k=>`<div class="col"><div class="t">${names[k]}</div><img class="full" src="${img(k)}">
<div class="row"><div><img class="c" style="width:110px;height:110px" src="${img(k)}"><span>110px</span></div>
<div><img class="c" style="width:64px;height:64px" src="${img(k)}"><span>64px</span></div>
<div><img class="c" style="width:40px;height:40px" src="${img(k)}"><span>40px (feed/comment)</span></div></div></div>`;
const html=`<body style="margin:0;background:#101010;font-family:Inter,Arial,sans-serif;color:#ddd">
<style>.wrap{display:flex;gap:40px;padding:40px;width:max-content}.col{width:420px}.t{font-size:22px;margin-bottom:12px;font-weight:600}.full{width:420px;height:420px;border-radius:6px}
.row{display:flex;gap:28px;align-items:flex-end;margin-top:18px}.row div{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;color:#999}.c{border-radius:50%}</style>
<div class="wrap">${['A','B','C'].map(col).join('')}</div></body>`;
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1480,height:700},deviceScaleFactor:1});
await p.setContent(html);await p.screenshot({path:'preview.png'});await b.close();
