import fs from 'node:fs';
const SK='/mnt/project-files/skills/code-video-studio-v6.1/';
const { loadCanvas } = await import(SK+'lib/runtime.mjs');
const { createCanvas, GlobalFonts } = await loadCanvas();
for (const f of fs.readdirSync(SK+'fonts')) if (/\.(ttf|otf)$/i.test(f)) GlobalFonts.registerFromPath(SK+'fonts/'+f);
const { VideoClock } = await import('./scene.mjs?'+Date.now());
const tl = JSON.parse(fs.readFileSync('timeline.json','utf8'));
const W=Number(process.argv[2]||540), H=W*16/9;
const times = process.argv.slice(3).map(Number);
fs.mkdirSync('stills',{recursive:true});
for (const t of times) {
  const c=createCanvas(W,H), ctx=c.getContext('2d');
  const t0=Date.now(); VideoClock.setTime(t); VideoClock.draw(ctx,W,H,tl);
  fs.writeFileSync(`stills/f_${t.toFixed(2)}.png`, c.toBuffer('image/png'));
  console.log(t, Date.now()-t0,'ms');
}
