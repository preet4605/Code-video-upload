// Render a rider at 8 crank angles on a flat background and eyeball it before any full render.
// usage: node cycle_check.mjs <scene.mjs exporting cyclistSide(ctx,x,y,k,ph,t,opts)> -> cycle_check.png
// Rules it verifies: bike facing +x => crank turns CLOCKWISE in y-up space (angle = -ph); knees point FORWARD (+x) toward the bars.
import fs from 'node:fs'; const SK = process.env.SKILL_DIR || '/mnt/project-files/skills/code-video-studio-v6.2/';
const { loadCanvas } = await import(SK + 'lib/runtime.mjs'); const { createCanvas } = await loadCanvas();
const { cyclistSide } = await import(process.argv[2]); const N = 8, cw = 420, ch = 520;
const c = createCanvas(cw * 4, ch * 2), ctx = c.getContext('2d'); ctx.fillStyle = '#9fb4bd'; ctx.fillRect(0, 0, c.width, c.height);
for (let i = 0; i < N; i++) { ctx.save(); ctx.translate((i % 4) * cw, Math.floor(i / 4) * ch); ctx.beginPath(); ctx.rect(0, 0, cw, ch); ctx.clip(); cyclistSide(ctx, 190, 470, 280, i * Math.PI * 2 / N, 0, { lamp: 0 }); ctx.restore(); }
fs.writeFileSync('cycle_check.png', c.toBuffer('image/png')); console.log('wrote cycle_check.png');
