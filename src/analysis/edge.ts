// What most readers miss (G-99): earnings and surprises, dividends, buybacks, insider and large-holder
// moves, supply contracts and trading-value surges, gathered per stock and across the market. Pure.

import type { FinancePeriod, PriceBar } from '../types.js';
import { bigMoney, currency, won } from '../report/format.js';

export type EventKey = 'earnings' | 'dividend' | 'buyback' | 'buybackSell' | 'insider' | 'holder' | 'contract' | 'ir';
export interface EventRule { key: EventKey; label: string; pattern: RegExp; why: string }

/** Titles of filings worth surfacing (OpenDART report_nm). Order matters: first match wins. */
export const EVENT_RULES: readonly EventRule[] = [
  { key: 'earnings', label: '실적 발표', pattern: /영업\(잠정\)실적|\(잠정\)실적|잠정실적|매출액또는손익구조/, why: '정기보고서보다 먼저 나오는 실적 숫자예요.' },
  { key: 'dividend', label: '배당 결정', pattern: /현금ㆍ현물배당결정|현금배당결정|(분기|중간)배당/, why: '배당금과 배당 기준일이 정해졌어요.' },
  { key: 'buyback', label: '자사주 매입·소각', pattern: /자기주식(취득|소각)결정|자기주식취득신탁계약체결|주식소각결정/, why: '회사가 자기 주식을 사거나 없애면 주당 가치가 올라가요.' },
  { key: 'buybackSell', label: '자사주 처분', pattern: /자기주식처분결정|자기주식취득신탁계약해지/, why: '회사가 가진 주식을 시장에 내놓는 신호예요.' },
  { key: 'insider', label: '임원·주요주주 매매', pattern: /임원ㆍ주요주주\s*특정증권등\s*소유상황보고서|최대주주등소유주식변동신고서/, why: '회사를 가장 잘 아는 사람들의 매매예요.' },
  { key: 'holder', label: '5% 대량보유', pattern: /주식등의\s*대량보유상황보고서/, why: '지분 5% 이상 투자자가 늘리거나 줄였어요.' },
  { key: 'contract', label: '수주·공급계약', pattern: /단일판매ㆍ공급계약체결|공급계약체결/, why: '매출로 이어질 계약이에요. 매출액 대비 규모를 확인하세요.' },
  { key: 'ir', label: 'IR·설명회', pattern: /기업설명회\(IR\)개최|기업설명회개최/, why: '실적이나 사업 계획을 설명하는 자리예요.' },
];

export interface EventFiling { symbol: string; date: string; title: string; receiptNo: string; key: EventKey }

export function eventOf(title: string): EventRule | null {
  if (/철회|취소/.test(title) && !/결정/.test(title)) return null;
  return EVENT_RULES.find((r) => r.pattern.test(title)) ?? null;
}

/** One insider (임원·주요주주) ownership report, from OpenDART elestock.json. */
export interface InsiderReport { symbol: string; receiptNo: string; date: string; reporter: string; position: string; isExec: boolean; isMajor: boolean; shares: number | null; delta: number | null; ratio: number | null; retrievedAt: string; /** The filing's page when it is not on DART (SEC Form 4, G-179). */ url?: string }
/** One 5% holder report, from OpenDART majorstock.json. */
export interface HolderReport { symbol: string; receiptNo: string; date: string; reporter: string; shares: number | null; delta: number | null; ratio: number | null; ratioDelta: number | null; reason: string; retrievedAt: string }

export interface InsiderSummary { buys: number; sells: number; netShares: number; netValue: number | null; reporters: number; latest: string | null; items: InsiderReport[] }
export interface Surprise { period: string; metric: string; actual: number; estimate: number; pct: number; estimatedAt: string }
export interface DividendInfo { dps: number | null; dpsEst: number | null; yieldPct: number | null; yieldEstPct: number | null; payoutPct: number | null; decision: EventFiling | null }
export interface ValueSurge { today: number; avg20: number; ratio: number }
export interface EdgeSection {
  insider: InsiderSummary | null;
  holders: HolderReport[];
  events: (EventFiling & { label: string; why: string })[];
  surprises: Surprise[];
  nextEarnings: { period: string; label: string; basis: string } | null;
  dividend: DividendInfo | null;
  value: ValueSurge | null;
  /** Short lines for the summary card and the AI evidence, most telling first. */
  highlights: { key: string; tone: 'up' | 'down' | ''; text: string }[];
}

