import {
  mulberry32,
  clamp01,
  lerp,
  easeOutCubic,
  easeInOutQuad,
  drawOrbitalTrail,
  drawCaptionBar
} from '../../lib/widgets.mjs';

let currentTime = 0;

function buildCircularTrail(radius, maxAngle, steps = 40) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * maxAngle;
    pts.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
  }
  return pts;
}

function buildEllipticalTrail(rPerigee, eccentricity, maxAngle, steps = 45) {
  const pts = [];
  const p = rPerigee * (1 + eccentricity);
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * maxAngle;
    const r = p / (1 + eccentricity * Math.cos(theta));
    const a = -Math.PI / 2 + theta;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
}

function buildEscapeTrail(rPerigee, progress01, steps = 40) {
  const pts = [];
  const maxTheta = progress01 * 1.95;
  const e = 1.08;
  const p = rPerigee * (1 + e);
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * maxTheta;
    const denom = Math.max(0.28, 1 + e * Math.cos(theta));
    const r = p / denom;
    const a = -Math.PI / 2 + theta;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
}

export const VideoClock = {
  setTime(seconds) {
    currentTime = seconds;
  },

  draw(ctx, width, height, timeline) {
    const t = currentTime;
    const s = width / 1080;

    // 1. Deep space gradient
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#030712');
    bg.addColorStop(0.6, '#0b1528');
    bg.addColorStop(1, '#080c18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // 2. Deterministic seeded starfield (mulberry32)
    const rng = mulberry32(9010);
    for (let i = 0; i < 65; i++) {
      const sx = rng() * width;
      const sy = rng() * height * 0.82;
      const sr = (1.0 + rng() * 2.2) * s;
      const twinkle = 0.45 + 0.55 * Math.sin(t * (2 + rng() * 3) + i);
      ctx.fillStyle = `rgba(226, 232, 240, ${twinkle.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Determine active orbital phase & camera zoom-out tracking
    const rOrbit = 215 * s;
    let trailPoints = [];
    let speedText = '7.9 km/s';
    let formulaText = 'v = √(GM/R) ≈ 7.9 km/s';
    let regimeLabel = 'CIRCULAR ORBIT (e = 0.00)';
    let trailColor = '#38bdf8';
    let headColor = '#facc15';

    let camZoom = 1.0;
    if (t < 3.4) {
      const p = clamp01(t / 3.2);
      trailPoints = buildCircularTrail(rOrbit, p * Math.PI * 2);
    } else if (t < 6.7) {
      const p = clamp01((t - 3.4) / 3.1);
      camZoom = lerp(1.0, 0.78, easeInOutQuad(clamp01((t - 3.4) / 1.4)));
      trailPoints = buildEllipticalTrail(rOrbit, 0.42, p * Math.PI * 2);
      speedText = '10.5 km/s';
      formulaText = '7.9 < v < 11.2 km/s (ELLIPTICAL)';
      regimeLabel = 'ELLIPTICAL TRANSFER (e = 0.42)';
      trailColor = '#a855f7';
    } else {
      const p = clamp01((t - 6.7) / 3.0);
      camZoom = lerp(0.78, 0.58, easeInOutQuad(clamp01((t - 6.7) / 1.8)));
      trailPoints = buildEscapeTrail(rOrbit, p);
      speedText = '11.2 km/s';
      formulaText = 'v = √(2GM/R) ≈ 11.2 km/s';
      regimeLabel = 'ESCAPE VELOCITY (e ≥ 1.00)';
      trailColor = '#fb7185';
      headColor = '#fde047';
    }

    const head = trailPoints[trailPoints.length - 1] || { x: 0, y: -rOrbit };
    const earthCx = 480 * s;
    const earthCy = 740 * s;

    // 4. Camera rig with smooth zoom-out & mild tracking of projectile
    ctx.save();
    ctx.translate(earthCx, earthCy);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-head.x * 0.15, -head.y * 0.15);

    // Reference dashed circular orbit ring
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 2 * s;
    ctx.setLineDash([8 * s, 8 * s]);
    ctx.beginPath();
    ctx.arc(0, 0, rOrbit, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Flat-vector Earth with atmosphere glow
    const atmo = ctx.createRadialGradient(0, 0, 120 * s, 0, 0, 190 * s);
    atmo.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    atmo.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = atmo;
    ctx.beginPath();
    ctx.arc(0, 0, 190 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(0, 0, 145 * s, 0, Math.PI * 2);
    ctx.fill();

    // Stylised continents
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(-45 * s, -30 * s, 46 * s, 0, Math.PI * 2);
    ctx.arc(40 * s, 25 * s, 52 * s, 0, Math.PI * 2);
    ctx.arc(-20 * s, 60 * s, 32 * s, 0, Math.PI * 2);
    ctx.fill();

    // Newton's Mountain at north pole of Earth
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(-42 * s, -138 * s);
    ctx.lineTo(0, -210 * s);
    ctx.lineTo(42 * s, -138 * s);
    ctx.closePath();
    ctx.fill();

    // Snow cap
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-16 * s, -182 * s);
    ctx.lineTo(0, -210 * s);
    ctx.lineTo(16 * s, -182 * s);
    ctx.closePath();
    ctx.fill();

    // Cute stylized cannon at mountain summit
    const recoil = Math.exp(-((t % 3.4) * 5)) * 8 * s;
    ctx.save();
    ctx.translate(0 - recoil, -212 * s);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, -8 * s, 34 * s, 14 * s);
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(0, 4 * s, 11 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw Orbital Trail
    drawOrbitalTrail(ctx, {
      cx: 0,
      cy: 0,
      points: trailPoints,
      headColor,
      trailColor
    });

    ctx.restore();

    // 5. Crisp Glowing Formula & Velocity Telemetry Card inside 9:16 safe zone
    const cardX = 72 * s;
    const cardY = 190 * s;
    const cardW = 816 * s;
    const cardH = 195 * s;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.strokeStyle = trailColor;
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 20 * s);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = `bold ${Math.round(24 * s)}px "Noto Sans", "DejaVu Sans", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(regimeLabel, cardX + 28 * s, cardY + 46 * s);

    ctx.fillStyle = '#facc15';
    ctx.font = `bold ${Math.round(44 * s)}px "Noto Sans", "DejaVu Sans", sans-serif`;
    ctx.fillText(formulaText, cardX + 28 * s, cardY + 108 * s);

    ctx.fillStyle = '#38bdf8';
    ctx.font = `bold ${Math.round(28 * s)}px "Noto Sans", "DejaVu Sans", sans-serif`;
    ctx.fillText(`LAUNCH SPEED: ${speedText}  ·  CAMERA ZOOM: ${camZoom.toFixed(2)}x`, cardX + 28 * s, cardY + 162 * s);
    ctx.restore();

    // 6. Safe-zone Caption Bar
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
