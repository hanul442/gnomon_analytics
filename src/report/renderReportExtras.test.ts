import assert from 'node:assert/strict';
import test from 'node:test';
import { decisionTrace, kindChip, weekChanges, weekDiffSection } from './renderReportExtras.js';

const report = (date: string, close: number, stance: 'BULLISH' | 'BEARISH', target: number, fv: number) => ({
  date, generatedAt: `${date}T09:30:00Z`, price: { close, sessionDate: date },
  market: { horizons: [{ key: 'MEDIUM', summary: { label: stance === 'BULLISH' ? '강세' : '약세' } }], fairValue: { center: fv, method: 'gnm-tech-value-v1' }, forecasts: [], arena: null },
  commentary: { status: 'OK', model: 'm', promptVersion: 'gnm-committee-v3', tier: 'deep', dropped: 0, summary: { text: `${date} 요약`, evidenceIds: ['P1'], kind: 'FACT' },
    desks: [{ desk: 'TECHNICAL', stance, view: { text: 'v', evidenceIds: ['T1'] } }], analysts: [{ target }], evidence: [{ id: 'P1', kind: 'PRICE' }, { id: 'T1', kind: 'TECHNICAL' }] },
}) as never;

test('week changes: price, signal, fair value, desk stance flips and analyst targets', () => {
  const rows = weekChanges(report('2026-10-09', 110, 'BEARISH', 100, 105), report('2026-10-02', 100, 'BULLISH', 120, 100));
  assert.deepEqual(rows.map((r) => r.label), ['종가', '중기 기술 신호', '기술적 적정가 중심', '기술 데스크', '분석가 예상가 평균']);
  assert.equal(rows[0]!.after, '110원 (+10.0%)');
  assert.deepEqual([rows[3]!.before, rows[3]!.after], ['강세', '약세']);
  assert.match(weekDiffSection(report('2026-10-09', 110, 'BULLISH', 100, 105), null), /비교할 지난 리포트가 아직 없어요/);
});

test('decision trace lists the cut-off, evidence by kind, model and prompt; kind chips', () => {
  const html = decisionTrace(report('2026-10-09', 110, 'BULLISH', 100, 105), false);
  assert.ok(html.includes('2026-10-09 종가') && html.includes('가격 1, 기술 지표 1') && html.includes('gnm-committee-v3') && html.includes('만든 날 그대로 고정'));
  assert.ok(kindChip('ASSUMPTION').includes('가정') && kindChip(undefined) === '');
});
