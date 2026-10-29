// G-305: writes the weekly wrong-answer review (src/analysis/missReview.ts) to data/eval/misses-<Monday>.md and
// .json, once per KST week, from the logged ranges and member calls and the stored prices. No AI, no network.
// The daily run calls refreshMissReview; `node dist/cli/missReview.js` writes it now.

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnalystCall } from '../analysis/analysts.js';
import { reviewMarkdown, reviewMisses } from '../analysis/missReview.js';
import type { PriceForecast } from '../analysis/valuation.js';
import { asOf, readLog } from '../store/jsonlLog.js';
import type { PriceBar } from '../types.js';
import { kstParts } from './kst.js';
import { priceKey } from './marketData.js';

/** The Monday (KST) of the week `now` falls in. */
export function weekStart(now: Date): string {
  const d = new Date(`${kstParts(now).date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export async function refreshMissReview(root: string, now: Date, force = false): Promise<string | null> {
  const monday = weekStart(now), out = join(root, 'data', 'eval', `misses-${monday}.md`);
  if (!force && (await stat(out).then(() => true, () => false))) return null;
  const list = async (sub: string) => (await readdir(join(root, 'data', sub)).catch(() => [] as string[])).filter((f) => f.endsWith('.jsonl'));
  const forecasts: PriceForecast[] = [], calls: AnalystCall[] = [];
  for (const f of await list('forecasts')) forecasts.push(...(await readLog<PriceForecast>(join(root, 'data', 'forecasts', f))));
  for (const f of await list('analysts')) calls.push(...(await readLog<AnalystCall>(join(root, 'data', 'analysts', f))));
  const bars = new Map<string, { date: string; close: number }[]>();
  const want = new Set([...forecasts.map((f) => f.symbol), ...calls.map((c) => c.symbol), 'KOSPI', 'KOSDAQ', 'KRW-BTC']);
  for (const s of want) {
    const rows = asOf(await readLog<PriceBar>(join(root, 'data', 'prices', `${s}.jsonl`)).catch(() => [] as PriceBar[]), priceKey, now);
    if (rows.length) bars.set(s, rows.map((b) => ({ date: b.date, close: b.close })).sort((a, b) => (a.date < b.date ? -1 : 1)));
  }
  const market = new Map((JSON.parse(await readFile(join(root, 'data', 'universe', 'stocks.json'), 'utf8').catch(() => '[]')) as { symbol: string; market: string }[]).map((s) => [s.symbol, s.market]));
  const indexOf = (symbol: string) => {
    if (symbol.startsWith('KRW-')) return symbol === 'KRW-BTC' ? null : bars.get('KRW-BTC') ?? null;
    const m = market.get(symbol);
    return m === 'KOSDAQ' ? bars.get('KOSDAQ') ?? null : m === 'KOSPI' || /^\d/.test(symbol) ? bars.get('KOSPI') ?? null : null;
  };
  const review = reviewMisses({ forecasts, calls, bars, indexOf });
  await mkdir(join(root, 'data', 'eval'), { recursive: true });
  await writeFile(join(root, 'data', 'eval', `misses-${monday}.json`), JSON.stringify({ date: monday, ...review }, null, 1));
  const md = reviewMarkdown(review, monday);
  await writeFile(out, md);
  return md;
}

if (process.argv[1]?.endsWith('missReview.js')) {
  void refreshMissReview(process.cwd(), new Date(), true).then((md) => console.log(md ?? '')).catch((e) => { console.error(e); process.exit(1); });
}
