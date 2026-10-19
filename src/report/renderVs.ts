// 나 vs 위원회 (G-251): one page for the things a reader does against the AI committee. The mock-trading contest
// is its first section (#vs-contest); other sections (the chart drawing review) join through `sections`.
// The contest reads GET /contest and is replayed on the API from the published season file (analysis/contest.ts).
// Educational: virtual money, ranking by judgment score, no AI comment on anyone's trades.

import { shell } from './renderHtml.js';
import { SIM_NOTE } from './renderArena.js';

const CSS = `<style>
.vs-page{max-width:880px;margin:14px auto 32px}.vs-hero{padding:18px}.vs-hero h1{font-size:23px;margin:2px 0 6px}.vs-hero p{margin:0;color:var(--fg2);line-height:1.6}
.vs-sec{margin-top:14px}.vs-sec h2{font-size:18px;margin:18px 4px 8px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.vs-sec h2 small{font-size:12.5px;font-weight:500;color:var(--muted)}
.vs-season{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--muted);margin:0 4px 8px}.vs-season select{font:inherit;border:1px solid var(--line-strong);border-radius:8px;padding:5px 8px;background:var(--surface);color:var(--fg)}
.vs-three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.vs-col{padding:14px;border-radius:14px;border:1px solid var(--line);background:var(--surface)}.vs-col.me{border-color:var(--accent)}
.vs-col h3{margin:0;font-size:13px;color:var(--muted);font-weight:700}.vs-skill{font-size:34px;font-weight:300;line-height:1.15;margin:6px 0 2px;font-variant-numeric:tabular-nums}.vs-skill small{font-size:13px;font-weight:600;color:var(--muted);margin-left:3px}
.vs-sub{font-size:12px;color:var(--muted);line-height:1.55}.vs-acct{margin-top:8px;padding-top:8px;border-top:1px solid var(--line);font-size:12px;color:var(--fg2);line-height:1.55;font-variant-numeric:tabular-nums}
.vs-rank{margin:10px 2px 0;font-size:13.5px;color:var(--fg2)}
.vs-card{padding:4px 16px}.vs-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;align-items:center;padding:11px 0;border-top:1px solid var(--line)}.vs-row:first-child{border-top:0}
.vs-row b{font-size:14.5px}.vs-row .vs-sub{grid-column:1/-1}.vs-row .vs-r{text-align:right;font-variant-numeric:tabular-nums;font-size:13px}
.vs-btn{border:1px solid var(--line-strong);background:var(--surface);color:var(--fg);border-radius:10px;padding:7px 12px;min-height:36px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.vs-btn.go{background:var(--navy);border-color:var(--navy);color:var(--on-accent)}.vs-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.vs-form{grid-column:1/-1;display:grid;gap:10px;padding:12px;margin:4px 0 2px;border-radius:12px;background:var(--soft)}.vs-form label{display:grid;gap:4px;font-size:13px;font-weight:700}.vs-form label span{font-weight:500;color:var(--muted);font-size:12px}
.vs-form input[type=number],.vs-form input[type=text]{font:inherit;border:1px solid var(--line-strong);border-radius:8px;padding:8px 10px;background:var(--surface);color:var(--fg);min-width:0}
.vs-form input[type=range]{width:100%}.vs-pct{font-size:20px;font-weight:300;font-variant-numeric:tabular-nums}.vs-form .vs-acts{display:flex;gap:8px;justify-content:flex-end}
.vs-tag{display:inline-block;font-size:11.5px;font-weight:700;border-radius:999px;padding:1px 8px;border:1px solid var(--line);color:var(--muted);margin-left:6px;vertical-align:1px}.vs-tag.ok{color:var(--accent-strong);border-color:var(--accent-line)}
.vs-reveal{font-size:12.5px;color:var(--accent-strong)}
.vs-rules{padding:6px 16px 12px}.vs-rules summary{cursor:pointer;font-weight:800;padding:8px 0;min-height:36px}.vs-rules ul{margin:4px 0;padding-left:20px;line-height:1.7;font-size:13.5px}
.vs-tier{display:inline-block;margin-left:6px;font-size:11.5px;font-weight:800;border-radius:999px;padding:1px 8px;background:var(--accent-soft);color:var(--accent-strong);vertical-align:2px}.vs-lb-n{display:inline-block;min-width:26px;font-weight:800;color:var(--muted)}.vs-row.mine{background:var(--accent-soft);margin:0 -16px;padding-left:16px;padding-right:16px}
.vs-nick{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 0;font-size:13px}.vs-nick input[type=text]{font:inherit;border:1px solid var(--line-strong);border-radius:8px;padding:7px 9px;background:var(--surface);color:var(--fg);width:150px}
.vs-empty{padding:14px 2px;color:var(--muted);font-size:13.5px;line-height:1.6}
@media (max-width:560px){.vs-three{grid-template-columns:1fr}.vs-skill{font-size:28px}.vs-col{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center}.vs-col .vs-acct{grid-column:1/-1}}
</style>`;

