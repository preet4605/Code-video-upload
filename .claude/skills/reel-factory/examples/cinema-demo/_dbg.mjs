import fs from 'fs';
import { createCanvas } from '@napi-rs/canvas';
const stop = process.argv[2];
let src = fs.readFileSync(new URL('./scene.mjs', import.meta.url), 'utf8');
const cut = { layers: '    // light: everything', mask: '    // emissive background', sky: '    // god rays', rays: '    cin.fog', fog: '    // out-of-focus', fg: '    cin.post' }[stop];
src = src.slice(0, src.indexOf(cut)) + '  },\n};\nexport const DURATION = DUR;\n';
fs.writeFileSync(new URL('./_dbg_scene.mjs', import.meta.url), src);
const { VideoClock } = await import('./_dbg_scene.mjs');
const c = createCanvas(540, 960); VideoClock.setTime(3); VideoClock.draw(c.getContext('2d'), 540, 960, {});
// composite over magenta so transparent shows
const o = createCanvas(540, 960), x = o.getContext('2d'); x.fillStyle = '#f0f'; x.fillRect(0, 0, 540, 960); x.drawImage(c, 0, 0);
fs.writeFileSync(process.argv[3], o.toBuffer('image/png'));
