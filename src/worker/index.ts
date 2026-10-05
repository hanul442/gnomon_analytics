// Cloudflare Worker entry (wrangler.toml). Wires the real clock, fetch and Anthropic client into the API.

import Anthropic from '@anthropic-ai/sdk';
import { handle, type Env } from './api.js';
import type { AskClient } from './ask.js';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const ai: AskClient | undefined = env.ANTHROPIC_API_KEY
      ? { create: (params) => new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 90_000 }).messages.create(params as never) as never }
      : undefined;
    return handle(req, env, { now: () => new Date(), fetch: (input, init) => fetch(input, init), ...(ai ? { ai } : {}) });
  },
};
