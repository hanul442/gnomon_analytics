// Paper-trading ledger (docs/DESIGN.md G-21). Every settled run records, per
// stock, the position each follower would hold from that close: the strategy
// champion, each AI analyst (long on a bullish call, flat otherwise) and buy
// and hold as the yardstick. Entries are logged as made and never revised;
// performance is replayed forward from the first entry, so nothing is known
// in hindsight. Long or flat only, with the arena's round-trip cost. Pure.

import { ANALYSTS } from './analysts.js';
import { ARENA_COST } from './strategies.js';
import type { ArenaResult } from './strategies.js';
import type { AnalystView } from './commentary.js';

export const PAPER_METHOD = 'gnm-paper-v1';
/** Virtual starting balance shown on the page; returns do not depend on it. */
export const PAPER_START_KRW = 10_000_000;

export interface PaperEntry {
  symbol: string;
  /** Session whose close the position starts from. */
  date: string;
  close: number;
  follower: string;
  label: string;
  position: 0 | 1;
  /** Why: the strategy followed, or the analyst's stance. */
  basis: string;
  method: typeof PAPER_METHOD;
  recordedAt: string;
}

export const paperKey = (e: PaperEntry) => `${e.symbol}:${e.follower}:${e.date}`;

/** Followers' positions as of one settled report. Analysts only when the AI ran. */
export function paperEntries(input: {
  symbol: string;
  sessionDate: string;
  close: number;
  arena: ArenaResult | null;
  analysts?: readonly AnalystView[] | undefined;
  recordedAt: string;
}): PaperEntry[] {
  const base = { symbol: input.symbol, date: input.sessionDate, close: input.close, method: PAPER_METHOD, recordedAt: input.recordedAt } as const;
  const out: PaperEntry[] = [{ ...base, follower: 'hold', label: '매수 후 보유', position: 1, basis: '기준선' }];
  const champ = input.arena?.results.find((r) => r.key === input.arena?.championKey);
  if (champ) out.push({ ...base, follower: 'champion', label: '전략 챔피언', position: champ.position, basis: champ.name });
  for (const v of input.analysts ?? []) {
    const a = ANALYSTS.find((x) => x.id === v.analyst);
    if (!a) continue;
    out.push({ ...base, follower: `analyst:${a.id}`, label: a.name, position: v.stance === 'BULLISH' ? 1 : 0, basis: v.stance === 'BULLISH' ? '강세' : v.stance === 'BEARISH' ? '약세' : '중립' });
  }
  return out;
}

export interface PaperTrade { date: string; action: 'BUY' | 'SELL'; price: number; basis: string }

export interface PaperBook {
  follower: string;
  label: string;
  since: string;
  /** Sessions replayed after the first entry. */
  sessions: number;
  totalReturn: number;
  balance: number;
  position: 0 | 1;
  basis: string;
  trades: PaperTrade[];
  /** Equity, 1 = start, one point per session from `since`. */
  equity: number[];
}

/**
 * Replays each follower: the position recorded at a session's close earns the
 * next session's return. A follower keeps its last position on days with no
 * entry (an analyst on a day the AI did not run). Changing position costs half
 * the round trip.
 */
export function paperBooks(entries: readonly PaperEntry[], bars: readonly { date: string; close: number }[]): PaperBook[] {
  const sorted = [...bars].sort((a, b) => (a.date < b.date ? -1 : 1));
  const byFollower = new Map<string, PaperEntry[]>();
  for (const e of entries) (byFollower.get(e.follower) ?? byFollower.set(e.follower, []).get(e.follower)!).push(e);
  const order = (f: string) => (f === 'champion' ? 0 : f === 'hold' ? 2 : 1);
  return [...byFollower.entries()].sort(([a], [b]) => order(a) - order(b) || (a < b ? -1 : 1)).map(([follower, list]) => {
    const es = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));
    const at = new Map(es.map((e) => [e.date, e]));
    const start = sorted.findIndex((b) => b.date >= es[0]!.date);
    let pos: 0 | 1 = 0, eq = 1, basis = es[0]!.basis;
    const equity: number[] = [];
    const trades: PaperTrade[] = [];
    if (start >= 0) {
      for (let i = start; i < sorted.length; i += 1) {
        const bar = sorted[i]!;
        if (i > start) eq *= 1 + pos * (bar.close / sorted[i - 1]!.close - 1);
        // Positions are decided at this close and start earning from the next session.
        const e = at.get(bar.date);
        if (e) {
          if (e.position !== pos) {
            eq *= 1 - ARENA_COST / 2;
            trades.push({ date: bar.date, action: e.position ? 'BUY' : 'SELL', price: bar.close, basis: e.basis });
            pos = e.position;
          }
          basis = e.basis;
        }
        equity.push(eq);
      }
    }
    const last = es.at(-1)!;
    return {
      follower, label: last.label, since: es[0]!.date, sessions: start < 0 ? 0 : sorted.length - 1 - start,
      totalReturn: eq - 1, balance: Math.round(PAPER_START_KRW * eq), position: pos, basis, trades, equity,
    };
  });
}
