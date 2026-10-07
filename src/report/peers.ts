// 같은 테마 비교 (G-118): on a stock's summary tab, the other stocks of its themes side by side — today's
// move, the 20-session return and a 60-session line for each, in a strip that scrolls sideways (drag on
// desktop, swipe on phones) — and where this stock stands: its return against the theme's average and its
// PER against the theme's median. No imports, so any page module can include it.

/** Placeholder the script fills; hidden until a theme is found for the stock. */
export const peersSlot = (symbol: string): string => `<section class="block" id="peers" data-peers="${symbol.replace(/[^0-9A-Z-]/g, '')}" hidden></section>`;

export const PEERS_CSS = `#peers .pe-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}#peers .pe-head h2{margin:0;font-size:17px}.pe-themes{display:flex;gap:6px;overflow-x:auto;margin:8px 0 10px;scrollbar-width:none}.pe-themes::-webkit-scrollbar{display:none}.pe-themes button{flex:none;font:inherit;font-size:12.5px;font-weight:700;border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:5px 11px;cursor:pointer;white-space:nowrap}.pe-themes button[aria-pressed=true]{background:var(--navy);border-color:var(--navy);color:#fff}
.pe-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin:0 0 10px}.pe-sum div{background:#f6f8fb;border-radius:12px;padding:10px 12px;font-size:13.5px;line-height:1.5}.pe-sum b{font-size:15px}
.pe-strip{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 10px;cursor:grab;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}.pe-strip.drag{cursor:grabbing;scroll-snap-type:none;user-select:none}
.pe-card{flex:0 0 156px;scroll-snap-align:start;background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px 12px;text-decoration:none;color:inherit;display:block}.pe-card.me{border:2px solid var(--navy)}.pe-card b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pe-card small{color:var(--muted);font-size:11.5px}.pe-card svg{display:block;width:100%;height:38px;margin:6px 0 4px}.pe-row{display:flex;justify-content:space-between;font-size:12.5px;font-variant-numeric:tabular-nums}.pe-row span{color:var(--muted)}`;

