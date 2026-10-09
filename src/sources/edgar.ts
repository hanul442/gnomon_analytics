// SEC EDGAR (G-179): the public filings, XBRL financials and Form 4 insider trades of a US company, read
// into the same shapes the Korean sources fill (Disclosure, FinancePeriod, InsiderReport) so every panel and
// the committee's evidence list work unchanged. SEC asks for a descriptive User-Agent and at most 10
// requests a second; one report makes about ten requests, one after another.
//
//   company_tickers.json  → CIK for a ticker (fetched once per daily run; the Worker gets it from u/<code>.json)
//   submissions/CIK….json → recent filings (8-K, 10-Q, 10-K, Form 4, 13D/G, S-3, DEF 14A …)
//   companyfacts/CIK….json → us-gaap facts; calendar-quarter frames become quarters, CY frames become years
//   Archives/…/form4.xml   → one insider report per Form 4 (open-market buys and sells only)

import type { Disclosure, FinancePeriod } from '../types.js';
import type { NewsSourceStatus } from '../report/dailyReport.js';
import type { InsiderReport } from '../analysis/edge.js';

export const EDGAR_SOURCE = 'sec:edgar';
export const EDGAR_FACTS_SOURCE = 'sec:edgar:xbrl';
export const EDGAR_FORM4_SOURCE = 'sec:edgar:form4';
/** SEC wants the app and a way to reach its operator; EDGAR_CONTACT (an email) is appended when set. */
export const edgarUserAgent = (contact?: string): string => `GNOMON research bot (https://github.com/hanul442/gnomon_analytics${contact ? `; ${contact}` : ''})`;

export const padCik = (cik: number | string): string => String(cik).replace(/\D/g, '').padStart(10, '0');
export const tickersUrl = 'https://www.sec.gov/files/company_tickers.json';
export const submissionsUrl = (cik: number | string): string => `https://data.sec.gov/submissions/CIK${padCik(cik)}.json`;
export const companyFactsUrl = (cik: number | string): string => `https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`;
/** A filing's document; the accession number loses its dashes in the path. */
export const archiveUrl = (cik: number | string, accession: string, doc = ''): string => `https://www.sec.gov/Archives/edgar/data/${Number(padCik(cik))}/${accession.replace(/-/g, '')}/${doc}`;

/** company_tickers.json: {"0":{"cik_str":320193,"ticker":"AAPL","title":"Apple Inc."},…} → CIK, or null when unlisted. */
export function cikFromTickers(body: unknown, ticker: string): number | null {
  if (!body || typeof body !== 'object') return null;
  const want = ticker.toUpperCase().replace(/\./g, '-');
  for (const row of Object.values(body as Record<string, { cik_str?: unknown; ticker?: unknown }>)) {
    if (String(row?.ticker ?? '').toUpperCase() === want) { const n = Number(row.cik_str); return Number.isFinite(n) && n > 0 ? n : null; }
  }
  return null;
}
/** The whole map at once (the daily run resolves 200 tickers from one download). */
export function cikMap(body: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!body || typeof body !== 'object') return out;
  for (const row of Object.values(body as Record<string, { cik_str?: unknown; ticker?: unknown }>)) {
    const n = Number(row?.cik_str), t = String(row?.ticker ?? '').toUpperCase();
    if (t && Number.isFinite(n) && n > 0) out.set(t, n);
  }
  return out;
}

// ---- filings ----

