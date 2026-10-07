import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { AiBudget } from './aiBudget.js';
import { BRIEF_MODEL } from '../analysis/commentary.js';
import { MarketCouncilSchema, periodAsset, weekStart, validCouncil, renderMarketReport, renderMarketReportIndex, type MarketReport, type MarketGroup, type Period } from '../report/marketReport.js';
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
  groups.push({id,name,source:'네이버 금융 지수 일봉 및 국내 주식 스냅샷 · 구성 종목은 시가총액 상위 30개 표본',universe:rows.length,assets,snapshotDate:rows.map(r=>r.tradedAt).filter((d):d is string=>Boolean(d)).sort().at(-1)??null,breadth:{up:rows.filter(r=>(r.changePct??0)>0).length,down:rows.filter(r=>(r.changePct??0)<0).length,flat:rows.filter(r=>r.changePct===0).length}});
 }
 for(const [id,name,file,folder] of [['M3','코인','coins.json','c'],['M4','ETF','etfs.json','s']] as const){
  const list=await json(join(root,'site',file)); const rows:CoinRow[]=list?.rows??[]; const assets=[];
  for(const row of [...rows].sort((a,b)=>(b[12]??0)-(a[12]??0))){const page=await json(join(root,'site',folder,`${row[0]}.json`)); const bars=page?.bars?.map((b:[string,number,number,number,number])=>({date:b[0],close:b[4]}))??[]; const asset=periodAsset(row[0],row[1],bars,date,from,period,row[12]);if(asset)assets.push(asset);}
  groups.push({id,name,source:id==='M3'?'업비트 원화마켓 일봉 · 09:00 KST 경계 · 스냅샷 등락은 24시간 기준':'네이버 금융 국내 상장 ETF 일봉 · 가격 수익률',universe:rows.length,assets,snapshotDate:list?.date??null,breadth:{up:rows.filter(r=>(r[5]??0)>0).length,down:rows.filter(r=>(r[5]??0)<0).length,flat:rows.filter(r=>r[5]===0).length}});
 }
 return groups;
}
export async function writeMarketReports(root:string, now:Date, universe:readonly UniverseRow[], apiKey?:string, injectedClient?:Anthropic, sharedBudget?:AiBudget):Promise<void>{
 const date=new Date(now.getTime()+9*3600000).toISOString().slice(0,10), dir=join(root,'reports','market');await mkdir(dir,{recursive:true});
 const budget=sharedBudget??await AiBudget.load(root,now);
 for(const period of ['daily','weekly'] as const){
  const file=join(dir,`${period}-${date}.json`); const old=await json(file) as MarketReport|null;
  if(old?.ai.status==='OK')continue;
  const report:MarketReport={schema:'curia.market-report.v1',date,from:period==='weekly'?weekStart(date):date,generatedAt:now.toISOString(),period,groups:await collectMarketGroups(root,date,period,universe),ai:{status:'SKIPPED',error:'AI 키 또는 예산 확인 필요'}};
  if((apiKey||injectedClient)&&budget.allows('brief')&&report.groups.some(g=>g.assets.some(a=>a.date===date))){
   budget.reserve('brief'); let accounted=false;
   try{
    const client=injectedClient??new Anthropic({apiKey:apiKey!,timeout:180000,maxRetries:1});
    const input={...report,groups:report.groups.map(g=>({...g,assets:g.assets.slice(0,20),leaders:[...g.assets].filter(a=>a.returnPct!==null).sort((a,b)=>b.returnPct!-a.returnPct!).slice(0,5),laggards:[...g.assets].filter(a=>a.returnPct!==null).sort((a,b)=>a.returnPct!-b.returnPct!).slice(0,5)}))};
    const response=await client.beta.messages.stream({model:BRIEF_MODEL,max_tokens:5000,system:'당신은 CURIA의 시장 AI 위원회다. 제공한 자료만 사용해서 한국어 심층 시장 리포트를 쓴다. 코스피·코스닥·코인·ETF 담당 관점을 각각 최소 1개씩 제시한다. 모든 문장은 FACT/INFERENCE/ASSUMPTION과 근거 M1~M4를 갖는다. 일간과 월요일부터 주중 누적 수익률을 혼동하지 않는다. breadth는 현재 스냅샷이며 주간 breadth가 아니다. 종목은 표본이고 전체시장 대표성을 보장하지 않는다. 기준일이 오래된 자료와 결측은 명시한다. 제공되지 않은 거시지표·뉴스·수급·ETF 자금유입·인과관계·가격 목표·확률을 만들지 않는다. 합의·이견·강세/기본/약세 성립 조건과 무효화·레드팀·다음 관찰·데이터 공백을 상세히 제시한다.',messages:[{role:'user',content:JSON.stringify(input)}],output_format:betaZodOutputFormat(MarketCouncilSchema)} as never).finalMessage();
    await budget.record(`CURIA-MARKET-${period}`,'brief',{status:'OK',promptVersion:'curia.market.v1',generatedAt:now.toISOString(),bullish:[],bearish:[],uncertain:[],watch:[],dataGaps:[],dropped:0,evidence:[],model:response.model,servedBy:response.model,usage:{inputTokens:response.usage.input_tokens,outputTokens:response.usage.output_tokens}},now);accounted=true;
    const text=response.content.filter(b=>b.type==='text').map(b=>b.text).join('');const council=MarketCouncilSchema.parse(JSON.parse(text));
    if(response.stop_reason==='max_tokens'||!validCouncil(council,report.groups))throw new Error('위원회 구조 또는 근거 검증 실패');
    report.ai={status:'OK',model:response.model,council};
   }catch(error){report.ai={status:'FAILED',error:error instanceof Error?error.message.slice(0,180):'생성 오류'};}finally{if(!accounted)budget.spent-=0.03;}
  }else if(!report.groups.some(g=>g.assets.some(a=>a.date===date)))report.ai.error='당일 데이터가 없어 위원회 생성을 보류합니다';
  await writeFile(file,JSON.stringify(report,null,2)+'\n');
 }
}
export async function publishMarketReports(root:string,siteDir:string):Promise<MarketReport[]>{
 const dir=join(root,'reports','market'); const reports:MarketReport[]=[];await mkdir(join(siteDir,'market'),{recursive:true});
 for(const file of (await readdir(dir).catch(()=>[])).filter(f=>/^(daily|weekly)-\d{4}-\d{2}-\d{2}\.json$/.test(f))){const report=await json(join(dir,file)) as MarketReport;reports.push(report);await writeFile(join(siteDir,'market',file.replace('.json','.html')),renderMarketReport(report,'../'));await writeFile(join(siteDir,'market',file),JSON.stringify(report));}
 await writeFile(join(siteDir,'market-reports.html'),renderMarketReportIndex(reports));
 return reports;
}