export const PEERS_JS = `
(function(){
 var host=document.querySelector('[data-peers]');if(!host)return;
 var sym=host.getAttribute('data-peers')||new URLSearchParams(location.search).get('c')||'';if(!/^[0-9][0-9A-Z]{5}$/.test(sym))return;
 var base=document.body.getAttribute('data-base')||'',esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
 var pct=function(v){return v==null?'—':(v>0?'+':'')+v.toFixed(1)+'%';},tone=function(v){return v==null?'':v>0?'up':v<0?'down':'';};
 var spark=function(c,up){if(!c||c.length<2)return '';var lo=Math.min.apply(null,c),hi=Math.max.apply(null,c),sp=hi-lo||1;return '<svg viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="'+(up?'#d1373d':'#2a62c9')+'" stroke-width="1.6" points="'+c.map(function(v,i){return (i/(c.length-1)*120).toFixed(1)+','+(33-(v-lo)/sp*30).toFixed(1);}).join(' ')+'"/></svg>';};
 var median=function(xs){var a=xs.slice().sort(function(x,y){return x-y;});if(!a.length)return null;var m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
 var drag=function(el){var down=false,x0=0,s0=0,moved=false;el.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse')return;down=true;moved=false;x0=e.clientX;s0=el.scrollLeft;});el.addEventListener('pointermove',function(e){if(!down)return;var dx=e.clientX-x0;if(Math.abs(dx)>4){moved=true;el.classList.add('drag');}el.scrollLeft=s0-dx;});var up=function(){down=false;el.classList.remove('drag');};el.addEventListener('pointerup',up);el.addEventListener('pointerleave',up);el.addEventListener('click',function(e){if(moved){e.preventDefault();e.stopPropagation();moved=false;}},true);};
 fetch(base+'theme-index.json').then(function(r){return r.json();}).then(function(idx){
  var mine=(idx&&idx[sym])||[];if(!mine.length)return;
  host.hidden=false;
  host.innerHTML='<div class="card"><div class="pe-head"><h2>같은 테마 종목 비교</h2><a class="more-link" href="'+base+'themes.html#'+esc(mine[0][0])+'">테마 전체 ›</a></div><div class="pe-themes" role="group" aria-label="테마">'+mine.slice(0,6).map(function(t,i){return '<button type="button" data-no="'+esc(t[0])+'" aria-pressed="'+(i===0)+'">'+esc(t[1])+'</button>';}).join('')+'</div><div class="pe-sum"></div><div class="pe-strip" tabindex="0" aria-label="같은 테마 종목, 옆으로 넘겨 보세요"></div><p class="fine">20일 수익률과 PER을 같은 테마 종목과 비교해요. PER은 네이버 증권의 최근 값이고, 적자 종목(PER 없음)은 중간값에서 빼요.</p></div>';
  var strip=host.querySelector('.pe-strip'),sum=host.querySelector('.pe-sum');drag(strip);
  var load=function(no){
   sum.innerHTML='<div class="muted">불러오는 중…</div>';strip.innerHTML='';
   fetch(base+'theme/'+no+'.json').then(function(r){return r.json();}).then(function(t){
    var ms=(t.members||[]).slice().sort(function(a,b){return (a[0]===sym?-1:b[0]===sym?1:0)||((b[4]||0)-(a[4]||0));}).slice(0,16);
    var me=ms.filter(function(m){return m[0]===sym;})[0],rets=ms.filter(function(m){return m[3]!=null;}).map(function(m){return m[3];});
    var avg=rets.length?rets.reduce(function(a,b){return a+b;},0)/rets.length:null,rank=me&&me[3]!=null?rets.filter(function(x){return x>me[3];}).length+1:null;
    var line1=me&&me[3]!=null&&avg!=null?'<div>20일 수익률 <b class="'+tone(me[3])+'">'+pct(me[3])+'</b><br>테마 평균 '+pct(avg)+' · '+rets.length+'개 중 '+rank+'위</div>':'<div>20일 수익률을 비교할 가격 기록이 모자라요.</div>';
    sum.innerHTML=line1+'<div class="pe-per">PER 불러오는 중…</div>';
    strip.innerHTML=ms.map(function(m){return '<a class="pe-card'+(m[0]===sym?' me':'')+'" href="'+base+'stock.html?c='+encodeURIComponent(m[0])+'" data-sym="'+esc(m[0])+'"><b>'+esc(m[1])+'</b><small>'+esc(m[0])+(m[0]===sym?' · 이 종목':'')+'</small>'+spark(m[5],(m[2]||0)>=0)+'<div class="pe-row"><span>오늘</span><b class="'+tone(m[2])+'">'+pct(m[2])+'</b></div><div class="pe-row"><span>20일</span><b class="'+tone(m[3])+'">'+pct(m[3])+'</b></div><div class="pe-row"><span>PER</span><b data-per>—</b></div></a>';}).join('');
    var api=window.GNM&&GNM.api;if(!api){host.querySelector('.pe-per').textContent='PER은 API 연결 후 보여요.';return;}
    fetch(api+'/valuation?s='+ms.map(function(m){return m[0];}).join(',')).then(function(r){return r.json();}).then(function(v){
     var items=(v&&v.items)||{};strip.querySelectorAll('.pe-card').forEach(function(c){var x=items[c.getAttribute('data-sym')];c.querySelector('[data-per]').textContent=x&&x.per!=null?(x.per>0?x.per.toFixed(1)+'배':'적자'):'—';});
     var mp=items[sym]&&items[sym].per,peers=Object.keys(items).filter(function(k){return k!==sym&&items[k].per!=null&&items[k].per>0;}).map(function(k){return items[k].per;}),md=median(peers);
     host.querySelector('.pe-per').innerHTML=mp!=null&&mp>0&&md?'PER <b>'+mp.toFixed(1)+'배</b><br>같은 테마 중간값 '+md.toFixed(1)+'배보다 <b class="'+(mp>md?'up':'down')+'">'+Math.abs((mp/md-1)*100).toFixed(0)+'% '+(mp>md?'높아요':'낮아요')+'</b> ('+peers.length+'개 비교)':mp!=null&&mp<=0?'적자라 PER로 비교할 수 없어요.':'PER을 비교할 자료가 모자라요.';
    }).catch(function(){host.querySelector('.pe-per').textContent='PER을 불러오지 못했어요.';});
   }).catch(function(){sum.innerHTML='<div>이 테마 자료를 불러오지 못했어요.</div>';});
  };
  host.querySelectorAll('.pe-themes button').forEach(function(b){b.onclick=function(){host.querySelectorAll('.pe-themes button').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});load(b.getAttribute('data-no'));};});
  load(mine[0][0]);
 }).catch(function(){});
})();`;
