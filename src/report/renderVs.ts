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
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.vs-arena{position:relative;overflow:hidden;padding:18px 16px 16px;border-radius:22px;color:#fff;background:radial-gradient(120% 90% at 0% 0%,#2f6bff 0%,rgba(47,107,255,0) 55%),radial-gradient(120% 90% at 100% 0%,#ff7a45 0%,rgba(255,122,69,0) 55%),linear-gradient(160deg,#0b1730,#14203d);box-shadow:0 18px 40px rgba(10,22,48,.25)}
.vs-arena a{color:#fff}.vs-ar-top{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.04em;opacity:.9}.vs-ar-top select{font:inherit;font-weight:700;border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:3px 10px;background:rgba(255,255,255,.12);color:#fff}.vs-ar-top select option{color:#111}
.vs-sbar{height:6px;border-radius:999px;background:rgba(255,255,255,.18);margin:8px 0 14px;overflow:hidden}.vs-sbar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#7fb0ff,#ffd27a)}
.vs-duel{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:6px;text-align:center}.vs-fighter{display:grid;justify-items:center;gap:2px;min-width:0}.vs-fighter b{font-size:15px}.vs-fighter .vs-pts{font-size:34px;font-weight:300;line-height:1.1;font-variant-numeric:tabular-nums}.vs-fighter .vs-pts small{font-size:13px;font-weight:700;opacity:.75;margin-left:2px}
.vs-fighter .vs-tn{font-size:12px;font-weight:800;opacity:.9}.vs-emb{width:62px;height:62px;filter:drop-shadow(0 6px 12px rgba(0,0,0,.35))}
.vs-vs{font-size:30px;font-weight:900;font-style:italic;letter-spacing:-.02em;background:linear-gradient(180deg,#fff,#ffd27a);-webkit-background-clip:text;background-clip:text;color:transparent;padding:0 4px}
.vs-tug{position:relative;height:12px;border-radius:999px;background:#ff7a45;margin:14px 0 6px;overflow:hidden}.vs-tug i{position:absolute;left:0;top:0;bottom:0;background:#3d7bff;border-radius:999px 0 0 999px;transition:width .6s cubic-bezier(.2,.8,.2,1)}.vs-tug::after{content:'';position:absolute;left:50%;top:-2px;bottom:-2px;width:2px;background:rgba(255,255,255,.7)}
.vs-call{font-size:14px;font-weight:800;text-align:center;margin:4px 0 2px}.vs-next{font-size:12px;text-align:center;opacity:.85}.vs-ar-acct{margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.18);font-size:11.5px;opacity:.8;line-height:1.55;text-align:center}
.vs-cta{display:inline-block;margin-top:10px;padding:10px 18px;border-radius:999px;background:#fff;color:#0b1730!important;font-weight:800;text-decoration:none}
.vs-quests{display:grid;gap:8px}.vs-q{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;border:1px solid var(--line);background:var(--surface)}.vs-q.done{border-color:var(--accent-line);background:var(--accent-soft)}
.vs-q .vs-qi{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--soft);font-size:16px}.vs-q.done .vs-qi{background:var(--accent);color:#fff}.vs-q b{font-size:14px}.vs-q .vs-qp{font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--muted)}.vs-q.done .vs-qp{color:var(--accent-strong)}
.vs-qbar{grid-column:2/-1;height:5px;border-radius:999px;background:var(--line);overflow:hidden}.vs-qbar i{display:block;height:100%;background:var(--accent);border-radius:inherit}
.vs-badges{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}.vs-bd{display:grid;justify-items:center;gap:4px;padding:12px 6px;border-radius:14px;border:1px solid var(--line);background:var(--surface);text-align:center}.vs-bd .vs-bi{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:20px;background:linear-gradient(160deg,#ffd27a,#ff9a4a);box-shadow:0 6px 14px rgba(255,140,60,.3)}
.vs-bd b{font-size:12.5px}.vs-bd span{font-size:11px;color:var(--muted);line-height:1.4}.vs-bd.locked{opacity:.55}.vs-bd.locked .vs-bi{background:var(--soft);box-shadow:none;filter:grayscale(1)}
.vs-lb .vs-row{grid-template-columns:34px 30px minmax(0,1fr) auto}.vs-lb .vs-emb{width:30px;height:30px;filter:none}.vs-medal{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:13px;background:var(--soft);color:var(--muted)}.vs-medal.m1{background:#ffd34d;color:#5a3b00}.vs-medal.m2{background:#d7dde5;color:#38424f}.vs-medal.m3{background:#e9a46b;color:#4a2508}
.vs-fc{grid-column:1/-1;display:grid;gap:12px;padding:16px;margin:6px 0 4px;border-radius:18px;color:#fff;background:linear-gradient(160deg,#16244a,#0b1730);box-shadow:0 12px 28px rgba(10,22,48,.25)}.vs-fc label{display:grid;gap:4px;font-size:13px;font-weight:700}.vs-fc label span{font-weight:500;opacity:.75;font-size:12px}
.vs-fc input[type=number],.vs-fc input[type=text]{font:inherit;border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:9px 10px;background:rgba(255,255,255,.08);color:#fff;min-width:0}.vs-fc input[type=range]{width:100%;accent-color:#ffd27a}
.vs-fc-h{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;font-weight:800;letter-spacing:.06em;opacity:.85}.vs-fc .vs-pct{font-size:40px;font-weight:300;text-align:center;display:block;color:#ffd27a}.vs-ends{display:flex;justify-content:space-between;font-size:11.5px;opacity:.75}
.vs-fc .vs-acts{display:flex;gap:8px;justify-content:flex-end}.vs-fc .vs-btn{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.25);color:#fff}.vs-fc .vs-btn.go{background:#ffd27a;border-color:#ffd27a;color:#2a1a00}
.vs-flip{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;background:rgba(5,10,25,.88);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);padding:16px}.vs-hide{margin-top:3px;font-size:12px;color:var(--muted,#6b7280);display:flex;align-items:center;gap:6px}.vs-hc{display:inline-grid;place-items:center;width:16px;height:20px;border-radius:4px;background:linear-gradient(160deg,#ff7a45,#7a2e12);color:#fff;font-size:11px;font-weight:800}.vs-flip[hidden]{display:none}.vs-flip-in{width:min(380px,100%);text-align:center;color:#fff}.vs-flip h3{margin:0 0 14px;font-size:18px}
.vs-flip-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px}.vs-fcard{border-radius:18px;padding:18px 10px;background:linear-gradient(160deg,#2f6bff,#16244a);box-shadow:0 14px 30px rgba(0,0,0,.35)}.vs-fcard.ai{background:linear-gradient(160deg,#ff7a45,#3a1d12);animation:vs-flip .7s .25s both cubic-bezier(.2,.8,.2,1)}.vs-fcard b{display:block;font-size:12px;opacity:.85}.vs-fcard strong{display:block;font-size:40px;font-weight:300;margin-top:4px}
@keyframes vs-flip{from{transform:perspective(600px) rotateY(90deg);opacity:0}to{transform:none;opacity:1}}.vs-flip p{font-size:13px;opacity:.85;margin:14px 0}
@media (prefers-reduced-motion:reduce){.vs-fcard.ai{animation:none}.vs-tug i{transition:none}}
@media (max-width:560px){.vs-fighter .vs-pts{font-size:28px}.vs-emb{width:52px;height:52px}.vs-vs{font-size:24px}}
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
<h2 id="vs-contest-h" class="sr-only">모의투자 대회</h2>
<div class="vs-arena" id="vs-c-arena"><p>불러오는 중…</p></div>
<h2>이번 시즌 미션</h2><div class="vs-quests" id="vs-c-quests"></div>
<h2>대회 종목 <small>카드를 내면 위원회의 카드가 열려요</small></h2>
<div class="card vs-card" id="vs-c-board"><p class="vs-empty">불러오는 중…</p></div>
<h2>업적</h2><div class="vs-badges" id="vs-c-badges"></div>
<div id="vs-c-board-top"></div>
<div id="vs-c-mine"></div>
<div id="vs-c-review"></div>
<div class="vs-flip" id="vs-c-flip" hidden role="dialog" aria-modal="true" aria-labelledby="vs-flip-h"><div class="vs-flip-in"><h3 id="vs-flip-h">위원회의 카드 공개</h3><div class="vs-flip-cards"><div class="vs-fcard"><b>나</b><strong id="vs-flip-me"></strong></div><div class="vs-fcard ai"><b>AI 위원회</b><strong id="vs-flip-ai"></strong></div></div><p id="vs-flip-t"></p><button type="button" class="vs-cta" data-flip-close>계속하기</button></div></div>
<details class="card vs-rules" id="vs-c-committee"><summary>위원회가 지금 가진 종목 (내 판단을 먼저 내고 보길 권해요)</summary><div id="vs-c-committee-list"></div></details>
${RULES}
<p class="muted small sim-note">${SIM_NOTE} 티어·업적·판단 점수와 계좌 결과는 교육용 연습 기록이고 투자 권유가 아니에요.</p>
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
  var me=d.me, mdd=function(x){return '가장 크게 떨어진 폭 '+pct(x.maxDrawdown);}, live=d.season===d.current&&!d.closed;
  var total=d.sessions+(d.left||0), prog=total?Math.round(100*d.sessions/total):0;
  var seasonSel='<select id="vs-c-sel" aria-label="시즌">'+d.seasons.slice().reverse().map(function(x){return '<option value="'+x+'"'+(x===d.season?' selected':'')+'>'+x.replace('-','.')+' 시즌</option>';}).join('')+'</select>';
  var dday=d.closed?'시즌 종료 · 최종 결과':d.asOf?'D-'+(d.left||0)+' · 잠정 점수':'첫 종가를 기다리는 중';
  var mine0=me&&me.skill!=null?me.skill:null, ai0=d.committee.skill;
  var fighter=function(name,x,tier){return '<div class="vs-fighter">'+emb(tier?tier.key:'placing',64)+'<b>'+name+'</b><div class="vs-pts">'+(x.skill==null?'–':x.skill)+'<small>점</small></div><div class="vs-tn">'+esc(tier?tier.name:'배치 중')+' · 카드 '+x.cards+'장</div></div>';};
  var call='', share=50;
  if(me&&mine0!=null&&ai0!=null){var gap=mine0-ai0;share=Math.max(6,Math.min(94,50+gap));call=gap>0?'내가 '+gap+'점 앞서는 중!':gap<0?'위원회가 '+(-gap)+'점 앞서는 중':'동점이에요';}
  else if(me)call=me.cards<3?'카드 '+(3-me.cards)+'장 더 내면 배치 끝, 티어가 정해져요':'채점을 기다리는 중';
  var nt=me&&me.skill!=null&&me.cards>=3?nextTier(me.skill):null;
  $('vs-c-arena').innerHTML='<div class="vs-ar-top"><span>'+seasonSel+'</span><span>'+dday+'</span></div><div class="vs-sbar" aria-label="시즌 진행 '+prog+'%"><i style="width:'+prog+'%"></i></div>'+
   '<div class="vs-duel">'+(me?fighter('나',me,me.tier):'<div class="vs-fighter">'+emb('placing',64)+'<b>나</b><div class="vs-pts">?</div><a class="vs-cta" href="login.html">로그인하고 도전</a></div>')+'<div class="vs-vs" aria-hidden="true">VS</div>'+fighter('AI 위원회',d.committee,d.committeeTier)+'</div>'+
   (me?'<div class="vs-tug" role="img" aria-label="'+esc(call)+'"><i style="width:'+share+'%"></i></div><div class="vs-call">'+esc(call)+'</div>':'')+
   (nt?'<div class="vs-next">'+(nt.name?nt.name+'까지 '+nt.need+'점':'최고 티어예요')+(me.rank?' · 순위 '+me.rank+'위 / '+d.players+'명':'')+'</div>':'')+
   (me&&me.started&&me.vs?'<div class="vs-ar-acct">가상 계좌(교육용): 위원회보다 '+pp(me.ret-(me.vs.committee||0))+' · 기준선보다 '+pp(me.ret-(me.vs.benchmark||0))+' · '+mdd(me)+'</div>':'');
  $('vs-c-sel').onchange=function(){season=this.value;load();};
  // Missions and badges: counted from my own cards; facts, no view on whether a trade was good.
  var cards=me?me.cardList:[], syms={}, inv=0, today=new Date(Date.now()+9*3600e3).toISOString().slice(0,10), todayCard=false;
  cards.forEach(function(c){syms[c.symbol]=1;if(c.invalidation!=null)inv++;});
  (me?me.orders:[]).forEach(function(o){if(o.side==='BUY'&&o.state!=='cancelled'&&o.state!=='rejected'&&new Date(Date.parse(o.createdAt)+9*3600e3).toISOString().slice(0,10)===today)todayCard=true;});
  var nsym=Object.keys(syms).length, against=me&&me.review?me.review.against.length:0, rv=me&&me.review;
  var q=function(icon,title,have,need){var done=have>=need;return '<div class="vs-q'+(done?' done':'')+'"><span class="vs-qi" aria-hidden="true">'+(done?'✓':icon)+'</span><b>'+title+'</b><span class="vs-qp">'+Math.min(have,need)+'/'+need+'</span><div class="vs-qbar"><i style="width:'+Math.round(100*Math.min(1,have/need))+'%"></i></div></div>';};
  $('vs-c-quests').innerHTML=!me?'<p class="vs-empty">로그인하면 미션이 열려요.</p>':[
   q('🎯','배치 경기: 판단 카드 3장 내기',me.cards,3),
   live?q('📅','오늘의 판단: 카드 1장',todayCard?1:0,1):'',
   q('🧩','다섯 종목에 카드 내기',nsym,5),
   q('🛡️','틀렸다고 볼 가격 정하기',inv,1),
   q('🔀','위원회와 반대편에 서 보기',against,1)].join('');
  var calibrated=rv&&rv.scored>=5&&Math.abs(rv.avgUp-rv.hitPct)<=10;
  var badge=function(icon,name,desc,ok){return '<div class="vs-bd'+(ok?'':' locked')+'"><span class="vs-bi" aria-hidden="true">'+icon+'</span><b>'+name+'</b><span>'+desc+'</span><span class="sr-only">'+(ok?'얻음':'아직')+'</span></div>';};
  $('vs-c-badges').innerHTML=[
   badge('🃏','첫 카드','첫 판단 카드',me&&me.cards>=1),
   badge('🏁','배치 완료','카드 3장',me&&me.cards>=3),
   badge('🧭','분산의 달인','다섯 종목',nsym>=5),
   badge('🛡️','원칙주의자','틀렸다고 볼 가격 3번',inv>=3),
   badge('🔀','역발상가','위원회와 반대로',against>=1),
   badge('🎯','정직한 예보관','말한 확률과 실제가 10%p 안 (5장↑)',!!calibrated),
   badge('⚔️','위원회 격파','위원회보다 높은 점수',!!(me&&me.cards>=3&&mine0!=null&&ai0!=null&&mine0>ai0))].join('');
  // G-251: the season leaderboard (public nicknames only) and, once the season is over, the top players' cards.
  var tierLine='티어: '+d.tiers.map(function(t){return t.name+(t.min==null?' 0점 밑':' '+t.min+'점↑');}).join(' · ')+' · 카드 3장 전에는 배치 중';
  var lb=d.leaderboard.map(function(x){return '<div class="vs-row'+(x.me?' mine':'')+'"><span class="vs-medal'+(x.rank<=3?' m'+x.rank:'')+'">'+x.rank+'</span>'+emb(x.tier.key,30)+'<div><b>'+esc(x.nickname)+'</b>'+(x.me?' <span class="vs-tag ok">나</span>':'')+'<div class="vs-sub" style="grid-column:auto">'+esc(x.tier.name)+' · 카드 '+x.cards+'장</div></div><div class="vs-r"><b>'+x.skill+'</b>점</div></div>';}).join('');
  var nick=me?'<form class="vs-nick" id="vs-nick"><label for="vs-nick-in">닉네임</label><input type="text" id="vs-nick-in" name="nickname" maxlength="12" value="'+esc(me.profile?me.profile.nickname:'')+'" placeholder="2~12자"><label><input type="checkbox" name="public"'+(me.profile&&me.profile.public?' checked':'')+'> 순위표에 보이기</label><button type="submit" class="vs-btn">저장</button></form>':'';
  var shown=d.shown.length?'<h2>상위권 판단 카드 <small>시즌이 끝나 공개해요 · 이유 글은 공개하지 않아요</small></h2>'+d.shown.map(function(x){return '<details class="card vs-rules"><summary>'+x.rank+'위 '+esc(x.nickname)+' · '+esc(x.tier.name)+' · '+x.skill+'점</summary>'+x.cards.map(function(c){return '<div class="vs-row"><div><b>'+esc(c.name)+'</b> <span class="vs-sub">'+esc(c.date)+'</span></div><div class="vs-r">'+c.upPct+'%'+(c.hit==null?'':c.hit?' · 올랐어요':' · 내렸어요')+'</div></div>';}).join('')+'</details>';}).join(''):'';
  $('vs-c-board-top').innerHTML='<h2>시즌 랭킹 <small>판단 점수 · 닉네임을 공개한 사람만</small></h2><div class="card vs-card vs-lb">'+(lb||'<p class="vs-empty">아직 순위표에 오른 사람이 없어요. 카드 3장을 내고 닉네임을 공개하면 올라가요.</p>')+nick+'<p class="vs-sub" style="padding:0 0 10px">'+tierLine+'. 시즌 중에는 다른 사람의 종목이 보이지 않아요.</p></div>'+shown;
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
  $('vs-c-board').innerHTML=!live?'<p class="vs-empty">끝난 시즌이에요. 진행 중인 시즌에서 사고팔 수 있어요.</p>':d.board.length?d.board.map(function(b){
   return '<div class="vs-row" data-row="'+esc(b.symbol)+'"><div><b>'+esc(b.name)+'</b> <span class="vs-sub">'+esc(b.symbol)+' · '+won(b.close)+'</span>'+(b.upPct!=null?'<div class="vs-reveal">위원회가 본 오를 확률 '+b.upPct+'%</div>':'<div class="vs-hide"><span class="vs-hc" aria-hidden="true">?</span>위원회 카드 숨김 · 내 카드를 내면 열려요</div>')+'</div><div class="vs-r"><button type="button" class="vs-btn" data-buy="'+esc(b.symbol)+'">사기</button></div>'+(open===b.symbol?form(b):'')+'</div>';}).join(''):'<p class="vs-empty">위원회가 지금 판단 중인 종목이 없어요. 다음 리포트 뒤 다시 확인해 주세요.</p>';
  // Look back: facts only.
  var r=me&&me.review;
  $('vs-c-review').innerHTML=r&&r.cards?'<h2>복기 <small>계산한 사실만, 평가는 하지 않아요</small></h2><div class="card vs-card">'+
   '<div class="vs-row"><div><b>말한 확률과 실제</b><div class="vs-sub">'+(r.scored?'평균 '+r.avgUp+'%로 말했고 '+r.hitPct+'%가 산 가격보다 높았어요 ('+r.scored+'장'+(d.closed?'':', 오늘 가격 기준')+').':'아직 채점할 카드가 없어요.')+'</div></div></div>'+
   ['high','mid','low'].filter(function(k){return r.bands[k].n;}).map(function(k){var b=r.bands[k];return '<div class="vs-row"><div><b>'+({high:'60% 이상으로 본 카드',mid:'45~59%로 본 카드',low:'45% 미만으로 본 카드'})[k]+'</b><div class="vs-sub">'+b.n+'장 · 평균 '+b.avgUp+'% · 실제로 높았던 비율 '+b.hitPct+'%</div></div></div>';}).join('')+
   (r.invalidation.set?'<div class="vs-row"><div><b>틀렸다고 볼 가격</b><div class="vs-sub">'+r.invalidation.set+'장에 적었고 '+r.invalidation.broke+'장이 그 가격에 닿았어요.</div></div></div>':'')+
   (r.against.length?'<div class="vs-row"><div><b>위원회와 반대로 본 종목</b><div class="vs-sub">'+r.against.map(function(a){return esc(a.name)+' (나 '+a.upPct+'% · 위원회 '+a.committeeUp+'%'+(a.hit==null?'':a.hit?' · 올랐어요':' · 내렸어요')+')';}).join(', ')+'</div></div></div>':'')+'</div>':'';
  $('vs-c-committee-list').innerHTML=d.committee.holdings.length?d.committee.holdings.map(function(h){return '<div class="vs-row"><div><b>'+esc(h.name)+'</b></div><div class="vs-r">비중 '+pct(h.weight)+'</div></div>';}).join(''):'<p class="vs-empty">지금은 현금만 있어요. 55% 이상으로 본 종목이 없을 때예요.</p>';
 }
 function form(b){var id=esc(b.symbol);return '<form class="vs-fc" data-form="'+id+'"><div class="vs-fc-h"><span>판단 카드</span><span>'+esc(b.name)+' · '+won(b.close)+'</span></div>'+
  '<label>시즌 마지막 종가가 산 가격보다 높을 확률<output class="vs-pct" id="vs-pct-'+id+'">60%</output><input type="range" name="upPct" min="1" max="99" value="60" aria-describedby="vs-pct-'+id+'"><span class="vs-ends"><span>내릴 것 같다</span><span>반반</span><span>오를 것 같다</span></span><span>맞았는지와 비교해 채점돼요. 자신 없으면 50%에 가깝게.</span></label>'+
  '<label>얼마나 살까요<span>10만 원~1,000만 원, 계좌의 30%까지 (가상 돈)</span><input type="number" name="amount" min="100000" max="10000000" step="10000" value="2000000" required></label>'+
  '<label>틀렸다고 볼 가격 (선택)<span>종가가 여기에 닿으면 판단이 틀린 거예요. 지금 '+won(b.close)+'보다 낮게.</span><input type="number" name="invalidation" min="1" step="1" inputmode="numeric"></label>'+
  '<label>이유 한 줄 (선택, 나만 봐요)<input type="text" name="reason" maxlength="80"></label><div class="vs-acts"><button type="button" class="vs-btn" data-close>닫기</button><button type="submit" class="vs-btn go">카드 내기</button></div></form>';}
 var EMB={diamond:['#7fb4ff','#3d5bff','다'],platinum:['#7fe3e0','#2a9ea6','플'],gold:['#ffe08a','#d99a1e','골'],silver:['#eef2f6','#97a3b2','실'],bronze:['#f2b68a','#a5622f','브'],placing:['#cfd6e0','#6b7787','?']};
 function emb(key,size){var c=EMB[key]||EMB.placing,g='g'+key+size;return '<svg class="vs-emb" width="'+size+'" height="'+size+'" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="'+g+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+c[0]+'"/><stop offset="1" stop-color="'+c[1]+'"/></linearGradient></defs><path d="M32 3l25 9v19c0 15-11 25-25 30C18 56 7 46 7 31V12z" fill="url(#'+g+')" stroke="rgba(255,255,255,.7)" stroke-width="2"/><path d="M32 12l15 5.5v13c0 9-6.5 15.5-15 19-8.5-3.5-15-10-15-19v-13z" fill="rgba(255,255,255,.18)"/><text x="32" y="38" text-anchor="middle" font-size="15" font-weight="900" fill="#fff" font-family="inherit">'+c[2]+'</text></svg>';}
 var TIERS_UP=[['실버',0],['골드',10],['플래티넘',20],['다이아',30]];
 function nextTier(k){for(var i=0;i<TIERS_UP.length;i++)if(k<TIERS_UP[i][1])return {name:TIERS_UP[i][0],need:TIERS_UP[i][1]-k};return {name:null,need:0};}
 function flip(mine,ai){var f=$('vs-c-flip');$('vs-flip-me').textContent=mine+'%';$('vs-flip-ai').textContent=ai==null?'?':ai+'%';$('vs-flip-t').textContent=ai==null?'위원회 카드는 다음 업데이트 때 열려요.':Math.abs(mine-ai)<=5?'위원회와 거의 같게 봤어요. 결과는 시즌 끝에 채점돼요.':(mine>50)!==(ai>50)?'위원회와 반대편에 섰어요! 누가 맞을지 시즌 끝에 가려요.':'같은 방향, 다른 자신감이에요. 시즌 끝에 채점돼요.';f.hidden=false;f.querySelector('[data-flip-close]').focus();}
 function load(after){
  if(!G.call){$('vs-c-arena').innerHTML='<p class="vs-empty">대회는 베타 서버가 연결된 사이트에서 열려요.</p>';$('vs-c-board').innerHTML='';return;}
  G.call('GET','/contest'+(season?'?season='+encodeURIComponent(season):'')).then(function(r){
   if(r.error){$('vs-c-arena').innerHTML='<p class="vs-empty">'+esc(r.message||'대회 자료를 불러오지 못했어요.')+'</p>';$('vs-c-board').innerHTML='';return;}
   data=r;paint();if(after)after();
  });
 }
 var toast=function(m){(G.toast||alert)(m);};
 document.addEventListener('click',function(e){
  if(e.target.closest('[data-flip-close]')){$('vs-c-flip').hidden=true;return;}
  var t=e.target.closest('[data-buy],[data-sell],[data-cancel],[data-close]');if(!t||!data)return;
  if(t.hasAttribute('data-close')){open=null;paint();return;}
  if(!data.me){location.href='login.html';return;}
  if(t.dataset.buy){open=open===t.dataset.buy?null:t.dataset.buy;paint();var f=document.querySelector('[data-form="'+open+'"] input');if(f)f.focus();return;}
  if(t.dataset.sell){if(!confirm('가진 주식을 전부 팔까요? 다음 장 마감 가격으로 체결돼요.'))return;t.disabled=true;G.call('POST','/contest/orders',{side:'SELL',symbol:t.dataset.sell}).then(function(r){toast(r.error?r.message:r.fillDate+' 종가로 팔아요.');load();});return;}
  if(t.dataset.cancel){t.disabled=true;G.call('POST','/contest/orders/'+t.dataset.cancel+'/cancel').then(function(r){toast(r.error?r.message:'주문을 취소했어요.');load();});}
 });
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('vs-c-flip').hidden)$('vs-c-flip').hidden=true;});
 document.addEventListener('input',function(e){if(e.target.name==='upPct'){var o=e.target.parentNode.querySelector('output');if(o)o.textContent=e.target.value+'%';}});
 document.addEventListener('submit',function(e){var n=e.target.closest('#vs-nick');if(n){e.preventDefault();G.call('POST','/contest/profile',{nickname:n.nickname.value.trim(),public:n.public.checked}).then(function(r){toast(r.error?r.message:'저장했어요.');if(!r.error)load();});return;}var f=e.target.closest('[data-form]');if(!f)return;e.preventDefault();
  var btn=f.querySelector('[type=submit]');btn.disabled=true;
  G.call('POST','/contest/orders',{side:'BUY',symbol:f.dataset.form,amount:Number(f.amount.value),upPct:Number(f.upPct.value),invalidation:f.invalidation.value?Number(f.invalidation.value):null,reason:f.reason.value}).then(function(r){
   btn.disabled=false;if(r.error){toast(r.message);return;}var sym=f.dataset.form,mine=Number(f.upPct.value);open=null;load(function(){var b=(data.board||[]).filter(function(x){return x.symbol===sym;})[0];flip(mine,b&&b.upPct!=null?b.upPct:null);toast(r.fillDate+' 종가로 체결돼요.');});});
 });
 load();
})();
</script>`;

/** vs.html. `sections`: more sections after the contest (each its own <section class="vs-sec" id="vs-…">), with their scripts. */
export function renderVsPage(sections: readonly { html: string; script?: string }[] = []): string {
  const body = `<div class="vs-page"><section class="card vs-hero"><div class="pl-k">위원회</div><h1>나 vs 위원회</h1><p>한 달 시즌 동안 AI 위원회와 같은 종목, 같은 규칙으로 대결해요. 수익이 아니라 내 판단이 얼마나 맞는지로 점수와 티어가 올라가요.</p></section>
${CONTEST}${sections.map((s) => s.html).join('')}</div>`;
  return shell('', 'GNOMON | 나 vs 위원회', CSS + body, { mode: 'vs.html', scripts: SCRIPT + sections.map((s) => s.script ?? '').join('') });
}
