/** Lightweight Charts uses numeric minute times and BusinessDay objects for daily series. */
export function formatCoinTime(t:unknown):string {
 let ms:number;
 if(typeof t==='number')ms=t*1000+9*3600000;
 else if(typeof t==='string')ms=Date.parse(t+'T00:00:00Z');
 else if(t&&typeof t==='object'&&'year' in t&&'month' in t&&'day' in t){const d=t as {year:number;month:number;day:number};ms=Date.UTC(d.year,d.month-1,d.day);}
 else return '';
 return Number.isFinite(ms)?new Date(ms).toISOString().slice(5,16).replace('T',' '):'';
}
export const COIN_CHART_JS = `
(function(){
 var ticket=0, mounted=null,extra=null,saved=[],daily=null;
 var symbol=new URLSearchParams(location.search).get('m')||((document.querySelector('[data-symbol^="KRW-"]')||{}).dataset||{}).symbol;
 if(!symbol||!/^KRW-[A-Z0-9]{1,15}$/.test(symbol))return;
 var ready=function(){
  var G=window.GNMChart;if(!G||mounted===G)return;mounted=G;daily=G.bars;
  var box=document.querySelector('.chart-card .chart-head')||document.querySelector('.v6-bar')||document.getElementById('chart').parentNode;
  var controls=document.createElement('div');controls.className='seg coin-tf';controls.setAttribute('role','group');controls.setAttribute('aria-label','코인 봉 단위');controls.innerHTML=['D','1','5','15','60'].map(function(u){return '<button type="button" data-coin-tf="'+u+'" aria-pressed="'+(u==='D')+'">'+(u==='D'?'일봉':u+'분봉')+'</button>';}).join('');box.appendChild(controls);
  var note=document.createElement('p');note.className='fine';note.setAttribute('aria-live','polite');controls.after(note);
  var restore=function(){if(extra){G.chart.removeSeries(extra);extra=null;}saved.forEach(function(x){x[0].applyOptions({visible:x[1]});});saved=[];G.candle.setData(daily.map(function(b){return {time:b.date||b.time,open:b.open,high:b.high,low:b.low,close:b.close};}));G.chart.applyOptions({timeScale:{timeVisible:false,tickMarkFormatter:undefined},localization:{timeFormatter:undefined}});G.chart.timeScale().fitContent();};
  controls.addEventListener('click',function(e){var b=e.target.closest('[data-coin-tf]');if(!b)return;var u=b.dataset.coinTf, id=++ticket;
   if(u==='D'){restore();note.textContent='일봉 · 매일 09:00 KST 기준';controls.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});return;}
   if(extra)extra.applyOptions({visible:false});var api=window.GNM&&GNM.api;if(!api){note.textContent='분봉은 API 연결 후 사용할 수 있어요.';return;}
   var layer=GNM_loading.begin(document.getElementById('chart'),'업비트 '+u+'분봉을 가져오고 있어요','searching');note.textContent='';
   fetch(api+'/candles/'+symbol+'/'+u).then(function(r){return r.json();}).then(function(r){if(id!==ticket)return;if(r.error||!r.bars?.length)throw Error(r.message||'분봉 데이터가 없어요.');
    if(!saved.length)saved=G.series().filter(function(s){return s!==G.candle;}).map(function(s){var visible=s.options().visible!==false;s.applyOptions({visible:false});return [s,visible];});
    if(extra)extra.applyOptions({visible:true});G.candle.setData(r.bars.map(function(x){return {time:x.time,open:x.open,high:x.high,low:x.low,close:x.close};}));
    if(!extra){extra=G.chart.addSeries(G.L.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'coin-v',priceLineVisible:false,lastValueVisible:false});extra.priceScale().applyOptions({scaleMargins:{top:.82,bottom:0}});}
    extra.setData(r.bars.map(function(x){return {time:x.time,value:x.volume,color:x.close>=x.open?'#d1373d66':'#2a62c966'};}));
    var time=(${formatCoinTime.toString()});
    G.chart.applyOptions({timeScale:{timeVisible:true,secondsVisible:false,tickMarkFormatter:time},localization:{timeFormatter:time}});G.chart.timeScale().setVisibleRange({from:r.bars[0].time,to:r.bars[r.bars.length-1].time});
    controls.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});note.textContent='업비트 '+u+'분봉 · KST · 최근 '+r.bars.length+'개 · 체결 없는 구간은 비어 있어요.';
   }).catch(function(e){if(id===ticket)note.textContent=e.message||'분봉 연결을 확인해 주세요. 다시 선택하면 재시도합니다.';}).finally(function(){layer.end();});
  });
  // Daily/weekly/monthly and period controls leave minute mode before their normal handlers run.
  document.addEventListener('click',function(e){if(e.target.closest('[data-tf],[data-range]')){ticket++;if(saved.length)restore();note.textContent='일봉 데이터 기준';controls.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x.dataset.coinTf==='D'));});}},true);
 };
 window.GNM_coinChartReady=ready;document.addEventListener('DOMContentLoaded',ready);ready();
})();`;
