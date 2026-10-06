/** Indicators already supported by the price chart. No new forecast data is generated. */
export function indicatorKey(label:string):string|null {
 if(/이동평균|SMA|EMA/i.test(label)){
  const n=label.match(/\d+/)?.[0];
  return /지수|EMA/i.test(label)?(n==='12'||n==='26'?'ema12':null):(['5','20','60','120'].includes(n??'')?'ma'+n:null);
 }
 const pairs:[RegExp,string][]=[[/피보나치|Fibonacci/i,'fib'],[/볼린저|Bollinger/i,'bb'],[/ATR/i,'atr'],[/RSI/i,'rsi'],[/MACD/i,'macd'],[/스토캐|Stoch/i,'stoch'],[/CCI/i,'cci'],[/윌리엄|Williams/i,'wr'],[/OBV/i,'obv'],[/VWAP/i,'vwap'],[/일목|Ichimoku/i,'ichimoku'],[/ADX/i,'adx'],[/MFI/i,'mfi'],[/엔벨로프/i,'env'],[/지지|저항/i,'levels'],[/이동평균|SMA/i,'ma20']];
 return pairs.find(([re])=>re.test(label))?.[1]??null;
}
export const INDICATOR_LINK_CSS=`.indicator-link{font:inherit;border:0;background:transparent;color:var(--accent-strong);cursor:pointer;text-align:left;padding:4px 0;min-height:36px;text-decoration:underline;text-underline-offset:3px}.facts .indicator-link{display:flex;flex-direction:column;gap:4px;width:100%}.indicator-link:focus-visible{outline:2px solid var(--navy);outline-offset:3px}.chart-context{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--bg2,#f3f6fa);border-radius:10px;padding:10px 12px;margin:0 0 12px;font-size:13px}.chart-context{scroll-margin-top:110px}.chart-context p{margin:0}.chart-context button{flex:none}.chart-context[hidden]{display:none}`;
export const INDICATOR_LINK_JS=`
document.addEventListener('click',function(e){
 var b=e.target.closest&&e.target.closest('[data-chart-indicator]');if(!b)return;
 var key=b.dataset.chartIndicator, opt=document.querySelector('[data-ov="'+key+'"],[data-pane="'+key+'"]'), tab=document.getElementById('t-chart');
 if(!opt||!window.GNMChart){if(window.GNM)GNM.toast('이 지표를 그릴 가격 기록이 부족해요.');return;}
 // Structure values are calculated from daily prices, so leave minute/weekly mode first.
 var day=document.querySelector('[data-coin-tf="D"]');if(day)day.click();day=document.querySelector('[data-tf="D"]');if(day)day.click();
 if(window.GNM_showTab)GNM_showTab('chart');else if(tab)tab.click();if(opt.getAttribute('aria-pressed')!=='true')opt.click();
 var ctx=document.getElementById('chart-context');if(ctx){ctx.hidden=false;var name=opt.querySelector('b');var desc=opt.querySelector('small');ctx.querySelector('p').textContent=(name?name.textContent:key)+' · '+(desc?desc.textContent:'일봉 가격을 기준으로 확인하세요.');var overlays=document.getElementById('overlays');if(overlays&&(key==='fib'||key==='levels')){try{var values=JSON.parse(overlays.textContent)||{};if(!(values[key]||[]).length)ctx.querySelector('p').textContent+=' · 확정된 가격 기준이 없어 아직 선을 표시할 수 없어요.';}catch(ignore){}}ctx.querySelector('button').onclick=function(){if(window.GNM_showTab)GNM_showTab('technical');else document.getElementById('t-technical').click();b.focus({preventScroll:true});b.scrollIntoView({block:'center',behavior:'auto'});};}
 requestAnimationFrame(function(){(ctx||document.getElementById('chart-card')).scrollIntoView({block:'start',behavior:'auto'});});
});`;
