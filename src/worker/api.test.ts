import assert from 'node:assert/strict';
import test from 'node:test';
import { ALPHA, CREDIT_COST, UNLOCK } from '../report/plans.js';
import { handle, type Deps, type Env } from './api.js';
import { askParams } from './ask.js';
import { testDb } from './testDb.js';

const SITE = 'https://hanul442.github.io/gnomon_analytics';

/** Uses up a user's free opens this month (G-126) so a test can check the paid path. */
async function spendFreeOpens(t: { env: Env }, email: string): Promise<void> {
  const id = (await t.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>())!.id;
  for (let i = 0; i < 10; i++) await t.env.DB.prepare("INSERT OR IGNORE INTO unlocks (user_id, symbol, date, credits, created_at) VALUES (?, 'USED', ?, 0, '2026-10-05T00:00:00Z')").bind(id, 'used-' + i).run();
}

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
      if (String(url).startsWith('https://polling.finance.naver.com/api/realtime/worldstock/')) return Response.json({ datas: [{ reutersCode: String(url).split('/').pop(), closePrice: '336.67', compareToPreviousClosePrice: '3.04', fluctuationsRatio: '0.91', marketStatus: 'OPEN', localTradedAt: '2026-10-08T10:00:00-04:00' }] });
      if (String(url).startsWith('https://www.okx.com/')) return Response.json(String(url).includes('XYZ') ? { code: '51001', data: [] } : String(url).includes('funding-rate') ? { code: '0', data: [{ fundingRate: '0.0001', fundingTime: '1791475200000' }] } : String(url).includes('/public/open-interest') ? { code: '0', data: [{ oiUsd: '2500000000' }] } : { code: '0', data: [] });
      if (String(url).startsWith('https://polling.finance.naver.com/')) return Response.json({ datas: [{ itemCode: '000660', closePrice: '1,860,000', compareToPreviousClosePrice: '18,000', fluctuationsRatio: '0.98', compareToPreviousPrice: { code: '2', name: 'RISING' }, marketStatus: 'OPEN', localTradedAt: '2026-10-05T12:00:00+09:00' }] });
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
  await t.call('POST', '/ask', { tier: 'standard', source: 'debate', expert: 'committee', question: '세 번째', symbol: '000660' }, u.session);
  // G-116: debate questions are kept with the account, per stock; chat ones are listed apart; others' never.
  const debate = (await t.call('GET', '/questions/mine?source=debate&symbol=000660', undefined, u.session)).body.items;
  assert.deepEqual(debate.map((x: any) => [x.question, x.source, x.speaker, x.answer]), [['세 번째', 'debate', 'AI 위원회', '근거로 보면 이래요.']]);
  assert.deepEqual((await t.call('GET', '/questions/mine?source=chat', undefined, u.session)).body.items.map((x: any) => x.question), ['두 번째', 'SK하이닉스 왜 올랐나요?']);
  assert.deepEqual((await t.call('GET', '/questions/mine', undefined, boss.session)).body.items, []);
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
  // G-109: settings follow the account; unknown keys and non-strings are dropped.
  assert.deepEqual((await t.call('GET', '/me/settings', undefined, u.session)).body, { data: {}, updatedAt: null });
  const saved = await t.call('POST', '/me/settings', { data: { 'gnm-persona': 'trader', 'gnm-ind': '["rsi"]', 'gnm-draw:005930': '[]', 'gnm-session': 'secret', 'gnm-prefs': 5, other: 'x' } }, u.session);
  assert.equal(saved.body.count, 3);
  const got = await t.call('GET', '/me/settings', undefined, u.session);
  assert.deepEqual(got.body.data, { 'gnm-persona': 'trader', 'gnm-ind': '["rsi"]', 'gnm-draw:005930': '[]' });
  assert.ok(got.body.updatedAt);
  assert.equal((await t.call('POST', '/me/settings', { data: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`gnm-draw:00000${i % 10}${i >= 10 ? 'A' : ''}`, 'x'.repeat(19_000)])) }, u.session)).status, 413);
  assert.equal((await t.call('GET', '/me/settings')).status, 401);
  const ex = await t.call('GET', '/me/export', undefined, u.session);
  assert.deepEqual([ex.body.surveys.length, ex.body.events.length, ex.body.ledger.length, ex.body.settings.length], [1, 1, 1, 1]);
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
  await t.env.DB.prepare("INSERT INTO notifications (user_id, kind, title, body, link, created_at) VALUES (?, 'daily', '두 번째', '', '', '2026-10-06T00:00:00Z')").bind((await t.env.DB.prepare('SELECT user_id FROM notifications LIMIT 1').first<{ user_id: string }>())!.user_id).run();
  const two = (await t.call('GET', '/notifications', undefined, u.session)).body.items;
  assert.equal(two.length, 2);
  await t.call('POST', '/notifications/clear', { id: two[0].id }, u.session);
  assert.deepEqual((await t.call('GET', '/notifications', undefined, u.session)).body.items.map((x: any) => x.id), [two[1].id], 'one cleared');
  await t.call('POST', '/notifications/clear', {}, u.session);
  assert.equal((await t.call('GET', '/notifications', undefined, u.session)).body.items.length, 0, 'all cleared');
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

