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
//   lit_fraction share of pixels with luma >= LIT_LUMA outside the caption band  -> is anything actually lit
//   lit_regions  connected lit blobs on a 9x16 grid (>= 2 cells, a cell is lit at >= 20% lit pixels)
//   p5_luma      5th percentile luma                                       -> true blacks exist
//   subject_scale height of the main salient blob / frame height (saliency = local contrast + edges + distance
//                from the frame mean, on a 54x96 downscale)               -> is the subject big enough to read
// Shot fingerprints (shotFingerprint / reelSimilarity) detect near-duplicate shots and a reused backdrop.
// The caption band (DEFAULT_CAPTION_BAND) is excluded from EVERY measure, including the 1px edge row bordering it.
export const DEFAULT_CAPTION_BAND = Object.freeze([0.64, 0.82]);
export const LIT_LUMA = 48;
const LIT_GRID = { cols: 9, rows: 16 };
export const GRID = Object.freeze({ cols: 3, rows: 5 });
export const CELL_NAMES = (() => {
  const v = ['top', 'upper', 'middle', 'lower', 'bottom'], h = ['left', 'centre', 'right'];
  const out = [];
  for (let r = 0; r < GRID.rows; r++) for (let c = 0; c < GRID.cols; c++) out.push(`${v[r]}-${h[c]}`);
  return out;
})();

export function frameMetrics(buf, w, h, ch = 3, { ignoreBands = [] } = {}) {
  // ignoreBands default [] keeps style_ref/reference stats byte-compatible; visual_loop passes DEFAULT_CAPTION_BAND.
  const N = w * h;
  const L = new Float32Array(N);
  let sum = 0, sum2 = 0, satSum = 0, satN = 0;
  const hueBins = new Float64Array(12); let hueN = 0;
  const bins = new Uint32Array(512);
  const skip = skipMask(h, ignoreBands);
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
    if (skip[y] || skip[y + 1]) continue; // also drop the row whose vertical gradient reads into the caption band
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
  let edgeRows = 0;
  for (let y = 0; y < h - 1; y++) if (!skip[y] && !skip[y + 1]) edgeRows++;
  const px = Math.max(1, (w - 1) * edgeRows);
  const cells = Array.from(cellE, (e, k) => (cellN[k] ? e / cellN[k] : null));
  const valid = cells.filter((c) => c != null);
  const sharp = edges / px;
  let colorBins = 0;
  for (const b of bins) if (b > counted * 0.002) colorBins++;
  const lit = litMetrics(L, w, h, skip, counted);
  const sal = subjectScale(buf, w, h, ch, skip);
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
    focal: +(valid.length && sharp > 0 ? Math.max(...valid) / sharp : 0).toFixed(2),
    lit_fraction: lit.fraction, lit_regions: lit.regions, p5_luma: lit.p5,
    subject_scale: sal.scale, subject_box: sal.box
  };
}

function skipMask(h, ignoreBands) {
  const skip = new Uint8Array(h);
  for (const [a, b] of ignoreBands) for (let y = Math.floor(a * h); y < Math.min(h, Math.ceil(b * h)); y++) skip[y] = 1;
  return skip;
}

function litMetrics(L, w, h, skip, counted, litLuma = LIT_LUMA) {
  const hist = new Uint32Array(256);
  const { cols, rows } = LIT_GRID;
  const cellLit = new Float64Array(cols * rows), cellN = new Float64Array(cols * rows);
  let lit = 0;
  for (let y = 0; y < h; y++) {
    if (skip[y]) continue;
    const r = Math.min(rows - 1, Math.floor((y / h) * rows));
    for (let x = 0; x < w; x++) {
      const l = L[y * w + x];
      hist[Math.max(0, Math.min(255, Math.round(l)))]++;
      const k = r * cols + Math.min(cols - 1, Math.floor((x / w) * cols));
      cellN[k]++;
      if (l >= litLuma) { lit++; cellLit[k]++; }
    }
  }
  const on = Uint8Array.from(cellLit, (v, k) => (cellN[k] && v / cellN[k] >= 0.2 ? 1 : 0));
  const regions = components(on, cols, rows).filter((c) => c.cells.length >= 2).length;
  let acc = 0, p5 = 0; const cut = counted * 0.05;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= cut) { p5 = v; break; } }
  return { fraction: +(counted ? lit / counted : 0).toFixed(4), regions, p5 };
}

