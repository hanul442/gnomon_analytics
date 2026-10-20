import assert from 'node:assert/strict';
import test from 'node:test';
import { ANALYST_HORIZON, committeeConsensus, invalidationOf, scoreAnalysts, type AnalystCall } from './analysts.js';

const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
const bars = Array.from({ length: 40 }, (_, i) => ({ date: day(i), close: 100 + i }));
const call = (analyst: AnalystCall['analyst'], base: number, stance: AnalystCall['stance'], target: number): AnalystCall => ({
  symbol: 'X', analyst, reportDate: day(base), baseDate: day(base), baseClose: 100 + base, stance, confidence: 60, target, promptVersion: 't', madeAt: '',
});

test('a call is scored 20 sessions later on direction and target error', () => {
  const calls = [
    call('trend_momentum', 0, 'BULLISH', 125), // actual 120: right direction, error 4%
    call('mean_reversion', 0, 'BEARISH', 90), // wrong direction
    call('wave_structure', 0, 'NEUTRAL', 100), // actual +20%: neutral misses
    call('trend_momentum', 30, 'BULLISH', 140), // not due yet
  ];
  const board = scoreAnalysts(calls, bars);
  const trend = board.find((b) => b.analyst === 'trend_momentum')!;
  assert.equal(ANALYST_HORIZON, 20);
  assert.deepEqual([trend.scored, trend.hitRate, trend.pending, trend.rank], [1, 1, 1, 1]);
  assert.equal(Math.round(trend.medianErrorPct! * 100) / 100, 4);
  assert.equal(board.find((b) => b.analyst === 'mean_reversion')!.hitRate, 0);
  assert.equal(board.find((b) => b.analyst === 'wave_structure')!.hitRate, 0);
  assert.equal(trend.latest?.baseDate, day(30));
  // Analysts without scored calls are listed after the ranked ones, unranked.
  const fundamental = board.find((b) => b.analyst === 'fundamental')!;
  assert.deepEqual([fundamental.rank, fundamental.scored], [null, 0]);
  assert.equal(board[0]!.analyst, 'trend_momentum');
});

test('each analyst keeps its last calls followed to today, scored or in progress (G-213)', () => {
  const calls = [
    call('trend_momentum', 0, 'BULLISH', 125),
    call('trend_momentum', 30, 'BEARISH', 120),
    call('mean_reversion', 39, 'BULLISH', 150), // made on the last bar: nothing to compare yet
    ...Array.from({ length: 7 }, (_, i) => call('fundamental', 10 + i, 'BULLISH', 200)),
  ];
  const board = scoreAnalysts(calls, bars);
  const trend = board.find((b) => b.analyst === 'trend_momentum')!.calls!;
  assert.deepEqual(trend.map((c) => [c.baseDate, c.done, c.hit, c.sessions, c.close]), [[day(30), false, false, 9, 139], [day(0), true, true, 20, 120]]);
  assert.deepEqual(board.find((b) => b.analyst === 'mean_reversion')!.calls!.map((c) => [c.sessions, c.hit]), [[0, null]]);
  const fund = board.find((b) => b.analyst === 'fundamental')!.calls!;
  assert.deepEqual(fund.map((c) => c.baseDate), [16, 15, 14, 13, 12].map(day));
});

test('confidence is scored as a probability: Brier score and average confidence (G-226)', () => {
  const at = (base: number, stance: AnalystCall['stance'], target: number, confidence: number) => ({ ...call('trend_momentum', base, stance, target), confidence });
  // Both due: a right call at 80% (0.04) and a wrong one at 70% (0.49).
  const board = scoreAnalysts([at(0, 'BULLISH', 125, 80), at(1, 'BEARISH', 90, 70), at(30, 'BULLISH', 140, 99)], bars);
  const trend = board.find((b) => b.analyst === 'trend_momentum')!;
  assert.equal(trend.scored, 2);
  assert.equal(Math.round(trend.brier! * 1000) / 1000, 0.265);
  assert.equal(trend.avgConfidence, 75);
  const none = board.find((b) => b.analyst === 'fundamental')!;
  assert.deepEqual([none.brier, none.avgConfidence], [null, null]);
});

