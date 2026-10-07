import { z } from 'zod';
import { shell } from './renderHtml.js';
import { esc } from './html.js';
export type Period = 'daily' | 'weekly';
export interface MarketAsset { symbol: string; name: string; date: string; close: number; returnPct: number | null; baseline: string | null; value: number | null }
export interface MarketGroup { id: string; name: string; source: string; universe: number; assets: MarketAsset[]; snapshotDate: string | null; breadth: { up: number; down: number; flat: number } }
const claim = z.object({ text: z.string(), kind: z.enum(['FACT','INFERENCE','ASSUMPTION']), refs: z.array(z.string()).min(1) });
export const MarketCouncilSchema = z.object({ summary: claim, desks: z.array(z.object({ name: z.enum(['코스피','코스닥','코인','ETF']), view: z.enum(['강세','중립','약세','판단보류']), claims: z.array(claim) })), consensus: z.array(claim), disagreements: z.array(claim), scenarios: z.array(z.object({ name: z.enum(['강세','기본','약세']), trigger: claim, outlook: claim, invalidation: claim })), redTeam: z.array(claim), watch: z.array(claim), dataGaps: z.array(z.string()) });
export type MarketCouncil = z.infer<typeof MarketCouncilSchema>;
export interface MarketReport { schema: 'curia.market-report.v2'; date: string; from: string; generatedAt: string; period: Period; groups: MarketGroup[]; ai: { status: 'OK' | 'SKIPPED' | 'FAILED'; error?: string; model?: string; council?: MarketCouncil } }
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
 const claims=[council.summary,...council.desks.flatMap(d=>d.claims),...council.consensus,...council.disagreements,...council.scenarios.flatMap(s=>[s.trigger,s.outlook,s.invalidation]),...council.redTeam,...council.watch];
 return new Set(council.desks.map(d=>d.name)).size===4 && new Set(council.scenarios.map(s=>s.name)).size===3 && claims.every(c=>c.refs.length>0&&c.refs.every(r=>refs.has(r)));
}
const pct=(n:number|null)=>n===null?'확인 필요':`${n>0?'+':''}${n.toFixed(2)}%`;
const claims=(items: readonly z.infer<typeof claim>[])=>`<ul>${items.map(c=>`<li><span class="tag">${esc(c.kind)}</span> ${esc(c.text)} <small>${c.refs.map(r=>`<a href="#${esc(r)}">${esc(r)}</a>`).join(' · ')}</small></li>`).join('')}</ul>`;
export function renderMarketReport(r:MarketReport, base=''):string {
 const groupHtml=r.groups.map(g=>{
  const available=g.assets.filter(a=>a.returnPct!==null); const sort=[...available].sort((a,b)=>b.returnPct!-a.returnPct!);
  const table=(list:readonly MarketAsset[])=>`<div class="table-wrap"><table><thead><tr><th>자산</th><th>가격</th><th>${r.period==='weekly'?'이번 주 누적':'일간'} 등락</th><th>가격 기준일</th><th>비교 시작일</th></tr></thead><tbody>${list.map(a=>`<tr><td>${esc(a.name)} <small>${esc(a.symbol)}</small></td><td>${a.close.toLocaleString('ko-KR',{maximumFractionDigits:4})}</td><td class="${a.returnPct!==null&&a.returnPct>0?'up':'down'}">${pct(a.returnPct)}</td><td>${esc(a.date)}</td><td>${esc(a.baseline??'없음')}</td></tr>`).join('')}</tbody></table></div>`;
  return `<section class="card block" id="${g.id}"><h2>${esc(g.name)}</h2><p class="muted">근거 ${g.id} · ${esc(g.source)} · 수집 ${g.assets.length}/${g.universe} · 기간 수익률 계산 가능 ${available.length}</p><p>현재 스냅샷(${esc(g.snapshotDate??'확인 필요')}) 상승 ${g.breadth.up} · 하락 ${g.breadth.down} · 보합 ${g.breadth.flat}개. ${r.period==='weekly'?'이 숫자는 주간 상승·하락 종목 수가 아닙니다.':''}</p>${g.assets.length?table(g.assets.slice(0,g.assets.length<=2?2:8)):'<p>수집된 데이터가 없습니다.</p>'}${g.assets.length>2?`<details><summary>기간 상승·하락 상위 각 5개</summary><h3>상승 상위</h3>${table(sort.slice(0,5))}<h3>하락 상위</h3>${table(sort.slice(-5).reverse())}</details>`:''}</section>`;
 }).join('');
 const c=r.ai.council;
 const ai=c?`${claims([c.summary])}<div class="grid2">${c.desks.map(d=>`<section class="card"><h3>${esc(d.name)} · ${esc(d.view)}</h3>${claims(d.claims)}</section>`).join('')}</div><h3>합의</h3>${claims(c.consensus)}<h3>이견·쟁점</h3>${claims(c.disagreements)}${c.scenarios.map(s=>`<section class="card block"><h3>${esc(s.name)} 시나리오</h3><h4>성립 조건</h4>${claims([s.trigger])}<h4>전망</h4>${claims([s.outlook])}<h4>무효화 조건</h4>${claims([s.invalidation])}</section>`).join('')}<h3>레드팀 반론</h3>${claims(c.redTeam)}<h3>다음 관찰 항목</h3>${claims(c.watch)}<h3>자료 공백</h3><ul>${c.dataGaps.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<p>AI 위원회 해설은 ${r.ai.status==='FAILED'?'생성에 실패했습니다':'아직 생성되지 않았습니다'}. ${esc(r.ai.error??'')}</p>`;
 return shell(base,`${r.date} ${r.period==='daily'?'데일리':'위클리'} 시장 리포트 | CURIA`,`<section class="card block"><a href="${base}market-reports.html">시장 리포트 모음</a><h1>${r.period==='daily'?'오늘의 데일리':'이번 주 위클리'} 시장 리포트</h1><p>${esc(r.from)} ~ ${esc(r.date)} ${r.period==='weekly'?'· 주중 누적 집계 (완료된 주간 리포트 아님)':''}</p><p class="muted">생성 ${esc(r.generatedAt)} · 한국 증시: 거래일 종가 · 코인: 업비트 원화 일봉(09:00 KST 경계), 당일 봉은 진행 중 가격 스냅샷입니다. 휴장·수집 실패는 각 자산의 실제 기준일로 확인하세요.</p><p>국내 주식의 시가총액 상위 표본과 수집된 ETF·업비트 원화 코인 기준입니다. ETF 가격 수익률은 분배금을 포함한 총수익률이 아닙니다.</p><nav>${r.groups.map(g=>`<a href="#${g.id}">${esc(g.name)}</a>`).join(' · ')} · <a href="#council">AI 위원회</a></nav></section>${groupHtml}<section class="block" id="council"><h2>AI 위원회 시장 심층 리포트</h2><p>판단은 근거 번호와 연결되며, 전망은 조건부 시나리오입니다.</p>${ai}</section>`,{chat:false});
}
export function renderMarketReportIndex(reports: readonly MarketReport[]):string {
 return shell('','시장 데일리·위클리 | CURIA',`<section class="card block"><h1>시장 데일리 · 위클리</h1><p>코스피·코스닥·코인·ETF 현황을 살펴보고, AI 위원회의 관점과 반론을 비교하세요.</p>${(['daily','weekly'] as const).map(period=>`<h2>${period==='daily'?'데일리':'위클리'}</h2><ul>${reports.filter(r=>r.period===period).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30).map(r=>`<li><a href="market/${r.period}-${r.date}.html">${esc(r.date)} ${period==='daily'?'오늘 시장':'이번 주 누적'} · AI ${esc(r.ai.status)}</a></li>`).join('')||'<li>아직 리포트가 없습니다.</li>'}</ul>`).join('')}</section>`,{chat:false});
}
