// Hidden-future evaluation (G-244). Past prices are cut at a session, everything after it is hidden, and each
// predictor makes the same call the live committee makes: a stance, a confidence and a price 20 sessions ahead.
// The call is then scored against the hidden 20 sessions with the live rules (analysts.ts hitOf: direction, or
// ±2% for NEUTRAL; Brier score of the confidence; target error). Pure.
//
// Two kinds of predictor:
//  - the strategy-arena rules (strategies.ts), walked forward over every stock. A rule is long or flat, so its
//    stance comes from its position and reading, and its confidence is its own pooled record up to the cutoff
//    (only calls whose 20 sessions ended before the cutoff count), so nothing after the cutoff leaks in.
//  - the AI analysts (PMs), blind: no ticker, no name, no dates, prices rescaled so the cutoff close is 100 and
//    volumes so the 20-session average is 100. A model may have seen these prices in training; hiding what and
//    when it is makes recall much harder, but it does not prove the model cannot recognise a famous chart.
//
// Internal research and a public methodology note, not an advertisement of returns.

import { hitOf, type AnalystCall, type AnalystId } from './analysts.js';
import type { EvidenceItem } from './commentary.js';
import { volumeRead } from './quickCalc.js';
import { context, STRATEGIES, type ArenaBar } from './strategies.js';
import { structureSnapshot } from './structure.js';
import { horizonMomentum, summarizeTechnicals, technicalReason } from './technicals.js';
import { forecastRanges, technicalFairValue } from './valuation.js';

export const BLIND_METHOD = 'gnm-blind-v1';
export const EVAL_HORIZON = 20;
/** Sessions of history a predictor sees before the cutoff (indicators need 120, the forecast range 121+). */
export const MIN_HISTORY = 250;
/** A rule's confidence falls back to 50 until it has this many finished calls of that stance before the cutoff. */
export const MIN_RECORD = 30;
/** The PMs whose lens is price and volume only; fundamentals and news cannot be shown without naming the stock. */
export const BLIND_ANALYSTS: readonly AnalystId[] = ['trend_momentum', 'mean_reversion', 'wave_structure', 'volume_flow'];

export type Stance = AnalystCall['stance'];
export interface EvalCall { predictor: string; symbol: string; baseIdx: number; baseDate: string; baseClose: number; stance: Stance; confidence: number; target: number }
export interface EvalOutcome extends EvalCall { close: number; outcomeDate: string; movePct: number; hit: boolean; errPct: number }

