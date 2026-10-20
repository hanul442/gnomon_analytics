// G-277: the coin's 체력 tab card (in place of 기업 체력): the same radar and verdict lines as a stock's 기업 체력
// 한눈에, then the coin's dated history and Upbit's caution flags. Built when the coin list is (src/cli/coins.ts) and
// kept as html in c/<market>.json, so the free coin page and a coin's report page show the same card.

import type { CoinFitness } from '../analysis/coinFitness.js';
import { esc } from './html.js';
import { radarChart } from './kit/finance.js';
import { UPBIT_CAUTIONS } from '../sources/upbit.js';

const verdict = (s: number | null) => (s == null ? ['na', '자료 없음'] : s >= 67 ? ['good', '좋음'] : s >= 34 ? ['mid', '보통'] : ['warn', '주의']);

export function coinFitnessCard(f: CoinFitness): string {
  const on = new Set(f.cautions);
  const flags = UPBIT_CAUTIONS.map(([, label]) => `<span class="cf-chip${on.has(label) ? ' on' : ''}">${esc(label)} · ${on.has(label) ? '켜짐' : '꺼짐'}</span>`).join('');
  return `<section class="card ig-card ig-hc cf-card"><div class="head"><h2>코인 체력 한눈에</h2>${f.total == null ? '' : `<span class="muted small">다섯 축 평균 <b class="cf-total">${f.total}</b>점</span>`}</div>
<p class="fine">코인에는 매출·부채가 없어서 덩치·거래·공급·가격 괴리·이력으로 체력을 봐요.</p>
<div class="ig-health">${radarChart(f.axes)}<ul class="ig-hl">${f.axes.map((a, i) => { const [cls, word] = verdict(a.score); return `<li title="${esc(a.note)}" data-i="${i}" tabindex="0"><b>${esc(a.label)}</b><span class="ig-v ${cls}">${a.score == null ? word : `${word} ${a.score}`}</span><em>${esc(a.value)}</em><small>${esc(a.note)}</small></li>`; }).join('')}</ul></div></section>
${f.timeline.length || f.historyNote ? `<section class="card block cf-card"><h2>거래 이력</h2>${f.timeline.length ? `<ol class="cf-tl">${f.timeline.map((t) => `<li><span>${esc(t.date)}</span><b>${esc(t.text)}</b></li>`).join('')}</ol>` : ''}${f.historyNote ? `<p class="cf-hist">${esc(f.historyNote)}</p>` : ''}</section>` : ''}
<section class="card block cf-card"><div class="head"><h2>업비트 주의 항목</h2><span class="muted small">${f.warning ? '<b class="cf-warn">유의 종목</b> · ' : ''}5개 중 ${on.size}개 켜짐</span></div><div class="cf-chips">${flags}</div></section>
<p class="fine">${esc(f.date)} 기준 · 시가총액·발행량·역대 최고가·첫 거래일은 CoinPaprika, 거래대금·주의 항목은 업비트예요. 계산 결과이고, 투자 권유가 아니에요.</p>`;
}

export const COIN_FIT_CSS = `.cf-card .head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}.cf-card h2{font-size:17px;margin:0 0 6px}.cf-total{font-size:20px;color:var(--fg)}
.cf-card .ig-hl em{white-space:normal;text-align:left}.cf-card .ig-hl li{grid-template-columns:3.6em auto minmax(0,1fr)}.cf-card .ig-hl small{grid-column:1/-1;font-size:12px;line-height:1.5;color:var(--muted)}
.cf-tl{list-style:none;margin:4px 0 0;padding:0}.cf-tl li{position:relative;padding:0 0 14px 22px;display:flex;flex-direction:column;gap:2px}.cf-tl li::before{content:"";position:absolute;left:4px;top:6px;width:10px;height:10px;border-radius:50%;background:var(--fg)}.cf-tl li::after{content:"";position:absolute;left:8px;top:18px;bottom:2px;width:2px;background:var(--line)}.cf-tl li:last-child::after{display:none}.cf-tl span{font-size:12px;color:var(--muted)}.cf-tl b{font-size:14px;font-weight:500}
.cf-hist{margin:4px 0 0;font-size:12px;line-height:1.5;color:var(--fg2);padding:10px 12px;border-radius:12px;background:var(--soft)}
.cf-chips{display:flex;flex-wrap:wrap;gap:6px}.cf-chip{font-size:12px;padding:5px 10px;border-radius:999px;border:1px solid var(--line-strong);color:var(--fg2)}.cf-chip.on{border-color:var(--up-strong);color:var(--up-strong);background:var(--up-soft);font-weight:700}.cf-warn{color:var(--up-strong)}`;

/**
 * Fills [data-coin-fit] slots: on a coin's report page the slot names its c/<market>.json; the free coin page passes
 * the json it already has (GNM_coinFit(el, d)). A coin the list never built leaves the slot empty.
 */
export const COIN_FIT_SCRIPT = `<script>
(function () {
  var put = function (el, d) { if (el && d && d.fitness && d.fitness.html) el.innerHTML = d.fitness.html; };
  window.GNM_coinFit = put;
  document.querySelectorAll('[data-coin-fit]').forEach(function (el) {
    var src = el.getAttribute('data-coin-fit'); if (!src) return;
    fetch(src).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { put(el, d); }).catch(function () {});
  });
})();
</script>`;
