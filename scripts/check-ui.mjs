// Offline browser verification: fixture API, no production account or paid model calls.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {renderSite} from '../dist/cli/daily.js';
import {loadTickers} from '../dist/config/tickers.js';
import {quickCalc} from '../dist/analysis/quickCalc.js';
import {CREDIT_COST} from '../dist/report/plans.js';
const root=process.cwd(),origin='http://localhost:8765';
process.env.GNM_API_URL=origin;
await renderSite(root,await loadTickers(root+'/tickers.json'));
const bars=Array.from({length:80},(_,i)=>({date:new Date(Date.UTC(2026,6,1+i)).toISOString().slice(0,10),open:100+i,high:105+i,low:95+i,close:102+i,volume:1000+i*10}));
for(const [dir,symbol,name,kind] of [['s','999999','UI 테스트','stock'],['c','KRW-BTC','비트코인','coin']]){
 await mkdir(root+'/site/'+dir,{recursive:true});await writeFile(root+'/site/'+dir+'/'+symbol+'.json',JSON.stringify({symbol,name,kind,market:'KOSPI',bars:bars.map(b=>[b.date,b.open,b.high,b.low,b.close,b.volume]),calc:quickCalc(symbol,bars,new Date())}));
}
await writeFile(root+'/site/screener.json',JSON.stringify({date:'2026-10-06',rows:[['999999','UI 테스트','P',100,181,2,'BULL',80,5,10,20,-5,'B',0,3,2,2,20,'A',100,-1,0,'',10,3,40,4]]}));
const api=async(path,req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(path==='/api/me')return res.end(JSON.stringify({user:{email:'fixture@example.test',rankAs:'pro',plan:'alpha',planName:'알파'},credits:{balance:400},costs:CREDIT_COST,survey:{onboarding:true,pulseDue:false}}));
 if(path==='/api/screens')return res.end(JSON.stringify({rows:[]}));
 if(path==='/api/screens/compose')return res.end(JSON.stringify({name:'거래량 증가',explanation:'테스트 조건',screen:{match:'all',rules:[{f:'vol1',op:'>=',v:3}]}}));
 if(path.startsWith('/api/candles/'))return res.end(JSON.stringify({bars:bars.slice(-20).map((b,i)=>({...b,time:1791262800+i*900}))}));
 if(path==='/api/ask/stream'){
  res.setHeader('Content-Type','text/event-stream');res.write('event: delta\ndata: '+JSON.stringify({text:'테스트 답변'})+'\n\n');return setTimeout(()=>res.end('event: done\ndata: '+JSON.stringify({answer:'테스트 답변',tier:'question',model:'claude-haiku-4-5',credits:5,balance:395})+'\n\n'),250);
 }
 if(path==='/api/reports/latest/999999')return res.end(JSON.stringify({job:null}));
 return res.end(JSON.stringify({items:[],rows:[]}));
};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,origin);if(/^\/(?:me|screens|candles|ask|reports|events|notifications|watchlist)(?:\/|$)/.test(url.pathname))return api('/api'+url.pathname,req,res);const file=resolve(root+'/site','.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+'/site/')){res.writeHead(403);return res.end();}const content=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.webp':'image/webp'})[extname(file)]||'application/octet-stream');res.end(content);}catch{res.writeHead(404);res.end();}});
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
  await page.locator('#t-ai').click();await page.locator('#tab-ai .gnm-loading').waitFor({state:'visible'});
  await page.locator('#tab-ai .gnm-loading').waitFor({state:'detached'});
  await page.locator('[data-pick-expert]').click();await page.locator('dialog[open]').waitFor();
  assert.equal(await page.locator('dialog[open]').evaluate(d=>d.getBoundingClientRect().right<=innerWidth),true);
  await page.screenshot({path:`test-artifacts/expert-${width}.png`});await page.locator('[data-close-expert]').click();
 }
 await page.goto(origin+'/coin.html?m=KRW-BTC#tab-chart');await page.locator('[data-coin-tf="15"]').waitFor();
 await page.locator('[data-coin-tf="15"]').click();await page.locator('.coin-tf+ .fine').filter({hasText:'최근 20개'}).waitFor();assert.ok(await page.evaluate(()=>GNMChart.chart.timeScale().getVisibleRange().from>=1791262800));
 await page.locator('[data-coin-tf="D"]').click();await page.locator('#t-flows').click();await page.locator('#tab-flows .gnm-loading').waitFor({state:'detached'});assert.match(await page.locator('#tab-flows').innerText(),/OBV/);
 await page.goto(origin+'/screener.html');await page.locator('#ai-screen-q').fill('거래량이 터진 종목');await page.locator('#ai-screen-send').click();await page.locator('[data-apply-ai]').waitFor();await page.locator('[data-apply-ai]').click();await page.locator('#sc-body .orbs-load').waitFor({state:'detached'});assert.equal(await page.locator('[data-k=f]').first().inputValue(),'vol1');
 await page.locator('[data-open-chat]').first().click();await page.locator('#chat-q').fill('테스트 질문');await page.locator('#chat-send').click();await page.locator('#chat-log canvas[data-orb]').waitFor();await page.locator('#chat-log').filter({hasText:'테스트 답변'}).waitFor();
 await page.screenshot({path:'test-artifacts/chat.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{window.fixtureLoading=GNM_loading.begin(document.getElementById('main'),'모션 줄이기 검증','working');});
 await page.waitForFunction(()=>{var c=document.querySelector('#main>.gnm-loading canvas');return c&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);});
 await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>{var c=document.querySelector('#main>.gnm-loading canvas');return c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);}));
 await page.screenshot({path:'test-artifacts/reduced-motion-orb.png'});await page.evaluate(()=>fixtureLoading.end());
 assert.deepEqual(errors,[]);console.log('Browser checks passed: four widths, seven tabs, expert dialog, coin minute/day, volume flow, AI conditions, Thinking Orbs chat.');
}catch(e){console.error('Page errors:',errors);if(browser){const page=browser.contexts()[0]?.pages().at(-1);await page?.screenshot({path:'test-artifacts/failure.png'});}throw e;}finally{await browser?.close();await new Promise(r=>server.close(r));}
