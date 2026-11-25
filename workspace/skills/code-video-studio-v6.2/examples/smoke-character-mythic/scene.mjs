import {
  mulberry32,
  clamp01,
  lerp,
  easeOutCubic,
  drawModularCharacter,
  drawMythicCutout,
  drawCaptionBar
} from '../../lib/widgets.mjs';

let currentTime = 0;

function drawSeededTreeGrove(ctx, width, height, s, t) {
  const rng = mulberry32(59071);
  const baseY = 1120 * s;

  // Rolling meadow hill inside safe visual band
  ctx.fillStyle = '#064e3b';
  ctx.beginPath();
  ctx.ellipse(480 * s, baseY + 60 * s, 420 * s, 90 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 9; i++) {
    const tx = (110 + i * 92 + (rng() - 0.5) * 24) * s;
    const ty = baseY - (rng() * 35) * s;
    const treeScale = (0.75 + rng() * 0.45) * s;
    const sway = Math.sin(t * 2.2 + i * 0.9) * 6 * s;

    ctx.save();
    ctx.translate(tx, ty);
    // Trunk
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-7 * treeScale, -50 * treeScale, 14 * treeScale, 55 * treeScale);
    // Canopy
    ctx.fillStyle = i % 2 === 0 ? '#10b981' : '#059669';
    ctx.beginPath();
    ctx.arc(sway, -68 * treeScale, 36 * treeScale, 0, Math.PI * 2);
    ctx.arc(sway - 20 * treeScale, -52 * treeScale, 26 * treeScale, 0, Math.PI * 2);
    ctx.arc(sway + 20 * treeScale, -52 * treeScale, 26 * treeScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export const VideoClock = {
  setTime(seconds) {
    currentTime = seconds;
  },

  draw(ctx, width, height, timeline) {
    const t = currentTime;
    const s = width / 1080;

    // 1. Background transitions from warm indigo explainer to golden-amber mythic sanctum
    const isMythic = t >= 6.7;
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    if (!isMythic) {
      bg.addColorStop(0, '#0f172a');
      bg.addColorStop(0.6, '#1e1b4b');
      bg.addColorStop(1, '#064e3b');
    } else {
      bg.addColorStop(0, '#1c1917');
      bg.addColorStop(0.5, '#451a03');
      bg.addColorStop(1, '#1c1917');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    if (!isMythic) {
      // 2. Scenes 1–2: Procedural seeded tree grove + animated 8,000,000,000 counter + Tier 1 Modular Character ("YOU")
      drawSeededTreeGrove(ctx, width, height, s, t);

      // Animated Population Counter Card (climbs to 8,000,000,000)
      const countProgress = easeOutCubic(clamp01(t / 5.5));
      const popVal = Math.round(lerp(1, 8000000000, countProgress));
      const formattedPop = popVal.toLocaleString('en-US');

      const cardX = 80 * s;
      const cardY = 200 * s;
      const cardW = 800 * s;
      const cardH = 175 * s;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 22 * s);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = `bold ${Math.round(24 * s)}px "Noto Sans", "DejaVu Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('HUMAN POPULATION COUNTER (TIER 1 EXPLAINER)', cardX + cardW / 2, cardY + 46 * s);

      ctx.fillStyle = '#facc15';
      ctx.font = `bold ${Math.round(64 * s)}px "Noto Sans", "DejaVu Sans", sans-serif`;
      ctx.fillText(formattedPop, cardX + cardW / 2, cardY + 132 * s);
      ctx.restore();

      // Swappable hat & prop across Scene 1 -> Scene 2
      const inScene2 = t >= 3.4;
      const blink = Math.abs((t % 2.2) - 1.1) < 0.11;
      const mouthOpen = 0.25 + 0.55 * Math.abs(Math.sin(t * 8.5));
      const bobY = Math.sin(t * 3.8) * 10 * s;

      const charX = 480 * s;
      const charY = 740 * s + bobY;

      // "YOU" floating pointer badge above character
      ctx.save();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.roundRect(charX - 75 * s, charY - 225 * s, 150 * s, 52 * s, 14 * s);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold ${Math.round(30 * s)}px "Noto Sans", "DejaVu Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('YOU', charX, charY - 188 * s);
      ctx.restore();

      drawModularCharacter(ctx, {
        x: charX,
        y: charY,
        scale: 1.65 * s,
        skinTone: '#f1c27d',
        outfitColor: inScene2 ? '#10b981' : '#2563eb',
        hairStyle: 'short',
        hat: inScene2 ? 'crown' : 'fedora',
        prop: inScene2 ? 'flute' : 'flask',
        expression: inScene2 ? 'happy' : 'neutral',
        blink,
        mouthOpen
      });
    } else {
      // 3. Scene 3: Tier 2 Mythic Cutout with golden divine aura rays, parallax embers, and respectful framing
      const localT = t - 6.7;
      const enterScale = lerp(0.85, 1.0, easeOutCubic(clamp01(localT / 0.9)));

      ctx.save();
      ctx.fillStyle = '#fef08a';
      ctx.font = `bold ${Math.round(28 * s)}px "Noto Sans", "DejaVu Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('TIER 2 · SACRED MYTHIC CUTOUT & AURA', 480 * s, 235 * s);
      ctx.restore();

      drawMythicCutout(ctx, {
        x: 480 * s,
        y: 710 * s,
        scale: 1.75 * s * enterScale,
        t: localT,
        auraColor: '#f59e0b',
        rays: 16,
        title: 'SHAKTI',
        subtitle: 'DIVINE AURA · QA VERIFIED'
      });
    }

    // 4. Safe-zone Caption Bar
    const cap = (timeline.captions || []).find((c) => t >= c.start_s && t <= c.end_s);
    if (cap) {
      drawCaptionBar(ctx, {
        width,
        height,
        text: cap.text,
        highlightWord: cap.highlight || ''
      });
    }
  }
};
