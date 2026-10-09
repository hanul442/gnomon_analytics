// G-139: the chart is no longer a tab. The 요약 mini chart (and every "차트에서 보기" link) opens the chart panel
// as a full-screen page with its own back button, and adds the tools a chart app is expected to have on top of
// the chart built by CHART_JS / the free chart page (window.GNMChart):
//   - chart type: 캔들 · 하이킨아시 · 바 · 라인 · 영역 · 기준선 (the candle series stays as an invisible anchor,
//     so drawings, indicators, strategy markers and the day/week/month switch keep working on every type);
//   - price axis: 가격 · 로그 · % ;
//   - period high/low marks for whatever range is on screen;
//   - magnet crosshair, save as an image, and landscape / browser full screen.
// Choices are remembered on this device.

export const CHART_PRO_CSS = `
.hc-range{margin:6px 0 0;max-width:520px;width:100%;display:flex}.hc-range button{flex:1}
html.chart-fs,html.chart-fs body{overflow:hidden}
/* G-146: the chart page never scrolls. Fixed on top: back, name and a small live price, then the settings rows;
   the chart takes all the height left; on phones the drawing tools are fixed at the bottom (a left bar on PCs). */
html.chart-fs #tab-chart{position:fixed;inset:0;z-index:75;background:#fff;display:flex;flex-direction:column;overflow:hidden;margin:0;padding:0 0 env(safe-area-inset-bottom);max-width:none;width:auto}
html.chart-fs #tab-chart>.panel-title{display:none}
html.chart-fs #tab-chart>.block{flex:1;min-height:0;display:flex;flex-direction:column;margin:0;padding:0;max-width:none}
html.chart-fs #tab-chart .chart-card{flex:1;min-height:0;display:flex;flex-direction:column;gap:4px;margin:0;border:0;border-radius:0;box-shadow:none;padding:6px 12px 0;max-width:none;overflow:hidden}
html.chart-fs #tab-chart .chart-card>*{order:8;flex:none}
html.chart-fs #tab-chart .chart-head{display:contents}html.chart-fs #tab-chart .chart-head>div:first-child{display:none}
html.chart-fs #tab-chart .chart-head>.seg{order:1}html.chart-fs #tab-chart .chart-head>.fine{order:2;margin:0}
html.chart-fs #tab-chart .pro-bar{order:2;margin:0}html.chart-fs #tab-chart .active-pills{order:3;margin:0}html.chart-fs #tab-chart .chart-context{order:3;margin:0}html.chart-fs #tab-chart .dw-hint{order:3;margin:0}
html.chart-fs #tab-chart .legend-line{order:4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;min-height:16px}html.chart-fs #tab-chart .draw-note{order:4;margin:0;min-height:0}
html.chart-fs #tab-chart .chart-wrap{order:5;flex:1;min-height:0;display:flex;flex-direction:column}
html.chart-fs #tab-chart .chart-body{flex:1;min-height:0}html.chart-fs #tab-chart #chart{height:100%!important}
html.chart-fs #tab-chart .chart-card>.fine,html.chart-fs #tab-chart .strat-info,html.chart-fs #tab-chart .v6-bar[hidden],html.chart-fs #tab-chart .chart-tools[hidden]{display:none}
html.chart-fs #tab-chart .chart-head>.seg,html.chart-fs #tab-chart .active-pills{display:flex;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;max-width:100%}html.chart-fs #tab-chart .active-pills>*{flex:none}
html.chart-fs .chat-fab,html.chart-fs .fb-row{display:none!important}html.chart-fs #tab-chart .chart-head>.fine:empty{display:none}
.cfs-head{display:none}
html.chart-fs .cfs-head{flex:none;display:flex;align-items:center;gap:6px;padding:calc(4px + env(safe-area-inset-top)) 12px 4px 4px;background:#fff;border-bottom:1px solid var(--line)}
.cfs-back{flex:none;width:44px;height:44px;display:grid;place-items:center;border:0;background:none;border-radius:12px;font-size:30px;line-height:1;color:var(--fg);cursor:pointer}.cfs-back:hover{background:#eef2f8}
.cfs-t{min-width:0;flex:1;display:flex;align-items:baseline;gap:8px;overflow:hidden;white-space:nowrap}.cfs-t b{font-size:16px;overflow:hidden;text-overflow:ellipsis}.cfs-px{font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}.cfs-px small{font-size:12px;margin-left:4px}
.cfs-hint{font-size:12.5px;color:var(--muted);white-space:nowrap}
.pro-bar{display:flex;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;align-items:center;gap:6px;margin:2px 0 8px}.pro-bar::-webkit-scrollbar{display:none}.pro-bar>*{flex:none}
.pro-bar .seg button{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.pro-bar svg{width:18px;height:18px;flex:none}
.pb-sel{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line);border-radius:12px;padding:0 4px 0 8px;background:#fff;min-height:40px}.pb-sel select{font:inherit;font-size:13.5px;font-weight:700;border:0;background:transparent;padding:8px 2px;color:var(--fg)}
.pb-ic{display:inline-flex;align-items:center;gap:5px;min-height:40px;min-width:40px;justify-content:center;border:1px solid var(--line);border-radius:12px;background:#fff;font:inherit;font-size:13px;font-weight:700;color:var(--fg2);cursor:pointer;padding:0 10px;white-space:nowrap}.pb-ic[aria-pressed=true]{background:var(--accent-soft);border-color:#b9cbf3;color:var(--accent-strong)}.pb-ic:hover{border-color:var(--accent)}
.pro-bar .chip-toggle{white-space:nowrap}
#tab-chart:fullscreen{background:#fff}
@media (max-width:820px){.pb-ic span{display:none}.pb-ic{padding:0}html.chart-fs #tab-chart .active-pills{display:none}.cfs-hint{display:none}
 html.chart-fs #tab-chart .chart-card{padding:4px 10px 0}html.chart-fs #tab-chart .chart-wrap>.chart-body{order:1}html.chart-fs #tab-chart .chart-wrap>.dw-tools{order:2;margin:4px 0 0}
 html.chart-fs #tab-chart .chart-wrap>.dw{order:3;border-top:1px solid var(--line);margin:0 -10px;padding:2px 6px calc(2px + env(safe-area-inset-bottom));background:#fff}}
/* G-156: Toss-style chart page — header (back · name over price · landscape · settings), the chart, and one bar at
   the bottom (봉 단위 · 차트 모양 · 그리기). Settings open as a page with 상단 지표 / 하단 지표 / 설정 tabs. */
html.chart-fs .cfs-head{gap:2px;padding:calc(4px + env(safe-area-inset-top)) 4px 2px;border-bottom:0}
.cfs-t{flex-direction:column;align-items:center;justify-content:center;gap:0;text-align:center}
.cfs-t b{font-size:13px;font-weight:600;color:var(--muted);max-width:100%;line-height:1.3}
.cfs-px{font-size:16px;font-weight:800;line-height:1.35}.cfs-px.up{color:var(--up)}.cfs-px.down{color:var(--down)}.cfs-px small{font-size:15px;margin-left:6px}
.cfs-back svg{width:26px;height:26px}
.cfs-ic{flex:none;width:44px;height:44px;display:grid;place-items:center;border:0;background:none;border-radius:12px;color:#8b95a1;cursor:pointer}.cfs-ic svg{width:25px;height:25px}.cfs-ic:hover,.cfs-fb:hover{background:#eef2f8}
.cfs-foot{display:none}
html.chart-fs .cfs-foot{flex:none;display:flex;align-items:center;gap:2px;padding:6px 8px calc(6px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid var(--line);position:relative}
html.chart-fs .cfs-foot>.seg{flex:1;min-width:0;display:flex;flex-wrap:nowrap;gap:2px;background:none;border:0;padding:0;margin:0;overflow:visible;box-shadow:none}
html.chart-fs .cfs-foot>.seg>button{flex:1;min-width:0;min-height:44px;border:0;border-radius:12px;background:none;box-shadow:none;font-size:16px;font-weight:600;color:#6b7684;padding:0 4px;white-space:nowrap}
html.chart-fs .cfs-foot>.seg>button[aria-pressed=true]{background:#f2f4f6;color:var(--fg);font-weight:800}
html.chart-fs .cfs-foot>.seg>button:disabled{opacity:.35}
html.chart-fs .cfs-foot [data-minute-menu]::after{content:"";display:inline-block;width:6px;height:6px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:rotate(45deg);margin:0 0 4px 6px}
html.chart-fs .cfs-foot .minute-options{position:absolute;left:8px;bottom:calc(100% + 6px);margin:0;z-index:6;background:#fff;box-shadow:0 8px 24px rgba(15,34,68,.16)}
.cfs-fb{flex:none;width:46px;height:46px;display:grid;place-items:center;border:0;background:none;border-radius:12px;cursor:pointer;color:#8b95a1}.cfs-fb svg{width:26px;height:26px}
.cfs-fb[data-ct-open]{color:#f04452}
.ct-pop{position:fixed;inset:0;z-index:90;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.28)}.ct-pop[hidden]{display:none}
.ct-body{width:min(560px,100%);background:#fff;border-radius:24px 24px 0 0;padding:10px 20px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(0,0,0,.12)}
.ct-grab{width:40px;height:5px;border-radius:3px;background:#e5e8eb;margin:0 auto 14px}
.ct-body h3{margin:0 0 16px;font-size:20px;font-weight:800}
.ct-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.ct-grid button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:84px;border:2px solid transparent;border-radius:18px;background:#f2f4f6;font:inherit;font-size:13px;font-weight:600;color:#4e5968;cursor:pointer;padding:8px 4px}
.ct-grid button svg{width:28px;height:28px;color:#f04452}.ct-grid button[aria-pressed=true]{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-strong)}
#ind-sheet.st-page .sheet-body{padding:0 0 calc(84px + env(safe-area-inset-bottom))!important}
#ind-sheet.st-page .sheet-head{position:sticky;top:0;margin:0!important;padding:6px 8px!important;border:0!important;display:flex;align-items:center;gap:4px;background:#fff;z-index:3}
#ind-sheet.st-page .sheet-head>b{flex:1;font-size:16px}
#ind-sheet.st-page .sheet-done{display:none}
.st-x{width:44px;height:44px;display:grid;place-items:center;border:0;background:none;border-radius:12px;cursor:pointer;color:var(--fg)}.st-x svg{width:26px;height:26px}
.st-reset{border:0;background:none;font:inherit;font-size:16px;font-weight:600;color:#333d4b;padding:10px 12px;border-radius:10px;cursor:pointer;min-height:44px}.st-reset:hover{background:#f2f4f6}
.st-tabs{position:sticky;top:56px;z-index:2;display:flex;gap:28px;padding:0 20px;background:#fff;border-bottom:1px solid #f2f4f6}
.st-tabs button{border:0;background:none;font:inherit;font-size:18px;font-weight:700;color:#8b95a1;padding:14px 2px 12px;border-bottom:3px solid transparent;cursor:pointer;min-height:48px}.st-tabs button[aria-selected=true]{color:#191f28;border-bottom-color:#191f28}
.st-pane{padding:4px 20px}.st-pane[hidden]{display:none}
#ind-sheet.st-page .st-pane .opt-group{margin:0}#ind-sheet.st-page .st-pane:not(.st-more) .opt-k{display:none}
#ind-sheet.st-page .opt{border-top:0;padding:16px 0;gap:16px}#ind-sheet.st-page .opt:hover{background:none}
#ind-sheet.st-page .opt-t b{font-size:18px;font-weight:700;color:#191f28}#ind-sheet.st-page .opt-t small{font-size:14.5px;color:#8b95a1;line-height:1.45;margin-top:2px}
#ind-sheet.st-page .tog{width:52px;height:32px;border-radius:16px;background:#e5e8eb}#ind-sheet.st-page .tog::after{top:4px;left:4px;width:24px;height:24px}
#ind-sheet.st-page .opt[aria-pressed=true] .tog{background:var(--accent)}#ind-sheet.st-page .opt[aria-pressed=true] .tog::after{transform:translateX(20px)}
#ind-sheet.st-page .opt-k{font-size:14px;font-weight:700;color:#8b95a1;margin:18px 0 2px}
#ind-sheet.st-page .pro-bar{flex-direction:column;align-items:stretch;overflow:visible;gap:0;margin:0}
#ind-sheet.st-page .pro-bar>*{width:100%}
#ind-sheet.st-page .pro-bar .pb-ic,#ind-sheet.st-page .pro-bar .chip-toggle,#ind-sheet.st-page .pro-bar .strat-pick,#ind-sheet.st-page .pro-bar .tool-btn{display:flex;justify-content:flex-start;gap:12px;min-height:56px;border:0;border-radius:0;background:none;padding:0;font-size:17px;font-weight:600;color:#191f28;text-align:left}
#ind-sheet.st-page .pro-bar .pb-ic span{display:inline!important}#ind-sheet.st-page .pro-bar .pb-ic svg{width:22px;height:22px;color:#8b95a1}
#ind-sheet.st-page .pro-bar .pb-ic[aria-pressed]::after{content:"";margin-left:auto;width:52px;height:32px;border-radius:16px;background:#e5e8eb center/24px no-repeat}
#ind-sheet.st-page .pro-bar .pb-ic[aria-pressed=true]::after{background:var(--accent)}
#ind-sheet.st-page .pro-bar .pb-ic[aria-pressed]{position:relative}#ind-sheet.st-page .pro-bar .pb-ic[aria-pressed]::before{content:"";position:absolute;right:24px;top:50%;width:24px;height:24px;margin-top:-12px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);z-index:1;transition:transform .15s}
#ind-sheet.st-page .pro-bar .pb-ic[aria-pressed=true]::before{transform:translateX(20px)}
#ind-sheet.st-page .pro-bar .pb-scale{display:flex;margin:6px 0 10px;background:#f2f4f6;border-radius:12px;padding:3px;border:0}#ind-sheet.st-page .pro-bar .pb-scale button{flex:1;min-height:40px}
#ind-sheet.st-page .pro-bar [data-open="ind-sheet"],#ind-sheet.st-page .pro-bar #ind-reset{display:none}
.st-more-link{display:flex;align-items:center;border:0;background:none;font:inherit;font-size:15px;font-weight:600;color:var(--accent);padding:0 0 12px;margin-top:-12px;cursor:pointer;min-height:32px}
#ind-sheet.st-page .opt[aria-pressed=false]+.st-more-link{display:none}
#ind-sheet.dp-open .sheet-body>*:not(.st-dp){display:none!important}.st-dp[hidden]{display:none}
.st-dp-head{display:flex;align-items:center;gap:4px;padding:6px 8px;position:sticky;top:0;background:#fff;z-index:2}.st-dp-head b{flex:1;font-size:17px}
.st-dp-body{padding:4px 20px}
.st-f{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0;border-bottom:1px solid #f2f4f6;font-size:17px;font-weight:600;color:#191f28}
.st-step{display:inline-flex;align-items:center;background:#f2f4f6;border-radius:12px;flex:none}
.st-step button{width:44px;height:44px;border:0;background:none;font:inherit;font-size:22px;color:#4e5968;cursor:pointer;border-radius:12px}.st-step button:hover{background:#e5e8eb}
.st-step input{width:64px;height:44px;border:0;background:none;text-align:center;font:inherit;font-size:17px;font-weight:700;color:#191f28;-moz-appearance:textfield;appearance:textfield}
.st-step input::-webkit-inner-spin-button,.st-step input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.st-dp-note{font-size:14px;color:#8b95a1;line-height:1.55;margin:14px 0 0}
.st-save{position:fixed;left:16px;right:16px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:4;min-height:56px;border:0;border-radius:16px;background:var(--accent);color:#fff;font:inherit;font-size:18px;font-weight:700;cursor:pointer;max-width:560px;margin:0 auto}
@media (max-width:820px){html.chart-fs #tab-chart .chart-head>.seg{display:none}
 html.chart-fs #tab-chart .chart-wrap>.dw{display:none}html.chart-fs.chart-draw #tab-chart .chart-wrap>.dw{display:flex}html.chart-fs.chart-draw .cfs-foot{display:none}
 html.chart-fs #tab-chart .chart-wrap>.dw .dw-b span{display:block}html.chart-fs #tab-chart .chart-wrap>.dw>.dw-b{min-width:56px}
 .dw .dw-x{position:sticky;right:-6px;z-index:2;background:#fff!important;box-shadow:-8px 0 10px #fff}}
@media (min-width:821px){.cfs-foot [data-draw-open],.dw-x{display:none!important}html.chart-fs .cfs-foot{padding-left:70px}html.chart-fs .cfs-foot>.seg{flex:0 1 460px;margin-right:auto}}
@media (orientation:landscape) and (max-height:500px){html.chart-fs #tab-chart .chart-head>.seg,html.chart-fs #tab-chart .legend-line{display:none}html.chart-fs .cfs-head{padding-top:2px;padding-bottom:2px}}
`;

