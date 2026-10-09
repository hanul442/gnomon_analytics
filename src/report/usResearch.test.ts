import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUsReport, emptyUsResearch, gatherUsResearch } from './usResearch.js';
import { renderStockPage, renderDeep } from './renderHtml.js';
import { fundamentalsPanel } from './renderMarket.js';
import { withCurrency, bigMoney, financeUnit } from './format.js';
import { buildEvidence } from '../analysis/commentary.js';
import { usNewsQuery, usNewsSearchUrl } from '../sources/usNews.js';
import { parseWorldBasic } from '../sources/naverWorld.js';
import type { PriceBar } from '../types.js';

const AT = new Date('2026-10-08T22:00:00Z');
const bars: PriceBar[] = Array.from({ length: 300 }, (_, i) => { const d = new Date(Date.UTC(2025, 7, 1) + i * 86_400_000); return { symbol: 'MRNA.O', source: 'naver:world:day', retrievedAt: AT.toISOString(), date: d.toISOString().slice(0, 10), open: 30, high: 32, low: 29, close: 30 + Math.sin(i / 9) * 3, volume: 1_000_000 }; }).filter((b) => ![0, 6].includes(new Date(`${b.date}T00:00:00Z`).getUTCDay()));
const research = () => ({
  ...emptyUsResearch(), cik: 1682852,
  disclosures: [{ receiptNo: '0001682852-26-000040', corpName: 'Moderna, Inc.', stockCode: 'MRNA.O', title: '실적 발표 (8-K 2.02, 9.01)', filer: 'Moderna, Inc.', filedDate: bars.at(-3)!.date, remark: '8-K', url: 'https://www.sec.gov/Archives/edgar/data/1682852/000168285226000040/mrna.htm', source: 'sec:edgar', retrievedAt: AT.toISOString() }],
  finance: [
    { symbol: 'MRNA.O', periodType: 'QUARTER' as const, period: '202603', isEstimate: false, metrics: { '매출액': 108, '영업이익': -1300, '당기순이익': -1100, '자산총계': 12500, '부채총계': 3100, '자본총계': 9400, '부채비율': 33, '영업이익률': -1203 }, source: 'sec:edgar:xbrl', retrievedAt: AT.toISOString() },
    { symbol: 'MRNA.O', periodType: 'QUARTER' as const, period: '202606', isEstimate: false, metrics: { '매출액': 143, '영업이익': -1200, '당기순이익': -1000, '자산총계': 12000, '부채총계': 3000, '자본총계': 9000, '부채비율': 33, '영업이익률': -839 }, source: 'sec:edgar:xbrl', retrievedAt: AT.toISOString() },
    { symbol: 'MRNA.O', periodType: 'ANNUAL' as const, period: '202512', isEstimate: false, metrics: { '매출액': 3236, '영업이익': -3800, '당기순이익': -3561, '자본총계': 9750, 'ROE': -37 }, source: 'sec:edgar:xbrl', retrievedAt: AT.toISOString() },
  ],
  insider: [{ symbol: 'MRNA.O', receiptNo: '0001682852-26-000041', date: bars.at(-5)!.date, reporter: 'Bancel Stephane', position: 'Chief Executive Officer', isExec: true, isMajor: false, shares: 4160000, delta: -190000, ratio: null, retrievedAt: AT.toISOString() }],
  snapshot: { symbol: 'MRNA.O', date: '2026-10-08', per: null, eps: -9.3, estimatedPer: null, estimatedEps: null, pbr: 1.3, bps: null, dividendYield: null, marketCap: 12_300_000_000, high52w: 45.1, low52w: 22.3, consensus: null, source: 'naver:world:basic', retrievedAt: AT.toISOString() },
  news: [{ url: 'https://www.reuters.com/moderna-flu-vaccine', title: 'Moderna flu vaccine wins FDA approval', publisher: 'Reuters', publishedAt: new Date(AT.getTime() - 3600_000).toISOString(), source: 'google:news-rss-en', retrievedAt: AT.toISOString() }],
  status: [{ source: 'sec:edgar', ok: true, count: 1 }, { source: 'sec:edgar:xbrl', ok: true, count: 3 }, { source: 'sec:edgar:form4', ok: true, count: 1 }, { source: 'naver:world:basic', ok: true, count: 1 }, { source: 'google:news-rss-en', ok: true, count: 1 }],
});

