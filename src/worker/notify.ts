// Notifications (G-97): one place that writes the 🔔 list and sends the phone push, following each user's
// settings. Jobs here: the daily report note, the user's own price alerts, and requested reports.

import type { D1 } from './db.js';
import { pushTo } from './push.js';
import { quoteUrl, parseNaverQuotes } from '../sources/naverQuote.js';
import { notifyLimit } from '../report/plans.js';

export type NotifyKind = 'daily' | 'watchReport' | 'screen' | 'price' | 'request' | 'intraday' | 'test';
export interface Prefs { daily: boolean; watchReport: boolean; screen: boolean; price: boolean; request: boolean; push: boolean }
export const DEFAULT_PREFS: Prefs = { daily: true, watchReport: true, screen: true, price: true, request: true, push: true };
const PREF_OF: Record<NotifyKind, keyof Prefs | null> = { daily: 'daily', watchReport: 'watchReport', screen: 'screen', price: 'price', intraday: 'price', request: 'request', test: null };

export async function prefsOf(db: D1, userId: string): Promise<Prefs> {
  const r = await db.prepare('SELECT prefs FROM notify_prefs WHERE user_id = ?').bind(userId).first<{ prefs: string }>();
  if (!r) return { ...DEFAULT_PREFS };
  try { return { ...DEFAULT_PREFS, ...cleanPrefs(JSON.parse(r.prefs)) }; } catch { return { ...DEFAULT_PREFS }; }
}
export const cleanPrefs = (v: unknown): Partial<Prefs> => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>, out: Partial<Prefs> = {};
  for (const k of Object.keys(DEFAULT_PREFS) as (keyof Prefs)[]) if (typeof o[k] === 'boolean') out[k] = o[k] as boolean;
  return out;
};

export interface Ctx { db: D1; fetch: typeof fetch; site: string; now: Date }
const iso = (d: Date) => d.toISOString();

