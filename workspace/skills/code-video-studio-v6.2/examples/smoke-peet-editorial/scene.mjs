import {
  EDITORIAL_THEMES,
  clamp01,
  drawProvenanceHeader,
  drawHudBadge,
  drawChecklistCard,
  drawColorSwatch,
  drawIconGridCounter,
  drawWaveformOscilloscope,
  drawStampSlam,
  drawCaptionBar
} from '../../lib/widgets.mjs';

let currentTime = 0;

export const VideoClock = {
  setTime(seconds) {
    currentTime = seconds;
  },

  draw(ctx, width, height, timeline) {
    const t = currentTime;
    const s = width / 1080;

    const scenes = timeline.scenes || [];
    const s0 = scenes[0] || { start_s: 0, end_s: 5.5 };
    const s1 = scenes[1] || { start_s: 5.5, end_s: 11.0 };
    const s2 = scenes[2] || { start_s: 11.0, end_s: 16.8 };

    // Determine active caption and active spoken word
    const activeCap = (timeline.captions || []).find((c) => t >= c.start_s && t <= c.end_s);
    const activeWordObj = (timeline.words || []).find((w) => t >= w.start_s && t <= w.end_s);
    const highlightWord = activeWordObj ? activeWordObj.word : '';

    if (t < s0.end_s) {
      const localT = Math.max(0, t - s0.start_s);
      const theme = EDITORIAL_THEMES['editorial-light'];
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      // Virtual 1080x1920 safe-zone stage (x: 60..900, y: 270..1440)
      ctx.save();
      ctx.scale(s, s);

      // Subtle animated dot grid
      ctx.fillStyle = 'rgba(15, 118, 110, 0.14)';
      const offset = (localT * 36) % 72;
      for (let gx = 80; gx <= 920; gx += 72) {
        for (let gy = 180 + offset; gy <= 1480; gy += 72) {
          ctx.beginPath();
          ctx.arc(gx, gy, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      drawHudBadge(ctx, {
        x: 480,
        y: 390,
        text: 'ONLY 2 CM',
        bgColor: theme.accent,
        textColor: '#ffffff',
        progress01: clamp01(localT / 0.55),
        fontSize: 42
      });

      drawColorSwatch(ctx, {
        x: 325,
        y: 700,
        size: 200,
        color: '#10b981',
        label: 'EMERALD',
        sublabel: '#10B981',
        progress01: clamp01((localT - 0.35) / 0.5)
      });

      drawColorSwatch(ctx, {
        x: 635,
        y: 700,
        size: 200,
        color: '#2563eb',
        label: 'COBALT',
        sublabel: '#2563EB',
        progress01: clamp01((localT - 0.65) / 0.5)
      });

      ctx.restore();

      drawProvenanceHeader(ctx, {
        width,
        height,
        text: 'ARTISTIC DEPICTION',
        dotColor: '#ef4444'
      });
    } else if (t < s1.end_s) {
      const localT = Math.max(0, t - s1.start_s);
      const theme = EDITORIAL_THEMES['science-doc'];
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.scale(s, s);

      const checkedCount = Math.min(3, Math.floor(localT / 1.1) + 1);
      drawChecklistCard(ctx, {
        x: 480,
        y: 540,
        w: 700,
        title: 'HUNT PROTOCOL',
        items: ['Locate target host', 'Inject neuro-blocker', 'Hijack motor control'],
        checkedCount,
        progress01: clamp01(localT / 0.45),
        theme: 'dark'
      });

      drawWaveformOscilloscope(ctx, {
        x: 480,
        y: 960,
        w: 720,
        h: 170,
        t: localT,
        amp: 0.85,
        color: theme.accent,
        label: 'NEURAL SIGNAL',
        mode: 'voice'
      });

      ctx.restore();

      drawProvenanceHeader(ctx, {
        width,
        height,
        text: 'NEURO-TOXIN STUDY',
        dotColor: theme.accent
      });
    } else {
      const localT = Math.max(0, t - s2.start_s);
      const theme = EDITORIAL_THEMES.horror;
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.scale(s, s);

      const activeCount = Math.min(30, Math.round(clamp01(localT / 2.2) * 30));
      drawIconGridCounter(ctx, {
        x: 480,
        y: 540,
        cols: 10,
        rows: 3,
        activeCount,
        activeColor: theme.accent,
        inactiveColor: '#334155',
        cellSize: 44,
        gap: 14,
        label: 'TARGET LOCKED'
      });

      drawStampSlam(ctx, {
        x: 480,
        y: 930,
        text: 'MIND CONTROL',
        color: theme.accent,
        angleRad: -0.1,
        progress01: clamp01((localT - 0.5) / 0.45)
      });

      ctx.restore();

      drawProvenanceHeader(ctx, {
        width,
        height,
        text: 'CASE FILE: JEWEL WASP',
        dotColor: theme.accent
      });
    }

    if (activeCap) {
      drawCaptionBar(ctx, {
        width,
        height,
        text: activeCap.text,
        highlightWord
      });
    }
  }
};
