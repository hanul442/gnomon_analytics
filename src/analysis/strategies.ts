// Strategy arena (docs/DESIGN.md §5.5): technical strategies re-written from
// BLACK ORACLE BOT (trendMomentum, meanReversion, marketStructure,
// volumeAbsorption, factor momentum) and back-tested on the stock's own daily
// history, long or flat. Pure, deterministic (seeded Monte Carlo).
//
// No look-ahead: the position decided at a session's close earns the next
// session's close-to-close return. Each round trip pays ARENA_COST.
// Ranking uses the out-of-sample part (last 30% of the history) so a strategy
// fitted to the past does not win by memory. This is a comparison of rules on
// past prices, not a promise about future returns.

export const ARENA_METHOD = 'gnm-arena-v1';
/** Round-trip cost: fees both ways plus the securities transaction tax (approximate). */
export const ARENA_COST = 0.0025;
const OOS_SHARE = 0.3;

export interface ArenaBar { date: string; open: number; high: number; low: number; close: number; volume: number }

type Position = 0 | 1;

interface Ctx {
  close: number[]; high: number[]; low: number[]; volume: number[];
  ema20: (number | null)[]; ema60: (number | null)[]; sma20: (number | null)[]; sd20: (number | null)[];
  rsi14: (number | null)[]; macd: (number | null)[]; macdSignal: (number | null)[]; atr14: (number | null)[];
  hi20: (number | null)[]; lo20: (number | null)[]; lo10: (number | null)[]; vol20: (number | null)[]; roc60: (number | null)[];
}

export interface StrategyDef {
  key: string;
  name: string;
  /** Which BOT desk/persona the rule comes from. */
  origin: string;
  rule: string;
  /** Next position given the current one, at index i (using data up to i only). */
  /** `state` is fresh for each backtest, for rules that remember (days held, peak). */
  step(ctx: Ctx, i: number, pos: Position, state: Record<string, number>): Position;
  /** −1 (bearish) … +1 (bullish) reading of the rule today. */
  score(ctx: Ctx, i: number): number | null;
  /** Target and invalidation prices for today's reading. */
  levels(ctx: Ctx, i: number, pos: Position): { target: number | null; invalidation: number | null; trigger: string };
}

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));

function ema(a: readonly number[], n: number): (number | null)[] {
  const out: (number | null)[] = []; const k = 2 / (n + 1); let p: number | null = null;
  a.forEach((v, i) => { p = p === null ? v : v * k + p * (1 - k); out.push(i >= n - 1 ? p : null); });
  return out;
}
function sma(a: readonly number[], n: number): (number | null)[] {
  const out: (number | null)[] = []; let s = 0;
  a.forEach((v, i) => { s += v; if (i >= n) s -= a[i - n]!; out.push(i >= n - 1 ? s / n : null); });
  return out;
}
function rolling(a: readonly number[], n: number, f: (w: number[]) => number): (number | null)[] {
  return a.map((_, i) => (i >= n - 1 ? f(a.slice(i - n + 1, i + 1)) : null));
}

