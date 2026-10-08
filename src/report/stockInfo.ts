// G-120: stocks without a daily report (calculation pages) have no valuation, earnings, flows, news or
// filings of their own. The worker reads them from Naver on demand (/stockinfo/<code>) and returns the same
// panels a report shows; the page swaps them into its [data-slot] placeholders. Public data only.

import type { FinancePeriod, InvestorFlow, ResearchNote, StockSnapshot } from '../types.js';
import type { StockDisclosure, StockNewsItem } from '../sources/naverStock.js';
import { buildMarketSection } from './marketSection.js';
import { flowsPanel, fundamentalsPanel } from './renderMarket.js';
import { esc } from './html.js';

export interface StockInfoInput { symbol: string; name: string; close: number | null; now: Date; snapshot: StockSnapshot | null; finance: readonly FinancePeriod[]; research: readonly ResearchNote[]; flows: readonly InvestorFlow[]; news: readonly StockNewsItem[]; disclosures: readonly StockDisclosure[] }

export function stockInfoFragments(i: StockInfoInput): { fundamentals: string; flows: string; news: string; filings: string; homeNews: string; homeFilings: string } {
  const date = new Date(i.now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  const m = buildMarketSection({ symbol: i.symbol, date, generatedAt: i.now, daily: [], weekly: [], intraday: [], flows: i.flows, snapshots: i.snapshot ? [i.snapshot] : [], finance: i.finance, research: i.research, benchmarks: [], loggedForecasts: [], status: [] });
  const hasFund = !!i.snapshot || i.finance.length > 0;
  const news = i.news.length ? `<div class="card" id="news" style="margin-top:16px"><div class="head"><h2>뉴스</h2><span class="sub" style="margin:0">네이버 증권 종목 뉴스 ${i.news.length}건</span></div>${i.news.map((n) => `<div class="story"><div class="story-title"><a href="${esc(n.url)}" rel="noopener" target="_blank">${esc(n.title)}</a></div><div class="why">${esc(n.office)} · ${esc(n.at)}</div>${n.summary ? `<p class="muted small" style="margin:4px 0 0">${esc(n.summary)}…</p>` : ''}</div>`).join('')}<p class="fine">네이버 증권에서 지금 읽어 온 뉴스예요. 중요도 분류와 중복 묶음은 리포트가 있는 종목에만 있어요.</p></div>` : '';
  const filings = i.disclosures.length ? `<div class="table-wrap"><table><thead><tr><th class="col-date">날짜</th><th>공시</th><th class="col-filer">제출</th></tr></thead><tbody>${i.disclosures.map((d) => `<tr><td class="col-date nowrap">${esc(d.at.slice(0, 10))}</td><td><a href="https://m.stock.naver.com/domestic/stock/${esc(i.symbol)}/disclosure" rel="noopener" target="_blank">${esc(d.title)}</a></td><td class="col-filer nowrap">${esc(d.author)}</td></tr>`).join('')}</tbody></table></div><p class="fine">네이버 증권 공시 목록에서 읽어 왔어요.</p>` : '';
  // G-132: the summary tab's 최신 뉴스·공시 (five each), in the same row format as a report's.
  const homeNews = i.news.slice(0, 5).map((n) => `<div class="row-item"><span class="badge b-LOW">뉴스</span><div class="ri-main"><a href="${esc(n.url)}" rel="noopener" target="_blank">${esc(n.title)}</a><div class="muted small">${esc(n.office)} ${esc(n.at.slice(5, 16).replace('T', ' '))}</div></div></div>`).join('');
  const homeFilings = i.disclosures.slice(0, 5).map((d) => `<div class="row-item"><span class="badge b-LOW">공시</span><div class="ri-main"><a href="https://m.stock.naver.com/domestic/stock/${esc(i.symbol)}/disclosure" rel="noopener" target="_blank">${esc(d.title)}</a><div class="muted small">${esc(d.at.slice(0, 10))} ${esc(d.author)}</div></div></div>`).join('');
  return {
    homeNews, homeFilings,
    fundamentals: hasFund ? fundamentalsPanel(m, i.close, i.name) : '',
    flows: i.flows.length ? flowsPanel(m.flows, m.footprint) : '',
    news,
    filings,
  };
}

/** On calculation pages: fetch /stockinfo and fill the empty panels. Leaves the placeholder when nothing came back. */
export const STOCK_INFO_JS = `
(function(){
 // A report whose summary has no news or filings yet (G-132) asks for the latest too, for those two lists only.
 var b=document.body,only=!b.hasAttribute('data-fill');var empty=document.querySelector('[data-slot=homeNews][data-empty],[data-slot=homeFilings][data-empty]');if(only&&!empty)return;var api=window.GNM&&GNM.api;var sym=only?((document.querySelector('[data-symbol]')||{}).dataset||{}).symbol:b.getAttribute('data-fill');
 var done=function(){document.querySelectorAll('[data-slot=homeNews][data-empty]:not([data-filled]),[data-slot=homeFilings][data-empty]:not([data-filled])').forEach(function(el){el.innerHTML='<p class="empty">'+(el.getAttribute('data-slot')==='homeNews'?'최근 뉴스가 아직 없어요.':'최근 공시가 아직 없어요.')+'</p>';});};if(!api||!/^[0-9][0-9A-Z]{5}$/.test(sym||'')){done();return;}
 var close=b.getAttribute('data-close')||'';
 fetch(api+'/stockinfo/'+sym+(close?'?close='+encodeURIComponent(close):'')).then(function(r){return r.ok?r.json():null;}).then(function(d){if(!d){done();return;}
  var KEYS=only?['homeNews','homeFilings']:['fundamentals','flows','news','filings','homeNews','homeFilings'];
  KEYS.forEach(function(k){if(!d[k])return;document.querySelectorAll('[data-slot="'+k+'"]').forEach(function(el){el.innerHTML=d[k];el.setAttribute('data-filled','');});});
 done();}).catch(done);
})();`;