test('consensus pools the calls in log-odds and weights by skill only after 30 scored (G-228)', () => {
  const calls = [
    { analyst: 'trend_momentum' as const, stance: 'BULLISH' as const, confidence: 70 },
    { analyst: 'volume_flow' as const, stance: 'BULLISH' as const, confidence: 70 },
    { analyst: 'mean_reversion' as const, stance: 'BEARISH' as const, confidence: 60 },
  ];
  const plain = committeeConsensus(calls, [], {})!;
  // logit(.7)*2 + logit(.4) = 1.6946 - 0.4055 = 1.289; /3 → 0.4297 → 60.6%
  assert.deepEqual(plain, { upPct: 61, weighted: false, prior: false, n: 3 });
  const few = committeeConsensus(calls, [{ analyst: 'mean_reversion', scored: 29, brier: 0 }], {})!;
  assert.equal(few.weighted, false);
  // A perfect bear with 30 scored weighs 1 vs the bulls' 1 each; a bad one (brier .25) weighs 0.1.
  const bad = committeeConsensus(calls, [{ analyst: 'mean_reversion', scored: 30, brier: 0.25 }], {})!;
  assert.equal(bad.weighted, true);
  assert.ok(bad.upPct > plain.upPct);
  assert.equal(committeeConsensus([]), null);
  assert.equal(committeeConsensus([{ analyst: 'fundamental', stance: 'NEUTRAL', confidence: 90 }])!.upPct, 50);
});

test('G-246: blind-test weights lean on mean reversion until live records take over', () => {
  const calls = [
    { analyst: 'trend_momentum' as const, stance: 'BULLISH' as const, confidence: 70 },
    { analyst: 'mean_reversion' as const, stance: 'BEARISH' as const, confidence: 70 },
  ];
  // Equal weights: 50%. Blind prior: trend 0.5 vs mean reversion 1.5 → leans bearish.
  assert.equal(committeeConsensus(calls, [], {})!.upPct, 50);
  const k = committeeConsensus(calls)!;
  assert.ok(k.upPct < 50);
  assert.deepEqual([k.prior, k.weighted], [true, false]);
  // Once both have 30 live calls with the same record, the prior no longer counts.
  const live = committeeConsensus(calls, [{ analyst: 'trend_momentum', scored: 30, brier: 0.2 }, { analyst: 'mean_reversion', scored: 30, brier: 0.2 }])!;
  assert.deepEqual([live.upPct, live.prior, live.weighted], [50, false, true]);
});

test('an invalidation price is checked every session and counted once scored (G-229)', () => {
  // Bars rise 100 → 139. A bear call at base 0 with invalidation 105 is crossed on day 5 and misses.
  const bear = { ...call('mean_reversion', 0, 'BEARISH', 90), invalidation: 105 };
  const bull = { ...call('mean_reversion', 1, 'BULLISH', 130), invalidation: 95 }; // never crossed, hits
  const open = { ...call('mean_reversion', 30, 'BEARISH', 120), invalidation: 133 }; // crossed on day 33, in progress
  const board = scoreAnalysts([bear, bull, open], bars).find((b) => b.analyst === 'mean_reversion')!;
  assert.deepEqual(board.kill, { set: 2, broke: 1, brokeMissed: 1 });
  assert.deepEqual(board.calls!.map((c) => [c.baseDate, c.brokeOn]), [[day(30), day(33)], [day(1), null], [day(0), day(5)]]);
  assert.equal(scoreAnalysts([call('fundamental', 0, 'BULLISH', 125)], bars).find((b) => b.analyst === 'fundamental')!.kill, undefined);
});

test('invalidation must sit on the losing side of the close, within a third (G-229)', () => {
  assert.equal(invalidationOf('BULLISH', 100, 92), 92);
  assert.equal(invalidationOf('BULLISH', 100, 105), undefined);
  assert.equal(invalidationOf('BULLISH', 100, 50), undefined);
  assert.equal(invalidationOf('BEARISH', 100, 110), 110);
  assert.equal(invalidationOf('BEARISH', 100, 95), undefined);
  assert.equal(invalidationOf('NEUTRAL', 100, 95), undefined);
  assert.equal(invalidationOf('BULLISH', 100, 0), undefined);
});
