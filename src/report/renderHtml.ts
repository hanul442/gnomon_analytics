import { COMMAND_BAR_CSS, COMMAND_BAR_JS, REPORT_TABS_CSS, REPORT_TABS_JS } from './commandBar.js';
import { US_EXCHANGE_LETTER } from '../sources/naverWorld.js';
import { MODERN_SWITCH_CSS, MODERN_SWITCH_JS } from './modernSwitch.js';
import { GEN_BUTTON_CSS, GEN_BUTTON_JS, genButton } from './generateButton.js';
import { ROLL_CSS, ROLL_JS } from './rollNumber.js';
import { LIQUID_CSS, LIQUID_JS } from './liquidButton.js';
import { GLASS_CSS, GLASS_JS } from './glass.js';
import { MOTION_TOKENS_CSS } from './motionTokens.js';
import { SEG_THUMB_CSS, SEG_THUMB_JS } from './segThumb.js';
import { GLOW_CTA_CSS } from './glowCta.js';
import {contentMore,CONTENT_MORE_CSS} from './contentMore.js';
import {indicatorKey,INDICATOR_LINK_CSS,INDICATOR_LINK_JS} from './indicatorLinks.js';
import {SCENARIO_CSS,SCENARIO_JS} from './scenarioChart.js';
import { PEERS_CSS, PEERS_JS, peersSlot } from './peers.js';
import { COIN_CHART_JS } from './coinChart.js';
import { coinFlow } from './coinFlow.js';
import { versionBanner, VERSION_CSS, VERSION_JS } from './releases.js';
import { JOBS_JS } from './onDemandBrowser.js';
import { LOADING_CSS, LOADING_JS } from './loading.js';
// Pages: the live dashboard (rebuilt every run), dated reports, and the archive.
// Look: BLACK ORACLE mobile mockup v1 tone (docs/DESIGN.md G-15). The price chart
// uses TradingView Lightweight Charts v5, served from our own site.

import type { DailyReport, ReportedFiling } from './dailyReport.js';
import type { TechnicalSummary } from '../analysis/technicals.js';
import type { Claim } from '../analysis/commentary.js';
import { apiMeta, ALPHA_CSS, ALPHA_SCRIPT } from './alpha.js';
import { CHAT_CSS, CHAT_HTML, CHAT_SCRIPT } from './chat.js';
import { INFOGRAPHIC_CSS, INFOGRAPHIC_JS } from './infographics.js';
import { MOTION_CSS, MOTION_JS } from './motion.js';
import { THEME_CSS } from './theme.js';
import { chartOverlays, quickInfoCard, flowsPanel, forecastCard, fundamentalsPanel, STOCK_INFO_CSS, STOCK_INFO_TOGGLE_JS, miniGauge, horizonRow, marketStatusWarning, structureCard, valueCard } from './renderMarket.js';
import { DART_SCRIPT, freshness, freshnessBadge, hero, latestLists, reportStatusBar, priceChart } from './appParts.js';
import { arenaHeadline, arenaPanel } from './renderArena.js';
import { parliament, PARLIAMENT_SCRIPT } from './renderParliament.js';
import { ACCOUNT_SCRIPT, CREDIT_COST, EXPERTS, gate, PLAN_BOOT, THEME_BOOT, PLAN_CSS } from './plans.js';
import { PERSONA_BOOT, PERSONA_CSS, PERSONA_JS, personaCards } from './persona.js';
import { CONCLUSION_CSS, CONCLUSION_JS, conclusionCard, conclusionMini, parliamentViewNote, SEATS_JS, VIEW_FOCUS_CSS } from './conclusion.js';
import { tabBar, BANNER_CSS, FS_CSS, FS_JS, TAP_JS, INSTALL_BOOT, INSTALL_JS, LIVE_CSS, LIVE_JS, ORBS, ORBS_CSS, POP_CSS, SURVEY_POP_JS, TOUR_CSS, TOUR_JS, menuHtml, MENU_CSS, MENU_JS, priceBar, starButton, UI_CSS, UI_SCRIPT } from './ui.js';
import { DEBATE_FILTER_SCRIPT, DEBATE_PLAY_SCRIPT, debateSection, decisionTrace, EVIDENCE_SCRIPT, EXTRAS_CSS, insightLine, issuesSection, kindChip, weekDiffSection } from './renderReportExtras.js';
import { CHART_V6_CSS } from './chartTools.js';
import { CHART_PRO_CSS, CHART_PRO_JS, HERO_RANGE_JS } from './chartPro.js';
import { derivSlot, DERIV_CSS, DERIV_JS } from './deriv.js';
import { CHART_DRAW_CSS, CHART_DRAW_JS, IND_LIMIT_JS } from './chartDraw.js';
import { adStrip, AD_CSS, AD_JS } from './ads.js';
import { edgeCard, edgeEvents, edgeFlows, edgeFundamentals, EDGE_CSS, insiderSection } from './renderEdge.js';
import { ALERTS_CSS, PRICE_ALERT_JS, PUSH_JS } from './pushParts.js';
import { STOCK_INFO_JS } from './stockInfo.js';
import { THEME_CHIPS_CSS, THEME_CHIPS_JS } from './themeChips.js';
import { esc as escape } from './html.js';
import { withCurrency, won, tone, FORMAT_JS, pct as fmtPct } from './format.js';
const pct = (value: number | null): string => fmtPct(value, 2, '없음');

export const CHART_ASSET = 'assets/lightweight-charts.js';
/** Pretendard web font, also served from our own site. */
export const FONT_DIR = 'assets/fonts';

const IMPORTANCE_LABEL = { HIGH: '중요', MEDIUM: '보통', LOW: '참고' } as const;
// G-176: kinds side by side must be told apart, so neighbours differ in hue, not only in shade.
const MIX_COLORS = ['#6b4eff', '#243659', '#0f9b8e', '#e8a33d', '#8b95a1', '#d6ceff'];
/** Meta details as separate items (spacing, not "·" chains). */
const meta = (parts: readonly string[], cls = 'meta'): string => `<span class="${cls}">${parts.filter(Boolean).map((part) => `<span>${part}</span>`).join('')}</span>`;



