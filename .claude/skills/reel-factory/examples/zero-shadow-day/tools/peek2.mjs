// node tools/peek2.mjs <project> <out.png> t1,t2,...   (fresh canvas per frame, then montage)
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '../../../node_modules/@napi-rs/canvas/index.js';
const fontDir = path.resolve(new URL('../../../fonts', import.meta.url).pathname);
for (const f of fs.readdirSync(fontDir)) GlobalFonts.registerFromPath(path.join(fontDir, f), f.includes('Devanagari') ? 'Noto Sans Devanagari' : 'Noto Sans');
const proj = path.resolve(process.argv[2]); const out = process.argv[3];
const tl = JSON.parse(fs.readFileSync(path.join(proj, 'timeline.json')));
const ts = process.argv[4].split(',').map(Number);
const { VideoClock } = await import(pathToFileURL(path.join(proj, 'scene.mjs')));
const Wd = +(process.env.PW || 360), H = Math.round(Wd * 16 / 9), cols = Math.min(+(process.env.COLS || 6), ts.length), rows = Math.ceil(ts.length / cols);
const big = createCanvas(cols * Wd, rows * H); const bctx = big.getContext('2d');
for (let i = 0; i < ts.length; i++) {
  const c = createCanvas(Wd, H); const ctx = c.getContext('2d');
  VideoClock.setTime(ts[i]); VideoClock.draw(ctx, Wd, H, tl);
  const img = await loadImage(c.toBuffer('image/png'));
  bctx.drawImage(img, (i % cols) * Wd, Math.floor(i / cols) * H);
  bctx.fillStyle = '#f00'; bctx.font = '18px sans-serif'; bctx.fillText(ts[i].toFixed(1) + 's', (i % cols) * Wd + 6, Math.floor(i / cols) * H + 20);
}
fs.writeFileSync(out, big.toBuffer('image/png')); console.log(out);
