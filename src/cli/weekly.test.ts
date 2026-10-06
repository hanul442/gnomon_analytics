import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runDaily, setDeepKey } from './daily.js';
import { unseal } from '../report/seal.js';
import { loadTickers } from '../config/tickers.js';
import { DEFAULT_SELECTION } from '../analysis/selection.js';

const FIX = join(process.cwd(), 'test', 'fixtures', 'naver');
const M_STOCK: [string, string][] = [['/trend', 'trend.json'], ['/integration', 'integration.json'], ['/finance/quarter', 'finance-quarter.json'], ['/finance/annual', 'finance-annual.json']];
const day = (i: number) => new Date(Date.UTC(2026, 6, 18) + i * 86_400_000).toISOString().slice(0, 10).replaceAll('-', '');
// 80 sessions; 222220 jumps in the last five on heavy volume.
const feed = (symbol: string) => `<chartdata symbol="${symbol}">${Array.from({ length: 80 }, (_, i) => {
  const c = symbol === '222220' && i >= 75 ? 10000 + (i - 74) * 500 : 10000;
  const v = symbol === '222220' && i >= 75 ? 300000 : 100000;
  return `<item data="${day(i)}|${c}|${c}|${c}|${c}|${v}" />`;
}).join('')}</chartdata>`;
const listed = (code: string, name: string, cap = '100,000') => ({ itemCode: code, stockName: name, stockEndType: 'stock', closePrice: '10,000', fluctuationsRatio: '1.0', accumulatedTradingValue: '100,000', marketValue: cap });
const fake = (async (url: string | URL | Request) => {
  const u = String(url);
  if (u.includes('/stocks/marketValue/KOSPI')) return new Response(JSON.stringify({ stocks: [listed('000660', 'SK하이닉스'), listed('111110', '조용한전자', '300,000'), listed('222220', '뛰는바이오')], totalCount: 3 }));
  if (u.includes('/stocks/marketValue/KOSDAQ')) return new Response(JSON.stringify({ stocks: [], totalCount: 0 }));
  const m = M_STOCK.find(([path]) => u.includes('m.stock.naver.com') && u.includes(path));
  if (m) return new Response(await readFile(join(FIX, m[1]), 'utf8'));
  if (u.includes('fchart.stock.naver')) return new Response(feed(/symbol=([^&]+)/.exec(u)?.[1] ?? 'X'));
  if (u.includes('corpCode.xml')) return new Response('', { status: 500 });
  if (u.includes('list.json') && u.includes('corp_cls=Y')) return new Response(JSON.stringify({ status: '000', total_page: 1, list: [{ corp_name: '조용한전자', stock_code: '111110', report_nm: '연결재무제표기준영업(잠정)실적(공정공시)', rcept_no: '20261002000999', flr_nm: '조용한전자', rcept_dt: '20261002' }] }));
  if (u.includes('list.json')) return new Response(JSON.stringify({ status: '013' }));
  return new Response('<rss><channel></channel></rss>');
}) as typeof fetch;

