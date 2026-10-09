// Notifications (G-97): one place that writes the 🔔 list and sends the phone push, following each user's
// settings. Jobs here: the daily report note, the user's own price alerts, and requested reports.

import type { D1 } from './db.js';
import { pushTo } from './push.js';
import { quoteUrl, parseNaverQuotes } from '../sources/naverQuote.js';
import { parseWorldQuote, worldQuoteUrl } from '../sources/naverWorld.js';
import { isUsSymbol } from '../report/seal.js';
import { notifyLimit } from '../report/plans.js';
import { noteBullets } from '../report/releases.js';
import { esc, mailButton, mailLayout, mailList, sendMail, type MailEnv } from './mail.js';

export type NotifyKind = 'daily' | 'watchReport' | 'screen' | 'price' | 'request' | 'intraday' | 'update' | 'test';
/** quiet (G-152): between quietFrom and quietTo (KST, may cross midnight) nothing goes to the phone; 🔔 still keeps it. */
/** updatePatch (G-177): off by default, only x.Y.0 releases are announced; on, every patch too. */
/** weekly (G-180): the Sunday-evening summary mail (watched stocks, screens, the week's reports). */
export interface Prefs { daily: boolean; watchReport: boolean; screen: boolean; price: boolean; request: boolean; update: boolean; updatePatch: boolean; weekly: boolean; push: boolean; quiet: boolean; quietFrom: string; quietTo: string }
export const DEFAULT_PREFS: Prefs = { daily: true, watchReport: true, screen: true, price: true, request: true, update: true, updatePatch: false, weekly: true, push: true, quiet: false, quietFrom: '23:00', quietTo: '07:00' };
const PREF_OF: Record<NotifyKind, keyof Prefs | null> = { daily: 'daily', watchReport: 'watchReport', screen: 'screen', price: 'price', intraday: 'price', request: 'request', update: 'update', test: null };

export async function prefsOf(db: D1, userId: string): Promise<Prefs> {
  const r = await db.prepare('SELECT prefs FROM notify_prefs WHERE user_id = ?').bind(userId).first<{ prefs: string }>();
  if (!r) return { ...DEFAULT_PREFS };
  try { return { ...DEFAULT_PREFS, ...cleanPrefs(JSON.parse(r.prefs)) }; } catch { return { ...DEFAULT_PREFS }; }
}
export const cleanPrefs = (v: unknown): Partial<Prefs> => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>, out: Partial<Prefs> = {};
  for (const k of Object.keys(DEFAULT_PREFS) as (keyof Prefs)[]) {
    if (typeof DEFAULT_PREFS[k] === 'boolean' && typeof o[k] === 'boolean') (out as Record<string, unknown>)[k] = o[k];
    if (typeof DEFAULT_PREFS[k] === 'string' && typeof o[k] === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(o[k] as string)) (out as Record<string, unknown>)[k] = o[k];
  }
  return out;
};

export interface Ctx { db: D1; fetch: typeof fetch; site: string; now: Date }
/** Inside the user's quiet hours (KST)? A window may cross midnight (23:00–07:00). */
export function inQuiet(p: Pick<Prefs, 'quiet' | 'quietFrom' | 'quietTo'>, now: Date): boolean {
  if (!p.quiet || p.quietFrom === p.quietTo) return false;
  const t = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(11, 16);
  return p.quietFrom < p.quietTo ? t >= p.quietFrom && t < p.quietTo : t >= p.quietFrom || t < p.quietTo;
}
const iso = (d: Date) => d.toISOString();

