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
  var createdDay=r.generatedAt?new Date(Date.parse(r.generatedAt)+9*3600000).toISOString().slice(0,10):'',staticDay=(document.getElementById('tab-ai')||{}).dataset?.aiDate||'';
  if(!new URLSearchParams(location.search).has('job')&&staticDay&&(createdDay||r.dataDate||'')<staticDay)return true;
  document.documentElement.dataset.reportJob='done';
  document.querySelectorAll('[data-report-state]').forEach(function(x){x.textContent=(createdDay?createdDay+' 작성 · ':'')+'AI 리포트 준비 완료';});
  var request=document.querySelector('.request-card');if(request){var head=request.querySelector('.lk-head b'),description=request.querySelector('p');if(head)head.textContent='AI 리포트가 준비됐어요';if(description)description.textContent='AI 위원회 탭에서 생성된 리포트를 확인하세요.';request.querySelectorAll('[data-create-report]').forEach(function(b){b.remove();});}

  // G-106/G-114: an AI report older than the prices shown says so, with a way to a fresh one, on the summary and the AI tab.
  var sess=((document.querySelector('[data-session]')||{}).dataset||{}).session||((document.getElementById('sp-date')||{}).textContent||'').slice(0,10);
  document.querySelectorAll('[data-stale-ai]').forEach(function(x){x.remove();});
  var bar=createdDay<sess&&r.dataDate&&/^\\d{4}-\\d{2}-\\d{2}$/.test(sess)&&r.dataDate<sess?'<div class="stale-ai" data-stale-ai role="note"><span class="sa-ic" aria-hidden="true">🕒</span><div class="sa-tx"><b>더 새로운 데이터가 있어요</b><small>AI 리포트 '+esc(r.dataDate)+' 기준 · 가격 '+esc(sess)+' 기준</small></div><button type="button" class="sa-go" data-create-report data-symbol="'+esc(r.symbol)+'" data-name="'+esc(r.symbol)+'">새 데이터로 다시 분석</button></div>':'';
  Object.keys(r.fragments||{}).forEach(function(key){
   if(key==='scenarios'){try{var list=JSON.parse(r.fragments[key]);if(window.GNM_scenarios)window.GNM_scenarios(list);}catch(e){}return;}
   var panel=document.getElementById('tab-'+key);if(!panel)return;
   var composer=key==='ai'?panel.querySelector('.db-join'):null;if(composer)composer.remove();
   var target=panel.querySelector('[data-generated]');
   if(!target){target=document.createElement('section');target.setAttribute('data-generated',key);if(key==='ai'){var title=panel.querySelector('.panel-title');panel.innerHTML='';if(title)panel.appendChild(title);panel.appendChild(target);}else if(key==='home'){var heroEl=panel.querySelector('.hero');while(heroEl&&heroEl.parentElement&&heroEl.parentElement!==panel)heroEl=heroEl.parentElement;if(heroEl&&heroEl.parentElement===panel)heroEl.after(target);else panel.prepend(target);}else panel.prepend(target);}
   if(key==='home'){var stale=panel.querySelector('#home-conclusion');if(stale&&!target.contains(stale))stale.remove();}
   panel.querySelectorAll('[data-stale-ai]').forEach(function(x){x.remove();});
   target.innerHTML=r.fragments[key];if(composer&&!target.querySelector('.db-join'))(panel.querySelector('.card.debate')||target).appendChild(composer);
   if(bar&&(key==='home'||key==='ai'))target.insertAdjacentHTML('afterbegin',bar);
   panel.querySelectorAll('[data-missing]').forEach(function(x){x.remove();});
  });
  var join=document.querySelector('#tab-ai .join-wrap'), debate=document.querySelector('#tab-ai #debate .card.debate');if(join&&debate){debate.appendChild(join.querySelector('.db-join'));join.remove();}
  if(window.GNM_parliament)GNM_parliament();if(window.GNM_debateFilter)GNM_debateFilter();if(window.GNM_debate)GNM_debate();if(window.GNM_pastQA)GNM_pastQA();return true;
 };
 // G-104: an estimated countdown and rotating lines while the committee writes (estimate, not a promise).
 // Each stage has its own Thinking Orbs; the big orb cycles through the stage's set while the job runs.
 var ORB_CYCLE={queued:['connecting','breathing','listening'],searching:['searching','listening','connecting'],working:['solving','weaving','shaping','working'],composing:['composing','weaving','shaping']},STEPS=[['queued','접수','connecting'],['searching','자료 확인','searching'],['working','토론·분석','solving'],['composing','작성','composing']],curStage='queued';
 var paintSteps=function(){if(!dialog)return;var at=STEPS.findIndex(function(x){return x[0]===curStage;});dialog.querySelectorAll('.job-steps li').forEach(function(li,k){li.className=k<at?'done':k===at?'on':'';});var big=dialog.querySelector('.orbs-load canvas');if(big)big.dataset.orb=(ORB_CYCLE[curStage]||ORB_CYCLE.working)[0];};
 var FUN=['위원 11명이 자리에 앉고 있어요 🪑','기술 데스크가 차트를 확대하는 중이에요 🔍','수급 데스크가 외국인 지갑을 들여다보는 중 👀','레드팀이 반론거리를 찾고 있어요 🥊','펀더멘털 데스크가 실적표에 형광펜 칠하는 중 🖍️','공시 데스크가 DART를 정독하고 있어요 📑','분석가들이 목표가를 두고 토론 중이에요 🗣️','강세파와 약세파가 팽팽해요 ⚖️','최악의 경우도 꼼꼼히 따져 보는 중 🧯','시나리오 확률을 계산기로 두드리는 중 🧮','근거 없는 말은 지우는 중이에요 ✂️','커피 한 모금… 거의 다 써 가요 ☕','토론 순서를 정리하고 있어요 🎙️','마지막으로 숫자를 한 번 더 확인해요 ✅'];
 var eta={iv:null,started:null,est:150,start:function(){var self=this;clearInterval(self.iv);self.started=null;var i=Math.floor(Math.random()*FUN.length),tick=0;
   var paintEta=function(){if(!dialog)return;var el=dialog.querySelector('[data-eta]'),bar=dialog.querySelector('[data-eta-bar]'),fun=dialog.querySelector('[data-fun]');if(!el)return;
    var t0=self.started||Date.now(),gone=(Date.now()-t0)/1000,left=Math.round(self.est-gone);
    var mmss=function(t){t=Math.max(0,Math.round(t));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');};el.textContent=left>0?mmss(left):'거의 다 됐어요 · '+mmss(gone)+' 지남';
    if(bar)bar.style.width=Math.min(97,gone/self.est*100)+'%';
    if(fun&&tick%4===0){fun.textContent=left>0?FUN[i%FUN.length]:'예상보다 조금 더 걸리고 있어요. 꼼꼼히 쓰는 중이에요 🐢';i++;var big=dialog.querySelector('.orbs-load canvas'),seq=ORB_CYCLE[curStage]||ORB_CYCLE.working;if(big)big.dataset.orb=seq[i%seq.length];}tick++;};
   paintEta();self.iv=setInterval(paintEta,1000);},
  stop:function(){clearInterval(this.iv);this.iv=null;},
  set:function(kind,createdAt,etaSec){this.est=etaSec>0?etaSec:(kind==='brief'?40:150);var t=Date.parse(createdAt||'');if(Number.isFinite(t))this.started=t;}};
 // One popup for the whole flow (G-121): confirm the credits, then the same window shows the progress.
 var watchTitle='AI 리포트 생성';
 var ensure=function(title){
  if(!dialog||!dialog.isConnected){dialog=document.createElement('dialog');dialog.className='v2-dialog rj';dialog.innerHTML='<header class="rj-head"><div><span class="rj-k">GNOMON AI 위원회</span><b class="rj-t"></b></div><button type="button" class="dialog-x" aria-label="닫기">×</button></header><div class="rj-body"></div>';document.body.appendChild(dialog);dialog.querySelector('.dialog-x').onclick=function(){dialog.close();};dialog.addEventListener('close',function(){eta.stop();});}
  dialog.querySelector('.rj-t').textContent=title;if(!dialog.open)dialog.showModal();return dialog;
 };
 var progressHtml=function(){return '<div class="orbs-load">${ORBS}<span data-job-state>작업을 확인하고 있어요</span></div><ol class="job-steps">'+STEPS.map(function(x){return '<li><canvas data-orb="'+x[2]+'" data-size="20" aria-hidden="true"></canvas><span>'+x[1]+'</span></li>';}).join('')+'</ol><div class="job-eta"><div class="job-eta-top"><span>예상 남은 시간</span><b data-eta>계산 중</b></div><div class="job-bar"><i data-eta-bar></i></div><p class="job-fun" data-fun aria-live="polite"></p></div><p class="rj-note">창을 닫아도 작업은 계속돼요. 완성되면 알림으로 알려 드리고, 새로고침 후에도 확인할 수 있어요.</p>';};
 // The popup may be showing a new request's confirm step; a running job then writes nowhere.
 var live=function(){return dialog&&dialog.querySelector('.orbs-load')?dialog:null;};
 var watch=function(id,show){
  if(timer)clearTimeout(timer);store(id);
  if(show){ensure(watchTitle);dialog.querySelector('.rj-body').innerHTML=progressHtml();curStage='queued';paintSteps();eta.start();}
  var poll=function(){G.call('GET','/reports/'+id).then(function(r){
   if(r.error&&typeof r.error==='string'&&!r.status){if(live())dialog.querySelector('[data-job-state]').textContent=r.message||'작업을 확인하지 못했어요';if(r.error==='NOT_FOUND'||r.error==='FORBIDDEN'||r.error==='UNAUTHORIZED')return;timer=setTimeout(poll,5000);return;}
   if(r.kind||r.createdAt)eta.set(r.kind,r.createdAt,r.etaSec);
   if(r.status==='done'){eta.stop();
    if(!r.fragments || !r.fragments.ai){if(live())dialog.querySelector('.orbs-load').innerHTML='<b>완료된 리포트 본문을 불러오지 못했어요</b><p>크레딧을 다시 사용하지 말고 새로고침하거나 문의해 주세요.</p>';if(G.toast)G.toast('완료된 리포트 본문을 불러오지 못했어요. 새로고침하거나 문의해 주세요.','error');return;}
    var current=new URLSearchParams(location.search).get('c')||new URLSearchParams(location.search).get('m')||(document.querySelector('[data-symbol]')||{}).dataset?.symbol;
    if(current===r.symbol)paint(r);
    var href=(document.body.dataset.base||'')+(r.symbol.indexOf('KRW-')===0?'coin.html?m=':'stock.html?c=')+encodeURIComponent(r.symbol)+'&job='+id+'#tab-ai';
    if(live())dialog.querySelector('.orbs-load').innerHTML='<b>리포트가 완성됐어요</b><span>데이터 기준 '+esc(r.dataDate||'확인 필요')+' · 생성 '+esc(r.generatedAt||'')+'</span><a class="btn-primary" href="'+href+'">리포트 보기</a>';
    if(G.refresh)G.refresh();return;
   }
   if(r.status==='failed'){eta.stop();if(live()){dialog.querySelector('.orbs-load').innerHTML='<b>리포트를 만들지 못했어요</b><p>'+esc(r.error||'크레딧은 반환했어요. 다시 요청해 주세요.')+'</p><button type="button" class="btn-primary" data-retry-report>다시 요청</button>';dialog.querySelector('[data-retry-report]').onclick=function(){dialog.close();G.startReport(r.kind==='brief'?'brief':'report',r.symbol,r.symbol);};}if(G.refresh)G.refresh();return;}
   if(dialog){var text=dialog.querySelector('[data-job-state]');if(text)text.textContent=stage[r.stage]||'분석 중이에요';curStage=stage[r.stage]?r.stage:'working';paintSteps();}
   timer=setTimeout(poll,1000);
  });};poll();
 };
 G.startReport=function(kind,symbol,name){
  if(!G.api){G.toast('AI 서버 연결이 필요해요.');return Promise.resolve(false);}
  if(!G.me){G.toast('로그인하면 리포트를 생성할 수 있어요.');return Promise.resolve(false);}
  var cost=G.me.costs[kind],bal=G.me.credits,label=kind==='brief'?'요약 리포트':kind==='upgrade'?'심층 리포트로 업그레이드':'AI 위원회 심층 리포트';
  watchTitle=(name||symbol)+' 리포트';ensure(watchTitle);eta.stop();
  var after=typeof bal==='number'?bal-cost:null;
  dialog.querySelector('.rj-body').innerHTML='<div class="rj-intro"><canvas data-orb="breathing" data-size="20" aria-hidden="true"></canvas><div><b>'+esc(label)+'</b><p>전문가 11명의 판단, 토론, 시나리오와 레드팀 검토까지 한 번에 만들어요. 보통 2~3분 걸려요.</p></div></div>'+
   '<dl class="rj-cost"><div><dt>사용 크레딧</dt><dd>'+esc(cost)+'</dd></div>'+(typeof bal==='number'?'<div><dt>남은 크레딧</dt><dd>'+esc(bal)+' → <b class="'+(after<0?'down':'')+'">'+esc(after)+'</b></dd></div>':'')+'</dl>'+
   '<p class="rj-note">같은 데이터로 이미 요청했다면 다시 차감하지 않아요. 만들지 못하면 크레딧은 돌려드려요.</p><p class="rj-err" hidden></p>'+
   '<div class="rj-actions"><button type="button" class="btn-ghost" data-rj-cancel>취소</button><button type="button" class="btn-primary" data-rj-go'+(after!=null&&after<0?' disabled':'')+'>'+esc(cost)+'크레딧으로 만들기</button></div>'+(after!=null&&after<0?'<p class="rj-note">크레딧이 모자라요. <a href="'+(document.body.dataset.base||'')+'pricing.html">크레딧 충전 ›</a></p>':'');
  return new Promise(function(done){
   var body=dialog.querySelector('.rj-body'),go=body.querySelector('[data-rj-go]'),err=body.querySelector('.rj-err');
   body.querySelector('[data-rj-cancel]').onclick=function(){dialog.close();done(false);};
   go.onclick=function(){go.disabled=true;go.innerHTML='<canvas data-orb="connecting" data-size="20" aria-hidden="true"></canvas> 접수하는 중';
    G.call('POST','/reports',{kind:kind,symbol:symbol}).then(function(r){
     if(r.error){go.disabled=false;go.textContent=cost+'크레딧으로 만들기';err.hidden=false;err.textContent=r.message||'요청하지 못했어요.';done(false);return;}
     watch(r.id,true);G.refresh();done(true);
    }).catch(function(){go.disabled=false;go.textContent=cost+'크레딧으로 만들기';err.hidden=false;err.textContent='연결을 확인한 뒤 다시 눌러 주세요.';done(false);});
   };
  });
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
