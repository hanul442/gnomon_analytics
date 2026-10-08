import assert from 'node:assert/strict';
import test from 'node:test';
import { dartAmount, fetchDartStatements, parseDartStatements } from './dartStatements.js';

const AT = new Date('2026-10-02T09:30:00Z');
const row = (sj: string, id: string, nm: string, a: string, b: string, c: string, ord: string, extra: Record<string, string> = {}) => ({
  rcept_no: '20260310000123', reprt_code: '11011', bsns_year: '2025', corp_code: '00164779', sj_div: sj, sj_nm: '', account_id: id, account_nm: nm,
  account_detail: '-', thstrm_amount: a, frmtrm_amount: b, bfefrmtrm_amount: c, ord, currency: 'KRW', ...extra,
});
export const DART_FS_FIXTURE = {
  status: '000', message: '정상', list: [
    row('BS', 'ifrs-full_Liabilities', '부채총계', '30,000,000,000,000', '28,000,000,000,000', '', '20'),
    row('BS', 'ifrs-full_Equity', '자본총계', '70,000,000,000,000', '60,000,000,000,000', '50,000,000,000,000', '30'),
    row('BS', 'ifrs-full_Assets', '자산총계', '100,000,000,000,000', '88,000,000,000,000', '', '10'),
    row('CIS', 'ifrs-full_Revenue', '매출액', '1', '1', '1', '1'),
    row('IS', 'ifrs-full_Revenue', '매출액', '66,000,000,000,000', '44,000,000,000,000', '32,000,000,000,000', '1'),
    row('IS', 'dart_OperatingIncomeLoss', '영업이익', '23,000,000,000,000', '-7,700,000,000,000', '6,800,000,000,000', '2'),
    row('IS', 'ifrs-full_ProfitLoss', '당기순이익(손실)', '19,800,000,000,000', '-9,100,000,000,000', '2,200,000,000,000', '3'),
    row('IS', 'ifrs-full_BasicEarningsLossPerShare', '기본주당이익(손실)', '27,182', '-12,517', '3,063', '4'),
    row('IS', 'ifrs-full_OtherIncome', '기타수익', '900,000,000,000', '800,000,000,000', '700,000,000,000', '5'),
    row('CF', 'ifrs-full_CashFlowsFromUsedInOperatingActivities', '영업활동현금흐름', '30,000,000,000,000', '4,000,000,000,000', '14,000,000,000,000', '1'),
    row('CF', 'ifrs-full_PurchaseOfPropertyPlantAndEquipment', '유형자산의 취득', '-17,000,000,000,000', '-8,000,000,000,000', '-19,000,000,000,000', '2'),
    row('CF', 'ifrs-full_CashFlowsFromUsedInInvestingActivities', '투자활동현금흐름', '-18,000,000,000,000', '-9,000,000,000,000', '-17,000,000,000,000', '3'),
    row('CF', 'ifrs-full_CashFlowsFromUsedInFinancingActivities', '재무활동현금흐름', '-8,000,000,000,000', '8,000,000,000,000', '1,000,000,000,000', '4'),
    row('SCE', 'ifrs-full_Equity', '자본', '1', '1', '1', '1', { account_detail: '자본 [member]' }),
  ],
};

test('amounts: commas, minus, brackets and blanks', () => {
  assert.equal(dartAmount('1,234'), 1234);
  assert.equal(dartAmount('-1,234'), -1234);
  assert.equal(dartAmount('(500)'), -500);
  assert.equal(dartAmount(''), null);
  assert.equal(dartAmount('-'), null);
});

test('three years of IS/BS/CF, oldest first; CIS only when there is no IS; SCE is left out', () => {
  const st = parseDartStatements(DART_FS_FIXTURE, '000660', 'CFS', AT)!;
  assert.deepEqual(st.years, ['2023', '2024', '2025']);
  assert.equal(st.receiptNo, '20260310000123');
  assert.deepEqual(st.statements.IS.map((r) => r.name), ['매출액', '영업이익', '당기순이익(손실)', '기본주당이익(손실)', '기타수익']);
  assert.deepEqual(st.statements.IS[1]!.values, [6.8e12, -7.7e12, 23e12]);
  assert.deepEqual(st.statements.BS.map((r) => r.name), ['자산총계', '부채총계', '자본총계']);
  assert.equal(st.statements.BS[0]!.values[0], null);
  assert.equal(st.statements.CF.length, 4);
  assert.equal(parseDartStatements({ status: '013' }, 'x', 'CFS', AT), null);
  assert.throws(() => parseDartStatements({ status: '020' }, 'x', 'CFS', AT), /DART_STATUS_020/);
});

test('fetch tries the latest year consolidated, then separate, then the year before; the key never leaks', async () => {
  const asked: string[] = [];
  const fake = (async (url: string | URL | Request) => {
    const u = new URL(String(url)); asked.push(`${u.searchParams.get('bsns_year')}:${u.searchParams.get('fs_div')}`);
    return new Response(JSON.stringify(u.searchParams.get('bsns_year') === '2024' && u.searchParams.get('fs_div') === 'OFS' ? DART_FS_FIXTURE : { status: '013' }));
  }) as typeof fetch;
  const st = await fetchDartStatements({ apiKey: 'secret', corpCode: '00164779', symbol: '000660', fetch: fake, now: () => AT });
  assert.deepEqual(asked, ['2025:CFS', '2025:OFS', '2024:CFS', '2024:OFS']);
  assert.equal(st?.basis, 'OFS');
  const bad = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
  await assert.rejects(fetchDartStatements({ apiKey: 'secret', corpCode: '1', symbol: 'x', fetch: bad }), (e: Error) => !e.message.includes('secret'));
});
