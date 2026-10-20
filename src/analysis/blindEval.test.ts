import assert from 'node:assert/strict';
import test from 'node:test';
import { anonymize, blindEvidence, calibrateRuleCalls, cleanBars, drawSample, EVAL_HORIZON, evalBoard, MIN_HISTORY, MIN_RECORD, outcomeOf, ruleCalls, ruleStance, type EvalCall } from './blindEval.js';
import type { ArenaBar } from './strategies.js';

const day = (i: number) => new Date(Date.UTC(2022, 0, 3) + i * 86_400_000).toISOString().slice(0, 10);
const wave = (n: number, base = 50_000): ArenaBar[] => Array.from({ length: n }, (_, i) => {
  const c = base * (1 + 0.15 * Math.sin(i / 17) + 0.0008 * i);
  return { date: day(i), open: c, high: c * 1.01, low: c * 0.99, close: c, volume: 1000 + 300 * Math.cos(i / 5) };
});

test('cleanBars sorts, drops duplicates (later line wins) and bad rows', () => {
  const b = cleanBars([{ date: '2024-01-03', open: 1, high: 2, low: 1, close: 2, volume: 1 }, { date: '2024-01-02', open: 1, high: 1, low: 1, close: 1, volume: 1 }, { date: '2024-01-03', open: 1, high: 3, low: 1, close: 3, volume: 1 }, { date: '2024-01-04', open: 0, high: 0, low: 0, close: 0, volume: 0 }]);
  assert.deepEqual(b.map((x) => [x.date, x.close]), [['2024-01-02', 1], ['2024-01-03', 3]]);
});

test('no look-ahead: a rule call at a session is the same with or without the sessions after it', () => {
  const bars = wave(500);
  const full = ruleCalls('X', bars).filter((c) => c.baseIdx === 399);
  const cut = ruleCalls('X', bars.slice(0, 400)).filter((c) => c.baseIdx === 399);
  assert.ok(full.length > 0);
  assert.deepEqual(full.map((c) => [c.predictor, c.stance]), cut.map((c) => [c.predictor, c.stance]));
  // With the future cut off, the outcome is unknown.
  assert.ok(cut.every((c) => c.outcomeDate === null && c.hit === null));
});

test('confidence counts only calls that finished before the base date', () => {
  // 40 finished BULLISH calls, all right, finishing on day 100+; one call based on day 50 sees none of them.
  const raw = Array.from({ length: 40 }, (_, i) => ({ predictor: 'r', symbol: 'X', baseIdx: i, baseDate: day(80 + i), baseClose: 100, stance: 'BULLISH' as const, outcomeDate: day(100 + i), hit: true, movePct: 4 }));
  const early = { ...raw[0]!, baseDate: day(50), outcomeDate: null, hit: null, movePct: null };
  const late = { ...raw[0]!, baseDate: day(200), outcomeDate: null, hit: null, movePct: null };
  const out = calibrateRuleCalls([...raw, early, late]);
  const at = (d: string) => out.find((c) => c.baseDate === d && c.baseIdx === 0 && (d === day(50) || d === day(200)))!;
  assert.equal(at(day(50)).confidence, 50);
  assert.equal(at(day(200)).confidence, 100);
  assert.ok(Math.abs(at(day(200)).target - 104) < 1e-9);
  assert.ok(MIN_RECORD <= 40);
});

test('rule stance: holding is bullish, flat with a negative reading bearish, else neutral', () => {
  assert.equal(ruleStance(1, -0.5), 'BULLISH');
  assert.equal(ruleStance(0, -0.1), 'BEARISH');
  assert.equal(ruleStance(0, 0.3), 'NEUTRAL');
  assert.equal(ruleStance(0, null), 'NEUTRAL');
});

test('outcomes use the live hit rule and the close 20 sessions on', () => {
  const bars = wave(300);
  const c: EvalCall = { predictor: 'p', symbol: 'X', baseIdx: 260, baseDate: bars[260]!.date, baseClose: bars[260]!.close, stance: 'NEUTRAL', confidence: 60, target: bars[260]!.close };
  const o = outcomeOf(c, bars)!;
  assert.equal(o.outcomeDate, bars[260 + EVAL_HORIZON]!.date);
  assert.equal(o.hit, Math.abs(o.movePct) <= 2);
  assert.equal(outcomeOf({ ...c, baseIdx: 290 }, bars), null);
});

test('the up-chance Brier puts every predictor on the same question', () => {
  const mk = (predictor: string, stance: EvalCall['stance'], confidence: number, movePct: number) => ({ predictor, symbol: 'X', baseIdx: 0, baseDate: 'd', baseClose: 100, stance, confidence, target: 100, close: 100 + movePct, outcomeDate: 'e', movePct, hit: stance === 'NEUTRAL' ? Math.abs(movePct) <= 2 : (stance === 'BULLISH') === movePct > 0, errPct: 0 });
  // A NEUTRAL caller that says "10% sure" earns a fine confidence Brier but only 0.25 on the up question.
  const rows = evalBoard([mk('shy', 'NEUTRAL', 10, 5), mk('shy', 'NEUTRAL', 10, -5), mk('bull', 'BULLISH', 80, 5), mk('bull', 'BULLISH', 80, 3)]);
  const shy = rows.find((r) => r.predictor === 'shy')!, bull = rows.find((r) => r.predictor === 'bull')!;
  assert.ok(Math.abs(shy.brier - 0.01) < 1e-9);
  assert.equal(shy.upBrier, 0.25);
  assert.ok(Math.abs(bull.upBrier - 0.04) < 1e-9);
  assert.equal(rows[0]!.predictor, 'bull');
});

test('the blind file has no dates and no real price level', () => {
  const bars = wave(400, 73_400);
  const anon = anonymize(bars, 380);
  assert.equal(anon.length, MIN_HISTORY);
  assert.ok(Math.abs(anon.at(-1)!.close - 100) < 1e-9);
  assert.ok(anon.every((b) => /^S\d{4}$/.test(b.date)));
  const text = JSON.stringify(blindEvidence(anon));
  assert.ok(!/20\d\d-\d\d-\d\d/.test(text), 'no calendar dates');
  assert.ok(!/\d{4,}/.test(text), 'no number in the real price scale (73,400 → 100)');
  assert.ok(!text.includes('원'), 'no currency amounts');
  for (const id of ['P1', 'T1', 'V1', 'R1', 'S1', 'Q1']) assert.ok(text.includes(`"id":"${id}"`), id);
});

test('the sample is reproducible and keeps the hidden 20 sessions inside the data', () => {
  const series = [{ symbol: 'A', bars: wave(700) }, { symbol: 'B', bars: wave(600) }];
  const a = drawSample(series, 10, 7), b = drawSample(series, 10, 7);
  assert.deepEqual(a, b);
  assert.equal(a.length, 10);
  for (const s of a) assert.ok(s.cutoff >= MIN_HISTORY - 1 && s.cutoff + EVAL_HORIZON < series.find((x) => x.symbol === s.symbol)!.bars.length);
});
