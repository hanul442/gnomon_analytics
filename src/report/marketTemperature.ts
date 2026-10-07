import type { MarketPulse, PulseBucket } from '../analysis/quickCalc.js';
import { LEVEL_LABEL } from '../analysis/technicals.js';
import { esc } from './html.js';
const BUCKETS: readonly [PulseBucket, string, string][] = [
  ['STRONG_BULLISH', LEVEL_LABEL.STRONG_BULLISH, '#a8262b'], ['BULLISH', LEVEL_LABEL.BULLISH, '#e5484d'], ['SLIGHTLY_BULLISH', LEVEL_LABEL.SLIGHTLY_BULLISH, '#f0a0a3'],
  ['NEUTRAL', LEVEL_LABEL.NEUTRAL, '#c4cbc9'],
  ['SLIGHTLY_BEARISH', LEVEL_LABEL.SLIGHTLY_BEARISH, '#8fb3ec'], ['BEARISH', LEVEL_LABEL.BEARISH, '#3b7be0'], ['STRONG_BEARISH', LEVEL_LABEL.STRONG_BEARISH, '#1d4fa3'],
];

export function marketTemperature(p: MarketPulse | null, breadth: {up:number;down:number;flat:number},name='시장',href='screener.html'): string {
  const {up,down,flat}=breadth;
  if(!p&&!up&&!down&&!flat)return '';
  const today=`오늘 <span class="up">▲${up.toLocaleString('ko-KR')}</span> · <span class="down">▼${down.toLocaleString('ko-KR')}</span> · 보합 ${flat.toLocaleString('ko-KR')}`;
  if(!p){const total=up+down+flat;return `<a class="card ix tmp" href="${esc(href)}"><div class="pl-k">${esc(name)} · 일간 등락 분포</div><b class="tmp-v">${down>up?'내린 종목이 많아요':up>down?'오른 종목이 많아요':'등락이 엇갈려요'}</b><div class="br-bar"><span class="s-bull" style="flex:${up}"></span><span class="s-neutral" style="flex:${flat}"></span><span class="s-bear" style="flex:${down}"></span></div><div class="tmp-n"><span class="up">상승 ${total?Math.round(up/total*100):0}%</span><span>보합 ${total?Math.round(flat/total*100):0}%</span><span class="down">하락 ${total?Math.round(down/total*100):0}%</span></div><div class="muted small">${today}</div><small>기술 신호를 확보하지 못해 일간 등락 분포를 표시합니다.</small></a>`;}
  const pct = (n: number) => Math.round((n / p.counted) * 100);
  const lean = p.bull - p.bear, verdict = lean > p.counted * 0.1 ? '강세 종목이 많아요' : lean < -p.counted * 0.1 ? '약세 종목이 많아요' : '강세·약세가 엇갈려요';
  return `<a class="card ix tmp" href="${esc(href)}"><div class="pl-k">${esc(name)} 온도 <span class="muted">· ${p.counted.toLocaleString('ko-KR')}종목 기술 신호</span></div><b class="tmp-v ${lean > 0 ? 'up' : lean < 0 ? 'down' : ''}">${verdict}</b>
<div class="pulse-bar" role="img" aria-label="${BUCKETS.map(([k, l]) => `${l} ${p.buckets[k]}종목`).join(', ')}">${BUCKETS.map(([k, l, c]) => (p.buckets[k] ? `<span style="flex:${p.buckets[k]};background:${c}" title="${l} ${p.buckets[k]}종목"></span>` : '')).join('')}</div>
<div class="tmp-n"><span class="up">강세 ${pct(p.bull)}%</span><span class="muted">중립 ${pct(p.neutral)}%</span><span class="down">약세 ${pct(p.bear)}%</span></div><div class="muted small">${today}</div><small class="muted">신호 기준 ${esc(p.date)}${p.buckets.WITHHELD?` · 판단 보류 ${p.buckets.WITHHELD}개`:''}</small></a>`;
}
