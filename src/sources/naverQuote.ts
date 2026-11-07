// Real-time quotes for stocks and ETFs (docs/DESIGN.md §5.22, G-62): Naver Finance's polling feed, the
// one its own pages refresh from. Read through the API Worker (the browser cannot call it across
// origins). Coins do not come through here: the page talks to Upbit's public WebSocket directly.

/**
 * `session`: where the price comes from (G-128). Outside KRX hours (08:00–08:50, 15:30–20:00) a stock that also
 * trades on Nextrade (NXT) moves there; Naver's feed then carries both the KRX close and the NXT price.
 */
export interface Quote { symbol: string; price: number; change: number; changePct: number; open: boolean; at: string | null; session?: 'regular' | 'pre' | 'after' | 'closed' }

/** G-314: the KOSPI and KOSDAQ index from the same polling feed, for the home tiles while the market is open. */
export const INDEX_CODES = /^(KOSPI|KOSDAQ)$/;
export const indexQuoteUrl = (codes: readonly string[]) => `https://polling.finance.naver.com/api/realtime/domestic/index/${codes.join(',')}`;
export const quoteUrl = (symbols: readonly string[]) => `https://polling.finance.naver.com/api/realtime/domestic/stock/${symbols.join(',')}`;

/**
 * Evaluation 11/7: after 20:00 Naver's feed keeps the last Nextrade trade as the close (Samsung 193,500 while KRX
 * closed at 188,700), so the stock page showed two different closes. These read the 15:30 KRX close from the
 * minute chart, one tiny request per stock and day.
 */
export const krxCloseUrl = (symbol: string, date: string) => {
  const d = date.replace(/-/g, '');
  return `https://api.stock.naver.com/chart/domestic/item/${symbol}/minute?startDateTime=${d}1529&endDateTime=${d}1531`;
};
export function parseKrxClose(json: unknown): number | null {
  const rows = Array.isArray(json) ? (json as Record<string, unknown>[]) : [];
  const last = rows.filter((r) => /^\d{8}1530/.test(String(r.localDateTime ?? ''))).at(-1);
  const v = Number(last?.currentPrice);
  return v > 0 ? v : null;
}
/** A closed quote whose last trade came after 15:30 (Nextrade), with the KRX close in its place. Null when it needs nothing. */
export function nxtClosedDate(q: Quote): string | null {
  if (q.session !== 'closed' || !q.at) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(q.at);
  return m && `${m[2]}:${m[3]}` > '15:30' ? m[1]! : null;
}
export function withKrxClose(q: Quote, krx: number, date: string): Quote {
  const prev = q.price - q.change, change = krx - prev;
  return { ...q, price: krx, change, changePct: prev > 0 ? Math.round(change / prev * 10000) / 100 : q.changePct, at: `${date}T15:30:00+09:00` };
}

const n = (v: unknown) => {
  const x = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(x) ? x : NaN;
};

/** `datas` rows → quotes; rows without a price are skipped. The sign comes from compareToPreviousPrice. */
export function parseNaverQuotes(json: unknown, codes: RegExp = /^[0-9A-Z]{6}$/): Quote[] {
  const rows = (json as { datas?: unknown[] } | null)?.datas;
  if (!Array.isArray(rows)) return [];
  const out: Quote[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const symbol = String(r.itemCode ?? r.cd ?? ''), price = n(r.closePrice ?? r.nv);
    if (!codes.test(symbol) || !(price > 0)) continue;
    // Nextrade's pre/after market: its price is the live one while KRX is shut (G-128).
    const over = r.overMarketPriceInfo as Record<string, unknown> | null | undefined, overPrice = n(over?.overPrice);
    const sessionType = String(r.marketSessionType ?? '');
    if (over && String(over.overMarketStatus ?? '') === 'OPEN' && overPrice > 0 && /pre|after/i.test(sessionType)) {
      const d = (over.compareToPreviousPrice as { code?: string; name?: string } | undefined) ?? {};
      const down = d.code === '4' || d.code === '5' || /FALL|LOWER/i.test(d.name ?? '');
      const a = Math.abs(n(over.compareToPreviousClosePrice)), p = Math.abs(n(over.fluctuationsRatio));
      out.push({ symbol, price: overPrice, change: Number.isFinite(a) ? (down ? -a : a) : 0, changePct: Number.isFinite(p) ? (down ? -p : p) : 0, open: true,
        at: typeof over.localTradedAt === 'string' ? over.localTradedAt : null, session: /pre/i.test(sessionType) ? 'pre' : 'after' });
      continue;
    }
    const dir = (r.compareToPreviousPrice as { code?: string; name?: string } | undefined) ?? {};
    // Naver's codes: 1 upper limit, 2 rising, 3 flat, 4 lower limit, 5 falling.
    const falling = dir.code === '4' || dir.code === '5' || /FALL|LOWER/i.test(dir.name ?? '');
    const abs = Math.abs(n(r.compareToPreviousClosePrice ?? r.cv)), pct = Math.abs(n(r.fluctuationsRatio ?? r.cr));
    out.push({
      symbol, price,
      change: Number.isFinite(abs) ? (falling ? -abs : abs) : 0,
      changePct: Number.isFinite(pct) ? (falling ? -pct : pct) : 0,
      open: String(r.marketStatus ?? '') === 'OPEN',
      at: typeof r.localTradedAt === 'string' ? r.localTradedAt : null,
      session: String(r.marketStatus ?? '') === 'OPEN' ? 'regular' : 'closed',
    });
  }
  return out;
}
