import fs from 'fs';
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [,, scene='2', size='540', out='out.png', seed='3', mask='0', zoom='1'] = process.argv;
const frag = fs.readFileSync(new URL('./scene.frag', import.meta.url),'utf8');
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-gpu-watchdog']});
const p=await b.newPage({viewport:{width:200,height:200}});
p.setDefaultTimeout(0);
const t0=Date.now();
const data=await p.evaluate(async ({frag,scene,size,seed,mask,zoom})=>{
  const S=+size;const c=document.createElement('canvas');c.width=c.height=S;
  const gl=c.getContext('webgl2',{preserveDrawingBuffer:true,antialias:false});
  const mk=(t,s)=>{const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;};
  const pr=gl.createProgram();
  gl.attachShader(pr,mk(gl.VERTEX_SHADER,`#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`));
  gl.attachShader(pr,mk(gl.FRAGMENT_SHADER,frag));gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(pr,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  gl.uniform2f(gl.getUniformLocation(pr,'R'),S,S);gl.uniform1i(gl.getUniformLocation(pr,'uScene'),+scene);gl.uniform1f(gl.getUniformLocation(pr,'uSeed'),+seed);gl.uniform1i(gl.getUniformLocation(pr,'uMask'),+mask);gl.uniform1f(gl.getUniformLocation(pr,'uZoom'),+zoom);
  gl.viewport(0,0,S,S);gl.enable(gl.SCISSOR_TEST);
  const N=12,h=Math.ceil(S/N);
  for(let i=0;i<N;i++){gl.scissor(0,i*h,S,h);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.finish();await new Promise(r=>setTimeout(r,5));}
  return c.toDataURL('image/png');
},{frag,scene,size,seed,mask,zoom});
fs.writeFileSync(out,Buffer.from(data.split(',')[1],'base64'));
console.log('rendered',out,((Date.now()-t0)/1000).toFixed(1)+'s');
await b.close();
