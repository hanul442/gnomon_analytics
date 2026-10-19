// Mock-trading contest against the AI committee (G-250, docs/DESIGN.md "나 vs 위원회"). One season is a KST
// month. Everyone starts with the same virtual 10M KRW, long or cash only, at most 5 stocks and 30% in one,
// in the stocks the committee is judging. Every buy carries a judgment card ("chance the season ends above my
// price") scored the way the committee's calls are (Brier), and the ranking is by that score, not by return.
// The committee plays by the same rules from its consensus, logged as decided and never revised (like the
// paper ledger). No one fills at a price already known: an order fills at the first close after it is placed
// (before 15:30 KST: that day's close), and the committee's choice at one close fills at the next. Pure.

import { ANALYST_HORIZON, committeeConsensus, scoreAnalysts, type AnalystCall } from './analysts.js';
import { ARENA_COST } from './strategies.js';

export const CONTEST_METHOD = 'gnm-contest-v1';
export const CONTEST_START_KRW = 10_000_000;
export const MAX_WEIGHT = 0.3;
export const MAX_HOLDINGS = 5;
/** The committee holds its top names at this weight each (5 × 20% = fully invested). */
export const COMMITTEE_SLOT = 0.2;
/** The committee buys only names whose consensus says at least this chance of being higher. */
export const COMMITTEE_MIN_UP = 55;
export const MIN_ORDER_KRW = 100_000;
export const MAX_ORDER_KRW = CONTEST_START_KRW;
/** Cards needed before a player is ranked. */
export const RANK_MIN_CARDS = 3;
/** Market close, KST; an order placed before it fills at that day's close. */
export const CLOSE_HHMM = '15:30';

/** A stock the committee is judging: its latest consensus, from calls younger than the 20-session horizon. */
export interface LiveCall { symbol: string; name: string; upPct: number; baseDate: string; close: number }

/** What the committee decided after one close: the stocks on the board and the ones it will hold. */
export interface CommitteeEntry { date: string; live: LiveCall[]; target: string[]; method: typeof CONTEST_METHOD; recordedAt: string }
export const committeeEntryKey = (e: CommitteeEntry) => e.date;

/** Highest consensus first, at least COMMITTEE_MIN_UP, at most MAX_HOLDINGS. */
export function committeeTarget(live: readonly LiveCall[]): string[] {
  return [...live].filter((l) => l.upPct >= COMMITTEE_MIN_UP).sort((a, b) => b.upPct - a.upPct || (a.symbol < b.symbol ? -1 : 1)).slice(0, MAX_HOLDINGS).map((l) => l.symbol);
}

/**
 * The board as of the close of `date`: per stock, the calls of its latest base session (reported by then)
 * pooled by committeeConsensus, weighted by records scored on bars up to `date` only. A call is live while
 * fewer than 20 sessions have passed since its base session.
 */
export function liveCalls(date: string, stocks: readonly { symbol: string; name: string; calls: readonly AnalystCall[]; bars: readonly { date: string; close: number }[] }[]): LiveCall[] {
  const out: LiveCall[] = [];
  for (const s of stocks) {
    const bars = s.bars.filter((b) => b.date <= date).sort((a, b) => (a.date < b.date ? -1 : 1));
    const known = s.calls.filter((c) => c.reportDate <= date && c.baseDate <= date);
    if (!bars.length || !known.length) continue;
    const base = known.reduce((m, c) => (c.baseDate > m ? c.baseDate : m), '');
    if (bars.filter((b) => b.date > base).length >= ANALYST_HORIZON) continue;
    const group = known.filter((c) => c.baseDate === base);
    const cons = committeeConsensus(group, scoreAnalysts(known.filter((c) => c.baseDate < base), bars));
    if (cons) out.push({ symbol: s.symbol, name: s.name, upPct: cons.upPct, baseDate: base, close: bars.at(-1)!.close });
  }
  return out.sort((a, b) => (a.symbol < b.symbol ? -1 : 1));
}

/** The season of a KST date. */
export const seasonOf = (date: string) => date.slice(0, 7);
const kstOf = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString();

/** Weekdays after `date` up to the end of its month (holidays not known): the sessions probably left. */
export function weekdaysLeft(date: string): number {
  const d = new Date(`${date}T00:00:00Z`), month = d.getUTCMonth();
  let n = 0;
  for (d.setUTCDate(d.getUTCDate() + 1); d.getUTCMonth() === month; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() % 6 !== 0) n += 1;
  return n;
}

