// Helpers for library (recorded) cues: fit a file to a bed span and level-match it.
// fitToSpan(x, n, xf): trim to n samples, or loop with an equal-power crossfade of xf samples at each seam (and a plain repeat if the file is shorter than 2*xf).
export function fitToSpan(x, n, xf = 0) {
  if (x.length >= n) return x.slice(0, n);
  const out = new Float32Array(n); const m = x.length; const f = Math.min(xf, Math.floor(m / 3));
  const step = m - f; if (step <= 0) { for (let i = 0; i < n; i++) out[i] = x[i % m]; return out; }
  let pos = 0; // start of the next copy
  out.set(x.subarray(0, Math.min(m, n)), 0); let end = m;
  while (end < n) {
    pos = end - f;
    for (let i = 0; i < f && pos + i < n; i++) { const t = (i + 0.5) / f; out[pos + i] = out[pos + i] * Math.cos(t * Math.PI / 2) + x[i] * Math.sin(t * Math.PI / 2); }
    for (let i = f; i < m && pos + i < n; i++) out[pos + i] = x[i];
    end = pos + m;
  }
  return out;
}
// Linear gain that sets the RMS (over samples above -60 dBFS, so silence does not drag it down) of the channels to targetDb dBFS.
export function normalizeRms(chs, targetDb) {
  let s = 0, c = 0; for (const x of chs) for (let i = 0; i < x.length; i++) { const v = x[i] * x[i]; if (v > 1e-6) { s += v; c++; } }
  if (!c) return 1; return 10 ** (targetDb / 20) / Math.sqrt(s / c);
}
