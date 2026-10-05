// Coins list (docs/DESIGN.md §5.17, G-54): every Upbit KRW market with the free computation, from
// site/coins.json. Free: the list, signals and moves. Plus: the fair-value column (same as stocks).

import { shell } from './renderHtml.js';

export function renderCoins(): string {
  const body = `<section class="hero" id="top"><div class="hero-main"><div class="eyebrow"><span>코인</span><span id="cn-count"></span></div><h1>업비트 원화 마켓 전체</h1>
<p class="hero-line">코인마다 주식과 같은 지표 16개, 기간별 등락, 거래량 급증, 기술적 적정가를 매일 계산해요. 일봉은 09:00(KST)에 끊어요.</p>
<label class="search-box" style="margin-top:12px"><input id="cn-q" type="search" placeholder="코인 이름이나 심볼 (예: 비트코인, BTC)" autocomplete="off" aria-label="코인 검색"></label></div></section>
<section class="block"><div class="card sc-form"><div class="sc-top">
<label class="sc-inline">기술 신호<select id="cn-level"><option value="">전체</option><option value="BULL">강세 쪽</option><option value="BEAR">약세 쪽</option><option value="NEUTRAL">중립</option></select></label>
<label class="sc-inline">정렬<select id="cn-sort"><option value="value">거래대금 큰 순</option><option value="chg">24시간 등락 큰 순</option><option value="chga">24시간 등락 작은 순</option><option value="score">신호 점수 높은 순</option><option value="vol1">거래량 급증 큰 순</option><option value="r20">20일 등락 큰 순</option></select></label>
<label class="sc-inline"><input type="checkbox" id="cn-warn"> 유의 종목 빼기</label></div></div></section>
<section class="block"><div class="card list"><div class="table-wrap"><table class="compact sc-table"><thead><tr><th>코인</th><th class="num">현재가</th><th class="num">24시간</th><th>기술 신호</th><th class="num">거래량</th><th class="num">20일</th><th class="num">적정가 대비</th><th class="num">거래대금(24h)</th></tr></thead><tbody id="cn-body"><tr><td colspan="8" class="empty">불러오는 중이에요.</td></tr></tbody></table></div></div></section>
<style>.sc-top{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}.sc-inline{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--fg2)}.sc-form select{font:inherit;font-size:14px;border:1px solid var(--line-strong);border-radius:10px;padding:7px 9px;background:#fff}
.sc-table td a{text-decoration:none}.warn{display:inline-block;margin-left:4px;font-size:11px;font-weight:700;border-radius:6px;padding:0 5px;background:#fde8e8;color:#9b1c1c}
html[data-plan=free] .sc-table th:nth-child(7),html[data-plan=free] .sc-table td:nth-child(7){display:none}
@media (max-width:820px){.sc-table th:nth-child(5),.sc-table td:nth-child(5),.sc-table th:nth-child(8),.sc-table td:nth-child(8){display:none}}</style>
<footer id="sources" style="padding:24px 0 0"><p>데이터: 업비트 공개 시세. 가상자산은 변동성이 매우 크고 원금 손실 위험이 커요. 계산 결과이고, 투자 권유가 아니에요.</p></footer>`;
  return shell('', '코인 | Gnomon Analytics', body, { active: 'coins', scripts: COINS_SCRIPT });
}

const COINS_SCRIPT = `<script>
(function () {
  var $ = function (id) { return document.getElementById(id); }, rows = [];
  var LEVEL = { STRONG_BULLISH: '강한 강세', BULLISH: '강세', SLIGHTLY_BULLISH: '약간 강세', NEUTRAL: '중립', SLIGHTLY_BEARISH: '약간 약세', BEARISH: '약세', STRONG_BEARISH: '강한 약세', WITHHELD: '보류' };
  var BULL = ['STRONG_BULLISH', 'BULLISH', 'SLIGHTLY_BULLISH'], BEAR = ['STRONG_BEARISH', 'BEARISH', 'SLIGHTLY_BEARISH'];
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var pct = function (v) { return v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(1) + '%'; };
  var tone = function (v) { return v == null || v === 0 ? '' : v > 0 ? 'up' : 'down'; };
  var won = function (v) { var a = Math.abs(v); return (a >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: a >= 1 ? 2 : 4 })) + '원'; };
  var draw = function () {
    var q = $('cn-q').value.trim().toUpperCase(), lv = $('cn-level').value, sort = $('cn-sort').value, noWarn = $('cn-warn').checked;
    var out = rows.filter(function (r) {
      if (q && r[1].toUpperCase().indexOf(q) < 0 && r[0].indexOf(q) < 0 && String(r[2]).toUpperCase().indexOf(q) < 0) return false;
      if (noWarn && r[3]) return false;
      if (lv === 'BULL' && BULL.indexOf(r[6]) < 0) return false;
      if (lv === 'BEAR' && BEAR.indexOf(r[6]) < 0) return false;
      if (lv === 'NEUTRAL' && r[6] !== 'NEUTRAL') return false;
      return true;
    });
    var by = { value: function (r) { return -(r[12] || 0); }, chg: function (r) { return -(r[5] == null ? -999 : r[5]); }, chga: function (r) { return r[5] == null ? 999 : r[5]; }, score: function (r) { return -(r[7] == null ? -999 : r[7]); }, vol1: function (r) { return -(r[11] || 0); }, r20: function (r) { return -(r[9] == null ? -999 : r[9]); } }[sort];
    out.sort(function (a, b) { return by(a) - by(b); });
    $('cn-count').textContent = rows.length + '개 중 ' + out.length + '개';
    $('cn-body').innerHTML = out.length ? out.slice(0, 300).map(function (r) {
      return '<tr><td><a href="coin.html?m=' + r[0] + '"><b>' + esc(r[1]) + '</b></a>' + (r[3] ? '<span class="warn" title="업비트 유의 종목">유의</span>' : '') + '<div class="muted small">' + esc(r[0].replace('KRW-', '')) + '</div></td><td class="num">' + won(r[4]) + '</td><td class="num ' + tone(r[5]) + '">' + pct(r[5]) + '</td><td><span class="sig ' + (BULL.indexOf(r[6]) >= 0 ? 'up' : BEAR.indexOf(r[6]) >= 0 ? 'down' : '') + '">' + LEVEL[r[6]] + '</span></td><td class="num">' + (r[11] == null ? '—' : r[11].toFixed(1) + '배') + '</td><td class="num ' + tone(r[9]) + '">' + pct(r[9]) + '</td><td class="num">' + pct(r[13]) + '</td><td class="num">' + (r[12] == null ? '—' : r[12].toLocaleString('ko-KR') + '억') + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="empty">조건에 맞는 코인이 없어요.</td></tr>';
  };
  ['cn-q', 'cn-level', 'cn-sort', 'cn-warn'].forEach(function (id) { $(id).addEventListener('input', draw); $(id).addEventListener('change', draw); });
  fetch('coins.json').then(function (r) { return r.json(); }).then(function (d) { rows = d.rows || []; draw(); }).catch(function () { $('cn-body').innerHTML = '<tr><td colspan="8" class="empty">코인 데이터를 불러오지 못했어요.</td></tr>'; });
})();
</script>`;
