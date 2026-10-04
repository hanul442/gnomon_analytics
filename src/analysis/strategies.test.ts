import assert from 'node:assert/strict';
import test from 'node:test';
import { ARENA_COST, backtest, monteCarlo, runArena, STRATEGIES, type ArenaBar } from './strategies.js';

const day = (i: number) => new Date(Date.UTC(2023, 0, 2) + i * 86_400_000).toISOString().slice(0, 10);
const bars = (closes: readonly number[], volume = 1000): ArenaBar[] => closes.map((c, i) => ({ date: day(i), open: c, high: c * 1.01, low: c * 0.99, close: c, volume }));
const def = (key: string) => STRATEGIES.find((s) => s.key === key)!;
const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('buy and hold earns the whole move, minus one entry cost', () => {
  const b = bars(Array.from({ length: 200 }, (_, i) => 100 * 1.001 ** i));
  const r = backtest(def('hold'), b);
  // The entry cost comes off the first holding day's return.
  near(r.totalReturn, (1.001 - ARENA_COST / 2) * 1.001 ** 198 - 1, 1e-9);
  assert.equal(r.trades, 1);
  assert.equal(r.exposure, 1);
  // The trade log records the signal day and its close; an open trade has no exit.
  assert.deepEqual(r.tradeLog.map((t) => [t.entry, t.exit, t.exitPrice]), [[b[0]!.date, null, null]]);
  near(r.tradeLog[0]!.entryPrice, b[0]!.close);
});

test('no look-ahead: a rule earns nothing on the session that triggered it', () => {
  // Flat, then one +10% day: momentum (60-day ROC > 0) can only turn on after that day.
  const closes = [...Array.from({ length: 100 }, () => 100), 110, ...Array.from({ length: 30 }, () => 110)];
  const r = backtest(def('momentum'), bars(closes));
  assert.ok(r.totalReturn < 0, 'the jump itself is not captured; only costs remain');
  assert.equal(r.position, 1);
});

test('trend following holds a steady rise and exits a fall', () => {
  const up = Array.from({ length: 150 }, (_, i) => 100 * 1.004 ** i);
  const down = Array.from({ length: 80 }, (_, i) => up.at(-1)! * 0.99 ** (i + 1));
  const r = backtest(def('trend'), bars([...up, ...down]));
  assert.ok(r.trades >= 1);
  assert.equal(r.position, 0);
  const last = r.tradeLog.at(-1)!;
  assert.ok(last.exit !== null && last.exit > last.entry && last.exitPrice! < up.at(-1)!);
  assert.ok(r.maxDrawdown > -0.25, `drawdown ${r.maxDrawdown}`);
});

test('mean reversion buys an oversold dip and is flat in a quiet market', () => {
  const quiet = Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i / 3));
  assert.equal(backtest(def('meanrev'), bars(quiet)).trades, 0);
  const dip = [...quiet, ...Array.from({ length: 10 }, (_, i) => 100 * 0.97 ** (i + 1)), ...Array.from({ length: 30 }, (_, i) => 74 + i)];
  assert.ok(backtest(def('meanrev'), bars(dip)).trades >= 1);
});

test('Monte Carlo is reproducible and orders its percentiles', () => {
  const trades = [0.05, -0.02, 0.03, -0.04, 0.08, 0.01];
  const a = monteCarlo(trades)!, b = monteCarlo(trades)!;
  assert.deepEqual(a, b);
  assert.ok(a.p05 <= a.p50 && a.p50 <= a.p95);
  assert.ok(a.lossProbability > 0 && a.lossProbability < 1);
  assert.equal(monteCarlo([0.1, 0.2]), null);
});

test('the arena ranks every strategy and names a qualified champion', () => {
  const closes = Array.from({ length: 400 }, (_, i) => 100 * 1.001 ** i * (1 + 0.08 * Math.sin(i / 9)));
  const a = runArena(bars(closes))!;
  assert.equal(a.results.length, STRATEGIES.length);
  assert.deepEqual(a.results.map((r) => r.rank), a.results.map((_, i) => i + 1));
  const champ = a.results.find((r) => r.key === a.championKey)!;
  assert.ok(champ.qualified && champ.key !== 'hold');
  assert.equal(runArena(bars([1, 2, 3])), null);
  // The same input gives the same arena.
  assert.deepEqual(runArena(bars(closes)), a);
});