test('a US report carries SEC filings, XBRL periods, the snapshot, Form 4 trades and English news, all in dollars (G-179)', () => {
  const r = buildUsReport({ symbol: 'MRNA.O', name: '모더나', nameEng: 'Moderna, Inc.', exchange: 'NASDAQ', bars, research: research(), now: AT });
  assert.equal(r.currency, 'USD');
  assert.equal(r.recentFilings?.[0]?.category, '실적');
  assert.equal(r.market?.quarters.length, 2);
  assert.equal(r.market?.years[0]?.metrics['ROE'], -37);
  assert.equal(r.market?.snapshot?.marketCap, 12_300_000_000);
  assert.ok(r.market!.horizons.length > 0, 'weekly bars synthesised so the gauges run');
  assert.equal(r.edge?.insider?.sells, 1);
  assert.match(r.edge!.highlights.find((h) => h.key === 'insider')!.text, /감소 19만주.*\$/);
  assert.match(r.edge!.nextEarnings!.label, /10-Q/);
  assert.equal(r.news?.clusters[0]?.title, 'Moderna flu vaccine wins FDA approval');
  assert.match(r.notes.join(' '), /SEC EDGAR에서 공시 1건, 재무 3개 기간, 내부자 거래 1건/);
  // The committee's evidence list has the filing, the news and the edge line with ids.
  const ids = buildEvidence(r).map((e) => e.id);
  assert.ok(ids.includes('F1') && ids.includes('N1') && ids.includes('E1') && ids.includes('D1'), ids.join(','));
  // The panels print dollars and 백만 달러, never won.
  const html = withCurrency('USD', () => fundamentalsPanel(r.market!, r.price?.close ?? null, r.name, r.recentBars ?? [], r.statements));
  assert.match(html, /\$12\.3B/);
  assert.match(html, /백만 달러|SEC EDGAR/);
  assert.doesNotMatch(html, /억원|원<\/b>/);
  assert.doesNotMatch(withCurrency('USD', () => renderDeep({ ...r, commentary: { status: 'OK', generatedAt: AT.toISOString(), model: 't', summary: { text: '요약' }, bullish: [], bearish: [], uncertain: [], watch: [], dataGaps: [], evidence: [], scenarios: [] } as never }, { live: false })), /\d원/);
  // An ETF has no edge section (no company behind it).
  assert.equal(buildUsReport({ symbol: 'SPY', name: 'SPDR S&P 500', kind: 'etf', bars, research: emptyUsResearch(), now: AT }).edge, undefined);
});

test('big amounts and finance units follow the currency', () => {
  assert.equal(withCurrency('USD', () => bigMoney(12_300_000_000)), '$12.3B');
  assert.equal(withCurrency('USD', () => bigMoney(-120_000_000)), '-$120M');
  assert.equal(withCurrency('USD', () => bigMoney(3.4e12)), '$3.4T');
  assert.equal(withCurrency('USD', () => bigMoney(999.95e9)), '$1.0T');
  assert.equal(withCurrency('USD', () => bigMoney(99.96e9)), '$100B');
  assert.equal(withCurrency('USD', () => bigMoney(999_600)), '$1.0M');
  assert.equal(bigMoney(1.23e12), '1.2조원');
  assert.equal(bigMoney(3.5e8), '4억원');
  assert.deepEqual([financeUnit(), withCurrency('USD', financeUnit)], ['억원', '백만 달러']);
});

