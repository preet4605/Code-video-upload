import {
  mulberry32,
  clamp01,
  lerp,
  easeOutCubic,
  drawXrayLens,
  drawGauge,
  drawStampSlam,
  drawPolaroidFrame,
  drawCaptionBar
} from '../../lib/widgets.mjs';

let currentTime = 0;

function drawCreatureOuter(ctx, cx, cy, s, t) {
  const pulse = 1 + Math.sin(t * 3.2) * 0.03;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s * pulse, s * pulse);

  // Dark silhouette specimen torso & head
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(-110, -40, 220, 240, 48);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, -105, 82, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Glowing eerie eyes
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(-28, -112, 9, 0, Math.PI * 2);
  ctx.arc(28, -112, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawCreatureSkeleton(ctx, cx, cy, s, t) {
  const beat = 1 + Math.sin(t * 7.5) * 0.08;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);

  // X-ray interior background glow
  ctx.fillStyle = '#042f2e';
  ctx.beginPath();
  ctx.roundRect(-120, -195, 240, 400, 36);
  ctx.fill();

  // Glowing cyan skull & spine/ribs
  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, -105, 64, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -40);
  ctx.lineTo(0, 160);
  ctx.stroke();

  for (let i = 0; i < 4; i++) {
    const ry = -10 + i * 36;
    ctx.beginPath();
    ctx.ellipse(0, ry, 72 - i * 6, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Pulsing anomalous glowing organ
  ctx.save();
  ctx.translate(22, 34);
  ctx.scale(beat, beat);
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

export const VideoClock = {
  setTime(seconds) {
    currentTime = seconds;
  },

  draw(ctx, width, height, timeline) {
    const t = currentTime;
    const s = width / 1080;

    // 1. Deep crimson-slate horror background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#090d16');
    bg.addColorStop(0.5, '#130b14');
    bg.addColorStop(1, '#07090e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // 2. Dark laboratory grid with subtle camera drift
    const driftX = Math.sin(t * 1.4) * 10 * s;
    const driftY = Math.cos(t * 1.1) * 10 * s;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.11)';
    ctx.lineWidth = Math.max(1, 1.5 * s);
    const step = 80 * s;
    for (let x = (driftX % step) - step; x <= width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = (driftY % step) - step; y <= height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 3. Header classify banner inside safe zone
    ctx.fillStyle = '#ef4444';
    ctx.font = `bold ${Math.round(28 * s)}px "Noto Sans", "DejaVu Sans", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('CASE FILE #78123 · BIO-ANOMALY', 72 * s, 310 * s);

    // 4. Specimen + X-Ray Lens scanning across torso
    const specX = 470 * s;
    const specY = 670 * s;
    const scanPhase = clamp01((t - 2.2) / 4.5);
    const lensX = specX + Math.sin(t * 2.1) * 75 * s;
    const lensY = specY - 40 * s + Math.cos(t * 1.7) * 85 * s;
    const lensR = lerp(85, 145, easeOutCubic(scanPhase)) * s;

    drawXrayLens(ctx, {
      cx: lensX,
      cy: lensY,
      r: lensR,
      drawOuter: (c) => drawCreatureOuter(c, specX, specY, s, t),
      drawInner: (c) => drawCreatureSkeleton(c, specX, specY, s, t)
    });

    // 5. Tier 3 Polaroid frame with mandatory CC BY 4.0 top-left attribution
    const polEnter = easeOutCubic(clamp01((t - 0.4) / 1.2));
    ctx.save();
    ctx.globalAlpha = polEnter;
    ctx.translate(250 * s, 1065 * s);
    ctx.scale(s, s);
    drawPolaroidFrame(ctx, {
      x: 0,
      y: 0,
      w: 360,
      h: 340,
      angleRad: -0.05,
      label: 'SECTOR 4 · 03:00 AM',
      attribution: 'PHOTO: Demo Archive · CC BY 4.0 · WIKIMEDIA COMMONS'
    });
    ctx.restore();

    // 6. Horror / Bio-Radiation Gauge
    const dreadLevel = clamp01(0.32 + (t / 10.0) * 0.62);
    ctx.save();
    ctx.translate(690 * s, 1110 * s);
    ctx.scale(s, s);
    drawGauge(ctx, {
      x: 0,
      y: 0,
      r: 120,
      value01: dreadLevel,
      label: 'DREAD',
      unit: '%'
    });
    ctx.restore();

    // 7. Seeded film grain + dark vignette
    const frameSeed = Math.floor(t * 30) + 78123;
    const rng = mulberry32(frameSeed);
    ctx.fillStyle = 'rgba(248, 250, 252, 0.08)';
    for (let i = 0; i < 45; i++) {
      const gx = rng() * width;
      const gy = rng() * height;
      const gw = (1 + rng() * 2.5) * s;
      ctx.fillRect(gx, gy, gw, gw);
    }

    const vig = ctx.createRadialGradient(
      width * 0.48,
      height * 0.5,
      width * 0.22,
      width * 0.5,
      height * 0.5,
      height * 0.65
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.68)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);

    // 8. Scene 3 Stamp Slam (BANNED) rendered ABOVE drawXrayLens and vignette
    if (t >= 6.8) {
      const slamP = clamp01((t - 6.8) / 0.55);
      ctx.save();
      ctx.translate(480 * s, 650 * s);
      ctx.scale(1.25 * s, 1.25 * s);
      drawStampSlam(ctx, {
        x: 0,
        y: 0,
        text: 'BANNED',
        color: '#ef4444',
        angleRad: -0.15,
        progress01: slamP
      });
      ctx.restore();
    }

    // 9. Devanagari / Hinglish Caption Bar inside 9:16 safe zone
    const cap = (timeline.captions || []).find((c) => t >= c.start_s && t <= c.end_s);
    if (cap) {
      drawCaptionBar(ctx, {
        width,
        height,
        text: cap.text,
        highlightWord: cap.highlight || '',
        fontFamily: '"Noto Sans Devanagari", "Noto Sans", "DejaVu Sans", sans-serif'
      });
    }
  }
};
