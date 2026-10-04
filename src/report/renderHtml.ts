// Static dashboard pages for the daily report and the report index.
// The chart uses TradingView Lightweight Charts, served from our own site
// (assets/lightweight-charts.js); if it fails to load, a static SVG stays.

import type { DailyReport, ReportedFiling } from './dailyReport.js';
import type { TechnicalSummary } from '../analysis/technicals.js';
import type { Claim, Commentary } from '../analysis/commentary.js';
import { chartOverlays, flowsPanel, forecastCard, fundamentalsPanel, horizonRow, marketStatusWarning, structureCard, valueCard } from './renderMarket.js';

export const CHART_ASSET = 'assets/lightweight-charts.js';
/** Pretendard web font, also served from our own site. */
export const FONT_DIR = 'assets/fonts';

const escape = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const won = (value: number): string => `${Math.round(value).toLocaleString('ko-KR')}원`;
const pct = (value: number | null): string => (value === null ? '없음' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`);
const tone = (value: number | null): string => (value === null || value === 0 ? '' : value > 0 ? 'up' : 'down');
const IMPORTANCE_LABEL = { HIGH: '중요', MEDIUM: '보통', LOW: '참고' } as const;
const MIX_COLORS = ['#8f6c3a', '#b08d57', '#d4b67e', '#e8d7b2', '#6b6f78', '#f3ead8'];
/** Meta details as separate items (spacing, not "·" chains). */
const meta = (parts: readonly string[], cls = 'meta'): string => `<span class="${cls}">${parts.filter(Boolean).map((part) => `<span>${part}</span>`).join('')}</span>`;

const ICON = {
  logo: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M16 16 L16 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M16 16 L25 21" stroke="#b08d57" stroke-width="2.4" stroke-linecap="round"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 12l4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  archive: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  filing: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 12h6M10 16h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  why: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4M12 16.6v.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  news: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h11v14H7a2 2 0 0 1-2-2zM16 9h3v8a2 2 0 0 1-2 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 9h5M8 12h5M8 15h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  flow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16l4-4 4 3 8-8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  fundamentals: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="4" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="10" y="7" width="4" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="16" y="4" width="4" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M17 4v16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><rect x="5" y="8" width="4" height="7" rx="1" fill="currentColor"/><rect x="15" y="6" width="4" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  source: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  price: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17l5-5 4 3 7-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  week: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 10h16M9 3v4M15 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  month: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M10 19V5M15 19v-7M20 19v-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M7 16v-4M12 16V8M17 16v-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17l6-6 4 4 6-7M15 8h5v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7l6 6 4-4 6 7M15 16h5v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const STYLE = `
:root{--frame:#f6f2ea;--surface:#ffffff;--card:#fcfaf6;--line:#ebe4d6;--fg:#1b2230;--muted:#7b7f87;
--accent:#a8834a;--accent-strong:#8a6a37;--accent-soft:#f6eedf;--gold-grad:linear-gradient(135deg,#d4b67e 0%,#b08d57 55%,#8f6c3a 100%);
--up:#d1373d;--down:#2a62c9;--warn:#b07a1e;--focus:#a8834a;--serif:"Noto Serif KR","Nanum Myeongjo","AppleMyungjo",serif;--ease-out:cubic-bezier(.16,1,.3,1)}
*{box-sizing:border-box}html{color-scheme:light}html,body{margin:0}body{background:var(--frame);color:var(--fg);
font:15px/1.6 "Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;
-webkit-font-smoothing:antialiased;word-break:keep-all;overflow-wrap:anywhere}
a{color:inherit}button,a{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.skip{position:absolute;left:16px;top:16px;z-index:10;background:var(--gold-grad);color:#fff;padding:8px 14px;border-radius:999px;font-weight:600;text-decoration:none;transform:translateY(-200%);transition:transform 150ms var(--ease-out)}
.skip:focus{transform:none}[id]{scroll-margin-top:16px}h1,h2,h3{text-wrap:balance}p,li{text-wrap:pretty}
.meta{display:inline-flex;flex-wrap:wrap;gap:2px 12px}.m-date.meta{display:none}.app{display:grid;grid-template-columns:240px minmax(0,1fr);gap:16px;max-width:1440px;margin:0 auto;padding:16px;min-height:100vh}
.side{background:var(--surface);color:var(--fg);border:1px solid var(--line);border-radius:18px;padding:24px 16px;position:sticky;top:16px;height:calc(100vh - 32px);display:flex;flex-direction:column;gap:28px}
.brand{display:flex;align-items:center;gap:10px;color:var(--fg);padding:0 8px;text-decoration:none}.brand svg{width:30px;height:30px;color:var(--fg)}
.brand b{display:block;font-family:var(--serif);font-weight:600;font-size:19px;letter-spacing:.14em}.brand small{display:block;font-size:11px;color:var(--accent);letter-spacing:.08em}
.nav{display:flex;flex-direction:column;gap:6px}.nav a{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:999px;text-decoration:none;font-size:15px}
.nav a{transition:background-color 150ms var(--ease-out),color 150ms var(--ease-out)}.nav a svg{width:20px;height:20px;flex:none}.nav a{color:#4a505a}.nav a:hover{background:var(--accent-soft);color:var(--fg)}.nav a.active{background:var(--gold-grad);color:#fff;font-weight:600;box-shadow:0 2px 8px rgba(143,108,58,.25)}
.side .foot{margin-top:auto;font-size:12px;color:var(--muted);padding:0 8px;border-top:1px solid var(--line);padding-top:14px}
main{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:20px 28px 40px;min-width:0}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.ticker{display:flex;align-items:center;gap:10px;background:var(--card);border-radius:10px;padding:8px 14px;font-weight:600}.ticker span{color:var(--muted);font-weight:500}
.stamp{color:var(--muted);font-size:13px;text-align:right}
h1{font-family:var(--serif);font-weight:600;font-size:34px;margin:0 0 6px;letter-spacing:-.01em}.sub{color:var(--muted);margin:0 0 20px}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px 20px;min-width:0;box-shadow:0 1px 2px rgba(27,34,48,.03)}
.kpi .row{display:flex;align-items:center;gap:12px}.kpi .ico{width:42px;height:42px;border-radius:10px;display:grid;place-items:center;color:var(--accent-strong);background:var(--accent-soft)!important;flex:none}
.kpi .ico svg{width:22px;height:22px}.kpi .label{color:var(--muted);font-size:13px}.kpi .value{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;display:flex;align-items:center;gap:6px}
.kpi .value svg{width:20px;height:20px}.kpi .hint{color:var(--muted);font-size:13px;margin-top:14px}
.up{color:var(--up)}.down{color:var(--down)}
.grid2{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px;margin-top:16px}.grid-eq{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:16px}
.card h2{font-family:var(--serif);font-size:18px;margin:0;font-weight:600}.head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.seg{display:inline-flex;background:#fff;border:1px solid var(--line);border-radius:999px;padding:3px}.seg button{border:0;background:none;padding:5px 12px;border-radius:999px;font:inherit;font-size:13px;color:var(--muted);cursor:pointer}
.seg button{transition:background-color 150ms var(--ease-out),color 150ms var(--ease-out)}.seg button:hover{color:var(--fg);background:var(--accent-soft)}.seg button[aria-pressed=true]{background:var(--gold-grad);color:#fff}.seg button:active{transform:scale(.97)}
.legend-line{font-size:13px;color:var(--muted);min-height:20px;font-variant-numeric:tabular-nums}
#chart{height:340px;position:relative}#chart svg{width:100%;height:100%}
.donut{display:flex;flex-direction:column;align-items:center;gap:16px}.donut svg{width:180px;height:180px}
.legend{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px;width:100%;font-size:13px;color:var(--muted)}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}
.headline{font-size:17px;font-weight:600;margin:0 0 10px}ul.plain{margin:0;padding-left:18px}ul.plain li{margin:6px 0}
.empty{color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;color:var(--muted);font-weight:500;font-size:13px;padding:10px 8px;border-bottom:1px solid var(--line)}
td{padding:12px 8px;border-bottom:1px solid var(--line);vertical-align:top}td a{text-decoration:none;font-weight:500}td a:hover{text-decoration:underline}
.why{color:var(--muted);font-size:13px;margin-top:2px}.badge{display:inline-block;font-size:12px;border-radius:999px;padding:1px 9px;white-space:nowrap}
.b-HIGH{background:#fde8e6;color:#b4232a}.b-MEDIUM{background:#fff3dc;color:var(--warn)}.b-LOW{background:#eef1f0;color:var(--muted)}.b-new{background:var(--accent-soft);color:var(--accent-strong);margin-left:6px;border:1px solid #e6d5b4}
.table-wrap{overflow-x:auto}
.why-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:8px}.why-col{background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.why-col h3,.why-h{font-size:14px;margin:0 0 6px}.why-h{margin-top:16px}.bull h3{color:var(--up)}.bear h3{color:var(--down)}.unc h3{color:var(--muted)}
ul.claims{margin:0;padding-left:18px}ul.claims li{margin:6px 0;font-size:14px}.chips{white-space:nowrap}
.chip{display:inline-block;font-size:11px;font-weight:600;color:var(--accent);background:var(--accent-soft);border-radius:6px;padding:0 6px;margin-left:3px;text-decoration:none;transition:background-color 150ms var(--ease-out),color 150ms var(--ease-out)}.chip:hover{background:var(--accent);color:#fff}
.evid li{font-size:13px}.desk-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.desk-top{display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px}.desk-grid p,.why-grid p{margin:4px 0;font-size:14px}
.red-team{margin-top:12px;border-left:4px solid var(--warn);background:#fff8ec;border-radius:0 10px 10px 0;padding:10px 14px}.red-team h3{font-size:14px;margin:0 0 4px;color:#7a4a00}.red-team p{margin:4px 0}
.story{padding:12px 0;border-top:1px solid var(--line)}.story:first-of-type{border-top:0}.story-title{font-weight:600;margin:4px 0 2px}.story-title a{text-decoration:none}.story-title a:hover{text-decoration:underline}
.tag{display:inline-block;font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:0 8px}.more summary{cursor:pointer;color:var(--accent);font-size:13px;margin-top:4px}
.warn{background:#fff3dc;color:#7a4a00;border-radius:10px;padding:8px 12px;font-size:13px}
.grid-signal{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:16px;margin-bottom:16px}
.signal{text-align:center}.gauge{width:100%;max-width:260px;display:block;margin:0 auto}.signal-label{font-size:24px;font-weight:700;margin:4px 0}
.reason{margin:6px 0;font-size:14px}.tally{color:var(--muted);font-size:13px}.fine{color:var(--muted);font-size:11px;margin:10px 0 0}
.moms{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.mom{background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.mom .k{color:var(--muted);font-size:12px}.mom .v{font-size:18px;font-weight:700;margin:2px 0}
.gbars{display:grid;gap:12px;margin-top:16px}.gtitle{display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-bottom:6px}
.track{display:flex;height:12px;border-radius:999px;overflow:hidden;background:#eef1f0;gap:2px}.track i{display:block;height:100%}
.track i.v-BULLISH{background:#e5484d}.track i.v-BEARISH{background:#3b7be0}.track i.v-NEUTRAL{background:#c4cbc9}.track i.b-LOW{background:#e6eceb}
.votes{margin-top:14px}.votes td{padding:8px}.votes summary{cursor:pointer;color:var(--accent);font-weight:600;font-size:14px}.votes table{margin-top:8px}
.num{font-variant-numeric:tabular-nums;white-space:nowrap}.v-BULLISH{background:#fde8e6;color:#b4232a}.v-BEARISH{background:#e3ecfb;color:#1d4fa3}.v-NEUTRAL{background:#eef1f0;color:var(--muted)}.nowrap{white-space:nowrap}.m-date{display:none;color:var(--muted);font-size:12px}
footer{margin-top:28px;color:var(--muted);font-size:12px}footer p{margin:2px 0}
.hero{position:relative;overflow:hidden;margin:16px 0 18px;padding:26px 28px;border-radius:16px;border:1px solid var(--line);background:linear-gradient(120deg,#fffdf9 0%,#f7f0e3 60%,#efe4cf 100%)}
.hero .eyebrow{font-size:12px;color:var(--accent-strong);font-weight:600;margin-bottom:6px}.hero .sub{margin:0;max-width:62ch;position:relative}.hero h1{position:relative}
.hero-meta{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:12px;font-size:13px;color:var(--muted);position:relative}.hero-meta b{color:var(--fg);font-variant-numeric:tabular-nums}
.orb{position:absolute;right:-30px;top:50%;width:210px;height:210px;transform:translateY(-50%);border-radius:50%;pointer-events:none;
background:radial-gradient(circle at 34% 30%,#ffffff 0%,#fbf6ec 22%,#ead9b8 52%,#c7a774 78%,#9c7b48 100%);box-shadow:inset -18px -24px 40px rgba(120,90,40,.25),0 18px 40px rgba(143,108,58,.18);opacity:.9}
.orb::after{content:"";position:absolute;inset:18% 30% 52% 22%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.95),rgba(255,255,255,0) 70%)}
.panel-title,.big,.signal-label,.hz-label,.why-col h3,.red-team h3{font-family:var(--serif)}
.tabs{display:flex;gap:4px;margin:4px 0 16px;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none}
.tabs a{padding:10px 14px;text-decoration:none;color:var(--muted);font-weight:600;border-bottom:3px solid transparent;white-space:nowrap;transition:color 150ms var(--ease-out),border-color 150ms var(--ease-out)}
.tabs a:hover{color:var(--fg)}.tabs a[aria-selected=true]{color:var(--fg);border-bottom-color:var(--accent)}
.panel{display:block}.panel[hidden]{display:none}.panel+.panel{margin-top:28px}.js-tabs .panel+.panel{margin-top:0}.js-tabs .panel-title{display:none}
.panel-title{font-size:20px;margin:0 0 12px}.panel:focus{outline:none}
.hz-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.hz{background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px;text-align:center}
.hz-top{display:flex;justify-content:space-between;align-items:baseline;font-size:13px}.hz-top span{color:var(--muted);font-size:12px}
.mini-gauge{width:100%;max-width:150px;display:block;margin:4px auto 0}.hz-label{font-weight:700;font-size:16px}
.hz-meta{display:flex;justify-content:center;flex-wrap:wrap;gap:0 10px;color:var(--muted);font-size:12px}
.value-head{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:6px}.value-head .label,.facts .label{display:block;color:var(--muted);font-size:12px}
.big{font-size:24px;font-weight:700;font-variant-numeric:tabular-nums}.mid{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}
.value-strip{width:100%;height:auto;display:block;margin:6px 0}.value-strip text{font-size:11px;fill:var(--muted)}.vs-axis{stroke:var(--line);stroke-width:2}
.vs-band{fill:var(--accent-soft);stroke:#d9c39a}.vs-center line{stroke:var(--accent);stroke-width:2}.vs-close line{stroke:var(--fg);stroke-width:3}.vs-cons line{stroke:#7a4fb3;stroke-width:2;stroke-dasharray:3 3}.vs-p50 line{stroke:#d97706;stroke-width:2;stroke-dasharray:3 3}
.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:10px}.facts.one{grid-template-columns:1fr;margin-top:10px}.facts b{font-variant-numeric:tabular-nums}
.overlay-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:-4px 0 8px}.overlay-row .label{color:var(--muted);font-size:12px;margin-right:2px}
.chip-toggle{border:1px solid var(--line);background:#fff;border-radius:999px;padding:3px 10px;font:inherit;font-size:12px;color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:background-color 150ms var(--ease-out),color 150ms var(--ease-out)}
.chip-toggle i{display:inline-block;width:10px;height:3px;border-radius:2px}.chip-toggle[aria-pressed=true]{background:var(--accent-soft);color:var(--fg);border-color:#d9c39a}.chip-toggle:hover{color:var(--fg)}
.flow-chart,.earn-chart{width:100%;height:auto;display:block}.flow-chart .zero,.earn-chart .zero{stroke:#c4cbc9;stroke-width:1}.flow-chart .hit{fill:transparent}.flow-chart .hit:hover{fill:rgba(168,131,74,.08)}
.flow-label{font-size:12px;fill:var(--fg);font-weight:600}.axis-label{font-size:11px;fill:var(--muted)}
.legend-inline{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--muted)}.legend-inline i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.b-rev{fill:#00968a}.b-op{fill:#7a4fb3}.b-rev.est{fill:url(#hatch);color:#00968a;stroke:#00968a}.b-op.est{fill:url(#hatch);color:#7a4fb3;stroke:#7a4fb3}
.sw-rev{background:#00968a}.sw-op{background:#7a4fb3}.sw-est{background:repeating-linear-gradient(45deg,#6a7673 0 2px,#fff 2px 4px)}
table.compact td,table.compact th{padding:6px 8px}.grid2.tight{margin-top:0}.research li{font-size:14px}.muted{color:var(--muted)}
.ai-teaser{margin-top:16px}.more-link{font-size:13px;color:var(--accent);font-weight:600}
.needle{transform-box:view-box;transform-origin:110px 104px;transform:rotate(var(--r));animation:settle 900ms var(--ease-out) 200ms both}
@keyframes settle{from{transform:rotate(0deg)}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
@media (max-width:1100px){.desk-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hz-row{grid-template-columns:repeat(3,minmax(0,1fr))}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.grid2,.grid-eq,.grid-signal,.why-grid{grid-template-columns:minmax(0,1fr)}}
@media (max-width:820px){.app{grid-template-columns:minmax(0,1fr);padding:0;gap:0}
.side{position:sticky;top:0;z-index:15;height:auto;border:0;border-bottom:1px solid var(--line);border-radius:0;flex-direction:row;align-items:center;padding:10px 16px;gap:8px;background:#fff}
.side .foot{display:none}
.nav{position:fixed;left:0;right:0;bottom:0;z-index:20;flex-direction:row;justify-content:space-around;gap:0;background:#fff;border-top:1px solid var(--line);padding:6px 2px calc(6px + env(safe-area-inset-bottom));box-shadow:0 -4px 16px rgba(27,34,48,.05)}
.nav a{flex:1;flex-direction:column;justify-content:center;gap:2px;padding:6px 2px;font-size:11px;border-radius:10px;white-space:nowrap;min-width:0}.nav a svg{width:20px;height:20px}
.nav a.active{background:none;box-shadow:none;color:var(--accent-strong)}.nav a[data-nav=sources]{display:none}
.tabs{display:none}main{border:0;border-radius:0;padding:12px 16px 96px}h1{font-size:26px}.hero{padding:20px 18px;margin-top:8px}.orb{width:140px;height:140px;right:-46px;opacity:.75}.kpis{gap:10px}.card{padding:14px}.kpi .value{font-size:18px}#chart{height:280px}
.col-filer,.col-cat,.col-date{display:none}.m-date.meta{display:flex}
.kpi .ico{display:none}.hz-row{grid-template-columns:repeat(2,minmax(0,1fr))}.value-head,.facts{grid-template-columns:repeat(2,minmax(0,1fr))}.tabs a{padding:8px 10px}.moms{gap:8px}.mom{padding:10px}.mom .v{font-size:15px}.votes .why{display:none}.kpi .value{font-size:17px;white-space:nowrap}.kpi .hint{margin-top:8px;font-size:12px}.stamp{text-align:left}}`;

type TabKey = 'overview' | 'chart' | 'flows' | 'fundamentals' | 'ai' | 'news';
const TABS: readonly { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: '개요', icon: ICON.dashboard },
  { key: 'chart', label: '차트·기술', icon: ICON.chart },
  { key: 'flows', label: '수급', icon: ICON.flow },
  { key: 'fundamentals', label: '펀더멘털', icon: ICON.fundamentals },
  { key: 'ai', label: 'AI 해설', icon: ICON.why },
  { key: 'news', label: '뉴스·공시', icon: ICON.news },
];

function shell(active: 'today' | 'archive', base: string, title: string, body: string, scripts = '', reportHref = '#tab-overview', hasWhy = true): string {
  const page = reportHref.replace(/#.*$/, '');
  const nav = [
    ...TABS.filter((t) => t.key !== 'ai' || hasWhy).map((t) => ({ key: t.key as string, href: `${page}#tab-${t.key}`, icon: t.icon, label: t.label })),
    { key: 'archive', href: `${base}index.html#archive`, icon: ICON.archive, label: '지난 리포트' },
    { key: 'sources', href: '#sources', icon: ICON.source, label: '데이터 출처' },
  ];
  const isActive = (key: string) => (active === 'archive' ? key === 'archive' : key === 'overview');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f6f2ea"><title>${escape(title)}</title>
<link rel="stylesheet" href="${base}${FONT_DIR}/pretendard.css"><link rel="stylesheet" href="${base}${FONT_DIR}/serif.css"><style>${STYLE}</style></head><body><a class="skip" href="#main">본문으로 건너뛰기</a><div class="app">
<aside class="side"><a class="brand" href="${base}index.html">${ICON.logo}<div><b>GNOMON</b><small>Analytics</small></div></a>
<nav class="nav" aria-label="리포트 메뉴">${nav.map((n) => `<a href="${n.href}" data-nav="${n.key}"${isActive(n.key) ? ' class="active" aria-current="page"' : ''}>${n.icon}<span>${n.label}</span></a>`).join('')}</nav>
<div class="foot">공개 데이터로 만든 리서치 리포트예요. 투자 권유가 아니에요.</div></aside>
<main id="main" tabindex="-1">${body}</main></div>${scripts}</body></html>`;
}


// Bearish (blue, left) → bullish (red, right): Korean market colours.
const GAUGE_COLORS = ['#1d4fa3', '#3b7be0', '#8fb3ec', '#c4cbc9', '#f0a0a3', '#e5484d', '#a8262b'];
const VOTE_LABEL = { BULLISH: '강세', NEUTRAL: '중립', BEARISH: '약세' } as const;

function gaugeSvg(t: TechnicalSummary | undefined): string {
  const cx = 110, cy = 104, r = 84;
  const point = (deg: number, radius = r) => [cx + radius * Math.cos((deg * Math.PI) / 180), cy - radius * Math.sin((deg * Math.PI) / 180)] as const;
  // Segments follow the level boundaries of levelOf, so the needle always sits in the labelled segment.
  const bounds = [-1, -0.6, -0.3, -0.1, 0.1, 0.3, 0.6, 1];
  const angle = (score: number) => 180 - ((score + 1) / 2) * 180;
  const gap = 1.5;
  const arcs = GAUGE_COLORS.map((color, i) => {
    const from = angle(bounds[i]!) - (i ? gap : 0), to = angle(bounds[i + 1]!) + (i < 6 ? gap : 0);
    const [x1, y1] = point(from), [x2, y2] = point(to);
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${color}" stroke-width="12" fill="none" stroke-linecap="butt"/>`;
  }).join('');
  const needle = t && t.score !== null
    ? (() => {
        // Drawn pointing straight up (neutral), then turned clockwise to the score; CSS lets it settle from neutral.
        const turn = (90 - angle(t.score)).toFixed(1);
        return `<g class="needle" style="--r:${turn}deg" transform="rotate(${turn} ${cx} ${cy})"><path d="M${cx - 6} ${cy} L${cx} ${cy - (r - 22)} L${cx + 6} ${cy} Z" fill="#18201f"/></g><circle cx="${cx}" cy="${cy}" r="7" fill="#18201f"/>`;
      })()
    : `<circle cx="${cx}" cy="${cy}" r="7" fill="#c4cbc9"/>`;
  return `<svg viewBox="0 0 220 118" class="gauge" role="img" aria-label="기술적 신호 ${escape(t?.label ?? '없음')}">${arcs}${needle}
<text x="22" y="117" font-size="10" fill="#6a7673">약세</text><text x="198" y="117" font-size="10" fill="#6a7673" text-anchor="end">강세</text></svg>`;
}

function groupBars(t: TechnicalSummary): string {
  const bar = (group: 'MA' | 'OSC', title: string) => {
    const votes = t.votes.filter((v) => v.group === group);
    const n = votes.length;
    const count = (vote: string | null) => votes.filter((v) => v.vote === vote).length;
    const parts: [string, number, string][] = [['v-BEARISH', count('BEARISH'), '약세'], ['v-NEUTRAL', count('NEUTRAL'), '중립'], ['v-BULLISH', count('BULLISH'), '강세'], ['b-LOW', count(null), '계산 불가']];
    return `<div class="gbar"><div class="gtitle"><span>${title}</span>${meta(parts.filter(([, c]) => c).map(([, c, l]) => `${l} ${c}`))}</div>
<div class="track">${parts.filter(([, c]) => c).map(([cls, c, l]) => `<i class="${cls}" style="width:${((c / n) * 100).toFixed(1)}%" title="${l} ${c}"></i>`).join('')}</div></div>`;
  };
  return `<div class="gbars">${bar('MA', `이동평균 ${t.votes.filter((v) => v.group === 'MA').length}개`)}${bar('OSC', `오실레이터 ${t.votes.filter((v) => v.group === 'OSC').length}개`)}</div>`;
}

function signalSection(report: DailyReport): string {
  const t = report.technicals;
  if (!t) return '';
  const tone = t.score === null ? '' : t.score >= 0.1 ? 'up' : t.score <= -0.1 ? 'down' : '';
  const trendMark = { UP: '▲', FLAT: '■', DOWN: '▼' } as const;
  const trendWord = { UP: '상승', FLAT: '보합', DOWN: '하락' } as const;
  const momentum = (report.momentum ?? []).map((m) => `<div class="mom"><div class="k">${escape(m.label)}</div>
<div class="v ${m.trend === 'UP' ? 'up' : m.trend === 'DOWN' ? 'down' : ''}">${m.trend ? `${trendMark[m.trend]} ${trendWord[m.trend]}` : '판단 보류'}</div>
<div class="k">${m.days}일 ${m.returnPct === null ? '기록 부족' : pct(m.returnPct)}</div></div>`).join('');
  const rows = t.votes.map((v) => `<tr><td>${escape(v.label)}</td><td class="num">${v.value === null ? '없음' : Math.abs(v.value) >= 1000 ? Math.round(v.value).toLocaleString('ko-KR') : v.value.toFixed(2)}</td>
<td>${v.vote ? `<span class="badge v-${v.vote}">${VOTE_LABEL[v.vote]}</span>` : '<span class="badge b-LOW">계산 불가</span>'}</td><td class="why">${escape(v.rule)}</td></tr>`).join('');
  return `<div class="grid-signal" id="signal"><div class="card signal"><div class="head"><h2>기술적 신호</h2><span class="sub" style="margin:0">${escape(t.sessionDate)} 종가 기준</span></div>
${gaugeSvg(t)}<div class="signal-label ${tone}">${escape(t.label)}</div>
<p class="reason">${escape(report.technicalReason ?? '')}</p>
<div class="tally">${meta([`강세 ${t.counts.bullish}`, `중립 ${t.counts.neutral}`, `약세 ${t.counts.bearish}`, t.counts.abstained ? `계산 불가 ${t.counts.abstained}` : ''])}</div>
<p class="fine">기술적 지표 ${t.votes.length}개의 요약이에요. 오를 확률이 아니고, 투자 권유가 아니에요.</p></div>
<div class="card"><div class="head"><h2>모멘텀</h2></div><div class="moms">${momentum}</div>
${groupBars(t)}
<p class="fine" style="margin:8px 0 0">단기 5거래일 ±2%, 중기 20거래일 ±5%, 장기 120거래일 ±10% 안이면 보합이에요.</p>
<details class="votes" id="votes"><summary>지표별 투표 보기</summary><div class="table-wrap"><table><thead><tr><th>지표</th><th>값</th><th>투표</th><th class="why">규칙</th></tr></thead><tbody>${rows}</tbody></table></div></details></div></div>`;
}

function kpi(icon: string, color: string, label: string, value: string, valueTone: string, hint: string): string {
  const arrow = valueTone === 'up' ? ICON.up : valueTone === 'down' ? ICON.down : '';
  return `<div class="card kpi"><div class="row"><div class="ico" style="background:${color}">${icon}</div>
<div><div class="label">${escape(label)}</div><div class="value ${valueTone}">${escape(value)}${arrow}</div></div></div>
<div class="hint">${escape(hint)}</div></div>`;
}

function kpis(report: DailyReport): string {
  const p = report.price;
  if (!p) return '<div class="card empty">아직 가격 기록이 없어요.</div>';
  const day = p.sessionDate ?? report.date;
  const vol = p.volumeRatio20;
  return `<div class="kpis" id="kpis">
${kpi(ICON.price, '#1f7a74', `종가 (${day})`, won(p.close), '', p.changePct === null ? '전일 기록 없음' : `전일 대비 ${pct(p.changePct)} (${p.change! > 0 ? '+' : ''}${Math.round(p.change!).toLocaleString('ko-KR')}원)`)}
${kpi(ICON.week, '#2b6fd6', '5거래일 수익률', pct(p.return5dPct), tone(p.return5dPct), '최근 일주일 흐름')}
${kpi(ICON.month, '#7a4fb3', '20거래일 수익률', pct(p.return20dPct), tone(p.return20dPct), `20일 범위 ${won(p.low20)} ~ ${won(p.high20)}`)}
${kpi(ICON.volume, '#8a6a2c', '거래량', `${Math.round(p.volume).toLocaleString('ko-KR')}주`, '', vol === null ? '20일 평균 정보 없음' : `20일 평균 대비 ${vol.toFixed(2)}배`)}
</div>`;
}

type Bar = { date: string; open: number; high: number; low: number; close: number; volume: number };

function barsOf(report: DailyReport): Bar[] {
  if (report.recentBars?.length) return report.recentBars;
  // Older reports kept closes only: the chart then draws a line.
  return report.recentCloses.map((c) => ({ date: c.date, open: c.close, high: c.close, low: c.close, close: c.close, volume: 0 }));
}

function fallbackSvg(bars: readonly Bar[]): string {
  if (bars.length < 2) return '<p class="empty">차트를 그릴 가격 기록이 부족해요.</p>';
  const w = 800, h = 300, pad = 10;
  const closes = bars.map((b) => b.close);
  const min = Math.min(...closes), max = Math.max(...closes), span = max - min || 1;
  const pts = bars.map((b, i) => [pad + (i * (w - 2 * pad)) / (bars.length - 1), h - pad - ((b.close - min) / span) * (h - 2 * pad)] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="최근 ${bars.length}거래일 종가 ${won(min)}~${won(max)}">
<defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8834a" stop-opacity=".25"/><stop offset="1" stop-color="#a8834a" stop-opacity="0"/></linearGradient></defs>
<polygon fill="url(#fill)" points="${pts[0]![0]},${h - pad} ${line} ${pts.at(-1)![0]},${h - pad}"/>
<polyline fill="none" stroke="#a8834a" stroke-width="2" points="${line}"/></svg>`;
}

function chartCard(report: DailyReport, base: string): { html: string; script: string } {
  const bars = barsOf(report);
  const hasOhlc = Boolean(report.recentBars?.length);
  const data = JSON.stringify(bars).replace(/</g, '\\u003c');
  const markers = JSON.stringify(chartMarkers(report)).replace(/</g, '\\u003c');
  const overlays = JSON.stringify(chartOverlays(report.market)).replace(/</g, '\\u003c');
  const html = `<div class="card"><div class="head"><h2>주가 차트</h2>
<div style="display:flex;gap:8px;flex-wrap:wrap"><div class="seg" role="group" aria-label="기간">
<button type="button" data-range="21">1개월</button><button type="button" data-range="63" aria-pressed="true">3개월</button><button type="button" data-range="126">6개월</button></div>
${hasOhlc ? '<div class="seg" role="group" aria-label="차트 종류"><button type="button" data-kind="candle" aria-pressed="true">캔들</button><button type="button" data-kind="line">라인</button></div>' : ''}</div></div>
<div class="overlay-row" role="group" aria-label="보조선"><span class="label">보조선</span>
<button type="button" class="chip-toggle" data-overlay="ma" aria-pressed="true"><i style="background:#d97706"></i><i style="background:#7a4fb3"></i><i style="background:#00968a"></i>이동평균 20·60·120</button>
<button type="button" class="chip-toggle" data-overlay="bb" aria-pressed="false"><i style="background:#8a96a3"></i>볼린저</button>
${report.market?.structure ? '<button type="button" class="chip-toggle" data-overlay="levels" aria-pressed="false"><i style="background:#18201f"></i>지지·저항</button><button type="button" class="chip-toggle" data-overlay="fib" aria-pressed="false"><i style="background:#c07a12"></i>피보나치</button>' : ''}
${report.market?.forecasts.length ? '<button type="button" class="chip-toggle" data-overlay="forecast" aria-pressed="false"><i style="background:#8a6a37"></i>예측 범위</button>' : ''}
</div>
<div class="legend-line" id="legend">${bars.length ? `${escape(bars.at(-1)!.date)} 종가 ${escape(won(bars.at(-1)!.close))}` : ''}</div>
<div id="chart">${fallbackSvg(bars)}</div><p class="fine">■ 공시와 ● 뉴스는 중요도 보통 이상만 표시해요.</p></div>`;
  const script = `<script type="application/json" id="bars">${data}</script>
<script type="application/json" id="markers">${markers}</script>
<script type="application/json" id="overlays">${overlays}</script>
<script src="${base}${CHART_ASSET}" defer></script>
<script>
window.addEventListener('DOMContentLoaded', function () {
  var LWC = window.LightweightCharts, el = document.getElementById('chart');
  if (!LWC || !el) return;
  var bars = JSON.parse(document.getElementById('bars').textContent);
  if (bars.length < 2) return;
  el.innerHTML = '';
  var won = function (v) { return Math.round(v).toLocaleString('ko-KR') + '원'; };
  var chart = LWC.createChart(el, {
    autoSize: true,
    layout: { background: { color: 'transparent' }, textColor: '#7b7f87', fontFamily: 'inherit' },
    grid: { vertLines: { visible: false }, horzLines: { color: '#f0eadf' } },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.24 } },
    timeScale: { borderVisible: false },
    crosshair: { mode: 0 },
    localization: { locale: 'ko-KR', priceFormatter: function (v) { return Math.round(v).toLocaleString('ko-KR'); } }
  });
  var candle = chart.addCandlestickSeries({ upColor: '#e0383e', downColor: '#2b6fd6', borderVisible: false, wickUpColor: '#e0383e', wickDownColor: '#2b6fd6' });
  candle.setData(bars.map(function (b) { return { time: b.date, open: b.open, high: b.high, low: b.low, close: b.close }; }));
  var area = chart.addAreaSeries({ lineColor: '#a8834a', topColor: 'rgba(168,131,74,.25)', bottomColor: 'rgba(168,131,74,0)', lineWidth: 2, visible: false });
  area.setData(bars.map(function (b) { return { time: b.date, value: b.close }; }));
  var volume = chart.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
  chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
  volume.setData(bars.filter(function (b) { return b.volume > 0; }).map(function (b) { return { time: b.date, value: b.volume, color: b.close >= b.open ? 'rgba(224,56,62,.35)' : 'rgba(43,111,214,.35)' }; }));
  var hasOhlc = ${hasOhlc ? 'true' : 'false'};
  if (!hasOhlc) { candle.applyOptions({ visible: false }); area.applyOptions({ visible: true }); }
  var byDate = {}; bars.forEach(function (b) { byDate[b.date] = b; });
  // Filings and important news as markers, moved to the next trading day when filed on a holiday.
  var marks = JSON.parse(document.getElementById('markers').textContent), seen = {};
  var snapped = marks.map(function (m) {
    var bar = bars.find(function (b) { return b.date >= m.date; });
    return bar ? { time: bar.date, kind: m.kind } : null;
  }).filter(function (m) { if (!m || seen[m.time + m.kind]) return false; seen[m.time + m.kind] = 1; return true; })
    .sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; })
    .map(function (m) { return m.kind === 'filing'
      ? { time: m.time, position: 'aboveBar', color: '#7a4fb3', shape: 'square', text: '공시' }
      : { time: m.time, position: 'belowBar', color: '#a8834a', shape: 'circle', text: '뉴스' }; });
  candle.setMarkers(snapped); area.setMarkers(snapped);
  var legend = document.getElementById('legend');
  var show = function (b) {
    if (!b) return;
    legend.textContent = hasOhlc
      ? b.date + '  시가 ' + won(b.open) + '  고가 ' + won(b.high) + '  저가 ' + won(b.low) + '  종가 ' + won(b.close) + '  거래량 ' + b.volume.toLocaleString('ko-KR') + '주'
      : b.date + '  종가 ' + won(b.close);
  };
  show(bars[bars.length - 1]);
  chart.subscribeCrosshairMove(function (p) { show(p && p.time ? byDate[p.time] : bars[bars.length - 1]); });
  var setRange = function (n) { chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - n) - 0.5, to: bars.length - 0.5 }); };
  setRange(63);
  document.querySelectorAll('[data-range]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-range]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      setRange(Number(btn.getAttribute('data-range')));
    });
  });
  // ---- overlays ----
  var ov = JSON.parse(document.getElementById('overlays').textContent) || {};
  var closes = bars.map(function (b) { return b.close; });
  var avg = function (n) { return bars.map(function (b, i) { if (i < n - 1) return null; var s = 0; for (var j = i - n + 1; j <= i; j++) s += closes[j]; return { time: b.date, value: s / n }; }).filter(Boolean); };
  var line = function (color, width, style) { return chart.addLineSeries({ color: color, lineWidth: width || 2, lineStyle: style || 0, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }); };
  var groups = { ma: [], bb: [], levels: [], fib: [], forecast: [] };
  [[20, '#d97706'], [60, '#7a4fb3'], [120, '#00968a']].forEach(function (p) { var sr = line(p[1], 2); sr.setData(avg(p[0])); groups.ma.push(sr); });
  var bb = bars.map(function (b, i) { if (i < 19) return null; var w = closes.slice(i - 19, i + 1), m = w.reduce(function (a, c) { return a + c; }, 0) / 20; var sd = Math.sqrt(w.reduce(function (a, c) { return a + (c - m) * (c - m); }, 0) / 20); return { t: b.date, u: m + 2 * sd, l: m - 2 * sd }; }).filter(Boolean);
  var up = line('#8a96a3', 1, 2), lo = line('#8a96a3', 1, 2);
  up.setData(bb.map(function (x) { return { time: x.t, value: x.u }; })); lo.setData(bb.map(function (x) { return { time: x.t, value: x.l }; }));
  groups.bb.push(up, lo);
  var priceLines = { levels: [], fib: [] };
  var addLines = function (key) {
    if (key === 'levels') (ov.levels || []).forEach(function (l) { priceLines.levels.push(candle.createPriceLine({ price: l.price, color: l.kind === 'SUPPORT' ? '#2b6fd6' : '#e0383e', lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: l.kind === 'SUPPORT' ? '지지' : '저항' })); });
    if (key === 'fib') (ov.fib || []).forEach(function (f) { priceLines.fib.push(candle.createPriceLine({ price: f.price, color: '#c07a12', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'Fib ' + (f.ratio * 100).toFixed(1) + '%' })); });
  };
  var removeLines = function (key) { priceLines[key].forEach(function (pl) { candle.removePriceLine(pl); }); priceLines[key] = []; };
  // Weekdays only; exchange holidays are not known in advance.
  var addDays = function (iso, n) { var d = new Date(iso + 'T00:00:00Z'); while (n > 0) { d.setUTCDate(d.getUTCDate() + 1); var w = d.getUTCDay(); if (w !== 0 && w !== 6) n--; } return d.toISOString().slice(0, 10); };
  // Forecast fan: one point per weekday up to 60 sessions ahead. Volatility moves from the 20-day to the 60-day setting, so the fan meets the table at both.
  var f20 = (ov.forecasts || []).filter(function (f) { return f.horizon === 20; })[0], f60 = (ov.forecasts || []).filter(function (f) { return f.horizon === 60; })[0];
  var fanDays = 0;
  if (f20 && f60) {
    var z = 1.2815515655446004, fan = { p10: [], p50: [], p90: [] }, d = f20.baseDate;
    [['p10', -1], ['p50', 0], ['p90', 1]].forEach(function (q) { fan[q[0]].push({ time: f20.baseDate, value: f20.baseClose }); });
    for (var h = 1; h <= 60; h++) {
      d = addDays(d, 1);
      var t = Math.min(1, Math.max(0, (h - 20) / 40)), sg = f20.sigma + (f60.sigma - f20.sigma) * t, mu = f20.drift * h, sp = z * sg * Math.sqrt(h);
      fan.p10.push({ time: d, value: f20.baseClose * Math.exp(mu - sp) }); fan.p50.push({ time: d, value: f20.baseClose * Math.exp(mu) }); fan.p90.push({ time: d, value: f20.baseClose * Math.exp(mu + sp) });
    }
    fanDays = 60;
    [['p90', '#e0383e', 2, '상단 (90%)'], ['p50', '#8a6a37', 0, '예측 중앙'], ['p10', '#2b6fd6', 2, '하단 (10%)']].forEach(function (q) {
      var sr = line(q[1], q[0] === 'p50' ? 2 : 1, q[2]);
      sr.setData(fan[q[0]]);
      sr.applyOptions({ visible: false, lastValueVisible: true, title: q[3] });
      groups.forecast.push(sr);
    });
  }
  groups.bb.forEach(function (sr) { sr.applyOptions({ visible: false }); });
  document.querySelectorAll('[data-overlay]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-overlay'), on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      if (key === 'levels' || key === 'fib') { if (on) addLines(key); else removeLines(key); return; }
      groups[key].forEach(function (sr) { sr.applyOptions({ visible: on }); });
      if (key === 'forecast') chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - 63) - 0.5, to: bars.length - 0.5 + (on ? fanDays : 0) });
    });
  });
  document.querySelectorAll('[data-kind]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-kind]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      var line = btn.getAttribute('data-kind') === 'line';
      candle.applyOptions({ visible: !line }); area.applyOptions({ visible: line });
    });
  });
});
</script>`;
  return { html, script };
}

function mixCard(filings: readonly ReportedFiling[]): string {
  const counts = new Map<string, number>();
  for (const f of filings) counts.set(f.category, (counts.get(f.category) ?? 0) + 1);
  const mix = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = filings.length;
  if (!total) return '<div class="card"><div class="head"><h2>공시 구성</h2></div><p class="empty">최근 30일 공시가 없어요.</p></div>';
  const r = 60, c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = mix.map(([, n], i) => {
    const len = (n / total) * c;
    const arc = `<circle r="${r}" cx="90" cy="90" fill="none" stroke="${MIX_COLORS[i % MIX_COLORS.length]}" stroke-width="34" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 90 90)"/>`;
    offset += len;
    return arc;
  }).join('');
  const ring = `<circle r="${r}" cx="90" cy="90" fill="none" stroke="${MIX_COLORS[0]}" stroke-width="34"/>`;
  return `<div class="card"><div class="head"><h2>공시 구성</h2><span class="sub" style="margin:0">최근 30일 ${total}건</span></div>
<div class="donut"><svg viewBox="0 0 180 180" role="img" aria-label="최근 30일 공시 ${total}건의 종류별 구성">${ring}${arcs}
<text x="90" y="86" text-anchor="middle" font-size="26" font-weight="700" fill="#18201f">${total}</text><text x="90" y="108" text-anchor="middle" font-size="12" fill="#6a7673">건</text></svg>
<div class="legend">${mix.map(([cat, n], i) => `<div><i style="background:${MIX_COLORS[i % MIX_COLORS.length]}"></i>${escape(cat)} ${Math.round((n / total) * 100)}%</div>`).join('')}</div></div></div>`;
}

