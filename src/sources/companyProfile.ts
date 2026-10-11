// G-200: the company card (회사 정보) for a Korean stock, the way Toss shows it: what the company does, where it
// ranks by market value in its industry, and what its sales are made of. Keyless sources only:
//  - WiseReport (FnGuide data behind Naver's 종목분석): 기업개요 sentences, the WICS sector, 주요제품 매출구성.
//  - Naver m.stock: the logo and market (basic), the industry number (integration) and that industry's stocks.
// A part that fails only blanks itself; no part at all is null.

const WISE = 'https://navercomp.wisereport.co.kr/v2/company';
const NAVER = 'https://m.stock.naver.com/api';
const UA = 'Mozilla/5.0 (compatible; GnomonAnalytics/1.0; +https://hanul442.github.io/gnomon_analytics/)';

export interface CompanyProfile {
  code: string;
  name: string;
  /** KOSPI / KOSDAQ, or null when Naver did not say. */
  market: '코스피' | '코스닥' | null;
  logo: string | null;
  /** 기업개요 sentences, as WiseReport writes them, and the date they were written (YYYY-MM-DD). */
  summary: string[];
  summaryAsOf: string | null;
  /** WICS sector name (e.g. 반도체와반도체장비). */
  sector: string | null;
  /** Naver industry: name, how many common stocks it has, this stock's rank by market value, and the top three. */
  industry: { no: string; name: string; count: number; rank: number | null; top: [string, string, number][] } | null;
  /** 주요제품 매출구성: [product, % of sales] as reported (internal sales can push the sum past 100), and its period. */
  mix: { asOf: string | null; items: [string, number][] } | null;
  source: 'wisereport+naver';
  at: string;
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

/** 기업현황 (c1010001): the overview sentences, their date, and the WICS sector. */
export function parseWiseOverview(html: string): { summary: string[]; asOf: string | null; sector: string | null } {
  const summary = [...html.matchAll(/<li class="dot_cmp"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]!)).filter((s) => s.length > 3).slice(0, 6);
  const d = /\[기준:(\d{4})\.(\d{2})\.(\d{2})\]/.exec(html);
  const w = /WICS\s*:\s*([^<]+)</.exec(html);
  return { summary, asOf: d ? `${d[1]}-${d[2]}-${d[3]}` : null, sector: w ? text(w[1]!) || null : null };
}

/** 기업개요 (c1020001): the 주요제품 매출구성 pie's data and its period ("2026 / 06" → 2026-06). */
export function parseWiseMix(html: string): { asOf: string | null; items: [string, number][] } | null {
  const m = /var chartData1\s*=\s*(\[[\s\S]*?\]);/.exec(html);
  if (!m) return null;
  let rows: unknown;
  try { rows = JSON.parse(m[1]!); } catch { return null; }
  if (!Array.isArray(rows)) return null;
  const items = rows.flatMap((r): [string, number][] => (Array.isArray(r) && typeof r[0] === 'string' && typeof r[1] === 'number' && Number.isFinite(r[1]) && r[1] > 0 ? [[text(r[0]), r[1]]] : []))
    .sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!items.length) return null;
  const p = /매출구성\((\d{4})\s*\/\s*(\d{2})\)/.exec(html);
  return { asOf: p ? `${p[1]}-${p[2]}` : null, items };
}

/** Naver's industry list → this stock's rank by market value among the industry's common stocks (preferred shares, whose codes do not end in 0, are left out). */
export function rankInIndustry(pages: unknown[], code: string): { name: string; no: string; count: number; rank: number | null; top: [string, string, number][] } | null {
  const first = pages[0] as { groupInfo?: { no?: unknown; name?: unknown } } | undefined;
  const name = String(first?.groupInfo?.name ?? '').trim();
  if (!name) return null;
  const stocks = pages.flatMap((p) => ((p as { stocks?: Record<string, unknown>[] })?.stocks ?? []))
    .map((s) => [String(s.itemCode ?? ''), String(s.stockName ?? ''), Number(String(s.marketValue ?? '').replace(/,/g, ''))] as [string, string, number])
    .filter((s) => /^[0-9][0-9A-Z]{4}0$/.test(s[0]) && Number.isFinite(s[2]) && s[2] > 0);
  const seen = new Set<string>(), uniq = stocks.filter((s) => !seen.has(s[0]) && seen.add(s[0])).sort((a, b) => b[2] - a[2]);
  const at = uniq.findIndex((s) => s[0] === code);
  return { name, no: String(first?.groupInfo?.no ?? ''), count: uniq.length, rank: at >= 0 ? at + 1 : null, top: uniq.slice(0, 3) };
}

