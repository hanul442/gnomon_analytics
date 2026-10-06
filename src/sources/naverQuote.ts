// Real-time quotes for stocks and ETFs (docs/DESIGN.md §5.22, G-62): Naver Finance's polling feed, the
// one its own pages refresh from. Read through the API Worker (the browser cannot call it across
// origins). Coins do not come through here: the page talks to Upbit's public WebSocket directly.

export interface Quote { symbol: string; price: number; change: number; changePct: number; open: boolean; at: string | null }

export const quoteUrl = (symbols: readonly string[]) => `https://polling.finance.naver.com/api/realtime/domestic/stock/${symbols.join(',')}`;

const n = (v: unknown) => {
  const x = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(x) ? x : NaN;
};

/** `datas` rows → quotes; rows without a price are skipped. The sign comes from compareToPreviousPrice. */
export function parseNaverQuotes(json: unknown): Quote[] {
  const rows = (json as { datas?: unknown[] } | null)?.datas;
  if (!Array.isArray(rows)) return [];
  const out: Quote[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const symbol = String(r.itemCode ?? r.cd ?? ''), price = n(r.closePrice ?? r.nv);
    if (!/^[0-9A-Z]{6}$/.test(symbol) || !(price > 0)) continue;
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
    });
  }
  return out;
}
