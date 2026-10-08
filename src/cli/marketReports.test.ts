import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { writeMarketReports, savePrivateMarketReport } from './marketReports.js';
import { AiBudget } from './aiBudget.js';
import { renderMarketReport, renderMarketDeep, type MarketReport } from '../report/marketReport.js';
import { unseal } from '../report/seal.js';
import { tempDir } from '../testTmp.js';
const noNews=(async()=>new Response('',{status:404})) as unknown as typeof fetch;

test('truncated market analysis records billed tokens of both tries and leaves a retryable failure', async()=>{
 const root=await tempDir('gnomon-market-');
 try {
  await mkdir(join(root,'data','prices'),{recursive:true});
  await writeFile(join(root,'data','prices','KOSPI.jsonl'),'{"date":"2026-10-06","close":100}\n{"date":"2026-10-07","close":110}\n');
  const client={beta:{messages:{stream:(params:Record<string,unknown>)=>{
   assert.equal(params.max_tokens,12000);
   assert.equal(typeof ((params.output_config as Record<string,unknown>).format as Record<string,unknown>).parse,'undefined');
   return {finalMessage:async()=>({model:'claude-haiku-4-5',stop_reason:'max_tokens',usage:{input_tokens:100,output_tokens:12000},content:[{type:'text',text:'{"summary":'}]})};
  }}}} as unknown as Anthropic;
  const budget=new AiBudget(root,'2026-10',25,0);
  await writeMarketReports(root,new Date('2026-10-07T09:30:00Z'),[],undefined,client,budget,false,noNews);
  for(const period of ['daily']){
   const report=JSON.parse(await readFile(join(root,'reports','market',`${period}-2026-10-07.json`),'utf8'));
   assert.equal(report.ai.status,'FAILED');assert.match(report.ai.error,/출력 길이 제한/);
  }
  const ledger=(await readFile(AiBudget.path(root),'utf8')).trim().split('\n').map(x=>JSON.parse(x));
  assert.equal(ledger.length,2);assert.equal(ledger[0].outputTokens,12000);
  assert.ok(Math.abs(budget.spent-0.1202)<1e-8);
 } finally {await rm(root,{recursive:true,force:true});}
});

