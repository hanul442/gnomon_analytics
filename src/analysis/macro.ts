// G-230: the macro backdrop every stock shares (US rates, the won, US volatility), as one evidence line for
// the committee. Same for every stock and every reader. Pure: reads points dated on or before the report.

import { MACRO_SERIES, type MacroPoint } from '../sources/fred.js';

export interface MacroItem { id: string; label: string; unit: string; date: string; value: number; /** Change over about 20 sessions (points of the series). */ chg20: number | null; /** Where today sits in the last year's range, 0–100. */ rangePct: number | null }
export interface MacroSnapshot { items: MacroItem[] }

export function macroSnapshot(points: readonly MacroPoint[], date: string): MacroSnapshot | null {
  const items: MacroItem[] = [];
  for (const s of MACRO_SERIES) {
    const xs = points.filter((p) => p.series === s.id && p.date <= date).sort((a, b) => a.date.localeCompare(b.date));
    const last = xs.at(-1);
    if (!last || last.date < shift(date, -14)) continue; // stale
    const prev = xs.at(-21);
    const year = xs.filter((p) => p.date >= shift(date, -365)).map((p) => p.value);
    const lo = Math.min(...year), hi = Math.max(...year);
    items.push({ id: s.id, label: s.label, unit: s.unit, date: last.date, value: last.value, chg20: prev ? last.value - prev.value : null, rangePct: hi > lo ? ((last.value - lo) / (hi - lo)) * 100 : null });
  }
  return items.length ? { items } : null;
}

const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const fmt = (v: number, unit: string) => (unit === '원' ? `${v.toFixed(1)}원` : unit === '%' ? `${v.toFixed(2)}%` : v.toFixed(1));
const signed = (v: number, unit: string) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${unit === '%' ? `${Math.abs(v * 100).toFixed(0)}bp` : unit === '원' ? `${Math.abs(v).toFixed(1)}원` : Math.abs(v).toFixed(1)}`;

/** One line per series: value (date), 20-session change, place in the year's range. */
export const macroText = (m: MacroSnapshot) => m.items.map((x) =>
  `${x.label} ${fmt(x.value, x.unit)}(${x.date})${x.chg20 != null ? `, 20거래일 ${signed(x.chg20, x.unit)}` : ''}${x.rangePct != null ? `, 1년 범위의 ${Math.round(x.rangePct)}% 위치` : ''}`).join('. ') + '. 미국 자료(FRED)라 하루 늦게 반영돼요.';