// 4-connected components of a 0/1 grid -> [{cells:[idx...]}]
function components(on, cols, rows) {
  const seen = new Uint8Array(on.length), out = [];
  for (let s0 = 0; s0 < on.length; s0++) {
    if (!on[s0] || seen[s0]) continue;
    const cells = [], st = [s0]; seen[s0] = 1;
    while (st.length) {
      const i = st.pop(); cells.push(i);
      const x = i % cols, y = (i / cols) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const j = ny * cols + nx;
        if (on[j] && !seen[j]) { seen[j] = 1; st.push(j); }
      }
    }
    out.push({ cells });
  }
  return out;
}

const SAL_W = 54, SAL_H = 96, SAL_MERGE = 1;
// Coarse saliency: local contrast + edge density + luma distance from frame mean on a 54x96 average-pool.
// Absolute denominators stop a flat/near-black frame from amplifying noise into a fake subject.
export function subjectScale(buf, w, h, ch, skip) {
  const gw = SAL_W, gh = SAL_H;
  const P = new Float32Array(gw * gh), V = new Uint8Array(gw * gh), RGB = new Float32Array(gw * gh * 3);
  for (let gy = 0; gy < gh; gy++) {
    const y0 = Math.floor((gy * h) / gh), y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * h) / gh));
    for (let gx = 0; gx < gw; gx++) {
      const x0 = Math.floor((gx * w) / gw), x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * w) / gw));
      let s = 0, n = 0, r = 0, g = 0, b = 0;
      for (let y = y0; y < y1; y++) { if (skip[y]) continue; for (let x = x0; x < x1; x++) { const i = (y * w + x) * ch; r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; n++; } }
      if (n) { const k = gy * gw + gx; RGB[k * 3] = r / n; RGB[k * 3 + 1] = g / n; RGB[k * 3 + 2] = b / n; P[k] = (r + g + b) / (3 * n); V[k] = 1; }
    }
  }
  // background per row = median colour of the 4 leftmost + 4 rightmost cells (a subject rarely touches both margins);
  // 'distance' = how far a cell is from its row's background (handles sky/floor gradients; a plain frame-mean would not)
  const bg = new Float32Array(gh * 3), bgOk = new Uint8Array(gh);
  for (let gy = 0; gy < gh; gy++) {
    const ks = [0, 1, 2, 3, gw - 4, gw - 3, gw - 2, gw - 1].map((x) => gy * gw + x).filter((k) => V[k]);
    if (ks.length < 4) continue;
    for (let c = 0; c < 3; c++) { const v = ks.map((k) => RGB[k * 3 + c]).sort((a, b2) => a - b2); bg[gy * 3 + c] = v[v.length >> 1]; }
    bgOk[gy] = 1;
  }
  const lc = new Float32Array(P.length), ed = new Float32Array(P.length), di = new Float32Array(P.length);
  for (let gy = 1; gy < gh - 1; gy++) for (let gx = 1; gx < gw - 1; gx++) {
    const i = gy * gw + gx;
    if (!V[i]) continue;
    let s = 0, n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const yy = gy + dy, xx = gx + dx;
      if (yy < 0 || xx < 0 || yy >= gh || xx >= gw || !V[yy * gw + xx]) continue;
      s += P[yy * gw + xx]; n++;
    }
    lc[i] = Math.abs(P[i] - s / n);
    const gxv = V[i + 1] && V[i - 1] ? P[i + 1] - P[i - 1] : 0, gyv = V[i + gw] && V[i - gw] ? P[i + gw] - P[i - gw] : 0;
    ed[i] = Math.abs(gxv) + Math.abs(gyv);
    di[i] = bgOk[gy] ? (Math.abs(RGB[i * 3] - bg[gy * 3]) + Math.abs(RGB[i * 3 + 1] - bg[gy * 3 + 1]) + Math.abs(RGB[i * 3 + 2] - bg[gy * 3 + 2])) / 3 : 0;
  }
  const p99 = (a, floor) => { const v = Array.from(a).filter((_, i) => V[i]).sort((x, y) => x - y); return Math.max(floor, v[Math.floor(v.length * 0.99)] || 0); };
  const dl = p99(lc, 6), de = p99(ed, 10), dd = p99(di, 16);
  const sal = new Float32Array(P.length);
  for (let i = 0; i < sal.length; i++) if (V[i]) sal[i] = Math.min(1, 0.4 * (lc[i] / dl) + 0.3 * (ed[i] / de) + 0.3 * (di[i] / dd));
  const on = Uint8Array.from(sal, (v) => (v >= 0.4 ? 1 : 0));
  // merge blobs within 1 cell (a figure with a thin gap between head and body is one subject; a crowd stays many blobs), then take the heaviest
  const dil = new Uint8Array(on.length);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    if (!on[gy * gw + gx]) continue;
    for (let dy = -SAL_MERGE; dy <= SAL_MERGE; dy++) for (let dx = -SAL_MERGE; dx <= SAL_MERGE; dx++) {
      const yy = gy + dy, xx = gx + dx;
      if (yy >= 0 && xx >= 0 && yy < gh && xx < gw) dil[yy * gw + xx] = 1;
    }
  }
  let best = null, bestMass = 0;
  for (const c of components(dil, gw, gh)) {
    const mine = c.cells.filter((i) => on[i]);
    const mass = mine.reduce((a, i) => a + sal[i], 0);
    if (mass > bestMass) { bestMass = mass; best = mine; }
  }
  if (!best || best.length < 3) return { scale: 0, box: null };
  let x0 = gw, x1 = 0, y0 = gh, y1 = 0;
  for (const i of best) { const x = i % gw, y = (i / gw) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { scale: +((y1 - y0 + 1) / gh).toFixed(3), box: [x0 / gw, y0 / gh, (x1 + 1) / gw, (y1 + 1) / gh].map((v) => +v.toFixed(3)) };
}

