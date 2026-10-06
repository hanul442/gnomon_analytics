import { THINKING_ORB_JS } from './thinkingOrbBundle.js';
export const LOADING_CSS = `
html,body{max-width:100%;overflow-x:clip}*,*::before,*::after{box-sizing:border-box}
main,.panel,.card,.home-main,.home-rail,.ms-card,.chat,.db-join{min-width:0;max-width:100%}
img,iframe,canvas{max-width:100%}.table-wrap{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain}
.gnm-busy{position:relative;min-height:110px}.gnm-loading{position:absolute;inset:0;z-index:55;background:rgba(255,255,255,.96);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;border-radius:inherit;color:var(--muted);font-size:14px;text-align:center;padding:16px;overflow:hidden}.gnm-loading canvas{width:64px;height:64px;flex:none}
#main.gnm-busy>.gnm-loading{position:fixed;inset:90px 0 64px;border-radius:0;justify-content:center;padding:16px!important}.gnm-network{position:fixed;right:16px;bottom:84px;z-index:160;max-width:calc(100% - 32px);display:flex;gap:8px;align-items:center;padding:10px 14px;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:0 4px 20px #14233a22;color:var(--fg2);font-size:13px}.gnm-network canvas{width:20px;height:20px;flex:none}
.v2-mask{position:relative;border:1px solid var(--line);border-radius:14px;overflow:hidden;min-height:190px;padding:20px;background:#fff}.v2-mask-shapes{filter:blur(7px);opacity:.5;pointer-events:none;user-select:none}.v2-mask-shapes i{display:block;height:14px;background:#b8c6db;border-radius:6px;margin:14px 0}.v2-mask-shapes i:nth-child(2){width:72%}.v2-mask-shapes i:nth-child(3){width:86%}.v2-mask-cta{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:9px;padding:20px;text-align:center}.v2-mask-cta p{margin:0;font-size:13px}.v2-mask-cta .btn-primary{width:auto}
.v2-dialog{border:0;border-radius:18px;width:min(540px,calc(100% - 28px));max-height:85dvh;padding:20px;overflow-y:auto;overscroll-behavior:contain;color:var(--fg)}.v2-dialog::backdrop{background:#14233a88}.v2-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px}.v2-dialog button{font:inherit;cursor:pointer}.v2-dialog .ex-grid{grid-template-columns:1fr;margin:12px 0}.v2-dialog textarea{width:100%;min-height:86px;font:inherit;padding:10px;border:1px solid var(--line);border-radius:10px}.v2-dialog .dialog-x{border:0;background:none;font-size:24px}.v2-dialog p{overflow-wrap:anywhere}
.jn-input{display:flex;gap:8px;align-items:center}.jn-input .jn-q{flex:1;min-width:0}.jn-plus{flex:none;width:36px;height:36px;border:1px solid var(--line);border-radius:50%;background:#eef3fb;color:var(--navy);font-size:24px;cursor:pointer}
@media(max-width:820px){.flt-sheet{width:100%!important;max-width:100%;height:90dvh!important}.flt-sheet iframe{width:100%;min-width:0}.chat{right:12px!important;left:12px!important;width:auto!important;max-width:calc(100% - 24px)!important}.chat textarea,.jn-q textarea{min-width:0;max-width:100%}.db-turn,.db-bubble{max-width:100%;overflow-wrap:anywhere}.ms-grid{grid-template-columns:minmax(0,1fr)!important}.ms-row{flex-wrap:wrap;gap:5px}.chips{max-width:100%;overscroll-behavior-x:contain}.v2-dialog{max-height:80dvh}.menu-open body,.chat-open body{overscroll-behavior:none}}
`;
export const LOADING_JS = THINKING_ORB_JS + `
(function(){
 var seq=0, network=0, badge=null, esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
 var delay=function(ms){return new Promise(function(r){setTimeout(r,Math.max(0,ms));});};
 var orb=function(state,size){return '<canvas data-orb="'+(state||'working')+'" data-size="'+(size||'64')+'" aria-hidden="true"></canvas>';};
 var begin=function(el,label,state){
  if(!el)return {end:function(){return delay(2000);}};
  var id=++seq, at=performance.now(), layer=document.createElement('div');layer.className='gnm-loading';layer.setAttribute('role','status');layer.style.justifyContent='flex-start';layer.style.paddingTop=Math.max(24,Math.min(Math.max(24,el.offsetHeight-130),innerHeight*.4-el.getBoundingClientRect().top))+'px';layer.innerHTML=orb(state,64)+'<span>'+esc(label||'불러오는 중이에요')+'</span>';
  el.classList.add('gnm-busy');el.setAttribute('aria-busy','true');el.dataset.loading=String(id);el.appendChild(layer);
  return {state:function(s,label){var c=layer.querySelector('canvas');if(c)c.dataset.orb=s;if(label)layer.querySelector('span').textContent=label;},end:function(){return delay(2000-(performance.now()-at)).then(function(){layer.remove();if(el.dataset.loading===String(id)){el.classList.remove('gnm-busy');el.removeAttribute('aria-busy');}});}};
 };
 window.GNM_loading={begin:begin,delay:delay,orb:orb,min:function(p){return Promise.all([Promise.resolve(p),delay(2000)]).then(function(a){return a[0];});}};
 var raw=window.fetch.bind(window);
 window.fetch=function(input,init){
  var url=String(typeof input==='string'?input:input.url||input), background=/\\/(events|quotes|watchinfo|notifications\\/read)(?:[?\/]|$)/.test(url)||(init&&init.keepalive);
  if(background)return raw(input,init);
  var at=performance.now();network++;
  if(!badge){badge=document.createElement('div');badge.className='gnm-network';badge.setAttribute('role','status');badge.innerHTML=orb('connecting',20)+'<span>불러오는 중이에요</span>';document.body.appendChild(badge);}
  return raw(input,Object.assign({signal:AbortSignal.timeout(120000)},init||{})).then(function(r){return delay(2000-(performance.now()-at)).then(function(){return r;});},function(e){return delay(2000-(performance.now()-at)).then(function(){throw e;});}).finally(function(){network--;if(!network&&badge){badge.remove();badge=null;}});
 };
 document.addEventListener('click',function(e){var chartButton=e.target.closest&&e.target.closest('[data-range],[data-period],[data-tf]');if(chartButton){var chart=document.getElementById('chart');if(chart){var loading=begin(chart,'차트를 준비하고 있어요','shaping');loading.end();}}var t=e.target.closest&&e.target.closest('[role=tab][aria-controls]');if(!t)return;var el=document.getElementById(t.getAttribute('aria-controls'));if(el){var b=begin(el,'화면을 준비하고 있어요','shaping');b.end();}},true);
 var main=document.getElementById('main');if(main){var boot=begin(main,'화면을 준비하고 있어요','shaping');boot.end();}
})();`;
