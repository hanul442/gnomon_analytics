// Themes and the market-wide signal radar (G-99). The build writes themes.json / theme-index.json /
// signals.json; these pages and the chips on stock pages render them in the browser.

import { shell } from './renderHtml.js';
import type { Theme } from '../sources/naverTheme.js';
import { EVENT_RULES, type EventFiling } from '../analysis/edge.js';

export interface UniverseLite { symbol: string; name: string; close: number | null; changePct: number | null; tradingValue: number | null; marketCap: number | null }

export function compareThemeMembers(a:readonly unknown[],b:readonly unknown[],key:string,ascending=false):number {
 const field=key==='value'?4:key==='cap'?5:key==='price'?2:3;
 if(key==='name')return String(a[1]).localeCompare(String(b[1]),'ko')*(ascending?1:-1);
 const x=a[field],y=b[field];if(x==null&&y==null)return String(a[0]).localeCompare(String(b[0]));if(x==null)return 1;if(y==null)return -1;
 return (Number(x)-Number(y))*(ascending?1:-1)||String(a[0]).localeCompare(String(b[0]));
}

/** Each theme's members with today's numbers, and the theme's average move, breadth and trading value. */
export function themeData(themes: readonly Theme[], rows: readonly UniverseLite[], date: string) {
  const by = new Map(rows.map((r) => [r.symbol, r]));
  const out = themes.map((t) => {
    const members = t.members.map((m) => { const r = by.get(m.symbol); return [m.symbol, r?.name ?? m.name, r?.close ?? null, r?.changePct ?? null, r?.tradingValue ?? null, r?.marketCap ?? null, m.reason] as const; });
    const moves = members.map((m) => m[3]).filter((x): x is number => x != null);
    return { no: t.no, name: t.name, avg: moves.length ? moves.reduce((a, b) => a + b, 0) / moves.length : null, up: moves.filter((x) => x > 0).length, down: moves.filter((x) => x < 0).length, value: members.reduce((s, m) => s + (m[4] ?? 0), 0), members };
  }).sort((a, b) => (b.avg ?? -999) - (a.avg ?? -999));
  const index: Record<string, [string, string][]> = {};
  for (const t of out) for (const m of t.members) (index[m[0]] ??= []).length < 6 && index[m[0]]!.push([t.no, t.name]);
  return { themes: { date, fields: ['symbol', 'name', 'close', 'changePct', 'tradingValue', 'marketCap', 'reason'], themes: out }, index };
}

/** The radar: surfaced filings of the last two weeks across the market, newest first. */
export function signalData(events: readonly EventFiling[], rows: readonly UniverseLite[], today: string) {
  const by = new Map(rows.map((r) => [r.symbol, r]));
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - 14 * 86_400_000).toISOString().slice(0, 10);
  const items = events.filter((e) => e.date >= since && e.date <= today).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 1500)
    .map((e) => { const r = by.get(e.symbol); return [e.date, e.key, e.symbol, r?.name ?? e.symbol, e.title, e.receiptNo, r?.changePct ?? null] as const; });
  return { date: today, labels: Object.fromEntries(EVENT_RULES.map((r) => [r.key, [r.label, r.why]])), fields: ['date', 'key', 'symbol', 'name', 'title', 'receiptNo', 'changePct'], items };
}

