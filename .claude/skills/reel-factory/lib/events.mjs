// Named time events for scene code. build_vo.mjs writes timeline.events = { line00_start, line00_end, ..., <event>, <event>_end }.
//   const clock = makeClock(timeline);
//   clock.at('line03_start')        -> seconds
//   clock.dur('line03')             -> end - start of a line or any span (name_start/name_end or name/name_end)
//   clock.between('line03', t)      -> 0..1 progress of t through that span (clamped)
// Unknown names throw with the list of near matches; nothing silently returns 0.
export function makeClock(timeline) {
  const ev = timeline?.events ?? timeline;
  if (!ev || typeof ev !== 'object' || Array.isArray(ev) || !Object.keys(ev).length) throw new Error('makeClock: timeline has no events (run scripts/build_vo.mjs)');
  const names = Object.keys(ev);
  const unknown = (n) => {
    const near = names.filter((k) => k.includes(String(n))).slice(0, 6);
    return new Error(`unknown event "${n}"${near.length ? `; did you mean: ${near.join(', ')}` : `; known: ${names.slice(0, 8).join(', ')}${names.length > 8 ? ', ...' : ''}`}`);
  };
  const at = (n) => { if (!Object.hasOwn(ev, n) || !Number.isFinite(ev[n])) throw unknown(n); return ev[n]; };
  const span = (n) => {
    if (Object.hasOwn(ev, `${n}_start`) && Object.hasOwn(ev, `${n}_end`)) return [ev[`${n}_start`], ev[`${n}_end`]];
    if (Object.hasOwn(ev, n) && Object.hasOwn(ev, `${n}_end`)) return [ev[n], ev[`${n}_end`]];
    if (Object.hasOwn(ev, n)) throw new Error(`event "${n}" is a point, not a span (no "${n}_end")`);
    throw unknown(n);
  };
  const dur = (n) => { const [a, b] = span(n); return b - a; };
  const between = (n, t) => { const [a, b] = span(n); return b > a ? Math.max(0, Math.min(1, (t - a) / (b - a))) : (t >= b ? 1 : 0); };
  return { at, dur, between, span, names };
}
