// 나 vs 위원회 (G-323): a reader picks up or down on a stock; 20 sessions later it is scored next to the committee's
// lean at the time, by the same rule the committee is scored by (direction; a flat lean hits within ±2%).
// Same for everyone and nothing to win: an educational game, not advice.

import type { D1 } from './db.js';
import { parseNaverDailyChart } from '../sources/naverPrice.js';
import { fetchWorldBars } from '../sources/naverWorld.js';
import { isUsSymbol } from '../report/seal.js';
import { notifyUser, type Ctx } from './notify.js';

export const MY_CALL_HORIZON = 20;
export const MY_CALL_OPEN_LIMIT = 50;
export type Lean = 'up' | 'down' | 'flat';

// The chart feed is EUC-KR; only ASCII digits are read. Decoded by hand: the Worker's TextDecoder has no latin1.
const latin1 = (buf: ArrayBuffer) => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode(...a.subarray(i, i + 8192)); return s; };
async function krBars(f: typeof fetch, symbol: string, now: Date) {
  const r = await f(`https://fchart.stock.naver.com/sise.nhn?symbol=${symbol}&timeframe=day&count=60&requestType=0`, { signal: AbortSignal.timeout(15_000) });
  return r.ok ? parseNaverDailyChart(latin1(await r.arrayBuffer()), symbol, now) : [];
}
const kst = (d: Date) => new Date(d.getTime() + 9 * 3600_000);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** The first session whose close is the start: today when chosen on a weekday before 15:30 KST, else the next weekday. */
export function baseDayOf(now: Date): string {
  const k = kst(now), before = k.toISOString().slice(11, 16) < '15:30';
  const d = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
  const weekday = (x: Date) => x.getUTCDay() !== 0 && x.getUTCDay() !== 6;
  if (!(before && weekday(d))) do d.setUTCDate(d.getUTCDate() + 1); while (!weekday(d));
  return ymd(d);
}

/** Right or wrong for a lean over a move from base to end. */
export const leanHit = (lean: Lean, base: number, end: number) => (lean === 'flat' ? Math.abs(end / base - 1) <= 0.02 : lean === 'up' ? end > base : end < base);

/** Start and end sessions for a base day, once 20 sessions have closed after it; null while waiting. */
export function scoreWindow(bars: readonly { date: string; close: number }[], baseDay: string): { base: { date: string; close: number }; end: { date: string; close: number } } | null {
  const sorted = [...bars].sort((a, b) => (a.date < b.date ? -1 : 1));
  const i = sorted.findIndex((b) => b.date >= baseDay);
  if (i < 0 || !sorted[i + MY_CALL_HORIZON]) return null;
  return { base: sorted[i]!, end: sorted[i + MY_CALL_HORIZON]! };
}

type Row = { user_id: string; symbol: string; name: string; base_day: string; stance: Lean; com: Lean };

/**
 * Evening job: score every call whose 20 sessions may have passed (base day 28+ days ago), a few dozen stocks a run,
 * then one note per reader: how they did next to the committee on the calls scored tonight.
 */
export async function runMyCallsScore(ctx: Ctx, opts: { bars?: (symbol: string) => Promise<{ date: string; close: number }[]> } = {}): Promise<{ scored: number; users: number }> {
  const cutoff = ymd(new Date(kst(ctx.now).getTime() - 28 * 86400_000));
  const rows = (await ctx.db.prepare('SELECT user_id, symbol, name, base_day, stance, com FROM my_calls WHERE scored_at IS NULL AND base_day <= ? ORDER BY base_day LIMIT 400').bind(cutoff).all<Row>()).results;
  if (!rows.length) return { scored: 0, users: 0 };
  const load = opts.bars ?? ((s: string) => (isUsSymbol(s) ? fetchWorldBars(s, 60, { fetch: ctx.fetch, now: () => ctx.now }) : krBars(ctx.fetch, s, ctx.now)));
  const bars = new Map<string, { date: string; close: number }[]>();
  for (const s of [...new Set(rows.map((r) => r.symbol))].slice(0, 40)) bars.set(s, await load(s).catch(() => []));
  const done = new Map<string, { name: string; hit: boolean; com: boolean }[]>();
  let scored = 0;
  for (const r of rows) {
    const w = scoreWindow(bars.get(r.symbol) ?? [], r.base_day);
    if (!w) continue;
    const hit = leanHit(r.stance, w.base.close, w.end.close), com = leanHit(r.com, w.base.close, w.end.close);
    const took = await ctx.db.prepare('UPDATE my_calls SET base_date = ?, end_date = ?, base_close = ?, end_close = ?, hit = ?, com_hit = ?, scored_at = ? WHERE user_id = ? AND symbol = ? AND base_day = ? AND scored_at IS NULL')
      .bind(w.base.date, w.end.date, w.base.close, w.end.close, hit ? 1 : 0, com ? 1 : 0, ctx.now.toISOString(), r.user_id, r.symbol, r.base_day).run();
    if ((took.meta?.changes ?? 0) !== 1) continue;
    scored += 1;
    done.set(r.user_id, [...(done.get(r.user_id) ?? []), { name: r.name || r.symbol, hit, com }]);
  }
  for (const [user, list] of done) {
    const me = list.filter((x) => x.hit).length, com = list.filter((x) => x.com).length;
    const first = list[0]!, word = (b: boolean) => (b ? '맞음' : '틀림');
    const title = list.length === 1 ? `나 vs 위원회 채점 · ${first.name}` : `나 vs 위원회 채점 ${list.length}건`;
    const body = list.length === 1 ? `나 ${word(first.hit)} · 위원회 ${word(first.com)} (20거래일 뒤 종가 기준)` : `나 ${me}건 맞음 · 위원회 ${com}건 맞음 (20거래일 뒤 종가 기준)`;
    await notifyUser(ctx, user, 'mycall', { title, body, link: 'mycalls.html' }).catch(() => false);
  }
  return { scored, users: done.size };
}

/** The reader's record: totals over scored calls and the latest calls, newest first. */
export async function myCallsOf(db: D1, userId: string, symbol?: string) {
  const items = (await db.prepare(`SELECT symbol, name, base_day, stance, com, created_at, base_date, end_date, base_close, end_close, hit, com_hit, scored_at FROM my_calls WHERE user_id = ?${symbol ? ' AND symbol = ?' : ''} ORDER BY created_at DESC LIMIT 100`)
    .bind(...(symbol ? [userId, symbol] : [userId])).all()).results as { hit: number | null; com_hit: number | null; scored_at: string | null }[];
  const t = (await db.prepare('SELECT COUNT(scored_at) AS n, COALESCE(SUM(hit), 0) AS me, COALESCE(SUM(com_hit), 0) AS com, SUM(scored_at IS NULL) AS pending FROM my_calls WHERE user_id = ?').bind(userId).first<{ n: number; me: number; com: number; pending: number | null }>())!;
  return { items, total: { scored: t.n, me: t.me, com: t.com, pending: t.pending ?? 0 } };
}
