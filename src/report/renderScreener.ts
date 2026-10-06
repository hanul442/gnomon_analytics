// Screener (docs/DESIGN.md §5.12, G-43): every listed stock's free daily computation, filterable in the
// browser. Free: one preset and the top five rows. Plus: every condition and every row. Pro (coming):
// back-testing a condition. Data: site/screener.json, rebuilt every run.

import type { StockCalc } from '../analysis/quickCalc.js';
import type { UniverseRow } from '../sources/naverList.js';
import type { RiskFlag } from '../analysis/riskFilings.js';
import { FIELD_INDEX, FIELDS, matches, PRESETS } from '../analysis/screenRules.js';
import { shell } from './renderHtml.js';

/**
 * One row per stock: [code, name, market, cap(억), close, change%, level, score×100, r5, r20, r120, fairGap%, position, covered,
 * vol1×, vol5×, vwapGap%, obv%, flow, tradingValue(억), hi52Gap%, risk level (0–3), risk labels,
 * lo52Gap%, tradingValue surge×, A/D%, spike10× (G-59)].
 */
export type ScreenerRow = [string, string, 'P' | 'Q', number | null, number, number | null, string, number | null, number | null, number | null, number | null, number | null, 'A' | 'I' | 'B' | null, 0 | 1,
  number | null, number | null, number | null, number | null, 'A' | 'D' | null, number | null, number | null, number, string,
  number | null, number | null, number | null, number | null];

export function screenerRows(universe: readonly UniverseRow[], calcs: ReadonlyMap<string, StockCalc>, covered: ReadonlySet<string>, risk: ReadonlyMap<string, RiskFlag> = new Map()): ScreenerRow[] {
  const r1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10);
  return universe.filter((u) => calcs.has(u.symbol)).map((u) => {
    const c = calcs.get(u.symbol)!, vol = c.volume ?? null, rk = risk.get(u.symbol);
    const mv = (d: number) => r1(c.moves.find((m) => m.days === d)?.pct);
    return [u.symbol, u.name, u.market === 'KOSPI' ? 'P' : 'Q', u.marketCap == null ? null : Math.round(u.marketCap / 1e8), c.close, r1(u.changePct),
      c.signal.level ?? 'WITHHELD', c.signal.score == null ? null : Math.round(c.signal.score * 100), mv(5), mv(20), mv(120),
      c.fair ? r1(c.fair.gapPct) : null, c.fair ? (c.fair.position === 'ABOVE' ? 'A' : c.fair.position === 'BELOW' ? 'B' : 'I') : null, covered.has(u.symbol) ? 1 : 0,
      vol ? r1(vol.ratio1) : null, vol ? r1(vol.ratio5) : null, vol ? r1(vol.vwapGapPct) : null, vol ? Math.round(vol.obvPct) : null, vol?.flow === 'ACCUM' ? 'A' : vol?.flow === 'DIST' ? 'D' : null,
      u.tradingValue == null ? null : Math.round(u.tradingValue / 1e8), r1(c.hi52GapPct), rk?.level ?? 0, rk ? rk.labels.join('·') : '',
      r1(c.lo52GapPct), vol?.tvRatio1 == null ? null : r1(vol.tvRatio1), vol?.adPct == null ? null : Math.round(vol.adPct), vol?.spike10 == null ? null : r1(vol.spike10)];
  });
}