/** Sorted, one bar per date (the later line wins: the stores are append-only), positive closes only. */
export function cleanBars(rows: readonly ArenaBar[]): ArenaBar[] {
  const by = new Map<string, ArenaBar>();
  for (const r of rows) if (r && r.date && r.close > 0 && r.high > 0 && r.low > 0) by.set(r.date, { date: r.date, open: r.open || r.close, high: r.high, low: r.low, close: r.close, volume: r.volume || 0 });
  return [...by.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** The call scored against the close 20 sessions after its base, or null while that is still hidden in the data. */
export function outcomeOf(call: EvalCall, bars: readonly ArenaBar[]): EvalOutcome | null {
  const out = bars[call.baseIdx + EVAL_HORIZON];
  if (!out) return null;
  return { ...call, close: out.close, outcomeDate: out.date, movePct: (out.close / call.baseClose - 1) * 100, hit: hitOf(call, out.close), errPct: Math.abs(out.close / call.target - 1) * 100 };
}

// ---------- strategies, walked forward ----------

interface RawRuleCall { predictor: string; symbol: string; baseIdx: number; baseDate: string; baseClose: number; stance: Stance; outcomeDate: string | null; hit: boolean | null; movePct: number | null }

/** What a long-or-flat rule says today: holding is BULLISH; flat with a negative reading is BEARISH; otherwise NEUTRAL. */
export function ruleStance(position: 0 | 1, score: number | null): Stance {
  if (position) return 'BULLISH';
  return score != null && score < 0 ? 'BEARISH' : 'NEUTRAL';
}

/** Every rule's stance at every `step`-th session from MIN_HISTORY on, with the hidden outcome attached (null at the end). */
export function ruleCalls(symbol: string, bars: readonly ArenaBar[], step = 5): RawRuleCall[] {
  if (bars.length < MIN_HISTORY + 1) return [];
  const ctx = context(bars);
  const out: RawRuleCall[] = [];
  for (const def of STRATEGIES) {
    let pos: 0 | 1 = 0;
    const state: Record<string, number> = {};
    for (let i = 0; i < bars.length; i += 1) {
      pos = def.step(ctx, i, pos, state);
      if (i < MIN_HISTORY - 1 || (i - (MIN_HISTORY - 1)) % step) continue;
      const stance = def.key === 'hold' ? 'BULLISH' : ruleStance(pos, def.score(ctx, i));
      const o = bars[i + EVAL_HORIZON];
      const move = o ? o.close / bars[i]!.close - 1 : null;
      out.push({ predictor: def.key, symbol, baseIdx: i, baseDate: bars[i]!.date, baseClose: bars[i]!.close, stance, outcomeDate: o?.date ?? null,
        movePct: move == null ? null : move * 100, hit: move == null ? null : stance === 'NEUTRAL' ? Math.abs(move) <= 0.02 : stance === 'BULLISH' ? move > 0 : move < 0 });
    }
  }
  return out;
}

/**
 * Turns raw rule stances into scorable calls. Confidence = how often this rule's same stance was right, pooled
 * over every stock, counting only calls whose 20 sessions ended before this call's base date; the target moves
 * the base close by that record's average move (at least ±0.5% the stance's way). 50% and ±0.5% until MIN_RECORD.
 */
export function calibrateRuleCalls(raw: readonly RawRuleCall[]): EvalCall[] {
  const groups = new Map<string, RawRuleCall[]>();
  for (const r of raw) { const k = `${r.predictor}|${r.stance}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(r); }
  const out: EvalCall[] = [];
  for (const list of groups.values()) {
    const done = list.filter((r) => r.outcomeDate != null).sort((a, b) => (a.outcomeDate! < b.outcomeDate! ? -1 : 1));
    const hits: number[] = [0], moves: number[] = [0];
    for (const r of done) { hits.push(hits.at(-1)! + (r.hit ? 1 : 0)); moves.push(moves.at(-1)! + r.movePct!); }
    for (const r of list) {
      let lo = 0, hi = done.length; // number of finished calls with outcomeDate < baseDate
      while (lo < hi) { const m = (lo + hi) >> 1; if (done[m]!.outcomeDate! < r.baseDate) lo = m + 1; else hi = m; }
      const n = lo, enough = n >= MIN_RECORD;
      const confidence = enough ? (hits[n]! / n) * 100 : 50;
      const avg = enough ? moves[n]! / n : 0;
      const movePct = r.stance === 'BULLISH' ? Math.max(avg, 0.5) : r.stance === 'BEARISH' ? Math.min(avg, -0.5) : 0;
      out.push({ predictor: r.predictor, symbol: r.symbol, baseIdx: r.baseIdx, baseDate: r.baseDate, baseClose: r.baseClose, stance: r.stance, confidence, target: r.baseClose * (1 + movePct / 100) });
    }
  }
  return out;
}

// ---------- scoring ----------

export interface EvalBoardRow {
  predictor: string; n: number;
  /** Share of calls right by the live rule. */
  hitRate: number; brier: number; avgConfidence: number; medianErrPct: number;
  /**
   * Brier score of the chance the price is higher in 20 sessions that the call implies (upChance). Unlike
   * `brier`, every predictor answers the same question here, so a predictor cannot score well by making calls
   * it expects to miss at low confidence (a NEUTRAL call is a 50% chance). 0.25 = always 50%. The ranking key.
   */
  upBrier: number;
  /** Share of calls by stance. */
  stances: Record<Stance, number>;
  /** Hit rate of the BULLISH calls and their average 20-session move, %, vs the average move of every call. */
  bullHitRate: number | null; bullAvgMovePct: number | null; allAvgMovePct: number;
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: readonly number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2) : 0; };

/** One row per predictor, best up-chance Brier first. */
export function evalBoard(outcomes: readonly EvalOutcome[]): EvalBoardRow[] {
  const groups = new Map<string, EvalOutcome[]>();
  for (const o of outcomes) (groups.get(o.predictor) ?? groups.set(o.predictor, []).get(o.predictor)!).push(o);
  return [...groups.entries()].map(([predictor, xs]) => {
    const bull = xs.filter((x) => x.stance === 'BULLISH');
    const share = (s: Stance) => xs.filter((x) => x.stance === s).length / xs.length;
    return {
      predictor, n: xs.length,
      hitRate: xs.filter((x) => x.hit).length / xs.length,
      brier: mean(xs.map((x) => (Math.max(0, Math.min(100, x.confidence)) / 100 - (x.hit ? 1 : 0)) ** 2)),
      avgConfidence: mean(xs.map((x) => x.confidence)),
      medianErrPct: median(xs.map((x) => x.errPct)),
      upBrier: upBrier(xs.map((x) => ({ up: upChance(x), rose: x.movePct > 0 }))),
      stances: { BULLISH: share('BULLISH'), BEARISH: share('BEARISH'), NEUTRAL: share('NEUTRAL') },
      bullHitRate: bull.length ? bull.filter((x) => x.hit).length / bull.length : null,
      bullAvgMovePct: bull.length ? mean(bull.map((x) => x.movePct)) : null,
      allAvgMovePct: mean(xs.map((x) => x.movePct)),
    };
  }).sort((a, b) => a.upBrier - b.upBrier);
}

/** Chance the price is higher in 20 sessions implied by a call (as committeeConsensus reads it). */
export const upChance = (c: Pick<EvalCall, 'stance' | 'confidence'>) => (c.stance === 'BULLISH' ? c.confidence : c.stance === 'BEARISH' ? 100 - c.confidence : 50) / 100;

/** Brier score of "higher in 20 sessions" chances (0.25 = always 50%). */
export const upBrier = (xs: readonly { up: number; rose: boolean }[]) => mean(xs.map((x) => (x.up - (x.rose ? 1 : 0)) ** 2));

// ---------- the blind file ----------

/**
 * The history up to the cutoff with the stock hidden: dates become session numbers ('S0001'… so they still
 * sort), prices are scaled so the cutoff close is 100 and volumes so the last 20 sessions average 100.
 */
export function anonymize(bars: readonly ArenaBar[], cutoff: number, keep = MIN_HISTORY): ArenaBar[] {
  const w = bars.slice(Math.max(0, cutoff + 1 - keep), cutoff + 1);
  const k = 100 / w.at(-1)!.close;
  const v20 = mean(w.slice(-20).map((b) => b.volume)) || 1;
  return w.map((b, i) => ({ date: `S${String(i + 1).padStart(4, '0')}`, open: b.open * k, high: b.high * k, low: b.low * k, close: b.close * k, volume: (b.volume / v20) * 100 }));
}

const f1 = (v: number) => v.toFixed(1);
const sp = (v: number | null | undefined) => (v == null ? '없음' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`);

/**
 * The evidence a blind analyst reads, built from the anonymous bars with the same calculations as a live
 * report (technical votes, structure, fair value, forecast range, volume) but no names or dates: "n거래일 전".
 */
export function blindEvidence(anon: readonly ArenaBar[]): EvidenceItem[] {
  const n = anon.length, last = anon.at(-1)!;
  const ago = (d: string) => `${n - Number(d.slice(1))}거래일 전`;
  const items: EvidenceItem[] = [];
  const closes = anon.map((b) => b.close);
  const r = (k: number) => (n > k ? (last.close / closes[n - 1 - k]! - 1) * 100 : null);
  const lo20 = Math.min(...anon.slice(-20).map((b) => b.low)), hi20 = Math.max(...anon.slice(-20).map((b) => b.high));
  items.push({ id: 'P1', kind: 'PRICE', label: '기준일 가격 (100으로 환산)', url: '',
    detail: `종가 100.0, 전일 대비 ${sp(r(1))}, 5거래일 ${sp(r(5))}, 20거래일 ${sp(r(20))}, 거래량 20일 평균 대비 ${(last.volume / 100).toFixed(2)}배, 20일 범위 ${f1(lo20)}~${f1(hi20)}. 최근 60거래일 종가(오래된 것부터): ${closes.slice(-60).map(f1).join(' ')}` });
  const t = summarizeTechnicals(anon);
  const mom = horizonMomentum(anon).map((m) => `${m.label} ${m.trend ?? '기록 부족'}(${sp(m.returnPct)})`).join(', ');
  items.push({ id: 'T1', kind: 'TECHNICAL', label: `기술적 신호 ${t.label}`, url: '',
    detail: `${t.label}${t.score == null ? '' : ` (점수 ${t.score.toFixed(2)})`}, 강세 ${t.counts.bullish}·중립 ${t.counts.neutral}·약세 ${t.counts.bearish}·계산 불가 ${t.counts.abstained}. 모멘텀: ${mom}. ${technicalReason(t)}` });
  const fv = technicalFairValue(anon);
  if (fv) items.push({ id: 'V1', kind: 'VALUE', label: '기술적 적정가', url: '',
    detail: `중심 ${f1(fv.center)}, 범위 ${f1(fv.low)}~${f1(fv.high)}, 현재가 괴리 ${sp(fv.gapPct)} (${fv.position === 'ABOVE' ? '범위 위' : fv.position === 'BELOW' ? '범위 아래' : '범위 안'}). 기준값: ${fv.anchors.map((a) => `${a.label} ${f1(a.value)}`).join(', ')}` });
  const fc = forecastRanges('BLIND', anon, new Date(0)).filter((f) => f.horizon <= 20);
  if (fc.length) items.push({ id: 'R1', kind: 'FORECAST', label: '예측 범위', url: '', detail: fc.map((f) => `${f.horizon}거래일 하단 ${f1(f.p10)} 중앙 ${f1(f.p50)} 상단 ${f1(f.p90)}`).join('; ') });
  const st = structureSnapshot(anon);
  if (st) {
    const b = st.breaks.at(-1);
    items.push({ id: 'S1', kind: 'STRUCTURE', label: '가격 구조', url: '',
      detail: `일봉 ${st.bias}; 최근 돌파 ${b ? `${ago(b.date)} ${b.type} ${b.direction} (스윙 ${f1(b.brokenSwing.price)})` : '없음'}; 피보나치 ${st.fibonacci?.retracement != null ? `${(st.fibonacci.retracement * 100).toFixed(1)}%` : '없음'}; 지지·저항 ${st.levels.map((l) => `${l.kind === 'SUPPORT' ? '지지' : '저항'} ${f1(l.price)}`).join(', ')}; 볼린저 %B ${st.bollinger ? Math.round(st.bollinger.percentB * 100) : '없음'}; ATR14 ${st.atr14 == null ? '없음' : f1(st.atr14)}` });
  }
  const v = volumeRead(anon);
  if (v) items.push({ id: 'Q1', kind: 'FLOW', label: '거래량 흐름 (투자자별 수급 자료는 없어요)', url: '',
    detail: `오늘 거래량 20일 평균의 ${v.ratio1.toFixed(2)}배, 최근 5일 ${v.ratio5.toFixed(2)}배; 20일 VWAP 대비 ${sp(v.vwapGapPct)}; OBV 20일 ${v.obvPct.toFixed(0)}%${v.flow ? ` (${v.flow === 'ACCUM' ? '매집형' : '분산형'})` : ''}; 매집·분산(A/D) ${v.adPct?.toFixed(0) ?? '없음'}%; 최근 10일 최대 거래량 급증 ${v.spike10?.toFixed(1) ?? '없음'}배` });
  return items;
}

/** Which blind items each PM reads (its live lens, minus what a blind file cannot carry). */
export const BLIND_LENS: Record<string, readonly string[]> = {
  trend_momentum: ['P1', 'T1', 'S1', 'R1'],
  mean_reversion: ['P1', 'T1', 'V1', 'S1', 'R1'],
  wave_structure: ['P1', 'S1', 'V1', 'R1'],
  volume_flow: ['P1', 'Q1', 'R1'],
};

/** Added to the live analyst prompt for the blind run. */
export const BLIND_NOTE = '이번 자료는 평가용이에요. 종목 이름과 날짜는 가려져 있고, 가격은 기준일 종가를 100으로 바꾼 값, 거래량은 최근 20일 평균을 100으로 바꾼 값이에요. 어떤 종목인지 추측하지 말고 주어진 숫자로만 판단하세요. target은 100 기준 가격으로 답해요.';

/** Seeded PRNG (mulberry32), so a sample can be drawn again. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Draws `count` (stock, cutoff) pairs spread evenly over the years, each with its 20 hidden sessions available. */
export function drawSample(series: readonly { symbol: string; bars: readonly ArenaBar[] }[], count: number, seed: number): { symbol: string; cutoff: number }[] {
  const pool: { symbol: string; cutoff: number; year: string }[] = [];
  for (const s of series) for (let i = MIN_HISTORY - 1; i + EVAL_HORIZON < s.bars.length; i += 5) pool.push({ symbol: s.symbol, cutoff: i, year: s.bars[i]!.date.slice(0, 4) });
  const years = [...new Set(pool.map((p) => p.year))].sort();
  const rand = rng(seed);
  const out: { symbol: string; cutoff: number }[] = [];
  const per = Math.ceil(count / Math.max(1, years.length));
  for (const y of years) {
    const xs = pool.filter((p) => p.year === y);
    for (let k = 0; k < per && xs.length; k += 1) { const j = Math.floor(rand() * xs.length); out.push({ symbol: xs[j]!.symbol, cutoff: xs[j]!.cutoff }); xs.splice(j, 1); }
  }
  return out.slice(0, count);
}
