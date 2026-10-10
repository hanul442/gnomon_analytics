import { marketPulse, type StockCalc } from '../analysis/quickCalc.js';
import { ANALYSTS } from '../analysis/analysts.js';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { seal, unseal, deepPath } from '../report/seal.js';
import { AiBudget } from './aiBudget.js';
/** The market committee runs on the small model (one call a day over every group's numbers). */
const MARKET_MODEL = 'claude-haiku-4-5';
import { MarketCouncilSchema, MarketCouncilGenerationSchema, parseMarketCouncil, periodAsset, weekStart, validCouncil, marketNumberIssues, marketSymbol, renderMarketDeep, renderMarketReport, renderMarketReportIndex, type MarketReport, type MarketGroup, type Period } from '../report/marketReport.js';
import type { UniverseRow } from '../sources/naverList.js';
import type { PriceBar } from '../types.js';
import { readLog } from '../store/jsonlLog.js';
import type { CoinRow } from './coins.js';
import { fetchRss, googleNewsSearchUrl, GOOGLE_NEWS_SOURCE } from '../sources/news.js';
import type { MarketNews } from '../report/marketReport.js';
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
 for(const [id,name,file,folder] of [['M3','코인','coins.json','c'],['M4','ETF','etfs.json','s'],['M5','미국','usstocks.json','u']] as const){
  const list=await json(join(root,'site',file)); const rows:CoinRow[]=list?.rows??[]; const assets=[];
  for(const row of [...rows].sort((a,b)=>(b[12]??0)-(a[12]??0))){const page=await json(join(root,'site',folder,`${row[0]}.json`)); const bars=page?.bars?.map((b:[string,number,number,number,number])=>({date:b[0],close:b[4]}))??[]; const asset=periodAsset(row[0],row[1],bars,date,from,period,row[12]);if(asset)assets.push(asset);}
  const signalCalcs=(await Promise.all(rows.map(async r=>(await json(join(root,'site',folder,r[0]+'.json')))?.calc as StockCalc|null))).filter((c):c is StockCalc=>!!c&&c.date<=date);
  groups.push({id,name,temperature:marketPulse(signalCalcs),source:id==='M5'?'네이버 해외 주식 일봉(달러, 미국 현지 날짜) · 시가총액 상위 종목 표본 · 지수 자료 없음':id==='M3'?'업비트 원화마켓 일봉 · 09:00 KST 경계 · 스냅샷 등락은 전일 종가(09:00 KST) 대비 · 거래대금만 24시간 기준':'네이버 금융 국내 상장 ETF 일봉 · 가격 수익률',universe:rows.length,assets,snapshotDate:list?.date??null,breadth:{up:rows.filter(r=>(r[5]??0)>0).length,down:rows.filter(r=>(r[5]??0)<0).length,flat:rows.filter(r=>r[5]===0).length}});
 }
 return groups;
}
/** Today's market headlines (G-123) from Google News and 매일경제 RSS: one per story, newest first, N1…N12. Best effort. */
export const MARKET_NEWS_QUERIES=['코스피 마감','코스닥 마감','증시 외국인','비트코인 시세','ETF 시장'];
export async function collectMarketNews(date:string, options:{fetch?:typeof fetch;now?:()=>Date}={}):Promise<MarketNews[]>{
 const lists=await Promise.all([...MARKET_NEWS_QUERIES.map(q=>fetchRss(googleNewsSearchUrl(q+' when:1d'),GOOGLE_NEWS_SOURCE,options).catch(()=>[])),fetchRss('https://www.mk.co.kr/rss/50200011/','rss:mk-stock',{...options,publisher:'매일경제'}).catch(()=>[])]);
 const kst=(iso:string)=>new Date(Date.parse(iso)+9*3600000).toISOString().slice(0,10);
 const seen=new Set<string>(),out:MarketNews[]=[];
 const key=(t:string)=>t.replace(/[\s\[\]【】()"'“”‘’·…,.!?-]/g,'').slice(0,18);
 for(const n of lists.flat().filter(n=>kst(n.publishedAt)===date).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))){
  const k=key(n.title);if(!k||seen.has(k))continue;seen.add(k);
  out.push({id:`N${out.length+1}`,title:n.title.slice(0,140),publisher:n.publisher,publishedAt:n.publishedAt,url:n.url});
  if(out.length>=12)break;
 }
 return out;
}
export async function writeMarketReports(root:string, now:Date, universe:readonly UniverseRow[], apiKey?:string, injectedClient?:Anthropic, sharedBudget?:AiBudget, regenerate=process.env.MARKET_REGEN==='1', newsFetch?:typeof fetch):Promise<void>{
 const date=new Date(now.getTime()+9*3600000).toISOString().slice(0,10), dir=join(root,'reports','market');await mkdir(dir,{recursive:true});
 const budget=sharedBudget??await AiBudget.load(root,now);
 for(const period of ['daily'] as const){
  const file=join(dir,`${period}-${date}.json`); const old=await json(file) as MarketReport|null;
  // A finished report is kept; MARKET_REGEN=1 (manual run) asks for a fresh committee, keeping the old one if that fails.
  const done=old?.schema==='curia.market-report.v4'&&old.ai.status==='OK'&&!!(old.ai.council||old.ai.sealed);
  if(done&&!regenerate){await savePrivateMarketReport(file,old!);continue;}
  const news=await collectMarketNews(date,newsFetch?{fetch:newsFetch}:{});
  const report:MarketReport={schema:'curia.market-report.v4',date,from:date,generatedAt:now.toISOString(),period,groups:await collectMarketGroups(root,date,period,universe),...(news.length?{news}:{}),ai:{status:'SKIPPED',error:'AI 키 또는 예산 확인 필요'}};
  // The committee's structure is checked strictly, so a regeneration gets up to three tries; each failure is logged (no secrets in it).
  const hasToday=report.groups.some(g=>g.assets.some(a=>a.date===date));
  for(let attempt=1;attempt<=(regenerate?3:2)&&report.ai.status!=='OK'&&(apiKey||injectedClient)&&hasToday&&budget.allows('market');attempt++){
   budget.reserve('market'); let accounted=false;
   try{
    const client=injectedClient??new Anthropic({apiKey:apiKey!,timeout:180000,maxRetries:1});
    const input={...report,committee:[...ANALYSTS,{id:'MARKET',name:'시장 데스크',focus:'시장 상대강도와 분포'},{id:'TECHNICAL',name:'기술 데스크',focus:'제공된 기술 신호 분포'},{id:'FLOW',name:'수급 데스크',focus:'거래대금·거래량, 투자자 수급 없으면 보류'},{id:'FUNDAMENTAL',name:'펀더멘털 데스크',focus:'실적 자료 없으면 보류'},{id:'EVENT',name:'공시·뉴스 데스크',focus:'공시·뉴스 자료 없으면 보류'}],groups:report.groups.map(g=>({...g,breadthScope:`breadth(up/down/flat)는 ${g.name} 전체 ${g.universe}종목의 오늘 등락 수(표본 아님)`,sampleScope:`assets·leaders·laggards는 ${g.assets.length}개 표본`,assets:g.assets.slice(0,20),leaders:[...g.assets].filter(a=>a.returnPct!==null).sort((a,b)=>b.returnPct!-a.returnPct!).slice(0,5),laggards:[...g.assets].filter(a=>a.returnPct!==null).sort((a,b)=>a.returnPct!-b.returnPct!).slice(0,5)}))};
    const response=await client.beta.messages.stream({model:MARKET_MODEL,max_tokens:12000,system:'당신은 GNOMON의 시장 AI 위원회다. 제공한 자료만 사용해서 한국어 심층 시장 리포트를 쓴다. 코스피·코스닥·코인·ETF·미국 담당 관점을 각각 최소 1개씩 제시한다. 미국은 달러 기준이고 지수 자료 없이 종목 분포만 있다. 모든 문장은 FACT/INFERENCE/ASSUMPTION과 근거 M1~M5(시장 자료) 또는 N1~N12(오늘 뉴스 헤드라인)를 갖는다. 뉴스는 제목에 있는 사실만 쓰고, 가격 움직임과의 관계는 단정하지 않고 \'~와 겹쳐요\'·\'~영향일 수 있어요\'처럼 INFERENCE로 쓴다. 문체: 모든 text는 자연스러운 한국어 해요체 완결 문장이다. \'약세장.\'·\'광폭 하락.\'처럼 명사로 끝나는 메모체·개조식은 쓰지 않는다. 한 문장에 숫자는 세 개까지만 넣는다. summary는 3~4문장으로, ① 오늘 시장 전체가 어떤 하루였는지 ② 무엇이 시장을 끌어내리거나 받쳤는지(관련 뉴스가 있으면 함께) ③ 코인·ETF는 어땠는지 ④ 내일 무엇을 지켜볼지를 처음 보는 사람도 이해하게 쓴다. debate는 실제 회의처럼 주고받는다: 앞 사람을 이름으로 부르며 동의하거나 반박하고(\'추세 분석가 말씀처럼…\', \'저는 조금 다르게 봐요\'), 필요하면 질문도 던진다. 같은 문장 틀을 반복하지 않는다. 일간과 월요일부터 주중 누적 수익률을 혼동하지 않는다. breadth는 현재 스냅샷이며 주간 breadth가 아니다. 종목은 표본이고 전체시장 대표성을 보장하지 않는다. 기준일이 오래된 자료와 결측은 명시한다. 제공되지 않은 거시지표·뉴스·수급·ETF 자금유입·인과관계·가격 목표·확률을 만들지 않는다. 시나리오는 강세·기본·약세 정확히 3개만 작성한다. 요약에서 상위 표본의 등락 범위를 전체 시장 최솟값·최댓값으로 일반화하지 않는다. breadth(up/down/flat)는 시장 전체 종목의 등락 수이므로 \'상위30\'·\'표본\'의 수치로 부르지 않는다. 수익률(%)은 제공된 returnPct 값을 소수 둘째 자리까지 그대로 쓰고, 평균·합계 등 새 수익률을 계산해 만들지 않는다. \'광폭\'·\'낙장\' 같은 표현 대신 \'큰 폭\'·\'하락\'을 쓴다. 합의·이견·강세/기본/약세 성립 조건과 무효화·레드팀·다음 관찰·데이터 공백을 상세히 제시한다. experts는 제공한 committee의 전문가 11명 각각 정확히 한 번씩 판단하며, 부족한 실적·수급·뉴스 근거는 INSUFFICIENT_DATA로 표시한다. 시장 이름을 전문가 이름으로 쓰지 않는다. debate는 정확히 12차례, 첫 11차례에 전문가 11명이 각각 한 번씩 직접 말하고 마지막은 RED_TEAM이다. 앞 전문가의 근거를 짚는 답변과 반론을 포함한다. replyTo는 앞 차례의 0부터 시작하는 번호이고 첫 발언·대상이 없는 발언·RED_TEAM은 -1이다. 자기 자신에게 답하지 않는다. 전문가의 토론 stance는 experts 판단과 일치하며 근거 부족은 NEUTRAL로 발언한다. experts.claim과 debate.claim text는 120자 이내로 쓴다. 각 담당 claims는 2개, 합의·이견·레드팀·관찰은 각각 2~3개로 제한하고 각 text는 한국어 200자 이내로 쓴다.',messages:[{role:'user',content:JSON.stringify(input)}],output_config:{format:{type:'json_schema',schema:betaZodOutputFormat(MarketCouncilGenerationSchema).schema}}} as never).finalMessage();
    await budget.record(`GNOMON-MARKET-${period}`,'market',{status:'OK',promptVersion:'curia.market.v4',generatedAt:now.toISOString(),bullish:[],bearish:[],uncertain:[],watch:[],dataGaps:[],dropped:0,evidence:[],model:response.model,servedBy:response.model,usage:{inputTokens:response.usage.input_tokens,outputTokens:response.usage.output_tokens}},now);accounted=true;
    if(response.stop_reason==='max_tokens')throw new Error('AI 출력 길이 제한 도달 · 재생성 필요');
    const text=response.content.filter(b=>b.type==='text').map(b=>b.text).join('');const council=MarketCouncilGenerationSchema.parse(parseMarketCouncil(text));
    if(!validCouncil(council,report.groups,report.news??[]))throw new Error('위원회 구조 또는 근거 검증 실패');
    const numberIssues=marketNumberIssues(council,report.groups);if(numberIssues.length)throw new Error(`숫자 검증 실패 ${numberIssues.length}건: ${numberIssues[0]}`);
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
  await writeFile(join(siteDir,'market',file),JSON.stringify({...report,groups:report.groups.map(g=>({...g,assets:g.assets.slice(0,1)})),ai:{status:report.ai.status,summary:report.ai.summary,error:report.ai.error,model:report.ai.model}}));}
 // G-190: each day's page links the day before and after, so the dailies read in a row.
 const days=reports.map(r=>r.date).sort();
 for(const report of reports){const i=days.indexOf(report.date);await writeFile(join(siteDir,'market',`daily-${report.date}.html`),renderMarketReport(report,'../',{prev:days[i-1],next:days[i+1]}));}
 await writeFile(join(siteDir,'market-reports.html'),renderMarketReportIndex(reports));
 return reports;
}
