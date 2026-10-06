import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeUsage, usageUsd, totalInputTokens } from './aiUsage.js';
import { AiBudget } from '../cli/aiBudget.js';
import { skippedCommentary } from './commentary.js';
import { buildDailyReport } from '../report/dailyReport.js';

test('mixed TTL cache writes and reads are billed separately, with model-specific read rates', () => {
  const usage = normalizeUsage({ input_tokens: 1000, output_tokens: 100,
    cache_creation_input_tokens: 5000, cache_read_input_tokens: 10000,
    cache_creation: { ephemeral_5m_input_tokens: 2000, ephemeral_1h_input_tokens: 3000 } });
  assert.equal(totalInputTokens(usage), 16000);
  assert.equal(usageUsd('claude-opus-5-5', usage), 0.042);
  assert.equal(usageUsd('claude-sonnet-5-5', usage), 0.022);
  assert.deepEqual(normalizeUsage({ input_tokens: 10, output_tokens: 20 }), { inputTokens: 10, outputTokens: 20 });
  assert.equal(normalizeUsage({ input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 800 }).cacheWrite5mTokens, 800);
});

test('monthly budget preserves cache usage and paid failures when reloaded', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-cache-budget-'));
  const at = new Date('2026-10-06T00:00:00Z');
  const budget = await AiBudget.load(root, at, 1);
  const report = buildDailyReport({ symbol: '000660', name: 'test', date: '2026-10-06', generatedAt: at, bars: [], disclosures: [], sources: [] });
  const c = { ...skippedCommentary(report, 'MAX_TOKENS', at), status: 'FAILED' as const,
    servedBy: 'claude-opus-5-5', usage: { inputTokens: 1000, outputTokens: 100, cacheReadTokens: 10000, cacheWrite5mTokens: 2000 } };
  budget.reserve('deep');
  await budget.record('000660', 'deep', c, at);
  const expected = usageUsd(c.servedBy, c.usage);
  assert.ok(Math.abs(budget.spent - expected) < 1e-10);
  assert.equal((await AiBudget.load(root, at)).spent, expected);
  assert.equal(JSON.parse(await readFile(AiBudget.path(root), 'utf8')).cacheReadTokens, 10000);
});
