// G-305: the weekly wrong-answer review. Every scored miss — a price range the close fell outside, a member
// call that went the wrong way — gets one of five types, so the next change goes where the misses really are:
//   market_shock  range miss that the index's move explains (back inside once the market move is taken out)
//   stock_tail    range miss that stays outside even without the market move (this stock's tail)
//   neutral_rule  a NEUTRAL call that moved outside its band
//   market        a directional miss that was right against the index (the market, not the pick)
//   stock         a directional miss that was wrong against the index too (the pick itself)
// and members whose confidence ran well above their hit rate are flagged (overconfident). A type becomes a
// change candidate only when it shows up on CANDIDATE_DAYS different days: one bad day is the market, not a
// pattern. Candidates are then tested on ten years split by regime (rangeEval.ts, blind evaluation) before
// anything ships. Pure; src/cli/missReview.ts does the files.

import { ANALYST_HORIZON, ANALYSTS, hitOf, type AnalystCall } from './analysts.js';
import type { PriceForecast } from './valuation.js';

export type MissType = 'market_shock' | 'stock_tail' | 'neutral_rule' | 'market' | 'stock';
export const MISS_LABEL: Record<MissType, string> = {
  market_shock: '범위: 시장 전체 충격', stock_tail: '범위: 종목 꼬리', neutral_rule: '중립 판정', market: '방향: 시장 탓 (시장 대비로는 맞음)', stock: '방향: 종목 판단 (시장 대비로도 틀림)',
};
/** Only these can be fixed by changing a prompt or the range; the others are the market or the rule. */
export const FIXABLE: readonly MissType[] = ['stock_tail', 'stock'];
export const CANDIDATE_DAYS = 5;
export const OVERCONFIDENT_PP = 15;
export const OVERCONFIDENT_MIN = 30;

type Bar = { date: string; close: number };
export interface Miss { type: MissType; symbol: string; day: string; who: string; detail: string }
export interface Review {
  scoredRanges: number; scoredCalls: number;
  misses: Miss[];
  byType: { type: MissType; n: number; days: number }[];
  candidates: { type: MissType; who: string; n: number; days: number }[];
  overconfident: { who: string; scored: number; conf: number; hit: number }[];
}

const sortBars = (bars: readonly Bar[]) => [...bars].sort((a, b) => (a.date < b.date ? -1 : 1));

export function reviewMisses(input: {
  forecasts: readonly PriceForecast[];
  calls: readonly AnalystCall[];
  bars: ReadonlyMap<string, readonly Bar[]>;
  /** The index each symbol is compared against (null: none). */
  indexOf: (symbol: string) => readonly Bar[] | null;
}): Review {
  const misses: Miss[] = [];
  // Ranges: a miss is the market's when taking the index's move out of the close puts it back inside the range.
  let scoredRanges = 0;
  for (const f of input.forecasts) {
    const b = sortBars(input.bars.get(f.symbol) ?? []), i = b.findIndex((x) => x.date === f.baseDate);
    const t = i < 0 ? undefined : b[i + f.horizon];
    if (!t) continue;
    scoredRanges += 1;
    const side = t.close < f.p10 ? -1 : t.close > f.p90 ? 1 : 0;
    if (side === 0) continue;
    const ix = input.indexOf(f.symbol), i0 = ix?.find((x) => x.date === f.baseDate), i1 = ix?.find((x) => x.date === t.date);
    const adj = i0 && i1 ? t.close / (i1.close / i0.close) : null;
    misses.push({ type: adj != null && adj >= f.p10 && adj <= f.p90 ? 'market_shock' : 'stock_tail', symbol: f.symbol, day: f.baseDate, who: `range-${f.horizon}`, detail: `${f.horizon}거래일 범위 ${side < 0 ? '아래' : '위'}로 벗어남${i0 && i1 ? `, 지수 ${((i1.close / i0.close - 1) * 100).toFixed(1)}%` : ''}` });
  }
  // Member calls.
  let scoredCalls = 0;
  const tally = new Map<string, { n: number; hits: number; conf: number }>();
  for (const c of input.calls) {
    const b = sortBars(input.bars.get(c.symbol) ?? []), i = b.findIndex((x) => x.date === c.baseDate);
    const t = i < 0 ? undefined : b[i + ANALYST_HORIZON];
    if (!t) continue;
    scoredCalls += 1;
    const hit = hitOf(c, t.close), x = tally.get(c.analyst) ?? { n: 0, hits: 0, conf: 0 };
    x.n += 1; x.hits += hit ? 1 : 0; x.conf += c.confidence; tally.set(c.analyst, x);
    if (hit) continue;
    if (c.stance === 'NEUTRAL') { misses.push({ type: 'neutral_rule', symbol: c.symbol, day: c.baseDate, who: c.analyst, detail: `중립인데 ${((t.close / c.baseClose - 1) * 100).toFixed(1)}% 움직임` }); continue; }
    const ix = input.indexOf(c.symbol), i0 = ix?.find((x) => x.date === c.baseDate), i1 = ix?.find((x) => x.date === t.date);
    const rel = i0 && i1 ? (t.close / c.baseClose - i1.close / i0.close > 0) === (c.stance === 'BULLISH') : false;
    misses.push({ type: rel ? 'market' : 'stock', symbol: c.symbol, day: c.baseDate, who: `${c.analyst}:${c.stance}`, detail: `${c.stance === 'BULLISH' ? '강세' : '약세'}인데 ${((t.close / c.baseClose - 1) * 100).toFixed(1)}%${i0 && i1 ? `, 지수 ${((i1.close / i0.close - 1) * 100).toFixed(1)}%` : ''}` });
  }
  const types = Object.keys(MISS_LABEL) as MissType[];
  const days = (xs: readonly Miss[]) => new Set(xs.map((m) => m.day)).size;
  const groups = new Map<string, Miss[]>();
  for (const m of misses) if (FIXABLE.includes(m.type)) { const k = `${m.type}|${m.who}`; const xs = groups.get(k); if (xs) xs.push(m); else groups.set(k, [m]); }
  return {
    scoredRanges, scoredCalls, misses,
    byType: types.map((type) => { const xs = misses.filter((m) => m.type === type); return { type, n: xs.length, days: days(xs) }; }),
    candidates: [...groups].map(([k, xs]) => ({ type: k.split('|')[0] as MissType, who: k.split('|')[1]!, n: xs.length, days: days(xs) })).filter((g) => g.days >= CANDIDATE_DAYS).sort((a, b) => b.days - a.days),
    overconfident: [...tally].map(([who, x]) => ({ who, scored: x.n, conf: x.conf / x.n, hit: (x.hits / x.n) * 100 })).filter((x) => x.scored >= OVERCONFIDENT_MIN && x.conf - x.hit > OVERCONFIDENT_PP),
  };
}

