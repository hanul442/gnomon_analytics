import type { DailyReport } from './dailyReport.js';
import { LOCKED_TEXT } from '../analysis/commentary.js';
import { esc } from './html.js';
import { won } from './format.js';

const names = { BULL: '강세', BASE: '기본', BEAR: '약세' } as const;
const colors = { BULL: '#cb3c46', BASE: '#69788d', BEAR: '#2862bd' } as const;
/** Where a scenario would take the price in about 20 sessions: the committee's zone, else the volatility forecast's side. */
export function scenarioZone(report: DailyReport, kind: 'BULL' | 'BASE' | 'BEAR'): { zone: [number, number]; source: 'ai' | 'analyst' | 'calc' } | undefined {
  const c = report.commentary?.status === 'OK' ? report.commentary : undefined;
  const s = c?.scenarios?.find((x) => x.kind === kind);
  // The range is public even in a sealed report (only the reasoning is locked), so it shows either way.
  if (s?.zone && s.zone.every((v) => Number.isFinite(v) && v > 0) && s.zone[0] <= s.zone[1]) return { zone: s.zone, source: 'ai' };
  // Reports written before the committee gave ranges (prompt v4/v5): the AI analysts' targets on that side.
  const stance = kind === 'BULL' ? 'BULLISH' : kind === 'BEAR' ? 'BEARISH' : 'NEUTRAL';
  const t = (c?.analysts ?? []).filter((a) => a.stance === stance && Number.isFinite(a.target) && a.target > 0).map((a) => a.target);
  if (t.length) { const lo = Math.min(...t), hi = Math.max(...t), pad = hi === lo ? lo * 0.015 : 0; return { zone: [lo - pad, hi + pad], source: 'analyst' }; }
  const f = report.market?.forecasts?.find((x) => x.horizon === 20);
  if (!f || !(f.p10 > 0) || !(f.p90 >= f.p10)) return undefined;
  const z: [number, number] = kind === 'BULL' ? [f.p50, f.p90] : kind === 'BEAR' ? [f.p10, f.p50] : [(f.p10 + f.p50) / 2, (f.p50 + f.p90) / 2];
  return { zone: z, source: 'calc' };
}

/**
 * G-173: how an older report's scenario range has fared since the AI wrote it — the sessions after its date,
 * the first close inside the range, and where the latest close sits. Undefined while there is nothing after it.
 */
export interface ScenarioCheck { since: string; sessions: number; entered: string | null; now: 'in' | 'above' | 'below'; gap: number; zone: [number, number]; done: boolean }
export function scenarioCheck(report: DailyReport, kind: 'BULL' | 'BASE' | 'BEAR'): ScenarioCheck | undefined {
  const c = report.commentary?.status === 'OK' ? report.commentary : undefined, z = scenarioZone(report, kind)?.zone;
  const t = Date.parse(c?.generatedAt ?? ''); if (!c || !z || !Number.isFinite(t)) return undefined;
  const since = new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
  // One close per session (the last one written), in date order.
  const byDate = new Map((report.recentCloses ?? []).filter((p) => p.date > since && Number.isFinite(p.close) && p.close > 0).map((p) => [p.date, p] as const));
  const after = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!after.length) return undefined;
  const inside = (v: number) => v >= z[0] && v <= z[1], last = after.at(-1)!.close;
  const now = inside(last) ? 'in' : last > z[1] ? 'above' : 'below';
  return { since, sessions: after.length, entered: after.find((p) => inside(p.close))?.date ?? null, now, gap: now === 'in' ? 0 : now === 'above' ? (last / z[1] - 1) * 100 : (1 - last / z[0]) * 100, zone: z, done: after.length >= 20 };
}
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
/** One line on how the range fared: in it, touched it, still on the way, or missed after 20 sessions. */
export function checkLine(k: ScenarioCheck, label: string): string {
  const side = k.now === 'above' ? '위' : '아래', far = `${k.gap.toFixed(1)}%`;
  if (k.entered && k.now === 'in') return `✅ ${md(k.entered)}에 ${label} 범위에 들어왔고 지금도 안에 있어요`;
  if (k.entered) return `✅ ${md(k.entered)}에 ${label} 범위에 닿았어요 · 지금은 범위 ${side}로 ${far}`;
  if (k.done) return `❌ 20거래일 동안 ${label} 범위에 들어오지 않았어요 · 지금 범위 ${side}로 ${far}`;
  return `⏳ 아직 범위 밖이에요 · 범위까지 ${far} (${k.sessions}/20거래일)`;
}

