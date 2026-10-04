import assert from 'node:assert/strict';
import test from 'node:test';
import { ANALYST_HORIZON, scoreAnalysts, type AnalystCall } from './analysts.js';

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
