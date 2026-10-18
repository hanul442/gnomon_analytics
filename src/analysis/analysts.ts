// AI analyst battle (docs/DESIGN.md §5.6, G-16). Analyst personas come from
// BLACK ORACLE BOT's investment committee. In the daily AI call each analyst
// states a stance, a confidence and a price for 20 sessions ahead; the calls
// are logged unchanged and scored once 20 sessions have passed. Pure.

export const ANALYST_HORIZON = 20;

export const ANALYSTS = [
  { id: 'trend_momentum', name: '추세·모멘텀 PM', focus: '이동평균 배열, MACD, 돌파' },
  { id: 'mean_reversion', name: '평균회귀 PM', focus: 'RSI, 볼린저, 과열·과매도' },
  { id: 'wave_structure', name: '파동·구조 분석가', focus: '스윙 구조, 돌파·전환, 피보나치' },
  { id: 'volume_flow', name: '거래량·수급 분석가', focus: '거래량, 외국인·기관 순매수, 수급 흔적' },
  { id: 'fundamental', name: '실적·밸류에이션 분석가', focus: '분기 실적, PER·PBR, 증권가 평균' },
  { id: 'event_catalyst', name: '이벤트·뉴스 분석가', focus: '공시, 뉴스, 일정' },
  // G-242: the seat whose specialty follows the stock's industry (src/analysis/sectorExpert.ts); the report names it ('반도체 전문위원').
  { id: 'sector_expert', name: '업종 전문위원', focus: '종목 업종의 핵심 지표와 업황 (반도체·바이오·은행처럼 종목마다 그 업종 전문가)' },
] as const;

export type AnalystId = typeof ANALYSTS[number]['id'];
/** G-242: the six lenses every stock gets; the market-wide report has no single industry, so it keeps only these. */
export const CORE_ANALYSTS = ANALYSTS.filter((a) => a.id !== 'sector_expert');
/** A member's name on one report: the industry seat takes the specialty that report gave it. */
export const analystName = (id: string, expert?: { name: string } | null) => (id === 'sector_expert' && expert?.name) || ANALYSTS.find((a) => a.id === id)?.name || id;

export interface AnalystCall {
  symbol: string;
  analyst: AnalystId;
  /** Report date that made the call, and the session close it starts from. */
  reportDate: string;
  baseDate: string;
  baseClose: number;
  stance: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  /** 0–100. */
  confidence: number;
  /** Price expected 20 sessions after baseDate. */
  target: number;
  /** G-229: the close that would prove the call wrong (below the base for BULLISH, above for BEARISH). */
  invalidation?: number;
  promptVersion: string;
  madeAt: string;
}

export const analystCallKey = (c: AnalystCall) => `${c.symbol}:${c.analyst}:${c.baseDate}`;

export interface AnalystScore {
  analyst: AnalystId;
  name: string;
  scored: number;
  /** Share of calls whose direction (target vs base) matched the actual move. */
  hitRate: number | null;
  /** Median absolute error of the target, percent. */
  medianErrorPct: number | null;
  /**
   * G-226: confidence read as the chance the call is right, scored the standard way (Brier score: mean of
   * (confidence/100 − hit)², 0 best, 0.25 = always saying 50%). `avgConfidence` (0–100) next to `hitRate`
   * shows over- or under-confidence. Both over scored calls only.
   */
  brier: number | null;
  avgConfidence: number | null;
  pending: number;
  latest: AnalystCall | null;
  rank: number | null;
  /** G-213: this analyst's last calls on the stock, newest first, each with how it is doing or how it ended. */
  calls?: AnalystTrack[];
  /** G-229: over scored calls that set an invalidation price: how many, how many saw it crossed, and how many of those missed. */
  kill?: { set: number; broke: number; brokeMissed: number };
}

/**
 * G-213: one call followed to today. `done` once 20 sessions have passed: `close` is then the scored close and
 * `hit` the verdict. Before that `close` is the latest close and `hit` says whether the move so far agrees
 * (null while the price has not moved, or the call's base session is missing from the bars).
 */
export interface AnalystTrack {
  reportDate: string; baseDate: string; baseClose: number;
  stance: AnalystCall['stance']; confidence: number; target: number;
  sessions: number; close: number | null; closeDate: string | null; done: boolean; hit: boolean | null;
  /** G-229: the invalidation price, and the first session within the 20 whose close crossed it. */
  invalidation?: number; brokeOn?: string | null;
}

/** G-229: a sane invalidation price for a stance, or undefined: below the close for BULLISH, above for BEARISH, within a third of it. */
export function invalidationOf(stance: AnalystCall['stance'], close: number, price: unknown): number | undefined {
  const p = typeof price === 'number' ? price : NaN;
  if (!Number.isFinite(p) || p <= 0 || !(close > 0)) return undefined;
  if (stance === 'BULLISH') return p < close && p >= close * (2 / 3) ? p : undefined;
  if (stance === 'BEARISH') return p > close && p <= close * (4 / 3) ? p : undefined;
  return undefined;
}
const crossed = (c: Pick<AnalystCall, 'stance' | 'invalidation'>, close: number) =>
  c.invalidation != null && (c.stance === 'BULLISH' ? close <= c.invalidation : c.stance === 'BEARISH' ? close >= c.invalidation : false);
