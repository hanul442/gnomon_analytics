// G-242: the committee's seventh seat, a specialist in the stock's own industry. The six analysts read every stock
// through the same lenses (trend, reversion, structure, flow, value, events); none of them knows that a chipmaker
// moves on memory prices and inventories while a bank moves on its margin and bad loans. The specialist is picked
// from the stock's WICS sector (or its kind, or its name when the sector is unknown), reads the company's own
// business (Z1) next to its numbers and news, and judges alone like the other analysts: same horizon, same lock,
// same scoring. It is the same seat for every reader (no per-user advice). Pure.

import type { DailyReport } from '../report/dailyReport.js';
import type { EvidenceItem } from './commentary.js';

export interface SectorExpert {
  /** Which specialist (semis, bio, bank, …). */
  key: string;
  /** Shown name, e.g. '반도체 전문위원'. */
  name: string;
  /** One line on what it looks at. */
  focus: string;
  /** What usually moves stocks in this industry; the specialist checks these against the evidence and says which are missing. */
  kpis: readonly string[];
}

/** G-242: what the daily run keeps of the company card (src/sources/companyProfile.ts) for the specialist. */
export interface CompanyBrief {
  /** WICS sector, e.g. 반도체와반도체장비. */
  sector: string | null;
  /** Naver industry name. */
  industry?: string | null;
  summary: string[];
  mix?: { asOf: string | null; items: [string, number][] } | null;
  at: string;
}

type Spec = Omit<SectorExpert, 'key'> & { words: RegExp };

