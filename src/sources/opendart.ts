// Filings from OpenDART (https://opendart.fss.or.kr), list.json endpoint.

import type { Disclosure } from '../types.js';

export const OPENDART_SOURCE = 'opendart:list';

interface DartListRow {
  corp_name?: unknown;
  stock_code?: unknown;
  report_nm?: unknown;
  rcept_no?: unknown;
  flr_nm?: unknown;
  rcept_dt?: unknown;
  rm?: unknown;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function isoDate(yyyymmdd: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(yyyymmdd);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function dartViewerUrl(receiptNo: string): string {
  return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${encodeURIComponent(receiptNo)}`;
}

/**
 * Parses a list.json response. Status 013 means "no filings" and is an empty
 * list; any other non-000 status is an error (bad key, quota, outage).
 */
export function parseDartList(body: unknown, retrievedAt: Date): { filings: Disclosure[]; totalPages: number } {
  if (body === null || typeof body !== 'object') throw new Error('DART_UNEXPECTED_RESPONSE');
  const record = body as Record<string, unknown>;
  const status = text(record.status);
  if (status === '013') return { filings: [], totalPages: 0 };
  if (status !== '000') throw new Error(`DART_STATUS_${status || 'MISSING'}:${text(record.message).slice(0, 120)}`);
  if (!Array.isArray(record.list)) throw new Error('DART_UNEXPECTED_RESPONSE');
  const filings: Disclosure[] = [];
  for (const raw of record.list as DartListRow[]) {
    const receiptNo = text(raw?.rcept_no);
    const filedDate = isoDate(text(raw?.rcept_dt));
    const title = text(raw?.report_nm);
    if (!/^\d{14}$/.test(receiptNo) || !filedDate || !title) continue;
    filings.push({
      receiptNo,
      corpName: text(raw.corp_name),
      stockCode: text(raw.stock_code),
      title,
      filer: text(raw.flr_nm),
      filedDate,
      remark: text(raw.rm),
      url: dartViewerUrl(receiptNo),
      source: OPENDART_SOURCE,
      retrievedAt: retrievedAt.toISOString(),
    });
  }
  const totalPages = Number(record.total_page);
  return { filings, totalPages: Number.isFinite(totalPages) ? totalPages : 1 };
}

export async function fetchDartFilings(
  options: {
    apiKey: string;
    /** One company; leave out for every company's filings (then narrow with corpClass). */
    corpCode?: string;
    /** Y 유가증권(KOSPI), K 코스닥. */
    corpClass?: 'Y' | 'K';
    /** YYYYMMDD, inclusive. */
    from: string;
    to: string;
    fetch?: typeof fetch;
    now?: () => Date;
  },
): Promise<Disclosure[]> {
  if (!options.apiKey.trim()) throw new Error('OPENDART_API_KEY_MISSING');
  const all: Disclosure[] = [];
  const maxPages = options.corpCode ? 20 : 60;
  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL('https://opendart.fss.or.kr/api/list.json');
    url.searchParams.set('crtfc_key', options.apiKey);
    if (options.corpCode) url.searchParams.set('corp_code', options.corpCode);
    if (options.corpClass) url.searchParams.set('corp_cls', options.corpClass);
    url.searchParams.set('bgn_de', options.from);
    url.searchParams.set('end_de', options.to);
    url.searchParams.set('page_no', String(page));
    url.searchParams.set('page_count', '100');
    const response = await (options.fetch ?? fetch)(url, { signal: AbortSignal.timeout(20_000) });
    // Never echo the URL: it carries the API key.
    if (!response.ok) throw new Error(`DART_HTTP_${response.status}`);
    const { filings, totalPages } = parseDartList(await response.json(), (options.now ?? (() => new Date()))());
    all.push(...filings);
    if (page >= totalPages) break;
  }
  return all;
}
