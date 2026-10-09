import {aiSummaryCard} from '../report/aiSummary.js';
import {scenarioLayer} from '../report/scenarioChart.js';
import {notifyUser} from './notify.js';
import {coinFlow} from '../report/coinFlow.js';
import type { D1 } from './db.js';
import type { DailyReport } from '../report/dailyReport.js';
import { buildDailyReport } from '../report/dailyReport.js';
import { buildMarketSection } from '../report/marketSection.js';
import type { Commentary } from '../analysis/commentary.js';
import { usdOf } from './ask.js';
import { conclusionCard } from '../report/conclusion.js';
import { committeeTab, newsTabBody } from '../report/renderHtml.js';
import { decisionTrace } from '../report/renderReportExtras.js';
import { flowsPanel, fundamentalsPanel } from '../report/renderMarket.js';
import { edgeFlows } from '../report/renderEdge.js';
import { esc } from '../report/html.js';
import { withCurrency } from '../report/format.js';
import { isUsSymbol } from '../report/seal.js';
import { buildUsReport, gatherUsResearch } from '../report/usResearch.js';
export interface ReportQueue { send(body: { id: string }): Promise<void> }
export interface ReportJob {
 id:string; user_id:string; symbol:string; kind:string; input_hash:string; input_json:string;
 status:string; stage:string; credits:number; reserved_usd:number; usd:number;
 result_json:string|null; error:string|null; created_at:string; updated_at:string;
}
export interface ReportDeps { now:()=>Date; fetch:typeof fetch; generate?:(report:DailyReport)=>Promise<Commentary>; site?:string; /** Contact SEC may reach about EDGAR requests (G-179). */ edgarContact?:string }
export async function reportInput(site:string,symbol:string,deps:ReportDeps):Promise<DailyReport>{
 const base=site.replace(/\/$/,'');
 const context=await deps.fetch(`${base}/research/${symbol}.json`,{signal:AbortSignal.timeout(8000)}).catch(()=>null);
 const research=context?.ok?await context.json().catch(()=>null) as DailyReport|null:null;
 const us=isUsSymbol(symbol);
 const r=await deps.fetch(`${base}/${symbol.startsWith('KRW-')?'c':us?'u':'s'}/${symbol}.json`,{signal:AbortSignal.timeout(8000)}).catch(()=>null);
 const d=r?.ok?await r.json().catch(()=>null) as UsPageJson|null:null;
 // G-153: the research context is built with the daily report run (weekly for many stocks), so its prices can be days
 // behind the stock's own daily file. Use it as is only when it is as fresh; otherwise build from the newest prices
 // and keep its fundamentals, flows, news and filings, or a "new data" request would make the same old report again.
 const lastBar=d?.bars?.at(-1)?.[0];
 const usable=!!(research&&research.symbol===symbol&&research.price);
 if(usable&&(!lastBar||research!.price!.sessionDate>=lastBar||!Array.isArray(d?.bars)||d!.bars.length<20)){delete research!.commentary;return research!;}
 if(!d)throw new Error('분석에 필요한 데이터가 없어요. 데이터 갱신 뒤 다시 요청해 주세요.');
 const fresh=await buildFromBars(symbol,d,us,deps);
 // A Korean stock keeps its research context's fundamentals; a US report already carries its own (G-179).
 if(research&&research.symbol===symbol&&!us){
  if(research.market&&fresh.market)fresh.market={...fresh.market,flows:research.market.flows,footprint:research.market.footprint,snapshot:research.market.snapshot,quarters:research.market.quarters,years:research.market.years,research:research.market.research,benchmarks:research.market.benchmarks};
  for(const k of ['filings','recentFilings','news','edge','statements','exchange'] as const)if(research[k]!==undefined)(fresh as unknown as Record<string,unknown>)[k]=research[k];
  fresh.notes=fresh.notes.filter(n=>!/공개 가격 기록 기준/.test(n));
  fresh.notes.push(`가격은 ${fresh.price?.sessionDate??''} 종가까지 반영했어요. 수급·실적·뉴스는 ${research.price?.sessionDate??research.date} 리포트 기준이에요.`);
 }
 return fresh;
}
interface UsPageJson { name:string; ticker?:string; english?:string; market?:string; kind?:string; cik?:number|null; bars:[string,number,number,number,number,number][] }
async function buildFromBars(symbol:string,d:UsPageJson,us:boolean,deps:ReportDeps):Promise<DailyReport>{
 if(!Array.isArray(d.bars)||d.bars.length<20)throw new Error('가격 기록이 부족해서 리포트를 만들 수 없어요.');
 const now=deps.now(), bars=d.bars.map(b=>({symbol,date:b[0],open:b[1],high:b[2],low:b[3],close:b[4],volume:b[5],source:symbol.startsWith('KRW-')?'upbit':us?'naver:world':'naver',retrievedAt:now.toISOString()}));
 if(bars.some(b=>!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||![b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)||b.close<=0))throw new Error('가격 데이터 형식을 확인하지 못했어요.');
 if(us){
  // G-179: a US stock's report carries SEC filings, XBRL financials, Form 4 trades, Naver's valuation snapshot and English news.
  const research=await gatherUsResearch({symbol,ticker:d.ticker??symbol.split('.')[0]!,nameEng:d.english??d.name,cik:d.cik??null,fetch:deps.fetch,now:deps.now,...(deps.edgarContact?{contact:deps.edgarContact}:{})});
  return buildUsReport({symbol,name:d.name,...(d.english?{nameEng:d.english}:{}),...(d.ticker?{ticker:d.ticker}:{}),...(d.kind==='etf'?{kind:'etf' as const}:{}),...(d.market==='NASDAQ'||d.market==='NYSE'||d.market==='AMEX'?{exchange:d.market}:{}),bars,research,now});
 }
 const out=buildDailyReport({symbol,name:d.name,date:bars.at(-1)!.date,generatedAt:now,bars,disclosures:[],sources:[bars[0]!.source],...(us?{currency:'USD' as const,...(d.kind==='etf'?{kind:'etf' as const}:{}),...(d.market==='NASDAQ'||d.market==='NYSE'||d.market==='AMEX'?{exchange:d.market}:{})}:symbol.startsWith('KRW-')?{kind:'coin' as const,exchange:'UPBIT' as const}:{...(d.kind==='etf'?{kind:'etf' as const}:{}),...(d.market==='KOSPI'||d.market==='KOSDAQ'?{exchange:d.market}:{})})});
 out.market=buildMarketSection({symbol,date:out.date,generatedAt:now,daily:bars,weekly:[],intraday:[],flows:[],snapshots:[],finance:[],research:[],benchmarks:[],loggedForecasts:[],status:[]});
 out.notes.push(us?'미국 주식은 네이버 해외 주식 일봉(달러, 미국 현지 날짜) 기준이에요. 수급·실적·공시 근거가 없어서 그 판단은 보류해요.':'이 요청은 공개 가격 기록 기준입니다. 수급·실적·뉴스가 수집되지 않았다면 해당 판단은 보류합니다.');
 return out;
}
export async function inputHash(report:DailyReport):Promise<string>{
 // Request time is not evidence: otherwise refreshes evade deduplication.
 const {generatedAt:_time,commentary:_ai,...input}=report;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(input,(key,value)=>['retrievedAt','generatedAt'].includes(key)?undefined:value)));
 return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function refundJob(db:D1,job:ReportJob,reason:string,now:Date){
 await db.batch([
 db.prepare("UPDATE report_jobs SET status='failed',stage='failed',error=?,reserved_usd=0,updated_at=? WHERE id=? AND status!='done'").bind(reason,now.toISOString(),job.id),
 db.prepare("INSERT OR IGNORE INTO ledger(user_id,delta,kind,note,ref,created_at) SELECT ?,?,'refund',?,?,? WHERE EXISTS(SELECT 1 FROM ledger WHERE user_id=? AND ref=?) AND NOT EXISTS(SELECT 1 FROM report_jobs WHERE id=? AND status='done')").bind(job.user_id,job.credits,reason,`refund:report:${job.id}`,now.toISOString(),job.user_id,`report:${job.id}`,job.id)
 ]);
}
export function reportFailureMessage(code:string|undefined):string{
 const key=code??'UNKNOWN';
 if(/MAX_TOKENS/.test(key))return 'AI 응답이 길이 제한을 넘어 리포트를 완성하지 못했어요. 크레딧은 반환됩니다. [MAX_TOKENS]';
 if(/UNPARSEABLE_OUTPUT|SCHEMA|parse|JSON/i.test(key))return 'AI 응답 형식을 확인하지 못했어요. 크레딧은 반환됩니다. [INVALID_OUTPUT]';
 if(/API_429|API_529/.test(key))return 'AI 서버가 혼잡해 생성을 마치지 못했어요. 크레딧은 반환됩니다. 잠시 후 다시 요청해 주세요. [AI_BUSY]';
 if(/timeout|timed out|abort/i.test(key))return 'AI 응답 시간이 초과됐어요. 크레딧은 반환됩니다. 잠시 후 다시 요청해 주세요. [AI_TIMEOUT]';
 if(/API_401|API_403|API_400|API_404|KEY_MISSING/.test(key))return 'AI 서버 연결 설정을 확인해야 해요. 크레딧은 반환됩니다. 운영자에게 알려 주세요. [AI_CONFIGURATION]';
 if(/NO_EVIDENCE/.test(key))return '분석에 필요한 근거가 부족해요. 크레딧은 반환됩니다. [NO_EVIDENCE]';
 if(/REFUSAL/.test(key))return 'AI가 이번 분석 응답을 제공하지 못했어요. 크레딧은 반환됩니다. [AI_REFUSAL]';
 return 'AI 리포트를 완성하지 못했어요. 크레딧은 반환됩니다. [AI_GENERATION_FAILED]';
}
export async function runReportJob(db:D1,id:string,deps:ReportDeps):Promise<void>{
 const job=await db.prepare('SELECT * FROM report_jobs WHERE id=?').bind(id).first<ReportJob>();
 if(!job||['done','failed'].includes(job.status))return;
 // Queue redelivery must not run a second model call. A stale lease is failed/refunded, never retried blindly.
 if(job.status==='running'){
  if(Date.parse(job.updated_at)<deps.now().getTime()-15*60000)await refundJob(db,job,'작업 연결이 끊겨 크레딧을 반환했어요. 다시 요청해 주세요.',deps.now());
  return;
 }
 const took=await db.prepare("UPDATE report_jobs SET status='running',stage='working',updated_at=? WHERE id=? AND status='queued'").bind(deps.now().toISOString(),id).run();
 if(!took.meta?.changes)return;
 try{
  if(!deps.generate)throw new Error('AI 연결이 설정되지 않았어요.');
  const report=JSON.parse(job.input_json) as DailyReport;
  const commentary=await deps.generate(report);
  const usage=commentary.usage;
  const usd=usage?usdOf(commentary.servedBy||commentary.model,usage.inputTokens,usage.outputTokens,usage.cacheReadTokens,usage.cacheWriteTokens):0;
  await db.prepare('UPDATE report_jobs SET usd=? WHERE id=?').bind(usd,id).run();
  // The raw cause goes to error_detail for diagnosis (never returned to users); users get the classified message.
  if(commentary.status!=='OK'||!commentary.summary){await db.prepare('UPDATE report_jobs SET error_detail=? WHERE id=?').bind((commentary.error??'UNKNOWN').replace(/sk-[A-Za-z0-9_-]+/g,'[key]').slice(0,300),id).run().catch(()=>undefined);throw new Error(reportFailureMessage(commentary.error));}
  report.commentary=commentary;report.generatedAt=deps.now().toISOString();
  await db.prepare("UPDATE report_jobs SET stage='composing',updated_at=? WHERE id=?").bind(deps.now().toISOString(),id).run();
  await db.prepare("UPDATE report_jobs SET status='done',stage='done',result_json=?,reserved_usd=0,updated_at=? WHERE id=? AND status='running'").bind(JSON.stringify(report),deps.now().toISOString(),id).run();
  // G-97: the requester hears when it is ready (🔔 and phone), even after closing the page.
  if(deps.site)await notifyUser({db,fetch:deps.fetch,site:deps.site,now:deps.now()},job.user_id,'request',{title:`요청한 ${report.name} 리포트가 완성됐어요`,body:'눌러서 바로 보세요. AI 위원회 탭에 시나리오와 토론이 있어요.',link:`${job.symbol.startsWith('KRW-')?'coin.html?m=':'stock.html?c='}${encodeURIComponent(job.symbol)}&job=${job.id}#tab-ai`}).catch(()=>false);
 }catch(e){const reason=e instanceof Error?e.message:'리포트를 만들지 못했어요.';if(!(e instanceof Error&&/\[[A-Z_]+\]$/.test(e.message)))await db.prepare('UPDATE report_jobs SET error_detail=? WHERE id=?').bind(String(e instanceof Error?e.stack??e.message:e).slice(0,300),id).run().catch(()=>undefined);await refundJob(db,job,reason,deps.now());
  if(deps.site)await notifyUser({db,fetch:deps.fetch,site:deps.site,now:deps.now()},job.user_id,'request',{title:`${job.symbol} 리포트를 만들지 못했어요`,body:reason,link:`${job.symbol.startsWith('KRW-')?'coin.html?m=':'stock.html?c='}${encodeURIComponent(job.symbol)}`}).catch(()=>false);}
}
/** Tabs of a report generated on request, painted onto the stock's page. The AI tab uses the daily pages' own renderer (G-115). */
export function reportFragments(report:DailyReport,base=''){
 return withCurrency(report.currency,()=>fragmentsOf(report,base));
}
function fragmentsOf(report:DailyReport,base:string){
 const c=report.commentary!;
 const claim=(title:string,items:readonly {text:string}[])=>`<div class="card"><h3>${title}</h3>${items.map(x=>`<p>${esc(x.text)}</p>`).join('')||'<p>확인된 근거가 없어요.</p>'}</div>`;
 // G-178: the same 뉴스·공시 body as a daily page (links, importance, clusters, filings table, past events).
 const news=newsTabBody(report);
 const frags:Record<string,string>={chart:aiSummaryCard(c.summary?.text??'','차트 AI 요약',report.date),scenarios:JSON.stringify(scenarioLayer(report)),home:aiSummaryCard(c.summary?.text??'','AI 요약',report.date)+conclusionCard(report,{id:'conclusion-live'}),ai:committeeTab(report,{base,from:null})+decisionTrace(report,false),flows:report.kind==='coin'?coinFlow(report):report.market?flowsPanel(report.market.flows,report.market.footprint):claim('수급',[{text:'수집된 투자자별 수급 근거가 없어요. 판단을 보류합니다.'}]),fundamentals:report.market?fundamentalsPanel(report.market,report.price?.close??null,report.name):claim('실적',[{text:'수집된 실적 근거가 없어요. 판단을 보류합니다.'}]),news};
 // G-179: a US stock has no investor flows; its Form 4 trades and trading value ride the 기업 체력 panel.
 if(report.currency==='USD'){frags.fundamentals=(frags.fundamentals??'')+edgeFlows(report);delete frags.flows;}
 return frags;
}
