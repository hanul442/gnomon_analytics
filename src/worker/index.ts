// Cloudflare Worker entry (wrangler.toml). Wires the real clock, fetch and Anthropic client into the API.

import Anthropic from '@anthropic-ai/sdk';
import { handle, runAlerts, runIntraday, type Env } from './api.js';
import type { AskClient } from './ask.js';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const ai: AskClient | undefined = env.ANTHROPIC_API_KEY
      ? { create: (params) => new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 90_000 }).messages.create(params as never) as never }
      : undefined;
    return handle(req, env, { now: () => new Date(), fetch: (input, init) => fetch(input, init), ...(ai ? { ai } : {}) });
  },
  /** Cron (wrangler.toml): screener alerts after the site's daily build. */
  async scheduled(event: { cron: string }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
    const deps = { now: () => new Date(), fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init) };
    // Every-10-minute trigger: the intraday scan; the evening triggers: screener alerts.
    const job = event.cron.startsWith('*/10') ? runIntraday(env, deps) : runAlerts(env, deps);
    ctx.waitUntil(job.then((r) => console.log(event.cron, JSON.stringify(r))));
  },
};
