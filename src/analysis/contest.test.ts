import assert from 'node:assert/strict';
import test from 'node:test';
import type { AnalystCall } from './analysts.js';
import {
  benchmarkSide, committeeSide, committeeTarget, CONTEST_START_KRW, expectedFillDate, fillIndex, liveCalls, playerSide, ranking, review, seasonFile, weekdaysLeft,
  tierOf, cleanNickname, type CommitteeEntry, type LiveCall, type Order, type SeasonFile,
} from './contest.js';

const live = (symbol: string, upPct: number): LiveCall => ({ symbol, name: symbol + '사', upPct, baseDate: '2026-10-01', close: 100 });
const entry = (date: string, l: LiveCall[]): CommitteeEntry => ({ date, live: l, target: committeeTarget(l), method: 'gnm-contest-v1', recordedAt: `${date}T10:00:00Z` });

/** Five sessions: A rises 10%/day, B falls, C flat. */
function file(): SeasonFile {
  const board = [live('A', 70), live('B', 60), live('C', 40)];
  return {
    method: 'gnm-contest-v1', season: '2026-11', builtAt: '2026-11-06T10:00:00Z', closed: false,
    sessions: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'],
    names: { A: 'A사', B: 'B사', C: 'C사' },
    closes: { A: [100, 110, 121, 133.1, 146.41], B: [100, 90, 81, 72.9, 65.61], C: [100, 100, 100, 100, 100] },
    committee: [entry('2026-10-30', board), entry('2026-11-03', [live('A', 70), live('B', 45), live('C', 40)])],
  };
}
const order = (id: number, createdAt: string, side: 'BUY' | 'SELL', symbol: string, amount = 3_000_000, upPct: number | null = 60, extra: Partial<Order> = {}): Order =>
  ({ id, createdAt, side, symbol, amount, upPct, invalidation: null, reason: '', cancelled: false, ...extra });

test('committee holds its top names above 55%, at most five', () => {
  assert.deepEqual(committeeTarget([live('A', 70), live('B', 54), live('C', 90), live('D', 55)]), ['C', 'A', 'D']);
  assert.equal(committeeTarget(['A', 'B', 'C', 'D', 'E', 'F'].map((s) => live(s, 80))).length, 5);
});

test('orders fill at the first close after they are placed', () => {
  const s = file().sessions;
  assert.equal(fillIndex(s, '2026-11-03T06:00:00Z'), 1); // 15:00 KST: that day's close
  assert.equal(fillIndex(s, '2026-11-03T06:31:00Z'), 2); // 15:31 KST: the next
  assert.equal(fillIndex(s, '2026-11-01T03:00:00Z'), 0); // Sunday
  assert.equal(fillIndex(s, '2026-11-06T07:00:00Z'), -1); // after the last close in: pending
  assert.equal(expectedFillDate(new Date('2026-10-30T07:00:00Z')), '2026-11-02'); // Friday 16:00 KST → Monday, next season
  assert.equal(expectedFillDate(new Date('2026-10-30T05:00:00Z')), '2026-10-30');
  assert.equal(weekdaysLeft('2026-11-26'), 2);
});

test('the committee buys at the close after deciding and rebalances when its target changes', () => {
  const c = committeeSide(file());
  assert.equal(c.start, 0);
  // Day 0: A and B, 20% each. Decided on 11-03 (B drops below 55) → sold at 11-04's close.
  assert.deepEqual(c.holdings.map((h) => h.symbol), ['A']);
  assert.equal(c.cards.length, 2);
  assert.deepEqual(c.cards.map((x) => [x.symbol, x.upPct, x.hit]), [['A', 70, true], ['B', 60, false]]);
  // Brier (0.3² + 0.6²)/2 = 0.225 → skill 10.
  assert.equal(c.skill, 10);
  assert.ok(c.cash > CONTEST_START_KRW * 0.6 * 0.99);
});

test('a player: caps, holdings limit, cards scored at the season close, no AI view on the trades', () => {
  const f = file();
  const r = playerSide(f, [
    order(1, '2026-11-02T01:00:00Z', 'BUY', 'A', 5_000_000, 80, { invalidation: 95 }), // capped to 30%
    order(2, '2026-11-02T01:01:00Z', 'BUY', 'B', 2_000_000, 30, { invalidation: 80 }),
    order(3, '2026-11-02T01:02:00Z', 'BUY', 'C', 2_000_000, 50, { cancelled: true }),
    order(4, '2026-11-03T08:00:00Z', 'SELL', 'B'), // after the close → fills 11-04
    order(5, '2026-11-04T01:00:00Z', 'SELL', 'C'),
    order(6, '2026-11-06T08:00:00Z', 'BUY', 'C'),
  ]);
  const st = Object.fromEntries(r.statuses.map((s) => [s.id, s]));
  assert.equal(st[1]!.state, 'filled');
  assert.equal(st[1]!.state === 'filled' && st[1]!.amount, 3_000_000);
  assert.equal(st[3]!.state, 'cancelled');
  assert.deepEqual(st[4], { id: 4, state: 'filled', date: '2026-11-04', price: 81, amount: Math.round(2_000_000 / 100 * 81) });
  assert.equal(st[5]!.state === 'rejected' && st[5]!.reason, 'NOT_HELD');
  assert.equal(st[6]!.state, 'pending');
  assert.deepEqual(r.side.cards.map((c) => [c.symbol, c.hit, c.committeeUp]), [['A', true, 70], ['B', false, 60]]);
  // B fell through 80 on 11-05 (72.9).
  assert.equal(r.side.cards[1]!.brokeOn, '2026-11-05');
  assert.equal(r.side.cards[0]!.brokeOn, null);
  // Brier ((0.2)² + (0.3)²)/2 = 0.065 → 74.
  assert.equal(r.side.skill, 74);
  const v = review(r.side);
  assert.equal(v.invalidation.broke, 1);
  assert.deepEqual(v.against.map((x) => x.symbol), ['B']);
  assert.equal(JSON.stringify(v).includes('추천'), false);
});

