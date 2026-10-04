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
export const COMMENTARY_PROMPT_VERSION = 'gnm-committee-v2';
const MAX_FILINGS = 15;
const MAX_NEWS = 30;

export interface EvidenceItem {
  id: string;
  kind: 'PRICE' | 'TECHNICAL' | 'FILING' | 'NEWS' | 'HORIZON' | 'VALUE' | 'FORECAST' | 'STRUCTURE' | 'FLOW' | 'FUNDAMENTAL' | 'MARKET' | 'ARENA';
  label: string;
  detail: string;
  url: string;
}

export interface Claim {
  text: string;
  evidenceIds: string[];
}

export type Desk = 'MARKET' | 'TECHNICAL' | 'FLOW' | 'FUNDAMENTAL' | 'EVENT';
export type DeskStance = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'INSUFFICIENT_DATA';
export interface DeskView { desk: Desk; stance: DeskStance; view: Claim }
export interface AnalystView { analyst: AnalystId; stance: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; confidence: number; target: number; rationale: Claim }
export interface Scenario { kind: 'BULL' | 'BASE' | 'BEAR'; narrative: Claim; catalysts: string[]; invalidation: string[] }

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
  /** Analyst battle: each analyst's stance, confidence and 20-session target (scored later). */
  analysts?: AnalystView[];
  /** Claims removed because none of their evidence IDs existed. */
  dropped: number;
  evidence: EvidenceItem[];
  error?: string;
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
      const sums = m.flows.sums.map((x) => `${x.days}일 외국인 ${x.foreign ?? '없음'}주, 기관 ${x.institution ?? '없음'}주, 개인 ${x.individual ?? '없음'}주`).join('; ');
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
});

const briefSystem = (name: string) => `당신은 Gnomon Analytics의 리서치 요약 담당이에요. ${name} 주간 리포트의 짧은 AI 요약을 씁니다.

- summary: 이번 주 무슨 일이 있었고 왜 중요한지 2~3문장.
- bullish·bearish: 강세·약세 쪽 근거 각각 최대 3개. uncertain은 해석이 갈리는 점 최대 2개.
- watch: 무엇이 나오면 판단이 바뀌는지 최대 3개.

규칙:
- 제공된 근거 목록에 있는 내용만 쓰고, 모든 주장에 근거 ID(P1, T1, F1, N1 …)를 답니다. 목록에 없는 사실·숫자·전망은 쓰지 않습니다.
- 한국어 해요체로, 짧고 분명하게 씁니다. 내부 코드명이나 영어 약어 대신 뜻을 풀어 씁니다.
- 매수·매도를 권하거나 목표가를 제시하지 않습니다. 방향은 "강세"·"약세"로만 표현합니다. 투자 권유가 아닙니다.
- 같은 이야기의 재보도는 하나의 근거로 봅니다. 근거가 부족하면 dataGaps에 적고 억지로 결론 내지 않습니다.`;

