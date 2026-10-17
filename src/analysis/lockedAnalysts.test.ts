import assert from 'node:assert/strict';
import test from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { LOCK_MODEL, lensOf, lockAnalysts } from './lockedAnalysts.js';
import type { EvidenceItem } from './commentary.js';

const ev = (id: string): EvidenceItem => ({ id, kind: 'PRICE', label: id, detail: `${id} 내용`, url: '#' });
const evidence = ['P1', 'T1', 'H1', 'R1', 'Q1', 'D1', 'F1', 'F2', 'N1', 'E1', 'K1'].map(ev);

test('each analyst reads only its own lens plus the price, the range and its record (G-228)', () => {
  assert.deepEqual(lensOf('volume_flow', evidence).map((e) => e.id), ['P1', 'R1', 'Q1', 'K1']);
  assert.deepEqual(lensOf('event_catalyst', evidence).map((e) => e.id), ['P1', 'R1', 'F1', 'F2', 'N1', 'E1', 'K1']);
  assert.deepEqual(lensOf('trend_momentum', evidence).map((e) => e.id), ['P1', 'T1', 'H1', 'R1', 'K1']);
});

/** Answers each analyst by its persona name; records every request. */
function client(answer: (persona: string) => string | Error, seen: Record<string, unknown>[] = []): Anthropic {
  return { messages: { create: async (params: Record<string, unknown>) => {
    seen.push(params);
    const persona = String((params.messages as { content: string }[])[0]!.content).match(/당신은 (.+?)예요/)![1]!;
    const a = answer(persona);
    if (a instanceof Error) throw a;
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: a }], usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 500 } };
  } } } as unknown as Anthropic;
}

test('calls are locked in parallel; bad, uncited or failed ones are left to the committee', async () => {
  const seen: Record<string, unknown>[] = [];
  const out = await lockAnalysts({ name: '가 (000001)', close: 100, extraRule: '', evidence }, client((p) => {
    if (p.startsWith('거래량')) return '{"stance":"BULLISH","confidence":64.6,"target":108,"invalidation":94,"rationale":{"text":"외국인 순매수가 이어져요.","evidenceIds":["q1","Z9"],"kind":"FACT"}}';
    if (p.startsWith('실적')) return '{"stance":"BEARISH","confidence":60,"target":90,"rationale":{"text":"근거 없음","evidenceIds":["Z9"]}}';
    if (p.startsWith('이벤트')) return new Error('overloaded');
    return 'not json';
  }, seen));
  assert.deepEqual(out.calls, [{ analyst: 'volume_flow', stance: 'BULLISH', confidence: 65, target: 108, invalidation: 94, rationale: { text: '외국인 순매수가 이어져요.', evidenceIds: ['Q1'], kind: 'FACT' } }]);
  assert.equal(seen.length, 6, 'every analyst had at least one item of its own lens');
  assert.ok(seen.every((p) => p.model === LOCK_MODEL));
  assert.match(String((seen.find((p) => /거래량/.test(String((p.messages as { content: string }[])[0]!.content)))!.messages as { content: string }[])[0]!.content), /"id":"Q1"/);
  assert.equal(out.usage?.model, LOCK_MODEL);
  // The call that threw billed nothing.
  assert.equal(out.usage?.inputTokens, 1000 * (seen.length - 1));
  assert.equal(out.usage?.cacheReadTokens, 500 * (seen.length - 1));
});

test('a client without messages.create locks nothing', async () => {
  assert.deepEqual(await lockAnalysts({ name: 'x', close: 1, extraRule: '', evidence }, {} as Anthropic), { calls: [], usage: null });
});