const DAY = 86_400_000;
const daysBefore = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) - n * DAY).toISOString().slice(0, 10);
const fmtShares = (n: number) => `${Math.abs(n) >= 10_000 ? `${(Math.abs(n) / 10_000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}만` : Math.abs(n).toLocaleString('ko-KR')}주`;
const fmtWon = (n: number) => (currency() === 'USD' ? bigMoney(n) : Math.abs(n) >= 1e8 ? `${(n / 1e8).toFixed(Math.abs(n) >= 1e10 ? 0 : 1)}억원` : `${Math.round(n).toLocaleString('ko-KR')}원`);

/** Insider moves of the last `days`: buys and sells by report, net shares and roughly what that is worth at `close`. */
export function insiderSummary(reports: readonly InsiderReport[], date: string, close: number | null, days = 90): InsiderSummary | null {
  const since = daysBefore(date, days);
  const items = [...new Map(reports.filter((r) => r.date >= since && r.date <= date).map((r) => [`${r.receiptNo}:${r.reporter}`, r])).values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!items.length) return null;
  const moved = items.filter((r) => r.delta !== null && r.delta !== 0);
  const netShares = moved.reduce((s, r) => s + r.delta!, 0);
  return { buys: moved.filter((r) => r.delta! > 0).length, sells: moved.filter((r) => r.delta! < 0).length, netShares, netValue: close ? netShares * close : null, reporters: new Set(moved.map((r) => r.reporter)).size, latest: items[0]!.date, items: items.slice(0, 12) };
}

/**
 * Earnings surprises from the versioned financials log: for each reported quarter, the actual against the
 * last estimate we had stored before the actual appeared. Only quarters seen as estimates first count.
 */
export function surprises(log: readonly FinancePeriod[], metrics: readonly string[] = ['영업이익', '매출액']): Surprise[] {
  const out: Surprise[] = [];
  const quarters = [...new Set(log.filter((f) => f.periodType === 'QUARTER').map((f) => f.period))].sort().reverse();
  for (const period of quarters) {
    const rows = log.filter((f) => f.periodType === 'QUARTER' && f.period === period).sort((a, b) => (a.retrievedAt < b.retrievedAt ? -1 : 1));
    const firstActual = rows.findIndex((r) => !r.isEstimate);
    if (firstActual <= 0) continue;
    const est = rows.slice(0, firstActual).filter((r) => r.isEstimate).at(-1), act = rows.filter((r) => !r.isEstimate).at(-1)!;
    if (!est) continue;
    for (const m of metrics) {
      const a = act.metrics[m], e = est.metrics[m];
      if (a == null || e == null || e === 0) continue;
      out.push({ period, metric: m, actual: a, estimate: e, pct: ((a - e) / Math.abs(e)) * 100, estimatedAt: est.retrievedAt.slice(0, 10) });
    }
    if (out.length >= 8) break;
  }
  return out;
}

/** The next quarter to be reported and when it usually comes: preliminary numbers early, the quarterly report by the legal deadline. */
export function nextEarnings(date: string, events: readonly EventFiling[], us = false): { period: string; label: string; basis: string } {
  if (us) return nextEarningsUs(date);
  const d = new Date(`${date}T00:00:00Z`), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  // Quarter ends: Mar, Jun, Sep, Dec. The quarter being reported is the last one that has ended.
  const qEnd = m <= 3 ? { y: y - 1, q: 4 } : m <= 6 ? { y, q: 1 } : m <= 9 ? { y, q: 2 } : { y, q: 3 };
  const reported = events.some((e) => e.key === 'earnings' && e.date >= daysBefore(date, 40));
  const q = reported ? (qEnd.q === 4 ? { y: qEnd.y + 1, q: 1 } : { y: qEnd.y, q: qEnd.q + 1 }) : qEnd;
  // Preliminary numbers usually come in the month after the quarter; the report is due 45 days after it (90 for the year).
  const endMonth = q.q * 3, deadline = q.q === 4 ? `${q.y + 1}년 3월 말(사업보고서)` : `${q.y}년 ${endMonth + 2}월 중순(분기보고서)`;
  const early = q.q === 4 ? `${q.y + 1}년 1월 말~2월` : `${q.y}년 ${endMonth + 1}월 초~중순`;
  const last = events.filter((e) => e.key === 'earnings').sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return { period: `${q.y}년 ${q.q}분기`, label: `잠정실적 ${early} · 정기보고서 ${deadline}까지`, basis: last ? `직전 실적 공시 ${last.date}` : '대형주는 분기가 끝나고 1~3주 안에 잠정실적을 내는 경우가 많아요' };
}

/** US companies report within weeks of a quarter's end; the 10-Q is due 40 days after it, the 10-K 60 days after the year. */
function nextEarningsUs(date: string): { period: string; label: string; basis: string } {
  const d = new Date(`${date}T00:00:00Z`), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  const q = m <= 3 ? { y: y - 1, q: 4 } : m <= 6 ? { y, q: 1 } : m <= 9 ? { y, q: 2 } : { y, q: 3 };
  const endMonth = q.q * 3, nextY = q.q === 4 ? q.y + 1 : q.y, early = `${nextY}년 ${(endMonth % 12) + 1}월 중순~${(endMonth % 12) + 2}월 초`;
  return { period: `${q.y}년 ${q.q}분기(달력 기준)`, label: `실적 발표 ${early} · 10-Q는 분기 끝 40일, 10-K는 연말 60일 안에 제출`, basis: 'SEC 제출 기한 기준. 회사 회계연도가 달력과 다르면 분기 이름이 달라요.' };
}

export function dividendInfo(finance: readonly FinancePeriod[], close: number | null, events: readonly EventFiling[]): DividendInfo | null {
  const annual = finance.filter((f) => f.periodType === 'ANNUAL');
  const lastActual = annual.filter((f) => !f.isEstimate && f.metrics['주당배당금'] != null).sort((a, b) => (a.period < b.period ? 1 : -1))[0];
  const nextEst = annual.filter((f) => f.isEstimate && f.metrics['주당배당금'] != null).sort((a, b) => (a.period < b.period ? -1 : 1))[0];
  const decision = events.filter((e) => e.key === 'dividend').sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null;
  const dps = lastActual?.metrics['주당배당금'] ?? null, dpsEst = nextEst?.metrics['주당배당금'] ?? null, eps = lastActual?.metrics.EPS ?? null;
  if (dps == null && dpsEst == null && !decision) return null;
  const y = (v: number | null) => (v != null && close ? (v / close) * 100 : null);
  return { dps, dpsEst, yieldPct: y(dps), yieldEstPct: y(dpsEst), payoutPct: dps != null && eps ? (dps / eps) * 100 : null, decision };
}

export function valueSurge(bars: readonly Pick<PriceBar, 'close' | 'volume'>[]): ValueSurge | null {
  if (bars.length < 21) return null;
  const v = bars.map((b) => b.close * b.volume), today = v.at(-1)!, prev = v.slice(-21, -1), avg20 = prev.reduce((s, x) => s + x, 0) / prev.length;
  return avg20 > 0 ? { today, avg20, ratio: today / avg20 } : null;
}

export function buildEdge(input: { date: string; close: number | null; bars: readonly Pick<PriceBar, 'close' | 'volume'>[]; finance: readonly FinancePeriod[]; financeLog: readonly FinancePeriod[]; events: readonly EventFiling[]; insider: readonly InsiderReport[]; holders: readonly HolderReport[]; us?: boolean }): EdgeSection {
  const since = daysBefore(input.date, 180);
  const events = input.events.filter((e) => e.date >= since && e.date <= input.date).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30).map((e) => { const r = EVENT_RULES.find((x) => x.key === e.key)!; return { ...e, label: r.label, why: r.why }; });
  const insider = insiderSummary(input.insider, input.date, input.close);
  const holders = input.holders.filter((h) => h.date >= since && h.date <= input.date).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);
  const surp = surprises(input.financeLog);
  const dividend = dividendInfo(input.finance, input.close, input.events);
  const value = valueSurge(input.bars);
  const highlights: EdgeSection['highlights'] = [];
  if (insider && insider.netShares !== 0) highlights.push({ key: 'insider', tone: insider.netShares > 0 ? 'up' : 'down', text: `최근 90일 임원·주요주주 보유 ${insider.netShares > 0 ? '증가' : '감소'} ${fmtShares(insider.netShares)}${insider.netValue != null ? `(지금 가격으로 약 ${fmtWon(Math.abs(insider.netValue))})` : ''} · 늘린 보고 ${insider.buys}건 줄인 보고 ${insider.sells}건 · 매매·증여·보상 등 사유는 원문 확인` });
  const op = surp.find((s) => s.metric === '영업이익');
  if (op && Math.abs(op.pct) >= 3) highlights.push({ key: 'surprise', tone: op.pct > 0 ? 'up' : 'down', text: `${op.period.slice(0, 4)}년 ${Number(op.period.slice(4)) / 3}분기 영업이익이 예상보다 ${Math.abs(op.pct).toFixed(1)}% ${op.pct > 0 ? '많았어요(서프라이즈)' : '적었어요(쇼크)'}` });
  const bb = events.find((e) => e.key === 'buyback'), bs = events.find((e) => e.key === 'buybackSell');
  if (bb) highlights.push({ key: 'buyback', tone: 'up', text: `${bb.date} 자사주 ${/소각/.test(bb.title) ? '소각' : '매입'} 결정` });
  if (bs) highlights.push({ key: 'buybackSell', tone: 'down', text: `${bs.date} 자사주 처분 결정` });
  const h = holders.find((x) => x.ratioDelta != null && x.ratioDelta !== 0);
  if (h) highlights.push({ key: 'holder', tone: h.ratioDelta! > 0 ? 'up' : 'down', text: `${h.date} ${h.reporter} 지분 ${h.ratioDelta! > 0 ? '+' : ''}${h.ratioDelta!.toFixed(2)}%p (보유 ${h.ratio?.toFixed(2) ?? '?'}%)` });
  const ct = events.filter((e) => e.key === 'contract' && e.date >= daysBefore(input.date, 30));
  if (ct.length) highlights.push({ key: 'contract', tone: 'up', text: `최근 30일 수주·공급계약 ${ct.length}건` });
  if (value && value.ratio >= 2.5) highlights.push({ key: 'value', tone: '', text: `오늘 거래대금이 20일 평균의 ${value.ratio.toFixed(1)}배(${fmtWon(value.today)})` });
  if (dividend?.yieldEstPct != null && dividend.yieldEstPct >= 3) highlights.push({ key: 'dividend', tone: 'up', text: `예상 배당수익률 ${dividend.yieldEstPct.toFixed(1)}%(주당 ${won(Math.round(dividend.dpsEst!))})` });
  return { insider, holders, events, surprises: surp, nextEarnings: nextEarnings(input.date, input.events, input.us), dividend, value, highlights };
}

/** Market-wide radar rows for the site (radar.json): the last `days` of surfaced filings, by kind. */
export function radarRows(filings: readonly EventFiling[], today: string, days = 7): EventFiling[] {
  const since = daysBefore(today, days);
  return filings.filter((f) => f.date >= since && f.date <= today).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.symbol < b.symbol ? -1 : 1));
}
