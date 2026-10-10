// G-195: 공매도·신용 card for Korean stocks, filled in the browser from the API's /short (KRX short selling, Naver
// volume and market credit, cached an hour). It borrows the coin 선물 지표 card's tiles (DERIV_CSS). A code KRX
// does not know, or no API, hides the card.

import { esc } from './html.js';

export function shortSlot(code: string): string {
  return `<section class="card dv-card sh-card" data-short="${esc(code)}" hidden><div class="head"><h2>공매도·신용</h2><span class="sub">한국거래소·네이버 증권 · 하루 한 번 갱신</span></div><div class="dv-body"><p class="muted">불러오는 중이에요…</p></div></section>`;
}

export const SHORT_CSS = `.sh-card .dv-t svg polyline{stroke:var(--accent)}.sh-card .dv-t b.hot{color:var(--warn-strong)}`;

export const SHORT_JS = `
(function () {
  var boxes = document.querySelectorAll('[data-short]'); if (!boxes.length) return;
  var won = function (v) { var e = v / 1e8; return Math.abs(e) >= 1e4 ? (e / 1e4).toFixed(2) + '조' : Math.abs(e) >= 1 ? Math.round(e).toLocaleString('ko-KR') + '억' : Math.round(v / 1e4).toLocaleString('ko-KR') + '만'; };
  var eok = function (v) { return v >= 1e4 ? (v / 1e4).toFixed(1) + '조' : Math.round(v).toLocaleString('ko-KR') + '억'; };
  var md = function (d) { return Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)); };
  var pct = function (v, d) { return (v > 0 ? '+' : '') + v.toFixed(d == null ? 1 : d) + '%'; };
  var spark = function (vals) { if (vals.length < 2) return ''; var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), sp = hi - lo || 1; var p = vals.map(function (v, i) { return (i / (vals.length - 1) * 200).toFixed(1) + ',' + (32 - (v - lo) / sp * 28).toFixed(1); }).join(' '); return '<svg viewBox="0 0 200 34" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + p + '" fill="none" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>'; };
  var avg = function (xs) { return xs.length ? xs.reduce(function (a, b) { return a + b; }, 0) / xs.length : null; };
  var paint = function (box, s) {
    var t = [], vol = {}; s.volume.forEach(function (x) { vol[x[0]] = x[1]; });
    // The short share of each day's trading, where Naver has that day's volume.
    var share = s.days.filter(function (d) { return vol[d[0]] > 0; }).map(function (d) { return [d[0], d[1] / vol[d[0]] * 100, d[2]]; });
    if (share.length) {
      var last = share[share.length - 1], base = avg(share.slice(-21, -1).map(function (x) { return x[1]; })), x = base ? last[1] / base : null;
      t.push('<div class="dv-t"><span>공매도 비중 · ' + md(last[0]) + '</span><b class="' + (x != null && x >= 2 ? 'hot' : '') + '">' + last[1].toFixed(1) + '%</b>' + spark(share.slice(-60).map(function (v) { return v[1]; })) + '<small>그날 거래량 중 공매도 몫 · 거래대금 ' + won(last[2]) + (base != null ? ' · 20일 평균 ' + base.toFixed(1) + '%' + (x >= 2 ? ' (평소의 ' + x.toFixed(1) + '배)' : '') : '') + '</small></div>');
    }
    var bal = s.days.filter(function (d) { return d[3] != null; });
    if (bal.length) {
      var b = bal[bal.length - 1], ago = bal.length > 20 ? bal[bal.length - 21] : bal[0], ch = ago[3] ? (b[3] / ago[3] - 1) * 100 : null;
      t.push('<div class="dv-t"><span>공매도 잔고 · ' + md(b[0]) + '</span><b>' + b[3].toLocaleString('ko-KR') + '주</b>' + spark(bal.slice(-60).map(function (v) { return v[3]; })) + '<small>' + (b[4] != null ? '약 ' + won(b[4]) + ' · ' : '') + (ch != null && ago !== b ? md(ago[0]) + '보다 ' + pct(ch) + ' · ' : '') + '보고 의무가 생긴 몫만 합쳐 이틀 늦게 나와요.</small></div>');
    }
    if (s.credit.length) {
      var c = s.credit[s.credit.length - 1], c0 = s.credit.length > 20 ? s.credit[s.credit.length - 21] : s.credit[0], cc = c0[2] ? (c[2] / c0[2] - 1) * 100 : null;
      t.push('<div class="dv-t"><span>시장 전체 신용융자 · ' + md(c[0]) + '</span><b>' + eok(c[2]) + '</b>' + spark(s.credit.map(function (v) { return v[2]; })) + '<small>빚을 내 산 주식 규모예요' + (cc != null && c0 !== c ? ' · ' + md(c0[0]) + '보다 ' + pct(cc) : '') + ' · 고객예탁금 ' + eok(c[1]) + '(예탁금의 ' + (c[2] / c[1] * 100).toFixed(0) + '%)</small></div>');
    }
    if (!t.length) { box.hidden = true; return; }
    box.querySelector('.dv-body').innerHTML = '<div class="dv-grid">' + t.join('') + '</div><p class="fine">공매도: 한국거래소(KRX·NXT 합산). 거래량·신용융자·예탁금: 네이버 증권. 종목별 신용잔고는 공개된 출처가 없어 시장 전체 수치를 보여 드려요. 공매도가 많다고 꼭 내리는 건 아니에요(헤지·차익거래도 포함).</p>';
    box.hidden = false;
  };
  var go = function () { boxes.forEach(function (box) {
    var code = (box.getAttribute('data-short') || new URLSearchParams(location.search).get('c') || '').toUpperCase();
    var api = window.GNM && GNM.api; if (!api || !/^[0-9][0-9A-Z]{5}$/.test(code)) return;
    fetch(api + '/short?code=' + code).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.short) paint(box, j.short); else box.hidden = true; }).catch(function () { box.hidden = true; });
  }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
`;
