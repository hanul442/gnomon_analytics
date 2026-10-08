import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { writeUsPages } from './usStocks.js';
import { tempDir } from '../testTmp.js';

test('US pages: one JSON per stock in dollars, and the list for the 미국 주식 tab', async () => {
  const dir = await tempDir('gnm-us-');
  const bars = Array.from({ length: 140 }, (_, i) => ({ localDate: new Date(Date.UTC(2026, 3, 1 + i)).toISOString().slice(0, 10).replace(/-/g, ''), openPrice: 100 + i * 0.5, highPrice: 101 + i * 0.5, lowPrice: 99 + i * 0.5, closePrice: 100.123 + i * 0.5, accumulatedTradingVolume: 1_000_000 }));
  const fake = (async (url: string | URL | Request) => (String(url).includes('FAIL') ? new Response('x', { status: 500 }) : new Response(JSON.stringify(bars)))) as typeof fetch;
  const universe = [
    { code: 'AAPL.O', ticker: 'AAPL', name: '애플', nameEng: 'Apple Inc.', exchange: 'NASDAQ' as const, kind: 'stock' as const, industry: '전화 및 소형 장치', marketCapUsd: 4.9e12, close: null, changePct: 0.91, valueUsd: 115e8 },
    { code: 'FAIL.O', ticker: 'FAIL', name: '실패', nameEng: '', exchange: 'NASDAQ' as const, kind: 'stock' as const, industry: '', marketCapUsd: null, close: null, changePct: null, valueUsd: null },
  ];
  const r = await writeUsPages(dir, { now: () => new Date('2026-10-08T13:00:00Z'), fetch: fake, universe });
  assert.equal(r.rows.length, 1);
  assert.equal(r.status.count, 1);
  const page = JSON.parse(await readFile(join(dir, 'u', 'AAPL.O.json'), 'utf8'));
  assert.equal(page.currency, 'USD');
  assert.equal(page.ticker, 'AAPL');
  assert.equal(page.bars.at(-1)[4], 169.62, 'cents kept');
  assert.ok(page.calc && page.calc.signal);
  const list = JSON.parse(await readFile(join(dir, 'usstocks.json'), 'utf8'));
  assert.equal(list.rows[0][0], 'AAPL.O');
  assert.equal(list.rows[0][12], 11500, 'trading value in millions of dollars');
  assert.match(list.rows[0][2], /^AAPL · NASDAQ · Apple/);
});
