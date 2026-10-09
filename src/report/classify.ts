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
  // SEC EDGAR filings (G-179) carry the Korean titles edgar.ts gives them, so the form decides the kind.
  { pattern: /^(\[정정\] )?실적 발표 \(8-K/, category: '실적', importance: 'HIGH',
    why: '회사가 SEC에 낸 실적 발표(8-K 항목 2.02)예요. 시장 기대와 비교되면서 가격에 가장 직접 영향을 줘요.' },
  { pattern: /^(\[정정\] )?(분기보고서 \(10-Q|사업보고서 \(10-K|외국 기업 연차보고서 \()/, category: '정기보고서', importance: 'MEDIUM',
    why: 'SEC에 내는 정기 보고서예요. 실적 세부 내용과 위험 요인, 사업 현황이 들어 있어요.' },
  { pattern: /^(\[정정\] )?(주요 계약|자산 취득·처분|구조조정|자산 손상|재무제표 신뢰 불가|상장 기준 미달 통지|파산·법정관리|감사인 변경) \(8-K/, category: '주요사항', importance: 'HIGH',
    why: '회사 사업이나 재무 구조를 바꾸는 사건을 SEC에 알린 수시 보고(8-K)예요.' },
  { pattern: /^(\[정정\] )?((자금 조달·채무|비등록 증권 발행) \(8-K|증권 발행 (등록|설명서) \(|임직원 주식 등록 \()/, category: '자금조달', importance: 'MEDIUM',
    why: '주식이나 채권으로 돈을 조달하는 SEC 서류예요. 희석과 부채, 자금 사정을 보여줘요.' },
  { pattern: /^(\[정정\] )?5% 이상 보유 보고 \(SC 13D/, category: '지분', importance: 'MEDIUM',
    why: '5% 넘게 보유한 투자자가 경영 관여 의사를 밝힌 보고(13D)예요. 행동주의나 인수 시도의 신호일 수 있어요.' },
  { pattern: /^(\[정정\] )?(임원·주요주주 거래 보고 \(Form 4|5% 이상 보유 보고 \(SC 13G|제한 주식 매도 신고 \(Form 144)/, category: '지분', importance: 'LOW',
    why: '임원·주요주주나 큰 투자자의 지분이 바뀌었다는 보고예요. 규모가 크지 않으면 영향은 작아요.' },
  { pattern: /^(\[정정\] )?((임원 변동|정관 변경|주주총회 결과) \(8-K|주주총회 위임장)/, category: '지배구조', importance: 'LOW',
    why: '회사 운영과 의사결정 구조에 관한 SEC 서류예요.' },
  { pattern: /^(\[정정\] )?((Reg FD 공개|기타 사항|수시 보고) \(8-K|외국 기업 수시 보고 \(|(사업보고서|분기보고서) 지연 통지)/, category: '기타', importance: 'LOW',
    why: 'SEC 수시 보고예요. 발표 자료나 보도자료가 붙어 있는 경우가 많으니 원문을 확인해 주세요.' },
  { pattern: /영업\(잠정\)실적|매출액또는손익구조|잠정실적/, category: '실적', importance: 'HIGH',
    why: '회사가 직접 발표한 실적 숫자예요. 시장 기대와 비교되면서 가격에 가장 직접 영향을 줘요.' },
  { pattern: /자기주식/, category: '자사주', importance: 'HIGH',
    why: '자사주 매입·처분·소각 결정이에요. 주주환원과 유통 주식 수에 영향을 줘요.' },
  { pattern: /신규시설투자|유형자산|타법인주식/, category: '투자', importance: 'HIGH',
    why: '설비나 다른 회사에 대한 투자 결정이에요. 미래 생산능력과 현금흐름에 영향을 줘요.' },
  { pattern: /조회공시|풍문또는보도|해명/, category: '조회공시 답변', importance: 'MEDIUM',
    why: '언론 보도나 소문에 대해 거래소가 사실 여부를 물었고 회사가 답한 공시예요. "미확정"은 아직 정해진 것이 없다는 뜻이고, 정해지면 다시 공시해요.' },
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
  const base: { category: string; importance: Importance; why: string } = rule
    ? { category: rule.category, importance: rule.importance, why: rule.why }
    : { category: '기타', importance: 'LOW', why: '분류 규칙에 없는 공시예요. 원문을 확인해 주세요.' };
  // A confirmed answer to a rumour inquiry ("(확정)") is real news.
  if (base.category === '조회공시 답변' && /\(확정\)/.test(title)) base.importance = 'HIGH';
  return {
    ...base,
    // A correction re-states an earlier filing; it is rarely news on its own.
    importance: isCorrection && base.importance === 'HIGH' ? 'MEDIUM' : base.importance,
    why: isCorrection ? `이전 공시를 고친 것이에요. ${base.why}` : base.why,
    isCorrection,
  };
}