/** In the 🔔 list, and on the phone when the user turned push on. Returns false when their settings say no. */
export async function notifyUser(ctx: Ctx, userId: string, kind: NotifyKind, note: { title: string; body: string; link: string }): Promise<boolean> {
  const prefs = await prefsOf(ctx.db, userId), key = PREF_OF[kind];
  if (key && !prefs[key]) return false;
  // G-98: the plan decides what reaches the phone; 🔔 always gets what the plan allows at all.
  const plan = (await ctx.db.prepare('SELECT plan FROM users WHERE id = ?').bind(userId).first<{ plan: string }>())?.plan ?? 'free', lim = notifyLimit(plan);
  if ((kind === 'watchReport' && !lim.watchReport) || (kind === 'intraday' && !lim.intraday)) return false;
  await ctx.db.prepare('INSERT INTO notifications (user_id, kind, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(userId, kind, note.title, note.body, note.link, iso(ctx.now)).run();
  if (prefs.push && lim.push && !inQuiet(prefs, ctx.now)) await pushTo(ctx.db, ctx.fetch, userId, { ...note, link: `${ctx.site.replace(/\/$/, '')}/${note.link}`, tag: kind }, ctx.site, ctx.now).catch(() => 0);
  return true;
}

/** A JSON file of the site (watchinfo.json, search.json …), or null when it cannot be read. */
async function siteJson<T>(ctx: Ctx, path: string): Promise<T | null> {
  const r = await ctx.fetch(`${ctx.site.replace(/\/$/, '')}/${path}`, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
  return r?.ok ? (await r.json().catch(() => null)) as T | null : null;
}
/** Names by symbol from search.json; a symbol without a name reads as itself. */
async function siteNames(ctx: Ctx): Promise<(symbol: string) => string> {
  const names = new Map<string, string>();
  for (const it of (await siteJson<{ items: unknown[][] }>(ctx, 'search.json'))?.items ?? []) names.set(String(it[0]), String(it[1]));
  return (s) => names.get(s) ?? s;
}
/** A JSON array column, or [] when it is empty or broken. */
const jsonList = (t: string | null | undefined): string[] => { try { const v = JSON.parse(t || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } };

/** Once per key, ever (a user's daily note for a date, a request's report for a date). */
const once = async (db: D1, key: string, now: Date) => ((await db.prepare('INSERT OR IGNORE INTO notify_log (key, created_at) VALUES (?, ?)').bind(key, iso(now)).run()).meta?.changes ?? 0) === 1;
const kstDate = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
const reportLink = (s: string) => `${encodeURIComponent(s)}/index.html`;

/** G-177: release notes wait out the night (22:00–08:00 KST) so nobody is woken by an update. */
export const UPDATE_QUIET = { from: '22:00', to: '08:00' } as const;
export const inUpdateQuiet = (now: Date) => inQuiet({ quiet: true, quietFrom: UPDATE_QUIET.from, quietTo: UPDATE_QUIET.to }, now);
/** A minor release (x.Y.0) is news for everyone; a patch (x.Y.Z) only for readers who asked for patches. */
export const isMinorRelease = (version: string) => /^\d+\.\d+\.0$/.test(version);

/**
 * G-137: a new release tells everyone once (🔔, and the phone for those with push on): the site publishes
 * version.json with each build; the first check after a new version notes it for every active user.
 * G-177: patches reach only readers with updatePatch on, and nothing goes out between 22:00 and 08:00 KST —
 * the version stays pending (not marked done) until a morning run sends it.
 */
export async function runUpdateNotify(ctx: Ctx): Promise<{ version: string | null; sent: number; deferred?: boolean }> {
  const r = await ctx.fetch(`${ctx.site.replace(/\/$/, '')}/version.json`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!r?.ok) return { version: null, sent: 0 };
  const v = await r.json().catch(() => null) as { version?: string; title?: string; note?: string } | null;
  if (!v?.version || !/^\d+\.\d+\.\d+$/.test(v.version)) return { version: null, sent: 0 };
  // The first version a server sees is the baseline, not news.
  if (await once(ctx.db, 'update-seen-any', ctx.now)) { await once(ctx.db, `update-done:${v.version}`, ctx.now); return { version: v.version, sent: 0 }; }
  if (await ctx.db.prepare('SELECT 1 FROM notify_log WHERE key = ?').bind(`update-done:${v.version}`).first()) return { version: v.version, sent: 0 };
  if (inUpdateQuiet(ctx.now)) return { version: v.version, sent: 0, deferred: true };
  const minor = isMinorRelease(v.version);
  const users = (await ctx.db.prepare('SELECT id FROM users WHERE disabled = 0').all<{ id: string }>()).results;
  // G-153: the changes as a short bulleted list, not a paragraph.
  const note = String(v.note ?? '').trim(), body = noteBullets(note, 3);
  let sent = 0;
  for (const u of users) {
    // A patch reaches only those who asked for them; notifyUser then reads the same prefs for the 'update' kind.
    if (!minor && !(await prefsOf(ctx.db, u.id)).updatePatch) continue;
    if (!(await once(ctx.db, `update:${v.version}:${u.id}`, ctx.now))) continue;
    if (await notifyUser(ctx, u.id, 'update', { title: `업데이트 v${v.version}${v.title ? ` · ${v.title}` : ''}`, body: body || '새 기능과 바뀐 점을 확인해 보세요.', link: 'updates.html' })) sent += 1;
  }
  await once(ctx.db, `update-done:${v.version}`, ctx.now);
  return { version: v.version, sent };
}

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
  const nm = await siteNames(ctx);
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
  const stocks = [...new Set(alerts.map((a) => a.symbol).filter((s) => /^[0-9][0-9A-Z]{5}$/.test(s)))], coins = [...new Set(alerts.map((a) => a.symbol).filter((s) => s.startsWith('KRW-')))];
  // G-152: US stocks from Naver's world-stock quote, one call each; the pre/after-market price counts when that session is open.
  const us = [...new Set(alerts.map((a) => a.symbol).filter(isUsSymbol))].slice(0, 60);
  const px = new Map<string, number>();
  if (session) for (let i = 0; i < stocks.length; i += 40) {
    const r = await ctx.fetch(quoteUrl(stocks.slice(i, i + 40)), { signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'Mozilla/5.0 (gnomon-analytics)' } }).catch(() => null);
    if (r?.ok) for (const q of parseNaverQuotes(await r.json().catch(() => null))) px.set(q.symbol, q.price);
  }
  for (let i = 0; i < coins.length; i += 50) {
    const r = await ctx.fetch(`https://api.upbit.com/v1/ticker?markets=${coins.slice(i, i + 50).join(',')}`, { signal: AbortSignal.timeout(6000) }).catch(() => null);
    if (r?.ok) for (const t of (await r.json().catch(() => [])) as { market: string; trade_price: number }[]) if (t.trade_price > 0) px.set(t.market, t.trade_price);
  }
  for (const sym of us) {
    const r = await ctx.fetch(worldQuoteUrl(sym), { signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'Mozilla/5.0 (gnomon-analytics)' } }).catch(() => null);
    const q = r?.ok ? parseWorldQuote(await r.json().catch(() => null)) : null;
    if (q && q.session !== 'closed') px.set(sym, q.price);
  }
  let fired = 0;
  for (const a of alerts) {
    const p = px.get(a.symbol);
    if (p === undefined || !(a.op === '>=' ? p >= a.price : p <= a.price)) continue;
    const took = await ctx.db.prepare('UPDATE price_alerts SET fired_at = ?, fired_price = ? WHERE id = ? AND fired_at IS NULL').bind(iso(ctx.now), p, a.id).run();
    if ((took.meta?.changes ?? 0) !== 1) continue;
    const dollar = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const won = (v: number) => `${v >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}원`;
    const coin = a.symbol.startsWith('KRW-'), usd = isUsSymbol(a.symbol);
    await notifyUser(ctx, a.user_id, 'price', {
      title: `${a.name || a.symbol} ${(usd ? dollar : won)(p)} · ${(usd ? dollar : won)(a.price)} ${a.op === '>=' ? '이상' : '이하'} 도달`,
      body: `${a.note ? a.note + ' · ' : ''}설정한 가격 알림이에요. ${coin ? '업비트' : usd ? '네이버 해외 주식(프리·애프터마켓 포함)' : '네이버'} 시세 기준이라 몇 분 늦을 수 있고, 투자 권유가 아니에요.`,
      link: coin ? `coin.html?m=${a.symbol}` : usd ? `us.html?s=${encodeURIComponent(a.symbol)}` : `stock.html?c=${a.symbol}`,
    });
    fired += 1;
  }
  return { checked: px.size, fired };
}

