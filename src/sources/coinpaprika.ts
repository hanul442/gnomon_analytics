// G-273: CoinPaprika's free ticker list (https://api.coinpaprika.com, no key): the top 2,000 coins with market cap,
// supply, all-time high and first trade date, in one request. Feeds a coin's 체력 tab. CoinGecko throttles cloud
// runners, so it is not used.

export const PAPRIKA_SOURCE = 'coinpaprika:tickers';

export interface PaprikaCoin {
  id: string; symbol: string; name: string; rank: number | null;
  /** Coins issued so far (CoinPaprika's free tier has no circulating figure). */
  totalSupply: number | null;
  /** Hard cap; null when there is none (ETH, DOGE …). */
  maxSupply: number | null;
  /** First trade CoinPaprika knows of, YYYY-MM-DD. */
  firstDate: string | null;
  priceUsd: number; marketCapUsd: number | null;
  athUsd: number | null; athDate: string | null;
}

const num = (v: unknown) => { const n = Number(v); return v != null && v !== '' && Number.isFinite(n) ? n : null; };
const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

export function parsePaprikaTickers(json: unknown): PaprikaCoin[] {
  if (!Array.isArray(json)) return [];
  return (json as Record<string, unknown>[]).flatMap((t) => {
    if (!t || typeof t !== 'object') return [];
    const usd = (t.quotes as { USD?: Record<string, unknown> } | undefined)?.USD;
    const price = num(usd?.price);
    if (typeof t.id !== 'string' || typeof t.symbol !== 'string' || !usd || !(price! > 0)) return [];
    const max = num(t.max_supply), total = num(t.total_supply);
    return [{
      id: t.id, symbol: t.symbol.trim().toUpperCase(), name: String(t.name ?? t.symbol), rank: num(t.rank) || null,
      totalSupply: total && total > 0 ? total : null, maxSupply: max && max > 0 ? max : null, firstDate: day(t.first_data_at),
      priceUsd: price!, marketCapUsd: num(usd.market_cap) || null, athUsd: num(usd.ath_price) || null, athDate: day(usd.ath_date),
    }];
  });
}

/**
 * The CoinPaprika coin for an Upbit market: same symbol, and its dollar price at Upbit's USDT rate within 30% of the
 * Upbit price (two coins share a ticker more often than one would think). The closest one wins.
 */
export function matchPaprika(coins: readonly PaprikaCoin[], symbol: string, upbitPrice: number, usdtKrw: number | null): PaprikaCoin | null {
  if (!usdtKrw || !(upbitPrice > 0)) return null;
  let best: PaprikaCoin | null = null, gap = Infinity;
  for (const c of coins) {
    if (c.symbol !== symbol) continue;
    const g = Math.abs(Math.log(upbitPrice / (c.priceUsd * usdtKrw)));
    if (g < gap) { gap = g; best = c; }
  }
  return best && gap <= Math.log(1.3) ? best : null;
}

/**
 * Coins outside the top 2,000 (or listed under an odd symbol) one by one: CoinPaprika's full coin list gives the ids
 * that carry the symbol, best ranked first, and each id's own ticker is checked like the bulk list. At most `limit`
 * ticker requests per run (the free tier allows about 20,000 a month). Never throws.
 */
export async function paprikaLookup(symbols: readonly { symbol: string; price: number }[], usdtKrw: number | null, fetcher: typeof fetch = fetch, limit = 60): Promise<Map<string, PaprikaCoin>> {
  const out = new Map<string, PaprikaCoin>();
  if (!symbols.length || !usdtKrw) return out;
  const get = (url: string) => fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const all = await get('https://api.coinpaprika.com/v1/coins');
  if (!Array.isArray(all)) return out;
  const ids = new Map<string, { id: string; rank: number }[]>();
  for (const c of all as Record<string, unknown>[]) {
    if (typeof c.id !== 'string' || typeof c.symbol !== 'string' || c.is_active === false) continue;
    const sym = c.symbol.trim().toUpperCase(), list = ids.get(sym) ?? [];
    list.push({ id: c.id, rank: Number(c.rank) > 0 ? Number(c.rank) : 1e9 }); ids.set(sym, list);
  }
  let calls = 0;
  for (const s of symbols) {
    for (const c of (ids.get(s.symbol) ?? []).sort((a, b) => a.rank - b.rank).slice(0, 3)) {
      if (calls >= limit) return out;
      calls += 1;
      const coin = parsePaprikaTickers([await get(`https://api.coinpaprika.com/v1/tickers/${encodeURIComponent(c.id)}`)])[0];
      const hit = coin && matchPaprika([coin], s.symbol, s.price, usdtKrw);
      if (hit) { out.set(s.symbol, hit); break; }
    }
  }
  return out;
}

/** Never throws: an empty list when the API is down. */
export async function fetchPaprikaTickers(fetcher: typeof fetch = fetch): Promise<PaprikaCoin[]> {
  try {
    const r = await fetcher('https://api.coinpaprika.com/v1/tickers', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
    return r.ok ? parsePaprikaTickers(await r.json()) : [];
  } catch { return []; }
}