export function context(bars: readonly ArenaBar[]): Ctx {
  const close = bars.map((b) => b.close), high = bars.map((b) => b.high), low = bars.map((b) => b.low), volume = bars.map((b) => b.volume);
  const sma20 = sma(close, 20);
  const sd20 = close.map((_, i) => (i < 19 ? null : Math.sqrt(close.slice(i - 19, i + 1).reduce((s, c) => s + (c - sma20[i]!) ** 2, 0) / 20)));
  const rsi14: (number | null)[] = close.map(() => null);
  let g = 0, l = 0;
  for (let i = 1; i < close.length; i += 1) {
    const d = close[i]! - close[i - 1]!;
    if (i <= 14) { g += Math.max(d, 0); l += Math.max(-d, 0); if (i === 14) { g /= 14; l /= 14; rsi14[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } continue; }
    g = (g * 13 + Math.max(d, 0)) / 14; l = (l * 13 + Math.max(-d, 0)) / 14;
    rsi14[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  const e12 = ema(close, 12), e26 = ema(close, 26);
  const macd = close.map((_, i) => (e26[i] === null ? null : e12[i]! - e26[i]!));
  const first = macd.findIndex((v) => v !== null);
  const macdSignal: (number | null)[] = close.map(() => null);
  if (first >= 0) ema(macd.slice(first) as number[], 9).forEach((v, j) => { macdSignal[first + j] = v; });
  const tr = bars.map((b, i) => (i ? Math.max(b.high - b.low, Math.abs(b.high - close[i - 1]!), Math.abs(b.low - close[i - 1]!)) : b.high - b.low));
  const atr14: (number | null)[] = []; let a: number | null = null;
  tr.forEach((t, i) => { a = a === null ? t : (a * 13 + t) / 14; atr14.push(i >= 14 ? a : null); });
  // Channels use the 20 sessions before today, so today's close can break them.
  const prior = (src: number[], n: number, f: (w: number[]) => number) => src.map((_, i) => (i >= n ? f(src.slice(i - n, i)) : null));
  return {
    close, high, low, volume, ema20: ema(close, 20), ema60: ema(close, 60), sma20, sd20, rsi14, macd, macdSignal, atr14,
    hi20: prior(high, 20, (w) => Math.max(...w)), lo20: prior(low, 20, (w) => Math.min(...w)), lo10: prior(low, 10, (w) => Math.min(...w)),
    vol20: prior(volume, 20, (w) => w.reduce((s, v) => s + v, 0) / w.length),
    roc60: close.map((c, i) => (i >= 60 ? (c / close[i - 60]! - 1) * 100 : null)),
  };
}

const won = (v: number) => `${Math.round(v).toLocaleString('ko-KR')}원`;

export const STRATEGIES: readonly StrategyDef[] = [
  {
    key: 'trend', name: '추세 추종', origin: 'BOT 추세·모멘텀 PM', rule: '20일 지수이동평균이 60일 위에 있고 종가가 20일선 위면 보유, 종가가 60일선 아래로 내려가면 정리',
    step: (c, i, pos) => {
      const e20 = c.ema20[i], e60 = c.ema60[i]; if (e20 == null || e60 == null) return 0;
      if (!pos) return e20 > e60 && c.close[i]! > e20 ? 1 : 0;
      return c.close[i]! < e60 ? 0 : 1;
    },
    score: (c, i) => (c.ema20[i] == null || c.ema60[i] == null ? null : clamp((c.ema20[i]! / c.ema60[i]! - 1) / 0.08)),
    levels: (c, i, pos) => ({ target: c.atr14[i] == null ? null : c.close[i]! + 2 * c.atr14[i]!, invalidation: c.ema60[i] ?? null, trigger: pos ? `60일선 ${c.ema60[i] == null ? '' : won(c.ema60[i]!)} 아래 마감 시 정리` : `20일선이 60일선 위로 올라오고 종가가 20일선 위면 진입` }),
  },
  {
    key: 'macd', name: 'MACD 교차', origin: 'BOT 추세·모멘텀 PM', rule: 'MACD선이 시그널선 위면 보유, 아래로 내려가면 정리',
    step: (c, i) => (c.macd[i] == null || c.macdSignal[i] == null ? 0 : c.macd[i]! > c.macdSignal[i]! ? 1 : 0),
    score: (c, i) => (c.macd[i] == null || c.macdSignal[i] == null || !c.atr14[i] ? null : clamp((c.macd[i]! - c.macdSignal[i]!) / (0.5 * c.atr14[i]!))),
    levels: (c, i, pos) => ({ target: c.atr14[i] == null ? null : c.close[i]! + 1.5 * c.atr14[i]!, invalidation: c.atr14[i] == null ? null : c.close[i]! - 1.5 * c.atr14[i]!, trigger: pos ? 'MACD선이 시그널선 아래로 내려가면 정리' : 'MACD선이 시그널선 위로 올라오면 진입' }),
  },
  {
    key: 'meanrev', name: 'RSI 평균회귀', origin: 'BOT 평균회귀 PM', rule: 'RSI(14)가 30 아래면 매수, 55 위로 회복하거나 20거래일이 지나면 정리',
    step: (c, i, pos, st) => {
      const r = c.rsi14[i]; if (r == null) { st.held = 0; return 0; }
      if (!pos) { st.held = 0; return r < 30 ? 1 : 0; }
      st.held = (st.held ?? 0) + 1;
      return r > 55 || st.held >= 20 ? 0 : 1;
    },
    score: (c, i) => (c.rsi14[i] == null ? null : clamp((50 - c.rsi14[i]!) / 25)),
    levels: (c, i, pos) => ({ target: c.sma20[i] ?? null, invalidation: c.atr14[i] == null ? null : c.close[i]! - 2 * c.atr14[i]!, trigger: pos ? 'RSI 55 위 회복 또는 20거래일 경과 시 정리' : `RSI가 30 아래로 내려가면 진입 (지금 ${c.rsi14[i]?.toFixed(1) ?? '없음'})` }),
  },
  {
    key: 'bollinger', name: '볼린저 반등', origin: 'BOT 평균회귀 PM', rule: '종가가 볼린저 하단(20일, 2σ) 아래면 매수, 중심선에 닿으면 정리',
    step: (c, i, pos) => {
      const m = c.sma20[i], s = c.sd20[i]; if (m == null || s == null) return 0;
      if (!pos) return c.close[i]! < m - 2 * s ? 1 : 0;
      return c.close[i]! >= m ? 0 : 1;
    },
    score: (c, i) => (c.sma20[i] == null || !c.sd20[i] ? null : clamp(-(c.close[i]! - c.sma20[i]!) / (2 * c.sd20[i]!))),
    levels: (c, i, pos) => ({ target: c.sma20[i] ?? null, invalidation: c.sma20[i] == null || c.sd20[i] == null || c.atr14[i] == null ? null : c.sma20[i]! - 2 * c.sd20[i]! - c.atr14[i]!, trigger: pos ? '20일 중심선에 닿으면 정리' : `볼린저 하단 ${c.sma20[i] == null || c.sd20[i] == null ? '' : won(c.sma20[i]! - 2 * c.sd20[i]!)} 아래 마감 시 진입` }),
  },
  {
    key: 'breakout', name: '구조 돌파', origin: 'BOT 파동·시장 구조 분석가', rule: '종가가 직전 20거래일 최고가를 넘으면 보유, 직전 10거래일 최저가 아래로 내려가면 정리',
    step: (c, i, pos) => {
      const h = c.hi20[i], l = c.lo10[i]; if (h == null || l == null) return 0;
      if (!pos) return c.close[i]! > h ? 1 : 0;
      return c.close[i]! < l ? 0 : 1;
    },
    score: (c, i) => (c.hi20[i] == null || c.lo20[i] == null || c.hi20[i] === c.lo20[i] ? null : clamp(((c.close[i]! - c.lo20[i]!) / (c.hi20[i]! - c.lo20[i]!)) * 2 - 1)),
    levels: (c, i, pos) => ({ target: c.hi20[i] == null || c.lo20[i] == null ? null : Math.max(c.close[i]!, c.hi20[i]!) + (c.hi20[i]! - c.lo20[i]!), invalidation: c.lo10[i] ?? null, trigger: pos ? `10일 최저 ${c.lo10[i] == null ? '' : won(c.lo10[i]!)} 아래 마감 시 정리` : `20일 최고 ${c.hi20[i] == null ? '' : won(c.hi20[i]!)} 위 마감 시 진입` }),
  },
  {
    key: 'volume', name: '거래량 동반 돌파', origin: 'BOT 거래량·흡수 분석가', rule: '20일 최고가 돌파가 평균의 1.5배 넘는 거래량과 함께 나오면 매수, 고점에서 ATR 2배 밀리면 정리',
    step: (c, i, pos, st) => {
      const h = c.hi20[i], v = c.vol20[i], a = c.atr14[i]; if (h == null || v == null || a == null) return 0;
      if (!pos) { if (c.close[i]! > h && c.volume[i]! > 1.5 * v) { st.peak = c.close[i]!; return 1; } return 0; }
      st.peak = Math.max(st.peak ?? 0, c.close[i]!);
      return c.close[i]! < st.peak - 2 * a ? 0 : 1;
    },
    score: (c, i) => {
      if (c.hi20[i] == null || c.lo20[i] == null || c.vol20[i] == null || c.hi20[i] === c.lo20[i]) return null;
      const where = ((c.close[i]! - c.lo20[i]!) / (c.hi20[i]! - c.lo20[i]!)) * 2 - 1;
      return clamp(where * Math.min(1.5, c.volume[i]! / c.vol20[i]!) / 1.5);
    },
    levels: (c, i, pos) => ({ target: c.atr14[i] == null ? null : c.close[i]! + 3 * c.atr14[i]!, invalidation: c.atr14[i] == null ? null : c.close[i]! - 2 * c.atr14[i]!, trigger: pos ? '보유 중 고점에서 ATR 2배 하락 시 정리' : `20일 최고 ${c.hi20[i] == null ? '' : won(c.hi20[i]!)} 위, 거래량 평균 1.5배 이상이면 진입` }),
  },
  {
    key: 'momentum', name: '60일 모멘텀', origin: 'BOT 팩터 퀀트', rule: '60거래일 수익률이 0보다 크면 보유, 0 아래면 정리',
    step: (c, i) => (c.roc60[i] == null ? 0 : c.roc60[i]! > 0 ? 1 : 0),
    score: (c, i) => (c.roc60[i] == null ? null : clamp(c.roc60[i]! / 30)),
    levels: (c, i, pos) => ({ target: c.roc60[i] == null ? null : c.close[i]! * (1 + c.roc60[i]! / 100 / 3), invalidation: i >= 60 ? c.close[i - 60]! : null, trigger: pos ? `60거래일 전 가격 ${i >= 60 ? won(c.close[i - 60]!) : ''} 아래로 내려가면 정리` : `60거래일 전 가격 ${i >= 60 ? won(c.close[i - 60]!) : ''} 위로 올라오면 진입` }),
  },
  {
    key: 'hold', name: '매수 후 보유', origin: '기준선', rule: '처음부터 끝까지 보유 (비교 기준)',
    step: () => 1,
    score: () => null,
    levels: () => ({ target: null, invalidation: null, trigger: '비교 기준이에요' }),
  },
];

/** One round trip: the rule's signal sessions and their closes (the backtest trades at those closes). */
export interface TradeRecord { entry: string; entryPrice: number; exit: string | null; exitPrice: number | null; ret: number }

export interface StrategyResult {
  key: string; name: string; origin: string; rule: string;
  /** Whole history. */
  totalReturn: number; cagr: number | null; sharpe: number | null; maxDrawdown: number; trades: number; winRate: number | null; exposure: number;
  /** Out-of-sample (last 30%). */
  oosReturn: number; oosSharpe: number | null; oosMaxDrawdown: number; oosTrades: number;
  /** Round trips, oldest first (at most the last 80); an open trade has no exit. */
  tradeLog: TradeRecord[];
  /** Equity curve, 1 = start, sampled to at most 120 points. */
  equity: number[];
  monteCarlo: { p05: number; p50: number; p95: number; lossProbability: number } | null;
  position: Position;
  score: number | null;
  target: number | null;
  invalidation: number | null;
  trigger: string;
  rank: number;
  beatsHold: boolean | null;
  qualified: boolean;
}

export interface ArenaResult {
  method: typeof ARENA_METHOD;
  sessionDate: string;
  from: string;
  oosFrom: string;
  bars: number;
  cost: number;
  results: StrategyResult[];
  championKey: string | null;
}

function stats(daily: readonly number[]): { sharpe: number | null; mdd: number; total: number } {
  let eq = 1, peak = 1, mdd = 0;
  for (const r of daily) { eq *= 1 + r; peak = Math.max(peak, eq); mdd = Math.min(mdd, eq / peak - 1); }
  const n = daily.length;
  const mean = n ? daily.reduce((s, r) => s + r, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(daily.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1)) : 0;
  return { sharpe: sd > 0 ? (mean / sd) * Math.sqrt(250) : null, mdd, total: eq - 1 };
}

/** Deterministic PRNG (mulberry32) so the Monte Carlo is reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Bootstraps trade returns: 2000 paths of as many trades as were taken. */
export function monteCarlo(tradeReturns: readonly number[], paths = 2000, seed = 20261004): StrategyResult['monteCarlo'] {
  if (tradeReturns.length < 3) return null;
  const rand = rng(seed);
  const finals: number[] = [];
  for (let p = 0; p < paths; p += 1) {
    let eq = 1;
    for (let k = 0; k < tradeReturns.length; k += 1) eq *= 1 + tradeReturns[Math.floor(rand() * tradeReturns.length)]!;
    finals.push(eq - 1);
  }
  finals.sort((a, b) => a - b);
  const q = (x: number) => finals[Math.min(finals.length - 1, Math.floor(x * finals.length))]!;
  return { p05: q(0.05), p50: q(0.5), p95: q(0.95), lossProbability: finals.filter((f) => f < 0).length / finals.length };
}

export function backtest(def: StrategyDef, bars: readonly ArenaBar[], ctx = context(bars)): Omit<StrategyResult, 'rank' | 'beatsHold' | 'qualified'> {
  const n = bars.length;
  const positions: Position[] = [];
  let pos: Position = 0;
  const state: Record<string, number> = {};
  for (let i = 0; i < n; i += 1) { pos = def.step(ctx, i, pos, state); positions.push(pos); }
  // Daily strategy returns: position at i-1 earns the move from i-1 to i; a change of position pays half the round-trip cost.
  const daily: number[] = [];
  const trades: TradeRecord[] = [];
  let open: { entry: string; price: number; eq: number } | null = null, eq = 1;
  for (let i = 1; i < n; i += 1) {
    const held = positions[i - 1]!;
    let r = held ? ctx.close[i]! / ctx.close[i - 1]! - 1 : 0;
    const prevPos = i >= 2 ? positions[i - 2]! : 0;
    if (held !== prevPos) r -= ARENA_COST / 2;
    eq *= 1 + r; daily.push(r);
    if (held && !prevPos) open = { entry: bars[i - 1]!.date, price: ctx.close[i - 1]!, eq: eq / (1 + r) };
    if (!held && prevPos && open) { trades.push({ entry: open.entry, entryPrice: open.price, exit: bars[i - 1]!.date, exitPrice: ctx.close[i - 1]!, ret: eq / open.eq - 1 }); open = null; }
  }
  if (open) trades.push({ entry: open.entry, entryPrice: open.price, exit: null, exitPrice: null, ret: eq / open.eq - 1 });
  const split = Math.floor(n * (1 - OOS_SHARE));
  const all = stats(daily), oos = stats(daily.slice(split - 1));
  const years = (n - 1) / 250;
  let curve = 1;
  const equityFull = [1, ...daily.map((r) => (curve *= 1 + r))];
  const stride = Math.max(1, Math.ceil(equityFull.length / 120));
  const equity = equityFull.filter((_, i) => i % stride === 0 || i === equityFull.length - 1);
  const last = n - 1;
  const lv = def.levels(ctx, last, positions[last]!);
  const oosTrades = trades.filter((t) => t.entry >= bars[split]!.date).length;
  return {
    key: def.key, name: def.name, origin: def.origin, rule: def.rule,
    totalReturn: all.total, cagr: years >= 0.5 ? (1 + all.total) ** (1 / years) - 1 : null, sharpe: all.sharpe, maxDrawdown: all.mdd,
    trades: trades.length, winRate: trades.length ? trades.filter((t) => t.ret > 0).length / trades.length : null,
    exposure: positions.reduce<number>((s, p) => s + p, 0) / n,
    oosReturn: oos.total, oosSharpe: oos.sharpe, oosMaxDrawdown: oos.mdd, oosTrades,
    tradeLog: trades.slice(-80), equity, monteCarlo: def.key === 'hold' ? null : monteCarlo(trades.map((t) => t.ret)),
    position: positions[last]!, score: def.score(ctx, last), target: lv.target, invalidation: lv.invalidation, trigger: lv.trigger,
  };
}

/**
 * Runs every strategy and ranks them by out-of-sample Sharpe. A strategy
 * needs at least two trades in total to qualify for the title; buy-and-hold
 * is ranked too, as the bar to beat.
 */
export function runArena(input: readonly ArenaBar[]): ArenaResult | null {
  const bars = [...input].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (bars.length < 120) return null;
  const ctx = context(bars);
  const raw = STRATEGIES.map((d) => backtest(d, bars, ctx));
  const hold = raw.find((r) => r.key === 'hold')!;
  const ranked = raw
    .map((r) => ({ ...r, qualified: r.key === 'hold' || r.trades >= 2, beatsHold: r.key === 'hold' ? null : r.oosReturn > hold.oosReturn }))
    .sort((a, b) => Number(b.qualified) - Number(a.qualified) || (b.oosSharpe ?? -9) - (a.oosSharpe ?? -9) || b.totalReturn - a.totalReturn)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const champion = ranked.find((r) => r.qualified && r.key !== 'hold');
  const split = Math.floor(bars.length * (1 - OOS_SHARE));
  return { method: ARENA_METHOD, sessionDate: bars.at(-1)!.date, from: bars[0]!.date, oosFrom: bars[split]!.date, bars: bars.length, cost: ARENA_COST, results: ranked, championKey: champion?.key ?? null };
}
