import assert from 'node:assert/strict';
import test from 'node:test';
import type { Disclosure, PriceBar } from '../types.js';
import { buildDailyReport } from './dailyReport.js';
import { renderIndex, renderReport } from './renderHtml.js';

const AT = '2026-10-02T09:30:00.000Z';
function bars(closes: number[], startDay = 1): PriceBar[] {
  return closes.map((close, i) => {
    const date = new Date(Date.UTC(2026, 8, startDay + i)).toISOString().slice(0, 10);
    return { symbol: '000660', date, open: close, high: close + 1000, low: close - 1000, close, volume: 1_000_000, source: 'naver:fchart:day', retrievedAt: AT };
  });
}
function filing(title: string, filedDate: string, receiptNo = '20261002000001'): Disclosure {
  return { receiptNo, corpName: 'SK하이닉스', stockCode: '000660', title, filer: 'SK하이닉스', filedDate, remark: '유', url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${receiptNo}`, source: 'opendart:list', retrievedAt: AT };
}
const base = { symbol: '000660', name: 'SK하이닉스', generatedAt: new Date(AT), sources: ['naver:fchart:day', 'opendart:list'] };

test('a session report has price context, filings since the last session, and a headline', () => {
  const history = bars(Array.from({ length: 25 }, (_, i) => 300000 + (i % 2) * 1000));
  const last = history.at(-1)!;
  history.push({ ...last, date: '2026-09-26', close: 330000, high: 331000, volume: 3_000_000 });
  const report = buildDailyReport({
    ...base, date: '2026-09-26', bars: history,
    disclosures: [
      filing('분기보고서 (2026.06)', '2026-09-26', '20260926000001'),
      filing('연결재무제표기준영업(잠정)실적(공정공시)', '2026-09-26', '20260926000002'),
      filing('예전 공시', '2026-09-20', '20260920000001'),
    ],
  });
  assert.equal(report.status, 'SESSION');
  assert.equal(report.price?.close, 330000);
  assert.equal(report.price?.volumeRatio20, 3);
  assert.deepEqual(report.filings.map((f) => f.category), ['실적', '정기보고서']);
  assert.match(report.headline, /^SK하이닉스 종가 330,000원, 전일 대비 \+\d+\.\d\d%\. 새 공시 2건\(중요 1건\)\.$/);
  assert.ok(report.notes.some((n) => n.includes('거래량이 최근 20거래일 평균의 3.0배')));
  assert.ok(report.notes.some((n) => n.includes('평소 변동')));
});

test('a holiday report keeps the last session price and picks up filings since then', () => {
  const report = buildDailyReport({ ...base, date: '2026-10-03', bars: bars([300000, 301000], 30), disclosures: [filing('주요사항보고서(유상증자결정)', '2026-10-02')] });
  assert.equal(report.status, 'NO_SESSION');
  assert.equal(report.price?.sessionDate, '2026-10-01');
  assert.equal(report.price?.close, 301000);
  assert.equal(report.filings.length, 1);
  assert.equal(report.headline, '2026-10-03에는 거래가 없었어요. 마지막 거래일(2026-10-01) 종가는 301,000원이에요. 새 공시 1건(중요 1건).');
});

test('changes compare against the previous report', () => {
  const first = buildDailyReport({ ...base, date: '2026-09-30', bars: bars([300000], 30), disclosures: [] });
  assert.deepEqual(first.changes, ['첫 리포트예요. 다음 리포트부터 이전 리포트와 비교해요.']);
  const second = buildDailyReport({ ...base, date: '2026-10-01', bars: bars([300000, 330000], 30), disclosures: [filing('주요사항보고서(자기주식취득결정)', '2026-10-01')], previous: first });
  assert.equal(second.changes?.[0], '종가 300,000원 → 330,000원 (+10.00%, 2026-09-30 → 2026-10-01)');
  assert.equal(second.changes?.[1], '새 공시 1건: 주요사항보고서(자기주식취득결정).');
  const holiday = buildDailyReport({ ...base, date: '2026-10-02', bars: bars([300000, 330000], 30), disclosures: [], previous: second, previouslyReported: new Set(['20261002000001']) });
  assert.equal(holiday.changes?.[0], '새 거래일이 없어서 가격은 이전 리포트와 같아요.');
  assert.ok(!holiday.changes?.some((c) => c.startsWith('사라진 신호')));
});

test('changes against a report stored before sessionDate existed', () => {
  const legacy = buildDailyReport({ ...base, date: '2026-09-30', bars: bars([300000], 30), disclosures: [] });
  delete (legacy.price as { sessionDate?: string }).sessionDate;
  const next = buildDailyReport({ ...base, date: '2026-10-01', bars: bars([300000, 330000], 30), disclosures: [], previous: legacy });
  assert.equal(next.changes?.[0], '종가 300,000원 → 330,000원 (+10.00%, 2026-09-30 → 2026-10-01)');
  const noPrice = { ...legacy, price: null };
  const after = buildDailyReport({ ...base, date: '2026-10-01', bars: bars([300000, 330000], 30), disclosures: [], previous: noPrice });
  assert.equal(after.changes?.[0], '이전 리포트(2026-09-30)에는 가격이 없었어요. 2026-10-01 종가는 330,000원이에요.');
});

test('future bars are never used', () => {
  const report = buildDailyReport({ ...base, date: '2026-09-02', bars: bars([300000, 301000, 999999]), disclosures: [] });
  assert.equal(report.price?.close, 301000);
  assert.deepEqual(report.recentCloses.map((c) => c.close), [300000, 301000]);
});

test('rendered pages escape text and link the filing source', () => {
  const report = buildDailyReport({ ...base, date: '2026-10-03', bars: [], disclosures: [filing('<script>x</script>', '2026-10-03')] });
  const html = renderReport(report, { index: '../index.html' });
  assert.ok(!html.includes('<script>x'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261002000001'));
  assert.match(renderIndex([report]), /reports\/2026-10-03\.html/);
});

test('a filing that reached DART after the previous report still appears once', () => {
  const late = filing('주요사항보고서(유상증자결정)', '2026-10-01', '20261001000009');
  const shown = filing('분기보고서', '2026-10-01', '20261001000001');
  const report = buildDailyReport({
    ...base, date: '2026-10-02', bars: bars([300000, 301000, 302000], 30),
    disclosures: [late, shown], previouslyReported: new Set(['20261001000001']),
  });
  assert.deepEqual(report.filings.map((f) => f.receiptNo), ['20261001000009']);
  // Earlier reports that showed no filings still count as earlier reports.
  const afterEmpty = buildDailyReport({ ...base, date: '2026-10-02', bars: bars([300000, 301000, 302000], 30), disclosures: [late], previouslyReported: new Set() });
  assert.equal(afterEmpty.filings.length, 1);
});