function filingsTable(report: DailyReport): string {
  const recent = report.recentFilings ?? report.filings;
  const fresh = new Set(report.filings.map((f) => f.receiptNo));
  if (!recent.length) return '<p class="empty">최근 30일 동안 나온 공시가 없어요.</p>';
  return `<div class="table-wrap"><table><thead><tr><th class="col-date">날짜</th><th>공시</th><th class="col-cat">종류</th><th>중요도</th><th class="col-filer">제출인</th></tr></thead><tbody>
${recent.map((f) => `<tr><td class="col-date nowrap">${escape(f.filedDate)}</td>
<td>${meta([escape(f.filedDate), escape(f.category)], 'meta m-date')}<a href="${escape(f.url)}" rel="noopener" target="_blank">${escape(f.title)}</a>${fresh.has(f.receiptNo) ? '<span class="badge b-new">새 공시</span>' : ''}<div class="why">${escape(f.why)}</div></td>
<td class="col-cat nowrap">${escape(f.category)}</td><td><span class="badge b-${f.importance}">${IMPORTANCE_LABEL[f.importance]}</span></td><td class="col-filer nowrap">${escape(f.filer)}</td></tr>`).join('')}
</tbody></table></div>`;
}

const kstDate = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10);
const kstTime = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(5, 16).replace('T', ' ');
const SOURCE_LABEL: Record<string, string> = { 'naver:news-search': '네이버 뉴스', 'google:news-rss': 'Google 뉴스', 'rss:mk-economy': '매일경제 RSS' };
const TIER_LABEL = { OFFICIAL: '공식', WIRE_BIZ: '통신·경제지', GENERAL: '일반' } as const;


