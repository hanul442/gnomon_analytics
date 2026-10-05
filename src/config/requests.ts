// Report requests (docs/DESIGN.md §5.11): stocks, ETFs and coins (KRW-XXX, G-56) someone asked a report for.
// For now the list is requests.json at the repository root; credit-paid
// requests will append to the same queue later (G-24).

import { readFile } from 'node:fs/promises';

export interface ReportRequest { symbol: string; requestedAt: string; note?: string }

export function parseRequests(raw: unknown): ReportRequest[] {
  if (!Array.isArray(raw)) throw new Error('requests: an array is required');
  return raw.map((r: Partial<ReportRequest>, i) => {
    if (typeof r.symbol !== 'string' || !/^([0-9A-Z]{6}|KRW-[A-Z0-9]{1,15})$/.test(r.symbol)) throw new Error(`requests[${i}]: symbol must be a 6-character KRX code (stock or ETF) or an Upbit KRW market`);
    if (typeof r.requestedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.requestedAt)) throw new Error(`requests[${i}]: requestedAt must be YYYY-MM-DD`);
    return { symbol: r.symbol, requestedAt: r.requestedAt, ...(typeof r.note === 'string' ? { note: r.note } : {}) };
  });
}

/** A missing file means no requests. */
export async function loadRequests(path: string): Promise<ReportRequest[]> {
  const text = await readFile(path, 'utf8').catch(() => null);
  return text === null ? [] : parseRequests(JSON.parse(text));
}