test('market reports enforce paid plans even with credits; Plus unlocks once and market questions retain dated context',async()=>{
 let input:Record<string,unknown>|undefined;
 const t=setup({ai:{create:async p=>{input=p;return {model:'claude-sonnet-5-5',stop_reason:'end_turn',usage:{input_tokens:10,output_tokens:10},content:[{type:'text',text:'근거와 반론'}]};}}});
 t.env.DEEP_KEY='market-secret';
 const {seal}=await import('../report/seal.js');const sealed=await seal('<div>시장 상세 근거</div>','market-secret');const real=t.deps.fetch;
 t.deps.fetch=(async(url:string,init?:RequestInit)=>String(url).endsWith('/MARKET-DAILY/deep/2026-10-07.txt')?new Response(sealed):String(url).endsWith('/market/daily-2026-10-07.json')?Response.json({date:'2026-10-07',ai:{summary:{text:'당일 요약'}}}):real(url,init)) as typeof fetch;
 const boss=await t.login('boss@example.com');const u=await t.login('market@example.com',(await t.call('POST','/admin/invites',{},boss.session)).body.code);
 const path='/deep/MARKET-DAILY/2026-10-07';
 await t.env.DB.prepare("UPDATE users SET plan='free' WHERE email='market@example.com'").run();
 assert.equal((await t.call('GET',path,undefined,u.session)).body.error,'PLAN_REQUIRED');
 assert.equal((await t.call('POST',path+'/unlock',{},u.session)).body.error,'PLAN_REQUIRED');
 assert.equal((await t.call('GET','/me',undefined,u.session)).body.credits.balance,ALPHA.monthlyCredits);
 await t.env.DB.prepare("UPDATE users SET plan='plus' WHERE email='market@example.com'").run();await spendFreeOpens(t,'market@example.com');
 assert.equal((await t.call('GET',path,undefined,u.session)).body.error,'LOCKED');
 assert.equal((await t.call('POST',path+'/unlock',{},u.session)).body.charged,CREDIT_COST.unlock);
 assert.match((await t.call('GET',path,undefined,u.session)).body.html,/시장 상세 근거/);
 const answer=await t.call('POST','/ask',{tier:'standard',source:'debate',expert:'committee',symbol:'MARKET-DAILY',reportDate:'2026-10-07',question:'약세 반론은?',page:'시장 담당자의 반론'},u.session);
 assert.equal(answer.status,200);assert.ok(JSON.stringify(input).includes('당일 요약'));
 const history=await t.call('GET','/questions/mine?source=debate&symbol=MARKET-DAILY',undefined,u.session);assert.equal(history.body.items[0].symbol,'MARKET-DAILY');
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
  // Alpha testers unlock with credits like everyone else; pro and max read without unlocking.
  assert.equal((await t.call('GET',path,undefined,u.session)).body.locked,true);
  await t.env.DB.prepare("UPDATE users SET plan='pro' WHERE email='d@example.com'").run();
  assert.equal((await t.call('GET',path,undefined,u.session)).status,200);
  // An admin looking as a plan (X-View-As) gets that plan's gate.
  const asPlus = await handle(new Request('https://api.test'+path,{headers:{Origin:'https://hanul442.github.io',Authorization:`Bearer ${boss.session}`,'X-View-As':'plus'}}),t.env,t.deps);
  assert.equal(((await asPlus.json()) as {locked?:boolean}).locked,true);
  await t.env.DB.prepare("UPDATE users SET plan='plus' WHERE email='d@example.com'").run();
  await spendFreeOpens(t, 'd@example.com');
  const locked = await t.call('GET', path, undefined, u.session);
  assert.deepEqual([locked.status, locked.body.error, locked.body.cost, locked.body.balance], [200, 'LOCKED', CREDIT_COST.unlock, ALPHA.monthlyCredits]);
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
  await t.env.DB.prepare("UPDATE users SET plan='plus' WHERE id=?").bind(pid).run();
  await spendFreeOpens(t, 'p@example.com');
  const broke = await t.call('POST', `${path}/unlock`, {}, poor.session);
  assert.deepEqual([broke.status, broke.body.error, broke.body.balance], [402, 'NO_CREDITS', 3]);
});

