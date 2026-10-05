// Screener (docs/DESIGN.md §5.12, G-43): every listed stock's free daily computation, filterable in the
// browser. Free: one preset and the top five rows. Plus: every condition and every row. Pro (coming):
// back-testing a condition. Data: site/screener.json, rebuilt every run.

import type { StockCalc } from '../analysis/quickCalc.js';
import type { UniverseRow } from '../sources/naverList.js';
import { shell } from './renderHtml.js';

/** One row per stock: [code, name, market, cap(억), close, change%, level, score×100, r5, r20, r120, fairGap%, position, covered]. */
export type ScreenerRow = [string, string, 'P' | 'Q', number | null, number, number | null, string, number | null, number | null, number | null, number | null, number | null, 'A' | 'I' | 'B' | null, 0 | 1];

export function screenerRows(universe: readonly UniverseRow[], calcs: ReadonlyMap<string, StockCalc>, covered: ReadonlySet<string>): ScreenerRow[] {
  const r1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10);
  return universe.filter((u) => calcs.has(u.symbol)).map((u) => {
    const c = calcs.get(u.symbol)!;
    const mv = (d: number) => r1(c.moves.find((m) => m.days === d)?.pct);
    return [u.symbol, u.name, u.market === 'KOSPI' ? 'P' : 'Q', u.marketCap == null ? null : Math.round(u.marketCap / 1e8), c.close, r1(u.changePct),
      c.signal.level ?? 'WITHHELD', c.signal.score == null ? null : Math.round(c.signal.score * 100), mv(5), mv(20), mv(120),
      c.fair ? r1(c.fair.gapPct) : null, c.fair ? (c.fair.position === 'ABOVE' ? 'A' : c.fair.position === 'BELOW' ? 'B' : 'I') : null, covered.has(u.symbol) ? 1 : 0];
  });
}

const PRESETS: readonly [string, string, string][] = [
  ['top', '강세 신호 상위', '지표 16개 종합 점수가 높은 순'],
  ['value', '강세 신호인데 적정가 아래', '지표가 강세 쪽인데 가격은 적정가 범위보다 아래인 종목'],
  ['rebound', '많이 내린 뒤 반등 신호', '20거래일 10% 넘게 내렸지만 지표가 강세 쪽으로 돌아선 종목'],
  ['large', '시가총액 1조 이상 강세', '큰 종목 가운데 지표가 강세 쪽인 종목'],
  ['hot', '적정가 위로 과열', '적정가 범위보다 15% 넘게 위에 있는 종목'],
];

