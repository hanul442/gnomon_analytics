import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { kstParts, runDaily } from './daily.js';
import { loadTickers } from '../config/tickers.js';
import type { DailyReport } from '../report/dailyReport.js';

const FEED = `<chartdata symbol="000660">
<item data="20261001|309000|314000|308000|311000|2900000" />
<item data="20261002|312000|320500|311000|318500|3512880" />
</chartdata>`;
const DART = { status: '000', total_page: 1, list: [{ corp_name: 'SK하이닉스', stock_code: '000660', report_nm: '주요사항보고서(자기주식취득결정)', rcept_no: '20261002000123', flr_nm: 'SK하이닉스', rcept_dt: '20261002', rm: '유' }] };
const RSS = `<rss><channel><item><title>SK하이닉스, HBM4 양산 돌입 - 전자신문</title><link>https://news.google.com/rss/articles/1</link><pubDate>Fri, 02 Oct 2026 06:00:00 GMT</pubDate><source url="https://www.etnews.com">전자신문</source></item></channel></rss>`;
const NAVER_NEWS = { items: [{ title: '<b>SK하이닉스</b> 3분기 영업이익 사상 최대', originallink: 'https://www.yna.co.kr/view/1', link: '', pubDate: 'Fri, 02 Oct 2026 16:00:00 +0900' }] };
const FIXTURES = join(process.cwd(), 'test', 'fixtures', 'naver');
const M_STOCK: [string, string][] = [['/trend', 'trend.json'], ['/integration', 'integration.json'], ['/finance/quarter', 'finance-quarter.json'], ['/finance/annual', 'finance-annual.json']];
const fakeFetch = (async (url: string | URL | Request) => {
  const u = String(url);
  const m = M_STOCK.find(([path]) => u.includes('m.stock.naver.com') && u.includes(path));
  if (m) return new Response(await readFile(join(FIXTURES, m[1]), 'utf8'));
  if (u.includes('naverapihub.apigw.ntruss.com')) return new Response(JSON.stringify(NAVER_NEWS));
  if (u.includes('fchart.stock.naver')) return new Response(FEED);
  if (u.includes('news.google.com') || u.includes('mk.co.kr')) return new Response(RSS);
  return new Response(JSON.stringify(DART));
}) as typeof fetch;
const naver = { clientId: 'id', clientSecret: 'secret' };
// The real config, SK하이닉스 only (the fixtures are its data).
const tickers = (await loadTickers(join(process.cwd(), 'tickers.json'))).filter((t) => t.symbol === '000660');
const run = async (options: Omit<Parameters<typeof runDaily>[0], 'tickers'>) => (await runDaily({ ...options, tickers })).results[0]!;

test('KST date and hour', () => {
  assert.deepEqual(kstParts(new Date('2026-10-02T09:30:00Z')), { date: '2026-10-02', compact: '20261002', hour: 18 });
  assert.equal(kstParts(new Date('2026-10-02T15:30:00Z')).date, '2026-10-03');
});

test('a daily run before 18:00 KST collects but does not freeze a report', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const result = await run({ root, now: new Date('2026-10-02T05:00:00Z'), apiKey: 'k', fetch: fakeFetch, naver });
  assert.deepEqual({ ...result, newsStatus: undefined, marketStatus: undefined }, { symbol: '000660', addedBars: 2, addedFilings: 1, addedNews: 2, newsStatus: undefined, marketStatus: undefined, report: 'NOT_SETTLED' });
  assert.deepEqual(result.newsStatus.map((st) => st.ok), [true, true, true]);
  // Stage A sources: all collected; 60 flow days + 1 snapshot + 10 finance periods + 5 research notes.
  assert.deepEqual(result.marketStatus.map((st) => [st.source, st.ok]), [
    ['naver:fchart:week', true], ['naver:fchart:minute', true], ['naver:m-stock', true], ['naver:fchart:day:KOSPI', true], ['naver:fchart:day:005930', true],
  ]);
  assert.equal(result.marketStatus.find((st) => st.source === 'naver:m-stock')!.count, 60 + 1 + 10 + 5);
});

