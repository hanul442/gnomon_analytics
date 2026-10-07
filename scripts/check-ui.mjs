import {shell} from '../dist/report/renderHtml.js';
import {DEBATE_PLAY_SCRIPT,DEBATE_FILTER_SCRIPT} from '../dist/report/renderReportExtras.js';
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
import {renderCalculationPage} from '../dist/report/calculationPage.js';
import {CREDIT_COST} from '../dist/report/plans.js';
const root=process.cwd(),origin='http://localhost:8765';
process.env.GNM_API_URL=origin;
await renderSite(root,await loadTickers(root+'/tickers.json'));
const bars=Array.from({length:80},(_,i)=>({date:new Date(Date.UTC(2026,6,1+i)).toISOString().slice(0,10),open:150+Math.sin(i*.35)*12+i*.2,high:155+Math.sin(i*.35)*12+i*.2,low:145+Math.sin(i*.35)*12+i*.2,close:152+Math.sin(i*.35)*12+i*.2,volume:1000+i*10}));
for(const [dir,symbol,name,kind] of [['s','999999','UI 테스트','stock'],['c','KRW-BTC','비트코인','coin']]){
 await mkdir(root+'/site/'+dir,{recursive:true});await writeFile(root+'/site/'+dir+'/'+symbol+'.json',JSON.stringify({pageUrl:dir+'/'+symbol+'.html',symbol,name,kind,market:'KOSPI',bars:bars.map(b=>[b.date,b.open,b.high,b.low,b.close,b.volume]),calc:quickCalc(symbol,bars,new Date())}));
 await writeFile(root+'/site/'+dir+'/'+symbol+'.html',renderCalculationPage({symbol,name,...(kind==='coin'?{kind:'coin'}:{}),bars:bars.map(b=>({...b,symbol,source:'fixture',retrievedAt:new Date().toISOString()})),now:new Date()}));
}
await writeFile(root+'/site/screener.json',JSON.stringify({date:'2026-10-06',rows:[['999999','UI 테스트','P',100,181,2,'BULLISH',80,5,10,20,-5,'B',0,3,2,2,20,'A',100,-1,0,'',10,3,40,4]]}));
const scenarioReport=buildDailyReport({symbol:'999999',name:'시나리오 테스트',date:'2026-10-06',generatedAt:new Date(),bars:bars.map(b=>({...b,symbol:'999999',source:'fixture',retrievedAt:'2026-10-06T00:00:00Z'})),disclosures:[],sources:[]});
scenarioReport.commentary={status:'OK',scenarios:[['BULL',[190,220],195],['BASE',[170,190]],['BEAR',[130,160],160]].map(([kind,zone,trigger])=>({kind,zone,trigger,narrative:{text:'펼쳐 보는 상세 근거'},catalysts:['검증 조건'],invalidation:['무효화 조건']}))};
await writeFile(root+'/site/scenario-fixture.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font-family:sans-serif;margin:20px;color:#14233a}button{font:inherit}.card{border:1px solid #ddd;border-radius:14px;padding:12px}figure svg{max-width:100%}'+SCENARIO_CSS+CONCLUSION_CSS+'</style>'+conclusionCard(scenarioReport)+scenarioPanel(scenarioReport)+'<script>'+SCENARIO_JS+CONCLUSION_JS+'</script>');
const legacyReport=structuredClone(scenarioReport);delete legacyReport.commentary.scenarios[1].zone;legacyReport.commentary.scenarios[1].narrative.text='175원, 176원, 177원, 178원, 179원, 180원을 가격 기준으로 확인합니다.';await writeFile(root+'/site/legacy-scenario-fixture.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font-family:sans-serif;margin:12px;color:#14233a}'+SCENARIO_CSS+'</style>'+scenarioPanel(legacyReport)+'<script>'+SCENARIO_JS+'</script>');
await writeFile(root+'/site/debate-fixture.html',shell('','토론 재생 테스트','<section id="debate"><div class="block-head"><h2>위원회 토론</h2><button type="button" class="db-skip" hidden>전체 바로 보기</button></div><div class="card debate">'+['시장 데스크','기술 데스크','레드팀'].map(who=>'<div class="db-turn"><div class="db-who"><b>'+who+'</b></div><div class="db-bubble">검증 발언</div></div>').join('')+'</div></section>',{scripts:DEBATE_FILTER_SCRIPT+DEBATE_PLAY_SCRIPT}));
let customExperts=[],savedScreens=[];const sync={on:false,pushed:[]};const priceAlerts=[];
const api=async(path,req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(path==='/api/admin/overview')return res.end(JSON.stringify({users:[],creditRequests:[],actions:[{id:'fixture-action',created_at:'2026-10-06T08:00:00Z',email:'long-mobile-test@example.test',kind:'report',symbol:'005500',detail:'모바일에서 확인할 리포트 요청 내용',credits:100,status:'pending'}],invites:[],pulses:[],feedback:[],questions:[],events:[],spend:{today:0,month:0,dailyCap:5}}));
 if(path==='/api/me')return res.end(JSON.stringify({user:{email:'fixture@example.test',rankAs:'pro',plan:'alpha',planName:'알파'},credits:{balance:400},costs:CREDIT_COST,survey:{onboarding:true,pulseDue:false}}));
 if(path==='/api/experts'){if(req.method==='POST'){let body='';for await(const x of req)body+=x;const expert={...JSON.parse(body),id:'00000000-0000-4000-8000-000000000001'};customExperts.push(expert);return res.end(JSON.stringify({expert}));}return res.end(JSON.stringify({items:customExperts}));}
 if(path==='/api/screens'){if(req.method==='POST'){let b='';for await(const x of req)b+=x;const body=JSON.parse(b);if(body.name==='실패테스트')return res.end(JSON.stringify({error:'TEST_FAILED',message:'저장에 실패했어요.'}));savedScreens.push({...body,id:savedScreens.length+1});return res.end(JSON.stringify({id:savedScreens.length}));}return res.end(JSON.stringify({screens:savedScreens}));}
 if(path==='/api/me/settings'){if(req.method==='POST'){let b='';for await(const x of req)b+=x;sync.pushed.push(JSON.parse(b).data);return res.end(JSON.stringify({ok:true,updatedAt:new Date().toISOString()}));}return res.end(JSON.stringify(sync.on?{data:{'gnm-persona':'trader'},updatedAt:'2026-10-06T00:00:00.000Z'}:{data:{},updatedAt:null}));}
 if(path==='/api/watch'){if(req.method==='POST')return res.end(JSON.stringify({ok:true}));return res.end(JSON.stringify(sync.on?{symbols:['999999'],updatedAt:'2026-10-06T00:00:00.000Z'}:{symbols:[],updatedAt:null}));}
 if(path==='/api/reports/mine')return res.end(JSON.stringify({jobs:[{id:'00000000-0000-4000-8000-0000000000aa',symbol:'999999',kind:'report',status:'done',stage:'done',error:null,created_at:'2026-10-06T05:00:00Z',name:'UI 테스트',data_date:'2026-10-06'},{id:'00000000-0000-4000-8000-0000000000bb',symbol:'KRW-BTC',kind:'brief',status:'failed',stage:'failed',error:'크레딧은 반환했어요.',created_at:'2026-10-05T05:00:00Z',name:null,data_date:null}],requests:[]}));
 if(path==='/api/notify/prefs')return res.end(JSON.stringify({prefs:{daily:true,watchReport:true,screen:false,price:true,request:true,push:true},devices:0,screens:[{id:1,name:'거래량 증가',alert:1}]}));
 if(path==='/api/alerts/price'){if(req.method==='POST'){let b='';for await(const x of req)b+=x;priceAlerts.push(JSON.parse(b));return res.end(JSON.stringify({id:priceAlerts.length}));}return res.end(JSON.stringify({items:priceAlerts.map((a,i)=>({id:i+1,...a,created_at:'2026-10-06T00:00:00Z',fired_at:null}))}));}
 if(path==='/api/screens/compose')return res.end(JSON.stringify({name:'거래량 증가',explanation:'테스트 조건',screen:{match:'all',rules:[{f:'vol1',op:'>=',v:3}]}}));
 if(path.startsWith('/api/candles/'))return res.end(JSON.stringify({bars:bars.slice(-20).map((b,i)=>({...b,time:1791262800+i*900}))}));
 if(path==='/api/ask/stream'){
  res.setHeader('Content-Type','text/event-stream');setTimeout(()=>res.write('event: delta\ndata: '+JSON.stringify({text:'테스트 답변'})+'\n\n'),1000);return setTimeout(()=>res.end('event: done\ndata: '+JSON.stringify({answer:'테스트 답변',tier:'question',model:'claude-haiku-4-5',credits:5,balance:395})+'\n\n'),2200);
 }
 if(path==='/api/reports/latest/999999')return res.end(JSON.stringify({job:{id:'fixture-done',status:'done'}}));
 if(path==='/api/reports/fixture-done')return res.end(JSON.stringify({status:'done',symbol:'999999',fragments:{scenarios:scenarioPanel(scenarioReport),ai:'<section id="debate"><div class="card debate"><div class="db-chips"></div><div class="db-turn" data-speaker="MARKET"><div class="db-who"><b>시장 데스크</b></div><div class="db-bubble">테스트 토론</div></div><details class="db-ev"><summary>근거</summary></details></div></section>'}}));
 return res.end(JSON.stringify({items:[],rows:[]}));
};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,origin);if(/^\/(?:me|screens|candles|ask|reports|events|notifications|watchlist|watch|experts|admin|alerts|notify|push)(?:\/|$)/.test(url.pathname))return api('/api'+url.pathname,req,res);const file=resolve(root+'/site','.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+'/site/')){res.writeHead(403);return res.end();}const content=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.webp':'image/webp','.jpg':'image/jpeg'})[extname(file)]||'application/octet-stream');res.end(content);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(8765,'localhost',r));
let browser;const errors=[];
try{
 browser=await chromium.launch();const context=await browser.newContext();
 await context.addInitScript(()=>localStorage.setItem('gnm-session','fixture-only'));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await mkdir('test-artifacts',{recursive:true});
 for(const width of [375,390,768,1280]){console.log('Checking viewport',width);
  await page.setViewportSize({width,height:850});await page.goto(origin+'/stock.html?c=999999');
  await page.locator('h1').filter({hasText:'UI 테스트'}).waitFor();await page.locator('#main[aria-busy]').waitFor({state:'detached'});await page.waitForFunction(()=>document.documentElement.dataset.reportJob==='done');assert.equal(await page.locator('#tab-ai [data-generated=ai]').count(),1);assert.doesNotMatch(await page.locator('#tab-ai').innerText(),/아직 위원회 리포트가 없어요/);
  assert.equal(await page.locator('[role=tab][aria-controls]:visible').count(),8);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const beforeIndicators=await page.locator('#ind-sheet [aria-pressed=true][data-ov],#ind-sheet [aria-pressed=true][data-pane]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-ov')||n.getAttribute('data-pane')));const beforeSaved=await page.evaluate(()=>localStorage.getItem('gnm-ind'));await page.locator('#t-technical').click();assert.equal(await page.locator('[aria-label="기술 지표 차트 바로 보기"]').count(),0);await page.locator('[data-chart-indicator=fib]').first().click();assert.equal(await page.locator('[data-ov=fib]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#t-chart').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#ind-sheet [aria-pressed=true][data-ov],#ind-sheet [aria-pressed=true][data-pane]').count(),1);assert.ok(await page.locator('#overlays').evaluate(el=>JSON.parse(el.textContent).fib.length>0));if(width===375)await page.screenshot({path:'test-artifacts/indicator-chart.png'});await page.locator('#chart-context button').click();assert.equal(await page.locator('#t-technical').getAttribute('aria-selected'),'true');assert.deepEqual(await page.locator('#ind-sheet [aria-pressed=true][data-ov],#ind-sheet [aria-pressed=true][data-pane]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-ov')||n.getAttribute('data-pane'))),beforeIndicators);assert.equal(await page.evaluate(()=>localStorage.getItem('gnm-ind')),beforeSaved);
  await page.locator('#t-ai').click();assert.equal(await page.locator('#tab-ai .gnm-loading').count(),0);
  await page.locator('#tab-ai .gnm-loading').waitFor({state:'detached'});
  await page.locator('#debate .db-join').waitFor();await page.locator('[data-pick-expert]').click();await page.locator('dialog[open]').waitFor();
  assert.equal(await page.locator('dialog[open]').evaluate(d=>d.getBoundingClientRect().right<=innerWidth),true);
  await page.screenshot({path:`test-artifacts/expert-${width}.png`});await page.locator('[data-close-expert]').click();
  assert.equal(await page.locator('.join [type=submit]').innerText(),'➤');assert.ok((await page.locator('.jn-input').boundingBox()).height<130);
 }
 await page.locator('[data-pick-expert]').click();await page.locator('[data-new-expert]').click();await page.locator('[name=custom-name]').fill('내 거래량 전문가');await page.locator('[name=custom-focus]').fill('거래량과 현금흐름 위험 분석');await page.locator('[data-save-expert]').click();await page.locator('dialog[open]').waitFor({state:'detached'});assert.match(await page.locator('[data-selected-expert]').innerText(),/내 거래량 전문가.*40크레딧/);await page.locator('textarea[name=q]').fill('거래량 위험은?');await page.locator('.join [type=submit]').click();await page.locator('#debate .db-wait .stream-answer').filter({hasText:'테스트 답변'}).waitFor();assert.ok(await page.locator('#debate .db-wait canvas[data-orb]').isVisible());{const w=await page.locator('#debate .db-wait .db-bubble').boundingBox();assert.ok(w.width>=200,'pending bubble keeps a readable width');}await page.locator('#debate .db-wait').waitFor({state:'detached'});await page.locator('#debate .db-answer').filter({hasText:'테스트 답변'}).waitFor();await page.reload();await page.locator('#debate .db-answer').filter({hasText:'테스트 답변'}).waitFor();assert.ok(await page.locator('.db-past').isVisible(),'earlier questions come back after reload');assert.equal(await page.locator('#debate .db-join').count(),1);
 await page.goto(origin+'/debate-fixture.html');await page.locator('.db-think').waitFor();await page.locator('.db-think .db-bubble canvas').waitFor({state:'visible'});assert.ok(await page.locator('.db-think .db-bubble canvas').isVisible());assert.ok(await page.locator('#debate .db-turn[hidden]').count()>0);await page.locator('.db-skip').click();assert.equal(await page.locator('#debate .db-turn:not([hidden])').count(),3);assert.equal(await page.locator('.db-think').count(),0);
 await page.goto(origin+'/scenario-fixture.html');assert.equal(await page.locator('.cl-up .cl-px b').innerText(),'195원');assert.equal(await page.locator('.cl-down .cl-px b').innerText(),'160원');await page.locator('.cl-row').first().click();assert.equal(await page.locator('.cl-sc:not([hidden]) svg').count(),1);assert.equal(await page.locator('.cl-sc:not([hidden]) details').count(),0);assert.ok(await page.locator('.cl-sc:not([hidden]) .scenario-evidence').isVisible());
 await page.locator('[data-scenario=BEAR]').click();assert.equal(await page.locator('[data-scenario-kind]:not([hidden])').getAttribute('data-scenario-kind'),'BEAR');await page.locator('[data-scenario=ALL]').click();assert.equal(await page.locator('[data-scenario-kind]:not([hidden]) svg').count(),3);await page.screenshot({path:'test-artifacts/scenario.png'});
 for(const width of [375,390,768,1280]){
  await page.setViewportSize({width,height:850});await page.goto(origin+'/legacy-scenario-fixture.html');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const labels=await page.locator('[data-scenario-kind=BASE] .scenario-price-label').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,right:r.right};}));
  assert.equal(labels.length,6);for(let i=1;i<labels.length;i++)assert.ok(labels[i].top>=labels[i-1].bottom,'price labels overlap');assert.ok(labels.every(r=>r.right<=width),'price labels overflow');
  await page.screenshot({path:`test-artifacts/scenario-labels-${width}.png`});
 }
 await page.goto(origin+'/coin.html?m=KRW-BTC#tab-chart');await page.locator('[data-coin-tf="15"]').waitFor();
 await page.locator('[data-coin-tf="15"]').click();await page.locator('.coin-tf+ .fine').filter({hasText:'최근 20개'}).waitFor();await page.waitForFunction(()=>{var r=GNMChart.chart.timeScale().getVisibleRange();return r&&r.from>=1791262800;});
 await page.locator('[data-coin-tf="D"]').click();await page.locator('#t-flows').click();await page.locator('#tab-flows .gnm-loading').waitFor({state:'detached'});assert.match(await page.locator('#tab-flows').innerText(),/OBV/);
 for(const width of [375,390,768,1280]){
  await page.setViewportSize({width,height:850});await page.goto(origin+'/admin.html');await page.locator('#adm .kpis').waitFor();await page.locator('[data-tab=action]').click();await page.locator('[data-act=fixture-action]').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  for(const selector of ['td[data-label="사용자"]','td[data-label="내용"]','[data-act=fixture-action] button[data-s=done]','[data-act=fixture-action] button[data-s=rejected]']){const box=await page.locator(selector).boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width,'admin field clipped: '+selector);}
  await page.screenshot({path:`test-artifacts/admin-${width}.png`});
 }
 await page.goto(origin+'/screener.html');await page.locator('#ai-screen-q').fill('거래량이 터진 종목');await page.locator('#ai-screen-send').click();await page.locator('[data-apply-ai]').waitFor();await page.locator('[data-apply-ai]').click();await page.locator('#sc-body .orbs-load').waitFor({state:'detached'});assert.equal(await page.locator('[data-k=f]').first().inputValue(),'vol1');await page.locator('.toast[data-kind=success]').filter({hasText:'AI 조건을 적용했어요.'}).waitFor();
 page.once('dialog',d=>d.accept('내 조건'));await page.locator('#save-screen').click();await page.locator('.toast[data-kind=success]').filter({hasText:'조건을 저장했어요.'}).waitFor();await page.locator('#saved-list .ld').waitFor();
 page.once('dialog',d=>d.accept('실패테스트'));await page.locator('#save-screen').click();await page.locator('.toast[data-kind=error]').filter({hasText:'저장에 실패했어요.'}).waitFor();assert.equal(await page.locator('.toast[data-kind=success]').count(),0);assert.equal(await page.locator('#save-screen').isEnabled(),true);
 for(const width of [375,390,768,1280]){await page.setViewportSize({width,height:850});await page.locator('#saved-list .ld').click();const t=await page.locator('.toast').boundingBox();assert.ok(t&&t.x>=0&&t.x+t.width<=width,'toast stays in viewport');await page.screenshot({path:'test-artifacts/completion-'+width+'.png'});}await page.locator('.toast button').click();assert.equal(await page.locator('.toast').count(),0);
 await page.locator('[data-open-chat]').first().click();assert.equal(await page.locator('#chat-send').innerText(),'➤');await page.locator('#chat-q').fill('테스트 질문');await page.locator('#chat-send').click();await page.locator('#chat-log canvas[data-orb]').waitFor();await page.locator('#chat-log .stream-answer').filter({hasText:'테스트 답변'}).waitFor();assert.ok(await page.locator('#chat-log .msg.wait canvas[data-orb]').isVisible());await page.locator('#chat-log .msg.wait').waitFor({state:'detached'});
 await page.screenshot({path:'test-artifacts/chat.png'});
 assert.ok(await page.evaluate(async()=>{var start=performance.now();await GNM_loading.min(Promise.resolve('cached'));var b=GNM_loading.begin(document.getElementById('main'));await b.end();return performance.now()-start<250&&!document.querySelector('#main>.gnm-loading');}));
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{window.fixtureLoading=GNM_loading.begin(document.getElementById('main'),'모션 줄이기 검증','working');});
 await page.waitForFunction(()=>{var c=document.querySelector('#main>.gnm-loading canvas');return c&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);});
 await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>{var c=document.querySelector('#main>.gnm-loading canvas');return c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);}));
 await page.screenshot({path:'test-artifacts/reduced-motion-orb.png'});await page.evaluate(()=>fixtureLoading.end());
 for(const width of [375,390,768,1280]){
  await page.setViewportSize({width,height:850});await page.goto(origin+'/index.html');
  const ad=page.locator('.bn-hanul');const slide=await ad.getAttribute('data-i');await page.locator('[data-go="'+slide+'"]').click();
  assert.ok(await ad.isVisible());assert.ok(await ad.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(width===375)await page.screenshot({path:'test-artifacts/hanul-banner-mobile.png'});
  await ad.click();await page.waitForURL('**/hanul.html');await page.locator('#hanul-title').waitFor();
  assert.equal(await page.locator('.hanul-project').count(),4);assert.ok(await page.locator('.hanul-intro img').evaluate(img=>img.complete&&img.naturalWidth>0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'test-artifacts/hanul-'+width+'.png',fullPage:true});
  await page.getByRole('link',{name:'그노몬으로 돌아가기',exact:true}).click();await page.waitForURL('**/index.html');
 }
 // G-97: the 🔔 가격 알림 dialog on a stock page and the settings page.
 await page.setViewportSize({width:390,height:850});await page.goto(origin+'/stock.html?c=999999');await page.locator('#main[aria-busy]').waitFor({state:'detached'});
 await page.locator('.pa-btn').click();await page.locator('.pa-dialog[open]').waitFor();assert.ok(await page.locator('.pa-picks button').count()>=2);
 assert.equal(await page.locator('.pa-dialog').evaluate(d=>d.getBoundingClientRect().right<=innerWidth),true);await page.screenshot({path:'test-artifacts/price-alert.png'});
 await page.locator('.pa-picks button').first().click();await page.locator('.pa-msg').filter({hasText:'알려 드려요'}).waitFor();assert.equal(priceAlerts[0].symbol,'999999');
 await page.goto(origin+'/alerts.html');await page.locator('#al-body').waitFor();await page.locator('#al-prices .al-item').first().waitFor();
 assert.equal(await page.locator('[data-pref=screen]').isChecked(),false);assert.equal(await page.locator('[data-screen="1"]').isChecked(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'test-artifacts/alerts.png',fullPage:true});
 // G-108: my reports — mine only, filterable by state.
 await page.goto(origin+'/myreports.html');await page.locator('#mr-list .mr-item').first().waitFor();assert.equal(await page.locator('#mr-list .mr-item').count(),2);
 await page.locator('.mr-tabs [data-f=failed]').click();assert.equal(await page.locator('#mr-list .mr-item').count(),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('.mr-tabs [data-f=""]').click();await page.screenshot({path:'test-artifacts/myreports.png',fullPage:true});
 // Waiting indicators must render pixels on mobile, not merely leave an empty canvas in the DOM.
 for (const width of [375,390]) {
  await page.setViewportSize({width,height:850});await page.goto(origin+'/screener.html');
  await page.locator('[data-open-chat]').first().click();await page.locator('#chat-q').fill('모바일 로딩 검증');await page.locator('#chat-send').click();
  await page.waitForFunction(()=>{const c=document.querySelector('#chat-log .msg.wait canvas');return c&&getComputedStyle(c).visibility==='visible'&&c.getBoundingClientRect().width>=36&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);});
  await page.screenshot({path:'test-artifacts/mobile-chat-orbs-'+width+'.png'});await page.locator('#chat-log .msg.wait').waitFor({state:'detached'});
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(origin+'/debate-fixture.html');
  await page.waitForFunction(()=>{const c=document.querySelector('.db-typing canvas');return c&&getComputedStyle(c).visibility==='visible'&&c.getBoundingClientRect().width>=36&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);});
  await page.screenshot({path:'test-artifacts/mobile-debate-orbs-'+width+'.png'});await page.locator('.db-skip').click();
 }
 // Forced tours traverse hidden report panels and restore the original tab on exit.
 for (const width of [375,1280]) {
  await page.setViewportSize({width,height:850});await page.goto(origin+'/s/999999.html?tour=1');await page.locator('.tr-tip').waitFor();
  for (const key of ['chart','technical','strategy','ai','news']) {
   for (let step=0;await page.locator('#t-'+key).getAttribute('aria-selected') !== 'true' && step<8;step++) await page.locator('.tr-tip [data-t=n]').click();
   assert.equal(await page.locator('#tab-'+key).isVisible(),true);
   assert.equal(await page.locator('.tr-tip').evaluate(el=>el.getBoundingClientRect().right<=innerWidth),true);
  }
  await page.keyboard.press('Escape');assert.equal(await page.locator('.tr-tip').count(),0);assert.equal(await page.locator('#t-home').getAttribute('aria-selected'),'true');
  await page.goto(origin+'/screener.html?tour=1');await page.locator('.tr-tip').waitFor();await page.locator('.tr-tip [data-t=n]').click();await page.locator('.tr-tip [data-t=n]').click();assert.ok((await page.locator('.tr-tip').innerText()).includes('AI 조건'));await page.keyboard.press('Escape');
 }
 // G-109: a fresh browser takes the account's settings and watchlist, reloads once, and sends later changes.
 sync.on=true;{const fresh=await browser.newContext();await fresh.addInitScript(()=>localStorage.setItem('gnm-session','fixture-only'));const p2=await fresh.newPage();p2.on('pageerror',e=>errors.push(e.message));let loads=0;p2.on('load',()=>loads++);
  await p2.goto(origin+'/index.html');await p2.waitForFunction(()=>localStorage.getItem('gnm-persona')==='trader'&&(localStorage.getItem('gnm-watch')||'').includes('999999'));await p2.waitForTimeout(1500);
  assert.ok(loads>=1&&loads<=2,'reloads at most once, got '+loads);
  await p2.evaluate(()=>localStorage.setItem('gnm-ind','["rsi"]'));await p2.waitForFunction(()=>true);for(let i=0;i<20&&!sync.pushed.some(d=>d['gnm-ind']);i++)await p2.waitForTimeout(250);
  assert.ok(sync.pushed.some(d=>d['gnm-ind']==='["rsi"]'&&d['gnm-persona']==='trader'),'a change is sent with the rest');await fresh.close();}
 assert.deepEqual(errors,[]);console.log('Browser checks passed: four widths, seven tabs, expert dialog, coin minute/day, volume flow, AI conditions, Thinking Orbs chat, price alerts.');
}catch(e){console.error('Page errors:',errors);if(browser){const page=browser.contexts()[0]?.pages().at(-1);await page?.screenshot({path:'test-artifacts/failure.png'});}throw e;}finally{await browser?.close();await new Promise(r=>server.close(r));}
