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

export const COMMENTARY_MODEL = 'claude-opus-5-5';
export const COMMENTARY_PROMPT_VERSION = 'gnm-why-v1';
const MAX_FILINGS = 15;
const MAX_NEWS = 30;

export interface EvidenceItem {
  id: string;
  kind: 'PRICE' | 'TECHNICAL' | 'FILING' | 'NEWS';
  label: string;
  detail: string;
  url: string;
}

export interface Claim {
  text: string;
  evidenceIds: string[];
}

export interface Commentary {
  status: 'OK' | 'FAILED' | 'SKIPPED';
  model: string;
  promptVersion: string;
  generatedAt: string;
  /** Model that actually answered (differs when a server-side fallback ran). */
  servedBy?: string;
  summary?: Claim;
  bullish: Claim[];
  bearish: Claim[];
  uncertain: Claim[];
  /** What would change the reading (invalidation / things to watch). */
  watch: Claim[];
  dataGaps: string[];
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

export const CommentarySchema = z.object({
  summary: ClaimSchema.describe('오늘 무슨 일이 있었고 왜 중요한지 2~3문장 요약'),
  bullish: z.array(ClaimSchema).describe('강세 쪽 근거. 없으면 빈 배열'),
  bearish: z.array(ClaimSchema).describe('약세 쪽 근거. 없으면 빈 배열'),
  uncertain: z.array(ClaimSchema).describe('방향이 불확실하거나 해석이 갈리는 점'),
  watch: z.array(ClaimSchema).describe('앞으로 무엇이 나오면 판단이 바뀌는지 (무효화 조건, 지켜볼 일정)'),
  dataGaps: z.array(z.string()).describe('근거가 부족해서 판단할 수 없는 부분'),
});

const SYSTEM = `당신은 Gnomon Analytics의 리서치 해설 작성자예요. SK하이닉스 일일 리포트의 "왜?" 섹션을 씁니다.

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

export async function writeCommentary(report: DailyReport, options: { client?: Anthropic; apiKey?: string; now?: () => Date } = {}): Promise<Commentary> {
  const now = (options.now ?? (() => new Date()))();
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
    const response = await client.beta.messages.parse({
      model: COMMENTARY_MODEL,
      max_tokens: 16000,
      // Safety-classifier declines re-run on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(CommentarySchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: `다음 근거 목록으로 "왜?" 해설을 작성해 주세요.\n\n${JSON.stringify(input, null, 2)}` }],
    });
    if (response.stop_reason === 'refusal') return empty('FAILED', now, evidence, `REFUSAL:${response.stop_details?.category ?? 'unknown'}`);
    if (response.stop_reason === 'max_tokens') return empty('FAILED', now, evidence, 'MAX_TOKENS');
    const parsed = response.parsed_output;
    if (!parsed) return empty('FAILED', now, evidence, 'UNPARSEABLE_OUTPUT');
    const known = new Set(evidence.map((e) => e.id));
    let dropped = 0;
    const clean = (claims: readonly Claim[]) => {
      const result = sanitizeClaims(claims, known);
      dropped += result.dropped;
      return result.kept;
    };
    const [summary] = clean([parsed.summary]);
    return {
      status: 'OK', model: COMMENTARY_MODEL, promptVersion: COMMENTARY_PROMPT_VERSION, generatedAt: now.toISOString(),
      servedBy: response.model,
      ...(summary ? { summary } : {}),
      bullish: clean(parsed.bullish), bearish: clean(parsed.bearish), uncertain: clean(parsed.uncertain), watch: clean(parsed.watch),
      dataGaps: parsed.dataGaps.map((g) => g.trim()).filter(Boolean),
      dropped, evidence,
    };
  } catch (error) {
    const message = error instanceof Anthropic.APIError ? `API_${error.status ?? 'ERROR'}:${error.message}` : error instanceof Error ? error.message : 'UNKNOWN';
    return empty('FAILED', now, evidence, message.slice(0, 200));
  }
}