const COMMENTARY_FAIL: Record<string, string> = {
  ANTHROPIC_API_KEY_MISSING: 'API 키가 설정되지 않았어요',
  NO_EVIDENCE: '해설할 근거가 없었어요',
  MAX_TOKENS: '해설이 너무 길어져 중간에 끊겼어요',
  UNPARSEABLE_OUTPUT: '해설 형식을 읽지 못했어요',
};

function whySection(report: DailyReport): string {
  const c = report.commentary;
  if (!c) return '';
  if (c.status !== 'OK') {
    const reason = c.error ? (COMMENTARY_FAIL[c.error] ?? (c.error.startsWith('REFUSAL') ? 'AI가 해설 작성을 거절했어요' : 'AI 호출에 실패했어요')) : '';
    return `<div class="card" id="why"><div class="head"><h2>AI 위원회 해설</h2></div><p class="empty">AI 해설이 없어요${reason ? `: ${escape(reason)}` : ''}. 위의 지표와 공시, 뉴스를 직접 확인해 주세요.</p></div>`;
  }
  const byId = new Map(c.evidence.map((e) => [e.id, e]));
  const chips = (ids: readonly string[]) => ids.map((id) => {
    const e = byId.get(id);
    if (!e) return '';
    const external = e.url.startsWith('http');
    return `<a class="chip" href="${escape(e.url)}"${external ? ' rel="noopener" target="_blank"' : ''} title="${escape(e.label)}">${escape(id)}</a>`;
  }).join('');
  const list = (claims: readonly Claim[], emptyText: string) => (claims.length
    ? `<ul class="claims">${claims.map((cl) => `<li>${escape(cl.text)} <span class="chips">${chips(cl.evidenceIds)}</span></li>`).join('')}</ul>`
    : `<p class="empty">${emptyText}</p>`);
  const DESK = { MARKET: '시장', TECHNICAL: '기술', FLOW: '수급', FUNDAMENTAL: '펀더멘털', EVENT: '공시·뉴스' } as const;
  const STANCE = { BULLISH: ['강세', 'up'], BEARISH: ['약세', 'down'], NEUTRAL: ['중립', ''], INSUFFICIENT_DATA: ['근거 부족', 'muted'] } as const;
  const desks = c.desks?.length ? `<h3 class="why-h">데스크별 의견</h3><div class="desk-grid">${c.desks.map((d) => `<div class="why-col"><div class="desk-top"><b>${DESK[d.desk]}</b><span class="${STANCE[d.stance][1]}">${STANCE[d.stance][0]}</span></div><p>${escape(d.view.text)} <span class="chips">${chips(d.view.evidenceIds)}</span></p></div>`).join('')}</div>` : '';
  const red = c.redTeam ? `<div class="red-team"><h3>레드팀 반론</h3><p>${escape(c.redTeam.counterargument.text)} <span class="chips">${chips(c.redTeam.counterargument.evidenceIds)}</span></p>${c.redTeam.unresolved.length ? `<p class="why">풀리지 않은 이견: ${c.redTeam.unresolved.map(escape).join(', ')}</p>` : ''}</div>` : '';
  const SC = { BULL: ['강세 시나리오', 'bull'], BASE: ['기본 시나리오', 'unc'], BEAR: ['약세 시나리오', 'bear'] } as const;
  const scenarios = c.scenarios?.length ? `<h3 class="why-h">시나리오</h3><div class="why-grid">${(['BULL', 'BASE', 'BEAR'] as const).map((k) => {
    const sc = c.scenarios!.find((x) => x.kind === k);
    return `<div class="why-col ${SC[k][1]}"><h3>${SC[k][0]}</h3>${sc ? `<p>${escape(sc.narrative.text)} <span class="chips">${chips(sc.narrative.evidenceIds)}</span></p>
${sc.catalysts.length ? `<p class="why"><b>촉매</b> ${sc.catalysts.map(escape).join(', ')}</p>` : ''}${sc.invalidation.length ? `<p class="why"><b>무효화 조건</b> ${sc.invalidation.map(escape).join(', ')}</p>` : ''}` : '<p class="empty">근거가 있는 시나리오를 쓰지 못했어요.</p>'}</div>`;
  }).join('')}</div>` : '';
  const legend = c.evidence.map((e) => `<li><b>${escape(e.id)}</b> ${e.url.startsWith('http') ? `<a href="${escape(e.url)}" rel="noopener" target="_blank">${escape(e.label)}</a>` : escape(e.label)}</li>`).join('');
  return `<div class="card" id="why"><div class="head"><h2>AI 위원회 해설</h2><span class="sub" style="margin:0">데스크 5곳과 레드팀이 오늘 리포트의 근거만 인용해요</span></div>
${c.summary ? `<p class="headline">${escape(c.summary.text)} <span class="chips">${chips(c.summary.evidenceIds)}</span></p>` : ''}
${desks}${red}${scenarios}
${desks || scenarios ? '<h3 class="why-h">근거 정리</h3>' : ''}<div class="why-grid"><div class="why-col bull"><h3>강세 근거</h3>${list(c.bullish, '찾지 못했어요.')}</div>
<div class="why-col bear"><h3>약세 근거</h3>${list(c.bearish, '찾지 못했어요.')}</div>
<div class="why-col unc"><h3>불확실한 점</h3>${list(c.uncertain, '없어요.')}</div></div>
<h3 class="why-h">판단이 바뀔 수 있는 것</h3>${list(c.watch, '없어요.')}
${c.dataGaps.length ? `<h3 class="why-h">근거가 부족한 부분</h3><ul class="plain">${c.dataGaps.map((g) => `<li>${escape(g)}</li>`).join('')}</ul>` : ''}
<details class="more"><summary>근거 목록 ${c.evidence.length}개</summary><ul class="plain evid">${legend}</ul></details>
<p class="fine">AI(${escape(c.servedBy ?? c.model)})가 이 리포트의 근거만 보고 쓴 해설이에요. 틀릴 수 있고, 투자 권유가 아니에요.${c.dropped ? ` 근거를 대지 못한 주장 ${c.dropped}개는 뺐어요.` : ''} 프롬프트 ${escape(c.promptVersion)}.</p></div>`;
}