test('a credit event is claimed once per account, only while it runs (G-73)', async () => {
  const t = setup();
  const boss = await t.login('boss@example.com');
  const code = (await t.call('POST', '/admin/invites', {}, boss.session)).body.code;
  const u = await t.login('ev@example.com', code);
  // 2026-10-05: not started yet.
  assert.equal((await t.call('POST', '/events/claim', { id: 'alpha-thanks-2026-10' }, u.session)).body.error, 'NO_EVENT');
  t.tick(24 * 3600_000);
  const first = await t.call('POST', '/events/claim', { id: 'alpha-thanks-2026-10' }, u.session);
  assert.equal(first.status, 200);
  assert.ok(first.body.credits === 50 && first.body.balance >= 50);
  assert.equal((await t.call('POST', '/events/claim', { id: 'alpha-thanks-2026-10' }, u.session)).body.error, 'ALREADY');
});

test('live quotes come through the API, cached for a few seconds (G-62)', async () => {
  const t = setup();
  assert.equal((await t.call('GET', '/quote?s=abc')).body.error, 'NO_CODES');
  const a = await t.call('GET', '/quote?s=000660');
  assert.deepEqual([a.status, a.body.quotes[0].price, a.body.quotes[0].changePct, a.body.quotes[0].open], [200, 1860000, 0.98, true]);
  const calls = t.seen.filter((u) => u.includes('polling.finance')).length;
  assert.equal((await t.call('GET', '/quote?s=000660')).body.cached, true);
  assert.equal(t.seen.filter((u) => u.includes('polling.finance')).length, calls);
});

test('US quotes (u=) and coin derivatives come through the API, cached (G-142, G-143)', async () => {
  const t = setup();
  const a = await t.call('GET', '/quote?u=AAPL.O,TSM,005930');
  assert.equal(a.status, 200);
  assert.deepEqual(a.body.quotes.map((q: { symbol: string }) => q.symbol).sort(), ['AAPL.O', 'TSM']);
  assert.equal(a.body.quotes[0].session, 'regular');
  assert.equal((await t.call('GET', '/quote?u=AAPL.O,TSM')).body.cached, true);
  const d = await t.call('GET', '/deriv?ccy=KRW-BTC');
  assert.equal(d.status, 200);
  assert.equal(d.body.deriv.instId, 'BTC-USDT-SWAP');
  assert.equal(d.body.deriv.oi.usd, 2.5e9);
  assert.equal((await t.call('GET', '/deriv?ccy=BTC')).body.cached, true);
  assert.equal((await t.call('GET', '/deriv?ccy=XYZ')).status, 404);
  assert.equal((await t.call('GET', '/deriv?ccy=../x')).status, 400);
});