const STYLE = `
/* G-181 (v3.8.0): one token set per theme. Dark is the default (D안: deep navy, soft light pools, glass panels, white pill buttons); light is the option. */
:root{--page:#EEF3F8;--surface:rgba(255,255,255,.78);--surface-solid:#ffffff;--soft:#F1F5F9;--line:rgba(10,22,38,.09);--line-strong:rgba(10,22,38,.18);--fg:#0A1626;--fg2:#3A4A5C;--muted:#6B7A8C;--bar:#0A1626;--navy:var(--accent);
--accent:#0582CA;--accent-strong:#006494;--accent-soft:#E3F3FD;--accent-line:#B6E0FA;--brand-grad:linear-gradient(135deg,#00A6FB 0%,#0582CA 100%);
--up:#F04452;--down:#0582CA;--up-soft:#FDE8E6;--down-soft:#E3F3FD;--up-strong:#B4232A;--down-strong:#006494;--warn:#B07A1E;--warn-soft:#FFF4DC;--good:#0F9B8E;--good-soft:#E7F5EC;--good-strong:#1d6b3a;--warn-strong:#5b3d00;--ink:#1D3557;--focus:#0582CA;
--btn-bg:var(--accent);--btn-fg:#ffffff;--tip-bg:rgba(10,22,38,.92);--tip-fg:#ffffff;--glass-blur:18px;--page-grad:radial-gradient(900px 600px at 15% -10%,rgba(0,166,251,.16),transparent 60%),radial-gradient(800px 600px at 110% 20%,rgba(5,130,202,.12),transparent 60%);
--brand-serif:"Noto Serif KR","Nanum Myeongjo","AppleMyungjo",serif;--serif:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;--ease-out:cubic-bezier(.16,1,.3,1);--shadow:0 1px 2px rgba(10,22,38,.04),0 8px 24px rgba(10,22,38,.05)}
html[data-theme=dark]{--page:#0A1626;--surface:rgba(255,255,255,.045);--surface-solid:#13223A;--soft:rgba(255,255,255,.06);--line:rgba(255,255,255,.09);--line-strong:rgba(255,255,255,.18);--fg:#F4F7FA;--fg2:#C3CDD6;--muted:#8593A1;--bar:#06101C;
--accent:#00A6FB;--accent-strong:#3DB9FF;--accent-soft:rgba(0,166,251,.14);--accent-line:rgba(0,166,251,.35);--brand-grad:linear-gradient(135deg,#00A6FB 0%,#0582CA 100%);
--up:#FF7A7A;--down:#5CBBFF;--up-soft:rgba(255,122,122,.16);--down-soft:rgba(92,187,255,.16);--up-strong:#FF9B9B;--down-strong:#8FD0FF;--warn:#F2C14E;--warn-soft:rgba(242,193,78,.16);--good:#86E3B5;--good-soft:rgba(134,227,181,.16);--good-strong:#86E3B5;--warn-strong:#F2C14E;--ink:#CFE3FF;--focus:#00A6FB;
--btn-bg:#ffffff;--btn-fg:#0A1626;--tip-bg:rgba(19,34,58,.94);--tip-fg:#F4F7FA;--seat-ring:#0A1626;--glass-blur:22px;--page-grad:radial-gradient(1100px 700px at 20% -20%,rgba(0,100,148,.45),transparent 60%),radial-gradient(900px 600px at 110% 30%,rgba(0,53,84,.6),transparent 60%),radial-gradient(1000px 800px at 40% 120%,rgba(5,130,202,.18),transparent 60%);--shadow:none}
*{box-sizing:border-box}html{color-scheme:light}html[data-theme=dark]{color-scheme:dark}
/* G-181: SVG presentation attributes cannot take var(); dark ink colours are lifted here so drawn figures stay visible on the dark page. */
html[data-theme=dark] [fill="#2e4268"],html[data-theme=dark] [fill="#183556"],html[data-theme=dark] [fill="#243659"]{fill:var(--ink)}html[data-theme=dark] [stroke="#2e4268"],html[data-theme=dark] [stroke="#183556"],html[data-theme=dark] [stroke="#243659"]{stroke:var(--ink)}html[data-theme=dark] i[style*="#2e4268"],html[data-theme=dark] i[style*="#243659"]{background:var(--ink)!important}html[data-theme=dark] [fill="#18201f"],html[data-theme=dark] [fill="#191f28"]{fill:var(--fg)}html[data-theme=dark] [stroke="#18201f"],html[data-theme=dark] [stroke="#191f28"]{stroke:var(--fg)}html,body{margin:0}body{background:var(--page);background-image:var(--page-grad);background-attachment:fixed;color:var(--fg);
font:15px/1.6 "Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;-webkit-font-smoothing:antialiased;word-break:keep-all;overflow-wrap:anywhere}
a{color:inherit}button,a{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.skip{position:absolute;left:16px;top:16px;z-index:50;background:var(--brand-grad);color:#fff;padding:8px 14px;border-radius:999px;font-weight:600;text-decoration:none;transform:translateY(-200%);transition:transform 150ms var(--ease-out)}.skip:focus{transform:none}
[id]{scroll-margin-top:120px}h1,h2,h3{text-wrap:balance}p,li{text-wrap:pretty}
.up{color:var(--up)}.down{color:var(--down)}.muted{color:var(--muted)}.small{font-size:12px}.empty{color:var(--muted)}
/* header + chip tabs */
.topbar{position:sticky;top:0;z-index:30;background:var(--bar);border-bottom:1px solid rgba(255,255,255,.06);color:#fff}
.topbar-in{max-width:1180px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#fff}.brand svg{width:28px;height:28px}.gnomon-mark{width:38px;height:38px;flex:none;display:block}.gnomon-mark img{display:block;width:100%;height:100%}
.brand b{display:block;font-family:var(--brand-serif);font-weight:600;font-size:19px;letter-spacing:.18em;line-height:1.1}.brand small{display:block;font-size:10px;color:#b3a8ff;letter-spacing:.12em}
.top-links{display:flex;gap:4px;font-size:13px}.top-links a{text-decoration:none;color:rgba(255,255,255,.82);padding:6px 10px;border-radius:999px}.top-links a:hover{background:rgba(255,255,255,.1);color:#fff}
.chips{max-width:1180px;margin:0 auto;padding:0 24px 10px;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.chips a{flex:none;padding:7px 15px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600;color:rgba(255,255,255,.78);border:1px solid transparent;transition:background-color 150ms var(--ease-out),color 150ms var(--ease-out)}
.chips a:hover{background:rgba(255,255,255,.1);color:#fff}.chips a[aria-selected=true]{background:var(--surface);color:var(--navy)}
main{max-width:1180px;margin:0 auto;padding:20px 24px 64px;min-width:0}
/* hero */
.hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:20px;align-items:center;padding:30px 32px;border-radius:20px;border:1px solid var(--line);background:var(--surface);box-shadow:var(--shadow)}
.orb{display:none;position:absolute;right:28%;top:-60px;width:260px;height:260px;border-radius:50%;pointer-events:none;opacity:.55;
background:radial-gradient(circle at 34% 30%,#fff 0%,#eff3f8 22%,#c3cfdf 52%,#8099bb 78%,#2d3f61 100%);box-shadow:inset -20px -26px 44px rgba(25,42,74,.25),0 18px 40px rgba(36,54,89,.18)}
.orb::after{content:"";position:absolute;inset:18% 30% 52% 22%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.95),rgba(255,255,255,0) 70%)}
.hero-main,.key-points{position:relative}.mkt-chip{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11.5px;font-weight:800;background:var(--soft);color:var(--fg2)}.mk-kospi{background:var(--down-soft);color:var(--down-strong)}.mk-kosdaq{background:var(--good-soft);color:var(--good-strong)}.mk-etf{background:rgba(139,92,246,.14);color:#8B5CF6}.mk-coin{background:var(--warn-soft);color:var(--warn-strong)}.eyebrow{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;font-weight:600;color:var(--accent-strong)}
.hero h1{font-family:var(--serif);font-weight:600;font-size:40px;line-height:1.15;margin:6px 0 10px;letter-spacing:-.01em}
.hero-price{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 14px}.hero-price b{font-size:34px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}.hero-price span{font-weight:600;font-variant-numeric:tabular-nums}
.absent-block details.card{padding:12px 16px}.absent-block summary{cursor:pointer;font-size:14px}.absent-block summary .muted{font-weight:500;font-size:13px}.absent-block p{margin:8px 0 0}
.rs-bar{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:4px 12px;margin:16px 0;padding:12px 14px;border-radius:14px;background:var(--surface);border:1px solid var(--line)}.rs-dot{width:10px;height:10px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px var(--accent-soft);align-self:start;margin-top:6px}.rs-stale .rs-dot{background:var(--warn);box-shadow:0 0 0 4px var(--warn-soft)}.rs-none .rs-dot{background:var(--muted);box-shadow:0 0 0 4px var(--soft)}.sa-tx b{display:block;font-size:14px}.sa-tx small{display:block;font-size:12.5px;color:var(--fg2);margin-top:2px}.sa-go{font:inherit;font-size:13.5px;font-weight:800;white-space:nowrap;border:0;border-radius:999px;padding:9px 14px;background:var(--accent);color:#fff;cursor:pointer}.sa-go small{font-weight:500;opacity:.85}.sa-go:hover{background:var(--accent-strong)}@media (max-width:560px){.rs-bar{grid-template-columns:auto minmax(0,1fr)}.sa-go{grid-column:1/-1;width:100%;margin-top:6px;padding:11px}.rs-bar .gen-wrap{grid-column:1/-1;display:block;margin-top:8px}.rs-bar .gen-btn{width:100%;padding:12px 16px}}.hero-sub{font-size:12px;color:var(--muted);margin-top:2px}.hero-chart{display:block;margin:12px 0 2px;padding:8px 10px 6px;border:1px solid var(--line);border-radius:14px;background:var(--surface);text-decoration:none;color:inherit;max-width:520px}.hero-chart:hover{border-color:var(--accent)}.hero-chart svg{display:block;width:100%;height:72px}.hc-meta{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:4px}.hc-go{font-weight:800;color:var(--accent-strong)}.hero-line{margin:14px 0 0;color:var(--fg2);max-width:60ch}
.key-points{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px 18px}
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
.dbar-track{width:16px;height:64px;background:var(--line);border-radius:6px;display:flex;align-items:flex-end;overflow:hidden}.dbar-track i{display:block;width:100%;border-radius:6px}
.dbar-track i.bull{background:linear-gradient(#e7a3a5,var(--up))}.dbar-track i.bear{background:linear-gradient(#a9c0ec,var(--down))}.dbar-track i.neu{background:linear-gradient(#c5d0e0,#7c95b9)}.dbar-k{color:var(--muted);white-space:nowrap}
.debate{margin-top:12px;padding:10px 12px;border-radius:12px;background:var(--up-soft);border:1px solid var(--line);font-size:14px}.debate b{color:var(--up-strong);margin-right:6px}
/* lists */
.list{padding:6px 18px}.row-item{display:flex;gap:10px;align-items:flex-start;padding:11px 0;border-top:1px solid var(--line)}.row-item:first-child{border-top:0}
.ri-main{min-width:0}.ri-main a{text-decoration:none;font-weight:600}.ri-main a:hover{text-decoration:underline}
.badge{display:inline-block;font-size:12px;border-radius:999px;padding:1px 9px;white-space:nowrap;flex:none}.badge.ok{background:var(--good-soft);color:var(--good-strong)}.badge.warn{background:var(--warn-soft);color:var(--warn-strong)}.badge.bad{background:var(--up-soft);color:var(--up-strong)}.badge.dark{background:var(--navy);color:#fff}.badge.mute{background:var(--soft);color:var(--fg2)}.badge.sm{font-size:11px;font-weight:700;padding:1px 8px}
.b-HIGH{background:var(--up-soft);color:var(--up-strong)}.b-MEDIUM{background:var(--warn-soft);color:var(--warn)}.b-LOW{background:var(--line);color:var(--muted)}.b-new{background:var(--accent-soft);color:var(--accent-strong);margin-left:6px;border:1px solid #becbdc}
/* chart */
.chart-card{margin-top:4px}.chart-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.cur-price{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}.cur-price b{font-size:30px;font-variant-numeric:tabular-nums}.cur-price span{font-weight:600;font-variant-numeric:tabular-nums}
.period-stat{display:flex;flex-wrap:wrap;gap:2px 14px;font-size:13px;color:var(--fg2);margin-top:4px;font-variant-numeric:tabular-nums}.period-stat b{font-size:15px}
.seg{display:inline-flex;flex-wrap:wrap;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:3px;gap:2px}
.seg button{border:0;background:none;padding:6px 12px;border-radius:999px;font:inherit;font-size:13px;color:var(--fg2);cursor:pointer;transition:background-color 150ms var(--ease-out),color 150ms var(--ease-out)}
.seg button:hover{background:var(--accent-soft)}.seg button[aria-pressed=true],.seg button[aria-selected=true]{background:var(--brand-grad);color:#fff}
.ind-menu{margin:4px 0 8px;border:1px solid var(--line);border-radius:12px;padding:8px 12px;background:var(--soft)}.ind-menu summary{cursor:pointer;font-weight:600;font-size:14px;color:var(--accent-strong)}
.ind-group{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}.ind-group .label{font-size:12px;color:var(--muted);width:56px}
.chip-toggle{border:1px solid var(--line-strong);background:var(--surface);border-radius:999px;padding:4px 11px;font:inherit;font-size:12px;color:var(--fg2);cursor:pointer;transition:background-color 150ms var(--ease-out),color 150ms var(--ease-out)}
.chip-toggle:hover{color:var(--fg)}.chip-toggle[aria-pressed=true]{background:var(--accent-soft);color:var(--accent-strong);border-color:var(--accent-line);font-weight:600}
.legend-line{font-size:12px;color:var(--muted);min-height:18px;font-variant-numeric:tabular-nums;margin:4px 0}
#chart{position:relative;transition:height 200ms var(--ease-out)}
.mark-pop{position:absolute;top:38px;z-index:5;max-height:300px;overflow:auto;border:1px solid var(--line-strong);border-radius:12px;background:var(--surface-solid);padding:10px 12px;box-shadow:0 8px 24px rgba(22,27,38,.16)}.mp-body{min-width:0}.mp-title{font-weight:600;font-size:14px;line-height:1.4}.mp-meta{font-size:12px;color:var(--muted);margin-top:2px}.mp-meta a{color:var(--accent-strong);font-weight:600}
.mp-head{display:flex;justify-content:space-between;font-weight:600;margin-bottom:6px}.mp-head button{border:0;background:none;font-size:18px;cursor:pointer;color:var(--muted)}
.mp-row{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-top:1px solid var(--line)}.mp-row a{font-weight:600;text-decoration:none}.mp-row a:hover{text-decoration:underline}
.fine{color:var(--muted);font-size:12px;margin:10px 0 0}
/* technical pieces */
.grid-signal{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:16px;margin:16px 0}
.signal{text-align:center}.gauge{width:100%;max-width:260px;display:block;margin:0 auto}.signal-label,.hz-label,.big{font-family:var(--serif)}.signal-label{font-size:24px;font-weight:600;margin:4px 0}
.reason{margin:6px 0;font-size:14px}.tally{color:var(--muted);font-size:13px}
.meta{display:inline-flex;flex-wrap:wrap;gap:2px 12px}.m-date.meta{display:none}
.moms{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.mom{background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.momentum-gauge{margin:10px 0}.momentum-gauge svg{width:100%;max-width:180px;display:block;margin:auto}.momentum-axis{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);gap:4px}.mom .k{color:var(--muted);font-size:12px}.mom .v{font-size:18px;font-weight:700;margin:2px 0}
.gbars{display:grid;gap:12px;margin-top:16px}.gtitle{display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-bottom:6px}
.track{display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--line);gap:2px}.track i{display:block;height:100%}
.track i.v-BULLISH{background:var(--up)}.track i.v-BEARISH{background:var(--down)}.track i.v-NEUTRAL{background:#b6c0cf}.track i.b-LOW{background:#dee5ef}
.votes{margin-top:14px}.votes td{padding:8px}.votes summary,.more summary{cursor:pointer;color:var(--accent-strong);font-weight:600;font-size:14px}
.num{font-variant-numeric:tabular-nums;white-space:nowrap}.v-BULLISH{background:var(--up-soft);color:var(--up-strong)}.v-BEARISH{background:var(--down-soft);color:var(--down-strong)}.v-NEUTRAL{background:var(--line);color:var(--muted)}.nowrap{white-space:nowrap}
.hz-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.hz{background:var(--soft);border:1px solid var(--line);border-radius:14px;padding:10px 12px;text-align:center}
.hz-top{display:flex;justify-content:space-between;align-items:baseline;font-size:13px}.hz-top span{color:var(--muted);font-size:12px}
.mini-gauge{width:100%;max-width:150px;display:block;margin:4px auto 0}.hz-label{font-weight:600;font-size:17px}.hz-meta{display:flex;justify-content:center;flex-wrap:wrap;gap:0 10px;color:var(--muted);font-size:12px}
.value-head{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:6px}.value-head .label,.facts .label,.kpi .label{display:block;color:var(--muted);font-size:12px}
.big{font-size:26px;font-weight:600;font-variant-numeric:tabular-nums}.mid{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}
.value-strip{width:100%;max-width:560px;height:auto;display:block;margin:6px auto}.value-strip text{font-size:11.5px;fill:var(--muted)}.value-strip .vs-v{font-weight:700;fill:var(--fg2)}.vs-axis{stroke:var(--line);stroke-width:2}
.vs-band{fill:var(--accent-soft);stroke:#a5b6ce}.vs-center line{stroke:var(--accent);stroke-width:2}.vs-close line{stroke:var(--fg);stroke-width:3}.vs-cons line{stroke:#7a4fb3;stroke-width:2;stroke-dasharray:3 3}.vs-p50 line{stroke:#d97706;stroke-width:2;stroke-dasharray:3 3}
.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:10px}.facts.one{grid-template-columns:1fr;margin-top:10px}.facts b{font-variant-numeric:tabular-nums}
.race{padding:6px 18px}.race-row{display:grid;grid-template-columns:44px minmax(0,1.4fr) 140px repeat(3,minmax(0,.6fr)) auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}.race-row:first-of-type{border-top:0}
.race-row.is-champ{background:linear-gradient(90deg,rgba(146,167,196,.16),rgba(255,255,255,0));border-radius:12px}
.race-name{display:flex;flex-direction:column;min-width:0}.race-num{display:flex;flex-direction:column;align-items:flex-end;font-variant-numeric:tabular-nums}.race-sig{text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:3px}.race-stance{font-size:12.5px;font-weight:800;border-radius:999px;padding:2px 9px;white-space:nowrap}.st-bull{background:var(--up-soft);color:var(--up-strong)}.st-bear{background:var(--down-soft);color:var(--down-strong)}.st-mid{background:var(--soft);color:var(--fg2)}.st-none{background:var(--soft);color:var(--muted)}.race-why{grid-column:2/-1;font-size:12.5px;color:var(--fg2);line-height:1.5;margin-top:-2px}.race-why b{color:var(--fg)}html[data-plan=pro] .arena-head,html[data-plan=max] .arena-head{display:none}
.race .spark{width:140px;height:40px}.race-mini .race-row{grid-template-columns:44px minmax(0,1.4fr) 140px minmax(0,.6fr) auto}.rank{display:inline-flex;align-items:center;gap:2px;color:var(--muted);font-variant-numeric:tabular-nums}.rank b{font-size:15px}
.crown{width:16px;height:16px;vertical-align:-2px}.rank.r1{color:var(--ink)}.rank.r2{color:#9aa1ab}.rank.r3{color:var(--ink)}.champion h2 .crown{color:var(--ink);width:18px;height:18px}
.champ-grid{display:grid;grid-template-columns:180px minmax(0,1fr);gap:18px;align-items:center}.champ-grid>div:first-child{text-align:center}.champ-grid .mini-gauge{max-width:170px}.rule{margin:0 0 4px;font-weight:600}
.arena-gauges{grid-template-columns:repeat(4,minmax(0,1fr))}.trig{margin-top:4px;line-height:1.4}
.analyst-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.analyst{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 16px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:8px}
.an-top{display:flex;gap:10px;align-items:center}.an-name{flex:1;min-width:0;display:flex;flex-direction:column}.avatar{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;flex:none;font-family:var(--serif);font-weight:600;color:#fff;background:var(--brand-grad)}
.an-nums{display:grid;grid-template-columns:1fr 1fr;gap:10px}.an-nums .label{display:block;font-size:12px;color:var(--muted)}.an-nums b{font-variant-numeric:tabular-nums;margin-right:6px}
.conf{height:5px;background:var(--line);border-radius:999px;margin-top:4px;overflow:hidden}.conf i{display:block;height:100%;background:var(--brand-grad)}.an-why{margin:0;font-size:14px;color:var(--fg2)}
.chart-wrap{position:relative}.chart-body{position:relative}
.ev-strip{position:relative;height:34px;border-bottom:1px dashed var(--line)}
.ev-icon{position:absolute;top:3px;width:28px;height:28px;margin-left:-14px;display:grid;place-items:center;border-radius:50%;border:1.5px solid currentColor;background:var(--surface-solid);color:var(--ink);padding:0;cursor:pointer;box-shadow:0 1px 3px rgba(22,27,38,.12);transition:transform .12s ease,background .12s ease}
.ev-icon svg{width:15px;height:15px}.ev-icon b{position:absolute;top:-6px;right:-7px;min-width:16px;height:16px;border-radius:8px;background:currentColor;font-size:10px;line-height:16px;text-align:center;padding:0 3px}
.ev-icon b{color:#fff}.ev-icon b{background:var(--ink)}.ev-icon.news b{background:var(--good)}.ev-icon.both b{background:var(--muted)}
.ev-icon:hover,.ev-icon[aria-expanded="true"]{transform:translateY(-1px);background:var(--soft)}.ev-icon:focus-visible{outline:2px solid #161b26;outline-offset:2px}
.ev-icon.news{color:var(--good)}.ev-icon.both{color:var(--muted)}
.vlines{position:absolute;left:0;top:0;width:100%;height:0;pointer-events:none}
.vline{position:absolute;top:0;width:0;border-left:1.5px dashed var(--ink);opacity:.7}.vline.news{border-left-color:var(--good)}.vline.both{border-left-color:var(--muted)}
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
.search-box{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--line-strong);border-radius:14px;padding:0 16px;box-shadow:var(--shadow)}.search-box:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.search-box svg{width:20px;height:20px;color:var(--muted);flex:none}.search-box input{flex:1;min-width:0;border:0;outline:0;background:none;font:inherit;font-size:16px;padding:14px 0;color:var(--fg)}
.search-results{margin-top:8px}.sr-row{align-items:center;gap:12px}.sr-row .ri-main{flex:1}.sr-price{font-variant-numeric:tabular-nums;font-size:14px;white-space:nowrap}.sr-go{font-weight:600;color:var(--accent);text-decoration:none;white-space:nowrap;font-size:14px}.sr-go:hover{text-decoration:underline}.search-note{margin:8px 2px 0}
@media (max-width:820px){.sr-price{display:none}}
.pl-card{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:22px;align-items:start}
.pl-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}.pl-figure{position:relative;max-width:470px;margin:0 auto}
.pl-svg{display:block;width:100%;height:auto;overflow:visible}
.seat{cursor:pointer;stroke:var(--seat-ring,#fff);stroke-width:.6;transition:opacity .2s ease,transform .2s ease;transform-box:fill-box;transform-origin:center;animation:seat-in .45s var(--ease-out) backwards;animation-delay:calc(var(--i) * 22ms)}
.seat.s-bull{fill:var(--up);--sc:var(--up)}.seat.s-neutral{fill:var(--muted);--sc:var(--muted)}.seat.s-bear{fill:var(--down);--sc:var(--down)}.seat.s-abstain{fill:var(--surface-solid);stroke:var(--muted);stroke-width:.9;--sc:var(--muted)}
.seat.f-ai,.seat.f-desk{stroke:var(--fg);stroke-width:1.1}
/* G-185: the hemicycle stands on a glass stage lit from below in the majority's colour; voting seats glow softly. */
.pl-figure{padding:14px 20px 8px;border-radius:22px;border:1px solid var(--line);background:radial-gradient(70% 85% at 50% 105%,var(--pl-glow,rgba(0,166,251,.16)),transparent 72%),linear-gradient(165deg,rgba(255,255,255,.06),rgba(255,255,255,.012));box-shadow:inset 0 1px rgba(255,255,255,.07),0 18px 40px -26px rgba(0,0,0,.7)}
.pl-figure:has(.pl-center b.up){--pl-glow:rgba(255,122,122,.22)}.pl-figure:has(.pl-center b.down){--pl-glow:rgba(92,187,255,.24)}
html[data-theme=dark] .seat.s-bull:not(.is-dim){filter:drop-shadow(0 0 2.5px rgba(255,122,122,.6))}html[data-theme=dark] .seat.s-bear:not(.is-dim){filter:drop-shadow(0 0 2.5px rgba(92,187,255,.6))}
.pl-center b{text-shadow:0 0 18px currentColor}
html:not([data-theme=dark]) .pl-figure{background:radial-gradient(70% 85% at 50% 105%,var(--pl-glow,rgba(0,166,251,.12)),transparent 72%),rgba(255,255,255,.7)}
.seat:hover,.seat:focus-visible{transform:scale(1.25);outline:none}.seat.is-on{transform:scale(1.35);stroke:var(--fg);stroke-width:1.6}.seat.is-dim{fill-opacity:.12;stroke:var(--sc);stroke-opacity:.5}
@keyframes seat-in{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.seat{animation:none;transition:none}}
.pl-center{position:absolute;left:50%;bottom:4px;transform:translateX(-50%);text-align:center;display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none}
.pl-center b{font-size:22px;font-weight:800;letter-spacing:-.01em}.pl-center span{font-size:13px;color:var(--fg2);font-variant-numeric:tabular-nums;white-space:nowrap}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin:0 3px 0 6px;vertical-align:0}.dot.s-bull{background:var(--up)}.dot.s-neutral{background:var(--muted)}.dot.s-bear{background:var(--down)}.dot.s-abstain{border:1.5px solid var(--muted)}
.pl-detail{border-left:1px solid var(--line);padding-left:20px;min-height:180px}.pl-detail p{margin:6px 0;font-size:14px;line-height:1.6}
.why-fold{margin-top:14px}.why-fold>summary{font-weight:600}
.pl-small .pl-figure{max-width:400px}.pl-small .pl-center{bottom:10px}.pl-small .seat.is-on{transform:scale(1.15)}.pl-small .seat:hover{transform:scale(1.1)}
.pl-tally{display:flex;gap:2px;height:8px;border-radius:4px;overflow:hidden;margin:20px 0 4px}.pl-tally .s-bull{background:var(--up)}.pl-tally .s-neutral{background:var(--muted)}.pl-tally .s-bear{background:var(--down)}
.pl-roster{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:12px}
.pl-col{display:flex;flex-direction:column;gap:6px}.pl-col-h{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--fg2);padding-bottom:4px;border-bottom:1px solid var(--line)}.pl-col-h b{margin-left:auto;font-variant-numeric:tabular-nums}
.member{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px;padding:8px 10px;border:1px solid var(--line);border-left:4px solid var(--muted);border-radius:8px;background:var(--card);font:inherit;font-size:14px;text-align:left;cursor:pointer;color:var(--fg);transition:background .15s ease,border-color .15s ease,opacity .2s ease}
.member.s-bull{border-left-color:var(--up)}.member.s-bear{border-left-color:var(--down)}.member.s-abstain{border-left-style:dashed}
.member:hover{background:var(--soft)}.member:focus-visible{outline:2px solid var(--fg);outline-offset:2px}.member.is-on{background:var(--accent-soft);border-color:var(--accent-line)}.member.is-dim{opacity:.3}
.m-name{font-weight:600;line-height:1.3}
@media (max-width:560px){.pl-roster{grid-template-columns:minmax(0,1fr)}.pl-col{flex-direction:row;flex-wrap:wrap}.pl-col-h{flex-basis:100%}.member{flex:1 1 calc(50% - 6px);min-width:0}.m-kind{display:none}}.m-kind{flex:none;font-size:11px;color:var(--muted);background:var(--soft);border-radius:999px;padding:2px 7px}.pl-k{font-size:12px;font-weight:600;color:var(--muted);letter-spacing:.02em}.pl-name{display:flex;align-items:center;gap:8px;margin:4px 0 2px;font-size:17px}
.badge.pl-bull{background:var(--up-soft);color:var(--up-strong)}.badge.pl-bear{background:var(--down-soft);color:var(--down-strong)}.badge.pl-neutral,.badge.pl-abstain{background:var(--soft);color:var(--fg2)}
@media (max-width:820px){.pl-card{grid-template-columns:minmax(0,1fr)}.pl-detail{border-left:0;border-top:1px solid var(--line);padding:14px 0 0;min-height:0}.pl-center b{font-size:18px}}
.hs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;padding:6px}.hs-cell{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px;border-left:1px solid var(--line);text-align:center;min-width:0}.hs-cell:first-child{border-left:0}
.hs-k{font-size:12px;color:var(--muted);font-weight:600}.hs-cell b{font-size:15px;line-height:1.25;word-break:keep-all}.hs-sub{font-size:11px;color:var(--muted)}
.hs-meter{position:relative;width:78%;height:6px;border-radius:3px;background:linear-gradient(90deg,var(--down),#c9d1dd 50%,var(--up));margin:3px 0}.hs-meter i{position:absolute;top:-3px;width:4px;height:12px;margin-left:-2px;border-radius:2px;background:var(--fg)}
.home-more summary{font-weight:600}.home-more{margin-top:16px}
.lock{width:14px;height:14px;flex:none;vertical-align:-2px;margin-right:4px}html:not([data-plan=pro]):not([data-plan=max]) [data-ov="forecast"],html:not([data-plan=pro]):not([data-plan=max]) .strat-pick,html:not([data-plan=pro]):not([data-plan=max]) #strat-info{display:none!important}
.dk-row{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 2px}.dk{display:inline-flex;gap:6px;font-size:13px;border-radius:8px;padding:4px 10px;background:var(--soft)}.dk b{font-weight:700}.dk-BULLISH{background:var(--up-soft);color:var(--up-strong)}.dk-BEARISH{background:var(--down-soft);color:var(--down-strong)}
.ex-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-bottom:10px}.ex{display:flex;gap:8px;align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:9px 10px;cursor:pointer}.ex:has(input:checked){border-color:var(--navy);background:var(--accent-soft)}.ex span{display:flex;flex-direction:column}.ex small{color:var(--muted);font-size:12px}.ex input{accent-color:var(--navy);margin-top:3px}
.join-wrap .card{border:1.5px solid var(--accent)}.join-wrap .db-join{margin:0;border:0;padding:0}.jn-q{display:block}.jn-q textarea{width:100%;box-sizing:border-box;border:1px solid var(--line-strong);border-radius:12px;padding:10px 12px;font:inherit;font-size:15px;margin-top:4px;resize:vertical}.join .chat-sugg{margin:8px 0 12px}.jn-k{font-weight:700;margin-bottom:6px}.jn-who{display:flex;flex-wrap:wrap;gap:6px}.jn-who .ex{padding:6px 11px;border-radius:999px;align-items:center}.jn-who .ex small{display:none}.jn-who .ex input{margin:0}.join:has(input[value=committee]:checked) .jn-standing{display:none}
.fresh{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;border-radius:999px;padding:1px 9px;background:var(--good-soft);color:var(--good-strong)}.fresh i{width:7px;height:7px;border-radius:50%;background:currentColor}.fresh.f-STALE{background:var(--soft);color:var(--fg2)}.fresh.f-DEGRADED{background:var(--warn-soft);color:var(--warn-strong)}.fresh.f-NOT_AVAILABLE{background:var(--up-soft);color:var(--up-strong)}
.paper-link{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.paper-link p{margin:2px 0 0}.paper-link .btn-primary{margin:0}
.stock-hero{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)}.request-card{background:var(--accent-soft);border:1px solid #cdd8ea;border-radius:16px;padding:18px}.request-card p{margin:6px 0;font-size:14px}
.lk-head{display:flex;align-items:center;gap:6px;color:var(--navy,var(--bar))}.lk-head .lock{width:18px;height:18px}
.btn-primary{display:inline-flex;align-items:center;gap:6px;margin:8px 0 2px;padding:12px 18px;border-radius:12px;background:var(--navy,var(--bar));color:#fff;font-weight:700;text-decoration:none;font-size:15px}.btn-primary:hover{background:var(--accent-strong)}.btn-primary .lock{width:16px;height:16px;margin:0}
.locked-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}.locked{position:relative;overflow:hidden;min-height:132px}.locked p{margin:6px 0 10px;font-size:13px;color:var(--fg2)}
.lk-ghost{display:flex;flex-direction:column;gap:7px;filter:blur(2px);opacity:.6}.lk-ghost i{display:block;height:9px;border-radius:5px;background:#dfe5ee}.lk-ghost i:nth-child(2){width:80%}.lk-ghost i:nth-child(3){width:55%}
.sr-lock{color:var(--fg2)}
.sp-one-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.sp-signal{font-size:20px;font-weight:800}.sp-one .headline{margin:8px 0 0}
.sp-moves .mv,#sp-fair .mv{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--line);font-size:14px}.sp-moves .mv:first-child,#sp-fair .mv:first-child{border-top:0}
.sp-votes{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.vchip{font-size:12px;border-radius:8px;padding:4px 8px;background:var(--soft);color:var(--fg2)}.vchip.v-BULLISH{background:var(--up-soft);color:var(--up-strong)}.vchip.v-BEARISH{background:var(--down-soft);color:var(--down-strong)}
.request-card .credit-btn{margin:8px 0 2px}.req-btns{display:flex;gap:8px;flex-wrap:wrap}
@media (max-width:820px){#chart[style*="420px"]{height:320px!important}.stock-hero{grid-template-columns:minmax(0,1fr)}.btn-primary{width:100%;justify-content:center}.locked-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.locked{min-height:0}.locked p{font-size:12px}}
@media (max-width:820px){
.arena-gauges,.hz-row,.moms,.analyst-grid,.desk-grid,.why-grid,.locked-grid.swipe{display:flex!important;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;margin-left:-14px;margin-right:-14px;padding:2px 14px 8px;scrollbar-width:none}
.arena-gauges::-webkit-scrollbar,.hz-row::-webkit-scrollbar,.moms::-webkit-scrollbar,.analyst-grid::-webkit-scrollbar,.desk-grid::-webkit-scrollbar,.why-grid::-webkit-scrollbar{display:none}
.arena-gauges>*,.hz-row>*,.moms>*{flex:0 0 46%;scroll-snap-align:start}.analyst-grid>*,.why-grid>*{flex:0 0 86%;scroll-snap-align:start}.desk-grid>*{flex:0 0 72%;scroll-snap-align:start}
.card .arena-gauges,.card .hz-row,.card .moms,.card .desk-grid,.card .why-grid{margin-left:-14px;margin-right:-14px}
.chip-toggle,.seg button,.chips a{min-height:36px}table.compact{font-size:13px}table.compact td,table.compact th{padding:6px 5px}
.block-head{flex-wrap:wrap;row-gap:2px}
.stock-grid{grid-template-columns:minmax(0,1fr);gap:8px}.stock-card{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:10px;row-gap:2px;padding:12px 14px}
.stock-card .sc-top{grid-column:1;display:block}.stock-card .sc-top .spark{display:none}.sc-name{font-size:16px}.stock-card .sc-price{grid-column:2;grid-row:1;flex-direction:column;align-items:flex-end;gap:0}.sc-price b{font-size:17px}
.stock-card>.muted.small{display:none}.sc-signal{grid-column:1/3;border-top:0;padding-top:0;margin:0}.sc-line{display:none}.sc-why{grid-column:1/3;margin:0;padding-left:16px}.sc-why li:nth-child(n+2){display:none}.sc-go{display:none}
}
.chart-tools{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 14px;margin:10px 0 4px}
.preset-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.preset-row .label,.strat-pick .label{font-size:12px;color:var(--muted);font-weight:600;margin-right:2px}
.tool-btn{display:inline-flex;align-items:center;gap:5px;border:1px dashed var(--line-strong);background:var(--surface);border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;font-weight:600;color:var(--accent);cursor:pointer}.tool-btn:hover{background:var(--accent-soft)}.gear{width:15px;height:15px}
.strat-pick{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line-strong);background:var(--surface);border-radius:12px;padding:7px 12px;font:inherit;cursor:pointer;min-height:38px}.strat-pick b{font-size:14px}.strat-pick .caret{color:var(--muted)}.strat-pick:hover{border-color:var(--accent)}
.active-pills{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}.pill{border:0;background:var(--accent-soft);color:var(--accent-strong);border-radius:999px;padding:3px 10px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}.pill span{opacity:.6;margin-left:2px}.pill:hover{background:#d9e3f2}
.sheet{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center}.sheet[hidden]{display:none}.sheet-back{position:absolute;inset:0;background:rgba(15,27,45,.42)}
.sheet-body{position:relative;width:min(560px,94vw);max-height:84vh;overflow:auto;background:var(--surface-solid);border-radius:18px;padding:16px 18px 18px;box-shadow:0 20px 50px rgba(15,27,45,.25)}
.sheet-head{position:sticky;top:-16px;background:var(--surface-solid);display:flex;justify-content:space-between;align-items:center;padding:4px 0 10px;margin-top:-4px;z-index:1}.sheet-head b{font-size:17px}
.sheet-done{border:0;background:var(--navy,var(--bar));color:#fff;border-radius:10px;padding:8px 16px;font:inherit;font-weight:700;cursor:pointer}
.opt-group{margin:6px 0 12px}.opt-k{font-size:12px;font-weight:700;color:var(--muted);margin:8px 2px 4px}
.opt{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;text-align:left;border:0;border-top:1px solid var(--line);background:none;padding:10px 4px;font:inherit;cursor:pointer;color:var(--fg)}.opt:hover{background:var(--soft)}
.opt-t{display:flex;flex-direction:column;gap:1px;min-width:0}.opt-t b{font-size:14px}.opt-t small{font-size:12px;color:var(--muted)}
/* G-183: the switch itself is .mt (modernSwitch.ts) */
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
table.compact td,table.compact th{padding:7px 8px}.table-wrap{overflow-x:auto;max-width:100%}td,th{overflow-wrap:normal}th{white-space:nowrap}td.nm{min-width:8.5em}.why{color:var(--muted);font-size:13px;margin-top:2px}
.headline{font-size:16px;font-weight:600;margin:0 0 10px}ul.plain{margin:0;padding-left:18px}ul.plain li{margin:6px 0}
.tag{display:inline-block;font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:0 8px}
.story{padding:12px 0;border-top:1px solid var(--line)}.story:first-of-type{border-top:0}.story-title{font-weight:600;margin:4px 0 2px}.story-title a{text-decoration:none}.story-title a:hover{text-decoration:underline}
.warn{background:var(--warn-soft);color:var(--warn-strong);border-radius:12px;padding:8px 12px;font-size:13px}
.donut{display:flex;flex-direction:column;align-items:center;gap:16px}.donut svg{width:180px;height:180px}
.legend{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px;width:100%;font-size:13px;color:var(--muted)}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}
.why-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:8px}.why-col{background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.why-col h3,.why-h{font-size:14px;margin:0 0 6px}.why-h{margin-top:16px}.bull h3{color:var(--up)}.bear h3{color:var(--down)}.unc h3{color:var(--muted)}
ul.claims{margin:0;padding-left:18px}ul.claims li{margin:6px 0;font-size:14px}.data-nav{display:inline-flex;gap:2px;overflow-x:auto;max-width:100%;background:var(--soft);border-radius:12px;padding:4px;margin:4px 0 14px}.data-nav a{flex:none;border-radius:9px;padding:7px 14px;font-size:13.5px;font-weight:700;text-decoration:none;color:var(--fg2)}.data-nav a:hover{background:var(--surface);color:var(--fg)}.data-part{scroll-margin-top:170px;margin-bottom:26px}.data-h{font-size:20px;margin:14px 0 8px;padding-left:10px;border-left:4px solid var(--navy)}.chips-inline{white-space:normal}.chips-inline .chip{white-space:nowrap}.desk-grid .why-col,.why-col{min-width:0;overflow-wrap:anywhere}
.chip{display:inline-block;font-size:11px;font-weight:600;color:var(--accent-strong);background:var(--accent-soft);border-radius:6px;padding:0 6px;margin-left:3px;text-decoration:none}.chip:hover{background:var(--accent);color:#fff}
.evid li{font-size:13px}.desk-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.desk-top{display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px}.desk-grid p,.why-grid p{margin:4px 0;font-size:14px}
.red-team{margin-top:12px;border-left:4px solid var(--up);background:var(--up-soft);border-radius:0 12px 12px 0;padding:10px 14px}.red-team h3{font-size:14px;margin:0 0 4px;color:var(--up-strong)}.red-team p{margin:4px 0}
.flow-chart{width:100%;max-width:640px;height:auto;display:block;margin:0 auto}.flow-chart .zero{stroke:#b6c0cf;stroke-width:1}.flow-chart .hit{fill:transparent}.flow-chart .hit:hover{fill:rgba(46,66,104,.08)}
.flow-label{font-size:12px;fill:var(--fg);font-weight:600}.axis-label{font-size:11px;fill:var(--muted)}
.legend-inline{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--muted)}.legend-inline i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}

.research li{font-size:14px}
.signal-label.up,.hz-label.up{color:var(--up)}
.panel{display:block}.panel[hidden]{display:none}.panel+.panel{margin-top:32px}.js-tabs .panel+.panel{margin-top:0}.js-tabs .panel-title{display:none}.panel-title{margin:0 0 12px}.panel:focus{outline:none}
footer{max-width:1180px;margin:0 auto;padding:0 24px 40px;color:var(--muted);font-size:12px}footer p{margin:2px 0}
.bottom-nav{display:none}.site-links{display:flex;flex-wrap:wrap;gap:6px 16px;max-width:1180px;margin:8px auto 0;padding:0 24px;font-size:12px;color:var(--muted)}.site-links a{color:var(--fg2);display:inline-flex;align-items:center;min-height:32px}
@media (max-width:820px){.bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:40;display:grid;grid-template-columns:repeat(5,1fr);background:var(--surface-solid);border-top:1px solid var(--line);padding:6px 0 calc(6px + env(safe-area-inset-bottom))}.bottom-nav a,.bottom-nav button{display:flex;flex-direction:column;align-items:center;gap:2px;font:inherit;font-size:11px;font-weight:600;color:var(--fg2);text-decoration:none;min-height:44px;justify-content:center;border:0;background:none;cursor:pointer;padding:0}.bottom-nav [aria-current=page],.bottom-nav [aria-expanded=true]{color:var(--accent-strong);font-weight:800}.bottom-nav svg{width:22px;height:22px}body:has(.bottom-nav){padding-bottom:64px}}
.needle{transform-box:view-box;transform-origin:110px 104px;transform:rotate(var(--r));animation:settle 900ms var(--ease-out) 200ms both}
@keyframes settle{from{transform:rotate(0deg)}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
@media (max-width:1100px){.analyst-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.desk-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hz-row{grid-template-columns:repeat(3,minmax(0,1fr))}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.grid2,.grid-eq,.grid-signal,.why-grid{grid-template-columns:minmax(0,1fr)}.hero{grid-template-columns:minmax(0,1fr)}}
@media (max-width:820px){.analyst-grid{grid-template-columns:minmax(0,1fr)}.race-row{grid-template-columns:34px minmax(0,1fr) auto auto}.race-row .spark,.race-row .rn-total,.race-row .rn-sharpe{display:none}.champ-grid{grid-template-columns:minmax(0,1fr)}.arena-gauges{grid-template-columns:repeat(2,minmax(0,1fr))}.topbar-in{padding:10px 16px}.chips{padding:0 12px 8px}.chips a{padding:6px 12px;font-size:13px}.top-links .tl-hide{display:none}
main{padding:14px 14px 48px}.hero{padding:22px 18px;border-radius:18px}.hero h1{font-size:30px}.hero-price b{font-size:28px}.orb{width:170px;height:170px;right:-50px;top:-40px}
.si-value{font-size:17px;white-space:nowrap}.race-mini .race-row{grid-template-columns:30px minmax(0,1fr) auto;row-gap:2px}.race-mini .race-name .small{display:none}.race-mini .race-sig{grid-column:2/4;justify-self:start}.race-mini .race-num{flex-direction:row;gap:6px}.strip{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;margin:0 -14px;padding:2px 14px 6px;scrollbar-width:none}.strip::-webkit-scrollbar{display:none}.strip-item{flex:0 0 72%;scroll-snap-align:start}.home-lists .row-item:nth-child(n+4){display:none}.key-points ul{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.key-points li{flex-direction:column;justify-content:flex-start;gap:1px;padding:7px 0}.key-points li:nth-child(2){border-top:0}.key-points{padding:10px 14px}.hero .hero-line{display:none}.hs-cell b{font-size:13px}.hs-k{font-size:11px}.hs-sub{display:none}.card{padding:14px;border-radius:14px}.list{padding:4px 14px}
.hz-row{grid-template-columns:repeat(2,minmax(0,1fr))}.value-head,.facts{grid-template-columns:repeat(2,minmax(0,1fr))}.kpi .ico{display:none}.kpi .value{font-size:17px;white-space:nowrap}
.col-filer,.col-cat,.col-date{display:none}.m-date.meta{display:flex}.moms{gap:8px}.mom{padding:10px}.mom .v{font-size:15px}.votes .why{display:none}.cur-price b{font-size:24px}.ind-group .label{width:100%}
footer{padding:0 16px 32px}}
`;

