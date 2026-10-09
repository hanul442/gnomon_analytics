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
  for(const id of ['tab-home','tab-chart','tab-technical','tab-strategy','tab-ai','tab-flows','tab-fundamentals','tab-news','home-conclusion','chart-card','ind-sheet','structure','parliament-ai','debate','join'])assert.ok(html.includes(`id="${id}"`),id);assert.match(html,/id="scen"/);
  assert.match(html,/data-chart-indicator="fib"/);assert.match(html,/시나리오 미생성/);assert.match(html,/토론이 아직 생성되지 않았어요/);assert.match(html,/v2-mask/);assert.doesNotMatch(html,/AI 위원회가 고른 테스트 가격/);
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!match[1]!.includes('application/json'))new vm.Script(match[2]!);
 }
 const empty=renderCalculationPage({symbol:'999999',name:'가격 미수집',bars:[],now:new Date()});for(const id of ['home-conclusion','chart-card','structure','parliament-ai','debate','join'])assert.ok(empty.includes(`id="${id}"`),id);
 assert.equal(indicatorKey('RSI (14)'),'rsi');assert.equal(indicatorKey('단순 이동평균 60일'),'ma60');assert.equal(indicatorKey('단순 이동평균 240일'),null);assert.equal(indicatorKey('지수 이동평균 12일'),'ema12');
});

test('scenario charts share ranges, do not invent absent forecasts, and do not expose locked ranges',async()=>{
 const {scenarioPlot,scenarioPanel,SCENARIO_JS}=await import('./scenarioChart.js');
 const {LOCKED_TEXT}=await import('../analysis/commentary.js');
 const report=buildDailyReport({symbol:'000660',name:'테스트',date:'2026-10-06',generatedAt:new Date(),bars:Array.from({length:30},(_,i)=>({symbol:'000660',source:'test',retrievedAt:'2026-10-06T00:00:00Z',date:'2026-09-'+String(i+1).padStart(2,'0'),open:100,high:105,low:95,close:100+i,volume:1000})),disclosures:[],sources:[]});
 report.commentary={status:'OK',scenarios:[{kind:'BASE',zone:[120,140],narrative:{text:'검증 범위'}}]} as any;
 assert.match(scenarioPlot(report,'BASE'),/<svg/);assert.match(scenarioPanel(report),/120원~140원/);assert.match(scenarioPanel(report),/data-scenario="ALL"/);
 assert.match(scenarioPlot(report,'BEAR'),/열람 권한/);
 report.commentary!.scenarios![0]!.narrative.text=LOCKED_TEXT;
 assert.doesNotMatch(scenarioPanel(report),/120원~140원|검증 범위|<svg/);
 report.commentary!.scenarios![0]!.narrative.text='저항 6,690원을 넘으면 7,292원과 8,250원을 확인하고 5,875원 이탈을 점검';delete report.commentary!.scenarios![0]!.zone;
 assert.match(scenarioPlot(report,'BASE'),/<svg/);assert.match(scenarioPlot(report,'BASE'),/설명에 나온 가격 기준/);assert.match(scenarioPlot(report,'BASE'),/6,690원/);assert.match(scenarioPlot(report,'BASE'),/7,292원/);assert.doesNotMatch(scenarioPlot(report,'BASE'),/<rect/);new vm.Script(SCENARIO_JS);
});

test('scenario cards distinguish assumptions and invalidation without inferring technical triggers',async()=>{
 const {conclusionCard}=await import('./conclusion.js');
 const report=buildDailyReport({symbol:'000660',name:'테스트',date:'2026-10-06',generatedAt:new Date(),bars:Array.from({length:30},(_,i)=>({symbol:'000660',source:'test',retrievedAt:'2026-10-06T00:00:00Z',date:'2026-09-'+String(i+1).padStart(2,'0'),open:100,high:105,low:95,close:100+i,volume:1000})),disclosures:[],sources:[]});
 report.commentary={status:'OK',scenarios:[{kind:'BULL',narrative:{text:'상승 가정'},catalysts:['거래량 동반 상승'],invalidation:['지지 이탈']}]} as any;
 const html=conclusionCard(report);assert.match(html,/성립 근거·촉매/);assert.match(html,/무효화 조건 · 가정 재검토/);assert.doesNotMatch(html,/가격 기준 미지정/);assert.match(html,/가격 자료가 아직 없어요/);assert.doesNotMatch(html,/이 가격 위로|이 가격 아래로|두 가격 사이|지지·저항을 테스트 가격/);
});

