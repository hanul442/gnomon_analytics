// 내 토론 기록 (G-116): every question I put to the committee (or the chat) and its answer, kept with the
// account and grouped by stock. Only the signed-in account's own questions come back from the API.

import { shell } from './renderHtml.js';

export function renderMyDebates(): string {
  const body = `<style>
.md{max-width:820px;margin:16px auto 32px}.md .card{padding:18px;margin-bottom:12px}.md h1{font-size:23px;margin:2px 0 6px}
.md-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 10px}.md-tools input{flex:1;min-width:160px;font:inherit;padding:10px 12px;border:1.5px solid var(--line-strong);border-radius:12px}
.md-seg{display:flex;gap:6px}.md-seg button{font:inherit;font-size:13px;font-weight:700;border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:6px 12px;cursor:pointer}.md-seg button[aria-pressed="true"]{background:var(--navy);border-color:var(--navy);color:#fff}
.md-group{margin-top:14px}.md-gh{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:0 0 6px}.md-gh a{font-weight:800;font-size:15.5px}.md-gh small{color:var(--muted)}
.md-q{border:1px solid var(--line);border-radius:12px;margin-bottom:8px;background:#fff}.md-q summary{cursor:pointer;list-style:none;padding:11px 12px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px}.md-q summary::-webkit-details-marker{display:none}
.md-q summary b{font-size:14.5px;font-weight:700}.md-q summary small{grid-column:1/-1;color:var(--muted);font-size:12px}.md-q summary i{font-style:normal;color:var(--muted);grid-row:1;grid-column:2}
.md-a{padding:0 12px 12px;font-size:14px;line-height:1.65;white-space:pre-wrap;color:var(--fg2)}.md-login{text-align:center}
</style><div class="md">
<section class="card"><div class="pl-k">내 토론 기록</div><h1>내가 위원회에 한 질문</h1><p class="muted">토론에 참여해 물어본 것과 받은 답을 종목별로 모아 봐요. 계정에 저장돼서 다른 기기에서도 그대로 보여요. 다른 사람의 질문은 나오지 않아요.</p></section>
<section class="card md-login" id="md-login" hidden><p>로그인하면 내 토론 기록을 볼 수 있어요.</p><a class="btn" href="login.html?return=mydebates.html">로그인</a></section>
<section class="card" id="md-body" hidden><div class="md-tools"><input id="md-q" type="search" placeholder="종목이나 질문 내용으로 찾기" aria-label="내 질문 찾기"><div class="md-seg" role="group" aria-label="어디서 물었는지"><button type="button" data-s="debate" aria-pressed="true">위원회 토론</button><button type="button" data-s="" aria-pressed="false">채팅 포함 전체</button></div></div><div id="md-list"><p class="muted small">불러오는 중…</p></div></section>
</div><script>
document.addEventListener('DOMContentLoaded', function () {
  var G = window.GNM || {}, $ = function (id) { return document.getElementById(id); }, rows = [], names = {'MARKET-DAILY':'시장 데일리'}, source = 'debate';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var page = function (s) { if(s==='MARKET-DAILY')return 'market-reports.html';return (s.indexOf('KRW-') === 0 ? 'coin.html?m=' : 'stock.html?c=') + encodeURIComponent(s) + '#tab-ai'; };
  var when = function (t) { var d = new Date(t); return isNaN(d) ? '' : (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  var paint = function () {
    var q = ($('md-q').value || '').trim().toLowerCase();
    var list = rows.filter(function (r) { return !q || (r.symbol || '').toLowerCase().indexOf(q) >= 0 || (names[r.symbol] || '').toLowerCase().indexOf(q) >= 0 || (r.question || '').toLowerCase().indexOf(q) >= 0; });
    if (!list.length) { $('md-list').innerHTML = '<p class="muted small">' + (rows.length ? '찾는 질문이 없어요.' : '아직 위원회에 한 질문이 없어요. 종목의 AI 위원회 탭 아래 입력창에서 물어볼 수 있어요.') + '</p>'; return; }
    var groups = {}, order = [];
    list.forEach(function (r) { var k = r.symbol || '_'; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(r); });
    $('md-list').innerHTML = order.map(function (k) {
      var g = groups[k], title = k === '_' ? '종목 없이 한 질문' : esc(names[k] || k) + ' <small>' + esc(k) + '</small>';
      return '<div class="md-group"><div class="md-gh">' + (k === '_' ? '<b>' + title + '</b>' : '<a href="' + page(k) + '">' + title + ' ›</a>') + '<small>' + g.length + '개</small></div>' + g.map(function (r) {
        return '<details class="md-q"><summary><b>' + esc(r.question) + '</b><i>' + esc(r.speaker || (r.source === 'debate' ? 'AI 위원회' : '채팅')) + '</i><small>' + when(r.created_at) + ' · ' + (r.credits || 0) + '크레딧</small></summary><div class="md-a">' + esc(r.answer || '') + '</div></details>';
      }).join('') + '</div>';
    }).join('');
  };
  var load = function () {
    $('md-list').innerHTML = '<p class="muted small">불러오는 중…</p>';
    G.call('GET', '/questions/mine' + (source ? '?source=' + source : '')).then(function (r) {
      if (r.error) { $('md-list').innerHTML = '<p class="muted small">' + esc(r.message || '불러오지 못했어요. 새로고침해 주세요.') + '</p>'; return; }
      rows = r.items || []; paint();
    });
  };
  $('md-q').addEventListener('input', paint);
  document.querySelectorAll('.md-seg button').forEach(function (b) { b.onclick = function () { source = b.getAttribute('data-s'); document.querySelectorAll('.md-seg button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); load(); }; });
  var start = function (me) {
    if (!me) { $('md-login').hidden = false; return; }
    $('md-body').hidden = false;
    fetch('search.json').then(function (r) { return r.json(); }).then(function (s) { (s.items || []).forEach(function (x) { names[x[0]] = x[1]; }); paint(); }).catch(function () {});
    load();
  };
  if (G.ready) G.ready.then(start); else start(null);
});
</script>`;
  return shell('', '내 토론 기록 | CURIA', body, { noFeedback: true });
}