// Keep chart, technical analysis and strategy in independent tabs.
type TabKey = 'home' | 'chart' | 'technical' | 'strategy' | 'ai' | 'flows' | 'fundamentals' | 'news';
// G-129: 기술 + 전략 → 타이밍, 수급 + 종목정보 → 기업 체력. The old tab ids stay as sections inside them,
// so links to #tab-strategy or #tab-flows still land on the right part.
export const TABS: readonly { key: TabKey; label: string }[] = [
  { key: 'home', label: '요약' },
  { key: 'chart', label: '차트' },
  { key: 'technical', label: '타이밍' },
  { key: 'fundamentals', label: '기업 체력' },
  { key: 'ai', label: 'AI 위원회' },
  { key: 'news', label: '뉴스·공시' },
];

/** G-176: a coin has no company to weigh, so its 기업 체력 tab is called 수급 (what is in it). */
const tabsFor = (kind?: string) => (kind === 'coin' ? TABS.map((t) => (t.key === 'fundamentals' ? { ...t, label: '수급' } : t)) : TABS);

const ANALYSIS_KEYS = new Set<string>();
function reportNav(tabs:readonly {key:string;label:string}[]):string {
 const link=(t:{key:string;label:string},i:number)=>`<a role="tab" id="t-${t.key}" href="#tab-${t.key}" aria-controls="tab-${t.key}" aria-selected="${i===0}"${i?' tabindex="-1"':''}>${t.label}</a>`;
 const nested=tabs.filter(t=>ANALYSIS_KEYS.has(t.key));
 return `<div class="chips" role="tablist" aria-label="리포트 탭">${tabs.filter(t=>!ANALYSIS_KEYS.has(t.key)&&t.key!=='chart').map((t,i)=>link(t,i)+(t.key==='chart'&&nested.length?'<button type="button" id="analysis-menu" aria-expanded="false" aria-controls="analysis-tabs">분석<i class="chev" aria-hidden="true"></i></button>':'')).join('')}</div>${nested.length?`<div id="analysis-tabs" class="chips analysis-tabs" role="tablist" aria-label="분석 세부 메뉴" hidden>${nested.map(t=>link(t,1)).join('')}</div>`:''}`;
}