test('an invited expert answers in the debate at the invite price (G-80)', async () => {
  const calls: Record<string, any>[] = [];
  const t = setup({ ai: { create: async (p) => { calls.push(p); return { content: [{ type: 'text', text: '**의견** 메모리 가격이 관건이에요.' }], model: String(p.model), stop_reason: 'end_turn', usage: { input_tokens: 1500, output_tokens: 200 } }; } } });
  const boss = await t.login('boss@example.com');
  const u = await t.login('x@example.com', (await t.call('POST', '/admin/invites', {}, boss.session)).body.code);
  assert.equal((await t.call('POST', '/ask', { tier: 'standard', expert: 'nobody', question: '어때요?' }, u.session)).body.error, 'BAD_EXPERT');
  const r = await t.call('POST', '/ask', { tier: 'standard', expert: 'semis', question: '업황은 어때요?', symbol: '000660', page: '이 종목 AI 위원회 토론:\n기술 데스크: 강세예요' }, u.session);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.credits, r.body.speaker], [CREDIT_COST.invite, '반도체 전문가']);
  assert.match(String(calls[0]!.system), /반도체 전문가/);
  const c = await t.call('POST', '/ask', { tier: 'standard', expert: 'committee', question: '결론만 다시요' }, u.session);
  assert.deepEqual([c.body.credits, c.body.speaker], [CREDIT_COST.standard, 'AI 위원회']);
});

// Alpha v2: generation must be durable, charge once, and never expose another user's paid text.
async function reportSetup() {
  const t=setup();
  const { buildDailyReport }=await import('../report/dailyReport.js');
  const { skippedCommentary }=await import('../analysis/commentary.js');
  const bars=Array.from({length:30},(_,i)=>({symbol:'000660',date:new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10),open:100+i,high:105+i,low:95+i,close:102+i,volume:1000,source:'test',retrievedAt:'2026-10-05T00:00:00Z'}));
  const report=buildDailyReport({symbol:'000660',name:'테스트',date:bars.at(-1)!.date,generatedAt:t.deps.now!(),bars,disclosures:[],sources:['test']});
  const real=t.deps.fetch!;
  t.deps.fetch=(async (url: RequestInfo|URL, init?:RequestInit)=>String(url).endsWith('/research/000660.json')?Response.json(report):real(url,init)) as typeof fetch;
  const queued:string[]=[];
  t.env.REPORT_QUEUE={send:async({id})=>{queued.push(id);}};
  t.deps.generate=async()=>({...skippedCommentary(report,'test',new Date()),status:'OK',summary:{text:'비공개 분석 본문',evidenceIds:[],kind:'INFERENCE'},desks:[{desk:'TECHNICAL',stance:'BULLISH',view:{text:'기술 의견',evidenceIds:[],kind:'INFERENCE'}}],tier:'deep'} as any);
  const boss=await t.login('boss@example.com');
  const user=await t.login('jobs@example.com',(await t.call('POST','/admin/invites',{},boss.session)).body.code);
  return {...t,queued,boss,user,report};
}

test('opening reports (G-126): monthly free opens per plan, free after a week, then credits', async () => {
  const t = setup();
  t.env.DEEP_KEY = 'deep-secret';
  const { seal } = await import('../report/seal.js');
  const sealed = await seal('<div class="deep-body">본문</div>', 'deep-secret');
  const real = t.deps.fetch;
  t.deps.fetch = (async (url: string, init?: RequestInit) => (/\/deep\/\d{4}-\d{2}-\d{2}\.txt$/.test(String(url)) ? new Response(sealed) : real(url, init))) as typeof fetch;
  const boss = await t.login('boss@example.com');
  const u = await t.login('f@example.com', (await t.call('POST', '/admin/invites', {}, boss.session)).body.code);
  await t.env.DB.prepare("UPDATE users SET plan='plus' WHERE email='f@example.com'").run();
  const start = (await t.call('GET', '/me', undefined, u.session)).body.credits.balance;
  assert.equal((await t.call('GET', '/deep/000660/2026-10-02', undefined, u.session)).body.freeLeft, UNLOCK.monthlyFree.plus);
  const codes = ['000660', '005930', '000270', '005380', '035420', '035720'];
  for (let i = 0; i < UNLOCK.monthlyFree.plus!; i++) {
    const r = await t.call('POST', `/deep/${codes[i]}/2026-10-02/unlock`, {}, u.session);
    assert.deepEqual([r.body.charged, r.body.free, r.body.freeLeft], [0, true, UNLOCK.monthlyFree.plus! - i - 1]);
  }
  const paid = await t.call('POST', `/deep/${codes[5]}/2026-10-02/unlock`, {}, u.session);
  assert.deepEqual([paid.body.charged, paid.body.balance], [CREDIT_COST.unlock, start - CREDIT_COST.unlock]);
  // A report more than a week old opens without unlocking.
  assert.match((await t.call('GET', '/deep/051910/2026-09-20', undefined, u.session)).body.html, /본문/);
  // Alpha gets ten.
  await t.env.DB.prepare("UPDATE users SET plan='alpha' WHERE email='f@example.com'").run();
  assert.equal((await t.call('GET', '/deep/068270/2026-10-02', undefined, u.session)).body.freeLeft, UNLOCK.monthlyFree.alpha! - UNLOCK.monthlyFree.plus!);
});