/** Forms worth a line in the 공시 table; anything else (e.g. 3, 5, SD, 11-K) stays out. */
const FORMS = new Set(['8-K', '8-K/A', '10-Q', '10-Q/A', '10-K', '10-K/A', '4', '4/A', 'SC 13D', 'SC 13D/A', 'SC 13G', 'SC 13G/A', 'S-1', 'S-1/A', 'S-3', 'S-3/A', 'S-3ASR', 'S-8', '424B2', '424B3', '424B4', '424B5', '424B7', 'DEF 14A', 'DEFA14A', '144', '6-K', '20-F', '40-F', '10-Q/A', 'NT 10-K', 'NT 10-Q']);
/** 8-K items, most telling first; the first match names the filing (classify.ts reads these titles). */
const ITEMS: readonly [RegExp, string][] = [
  [/\b2\.02\b/, '실적 발표'], [/\b4\.02\b/, '재무제표 신뢰 불가'], [/\b1\.01\b/, '주요 계약'], [/\b2\.01\b/, '자산 취득·처분'], [/\b1\.03\b/, '파산·법정관리'],
  [/\b2\.03\b/, '자금 조달·채무'], [/\b3\.02\b/, '비등록 증권 발행'], [/\b2\.05\b/, '구조조정'], [/\b2\.06\b/, '자산 손상'], [/\b3\.01\b/, '상장 기준 미달 통지'],
  [/\b4\.01\b/, '감사인 변경'], [/\b5\.02\b/, '임원 변동'], [/\b5\.03\b/, '정관 변경'], [/\b5\.07\b/, '주주총회 결과'], [/\b7\.01\b/, 'Reg FD 공개'], [/\b8\.01\b/, '기타 사항'],
];
const FORM_LABEL: Record<string, string> = {
  '10-Q': '분기보고서', '10-K': '사업보고서', '4': '임원·주요주주 거래 보고', 'SC 13D': '5% 이상 보유 보고', 'SC 13G': '5% 이상 보유 보고', 'S-1': '증권 발행 등록', 'S-3': '증권 발행 등록',
  'S-3ASR': '증권 발행 등록', 'S-8': '임직원 주식 등록', '424B': '증권 발행 설명서', 'DEF 14A': '주주총회 위임장', 'DEFA14A': '주주총회 위임장 추가', '144': '제한 주식 매도 신고', '6-K': '외국 기업 수시 보고',
  '20-F': '외국 기업 연차보고서', '40-F': '외국 기업 연차보고서', 'NT 10-K': '사업보고서 지연 통지', 'NT 10-Q': '분기보고서 지연 통지',
};
/** A Korean title that classify.ts reads: "실적 발표 (8-K 2.02, 9.01)", "분기보고서 (10-Q)", "[정정] 사업보고서 (10-K/A)". */
export function edgarTitle(form: string, items = ''): string {
  const base = form.replace(/\/A$/, ''), amended = /\/A$/.test(form);
  const list = items.split(/[,\s]+/).filter(Boolean);
  const label = base === '8-K' ? (ITEMS.find(([re]) => list.some((it) => re.test(it)))?.[1] ?? '수시 보고') : (FORM_LABEL[base] ?? FORM_LABEL[base.replace(/\d$/, '')] ?? base);
  return `${amended ? '[정정] ' : ''}${label} (${base === '4' ? 'Form 4' : base === '144' ? 'Form 144' : base}${amended ? '/A' : ''}${list.length ? ` ${list.join(', ')}` : ''})`;
}

export interface EdgarFilings { name: string; disclosures: Disclosure[]; form4: { accession: string; date: string; doc: string }[] }