export function shell(base: string, title: string, body: string, options: { lead?: string; tabs?: readonly { key: string; label: string }[]; scripts?: string; archiveHref?: string; homeHref?: string; bottomNav?: boolean; active?: 'home' | 'watch' | 'paper' | 'scorecard' | 'pricing' | 'screener' | 'account' | 'coins' | 'etfs'; chat?: boolean; noFeedback?: boolean; ads?: boolean }): string {
  // The site root lists every covered stock; `base` always points at it.
  const rootHref = `${base}index.html`;
  const tabs = options.tabs ?? [];
  const menu = menuHtml(base, options.archiveHref);
  return `<!doctype html><html lang="ko" data-plan="free"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0A1626"><link rel="manifest" href="${base}manifest.webmanifest"><link rel="apple-touch-icon" href="${base}assets/gnomon-icon-192.png"><link rel="icon" type="image/png" href="${base}assets/gnomon-icon-96.png"><title>${escape(title)}</title>${apiMeta()}${PLAN_BOOT}${THEME_BOOT}${PERSONA_BOOT}${INSTALL_BOOT}
<link rel="stylesheet" href="${base}${FONT_DIR}/pretendard.css"><link rel="stylesheet" href="${base}${FONT_DIR}/serif.css"><link rel="stylesheet" href="${base}assets/app.${ASSET_VERSION}.css"></head><body data-base="${base}"${options.noFeedback ? ' data-no-feedback' : ''}>
<div class="boot-veil" aria-hidden="true"><span><img src="${base}assets/gnomon-mark.png" alt=""></span></div><script>(function(){var v=document.currentScript.previousElementSibling,done=0,lift=function(){if(done)return;done=1;v.classList.add('gone');setTimeout(function(){v.remove();},220);};setTimeout(lift,Math.max(0,850-performance.now()));addEventListener('DOMContentLoaded',function(){(document.fonts&&document.fonts.ready||Promise.resolve()).then(function(){requestAnimationFrame(function(){requestAnimationFrame(lift);});});});})();</script>
<a class="skip" href="#main">본문으로 건너뛰기</a>
<header class="topbar"><div class="topbar-in"><a class="brand" href="${rootHref}"><span class="gnomon-mark"><img src="${base}assets/gnomon-mark.png" alt=""></span><div><b>GNOMON</b><small>AI COMMITTEE</small></div></a>
${menu.button}<nav class="top-links" aria-label="사이트"><button type="button" class="install-btn" data-install hidden aria-label="그노몬 앱 설치">📲 앱 설치</button><a href="${base}pricing.html" class="acct" aria-label="요금제와 크레딧"><span data-plan-name>무료</span><i><span data-credits>0</span> 크레딧</i></a></nav></div>
${tabs.length ? reportNav(tabs) : ''}</header>${menu.drawer}
<main id="main" tabindex="-1">${options.lead ?? ''}${options.active === 'home' ? versionBanner(base) : ''}${options.ads === false ? '' : adStrip(base)}${body}<nav class="site-links" aria-label="안내"><a href="${base}faq.html">FAQ·문의</a><a href="${base}terms.html">이용약관·면책</a><span>투자 권유가 아니에요</span></nav></main>${options.bottomNav === false ? '' : bottomNav(base)}${options.chat === false ? '' : CHAT_HTML}<script src="${base}assets/app.${ASSET_VERSION}.js"></script>${options.scripts ?? ''}<script src="${base}assets/ui.${ASSET_VERSION}.js"></script></body></html>`;
}

/** Phone-only tab bar on the site's own pages (home, pricing). */
function bottomNav(base: string): string {
  return tabBar(base, 'bottom');
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
    // G-185: the band the score falls in is lit; the rest stay as a dim track.
    const on = t && t.score !== null && t.score >= bounds[i]! && (t.score < bounds[i + 1]! || i === 6);
    return `<path class="g-seg${on ? ' on' : ''}" style="color:${color}" d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${color}" stroke-width="12" fill="none" stroke-linecap="butt"/>`;
  }).join('');
  const needle = t && t.score !== null
    ? (() => {
        // Drawn pointing straight up (neutral), then turned clockwise to the score; CSS lets it settle from neutral.
        const turn = (90 - angle(t.score)).toFixed(1);
        return `<g class="needle" style="--r:${turn}deg" transform="rotate(${turn} ${cx} ${cy})"><path d="M${cx - 4} ${cy} L${cx} ${cy - (r - 20)} L${cx + 4} ${cy} Z" fill="#18201f"/><circle class="g-tip" cx="${cx}" cy="${cy - (r - 20)}" r="4"/></g><circle class="g-hub" cx="${cx}" cy="${cy}" r="7" fill="#18201f"/>`;
      })()
    : `<circle cx="${cx}" cy="${cy}" r="7" fill="#c4cbc9"/>`;
  return `<svg viewBox="0 0 220 118" class="gauge" role="img" aria-label="기술적 신호 ${escape(t?.label ?? '없음')}">${arcs}${needle}
<text x="22" y="117" font-size="10" class="g-end">약세</text><text x="198" y="117" font-size="10" class="g-end" text-anchor="end">강세</text></svg>`;
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
  // One vocabulary for direction everywhere (G-131): 강세·중립·약세.
  const trendWord = { UP: '강세', FLAT: '중립', DOWN: '약세' } as const;
  const momentumScale = Math.max(20, Math.ceil(Math.max(0, ...(report.momentum ?? []).map(m => Math.abs(m.returnPct ?? 0))) / 10) * 10);
  // Same card as the horizon gauges (G-124): title and window on top, the gauge, the call under it, the return below.
  const momentum = (report.momentum ?? []).map((m) => `<div class="mom hz"><div class="hz-top"><b>${escape(m.label)}</b><span>${m.days}거래일</span></div>
${miniGauge(m.returnPct === null ? null : m.returnPct / momentumScale, `${m.label} ${m.returnPct === null ? '기록 부족' : pct(m.returnPct)}`)}
<div class="hz-label ${m.trend === 'UP' ? 'up' : m.trend === 'DOWN' ? 'down' : ''}">${m.trend ? trendWord[m.trend] : '판단 보류'}</div>
<div class="hz-meta"><span>수익률 <b class="${m.returnPct === null ? '' : m.returnPct > 0 ? 'up' : m.returnPct < 0 ? 'down' : ''}">${m.returnPct === null ? '기록 부족' : pct(m.returnPct)}</b></span></div></div>`).join('');
  const rows = t.votes.map((v) => `<tr><td class="term-cell">${indicatorKey(v.label)?`<button type="button" class="indicator-link" data-chart-indicator="${indicatorKey(v.label)}" title="차트에서 보기">${escape(v.label)} ↗</button>`:escape(v.label)}</td><td class="num">${v.value === null ? '없음' : Math.abs(v.value) >= 1000 ? Math.round(v.value).toLocaleString('ko-KR') : v.value.toFixed(2)}</td>
<td>${v.vote ? `<span class="badge v-${v.vote}">${VOTE_LABEL[v.vote]}</span>` : '<span class="badge b-LOW">계산 불가</span>'}</td><td class="why">${escape(v.rule)}</td></tr>`).join('');
  return `<div class="grid-signal" id="signal"><div class="card signal"><div class="head"><h2>기술적 신호</h2><span class="sub" style="margin:0">${escape(t.sessionDate)} 종가 기준</span></div>
${gaugeSvg(t)}<div class="signal-label ${tone}">${escape(t.label)}</div>
<p class="reason">${escape(report.technicalReason ?? '')}</p>
<div class="tally">${meta([`강세 ${t.counts.bullish}`, `중립 ${t.counts.neutral}`, `약세 ${t.counts.bearish}`, t.counts.abstained ? `계산 불가 ${t.counts.abstained}` : ''])}</div>
<p class="fine">기술적 지표 ${t.votes.length}개의 요약이에요. 오를 확률이 아니고, 투자 권유가 아니에요.</p></div>
<div class="card"><div class="head"><h2>모멘텀</h2></div><div class="moms">${momentum}</div>
${groupBars(t)}
<p class="fine" style="margin:8px 0 0">바늘은 각 기간의 실제 수익률이에요(세 게이지 모두 끝이 ±${momentumScale}%). 단기 5거래일 ±2%, 중기 20거래일 ±5%, 장기 120거래일 ±10% 안이면 중립이에요.</p>
<details class="votes" id="votes"><summary>지표별 투표 보기</summary><div class="table-wrap"><table><thead><tr><th>지표</th><th>값</th><th>투표</th><th class="why">규칙</th></tr></thead><tbody>${rows}</tbody></table></div></details></div></div>`;
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
  // G-151: the same plain-language note under several filings in a row is said once.
  let prevWhy = '';
  const rows=recent.map((f) => { const why = f.why === prevWhy ? '' : f.why; prevWhy = f.why; return `<tr><td class="col-date nowrap">${escape(f.filedDate)}</td>
<td>${meta([escape(f.filedDate), escape(f.category)], 'meta m-date')}<a href="${escape(f.url)}" rel="noopener" target="_blank">${escape(f.title)}</a>${fresh.has(f.receiptNo) ? '<span class="badge b-new">새 공시</span>' : ''}${why ? `<div class="why">${escape(why)}</div>` : ''}</td>
<td class="col-cat nowrap">${escape(f.category)}</td><td><span class="badge b-${f.importance}">${IMPORTANCE_LABEL[f.importance]}</span></td><td class="col-filer nowrap">${escape(f.filer)}</td></tr>`; });
  return contentMore(rows,'공시',html=>`<div class="table-wrap"><table><thead><tr><th class="col-date">날짜</th><th>공시</th><th class="col-cat">종류</th><th>중요도</th><th class="col-filer">제출인</th></tr></thead><tbody>${html}</tbody></table></div>`);
}

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
  // G-163: the scenarios live once, in 요약's 지금 판단; the committee's write-up does not repeat them.
  const legend = c.evidence.map((e) => `<li><b>${escape(e.id)}</b> ${e.url.startsWith('http') ? `<a href="${escape(e.url)}" rel="noopener" target="_blank">${escape(e.label)}</a>` : escape(e.label)}</li>`).join('');
  const brief = c.tier === 'brief';
  const showClaims = opts.only !== 'structure', showStructure = opts.only !== 'claims';
  if (opts.only === 'claims') return `<div class="card" id="why-claims"><div class="head"><h2>위원회 근거 정리</h2><span class="sub" style="margin:0">강세와 약세 근거 · 불확실한 점 · 판단이 바뀔 수 있는 것</span></div>
<div class="why-grid"><div class="why-col bull"><h3>강세 근거</h3>${list(c.bullish, '찾지 못했어요.')}</div><div class="why-col bear"><h3>약세 근거</h3>${list(c.bearish, '찾지 못했어요.')}</div>${c.uncertain.length ? `<div class="why-col unc"><h3>불확실한 점</h3>${list(c.uncertain, '')}</div>` : ''}</div>
${c.watch.length ? `<h3 class="why-h">판단이 바뀔 수 있는 것</h3>${list(c.watch, '')}` : ''}<details class="more"><summary>근거 목록 ${c.evidence.length}개</summary><ul class="plain evid">${legend}</ul></details>
<p class="fine">AI(${escape(c.servedBy ?? c.model)})가 이 리포트의 근거만 보고 쓴 해설이에요. 틀릴 수 있고, 투자 권유가 아니에요.</p></div>`;
  return `<div class="card" id="why"><div class="head"><h2>${brief ? '간단 해설 (이전 형식)' : opts.committee ? '위원회 결론' : 'AI 위원회 해설'}</h2><span class="sub" style="margin:0">${brief ? '요약 · 강세와 약세 근거 · 지켜볼 것' : opts.committee ? '요약, 레드팀 반론, 시나리오' : '데스크 5곳과 레드팀이 오늘 리포트의 근거만 인용해요'}</span></div>
${c.summary ? `<p class="headline">${kindChip(c.summary.kind)}${escape(c.summary.text)} <span class="chips-inline">${chips(c.summary.evidenceIds)}</span></p>` : ''}
${showStructure ? `${opts.committee ? '' : desks}${red}` : ''}
${showClaims ? `${opts.committee ? '<details class="more why-fold"><summary>근거 정리 · 판단이 바뀔 수 있는 것 · 부족한 근거</summary>' : ''}${desks ? '<h3 class="why-h">근거 정리</h3>' : ''}<div class="why-grid"><div class="why-col bull"><h3>강세 근거</h3>${list(c.bullish, '찾지 못했어요.')}</div>
<div class="why-col bear"><h3>약세 근거</h3>${list(c.bearish, '찾지 못했어요.')}</div>
${c.uncertain.length ? `<div class="why-col unc"><h3>불확실한 점</h3>${list(c.uncertain, '')}</div>` : ''}</div>
${c.watch.length ? `<h3 class="why-h">판단이 바뀔 수 있는 것</h3>${list(c.watch, '')}` : ''}
${c.dataGaps.length ? `<h3 class="why-h">근거가 부족한 부분</h3><ul class="plain">${c.dataGaps.map((g) => `<li>${escape(g)}</li>`).join('')}</ul>` : ''}
<details class="more"><summary>근거 목록 ${c.evidence.length}개</summary><ul class="plain evid">${legend}</ul></details>${opts.committee ? '</details>' : ''}` : `<details class="more"><summary>근거 목록 ${c.evidence.length}개</summary><ul class="plain evid">${legend}</ul></details>`}
${c.promptVersion >= 'gnm-committee-v3' ? '<p class="fine">주장마다 <span class="ck ck-FACT">사실</span><span class="ck ck-INFERENCE">해석</span><span class="ck ck-ASSUMPTION">가정</span>을 표시해요.</p>' : ''}<p class="fine">AI(${escape(c.servedBy ?? c.model)})가 이 리포트의 근거만 보고 쓴 해설이에요. 틀릴 수 있고, 투자 권유가 아니에요.${c.dropped ? ` 근거를 대지 못한 주장 ${c.dropped}개는 뺐어요.` : ''} 프롬프트 ${escape(c.promptVersion)}.</p></div>`;
}

/** G-178: the 뉴스·공시 tab's body, shared by the daily pages and a report generated on request (one look for both). */
export function newsTabBody(report: DailyReport): string {
  return `<div data-slot="news">${newsSection(report) || '<div class="card"><p class="empty">이 리포트에는 뉴스 기록이 없어요.</p></div>'}</div>
<div class="grid2"><div class="card" id="filings"><div class="head"><h2>공시</h2><span class="sub">최근 30일, 제목을 누르면 원문이 열려요</span></div><div data-slot="filings">${filingsTable(report)}</div></div>${mixCard(report.recentFilings ?? report.filings)}</div>${edgeEvents(report)}`;
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
${warn}${rows ? contentMore(rowsArr,'뉴스') : '<p class="empty">최근 7일 동안 관련 뉴스가 없어요.</p>'}
<p class="fine">제목과 언론사, 링크만 모아요(본문은 저장하지 않아요). 비슷한 제목의 기사는 하나의 이야기로 묶고, 기사 수가 많다고 더 중요하게 보지 않아요. 수집: ${escape(statusLine)}</p></div>`;
}

export const TAB_SCRIPT = `<script>
(function () {
  var panels = Array.prototype.slice.call(document.querySelectorAll('[role=tabpanel]'));
  if (!panels.length) return;
  document.documentElement.classList.add('js-tabs');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role=tab]'));
  function show(id, focus) {
    var panel = document.getElementById(id);
    if (panel && panel.getAttribute('role') !== 'tabpanel' && /^tab-/.test(id)) { var host = panel.closest('[role=tabpanel]'), part = panel; if (host && show(host.id, focus)) { setTimeout(function () { part.scrollIntoView({ block: 'start' }); }, 0); return true; } }
    if (!panel || panel.getAttribute('role') !== 'tabpanel') return false;
    var nested = ['tab-technical','tab-strategy','tab-flows','tab-fundamentals'].indexOf(id)>=0;
    var menu=document.getElementById('analysis-menu'),sub=document.getElementById('analysis-tabs');
    if(menu&&sub){sub.hidden=!nested;menu.setAttribute('aria-expanded',String(nested));menu.classList.toggle('active',nested);}
    panels.forEach(function (p) { p.hidden = p !== panel; });
    tabs.forEach(function (t) { var on = t.getAttribute('aria-controls') === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      var on = a.getAttribute('data-nav') === id.replace('tab-', '');
      a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    window.dispatchEvent(new Event('resize'));
    return true;
  }
  var menu=document.getElementById('analysis-menu');if(menu)menu.addEventListener('click',function(){var sub=document.getElementById('analysis-tabs'),open=menu.getAttribute('aria-expanded')!=='true';sub.hidden=!open;menu.setAttribute('aria-expanded',String(open));});
  // Links to a part of a tab (자료 > 기술): open the tab, then scroll to the part.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#tab-"]'); if (!a) return;
    var el = document.getElementById(a.getAttribute('href').slice(1)); if (!el || el.getAttribute('role') === 'tabpanel') return;
    var panel = el.closest('[role=tabpanel]'); if (!panel) return;
    e.preventDefault(); show(panel.id); el.scrollIntoView({ block: 'start' }); history.replaceState(null, '', a.getAttribute('href'));
  });
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
      var visible=tabs.filter(function(t){return !t.closest('[hidden]');}),pos=visible.indexOf(t);var next = visible[(pos + d + visible.length) % visible.length];
      history.replaceState(null, '', '#' + next.getAttribute('aria-controls'));
      show(next.getAttribute('aria-controls'), true);
    });
  });
  window.GNM_showTab=function(key){var id='tab-'+key;if(show(id)){history.replaceState(null,'','#'+id);return true;}return false;};
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
  /** G-61: the commentary given is the public part; the paid part is fetched from the API for this report date. */
  deep?: { date: string } | null;
}

