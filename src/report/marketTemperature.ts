import type { MarketPulse, PulseBucket } from '../analysis/quickCalc.js';
import { LEVEL_LABEL } from '../analysis/technicals.js';
import { esc } from './html.js';
import { kmDonut, kmGauge } from './kit/market.js';
const BUCKETS: readonly [PulseBucket, string, string][] = [
  ['STRONG_BULLISH', LEVEL_LABEL.STRONG_BULLISH, '#a8262b'], ['BULLISH', LEVEL_LABEL.BULLISH, '#e5484d'], ['SLIGHTLY_BULLISH', LEVEL_LABEL.SLIGHTLY_BULLISH, '#f0a0a3'],
  ['NEUTRAL', LEVEL_LABEL.NEUTRAL, '#c4cbc9'],
  ['SLIGHTLY_BEARISH', LEVEL_LABEL.SLIGHTLY_BEARISH, '#8fb3ec'], ['BEARISH', LEVEL_LABEL.BEARISH, '#3b7be0'], ['STRONG_BEARISH', LEVEL_LABEL.STRONG_BEARISH, '#1d4fa3'],
];

/** G-258: today's up / flat / down stocks as a donut (Bklit pie-chart), the up share in the middle. */
function breadthDonut(up: number, down: number, flat: number, name: string): string {
  const total = up + down + flat, share = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const lead = down > up ? { v: `${share(down)}%`, l: '내린 종목', tone: 'down' } : { v: `${share(up)}%`, l: '오른 종목', tone: up > down ? 'up' : '' };
  return kmDonut([
    { label: '상승', value: up, color: '#f04452', tone: 'up' },
    { label: '보합', value: flat, color: 'var(--muted)', tone: '' },
    { label: '하락', value: down, color: '#3182f6', tone: 'down' },
  ], lead, `${name} 오늘 상승 ${up}개, 보합 ${flat}개, 하락 ${down}개`);
}

export function marketTemperature(p: MarketPulse | null, breadth: {up:number;down:number;flat:number},name='시장',href='screener.html'): string {
  const {up,down,flat}=breadth;
  if(!p&&!up&&!down&&!flat)return '';
  const total=up+down+flat, share=(n:number)=>total?Math.round(n/total*100):0, n=(v:number)=>v.toLocaleString('ko-KR');
  const legend=`<ul class="km-legend"><li><span><i style="background:#f04452"></i>상승</span><b class="up">${n(up)}개 · ${share(up)}%</b></li><li><span><i style="background:var(--muted)"></i>보합</span><b>${n(flat)}개 · ${share(flat)}%</b></li><li><span><i style="background:#3182f6"></i>하락</span><b class="down">${n(down)}개 · ${share(down)}%</b></li></ul>`;
  if(!p){return `<a class="card ix tmp" href="${esc(href)}"><div class="pl-k">${esc(name)} · 일간 등락 분포</div><b class="tmp-v">${down>up?'내린 종목이 많아요':up>down?'오른 종목이 많아요':'등락이 엇갈려요'}</b><div class="km-tmp-row">${breadthDonut(up,down,flat,name)}${legend}</div><small>기술 신호를 확보하지 못해 일간 등락 분포를 보여 드려요.</small></a>`;}
  const counted = Math.max(1, p.counted), pct = (v: number) => Math.round((v / counted) * 100);
  const lean = p.bull - p.bear, verdict = lean > p.counted * 0.1 ? '강세 종목이 많아요' : lean < -p.counted * 0.1 ? '약세 종목이 많아요' : '강세·약세가 엇갈려요';
  const pp = pct(p.bull) - pct(p.bear);
  const gauge = kmGauge(lean / counted, { v: `${pp > 0 ? '+' : ''}${pp}%p`, l: '강세−약세', tone: pp > 0 ? 'up' : pp < 0 ? 'down' : '' }, `${name} 온도: 강세 ${pct(p.bull)}%, 약세 ${pct(p.bear)}%`);
  const today = total ? `<figure>${breadthDonut(up,down,flat,name)}<figcaption>오늘 등락 <span class="up">▲${n(up)}</span> · <span class="down">▼${n(down)}</span></figcaption></figure>` : '';
  return `<a class="card ix tmp" href="${esc(href)}"><div class="pl-k">${esc(name)} 온도 <span class="muted">· ${p.counted.toLocaleString('ko-KR')}종목 기술 신호</span></div><b class="tmp-v ${lean > 0 ? 'up' : lean < 0 ? 'down' : ''}">${verdict}</b>
<div class="km-tmp-row"><figure>${gauge}<figcaption>기술 신호 기울기</figcaption></figure>${today}</div>
<div class="pulse-bar" role="img" aria-label="${BUCKETS.map(([k, l]) => `${l} ${p.buckets[k]}종목`).join(', ')}">${BUCKETS.map(([k, l, c]) => (p.buckets[k] ? `<span style="flex:${p.buckets[k]};background:${c}" title="${l} ${p.buckets[k]}종목"></span>` : '')).join('')}</div>
<div class="tmp-n"><span class="up">강세 ${pct(p.bull)}%</span><span class="muted">중립 ${pct(p.neutral)}%</span><span class="down">약세 ${pct(p.bear)}%</span></div><small class="muted">신호 기준 ${esc(p.date)}${p.buckets.WITHHELD?` · 판단 보류 ${p.buckets.WITHHELD}개`:''}</small></a>`;
}
