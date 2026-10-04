// Weekly selection run (docs/DESIGN.md §5.10): filings of the past week for
// every listed company, recent bars for a shortlist, then selectWeekly.
// Each selection is written once to data/selections/<date>.json.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchDartFilings } from '../sources/opendart.js';
import { fetchNaverDailyBars } from '../sources/naverPrice.js';
import { DEFAULT_SELECTION, eligible, selectWeekly, shortlist, type CandidateInput, type Selection, type SelectionParams } from '../analysis/selection.js';
import type { UniverseRow } from '../sources/naverList.js';
import type { Ticker } from '../config/tickers.js';

const dir = (root: string) => join(root, 'data', 'selections');

export async function latestSelection(root: string): Promise<Selection | null> {
  const files = (await readdir(dir(root)).catch(() => [] as string[])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const last = files.at(-1);
  return last ? JSON.parse(await readFile(join(dir(root), last), 'utf8')) as Selection : null;
}

/** Runs `fn` over items, at most `n` at a time, keeping order. */
export async function pool<T, R>(items: readonly T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]!); }
  }));
  return out;
}

const compact = (iso: string) => iso.replaceAll('-', '');

export async function runSelection(input: {
  root: string;
  date: string;
  now: Date;
  apiKey: string;
  universe: readonly UniverseRow[];
  core: readonly Ticker[];
  params?: SelectionParams;
  fetch?: typeof fetch;
}): Promise<Selection> {
  const params = input.params ?? DEFAULT_SELECTION;
  const fetchOpt = { now: () => input.now, ...(input.fetch ? { fetch: input.fetch } : {}) };
  // Filings of the last 7 calendar days, every KOSPI and KOSDAQ company.
  const from = new Date(Date.parse(`${input.date}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
  const filings = new Map<string, string[]>();
  for (const corpClass of ['Y', 'K'] as const) {
    const list = await fetchDartFilings({ apiKey: input.apiKey, corpClass, from: compact(from), to: compact(input.date), ...fetchOpt }).catch(() => []);
    for (const f of list) if (f.stockCode) (filings.get(f.stockCode) ?? filings.set(f.stockCode, []).get(f.stockCode)!).push(f.title);
  }
  const short = shortlist(input.universe, filings, params);
  const candidates: CandidateInput[] = (await pool(short, 6, async (row) => {
    const bars = await fetchNaverDailyBars(row.symbol, 70, fetchOpt).catch(() => []);
    return { row, bars: bars.map((b) => ({ date: b.date, close: b.close, volume: b.volume })), filings: filings.get(row.symbol) ?? [] };
  })).filter((c) => c.bars.length >= 6);
  const selection = selectWeekly({
    date: input.date, generatedAt: input.now, universe: input.universe.length,
    eligibleCount: input.universe.filter((r) => eligible(r, params)).length, params,
    core: input.core.map((t) => ({ symbol: t.symbol, name: t.name, market: t.market })), candidates,
  });
  await mkdir(dir(input.root), { recursive: true });
  await writeFile(join(dir(input.root), `${input.date}.json`), `${JSON.stringify(selection, null, 1)}\n`, { flag: 'wx' });
  return selection;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A weekly pick as a Ticker: news matched by its name, compared with its market index only. */
export function pickTicker(p: { symbol: string; name: string; market: 'KOSPI' | 'KOSDAQ' }, corpCodes: Readonly<Record<string, string>>): Ticker {
  return { symbol: p.symbol, name: p.name, market: p.market, dartCorpCode: corpCodes[p.symbol] ?? '', newsQuery: p.name, newsAliases: [escapeRegex(p.name)], ai: true };
}