export function renderScreener(): string {
  const body = `<section class="hero" id="top"><div class="hero-main"><div class="eyebrow"><span>스크리너</span><span id="sc-count"></span></div><h1>전 종목을 조건으로 걸러 보세요</h1>
<p class="hero-line">매일 장 마감 뒤 코스피·코스닥 전 종목의 지표 16개, 기간별 등락, 기술적 적정가를 계산해요. 그 값으로 조건 검색을 해요.</p></div></section>
<section class="block"><div class="pl-chips sc-presets" role="group" aria-label="빠른 조건">${PRESETS.map(([k, l, d], i) => `<button type="button" class="chip-toggle" data-preset="${k}" aria-pressed="${i === 0}" title="${d}">${l}${i ? ' <span class="lockmark">플러스</span>' : ''}</button>`).join('')}</div></section>
<section class="block"><div class="card sc-form" id="sc-form"><div class="sc-grid">
<label>시장<select name="market"><option value="">전체</option><option value="P">코스피</option><option value="Q">코스닥</option></select></label>
<label>시가총액(억 원) 이상<input name="cap" type="number" min="0" step="1000" placeholder="예: 5000"></label>
<label>기술 신호<select name="level"><option value="">전체</option><option value="BULL">강세 쪽(약간 강세 이상)</option><option value="STRONG">강한 강세</option><option value="BEAR">약세 쪽</option><option value="NEUTRAL">중립</option></select></label>
<label>20거래일 등락(%)<span class="sc-range"><input name="r20min" type="number" placeholder="최소"><input name="r20max" type="number" placeholder="최대"></span></label>
<label>적정가 대비<select name="pos"><option value="">전체</option><option value="B">범위보다 아래</option><option value="I">범위 안</option><option value="A">범위보다 위</option></select></label>
<label>정렬<select name="sort"><option value="score">신호 점수 높은 순</option><option value="r20">20거래일 등락 큰 순</option><option value="r20a">20거래일 등락 작은 순</option><option value="cap">시가총액 큰 순</option><option value="gap">적정가보다 많이 아래 순</option></select></label>
</div><p class="muted small only-free" style="margin:8px 0 0">무료는 '강세 신호 상위'와 결과 5개까지예요. 직접 조건과 전체 결과는 플러스부터예요.</p>
<p class="muted small" style="margin:6px 0 0">조건 백테스트(이 조건을 4년 동안 썼다면)는 프로에 출시 예정이에요.</p></div></section>
<section class="block"><div class="card list"><div class="table-wrap"><table class="compact sc-table"><thead><tr><th>종목</th><th class="num">종가</th><th class="num">오늘</th><th>기술 신호</th><th class="num">20거래일</th><th class="num">적정가 대비</th><th class="num">시가총액</th></tr></thead><tbody id="sc-body"><tr><td colspan="7" class="empty">불러오는 중이에요.</td></tr></tbody></table></div>
<div class="sc-more only-free" id="sc-more" hidden><p>결과가 <b id="sc-total"></b>개 더 있어요. 전체 결과와 직접 조건은 플러스부터 볼 수 있어요.</p><a class="btn-primary" href="pricing.html">요금제 보기</a></div></div></section>
<style>.sc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 14px}.sc-grid label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:var(--muted)}
.sc-grid select,.sc-grid input{font:inherit;font-size:14px;color:var(--fg);border:1px solid var(--line-strong);border-radius:10px;padding:8px 10px;background:#fff;min-width:0}.sc-range{display:flex;gap:6px}.sc-range input{width:50%}
html[data-plan=free] .sc-form .sc-grid{opacity:.5;pointer-events:none}.lockmark{font-size:10px;font-weight:700;background:#eef1f5;color:var(--muted);border-radius:999px;padding:0 6px;margin-left:4px}html:not([data-plan=free]) .lockmark{display:none}
html[data-plan=free] .sc-table th:nth-child(6),html[data-plan=free] .sc-table td:nth-child(6){display:none}.sc-table td a{text-decoration:none}.sc-more{text-align:center;padding:14px 0 6px;border-top:1px solid var(--line)}.sc-more .btn-primary{display:inline-flex}
@media (max-width:820px){.sc-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.sc-table th:nth-child(3),.sc-table td:nth-child(3),.sc-table th:nth-child(7),.sc-table td:nth-child(7){display:none}}</style>
<footer id="sources" style="padding:24px 0 0"><p>계산 결과이고, 투자 권유가 아니에요. 기술 신호는 오를 확률이 아니에요.</p></footer>`;
  return shell('', '스크리너 | Gnomon Analytics', body, { active: 'screener', scripts: SCREENER_SCRIPT });
}

