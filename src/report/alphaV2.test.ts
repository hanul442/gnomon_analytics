import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {renderStockPage,APP_JS,UI_JS} from './renderHtml.js';
import {renderScreener} from './renderScreener.js';
import {renderGuide,renderUpdates} from './alphaPages.js';
import {inputHash} from '../worker/reports.js';
import {buildDailyReport} from './dailyReport.js';

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
