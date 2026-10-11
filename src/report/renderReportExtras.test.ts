import assert from 'node:assert/strict';
import test from 'node:test';
import { decisionTrace, diffBasis, kindChip, reportDiff, reportDiffCard, weekChanges } from './renderReportExtras.js';

const report = (date: string, close: number, stance: 'BULLISH' | 'BEARISH', target: number, fv: number) => ({
  date, generatedAt: `${date}T09:30:00Z`, price: { close, sessionDate: date },
  market: { horizons: [{ key: 'MEDIUM', summary: { label: stance === 'BULLISH' ? '강세' : '약세' } }], fairValue: { center: fv, method: 'gnm-tech-value-v1' }, forecasts: [], arena: null },
  commentary: { status: 'OK', model: 'm', promptVersion: 'gnm-committee-v3', tier: 'deep', dropped: 0, summary: { text: `${date} 요약`, evidenceIds: ['P1'], kind: 'FACT' },
    desks: [{ desk: 'TECHNICAL', stance, view: { text: 'v', evidenceIds: ['T1'] } }], analysts: [{ target }], evidence: [{ id: 'P1', kind: 'PRICE' }, { id: 'T1', kind: 'TECHNICAL' }] },
}) as never;

test('week changes: price, signal, fair value and analyst targets', () => {
  const rows = weekChanges(report('2026-10-09', 110, 'BEARISH', 100, 105), report('2026-10-02', 100, 'BULLISH', 120, 100));
  assert.deepEqual(rows.map((r) => r.label), ['종가', '중기 기술 신호', '기술적 적정가 중심', '분석가 예상가 평균']);
  assert.equal(rows[0]!.after, '110원 (+10.0%)');
});

const committee = (date: string, odds: [number, number, number], stance: 'BULLISH' | 'BEARISH' | 'NEUTRAL', summary: string) => {
  const r = report(date, 100, 'BULLISH', 100, 100) as unknown as { commentary: Record<string, unknown> };
  r.commentary.summary = { text: summary, evidenceIds: [] };
  r.commentary.scenarios = (['BULL', 'BASE', 'BEAR'] as const).map((kind, i) => ({ kind, probability: odds[i], narrative: { text: '비공개 시나리오', evidenceIds: [] }, catalysts: ['비공개'], invalidation: [] }));
  r.commentary.analysts = [{ analyst: 'fundamental', stance, confidence: 0.6, target: 100, rationale: { text: '비공개 이유', evidenceIds: [] } }, { analyst: 'trend_momentum', stance: 'NEUTRAL', confidence: 0.5, target: 100, rationale: { text: 'r', evidenceIds: [] } }];
  r.commentary.desks = [{ desk: 'TECHNICAL', stance, view: { text: '비공개 데스크 의견', evidenceIds: [] } }];
  return r as never;
};

test('report diff (G-203): odds, stance flips, vote tally and the two conclusions, led by the biggest move', () => {
  const prev = committee('2026-10-02', [30, 40, 30], 'NEUTRAL', '지난번엔 지켜보자는 결론이었어요. 둘째 문장.');
  const cur = committee('2026-10-09', [50, 35, 15], 'BULLISH', '이번엔 강세 쪽이에요.');
  const d = reportDiff(cur, prev);
  assert.equal(d.lead, '강세 시나리오 확률이 30%에서 50%로 올랐고, 위원 2명이 입장을 바꿨어요.');
  assert.deepEqual(d.flips.map((f) => [f.who, f.before, f.after]), [['실적·밸류에이션 분석가', '중립', '강세'], ['기술 데스크', '중립', '강세']]);
  assert.deepEqual(d.votes, { before: [0, 3, 0], after: [2, 1, 0] });
  assert.deepEqual(d.summary, { before: '지난번엔 지켜보자는 결론이었어요.', after: '이번엔 강세 쪽이에요.' });
  const html = reportDiffCard(cur, prev, { href: 'reports/2026-10-02.html' });
  assert.match(html, /지난 리포트와 달라진 점/);
  assert.match(html, /<a href="reports\/2026-10-02.html">2026-10-02<\/a> → 2026-10-09/);
  assert.match(html, /30% → 50%/);
  assert.equal(reportDiff(cur, cur).lead, '위원회의 판단은 크게 달라지지 않았어요.');
  assert.match(reportDiffCard(cur, null), /이전 위원회 리포트가 아직 없어요/);
});

test('diff basis keeps only the public fields the comparison reads', () => {
  const basis = diffBasis(committee('2026-10-02', [30, 40, 30], 'NEUTRAL', '공개 결론이에요.'));
  const json = JSON.stringify(basis);
  assert.doesNotMatch(json, /비공개/);
  assert.match(json, /공개 결론이에요/);
  assert.equal(reportDiff(committee('2026-10-09', [50, 35, 15], 'BULLISH', '새 결론이에요.'), basis).flips.length, 2);
});

test('decision trace lists the cut-off, evidence by kind, model and prompt; kind chips', () => {
  const html = decisionTrace(report('2026-10-09', 110, 'BULLISH', 100, 105), false);
  assert.ok(html.includes('2026-10-09 종가') && html.includes('가격 1, 기술 지표 1') && html.includes('gnm-committee-v3') && html.includes('만든 날 그대로 고정'));
  assert.ok(kindChip('ASSUMPTION').includes('가정') && kindChip(undefined) === '');
});