test('지금 판단 shows the committee odds as one bar, and none when there are no odds (G-165)',async()=>{
 const {conclusionCard}=await import('./conclusion.js');
 const report=buildDailyReport({symbol:'000660',name:'테스트',date:'2026-10-06',generatedAt:new Date(),bars:Array.from({length:30},(_,i)=>({symbol:'000660',source:'test',retrievedAt:'2026-10-06T00:00:00Z',date:'2026-09-'+String(i+1).padStart(2,'0'),open:100,high:105,low:95,close:100+i,volume:1000})),disclosures:[],sources:[]});
 const sc=(kind:string,probability?:number)=>({kind,narrative:{text:kind},catalysts:[],invalidation:[],...(probability==null?{}:{probability})});
 report.commentary={status:'OK',scenarios:[sc('BULL',35),sc('BASE',40),sc('BEAR',25)]} as any;
 const html=conclusionCard(report);assert.match(html,/시나리오 확률/);assert.match(html,/강세 35%<\/span><span>기본 40%<\/span><span class="down">약세 25%/);assert.match(html,/sp-bull" style="flex:35"/);
 report.commentary={status:'OK',scenarios:[sc('BULL'),sc('BASE'),sc('BEAR')]} as any;
 assert.doesNotMatch(conclusionCard(report),/cl-odds|시나리오 확률/);
});
test('the AI tab opens with the short 결론 and its odds, without the scenario ladder (G-166)',async()=>{
 const {committeeTab}=await import('./renderHtml.js');
 const report=buildDailyReport({symbol:'000660',name:'테스트',date:'2026-10-06',generatedAt:new Date(),bars:Array.from({length:30},(_,i)=>({symbol:'000660',source:'test',retrievedAt:'2026-10-06T00:00:00Z',date:'2026-09-'+String(i+1).padStart(2,'0'),open:100,high:105,low:95,close:100+i,volume:1000})),disclosures:[],sources:[]});
 report.commentary={status:'OK',summary:{text:'위원회는 기본 시나리오를 더 무겁게 봐요. 다음 문장.'},scenarios:[{kind:'BULL',narrative:{text:'a'},catalysts:[],invalidation:[],probability:30},{kind:'BASE',narrative:{text:'b'},catalysts:[],invalidation:[],probability:50},{kind:'BEAR',narrative:{text:'c'},catalysts:[],invalidation:[],probability:20}]} as any;
 const html=committeeTab(report,{base:'',from:null,deepDate:'2026-10-06'});
 assert.ok(html.startsWith('<section class="block" id="conclusion"><div class="card cl-mini">'),'결론 comes first');
 assert.match(html,/위원회는 기본 시나리오를 더 무겁게 봐요\./);assert.doesNotMatch(html,/다음 문장/);assert.match(html,/기본 50%/);assert.doesNotMatch(html,/cl-row/);
});
test('sealed reports offer 심층 리포트 열기 on 요약 and put the unlock card right under 결론 (G-172)',async()=>{
 const {conclusionCard}=await import('./conclusion.js');const {committeeTab}=await import('./renderHtml.js');const {LOCKED_TEXT}=await import('../analysis/commentary.js');
 const report=buildDailyReport({symbol:'000660',name:'테스트',date:'2026-10-06',generatedAt:new Date(),bars:Array.from({length:30},(_,i)=>({symbol:'000660',source:'test',retrievedAt:'2026-10-06T00:00:00Z',date:'2026-09-'+String(i+1).padStart(2,'0'),open:100,high:105,low:95,close:100+i,volume:1000})),disclosures:[],sources:[]});
 const sc=(kind:string)=>({kind,narrative:{text:LOCKED_TEXT,evidenceIds:[]},catalysts:[],invalidation:[],probability:kind==='BASE'?40:30});
 report.commentary={status:'OK',summary:{text:'결론.'},scenarios:[sc('BULL'),sc('BASE'),sc('BEAR')]} as any;
 const home=conclusionCard(report);assert.match(home,/class="cl-deep"[^]*data-deep-go/);assert.doesNotMatch(home,/이용 권한 확인하기/);
 const ai=committeeTab(report,{base:'',from:null,deepDate:'2026-10-06'});const d=ai.indexOf('id="deep-slot"');
 assert.ok(d>ai.indexOf('cl-mini')&&d>0,'the unlock card follows 결론');const seats=ai.indexOf('parliament-ai');if(seats>=0)assert.ok(d<seats,'and comes before the seats');
});
test('an older report keeps its ranges and says how each fared since (G-173)',async()=>{
 const {scenarioCheck,checkLine,scenarioPlot}=await import('./scenarioChart.js');const {conclusionCard}=await import('./conclusion.js');
 const report=buildDailyReport({symbol:'000660',name:'테스트',date:'2026-10-06',generatedAt:new Date(),bars:Array.from({length:30},(_,i)=>({symbol:'000660',source:'test',retrievedAt:'2026-10-06T00:00:00Z',date:'2026-09-'+String(i+1).padStart(2,'0'),open:100,high:105,low:95,close:100+i,volume:1000})),disclosures:[],sources:[]});
 const sc=(kind:string,zone:[number,number],p:number)=>({kind,narrative:{text:kind+' 설명',evidenceIds:['P1']},catalysts:[kind+' 근거'],invalidation:[],probability:p,zone});
 // Written on 9/20 (KST); closes 9/21~9/30 run 120..129.
 report.commentary={status:'OK',generatedAt:'2026-09-20T09:00:00Z',summary:{text:'결론.'},scenarios:[sc('BULL',[125,140],30),sc('BASE',[110,124],50),sc('BEAR',[90,109],20)]} as any;
 const bull=scenarioCheck(report,'BULL')!,base=scenarioCheck(report,'BASE')!,bear=scenarioCheck(report,'BEAR')!;
 assert.equal(bull.sessions,10);assert.equal(bull.entered,'2026-09-26');assert.equal(bull.now,'in');
 assert.equal(base.entered,'2026-09-21');assert.equal(base.now,'above');assert.equal(bear.entered,null);
 assert.match(checkLine(bull,'강세'),/9\/26에 강세 범위에 들어왔고 지금도 안/);assert.match(checkLine(bear,'약세'),/아직 범위 밖.*10\/20거래일/);
 const card=conclusionCard(report);assert.match(card,/9\/20 리포트 이후 10거래일/);assert.match(card,/강세 시나리오<\/b> 범위 안이에요 — 위원회가 30%로 본 시나리오예요\. 위원회가 본 근거: BULL 근거/);
 // The range starts at the report day, with a marker there.
 assert.match(scenarioPlot(report,'BULL'),/리포트 09\/20/);
});
test('report failures preserve actionable categories without exposing provider details',async()=>{
 const {reportFailureMessage}=await import('../worker/reports.js');
 assert.match(reportFailureMessage('API_529:provider request details'),/AI_BUSY/);
 assert.match(reportFailureMessage('Request timed out'),/AI_TIMEOUT/);
 assert.match(reportFailureMessage('MAX_TOKENS'),/MAX_TOKENS/);
 assert.match(reportFailureMessage('UNPARSEABLE_OUTPUT'),/INVALID_OUTPUT/);
 assert.match(reportFailureMessage('API_401:sensitive server details'),/AI_CONFIGURATION/);
 assert.doesNotMatch(reportFailureMessage('API_401:sensitive server details'),/sensitive server details/);
});

test('release banner appears on the home page only',async()=>{
 const {shell}=await import('./renderHtml.js');
 assert.match(shell('','홈','',{active:'home'}),/class="version-banner"/);
 assert.doesNotMatch(renderStockPage(),/class="version-banner"/);
 assert.doesNotMatch(renderGuide(),/class="version-banner"/);
});


test('scenario entry prices stay separate from targets and base invalidation exits',async()=>{
 const {conclusionCard,scenarioCondition}=await import('./conclusion.js');
 const r=buildDailyReport({symbol:'036930',name:'주성엔지니어링',date:'2026-10-04',generatedAt:new Date(),bars:[{symbol:'036930',source:'test',retrievedAt:'2026-10-04',date:'2026-10-02',open:239500,high:240000,low:238000,close:239500,volume:1000}],disclosures:[],sources:[]});
 r.commentary={status:'OK',analysts:[{stance:'BULLISH',target:250000}],scenarios:[{kind:'BULL',zone:[248000,252000],narrative:{text:'강세 전개'},catalysts:[],invalidation:['239,500원 지지 이탈']},{kind:'BASE',narrative:{text:'박스권'},catalysts:[],invalidation:['255,750원 위로 안착하거나 222,000원 아래로 밀리는 경우']},{kind:'BEAR',narrative:{text:'약세 전개'},catalysts:[],invalidation:['283,000원 저항을 넘어서는 경우']}]} as any;
 assert.deepEqual(scenarioCondition(r,'BULL'),{price:255750,source:'base-exit'});assert.deepEqual(scenarioCondition(r,'BEAR'),{price:222000,source:'base-exit'});
 const h=conclusionCard(r);assert.match(h,/<b>255,750원<\/b>/);assert.match(h,/이 가격 아래로 이탈하면 약세 전개 검토/);assert.doesNotMatch(h,/<b>[-+]?[0-9.]+%<\/b>/);assert.match(h,/분석 기준은 2026-10-04 종가/);
 r.commentary!.scenarios![0]!.trigger=260000;assert.deepEqual(scenarioCondition(r,'BULL'),{price:260000,source:'trigger'});
 delete r.commentary!.scenarios![0]!.trigger;r.commentary!.scenarios![1]!.invalidation=[];assert.equal(scenarioCondition(r,'BULL'),undefined);assert.equal(scenarioCondition(r,'BEAR'),undefined);r.commentary!.scenarios![1]!.invalidation=['255,750원 위로 안착하지 못하는 경우'];assert.equal(scenarioCondition(r,'BULL'),undefined);r.commentary!.scenarios![1]!.invalidation=['255,750원 위로 안착하거나 260,000원 상향 돌파'];assert.equal(scenarioCondition(r,'BULL'),undefined);
});

test('the report status strip (G-178): none, stale and fresh say the state and offer one button', async () => {
 const {reportStatusBar}=await import('./appParts.js');
 const bars=Array.from({length:30},(_,i)=>({symbol:'000660',source:'test',retrievedAt:'2026-10-06T00:00:00Z',date:'2026-09-'+String(i+1).padStart(2,'0'),open:100,high:105,low:95,close:100+i,volume:1000}));
 const report=buildDailyReport({symbol:'000660',name:'테스트',date:'2026-09-30',generatedAt:new Date(),bars,disclosures:[],sources:[]});
 const none=reportStatusBar(report,null);
 assert.match(none,/AI 위원회 리포트가 아직 없어요/);assert.match(none,/data-create-report/);assert.doesNotMatch(none,/data-stale-ai/);
 report.commentary={status:'OK',generatedAt:'2026-09-20T09:00:00Z',summary:{text:'결론.'},scenarios:[{kind:'BASE',narrative:{text:'x',evidenceIds:[]},catalysts:[],invalidation:[],probability:50,zone:[110,124]}]} as any;
 const stale=reportStatusBar(report,'2026-09-20');
 assert.match(stale,/09\/20 위원회 리포트 · 10거래일 지났어요/);assert.match(stale,/data-stale-ai/);assert.match(stale,/새 리포트 만들기/);assert.match(stale,/시나리오 범위 밖|기본 시나리오 범위 안/);
 delete (report.commentary as any).scenarios;assert.match(reportStatusBar(report,'2026-09-20'),/가격 2026-09-30 기준으로 다시 분석할 수 있어요/);
 const fresh=reportStatusBar(report,'2026-09-30');
 assert.match(fresh,/09\/30 위원회 리포트 · 최신이에요/);assert.doesNotMatch(fresh,/data-stale-ai/);assert.doesNotMatch(fresh,/data-create-report/);
});

test('a report generated on request paints the same 뉴스·공시 body as a daily page (G-178)', async () => {
 const {reportFragments}=await import('../worker/reports.js');const {newsTabBody}=await import('./renderHtml.js');
 const bars=Array.from({length:30},(_,i)=>({symbol:'005930',source:'test',retrievedAt:'2026-10-06T00:00:00Z',date:'2026-09-'+String(i+1).padStart(2,'0'),open:100,high:105,low:95,close:100+i,volume:1000}));
 const report=buildDailyReport({symbol:'005930',name:'삼성전자',date:'2026-09-30',generatedAt:new Date(),bars,disclosures:[{receiptNo:'20260929000001',title:'주요사항보고서(자기주식취득결정)',filedDate:'2026-09-29',filer:'삼성전자',url:'https://dart.fss.or.kr/x',symbol:'005930',source:'dart',retrievedAt:'2026-09-29T00:00:00Z'}] as any,sources:[]});
 report.commentary={status:'OK',generatedAt:'2026-09-30T09:00:00Z',model:'test',summary:{text:'결론.'},bullish:[],bearish:[],uncertain:[],watch:[],dataGaps:[],evidence:[]} as any;
 const body=newsTabBody(report);
 assert.match(body,/data-slot="news"/);assert.match(body,/id="filings"/);assert.match(body,/href="https:\/\/dart\.fss\.or\.kr/);
 assert.equal(reportFragments(report).news,body);
});