test('on-demand reports charge once across concurrent retries; owner/pro read, others unlock once with credits; redelivery is idempotent',async()=>{
 const t=await reportSetup();
 const [a,b]=await Promise.all([t.call('POST','/reports',{symbol:'000660',kind:'report'},t.user.session),t.call('POST','/reports',{symbol:'000660',kind:'report'},t.user.session)]);
 assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(a.body.id,b.body.id);assert.equal(t.queued.length,1);
 assert.equal((await t.call('GET','/me',undefined,t.user.session)).body.credits.balance,ALPHA.monthlyCredits-CREDIT_COST.report);
 assert.equal((await t.call('GET','/reports/'+a.body.id,undefined,t.user.session)).body.etaSec,undefined,'no estimate before three finished jobs');
 for(const [i,sec] of [[1,60],[2,90],[3,120]] as const)await t.env.DB.prepare("INSERT INTO report_jobs (id,user_id,symbol,kind,input_hash,input_json,status,stage,credits,reserved_usd,created_at,updated_at) VALUES (?,?,?,?,?,?,'done','done',0,0,?,?)").bind('hist-'+i,'someone','005930','report','h'+i,'{}','2026-10-01T00:00:00.000Z',new Date(Date.parse('2026-10-01T00:00:00Z')+sec*1000).toISOString()).run();
 assert.equal((await t.call('GET','/reports/'+a.body.id,undefined,t.user.session)).body.etaSec,120,'the countdown starts from recent real durations');
 const {runReportJob}=await import('./reports.js');let runs=0;
 const gen=t.deps.generate!;t.deps.generate=async(r,k)=>{runs++;return gen(r,k);};
 await runReportJob(t.env.DB,a.body.id,{now:t.deps.now!,fetch:t.deps.fetch!,generate:t.deps.generate});
 await runReportJob(t.env.DB,a.body.id,{now:t.deps.now!,fetch:t.deps.fetch!,generate:t.deps.generate});assert.equal(runs,1);
 const done=await t.call('GET','/reports/'+a.body.id,undefined,t.user.session);
 assert.equal(done.body.status,'done');assert.match(done.body.fragments.home,/비공개 분석 본문/);assert.match(done.body.fragments.ai,/class="[^"]*parliament/,'the committee seats come with a generated report');assert.doesNotMatch(done.body.fragments.ai,/위원별 판단/,'one committee section: the seats carry each member\'s view');
 const other=await t.login('other@example.com',(await t.call('POST','/admin/invites',{},t.boss.session)).body.code);await spendFreeOpens(t,'other@example.com');
 // Someone else's report opens once for the unlock price, then stays open without charging again.
 const lockedJob=await t.call('GET','/reports/'+a.body.id,undefined,other.session);
 assert.deepEqual([lockedJob.status,lockedJob.body.error,lockedJob.body.cost],[200,'LOCKED',CREDIT_COST.unlock]);
 assert.doesNotMatch(JSON.stringify(lockedJob.body),/비공개 분석 본문/);
 const latest=(await t.call('GET','/reports/latest/000660',undefined,other.session)).body.job;
 assert.deepEqual([latest.id,latest.locked,latest.cost],[a.body.id,true,CREDIT_COST.unlock]);
 const makerBefore=(await t.call('GET','/me',undefined,t.user.session)).body.credits.balance;
 const before=lockedJob.body.balance, opened=await t.call('POST','/reports/'+a.body.id+'/unlock',{},other.session);
 assert.deepEqual([opened.status,opened.body.charged,opened.body.balance],[200,CREDIT_COST.unlock,before-CREDIT_COST.unlock]);
 // G-126: the maker gets a share of a paid open, once per reader.
 assert.equal((await t.call('GET','/me',undefined,t.user.session)).body.credits.balance,makerBefore+UNLOCK.makerShare);
 assert.equal((await t.call('POST','/reports/'+a.body.id+'/unlock',{},other.session)).body.charged,0);
 const read=await t.call('GET','/reports/'+a.body.id,undefined,other.session);assert.equal(read.status,200);assert.match(read.body.fragments.home,/비공개 분석 본문/);
 await t.env.DB.prepare("DELETE FROM unlocks WHERE user_id=(SELECT id FROM users WHERE email='other@example.com') AND symbol<>'USED'").run();
  await t.env.DB.prepare("UPDATE users SET plan='pro' WHERE email='other@example.com'").run();
  assert.equal((await t.call('GET','/reports/'+a.body.id,undefined,other.session)).status,200);
 await t.env.DB.prepare("UPDATE users SET plan='plus' WHERE email='other@example.com'").run();
 const blocked=await t.call('GET','/reports/'+a.body.id,undefined,other.session);assert.equal(blocked.body.locked,true);assert.doesNotMatch(JSON.stringify(blocked.body),/비공개 분석 본문/);
 assert.equal((await t.call('GET','/reports/'+a.body.id)).status,401);
 const mine=(await t.call('GET','/reports/mine',undefined,t.user.session)).body;assert.equal(mine.jobs.length,1);assert.equal(mine.jobs[0].status,'done');assert.equal(mine.jobs[0].symbol,'000660');
 assert.deepEqual((await t.call('GET','/reports/mine',undefined,other.session)).body.jobs,[],'someone else\'s reports never show in my list');
 assert.equal((await t.call('GET','/me/export',undefined,t.user.session)).body.reportJobs.length,1);
});

