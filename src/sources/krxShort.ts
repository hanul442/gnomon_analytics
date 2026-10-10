// G-195: short selling per stock from KRX's public short-selling screen (the one Naver embeds on its 공매도현황 tab;
// the rest of data.krx.co.kr now needs a login), the stock's daily volume from Naver for the short share, and the
// market's credit loans and customer deposits from Naver's 증시자금동향. No source we can reach gives a per-stock
// credit balance, so credit is market-wide. Keyless; a failed part only blanks itself.

const KRX = 'https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd';
const KRX_REFERER = 'https://data.krx.co.kr/comm/srt/srtLoader/index.cmd?screenId=MDCSTAT300';
const UA = 'Mozilla/5.0 (compatible; GnomonAnalytics/1.0; +https://hanul442.github.io/gnomon_analytics/)';

/** One trading day: [date, short volume, short value (원), net short balance (주, reported T+2), balance value (원)]. */
export type ShortDay = [string, number, number, number | null, number | null];

export interface ShortSnapshot {
  code: string;
  isin: string;
  /** Oldest first. */
  days: ShortDay[];
  /** [date, total volume] oldest first, for the short share of the day's trading. */
  volume: [string, number][];
  /** Market-wide [date, 고객예탁금 억원, 신용융자 잔고 억원] oldest first. */
  credit: [string, number, number][];
  source: 'krx+naver';
  at: string;
}

const n = (v: unknown): number | null => {
  const s = String(v ?? '').replace(/,/g, '').trim();
  if (!s || s === '-') return null;
  const x = Number(s);
  return Number.isFinite(x) ? x : null;
};
const ymd = (s: string) => (/^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s.replace(/\//g, '-'));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** KRX's finder answer → the ISIN for a six-character code, or null. */
export function parseKrxFinder(body: unknown, code: string): string | null {
  const rows = (body as { block1?: { full_code?: string; short_code?: string }[] } | null)?.block1;
  const hit = Array.isArray(rows) ? rows.find((r) => r.short_code === code) : undefined;
  return hit && /^KR[0-9A-Z]{10}$/.test(String(hit.full_code)) ? String(hit.full_code) : null;
}

export function parseKrxShort(body: unknown): ShortDay[] {
  const rows = (body as { OutBlock_1?: Record<string, unknown>[] } | null)?.OutBlock_1;
  if (!Array.isArray(rows)) throw new Error('KRX_SHORT_UNEXPECTED');
  return rows.flatMap((r): ShortDay[] => {
    const d = ymd(String(r.TRD_DD ?? '')), vol = n(r.CVSRTSELL_TRDVOL), val = n(r.CVSRTSELL_TRDVAL);
    return DATE.test(d) && vol != null && val != null ? [[d, vol, val, n(r.STR_CONST_VAL1), n(r.STR_CONST_VAL2)]] : [];
  }).sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** Naver m.stock /trend rows → [date, volume] oldest first. */
export function parseNaverVolume(body: unknown): [string, number][] {
  if (!Array.isArray(body)) return [];
  return body.flatMap((r: Record<string, unknown>): [string, number][] => {
    const d = ymd(String(r.bizdate ?? '')), v = n(r.accumulatedTradingVolume);
    return DATE.test(d) && v != null ? [[d, v]] : [];
  }).sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** Naver 증시자금동향 → [date, 고객예탁금, 신용융자] in 억원, oldest first. */
export function parseNaverDeposit(body: unknown): [string, number, number][] {
  const rows = (body as { content?: Record<string, unknown>[] } | null)?.content;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r): [string, number, number][] => {
    const d = ymd(String(r.bizdate ?? '')), dep = n(r.customerDeposit), cr = n(r.creditLoan);
    return DATE.test(d) && dep != null && cr != null ? [[d, dep, cr]] : [];
  }).sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

const compact = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '');

/** The market credit series is the same for every stock: one shared copy, refreshed hourly (G-196). */
export interface CreditMemo { at: number; rows: Promise<[string, number, number][]> | null }

/** About three months of short selling for a Korean stock code; null when KRX has no such code. */
export async function fetchKrxShort(code: string, doFetch: typeof fetch, at = new Date(), isinCache?: Map<string, string>, creditMemo?: CreditMemo): Promise<ShortSnapshot | null> {
  if (!/^[0-9][0-9A-Z]{5}$/.test(code)) throw new Error('BAD_CODE');
  const krx = (form: Record<string, string>) => doFetch(KRX, { method: 'POST', signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': UA, Referer: KRX_REFERER, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: new URLSearchParams({ locale: 'ko_KR', ...form }).toString() })
    .then((r) => { if (!r.ok) throw new Error(`KRX_HTTP_${r.status}`); return r.json() as Promise<unknown>; });
  const naver = (url: string) => doFetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': UA, Accept: 'application/json' } }).then((r) => (r.ok ? r.json() as Promise<unknown> : null)).catch(() => null);
  // Naver needs no ISIN: both start now, alongside the KRX lookup.
  const trend = naver(`https://m.stock.naver.com/api/stock/${code}/trend?pageSize=60`).then(parseNaverVolume);
  let credit: Promise<[string, number, number][]>;
  if (creditMemo && creditMemo.rows && at.getTime() - creditMemo.at < 3600_000) credit = creditMemo.rows;
  else {
    credit = naver('https://stock.naver.com/api/domestic/market/trendDeposit?startIdx=0&pageSize=60').then(parseNaverDeposit);
    if (creditMemo) { creditMemo.at = at.getTime(); creditMemo.rows = credit; credit.then((rows) => { if (!rows.length && creditMemo.rows === credit) creditMemo.rows = null; }); }
  }
  let isin = isinCache?.get(code) ?? null;
  if (!isin) {
    isin = parseKrxFinder(await krx({ bld: 'dbms/comm/finder/finder_srtisu', mktsel: 'ALL', searchText: code, typeNo: '0' }), code);
    if (!isin) return null;
    isinCache?.set(code, isin);
  }
  const from = new Date(at.getTime() - 95 * 864e5);
  const short = await krx({ bld: 'dbms/MDC_OUT/STAT/srt/MDCSTAT30001_OUT', isuCd: isin, strtDd: compact(from), endDd: compact(at), share: '1', money: '1', csvxls_isNo: 'false' });
  return { code, isin, days: parseKrxShort(short), volume: await trend, credit: await credit, source: 'krx+naver', at: at.toISOString() };
}
