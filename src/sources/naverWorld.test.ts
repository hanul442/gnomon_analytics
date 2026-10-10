import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchUsDirectory, fetchUsUniverse, fetchWorldBars, parseUsRanking, parseUsSearch, parseWorldBars, parseWorldQuote, US_CODE, usdHangeul, usTicker } from './naverWorld.js';

const AT = new Date('2026-10-08T13:00:00Z');
// Shapes as Naver answered on 2026-10-08 (diag workflow), trimmed.
const BARS = [
  { localDate: '20260902', closePrice: 324.96, openPrice: 326.865, highPrice: 328.4, lowPrice: 323.53, accumulatedTradingVolume: 33776370 },
  { localDate: '20260901', closePrice: 325.13, openPrice: 316.98, highPrice: 327.3, lowPrice: 314.73, accumulatedTradingVolume: 53167388 },
  { localDate: 'bad', closePrice: 1 },
];
const QUOTE = { pollingInterval: 7000, datas: [{ reutersCode: 'AAPL.O', closePrice: '336.67', compareToPreviousClosePrice: '3.04', fluctuationsRatio: '0.91', localTradedAt: '2026-10-07T16:00:00-04:00', marketStatus: 'CLOSE', overMarketPriceInfo: { tradingSessionType: 'PRE_MARKET', overMarketStatus: 'OPEN', overPrice: '337.05', compareToPreviousClosePrice: '0.38', fluctuationsRatio: '0.11', localTradedAt: '2026-10-08T08:47:25-04:00' } }] };
const RANK = (code: string, end = 'stock') => ({ stockEndType: end, reutersCode: code, symbolCode: code.split('.')[0], stockName: code === 'NVDA.O' ? '엔비디아' : 'TSMC ADR', stockNameEng: 'x', industryCodeType: { industryGroupKor: '반도체' }, closePrice: '237.47', fluctuationsRatio: '-0.74', accumulatedTradingValue: '194억 USD' });

test('US codes: with or without the exchange letter, never Korean codes or coins', () => {
  for (const ok of ['AAPL.O', 'DELL.K', 'TSM', 'SPY', 'BRK-B']) assert.ok(US_CODE.test(ok), ok);
  for (const no of ['005930', '0001A0', 'KRW-BTC', 'aapl.o', 'AAPL.OO']) assert.ok(!US_CODE.test(no), no);
  assert.deepEqual(['AAPL.O', 'DELL.K', 'IBM.N', 'BRK.B', 'TSM'].map(usTicker), ['AAPL', 'DELL', 'IBM', 'BRK.B', 'TSM'], 'G-194: a share class keeps its letter');
});

test('daily bars: oldest first, bad rows dropped, dates as YYYY-MM-DD', () => {
  const b = parseWorldBars(BARS, 'AAPL.O', AT);
  assert.deepEqual(b.map((x) => x.date), ['2026-09-01', '2026-09-02']);
  assert.equal(b[0]!.close, 325.13);
  assert.throws(() => parseWorldBars({}, 'AAPL.O', AT), /NAVER_WORLD_UNEXPECTED/);
});

test('quote: the pre-market price while that session is open', () => {
  const q = parseWorldQuote(QUOTE)!;
  assert.equal(q.symbol, 'AAPL.O');
  assert.equal(q.price, 337.05);
  assert.equal(q.session, 'pre');
  assert.equal(q.open, true);
  assert.equal(q.changePct, 0.11);
  const closed = parseWorldQuote({ datas: [{ ...QUOTE.datas[0], overMarketPriceInfo: { overMarketStatus: 'CLOSE' } }] })!;
  assert.equal(closed.price, 336.67);
  assert.equal(closed.session, 'closed');
  assert.equal(parseWorldQuote({}), null);
});

test('ranking rows and Korean money words', () => {
  assert.equal(usdHangeul('194억 USD'), 194e8);
  assert.equal(usdHangeul('4조 9,134억 USD'), 4e12 + 9134e8);
  assert.equal(usdHangeul('2.05억 USD'), 2.05e8);
  const r = parseUsRanking({ stocks: [RANK('NVDA.O'), RANK('TSM'), RANK('bad code')] }, 'NASDAQ');
  assert.deepEqual(r.map((x) => x.code), ['NVDA.O', 'TSM']);
  assert.equal(r[0]!.valueUsd, 194e8);
  const etf = parseUsSearch({ items: [{ code: 'SPYA', reutersCode: 'SPYA.K', nationCode: 'USA', typeCode: 'AMEX', url: '/worldstock/etf/SPYA.K' }, { code: 'SPY', name: 'SPDR S&P 500', reutersCode: 'SPY', nationCode: 'USA', typeCode: 'AMEX', url: '/worldstock/etf/SPY' }] }, 'SPY')!;
  assert.equal(etf.code, 'SPY');
  assert.equal(etf.kind, 'etf');
});

