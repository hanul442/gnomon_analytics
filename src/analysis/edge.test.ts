import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEdge, eventOf, nextEarnings, radarRows, surprises, type EventFiling, type InsiderReport } from './edge.js';
import { parseHolders, parseInsider } from '../sources/dartOwnership.js';
import { parseThemeList, parseThemeMembers } from '../sources/naverTheme.js';
import type { FinancePeriod } from '../types.js';

const fp = (period: string, isEstimate: boolean, op: number, retrievedAt: string): FinancePeriod => ({ symbol: '005930', periodType: 'QUARTER', period, isEstimate, metrics: { 영업이익: op, 매출액: op * 10 }, source: 'fixture', retrievedAt });

test('event titles: classified by kind, withdrawals dropped', () => {
  assert.equal(eventOf('연결재무제표기준영업(잠정)실적(공정공시)')?.key, 'earnings');
  assert.equal(eventOf('현금ㆍ현물배당결정')?.key, 'dividend');
  assert.equal(eventOf('주요사항보고서(자기주식취득결정)')?.key, 'buyback');
  assert.equal(eventOf('주요사항보고서(자기주식처분결정)')?.key, 'buybackSell');
  assert.equal(eventOf('단일판매ㆍ공급계약체결')?.key, 'contract');
  assert.equal(eventOf('기업설명회(IR)개최(안내공시)')?.key, 'ir');
  assert.equal(eventOf('[기재정정]분기보고서 (2026.06)'), null);
});

test('surprise: the last estimate stored before the first actual, never one after', () => {
  const log = [fp('202606', true, 100, '2026-06-01T00:00:00Z'), fp('202606', true, 110, '2026-07-01T00:00:00Z'), fp('202606', false, 132, '2026-07-08T00:00:00Z'), fp('202606', true, 999, '2026-07-09T00:00:00Z'), fp('202603', false, 90, '2026-04-08T00:00:00Z')];
  const s = surprises(log);
  const op = s.find((x) => x.metric === '영업이익')!;
  assert.equal(op.estimate, 110);
  assert.equal(op.actual, 132);
  assert.equal(Math.round(op.pct), 20);
  assert.equal(op.estimatedAt, '2026-07-01');
  assert.ok(!s.some((x) => x.period === '202603'), 'a quarter never seen as an estimate has no surprise');
});

test('next earnings: the quarter that just ended, or the following one once it was reported', () => {
  assert.equal(nextEarnings('2026-10-06', []).period, '2026년 3분기');
  const reported: EventFiling[] = [{ symbol: 'x', date: '2026-10-05', title: '영업(잠정)실적', receiptNo: '20261005000001', key: 'earnings' }];
  assert.equal(nextEarnings('2026-10-06', reported).period, '2026년 4분기');
  assert.match(nextEarnings('2026-02-01', []).label, /2026년 3월 말/);
  // G-194: past the filing deadline the quarter has been reported, even with no filing on record.
  assert.equal(nextEarnings('2026-09-10', []).period, '2026년 3분기');
  assert.equal(nextEarnings('2026-02-20', []).period, '2025년 4분기', 'the year report has 90 days');
  assert.equal(nextEarnings('2026-09-10', [], true).period, '2026년 3분기(달력 기준)');
  assert.match(nextEarnings('2026-09-10', [], true).label, /2026년 10월 중순~11월 초/);
  assert.equal(nextEarnings('2026-08-05', [], true).period, '2026년 2분기(달력 기준)', 'still inside the 40 days');
  assert.equal(nextEarnings('2026-08-05', [], true, ['2026-07-31']).period, '2026년 3분기(달력 기준)', 'an earnings 8-K or 10-Q already filed');
  assert.equal(nextEarnings('2026-03-10', [], true).period, '2026년 1분기(달력 기준)', 'the 10-K is due 60 days after the year');
});

