import assert from 'node:assert/strict';
import test from 'node:test';
import { decisionTrace, diffBasis, easyCard, kindChip, renderCommitteeDebate, reportDiff, reportDiffCard, weekChanges } from './renderReportExtras.js';

const report = (date: string, close: number, stance: 'BULLISH' | 'BEARISH', target: number, fv: number) => ({
  date, generatedAt: `${date}T09:30:00Z`, price: { close, sessionDate: date },
  market: { horizons: [{ key: 'MEDIUM', summary: { label: stance === 'BULLISH' ? '강세' : '약세' } }], fairValue: { center: fv, method: 'gnm-tech-value-v1' }, forecasts: [], arena: null },
  commentary: { status: 'OK', model: 'm', promptVersion: 'gnm-committee-v3', tier: 'deep', dropped: 0, summary: { text: `${date} 요약`, evidenceIds: ['P1'], kind: 'FACT' },
    desks: [{ desk: 'TECHNICAL', stance, view: { text: 'v', evidenceIds: ['T1'] } }], analysts: [{ target }], evidence: [{ id: 'P1', kind: 'PRICE' }, { id: 'T1', kind: 'TECHNICAL' }] },
}) as never;

test('week changes: price, signal, fair value and analyst targets', () => {
  const rows = weekChanges(report('2026-10-09', 110, 'BEARISH', 100, 105), report('2026-10-02', 100, 'BULLISH', 120, 100));
  assert.deepEqual(rows.map((r) => r.label), ['종가', '중기 기술 신호', '기술적 적정가', '분석가 예상가 평균']);
  assert.deepEqual([rows[0]!.after, rows[0]!.delta], ['110원', '+10.0%']);
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
  assert.deepEqual(d.summary, { before: '지난번엔 지켜보자는 결론이었어요. 둘째 문장.', after: '이번엔 강세 쪽이에요.' });
  const html = reportDiffCard(cur, prev, { href: 'reports/2026-10-02.html' });
  assert.match(html, /지난 리포트와 달라진 점/);
  assert.match(html, /<a href="reports\/2026-10-02.html">2026-10-02<\/a>[\s\S]*<b>2026-10-09<\/b>/);
  assert.match(html, /<s>30%<\/s><b>50%<\/b>/);
  assert.equal(reportDiff(cur, cur).lead, '위원회의 판단은 크게 달라지지 않았어요.');
  assert.match(reportDiffCard(cur, null), /이전 위원회 리포트가 아직 없어요/);
  // Conclusions that start alike but end apart still show side by side ('수요' is not a sentence end).
  assert.ok(reportDiff(committee('2026-10-09', [30, 40, 30], 'NEUTRAL', '반도체 수요 회복이면 강세예요.'), committee('2026-10-02', [30, 40, 30], 'NEUTRAL', '반도체 수요 둔화면 약세예요.')).summary);
  // A tally that moved with no one flipping (a desk-only report before) is the lead, not "nothing changed".
  const deskOnly = committee('2026-10-02', [30, 40, 30], 'NEUTRAL', 'a') as unknown as { commentary: { analysts: unknown[] } };
  deskOnly.commentary.analysts = [];
  const withAnalysts = committee('2026-10-09', [30, 40, 30], 'BULLISH', 'b') as unknown as { commentary: { desks: { stance: string }[] } };
  withAnalysts.commentary.desks[0]!.stance = 'NEUTRAL';
  assert.equal(reportDiff(withAnalysts as never, deskOnly as never).lead, '위원 표결의 강세·약세 수가 바뀌었어요.');
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

test('easy card (G-218): the plain retelling, the vote and odds in everyday words, the words of this report', () => {
  const c = (committee('2026-10-09', [50, 35, 15], 'BULLISH', '요약') as unknown as { commentary: Record<string, unknown> }).commentary;
  const html = easyCard(c as never);
  assert.match(html, /쉽게 말하면/);
  assert.match(html, /위원 3명 가운데 <b class="up">오를 쪽 2명<\/b>, <b>지켜보자 1명<\/b>, <b class="down">내릴 쪽 0명<\/b>/);
  assert.match(html, /오르는 흐름 50%, 지금과 비슷한 흐름 35%, 내리는 흐름 15%/);
  assert.doesNotMatch(html, /ez-sum/, 'older reports have no model retelling, only the counted lines');
  c.easy = { summary: '쉽게는 <오를 쪽>이에요.', terms: [{ term: '정배열', meaning: '평균선이 차례로 놓인 상태' }] };
  const v8 = easyCard(c as never);
  assert.match(v8, /<p class="ez-sum">쉽게는 &lt;오를 쪽&gt;이에요.<\/p>/);
  assert.match(v8, /data-term-def="정배열"><dt>정배열<\/dt><dd>평균선이 차례로 놓인 상태<\/dd>/);
  assert.equal(easyCard({ status: 'FAILED' } as never), '');
});

test('debate turns carry a plain line and the member\'s role, shown when plain explanations are on (G-218)', () => {
  const c = { status: 'OK', evidence: [{ id: 'P1', label: '가격', url: '#kpis' }], debate: [
    { speaker: 'trend_momentum', stance: 'BULLISH', claim: { text: '정배열이에요.', evidenceIds: ['P1'] }, plain: '오르는 흐름이 이어져요.' },
    { speaker: 'RED_TEAM', stance: 'NEUTRAL', claim: { text: '정리해요.', evidenceIds: ['P1'] } }] };
  const html = renderCommitteeDebate(c as never);
  assert.match(html, /data-easy-toggle/);
  assert.match(html, /<span class="db-plain ez-only"><b>쉽게 말하면<\/b>오르는 흐름이 이어져요.<\/span>/);
  assert.match(html, /강세<span class="ez-only">\(오를 쪽\)<\/span><span class="db-role ez-only">오르는 흐름이 이어지는지 봐요<\/span>/);
  assert.equal((html.match(/db-plain/g) ?? []).length, 1);
  // Older debates without plain lines get no toggle.
  const old = renderCommitteeDebate({ ...c, debate: c.debate.map(({ plain: _p, ...t }) => t) } as never);
  assert.doesNotMatch(old, /data-easy-toggle/);
});
