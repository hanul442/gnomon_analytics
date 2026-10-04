import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { aliasPattern, benchmarksFor, loadTickers, parseTickers } from './tickers.js';

test('tickers.json is valid and covers SK하이닉스 and 삼성전자', async () => {
  const tickers = await loadTickers(join(process.cwd(), 'tickers.json'));
  assert.deepEqual(tickers.map((t) => t.symbol), ['000660', '005930']);
  const samsung = tickers.find((t) => t.symbol === '005930')!;
  assert.deepEqual(benchmarksFor(samsung), [{ symbol: 'KOSPI', name: '코스피' }, { symbol: '000660', name: 'SK하이닉스' }]);
  assert.ok(aliasPattern(samsung).test('삼성전자, 3분기 잠정 실적'));
  assert.ok(!aliasPattern(samsung).test('삼성바이오로직스 수주'));
});

test('bad entries are rejected with the field that is wrong', () => {
  const ok = { symbol: '005930', name: '삼성전자', market: 'KOSPI', dartCorpCode: '00126380', newsQuery: '삼성전자', newsAliases: ['삼성전자'], ai: false };
  assert.equal(parseTickers([ok])[0]!.ai, false);
  assert.throws(() => parseTickers([]), /non-empty/);
  assert.throws(() => parseTickers([{ ...ok, symbol: '5930' }]), /symbol/);
  assert.throws(() => parseTickers([ok, ok]), /duplicate/);
  assert.throws(() => parseTickers([{ ...ok, market: 'NASDAQ' }]), /market/);
  assert.throws(() => parseTickers([{ ...ok, dartCorpCode: '126380' }]), /dartCorpCode/);
  assert.throws(() => parseTickers([{ ...ok, newsAliases: ['('] }]));
});