/** The report's page; every price helper inside follows the report's currency (G-179: a US page in dollars). */
export function renderReport(report: DailyReport, links: { index: string; base?: string } & Partial<PageContext>): string {
  return withCurrency(report.currency, () => renderReportIn(report, links));
}
function renderReportIn(report: DailyReport, links: { index: string; base?: string } & Partial<PageContext>): string {
  const base = links.base ?? '../';
  const ctx: PageContext = { base, live: links.live ?? false, homeHref: links.homeHref ?? `${base}index.html`, archiveHref: links.archiveHref ?? `${base}archive.html`, commentaryFrom: links.commentaryFrom ?? null, previous: links.previous ?? null, deep: links.deep ?? null };
  const m = report.market;
  const chart = priceChart(report, chartOverlays(m), base, CHART_ASSET);
  const panel = (key: TabKey, html: string) => `<section class="panel" id="tab-${key}" role="tabpanel" aria-labelledby="t-${key}" tabindex="-1"><h2 class="panel-title">${tabsFor(report.kind).find((t) => t.key === key)!.label}</h2>${html}</section>`;
  const asOf = report.generatedAt.replace('T', ' ').slice(0, 16) + ' UTC';
  // G-71: the conclusion (scenarios that open on tap) heads the summary tab, above everything else.
  const home = `${hero(report, { live: ctx.live, asOf: new Date(Date.parse(report.generatedAt) + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ') + ' KST' })}${reportStatusBar(report, ctx.commentaryFrom ?? null)}${report.kind === 'coin' ? derivSlot(report.symbol) : quickInfoCard(m, report.price?.close ?? null, report.recentBars ?? [])}${conclusionCard(report, { id: 'home-conclusion', title: '지금 판단' })}${edgeCard(report)}
${m ? marketStatusWarning(m) : ''}
<div class="pc-wrap">${personaCards(report)}</div>
${report.kind ? '' : peersSlot(report.symbol)}
<div class="home-lists">${latestLists(report)}</div>`;
  // G-130: the chart alone (the AI summary and the four number cards under it are gone).
  const chartTab = chart.html;
  // Free: the 16-indicator summary (public elsewhere too). Plus: our horizon gauges, fair value, forecasts and structure.
  const technical = `${insightLine(report, 'technical', base)}${signalSection(report)}${gate(`<div class="block">${m ? horizonRow(m.horizons) : ''}</div>${m ? `${valueCard(m, false)}<div style="margin-top:16px">${structureCard(m.structure, m.weeklyStructure)}</div>` : ''}`, { base, what: '기간별 게이지 · 기술적 적정가 · 가격 구조' })}${m ? `<div style="margin-top:16px">${gate(forecastCard(m.forecasts, m.forecastScores), { base, what: '예측 가격 범위(5·20·60·120거래일)와 지난 예측 적중', need: 'pro' })}</div>` : ''}`;
  // Free: the champion's name. Plus: the ranking. Pro: trades, curves, Monte Carlo and chart markers.
  const strategyTab = `${insightLine(report, 'strategy', base)}${m ? arenaHeadline(m.arena) : ''}${gate(m ? arenaPanel(m.arena) : '<div class="card empty">이 리포트에는 전략 대결 기록이 없어요.</div>', { base, what: '매매 시점 · 수익 곡선 · 몬테카를로 · 거래 기록', need: 'pro' })}
<section class="block"><div class="card paper-link"><div><b>모의투자 장부</b><p class="muted small">전략 챔피언과 AI 분석가를 따라 했다면 어땠는지, 리포트 종목 전체를 모아 따로 보여 줘요.</p></div><a class="btn-primary" href="${base}scorecard.html#paper">성적표에서 보기</a></div></section>`;
  // Investor flows and fundamentals are public data: free. Our footprint reading is Plus.
  const flowsTab = insightLine(report, 'flow', base) + (report.kind==='coin' ? coinFlow(report) : `<div data-slot="flows">${m ? flowsPanel(m.flows, m.footprint, (h) => gate(h, { base, what: '수급 흔적(매집·분산 분석)' })) : '<div class="card empty">이 리포트에는 수급 기록이 없어요.</div>'}</div>`) + edgeFlows(report);
  const fundTab = insightLine(report, 'fundamental', base) + `<div data-slot="fundamentals">${(m ? fundamentalsPanel(m, report.price?.close ?? null, report.name, report.recentBars ?? [], report.statements) : '') || '<div class="card empty">기업 정보를 아직 받지 못했어요.</div>'}</div>` + edgeFundamentals(report);
  // G-168: a report written before v3.5.0 may carry the old short summary; it offers the committee report in its place.
  const upgrade = report.commentary?.status === 'OK' && report.commentary.tier === 'brief' ? `<section class="block"><div class="card paper-link"><div><b>이전 형식의 간단 해설이에요</b><p class="muted small">이제 AI 리포트는 모두 AI 위원회 심층 리포트(데스크 5곳·분석가 6명·레드팀·시나리오)로 써요. 이 종목도 심층 리포트로 새로 만들 수 있어요.</p></div><button type="button" class="credit-btn" data-create-report data-symbol="${escape(report.symbol)}" data-name="${escape(report.name)}">심층 리포트 만들기 <small>${CREDIT_COST.report}크레딧</small></button></div></section>` : '';
  // G-114: an older committee says so with a way to a fresh one, on the AI tab as on the summary.
  const fromNote = ctx.commentaryFrom ? (ctx.commentaryFrom < (report.price?.sessionDate ?? report.date) ? reportStatusBar(report, ctx.commentaryFrom) : `<p class="muted small">${escape(ctx.commentaryFrom)} 리포트의 AI 위원회 해설이에요.</p>`) : '';
  const sealedDeep = !!ctx.deep && report.commentary?.status === 'OK' && report.commentary.tier !== 'brief';
  const record = sealedDeep ? '' : recordSection(report, ctx, base);
  const aiTab = report.commentary?.status === 'OK'
    ? `${upgrade}${fromNote}${committeeTab(report, { base, from: ctx.commentaryFrom ?? null, ...(sealedDeep ? { deepDate: ctx.deep!.date } : {}) })}${record}`
    : `${report.commentary?whySection(report):''}${conclusionMini(report)}<section class="block" id="parliament-ai" data-missing><div class="card"><h2>위원회 표결</h2><div class="v2-mask"><div class="v2-mask-shapes" aria-hidden="true"><i></i><i></i><i></i></div><p>🔒 아직 위원회 리포트가 없어요.</p></div></div></section><section class="block" id="debate"><div class="card debate"><h2>위원회 토론</h2><div data-missing class="v2-mask"><div class="v2-mask-shapes" aria-hidden="true"><i></i><i></i><i></i></div><div class="v2-mask-cta"><b>🔒 토론이 아직 생성되지 않았어요</b><button type="button" class="chip-toggle" data-create-report data-symbol="${escape(report.symbol)}" data-name="${escape(report.name)}">리포트 생성</button></div></div>${joinBox(report)}</div></section><section class="block" data-missing><div class="card"><h2>남은 쟁점</h2><p class="empty">🔒 리포트가 생성되면 같은 위치에서 확인할 수 있어요.</p></div></section>`;
  const newsTab = `${insightLine(report, 'news', base)}${newsTabBody(report)}`;
  const p = report.price;
  const bar = p ? priceBar({ name: escape(report.name), symbol: escape(report.symbol), price: escape(won(p.close)), change: p.changePct === null ? '' : `${p.changePct > 0 ? '▲' : p.changePct < 0 ? '▼' : ''} ${escape(pct(p.changePct))}`, tone: tone(p.changePct), badge: freshnessBadge(freshness(report)) }) : '';
  const body = `${bar}${panel('home', home)}
${panel('chart', chartTab)}
${panel('technical', `${technical}<section class="sub-sec" id="tab-strategy"><h2 class="sub-h">전략</h2>${strategyTab}</section>`)}
${panel('fundamentals', `${report.kind === 'coin' ? '' : fundTab}${report.currency === 'USD' ? insiderSection(report) : `<section class="sub-sec${report.kind === 'coin' ? ' sub-first' : ''}" id="tab-flows"><h2 class="sub-h">수급</h2>${flowsTab}</section>`}`)}
${panel('ai', aiTab).replace('role="tabpanel"',`role="tabpanel" data-ai-date="${escape(report.commentary?.status==='OK'?(ctx.commentaryFrom??report.date):'')}"`)}
${panel('news', newsTab)}
<footer id="sources" style="padding:24px 0 0"><p>${report.currency === 'USD' ? '데이터: 네이버 해외 주식 일봉(달러, 미국 현지 날짜)과 지표(PER·EPS·PBR·시가총액·52주), SEC EDGAR(공시·XBRL 재무·Form 4 내부자 거래), 구글 뉴스(영문). 투자자별 수급과 증권가 목표가는 없어요. 환율 변동은 반영하지 않아요.' : report.kind === 'coin' ? '데이터: 업비트 원화 마켓 일봉(가격, 09:00 KST 기준), 네이버 뉴스 검색과 RSS(뉴스). 가상자산은 변동성이 매우 크고 원금 손실 위험이 커요.' : report.kind === 'etf' ? '데이터: Naver 금융 일봉·주봉·분봉(가격), 네이버 증권(수급), 네이버 뉴스 검색과 RSS(뉴스). 기초지수·괴리율·보수는 아직 보지 않아요.' : '데이터: Naver 금융 일봉·주봉·분봉(가격), 네이버 증권(수급·밸류에이션·실적·증권사 리포트 목록), OpenDART(공시), 네이버 뉴스 검색과 RSS(뉴스).'} ${ctx.live ? `이 페이지는 실행할 때마다 최신 데이터로 다시 만들어요 (${escape(asOf)}).` : `${escape(report.date)} 리포트는 만든 뒤 고치지 않아요.`}</p>
<p>적정가와 예측 범위는 계산 결과이고, 투자 권유가 아니에요. <a href="${ctx.archiveHref}">지난 리포트 보기</a></p></footer>`;
  const title = ctx.live ? `${report.name} 리서치 대시보드 | GNOMON` : `${report.name} ${report.date} 일일 리포트 | GNOMON`;
  return shell(base, title, body, { tabs: tabsFor(report.kind), scripts: chart.script + TAB_SCRIPT + DART_SCRIPT + PARLIAMENT_SCRIPT + AI_FOLD_SCRIPT + EVIDENCE_SCRIPT + DEBATE_FILTER_SCRIPT + DEBATE_PLAY_SCRIPT + (sealedDeep ? DEEP_SCRIPT : ''), archiveHref: ctx.archiveHref, homeHref: ctx.homeHref });
}

/**
 * G-115: the AI committee tab's body — conclusion, the seat chart, then the debate with its evidence, the
 * reader's turn and what is left open. One renderer for daily pages and for reports generated on request.
 */
export function committeeTab(report: DailyReport, opts: { base: string; from: string | null; deepDate?: string }): string {
  const base = opts.base, isBrief = report.commentary?.status === 'OK' && report.commentary.tier === 'brief';
  const aiBody = isBrief
    ? gate(whySection(report), { base, what: '간단 해설(이전 형식): 요약 · 강세와 약세 근거 · 지켜볼 것' })
    : opts.deepDate
      ? ''
      : report.commentary?.status === 'OK'
      ? `${gate(debateSection(report, evidenceFold(report)) || whySection(report, { only: 'claims' }), { base, what: '위원회 토론: 분석가·데스크가 근거를 들어 서로 반박해요' })}<section class="block join-wrap"><div class="card">${joinBox(report)}</div></section>${gate(issuesSection(report), { base, what: '남은 쟁점 · 최악의 경우 · 스스로 점검할 것', need: 'pro' })}`
      : whySection(report);
  const seats = parliament(report, opts.from, { id: 'parliament-ai', title: '위원회 표결', factions: ['ai', 'desk'], link: null, note: '좌석 하나가 위원 한 명이에요. 좌석이나 이름을 누르면 그 위원의 판단·확신도·근거가 나와요. 진한 좌석이 내 보기 방식의 위원회예요(전체 메뉴의 내 보기 방식에서 바꿀 수 있어요).' }).replace('<div class="pl-figure">', `${parliamentViewNote(report)}<div class="pl-figure">`);
  // G-172: the paid part's unlock card comes right under 결론, not after the seats at the bottom.
  // G-178: every report keeps the same order of blocks; a block this report cannot fill says so instead of vanishing.
  return `${conclusionMini(report)}${!isBrief && opts.deepDate ? deepSlot(report.symbol, opts.deepDate) : ''}${seats || absentBlock('위원회 표결', '이 리포트에는 위원별 표결이 없어요. 새 리포트를 만들면 분석가 6명과 데스크 5곳의 표결이 함께 나와요.')}${aiBody}${opts.deepDate ? `<section class="block join-wrap"><div class="card">${joinBox(report)}</div></section>` : ''}`;
}
/** A block the report does not have, folded, so pages of different vintages still line up. */
export function absentBlock(title: string, why: string): string {
  return `<section class="block absent-block"><details class="card"><summary><b>${escape(title)}</b> <span class="muted">이 리포트에는 없어요</span></summary><p class="muted small">${escape(why)}</p></details></section>`;
}

/** The paid part of a committee report (G-61), rendered from the full commentary and sealed into <symbol>/deep/<date>.txt. */
export function renderDeep(report: DailyReport, ctx: { live: boolean; previous?: DailyReport | null }): string {
  return `<div class="deep-body"><div class="deep-swap" hidden>${conclusionCard(report, { id: 'home-conclusion', title: '지금 판단' })}</div>${debateSection(report, evidenceFold(report)) || whySection(report, { only: 'claims' })}${issuesSection(report)}${weekDiffSection(report, ctx.previous ?? null)}${decisionTrace(report, ctx.live)}</div>`;
}

export const DEEP_UNLOCK_CREDITS = 10;
const DEEP_WHAT = '위원회 토론 · 위원별 근거 · 시나리오 전개와 무효화 조건 · 최악의 경우 · 강세·약세 근거 전체 · 분석가 순위 · 지난 리포트 대비';
/**
 * G-70: the commentary's summary and its evidence, folded at the bottom of the debate card: bull and
 * bear claims, uncertain points, and every numbered source (the debate's evidence chips jump here).
 */
function evidenceFold(report: DailyReport): string {
  const c = report.commentary;
  if (c?.status !== 'OK') return '';
  const byId = new Map(c.evidence.map((e) => [e.id, e]));
  const ids = (xs: readonly string[]) => xs.filter((id) => byId.has(id)).map((id) => `<span class="chip">${escape(id)}</span>`).join('');
  const list = (cls: readonly Claim[]) => (cls.length ? `<ul class="claims">${cls.map((cl) => `<li>${kindChip(cl.kind)}${escape(cl.text)} <span class="chips-inline">${ids(cl.evidenceIds)}</span></li>`).join('')}</ul>` : '<p class="empty">없어요.</p>');
  const src = c.evidence.map((e) => `<li data-ev-id="${escape(e.id)}"><b>${escape(e.id)}</b> ${e.url.startsWith('http') ? `<a href="${escape(e.url)}" rel="noopener" target="_blank">${escape(e.label)}</a>` : escape(e.label)}</li>`).join('');
  return `<details class="db-ev"><summary><span>해설·근거 정리 <span class="muted small">강세 ${c.bullish.length} · 약세 ${c.bearish.length} · 자료 ${c.evidence.length}개</span></span></summary>
${c.summary ? `<p class="sum">${kindChip(c.summary.kind)}${escape(c.summary.text)}</p>` : ''}
<div class="why-grid"><div class="why-col bull"><h3>강세 근거</h3>${list(c.bullish)}</div><div class="why-col bear"><h3>약세 근거</h3>${list(c.bearish)}</div><div class="why-col unc"><h3>불확실한 점</h3>${list(c.uncertain)}</div></div>
${c.dataGaps.length ? `<h3 class="why-h">근거가 부족한 부분</h3><ul class="plain">${c.dataGaps.map((g) => `<li>${escape(g)}</li>`).join('')}</ul>` : ''}
<h3 class="why-h">근거 자료 ${c.evidence.length}개</h3><ul class="plain evid">${src}</ul>
<p class="fine">AI(${escape(c.servedBy ?? c.model)})가 이 리포트의 근거만 보고 썼어요. 근거 번호가 없는 주장은 뺐어요${c.dropped ? `(이번에 ${c.dropped}개)` : ''}. 틀릴 수 있고, 투자 권유가 아니에요.</p></details>`;
}

/** G-68: the paper trail, last and small: what changed since the last report, and the inputs behind this one. */
function recordSection(report: DailyReport, ctx: { previous?: DailyReport | null; live: boolean }, base: string): string {
  const body = weekDiffSection(report, ctx.previous ?? null) + decisionTrace(report, ctx.live);
  return body ? `<div class="ai-record">${gate(body, { base, what: '기록: 지난 리포트 대비 · 이 판단을 만든 입력', need: 'pro' })}</div>` : '';
}

export function deepSlot(symbol: string, date: string): string {
  return `<section class="block deep-slot" id="deep-slot" data-symbol="${escape(symbol)}" data-date="${escape(date)}"><div class="card deep-lock v2-mask"><div class="v2-mask-shapes" aria-hidden="true"><i></i><i></i><i></i></div><div class="dl-ic" aria-hidden="true">🔒</div><div><b>심층 리포트</b><p class="muted small">${DEEP_WHAT}</p><div class="dl-row"><button type="button" class="btn-primary" id="deep-open" disabled>불러오는 중…</button><span class="muted small" id="deep-note"></span></div></div></div></section>`;
}

