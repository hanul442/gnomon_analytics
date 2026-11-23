import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDayOf, leanHit, runMyCallsScore, scoreWindow } from './myCalls.js';
import { testDb } from './testDb.js';
import { ALPHA_PAUSE } from '../report/wrapup.js';
// These tests describe the app after the login rest; since 11/9 the rest has no fixed end (docs/PAUSE_HANDOFF.md).
(ALPHA_PAUSE as { until: string }).until = '2026-11-19T15:00:00Z';

test('the start close is the choice day before 15:30 KST on a weekday, else the next weekday', () => {
  assert.equal(baseDayOf(new Date('2026-11-03T05:00:00Z')), '2026-11-03', 'Tue 14:00');
  assert.equal(baseDayOf(new Date('2026-11-03T07:00:00Z')), '2026-11-04', 'Tue 16:00');
  assert.equal(baseDayOf(new Date('2026-11-06T08:00:00Z')), '2026-11-09', 'Fri 17:00 → Mon');
  assert.equal(baseDayOf(new Date('2026-11-07T01:00:00Z')), '2026-11-09', 'Sat → Mon');
});

test('scoring: 20 sessions after the start; a flat lean hits within ±2%', () => {
  const bars = Array.from({ length: 30 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10), close: 100 + i }));
  assert.equal(scoreWindow(bars, '2026-10-20'), null, 'not yet 20 sessions');
  const w = scoreWindow(bars, '2026-10-03')!;
  assert.deepEqual([w.base.date, w.end.date], ['2026-10-03', '2026-10-23']);
  assert.equal(leanHit('up', 100, 103), true); assert.equal(leanHit('down', 100, 103), false);
  assert.equal(leanHit('flat', 100, 101.9), true); assert.equal(leanHit('flat', 100, 103), false);
});

test('the evening job scores due calls once and tells each reader how they did next to the committee', async () => {
  const db = testDb(), now = new Date('2026-11-25T11:00:00Z');
  await db.prepare('INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)').bind('u1', 'a@x.test', '2026-10-01T00:00:00Z').run();
  const ins = (sym: string, day: string, stance: string, com: string) => db.prepare('INSERT INTO my_calls (user_id, symbol, name, base_day, stance, com, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('u1', sym, sym === '000660' ? 'SK하이닉스' : '', day, stance, com, '2026-10-01T00:00:00Z').run();
  await ins('000660', '2026-10-05', 'up', 'down');
  await ins('005930', '2026-11-05', 'down', 'up');
  const bars = Array.from({ length: 40 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10), close: 100 + i }));
  const ctx = { db, fetch: (async () => new Response('', { status: 404 })) as unknown as typeof fetch, site: 'https://x.test', now };
  assert.deepEqual(await runMyCallsScore(ctx, { bars: async () => bars }), { scored: 1, users: 1 });
  const row = await db.prepare("SELECT hit, com_hit, base_date, end_date FROM my_calls WHERE symbol = '000660'").first<{ hit: number; com_hit: number; base_date: string; end_date: string }>();
  assert.deepEqual({ ...row }, { hit: 1, com_hit: 0, base_date: '2026-10-05', end_date: '2026-10-25' });
  const note = await db.prepare("SELECT title, body, link FROM notifications WHERE kind = 'mycall'").first<{ title: string; body: string; link: string }>();
  assert.equal(note!.title, '나 vs 위원회 채점 · SK하이닉스'); assert.match(note!.body, /나 맞음 · 위원회 틀림/); assert.equal(note!.link, 'mycalls.html');
  assert.deepEqual(await runMyCallsScore(ctx, { bars: async () => bars }), { scored: 0, users: 0 }, 'once');
});