/**
 * G-180: the weekly summary mail, Sunday evening (KST): the user's watched stocks (close, and this week's filings,
 * news and report when the report is this week's), the saved screens with alerts on (the only ones the
 * evening run keeps current) and the week's reports. Once per user and week; the key is written only after
 * Resend accepted the mail, so a failed send is tried again on the next evening run. Watched-stock lines
 * follow the plan's watchReport limit, as the push notes do (G-98).
 */
export async function runWeeklySummary(ctx: Ctx, env: MailEnv): Promise<{ week: string | null; sent: number }> {
  const kst = new Date(ctx.now.getTime() + 9 * 3600_000);
  if (kst.getUTCDay() !== 0) return { week: null, sent: 0 };
  const week = kstDate(ctx.now), site = ctx.site.replace(/\/$/, '');
  // Monday to Sunday: a report dated last Sunday belongs to last week's mail.
  const weekStart = kstDate(new Date(ctx.now.getTime() - 6 * 86400_000));
  const info = (await siteJson<Record<string, { c: number; f: number; n: number; d: string }>>(ctx, 'watchinfo.json')) ?? {};
  const nm = await siteNames(ctx);
  const md = (d: string) => d.slice(5).replace('-', '/');
  const price = (sym: string, v: number) => (isUsSymbol(sym) ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${v >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}원`);
  const weekReports = Object.entries(info).filter(([, x]) => x.d >= weekStart).sort((a, b) => b[1].d.localeCompare(a[1].d));
  const reportsBlock = weekReports.length ? `<h2 style="font-size:15px;margin:18px 0 4px">이번 주 리포트 ${weekReports.length}개</h2><p style="margin:0;line-height:1.6">${esc(weekReports.slice(0, 10).map(([s]) => nm(s)).join(', '))}${weekReports.length > 10 ? ` 외 ${weekReports.length - 10}개` : ''}</p>` : '';
  const reportsLine = weekReports.length ? `이번 주 리포트: ${weekReports.slice(0, 10).map(([s]) => nm(s)).join(', ')}` : '';
  const users = (await ctx.db.prepare('SELECT u.id, u.email, u.plan, w.symbols FROM users u LEFT JOIN watchlists w ON w.user_id = u.id WHERE u.disabled = 0').all<{ id: string; email: string; plan: string; symbols: string | null }>()).results;
  let sent = 0;
  for (const u of users) {
    try {
      const prefs = await prefsOf(ctx.db, u.id);
      if (!prefs.weekly || !u.email) continue;
      if (await ctx.db.prepare('SELECT 1 FROM notify_log WHERE key = ?').bind(`weekly:${u.id}:${week}`).first()) continue;
      const blocks: string[] = [], lines: string[] = [];
      const watch = jsonList(u.symbols), known = watch.filter((s) => info[s]);
      if (watch.length && notifyLimit(u.plan).watchReport) {
        const items = known.slice(0, 12).map((s) => { const x = info[s]!; return `<b>${esc(nm(s))}</b> ${esc(price(s, x.c))}${x.d >= weekStart ? ` · 공시 ${x.f}건 · 뉴스 ${x.n}건 · <span style="color:#4f46e5">${esc(md(x.d))} 새 리포트</span>` : ` <span style="color:#6b7684">· 리포트 ${esc(md(x.d))}</span>`}`; });
        const rest = watch.length - Math.min(known.length, 12);
        blocks.push(`<h2 style="font-size:15px;margin:18px 0 4px">관심 종목 ${watch.length}개</h2>${items.length ? mailList(items) : ''}${rest > 0 ? `<p style="margin:6px 0 0;color:#6b7684">${known.length > 12 ? `외 ${known.length - 12}개 · ` : ''}리포트가 없는 종목 ${watch.length - known.length}개</p>` : ''}`);
        if (known.length) lines.push(`관심 종목: ${known.slice(0, 12).map((s) => `${nm(s)} ${price(s, info[s]!.c)}`).join(', ')}`);
      }
      const screens = (await ctx.db.prepare('SELECT name, last_symbols, last_date FROM screens WHERE user_id = ? AND alert = 1 AND last_date IS NOT NULL ORDER BY id').bind(u.id).all<{ name: string; last_symbols: string | null; last_date: string }>()).results;
      if (screens.length) {
        const items = screens.slice(0, 8).map((sc) => `<b>${esc(sc.name)}</b> 걸린 종목 ${jsonList(sc.last_symbols).length}개 <span style="color:#6b7684">(${esc(sc.last_date)})</span>`);
        blocks.push(`<h2 style="font-size:15px;margin:18px 0 4px">내 조건 ${screens.length}개</h2>${mailList(items)}`);
        lines.push(`내 조건: ${screens.slice(0, 8).map((sc) => `${sc.name} ${jsonList(sc.last_symbols).length}개`).join(', ')}`);
      }
      if (reportsBlock) { blocks.push(reportsBlock); lines.push(reportsLine); }
      if (!blocks.length) continue;
      const title = `이번 주 그노몬 요약 · ${md(week)}`;
      const html = mailLayout(site, title, `<p style="margin:0;line-height:1.6;color:#6b7684">${esc(md(weekStart))}~${esc(md(week))} 한 주 동안 있었던 일이에요.</p>${blocks.join('')}<p style="margin:20px 0 0">${mailButton(`${site}/watch.html`, '관심 종목 보기')} &nbsp; <a href="${site}/scorecard.html" style="color:#4f46e5;font-weight:700">성적표 ›</a></p>`, { preheader: lines[0] ?? title });
      if (await sendMail(env, ctx.db, ctx.fetch, ctx.now, { kind: 'weekly', userId: u.id, to: u.email, subject: `[그노몬] ${title}`, html, text: `${title}\n${lines.join('\n')}\n${site}/watch.html` })) {
        await once(ctx.db, `weekly:${u.id}:${week}`, ctx.now);
        sent += 1;
      }
    } catch { /* one user's bad row must not stop the rest */ }
  }
  return { week, sent };
}
