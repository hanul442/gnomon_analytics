// Screener signal track record (docs/DESIGN.md §5.16, G-53): each session, the top stocks of every
// ready-made screen are written down with their close; 5 and 20 sessions later they are scored
// against their own close and their market index. Shown to everyone on the scorecard. Pure.

import { FIELD_INDEX, matches, PRESETS } from './screenRules.js';

export const SIGNAL_METHOD = 'gnm-signal-v1';
export const SIGNAL_HORIZONS = [5, 20] as const;
const PER_PRESET = 10;

export interface SignalRecord { date: string; preset: string; symbol: string; market: 'P' | 'Q'; close: number; method: typeof SIGNAL_METHOD }
export interface SignalScore { date: string; preset: string; symbol: string; horizon: number; scoredOn: string; returnPct: number; indexPct: number | null; excessPct: number | null }

/** How each preset picks its top ten (the same order its screener view defaults to). */
const ORDER: Record<string, (r: readonly unknown[]) => number> = {
  volsurge: (r) => Number(r[14] ?? 0), accum: (r) => Number(r[17] ?? 0), breakout: (r) => Number(r[15] ?? 0),
  value: (r) => -Number(r[11] ?? 0), rebound: (r) => -Number(r[9] ?? 0), hot: (r) => Number(r[11] ?? 0), risky: (r) => Number(r[21] ?? 0),
};

/** Today's picks: the top ten rows of each ready-made screen. */
export function todaysSignals(rows: readonly (readonly unknown[])[], date: string): SignalRecord[] {
  const out: SignalRecord[] = [];
  for (const p of PRESETS) {
    const key = ORDER[p.key] ?? ((r: readonly unknown[]) => Number(r[7] ?? -999));
    const hits = rows.filter((r) => matches(r, p.screen, FIELD_INDEX) && Number(r[4]) > 0).sort((a, b) => key(b) - key(a)).slice(0, PER_PRESET);
    for (const r of hits) out.push({ date, preset: p.key, symbol: String(r[0]), market: r[2] === 'Q' ? 'Q' : 'P', close: Number(r[4]), method: SIGNAL_METHOD });
  }
  return out;
}

/**
 * Scores every signal that has reached a horizon by `today` and is not scored yet. `sessions` are the
 * market's trading dates (ascending); a signal is scored on the first run at or after its horizon.
 */
export function scoreSignals(input: {
  signals: readonly SignalRecord[]; scored: ReadonlySet<string>; today: string; sessions: readonly string[];
  closeNow: ReadonlyMap<string, number>; index: { P: ReadonlyMap<string, number>; Q: ReadonlyMap<string, number> };
}): SignalScore[] {
  const out: SignalScore[] = [];
  const nowIdx = input.sessions.filter((d) => d <= input.today).length - 1;
  const idxNow = (m: 'P' | 'Q') => input.index[m].get(input.sessions[nowIdx] ?? '') ?? null;
  for (const s of input.signals) {
    const close = input.closeNow.get(s.symbol);
    if (!close) continue;
    const at = input.sessions.indexOf(s.date);
    if (at < 0) continue;
    for (const h of SIGNAL_HORIZONS) {
      if (nowIdx - at < h || input.scored.has(scoreKey(s, h))) continue;
      const i0 = input.index[s.market].get(s.date), i1 = idxNow(s.market);
      const ret = (close / s.close - 1) * 100, idx = i0 && i1 ? (i1 / i0 - 1) * 100 : null;
      out.push({ date: s.date, preset: s.preset, symbol: s.symbol, horizon: h, scoredOn: input.today, returnPct: round(ret), indexPct: idx == null ? null : round(idx), excessPct: idx == null ? null : round(ret - idx) });
    }
  }
  return out;
}

export const scoreKey = (s: { date: string; preset: string; symbol: string }, h: number) => `${s.date}|${s.preset}|${s.symbol}|${h}`;
const round = (v: number) => Math.round(v * 100) / 100;

export interface SignalBoardRow { preset: string; horizon: number; n: number; avgPct: number; hitRate: number; avgExcessPct: number | null; beatRate: number | null }

/** Per preset and horizon: how many, average return, share that rose, average and share beating the index. */
export function signalBoard(scores: readonly SignalScore[]): SignalBoardRow[] {
  const groups = new Map<string, SignalScore[]>();
  for (const s of scores) (groups.get(`${s.preset}|${s.horizon}`) ?? groups.set(`${s.preset}|${s.horizon}`, []).get(`${s.preset}|${s.horizon}`)!).push(s);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return [...groups.entries()].map(([k, xs]) => {
    const [preset, h] = k.split('|');
    const ex = xs.map((x) => x.excessPct).filter((v): v is number => v != null);
    return { preset: preset!, horizon: Number(h), n: xs.length, avgPct: round(avg(xs.map((x) => x.returnPct))), hitRate: xs.filter((x) => x.returnPct > 0).length / xs.length,
      avgExcessPct: ex.length ? round(avg(ex)) : null, beatRate: ex.length ? ex.filter((v) => v > 0).length / ex.length : null };
  }).sort((a, b) => PRESETS.findIndex((p) => p.key === a.preset) - PRESETS.findIndex((p) => p.key === b.preset) || a.horizon - b.horizon);
}