/** The weekday whose close an order placed at `at` should fill at (holidays not known): its season. */
export function expectedFillDate(at: Date): string {
  const k = kstOf(at.toISOString()), d = new Date(`${k.slice(0, 10)}T00:00:00Z`);
  const today = d.getUTCDay() % 6 !== 0 && k.slice(11, 16) < CLOSE_HHMM;
  if (!today) do d.setUTCDate(d.getUTCDate() + 1); while (d.getUTCDay() % 6 === 0);
  return d.toISOString().slice(0, 10);
}

/** Index of the session an order placed at `createdAt` fills at, or -1 while that close is not in yet. */
export function fillIndex(sessions: readonly string[], createdAt: string): number {
  const k = kstOf(createdAt), day = k.slice(0, 10), early = k.slice(11, 16) < CLOSE_HHMM;
  return sessions.findIndex((s) => s > day || (s === day && early));
}

/** site/contest.json: which season is on, the board now and the committee's current target. */
export interface ContestIndex { method: typeof CONTEST_METHOD; current: string; seasons: string[]; asOf: string | null; live: LiveCall[]; target: string[] }

/** The published season file (site/contest/<season>.json). */
export interface SeasonFile {
  method: typeof CONTEST_METHOD;
  season: string;
  builtAt: string;
  /** The season's sessions so far. */
  sessions: string[];
  /** True once the month is over. */
  closed: boolean;
  names: Record<string, string>;
  /** Per stock, its close at each session (null when missing). */
  closes: Record<string, (number | null)[]>;
  /** The committee's decisions that fill in this season, oldest first. */
  committee: CommitteeEntry[];
}

export interface Order {
  id: number;
  createdAt: string;
  side: 'BUY' | 'SELL';
  symbol: string;
  /** KRW for a buy; a sell sells the whole holding. */
  amount: number;
  /** Buy card: chance (1–99) the season's last close is above the fill price. */
  upPct: number | null;
  invalidation: number | null;
  reason: string;
  cancelled: boolean;
}

export type OrderStatus =
  | { id: number; state: 'pending' | 'cancelled' }
  | { id: number; state: 'filled'; date: string; price: number; amount: number }
  | { id: number; state: 'rejected'; date: string; reason: 'NO_PRICE' | 'NO_CASH' | 'CAP' | 'MAX_HOLDINGS' | 'NOT_HELD' };

export interface Card {
  symbol: string; name: string; date: string; price: number; upPct: number;
  invalidation: number | null; reason: string;
  /** The committee's consensus on the stock that was on the board when the card was filled (null if none). */
  committeeUp: number | null;
  /** Close it is scored at: the season's last (final once closed, provisional before). */
  close: number | null; hit: boolean | null; brokeOn: string | null;
}

export interface Holding { symbol: string; name: string; shares: number; price: number; value: number; weight: number; cost: number }

export interface Side {
  /** Session index the account started at (-1: not started). */
  start: number;
  equity: number[];
  balance: number;
  cash: number;
  ret: number;
  maxDrawdown: number;
  holdings: Holding[];
  cards: Card[];
  brier: number | null;
  /** 100 × (1 − brier/0.25): 0 = always saying 50%, 100 = perfect, below 0 = worse than 50%. */
  skill: number | null;
  trades: number;
}

/** A buy of `amount` KRW, or with `slot` that share of the account at that close (the committee's). */
type Action = { kind: 'buy'; symbol: string; amount: number; slot?: number; card?: Omit<Card, 'date' | 'price' | 'close' | 'hit' | 'brokeOn' | 'name'>; id?: number } | { kind: 'sell'; symbol: string; id?: number };

const lastClose = (closes: readonly (number | null)[] | undefined, i: number) => { for (let j = i; j >= 0; j -= 1) { const c = closes?.[j]; if (c != null) return c; } return null; };

