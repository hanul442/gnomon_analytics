import assert from 'node:assert/strict';
import test from 'node:test';
import type { PriceBar } from '../types.js';
import { fetchOuterDays, parseBinanceKlines, parseBithumbDays, parseOkxCandles, spliceCoinHistory, trimListingDay, withOuterHistory, type OuterBar } from './coinHistory.js';

const DAY = 86_400_000, T0 = Date.UTC(2026, 0, 1);
const iso = (i: number) => new Date(T0 + i * DAY).toISOString().slice(0, 10);
const up = (i: number, close: number, extra: Partial<PriceBar> = {}): PriceBar => ({ symbol: 'KRW-PUFFER', date: iso(i), open: close, high: close * 1.02, low: close * 0.98, close, volume: 1000, source: 'upbit:candles:days', retrievedAt: '2026-10-20T00:00:00.000Z', ...extra });
const out = (i: number, close: number): OuterBar => ({ date: iso(i), open: close, high: close * 1.02, low: close * 0.98, close, volume: 500 });

test('G-271: older days from a USDT pair are priced in won by the overlap ratio; the listing spike is cut', () => {
  // Upbit lists on day 100 with a 3× wick; the coin had traded at 0.1 USDT for 100 days before.
  const upbit = [up(100, 140, { open: 150, high: 420, low: 120 }), ...Array.from({ length: 9 }, (_, k) => up(101 + k, 140))];
  const binance = Array.from({ length: 110 }, (_, i) => out(i, 0.1));
  const r = spliceCoinHistory(upbit, binance, { source: 'binance', usdtKrw: 1350, total: 400, listed: true });
  assert.equal(r.history.source, 'binance');
  assert.equal(r.history.added, 100);
  assert.equal(r.history.ratio, 1400);
  assert.equal(Math.round(r.history.premiumPct! * 10) / 10, 3.7);
  assert.equal(r.bars.length, 110);
  assert.equal(r.bars[0]!.close, 140);
  assert.equal(r.bars[0]!.source, 'binance:days×upbit');
  assert.equal(r.bars[0]!.volume, 1000);
  // Listing day: high cut to max(elsewhere high 142.8, close 140), low to elsewhere's 137.2, open inside.
  const listing = r.bars[100]!, r1 = (v: number) => Math.round(v * 10) / 10;
  assert.deepEqual([listing.date, r1(listing.high), r1(listing.low), r1(listing.open)], [iso(100), 142.8, 137.2, 142.8]);
  assert.equal(r.history.trimmed, true);
});

test('G-271: a different coin with the same ticker (price far from the USDT rate) adds nothing', () => {
  const upbit = Array.from({ length: 10 }, (_, k) => up(100 + k, 140));
  const other = Array.from({ length: 110 }, (_, i) => out(i, 5));
  const r = spliceCoinHistory(upbit, other, { source: 'okx', usdtKrw: 1350, total: 400, listed: false });
  assert.deepEqual([r.history.source, r.history.added, r.bars.length], [null, 0, 10]);
  // A USDT pair without the USDT rate cannot be checked either.
  assert.equal(spliceCoinHistory(upbit, other, { source: 'binance', usdtKrw: null, total: 400, listed: false }).history.added, 0);
  // Bithumb (won) needs a ratio near 1.
  const bithumb = Array.from({ length: 110 }, (_, i) => out(i, 138));
  assert.equal(spliceCoinHistory(upbit, bithumb, { source: 'bithumb', usdtKrw: null, total: 400, listed: false }).history.added, 100);
});

test('G-271: with no other exchange the listing wick is cut to the open and the next day', () => {
  const upbit = [up(0, 9.37, { open: 12, high: 37.6, low: 8.92 }), up(1, 8.78, { open: 9.37, high: 9.56, low: 8.7 })];
  const t = trimListingDay(upbit, null)!;
  assert.deepEqual([t.bars[0]!.high, t.bars[0]!.low, t.bars[0]!.open], [9.56, 8.92, 9.56]);
  assert.equal(trimListingDay([up(0, 100)], null), null);
});

test('G-271: exchange parsers date days like Upbit (UTC day start)', () => {
  assert.deepEqual(parseBinanceKlines([[Date.UTC(2026, 9, 19), '1', '2', '0.5', '1.5', '10']]), [{ date: '2026-10-19', open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]);
  assert.deepEqual(parseOkxCandles({ data: [[String(Date.UTC(2026, 9, 20)), '2', '2', '2', '2', '1'], [String(Date.UTC(2026, 9, 19)), '1', '1', '1', '1', '1']] }).map((b) => b.date), ['2026-10-19', '2026-10-20']);
  assert.deepEqual(parseBithumbDays([{ candle_date_time_kst: '2026-10-20T00:00:00', opening_price: 1, high_price: 1, low_price: 1, trade_price: 1, candle_acc_trade_volume: 1 }]).map((b) => b.date), ['2026-10-20']);
  assert.deepEqual(parseBinanceKlines({ code: 0 }), []);
});

test('G-271: a missing listing or a failing exchange never throws; the first exchange that adds most wins', async () => {
  const calls: string[] = [];
  const fake = (async (url: string) => {
    const u = String(url); calls.push(u);
    if (u.includes('binance')) return new Response('{"code":-1121}', { status: 400 });
    if (u.includes('okx')) return Response.json({ code: '0', data: Array.from({ length: 50 }, (_, k) => [String(T0 + (139 - k) * DAY), '0.1', '0.1', '0.1', '0.1', '5']) });
    throw new Error('offline');
  }) as typeof fetch;
  assert.deepEqual(await fetchOuterDays('binance', 'PUFFER', iso(10), 100, fake), []);
  const upbit = Array.from({ length: 30 }, (_, k) => up(120 + k, 135));
  const r = await withOuterHistory(upbit, 400, { usdtKrw: 1350, fetch: fake });
  assert.equal(r.history?.source, 'okx');
  assert.equal(r.history?.added, 30);
  assert.equal(r.bars.length, 60);
  assert.ok(calls.some((u) => u.includes('bithumb')));
  // Enough Upbit days: nothing is fetched.
  const n = calls.length;
  assert.equal((await withOuterHistory(upbit, 30, { usdtKrw: 1350, fetch: fake })).history, null);
  assert.equal(calls.length, n);
});
