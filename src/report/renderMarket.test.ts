import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runDaily } from '../cli/daily.js';
import { loadTickers } from '../config/tickers.js';
import { APP_CSS, UI_JS } from './renderHtml.js';

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

test('report pages have six tabs with gauges, fair value, forecasts, flows and fundamentals; the front page is live', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const tickers = (await loadTickers(join(process.cwd(), 'tickers.json'))).filter((t) => t.symbol === '000660');
  await runDaily({ root, now: new Date('2026-10-02T09:30:00Z'), apiKey: 'k', fetch: fakeFetch, tickers });
  const page = await readFile(join(root, 'site', '000660', 'reports', '2026-10-02.html'), 'utf8');
  // G-71: four tabs; the old tab names live on as parts of them.
  for (const id of ['tab-home', 'tab-chart', 'tab-ai', 'tab-flows', 'tab-fundamentals', 'tab-news']) assert.match(page, new RegExp(`id="${id}" role="tabpanel"`));
  for (const id of ['tab-technical', 'tab-strategy']) assert.match(page, new RegExp(`class="data-part" id="${id}"`));
  // Horizon gauges on the home and technical tabs, plus one per strategy in the arena.
  assert.ok((page.match(/class="mini-gauge"/g) ?? []).length >= 10);
  assert.ok(page.includes('전략 대결') && page.includes('챔피언 레이스'));
  for (const text of ['기술적 적정가', '예측 범위', '누적 순매수', '수급 흔적', '분기 실적', '증권가 평균 목표가', '가격 구조', '시장 대비 수익률']) assert.ok(page.includes(text), text);
  assert.ok(page.includes('data-ov="forecast"'));
  for (const key of ['rsi', 'macd', 'stoch', 'volume']) assert.ok(page.includes(`data-pane="${key}"`), key);
  // Strategy chips put buy/sell points on the chart; filings and news are dashed vertical lines.
  assert.ok(page.includes('data-strategy="macd"') && page.includes('id="strat-info"') && page.includes('data-show-strategy'));
  // The parliament: every vote as a seat, with faction chips and seat details.
  assert.ok(!page.includes('id="parliament"'), 'the seat chart gives way to the vote (G-69, G-71)');
  // Chart tools: indicators one by one (no presets), an indicator sheet and a strategy sheet.
  assert.ok(!page.includes('data-preset="momentum"') && page.includes('id="ind-reset"'));
  for (const s of ['id="ind-sheet"', 'id="strat-sheet"', 'id="active-pills"']) assert.ok(page.includes(s), s);
  // Chart v6: drawing tools, day/week/month and the index comparison (the benchmark series is embedded).
  assert.ok(page.includes('data-draw="fib"') && page.includes('data-tf="W"') && page.includes('data-compare') && page.includes('id="benchmarks"') && page.includes('window.GNMChart'));
  // UI layer: price in the header after scrolling, a bottom tab bar, glossary terms, the indicator names marked for it.
  assert.ok(page.includes('id="price-bar"') && page.includes('class="bottom-nav"') && page.includes('assets/ui.js?v=') && UI_JS.includes('"몬테카를로"') && APP_CSS.includes('.chat-fab') && page.includes('class="term-cell"'));
  // Plans: details sit behind Plus gates; anyone can ask the AI with credits.
  assert.ok((page.match(/class="gate" data-need="plus"/g) ?? []).length >= 2, 'plus gates');
  assert.ok((page.match(/class="gate" data-need="pro"/g) ?? []).length >= 2, 'pro gates');
  assert.ok(page.includes('data-plan="free"'), 'free plan');
  assert.ok(!page.includes('class="card hs"'), 'the horizon strip lives on the 자료 tab only (G-71)');
  assert.ok(page.includes('id="vlines"') && page.includes('id="ev-strip"') && page.includes('class="trade-log"'));
  // The front page is the live dashboard; the archive lists dated reports.
  const front = await readFile(join(root, 'site', '000660', 'index.html'), 'utf8');
  assert.ok(front.includes('class="fresh '));
  assert.match(await readFile(join(root, 'site', '000660', 'archive.html'), 'utf8'), /reports\/2026-10-02\.html/);
  // The forecast made with the report is logged once.
  const log = (await readFile(join(root, 'data', 'forecasts', '000660.jsonl'), 'utf8')).trim().split('\n');
  assert.equal(log.length, 4);
});

test('freshness: live, stale by weekdays, degraded, not available', async () => {
  const { freshness, weekdaysBetween } = await import('./appParts.js');
  assert.equal(weekdaysBetween('2026-10-02', '2026-10-05'), 1); // Fri → Mon
  const base = { date: '2026-10-05', generatedAt: '2026-10-05T09:30:00Z', price: { close: 1, sessionDate: '2026-10-05' }, market: { status: [] } } as never;
  assert.equal(freshness(base).state, 'LIVE');
  assert.equal(freshness({ ...(base as object), price: { close: 1, sessionDate: '2026-10-01' } } as never).label, '2거래일 전 데이터');
  // Before 16:00 KST, Friday's close is still the latest on Monday.
  assert.equal(freshness({ ...(base as object), generatedAt: '2026-10-05T01:00:00Z', price: { close: 1, sessionDate: '2026-10-02' } } as never).state, 'LIVE');
  assert.equal(freshness({ ...(base as object), market: { status: [{ source: 'x', ok: false, count: 0 }] } } as never).state, 'DEGRADED');
  assert.equal(freshness({ ...(base as object), price: null } as never).state, 'NOT_AVAILABLE');
});
