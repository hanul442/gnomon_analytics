// Rule-based reading of a DART filing title: what kind of filing it is and
// why it can matter. Plain rules, so every label can be traced to a line here.

export type Importance = 'HIGH' | 'MEDIUM' | 'LOW';

export interface FilingReading {
  category: string;
  importance: Importance;
  why: string;
  isCorrection: boolean;
}

const RULES: readonly { pattern: RegExp; category: string; importance: Importance; why: string }[] = [
  { pattern: /영업\(잠정\)실적|매출액또는손익구조|잠정실적/, category: '실적', importance: 'HIGH',
    why: '회사가 직접 발표한 실적 숫자예요. 시장 기대와 비교되면서 가격에 가장 직접 영향을 줘요.' },
  { pattern: /자기주식/, category: '자사주', importance: 'HIGH',
    why: '자사주 매입·처분·소각 결정이에요. 주주환원과 유통 주식 수에 영향을 줘요.' },
  { pattern: /신규시설투자|유형자산|타법인주식/, category: '투자', importance: 'HIGH',
    why: '설비나 다른 회사에 대한 투자 결정이에요. 미래 생산능력과 현금흐름에 영향을 줘요.' },
  { pattern: /주요사항보고서/, category: '주요사항', importance: 'HIGH',
    why: '증자, 합병, 분할처럼 회사 구조를 바꾸는 결정을 알릴 때 내는 공시예요.' },
  { pattern: /사업보고서|반기보고서|분기보고서/, category: '정기보고서', importance: 'MEDIUM',
    why: '분기마다 내는 정기 보고서예요. 실적 세부 내용과 사업 현황이 들어 있어요.' },
  { pattern: /증권신고서|투자설명서|일괄신고|사채|증권발행/, category: '자금조달', importance: 'MEDIUM',
    why: '채권이나 주식으로 돈을 조달하는 공시예요. 부채와 자금 사정을 보여줘요.' },
  { pattern: /대량보유|소유상황|최대주주/, category: '지분', importance: 'LOW',
    why: '주요 주주나 임원의 지분이 바뀌었다는 공시예요. 규모가 크지 않으면 영향은 작아요.' },
  { pattern: /주주총회|이사회|대표이사|임원|정관/, category: '지배구조', importance: 'LOW',
    why: '회사 운영과 의사결정 구조에 관한 공시예요.' },
];

export function readFilingTitle(title: string): FilingReading {
  const isCorrection = /^\s*\[(기재정정|첨부정정|첨부추가|변경등록)\]/.test(title);
  const rule = RULES.find((candidate) => candidate.pattern.test(title));
  const base = rule
    ? { category: rule.category, importance: rule.importance, why: rule.why }
    : { category: '기타', importance: 'LOW' as const, why: '분류 규칙에 없는 공시예요. 원문을 확인해 주세요.' };
  return {
    ...base,
    // A correction re-states an earlier filing; it is rarely news on its own.
    importance: isCorrection && base.importance === 'HIGH' ? 'MEDIUM' : base.importance,
    why: isCorrection ? `이전 공시를 고친 것이에요. ${base.why}` : base.why,
    isCorrection,
  };
}
