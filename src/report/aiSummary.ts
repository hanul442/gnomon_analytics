import { esc } from './html.js';
const marks=(text:string)=>esc(text).replace(/([+−-]?\d+(?:\.\d+)?%)/g,(n)=>`<strong class="${n.startsWith('-')||n.startsWith('−')?'down':n.startsWith('+')?'up':''}">${n}</strong>`);
/** One AI summary card. `list` breaks a long summary into one line per sentence so it reads like key points. */
export function aiSummaryCard(text:string,title='AI 요약',date='',list=false):string {
 const lines=list?text.split(/(?<=[.다요])\s+/).map(x=>x.trim()).filter(Boolean):[];
 const body=lines.length>1?`<ul class="as-list">${lines.map(l=>`<li>${marks(l)}</li>`).join('')}</ul>`:`<p>${marks(text)||'확인된 요약이 없어요.'}</p>`;
 return `<section class="card block ai-summary"><div class="as-kicker">CURIA · AI COMMITTEE${date?' · '+esc(date):''}</div><h2>${esc(title)}</h2>${body}</section>`;
}
