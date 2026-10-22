import { CORE_ANALYSTS } from '../analysis/analysts.js';
import type { MarketPulse } from '../analysis/quickCalc.js';
import { marketTemperature } from './marketTemperature.js';
import { renderCommitteeDebate, SPEAKER } from './renderReportExtras.js';
import { aiSummaryCard } from './aiSummary.js';
import { z } from 'zod';
import { shell, deepSlot, DEEP_SCRIPT, joinBox } from './renderHtml.js';
import { esc } from './html.js';
import { kmStatArea, kmWorldMap, type MapEntry } from './kit/market.js';
import { kmWorldMapAll, KIT_WORLD_CSS } from './kit/worldMap.js';
import { worldMapRows, worldMacroStat } from './renderWorld.js';
import type { WorldIndexQuote, WorldMacroQuote } from '../sources/naverGlobal.js';
import { gate } from './plans.js';
import { DEBATE_FILTER_SCRIPT, DEBATE_PLAY_SCRIPT, EVIDENCE_SCRIPT } from './renderReportExtras.js';
export type Period = 'daily' | 'weekly';
/** spark (G-265): the last 30 [date, close] up to the report date, kept only on each market's headline asset. */
export interface MarketAsset { symbol: string; name: string; date: string; close: number; returnPct: number | null; baseline: string | null; value: number | null; spark?: [string, number][] }
export interface MarketGroup { id: string; name: string; source: string; universe: number; assets: MarketAsset[]; snapshotDate: string | null; temperature?: MarketPulse | null; breadth: { up: number; down: number; flat: number } }
const claim = z.object({ text: z.string(), kind: z.enum(['FACT','INFERENCE','ASSUMPTION']), refs: z.array(z.string()).min(1) });
const EXPERT_IDS=[...CORE_ANALYSTS.map(a=>a.id),'MARKET','TECHNICAL','FLOW','FUNDAMENTAL','EVENT'] as unknown as [string,...string[]];
const expert=z.object({speaker:z.enum(EXPERT_IDS),stance:z.enum(['BULLISH','NEUTRAL','BEARISH','INSUFFICIENT_DATA']),claim});
const marketTurn=z.object({speaker:z.enum([...EXPERT_IDS,'RED_TEAM'] as [string,...string[]]),stance:z.enum(['BULLISH','NEUTRAL','BEARISH']),replyTo:z.number(),claim});
export const MarketCouncilSchema = z.object({ summary: claim, desks: z.array(z.object({ name: z.enum(['코스피','코스닥','코인','ETF','미국']), view: z.enum(['강세','중립','약세','판단보류']), claims: z.array(claim) })).min(4).max(5), consensus: z.array(claim), disagreements: z.array(claim), scenarios: z.array(z.object({ name: z.enum(['강세','기본','약세']), trigger: claim, outlook: claim, invalidation: claim })).length(3), redTeam: z.array(claim), watch: z.array(claim), dataGaps: z.array(z.string()), experts:z.array(expert).optional(),debate:z.array(marketTurn).optional() });
/** The model is asked for all 11 experts and 12 turns; G-278: a council missing up to two members is still published. */
export const MARKET_MIN_MEMBERS=9;
export const MarketCouncilGenerationSchema=MarketCouncilSchema.extend({experts:z.array(expert).min(MARKET_MIN_MEMBERS).max(11),debate:z.array(marketTurn).min(MARKET_MIN_MEMBERS).max(12)});
/** Extra, unsupported scenario names are dropped; the three required cases still validate strictly. */
/** What readers see when the committee could not be made. The technical reason stays in the run log only. */
export const MARKET_AI_FAILED='오늘 AI 요약을 만들지 못했어요. 위 숫자 정리를 먼저 봐 주세요. 다음 갱신 때 다시 만들어요.';
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
 // A speaker or scenario said twice keeps its first entry; a missing one is left for the strict check (and the repair try).
 const firstBy=(list:unknown,key:string)=>Array.isArray(list)?list.filter((x,i)=>!x||typeof x!=='object'||list.findIndex(y=>!!y&&typeof y==='object'&&(y as Record<string,unknown>)[key]===(x as Record<string,unknown>)[key])===i):list;
 if(Array.isArray(raw?.experts))raw.experts=firstBy(raw.experts,'speaker');
 if(Array.isArray(raw?.scenarios))raw.scenarios=firstBy(raw.scenarios,'name');
 if(Array.isArray(raw?.desks))raw.desks=firstBy(raw.desks,'name');
 // G-278: the debate keeps each expert's first turn and the last red-team turn, spoken with that expert's stance;
 // a reply whose target was dropped (or points forward, or at the same speaker) becomes a fresh remark.
 if(Array.isArray(raw?.experts)&&Array.isArray(raw?.debate)){
  const stanceOf=new Map<string,string>();for(const e of raw.experts)if(e&&typeof e==='object'&&typeof e.speaker==='string')stanceOf.set(e.speaker,e.stance==='INSUFFICIENT_DATA'?'NEUTRAL':String(e.stance));
  const turns=raw.debate.map((t:unknown,i:number)=>({t:t as Record<string,unknown>,i})).filter(({t}:{t:Record<string,unknown>})=>!!t&&typeof t==='object');
  const seen=new Set<string>(),keep:{t:Record<string,unknown>,i:number}[]=[];
  for(const x of turns){const sp=String(x.t.speaker);if(sp==='RED_TEAM'||seen.has(sp)||!stanceOf.has(sp))continue;seen.add(sp);keep.push({t:{...x.t,stance:stanceOf.get(sp)},i:x.i});}
  const red=[...turns].reverse().find(({t}:{t:Record<string,unknown>})=>t.speaker==='RED_TEAM');if(red)keep.push({t:{...red.t},i:red.i});
  const at=new Map(keep.map((x,j)=>[x.i,j]));
  raw.debate=keep.map(({t},j)=>{const r=at.get(Number(t.replyTo));return {...t,replyTo:r!==undefined&&r<j&&keep[r]!.t.speaker!==t.speaker?r:-1};});
 }
 if(Array.isArray(raw?.scenarios)){const keep=raw.scenarios.filter((s:unknown)=>!!s&&typeof s==='object'&&['강세','기본','약세'].includes(String((s as {name?:unknown}).name)));if(keep.length!==raw.scenarios.length){raw.scenarios=keep;if(Array.isArray(raw.dataGaps))raw.dataGaps.push('지원 범위를 벗어난 추가 시나리오는 제외했습니다.');}}
 return MarketCouncilSchema.parse(raw);
}
export type MarketCouncil = z.infer<typeof MarketCouncilSchema>;
/** A headline the committee may cite as N1, N2 … (public: title, outlet, time and link only). */
export interface MarketNews { id: string; title: string; publisher: string; publishedAt: string; url: string }
export interface MacroCard { id: string; label: string; unit: string; date: string; value: number; chg20: number | null; spark: [string, number][] }
export interface MarketWorld { generatedAt: string; indices: Omit<WorldIndexQuote, 'series'>[]; macro: WorldMacroQuote[] }
/** The world rows a market daily keeps: every index without its line, and the cards' rates, FX and commodities with theirs. */
export const WORLD_DAILY_KEYS = ['US10Y', 'USDKRW', 'DXY', 'VIX', 'WTI', 'GOLD'] as const;
export function marketWorld(m: { generatedAt: string; indices: readonly WorldIndexQuote[]; macro: readonly WorldMacroQuote[] }): MarketWorld | null {
 const macro = WORLD_DAILY_KEYS.map((k) => m.macro.find((q) => q.key === k)).filter((q): q is WorldMacroQuote => !!q);
 return m.indices.length || macro.length ? { generatedAt: m.generatedAt, indices: m.indices.map(({ series: _s, ...q }) => q), macro } : null;
}
export interface MarketReport { schema: 'curia.market-report.v2' | 'curia.market-report.v3' | 'curia.market-report.v4'; date: string; from: string; generatedAt: string; period: Period; groups: MarketGroup[]; news?: MarketNews[]; /** G-265: US rates, the won and VIX with their last 30 points (FRED), for the stat-line cards. */ macro?: MacroCard[]; /** G-276: the world screen's snapshot from the same run (17 indices, and the rates, FX and commodities the cards show). */ world?: MarketWorld; ai: { status: 'OK' | 'SKIPPED' | 'FAILED'; error?: string; model?: string; council?: MarketCouncil; summary?: MarketCouncil['summary']; sealed?: string } }
/** Weekly return is measured from the last close BEFORE Monday, never substituted with 5-session return. */
export function periodAsset(symbol: string, name: string, bars: readonly { date: string; close: number }[], date: string, from: string, period: Period, value: number | null = null): MarketAsset | null {
 const history = [...new Map(bars.filter(b => b.date <= date && Number.isFinite(b.close) && b.close > 0).map(b => [b.date,b])).values()].sort((a,b)=>a.date.localeCompare(b.date));
 const last=history.at(-1); if(!last) return null;
 const prev=period==='daily'?history.at(-2):history.filter(b=>b.date<from).at(-1);
 const current=last.date >= from;
 return { symbol,name,date:last.date,close:last.close,returnPct:current&&prev?(last.close/prev.close-1)*100:null,baseline:prev?.date??null,value };
}
export function weekStart(date: string): string { const d=new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)); return d.toISOString().slice(0,10); }
/** Every claim in a council, in reading order. */
const councilClaims=(c:MarketCouncil)=>[c.summary,...c.desks.flatMap(d=>d.claims),...c.consensus,...c.disagreements,...c.scenarios.flatMap(s=>[s.trigger,s.outlook,s.invalidation]),...c.redTeam,...c.watch,...(c.experts??[]).map(x=>x.claim),...(c.debate??[]).map(x=>x.claim)];
/**
 * Numbers the committee states must come from the data it was given: a signed return (−1.98%) must match an
 * asset's return, and the whole-market up/down counts must never be called the sample's ("상위30 중 하락 506개").
 * Returns the problems found, empty when the numbers hold.
 */
