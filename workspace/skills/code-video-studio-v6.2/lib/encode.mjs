// Shared H.264 encode flags for every video encode in the pipeline.
// Why these flags:
//  - scale=out_color_matrix=bt709:out_range=tv + bt709 tags: canvas RGB->YUV defaults to BT.601
//    in swscale; untagged/mismatched matrices shift colours on phones.
//  - profile high + closed GOP (g=2s, no scene-cut keyframes) + maxrate/bufsize: platform-friendly,
//    and keeps stream-copy concat of segments seamless.
//  - yuv420p, 4:2:0, progressive: required by Instagram/YouTube/TikTok ingest.
import { ENCODER_VERSION } from './profiles.mjs';

export { ENCODER_VERSION };

export function colorFilter() {
  return 'scale=out_color_matrix=bt709:out_range=tv:flags=bicubic,format=yuv420p';
}

export function colorTagArgs() {
  return ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
}

export function videoEncodeArgs({ fps = 30, draft = false } = {}) {
  const crf = draft ? '24' : '18';
  return [
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-preset', draft ? 'veryfast' : 'faster',
    '-crf', crf,
    '-maxrate', draft ? '4M' : '12M',
    '-bufsize', draft ? '8M' : '24M',
    '-g', String(fps * 2),
    '-keyint_min', String(fps),
    '-sc_threshold', '0',
    '-bf', '2',
    ...colorTagArgs()
  ];
}
