import { marketPulse, type StockCalc } from '../analysis/quickCalc.js';
import { ANALYSTS } from '../analysis/analysts.js';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { seal, unseal, deepPath } from '../report/seal.js';
import { AiBudget } from './aiBudget.js';
import { BRIEF_MODEL } from '../analysis/commentary.js';
import { MarketCouncilSchema, MarketCouncilGenerationSchema, parseMarketCouncil, periodAsset, weekStart, validCouncil, marketSymbol, renderMarketDeep, renderMarketReport, renderMarketReportIndex, type MarketReport, type MarketGroup, type Period } from '../report/marketReport.js';
import type { UniverseRow } from '../sources/naverList.js';
import type { PriceBar } from '../types.js';
import { readLog } from '../store/jsonlLog.js';
import type { CoinRow } from './coins.js';
const json=async(path:string)=>JSON.parse(await readFile(path,'utf8').catch(()=> 'null'));
export async function collectMarketGroups(root:string,date:string,period:Period,universe:readonly UniverseRow[]):Promise<MarketGroup[]> {
 const from=period==='weekly'?weekStart(date):date;
 const groups:MarketGroup[]=[];
 for(const [id,name,market] of [['M1','코스피','KOSPI'],['M2','코스닥','KOSDAQ']] as const){
  const rows=universe.filter(r=>r.market===market&&r.kind==='stock');
  const bars=await readLog<PriceBar>(join(root,'data','prices',`${market}.jsonl`)).catch(()=>[]);
  const index=periodAsset(market,name,bars,date,from,period);
  const assets=index?[index]:[];
  const selected=[...rows].sort((a,b)=>(b.marketCap??0)-(a.marketCap??0)).slice(0,30);
  for(const row of selected){const page=await json(join(root,'site','s',`${row.symbol}.json`)); const history=page?.bars?.map((b:[string,number,number,number,number])=>({date:b[0],close:b[4]}))??await readLog<PriceBar>(join(root,'data','prices',`${row.symbol}.jsonl`)).catch(()=>[]); const asset=periodAsset(row.symbol,row.name,history,date,from,period);if(asset)assets.push(asset);}
  const signalCalcs=(await Promise.all(rows.map(async r=>(await json(join(root,'site','s',r.symbol+'.json')))?.calc as StockCalc|null))).filter((c):c is StockCalc=>!!c&&c.date<=date);
  groups.push({id,name,temperature:marketPulse(signalCalcs),source:'네이버 금융 지수 일봉 및 국내 주식 스냅샷 · 구성 종목은 시가총액 상위 30개 표본',universe:rows.length,assets,snapshotDate:rows.map(r=>r.tradedAt).filter((d):d is string=>Boolean(d)).sort().at(-1)??null,breadth:{up:rows.filter(r=>(r.changePct??0)>0).length,down:rows.filter(r=>(r.changePct??0)<0).length,flat:rows.filter(r=>r.changePct===0).length}});
 }
 for(const [id,name,file,folder] of [['M3','코인','coins.json','c'],['M4','ETF','etfs.json','s']] as const){
  const list=await json(join(root,'site',file)); const rows:CoinRow[]=list?.rows??[]; const assets=[];
  for(const row of [...rows].sort((a,b)=>(b[12]??0)-(a[12]??0))){const page=await json(join(root,'site',folder,`${row[0]}.json`)); const bars=page?.bars?.map((b:[string,number,number,number,number])=>({date:b[0],close:b[4]}))??[]; const asset=periodAsset(row[0],row[1],bars,date,from,period,row[12]);if(asset)assets.push(asset);}
  const signalCalcs=(await Promise.all(rows.map(async r=>(await json(join(root,'site',folder,r[0]+'.json')))?.calc as StockCalc|null))).filter((c):c is StockCalc=>!!c&&c.date<=date);
  groups.push({id,name,temperature:marketPulse(signalCalcs),source:id==='M3'?'업비트 원화마켓 일봉 · 09:00 KST 경계 · 스냅샷 등락은 전일 종가(09:00 KST) 대비 · 거래대금만 24시간 기준':'네이버 금융 국내 상장 ETF 일봉 · 가격 수익률',universe:rows.length,assets,snapshotDate:list?.date??null,breadth:{up:rows.filter(r=>(r[5]??0)>0).length,down:rows.filter(r=>(r[5]??0)<0).length,flat:rows.filter(r=>r[5]===0).length}});
 }
 return groups;
}
export async function writeMarketReports(root:string, now:Date, universe:readonly UniverseRow[], apiKey?:string, injectedClient?:Anthropic, sharedBudget?:AiBudget, regenerate=process.env.MARKET_REGEN==='1'):Promise<void>{
 const date=new Date(now.getTime()+9*3600000).toISOString().slice(0,10), dir=join(root,'reports','market');await mkdir(dir,{recursive:true});
 const budget=sharedBudget??await AiBudget.load(root,now);
 for(const period of ['daily'] as const){
  const file=join(dir,`${period}-${date}.json`); const old=await json(file) as MarketReport|null;
  // A finished report is kept; MARKET_REGEN=1 (manual run) asks for a fresh committee, keeping the old one if that fails.
  const done=old?.schema==='curia.market-report.v4'&&old.ai.status==='OK'&&!!(old.ai.council||old.ai.sealed);
  if(done&&!regenerate){await savePrivateMarketReport(file,old!);continue;}
  const report:MarketReport={schema:'curia.market-report.v4',date,from:date,generatedAt:now.toISOString(),period,groups:await collectMarketGroups(root,date,period,universe),ai:{status:'SKIPPED',error:'AI 키 또는 예산 확인 필요'}};
  // The committee's structure is checked strictly, so a regeneration gets up to three tries; each failure is logged (no secrets in it).
  const hasToday=report.groups.some(g=>g.assets.some(a=>a.date===date));
  for(let attempt=1;attempt<=(regenerate?3:1)&&report.ai.status!=='OK'&&(apiKey||injectedClient)&&hasToday&&budget.allows('brief');attempt++){
   budget.reserve('brief'); let accounted=false;
   try{
    const client=injectedClient??new Anthropic({apiKey:apiKey!,timeout:180000,maxRetries:1});
    const input={...report,committee:[...ANALYSTS,{id:'MARKET',name:'시장 데스크',focus:'시장 상대강도와 분포'},{id:'TECHNICAL',name:'기술 데스크',focus:'제공된 기술 신호 분포'},{id:'FLOW',name:'수급 데스크',focus:'거래대금·거래량, 투자자 수급 없으면 보류'},{id:'FUNDAMENTAL',name:'펀더멘털 데스크',focus:'실적 자료 없으면 보류'},{id:'EVENT',name:'공시·뉴스 데스크',focus:'공시·뉴스 자료 없으면 보류'}],groups:report.groups.map(g=>({...g,assets:g.assets.slice(0,20),leaders:[...g.assets].filter(a=>a.returnPct!==null).sort((a,b)=>b.returnPct!-a.returnPct!).slice(0,5),laggards:[...g.assets].filter(a=>a.returnPct!==null).sort((a,b)=>a.returnPct!-b.returnPct!).slice(0,5)}))};
    const response=await client.beta.messages.stream({model:BRIEF_MODEL,max_tokens:12000,system:'당신은 GNOMON의 시장 AI 위원회다. 제공한 자료만 사용해서 한국어 심층 시장 리포트를 쓴다. 코스피·코스닥·코인·ETF 담당 관점을 각각 최소 1개씩 제시한다. 모든 문장은 FACT/INFERENCE/ASSUMPTION과 근거 M1~M4를 갖는다. 일간과 월요일부터 주중 누적 수익률을 혼동하지 않는다. breadth는 현재 스냅샷이며 주간 breadth가 아니다. 종목은 표본이고 전체시장 대표성을 보장하지 않는다. 기준일이 오래된 자료와 결측은 명시한다. 제공되지 않은 거시지표·뉴스·수급·ETF 자금유입·인과관계·가격 목표·확률을 만들지 않는다. 시나리오는 강세·기본·약세 정확히 3개만 작성한다. 요약에서 상위 표본의 등락 범위를 전체 시장 최솟값·최댓값으로 일반화하지 않는다. 합의·이견·강세/기본/약세 성립 조건과 무효화·레드팀·다음 관찰·데이터 공백을 상세히 제시한다. experts는 제공한 committee의 전문가 11명 각각 정확히 한 번씩 판단하며, 부족한 실적·수급·뉴스 근거는 INSUFFICIENT_DATA로 표시한다. 시장 이름을 전문가 이름으로 쓰지 않는다. debate는 정확히 12차례, 첫 11차례에 전문가 11명이 각각 한 번씩 직접 말하고 마지막은 RED_TEAM이다. 앞 전문가의 근거를 짚는 답변과 반론을 포함한다. replyTo는 앞 차례의 0부터 시작하는 번호이고 첫 발언·대상이 없는 발언·RED_TEAM은 -1이다. 자기 자신에게 답하지 않는다. 전문가의 토론 stance는 experts 판단과 일치하며 근거 부족은 NEUTRAL로 발언한다. experts.claim과 debate.claim text는 120자 이내로 쓴다. 각 담당 claims는 2개, 합의·이견·레드팀·관찰은 각각 2~3개로 제한하고 각 text는 한국어 200자 이내로 쓴다.',messages:[{role:'user',content:JSON.stringify(input)}],output_config:{format:{type:'json_schema',schema:betaZodOutputFormat(MarketCouncilGenerationSchema).schema}}} as never).finalMessage();
    await budget.record(`GNOMON-MARKET-${period}`,'brief',{status:'OK',promptVersion:'curia.market.v4',generatedAt:now.toISOString(),bullish:[],bearish:[],uncertain:[],watch:[],dataGaps:[],dropped:0,evidence:[],model:response.model,servedBy:response.model,usage:{inputTokens:response.usage.input_tokens,outputTokens:response.usage.output_tokens}},now);accounted=true;
    if(response.stop_reason==='max_tokens')throw new Error('AI 출력 길이 제한 도달 · 재생성 필요');
    const text=response.content.filter(b=>b.type==='text').map(b=>b.text).join('');const council=MarketCouncilGenerationSchema.parse(parseMarketCouncil(text));
    if(!validCouncil(council,report.groups))throw new Error('위원회 구조 또는 근거 검증 실패');
    report.ai={status:'OK',model:response.model,council};
   }catch(error){report.ai={status:'FAILED',error:error instanceof Error?error.message.slice(0,180):'생성 오류'};}finally{if(!accounted)budget.spent-=0.03;}
   if(report.ai.status!=='OK')console.log(`market ${period} AI attempt ${attempt} failed: ${report.ai.error}`);
  }
  if(!hasToday)report.ai.error='당일 데이터가 없어 위원회 생성을 보류합니다';
  if(done&&report.ai.status!=='OK')console.log(`market ${period}: regeneration failed, keeping the earlier committee`);
  await savePrivateMarketReport(file,done&&report.ai.status!=='OK'?old!:report);
 }
}
/** Paid analysis never goes into the public repository as plaintext. Missing keys fail closed. */
export async function savePrivateMarketReport(file:string,report:MarketReport,secret=process.env.GNM_DEEP_KEY):Promise<MarketReport>{
 const council=report.ai.council;
 if(council){const {council:_private,...ai}=report.ai;report={...report,ai:{...ai,summary:council.summary,...(secret?{sealed:await seal(JSON.stringify(council),secret)}:{})}};
  if(!secret)report.ai={status:'FAILED',summary:council.summary,error:'상세 리포트 저장 키 설정 필요'};
 }
 await writeFile(file,JSON.stringify(report,null,2)+'\n');return report;
}
export async function publishMarketReports(root:string,siteDir:string):Promise<MarketReport[]>{
 const dir=join(root,'reports','market'); const reports:MarketReport[]=[];await mkdir(join(siteDir,'market'),{recursive:true});
 for(const file of (await readdir(dir).catch(()=>[])).filter(f=>/^daily-\d{4}-\d{2}-\d{2}\.json$/.test(f))){const report=await savePrivateMarketReport(join(dir,file),await json(join(dir,file)) as MarketReport);reports.push(report);
  if(report.ai.sealed&&process.env.GNM_DEEP_KEY){const full={...report,ai:{...report.ai,council:MarketCouncilSchema.parse(JSON.parse(await unseal(report.ai.sealed,process.env.GNM_DEEP_KEY)))}};const target=join(siteDir,deepPath(marketSymbol(report.period),report.date));await mkdir(join(siteDir,marketSymbol(report.period),'deep'),{recursive:true});await writeFile(target,await seal(renderMarketDeep(full),process.env.GNM_DEEP_KEY));}
  await writeFile(join(siteDir,'market',file.replace('.json','.html')),renderMarketReport(report,'../'));
  await writeFile(join(siteDir,'market',file),JSON.stringify({...report,groups:report.groups.map(g=>({...g,assets:g.assets.slice(0,1)})),ai:{status:report.ai.status,summary:report.ai.summary,error:report.ai.error,model:report.ai.model}}));}
 await writeFile(join(siteDir,'market-reports.html'),renderMarketReportIndex(reports));
 return reports;
}
