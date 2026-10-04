import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runDaily } from './daily.js';
import { loadTickers } from '../config/tickers.js';
import { DEFAULT_SELECTION } from '../analysis/selection.js';

const FIX = join(process.cwd(), 'test', 'fixtures', 'naver');
const M_STOCK: [string, string][] = [['/trend', 'trend.json'], ['/integration', 'integration.json'], ['/finance/quarter', 'finance-quarter.json'], ['/finance/annual', 'finance-annual.json']];
const day = (i: number) => new Date(Date.UTC(2026, 6, 18) + i * 86_400_000).toISOString().slice(0, 10).replaceAll('-', '');
// 80 sessions; 222220 jumps in the last five on heavy volume.
const feed = (symbol: string) => `<chartdata symbol="${symbol}">${Array.from({ length: 80 }, (_, i) => {
  const c = symbol === '222220' && i >= 75 ? 10000 + (i - 74) * 500 : 10000;
  const v = symbol === '222220' && i >= 75 ? 300000 : 100000;
  return `<item data="${day(i)}|${c}|${c}|${c}|${c}|${v}" />`;
}).join('')}</chartdata>`;
const listed = (code: string, name: string, cap = '100,000') => ({ itemCode: code, stockName: name, stockEndType: 'stock', closePrice: '10,000', fluctuationsRatio: '1.0', accumulatedTradingValue: '100,000', marketValue: cap });
const fake = (async (url: string | URL | Request) => {
  const u = String(url);
  if (u.includes('/stocks/marketValue/KOSPI')) return new Response(JSON.stringify({ stocks: [listed('000660', 'SK하이닉스'), listed('111110', '조용한전자', '300,000'), listed('222220', '뛰는바이오')], totalCount: 3 }));
  if (u.includes('/stocks/marketValue/KOSDAQ')) return new Response(JSON.stringify({ stocks: [], totalCount: 0 }));
  const m = M_STOCK.find(([path]) => u.includes('m.stock.naver.com') && u.includes(path));
  if (m) return new Response(await readFile(join(FIX, m[1]), 'utf8'));
  if (u.includes('fchart.stock.naver')) return new Response(feed(/symbol=([^&]+)/.exec(u)?.[1] ?? 'X'));
  if (u.includes('corpCode.xml')) return new Response('', { status: 500 });
  if (u.includes('list.json') && u.includes('corp_cls=Y')) return new Response(JSON.stringify({ status: '000', total_page: 1, list: [{ corp_name: '조용한전자', stock_code: '111110', report_nm: '연결재무제표기준영업(잠정)실적(공정공시)', rcept_no: '20261002000999', flr_nm: '조용한전자', rcept_dt: '20261002' }] }));
  if (u.includes('list.json')) return new Response(JSON.stringify({ status: '013' }));
  return new Response('<rss><channel></channel></rss>');
}) as typeof fetch;

