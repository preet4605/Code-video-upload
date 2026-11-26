// Deterministic randomness. Every cue gets its own stream: seedFor(master, cue.id), so adding a cue never changes another cue's noise.
export function hash32(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
export function seedFor(master, id) { return (hash32(`${master}:${id}`) ^ Math.imul(Number(master) | 0, 0x9e3779b1)) >>> 0; }

export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  const r = {
    next,
    uniform: (lo = 0, hi = 1) => lo + (hi - lo) * next(),
    int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * next()),
    gauss() {
      if (spare !== null) { const v = spare; spare = null; return v; }
      let u = 0; while (u < 1e-12) u = next();
      const v = next();
      const m = Math.sqrt(-2 * Math.log(u));
      spare = m * Math.sin(2 * Math.PI * v);
      return m * Math.cos(2 * Math.PI * v);
    },
    exp: (mean) => -Math.log(1 - next()) * mean,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    fork: (label) => makeRng(hash32(`${seed}/${label}`))
  };
  return r;
}

export function hashSamples(L, R = null) {
  // FNV-1a over the float bit patterns: used by tests to compare renders.
  let h = 0x811c9dc5;
  const f = new Float32Array(1);
  const u = new Uint32Array(f.buffer);
  for (const arr of R ? [L, R] : [L]) {
    for (let i = 0; i < arr.length; i++) { f[0] = arr[i]; h ^= u[0]; h = Math.imul(h, 0x01000193) >>> 0; }
  }
  return h.toString(16).padStart(8, '0');
}
