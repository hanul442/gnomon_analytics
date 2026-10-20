// G-272: a coin's 체력, in place of the stock 기업 체력 a coin cannot have (no sales, no debt). Five axes, each 0–100
// from a stated threshold, the way the stock's five are: 규모 (market cap), 유동성 (Upbit trading value), 공급 (coins
// issued ÷ hard cap), 가격 괴리 (Upbit against the world price), 이력 (years traded). Pure.

import type { PaprikaCoin } from '../sources/coinpaprika.js';
import type { CoinHistory } from '../sources/coinHistory.js';

export interface FitAxis { key: 'size' | 'liquidity' | 'supply' | 'gap' | 'age'; label: string; score: number | null; value: string; note: string }
export interface CoinFitness {
  date: string;
  /** Mean of the axes that have a score; null when none has. */
  total: number | null;
  axes: FitAxis[];
  /** Dated events, oldest first. */
  timeline: { date: string; text: string }[];
  /** Upbit's 주의 flags that are on, and its 유의 종목 flag. */
  cautions: string[]; warning: boolean;
  /** How the price history was put together (G-271 splice), in one sentence; '' when it is Upbit's alone. */
  historyNote: string;
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
/** Won in 조/억/만, the way Korean apps write money. */
export function wonWords(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toLocaleString('ko-KR', { maximumFractionDigits: a >= 1e13 ? 0 : 1 })}조 원`;
  if (a >= 1e8) return `${Math.round(v / 1e8).toLocaleString('ko-KR')}억 원`;
  return `${Math.round(v / 1e4).toLocaleString('ko-KR')}만 원`;
}
const count = (v: number) => (v >= 1e8 ? `${(v / 1e8).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억 개` : v >= 1e4 ? `${Math.round(v / 1e4).toLocaleString('ko-KR')}만 개` : `${Math.round(v).toLocaleString('ko-KR')}개`);
const yearsBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / (365.25 * 86_400_000);
const span = (years: number) => (years >= 1 ? `${Math.floor(years)}년${years % 1 >= 1 / 12 && years < 5 ? ` ${Math.floor((years % 1) * 12)}개월` : ''}` : `${Math.max(1, Math.round(years * 12))}개월`);

export function coinFitness(input: {
  date: string; upbitPrice: number; value24hKrw: number | null; usdtKrw: number | null;
  paprika: PaprikaCoin | null; history: CoinHistory | null;
  /** Upbit's first day in what was fetched, and whether that is its listing day (Upbit had fewer days than asked). */
  upbitFirst: string; listed: boolean;
  cautions?: readonly string[]; warning?: boolean;
}): CoinFitness {
  const p = input.paprika, k = input.usdtKrw;
  const mcap = p?.marketCapUsd && k ? p.marketCapUsd * k : null;
  const size: FitAxis = { key: 'size', label: '규모', score: mcap ? clamp(20 + (Math.log10(mcap) - 10) * 20) : null,
    value: mcap ? `시가총액 약 ${wonWords(mcap)}` : '자료 없음',
    note: mcap ? `전 세계 ${p!.rank ? `${p!.rank.toLocaleString('ko-KR')}위` : '순위 밖'}. 작을수록 적은 돈으로도 크게 흔들려요. (100억 원 20점, 100조 원 이상 100점)` : '시가총액을 아는 곳이 없어요.' };
  const v = input.value24hKrw;
  const liquidity: FitAxis = { key: 'liquidity', label: '거래', score: v && v > 0 ? clamp((Math.log10(v) - 8) * 25) : null,
    value: v && v > 0 ? `업비트 24시간 ${wonWords(v)}` : '자료 없음',
    note: v && v > 0 ? `사고팔기 쉬운 정도예요.${mcap && v > mcap ? ' 시가총액보다 하루 거래가 많아 손바뀜이 매우 빨라요.' : ''} (1억 원 0점, 1,000억 원 75점)` : '업비트 거래대금을 받지 못했어요.' };
  const issued = p?.totalSupply ?? null, cap = p?.maxSupply ?? null;
  const ratio = issued && cap ? Math.min(1, issued / cap) : null;
  const supply: FitAxis = { key: 'supply', label: '공급', score: ratio != null ? clamp(ratio * 100) : issued ? 40 : null,
    value: ratio != null ? `발행 ${count(issued!)} / 최대 ${count(cap!)}` : issued ? `발행 ${count(issued)} · 최대 공급량 없음` : '자료 없음',
    note: ratio != null ? (ratio >= 0.995 ? '이미 다 풀려서 앞으로 새로 풀릴 물량은 없어요.' : `${Math.round(ratio * 100)}%가 풀렸어요. 남은 ${Math.round((1 - ratio) * 100)}%가 나오면 가격을 누를 수 있어요.`)
      : issued ? '상한이 없어 계속 새로 발행될 수 있어요. (40점)' : '발행량을 아는 곳이 없어요.' };
  // Against the world price at Upbit's own USDT rate, so the premium every coin shares is left out.
  const world = p && k ? p.priceUsd * k : null, prem = world ? (input.upbitPrice / world - 1) * 100 : null;
  const gap: FitAxis = { key: 'gap', label: '가격 괴리', score: prem != null ? clamp(100 - Math.abs(prem) * 8) : null,
    value: prem != null ? `해외보다 ${prem >= 0 ? '+' : ''}${prem.toFixed(1)}%` : '자료 없음',
    note: prem != null ? `해외 평균 가격을 업비트 테더 가격으로 바꿔 비교했어요. ${Math.abs(prem) >= 5 ? '차이가 커서 해외 가격으로 되돌아갈 위험이 있어요.' : '거의 같아요.'} (0% 100점, ±12.5% 0점)` : '해외 시세를 찾지 못해 비교할 수 없어요.' };
  const first = p?.firstDate ?? null, years = first ? yearsBetween(first, input.date) : null;
  const upbitDays = input.listed ? Math.round(yearsBetween(input.upbitFirst, input.date) * 365.25) + 1 : null;
  const athGap = p?.athUsd && p.priceUsd ? (p.priceUsd / p.athUsd - 1) * 100 : null;
  const age: FitAxis = { key: 'age', label: '이력', score: years != null ? clamp(years * 20) : null,
    value: years != null ? `거래 ${span(years)}${upbitDays != null ? ` · 업비트 ${upbitDays}일` : ''}` : upbitDays != null ? `업비트 ${upbitDays}일` : '자료 없음',
    note: `${athGap != null && p?.athDate ? `역대 최고가 대비 ${athGap.toFixed(0)}% (${p.athDate}). ` : ''}기록이 짧을수록 신호가 덜 믿을 만해요. (5년이면 100점)` };
  const axes = [size, liquidity, supply, gap, age], scored = axes.filter((a) => a.score != null);
  const timeline = [
    ...(first ? [{ date: first, text: '해외 거래소에서 첫 거래' }] : []),
    ...(p?.athDate && athGap != null ? [{ date: p.athDate, text: athGap < -1 ? `역대 최고가 (지금의 약 ${(100 / (100 + athGap)).toFixed(1)}배)` : '역대 최고가' }] : []),
    ...(input.listed ? [{ date: input.upbitFirst, text: '업비트 원화 마켓 상장' }] : []),
  ].sort((a, b) => (a.date < b.date ? -1 : 1));
  const h = input.history, NAME = { binance: '바이낸스', okx: 'OKX', bithumb: '빗썸' } as const;
  const historyNote = h?.added && h.source ? `업비트 상장 전 ${h.added}일은 ${NAME[h.source]} 가격을 원화로 바꿔 이어 붙여서 차트와 52주 고점을 계산해요.${h.trimmed ? ' 상장 첫날 몇 분 튄 고가·저가는 뺐어요.' : ''}`
    : h?.trimmed ? '상장 첫날 몇 분 튄 고가·저가는 52주 고점 계산에서 뺐어요.' : '';
  return { date: input.date, total: scored.length ? Math.round(scored.reduce((s, a) => s + a.score!, 0) / scored.length) : null, axes, timeline, cautions: [...(input.cautions ?? [])], warning: !!input.warning, historyNote };
}