function replay(file: SeasonFile, actions: Map<number, Action[]>, start: number): { side: Side; statuses: OrderStatus[] } {
  const n = file.sessions.length, half = ARENA_COST / 2;
  const shares = new Map<string, number>(), costBasis = new Map<string, number>();
  let cash = CONTEST_START_KRW, trades = 0;
  const equity: number[] = [], cards: Card[] = [], statuses: OrderStatus[] = [];
  const value = (i: number) => cash + [...shares].reduce((s, [sym, q]) => s + q * (lastClose(file.closes[sym], i) ?? 0), 0);
  for (let i = Math.max(0, start); start >= 0 && i < n; i += 1) {
    const day = file.sessions[i]!, list = actions.get(i) ?? [];
    for (const a of [...list.filter((x) => x.kind === 'sell'), ...list.filter((x) => x.kind === 'buy')]) {
      const price = file.closes[a.symbol]?.[i] ?? null;
      const reject = (reason: Extract<OrderStatus, { state: 'rejected' }>['reason']) => { if (a.id != null) statuses.push({ id: a.id, state: 'rejected', date: day, reason }); };
      if (price == null) { reject('NO_PRICE'); continue; }
      if (a.kind === 'sell') {
        const q = shares.get(a.symbol);
        if (!q) { reject('NOT_HELD'); continue; }
        cash += q * price * (1 - half); shares.delete(a.symbol); costBasis.delete(a.symbol); trades += 1;
        if (a.id != null) statuses.push({ id: a.id, state: 'filled', date: day, price, amount: Math.round(q * price) });
        continue;
      }
      if (!shares.has(a.symbol) && shares.size >= MAX_HOLDINGS) { reject('MAX_HOLDINGS'); continue; }
      const eq = value(i), held = (shares.get(a.symbol) ?? 0) * price, want = a.slot != null ? a.slot * eq : a.amount;
      const room = MAX_WEIGHT * eq - held, spendable = cash / (1 + half);
      const amount = Math.min(want, spendable, room);
      if (amount < (a.slot != null ? 1 : Math.min(MIN_ORDER_KRW, want))) { reject(spendable < room ? 'NO_CASH' : 'CAP'); continue; }
      cash -= amount * (1 + half); shares.set(a.symbol, (shares.get(a.symbol) ?? 0) + amount / price); costBasis.set(a.symbol, (costBasis.get(a.symbol) ?? 0) + amount); trades += 1;
      if (a.id != null) statuses.push({ id: a.id, state: 'filled', date: day, price, amount: Math.round(amount) });
      if (a.card) cards.push({ ...a.card, name: file.names[a.symbol] ?? a.symbol, date: day, price, close: null, hit: null, brokeOn: null });
    }
    equity.push(value(i));
  }
  // Cards: scored at the season's last close; the invalidation is crossed at the first close at or below it.
  const last = n - 1;
  for (const c of cards) {
    const closes = file.closes[c.symbol] ?? [];
    c.close = lastClose(closes, last);
    c.hit = c.close == null || last < 0 || file.sessions[last]! <= c.date ? null : c.close > c.price;
    const from = file.sessions.indexOf(c.date);
    if (c.invalidation != null) for (let i = from + 1; i <= last; i += 1) { const x = closes[i]; if (x != null && x <= c.invalidation) { c.brokeOn = file.sessions[i]!; break; } }
  }
  const scored = cards.filter((c) => c.hit != null);
  const brier = scored.length ? scored.reduce((s, c) => s + (c.upPct / 100 - (c.hit ? 1 : 0)) ** 2, 0) / scored.length : null;
  const balance = equity.length ? equity.at(-1)! : CONTEST_START_KRW;
  let peak = 0, mdd = 0;
  for (const e of equity) { peak = Math.max(peak, e); mdd = Math.max(mdd, 1 - e / peak); }
  const at = Math.max(0, n - 1);
  const holdings = [...shares].map(([symbol, q]) => { const p = lastClose(file.closes[symbol], at) ?? 0; return { symbol, name: file.names[symbol] ?? symbol, shares: q, price: p, value: q * p, weight: balance > 0 ? (q * p) / balance : 0, cost: costBasis.get(symbol) ?? 0 }; }).sort((a, b) => b.value - a.value);
  return {
    side: { start: equity.length ? Math.max(0, start) : -1, equity, balance, cash, ret: balance / CONTEST_START_KRW - 1, maxDrawdown: mdd, holdings, cards, brier, skill: brier == null ? null : Math.round(100 * (1 - brier / 0.25)), trades },
    statuses,
  };
}

/** The committee entry that fills at session i: decided at a close before it and after the session before. */
function entryFor(file: SeasonFile, i: number): CommitteeEntry | null {
  const day = file.sessions[i]!, prev = i > 0 ? file.sessions[i - 1]! : '';
  const list = file.committee.filter((e) => e.date < day && e.date >= prev);
  return list.at(-1) ?? null;
}

