import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fetchUpbitDaysLong, parseUpbitDays, parseUpbitMarkets } from './upbit.js';
import { writeCoinPages } from '../cli/coins.js';

const candle = (i: number, close: number) => ({ market: 'KRW-BTC', candle_date_time_kst: new Date(Date.UTC(2026, 3, 1) + i * 86_400_000).toISOString().slice(0, 10) + 'T09:00:00', opening_price: close, high_price: close * 1.01, low_price: close * 0.99, trade_price: close, candle_acc_trade_volume: 100 + i });

test('upbit: KRW markets with their warning flag; candles oldest first', () => {
  const markets = parseUpbitMarkets([{ market: 'KRW-BTC', korean_name: '비트코인', english_name: 'Bitcoin', market_warning: 'NONE' }, { market: 'BTC-ETH', korean_name: '이더리움' }, { market: 'KRW-XYZ', korean_name: '엑스', market_event: { warning: true } }]);
  assert.deepEqual(markets.map((m) => [m.market, m.warning]), [['KRW-BTC', false], ['KRW-XYZ', true]]);
  const bars = parseUpbitDays([candle(1, 101), candle(0, 100), { bad: 1 }], 'KRW-BTC', new Date());
  assert.deepEqual(bars.map((b) => [b.date, b.close]), [['2026-04-01', 100], ['2026-04-02', 101]]);
  assert.throws(() => parseUpbitMarkets({}), /UPBIT_MARKETS_SHAPE/);
});

test('coin pages: every KRW market gets a chart file and a list row; small prices keep decimals', async () => {
  const site = await mkdtemp(join(tmpdir(), 'gnm-coins-'));
  const fake = (async (url: string) => {
    const u = String(url);
    if (u.includes('/market/all')) return Response.json([{ market: 'KRW-BTC', korean_name: '비트코인', english_name: 'Bitcoin' }, { market: 'KRW-PEPE', korean_name: '페페', english_name: 'Pepe', market_warning: 'CAUTION' }]);
    if (u.includes('/ticker')) return Response.json([{ market: 'KRW-BTC', acc_trade_price_24h: 5e11, signed_change_rate: 0.012 }]);
    const pepe = u.includes('KRW-PEPE');
    return Response.json(Array.from({ length: 200 }, (_, i) => candle(199 - i, pepe ? 0.012 + i * 0.00001 : 9e7 * (1 + i * 0.001))));
  }) as typeof fetch;
  const r = await writeCoinPages(site, { now: () => new Date('2026-10-05T12:00:00Z'), fetch: fake, pauseMs: 0 });
  assert.equal(r.status.ok, true);
  assert.deepEqual(r.rows.map((x) => [x[0], x[3], x[12]]), [['KRW-BTC', 0, 5000], ['KRW-PEPE', 1, null]]);
  const pepe = JSON.parse(await readFile(join(site, 'c', 'KRW-PEPE.json'), 'utf8'));
  assert.ok(pepe.calc.close > 0 && pepe.calc.close < 1 && pepe.warning === true, String(pepe.calc.close));
  assert.equal(JSON.parse(await readFile(join(site, 'coins.json'), 'utf8')).rows.length, 2);
  // Upbit unreachable: the run goes on with a failed status.
  const down = await writeCoinPages(site, { now: () => new Date(), fetch: (async () => new Response('', { status: 503 })) as typeof fetch, pauseMs: 0 });
  assert.deepEqual([down.status.ok, down.rows.length], [false, 0]);
});

test('upbit: long history pages back 200 days at a time with `to`', async () => {
  const all = Array.from({ length: 450 }, (_, i) => candle(i, 100 + i));
  const urls: string[] = [];
  const fake = (async (url: string) => {
    urls.push(url);
    const to = new URL(url).searchParams.get('to');
    const before = to ? all.filter((c) => `${c.candle_date_time_kst.slice(0, 10)}T00:00:00Z` < to) : all;
    return new Response(JSON.stringify(before.slice(-200).reverse()));
  }) as typeof fetch;
  const bars = await fetchUpbitDaysLong('KRW-BTC', new Date(), 1000, fake, 0);
  assert.equal(bars.length, 450);
  assert.equal(urls.length, 3);
  assert.deepEqual([bars[0]!.date, bars.at(-1)!.date], [all[0]!.candle_date_time_kst.slice(0, 10), all.at(-1)!.candle_date_time_kst.slice(0, 10)]);
  assert.equal((await fetchUpbitDaysLong('KRW-BTC', new Date(), 300, fake, 0)).length, 300);
});

test('minute candles preserve absolute UTC time, sort and deduplicate, rejecting invalid OHLCV', async()=>{
 const {parseUpbitMinutes,fetchUpbitMinutes}=await import('./upbit.js');
 const bar={market:'KRW-BTC',candle_date_time_utc:'2026-10-06T05:00:00',opening_price:100,high_price:110,low_price:90,trade_price:105,candle_acc_trade_volume:2};
 const list=parseUpbitMinutes([bar,bar,{...bar,market:'KRW-ETH'},{...bar,opening_price:'bad'}],'KRW-BTC');assert.equal(list.length,1);assert.equal(list[0]!.time,Date.parse('2026-10-06T05:00:00Z')/1000);
 await fetchUpbitMinutes('KRW-BTC',15,(async(url)=>{assert.match(String(url),/minutes\/15\?market=KRW-BTC&count=200/);return Response.json([bar]);}) as typeof fetch);
});