test('more than five stocks is refused at the fill', () => {
  const f = file();
  for (const s of ['D', 'E', 'F']) { f.closes[s] = [100, 100, 100, 100, 100]; f.names[s] = s; }
  const r = playerSide(f, ['A', 'B', 'C', 'D', 'E', 'F'].map((s, i) => order(i + 1, `2026-11-02T01:0${i}:00Z`, 'BUY', s, 1_000_000)));
  assert.equal(r.statuses.at(-1)!.state === 'rejected' && (r.statuses.at(-1) as { reason: string }).reason, 'MAX_HOLDINGS');
  assert.equal(r.side.holdings.length, 5);
});

test('benchmark holds the first board equally; ranking needs three cards', () => {
  const b = benchmarkSide(file());
  assert.equal(b.holdings.length, 3);
  assert.ok(Math.abs(b.ret - ((1.4641 + 0.6561 + 1) / 3 - 1)) < 0.01);
  const f = file(), c = committeeSide(f);
  const p = (id: string, cards: number, up: number) => ({ id, side: playerSide(f, Array.from({ length: cards }, (_, i) => order(i + 1, `2026-11-02T01:0${i}:00Z`, 'BUY', 'A', 1_000_000, up))).side });
  const r = ranking([p('x', 3, 90), p('y', 3, 60), p('z', 2, 99)], c);
  assert.equal(r.n, 2);
  assert.deepEqual(r.ranked.map((x) => x.id), ['x', 'y']);
  assert.equal(r.committeeRank, null); // two cards only
});

test('live board: latest base session, younger than 20 sessions, only what was reported by then', () => {
  const bars = Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, close: 100 + i }));
  const call = (baseDate: string, stance: AnalystCall['stance'], confidence: number, reportDate = baseDate): AnalystCall =>
    ({ symbol: 'A', analyst: 'trend_momentum', reportDate, baseDate, baseClose: 100, stance, confidence, target: 110, promptVersion: 'x', madeAt: `${reportDate}T10:00:00Z` });
  const calls = [call('2026-09-02', 'BULLISH', 70), call('2026-09-20', 'BEARISH', 80, '2026-09-21')];
  assert.equal(liveCalls('2026-09-20', [{ symbol: 'A', name: 'A', calls, bars }])[0]!.upPct, 70);
  assert.equal(liveCalls('2026-09-21', [{ symbol: 'A', name: 'A', calls, bars }])[0]!.upPct, 20);
  assert.equal(liveCalls('2026-09-24', [{ symbol: 'A', name: 'A', calls: calls.slice(0, 1), bars }]).length, 0);
});

test('season file: sessions of the month, the last decision before it, closes per stock', () => {
  const bars = new Map([['A', [{ date: '2026-10-30', close: 9 }, { date: '2026-11-02', close: 10 }, { date: '2026-11-03', close: 11 }]]]);
  const f = seasonFile({ season: '2026-11', builtAt: 'x', today: '2026-11-03', entries: [entry('2026-10-29', [live('A', 60)]), entry('2026-10-30', [live('A', 70)]), entry('2026-11-02', [live('A', 70)])], bars, names: new Map([['A', '에이']]) });
  assert.deepEqual(f.sessions, ['2026-11-02', '2026-11-03']);
  assert.deepEqual(f.committee.map((e) => e.date), ['2026-10-30', '2026-11-02']);
  assert.deepEqual(f.closes.A, [10, 11]);
  assert.equal(f.names.A, '에이');
  assert.equal(f.closed, false);
});

test('tiers by judgment score after three cards; nicknames that read as contacts are refused (G-251)', () => {
  const cards = (n: number) => Array.from({ length: n }, () => ({}) as never);
  assert.equal(tierOf({ skill: 50, cards: cards(2) }).name, '배치 중');
  assert.deepEqual([35, 20, 10, 0, -5].map((k) => tierOf({ skill: k, cards: cards(3) }).name), ['다이아', '플래티넘', '골드', '실버', '브론즈']);
  assert.equal(cleanNickname(' 해시계_1 '), '해시계_1');
  for (const bad of ['a', '카톡주세요', 'open chat', '010-1234', 'tel1234567', 'GNOMON운영']) assert.equal(cleanNickname(bad), null, bad);
});