const PAGE_CSS = `<style>
.tm{max-width:980px;margin:14px auto 32px}.tm-hero{padding:18px}.tm-hero h1{font-size:23px;margin:2px 0 6px}.tm-hero p{margin:0;color:var(--fg2);line-height:1.6}
.tm-tools{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.tm-tools input{flex:1;min-width:180px;font:inherit;padding:11px 12px;border:1.5px solid var(--line-strong);border-radius:12px}.tm-tools select{font:inherit;padding:8px 12px;border:1px solid var(--line);border-radius:12px;background:white;color:var(--fg)}.tm-seg{flex-wrap:wrap;display:flex;gap:4px;background:#eef1f6;border-radius:12px;padding:4px}.tm-seg button{border:0;background:none;font:inherit;font-weight:800;font-size:13px;padding:7px 10px;border-radius:9px;cursor:pointer}.tm-seg button[aria-pressed=true]{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.tm-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}.tm-item{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;text-decoration:none;color:inherit}.tm-item:hover{border-color:var(--accent)}.tm-top{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.tm-top b{font-size:15px}.tm-top span{font-weight:800;white-space:nowrap}.tm-meta{font-size:12px;color:var(--muted);margin-top:4px}.tm-lead{font-size:12.5px;color:var(--fg2);margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-detail .card{padding:14px}.tm-back{display:inline-block;margin-bottom:8px;font-weight:700}.tm-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:4px 12px;align-items:baseline;padding:10px 0;border-top:1px solid var(--line);text-decoration:none;color:inherit}.tm-row:first-child{border-top:0}.tm-row b{font-size:14.5px}.tm-row small{grid-column:1/-1;color:var(--muted);font-size:12px;line-height:1.5}.tm-row .num{font-variant-numeric:tabular-nums;font-weight:700}
.sg-chips{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.sg-chips button{border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.sg-chips button[aria-pressed=true]{background:var(--navy);color:#fff;border-color:var(--navy)}
.sg-day{font-size:13px;font-weight:800;color:var(--muted);margin:16px 0 6px}.sg-item{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline;padding:10px 12px;background:#fff;border:1px solid var(--line);border-radius:12px;margin-bottom:6px}.sg-item a.nm{font-weight:800}.sg-item .ti{flex-basis:100%;font-size:13px;color:var(--fg2)}.sg-item .ti a{color:inherit}.sg-tag{font-size:11.5px;font-weight:800;border-radius:6px;padding:2px 7px;background:#eef1f6}.sg-why{font-size:12.5px;color:var(--muted);margin:0 0 4px}
</style>`;

const COMMON_JS = `var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
var pct=function(v){return v==null?'-':(v>0?'▲ +':v<0?'▼ ':'')+Number(v).toFixed(2)+'%';};var cls=function(v){return v>0?'up':v<0?'down':'';};
var eok=function(v){return v?(v>=1e12?(v/1e12).toFixed(1)+'조':Math.round(v/1e8).toLocaleString('ko-KR')+'억'):'-';};
var href=function(s){return 'stock.html?c='+encodeURIComponent(s);};`;

