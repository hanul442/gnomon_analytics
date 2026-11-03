// 나 vs 위원회 (G-323): my up/down calls next to the committee's lean, scored 20 sessions later. Signed-in only.

import { shell } from './renderHtml.js';

export function renderMyCalls(): string {
  const body = `<style>
.mc{max-width:760px;margin:16px auto 32px}.mc .card{padding:18px;margin-bottom:12px}.mc-lead{margin:0 4px 14px;font-size:16px;line-height:1.55}.mc-login{text-align:center}
.mc-vs{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;text-align:center}.mc-vs b{display:block;font-size:34px;font-weight:800;letter-spacing:-.6px;font-variant-numeric:tabular-nums}.mc-vs small{font-size:15.5px;color:var(--muted)}.mc-vs i{font-style:normal;font-size:16px;color:var(--muted);font-weight:700}
.mc-sum{margin:12px 0 0;font-size:16px;color:var(--fg2);text-align:center;line-height:1.5}
.mc-h{font-size:17.5px;margin:0 0 4px}.mc-item{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--line)}.mc-item:first-of-type{border-top:0}
.mc-item a{color:var(--fg);text-decoration:none;min-width:0}.mc-item b{display:block;font-size:17px}.mc-item small{display:block;color:var(--muted);font-size:15.5px}
.mc-tag{flex:none;font-size:15px;font-weight:700;border-radius:999px;padding:4px 10px;background:var(--soft);color:var(--fg2);white-space:nowrap}.mc-tag.ok{color:var(--good)}.mc-tag.no{color:var(--up-strong)}
.mc-fine{font-size:15px;color:var(--muted);margin:4px 4px 0;line-height:1.55}
</style><div class="mc">
<p class="muted mc-lead">종목 위원회 칸에서 "오를 것 같아요 · 내릴 것 같아요"를 고르면, 20거래일 뒤 같은 날 종가로 나와 위원회를 같이 채점해요.</p>
<section class="card mc-login" id="mc-login" hidden><p>로그인하면 내 예상과 위원회를 같이 채점해요.</p><a class="btn" href="login.html?return=mycalls.html">로그인</a></section>
<div id="mc-body" hidden>
<section class="card"><div class="mc-vs"><div><b id="mc-me">-</b><small>나</small></div><i>vs</i><div><b id="mc-com">-</b><small>위원회</small></div></div><p class="mc-sum" id="mc-sum"></p></section>
<section class="card"><h2 class="mc-h">내 예상</h2><div id="mc-list"></div></section>
<p class="mc-fine">위원회 쪽은 내가 고른 날 위원회 좌석이 강세가 많으면 오른다, 약세가 많으면 내린다, 같으면 ±2% 안이라고 보고 채점해요. 시작 종가는 고른 날 장 마감 종가(15:30 뒤에 고르면 다음 거래일)예요. 상금도 순위도 없는 연습이고, 투자 권유가 아니에요.</p>
</div></div><script>
document.addEventListener('DOMContentLoaded', function () {
  var G = window.GNM || {}, $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var day = function (x) { var m = /^\\d{4}-(\\d{2})-(\\d{2})$/.exec(x || ''); return m ? (+m[1]) + '/' + (+m[2]) : ''; };
  var W = { up: '오른다', down: '내린다' }, C = { up: '강세', down: '약세', flat: '중립' };
  var page = function (s) { return 'stock.html?c=' + encodeURIComponent(s); };
  var pct = function (a, b) { var v = (b / a - 1) * 100; return (v > 0 ? '+' : '') + v.toFixed(1) + '%'; };
  var start = function (me) {
    if (!me) { $('mc-login').hidden = false; return; }
    $('mc-body').hidden = false;
    G.call('GET', '/mycalls').then(function (r) {
      if (r.error) { $('mc-list').innerHTML = '<p class="muted small">' + esc(r.message || '불러오지 못했어요.') + '</p>'; return; }
      var t = r.total || { scored: 0, me: 0, com: 0, pending: 0 };
      $('mc-me').textContent = t.scored ? t.me + '/' + t.scored : '-';
      $('mc-com').textContent = t.scored ? t.com + '/' + t.scored : '-';
      $('mc-sum').textContent = t.scored ? (t.me > t.com ? '지금까지는 내가 ' + (t.me - t.com) + '건 더 맞혔어요.' : t.me < t.com ? '지금까지는 위원회가 ' + (t.com - t.me) + '건 더 맞혔어요.' : '지금까지는 비겼어요.') + (t.pending ? ' 채점 기다리는 예상 ' + t.pending + '개.' : '') : (t.pending ? '채점 기다리는 예상 ' + t.pending + '개. 첫 채점은 20거래일 뒤예요.' : '아직 고른 예상이 없어요.');
      var items = r.items || [];
      $('mc-list').innerHTML = items.length ? items.map(function (it) {
        var sub = it.scored_at ? day(it.base_date) + '→' + day(it.end_date) + ' ' + pct(it.base_close, it.end_close) + ' · 위원회 ' + C[it.com] : day(it.base_day) + ' 종가부터 · 위원회 ' + C[it.com] + ' · 채점 대기';
        var tag = it.scored_at ? '<span class="mc-tag ' + (it.hit ? 'ok' : 'no') + '">나 ' + (it.hit ? '맞음' : '틀림') + ' · 위원회 ' + (it.com_hit ? '맞음' : '틀림') + '</span>' : '<span class="mc-tag">' + W[it.stance] + '</span>';
        return '<div class="mc-item"><a href="' + page(it.symbol) + '"><b>' + esc(it.name || it.symbol) + ' · ' + W[it.stance] + '</b><small>' + esc(sub) + '</small></a>' + tag + '</div>';
      }).join('') : '<p class="muted small">종목 화면의 위원회 칸에서 첫 예상을 골라 보세요.</p>';
    });
  };
  if (G.ready) G.ready.then(start); else start(null);
});
</script>`;
  return shell('', '나 vs 위원회 | GNOMON', body, { noFeedback: true, mode: 'mycalls.html' });
}
