import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SELECTION, eligible, eventScore, selectWeekly, shortlist, type CandidateInput } from './selection.js';
import type { UniverseRow } from '../sources/naverList.js';

const row = (symbol: string, name: string, cap = 1e12, value = 1e10, change = 0): UniverseRow => ({ symbol, name, market: 'KOSPI', kind: 'stock', close: 10000, changePct: change, tradingValue: value, marketCap: cap, tradedAt: null });
const bars = (closes: number[], volume: (i: number) => number) => closes.map((close, i) => ({ date: `d${String(i).padStart(3, '0')}`, close, volume: volume(i) }));
const flat = (n: number, v = 1000) => bars(Array.from({ length: n }, () => 10000), () => v);

test('eligibility: common shares above the floor, no preferred shares or SPACs', () => {
  assert.equal(eligible(row('005930', '삼성전자')), true);
  assert.equal(eligible(row('005935', '삼성전자우')), false);
  assert.equal(eligible(row('123450', '어느스팩1호')), false);
  assert.equal(eligible(row('111110', '작은회사', 1e11)), false);
});

test('events: earnings outrank other major filings; routine reports do not count', () => {
  assert.equal(eventScore(['연결재무제표기준영업(잠정)실적(공정공시)']).score, 1);
  assert.equal(eventScore(['[기재정정]단일판매ㆍ공급계약체결']).score, 0.6);
  assert.deepEqual(eventScore(['임원ㆍ주요주주특정증권등소유상황보고서']), { score: 0, hits: [] });
});

test('core and the largest companies get the full committee; the rest rank by the composite score', () => {
  const quiet: CandidateInput = { row: row('100000', '조용한'), bars: flat(70), filings: [] };
  // Moved +20% in five sessions on three times the usual trading value.
  const mover: CandidateInput = { row: row('200000', '급등'), bars: bars([...Array(65).fill(10000), 10500, 11000, 11500, 11800, 12000], (i) => (i >= 65 ? 3000 : 1000)), filings: [] };
  const earner: CandidateInput = { row: row('300000', '실적', 2e12), bars: flat(70, 2000), filings: ['영업(잠정)실적(공정공시)'] };
  const giant: CandidateInput = { row: row('400000', '대형', 9e13), bars: flat(70), filings: [] };
  const sel = selectWeekly({
    date: '2026-10-09', generatedAt: new Date('2026-10-09T09:30:00Z'), universe: 5, eligibleCount: 4,
    core: [{ symbol: '000660', name: 'SK하이닉스', market: 'KOSPI' }],
    candidates: [quiet, mover, earner, giant], params: { ...DEFAULT_SELECTION, size: 4, bigCaps: 1 },
  });
  assert.deepEqual(sel.picks.map((p) => [p.symbol, p.tier]), [['000660', 'deep'], ['400000', 'deep'], ['300000', 'brief'], ['200000', 'brief']]);
  assert.deepEqual(sel.picks[1]!.reasons, ['시가총액 상위 (90조원)']);
  // A larger, more traded stock with earnings outranks a one-week mover.
  assert.ok(sel.picks[2]!.reasons.includes('공시: 영업(잠정)실적(공정공시)'));
  const m = sel.picks[3]!;
  assert.ok(m.reasons.some((r) => r.startsWith('5거래일 +20.0%')) && m.reasons.some((r) => /평소의 3\.\d배/.test(r)), m.reasons.join());
});

test('shortlist: most traded, biggest movers and stocks with filings, eligible only', () => {
  const rows = [row('100000', 'a', 1e12, 9e10), row('200000', 'b', 1e12, 1e9, 15), row('300000', 'c', 1e12, 1e8), row('400000', 'd', 1e10, 9e11), row('300005', 'c우', 1e12, 9e12)];
  const list = shortlist(rows, new Map([['300000', ['합병결정']]]), DEFAULT_SELECTION, 10).map((r) => r.symbol);
  assert.deepEqual(list.sort(), ['100000', '200000', '300000']);
});