export const TRACK_KEEP = 5;
const hitOf = (c: AnalystCall, close: number) => {
  const move = close / c.baseClose - 1;
  if (c.stance === 'NEUTRAL') return Math.abs(move) <= 0.02;
  return Math.sign(c.target - c.baseClose) === Math.sign(move);
};

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/**
 * Direction counts as hit when the target and the actual close 20 sessions
 * later sit on the same side of the base close; a NEUTRAL stance hits when
 * the actual move stays within ±2%.
 */
export function scoreAnalysts(calls: readonly AnalystCall[], bars: readonly { date: string; close: number }[]): AnalystScore[] {
  const sorted = [...bars].sort((a, b) => (a.date < b.date ? -1 : 1));
  const idx = new Map(sorted.map((b, i) => [b.date, i]));
  const board = ANALYSTS.map((a) => {
    const mine = calls.filter((c) => c.analyst === a.id).sort((x, y) => (x.baseDate < y.baseDate ? -1 : 1));
    const results: { hit: boolean; err: number; conf: number; set: boolean; broke: boolean }[] = [];
    let pending = 0;
    const last = sorted.at(-1);
    const track = (c: AnalystCall, i: number | undefined, outcome: { date: string; close: number } | undefined): AnalystTrack => {
      const at = outcome ?? (i === undefined ? undefined : last);
      const sessions = outcome ? ANALYST_HORIZON : i === undefined ? 0 : sorted.length - 1 - i;
      const broke = c.invalidation != null && i !== undefined ? sorted.slice(i + 1, i + 1 + ANALYST_HORIZON).find((b) => crossed(c, b.close))?.date ?? null : null;
      return {
        reportDate: c.reportDate, baseDate: c.baseDate, baseClose: c.baseClose, stance: c.stance, confidence: c.confidence, target: c.target,
        sessions, close: at?.close ?? null, closeDate: at?.date ?? null, done: !!outcome,
        hit: !at || (!outcome && (sessions === 0 || (c.stance !== 'NEUTRAL' && at.close === c.baseClose))) ? null : hitOf(c, at.close),
        ...(c.invalidation != null ? { invalidation: c.invalidation, brokeOn: broke } : {}),
      };
    };
    const tracked: AnalystTrack[] = [];
    for (const c of mine) {
      const i = idx.get(c.baseDate);
      const outcome = i === undefined ? undefined : sorted[i + ANALYST_HORIZON];
      const t = track(c, i, outcome);
      tracked.push(t);
      if (!outcome) { pending += 1; continue; }
      results.push({ hit: hitOf(c, outcome.close), err: Math.abs(outcome.close / c.target - 1) * 100, conf: Math.max(0, Math.min(100, c.confidence)) / 100, set: c.invalidation != null, broke: !!t.brokeOn });
    }
    return {
      analyst: a.id, name: a.name, scored: results.length,
      hitRate: results.length ? results.filter((r) => r.hit).length / results.length : null,
      medianErrorPct: results.length ? median(results.map((r) => r.err)) : null,
      brier: results.length ? mean(results.map((r) => (r.conf - (r.hit ? 1 : 0)) ** 2)) : null,
      avgConfidence: results.length ? mean(results.map((r) => r.conf * 100)) : null,
      pending, latest: mine.at(-1) ?? null, rank: null as number | null,
      calls: tracked.slice(-TRACK_KEEP).reverse(),
      ...(results.some((r) => r.set) ? { kill: { set: results.filter((r) => r.set).length, broke: results.filter((r) => r.broke).length, brokeMissed: results.filter((r) => r.broke && !r.hit).length } } : {}),
    };
  });
  // Rank only analysts with scored calls: hit rate first, then smaller error.
  const ranked = board.filter((b) => b.scored > 0).sort((a, b) => b.hitRate! - a.hitRate! || a.medianErrorPct! - b.medianErrorPct!);
  ranked.forEach((b, i) => { b.rank = i + 1; });
  return [...ranked, ...board.filter((b) => b.scored === 0)];
}

/** G-228: below this many scored calls an analyst's record is too thin to weigh it by skill. */
export const SKILL_MIN_SCORED = 30;

/**
 * G-228: the committee's one number. Each analyst's call becomes a chance the price is higher in 20
 * sessions (BULLISH: its confidence, BEARISH: 100 minus it, NEUTRAL: 50), and the chances are averaged in
 * log-odds, which beats a plain mean or median for pooling forecasts (ForecastBench, Karger et al. 2024;
 * Satopää et al. 2014). An analyst with 30+ scored calls on the stock is weighted by its Brier skill
 * (1 − brier/0.25, at least 0.1); the rest weigh 1. Null without calls.
 */
export function committeeConsensus(
  calls: readonly { analyst: AnalystId; stance: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; confidence: number }[],
  board: readonly Pick<AnalystScore, 'analyst' | 'scored' | 'brier'>[] = [],
): { upPct: number; weighted: boolean; n: number } | null {
  if (!calls.length) return null;
  const logit = (p: number) => Math.log(p / (1 - p));
  let sum = 0, weights = 0, weighted = false;
  for (const c of calls) {
    const conf = Math.max(2, Math.min(98, c.confidence)) / 100;
    const up = c.stance === 'BULLISH' ? conf : c.stance === 'BEARISH' ? 1 - conf : 0.5;
    const rec = board.find((b) => b.analyst === c.analyst);
    const w = rec && rec.scored >= SKILL_MIN_SCORED && rec.brier != null ? Math.max(0.1, 1 - rec.brier / 0.25) : 1;
    if (w !== 1) weighted = true;
    sum += w * logit(up); weights += w;
  }
  return { upPct: Math.round(100 / (1 + Math.exp(-sum / weights))), weighted, n: calls.length };
}
