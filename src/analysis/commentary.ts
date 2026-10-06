// AI commentary for the "왜?" section (docs/DESIGN.md §4.4, decision G-9).
//
// Claude reads only that day's report evidence, each item tagged with an ID
// (P1 price, T1 technical signal, F* filings, N* news stories), and returns
// structured JSON. Every claim must cite IDs from that list; claims whose IDs
// are all unknown are dropped and counted. A failure never stops the report:
// it is stored as status FAILED and the page says "AI 해설 없음".

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { DailyReport } from '../report/dailyReport.js';
import { ANALYSTS, ANALYST_HORIZON, type AnalystId } from './analysts.js';

export const COMMENTARY_MODEL = 'claude-opus-5-5';
/** Weekly picks outside the top tier (G-28): a short summary only, on the small model. */
export const BRIEF_MODEL = 'claude-haiku-4-5';
export type CommentaryTier = 'deep' | 'brief';
/** v3 (G-42): every claim says whether it is a fact from the evidence, an inference, or an assumption. */
export const COMMENTARY_PROMPT_VERSION = 'gnm-committee-v6';
const MAX_FILINGS = 15;
const MAX_NEWS = 30;

export interface EvidenceItem {
  id: string;
  kind: 'PRICE' | 'TECHNICAL' | 'FILING' | 'NEWS' | 'HORIZON' | 'VALUE' | 'FORECAST' | 'STRUCTURE' | 'FLOW' | 'FUNDAMENTAL' | 'MARKET' | 'ARENA' | 'EVENT';
  label: string;
  detail: string;
  url: string;
}

export type ClaimKind = 'FACT' | 'INFERENCE' | 'ASSUMPTION';
export interface Claim {
  text: string;
  evidenceIds: string[];
  /** Absent in commentary made before prompt v3. */
  kind?: ClaimKind;
}

export type Desk = 'MARKET' | 'TECHNICAL' | 'FLOW' | 'FUNDAMENTAL' | 'EVENT';
export type DeskStance = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'INSUFFICIENT_DATA';
export interface DeskView { desk: Desk; stance: DeskStance; view: Claim }
export interface AnalystView { analyst: AnalystId; stance: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; confidence: number; target: number; rationale: Claim }
/** `probability`: the committee's estimate for this scenario now, % (the three sum to 100; G-60). Logged and scored later. */
/** v6 (G-65): `trigger` is the price whose crossing would start this scenario (BULL above, BEAR below); `zone` the price range it would likely reach in about 20 sessions. */
export interface Scenario { kind: 'BULL' | 'BASE' | 'BEAR'; narrative: Claim; catalysts: string[]; invalidation: string[]; probability?: number; trigger?: number; zone?: [number, number] }
/** Who can speak in the debate: the committee's own members (analysts, desks) and the red team. */
export type Speaker = AnalystId | Desk | 'RED_TEAM';
/** A debate turn (v4): a committee member argues from its own stance, answering an earlier turn; the red team closes. */
/** Where a debate turn points: an earlier turn (0-based); a 1-based pointer (≥ own index) is shifted down one. */
export function replyIndex(to: number | undefined, i: number): number | undefined {
  if (to == null || !Number.isInteger(to)) return undefined;
  const t = to >= i ? to - 1 : to;
  return t >= 0 && t < i ? t : undefined;
}

export interface DebateTurn { speaker: Speaker; stance: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; replyTo?: number; claim: Claim }
/** Where a short AI line sits: at the top of that report tab. */
export type InsightKey = 'technical' | 'strategy' | 'flow' | 'fundamental' | 'news';

export interface Commentary {
  status: 'OK' | 'FAILED' | 'SKIPPED';
  model: string;
  promptVersion: string;
  generatedAt: string;
  /** Model that actually answered (differs when a server-side fallback ran). */
  servedBy?: string;
  tier?: CommentaryTier;
  /** Tokens billed, for cost tracking. */
  usage?: { inputTokens: number; outputTokens: number };
  summary?: Claim;
  bullish: Claim[];
  bearish: Claim[];
  uncertain: Claim[];
  /** What would change the reading (invalidation / things to watch). */
  watch: Claim[];
  dataGaps: string[];
  /** Committee (C단계): one view per desk, the red team's strongest objection, three scenarios. */
  desks?: DeskView[];
  redTeam?: { counterargument: Claim; unresolved: string[] };
  scenarios?: Scenario[];
  /** v4: bull and bear answer each other in turns, then a moderator closes (committee only). */
  debate?: DebateTurn[];
  /** v4: the worst plausible case and the checks a reader should make (not orders). */
  worstCase?: { narrative: Claim; checks: string[] };
  /** v4: one line per report tab. */
  insights?: Partial<Record<InsightKey, Claim>>;
  /** Analyst battle: each analyst's stance, confidence and 20-session target (scored later). */
  analysts?: AnalystView[];
  /** Claims removed because none of their evidence IDs existed. */
  dropped: number;
  evidence: EvidenceItem[];
  error?: string;
  /** G-61: the full commentary, encrypted (src/report/seal.ts); the fields above are then the public part. */
  sealed?: string;
}

export const LOCKED_TEXT = '심층 리포트를 열면 볼 수 있어요.';

/**
 * The public part of a committee commentary (G-61): the conclusion, each desk's and analyst's stance,
 * analysts' targets (logged and scored in the open anyway), the red team's first sentence, scenario
 * kinds and probabilities, one point a side and the tab one-liners. Reasons, the debate, scenario
 * narratives, the worst case and the rest of the evidence lists are left for the sealed part.
 * A brief, or a commentary that is not OK, is returned as it is.
 */