/** submissions/CIK….json → the filings since `since` (YYYY-MM-DD) as Disclosures, plus the Form 4s to open. */
export function parseSubmissions(body: unknown, input: { symbol: string; cik: number; retrievedAt: Date; since: string; form4Since?: string }): EdgarFilings {
  const b = body as { name?: unknown; filings?: { recent?: Record<string, unknown[]> } };
  const r = b?.filings?.recent;
  if (!r || !Array.isArray(r.form) || !Array.isArray(r.accessionNumber)) throw new Error('EDGAR_UNEXPECTED_RESPONSE');
  const name = String(b.name ?? input.symbol), at = input.retrievedAt.toISOString();
  const col = (k: string, i: number) => String(r[k]?.[i] ?? '');
  const disclosures: Disclosure[] = [], form4: EdgarFilings['form4'] = [];
  for (let i = 0; i < r.form.length; i += 1) {
    const form = col('form', i), date = col('filingDate', i), acc = col('accessionNumber', i), doc = col('primaryDocument', i);
    if (!FORMS.has(form) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !acc) continue;
    if (form === '4' || form === '4/A') {
      if (date >= (input.form4Since ?? input.since) && doc) form4.push({ accession: acc, date, doc: doc.replace(/^xsl[^/]*\//, '') });
    }
    if (date < input.since) continue;
    disclosures.push({ receiptNo: acc, corpName: name, stockCode: input.symbol, title: edgarTitle(form, col('items', i)), filer: name, filedDate: date, remark: form, url: archiveUrl(input.cik, acc, doc), source: EDGAR_SOURCE, retrievedAt: at });
  }
  return { name, disclosures, form4 };
}

// ---- XBRL company facts → FinancePeriod (백만 달러; EPS and dividends per share in dollars) ----

type FactKind = 'duration' | 'instant' | 'perShare';
const METRICS: readonly [string, readonly string[], FactKind][] = [
  ['매출액', ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'RevenuesNetOfInterestExpense'], 'duration'],
  ['영업이익', ['OperatingIncomeLoss'], 'duration'],
  ['당기순이익', ['NetIncomeLoss', 'ProfitLoss'], 'duration'],
  ['영업현금흐름', ['NetCashProvidedByUsedInOperatingActivities'], 'duration'],
  ['자산총계', ['Assets'], 'instant'],
  ['부채총계', ['Liabilities'], 'instant'],
  ['자본총계', ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'], 'instant'],
  ['현금', ['CashAndCashEquivalentsAtCarryingValue'], 'instant'],
  ['유동자산', ['AssetsCurrent'], 'instant'],
  ['유동부채', ['LiabilitiesCurrent'], 'instant'],
  ['EPS', ['EarningsPerShareDiluted', 'EarningsPerShareBasic'], 'perShare'],
  ['주당배당금', ['CommonStockDividendsPerShareDeclared'], 'perShare'],
];
interface Fact { end: string; start?: string; val: number; fy?: number; fp?: string; form?: string; filed?: string; frame?: string }
const MILLION = 1e6;

/** CY2026Q2 → 202606 (quarter); CY2025 → 202512 (year); the trailing I marks an instant. */
function periodOfFrame(frame: string): { period: string; type: 'QUARTER' | 'ANNUAL' } | null {
  const m = /^CY(\d{4})(?:Q([1-4]))?I?$/.exec(frame);
  if (!m) return null;
  return m[2] ? { period: `${m[1]}${String(Number(m[2]) * 3).padStart(2, '0')}`, type: 'QUARTER' } : { period: `${m[1]}12`, type: 'ANNUAL' };
}
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

/**
 * companyfacts/CIK….json → quarters and years. Calendar frames are SEC's own de-duplicated view of each period;
 * a company whose fiscal year is not the calendar year (Apple, Microsoft …) has no CY frame for its years, so
 * those come from the 10-K facts themselves (fp FY, a year-long duration). Values are divided to 백만 달러
 * and the ratio rows (영업이익률·순이익률·부채비율·ROE) are computed here, as Naver gives them for Korean stocks.
 */
export function parseCompanyFacts(body: unknown, symbol: string, retrievedAt: Date): FinancePeriod[] {
  const gaap = (body as { facts?: { 'us-gaap'?: Record<string, { units?: Record<string, Fact[]> }> } })?.facts?.['us-gaap'];
  if (!gaap || typeof gaap !== 'object') throw new Error('EDGAR_FACTS_UNEXPECTED');
  // The fiscal year's last month, from the 10-K's year-long income facts (Apple: 9, most companies: 12).
  const fyMonth = fiscalMonth(gaap);
  const at = retrievedAt.toISOString();
  const periods = new Map<string, FinancePeriod>();
  const slot = (period: string, type: 'QUARTER' | 'ANNUAL') => {
    const key = `${type}:${period}`;
    let p = periods.get(key);
    if (!p) { p = { symbol, periodType: type, period, isEstimate: false, metrics: {}, source: EDGAR_FACTS_SOURCE, retrievedAt: at }; periods.set(key, p); }
    return p;
  };
  for (const [metric, tags, kind] of METRICS) {
    const tag = tags.find((t) => gaap[t]?.units);
    if (!tag) continue;
    const units = gaap[tag]!.units!;
    const facts = (kind === 'perShare' ? units['USD/shares'] : units['USD']) ?? [];
    const scale = kind === 'perShare' ? 1 : MILLION;
    // Newest filing wins when the same period was restated.
    const sorted = [...facts].filter((f) => Number.isFinite(f.val) && /^\d{4}-\d{2}-\d{2}$/.test(f.end)).sort((a, b) => ((a.filed ?? '') < (b.filed ?? '') ? -1 : 1));
    const yearsSeen = new Set<string>();
    for (const f of sorted) {
      const fr = f.frame ? periodOfFrame(f.frame) : null;
      if (fr) {
        // Calendar frames describe a calendar year; only a December fiscal year reads its years from them.
        if (fr.type === 'ANNUAL' && fyMonth !== 12) continue;
        if (kind === 'instant' && fr.type === 'QUARTER' && fyMonth === 12 && f.frame!.endsWith('Q4I')) slot(`${fr.period.slice(0, 4)}12`, 'ANNUAL').metrics[metric] = f.val / scale;
        slot(fr.period, fr.type).metrics[metric] = f.val / scale;
        if (fr.type === 'ANNUAL') yearsSeen.add(fr.period.slice(0, 4));
      }
    }
    // Fiscal years without a calendar frame: the 10-K's own year-long (or year-end) facts.
    for (const f of sorted) {
      if (f.fp !== 'FY' || !/^10-K/.test(f.form ?? '')) continue;
      if (kind !== 'instant' && (!f.start || Math.abs(days(f.start, f.end) - 365) > 20)) continue;
      const period = f.end.slice(0, 7).replace('-', '');
      if (yearsSeen.has(period.slice(0, 4))) continue;
      slot(period, 'ANNUAL').metrics[metric] = f.val / scale;
    }
  }
  for (const p of periods.values()) {
    const m = p.metrics, rev = m['매출액'], op = m['영업이익'], net = m['당기순이익'], debt = m['부채총계'], eq = m['자본총계'];
    if (rev && op != null) m['영업이익률'] = (op / rev) * 100;
    if (rev && net != null) m['순이익률'] = (net / rev) * 100;
    if (eq && debt != null) m['부채비율'] = (debt / eq) * 100;
    if (p.periodType === 'ANNUAL' && eq && net != null) m['ROE'] = (net / eq) * 100;
    if (eq == null && m['자산총계'] != null && debt != null) m['자본총계'] = m['자산총계']! - debt;
  }
  // Only periods with an income line or a balance sheet; the last eight quarters and five years.
  // Only periods with an income line: a balance sheet alone (a Q4 instant, a stray year-end) is not a period to show.
  const keep = [...periods.values()].filter((p) => p.metrics['매출액'] != null || p.metrics['당기순이익'] != null).sort((a, b) => (a.period < b.period ? -1 : 1));
  return [...keep.filter((p) => p.periodType === 'QUARTER').slice(-8), ...keep.filter((p) => p.periodType === 'ANNUAL').slice(-5)];
}

function fiscalMonth(gaap: Record<string, { units?: Record<string, Fact[]> }>): number {
  const count = new Map<number, number>();
  for (const tag of ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'NetIncomeLoss', 'OperatingIncomeLoss']) {
    for (const f of gaap[tag]?.units?.['USD'] ?? []) {
      if (f.fp !== 'FY' || !/^10-K/.test(f.form ?? '') || !f.start || Math.abs(days(f.start, f.end) - 365) > 20) continue;
      const m = Number(f.end.slice(5, 7)); count.set(m, (count.get(m) ?? 0) + 1);
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 12;
}

// ---- Form 4 → InsiderReport ----

const xmlTag = (block: string, name: string): string | null => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  return m ? m[1]!.trim() : null;
};
const xmlValue = (block: string, name: string): string | null => { const inner = xmlTag(block, name); return inner == null ? null : (xmlTag(inner, 'value') ?? inner).trim(); };
const flag = (block: string, name: string) => /^(1|true)$/i.test(xmlValue(block, name) ?? '');

/**
 * One Form 4 → one report per reporting owner: open-market purchases (code P) and sales (S) summed, the
 * shares held afterwards, and the owner's role. Grants, option exercises and tax withholding are not trades.
 */
export function parseForm4(xml: string, input: { symbol: string; receiptNo: string; filedDate: string; retrievedAt: Date; url?: string }): InsiderReport[] {
  if (!/<ownershipDocument/i.test(xml)) throw new Error('EDGAR_FORM4_UNEXPECTED');
  const owners = [...xml.matchAll(/<reportingOwner>([\s\S]*?)<\/reportingOwner>/gi)].map((m) => m[1]!);
  if (!owners.length) return [];
  const first = owners[0]!;
  const reporter = xmlValue(first, 'rptOwnerName') ?? '보고자', title = xmlValue(first, 'officerTitle') ?? '';
  const isOfficer = flag(first, 'isOfficer'), isDirector = flag(first, 'isDirector'), isMajor = flag(first, 'isTenPercentOwner');
  const position = title || (isDirector ? '이사' : isMajor ? '10% 이상 주주' : isOfficer ? '임원' : '관계인');
  let delta = 0, shares: number | null = null, last = '', traded = false;
  for (const m of xml.matchAll(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/gi)) {
    const t = m[1]!, code = (xmlValue(t, 'transactionCode') ?? '').toUpperCase();
    const n = Number(xmlValue(t, 'transactionShares')), ad = (xmlValue(t, 'transactionAcquiredDisposedCode') ?? '').toUpperCase();
    const after = Number(xmlValue(t, 'sharesOwnedFollowingTransaction')), date = xmlValue(t, 'transactionDate') ?? '';
    if (Number.isFinite(after)) shares = after;
    if (date > last) last = date;
    if (code !== 'P' && code !== 'S') continue;
    if (!Number.isFinite(n) || n <= 0) continue;
    delta += ad === 'D' ? -n : n;
    traded = true;
  }
  if (!traded) return [];
  return [{ symbol: input.symbol, receiptNo: input.receiptNo, date: /^\d{4}-\d{2}-\d{2}$/.test(last) ? last : input.filedDate, reporter, position, isExec: isOfficer || isDirector, isMajor, shares, delta: Math.round(delta), ratio: null, retrievedAt: input.retrievedAt.toISOString(), ...(input.url ? { url: input.url } : {}) }];
}

// ---- fetching ----

export interface EdgarResult { cik: number | null; name: string | null; disclosures: Disclosure[]; finance: FinancePeriod[]; insider: InsiderReport[]; status: NewsSourceStatus[] }

const DAY = 86_400_000;
const before = (now: Date, d: number) => new Date(now.getTime() - d * DAY).toISOString().slice(0, 10);

/**
 * Everything EDGAR has for one ticker, best effort per source (a failed part is a status row, never a throw).
 * `cik` skips the 1 MB ticker map; the daily run passes it from the universe file.
 */
export async function fetchEdgar(input: { symbol: string; ticker: string; cik?: number | null; fetch?: typeof fetch; now?: () => Date; contact?: string; form4Limit?: number; sinceDays?: number }): Promise<EdgarResult> {
  const f = input.fetch ?? fetch, now = (input.now ?? (() => new Date()))(), ua = edgarUserAgent(input.contact);
  const get = async (url: string, accept = 'application/json') => {
    const r = await f(url, { headers: { 'User-Agent': ua, Accept: accept, 'Accept-Encoding': 'gzip, deflate' }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`EDGAR_HTTP_${r.status}`);
    return accept === 'application/json' ? r.json() : r.text();
  };
  const status: NewsSourceStatus[] = [];
  const out: EdgarResult = { cik: input.cik ?? null, name: null, disclosures: [], finance: [], insider: [], status };
  const fail = (source: string, e: unknown) => status.push({ source, ok: false, count: 0, error: e instanceof Error ? e.message.slice(0, 80) : 'UNKNOWN' });
  if (!out.cik) {
    try { out.cik = cikFromTickers(await get(tickersUrl), input.ticker); if (!out.cik) throw new Error('EDGAR_NO_CIK'); } catch (e) { fail(EDGAR_SOURCE, e); return out; }
  }
  const cik = out.cik;
  let form4: EdgarFilings['form4'] = [];
  try {
    const parsed = parseSubmissions(await get(submissionsUrl(cik)), { symbol: input.symbol, cik, retrievedAt: now, since: before(now, input.sinceDays ?? 180), form4Since: before(now, 90) });
    out.name = parsed.name; out.disclosures = parsed.disclosures; form4 = parsed.form4;
    status.push({ source: EDGAR_SOURCE, ok: true, count: parsed.disclosures.length });
  } catch (e) { fail(EDGAR_SOURCE, e); }
  try {
    out.finance = parseCompanyFacts(await get(companyFactsUrl(cik)), input.symbol, now);
    status.push({ source: EDGAR_FACTS_SOURCE, ok: true, count: out.finance.length });
  } catch (e) { fail(EDGAR_FACTS_SOURCE, e); }
  let opened = 0, failed = 0;
  for (const x of form4.slice(0, input.form4Limit ?? 6)) {
    try { out.insider.push(...parseForm4(await get(archiveUrl(cik, x.accession, x.doc), 'application/xml') as string, { symbol: input.symbol, receiptNo: x.accession, filedDate: x.date, retrievedAt: now, url: archiveUrl(cik, x.accession) })); opened += 1; } catch { failed += 1; }
  }
  if (form4.length) status.push({ source: EDGAR_FORM4_SOURCE, ok: failed === 0, count: out.insider.length, ...(failed ? { error: `${failed} of ${opened + failed} failed` } : {}) });
  return out;
}
