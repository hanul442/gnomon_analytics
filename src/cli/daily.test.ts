import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { kstParts, runDaily } from './daily.js';

const FEED = `<chartdata symbol="000660">
<item data="20261001|309000|314000|308000|311000|2900000" />
<item data="20261002|312000|320500|311000|318500|3512880" />
</chartdata>`;
const DART = { status: '000', total_page: 1, list: [{ corp_name: 'SK하이닉스', stock_code: '000660', report_nm: '주요사항보고서(자기주식취득결정)', rcept_no: '20261002000123', flr_nm: 'SK하이닉스', rcept_dt: '20261002', rm: '유' }] };
const RSS = `<rss><channel><item><title>SK하이닉스, HBM4 양산 돌입 - 전자신문</title><link>https://news.google.com/rss/articles/1</link><pubDate>Fri, 02 Oct 2026 06:00:00 GMT</pubDate><source url="https://www.etnews.com">전자신문</source></item></channel></rss>`;
const NAVER_NEWS = { items: [{ title: '<b>SK하이닉스</b> 3분기 영업이익 사상 최대', originallink: 'https://www.yna.co.kr/view/1', link: '', pubDate: 'Fri, 02 Oct 2026 16:00:00 +0900' }] };
const fakeFetch = (async (url: string | URL | Request) => {
  const u = String(url);
  if (u.includes('openapi.naver.com')) return new Response(JSON.stringify(NAVER_NEWS));
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
  assert.deepEqual({ ...result, newsStatus: undefined }, { addedBars: 2, addedFilings: 1, addedNews: 2, newsStatus: undefined, report: 'NOT_SETTLED' });
  assert.deepEqual(result.newsStatus.map((st) => st.ok), [true, true, true]);
});

test('a settled run writes the report once and renders the site', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const first = await runDaily({ root, now: new Date('2026-10-02T09:30:00Z'), apiKey: 'k', fetch: fakeFetch, naver });
  assert.equal(first.report, 'WRITTEN');
  const stored = await readFile(join(root, 'reports', '2026-10-02.json'), 'utf8');
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
