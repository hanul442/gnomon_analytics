import { THINKING_ORB_JS } from './thinkingOrbBundle.js';
export const LOADING_CSS = `
.compact-input,.compact-heading,.compact-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.compact-heading{justify-content:space-between;margin-bottom:8px}.compact-input{flex-wrap:nowrap}.compact-input textarea{flex:1;min-width:0;resize:vertical}.compact-input .btn-primary{width:44px;min-width:44px;padding:8px;align-self:stretch}
.db-join{margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}.jn-input{align-items:flex-end!important}.jn-q textarea{margin:0!important;min-height:44px;max-height:120px;resize:vertical}.jn-send,.jn-plus{height:44px!important;width:44px!important;flex:none;border-radius:12px!important;cursor:pointer}.jn-send{background:var(--navy);color:#fff;border:0;font-size:20px}.jn-cost{display:block;font-size:11px;margin:5px 0 0 52px}.v2-dialog label:has([name^="custom-"]){display:grid;gap:5px;margin:10px 0}.v2-dialog input[name^="custom-"],.v2-dialog select{font:inherit;width:100%;padding:9px;border:1px solid var(--line);border-radius:10px}.custom-expert-row{display:flex;gap:6px;align-items:center}.custom-expert-row .ex{flex:1}.custom-expert-row button{background:none;border:0;padding:10px}
button,.btn-primary,.chip-toggle{line-height:1.35}.block-head{gap:8px;flex-wrap:wrap}.sc-actions,.pl-chips{gap:6px}.sc-actions button,.chip-toggle,.seg button{min-height:34px}.paper-link p,.cl-card>.card>.fine{display:none}.paper-link{gap:8px}.db-ask-link{font-size:18px}.db-full summary{cursor:pointer;font-size:13px;padding:10px 0;color:var(--accent-strong)}

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
 var delayedOrbs=function(){document.querySelectorAll('.orbs-load canvas:not([data-delayed]),.msg.wait canvas:not([data-delayed]),.db-typing canvas:not([data-delayed])').forEach(function(c){c.dataset.delayed='1';c.style.visibility='hidden';setTimeout(function(){if(c.isConnected)c.style.visibility='visible';},300);});};
 new MutationObserver(delayedOrbs).observe(document.body,{childList:true,subtree:true});delayedOrbs();
 var seq=0, network=0, badge=null, esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
 var delay=function(ms){return new Promise(function(r){setTimeout(r,Math.max(0,ms));});};
 var orb=function(state,size){return '<canvas data-orb="'+(state||'working')+'" data-size="'+(size||'64')+'" aria-hidden="true"></canvas>';};
 var begin=function(el,label,state){
  var layer=null,timer=null,id=++seq,ended=false;
  var show=function(){if(ended||!el)return;layer=document.createElement('div');layer.className='gnm-loading';layer.setAttribute('role','status');layer.innerHTML=orb(state,64)+'<span>'+esc(label||'불러오는 중이에요')+'</span>';el.classList.add('gnm-busy');el.setAttribute('aria-busy','true');el.dataset.loading=String(id);el.appendChild(layer);};
  timer=setTimeout(show,300);
  return {state:function(s,text){state=s;if(text)label=text;if(layer){layer.querySelector('canvas').dataset.orb=s;layer.querySelector('span').textContent=label;}},end:function(){ended=true;clearTimeout(timer);if(layer)layer.remove();if(el&&el.dataset.loading===String(id)){el.classList.remove('gnm-busy');el.removeAttribute('aria-busy');}return Promise.resolve();}};
 };
 window.GNM_loading={begin:begin,delay:delay,orb:orb,min:function(p){return Promise.resolve(p);}};
 var raw=window.fetch.bind(window),pending=new Set(),badgeTimer=null;
 var paint=function(){if(!pending.size||badge)return;badge=document.createElement('div');badge.className='gnm-network';badge.setAttribute('role','status');badge.innerHTML=orb('connecting',20)+'<span>불러오는 중이에요</span>';document.body.appendChild(badge);};
 window.fetch=function(input,init){
  var url=String(typeof input==='string'?input:input.url||input), background=/\\/(events|quotes|watchinfo|notifications\\/read)(?:[?\/]|$)/.test(url)||(init&&init.keepalive);
  if(background)return raw(input,init);
  var token={};pending.add(token);if(!badgeTimer&&!badge)badgeTimer=setTimeout(function(){badgeTimer=null;paint();},300);
  return raw(input,Object.assign({signal:AbortSignal.timeout(120000)},init||{})).finally(function(){pending.delete(token);if(!pending.size){clearTimeout(badgeTimer);badgeTimer=null;if(badge){badge.remove();badge=null;}}});
 };

})();`;