function newsSection(report: DailyReport): string {
  const news = report.news;
  if (!news) return '';
  const failed = news.status.filter((st) => !st.ok);
  const statusLine = news.status.map((st) => `${SOURCE_LABEL[st.source] ?? st.source} ${st.ok ? `${st.count}건` : '실패'}`).join(', ');
  const warn = failed.length
    ? `<p class="warn">일부 제한: ${failed.map((st) => escape(SOURCE_LABEL[st.source] ?? st.source)).join(', ')} 수집에 실패했어요. 이 소스의 기사는 빠져 있을 수 있어요.</p>` : '';
  const fresh = new Set(news.newIds);
  const rows = news.clusters.map((c) => {
    const others = c.articles.filter((a) => a.url !== c.url);
    return `<div class="story"><div><span class="badge b-${c.importance}">${IMPORTANCE_LABEL[c.importance]}</span> <span class="tag">${escape(c.category)}</span>${fresh.has(c.id) ? '<span class="badge b-new">새 뉴스</span>' : ''}</div>
<div class="story-title"><a href="${escape(c.url)}" rel="noopener" target="_blank">${escape(c.title)}</a></div>
<div class="why">${meta([`${escape(c.publisher)} (${TIER_LABEL[c.tier]})`, escape(kstTime(c.firstAt)), c.articles.length > 1 ? `같은 내용 기사 ${c.articles.length}건` : ''])}</div>
${others.length ? `<details class="more"><summary>다른 기사 ${others.length}건</summary><ul class="plain">${others.map((a) => `<li><a href="${escape(a.url)}" rel="noopener" target="_blank">${escape(a.title)}</a> <span class="why">${meta([escape(a.publisher), escape(kstTime(a.publishedAt))])}</span></li>`).join('')}</ul></details>` : ''}</div>`;
  }).join('');
  return `<div class="card" id="news" style="margin-top:16px"><div class="head"><h2>뉴스</h2><span class="sub" style="margin:0">최근 7일, 이야기 ${news.clusters.length}개</span></div>
${warn}${rows || '<p class="empty">최근 7일 동안 관련 뉴스가 없어요.</p>'}
<p class="fine">제목과 언론사, 링크만 모아요(본문은 저장하지 않아요). 비슷한 제목의 기사는 하나의 이야기로 묶고, 기사 수가 많다고 더 중요하게 보지 않아요. 수집: ${escape(statusLine)}</p></div>`;
}

