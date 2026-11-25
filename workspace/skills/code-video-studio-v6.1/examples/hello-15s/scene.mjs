let currentTime = 0;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function easeOutCubic(x) {
  const t = clamp(x, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

export const VideoClock = {
  setTime(seconds) {
    currentTime = seconds;
  },

  draw(ctx, width, height, timeline) {
    const t = currentTime;
    const s = width / 1080;

    // 1. Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#0b1021');
    bg.addColorStop(1, '#181336');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // 2. Animated perspective/scrolling grid
    ctx.strokeStyle = 'rgba(90, 180, 255, 0.16)';
    ctx.lineWidth = Math.max(1, 2 * s);
    const step = 90 * s;
    const offsetY = (t * 60 * s) % step;
    for (let x = 0; x <= width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = offsetY - step; y <= height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 3. Scene-specific visuals
    if (t < 5.0) {
      const p = easeOutCubic(t / 1.2);
      ctx.save();
      ctx.translate(width / 2, height * 0.36);
      ctx.scale(0.85 + 0.15 * p, 0.85 + 0.15 * p);
      ctx.globalAlpha = p;
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(78 * s)}px "DejaVu Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('CODE VIDEO', 0, -40 * s);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('STUDIO v1', 0, 55 * s);
      ctx.restore();

      const pct = Math.round(clamp(t / 4.8, 0, 1) * 100);
      ctx.fillStyle = '#facc15';
      ctx.font = `bold ${Math.round(110 * s)}px "DejaVu Sans Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${pct}%`, width / 2, height * 0.54);
    } else if (t < 10.0) {
      const localT = t - 5.0;
      const bobY = Math.sin(localT * 4.2) * 14 * s;
      const cx = width * 0.48;
      const cy = height * 0.42 + bobY;

      // Orbiting satellite
      const ang = localT * 1.8;
      const ox = cx + Math.cos(ang) * 260 * s;
      const oy = cy + Math.sin(ang) * 140 * s;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 260 * s, 140 * s, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(ox, oy, 22 * s, 0, Math.PI * 2);
      ctx.fill();

      // Procedural 2D vector character
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx, cy, 130 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 8 * s;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();

      // Eyes (blink at localT ~ 2.5s)
      const blink = Math.abs(localT - 2.6) < 0.12;
      ctx.fillStyle = '#0f172a';
      for (const dx of [-45 * s, 45 * s]) {
        ctx.beginPath();
        if (blink) {
          ctx.rect(cx + dx - 18 * s, cy - 22 * s, 36 * s, 6 * s);
        } else {
          ctx.arc(cx + dx, cy - 20 * s, 16 * s, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      // Animated mouth
      const mouthH = (12 + Math.abs(Math.sin(localT * 9.5)) * 26) * s;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 42 * s, 36 * s, mouthH, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const localT = t - 10.0;
      const p = easeOutCubic(localT / 1.0);
      const pulse = 1 + 0.04 * Math.sin(localT * 5.0);
      ctx.save();
      ctx.translate(width / 2, height * 0.42);
      ctx.scale(p * pulse, p * pulse);
      const badgeLabel = 'PHASE 1 VERIFIED';
      ctx.font = `bold ${Math.round(48 * s)}px "DejaVu Sans", sans-serif`;
      const textW = ctx.measureText(badgeLabel).width;
      const pillW = Math.max(620 * s, textW + 110 * s);
      const pillH = 170 * s;
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, 32 * s);
      ctx.fill();
      ctx.fillStyle = '#052e16';
      ctx.textAlign = 'center';
      ctx.fillText(badgeLabel, 0, 16 * s);
      ctx.restore();
    }

    // 4. Safe-zone caption box (above bottom 18% UI overlay, clear of right 12%)
    const cap = (timeline.captions || []).find((c) => t >= c.start_s && t <= c.end_s);
    if (cap) {
      const lines = cap.text.split('\n');
      const boxW = width * 0.78;
      const boxH = (lines.length * 58 + 44) * s;
      const boxX = width * 0.08;
      const boxY = height * 0.68;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 20 * s);
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.font = `bold ${Math.round(42 * s)}px "DejaVu Sans", sans-serif`;
      ctx.textAlign = 'left';
      lines.forEach((ln, idx) => {
        ctx.fillText(ln, boxX + 32 * s, boxY + (68 + idx * 56) * s);
      });
    }
  }
};
