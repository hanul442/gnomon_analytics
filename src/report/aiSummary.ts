import { esc } from './html.js';
export function aiSummaryCard(text:string,title='AI 요약',date=''):string {
 const body=esc(text).replace(/([+−-]?\d+(?:\.\d+)?%)/g,(n)=>`<strong class="${n.startsWith('-')||n.startsWith('−')?'down':n.startsWith('+')?'up':''}">${n}</strong>`);
 return `<section class="card block ai-summary"><div class="as-kicker">CURIA · AI COMMITTEE${date?' · '+esc(date):''}</div><h2>${esc(title)}</h2><p>${body||'확인된 요약이 없어요.'}</p></section>`;
}
