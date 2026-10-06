// Alpha API (docs/DESIGN.md §5.13, G-44): email sign-in links behind invite codes, a credit ledger,
// credit requests approved by hand, report requests, the AI chat, surveys, feedback and usage
// events, plus an admin view. Runs as a Cloudflare Worker over D1; pure enough to test under Node.

import { ALPHA, ASK_TIERS, CREDIT_ACTIONS, CREDIT_COST, type AskTier, type CreditAction } from '../report/plans.js';
import { answerText, askParams, summarizeStock, usdOf, type AskClient } from './ask.js';
import type { D1 } from './db.js';
import { cleanScreen, FIELD_INDEX, matches } from '../analysis/screenRules.js';
import { intradaySignals, readIntraday } from '../analysis/intraday.js';
import { deepPath, DEEP_DATE, DEEP_SYMBOL, unseal } from '../report/seal.js';
import { openEvents } from '../report/events.js';
import { parseNaverQuotes, quoteUrl, type Quote } from '../sources/naverQuote.js';
import { parseNaverMinuteChart } from '../sources/naverPrice.js';

export interface Env {
  DB: D1;
  /** Public site, e.g. https://hanul442.github.io/gnomon_analytics */
  SITE_URL: string;
  /** Extra allowed origins, comma separated (local preview). */
  ALLOW_ORIGINS?: string;
  ADMIN_EMAILS?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  ANTHROPIC_API_KEY?: string;
  /** All users together, USD a day (KST). */
  AI_DAILY_USD?: string;
  /** Questions a user may ask a day. */
  USER_DAILY_ASKS?: string;
  /** G-61: the secret that opens sealed deep reports (GitHub secret GNM_DEEP_KEY). */
  DEEP_KEY?: string;
}
export interface Deps { now: () => Date; fetch: typeof fetch; ai?: AskClient }

interface User { id: string; email: string; plan: string; role: string; created_at: string; disabled: number }

const RANK: Record<string, number> = { free: 0, plus: 1, pro: 2, max: 3, alpha: 2 };
const LOGIN_TTL_MIN = 20, SESSION_DAYS = 30, MAX_BODY = 24_000;
const ACTION_KINDS = ['report', 'brief', 'upgrade', 'invite'] as const;

class HttpError extends Error { constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) { super(message); } }
const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}): never => { throw new HttpError(status, code, message, extra); };

const iso = (d: Date) => d.toISOString();
const kst = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString();
/** Start of today in KST, as a UTC ISO string (rows store UTC). */
const kstDayStart = (d: Date) => new Date(Date.parse(`${kst(d).slice(0, 10)}T00:00:00+09:00`)).toISOString();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// Passwords (G-57): PBKDF2-SHA256 at 100,000 rounds (the most Workers allow), a random salt per user.
const PBKDF2_ROUNDS = 100_000, LOCK_MIN = 15, LOCK_FAILS = 8;
export async function hashPassword(password: string, salt = b64url(crypto.getRandomValues(new Uint8Array(16))), rounds = PBKDF2_ROUNDS): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: rounds }, key, 256);
  return `pbkdf2$${rounds}$${salt}$${b64url(new Uint8Array(bits))}`;
}
async function passwordMatches(password: string, stored: string): Promise<boolean> {
  const [kind, rounds, salt] = stored.split('$');
  if (kind !== 'pbkdf2' || !salt || !Number(rounds)) return false;
  const again = await hashPassword(password, salt, Number(rounds));
  let diff = again.length ^ stored.length;
  for (let i = 0; i < Math.min(again.length, stored.length); i++) diff |= again.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}
/** 8–72 characters with a letter and a digit. */
const passwordProblem = (v: unknown): string => {
  if (typeof v !== 'string' || v.length < 8 || v.length > 72) return '비밀번호는 8자 이상 72자 이하로 정해 주세요.';
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return '비밀번호에 영문과 숫자를 함께 넣어 주세요.';
  return '';
};

export function inviteCode(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return `GNM-${[...crypto.getRandomValues(new Uint8Array(6))].map((b) => A[b % A.length]).join('')}`;
}
const normEmail = (v: unknown) => {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : '';
};
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : NaN);
const adminList = (env: Env) => (env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = [new URL(env.SITE_URL).origin, ...(env.ALLOW_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)];
  return allowed.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
    : { Vary: 'Origin' };
}
const json = (status: number, body: unknown, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });

async function body(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > MAX_BODY) fail(413, 'TOO_LARGE', '요청이 너무 커요.');
  if (!text) return {};
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : fail(400, 'BAD_JSON', '형식이 맞지 않아요.'); }
  catch (e) { if (e instanceof HttpError) throw e; return fail(400, 'BAD_JSON', '형식이 맞지 않아요.'); }
}

export async function balanceOf(db: D1, userId: string): Promise<number> {
  return (await db.prepare('SELECT COALESCE(SUM(delta), 0) AS b FROM ledger WHERE user_id = ?').bind(userId).first<{ b: number }>())?.b ?? 0;
}

/** Spends credits only if the balance covers them; one statement, so two tabs can't overspend. */
async function charge(db: D1, userId: string, cost: number, kind: string, note: string, ref: string, now: Date): Promise<boolean> {
  const r = await db.prepare(`INSERT INTO ledger (user_id, delta, kind, note, ref, created_at)
    SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COALESCE(SUM(delta), 0) FROM ledger WHERE user_id = ?) >= ?`)
    .bind(userId, -cost, kind, note, ref, iso(now), userId, cost).run();
  return (r.meta?.changes ?? 0) === 1;
}
const credit = (db: D1, userId: string, delta: number, kind: string, note: string, ref: string | null, now: Date) =>
  db.prepare('INSERT OR IGNORE INTO ledger (user_id, delta, kind, note, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(userId, delta, kind, note, ref, iso(now));

/** The alpha allowance, once per KST month, granted when the user is first seen that month. */
const monthlyGrant = (db: D1, u: User, now: Date) =>
  u.plan === 'alpha' ? credit(db, u.id, ALPHA.monthlyCredits, 'grant', `알파 ${kst(now).slice(0, 7)} 기본 크레딧`, `grant:${kst(now).slice(0, 7)}`, now).run() : Promise.resolve();

async function sendMail(env: Env, deps: Deps, to: string, link: string): Promise<void> {
  if (!env.RESEND_API_KEY) fail(503, 'MAIL_UNAVAILABLE', '메일 발송이 아직 설정되지 않았어요. 운영자에게 로그인 링크를 받아 주세요.');
  const html = `<div style="font-family:sans-serif;max-width:480px"><h2>그노몬 로그인</h2><p>아래 버튼을 누르면 로그인돼요. 링크는 ${LOGIN_TTL_MIN}분 동안 한 번만 쓸 수 있어요.</p><p><a href="${link}" style="display:inline-block;background:#0f2244;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">로그인</a></p><p style="color:#666;font-size:13px">요청하지 않았다면 이 메일을 무시해 주세요.</p></div>`;
  const r = await deps.fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM || 'Gnomon <onboarding@resend.dev>', to: [to], subject: '그노몬 로그인 링크', html, text: `그노몬 로그인 링크 (${LOGIN_TTL_MIN}분): ${link}` }),
  });
  if (!r.ok) fail(502, 'MAIL_FAILED', '메일을 보내지 못했어요. 잠시 뒤 다시 해 주세요.');
}

