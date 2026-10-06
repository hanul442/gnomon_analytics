import {contentMore} from './contentMore.js';
import {coinFlow} from './coinFlow.js';
import type { DailyReport } from './dailyReport.js';
import { flowsPanel, fundamentalsPanel } from './renderMarket.js';
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
/** Public source data only: never accepts or renders commentary. */
export function publicPanels(r:DailyReport){
 return {
  flows:r.kind==='coin'?coinFlow(r):r.market?.flows||r.market?.footprint?flowsPanel(r.market.flows,r.market.footprint):'',
  fundamentals:r.market?fundamentalsPanel(r.market,r.price?.close??null,r.name):'',
  news:r.filings.length||r.news?.clusters.length?`<section class="card block"><h2>뉴스·공시</h2>${contentMore(r.filings.map(f=>`<p>${esc(f.filedDate)} · ${esc(f.title)}</p>`),'공시')}${contentMore((r.news?.clusters??[]).map(n=>`<p>${esc(n.title)}</p>`),'뉴스')}</section>`:'',
 };
}
