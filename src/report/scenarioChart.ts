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
 const y=(v:number)=>174-(v-min)/(max-min)*148;
 const points=history.map((p,i)=>`${54+i/Math.max(1,history.length-1)*326},${y(p.close).toFixed(1)}`).join(' ');
 const created=Date.parse(c?.generatedAt??''),aiDate=Number.isFinite(created)?new Date(created+9*3600000).toISOString().slice(0,10):'확인 필요';
 const color=colors[kind],fmt=(v:number)=>v.toLocaleString('ko-KR',{maximumFractionDigits:v<100?4:0});
 const ticks=[min,(min+max)/2,max].map(v=>`<text x="4" y="${y(v)+4}" fill="#65748a" font-size="11">${fmt(v)}</text>`).join('');
 const range=z?`${fmt(z[0])}~${fmt(z[1])}원`:'설명에 나온 가격 기준';
 const band=z?`<rect x="394" y="${y(z[1])}" width="210" height="${Math.max(2,y(z[0])-y(z[1]))}" fill="${color}" fill-opacity=".14" stroke="${color}" stroke-dasharray="5 4"/>`:'';
 const guides=(z?(s.trigger?[s.trigger]:[]):levels).map(v=>`<line x1="54" y1="${y(v)}" x2="604" y2="${y(v)}" stroke="${color}" stroke-dasharray="3 4"/><text x="398" y="${y(v)-4}" font-size="11" fill="${color}">${fmt(v)}원</text>`).join('');
 return `<figure class="scenario-figure"><svg viewBox="0 0 620 210" role="img" aria-label="${names[kind]} 시나리오: 최근 가격과 ${esc(range)}">${ticks}<line x1="54" y1="174" x2="606" y2="174" stroke="#d6deea"/><polyline points="${points}" fill="none" stroke="#183556" stroke-width="2"/><circle cx="380" cy="${y(close)}" r="3" fill="#183556"/><line x1="380" y1="20" x2="380" y2="180" stroke="#8793a5" stroke-dasharray="4 4"/>${band}${guides}<text x="54" y="201" font-size="12" fill="#65748a">최근 ${history.length}거래일</text><text x="365" y="201" font-size="12" fill="#65748a">현재</text><text x="480" y="201" font-size="12" fill="${color}">${z?'AI 전망 범위':'언급 가격 기준'}</text></svg><figcaption>${names[kind]} · ${esc(range)}${s.trigger?` · 전환 기준 ${fmt(s.trigger)}원`:''}<small>가격 기준 ${esc(report.date)} · AI 생성 ${esc(aiDate)} · ${z?'음영은 20거래일 시나리오 범위이며 중간 가격 경로가 아닙니다.':'점선은 시나리오 설명에 나온 가격입니다. 언급된 기간은 조건·근거에서 확인하세요. 미래 가격 경로가 아닙니다.'}</small></figcaption></figure>`;
}
export function scenarioPanel(report:DailyReport):string {
 return `<section class="card scenario-panel" id="chart-scenarios"><div class="compact-heading"><b>시나리오 전망</b><div class="seg" role="group" aria-label="차트 시나리오">${(['BULL','BASE','BEAR','ALL'] as const).map(k=>`<button type="button" data-scenario="${k}" aria-pressed="${k==='BASE'}">${k==='ALL'?'비교':names[k]}</button>`).join('')}</div></div>${(['BULL','BASE','BEAR'] as const).map(k=>`<div data-scenario-kind="${k}"${k!=='BASE'?' hidden':''}>${scenarioPlot(report,k)}</div>`).join('')}</section>`;
}
export const SCENARIO_CSS=`.scenario-panel{margin-top:12px}.scenario-figure{margin:6px 0}.scenario-figure svg{display:block;width:100%;max-height:230px}.scenario-figure figcaption{font-size:12px;color:var(--fg2)}.scenario-figure small{display:block;font-size:10px;color:var(--muted);margin-top:4px}.cl-sc details{margin:8px 0}.cl-sc details summary{cursor:pointer;font-size:12px}.cl-sc .scenario-figure svg{max-height:180px}.scenario-panel:has([data-scenario=ALL][aria-pressed=true]) [data-scenario-kind]{border-bottom:1px solid var(--line);padding-bottom:6px}`;
export const SCENARIO_JS=`document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-scenario]');if(!b)return;var box=b.closest('.scenario-panel');box.querySelectorAll('[data-scenario]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});box.querySelectorAll('[data-scenario-kind]').forEach(function(x){x.hidden=b.dataset.scenario!=='ALL'&&x.dataset.scenarioKind!==b.dataset.scenario;});});`;