const RULES = `<details class="card vs-rules"><summary>규칙과 채점 방법</summary><ul>
<li>시즌은 한 달이에요. 모두 가상 1,000만 원으로 시작하고, 실제 돈과 상금은 없어요.</li>
<li>위원회가 최근 20거래일 안에 판단한 국내 주식만 사고팔 수 있어요. 사기·팔기만 있고 공매도와 빚은 없어요.</li>
<li>한 종목은 계좌의 30%까지, 한 번에 5종목까지 가질 수 있어요. 분산을 연습하는 규칙이고, 위원회도 똑같이 지켜요.</li>
<li>주문은 낸 뒤 처음 오는 장 마감 가격(종가)으로 체결돼요. 15시 30분 전에 내면 그날 종가, 뒤에 내면 다음 거래일 종가예요. 위원회도 판단한 다음 거래일 종가로 사요. 누구도 이미 아는 가격으로 사지 못해요.</li>
<li>사고팔 때마다 전략 대결과 같은 비용(왕복 0.25%)을 빼요.</li>
<li>살 때 판단 카드에 "시즌 마지막 종가가 내가 산 가격보다 높을 확률"을 적어요. 시즌이 끝나면 위원회 판단과 같은 공식(Brier 점수)으로 채점해요. 50%만 말하면 0점, 완벽하면 100점, 반대로 자신했으면 0점 밑이에요. 판 종목의 카드도 시즌 끝 가격으로 채점돼요.</li>
<li>순위는 수익이 아니라 판단 점수로 매겨요. 카드가 3장 이상이면 순위와 티어(다이아 30점↑, 플래티넘 20점↑, 골드 10점↑, 실버 0점↑, 브론즈)가 생겨요. 순위표에는 닉네임을 공개한 사람만 보여요.</li>
<li>시즌 중에는 다른 사람의 종목이 보이지 않아요. 시즌이 끝나면 순위표 상위 10명의 판단 카드(종목, 날짜, 말한 확률, 결과)를 공개하고, 이유 글은 공개하지 않아요. 사용자끼리 대화하는 기능은 없어요.</li>
<li>위원회는 오를 확률 55% 이상인 종목 가운데 높은 순 5개를 20%씩 가져요. 기준선은 시즌 첫날 대회 종목을 똑같이 나눠 사서 그대로 둔 계좌예요.</li>
<li>위원회가 그 종목을 몇 %로 봤는지는 내가 그 종목 카드를 낸 뒤에 보여 드려요. 위원회 분석가들도 서로 모르고 먼저 판단해요.</li>
<li>AI는 내 매매나 판단에 의견을 달지 않아요. 복기 카드의 숫자는 모두 계산한 사실이에요.</li></ul></details>`;

/** The contest section. Self-contained (vs- styles); the script fills #vs-c-* from GET /contest. */
const CONTEST = `<section class="vs-sec" id="vs-contest" aria-labelledby="vs-contest-h">
<h2 id="vs-contest-h">모의투자 대회 <small>가상 1,000만 원 · 순위는 판단 점수</small></h2>
<div class="vs-season" id="vs-c-season"></div>
<div class="vs-three" id="vs-c-three"><p class="muted">불러오는 중…</p></div>
<p class="vs-rank" id="vs-c-rank"></p>
<div id="vs-c-board-top"></div>
<div id="vs-c-mine"></div>
<h2>대회 종목 <small>위원회가 지금 판단 중인 국내 주식</small></h2>
<div class="card vs-card" id="vs-c-board"><p class="vs-empty">불러오는 중…</p></div>
<div id="vs-c-review"></div>
<details class="card vs-rules" id="vs-c-committee"><summary>위원회가 지금 가진 종목 (내 판단을 먼저 내고 보길 권해요)</summary><div id="vs-c-committee-list"></div></details>
${RULES}
<p class="muted small sim-note">${SIM_NOTE} 판단 점수와 계좌 결과는 교육용 연습 기록이고 투자 권유가 아니에요.</p>
</section>`;

