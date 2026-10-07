import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { koreanAmount, num, parseFinance, parseInvestorFlows, parseResearch, parseSnapshot } from './naverStock.js';

// Real responses saved from GitHub Actions on 2026-10-04 (test/fixtures/naver).
const fixture = async (name: string) => JSON.parse(await readFile(join(process.cwd(), 'test', 'fixtures', 'naver', name), 'utf8')) as unknown;
const at = new Date('2026-10-04T05:37:00Z');

test('display strings become numbers, unreadable ones null', () => {
  assert.equal(num('+76,049'), 76049);
  assert.equal(num('-115,492'), -115492);
  assert.equal(num('49.75%'), 49.75);
  assert.equal(num('8.21배'), 8.21);
  assert.equal(num('224,313원'), 224313);
  assert.equal(num('-'), null);
  assert.equal(num('N/A'), null);
  assert.equal(koreanAmount('1,345조 5,669억'), 1345e12 + 5669e8);
  assert.equal(koreanAmount('5조 3,260억'), 5e12 + 3260e8);
});

test('investor flows: 60 days, oldest first, signed shares', async () => {
  const flows = parseInvestorFlows(await fixture('trend.json'), '000660', at);
  assert.equal(flows.length, 60);
  assert.equal(flows[0]!.date, '2026-07-07');
  const last = flows.at(-1)!;
  assert.deepEqual(
    [last.date, last.foreignNet, last.institutionNet, last.individualNet, last.foreignHoldRatio, last.close, last.volume],
    ['2026-10-02', -115492, 76049, -452221, 49.75, 1842000, 2014287],
  );
});

test('snapshot: valuation and securities-firm consensus', async () => {
  const s = parseSnapshot(await fixture('integration.json'), '000660', '2026-10-04', at);
  assert.equal(s.per, 8.21);
  assert.equal(s.estimatedPer, 5.25);
  assert.equal(s.pbr, 4.99);
  assert.equal(s.eps, 224313);
  assert.equal(s.high52w, 3002000);
  assert.equal(s.marketCap, 1345e12 + 5669e8);
  assert.deepEqual(s.consensus, { date: '2026-10-01', targetPriceMean: 3276957, recommendationMean: 4 });
});

test('research listings keep title, firm and date only', async () => {
  const notes = parseResearch(await fixture('integration.json'), '000660', at);
  assert.equal(notes.length, 5);
  assert.deepEqual([notes[0]!.id, notes[0]!.broker, notes[0]!.title, notes[0]!.date], ['96384', '신한투자증권', '흔들림 없는 실적 우상향', '2026-09-30']);
});

test('finance: one record per period, estimates flagged', async () => {
  const quarters = parseFinance(await fixture('finance-quarter.json'), '000660', 'QUARTER', at);
  assert.deepEqual(quarters.map((q) => q.period), ['202506', '202509', '202512', '202603', '202606', '202609']);
  assert.deepEqual(quarters.map((q) => q.isEstimate), [false, false, false, false, false, true]);
  assert.equal(quarters[4]!.metrics['영업이익'], 605426);
  assert.equal(quarters[5]!.metrics['지배주주순이익'], null);
  const years = parseFinance(await fixture('finance-annual.json'), '000660', 'ANNUAL', at);
  assert.equal(years.at(-1)!.period, '202612');
  assert.ok('ROE' in years[0]!.metrics);
});

test('unexpected payloads fail loudly', () => {
  assert.throws(() => parseInvestorFlows({ error: 'x' }, '000660', at), /NAVER_FLOW_UNEXPECTED_RESPONSE/);
  assert.throws(() => parseSnapshot('<html>', '000660', '2026-10-04', at), /NAVER_SNAPSHOT_UNEXPECTED_RESPONSE/);
  assert.throws(() => parseFinance({}, '000660', 'QUARTER', at), /NAVER_FINANCE_UNEXPECTED_RESPONSE/);
});

test('parseStockNews keeps one article per cluster with a Naver mobile link', async () => {
  const { parseStockNews } = await import('./naverStock.js');
  const rows = parseStockNews([{ total: 2, items: [{ officeName: '연합뉴스', datetime: '202610072010', title: '&quot;한전&quot; 지원', body: '본문 <b>요약</b>', mobileNewsUrl: 'https://n.news.naver.com/mnews/article/001/1' }] }, { total: 1, items: [{ title: 'x', datetime: 'bad', mobileNewsUrl: 'https://n.news.naver.com/a' }] }, { items: [{ title: 'y', datetime: '202610071200', mobileNewsUrl: 'https://evil.example/a' }] }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.title, '"한전" 지원');
  assert.equal(rows[0]!.at, '2026-10-07 20:10');
  assert.equal(rows[0]!.summary, '본문 요약');
});

test('parseStockDisclosures reads id, title, time and author', async () => {
  const { parseStockDisclosures } = await import('./naverStock.js');
  const rows = parseStockDisclosures([{ disclosureId: 147761921, title: '풍문 또는 보도에 대한 해명', datetime: '2026-10-02T11:11:29', author: 'KOSCOM' }, { title: 'no id' }]);
  assert.deepEqual(rows, [{ id: '147761921', title: '풍문 또는 보도에 대한 해명', at: '2026-10-02 11:11', author: 'KOSCOM' }]);
  assert.deepEqual(parseStockDisclosures({}), []);
});
