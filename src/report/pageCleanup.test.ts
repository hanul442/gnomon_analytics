// G-300 (한서님 10/25 '다른 페이지도 깔끔하게'): each number in one place, no badge every row carries, runs grouped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edgeEvents, edgeFundamentals } from './renderEdge.js';
import { voteDots } from './committeeSeats.js';
import { coinFitnessCard } from './coinFitness.js';
import type { DailyReport } from './dailyReport.js';

const ev = (date: string, title: string, key = 'insider', label = '임원·주요주주 매매') => ({ date, title, key, label, receiptNo: `2026${date.replace(/-/g, '').slice(4)}000001`, why: '회사를 가장 잘 아는 사람들의 매매예요.' });

test('G-300: the same older filing in a row is one line with its count and dates, inside the 공시 card', () => {
  const events = [ev('2026-09-22', '임원ㆍ주요주주특정증권등소유상황보고서'), ev('2026-09-18', '임원ㆍ주요주주특정증권등소유상황보고서'), ev('2026-09-14', '임원ㆍ주요주주특정증권등소유상황보고서'), ev('2026-09-08', '최대주주등소유주식변동신고서', 'holder', '지분')];
  const html = edgeEvents({ date: '2026-10-24', edge: { events } } as unknown as DailyReport);
  assert.match(html, /임원ㆍ주요주주특정증권등소유상황보고서 3건/);
  assert.match(html, /2026-09-14 ~ 2026-09-22/);
  assert.equal((html.match(/class="edge-run"/g) ?? []).length, 1);
  assert.ok(html.includes('최대주주등소유주식변동신고서') && !html.includes('지난 주요 공시') && !html.includes('t-insider'));
});

test('G-300: 배당 and 다음 실적 share one card; the yield is not repeated there', () => {
  const html = edgeFundamentals({ edge: { surprises: [], events: [], dividend: { dps: 1668, yieldPct: 0.78, payoutPct: 25, dpsEst: null, yieldEstPct: null, decision: null }, nextEarnings: { period: '2026년 4분기', label: '잠정실적 1월 말', basis: '직전 실적 공시 2026-10-08.' } } } as unknown as DailyReport);
  assert.equal((html.match(/class="card/g) ?? []).length, 1);
  assert.ok(html.includes('실적·배당 일정') && html.includes('1,668') && !html.includes('0.78%'));
});

test('G-300: the vote as one row of dots, bull first, with the split in numbers', () => {
  const seat = (stance: string, k: number) => ({ key: `k${k}`, ch: '추', name: `위원 ${k}`, kind: 'analyst', focus: '', stance });
  const html = voteDots([seat('bear', 1), seat('bull', 2), seat('neutral', 3), seat('bear', 4)] as never);
  assert.ok(html.indexOf('s-bull') < html.indexOf('s-neutral') && html.indexOf('s-neutral') < html.indexOf('s-bear'));
  assert.match(html, /aria-label="강세 1, 중립 1, 약세 2"/);
});

test('G-300: Upbit cautions that are off are one line, not five chips', () => {
  const f = { total: 90, axes: [], timeline: [], historyNote: '', cautions: [], warning: false, date: '2026-10-25' };
  const html = coinFitnessCard(f as never);
  assert.ok(!html.includes('· 꺼짐</span>') && html.includes('모두 꺼짐'));
  const one = coinFitnessCard({ ...f, cautions: ['가격 급등락'] } as never);
  assert.ok(one.includes('가격 급등락 · 켜짐') && one.includes('나머지 꺼짐'));
});