test('the first settled run picks the week: core and the largest company get the committee, the rest a brief', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const tickers = (await loadTickers(join(process.cwd(), 'tickers.json'))).filter((t) => t.symbol === '000660');
  const models: string[] = [];
  const anthropic = { beta: { messages: { parse: async (req: { model: string }) => { models.push(req.model); return { stop_reason: 'end_turn', model: req.model, usage: { input_tokens: 100, output_tokens: 50 }, parsed_output: { summary: { text: '요약', evidenceIds: ['P1'] }, desks: [], scenarios: [], analysts: [], bullish: [], bearish: [], uncertain: [], watch: [], dataGaps: [] } }; } } } } as never;
  const params = { ...DEFAULT_SELECTION, size: 3, bigCaps: 1 };
  const out = await runDaily({ root, now: new Date('2026-10-02T09:30:00Z'), apiKey: 'k', fetch: fake, tickers, anthropic, selectionParams: params });
  assert.equal(out.selected, '2026-10-02');
  const sel = JSON.parse(await readFile(join(root, 'data', 'selections', '2026-10-02.json'), 'utf8')) as { picks: { symbol: string; tier: string; reasons: string[] }[] };
  assert.deepEqual(sel.picks.map((p) => [p.symbol, p.tier]), [['000660', 'deep'], ['111110', 'deep'], ['222220', 'brief']]);
  assert.deepEqual(sel.picks[1]!.reasons, ['시가총액 상위 (30조원)']);
  assert.deepEqual(out.results.map((r) => [r.symbol, r.report]), [['000660', 'WRITTEN'], ['111110', 'WRITTEN'], ['222220', 'WRITTEN']]);
  assert.deepEqual(models.sort(), ['claude-haiku-4-5', 'claude-opus-5-5', 'claude-opus-5-5']);
  const report = JSON.parse(await readFile(join(root, 'reports', '222220', '2026-10-02.json'), 'utf8')) as { commentary: { tier: string; usage: unknown } };
  assert.deepEqual([report.commentary.tier, report.commentary.usage], ['brief', { inputTokens: 100, outputTokens: 50 }]);
  const home = await readFile(join(root, 'site', 'index.html'), 'utf8');
  assert.ok(home.includes('이번 주 AI 리포트 3종목') && home.includes('href="222220/index.html"') && home.includes('data-kind="weekly"'));
  // The market dashboard: index quotes, temperature from every stock's computation, movers; pricing pages exist.
  assert.ok(home.includes('시장 온도') && home.includes('id="movers"') && home.includes('id="watch"'));
  assert.ok((await readFile(join(root, 'site', 'pricing.html'), 'utf8')).includes('플러스') && (await readFile(join(root, 'site', 'checkout.html'), 'utf8')).includes('MOCK'));
  // Monday: no new selection and no AI; every page is a live dashboard and no dated report is kept.
  models.length = 0;
  const again = await runDaily({ root, now: new Date('2026-10-05T09:30:00Z'), apiKey: 'k', fetch: fake, tickers, anthropic, selectionParams: params });
  assert.equal(again.selected, null);
  assert.deepEqual(models, []);
  assert.deepEqual(again.results.map((r) => [r.symbol, r.report]), [['000660', 'SKIPPED'], ['111110', 'SKIPPED'], ['222220', 'SKIPPED']]);
  // Core stocks still log forecasts and the paper ledger on a trading day without a report.
  const paper = (await readFile(join(root, 'data', 'paper', '000660.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l) as { date: string });
  assert.ok(paper.some((p) => p.date === '2026-10-05'));
  // The live page carries the latest committee's commentary with its date.
  assert.match(await readFile(join(root, 'site', '000660', 'index.html'), 'utf8'), /2026-10-02 리포트의 AI 위원회 해설/);
});

test('a requested stock gets one deep committee report, then dashboards only', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const tickers = (await loadTickers(join(process.cwd(), 'tickers.json'))).filter((t) => t.symbol === '000660');
  const calls: string[] = [];
  const anthropic = { beta: { messages: { parse: async (req: { model: string; messages: { content: string }[] }) => { calls.push(/"종목": "([^"]+)"/.exec(req.messages[0]!.content)?.[1] ?? '?'); return { stop_reason: 'end_turn', model: req.model, parsed_output: { summary: { text: '요약', evidenceIds: ['P1'] }, desks: [], scenarios: [], analysts: [], bullish: [], bearish: [], uncertain: [], watch: [], dataGaps: [] } }; } } } } as never;
  const opts = { root, apiKey: 'k', fetch: fake, tickers, anthropic, requests: [{ symbol: '111110', requestedAt: '2026-10-02' }], selectionParams: { ...DEFAULT_SELECTION, size: 1, bigCaps: 0 } };
  await runDaily({ ...opts, now: new Date('2026-10-02T09:30:00Z') });
  assert.deepEqual(calls.sort(), ['SK하이닉스 (000660)', '조용한전자 (111110)']);
  const home = await readFile(join(root, 'site', 'index.html'), 'utf8');
  assert.ok(home.includes('data-kind="request"') && home.includes('href="111110/index.html"'));
  // Stocks without a report get chart data for the shared, locked stock page.
  const page = JSON.parse(await readFile(join(root, 'site', 's', '222220.json'), 'utf8')) as { name: string; bars: unknown[] };
  assert.deepEqual([page.name, page.bars.length], ['뛰는바이오', 80]);
  await assert.rejects(readFile(join(root, 'site', 's', '111110.json')));
  const stockPage = await readFile(join(root, 'site', 'stock.html'), 'utf8');
  assert.ok(stockPage.includes('data-spend="report"') && stockPage.includes('class="gate"') && stockPage.includes('class="card locked"'));
  // Every stock page carries the free computation: signal, one line, moves, fair value, forecasts.
  const calc = (page as unknown as { calc: { signal: { label: string }; line: string; moves: unknown[]; forecasts: unknown[] } }).calc;
  assert.ok(calc.signal.label && calc.line.includes('기술 신호') && calc.moves.length === 3 && Array.isArray(calc.forecasts), JSON.stringify(calc).slice(0, 200));
  calls.length = 0;
  await runDaily({ ...opts, now: new Date('2026-10-05T09:30:00Z') });
  assert.deepEqual(calls, []);
});