export function marketNumberIssues(council:MarketCouncil, groups:readonly MarketGroup[]):string[] {
 const returns=groups.flatMap(g=>g.assets.map(a=>a.returnPct)).filter((v):v is number=>v!==null);
 const breadth=new Set(groups.flatMap(g=>[g.breadth.up,g.breadth.down,g.breadth.flat]).filter(n=>n>30));
 const issues:string[]=[];
 for(const c of councilClaims(council)){
  const t=c.text.replace(/−/g,'-');
  for(const m of t.matchAll(/(?<![\d.~])([+-]\d+(?:\.(\d+))?)%(?!p)/g)){
   const v=Number(m[1]),tol=(m[2]?.length??0)>=2?0.011:0.051;
   if(!returns.some(r=>Math.abs(r-v)<=tol))issues.push(`자료에 없는 수익률 ${m[1]}%: "${c.text.slice(0,60)}"`);
  }
  for(const m of t.matchAll(/(상위\s*\d+|표본)[^.,;]{0,25}?(\d[\d,]*)\s*개/g)){
   const n=Number(m[2]!.replace(/,/g,''));
   if(breadth.has(n))issues.push(`시장 전체 등락 수 ${n}개를 표본 수치로 표기: "${c.text.slice(0,60)}"`);
  }
 }
 return issues;
}
/** G-278: what is wrong with a council, in words for the run log and the repair prompt (empty means publishable). */
export function councilProblems(council: MarketCouncil, groups: readonly MarketGroup[], news: readonly MarketNews[] = []): string[] {
 const refs=new Set([...groups.map(g=>g.id),...news.map(n=>n.id)]);
 const out:string[]=[];
 if(council.experts){
  const debate=council.debate??[];
  const spoken=debate.filter(t=>t.speaker!=='RED_TEAM'),reds=debate.filter(t=>t.speaker==='RED_TEAM');
  if(council.experts.length<MARKET_MIN_MEMBERS||new Set(council.experts.map(e=>e.speaker)).size!==council.experts.length)out.push(`experts ${council.experts.length}명(중복 없이 ${MARKET_MIN_MEMBERS}명 이상 필요)`);
  if(spoken.length<MARKET_MIN_MEMBERS||new Set(spoken.map(t=>t.speaker)).size!==spoken.length)out.push(`debate 전문가 발언 ${spoken.length}차례(각 1번, ${MARKET_MIN_MEMBERS}명 이상 필요)`);
  if(reds.length>1||(reds.length&&debate.at(-1)?.speaker!=='RED_TEAM'))out.push('RED_TEAM은 마지막에 한 번만');
  const off=spoken.filter(t=>{const e=council.experts!.find(x=>x.speaker===t.speaker);return !e||t.stance!==(e.stance==='INSUFFICIENT_DATA'?'NEUTRAL':e.stance);});
  if(off.length)out.push(`debate stance가 experts 판단과 다름: ${off.map(t=>t.speaker).slice(0,3).join(',')}`);
  const badReply=debate.filter((t,i)=>!(t.replyTo===-1||(Number.isInteger(t.replyTo)&&t.replyTo>=0&&t.replyTo<i&&debate[t.replyTo]?.speaker!==t.speaker)));
  if(badReply.length)out.push(`replyTo 오류 ${badReply.length}건`);
 }
 if(new Set(council.desks.map(d=>d.name)).size!==council.desks.length)out.push('desks 이름 중복');
 if(new Set(council.scenarios.map(s=>s.name)).size!==3)out.push('시나리오는 강세·기본·약세 각 1개');
 const unknown=[...new Set(councilClaims(council).flatMap(c=>c.refs.filter(r=>!refs.has(r))))];
 if(unknown.length)out.push(`없는 근거 번호: ${unknown.slice(0,5).join(',')} (쓸 수 있는 번호: ${[...refs].join(',')})`);
 const bare=councilClaims(council).filter(c=>!c.refs.length).length;
 if(bare)out.push(`근거 번호가 없는 문장 ${bare}개`);
 return out;
}
export function validCouncil(council: MarketCouncil, groups: readonly MarketGroup[], news: readonly MarketNews[] = []): boolean { return councilProblems(council,groups,news).length===0; }
/**
 * G-278: refs written as "M1, N3" or "M1~M5" are split into ids, ids that were never given are dropped, and a list
 * item left with no valid ref is dropped from its list. A single claim (summary, scenario, expert, debate turn) left
 * with none stays as it is, so the check still rejects it.
 */