const ICONS: Record<string, string> = {
  candle: '<path d="M7 3v4M7 17v4M17 3v6M17 15v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="4.5" y="7" width="5" height="10" rx="1" fill="currentColor"/><rect x="14.5" y="9" width="5" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  ha: '<path d="M7 4v16M17 4v16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><rect x="4.5" y="9" width="5" height="8" rx="1" fill="currentColor"/><rect x="14.5" y="6" width="5" height="8" rx="1" fill="currentColor" opacity=".55"/>',
  bar: '<path d="M8 4v16M5 8h3M8 15h3M16 6v14M13 10h3M16 17h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  line: '<path d="M3 17l5-6 4 3 4-7 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  area: '<path d="M3 17l5-6 4 3 4-7 5 5v8H3z" fill="currentColor" opacity=".25"/><path d="M3 17l5-6 4 3 4-7 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  hollow: '<path d="M7 3v4M7 17v4M17 3v6M17 15v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="4.5" y="7" width="5" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="14.5" y="9" width="5" height="6" rx="1" fill="currentColor"/>',
  base: '<path d="M3 12h18" stroke="currentColor" stroke-width="1.4" stroke-dasharray="3 2"/><path d="M3 15l4-5 4 4 4-8 6 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};
const TYPES: readonly [string, string][] = [['bar', '바'], ['candle', '캔들'], ['line', '라인'], ['area', '영역'], ['ha', '하이킨아시'], ['hollow', '투명캔들'], ['base', '베이스라인']];

const PB = (k: string, label: string, icon: string, extra = '') => `<button type="button" class="pb-ic" ${k} title="${label}" aria-label="${label}"${extra}><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${label}</span></button>`;
const PL = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
export const CHART_PRO_BAR = `<div class="pro-bar" role="toolbar" aria-label="차트 보기 도구"><div class="seg pb-scale" role="group" aria-label="가격 축"><button type="button" data-scale="0" aria-pressed="true">가격</button><button type="button" data-scale="1" aria-pressed="false" title="로그 눈금: 오래 오른 종목을 비율로 봐요">로그</button><button type="button" data-scale="2" aria-pressed="false" title="화면 왼쪽 첫 봉 대비 %">%</button></div>
${PB('data-hilo', '최고·최저', `<path ${PL} d="M12 3v6M9 6l3-3 3 3M12 21v-6M9 18l3 3 3-3M4 12h16"/>`, ' aria-pressed="true"')}${PB('data-magnet', '자석 십자선', `<path ${PL} d="M6 4v8a6 6 0 0012 0V4M6 8h4M14 8h4"/>`, ' aria-pressed="false"')}${PB('data-shot', '사진 저장', `<path ${PL} d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5" ${PL}/>`)}</div>`;
const SVG = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
/** G-157: what 상세 설정하기 can change per indicator — [field, label, min, max, step]. Defaults live in CHART_JS (IP0). */
export const IND_FIELDS: Record<string, [string, string, number, number, number][]> = {
  ma5: [['n', '기간(일)', 2, 240, 1]], ma20: [['n', '기간(일)', 2, 240, 1]], ma60: [['n', '기간(일)', 2, 240, 1]], ma120: [['n', '기간(일)', 2, 240, 1]],
  ema12: [['f', '짧은 기간', 2, 100, 1], ['s', '긴 기간', 3, 200, 1]],
  bb: [['n', '기간', 5, 120, 1], ['k', '표준편차 배수', 0.5, 5, 0.5]],
  env: [['n', '기간', 5, 120, 1], ['pct', '폭(%)', 1, 30, 1]],
  ichimoku: [['conv', '전환선 기간', 2, 60, 1], ['base', '기준선 기간', 5, 120, 1], ['span', '선행스팬2 기간', 10, 240, 1]],
  rsi: [['n', '기간', 2, 60, 1], ['hi', '과열 기준', 50, 95, 1], ['lo', '침체 기준', 5, 50, 1]],
  macd: [['f', '짧은 기간', 2, 60, 1], ['s', '긴 기간', 5, 120, 1], ['sig', '시그널 기간', 2, 60, 1]],
  stoch: [['n', '기간', 5, 60, 1], ['k', '%K 평활', 1, 10, 1], ['d', '%D 평활', 1, 10, 1]],
  cci: [['n', '기간', 5, 100, 1]], wr: [['n', '기간', 5, 60, 1]], atr: [['n', '기간', 2, 60, 1]], value: [['n', '평균선 기간', 5, 120, 1]],
};
/** Header and bottom bar of the full-screen chart (G-156). */
export const CHART_PRO_PARTS = {
  back: SVG(`<path ${PL} d="M20 12H5M11 5l-7 7 7 7"/>`),
  land: SVG(`<rect x="7" y="3" width="10" height="17" rx="2" fill="currentColor" opacity=".55"/><path ${PL} d="M15 3.5c3 .5 5 2.6 5.5 5.5M18.5 7.5l2 1.6 1.4-2.2"/>`),
  gear: SVG(`<path fill="currentColor" d="M13.9 2.5l.5 2.4c.6.2 1.2.5 1.7.9l2.3-.8 1.9 3.3-1.8 1.6c.1.6.1 1.3 0 1.9l1.8 1.6-1.9 3.3-2.3-.8c-.5.4-1.1.7-1.7.9l-.5 2.4h-3.8l-.5-2.4c-.6-.2-1.2-.5-1.7-.9l-2.3.8-1.9-3.3 1.8-1.6a6 6 0 010-1.9L3.7 8.3l1.9-3.3 2.3.8c.5-.4 1.1-.7 1.7-.9l.5-2.4zM12 8.6a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8z"/>`),
  pen: SVG(`<path ${PL} d="M4 20L20 4"/><circle cx="4.5" cy="19.5" r="2" fill="currentColor"/><circle cx="19.5" cy="4.5" r="2" fill="currentColor"/>`),
  close: SVG(`<path ${PL} d="M6 6l12 12M18 6L6 18"/>`),
  types: TYPES,
  icons: ICONS,
};

/** G-141: period chips under the 요약 mini chart, Toss-style; the chart itself still opens the full-screen one. */
export const HERO_RANGE_JS = `
(function () {
  var won = function (v) { if (document.documentElement.getAttribute('data-ccy') === 'USD') return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: 4 })) + '원'; };
  var P = [['1주', 5], ['1달', 21], ['3달', 63], ['6달', 126], ['1년', 250]], n0 = 63;
  try { n0 = Number(localStorage.getItem('gnm-hero-range')) || 63; } catch (e) {}
  var draw = function (a, n) {
    var all = []; try { all = JSON.parse(a.getAttribute('data-c') || '[]'); } catch (e) {}
    var c = all.slice(-n); if (c.length < 3) return;
    var lo = Math.min.apply(null, c), hi = Math.max.apply(null, c), sp = hi - lo || 1, w = 320, h = 72;
    var pts = c.map(function (v, i) { return (i / (c.length - 1) * w).toFixed(1) + ',' + (h - 4 - (v - lo) / sp * (h - 10)).toFixed(1); }).join(' ');
    var g = (c[c.length - 1] / c[0] - 1) * 100, col = g >= 0 ? '#f04452' : '#3182f6', id = 'hcg' + Math.random().toString(36).slice(2, 7);
    var label = (P.filter(function (p) { return p[1] === n; })[0] || ['', 0])[0];
    a.querySelector('svg').innerHTML = '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".22"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs><polygon points="0,' + h + ' ' + pts + ' ' + w + ',' + h + '" fill="url(#' + id + ')"/><polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>';
    var meta = a.querySelector('.hc-meta > span'); if (meta) meta.innerHTML = label + ' <b class="' + (g > 0 ? 'up' : g < 0 ? 'down' : '') + '">' + (g > 0 ? '▲ +' : g < 0 ? '▼ ' : '') + g.toFixed(1) + '%</b> · 최고 ' + won(hi) + ' · 최저 ' + won(lo);
    a.setAttribute('aria-label', '최근 ' + label + ' 차트, 눌러서 전체 화면 차트 열기');
  };
  window.GNM_heroRange = function (a) {
    if (!a || a.nextElementSibling && a.nextElementSibling.classList.contains('hc-range')) return;
    var len = 0; try { len = JSON.parse(a.getAttribute('data-c') || '[]').length; } catch (e) {}
    var ps = P.filter(function (p) { return len >= Math.min(p[1], 5) && (p[1] <= len || p[1] - len < p[1] * 0.2); }); if (ps.length < 2) return;
    var n = ps.some(function (p) { return p[1] === n0; }) ? n0 : 63;
    var box = document.createElement('div'); box.className = 'seg hc-range'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', '미니 차트 기간');
    box.innerHTML = ps.map(function (p) { return '<button type="button" data-hc="' + p[1] + '" aria-pressed="' + (p[1] === n) + '">' + p[0] + '</button>'; }).join('');
    a.insertAdjacentElement('afterend', box);
    box.addEventListener('click', function (e) { var b = e.target.closest('[data-hc]'); if (!b) return; var k = Number(b.getAttribute('data-hc')); box.querySelectorAll('[data-hc]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); try { localStorage.setItem('gnm-hero-range', String(k)); } catch (x) {} draw(a, k); });
    if (n !== 63) draw(a, n);
  };
  var boot = function () { document.querySelectorAll('.hero-chart[data-c]').forEach(window.GNM_heroRange); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
`;

export const CHART_PRO_JS = `
(function () {
  var panel = document.getElementById('tab-chart'); if (!panel) return;
  var root = document.documentElement, UP = '#f04452', DOWN = '#3182f6', NAVY = '#2e4268', T = 'rgba(0,0,0,0)';
  var ICON_CT = ${JSON.stringify(ICONS)}, P = ${JSON.stringify(CHART_PRO_PARTS)}, FIELDS = ${JSON.stringify(IND_FIELDS)};
  var svg = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; };
  var PREF = 'gnm-chart-pro', pref = { ct: 'candle', scale: 0, hilo: true, magnet: false };
  try { var sp = JSON.parse(localStorage.getItem(PREF) || 'null'); if (sp) for (var k in sp) pref[k] = sp[k]; } catch (e) {}
  if (!ICON_CT[pref.ct]) pref.ct = 'candle';
  var keep = function () { try { localStorage.setItem(PREF, JSON.stringify(pref)); } catch (e) {} };
  var toast = function (t) { if (window.GNM && GNM.toast) GNM.toast(t); };
  var mobile = window.matchMedia('(max-width: 820px)').matches;

  // ---- full-screen page: header with a back button, opened instead of a tab ----
  var title = (document.querySelector('.hero h1') || {}).textContent || document.title.split('|')[0];
  var head = document.createElement('div'); head.className = 'cfs-head';
  head.innerHTML = '<button type="button" class="cfs-back" aria-label="차트 닫기">' + P.back + '</button><div class="cfs-t"><b></b><span class="cfs-px"><span data-live-f="price"></span><small data-live-f="arrowpct"></small></span></div><span class="cfs-hint">Esc로 닫기</span><button type="button" class="cfs-ic" data-land>' + P.land + '</button><button type="button" class="cfs-ic" data-cfs-set aria-label="차트 설정" title="차트 설정 (지표·보기)">' + P.gear + '</button>';
  head.querySelector('b').textContent = String(title).trim();
  panel.insertBefore(head, panel.firstChild);
  // G-156: one bar at the bottom like Toss — 봉 단위 (moved in below), 차트 모양, 그리기 (phones).
  var foot = document.createElement('div'); foot.className = 'cfs-foot';
  foot.innerHTML = '<button type="button" class="cfs-fb" data-ct-open aria-label="차트 모양" title="차트 모양" aria-haspopup="dialog">' + svg(ICON_CT[pref.ct]) + '</button><button type="button" class="cfs-fb" data-draw-open aria-label="그리기" title="그리기">' + P.pen + '</button>';
  panel.appendChild(foot);
  var ctPop = document.createElement('div'); ctPop.className = 'ct-pop'; ctPop.hidden = true;
  ctPop.innerHTML = '<div class="ct-body" role="dialog" aria-modal="true" aria-label="차트 모양"><div class="ct-grab" aria-hidden="true"></div><h3>차트 모양</h3><div class="ct-grid">' + P.types.map(function (t) { return '<button type="button" data-ct="' + t[0] + '" aria-pressed="' + (t[0] === pref.ct) + '">' + svg(ICON_CT[t[0]]) + t[1] + '</button>'; }).join('') + '</div></div>';
  panel.appendChild(ctPop);
  foot.querySelector('[data-ct-open]').addEventListener('click', function () { ctPop.querySelectorAll('[data-ct]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ct') === pref.ct)); }); ctPop.hidden = false; var on = ctPop.querySelector('[aria-pressed=true]'); if (on) on.focus(); });
  ctPop.addEventListener('click', function (e) { if (e.target === ctPop) { ctPop.hidden = true; return; } var b = e.target.closest('[data-ct]'); if (!b) return; if (window.GNM_chartPro) GNM_chartPro.type(b.getAttribute('data-ct')); ctPop.hidden = true; });
  var drawMode = function (on) { root.classList.toggle('chart-draw', on); if (!on) { var dw = document.getElementById('dw'), sel = dw && dw.querySelector('[data-dw="select"]'); if (sel && sel.getAttribute('aria-pressed') !== 'true') sel.click(); var tl = document.getElementById('dw-tools'); if (tl) tl.hidden = true; } setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 30); };
  // The drawing bar is built by its own script when the chart is ready; the close button joins it then.
  var ensureX = function () { var dwb = document.getElementById('dw'); if (dwb && !dwb.querySelector('.dw-x')) dwb.insertAdjacentHTML('beforeend', '<button type="button" class="dw-b dw-x" aria-label="그리기 닫기" title="그리기 닫기">' + P.close + '<span>닫기</span></button>'); };
  panel.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.dw-x')) drawMode(false); });
  foot.querySelector('[data-draw-open]').addEventListener('click', function () { ensureX(); drawMode(true); });
  // The minute button says which minute chart is on ("5분"), like Toss's "10분 ⌄".
  foot.addEventListener('click', function (e) { var b = e.target.closest('[data-coin-tf]'); if (!b) return; var m = foot.querySelector('[data-minute-menu]'); if (m) m.textContent = /^(1|5|15|60)$/.test(b.getAttribute('data-coin-tf')) ? b.getAttribute('data-coin-tf') + '분' : '분'; });
  head.querySelector('[data-cfs-set]').addEventListener('click', function () { var o = document.querySelector('[data-open="ind-sheet"]'); if (o) o.click(); var t0 = document.getElementById('st-t0'); if (t0) t0.click(); });
  var land = head.querySelector('[data-land]'), landT = function (t) { land.setAttribute('aria-label', t); land.title = t; };
  landT(mobile ? '가로로 보기' : '브라우저 전체 화면');
  land.addEventListener('click', function () {
    if (document.fullscreenElement) { document.exitFullscreen().catch(function () {}); return; }
    var go = function () { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {}); };
    if (panel.requestFullscreen) panel.requestFullscreen().then(go).catch(function () { toast('휴대폰을 가로로 돌리면 차트가 넓게 보여요.'); });
    else toast('휴대폰을 가로로 돌리면 차트가 넓게 보여요.');
  });
  document.addEventListener('fullscreenchange', function () { landT(document.fullscreenElement ? '전체 화면 끝내기' : mobile ? '가로로 보기' : '브라우저 전체 화면'); setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 60); });
  var panels = Array.prototype.slice.call(document.querySelectorAll('[role=tabpanel]'));
  var lastTab = 'tab-home', isOpen = false;
  // Back is the way out; only when it never arrives (no entry to go back to) is the tab switched directly.
  // A settings page or sheet closed with its own button leaves its history entry behind, so going back may first land
  // on the chart's own entry: keep going back (a few steps at most) until the chart is closed.
  var close = function () {
    var tries = 0, done = false;
    var finish = function () { if (done) return; done = true; window.removeEventListener('popstate', onPop); if (!panel.hidden && window.GNM_showTab) GNM_showTab(lastTab.replace('tab-', '')); };
    var onPop = function () { setTimeout(function () { if (done) return; if (panel.hidden) finish(); else if (++tries < 4) history.back(); else finish(); }, 80); };
    window.addEventListener('popstate', onPop);
    history.back();
    setTimeout(finish, 1500);
  };
  head.querySelector('.cfs-back').addEventListener('click', close);
  var watch = function () {
    var on = !panel.hidden;
    panels.forEach(function (p) { if (p !== panel && !p.hidden) lastTab = p.id; });
    if (on === isOpen) return; isOpen = on;
    root.classList.toggle('chart-fs', on);
    if (!on) { root.classList.remove('chart-draw'); ctPop.hidden = true; if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); return; }
    // Every way in (link, indicator button, a shared #tab-chart address) leaves one history entry, so the phone's
    // back button closes the chart and lands on the tab the reader came from.
    if (!(history.state && history.state.gnmChart)) { history.replaceState(history.state, '', '#' + lastTab); history.pushState({ gnmChart: 1 }, '', '#tab-chart'); }
    panel.scrollTop = 0; init(); setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 30);
  };
  panels.forEach(function (p) { new MutationObserver(watch).observe(p, { attributes: true, attributeFilter: ['hidden'] }); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !isOpen) return;
    if (!ctPop.hidden) { ctPop.hidden = true; return; }
    if (document.querySelector('.sheet:not([hidden]), .chart-card.drawing, dialog[open]')) return;
    if (root.classList.contains('chart-draw')) { drawMode(false); return; }
    close();
  });
  setTimeout(watch, 0);
  // In-page links open it without their own hash entry; watch() adds exactly one.
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href="#tab-chart"]'); if (!a || !window.GNM_showTab) return; e.preventDefault(); GNM_showTab('chart'); }, true);

  // ---- tools on top of window.GNMChart ----
  var G = null;
  var init = function () {
    var g = window.GNMChart; if (!g || g === G || !g.candle) return; G = g;
    var L = G.L, chart = G.chart, candle = G.candle, card = panel.querySelector('.chart-card');
    if (card && !card.querySelector('.pro-bar')) { var at = card.querySelector('.chart-head'); var wrap = document.createElement('div'); wrap.innerHTML = ${JSON.stringify('__BAR__')}; if (at) at.insertAdjacentElement('afterend', wrap.firstChild); else card.insertBefore(wrap.firstChild, card.firstChild); }
    var bar = panel.querySelector('.pro-bar'); if (!bar) return;
    // One swipeable row for every chart setting: 봉 단위, 차트 종류, 가격 축, 지표, 전략, toggles (G-146).
    var gather = function () {
      var tf = card.querySelector('.chart-head > .coin-tf') || card.querySelector('.v6-bar .seg.tf');
      if (tf && tf.parentElement !== foot) { foot.insertBefore(tf, foot.firstChild); tf.querySelectorAll('button').forEach(function (b) { var u = b.getAttribute('data-tf') || b.getAttribute('data-coin-tf'), sh = b.hasAttribute('data-minute-menu') ? '분' : { D: '일', W: '주', M: '월', T: '틱' }[u]; if (!sh || b.dataset.short) return; b.dataset.short = '1'; b.setAttribute('aria-label', b.textContent.trim()); b.textContent = sh; }); }
      var cmp = card.querySelector('.v6-bar [data-compare]'); if (cmp) bar.appendChild(cmp);
      var ct = card.querySelector('.chart-tools'); if (ct) { [].slice.call(ct.querySelectorAll('[data-open="ind-sheet"], #ind-reset, .strat-pick')).forEach(function (b) { bar.appendChild(b); }); ct.hidden = true; }
      var v6 = card.querySelector('.v6-bar'); if (v6 && !v6.querySelector('button, select')) v6.hidden = true;
    };
    if (card) { gather(); var hd = card.querySelector('.chart-head'); if (hd) new MutationObserver(gather).observe(hd, { childList: true }); }
    // ---- settings as a page (G-156): 상단 지표 · 하단 지표 · 설정 tabs, 초기화 on top, 저장하기 at the bottom ----
    var sheet = document.getElementById('ind-sheet');
    if (sheet && !sheet.classList.contains('st-page')) {
      sheet.classList.add('st-page');
      var sbody = sheet.querySelector('.sheet-body'), sh = sbody.querySelector('.sheet-head'), groups = [].slice.call(sbody.children).filter(function (x) { return x.classList.contains('opt-group'); }), note = [].slice.call(sbody.children).filter(function (x) { return x.tagName === 'P'; })[0];
      sh.querySelector('b').textContent = '차트 설정';
      var shut = function () { sheet.hidden = true; document.body.classList.remove('sheet-open'); sheet.classList.remove('dp-open'); var d0 = sheet.querySelector('.st-dp'); if (d0) { d0.hidden = true; d0.innerHTML = ''; } var g0 = head.querySelector('[data-cfs-set]'); if (g0) g0.focus(); };
      var sx = document.createElement('button'); sx.type = 'button'; sx.className = 'st-x'; sx.setAttribute('aria-label', '닫기'); sx.innerHTML = P.back; sh.insertBefore(sx, sh.firstChild); sx.addEventListener('click', shut);
      var rs = document.createElement('button'); rs.type = 'button'; rs.className = 'st-reset'; rs.textContent = '초기화'; rs.title = '내 보기 방식의 기본 지표로 되돌려요'; sh.appendChild(rs);
      rs.addEventListener('click', function () { var r = document.getElementById('ind-reset'); if (r && !r.disabled) { r.click(); toast('기본 지표로 되돌렸어요.'); } });
      var names = ['상단 지표', '하단 지표', '설정'], tabs = document.createElement('div'); tabs.className = 'st-tabs'; tabs.setAttribute('role', 'tablist');
      tabs.innerHTML = names.map(function (n, i) { return '<button type="button" role="tab" id="st-t' + i + '" aria-controls="st-p' + i + '" aria-selected="' + (i === 0) + '" data-st="' + i + '">' + n + '</button>'; }).join('');
      sh.insertAdjacentElement('afterend', tabs);
      var panes = names.map(function (n, i) { var d = document.createElement('div'); d.className = 'st-pane' + (i === 2 ? ' st-more' : ''); d.id = 'st-p' + i; d.setAttribute('role', 'tabpanel'); d.setAttribute('aria-labelledby', 'st-t' + i); d.hidden = i !== 0; return d; });
      var after = tabs; panes.forEach(function (d) { after.insertAdjacentElement('afterend', d); after = d; });
      if (groups[0]) panes[0].appendChild(groups[0]); if (groups[1]) panes[1].appendChild(groups[1]);
      var vk = document.createElement('div'); vk.className = 'opt-k'; vk.textContent = '보기'; panes[2].appendChild(vk); panes[2].appendChild(bar);
      groups.slice(2).forEach(function (g) { panes[2].appendChild(g); }); if (note) panes[2].appendChild(note);
      tabs.addEventListener('click', function (e) { var b = e.target.closest('[data-st]'); if (!b) return; var n = Number(b.getAttribute('data-st')); tabs.querySelectorAll('[data-st]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); }); panes.forEach(function (d, i) { d.hidden = i !== n; }); sbody.scrollTop = 0; });
      var save = document.createElement('button'); save.type = 'button'; save.className = 'st-save'; save.textContent = '저장하기'; sbody.appendChild(save);
      save.addEventListener('click', function () { shut(); toast('차트 설정을 저장했어요.'); });
      // G-157: 상세 설정하기 — under each indicator that is on; a page of − / + fields, 기본값 and 저장하기.
      var IPAPI = window.GNM_indParams;
      if (IPAPI) {
        sheet.querySelectorAll('.opt[data-ov], .opt[data-pane]').forEach(function (b) {
          var k = b.getAttribute('data-ov') || b.getAttribute('data-pane'); if (!FIELDS[k] || !IPAPI.get(k)) return;
          var a = document.createElement('button'); a.type = 'button'; a.className = 'st-more-link'; a.setAttribute('data-detail', k); a.textContent = '상세 설정하기 ›'; b.insertAdjacentElement('afterend', a);
        });
        var dp = document.createElement('div'); dp.className = 'st-dp'; dp.hidden = true; sbody.appendChild(dp);
        var dpKey = null, esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
        var dpClose = function () { dp.hidden = true; dp.innerHTML = ''; sheet.classList.remove('dp-open'); var back = dpKey && sheet.querySelector('[data-detail="' + dpKey + '"]'); dpKey = null; if (back) back.focus(); };
        var fill = function (v) { FIELDS[dpKey].forEach(function (f) { var i = dp.querySelector('input[name="' + f[0] + '"]'); if (i) i.value = String(v[f[0]]); }); };
        var dpOpen = function (k) {
          dpKey = k; var ob = sheet.querySelector('[data-ov="' + k + '"], [data-pane="' + k + '"]'), name = ob ? ob.querySelector('.opt-t b').textContent.replace(/\\s*\\d+$/, '') : k, note = ob && ob.querySelector('.opt-t small') ? ob.querySelector('.opt-t small').textContent : '';
          dp.innerHTML = '<div class="st-dp-head"><button type="button" class="st-x" data-dp-x aria-label="뒤로">' + P.back + '</button><b>' + esc(name) + '</b><button type="button" class="st-reset" data-dp-def>기본값</button></div><div class="st-dp-body">'
            + FIELDS[k].map(function (f) { return '<div class="st-f"><span id="dpl-' + f[0] + '">' + esc(f[1]) + '</span><span class="st-step"><button type="button" data-step="-1" aria-label="' + esc(f[1]) + ' 줄이기">−</button><input type="number" inputmode="decimal" name="' + f[0] + '" min="' + f[2] + '" max="' + f[3] + '" step="' + f[4] + '" aria-labelledby="dpl-' + f[0] + '"><button type="button" data-step="1" aria-label="' + esc(f[1]) + ' 늘리기">+</button></span></div>'; }).join('')
            + (note ? '<p class="st-dp-note">' + esc(note) + '</p>' : '') + '</div><button type="button" class="st-save" data-dp-save>저장하기</button>';
          fill(IPAPI.get(k)); sheet.classList.add('dp-open'); dp.hidden = false; sbody.scrollTop = 0; var x0 = dp.querySelector('[data-dp-x]'); if (x0) x0.focus();
        };
        sheet.addEventListener('click', function (e) { var a = e.target.closest('[data-detail]'); if (a) dpOpen(a.getAttribute('data-detail')); });
        var clamp = function (inp) { var f = FIELDS[dpKey].filter(function (x) { return x[0] === inp.name; })[0], v = Number(inp.value); if (!isFinite(v)) v = f[2]; v = Math.min(f[3], Math.max(f[2], Math.round(v / f[4]) * f[4])); inp.value = String(v); return v; };
        dp.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          if (b.hasAttribute('data-dp-x')) { dpClose(); return; }
          if (b.hasAttribute('data-dp-def')) { fill(IPAPI.defaults[dpKey]); return; }
          if (b.hasAttribute('data-step')) { var inp = b.parentNode.querySelector('input'), f = FIELDS[dpKey].filter(function (x) { return x[0] === inp.name; })[0]; inp.value = String(Number(inp.value || 0) + Number(b.getAttribute('data-step')) * f[4]); clamp(inp); return; }
          if (b.hasAttribute('data-dp-save')) {
            var v = {}; dp.querySelectorAll('input').forEach(function (i) { v[i.name] = clamp(i); });
            if ((dpKey === 'ema12' || dpKey === 'macd') && v.s <= v.f) { toast('긴 기간은 짧은 기간보다 커야 해요.'); return; }
            if (dpKey === 'rsi' && v.hi <= v.lo) { toast('과열 기준은 침체 기준보다 커야 해요.'); return; }
            IPAPI.set(dpKey, v); toast('바꾼 값을 차트에 적용했어요.'); dpClose();
          }
        });
        dp.addEventListener('change', function (e) { if (e.target.matches('input')) clamp(e.target); });
      }
    }
    ensureX();
    // The small live price in the header: the last close until the live feed answers (LIVE_JS fills [data-live]).
    var px = head.querySelector('.cfs-px'), sym = ((card && card.getAttribute('data-symbol')) || new URLSearchParams(location.search).get('c') || new URLSearchParams(location.search).get('m') || new URLSearchParams(location.search).get('s') || '').toUpperCase();
    try { var dd = candle.data(), lc = dd[dd.length - 1], pc0 = dd[dd.length - 2]; if (lc) { var usd = root.getAttribute('data-ccy') === 'USD'; px.firstChild.textContent = usd ? '$' + lc.close.toFixed(2) : (Math.abs(lc.close) >= 100 ? Math.round(lc.close).toLocaleString('ko-KR') : lc.close.toLocaleString('ko-KR', { maximumFractionDigits: 4 })) + '원'; if (pc0) { var ch0 = (lc.close / pc0.close - 1) * 100; px.lastChild.textContent = (ch0 > 0 ? '▲ +' : ch0 < 0 ? '▼ ' : '') + ch0.toFixed(2) + '%'; px.lastChild.className = ch0 > 0 ? 'up' : ch0 < 0 ? 'down' : ''; } } } catch (e) {}
    if (sym) [].forEach.call(px.children, function (el) { el.setAttribute('data-live', sym); });
    var orig = candle.options(), cur = [], view = null, shown = true;
    var plain = function (b) { return { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }; };
    try { cur = candle.data().map(plain); } catch (e) { cur = []; }
    var ha = function (d) { var o = [], po = 0, pc = 0; d.forEach(function (b, i) { var c = (b.open + b.high + b.low + b.close) / 4, op = i ? (po + pc) / 2 : (b.open + b.close) / 2; o.push({ time: b.time, open: op, high: Math.max(b.high, op, c), low: Math.min(b.low, op, c), close: c }); po = op; pc = c; }); return o; };
    var closes = function (d) { return d.map(function (b) { return { time: b.time, value: b.close }; }); };
    var conv = function (d) { return pref.ct === 'ha' ? ha(d) : pref.ct === 'bar' || pref.ct === 'hollow' ? d : closes(d); };
    // The day/week/month switch hides every series but the candle; the chart type rides on the candle instead.
    var series0 = G.series; G.series = function () { return series0.call(G).filter(function (s) { return s !== view; }); };
    var setData = candle.setData.bind(candle), update = candle.update.bind(candle), apply = candle.applyOptions.bind(candle);
    var baseAt = function () { if (!view || pref.ct !== 'base' || !cur.length) return; var r = chart.timeScale().getVisibleLogicalRange(), i = r ? Math.max(0, Math.min(cur.length - 1, Math.ceil(r.from))) : 0; view.applyOptions({ baseValue: { type: 'price', price: cur[i].close } }); };
    var sync = function () { if (view) { view.setData(conv(cur)); baseAt(); } };
    candle.setData = function (d) { cur = (d || []).map(plain); setData(d); sync(); };
    candle.update = function (b) { var l = cur[cur.length - 1]; if (l && JSON.stringify(l.time) === JSON.stringify(b.time)) cur[cur.length - 1] = plain(b); else cur.push(plain(b)); update(b); if (view) { if (pref.ct === 'ha') sync(); else view.update(conv([plain(b)])[0]); } };
    candle.applyOptions = function (o) { apply(o); if (o && 'visible' in o) { shown = o.visible !== false; if (view) view.applyOptions({ visible: shown }); } };
    var setType = function (k) {
      pref.ct = k; keep();
      if (!ICON_CT[k]) k = pref.ct = 'candle'; var ob = foot.querySelector('[data-ct-open]'); if (ob) ob.innerHTML = svg(ICON_CT[k]);
      if (view) { chart.removeSeries(view); view = null; }
      if (k === 'candle') { apply({ upColor: orig.upColor, downColor: orig.downColor, wickUpColor: orig.wickUpColor, wickDownColor: orig.wickDownColor, wickVisible: true, borderVisible: orig.borderVisible, lastValueVisible: true, priceLineVisible: true }); return; }
      apply({ upColor: T, downColor: T, wickUpColor: T, wickDownColor: T, borderUpColor: T, borderDownColor: T, wickVisible: false, borderVisible: false, lastValueVisible: false, priceLineVisible: false });
      var o = { priceLineVisible: true, lastValueVisible: true, visible: shown };
      if (k === 'ha') view = chart.addSeries(L.CandlestickSeries, Object.assign({ upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN }, o));
      if (k === 'hollow') view = chart.addSeries(L.CandlestickSeries, Object.assign({ upColor: T, downColor: DOWN, borderVisible: true, borderUpColor: UP, borderDownColor: DOWN, wickUpColor: UP, wickDownColor: DOWN }, o));
      if (k === 'bar') view = chart.addSeries(L.BarSeries, Object.assign({ upColor: UP, downColor: DOWN, thinBars: false }, o));
      if (k === 'line') view = chart.addSeries(L.LineSeries, Object.assign({ color: NAVY, lineWidth: 2 }, o));
      if (k === 'area') view = chart.addSeries(L.AreaSeries, Object.assign({ lineColor: NAVY, topColor: 'rgba(46,66,104,.28)', bottomColor: 'rgba(46,66,104,.02)', lineWidth: 2 }, o));
      if (k === 'base') view = chart.addSeries(L.BaselineSeries, Object.assign({ topLineColor: UP, topFillColor1: 'rgba(240,68,82,.22)', topFillColor2: 'rgba(240,68,82,.03)', bottomLineColor: DOWN, bottomFillColor1: 'rgba(49,130,246,.03)', bottomFillColor2: 'rgba(49,130,246,.22)', lineWidth: 2 }, o));
      sync();
    };
    var setScale = function (n) {
      pref.scale = n; keep(); chart.priceScale('right').applyOptions({ mode: n });
      bar.querySelectorAll('[data-scale]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-scale')) === n)); });
    };
    var setMagnet = function (on) { pref.magnet = on; keep(); chart.applyOptions({ crosshair: { mode: on ? 1 : 0 } }); bar.querySelector('[data-magnet]').setAttribute('aria-pressed', String(on)); };

    // ---- high / low of the range on screen ----
    var won = function (v) { return Math.abs(v) >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: Math.abs(v) >= 1 ? 2 : 4 }); };
    var req = null, ext = function () {
      var r = chart.timeScale().getVisibleLogicalRange(); if (!r || !cur.length) return null;
      var a = Math.max(0, Math.ceil(r.from)), b = Math.min(cur.length - 1, Math.floor(r.to)); if (b <= a) return null;
      var hi = a, lo = a; for (var i = a; i <= b; i++) { if (cur[i].high > cur[hi].high) hi = i; if (cur[i].low < cur[lo].low) lo = i; }
      return { hi: cur[hi], lo: cur[lo] };
    };
    // Toss-style: an arrow to the candle and "37,000원 (-58.6%, 26.05.08)" — today's price against that mark.
    var ymd = function (t) { if (typeof t === 'number') { var d = new Date(t * 1000); return (d.getMonth() + 1) + '.' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); } var y, m, dd; if (t && t.year) { y = t.year; m = t.month; dd = t.day; } else { var s = String(t); y = +s.slice(0, 4); m = +s.slice(5, 7); dd = +s.slice(8, 10); } return String(y).slice(2) + '.' + String(m).padStart(2, '0') + '.' + String(dd).padStart(2, '0'); };
    var money = function (v) { return root.getAttribute('data-ccy') === 'USD' ? '$' + v.toFixed(2) : won(v) + '원'; };
    var mark = function (ctx, r, w, b, price, top) {
      var x = chart.timeScale().timeToCoordinate(b.time), y = candle.priceToCoordinate(price); if (x == null || y == null) return;
      var last = cur.length ? cur[cur.length - 1].close : 0, g = last && price ? (last / price - 1) * 100 : null;
      var t = money(price) + (g == null ? '' : ' (' + (g > 0 ? '+' : '') + g.toFixed(1) + '%, ' + ymd(b.time) + ')');
      ctx.font = '600 ' + (12 * r) + 'px sans-serif'; var tw = ctx.measureText(t).width;
      var x0 = x * r, tip = (top ? y - 3 : y + 3) * r, end = (top ? y - 15 : y + 15) * r, a = 4 * r, ah = top ? -a : a;
      ctx.strokeStyle = ctx.fillStyle = top ? UP : DOWN; ctx.lineWidth = 1.5 * r; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, end); ctx.lineTo(x0, tip); ctx.moveTo(x0 - a, tip + ah); ctx.lineTo(x0, tip); ctx.lineTo(x0 + a, tip + ah); ctx.stroke();
      ctx.textBaseline = top ? 'bottom' : 'top'; ctx.fillText(t, Math.max(4 * r, Math.min(w - tw - 4 * r, x0 - tw / 2)), top ? end - 3 * r : end + 3 * r);
    };
    candle.attachPrimitive({
      attached: function (p) { req = p.requestUpdate; }, detached: function () {}, updateAllViews: function () {},
      paneViews: function () { return [{ zOrder: function () { return 'top'; }, renderer: function () { return { draw: function (target) {
        if (!pref.hilo || !shown) return; var e = ext(); if (!e) return;
        target.useBitmapCoordinateSpace(function (s) { s.context.save(); mark(s.context, s.horizontalPixelRatio, s.bitmapSize.width, e.hi, e.hi.high, true); mark(s.context, s.horizontalPixelRatio, s.bitmapSize.width, e.lo, e.lo.low, false); s.context.restore(); });
      } }; } }]; }
    });
    var t = null; chart.timeScale().subscribeVisibleLogicalRangeChange(function () { if (req) req(); if (!t) t = setTimeout(function () { t = null; baseAt(); }, 120); });

    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-scale')) setScale(Number(b.getAttribute('data-scale')));
      else if (b.hasAttribute('data-hilo')) { pref.hilo = !pref.hilo; keep(); b.setAttribute('aria-pressed', String(pref.hilo)); if (req) req(); }
      else if (b.hasAttribute('data-magnet')) setMagnet(!pref.magnet);
      else if (b.hasAttribute('data-shot')) {
        try { chart.takeScreenshot().toBlob(function (blob) { if (!blob) return; var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = String(title).trim().replace(/\\s+/g, '_') + '-chart.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); toast('차트 사진을 저장했어요.'); }); } catch (x) { toast('이 브라우저에서는 사진 저장이 안 돼요.'); }
      }
    });
    bar.querySelector('[data-hilo]').setAttribute('aria-pressed', String(pref.hilo));
    if (pref.ct !== 'candle') setType(pref.ct); if (pref.scale) setScale(pref.scale); if (pref.magnet) setMagnet(true);
    window.GNM_chartPro = { type: setType, scale: setScale, view: function () { return view; }, extremes: ext };
  };
  // The free chart pages build GNMChart after their data arrives; try again until it exists.
  var tries = 0, poll = setInterval(function () { init(); if (G || ++tries > 60) clearInterval(poll); }, 500);
  window.addEventListener('DOMContentLoaded', init);
})();
`.replace(JSON.stringify('__BAR__'), JSON.stringify(CHART_PRO_BAR).replace(/</g, '\\u003c'));