export function publicCommentary(c: Commentary): Commentary {
  if (c.status !== 'OK' || c.tier === 'brief') return c;
  const lock = (claim: Claim): Claim => ({ text: LOCKED_TEXT, evidenceIds: [], ...(claim.kind ? { kind: claim.kind } : {}) });
  const { debate: _d, worstCase: _w, sealed: _s, ...rest } = c;
  return {
    ...rest,
    bullish: c.bullish.slice(0, 1), bearish: c.bearish.slice(0, 1), uncertain: [], watch: [],
    ...(c.desks ? { desks: c.desks.map((d) => ({ ...d, view: lock(d.view) })) } : {}),
    ...(c.analysts ? { analysts: c.analysts.map((a) => ({ ...a, rationale: lock(a.rationale) })) } : {}),
    ...(c.redTeam ? { redTeam: { counterargument: { ...c.redTeam.counterargument, text: c.redTeam.counterargument.text.split(/(?<=[.?!요])\s/)[0] ?? '' }, unresolved: [] } } : {}),
    ...(c.scenarios ? { scenarios: c.scenarios.map((s) => ({ kind: s.kind, narrative: lock(s.narrative), catalysts: [], invalidation: [], ...(s.probability !== undefined ? { probability: s.probability } : {}), ...(s.trigger !== undefined ? { trigger: s.trigger } : {}), ...(s.zone ? { zone: s.zone } : {}) })) } : {}),
  };
}