export const DEEP_SCRIPT = `<script>
(function () {
  var slot = document.getElementById('deep-slot'); if (!slot) return;
  var sym = slot.getAttribute('data-symbol'), date = slot.getAttribute('data-date'), btn = document.getElementById('deep-open'), note = document.getElementById('deep-note');
  var path = '/deep/' + encodeURIComponent(sym) + '/' + date;
  var show = function (html) { if(!slot.isConnected)return;slot.innerHTML = html;
    // The unlocked conclusion and vote (full scenarios and reasons) take the public ones' places.
    var sw = slot.querySelector('.deep-swap'); if (sw) { [].slice.call(sw.children).forEach(function (n) { var old = n.id && document.getElementById(n.id); if (old && old !== n) old.replaceWith(n); }); sw.remove(); }
    var join=document.querySelector('.join-wrap'), debate=slot.querySelector('#debate .card.debate');if(join&&debate){debate.appendChild(join.querySelector('.db-join'));join.remove();}slot.classList.add('deep-open'); if (window.GNM_fold) window.GNM_fold(slot, 1); if (window.GNM_debateFilter) window.GNM_debateFilter(); if (window.GNM_debate) window.GNM_debate(); };
  var say = function (t) { note.textContent = t; };
  // While the paid part is fetched or unlocked: a large Thinking Orb that cycles through its states.
  var loader = null, cycle = null;
  var busy = function (text) { if (loader) { loader.querySelector('span').textContent = text; return; } loader = document.createElement('div'); loader.className = 'orbs-load deep-loader'; loader.setAttribute('role', 'status'); loader.innerHTML = '<canvas data-orb="connecting" aria-hidden="true"></canvas><span></span><small>위원 판단 · 시나리오 · 토론을 펼치는 중</small>'; loader.querySelector('span').textContent = text; slot.classList.add('deep-loading'); slot.appendChild(loader); var states = ['connecting', 'weaving', 'composing', 'shaping'], i = 0; cycle = setInterval(function () { var c = loader && loader.querySelector('canvas'); if (c) c.dataset.orb = states[++i % states.length]; }, 1600); };
  var idle = function () { clearInterval(cycle); cycle = null; if (loader) loader.remove(); loader = null; slot.classList.remove('deep-loading'); };
  if (!window.GNM || !GNM.api) { btn.textContent = '알파 서버 연결 뒤 열 수 있어요'; return; }
  (GNM.ready || Promise.resolve(null)).then(function (me) {
    if (!me) { btn.disabled = false; btn.textContent = '로그인하고 열기'; btn.onclick = function () { location.href = (document.body.getAttribute('data-base') || '') + 'login.html?return=' + encodeURIComponent(location.pathname.split('/').slice(-2).join('/') + '#tab-ai'); }; return; }
    busy('심층 리포트를 불러오고 있어요');
    GNM.call('GET', path).then(function (r) {
      idle();
      if (r.html) { show(r.html); return; }
      if(r.error === 'PLAN_REQUIRED'){btn.disabled=false;btn.textContent='요금제 보기';say(r.message||'플러스부터 열 수 있어요');btn.onclick=function(){location.href=(document.body.getAttribute('data-base')||'')+'pricing.html';};return;}
      if (r.error === 'NOT_SEALED') { btn.textContent = '아직 준비 중이에요'; say('심층 리포트는 다음 실행 뒤 열 수 있어요.'); return; }
      var cost = r.cost || ${DEEP_UNLOCK_CREDITS}, bal = r.balance, free = r.freeLeft > 0;
      var label = function () { return free ? '무료로 열기' : cost + '크레딧으로 열기'; };
      btn.disabled = false; btn.textContent = label();
      say(free ? '이번 달 무료로 열 수 있는 리포트가 ' + r.freeLeft + '개 남았어요 · 한 번 열면 계속 볼 수 있어요' : bal == null ? '' : '남은 크레딧 ' + bal + '개 · 한 번 열면 계속 볼 수 있어요 · 7일 지나면 무료예요');
      btn.onclick = function () {
        btn.disabled = true; btn.textContent = '여는 중…'; busy('크레딧을 쓰고 심층 리포트를 여는 중이에요');
        GNM.call('POST', path + '/unlock', {}).then(function (u) {
          idle();
          if (u.html) { show(u.html); if (GNM.toast && (u.free || u.charged)) GNM.toast(u.free ? '무료로 열었어요. 이번 달 ' + (u.freeLeft || 0) + '개 더 무료예요' : u.charged ? u.charged + '크레딧을 썼어요. 남은 크레딧 ' + u.balance : ''); if (GNM.refresh) GNM.refresh(); if (GNM.track) GNM.track('deep_unlock', { symbol: sym }); return; }
          btn.disabled = false; btn.textContent = label(); say(u.message || '열지 못했어요.');
          if (u.error === 'NO_CREDITS' && GNM.openChat) GNM.openChat();
        });
      };
    });
  });
})();
</script>`;

/**
 * The AI committee tab (G-60, revised): no folding; a row of section links at the top so a reader can
 * jump straight to the debate, the scenarios or the evidence. Rebuilt when the deep part arrives.
 */
const AI_FOLD_SCRIPT = `<script>
window.GNM_fold = function () {
  var tab = document.getElementById('tab-ai'); if (!tab) return;
  var old = tab.querySelector('.ai-nav'); if (old) old.remove();
  var items = [];
  tab.querySelectorAll('.card > .head > h2, section.block > .block-head > h2').forEach(function (h, i) {
    if (h.closest('.gate-cta, .deep-lock')) return;
    var box = h.closest('.card, section.block'); if (!box.id) box.id = 'ai-sec-' + i;
    items.push('<a href="#' + box.id + '">' + h.textContent.replace(/\\s+/g, ' ').trim() + '</a>');
  });
  if (items.length < 3) return;
  var nav = document.createElement('nav'); nav.className = 'ai-nav'; nav.setAttribute('aria-label', 'AI 위원회 바로 가기'); nav.innerHTML = items.join('');
  var title = tab.querySelector('.panel-title'); (title || tab.firstChild).insertAdjacentElement(title ? 'afterend' : 'beforebegin', nav);
  nav.addEventListener('click', function (e) { var a = e.target.closest('a'); if (!a) return; e.preventDefault(); var el = document.querySelector(a.getAttribute('href')); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
};
window.GNM_fold();
</script>`;



/** G-66: one place to join the debate. Ask the committee (opens the chat with the question) or seat an
 *  expert who answers it from this stock's evidence (Pro credits, Max monthly allowance). Replaces the
 *  separate "AI에게 직접 질문" and "전문가 AI 초청" boxes. */
export function joinBox(report: Pick<DailyReport, 'symbol' | 'name'>): string {
  const who = [{ key: 'committee', name: '위원회 전체', focus: '지금 토론한 위원들이 답해요' }, ...EXPERTS];
  return `<div class="db-join" id="join"><form class="invite join" data-symbol="${escape(report.symbol)}" data-name="${escape(report.name)}">
<div class="jn-input"><button type="button" class="jn-plus" data-pick-expert aria-label="답변할 전문가 선택" title="전문가 선택">+</button><label class="jn-q"><textarea name="q" rows="1" maxlength="600" aria-label="토론에 질문" placeholder="토론에 질문하세요"></textarea></label><button type="submit" class="jn-send" aria-label="질문 전송" title="전송">➤</button></div>
<small class="muted jn-cost" data-selected-expert>위원회 전체 · ${CREDIT_COST.standard}크레딧 / 질문</small>
<dialog class="v2-dialog"><header><b>답변자 선택</b><button type="button" class="dialog-x" data-close-expert aria-label="닫기">×</button></header><div class="ex-grid">${who.map((e, i) => `<label class="ex"><input type="radio" name="expert" value="${e.key}"${i ? '' : ' checked'}><span><b>${e.name}</b><small>${e.focus}</small></span></label>`).join('')}</div><div data-custom-list></div><button type="button" class="chip-toggle" data-new-expert>+ 내 전문가</button><section data-expert-editor hidden><label>이름<input name="custom-name" maxlength="40" placeholder="예: 보수적인 반도체 전문가"></label><label>전문 분야·분석 관점<textarea name="custom-focus" maxlength="600" rows="3" placeholder="예: 설비투자와 현금흐름 중심으로 위험을 점검"></textarea></label><label>답변 스타일<select name="custom-style"><option>짧고 쉽게</option><option>숫자와 근거 중심</option><option>반대 근거와 위험 중심</option></select></label><div class="compact-actions"><button type="button" class="chip-toggle" data-save-expert>저장</button><button type="button" class="chip-toggle" data-cancel-expert>취소</button></div><small data-expert-error role="status"></small></section><p class="fine">전문가 질문 ${CREDIT_COST.invite}크레딧 · 프로부터</p></dialog><div class="ask-out" hidden aria-live="polite"></div></form></div>`;
}

