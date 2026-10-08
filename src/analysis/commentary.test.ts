import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import assert from 'node:assert/strict';
import test from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import type { Disclosure, NewsItem, PriceBar } from '../types.js';
import { buildDailyReport } from '../report/dailyReport.js';
import { renderReport } from '../report/renderHtml.js';
import { CommentaryWireSchema, BriefWireSchema, buildEvidence, COMMENTARY_MODEL, normalizeProbabilities, sanitizeClaims, writeCommentary } from './commentary.js';

const AT = '2026-10-05T09:30:00.000Z';
const bars: PriceBar[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
  const close = 300000 + i * 1000;
  return { symbol: '000660', date, open: close, high: close + 500, low: close - 500, close, volume: 1_000_000, source: 'naver:fchart:day', retrievedAt: AT };
});
const filing: Disclosure = { receiptNo: '20260930000001', corpName: 'SK하이닉스', stockCode: '000660', title: '주요사항보고서(자기주식취득결정)', filer: 'SK하이닉스', filedDate: '2026-09-30', remark: '유', url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260930000001', source: 'opendart:list', retrievedAt: AT };
const news: NewsItem = { url: 'https://www.yna.co.kr/1', title: 'SK하이닉스 3분기 영업이익 사상 최대', publisher: '연합뉴스', publishedAt: '2026-09-30T08:00:00.000Z', source: 'naver:news-search', retrievedAt: AT };
const report = buildDailyReport({ symbol: '000660', name: 'SK하이닉스', date: '2026-09-30', generatedAt: new Date(AT), bars, disclosures: [filing], sources: [], news: [news], newsStatus: [] });

test('evidence is numbered from the report itself', () => {
  const ids = buildEvidence(report).map((e) => e.id);
  assert.deepEqual(ids, ['P1', 'T1', 'F1', 'N1']);
  assert.equal(buildEvidence(report)[2]?.url, filing.url);
});

test('claims without a known evidence ID are dropped', () => {
  const { kept, dropped } = sanitizeClaims([
    { text: '근거 있음', evidenceIds: ['f1', 'X9'] },
    { text: '근거 없음', evidenceIds: ['X9'] },
    { text: '  ', evidenceIds: ['P1'] },
  ], new Set(['P1', 'F1']));
  assert.deepEqual(kept, [{ text: '근거 있음', evidenceIds: ['F1'] }]);
  assert.equal(dropped, 2);
});

function fakeClient(reply: unknown | Error, seen: unknown[] = []): Anthropic {
  return { beta: { messages: { parse: async (params: unknown) => { seen.push(params); if (reply instanceof Error) throw reply; return reply; } } } } as unknown as Anthropic;
}

test('a successful call keeps cited claims and records the model', async () => {
  const seen: unknown[] = [];
  const client = fakeClient({
    stop_reason: 'end_turn', model: COMMENTARY_MODEL,
    parsed_output: {
      summary: { text: '실적 기대와 자사주 매입이 겹쳤어요.', evidenceIds: ['N1', 'F1'] },
      bullish: [{ text: '사상 최대 실적 보도', evidenceIds: ['N1'] }, { text: '근거 없는 주장', evidenceIds: ['Z1'] }],
      bearish: [], uncertain: [{ text: '단기 과열 여부', evidenceIds: ['T1'] }],
      watch: [{ text: '실적 발표 확정치', evidenceIds: ['N1'] }], dataGaps: ['수급 데이터 없음'],
    },
  }, seen);
  const c = await writeCommentary(report, { client, now: () => new Date(AT) });
  assert.equal(c.status, 'OK');
  assert.equal(c.bullish.length, 1);
  assert.equal(c.dropped, 1);
  assert.equal(c.servedBy, COMMENTARY_MODEL);
  const params = seen[0] as Record<string, unknown>;
  assert.equal(params.model, 'claude-opus-5-5');
  assert.equal(params.fallbacks, 'default');
  assert.deepEqual(params.betas, ['server-side-fallback-2026-07-01']);
  assert.equal((params.output_config as { effort: string }).effort, 'medium');
  assert.match(JSON.stringify(params.messages), /N1/);
});

test('refusals, errors and a missing key never throw', async () => {
  const refused = await writeCommentary(report, { client: fakeClient({ stop_reason: 'refusal', stop_details: { category: 'cyber' }, model: COMMENTARY_MODEL, parsed_output: null }) });
  assert.deepEqual([refused.status, refused.error], ['FAILED', 'REFUSAL:cyber']);
  const broken = await writeCommentary(report, { client: fakeClient(new Error('network down')) });
  assert.deepEqual([broken.status, broken.error], ['FAILED', 'network down']);
  const skipped = await writeCommentary(report, {});
  assert.deepEqual([skipped.status, skipped.error], ['SKIPPED', 'ANTHROPIC_API_KEY_MISSING']);
});

test('the page shows claims with evidence chips, or why there is no commentary', async () => {
  const ok = { ...report, commentary: await writeCommentary(report, { client: fakeClient({ stop_reason: 'end_turn', model: COMMENTARY_MODEL, parsed_output: { summary: { text: '요약 <b>', evidenceIds: ['P1'] }, bullish: [{ text: '강세 이유', evidenceIds: ['F1'] }], bearish: [], uncertain: [], watch: [], dataGaps: [] } }) }) };
  const html = renderReport(ok, { index: '../index.html' });
  assert.ok(html.includes('요약 &lt;b&gt;'));
  assert.ok(html.includes(`href="${filing.url}"`));
  assert.ok(html.includes('강세 이유'));
  // With desk votes, the AI tab opens with a parliament of the committee.
  const voted = { ...ok, commentary: { ...ok.commentary, desks: [{ desk: 'TECHNICAL', stance: 'BULLISH', view: { text: '추세 위', evidenceIds: ['P1'] } }] } } as typeof ok;
  assert.ok(!html.includes('id="parliament-ai"') && renderReport(voted, { index: '../index.html' }).includes('data-m="TECHNICAL"'));
  const failed = { ...report, commentary: await writeCommentary(report, {}) };
  assert.match(renderReport(failed, { index: '../index.html' }), /AI 해설이 없어요: API 키가 설정되지 않았어요/);
});

test('the committee keeps desk views, the red team and three scenarios, each citing evidence', async () => {
  const client = fakeClient({
    stop_reason: 'end_turn', model: COMMENTARY_MODEL,
    parsed_output: {
      summary: { text: '요약', evidenceIds: ['P1'] },
      desks: [
        { desk: 'TECHNICAL', stance: 'BULLISH', view: { text: '이동평균 위', evidenceIds: ['T1'] } },
        { desk: 'FLOW', stance: 'INSUFFICIENT_DATA', view: { text: '근거 없음', evidenceIds: ['Q9'] } },
      ],
      redTeam: { counterargument: { text: '과열', evidenceIds: ['P1'] }, unresolved: ['수급 해석', ' '] },
      scenarios: [
        { kind: 'BULL', narrative: { text: '돌파', evidenceIds: ['T1'] }, catalysts: ['실적'], invalidation: ['170만 원 이탈'], probability: 40 },
        { kind: 'BASE', narrative: { text: '횡보', evidenceIds: ['P1'] }, catalysts: [], invalidation: [], probability: 35 },
        { kind: 'BEAR', narrative: { text: '하락', evidenceIds: ['ZZ'] }, catalysts: [], invalidation: [], probability: 25 },
      ],
      analysts: [
        { analyst: 'trend_momentum', stance: 'BULLISH', confidence: 140, target: 330000, rationale: { text: '추세 유지', evidenceIds: ['T1'] } },
        { analyst: 'fundamental', stance: 'BEARISH', confidence: 50, target: 0, rationale: { text: '가격 없음', evidenceIds: ['P1'] } },
      ],
      debate: [
        { speaker: 'trend_momentum', stance: 'BULLISH', claim: { text: '추세 위', evidenceIds: ['T1'], kind: 'INFERENCE' } },
        { speaker: 'FLOW', stance: 'BEARISH', replyTo: 0, claim: { text: '근거 없는 반박', evidenceIds: ['Q9'] } },
        { speaker: 'fundamental', stance: 'BEARISH', replyTo: 0, claim: { text: '실적 대비 비싸요', evidenceIds: ['P1'] } },
        { speaker: 'RED_TEAM', stance: 'NEUTRAL', replyTo: 1, claim: { text: '정리', evidenceIds: ['P1'] } },
      ],
      worstCase: { narrative: { text: '급락', evidenceIds: ['P1'] }, checks: ['무효화 가격 확인', ' '] },
      insights: { technical: { text: '지표가 강세 쪽', evidenceIds: ['T1'] }, flow: { text: '근거 없음', evidenceIds: ['ZZ'] } },
      bullish: [], bearish: [], uncertain: [], watch: [], dataGaps: [],
    },
  });
  const c = await writeCommentary(report, { client, now: () => new Date(AT) });
  // v4: debate turns, the worst case and tab lines keep only cited claims.
  // Debaters are the committee's own members; a reply to a dropped turn loses its pointer.
  assert.deepEqual(c.debate?.map((t) => [t.speaker, t.replyTo]), [['trend_momentum', undefined], ['fundamental', 0], ['RED_TEAM', undefined]]);
  assert.deepEqual(c.worstCase?.checks, ['무효화 가격 확인']);
  assert.deepEqual(Object.keys(c.insights ?? {}), ['technical']);
  const page = renderReport({ ...report, commentary: c }, { index: '../index.html' });
  for (const x of ['id="debate"', '추세·모멘텀 PM', 'class="db-quote"><b>추세·모멘텀 PM', '최악의 경우', 'AI 한 줄 · 기술', 'class="block cl-card', '53%', 'id="issues"']) assert.ok(page.includes(x), x);
  assert.ok(page.includes('id="debate"') && page.includes('추세·모멘텀 PM') && page.includes('class="db-quote"><b>추세·모멘텀 PM') && !page.includes('낙관론자') && page.includes('최악의 경우') && page.includes('AI 한 줄 · 기술') && page.includes('class="block cl-card') && page.includes('53%') && page.includes('id="issues"') && page.includes('id="parliament-ai"'));
  assert.deepEqual(c.desks?.map((d) => [d.desk, d.stance]), [['TECHNICAL', 'BULLISH']]);
  assert.deepEqual(c.redTeam?.unresolved, ['수급 해석']);
  assert.deepEqual(c.scenarios?.map((s) => s.kind), ['BULL', 'BASE']);
  // The uncited BEAR scenario drops out; the kept ones are rescaled to 100 (G-60).
  assert.deepEqual(c.scenarios?.map((s) => s.probability), [53, 47]);
  assert.equal(c.dropped, 4);
  assert.equal(c.promptVersion, 'gnm-committee-v7');
  // Confidence is clamped to 0–100; a non-positive target drops the analyst.
  assert.deepEqual(c.analysts?.map((a) => [a.analyst, a.confidence, a.target]), [['trend_momentum', 100, 330000]]);
});

test('a coin or an ETF gets its own rules in the message; the cached system prompt is the same for all (G-56, G-149)', async () => {
  const reply = { stop_reason: 'end_turn', model: COMMENTARY_MODEL, parsed_output: { summary: { text: '요약', evidenceIds: ['P1'] }, bullish: [], bearish: [], uncertain: [], watch: [], dataGaps: [] } };
  const seen: { system: { text: string; cache_control?: { type: string } }[]; messages: { content: string }[] }[] = [];
  const coin = buildDailyReport({ symbol: 'KRW-BTC', name: '비트코인', kind: 'coin', date: '2026-09-30', generatedAt: new Date(AT), bars: bars.map((b) => ({ ...b, symbol: 'KRW-BTC' })), disclosures: [], sources: [], news: [], newsStatus: [] });
  await writeCommentary(coin, { client: fakeClient(reply, seen as unknown[]), now: () => new Date(AT), tier: 'brief' });
  await writeCommentary({ ...report, kind: 'etf' }, { client: fakeClient(reply, seen as unknown[]), now: () => new Date(AT) });
  await writeCommentary(report, { client: fakeClient(reply, seen as unknown[]), now: () => new Date(AT) });
  await writeCommentary({ ...report, symbol: '005930', name: '삼성전자' }, { client: fakeClient(reply, seen as unknown[]), now: () => new Date(AT) });
  assert.match(seen[0]!.messages[0]!.content, /가상자산\(코인\)/);
  assert.match(seen[0]!.messages[0]!.content, /"자산_종류":"코인/);
  assert.doesNotMatch(coin.headline, /공시/);
  assert.match(seen[1]!.messages[0]!.content, /이 종목은 ETF예요/);
  assert.doesNotMatch(seen[2]!.messages[0]!.content, /ETF예요|가상자산|자산_종류/);
  // One system prompt for every stock and asset kind, marked for the provider's prompt cache.
  assert.deepEqual(seen[1]!.system, seen[3]!.system);
  assert.deepEqual(seen[2]!.system, seen[3]!.system);
  assert.equal(seen[2]!.system[0]!.cache_control?.type, 'ephemeral');
  assert.doesNotMatch(seen[2]!.system[0]!.text, /삼성전자|SK하이닉스|ETF예요|가상자산\(코인\)이에요/);
  assert.match(seen[2]!.system[0]!.text, /분량/);
});

test('scenario probabilities sum to 100 in whole percents, or are left out (G-60)', () => {
  assert.deepEqual(normalizeProbabilities([{ probability: 33.3 }, { probability: 33.3 }, { probability: 33.4 }]).map((x) => x.probability), [33, 33, 34]);
  assert.deepEqual(normalizeProbabilities([{ probability: 2 }, { probability: 1 }, { probability: 1 }]).map((x) => x.probability), [50, 25, 25]);
  assert.deepEqual(normalizeProbabilities([{ probability: 50 }, {}]), [{}, {}]);
  assert.deepEqual(normalizeProbabilities([{ probability: 0 }, { probability: 0 }]), [{}, {}]);
});

test('a brief keeps one point a side and one thing to watch (G-60)', async () => {
  const many = (t: string) => [1, 2, 3].map((i) => ({ text: `${t}${i}`, evidenceIds: ['P1'] }));
  const reply = { stop_reason: 'end_turn', model: 'claude-haiku-4-5', parsed_output: { summary: { text: '요약', evidenceIds: ['P1'] }, bullish: many('강'), bearish: many('약'), uncertain: many('불'), watch: many('봐'), dataGaps: [] } };
  const c = await writeCommentary(report, { client: fakeClient(reply), now: () => new Date(AT), tier: 'brief' });
  assert.deepEqual([c.bullish.length, c.bearish.length, c.uncertain.length, c.watch.length], [1, 1, 1, 1]);
});

test('replyIndex: points back only, shifting a 1-based pointer down one', async () => {
  const { replyIndex } = await import('./commentary.js');
  assert.equal(replyIndex(0, 1), 0);
  assert.equal(replyIndex(1, 1), 0); // counted from 1: "reply to turn 1" from turn index 1
  assert.equal(replyIndex(3, 3), 2);
  assert.equal(replyIndex(undefined, 2), undefined);
  assert.equal(replyIndex(0, 0), undefined);
  assert.equal(replyIndex(5, 2), undefined);
});

test('streamed raw JSON is schema-validated instead of requiring parsed_output',async()=>{
 const claim={text:'검증된 근거',evidenceIds:['P1'],kind:'FACT'};
 const base={summary:claim,bullish:[claim],bearish:[],uncertain:[],watch:[],dataGaps:[],insights:{}};
 const deep={...base,desks:[],redTeam:{counterargument:claim,unresolved:[]},scenarios:[{kind:'BULL',narrative:claim,catalysts:[],invalidation:[],probability:100,trigger:350000,zoneLow:360000,zoneHigh:380000}],analysts:[],debate:[],worstCase:{narrative:claim,checks:[]}};
 for(const tier of ['brief','deep'] as const){
  let calls=0;const raw=JSON.stringify(tier==='deep'?deep:base);
  const client={beta:{messages:{stream:()=>{calls++;return {finalMessage:async()=>({stop_reason:'end_turn',model:COMMENTARY_MODEL,content:[{type:'text',text:raw.slice(0,30)},{type:'text',text:raw.slice(30)}],usage:{input_tokens:120,output_tokens:240}})};},parse:()=>{throw new Error('nonstreaming must not be called');}}}} as unknown as Anthropic;
  const result=await writeCommentary(report,{client,tier});assert.equal(result.status,'OK');assert.equal(result.summary?.text,claim.text);assert.equal(calls,1);assert.deepEqual(result.usage,{inputTokens:120,outputTokens:240});
  if(tier==='deep')assert.equal(result.scenarios?.[0]?.trigger,350000);
 }
});

test('malformed, schema-invalid, refused and truncated streams retain failure costs',async()=>{
 for(const [text,stop,expected] of [['{broken','end_turn','UNPARSEABLE_OUTPUT:JSON'],['{"summary":{}}','end_turn','UNPARSEABLE_OUTPUT:SCHEMA'],['{}','max_tokens','MAX_TOKENS'],['{}','refusal','REFUSAL:unknown']]){
  const client={beta:{messages:{stream:()=>({finalMessage:async()=>({stop_reason:stop,model:COMMENTARY_MODEL,content:[{type:'text',text}],usage:{input_tokens:120,output_tokens:240}})})}}} as unknown as Anthropic;
  const result=await writeCommentary(report,{client});assert.equal(result.status,'FAILED');assert.equal(result.error,expected);assert.deepEqual(result.usage,{inputTokens:120,outputTokens:240});
 }
});


test('real SDK SSE assembly produces a usable brief without automatic parsed_output',async()=>{
 const claim={text:'스트리밍 근거',evidenceIds:['P1'],kind:'FACT'};
 const text=JSON.stringify({summary:claim,bullish:[claim],bearish:[],uncertain:[],watch:[],dataGaps:[],insights:Object.fromEntries(['technical','strategy','flow','fundamental','news'].map(k=>[k,{text:'',evidenceIds:[],kind:'INFERENCE'}]))});
 const events=[{type:'message_start',message:{id:'msg_fixture',type:'message',role:'assistant',model:COMMENTARY_MODEL,content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:120,output_tokens:0}}},{type:'content_block_start',index:0,content_block:{type:'text',text:''}},{type:'content_block_delta',index:0,delta:{type:'text_delta',text:text.slice(0,20)}},{type:'content_block_delta',index:0,delta:{type:'text_delta',text:text.slice(20)}},{type:'content_block_stop',index:0},{type:'message_delta',delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:240}},{type:'message_stop'}];
 let calls=0;const client=new Anthropic({apiKey:'fixture-not-a-real-key',maxRetries:0,fetch:async()=>{calls++;return new Response(events.map(e=>'event: '+e.type+'\ndata: '+JSON.stringify(e)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});}});
 const c=await writeCommentary(report,{client,tier:'brief'});assert.equal(c.status,'OK',c.error);assert.equal(c.summary?.text,'스트리밍 근거');assert.equal(calls,1);assert.equal(c.usage?.outputTokens,240);
});


