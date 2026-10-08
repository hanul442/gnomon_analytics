// G-142: coin derivatives from OKX's public API — funding rate, open interest (now and 30 days), the
// long/short account ratio and recent liquidations. Binance and Bybit refuse US data-centre traffic
// (HTTP 451/403 from GitHub and Cloudflare), OKX answers. Only coins with a USDT perpetual have these.

export interface DerivSnapshot {
  ccy: string;
  instId: string;
  /** Per 8-hour funding period, as a fraction (0.0001 = 0.01%). */
  funding: { rate: number; nextAt: string | null } | null;
  /** Open interest in USD now, and daily [date, oiUsd, volumeUsd] oldest first. */
  oi: { usd: number; history: [string, number, number][] } | null;
  /** Long accounts ÷ short accounts, daily [date, ratio] oldest first. */
  longShort: [string, number][];
  /** Recent liquidations (OKX keeps the latest orders): USD by side and the window they cover. */
  liquidations: { longUsd: number; shortUsd: number; count: number; from: string | null; to: string | null } | null;
  source: 'okx';
  at: string;
}

const day = (ms: string | number) => new Date(Number(ms) + 9 * 3600_000).toISOString().slice(0, 10);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
type OkxBody = { code?: string; data?: unknown[] };
const rows = (b: unknown): unknown[] => { const o = b as OkxBody; if (!o || o.code !== '0' || !Array.isArray(o.data)) throw new Error(`OKX_${o?.code ?? 'BAD'}`); return o.data; };

/** Builds one snapshot from the six OKX answers (each may be null when that call failed). */
export function parseOkxDeriv(ccy: string, parts: { funding?: unknown; oi?: unknown; oiHist?: unknown; lsr?: unknown; liq?: unknown; inst?: unknown }, at: Date): DerivSnapshot {
  const instId = `${ccy}-USDT-SWAP`;
  const safe = <T>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };
  const funding = safe(() => { const r = rows(parts.funding)[0] as Record<string, string>; const rate = num(r.fundingRate); return rate == null ? null : { rate, nextAt: r.fundingTime ? new Date(Number(r.fundingTime)).toISOString() : null }; }, null);
  const oiNow = safe(() => num((rows(parts.oi)[0] as Record<string, string>).oiUsd), null);
  const hist = safe(() => (rows(parts.oiHist) as string[][]).map((r) => [day(r[0]!), num(r[1]) ?? 0, num(r[2]) ?? 0] as [string, number, number]).filter((r) => r[1] > 0).reverse().slice(-30), [] as [string, number, number][]);
  const longShort = safe(() => (rows(parts.lsr) as string[][]).map((r) => [day(r[0]!), num(r[1]) ?? 0] as [string, number]).filter((r) => r[1] > 0).reverse().slice(-30), [] as [string, number][]);
  const ctVal = safe(() => num((rows(parts.inst)[0] as Record<string, string>).ctVal), null);
  const liquidations = safe(() => {
    const details = (rows(parts.liq) as { details?: Record<string, string | number>[] }[]).flatMap((x) => x.details ?? []);
    if (!details.length || ctVal == null) return null;
    let longUsd = 0, shortUsd = 0, lo = Infinity, hi = 0;
    for (const d of details) {
      const usd = (num(d.sz) ?? 0) * ctVal * (num(d.bkPx) ?? 0), t = Number(d.ts ?? d.time);
      if (d.posSide === 'long') longUsd += usd; else if (d.posSide === 'short') shortUsd += usd;
      if (Number.isFinite(t)) { lo = Math.min(lo, t); hi = Math.max(hi, t); }
    }
    return { longUsd, shortUsd, count: details.length, from: Number.isFinite(lo) ? new Date(lo).toISOString() : null, to: hi ? new Date(hi).toISOString() : null };
  }, null);
  return { ccy, instId, funding, oi: oiNow == null && !hist.length ? null : { usd: oiNow ?? hist.at(-1)?.[1] ?? 0, history: hist }, longShort, liquidations, source: 'okx', at: at.toISOString() };
}

const BASE = 'https://www.okx.com/api/v5';
/** Six public calls in parallel; a failed one only blanks its own part. */
export async function fetchOkxDeriv(ccy: string, doFetch: typeof fetch, at = new Date()): Promise<DerivSnapshot> {
  if (!/^[A-Z0-9]{2,10}$/.test(ccy)) throw new Error('BAD_CCY');
  const inst = `${ccy}-USDT-SWAP`;
  const get = (path: string) => doFetch(`${BASE}${path}`, { signal: AbortSignal.timeout(5000), headers: { 'user-agent': 'Mozilla/5.0 (gnomon-analytics)' } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [funding, oi, oiHist, lsr, liq, instr] = await Promise.all([
    get(`/public/funding-rate?instId=${inst}`),
    get(`/public/open-interest?instType=SWAP&instId=${inst}`),
    get(`/rubik/stat/contracts/open-interest-volume?ccy=${ccy}&period=1D`),
    get(`/rubik/stat/contracts/long-short-account-ratio?ccy=${ccy}&period=1D`),
    get(`/public/liquidation-orders?instType=SWAP&uly=${ccy}-USDT&state=filled&limit=100`),
    get(`/public/instruments?instType=SWAP&instId=${inst}`),
  ]);
  return parseOkxDeriv(ccy, { funding, oi, oiHist, lsr, liq, inst: instr }, at);
}
