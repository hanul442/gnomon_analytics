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

/** Signed percent, e.g. +0.77%. `empty` stands in for a missing value. */
export const pct = (v: number | null | undefined, digits = 2, empty = '—'): string => (v == null ? empty : `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`);

/** A price move with its arrow (G-84): ▲ +0.77% up (red), ▼ -1.98% down (blue). */
export const move = (v: number | null | undefined, digits = 2): string => (v == null ? '—' : `${v > 0 ? '▲ +' : v < 0 ? '▼ ' : ''}${v.toFixed(digits)}%`);

/** CSS tone for a signed value: up, down or nothing. */
export const tone = (v: number | null | undefined): string => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down');

/** The same rules for browser scripts: window.GNM.fmt.{won,pct,move,tone}. */
export const FORMAT_JS = `(function(){var G=window.GNM=window.GNM||{};G.fmt={won:${krw.toString()},pct:${pct.toString()},move:${move.toString()},tone:${tone.toString()}};})();`;
