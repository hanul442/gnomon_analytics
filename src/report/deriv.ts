// G-142: 선물 지표 card for coins (funding, open interest, long/short accounts, recent liquidations), filled
// in the browser from the API's /deriv (OKX public data, cached a minute). A coin without a USDT perpetual
// hides the card.

import { esc } from './html.js';

export function derivSlot(symbol: string): string {
  return `<section class="card dv-card" data-deriv="${esc(symbol)}" hidden><div class="head"><h2>선물 지표</h2><span class="sub">OKX 무기한 선물 · 1분마다 갱신</span></div><div class="dv-body"><p class="muted">불러오는 중이에요…</p></div></section>`;
}

export const DERIV_CSS = `.dv-card{margin:14px 0}.dv-card .head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}.dv-card h2{font-size:17px;margin:0 0 6px}
.dv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.dv-t{background:#f6f8fc;border-radius:14px;padding:12px 14px;min-width:0;display:flex;flex-direction:column;gap:4px}
.dv-t>span{font-size:12.5px;font-weight:800;color:var(--fg2)}.dv-t>b{font-size:19px;font-variant-numeric:tabular-nums}.dv-t>small{font-size:12px;color:var(--muted);line-height:1.4}
.dv-t svg{width:100%;height:34px;display:block}.dv-liq{display:flex;height:10px;border-radius:99px;overflow:hidden;background:#e9edf3;margin:2px 0}.dv-liq i{display:block}.dv-liq .l{background:#3182f6}.dv-liq .s{background:#f04452}
@media (max-width:520px){.dv-grid{grid-template-columns:minmax(0,1fr)}}`;

export const DERIV_JS = `
(function () {
  var boxes = document.querySelectorAll('[data-deriv]'); if (!boxes.length) return;
  var usd = function (v) { var a = Math.abs(v); return '$' + (a >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v.toFixed(0)); };
  var spark = function (vals, color) { if (vals.length < 2) return ''; var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), sp = hi - lo || 1; var p = vals.map(function (v, i) { return (i / (vals.length - 1) * 200).toFixed(1) + ',' + (32 - (v - lo) / sp * 28).toFixed(1); }).join(' '); return '<svg viewBox="0 0 200 34" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + p + '" fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>'; };
  var hm = function (iso) { var d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  var paint = function (box, d) {
    var t = [];
    if (d.funding) { var r = d.funding.rate * 100, yr = d.funding.rate * 3 * 365 * 100; t.push('<div class="dv-t"><span>펀딩비 (8시간)</span><b class="' + (r > 0 ? 'up' : r < 0 ? 'down' : '') + '">' + (r > 0 ? '+' : '') + r.toFixed(4) + '%</b><small>' + (r > 0.01 ? '롱이 숏에게 내요 · 롱 쏠림' : r < 0 ? '숏이 롱에게 내요 · 숏 쏠림' : '쏠림 적음') + ' · 연환산 ' + yr.toFixed(1) + '%' + (d.funding.nextAt ? ' · 다음 ' + hm(d.funding.nextAt) : '') + '</small></div>'); }
    if (d.oi) { var h = d.oi.history.map(function (x) { return x[1]; }), w = h.length > 7 ? (h[h.length - 1] / h[h.length - 8] - 1) * 100 : null; t.push('<div class="dv-t"><span>미결제약정</span><b>' + usd(d.oi.usd) + '</b>' + spark(h, '#2e4268') + '<small>' + (w == null ? '' : '7일 ' + (w > 0 ? '+' : '') + w.toFixed(1) + '% · ') + '쌓인 선물 포지션 규모예요. 가격과 함께 늘면 추세에 힘이 실려요.</small></div>'); }
    if (d.longShort.length) { var ls = d.longShort.map(function (x) { return x[1]; }), last = ls[ls.length - 1], lp = last / (1 + last) * 100; t.push('<div class="dv-t"><span>롱/숏 계정 비율</span><b>' + last.toFixed(2) + '</b>' + spark(ls, '#c9a227') + '<small>롱 ' + lp.toFixed(0) + '% · 숏 ' + (100 - lp).toFixed(0) + '% (계정 수). 한쪽으로 크게 쏠리면 반대로 흔들리기 쉬워요.</small></div>'); }
    if (d.liquidations && d.liquidations.count) { var L = d.liquidations, tot = L.longUsd + L.shortUsd || 1; t.push('<div class="dv-t"><span>최근 청산 ' + L.count + '건</span><b>' + usd(L.longUsd + L.shortUsd) + '</b><div class="dv-liq" role="img" aria-label="롱 청산 ' + usd(L.longUsd) + ', 숏 청산 ' + usd(L.shortUsd) + '"><i class="l" style="width:' + (L.longUsd / tot * 100).toFixed(1) + '%"></i><i class="s" style="width:' + (L.shortUsd / tot * 100).toFixed(1) + '%"></i></div><small>롱 청산 ' + usd(L.longUsd) + ' · 숏 청산 ' + usd(L.shortUsd) + (L.from ? ' · ' + hm(L.from) + '~' + hm(L.to) : '') + '</small></div>'); }
    if (!t.length) { box.hidden = true; return; }
    box.querySelector('.dv-body').innerHTML = '<div class="dv-grid">' + t.join('') + '</div><p class="fine">출처: OKX ' + d.instId + ' 공개 데이터. 업비트 현물과 거래소가 달라 참고용이에요.</p>';
    box.hidden = false;
  };
  var load = function (box) {
    var sym = box.getAttribute('data-deriv') || new URLSearchParams(location.search).get('m') || ''; var ccy = sym.replace(/^KRW-/, '');
    var api = window.GNM && GNM.api; if (!api || !/^[A-Z0-9]{2,10}$/.test(ccy)) return;
    fetch(api + '/deriv?ccy=' + ccy).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.deriv) paint(box, j.deriv); else box.hidden = true; }).catch(function () { box.hidden = true; });
  };
  var go = function () { boxes.forEach(function (b) { load(b); setInterval(function () { if (!document.hidden) load(b); }, 60000); }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
`;
