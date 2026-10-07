import { ORBS } from './ui.js';
export const JOBS_JS = `
(function(){
 var G=window.GNM;if(!G)return;
 var stage={queued:'작업을 시작하고 있어요',searching:'분석 자료를 확인하고 있어요',working:'근거와 시나리오를 분석하고 있어요',composing:'리포트를 작성하고 있어요'};
 var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
 var store=function(id){try{localStorage.setItem('gnm-report-job',id);}catch(e){}};
 var dialog=null, timer=null;
 var paint=function(r){
  if (!r.fragments || !r.fragments.ai) return false;
  document.documentElement.dataset.reportJob='done';
  document.querySelectorAll('[data-report-state]').forEach(function(x){x.textContent='AI 리포트가 준비됐어요';});
  var request=document.querySelector('.request-card');if(request){var head=request.querySelector('.lk-head b'),description=request.querySelector('p');if(head)head.textContent='AI 리포트가 준비됐어요';if(description)description.textContent='AI 위원회 탭에서 생성된 리포트를 확인하세요.';}

  Object.keys(r.fragments||{}).forEach(function(key){
   if(key==='scenarios'){try{var list=JSON.parse(r.fragments[key]);if(window.GNM_scenarios)window.GNM_scenarios(list);}catch(e){}return;}
   var panel=document.getElementById('tab-'+key);if(!panel)return;
   var composer=key==='ai'?panel.querySelector('.db-join'):null;if(composer)composer.remove();
   var target=panel.querySelector('[data-generated]');
   if(!target){target=document.createElement('section');target.setAttribute('data-generated',key);if(key==='ai'){var title=panel.querySelector('.panel-title');panel.innerHTML='';if(title)panel.appendChild(title);panel.appendChild(target);}else if(key==='home'){var heroEl=panel.querySelector('.hero');while(heroEl&&heroEl.parentElement&&heroEl.parentElement!==panel)heroEl=heroEl.parentElement;if(heroEl&&heroEl.parentElement===panel)heroEl.after(target);else panel.prepend(target);}else panel.prepend(target);}
   if(key==='home'){var stale=panel.querySelector('#home-conclusion');if(stale&&!target.contains(stale))stale.remove();
    // G-106: this AI report is older than the prices shown — offer a fresh one.
    var old=panel.querySelector('[data-stale-ai]');if(old)old.remove();
    var sess=((document.querySelector('[data-session]')||{}).dataset||{}).session||((document.getElementById('sp-date')||{}).textContent||'').slice(0,10);
    if(r.dataDate&&sess&&/^\\d{4}-\\d{2}-\\d{2}$/.test(sess)&&r.dataDate<sess)target.insertAdjacentHTML('afterbegin','<div class="stale-ai" data-stale-ai><span>🕒 AI 리포트는 <b>'+esc(r.dataDate)+'</b> 기준이에요. 그 뒤 가격·공시가 바뀌었을 수 있어요.</span><button type="button" class="btn-primary" data-create-report data-symbol="'+esc(r.symbol)+'" data-name="'+esc(r.symbol)+'">최신 리포트 생성하기</button></div>');}
   target.innerHTML=r.fragments[key];if(composer)(panel.querySelector('.card.debate')||target).appendChild(composer);
   panel.querySelectorAll('[data-missing]').forEach(function(x){x.remove();});
  });
  var join=document.querySelector('#tab-ai .join-wrap'), debate=document.querySelector('#tab-ai #debate .card.debate');if(join&&debate){debate.appendChild(join.querySelector('.db-join'));join.remove();}
  if(window.GNM_parliament)GNM_parliament();if(window.GNM_debateFilter)GNM_debateFilter();if(window.GNM_debate)GNM_debate();if(window.GNM_pastQA)GNM_pastQA();return true;
 };
 // G-104: an estimated countdown and rotating lines while the committee writes (estimate, not a promise).
 var FUN=['위원 11명이 자리에 앉고 있어요 🪑','기술 데스크가 차트를 확대하는 중이에요 🔍','수급 데스크가 외국인 지갑을 들여다보는 중 👀','레드팀이 반론거리를 찾고 있어요 🥊','펀더멘털 데스크가 실적표에 형광펜 칠하는 중 🖍️','공시 데스크가 DART를 정독하고 있어요 📑','분석가들이 목표가를 두고 토론 중이에요 🗣️','강세파와 약세파가 팽팽해요 ⚖️','최악의 경우도 꼼꼼히 따져 보는 중 🧯','시나리오 확률을 계산기로 두드리는 중 🧮','근거 없는 말은 지우는 중이에요 ✂️','커피 한 모금… 거의 다 써 가요 ☕','토론 순서를 정리하고 있어요 🎙️','마지막으로 숫자를 한 번 더 확인해요 ✅'];
 var eta={iv:null,started:null,est:150,start:function(){var self=this;clearInterval(self.iv);self.started=null;var i=Math.floor(Math.random()*FUN.length),tick=0;
   var paintEta=function(){if(!dialog)return;var el=dialog.querySelector('[data-eta]'),bar=dialog.querySelector('[data-eta-bar]'),fun=dialog.querySelector('[data-fun]');if(!el)return;
    var t0=self.started||Date.now(),gone=(Date.now()-t0)/1000,left=Math.round(self.est-gone);
    var mmss=function(t){t=Math.max(0,Math.round(t));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');};el.textContent=left>0?mmss(left):'거의 다 됐어요 · '+mmss(gone)+' 지남';
    if(bar)bar.style.width=Math.min(97,gone/self.est*100)+'%';
    if(fun&&tick%4===0){fun.textContent=left>0?FUN[i%FUN.length]:'예상보다 조금 더 걸리고 있어요. 꼼꼼히 쓰는 중이에요 🐢';i++;}tick++;};
   paintEta();self.iv=setInterval(paintEta,1000);},
  stop:function(){clearInterval(this.iv);this.iv=null;},
  set:function(kind,createdAt,etaSec){this.est=etaSec>0?etaSec:(kind==='brief'?40:150);var t=Date.parse(createdAt||'');if(Number.isFinite(t))this.started=t;}};
 var watch=function(id,show){
  if(timer)clearTimeout(timer);store(id);
  if(show){if(dialog)dialog.remove();dialog=document.createElement('dialog');dialog.className='v2-dialog';dialog.innerHTML='<header><b>AI 리포트 생성</b><button type="button" class="dialog-x" aria-label="닫기">×</button></header><div class="orbs-load">${ORBS}<span data-job-state>작업을 확인하고 있어요</span></div><div class="job-eta"><div class="job-eta-top"><span>예상 남은 시간</span><b data-eta>계산 중</b></div><div class="job-bar"><i data-eta-bar></i></div><p class="job-fun" data-fun aria-live="polite"></p></div><p class="muted small">창을 닫아도 작업은 계속됩니다. 새로고침 후에도 확인할 수 있어요.</p>';document.body.appendChild(dialog);dialog.showModal();dialog.querySelector('button').onclick=function(){dialog.close();};eta.start();}
  var poll=function(){G.call('GET','/reports/'+id).then(function(r){
   if(r.error&&typeof r.error==='string'&&!r.status){if(dialog)dialog.querySelector('[data-job-state]').textContent=r.message||'작업을 확인하지 못했어요';if(r.error==='NOT_FOUND'||r.error==='FORBIDDEN'||r.error==='UNAUTHORIZED')return;timer=setTimeout(poll,5000);return;}
   if(r.kind||r.createdAt)eta.set(r.kind,r.createdAt,r.etaSec);
   if(r.status==='done'){eta.stop();
    if(!r.fragments || !r.fragments.ai){if(dialog)dialog.querySelector('.orbs-load').innerHTML='<b>완료된 리포트 본문을 불러오지 못했어요</b><p>크레딧을 다시 사용하지 말고 새로고침하거나 문의해 주세요.</p>';if(G.toast)G.toast('완료된 리포트 본문을 불러오지 못했어요. 새로고침하거나 문의해 주세요.','error');return;}
    var current=new URLSearchParams(location.search).get('c')||new URLSearchParams(location.search).get('m')||(document.querySelector('[data-symbol]')||{}).dataset?.symbol;
    if(current===r.symbol)paint(r);
    var href=(document.body.dataset.base||'')+(r.symbol.indexOf('KRW-')===0?'coin.html?m=':'stock.html?c=')+encodeURIComponent(r.symbol)+'&job='+id+'#tab-ai';
    if(dialog)dialog.querySelector('.orbs-load').innerHTML='<b>리포트가 완성됐어요</b><span>데이터 기준 '+esc(r.dataDate||'확인 필요')+' · 생성 '+esc(r.generatedAt||'')+'</span><a class="btn-primary" href="'+href+'">리포트 보기</a>';
    if(G.refresh)G.refresh();return;
   }
   if(r.status==='failed'){eta.stop();if(dialog){dialog.querySelector('.orbs-load').innerHTML='<b>리포트를 만들지 못했어요</b><p>'+esc(r.error||'크레딧은 반환했어요. 다시 요청해 주세요.')+'</p><button type="button" class="btn-primary" data-retry-report>다시 요청</button>';dialog.querySelector('[data-retry-report]').onclick=function(){dialog.close();G.startReport(r.kind==='brief'?'brief':'report',r.symbol,r.symbol);};}if(G.refresh)G.refresh();return;}
   if(dialog){var text=dialog.querySelector('[data-job-state]');if(text)text.textContent=stage[r.stage]||'분석 중이에요';var c=dialog.querySelector('canvas');if(c)c.dataset.orb=r.stage==='composing'?'composing':'working';}
   timer=setTimeout(poll,1000);
  });};poll();
 };
 G.startReport=function(kind,symbol,name){
  if(!G.api){G.toast('AI 서버 연결이 필요해요.');return Promise.resolve(false);}
  if(!G.me){G.toast('로그인하면 리포트를 생성할 수 있어요.');return Promise.resolve(false);}
  var cost=G.me.costs[kind];if(!confirm(name+' 리포트 생성에 '+cost+'크레딧을 사용합니다. 동일한 데이터로 이미 요청했다면 다시 차감하지 않아요.'))return Promise.resolve(false);
  var layer=window.GNM_loading.begin(document.getElementById('main'),'리포트 생성을 시작하고 있어요','connecting');
  return G.call('POST','/reports',{kind:kind,symbol:symbol}).then(function(r){return layer.end().then(function(){if(r.error){G.toast(r.message);return false;}watch(r.id,true);G.refresh();return true;});}).catch(function(){layer.end();G.toast('연결을 확인해 주세요.');return false;});
 };
 G.showReport=watch;
 document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-create-report]');if(b){var symbol=new URLSearchParams(location.search).get('c')||new URLSearchParams(location.search).get('m')||b.dataset.symbol;G.startReport('report',symbol,b.dataset.name||symbol);}});
 (G.ready||Promise.resolve()).then(function(){
  if(!G.me){document.querySelectorAll('[data-report-state]').forEach(function(x){x.textContent='로그인 후 AI 리포트 확인';});return;}var id=new URLSearchParams(location.search).get('job');
  if(id){watch(id,false);return;}
  var symbol=new URLSearchParams(location.search).get('c')||new URLSearchParams(location.search).get('m')||(document.querySelector('[data-symbol]')||{}).dataset?.symbol;
  if(symbol)G.call('GET','/reports/latest/'+encodeURIComponent(symbol)).then(function(r){if(r.job)watch(r.job.id,r.job.status!=='done');else document.querySelectorAll('[data-report-state]').forEach(function(x){x.textContent=r.error?'AI 리포트 조회 실패':'AI 리포트 없음';});});
  else{try{id=localStorage.getItem('gnm-report-job');}catch(e){}if(id)G.call('GET','/reports/'+id).then(function(r){if(['queued','running'].indexOf(r.status)>=0)watch(id,true);});}
 });
})();`;
