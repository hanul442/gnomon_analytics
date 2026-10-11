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
] as const;

export type AnalystId = typeof ANALYSTS[number]['id'];

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
  pending: number;
  latest: AnalystCall | null;
  rank: number | null;
  /** G-213: this analyst's last calls on the stock, newest first, each with how it is doing or how it ended. */
  calls?: AnalystTrack[];
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
}
export const TRACK_KEEP = 5;
const hitOf = (c: AnalystCall, close: number) => {
  const move = close / c.baseClose - 1;
  if (c.stance === 'NEUTRAL') return Math.abs(move) <= 0.02;
  return Math.sign(c.target - c.baseClose) === Math.sign(move);
};

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
    const results: { hit: boolean; err: number }[] = [];
    let pending = 0;
    const last = sorted.at(-1);
    const track = (c: AnalystCall, i: number | undefined, outcome: { date: string; close: number } | undefined): AnalystTrack => {
      const at = outcome ?? (i === undefined ? undefined : last);
      const sessions = outcome ? ANALYST_HORIZON : i === undefined ? 0 : sorted.length - 1 - i;
      return {
        reportDate: c.reportDate, baseDate: c.baseDate, baseClose: c.baseClose, stance: c.stance, confidence: c.confidence, target: c.target,
        sessions, close: at?.close ?? null, closeDate: at?.date ?? null, done: !!outcome,
        hit: !at || (!outcome && (sessions === 0 || (c.stance !== 'NEUTRAL' && at.close === c.baseClose))) ? null : hitOf(c, at.close),
      };
    };
    const tracked: AnalystTrack[] = [];
    for (const c of mine) {
      const i = idx.get(c.baseDate);
      const outcome = i === undefined ? undefined : sorted[i + ANALYST_HORIZON];
      tracked.push(track(c, i, outcome));
      if (!outcome) { pending += 1; continue; }
      results.push({ hit: hitOf(c, outcome.close), err: Math.abs(outcome.close / c.target - 1) * 100 });
    }
    return {
      analyst: a.id, name: a.name, scored: results.length,
      hitRate: results.length ? results.filter((r) => r.hit).length / results.length : null,
      medianErrorPct: results.length ? median(results.map((r) => r.err)) : null,
      pending, latest: mine.at(-1) ?? null, rank: null as number | null,
      calls: tracked.slice(-TRACK_KEEP).reverse(),
    };
  });
  // Rank only analysts with scored calls: hit rate first, then smaller error.
  const ranked = board.filter((b) => b.scored > 0).sort((a, b) => b.hitRate! - a.hitRate! || a.medianErrorPct! - b.medianErrorPct!);
  ranked.forEach((b, i) => { b.rank = i + 1; });
  return [...ranked, ...board.filter((b) => b.scored === 0)];
}