const system = (name: string) => `당신은 Gnomon Analytics의 리서치 위원회예요. ${name} 일일 리포트의 "AI 해설"을 한 번에 씁니다.

위원회 구성:
- 데스크 5곳이 각자 근거를 보고 판단합니다: MARKET(시장·상대강도, M1·H1), TECHNICAL(기술·구조·적정가·예측 범위·전략 대결, T1·H1·S1·V1·R1·A1), FLOW(수급, Q1), FUNDAMENTAL(실적·밸류에이션·증권가 평균, D1), EVENT(공시·뉴스, F*·N*).
- 레드팀은 가장 우세한 의견에 맞서는 가장 강한 반론을 씁니다.
- 마지막으로 강세(BULL)·기본(BASE)·약세(BEAR) 시나리오를 하나씩 쓰고, 각 시나리오의 촉매와 무효화 조건(가격 수준이나 사건)을 적습니다.
- 데스크 근거가 없으면 stance를 INSUFFICIENT_DATA로 둡니다.
- 분석가 대결: 아래 분석가 6명이 각자 자기 관점에서 판단(강세·약세·중립), 확신도(0~100), 20거래일 뒤 예상 가격을 냅니다. 예상 가격은 P1 종가에서 출발해 근거로 설명할 수 있는 수준이어야 하고, 기록되어 20거래일 뒤 실제 가격으로 채점됩니다. 서로 의견이 달라도 됩니다.
${ANALYSTS.map((a) => `  - ${a.id} (${a.name}): ${a.focus}`).join('\n')}

규칙:
- 제공된 근거 목록에 있는 내용만 쓰고, 모든 주장에 근거 ID(P1, T1, F1, N1 …)를 답니다. 목록에 없는 사실·숫자·전망은 쓰지 않습니다.
- 한국어 해요체로, 짧고 분명하게 씁니다. 내부 코드명이나 영어 약어 대신 뜻을 풀어 씁니다.
- 매수·매도를 권하거나 목표가를 제시하지 않습니다. 방향은 "강세"·"약세"로만 표현합니다. 투자 권유가 아닙니다.
- 기사 수가 많다고 근거가 강한 것이 아닙니다. 같은 이야기의 재보도는 하나의 근거로 봅니다.
- 모르는 것은 중립이 아닙니다. 근거가 부족하면 dataGaps에 적고, 억지로 결론 내지 않습니다.
- 기술적 신호는 지표 요약일 뿐 오를 확률이 아닙니다.
- 반대 근거를 함께 찾고, 무엇이 나오면 해석이 바뀌는지(watch)를 씁니다.`;

/** Keeps only known IDs; drops claims left with none. */
export function sanitizeClaims(claims: readonly Claim[], known: ReadonlySet<string>): { kept: Claim[]; dropped: number } {
  const kept: Claim[] = [];
  let dropped = 0;
  for (const claim of claims) {
    const ids = [...new Set(claim.evidenceIds.map((id) => id.trim().toUpperCase()))].filter((id) => known.has(id));
    const text = claim.text.trim();
    if (!ids.length || !text) { dropped += 1; continue; }
    kept.push({ text, evidenceIds: ids });
  }
  return { kept, dropped };
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
    리포트_날짜: report.date,
    헤드라인: report.headline,
    근거_목록: evidence.map(({ id, label, detail }) => ({ id, 제목: label, 내용: detail })),
  };
  try {
    const user = { role: 'user' as const, content: `다음 근거 목록으로 "왜?" 해설을 작성해 주세요.\n\n${JSON.stringify(input, null, 2)}` };
    // Deep: the full committee on the large model, with the server-side fallback for safety declines.
    // Brief: the small model takes no effort setting or fallback.
    const response = tier === 'deep'
      ? await client.beta.messages.parse({
        model, max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: betaZodOutputFormat(CommentarySchema) },
        system: system(report.name), messages: [user],
      })
      : await client.beta.messages.parse({
        model, max_tokens: 4000,
        output_config: { format: betaZodOutputFormat(BriefSchema) },
        system: briefSystem(report.name), messages: [user],
      });
    if (response.stop_reason === 'refusal') return empty('FAILED', now, evidence, `REFUSAL:${response.stop_details?.category ?? 'unknown'}`);
    if (response.stop_reason === 'max_tokens') return empty('FAILED', now, evidence, 'MAX_TOKENS');
    const parsed = response.parsed_output as (z.infer<typeof BriefSchema> & Partial<z.infer<typeof CommentarySchema>>) | null;
    if (!parsed) return empty('FAILED', now, evidence, 'UNPARSEABLE_OUTPUT');
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
    const scenarios = (parsed.scenarios ?? []).flatMap((sc) => clean([sc.narrative]).map((narrative) => ({
      kind: sc.kind, narrative, catalysts: sc.catalysts.map((c) => c.trim()).filter(Boolean), invalidation: sc.invalidation.map((c) => c.trim()).filter(Boolean),
    })));
    return {
      status: 'OK', model, promptVersion: COMMENTARY_PROMPT_VERSION, generatedAt: now.toISOString(),
      servedBy: response.model, tier,
      ...(response.usage ? { usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } } : {}),
      ...(summary ? { summary } : {}),
      bullish: clean(parsed.bullish), bearish: clean(parsed.bearish), uncertain: clean(parsed.uncertain), watch: clean(parsed.watch),
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
