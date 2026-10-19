// G-250: the reader's past chart-drawing reviews, kept on the "나 vs 위원회" page (vs.html, section#vs-chart).
// The review itself starts from the chart's AI 평가 button (chartDraw.ts); this lists what came back, newest first,
// from GET /questions/mine?source=draw. Only the reader sees their own list.

export const VS_CHART_CSS = `
#vs-chart .vc-empty{color:var(--muted);font-size:14px;margin:6px 0}
#vs-chart .vc-list{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
#vs-chart details{border:1px solid var(--line);border-radius:14px;background:var(--surface-solid);padding:0 14px}
#vs-chart summary{display:flex;justify-content:space-between;gap:10px;align-items:center;min-height:48px;cursor:pointer;font-weight:700;font-size:14px;list-style:none}#vs-chart summary::-webkit-details-marker{display:none}
#vs-chart summary small{color:var(--muted);font-weight:600;white-space:nowrap}
#vs-chart .vc-body{padding:0 0 12px;font-size:14px;line-height:1.6}#vs-chart .vc-body h4{margin:10px 0 4px;font-size:14px}#vs-chart .vc-body p{margin:4px 0}
#vs-chart .vc-note{font-size:12.5px;color:var(--muted);margin:10px 0 0}
`;

export const VS_CHART_JS = `
(function () {
  var box = document.getElementById('vs-chart'); if (!box) return;
  var list = box.querySelector('.vc-list'), empty = box.querySelector('.vc-empty');
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var md = function (text) {
    return String(text || '').split('\\n').map(function (line) {
      var h = esc(line.trim()).replace(/\\*\\*([^*]+)\\*\\*/g, '<b>$1</b>').replace(/(^|\\s)_([^_]+)_(?=\\s|$)/g, '$1<i>$2</i>');
      if (!h) return ''; if (/^#{1,4} /.test(h)) return '<h4>' + h.replace(/^#+ /, '') + '</h4>'; return '<p>' + h.replace(/^[-*] /, '· ') + '</p>';
    }).join('');
  };
  var show = function (msg) { empty.hidden = false; empty.innerHTML = msg; list.innerHTML = ''; };
  var load = function () {
    if (!window.GNM || !GNM.call) { show('로그인하면 지난 그림 평가를 볼 수 있어요.'); return; }
    GNM.call('GET', '/questions/mine?source=draw').then(function (j) {
      var items = (j && j.items) || [];
      if (j && j.error) { show(esc(j.message || '기록을 불러오지 못했어요.')); return; }
      if (!items.length) { show('아직 받은 평가가 없어요. 종목 차트에서 추세선이나 수평선을 그리고 <b>AI 평가</b>를 눌러 보세요.'); return; }
      empty.hidden = true;
      list.innerHTML = items.map(function (x, i) {
        var when = String(x.created_at || '').slice(0, 10);
        return '<li><details' + (i === 0 ? ' open' : '') + '><summary><span>' + esc(x.symbol || '') + ' · ' + esc(String(x.question || '').replace(/^차트 /, '')) + '</span><small>' + esc(when) + '</small></summary><div class="vc-body">' + md(x.answer) + '</div></details></li>';
      }).join('');
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
`;

/** The section for vs.html: heading, how it works, and the list the script fills. */
export function vsChartSection(): string {
  return `<section id="vs-chart" class="card" aria-labelledby="vs-chart-h"><h2 id="vs-chart-h">내 차트 그림 평가</h2>
<p>종목 차트에 추세선·수평선·평행 채널·피보나치·박스를 그리고 <b>AI 평가</b>를 누르면, 선이 실제 고점·저점에 붙었는지와 가격이 몇 번 닿았는지 점검한 뒤 AI 코치가 고칠 점을 알려 줘요. 받은 평가는 여기 모여요.</p>
<p class="vc-empty">불러오는 중…</p><ul class="vc-list"></ul>
<p class="vc-note">그리는 기법을 익히기 위한 교육용 피드백이에요. 가격 전망이나 매수·매도 권유가 아니에요.</p>
<style>${VS_CHART_CSS}</style><script>${VS_CHART_JS}</script></section>`;
}
