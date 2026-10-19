import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanBars, cleanShapes, reviewDrawings, reviewText, type DrawBar } from './drawReview.js';

const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
// A rising zigzag: troughs every 20 bars on the line 10000 + 5i − 330, peaks between them.
const bars: DrawBar[] = Array.from({ length: 120 }, (_, i) => {
  const mid = 10000 + 5 * i + 300 * Math.sin((2 * Math.PI * (i - 10)) / 20);
  return { t: day(i), o: mid, h: mid + 30, l: mid - 30, c: mid };
});
const low = (i: number) => bars[i]!.l;
const troughs = [5, 25, 45, 65, 85, 105];

test('drawReview: a trend line on two swing lows passes the anchor, touch and break checks', () => {
  assert.ok(troughs.every((i) => bars[i]!.l <= bars[i - 1]!.l && bars[i]!.l <= bars[i + 1]!.l));
  const r = reviewDrawings(bars, [{ k: 'trend', pts: [{ t: day(25), p: low(25) }, { t: day(85), p: low(85) }] }]);
  const it = r.items[0]!, by = (l: string) => it.checks.find((c) => c.label === l)!;
  assert.equal(it.name, '추세선');
  assert.equal(by('첫 점 위치').ok, true);
  assert.equal(by('둘째 점 위치').ok, true);
  assert.equal(by('닿은 횟수').ok, true, by('닿은 횟수').detail);
  assert.equal(by('종가 이탈').ok, true);
  assert.match(it.facts[0]!, /지지선/);
});

test('drawReview: anchors off the swings and a short steep line are flagged', () => {
  const r = reviewDrawings(bars, [{ k: 'trend', pts: [{ t: day(30), p: bars[30]!.c }, { t: day(34), p: bars[34]!.h + 400 }] }]);
  const it = r.items[0]!, by = (l: string) => it.checks.find((c) => c.label === l)!;
  assert.equal(by('첫 점 위치').ok, false);
  assert.match(by('첫 점 위치').detail, /가장 가까운 스윙/);
  assert.equal(by('기간').ok, false);
  assert.equal(by('기울기').ok, false);
});

test('drawReview: Fibonacci from the range low to high passes; from a mid point it does not', () => {
  const good = reviewDrawings(bars, [{ k: 'fib', pts: [{ t: day(25), p: low(25) }, { t: day(35), p: bars[35]!.h }] }]).items[0]!;
  assert.deepEqual(good.checks.map((c) => c.ok), [true, true, true]);
  const bad = reviewDrawings(bars, [{ k: 'fib', pts: [{ t: day(28), p: bars[28]!.c }, { t: day(35), p: bars[35]!.h }] }]).items[0]!;
  assert.equal(bad.checks[0]!.ok, false);
});

test('drawReview: horizontal level counts tests and says which side of the close it is', () => {
  const r = reviewDrawings(bars, [{ k: 'hline', pts: [{ t: day(40), p: 10300 }] }]).items[0]!;
  assert.ok(r.checks.some((c) => c.label === '시험받은 횟수'));
  assert.match(r.facts[0]!, /지지/);
});

test('drawReview: positions, buy/sell marks and pen are skipped with a reason; future points are not anchors', () => {
  const r = reviewDrawings(bars, [
    { k: 'long', pts: [{ t: day(100), p: 12000 }, { t: day(110), p: 12500 }] },
    { k: 'up', pts: [{ t: day(100), p: 12000 }] },
    { k: 'ray', pts: [{ t: day(105), p: low(105) }, { d: 5, p: low(105) + 100 }] },
  ]);
  assert.deepEqual(r.skipped.map((s) => s.k), ['long', 'up']);
  assert.match(r.skipped[0]!.why, /매매/);
  assert.equal(r.items[0]!.checks[1]!.ok, null);
  const text = reviewText(r);
  assert.match(text, /\[그림 3\] 레이/);
  assert.match(text, /평가하지 않은 그림: 1번 롱 포지션/);
});

test('drawReview: request cleaning drops bad bars, unknown tools and odd points', () => {
  const b = cleanBars([{ t: '2026-01-02', o: 1, h: 2, l: 0.5, c: 1.5 }, { t: '2026-01-01', o: 1, h: 2, l: 0.5, c: 1.5 }, { t: 'x', o: 1, h: 1, l: 1, c: 1 }, { t: '2026-01-03', o: 1, h: 0.5, l: 0.4, c: 1 }]);
  assert.equal(b.length, 1);
  const s = cleanShapes([{ k: 'trend', pts: [{ t: '2026-01-02', p: 1 }, { d: 3, p: 2 }, { t: 'bad', p: 3 }] }, { k: '<script>', pts: [{ p: 1 }] }, { k: 'hline', pts: [{ p: -1 }] }]);
  assert.deepEqual(s, [{ k: 'trend', pts: [{ t: '2026-01-02', p: 1 }, { d: 3, p: 2 }] }]);
});
