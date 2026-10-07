import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodAsset, weekStart, renderMarketReport, parseMarketCouncil, type MarketReport } from './marketReport.js';
const bars=[{date:'2026-10-02',close:100},{date:'2026-10-05',close:110},{date:'2026-10-07',close:121},{date:'2026-10-08',close:999}];
test('weekly uses pre-Monday baseline, filters future prices and deduplicates sessions',()=>{
 assert.equal(weekStart('2026-10-07'),'2026-10-05');
 const r=periodAsset('K','K',bars,'2026-10-07','2026-10-05','weekly')!;
 assert.equal(r.close,121);assert.equal(r.baseline,'2026-10-02');assert.ok(Math.abs(r.returnPct!-21)<1e-8);
 const d=periodAsset('K','K',bars,'2026-10-07','2026-10-07','daily')!;assert.ok(Math.abs(d.returnPct!-10)<1e-8);
});
test('unsupported extra scenarios can be excluded, but missing required cases never pass',()=>{
 const claim={text:'근거',kind:'FACT',refs:['M1']};const raw={summary:claim,desks:['코스피','코스닥','코인','ETF'].map(name=>({name,view:'중립',claims:[claim]})),consensus:[],disagreements:[],scenarios:['강세','기본','약세','추가 전망'].map(name=>({name,trigger:claim,outlook:claim,invalidation:claim})),redTeam:[],watch:[],dataGaps:[]};
 assert.equal(parseMarketCouncil(JSON.stringify(raw)).scenarios.length,3);
 raw.scenarios.splice(1,1);assert.throws(()=>parseMarketCouncil(JSON.stringify(raw)));
});
test('stale data and missing baseline never become current returns',()=>{
 assert.equal(periodAsset('K','K',bars.slice(0,1),'2026-10-07','2026-10-07','daily')?.returnPct,null);
 assert.equal(periodAsset('K','K',bars.slice(1),'2026-10-07','2026-10-05','weekly')?.returnPct,null);
});
test('market report labels failures, partial week, and escapes AI errors',()=>{
 const r:MarketReport={schema:'curia.market-report.v2',date:'2026-10-07',from:'2026-10-05',generatedAt:'2026-10-07T09:30:00Z',period:'weekly',groups:[],ai:{status:'FAILED',error:'<script>bad</script>'}};
 const html=renderMarketReport(r);assert.ok(html.includes('주중 누적 집계'));assert.ok(html.includes('생성에 실패'));assert.ok(html.includes('&lt;script&gt;bad'));assert.ok(!html.includes('<script>bad'));
});
test('market committee preserves actual experts, reply targets, stances and references',async()=>{
 const {ANALYSTS}=await import('../analysis/analysts.js');const {validCouncil,renderMarketDeep}=await import('./marketReport.js');
 const speakers=[...ANALYSTS.map(a=>a.id),'MARKET','TECHNICAL','FLOW','FUNDAMENTAL','EVENT'];const claim={text:'전문가 검증 발언',kind:'FACT' as const,refs:['M1']};
 const council=parseMarketCouncil(JSON.stringify({summary:claim,desks:['코스피','코스닥','코인','ETF'].map(name=>({name,view:'중립',claims:[claim]})),consensus:[],disagreements:[],scenarios:['강세','기본','약세'].map(name=>({name,trigger:claim,outlook:claim,invalidation:claim})),redTeam:[],watch:[],dataGaps:[],experts:speakers.map(speaker=>({speaker,stance:'NEUTRAL',claim})),debate:[...speakers,'RED_TEAM'].map((speaker,i)=>({speaker,stance:'NEUTRAL',replyTo:i===0||i===11?-1:i-1,claim}))}));
 const groups=[{id:'M1',name:'코스피',source:'검증 데이터',universe:2,assets:[],snapshotDate:'2026-10-07',breadth:{up:1,down:1,flat:0}}];
 assert.equal(validCouncil(council,groups),true);const report:MarketReport={schema:'curia.market-report.v4',date:'2026-10-07',from:'2026-10-07',generatedAt:'2026-10-07T09:30:00Z',period:'daily',groups,ai:{status:'OK',council,summary:claim}};
 const html=renderMarketDeep(report);assert.match(html,/추세·모멘텀 PM/);assert.equal((html.match(/class="db-turn /g)??[]).length,12);assert.match(html,/data-reply="0"/);assert.doesNotMatch(renderMarketReport(report),/전문가 검증 발언[\s\S]*전문가 검증 발언/);
 council.debate![1]!.replyTo=1;assert.equal(validCouncil(council,groups),false);council.debate![1]!.replyTo=0;council.debate![1]!.stance='BULLISH';assert.equal(validCouncil(council,groups),false);
});

 test('unsupported claim classification is conservatively disclosed as an assumption',()=>{
 const claim={text:'근거',kind:'OBSERVATION',refs:['M1']};
 const raw={summary:claim,desks:['코스피','코스닥','코인','ETF'].map(name=>({name,view:'중립',claims:[claim]})),consensus:[],disagreements:[],scenarios:['강세','기본','약세'].map(name=>({name,trigger:claim,outlook:claim,invalidation:claim})),redTeam:[],watch:[],dataGaps:[]};
 const council=parseMarketCouncil(JSON.stringify(raw));
 assert.equal(council.summary.kind,'ASSUMPTION');assert.equal(council.desks[0]!.claims[0]!.kind,'ASSUMPTION');
 assert.deepEqual(council.summary.refs,['M1']);assert.match(council.dataGaps[0]!,/가정으로 표시/);
 });
