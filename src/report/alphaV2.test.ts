import {formatCoinTime} from './coinChart.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {renderStockPage,APP_JS,UI_JS} from './renderHtml.js';
import {renderScreener} from './renderScreener.js';
import {renderGuide,renderUpdates} from './alphaPages.js';
import {inputHash} from '../worker/reports.js';
import {buildDailyReport} from './dailyReport.js';
import {renderCalculationPage} from './calculationPage.js';
import {indicatorKey} from './indicatorLinks.js';

test('new pages and all shared script bundles parse as browser JavaScript',()=>{
 for(const html of [renderStockPage(),renderStockPage(true),renderScreener(),renderGuide(),renderUpdates()]){
  for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]!);
 }
 new vm.Script(APP_JS);new vm.Script(UI_JS);
});
test('request deduplication ignores retrieval time but includes new price evidence',async()=>{
 const report=buildDailyReport({symbol:'000660',name:'테스트',date:'2026-10-06',generatedAt:new Date(),bars:[],disclosures:[],sources:[]});
 const newer={...report,generatedAt:'2099-01-01T00:00:00Z'};assert.equal(await inputHash(report),await inputHash(newer));
 newer.headline='근거가 달라진 분석';assert.notEqual(await inputHash(report),await inputHash(newer));
});

test('coin chart labels support minute timestamps and daily BusinessDay values during switching',()=>{
 assert.equal(formatCoinTime(Date.parse('2026-10-06T05:00:00Z')/1000),'10-06 14:00');
 assert.equal(formatCoinTime({year:2026,month:10,day:6}),'10-06 00:00');
 assert.equal(formatCoinTime('2026-10-06'),'10-06 00:00');assert.equal(formatCoinTime({}), '');
});

test('unreported stock and coin pages use the full report template and keep missing AI slots',()=>{
 for(const kind of [undefined,'coin'] as const){
  const html=renderCalculationPage({symbol:kind?'KRW-BTC':'999999',name:'미생성',...(kind?{kind}:{}),bars:Array.from({length:80},(_,i)=>({symbol:kind?'KRW-BTC':'999999',source:'test',retrievedAt:'2026-10-06T00:00:00Z',date:new Date(Date.UTC(2026,6,1+i)).toISOString().slice(0,10),open:100+i,high:105+i,low:95+i,close:102+i,volume:1000})),now:new Date('2026-10-06T00:00:00Z')});
  for(const id of ['tab-home','tab-chart','tab-technical','tab-ai','tab-flows','tab-fundamentals','tab-news','home-conclusion','chart-card','ind-sheet','structure','parliament-ai','debate','join','chart-scenarios'])assert.ok(html.includes(`id="${id}"`),id);
  assert.match(html,/data-chart-indicator="fib"/);assert.match(html,/시나리오 미생성/);assert.match(html,/토론이 아직 생성되지 않았어요/);assert.match(html,/v2-mask/);assert.doesNotMatch(html,/AI 위원회가 고른 테스트 가격/);
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!match[1]!.includes('application/json'))new vm.Script(match[2]!);
 }
 const empty=renderCalculationPage({symbol:'999999',name:'가격 미수집',bars:[],now:new Date()});for(const id of ['home-conclusion','conclusion','chart-card','structure','parliament-ai','debate','join'])assert.ok(empty.includes(`id="${id}"`),id);
 assert.equal(indicatorKey('RSI (14)'),'rsi');assert.equal(indicatorKey('단순 이동평균 60일'),'ma60');assert.equal(indicatorKey('단순 이동평균 240일'),null);assert.equal(indicatorKey('지수 이동평균 12일'),'ema12');
});

test('scenario charts share ranges, do not invent absent forecasts, and do not expose locked ranges',async()=>{
 const {scenarioPlot,scenarioPanel,SCENARIO_JS}=await import('./scenarioChart.js');
 const {LOCKED_TEXT}=await import('../analysis/commentary.js');
 const report=buildDailyReport({symbol:'000660',name:'테스트',date:'2026-10-06',generatedAt:new Date(),bars:Array.from({length:30},(_,i)=>({symbol:'000660',source:'test',retrievedAt:'2026-10-06T00:00:00Z',date:'2026-09-'+String(i+1).padStart(2,'0'),open:100,high:105,low:95,close:100+i,volume:1000})),disclosures:[],sources:[]});
 report.commentary={status:'OK',scenarios:[{kind:'BASE',zone:[120,140],narrative:{text:'검증 범위'}}]} as any;
 assert.match(scenarioPlot(report,'BASE'),/<svg/);assert.match(scenarioPanel(report),/120~140/);assert.match(scenarioPanel(report),/data-scenario="ALL"/);
 assert.match(scenarioPlot(report,'BEAR'),/열람 권한/);
 report.commentary!.scenarios![0]!.narrative.text=LOCKED_TEXT;
 assert.doesNotMatch(scenarioPanel(report),/120~140|검증 범위|<svg/);
 report.commentary!.scenarios![0]!.narrative.text='근거';delete report.commentary!.scenarios![0]!.zone;
 assert.match(scenarioPlot(report,'BASE'),/예측 가격 범위가 없어요/);new vm.Script(SCENARIO_JS);
});