const SCRIPT = `<script>
(function(){
 var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
 var won=function(v){return Math.round(v).toLocaleString('ko-KR')+'원';};
 var pp=function(v){return (v>0?'+':'')+(v*100).toFixed(1)+'%p';};
 var pct=function(v){return (v*100).toFixed(1)+'%';};
 var $=function(id){return document.getElementById(id);};
 var G=window.GNM||{}, season=null, data=null, open=null;
 var REASON={NO_PRICE:'그날 가격이 없어 체결하지 못했어요',NO_CASH:'현금이 모자라 체결하지 못했어요',CAP:'한 종목 30% 한도를 넘어 체결하지 못했어요',MAX_HOLDINGS:'5종목 한도를 넘어 체결하지 못했어요',NOT_HELD:'가진 주식이 없어 팔지 못했어요'};
 var skill=function(s){return s.skill==null?'<div class="vs-skill">–</div>':'<div class="vs-skill">'+s.skill+'<small>점</small></div>';};
 var col=function(cls,title,s,acct,sub,tier){return '<div class="vs-col '+cls+'"><div><h3>'+title+(tier?'<span class="vs-tier">'+esc(tier.name)+'</span>':'')+'</h3>'+skill(s)+'<div class="vs-sub">'+(sub||'판단 카드 '+s.cards+'장 · 채점 '+s.scored+'장')+'</div></div>'+(acct?'<div class="vs-acct">'+acct+'</div>':'')+'</div>';};
 function paint(){
  var d=data;
  $('vs-c-season').innerHTML='<label for="vs-c-sel">시즌</label><select id="vs-c-sel">'+d.seasons.slice().reverse().map(function(s){return '<option value="'+s+'"'+(s===d.season?' selected':'')+'>'+s.replace('-','년 ')+'월'+(s===d.current?' (진행 중)':'')+'</option>';}).join('')+'</select><span>'+(d.closed?'끝난 시즌 · 최종 채점':d.asOf?d.asOf+' 종가 기준 · 남은 거래일 약 '+d.left+'일 · 지금 점수는 오늘 가격으로 낸 잠정 점수':'첫 거래일 종가가 들어오면 시작해요')+'</span>';
  $('vs-c-sel').onchange=function(){season=this.value;load();};
  var me=d.me, mdd=function(s){return '가장 크게 떨어진 폭 '+pct(s.maxDrawdown);};
  var meAcct=me&&me.started&&me.vs?'가상 계좌: 위원회보다 '+pp(me.ret-(me.vs.committee||0))+', 기준선보다 '+pp(me.ret-(me.vs.benchmark||0))+' ('+esc(me.vs.since)+'부터 같은 구간)<br>'+mdd(me):'';
  $('vs-c-three').innerHTML=(me?col('me','나',me,meAcct||'아직 체결된 주문이 없어요.',null,me.tier):'<div class="vs-col me"><div><h3>나</h3><div class="vs-skill">–</div><div class="vs-sub"><a href="login.html">로그인</a>하면 참가할 수 있어요.</div></div></div>')+
   col('','AI 위원회',d.committee,d.committee.started?'가상 계좌: 기준선보다 '+pp(d.committee.ret-d.benchmark.ret)+'<br>'+mdd(d.committee):'',null,d.committeeTier)+
   col('','기준선',d.benchmark,d.benchmark.started?'대회 종목을 똑같이 나눠 보유<br>'+mdd(d.benchmark):'','판단 없이 비교만 하는 계좌');
  $('vs-c-rank').textContent=d.players?'판단 점수 순위: 카드 3장 이상 낸 참가자 '+d.players+'명'+(me&&me.rank?' 중 '+me.rank+'위':'')+(d.committeeRank?' · 위원회는 '+d.committeeRank+'위 자리':''):(d.entrants?'참가자 '+d.entrants+'명 · 카드 3장을 내면 순위에 들어가요':'');
  // G-251: the season leaderboard (public nicknames only) and, once the season is over, the top players' cards.
  var tierLine='티어: '+d.tiers.map(function(t){return t.name+(t.min==null?' 0점 밑':' '+t.min+'점↑');}).join(' · ')+' · 카드 3장 전에는 배치 중';
  var lb=d.leaderboard.map(function(x){return '<div class="vs-row'+(x.me?' mine':'')+'"><div><span class="vs-lb-n">'+x.rank+'</span><b>'+esc(x.nickname)+'</b><span class="vs-tier">'+esc(x.tier.name)+'</span></div><div class="vs-r">'+x.skill+'점<br><span class="vs-sub">카드 '+x.cards+'장</span></div></div>';}).join('');
  var nick=me?'<form class="vs-nick" id="vs-nick"><label for="vs-nick-in">닉네임</label><input type="text" id="vs-nick-in" name="nickname" maxlength="12" value="'+esc(me.profile?me.profile.nickname:'')+'" placeholder="2~12자"><label><input type="checkbox" name="public"'+(me.profile&&me.profile.public?' checked':'')+'> 순위표에 보이기</label><button type="submit" class="vs-btn">저장</button></form>':'';
  var shown=d.shown.length?'<h2>상위권 판단 카드 <small>시즌이 끝나 공개해요 · 이유 글은 공개하지 않아요</small></h2>'+d.shown.map(function(x){return '<details class="card vs-rules"><summary>'+x.rank+'위 '+esc(x.nickname)+' · '+esc(x.tier.name)+' · '+x.skill+'점</summary>'+x.cards.map(function(c){return '<div class="vs-row"><div><b>'+esc(c.name)+'</b> <span class="vs-sub">'+esc(c.date)+'</span></div><div class="vs-r">'+c.upPct+'%'+(c.hit==null?'':c.hit?' · 올랐어요':' · 내렸어요')+'</div></div>';}).join('')+'</details>';}).join(''):'';
  $('vs-c-board-top').innerHTML='<h2>시즌 순위표 <small>판단 점수 · 닉네임을 공개한 사람만</small></h2><div class="card vs-card">'+(lb||'<p class="vs-empty">아직 순위표에 오른 사람이 없어요. 카드 3장을 내고 닉네임을 공개하면 올라가요.</p>')+nick+'<p class="vs-sub" style="padding:0 0 10px">'+tierLine+'. 시즌 중에는 다른 사람의 종목이 보이지 않아요.</p></div>'+shown;
  // My account: holdings, cash, orders.
  var mine='';
  if(me){
   var hs=me.holdings.map(function(h){return '<div class="vs-row"><div><b>'+esc(h.name)+'</b> <span class="vs-sub">'+esc(h.symbol)+'</span></div><div class="vs-r">'+won(h.value)+'<br><span class="vs-sub">비중 '+pct(h.weight)+'</span></div>'+(d.season===d.current&&!d.closed?'<div class="vs-sub"><button type="button" class="vs-btn" data-sell="'+esc(h.symbol)+'">전부 팔기</button></div>':'')+'</div>';}).join('');
   var os=me.orders.slice(0,12).map(function(o){var st=o.state==='filled'?'<span class="vs-tag ok">'+esc(o.date)+' 체결 '+won(o.amount)+'</span>':o.state==='rejected'?'<span class="vs-tag">'+REASON[o.reason]+'</span>':o.state==='cancelled'?'<span class="vs-tag">취소함</span>':'<span class="vs-tag">체결 기다림</span>';
    return '<div class="vs-row"><div><b>'+(o.side==='BUY'?'사기':'팔기')+' · '+esc(o.name)+'</b>'+st+'<div class="vs-sub">'+(o.side==='BUY'?won(o.amount)+' · 오를 확률 '+o.upPct+'%':'전부')+'</div></div><div class="vs-r">'+(o.state==='pending'?'<button type="button" class="vs-btn" data-cancel="'+o.id+'">취소</button>':'')+'</div></div>';}).join('');
   mine='<h2>내 계좌 <small>현금 '+won(me.cash)+'</small></h2><div class="card vs-card">'+(hs||'<p class="vs-empty">가진 종목이 없어요. 아래 대회 종목에서 골라 판단 카드를 내 보세요.</p>')+'</div>'+(os?'<h2>내 주문</h2><div class="card vs-card">'+os+'</div>':'');
  }
  $('vs-c-mine').innerHTML=mine;
  // The board.
  var live=d.season===d.current&&!d.closed;
  $('vs-c-board').innerHTML=!live?'<p class="vs-empty">끝난 시즌이에요. 진행 중인 시즌에서 사고팔 수 있어요.</p>':d.board.length?d.board.map(function(b){
   return '<div class="vs-row" data-row="'+esc(b.symbol)+'"><div><b>'+esc(b.name)+'</b> <span class="vs-sub">'+esc(b.symbol)+' · '+won(b.close)+'</span>'+(b.upPct!=null?'<div class="vs-reveal">위원회가 본 오를 확률 '+b.upPct+'%</div>':'')+'</div><div class="vs-r"><button type="button" class="vs-btn" data-buy="'+esc(b.symbol)+'">사기</button></div>'+(open===b.symbol?form(b):'')+'</div>';}).join(''):'<p class="vs-empty">위원회가 지금 판단 중인 종목이 없어요. 다음 리포트 뒤 다시 확인해 주세요.</p>';
  // Look back: facts only.
  var r=me&&me.review;
  $('vs-c-review').innerHTML=r&&r.cards?'<h2>복기 <small>계산한 사실만, 평가는 하지 않아요</small></h2><div class="card vs-card">'+
   '<div class="vs-row"><div><b>말한 확률과 실제</b><div class="vs-sub">'+(r.scored?'평균 '+r.avgUp+'%로 말했고 '+r.hitPct+'%가 산 가격보다 높았어요 ('+r.scored+'장'+(d.closed?'':', 오늘 가격 기준')+').':'아직 채점할 카드가 없어요.')+'</div></div></div>'+
   ['high','mid','low'].filter(function(k){return r.bands[k].n;}).map(function(k){var b=r.bands[k];return '<div class="vs-row"><div><b>'+({high:'60% 이상으로 본 카드',mid:'45~59%로 본 카드',low:'45% 미만으로 본 카드'})[k]+'</b><div class="vs-sub">'+b.n+'장 · 평균 '+b.avgUp+'% · 실제로 높았던 비율 '+b.hitPct+'%</div></div></div>';}).join('')+
   (r.invalidation.set?'<div class="vs-row"><div><b>틀렸다고 볼 가격</b><div class="vs-sub">'+r.invalidation.set+'장에 적었고 '+r.invalidation.broke+'장이 그 가격에 닿았어요.</div></div></div>':'')+
   (r.against.length?'<div class="vs-row"><div><b>위원회와 반대로 본 종목</b><div class="vs-sub">'+r.against.map(function(a){return esc(a.name)+' (나 '+a.upPct+'% · 위원회 '+a.committeeUp+'%'+(a.hit==null?'':a.hit?' · 올랐어요':' · 내렸어요')+')';}).join(', ')+'</div></div></div>':'')+'</div>':'';
  $('vs-c-committee-list').innerHTML=d.committee.holdings.length?d.committee.holdings.map(function(h){return '<div class="vs-row"><div><b>'+esc(h.name)+'</b></div><div class="vs-r">비중 '+pct(h.weight)+'</div></div>';}).join(''):'<p class="vs-empty">지금은 현금만 있어요. 55% 이상으로 본 종목이 없을 때예요.</p>';
 }
 function form(b){return '<form class="vs-form" data-form="'+esc(b.symbol)+'"><label>얼마나 살까요<span>10만 원~1,000만 원, 계좌의 30%까지</span><input type="number" name="amount" min="100000" max="10000000" step="10000" value="2000000" required></label>'+
  '<label>판단 카드: 시즌 마지막 종가가 산 가격보다 높을 확률<span>모르겠으면 50%. 맞았는지와 비교해 채점되니 부풀리지 않아요.</span><input type="range" name="upPct" min="1" max="99" value="60" aria-describedby="vs-pct-'+esc(b.symbol)+'"><output class="vs-pct" id="vs-pct-'+esc(b.symbol)+'">60%</output></label>'+
  '<label>틀렸다고 볼 가격 (선택)<span>종가가 여기에 닿으면 판단이 틀린 거라고 미리 정해요. 지금 '+won(b.close)+'보다 낮게.</span><input type="number" name="invalidation" min="1" step="1" inputmode="numeric"></label>'+
  '<label>이유 한 줄 (선택)<input type="text" name="reason" maxlength="80"></label><div class="vs-acts"><button type="button" class="vs-btn" data-close>닫기</button><button type="submit" class="vs-btn go">카드 내고 사기</button></div></form>';}
 function load(){
  if(!G.call){$('vs-c-three').innerHTML='<p class="vs-empty">대회는 베타 서버가 연결된 사이트에서 열려요.</p>';$('vs-c-board').innerHTML='';return;}
  G.call('GET','/contest'+(season?'?season='+encodeURIComponent(season):'')).then(function(r){
   if(r.error){$('vs-c-three').innerHTML='<p class="vs-empty">'+esc(r.message||'대회 자료를 불러오지 못했어요.')+'</p>';$('vs-c-board').innerHTML='';return;}
   data=r;paint();
  });
 }
 var toast=function(m){(G.toast||alert)(m);};
 document.addEventListener('click',function(e){
  var t=e.target.closest('[data-buy],[data-sell],[data-cancel],[data-close]');if(!t||!data)return;
  if(t.hasAttribute('data-close')){open=null;paint();return;}
  if(!data.me){location.href='login.html';return;}
  if(t.dataset.buy){open=open===t.dataset.buy?null:t.dataset.buy;paint();var f=document.querySelector('[data-form="'+open+'"] input');if(f)f.focus();return;}
  if(t.dataset.sell){if(!confirm('가진 주식을 전부 팔까요? 다음 장 마감 가격으로 체결돼요.'))return;t.disabled=true;G.call('POST','/contest/orders',{side:'SELL',symbol:t.dataset.sell}).then(function(r){toast(r.error?r.message:r.fillDate+' 종가로 팔아요.');load();});return;}
  if(t.dataset.cancel){t.disabled=true;G.call('POST','/contest/orders/'+t.dataset.cancel+'/cancel').then(function(r){toast(r.error?r.message:'주문을 취소했어요.');load();});}
 });
 document.addEventListener('input',function(e){if(e.target.name==='upPct'){var o=e.target.parentNode.querySelector('output');if(o)o.textContent=e.target.value+'%';}});
 document.addEventListener('submit',function(e){var n=e.target.closest('#vs-nick');if(n){e.preventDefault();G.call('POST','/contest/profile',{nickname:n.nickname.value.trim(),public:n.public.checked}).then(function(r){toast(r.error?r.message:'저장했어요.');if(!r.error)load();});return;}var f=e.target.closest('[data-form]');if(!f)return;e.preventDefault();
  var btn=f.querySelector('[type=submit]');btn.disabled=true;
  G.call('POST','/contest/orders',{side:'BUY',symbol:f.dataset.form,amount:Number(f.amount.value),upPct:Number(f.upPct.value),invalidation:f.invalidation.value?Number(f.invalidation.value):null,reason:f.reason.value}).then(function(r){
   btn.disabled=false;if(r.error){toast(r.message);return;}toast(r.fillDate+' 종가로 사요. 위원회가 본 확률을 열었어요.');open=null;load();});
 });
 load();
})();
</script>`;

/** vs.html. `sections`: more sections after the contest (each its own <section class="vs-sec" id="vs-…">), with their scripts. */
export function renderVsPage(sections: readonly { html: string; script?: string }[] = []): string {
  const body = `<div class="vs-page"><section class="card vs-hero"><div class="pl-k">위원회</div><h1>나 vs 위원회</h1><p>AI 위원회와 같은 판, 같은 규칙에서 내 판단을 겨뤄 봐요. 수익이 아니라 판단이 얼마나 맞는지로 채점하는 연습장이에요.</p></section>
${CONTEST}${sections.map((s) => s.html).join('')}</div>`;
  return shell('', 'GNOMON | 나 vs 위원회', CSS + body, { mode: 'vs.html', scripts: SCRIPT + sections.map((s) => s.script ?? '').join('') });
}