const NAME = new Map<string, string>(ANALYSTS.map((a) => [a.id, a.name]));
const whoName = (who: string) => {
  if (who.startsWith('range-')) return `예측 범위 ${who.slice(6)}거래일`;
  const [id, stance] = who.split(':');
  return `${NAME.get(id!) ?? (id === 'sector_expert' ? '종목 전문위원' : id)}${stance ? ` ${stance === 'BULLISH' ? '강세' : '약세'}` : ''}`;
};

export function reviewMarkdown(r: Review, date: string): string {
  const lines = [
    `# 오답 리뷰 (${date})`, '',
    `채점된 예측 범위 ${r.scoredRanges}건, 위원 판단 ${r.scoredCalls}건 가운데 틀린 ${r.misses.length}건을 유형별로 나눴어요. 같은 날 낸 예측은 시장을 따라 함께 움직이니, 건수보다 '틀린 날 수'를 봐요.`, '',
    '| 유형 | 건수 | 틀린 날 수 | 고칠 수 있나 |', '| --- | --- | --- | --- |',
    ...r.byType.map((t) => `| ${MISS_LABEL[t.type]} | ${t.n} | ${t.days} | ${FIXABLE.includes(t.type) ? '예 (후보 조건 확인)' : t.type === 'neutral_rule' ? '채점 규칙 (G-305에서 고침)' : '아니요 (시장)'} |`), '',
    '## 고칠 후보', '',
    ...(r.candidates.length ? r.candidates.map((c) => `- ${whoName(c.who)} · ${MISS_LABEL[c.type]}: ${c.n}건, 서로 다른 ${c.days}일. 10년 국면별 시험(범위: evalRange, 위원: 블라인드 평가)을 통과해야 반영해요.`) : [`- 없음. 같은 유형이 서로 다른 ${CANDIDATE_DAYS}일 이상 나와야 후보가 돼요.`]), '',
    '## 확신 과다', '',
    ...(r.overconfident.length ? r.overconfident.map((x) => `- ${whoName(x.who)}: 평균 확신 ${x.conf.toFixed(0)}%, 실제 적중 ${x.hit.toFixed(0)}% (${x.scored}건)`) : [`- 없음 (채점 ${OVERCONFIDENT_MIN}건 이상인 위원 중 확신이 적중보다 ${OVERCONFIDENT_PP}%p 넘게 높은 위원 없음).`]), '',
  ];
  return `${lines.join('\n')}\n`;
}