test('paid market analysis is encrypted in storage and absent from free HTML; missing key fails closed',async()=>{
 const root=await tempDir('curia-private-');
 const summary={text:'공개 요약',kind:'FACT' as const,refs:['M1']};
 const r:MarketReport={schema:'curia.market-report.v2',date:'2026-10-07',from:'2026-10-07',generatedAt:'2026-10-07T09:30:00Z',period:'daily',groups:[],ai:{status:'OK',council:{summary,desks:[{name:'코스피',view:'중립',claims:[{...summary,text:'유료 담당자 근거'}]}],consensus:[],disagreements:[],scenarios:[],redTeam:[],watch:[],dataGaps:[]}}};
 try{
  const saved=await savePrivateMarketReport(join(root,'report.json'),r,'test-secret');
  const raw=await readFile(join(root,'report.json'),'utf8');assert.ok(!raw.includes('유료 담당자 근거'));assert.equal(saved.ai.council,undefined);
  assert.match(await unseal(saved.ai.sealed!,'test-secret'),/유료 담당자 근거/);
  const html=renderMarketReport(saved);assert.ok(html.includes('공개 요약'));assert.ok(!html.includes('유료 담당자 근거'));assert.ok(html.includes('data-symbol="MARKET-DAILY"'));assert.ok(html.includes('data-report-date="2026-10-07"'));
  assert.ok(renderMarketDeep(r).includes('유료 담당자 근거'));
  const closed=await savePrivateMarketReport(join(root,'closed.json'),r,'');assert.equal(closed.ai.status,'FAILED');assert.equal(closed.ai.council,undefined);assert.ok(!(await readFile(join(root,'closed.json'),'utf8')).includes('유료 담당자 근거'));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('a finished market report is kept unless regeneration is asked, and a failed regeneration keeps it',async()=>{
 const root=await tempDir('gnomon-regen-');
 try{
  await mkdir(join(root,'data','prices'),{recursive:true});
  await writeFile(join(root,'data','prices','KOSPI.jsonl'),'{"date":"2026-10-06","close":100}\n{"date":"2026-10-07","close":110}\n');
  await mkdir(join(root,'reports','market'),{recursive:true});
  const file=join(root,'reports','market','daily-2026-10-07.json');
  const old={schema:'curia.market-report.v4',date:'2026-10-07',from:'2026-10-07',generatedAt:'2026-10-07T09:30:00Z',period:'daily',groups:[],ai:{status:'OK',summary:{text:'이전 요약',kind:'FACT',refs:['M1']},sealed:'x'}};
  await writeFile(file,JSON.stringify(old));
  let calls=0;
  const client={beta:{messages:{stream:()=>{calls++;return {finalMessage:async()=>({model:'m',stop_reason:'max_tokens',usage:{input_tokens:1,output_tokens:1},content:[{type:'text',text:'{'}]})};}}}} as unknown as Anthropic;
  await writeMarketReports(root,new Date('2026-10-07T09:30:00Z'),[],undefined,client,new AiBudget(root,'2026-10',25,0),false,noNews);
  assert.equal(calls,0);
  await writeMarketReports(root,new Date('2026-10-07T12:30:00Z'),[],undefined,client,new AiBudget(root,'2026-10',25,0),true,noNews);
  assert.equal(calls,3);
  const kept=JSON.parse(await readFile(file,'utf8'));
  assert.equal(kept.ai.status,'OK');assert.equal(kept.ai.summary.text,'이전 요약');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('market numbers: signed returns must come from the data and whole-market counts are never the sample\'s',async()=>{
 const {marketNumberIssues}=await import('../report/marketReport.js');
 const claim=(text:string)=>({text,kind:'FACT' as const,refs:['M1']});
 const groups=[{id:'M1',name:'코스피',source:'s',universe:944,snapshotDate:'2026-10-07',breadth:{up:365,down:506,flat:72},assets:[{symbol:'KOSPI',name:'코스피',date:'2026-10-07',close:6803.9,returnPct:-1.980727,baseline:null,value:null},{symbol:'000660',name:'SK하이닉스',date:'2026-10-07',close:1,returnPct:-3.8706,baseline:null,value:null}]}];
 const council=(texts:string[])=>({summary:claim(texts[0]!),desks:[],consensus:texts.slice(1).map(claim),disagreements:[],scenarios:[],redTeam:[],watch:[],dataGaps:[]}) as never;
 assert.deepEqual(marketNumberIssues(council(['코스피 -1.98%, SK하이닉스 -3.87%, 하락 506개 상승 365개.']),groups as never),[]);
 const bad=marketNumberIssues(council(['코스피 상위30 중 하락 506개 vs 상승 365개.','평균 -2.40% 하락.']),groups as never);
 assert.deepEqual(marketNumberIssues(council(['상승 비중이 +2.3%p 늘었어요.']),groups as never),[]);
 assert.equal(bad.length,2);assert.match(bad[0]!,/506개/);assert.match(bad[1]!,/-2\.40%/);
});

test('market news: today\'s headlines only, one per story, numbered N1…',async()=>{
 const {collectMarketNews}=await import('./marketReports.js');
 const rss=(items:string)=>`<rss><channel>${items}</channel></rss>`;
 const item=(t:string,d:string)=>`<item><title>${t} - 연합뉴스</title><link>https://www.yna.co.kr/view/${encodeURIComponent(t)}</link><pubDate>${d}</pubDate><source>연합뉴스</source></item>`;
 const body=rss(item('코스피 2% 하락 마감','Wed, 07 Oct 2026 07:00:00 GMT')+item('코스피, 2% 하락 마감','Wed, 07 Oct 2026 06:50:00 GMT')+item('어제 기사','Mon, 05 Oct 2026 07:00:00 GMT'));
 const fake=(async()=>new Response(body,{status:200,headers:{'content-type':'application/rss+xml; charset=utf-8'}})) as unknown as typeof fetch;
 const news=await collectMarketNews('2026-10-07',{fetch:fake});
 assert.equal(news.length,1);assert.equal(news[0]!.id,'N1');assert.equal(news[0]!.title,'코스피 2% 하락 마감');
});
