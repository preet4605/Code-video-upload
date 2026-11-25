import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const S = '/mnt/project-files/skills/code-video-studio-v6.1';
const { loadCanvas } = await import(`${S}/lib/runtime.mjs`);
const { createCanvas, GlobalFonts } = await loadCanvas();
for (const f of fs.readdirSync(`${S}/fonts`)) if (/\.(ttf|otf)$/i.test(f)) GlobalFonts.registerFromPath(`${S}/fonts/${f}`);
const proj = path.resolve(process.argv[2]); const scale = Number(process.env.SC || 0.5);
const tl = JSON.parse(fs.readFileSync(`${proj}/timeline.json`, 'utf8'));
const { VideoClock } = await import(pathToFileURL(`${proj}/scene.mjs`).href + `?v=${Date.now()}`);
const W = Math.round(1080 * scale), H = Math.round(1920 * scale);
const times = process.argv.slice(3).map(Number);
fs.mkdirSync(`${proj}/prev`, { recursive: true });
for (const t of times) {
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  const t0 = Date.now(); VideoClock.setTime(t); VideoClock.draw(ctx, W, H, tl);
  fs.writeFileSync(`${proj}/prev/f_${String(t).replace('.', '_')}.png`, c.toBuffer('image/png'));
  console.log(t, Date.now() - t0, 'ms');
}
