/** Claude usage fields are disjoint: input_tokens excludes cache writes and reads. */
export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation?: { ephemeral_5m_input_tokens: number; ephemeral_1h_input_tokens: number } | null;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWrite5mTokens?: number;
  cacheWrite1hTokens?: number;
  cacheReadTokens?: number;
}

export const MODEL_PRICE: Record<string, readonly [number, number]> = {
  'claude-haiku-4-5': [1, 5],
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5-5': [4, 20],
};

export function normalizeUsage(usage: ClaudeUsage): AiUsage {
  const write1h = usage.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const write5m = usage.cache_creation?.ephemeral_5m_input_tokens
    ?? Math.max(0, (usage.cache_creation_input_tokens ?? 0) - write1h);
  const read = usage.cache_read_input_tokens ?? 0;
  return {
    inputTokens: usage.input_tokens, outputTokens: usage.output_tokens,
    ...(write5m ? { cacheWrite5mTokens: write5m } : {}),
    ...(write1h ? { cacheWrite1hTokens: write1h } : {}),
    ...(read ? { cacheReadTokens: read } : {}),
  };
}

export function usageUsd(model: string, usage: AiUsage): number {
  const [inputPrice, outputPrice] = MODEL_PRICE[model] ?? [4, 20];
  const readMultiplier = model === 'claude-opus-5-5' ? 0.05 : 0.1;
  return (inputPrice * (usage.inputTokens + 1.25 * (usage.cacheWrite5mTokens ?? 0)
    + 2 * (usage.cacheWrite1hTokens ?? 0) + readMultiplier * (usage.cacheReadTokens ?? 0))
    + outputPrice * usage.outputTokens) / 1e6;
}

export const totalInputTokens = (u: AiUsage) => u.inputTokens + (u.cacheWrite5mTokens ?? 0)
  + (u.cacheWrite1hTokens ?? 0) + (u.cacheReadTokens ?? 0);
