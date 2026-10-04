import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import test from 'node:test';
import { fetchMarketUniverse, parseMarketList } from './naverList.js';
import { firstZipEntry, parseCorpCodes } from './dartCorpCodes.js';

const item = (code: string, name: string, kind = 'stock') => ({ itemCode: code, stockName: name, stockEndType: kind, closePrice: '276,000', fluctuationsRatio: '-2.08', accumulatedTradingValue: '3,141,812', marketValue: '16,135,729', localTradedAt: '2026-10-02T20:20:21+09:00' });

test('list rows convert units: trading value in millions, market cap in hundred millions', () => {
  const { rows, total } = parseMarketList({ stocks: [item('005930', '삼성전자')], totalCount: 2482 }, 'KOSPI');
  assert.equal(total, 2482);
  assert.deepEqual(rows[0], { symbol: '005930', name: '삼성전자', market: 'KOSPI', kind: 'stock', close: 276000, changePct: -2.08, tradingValue: 3_141_812e6, marketCap: 16_135_729e8, tradedAt: '2026-10-02T20:20:21+09:00' });
  assert.throws(() => parseMarketList({ error: 'x' }, 'KOSPI'), /SHAPE/);
});

test('pages until the total is reached', async () => {
  const pages: string[] = [];
  const fake = (async (url: string | URL | Request) => {
    const u = String(url); pages.push(u);
    const page = Number(/page=(\d+)/.exec(u)![1]);
    const stocks = page === 1 ? Array.from({ length: 100 }, (_, i) => item(String(100000 + i), `종목${i}`)) : [item('200000', '마지막', 'etf')];
    return new Response(JSON.stringify({ stocks, totalCount: 101 }));
  }) as typeof fetch;
  const rows = await fetchMarketUniverse('KOSDAQ', { fetch: fake });
  assert.equal(rows.length, 101);
  assert.equal(pages.length, 2);
  assert.equal(rows.at(-1)!.kind, 'etf');
});

test('DART corp codes: reads the zipped XML and keeps listed companies only', () => {
  const xml = '<result><list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><stock_code>005930</stock_code></list><list><corp_code>00999999</corp_code><corp_name>비상장</corp_name><stock_code> </stock_code></list></result>';
  const data = deflateRawSync(Buffer.from(xml));
  const name = Buffer.from('CORPCODE.xml');
  const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(8, 8); header.writeUInt32LE(data.length, 18); header.writeUInt16LE(name.length, 26);
  const zip = Buffer.concat([header, name, data]);
  assert.deepEqual(parseCorpCodes(firstZipEntry(zip).toString('utf8')), { '005930': '00126380' });
});
