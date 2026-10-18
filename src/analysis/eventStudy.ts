// G-230: what usually followed each kind of filing. For every logged event filing whose 20 sessions have
// passed by the report date, the stock's return from the filing day's close to 20 sessions later minus the
// KOSPI's over the same sessions. A stock filing the same kind again within 20 sessions counts once. Only
// filings and prices known before the report date are used (no look-ahead). The committee starts from
// these base rates before reading the filing itself (reference-class forecasting). Pure.

import type { EventFiling, EventKey } from './edge.js';
import { EVENT_RULES } from './edge.js';

export const EVENT_HORIZON = 20;
export const BASE_RATE_MIN = 20;
export interface EventBaseRate { key: EventKey; label: string; n: number; upPct: number; medianExcessPct: number; from: string; to: string }
type Bar = { date: string; close: number };

const median = (xs: readonly number[]) => { const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };

export function eventBaseRates(events: readonly EventFiling[], prices: ReadonlyMap<string, readonly Bar[]>, bench: readonly Bar[], asOf: string): EventBaseRate[] {
  const bIdx = new Map(bench.map((b, i) => [b.date, i]));
  const sortedBy = new Map<string, { bars: Bar[]; idx: Map<string, number> }>();
  const view = (symbol: string) => {
    let v = sortedBy.get(symbol);
    if (!v) { const bars = [...(prices.get(symbol) ?? [])].filter((b) => b.date <= asOf).sort((a, b) => a.date.localeCompare(b.date)); v = { bars, idx: new Map(bars.map((b, i) => [b.date, i])) }; sortedBy.set(symbol, v); }
    return v;
  };
  const samples = new Map<EventKey, { x: number; date: string }[]>();
  const lastUsed = new Map<string, number>(); // symbol:key → base index of the last counted filing
  for (const e of [...new Map(events.map((x) => [x.receiptNo, x])).values()].filter((x) => x.date < asOf).sort((a, b) => a.date.localeCompare(b.date))) {
    if (!prices.has(e.symbol)) continue;
    const { bars } = view(e.symbol);
    let i = -1; for (let k = bars.length - 1; k >= 0; k -= 1) if (bars[k]!.date <= e.date) { i = k; break; }
    if (i < 0 || i + EVENT_HORIZON >= bars.length) continue;
    const used = lastUsed.get(`${e.symbol}:${e.key}`);
    if (used !== undefined && i - used < EVENT_HORIZON) continue;
    const a = bars[i]!, z = bars[i + EVENT_HORIZON]!;
    const ba = bIdx.get(a.date), bz = bIdx.get(z.date);
    if (ba === undefined || bz === undefined) continue;
    lastUsed.set(`${e.symbol}:${e.key}`, i);
    const x = ((z.close / a.close) - (bench[bz]!.close / bench[ba]!.close)) * 100;
    const xs = samples.get(e.key) ?? []; xs.push({ x, date: e.date }); samples.set(e.key, xs);
  }
  return EVENT_RULES.flatMap((r) => {
    const xs = samples.get(r.key) ?? [];
    if (!xs.length) return [];
    return [{ key: r.key, label: r.label, n: xs.length, upPct: (xs.filter((s) => s.x > 0).length / xs.length) * 100, medianExcessPct: median(xs.map((s) => s.x)), from: xs[0]!.date, to: xs.at(-1)!.date }];
  });
}

/** The base rates for the kinds this stock filed lately, with enough cases; as one evidence line. */
export function baseRateText(rates: readonly EventBaseRate[]): string {
  return rates.map((r) => `${r.label} 공시 뒤 ${EVENT_HORIZON}거래일(공시일 종가부터, 코스피 대비): ${r.n}건 중 시장보다 오른 비율 ${Math.round(r.upPct)}%, 초과 수익 중앙값 ${r.medianExcessPct > 0 ? '+' : ''}${r.medianExcessPct.toFixed(1)}%p (${r.from}~${r.to} 공시)`).join('. ')
    + '. GNOMON이 모은 공시와 가격 기록에서 센 값이라 표본이 작을 수 있어요.';
}
