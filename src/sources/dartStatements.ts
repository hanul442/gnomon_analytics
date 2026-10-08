// G-140: full financial statements (손익계산서 · 재무상태표 · 현금흐름표) from OpenDART
// fnlttSinglAcntAll.json. One annual business report carries three fiscal years (당기 · 전기 · 전전기),
// so a single call per company is usually enough. Consolidated (CFS) first, separate (OFS) when a company
// files no consolidated statements.

export const DART_STATEMENTS_SOURCE = 'opendart:fnlttSinglAcntAll';

export type StatementKind = 'IS' | 'BS' | 'CF';

export interface StatementRow {
  /** XBRL account id, e.g. ifrs-full_Revenue (kept for picking key rows). */
  id: string;
  name: string;
  /** Values for `years`, oldest first; null when DART gives none. KRW. */
  values: (number | null)[];
}

export interface FullStatements {
  symbol: string;
  /** Fiscal years, oldest first, e.g. ['2023', '2024', '2025']. */
  years: string[];
  /** CFS 연결 or OFS 별도. */
  basis: 'CFS' | 'OFS';
  receiptNo: string;
  statements: Record<StatementKind, StatementRow[]>;
  source: typeof DART_STATEMENTS_SOURCE;
  retrievedAt: string;
}

/** "1,234" · "-1234" · "(1234)" · "" → number | null. */
export function dartAmount(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/,/g, '');
  if (!s || s === '-') return null;
  const neg = /^\(.*\)$/.test(s);
  const n = Number(neg ? s.slice(1, -1) : s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/** Parses one fnlttSinglAcntAll response. Returns null when the company filed nothing for that year/basis. */
export function parseDartStatements(body: unknown, symbol: string, basis: 'CFS' | 'OFS', retrievedAt: Date): FullStatements | null {
  if (!body || typeof body !== 'object') throw new Error('DART_UNEXPECTED_RESPONSE');
  const b = body as { status?: string; list?: Record<string, string>[] };
  if (b.status === '013') return null;
  if (b.status !== '000' || !Array.isArray(b.list)) throw new Error(`DART_STATUS_${b.status ?? 'NONE'}`);
  const year = Number(b.list[0]?.bsns_year);
  if (!Number.isFinite(year)) return null;
  const years = [String(year - 2), String(year - 1), String(year)];
  const hasIS = b.list.some((r) => r.sj_div === 'IS');
  const out: Record<StatementKind, StatementRow[]> = { IS: [], BS: [], CF: [] };
  const seen = new Set<string>();
  const rows = [...b.list].sort((x, y) => Number(x.ord ?? 0) - Number(y.ord ?? 0));
  for (const r of rows) {
    // 포괄손익계산서 stands in for the income statement when a company files only the combined one.
    const kind: StatementKind | null = r.sj_div === 'BS' ? 'BS' : r.sj_div === 'CF' ? 'CF' : r.sj_div === 'IS' || (r.sj_div === 'CIS' && !hasIS) ? 'IS' : null;
    if (!kind) continue;
    const name = String(r.account_nm ?? '').trim();
    const id = String(r.account_id ?? '').trim();
    // Detail lines ("연결재무제표 [member]") repeat totals; keep the plain account once.
    if (!name || (r.account_detail && r.account_detail !== '-')) continue;
    const key = `${kind}:${id && id !== '-표준계정코드 미사용-' ? id : name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out[kind].push({ id: id.startsWith('-') ? '' : id, name, values: [dartAmount(r.bfefrmtrm_amount), dartAmount(r.frmtrm_amount), dartAmount(r.thstrm_amount)] });
  }
  if (!out.IS.length && !out.BS.length && !out.CF.length) return null;
  return { symbol, years, basis, receiptNo: String(b.list[0]?.rcept_no ?? ''), statements: out, source: DART_STATEMENTS_SOURCE, retrievedAt: retrievedAt.toISOString() };
}

/**
 * The newest annual statements: this year's business report once filed (around March), otherwise last
 * year's. Tries consolidated, then separate. At most four calls.
 */
export async function fetchDartStatements(options: { apiKey: string; corpCode: string; symbol: string; fetch?: typeof fetch; now?: () => Date }): Promise<FullStatements | null> {
  if (!options.apiKey.trim()) throw new Error('OPENDART_API_KEY_MISSING');
  const now = (options.now ?? (() => new Date()))();
  const latest = now.getUTCFullYear() - 1;
  for (const year of [latest, latest - 1]) {
    for (const basis of ['CFS', 'OFS'] as const) {
      const url = new URL('https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json');
      url.searchParams.set('crtfc_key', options.apiKey);
      url.searchParams.set('corp_code', options.corpCode);
      url.searchParams.set('bsns_year', String(year));
      url.searchParams.set('reprt_code', '11011');
      url.searchParams.set('fs_div', basis);
      const response = await (options.fetch ?? fetch)(url, { signal: AbortSignal.timeout(20_000) });
      // Never echo the URL: it carries the API key.
      if (!response.ok) throw new Error(`DART_HTTP_${response.status}`);
      const parsed = parseDartStatements(await response.json(), options.symbol, basis, now);
      if (parsed) return parsed;
    }
  }
  return null;
}
