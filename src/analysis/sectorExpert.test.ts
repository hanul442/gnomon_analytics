import assert from 'node:assert/strict';
import test from 'node:test';
import { companyEvidence, expertBrief, sectorExpertOf, type CompanyBrief } from './sectorExpert.js';

const card = (sector: string | null, extra: Partial<CompanyBrief> = {}): CompanyBrief => ({ sector, summary: [], at: '2026-10-18T00:00:00Z', ...extra });

test('the specialist follows the WICS sector first, then the industry, the name and the business (G-242)', () => {
  assert.equal(sectorExpertOf({ name: 'SK하이닉스', company: card('반도체와반도체장비') })?.name, '반도체 전문위원');
  assert.equal(sectorExpertOf({ name: '셀트리온', company: card('제약') })?.key, 'bio');
  assert.equal(sectorExpertOf({ name: 'KB금융', company: card('은행') })?.key, 'bank');
  assert.equal(sectorExpertOf({ name: '미래에셋증권', company: card('증권') })?.key, 'finance');
  assert.equal(sectorExpertOf({ name: '한화에어로스페이스', company: card('우주항공과국방') })?.key, 'defense');
  assert.equal(sectorExpertOf({ name: 'HD현대중공업', company: card('조선') })?.key, 'ship');
  assert.equal(sectorExpertOf({ name: '가나', company: card(null, { industry: '화장품' }) })?.key, 'consumer');
  // No card: the name; then the business summary and sales mix.
  assert.equal(sectorExpertOf({ name: '알테오젠바이오' })?.key, 'bio');
  assert.equal(sectorExpertOf({ name: '에코프로', company: card(null, { mix: { asOf: null, items: [['양극재', 90]] } }) })?.key, 'battery');
  assert.equal(sectorExpertOf({ name: 'SK하이닉스' }), null, 'nothing says what it does: no specialist');
  // ETFs, coins and US stocks get their own.
  assert.equal(sectorExpertOf({ name: 'KODEX 200', kind: 'etf' })?.key, 'etf');
  assert.equal(sectorExpertOf({ name: '비트코인', kind: 'coin' })?.key, 'coin');
  assert.equal(sectorExpertOf({ name: '엔비디아', currency: 'USD' })?.key, 'us_tech');
  assert.equal(sectorExpertOf({ name: '코카콜라', currency: 'USD' })?.key, 'us');
});

test('Z1 says what the company does; the brief lists the industry KPIs and forbids guessing missing ones', () => {
  assert.equal(companyEvidence({}), null);
  const z = companyEvidence({ company: card('반도체와반도체장비', { industry: '반도체', summary: ['메모리 반도체를 만들어요.'], mix: { asOf: '2026-06', items: [['DRAM', 70], ['NAND', 30]] } }) })!;
  assert.equal(z.id, 'Z1');
  assert.match(z.detail, /WICS 반도체와반도체장비/);
  assert.match(z.detail, /DRAM 70%, NAND 30%/);
  const brief = expertBrief(sectorExpertOf({ name: 'x', company: card('은행') })!);
  assert.match(brief, /^은행 전문위원이에요/);
  assert.match(brief, /순이자마진/);
  assert.match(brief, /추측하지 않아요/);
});