export function renderThemesPage(): string {
  const body = `${PAGE_CSS}<div class="tm"><section class="card tm-hero"><div class="pl-k">테마</div><h1>테마별 종목</h1><p>같은 재료로 함께 움직이는 종목 묶음이에요. 오늘 많이 오른 테마부터 보여 주고, 테마를 누르면 소속 종목과 편입 이유가 나와요.</p></section>
<div id="tm-list-wrap"><div class="tm-tools"><input id="tm-q" type="search" placeholder="테마나 종목 이름 (예: 2차전지, 삼성)" aria-label="테마 검색"><div class="tm-seg" role="group" aria-label="정렬"><button type="button" data-sort="avg" aria-pressed="true">상승률</button><button type="button" data-sort="value" aria-pressed="false">거래대금</button><button type="button" data-sort="low" aria-pressed="false">하락률</button><button type="button" data-sort="count" aria-pressed="false">종목 수</button><button type="button" data-sort="name" aria-pressed="false">이름순</button></div></div><div class="tm-list" id="tm-list"><p class="muted">불러오는 중…</p></div></div>
<div class="tm-detail" id="tm-detail" hidden></div>
<p class="fine">테마 분류와 편입 이유는 네이버 금융 기준이고 매주 다시 가져와요. 등락은 장 마감 기준이에요. 투자 권유가 아니에요.</p></div>
<script>
(function(){${COMMON_JS}
 var data=null,sort='avg',memberSort='change',memberAsc=false;var compareMembers=(${compareThemeMembers.toString()});try{memberSort=localStorage.getItem('gnm-theme-sort')||'change';memberAsc=localStorage.getItem('gnm-theme-direction')==='asc';}catch(e){}
 var list=function(){var q=document.getElementById('tm-q').value.trim().toLowerCase(),t=data.themes.slice();
  if(q)t=t.filter(function(x){return x.name.toLowerCase().indexOf(q)>=0||x.members.some(function(m){return String(m[1]).toLowerCase().indexOf(q)>=0||m[0]===q;});});
  t.sort(function(a,b){return sort==='name'?a.name.localeCompare(b.name,'ko'):sort==='count'?b.members.length-a.members.length:sort==='value'?b.value-a.value:sort==='low'?(a.avg==null?999:a.avg)-(b.avg==null?999:b.avg):(b.avg==null?-999:b.avg)-(a.avg==null?-999:a.avg);});
  document.getElementById('tm-list').innerHTML=t.length?t.slice(0,200).map(function(x){var lead=x.members.slice().sort(function(a,b){return compareMembers(a,b,'change',false);}).slice(0,3).map(function(m){return esc(m[1])+' '+pct(m[3]);}).join(' · ');
   return '<a class="tm-item" href="#'+esc(x.no)+'"><div class="tm-top"><b>'+esc(x.name)+'</b><span class="'+cls(x.avg)+'">'+pct(x.avg)+'</span></div><div class="tm-meta">'+x.members.length+'종목 · 오름 '+x.up+' 내림 '+x.down+' · 거래대금 '+eok(x.value)+'</div><div class="tm-lead">'+lead+'</div></a>';}).join(''):'<p class="muted">맞는 테마가 없어요.</p>';
 };
 var detail=function(no){var x=data.themes.filter(function(t){return t.no===no;})[0],d=document.getElementById('tm-detail'),w=document.getElementById('tm-list-wrap');
  if(!x){d.hidden=true;w.hidden=false;return;}
  var ms=x.members.slice().sort(function(a,b){return compareMembers(a,b,memberSort,memberAsc);});
  d.innerHTML='<a class="tm-back" href="#">‹ 테마 목록</a><div class="card"><div class="head"><h2>'+esc(x.name)+'</h2><span class="'+cls(x.avg)+'"><b>'+pct(x.avg)+'</b></span></div><p class="muted small">'+x.members.length+'종목 · 오름 '+x.up+' 내림 '+x.down+' · 거래대금 합 '+eok(x.value)+'</p><div class="tm-tools"><label>종목 정렬 <select id="tm-member-sort" aria-label="테마 구성 종목 정렬 기준">'+[['change','등락률'],['value','거래대금'],['cap','시가총액'],['price','현재가'],['name','이름']].map(function(o){return '<option value="'+o[0]+'"'+(memberSort===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></label><button type="button" id="tm-direction" class="chip-toggle" aria-label="정렬 방향 바꾸기">'+(memberAsc?'오름차순 ↑':'내림차순 ↓')+'</button></div><div id="tm-members">'+ms.map(function(m){return '<a class="tm-row" href="'+href(m[0])+'"><b>'+esc(m[1])+' <small style="display:inline;grid-column:auto">'+esc(m[0])+'</small></b><span class="num '+cls(m[3])+'">'+pct(m[3])+'</span><span class="num">'+(m[2]?Math.round(m[2]).toLocaleString('ko-KR')+'원':'-')+'</span><small>거래대금 '+eok(m[4])+' · 시가총액 '+eok(m[5])+'</small>'+(m[6]?'<small>'+esc(m[6])+'</small>':'')+'</a>';}).join('')+'</div></div>';
  document.getElementById('tm-member-sort').onchange=function(e){memberSort=e.target.value;try{localStorage.setItem('gnm-theme-sort',memberSort);}catch(x){}detail(no);};document.getElementById('tm-direction').onclick=function(){memberAsc=!memberAsc;try{localStorage.setItem('gnm-theme-direction',memberAsc?'asc':'desc');}catch(x){}detail(no);};
  d.hidden=false;w.hidden=true;window.scrollTo(0,0);
 };
 var route=function(){var no=location.hash.slice(1);if(no)detail(no);else{document.getElementById('tm-detail').hidden=true;document.getElementById('tm-list-wrap').hidden=false;}};
 fetch('themes.json').then(function(r){return r.json();}).then(function(j){data=j;list();route();}).catch(function(){document.getElementById('tm-list').innerHTML='<p class="muted">테마 자료를 아직 모으지 못했어요. 다음 업데이트 뒤 다시 확인해 주세요.</p>';});
 document.getElementById('tm-q').addEventListener('input',function(){if(data)list();});
 document.querySelectorAll('[data-sort]').forEach(function(b){b.onclick=function(){sort=b.getAttribute('data-sort');document.querySelectorAll('[data-sort]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});if(data)list();};});
 window.addEventListener('hashchange',function(){if(data)route();});
})();
</script>`;
  return shell('', '테마별 종목 | CURIA', body, {});
}

