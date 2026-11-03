// News issue ranking on screen (G-243): a home card (top 5) and issues.html (all). Both read
// news-issues.json, built each run by rankNewsIssues. Self-contained (own ni- styles and script)
// so the screen redesign can place the card anywhere with NEWS_ISSUES_CARD + NEWS_ISSUES_SCRIPT.

import { shell } from './renderHtml.js';

const CSS = `<style>
.ni-list{padding:2px 14px}.ni-row{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:4px 10px;align-items:start;padding:11px 0;border-top:1px solid var(--line)}.ni-row:first-child{border-top:0}
.ni-n{font-weight:800;color:var(--muted);text-align:center;line-height:1.45}.ni-row:nth-child(-n+3) .ni-n{color:var(--accent)}
.ni-t{font-weight:700;font-size:17px;line-height:1.45;color:inherit;text-decoration:none;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.ni-t:hover{text-decoration:underline}
.ni-meta{font-size:15px;color:var(--muted);margin-top:3px}.ni-ch{font-size:15px;font-weight:800;white-space:nowrap;line-height:1.6;font-variant-numeric:tabular-nums}.ni-ch.new{color:var(--accent)}.ni-ch.same{color:var(--muted)}
.ni-stocks{grid-column:2/-1;display:flex;flex-wrap:wrap;gap:6px}.ni-stocks a{display:inline-flex;align-items:center;gap:4px;min-height:30px;padding:2px 9px;border:1px solid var(--line);border-radius:999px;font-size:15.5px;font-weight:700;color:inherit;text-decoration:none;background:var(--surface)}.ni-stocks a:hover{border-color:var(--accent)}.ni-stocks i{font-style:normal;font-weight:600;font-variant-numeric:tabular-nums}
.ni-more{grid-column:2/-1}.ni-more summary{cursor:pointer;font-size:15.5px;color:var(--muted);min-height:30px;display:inline-flex;align-items:center}.ni-more ul{margin:2px 0 4px;padding-left:16px}.ni-more li{font-size:15.5px;line-height:1.5;margin:3px 0}.ni-more li a{color:inherit}.ni-more li small{color:var(--muted)}
.ni-note{font-size:15px;color:var(--muted);margin:8px 0 2px}
.ni-page{max-width:820px;margin:14px auto 32px}.ni-hero{padding:18px}.ni-hero h1{font-size:23px;margin:2px 0 6px}.ni-hero p{margin:0;color:var(--fg2);line-height:1.6}.ni-page .card.ni-list{margin-top:12px;padding:4px 16px}
</style>`;

/** Builds the rows in the browser; `window.gnmNewsIssues(json, limit, open)` returns HTML. */
const RENDER_JS = `<script>
window.gnmNewsIssues=window.gnmNewsIssues||function(j,limit,full){
 var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
 var href=function(s){return /^KRW-/.test(s)?'coin.html?m='+encodeURIComponent(s):/^[0-9][0-9A-Z]{5}$/.test(s)?'stock.html?c='+encodeURIComponent(s):'us.html?s='+encodeURIComponent(s);};
 var pct=function(v){return v==null?'':' <i class="'+(v>0?'up':v<0?'down':'')+'">'+(v>0?'+':'')+Number(v).toFixed(1)+'%</i>';};
 var hm=function(t){var d=new Date(Date.parse(t)+9*3600e3);return (d.getUTCMonth()+1)+'/'+d.getUTCDate()+' '+String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0');};
 var ch=function(x){if(!x.prev)return '<span class="ni-ch new" title="전날 24시간에는 없던 이슈">새</span>';var d=x.prev.rank-x.rank;return d>0?'<span class="ni-ch up" title="전날 '+x.prev.rank+'위">▲'+d+'</span>':d<0?'<span class="ni-ch down" title="전날 '+x.prev.rank+'위">▼'+(-d)+'</span>':'<span class="ni-ch same" title="전날과 같은 순위">–</span>';};
 return (j.issues||[]).slice(0,limit).map(function(x){
  var more=full?'<details class="ni-more"'+(full&&x.rank<=3?' open':'')+'><summary>같은 이슈 기사 '+x.articles+'건 · 제목 '+x.headlines.length+'개</summary><ul>'+x.headlines.map(function(h){return '<li><a href="'+esc(h.url)+'" target="_blank" rel="noopener">'+esc(h.title)+'</a> <small>'+esc(h.publisher)+' · '+hm(h.publishedAt)+'</small></li>';}).join('')+'</ul></details>':'';
  return '<div class="ni-row"><span class="ni-n">'+x.rank+'</span><div><a class="ni-t" href="'+esc(x.url)+'" target="_blank" rel="noopener">'+esc(x.title)+'</a><div class="ni-meta">매체 '+x.outlets+'곳 · 기사 '+x.articles+'건'+'</div></div>'+ch(x)+
   (x.stocks.length?'<div class="ni-stocks">'+x.stocks.slice(0,full?6:3).map(function(s){return '<a href="'+href(s.symbol)+'">'+esc(s.name)+pct(s.changePct)+'</a>';}).join('')+'</div>':'')+more+'</div>';
 }).join('');
};
window.gnmNewsIssuesWindow=function(j){var f=function(t){var d=new Date(Date.parse(t)+9*3600e3);return (d.getUTCMonth()+1)+'/'+d.getUTCDate()+' '+String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0');};return j.to?f(j.from)+' ~ '+f(j.to)+' · 기사 '+Number(j.articles).toLocaleString('ko-KR')+'건':'';};
</script>`;