test('the first settled run picks the week: core and the largest company get the committee, the rest a brief', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const tickers = (await loadTickers(join(process.cwd(), 'tickers.json'))).filter((t) => t.symbol === '000660');
  const models: string[] = [];
  const anthropic = { beta: { messages: { parse: async (req: { model: string }) => { models.push(req.model); return { stop_reason: 'end_turn', model: req.model, usage: { input_tokens: 100, output_tokens: 50 }, parsed_output: { summary: { text: '요약', evidenceIds: ['P1'] }, desks: [], scenarios: [], analysts: [], bullish: [], bearish: [], uncertain: [], watch: [], dataGaps: [] } }; } } } } as never;
  const params = { ...DEFAULT_SELECTION, size: 3, bigCaps: 1 };
  const out = await runDaily({ root, now: new Date('2026-10-02T09:30:00Z'), apiKey: 'k', fetch: fake, tickers, anthropic, selectionParams: params });
  assert.equal(out.selected, '2026-10-02');
  const sel = JSON.parse(await readFile(join(root, 'data', 'selections', '2026-10-02.json'), 'utf8')) as { picks: { symbol: string; tier: string; reasons: string[] }[] };
  assert.deepEqual(sel.picks.map((p) => [p.symbol, p.tier]), [['000660', 'deep'], ['111110', 'deep'], ['222220', 'brief']]);
  assert.deepEqual(sel.picks[1]!.reasons, ['시가총액 상위 (30조원)']);
  assert.deepEqual(out.results.map((r) => [r.symbol, r.report]), [['000660', 'WRITTEN'], ['111110', 'WRITTEN'], ['222220', 'WRITTEN']]);
  assert.deepEqual(models.sort(), ['claude-haiku-4-5', 'claude-opus-5-5', 'claude-opus-5-5']);
  const report = JSON.parse(await readFile(join(root, 'reports', '222220', '2026-10-02.json'), 'utf8')) as { commentary: { tier: string; usage: unknown } };
  assert.deepEqual([report.commentary.tier, report.commentary.usage], ['brief', { inputTokens: 100, outputTokens: 50 }]);
  const home = await readFile(join(root, 'site', 'index.html'), 'utf8');
  // The report lists live on reports.html (G-64); the front page shows a few picks.
  const list = await readFile(join(root, 'site', 'reports.html'), 'utf8');
  assert.ok(list.includes('이번 주 AI 리포트 3종목') && list.includes('href="222220/index.html"') && list.includes('data-kind="weekly"'));
  assert.ok(home.includes('id="today"') && !home.includes('id="reports"'));
  // The market dashboard: index quotes, temperature from every stock's computation, movers; pricing pages exist.
  assert.ok(home.includes('시장 온도') && home.includes('id="movers"') && home.includes('id="watch"'));
  // Alpha (G-44~G-46): the feed slot, the chat on every page, a shorter menu and the account pages.
  assert.ok(home.includes('id="feed"') && home.includes('class="chat-fab"') && !home.includes('>최신</a>') && !/top-links[^]*>모의투자</.test(home.split('</nav>')[0]!));
  for (const page of ['login.html', 'onboarding.html', 'account.html', 'admin.html', 'coins.html', 'coin.html', 'etfs.html']) assert.ok((await readFile(join(root, 'site', page), 'utf8')).includes('<title>'), page);
  assert.ok((await readFile(join(root, 'site', 'pricing.html'), 'utf8')).includes('플러스') && (await readFile(join(root, 'site', 'checkout.html'), 'utf8')).includes('MOCK'));
  const scorecard = await readFile(join(root, 'site', 'scorecard.html'), 'utf8');
  assert.ok(scorecard.includes('예측 범위 적중') && scorecard.includes('AI 분석가 순위') && scorecard.includes('href="222220/index.html"'));
  // The screener presets' track record is public; today's picks are written down for scoring.
  assert.ok(scorecard.includes('id="signals"') && (await readFile(join(root, 'data', 'signals.jsonl'), 'utf8')).includes('"preset":"top"'));
  assert.ok((await readFile(join(root, 'site', 'terms.html'), 'utf8')).includes('투자 자문이나 매매 권유가 아니에요'));
  // The screener: one row per stock with a computation, covered stocks marked.
  const screener = JSON.parse(await readFile(join(root, 'site', 'screener.json'), 'utf8')) as { rows: unknown[][] };
  assert.ok(screener.rows.length >= 3 && screener.rows.some((r) => r[0] === '222220' && r[13] === 1));
  assert.ok((await readFile(join(root, 'site', 'screener.html'), 'utf8')).includes('data-preset="rebound"'));
  // Monday: no new selection and no AI; every page is a live dashboard and no dated report is kept.
  models.length = 0;
  const again = await runDaily({ root, now: new Date('2026-10-05T09:30:00Z'), apiKey: 'k', fetch: fake, tickers, anthropic, selectionParams: params });
  assert.equal(again.selected, null);
  assert.deepEqual(models, []);
  assert.deepEqual(again.results.map((r) => [r.symbol, r.report]), [['000660', 'SKIPPED'], ['111110', 'SKIPPED'], ['222220', 'SKIPPED']]);
  // Core stocks still log forecasts and the paper ledger on a trading day without a report.
  const paper = (await readFile(join(root, 'data', 'paper', '000660.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l) as { date: string });
  assert.ok(paper.some((p) => p.date === '2026-10-05'));
  // The live page carries the latest committee's commentary with its date.
  assert.match(await readFile(join(root, 'site', '000660', 'index.html'), 'utf8'), /2026-10-02 리포트의 AI 위원회 해설/);
});

test('a requested stock gets one deep committee report, then dashboards only', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const tickers = (await loadTickers(join(process.cwd(), 'tickers.json'))).filter((t) => t.symbol === '000660');
  const calls: string[] = [];
  const anthropic = { beta: { messages: { parse: async (req: { model: string; messages: { content: string }[] }) => { calls.push(/"종목": "([^"]+)"/.exec(req.messages[0]!.content)?.[1] ?? '?'); return { stop_reason: 'end_turn', model: req.model, parsed_output: { summary: { text: '요약', evidenceIds: ['P1'] }, desks: [], scenarios: [], analysts: [], bullish: [], bearish: [], uncertain: [], watch: [], dataGaps: [] } }; } } } } as never;
  const opts = { root, apiKey: 'k', fetch: fake, tickers, anthropic, requests: [{ symbol: '111110', requestedAt: '2026-10-02' }], selectionParams: { ...DEFAULT_SELECTION, size: 1, bigCaps: 0 }, dailyPicks: false };
  await runDaily({ ...opts, now: new Date('2026-10-02T09:30:00Z') });
  assert.deepEqual(calls.sort(), ['SK하이닉스 (000660)', '조용한전자 (111110)']);
  const home = await readFile(join(root, 'site', 'index.html'), 'utf8');
  // Requested reports are kept off the front page (G-61) but have their page and are in search.
  assert.ok(!home.includes('data-kind="request"'));
  assert.match(await readFile(join(root, 'site', '111110', 'index.html'), 'utf8'), /조용한전자/);
  assert.ok((JSON.parse(await readFile(join(root, 'site', 'search.json'), 'utf8')) as { items: unknown[][] }).items.some((x) => x[0] === '111110' && x[5] === 1));
  // Stocks without a report get chart data for the shared, locked stock page.
  const page = JSON.parse(await readFile(join(root, 'site', 's', '222220.json'), 'utf8')) as { name: string; bars: unknown[] };
  assert.deepEqual([page.name, page.bars.length], ['뛰는바이오', 80]);
  await assert.rejects(readFile(join(root, 'site', 's', '111110.json')));
  const stockPage = await readFile(join(root, 'site', 'stock.html'), 'utf8');
  assert.ok(stockPage.includes('data-spend="report"') && stockPage.includes('class="gate"') && stockPage.includes('class="card locked"'));
  // Every stock page carries the free computation: signal, one line, moves, fair value, forecasts.
  const calc = (page as unknown as { calc: { signal: { label: string }; line: string; moves: unknown[]; forecasts: unknown[] } }).calc;
  assert.ok(calc.signal.label && calc.line.includes('기술 신호') && calc.moves.length === 3 && Array.isArray(calc.forecasts), JSON.stringify(calc).slice(0, 200));
  calls.length = 0;
  await runDaily({ ...opts, now: new Date('2026-10-05T09:30:00Z') });
  assert.deepEqual(calls, []);
});

test('a refresh request writes one new deep report in the current prompt, even on a non-session day', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const tickers = (await loadTickers(join(process.cwd(), 'tickers.json'))).filter((t) => t.symbol === '000660');
  const calls: string[] = [];
  const anthropic = { beta: { messages: { parse: async (req: { model: string; messages: { content: string }[] }) => { calls.push(/"종목": "([^"]+)"/.exec(req.messages[0]!.content)?.[1] ?? '?'); return { stop_reason: 'end_turn', model: req.model, parsed_output: { summary: { text: '요약', evidenceIds: ['P1'] }, desks: [], scenarios: [], analysts: [], bullish: [], bearish: [], uncertain: [], watch: [], dataGaps: [] } }; } } } } as never;
  const opts = { root, apiKey: 'k', fetch: fake, tickers, anthropic, selectionParams: { ...DEFAULT_SELECTION, size: 1, bigCaps: 0 }, dailyPicks: false };
  await runDaily({ ...opts, now: new Date('2026-10-02T09:30:00Z') });
  // Make the core report look written by an older prompt.
  const path = join(root, 'reports', '000660', '2026-10-02.json');
  const old = JSON.parse(await readFile(path, 'utf8')) as { commentary: { promptVersion: string } };
  old.commentary.promptVersion = 'gnm-committee-v2';
  await writeFile(path, JSON.stringify(old));
  calls.length = 0;
  const refresh = [{ symbol: '000660', requestedAt: '2026-10-03', refresh: true }];
  await runDaily({ ...opts, requests: refresh, now: new Date('2026-10-03T09:30:00Z') });
  assert.deepEqual(calls, ['SK하이닉스 (000660)']);
  assert.match(await readFile(join(root, 'reports', '000660', '2026-10-03.json'), 'utf8'), /gnm-committee-v6/);
  assert.match(await readFile(path, 'utf8'), /gnm-committee-v2/);
  // Once a current report exists, the request does nothing.
  calls.length = 0;
  await runDaily({ ...opts, requests: refresh, now: new Date('2026-10-04T09:30:00Z') });
  assert.deepEqual(calls, []);
});

test('daily picks (G-56): drawn once a day from the screener, reported once, shown on the front page', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const tickers = (await loadTickers(join(process.cwd(), 'tickers.json'))).filter((t) => t.symbol === '000660');
  const calls: string[] = [];
  const anthropic = { beta: { messages: { parse: async (req: { model: string; messages: { content: string }[] }) => { calls.push(/"종목": "([^"]+)"/.exec(req.messages[0]!.content)?.[1] ?? '?'); return { stop_reason: 'end_turn', model: req.model, parsed_output: { summary: { text: '요약', evidenceIds: ['P1'] }, desks: [], scenarios: [], analysts: [], bullish: [], bearish: [], uncertain: [], watch: [], dataGaps: [] } }; } } } } as never;
  const opts = { root, apiKey: 'k', fetch: fake, tickers, anthropic, selectionParams: { ...DEFAULT_SELECTION, size: 1, bigCaps: 0 } };
  await runDaily({ ...opts, now: new Date('2026-10-02T09:30:00Z') });
  calls.length = 0;
  await runDaily({ ...opts, now: new Date('2026-10-05T09:30:00Z') });
  const picks = (await readFile(join(root, 'data', 'daily-picks.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l) as { date: string; symbol: string; kind: string; tier: string });
  assert.ok(picks.length >= 1 && picks.every((p) => p.date === '2026-10-05' && p.kind === 'stock'));
  assert.equal(picks[0]!.tier, 'deep');
  assert.equal(calls.length, picks.length);
  const home = await readFile(join(root, 'site', 'index.html'), 'utf8');
  assert.ok(home.includes('id="today"') && home.includes(`href="${picks[0]!.symbol}/index.html"`));
  assert.ok((await readFile(join(root, 'site', 'reports.html'), 'utf8')).includes('id="daily"'));
  // A re-run the same day draws nothing new and calls no model.
  calls.length = 0;
  await runDaily({ ...opts, now: new Date('2026-10-05T11:00:00Z') });
  assert.deepEqual(calls, []);
  assert.equal((await readFile(join(root, 'data', 'daily-picks.jsonl'), 'utf8')).trim().split('\n').length, picks.length);
});

test('the monthly AI budget: core stocks spend it first, the rest skip AI with the reason; every call is in the ledger', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const tickers = (await loadTickers(join(process.cwd(), 'tickers.json'))).filter((t) => t.symbol === '000660');
  const models: string[] = [];
  const anthropic = { beta: { messages: { parse: async (req: { model: string }) => { models.push(req.model); return { stop_reason: 'end_turn', model: req.model, usage: { input_tokens: 10_000, output_tokens: 4_000 }, parsed_output: { summary: { text: '요약', evidenceIds: ['P1'] }, desks: [], scenarios: [], analysts: [], bullish: [], bearish: [], uncertain: [], watch: [], dataGaps: [] } }; } } } } as never;
  const out = await runDaily({ root, now: new Date('2026-10-02T09:30:00Z'), apiKey: 'k', fetch: fake, tickers, anthropic, aiBudgetUsd: 0.2, selectionParams: { ...DEFAULT_SELECTION, size: 3, bigCaps: 1 } });
  // Core (Opus) first; then the big-cap deep call no longer fits, the cheap brief still does.
  assert.deepEqual(models.sort(), ['claude-haiku-4-5', 'claude-opus-5-5']);
  const skipped = JSON.parse(await readFile(join(root, 'reports', '111110', '2026-10-02.json'), 'utf8')) as { commentary: { status: string; error: string } };
  assert.deepEqual([skipped.commentary.status, skipped.commentary.error], ['SKIPPED', 'AI_MONTHLY_BUDGET:0.2USD']);
  assert.equal(out.results.length, 3);
  const ledger = (await readFile(join(root, 'data', 'status', 'ai-usage.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l) as { symbol: string; usd: number; month: string });
  assert.deepEqual(ledger.map((l) => [l.symbol, l.usd, l.month]).sort(), [['000660', 0.12, '2026-10'], ['222220', 0.03, '2026-10']]);
});

test('sealed deep reports (G-61): the paid part is neither in the repository nor in the page, only sealed next to it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-'));
  const tickers = (await loadTickers(join(process.cwd(), 'tickers.json'))).filter((t) => t.symbol === '000660');
  const anthropic = { beta: { messages: { parse: async (req: { model: string }) => ({ stop_reason: 'end_turn', model: req.model, parsed_output: {
    summary: { text: '공개 결론', evidenceIds: ['P1'] }, bullish: [{ text: '공개 강세', evidenceIds: ['P1'] }, { text: '비밀강세둘', evidenceIds: ['P1'] }], bearish: [], uncertain: [], watch: [{ text: '비밀관찰', evidenceIds: ['P1'] }], dataGaps: [],
    desks: [{ desk: 'TECHNICAL', stance: 'BULLISH', view: { text: '비밀데스크', evidenceIds: ['P1'] } }],
    scenarios: [{ kind: 'BULL', narrative: { text: '비밀시나리오', evidenceIds: ['P1'] }, catalysts: ['비밀촉매'], invalidation: [], probability: 60 }, { kind: 'BEAR', narrative: { text: '비밀약세', evidenceIds: ['P1'] }, catalysts: [], invalidation: [], probability: 40 }],
    analysts: [] } }) } } } as never;
  setDeepKey('test-deep-key');
  try {
    const opts = { root, apiKey: 'k', fetch: fake, tickers, anthropic, selectionParams: { ...DEFAULT_SELECTION, size: 1, bigCaps: 0 }, dailyPicks: false };
    await runDaily({ ...opts, now: new Date('2026-10-02T09:30:00Z') });
    const secrets = /비밀데스크|비밀시나리오|비밀촉매|비밀강세둘|비밀관찰/;
    const stored = await readFile(join(root, 'reports', '000660', '2026-10-02.json'), 'utf8');
    assert.doesNotMatch(stored, secrets);
    assert.match(stored, /"sealed":"/);
    assert.match(stored, /공개 결론/);
    for (const page of ['index.html', 'reports/2026-10-02.html']) {
      const html = await readFile(join(root, 'site', '000660', page), 'utf8');
      assert.doesNotMatch(html, secrets, page);
      assert.ok(html.includes('id="deep-slot"') && html.includes('data-date="2026-10-02"') && html.includes('cl-card') && html.includes('60%</b>'), page);
    }
    const deep = await unseal(await readFile(join(root, 'site', '000660', 'deep', '2026-10-02.txt'), 'utf8'), 'test-deep-key');
    assert.match(deep, /비밀데스크/); assert.match(deep, /비밀시나리오/);
    // The next run opens the sealed report again for the live page, and still leaks nothing.
    await runDaily({ ...opts, now: new Date('2026-10-05T09:30:00Z') });
    assert.doesNotMatch(await readFile(join(root, 'site', '000660', 'index.html'), 'utf8'), secrets);
    assert.match(await unseal(await readFile(join(root, 'site', '000660', 'deep', '2026-10-02.txt'), 'utf8'), 'test-deep-key'), /비밀데스크/);
  } finally { setDeepKey(''); }
});