export function scenarioLayer(report: DailyReport): { kind: 'BULL' | 'BASE' | 'BEAR'; zone: [number, number]; source: 'ai' | 'analyst' | 'calc'; p?: number }[] {
  const c = report.commentary?.status === 'OK' ? report.commentary : undefined;
  return (['BULL', 'BASE', 'BEAR'] as const).flatMap((k) => { const z = scenarioZone(report, k), p = c?.scenarios?.find((x) => x.kind === k)?.probability; return z ? [{ kind: k, zone: z.zone, source: z.source, ...(typeof p === 'number' ? { p } : {}) }] : []; });
}
export function scenarioPlot(report: DailyReport, kind: keyof typeof names): string {
 const c=report.commentary?.status==='OK'?report.commentary:undefined;
 const s=c?.scenarios?.find(x=>x.kind===kind);
 if(!c)return '<div class="v2-mask"><div class="v2-mask-shapes" aria-hidden="true"><i></i><i></i><i></i></div><p class="muted small">🔒 시나리오가 아직 생성되지 않았어요. 리포트 생성 후 이 차트에서 확인할 수 있어요.</p></div>';
 if(!s||s.narrative.text===LOCKED_TEXT)return '<p class="muted small">🔒 심층 리포트 열람 권한이 필요해요.</p>';
 const z=scenarioZone(report,kind)?.zone;
 // Legacy reports describe prices in claims but have no separate zone field.
 const mentioned=[s.narrative.text,...s.catalysts??[],...s.invalidation??[]].join(' ');
 const marks=[...mentioned.matchAll(/([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*원/g)].map(m=>Number(m[1]!.replace(/,/g,''))).filter(v=>Number.isFinite(v)&&v>0);
 const levels=[...new Set(marks)].slice(0,6);
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
 const range=z?`${won(z[0])}~${won(z[1])}`:'설명에 나온 가격 기준';
 // G-173: an older report keeps its range from the day it was written, so the line after it shows whether the price got in.
 let i0=-1;history.forEach((p,i)=>{if(p.date<=aiDate)i0=i;});
 const anchored=i0>=0&&i0<history.length-1,bx=anchored?52+i0/Math.max(1,history.length-1)*176:236;
 const band=z?`<rect class="scenario-band" x="${bx.toFixed(1)}" y="${y(z[1])}" width="${(292-bx).toFixed(1)}" height="${Math.max(2,y(z[0])-y(z[1]))}" fill="${color}" fill-opacity=".16" stroke="${color}" stroke-width="1.5" stroke-dasharray="5 4"/>${anchored?`<line x1="${bx.toFixed(1)}" y1="24" x2="${bx.toFixed(1)}" y2="198" stroke="${color}" stroke-opacity=".7" stroke-dasharray="2 3"/>`:''}`:'';
 // Give each price its own label row, even when reference prices are close together.
 const guidePrices=[...new Set(z?[...z]:levels)].sort((a,b)=>b-a);
 const labelY=guidePrices.map(v=>y(v));
 for(let i=0;i<labelY.length;i++)labelY[i]=Math.max(32,labelY[i]!,i?labelY[i-1]!+22:32);
 if(labelY.length&&labelY.at(-1)!>192){labelY[labelY.length-1]=192;for(let i=labelY.length-2;i>=0;i--)labelY[i]=Math.min(labelY[i]!,labelY[i+1]!-22);}
 const guides=guidePrices.map((v,i)=>`<line x1="52" y1="${y(v)}" x2="292" y2="${y(v)}" stroke="${color}" stroke-opacity=".65" stroke-dasharray="4 4"/><path d="M292 ${y(v)} L302 ${labelY[i]} L308 ${labelY[i]}" fill="none" stroke="${color}" stroke-opacity=".6"/><text class="scenario-price-label" x="312" y="${labelY[i]!+4}" font-size="16" font-weight="700" fill="${color}">${won(v)}</text>`).join('');
 return `<figure class="scenario-figure"><div class="scenario-metrics"><span>현재 <b class="mo-count">${won(close)}</b></span>${z?`<span>${names[kind]} 가격대 <b style="color:${color}">${esc(range)}</b></span>`:`<span>${names[kind]} · 가격 기준선</span>`}</div><svg viewBox="0 0 420 232" role="img" tabindex="0" class="mo-scrub" data-pts="${esc(JSON.stringify(history.map((p,i)=>[p.date,+(52+i/Math.max(1,history.length-1)*176).toFixed(1),+y(p.close).toFixed(1),p.close])))}" data-band="${z?esc(JSON.stringify([z[0],z[1],y(z[1]),y(z[0])])):''}" aria-label="${names[kind]} 시나리오: 최근 가격과 ${esc(range)}. 좌우 화살표로 날짜별 종가를 볼 수 있어요">${ticks}${band}${guides}<polyline class="mo-line" points="${points}" fill="none" stroke="#183556" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle class="mo-pulse" cx="228" cy="${y(close)}" r="8" fill="#183556" fill-opacity=".18"/><circle class="mo-dot" cx="228" cy="${y(close)}" r="4" fill="#183556" stroke="#fff" stroke-width="2"/><line x1="228" y1="24" x2="228" y2="198" stroke="#8793a5" stroke-dasharray="4 4"/>${anchored?`<text x="${(228-bx<70?bx-4:bx).toFixed(1)}" y="220" text-anchor="${228-bx<70?'end':'middle'}" font-size="14" fill="${color}">리포트 ${aiDate.slice(5).replace('-','/')}</text>`:`<text x="52" y="220" font-size="14" fill="#526174">최근 ${history.length}거래일</text>`}<text x="228" y="220" text-anchor="middle" font-size="14" fill="#526174">현재</text><text x="312" y="220" font-size="14" fill="${color}">${z?'예상 범위':'가격 기준'}</text></svg><figcaption><div class="scenario-legend"><span><i style="background:var(--ink)"></i>실제 종가</span><span><i class="scenario-dashed" style="border-color:${color}"></i>${z?'20거래일 예상 범위':'설명 속 가격'}</span></div><small>가격 ${esc(report.date)} · AI ${esc(aiDate)}<br>${z?(anchored?'음영은 리포트 날부터 20거래일 동안의 예상 가격대예요. 선이 음영 안으로 들어오면 그 시나리오대로 간 거예요.':'음영은 예상 가격대이며 중간 가격 경로가 아닙니다.'):'점선은 설명 속 가격 기준입니다. 기간은 아래 근거에서 확인하세요.'}</small></figcaption></figure>`;
}
export function scenarioPanel(report:DailyReport):string {
 return `<section class="card scenario-panel" id="chart-scenarios"><div class="compact-heading"><b>시나리오 전망</b><div class="seg" role="group" aria-label="차트 시나리오">${(['BULL','BASE','BEAR','ALL'] as const).map(k=>`<button type="button" data-scenario="${k}" aria-pressed="${k==='BASE'}">${k==='ALL'?'비교':names[k]}</button>`).join('')}</div></div>${(['BULL','BASE','BEAR'] as const).map(k=>`<div data-scenario-kind="${k}"${k!=='BASE'?' hidden':''}>${scenarioPlot(report,k)}</div>`).join('')}</section>`;
}
export const SCENARIO_CSS=`.sc-boxes{position:absolute;left:0;top:0;width:100%;height:0;pointer-events:none;z-index:2}.sc-box{position:absolute;box-sizing:border-box;border:1.5px dashed;border-radius:6px}.sc-box i{position:absolute;left:3px;right:2px;font-style:normal;font-size:11px;line-height:1.3;display:flex;flex-direction:column;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sc-box i b{font-size:11.5px}.sc-box-BULL{background:rgba(240,68,82,.12);border-color:var(--up);color:#b4232b}.sc-box-BULL i{top:3px}.sc-box-BASE{background:rgba(91,107,128,.12);border-color:var(--line-strong);color:var(--fg2)}.sc-box-BASE i{top:50%;transform:translateY(-50%)}.sc-box-BEAR{background:rgba(49,130,246,.12);border-color:var(--down);color:var(--down-strong)}.sc-box-BEAR i{bottom:3px}.sc-layer{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0 2px}.sc-layer .label{font-size:12px;font-weight:700;color:var(--muted);margin-right:2px}.sc-layer button{border:1px solid var(--line-strong);background:var(--surface);border-radius:999px;padding:5px 11px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;color:var(--fg)}.sc-layer .sc-BULL{color:var(--up-strong)}.sc-layer .sc-BEAR{color:var(--down-strong)}.sc-layer button[aria-pressed=true]{background:var(--navy);color:#fff;border-color:var(--navy)}.sc-note{flex-basis:100%;font-size:12px;color:var(--fg2);line-height:1.5}.sc-note .sc-BULL{color:var(--up-strong);font-weight:700}.sc-note .sc-BEAR{color:var(--down-strong);font-weight:700}.sc-note .sc-BASE{font-weight:700}.scenario-panel{margin-top:12px}.scenario-figure{margin:10px 0;padding:12px;background:var(--surface);border:1px solid var(--line,#e1e7ef);border-radius:12px;min-width:0}.scenario-figure svg{display:block;width:100%;max-width:560px;margin:0 auto;height:auto}.scenario-metrics{display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:space-between;font-size:12px;color:var(--fg2,var(--muted))}.scenario-metrics b{font-size:14px;color:var(--fg,var(--ink))}.scenario-price-label{paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}.scenario-figure figcaption{font-size:12px;color:var(--fg2,var(--muted))}.scenario-figure small{display:block;font-size:12px;line-height:1.6;color:var(--muted,#65748a);margin-top:6px}.scenario-legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px}.scenario-legend span{display:inline-flex;align-items:center;gap:5px}.scenario-legend i{display:inline-block;width:16px;height:2px}.scenario-legend .scenario-dashed{background:none;height:0;border-top:2px dashed}.scenario-evidence{margin-top:14px;font-size:13px;line-height:1.65}.scenario-evidence>p{margin:6px 0 10px}.scenario-evidence>b{font-size:12px;color:var(--fg2)}.scenario-panel:has([data-scenario=ALL][aria-pressed=true]) [data-scenario-kind]{border-bottom:1px solid var(--line);padding-bottom:6px}@media(min-width:600px){.cl-sc .scenario-figure{max-width:620px;margin-left:auto;margin-right:auto}}`;

export const SCENARIO_JS=`document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-scenario]');if(!b)return;var box=b.closest('.scenario-panel');box.querySelectorAll('[data-scenario]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});box.querySelectorAll('[data-scenario-kind]').forEach(function(x){x.hidden=b.dataset.scenario!=='ALL'&&x.dataset.scenarioKind!==b.dataset.scenario;});});`;
