// All listed stocks (docs/DESIGN.md §3.4): refreshed every run for search and
// the weekly selection. Only the code/name/market list and the DART corp codes
// are kept in data/, and only rewritten when they change; prices are not stored.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fetchMarketUniverse, type UniverseRow } from '../sources/naverList.js';
import { fetchCorpCodes } from '../sources/dartCorpCodes.js';
import type { NewsSourceStatus } from '../report/dailyReport.js';

export interface ListedStock { symbol: string; name: string; market: 'KOSPI' | 'KOSDAQ' }

export const universePaths = (root: string) => ({
  stocks: join(root, 'data', 'universe', 'stocks.json'),
  corpCodes: join(root, 'data', 'universe', 'dart-corp-codes.json'),
});

const CORP_CODES_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

async function writeIfChanged(path: string, value: unknown): Promise<boolean> {
  const text = `${JSON.stringify(value, null, 1)}\n`;
  const old = await readFile(path, 'utf8').catch(() => null);
  if (old === text) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
  return true;
}

export async function readListedStocks(root: string): Promise<ListedStock[]> {
  return JSON.parse(await readFile(universePaths(root).stocks, 'utf8').catch(() => '[]')) as ListedStock[];
}

interface CorpCodeFile { fetchedAt: string; codes: Record<string, string> }

export async function readCorpCodes(root: string): Promise<Record<string, string>> {
  return (JSON.parse(await readFile(universePaths(root).corpCodes, 'utf8').catch(() => '{"codes":{}}')) as CorpCodeFile).codes;
}

/** Live rows (common stocks only) or null when the list could not be fetched. Never throws. */
export async function collectUniverse(root: string, options: { apiKey: string; now: Date; fetch?: typeof fetch }): Promise<{ rows: UniverseRow[] | null; etfs: UniverseRow[]; status: NewsSourceStatus[] }> {
  const paths = universePaths(root);
  const status: NewsSourceStatus[] = [];
  const fetchOpt = options.fetch ? { fetch: options.fetch } : {};
  let rows: UniverseRow[] | null = null, etfs: UniverseRow[] = [];
  try {
    const all = [...await fetchMarketUniverse('KOSPI', fetchOpt), ...await fetchMarketUniverse('KOSDAQ', fetchOpt)];
    rows = all.filter((r) => r.kind === 'stock');
    // ETFs come in the same list (G-55); kept apart from stocks everywhere.
    etfs = all.filter((r) => r.kind.toLowerCase() === 'etf');
    const list: ListedStock[] = rows.map((r) => ({ symbol: r.symbol, name: r.name, market: r.market })).sort((a, b) => (a.symbol < b.symbol ? -1 : 1));
    await writeIfChanged(paths.stocks, list);
    status.push({ source: 'naver:m-stock:marketValue', ok: true, count: rows.length });
    status.push({ source: 'naver:m-stock:etf', ok: etfs.length > 0, count: etfs.length, ...(etfs.length ? {} : { error: 'NO_ETF_IN_LIST' }) });
  } catch (error) {
    status.push({ source: 'naver:m-stock:marketValue', ok: false, count: 0, error: error instanceof Error ? error.message.slice(0, 160) : 'UNKNOWN' });
  }
  // A checkout resets file times, so the fetch time is stored in the file.
  const fetchedAt = await readFile(paths.corpCodes, 'utf8').then((t) => Date.parse((JSON.parse(t) as CorpCodeFile).fetchedAt), () => Number.NaN);
  if (!(options.now.getTime() - fetchedAt < CORP_CODES_MAX_AGE_MS)) {
    try {
      const codes = await fetchCorpCodes({ apiKey: options.apiKey, ...fetchOpt });
      const sorted = Object.fromEntries(Object.entries(codes).sort(([a], [b]) => (a < b ? -1 : 1)));
      await writeIfChanged(paths.corpCodes, { fetchedAt: options.now.toISOString(), codes: sorted } satisfies CorpCodeFile);
      status.push({ source: 'opendart:corpCode', ok: true, count: Object.keys(codes).length });
    } catch (error) {
      status.push({ source: 'opendart:corpCode', ok: false, count: 0, error: error instanceof Error ? error.message.slice(0, 160) : 'UNKNOWN' });
    }
  }
  return { rows, etfs, status };
}
