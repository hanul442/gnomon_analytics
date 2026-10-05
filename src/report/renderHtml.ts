// Pages: the live dashboard (rebuilt every run), dated reports, and the archive.
// Look: BLACK ORACLE mobile mockup v1 tone (docs/DESIGN.md G-15). The price chart
// uses TradingView Lightweight Charts v5, served from our own site.

import type { DailyReport, ReportedFiling } from './dailyReport.js';
import type { TechnicalSummary } from '../analysis/technicals.js';
import type { Claim, Commentary } from '../analysis/commentary.js';
import { apiMeta, ALPHA_CSS, ALPHA_SCRIPT } from './alpha.js';
import { CHAT_CSS, CHAT_HTML, CHAT_SCRIPT } from './chat.js';
import { chartOverlays, flowsPanel, forecastCard, fundamentalsPanel, horizonRow, horizonStrip, marketStatusWarning, structureCard, valueCard } from './renderMarket.js';
import { councilCard, DART_SCRIPT, freshness, freshnessBadge, hero, latestLists, marketStrip, priceChart, sparkline } from './appParts.js';
import { analystScores, arenaHeadline, arenaPanel, arenaRanking, arenaTeaser } from './renderArena.js';
import { parliament, PARLIAMENT_SCRIPT } from './renderParliament.js';
import { ACCOUNT_SCRIPT, CREDIT_COST, EXPERTS, gate, PLAN_BOOT, PLAN_CSS } from './plans.js';
import { priceBar, UI_CSS, UI_SCRIPT } from './ui.js';
import { decisionTrace, EXTRAS_CSS, kindChip, weekDiffSection } from './renderReportExtras.js';
import { CHART_V6_CSS } from './chartTools.js';

export const CHART_ASSET = 'assets/lightweight-charts.js';
/** Pretendard web font, also served from our own site. */
export const FONT_DIR = 'assets/fonts';

