import fs from 'node:fs';
import path from 'node:path';

// Stems are written linear (no tanh/limiter) as 32-bit float PCM so nothing is clipped before the mix; ffmpeg reads them natively.
export function writeWavFloat(outPath, L, R, sr = 48000) {
  const n = Math.min(L.length, R.length);
  const buf = Buffer.alloc(44 + n * 8);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 8, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 8, 28); buf.writeUInt16LE(8, 32); buf.writeUInt16LE(32, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 8, 40);
  const f = new Float32Array(buf.buffer, buf.byteOffset + 44, n * 2);
  for (let i = 0; i < n; i++) { f[i * 2] = L[i]; f[i * 2 + 1] = R[i]; }
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  const tmp = `${outPath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, outPath);
  return outPath;
}

// Reads PCM16/24/32 and float32 WAV. Mono is returned as L=R.
export function readWav(p) {
  const b = fs.readFileSync(p);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${p}: not a RIFF/WAVE file`);
  let off = 12, fmt = null, data = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4); let size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { tag: (b.readUInt16LE(off + 8) === 0xfffe && size >= 26) ? b.readUInt16LE(off + 32) : b.readUInt16LE(off + 8), ch: b.readUInt16LE(off + 10), sr: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    else if (id === 'data') { if (off + 8 + size > b.length) size = b.length - off - 8; data = b.subarray(off + 8, off + 8 + size); break; }
    off += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error(`${p}: missing fmt/data chunk`);
  const tag = fmt.tag;
  const bytes = fmt.bits / 8, frames = Math.floor(data.length / (bytes * fmt.ch));
  const ch = [new Float32Array(frames), new Float32Array(frames)];
  const rd = (o) => {
    if (tag === 3 && fmt.bits === 32) return data.readFloatLE(o);
    if (fmt.bits === 16) return data.readInt16LE(o) / 32768;
    if (fmt.bits === 24) return data.readIntLE(o, 3) / 8388608;
    if (fmt.bits === 32) return data.readInt32LE(o) / 2147483648;
    throw new Error(`${p}: unsupported WAV format (${fmt.bits}-bit, tag ${fmt.tag})`);
  };
  for (let i = 0; i < frames; i++) {
    const l = rd(i * bytes * fmt.ch); ch[0][i] = l; ch[1][i] = fmt.ch > 1 ? rd(i * bytes * fmt.ch + bytes) : l;
  }
  return { sr: fmt.sr, L: ch[0], R: ch[1], mono: fmt.ch === 1, frames };
}
