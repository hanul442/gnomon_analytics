import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseDailyPicks, seeded } from './dailyPicks.js';

// Screener rows: [code, name, market, cap(억), close, change%, level, score×100, r5, r20, r120, fairGap%, position, covered, vol1, vol5, vwap, obv, flow, tv, hi52, risk, labels].
const stock = (code: string, score: number, risk = 0, cap = 5000) => [code, `종목${code}`, 'P', cap, 10_000, 1, 'BULLISH', score, 1, 2, 3, 0, 'I', 0, 1, 1, 0, 0, null, 50, -10, risk, []];
// List rows: [symbol, name, english, warning, close, change, level, score, r5, r20, r120, vol1, value, fairGap, position, hi52].
const row = (sym: string, name: string, close = 10_000, warning = 0) => [sym, name, '', warning, close, 1, 'BULLISH', 10, 1, 2, 3, 1, 100, 0, 'I', -5];

const stocks = Array.from({ length: 30 }, (_, i) => stock(String(100000 + i * 10), 60 - i));
const etfs = [row('122630', 'KODEX 레버리지'), row('114800', 'KODEX 인버스'), row('069500', 'KODEX 200'), row('360750', 'TIGER 미국S&P500')];
const coins = [row('KRW-USDT', '테더', 1400), row('KRW-BTC', '비트코인', 1.6e8), row('KRW-XYZ', '유의코인', 500, 1), row('KRW-TINY', '작은코인', 3), row('KRW-ETH', '이더리움', 6e6)];

test('daily picks: a weekday is five stocks, an ETF and a coin, two of them deep', () => {
  const picks = chooseDailyPicks({ date: '2026-10-06', weekday: 2, stocks, etfs, coins, exclude: new Set() });
  assert.deepEqual(picks.map((p) => p.kind), ['stock', 'stock', 'stock', 'stock', 'stock', 'etf', 'coin']);
  assert.equal(picks.filter((p) => p.tier === 'deep').length, 2);
  assert.equal(picks[0]!.tier, 'deep');
  // Tuesday: the coin is deep, the ETF a brief.
  assert.deepEqual([picks[5]!.tier, picks[6]!.tier], ['brief', 'deep']);
  // Leveraged and inverse ETFs, stablecoins, flagged and sub-100원 coins are left out.
  assert.ok(['069500', '360750'].includes(picks[5]!.symbol));
  assert.ok(['KRW-BTC', 'KRW-ETH'].includes(picks[6]!.symbol));
  assert.equal(new Set(picks.map((p) => p.symbol)).size, 7);
  // Wednesday: the ETF is deep instead.
  const wed = chooseDailyPicks({ date: '2026-10-07', weekday: 3, stocks, etfs, coins, exclude: new Set() });
  assert.deepEqual([wed[5]!.tier, wed[6]!.tier], ['deep', 'brief']);
});

test('daily picks: the same date draws the same names; weekends are one deep coin; exclusions and risk hold', () => {
  const a = chooseDailyPicks({ date: '2026-10-06', weekday: 2, stocks, etfs, coins, exclude: new Set() });
  const b = chooseDailyPicks({ date: '2026-10-06', weekday: 2, stocks, etfs, coins, exclude: new Set() });
  assert.deepEqual(a, b);
  const weekend = chooseDailyPicks({ date: '2026-10-10', weekday: 6, stocks, etfs, coins, exclude: new Set() });
  assert.deepEqual(weekend.map((p) => [p.kind, p.tier]), [['coin', 'deep']]);
  const risky = stocks.map((r, i) => (i < 25 ? stock(String(r[0]), Number(r[7]), 2) : r));
  const small = chooseDailyPicks({ date: '2026-10-06', weekday: 2, stocks: risky, etfs: [], coins: [], exclude: new Set([String(stocks[25]![0])]) });
  assert.deepEqual(small.map((p) => p.symbol).sort(), stocks.slice(26).map((r) => String(r[0])).sort());
  assert.ok(seeded('x')() !== seeded('y')());
});
