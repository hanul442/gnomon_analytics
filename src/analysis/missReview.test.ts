import assert from 'node:assert/strict';
import test from 'node:test';
import type { AnalystCall } from './analysts.js';
import { reviewMarkdown, reviewMisses } from './missReview.js';
import type { PriceForecast } from './valuation.js';

const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
const line = (f: (i: number) => number) => Array.from({ length: 40 }, (_, i) => ({ date: day(i), close: f(i) }));
const fc = (symbol: string, p10: number, p90: number): PriceForecast => ({ method: 'gnm-forecast-v1', symbol, baseDate: day(0), baseClose: 100, horizon: 5, p10, p50: 100, p90, sigma: 0.02, drift: 0, madeAt: '' });
const call = (symbol: string, stance: AnalystCall['stance'], target: number): AnalystCall => ({ symbol, analyst: 'trend_momentum', reportDate: day(0), baseDate: day(0), baseClose: 100, stance, confidence: 60, target, promptVersion: 't', madeAt: '' });

test('misses are split into the market and the pick', () => {
  const index = line((i) => 100 - i); // −5 over 5 sessions, −20 over 20
  const bars = new Map([
    ['A', line((i) => 100 - i)], // falls with the market
    ['B', line((i) => 100 - 3 * i)], // falls far more than the market
    ['N', line((i) => 100 + i)],
  ]);
  const r = reviewMisses({
    forecasts: [fc('A', 97, 103), fc('B', 97, 103)],
    calls: [call('A', 'BULLISH', 110), call('B', 'BULLISH', 110), call('A', 'BEARISH', 90), call('N', 'NEUTRAL', 100)],
    bars, indexOf: () => index,
  });
  const types = r.misses.map((m) => `${m.symbol}:${m.type}`).sort();
  // A's range miss is the market's; B's is its own. A only matched the index (did not beat it), so its BULLISH
  // miss counts as the pick, as does B's (lagged the index). A's BEARISH was right and is not a miss.
  assert.deepEqual(types, ['A:market_shock', 'A:stock', 'B:stock', 'B:stock_tail', 'N:neutral_rule']);
  assert.equal(r.scoredRanges, 2);
  assert.equal(r.scoredCalls, 4);
  assert.equal(r.candidates.length, 0); // one day is never a pattern
  assert.match(reviewMarkdown(r, day(0)), /오답 리뷰/);
});

test('a BULLISH call that fell less than a falling index is the market, not the pick', () => {
  const r = reviewMisses({ forecasts: [], calls: [call('A', 'BULLISH', 110)], bars: new Map([['A', line((i) => 100 - 0.5 * i)]]), indexOf: () => line((i) => 100 - i) });
  assert.deepEqual(r.misses.map((m) => m.type), ['market']);
});
