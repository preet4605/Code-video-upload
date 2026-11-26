// render the keyframes (0.2 / 0.5 / 0.85 of each shot) of a scene.mjs at 540x960 and save PNGs + metrics. usage: node render_frames.mjs <sceneDir> <outDir> [label]
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL, fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
for (const f of fs.readdirSync(path.join(ROOT, 'fonts')).filter((x) => /\.ttf$/.test(x))) GlobalFonts.registerFromPath(path.join(ROOT, 'fonts', f));
const [dir, out] = process.argv.slice(2), shots = ['s1_hook', 's2_dadi', 's5_hand'], KEYS = [0.2, 0.5, 0.85];
fs.mkdirSync(out, { recursive: true });
const tl = JSON.parse(fs.readFileSync(path.join(path.resolve(dir), 'timeline.json'), 'utf8'));
const VC = (await import(pathToFileURL(path.resolve(dir, 'scene.mjs')).href)).VideoClock;
for (const id of shots) { const sc = tl.scenes.find((s) => s.id === id); KEYS.forEach((k, i) => { const t = sc.start_s + (sc.end_s - sc.start_s) * k, c = createCanvas(540, 960); VC.setTime(t); VC.draw(c.getContext('2d'), 540, 960, tl); fs.writeFileSync(path.join(out, `${id}_${i}.png`), c.toBuffer('image/png')); }); }
console.log('ok');
