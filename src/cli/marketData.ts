// Stage A collection (docs/DESIGN.md §5, §5.4): intraday and weekly bars,
// benchmarks, investor flows, valuation snapshot, financials and research
// listings. Every source is best effort: a failure is recorded, never fatal.

import { join } from 'node:path';
import { appendNew, appendUnseen } from '../store/jsonlLog.js';
import { fetchNaverDailyBars, fetchNaverIntraday, fetchNaverWeeklyBars } from '../sources/naverPrice.js';
import { fetchNaverStockData } from '../sources/naverStock.js';
import type { NewsSourceStatus } from '../report/dailyReport.js';
import type { FinancePeriod, IntradaySession, InvestorFlow, PriceBar, ResearchNote, StockSnapshot } from '../types.js';

export const marketPaths = (root: string, symbol: string) => ({
  weekly: join(root, 'data', 'prices-week', `${symbol}.jsonl`),
  intraday: join(root, 'data', 'intraday', `${symbol}.jsonl`),
  flows: join(root, 'data', 'flows', `${symbol}.jsonl`),
  snapshots: join(root, 'data', 'snapshots', `${symbol}.jsonl`),
  finance: join(root, 'data', 'finance', `${symbol}.jsonl`),
  research: join(root, 'data', 'research', `${symbol}.jsonl`),
  daily: (other: string) => join(root, 'data', 'prices', `${other}.jsonl`),
});

export const priceKey = (bar: PriceBar) => `${bar.symbol}:${bar.date}`;
export const intradayKey = (s: IntradaySession) => `${s.symbol}:${s.date}`;
export const flowKey = (f: InvestorFlow) => `${f.symbol}:${f.date}`;
export const snapshotKey = (s: StockSnapshot) => `${s.symbol}:${s.date}`;
export const financeKey = (f: FinancePeriod) => `${f.symbol}:${f.periodType}:${f.period}`;
export const researchKey = (r: ResearchNote) => r.id;

export async function collectMarketData(
  root: string,
  symbol: string,
  kstDate: string,
  fetchOptions: { now: () => Date; fetch?: typeof fetch },
  /** Index and peer compared against the stock (config/tickers benchmarksFor). */
  benchmarks: readonly { symbol: string }[],
): Promise<NewsSourceStatus[]> {
  const paths = marketPaths(root, symbol);
  const status: NewsSourceStatus[] = [];
  const job = async (source: string, run: () => Promise<number>) => {
    try {
      status.push({ source, ok: true, count: await run() });
    } catch (error) {
      status.push({ source, ok: false, count: 0, error: error instanceof Error ? error.message.slice(0, 160) : 'UNKNOWN' });
    }
  };
  await job('naver:fchart:week', async () => (await appendNew(paths.weekly, await fetchNaverWeeklyBars(symbol, 260, fetchOptions), priceKey)).length);
  await job('naver:fchart:minute', async () => (await appendNew(paths.intraday, await fetchNaverIntraday(symbol, fetchOptions), intradayKey)).length);
  for (const b of benchmarks) {
    await job(`naver:fchart:day:${b.symbol}`, async () => (await appendNew(paths.daily(b.symbol), await fetchNaverDailyBars(b.symbol, 250, fetchOptions), priceKey)).length);
  }
  await job('naver:m-stock', async () => {
    const data = await fetchNaverStockData(symbol, kstDate, fetchOptions);
    const added = [
      await appendNew(paths.flows, data.flows, flowKey),
      await appendNew(paths.snapshots, [data.snapshot], snapshotKey),
      await appendNew(paths.finance, data.finance, financeKey),
      await appendUnseen(paths.research, data.research, researchKey),
    ];
    return added.reduce((n, a) => n + a.length, 0);
  });
  return status;
}