test('queue failure and generation failure refund once; a failed report can be retried',async()=>{
 const t=await reportSetup();t.env.REPORT_QUEUE={send:async()=>{throw Error('offline');}};
 assert.equal((await t.call('POST','/reports',{symbol:'000660',kind:'report'},t.user.session)).status,503);
 assert.equal((await t.call('GET','/me',undefined,t.user.session)).body.credits.balance,ALPHA.monthlyCredits);
 t.env.REPORT_QUEUE={send:async()=>{}};
 const next=await t.call('POST','/reports',{symbol:'000660',kind:'report'},t.user.session);assert.equal(next.status,200);
 const {runReportJob}=await import('./reports.js');const deps={now:t.deps.now!,fetch:t.deps.fetch!,generate:async()=>{throw Error('AI failed');}};
 await runReportJob(t.env.DB,next.body.id,deps);await runReportJob(t.env.DB,next.body.id,deps);
 assert.equal((await t.call('GET','/reports/'+next.body.id,undefined,t.user.session)).body.status,'failed');
 assert.equal((await t.call('GET','/me',undefined,t.user.session)).body.credits.balance,ALPHA.monthlyCredits);
 assert.equal((await t.call('POST','/reports',{symbol:'000660',kind:'report'},t.user.session)).status,200);
});

test('report budget rejects before charge and stale generation refunds',async()=>{
 const t=await reportSetup();t.env.AI_DAILY_USD='0.1';
 assert.equal((await t.call('POST','/reports',{symbol:'000660',kind:'report'},t.user.session)).body.error,'AI_BUDGET');
 assert.equal((await t.call('GET','/me',undefined,t.user.session)).body.credits.balance,ALPHA.monthlyCredits);
 t.env.AI_DAILY_USD='5';const r=await t.call('POST','/reports',{symbol:'000660',kind:'report'},t.user.session);
 t.tick(16*60000);assert.equal((await t.call('GET','/reports/'+r.body.id,undefined,t.user.session)).body.status,'failed');
 assert.equal((await t.call('GET','/me',undefined,t.user.session)).body.credits.balance,ALPHA.monthlyCredits);
});