test('edge: insider net change, buyback and value surge become highlights; ownership wording stays neutral', () => {
  const ins = (date: string, delta: number, no: string): InsiderReport => ({ symbol: 'x', receiptNo: no, date, reporter: '홍길동', position: '사내이사', isExec: true, isMajor: false, shares: 1000, delta, ratio: 0.1, retrievedAt: '' });
  const bars = [...Array.from({ length: 20 }, () => ({ close: 100, volume: 1000 })), { close: 100, volume: 4000 }];
  const e = buildEdge({ date: '2026-10-06', close: 50_000, bars, finance: [], financeLog: [], events: [{ symbol: 'x', date: '2026-09-30', title: '자기주식소각결정', receiptNo: '20260930000001', key: 'buyback' }], insider: [ins('2026-09-01', 30_000, '20260901000001'), ins('2026-09-02', -5_000, '20260902000001'), ins('2026-01-01', 1, '20260101000001')], holders: [] });
  assert.equal(e.insider!.netShares, 25_000);
  assert.equal(e.insider!.buys, 1);
  assert.deepEqual(e.highlights.map((h) => h.key), ['insider', 'buyback', 'value']);
  assert.match(e.highlights[0]!.text, /보유 증가/);
  assert.doesNotMatch(e.highlights[0]!.text, /매수|매도/);
  assert.match(e.highlights[1]!.text, /소각/);
  assert.equal(e.value!.ratio, 4);
  assert.deepEqual(radarRows(e.events, '2026-10-06').map((r) => r.receiptNo), ['20260930000001']);
});

test('DART ownership parsers: numbers with commas, old rows and bad receipt numbers dropped, errors carry no URL', () => {
  const now = new Date('2026-10-06T00:00:00Z');
  const ins = parseInsider({ status: '000', list: [
    { rcept_no: '20260901000123', rcept_dt: '2026-09-01', repror: '홍길동', isu_exctv_rgist_at: '등기임원', isu_exctv_ofcps: '대표이사', isu_main_shrholdr: '-', sp_stock_lmp_cnt: '1,200,000', sp_stock_lmp_irds_cnt: '-30,000', sp_stock_lmp_rate: '0.02' },
    { rcept_no: '20200101000001', rcept_dt: '2020-01-01', repror: '옛날' },
    { rcept_no: 'bad', rcept_dt: '2026-09-02', repror: 'x' },
  ] }, '005930', now, '2026-01-01');
  assert.equal(ins.length, 1);
  assert.equal(ins[0]!.delta, -30_000);
  assert.equal(ins[0]!.shares, 1_200_000);
  assert.equal(ins[0]!.isExec, true);
  assert.equal(ins[0]!.isMajor, false);
  const h = parseHolders({ status: '000', list: [{ rcept_no: '20260910000001', rcept_dt: '20260910', repror: '국민연금공단', stkqy: '50,000,000', stkqy_irds: '1,000,000', stkrt: '7.51', stkrt_irds: '0.15', report_resn: '보유비율 변동' }] }, '005930', now, '2026-01-01');
  assert.equal(h[0]!.date, '2026-09-10');
  assert.equal(h[0]!.ratioDelta, 0.15);
  assert.deepEqual(parseHolders({ status: '013', message: '조회된 데이타가 없습니다.' }, 'x', now, '2026-01-01'), []);
  assert.throws(() => parseInsider({ status: '020', message: '요청 제한을 초과하였습니다.' }, 'x', now, '2026-01-01'), (e: Error) => /DART_STATUS_020/.test(e.message) && !/crtfc_key|http/.test(e.message));
});

test('Naver themes: the mobile JSON list and members, bad rows skipped', () => {
  assert.deepEqual(parseThemeList({ groups: [{ no: 591, name: '재개발 수혜' }, { no: 'x', name: '잘못된' }, { no: 42, name: '반도체' }] }), [{ no: '591', name: '재개발 수혜' }, { no: '42', name: '반도체' }]);
  assert.deepEqual(parseThemeList('<html>'), []);
  assert.deepEqual(parseThemeMembers({ stocks: [{ itemCode: '005930', stockName: '삼성전자' }, { itemCode: '000660', stockName: 'SK하이닉스' }, { itemCode: '005930', stockName: '삼성전자' }, { itemCode: 'bad', stockName: 'x' }], themeItemInfoMap: { '005930': '메모리 <b>세계 1위</b>' } }),
    [{ symbol: '005930', name: '삼성전자', reason: '메모리 세계 1위' }, { symbol: '000660', name: 'SK하이닉스', reason: '' }]);
});
