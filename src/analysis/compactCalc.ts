// G-188: the rounding a stock or coin page stores, kept apart from the build (no Node file APIs) so the API Worker
// can compute an on-demand US page the same way the daily run does.
import type { StockCalc } from './quickCalc.js';

const r0 = (v: number) => Math.round(v);
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
/** Rounds a calc for storage: prices to whole units, percents to one decimal. */
export function compactCalc(c: StockCalc): StockCalc {
  return {
    ...c,
    signal: { ...c.signal, score: c.signal.score === null ? null : Math.round(c.signal.score * 100) / 100 },
    moves: c.moves.map((m) => ({ ...m, pct: r1(m.pct) })),
    fair: c.fair ? { ...c.fair, center: r0(c.fair.center), low: r0(c.fair.low), high: r0(c.fair.high), gapPct: r1(c.fair.gapPct)! } : null,
    forecasts: c.forecasts.map((f) => ({ days: f.days, p10: r0(f.p10), p50: r0(f.p50), p90: r0(f.p90) })),
    volume: c.volume ? { ratio1: r1(c.volume.ratio1)!, ratio5: r1(c.volume.ratio5)!, vwapGapPct: r1(c.volume.vwapGapPct)!, obvPct: r0(c.volume.obvPct), flow: c.volume.flow } : null,
    hi52GapPct: c.hi52GapPct == null ? null : r1(c.hi52GapPct),
  };
}

/** Six significant digits: coins and US stocks trade with decimals. */
const sig = (v: number) => Number(v.toPrecision(6));

/** compactCalc rounds prices to whole won; coins and US stocks keep their decimals. */
export function coinCalc(c: StockCalc): StockCalc {
  const r = compactCalc(c);
  return {
    ...r, close: sig(c.close),
    fair: c.fair ? { ...r.fair!, center: sig(c.fair.center), low: sig(c.fair.low), high: sig(c.fair.high) } : null,
    forecasts: c.forecasts.map((f) => ({ days: f.days, p10: sig(f.p10), p50: sig(f.p50), p90: sig(f.p90) })),
  };
}