export function renderScreener(): string {
  const body = `<section class="hero" id="top"><div class="hero-main"><div class="eyebrow"><span>스크리너</span><span id="sc-count"></span></div><h1>전 종목을 조건으로 걸러 보세요</h1>
<p class="hero-line">매일 장 마감 뒤 코스피·코스닥 전 종목의 지표 16개, 거래량, 기간별 등락, 기술적 적정가, 최근 30일 공시 위험을 계산해요. 그 값으로 조건 검색을 해요.</p></div></section>
<section class="block"><div class="pl-chips sc-presets" role="group" aria-label="빠른 조건">${PRESETS.map((p, i) => `<button type="button" class="chip-toggle" data-preset="${p.key}" aria-pressed="${i === 0}" title="${p.hint}">${p.label}${i ? ' <span class="lockmark">플러스</span>' : ''}</button>`).join('')}</div></section>
<section class="block"><div class="card sc-form" id="sc-form">
<div class="sc-top"><b>조건</b><label class="sc-inline">조건을<select name="match"><option value="all">모두 만족</option><option value="any">하나라도 만족</option></select></label>
<label class="sc-inline"><input type="checkbox" name="norisk" checked> 공시 위험 2단계 이상 빼기</label>
<label class="sc-inline">정렬<select name="sort"><option value="score">신호 점수 높은 순</option><option value="vol1">거래량 급증 큰 순</option><option value="r20">20거래일 등락 큰 순</option><option value="r20a">20거래일 등락 작은 순</option><option value="cap">시가총액 큰 순</option><option value="tv">거래대금 큰 순</option><option value="tvr">거래대금 급증 큰 순</option><option value="spike10">최근 10일 거래량 폭발 큰 순</option><option value="ad">매집 강도(A/D) 큰 순</option><option value="gap">적정가보다 많이 아래 순</option></select></label></div>
<div class="rules" id="rules"></div>
<div class="sc-actions"><button type="button" class="chip-toggle" id="add-rule">+ 조건 추가</button><button type="button" class="chip-toggle" id="save-screen">이 조건 저장</button><span class="muted small" id="sc-desc"></span></div>
<div class="saved" id="saved" hidden><div class="pl-k">저장한 조건</div><div id="saved-list" class="saved-list"></div><p class="muted small" id="alert-note" hidden>🔔를 켜면 매일 장 마감 뒤 새로 걸린 종목을 알림으로 보내 드려요. 플러스는 3개, 프로·알파는 20개까지예요.</p></div>
<p class="muted small only-free" style="margin:8px 0 0">무료는 '강세 신호 상위'와 결과 5개까지예요. 조건 빌더, 저장, 알림, 전체 결과는 플러스부터예요.</p></div></section>
<section class="block"><div class="card list"><div class="table-wrap"><table class="compact sc-table"><thead><tr><th>종목</th><th class="num">종가</th><th class="num">오늘</th><th>기술 신호</th><th class="num">거래량·거래대금</th><th class="num">20거래일</th><th class="num">적정가 대비</th><th class="num">시가총액</th></tr></thead><tbody id="sc-body"><tr><td colspan="8" class="empty">불러오는 중이에요.</td></tr></tbody></table></div>
<div class="sc-more only-free" id="sc-more" hidden><p>결과가 <b id="sc-total"></b>개 더 있어요. 전체 결과와 직접 조건은 플러스부터 볼 수 있어요.</p><a class="btn-primary" href="pricing.html">요금제 보기</a></div></div></section>
<style>.sc-top{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}.sc-top b{font-size:15px}.sc-inline{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--fg2)}
.sc-form select,.sc-form input:not([type=checkbox]){font:inherit;font-size:14px;color:var(--fg);border:1px solid var(--line-strong);border-radius:10px;padding:7px 9px;background:#fff;min-width:0}
.rules{display:flex;flex-direction:column;gap:8px;margin:12px 0}.rule{display:grid;grid-template-columns:minmax(0,1fr) 92px minmax(0,1fr) 32px;gap:6px;align-items:center}.rule>*{min-width:0}.rule select,.rule input{width:100%;box-sizing:border-box}.rule .x{border:0;background:none;font-size:18px;color:var(--muted);cursor:pointer}.rule small{grid-column:1/-1;color:var(--muted);margin-top:-4px}
.sc-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.saved{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}.saved-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.saved-list span{display:inline-flex;align-items:center;gap:2px;border:1px solid var(--line-strong);border-radius:999px;padding:2px 4px 2px 10px;background:#fff;font-size:13px}.saved-list button{border:0;background:none;cursor:pointer;font:inherit;padding:3px 5px}.saved-list .bell[aria-pressed=true]{color:var(--accent)}.saved-list .bell[aria-pressed=false]{opacity:.45}
html[data-plan=free] .rules,html[data-plan=free] .sc-actions,html[data-plan=free] .sc-top label{opacity:.5;pointer-events:none}.lockmark{font-size:10px;font-weight:700;background:#eef1f5;color:var(--muted);border-radius:999px;padding:0 6px;margin-left:4px}html:not([data-plan=free]) .lockmark{display:none}
html[data-plan=free] .sc-table th:nth-child(7),html[data-plan=free] .sc-table td:nth-child(7){display:none}.sc-table td a{text-decoration:none}.sc-more{text-align:center;padding:14px 0 6px;border-top:1px solid var(--line)}.sc-more .btn-primary{display:inline-flex}
.risk{display:inline-block;margin-left:4px;font-size:11px;font-weight:700;border-radius:6px;padding:0 5px;background:#fff3d6;color:#7a4a00}.risk.r3{background:#fde8e8;color:#9b1c1c}.risk.r1{background:#eef1f5;color:var(--fg2)}.fl-a{color:#1d6b3a;font-size:11px;font-weight:700}.fl-d{color:#9b1c1c;font-size:11px;font-weight:700}
@media (max-width:820px){.rule{grid-template-columns:minmax(0,1fr) 80px minmax(0,1fr) 28px}.sc-table th:nth-child(3),.sc-table td:nth-child(3),.sc-table th:nth-child(8),.sc-table td:nth-child(8){display:none}}</style>
<footer id="sources" style="padding:24px 0 0"><p>계산 결과이고, 투자 권유가 아니에요. 기술 신호는 오를 확률이 아니에요. 공시 위험은 제목으로 분류한 경고라 원문을 꼭 확인해 주세요.</p></footer>`;
  return shell('', '스크리너 | Gnomon Analytics', body, { active: 'screener', scripts: SCREENER_SCRIPT });
}

