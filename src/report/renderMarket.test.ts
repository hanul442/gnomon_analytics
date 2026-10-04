import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runDaily } from '../cli/daily.js';

// One settled run on fixture data, then the page: six tabs and the new panels.
const FIX = join(process.cwd(), 'test', 'fixtures', 'naver');
const fakeFetch = (async (url: string | URL | Request) => {
  const u = String(url);
  for (const [path, file] of [['/trend', 'trend.json'], ['/integration', 'integration.json'], ['/finance/quarter', 'finance-quarter.json'], ['/finance/annual', 'finance-annual.json']] as const) {
    if (u.includes('m.stock.naver.com') && u.includes(path)) return new Response(await readFile(join(FIX, file), 'utf8'));
  }
  if (u.includes('timeframe=week')) return new Response(await readFile(join(FIX, 'week.xml'), 'latin1'));
  if (u.includes('timeframe=minute')) return new Response(await readFile(join(FIX, 'minute.xml'), 'latin1'));
  if (u.includes('fchart.stock.naver')) return new Response(await readFile(join(FIX, 'week.xml'), 'latin1')); // 260 bars as "daily" history
  if (u.includes('opendart')) return new Response(JSON.stringify({ status: '013' }));
  return new Response('<rss><channel></channel></rss>');
}) as typeof fetch;

test('the report page has six tabs with gauges, fair value, forecasts, flows and fundamentals', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  await runDaily({ root, now: new Date('2026-10-02T09:30:00Z'), apiKey: 'k', fetch: fakeFetch });
  const page = await readFile(join(root, 'site', 'reports', '2026-10-02.html'), 'utf8');
  for (const id of ['tab-overview', 'tab-chart', 'tab-flows', 'tab-fundamentals', 'tab-news']) assert.match(page, new RegExp(`id="${id}" role="tabpanel"`));
  assert.equal((page.match(/class="mini-gauge"/g) ?? []).length, 5);
  for (const text of ['기술적 적정가', '예측 범위', '누적 순매수', '수급 흔적', '분기 실적', '증권가 평균 목표가', '가격 구조', '시장 대비 수익률']) assert.ok(page.includes(text), text);
  assert.ok(page.includes('data-overlay="forecast"'));
  // The forecast made with the report is logged once.
  const log = (await readFile(join(root, 'data', 'forecasts', '000660.jsonl'), 'utf8')).trim().split('\n');
  assert.equal(log.length, 4);
});