test('report wire schemas contain no optional properties; unsupported tabs use empty cited claims',()=>{
 for(const schema of [CommentaryWireSchema,BriefWireSchema]) {
  const format=betaZodOutputFormat(schema);
  const visit=(node:any):void=>{if(!node||typeof node!=='object')return;if(node.properties)assert.deepEqual(new Set(node.required),new Set(Object.keys(node.properties)));for(const value of Object.values(node))if(value&&typeof value==='object')visit(value);};
  visit(format.schema);
 }
 const blank={text:'',evidenceIds:[],kind:'INFERENCE'};
 assert.ok(BriefWireSchema.shape.insights.safeParse(Object.fromEntries(['technical','strategy','flow','fundamental','news'].map(k=>[k,blank]))).success);
 assert.equal(BriefWireSchema.shape.insights.safeParse({}).success,false);
});

test('deep reports ask for JSON in words (no grammar) and repair small slips before the strict check',async()=>{
 const seen:any[]=[];
 const claim=(t:string,kind='FACT')=>({text:t,evidenceIds:['P1'],kind});
 const reply={summary:claim('요약'),desks:[{desk:'TECHNICAL',stance:'bullish',view:claim('기술','OPINION')},{desk:'NOPE',stance:'BULLISH',view:claim('x')}],redTeam:{counterargument:claim('반론'),unresolved:[]},
  scenarios:[{kind:'BULL',narrative:claim('상승'),catalysts:['a'],invalidation:['b'],probability:'40',trigger:'1,900,000',zoneLow:1850000,zoneHigh:'2,000,000원'},{kind:'BASE',narrative:claim('기본'),catalysts:[],invalidation:[],probability:40,trigger:0,zoneLow:1800000,zoneHigh:1900000},{kind:'BEAR',narrative:claim('하락'),catalysts:[],invalidation:[],probability:20,trigger:1700000,zoneLow:1600000,zoneHigh:1700000}],
  analysts:[],debate:[{speaker:'TECHNICAL',stance:'BULLISH',replyTo:-1,claim:claim('발언')}],worstCase:{narrative:claim('최악'),checks:['c']},insights:{technical:claim('한 줄')},bullish:[claim('강세')],dataGaps:[]};
 const client={beta:{messages:{stream:(p:any)=>{seen.push(p);return {finalMessage:async()=>({stop_reason:'end_turn',model:COMMENTARY_MODEL,content:[{type:'text',text:'다음은 결과예요.\n```json\n'+JSON.stringify(reply)+'\n```'}],usage:{input_tokens:1,output_tokens:2}})};}}}} as unknown as Anthropic;
 const c=await writeCommentary(report,{client});
 assert.equal(c.status,'OK',c.error);
 assert.equal(seen[0].output_config.format,undefined,'no constrained grammar for the deep schema');
 assert.match(seen[0].system[0].text,/JSON 스키마/);
 assert.deepEqual(c.desks?.map(d=>[d.desk,d.stance,d.view.kind]),[['TECHNICAL','BULLISH','INFERENCE']]);
 assert.equal(c.scenarios?.find(x=>x.kind==='BULL')?.trigger,1900000);
 assert.deepEqual(c.scenarios?.find(x=>x.kind==='BULL')?.zone,[1850000,2000000]);
});

test('cached prompt tokens bill at a tenth to read and 1.25× to write (G-149)', async () => {
  const { usd } = await import('../cli/aiBudget.js');
  const { usdOf } = await import('../worker/ask.js');
  // Opus: $4 in, $20 out per million.
  assert.equal(usd('claude-opus-5-5', 1_000_000, 0), 4);
  assert.equal(Math.round(usd('claude-opus-5-5', 0, 0, 1_000_000, 0) * 100) / 100, 0.4);
  assert.equal(usd('claude-opus-5-5', 0, 0, 0, 1_000_000), 5);
  assert.equal(Math.round(usdOf('claude-opus-5-5', 0, 1_000_000, 1_000_000, 0) * 100) / 100, 20.4);
});
