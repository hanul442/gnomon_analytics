// AI usage ledger and monthly budget (docs/DESIGN.md §4.7, G-39; from BOT aiUsageLedger and
// aiCouncilCostGate). Every AI call is appended to data/status/ai-usage.jsonl with its tokens and
// dollar cost. Before a call, a run checks this month's total: once the next call would pass the
// budget, AI is skipped (the report is still written, with the reason). Core stocks run first,
// so they get the budget before the weekly picks.

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Commentary, CommentaryTier } from '../analysis/commentary.js';

/** USD per million tokens, input / output. */
export const PRICE_PER_MTOK: Record<string, readonly [number, number]> = {
  'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-4-5': [1, 5],
};
/** Typical cost of one call per tier, USD (measured medians plus a margin), used to decide before calling. */
export const ESTIMATE_USD: Record<CommentaryTier, number> = { deep: 0.15, brief: 0.03 };
export const DEFAULT_BUDGET_USD = 25;

export interface UsageLine { at: string; month: string; symbol: string; model: string; tier: CommentaryTier; inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number; usd: number }

/** Cached prompt tokens (G-149): a cache read bills at a tenth of the input price, a cache write at 1.25×. */
export const usd = (model: string, inputTokens: number, outputTokens: number, cacheRead = 0, cacheWrite = 0) => {
  const [i, o] = PRICE_PER_MTOK[model] ?? PRICE_PER_MTOK['claude-opus-5-5']!;
  return (inputTokens * i + cacheRead * i * 0.1 + cacheWrite * i * 1.25 + outputTokens * o) / 1e6;
};

export class AiBudget {
  constructor(readonly root: string, readonly month: string, readonly limit: number, public spent: number) {}

  static async load(root: string, now: Date, limit = DEFAULT_BUDGET_USD): Promise<AiBudget> {
    const month = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 7);
    const text = await readFile(AiBudget.path(root), 'utf8').catch(() => '');
    const spent = text.split('\n').filter(Boolean).map((l) => JSON.parse(l) as UsageLine).filter((l) => l.month === month).reduce((s, l) => s + l.usd, 0);
    return new AiBudget(root, month, limit, spent);
  }

  static path(root: string) { return join(root, 'data', 'status', 'ai-usage.jsonl'); }

  /** Whether a call of this tier still fits, counting what is already reserved by calls in flight. */
  allows(tier: CommentaryTier): boolean { return this.spent + ESTIMATE_USD[tier] <= this.limit; }

  /** Reserve before the call so parallel calls cannot all pass the check at once. */
  reserve(tier: CommentaryTier) { this.spent += ESTIMATE_USD[tier]; }

  /** Replace the reservation with the real cost and append the ledger line. */
  async record(symbol: string, tier: CommentaryTier, c: Commentary, at: Date): Promise<void> {
    this.spent -= ESTIMATE_USD[tier];
    if (!c.usage) return;
    const model = c.servedBy ?? c.model;
    const line: UsageLine = { at: at.toISOString(), month: this.month, symbol, model, tier, inputTokens: c.usage.inputTokens, outputTokens: c.usage.outputTokens, ...(c.usage.cacheReadTokens ? { cacheReadTokens: c.usage.cacheReadTokens } : {}), ...(c.usage.cacheWriteTokens ? { cacheWriteTokens: c.usage.cacheWriteTokens } : {}), usd: Math.round(usd(model, c.usage.inputTokens, c.usage.outputTokens, c.usage.cacheReadTokens, c.usage.cacheWriteTokens) * 1e5) / 1e5 };
    this.spent += line.usd;
    await mkdir(dirname(AiBudget.path(this.root)), { recursive: true });
    await appendFile(AiBudget.path(this.root), `${JSON.stringify(line)}\n`);
  }
}
