// node tools/peek.mjs <project> <out.png> [t1,t2,...]  -> grid of frames at 360x640
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
import { createCanvas, GlobalFonts } from './../skill/code-video-studio/node_modules/@napi-rs/canvas/index.js';
const fontDir = path.resolve('skill/code-video-studio/fonts');
for (const f of fs.readdirSync(fontDir)) GlobalFonts.registerFromPath(path.join(fontDir, f), f.includes('Devanagari') ? 'Noto Sans Devanagari' : 'Noto Sans');
const proj = path.resolve(process.argv[2]); const out = process.argv[3];
const tl = JSON.parse(fs.readFileSync(path.join(proj, 'timeline.json')));
let ts = process.argv[4] ? process.argv[4].split(',').map(Number) : null;
if (!ts) { ts = []; for (const s of tl.scenes) { const d = s.end_s - s.start_s; ts.push(s.start_s + d * 0.3, s.start_s + d * 0.8); } }
const { VideoClock } = await import(pathToFileURL(path.join(proj, 'scene.mjs')));
const W = +(process.env.PW||360), H = W*16/9, cols = Math.min(6, ts.length), rows = Math.ceil(ts.length / cols);
const big = createCanvas(cols * W, rows * H); const bctx = big.getContext('2d');
const c = createCanvas(W, H); const ctx = c.getContext('2d');
ts.forEach((t, i) => { ctx.clearRect(0, 0, W, H); VideoClock.setTime(t); VideoClock.draw(ctx, W, H, tl); bctx.drawImage(c, (i % cols) * W, Math.floor(i / cols) * H); bctx.fillStyle = '#ff0'; bctx.font = '20px sans-serif'; bctx.fillText(t.toFixed(1) + 's', (i % cols) * W + 8, Math.floor(i / cols) * H + 24); });
fs.writeFileSync(out, big.toBuffer('image/png')); console.log(out, ts.map((t) => t.toFixed(1)).join(','));
