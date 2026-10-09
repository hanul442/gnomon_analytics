import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanPrefs, DEFAULT_PREFS, inQuiet, notifyUser, runDailyNotify, runPriceAlerts, runUpdateNotify } from './notify.js';
import { b64u, encryptPayload, unb64u, vapid, vapidHeader } from './push.js';
import { testDb } from './testDb.js';

const SITE = 'https://hanul442.github.io/gnomon_analytics';

/** A browser's side of RFC 8291: decrypt what the Worker sent, with the subscription's private key. */
async function decrypt(body: Uint8Array, ua: CryptoKeyPair, auth: Uint8Array<ArrayBuffer>): Promise<string> {
  const salt = body.slice(0, 16), idlen = body[20]!, as = body.slice(21, 21 + idlen), data = body.slice(21 + idlen);
  const uaPub = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey) as ArrayBuffer);
  const asKey = await crypto.subtle.importKey('raw', as, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey } as EcdhKeyDeriveParams, ua.privateKey, 256));
  const hk = async (salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, n: number) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8));
  const e = new TextEncoder(), info = new Uint8Array([...e.encode('WebPush: info\0'), ...uaPub, ...as]);
  const ikm = await hk(auth, shared, info, 32);
  const cek = await hk(salt, ikm, e.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await hk(salt, ikm, e.encode('Content-Encoding: nonce\0'), 12);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), data));
  assert.equal(plain.at(-1), 2, 'last record delimiter');
  return new TextDecoder().decode(plain.slice(0, -1));
}

test('web push: payload decrypts with the subscription key, VAPID signs with the stored key', async () => {
  const db = testDb();
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const body = await encryptPayload('{"title":"알림"}', b64u(await crypto.subtle.exportKey('raw', ua.publicKey) as ArrayBuffer), b64u(auth));
  assert.equal(await decrypt(body, ua, auth), '{"title":"알림"}');
  const v = await vapid(db), again = await vapid(db);
  assert.equal(v.publicKey, again.publicKey, 'one key, kept in D1');
  const h = await vapidHeader(v, 'https://fcm.googleapis.com/fcm/send/abc', SITE, new Date('2026-10-06T00:00:00Z'));
  const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(h)!;
  assert.equal(k, v.publicKey);
  const [head, claims, sig] = t!.split('.');
  assert.equal(JSON.parse(new TextDecoder().decode(unb64u(claims!))).aud, 'https://fcm.googleapis.com');
  const pub = await crypto.subtle.importKey('raw', unb64u(v.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, unb64u(sig!), new TextEncoder().encode(`${head}.${claims}`)));
});

async function world() {
  const db = testDb(), now = new Date('2026-10-06T02:00:00Z'), sent: { url: string; body?: unknown }[] = [];
  for (const [id, email] of [['u1', 'a@x.test'], ['u2', 'b@x.test']]) await db.prepare('INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)').bind(id, email, now.toISOString()).run();
  const fetcher = (async (url: string, init?: RequestInit) => {
    sent.push({ url: String(url), body: init?.body });
    if (String(url).endsWith('/watchinfo.json')) return Response.json({ '005930': { c: 1, d: '2026-10-06' }, '000660': { c: 1, d: '2026-10-06' }, '035420': { c: 1, d: '2026-10-02' } });
    if (String(url).endsWith('/search.json')) return Response.json({ items: [['005930', '삼성전자'], ['000660', 'SK하이닉스']] });
    if (String(url).startsWith('https://polling.finance.naver.com/')) return Response.json({ datas: [{ itemCode: '005930', closePrice: '281,000' }, { itemCode: '000660', closePrice: '1,700,000' }] });
    if (String(url).startsWith('https://api.upbit.com/')) return Response.json([{ market: 'KRW-BTC', trade_price: 150000000 }]);
    if (String(url).startsWith('https://push.test/')) return new Response('', { status: String(url).endsWith('gone') ? 410 : 201 });
    return new Response('no', { status: 404 });
  }) as typeof fetch;
  return { db, now, sent, ctx: { db, fetch: fetcher, site: SITE, now } };
}

