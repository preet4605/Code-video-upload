import fs from 'fs';
import { createCanvas } from '@napi-rs/canvas';
let src = fs.readFileSync(new URL('./scene.mjs', import.meta.url), 'utf8');
const cut = '    // light: everything';
src = src.slice(0, src.indexOf(cut)) + '  },\n};\nexport const DURATION = DUR;\n';
const variants = { base: s => s, norim: s => s.replace(/cin\.rimLight\([^\n]*\n/g, ''), nofab: s => s.replace(/cin\.fillTexture\(c, 'fabric'[^\n]*\n/, ''), nogradfill: s => s.replace("c.fillStyle = g; c.fillRect(SUB.x - 300, SUB.feet - 820, 600, 840); c.restore();", "c.restore();"), noshadow: s => s.replace(/cam\.layer\(ctx, 1\.1, \(c, b\) => subjectShadow[^\n]*\n/, '') };
for (const [n, f] of Object.entries(variants)) {
  fs.writeFileSync(new URL('./_dbg_scene.mjs', import.meta.url), f(src));
  const { VideoClock } = await import('./_dbg_scene.mjs?' + n);
  const c = createCanvas(540, 960), x = c.getContext('2d'); VideoClock.setTime(3); VideoClock.draw(x, 540, 960, {});
  console.log(n, Array.from(x.getImageData(200, 445, 1, 1).data));
}
