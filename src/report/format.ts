// Shared number formatting for server-rendered pages: one rule for prices and moves on every screen.
// No imports, so any module can use it without a cycle. Browser scripts get the same rules as GNM.fmt
// (FORMAT_JS below), so a price or a move reads the same whether the server or the page drew it.

/** KRW price: whole won from 100 up, otherwise up to four decimals (small coins). */
const krw = (v: number): string => `${Math.abs(v) >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}원`;
/** USD price (G-152): $185.20; a negative value keeps its sign in front. */
const usd = (v: number): string => `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// G-152: a US stock's report and its panels price in dollars. Rendering is synchronous, so the currency is set
// around one render (withCurrency) and every price helper below follows it without new parameters.
let CURRENCY: 'KRW' | 'USD' = 'KRW';
export function withCurrency<T>(currency: 'KRW' | 'USD' | undefined, render: () => T): T {
  const before = CURRENCY; CURRENCY = currency ?? 'KRW';
  try { return render(); } finally { CURRENCY = before; }
}
/** A price in the current currency (won unless a US render). */
export const won = (v: number): string => (CURRENCY === 'USD' ? usd(v) : krw(v));
/** The currency of the current render. */
export const currency = (): 'KRW' | 'USD' => CURRENCY;
/** FinancePeriod metrics are stored in 억원 (Naver, Korean stocks) or 백만 달러 (SEC XBRL, US stocks). */
export const financeScale = (): number => (CURRENCY === 'USD' ? 1e6 : 1e8);
export const financeUnit = (): string => (CURRENCY === 'USD' ? '백만 달러' : '억원');
const krwBig = (v: number): string => (Math.abs(v) >= 1e12 ? `${(v / 1e12).toFixed(Math.abs(v) >= 1e14 ? 0 : 1)}조원` : Math.abs(v) >= 1e8 ? `${Math.round(v / 1e8).toLocaleString('ko-KR')}억원` : `${Math.round(v / 1e4).toLocaleString('ko-KR')}만원`);
const USD_UNITS = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K'], [1, '']] as const;
const usdBig = (v: number): string => {
  // The unit is chosen on the rounded value, so 999.95B rolls over to $1.0T rather than $1000B.
  const a = Math.abs(v), [unit, suffix] = USD_UNITS.find(([u, sfx]) => !sfx || a >= u * 0.9995)!, m = a / unit;
  const text = m >= 99.95 || !suffix ? m.toFixed(0) : m.toFixed(1);
  return `${v < 0 ? '-' : ''}$${text}${suffix}`;
};
/** A large amount (market value, revenue) in the current currency: 1.2조원 / 345억원, or $1.2T / $34.5B / $120M. */
export const bigMoney = (v: number): string => (CURRENCY === 'USD' ? usdBig(v) : krwBig(v));

/** Signed percent, e.g. +0.77%. `empty` stands in for a missing value. */
export const pct = (v: number | null | undefined, digits = 2, empty = '—'): string => (v == null ? empty : `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`);

/** A price move with its arrow (G-84): ▲ +0.77% up (red), ▼ -1.98% down (blue). */
export const move = (v: number | null | undefined, digits = 2): string => (v == null ? '—' : `${v > 0 ? '▲ +' : v < 0 ? '▼ ' : ''}${v.toFixed(digits)}%`);

/** CSS tone for a signed value: up, down or nothing. */
export const tone = (v: number | null | undefined): string => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down');

/** The same rules for browser scripts: window.GNM.fmt.{won,pct,move,tone}. */
export const FORMAT_JS = `(function(){var G=window.GNM=window.GNM||{};G.fmt={won:${krw.toString()},pct:${pct.toString()},move:${move.toString()},tone:${tone.toString()}};})();`;