/** In the 🔔 list, and on the phone when the user turned push on. Returns false when their settings say no. */
export async function notifyUser(ctx: Ctx, userId: string, kind: NotifyKind, note: { title: string; body: string; link: string }): Promise<boolean> {
  const prefs = await prefsOf(ctx.db, userId), key = PREF_OF[kind];
  if (key && !prefs[key]) return false;
  // G-98: the plan decides what reaches the phone; 🔔 always gets what the plan allows at all.
  const plan = (await ctx.db.prepare('SELECT plan FROM users WHERE id = ?').bind(userId).first<{ plan: string }>())?.plan ?? 'free', lim = notifyLimit(plan);
  if ((kind === 'watchReport' && !lim.watchReport) || (kind === 'intraday' && !lim.intraday)) return false;
  await ctx.db.prepare('INSERT INTO notifications (user_id, kind, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(userId, kind, note.title, note.body, note.link, iso(ctx.now)).run();
  if (prefs.push && lim.push) await pushTo(ctx.db, ctx.fetch, userId, { ...note, link: `${ctx.site.replace(/\/$/, '')}/${note.link}`, tag: kind }, ctx.site, ctx.now).catch(() => 0);
  return true;
}

/** Once per key, ever (a user's daily note for a date, a request's report for a date). */
const once = async (db: D1, key: string, now: Date) => ((await db.prepare('INSERT OR IGNORE INTO notify_log (key, created_at) VALUES (?, ?)').bind(key, iso(now)).run()).meta?.changes ?? 0) === 1;
const kstDate = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
const reportLink = (s: string) => `${encodeURIComponent(s)}/index.html`;

/**
 * After the daily build: tell each user about the new reports. Their watched stocks first (one note naming
 * them), else the day's count; and whoever asked for a stock's report hears when it is out.
 */
export async function runDailyNotify(ctx: Ctx): Promise<{ date: string | null; sent: number }> {
  const site = ctx.site.replace(/\/$/, '');
  const r = await ctx.fetch(`${site}/watchinfo.json`, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!r?.ok) return { date: null, sent: 0 };
  const info = await r.json() as Record<string, { d: string }>;
  const date = Object.values(info).map((x) => x.d).sort().at(-1) ?? null;
  // Only fresh days: a first run must not announce an old batch.
  if (!date || date < kstDate(new Date(ctx.now.getTime() - 3 * 86400_000))) return { date, sent: 0 };
  const today = Object.keys(info).filter((s) => info[s]!.d === date);
  if (!today.length) return { date, sent: 0 };
  const names = new Map<string, string>();
  try {
    const s = await ctx.fetch(`${site}/search.json`, { signal: AbortSignal.timeout(15_000) });
    if (s.ok) for (const it of ((await s.json()) as { items: unknown[][] }).items) names.set(String(it[0]), String(it[1]));
  } catch { /* names are a nicety */ }
  const nm = (s: string) => names.get(s) ?? s;
  const list = (xs: string[]) => xs.slice(0, 3).map(nm).join(', ') + (xs.length > 3 ? ` 외 ${xs.length - 3}개` : '');
  const users = (await ctx.db.prepare('SELECT u.id, u.plan, w.symbols FROM users u LEFT JOIN watchlists w ON w.user_id = u.id WHERE u.disabled = 0').all<{ id: string; plan: string; symbols: string | null }>()).results;
  let sent = 0;
  for (const u of users) {
    if (!(await once(ctx.db, `daily:${u.id}:${date}`, ctx.now))) continue;
    const watch = new Set<string>(u.symbols && notifyLimit(u.plan).watchReport ? JSON.parse(u.symbols) as string[] : []), mine = today.filter((s) => watch.has(s));
    const ok = mine.length
      ? await notifyUser(ctx, u.id, 'watchReport', { title: `관심 종목 새 리포트 · ${list(mine)}`, body: `${date} 장 마감 기준 리포트가 나왔어요.`, link: `reports.html?hl=${mine.map(encodeURIComponent).join(',')}#today` })
      : await notifyUser(ctx, u.id, 'daily', { title: `오늘 리포트 ${today.length}개가 나왔어요`, body: `${list(today)} · ${date} 장 마감 기준`, link: 'reports.html#today' });
    if (ok) sent += 1;
  }
  // Requested reports (G-97): the request was handled and the stock's report is now in today's batch.
  const reqs = (await ctx.db.prepare("SELECT id, user_id, symbol FROM action_requests WHERE kind IN ('report', 'upgrade') AND status = 'done' AND created_at >= ?").bind(`${kstDate(new Date(ctx.now.getTime() - 21 * 86400_000))}T00:00:00Z`).all<{ id: number; user_id: string; symbol: string }>()).results;
  for (const q of reqs) {
    if (!today.includes(q.symbol) || !(await once(ctx.db, `req:${q.id}`, ctx.now))) continue;
    if (await notifyUser(ctx, q.user_id, 'request', { title: `요청한 ${nm(q.symbol)} 리포트가 나왔어요`, body: `${date} 기준으로 만들었어요. 눌러서 바로 보세요.`, link: reportLink(q.symbol) })) sent += 1;
  }
  return { date, sent };
}

/**
 * The users' own price alerts (every 10 minutes): stocks and ETFs during the session from Naver's quote feed,
 * coins at any hour from Upbit. Each alert fires once.
 */
export async function runPriceAlerts(ctx: Ctx): Promise<{ checked: number; fired: number }> {
  const alerts = (await ctx.db.prepare('SELECT id, user_id, symbol, name, op, price, note FROM price_alerts WHERE fired_at IS NULL ORDER BY id LIMIT 1000').all<{ id: number; user_id: string; symbol: string; name: string; op: string; price: number; note: string }>()).results;
  if (!alerts.length) return { checked: 0, fired: 0 };
  const k = new Date(ctx.now.getTime() + 9 * 3600_000), hhmm = k.toISOString().slice(11, 16), dow = k.getUTCDay();
  const session = dow !== 0 && dow !== 6 && hhmm >= '09:00' && hhmm <= '15:40';
  const stocks = [...new Set(alerts.map((a) => a.symbol).filter((s) => /^[0-9A-Z]{6}$/.test(s)))], coins = [...new Set(alerts.map((a) => a.symbol).filter((s) => s.startsWith('KRW-')))];
  const px = new Map<string, number>();
  if (session) for (let i = 0; i < stocks.length; i += 40) {
    const r = await ctx.fetch(quoteUrl(stocks.slice(i, i + 40)), { signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'Mozilla/5.0 (gnomon-analytics)' } }).catch(() => null);
    if (r?.ok) for (const q of parseNaverQuotes(await r.json().catch(() => null))) px.set(q.symbol, q.price);
  }
  for (let i = 0; i < coins.length; i += 50) {
    const r = await ctx.fetch(`https://api.upbit.com/v1/ticker?markets=${coins.slice(i, i + 50).join(',')}`, { signal: AbortSignal.timeout(6000) }).catch(() => null);
    if (r?.ok) for (const t of (await r.json().catch(() => [])) as { market: string; trade_price: number }[]) if (t.trade_price > 0) px.set(t.market, t.trade_price);
  }
  let fired = 0;
  for (const a of alerts) {
    const p = px.get(a.symbol);
    if (p === undefined || !(a.op === '>=' ? p >= a.price : p <= a.price)) continue;
    const took = await ctx.db.prepare('UPDATE price_alerts SET fired_at = ?, fired_price = ? WHERE id = ? AND fired_at IS NULL').bind(iso(ctx.now), p, a.id).run();
    if ((took.meta?.changes ?? 0) !== 1) continue;
    const won = (v: number) => `${v >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}원`;
    const coin = a.symbol.startsWith('KRW-');
    await notifyUser(ctx, a.user_id, 'price', {
      title: `${a.name || a.symbol} ${won(p)} · ${won(a.price)} ${a.op === '>=' ? '이상' : '이하'} 도달`,
      body: `${a.note ? a.note + ' · ' : ''}설정한 가격 알림이에요. ${coin ? '업비트' : '네이버'} 시세 기준이라 몇 분 늦을 수 있고, 투자 권유가 아니에요.`,
      link: coin ? `coin.html?m=${a.symbol}` : `stock.html?c=${a.symbol}`,
    });
    fired += 1;
  }
  return { checked: px.size, fired };
}
