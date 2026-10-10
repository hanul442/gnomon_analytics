// Chart v6 (docs/DESIGN.md §5.12, G-43): a day/week/month switch and a comparison line on top of the chart
// built by CHART_JS (which exposes window.GNMChart). Drawing tools live in chartDraw.ts (G-145).

/** Toolbar above the chart: timeframe, comparison and drawing tools. */
export function chartToolbar(hasBenchmark: boolean): string {
  return `<div class="v6-bar"><div class="seg tf" role="group" aria-label="봉 단위"><button type="button" data-tf="D" aria-pressed="true">일봉</button><button type="button" data-tf="W" aria-pressed="false">주봉</button><button type="button" data-tf="M" aria-pressed="false">월봉</button></div>
${hasBenchmark ? '<button type="button" class="chip-toggle" data-compare aria-pressed="false">지수와 겹쳐 보기</button>' : ''}</div>
<p class="draw-note muted small" id="draw-note" aria-live="polite"></p>`;
}

export const CHART_V6_CSS = `
.coin-tf{max-width:100%;overflow-x:auto;flex-wrap:nowrap;white-space:nowrap}.coin-tf button{flex:none}.dt:disabled{opacity:.4;cursor:not-allowed}
.v6-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:6px 0}
.draw-tools{display:flex;flex-wrap:wrap;gap:4px;margin-left:auto}
.dt{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line);background:var(--surface-solid);color:var(--fg);border-radius:8px;padding:5px 8px;font:inherit;font-size:12px;font-weight:600;color:var(--fg2);cursor:pointer;min-height:32px}
.dt svg{width:16px;height:16px}.dt:hover{border-color:var(--accent)}.dt[aria-pressed=true]{background:var(--navy);border-color:var(--navy);color:#fff}
.draw-note{min-height:18px;margin:0 0 4px}
.chart-card.drawing #chart{cursor:crosshair}.chart-card.tf-agg #vlines,.chart-card.tf-agg #ev-strip,.chart-card.tf-agg #mark-pop{visibility:hidden}
@media (max-width:820px){.draw-tools{margin-left:0;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none;width:100%}.dt span{display:none}.dt[data-draw-clear] span{display:inline}}
`;

