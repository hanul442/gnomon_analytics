// Screener conditions (docs/DESIGN.md §5.14, G-48): a screen is a list of rules over the columns of
// site/screener.json, joined by "all" or "any". The same matcher runs in the browser (inlined through
// Function.prototype.toString) and in the API's daily alert job. Keep `matches` self-contained.

export type RuleOp = '>=' | '<=' | '=' | '!=';
export interface Rule { f: string; op: RuleOp; v: number | string }
export interface Screen { match: 'all' | 'any'; rules: Rule[]; /** Drop stocks whose filing risk is at least this level (0 = keep all). */ maxRisk?: number }

export interface Field { key: string; label: string; idx: number; kind: 'num' | 'cat'; unit?: string; options?: [string, string][]; hint?: string }

/** Columns of ScreenerRow (src/report/renderScreener.ts) a rule can test. */
export const FIELDS: readonly Field[] = [
  { key: 'market', label: '시장', idx: 2, kind: 'cat', options: [['P', '코스피'], ['Q', '코스닥']] },
  { key: 'cap', label: '시가총액', idx: 3, kind: 'num', unit: '억 원' },
  { key: 'close', label: '종가', idx: 4, kind: 'num', unit: '원' },
  { key: 'chg', label: '오늘 등락', idx: 5, kind: 'num', unit: '%' },
  { key: 'level', label: '기술 신호', idx: 6, kind: 'cat', options: [['BULL', '강세 쪽'], ['STRONG', '강한 강세'], ['NEUTRAL', '중립'], ['BEAR', '약세 쪽']] },
  { key: 'score', label: '신호 점수', idx: 7, kind: 'num', unit: '(−100~100)' },
  { key: 'r5', label: '5거래일 등락', idx: 8, kind: 'num', unit: '%' },
  { key: 'r20', label: '20거래일 등락', idx: 9, kind: 'num', unit: '%' },
  { key: 'r120', label: '120거래일 등락', idx: 10, kind: 'num', unit: '%' },
  { key: 'fairGap', label: '적정가 대비', idx: 11, kind: 'num', unit: '%' },
  { key: 'pos', label: '적정가 범위', idx: 12, kind: 'cat', options: [['B', '범위보다 아래'], ['I', '범위 안'], ['A', '범위보다 위']] },
  { key: 'vol1', label: '거래량 급증(오늘)', idx: 14, kind: 'num', unit: '배', hint: '오늘 거래량 ÷ 직전 20일 평균' },
  { key: 'vol5', label: '거래량 증가(5일)', idx: 15, kind: 'num', unit: '배', hint: '최근 5일 평균 ÷ 그 전 20일 평균' },
  { key: 'vwap', label: 'VWAP 대비', idx: 16, kind: 'num', unit: '%', hint: '종가 ÷ 20일 거래량 가중 평균가' },
  { key: 'obv', label: 'OBV 추세', idx: 17, kind: 'num', unit: '(−100~100)', hint: '20일 동안 오른 날 거래량 − 내린 날 거래량, 전체 거래량 대비' },
  { key: 'flow', label: '수급 흔적', idx: 18, kind: 'cat', options: [['A', '매집(OBV↑, 가격 제자리)'], ['D', '분산(OBV↓, 가격 제자리)']] },
  { key: 'tv', label: '거래대금', idx: 19, kind: 'num', unit: '억 원' },
  { key: 'hi52', label: '52주 고점 대비', idx: 20, kind: 'num', unit: '%' },
  { key: 'risk', label: '공시 위험 단계', idx: 21, kind: 'num', unit: '(0~3)' },
];

export const FIELD_INDEX: Record<string, number> = Object.fromEntries(FIELDS.map((f) => [f.key, f.idx]));

