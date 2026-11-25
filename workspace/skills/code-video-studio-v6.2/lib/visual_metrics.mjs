// Visual detail metrics for the self-improvement loop. Works on an RGB(A) buffer at any size
// (frames are analysed at 270x480). Same function for reference videos and our stills, so targets
// calibrated on reference reels are comparable.
//   sharp_edges  share of pixels on a strong luma edge (|dx|+|dy| > 40)   -> detail / crispness
//   contrast     luma standard deviation                                   -> readability, punch
//   color_bins   occupied 8x8x8 colour bins (>0.2% of pixels)              -> palette richness (and cohesion cap)
//   saturation   mean HSV saturation of non-black pixels                   -> colour energy
//   ink          share of dark pixels sitting on edges (outlines)          -> drawn/outlined look
//   empty_cells  cells of a 3x5 grid with almost no edges (dead areas)     -> where detail is missing
//   focal        edge density of the busiest cell / frame mean            -> is there a clear subject
export const GRID = Object.freeze({ cols: 3, rows: 5 });
export const CELL_NAMES = (() => {
  const v = ['top', 'upper', 'middle', 'lower', 'bottom'], h = ['left', 'centre', 'right'];
  const out = [];
  for (let r = 0; r < GRID.rows; r++) for (let c = 0; c < GRID.cols; c++) out.push(`${v[r]}-${h[c]}`);
  return out;
})();

export function frameMetrics(buf, w, h, ch = 3, { ignoreBands = [] } = {}) {
  const N = w * h;
  const L = new Float32Array(N);
  let sum = 0, sum2 = 0, satSum = 0, satN = 0;
  const hueBins = new Float64Array(12); let hueN = 0;
  const bins = new Uint32Array(512);
  const skip = new Uint8Array(h);
  for (const [a, b] of ignoreBands) for (let y = Math.floor(a * h); y < Math.min(h, Math.ceil(b * h)); y++) skip[y] = 1;
  let counted = 0;
  for (let i = 0; i < N; i++) {
    const r = buf[i * ch], g = buf[i * ch + 1], b = buf[i * ch + 2];
    const l = (r + g + b) / 3;
    L[i] = l;
    if (skip[Math.floor(i / w)]) continue;
    counted++;
    sum += l; sum2 += l * l;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 40) { satSum += (mx - mn) / (mx + 1e-6); satN++; }
    if (mx > 50 && (mx - mn) / (mx + 1e-6) > 0.25) {
      let hdeg;
      const d = mx - mn;
      if (mx === r) hdeg = ((g - b) / d) % 6; else if (mx === g) hdeg = (b - r) / d + 2; else hdeg = (r - g) / d + 4;
      hueBins[Math.floor(((hdeg * 60 + 360) % 360) / 30)]++; hueN++;
    }
    bins[(r >> 5) * 64 + (g >> 5) * 8 + (b >> 5)]++;
  }
  const mean = sum / counted;
  const contrast = Math.sqrt(Math.max(0, sum2 / counted - mean * mean));
  let edges = 0, ink = 0;
  const cellE = new Float64Array(GRID.cols * GRID.rows), cellN = new Float64Array(GRID.cols * GRID.rows);
  for (let y = 0; y < h - 1; y++) {
    if (skip[y]) continue;
    const cr = Math.min(GRID.rows - 1, Math.floor((y / h) * GRID.rows));
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      const e = Math.abs(L[i] - L[i + 1]) + Math.abs(L[i] - L[i + w]) > 40;
      const cc = Math.min(GRID.cols - 1, Math.floor((x / w) * GRID.cols));
      const k = cr * GRID.cols + cc;
      cellN[k]++;
      if (e) { edges++; cellE[k]++; if (Math.min(L[i], L[i + 1], L[i + w]) < 60) ink++; }
    }
  }
  const px = Math.max(1, (w - 1) * (h - 1 - skip.reduce((a, b) => a + b, 0)));
  const cells = Array.from(cellE, (e, k) => (cellN[k] ? e / cellN[k] : null));
  const valid = cells.filter((c) => c != null);
  const sharp = edges / px;
  let colorBins = 0;
  for (const b of bins) if (b > counted * 0.002) colorBins++;
  return {
    sharp_edges: +sharp.toFixed(4),
    contrast: +contrast.toFixed(1),
    mean_luma: +mean.toFixed(1),
    color_bins: colorBins,
    saturation: +(satN ? satSum / satN : 0).toFixed(3),
    // distinct hue families covering >= 8% of the coloured pixels (a cohesive dark look uses 1-3)
    hue_families: hueN < counted * 0.01 ? 0 : Array.from(hueBins).filter((v) => v / hueN >= 0.08).length,
    ink: +(ink / px).toFixed(4),
    cells: cells.map((c) => (c == null ? null : +c.toFixed(4))),
    empty_cells: cells.map((c, k) => (c != null && c < 0.006 ? CELL_NAMES[k] : null)).filter(Boolean),
    focal: +(valid.length && sharp > 0 ? Math.max(...valid) / sharp : 0).toFixed(2)
  };
}

export function aggregate(list) {
  const keys = ['sharp_edges', 'contrast', 'mean_luma', 'color_bins', 'saturation', 'ink', 'focal', 'hue_families'];
  const out = {};
  for (const k of keys) out[k] = +(list.reduce((a, m) => a + m[k], 0) / list.length).toFixed(4);
  out.empty_cells = +(list.reduce((a, m) => a + m.empty_cells.length, 0) / list.length).toFixed(2);
  return out;
}

// Compare a shot's metrics with targets -> deficits with concrete, actionable hints.
export function deficits(m, T) {
  const out = [];
  const lo = (k, hint) => { if (T[k] && T[k].min != null && m[k] < T[k].min) out.push({ metric: k, value: m[k], target: `>= ${T[k].min}`, hint }); };
  const hi = (k, hint) => { if (T[k] && T[k].max != null && m[k] > T[k].max) out.push({ metric: k, value: m[k], target: `<= ${T[k].max}`, hint }); };
  lo('sharp_edges', 'add crisp detail: outlines on every shape, texture marks (wood grain, fabric pattern, stitching), small props, background objects');
  lo('contrast', 'separate subject from background: darker darks, a brighter key light/rim, outline the subject, avoid mid-grey fills');
  lo('saturation', 'use a deliberate palette with 1-2 saturated accents (warm light vs cool night); avoid desaturated greys');
  lo('color_bins', 'too few colours: add a light and shade tone per material and a second accent');
  hi('color_bins', 'too many colours: restrict to a palette (base, shade, light per material + 1-2 accents)');
  lo('ink', 'no drawn outlines: stroke every shape with the same dark ink line');
  lo('focal', 'no clear subject: make one area clearly busier/brighter than the rest (character, prop, light)');
  hi('mean_luma', 'too bright for this look: crush the blacks, keep light only where a motivated source (moon, door strip, lamp) reaches');
  hi('hue_families', 'too many colours for this look: grade to one cold base hue plus at most one or two accent hues (warm door light, red clock)');
  hi('saturation', 'too saturated for this look: desaturate the set; keep saturation only in the accent light');
  if (T.max_empty_cells != null && m.empty_cells.length > T.max_empty_cells) {
    out.push({ metric: 'empty_cells', value: m.empty_cells.length, target: `<= ${T.max_empty_cells}`, hint: `dead areas at ${m.empty_cells.join(', ')}: fill with set dressing (wall decor, window, plants, shelves, stars, pattern) or reframe/zoom so the subject fills them` });
  }
  return out;
}
