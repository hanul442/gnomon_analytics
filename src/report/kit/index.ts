// G-259: every Bklit UI chart type, redrawn as plain SVG in GNOMON's style (no React; Bklit is MIT).
// Each file owns its charts, their CSS and their page script; this file only joins them for renderHtml.
import { KIT_FINANCE_CSS, KIT_FINANCE_JS } from './finance.js';
import { KIT_MARKET_CSS, KIT_MARKET_JS } from './market.js';
import { KIT_STOCK_CSS, KIT_STOCK_JS } from './stock.js';

export const KIT_CSS = KIT_FINANCE_CSS + KIT_MARKET_CSS + KIT_STOCK_CSS;
export const KIT_JS = [KIT_FINANCE_JS, KIT_MARKET_JS, KIT_STOCK_JS].filter(Boolean).join(';\n');
