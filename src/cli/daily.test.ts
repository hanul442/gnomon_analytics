import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { kstParts, runDaily } from './daily.js';
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

test('KST date and hour', () => {
  assert.deepEqual(kstParts(new Date('2026-10-02T09:30:00Z')), { date: '2026-10-02', compact: '20261002', hour: 18 });
  assert.equal(kstParts(new Date('2026-10-02T15:30:00Z')).date, '2026-10-03');
});

test('a daily run before 18:00 KST collects but does not freeze a report', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const result = await runDaily({ root, now: new Date('2026-10-02T05:00:00Z'), apiKey: 'k', fetch: fakeFetch, naver });
  assert.deepEqual({ ...result, newsStatus: undefined, marketStatus: undefined }, { addedBars: 2, addedFilings: 1, addedNews: 2, newsStatus: undefined, marketStatus: undefined, report: 'NOT_SETTLED' });
  assert.deepEqual(result.newsStatus.map((st) => st.ok), [true, true, true]);
  // Stage A sources: all collected; 60 flow days + 1 snapshot + 10 finance periods + 5 research notes.
  assert.deepEqual(result.marketStatus.map((st) => [st.source, st.ok]), [
    ['naver:fchart:week', true], ['naver:fchart:minute', true], ['naver:fchart:day:KOSPI', true], ['naver:fchart:day:005930', true], ['naver:m-stock', true],
  ]);
  assert.equal(result.marketStatus.at(-1)!.count, 60 + 1 + 10 + 5);
});

test('a settled run writes the report once and renders the site', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const first = await runDaily({ root, now: new Date('2026-10-02T09:30:00Z'), apiKey: 'k', fetch: fakeFetch, naver });
  assert.equal(first.report, 'WRITTEN');
  const stored = await readFile(join(root, 'reports', '2026-10-02.json'), 'utf8');
  const market = (JSON.parse(stored) as DailyReport).market!;
  assert.deepEqual(market.horizons.map((h) => h.label), ['초단기', '단기', '중기', '중장기', '장기']);
  assert.equal(market.flows?.days.at(-1)?.foreignNet, -115492);
  assert.equal(market.snapshot?.consensus?.targetPriceMean, 3276957);
  assert.equal(market.quarters.at(-1)?.isEstimate, true);
  assert.deepEqual(market.benchmarks.map((b) => b.name), ['코스피', '삼성전자']);
  const second = await runDaily({ root, now: new Date('2026-10-02T11:00:00Z'), apiKey: 'k', fetch: fakeFetch });
  assert.equal(second.report, 'EXISTS');
  assert.deepEqual([second.addedBars, second.addedFilings, second.addedNews], [0, 0, 0]);
  // Without Naver keys the run still succeeds and records the gap.
  assert.equal(second.newsStatus[0]?.error, 'NAVER_API_KEY_MISSING');
  assert.equal(await readFile(join(root, 'reports', '2026-10-02.json'), 'utf8'), stored);
  const page = await readFile(join(root, 'site', 'reports', '2026-10-02.html'), 'utf8');
  assert.ok(page.includes('318,500원'));
  assert.ok(page.includes('자사주'));
  assert.ok(page.includes('HBM4 양산 돌입'));
  assert.ok(page.includes('3분기 영업이익 사상 최대'));
  assert.match(await readFile(join(root, 'site', 'index.html'), 'utf8'), /2026-10-02/);
  assert.match(await readFile(join(root, 'site', 'assets', 'lightweight-charts.js'), 'utf8'), /LightweightCharts/);
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
  }) } } } as unknown as Parameters<typeof runDaily>[0]['anthropic'];
  await runDaily({ root, now: new Date('2026-10-02T09:30:00Z'), apiKey: 'k', fetch: fakeFetch, ...(anthropic ? { anthropic } : {}) });
  const lines = (await readFile(join(root, 'data', 'analysts', '000660.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
  assert.equal(lines.length, 1);
  assert.deepEqual([lines[0]!.analyst, lines[0]!.baseDate, lines[0]!.baseClose, lines[0]!.target], ['trend_momentum', '2026-10-02', 318500, 330000]);
});
