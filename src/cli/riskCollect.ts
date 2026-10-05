// Market-wide filing risk collection (docs/DESIGN.md §5.14, G-49): every run fetches the 주요사항보고 (B)
// and 거래소공시 (I) filings since the last run (30 days on the first), keeps only the ones a risk rule
// matches in data/risk-filings.jsonl, and returns the flags of the last 30 days per stock.

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { riskFlags, riskOf, type RiskFiling, type RiskFlag } from '../analysis/riskFilings.js';
import { fetchDartFilings } from '../sources/opendart.js';

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export async function collectRiskFilings(input: { root: string; apiKey: string; today: string; fetch?: typeof fetch; now?: () => Date }): Promise<{ flags: Map<string, RiskFlag>; fetched: number; error?: string }> {
  const file = join(input.root, 'data', 'risk-filings.jsonl'), mark = join(input.root, 'data', 'status', 'risk-filings.json');
  const stored: RiskFiling[] = (await readFile(file, 'utf8').catch(() => '')).split('\n').filter(Boolean).map((l) => JSON.parse(l) as RiskFiling);
  const since = iso(Date.parse(`${input.today}T00:00:00Z`) - 30 * DAY);
  let fetched = 0, error: string | undefined;
  if (input.apiKey.trim()) {
    const through = (JSON.parse(await readFile(mark, 'utf8').catch(() => '{}')) as { through?: string }).through;
    // Re-read the last day (late filings), never more than 30 days back.
    let from = through && through > since ? iso(Date.parse(`${through}T00:00:00Z`) - DAY) : since;
    const seen = new Set(stored.map((f) => f.receiptNo)), fresh: RiskFiling[] = [];
    try {
      while (from <= input.today) {
        const to = [iso(Date.parse(`${from}T00:00:00Z`) + 6 * DAY), input.today].sort()[0]!;
        for (const kind of ['B', 'I']) {
          const list = await fetchDartFilings({ apiKey: input.apiKey, kind, from: from.replaceAll('-', ''), to: to.replaceAll('-', ''), maxPages: 100, ...(input.fetch ? { fetch: input.fetch } : {}), ...(input.now ? { now: input.now } : {}) });
          fetched += list.length;
          for (const f of list) {
            const rule = f.stockCode ? riskOf(f.title) : null;
            if (rule && !seen.has(f.receiptNo)) { seen.add(f.receiptNo); fresh.push({ symbol: f.stockCode, date: f.filedDate, title: f.title, receiptNo: f.receiptNo, key: rule.key }); }
          }
        }
        from = iso(Date.parse(`${to}T00:00:00Z`) + DAY);
      }
      await mkdir(join(input.root, 'data', 'status'), { recursive: true });
      if (fresh.length) await appendFile(file, fresh.map((f) => JSON.stringify(f)).join('\n') + '\n');
      await writeFile(mark, `${JSON.stringify({ through: input.today })}\n`);
      stored.push(...fresh);
    } catch (e) {
      // Never echo a URL: it carries the API key.
      error = e instanceof Error ? e.message.slice(0, 80) : 'unknown';
    }
  }
  return { flags: riskFlags(stored, since), fetched, ...(error ? { error } : {}) };
}