/** The committee's account: rebalances to its target at the close after each decision. */
export function committeeSide(file: SeasonFile): Side {
  const actions = new Map<number, Action[]>();
  let held = new Set<string>(), first = -1;
  for (let i = 0; i < file.sessions.length; i += 1) {
    const e = entryFor(file, i);
    if (!e) continue;
    if (first < 0) first = i;
    const target = new Set(e.target), list: Action[] = [];
    for (const s of held) if (!target.has(s)) list.push({ kind: 'sell', symbol: s });
    for (const s of e.target) if (!held.has(s)) {
      const up = e.live.find((l) => l.symbol === s)?.upPct ?? 50;
      list.push({ kind: 'buy', symbol: s, amount: 0, slot: COMMITTEE_SLOT, card: { symbol: s, upPct: up, invalidation: null, reason: '', committeeUp: up } });
    }
    held = target;
    actions.set(i, list);
  }
  return replay(file, actions, first).side;
}

/** Equal weight in the stocks on the board at the season's first decision, bought once and held. */
export function benchmarkSide(file: SeasonFile): Side {
  let first = -1, e: CommitteeEntry | null = null;
  for (let i = 0; i < file.sessions.length && !e; i += 1) { e = entryFor(file, i); if (e) first = i; }
  if (!e || !e.live.length) return replay(file, new Map(), -1).side;
  const names = e.live.map((l) => l.symbol).filter((s) => file.closes[s]?.[first] != null);
  const each = CONTEST_START_KRW / Math.max(1, names.length) / (1 + ARENA_COST / 2);
  // The 5-stock and 30% limits are the players' rules; the yardstick holds the whole board.
  return replayBoard(file, first, names, each);
}

function replayBoard(file: SeasonFile, first: number, names: readonly string[], each: number): Side {
  const half = ARENA_COST / 2, q = new Map(names.map((s) => [s, each / file.closes[s]![first]!]));
  const cash = CONTEST_START_KRW - each * names.length * (1 + half);
  const equity = file.sessions.slice(first).map((_, k) => cash + [...q].reduce((s, [sym, x]) => s + x * (lastClose(file.closes[sym], first + k) ?? 0), 0));
  const balance = equity.at(-1) ?? CONTEST_START_KRW;
  let peak = 0, mdd = 0;
  for (const v of equity) { peak = Math.max(peak, v); mdd = Math.max(mdd, 1 - v / peak); }
  const at = file.sessions.length - 1;
  return {
    start: first, equity, balance, cash, ret: balance / CONTEST_START_KRW - 1, maxDrawdown: mdd,
    holdings: [...q].map(([symbol, x]) => { const p = lastClose(file.closes[symbol], at) ?? 0; return { symbol, name: file.names[symbol] ?? symbol, shares: x, price: p, value: x * p, weight: balance > 0 ? (x * p) / balance : 0, cost: each }; }),
    cards: [], brier: null, skill: null, trades: names.length,
  };
}

/** A player's account from their orders; also each order's state. */
export function playerSide(file: SeasonFile, orders: readonly Order[]): { side: Side; statuses: OrderStatus[] } {
  const actions = new Map<number, Action[]>(), statuses: OrderStatus[] = [];
  let first = -1;
  for (const o of [...orders].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id - b.id))) {
    if (o.cancelled) { statuses.push({ id: o.id, state: 'cancelled' }); continue; }
    const i = fillIndex(file.sessions, o.createdAt);
    if (i < 0) { statuses.push({ id: o.id, state: 'pending' }); continue; }
    if (first < 0 || i < first) first = i;
    // The board as last published before the fill: what the reader could have seen.
    const entry = file.committee.filter((e) => e.date < file.sessions[i]!).at(-1);
    const a: Action = o.side === 'SELL' ? { kind: 'sell', symbol: o.symbol, id: o.id } : {
      kind: 'buy', symbol: o.symbol, amount: o.amount, id: o.id,
      card: { symbol: o.symbol, upPct: Math.max(1, Math.min(99, o.upPct ?? 50)), invalidation: o.invalidation, reason: o.reason, committeeUp: entry?.live.find((l) => l.symbol === o.symbol)?.upPct ?? null },
    };
    (actions.get(i) ?? actions.set(i, []).get(i)!).push(a);
  }
  const r = replay(file, actions, first);
  return { side: r.side, statuses: [...statuses, ...r.statuses].sort((a, b) => a.id - b.id) };
}