const won = (v: number) => `${Math.round(v).toLocaleString('ko-KR')}원`;
const pct = (v: number | null | undefined) => (v == null ? '없음' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`);

/** The numbered evidence list Claude may cite; built only from the report itself. */
export function buildEvidence(report: DailyReport): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const p = report.price;
  if (p) {
    items.push({
      id: 'P1', kind: 'PRICE', label: `${p.sessionDate ?? report.date} 가격`, url: '#kpis',
      detail: `종가 ${won(p.close)}, 전일 대비 ${pct(p.changePct)}, 5거래일 ${pct(p.return5dPct)}, 20거래일 ${pct(p.return20dPct)}, `
        + `거래량 20일 평균 대비 ${p.volumeRatio20 == null ? '없음' : `${p.volumeRatio20.toFixed(2)}배`}, 20일 범위 ${won(p.low20)}~${won(p.high20)}`,
    });
  }
  const t = report.technicals;
  if (t) {
    const momentum = (report.momentum ?? []).map((m) => `${m.label} ${m.trend ?? '기록 부족'}(${pct(m.returnPct)})`).join(', ');
    items.push({
      id: 'T1', kind: 'TECHNICAL', label: `기술적 신호 ${t.label}`, url: '#signal',
      detail: `${t.label}${t.score == null ? '' : ` (점수 ${t.score.toFixed(2)})`}, 강세 ${t.counts.bullish}·중립 ${t.counts.neutral}·약세 ${t.counts.bearish}·계산 불가 ${t.counts.abstained}. 모멘텀: ${momentum}. ${report.technicalReason ?? ''}`,
    });
  }
  const m = report.market;
  if (m) {
    items.push({ id: 'H1', kind: 'HORIZON', label: '기간별 신호', url: '#horizons',
      detail: m.horizons.map((h) => `${h.label}(${h.barLabel}) ${h.summary.label}${h.summary.score === null ? '' : ` ${h.summary.score.toFixed(2)}`}`).join(', ') });
    if (m.fairValue) {
      const fv = m.fairValue;
      items.push({ id: 'V1', kind: 'VALUE', label: '기술적 적정가', url: '#value',
        detail: `중심 ${won(fv.center)}, 범위 ${won(fv.low)}~${won(fv.high)}, 현재가 괴리 ${pct(fv.gapPct)} (${fv.position === 'ABOVE' ? '범위 위' : fv.position === 'BELOW' ? '범위 아래' : '범위 안'}). 기준값: ${fv.anchors.map((a) => `${a.label} ${won(a.value)}`).join(', ')}` });
    }
    if (m.forecasts.length) {
      items.push({ id: 'R1', kind: 'FORECAST', label: '예측 범위', url: '#forecast',
        detail: `${m.forecasts.map((f) => `${f.horizon}거래일 하단 ${won(f.p10)} 중앙 ${won(f.p50)} 상단 ${won(f.p90)}`).join('; ')}. 지난 예측 채점: ${m.forecastScores.map((sc) => `${sc.horizon}일 ${sc.scored ? `${Math.round(sc.coverage! * 100)}%(${sc.scored}건)` : '없음'}`).join(', ')}` });
    }
    if (m.structure) {
      const st = m.structure, b = st.breaks.at(-1);
      items.push({ id: 'S1', kind: 'STRUCTURE', label: '가격 구조', url: '#structure',
        detail: `일봉 ${st.bias}, 주봉 ${m.weeklyStructure?.bias ?? '없음'}; 최근 돌파 ${b ? `${b.date} ${b.type} ${b.direction} (스윙 ${won(b.brokenSwing.price)})` : '없음'}; 피보나치 ${st.fibonacci?.retracement != null ? `${(st.fibonacci.retracement * 100).toFixed(1)}%` : '없음'}; 지지·저항 ${st.levels.map((l) => `${l.kind === 'SUPPORT' ? '지지' : '저항'} ${won(l.price)}`).join(', ')}; 볼린저 %B ${st.bollinger ? Math.round(st.bollinger.percentB * 100) : '없음'}` });
    }
    if (m.flows) {
      const eok = (v: number | null | undefined) => (v == null ? '' : `(약 ${v > 0 ? '+' : ''}${(v / 1e8).toFixed(1)}억 원)`);
      const sums = m.flows.sums.map((x) => `${x.days}일 외국인 ${x.foreign ?? '없음'}주${eok(x.foreignValue)}, 기관 ${x.institution ?? '없음'}주${eok(x.institutionValue)}, 개인 ${x.individual ?? '없음'}주${eok(x.individualValue)}`).join('; ');
      items.push({ id: 'Q1', kind: 'FLOW', label: '투자자별 수급', url: '#tab-flows',
        detail: `${sums}. 외국인 보유율 20일 변화 ${m.flows.holdRatioChange20?.toFixed(2) ?? '없음'}%p. 수급 흔적 ${m.footprint.state} (점수 ${m.footprint.score}). ${m.footprint.reasons.join(' ')}` });
    }
    if (m.snapshot || m.quarters.length) {
      const s = m.snapshot, q = m.quarters.slice(-4);
      items.push({ id: 'D1', kind: 'FUNDAMENTAL', label: '밸류에이션·실적·증권가 평균', url: '#tab-fundamentals',
        detail: `${s ? `PER ${s.per ?? '없음'}, 추정 PER ${s.estimatedPer ?? '없음'}, PBR ${s.pbr ?? '없음'}, 증권가 평균 목표가 ${s.consensus?.targetPriceMean ? won(s.consensus.targetPriceMean) : '없음'}. ` : ''}분기 영업이익(억원): ${q.map((p) => `${p.period}${p.isEstimate ? '(추정)' : ''} ${p.metrics['영업이익'] ?? '없음'}`).join(', ')}` });
    }
    if (m.arena) {
      const a = m.arena;
      items.push({ id: 'A1', kind: 'ARENA', label: '전략 대결 (백테스트)', url: '#arena',
        detail: `${a.from}~${a.sessionDate}, 검증 구간 ${a.oosFrom}~. ${a.results.map((x) => `${x.rank}위 ${x.name}: 검증 수익 ${(x.oosReturn * 100).toFixed(1)}%, 샤프 ${x.oosSharpe?.toFixed(2) ?? '없음'}, 지금 ${x.key === 'hold' ? '기준선' : x.position ? '보유 신호' : '관망'}`).join('; ')}` });
    }
    if (m.benchmarks.length) {
      items.push({ id: 'M1', kind: 'MARKET', label: '시장 대비 수익률', url: '#tab-fundamentals',
        detail: m.benchmarks.map((b) => `${b.name}: ${b.returns.map((x) => `${x.days}일 종목 ${pct(x.stock)} vs ${pct(x.benchmark)}`).join(', ')}`).join('; ') });
    }
  }
  // G-99: the facts most readers miss (insider and 5% holder moves, surprises, buybacks, contracts, value surges).
  (report.edge?.highlights ?? []).forEach((h, i) => {
    items.push({ id: `E${i + 1}`, kind: 'EVENT', label: '놓치기 쉬운 정보', url: '#tab-news', detail: h.text });
  });
  (report.recentFilings ?? report.filings).slice(0, MAX_FILINGS).forEach((f, i) => {
    items.push({ id: `F${i + 1}`, kind: 'FILING', label: f.title, url: f.url, detail: `${f.filedDate} 공시, 종류 ${f.category}, 중요도 ${f.importance}, 제출 ${f.filer}. ${f.why}` });
  });
  (report.news?.clusters ?? []).slice(0, MAX_NEWS).forEach((c, i) => {
    items.push({ id: `N${i + 1}`, kind: 'NEWS', label: c.title, url: c.url, detail: `${c.firstAt} ${c.publisher} 보도, 종류 ${c.category}, 중요도 ${c.importance}, 같은 내용 기사 ${c.articles.length}건` });
  });
  return items;
}

const ClaimSchema = z.object({
  text: z.string().describe('한국어 한두 문장'),
  evidenceIds: z.array(z.string()).describe('근거 목록의 ID만 (예: P1, T1, F2, N3)'),
  kind: z.enum(['FACT', 'INFERENCE', 'ASSUMPTION']).describe('FACT 근거에 그대로 있는 사실, INFERENCE 근거에서 끌어낸 해석, ASSUMPTION 근거로 확인되지 않은 가정'),
});

const DeskSchema = z.object({
  desk: z.enum(['MARKET', 'TECHNICAL', 'FLOW', 'FUNDAMENTAL', 'EVENT']).describe('MARKET 시장·상대강도, TECHNICAL 기술·구조, FLOW 수급, FUNDAMENTAL 실적·밸류에이션, EVENT 공시·뉴스'),
  stance: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL', 'INSUFFICIENT_DATA']),
  view: ClaimSchema.describe('이 데스크의 판단 한두 문장'),
});

const ScenarioSchema = z.object({
  kind: z.enum(['BULL', 'BASE', 'BEAR']),
  narrative: ClaimSchema.describe('이 시나리오가 어떻게 전개되는지 한두 문장'),
  catalysts: z.array(z.string()).describe('이 시나리오를 앞당길 일'),
  invalidation: z.array(z.string()).describe('이 시나리오가 틀렸다고 볼 조건(가격 수준이나 사건)'),
  probability: z.number().describe('지금 근거로 본 이 시나리오의 확률(%) 추정. 세 시나리오의 합이 100이 되게 정수로'),
  trigger: z.number().describe('이 시나리오가 시작된다고 볼 테스트 가격(원). BULL은 넘어서야 할 가격(위쪽), BEAR는 아래로 이탈하면 약세 전개를 검토하는 가격(아래쪽), BASE는 0. 근거의 지지·저항·구조 가격에서 고릅니다'),
  zoneLow: z.number().describe('이 시나리오대로 가면 20거래일 안에 있을 만한 가격대의 아래 끝(원). 시나리오 가격대일 뿐 목표가가 아닙니다'),
  zoneHigh: z.number().describe('그 가격대의 위 끝(원)'),
});

const InsightsSchema = z.object({
  technical: ClaimSchema.describe('기술 분석 탭 맨 위에 붙일 한 줄: 지표·기간별 신호·가격 구조에서 지금 가장 중요한 것'),
  strategy: ClaimSchema.describe('전략 탭 한 줄: 전략 대결 결과에서 읽을 점'),
  flow: ClaimSchema.describe('수급 탭 한 줄: 외국인·기관 흐름에서 읽을 점'),
  fundamental: ClaimSchema.describe('펀더멘털 탭 한 줄: 실적·밸류에이션에서 읽을 점'),
  news: ClaimSchema.describe('뉴스·공시 탭 한 줄: 이번 주 가장 중요한 공시·뉴스와 그 의미'),
}).partial().describe('탭마다 한 줄. 근거가 없는 탭은 비워 둡니다');

const DebateSchema = z.array(z.object({
  speaker: z.enum([...ANALYSTS.map((a) => a.id), 'MARKET', 'TECHNICAL', 'FLOW', 'FUNDAMENTAL', 'EVENT', 'RED_TEAM'] as unknown as [Speaker, ...Speaker[]]).describe('말하는 위원: 분석가 6명, 데스크 5곳, 또는 RED_TEAM'),
  stance: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']).describe('이 위원의 입장. 위의 analysts·desks에 쓴 입장과 같아야 합니다'),
  replyTo: z.number().optional().describe('반박하는 앞 차례의 번호. 0부터 셉니다(첫 차례가 0, 바로 앞 차례에 답하면 자기 번호-1). 첫 차례와 RED_TEAM은 비웁니다'),
  claim: ClaimSchema.describe('이 차례의 말 한두 문장. 두 번째 차례부터는 replyTo 차례의 주장을 직접 짚어 반박합니다'),
})).describe('5~7차례. 입장이 다른 위원들이 번갈아 말하고, 마지막은 RED_TEAM');

const WorstCaseSchema = z.object({
  narrative: ClaimSchema.describe('근거로 그릴 수 있는 가장 나쁜 전개 한두 문장'),
  checks: z.array(z.string()).describe('읽는 사람이 스스로 점검할 위험 관리 항목 2~4개 (예: 무효화 가격 확인, 한 종목 비중 점검, 다음 실적 발표일 확인). 매수·매도 지시가 아닙니다'),
});

export const CommentarySchema = z.object({
  summary: ClaimSchema.describe('오늘 무슨 일이 있었고 왜 중요한지 2~3문장 요약'),
  desks: z.array(DeskSchema).describe('데스크 5곳(MARKET, TECHNICAL, FLOW, FUNDAMENTAL, EVENT) 각각 하나씩'),
  redTeam: z.object({
    counterargument: ClaimSchema.describe('가장 우세한 의견에 대한 가장 강한 반론'),
    unresolved: z.array(z.string()).describe('데스크끼리 풀리지 않은 이견'),
  }),
  scenarios: z.array(ScenarioSchema).describe('BULL, BASE, BEAR 정확히 하나씩'),
  analysts: z.array(z.object({
    analyst: z.enum(ANALYSTS.map((a) => a.id) as [AnalystId, ...AnalystId[]]),
    stance: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']),
    confidence: z.number().describe('0~100'),
    target: z.number().describe(`P1 종가 기준 ${ANALYST_HORIZON}거래일 뒤 예상 가격(원)`),
    rationale: ClaimSchema.describe('이 분석가의 근거 한두 문장'),
  })).describe('분석가 6명 각각 하나씩'),
  debate: DebateSchema,
  worstCase: WorstCaseSchema,
  insights: InsightsSchema,
  bullish: z.array(ClaimSchema).describe('강세 쪽 근거. 없으면 빈 배열'),
  bearish: z.array(ClaimSchema).describe('약세 쪽 근거. 없으면 빈 배열'),
  uncertain: z.array(ClaimSchema).describe('방향이 불확실하거나 해석이 갈리는 점'),
  watch: z.array(ClaimSchema).describe('앞으로 무엇이 나오면 판단이 바뀌는지 (무효화 조건, 지켜볼 일정)'),
  dataGaps: z.array(z.string()).describe('근거가 부족해서 판단할 수 없는 부분'),
});

/** The brief: summary, both sides and what to watch. No desks, analysts or scenarios. */
export const BriefSchema = z.object({
  summary: CommentarySchema.shape.summary,
  bullish: CommentarySchema.shape.bullish,
  bearish: CommentarySchema.shape.bearish,
  uncertain: CommentarySchema.shape.uncertain,
  watch: CommentarySchema.shape.watch,
  dataGaps: CommentarySchema.shape.dataGaps,
  insights: InsightsSchema,
});

/** Required wire fields avoid exponential optional-field grammar expansion. Local validation stays compatible with older reports. */
export const WireInsightsSchema = InsightsSchema.required();
export const CommentaryWireSchema = CommentarySchema.extend({
  insights: WireInsightsSchema.describe('모든 탭의 필드를 반환. 근거가 없는 탭은 text를 빈 문자열, evidenceIds를 빈 배열, kind를 INFERENCE로 반환'),
  debate: z.array(DebateSchema.element.extend({
    replyTo: z.number().describe('반박하는 앞 차례 번호. 답장 대상이 없는 첫 차례와 RED_TEAM은 -1'),
  })),
});
export const BriefWireSchema = BriefSchema.extend({ insights: WireInsightsSchema.describe('근거가 없는 탭도 빈 text·evidenceIds와 INFERENCE kind로 반환') });

/**
 * G-102: the deep committee's schema is too big for constrained decoding ("compiled grammar is too large"), so the
 * deep call asks for JSON in words and this repairs the small slips models make (an unknown enum, a number as text,
 * a missing list) before the strict schema check. Anything it cannot repair is dropped, never invented.
 */
const DEEP_SCHEMA_TEXT = JSON.stringify(z.toJSONSchema(CommentaryWireSchema));
const ENUMS = { kind: ['FACT', 'INFERENCE', 'ASSUMPTION'], desk: ['MARKET', 'TECHNICAL', 'FLOW', 'FUNDAMENTAL', 'EVENT'], stance4: ['BULLISH', 'BEARISH', 'NEUTRAL', 'INSUFFICIENT_DATA'], stance3: ['BULLISH', 'BEARISH', 'NEUTRAL'], scenario: ['BULL', 'BASE', 'BEAR'] } as const;
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const asNum = (v: unknown, d = 0): number => { const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[,%원\s]/g, '')); return Number.isFinite(n) ? n : d; };
const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null => { const t = asStr(v).trim().toUpperCase(); return (allowed as readonly string[]).includes(t) ? t as T : null; };
const claimOf = (v: unknown) => { const o = (v && typeof v === 'object' ? v : { text: v }) as Record<string, unknown>; return { text: asStr(o.text).trim(), evidenceIds: asArr(o.evidenceIds).map(asStr).filter(Boolean), kind: pick(o.kind, ENUMS.kind) ?? 'INFERENCE' }; };
export function repairDeep(raw: unknown): unknown {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const speakers = new Set<string>([...ANALYSTS.map((a) => a.id), ...ENUMS.desk, 'RED_TEAM']), analystIds = new Set<string>(ANALYSTS.map((a) => a.id));
  const ins = (o.insights && typeof o.insights === 'object' ? o.insights : {}) as Record<string, unknown>;
  const red = (o.redTeam && typeof o.redTeam === 'object' ? o.redTeam : {}) as Record<string, unknown>;
  const worst = (o.worstCase && typeof o.worstCase === 'object' ? o.worstCase : {}) as Record<string, unknown>;
  return {
    summary: claimOf(o.summary),
    desks: asArr(o.desks).flatMap((d) => { const x = (d ?? {}) as Record<string, unknown>, desk = pick(x.desk, ENUMS.desk), stance = pick(x.stance, ENUMS.stance4); return desk && stance ? [{ desk, stance, view: claimOf(x.view) }] : []; }),
    redTeam: { counterargument: claimOf(red.counterargument), unresolved: asArr(red.unresolved).map(asStr).filter(Boolean) },
    scenarios: asArr(o.scenarios).flatMap((v) => { const x = (v ?? {}) as Record<string, unknown>, kind = pick(x.kind, ENUMS.scenario); return kind ? [{ kind, narrative: claimOf(x.narrative), catalysts: asArr(x.catalysts).map(asStr).filter(Boolean), invalidation: asArr(x.invalidation).map(asStr).filter(Boolean), probability: asNum(x.probability), trigger: asNum(x.trigger), zoneLow: asNum(x.zoneLow), zoneHigh: asNum(x.zoneHigh) }] : []; }),
    analysts: asArr(o.analysts).flatMap((v) => { const x = (v ?? {}) as Record<string, unknown>, id = asStr(x.analyst).trim(), stance = pick(x.stance, ENUMS.stance3); return analystIds.has(id) && stance ? [{ analyst: id, stance, confidence: asNum(x.confidence, 50), target: asNum(x.target), rationale: claimOf(x.rationale) }] : []; }),
    debate: asArr(o.debate).flatMap((v) => { const x = (v ?? {}) as Record<string, unknown>, sp = asStr(x.speaker).trim().toUpperCase() === 'RED_TEAM' ? 'RED_TEAM' : asStr(x.speaker).trim(), stance = pick(x.stance, ENUMS.stance3); return speakers.has(sp) && stance ? [{ speaker: sp, stance, replyTo: asNum(x.replyTo, -1), claim: claimOf(x.claim) }] : []; }),
    worstCase: { narrative: claimOf(worst.narrative), checks: asArr(worst.checks).map(asStr).filter(Boolean) },
    insights: Object.fromEntries((['technical', 'strategy', 'flow', 'fundamental', 'news'] as const).map((k) => [k, claimOf(ins[k])])),
    bullish: asArr(o.bullish).map(claimOf), bearish: asArr(o.bearish).map(claimOf), uncertain: asArr(o.uncertain).map(claimOf), watch: asArr(o.watch).map(claimOf),
    dataGaps: asArr(o.dataGaps).map(asStr).filter(Boolean),
  };
}
/** The first top-level JSON object in a reply (a model may wrap it in a code fence or a sentence). */
export function jsonOf(text: string): unknown {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('NO_JSON');
  return JSON.parse(text.slice(start, end + 1));
}


/** Extra rules for an ETF or a coin (G-56); a stock's prompt is unchanged. */
export const kindRule = (kind?: 'etf' | 'coin') => !kind ? '' : kind === 'etf'
  ? '\n- 이 종목은 ETF예요. 개별 기업의 실적·공시·증권가 목표가 근거는 없고, 기초지수 구성·괴리율·총보수 정보도 받지 않았어요. 가격·거래량·기술·수급·뉴스 근거로만 판단하고, 없는 정보는 dataGaps에 적습니다. FUNDAMENTAL 데스크는 근거가 없으면 INSUFFICIENT_DATA로 둡니다.'
  : '\n- 이 종목은 업비트 원화 마켓의 가상자산(코인)이에요. 24시간 거래되고 일봉은 매일 09:00(KST)에 끊으며, "거래일"은 하루를 뜻합니다. 실적·공시·투자자별 수급·증권가 근거가 없으니 FLOW·FUNDAMENTAL 데스크는 INSUFFICIENT_DATA로 둡니다. 비교 대상은 비트코인이에요. 변동성이 주식보다 훨씬 크다는 점을 시나리오 가격대에 반영합니다.';

const briefSystem = (name: string, kind?: 'etf' | 'coin') => `당신은 Gnomon Analytics의 리서치 요약 담당이에요. ${name} 주간 리포트의 짧은 AI 요약을 씁니다.

진짜 요약이에요. 30초 안에 읽히게 짧게 씁니다.
- summary: 지금 이 종목에서 가장 중요한 한 가지와 그 이유, 2문장 이내(120자 안쪽).
- bullish·bearish: 강세·약세 근거 각각 가장 강한 1개만. 한 문장(60자 안쪽).
- uncertain: 꼭 필요할 때만 1개, 아니면 빈 배열.
- watch: 판단이 바뀔 조건 1개(무효화 가격이나 사건).
- insights: 탭 맨 위 한 줄씩, 각 40자 안쪽. 근거가 없는 탭은 비웁니다.
- 전체를 300자 안쪽으로 맞춥니다.

규칙:
- 제공된 근거 목록에 있는 내용만 쓰고, 모든 주장에 근거 ID(P1, T1, F1, N1 …)를 답니다. 목록에 없는 사실·숫자·전망은 쓰지 않습니다.
- 모든 주장에 종류(kind)를 붙입니다: 근거에 그대로 있는 사실은 FACT, 근거에서 끌어낸 해석은 INFERENCE, 근거로 확인되지 않은 가정은 ASSUMPTION. 해석을 사실처럼 쓰지 않습니다.
- 한국어 해요체로, 짧고 분명하게 씁니다. 내부 코드명이나 영어 약어 대신 뜻을 풀어 씁니다.
- 매수·매도를 권하거나 목표가·익절가·손절가를 제시하지 않습니다. 가격을 말해야 하면 시나리오 가격대와 무효화 가격으로만 씁니다. 방향은 "강세"·"약세"로만 표현합니다. 투자 권유가 아닙니다.
- 같은 이야기의 재보도는 하나의 근거로 봅니다. 근거가 부족하면 dataGaps에 적고 억지로 결론 내지 않습니다.${kindRule(kind)}`;

const system = (name: string, kind?: 'etf' | 'coin') => `당신은 Gnomon Analytics의 리서치 위원회예요. ${name} 일일 리포트의 "AI 해설"을 한 번에 씁니다.

위원회 구성:
- 데스크 5곳이 각자 근거를 보고 판단합니다: MARKET(시장·상대강도, M1·H1), TECHNICAL(기술·구조·적정가·예측 범위·전략 대결, T1·H1·S1·V1·R1·A1), FLOW(수급, Q1), FUNDAMENTAL(실적·밸류에이션·증권가 평균, D1), EVENT(공시·뉴스, F*·N*).
- 레드팀은 가장 우세한 의견에 맞서는 가장 강한 반론을 씁니다.
- 마지막으로 강세(BULL)·기본(BASE)·약세(BEAR) 시나리오를 하나씩 쓰고, 각 시나리오의 촉매와 무효화 조건(가격 수준이나 사건)을 적습니다. 각 시나리오에 지금 근거로 본 확률(%)을 붙이고 세 개의 합은 100으로 맞춥니다. 강세는 넘어서야 시작되는 위쪽 테스트 가격, 약세는 깨지면 시작되는 아래쪽 테스트 가격을 trigger로 적고(근거의 지지·저항에서 고름), 각 시나리오의 20거래일 가격대(zoneLow~zoneHigh)를 적습니다. 가격대는 목표가가 아니라 시나리오 범위입니다. 확률은 근거의 강약을 반영한 추정이고 예측 확신이 아니며, 기록해 두었다가 나중에 실제 결과로 채점됩니다. 근거가 엇갈리면 한쪽으로 몰지 말고 넓게 나눕니다.
- 토론(debate): 새 인물을 만들지 않고 위의 분석가 6명과 데스크 5곳이 직접 토론합니다. 위에서 강세로 판단한 위원과 약세로 판단한 위원 가운데 근거가 가장 강한 위원들이 번갈아 말하고(5~7차례), 두 번째 차례부터는 replyTo로 반박할 차례를 가리키고 그 주장을 직접 짚습니다. 각 위원의 stance는 위 analysts·desks에 쓴 입장과 같아야 합니다. 마지막 차례는 RED_TEAM이 무엇이 합의됐고 무엇이 풀리지 않았는지 정리합니다. 승패는 정하지 않습니다. 입장이 한쪽으로만 모였으면 그 사실을 RED_TEAM이 말하고 가장 강한 반대 근거를 냅니다.
- 최악의 경우(worstCase): 근거로 그릴 수 있는 가장 나쁜 전개와, 읽는 사람이 스스로 점검할 위험 관리 항목을 적습니다. 매수·매도·가격 지시가 아닌 점검 항목만 씁니다.
- 탭별 한 줄(insights): 기술·전략·수급·펀더멘털·뉴스 탭 맨 위에 붙일 한 줄씩 씁니다.
- 데스크 근거가 없으면 stance를 INSUFFICIENT_DATA로 둡니다.
- 분석가 대결: 아래 분석가 6명이 각자 자기 관점에서 판단(강세·약세·중립), 확신도(0~100), 20거래일 뒤 예상 가격을 냅니다. 예상 가격은 P1 종가에서 출발해 근거로 설명할 수 있는 수준이어야 하고, 기록되어 20거래일 뒤 실제 가격으로 채점됩니다. 서로 의견이 달라도 됩니다.
${ANALYSTS.map((a) => `  - ${a.id} (${a.name}): ${a.focus}`).join('\n')}

규칙:
- 제공된 근거 목록에 있는 내용만 쓰고, 모든 주장에 근거 ID(P1, T1, F1, N1 …)를 답니다. 목록에 없는 사실·숫자·전망은 쓰지 않습니다.
- 모든 주장에 종류(kind)를 붙입니다: 근거에 그대로 있는 사실은 FACT, 근거에서 끌어낸 해석은 INFERENCE, 근거로 확인되지 않은 가정은 ASSUMPTION. 해석을 사실처럼 쓰지 않습니다.
- 한국어 해요체로, 짧고 분명하게 씁니다. 내부 코드명이나 영어 약어 대신 뜻을 풀어 씁니다.
- 매수·매도를 권하거나 목표가·익절가·손절가를 제시하지 않습니다. 가격을 말해야 하면 시나리오 가격대와 무효화 가격으로만 씁니다. 방향은 "강세"·"약세"로만 표현합니다. 투자 권유가 아닙니다.
- 기사 수가 많다고 근거가 강한 것이 아닙니다. 같은 이야기의 재보도는 하나의 근거로 봅니다.
- 모르는 것은 중립이 아닙니다. 근거가 부족하면 dataGaps에 적고, 억지로 결론 내지 않습니다.
- 기술적 신호는 지표 요약일 뿐 오를 확률이 아닙니다.
- 반대 근거를 함께 찾고, 무엇이 나오면 해석이 바뀌는지(watch)를 씁니다.${kindRule(kind)}`;

/** Keeps only known IDs; drops claims left with none. */
export function sanitizeClaims(claims: readonly Claim[], known: ReadonlySet<string>): { kept: Claim[]; dropped: number } {
  const kept: Claim[] = [];
  let dropped = 0;
  for (const claim of claims) {
    const ids = [...new Set(claim.evidenceIds.map((id) => id.trim().toUpperCase()))].filter((id) => known.has(id));
    const text = claim.text.trim();
    if (!ids.length || !text) { dropped += 1; continue; }
    kept.push({ text, evidenceIds: ids, ...(claim.kind ? { kind: claim.kind } : {}) });
  }
  return { kept, dropped };
}

/**
 * Scenario probabilities as whole percents summing to 100 (largest remainder). Left out when any
 * kept scenario lacks one or they add up to nothing.
 */
export function normalizeProbabilities<T extends { probability?: number }>(xs: T[]): T[] {
  const ps = xs.map((x) => (Number.isFinite(x.probability) ? Math.max(0, x.probability!) : NaN));
  const total = ps.reduce((a, b) => a + b, 0);
  if (!xs.length || ps.some((p) => Number.isNaN(p)) || !(total > 0)) return xs.map(({ probability: _p, ...rest }) => rest as T);
  const raw = ps.map((p) => (p / total) * 100), floor = raw.map(Math.floor);
  let left = 100 - floor.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - floor[i]!, i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { floor[i]! += 1; left -= 1; } });
  return xs.map((x, i) => ({ ...x, probability: floor[i]! }));
}

/** A commentary that was not written, with the reason (e.g. the monthly AI budget). */
export function skippedCommentary(report: DailyReport, reason: string, now: Date): Commentary {
  return empty('SKIPPED', now, buildEvidence(report), reason);
}

function empty(status: Commentary['status'], generatedAt: Date, evidence: EvidenceItem[], error?: string): Commentary {
  return {
    status, model: COMMENTARY_MODEL, promptVersion: COMMENTARY_PROMPT_VERSION, generatedAt: generatedAt.toISOString(),
    bullish: [], bearish: [], uncertain: [], watch: [], dataGaps: [], dropped: 0, evidence, ...(error ? { error } : {}),
  };
}

export async function writeCommentary(report: DailyReport, options: { client?: Anthropic; apiKey?: string; now?: () => Date; tier?: CommentaryTier } = {}): Promise<Commentary> {
  const now = (options.now ?? (() => new Date()))();
  const tier = options.tier ?? 'deep';
  const model = tier === 'deep' ? COMMENTARY_MODEL : BRIEF_MODEL;
  const evidence = buildEvidence(report);
  if (!options.client && !options.apiKey?.trim()) return empty('SKIPPED', now, evidence, 'ANTHROPIC_API_KEY_MISSING');
  if (!evidence.length) return empty('SKIPPED', now, evidence, 'NO_EVIDENCE');
  const client = options.client ?? new Anthropic({ apiKey: options.apiKey! });
  const input = {
    종목: `${report.name} (${report.symbol})`,
    ...(report.kind ? { 자산_종류: report.kind === 'etf' ? 'ETF' : '코인 (업비트 원화 마켓)' } : {}),
    리포트_날짜: report.date,
    헤드라인: report.headline,
    근거_목록: evidence.map(({ id, label, detail }) => ({ id, 제목: label, 내용: detail })),
  };
  try {
    const user = { role: 'user' as const, content: `다음 근거 목록으로 "왜?" 해설을 작성해 주세요.\n\n${JSON.stringify(input, null, 2)}` };
    // Deep: the full committee on the large model, with the server-side fallback for safety declines.
    // Brief: the small model takes no effort setting or fallback.
    // A deep committee report can run past a few minutes; stream it so the connection never sits idle and times out
    // (the Worker's on-demand reports failed that way). Test doubles without stream() keep the plain call.
    const call = <P extends Parameters<typeof client.beta.messages.parse>[0]>(params: P) =>
      typeof client.beta.messages.stream === 'function' ? client.beta.messages.stream(params as never).finalMessage() as ReturnType<typeof client.beta.messages.parse<P>> : client.beta.messages.parse(params);
    const response = tier === 'deep'
      ? await call({
        model, max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        // No constrained format here (G-102): the committee schema is past the grammar limit. The schema goes in the prompt.
        output_config: { effort: 'medium' },
        system: `${system(report.name, report.kind)}\n\n## 응답 형식\n아래 JSON 스키마에 맞는 JSON 객체 하나만 답합니다. 코드 블록·설명 문장 없이 { 로 시작해 } 로 끝냅니다. enum 값은 스키마에 적힌 것만 씁니다.\n${DEEP_SCHEMA_TEXT}`, messages: [user],
      })
      : await call({
        model, max_tokens: 6000,
        output_config: { format: betaZodOutputFormat(BriefWireSchema) },
        system: briefSystem(report.name, report.kind), messages: [user],
      });
    const failed=(reason:string):Commentary=>({...empty('FAILED',now,evidence,reason),model,servedBy:response.model,tier,...(response.usage?{usage:{inputTokens:response.usage.input_tokens,outputTokens:response.usage.output_tokens}}:{})});
    if (response.stop_reason === 'refusal') return failed(`REFUSAL:${response.stop_details?.category ?? 'unknown'}`);
    if (response.stop_reason === 'max_tokens') return failed('MAX_TOKENS');
    let parsed = response.parsed_output as (z.infer<typeof BriefSchema> & Partial<z.infer<typeof CommentarySchema>>) | null;
    // beta.messages.stream().finalMessage() returns raw content, unlike messages.parse().
    // Validate the assembled text with the same schema without making another billed request.
    if (!parsed) {
      const text = (response.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('');
      if (text) {
        try {
          const json: unknown = tier === 'deep' ? repairDeep(jsonOf(text)) : JSON.parse(text);
          const validated = tier === 'deep' ? CommentarySchema.safeParse(json) : BriefSchema.safeParse(json);
          // A repaired reply still needs the core: a written summary (an empty object is not a report).
          if (!validated.success || !validated.data.summary.text.trim()) return failed('UNPARSEABLE_OUTPUT:SCHEMA');
          parsed = validated.data;
        } catch { return failed('UNPARSEABLE_OUTPUT:JSON'); }
      }
    }
    if (!parsed) return failed('UNPARSEABLE_OUTPUT');
    const known = new Set(evidence.map((e) => e.id));
    let dropped = 0;
    const clean = (claims: readonly Claim[]) => {
      const result = sanitizeClaims(claims, known);
      dropped += result.dropped;
      return result.kept;
    };
    const [summary] = clean([parsed.summary]);
    const desks = (parsed.desks ?? []).flatMap((d) => clean([d.view]).map((view) => ({ desk: d.desk, stance: d.stance, view })));
    const [counter] = parsed.redTeam ? clean([parsed.redTeam.counterargument]) : [];
    const analysts = (parsed.analysts ?? []).flatMap((a) => (Number.isFinite(a.target) && a.target > 0 ? clean([a.rationale]).map((rationale) => ({
      analyst: a.analyst, stance: a.stance, confidence: Math.max(0, Math.min(100, Math.round(a.confidence))), target: a.target, rationale,
    })) : []));
    const scenarios = normalizeProbabilities((parsed.scenarios ?? []).flatMap((sc) => clean([sc.narrative]).map((narrative) => ({
      kind: sc.kind, narrative, catalysts: sc.catalysts.map((c) => c.trim()).filter(Boolean), invalidation: sc.invalidation.map((c) => c.trim()).filter(Boolean),
      ...(Number.isFinite(sc.probability) ? { probability: sc.probability } : {}),
      ...(sc.kind !== 'BASE' && Number.isFinite(sc.trigger) && sc.trigger > 0 ? { trigger: sc.trigger } : {}),
      ...(Number.isFinite(sc.zoneLow) && Number.isFinite(sc.zoneHigh) && sc.zoneLow > 0 && sc.zoneHigh >= sc.zoneLow ? { zone: [sc.zoneLow, sc.zoneHigh] as [number, number] } : {}),
    }))));
    // Turns keep their place so replyTo still points at the right one; an uncited turn drops out and replies to it lose the pointer.
    // A reply can only point back. Models sometimes count from 1, which makes a turn answer itself: shift those down one.
    const turns = (parsed.debate ?? []).map((t, i) => { const [claim] = clean([t.claim]); return claim ? { speaker: t.speaker, stance: t.stance, replyTo: replyIndex(t.replyTo, i), claim } : null; });
    const kept = turns.flatMap((t, i) => (t ? [i] : []));
    const debate: DebateTurn[] = turns.flatMap((t) => {
      if (!t) return [];
      const to = t.replyTo != null && Number.isInteger(t.replyTo) ? kept.indexOf(t.replyTo) : -1;
      return [{ speaker: t.speaker, stance: t.stance, claim: t.claim, ...(to >= 0 ? { replyTo: to } : {}) }];
    });
    const [worst] = parsed.worstCase ? clean([parsed.worstCase.narrative]) : [];
    const insights: Partial<Record<InsightKey, Claim>> = {};
    for (const [k, v] of Object.entries(parsed.insights ?? {}) as [InsightKey, Claim | undefined][]) { const [c] = v ? clean([v]) : []; if (c) insights[k] = c; }
    return {
      ...(debate.length ? { debate } : {}),
      ...(worst ? { worstCase: { narrative: worst, checks: (parsed.worstCase?.checks ?? []).map((c) => c.trim()).filter(Boolean).slice(0, 5) } } : {}),
      ...(Object.keys(insights).length ? { insights } : {}),
      status: 'OK', model, promptVersion: COMMENTARY_PROMPT_VERSION, generatedAt: now.toISOString(),
      servedBy: response.model, tier,
      ...(response.usage ? { usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } } : {}),
      ...(summary ? { summary } : {}),
      // A brief stays a brief (G-60): the strongest point on each side and one thing to watch.
      ...(tier === 'brief'
        ? { bullish: clean(parsed.bullish).slice(0, 1), bearish: clean(parsed.bearish).slice(0, 1), uncertain: clean(parsed.uncertain).slice(0, 1), watch: clean(parsed.watch).slice(0, 1) }
        : { bullish: clean(parsed.bullish), bearish: clean(parsed.bearish), uncertain: clean(parsed.uncertain), watch: clean(parsed.watch) }),
      dataGaps: parsed.dataGaps.map((g) => g.trim()).filter(Boolean),
      desks, scenarios, analysts,
      ...(counter ? { redTeam: { counterargument: counter, unresolved: (parsed.redTeam?.unresolved ?? []).map((u) => u.trim()).filter(Boolean) } } : {}),
      dropped, evidence,
    };
  } catch (error) {
    const message = error instanceof Anthropic.APIError ? `API_${error.status ?? 'ERROR'}:${error.message}` : error instanceof Error ? error.message : 'UNKNOWN';
    return empty('FAILED', now, evidence, message.slice(0, 200));
  }
}