export function renderIndex(reports: readonly Pick<DailyReport, 'date' | 'headline' | 'name' | 'status'>[], links: { base?: string; homeHref?: string; name?: string } = {}): string {
  const sorted = [...reports].sort((a, b) => (a.date < b.date ? 1 : -1));
  const base = links.base ?? '';
  const name = links.name ?? sorted[0]?.name ?? '';
  // The archive sits next to its reports/ folder, so report links are relative to it.
  const body = `<section class="hero" id="archive-top"><div class="orb" aria-hidden="true"></div><div class="hero-main"><div class="eyebrow"><span>지난 리포트</span><span>${sorted.length}건</span></div><h1>${escape(name)} 일일 리포트</h1>
<p class="hero-line">리포트는 만든 날의 장 마감 데이터로 쓰고, 만든 뒤에는 고치지 않아요. 최신 데이터는 대시보드에서 볼 수 있어요.</p></div></section>
<section class="block" id="archive"><div class="card list">${sorted.length ? sorted.map((r) => `<div class="row-item"><span class="badge ${r.status === 'SESSION' ? 'b-MEDIUM' : 'b-LOW'}">${r.status === 'SESSION' ? '거래일' : '휴장'}</span><div class="ri-main"><a href="reports/${escape(r.date)}.html">${escape(r.date)}</a><div class="muted small">${escape(r.headline)}</div></div></div>`).join('') : '<p class="empty">아직 리포트가 없어요.</p>'}</div></section>
<footer id="sources" style="padding:24px 0 0"><p>데이터: Naver 금융, 네이버 증권, OpenDART, 네이버 뉴스 검색과 RSS. 투자 권유가 아니에요.</p></footer>`;
  return shell(base, `${name} 지난 리포트 | GNOMON`, body, { archiveHref: 'archive.html', homeHref: links.homeHref ?? 'index.html' });
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
  var won = function (v) { var a = Math.abs(v); return (a >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: a >= 1 ? 2 : 4 })) + '원'; };
  var MKT = { KOSPI: '코스피', KOSDAQ: '코스닥', ETF: 'ETF', COIN: '코인 · 업비트', UPBIT: '코인 · 업비트', US: '미국 주식' };
  var load = function () {
    if (items) return Promise.resolve(items);
    return fetch('search.json').then(function (r) { return r.json(); }).then(function (d) {
      items = d.items.map(function (x, i) { return { c: x[0], n: x[1], m: x[2], p: x[3], x: x[4], r: x[5], k: norm(x[1]), h: cho(norm(x[1])), e: '', i: i }; });
      // ETFs and coins come from their own lists; either may be missing.
      var have = {}; items.forEach(function (it) { have[it.c] = 1; });
      // G-188: the lists download side by side and merge in this order; usnames.json (every listed US stock, names
      // only) comes last, so a computed US row keeps its price.
      var rows = function (url) { return fetch(url).then(function (r) { return r.json(); }).then(function (d) { return d.rows || []; }).catch(function () { return []; }); };
      var merge = function (xs, kind) { xs.forEach(function (x) {
        if (have[x[0]]) return; have[x[0]] = 1;
        var sym = kind === 'COIN' ? x[0].replace('KRW-', '') : kind === 'US' ? x[0].replace(/${US_EXCHANGE_LETTER}/, '') : x[0];
        items.push({ c: x[0], n: x[1], m: kind, p: x[4], x: x[5], r: 0, k: norm(x[1]), h: cho(norm(x[1])), e: norm(sym + ' ' + (x[2] || '')), i: items.length });
      }); };
      var lists = [['etfs.json', 'ETF'], ['coins.json', 'COIN'], ['usstocks.json', 'US'], ['usnames.json', 'US']];
      return Promise.all(lists.map(function (l) { return rows(l[0]); })).then(function (all) { all.forEach(function (xs, i) { merge(xs, lists[i][1]); }); return items; });
    });
  };
  var score = function (it, t, onlyCho) {
    if (it.c === t) return 0;
    if (onlyCho) return it.h.indexOf(t) === 0 ? 2 : it.h.indexOf(t) > 0 ? 4 : -1;
    if (it.k === t) return 0;
    if (it.c.indexOf(t) === 0 || it.k.indexOf(t) === 0 || (it.e && it.e.indexOf(t) === 0)) return 1;
    if (it.e && it.e.indexOf(t) > 0) return 3;
    if (it.k.indexOf(t) > 0) return 3;
    return -1;
  };
  var render = function (list, t) {
    if (!t) { out.hidden = true; out.innerHTML = ''; return; }
    var onlyCho = /^[ㄱ-ㅎ]+$/.test(t);
    var hits = list.map(function (it) { return [score(it, t, onlyCho), it]; }).filter(function (p) { return p[0] >= 0; })
      .sort(function (a, b) { return a[0] - b[0] || b[1].r - a[1].r || a[1].i - b[1].i; }).slice(0, 20);
    out.hidden = false;
    if (!hits.length) { out.innerHTML = '<p class="empty">찾는 종목이 없어요. 종목·ETF 이름이나 6자리 코드, 미국 주식 이름이나 티커(AAPL), 코인 이름이나 심볼로 찾아 보세요.</p>'; return; }
    out.innerHTML = hits.map(function (p) {
      var it = p[1], ch = it.x;
      var price = it.p == null ? '' : '<span class="sr-price"><b>' + (it.m === 'US' ? '$' + Number(it.p).toFixed(2) : won(it.p)) + '</b>' + (ch == null ? '' : ' <span class="' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '">' + (ch > 0 ? '+' : '') + ch.toFixed(2) + '%</span>') + '</span>';
      var right = it.r ? '<a class="sr-go" href="' + esc(it.c) + '/index.html">리포트 보기 ›</a>' : it.m === 'COIN' ? '<a class="sr-go" href="coin.html?m=' + esc(it.c) + '">차트 보기 ›</a>' : it.m === 'US' ? '<a class="sr-go" href="us.html?s=' + encodeURIComponent(it.c) + '">차트 보기 ›</a>' : '<a class="sr-go sr-lock" href="stock.html?c=' + esc(it.c) + '">' + LOCK + '차트 보기 ›</a>';
      return '<div class="row-item sr-row"><div class="ri-main"><b>' + esc(it.n) + '</b><div class="muted small">' + esc(it.c.replace('KRW-', '')) + ' · ' + (MKT[it.m] || it.m) + '</div></div>' + price + right + '</div>';
    }).join('');
  };
  q.addEventListener('input', function () {
    clearTimeout(timer);
    var t = norm(q.value);
    if(!t){out.hidden=true;out.innerHTML='';return;}out.hidden=false;out.innerHTML='<div class="orbs-load">${ORBS}<span>종목을 찾고 있어요</span></div>';
    timer = setTimeout(function () { window.GNM_loading.min(load()).then(function (list) { if(norm(q.value)!==t)return;render(list, t); }, function () { out.hidden = false; out.innerHTML = '<p class="empty">종목 목록을 불러오지 못했어요.</p>'; }); }, 120);
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
export function renderStockPage(kindArg: 'stock' | 'coin' | 'us' | boolean = 'stock'): string {
  const kind = kindArg === true ? 'coin' : kindArg === false ? 'stock' : kindArg, coin = kind === 'coin', us = kind === 'us';
  const locked = LOCKED.map(([t, d]) => `<div class="card locked"><div class="lk-head">${LOCK}<b>${t}</b></div><p>${d}</p><div class="lk-ghost" aria-hidden="true"><i></i><i></i><i></i></div></div>`).join('');
  const open = `<section class="block"><div class="grid-eq"><div class="card"><div class="pl-k">기간별 등락</div><div class="sp-moves" id="sp-moves"></div></div>
<div class="card"><div class="pl-k">지표 16개 판단</div><div class="sp-votes" id="sp-votes"></div></div></div></section>`;
  const detail = `<section class="block"><div class="block-head"><h2>기술적 적정가</h2><span class="muted small">장 마감 뒤 갱신</span></div><div class="card"><div id="sp-fair"><p class="empty">기록이 모자라 계산하지 못했어요.</p></div></div></section>`;
  const forecast = `<section class="block"><div class="block-head"><h2>예측 가격 범위 (10~90%)</h2></div><div class="card"><div id="sp-fc"><p class="empty">기록이 모자라 계산하지 못했어요.</p></div><p class="fine">최근 변동성으로 계산한 범위예요. 확률이나 목표가가 아니에요.</p></div></section>`;
  // G-185: one loading screen until the stock's numbers are in, instead of a half-drawn page with placeholders.
  let body = `<div class="page-load" id="page-load" role="status" aria-live="polite"><canvas data-orb="connecting" data-size="72" aria-hidden="true"></canvas><b>종목 정보를 불러오고 있어요</b><i class="pl-track"><i></i></i></div>${priceBar({ name: '<span id="pb-name"></span>', symbol: '<span id="pb-code"></span>', price: '<span id="pb-price"></span>', change: '<span id="pb-change"></span>', tone: '', badge: '' })}<section class="hero stock-hero" id="top"><div class="hero-main"><div class="eyebrow"><span id="sp-code"></span><span id="sp-market"></span><span data-report-state>AI 리포트 확인 중</span></div>
<div class="h1-row"><h1 id="sp-name" class="skel">종목 이름</h1>${starButton('', '이 종목', 'sp-star')}</div><div class="hero-price" id="sp-price"></div><div class="hero-sub" id="sp-date"></div></div>
${coin ? derivSlot('') : ''}${coin ? '<div class="request-card"><div class="lk-head"><b>코인 무료 계산</b></div><p>업비트 원화 마켓 일봉으로 주식과 같은 지표 16개, 기간별 등락, 기술적 적정가를 계산해요. 코인 AI 리포트는 매일 거래대금 상위 코인 가운데 하나씩 써요.</p><p class="fine">코인은 24시간 거래돼서 일봉은 매일 09:00(KST)에 끊어요. 변동성이 커서 예측 범위가 넓어요.</p></div>' : `<div class="request-card"><div class="lk-head">${LOCK}<b>AI 리포트는 아직 없어요</b></div><p>${us ? '요청하면 국내 종목과 같은 AI 위원회가 달러 가격과 미국 현지 날짜로 분석해요. 국내 수급·공시 근거는 없어서 그 판단은 보류해요.' : '요청하면 바로 분석을 시작해요. 최신으로 확보된 데이터 기준으로 작성합니다.'} 크레딧 요청은 플러스부터예요.</p>
<span class="req-btns">${genButton('심층 리포트 만들기', 'data-create-report id="sp-request-credit"', `${CREDIT_COST.report}크레딧`)}</span>
<p class="fine">남은 크레딧 <b data-credits>0</b>개 · <a href="pricing.html#credits">충전</a> · <a id="sp-request" href="${REPO_URL}/issues/new" target="_blank" rel="noopener">운영 문의</a></p></div>`}</section>
${coin || us ? '' : peersSlot('')}<section class="block"><div class="card sp-one"><div class="sp-one-head"><span class="pl-k">한 줄 요약</span><b id="sp-signal" class="sp-signal">계산 중</b></div><p class="headline skel" id="sp-line">이 종목의 계산 결과를 불러오는 중이에요.</p><div class="pl-tally" id="sp-tally" aria-hidden="true"></div><p class="muted small" id="sp-counts"></p></div></section>
<section class="block"><div class="card chart-card"><div class="chart-head"><div><div class="muted small">최근 1년 일봉</div><div class="period-stat" id="period-stat" aria-live="polite"></div></div>
<div class="seg" role="group" aria-label="기간">${[['1개월', 21], ['3개월', 63], ['6개월', 126], ['1년', 250]].map(([l, n]) => `<button type="button" data-range="${n}" aria-pressed="${n === 126}">${l}</button>`).join('')}</div></div>
<div id="chart" style="height:420px"><div class="orbs-load" id="sp-loading">${ORBS}<span>차트를 불러오는 중이에요</span></div><p class="empty" id="sp-empty" hidden>차트 데이터를 불러오지 못했어요. 상장 종목 코드가 맞는지 확인해 주세요.</p></div>
<p class="fine" id="sp-ma-note">이동평균 20·60과 거래량이에요.</p></div></section>
${open}${gate(detail, { base: '', what: '기술적 적정가' })}${gate(forecast, { base: '', what: '예측 가격 범위', need: 'pro' })}
${coin || us ? '' : `<section class="block"><div class="block-head"><h2>AI 리포트가 생기면 열리는 분석</h2></div><div class="locked-grid">${locked}</div></section>`}
<footer id="sources" style="padding:24px 0 0"><p>${us ? '데이터: 네이버 해외 주식 일봉(달러, 미국 현지 날짜)과 지표, SEC EDGAR 공시·XBRL 재무·Form 4 내부자 거래, 영문 뉴스. 매일 저녁 갱신하고, 시세는 실시간이에요. 환율 변동은 반영하지 않아요.' : coin ? '데이터: 업비트 원화 마켓 일봉(09:00 KST 기준). 매일 저녁 갱신해요. 가상자산은 원금 손실 위험이 커요.' : '데이터: Naver 금융 일봉. 매일 장 마감 뒤 갱신해요.'} 계산 결과이고, 투자 권유가 아니에요.</p></footer>`;
  const split=body.indexOf('<section class="block"><div class="card chart-card">');
  const ending=body.indexOf('<footer id="sources"');
  const techAt=body.indexOf('<section class="block"><div class="grid-eq">',split);
  const head=body.slice(0,split), chart=body.slice(split,techAt), technical=body.slice(techAt,ending);
  const missing=(label:string)=>`<section class="block" data-missing>${label?`<h2>${label}</h2>`:''}<div class="v2-mask"><div class="v2-mask-shapes" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="v2-mask-cta"><b>🔒 아직 생성되지 않은 분석이에요</b><p>리포트를 생성하면 이 영역에서 확인할 수 있어요.</p><button type="button" class="btn-primary" data-create-report>심층 리포트 생성하기</button></div></div></section>`;
  // G-192: a US stock's 기업 체력 and 뉴스·공시 are filled from the API (/usinfo) instead of locked until a report.
  const usSlot=(key:string)=>`<div data-slot="us-${key}"><section class="block"><div class="card us-wait" style="display:flex;align-items:center;gap:10px;color:var(--fg2);font-size:14px"><span class="orbs" aria-hidden="true"><i></i><i></i><i></i></span> ${key==='news'?'SEC 공시와 영문 뉴스를 불러오고 있어요.':'재무·밸류에이션·내부자 거래를 불러오고 있어요.'}</div></section></div>`;
  const usHome=us?'<div data-slot="us-edge"></div><div data-slot="us-latest"></div>':'';
  body=`<section class="panel" id="tab-home" role="tabpanel" aria-labelledby="t-home">${head}${usHome}</section><section class="panel" id="tab-chart" role="tabpanel" aria-labelledby="t-chart" hidden>${chart}</section><section class="panel" id="tab-technical" role="tabpanel" aria-labelledby="t-technical" hidden>${technical}<section class="sub-sec" id="tab-strategy"><h2 class="sub-h">전략</h2>${missing('전략 대결 · 모의투자')}</section></section>${[{key:'fundamentals',label:coin?'수급':'기업 체력'},{key:'ai',label:'AI 위원회'},{key:'news',label:'뉴스·공시'}].map(t=>`<section class="panel" id="tab-${t.key}" role="tabpanel" aria-labelledby="t-${t.key}" hidden>${t.key==='fundamentals'&&coin?'':us&&(t.key==='fundamentals'||t.key==='news')?usSlot(t.key):missing(t.label)}${t.key==='fundamentals'?`${us?'':`<section class="sub-sec${coin?' sub-first':''}" id="tab-flows"><h2 class="sub-h">수급</h2>${missing('')}</section>`}`:''}${t.key==='ai'?`<section class="block join-wrap"><div class="card">${joinBox({symbol:'',name:'이 종목'})}</div></section>`:''}</section>`).join('')}${body.slice(ending)}`;
  return shell('', coin ? '코인 차트 | GNOMON' : us ? '미국 주식 차트 | GNOMON' : '종목 차트 | GNOMON', body, { tabs: tabsFor(kind), bottomNav: true, scripts: `<script src="${CHART_ASSET}"></script>${stockScript(kind)}${TAB_SCRIPT}${DEBATE_FILTER_SCRIPT}${DEBATE_PLAY_SCRIPT}${PARLIAMENT_SCRIPT}` });
}

/** The free chart page; coins (upbit KRW markets) reuse it with their own data folder and wording. */
const stockScript = (kind: 'stock' | 'coin' | 'us') => `<script>
(function () {
  var COIN = ${kind === 'coin'}, US = ${kind === 'us'};
  var code = (new URLSearchParams(location.search).get(COIN ? 'm' : US ? 's' : 'c') || '').toUpperCase();
  if (US) document.documentElement.setAttribute('data-ccy', 'USD');
  var $ = function (id) { return document.getElementById(id); };
  // Coins can trade below 100원: keep the decimals they are quoted in.
  var won = US ? function (v) { return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: Math.abs(v) < 1 ? 4 : 2 }); } : function (v) { var a = Math.abs(v); return (a >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: a >= 1 ? 2 : 4 })) + '원'; };
  var pageReady = function () { var pl = document.getElementById('page-load'); if (!pl || pl.classList.contains('out')) return; pl.classList.add('out'); setTimeout(function () { pl.remove(); }, 400); }; setTimeout(pageReady, 12000);
  var fail = function () { pageReady(); var ld = document.getElementById('sp-loading'); if (ld) ld.remove(); $('sp-empty').hidden = false; $('sp-name').textContent = code ? code : '종목을 찾지 못했어요'; document.querySelectorAll('.skel').forEach(function (x) { x.classList.remove('skel'); }); };
  if (!(COIN ? /^KRW-[A-Z0-9]{1,15}$/ : US ? /^(?!KRW-)[A-Z][A-Z0-9-]{0,9}(\\.[A-Z])?$/ : /^[0-9A-Z]{6}$/).test(code)) { fail(); return; }
  // Public panels exist only for symbols with research (G-118); others never ask for them (no 404 per visit).
  var loadPanels = function () { fetch('research/'+code+'.panels.json').then(function(r){if(!r.ok)return {};return r.json();}).then(function(parts){Object.keys(parts).forEach(function(key){var panel=document.getElementById('tab-'+key);if(panel&&parts[key]){panel.querySelectorAll('[data-missing]').forEach(function(x){x.remove();});var section=document.createElement('section');section.setAttribute('data-public',key);section.innerHTML=parts[key];panel.prepend(section);}});}).catch(function(){}); };
  // Stocks with an AI report have their own page and no s/<code>.json: go there instead.
  var toReport = function () { if(new URLSearchParams(location.search).get('job')) return Promise.resolve(false);return fetch(code + '/index.html', { method: 'HEAD' }).then(function (r) { if (r.ok) { location.replace(code + '/index.html'); return true; } return false; }, function () { return false; }); };
  // G-188: a US stock outside the daily set: the API builds its page on demand; the name comes from the directory list.
  // G-192: 기업 체력, 뉴스·공시 and the summary's latest lists of a US stock, from the API (SEC, Naver, English news).
  var usInfo = function (d) {
    var meta = document.querySelector('meta[name=gnm-api]'), api = meta && meta.content;
    var put = function (key, html) { var el = document.querySelector('[data-slot="us-' + key + '"]'); if (el) el.innerHTML = html; };
    var empty = function (t) { return '<section class="block"><div class="card"><p class="empty">' + t + '</p></div></section>'; };
    var fail = function (t) { put('fundamentals', empty(t)); put('news', empty(t)); };
    if (!api) { fail('이 화면에서는 기업 정보를 불러올 수 없어요.'); return; }
    var q = '?name=' + encodeURIComponent(d.english || '') + (d.cik ? '&cik=' + encodeURIComponent(d.cik) : '') + (d.kind === 'etf' ? '&kind=etf' : '');
    fetch(api.replace(/[/]$/, '') + '/usinfo/' + encodeURIComponent(code) + q).then(function (r) { return r.json().then(function (x) { if (!r.ok) throw x; return x; }); }).then(function (x) {
      put('fundamentals', x.fundamentals || empty('SEC에 올라온 재무 자료가 없어요.' + (d.kind === 'etf' ? ' ETF는 재무제표가 없어요.' : '')));
      put('news', x.news || empty('최근 공시와 뉴스가 없어요.'));
      put('latest', x.latest || ''); put('edge', x.edge || '');
    }).catch(function (e) { fail((e && e.error && e.message) || '기업 정보를 불러오지 못했어요. 잠시 후 다시 열어 주세요.'); });
  };
  var usOnDemand = function () { var meta = document.querySelector('meta[name=gnm-api]'), api = meta && meta.content; if (!api) throw new Error('NO_API');
    return Promise.all([fetch(api.replace(/[/]$/, '') + '/us/page/' + encodeURIComponent(code)).then(function (r) { if (!r.ok) throw new Error(); return r.json(); }), fetch('usnames.json').then(function (r) { return r.ok ? r.json() : { rows: [] }; }).catch(function () { return { rows: [] }; })]).then(function (all) {
      var d = all[0], hit = (all[1].rows || []).filter(function (x) { return x[0] === code; })[0];
      var part = hit ? String(hit[2]).split(' · ') : [], ex = part[1] || 'US';
      d.name = hit ? hit[1] : code.replace(/${US_EXCHANGE_LETTER}/, ''); d.ticker = part[0] || d.ticker; d.english = part.slice(2).join(' · '); d.market = ex.replace(/ ETF$/, ''); d.kind = / ETF$/.test(ex) ? 'etf' : 'stock'; return d; }); };
  fetch((COIN ? 'c/' : US ? 'u/' : 's/') + code + '.json').then(function (r) { if(r.status===404 && new URLSearchParams(location.search).get('job'))return fetch('research/'+code+'.json').then(function(rr){if(!rr.ok)throw new Error();return rr.json();}).then(function(x){loadPanels();return {name:x.name,symbol:x.symbol,market:x.kind||'주식',bars:(x.recentBars||[]).map(function(b){return [b.date,b.open,b.high,b.low,b.close,b.volume];})};}); if (r.status === 404 && !COIN && !US) return toReport().then(function (moved) { if (!moved) throw new Error(); return new Promise(function () {}); }); if (r.status === 404 && US) return usOnDemand(); if (!r.ok) throw new Error(); return r.json(); }).then(function (d) {
    if(d.pageUrl && /^(?:[sc]\\/[0-9A-Z-]+\\.html|[0-9A-Z-]+\\/index\\.html)$/.test(d.pageUrl)){location.replace(d.pageUrl+location.search+location.hash);return;}
    if (d.research) loadPanels();
    if (US) usInfo(d);
    document.title = d.name + ' 차트 | GNOMON';
    document.querySelectorAll('form.join').forEach(function(f){f.dataset.symbol=code;f.dataset.name=d.name;}); $('sp-star').setAttribute('data-star', code); if (window.GNM_starSync) GNM_starSync();
    // ETFs and coins picked for a daily AI report (G-56) keep their chart page; point to the report.
    if (!US) fetch(code + '/index.html', { method: 'HEAD' }).then(function (r) { var rc = document.querySelector('.request-card'); if (r.ok && rc) rc.innerHTML = '<div class="lk-head"><b>AI 리포트가 있어요</b></div><p>매일 AI 리포트로 고른 적이 있어서 위원회 해설과 전체 대시보드가 있어요.</p><a class="btn-primary" href="' + code + '/index.html">AI 리포트 보기</a>'; }, function () {});
    $('sp-name').textContent = d.name; $('sp-code').textContent = US ? (d.ticker || d.symbol) : d.symbol; $('sp-market').textContent = US ? '미국 · ' + d.market + (d.kind === 'etf' ? ' ETF' : '') : COIN ? '업비트 원화' + (d.warning ? ' · 유의 종목' : '') : (d.market === 'KOSDAQ' ? '코스닥' : '코스피') + (d.kind === 'etf' ? ' ETF' : ''); $('sp-market').className = 'mkt-chip ' + (US ? 'mk-us' : COIN ? 'mk-coin' : d.kind === 'etf' ? 'mk-etf' : d.market === 'KOSDAQ' ? 'mk-kosdaq' : 'mk-kospi');
    var bars = d.bars.map(function (b) { return { time: b[0], open: b[1], high: b[2], low: b[3], close: b[4], volume: b[5] }; });
    var last = bars[bars.length - 1], prev = bars[bars.length - 2];
    if (last) {
      var ch = prev ? last.close - prev.close : 0, pc = prev ? (ch / prev.close) * 100 : 0;
      $('sp-price').innerHTML = '<b>' + won(last.close) + '</b>' + (prev ? '<span class="' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '">' + (ch > 0 ? '▲' : ch < 0 ? '▼' : '') + ' ' + (US ? won(Math.abs(ch)) : Math.abs(ch) >= 100 ? Math.round(Math.abs(ch)).toLocaleString('ko-KR') : Number(Math.abs(ch).toPrecision(3)).toLocaleString('ko-KR', { maximumFractionDigits: 8 })) + ' (' + (pc > 0 ? '+' : '') + pc.toFixed(2) + '%)</span>' : ''); pageReady(); if (window.gnmRollIn) gnmRollIn($('sp-price'));
      $('sp-date').textContent = last.time + (COIN ? ' 일봉 (09:00 KST 기준)' : US ? ' 종가 (미국 현지 날짜)' : ' 종가');
      // G-103: the 3-month mini chart under the price; tapping it opens the chart tab.
      var hp = bars.slice(-63);
      if (hp.length >= 5 && !document.querySelector('.hero-chart')) {
        var lo = Math.min.apply(null, hp.map(function (b) { return b.close; })), hi = Math.max.apply(null, hp.map(function (b) { return b.close; })), sp = hi - lo || 1;
        var pts = hp.map(function (b, i) { return (i / (hp.length - 1) * 320).toFixed(1) + ',' + (68 - (b.close - lo) / sp * 62).toFixed(1); }).join(' ');
        var g = (hp[hp.length - 1].close / hp[0].close - 1) * 100, col = g >= 0 ? '#f04452' : '#3182f6';
        var hc = document.createElement('a'); hc.className = 'hero-chart'; hc.href = '#tab-chart'; hc.setAttribute('aria-label', '최근 3개월 차트, 눌러서 전체 화면 차트 열기');
        hc.innerHTML = '<svg viewBox="0 0 320 72" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,72 ' + pts + ' 320,72" fill="' + col + '" fill-opacity=".12"/><polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><span class="hc-meta"><span>3개월 <b class="' + (g > 0 ? 'up' : g < 0 ? 'down' : '') + '">' + (g > 0 ? '▲ +' : g < 0 ? '▼ ' : '') + g.toFixed(1) + '%</b> · 최고 ' + won(hi) + ' · 최저 ' + won(lo) + '</span><span class="hc-go">차트 자세히 보기 ›</span></span>';
        hc.setAttribute('data-c', JSON.stringify(bars.slice(-250).map(function (b) { return b.close; })));
        $('sp-date').after(hc); if (window.GNM_heroRange) GNM_heroRange(hc);
      }
      $('pb-name').textContent = d.name; $('pb-code').textContent = US ? (d.ticker || d.symbol) : d.symbol; $('pb-price').textContent = won(last.close);
      $('pb-price').parentElement.setAttribute('data-live',code);$('pb-change').parentElement.setAttribute('data-live',code);
      $('pb-change').textContent = prev ? (pc > 0 ? '▲ +' : pc < 0 ? '▼ ' : '') + pc.toFixed(2) + '%' : ''; $('pb-change').className = ch > 0 ? 'up' : ch < 0 ? 'down' : '';
      document.querySelectorAll('.skel').forEach(function (x) { x.classList.remove('skel'); });
    }
    ['sp-request-credit'].forEach(function (id) { var rb = $(id); if (rb) { rb.setAttribute('data-symbol', d.symbol); rb.setAttribute('data-name', d.name); } });
    if(window.GNM_coinChartReady)GNM_coinChartReady();
    var c = d.calc, VOTE = { BULLISH: '강세', NEUTRAL: '중립', BEARISH: '약세' };
    var signed = function (v) { return v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(1) + '%'; };
    if (COIN && c && c.volume){var flow=document.getElementById('tab-flows');flow.innerHTML='<section class="card block"><h2>거래량·매집/분산</h2><div class="facts"><div><span>오늘 거래량</span><b>'+c.volume.ratio1.toFixed(2)+'배</b></div><div><span>5일 평균 거래량</span><b>'+c.volume.ratio5.toFixed(2)+'배</b></div><div><span>20일 OBV</span><b>'+c.volume.obvPct.toFixed(1)+'%</b></div><div><span>A/D 강도</span><b>'+(c.volume.adPct||0).toFixed(1)+'</b></div></div><p>'+(c.volume.flow==='ACCUM'?'매집과 비슷한 흔적':c.volume.flow==='DIST'?'분산과 비슷한 흔적':'뚜렷한 매집·분산 괴리 없음')+'</p><p class="fine">업비트 일봉 기준 '+c.date+' · 투자자 신원을 뜻하지 않아요.</p></section>'; }
    if (c) {
      var sg = c.signal, cls = sg.score == null ? '' : sg.score >= 0.1 ? 'up' : sg.score <= -0.1 ? 'down' : '';
      $('sp-signal').textContent = sg.label; $('sp-signal').className = 'sp-signal ' + cls;
      $('sp-line').textContent = c.line;
      var voted = sg.bull + sg.neutral + sg.bear;
      $('sp-tally').innerHTML = voted ? [['bull', sg.bull], ['neutral', sg.neutral], ['bear', sg.bear]].filter(function (x) { return x[1]; }).map(function (x) { return '<span class="s-' + x[0] + '" style="flex:' + x[1] + '"></span>'; }).join('') : '';
      $('sp-counts').textContent = '지표 ' + (voted + sg.abstain) + '개: 강세 ' + sg.bull + ' · 중립 ' + sg.neutral + ' · 약세 ' + sg.bear + (sg.abstain ? ' · 보류 ' + sg.abstain : '') + ' (' + c.date + ' 종가 기준)';
      $('sp-moves').innerHTML = c.moves.map(function (m) { return '<div class="mv"><span>' + m.label + ' (' + m.days + (COIN ? '일' : '거래일') + ')</span><b class="' + (m.pct > 0 ? 'up' : m.pct < 0 ? 'down' : '') + '">' + signed(m.pct) + '</b></div>'; }).join('');
      if (c.fair) $('sp-fair').innerHTML = '<div class="mv"><span>중심</span><b>' + won(c.fair.center) + '</b></div><div class="mv"><span>범위</span><b>' + won(c.fair.low) + ' ~ ' + won(c.fair.high) + '</b></div><div class="mv"><span>종가와 차이</span><b>' + signed(c.fair.gapPct) + '</b></div>';
      if (c.forecasts.length) $('sp-fc').innerHTML = '<table class="compact"><thead><tr><th>기간</th><th>범위</th><th>중앙</th></tr></thead><tbody>' + c.forecasts.map(function (f) { return '<tr><td>' + f.days + '거래일</td><td>' + won(f.p10) + ' ~ ' + won(f.p90) + '</td><td>' + won(f.p50) + '</td></tr>'; }).join('') + '</tbody></table>';
      $('sp-votes').innerHTML = c.votes.map(function (v) { return '<span class="vchip v-' + (v[1] || 'NONE') + '">' + v[0] + ' <b>' + (v[1] ? VOTE[v[1]] : '보류') + '</b></span>'; }).join('');
    } else { $('sp-signal').textContent = '계산 없음'; $('sp-line').textContent = '기록이 모자라 계산하지 못했어요.'; }
    var title = '리포트 요청: ' + d.name + ' (' + d.symbol + ')';
    var bodyText = '요청 종목: ' + d.name + ' (' + d.symbol + ')\\n\\n궁금한 점이나 보고 싶은 분석이 있으면 적어 주세요.\\n';
    if ($('sp-request')) $('sp-request').href = '${REPO_URL}/issues/new?labels=report-request&title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(bodyText);
    var L = window.LightweightCharts, el = $('chart');
    var chart = L.createChart(el, { autoSize: true, layout: { background: { color: 'transparent' }, textColor: '#6b7686', fontFamily: 'inherit' }, grid: { vertLines: { visible: false }, horzLines: { color: '#eef1f5' } }, rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false }, localization: { priceFormatter: function (p) { return US ? p.toFixed(2) : Math.round(p).toLocaleString('ko-KR'); } } });
    var candle = chart.addSeries(L.CandlestickSeries, { upColor: '#f04452', downColor: '#3182f6', borderVisible: false, wickUpColor: '#f04452', wickDownColor: '#3182f6' });
    if (window.GNMTheme) GNMTheme.chart(chart, function (c) { candle.applyOptions({ upColor: c.up, downColor: c.down, wickUpColor: c.up, wickDownColor: c.down }); });
    candle.setData(bars);window.GNMChart={L:L,chart:chart,candle:candle,bars:bars,series:function(){return chart._gnmSeries||[candle];}};
    var ma = function (n) { var out = [], s = 0; for (var i = 0; i < bars.length; i++) { s += bars[i].close; if (i >= n) s -= bars[i - n].close; if (i >= n - 1) out.push({ time: bars[i].time, value: s / n }); } return out; };
    // G-76: the moving averages follow the reader's view (☰ 메뉴 > 내 보기 방식).
    var VIEW_MA = { beginner: [20, 60], trader: [5, 20], swing: [20, 60], long: [60, 120], all: [20, 60, 120] }, MA_COLOR = { 5: '#f04452', 20: '#e8890c', 60: '#7a4fb3', 120: '#3182f6' };
    var ld0 = document.getElementById('sp-loading'); if (ld0) ld0.remove();
    var mas = VIEW_MA[document.documentElement.getAttribute('data-persona') || 'swing'] || [20, 60];
    var maSeries=[];mas.forEach(function (n) { var line=chart.addSeries(L.LineSeries, { color: MA_COLOR[n], lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });line.setData(ma(n));maSeries.push(line); });
    window.addEventListener('gnm-persona', function () { location.reload(); });
    var note = document.getElementById('sp-ma-note'); if (note) note.textContent = '이동평균 ' + mas.join('·') + '과 거래량이에요. 내 보기 방식에 맞춘 지표예요(전체 메뉴의 내 보기 방식에서 바꿀 수 있어요).';
    var vol = chart.addSeries(L.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'v', priceLineVisible: false, lastValueVisible: false });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chart._gnmSeries= [candle,vol].concat(maSeries);if(window.GNM_coinChartReady)GNM_coinChartReady();
    vol.setData(bars.map(function (b, i) { return { time: b.time, value: b.volume, color: i && b.close < bars[i - 1].close ? 'rgba(49,130,246,.35)' : 'rgba(240,68,82,.35)' }; }));
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
  /** core: reported every day; weekly: this week's selection; request: asked for; daily: a daily pick of the last 7 days; past: picked earlier (search only). */
  group: 'core' | 'weekly' | 'request' | 'past' | 'daily';
  reasons?: string[];
  /** 'deep' when the pick got the committee. */
  tier?: 'deep';
  /** Daily picks (G-56): the day picked and what it is. */
  pickDate?: string;
  kind?: 'stock' | 'etf' | 'coin';
}


// Shared styles and scripts live in two cached files instead of every page (site/assets/, written by renderSite).
const stripTag = (s: string) => s.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
export const APP_CSS = `/* G-155: readers who ask for less motion get none: animations and transitions finish at once, site-wide. */
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;animation-delay:0s!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
/* G-154: lists that show part first */
.more-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:46px;margin:10px 0 4px;border:1px solid var(--line-strong);border-radius:12px;background:var(--surface);font:inherit;font-size:14.5px;font-weight:800;color:var(--fg);cursor:pointer}.more-btn small{font-weight:500;color:var(--muted)}
/* G-154: taps of at least 32px on small links and buttons (audit: smallTargets); the look stays the same. */
.more-link,.qi-more,.si-more,.flt-btn,.version-banner a,.theme-chip,.fb-row button,.ml-back{display:inline-flex;align-items:center;min-height:32px}.version-banner [data-dismiss-version]{min-width:36px;min-height:36px}.bell-btn{min-width:36px;min-height:36px}
/* G-150: a white cover with the mark while the first layout settles (never longer than about 0.9 s; CSS lifts it at 1.2 s even without script), and a short cover when the chart or the debate room opens, so nothing is seen shifting into place. */
.boot-veil{position:fixed;inset:0;z-index:9999;background:var(--surface-solid);display:flex;align-items:center;justify-content:center;pointer-events:none;animation:veil-out .2s ease 1.2s forwards}.boot-veil span{width:52px;height:52px;border-radius:16px;background:var(--brand-grad);display:flex;align-items:center;justify-content:center;animation:veil-pulse 1s ease-in-out infinite}.boot-veil img{width:34px;height:34px}.boot-veil.gone{opacity:0;transition:opacity .2s ease}@keyframes veil-out{to{opacity:0;visibility:hidden}}@keyframes veil-pulse{50%{transform:scale(.92);opacity:.85}}
html.chart-fs #tab-chart::after,.db-room:not([hidden])::after{content:"";position:absolute;inset:0;z-index:200;background:var(--surface-solid);pointer-events:none;animation:veil-out .18s ease .32s forwards}.db-room:not([hidden])::after{animation-delay:.12s}
@media (prefers-reduced-motion:reduce){.boot-veil span{animation:none}}
.sub-sec .insight.only-free{display:none}${CHART_PRO_CSS}${CHART_DRAW_CSS}${DERIV_CSS}${INFOGRAPHIC_CSS}${MOTION_CSS}${STOCK_INFO_CSS}${PEERS_CSS}${THEME_CHIPS_CSS}${EDGE_CSS}${ALERTS_CSS}${AD_CSS}${CONTENT_MORE_CSS}${SCENARIO_CSS}${INDICATOR_LINK_CSS}${VERSION_CSS}${LOADING_CSS}${ORBS_CSS}${VIEW_FOCUS_CSS}${POP_CSS}${TOUR_CSS}${LIVE_CSS}${MENU_CSS}${BANNER_CSS}${PERSONA_CSS}${CONCLUSION_CSS}${STYLE}${PLAN_CSS}${UI_CSS}${EXTRAS_CSS}${CHART_V6_CSS}${ALPHA_CSS}${CHAT_CSS}
.chips button{font:inherit;font-weight:700;color:rgba(255,255,255,.72);border:0;border-radius:24px;background:transparent;padding:8px 16px;white-space:nowrap;cursor:pointer}.chips button.active,.chips button[aria-expanded=true]{background:var(--surface);color:var(--accent-strong)}.chev{display:inline-block;width:6px;height:6px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-2px) rotate(45deg);margin-left:7px;transition:transform .15s}[aria-expanded=true]>.chev{transform:translateY(1px) rotate(-135deg)}.analysis-tabs{border-top:1px solid #ffffff16;background:#0b203e;gap:2px!important}.analysis-tabs a{font-size:13px;font-weight:700;padding:9px 12px!important;border-radius:0!important;background:transparent!important;color:#9fb0c8!important;border-bottom:2px solid transparent}.analysis-tabs a[aria-selected=true]{color:#fff!important;border-bottom-color:#fff}.analysis-tabs[hidden]{display:none}.analysis-tabs a{display:block!important}.momentum-axis span{white-space:nowrap;font-variant-numeric:tabular-nums}.mom.hz{min-width:0;text-align:center}.mom .v{font-size:15px}.momentum-gauge svg{max-width:220px}.moms{grid-template-columns:repeat(3,minmax(0,1fr))}.race-entry{border-bottom:1px solid var(--line)}.race-more>summary{list-style:none;cursor:pointer;text-align:center;font-size:14px;font-weight:700;color:var(--accent-strong);padding:12px 0 4px}.race-more>summary::-webkit-details-marker{display:none}.race-more[open]>summary{display:none}.race-entry>summary{list-style:none;cursor:pointer;border-bottom:0}.race-entry>summary::-webkit-details-marker{display:none}.race-entry>summary .race-name b{display:flex;align-items:center;gap:8px;min-width:0}.race-name b:after{content:'';flex:none;width:6px;height:6px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:translateY(-2px) rotate(45deg);transition:transform .15s}.race-entry[open]>summary .race-name b:after{transform:translateY(2px) rotate(-135deg)}.race-detail{padding:8px 0 16px}.ai-summary{background:linear-gradient(135deg,#edf3ff,#f8f9fe);border:1px solid #d5e1f5;border-left:4px solid #5276bd}.ai-summary .as-kicker{font-size:11px;letter-spacing:.08em;color:#526d9a;font-weight:800}.ai-summary h2{margin:6px 0 14px}.ai-summary p{line-height:1.85;margin:0}.ai-summary strong{font-variant-numeric:tabular-nums}.market-thermals{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.market-thermals .tmp,.mk-panel .tmp{display:flex;flex-direction:column;gap:8px;text-decoration:none;color:inherit}.market-thermals .tmp-v,.mk-panel .tmp-v{font-size:20px}.market-thermals .tmp-n,.mk-panel .tmp-n{display:flex;justify-content:space-between;font-size:12px;font-weight:800}.market-thermals .pulse-bar,.market-thermals .br-bar,.mk-panel .pulse-bar,.mk-panel .br-bar{display:flex;height:14px;gap:3px;border-radius:8px;overflow:hidden}.market-thermals .s-bull,.mk-panel .s-bull{background:var(--up)}.market-thermals .s-neutral,.mk-panel .s-neutral{background:var(--line-strong)}.market-thermals .s-bear,.mk-panel .s-bear{background:var(--down)}.mk-panel .tmp{border:0;padding:0;box-shadow:none;background:none;margin-bottom:12px}.market-scenarios{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.market-scenario{border-top:3px solid #7d8da5;background:var(--soft)}.market-scenario.bull{border-color:var(--up);background:var(--up-soft)}.market-scenario.bear{border-color:var(--down);background:var(--down-soft)}.market-scenario h3{margin-top:0}.market-scenario h4{font-size:12px;color:var(--muted);margin-bottom:4px}.market-claims{list-style:none;padding:0}.market-claims li{margin:12px 0;line-height:1.8}.market-claims .tag{font-size:10px}.market-lead h1{font-size:24px}.market-lead .ml-back{font-size:13px;font-weight:700;color:var(--muted);text-decoration:none}.market-lead p{margin:6px 0}.market-evidence>summary{font-weight:800;cursor:pointer}.coin-tf{flex-wrap:wrap;overflow:visible}.minute-options{flex-basis:100%;display:flex;gap:8px;padding:10px;margin-top:8px;background:var(--soft);border:1px solid var(--line);border-radius:12px}.minute-options[hidden]{display:none}.minute-options button{border:1px solid var(--line);border-radius:18px;padding:8px 14px;background:var(--surface);color:var(--fg)}.coin-tf{position:relative}
@media(max-width:820px){.moms{grid-template-columns:repeat(2,minmax(0,1fr))}.momentum-axis{font-size:10px;gap:0}.market-scenarios{grid-template-columns:minmax(0,1fr)}.market-thermals{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;padding:2px 0 8px;scrollbar-width:none}.market-thermals::-webkit-scrollbar{display:none}.market-thermals>*{flex:0 0 84%;scroll-snap-align:start}.topbar.scrolled .gnomon-mark{width:28px;height:28px}.topbar.scrolled .price-bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0 7px;font-size:12px;overflow:visible;line-height:1.5}.price-bar>b{overflow:hidden;text-overflow:ellipsis;grid-column:1;grid-row:1/3}.price-bar .pb-price{grid-column:2;grid-row:1;white-space:nowrap}.price-bar [data-live-f=arrowpct]{grid-column:2;grid-row:2;text-align:right;white-space:nowrap}.price-bar .pb-code,.price-bar .freshness-badge{display:none}.topbar-in{gap:8px}.top-links,.topbar-in>.menu-button{flex:none}.chips button{padding:6px 12px;font-size:13px}.analysis-tabs{padding-top:0}.chips{gap:4px}}
${FS_CSS}${THEME_CSS}
/* G-183: command bar, switch, generate button, and glow CTA are ported from ThreeUI Community (github.com/MengTo/threeui), MIT License, Copyright (c) 2026 Meng To. See docs/third-party/threeui-LICENSE.txt. */
${COMMAND_BAR_CSS}${REPORT_TABS_CSS}${ROLL_CSS}${LIQUID_CSS}${GLASS_CSS}${MOTION_TOKENS_CSS}${SEG_THUMB_CSS}
.page-load{position:fixed;inset:0;z-index:400;display:grid;place-content:center;justify-items:center;gap:14px;padding:24px;text-align:center;background:var(--page);background-image:var(--page-grad);transition:opacity .35s ease,visibility .35s}.page-load.out{opacity:0;visibility:hidden}.page-load canvas{width:72px;height:72px}.page-load b{font-size:15px;color:var(--fg2);font-weight:700}.pl-track{position:relative;display:block;width:160px;height:3px;border-radius:3px;background:var(--line);overflow:hidden}.pl-track i{position:absolute;inset:0 auto 0 0;width:40%;border-radius:3px;background:linear-gradient(90deg,transparent,var(--accent),transparent);animation:pl-run 1.1s ease-in-out infinite}@keyframes pl-run{from{transform:translateX(-100%)}to{transform:translateX(260%)}}@media (prefers-reduced-motion:reduce){.pl-track i{animation-duration:3s}}html.embed .page-load{display:none}${MODERN_SWITCH_CSS}${GEN_BUTTON_CSS}${GLOW_CTA_CSS}`;
/** Accounts first (the page's own scripts use window.GNM), then the alpha layer. */
// G-169: the loading layer, the version banner and the ad strip used to be inlined in every page (about 19 KB each,
// never cached); they lead the cached app bundle instead, in the same order. The leading ';' keeps the orb bundle's
// "use strict" from becoming a directive for the whole file.
export const APP_JS = `;${LOADING_JS};\n${VERSION_JS};\n${AD_JS};\n${stripTag(ACCOUNT_SCRIPT)};\n${stripTag(ALPHA_SCRIPT)};\n${FORMAT_JS}`;
/** After the page's scripts: the chat (no-op without its markup) and the shared UI layer. */
export const UI_JS = `${PEERS_JS};${INDICATOR_LINK_JS};${SCENARIO_JS};${JOBS_JS};\n${COIN_CHART_JS};\n${stripTag(CHAT_SCRIPT)};\n${stripTag(UI_SCRIPT)};\n${MENU_JS}\n${PERSONA_JS}\n${CONCLUSION_JS}\n${SEATS_JS}\n${LIVE_JS}\n${STOCK_INFO_TOGGLE_JS}\n${INFOGRAPHIC_JS}\n${INSTALL_JS}\n${DERIV_JS}\n${HERO_RANGE_JS}\n${CHART_PRO_JS}\n${CHART_DRAW_JS}\n${IND_LIMIT_JS}\n${FS_JS}\n${TAP_JS}\n${TOUR_JS}\n${SURVEY_POP_JS}\n${PUSH_JS}\n${PRICE_ALERT_JS}\n${THEME_CHIPS_JS}\n${STOCK_INFO_JS}\n${MOTION_JS}\n${COMMAND_BAR_JS}\n${REPORT_TABS_JS}\n${ROLL_JS}\n${LIQUID_JS}\n${GLASS_JS}\n${MODERN_SWITCH_JS}\n${GEN_BUTTON_JS}\n${SEG_THUMB_JS}`;
/** Two FNV-1a passes give a short, stable content hash without node:crypto (this module also runs in the Worker). */
const contentHash = (text: string): string => {
  let a = 0x811c9dc5, b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i += 1) { const c = text.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b ^ c, 0x0100019d); }
  return ((a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0')).slice(0, 10);
};
export const ASSET_VERSION = contentHash(APP_CSS + APP_JS + UI_JS);
