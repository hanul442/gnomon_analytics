import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { collectUniverse, readListedStocks } from './universe.js';

const row = (code: string, name: string, kind = 'stock') => ({ itemCode: code, stockName: name, stockEndType: kind, closePrice: '1,000', fluctuationsRatio: '1.00', accumulatedTradingValue: '10', marketValue: '100' });
const fake = (async (url: string | URL | Request) => {
  const u = String(url);
  if (u.includes('/KOSPI')) return new Response(JSON.stringify({ stocks: [row('005930', '삼성전자'), row('069500', 'KODEX 200', 'etf')], totalCount: 2 }));
  if (u.includes('/KOSDAQ')) return new Response(JSON.stringify({ stocks: [row('196170', '알테오젠')], totalCount: 1 }));
  return new Response('nope', { status: 500 });
}) as typeof fetch;

test('the listed-stock list keeps common stocks only; a failed corp-code fetch is recorded, not thrown', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const out = await collectUniverse(root, { apiKey: 'k', now: new Date('2026-10-05T09:00:00Z'), fetch: fake });
  assert.deepEqual(out.rows!.map((r) => r.symbol), ['005930', '196170']);
  assert.deepEqual(await readListedStocks(root), [{ symbol: '005930', name: '삼성전자', market: 'KOSPI' }, { symbol: '196170', name: '알테오젠', market: 'KOSDAQ' }]);
  assert.deepEqual(out.status.map((s) => [s.source, s.ok]), [['naver:m-stock:marketValue', true], ['opendart:corpCode', false]]);
  // Unchanged list: the file is left as it is.
  const before = await readFile(join(root, 'data', 'universe', 'stocks.json'), 'utf8');
  await collectUniverse(root, { apiKey: 'k', now: new Date('2026-10-06T09:00:00Z'), fetch: fake });
  assert.equal(await readFile(join(root, 'data', 'universe', 'stocks.json'), 'utf8'), before);
});