/** Aggregate sorted, unique sessions; weekly buckets start on Monday. */
export function aggregateBars(bars:readonly {date:string;open:number;high:number;low:number;close:number;volume:number}[],unit:'W'|'M') {
 const out:{time:string;date:string;open:number;high:number;low:number;close:number;volume:number}[]=[];
 const sessions=[...new Map(bars.map(b=>[b.date,b])).values()].sort((a,b)=>a.date.localeCompare(b.date));
 for(const b of sessions){const d=new Date(b.date+'T00:00:00Z');const time=unit==='M'?b.date.slice(0,7)+'-01':new Date(d.getTime()-((d.getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);let cur=out.at(-1);if(!cur||cur.time!==time){cur={...b,time,date:time};out.push(cur);}else{cur.high=Math.max(cur.high,b.high);cur.low=Math.min(cur.low,b.low);cur.close=b.close;cur.volume+=b.volume;}}
 return out;
}

export const CHART_V6_JS = `
window.addEventListener('DOMContentLoaded', function () {
  var G = window.GNMChart; if (!G) return;
  var L = G.L, chart = G.chart, candle = G.candle, bars = G.bars;
  var card = document.getElementById('chart-card'), note = document.getElementById('draw-note');
  var say = function (t) { if (note) note.textContent = t; };

  // ---- day / week / month ----
  var tf = 'D', saved = [];
  var aggregate = function(k){return (${aggregateBars.toString()})(bars,k);};
  var setTf = function (k) {
    if (k === tf) return;
    if (window.GNM_draw) GNM_draw.cancel();
    document.querySelectorAll('[data-tf]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tf') === k)); });
    if(tf==='D'&&window.GNM_scenarioPause)GNM_scenarioPause(true);
    if (tf === 'D' && G.suspendAnalysis) G.suspendAnalysis(true);
    if (tf === 'D') saved = G.series().filter(function (s) { return s !== candle; }).map(function (s) { var v = s.options().visible !== false; var data=s.data().slice();s.setData([]);s.applyOptions({ visible: false }); return [s, v, data]; });
    if (k === 'D') {
      say('');
      candle.setData(bars.map(function (b) { return { time: b.date, open: b.open, high: b.high, low: b.low, close: b.close }; }));
      saved.forEach(function (x) { x[0].setData(x[2]);x[0].applyOptions({ visible: x[1] }); }); saved = [];if(G.suspendAnalysis)G.suspendAnalysis(false);if(G.showBars)G.showBars(bars); if (window.GNM_draw) GNM_draw.suspend(false); if(window.GNM_scenarioPause)GNM_scenarioPause(false);
      var r = document.querySelector('[data-range][aria-pressed=true]'); if (r) r.click();
    } else {
      var agg=aggregate(k);candle.setData(agg);if(G.showBars)G.showBars(agg);if (window.GNM_draw) GNM_draw.suspend(true); if(window.GNM_scenarioPause)GNM_scenarioPause(true); var selected=document.querySelector('[data-range][aria-pressed=true]'),n=selected?Number(selected.dataset.range):bars.length,cut=(${aggregateBars.toString()})([bars[Math.max(0,bars.length-n)]],k)[0].time,visible=agg.filter(function(b){return b.time>=cut;});if(visible.length<2)visible=agg.slice(-2);if(visible.length)chart.timeScale().setVisibleRange({from:visible[0].time,to:visible[visible.length-1].time});
      say(k === 'W' ? '주봉이에요. 지표·전략·그림은 일봉에서 보여요.' : '월봉이에요. 지표·전략·그림은 일봉에서 보여요.');
    }
    document.querySelectorAll('[data-range]').forEach(function (b) { b.disabled = k !== 'D'; });
    card.classList.toggle('tf-agg', k !== 'D');
    document.querySelectorAll('[data-ov],[data-pane],[data-vl],[data-sc],[data-strategy],[data-open="strat-sheet"],#ind-reset,[data-draw],[data-draw-clear],[data-compare]').forEach(function(b){b.disabled=k!=='D';});
    tf = k;
  };
  document.querySelectorAll('[data-tf]').forEach(function (b) { b.addEventListener('click', function () { setTf(b.getAttribute('data-tf')); }); });

  // ---- comparison with the index (both as % change from the first visible bar) ----
  var cmp = document.querySelector('[data-compare]'), lines = null;
  if (cmp) cmp.addEventListener('click', function () {
    var on = cmp.getAttribute('aria-pressed') !== 'true'; cmp.setAttribute('aria-pressed', String(on));
    if (!on) { if (lines) lines.forEach(function (s) { chart.removeSeries(s); }); lines = null; say(''); return; }
    var bm = (JSON.parse(document.getElementById('benchmarks').textContent) || [])[0]; if (!bm) return;
    var opts = { priceScaleId: 'cmp', lineWidth: 2, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false };
    var me = chart.addSeries(L.LineSeries, Object.assign({ color: '#d97706', title: '이 종목' }, opts)); me.setData(bars.map(function (b) { return { time: b.date, value: b.close }; }));
    var idx = chart.addSeries(L.LineSeries, Object.assign({ color: '#00968a', title: bm.name }, opts)); idx.setData(bm.series.map(function (x) { return { time: x[0], value: x[1] }; }));
    chart.priceScale('cmp').applyOptions({ mode: 2, visible: true, borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.25 } });
    chart.applyOptions({ leftPriceScale: { visible: false } });
    lines = [me, idx];
    say('주황은 이 종목, 청록은 ' + bm.name + '이에요. 화면 왼쪽 첫 봉 대비 등락률(%)로 겹쳐 보여요.');
  });
});
`;