function chartMarkers(report: DailyReport): { date: string; kind: 'filing' | 'news'; text: string }[] {
  const markers: { date: string; kind: 'filing' | 'news'; text: string }[] = [];
  for (const f of report.recentFilings ?? report.filings) if (f.importance !== 'LOW') markers.push({ date: f.filedDate, kind: 'filing', text: f.title });
  for (const c of report.news?.clusters ?? []) if (c.importance !== 'LOW') markers.push({ date: kstDate(c.firstAt), kind: 'news', text: c.title });
  return markers;
}

const TAB_SCRIPT = `<script>
(function () {
  var panels = Array.prototype.slice.call(document.querySelectorAll('[role=tabpanel]'));
  if (!panels.length) return;
  document.documentElement.classList.add('js-tabs');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role=tab]'));
  function show(id, focus) {
    var panel = document.getElementById(id);
    if (!panel || panel.getAttribute('role') !== 'tabpanel') return false;
    panels.forEach(function (p) { p.hidden = p !== panel; });
    tabs.forEach(function (t) { var on = t.getAttribute('aria-controls') === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      var on = a.getAttribute('data-nav') === id.replace('tab-', '');
      a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    window.dispatchEvent(new Event('resize'));
    return true;
  }
  function route() {
    var id = (location.hash || '#tab-overview').slice(1);
    // A tab hash would otherwise scroll past the hero; start the tab from the top.
    if (show(id)) { window.scrollTo(0, 0); setTimeout(function () { window.scrollTo(0, 0); }, 0); return; }
    // An anchor inside a panel (e.g. #filings): open its panel, then scroll to it.
    var el = document.getElementById(id), panel = el && el.closest('[role=tabpanel]');
    if (panel && show(panel.id)) el.scrollIntoView(); else show('tab-overview');
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var next = tabs[(i + d + tabs.length) % tabs.length];
      history.replaceState(null, '', '#' + next.getAttribute('aria-controls'));
      show(next.getAttribute('aria-controls'), true);
    });
  });
  window.addEventListener('hashchange', route);
  route();
})();
</script>`;

