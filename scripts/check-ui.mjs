// Offline browser verification: fixture API, no production account or paid model calls.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {renderSite} from '../dist/cli/daily.js';
import {loadTickers} from '../dist/config/tickers.js';
import {quickCalc} from '../dist/analysis/quickCalc.js';
import {scenarioPanel,SCENARIO_CSS,SCENARIO_JS} from '../dist/report/scenarioChart.js';
import {conclusionCard,CONCLUSION_CSS,CONCLUSION_JS} from '../dist/report/conclusion.js';
import {buildDailyReport} from '../dist/report/dailyReport.js';
import {CREDIT_COST} from '../dist/report/plans.js';
const root=process.cwd(),origin='http://localhost:8765';
process.env.GNM_API_URL=origin;
await renderSite(root,await loadTickers(root+'/tickers.json'));
const bars=Array.from({length:80},(_,i)=>({date:new Date(Date.UTC(2026,6,1+i)).toISOString().slice(0,10),open:100+i,high:105+i,low:95+i,close:102+i,volume:1000+i*10}));
for(const [dir,symbol,name,kind] of [['s','999999','UI 테스트','stock'],['c','KRW-BTC','비트코인','coin']]){
 await mkdir(root+'/site/'+dir,{recursive:true});await writeFile(root+'/site/'+dir+'/'+symbol+'.json',JSON.stringify({symbol,name,kind,market:'KOSPI',bars:bars.map(b=>[b.date,b.open,b.high,b.low,b.close,b.volume]),calc:quickCalc(symbol,bars,new Date())}));
}
await writeFile(root+'/site/screener.json',JSON.stringify({date:'2026-10-06',rows:[['999999','UI 테스트','P',100,181,2,'BULLISH',80,5,10,20,-5,'B',0,3,2,2,20,'A',100,-1,0,'',10,3,40,4]]}));
const scenarioReport=buildDailyReport({symbol:'999999',name:'시나리오 테스트',date:'2026-10-06',generatedAt:new Date(),bars:bars.map(b=>({...b,symbol:'999999',source:'fixture',retrievedAt:'2026-10-06T00:00:00Z'})),disclosures:[],sources:[]});
scenarioReport.commentary={status:'OK',scenarios:[['BULL',[190,220],195],['BASE',[170,190]],['BEAR',[130,160],160]].map(([kind,zone,trigger])=>({kind,zone,trigger,narrative:{text:'펼쳐 보는 상세 근거'},catalysts:['검증 조건'],invalidation:['무효화 조건']}))};
await writeFile(root+'/site/scenario-fixture.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font-family:sans-serif;margin:20px;color:#14233a}button{font:inherit}.card{border:1px solid #ddd;border-radius:14px;padding:12px}figure svg{max-width:100%}'+SCENARIO_CSS+CONCLUSION_CSS+'</style>'+conclusionCard(scenarioReport)+scenarioPanel(scenarioReport)+'<script>'+SCENARIO_JS+CONCLUSION_JS+'</script>');
let customExperts=[];
const api=async(path,req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(path==='/api/me')return res.end(JSON.stringify({user:{email:'fixture@example.test',rankAs:'pro',plan:'alpha',planName:'알파'},credits:{balance:400},costs:CREDIT_COST,survey:{onboarding:true,pulseDue:false}}));
 if(path==='/api/experts'){if(req.method==='POST'){let body='';for await(const x of req)body+=x;const expert={...JSON.parse(body),id:'00000000-0000-4000-8000-000000000001'};customExperts.push(expert);return res.end(JSON.stringify({expert}));}return res.end(JSON.stringify({items:customExperts}));}
 if(path==='/api/screens')return res.end(JSON.stringify({rows:[]}));
 if(path==='/api/screens/compose')return res.end(JSON.stringify({name:'거래량 증가',explanation:'테스트 조건',screen:{match:'all',rules:[{f:'vol1',op:'>=',v:3}]}}));
 if(path.startsWith('/api/candles/'))return res.end(JSON.stringify({bars:bars.slice(-20).map((b,i)=>({...b,time:1791262800+i*900}))}));
 if(path==='/api/ask/stream'){
  res.setHeader('Content-Type','text/event-stream');setTimeout(()=>res.write('event: delta\ndata: '+JSON.stringify({text:'테스트 답변'})+'\n\n'),450);return setTimeout(()=>res.end('event: done\ndata: '+JSON.stringify({answer:'테스트 답변',tier:'question',model:'claude-haiku-4-5',credits:5,balance:395})+'\n\n'),650);
 }
 if(path==='/api/reports/latest/999999')return res.end(JSON.stringify({job:{id:'fixture-done',status:'done'}}));
 if(path==='/api/reports/fixture-done')return res.end(JSON.stringify({status:'done',symbol:'999999',fragments:{scenarios:scenarioPanel(scenarioReport),ai:'<section id="debate"><div class="card debate"><div class="db-chips"></div><div class="db-turn" data-speaker="MARKET"><div class="db-who"><b>시장 데스크</b></div><div class="db-bubble">테스트 토론</div></div><details class="db-ev"><summary>근거</summary></details></div></section>'}}));
 return res.end(JSON.stringify({items:[],rows:[]}));
};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,origin);if(/^\/(?:me|screens|candles|ask|reports|events|notifications|watchlist|experts)(?:\/|$)/.test(url.pathname))return api('/api'+url.pathname,req,res);const file=resolve(root+'/site','.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+'/site/')){res.writeHead(403);return res.end();}const content=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.webp':'image/webp'})[extname(file)]||'application/octet-stream');res.end(content);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(8765,'localhost',r));
let browser;const errors=[];
try{
 browser=await chromium.launch();const context=await browser.newContext();
 await context.addInitScript(()=>localStorage.setItem('gnm-session','fixture-only'));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await mkdir('test-artifacts',{recursive:true});
 for(const width of [375,390,768,1280]){console.log('Checking viewport',width);
  await page.setViewportSize({width,height:850});await page.goto(origin+'/stock.html?c=999999');
  await page.locator('#sp-name').filter({hasText:'UI 테스트'}).waitFor();await page.locator('#main[aria-busy]').waitFor({state:'detached'});
  assert.equal(await page.locator('[role=tab][aria-controls]:visible').count(),7);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#t-ai').click();assert.equal(await page.locator('#tab-ai .gnm-loading').count(),0);
  await page.locator('#tab-ai .gnm-loading').waitFor({state:'detached'});
  await page.locator('#debate .db-join').waitFor();await page.locator('[data-pick-expert]').click();await page.locator('dialog[open]').waitFor();
  assert.equal(await page.locator('dialog[open]').evaluate(d=>d.getBoundingClientRect().right<=innerWidth),true);
  await page.screenshot({path:`test-artifacts/expert-${width}.png`});await page.locator('[data-close-expert]').click();
  assert.equal(await page.locator('.join [type=submit]').innerText(),'➤');assert.ok((await page.locator('.jn-input').boundingBox()).height<130);
 }
 await page.locator('[data-pick-expert]').click();await page.locator('[data-new-expert]').click();await page.locator('[name=custom-name]').fill('내 거래량 전문가');await page.locator('[name=custom-focus]').fill('거래량과 현금흐름 위험 분석');await page.locator('[data-save-expert]').click();await page.locator('dialog[open]').waitFor({state:'detached'});assert.match(await page.locator('[data-selected-expert]').innerText(),/내 거래량 전문가.*40크레딧/);await page.locator('textarea[name=q]').fill('거래량 위험은?');await page.locator('.join [type=submit]').click();await page.locator('#debate .db-guest').filter({hasText:'테스트 답변'}).waitFor();assert.equal(await page.locator('#debate .db-join').count(),1);
 await page.goto(origin+'/scenario-fixture.html');await page.locator('.cl-row').first().click();assert.equal(await page.locator('.cl-sc:not([hidden]) svg').count(),1);assert.equal(await page.locator('.cl-sc:not([hidden]) details[open]').count(),0);
 await page.locator('[data-scenario=BEAR]').click();assert.equal(await page.locator('[data-scenario-kind]:not([hidden])').getAttribute('data-scenario-kind'),'BEAR');await page.locator('[data-scenario=ALL]').click();assert.equal(await page.locator('[data-scenario-kind]:not([hidden]) svg').count(),3);await page.screenshot({path:'test-artifacts/scenario.png'});
 await page.goto(origin+'/coin.html?m=KRW-BTC#tab-chart');await page.locator('[data-coin-tf="15"]').waitFor();
 await page.locator('[data-coin-tf="15"]').click();await page.locator('.coin-tf+ .fine').filter({hasText:'최근 20개'}).waitFor();await page.waitForFunction(()=>{var r=GNMChart.chart.timeScale().getVisibleRange();return r&&r.from>=1791262800;});
 await page.locator('[data-coin-tf="D"]').click();await page.locator('#t-flows').click();await page.locator('#tab-flows .gnm-loading').waitFor({state:'detached'});assert.match(await page.locator('#tab-flows').innerText(),/OBV/);
 await page.goto(origin+'/screener.html');await page.locator('#ai-screen-q').fill('거래량이 터진 종목');await page.locator('#ai-screen-send').click();await page.locator('[data-apply-ai]').waitFor();await page.locator('[data-apply-ai]').click();await page.locator('#sc-body .orbs-load').waitFor({state:'detached'});assert.equal(await page.locator('[data-k=f]').first().inputValue(),'vol1');
 await page.locator('[data-open-chat]').first().click();await page.locator('#chat-q').fill('테스트 질문');await page.locator('#chat-send').click();await page.locator('#chat-log canvas[data-orb]').waitFor();await page.locator('#chat-log').filter({hasText:'테스트 답변'}).waitFor();
 await page.screenshot({path:'test-artifacts/chat.png'});
 assert.ok(await page.evaluate(async()=>{var start=performance.now();await GNM_loading.min(Promise.resolve('cached'));var b=GNM_loading.begin(document.getElementById('main'));await b.end();return performance.now()-start<250&&!document.querySelector('#main>.gnm-loading');}));
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{window.fixtureLoading=GNM_loading.begin(document.getElementById('main'),'모션 줄이기 검증','working');});
 await page.waitForFunction(()=>{var c=document.querySelector('#main>.gnm-loading canvas');return c&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);});
 await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>{var c=document.querySelector('#main>.gnm-loading canvas');return c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);}));
 await page.screenshot({path:'test-artifacts/reduced-motion-orb.png'});await page.evaluate(()=>fixtureLoading.end());
 assert.deepEqual(errors,[]);console.log('Browser checks passed: four widths, seven tabs, expert dialog, coin minute/day, volume flow, AI conditions, Thinking Orbs chat.');
}catch(e){console.error('Page errors:',errors);if(browser){const page=browser.contexts()[0]?.pages().at(-1);await page?.screenshot({path:'test-artifacts/failure.png'});}throw e;}finally{await browser?.close();await new Promise(r=>server.close(r));}