test('a settled run writes the report once and renders the site', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const first = await run({ root, now: new Date('2026-10-02T09:30:00Z'), apiKey: 'k', fetch: fakeFetch, naver });
  assert.equal(first.report, 'WRITTEN');
  const stored = await readFile(join(root, 'reports', '000660', '2026-10-02.json'), 'utf8');
  const market = (JSON.parse(stored) as DailyReport).market!;
  assert.deepEqual(market.horizons.map((h) => h.label), ['초단기', '단기', '중기', '중장기', '장기']);
  assert.equal(market.flows?.days.at(-1)?.foreignNet, -115492);
  assert.equal(market.snapshot?.consensus?.targetPriceMean, 3276957);
  assert.equal(market.quarters.at(-1)?.isEstimate, true);
  assert.deepEqual(market.benchmarks.map((b) => b.name), ['코스피', '삼성전자']);
  const second = await run({ root, now: new Date('2026-10-02T11:00:00Z'), apiKey: 'k', fetch: fakeFetch });
  assert.equal(second.report, 'EXISTS');
  assert.deepEqual([second.addedBars, second.addedFilings, second.addedNews], [0, 0, 0]);
  // Without Naver keys the run still succeeds and records the gap.
  assert.equal(second.newsStatus[0]?.error, 'NAVER_API_KEY_MISSING');
  assert.equal(await readFile(join(root, 'reports', '000660', '2026-10-02.json'), 'utf8'), stored);
  const page = await readFile(join(root, 'site', '000660', 'reports', '2026-10-02.html'), 'utf8');
  assert.ok(page.includes('318,500원'));
  assert.ok(page.includes('자사주'));
  assert.ok(page.includes('HBM4 양산 돌입'));
  assert.ok(page.includes('3분기 영업이익 사상 최대'));
  assert.match(await readFile(join(root, 'site', '000660', 'index.html'), 'utf8'), /2026-10-02/);
  // The site root lists the covered stocks.
  const home = await readFile(join(root, 'site', 'index.html'), 'utf8');
  assert.ok(home.includes('href="000660/index.html"') && home.includes('SK하이닉스'));
  // Search covers listed stocks; without a list this run it still has the covered ones.
  assert.ok(home.includes('id="q"'));
  const search = JSON.parse(await readFile(join(root, 'site', 'search.json'), 'utf8')) as { items: unknown[][] };
  assert.deepEqual(search.items.find((i) => i[0] === '000660'), ['000660', 'SK하이닉스', 'KOSPI', null, null, 1]);
  assert.match(await readFile(join(root, 'site', 'assets', 'lightweight-charts.js'), 'utf8'), /LightweightCharts/);
});

test('a holiday keeps no dated report and spends no AI call', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  let calls = 0;
  const anthropic = { beta: { messages: { parse: async () => { calls += 1; throw new Error('should not be called'); } } } } as never;
  // Saturday 10/3: the last session is Friday 10/2.
  const result = await run({ root, now: new Date('2026-10-03T09:30:00Z'), apiKey: 'k', fetch: fakeFetch, naver, anthropic });
  assert.equal(result.report, 'SKIPPED');
  assert.equal(calls, 0);
  await assert.rejects(readFile(join(root, 'reports', '000660', '2026-10-03.json')));
});

test('one stock failing does not stop the others', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const broken = { ...tickers[0]!, symbol: '999990', name: '없는종목' };
  const failing = (async (url: string | URL | Request) => (String(url).includes('999990') ? new Response('', { status: 500 }) : fakeFetch(url))) as typeof fetch;
  const out = await runDaily({ root, now: new Date('2026-10-02T05:00:00Z'), apiKey: 'k', fetch: failing, naver, tickers: [broken, ...tickers] });
  assert.deepEqual(out.results.map((r) => r.symbol), ['000660']);
  assert.deepEqual(out.failed.map((f) => f.symbol), ['999990']);
  const home = await readFile(join(root, 'site', 'index.html'), 'utf8');
  const list = await readFile(join(root, 'site', 'reports.html'), 'utf8');
  assert.ok(list.includes('없는종목') && list.includes('가격 기록 없음'));
  await assert.rejects(runDaily({ root, now: new Date('2026-10-02T05:00:00Z'), apiKey: 'k', fetch: failing, naver, tickers: [broken] }), /every stock failed/);
});

test('analyst calls from the AI committee are logged once with the report', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const anthropic = { beta: { messages: { parse: async () => ({
    stop_reason: 'end_turn', model: 'm',
    parsed_output: {
      summary: { text: '요약', evidenceIds: ['P1'] }, desks: [], redTeam: { counterargument: { text: '반론', evidenceIds: ['P1'] }, unresolved: [] }, scenarios: [],
      analysts: [{ analyst: 'trend_momentum', stance: 'BULLISH', confidence: 70, target: 330000, rationale: { text: '추세', evidenceIds: ['P1'] } }],
      bullish: [], bearish: [], uncertain: [], watch: [], dataGaps: [],
    },
  }) } } } as unknown as Parameters<typeof run>[0]['anthropic'];
  await run({ root, now: new Date('2026-10-02T09:30:00Z'), apiKey: 'k', fetch: fakeFetch, ...(anthropic ? { anthropic } : {}) });
  const lines = (await readFile(join(root, 'data', 'analysts', '000660.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
  assert.equal(lines.length, 1);
  assert.deepEqual([lines[0]!.analyst, lines[0]!.baseDate, lines[0]!.baseClose, lines[0]!.target], ['trend_momentum', '2026-10-02', 318500, 330000]);
  // The paper ledger records buy-and-hold and the analyst from the same close (two bars are too few for a strategy champion).
  const paper = (await readFile(join(root, 'data', 'paper', '000660.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
  assert.deepEqual(paper.map((p) => [p.follower, p.date, p.close]), [['hold', '2026-10-02', 318500], ['analyst:trend_momentum', '2026-10-02', 318500]]);
  assert.equal(paper[1]!.position, 1);
});
