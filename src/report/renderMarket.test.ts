import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runDaily } from '../cli/daily.js';
import { loadTickers } from '../config/tickers.js';

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

test('report pages have eight tabs with gauges, fair value, forecasts, flows and fundamentals; the front page is live', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const tickers = (await loadTickers(join(process.cwd(), 'tickers.json'))).filter((t) => t.symbol === '000660');
  await runDaily({ root, now: new Date('2026-10-02T09:30:00Z'), apiKey: 'k', fetch: fakeFetch, tickers });
  const page = await readFile(join(root, 'site', '000660', 'reports', '2026-10-02.html'), 'utf8');
  for (const id of ['tab-home', 'tab-chart', 'tab-technical', 'tab-paper', 'tab-flows', 'tab-fundamentals', 'tab-ai', 'tab-news']) assert.match(page, new RegExp(`id="${id}" role="tabpanel"`));
  // Horizon gauges on the home and technical tabs, plus one per strategy in the arena.
  assert.ok((page.match(/class="mini-gauge"/g) ?? []).length >= 10);
  assert.ok(page.includes('전략 대결') && page.includes('챔피언 레이스'));
  for (const text of ['기술적 적정가', '예측 범위', '누적 순매수', '수급 흔적', '분기 실적', '증권가 평균 목표가', '가격 구조', '시장 대비 수익률']) assert.ok(page.includes(text), text);
  assert.ok(page.includes('data-ov="forecast"'));
  for (const key of ['rsi', 'macd', 'stoch', 'volume']) assert.ok(page.includes(`data-pane="${key}"`), key);
  // Strategy chips put buy/sell points on the chart; filings and news are dashed vertical lines.
  assert.ok(page.includes('data-strategy="macd"') && page.includes('id="strat-info"') && page.includes('data-show-strategy'));
  // The parliament: every vote as a seat, with faction chips and seat details.
  assert.ok(page.includes('id="parliament"') && page.includes('data-pf="indicator"') && (page.match(/class="seat /g) ?? []).length >= 16);
  assert.ok(page.includes('class="card hs"'));
  assert.ok(page.includes('id="vlines"') && page.includes('id="ev-strip"') && page.includes('class="trade-log"'));
  // The front page is the live dashboard; the archive lists dated reports.
  const front = await readFile(join(root, 'site', '000660', 'index.html'), 'utf8');
  assert.ok(front.includes('기준 최신'));
  assert.match(await readFile(join(root, 'site', '000660', 'archive.html'), 'utf8'), /reports\/2026-10-02\.html/);
  // The forecast made with the report is logged once.
  const log = (await readFile(join(root, 'data', 'forecasts', '000660.jsonl'), 'utf8')).trim().split('\n');
  assert.equal(log.length, 4);
});