export function renderReport(report: DailyReport, links: { index: string; base?: string }): string {
  const base = links.base ?? '../';
  const chart = chartCard(report, base);
  const m = report.market;
  const hasWhy = Boolean(report.commentary);
  const tabs = TABS.filter((t) => t.key !== 'ai' || hasWhy);
  const notes = report.notes.length ? `<ul class="plain">${report.notes.map((n) => `<li>${escape(n)}</li>`).join('')}</ul>` : '<p class="empty">눈에 띄는 가격·거래량 신호는 없어요.</p>';
  const changes = report.changes?.length ? `<ul class="plain">${report.changes.map((c) => `<li>${escape(c)}</li>`).join('')}</ul>` : '<p class="empty">이 리포트에는 비교 기록이 없어요.</p>';
  const c = report.commentary;
  const aiTeaser = c?.status === 'OK' && c.summary
    ? `<div class="card ai-teaser"><div class="head"><h2>AI 한 줄 해설</h2><a href="#tab-ai" class="more-link">자세히 보기</a></div><p class="headline">${escape(c.summary.text)}</p></div>` : '';
  const panel = (key: TabKey, html: string) => `<section class="panel" id="tab-${key}" role="tabpanel" aria-labelledby="t-${key}" tabindex="-1"><h2 class="panel-title">${TABS.find((t) => t.key === key)!.label}</h2>${html}</section>`;
  const overview = `${m ? horizonRow(m.horizons) : ''}
<div style="margin-top:16px">${kpis(report)}</div>
${m ? `<div class="grid-eq">${valueCard(m)}${forecastCard(m.forecasts, m.forecastScores)}</div>` : ''}
${aiTeaser}
<div class="grid-eq"><div class="card"><div class="head"><h2>오늘의 요약</h2></div><p class="headline">${escape(report.headline)}</p>${notes}</div>
<div class="card"><div class="head"><h2>어제 대비 바뀐 점</h2></div>${changes}</div></div>`;
  const chartTab = `${chart.html}<div style="margin-top:16px">${signalSection(report)}</div>${m ? structureCard(m.structure, m.weeklyStructure) : ''}`;
  const flowsTab = m ? flowsPanel(m.flows, m.footprint) : '<div class="card empty">이 리포트에는 수급 기록이 없어요.</div>';
  const fundTab = m ? fundamentalsPanel(m, report.price?.close ?? null) : '<div class="card empty">이 리포트에는 펀더멘털 기록이 없어요.</div>';
  const newsTab = `${newsSection(report)}
<div class="grid2"><div class="card" id="filings"><div class="head"><h2>공시</h2><span class="sub" style="margin:0">최근 30일, 제목을 누르면 DART 원문이 열려요</span></div>${filingsTable(report)}</div>${mixCard(report.recentFilings ?? report.filings)}</div>`;
  const body = `<div class="top"><div class="ticker">${escape(report.name)} <span>${escape(report.symbol)}</span><span>KOSPI</span></div>
<div class="stamp">${escape(report.date)} 리포트<br>생성 ${escape(report.generatedAt.replace('T', ' ').slice(0, 16))} UTC</div></div>
<section class="hero"><div class="orb" aria-hidden="true"></div><div class="eyebrow">일일 리서치 리포트</div>
<h1>${escape(report.name)}</h1><p class="sub">${escape(report.headline)}</p>
${report.price ? `<div class="hero-meta"><span>종가 <b>${escape(won(report.price.close))}</b></span>${report.price.changePct === null ? '' : `<span class="${tone(report.price.changePct)}">${escape(pct(report.price.changePct))}</span>`}${m?.horizons ? `<span>중기 신호 <b>${escape(m.horizons.find((h) => h.key === 'MEDIUM')?.summary.label ?? '')}</b></span>` : ''}${m?.fairValue ? `<span>기술적 적정가 <b>${escape(won(m.fairValue.center))}</b></span>` : ''}</div>` : ''}</section>
${m ? marketStatusWarning(m) : ''}
<div class="tabs" role="tablist" aria-label="리포트 탭">${tabs.map((t, i) => `<a role="tab" id="t-${t.key}" href="#tab-${t.key}" aria-controls="tab-${t.key}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ''}>${t.label}</a>`).join('')}</div>
${panel('overview', overview)}
${panel('chart', chartTab)}
${panel('flows', flowsTab)}
${panel('fundamentals', fundTab)}
${hasWhy ? panel('ai', whySection(report)) : ''}
${panel('news', newsTab)}
<footer id="sources"><p>데이터: Naver 금융 일봉·주봉·분봉(가격), 네이버 증권(수급·밸류에이션·실적·증권사 리포트 목록), OpenDART(공시), 네이버 뉴스 검색과 RSS(뉴스).</p><p>수집 기록은 고쳐 쓰지 않고 쌓아요. 적정가와 예측 범위는 계산 결과이고, 투자 권유가 아니에요. <a href="${escape(links.index)}">지난 리포트 보기</a></p></footer>`;
  return shell('today', base, `${report.name} ${report.date} 일일 리포트 | GNM`, body, chart.script + TAB_SCRIPT, '#tab-overview', hasWhy);
}

export function renderIndex(reports: readonly Pick<DailyReport, 'date' | 'headline' | 'name' | 'status'>[]): string {
  const sorted = [...reports].sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = sorted[0];
  const body = `<div class="top"><div class="ticker">SK하이닉스 <span>000660</span><span>KOSPI</span></div><div class="stamp">리포트 ${sorted.length}건</div></div>
<section class="hero" id="latest"><div class="orb" aria-hidden="true"></div><div class="eyebrow">일일 리서치 리포트</div><h1>SK하이닉스</h1><p class="sub">평일 장 마감 뒤(18:30 KST) 자동으로 만들어져요. 공개 데이터와 계산 규칙, 근거를 인용하는 AI 해설로 써요.</p></section>
${latest ? `<div class="card"><div class="head"><h2>최신 리포트 (${escape(latest.date)})</h2><a href="reports/${escape(latest.date)}.html" class="badge b-new" style="text-decoration:none;font-size:14px;padding:6px 14px">열기</a></div><p class="headline">${escape(latest.headline)}</p></div>` : '<div class="card empty">아직 리포트가 없어요.</div>'}
<div class="card" id="archive" style="margin-top:16px"><div class="head"><h2>지난 리포트</h2></div><div class="table-wrap"><table><thead><tr><th>날짜</th><th>요약</th><th>거래</th></tr></thead><tbody>
${sorted.map((r) => `<tr><td style="white-space:nowrap"><a href="reports/${escape(r.date)}.html">${escape(r.date)}</a></td><td>${escape(r.headline)}</td><td>${r.status === 'SESSION' ? '거래일' : '휴장'}</td></tr>`).join('')}
</tbody></table></div></div>
<footer id="sources"><p>데이터: Naver 금융 일봉(가격), OpenDART(공시), 네이버 뉴스 검색과 RSS(뉴스).</p><p>투자 권유가 아니에요.</p></footer>`;
  // The index has no filings section; link to the latest report's.
  return shell('archive', '', 'SK하이닉스 일일 리포트 | Gnomon Analytics', body, '', latest ? `reports/${escape(latest.date)}.html#tab-overview` : '#archive', Boolean(latest && (latest as Partial<DailyReport>).commentary));
}
