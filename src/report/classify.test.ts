import assert from 'node:assert/strict';
import test from 'node:test';
import { readFilingTitle } from './classify.js';

test('filing titles map to a category and importance', () => {
  const cases: [string, string, string][] = [
    ['연결재무제표기준영업(잠정)실적(공정공시)', '실적', 'HIGH'],
    ['주요사항보고서(자기주식취득결정)', '자사주', 'HIGH'],
    ['신규시설투자등', '투자', 'HIGH'],
    ['분기보고서 (2026.09)', '정기보고서', 'MEDIUM'],
    ['임원ㆍ주요주주특정증권등소유상황보고서', '지분', 'LOW'],
    ['기업설명회(IR)개최(안내공시)', '기타', 'LOW'],
    // Real titles from the first live collection (2026-10-03).
    ['조회공시요구(풍문또는보도)에대한답변(미확정)', '조회공시 답변', 'MEDIUM'],
    ['풍문또는보도에대한해명(미확정)', '조회공시 답변', 'MEDIUM'],
    ['조회공시요구(풍문또는보도)에대한답변(확정)', '조회공시 답변', 'HIGH'],
  ];
  for (const [title, category, importance] of cases) {
    const reading = readFilingTitle(title);
    assert.deepEqual([reading.category, reading.importance], [category, importance], title);
  }
});

test('a correction is flagged and not treated as top news', () => {
  const reading = readFilingTitle('[기재정정]연결재무제표기준영업(잠정)실적(공정공시)');
  assert.equal(reading.isCorrection, true);
  assert.equal(reading.importance, 'MEDIUM');
  assert.match(reading.why, /^이전 공시를 고친 것이에요/);
});
