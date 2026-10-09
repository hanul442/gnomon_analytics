import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveUrl, cikFromTickers, cikMap, companyFactsUrl, edgarTitle, fetchEdgar, padCik, parseCompanyFacts, parseForm4, parseSubmissions, submissionsUrl, tickersUrl } from './edgar.js';
import { readFilingTitle } from '../report/classify.js';

const AT = new Date('2026-10-08T22:00:00Z');
// Shapes as EDGAR answers them (trimmed): https://www.sec.gov/edgar/sec-api-documentation
const TICKERS = { '0': { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' }, '1': { cik_str: 1682852, ticker: 'MRNA', title: 'Moderna, Inc.' }, '2': { cik_str: 1067983, ticker: 'BRK-B', title: 'BERKSHIRE HATHAWAY INC' } };
const SUBMISSIONS = {
  cik: '1682852', name: 'Moderna, Inc.', tickers: ['MRNA'],
  filings: { recent: {
    accessionNumber: ['0001682852-26-000041', '0001682852-26-000040', '0001682852-26-000039', '0001682852-26-000030', '0001682852-26-000012', '0001682852-25-000090'],
    filingDate: ['2026-10-02', '2026-09-29', '2026-09-29', '2026-08-01', '2026-05-01', '2025-03-01'],
    form: ['4', '8-K', '3', '10-Q', '8-K', '10-K'],
    primaryDocument: ['xslF345X05/wk-form4_1759.xml', 'mrna-20260929.htm', 'xslF345X05/form3.xml', 'mrna-20260630.htm', 'mrna-20260501.htm', 'mrna-20251231.htm'],
    primaryDocDescription: ['FORM 4', '8-K', 'FORM 3', '10-Q', '8-K', '10-K'],
    items: ['', '5.02,9.01', '', '', '2.02,9.01', ''],
  } },
};
const fact = (end: string, val: number, extra: Record<string, unknown> = {}) => ({ end, val, accn: 'x', fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', ...extra });
const FACTS = { cik: 1682852, entityName: 'Moderna, Inc.', facts: { 'us-gaap': {
  Revenues: { units: { USD: [
    fact('2026-03-31', 108e6, { start: '2026-01-01', frame: 'CY2026Q1', fp: 'Q1' }), fact('2026-06-30', 142e6, { start: '2026-04-01', frame: 'CY2026Q2' }),
    fact('2025-12-31', 3236e6, { start: '2025-01-01', frame: 'CY2025', fp: 'FY', form: '10-K', filed: '2026-02-20' }),
    // A fiscal year off the calendar (ends September): no CY frame, so the 10-K's own year-long fact is used.
    fact('2026-09-30', 4000e6, { start: '2025-10-01', fp: 'FY', form: '10-K', filed: '2026-11-01' }),
    // The same quarter restated later wins.
    fact('2026-06-30', 143e6, { start: '2026-04-01', frame: 'CY2026Q2', filed: '2026-09-01' }),
  ] } },
  OperatingIncomeLoss: { units: { USD: [fact('2026-06-30', -1200e6, { start: '2026-04-01', frame: 'CY2026Q2' }), fact('2025-12-31', -3800e6, { start: '2025-01-01', frame: 'CY2025', fp: 'FY', form: '10-K' })] } },
  NetIncomeLoss: { units: { USD: [fact('2026-06-30', -1000e6, { start: '2026-04-01', frame: 'CY2026Q2' }), fact('2025-12-31', -3561e6, { start: '2025-01-01', frame: 'CY2025', fp: 'FY', form: '10-K' })] } },
  Assets: { units: { USD: [fact('2026-06-30', 12000e6, { frame: 'CY2026Q2I' }), fact('2025-12-31', 13000e6, { frame: 'CY2025Q4I', fp: 'FY', form: '10-K' })] } },
  Liabilities: { units: { USD: [fact('2026-06-30', 3000e6, { frame: 'CY2026Q2I' }), fact('2025-12-31', 3250e6, { frame: 'CY2025Q4I', fp: 'FY', form: '10-K' })] } },
  StockholdersEquity: { units: { USD: [fact('2026-06-30', 9000e6, { frame: 'CY2026Q2I' }), fact('2025-12-31', 9750e6, { frame: 'CY2025Q4I', fp: 'FY', form: '10-K' })] } },
  EarningsPerShareDiluted: { units: { 'USD/shares': [fact('2026-06-30', -2.58, { start: '2026-04-01', frame: 'CY2026Q2' })] } },
  // A fiscal year off the calendar (ends September): no CY frame, so the 10-K's own year-long fact is used.
  CommonStockDividendsPerShareDeclared: { units: { 'USD/shares': [fact('2026-09-30', 1.0, { start: '2025-10-01', fp: 'FY', form: '10-K', filed: '2026-11-01' })] } },
} } };
const FORM4 = `<?xml version="1.0"?><ownershipDocument><issuer><issuerCik>0001682852</issuerCik><issuerTradingSymbol>MRNA</issuerTradingSymbol></issuer>
<reportingOwner><reportingOwnerId><rptOwnerCik>0001</rptOwnerCik><rptOwnerName>Bancel Stephane</rptOwnerName></reportingOwnerId><reportingOwnerRelationship><isDirector>1</isDirector><isOfficer>1</isOfficer><isTenPercentOwner>0</isTenPercentOwner><officerTitle>Chief Executive Officer</officerTitle></reportingOwnerRelationship></reportingOwner>
<nonDerivativeTable>
<nonDerivativeTransaction><transactionDate><value>2026-09-29</value></transactionDate><transactionCoding><transactionFormType>4</transactionFormType><transactionCode>S</transactionCode></transactionCoding><transactionAmounts><transactionShares><value>190000</value></transactionShares><transactionPricePerShare><value>31.2</value></transactionPricePerShare><transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode></transactionAmounts><postTransactionAmounts><sharesOwnedFollowingTransaction><value>4100000</value></sharesOwnedFollowingTransaction></postTransactionAmounts></nonDerivativeTransaction>
<nonDerivativeTransaction><transactionDate><value>2026-09-30</value></transactionDate><transactionCoding><transactionCode>M</transactionCode></transactionCoding><transactionAmounts><transactionShares><value>50000</value></transactionShares><transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode></transactionAmounts><postTransactionAmounts><sharesOwnedFollowingTransaction><value>4150000</value></sharesOwnedFollowingTransaction></postTransactionAmounts></nonDerivativeTransaction>
<nonDerivativeTransaction><transactionDate><value>2026-09-30</value></transactionDate><transactionCoding><transactionCode>P</transactionCode></transactionCoding><transactionAmounts><transactionShares><value>10000</value></transactionShares><transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode></transactionAmounts><postTransactionAmounts><sharesOwnedFollowingTransaction><value>4160000</value></sharesOwnedFollowingTransaction></postTransactionAmounts></nonDerivativeTransaction>
</nonDerivativeTable></ownershipDocument>`;

test('CIK lookup: by ticker (class shares with a dot or a dash), padded to ten digits in the URLs', () => {
  assert.equal(cikFromTickers(TICKERS, 'MRNA'), 1682852);
  assert.equal(cikFromTickers(TICKERS, 'BRK.B'), 1067983);
  assert.equal(cikFromTickers(TICKERS, 'NOPE'), null);
  assert.equal(cikMap(TICKERS).get('AAPL'), 320193);
  assert.equal(padCik(320193), '0000320193');
  assert.equal(submissionsUrl(320193), 'https://data.sec.gov/submissions/CIK0000320193.json');
  assert.equal(companyFactsUrl('320193'), 'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json');
  assert.equal(archiveUrl(1682852, '0001682852-26-000040', 'mrna-20260929.htm'), 'https://www.sec.gov/Archives/edgar/data/1682852/000168285226000040/mrna-20260929.htm');
});

test('submissions: only the forms worth a line, Korean titles the classifier reads, Form 4s listed to open', () => {
  const r = parseSubmissions(SUBMISSIONS, { symbol: 'MRNA.O', cik: 1682852, retrievedAt: AT, since: '2026-04-11', form4Since: '2026-07-10' });
  assert.equal(r.name, 'Moderna, Inc.');
  assert.deepEqual(r.disclosures.map((d) => d.title), ['임원·주요주주 거래 보고 (Form 4)', '임원 변동 (8-K 5.02, 9.01)', '분기보고서 (10-Q)', '실적 발표 (8-K 2.02, 9.01)']);
  assert.equal(r.disclosures[1]!.url, 'https://www.sec.gov/Archives/edgar/data/1682852/000168285226000040/mrna-20260929.htm');
  assert.equal(r.disclosures[1]!.remark, '8-K');
  // The raw XML, not the XSL-rendered page.
  assert.deepEqual(r.form4, [{ accession: '0001682852-26-000041', date: '2026-10-02', doc: 'wk-form4_1759.xml' }]);
  assert.throws(() => parseSubmissions({}, { symbol: 'X', cik: 1, retrievedAt: AT, since: '2026-01-01' }), /EDGAR_UNEXPECTED/);
  // classify.ts: the form decides the kind and weight.
  assert.deepEqual([readFilingTitle('실적 발표 (8-K 2.02, 9.01)').category, readFilingTitle('실적 발표 (8-K 2.02, 9.01)').importance], ['실적', 'HIGH']);
  assert.deepEqual([readFilingTitle('분기보고서 (10-Q)').category, readFilingTitle('[정정] 사업보고서 (10-K/A)').importance], ['정기보고서', 'MEDIUM']);
  assert.equal(readFilingTitle('임원·주요주주 거래 보고 (Form 4)').category, '지분');
  assert.equal(readFilingTitle('5% 이상 보유 보고 (SC 13D)').importance, 'MEDIUM');
  assert.equal(readFilingTitle('주요 계약 (8-K 1.01)').category, '주요사항');
  assert.equal(readFilingTitle('증권 발행 등록 (S-3)').category, '자금조달');
  assert.equal(readFilingTitle('주주총회 위임장 (DEF 14A)').category, '지배구조');
  assert.equal(readFilingTitle('Reg FD 공개 (8-K 7.01)').category, '기타');
  assert.equal(edgarTitle('424B5'), '증권 발행 설명서 (424B5)');
  assert.equal(edgarTitle('10-K/A'), '[정정] 사업보고서 (10-K/A)');
});

test('company facts: calendar frames become quarters and years in 백만 달러, restatements win, ratios are computed, off-calendar years come from the 10-K', () => {
  const f = parseCompanyFacts(FACTS, 'MRNA.O', AT);
  const q = f.filter((p) => p.periodType === 'QUARTER'), y = f.filter((p) => p.periodType === 'ANNUAL');
  assert.deepEqual(q.map((p) => p.period), ['202603', '202606']);
  assert.equal(q[1]!.metrics['매출액'], 143);
  assert.equal(q[1]!.metrics['영업이익'], -1200);
  assert.equal(q[1]!.metrics['EPS'], -2.58);
  assert.equal(q[1]!.metrics['자산총계'], 12000);
  assert.equal(Math.round(q[1]!.metrics['부채비율']!), 33);
  assert.equal(Math.round(q[1]!.metrics['영업이익률']!), -839);
  assert.deepEqual(y.map((p) => p.period), ['202512', '202609']);
  assert.equal(y[0]!.metrics['매출액'], 3236);
  assert.equal(y[0]!.metrics['자본총계'], 9750);
  assert.equal(Math.round(y[0]!.metrics['ROE']!), -37);
  assert.equal(y[1]!.metrics['매출액'], 4000);
  assert.equal(y[1]!.metrics['주당배당금'], 1);
  assert.ok(f.every((p) => !p.isEstimate && p.source === 'sec:edgar:xbrl'));
  assert.throws(() => parseCompanyFacts({ facts: {} }, 'X', AT), /EDGAR_FACTS_UNEXPECTED/);
});

test('Form 4: open-market buys and sells summed per filing, exercises and grants ignored, role from the relationship', () => {
  const r = parseForm4(FORM4, { symbol: 'MRNA.O', receiptNo: '0001682852-26-000041', filedDate: '2026-10-02', retrievedAt: AT });
  assert.equal(r.length, 1);
  assert.deepEqual([r[0]!.reporter, r[0]!.position, r[0]!.isExec, r[0]!.isMajor, r[0]!.delta, r[0]!.shares, r[0]!.date], ['Bancel Stephane', 'Chief Executive Officer', true, false, -180000, 4160000, '2026-09-30']);
  // A filing with only a grant is not a trade.
  assert.deepEqual(parseForm4(FORM4.replace(/<transactionCode>[SP]<\/transactionCode>/g, '<transactionCode>A</transactionCode>'), { symbol: 'MRNA.O', receiptNo: 'x', filedDate: '2026-10-02', retrievedAt: AT }), []);
  assert.throws(() => parseForm4('<html></html>', { symbol: 'X', receiptNo: 'x', filedDate: '2026-10-02', retrievedAt: AT }), /EDGAR_FORM4_UNEXPECTED/);
});

test('fetchEdgar: the CIK map is skipped when the CIK is known, every part is best effort, the User-Agent names the app', async () => {
  const seen: string[] = [], agents = new Set<string>();
  const fake = (async (url: string, init?: RequestInit) => {
    seen.push(String(url)); agents.add(String((init?.headers as Record<string, string>)['User-Agent']));
    if (String(url) === tickersUrl) return Response.json(TICKERS);
    if (/submissions/.test(String(url))) return Response.json(SUBMISSIONS);
    if (/companyfacts/.test(String(url))) return new Response('nope', { status: 503 });
    if (/wk-form4_1759\.xml$/.test(String(url))) return new Response(FORM4, { headers: { 'content-type': 'application/xml' } });
    return new Response('', { status: 404 });
  }) as unknown as typeof fetch;
  const r = await fetchEdgar({ symbol: 'MRNA.O', ticker: 'MRNA', cik: 1682852, fetch: fake, now: () => AT, contact: 'ops@example.com' });
  assert.ok(!seen.includes(tickersUrl));
  assert.deepEqual([r.cik, r.name, r.disclosures.length, r.finance.length, r.insider.length], [1682852, 'Moderna, Inc.', 4, 0, 1]);
  assert.equal(r.insider[0]!.url, 'https://www.sec.gov/Archives/edgar/data/1682852/000168285226000041/');
  assert.deepEqual(r.status.map((s) => [s.source, s.ok]), [['sec:edgar', true], ['sec:edgar:xbrl', false], ['sec:edgar:form4', true]]);
  assert.deepEqual([...agents], ['GNOMON research bot (https://github.com/hanul442/gnomon_analytics; ops@example.com)']);
  // Without a CIK the map is read first; an unknown ticker stops there.
  const none = await fetchEdgar({ symbol: 'ZZZZ', ticker: 'ZZZZ', fetch: fake, now: () => AT });
  assert.deepEqual([none.cik, none.status[0]!.error], [null, 'EDGAR_NO_CIK']);
});