test('AI screen composition validates fields, refunds unsupported output, and keeps an editable rule',async()=>{
 let answer=JSON.stringify({name:'거래량',explanation:'오늘 평균 대비 3배',screen:{match:'all',rules:[{f:'vol1',op:'>=',v:3}]}});
 const t=setup({ai:{create:async()=>({content:[{type:'text',text:answer}],model:'claude-haiku-4-5',stop_reason:'end_turn',usage:{input_tokens:100,output_tokens:100}})}});
 const boss=await t.login('boss@example.com');const u=await t.login('screen@example.com',(await t.call('POST','/admin/invites',{},boss.session)).body.code);
 const good=await t.call('POST','/screens/compose',{question:'거래량 터진 종목',market:'stock'},u.session);assert.equal(good.status,200);assert.deepEqual(good.body.screen.rules,[{f:'vol1',op:'>=',v:3}]);
 const bal=good.body.balance;answer=JSON.stringify({screen:{match:'all',rules:[{f:'cap',op:'>=',v:100}]}});
 const bad=await t.call('POST','/screens/compose',{question:'큰 코인',market:'coin'},u.session);assert.equal(bad.body.error,'UNSUPPORTED');assert.equal((await t.call('GET','/me',undefined,u.session)).body.credits.balance,bal);
});

test('chat SSE emits text deltas then the charged result, without waiting for a whole answer',async()=>{
 let finish!:()=>void;const barrier=new Promise<void>(r=>{finish=r;});
 const t=setup({ai:{create:async()=>{throw Error('stream expected');},stream:async(_p,onText)=>{onText('첫 문장');await barrier;onText(' 둘째');return {content:[{type:'text',text:'첫 문장 둘째'}],model:'claude-haiku-4-5',stop_reason:'end_turn',usage:{input_tokens:100,output_tokens:100}};}}});
 const boss=await t.login('boss@example.com');
 const response=await handle(new Request('https://api.test/ask/stream',{method:'POST',headers:{Origin:'https://hanul442.github.io','Content-Type':'application/json',Authorization:'Bearer '+boss.session},body:JSON.stringify({tier:'question',question:'설명해 줘'})}),t.env,t.deps);
 assert.match(response.headers.get('Content-Type')!,/text\/event-stream/);const reader=response.body!.getReader();let text='';
 while(!text.includes('첫 문장')){text+=new TextDecoder().decode((await reader.read()).value);}
 assert.match(text,/event: delta/);assert.doesNotMatch(text,/event: done/);finish();
 while(true){const chunk=await reader.read();if(chunk.done)break;text+=new TextDecoder().decode(chunk.value);}assert.match(text,/event: done/);assert.match(text,/"credits":5/);
});

test('custom experts are account-owned, bounded, exported and used at the invite price',async()=>{
 const calls:Record<string,any>[]=[];
 const t=setup({ai:{create:async p=>{calls.push(p);return {content:[{type:'text',text:'근거를 확인하세요.'}],model:String(p.model),stop_reason:'end_turn',usage:{input_tokens:100,output_tokens:20}};}}});
 const boss=await t.login('boss@example.com');
 const u=await t.login('custom@example.com',(await t.call('POST','/admin/invites',{},boss.session)).body.code);
 const other=await t.login('othercustom@example.com',(await t.call('POST','/admin/invites',{},boss.session)).body.code);
 assert.equal((await t.call('POST','/experts',{name:'x',focus:'x'},u.session)).status,400);
 assert.equal((await t.call('GET','/experts')).status,401);
 assert.match((await handle(new Request('https://api.test/experts',{method:'OPTIONS',headers:{Origin:'https://hanul442.github.io'}}),t.env,t.deps)).headers.get('Access-Control-Allow-Methods')!,/DELETE/);
 const made=await t.call('POST','/experts',{name:'현금흐름 전문가',focus:'현금흐름과 설비투자 위험을 검토',style:'숫자와 근거 중심'},u.session);
 assert.equal(made.status,200);const id=made.body.expert.id;
 assert.equal((await t.call('GET','/experts',undefined,other.session)).body.items.length,0);
 assert.equal((await t.call('DELETE','/experts/'+id,undefined,other.session)).status,404);
 assert.equal((await t.call('POST','/ask',{tier:'standard',question:'위험은 뭔가요?',expert:'custom:'+id},other.session)).body.error,'BAD_EXPERT');
 const answer=await t.call('POST','/ask',{tier:'standard',question:'위험은 뭔가요?',expert:'custom:'+id,symbol:'KRW-BTC'},u.session);
 assert.equal(answer.status,200);assert.equal(answer.body.credits,CREDIT_COST.invite);assert.equal(answer.body.speaker,'현금흐름 전문가');
 assert.match(String(calls[0]!.system),/현금흐름과 설비투자/);assert.match(JSON.stringify(calls[0]!.messages),/KRW-BTC/);
 assert.equal((await t.call('GET','/me/export',undefined,u.session)).body.experts[0].id,id);
 for(let i=1;i<20;i++)assert.equal((await t.call('POST','/experts',{name:'전문가 '+i,focus:'거래량과 위험'},u.session)).status,200);
 assert.equal((await t.call('POST','/experts',{name:'초과 전문가',focus:'거래량과 위험'},u.session)).body.error,'EXPERT_LIMIT');
 assert.equal((await t.call('DELETE','/experts/'+id,undefined,u.session)).status,200);
 assert.equal((await t.call('POST','/ask',{tier:'standard',question:'위험은?',expert:'custom:'+id},u.session)).body.error,'BAD_EXPERT');
 await t.call('POST','/me/delete',{confirm:'삭제'},u.session);assert.equal((await t.env.DB.prepare('SELECT COUNT(*) AS n FROM custom_experts').first<{n:number}>())?.n,0);
});