export function aggregate(list) {
  const keys = ['sharp_edges', 'contrast', 'mean_luma', 'color_bins', 'saturation', 'ink', 'focal', 'hue_families', 'lit_fraction', 'lit_regions', 'p5_luma', 'subject_scale'];
  const out = {};
  for (const k of keys) out[k] = +(list.reduce((a, m) => a + (m[k] ?? 0), 0) / list.length).toFixed(4);
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
  // lit subject / scale / true blacks (only when the targets define them)
  lo('lit_fraction', 'add a motivated light pool: a lamp/moon/door-strip/torch cone that lights the subject and a patch of set around it (a dark look still needs a readable lit subject, not a black rectangle)');
  if (T.lit_regions && T.lit_regions.min != null && m.lit_regions < T.lit_regions.min) out.push({ metric: 'lit_regions', value: m.lit_regions, target: `>= ${T.lit_regions.min}`, hint: 'nothing is lit: add a motivated light pool (lamp, moon through a window, door strip, torch cone) on the subject' });
  if (T.subject_scale && T.subject_scale.min != null && m.subject_scale < T.subject_scale.min && !(m.establishing)) {
    out.push({ metric: 'subject_scale', value: m.subject_scale, target: `>= ${T.subject_scale.min}`, hint: `main subject is only ${Math.round(m.subject_scale * 100)}% of frame height: move camera closer / scale the figure to >= ${Math.round(T.subject_scale.min * 100)}% height, or crop the empty wall/sky (tag the shot "establishing" in timeline.json only if it truly is a scene-setter)` });
  }
  hi('p5_luma', 'no true blacks: darken the deepest shadows (under furniture, door gaps, figure interior) so the frame has real black to read the bright areas against');
  if (T.max_empty_cells != null && m.empty_cells.length > T.max_empty_cells) {
    out.push({ metric: 'empty_cells', value: m.empty_cells.length, target: `<= ${T.max_empty_cells}`, hint: `dead areas at ${m.empty_cells.join(', ')}: fill with set dressing (wall decor, window, plants, shelves, stars, pattern) or reframe/zoom so the subject fills them` });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Shot fingerprints and reel-level similarity (reused backdrop, near-duplicate shots)
// ---------------------------------------------------------------------------------------------------------
export const SIMILARITY_DEFAULTS = Object.freeze({
  dup_hash_sim: 0.88,      // adjacent shots: dHash similarity >= this ...
  dup_hist_dist: 0.2,      // ... and colour histogram distance <= this => near-duplicate
  backdrop_hash_sim: 0.85, // masked-backdrop dHash similarity >= this ...
  backdrop_cell_diff: 0.05,// ... and mean abs per-cell colour difference (0..1) <= this => same backdrop
  backdrop_share_max: 0.4, // flag when more than this share of shots share one backdrop
  backdrop_min_shots: 4    // do not judge reels shorter than this
});
const FW = 9, FH = 8, BACKDROP_MIN_BITS = 20; // fewer comparable hash bits than this = too little unmasked background to judge

// Fingerprint of one frame. mask(x,y)->true marks pixels that must not count (caption band, subject).
function fingerprintOne(buf, w, h, ch, skipRow, maskFn) {
  const gray = new Float64Array(FW * FH), rgb = new Float64Array(FW * FH * 3), cnt = new Float64Array(FW * FH), tot = new Float64Array(FW * FH);
  const hist = new Float64Array(64); let hn = 0;
  for (let y = 0; y < h; y++) {
    const gy = Math.min(FH - 1, Math.floor((y / h) * FH));
    for (let x = 0; x < w; x++) {
      const gx = Math.min(FW - 1, Math.floor((x / w) * FW)), k = gy * FW + gx;
      tot[k]++;
      if (skipRow[y] || (maskFn && maskFn(x / w, y / h))) continue;
      const i = (y * w + x) * ch, r = buf[i], g = buf[i + 1], b = buf[i + 2];
      cnt[k]++; gray[k] += (r + g + b) / 3; rgb[k * 3] += r; rgb[k * 3 + 1] += g; rgb[k * 3 + 2] += b;
      hist[(r >> 6) * 16 + (g >> 6) * 4 + (b >> 6)]++; hn++;
    }
  }
  const valid = new Uint8Array(FW * FH);
  for (let k = 0; k < valid.length; k++) {
    valid[k] = cnt[k] >= tot[k] * 0.5 ? 1 : 0;
    if (cnt[k]) { gray[k] /= cnt[k]; rgb[k * 3] /= cnt[k]; rgb[k * 3 + 1] /= cnt[k]; rgb[k * 3 + 2] /= cnt[k]; }
  }
  // dHash: bit = left cell brighter than right cell by > 2 luma (the margin keeps grain from flipping bits)
  const bits = new Int8Array((FW - 1) * FH).fill(-1);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW - 1; x++) {
    const a = y * FW + x, b = a + 1;
    if (valid[a] && valid[b]) bits[y * (FW - 1) + x] = gray[a] > gray[b] + 2 ? 1 : 0;
  }
  return { bits, rgb, valid, hist: hn ? Array.from(hist, (v) => v / hn) : Array.from(hist) };
}

// keyframes: [{buf,w,h,ch}] -> { whole: [fp per key], backdrop: [fp per key] }
export function shotFingerprint(frames, { ignoreBands = [DEFAULT_CAPTION_BAND] } = {}) {
  const whole = [], backdrop = [];
  for (const f of frames) {
    const { buf, w, h, ch = 4 } = f;
    const skip = skipMask(h, ignoreBands);
    whole.push(fingerprintOne(buf, w, h, ch, skip, null));
    // backdrop: also mask the fixed centre and the salient subject box (padded)
    const box = subjectScale(buf, w, h, ch, skip).box;
    const pad = 0.04;
    const m = (nx, ny) => (nx > 0.3 && nx < 0.7 && ny > 0.3 && ny < 0.7) || (box && nx > box[0] - pad && nx < box[2] + pad && ny > box[1] - pad && ny < box[3] + pad);
    backdrop.push(fingerprintOne(buf, w, h, ch, skip, m));
  }
  return { whole, backdrop };
}

function hashSim(a, b) {
  let n = 0, same = 0;
  for (let i = 0; i < a.bits.length; i++) if (a.bits[i] >= 0 && b.bits[i] >= 0) { n++; if (a.bits[i] === b.bits[i]) same++; }
  return { n, sim: n ? same / n : 0 };
}
function histDist(a, b) { let d = 0; for (let i = 0; i < a.hist.length; i++) d += Math.abs(a.hist[i] - b.hist[i]); return d / 2; }
function cellDiff(a, b) {
  let d = 0, n = 0;
  for (let k = 0; k < a.valid.length; k++) if (a.valid[k] && b.valid[k]) { d += (Math.abs(a.rgb[k * 3] - b.rgb[k * 3]) + Math.abs(a.rgb[k * 3 + 1] - b.rgb[k * 3 + 1]) + Math.abs(a.rgb[k * 3 + 2] - b.rgb[k * 3 + 2])) / 765; n++; }
  return n ? d / n : 1;
}

// Distance between two shots = mean over same-index keyframes.
export function shotDistance(A, B, kind = 'whole') {
  const fa = A[kind], fb = B[kind], n = Math.min(fa.length, fb.length);
  let sim = 0, hist = 0, cell = 0, minBits = 99;
  for (let k = 0; k < n; k++) {
    const hs = hashSim(fa[k], fb[k]);
    sim += hs.sim; minBits = Math.min(minBits, hs.n); hist += histDist(fa[k], fb[k]); cell += cellDiff(fa[k], fb[k]);
  }
  return { hash_sim: +(sim / n).toFixed(3), hist_dist: +(hist / n).toFixed(3), cell_diff: +(cell / n).toFixed(3), bits: minBits };
}

// shots: [{id, fp}] in reel order. Returns pairs, near-duplicate adjacent shots and reused-backdrop clusters.
export function reelSimilarity(shots, opts = {}) {
  const C = { ...SIMILARITY_DEFAULTS, ...opts };
  const pairs = [];
  for (let i = 0; i < shots.length; i++) for (let j = i + 1; j < shots.length; j++) {
    const w = shotDistance(shots[i].fp, shots[j].fp, 'whole'), b = shotDistance(shots[i].fp, shots[j].fp, 'backdrop');
    pairs.push({ a: shots[i].id, b: shots[j].id, ai: i, bi: j, whole: w, backdrop: b });
  }
  const top_pairs = pairs.slice().sort((x, y) => y.whole.hash_sim - x.whole.hash_sim || x.whole.hist_dist - y.whole.hist_dist).slice(0, 3)
    .map((p) => ({ a: p.a, b: p.b, hash_sim: p.whole.hash_sim, hist_dist: p.whole.hist_dist }));
  const near_duplicates = pairs.filter((p) => p.bi === p.ai + 1 && p.whole.hash_sim >= C.dup_hash_sim && p.whole.hist_dist <= C.dup_hist_dist)
    .map((p) => ({ a: p.a, b: p.b, hash_sim: p.whole.hash_sim, hist_dist: p.whole.hist_dist }));
  // backdrop clusters (union-find over pairs whose masked backdrops match)
  const parent = shots.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const p of pairs) if (p.backdrop.bits >= BACKDROP_MIN_BITS && p.backdrop.hash_sim >= C.backdrop_hash_sim && p.backdrop.cell_diff <= C.backdrop_cell_diff) parent[find(p.ai)] = find(p.bi);
  const groups = new Map();
  shots.forEach((s, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(s.id); });
  const clusters = [...groups.values()].filter((g) => g.length >= 2).sort((a, b) => b.length - a.length);
  const share = clusters.length ? clusters[0].length / shots.length : 0;
  const reused_backdrop = shots.length >= C.backdrop_min_shots && share > C.backdrop_share_max;
  return { top_pairs, near_duplicates, backdrop_clusters: clusters, backdrop_share: +share.toFixed(3), reused_backdrop, thresholds: C };
}

export const SIMILARITY_HINTS = Object.freeze({
  reused_backdrop: 'vary backdrop or camera angle: the same background carries too many shots; change the set (different room/wall/prop layout), the camera angle (low/high/side/over-shoulder) or the lighting set-up so each shot has its own place',
  near_duplicate: 'this shot is a near-copy of the previous one: change the camera angle or distance (cut wide to close), the subject position, or the light, so the cut shows something new'
});

// Targets file for a brief. brief.look ('night'|'day'|'interior'|...) wins; genre decides the family.
// Returns a templates/ file name.
export function selectTargetsFile(brief = {}) {
  const genre = String(brief.genre || '').toLowerCase();
  const look = String(brief.look || brief.visual?.look || '').toLowerCase();
  const day = /^(day|daylight|noon|bright|sunny|midday)$/.test(look);
  if (genre === 'horror') return day ? 'visual_targets.horror-day.json' : 'visual_targets.horror.json';
  return 'visual_targets.json';
}