/** One industry's pages, shared by every stock in it for a day (G-200): the list is the same whichever stock asks. */
export type IndustryMemo = Map<string, { at: number; pages: Promise<unknown[] | null> }>;

/**
 * One company card; null when no source knows the code (or it is an ETF); throws when the sources are down.
 * `partial` is set when some source was down, so the caller keeps the card only briefly.
 */
export async function fetchCompanyProfile(code: string, doFetch: typeof fetch, at = new Date(), industries?: IndustryMemo): Promise<(CompanyProfile & { partial?: true }) | null> {
  if (!/^[0-9][0-9A-Z]{5}$/.test(code)) throw new Error('BAD_CODE');
  // A source that is down (5xx, timeout) is told apart from one that has nothing, so an outage is not kept as "no company".
  let down = 0;
  const get = (url: string, json: boolean) => doFetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': UA, Accept: json ? 'application/json' : 'text/html' } })
    .then((r) => { if (r.status >= 500) down++; return r.ok ? (json ? r.json() as Promise<unknown> : r.text()) : null; }).catch(() => { down++; return null; });
  // Naver's basic first: an ETF has no company card, and that costs one call instead of five.
  const basic = await get(`${NAVER}/stock/${code}/basic`, true) as Record<string, unknown> | null;
  if (basic && String(basic.stockEndType ?? 'stock') !== 'stock') return null;
  const [w1, w2, integ] = await Promise.all([
    get(`${WISE}/c1010001.aspx?cmp_cd=${code}`, false) as Promise<string | null>,
    get(`${WISE}/c1020001.aspx?cmp_cd=${code}`, false) as Promise<string | null>,
    get(`${NAVER}/stock/${code}/integration`, true) as Promise<Record<string, unknown> | null>,
  ]);
  const over = w1 ? parseWiseOverview(w1) : { summary: [], asOf: null, sector: null };
  const mix = w2 ? parseWiseMix(w2) : null;
  const name = String(basic?.stockName ?? integ?.stockName ?? '').trim();
  if (!name && !over.summary.length && !mix) { if (down) throw new Error('COMPANY_UPSTREAM'); return null; }
  // The industry list is paged (100 a page; four pages cover every industry Naver has). A missing page would
  // give a wrong rank, so the whole list or nothing; a complete list is shared for a day.
  let industry: CompanyProfile['industry'] = null;
  const ino = String(integ?.industryCode ?? '');
  if (/^\d{1,5}$/.test(ino)) {
    const memo = industries?.get(ino);
    let pages = memo && at.getTime() - memo.at < 24 * 3600_000 ? memo.pages : null;
    if (!pages) {
      // Resolves to the pages, [] when Naver has no list for it, or null when a page could not be fetched.
      const one = (page: number) => doFetch(`${NAVER}/stocks/industry/${ino}?page=${page}&pageSize=100`, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': UA, Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() as Promise<unknown> : r.status >= 500 ? null : 'none')).catch(() => null);
      pages = (async () => {
        const p1 = await one(1) as { totalCount?: unknown } | 'none' | null;
        if (p1 === 'none') return [];
        if (!p1) return null;
        const total = Math.min(400, Number(p1.totalCount) || 0), more: Promise<unknown>[] = [];
        for (let p = 2; (p - 1) * 100 < total; p++) more.push(one(p));
        const rest = await Promise.all(more);
        return rest.every((x) => x && x !== 'none') ? [p1, ...rest] : null;
      })();
      if (industries) {
        if (industries.size >= 200) industries.clear();
        const entry = { at: at.getTime(), pages };
        industries.set(ino, entry);
        pages.then((x) => { if (!x && industries.get(ino) === entry) industries.delete(ino); }, () => { if (industries.get(ino) === entry) industries.delete(ino); });
      }
    }
    const got = await pages.catch(() => null);
    if (got) industry = got.length ? rankInIndustry(got, code) : null; else down++;
  }
  const sosok = String(basic?.sosok ?? '');
  const logo = String(basic?.itemLogoPngUrl ?? basic?.itemLogoUrl ?? '');
  return {
    code, name: name || code, market: sosok === '0' ? '코스피' : sosok === '1' ? '코스닥' : null,
    logo: /^https:\/\/ssl\.pstatic\.net\//.test(logo) ? logo : null,
    summary: over.summary, summaryAsOf: over.asOf, sector: over.sector, industry, mix,
    source: 'wisereport+naver', at: at.toISOString(),
    ...(down ? { partial: true as const } : {}),
  };
}
