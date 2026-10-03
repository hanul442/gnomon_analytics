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
const fakeFetch = (async (url: string | URL | Request) =>
  String(url).includes('naver') ? new Response(FEED) : new Response(JSON.stringify(DART))) as typeof fetch;

test('KST date and hour', () => {
  assert.deepEqual(kstParts(new Date('2026-10-02T09:30:00Z')), { date: '2026-10-02', compact: '20261002', hour: 18 });
  assert.equal(kstParts(new Date('2026-10-02T15:30:00Z')).date, '2026-10-03');
});

test('a daily run before 18:00 KST collects but does not freeze a report', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const result = await runDaily({ root, now: new Date('2026-10-02T05:00:00Z'), apiKey: 'k', fetch: fakeFetch });
  assert.deepEqual(result, { addedBars: 2, addedFilings: 1, report: 'NOT_SETTLED' });
});

test('a settled run writes the report once and renders the site', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const first = await runDaily({ root, now: new Date('2026-10-02T09:30:00Z'), apiKey: 'k', fetch: fakeFetch });
  assert.equal(first.report, 'WRITTEN');
  const stored = await readFile(join(root, 'reports', '2026-10-02.json'), 'utf8');
  const second = await runDaily({ root, now: new Date('2026-10-02T11:00:00Z'), apiKey: 'k', fetch: fakeFetch });
  assert.deepEqual(second, { addedBars: 0, addedFilings: 0, report: 'EXISTS' });
  assert.equal(await readFile(join(root, 'reports', '2026-10-02.json'), 'utf8'), stored);
  const page = await readFile(join(root, 'site', 'reports', '2026-10-02.html'), 'utf8');
  assert.ok(page.includes('318,500원'));
  assert.ok(page.includes('자사주'));
  assert.match(await readFile(join(root, 'site', 'index.html'), 'utf8'), /2026-10-02/);
  assert.match(await readFile(join(root, 'site', 'assets', 'lightweight-charts.js'), 'utf8'), /LightweightCharts/);
});
