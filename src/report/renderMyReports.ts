// 내 리포트 (G-108): every report I generated or requested, in one list. Only the signed-in
// account's own jobs come back from the API; nobody else's show here.

import { shell } from './renderHtml.js';

export function renderMyReports(): string {
  const body = `<style>
.mr{max-width:760px;margin:16px auto 32px}.mr .card{padding:18px;margin-bottom:12px}.mr h1{font-size:23px;margin:2px 0 6px}
.mr-tabs{margin:0 0 10px}
.mr-item{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}.mr-item:first-child{border-top:0}.mr-item b{display:block;font-size:15px}.mr-item small{color:var(--muted);font-size:12.5px}
.mr-item a.mr-go{flex:none;font-weight:800;font-size:13px}.mr-login{text-align:center}
</style><div class="mr">
<section class="card"><div class="pl-k">내 리포트</div><h1>내가 만든 리포트</h1><p class="muted">즉시 생성하거나 요청한 리포트를 모아 봐요. 다른 사람이 만든 리포트는 여기 나오지 않아요.</p></section>
<section class="card mr-login" id="mr-login" hidden><p>로그인하면 내가 만든 리포트를 볼 수 있어요.</p><a class="btn" href="login.html?return=myreports.html">로그인</a></section>
<section class="card" id="mr-body" hidden><div class="seg mr-tabs" role="group" aria-label="상태"><button type="button" data-f="" aria-pressed="true">전체</button><button type="button" data-f="done" aria-pressed="false">완성</button><button type="button" data-f="work" aria-pressed="false">진행 중</button><button type="button" data-f="failed" aria-pressed="false">실패</button></div><div id="mr-list"><p class="muted small">불러오는 중…</p></div></section>
</div><script>
document.addEventListener('DOMContentLoaded', function () {
  var G = window.GNM || {}, $ = function (id) { return document.getElementById(id); }, rows = [], filter = '';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var KIND = { report: '심층', brief: '요약', upgrade: '심층 업그레이드' };
  var TONE = { done: 'ok', failed: 'bad', rejected: 'bad', running: 'warn', queued: 'warn', pending: 'warn', approved: 'warn' };
  var ST = { done: '완성', failed: '실패', running: '만드는 중', queued: '대기 중', pending: '접수됨', approved: '처리 중', rejected: '반려' };
  var page = function (s) { return (s.indexOf('KRW-') === 0 ? 'coin.html?m=' : 'stock.html?c=') + encodeURIComponent(s); };
  var when = function (t) { var d = new Date(t); return isNaN(d) ? '' : (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  var paint = function () {
    var list = rows.filter(function (r) { return !filter || (filter === 'work' ? ['running', 'queued', 'pending', 'approved'].indexOf(r.status) >= 0 : r.status === filter); });
    $('mr-list').innerHTML = list.length ? list.map(function (r) {
      var go = r.job && r.status === 'done' ? '<a class="mr-go" href="' + page(r.symbol) + '&job=' + encodeURIComponent(r.id) + '#tab-ai">보기 ›</a>' : r.job && (r.status === 'running' || r.status === 'queued') ? '<a class="mr-go" href="' + page(r.symbol) + '&job=' + encodeURIComponent(r.id) + '">진행 보기 ›</a>' : '<a class="mr-go" href="' + page(r.symbol) + '">종목 ›</a>';
      return '<div class="mr-item"><div><b>' + esc(r.name || r.symbol) + ' <small>' + esc(r.symbol) + '</small></b><small>' + esc(KIND[r.kind] || r.kind) + ' 리포트 · ' + when(r.created_at) + (r.data_date ? ' · 데이터 ' + esc(r.data_date) : '') + (r.status === 'failed' && r.error ? ' · ' + esc(r.error) : '') + '</small></div><span class="badge sm ' + (TONE[r.status] || 'mute') + '">' + esc(ST[r.status] || r.status) + '</span>' + go + '</div>';
    }).join('') : '<p class="muted small">' + (rows.length ? '이 상태의 리포트가 없어요.' : '아직 만든 리포트가 없어요. 종목 화면에서 AI 리포트를 만들 수 있어요.') + '</p>';
  };
  document.querySelectorAll('.mr-tabs button').forEach(function (b) { b.onclick = function () { filter = b.getAttribute('data-f'); document.querySelectorAll('.mr-tabs button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); paint(); }; });
  var start = function (me) {
    if (!me) { $('mr-login').hidden = false; return; }
    $('mr-body').hidden = false;
    G.call('GET', '/reports/mine').then(function (r) {
      if (r.error) { $('mr-list').innerHTML = '<p class="muted small">' + esc(r.message || '불러오지 못했어요.') + '</p>'; return; }
      rows = (r.jobs || []).map(function (j) { return Object.assign({ job: true }, j); }).concat((r.requests || []).map(function (q) { return Object.assign({ job: false }, q); }));
      rows.sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
      paint();
    });
  };
  if (G.ready) G.ready.then(start); else start(null);
});
</script>`;
  return shell('', '내 리포트 | GNOMON', body, { noFeedback: true });
}