test('notifications follow each user\'s settings and push to their browsers; gone subscriptions are dropped', async () => {
  const { db, sent, ctx } = await world();
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const p256dh = b64u(await crypto.subtle.exportKey('raw', ua.publicKey) as ArrayBuffer), auth = b64u(crypto.getRandomValues(new Uint8Array(16)));
  for (const ep of ['https://push.test/ok', 'https://push.test/gone']) await db.prepare('INSERT INTO push_subs (endpoint, user_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)').bind(ep, 'u1', p256dh, auth, ctx.now.toISOString()).run();
  assert.equal(await notifyUser(ctx, 'u1', 'price', { title: 't', body: 'b', link: 'stock.html?c=005930' }), true);
  assert.equal(sent.filter((s) => s.url.startsWith('https://push.test/')).length, 2);
  assert.deepEqual((await db.prepare('SELECT endpoint FROM push_subs').all<{ endpoint: string }>()).results.map((r) => r.endpoint), ['https://push.test/ok']);
  await db.prepare('INSERT INTO notify_prefs (user_id, prefs, updated_at) VALUES (?, ?, ?)').bind('u1', JSON.stringify({ ...DEFAULT_PREFS, price: false }), ctx.now.toISOString()).run();
  assert.equal(await notifyUser(ctx, 'u1', 'price', { title: 't2', body: 'b', link: '' }), false, 'turned off');
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 'u1'").first<{ n: number }>())!.n, 1);
});

test('daily note: watched stocks first, else the count; once per user and date; requested reports announced', async () => {
  const { db, ctx } = await world();
  await db.prepare('INSERT INTO watchlists (user_id, symbols, updated_at) VALUES (?, ?, ?)').bind('u1', JSON.stringify(['000660', '035420']), ctx.now.toISOString()).run();
  await db.prepare("INSERT INTO action_requests (user_id, kind, symbol, credits, status, created_at) VALUES ('u2', 'report', '005930', 100, 'done', '2026-10-05T00:00:00Z')").run();
  const r = await runDailyNotify(ctx);
  assert.equal(r.date, '2026-10-06');
  const rows = (await db.prepare('SELECT user_id, kind, title, link FROM notifications ORDER BY id').all<{ user_id: string; kind: string; title: string; link: string }>()).results;
  assert.deepEqual(rows.map((x) => [x.user_id, x.kind]), [['u1', 'watchReport'], ['u2', 'daily'], ['u2', 'request']]);
  assert.match(rows[0]!.title, /SK하이닉스/); assert.doesNotMatch(rows[0]!.title, /035420/);
  assert.match(rows[1]!.title, /2개/); assert.equal(rows[2]!.link, '005930/index.html');
  await runDailyNotify(ctx);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM notifications').first<{ n: number }>())!.n, 3, 'no repeats');
});

