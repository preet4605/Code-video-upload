import { getSafeProfile, DEFAULT_SAFE_PROFILE } from './profiles.mjs';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeOutCubic(t) {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

export function easeOutBack(t) {
  const x = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function easeInOutQuad(t) {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export const ICONOGRAPHY_QA_CHECKLIST = [
  'Verify traditional attributes, mudras, tilak, crown, and weapons match cultural iconography.',
  'Confirm respectful proportions and dignified framing inside 9:16 safe zones (x: 60..900, y: 270..1440; see lib/profiles.mjs).',
  'Inspect alpha cutouts for clean edges without white halos or severed-limb seams.',
  'Confirm zero extra limbs, distorted faces, or unintended caricature artifacts.'
];

export function drawModularCharacter(ctx, opts = {}) {
  const {
    x = 0,
    y = 0,
    scale = 1,
    skinTone = '#f1c27d',
    outfitColor = '#2563eb',
    hairStyle = 'short',
    hat = 'none',
    prop = 'none',
    expression = 'neutral',
    blink = false,
    mouthOpen = 0
  } = opts;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Torso / outfit
  ctx.fillStyle = outfitColor;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(-48, 42, 96, 90, 24);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.fillStyle = skinTone;
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hair
  ctx.fillStyle = '#1e293b';
  if (hairStyle === 'short') {
    ctx.beginPath();
    ctx.arc(0, -10, 52, Math.PI, 0);
    ctx.fill();
  } else if (hairStyle === 'long') {
    ctx.beginPath();
    ctx.arc(0, -8, 55, Math.PI * 0.85, Math.PI * 0.15);
    ctx.fill();
  }

  // Hat / Crown / Turban
  if (hat === 'fedora') {
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(0, -42, 68, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-34, -76, 68, 34);
  } else if (hat === 'crown') {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(-36, -40);
    ctx.lineTo(-42, -74);
    ctx.lineTo(-16, -54);
    ctx.lineTo(0, -82);
    ctx.lineTo(16, -54);
    ctx.lineTo(42, -74);
    ctx.lineTo(36, -40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (hat === 'turban') {
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.ellipse(0, -40, 54, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Eyes & eyebrows
  ctx.fillStyle = '#0f172a';
  for (const dx of [-18, 18]) {
    ctx.beginPath();
    if (blink) {
      ctx.rect(dx - 8, -8, 16, 3);
    } else {
      const r = expression === 'shocked' ? 8 : 6;
      ctx.arc(dx, -8, r, 0, Math.PI * 2);
    }
    ctx.fill();

    if (expression === 'angry') {
      ctx.beginPath();
      ctx.moveTo(dx - 10, dx < 0 ? -24 : -18);
      ctx.lineTo(dx + 10, dx < 0 ? -18 : -24);
      ctx.stroke();
    }
  }

  // Mouth
  const mOpen = clamp01(mouthOpen);
  ctx.fillStyle = '#0f172a';
  if (mOpen > 0.08 || expression === 'shocked') {
    const mh = expression === 'shocked' ? 14 : 4 + mOpen * 14;
    ctx.beginPath();
    ctx.ellipse(0, 20, 14, mh, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (expression === 'happy') {
    ctx.beginPath();
    ctx.arc(0, 14, 16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-14, 20);
    ctx.lineTo(14, 20);
    ctx.stroke();
  }

  // Handheld prop
  if (prop === 'flask') {
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(54, 52);
    ctx.lineTo(66, 86);
    ctx.lineTo(42, 86);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (prop === 'flute') {
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-64, 34);
    ctx.lineTo(54, 18);
    ctx.stroke();
  } else if (prop === 'gada') {
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(64, 22, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(60, 38, 8, 58);
  }

  ctx.restore();
}

export function drawMythicCutout(ctx, opts = {}) {
  const {
    x = 0,
    y = 0,
    scale = 1,
    t = 0,
    image = null,
    auraColor = '#f59e0b',
    rays = 12,
    title = '',
    subtitle = ''
  } = opts;

  const floatY = Math.sin(t * 2.0) * 10 * scale;
  ctx.save();
  ctx.translate(x, y + floatY);
  ctx.scale(scale, scale);

  // Radial divine halo
  const halo = ctx.createRadialGradient(0, 0, 20, 0, 0, 210);
  halo.addColorStop(0, auraColor);
  halo.addColorStop(0.55, 'rgba(245, 158, 11, 0.25)');
  halo.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 210, 0, Math.PI * 2);
  ctx.fill();

  // Rotating divine light rays
  ctx.save();
  ctx.rotate(t * 0.25);
  ctx.fillStyle = 'rgba(253, 224, 71, 0.22)';
  for (let i = 0; i < rays; i++) {
    ctx.rotate((Math.PI * 2) / rays);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-14, -195);
    ctx.lineTo(14, -195);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Illustrated cutout image or sacred emblem fallback
  if (image) {
    ctx.drawImage(image, -120, -150, 240, 300);
  } else {
    ctx.fillStyle = '#7c2d12';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 86, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 34px "Noto Sans", "DejaVu Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title || 'MYTHIC', 0, 10);
  }

  // Parallax embers (seeded deterministic)
  const rng = mulberry32(4049);
  ctx.fillStyle = '#fde047';
  for (let i = 0; i < 14; i++) {
    const ex = (rng() - 0.5) * 320;
    const baseEy = (rng() - 0.5) * 320;
    const ey = ((baseEy - t * (40 + rng() * 50)) % 320 + 320) % 320 - 160;
    ctx.globalAlpha = 0.4 + 0.5 * rng();
    ctx.beginPath();
    ctx.arc(ex, ey, 2.5 + rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (subtitle) {
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 24px "Noto Sans", "DejaVu Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(subtitle, 0, 148);
  }

  ctx.restore();
}

export function drawPolaroidFrame(ctx, opts = {}) {
  const {
    x = 0,
    y = 0,
    w = 340,
    h = 380,
    angleRad = -0.05,
    image = null,
    label = '',
    attribution = ''
  } = opts;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);

  // Drop shadow + Polaroid card
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(-w / 2 + 10, -h / 2 + 14, w, h);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-w / 2, -h / 2, w, h);

  const pad = 18;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2 - 54;
  const maxAllowedWidth = Math.max(20, innerW - 24);

  if (image) {
    ctx.drawImage(image, -w / 2 + pad, -h / 2 + pad, innerW, innerH);
  } else {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-w / 2 + pad, -h / 2 + pad, innerW, innerH);
  }

  let attrFontSize = Math.max(10, Math.round(w * 0.038));
  let attrLines = [];
  let attrMaxWidth = 0;

  if (attribution) {
    const fontSpec = (sz) => `bold ${sz}px "Noto Sans", "DejaVu Sans", sans-serif`;
    ctx.font = fontSpec(attrFontSize);
    let singleW = ctx.measureText(attribution).width;

    while (singleW > maxAllowedWidth && attrFontSize > 10) {
      attrFontSize -= 1;
      ctx.font = fontSpec(attrFontSize);
      singleW = ctx.measureText(attribution).width;
    }

    if (singleW <= maxAllowedWidth) {
      attrLines = [attribution];
      attrMaxWidth = singleW;
    } else {
      // Wrap onto up to 2 balanced lines using ctx.measureText()
      const words = attribution.trim().split(/\s+/).filter(Boolean);
      if (words.length <= 1) {
        const mid = Math.ceil(attribution.length / 2);
        attrLines = [attribution.slice(0, mid), attribution.slice(mid)].filter(Boolean);
      } else {
        let bestSplit = 1;
        let bestMax = Infinity;
        for (let i = 1; i < words.length; i++) {
          const l1 = words.slice(0, i).join(' ');
          const l2 = words.slice(i).join(' ');
          const m = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width);
          if (m < bestMax) {
            bestMax = m;
            bestSplit = i;
          }
        }
        attrLines = [words.slice(0, bestSplit).join(' '), words.slice(bestSplit).join(' ')];
      }

      attrMaxWidth = Math.max(...attrLines.map((l) => ctx.measureText(l).width));
      while (attrMaxWidth > maxAllowedWidth && attrFontSize > 6) {
        attrFontSize -= 1;
        ctx.font = fontSpec(attrFontSize);
        attrMaxWidth = Math.max(...attrLines.map((l) => ctx.measureText(l).width));
      }
    }

    const lineH = Math.round(attrFontSize * 1.32);
    const pillX = -w / 2 + pad + 6;
    const pillY = -h / 2 + pad + 6;
    const pillW = Math.min(innerW - 12, Math.ceil(attrMaxWidth + 12));
    const pillH = attrLines.length * lineH + 10;

    ctx.save();
    ctx.beginPath();
    ctx.rect(pillX, pillY, pillW, pillH);
    ctx.clip();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(pillX, pillY, pillW, pillH);
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'left';
    attrLines.forEach((ln, idx) => {
      ctx.fillText(ln, pillX + 6, pillY + 4 + attrFontSize + idx * lineH);
    });
    ctx.restore();
  }

  if (label) {
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px "Noto Sans", "DejaVu Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, h / 2 - 22);
  }

  ctx.restore();
  return { attrFontSize, attrLines, attrMaxWidth, maxAllowedWidth };
}

export function drawXrayLens(ctx, opts = {}) {
  const { cx = 0, cy = 0, r = 140, drawOuter, drawInner } = opts;

  if (typeof drawOuter === 'function') drawOuter(ctx);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (typeof drawInner === 'function') drawInner(ctx);
  ctx.restore();

  // Glass rim & handle
  ctx.save();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  const hx = cx + r * 0.707;
  const hy = cy + r * 0.707;
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + r * 0.6, hy + r * 0.6);
  ctx.stroke();
  ctx.restore();
}

export function drawGauge(ctx, opts = {}) {
  const {
    x = 0,
    y = 0,
    r = 110,
    value01 = 0.5,
    label = 'LEVEL',
    unit = '%',
    minVal = 0,
    maxVal = 100,
    displayText = null,
    fontFamily = '"Noto Sans Devanagari", "Noto Sans", "DejaVu Sans", sans-serif'
  } = opts;
  const rawVal = Number(value01);
  const val = Number.isFinite(rawVal) ? clamp01(rawVal) : 0;
  const lo = Number.isFinite(Number(minVal)) ? Number(minVal) : 0;
  const hi = Number.isFinite(Number(maxVal)) ? Number(maxVal) : 100;

  ctx.save();
  ctx.translate(x, y);

  // Arc background
  ctx.lineWidth = 18;
  ctx.strokeStyle = '#334155';
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.stroke();

  // Active arc
  ctx.strokeStyle = val > 0.75 ? '#ef4444' : val > 0.45 ? '#f59e0b' : '#22c55e';
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, Math.PI + val * Math.PI);
  ctx.stroke();

  // Needle
  const ang = Math.PI + val * Math.PI;
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(ang) * (r - 14), Math.sin(ang) * (r - 14));
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();

  const valueStr = displayText !== null && displayText !== undefined
    ? String(displayText)
    : `${Math.round(lerp(lo, hi, val))}${unit}`;
  ctx.font = `bold 24px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.fillText(valueStr, 0, 36);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `bold 18px ${fontFamily}`;
  ctx.fillText(label, 0, 62);

  ctx.restore();
}

export function drawStampSlam(ctx, opts = {}) {
  const {
    x = 0,
    y = 0,
    text = 'CLASSIFIED',
    color = '#ef4444',
    angleRad = -0.14,
    progress01 = 1,
    fontFamily = '"Noto Sans Devanagari", "Noto Sans", "DejaVu Sans", sans-serif'
  } = opts;
  const p = clamp01(progress01);
  const scale = lerp(2.2, 1.0, easeOutBack(p));

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);
  ctx.scale(scale, scale);
  ctx.globalAlpha = clamp01(p * 6);

  ctx.font = `bold 42px ${fontFamily}`;
  const tw = ctx.measureText(text).width;
  const boxW = tw + 56;
  const boxH = 74;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);

  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, 0, 15);

  ctx.restore();
}

export function drawCaptionBar(ctx, opts = {}) {
  const {
    width = 1080,
    height = 1920,
    text = '',
    highlightWord = '',
    fontFamily = '"Noto Sans", "DejaVu Sans", sans-serif'
  } = opts;
  if (!text) return null;

  const s = width / 1080;
  const maxBoxW = Math.round(width * 0.76);
  const padX = Math.round(18 * s);
  const maxTextW = maxBoxW - 36 * s;
  const minFontSize = Math.max(10, Math.round(22 * s));
  let fontSize = Math.round(42 * s);

  ctx.save();
  ctx.font = `bold ${fontSize}px ${fontFamily}`;

  const measureLineWords = (ln) => {
    const words = ln.split(' ').filter(Boolean);
    if (words.length === 0) return 0;
    const spaceW = ctx.measureText(' ').width;
    let total = 0;
    for (let i = 0; i < words.length; i++) {
      total += ctx.measureText(words[i]).width;
      if (i < words.length - 1) total += spaceW;
    }
    return total;
  };

  // Start from explicit lines if already <= 2 and fitting; otherwise wrap words into up to 2 lines using measureText
  const rawLines = text
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter(Boolean);

  let lines;
  if (rawLines.length === 2 && rawLines.every((l) => measureLineWords(l) <= maxTextW)) {
    lines = rawLines;
  } else {
    const allWords = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const fullLine = allWords.join(' ');
    if (measureLineWords(fullLine) <= maxTextW) {
      lines = [fullLine];
    } else if (allWords.length <= 1) {
      const mid = Math.ceil(fullLine.length / 2);
      lines = [fullLine.slice(0, mid), fullLine.slice(mid)].filter(Boolean);
    } else {
      // Greedy wrap into line 1 up to maxTextW; if line 2 overflows maxTextW, pick balanced 2-line split minimizing max width
      let splitIdx = 1;
      for (let i = 1; i < allWords.length; i++) {
        const candidate = allWords.slice(0, i + 1).join(' ');
        if (measureLineWords(candidate) <= maxTextW) {
          splitIdx = i + 1;
        } else {
          break;
        }
      }
      let l1 = allWords.slice(0, splitIdx).join(' ');
      let l2 = allWords.slice(splitIdx).join(' ');
      if (l2 && measureLineWords(l2) > maxTextW) {
        let bestSplit = splitIdx;
        let bestMaxW = Math.max(measureLineWords(l1), measureLineWords(l2));
        for (let i = 1; i < allWords.length; i++) {
          const cand1 = allWords.slice(0, i).join(' ');
          const cand2 = allWords.slice(i).join(' ');
          const m = Math.max(measureLineWords(cand1), measureLineWords(cand2));
          if (m < bestMaxW) {
            bestMaxW = m;
            bestSplit = i;
          }
        }
        l1 = allWords.slice(0, bestSplit).join(' ');
        l2 = allWords.slice(bestSplit).join(' ');
      }
      lines = l2 ? [l1, l2] : [l1];
    }
  }

  // If any line still exceeds maxBoxW - 36 (scaled), scale down fontSize proportionally (down to min 22px at 1080w)
  let maxLineW = Math.max(...lines.map(measureLineWords));
  if (maxLineW > maxTextW && fontSize > minFontSize) {
    fontSize = Math.max(minFontSize, Math.floor((fontSize * maxTextW) / maxLineW));
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    maxLineW = Math.max(...lines.map(measureLineWords));
    while (maxLineW > maxTextW && fontSize > minFontSize) {
      fontSize -= 1;
      ctx.font = `bold ${fontSize}px ${fontFamily}`;
      maxLineW = Math.max(...lines.map(measureLineWords));
    }
  }

  // Center inside 9:16 safe zone x: 60..900 (center = 480 at 1080w)
  const safeCenterX = 480 * s;
  const boxX = Math.round(safeCenterX - maxBoxW / 2);
  const boxW = maxBoxW;
  const lineStep = Math.round(fontSize * 1.33);
  const boxH = Math.round(lines.length * lineStep + 40 * s);
  // Keep the whole bar above the platform bottom UI (see lib/profiles.mjs): never lower than SAFE maxY - boxH.
  const boxY = Math.max(Math.round(SAFE_ZONE_916.minY * s), Math.min(Math.round(height * 0.68), Math.round(SAFE_ZONE_916.maxY * s - boxH - 12 * s)));

  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 18 * s);
  ctx.fill();

  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'left';
  const stripTrailingPunct = (str) => String(str || '').trim().replace(/[.,?!;:'"()]+$/g, '').toLowerCase();
  const cleanHighlight = stripTrailingPunct(highlightWord);

  lines.forEach((ln, idx) => {
    let curX = boxX + padX;
    const baseY = boxY + Math.round(24 * s) + fontSize + idx * lineStep;
    const words = ln.split(' ').filter(Boolean);
    const spaceW = ctx.measureText(' ').width;
    for (const w of words) {
      const wWidth = ctx.measureText(w).width;
      const isHighlight = Boolean(cleanHighlight) && stripTrailingPunct(w) === cleanHighlight;
      if (isHighlight) {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.roundRect(curX - 6 * s, baseY - fontSize * 0.85, wWidth + 12 * s, fontSize * 1.1, 8 * s);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
      } else {
        ctx.fillStyle = '#f8fafc';
      }
      ctx.fillText(w, curX, baseY);
      curX += wWidth + spaceW;
    }
  });

  ctx.restore();
  return { boxX, boxY, boxW, boxH, fontSize, lines, maxLineWidth: maxLineW, maxTextWidth: maxTextW };
}

export function drawOrbitalTrail(ctx, opts = {}) {
  const { cx = 0, cy = 0, points = [], headColor = '#facc15', trailColor = '#38bdf8' } = opts;
  if (points.length === 0) return;

  ctx.save();
  ctx.translate(cx, cy);

  for (let i = 1; i < points.length; i++) {
    const alpha = i / points.length;
    ctx.strokeStyle = trailColor;
    ctx.globalAlpha = alpha * 0.9;
    ctx.lineWidth = 2 + alpha * 4;
    ctx.beginPath();
    ctx.moveTo(points[i - 1].x, points[i - 1].y);
    ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }

  const head = points[points.length - 1];
  ctx.globalAlpha = 1;
  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.arc(head.x, head.y, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export const EDITORIAL_THEMES = {
  horror: {
    bg: '#090d16',
    surface: '#111827',
    accent: '#ef4444',
    secondary: '#facc15',
    text: '#f8fafc',
    muted: '#94a3b8'
  },
  'science-doc': {
    bg: '#0b1220',
    surface: '#1e293b',
    accent: '#38bdf8',
    secondary: '#f43f5e',
    text: '#f8fafc',
    muted: '#94a3b8'
  },
  'editorial-light': {
    bg: '#f8fafc',
    surface: '#ffffff',
    accent: '#0f766e',
    secondary: '#2563eb',
    text: '#0f172a',
    muted: '#475569'
  },
  'vintage-warm': {
    bg: '#1c1917',
    surface: '#292524',
    accent: '#f59e0b',
    secondary: '#ea580c',
    text: '#fef3c7',
    muted: '#a8a29e'
  }
};

export function resolveUiFont(text, fontFamily = null) {
  if (fontFamily) return fontFamily;
  if (/[\u0900-\u097F]/.test(String(text || ''))) {
    return '"Noto Sans Devanagari", "Noto Sans", "DejaVu Sans", sans-serif';
  }
  return '"Noto Sans", "DejaVu Sans", sans-serif';
}

export function drawProvenanceHeader(ctx, opts = {}) {
  const {
    width = 1080,
    height = 1920,
    text = 'ARTISTIC DEPICTION',
    dotColor = '#ef4444',
    x = null,
    y = null,
    maxWidth = null,
    fontFamily = null
  } = opts;

  const s = width / 1080;
  const rx = x !== null ? x : Math.round(64 * s);
  const ry = y !== null ? y : Math.round((SAFE_ZONE_916.minY + 18) * s);
  const rMaxWidth = maxWidth !== null ? maxWidth : Math.round(width * 0.72);
  const dotRadius = Math.max(4, 6 * s);
  const dotPadLeft = Math.round(16 * s);
  const dotTextGap = Math.round(12 * s);
  const padRight = Math.round(18 * s);
  const chromeWidth = dotPadLeft + dotRadius * 2 + dotTextGap + padRight;
  const availTextWidth = Math.max(40, rMaxWidth - chromeWidth);
  const resolvedFont = resolveUiFont(text, fontFamily);

  let fontSize = Math.max(12, Math.round(22 * s));
  ctx.save();
  ctx.font = `bold ${fontSize}px ${resolvedFont}`;
  let textWidth = ctx.measureText(text).width;

  while (textWidth > availTextWidth && fontSize > 10) {
    fontSize -= 1;
    ctx.font = `bold ${fontSize}px ${resolvedFont}`;
    textWidth = ctx.measureText(text).width;
  }

  // If still wider at minimum fontSize, truncate cleanly with ellipsis
  let displayText = text;
  if (textWidth > availTextWidth) {
    while (displayText.length > 3 && ctx.measureText(displayText + '...').width > availTextWidth) {
      displayText = displayText.slice(0, -1);
    }
    displayText += '...';
    textWidth = ctx.measureText(displayText).width;
  }

  const pillW = Math.min(rMaxWidth, Math.ceil(textWidth + chromeWidth));
  const pillH = Math.round(fontSize * 1.9 + 6 * s);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  ctx.beginPath();
  ctx.roundRect(rx, ry, pillW, pillH, pillH / 2);
  ctx.fill();

  ctx.fillStyle = dotColor;
  ctx.beginPath();
  ctx.arc(rx + dotPadLeft + dotRadius, ry + pillH / 2, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayText, rx + dotPadLeft + dotRadius * 2 + dotTextGap, ry + pillH / 2 + 1);
  ctx.restore();

  return { x: rx, y: ry, pillW, pillH, fontSize, textWidth, maxWidth: rMaxWidth };
}

export function drawHudBadge(ctx, opts = {}) {
  const {
    x = 0,
    y = 0,
    text = 'ALERT',
    bgColor = '#ef4444',
    textColor = '#ffffff',
    borderColor = null,
    progress01 = 1,
    fontSize = 30,
    radius = 14,
    fontFamily = null
  } = opts;

  const p = clamp01(progress01);
  const scale = easeOutBack(p);
  const alpha = clamp01(p * 1.5);
  const resolvedFont = resolveUiFont(text, fontFamily);

  ctx.save();
  ctx.font = `bold ${fontSize}px ${resolvedFont}`;
  const tw = ctx.measureText(text).width;
  const padX = Math.round(fontSize * 0.9);
  const padY = Math.round(fontSize * 0.45);
  const boxW = Math.ceil(tw + padX * 2);
  const boxH = Math.ceil(fontSize * 1.25 + padY * 2);

  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, radius);
  ctx.fill();

  if (borderColor) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 1);
  ctx.restore();

  return { boxW, boxH, scale };
}

export function drawChecklistCard(ctx, opts = {}) {
  const {
    x = 0,
    y = 0,
    w = 420,
    title = 'CHECKLIST',
    items = [],
    checkedCount = 0,
    progress01 = 1,
    theme = 'light'
  } = opts;

  const p = clamp01(progress01);
  const scale = easeOutBack(p);
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#1e293b' : '#f8fafc';
  const cardText = isDark ? '#f8fafc' : '#0f172a';
  const headerBg = isDark ? '#0f172a' : '#e2e8f0';
  const borderCol = isDark ? '#334155' : '#cbd5e1';

  const headerH = 54;
  const rowH = 44;
  const padY = 16;
  const h = headerH + padY * 2 + Math.max(1, items.length) * rowH;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = clamp01(p * 1.4);

  // Drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 8, -h / 2 + 12, w, h, 16);
  ctx.fill();

  // Card body
  ctx.fillStyle = cardBg;
  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 16);
  ctx.fill();
  ctx.stroke();

  // Header bar
  ctx.fillStyle = headerBg;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, headerH, [16, 16, 0, 0]);
  ctx.fill();

  ctx.fillStyle = cardText;
  ctx.font = 'bold 22px "Noto Sans", "DejaVu Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, -w / 2 + 22, -h / 2 + headerH / 2);

  // Rows
  const maxItemW = Math.max(40, w - 84);
  ctx.font = 'bold 20px "Noto Sans", "DejaVu Sans", sans-serif';
  items.forEach((rawItem, i) => {
    const ry = -h / 2 + headerH + padY + i * rowH + rowH / 2;
    const boxX = -w / 2 + 22;
    const boxSize = 24;
    const checked = i < checkedCount;

    ctx.fillStyle = checked ? '#22c55e' : 'transparent';
    ctx.strokeStyle = checked ? '#16a34a' : '#64748b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(boxX, ry - boxSize / 2, boxSize, boxSize, 6);
    ctx.fill();
    ctx.stroke();

    if (checked) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(boxX + 5, ry);
      ctx.lineTo(boxX + 10, ry + 6);
      ctx.lineTo(boxX + 19, ry - 6);
      ctx.stroke();
    }

    let label = String(rawItem);
    if (ctx.measureText(label).width > maxItemW) {
      while (label.length > 2 && ctx.measureText(label + '...').width > maxItemW) {
        label = label.slice(0, -1);
      }
      label += '...';
    }
    ctx.fillStyle = cardText;
    ctx.fillText(label, boxX + boxSize + 14, ry + 1);
  });

  ctx.restore();
  return { x, y, w, h, rowCount: items.length };
}

export function drawQuoteCard(ctx, opts = {}) {
  const {
    x = 0,
    y = 0,
    w = 520,
    quote = '',
    author = '',
    accentColor = '#f59e0b',
    bgColor = 'rgba(15, 23, 42, 0.9)',
    textColor = '#f8fafc',
    progress01 = 1,
    fontSize = 26
  } = opts;

  const p = clamp01(progress01);
  const scale = easeOutCubic(p);
  const maxTextW = Math.max(40, w - 56);

  ctx.save();
  ctx.font = `bold ${fontSize}px "Noto Sans", "DejaVu Sans", sans-serif`;

  const words = String(quote).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxTextW) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length === 0) lines.push('');

  const maxLineWidth = Math.max(...lines.map((ln) => ctx.measureText(ln).width));
  const lineH = Math.round(fontSize * 1.38);
  const authorH = author ? Math.round(fontSize * 1.4) : 0;
  const padY = 26;
  const h = padY * 2 + lines.length * lineH + authorH;

  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = clamp01(p * 1.4);

  // Card background
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 14);
  ctx.fill();

  // 8px left accent bar
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, 8, h, [14, 0, 0, 14]);
  ctx.fill();

  // Quote lines
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const startX = -w / 2 + 28;
  const startY = -h / 2 + padY;
  lines.forEach((ln, i) => {
    ctx.fillText(ln, startX, startY + i * lineH);
  });

  if (author) {
    ctx.fillStyle = accentColor;
    ctx.font = `bold ${Math.max(16, Math.round(fontSize * 0.78))}px "Noto Sans", "DejaVu Sans", sans-serif`;
    ctx.fillText(`— ${author}`, startX, startY + lines.length * lineH + 8);
  }

  ctx.restore();
  return { w, h, lines, maxLineWidth };
}

export function drawColorSwatch(ctx, opts = {}) {
  const {
    x = 0,
    y = 0,
    size = 160,
    color = '#10b981',
    label = 'EMERALD',
    sublabel = '',
    progress01 = 1
  } = opts;

  const p = clamp01(progress01);
  const scale = easeOutBack(p);
  const pad = 12;
  const footerH = sublabel ? 68 : 44;
  const w = size + pad * 2;
  const h = size + pad * 2 + footerH;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = clamp01(p * 1.4);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 6, -h / 2 + 10, w, h, 12);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 12);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-size / 2, -h / 2 + pad, size, size, 8);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "Noto Sans", "DejaVu Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, 0, -h / 2 + pad + size + 12);

  if (sublabel) {
    ctx.fillStyle = '#475569';
    ctx.font = '16px "Noto Sans", "DejaVu Sans", sans-serif';
    ctx.fillText(sublabel, 0, -h / 2 + pad + size + 38);
  }

  ctx.restore();
  return { w, h };
}

export function drawIconGridCounter(ctx, opts = {}) {
  const {
    x = 0,
    y = 0,
    cols = 10,
    rows = 5,
    activeCount = 12,
    activeColor = '#ef4444',
    inactiveColor = '#334155',
    cellSize = 26,
    gap = 10,
    label = ''
  } = opts;

  const total = cols * rows;
  const gridW = cols * cellSize + Math.max(0, cols - 1) * gap;
  const gridH = rows * cellSize + Math.max(0, rows - 1) * gap;

  ctx.save();
  ctx.translate(x, y);

  const startX = -gridW / 2;
  const startY = -gridH / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const cx = startX + c * (cellSize + gap);
      const cy = startY + r * (cellSize + gap);
      ctx.fillStyle = idx < activeCount ? activeColor : inactiveColor;
      ctx.beginPath();
      ctx.roundRect(cx, cy, cellSize, cellSize, Math.max(4, cellSize * 0.24));
      ctx.fill();
    }
  }

  if (label) {
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px "Noto Sans", "DejaVu Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, 0, gridH / 2 + 16);
  }

  ctx.restore();
  return { total, activeCount, gridW, gridH };
}

export function drawWaveformOscilloscope(ctx, opts = {}) {
  const {
    x = 0,
    y = 0,
    w = 460,
    h = 110,
    t = 0,
    amp = 0.8,
    color = '#ef4444',
    bgColor = 'rgba(15, 23, 42, 0.85)',
    label = 'AAWAZ',
    mode = 'voice'
  } = opts;

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 12);
  ctx.fill();
  ctx.stroke();

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 10, 0);
  ctx.lineTo(w / 2 - 10, 0);
  for (let gx = -w / 2 + 46; gx < w / 2 - 10; gx += 46) {
    ctx.moveTo(gx, -h / 2 + 10);
    ctx.lineTo(gx, h / 2 - 10);
  }
  ctx.stroke();

  // Deterministic waveform
  const samples = 120;
  const maxY = (h / 2 - 16) * clamp01(amp);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();

  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const px = -w / 2 + 14 + u * (w - 28);
    let sy = 0;
    if (mode === 'heartbeat') {
      const phase = ((u * 2.2 - t * 1.1) % 1 + 1) % 1;
      if (phase > 0.12 && phase < 0.20) {
        sy = Math.sin(((phase - 0.12) / 0.08) * Math.PI) * 0.22;
      } else if (phase >= 0.28 && phase < 0.32) {
        sy = -((phase - 0.28) / 0.04) * 0.25;
      } else if (phase >= 0.32 && phase < 0.37) {
        sy = Math.sin(((phase - 0.32) / 0.05) * Math.PI) * 1.0;
      } else if (phase >= 0.37 && phase < 0.42) {
        sy = -Math.sin(((phase - 0.37) / 0.05) * Math.PI) * 0.38;
      } else if (phase >= 0.50 && phase < 0.64) {
        sy = Math.sin(((phase - 0.50) / 0.14) * Math.PI) * 0.30;
      }
    } else {
      const env = Math.sin(u * Math.PI);
      sy =
        env *
        (0.55 * Math.sin(u * 26 + t * 12) +
          0.3 * Math.sin(u * 53 - t * 19) +
          0.15 * Math.cos(u * 87 + t * 7));
    }
    const py = -sy * maxY;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  if (label) {
    ctx.fillStyle = color;
    ctx.font = 'bold 14px "Noto Sans", "DejaVu Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, -w / 2 + 14, -h / 2 + 10);
  }

  ctx.restore();
  return { w, h, mode };
}

// Derived from lib/profiles.mjs (single source of truth). Default profile: "universal".
const _SZ = getSafeProfile(DEFAULT_SAFE_PROFILE);
export const SAFE_ZONE_916 = Object.freeze({
  minX: _SZ.minX,
  maxX: _SZ.maxX,
  minY: _SZ.minY,
  maxY: _SZ.maxY,
  centerX: (_SZ.minX + _SZ.maxX) / 2,
  maxWidth: _SZ.maxX - _SZ.minX
});

export function clampToSafeZone(x, y, boxW = 0, boxH = 0, scale = 1) {
  const minX = SAFE_ZONE_916.minX * scale;
  const maxX = SAFE_ZONE_916.maxX * scale;
  const minY = SAFE_ZONE_916.minY * scale;
  const maxY = SAFE_ZONE_916.maxY * scale;
  const halfW = Math.max(0, boxW) / 2;
  const halfH = Math.max(0, boxH) / 2;
  const loX = minX + halfW;
  const hiX = maxX - halfW;
  const loY = minY + halfH;
  const hiY = maxY - halfH;
  return {
    x: loX <= hiX ? Math.max(loX, Math.min(hiX, x)) : (minX + maxX) / 2,
    y: loY <= hiY ? Math.max(loY, Math.min(hiY, y)) : (minY + maxY) / 2
  };
}

export function applyAmbientCamera(ctx, width, height, progress01, t, opts = {}) {
  const { zoomEnd = 1.045, driftPx = 4 * (width / 1080) } = opts;
  const zoom = lerp(1.0, zoomEnd, clamp01(progress01));
  const dx = Math.sin(t * 0.7) * driftPx;
  const dy = Math.cos(t * 0.55) * driftPx * 0.7;
  ctx.translate(width / 2 + dx, height / 2 + dy);
  ctx.scale(zoom, zoom);
  ctx.translate(-width / 2, -height / 2);
  return { zoom, dx, dy };
}

export function drawCinematicVignette(ctx, width, height, strength = 0.62) {
  const s = clamp01(strength);
  const vg = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    width * 0.25,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.68
  );
  vg.addColorStop(0, 'rgba(2, 6, 23, 0)');
  vg.addColorStop(0.7, `rgba(2, 6, 23, ${(s * 0.34).toFixed(3)})`);
  vg.addColorStop(1, `rgba(2, 6, 23, ${s.toFixed(3)})`);
  ctx.save();
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function drawEditorialCaption(ctx, opts = {}) {
  const {
    width = 1080,
    height = 1920,
    text = '',
    highlightWord = '',
    yRatio = 0.785,
    maxFontSize = 46,
    minFontSize = 24,
    strokeWidth = 9,
    highlightColor = '#facc15',
    textColor = '#ffffff',
    fontFamily = '"Noto Sans", "DejaVu Sans", sans-serif'
  } = opts;

  const s = width / 1080;
  const centerX = SAFE_ZONE_916.centerX * s;
  const maxAllowedWidth = 780 * s;
  const y = Math.round(height * yRatio);
  const cleanText = String(text || '').replace(/\s+/g, ' ').trim().toUpperCase();
  const minScaledFont = Math.max(8, Math.round(minFontSize * s));
  let fontSize = Math.max(minScaledFont, Math.round(maxFontSize * s));

  if (!cleanText) {
    return { fontSize, totalWidth: 0, maxAllowedWidth, leftX: centerX, rightX: centerX, y };
  }

  const words = cleanText.split(' ').filter(Boolean);
  const stripTrailingPunct = (str) => String(str || '').trim().replace(/[.,?!;:'"()]+$/g, '').toLowerCase();
  const cleanHighlight = stripTrailingPunct(highlightWord);

  ctx.save();
  const measureWordsWidth = (sz) => {
    ctx.font = `900 ${sz}px ${fontFamily}`;
    const sp = ctx.measureText(' ').width;
    let total = 0;
    for (let i = 0; i < words.length; i++) {
      total += ctx.measureText(words[i]).width;
      if (i < words.length - 1) total += sp;
    }
    return total;
  };

  let totalWidth = measureWordsWidth(fontSize);
  while (totalWidth > maxAllowedWidth && fontSize > minScaledFont) {
    fontSize -= 1;
    totalWidth = measureWordsWidth(fontSize);
  }

  const fitScale = totalWidth > maxAllowedWidth ? maxAllowedWidth / totalWidth : 1;
  const renderedWidth = totalWidth * fitScale;
  const leftX = centerX - renderedWidth / 2;
  const rightX = centerX + renderedWidth / 2;
  const spaceW = ctx.measureText(' ').width;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  ctx.save();
  if (fitScale < 1) {
    ctx.translate(centerX, y);
    ctx.scale(fitScale, 1);
    ctx.translate(-centerX, -y);
  }
  let curX = centerX - totalWidth / 2;
  for (const w of words) {
    const wWidth = ctx.measureText(w).width;
    const isHighlight = Boolean(cleanHighlight) && stripTrailingPunct(w) === cleanHighlight;

    ctx.shadowColor = 'rgba(2, 6, 23, 0.9)';
    ctx.shadowBlur = 14 * s;
    ctx.shadowOffsetY = 4 * s;
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = strokeWidth * s;
    ctx.strokeText(w, curX, y);

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = isHighlight ? highlightColor : textColor;
    ctx.fillText(w, curX, y);

    curX += wWidth + spaceW;
  }
  ctx.restore();

  ctx.restore();
  return { fontSize, totalWidth: renderedWidth, maxAllowedWidth, leftX, rightX, y };
}

export function getBeatPulse(t, beatTimes = [], decay = 10) {
  if (!Array.isArray(beatTimes) || beatTimes.length === 0) {
    return { dt: Infinity, intensity: 0, beatIndex: -1 };
  }
  let beatIndex = -1;
  let latest = -Infinity;
  for (let i = 0; i < beatTimes.length; i++) {
    const bt = Number(beatTimes[i]);
    if (Number.isFinite(bt) && bt <= t && bt >= latest) {
      latest = bt;
      beatIndex = i;
    }
  }
  if (beatIndex === -1) {
    return { dt: Infinity, intensity: 0, beatIndex: -1 };
  }
  const dt = Math.max(0, t - latest);
  return { dt, intensity: Math.exp(-decay * dt), beatIndex };
}

export function applyHorrorCamera(ctx, width, height, opts = {}) {
  const {
    t = 0,
    p = 0,
    mode = 'dread_creep',
    focusX = width * 0.5,
    focusY = height * 0.45,
    zoomStart = 1.0,
    zoomEnd = 1.16,
    beatTimes = [],
    shakeAmp = 10
  } = opts;

  const pulse = getBeatPulse(t, beatTimes, 10);
  const scaleFactor = width / 1080;
  let zoom = zoomStart;
  let sx = 0;
  let sy = 0;

  if (mode === 'snap_zoom') {
    zoom = lerp(zoomStart, zoomEnd, easeOutBack(clamp01(p)));
    const amp = shakeAmp * 0.5 * scaleFactor * pulse.intensity;
    sx = pulse.beatIndex >= 0 ? Math.sin(pulse.dt * 52) * amp : 0;
    sy = pulse.beatIndex >= 0 ? Math.cos(pulse.dt * 41) * amp * 0.7 : 0;
  } else if (mode === 'impact_shake') {
    zoom = zoomStart;
    const amp = shakeAmp * scaleFactor * pulse.intensity;
    sx = pulse.beatIndex >= 0 ? Math.sin(pulse.dt * 52) * amp : 0;
    sy = pulse.beatIndex >= 0 ? Math.cos(pulse.dt * 41) * amp * 0.7 : 0;
  } else {
    zoom = lerp(zoomStart, zoomEnd, easeInOutQuad(clamp01(p)));
    const sway = 4 * scaleFactor;
    const beatPush = pulse.beatIndex >= 0 ? 0.018 * pulse.intensity : 0;
    const beatShake = pulse.beatIndex >= 0 ? shakeAmp * 0.25 * scaleFactor * pulse.intensity : 0;
    zoom += beatPush;
    sx = Math.sin(t * 0.85) * sway + (pulse.beatIndex >= 0 ? Math.sin(pulse.dt * 44) * beatShake : 0);
    sy = Math.cos(t * 0.65) * sway * 0.75 + (pulse.beatIndex >= 0 ? Math.cos(pulse.dt * 37) * beatShake * 0.7 : 0);
  }

  ctx.translate(focusX + sx, focusY + sy);
  ctx.scale(zoom, zoom);
  ctx.translate(-focusX, -focusY);
  return { zoom, sx, sy };
}

export function getWalkCycle(t, stepsPerSec = 2.2) {
  const rate = Number(stepsPerSec) || 0;
  if (rate <= 0) {
    return { phase: 0, bobY: 0, leanRad: 0, armSwing: 0, stepHit01: 0 };
  }
  const phase = ((t * rate) % 1 + 1) % 1;
  const rad = t * rate * Math.PI;
  const bobY = -Math.abs(Math.sin(rad)) * 10;
  const leanRad = Math.min(0.18, rate * 0.032) + Math.sin(rad) * 0.025;
  const armSwing = Math.sin(rad) * 0.45;
  const stepHit01 = Math.exp(-14 * Math.min(phase, 1 - phase));
  return { phase, bobY, leanRad, armSwing, stepHit01 };
}