async function inviteOk(db: D1, code: string, now: Date): Promise<boolean> {
  const inv = await db.prepare('SELECT uses, max_uses, expires_at FROM invites WHERE code = ?').bind(code).first<{ uses: number; max_uses: number; expires_at: string | null }>();
  return !!inv && inv.uses < inv.max_uses && (!inv.expires_at || inv.expires_at > iso(now));
}

async function createLoginToken(db: D1, email: string, invite: string | null, now: Date): Promise<string> {
  const token = randomToken();
  await db.prepare('INSERT INTO login_tokens (hash, email, invite_code, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256(token), email, invite, iso(now), iso(new Date(now.getTime() + LOGIN_TTL_MIN * 60_000))).run();
  return token;
}
const loginLink = (env: Env, token: string) => `${env.SITE_URL.replace(/\/$/, '')}/login.html#t=${token}`;

async function authed(req: Request, env: Env, now: Date): Promise<User> {
  const m = /^Bearer\s+(\S+)$/.exec(req.headers.get('Authorization') ?? '');
  if (!m) fail(401, 'LOGIN_REQUIRED', '로그인이 필요해요.');
  const u = await env.DB.prepare(`SELECT u.id, u.email, u.plan, u.role, u.created_at, u.disabled FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.hash = ? AND s.expires_at > ?`).bind(await sha256(m![1]!), iso(now)).first<User>();
  if (!u) fail(401, 'LOGIN_REQUIRED', '로그인이 끝났어요. 다시 로그인해 주세요.');
  if (u!.disabled) fail(403, 'DISABLED', '사용이 중지된 계정이에요.');
  if (adminList(env).includes(u!.email)) u!.role = 'admin';
  await env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(iso(now), u!.id).run();
  return u!;
}

async function me(env: Env, u: User, now: Date) {
  await monthlyGrant(env.DB, u, now);
  const db = env.DB;
  const [balance, onboarding, lastPulse, requests, asksToday] = await Promise.all([
    balanceOf(db, u.id),
    db.prepare("SELECT answers FROM surveys WHERE user_id = ? AND kind = 'onboarding' ORDER BY id DESC LIMIT 1").bind(u.id).first<{ answers: string }>(),
    db.prepare("SELECT created_at FROM surveys WHERE user_id = ? AND kind = 'pulse' ORDER BY id DESC LIMIT 1").bind(u.id).first<{ created_at: string }>(),
    db.prepare('SELECT id, amount, reason, status, granted, admin_note, created_at, decided_at FROM credit_requests WHERE user_id = ? ORDER BY id DESC LIMIT 5').bind(u.id).all(),
    db.prepare("SELECT COUNT(*) AS n FROM questions WHERE user_id = ? AND created_at >= ? AND status = 'OK'").bind(u.id, kstDayStart(now)).first<{ n: number }>(),
  ]);
  const days = (now.getTime() - Date.parse(u.created_at)) / 86_400_000;
  return {
    user: { hasPassword: !!(await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(u.id).first<{ password_hash: string | null }>())?.password_hash, email: u.email, plan: u.plan, planName: u.plan === 'alpha' ? ALPHA.name : u.plan, rankAs: u.plan === 'alpha' ? ALPHA.rankAs : u.plan, admin: u.role === 'admin', createdAt: u.created_at },
    credits: { balance, monthly: u.plan === 'alpha' ? ALPHA.monthlyCredits : 0, maxRequest: ALPHA.maxRequest },
    survey: { onboarding: onboarding ? JSON.parse(onboarding.answers) : null, pulseDue: days >= 3 && (!lastPulse || now.getTime() - Date.parse(lastPulse.created_at) >= 7 * 86_400_000) },
    requests: requests.results,
    asks: { today: asksToday?.n ?? 0, limit: Number(env.USER_DAILY_ASKS ?? 30) },
    costs: CREDIT_COST,
  };
}

async function fetchStock(env: Env, deps: Deps, symbol: string): Promise<string> {
  try {
    const r = await deps.fetch(`${env.SITE_URL.replace(/\/$/, '')}/s/${symbol}.json`, { signal: AbortSignal.timeout(4000) });
    return r.ok ? summarizeStock(await r.json()) : '';
  } catch { return ''; }
}

async function ask(env: Env, deps: Deps, u: User, b: Record<string, unknown>, now: Date) {
  const tier = ASK_TIERS.find((t) => t.key === b.tier)?.key as AskTier | undefined;
  if (!tier) fail(400, 'BAD_TIER', '모델을 골라 주세요.');
  const question = str(b.question, 1000);
  if (question.length < 2) fail(400, 'EMPTY', '질문을 적어 주세요.');
  const symbol = typeof b.symbol === 'string' && /^\d{6}$/.test(b.symbol) ? b.symbol : undefined;
  const page = str(b.page, 6000);
  const history = (Array.isArray(b.history) ? b.history : []).slice(-3)
    .map((h) => ({ q: str((h as { q?: unknown })?.q, 1000), a: str((h as { a?: unknown })?.a, 2000) })).filter((h) => h.q && h.a);
  const db = env.DB, cost = CREDIT_COST[tier!];
  if (RANK[u.plan]! < RANK.plus!) fail(403, 'PLAN_REQUIRED', 'AI 질문은 플러스 요금제부터 쓸 수 있어요.');
  const today = await db.prepare("SELECT COUNT(*) AS n FROM questions WHERE user_id = ? AND created_at >= ? AND status = 'OK'").bind(u.id, kstDayStart(now)).first<{ n: number }>();
  if ((today?.n ?? 0) >= Number(env.USER_DAILY_ASKS ?? 30)) fail(429, 'DAILY_LIMIT', '오늘 질문 한도를 다 썼어요. 내일 다시 물어봐 주세요.');
  const spent = await db.prepare('SELECT COALESCE(SUM(usd), 0) AS usd FROM questions WHERE created_at >= ?').bind(kstDayStart(now)).first<{ usd: number }>();
  if ((spent?.usd ?? 0) >= Number(env.AI_DAILY_USD ?? 5)) fail(503, 'AI_BUDGET', '오늘 AI 사용량이 전체 한도에 닿았어요. 내일 다시 열려요.');
  if (!deps.ai) fail(503, 'AI_UNAVAILABLE', 'AI 연결이 아직 설정되지 않았어요.');
  const ref = `ask:${crypto.randomUUID()}`;
  if (!(await charge(db, u.id, cost, tier!, question.slice(0, 60), ref, now))) {
    fail(402, 'NO_CREDITS', `크레딧이 모자라요. 이 질문에는 ${cost}크레딧이 필요해요.`, { cost, balance: await balanceOf(db, u.id) });
  }
  const model = ASK_TIERS.find((t) => t.key === tier)!.model;
  const refund = (why: string) => credit(db, u.id, cost, 'refund', why, `refund:${ref}`, now).run();
  let res: Awaited<ReturnType<AskClient['create']>>;
  try {
    const siteData = symbol ? await fetchStock(env, deps, symbol) : '';
    res = await deps.ai!.create(askParams({ tier: tier!, question, ...(symbol ? { symbol } : {}), siteData, page, history }));
  } catch {
    await refund('AI 응답 실패로 돌려드림');
    await db.prepare("INSERT INTO questions (user_id, symbol, tier, model, question, credits, status, created_at) VALUES (?, ?, ?, ?, ?, 0, 'FAILED', ?)").bind(u.id, symbol ?? null, tier, model, question, iso(now)).run();
    return fail(502, 'AI_FAILED', 'AI가 답하지 못했어요. 크레딧은 돌려드렸어요.');
  }
  const usd = usdOf(model, res.usage.input_tokens, res.usage.output_tokens);
  const answer = answerText(res.content);
  const ok = res.stop_reason !== 'refusal' && answer.length > 0;
  if (!ok) await refund('AI가 답하지 않아 돌려드림');
  const row = await db.prepare(`INSERT INTO questions (user_id, symbol, tier, model, question, answer, credits, input_tokens, output_tokens, usd, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).bind(u.id, symbol ?? null, tier, res.model || model, question, answer, ok ? cost : 0,
    res.usage.input_tokens, res.usage.output_tokens, usd, ok ? 'OK' : 'REFUSED', iso(now)).first<{ id: number }>();
  if (!ok) fail(422, 'NO_ANSWER', '이 질문에는 답하지 않았어요. 크레딧은 돌려드렸어요.');
  return { id: row?.id, answer, tier, model: res.model || model, credits: cost, balance: await balanceOf(db, u.id), usage: { input: res.usage.input_tokens, output: res.usage.output_tokens } };
}

async function adminOverview(env: Env, now: Date) {
  const db = env.DB, week = iso(new Date(now.getTime() - 7 * 86_400_000)), month = iso(new Date(now.getTime() - 30 * 86_400_000));
  const q = <T>(sql: string, ...v: unknown[]) => db.prepare(sql).bind(...v).all<T>().then((r) => r.results);
  const [users, creditRequests, actions, invites, feedback, pulses, events, questions, spend] = await Promise.all([
    q(`SELECT u.id, u.email, u.plan, u.role, u.disabled, u.invite_code, u.created_at, u.last_seen_at,
        (SELECT COALESCE(SUM(delta), 0) FROM ledger l WHERE l.user_id = u.id) AS balance,
        (SELECT COUNT(*) FROM questions x WHERE x.user_id = u.id AND x.status = 'OK') AS asks,
        (SELECT COALESCE(SUM(usd), 0) FROM questions x WHERE x.user_id = u.id) AS usd,
        (SELECT answers FROM surveys s WHERE s.user_id = u.id AND s.kind = 'onboarding' ORDER BY s.id DESC LIMIT 1) AS onboarding
       FROM users u ORDER BY u.created_at DESC`),
    q(`SELECT r.*, u.email FROM credit_requests r JOIN users u ON u.id = r.user_id ORDER BY (r.status = 'pending') DESC, r.id DESC LIMIT 100`),
    q(`SELECT a.*, u.email FROM action_requests a JOIN users u ON u.id = a.user_id ORDER BY (a.status = 'pending') DESC, a.id DESC LIMIT 100`),
    q('SELECT * FROM invites ORDER BY created_at DESC'),
    q('SELECT f.*, u.email FROM feedback f JOIN users u ON u.id = f.user_id ORDER BY f.id DESC LIMIT 200'),
    q("SELECT s.kind, s.answers, s.created_at, u.email FROM surveys s JOIN users u ON u.id = s.user_id WHERE s.kind IN ('pulse', 'weekly', 'midterm') ORDER BY s.id DESC LIMIT 300"),
    q('SELECT name, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM events WHERE created_at >= ? GROUP BY name ORDER BY n DESC', week),
    q('SELECT x.id, x.symbol, x.tier, x.model, x.question, x.credits, x.usd, x.status, x.rating, x.created_at, u.email FROM questions x JOIN users u ON u.id = x.user_id ORDER BY x.id DESC LIMIT 100'),
    db.prepare('SELECT COALESCE(SUM(CASE WHEN created_at >= ? THEN usd END), 0) AS today, COALESCE(SUM(usd), 0) AS month FROM questions WHERE created_at >= ?').bind(kstDayStart(now), month).first<{ today: number; month: number }>(),
  ]);
  return { users, creditRequests, actions, invites, feedback, pulses, events, questions, spend: { ...spend, dailyCap: Number(env.AI_DAILY_USD ?? 5) } };
}

type Handler = (ctx: { req: Request; env: Env; deps: Deps; now: Date; params: string[] }) => Promise<unknown>;
const routes: [string, RegExp, Handler][] = [];
const route = (method: string, path: string, h: Handler) => routes.push([method, new RegExp(`^${path}$`), h]);

route('GET', '/health', async () => ({ ok: true }));

// G-62: live prices for stocks and ETFs, from Naver's polling feed (the browser cannot call it across
// origins). Public, at most 40 codes a call, answers cached for 8 seconds per code set in this isolate.
const quoteCache = new Map<string, { at: number; quotes: Quote[] }>();
route('GET', '/quote', async ({ req, deps, now }) => {
  const codes = [...new Set((new URL(req.url).searchParams.get('s') ?? '').split(',').map((x) => x.trim().toUpperCase()).filter((x) => /^[0-9A-Z]{6}$/.test(x)))].slice(0, 40).sort();
  if (!codes.length) fail(400, 'NO_CODES', '종목 코드를 6자리로 보내 주세요.');
  const key = codes.join(','), hit = quoteCache.get(key);
  if (hit && now.getTime() - hit.at < 8000) return { quotes: hit.quotes, cached: true };
  const r = await deps.fetch(quoteUrl(codes), { signal: AbortSignal.timeout(4000), headers: { 'user-agent': 'Mozilla/5.0 (gnomon-analytics)' } }).catch(() => null);
  if (!r || !r.ok) fail(502, 'UPSTREAM', '실시간 시세를 가져오지 못했어요.');
  const quotes = parseNaverQuotes(await r!.json().catch(() => null));
  if (quoteCache.size > 500) quoteCache.clear();
  quoteCache.set(key, { at: now.getTime(), quotes });
  return { quotes };
});

route('POST', '/auth/start', async ({ req, env, deps, now }) => {
  const b = await body(req), email = normEmail(b.email), db = env.DB;
  if (!email) fail(400, 'BAD_EMAIL', '이메일 주소를 확인해 주세요.');
  const recent = await db.prepare('SELECT COUNT(*) AS n FROM login_tokens WHERE email = ? AND created_at >= ?').bind(email, iso(new Date(now.getTime() - 3600_000))).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) fail(429, 'TOO_MANY', '로그인 링크를 너무 많이 요청했어요. 한 시간 뒤 다시 해 주세요.');
  const known = await db.prepare('SELECT disabled FROM users WHERE email = ?').bind(email).first<{ disabled: number }>();
  if (known?.disabled) fail(403, 'DISABLED', '사용이 중지된 계정이에요.');
  let invite: string | null = null;
  if (!known && !adminList(env).includes(email)) {
    invite = str(b.invite, 40).toUpperCase();
    if (!invite) fail(403, 'INVITE_REQUIRED', '처음이라면 초대 코드가 필요해요.');
    if (!(await inviteOk(db, invite!, now))) fail(403, 'INVITE_INVALID', '초대 코드가 맞지 않거나 다 쓰였어요.');
    if (b.terms !== true) fail(400, 'TERMS_REQUIRED', '이용 약관과 투자 유의 사항에 동의해 주세요.');
  }
  await sendMail(env, deps, email, loginLink(env, await createLoginToken(db, email, invite, now)));
  return { ok: true };
});

route('POST', '/auth/verify', async ({ req, env, now }) => {
  const b = await body(req), token = str(b.token, 100), db = env.DB;
  if (!token) fail(400, 'LINK_INVALID', '로그인 링크가 맞지 않아요.');
  const hash = await sha256(token);
  const row = await db.prepare('SELECT email, invite_code FROM login_tokens WHERE hash = ? AND used_at IS NULL AND expires_at > ?').bind(hash, iso(now)).first<{ email: string; invite_code: string | null }>();
  if (!row) fail(400, 'LINK_INVALID', '로그인 링크가 만료됐거나 이미 쓰였어요. 다시 요청해 주세요.');
  const used = await db.prepare('UPDATE login_tokens SET used_at = ? WHERE hash = ? AND used_at IS NULL').bind(iso(now), hash).run();
  if ((used.meta?.changes ?? 0) !== 1) fail(400, 'LINK_INVALID', '로그인 링크가 이미 쓰였어요.');
  const isAdmin = adminList(env).includes(row!.email);
  let u = await db.prepare('SELECT id, email, plan, role, created_at, disabled FROM users WHERE email = ?').bind(row!.email).first<User>();
  if (!u) {
    const code = row!.invite_code;
    if (code) {
      const took = await db.prepare('UPDATE invites SET uses = uses + 1 WHERE code = ? AND uses < max_uses AND (expires_at IS NULL OR expires_at > ?)').bind(code, iso(now)).run();
      if ((took.meta?.changes ?? 0) !== 1) fail(403, 'INVITE_INVALID', '초대 코드가 그사이 다 쓰였어요.');
    } else if (!isAdmin) fail(403, 'INVITE_REQUIRED', '초대 코드가 필요해요.');
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO users (id, email, plan, role, invite_code, created_at, terms_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, row!.email, 'alpha', isAdmin ? 'admin' : 'user', code, iso(now), iso(now)).run();
    if (code) {
      const inv = await db.prepare('SELECT credits, note FROM invites WHERE code = ?').bind(code).first<{ credits: number; note: string }>();
      if (inv?.credits) await credit(db, id, inv.credits, 'grant', `초대 코드 ${code} 가입 크레딧`, `invite:${code}`, now).run();
    }
    u = { id, email: row!.email, plan: 'alpha', role: isAdmin ? 'admin' : 'user', created_at: iso(now), disabled: 0 };
  }
  if (u.disabled) fail(403, 'DISABLED', '사용이 중지된 계정이에요.');
  if (isAdmin) u.role = 'admin';
  return startSession(env, u, now);
});

async function startSession(env: Env, u: User, now: Date) {
  const session = randomToken();
  await env.DB.prepare('INSERT INTO sessions (hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(session), u.id, iso(now), iso(new Date(now.getTime() + SESSION_DAYS * 86_400_000))).run();
  return { session, ...(await me(env, u, now)) };
}

// Sign-up with an invite code, email and password (G-57): the invite is used once, then email + password.
route('POST', '/auth/signup', async ({ req, env, now }) => {
  const b = await body(req), email = normEmail(b.email), db = env.DB, isAdmin = adminList(env).includes(email);
  if (!email) fail(400, 'BAD_EMAIL', '이메일 주소를 확인해 주세요.');
  const problem = passwordProblem(b.password);
  if (problem) fail(400, 'BAD_PASSWORD', problem);
  if (await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()) fail(409, 'ALREADY_JOINED', '이미 가입한 이메일이에요. 로그인해 주세요. 비밀번호를 정하지 않았다면 관리자에게 로그인 링크를 받아 계정 페이지에서 정할 수 있어요.');
  if (b.terms !== true) fail(400, 'TERMS_REQUIRED', '이용 약관과 투자 유의 사항에 동의해 주세요.');
  const code = str(b.invite, 40).toUpperCase();
  if (!code && !isAdmin) fail(403, 'INVITE_REQUIRED', '처음 가입할 때는 초대 코드가 필요해요.');
  if (code) {
    const took = await db.prepare('UPDATE invites SET uses = uses + 1 WHERE code = ? AND uses < max_uses AND (expires_at IS NULL OR expires_at > ?)').bind(code, iso(now)).run();
    if ((took.meta?.changes ?? 0) !== 1) fail(403, 'INVITE_INVALID', '초대 코드가 맞지 않거나 다 쓰였어요.');
  }
  const id = crypto.randomUUID(), role = isAdmin ? 'admin' : 'user';
  await db.prepare('INSERT INTO users (id, email, plan, role, invite_code, created_at, terms_at, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, email, 'alpha', role, code || null, iso(now), iso(now), await hashPassword(b.password as string)).run();
  if (code) {
    const inv = await db.prepare('SELECT credits FROM invites WHERE code = ?').bind(code).first<{ credits: number }>();
    if (inv?.credits) await credit(db, id, inv.credits, 'grant', `초대 코드 ${code} 가입 크레딧`, `invite:${code}`, now).run();
  }
  return startSession(env, { id, email, plan: 'alpha', role, created_at: iso(now), disabled: 0 }, now);
});

route('POST', '/auth/login', async ({ req, env, now }) => {
  const b = await body(req), email = normEmail(b.email), db = env.DB;
  if (!email || typeof b.password !== 'string') fail(400, 'LOGIN_FAILED', '이메일과 비밀번호를 입력해 주세요.');
  const since = iso(new Date(now.getTime() - LOCK_MIN * 60_000));
  const fails = await db.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE email = ? AND at >= ?').bind(email, since).first<{ n: number }>();
  if ((fails?.n ?? 0) >= LOCK_FAILS) fail(429, 'TOO_MANY', `비밀번호를 여러 번 틀렸어요. ${LOCK_MIN}분 뒤 다시 해 주세요.`);
  const row = await db.prepare('SELECT id, email, plan, role, created_at, disabled, password_hash FROM users WHERE email = ?').bind(email).first<User & { password_hash: string | null }>();
  if (!row?.password_hash || !(await passwordMatches(b.password as string, row.password_hash))) {
    await db.prepare('INSERT INTO login_attempts (email, at) VALUES (?, ?)').bind(email, iso(now)).run();
    fail(401, 'LOGIN_FAILED', '이메일 또는 비밀번호가 맞지 않아요.');
  }
  if (row!.disabled) fail(403, 'DISABLED', '사용이 중지된 계정이에요.');
  await db.prepare('DELETE FROM login_attempts WHERE email = ? OR at < ?').bind(email, since).run();
  const { password_hash: _drop, ...u } = row!;
  if (adminList(env).includes(u.email)) u.role = 'admin';
  return startSession(env, u, now);
});

/** Set or change the password; changing one needs the current password. */
route('POST', '/me/password', async ({ req, env, now }) => {
  const u = await authed(req, env, now), b = await body(req), db = env.DB;
  const problem = passwordProblem(b.password);
  if (problem) fail(400, 'BAD_PASSWORD', problem);
  const cur = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(u.id).first<{ password_hash: string | null }>();
  if (cur?.password_hash && !(typeof b.current === 'string' && await passwordMatches(b.current, cur.password_hash))) fail(403, 'BAD_CURRENT', '지금 비밀번호가 맞지 않아요.');
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(b.password as string), u.id).run();
  return { ok: true };
});

route('POST', '/auth/logout', async ({ req, env }) => {
  const m = /^Bearer\s+(\S+)$/.exec(req.headers.get('Authorization') ?? '');
  if (m) await env.DB.prepare('DELETE FROM sessions WHERE hash = ?').bind(await sha256(m[1]!)).run();
  return { ok: true };
});

route('GET', '/me', async ({ req, env, now }) => me(env, await authed(req, env, now), now));

route('GET', '/me/ledger', async ({ req, env, now }) => {
  const u = await authed(req, env, now);
  return { rows: (await env.DB.prepare('SELECT delta, kind, note, created_at FROM ledger WHERE user_id = ? ORDER BY id DESC LIMIT 200').bind(u.id).all()).results };
});

route('GET', '/me/export', async ({ req, env, now }) => {
  const u = await authed(req, env, now), db = env.DB;
  const all = (t: string) => db.prepare(`SELECT * FROM ${t} WHERE user_id = ?`).bind(u.id).all().then((r) => r.results);
  const [ledger, creditRequests, actions, questions, surveys, feedback, events, screens, notifications, watchlist] = await Promise.all(['ledger', 'credit_requests', 'action_requests', 'questions', 'surveys', 'feedback', 'events', 'screens', 'notifications', 'watchlists'].map(all));
  return { exportedAt: iso(now), user: { email: u.email, plan: u.plan, createdAt: u.created_at }, ledger, creditRequests, actions, questions, surveys, feedback, events, screens, notifications, watchlist };
});

route('POST', '/me/delete', async ({ req, env, now }) => {
  const u = await authed(req, env, now), b = await body(req);
  if (b.confirm !== '삭제') fail(400, 'CONFIRM', "확인 문구 '삭제'를 적어 주세요.");
  const db = env.DB;
  await db.batch([...['ledger', 'credit_requests', 'action_requests', 'questions', 'surveys', 'feedback', 'events', 'screens', 'notifications', 'watchlists', 'sessions'].map((t) => db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(u.id)),
    db.prepare('DELETE FROM login_tokens WHERE email = ?').bind(u.email), db.prepare('DELETE FROM users WHERE id = ?').bind(u.id)]);
  return { ok: true };
});

// G-73: claim a running credit event, once per account (the ledger's unique ref keeps it to one).
route('POST', '/events/claim', async ({ req, env, now }) => {
  const u = await authed(req, env, now), b = await body(req), id = str(b.id, 60);
  const ev = openEvents(kst(now).slice(0, 10)).find((e) => e.id === id);
  if (!ev) fail(404, 'NO_EVENT', '지금 진행 중인 이벤트가 아니에요.');
  const r = await credit(env.DB, u.id, ev!.credits, 'grant', `${ev!.title} ${ev!.credits}크레딧`, `event:${ev!.id}`, now).run();
  if (!r.meta?.changes) fail(409, 'ALREADY', '이미 받은 이벤트예요.');
  return { ok: true, credits: ev!.credits, balance: await balanceOf(env.DB, u.id) };
});

route('POST', '/credits/request', async ({ req, env, now }) => {
  const u = await authed(req, env, now), b = await body(req), amount = int(b.amount), reason = str(b.reason, 500);
  if (!(amount >= 10 && amount <= ALPHA.maxRequest)) fail(400, 'BAD_AMOUNT', `10~${ALPHA.maxRequest}크레딧 사이로 요청해 주세요.`);
  if (reason.length < 4) fail(400, 'REASON', '어디에 쓰실지 한 줄 적어 주세요.');
  const open = await env.DB.prepare("SELECT id FROM credit_requests WHERE user_id = ? AND status = 'pending'").bind(u.id).first();
  if (open) fail(409, 'PENDING_EXISTS', '처리 중인 요청이 있어요. 승인되면 알려 드릴게요.');
  await env.DB.prepare('INSERT INTO credit_requests (user_id, amount, reason, created_at) VALUES (?, ?, ?, ?)').bind(u.id, amount, reason, iso(now)).run();
  return { ok: true };
});

route('POST', '/actions', async ({ req, env, now }) => {
  const u = await authed(req, env, now), b = await body(req);
  const kind = ACTION_KINDS.find((k) => k === b.kind) as CreditAction | undefined, symbol = str(b.symbol, 6);
  if (!kind || !/^\d{6}$/.test(symbol)) fail(400, 'BAD_ACTION', '요청 형식이 맞지 않아요.');
  const min = CREDIT_ACTIONS.find((a) => a.key === kind)!.min;
  if (RANK[u.plan]! < RANK[min]!) fail(403, 'PLAN_REQUIRED', '이 요청은 지금 요금제에서 쓸 수 없어요.');
  const dup = await env.DB.prepare("SELECT id FROM action_requests WHERE user_id = ? AND kind = ? AND symbol = ? AND status = 'pending'").bind(u.id, kind, symbol).first();
  if (dup) fail(409, 'DUPLICATE', '이미 요청했어요.');
  const cost = CREDIT_COST[kind!], ref = `action:${crypto.randomUUID()}`;
  if (!(await charge(env.DB, u.id, cost, kind!, `${symbol} ${str(b.detail, 60)}`.trim(), ref, now))) fail(402, 'NO_CREDITS', `크레딧이 모자라요. ${cost}크레딧이 필요해요.`, { cost, balance: await balanceOf(env.DB, u.id) });
  await env.DB.prepare('INSERT INTO action_requests (user_id, kind, symbol, detail, credits, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(u.id, kind, symbol, str(b.detail, 400), cost, iso(now)).run();
  return { ok: true, balance: await balanceOf(env.DB, u.id) };
});

route('POST', '/ask', async ({ req, env, deps, now }) => ask(env, deps, await authed(req, env, now), await body(req), now));

route('POST', '/ask/(\\d+)/rate', async ({ req, env, now, params }) => {
  const u = await authed(req, env, now), b = await body(req), rating = int(b.rating);
  if (rating !== 1 && rating !== -1) fail(400, 'BAD_RATING', '평가를 골라 주세요.');
  await env.DB.prepare('UPDATE questions SET rating = ? WHERE id = ? AND user_id = ?').bind(rating, Number(params[0]), u.id).run();
  return { ok: true };
});

route('POST', '/survey', async ({ req, env, now }) => {
  const u = await authed(req, env, now), b = await body(req);
  if (!['onboarding', 'pulse', 'midterm', 'weekly'].includes(String(b.kind))) fail(400, 'BAD_SURVEY', '설문 종류가 맞지 않아요.');
  const answers = JSON.stringify(b.answers ?? {});
  if (answers.length > 6000 || typeof b.answers !== 'object') fail(400, 'BAD_SURVEY', '응답이 너무 길어요.');
  await env.DB.prepare('INSERT INTO surveys (user_id, kind, answers, created_at) VALUES (?, ?, ?, ?)').bind(u.id, b.kind, answers, iso(now)).run();
  return { ok: true };
});

route('POST', '/feedback', async ({ req, env, now }) => {
  const u = await authed(req, env, now), b = await body(req), rating = b.rating === undefined ? null : int(b.rating);
  const text = str(b.text, 2000), target = str(b.target, 100);
  if (!target || (rating !== null && ![-1, 0, 1].includes(rating)) || (rating === null && !text)) fail(400, 'BAD_FEEDBACK', '의견을 적어 주세요.');
  await env.DB.prepare('INSERT INTO feedback (user_id, page, target, rating, text, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(u.id, str(b.page, 200), target, rating, text, iso(now)).run();
  return { ok: true };
});

route('POST', '/events', async ({ req, env, now }) => {
  const u = await authed(req, env, now), b = await body(req);
  const list = (Array.isArray(b.events) ? b.events : []).slice(0, 20)
    .map((e) => e as { name?: unknown; page?: unknown; props?: unknown })
    .filter((e) => typeof e.name === 'string' && /^[a-z0-9_.:-]{1,40}$/.test(e.name));
  if (list.length) await env.DB.batch(list.map((e) => env.DB.prepare('INSERT INTO events (user_id, name, page, props, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(u.id, e.name, str(e.page, 200), JSON.stringify(e.props ?? {}).slice(0, 500), iso(now))));
  return { ok: true, saved: list.length };
});

// ---- saved screens and alerts (G-50) ----
const ALERT_LIMIT: Record<string, number> = { free: 0, plus: 3, pro: 20, max: 20, alpha: 20 };

route('GET', '/screens', async ({ req, env, now }) => {
  const u = await authed(req, env, now);
  const rows = (await env.DB.prepare('SELECT id, name, screen, alert, last_date, created_at FROM screens WHERE user_id = ? ORDER BY id').bind(u.id).all<{ id: number; name: string; screen: string; alert: number; last_date: string | null; created_at: string }>()).results;
  return { screens: rows.map((r) => ({ id: r.id, name: r.name, screen: JSON.parse(r.screen), alert: !!r.alert, lastDate: r.last_date })), alertLimit: ALERT_LIMIT[u.plan] ?? 0 };
});

route('POST', '/screens', async ({ req, env, now }) => {
  const u = await authed(req, env, now), b = await body(req);
  if (RANK[u.plan]! < RANK.plus!) fail(403, 'PLAN_REQUIRED', '조건 저장은 플러스부터 쓸 수 있어요.');
  const screen = cleanScreen(b.screen), name = str(b.name, 40);
  if (!screen || !screen.rules.length || !name) fail(400, 'BAD_SCREEN', '조건과 이름을 확인해 주세요.');
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM screens WHERE user_id = ?').bind(u.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= 30) fail(409, 'TOO_MANY', '조건은 30개까지 저장할 수 있어요.');
  await env.DB.prepare('INSERT INTO screens (user_id, name, screen, created_at) VALUES (?, ?, ?, ?)').bind(u.id, name, JSON.stringify(screen), iso(now)).run();
  return { ok: true };
});

route('POST', '/screens/(\\d+)', async ({ req, env, now, params }) => {
  const u = await authed(req, env, now), b = await body(req), id = Number(params[0]);
  if (b.alert === true) {
    const on = await env.DB.prepare('SELECT COUNT(*) AS n FROM screens WHERE user_id = ? AND alert = 1 AND id != ?').bind(u.id, id).first<{ n: number }>();
    const limit = ALERT_LIMIT[u.plan] ?? 0;
    if ((on?.n ?? 0) >= limit) fail(403, 'ALERT_LIMIT', limit ? `알림은 ${limit}개 조건까지 켤 수 있어요.` : '알림은 플러스부터 쓸 수 있어요.');
  }
  // Turning alerts on starts from today's matches, so the first message lists only what is new afterwards.
  const r = await env.DB.prepare('UPDATE screens SET alert = ?, last_symbols = CASE WHEN ? = 1 THEN NULL ELSE last_symbols END WHERE id = ? AND user_id = ?').bind(b.alert ? 1 : 0, b.alert ? 1 : 0, id, u.id).run();
  if ((r.meta?.changes ?? 0) !== 1) fail(404, 'NO_SCREEN', '없는 조건이에요.');
  return { ok: true };
});

route('POST', '/screens/(\\d+)/delete', async ({ req, env, now, params }) => {
  const u = await authed(req, env, now);
  await env.DB.prepare('DELETE FROM screens WHERE id = ? AND user_id = ?').bind(Number(params[0]), u.id).run();
  return { ok: true };
});

route('GET', '/notifications', async ({ req, env, now }) => {
  const u = await authed(req, env, now);
  const rows = (await env.DB.prepare('SELECT id, kind, title, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30').bind(u.id).all()).results;
  return { items: rows, unread: rows.filter((r) => !(r as { read_at: string | null }).read_at).length };
});

route('POST', '/notifications/read', async ({ req, env, now }) => {
  const u = await authed(req, env, now);
  await env.DB.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').bind(iso(now), u.id).run();
  return { ok: true };
});

/**
 * Daily alert job (cron, after the site's daily build): checks every alerting screen against the
 * published screener.json and tells each user which stocks newly match. Runs once per data date.
 */
export async function runAlerts(env: Env, deps: Deps): Promise<{ date: string | null; screens: number; sent: number }> {
  const now = deps.now(), db = env.DB;
  const r = await deps.fetch(`${env.SITE_URL.replace(/\/$/, '')}/screener.json`, { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) return { date: null, screens: 0, sent: 0 };
  const data = await r.json() as { date: string | null; rows: unknown[][] };
  if (!data.date || !data.rows?.length) return { date: null, screens: 0, sent: 0 };
  const list = (await db.prepare(`SELECT s.id, s.user_id, s.name, s.screen, s.last_symbols, s.last_date, u.email, u.plan FROM screens s JOIN users u ON u.id = s.user_id
    WHERE s.alert = 1 AND u.disabled = 0 AND (s.last_date IS NULL OR s.last_date < ?)`).bind(data.date).all<{ id: number; user_id: string; name: string; screen: string; last_symbols: string | null; last_date: string | null; email: string; plan: string }>()).results;
  let sent = 0;
  for (const s of list) {
    const screen = cleanScreen(JSON.parse(s.screen));
    if (!screen) continue;
    const hits = data.rows.filter((row) => matches(row, screen, FIELD_INDEX));
    const symbols = hits.map((row) => String(row[0]));
    const before = s.last_symbols ? new Set(JSON.parse(s.last_symbols) as string[]) : null;
    const fresh = before ? hits.filter((row) => !before.has(String(row[0]))) : [];
    const stmts = [db.prepare('UPDATE screens SET last_symbols = ?, last_date = ? WHERE id = ?').bind(JSON.stringify(symbols), data.date, s.id)];
    if (fresh.length) {
      const names = fresh.slice(0, 8).map((row) => String(row[1])).join(', ') + (fresh.length > 8 ? ` 외 ${fresh.length - 8}개` : '');
      stmts.push(db.prepare('INSERT INTO notifications (user_id, kind, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(s.user_id, 'screen', `'${s.name}' 조건에 새로 걸린 종목 ${fresh.length}개`, `${data.date} 장 마감 기준: ${names}`, `screener.html`, iso(now)));
      sent += 1;
    }
    await db.batch(stmts);
    if (fresh.length && env.RESEND_API_KEY) {
      // Best effort: before our own mail domain is verified, only the account owner's address receives mail.
      const lines = fresh.slice(0, 20).map((row) => `<li><b>${String(row[1]).replace(/[<>&]/g, '')}</b> ${String(row[0])}</li>`).join('');
      await deps.fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.MAIL_FROM || 'Gnomon <onboarding@resend.dev>', to: [s.email], subject: `[그노몬] '${s.name}' 새 종목 ${fresh.length}개`, html: `<p>${data.date} 장 마감 기준으로 새로 걸린 종목이에요.</p><ul>${lines}</ul><p><a href="${env.SITE_URL}/screener.html">스크리너에서 보기</a></p><p style="color:#666;font-size:12px">계산 결과이고 투자 권유가 아니에요.</p>` }),
      }).catch(() => undefined);
    }
  }
  return { date: data.date, screens: list.length, sent };
}

// ---- sealed deep reports (G-61) ----
// The site holds <symbol>/deep/<date>.txt, sealed with DEEP_KEY. Opening one costs credits once per user
// and report; admins and whoever requested the stock's report open it free.
async function deepAccess(db: D1, u: User, symbol: string, date: string): Promise<boolean> {
  if (u.role === 'admin') return true;
  if (await db.prepare('SELECT 1 FROM unlocks WHERE user_id = ? AND symbol = ? AND date = ?').bind(u.id, symbol, date).first()) return true;
  return !!(await db.prepare("SELECT 1 FROM action_requests WHERE user_id = ? AND symbol = ? AND kind IN ('report', 'upgrade') AND status != 'rejected' AND created_at <= ?").bind(u.id, symbol, `${date}T23:59:59Z`).first());
}
async function deepHtml(env: Env, deps: Deps, symbol: string, date: string): Promise<string> {
  if (!env.DEEP_KEY) fail(503, 'NOT_SEALED', '심층 리포트 열쇠가 아직 설정되지 않았어요.');
  const r = await deps.fetch(`${env.SITE_URL.replace(/\/$/, '')}/${deepPath(symbol, date)}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r?.ok) fail(404, 'NOT_SEALED', '이 리포트의 심층 내용이 아직 없어요.');
  try { return await unseal(await r!.text(), env.DEEP_KEY!); } catch { fail(500, 'UNSEAL_FAILED', '심층 리포트를 열지 못했어요. 운영자에게 알려 주세요.'); }
  return '';
}
const deepParams = (params: string[]) => {
  const symbol = decodeURIComponent(params[0] ?? ''), date = params[1] ?? '';
  if (!DEEP_SYMBOL.test(symbol) || !DEEP_DATE.test(date)) fail(400, 'BAD_REPORT', '리포트 주소가 맞지 않아요.');
  return { symbol, date };
};

route('GET', '/deep/([^/]+)/(\\d{4}-\\d{2}-\\d{2})', async ({ req, env, deps, now, params }) => {
  const u = await authed(req, env, now), { symbol, date } = deepParams(params);
  if (!(await deepAccess(env.DB, u, symbol, date))) fail(402, 'LOCKED', `${CREDIT_COST.unlock}크레딧으로 열 수 있어요.`, { cost: CREDIT_COST.unlock, balance: await balanceOf(env.DB, u.id) });
  return { html: await deepHtml(env, deps, symbol, date) };
});

route('POST', '/deep/([^/]+)/(\\d{4}-\\d{2}-\\d{2})/unlock', async ({ req, env, deps, now, params }) => {
  const u = await authed(req, env, now), { symbol, date } = deepParams(params), db = env.DB;
  // The report must exist before anything is charged.
  const html = await deepHtml(env, deps, symbol, date);
  if (await deepAccess(db, u, symbol, date)) return { html, charged: 0 };
  const cost = CREDIT_COST.unlock;
  if (!(await charge(db, u.id, cost, 'unlock', `${symbol} ${date} 심층 리포트`, `unlock:${u.id}:${symbol}:${date}`, now))) {
    if (await deepAccess(db, u, symbol, date)) return { html, charged: 0 };
    fail(402, 'NO_CREDITS', `크레딧이 모자라요. ${cost}크레딧이 필요해요.`, { cost, balance: await balanceOf(db, u.id) });
  }
  await db.prepare('INSERT OR IGNORE INTO unlocks (user_id, symbol, date, credits, created_at) VALUES (?, ?, ?, ?, ?)').bind(u.id, symbol, date, cost, iso(now)).run();
  return { html, charged: cost, balance: await balanceOf(db, u.id) };
});

// ---- watchlist on the server and intraday alerts (G-52) ----
route('GET', '/watch', async ({ req, env, now }) => {
  const u = await authed(req, env, now);
  const r = await env.DB.prepare('SELECT symbols, updated_at FROM watchlists WHERE user_id = ?').bind(u.id).first<{ symbols: string; updated_at: string }>();
  return { symbols: r ? JSON.parse(r.symbols) : [], updatedAt: r?.updated_at ?? null };
});

route('POST', '/watch', async ({ req, env, now }) => {
  const u = await authed(req, env, now), b = await body(req);
  const symbols = [...new Set((Array.isArray(b.symbols) ? b.symbols : []).filter((x): x is string => typeof x === 'string' && /^([0-9A-Z]{6}|KRW-[A-Z0-9]{1,15})$/.test(x)))].slice(0, 100);
  await env.DB.prepare('INSERT INTO watchlists (user_id, symbols, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET symbols = excluded.symbols, updated_at = excluded.updated_at')
    .bind(u.id, JSON.stringify(symbols), iso(now)).run();
  return { ok: true, count: symbols.length, updatedAt: iso(now) };
});

const latin1 = (buf: ArrayBuffer) => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode(...a.subarray(i, i + 8192)); return s; };

