// Shared number formatting for server-rendered pages: one rule for prices and moves on every screen.
// No imports, so any module can use it without a cycle. Browser scripts get the same rules as GNM.fmt
// (FORMAT_JS below), so a price or a move reads the same whether the server or the page drew it.

/** KRW price: whole won from 100 up, otherwise up to four decimals (small coins). */
export const won = (v: number): string => `${Math.abs(v) >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}원`;

/** Signed percent, e.g. +0.77%. `empty` stands in for a missing value. */
export const pct = (v: number | null | undefined, digits = 2, empty = '—'): string => (v == null ? empty : `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`);

/** A price move with its arrow (G-84): ▲ +0.77% up (red), ▼ -1.98% down (blue). */
export const move = (v: number | null | undefined, digits = 2): string => (v == null ? '—' : `${v > 0 ? '▲ +' : v < 0 ? '▼ ' : ''}${v.toFixed(digits)}%`);

/** CSS tone for a signed value: up, down or nothing. */
export const tone = (v: number | null | undefined): string => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down');

/** The same rules for browser scripts: window.GNM.fmt.{won,pct,move,tone}. */
export const FORMAT_JS = `(function(){var G=window.GNM=window.GNM||{};G.fmt={won:${won.toString()},pct:${pct.toString()},move:${move.toString()},tone:${tone.toString()}};})();`;
