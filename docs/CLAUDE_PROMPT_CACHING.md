# Claude prompt caching

Prompt version: `gnm-committee-v7`. Pricing reference checked 2026-10-06:
https://platform.claude.com/docs/en/build-with-claude/prompt-caching

## Request boundaries

- Deep reports: one shared committee system block, explicitly cached for 5 minutes. Symbol/name/date/evidence remain in the uncached user message. Asset-specific ETF/coin rules follow the shared system block. Keep the structured output schema, model and effort stable within each workload.
- Standard/deep questions: cache the common system block and the server-sourced stock context before history. Persona instructions follow the common block; changing personas can reuse common instructions but creates a new stock-context prefix. UI page text and new questions remain uncached. The stock context naturally changes when the published data changes; never preserve stale data just to get hits.
- Haiku briefs, quick questions and AI screen composition: no requested cache writes. Haiku 4.5 needs a 4,096-token prefix, while Opus/Sonnet 5.5 need 512. Do not pad short prompts just to meet thresholds.
- No conversation-history cache, 1-hour TTL, paid warm-up or periodic keep-alive is enabled. Current rolling history stays bounded. Daily processing already handles core reports sequentially before its parallel pool; cold parallel pools may incur multiple writes until the first response begins.

## Usage and budgets

`src/analysis/aiUsage.ts` is the shared price/usage implementation. Claude's `input_tokens` excludes both cache creation and reads. Normalized records preserve uncached input, output, 5-minute writes, 1-hour writes and reads separately. Missing cache fields in old reports mean zero. Legacy cost wrappers remain compatible for uncached callers.

Current supported model input/output prices per million tokens: Haiku 4.5 $1/$5, Sonnet 5.5 $2/$10, Opus 5.5 $4/$20. Writes cost 1.25x (5 minutes) or 2x (1 hour) input; read multipliers are 0.1 for Haiku/Sonnet and 0.05 for Opus 5.5. Existing unknown-model fallback pricing remains an estimate and needs updating if new models are introduced. Use the actual served model for costs.

- CLI: `data/status/ai-usage.jsonl` and monthly budget include cache costs.
- Worker: `questions.usage_json` and `report_jobs.usage_json` retain normalized usage, including paid refusals/truncations returned by the API. Existing `input_tokens` stores uncached input; the `/ask` response's `usage.input` reports total processed input.
- No usage is invented for transport/SDK failures without a returned usage object. Reconcile these cases and provider fallback billing with the provider invoice.

Measure `cacheReadTokens / totalInputTokens`, cache writes, input cost and full request cost by model/tier. Compare comparable workloads before and after; a higher hit rate alone is not proof of lower spend. Output remains charged normally. Concise prompt rules reduce repetition without lowering the JSON completion cap or dropping evidence and scenario fields.

## Deployment and validation

Apply migration `0007_ai_cache_usage.sql` before deploying the Worker. The existing Deploy API workflow already applies D1 migrations before deployment; its path filter includes the shared usage module. Rollback can leave the additive nullable columns in place.

Local validation: typecheck and 165 tests pass, including stable cross-symbol system prefixes, UI/history changes outside stock cache boundaries, data invalidation, mixed TTL/model-specific costs, streamed Worker accounting/daily-budget enforcement and paid report failure ledger entries. Tests use fake Claude clients; no paid Claude request was made. Confirm real `cache_read_input_tokens` in production before claiming a savings percentage. Existing dated reports are retained; newly generated reports use v7.