/** Account change from session `from` (index into the season) to the last: for comparing over the same stretch. */
export function changeFrom(side: Side, from: number): number | null {
  if (side.start < 0 || !side.equity.length) return null;
  const k = Math.max(0, from - side.start), base = k === 0 ? CONTEST_START_KRW : side.equity[k - 1];
  return base ? side.equity.at(-1)! / base - 1 : null;
}

/** Facts for a player's look back. No judgment of their trades: counts and outcomes only. */
export function review(side: Side) {
  const scored = side.cards.filter((c) => c.hit != null);
  const band = (lo: number, hi: number) => { const xs = scored.filter((c) => c.upPct >= lo && c.upPct < hi); return { n: xs.length, avgUp: xs.length ? Math.round(xs.reduce((s, c) => s + c.upPct, 0) / xs.length) : null, hitPct: xs.length ? Math.round((100 * xs.filter((c) => c.hit).length) / xs.length) : null }; };
  return {
    cards: side.cards.length,
    scored: scored.length,
    avgUp: scored.length ? Math.round(scored.reduce((s, c) => s + c.upPct, 0) / scored.length) : null,
    hitPct: scored.length ? Math.round((100 * scored.filter((c) => c.hit).length) / scored.length) : null,
    bands: { low: band(0, 45), mid: band(45, 60), high: band(60, 101) },
    invalidation: { set: side.cards.filter((c) => c.invalidation != null).length, broke: side.cards.filter((c) => c.brokeOn).length },
    /** Cards where the committee saw the other side of 50 at the time. */
    against: side.cards.filter((c) => c.committeeUp != null && c.committeeUp !== 50 && c.upPct !== 50 && (c.upPct > 50) !== (c.committeeUp > 50))
      .map((c) => ({ symbol: c.symbol, name: c.name, date: c.date, upPct: c.upPct, committeeUp: c.committeeUp!, hit: c.hit })),
  };
}

/** Players with RANK_MIN_CARDS cards ranked by skill (ties: earlier start). Returns the order and where the committee would sit. */
export function ranking(players: readonly { id: string; side: Side }[], committee: Side): { n: number; ranked: { id: string; skill: number; rank: number }[]; committeeRank: number | null } {
  const ok = players.filter((p) => p.side.cards.length >= RANK_MIN_CARDS && p.side.skill != null).sort((a, b) => b.side.skill! - a.side.skill! || a.side.start - b.side.start);
  const ranked = ok.map((p, i) => ({ id: p.id, skill: p.side.skill!, rank: i + 1 }));
  for (let i = 1; i < ranked.length; i += 1) if (ranked[i]!.skill === ranked[i - 1]!.skill) ranked[i]!.rank = ranked[i - 1]!.rank;
  const committeeRank = committee.skill == null || committee.cards.length < RANK_MIN_CARDS ? null : 1 + ranked.filter((r) => r.skill > committee.skill!).length;
  return { n: ok.length, ranked, committeeRank };
}

/** The season file from the committee log and price bars. */
export function seasonFile(input: { season: string; builtAt: string; today: string; entries: readonly CommitteeEntry[]; bars: ReadonlyMap<string, readonly { date: string; close: number }[]>; names: ReadonlyMap<string, string> }): SeasonFile {
  const inSeason = (d: string) => seasonOf(d) === input.season;
  const sessionSet = new Set<string>();
  for (const bars of input.bars.values()) for (const b of bars) if (inSeason(b.date)) sessionSet.add(b.date);
  const sessions = [...sessionSet].sort();
  // Entries that fill in the season: the last one before it, and those before its last session.
  const before = [...input.entries].filter((e) => e.date < (sessions[0] ?? `${input.season}-01`)).sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1);
  const committee = [...(before ? [before] : []), ...input.entries.filter((e) => inSeason(e.date))].sort((a, b) => (a.date < b.date ? -1 : 1));
  const symbols = new Set<string>(committee.flatMap((e) => [...e.target, ...e.live.map((l) => l.symbol)]));
  const closes: Record<string, (number | null)[]> = {}, names: Record<string, string> = {};
  for (const s of [...symbols].sort()) {
    const by = new Map((input.bars.get(s) ?? []).map((b) => [b.date, b.close]));
    closes[s] = sessions.map((d) => by.get(d) ?? null);
    names[s] = input.names.get(s) ?? committee.flatMap((e) => e.live).find((l) => l.symbol === s)?.name ?? s;
  }
  return { method: CONTEST_METHOD, season: input.season, builtAt: input.builtAt, sessions, closed: input.today.slice(0, 7) > input.season, names, closes, committee };
}
