import assert from 'node:assert/strict';
import test from 'node:test';
import { dartViewerUrl, fetchDartFilings, parseDartList } from './opendart.js';

const AT = new Date('2026-10-02T09:30:00Z');
const row = (overrides: Record<string, string> = {}) => ({
  corp_code: '00164779', corp_name: 'SK하이닉스', stock_code: '000660', corp_cls: 'Y',
  report_nm: '주요사항보고서(자기주식취득결정)', rcept_no: '20261002000123', flr_nm: 'SK하이닉스', rcept_dt: '20261002', rm: '유',
  ...overrides,
});

test('parses filings with a DART viewer link', () => {
  const { filings } = parseDartList({ status: '000', message: '정상', total_page: 1, list: [row(), row({ rcept_no: 'bad' })] }, AT);
  assert.equal(filings.length, 1);
  assert.deepEqual(filings[0], {
    receiptNo: '20261002000123', corpName: 'SK하이닉스', stockCode: '000660', title: '주요사항보고서(자기주식취득결정)',
    filer: 'SK하이닉스', filedDate: '2026-10-02', remark: '유', url: dartViewerUrl('20261002000123'),
    source: 'opendart:list', retrievedAt: '2026-10-02T09:30:00.000Z',
  });
});

test('no filings is empty; any other status is an error', () => {
  assert.deepEqual(parseDartList({ status: '013', message: '조회된 데이타가 없습니다.' }, AT).filings, []);
  assert.throws(() => parseDartList({ status: '010', message: '등록되지 않은 키입니다.' }, AT), /DART_STATUS_010/);
  assert.throws(() => parseDartList('nope', AT), /DART_UNEXPECTED_RESPONSE/);
});

test('fetch pages through results and never leaks the key in errors', async () => {
  const pages: string[] = [];
  const fakeFetch = (async (url: string | URL | Request) => {
    const page = new URL(String(url)).searchParams.get('page_no')!;
    pages.push(page);
    return new Response(JSON.stringify({ status: '000', total_page: 2, list: [row({ rcept_no: `2026100200012${page}` })] }));
  }) as typeof fetch;
  const filings = await fetchDartFilings({ apiKey: 'secret-key', corpCode: '00164779', from: '20260901', to: '20261002', fetch: fakeFetch, now: () => AT });
  assert.deepEqual(pages, ['1', '2']);
  assert.equal(filings.length, 2);
  const failing = (async () => new Response('down', { status: 503 })) as typeof fetch;
  await assert.rejects(fetchDartFilings({ apiKey: 'secret-key', corpCode: 'x', from: '1', to: '2', fetch: failing }), (error: Error) => error.message === 'DART_HTTP_503');
  await assert.rejects(fetchDartFilings({ apiKey: ' ', corpCode: 'x', from: '1', to: '2' }), /OPENDART_API_KEY_MISSING/);
});