test('price alerts fire once when crossed; stocks only in the session, coins any time', async () => {
  const { db, ctx } = await world();
  const add = (sym: string, op: string, price: number) => db.prepare('INSERT INTO price_alerts (user_id, symbol, name, op, price, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind('u1', sym, sym, op, price, ctx.now.toISOString()).run();
  await add('005930', '>=', 280000); await add('000660', '<=', 1650000); await add('KRW-BTC', '<=', 160000000);
  const r = await runPriceAlerts(ctx); // 11:00 KST, a Tuesday
  assert.equal(r.fired, 2);
  assert.deepEqual((await db.prepare('SELECT symbol FROM price_alerts WHERE fired_at IS NOT NULL ORDER BY id').all<{ symbol: string }>()).results.map((x) => x.symbol), ['005930', 'KRW-BTC']);
  assert.equal((await runPriceAlerts(ctx)).fired, 0, 'fires once');
  await db.prepare("UPDATE price_alerts SET fired_at = NULL WHERE symbol = '005930'").run();
  const night = { ...ctx, now: new Date('2026-10-06T13:00:00Z') };
  assert.equal((await runPriceAlerts(night)).fired, 0, 'no stock quotes after the close');
});

test('plans: free hears the day in 🔔 only (no phone, no watched-stock note); paid plans get both', async () => {
  const { db, sent, ctx } = await world();
  await db.prepare("UPDATE users SET plan = 'free' WHERE id = 'u1'").run();
  await db.prepare('INSERT INTO push_subs (endpoint, user_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)').bind('https://push.test/ok', 'u1', 'x', 'y', ctx.now.toISOString()).run();
  await db.prepare('INSERT INTO watchlists (user_id, symbols, updated_at) VALUES (?, ?, ?)').bind('u1', JSON.stringify(['000660']), ctx.now.toISOString()).run();
  await runDailyNotify(ctx);
  const n = await db.prepare("SELECT kind FROM notifications WHERE user_id = 'u1'").all<{ kind: string }>();
  assert.deepEqual(n.results.map((x) => x.kind), ['daily'], 'the day, not the watched-stock note');
  assert.equal(sent.filter((s) => s.url.startsWith('https://push.test/')).length, 0, 'no phone push on free');
  assert.equal(await notifyUser(ctx, 'u1', 'intraday', { title: 't', body: '', link: '' }), false, 'intraday is Pro');
});

test('update note (G-137): the first version seen is the baseline; a new one reaches every user once', async () => {
  const { db, ctx } = await world();
  let version = '2.12.0';
  const base = ctx.fetch;
  ctx.fetch = (async (url: string, init?: RequestInit) => (String(url).endsWith('/version.json') ? Response.json({ version, note: '종목정보 탭이 생겼어요.' }) : base(url, init))) as typeof fetch;
  assert.deepEqual(await runUpdateNotify(ctx), { version: '2.12.0', sent: 0 });
  version = '2.13.0';
  assert.deepEqual(await runUpdateNotify(ctx), { version: '2.13.0', sent: 2 });
  assert.deepEqual(await runUpdateNotify(ctx), { version: '2.13.0', sent: 0 }, 'once');
  const rows = (await db.prepare("SELECT title, link FROM notifications WHERE kind = 'update'").all<{ title: string; link: string }>()).results;
  assert.equal(rows.length, 2); assert.match(rows[0]!.title, /v2\.13\.0/); assert.equal(rows[0]!.link, 'updates.html');
  // G-177: a patch is news only for readers who asked for patches.
  version = '2.13.1';
  assert.deepEqual(await runUpdateNotify(ctx), { version: '2.13.1', sent: 0 }, 'patch: nobody opted in');
  version = '2.13.2';
  await db.prepare('INSERT INTO notify_prefs (user_id, prefs, updated_at) VALUES (?, ?, ?)').bind('u2', JSON.stringify({ updatePatch: true }), ctx.now.toISOString()).run();
  assert.deepEqual(await runUpdateNotify(ctx), { version: '2.13.2', sent: 1 }, 'patch: only u2');
  // G-177: a minor release in the night waits for the morning (22:00–08:00 KST), then goes out once.
  version = '2.14.0';
  const night = { ...ctx, now: new Date('2026-10-06T14:30:00Z') }; // 23:30 KST
  assert.deepEqual(await runUpdateNotify(night), { version: '2.14.0', sent: 0, deferred: true });
  assert.deepEqual(await runUpdateNotify(night), { version: '2.14.0', sent: 0, deferred: true }, 'still pending');
  const morning = { ...ctx, now: new Date('2026-10-07T00:10:00Z') }; // 09:10 KST
  assert.deepEqual(await runUpdateNotify(morning), { version: '2.14.0', sent: 2 });
  assert.deepEqual(await runUpdateNotify(morning), { version: '2.14.0', sent: 0 }, 'once');
});

test('quiet hours (G-152): no phone push inside the window, which may cross midnight; 🔔 still keeps the note', async () => {
  const q = { ...DEFAULT_PREFS, quiet: true, quietFrom: '23:00', quietTo: '07:00' };
  assert.equal(inQuiet(q, new Date('2026-10-06T15:30:00Z')), true, '00:30 KST');
  assert.equal(inQuiet(q, new Date('2026-10-06T22:30:00Z')), false, '07:30 KST');
  assert.equal(inQuiet({ ...q, quiet: false }, new Date('2026-10-06T15:30:00Z')), false);
  assert.equal(inQuiet({ ...q, quietFrom: '13:00', quietTo: '14:00' }, new Date('2026-10-06T04:30:00Z')), true, 'same-day window');
  assert.deepEqual(cleanPrefs({ quiet: true, quietFrom: '22:30', quietTo: '7:00', push: 'yes' }), { quiet: true, quietFrom: '22:30' }, 'bad times and types are dropped');
  const { db, sent, ctx } = await world();
  await db.prepare('INSERT INTO push_subs (endpoint, user_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)').bind('https://push.test/ok', 'u1', b64u(new Uint8Array(65)), b64u(new Uint8Array(16)), ctx.now.toISOString()).run();
  await db.prepare('INSERT INTO notify_prefs (user_id, prefs, updated_at) VALUES (?, ?, ?)').bind('u1', JSON.stringify({ ...q, quietFrom: '10:00', quietTo: '12:00' }), ctx.now.toISOString()).run();
  assert.equal(await notifyUser(ctx, 'u1', 'price', { title: 'quiet', body: 'b', link: '' }), true); // 11:00 KST
  assert.equal(sent.filter((x) => x.url.startsWith('https://push.test/')).length, 0, 'held back from the phone');
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 'u1'").first<{ n: number }>())!.n, 1, 'kept in 🔔');
});

test('US price alerts (G-152) use the world-stock quote, pre/after-market included, and speak dollars', async () => {
  const { db, ctx } = await world();
  const quote = (over: boolean) => ({ datas: [{ reutersCode: 'AAPL.O', closePrice: '230.10', compareToPreviousClosePrice: '1.0', fluctuationsRatio: '0.4', marketStatus: 'CLOSE', localTradedAt: '2026-10-05T16:00:00-04:00', ...(over ? { overMarketPriceInfo: { overMarketStatus: 'OPEN', tradingSessionType: 'PRE_MARKET', overPrice: '241.50', compareToPreviousClosePrice: '11.4', fluctuationsRatio: '4.9', localTradedAt: '2026-10-06T05:00:00-04:00' } } : {}) }] });
  let over = true;
  const fetcher = (async (url: string, init?: RequestInit) => (String(url).includes('/worldstock/stock/AAPL.O') ? Response.json(quote(over)) : ctx.fetch(url, init))) as typeof fetch;
  const c = { ...ctx, fetch: fetcher };
  await db.prepare('INSERT INTO price_alerts (user_id, symbol, name, op, price, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind('u1', 'AAPL.O', '애플', '>=', 240, ctx.now.toISOString()).run();
  over = false;
  assert.equal((await runPriceAlerts(c)).fired, 0, 'a closed market has no live price');
  over = true;
  assert.equal((await runPriceAlerts(c)).fired, 1);
  const n = await db.prepare("SELECT title, link FROM notifications WHERE user_id = 'u1'").first<{ title: string; link: string }>();
  assert.match(n!.title, /애플 \$241\.50 · \$240\.00 이상 도달/);
  assert.equal(n!.link, 'us.html?s=AAPL.O');
});

test('release notes read as a list (G-153): one item per sentence, the alert shows the first ones as bullets', async () => {
  const { noteItems, noteBullets } = await import('../report/releases.js');
  const note = '미국 주식 리포트를 요청할 수 있어요(달러 기준). 조용한 시간을 넣었어요. 차트 도구가 늘었어요. 토론방을 다듬었어요.';
  assert.deepEqual(noteItems(note), ['미국 주식 리포트를 요청할 수 있어요(달러 기준).', '조용한 시간을 넣었어요.', '차트 도구가 늘었어요.', '토론방을 다듬었어요.']);
  assert.equal(noteBullets(note, 3), '• 미국 주식 리포트를 요청할 수 있어요(달러 기준).\n• 조용한 시간을 넣었어요.\n• 차트 도구가 늘었어요.\n외 1가지');
});

test('release notes read as plain Korean: no raw code words the live audit flags', async () => {
  const { RELEASES } = await import('../report/releases.js');
  for (const r of RELEASES) assert.doesNotMatch(String(r[2]), /\bNaN\b|undefined|\[object|\bnull\b|Infinity/, String(r[0]));
});

test('the weekly summary mail (G-180): Sunday evening only, once a week, to users with the setting on, through the shared template and logged', async () => {
  const db = testDb();
  const { runWeeklySummary } = await import('./notify.js');
  const { mailLayout } = await import('./mail.js');
  await db.prepare("INSERT INTO users (id, email, plan, role, created_at) VALUES ('u1', 'a@example.com', 'plus', 'user', '2026-10-01T00:00:00Z'), ('u2', 'b@example.com', 'free', 'user', '2026-10-01T00:00:00Z')").run();
  await db.prepare("INSERT INTO watchlists (user_id, symbols, updated_at) VALUES ('u1', '[\"000660\",\"AAPL.O\"]', '2026-10-01T00:00:00Z')").run();
  await db.prepare("INSERT INTO screens (user_id, name, screen, alert, last_symbols, last_date, created_at) VALUES ('u1', '거래량 증가', '{}', 1, '[\"005930\",\"000660\"]', '2026-10-09', '2026-10-01T00:00:00Z'), ('u1', '꺼진 조건', '{}', 0, NULL, NULL, '2026-10-01T00:00:00Z')").run();
  await db.prepare("INSERT INTO notify_prefs (user_id, prefs, updated_at) VALUES ('u2', '{\"weekly\":false}', '2026-10-01T00:00:00Z')").run();
  const sent: { to: string; subject: string; html: string; text: string }[] = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith('/watchinfo.json')) return Response.json({ '000660': { c: 1842000, f: 2, n: 5, d: '2026-10-09' }, 'AAPL.O': { c: 250.12, f: 1, n: 3, d: '2026-10-01' } });
    if (u.endsWith('/search.json')) return Response.json({ items: [['000660', 'SK하이닉스'], ['AAPL.O', '애플']] });
    if (u.startsWith('https://api.resend.com')) { const b = JSON.parse(String(init!.body)); sent.push({ to: b.to[0], subject: b.subject, html: b.html, text: b.text }); return new Response('{"id":"m1"}', { status: 200 }); }
    return new Response('', { status: 404 });
  }) as typeof fetch;
  const env = { RESEND_API_KEY: 'k', SITE_URL: SITE };
  // Saturday evening KST: nothing.
  assert.deepEqual(await runWeeklySummary({ db, fetch: fetchFn, site: SITE, now: new Date('2026-10-10T10:10:00Z') }, env), { week: null, sent: 0 });
  // Sunday evening KST: u1 gets one mail; u2 turned it off.
  const sunday = new Date('2026-10-11T10:10:00Z');
  assert.deepEqual(await runWeeklySummary({ db, fetch: fetchFn, site: SITE, now: sunday }, env), { week: '2026-10-11', sent: 1 });
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.to, 'a@example.com');
  assert.match(sent[0]!.subject, /이번 주 그노몬 요약 · 10\/11/);
  assert.match(sent[0]!.html, /관심 종목 2개/);
  assert.match(sent[0]!.html, /SK하이닉스<\/b> 1,842,000원 · 공시 2건 · 뉴스 5건 · <span[^>]*>10\/09 새 리포트/);
  assert.match(sent[0]!.html, /애플<\/b> \$250\.12 <span[^>]*>· 리포트 10\/01<\/span>/, 'an older report shows its date, not this week\'s counts');
  assert.doesNotMatch(sent[0]!.html, /꺼진 조건/);
  assert.match(sent[0]!.html, /거래량 증가<\/b> 걸린 종목 2개/);
  assert.match(sent[0]!.html, /이번 주 리포트 1개/);
  assert.match(sent[0]!.html, /alerts\.html/, 'the footer links the settings');
  assert.match(sent[0]!.text, /관심 종목: SK하이닉스 1,842,000원, 애플 \$250\.12/);
  // The same week again sends nothing more; the log carries the delivery.
  assert.deepEqual(await runWeeklySummary({ db, fetch: fetchFn, site: SITE, now: new Date('2026-10-11T11:10:00Z') }, env), { week: '2026-10-11', sent: 0 });
  const log = (await db.prepare('SELECT user_id, kind, status FROM mail_log ORDER BY id').all<{ user_id: string; kind: string; status: string }>()).results;
  assert.deepEqual(log.map((r) => [r.user_id, r.kind, r.status]), [['u1', 'weekly', 'sent']]);
  // Without a mail key the row says so, nothing is sent, and the week stays open for a later run.
  await db.prepare("DELETE FROM notify_log").run();
  assert.deepEqual(await runWeeklySummary({ db, fetch: fetchFn, site: SITE, now: sunday }, { SITE_URL: SITE }), { week: '2026-10-11', sent: 0 });
  assert.equal((await db.prepare("SELECT status, error FROM mail_log WHERE id = 2").first<{ status: string; error: string }>())?.error, 'NO_API_KEY');
  assert.equal(await db.prepare("SELECT 1 FROM notify_log WHERE key = 'weekly:u1:2026-10-11'").first(), null, 'a failed send is tried again next run');
  // The template escapes what it is given and keeps the disclaimer.
  const page = mailLayout(SITE, '<b>제목</b>', '<p>본문</p>');
  assert.match(page, /&lt;b&gt;제목&lt;\/b&gt;/);
  assert.match(page, /투자 권유가 아니고/);
});