export function renderSignalsPage(): string {
  const body = `${PAGE_CSS}<div class="tm"><section class="card tm-hero"><div class="pl-k">숨은 신호</div><h1>공시 레이더</h1><p>뉴스에 잘 안 나오지만 주가에 영향을 줄 수 있는 공시를 전 종목에서 모았어요. 실적 발표, 배당, 자사주, 임원·주요주주 지분 변화, 5% 대량보유, 수주 계약을 최근 2주 동안 보여 줘요.</p></section>
<div class="sg-chips" id="sg-chips" role="group" aria-label="종류"></div><p class="sg-why" id="sg-why"></p><div id="sg-list"><p class="muted">불러오는 중…</p></div>
<p class="fine">OpenDART 공시 목록 기준이에요. 제목을 누르면 원문이 열려요. 지분 변화는 매매뿐 아니라 증여·보상 등일 수 있어 원문에서 사유를 확인하세요. 투자 권유가 아니에요.</p></div>
<script>
(function(){${COMMON_JS}
 var data=null,kind=location.hash.slice(1)||'all';
 var paint=function(){var items=data.items.filter(function(x){return kind==='all'||x[1]===kind;});var lab=data.labels;
  document.getElementById('sg-why').textContent=kind!=='all'&&lab[kind]?lab[kind][1]:'';
  var days={},order=[];items.slice(0,400).forEach(function(x){if(!days[x[0]]){days[x[0]]=[];order.push(x[0]);}days[x[0]].push(x);});
  document.getElementById('sg-list').innerHTML=order.length?order.map(function(d){return '<div class="sg-day">'+esc(d)+' · '+days[d].length+'건</div>'+days[d].map(function(x){return '<div class="sg-item"><span class="sg-tag edge-tag t-'+esc(x[1])+'">'+esc(lab[x[1]]?lab[x[1]][0]:x[1])+'</span><a class="nm" href="'+href(x[2])+'">'+esc(x[3])+'</a><span class="'+cls(x[6])+'">'+(x[6]==null?'':pct(x[6]))+'</span><span class="ti"><a href="https://dart.fss.or.kr/dsaf001/main.do?rcpNo='+esc(x[5])+'" target="_blank" rel="noopener">'+esc(x[4])+' ↗</a></span></div>';}).join('');}).join(''):'<p class="muted">이 종류의 공시가 최근 2주에 없어요.</p>';
 };
 fetch('signals.json').then(function(r){return r.json();}).then(function(j){data=j;var counts={};j.items.forEach(function(x){counts[x[1]]=(counts[x[1]]||0)+1;});
  document.getElementById('sg-chips').innerHTML='<button type="button" data-k="all">전체 '+j.items.length+'</button>'+Object.keys(j.labels).filter(function(k){return counts[k];}).map(function(k){return '<button type="button" data-k="'+k+'">'+esc(j.labels[k][0])+' '+counts[k]+'</button>';}).join('');
  document.querySelectorAll('[data-k]').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-k')===kind));b.onclick=function(){kind=b.getAttribute('data-k');history.replaceState(null,'',kind==='all'?location.pathname:'#'+kind);document.querySelectorAll('[data-k]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});paint();};});
  paint();}).catch(function(){document.getElementById('sg-list').innerHTML='<p class="muted">공시 레이더 자료를 아직 모으지 못했어요.</p>';});
})();
</script>`;
  return shell('', '공시 레이더 | CURIA', body, {});
}