/** Order matters: the first match wins (semis before electronics, banks before the rest of finance). */
export const SECTOR_SPECS: Record<string, Spec> = {
  semis: { name: '반도체 전문위원', focus: '메모리 가격, 재고, 고객사 설비투자, HBM', words: /반도체|HBM|메모리|파운드리|웨이퍼/,
    kpis: ['D램·낸드 가격 흐름', '재고 수준(고객사·자사)', '고객사 설비투자(빅테크·파운드리)', 'HBM·AI 서버용 비중과 수주', '가동률과 업황 사이클 위치'] },
  battery: { name: '2차전지 전문위원', focus: '리튬·니켈 가격, 전기차 수요, 수주잔고', words: /2차\s*전지|이차전지|배터리|양극재|음극재|전해질|분리막|리튬/,
    kpis: ['리튬·니켈 등 메탈 가격(판가 연동)', '전기차 판매와 고객사 재고', '수주잔고와 신규 공급 계약', '미국 생산 세액공제(AMPC) 반영', '공장 가동률'] },
  bio: { name: '바이오·제약 전문위원', focus: '임상 일정, 기술이전, 허가, 현금 소진', words: /제약|생물공학|바이오|신약|헬스케어|건강관리|의료|진단/,
    kpis: ['임상 단계와 결과 발표 일정', '기술이전 계약(선급금·마일스톤)', '품목 허가·출시', '현금 소진 속도와 자금 조달(유상증자·전환사채)', '주력 품목 매출'] },
  auto: { name: '자동차 전문위원', focus: '판매 대수, 환율, 관세, 차종 구성', words: /자동차|타이어|완성차/,
    kpis: ['월별 판매 대수(국내·해외)', '원/달러 환율', '미국 관세와 현지 생산', '인센티브(판촉비)', '차종 구성(SUV·하이브리드·전기차)'] },
  ship: { name: '조선 전문위원', focus: '수주잔고, 선가, 후판 가격', words: /조선|선박|해양플랜트|중공업/,
    kpis: ['신규 수주와 수주잔고(몇 년 치 일감)', '신조선가 흐름과 실적 반영 시차', '후판(강재) 가격', 'LNG선·친환경선 비중', '인력·공정 지연'] },
  defense: { name: '방산·우주 전문위원', focus: '수출 계약, 수주잔고, 인도 일정', words: /방산|방위|국방|우주항공|항공우주|무기/,
    kpis: ['수출 계약 공시(국가·금액·기간)', '수주잔고', '인도·매출 인식 일정', '국방 예산과 지정학 이벤트'] },
  bank: { name: '은행 전문위원', focus: '순이자마진, 대손비용, 자본비율, 주주환원', words: /은행|금융지주/,
    kpis: ['순이자마진(NIM)과 금리 방향', '대출 성장', '대손비용·연체율', '자본비율(CET1)', '배당·자사주 등 주주환원과 PBR'] },
  finance: { name: '금융 전문위원', focus: '거래대금, 손해율, 금리, 주주환원', words: /증권|보험|카드|캐피탈|금융|자산운용/,
    kpis: ['증시 거래대금(증권)', '손해율·보험계약마진(보험)', '금리 방향과 채권 평가손익', '배당·자사주 등 주주환원과 PBR'] },
  internet: { name: '인터넷·게임 전문위원', focus: '신작·서비스 성과, 이용자, 광고·커머스, 비용', words: /소프트웨어|인터넷|양방향미디어|게임|플랫폼|포털|IT서비스/,
    kpis: ['신작·업데이트 일정과 흥행(순위·매출)', '이용자 수와 결제', '광고·커머스 성장', '인건비·마케팅비', 'AI·클라우드 투자'] },
  chem: { name: '화학·정유 전문위원', focus: '제품 스프레드, 유가, 중국 증설', words: /화학|석유|정유|가스|에너지|태양광|수소|플라스틱/,
    kpis: ['제품 가격과 원료 가격의 차이(스프레드)', '국제 유가', '중국 증설·수요', '가동률', '재고평가 손익'] },
  steel: { name: '철강·소재 전문위원', focus: '제품가와 원재료, 중국 수출, 전방 수요', words: /철강|비철|금속|시멘트|건축자재|제지|종이|목재|유리/,
    kpis: ['제품 가격과 원재료(철광석·석탄 등) 가격', '중국 수출·감산', '전방 수요(건설·조선·자동차)', '환율'] },
  consumer: { name: '소비재 전문위원', focus: '중국·면세·수출 수요, 원가, 판가', words: /화장품|식품|음료|주류|의류|섬유|패션|유통|백화점|상점|호텔|레저|면세|담배|가정용품|홈쇼핑/,
    kpis: ['중국·면세·관광 수요', '미국 등 수출 성장', '원재료 원가(곡물·원료)', '판가 인상', '소비심리'] },
  build: { name: '건설 전문위원', focus: '수주·분양, 원가율, 미분양, PF', words: /건설|건축|주택|엔지니어링|부동산/,
    kpis: ['신규 수주와 분양 실적', '원가율(공사비)', '미분양', '부동산 PF 우발채무', '해외 수주'] },
  media: { name: '통신·미디어 전문위원', focus: '가입자·요금, 컴백·투어, 콘텐츠 판매', words: /통신|미디어|방송|엔터|광고|출판|영화|음악|콘텐츠/,
    kpis: ['가입자와 1인당 매출(통신)', '아티스트 컴백·투어 일정(엔터)', '콘텐츠 판매·방영 일정', '배당'] },
  utility: { name: '전력·유틸리티 전문위원', focus: '요금·연료비, 원전·전력망, 정책', words: /유틸리티|전력|원자력|원전|발전/,
    kpis: ['전기·가스 요금과 연료비 연동', '원전·전력망 수주', '정부 에너지 정책', '배당'] },
  transport: { name: '운송 전문위원', focus: '운임, 유가, 여객·화물 수요', words: /항공사|항공|해운|운송|물류|택배|도로와철도/,
    kpis: ['운임 지수(컨테이너·벌크)', '유가(연료비)', '여객·화물 수요', '환율'] },
  machine: { name: '전기·전자·기계 전문위원', focus: '수주, 전방 설비투자, 환율, 원자재', words: /기계|전기장비|전자장비|전기제품|전자제품|디스플레이|전자|부품|장비|로봇|변압기|전선/,
    kpis: ['수주·수주잔고', '전방 산업의 설비투자', '가동률', '환율과 원자재 가격'] },
  holding: { name: '지주회사 전문위원', focus: '자회사 가치 대비 할인, 배당, 지배구조', words: /지주|복합기업|홀딩스/,
    kpis: ['자회사 지분 가치 대비 할인율', '배당·자사주', '지배구조 변화(합병·분할·상속)', '주요 자회사 실적'] },
};