test('universe: each exchange by market value plus ETFs, duplicates once; bars ask a date window', async () => {
  const asked: string[] = [];
  const fake = (async (url: string | URL | Request) => {
    const u = String(url); asked.push(u);
    if (u.includes('/marketValue')) return new Response(JSON.stringify({ stocks: u.includes('NASDAQ') ? [RANK('NVDA.O')] : u.includes('NYSE') ? [RANK('TSM')] : [] }));
    if (u.includes('ac.stock.naver.com')) { const q = new URL(u).searchParams.get('q'); return new Response(JSON.stringify({ items: q === 'SPY' ? [{ code: 'SPY', name: 'SPY', reutersCode: 'SPY', nationCode: 'USA', typeCode: 'AMEX', url: '/worldstock/etf/SPY' }] : [] })); }
    if (u.includes('/chart/foreign/item/')) return new Response(JSON.stringify(BARS));
    return new Response('nope', { status: 404 });
  }) as typeof fetch;
  const list = await fetchUsUniverse({ fetch: fake, perExchange: { NASDAQ: 1, NYSE: 1, AMEX: 1 } });
  assert.deepEqual(list.map((x) => x.code), ['NVDA.O', 'TSM', 'SPY']);
  const bars = await fetchWorldBars('NVDA.O', 30, { fetch: fake, now: () => AT });
  assert.equal(bars.length, 2);
  assert.match(asked.at(-1)!, /item\/NVDA\.O\/day\?startDateTime=\d{12}&endDateTime=202610090000$/);
  await assert.rejects(fetchWorldBars('005930', 30, { fetch: fake }), /BAD_US_CODE/);
});

test('directory (G-188): each exchange to its short, empty or repeated page, a failing page retried then marked partial; the computed set comes from it', async () => {
  const asked: string[] = [];
  const page50 = (ex: string, page: number, n = 50) => Array.from({ length: n }, (_, i) => RANK(`${ex}${page}X${i}.O`));
  const make = (nyseFails: boolean) => (async (url: string | URL | Request) => {
    const u = new URL(String(url)), page = Number(u.searchParams.get('page')); asked.push(u.pathname + page);
    if (!u.pathname.includes('/marketValue')) return new Response('nope', { status: 404 });
    if (u.pathname.includes('NASDAQ')) return new Response(JSON.stringify({ stocks: page <= 3 ? page50('N', page) : page === 4 ? page50('N', 4, 10) : [] }));
    if (u.pathname.includes('NYSE')) return nyseFails && page === 2 ? new Response('busy', { status: 503 }) : new Response(JSON.stringify({ stocks: page <= 2 ? page50('Y', page) : [] }));
    return new Response(JSON.stringify({ stocks: page50('A', 1) })); // AMEX answers every page with its first one
  }) as typeof fetch;
  const dir = await fetchUsDirectory({ fetch: make(false) });
  assert.deepEqual(dir.partial, []);
  assert.equal(dir.listings.filter((x) => x.exchange === 'NASDAQ').length, 160, 'stops after the short 4th page');
  assert.equal(dir.listings.filter((x) => x.exchange === 'NYSE').length, 100, 'stops at the empty 3rd page');
  assert.equal(dir.listings.filter((x) => x.exchange === 'AMEX').length, 50);
  assert.equal(asked.filter((x) => x.includes('AMEX')).length, 2, 'a page with no new code ends the walk');
  assert.equal((await fetchUsDirectory({ fetch: make(false), maxPages: 1 })).listings.length, 150);
  asked.length = 0;
  const cut = await fetchUsDirectory({ fetch: make(true) });
  assert.deepEqual(cut.partial, ['NYSE']);
  assert.equal(asked.filter((x) => x === '/stock/exchange/NYSE/marketValue2').length, 3, 'a failing page is tried three times');
  assert.equal(cut.listings.filter((x) => x.exchange === 'NYSE').length, 50);
  const top = await fetchUsUniverse({ fetch: make(true), directory: cut, perExchange: { NASDAQ: 3, NYSE: 1, AMEX: 0 } });
  assert.deepEqual(top.map((x) => x.code), ['N1X0.O', 'N1X1.O', 'N1X2.O', 'Y1X0.O']);
});
