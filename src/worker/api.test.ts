import assert from 'node:assert/strict';
import test from 'node:test';
import { ALPHA, CREDIT_COST } from '../report/plans.js';
import { handle, type Deps, type Env } from './api.js';
import { askParams } from './ask.js';
import { testDb } from './testDb.js';

const SITE = 'https://hanul442.github.io/gnomon_analytics';

function setup(opts: { ai?: Deps['ai']; mail?: boolean } = {}) {
  const env: Env = { DB: testDb(), SITE_URL: SITE, ADMIN_EMAILS: 'boss@example.com', RESEND_API_KEY: opts.mail === false ? undefined as never : 'test', AI_DAILY_USD: '5', USER_DAILY_ASKS: '3' };
  if (opts.mail === false) delete env.RESEND_API_KEY;
  const mails: { to: string; text: string }[] = [], seen: string[] = [];
  let clock = Date.parse('2026-10-05T03:00:00Z');
  const deps: Deps = {
    now: () => new Date(clock),
    fetch: (async (url: string, init?: RequestInit) => {
      seen.push(String(url));
      if (String(url).startsWith('https://api.resend.com')) { const b = JSON.parse(String(init!.body)); mails.push({ to: b.to[0], text: b.text }); return new Response('{}', { status: 200 }); }
      if (String(url).endsWith('/s/000660.json')) return Response.json({ name: 'SK하이닉스', market: 'KOSPI', bars: [['2026-10-02', 1, 2, 1, 2, 10]] });
      return new Response('no', { status: 404 });
    }) as typeof fetch,
    ...(opts.ai ? { ai: opts.ai } : {}),
  };
  const call = async (method: string, path: string, body?: unknown, session?: string, origin = 'https://hanul442.github.io') => {
    const res = await handle(new Request(`https://api.test${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }), env, deps);
    return { status: res.status, body: await res.json() as Record<string, any>, headers: res.headers };
  };
  const login = async (email: string, invite?: string) => {
    const s = await call('POST', '/auth/start', { email, invite, terms: true });
    assert.equal(s.status, 200, JSON.stringify(s.body));
    const token = /#t=([\w-]+)/.exec(mails.at(-1)!.text)![1];
    const v = await call('POST', '/auth/verify', { token });
    assert.equal(v.status, 200, JSON.stringify(v.body));
    return { session: v.body.session as string, token: token!, me: v.body };
  };
  return { env, deps, call, login, mails, seen, tick: (ms: number) => { clock += ms; } };
}

test('sign-in needs an invite the first time; the admin needs none; links work once', async () => {
  const t = setup();
  assert.equal((await t.call('POST', '/auth/start', { email: 'a@example.com' })).body.error, 'INVITE_REQUIRED');
  assert.equal((await t.call('POST', '/auth/start', { email: 'a@example.com', invite: 'NOPE' })).body.error, 'INVITE_INVALID');
  const boss = await t.login('boss@example.com');
  assert.equal(boss.me.user.admin, true);
  const inv = await t.call('POST', '/admin/invites', { maxUses: 1, credits: 50, note: '지인' }, boss.session);
  assert.match(inv.body.code, /^GNM-[A-Z2-9]{6}$/);
  assert.equal((await t.call('POST', '/auth/start', { email: 'a@example.com', invite: inv.body.code })).body.error, 'TERMS_REQUIRED');
  const a = await t.login('A@Example.com ', inv.body.code.toLowerCase());
  assert.equal(a.me.user.plan, 'alpha');
  assert.equal(a.me.user.admin, false);
  assert.equal(a.me.credits.balance, ALPHA.monthlyCredits + 50);
  assert.ok(t.mails.at(-1)!.text.includes(`${SITE}/login.html#t=`));
  // The link is single-use, and the invite is used up.
  assert.equal((await t.call('POST', '/auth/verify', { token: a.token })).body.error, 'LINK_INVALID');
  assert.equal((await t.call('POST', '/auth/start', { email: 'b@example.com', invite: inv.body.code, terms: true })).body.error, 'INVITE_INVALID');
  // A known user signs in again without a code; no second allowance this month.
  const again = await t.login('a@example.com');
  assert.equal(again.me.credits.balance, ALPHA.monthlyCredits + 50);
  // Next month the allowance comes once more.
  t.tick(27 * 86_400_000);
  assert.equal((await t.call('GET', '/me', undefined, again.session)).body.credits.balance, 2 * ALPHA.monthlyCredits + 50);
  // Admin pages are the admin's.
  assert.equal((await t.call('GET', '/admin/overview', undefined, a.session)).status, 403);
  assert.equal((await t.call('GET', '/me')).status, 401);
});

test('without mail set up, the admin can hand out a sign-in link', async () => {
  const t = setup({ mail: false });
  assert.equal((await t.call('POST', '/auth/start', { email: 'boss@example.com' })).body.error, 'MAIL_UNAVAILABLE');
  // Bootstrap the admin through the same token path the mail would carry.
  const t2 = setup();
  const boss = await t2.login('boss@example.com');
  const inv = await t2.call('POST', '/admin/invites', { code: 'FRIENDS-1', maxUses: 3 }, boss.session);
  assert.equal(inv.body.code, 'FRIENDS-1');
  assert.equal((await t2.call('POST', '/admin/login-link', { email: 'c@example.com' }, boss.session)).body.error, 'INVITE_INVALID');
  const link = await t2.call('POST', '/admin/login-link', { email: 'c@example.com', invite: 'FRIENDS-1' }, boss.session);
  const v = await t2.call('POST', '/auth/verify', { token: /#t=([\w-]+)/.exec(link.body.link)![1] });
  assert.equal(v.body.user.email, 'c@example.com');
});

test('credit requests are approved by hand and land in the ledger once', async () => {
  const t = setup();
  const boss = await t.login('boss@example.com');
  const code = (await t.call('POST', '/admin/invites', {}, boss.session)).body.code;
  const u = await t.login('u@example.com', code);
  assert.equal((await t.call('POST', '/credits/request', { amount: 5000, reason: '많이' }, u.session)).body.error, 'BAD_AMOUNT');
  assert.equal((await t.call('POST', '/credits/request', { amount: 300, reason: '리포트 비교해 보려고요' }, u.session)).status, 200);
  assert.equal((await t.call('POST', '/credits/request', { amount: 100, reason: '하나 더 요청' }, u.session)).body.error, 'PENDING_EXISTS');
  const ov = await t.call('GET', '/admin/overview', undefined, boss.session);
  const req = ov.body.creditRequests[0];
  assert.deepEqual([req.email, req.status, req.amount], ['u@example.com', 'pending', 300]);
  assert.equal((await t.call('POST', `/admin/credit-requests/${req.id}`, { decision: 'approve', amount: 200, note: '알파 감사' }, boss.session)).status, 200);
  assert.equal((await t.call('POST', `/admin/credit-requests/${req.id}`, { decision: 'approve' }, boss.session)).body.error, 'NOT_PENDING');
  const me = await t.call('GET', '/me', undefined, u.session);
  assert.equal(me.body.credits.balance, ALPHA.monthlyCredits + 200);
  assert.deepEqual([me.body.requests[0].status, me.body.requests[0].granted], ['approved', 200]);
});

test('a question charges its tier, a failure is refunded, and limits hold', async () => {
  const calls: Record<string, any>[] = [];
  let failNext = false;
  const t = setup({ ai: { create: async (p) => { calls.push(p); if (failNext) { failNext = false; throw new Error('overloaded'); } return { content: [{ type: 'text', text: '근거로 보면 이래요.' }], model: String(p.model), stop_reason: 'end_turn', usage: { input_tokens: 2000, output_tokens: 300 } }; } } });
  const boss = await t.login('boss@example.com');
  const u = await t.login('q@example.com', (await t.call('POST', '/admin/invites', {}, boss.session)).body.code);
  const r = await t.call('POST', '/ask', { tier: 'deep', question: 'SK하이닉스 왜 올랐나요?', symbol: '000660', page: '화면 글' }, u.session);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.model, r.body.credits, r.body.balance], ['claude-opus-5-5', CREDIT_COST.deep, ALPHA.monthlyCredits - CREDIT_COST.deep]);
  assert.match(JSON.stringify(calls[0]!.messages), /SK하이닉스.*KOSPI/);
  assert.deepEqual(calls[0]!.thinking, { type: 'adaptive' });
  failNext = true;
  const f = await t.call('POST', '/ask', { tier: 'question', question: '다시 질문' }, u.session);
  assert.equal(f.body.error, 'AI_FAILED');
  assert.equal((await t.call('GET', '/me', undefined, u.session)).body.credits.balance, ALPHA.monthlyCredits - CREDIT_COST.deep);
  assert.equal((await t.call('POST', `/ask/${r.body.id}/rate`, { rating: 1 }, u.session)).status, 200);
  await t.call('POST', '/ask', { tier: 'question', question: '두 번째' }, u.session);
  await t.call('POST', '/ask', { tier: 'standard', question: '세 번째' }, u.session);
  assert.equal((await t.call('POST', '/ask', { tier: 'question', question: '네 번째' }, u.session)).body.error, 'DAILY_LIMIT');
  // Spending past the balance is refused before any model call.
  await t.call('POST', '/admin/grant', { userId: (await t.call('GET', '/admin/overview', undefined, boss.session)).body.users.find((x: any) => x.email === 'q@example.com').id, amount: -(ALPHA.monthlyCredits - 30) }, boss.session);
  t.tick(86_400_000);
  const n = calls.length;
  const broke = await t.call('POST', '/ask', { tier: 'deep', question: '돈 없음' }, u.session);
  assert.deepEqual([broke.status, broke.body.error, broke.body.cost], [402, 'NO_CREDITS', CREDIT_COST.deep]);
  assert.equal(calls.length, n);
});

test('report requests spend credits and a rejected one is refunded', async () => {
  const t = setup();
  const boss = await t.login('boss@example.com');
  const u = await t.login('r@example.com', (await t.call('POST', '/admin/invites', {}, boss.session)).body.code);
  const r = await t.call('POST', '/actions', { kind: 'report', symbol: '005930' }, u.session);
  assert.equal(r.body.balance, ALPHA.monthlyCredits - CREDIT_COST.report);
  assert.equal((await t.call('POST', '/actions', { kind: 'report', symbol: '005930' }, u.session)).body.error, 'DUPLICATE');
  const id = (await t.call('GET', '/admin/overview', undefined, boss.session)).body.actions[0].id;
  await t.call('POST', `/admin/actions/${id}`, { status: 'rejected' }, boss.session);
  assert.equal((await t.call('GET', '/me', undefined, u.session)).body.credits.balance, ALPHA.monthlyCredits);
});

test('surveys, feedback and events are stored; export and delete cover everything', async () => {
  const t = setup();
  const boss = await t.login('boss@example.com');
  const u = await t.login('s@example.com', (await t.call('POST', '/admin/invites', {}, boss.session)).body.code);
  assert.equal((await t.call('GET', '/me', undefined, u.session)).body.survey.onboarding, null);
  await t.call('POST', '/survey', { kind: 'onboarding', answers: { level: 'mid', sectors: ['semis'] } }, u.session);
  assert.deepEqual((await t.call('GET', '/me', undefined, u.session)).body.survey.onboarding.sectors, ['semis']);
  assert.equal((await t.call('POST', '/feedback', { page: '/r/000660', target: 'tab:ai', rating: 1 }, u.session)).status, 200);
  assert.equal((await t.call('POST', '/events', { events: [{ name: 'tab_open', page: '/', props: { tab: 'chart' } }, { name: 'BAD NAME' }] }, u.session)).body.saved, 1);
  const ov = await t.call('GET', '/admin/overview', undefined, boss.session);
  assert.deepEqual([ov.body.feedback.length, ov.body.events[0].name], [1, 'tab_open']);
  const ex = await t.call('GET', '/me/export', undefined, u.session);
  assert.deepEqual([ex.body.surveys.length, ex.body.events.length, ex.body.ledger.length], [1, 1, 1]);
  assert.equal((await t.call('POST', '/me/delete', { confirm: 'no' }, u.session)).body.error, 'CONFIRM');
  assert.equal((await t.call('POST', '/me/delete', { confirm: '삭제' }, u.session)).status, 200);
  assert.equal((await t.call('GET', '/me', undefined, u.session)).status, 401);
  assert.equal((await t.call('GET', '/admin/overview', undefined, boss.session)).body.users.length, 1);
});

test('CORS answers the site only; the quick tier skips thinking', async () => {
  const t = setup();
  assert.equal((await t.call('GET', '/health')).headers.get('Access-Control-Allow-Origin'), 'https://hanul442.github.io');
  assert.equal((await t.call('GET', '/health', undefined, undefined, 'https://evil.example')).headers.get('Access-Control-Allow-Origin'), null);
  const root = await handle(new Request('https://api.test/'), t.env, t.deps);
  assert.deepEqual([root.status, root.headers.get('Location')], [302, `${SITE}/index.html`]);
  const p = askParams({ tier: 'question', question: 'q' });
  assert.deepEqual([p.model, 'thinking' in p], ['claude-haiku-4-5', false]);
});

test('saved screens alert once per data date, only on newly matching stocks', async () => {
  const t = setup();
  const boss = await t.login('boss@example.com');
  const u = await t.login('w@example.com', (await t.call('POST', '/admin/invites', {}, boss.session)).body.code);
  const screen = { match: 'all', rules: [{ f: 'vol1', op: '>=', v: 3 }] };
  assert.equal((await t.call('POST', '/screens', { name: '급증', screen: { rules: [{ f: 'bad', op: '>=', v: 1 }] } }, u.session)).body.error, 'BAD_SCREEN');
  assert.equal((await t.call('POST', '/screens', { name: '급증', screen }, u.session)).status, 200);
  const id = (await t.call('GET', '/screens', undefined, u.session)).body.screens[0].id;
  assert.equal((await t.call('POST', `/screens/${id}`, { alert: true }, u.session)).status, 200);
  // [code, name, …, vol1 at 14]
  const mk = (code: string, vol1: number) => { const r: unknown[] = Array(23).fill(null); r[0] = code; r[1] = `종목${code}`; r[14] = vol1; r[21] = 0; return r; };
  let feed = { date: '2026-10-05', rows: [mk('000001', 4), mk('000002', 1)] };
  const real = t.deps.fetch;
  t.deps.fetch = (async (url: string, init?: RequestInit) => (String(url).endsWith('/screener.json') ? Response.json(feed) : real(url, init))) as typeof fetch;
  const { runAlerts } = await import('./api.js');
  // First run: today's matches become the baseline, no message.
  assert.deepEqual(await runAlerts(t.env, t.deps), { date: '2026-10-05', screens: 1, sent: 0 });
  // Same data date again: nothing to do.
  assert.equal((await runAlerts(t.env, t.deps)).screens, 0);
  feed = { date: '2026-10-06', rows: [mk('000001', 5), mk('000002', 3.5), mk('000003', 9)] };
  assert.equal((await runAlerts(t.env, t.deps)).sent, 1);
  const n = await t.call('GET', '/notifications', undefined, u.session);
  assert.equal(n.body.unread, 1);
  assert.match(n.body.items[0].title, /새로 걸린 종목 2개/);
  assert.match(n.body.items[0].body, /종목000002, 종목000003/);
  assert.ok(t.mails.some((m) => m.to === 'w@example.com'));
  await t.call('POST', '/notifications/read', {}, u.session);
  assert.equal((await t.call('GET', '/notifications', undefined, u.session)).body.unread, 0);
});

test('intraday: Pro-level watchers hear once when volume runs ahead of its usual pace', async () => {
  const t = setup();
  const boss = await t.login('boss@example.com');
  const u = await t.login('i@example.com', (await t.call('POST', '/admin/invites', {}, boss.session)).body.code);
  // Coins are kept on the list but not scanned (they are not on Naver's minute feed).
  assert.deepEqual((await t.call('POST', '/watch', { symbols: ['000660', 'KRW-BTC', 'bad', '000660'] }, u.session)).body.count, 2);
  assert.deepEqual((await t.call('GET', '/watch', undefined, u.session)).body.symbols, ['000660', 'KRW-BTC']);
  // Minute feed: two earlier sessions with 1,000 shares by 10:00; today 5,000 by 10:00 and +6%.
  const item = (d: string, hm: string, close: number, cum: number) => `<item data="${d}${hm}|null|null|null|${close}|${cum}"/>`;
  const feed = `<chartdata>${item('20261001', '1000', 100, 1000)}${item('20261001', '1530', 100, 3000)}${item('20261002', '1000', 100, 1000)}${item('20261002', '1530', 100, 3000)}${item('20261005', '0930', 103, 2000)}${item('20261005', '1000', 106, 5000)}</chartdata>`;
  const real = t.deps.fetch;
  t.deps.fetch = (async (url: string, init?: RequestInit) => {
    if (String(url).includes('fchart.stock.naver.com')) return new Response(feed);
    if (String(url).endsWith('/search.json')) return Response.json({ items: [['000660', 'SK하이닉스']] });
    return real(url, init);
  }) as typeof fetch;
  const { runIntraday } = await import('./api.js');
  t.tick(Date.parse('2026-10-05T01:05:00Z') - t.deps.now().getTime()); // 10:05 KST, Monday
  assert.deepEqual(await runIntraday(t.env, t.deps), { symbols: 1, alerts: 2 });
  assert.deepEqual(await runIntraday(t.env, t.deps), { symbols: 1, alerts: 0 });
  const n = (await t.call('GET', '/notifications', undefined, u.session)).body.items.map((x: any) => x.title);
  assert.ok(n.some((x: string) => /SK하이닉스 거래량이 평소 이 시간의 5\.0배/.test(x)) && n.some((x: string) => /\+6\.0% 올랐어요/.test(x)), JSON.stringify(n));
  // Outside the session nothing runs.
  t.tick(10 * 3600_000);
  assert.deepEqual(await runIntraday(t.env, t.deps), { symbols: 0, alerts: 0 });
});

test('passwords (G-57): sign up once with an invite, then email + password; lockout; set and change', async () => {
  const t = setup();
  const boss = await t.login('boss@example.com');
  const code = (await t.call('POST', '/admin/invites', { credits: 50 }, boss.session)).body.code;
  // Sign-up needs a sound password, the terms and a live invite.
  assert.equal((await t.call('POST', '/auth/signup', { email: 'p@example.com', password: 'short', invite: code, terms: true })).body.error, 'BAD_PASSWORD');
  assert.equal((await t.call('POST', '/auth/signup', { email: 'p@example.com', password: 'abcdefgh', invite: code, terms: true })).body.error, 'BAD_PASSWORD');
  assert.equal((await t.call('POST', '/auth/signup', { email: 'p@example.com', password: 'abcd1234', terms: true })).body.error, 'INVITE_REQUIRED');
  assert.equal((await t.call('POST', '/auth/signup', { email: 'p@example.com', password: 'abcd1234', invite: code })).body.error, 'TERMS_REQUIRED');
  const up = await t.call('POST', '/auth/signup', { email: 'P@example.com', password: 'abcd1234', invite: code.toLowerCase(), terms: true });
  assert.ok(up.body.session && up.body.user.hasPassword && up.body.credits.balance >= 50, JSON.stringify(up.body));
  // The invite is used up, and the same email cannot sign up again.
  assert.equal((await t.call('POST', '/auth/signup', { email: 'q@example.com', password: 'abcd1234', invite: code, terms: true })).body.error, 'INVITE_INVALID');
  assert.equal((await t.call('POST', '/auth/signup', { email: 'p@example.com', password: 'abcd1234', invite: code, terms: true })).body.error, 'ALREADY_JOINED');
  // Login: right password works; a wrong one fails the same way as an unknown email.
  const ok = await t.call('POST', '/auth/login', { email: 'p@example.com', password: 'abcd1234' });
  assert.ok(ok.body.session && ok.body.user.email === 'p@example.com');
  assert.equal((await t.call('GET', '/me', undefined, ok.body.session)).body.user.email, 'p@example.com');
  const bad = await t.call('POST', '/auth/login', { email: 'p@example.com', password: 'wrong1234' });
  assert.deepEqual([bad.status, bad.body.error], [401, 'LOGIN_FAILED']);
  assert.equal((await t.call('POST', '/auth/login', { email: 'nobody@example.com', password: 'abcd1234' })).body.error, 'LOGIN_FAILED');
  // Eight failures in 15 minutes lock the email, even for the right password; it opens again later.
  for (let i = 0; i < 7; i++) await t.call('POST', '/auth/login', { email: 'p@example.com', password: 'nope12345' });
  assert.equal((await t.call('POST', '/auth/login', { email: 'p@example.com', password: 'abcd1234' })).body.error, 'TOO_MANY');
  t.tick(16 * 60_000);
  assert.ok((await t.call('POST', '/auth/login', { email: 'p@example.com', password: 'abcd1234' })).body.session);
  // A magic-link account has no password until it sets one; changing one needs the current password.
  const link = await t.login('l@example.com', (await t.call('POST', '/admin/invites', {}, boss.session)).body.code);
  assert.equal((await t.call('GET', '/me', undefined, link.session)).body.user.hasPassword, false);
  assert.equal((await t.call('POST', '/auth/login', { email: 'l@example.com', password: 'abcd1234' })).body.error, 'LOGIN_FAILED');
  assert.equal((await t.call('POST', '/me/password', { password: 'first1234' }, link.session)).body.ok, true);
  assert.equal((await t.call('POST', '/me/password', { password: 'second1234' }, link.session)).body.error, 'BAD_CURRENT');
  assert.equal((await t.call('POST', '/me/password', { password: 'second1234', current: 'first1234' }, link.session)).body.ok, true);
  assert.ok((await t.call('POST', '/auth/login', { email: 'l@example.com', password: 'second1234' })).body.session);
});

test('deep reports (G-61): locked until unlocked once with credits; requester and admin open free; nothing charged for a missing report', async () => {
  const t = setup();
  t.env.DEEP_KEY = 'deep-secret';
  const { seal } = await import('../report/seal.js');
  const sealed = await seal('<div class="deep-body">위원회 토론 본문</div>', 'deep-secret');
  const real = t.deps.fetch;
  t.deps.fetch = (async (url: string, init?: RequestInit) => (String(url).endsWith('/000660/deep/2026-10-02.txt') ? new Response(sealed) : real(url, init))) as typeof fetch;
  const boss = await t.login('boss@example.com');
  const u = await t.login('d@example.com', (await t.call('POST', '/admin/invites', {}, boss.session)).body.code);
  const path = '/deep/000660/2026-10-02';
  const locked = await t.call('GET', path, undefined, u.session);
  assert.deepEqual([locked.status, locked.body.error, locked.body.cost, locked.body.balance], [402, 'LOCKED', CREDIT_COST.unlock, ALPHA.monthlyCredits]);
  // A report with no sealed file costs nothing.
  const missing = await t.call('POST', '/deep/005930/2026-10-02/unlock', {}, u.session);
  assert.deepEqual([missing.status, missing.body.error], [404, 'NOT_SEALED']);
  const open = await t.call('POST', `${path}/unlock`, {}, u.session);
  assert.deepEqual([open.status, open.body.charged, open.body.balance], [200, CREDIT_COST.unlock, ALPHA.monthlyCredits - CREDIT_COST.unlock]);
  assert.match(open.body.html, /위원회 토론 본문/);
  // Opening again (or unlocking twice) is free.
  assert.match((await t.call('GET', path, undefined, u.session)).body.html, /위원회 토론 본문/);
  assert.equal((await t.call('POST', `${path}/unlock`, {}, u.session)).body.charged, 0);
  assert.equal((await t.call('GET', '/me', undefined, u.session)).body.credits.balance, ALPHA.monthlyCredits - CREDIT_COST.unlock);
  // The admin reads free; a bad address is refused; not logged in is refused.
  assert.match((await t.call('GET', path, undefined, boss.session)).body.html, /위원회 토론 본문/);
  assert.equal((await t.call('GET', '/deep/../2026-10-02', undefined, u.session)).status >= 400, true);
  assert.equal((await t.call('GET', path)).status, 401);
  // Out of credits: refused with the balance.
  const poor = await t.login('p@example.com', (await t.call('POST', '/admin/invites', {}, boss.session)).body.code);
  const pid = (await t.call('GET', '/admin/overview', undefined, boss.session)).body.users.find((x: any) => x.email === 'p@example.com').id;
  await t.call('POST', '/admin/grant', { userId: pid, amount: -(ALPHA.monthlyCredits - 3) }, boss.session);
  const broke = await t.call('POST', `${path}/unlock`, {}, poor.session);
  assert.deepEqual([broke.status, broke.body.error, broke.body.balance], [402, 'NO_CREDITS', 3]);
});