const ETF: Omit<SectorExpert, 'key'> = { name: 'ETF 전문위원', focus: '기초지수·테마 흐름, 거래대금, 레버리지·인버스 구조',
  kpis: ['기초지수·테마의 흐름(이름에서 읽히는 대상)', '거래대금과 유동성', '레버리지·인버스면 매일 재조정되는 구조의 손실', '해외 지수면 환율'] };
const COIN: Omit<SectorExpert, 'key'> = { name: '가상자산 전문위원', focus: '비트코인 대비 흐름, 거래대금, 규제·상장 뉴스',
  kpis: ['비트코인 대비 상대 흐름', '거래대금 급증·급감', '규제·상장·상장폐지 뉴스', '미국 금리·달러 등 위험자산 분위기'] };
const US_TECH: Omit<SectorExpert, 'key'> = { name: '미국 빅테크 전문위원', focus: 'AI·클라우드 매출, 설비투자, 가이던스, 규제',
  kpis: ['AI·클라우드 매출 성장', '설비투자(데이터센터) 규모', '다음 분기 가이던스', '반독점·규제 이슈', '자사주 매입'] };
const US_BIG_TECH = /애플|마이크로소프트|엔비디아|알파벳|구글|아마존|메타|테슬라|브로드컴|넷플릭스|Apple|Microsoft|NVIDIA|Alphabet|Amazon|Meta|Tesla|Broadcom|Netflix/i;
const US_GENERIC: Omit<SectorExpert, 'key'> = { name: '미국 주식 전문위원', focus: '실적·가이던스, 내부자 거래, 미국 금리',
  kpis: ['분기 실적과 다음 분기 가이던스', '실적 발표 일정', '내부자 거래(Form 4)와 자사주', '미국 금리·달러'] };

const match = (text: string | null | undefined): string | null => {
  if (!text) return null;
  for (const [key, s] of Object.entries(SECTOR_SPECS)) if (s.words.test(text)) return key;
  return null;
};

/**
 * The specialist for this report's stock, or null when nothing says what the company does. The WICS sector decides
 * first, then the Naver industry, then the stock's name, then its business summary and sales mix.
 */
export function sectorExpertOf(report: Pick<DailyReport, 'kind' | 'currency' | 'name' | 'company'>): SectorExpert | null {
  if (report.kind === 'coin') return { key: 'coin', ...COIN };
  if (report.kind === 'etf') return { key: 'etf', ...ETF };
  const c = report.company;
  const key = match(c?.sector) ?? match(c?.industry) ?? match(report.name) ?? match([...(c?.mix?.items ?? []).map(([n]) => n), ...(c?.summary ?? [])].join(' '));
  if (report.currency === 'USD') {
    if (US_BIG_TECH.test(report.name)) return { key: 'us_tech', ...US_TECH };
    if (!key) return { key: 'us', ...US_GENERIC };
  }
  if (!key) return null;
  const { words: _w, ...spec } = SECTOR_SPECS[key]!;
  return { key, ...spec };
}

/** Z1: what the company does, from its card. Null without one. */
export function companyEvidence(report: Pick<DailyReport, 'company'>): EvidenceItem | null {
  const c = report.company;
  if (!c || (!c.sector && !c.summary.length && !c.mix?.items.length)) return null;
  const parts: string[] = [];
  if (c.sector || c.industry) parts.push(`업종: ${[c.sector && `WICS ${c.sector}`, c.industry && `네이버 ${c.industry}`].filter(Boolean).join(', ')}.`);
  if (c.summary.length) parts.push(`사업: ${c.summary.slice(0, 3).join(' ').slice(0, 360)}`);
  if (c.mix?.items.length) parts.push(`주요 제품 매출 구성${c.mix.asOf ? `(${c.mix.asOf})` : ''}: ${c.mix.items.slice(0, 6).map(([n, p]) => `${n} ${p}%`).join(', ')}.`);
  return { id: 'Z1', kind: 'COMPANY', label: '회사 사업·업종', url: '#tab-fundamentals', detail: parts.join(' ') };
}

/** How the specialist is introduced (to its own call and to the committee). */
export const expertBrief = (x: SectorExpert) => `${x.name}이에요. 보는 것: ${x.focus}. 이 업종 주가를 보통 움직이는 지표: ${x.kpis.join('; ')}. 이 지표 가운데 근거 목록에 있는 것만 판단에 쓰고, 없는 지표는 없다고 짧게 밝히며 추측하지 않아요.`;
