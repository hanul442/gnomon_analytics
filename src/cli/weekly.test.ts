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
const day = (i: number) => new Date(Date.UTC(2026, 5, 1) + i * 86_400_000).toISOString().slice(0, 10).replaceAll('-', '');
// 80 sessions; 222220 jumps in the last five on heavy volume.
const feed = (symbol: string) => `<chartdata symbol="${symbol}">${Array.from({ length: 80 }, (_, i) => {
  const c = symbol === '222220' && i >= 75 ? 10000 + (i - 74) * 500 : 10000;
  const v = symbol === '222220' && i >= 75 ? 300000 : 100000;
  return `<item data="${day(i)}|${c}|${c}|${c}|${c}|${v}" />`;
}).join('')}</chartdata>`;
const listed = (code: string, name: string) => ({ itemCode: code, stockName: name, stockEndType: 'stock', closePrice: '10,000', fluctuationsRatio: '1.0', accumulatedTradingValue: '100,000', marketValue: '100,000' });
const fake = (async (url: string | URL | Request) => {
  const u = String(url);
  if (u.includes('/stocks/marketValue/KOSPI')) return new Response(JSON.stringify({ stocks: [listed('000660', 'SK하이닉스'), listed('111110', '조용한전자'), listed('222220', '뛰는바이오')], totalCount: 3 }));
  if (u.includes('/stocks/marketValue/KOSDAQ')) return new Response(JSON.stringify({ stocks: [], totalCount: 0 }));
  const m = M_STOCK.find(([path]) => u.includes('m.stock.naver.com') && u.includes(path));
  if (m) return new Response(await readFile(join(FIX, m[1]), 'utf8'));
  if (u.includes('fchart.stock.naver')) return new Response(feed(/symbol=([^&]+)/.exec(u)?.[1] ?? 'X'));
  if (u.includes('corpCode.xml')) return new Response('', { status: 500 });
  if (u.includes('list.json') && u.includes('corp_cls=Y')) return new Response(JSON.stringify({ status: '000', total_page: 1, list: [{ corp_name: '조용한전자', stock_code: '111110', report_nm: '연결재무제표기준영업(잠정)실적(공정공시)', rcept_no: '20261002000999', flr_nm: '조용한전자', rcept_dt: '20261002' }] }));
  if (u.includes('list.json')) return new Response(JSON.stringify({ status: '013' }));
  return new Response('<rss><channel></channel></rss>');
}) as typeof fetch;

test('the first settled run picks the week: core first, deep and brief AI by tier, cards on the front page', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const tickers = (await loadTickers(join(process.cwd(), 'tickers.json'))).filter((t) => t.symbol === '000660');
  const models: string[] = [];
  const anthropic = { beta: { messages: { parse: async (req: { model: string }) => { models.push(req.model); return { stop_reason: 'end_turn', model: req.model, usage: { input_tokens: 100, output_tokens: 50 }, parsed_output: { summary: { text: '요약', evidenceIds: ['P1'] }, desks: [], scenarios: [], analysts: [], bullish: [], bearish: [], uncertain: [], watch: [], dataGaps: [] } }; } } } } as never;
  const out = await runDaily({ root, now: new Date('2026-10-02T09:30:00Z'), apiKey: 'k', fetch: fake, tickers, anthropic, selectionParams: { ...DEFAULT_SELECTION, size: 3, deep: 2 } });
  assert.equal(out.selected, '2026-10-02');
  const sel = JSON.parse(await readFile(join(root, 'data', 'selections', '2026-10-02.json'), 'utf8')) as { picks: { symbol: string; tier: string; reasons: string[] }[] };
  assert.deepEqual(sel.picks.map((p) => [p.symbol, p.tier]), [['000660', 'deep'], ['222220', 'deep'], ['111110', 'brief']]);
  assert.ok(sel.picks[2]!.reasons.some((r) => r.includes('영업(잠정)실적')));
  assert.deepEqual(out.results.map((r) => [r.symbol, r.report]), [['000660', 'WRITTEN'], ['222220', 'WRITTEN'], ['111110', 'WRITTEN']]);
  assert.deepEqual(models.sort(), ['claude-opus-5-5', 'claude-opus-5-5', 'claude-sonnet-5-5']);
  const report = JSON.parse(await readFile(join(root, 'reports', '111110', '2026-10-02.json'), 'utf8')) as { commentary: { tier: string; usage: unknown } };
  assert.deepEqual([report.commentary.tier, report.commentary.usage], ['brief', { inputTokens: 100, outputTokens: 50 }]);
  const home = await readFile(join(root, 'site', 'index.html'), 'utf8');
  assert.ok(home.includes('이번 주 선정 2종목') && home.includes('href="222220/index.html"') && home.includes('5거래일 +25.0%'));
  // The next run the same week: no new selection, picks keep their pages, no AI for them.
  models.length = 0;
  const again = await runDaily({ root, now: new Date('2026-10-05T09:30:00Z'), apiKey: 'k', fetch: fake, tickers, anthropic, selectionParams: { ...DEFAULT_SELECTION, size: 3, deep: 2 } });
  assert.equal(again.selected, null);
  assert.deepEqual(models, ['claude-opus-5-5']);
});