const SCREENER_SCRIPT = `<script>
(function () {
  var FIELDS = ${JSON.stringify(FIELDS)}, IDX = ${JSON.stringify(FIELD_INDEX)}, PRESETS = ${JSON.stringify(Object.fromEntries(PRESETS.map((p) => [p.key, p.screen])))};
  var matches = ${matches.toString()};
  var $ = function (id) { return document.getElementById(id); };
  var form = $('sc-form'), el = function (n) { return form.querySelector('[name=' + n + ']'); }, rows = [], preset = 'top', SKEY = 'gnm-screens';
  var LEVEL = { STRONG_BULLISH: '강한 강세', BULLISH: '강세', SLIGHTLY_BULLISH: '약간 강세', NEUTRAL: '중립', SLIGHTLY_BEARISH: '약간 약세', BEARISH: '약세', STRONG_BEARISH: '강한 약세', WITHHELD: '보류' };
  var BULL = ['STRONG_BULLISH', 'BULLISH', 'SLIGHTLY_BULLISH'], BEAR = ['STRONG_BEARISH', 'BEARISH', 'SLIGHTLY_BEARISH'];
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var pct = function (v) { return v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(1) + '%'; };
  var tone = function (v) { return v == null || v === 0 ? '' : v > 0 ? 'up' : 'down'; };
  var free = function () { return (document.documentElement.getAttribute('data-plan') || 'free') === 'free'; };
  var field = function (k) { return FIELDS.filter(function (f) { return f.key === k; })[0]; };
  // The builder: one row per rule.
  var ruleRow = function (r) {
    var d = document.createElement('div'); d.className = 'rule';
    d.innerHTML = '<select data-k="f" aria-label="항목">' + FIELDS.map(function (f) { return '<option value="' + f.key + '">' + f.label + '</option>'; }).join('') + '</select><select data-k="op" aria-label="비교"></select><span data-k="vbox"></span><button type="button" class="x" aria-label="조건 빼기">×</button><small></small>';
    var fs = d.querySelector('[data-k=f]'), ops = d.querySelector('[data-k=op]'), vbox = d.querySelector('[data-k=vbox]');
    var setField = function (k, op, v) {
      var f = field(k); fs.value = k;
      ops.innerHTML = f.kind === 'cat' ? '<option value="=">이면</option><option value="!=">아니면</option>' : '<option value=">=">이상</option><option value="<=">이하</option>';
      if (op) ops.value = op;
      vbox.innerHTML = f.kind === 'cat' ? '<select data-k="v" aria-label="값">' + f.options.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select>' : '<input data-k="v" type="number" step="any" aria-label="값 (' + (f.unit || '') + ')" placeholder="' + (f.unit || '') + '">';
      if (v !== undefined) vbox.firstChild.value = v;
      d.querySelector('small').textContent = f.hint ? f.hint + (f.unit ? ' · 단위 ' + f.unit : '') : f.unit ? '단위 ' + f.unit : '';
    };
    setField(r.f, r.op, r.v);
    fs.addEventListener('change', function () { setField(fs.value); changed(); });
    d.querySelector('.x').addEventListener('click', function () { d.remove(); changed(); });
    $('rules').appendChild(d);
  };
  var current = function () {
    var rules = [].map.call(document.querySelectorAll('.rule'), function (d) {
      var f = d.querySelector('[data-k=f]').value, v = d.querySelector('[data-k=v]').value;
      return { f: f, op: d.querySelector('[data-k=op]').value, v: field(f).kind === 'num' ? (v === '' ? '' : Number(v)) : v };
    }).filter(function (r) { return r.v !== ''; });
    return { match: el('match').value, rules: rules, maxRisk: el('norisk').checked ? 2 : 0 };
  };
  var load = function (sc) {
    $('rules').innerHTML = ''; (sc.rules || []).forEach(ruleRow);
    el('match').value = sc.match || 'all'; el('norisk').checked = !!sc.maxRisk; draw();
  };
  var changed = function () { preset = ''; document.querySelectorAll('[data-preset]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); draw(); };
  var draw = function () {
    var sc = free() ? PRESETS.top : current();
    var out = rows.filter(function (r) { return matches(r, sc, IDX); });
    var key = free() ? 'score' : el('sort').value;
    var by = { score: function (r) { return -(r[7] == null ? -999 : r[7]); }, vol1: function (r) { return -(r[14] == null ? -1 : r[14]); }, r20: function (r) { return -(r[9] == null ? -999 : r[9]); }, r20a: function (r) { return r[9] == null ? 999 : r[9]; }, cap: function (r) { return -(r[3] || 0); }, tv: function (r) { return -(r[19] || 0); }, gap: function (r) { return r[11] == null ? 999 : r[11]; }, tvr: function (r) { return -(r[24] == null ? -1 : r[24]); }, spike10: function (r) { return -(r[26] == null ? -1 : r[26]); }, ad: function (r) { return -(r[25] == null ? -999 : r[25]); } }[key];
    out.sort(function (a, b) { return by(a) - by(b); });
    var shown = free() ? out.slice(0, 5) : out.slice(0, 200);
    $('sc-count').textContent = rows.length.toLocaleString('ko-KR') + '종목 중 ' + out.length.toLocaleString('ko-KR') + '개';
    $('sc-desc').textContent = sc.rules.length + '개 조건' + (sc.maxRisk ? ' · 공시 위험 제외' : '');
    $('sc-body').innerHTML = shown.length ? shown.map(function (r) {
      var href = r[13] ? r[0] + '/index.html' : 'stock.html?c=' + r[0];
      var risk = r[21] ? '<span class="risk r' + r[21] + '" title="최근 30일 공시: ' + esc(r[22]) + '">⚠ ' + esc(r[22].split('·')[0]) + (r[22].indexOf('·') > 0 ? ' 외' : '') + '</span>' : '';
      var flow = r[18] === 'A' ? ' <span class="fl-a">매집</span>' : r[18] === 'D' ? ' <span class="fl-d">분산</span>' : '';
      return '<tr><td><a href="' + href + '"><b>' + esc(r[1]) + '</b></a>' + risk + '<div class="muted small">' + r[0] + ' · ' + (r[2] === 'P' ? '코스피' : '코스닥') + '</div></td><td class="num">' + Math.round(r[4]).toLocaleString('ko-KR') + '</td><td class="num ' + tone(r[5]) + '">' + pct(r[5]) + '</td><td><span class="sig ' + (BULL.indexOf(r[6]) >= 0 ? 'up' : BEAR.indexOf(r[6]) >= 0 ? 'down' : '') + '">' + LEVEL[r[6]] + '</span></td><td class="num">' + (r[14] == null ? '—' : r[14].toFixed(1) + '배') + flow + (r[19] == null ? '' : '<small class="sub-sh">' + r[19].toLocaleString('ko-KR') + '억' + (r[24] == null ? '' : ' · ' + r[24].toFixed(1) + '배') + '</small>') + '</td><td class="num ' + tone(r[9]) + '">' + pct(r[9]) + '</td><td class="num">' + pct(r[11]) + '</td><td class="num">' + (r[3] == null ? '—' : r[3] >= 10000 ? (r[3] / 10000).toFixed(1) + '조' : r[3].toLocaleString('ko-KR') + '억') + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="empty">조건에 맞는 종목이 없어요.</td></tr>';
    var more = $('sc-more'); more.hidden = !(free() && out.length > 5); $('sc-total').textContent = (out.length - 5).toLocaleString('ko-KR');
  };
  document.querySelectorAll('[data-preset]').forEach(function (b, i) {
    b.addEventListener('click', function () {
      if (free() && i > 0) { if (window.GNM) window.GNM.toast('다른 빠른 조건은 플러스부터 쓸 수 있어요.'); return; }
      document.querySelectorAll('[data-preset]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      preset = b.getAttribute('data-preset'); load(PRESETS[preset]); preset = b.getAttribute('data-preset');
      var SORT_FOR = { bottomvol: 'spike10', volsurge: 'vol1', accum: 'ad' };
      if (SORT_FOR[preset] && !free()) { el('sort').value = SORT_FOR[preset]; draw(); }
      document.querySelectorAll('[data-preset]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
  });
  $('add-rule').addEventListener('click', function () { ruleRow({ f: 'vol1', op: '>=', v: '' }); });
  form.addEventListener('input', function (e) { if (e.target.closest('.rule') || e.target.name === 'match' || e.target.name === 'norisk') changed(); else draw(); });
  form.addEventListener('change', function (e) { if (e.target.name === 'sort') draw(); });
  // Saved screens: on the server with the alpha API (and alerts), otherwise in this browser.
  var api = function () { return window.GNM && GNM.api && GNM.me ? GNM : null; };
  var local = function () { try { return JSON.parse(localStorage.getItem(SKEY) || '[]'); } catch (e) { return []; } };
  var drawSaved = function (list) {
    $('saved').hidden = !list.length; $('alert-note').hidden = !api();
    $('saved-list').innerHTML = list.map(function (x, i) { return '<span data-i="' + i + '"><button type="button" class="ld">' + esc(x.name) + '</button>' + (api() ? '<button type="button" class="bell" aria-pressed="' + !!x.alert + '" aria-label="알림">🔔</button>' : '') + '<button type="button" class="del" aria-label="삭제">×</button></span>'; }).join('');
    $('saved-list').querySelectorAll('[data-i]').forEach(function (el) {
      var x = list[Number(el.getAttribute('data-i'))];
      el.querySelector('.ld').addEventListener('click', function () { load(x.screen); });
      el.querySelector('.del').addEventListener('click', function () {
        if (!confirm("'" + x.name + "' 조건을 지울까요?")) return;
        if (api()) GNM.call('POST', '/screens/' + x.id + '/delete').then(refreshSaved); else { var l = local(); l.splice(Number(el.getAttribute('data-i')), 1); localStorage.setItem(SKEY, JSON.stringify(l)); refreshSaved(); }
      });
      var bell = el.querySelector('.bell');
      if (bell) bell.addEventListener('click', function () { GNM.call('POST', '/screens/' + x.id, { alert: !x.alert }).then(function (r) { if (r.error) GNM.toast(r.message); else GNM.toast(!x.alert ? '매일 장 마감 뒤 새로 걸린 종목을 알려 드릴게요.' : '알림을 껐어요.'); refreshSaved(); }); });
    });
  };
  var refreshSaved = function () {
    if (api()) GNM.call('GET', '/screens').then(function (r) { drawSaved(r.screens || []); });
    else drawSaved(local());
  };
  $('save-screen').addEventListener('click', function () {
    var sc = current(); if (!sc.rules.length) { if (window.GNM) GNM.toast('조건을 하나 이상 넣어 주세요.'); return; }
    var name = prompt('조건 이름', preset ? document.querySelector('[data-preset="' + preset + '"]').textContent.replace('플러스', '').trim() : '내 조건'); if (!name) return;
    if (api()) GNM.call('POST', '/screens', { name: name, screen: sc }).then(function (r) { if (r.error) GNM.toast(r.message); refreshSaved(); });
    else { var l = local(); l.push({ name: name.slice(0, 40), screen: sc }); try { localStorage.setItem(SKEY, JSON.stringify(l.slice(-20))); } catch (e) {} refreshSaved(); }
  });
  (window.GNM && GNM.ready ? GNM.ready : Promise.resolve()).then(refreshSaved);
  // screener.html#value opens with that preset (links from the home feed).
  var start = document.querySelector('[data-preset="' + location.hash.slice(1).replace(/[^a-z]/g, '') + '"]') || document.querySelector('[data-preset="top"]');
  load(PRESETS.top);
  fetch('screener.json').then(function (r) { return r.json(); }).then(function (d) { rows = d.rows || []; if (start && start.getAttribute('data-preset') !== 'top' && !free()) start.click(); else draw(); }).catch(function () { $('sc-body').innerHTML = '<tr><td colspan="8" class="empty">계산 결과를 불러오지 못했어요.</td></tr>'; });
})();
</script>`;