test('Naver US snapshot: rows matched by code or label, hangeul amounts to dollars, nothing invented', () => {
  const body = { stockItemTotalInfos: [{ code: 'marketValue', key: '시가총액', value: '123억 USD' }, { code: 'per', key: 'PER', value: '-' }, { code: 'eps', key: 'EPS', value: '-9.30' }, { code: 'pbr', key: 'PBR', value: '1.30배' }, { code: 'x1', key: '52주 최고', value: '45.10' }, { code: 'x2', key: '52주 최저', value: '22.30' }, { code: 'dividendYieldRatio', key: '배당수익률', value: '0.00%' }] };
  const s = parseWorldBasic(body, 'MRNA.O', AT)!;
  assert.deepEqual([s.marketCap, s.per, s.eps, s.pbr, s.high52w, s.low52w, s.dividendYield, s.consensus], [12_300_000_000, null, -9.3, 1.3, 45.1, 22.3, 0, null]);
  assert.equal(parseWorldBasic({ stockItemTotalInfos: [] }, 'X', AT), null);
  assert.equal(parseWorldBasic({}, 'X', AT), null);
});

test('English news query: the plain company name or the ticker, searched in English', () => {
  assert.equal(usNewsQuery('MRNA', 'Moderna, Inc.'), '"Moderna" OR "MRNA stock"');
  assert.equal(usNewsQuery('AAPL', 'Apple Inc.'), '"Apple" OR "AAPL stock"');
  assert.equal(usNewsQuery('SPY', ''), '"SPY stock"');
  assert.equal(usNewsQuery('GOOGL', 'Alphabet Inc. Class A'), '"Alphabet" OR "GOOGL stock"');
  assert.equal(usNewsQuery('TSM', 'Taiwan Semiconductor Manufacturing Co., Ltd. (ADR)'), '"Taiwan Semiconductor Manufacturing" OR "TSM stock"');
  assert.equal(usNewsQuery('KO', 'The Coca-Cola Company'), '"Coca-Cola" OR "KO stock"');
  assert.match(usNewsSearchUrl('x'), /hl=en-US&gl=US&ceid=US%3Aen/);
});

test('gatherUsResearch: every source is best effort and leaves a status row', async () => {
  const fake = (async (url: string) => {
    const u = String(url);
    if (/submissions/.test(u)) return Response.json({ name: 'Moderna, Inc.', filings: { recent: { accessionNumber: ['0001682852-26-000040'], filingDate: [bars.at(-3)!.date], form: ['8-K'], primaryDocument: ['a.htm'], items: ['2.02'] } } });
    if (/companyfacts/.test(u)) return Response.json({ facts: { 'us-gaap': {} } });
    if (/\/basic$/.test(u)) return Response.json({ stockItemTotalInfos: [{ code: 'pbr', key: 'PBR', value: '1.3' }] });
    if (/news\.google\.com/.test(u)) return new Response('<rss><channel><item><title>Moderna wins approval - Reuters</title><link>https://www.reuters.com/a</link><pubDate>Thu, 08 Oct 2026 20:00:00 GMT</pubDate><source url="https://www.reuters.com">Reuters</source></item></channel></rss>', { headers: { 'content-type': 'application/xml' } });
    return new Response('', { status: 500 });
  }) as unknown as typeof fetch;
  const r = await gatherUsResearch({ symbol: 'MRNA.O', ticker: 'MRNA', nameEng: 'Moderna, Inc.', cik: 1682852, fetch: fake, now: () => AT });
  assert.deepEqual([r.disclosures.length, r.finance.length, r.snapshot?.pbr, r.news.length], [1, 0, 1.3, 1]);
  assert.deepEqual(r.status.map((s) => `${s.source}:${s.ok ? 'ok' : 'x'}`), ['sec:edgar:ok', 'sec:edgar:xbrl:ok', 'naver:world:basic:ok', 'google:news-rss-en:ok']);
  // Nothing reachable: an empty research set, with the reasons, and the report still builds from the bars.
  const none = await gatherUsResearch({ symbol: 'MRNA.O', ticker: 'MRNA', nameEng: 'Moderna', cik: 1682852, fetch: (async () => new Response('', { status: 503 })) as unknown as typeof fetch, now: () => AT });
  assert.ok(none.status.every((s) => !s.ok));
  const r2 = buildUsReport({ symbol: 'MRNA.O', name: '모더나', bars, research: none, now: AT });
  assert.match(r2.notes.join(' '), /SEC EDGAR 자료를 읽지 못해/);
  assert.equal(r2.market?.quarters.length, 0);
  // The page template still renders a US stock page.
  assert.match(renderStockPage(), /stock-hero/);
});
