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
