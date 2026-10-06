import type { DailyReport } from './dailyReport.js';
import { LOCKED_TEXT } from '../analysis/commentary.js';

const names = { BULL: '강세', BASE: '기본', BEAR: '약세' } as const;
const colors = { BULL: '#cb3c46', BASE: '#69788d', BEAR: '#2862bd' } as const;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
export function scenarioPlot(report: DailyReport, kind: keyof typeof names): string {
 const c=report.commentary?.status==='OK'?report.commentary:undefined;
 const s=c?.scenarios?.find(x=>x.kind===kind);
 if(!c)return '<div class="v2-mask"><div class="v2-mask-shapes" aria-hidden="true"><i></i><i></i><i></i></div><p class="muted small">🔒 시나리오가 아직 생성되지 않았어요. 리포트 생성 후 이 차트에서 확인할 수 있어요.</p></div>';
 if(!s||s.narrative.text===LOCKED_TEXT)return '<p class="muted small">🔒 심층 리포트 열람 권한이 필요해요.</p>';
 const z=s.zone?.every(x=>Number.isFinite(x)&&x>0)&&s.zone[0]<=s.zone[1]?s.zone:undefined;
 // Legacy reports describe prices in claims but have no separate zone field.
 const mentioned=[s.narrative.text,...s.catalysts??[],...s.invalidation??[]].join(' ');
 const marks=[...mentioned.matchAll(/([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*원/g)].map(m=>Number(m[1]!.replace(/,/g,''))).filter(v=>Number.isFinite(v)&&v>0);
 const levels=[...new Set([...(s.trigger?[s.trigger]:[]),...marks])].slice(0,6);
 const history=(report.recentCloses??[]).slice(-30).filter(x=>Number.isFinite(x.close)&&x.close>0);
 const close=report.price?.close;
 if(!close||!history.length)return '<p class="muted small">차트에 필요한 가격 기록이 없어요.</p>';
 const zones=c?.scenarios?.filter(x=>x.narrative.text!==LOCKED_TEXT&&x.zone?.every(v=>Number.isFinite(v)&&v>0)).flatMap(x=>x.zone!)??[];
 const values=[...history.map(x=>x.close),...zones,close,...levels];
 const lo=Math.min(...values),hi=Math.max(...values),pad=Math.max((hi-lo)*.15,close*.015),min=lo-pad,max=hi+pad;
 const y=(v:number)=>192-(v-min)/(max-min)*160;
 const points=history.map((p,i)=>`${52+i/Math.max(1,history.length-1)*176},${y(p.close).toFixed(1)}`).join(' ');
 const created=Date.parse(c.generatedAt??''),aiDate=Number.isFinite(created)?new Date(created+9*3600000).toISOString().slice(0,10):'확인 필요';
 const color=colors[kind],fmt=(v:number)=>v.toLocaleString('ko-KR',{maximumFractionDigits:v<100?4:0});
 const axis=(v:number)=>v>=1e8?`${fmt(v/1e8)}억`:v>=1e4?`${fmt(v/1e4)}만`:fmt(v);
 const ticks=[min,(min+max)/2,max].map(v=>`<line x1="52" y1="${y(v)}" x2="292" y2="${y(v)}" stroke="#e3e8ef"/><text x="46" y="${y(v)+4}" text-anchor="end" fill="#526174" font-size="14">${axis(v)}</text>`).join('');
 const range=z?`${fmt(z[0])}~${fmt(z[1])}원`:'설명에 나온 가격 기준';
 const band=z?`<rect class="scenario-band" x="236" y="${y(z[1])}" width="56" height="${Math.max(2,y(z[0])-y(z[1]))}" fill="${color}" fill-opacity=".16" stroke="${color}" stroke-width="1.5" stroke-dasharray="5 4"/>`:'';
 // Give each price its own label row, even when reference prices are close together.
 const guidePrices=[...new Set(z?[...z,...(s.trigger?[s.trigger]:[])]:levels)].sort((a,b)=>b-a);
 const labelY=guidePrices.map(v=>y(v));
 for(let i=0;i<labelY.length;i++)labelY[i]=Math.max(32,labelY[i]!,i?labelY[i-1]!+22:32);
 if(labelY.length&&labelY.at(-1)!>192){labelY[labelY.length-1]=192;for(let i=labelY.length-2;i>=0;i--)labelY[i]=Math.min(labelY[i]!,labelY[i+1]!-22);}
 const guides=guidePrices.map((v,i)=>`<line x1="52" y1="${y(v)}" x2="292" y2="${y(v)}" stroke="${color}" stroke-opacity=".65" stroke-dasharray="4 4"/><path d="M292 ${y(v)} L302 ${labelY[i]} L308 ${labelY[i]}" fill="none" stroke="${color}" stroke-opacity=".6"/><text class="scenario-price-label" x="312" y="${labelY[i]!+4}" font-size="16" font-weight="700" fill="${color}">${fmt(v)}원</text>`).join('');
 return `<figure class="scenario-figure"><div class="scenario-metrics"><span>현재 <b>${fmt(close)}원</b></span>${z?`<span>${names[kind]} 가격대 <b style="color:${color}">${esc(range)}</b></span>`:`<span>${names[kind]} · 가격 기준선</span>`}</div><svg viewBox="0 0 420 232" role="img" aria-label="${names[kind]} 시나리오: 최근 가격과 ${esc(range)}">${ticks}${band}${guides}<polyline points="${points}" fill="none" stroke="#183556" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="228" cy="${y(close)}" r="4" fill="#183556" stroke="#fff" stroke-width="2"/><line x1="228" y1="24" x2="228" y2="198" stroke="#8793a5" stroke-dasharray="4 4"/><text x="52" y="220" font-size="14" fill="#526174">최근 ${history.length}거래일</text><text x="228" y="220" text-anchor="middle" font-size="14" fill="#526174">현재</text><text x="312" y="220" font-size="14" fill="${color}">${z?'예상 범위':'가격 기준'}</text></svg><figcaption><div class="scenario-legend"><span><i style="background:#183556"></i>실제 종가</span><span><i class="scenario-dashed" style="border-color:${color}"></i>${z?'20거래일 예상 범위':'설명 속 가격'}</span>${s.trigger?`<span>전환 기준 <b>${fmt(s.trigger)}원</b></span>`:''}</div><small>가격 ${esc(report.date)} · AI ${esc(aiDate)}<br>${z?'음영은 예상 가격대이며 중간 가격 경로가 아닙니다.':'점선은 설명 속 가격 기준입니다. 기간은 아래 근거에서 확인하세요.'}</small></figcaption></figure>`;
}
export function scenarioPanel(report:DailyReport):string {
 return `<section class="card scenario-panel" id="chart-scenarios"><div class="compact-heading"><b>시나리오 전망</b><div class="seg" role="group" aria-label="차트 시나리오">${(['BULL','BASE','BEAR','ALL'] as const).map(k=>`<button type="button" data-scenario="${k}" aria-pressed="${k==='BASE'}">${k==='ALL'?'비교':names[k]}</button>`).join('')}</div></div>${(['BULL','BASE','BEAR'] as const).map(k=>`<div data-scenario-kind="${k}"${k!=='BASE'?' hidden':''}>${scenarioPlot(report,k)}</div>`).join('')}</section>`;
}
export const SCENARIO_CSS=`.scenario-panel{margin-top:12px}.scenario-figure{margin:10px 0;padding:12px;background:#fff;border:1px solid var(--line,#e1e7ef);border-radius:12px;min-width:0}.scenario-figure svg{display:block;width:100%;max-width:560px;margin:0 auto;height:auto}.scenario-metrics{display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:space-between;font-size:12px;color:var(--fg2,#526174)}.scenario-metrics b{font-size:14px;color:var(--fg,#183556)}.scenario-price-label{paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}.scenario-figure figcaption{font-size:12px;color:var(--fg2,#526174)}.scenario-figure small{display:block;font-size:12px;line-height:1.6;color:var(--muted,#65748a);margin-top:6px}.scenario-legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px}.scenario-legend span{display:inline-flex;align-items:center;gap:5px}.scenario-legend i{display:inline-block;width:16px;height:2px}.scenario-legend .scenario-dashed{background:none;height:0;border-top:2px dashed}.scenario-evidence{margin-top:14px;font-size:13px;line-height:1.65}.scenario-evidence>p{margin:6px 0 10px}.scenario-evidence>b{font-size:12px;color:var(--fg2)}.scenario-panel:has([data-scenario=ALL][aria-pressed=true]) [data-scenario-kind]{border-bottom:1px solid var(--line);padding-bottom:6px}@media(min-width:600px){.cl-sc .scenario-figure{max-width:620px;margin-left:auto;margin-right:auto}}`;

export const SCENARIO_JS=`document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-scenario]');if(!b)return;var box=b.closest('.scenario-panel');box.querySelectorAll('[data-scenario]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});box.querySelectorAll('[data-scenario-kind]').forEach(function(x){x.hidden=b.dataset.scenario!=='ALL'&&x.dataset.scenarioKind!==b.dataset.scenario;});});`;