test('plans: phone push from Plus, price alert caps by plan', async () => {
  const t = setup();
  const { session } = await t.login('boss@example.com');
  await t.env.DB.prepare("UPDATE users SET plan = 'free' WHERE email = 'boss@example.com'").run();
  const sub = { endpoint: 'https://push.test/x', keys: { p256dh: 'B' + 'a'.repeat(86), auth: 'a'.repeat(22) } };
  assert.equal((await t.call('POST', '/push/subscribe', sub, session)).status, 403);
  assert.equal((await t.call('POST', '/alerts/price', { symbol: '005930', op: '>=', price: 300000 }, session)).status, 200);
  const second = await t.call('POST', '/alerts/price', { symbol: '000660', op: '<=', price: 1e6 }, session);
  assert.equal(second.status, 403); assert.equal(second.body.limit, 1);
  await t.env.DB.prepare("UPDATE users SET plan = 'plus' WHERE email = 'boss@example.com'").run();
  assert.equal((await t.call('POST', '/push/subscribe', sub, session)).status, 200);
  assert.equal((await t.call('POST', '/alerts/price', { symbol: '000660', op: '<=', price: 1e6 }, session)).status, 200);
  const prefs = await t.call('GET', '/notify/prefs', undefined, session);
  assert.equal(prefs.body.limits.priceAlerts, 5);
});

test('stockinfo (G-120): a stock without a report gets valuation, news and filings panels; a failing source is left out', async () => {
  const t = setup(), base = t.deps.fetch;
  t.deps.fetch = (async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith('/stock/015760/integration')) return Response.json({ stockName: '한국전력', totalInfos: [{ code: 'per', value: '2.45배' }, { code: 'pbr', value: '0.38배' }, { code: 'bps', value: '78,939원' }], consensusInfo: { createDate: '2026-10-01', priceTargetMean: '45,000' } });
    if (u.includes('/news/stock/015760')) return Response.json([{ total: 1, items: [{ officeName: '연합뉴스', datetime: '202610072010', title: '한전 뉴스', mobileNewsUrl: 'https://n.news.naver.com/mnews/article/001/1' }] }]);
    if (u.includes('/stock/015760/disclosure')) return Response.json([{ disclosureId: 1, title: '풍문 해명', datetime: '2026-10-02T11:11:29', author: 'KOSCOM' }]);
    return base(url, init);
  }) as typeof fetch;
  const r = await t.call('GET', '/stockinfo/015760?close=30000');
  assert.equal(r.status, 200);
  assert.match(r.body.fundamentals, /2\.45배/);
  assert.match(r.body.fundamentals, /45,000원/);
  assert.match(r.body.news, /한전 뉴스/);
  assert.match(r.body.filings, /풍문 해명/);
  assert.equal(r.body.flows, '');
  assert.equal((await t.call('GET', '/stockinfo/xyz')).status, 404);
});