const escape = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const won = (value: number): string => `${Math.round(value).toLocaleString('ko-KR')}원`;
const pct = (value: number | null): string => (value === null ? '없음' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`);
const tone = (value: number | null): string => (value === null || value === 0 ? '' : value > 0 ? 'up' : 'down');
const IMPORTANCE_LABEL = { HIGH: '중요', MEDIUM: '보통', LOW: '참고' } as const;
const MIX_COLORS = ['#243659', '#34496f', '#8fa5c3', '#becbdc', '#6b6f78', '#dde4ee'];
/** Meta details as separate items (spacing, not "·" chains). */
const meta = (parts: readonly string[], cls = 'meta'): string => `<span class="${cls}">${parts.filter(Boolean).map((part) => `<span>${part}</span>`).join('')}</span>`;

const ICON = {
  logo: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M16 16 L16 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M16 16 L25 21" stroke="#8fb0e8" stroke-width="2.4" stroke-linecap="round"/></svg>',
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
:root{--page:#f3f5f8;--surface:#ffffff;--soft:#f7f9fc;--line:#e1e6ee;--line-strong:#cbd3df;--fg:#0f1b2d;--fg2:#3a4558;--muted:#6b7686;--navy:#0f2244;
--accent:#1d3a6e;--accent-strong:#132a52;--accent-soft:#e8eef7;--brand-grad:linear-gradient(135deg,#25497f 0%,#132a52 100%);
--up:#d1373d;--down:#2a62c9;--warn:#b07a1e;--focus:#1d3a6e;--brand-serif:"Noto Serif KR","Nanum Myeongjo","AppleMyungjo",serif;--serif:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;--ease-out:cubic-bezier(.16,1,.3,1);--shadow:0 1px 2px rgba(22,27,38,.04),0 6px 20px rgba(22,27,38,.04)}
*{box-sizing:border-box}html{color-scheme:light}html,body{margin:0}body{background:var(--page);color:var(--fg);
font:15px/1.6 "Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;-webkit-font-smoothing:antialiased;word-break:keep-all;overflow-wrap:anywhere}
a{color:inherit}button,a{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.skip{position:absolute;left:16px;top:16px;z-index:50;background:var(--brand-grad);color:#fff;padding:8px 14px;border-radius:999px;font-weight:600;text-decoration:none;transform:translateY(-200%);transition:transform 150ms var(--ease-out)}.skip:focus{transform:none}
[id]{scroll-margin-top:120px}h1,h2,h3{text-wrap:balance}p,li{text-wrap:pretty}
.up{color:var(--up)}.down{color:var(--down)}.muted{color:var(--muted)}.small{font-size:12px}.empty{color:var(--muted)}
/* header + chip tabs */
.topbar{position:sticky;top:0;z-index:30;background:var(--navy);border-bottom:1px solid #0a1832;color:#fff}
.topbar-in{max-width:1180px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#fff}.brand svg{width:28px;height:28px}
.brand b{display:block;font-family:var(--brand-serif);font-weight:600;font-size:19px;letter-spacing:.18em;line-height:1.1}.brand small{display:block;font-size:10px;color:#9fb6dc;letter-spacing:.12em}
.top-links{display:flex;gap:4px;font-size:13px}.top-links a{text-decoration:none;color:rgba(255,255,255,.82);padding:6px 10px;border-radius:999px}.top-links a:hover{background:rgba(255,255,255,.1);color:#fff}
.chips{max-width:1180px;margin:0 auto;padding:0 24px 10px;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.chips a{flex:none;padding:7px 15px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600;color:rgba(255,255,255,.78);border:1px solid transparent;transition:background-color 150ms var(--ease-out),color 150ms var(--ease-out)}
.chips a:hover{background:rgba(255,255,255,.1);color:#fff}.chips a[aria-selected=true]{background:#fff;color:var(--navy)}
main{max-width:1180px;margin:0 auto;padding:20px 24px 64px;min-width:0}
/* hero */
.hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:20px;align-items:center;padding:30px 32px;border-radius:20px;border:1px solid var(--line);background:#fff;box-shadow:var(--shadow)}
.orb{display:none;position:absolute;right:28%;top:-60px;width:260px;height:260px;border-radius:50%;pointer-events:none;opacity:.55;
background:radial-gradient(circle at 34% 30%,#fff 0%,#eff3f8 22%,#c3cfdf 52%,#8099bb 78%,#2d3f61 100%);box-shadow:inset -20px -26px 44px rgba(25,42,74,.25),0 18px 40px rgba(36,54,89,.18)}
.orb::after{content:"";position:absolute;inset:18% 30% 52% 22%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.95),rgba(255,255,255,0) 70%)}
.hero-main,.key-points{position:relative}.eyebrow{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;font-weight:600;color:var(--accent-strong)}
.hero h1{font-family:var(--serif);font-weight:600;font-size:40px;line-height:1.15;margin:6px 0 10px;letter-spacing:-.01em}
.hero-price{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 14px}.hero-price b{font-size:34px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}.hero-price span{font-weight:600;font-variant-numeric:tabular-nums}
.hero-sub{font-size:12px;color:var(--muted);margin-top:2px}.hero-line{margin:14px 0 0;color:var(--fg2);max-width:60ch}
.key-points{background:rgba(255,255,255,.82);border:1px solid var(--line);border-radius:16px;padding:16px 18px}
.kp-title{font-family:var(--serif);font-weight:600;margin-bottom:6px}.key-points ul{list-style:none;margin:0;padding:0}
.key-points li{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--line);font-size:14px}.key-points li:first-child{border-top:0}.key-points li span{color:var(--muted)}
/* blocks, cards */
.block{margin-top:26px}.block-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:10px}
.block-head h2,.card h2,.panel-title{font-family:var(--serif);font-weight:600;font-size:19px;margin:0}
.more-link{font-size:13px;color:var(--accent-strong);text-decoration:none;font-weight:600}.more-link:hover{text-decoration:underline}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px 20px;min-width:0;box-shadow:var(--shadow)}
.head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}.sub{color:var(--muted);margin:0}
.grid2{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px;margin-top:16px}.grid-eq{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:16px}.grid2.tight{margin-top:0}
.grid-eq>.block{margin-top:0}
/* market strip */
.strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.strip-item{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:grid;grid-template-columns:1fr auto;grid-template-areas:"n s" "v s" "c s";column-gap:10px;box-shadow:var(--shadow)}
.si-name{grid-area:n;font-size:13px;color:var(--muted)}.si-value{grid-area:v;font-size:19px;font-weight:700;font-variant-numeric:tabular-nums}.si-change{grid-area:c;font-size:13px;font-weight:600}
.spark{width:110px;height:44px;align-self:center}.strip-item .spark{grid-area:s}
/* council */
.council-top{display:flex;gap:18px;align-items:center}.ring{width:96px;height:96px;flex:none}.ring-num{font-family:var(--serif);font-size:22px;font-weight:600;fill:var(--fg)}
.council-label{font-family:var(--serif);font-size:20px;font-weight:600}.council p{margin:4px 0}
.dbars{display:flex;gap:10px;align-items:flex-end;justify-content:space-between;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}
.dbar{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px}.dbar-v{font-weight:700;font-variant-numeric:tabular-nums}
.dbar-track{width:16px;height:64px;background:#e2e8f1;border-radius:6px;display:flex;align-items:flex-end;overflow:hidden}.dbar-track i{display:block;width:100%;border-radius:6px}
.dbar-track i.bull{background:linear-gradient(#e7a3a5,var(--up))}.dbar-track i.bear{background:linear-gradient(#a9c0ec,var(--down))}.dbar-track i.neu{background:linear-gradient(#c5d0e0,#7c95b9)}.dbar-k{color:var(--muted);white-space:nowrap}
.debate{margin-top:12px;padding:10px 12px;border-radius:12px;background:#fdf1f0;border:1px solid #f4d4d2;font-size:14px}.debate b{color:#b4232a;margin-right:6px}
/* lists */
.list{padding:6px 18px}.row-item{display:flex;gap:10px;align-items:flex-start;padding:11px 0;border-top:1px solid var(--line)}.row-item:first-child{border-top:0}
.ri-main{min-width:0}.ri-main a{text-decoration:none;font-weight:600}.ri-main a:hover{text-decoration:underline}
.badge{display:inline-block;font-size:12px;border-radius:999px;padding:1px 9px;white-space:nowrap;flex:none}
.b-HIGH{background:#fde8e6;color:#b4232a}.b-MEDIUM{background:#fdf3e1;color:var(--warn)}.b-LOW{background:#e8ecf1;color:var(--muted)}.b-new{background:var(--accent-soft);color:var(--accent-strong);margin-left:6px;border:1px solid #becbdc}
/* chart */
.chart-card{margin-top:4px}.chart-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.cur-price{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}.cur-price b{font-size:30px;font-variant-numeric:tabular-nums}.cur-price span{font-weight:600;font-variant-numeric:tabular-nums}
.period-stat{display:flex;flex-wrap:wrap;gap:2px 14px;font-size:13px;color:var(--fg2);margin-top:4px;font-variant-numeric:tabular-nums}.period-stat b{font-size:15px}
.seg{display:inline-flex;flex-wrap:wrap;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:3px;gap:2px}
.seg button{border:0;background:none;padding:6px 12px;border-radius:999px;font:inherit;font-size:13px;color:var(--fg2);cursor:pointer;transition:background-color 150ms var(--ease-out),color 150ms var(--ease-out)}
.seg button:hover{background:var(--accent-soft)}.seg button[aria-pressed=true]{background:var(--brand-grad);color:#fff}
.ind-menu{margin:4px 0 8px;border:1px solid var(--line);border-radius:12px;padding:8px 12px;background:var(--soft)}.ind-menu summary{cursor:pointer;font-weight:600;font-size:14px;color:var(--accent-strong)}
.ind-group{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}.ind-group .label{font-size:12px;color:var(--muted);width:56px}
.chip-toggle{border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:4px 11px;font:inherit;font-size:12px;color:var(--fg2);cursor:pointer;transition:background-color 150ms var(--ease-out),color 150ms var(--ease-out)}
.chip-toggle:hover{color:var(--fg)}.chip-toggle[aria-pressed=true]{background:var(--accent-soft);color:var(--accent-strong);border-color:#a5b6ce;font-weight:600}
.legend-line{font-size:12px;color:var(--muted);min-height:18px;font-variant-numeric:tabular-nums;margin:4px 0}
#chart{position:relative;transition:height 200ms var(--ease-out)}
.mark-pop{position:absolute;top:38px;z-index:5;max-height:300px;overflow:auto;border:1px solid var(--line-strong);border-radius:12px;background:#fff;padding:10px 12px;box-shadow:0 8px 24px rgba(22,27,38,.16)}.mp-body{min-width:0}.mp-title{font-weight:600;font-size:14px;line-height:1.4}.mp-meta{font-size:12px;color:var(--muted);margin-top:2px}.mp-meta a{color:var(--accent-strong);font-weight:600}
.mp-head{display:flex;justify-content:space-between;font-weight:600;margin-bottom:6px}.mp-head button{border:0;background:none;font-size:18px;cursor:pointer;color:var(--muted)}
.mp-row{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-top:1px solid var(--line)}.mp-row a{font-weight:600;text-decoration:none}.mp-row a:hover{text-decoration:underline}
.fine{color:var(--muted);font-size:12px;margin:10px 0 0}
/* technical pieces */
.grid-signal{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:16px;margin:16px 0}
.signal{text-align:center}.gauge{width:100%;max-width:260px;display:block;margin:0 auto}.signal-label,.hz-label,.big{font-family:var(--serif)}.signal-label{font-size:24px;font-weight:600;margin:4px 0}
.reason{margin:6px 0;font-size:14px}.tally{color:var(--muted);font-size:13px}
.meta{display:inline-flex;flex-wrap:wrap;gap:2px 12px}.m-date.meta{display:none}
.moms{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.mom{background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.mom .k{color:var(--muted);font-size:12px}.mom .v{font-size:18px;font-weight:700;margin:2px 0}
.gbars{display:grid;gap:12px;margin-top:16px}.gtitle{display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-bottom:6px}
.track{display:flex;height:10px;border-radius:999px;overflow:hidden;background:#e2e8f1;gap:2px}.track i{display:block;height:100%}
.track i.v-BULLISH{background:#e5484d}.track i.v-BEARISH{background:#3b7be0}.track i.v-NEUTRAL{background:#b6c0cf}.track i.b-LOW{background:#dee5ef}
.votes{margin-top:14px}.votes td{padding:8px}.votes summary,.more summary{cursor:pointer;color:var(--accent-strong);font-weight:600;font-size:14px}
.num{font-variant-numeric:tabular-nums;white-space:nowrap}.v-BULLISH{background:#fde8e6;color:#b4232a}.v-BEARISH{background:#e3ecfb;color:#1d4fa3}.v-NEUTRAL{background:#e8ecf1;color:var(--muted)}.nowrap{white-space:nowrap}
.hz-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.hz{background:var(--soft);border:1px solid var(--line);border-radius:14px;padding:10px 12px;text-align:center}
.hz-top{display:flex;justify-content:space-between;align-items:baseline;font-size:13px}.hz-top span{color:var(--muted);font-size:12px}
.mini-gauge{width:100%;max-width:150px;display:block;margin:4px auto 0}.hz-label{font-weight:600;font-size:17px}.hz-meta{display:flex;justify-content:center;flex-wrap:wrap;gap:0 10px;color:var(--muted);font-size:12px}
.value-head{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:6px}.value-head .label,.facts .label,.kpi .label{display:block;color:var(--muted);font-size:12px}
.big{font-size:26px;font-weight:600;font-variant-numeric:tabular-nums}.mid{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}
.value-strip{width:100%;height:auto;display:block;margin:6px 0}.value-strip text{font-size:11px;fill:var(--muted)}.vs-axis{stroke:var(--line);stroke-width:2}
.vs-band{fill:var(--accent-soft);stroke:#a5b6ce}.vs-center line{stroke:var(--accent);stroke-width:2}.vs-close line{stroke:var(--fg);stroke-width:3}.vs-cons line{stroke:#7a4fb3;stroke-width:2;stroke-dasharray:3 3}.vs-p50 line{stroke:#d97706;stroke-width:2;stroke-dasharray:3 3}
.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:10px}.facts.one{grid-template-columns:1fr;margin-top:10px}.facts b{font-variant-numeric:tabular-nums}
.race{padding:6px 18px}.race-row{display:grid;grid-template-columns:44px minmax(0,1.4fr) 140px repeat(3,minmax(0,.6fr)) auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}.race-row:first-of-type{border-top:0}
.race-row.is-champ{background:linear-gradient(90deg,rgba(146,167,196,.16),rgba(255,255,255,0));border-radius:12px}
.race-name{display:flex;flex-direction:column;min-width:0}.race-num{display:flex;flex-direction:column;align-items:flex-end;font-variant-numeric:tabular-nums}.race-sig{text-align:right}
.race .spark{width:140px;height:40px}.race-mini .race-row{grid-template-columns:44px minmax(0,1.4fr) 140px minmax(0,.6fr) auto}.rank{display:inline-flex;align-items:center;gap:2px;color:var(--muted);font-variant-numeric:tabular-nums}.rank b{font-size:15px}
.crown{width:16px;height:16px;vertical-align:-2px}.rank.r1{color:#34496f}.rank.r2{color:#9aa1ab}.rank.r3{color:#31466d}.champion h2 .crown{color:#34496f;width:18px;height:18px}
.champ-grid{display:grid;grid-template-columns:180px minmax(0,1fr);gap:18px;align-items:center}.champ-grid>div:first-child{text-align:center}.champ-grid .mini-gauge{max-width:170px}.rule{margin:0 0 4px;font-weight:600}
.arena-gauges{grid-template-columns:repeat(4,minmax(0,1fr))}.trig{margin-top:4px;line-height:1.4}
.analyst-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.analyst{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 16px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:8px}
.an-top{display:flex;gap:10px;align-items:center}.an-name{flex:1;min-width:0;display:flex;flex-direction:column}.avatar{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;flex:none;font-family:var(--serif);font-weight:600;color:#fff;background:var(--brand-grad)}
.an-nums{display:grid;grid-template-columns:1fr 1fr;gap:10px}.an-nums .label{display:block;font-size:12px;color:var(--muted)}.an-nums b{font-variant-numeric:tabular-nums;margin-right:6px}
.conf{height:5px;background:#e2e8f1;border-radius:999px;margin-top:4px;overflow:hidden}.conf i{display:block;height:100%;background:var(--brand-grad)}.an-why{margin:0;font-size:14px;color:var(--fg2)}
.chart-wrap{position:relative}.chart-body{position:relative}
.ev-strip{position:relative;height:34px;border-bottom:1px dashed var(--line)}
.ev-icon{position:absolute;top:3px;width:28px;height:28px;margin-left:-14px;display:grid;place-items:center;border-radius:50%;border:1.5px solid currentColor;background:#fff;color:#2e4268;padding:0;cursor:pointer;box-shadow:0 1px 3px rgba(22,27,38,.12);transition:transform .12s ease,background .12s ease}
.ev-icon svg{width:15px;height:15px}.ev-icon b{position:absolute;top:-6px;right:-7px;min-width:16px;height:16px;border-radius:8px;background:currentColor;font-size:10px;line-height:16px;text-align:center;padding:0 3px}
.ev-icon b{color:#fff}.ev-icon b{background:#2e4268}.ev-icon.news b{background:#00968a}.ev-icon.both b{background:#6b6f78}
.ev-icon:hover,.ev-icon[aria-expanded="true"]{transform:translateY(-1px);background:#eff3f8}.ev-icon:focus-visible{outline:2px solid #161b26;outline-offset:2px}
.ev-icon.news{color:#00968a}.ev-icon.both{color:#6b6f78}
.vlines{position:absolute;left:0;top:0;width:100%;height:0;pointer-events:none}
.vline{position:absolute;top:0;width:0;border-left:1.5px dashed #2e4268;opacity:.7}.vline.news{border-left-color:#00968a}.vline.both{border-left-color:#6b6f78}
.strat-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0}.strat-row .label{font-size:12px;color:var(--muted);margin-right:2px}
.strat-info{border:1px solid var(--line);background:var(--soft);border-radius:12px;padding:10px 14px;margin:6px 0 8px}.strat-info p{margin:4px 0;font-size:14px}.si-head{display:flex;gap:8px;align-items:center}
.see-chart{display:block;font-size:12px;color:var(--accent-strong);text-decoration:none;margin-top:4px;white-space:nowrap}.see-chart:hover{text-decoration:underline}
.trade-log{border-top:1px solid var(--line);padding:8px 0}.trade-log:first-of-type{border-top:0}.trade-log summary{cursor:pointer;font-weight:600;font-size:14px}.trade-log td,.trade-log th,.strat-info td,.strat-info th{white-space:nowrap}
.stock-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.stock-card{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:inherit;transition:box-shadow .15s ease,transform .15s ease}.stock-card:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(22,27,38,.1)}
.sc-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.sc-name{font-weight:700;font-size:20px}
.sc-price{display:flex;align-items:baseline;gap:10px;font-variant-numeric:tabular-nums}.sc-price b{font-size:24px}.sc-signal{display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:8px;margin-top:4px;font-size:14px}.sc-signal span{color:var(--muted)}
.sc-line{margin:2px 0 0;font-size:14px;color:var(--muted)}.sc-why{margin:2px 0 0;padding-left:18px;font-size:13px;color:var(--fg2)}.sc-why li{margin:1px 0}.sel-note{margin:-4px 2px 10px}.sc-go{margin-top:auto;padding-top:6px;color:var(--accent-strong);font-weight:600;font-size:13px}
.nowrap-cells td,.nowrap-cells th{white-space:nowrap}.paper-list{display:flex;flex-direction:column}.paper-row{display:grid;grid-template-columns:minmax(0,1.6fr) 140px minmax(0,1fr) minmax(0,1.2fr);gap:14px;align-items:center;padding:12px 10px;border-top:1px solid var(--line)}.paper-row:first-child{border-top:0}
.paper-row.is-champ{background:var(--accent-soft);border-radius:12px}.pr-name,.pr-num{display:flex;flex-direction:column;gap:2px;min-width:0}.pr-num b{font-size:17px;font-variant-numeric:tabular-nums}.pr-num .badge{align-self:flex-start}
@media (max-width:820px){.paper-row{grid-template-columns:minmax(0,1fr) auto;gap:8px 12px}.paper-row .spark{display:none}}
.search-box{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line-strong);border-radius:14px;padding:0 16px;box-shadow:var(--shadow)}.search-box:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.search-box svg{width:20px;height:20px;color:var(--muted);flex:none}.search-box input{flex:1;min-width:0;border:0;outline:0;background:none;font:inherit;font-size:16px;padding:14px 0;color:var(--fg)}
.search-results{margin-top:8px}.sr-row{align-items:center;gap:12px}.sr-row .ri-main{flex:1}.sr-price{font-variant-numeric:tabular-nums;font-size:14px;white-space:nowrap}.sr-go{font-weight:600;color:var(--accent);text-decoration:none;white-space:nowrap;font-size:14px}.sr-go:hover{text-decoration:underline}.search-note{margin:8px 2px 0}
@media (max-width:820px){.sr-price{display:none}}
.pl-card{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:22px;align-items:start}
.pl-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}.pl-figure{position:relative;max-width:470px;margin:0 auto}
.pl-svg{display:block;width:100%;height:auto;overflow:visible}
.seat{cursor:pointer;stroke:#fff;stroke-width:.6;transition:opacity .2s ease,transform .2s ease;transform-box:fill-box;transform-origin:center;animation:seat-in .45s cubic-bezier(.16,1,.3,1) backwards;animation-delay:calc(var(--i) * 22ms)}
.seat.s-bull{fill:#d1373d}.seat.s-neutral{fill:#a3acba}.seat.s-bear{fill:#2a62c9}.seat.s-abstain{fill:#fff;stroke:#a3acba;stroke-width:.9}
.seat.f-ai,.seat.f-desk{stroke:#0f2244;stroke-width:1.1}
.seat:hover,.seat:focus-visible{transform:scale(1.25);outline:none}.seat.is-on{transform:scale(1.35);stroke:#0f2244;stroke-width:1.6}.seat.is-dim{opacity:.15}
@keyframes seat-in{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.seat{animation:none;transition:none}}
.pl-center{position:absolute;left:50%;bottom:4px;transform:translateX(-50%);text-align:center;display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none}
.pl-center b{font-size:22px;font-weight:800;letter-spacing:-.01em}.pl-center span{font-size:13px;color:var(--fg2);font-variant-numeric:tabular-nums;white-space:nowrap}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin:0 3px 0 6px;vertical-align:0}.dot.s-bull{background:#d1373d}.dot.s-neutral{background:#a3acba}.dot.s-bear{background:#2a62c9}.dot.s-abstain{border:1.5px solid #a3acba}
.pl-detail{border-left:1px solid var(--line);padding-left:20px;min-height:180px}.pl-detail p{margin:6px 0;font-size:14px;line-height:1.6}
.why-fold{margin-top:14px}.why-fold>summary{font-weight:600}
.pl-small .pl-figure{max-width:400px}.pl-small .pl-center{bottom:10px}.pl-small .seat.is-on{transform:scale(1.15)}.pl-small .seat:hover{transform:scale(1.1)}
.pl-tally{display:flex;gap:2px;height:8px;border-radius:4px;overflow:hidden;margin:20px 0 4px}.pl-tally .s-bull{background:#d1373d}.pl-tally .s-neutral{background:#a3acba}.pl-tally .s-bear{background:#2a62c9}
.pl-roster{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:12px}
.pl-col{display:flex;flex-direction:column;gap:6px}.pl-col-h{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--fg2);padding-bottom:4px;border-bottom:1px solid var(--line)}.pl-col-h b{margin-left:auto;font-variant-numeric:tabular-nums}
.member{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px;padding:8px 10px;border:1px solid var(--line);border-left:4px solid #a3acba;border-radius:8px;background:var(--card);font:inherit;font-size:14px;text-align:left;cursor:pointer;color:var(--fg);transition:background .15s ease,border-color .15s ease,opacity .2s ease}
.member.s-bull{border-left-color:#d1373d}.member.s-bear{border-left-color:#2a62c9}.member.s-abstain{border-left-style:dashed}
.member:hover{background:#f4f6fa}.member:focus-visible{outline:2px solid #0f2244;outline-offset:2px}.member.is-on{background:#eef2fa;border-color:#0f2244}.member.is-dim{opacity:.3}
.m-name{font-weight:600;line-height:1.3}
@media (max-width:560px){.pl-roster{grid-template-columns:minmax(0,1fr)}.pl-col{flex-direction:row;flex-wrap:wrap}.pl-col-h{flex-basis:100%}.member{flex:1 1 calc(50% - 6px);min-width:0}.m-kind{display:none}}.m-kind{flex:none;font-size:11px;color:var(--muted);background:#eef1f5;border-radius:999px;padding:2px 7px}.pl-k{font-size:12px;font-weight:600;color:var(--muted);letter-spacing:.02em}.pl-name{display:flex;align-items:center;gap:8px;margin:4px 0 2px;font-size:17px}
.badge.pl-bull{background:#fde8e6;color:#b4232a}.badge.pl-bear{background:#e3ecfb;color:#1f4fa8}.badge.pl-neutral,.badge.pl-abstain{background:#eef1f5;color:var(--fg2)}
@media (max-width:820px){.pl-card{grid-template-columns:minmax(0,1fr)}.pl-detail{border-left:0;border-top:1px solid var(--line);padding:14px 0 0;min-height:0}.pl-center b{font-size:18px}}
.hs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;padding:6px}.hs-cell{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px;border-left:1px solid var(--line);text-align:center;min-width:0}.hs-cell:first-child{border-left:0}
.hs-k{font-size:12px;color:var(--muted);font-weight:600}.hs-cell b{font-size:15px;line-height:1.25;word-break:keep-all}.hs-sub{font-size:11px;color:var(--muted)}
.hs-meter{position:relative;width:78%;height:6px;border-radius:3px;background:linear-gradient(90deg,#2a62c9,#c9d1dd 50%,#d1373d);margin:3px 0}.hs-meter i{position:absolute;top:-3px;width:4px;height:12px;margin-left:-2px;border-radius:2px;background:#0f2244}
.home-more summary{font-weight:600}.home-more{margin-top:16px}
.lock{width:14px;height:14px;flex:none;vertical-align:-2px;margin-right:4px}html:not([data-plan=pro]):not([data-plan=max]) [data-ov="forecast"],html:not([data-plan=pro]):not([data-plan=max]) .strat-pick,html:not([data-plan=pro]):not([data-plan=max]) #strat-info{display:none!important}
.dk-row{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 2px}.dk{display:inline-flex;gap:6px;font-size:13px;border-radius:8px;padding:4px 10px;background:#eef1f5}.dk b{font-weight:700}.dk-BULLISH{background:#fde8e6;color:#9f1d24}.dk-BEARISH{background:#e3ecfb;color:#1f4fa8}
.ex-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-bottom:10px}.ex{display:flex;gap:8px;align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:9px 10px;cursor:pointer}.ex:has(input:checked){border-color:var(--navy);background:var(--accent-soft)}.ex span{display:flex;flex-direction:column}.ex small{color:var(--muted);font-size:12px}.ex input{accent-color:var(--navy);margin-top:3px}
.fresh{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;border-radius:999px;padding:1px 9px;background:#e7f5ec;color:#1d6b3a}.fresh i{width:7px;height:7px;border-radius:50%;background:currentColor}.fresh.f-STALE{background:#eef1f5;color:#4a5566}.fresh.f-DEGRADED{background:#fff3d6;color:#7a4a00}.fresh.f-NOT_AVAILABLE{background:#fde8e6;color:#9f1d24}
.paper-link{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.paper-link p{margin:2px 0 0}.paper-link .btn-primary{margin:0}
.stock-hero{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)}.request-card{background:var(--accent-soft);border:1px solid #cdd8ea;border-radius:16px;padding:18px}.request-card p{margin:6px 0;font-size:14px}
.lk-head{display:flex;align-items:center;gap:6px;color:var(--navy,#0f2244)}.lk-head .lock{width:18px;height:18px}
.btn-primary{display:inline-flex;align-items:center;gap:6px;margin:8px 0 2px;padding:12px 18px;border-radius:12px;background:var(--navy,#0f2244);color:#fff;font-weight:700;text-decoration:none;font-size:15px}.btn-primary:hover{background:#1d3a6e}.btn-primary .lock{width:16px;height:16px;margin:0}
.locked-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}.locked{position:relative;overflow:hidden;min-height:132px}.locked p{margin:6px 0 10px;font-size:13px;color:var(--fg2)}
.lk-ghost{display:flex;flex-direction:column;gap:7px;filter:blur(2px);opacity:.6}.lk-ghost i{display:block;height:9px;border-radius:5px;background:#dfe5ee}.lk-ghost i:nth-child(2){width:80%}.lk-ghost i:nth-child(3){width:55%}
.sr-lock{color:var(--fg2)}
.sp-one-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.sp-signal{font-size:20px;font-weight:800}.sp-one .headline{margin:8px 0 0}
.sp-moves .mv,#sp-fair .mv{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--line);font-size:14px}.sp-moves .mv:first-child,#sp-fair .mv:first-child{border-top:0}
.sp-votes{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.vchip{font-size:12px;border-radius:8px;padding:4px 8px;background:#eef1f5;color:var(--fg2)}.vchip.v-BULLISH{background:#fde8e6;color:#9f1d24}.vchip.v-BEARISH{background:#e3ecfb;color:#1f4fa8}
.request-card .credit-btn{margin:8px 0 2px}.req-btns{display:flex;gap:8px;flex-wrap:wrap}
@media (max-width:820px){#chart[style*="420px"]{height:320px!important}.stock-hero{grid-template-columns:minmax(0,1fr)}.btn-primary{width:100%;justify-content:center}.locked-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.locked{min-height:0}.locked p{font-size:12px}}
@media (max-width:820px){
.arena-gauges,.hz-row,.analyst-grid,.desk-grid,.why-grid,.locked-grid.swipe{display:flex!important;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;margin-left:-14px;margin-right:-14px;padding:2px 14px 8px;scrollbar-width:none}
.arena-gauges::-webkit-scrollbar,.hz-row::-webkit-scrollbar,.analyst-grid::-webkit-scrollbar,.desk-grid::-webkit-scrollbar,.why-grid::-webkit-scrollbar{display:none}
.arena-gauges>*,.hz-row>*{flex:0 0 46%;scroll-snap-align:start}.analyst-grid>*,.why-grid>*{flex:0 0 86%;scroll-snap-align:start}.desk-grid>*{flex:0 0 72%;scroll-snap-align:start}
.card .arena-gauges,.card .hz-row,.card .desk-grid,.card .why-grid{margin-left:-14px;margin-right:-14px}
.chip-toggle,.seg button,.chips a{min-height:36px}table.compact{font-size:13px}table.compact td,table.compact th{padding:6px 5px}
.block-head{flex-wrap:wrap;row-gap:2px}
.stock-grid{grid-template-columns:minmax(0,1fr);gap:8px}.stock-card{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:10px;row-gap:2px;padding:12px 14px}
.stock-card .sc-top{grid-column:1;display:block}.stock-card .sc-top .spark{display:none}.sc-name{font-size:16px}.stock-card .sc-price{grid-column:2;grid-row:1;flex-direction:column;align-items:flex-end;gap:0}.sc-price b{font-size:17px}
.stock-card>.muted.small{display:none}.sc-signal{grid-column:1/3;border-top:0;padding-top:0;margin:0}.sc-line{display:none}.sc-why{grid-column:1/3;margin:0;padding-left:16px}.sc-why li:nth-child(n+2){display:none}.sc-go{display:none}
}
.chart-tools{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 14px;margin:10px 0 4px}
.preset-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.preset-row .label,.strat-pick .label{font-size:12px;color:var(--muted);font-weight:600;margin-right:2px}
.tool-btn{display:inline-flex;align-items:center;gap:5px;border:1px dashed var(--line-strong);background:#fff;border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;font-weight:600;color:var(--accent);cursor:pointer}.tool-btn:hover{background:var(--accent-soft)}.gear{width:15px;height:15px}
.strat-pick{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line-strong);background:#fff;border-radius:12px;padding:7px 12px;font:inherit;cursor:pointer;min-height:38px}.strat-pick b{font-size:14px}.strat-pick .caret{color:var(--muted)}.strat-pick:hover{border-color:var(--accent)}
.active-pills{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}.pill{border:0;background:var(--accent-soft);color:var(--accent-strong);border-radius:999px;padding:3px 10px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}.pill span{opacity:.6;margin-left:2px}.pill:hover{background:#d9e3f2}
.sheet{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center}.sheet[hidden]{display:none}.sheet-back{position:absolute;inset:0;background:rgba(15,27,45,.42)}
.sheet-body{position:relative;width:min(560px,94vw);max-height:84vh;overflow:auto;background:#fff;border-radius:18px;padding:16px 18px 18px;box-shadow:0 20px 50px rgba(15,27,45,.25)}
.sheet-head{position:sticky;top:-16px;background:#fff;display:flex;justify-content:space-between;align-items:center;padding:4px 0 10px;margin-top:-4px;z-index:1}.sheet-head b{font-size:17px}
.sheet-done{border:0;background:var(--navy,#0f2244);color:#fff;border-radius:10px;padding:8px 16px;font:inherit;font-weight:700;cursor:pointer}
.opt-group{margin:6px 0 12px}.opt-k{font-size:12px;font-weight:700;color:var(--muted);margin:8px 2px 4px}
.opt{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;text-align:left;border:0;border-top:1px solid var(--line);background:none;padding:10px 4px;font:inherit;cursor:pointer;color:var(--fg)}.opt:hover{background:var(--soft)}
.opt-t{display:flex;flex-direction:column;gap:1px;min-width:0}.opt-t b{font-size:14px}.opt-t small{font-size:12px;color:var(--muted)}
.tog{flex:none;width:38px;height:22px;border-radius:11px;background:#d5dce6;position:relative;transition:background .15s}.tog::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.opt[aria-pressed=true] .tog{background:var(--accent)}.opt[aria-pressed=true] .tog::after{transform:translateX(16px)}
.radio{flex:none;width:20px;height:20px;border-radius:50%;border:2px solid #c3ccd8}.opt[aria-pressed=true] .radio{border:6px solid var(--accent)}
body.sheet-open{overflow:hidden}
@media (max-width:820px){.sheet{align-items:flex-end}.sheet-body{width:100%;max-height:82vh;border-radius:18px 18px 0 0;padding-bottom:calc(18px + env(safe-area-inset-bottom))}.chart-tools{flex-direction:column;align-items:stretch}.preset-row{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 -14px;padding:0 14px}.preset-row>*{flex:none}.strat-pick{justify-content:space-between}}
/* kpis */
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.kpi .row{display:flex;align-items:center;gap:12px}
.kpi .ico{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;color:var(--accent-strong);background:var(--accent-soft)!important;flex:none}.kpi .ico svg{width:20px;height:20px}
.kpi .value{font-size:21px;font-weight:700;font-variant-numeric:tabular-nums;display:flex;align-items:center;gap:6px}.kpi .value svg{width:18px;height:18px}.kpi .hint{color:var(--muted);font-size:13px;margin-top:12px}
/* tables, misc */
table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;color:var(--muted);font-weight:500;font-size:13px;padding:10px 8px;border-bottom:1px solid var(--line)}
td{padding:11px 8px;border-bottom:1px solid var(--line);vertical-align:top}td a{text-decoration:none;font-weight:600}td a:hover{text-decoration:underline}
table.compact td,table.compact th{padding:7px 8px}.table-wrap{overflow-x:auto}.why{color:var(--muted);font-size:13px;margin-top:2px}
.headline{font-size:16px;font-weight:600;margin:0 0 10px}ul.plain{margin:0;padding-left:18px}ul.plain li{margin:6px 0}
.tag{display:inline-block;font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:0 8px}
.story{padding:12px 0;border-top:1px solid var(--line)}.story:first-of-type{border-top:0}.story-title{font-weight:600;margin:4px 0 2px}.story-title a{text-decoration:none}.story-title a:hover{text-decoration:underline}
.warn{background:#fdf3e1;color:#7a4a00;border-radius:12px;padding:8px 12px;font-size:13px}
.donut{display:flex;flex-direction:column;align-items:center;gap:16px}.donut svg{width:180px;height:180px}
.legend{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px;width:100%;font-size:13px;color:var(--muted)}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}
.why-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:8px}.why-col{background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.why-col h3,.why-h{font-size:14px;margin:0 0 6px}.why-h{margin-top:16px}.bull h3{color:var(--up)}.bear h3{color:var(--down)}.unc h3{color:var(--muted)}
ul.claims{margin:0;padding-left:18px}ul.claims li{margin:6px 0;font-size:14px}.chips-inline{white-space:nowrap}
.chip{display:inline-block;font-size:11px;font-weight:600;color:var(--accent-strong);background:var(--accent-soft);border-radius:6px;padding:0 6px;margin-left:3px;text-decoration:none}.chip:hover{background:var(--accent);color:#fff}
.evid li{font-size:13px}.desk-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.desk-top{display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px}.desk-grid p,.why-grid p{margin:4px 0;font-size:14px}
.red-team{margin-top:12px;border-left:4px solid #d1373d;background:#fdf3f2;border-radius:0 12px 12px 0;padding:10px 14px}.red-team h3{font-size:14px;margin:0 0 4px;color:#9f1d24}.red-team p{margin:4px 0}
.flow-chart,.earn-chart{width:100%;height:auto;display:block}.flow-chart .zero,.earn-chart .zero{stroke:#b6c0cf;stroke-width:1}.flow-chart .hit{fill:transparent}.flow-chart .hit:hover{fill:rgba(46,66,104,.08)}
.flow-label{font-size:12px;fill:var(--fg);font-weight:600}.axis-label{font-size:11px;fill:var(--muted)}
.legend-inline{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--muted)}.legend-inline i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.b-rev{fill:#00968a}.b-op{fill:#7a4fb3}.b-rev.est{fill:url(#hatch);color:#00968a;stroke:#00968a}.b-op.est{fill:url(#hatch);color:#7a4fb3;stroke:#7a4fb3}
.sw-rev{background:#00968a}.sw-op{background:#7a4fb3}.sw-est{background:repeating-linear-gradient(45deg,#6a7673 0 2px,#fff 2px 4px)}.research li{font-size:14px}
.signal-label.up,.hz-label.up{color:var(--up)}
.panel{display:block}.panel[hidden]{display:none}.panel+.panel{margin-top:32px}.js-tabs .panel+.panel{margin-top:0}.js-tabs .panel-title{display:none}.panel-title{margin:0 0 12px}.panel:focus{outline:none}
footer{max-width:1180px;margin:0 auto;padding:0 24px 40px;color:var(--muted);font-size:12px}footer p{margin:2px 0}
.bottom-nav{display:none}.site-links{display:flex;flex-wrap:wrap;gap:6px 16px;max-width:1180px;margin:8px auto 0;padding:0 24px;font-size:12px;color:var(--muted)}.site-links a{color:var(--fg2)}
@media (max-width:820px){.bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:40;display:grid;grid-template-columns:repeat(5,1fr);background:#fff;border-top:1px solid var(--line);padding:6px 0 calc(6px + env(safe-area-inset-bottom))}.bottom-nav a{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;font-weight:600;color:var(--fg2);text-decoration:none;min-height:44px;justify-content:center}.bottom-nav svg{width:22px;height:22px}body:has(.bottom-nav){padding-bottom:64px}}
.needle{transform-box:view-box;transform-origin:110px 104px;transform:rotate(var(--r));animation:settle 900ms var(--ease-out) 200ms both}
@keyframes settle{from{transform:rotate(0deg)}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
@media (max-width:1100px){.analyst-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.desk-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hz-row{grid-template-columns:repeat(3,minmax(0,1fr))}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.grid2,.grid-eq,.grid-signal,.why-grid{grid-template-columns:minmax(0,1fr)}.hero{grid-template-columns:minmax(0,1fr)}}
@media (max-width:820px){.analyst-grid{grid-template-columns:minmax(0,1fr)}.race-row{grid-template-columns:34px minmax(0,1fr) auto auto}.race-row .spark,.race-row .rn-total,.race-row .rn-sharpe{display:none}.champ-grid{grid-template-columns:minmax(0,1fr)}.arena-gauges{grid-template-columns:repeat(2,minmax(0,1fr))}.topbar-in{padding:10px 16px}.chips{padding:0 12px 8px}.chips a{padding:6px 12px;font-size:13px}.top-links .tl-hide{display:none}
main{padding:14px 14px 48px}.hero{padding:22px 18px;border-radius:18px}.hero h1{font-size:30px}.hero-price b{font-size:28px}.orb{width:170px;height:170px;right:-50px;top:-40px}
.si-value{font-size:17px;white-space:nowrap}.race-mini .race-row{grid-template-columns:30px minmax(0,1fr) auto;row-gap:2px}.race-mini .race-name .small{display:none}.race-mini .race-sig{grid-column:2/4;justify-self:start}.race-mini .race-num{flex-direction:row;gap:6px}.strip{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;margin:0 -14px;padding:2px 14px 6px;scrollbar-width:none}.strip::-webkit-scrollbar{display:none}.strip-item{flex:0 0 72%;scroll-snap-align:start}.home-lists .row-item:nth-child(n+4){display:none}.key-points ul{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.key-points li{flex-direction:column;gap:1px;padding:7px 0}.key-points li:nth-child(2){border-top:0}.key-points{padding:10px 14px}.hero .hero-line{display:none}.hs-cell b{font-size:13px}.hs-k{font-size:11px}.hs-sub{display:none}.card{padding:14px;border-radius:14px}.list{padding:4px 14px}
.hz-row{grid-template-columns:repeat(2,minmax(0,1fr))}.value-head,.facts{grid-template-columns:repeat(2,minmax(0,1fr))}.kpi .ico{display:none}.kpi .value{font-size:17px;white-space:nowrap}
.col-filer,.col-cat,.col-date{display:none}.m-date.meta{display:flex}.moms{gap:8px}.mom{padding:10px}.mom .v{font-size:15px}.votes .why{display:none}.cur-price b{font-size:24px}.ind-group .label{width:100%}
footer{padding:0 16px 32px}}
`;

type TabKey = 'home' | 'chart' | 'technical' | 'strategy' | 'flows' | 'fundamentals' | 'ai' | 'news';
const TABS: readonly { key: TabKey; label: string }[] = [
  { key: 'home', label: '홈' },
  { key: 'chart', label: '차트' },
  { key: 'technical', label: '기술 분석' },
  { key: 'strategy', label: '전략' },
  { key: 'flows', label: '수급' },
  { key: 'fundamentals', label: '펀더멘털' },
  { key: 'ai', label: 'AI 위원회' },
  { key: 'news', label: '뉴스·공시' },
];

export function shell(base: string, title: string, body: string, options: { tabs?: readonly { key: string; label: string }[]; scripts?: string; archiveHref?: string; homeHref?: string; bottomNav?: boolean; active?: 'home' | 'paper' | 'scorecard' | 'pricing' | 'screener' | 'account'; chat?: boolean; noFeedback?: boolean }): string {
  const cur = (k: string) => (options.active === k ? ' aria-current="page"' : '');
  // The site root lists every covered stock; `base` always points at it.
  const rootHref = `${base}index.html`;
  const tabs = options.tabs ?? [];
  return `<!doctype html><html lang="ko" data-plan="free"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#ffffff"><title>${escape(title)}</title>${apiMeta()}${PLAN_BOOT}
<link rel="stylesheet" href="${base}${FONT_DIR}/pretendard.css"><link rel="stylesheet" href="${base}${FONT_DIR}/serif.css"><style>${STYLE}${PLAN_CSS}${UI_CSS}${EXTRAS_CSS}${CHART_V6_CSS}${ALPHA_CSS}${CHAT_CSS}</style></head><body data-base="${base}"${options.noFeedback ? ' data-no-feedback' : ''}>
<a class="skip" href="#main">본문으로 건너뛰기</a>
<header class="topbar"><div class="topbar-in"><a class="brand" href="${rootHref}">${ICON.logo}<div><b>GNOMON</b><small>ANALYTICS</small></div></a>
<nav class="top-links" aria-label="사이트"><a href="${rootHref}"${cur('home')}>홈</a>${options.archiveHref ? `<a href="${options.archiveHref}" class="tl-hide">지난 리포트</a>` : ''}<a href="${base}screener.html" class="tl-hide"${cur('screener')}>스크리너</a><a href="${base}scorecard.html" class="tl-hide"${cur('scorecard') || cur('paper')}>성적표</a><a href="${base}pricing.html" class="tl-hide"${cur('pricing')}>요금제</a><a href="${base}pricing.html" class="acct" aria-label="요금제와 크레딧"><span data-plan-name>무료</span><i><span data-credits>0</span> 크레딧</i></a></nav></div>
${tabs.length ? `<div class="chips" role="tablist" aria-label="리포트 탭">${tabs.map((t, i) => `<a role="tab" id="t-${t.key}" href="#tab-${t.key}" aria-controls="tab-${t.key}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ''}>${t.label}</a>`).join('')}</div>` : ''}</header>
<main id="main" tabindex="-1">${body}<nav class="site-links" aria-label="안내"><a href="${base}scorecard.html">성적표</a><a href="${base}paper.html">모의투자</a><a href="${base}pricing.html">요금제</a><a href="${base}terms.html">이용약관·면책</a><span>투자 권유가 아니에요</span></nav></main>${options.bottomNav === false ? '' : bottomNav(base)}${options.chat === false ? '' : CHAT_HTML}${ACCOUNT_SCRIPT}${ALPHA_SCRIPT}${options.scripts ?? ''}${options.chat === false ? '' : CHAT_SCRIPT}${UI_SCRIPT}</body></html>`;
}

/** Phone-only tab bar on the site's own pages (home, pricing). */
function bottomNav(base: string): string {
  const item = (href: string, label: string, path: string) => `<a href="${href}"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg><span>${label}</span></a>`;
  return `<nav class="bottom-nav" aria-label="빠른 이동">${item(`${base}index.html#top`, '홈', '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>')}${item(`${base}index.html#search`, '검색', '<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>')}${item(`${base}index.html#watch`, '관심', '<path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>')}${item(`${base}screener.html`, '스크리너', '<path d="M4 5h16l-6 7v6l-4 2v-8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>')}${item(`${base}pricing.html" data-acct-tab="1`, '내 계정', '<circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c1.2-3.6 4-5.2 7-5.2s5.8 1.6 7 5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>')}</nav>`;
}

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
  const rows = t.votes.map((v) => `<tr><td class="term-cell">${escape(v.label)}</td><td class="num">${v.value === null ? '없음' : Math.abs(v.value) >= 1000 ? Math.round(v.value).toLocaleString('ko-KR') : v.value.toFixed(2)}</td>
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
${kpi(ICON.volume, '#1c3055', '거래량', `${Math.round(p.volume).toLocaleString('ko-KR')}주`, '', vol === null ? '20일 평균 정보 없음' : `20일 평균 대비 ${vol.toFixed(2)}배`)}
</div>`;
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

/** `only`: 'claims' = the evidence lists (what a brief shows), 'structure' = desks, red team and scenarios. */
function whySection(report: DailyReport, opts: { committee?: boolean; only?: 'claims' | 'structure' } = {}): string {
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
    ? `<ul class="claims">${claims.map((cl) => `<li>${kindChip(cl.kind)}${escape(cl.text)} <span class="chips-inline">${chips(cl.evidenceIds)}</span></li>`).join('')}</ul>`
    : `<p class="empty">${emptyText}</p>`);
  const DESK = { MARKET: '시장', TECHNICAL: '기술', FLOW: '수급', FUNDAMENTAL: '펀더멘털', EVENT: '공시·뉴스' } as const;
  const STANCE = { BULLISH: ['강세', 'up'], BEARISH: ['약세', 'down'], NEUTRAL: ['중립', ''], INSUFFICIENT_DATA: ['근거 부족', 'muted'] } as const;
  const desks = c.desks?.length ? `<h3 class="why-h">데스크별 의견</h3><div class="desk-grid">${c.desks.map((d) => `<div class="why-col"><div class="desk-top"><b>${DESK[d.desk]}</b><span class="${STANCE[d.stance][1]}">${STANCE[d.stance][0]}</span></div><p>${kindChip(d.view.kind)}${escape(d.view.text)} <span class="chips-inline">${chips(d.view.evidenceIds)}</span></p></div>`).join('')}</div>` : '';
  const red = c.redTeam ? `<div class="red-team"><h3>레드팀 반론</h3><p>${kindChip(c.redTeam.counterargument.kind)}${escape(c.redTeam.counterargument.text)} <span class="chips-inline">${chips(c.redTeam.counterargument.evidenceIds)}</span></p>${c.redTeam.unresolved.length ? `<p class="why">풀리지 않은 이견: ${c.redTeam.unresolved.map(escape).join(', ')}</p>` : ''}</div>` : '';
  const SC = { BULL: ['강세 시나리오', 'bull'], BASE: ['기본 시나리오', 'unc'], BEAR: ['약세 시나리오', 'bear'] } as const;
  const scenarios = c.scenarios?.length ? `<h3 class="why-h">시나리오</h3><div class="why-grid">${(['BULL', 'BASE', 'BEAR'] as const).map((k) => {
    const sc = c.scenarios!.find((x) => x.kind === k);
    return `<div class="why-col ${SC[k][1]}"><h3>${SC[k][0]}</h3>${sc ? `<p>${escape(sc.narrative.text)} <span class="chips-inline">${chips(sc.narrative.evidenceIds)}</span></p>
${sc.catalysts.length ? `<p class="why"><b>촉매</b> ${sc.catalysts.map(escape).join(', ')}</p>` : ''}${sc.invalidation.length ? `<p class="why"><b>무효화 조건</b> ${sc.invalidation.map(escape).join(', ')}</p>` : ''}` : '<p class="empty">근거가 있는 시나리오를 쓰지 못했어요.</p>'}</div>`;
  }).join('')}</div>` : '';
  const legend = c.evidence.map((e) => `<li><b>${escape(e.id)}</b> ${e.url.startsWith('http') ? `<a href="${escape(e.url)}" rel="noopener" target="_blank">${escape(e.label)}</a>` : escape(e.label)}</li>`).join('');
  const brief = c.tier === 'brief';
  const showClaims = opts.only !== 'structure', showStructure = opts.only !== 'claims';
  if (opts.only === 'claims') return `<div class="card" id="why-claims"><div class="head"><h2>위원회 근거 정리</h2><span class="sub" style="margin:0">강세와 약세 근거 · 불확실한 점 · 판단이 바뀔 수 있는 것</span></div>
<div class="why-grid"><div class="why-col bull"><h3>강세 근거</h3>${list(c.bullish, '찾지 못했어요.')}</div><div class="why-col bear"><h3>약세 근거</h3>${list(c.bearish, '찾지 못했어요.')}</div><div class="why-col unc"><h3>불확실한 점</h3>${list(c.uncertain, '없어요.')}</div></div>
<h3 class="why-h">판단이 바뀔 수 있는 것</h3>${list(c.watch, '없어요.')}<details class="more"><summary>근거 목록 ${c.evidence.length}개</summary><ul class="plain evid">${legend}</ul></details>
<p class="fine">AI(${escape(c.servedBy ?? c.model)})가 이 리포트의 근거만 보고 쓴 해설이에요. 틀릴 수 있고, 투자 권유가 아니에요.</p></div>`;
  return `<div class="card" id="why"><div class="head"><h2>${brief ? '요약 리포트' : opts.committee ? '위원회 결론' : 'AI 위원회 해설'}</h2><span class="sub" style="margin:0">${brief ? '요약 · 강세와 약세 근거 · 지켜볼 것' : opts.committee ? '요약, 레드팀 반론, 시나리오' : '데스크 5곳과 레드팀이 오늘 리포트의 근거만 인용해요'}</span></div>
${c.summary ? `<p class="headline">${kindChip(c.summary.kind)}${escape(c.summary.text)} <span class="chips-inline">${chips(c.summary.evidenceIds)}</span></p>` : ''}
${showStructure ? `${opts.committee ? '' : desks}${red}${scenarios}` : ''}
${showClaims ? `${opts.committee ? '<details class="more why-fold"><summary>근거 정리 · 판단이 바뀔 수 있는 것 · 부족한 근거</summary>' : ''}${desks || scenarios ? '<h3 class="why-h">근거 정리</h3>' : ''}<div class="why-grid"><div class="why-col bull"><h3>강세 근거</h3>${list(c.bullish, '찾지 못했어요.')}</div>
<div class="why-col bear"><h3>약세 근거</h3>${list(c.bearish, '찾지 못했어요.')}</div>
<div class="why-col unc"><h3>불확실한 점</h3>${list(c.uncertain, '없어요.')}</div></div>
<h3 class="why-h">판단이 바뀔 수 있는 것</h3>${list(c.watch, '없어요.')}
${c.dataGaps.length ? `<h3 class="why-h">근거가 부족한 부분</h3><ul class="plain">${c.dataGaps.map((g) => `<li>${escape(g)}</li>`).join('')}</ul>` : ''}
<details class="more"><summary>근거 목록 ${c.evidence.length}개</summary><ul class="plain evid">${legend}</ul></details>${opts.committee ? '</details>' : ''}` : `<details class="more"><summary>근거 목록 ${c.evidence.length}개</summary><ul class="plain evid">${legend}</ul></details>`}
${c.promptVersion >= 'gnm-committee-v3' ? '<p class="fine">주장마다 <span class="ck ck-FACT">사실</span><span class="ck ck-INFERENCE">해석</span><span class="ck ck-ASSUMPTION">가정</span>을 표시해요.</p>' : ''}<p class="fine">AI(${escape(c.servedBy ?? c.model)})가 이 리포트의 근거만 보고 쓴 해설이에요. 틀릴 수 있고, 투자 권유가 아니에요.${c.dropped ? ` 근거를 대지 못한 주장 ${c.dropped}개는 뺐어요.` : ''} 프롬프트 ${escape(c.promptVersion)}.</p></div>`;
}

function newsSection(report: DailyReport): string {
  const news = report.news;
  if (!news) return '';
  const failed = news.status.filter((st) => !st.ok);
  const statusLine = news.status.map((st) => `${SOURCE_LABEL[st.source] ?? st.source} ${st.ok ? `${st.count}건` : '실패'}`).join(', ');
  const warn = failed.length
    ? `<p class="warn">일부 제한: ${failed.map((st) => escape(SOURCE_LABEL[st.source] ?? st.source)).join(', ')} 수집에 실패했어요. 이 소스의 기사는 빠져 있을 수 있어요.</p>` : '';
  const fresh = new Set(news.newIds);
  const rowsArr = news.clusters.map((c) => {
    const others = c.articles.filter((a) => a.url !== c.url);
    return `<div class="story"><div><span class="badge b-${c.importance}">${IMPORTANCE_LABEL[c.importance]}</span> <span class="tag">${escape(c.category)}</span>${fresh.has(c.id) ? '<span class="badge b-new">새 뉴스</span>' : ''}</div>
<div class="story-title"><a href="${escape(c.url)}" rel="noopener" target="_blank">${escape(c.title)}</a></div>
<div class="why">${meta([`${escape(c.publisher)} (${TIER_LABEL[c.tier]})`, escape(kstTime(c.firstAt)), c.articles.length > 1 ? `같은 내용 기사 ${c.articles.length}건` : ''])}</div>
${others.length ? `<details class="more"><summary>다른 기사 ${others.length}건</summary><ul class="plain">${others.map((a) => `<li><a href="${escape(a.url)}" rel="noopener" target="_blank">${escape(a.title)}</a> <span class="why">${meta([escape(a.publisher), escape(kstTime(a.publishedAt))])}</span></li>`).join('')}</ul></details>` : ''}</div>`;
  });
  const rows = rowsArr.join('');
  return `<div class="card" id="news" style="margin-top:16px"><div class="head"><h2>뉴스</h2><span class="sub" style="margin:0">최근 7일, 이야기 ${news.clusters.length}개</span></div>
${warn}${rows ? (news.clusters.length > 8 ? `${rowsArr.slice(0, 8).join('')}<details class="more news-more"><summary>나머지 이야기 ${news.clusters.length - 8}개 더 보기</summary>${rowsArr.slice(8).join('')}</details>` : rows) : '<p class="empty">최근 7일 동안 관련 뉴스가 없어요.</p>'}
<p class="fine">제목과 언론사, 링크만 모아요(본문은 저장하지 않아요). 비슷한 제목의 기사는 하나의 이야기로 묶고, 기사 수가 많다고 더 중요하게 보지 않아요. 수집: ${escape(statusLine)}</p></div>`;
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
    var id = (location.hash || '#tab-home').slice(1);
    // A tab hash would otherwise scroll past the hero; start the tab from the top.
    if (show(id)) { window.scrollTo(0, 0); setTimeout(function () { window.scrollTo(0, 0); }, 0); return; }
    // An anchor inside a panel (e.g. #filings): open its panel, then scroll to it.
    var el = document.getElementById(id), panel = el && el.closest('[role=tabpanel]');
    if (panel && show(panel.id)) el.scrollIntoView(); else show('tab-home');
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


export interface PageContext {
  base: string;
  /** Live dashboard (rebuilt every run) or a dated report. */
  live: boolean;
  homeHref: string;
  archiveHref: string;
  /** Date of the report whose AI commentary is shown, when it is not this page's own. */
  commentaryFrom?: string | null;
  /** The report before the one whose commentary is shown (for "지난 리포트 대비"). */
  previous?: DailyReport | null;
}

export function renderReport(report: DailyReport, links: { index: string; base?: string } & Partial<PageContext>): string {
  const base = links.base ?? '../';
  const ctx: PageContext = { base, live: links.live ?? false, homeHref: links.homeHref ?? `${base}index.html`, archiveHref: links.archiveHref ?? `${base}archive.html`, commentaryFrom: links.commentaryFrom ?? null, previous: links.previous ?? null };
  const m = report.market;
  const chart = priceChart(report, chartOverlays(m), base, CHART_ASSET);
  const panel = (key: TabKey, html: string) => `<section class="panel" id="tab-${key}" role="tabpanel" aria-labelledby="t-${key}" tabindex="-1"><h2 class="panel-title">${TABS.find((t) => t.key === key)!.label}</h2>${html}</section>`;
  const notes = report.notes.length ? `<ul class="plain">${report.notes.map((n) => `<li>${escape(n)}</li>`).join('')}</ul>` : '<p class="empty">눈에 띄는 가격·거래량 신호는 없어요.</p>';
  const changes = report.changes?.length ? `<ul class="plain">${report.changes.map((c) => `<li>${escape(c)}</li>`).join('')}</ul>` : '<p class="empty">비교할 이전 리포트가 없어요.</p>';
  const asOf = report.generatedAt.replace('T', ' ').slice(0, 16) + ' UTC';
  const home = `${hero(report, { live: ctx.live, asOf: new Date(Date.parse(report.generatedAt) + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ') + ' KST' })}
${m ? marketStatusWarning(m) : ''}
${parliament(report, ctx.commentaryFrom ?? null) || councilCard(report.commentary, ctx.commentaryFrom ?? null)}
${m ? gate(`<section class="block"><div class="block-head"><h2>기간별 기술 신호</h2><a href="#tab-technical" class="more-link">게이지로 보기 ›</a></div>${horizonStrip(m.horizons)}</section>
<section class="block"><div class="block-head"><h2>기술적 적정가</h2><a href="#tab-technical" class="more-link">자세히 보기 ›</a></div>${valueCard(m, false)}</section>`, { base, what: '기간별 신호 · 기술적 적정가' }) : ''}
${marketStrip(report)}
${m ? gate(arenaTeaser(m.arena), { base, what: '전략 챔피언 레이스와 지금 신호' }) : ''}
<div class="home-lists">${latestLists(report)}</div>
<details class="card more home-more"><summary>오늘의 요약 · 어제 대비 바뀐 점</summary><div class="grid-eq" style="margin-top:10px"><div><p class="headline">${escape(report.headline)}</p>${notes}</div><div>${changes}</div></div></details>`;
  const chartTab = `${chart.html}<div style="margin-top:16px">${kpis(report)}</div>`;
  // Free: the 16-indicator summary (public elsewhere too). Plus: our horizon gauges, fair value, forecasts and structure.
  const technical = `${signalSection(report)}${gate(`<div class="block">${m ? horizonRow(m.horizons) : ''}</div>${m ? `${valueCard(m, false)}<div style="margin-top:16px">${structureCard(m.structure, m.weeklyStructure)}</div>` : ''}`, { base, what: '기간별 게이지 · 기술적 적정가 · 가격 구조' })}${m ? `<div style="margin-top:16px">${gate(forecastCard(m.forecasts, m.forecastScores), { base, what: '예측 가격 범위(5·20·60·120거래일)와 지난 예측 적중', need: 'pro' })}</div>` : ''}`;
  // Free: the champion's name. Plus: the ranking. Pro: trades, curves, Monte Carlo and chart markers.
  const strategyTab = `${m ? arenaHeadline(m.arena) : ''}${gate(m ? arenaRanking(m.arena) : '', { base, what: '전략 8개 순위표 · 지금 신호 · 검증 구간 수익' })}${gate(m ? arenaPanel(m.arena) : '<div class="card empty">이 리포트에는 전략 대결 기록이 없어요.</div>', { base, what: '매매 시점 · 수익 곡선 · 몬테카를로 · 거래 기록', need: 'pro' })}
<section class="block"><div class="card paper-link"><div><b>모의투자 장부</b><p class="muted small">전략 챔피언과 AI 분석가를 따라 했다면 어땠는지, 리포트 종목 전체를 모아 따로 보여 줘요.</p></div><a class="btn-primary" href="${base}paper.html">모의투자 보기</a></div></section>`;
  // Investor flows and fundamentals are public data: free. Our footprint reading is Plus.
  const flowsTab = m ? flowsPanel(m.flows, m.footprint, (h) => gate(h, { base, what: '수급 흔적(매집·분산 분석)' })) : '<div class="card empty">이 리포트에는 수급 기록이 없어요.</div>';
  const fundTab = m ? fundamentalsPanel(m, report.price?.close ?? null, report.name) : '<div class="card empty">이 리포트에는 펀더멘털 기록이 없어요.</div>';
  const committee = report.commentary?.status === 'OK' ? parliament(report, ctx.commentaryFrom ?? null, {
    id: 'parliament-ai', title: 'AI 위원회 표결', factions: ['ai', 'desk'], link: null, roster: true,
    note: '위원은 AI 분석가 6명과 데스크 5곳이에요. 좌석이나 이름을 누르면 판단·확신도·20거래일 뒤 예상가·근거·지난 성적이 나와요.',
  }) : '';
  const summary = report.commentary?.status === 'OK' ? report.commentary.summary?.text : undefined;
  const upgrade = report.commentary?.status === 'OK' && report.commentary.tier === 'brief' ? `<section class="block"><div class="card paper-link"><div><b>요약 리포트예요</b><p class="muted small">AI 위원회 전체(데스크 5곳·분석가 6명·레드팀·시나리오)로 다시 쓰려면 심층 리포트로 업그레이드하세요. 프로부터 쓸 수 있어요.</p></div><button type="button" class="credit-btn" data-spend="upgrade" data-symbol="${escape(report.symbol)}" data-name="${escape(report.name)}">심층으로 업그레이드 <small>${CREDIT_COST.upgrade}크레딧</small></button></div></section>` : '';
  // Free: the tally only. Plus: a limited committee (conclusion, desk stances, one line of red team). Pro: everything, plus expert invitations.
  const fromNote = ctx.commentaryFrom ? `<p class="muted small">${escape(ctx.commentaryFrom)} 리포트의 AI 위원회 해설이에요. AI 해설은 매주 금요일 장 마감 뒤 한 번 만들어져요.</p>` : '';
  const isBrief = report.commentary?.status === 'OK' && report.commentary.tier === 'brief';
  // Brief reports: the brief itself is Plus. Committee reports: limited committee Plus, the rest Pro.
  const aiBody = isBrief
    ? gate(whySection(report), { base, what: '요약 리포트: 요약 · 강세와 약세 근거 · 지켜볼 것' })
    : report.commentary?.status === 'OK'
      // Plus sees at least what a brief shows (conclusion, desk stances, the evidence lists); Pro adds the committee's structure.
      ? `${gate(committeeLite(report) + whySection(report, { only: 'claims' }), { base, what: '제한된 AI 위원회: 결론 · 데스크 입장 · 레드팀 한 줄 · 강세와 약세 근거' })}${gate(whySection(report, { committee: !!committee, only: 'structure' }) + (m ? analystScores(m.analystBoard) : ''), { base, what: '위원별 근거 · 예측 · 레드팀 반론 · 시나리오 · 분석가 순위', need: 'pro' })}`
      : whySection(report);
  const proExtras = gate(weekDiffSection(report, ctx.previous ?? null) + decisionTrace(report, ctx.live), { base, what: '지난 리포트 대비 · 이 판단을 만든 입력', need: 'pro' });
  const aiTab = report.commentary
    ? `${upgrade}${committee}${fromNote}${aiBody}${proExtras}${inviteBox(report, base)}${askBox(report, base)}`
    : `<div class="card"><p class="empty">아직 AI 위원회 해설이 없어요. 매주 금요일 장 마감 뒤 리포트에서 만들어져요.</p></div>${askBox(report, base)}`;
  const newsTab = `${newsSection(report) || '<div class="card"><p class="empty">이 리포트에는 뉴스 기록이 없어요.</p></div>'}
<div class="grid2"><div class="card" id="filings"><div class="head"><h2>공시</h2><span class="sub">최근 30일, 제목을 누르면 DART 원문이 열려요</span></div>${filingsTable(report)}</div>${mixCard(report.recentFilings ?? report.filings)}</div>`;
  const p = report.price;
  const bar = p ? priceBar({ name: escape(report.name), symbol: escape(report.symbol), price: escape(won(p.close)), change: p.changePct === null ? '' : `${p.changePct > 0 ? '▲' : p.changePct < 0 ? '▼' : ''} ${escape(pct(p.changePct))}`, tone: tone(p.changePct), badge: freshnessBadge(freshness(report)) }) : '';
  const body = `${bar}${panel('home', home)}
${panel('chart', chartTab)}
${panel('technical', technical)}
${panel('strategy', strategyTab)}
${panel('flows', flowsTab)}
${panel('fundamentals', fundTab)}
${panel('ai', aiTab)}
${panel('news', newsTab)}
<footer id="sources" style="padding:24px 0 0"><p>데이터: Naver 금융 일봉·주봉·분봉(가격), 네이버 증권(수급·밸류에이션·실적·증권사 리포트 목록), OpenDART(공시), 네이버 뉴스 검색과 RSS(뉴스). ${ctx.live ? `이 페이지는 실행할 때마다 최신 데이터로 다시 만들어요 (${escape(asOf)}).` : `${escape(report.date)} 리포트는 만든 뒤 고치지 않아요.`}</p>
<p>적정가와 예측 범위는 계산 결과이고, 투자 권유가 아니에요. <a href="${ctx.archiveHref}">지난 리포트 보기</a></p></footer>`;
  const title = ctx.live ? `${report.name} 리서치 대시보드 | Gnomon Analytics` : `${report.name} ${report.date} 일일 리포트 | Gnomon Analytics`;
  return shell(base, title, body, { tabs: TABS, scripts: chart.script + TAB_SCRIPT + DART_SCRIPT + PARLIAMENT_SCRIPT, archiveHref: ctx.archiveHref, homeHref: ctx.homeHref });
}

const STANCE_WORD = { BULLISH: '강세', BEARISH: '약세', NEUTRAL: '중립', INSUFFICIENT_DATA: '근거 부족' } as const;
const DESK_NAME = { MARKET: '시장', TECHNICAL: '기술', FLOW: '수급', FUNDAMENTAL: '펀더멘털', EVENT: '공시·뉴스' } as const;

/** Plus: the committee's conclusion, each desk's stance (no reasons) and the red team's first sentence. */
function committeeLite(report: DailyReport): string {
  const c = report.commentary;
  if (c?.status !== 'OK') return '';
  const desks = (c.desks ?? []).map((d) => `<span class="dk dk-${d.stance}"><b>${DESK_NAME[d.desk]}</b>${STANCE_WORD[d.stance]}</span>`).join('');
  const red = c.redTeam?.counterargument.text.split(/(?<=요\.)\s/)[0];
  return `<section class="block"><div class="block-head"><h2>AI 위원회 결론</h2><span class="muted">${c.tier === 'brief' ? '요약 리포트' : '위원회 리포트'}</span></div><div class="card ai-one">
${c.summary ? `<p class="headline">${escape(c.summary.text)}</p>` : ''}${desks ? `<div class="pl-k">데스크 입장</div><div class="dk-row">${desks}</div>` : ''}
${red ? `<div class="red-team" style="margin-top:12px"><h3>레드팀 한 줄</h3><p>${escape(red)}</p></div>` : ''}
<p class="fine">위원별 근거·예측·시나리오는 프로부터 볼 수 있어요.</p></div></section>`;
}

/** Pro: invite an expert AI to this stock's committee with credits. Max: 30 a month included, and standing experts. */
function inviteBox(report: DailyReport, base: string): string {
  return `<section class="block" id="invite"><div class="block-head"><h2>전문가 AI 초청</h2><span class="muted">프로 ${CREDIT_COST.invite}크레딧 · 맥스 매달 30회 포함</span></div>
<div class="card"><form class="invite" data-symbol="${escape(report.symbol)}" data-name="${escape(report.name)}"><div class="ex-grid">${EXPERTS.map((e, i) => `<label class="ex"><input type="radio" name="expert" value="${e.key}"${i ? '' : ' checked'}><span><b>${e.name}</b><small>${e.focus}</small></span></label>`).join('')}</div>
<div class="ask-row"><label class="muted small"><input type="checkbox" name="standing"> 맥스: 이 종목 주간 위원회에 고정으로 앉히기</label><button type="submit" class="credit-btn">초청하기</button></div><div class="ask-out" hidden aria-live="polite"></div></form>
<p class="fine">초청한 전문가는 이 종목 리포트의 근거를 보고 의견·위험·지켜볼 것을 써요. MOCK이라 지금은 접수만 기록돼요. <a href="${base}pricing.html">요금제 보기</a></p></div></section>`;
}

/** Questions go to the chat (bottom right); this card opens it with the stock as context. */
function askBox(report: DailyReport, _base: string): string {
  const ex = ['요즘 왜 이렇게 움직였어요?', '지금 가장 큰 위험 요인은?', 'AI 위원회 결론을 쉽게 풀어 줘요'];
  return `<section class="block" id="ask"><div class="block-head"><h2>AI에게 직접 질문</h2><span class="muted">빠른 ${CREDIT_COST.question} · 표준 ${CREDIT_COST.standard} · 깊은 ${CREDIT_COST.deep}크레딧</span></div>
<div class="card"><p class="muted small" style="margin-top:0">${escape(report.name)}의 리포트와 지금 보는 화면을 근거로 답해요. 오른쪽 아래 <b>AI 질문</b> 버튼으로 어느 화면에서나 물어볼 수 있어요.</p>
<div class="chat-sugg">${ex.map((q) => `<button type="button" data-open-chat data-ask="${escape(q)}">${escape(q)}</button>`).join('')}</div></div></section>`;
}

export function renderIndex(reports: readonly Pick<DailyReport, 'date' | 'headline' | 'name' | 'status'>[], links: { base?: string; homeHref?: string; name?: string } = {}): string {
  const sorted = [...reports].sort((a, b) => (a.date < b.date ? 1 : -1));
  const base = links.base ?? '';
  const name = links.name ?? sorted[0]?.name ?? '';
  // The archive sits next to its reports/ folder, so report links are relative to it.
  const body = `<section class="hero" id="archive-top"><div class="orb" aria-hidden="true"></div><div class="hero-main"><div class="eyebrow"><span>지난 리포트</span><span>${sorted.length}건</span></div><h1>${escape(name)} 일일 리포트</h1>
<p class="hero-line">매주 금요일 장 마감 뒤(18:30 KST)에 한 번 만들고, 만든 뒤에는 고치지 않아요. 최신 데이터는 대시보드에서 볼 수 있어요.</p></div></section>
<section class="block" id="archive"><div class="card list">${sorted.length ? sorted.map((r) => `<div class="row-item"><span class="badge ${r.status === 'SESSION' ? 'b-MEDIUM' : 'b-LOW'}">${r.status === 'SESSION' ? '거래일' : '휴장'}</span><div class="ri-main"><a href="reports/${escape(r.date)}.html">${escape(r.date)}</a><div class="muted small">${escape(r.headline)}</div></div></div>`).join('') : '<p class="empty">아직 리포트가 없어요.</p>'}</div></section>
<footer id="sources" style="padding:24px 0 0"><p>데이터: Naver 금융, 네이버 증권, OpenDART, 네이버 뉴스 검색과 RSS. 투자 권유가 아니에요.</p></footer>`;
  return shell(base, `${name} 지난 리포트 | Gnomon Analytics`, body, { archiveHref: 'archive.html', homeHref: links.homeHref ?? 'index.html' });
}

// Client-side search over search.json: name, code or Korean initial consonants (초성).
export const SEARCH_SCRIPT = `<script>
(function () {
  var q = document.getElementById('q'), out = document.getElementById('search-results'), items = null, timer = 0;
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  var LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" class="lock"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  var cho = function (s) { var r = ''; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i) - 0xAC00; r += c >= 0 && c <= 11171 ? CHO[Math.floor(c / 588)] : s[i]; } return r; };
  var norm = function (s) { return s.toLowerCase().replace(/\\s+/g, ''); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var won = function (v) { return Math.round(v).toLocaleString('ko-KR') + '원'; };
  var load = function () {
    if (items) return Promise.resolve(items);
    return fetch('search.json').then(function (r) { return r.json(); }).then(function (d) {
      items = d.items.map(function (x, i) { return { c: x[0], n: x[1], m: x[2], p: x[3], x: x[4], r: x[5], k: norm(x[1]), h: cho(norm(x[1])), i: i }; });
      return items;
    });
  };
  var score = function (it, t, onlyCho) {
    if (it.c === t) return 0;
    if (onlyCho) return it.h.indexOf(t) === 0 ? 2 : it.h.indexOf(t) > 0 ? 4 : -1;
    if (it.k === t) return 0;
    if (it.c.indexOf(t) === 0 || it.k.indexOf(t) === 0) return 1;
    if (it.k.indexOf(t) > 0) return 3;
    return -1;
  };
  var render = function (list, t) {
    if (!t) { out.hidden = true; out.innerHTML = ''; return; }
    var onlyCho = /^[ㄱ-ㅎ]+$/.test(t);
    var hits = list.map(function (it) { return [score(it, t, onlyCho), it]; }).filter(function (p) { return p[0] >= 0; })
      .sort(function (a, b) { return a[0] - b[0] || b[1].r - a[1].r || a[1].i - b[1].i; }).slice(0, 20);
    out.hidden = false;
    if (!hits.length) { out.innerHTML = '<p class="empty">찾는 종목이 없어요. 상장 종목의 이름이나 6자리 코드로 찾아 보세요.</p>'; return; }
    out.innerHTML = hits.map(function (p) {
      var it = p[1], ch = it.x;
      var price = it.p == null ? '' : '<span class="sr-price"><b>' + won(it.p) + '</b>' + (ch == null ? '' : ' <span class="' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '">' + (ch > 0 ? '+' : '') + ch.toFixed(2) + '%</span>') + '</span>';
      var right = it.r ? '<a class="sr-go" href="' + esc(it.c) + '/index.html">리포트 보기 ›</a>' : '<a class="sr-go sr-lock" href="stock.html?c=' + esc(it.c) + '">' + LOCK + '차트 보기 ›</a>';
      return '<div class="row-item sr-row"><div class="ri-main"><b>' + esc(it.n) + '</b><div class="muted small">' + esc(it.c) + ' · ' + (it.m === 'KOSPI' ? '코스피' : '코스닥') + '</div></div>' + price + right + '</div>';
    }).join('');
  };
  q.addEventListener('input', function () {
    clearTimeout(timer);
    var t = norm(q.value);
    timer = setTimeout(function () { load().then(function (list) { render(list, t); }, function () { out.hidden = false; out.innerHTML = '<p class="empty">종목 목록을 불러오지 못했어요.</p>'; }); }, 120);
  });
  q.addEventListener('focus', function () { load(); }, { once: true });
})();
</script>`;

export const REPO_URL = 'https://github.com/hanul442/gnomon_analytics';
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" class="lock"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

const LOCKED = [
  ['AI 위원회', '분석가 6명·데스크 5곳의 표결, 레드팀 반론, 시나리오'],
  ['전략 대결', 'BOT 전략 8개의 4년 백테스트 순위와 매수·매도 시점'],
  ['모의투자', '전략 챔피언과 AI 분석가를 따라 한 가상 계좌'],
  ['수급과 펀더멘털', '외국인·기관 순매수, 수급 흔적, 분기 실적'],
] as const;

/** Shared page for listed stocks without a report: chart, the free computation (details for Plus), and a credit request. */
export function renderStockPage(): string {
  const locked = LOCKED.map(([t, d]) => `<div class="card locked"><div class="lk-head">${LOCK}<b>${t}</b></div><p>${d}</p><div class="lk-ghost" aria-hidden="true"><i></i><i></i><i></i></div></div>`).join('');
  const open = `<section class="block"><div class="grid-eq"><div class="card"><div class="pl-k">기간별 등락</div><div class="sp-moves" id="sp-moves"></div></div>
<div class="card"><div class="pl-k">지표 16개 판단</div><div class="sp-votes" id="sp-votes"></div></div></div></section>`;
  const detail = `<section class="block"><div class="block-head"><h2>기술적 적정가</h2><span class="muted">매일 장 마감 뒤 다시 계산해요</span></div><div class="card"><div id="sp-fair"><p class="empty">기록이 모자라 계산하지 못했어요.</p></div></div></section>`;
  const forecast = `<section class="block"><div class="block-head"><h2>예측 가격 범위 (10~90%)</h2></div><div class="card"><div id="sp-fc"><p class="empty">기록이 모자라 계산하지 못했어요.</p></div><p class="fine">최근 변동성으로 계산한 범위예요. 확률이나 목표가가 아니에요.</p></div></section>`;
  const body = `${priceBar({ name: '<span id="pb-name"></span>', symbol: '<span id="pb-code"></span>', price: '<span id="pb-price"></span>', change: '<span id="pb-change"></span>', tone: '', badge: '' })}<section class="hero stock-hero" id="top"><div class="hero-main"><div class="eyebrow"><span id="sp-code"></span><span id="sp-market"></span><span>AI 리포트 없음</span></div>
<h1 id="sp-name" class="skel">종목 이름</h1><div class="hero-price" id="sp-price"></div><div class="hero-sub" id="sp-date"></div></div>
<div class="request-card"><div class="lk-head">${LOCK}<b>AI 리포트는 아직 없어요</b></div><p>요청하면 다음 장 마감 뒤 리포트를 한 번 써 드려요. 크레딧 요청은 플러스부터예요.</p>
<span class="req-btns"><button type="button" class="credit-btn ghost" data-spend="brief" id="sp-request-brief">요약 리포트 <small>${CREDIT_COST.brief}크레딧</small></button><button type="button" class="credit-btn" data-spend="report" id="sp-request-credit">심층 리포트 <small>${CREDIT_COST.report}크레딧</small></button></span>
<p class="fine">남은 크레딧 <b data-credits>0</b>개 · <a href="pricing.html#credits">충전</a> · MOCK이라 실제 요청은 <a id="sp-request" href="${REPO_URL}/issues/new" target="_blank" rel="noopener">GitHub 이슈</a>로 받아요.</p></div></section>
<section class="block"><div class="card sp-one"><div class="sp-one-head"><span class="pl-k">한 줄 요약</span><b id="sp-signal" class="sp-signal">계산 중</b></div><p class="headline skel" id="sp-line">이 종목의 계산 결과를 불러오는 중이에요.</p><div class="pl-tally" id="sp-tally" aria-hidden="true"></div><p class="muted small" id="sp-counts"></p></div></section>
<section class="block"><div class="card chart-card"><div class="chart-head"><div><div class="muted small">최근 1년 일봉</div><div class="period-stat" id="period-stat" aria-live="polite"></div></div>
<div class="seg" role="group" aria-label="기간">${[['1개월', 21], ['3개월', 63], ['6개월', 126], ['1년', 250]].map(([l, n]) => `<button type="button" data-range="${n}" aria-pressed="${n === 126}">${l}</button>`).join('')}</div></div>
<div id="chart" style="height:420px"><p class="empty" id="sp-empty" hidden>차트 데이터를 불러오지 못했어요. 상장 종목 코드가 맞는지 확인해 주세요.</p></div>
<p class="fine">이동평균 20(주황)·60(보라)과 거래량이에요.</p></div></section>
${open}${gate(detail, { base: '', what: '기술적 적정가' })}${gate(forecast, { base: '', what: '예측 가격 범위', need: 'pro' })}
<section class="block"><div class="block-head"><h2>AI 리포트가 생기면 열리는 분석</h2></div><div class="locked-grid">${locked}</div></section>
<footer id="sources" style="padding:24px 0 0"><p>데이터: Naver 금융 일봉. 매일 장 마감 뒤 갱신해요. 계산 결과이고, 투자 권유가 아니에요.</p></footer>`;
  return shell('', '종목 차트 | Gnomon Analytics', body, { bottomNav: true, scripts: `<script src="${CHART_ASSET}"></script>${STOCK_SCRIPT}` });
}

const STOCK_SCRIPT = `<script>
(function () {
  var code = (new URLSearchParams(location.search).get('c') || '').toUpperCase();
  var $ = function (id) { return document.getElementById(id); };
  var won = function (v) { return Math.round(v).toLocaleString('ko-KR') + '원'; };
  var fail = function () { $('sp-empty').hidden = false; $('sp-name').textContent = code ? code : '종목을 찾지 못했어요'; document.querySelectorAll('.skel').forEach(function (x) { x.classList.remove('skel'); }); };
  if (!/^[0-9A-Z]{6}$/.test(code)) { fail(); return; }
  fetch('s/' + code + '.json').then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (d) {
    document.title = d.name + ' 차트 | Gnomon Analytics';
    $('sp-name').textContent = d.name; $('sp-code').textContent = d.symbol; $('sp-market').textContent = d.market === 'KOSDAQ' ? '코스닥' : '코스피';
    var bars = d.bars.map(function (b) { return { time: b[0], open: b[1], high: b[2], low: b[3], close: b[4], volume: b[5] }; });
    var last = bars[bars.length - 1], prev = bars[bars.length - 2];
    if (last) {
      var ch = prev ? last.close - prev.close : 0, pc = prev ? (ch / prev.close) * 100 : 0;
      $('sp-price').innerHTML = '<b>' + won(last.close) + '</b>' + (prev ? '<span class="' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '">' + (ch > 0 ? '▲' : ch < 0 ? '▼' : '') + ' ' + Math.abs(ch).toLocaleString('ko-KR') + ' (' + (pc > 0 ? '+' : '') + pc.toFixed(2) + '%)</span>' : '');
      $('sp-date').textContent = last.time + ' 종가';
      $('pb-name').textContent = d.name; $('pb-code').textContent = d.symbol; $('pb-price').textContent = won(last.close);
      $('pb-change').textContent = prev ? (pc > 0 ? '▲ +' : pc < 0 ? '▼ ' : '') + pc.toFixed(2) + '%' : ''; $('pb-change').className = ch > 0 ? 'up' : ch < 0 ? 'down' : '';
      document.querySelectorAll('.skel').forEach(function (x) { x.classList.remove('skel'); });
    }
    ['sp-request-credit', 'sp-request-brief'].forEach(function (id) { var rb = $(id); rb.setAttribute('data-symbol', d.symbol); rb.setAttribute('data-name', d.name); });
    var c = d.calc, VOTE = { BULLISH: '강세', NEUTRAL: '중립', BEARISH: '약세' };
    var signed = function (v) { return v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(1) + '%'; };
    if (c) {
      var sg = c.signal, cls = sg.score == null ? '' : sg.score >= 0.1 ? 'up' : sg.score <= -0.1 ? 'down' : '';
      $('sp-signal').textContent = sg.label; $('sp-signal').className = 'sp-signal ' + cls;
      $('sp-line').textContent = c.line;
      var voted = sg.bull + sg.neutral + sg.bear;
      $('sp-tally').innerHTML = voted ? [['bull', sg.bull], ['neutral', sg.neutral], ['bear', sg.bear]].filter(function (x) { return x[1]; }).map(function (x) { return '<span class="s-' + x[0] + '" style="flex:' + x[1] + '"></span>'; }).join('') : '';
      $('sp-counts').textContent = '지표 ' + (voted + sg.abstain) + '개: 강세 ' + sg.bull + ' · 중립 ' + sg.neutral + ' · 약세 ' + sg.bear + (sg.abstain ? ' · 보류 ' + sg.abstain : '') + ' (' + c.date + ' 종가 기준)';
      $('sp-moves').innerHTML = c.moves.map(function (m) { return '<div class="mv"><span>' + m.label + ' (' + m.days + '거래일)</span><b class="' + (m.pct > 0 ? 'up' : m.pct < 0 ? 'down' : '') + '">' + signed(m.pct) + '</b></div>'; }).join('');
      if (c.fair) $('sp-fair').innerHTML = '<div class="mv"><span>중심</span><b>' + won(c.fair.center) + '</b></div><div class="mv"><span>범위</span><b>' + won(c.fair.low) + ' ~ ' + won(c.fair.high) + '</b></div><div class="mv"><span>종가와 차이</span><b>' + signed(c.fair.gapPct) + '</b></div>';
      if (c.forecasts.length) $('sp-fc').innerHTML = '<table class="compact"><thead><tr><th>기간</th><th>범위</th><th>중앙</th></tr></thead><tbody>' + c.forecasts.map(function (f) { return '<tr><td>' + f.days + '거래일</td><td>' + won(f.p10) + ' ~ ' + won(f.p90) + '</td><td>' + won(f.p50) + '</td></tr>'; }).join('') + '</tbody></table>';
      $('sp-votes').innerHTML = c.votes.map(function (v) { return '<span class="vchip v-' + (v[1] || 'NONE') + '">' + v[0] + ' <b>' + (v[1] ? VOTE[v[1]] : '보류') + '</b></span>'; }).join('');
    } else { $('sp-signal').textContent = '계산 없음'; $('sp-line').textContent = '기록이 모자라 계산하지 못했어요.'; }
    var title = '리포트 요청: ' + d.name + ' (' + d.symbol + ')';
    var bodyText = '요청 종목: ' + d.name + ' (' + d.symbol + ')\\n\\n궁금한 점이나 보고 싶은 분석이 있으면 적어 주세요.\\n';
    $('sp-request').href = '${REPO_URL}/issues/new?labels=report-request&title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(bodyText);
    var L = window.LightweightCharts, el = $('chart');
    var chart = L.createChart(el, { autoSize: true, layout: { background: { color: 'transparent' }, textColor: '#6b7686', fontFamily: 'inherit' }, grid: { vertLines: { visible: false }, horzLines: { color: '#eef1f5' } }, rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false }, localization: { priceFormatter: function (p) { return Math.round(p).toLocaleString('ko-KR'); } } });
    var candle = chart.addSeries(L.CandlestickSeries, { upColor: '#d1373d', downColor: '#2a62c9', borderVisible: false, wickUpColor: '#d1373d', wickDownColor: '#2a62c9' });
    candle.setData(bars);
    var ma = function (n) { var out = [], s = 0; for (var i = 0; i < bars.length; i++) { s += bars[i].close; if (i >= n) s -= bars[i - n].close; if (i >= n - 1) out.push({ time: bars[i].time, value: s / n }); } return out; };
    [[20, '#e8890c'], [60, '#7a4fb3']].forEach(function (m) { chart.addSeries(L.LineSeries, { color: m[1], lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(ma(m[0])); });
    var vol = chart.addSeries(L.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'v', priceLineVisible: false, lastValueVisible: false });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(bars.map(function (b, i) { return { time: b.time, value: b.volume, color: i && b.close < bars[i - 1].close ? 'rgba(42,98,201,.35)' : 'rgba(209,55,61,.35)' }; }));
    var stat = $('period-stat'), current = 126, lastW = el.clientWidth;
    var setRange = function (n) {
      current = n; var from = Math.max(0, bars.length - n);
      chart.timeScale().setVisibleLogicalRange({ from: from - 0.5, to: bars.length - 0.5 });
      var w = bars.slice(from), c = (w[w.length - 1].close / w[0].open - 1) * 100;
      var hi = Math.max.apply(null, w.map(function (b) { return b.high; })), lo = Math.min.apply(null, w.map(function (b) { return b.low; }));
      stat.innerHTML = '<span>' + document.querySelector('[data-range="' + n + '"]').textContent + ' 동안</span><b class="' + (c > 0 ? 'up' : c < 0 ? 'down' : '') + '">' + (c > 0 ? '+' : '') + c.toFixed(2) + '%</b><span>최고 ' + won(hi) + '</span><span>최저 ' + won(lo) + '</span>';
    };
    chart.timeScale().subscribeSizeChange(function (w) { if (!lastW && w > 0) setRange(current); lastW = w; });
    document.querySelectorAll('[data-range]').forEach(function (b) { b.addEventListener('click', function () { document.querySelectorAll('[data-range]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); setRange(Number(b.getAttribute('data-range'))); }); });
    setRange(current);
  }).catch(fail);
})();
</script>`;

/** One covered stock on the front page. `report` is its live dashboard, or null when nothing was built yet. */
export interface HomeEntry {
  symbol: string; name: string; href: string; report: DailyReport | null;
  /** core: reported every day; weekly: this week's selection; request: asked for; past: picked in an earlier week (search only). */
  group: 'core' | 'weekly' | 'request' | 'past';
  reasons?: string[];
  tier?: 'deep' | 'brief';
}