export function tidyCouncilRefs(council: MarketCouncil, groups: readonly MarketGroup[], news: readonly MarketNews[] = []): MarketCouncil {
 const known=new Set([...groups.map(g=>g.id),...news.map(n=>n.id)]);
 const ids=(r:string)=>r.split(/[\s,/·]+/).filter(Boolean).flatMap(x=>{const m=x.match(/^([MN])(\d+)[~\-–]([MN])?(\d+)$/);if(!m)return [x];const out:string[]=[];for(let i=+m[2]!;i<=+m[4]!&&out.length<20;i++)out.push(m[1]!+i);return out;});
 const fix=<T extends {refs:string[]}>(c:T):T=>{const refs=[...new Set(c.refs.flatMap(ids))].filter(r=>known.has(r));return {...c,refs:refs.length?refs:c.refs};};
 const list=<T extends {refs:string[]}>(cs:T[]):T[]=>cs.map(fix).filter(c=>c.refs.every(r=>known.has(r))&&c.refs.length>0);
 return {...council,summary:fix(council.summary),desks:council.desks.map(d=>({...d,claims:list(d.claims)})),consensus:list(council.consensus),disagreements:list(council.disagreements),
  scenarios:council.scenarios.map(x=>({...x,trigger:fix(x.trigger),outlook:fix(x.outlook),invalidation:fix(x.invalidation)})),redTeam:list(council.redTeam),watch:list(council.watch),
  ...(council.experts?{experts:council.experts.map(e=>({...e,claim:fix(e.claim)}))}:{}),...(council.debate?{debate:council.debate.map(t=>({...t,claim:fix(t.claim)}))}:{})};
}
const pct=(n:number|null)=>n===null?'확인 필요':`${n>0?'+':''}${n.toFixed(2)}%`;
/** This source contains individual coins, never an aggregate cryptocurrency index. */
export function marketClaimText(text:string):string {
 return text.replace(/코인\s*지수는/g,'수집 코인은').replace(/코인\s*지수가/g,'수집 코인이').replace(/코인\s*지수를/g,'수집 코인을').replace(/코인\s*지수/g,'수집 코인').replace(/광폭 낙장/g,'광범위한 하락').replace(/ 락 반면/g,' 하락한 반면').replace(/낙장/g,'하락장').replace(/광폭\s*/g,'큰 폭 ');
}
const claims=(items: readonly z.infer<typeof claim>[])=>`<ul class="market-claims">${items.map(c=>`<li><span class="tag">${c.kind==='FACT'?'사실':c.kind==='INFERENCE'?'해석':'가정'}</span> ${esc(marketClaimText(c.text))} <small>${c.refs.map(r=>`<a href="#${esc(r)}">${esc(r)}</a>`).join(' · ')}</small></li>`).join('')}</ul>`;
export const marketSymbol=(period:Period)=>`MARKET-${period.toUpperCase()}`;
/** G-265 (Bklit stat-card-line): one macro series as a big number, its 20-session move and a thin line. */
export function macroStat(m: MacroCard): string {
  const c = m.chg20, tone = c == null || c === 0 ? '' : c > 0 ? 'up' : 'down';
  const text = c == null ? '—' : `${c > 0 ? '▲' : c < 0 ? '▼' : ''} ${m.unit === '%' ? `${Math.abs(c * 100).toFixed(0)}bp` : m.unit === '원' ? `${Math.abs(c).toFixed(1)}원` : Math.abs(c).toFixed(1)}`;
  return kmStatArea({ title: m.label, value: m.value, change: null, badge: { text, tone }, series: m.spark, digits: m.unit === '%' ? 2 : 1, line: true, step: m.id === 'DFF', label: m.unit === '%' ? `% · ${m.date.slice(5).replace('-', '/')}` : m.unit === '원' ? `원 · ${m.date.slice(5).replace('-', '/')}` : m.date.slice(5).replace('-', '/'), unit: '일' });
}
export function renderMarketDeep(r:MarketReport):string {
 const groupHtml=r.groups.map(g=>{
  const available=g.assets.filter(a=>a.returnPct!==null); const sort=[...available].sort((a,b)=>b.returnPct!-a.returnPct!);
  const table=(list:readonly MarketAsset[])=>`<div class="table-wrap"><table><thead><tr><th>자산</th><th>가격</th><th>${r.period==='weekly'?'이번 주 누적':'일간'} 등락</th><th>가격 기준일</th><th>비교 시작일</th></tr></thead><tbody>${list.map(a=>`<tr><td>${esc(a.name)} <small>${esc(a.symbol)}</small></td><td>${a.close.toLocaleString('ko-KR',{maximumFractionDigits:4})}</td><td class="${a.returnPct!==null&&a.returnPct>0?'up':'down'}">${pct(a.returnPct)}</td><td>${esc(a.date)}</td><td>${esc(a.baseline??'없음')}</td></tr>`).join('')}</tbody></table></div>`;
  return `<section class="card block" id="${g.id}"><h2>${esc(g.name)}</h2><p class="muted">근거 ${g.id} · ${esc(g.source)} · 수집 ${g.assets.length}/${g.universe} · 기간 수익률 계산 가능 ${available.length}</p><p>현재 스냅샷(${esc(g.snapshotDate??'확인 필요')}) 상승 ${g.breadth.up} · 하락 ${g.breadth.down} · 보합 ${g.breadth.flat}개. ${r.period==='weekly'?'이 숫자는 주간 상승·하락 종목 수가 아닙니다.':''}</p>${g.assets.length?table(g.assets.slice(0,g.assets.length<=2?2:8)):'<p>수집된 데이터가 없습니다.</p>'}${g.assets.length>2?`<details><summary>기간 상승·하락 상위 각 5개</summary><h3>상승 상위</h3>${table(sort.slice(0,5))}<h3>하락 상위</h3>${table(sort.slice(-5).reverse())}</details>`:''}</section>`;
 }).join('');
 const c=r.ai.council;
 const ai=c?`${c.experts?.length?`<details class="card block"><summary>전문가별 판단 · ${c.experts.length}명</summary><div class="desk-grid" style="margin-top:12px">${c.experts.map(e=>`<article class="card"><h3>${esc(SPEAKER[e.speaker]??e.speaker)}</h3><b class="${e.stance==='BULLISH'?'up':e.stance==='BEARISH'?'down':'muted'}">${e.stance==='BULLISH'?'▲ 강세':e.stance==='BEARISH'?'▼ 약세':e.stance==='INSUFFICIENT_DATA'?'근거 부족':'● 중립'}</b>${claims([e.claim])}</article>`).join('')}</div></details>`:''}${aiSummaryCard(marketClaimText(c.summary.text),'위원회 판단',r.date)}<section class="block"><div class="block-head"><h2>조건별 시나리오</h2><span class="muted small">조건이 달라지면 판단도 바뀝니다</span></div><div class="market-scenarios">${c.scenarios.map(s=>`<section class="card market-scenario ${s.name==='강세'?'bull':s.name==='약세'?'bear':'base'}"><h3>${s.name==='강세'?'▲':s.name==='약세'?'▼':'●'} ${esc(s.name)}</h3><h4>성립 조건</h4>${claims([s.trigger])}<h4>전망</h4>${claims([s.outlook])}<h4>무효화 조건</h4>${claims([s.invalidation])}</section>`).join('')}</div></section>${c.debate?.length?renderCommitteeDebate({status:'OK',evidence:[...r.groups.map(g=>({id:g.id,kind:'MARKET' as const,label:g.name+' · '+g.source+' · 기준 '+(g.snapshotDate??'확인 필요'),detail:'',url:'#'+g.id})),...(r.news??[]).map(n=>({id:n.id,kind:'NEWS' as const,label:n.title,detail:n.publisher,url:n.url}))],debate:c.debate.map(t=>({...t,speaker:t.speaker as import('../analysis/commentary.js').Speaker,replyTo:t.replyTo,claim:{text:marketClaimText(t.claim.text),kind:t.claim.kind,evidenceIds:t.claim.refs}}))}):`<section class="block" id="debate"><h2>이전 형식의 시장 관점</h2><div class="card debate">${c.desks.map(d=>`<div class="db-turn db-mid" data-speaker="${esc(d.name)}"><div class="db-who"><b>${esc(d.name)}</b> · ${esc(d.view)}</div><div class="db-bubble">${claims(d.claims)}</div></div>`).join('')}</div><p class="fine">이 기록은 전문가 토론 형식 도입 전 리포트입니다.</p></section>`}<section class="block grid-eq"><div class="card"><h2>합의된 판단</h2>${claims(c.consensus)}</div><div class="card"><h2>남은 쟁점</h2>${claims(c.disagreements)}</div></section><section class="card block"><h2>다음 관찰 항목</h2>${claims(c.watch)}${c.dataGaps.length?`<details><summary>자료 공백 ${c.dataGaps.length}개</summary><ul>${c.dataGaps.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:''}</section>`:`<section class="card block"><p>${r.ai.status==='FAILED'?MARKET_AI_FAILED:'AI 위원회 해설은 아직 만들어지지 않았어요.'}</p></section>`;
 return `<section class="block" id="council">${ai}</section><details class="card block market-evidence"><summary>판단 근거 · 코스피·코스닥·코인·ETF 데이터</summary>${groupHtml}</details>`;

}
const MARKET_CSS=`<style>.mk-pager{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin:18px 0 6px}.mk-pager>a:not(.mk-all){display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:var(--surface);text-decoration:none;color:var(--fg)}.mk-pager>a.nx{text-align:right}.mk-pager small{font-size:12px;color:var(--muted)}.mk-pager b{font-size:15px}.mk-all{font-size:13px;font-weight:700;color:var(--accent-strong)}.mk-lead h1{font-size:24px;margin:6px 0 4px}.mk-verdict{font-size:17px;font-weight:800;margin:10px 0 2px;line-height:1.45}.mk-meta{font-size:12.5px;color:var(--muted);margin:4px 0 0}
.mk-ix{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.mk-ix .card{padding:12px 14px}.mk-ix .pl-k{display:flex;justify-content:space-between;gap:6px}.mk-ix .pl-k small{color:var(--muted);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mk-v{font-size:19px;font-weight:800;font-variant-numeric:tabular-nums;margin:2px 0}.mk-c{font-size:13.5px;font-weight:700;font-variant-numeric:tabular-nums}.mk-br{display:flex;height:6px;border-radius:4px;overflow:hidden;margin:8px 0 4px;background:var(--soft)}.mk-br i{display:block}.mk-br .u{background:var(--up)}.mk-br .f{background:var(--line-strong)}.mk-br .d{background:var(--down)}.mk-ix small.n{font-size:11.5px;color:var(--muted)}
.mk-points{margin:0;padding-left:18px;line-height:1.75;font-size:14.5px}.mk-points li{margin:4px 0}
.mk-tabs{margin:0 0 12px}.mk-panel[hidden]{display:none}.mk-movers{display:grid;grid-template-columns:1fr 1fr;gap:12px}.mk-movers h3{font-size:13px;color:var(--muted);margin:0 0 6px}.mk-row{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-top:1px solid var(--line);font-size:14px}.mk-row:first-of-type{border-top:0}.mk-row span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mk-row b{font-variant-numeric:tabular-nums;white-space:nowrap}.mk-panel .tmp{margin-bottom:12px}
.mk-news{list-style:none;margin:0;padding:0}.mk-news li{display:flex;gap:10px;padding:9px 0;border-top:1px solid var(--line);scroll-margin-top:90px}.mk-news li:first-child{border-top:0}.mk-news li:target{background:var(--warn-soft);border-radius:8px}.mk-nid{flex:none;font-size:11px;font-weight:800;color:var(--muted);background:var(--soft);border-radius:6px;padding:2px 6px;height:fit-content;margin-top:2px}.mk-news a{font-weight:700;font-size:14.5px;line-height:1.45;text-decoration:none;color:var(--fg)}.mk-news small{display:block;font-size:12px;color:var(--muted);margin-top:2px}.ai-summary .as-list{margin:0;padding-left:18px;line-height:1.8}.ai-summary .as-list li{margin:3px 0}
@media(max-width:820px){.mk-ix{grid-template-columns:1fr 1fr;gap:8px}.mk-v{font-size:17px}.mk-movers{grid-template-columns:minmax(0,1fr)}}</style>`;

/** The market's headline number: its index for stocks, the most-traded asset for coins and ETFs. */
const headline=(g:MarketGroup)=>g.assets.find(a=>a.symbol==='KOSPI'||a.symbol==='KOSDAQ')??g.assets[0]??null;
const isIndex=(a:MarketAsset)=>a.symbol==='KOSPI'||a.symbol==='KOSDAQ';
const moveText=(v:number|null)=>v==null?'—':`${v>0?'▲ +':v<0?'▼ ':''}${v.toFixed(2)}%`;
const toneOf=(v:number|null)=>v==null||v===0?'':v>0?'up':'down';
const topic=(w:string)=>{const c=w.charCodeAt(w.length-1);return w+(c>=0xac00&&c<=0xd7a3&&(c-0xac00)%28?'은':'는');};
const share=(g:MarketGroup)=>{const t=g.breadth.up+g.breadth.down+g.breadth.flat;return t?g.breadth.up/t*100:null;};

/** Plain-language points from the published numbers only (no AI): breadth, the index move, the best and worst of the sample. */
export function marketPoints(r:MarketReport):string[] {
 const out:string[]=[];
 const leaning=r.groups.map(g=>({g,s:share(g)})).filter(x=>x.s!=null);
 const down=leaning.filter(x=>x.s!<45).map(x=>x.g.name),up=leaning.filter(x=>x.s!>55).map(x=>x.g.name);
 if(leaning.length)out.push(down.length===leaning.length?`${down.join('·')} 모두 내린 종목이 더 많았어요.`:up.length===leaning.length?`${up.join('·')} 모두 오른 종목이 더 많았어요.`:`${up.length?topic(up.join('·'))+' 오른 종목이, ':''}${down.length?topic(down.join('·'))+' 내린 종목이 ':''}더 많았고 나머지는 엇갈렸어요.`);
 for(const g of r.groups){
  const h=headline(g),s=share(g),rest=g.assets.filter(a=>!isIndex(a)&&a.returnPct!=null).sort((a,b)=>b.returnPct!-a.returnPct!);
  const best=rest[0],worst=rest.at(-1);
  const lead=h&&h.returnPct!=null?(isIndex(h)?`${g.name} 지수 ${moveText(h.returnPct)}`:`${topic(g.name)} ${h.name} ${moveText(h.returnPct)}`):g.name;
  const breadth=s==null?'':`, 오른 종목 비중 ${s.toFixed(0)}%`;
  const ends=best&&worst&&best!==worst?` · 표본 중 가장 강한 ${best.name} ${moveText(best.returnPct)}, 가장 약한 ${worst.name} ${moveText(worst.returnPct)}`:'';
  out.push(`${lead}${breadth}${ends}.`);
 }
 return out;
}

/** Overall call in one line, from breadth across the four markets. */
function verdict(r:MarketReport):string {
 const s=r.groups.map(share).filter((x):x is number=>x!=null);
 if(!s.length)return '시장 자료를 모으지 못했어요.';
 const avg=s.reduce((a,b)=>a+b,0)/s.length;
 return avg<40?'내린 종목이 뚜렷하게 많은 약세 하루였어요.':avg<47?'내린 종목이 조금 더 많은 하루였어요.':avg>60?'오른 종목이 뚜렷하게 많은 강세 하루였어요.':avg>53?'오른 종목이 조금 더 많은 하루였어요.':'오른 종목과 내린 종목이 비슷하게 엇갈렸어요.';
}

export function renderMarketReport(r:MarketReport, base='', nav:{prev?:string|undefined;next?:string|undefined}={}):string {
 const summary=r.ai.summary??r.ai.council?.summary;
 const d=new Date(`${r.date}T00:00:00Z`),title=`${d.getUTCMonth()+1}월 ${d.getUTCDate()}일 시장 데일리`;
 const lead=`<section class="card block market-lead mk-lead"><a class="ml-back" href="${base}market-reports.html">‹ 시장 데일리 모음</a><h1>${esc(title)}</h1><p class="mk-verdict">${esc(verdict(r))}</p><p class="mk-meta">코스피 · 코스닥 · 코인 · ETF · 가격 기준 ${esc(r.date)}${r.period==='weekly'?' · 주중 누적 집계':''}</p><details><summary class="muted small">데이터 기준·분석 범위</summary><p class="fine">생성 ${esc(r.generatedAt)} · 한국 증시: 거래일 종가 · 코인: 업비트 원화 일봉(09:00 KST 경계), 당일 봉은 진행 중 가격 스냅샷입니다. 휴장·수집 실패는 각 자산의 실제 기준일로 확인하세요.</p><p class="fine">국내 주식의 시가총액 상위 표본과 수집된 ETF·업비트 원화 코인 기준입니다. ETF 가격 수익률은 분배금을 포함한 총수익률이 아닙니다.</p></details></section>`;
 const ix=`<section class="block"><div class="block-head"><h2>지수 한눈에</h2><span class="muted small">선은 최근 30거래일 · 막대는 오른·보합·내린 종목 비율</span></div><div class="mk-ix">${r.groups.map(g=>{const h=headline(g),t=g.breadth.up+g.breadth.down+g.breadth.flat||1;
  // G-265: a Bklit stat card: the close, today's move as the badge, the last 30 closes as a soft area (reports from before G-265 have none).
  return kmStatArea({title:g.name,...(h&&!isIndex(h)?{sub:h.name}:{}),value:h?.close??null,change:h?.returnPct??null,...(h?.spark?{series:h.spark}:{}),digits:!h||isIndex(h)?2:h.close>=1000?0:h.close>=1?2:4,foot:`<div class="mk-br" aria-hidden="true"><i class="u" style="width:${(g.breadth.up/t*100).toFixed(1)}%"></i><i class="f" style="width:${(g.breadth.flat/t*100).toFixed(1)}%"></i><i class="d" style="width:${(g.breadth.down/t*100).toFixed(1)}%"></i></div><small class="n"><span class="up">▲${g.breadth.up.toLocaleString('ko-KR')}</span> · <span class="down">▼${g.breadth.down.toLocaleString('ko-KR')}</span></small>`});}).join('')}</div></section>`;
 // G-276: the same 13-country map and rate cards as the 세계 screen, from the run's world snapshot. Reports from before
 // G-276 keep the G-265 two-country map (코스피, SPY) and the FRED cards.
 const kospi=r.groups.find(g=>g.id==='M1')?.assets.find(a=>a.symbol==='KOSPI'),spy=r.groups.find(g=>g.id==='M5')?.assets.find(a=>a.symbol==='SPY');
 const mapRows:MapEntry[]=[...(kospi?[{iso:'KR' as const,country:'한국',index:'코스피',change:kospi.returnPct,date:kospi.date}]:[]),...(spy?[{iso:'US' as const,country:'미국',index:'S&P 500',change:spy.returnPct,date:spy.date}]:[])];
 const w=r.world,wx=w?.indices.length?worldMapRows(w.indices.map(q=>({...q,series:[]}))):[];
 const more=`<a class="mk-more" href="${base}index.html#stocks">홈에서 세계 시장 더 보기 ›</a>`;
 const world=wx.length?`<style>${KIT_WORLD_CSS}.mk-more{display:block;margin-top:8px;font-size:13px;font-weight:600;color:var(--fg);text-decoration:none}</style><section class="card block"><div class="block-head" style="margin:0 0 6px"><h2>세계 증시 지도</h2><span class="muted small">하루 등락 · ${wx.filter(x=>x.iso!=='EU').length}곳</span></div>${kmWorldMapAll(wx,'나라를 누르면 지수와 등락이 떠요. 빨강은 오름, 파랑은 내림, 진할수록 많이 움직였어요.')}${more}</section>`
  :mapRows.length?`<section class="card block"><div class="block-head" style="margin:0 0 6px"><h2>세계 증시 지도</h2><span class="muted small">${r.period==='weekly'?'이번 주 누적':'일간'} 등락</span></div>${kmWorldMap(mapRows,'GNOMON은 한국(코스피)과 미국(S&P 500을 따라가는 SPY ETF) 자료만 모아서 두 나라만 색칠했어요. 회색은 자료가 없는 나라예요.')}</section>`:'';
 const wq=(k:string)=>w?.macro.find(q=>q.key===k)??null;
 const macro=w?.macro.length?`<section class="block"><div class="block-head"><h2>금리·환율·원자재</h2><span class="muted small">하루 등락 · 선은 최근 30일</span></div><div class="mk-ix">${[worldMacroStat(wq('US10Y'),true),worldMacroStat(wq('USDKRW'),true),worldMacroStat(wq('DXY'),true),worldMacroStat(wq('VIX'),true),worldMacroStat(wq('WTI')),worldMacroStat(wq('GOLD'))].join('')}</div></section>`
  :r.macro?.length?`<section class="block"><div class="block-head"><h2>금리·환율·변동성</h2><span class="muted small">미국 자료(FRED)라 하루 늦어요 · 배지는 20거래일 변화</span></div><div class="mk-ix">${r.macro.map(macroStat).join('')}</div></section>`:'';
 const points=`<section class="card block"><h2>핵심 포인트</h2><ul class="mk-points">${marketPoints(r).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="fine">수집한 숫자만으로 정리했어요. 해석은 아래 AI 요약과 위원회 판단을 보세요.</p></section>`;
 const row=(a:MarketAsset)=>`<div class="mk-row"><span>${esc(a.name)}</span><b class="${toneOf(a.returnPct)}">${moveText(a.returnPct)}</b></div>`;
 const panels=r.groups.map((g,i)=>{const rest=g.assets.filter(a=>!isIndex(a)&&a.returnPct!=null).sort((a,b)=>b.returnPct!-a.returnPct!);
  const card=marketTemperature(g.temperature??null,g.breadth,g.name,(g.id==='M5'?base+'screener.html#us':base+'screener.html'+(g.id==='M3'?'#coin':g.id==='M4'?'#etf':'')));
  return `<div class="mk-panel" data-mk="${esc(g.id)}"${i?' hidden':''}>${card}${rest.length>1?`<div class="mk-movers"><div><h3>표본 상승 상위</h3>${rest.slice(0,3).map(row).join('')}</div><div><h3>표본 하락 상위</h3>${rest.slice(-3).reverse().map(row).join('')}</div></div>`:''}<p class="fine">${esc(g.source)} · 표본 ${g.assets.length}개 / 전체 ${g.universe.toLocaleString('ko-KR')}개</p></div>`;}).join('');
 const markets=`<section class="card block" id="markets"><h2>시장별로 보기</h2><div class="seg mk-tabs" role="group" aria-label="시장">${r.groups.map((g,i)=>`<button type="button" data-mk-tab="${esc(g.id)}" aria-pressed="${i===0}">${esc(g.name)}</button>`).join('')}</div>${panels}</section>`;
 const ai=aiSummaryCard(marketClaimText(summary?.text??(r.ai.status==='FAILED'?MARKET_AI_FAILED:'AI 요약을 준비하고 있어요.')),'AI 위원회 요약',r.date,true);
 const kstTime=(iso:string)=>new Date(Date.parse(iso)+9*3600000).toISOString().slice(11,16);
 const news=r.news?.length?`<section class="card block" id="news"><div class="head"><h2>오늘의 시장 뉴스</h2><span class="sub" style="margin:0">위원회가 N 번호로 인용해요</span></div><ol class="mk-news">${r.news.map(n=>`<li id="${esc(n.id)}"><span class="mk-nid">${esc(n.id)}</span><div><a href="${esc(n.url)}" rel="noopener" target="_blank">${esc(n.title)}</a><small>${esc(n.publisher)} · ${esc(kstTime(n.publishedAt))}</small></div></li>`).join('')}</ol><p class="fine">뉴스 검색과 언론사 RSS에서 오늘 나온 기사 제목만 모았어요. 같은 이야기는 하나로 묶었어요.</p></section>`:'';
 const md=(x:string)=>{const t=new Date(`${x}T00:00:00Z`);return `${t.getUTCMonth()+1}월 ${t.getUTCDate()}일`;};
 const pager=nav.prev||nav.next?`<nav class="mk-pager" aria-label="다른 날 시장 데일리">${nav.prev?`<a href="daily-${esc(nav.prev)}.html"><small>‹ 전날</small><b>${md(nav.prev)}</b></a>`:'<span></span>'}<a class="mk-all" href="${base}market-reports.html">모아 보기</a>${nav.next?`<a class="nx" href="daily-${esc(nav.next)}.html"><small>다음 날 ›</small><b>${md(nav.next)}</b></a>`:'<span></span>'}</nav>`:'';
 const body=`${MARKET_CSS}${lead}${ix}${world}${macro}${points}${ai}${news}${markets}<div class="block-head" style="margin-top:8px"><h2>AI 위원회 판단</h2><span class="muted small">전문가 11명 판단 · 시나리오 · 토론</span></div>${deepSlot(marketSymbol(r.period),r.date)}<div class="join-wrap"><div class="card">${gate(joinBox({symbol:marketSymbol(r.period),name:`${r.date} 시장 데일리`}).replace('data-name=',`data-report-date="${esc(r.date)}" data-name=`),{base,what:'시장 위원회에 질문·반론하기', feature: 'marketAsk'})}</div></div>${pager}`;
 const tabs=`<script>document.addEventListener('click',function(e){var b=e.target.closest('[data-mk-tab]');if(!b)return;var id=b.getAttribute('data-mk-tab');document.querySelectorAll('[data-mk-tab]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});document.querySelectorAll('.mk-panel').forEach(function(p){p.hidden=p.getAttribute('data-mk')!==id;});});</script>`;
 return shell(base,`${title} | GNOMON`,body,{scripts:EVIDENCE_SCRIPT+DEBATE_FILTER_SCRIPT+DEBATE_PLAY_SCRIPT+DEEP_SCRIPT+tabs+`<script>document.addEventListener('click',function(e){var a=e.target.closest('a[href^="#M"],a[href^="#N"]');if(!a)return;var target=document.getElementById(a.getAttribute('href').slice(1));if(target){var p=target.parentElement;while(p){if(p.tagName==='DETAILS')p.open=true;p=p.parentElement;}}});</script>`});
}

export function renderMarketReportIndex(reports: readonly MarketReport[]):string {
 const list=reports.filter(r=>r.period==='daily').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
 const day=(d:string)=>'일월화수목금토'[new Date(`${d}T00:00:00Z`).getUTCDay()];
 const first=(t?:string)=>(t?marketClaimText(t).split(/(?<=[.다요])\s/).slice(0,2).join(' '):'');
 const card=(r:MarketReport,i:number)=>{
  const line=r.ai.status==='OK'?first(r.ai.summary?.text??r.ai.council?.summary?.text):r.ai.status==='FAILED'?'AI 요약을 만들지 못했어요. 시장 수치는 볼 수 있어요.':'AI 요약을 준비하고 있어요.';
  // G-190: each market as a small up/flat/down bar with its index move, so the days compare at a glance.
  const groups=r.groups.map(g=>{const t=g.breadth.up+g.breadth.down+g.breadth.flat||1,h=headline(g),mv=h&&isIndex(h)?h.returnPct??null:null;
   return `<span class="mi-gi"><b>${esc(g.name)}</b>${mv==null?'':`<em class="${toneOf(mv)}">${moveText(mv)}</em>`}<i class="mi-bar" aria-label="오른 ${g.breadth.up} · 내린 ${g.breadth.down}"><i class="u" style="width:${(g.breadth.up/t*100).toFixed(1)}%"></i><i class="f" style="width:${(g.breadth.flat/t*100).toFixed(1)}%"></i><i class="d" style="width:${(g.breadth.down/t*100).toFixed(1)}%"></i></i><small><span class="up">▲${g.breadth.up}</span> <span class="down">▼${g.breadth.down}</span></small></span>`;}).join('');
  return `<a class="mi-card${i?'':' latest'}" href="market/${r.period}-${r.date}.html"><div class="mi-top"><b>${esc(r.date.slice(5).replace('-','/'))} (${day(r.date)})</b>${i?'':'<span class="badge sm dark">최신</span>'}<span class="badge sm ${r.ai.status==='OK'?'ok':'mute'}">${r.ai.status==='OK'?'AI 위원회':'수치만'}</span></div><p>${esc(line)}</p><div class="mi-g">${groups}</div></a>`;
 };
 const style=`<style>.mi{max-width:820px;margin:16px auto 32px}.mi-head{padding:18px;margin-bottom:12px}.mi-head h1{font-size:24px;margin:2px 0 6px}.mi-head p{margin:0;font-size:14px}.mi-list{display:grid;gap:10px}.mi-card{display:block;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 16px;text-decoration:none;color:var(--fg)}.mi-card:hover{border-color:var(--accent)}.mi-card.latest{border:1.5px solid var(--navy)}.mi-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.mi-top b{font-size:16px;margin-right:auto}.mi-card p{margin:6px 0 8px;font-size:14px;line-height:1.55;color:var(--fg2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.mi-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}.mi-gi{display:grid;grid-template-columns:auto 1fr;align-items:baseline;gap:2px 6px;min-width:0}.mi-gi b{color:var(--fg2);font-size:12.5px}.mi-gi em{justify-self:end;font-style:normal;font-weight:800}.mi-bar{grid-column:1/-1;display:flex;height:5px;border-radius:3px;overflow:hidden;background:var(--soft)}.mi-bar i{display:block;height:100%}.mi-bar .u{background:var(--up)}.mi-bar .f{background:var(--line-strong)}.mi-bar .d{background:var(--down,var(--accent))}.mi-gi small{grid-column:1/-1;font-size:11px}.mi-gi small .up,.mi-gi small .down{font-weight:700}@media (min-width:640px){.mi-g{grid-template-columns:repeat(4,minmax(0,1fr))}}.mi-empty{padding:18px}</style>`;
 return shell('','시장 데일리 | GNOMON',`${style}<div class="mi"><section class="card mi-head"><div class="pl-k">시장 데일리</div><h1>매일 시장 리포트</h1><p class="muted">코스피·코스닥·코인·ETF의 오늘 흐름과 AI 위원회의 관점·반론을 날짜별로 모았어요. 숫자는 오른 종목(▲)과 내린 종목(▼) 수예요.</p></section><div class="mi-list">${list.map(card).join('')||'<div class="card mi-empty muted">아직 시장 리포트가 없어요.</div>'}</div></div>`,{chat:false,noFeedback:true,mode:'market-reports.html'});
}
