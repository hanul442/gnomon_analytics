/** Lightweight Charts uses numeric minute times and BusinessDay objects for daily series. */
export function formatCoinTime(t:unknown):string {
 let ms:number;
 if(typeof t==='number')ms=t*1000+9*3600000;
 else if(typeof t==='string')ms=Date.parse(t+'T00:00:00Z');
 else if(t&&typeof t==='object'&&'year' in t&&'month' in t&&'day' in t){const d=t as {year:number;month:number;day:number};ms=Date.UTC(d.year,d.month-1,d.day);}
 else return '';
 return Number.isFinite(ms)?new Date(ms).toISOString().slice(5,16).replace('T',' '):'';
}
/**
 * G-111: minute candles and ticks next to the daily chart, for coins (Upbit) and stocks/ETFs (Naver minute
 * closes, regular session). Ticks start from recent trades (coins) or today's minute closes (stocks), then
 * every live quote the page receives is added as it arrives.
 */
export const COIN_CHART_JS = `
(function(){
 var ticket=0, mounted=null,extra=null,line=null,saved=[],daily=null,live=null;
 var q=new URLSearchParams(location.search);
 var symbol=q.get('m')||q.get('c')||((document.querySelector('[data-symbol]')||{}).dataset||{}).symbol;
 if(!symbol||!/^(KRW-[A-Z0-9]{1,15}|[0-9][0-9A-Z]{5})$/.test(symbol))return;
 var COIN=symbol.indexOf('KRW-')===0;
 var ready=function(){
  var G=window.GNMChart;if(!G||mounted===G)return;mounted=G;daily=G.bars;
  var box=document.querySelector('.chart-card .chart-head')||document.querySelector('.v6-bar')||document.getElementById('chart').parentNode;
  var controls=document.createElement('div');controls.className='seg coin-tf';controls.setAttribute('role','group');controls.setAttribute('aria-label','봉 단위');var oldTf=document.querySelector('.seg.tf');if(oldTf){Array.from(oldTf.children).forEach(function(b){if(b.dataset.tf==='D')b.dataset.coinTf='D';controls.appendChild(b);});oldTf.remove();}else{controls.innerHTML='<button type="button" data-coin-tf="D" aria-pressed="true">일봉</button>';}controls.insertAdjacentHTML('beforeend',['1','5','15','60','T'].map(function(u){return '<button type="button" data-coin-tf="'+u+'" aria-pressed="false">'+(u==='T'?(COIN?'체결 틱':'실시간 가격'):u+'분')+'</button>';}).join(''));box.appendChild(controls);
  var note=document.createElement('p');note.className='fine';note.setAttribute('aria-live','polite');controls.after(note);
  var time=(${formatCoinTime.toString()});
  var stopLive=function(){if(live){window.removeEventListener('gnm-quote',live);live=null;}};
  var tools=function(disabled){document.querySelectorAll('[data-ov],[data-pane],[data-vl],[data-sc],[data-strategy],[data-open="strat-sheet"],#ind-reset,[data-draw],[data-draw-clear],[data-compare],[data-range]').forEach(function(b){b.disabled=disabled;});};
  var restore=function(){stopLive();tools(false);if(window.GNM_scenarioPause)GNM_scenarioPause(false);if(extra){G.chart.removeSeries(extra);extra=null;}if(line){G.chart.removeSeries(line);line=null;}saved.forEach(function(x){x[0].applyOptions({visible:x[1]});});saved=[];G.candle.applyOptions({visible:true});G.candle.setData(daily.map(function(b){return {time:b.date||b.time,open:b.open,high:b.high,low:b.low,close:b.close};}));G.chart.applyOptions({timeScale:{timeVisible:false,tickMarkFormatter:undefined},localization:{timeFormatter:undefined}});G.chart.timeScale().fitContent();};
  var hideDaily=function(){tools(true);if(window.GNM_scenarioPause)GNM_scenarioPause(true);if(!saved.length)saved=G.series().filter(function(s){return s!==G.candle;}).map(function(s){var visible=s.options().visible!==false;s.applyOptions({visible:false});return [s,visible];});G.chart.applyOptions({timeScale:{timeVisible:true,secondsVisible:false,tickMarkFormatter:time},localization:{timeFormatter:time}});};
  var press=function(b){controls.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});};
  controls.addEventListener('click',function(e){var b=e.target.closest('[data-coin-tf]');if(!b)return;var u=b.dataset.coinTf;if(u!=='D'){var day=controls.querySelector('[data-coin-tf="D"]');if(day&&day.getAttribute('aria-pressed')!=='true')day.click();}var id=++ticket;stopLive();
   if(u==='D'){restore();note.textContent=COIN?'일봉 · 매일 09:00 KST 기준':'일봉';press(b);return;}
   var api=window.GNM&&GNM.api;if(!api){note.textContent='분봉·틱은 API 연결 후 사용할 수 있어요.';return;}
   var layer=GNM_loading.begin(document.getElementById('chart'),(COIN?'업비트 ':'')+(u==='T'?'체결':u+'분봉')+'을 가져오고 있어요','searching');note.textContent='';
   fetch(api+(u==='T'?'/ticks/'+symbol:'/candles/'+symbol+'/'+u)).then(function(r){return r.json();}).then(function(r){if(id!==ticket)return;
    if(u==='T'){
     if(r.error||!r.points)throw Error(r.message||'틱 데이터가 없어요.');
     hideDaily();if(extra)extra.applyOptions({visible:false});G.candle.applyOptions({visible:false});
     if(!line)line=G.chart.addSeries(G.L.LineSeries,{color:'#1f3b67',lineWidth:2,priceLineVisible:true,lastValueVisible:true});
     var pts=r.points.map(function(p){return {time:p.time,value:p.price};}),last=pts.length?pts[pts.length-1].time:0;line.setData(pts);G.chart.timeScale().fitContent();
     // Every live quote this page receives becomes the next point (one per second at most).
     live=function(e){var d=e.detail;if(!d||d.symbol!==symbol||!(d.quote&&d.quote.price>0))return;var t=Math.floor(Date.now()/1000);if(t<=last)t=last+1;last=t;line.update({time:t,value:d.quote.price});};window.addEventListener('gnm-quote',live);
     press(b);note.textContent=(r.kind==='trades'?'업비트 최근 체결 '+pts.length+'개':'오늘 1분 종가 '+pts.length+'개')+' · 이후 실시간 가격을 이어 그려요'+(COIN?'':' (장중 약 10초마다)')+' · 일봉 지표·전략·그리기는 일봉에서 사용해요.';
     return;
    }
    if(r.error||!r.bars||!r.bars.length)throw Error(r.message||'분봉 데이터가 없어요.');
    hideDaily();if(line){G.chart.removeSeries(line);line=null;}G.candle.applyOptions({visible:true});
    G.candle.setData(r.bars.map(function(x){return {time:x.time,open:x.open,high:x.high,low:x.low,close:x.close};}));
    if(!extra){extra=G.chart.addSeries(G.L.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'coin-v',priceLineVisible:false,lastValueVisible:false});extra.priceScale().applyOptions({scaleMargins:{top:.82,bottom:0}});}
    extra.applyOptions({visible:true});extra.setData(r.bars.map(function(x){return {time:x.time,value:x.volume,color:x.close>=x.open?'#d1373d66':'#2a62c966'};}));
    G.chart.timeScale().setVisibleRange({from:r.bars[0].time,to:r.bars[r.bars.length-1].time});
    press(b);note.textContent=(COIN?'업비트 '+u+'분봉 · KST · 최근 ':'정규장 '+u+'분봉 · 1분 종가로 만든 봉 · 최근 ')+r.bars.length+'개 · 체결 없는 구간은 비어 있어요. 일봉 지표·전략·그리기는 일봉에서 사용해요.';
   }).catch(function(e){if(id===ticket)note.textContent=e.message||'연결을 확인해 주세요. 다시 선택하면 재시도합니다.';}).finally(function(){layer.end();});
  });
  // Daily/weekly/monthly and period controls leave minute mode before their normal handlers run.
  document.addEventListener('click',function(e){if(e.target.closest('[data-tf],[data-range]')){ticket++;if(saved.length||line)restore();note.textContent='일봉 데이터 기준';if(e.target.closest('[data-range]'))press(controls.querySelector('[data-coin-tf="D"]'));else controls.querySelectorAll('[data-coin-tf]').forEach(function(b){if(b.dataset.coinTf!=='D')b.setAttribute('aria-pressed','false');});}},true);
 };
 window.GNM_coinChartReady=ready;document.addEventListener('DOMContentLoaded',ready);ready();
})();`;
