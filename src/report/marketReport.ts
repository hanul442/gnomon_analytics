import { ANALYSTS } from '../analysis/analysts.js';
import type { MarketPulse } from '../analysis/quickCalc.js';
import { marketTemperature } from './marketTemperature.js';
import { renderCommitteeDebate, SPEAKER } from './renderReportExtras.js';
import { aiSummaryCard } from './aiSummary.js';
import { z } from 'zod';
import { shell, deepSlot, DEEP_SCRIPT, joinBox } from './renderHtml.js';
import { esc } from './html.js';
import { gate } from './plans.js';
import { DEBATE_FILTER_SCRIPT, DEBATE_PLAY_SCRIPT, EVIDENCE_SCRIPT } from './renderReportExtras.js';
export type Period = 'daily' | 'weekly';
export interface MarketAsset { symbol: string; name: string; date: string; close: number; returnPct: number | null; baseline: string | null; value: number | null }
export interface MarketGroup { id: string; name: string; source: string; universe: number; assets: MarketAsset[]; snapshotDate: string | null; temperature?: MarketPulse | null; breadth: { up: number; down: number; flat: number } }
const claim = z.object({ text: z.string(), kind: z.enum(['FACT','INFERENCE','ASSUMPTION']), refs: z.array(z.string()).min(1) });
const EXPERT_IDS=[...ANALYSTS.map(a=>a.id),'MARKET','TECHNICAL','FLOW','FUNDAMENTAL','EVENT'] as unknown as [string,...string[]];
const expert=z.object({speaker:z.enum(EXPERT_IDS),stance:z.enum(['BULLISH','NEUTRAL','BEARISH','INSUFFICIENT_DATA']),claim});
const marketTurn=z.object({speaker:z.enum([...EXPERT_IDS,'RED_TEAM'] as [string,...string[]]),stance:z.enum(['BULLISH','NEUTRAL','BEARISH']),replyTo:z.number(),claim});
export const MarketCouncilSchema = z.object({ summary: claim, desks: z.array(z.object({ name: z.enum(['코스피','코스닥','코인','ETF']), view: z.enum(['강세','중립','약세','판단보류']), claims: z.array(claim) })).length(4), consensus: z.array(claim), disagreements: z.array(claim), scenarios: z.array(z.object({ name: z.enum(['강세','기본','약세']), trigger: claim, outlook: claim, invalidation: claim })).length(3), redTeam: z.array(claim), watch: z.array(claim), dataGaps: z.array(z.string()), experts:z.array(expert).optional(),debate:z.array(marketTurn).optional() });
export const MarketCouncilGenerationSchema=MarketCouncilSchema.extend({experts:z.array(expert).length(11),debate:z.array(marketTurn).length(12)});
/** Extra, unsupported scenario names are dropped; the three required cases still validate strictly. */
export function parseMarketCouncil(text:string):MarketCouncil {
 const raw=JSON.parse(text);
 let normalized=0;
 const normalize=(value:unknown):void=>{
  if(Array.isArray(value)){value.forEach(normalize);return;}
  if(!value||typeof value!=='object')return;
  const item=value as Record<string,unknown>;
  if(typeof item.text==='string'&&Array.isArray(item.refs)&&'kind' in item&&!['FACT','INFERENCE','ASSUMPTION'].includes(String(item.kind))){item.kind='ASSUMPTION';normalized++;}
  Object.values(item).forEach(normalize);
 };
 normalize(raw);
 if(normalized&&Array.isArray(raw?.dataGaps))raw.dataGaps.push(`분류가 불명확한 발언 ${normalized}개는 가정으로 표시했습니다.`);
 // A desk can withhold judgment; its spoken stance uses the neutral position.
 if(Array.isArray(raw?.debate))for(const turn of raw.debate)if(turn?.stance==='INSUFFICIENT_DATA')turn.stance='NEUTRAL';
 if(Array.isArray(raw?.scenarios)){const keep=raw.scenarios.filter((s:unknown)=>!!s&&typeof s==='object'&&['강세','기본','약세'].includes(String((s as {name?:unknown}).name)));if(keep.length!==raw.scenarios.length){raw.scenarios=keep;if(Array.isArray(raw.dataGaps))raw.dataGaps.push('지원 범위를 벗어난 추가 시나리오는 제외했습니다.');}}
 return MarketCouncilSchema.parse(raw);
}
export type MarketCouncil = z.infer<typeof MarketCouncilSchema>;
export interface MarketReport { schema: 'curia.market-report.v2' | 'curia.market-report.v3' | 'curia.market-report.v4'; date: string; from: string; generatedAt: string; period: Period; groups: MarketGroup[]; ai: { status: 'OK' | 'SKIPPED' | 'FAILED'; error?: string; model?: string; council?: MarketCouncil; summary?: MarketCouncil['summary']; sealed?: string } }
/** Weekly return is measured from the last close BEFORE Monday, never substituted with 5-session return. */
export function periodAsset(symbol: string, name: string, bars: readonly { date: string; close: number }[], date: string, from: string, period: Period, value: number | null = null): MarketAsset | null {
 const history = [...new Map(bars.filter(b => b.date <= date && Number.isFinite(b.close) && b.close > 0).map(b => [b.date,b])).values()].sort((a,b)=>a.date.localeCompare(b.date));
 const last=history.at(-1); if(!last) return null;
 const prev=period==='daily'?history.at(-2):history.filter(b=>b.date<from).at(-1);
 const current=last.date >= from;
 return { symbol,name,date:last.date,close:last.close,returnPct:current&&prev?(last.close/prev.close-1)*100:null,baseline:prev?.date??null,value };
}
export function weekStart(date: string): string { const d=new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)); return d.toISOString().slice(0,10); }
export function validCouncil(council: MarketCouncil, groups: readonly MarketGroup[]): boolean {
 const refs=new Set(groups.map(g=>g.id));
 const claims=[council.summary,...council.desks.flatMap(d=>d.claims),...council.consensus,...council.disagreements,...council.scenarios.flatMap(s=>[s.trigger,s.outlook,s.invalidation]),...council.redTeam,...council.watch,...(council.experts??[]).map(x=>x.claim),...(council.debate??[]).map(x=>x.claim)];
 const members=council.experts?new Set(council.experts.map(e=>e.speaker)).size===11&&council.debate?.length===12&&new Set(council.debate.slice(0,11).map(t=>t.speaker)).size===11&&council.debate.at(-1)?.speaker==='RED_TEAM'&&council.experts.every(e=>council.debate!.find(t=>t.speaker===e.speaker)?.stance===(e.stance==='INSUFFICIENT_DATA'?'NEUTRAL':e.stance))&&council.debate.every((t,i)=>t.replyTo===-1||(Number.isInteger(t.replyTo)&&t.replyTo>=0&&t.replyTo<i&&council.debate![t.replyTo]?.speaker!==t.speaker)):true;
 return members && new Set(council.desks.map(d=>d.name)).size===4 && new Set(council.scenarios.map(s=>s.name)).size===3 && claims.every(c=>c.refs.length>0&&c.refs.every(r=>refs.has(r)));
}
const pct=(n:number|null)=>n===null?'확인 필요':`${n>0?'+':''}${n.toFixed(2)}%`;
/** This source contains individual coins, never an aggregate cryptocurrency index. */
export function marketClaimText(text:string):string {
 return text.replace(/코인\s*지수는/g,'수집 코인은').replace(/코인\s*지수가/g,'수집 코인이').replace(/코인\s*지수를/g,'수집 코인을').replace(/코인\s*지수/g,'수집 코인').replace(/광폭 낙장/g,'광범위한 하락').replace(/ 락 반면/g,' 하락한 반면');
}
const claims=(items: readonly z.infer<typeof claim>[])=>`<ul class="market-claims">${items.map(c=>`<li><span class="tag">${c.kind==='FACT'?'사실':c.kind==='INFERENCE'?'해석':'가정'}</span> ${esc(marketClaimText(c.text))} <small>${c.refs.map(r=>`<a href="#${esc(r)}">${esc(r)}</a>`).join(' · ')}</small></li>`).join('')}</ul>`;
export const marketSymbol=(period:Period)=>`MARKET-${period.toUpperCase()}`;
export function renderMarketDeep(r:MarketReport):string {
 const groupHtml=r.groups.map(g=>{
  const available=g.assets.filter(a=>a.returnPct!==null); const sort=[...available].sort((a,b)=>b.returnPct!-a.returnPct!);
  const table=(list:readonly MarketAsset[])=>`<div class="table-wrap"><table><thead><tr><th>자산</th><th>가격</th><th>${r.period==='weekly'?'이번 주 누적':'일간'} 등락</th><th>가격 기준일</th><th>비교 시작일</th></tr></thead><tbody>${list.map(a=>`<tr><td>${esc(a.name)} <small>${esc(a.symbol)}</small></td><td>${a.close.toLocaleString('ko-KR',{maximumFractionDigits:4})}</td><td class="${a.returnPct!==null&&a.returnPct>0?'up':'down'}">${pct(a.returnPct)}</td><td>${esc(a.date)}</td><td>${esc(a.baseline??'없음')}</td></tr>`).join('')}</tbody></table></div>`;
  return `<section class="card block" id="${g.id}"><h2>${esc(g.name)}</h2><p class="muted">근거 ${g.id} · ${esc(g.source)} · 수집 ${g.assets.length}/${g.universe} · 기간 수익률 계산 가능 ${available.length}</p><p>현재 스냅샷(${esc(g.snapshotDate??'확인 필요')}) 상승 ${g.breadth.up} · 하락 ${g.breadth.down} · 보합 ${g.breadth.flat}개. ${r.period==='weekly'?'이 숫자는 주간 상승·하락 종목 수가 아닙니다.':''}</p>${g.assets.length?table(g.assets.slice(0,g.assets.length<=2?2:8)):'<p>수집된 데이터가 없습니다.</p>'}${g.assets.length>2?`<details><summary>기간 상승·하락 상위 각 5개</summary><h3>상승 상위</h3>${table(sort.slice(0,5))}<h3>하락 상위</h3>${table(sort.slice(-5).reverse())}</details>`:''}</section>`;
 }).join('');
 const c=r.ai.council;
 const ai=c?`${c.experts?.length?`<details class="card block"><summary>전문가별 판단 · 11명</summary><div class="desk-grid" style="margin-top:12px">${c.experts.map(e=>`<article class="card"><h3>${esc(SPEAKER[e.speaker]??e.speaker)}</h3><b class="${e.stance==='BULLISH'?'up':e.stance==='BEARISH'?'down':'muted'}">${e.stance==='BULLISH'?'▲ 강세':e.stance==='BEARISH'?'▼ 약세':e.stance==='INSUFFICIENT_DATA'?'근거 부족':'● 중립'}</b>${claims([e.claim])}</article>`).join('')}</div></details>`:''}${aiSummaryCard(marketClaimText(c.summary.text),'위원회 판단',r.date)}<section class="block"><div class="block-head"><h2>조건별 시나리오</h2><span class="muted small">조건이 달라지면 판단도 바뀝니다</span></div><div class="market-scenarios">${c.scenarios.map(s=>`<section class="card market-scenario ${s.name==='강세'?'bull':s.name==='약세'?'bear':'base'}"><h3>${s.name==='강세'?'▲':s.name==='약세'?'▼':'●'} ${esc(s.name)}</h3><h4>성립 조건</h4>${claims([s.trigger])}<h4>전망</h4>${claims([s.outlook])}<h4>무효화 조건</h4>${claims([s.invalidation])}</section>`).join('')}</div></section>${c.debate?.length?renderCommitteeDebate({status:'OK',evidence:r.groups.map(g=>({id:g.id,kind:'MARKET',label:g.name+' · '+g.source+' · 기준 '+(g.snapshotDate??'확인 필요'),detail:'',url:'#'+g.id})),debate:c.debate.map(t=>({...t,speaker:t.speaker as import('../analysis/commentary.js').Speaker,replyTo:t.replyTo,claim:{text:marketClaimText(t.claim.text),kind:t.claim.kind,evidenceIds:t.claim.refs}}))}):`<section class="block" id="debate"><h2>이전 형식의 시장 관점</h2><div class="card debate">${c.desks.map(d=>`<div class="db-turn db-mid" data-speaker="${esc(d.name)}"><div class="db-who"><b>${esc(d.name)}</b> · ${esc(d.view)}</div><div class="db-bubble">${claims(d.claims)}</div></div>`).join('')}</div><p class="fine">이 기록은 전문가 토론 형식 도입 전 리포트입니다.</p></section>`}<section class="block grid-eq"><div class="card"><h2>합의된 판단</h2>${claims(c.consensus)}</div><div class="card"><h2>남은 쟁점</h2>${claims(c.disagreements)}</div></section><section class="card block"><h2>다음 관찰 항목</h2>${claims(c.watch)}${c.dataGaps.length?`<details><summary>자료 공백 ${c.dataGaps.length}개</summary><ul>${c.dataGaps.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:''}</section>`:`<section class="card block"><p>AI 위원회 해설은 ${r.ai.status==='FAILED'?'생성에 실패했습니다':'아직 생성되지 않았습니다'}. ${esc(r.ai.error??'')}</p></section>`;
 return `<section class="block" id="council">${ai}</section><details class="card block market-evidence"><summary>판단 근거 · 코스피·코스닥·코인·ETF 데이터</summary>${groupHtml}</details>`;

}
export function renderMarketReport(r:MarketReport, base=''):string {
 const summary=r.ai.summary??r.ai.council?.summary;
 const body=`<section class="card block market-lead"><a class="ml-back" href="${base}market-reports.html">‹ 시장 데일리 모음</a><h1>${esc(r.date)} 시장 데일리</h1><p class="muted">코스피 · 코스닥 · 코인 · ETF${r.period==='weekly'?' · 주중 누적 집계 (완료된 주간 리포트 아님)':''}</p><details><summary class="muted small">데이터 기준·분석 범위</summary><p class="fine">생성 ${esc(r.generatedAt)} · 한국 증시: 거래일 종가 · 코인: 업비트 원화 일봉(09:00 KST 경계), 당일 봉은 진행 중 가격 스냅샷입니다. 휴장·수집 실패는 각 자산의 실제 기준일로 확인하세요.</p><p class="fine">국내 주식의 시가총액 상위 표본과 수집된 ETF·업비트 원화 코인 기준입니다. ETF 가격 수익률은 분배금을 포함한 총수익률이 아닙니다.</p></details></section><section class="block market-thermals">${r.groups.map(g=>marketTemperature(g.temperature??null,g.breadth,g.name,base+'screener.html'+(g.id==='M3'?'#coin':g.id==='M4'?'#etf':''))).join('')}</section>${aiSummaryCard(marketClaimText(summary?.text??(r.ai.status==='FAILED'?'AI 요약 생성에 실패했습니다. '+(r.ai.error??''):'AI 요약을 준비하고 있어요.')),'시장 AI 요약',r.date)}${deepSlot(marketSymbol(r.period),r.date)}<div class="join-wrap"><div class="card">${gate(joinBox({symbol:marketSymbol(r.period),name:`${r.date} 시장 데일리`}).replace('data-name=',`data-report-date="${esc(r.date)}" data-name=`),{base,what:'시장 위원회에 질문·반론하기',need:'plus'})}</div></div>`;

 return shell(base,`${r.date} 시장 리포트 | CURIA`,body,{scripts:EVIDENCE_SCRIPT+DEBATE_FILTER_SCRIPT+DEBATE_PLAY_SCRIPT+DEEP_SCRIPT+`<script>document.addEventListener('click',function(e){var a=e.target.closest('a[href^="#M"]');if(!a)return;var target=document.getElementById(a.getAttribute('href').slice(1));if(target){var p=target.parentElement;while(p){if(p.tagName==='DETAILS')p.open=true;p=p.parentElement;}}});</script>`});
}

export function renderMarketReportIndex(reports: readonly MarketReport[]):string {
 const list=reports.filter(r=>r.period==='daily').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
 const day=(d:string)=>'일월화수목금토'[new Date(`${d}T00:00:00Z`).getUTCDay()];
 const first=(t?:string)=>(t?marketClaimText(t).split(/(?<=[.다요])\s/).slice(0,2).join(' '):'');
 const card=(r:MarketReport,i:number)=>{
  const line=r.ai.status==='OK'?first(r.ai.summary?.text??r.ai.council?.summary?.text):r.ai.status==='FAILED'?'AI 요약을 만들지 못했어요. 시장 수치는 볼 수 있어요.':'AI 요약을 준비하고 있어요.';
  const groups=r.groups.map(g=>`<span><b>${esc(g.name)}</b> <i class="up">▲${g.breadth.up}</i> <i class="down">▼${g.breadth.down}</i></span>`).join('');
  return `<a class="mi-card${i?'':' latest'}" href="market/${r.period}-${r.date}.html"><div class="mi-top"><b>${esc(r.date.slice(5).replace('-','/'))} (${day(r.date)})</b>${i?'':'<span class="badge sm dark">최신</span>'}<span class="badge sm ${r.ai.status==='OK'?'ok':'mute'}">${r.ai.status==='OK'?'AI 위원회':'수치만'}</span></div><p>${esc(line)}</p><div class="mi-g">${groups}</div></a>`;
 };
 const style=`<style>.mi{max-width:820px;margin:16px auto 32px}.mi-head{padding:18px;margin-bottom:12px}.mi-head h1{font-size:24px;margin:2px 0 6px}.mi-head p{margin:0;font-size:14px}.mi-list{display:grid;gap:10px}.mi-card{display:block;background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px;text-decoration:none;color:var(--fg)}.mi-card:hover{border-color:var(--accent)}.mi-card.latest{border:1.5px solid var(--navy)}.mi-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.mi-top b{font-size:16px;margin-right:auto}.mi-card p{margin:6px 0 8px;font-size:14px;line-height:1.55;color:var(--fg2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.mi-g{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}.mi-g span{white-space:nowrap}.mi-g b{color:var(--fg2)}.mi-g i{font-style:normal;font-weight:700}.mi-empty{padding:18px}</style>`;
 return shell('','시장 데일리 | CURIA',`${style}<div class="mi"><section class="card mi-head"><div class="pl-k">시장 데일리</div><h1>매일 시장 리포트</h1><p class="muted">코스피·코스닥·코인·ETF의 오늘 흐름과 AI 위원회의 관점·반론을 날짜별로 모았어요. 숫자는 오른 종목(▲)과 내린 종목(▼) 수예요.</p></section><div class="mi-list">${list.map(card).join('')||'<div class="card mi-empty muted">아직 시장 리포트가 없어요.</div>'}</div></div>`,{chat:false,noFeedback:true});
}
