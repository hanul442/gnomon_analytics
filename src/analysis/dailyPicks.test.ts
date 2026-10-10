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

test('daily picks: a weekday is two stocks and the ETF or the coin, every one a committee report (G-168)', () => {
  const picks = chooseDailyPicks({ date: '2026-10-06', weekday: 2, stocks, etfs, coins, exclude: new Set() });
  // Tuesday: two stocks and the coin.
  assert.deepEqual(picks.map((p) => p.kind), ['stock', 'stock', 'coin']);
  assert.ok(picks.every((p) => p.tier === 'deep'));
  // Leveraged and inverse ETFs, stablecoins, flagged and sub-100원 coins are left out.
  assert.ok(['KRW-BTC', 'KRW-ETH'].includes(picks[2]!.symbol));
  assert.equal(new Set(picks.map((p) => p.symbol)).size, 3);
  // Wednesday: two stocks and the ETF.
  const wed = chooseDailyPicks({ date: '2026-10-07', weekday: 3, stocks, etfs, coins, exclude: new Set() });
  assert.deepEqual(wed.map((p) => p.kind), ['stock', 'stock', 'etf']);
  assert.ok(['069500', '360750'].includes(wed[2]!.symbol));
  assert.ok(wed.every((p) => p.tier === 'deep'));
});

test('daily picks: one US stock a weekday from the top by trading value, never an ETF, with its ticker and English name (G-179)', () => {
  const us = [['AAPL.O', '애플', 'AAPL · NASDAQ · Apple Inc.', 0, 250, 1.1, 'BULLISH', 40, 1, 2, 3, 1, 9000, 2, 'I', -3], ['SPY', 'SPDR S&P500', 'SPY · AMEX ETF · SPDR S&P 500 ETF Trust', 0, 560, 0.3, 'NEUTRAL', 0, 0, 0, 0, 1, 30000, 0, 'I', -1], ['MRNA.O', '모더나', 'MRNA · NASDAQ · Moderna, Inc.', 0, 40, -2.5, 'BEARISH', 20, -1, -3, -8, 1, 500, 5, 'B', -40]];
  const picks = chooseDailyPicks({ date: '2026-10-06', weekday: 2, stocks, etfs, coins, us, exclude: new Set() });
  const pick = picks.find((p) => p.market === 'NASDAQ')!;
  assert.ok(pick, 'a US pick');
  assert.ok(['AAPL.O', 'MRNA.O'].includes(pick.symbol));
  assert.deepEqual([pick.kind, pick.tier, pick.reason], ['stock', 'deep', '미국 거래대금 상위 후보에서 선정']);
  assert.equal(pick.us?.ticker, pick.symbol.split('.')[0]);
  assert.match(pick.us!.english, /Apple Inc\.|Moderna, Inc\./);
  assert.equal(picks.filter((p) => ['NASDAQ', 'NYSE', 'AMEX'].includes(p.market)).length, 1);
  // Excluded names and weekends draw none.
  assert.ok(!chooseDailyPicks({ date: '2026-10-06', weekday: 2, stocks, etfs, coins, us, exclude: new Set(['AAPL.O', 'MRNA.O']) }).some((p) => p.market === 'NASDAQ'));
  assert.ok(!chooseDailyPicks({ date: '2026-10-04', weekday: 6, stocks, etfs, coins, us, exclude: new Set() }).some((p) => p.market === 'NASDAQ'));
});

test('daily picks: the same date draws the same names; weekends are one deep coin; exclusions and risk hold', () => {
  const a = chooseDailyPicks({ date: '2026-10-06', weekday: 2, stocks, etfs, coins, exclude: new Set() });
  const b = chooseDailyPicks({ date: '2026-10-06', weekday: 2, stocks, etfs, coins, exclude: new Set() });
  assert.deepEqual(a, b);
  const weekend = chooseDailyPicks({ date: '2026-10-10', weekday: 6, stocks, etfs, coins, exclude: new Set() });
  assert.deepEqual(weekend.map((p) => [p.kind, p.tier]), [['coin', 'deep']]);
  const risky = stocks.map((r, i) => (i < 25 ? stock(String(r[0]), Number(r[7]), 2) : r));
  const small = chooseDailyPicks({ date: '2026-10-06', weekday: 2, stocks: risky, etfs: [], coins: [], exclude: new Set([String(stocks[25]![0])]) });
  const allowed = new Set(stocks.slice(26).map((r) => String(r[0])));
  assert.equal(small.length, 2);
  assert.ok(small.every((p) => allowed.has(p.symbol)), 'risky and excluded names are never drawn');
  assert.ok(seeded('x')() !== seeded('y')());
});

test('daily picks (G-197): one of the two stocks is a larger company when the pool has one, even when every candidate came from the same screen', () => {
  // Only one stock is 1조+; on many dates it must still be drawn as one of the two.
  const mixed = stocks.map((r, i) => (i === 7 ? stock(String(r[0]), Number(r[7]), 0, 25_000) : r));
  const big = String(mixed[7]![0]);
  let withBig = 0, days = 0;
  for (let d = 1; d <= 28; d++) {
    const date = `2026-09-${String(d).padStart(2, '0')}`;
    const picks = chooseDailyPicks({ date, weekday: 2, stocks: mixed, etfs, coins, exclude: new Set() }).filter((p) => p.kind === 'stock');
    if (picks.length < 2) continue;
    days++;
    if (picks.some((p) => p.symbol === big)) withBig++;
  }
  assert.ok(days > 0 && withBig === days, `the 1조+ stock is one of the two whenever it is in the pool (${withBig}/${days})`);
});
