import { CREDIT_COST } from './plans.js';
import { GEN_BUTTON_JS_FN } from './generateButton.js';
export const JOBS_JS = `
(function(){
 var G=window.GNM;if(!G)return;
 ${GEN_BUTTON_JS_FN}
 var stage={queued:'작업을 시작하고 있어요',searching:'분석 자료를 확인하고 있어요',working:'근거와 시나리오를 분석하고 있어요',composing:'리포트를 작성하고 있어요'};
 var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
 var store=function(id){try{localStorage.setItem('gnm-report-job',id);}catch(e){}};
 var timer=null;
 var paint=function(r){
  if (!r.fragments || !r.fragments.ai) return false;
  var createdDay=r.generatedAt?new Date(Date.parse(r.generatedAt)+9*3600000).toISOString().slice(0,10):'',staticDay=(document.getElementById('tab-ai')||{}).dataset?.aiDate||'';
  if(!new URLSearchParams(location.search).has('job')&&staticDay&&(createdDay||r.dataDate||'')<staticDay)return true;
  document.documentElement.dataset.reportJob='done';
  document.querySelectorAll('[data-report-state]').forEach(function(x){x.textContent=(createdDay?createdDay+' 작성 · ':'')+'AI 리포트 준비 완료';});
  var request=document.querySelector('.request-card');if(request){var head=request.querySelector('.lk-head b'),description=request.querySelector('p');if(head)head.textContent='AI 리포트가 준비됐어요';if(description)description.textContent='AI 위원회 탭에서 생성된 리포트를 확인하세요.';request.querySelectorAll('[data-create-report]').forEach(function(b){b.remove();});}

  // G-106/G-114: an AI report older than the prices shown says so, with a way to a fresh one, on the summary and the AI tab.
  var sess=((document.querySelector('[data-session]')||{}).dataset||{}).session||((document.getElementById('sp-date')||{}).textContent||'').slice(0,10);
  document.querySelectorAll('[data-report-status]').forEach(function(x){x.remove();});
  // G-178: the status strip for the report just painted — stale (new prices since) or fresh.
  var stale=createdDay<sess&&r.dataDate&&/^\\d{4}-\\d{2}-\\d{2}$/.test(sess)&&r.dataDate<sess;
  var md=function(d){return String(d||'').slice(5).replace('-','/');};
  var bar=stale?'<div class="rs-bar rs-stale" data-report-status data-stale-ai role="note"><span class="rs-dot" aria-hidden="true"></span><div class="sa-tx"><b>'+md(r.dataDate)+' 위원회 리포트 · 그 뒤 새 가격이 있어요</b><small>가격 '+esc(sess)+' 기준으로 다시 분석할 수 있어요</small></div>'+gnmGenButton('새 리포트 만들기','data-create-report data-symbol="'+esc(r.symbol)+'" data-name="'+esc(r.name||r.symbol)+'"',((G.me&&G.me.costs&&G.me.costs.report)||${CREDIT_COST.report})+'크레딧')+'</div>':'<div class="rs-bar" data-report-status role="note"><span class="rs-dot" aria-hidden="true"></span><div class="sa-tx"><b>'+(md(r.dataDate)||'오늘')+' 위원회 리포트 · 가격과 같은 날</b><small>방금 만든 리포트예요</small></div></div>';
  Object.keys(r.fragments||{}).forEach(function(key){
   if(key==='chart')return;
   if(key==='scenarios'){try{var list=JSON.parse(r.fragments[key]);if(window.GNM_scenarios)window.GNM_scenarios(list);}catch(e){}return;}
   var panel=document.getElementById('tab-'+key);if(!panel)return;
   // G-154: a tab that already shows this data (a report page's own 기업 체력·수급) keeps it; a placeholder slot takes
   // the generated panel in place. Prepending a second copy repeated whole sections.
   if(key==='fundamentals'||key==='flows'||key==='news'){var slot=panel.querySelector('[data-slot="'+key+'"]');if(slot){if(!slot.querySelector('.empty,[data-missing]')&&slot.textContent.trim().length>40)return;if(r.fragments[key]){var frag=r.fragments[key];if(key==='news'){var tmp=document.createElement('div');tmp.innerHTML=frag;var card=tmp.querySelector('[data-slot="news"]');frag=card?card.innerHTML:frag;}slot.innerHTML=frag;slot.setAttribute('data-filled','');}return;}}
   var composer=key==='ai'?panel.querySelector('.db-join'):null;if(composer)composer.remove();
   var target=panel.querySelector('[data-generated]');
   if(!target){target=document.createElement('section');target.setAttribute('data-generated',key);if(key==='ai'){var title=panel.querySelector('.panel-title');panel.innerHTML='';if(title)panel.appendChild(title);panel.appendChild(target);}else if(key==='home'){var heroEl=panel.querySelector('.hero');while(heroEl&&heroEl.parentElement&&heroEl.parentElement!==panel)heroEl=heroEl.parentElement;if(heroEl&&heroEl.parentElement===panel)heroEl.after(target);else panel.prepend(target);}else panel.prepend(target);}
   if(key==='home'){var old=panel.querySelector('#home-conclusion');if(old&&!target.contains(old))old.remove();}
   target.innerHTML=r.fragments[key];if(composer){var fresh=target.querySelector('.db-join');if(fresh)fresh.replaceWith(composer);else(panel.querySelector('.card.debate')||target).appendChild(composer);}
   if(bar&&key==='ai')target.insertAdjacentHTML('afterbegin',bar);
   if(bar&&key==='home'){var heroEl=panel.querySelector('.hero');if(heroEl)heroEl.insertAdjacentHTML('afterend',bar);else target.insertAdjacentHTML('afterbegin',bar);}
   panel.querySelectorAll('[data-missing]').forEach(function(x){x.remove();});
  });
  var join=document.querySelector('#tab-ai .join-wrap'), debate=document.querySelector('#tab-ai #debate .card.debate');if(join&&debate){debate.appendChild(join.querySelector('.db-join'));join.remove();}
  if(window.GNM_parliament)GNM_parliament();if(window.GNM_debateFilter)GNM_debateFilter();if(window.GNM_debate)GNM_debate();if(window.GNM_pastQA)GNM_pastQA();return true;
 };
 // G-185: no popup. The button that asked for the report carries the whole flow: one press shows the price,
 // a second press starts it, then the button fills as the job runs, with the stage and an estimated time left
 // (an estimate, not a promise); the status strip around it says what the committee is doing. Done turns it
 // into 보기. A job running with no button on the page (another page, after a reload) gets a small floating pill.
 var STEPS=[['queued','접수'],['searching','자료 확인'],['working','토론·분석'],['composing','작성']];
 var FUN=['위원 11명이 자리에 앉고 있어요 🪑','기술 데스크가 차트를 확대하는 중이에요 🔍','수급 데스크가 외국인 지갑을 들여다보는 중 👀','레드팀이 반론거리를 찾고 있어요 🥊','펀더멘털 데스크가 실적표에 형광펜 칠하는 중 🖍️','공시 데스크가 DART를 정독하고 있어요 📑','분석가들이 목표가를 두고 토론 중이에요 🗣️','강세파와 약세파가 팽팽해요 ⚖️','최악의 경우도 꼼꼼히 따져 보는 중 🧯','시나리오 확률을 계산기로 두드리는 중 🧮','근거 없는 말은 지우는 중이에요 ✂️','커피 한 모금… 거의 다 써 가요 ☕','토론 순서를 정리하고 있어요 🎙️','마지막으로 숫자를 한 번 더 확인해요 ✅'];
 var base=document.body.dataset.base||'';
 var job={id:null,symbol:'',name:'',state:'',stage:'queued',est:150,started:null,iv:null,tick:0,fun:Math.floor(Math.random()*FUN.length),href:'',floatClosed:false};
 var mmss=function(t){t=Math.max(0,Math.round(t));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');};
 var pageSymbol=function(){var q=new URLSearchParams(location.search);return q.get('c')||q.get('m')||q.get('s')||((document.querySelector('[data-symbol]')||{}).dataset||{}).symbol||'';};
 var floatEl=function(make){var f=document.querySelector('.job-float');if(!f&&make&&!job.floatClosed){f=document.createElement('div');f.className='job-float';f.setAttribute('role','status');f.innerHTML=gnmGenButton('AI 리포트','data-job-float','')+'<button type="button" class="job-x" aria-label="닫기">×</button>';document.body.appendChild(f);f.querySelector('.job-x').onclick=function(){job.floatClosed=true;f.remove();};}return f;};
 // The buttons that show the job: every report button on the page, else the floating pill.
 var targets=function(){var list=[].slice.call(document.querySelectorAll('[data-create-report]'));if(list.length)return list;var f=floatEl(job.state==='running'||job.state==='done'||job.state==='failed');return f?[f.querySelector('.gen-btn')]:[];};
 var keep=function(b){if(window.gnmBtnKeep)gnmBtnKeep(b);};
 var fx=function(b,state,pct){if(state!=='running'&&b.__liquid)b.__liquid.stop();if(state!=='sending'&&b._tk){b._tk.stop();b._tk=null;}if(state==='running'&&window.gnmLiquid){var lq=gnmLiquid(b);if(lq&&pct!=null)lq.level(pct/100);}};
 var reset=function(b){clearTimeout(b._cf);fx(b,'');if(window.gnmBtnRestore)gnmBtnRestore(b);var x=b.parentNode&&b.parentNode.querySelector('.job-cancel');if(x)x.remove();var bar=b.closest('.rs-bar');if(bar&&bar._tx){bar.querySelector('.sa-tx').innerHTML=bar._tx;bar._tx=null;}};
 var dress=function(b,state,main,sub,pct){keep(b);b.dataset.job=state;b.setAttribute('aria-busy',String(state==='running'||state==='sending'));
  var busy=state==='running'||state==='sending';
  b.innerHTML=(busy?'<i class="job-fill" style="width:'+(pct||4)+'%"></i><span class="job-spin" aria-hidden="true"></span>':state==='done'?'<span class="job-ok" aria-hidden="true">✓</span>':'')+'<span class="job-main">'+esc(main)+'</span>'+(sub?'<small class="job-sub">'+esc(sub)+'</small>':'');
  b.setAttribute('aria-label',main+(sub?' · '+sub:''));fx(b,state,pct);};
 var text=function(b,main,sub,pct){var m=b.querySelector('.job-main'),s=b.querySelector('.job-sub'),f=b.querySelector('.job-fill');if(m&&m.textContent!==main&&b.__liquid)b.__liquid.slosh(0.6);if(m)m.textContent=main;if(s)s.textContent=sub;if(f&&pct!=null)f.style.width=pct+'%';if(b.__liquid&&pct!=null)b.__liquid.level(pct/100);b.setAttribute('aria-label',main+' · '+sub);};
 // The strip around the button tells what the committee is doing, one line at a time.
 var strip=function(b,head,line){var bar=b.closest('.rs-bar');if(!bar)return;var tx=bar.querySelector('.sa-tx');if(!tx)return;if(bar._tx==null)bar._tx=tx.innerHTML;var h=tx.querySelector('b'),sm=tx.querySelector('small');if(!sm){sm=document.createElement('small');tx.appendChild(sm);}if(h&&h.textContent!==head)h.textContent=head;if(sm.textContent!==line){sm.classList.add('swap');setTimeout(function(){sm.textContent=line;sm.classList.remove('swap');},160);}};
 var paintRun=function(){
  var gone=((Date.now()-(job.started||Date.now()))/1000),left=job.est-gone,at=Math.max(0,STEPS.map(function(x){return x[0];}).indexOf(job.stage));
  var pct=Math.max(4,Math.min(96,gone/job.est*100)),main=STEPS[at][1]+' 중 '+(at+1)+'/4',sub=left>1?mmss(left)+' 남음':'거의 다 됐어요 · '+mmss(gone)+' 지남';
  if(job.tick%4===0)job.fun++;job.tick++;
  var line=left>1?FUN[job.fun%FUN.length]:'예상보다 조금 더 걸리고 있어요. 꼼꼼히 쓰는 중이에요 🐢';
  targets().forEach(function(b){if(b.dataset.job!=='running')dress(b,'running',main,sub,pct);else text(b,main,sub,pct);strip(b,'위원회가 리포트를 쓰고 있어요',line);});
 };
 var run=function(){if(job.state!=='running'){job.state='running';job.tick=0;}clearInterval(job.iv);paintRun();job.iv=setInterval(paintRun,1000);};
 var finish=function(state){clearInterval(job.iv);job.iv=null;job.state=state;if(!state){var fl=floatEl(false);if(fl)fl.remove();}
  targets().forEach(function(b){reset(b);if(state==='done')dress(b,'done','리포트 보기','방금 완성됐어요');else if(state==='failed')dress(b,'failed','다시 요청하기','크레딧은 돌려드렸어요');});
 };
 var openDone=function(){if(job.symbol&&job.symbol===pageSymbol()){var t=document.querySelector('[aria-controls=tab-ai]');if(t){t.click();scrollTo({top:0,behavior:'smooth'});return;}}if(job.href)location.href=job.href;};
 var watch=function(id,show){
  if(timer)clearTimeout(timer);store(id);job.id=id;
  if(show){job.stage='queued';job.started=job.started||Date.now();run();}
  var poll=function(){G.call('GET','/reports/'+id).then(function(r){
   if(r.locked||r.error==='LOCKED'){finish('');locked(id,r);return;}
   if(r.error&&typeof r.error==='string'&&!r.status){if(r.error==='NOT_FOUND'||r.error==='FORBIDDEN'||r.error==='UNAUTHORIZED'){finish('');return;}timer=setTimeout(poll,5000);return;}
   if(r.symbol){job.symbol=r.symbol;job.name=r.name||r.symbol;}
   if(r.createdAt){var t=Date.parse(r.createdAt);if(Number.isFinite(t))job.started=t;}if(r.etaSec>0)job.est=r.etaSec;
   if(r.status==='done'){
    job.href=base+(String(r.symbol).indexOf('KRW-')===0?'coin.html?m=':'stock.html?c=')+encodeURIComponent(r.symbol)+'&job='+id+'#tab-ai';
    if(!r.fragments||!r.fragments.ai){finish('');if(G.toast)G.toast('완료된 리포트 본문을 불러오지 못했어요. 크레딧을 다시 쓰지 말고 새로고침하거나 문의해 주세요.','error');return;}
    // An older finished job (found on page load) is only painted; the buttons keep offering a new report.
    var was=job.state==='running';finish(was?'done':'');
    if(r.symbol===pageSymbol())paint(r);
    if(was&&G.toast)G.toast((job.name||'')+' 리포트가 완성됐어요');
    if(G.refresh)G.refresh();return;
   }
   if(r.status==='failed'){var ran=job.state==='running';finish(ran?'failed':'');if(ran&&G.toast)G.toast(r.error&&typeof r.error==='string'?r.error:'리포트를 만들지 못했어요. 크레딧은 돌려드렸어요.','error');if(ran&&G.refresh)G.refresh();return;}
   job.stage=STEPS.some(function(x){return x[0]===r.stage;})?r.stage:'working';run();
   timer=setTimeout(poll,1000);
  });};poll();
 };
 // Someone else's finished report (G-61): shown as a card that opens it once for credits, then it stays open.
 var locked=function(id,r){
  var panel=document.getElementById('tab-ai');if(!panel)return;
  var old=panel.querySelector('[data-job-lock]');if(old)old.remove();
  var cost=r.cost||10,bal=typeof r.balance==='number'?r.balance:(G.me&&G.me.credits),free=r.freeLeft>0,short=!free&&typeof bal==='number'&&bal<cost,label=free?'무료로 열기':cost+'크레딧으로 열기';
  var day=r.createdAt?new Date(Date.parse(r.createdAt)+9*3600000).toISOString().slice(0,10):'';
  var card=document.createElement('section');card.className='block';card.setAttribute('data-job-lock','');
  card.innerHTML='<div class="card locked"><div class="lk-head">🔒<b>다른 사용자가 만든 AI 위원회 리포트가 있어요</b></div><p>'+(day?esc(day)+'에 만든 리포트예요. ':'')+(free?'이번 달 무료로 열 수 있는 리포트가 '+esc(r.freeLeft)+'개 남았어요.':esc(cost)+'크레딧으로 한 번 열면 계속 볼 수 있어요.'+(typeof bal==='number'?' 남은 크레딧 '+esc(bal)+'.':''))+' 만든 날부터 7일이 지나면 무료예요.</p><p class="rj-err" hidden></p><div class="rj-actions"><button type="button" class="btn-primary" data-job-open'+(short?' disabled':'')+'>'+esc(label)+'</button>'+(short?'<a class="btn-ghost" href="'+(document.body.dataset.base||'')+'pricing.html">크레딧 충전</a>':'')+'</div></div>';
  var title=panel.querySelector('.panel-title');if(title)title.after(card);else panel.prepend(card);
  document.querySelectorAll('[data-report-state]').forEach(function(x){x.textContent='다른 사용자 리포트 · '+cost+'크레딧';});
  var go=card.querySelector('[data-job-open]'),err=card.querySelector('.rj-err');
  go.onclick=function(){go.disabled=true;go.textContent='여는 중';
   G.call('POST','/reports/'+id+'/unlock',{}).then(function(u){
    if(u.error){go.disabled=false;go.textContent=label;err.hidden=false;err.textContent=u.message||'열지 못했어요.';return;}
    card.remove();if(G.toast&&(u.free||u.charged))G.toast(u.free?'무료로 열었어요. 이번 달 '+(u.freeLeft||0)+'개 더 무료예요':u.charged+'크레딧을 사용했어요. 남은 크레딧 '+u.balance);if(G.refresh)G.refresh();watch(id,false);
   }).catch(function(){go.disabled=false;go.textContent=label;err.hidden=false;err.textContent='연결을 확인한 뒤 다시 눌러 주세요.';});
  };
 };
 // First press: the price on the button itself (and a way back); a second press within 8 seconds starts the job.
 G.startReport=function(kind,symbol,name,btn){
  if(!G.api){G.toast('AI 서버 연결이 필요해요.');return Promise.resolve(false);}
  if(!G.me){G.toast('로그인하면 리포트를 생성할 수 있어요.');return Promise.resolve(false);}
  if(job.state==='running'){G.toast('리포트를 만들고 있어요. 버튼에서 남은 시간을 볼 수 있어요.');return Promise.resolve(false);}
  var b=btn||targets()[0];if(!b)return Promise.resolve(false);
  var cost=(G.me.costs&&G.me.costs[kind])||${CREDIT_COST.report},bal=G.me.credits,after=typeof bal==='number'?bal-cost:null;
  job.symbol=symbol;job.name=name||symbol;
  return new Promise(function(done){
   reset(b);
   if(after!=null&&after<0){dress(b,'short','크레딧이 모자라요','충전하러 가기');b._cf=setTimeout(function(){reset(b);},6000);done(false);return;}
   dress(b,'confirm','한 번 더 누르면 시작',cost+'크레딧'+(after!=null?' · 남는 크레딧 '+after:''));
   var x=document.createElement('button');x.type='button';x.className='job-cancel';x.setAttribute('aria-label','취소');x.textContent='취소';b.after(x);
   x.onclick=function(){reset(b);done(false);};
   b._go=function(){clearTimeout(b._cf);x.remove();dress(b,'sending','접수하는 중','잠시만요',3);
    G.call('POST','/reports',{kind:kind,symbol:symbol}).then(function(r){
     if(r.error){reset(b);G.toast(r.message||'요청하지 못했어요.','error');done(false);return;}
     job.started=Date.now();job.stage='queued';job.floatClosed=false;watch(r.id,true);G.refresh();done(true);
    }).catch(function(){reset(b);G.toast('연결을 확인한 뒤 다시 눌러 주세요.','error');done(false);});
   };
   b._cf=setTimeout(function(){if(b.dataset.job==='confirm'){reset(b);done(false);}},8000);
  });
 };
 G.showReport=watch;
 document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-create-report],[data-job-float]');if(!b)return;
  var st=b.dataset.job;
  if(st==='confirm'&&b._go){b._go();return;}
  if(st==='running'||st==='sending'){var s=b.querySelector('.job-sub');G.toast('리포트를 만들고 있어요'+(s?' · '+s.textContent:''));return;}
  if(st==='done'){openDone();return;}
  if(st==='short'){location.href=base+'pricing.html#credits';return;}
  if(b.hasAttribute('data-job-float'))return;
  var symbol=pageSymbol()||b.dataset.symbol;G.startReport('report',symbol,b.dataset.name||symbol,b);});
 (G.ready||Promise.resolve()).then(function(){
  if(!G.me){document.querySelectorAll('[data-report-state]').forEach(function(x){x.textContent='로그인 후 AI 리포트 확인';});return;}var id=new URLSearchParams(location.search).get('job');
  if(id){watch(id,false);return;}
  var symbol=new URLSearchParams(location.search).get('c')||new URLSearchParams(location.search).get('m')||new URLSearchParams(location.search).get('s')||(document.querySelector('[data-symbol]')||{}).dataset?.symbol;
  if(symbol)G.call('GET','/reports/latest/'+encodeURIComponent(symbol)).then(function(r){if(r.job)watch(r.job.id,false);else document.querySelectorAll('[data-report-state]').forEach(function(x){x.textContent=r.error?'AI 리포트 조회 실패':'AI 리포트 없음';});});
  else{try{id=localStorage.getItem('gnm-report-job');}catch(e){}if(id)G.call('GET','/reports/'+id).then(function(r){if(['queued','running'].indexOf(r.status)>=0)watch(id,true);});}
 });
})();`;
