import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { writeMarketReports } from './marketReports.js';
import { AiBudget } from './aiBudget.js';

test('truncated market analysis records billed tokens and leaves a retryable failure', async()=>{
 const root=await mkdtemp(join(tmpdir(),'curia-market-'));
 try {
  await mkdir(join(root,'data','prices'),{recursive:true});
  await writeFile(join(root,'data','prices','KOSPI.jsonl'),'{"date":"2026-10-06","close":100}\n{"date":"2026-10-07","close":110}\n');
  const client={beta:{messages:{stream:(params:Record<string,unknown>)=>{
   assert.equal(params.max_tokens,12000);
   assert.equal(typeof (params.output_format as Record<string,unknown>).parse,'undefined');
   return {finalMessage:async()=>({model:'claude-haiku-4-5',stop_reason:'max_tokens',usage:{input_tokens:100,output_tokens:12000},content:[{type:'text',text:'{"summary":'}]})};
  }}}} as unknown as Anthropic;
  const budget=new AiBudget(root,'2026-10',25,0);
  await writeMarketReports(root,new Date('2026-10-07T09:30:00Z'),[],undefined,client,budget);
  for(const period of ['daily','weekly']){
   const report=JSON.parse(await readFile(join(root,'reports','market',`${period}-2026-10-07.json`),'utf8'));
   assert.equal(report.ai.status,'FAILED');assert.match(report.ai.error,/출력 길이 제한/);
  }
  const ledger=(await readFile(AiBudget.path(root),'utf8')).trim().split('\n').map(x=>JSON.parse(x));
  assert.equal(ledger.length,2);assert.equal(ledger[0].outputTokens,12000);
  assert.ok(Math.abs(budget.spent-0.1202)<1e-8);
 } finally {await rm(root,{recursive:true,force:true});}
});