const NOTE = '많은 매체가 다룬 순서예요. 같은 내용의 기사는 하나로 묶었고, 순위 변화는 그 전 24시간과 비교해요. 좋고 나쁨을 판단하거나 매매를 권하지 않아요.';

/** Home card: hidden until news-issues.json has at least one issue. */
export const NEWS_ISSUES_CARD = `<section class="block" id="news-issues" hidden><div class="block-head"><h2>오늘의 뉴스 이슈</h2><a class="more-link" href="issues.html">이슈 전체 ›</a></div><div class="card"><div class="ni-list" id="ni-home"></div><p class="ni-note" style="padding:0 14px 10px" id="ni-home-when"></p></div></section>`;

export const NEWS_ISSUES_SCRIPT = `${CSS}${RENDER_JS}<script>
(function(){var box=document.getElementById('news-issues');if(!box)return;
 fetch('news-issues.json').then(function(r){if(!r.ok)throw r;return r.json();}).then(function(j){if(!j.issues||!j.issues.length)return;
  document.getElementById('ni-home').innerHTML=window.gnmNewsIssues(j,3,false);document.getElementById('ni-home-when').textContent=window.gnmNewsIssuesWindow(j)+' · 매체 수 순';box.hidden=false;
 }).catch(function(){});})();
</script>`;

export function renderNewsIssuesPage(): string {
  const body = `<div class="ni-page"><section class="card ni-hero"><div class="pl-k">뉴스</div><h1>오늘의 뉴스 이슈</h1><p>최근 24시간 동안 가장 많은 매체가 다룬 이슈와 관련 종목이에요. 이슈를 펼치면 같은 이슈의 다른 기사 제목이 나와요.</p><p class="ni-note" id="ni-when"></p></section>
<div class="card ni-list" id="ni-all"><p class="muted">불러오는 중…</p></div>
<p class="ni-note">${NOTE} 기사는 GNOMON이 추적하는 종목·코인의 뉴스(네이버 뉴스 검색, Google 뉴스)에서 모아요.</p></div>`;
  const script = `<script>
fetch('news-issues.json').then(function(r){if(!r.ok)throw r;return r.json();}).then(function(j){var el=document.getElementById('ni-all');
 if(!j.issues||!j.issues.length){el.innerHTML='<p class="muted">아직 모은 뉴스가 없어요. 다음 업데이트 뒤 다시 확인해 주세요.</p>';return;}
 el.innerHTML=window.gnmNewsIssues(j,50,true);document.getElementById('ni-when').textContent=window.gnmNewsIssuesWindow(j);
}).catch(function(){document.getElementById('ni-all').innerHTML='<p class="muted">뉴스 이슈를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>';});
</script>`;
  return shell('', 'GNOMON | 오늘의 뉴스 이슈', CSS + body, { scripts: RENDER_JS + script });
}