const SCREENER_SCRIPT = `<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var form = $('sc-form'), rows = [], preset = 'top';
  var LEVEL = { STRONG_BULLISH: '강한 강세', BULLISH: '강세', SLIGHTLY_BULLISH: '약간 강세', NEUTRAL: '중립', SLIGHTLY_BEARISH: '약간 약세', BEARISH: '약세', STRONG_BEARISH: '강한 약세', WITHHELD: '보류' };
  var BULL = ['STRONG_BULLISH', 'BULLISH', 'SLIGHTLY_BULLISH'], BEAR = ['STRONG_BEARISH', 'BEARISH', 'SLIGHTLY_BEARISH'];
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var pct = function (v) { return v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(1) + '%'; };
  var tone = function (v) { return v == null || v === 0 ? '' : v > 0 ? 'up' : 'down'; };
  var free = function () { return (document.documentElement.getAttribute('data-plan') || 'free') === 'free'; };
  var PRESET = {
    top: function (r) { return BULL.indexOf(r[6]) >= 0; },
    value: function (r) { return BULL.indexOf(r[6]) >= 0 && r[12] === 'B'; },
    rebound: function (r) { return r[9] != null && r[9] <= -10 && BULL.indexOf(r[6]) >= 0; },
    large: function (r) { return (r[3] || 0) >= 10000 && BULL.indexOf(r[6]) >= 0; },
    hot: function (r) { return r[11] != null && r[11] >= 15 && r[12] === 'A'; },
  };
  var v = function (n) { var el = form.querySelector('[name=' + n + ']'); return el ? el.value : ''; };
  var draw = function () {
    var f = PRESET[preset] || function () { return true; };
    var out = rows.filter(function (r) {
      if (!f(r)) return false;
      if (free()) return true;
      if (v('market') && r[2] !== v('market')) return false;
      if (v('cap') && (r[3] || 0) < Number(v('cap'))) return false;
      var lv = v('level');
      if (lv === 'BULL' && BULL.indexOf(r[6]) < 0) return false;
      if (lv === 'STRONG' && r[6] !== 'STRONG_BULLISH') return false;
      if (lv === 'BEAR' && BEAR.indexOf(r[6]) < 0) return false;
      if (lv === 'NEUTRAL' && r[6] !== 'NEUTRAL') return false;
      if (v('r20min') !== '' && (r[9] == null || r[9] < Number(v('r20min')))) return false;
      if (v('r20max') !== '' && (r[9] == null || r[9] > Number(v('r20max')))) return false;
      if (v('pos') && r[12] !== v('pos')) return false;
      return true;
    });
    var key = free() ? 'score' : v('sort');
    var by = { score: function (r) { return -(r[7] == null ? -999 : r[7]); }, r20: function (r) { return -(r[9] == null ? -999 : r[9]); }, r20a: function (r) { return r[9] == null ? 999 : r[9]; }, cap: function (r) { return -(r[3] || 0); }, gap: function (r) { return r[11] == null ? 999 : r[11]; } }[key];
    out.sort(function (a, b) { return by(a) - by(b); });
    var shown = free() ? out.slice(0, 5) : out.slice(0, 200);
    $('sc-count').textContent = rows.length.toLocaleString('ko-KR') + '종목 중 ' + out.length.toLocaleString('ko-KR') + '개';
    $('sc-body').innerHTML = shown.length ? shown.map(function (r) {
      var href = r[13] ? r[0] + '/index.html' : 'stock.html?c=' + r[0];
      return '<tr><td><a href="' + href + '"><b>' + esc(r[1]) + '</b></a><div class="muted small">' + r[0] + ' · ' + (r[2] === 'P' ? '코스피' : '코스닥') + '</div></td><td class="num">' + Math.round(r[4]).toLocaleString('ko-KR') + '</td><td class="num ' + tone(r[5]) + '">' + pct(r[5]) + '</td><td><span class="sig ' + (BULL.indexOf(r[6]) >= 0 ? 'up' : BEAR.indexOf(r[6]) >= 0 ? 'down' : '') + '">' + LEVEL[r[6]] + '</span></td><td class="num ' + tone(r[9]) + '">' + pct(r[9]) + '</td><td class="num">' + pct(r[11]) + '</td><td class="num">' + (r[3] == null ? '—' : r[3] >= 10000 ? (r[3] / 10000).toFixed(1) + '조' : r[3].toLocaleString('ko-KR') + '억') + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty">조건에 맞는 종목이 없어요.</td></tr>';
    var more = $('sc-more'); more.hidden = !(free() && out.length > 5); $('sc-total').textContent = (out.length - 5).toLocaleString('ko-KR');
  };
  document.querySelectorAll('[data-preset]').forEach(function (b, i) {
    b.addEventListener('click', function () {
      if (free() && i > 0) { if (window.GNM) window.GNM.toast('다른 빠른 조건은 플러스부터 쓸 수 있어요.'); return; }
      var on = b.getAttribute('aria-pressed') !== 'true';
      document.querySelectorAll('[data-preset]').forEach(function (x) { x.setAttribute('aria-pressed', String(on && x === b)); });
      preset = on ? b.getAttribute('data-preset') : ''; draw();
    });
  });
  form.addEventListener('input', draw); form.addEventListener('change', draw);
  // screener.html#value opens with that preset (links from the home feed).
  var want = document.querySelector('[data-preset="' + location.hash.slice(1).replace(/[^a-z]/g, '') + '"]');
  if (location.hash && want && want.getAttribute('aria-pressed') !== 'true') want.click();
  fetch('screener.json').then(function (r) { return r.json(); }).then(function (d) { rows = d.rows || []; draw(); }).catch(function () { $('sc-body').innerHTML = '<tr><td colspan="7" class="empty">계산 결과를 불러오지 못했어요.</td></tr>'; });
})();
</script>`;