/**
 * Intraday job (cron every 10 minutes in the session): scans the stocks Pro-level users watch and
 * tells them when volume runs far ahead of its usual pace or the price moves 5%. Once per stock,
 * day and kind. Naver's minute feed is a few minutes behind, and the message says the time it saw.
 */
export async function runIntraday(env: Env, deps: Deps): Promise<{ symbols: number; alerts: number }> {
  const now = deps.now(), kstNow = kst(now), today = kstNow.slice(0, 10), hhmm = kstNow.slice(11, 16), dow = new Date(Date.parse(`${today}T00:00:00Z`)).getUTCDay();
  if (dow === 0 || dow === 6 || hhmm < '09:10' || hhmm > '15:45') return { symbols: 0, alerts: 0 };
  const db = env.DB;
  const rows = (await db.prepare('SELECT w.user_id, w.symbols, u.plan FROM watchlists w JOIN users u ON u.id = w.user_id WHERE u.disabled = 0').all<{ user_id: string; symbols: string; plan: string }>()).results
    .filter((r) => (RANK[r.plan] ?? 0) >= RANK.pro!);
  const watchers = new Map<string, string[]>();
  // Coins trade around the clock on Upbit and are not scanned here; stocks and ETFs only.
  for (const r of rows) for (const sym of (JSON.parse(r.symbols) as string[]).filter((x) => /^[0-9A-Z]{6}$/.test(x))) (watchers.get(sym) ?? watchers.set(sym, []).get(sym)!).push(r.user_id);
  const symbols = [...watchers.keys()].slice(0, 150);
  if (!symbols.length) return { symbols: 0, alerts: 0 };
  const names = new Map<string, string>();
  try {
    const s = await deps.fetch(`${env.SITE_URL.replace(/\/$/, '')}/search.json`, { signal: AbortSignal.timeout(15_000) });
    if (s.ok) for (const it of ((await s.json()) as { items: unknown[][] }).items) names.set(String(it[0]), String(it[1]));
  } catch { /* names are a nicety */ }
  let alerts = 0;
  const one = async (sym: string) => {
    const r = await deps.fetch(`https://fchart.stock.naver.com/sise.nhn?symbol=${sym}&timeframe=minute&count=4000&requestType=0`, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return;
    const read = readIntraday(parseNaverMinuteChart(latin1(await r.arrayBuffer()), sym, now), today);
    if (!read) return;
    for (const sig of intradaySignals(read, names.get(sym) ?? sym)) {
      const fresh = await db.prepare('INSERT OR IGNORE INTO intraday_alerts (symbol, date, kind, detail, created_at) VALUES (?, ?, ?, ?, ?)').bind(sym, today, sig.kind, JSON.stringify(read), iso(now)).run();
      if ((fresh.meta?.changes ?? 0) !== 1) continue;
      alerts += 1;
      await db.batch((watchers.get(sym) ?? []).map((uid) => db.prepare('INSERT INTO notifications (user_id, kind, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(uid, 'intraday', `장중 · ${sig.text}`, '관심 종목 장중 감시예요. 네이버 분봉 기준이라 몇 분 늦을 수 있고, 투자 권유가 아니에요.', `stock.html?c=${sym}`, iso(now))));
    }
  };
  for (let i = 0; i < symbols.length; i += 6) await Promise.all(symbols.slice(i, i + 6).map((sym) => one(sym).catch(() => undefined)));
  return { symbols: symbols.length, alerts };
}

// ---- admin ----
const admin = async (req: Request, env: Env, now: Date) => {
  const u = await authed(req, env, now);
  if (u.role !== 'admin') fail(403, 'ADMIN_ONLY', '운영자만 쓸 수 있어요.');
  return u;
};

route('GET', '/admin/overview', async ({ req, env, now }) => { await admin(req, env, now); return adminOverview(env, now); });

route('POST', '/admin/credit-requests/(\\d+)', async ({ req, env, now, params }) => {
  await admin(req, env, now);
  const b = await body(req), id = Number(params[0]), db = env.DB;
  const r = await db.prepare("SELECT user_id, amount FROM credit_requests WHERE id = ? AND status = 'pending'").bind(id).first<{ user_id: string; amount: number }>();
  if (!r) fail(404, 'NOT_PENDING', '처리할 요청이 없어요.');
  const note = str(b.note, 300);
  if (b.decision === 'approve') {
    const amount = b.amount === undefined ? r!.amount : int(b.amount);
    if (!(amount > 0 && amount <= 5000)) fail(400, 'BAD_AMOUNT', '지급할 크레딧을 확인해 주세요.');
    await db.batch([
      db.prepare("UPDATE credit_requests SET status = 'approved', granted = ?, admin_note = ?, decided_at = ? WHERE id = ? AND status = 'pending'").bind(amount, note, iso(now), id),
      credit(db, r!.user_id, amount, 'grant', `크레딧 요청 #${id} 승인${note ? ` · ${note}` : ''}`, `request:${id}`, now),
    ]);
  } else if (b.decision === 'reject') {
    await db.prepare("UPDATE credit_requests SET status = 'rejected', admin_note = ?, decided_at = ? WHERE id = ? AND status = 'pending'").bind(note, iso(now), id).run();
  } else fail(400, 'BAD_DECISION', '승인 또는 거절을 골라 주세요.');
  return { ok: true };
});

route('POST', '/admin/invites', async ({ req, env, now }) => {
  await admin(req, env, now);
  const b = await body(req), code = (str(b.code, 40) || inviteCode()).toUpperCase(), maxUses = b.maxUses === undefined ? 1 : int(b.maxUses), credits = b.credits === undefined ? 0 : int(b.credits);
  if (!/^[A-Z0-9-]{4,40}$/.test(code) || !(maxUses >= 1 && maxUses <= 500) || !(credits >= 0 && credits <= 1000)) fail(400, 'BAD_INVITE', '초대 코드 설정을 확인해 주세요.');
  const expires = typeof b.expiresAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.expiresAt) ? new Date(Date.parse(`${b.expiresAt}T23:59:59+09:00`)).toISOString() : null;
  const r = await env.DB.prepare('INSERT OR IGNORE INTO invites (code, note, max_uses, credits, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(code, str(b.note, 200), maxUses, credits, expires, iso(now)).run();
  if ((r.meta?.changes ?? 0) !== 1) fail(409, 'EXISTS', '이미 있는 코드예요.');
  return { ok: true, code };
});

route('POST', '/admin/invites/([A-Z0-9-]+)/close', async ({ req, env, now, params }) => {
  await admin(req, env, now);
  await env.DB.prepare('UPDATE invites SET max_uses = uses WHERE code = ?').bind(params[0]).run();
  return { ok: true };
});

route('POST', '/admin/grant', async ({ req, env, now }) => {
  await admin(req, env, now);
  const b = await body(req), amount = int(b.amount), userId = str(b.userId, 60);
  if (!userId || !(amount !== 0 && amount >= -5000 && amount <= 5000)) fail(400, 'BAD_AMOUNT', '크레딧 수를 확인해 주세요.');
  const exists = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
  if (!exists) fail(404, 'NO_USER', '없는 사용자예요.');
  await credit(env.DB, userId, amount, amount > 0 ? 'grant' : 'adjust', str(b.note, 200) || '운영자 조정', null, now).run();
  return { ok: true, balance: await balanceOf(env.DB, userId) };
});

route('POST', '/admin/users/([0-9a-f-]+)', async ({ req, env, now, params }) => {
  await admin(req, env, now);
  const b = await body(req), db = env.DB;
  if (b.plan !== undefined) {
    if (!['alpha', 'free', 'plus', 'pro', 'max'].includes(String(b.plan))) fail(400, 'BAD_PLAN', '요금제를 확인해 주세요.');
    await db.prepare('UPDATE users SET plan = ? WHERE id = ?').bind(b.plan, params[0]).run();
  }
  if (b.disabled !== undefined) {
    await db.prepare('UPDATE users SET disabled = ? WHERE id = ?').bind(b.disabled ? 1 : 0, params[0]).run();
    if (b.disabled) await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(params[0]).run();
  }
  return { ok: true };
});

route('POST', '/admin/actions/(\\d+)', async ({ req, env, now, params }) => {
  await admin(req, env, now);
  const b = await body(req), id = Number(params[0]), db = env.DB;
  const a = await db.prepare("SELECT user_id, credits, kind, symbol FROM action_requests WHERE id = ? AND status = 'pending'").bind(id).first<{ user_id: string; credits: number; kind: string; symbol: string }>();
  if (!a) fail(404, 'NOT_PENDING', '처리할 요청이 없어요.');
  if (b.status === 'done') await db.prepare("UPDATE action_requests SET status = 'done' WHERE id = ?").bind(id).run();
  else if (b.status === 'rejected') await db.batch([
    db.prepare("UPDATE action_requests SET status = 'rejected' WHERE id = ?").bind(id),
    credit(db, a!.user_id, a!.credits, 'refund', `${a!.symbol} 요청 반려로 돌려드림`, `action-refund:${id}`, now),
  ]);
  else fail(400, 'BAD_STATUS', '완료 또는 반려를 골라 주세요.');
  return { ok: true };
});

/** A sign-in link the admin hands over by hand (before mail from our own domain is set up). */
route('POST', '/admin/login-link', async ({ req, env, now }) => {
  await admin(req, env, now);
  const b = await body(req), email = normEmail(b.email), db = env.DB;
  if (!email) fail(400, 'BAD_EMAIL', '이메일 주소를 확인해 주세요.');
  const known = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  let invite: string | null = null;
  if (!known) {
    invite = str(b.invite, 40).toUpperCase();
    if (!invite || !(await inviteOk(db, invite, now))) fail(400, 'INVITE_INVALID', '처음 가입하는 사람은 쓸 수 있는 초대 코드가 필요해요.');
  }
  return { link: loginLink(env, await createLoginToken(db, email, invite, now)), expiresInMinutes: LOGIN_TTL_MIN };
});

export async function handle(req: Request, env: Env, deps: Deps): Promise<Response> {
  const cors = corsHeaders(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
  // The API's own address opened in a browser: send people to the site.
  if (path === '/' && req.method === 'GET') return Response.redirect(`${env.SITE_URL.replace(/\/$/, '')}/index.html`, 302);
  try {
    for (const [method, re, h] of routes) {
      const m = re.exec(path);
      if (m && method === req.method) return json(200, await h({ req, env, deps, now: deps.now(), params: m.slice(1) }), cors);
    }
    return json(404, { error: 'NOT_FOUND', message: '없는 주소예요.' }, cors);
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.code, message: e.message, ...e.extra }, cors);
    console.error('api error', e instanceof Error ? e.name : 'unknown');
    return json(500, { error: 'SERVER', message: '서버 오류가 났어요. 잠시 뒤 다시 해 주세요.' }, cors);
  }
}
