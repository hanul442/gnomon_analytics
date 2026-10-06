import { ORBS } from './ui.js';
export const JOBS_JS = `
(function(){
 var G=window.GNM;if(!G)return;
 var stage={queued:'작업을 시작하고 있어요',searching:'분석 자료를 확인하고 있어요',working:'근거와 시나리오를 분석하고 있어요',composing:'리포트를 작성하고 있어요'};
 var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
 var store=function(id){try{localStorage.setItem('gnm-report-job',id);}catch(e){}};
 var dialog=null, timer=null;
 var paint=function(r){
  Object.keys(r.fragments||{}).forEach(function(key){
   if(key==='scenarios'){var old=document.getElementById('chart-scenarios');if(old)old.outerHTML=r.fragments[key];return;}
   var panel=document.getElementById('tab-'+key);if(!panel)return;
   var composer=key==='ai'?panel.querySelector('.db-join'):null;if(composer)composer.remove();
   var target=panel.querySelector('[data-generated]');
   if(!target){target=document.createElement('section');target.setAttribute('data-generated',key);if(key==='ai'){var title=panel.querySelector('.panel-title');panel.innerHTML='';if(title)panel.appendChild(title);panel.appendChild(target);}else panel.prepend(target);}
   target.innerHTML=r.fragments[key];if(composer)(panel.querySelector('.card.debate')||target).appendChild(composer);
   panel.querySelectorAll('[data-missing]').forEach(function(x){x.remove();});
  });
  var join=document.querySelector('#tab-ai .join-wrap'), debate=document.querySelector('#tab-ai #debate .card.debate');if(join&&debate){debate.appendChild(join.querySelector('.db-join'));join.remove();}
  if(window.GNM_debateFilter)GNM_debateFilter();if(window.GNM_debate)GNM_debate();
 };
 var watch=function(id,show){
  if(timer)clearTimeout(timer);store(id);
  if(show){if(dialog)dialog.remove();dialog=document.createElement('dialog');dialog.className='v2-dialog';dialog.innerHTML='<header><b>AI 리포트 생성</b><button type="button" class="dialog-x" aria-label="닫기">×</button></header><div class="orbs-load">${ORBS}<span data-job-state>작업을 확인하고 있어요</span></div><p class="muted small">창을 닫아도 작업은 계속됩니다. 새로고침 후에도 확인할 수 있어요.</p>';document.body.appendChild(dialog);dialog.showModal();dialog.querySelector('button').onclick=function(){dialog.close();};}
  var poll=function(){G.call('GET','/reports/'+id).then(function(r){
   if(r.error&&typeof r.error==='string'&&!r.status){if(dialog)dialog.querySelector('[data-job-state]').textContent=r.message||'작업을 확인하지 못했어요';if(r.error==='NOT_FOUND'||r.error==='FORBIDDEN'||r.error==='UNAUTHORIZED')return;timer=setTimeout(poll,5000);return;}
   if(r.status==='done'){
    var current=new URLSearchParams(location.search).get('c')||new URLSearchParams(location.search).get('m')||(document.querySelector('[data-symbol]')||{}).dataset?.symbol;
    if(current===r.symbol)paint(r);
    var href=(document.body.dataset.base||'')+(r.symbol.indexOf('KRW-')===0?'coin.html?m=':'stock.html?c=')+encodeURIComponent(r.symbol)+'&job='+id+'#tab-ai';
    if(dialog)dialog.querySelector('.orbs-load').innerHTML='<b>리포트가 완성됐어요</b><span>데이터 기준 '+esc(r.dataDate||'확인 필요')+' · 생성 '+esc(r.generatedAt||'')+'</span><a class="btn-primary" href="'+href+'">리포트 보기</a>';
    if(G.refresh)G.refresh();return;
   }
   if(r.status==='failed'){if(dialog){dialog.querySelector('.orbs-load').innerHTML='<b>리포트를 만들지 못했어요</b><p>'+esc(r.error||'크레딧은 반환했어요. 다시 요청해 주세요.')+'</p><button type="+'"'+"button"+'"'+" class="+'"'+"btn-primary"+'"'+" data-retry-report>다시 요청</button>';dialog.querySelector('[data-retry-report]').onclick=function(){dialog.close();G.startReport(r.kind==='brief'?'brief':'report',r.symbol,r.symbol);};}if(G.refresh)G.refresh();return;}
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
  if(!G.me)return;var id=new URLSearchParams(location.search).get('job');
  if(id){watch(id,false);return;}
  var symbol=new URLSearchParams(location.search).get('c')||new URLSearchParams(location.search).get('m')||(document.querySelector('[data-symbol]')||{}).dataset?.symbol;
  if(symbol)G.call('GET','/reports/latest/'+encodeURIComponent(symbol)).then(function(r){if(r.job)watch(r.job.id,r.job.status!=='done');});
  else{try{id=localStorage.getItem('gnm-report-job');}catch(e){}if(id)G.call('GET','/reports/'+id).then(function(r){if(['queued','running'].indexOf(r.status)>=0)watch(id,true);});}
 });
})();`;