/** Ready-made screens; picking one fills the builder, so every preset can be edited. */
export const PRESETS: readonly { key: string; label: string; hint: string; screen: Screen }[] = [
  { key: 'top', label: '강세 신호 상위', hint: '지표 16개 종합 점수가 높은 순', screen: { match: 'all', rules: [{ f: 'level', op: '=', v: 'BULL' }], maxRisk: 2 } },
  { key: 'volsurge', label: '거래량 급증·상승', hint: '오늘 거래량이 20일 평균의 3배 이상이고 오른 종목', screen: { match: 'all', rules: [{ f: 'vol1', op: '>=', v: 3 }, { f: 'chg', op: '>=', v: 1 }], maxRisk: 2 } },
  { key: 'accum', label: '매집 흔적', hint: 'OBV는 올랐는데 가격은 제자리인 종목', screen: { match: 'all', rules: [{ f: 'flow', op: '=', v: 'A' }, { f: 'tv', op: '>=', v: 10 }], maxRisk: 2 } },
  { key: 'breakout', label: '52주 고점 돌파 시도', hint: '52주 고점 3% 안쪽에서 거래량이 늘어난 종목', screen: { match: 'all', rules: [{ f: 'hi52', op: '>=', v: -3 }, { f: 'vol5', op: '>=', v: 1.5 }], maxRisk: 2 } },
  { key: 'value', label: '강세 신호인데 적정가 아래', hint: '지표는 강세 쪽인데 가격은 적정가 범위보다 아래', screen: { match: 'all', rules: [{ f: 'level', op: '=', v: 'BULL' }, { f: 'pos', op: '=', v: 'B' }], maxRisk: 2 } },
  { key: 'rebound', label: '많이 내린 뒤 반등 신호', hint: '20거래일 10% 넘게 내렸지만 지표가 강세 쪽', screen: { match: 'all', rules: [{ f: 'r20', op: '<=', v: -10 }, { f: 'level', op: '=', v: 'BULL' }], maxRisk: 2 } },
  { key: 'large', label: '시가총액 1조 이상 강세', hint: '큰 종목 가운데 지표가 강세 쪽', screen: { match: 'all', rules: [{ f: 'cap', op: '>=', v: 10000 }, { f: 'level', op: '=', v: 'BULL' }], maxRisk: 2 } },
  { key: 'hot', label: '적정가 위로 과열', hint: '적정가 범위보다 15% 넘게 위', screen: { match: 'all', rules: [{ f: 'fairGap', op: '>=', v: 15 }, { f: 'pos', op: '=', v: 'A' }] } },
  { key: 'risky', label: '공시 위험 종목', hint: '최근 30일 전환사채·유상증자·관리종목 같은 공시가 나온 종목', screen: { match: 'all', rules: [{ f: 'risk', op: '>=', v: 2 }] } },
];

/** True when a screener row passes the screen. Self-contained: inlined into the page as source. */
export function matches(row: readonly unknown[], screen: { match: string; rules: { f: string; op: string; v: unknown }[]; maxRisk?: number }, idx: Record<string, number>): boolean {
  const BULL = ['STRONG_BULLISH', 'BULLISH', 'SLIGHTLY_BULLISH'], BEAR = ['STRONG_BEARISH', 'BEARISH', 'SLIGHTLY_BEARISH'];
  if (screen.maxRisk && Number(row[idx.risk!] ?? 0) >= screen.maxRisk) return false;
  const one = (r: { f: string; op: string; v: unknown }): boolean => {
    const i = idx[r.f];
    if (i === undefined) return true;
    const x = row[i];
    if (r.f === 'level') {
      const hit = r.v === 'BULL' ? BULL.indexOf(String(x)) >= 0 : r.v === 'BEAR' ? BEAR.indexOf(String(x)) >= 0 : r.v === 'STRONG' ? x === 'STRONG_BULLISH' : x === r.v;
      return r.op === '!=' ? !hit : hit;
    }
    if (r.op === '=') return String(x) === String(r.v);
    if (r.op === '!=') return String(x) !== String(r.v);
    if (x === null || x === undefined || r.v === '' || r.v === null) return false;
    const a = Number(x), b = Number(r.v);
    return r.op === '>=' ? a >= b : a <= b;
  };
  if (!screen.rules.length) return true;
  return screen.match === 'any' ? screen.rules.some(one) : screen.rules.every(one);
}

/** Validates a screen from outside (the API, a saved link). */
export function cleanScreen(input: unknown): Screen | null {
  if (!input || typeof input !== 'object') return null;
  const s = input as { match?: unknown; rules?: unknown; maxRisk?: unknown };
  if (!Array.isArray(s.rules) || s.rules.length > 12) return null;
  const rules: Rule[] = [];
  for (const r of s.rules as { f?: unknown; op?: unknown; v?: unknown }[]) {
    const field = FIELDS.find((x) => x.key === r?.f);
    if (!field || !['>=', '<=', '=', '!='].includes(String(r.op))) return null;
    const v = field.kind === 'num' ? Number(r.v) : String(r.v).slice(0, 20);
    if (field.kind === 'num' && !Number.isFinite(v)) return null;
    rules.push({ f: field.key, op: r.op as RuleOp, v });
  }
  const maxRisk = Number(s.maxRisk ?? 0);
  return { match: s.match === 'any' ? 'any' : 'all', rules, ...(maxRisk >= 1 && maxRisk <= 3 ? { maxRisk } : {}) };
}
