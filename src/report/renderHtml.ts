// Static dashboard pages for the daily report and the report index.
// The chart uses TradingView Lightweight Charts, served from our own site
// (assets/lightweight-charts.js); if it fails to load, a static SVG stays.

import type { DailyReport, ReportedFiling } from './dailyReport.js';
import type { TechnicalSummary } from '../analysis/technicals.js';

export const CHART_ASSET = 'assets/lightweight-charts.js';

const escape = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const won = (value: number): string => `${Math.round(value).toLocaleString('ko-KR')}원`;
const pct = (value: number | null): string => (value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`);
const tone = (value: number | null): string => (value === null || value === 0 ? '' : value > 0 ? 'up' : 'down');
const IMPORTANCE_LABEL = { HIGH: '중요', MEDIUM: '보통', LOW: '참고' } as const;
const MIX_COLORS = ['#1f7a74', '#36b3a8', '#7fd3ca', '#b9e8e2', '#5b8f8b', '#d5efeb'];

const ICON = {
  logo: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M16 16 L16 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M16 16 L25 21" stroke="#c9f27f" stroke-width="2.4" stroke-linecap="round"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 12l4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  archive: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  filing: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 12h6M10 16h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  source: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  price: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17l5-5 4 3 7-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  week: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 10h16M9 3v4M15 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  month: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M10 19V5M15 19v-7M20 19v-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M7 16v-4M12 16V8M17 16v-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17l6-6 4 4 6-7M15 8h5v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7l6 6 4-4 6 7M15 16h5v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const STYLE = `
:root{--frame:#dfe9e7;--surface:#ffffff;--card:#f6f8f8;--line:#e6eceb;--fg:#18201f;--muted:#6a7673;
--side:#1f5f5b;--side-fg:#d9ebe9;--pill:#c9f27f;--pill-fg:#173b38;--teal:#1f7a74;--teal-soft:#e3f1ef;
--up:#e0383e;--down:#2b6fd6;--warn:#c07a12}
*{box-sizing:border-box}html,body{margin:0}body{background:var(--frame);color:var(--fg);
font:15px/1.55 Inter,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}.app{display:grid;grid-template-columns:240px minmax(0,1fr);gap:16px;max-width:1440px;margin:0 auto;padding:16px;min-height:100vh}
.side{background:var(--side);color:var(--side-fg);border-radius:18px;padding:24px 16px;position:sticky;top:16px;height:calc(100vh - 32px);display:flex;flex-direction:column;gap:28px}
.brand{display:flex;align-items:center;gap:10px;color:#fff;font-weight:700;font-size:18px;padding:0 8px}.brand svg{width:30px;height:30px}
.brand small{display:block;font-weight:500;font-size:11px;color:var(--side-fg);letter-spacing:.04em}
.nav{display:flex;flex-direction:column;gap:6px}.nav a{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:999px;text-decoration:none;font-size:15px}
.nav a svg{width:20px;height:20px;flex:none}.nav a:hover{background:rgba(255,255,255,.08)}.nav a.active{background:var(--pill);color:var(--pill-fg);font-weight:600}
.side .foot{margin-top:auto;font-size:12px;color:var(--side-fg);opacity:.8;padding:0 8px}
main{background:var(--surface);border-radius:18px;padding:20px 28px 40px;min-width:0}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.ticker{display:flex;align-items:center;gap:10px;background:var(--card);border-radius:10px;padding:8px 14px;font-weight:600}.ticker span{color:var(--muted);font-weight:500}
.stamp{color:var(--muted);font-size:13px;text-align:right}
h1{font-size:28px;margin:24px 0 4px;letter-spacing:-.01em}.sub{color:var(--muted);margin:0 0 20px}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.card{background:var(--card);border-radius:14px;padding:18px 20px;min-width:0}
.kpi .row{display:flex;align-items:center;gap:12px}.kpi .ico{width:42px;height:42px;border-radius:10px;display:grid;place-items:center;color:#fff;flex:none}
.kpi .ico svg{width:22px;height:22px}.kpi .label{color:var(--muted);font-size:13px}.kpi .value{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;display:flex;align-items:center;gap:6px}
.kpi .value svg{width:20px;height:20px}.kpi .hint{color:var(--muted);font-size:13px;margin-top:14px}
.up{color:var(--up)}.down{color:var(--down)}
.grid2{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px;margin-top:16px}.grid-eq{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:16px}
.card h2{font-size:18px;margin:0;font-weight:650}.head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.seg{display:inline-flex;background:#fff;border:1px solid var(--line);border-radius:999px;padding:3px}.seg button{border:0;background:none;padding:5px 12px;border-radius:999px;font:inherit;font-size:13px;color:var(--muted);cursor:pointer}
.seg button[aria-pressed=true]{background:var(--side);color:#fff}
.legend-line{font-size:13px;color:var(--muted);min-height:20px;font-variant-numeric:tabular-nums}
#chart{height:340px;position:relative}#chart svg{width:100%;height:100%}
.donut{display:flex;flex-direction:column;align-items:center;gap:16px}.donut svg{width:180px;height:180px}
.legend{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px;width:100%;font-size:13px;color:var(--muted)}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}
.headline{font-size:17px;font-weight:600;margin:0 0 10px}ul.plain{margin:0;padding-left:18px}ul.plain li{margin:6px 0}
.empty{color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;color:var(--muted);font-weight:500;font-size:13px;padding:10px 8px;border-bottom:1px solid var(--line)}
td{padding:12px 8px;border-bottom:1px solid var(--line);vertical-align:top}td a{text-decoration:none;font-weight:500}td a:hover{text-decoration:underline}
.why{color:var(--muted);font-size:13px;margin-top:2px}.badge{display:inline-block;font-size:12px;border-radius:999px;padding:1px 9px;white-space:nowrap}
.b-HIGH{background:#fde8e6;color:#b4232a}.b-MEDIUM{background:#fff3dc;color:var(--warn)}.b-LOW{background:#eef1f0;color:var(--muted)}.b-new{background:var(--pill);color:var(--pill-fg);margin-left:6px}
.table-wrap{overflow-x:auto}
.grid-signal{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:16px;margin-bottom:16px}
.signal{text-align:center}.gauge{width:100%;max-width:260px;display:block;margin:0 auto}.signal-label{font-size:24px;font-weight:700;margin:4px 0}
.reason{margin:6px 0;font-size:14px}.tally{color:var(--muted);font-size:13px}.fine{color:var(--muted);font-size:11px;margin:10px 0 0}
.moms{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.mom{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.mom .k{color:var(--muted);font-size:12px}.mom .v{font-size:18px;font-weight:700;margin:2px 0}
.gbars{display:grid;gap:12px;margin-top:16px}.gtitle{display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-bottom:6px}
.track{display:flex;height:12px;border-radius:999px;overflow:hidden;background:#eef1f0;gap:2px}.track i{display:block;height:100%}
.track i.v-BULLISH{background:#e5484d}.track i.v-BEARISH{background:#3b7be0}.track i.v-NEUTRAL{background:#c4cbc9}.track i.b-LOW{background:#e6eceb}
.votes{margin-top:14px}.votes td{padding:8px}.votes summary{cursor:pointer;color:var(--teal);font-weight:600;font-size:14px}.votes table{margin-top:8px}
.num{font-variant-numeric:tabular-nums;white-space:nowrap}.v-BULLISH{background:#fde8e6;color:#b4232a}.v-BEARISH{background:#e3ecfb;color:#1d4fa3}.v-NEUTRAL{background:#eef1f0;color:var(--muted)}.nowrap{white-space:nowrap}.m-date{display:none;color:var(--muted);font-size:12px}
footer{margin-top:28px;color:var(--muted);font-size:12px}
@media (max-width:1100px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.grid2,.grid-eq,.grid-signal{grid-template-columns:minmax(0,1fr)}}
@media (max-width:820px){.app{grid-template-columns:minmax(0,1fr);padding:0;gap:0}
.side{position:static;height:auto;border-radius:0;flex-direction:row;align-items:center;justify-content:space-between;padding:12px 16px;gap:8px;flex-wrap:wrap}
.side .foot{display:none}.nav{flex-direction:row;gap:2px;overflow-x:auto}.nav a{padding:8px 12px;font-size:13px;white-space:nowrap}.nav a svg{display:none}
main{border-radius:0;padding:16px 16px 32px}h1{font-size:22px}.kpis{gap:10px}.card{padding:14px}.kpi .value{font-size:18px}#chart{height:280px}
.col-filer,.col-cat,.col-date{display:none}.m-date{display:block}
.kpi .ico{display:none}.moms{gap:8px}.mom{padding:10px}.mom .v{font-size:15px}.votes .why{display:none}.kpi .value{font-size:17px;white-space:nowrap}.kpi .hint{margin-top:8px;font-size:12px}.stamp{text-align:left}}`;

function shell(active: 'today' | 'archive', base: string, title: string, body: string, scripts = '', filingsHref = '#filings'): string {
  const nav = [
    { key: 'today', href: `${base}index.html#latest`, icon: ICON.dashboard, label: '오늘 리포트' },
    { key: 'archive', href: `${base}index.html#archive`, icon: ICON.archive, label: '지난 리포트' },
    { key: 'filings', href: filingsHref, icon: ICON.filing, label: '공시' },
    { key: 'sources', href: '#sources', icon: ICON.source, label: '데이터 출처' },
  ];
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title><style>${STYLE}</style></head><body><div class="app">
<aside class="side"><div class="brand">${ICON.logo}<div>GNM<small>GNOMON ANALYTICS</small></div></div>
<nav class="nav">${nav.map((n) => `<a href="${n.href}"${n.key === active ? ' class="active" aria-current="page"' : ''}>${n.icon}<span>${n.label}</span></a>`).join('')}</nav>
<div class="foot">공개 데이터로 만든 리서치 리포트예요. 투자 권유가 아니에요.</div></aside>
<main>${body}</main></div>${scripts}</body></html>`;
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
        const deg = angle(t.score);
        const [x, y] = point(deg, r - 22), [bx1, by1] = point(deg + 90, 6), [bx2, by2] = point(deg - 90, 6);
        return `<path d="M${bx1.toFixed(1)} ${by1.toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)} L${bx2.toFixed(1)} ${by2.toFixed(1)} Z" fill="#18201f"/><circle cx="${cx}" cy="${cy}" r="7" fill="#18201f"/>`;
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
    return `<div class="gbar"><div class="gtitle"><span>${title}</span><span>${parts.filter(([, c]) => c).map(([, c, l]) => `${l} ${c}`).join(' · ')}</span></div>
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
<div class="v ${m.trend === 'UP' ? 'up' : m.trend === 'DOWN' ? 'down' : ''}">${m.trend ? `${trendMark[m.trend]} ${trendWord[m.trend]}` : '—'}</div>
<div class="k">${m.returnPct === null ? '기록 부족' : pct(m.returnPct)} · ${m.days}일</div></div>`).join('');
  const rows = t.votes.map((v) => `<tr><td>${escape(v.label)}</td><td class="num">${v.value === null ? '—' : Math.abs(v.value) >= 1000 ? Math.round(v.value).toLocaleString('ko-KR') : v.value.toFixed(2)}</td>
<td>${v.vote ? `<span class="badge v-${v.vote}">${VOTE_LABEL[v.vote]}</span>` : '<span class="badge b-LOW">계산 불가</span>'}</td><td class="why">${escape(v.rule)}</td></tr>`).join('');
  return `<div class="grid-signal"><div class="card signal"><div class="head"><h2>기술적 신호</h2><span class="sub" style="margin:0">${escape(t.sessionDate)} 종가 기준</span></div>
${gaugeSvg(t)}<div class="signal-label ${tone}">${escape(t.label)}</div>
<p class="reason">${escape(report.technicalReason ?? '')}</p>
<div class="tally">강세 ${t.counts.bullish} · 중립 ${t.counts.neutral} · 약세 ${t.counts.bearish}${t.counts.abstained ? ` · 계산 불가 ${t.counts.abstained}` : ''}</div>
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
  return `<div class="kpis">
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
<defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f7a74" stop-opacity=".25"/><stop offset="1" stop-color="#1f7a74" stop-opacity="0"/></linearGradient></defs>
<polygon fill="url(#fill)" points="${pts[0]![0]},${h - pad} ${line} ${pts.at(-1)![0]},${h - pad}"/>
<polyline fill="none" stroke="#1f7a74" stroke-width="2" points="${line}"/></svg>`;
}

function chartCard(report: DailyReport, base: string): { html: string; script: string } {
  const bars = barsOf(report);
  const hasOhlc = Boolean(report.recentBars?.length);
  const data = JSON.stringify(bars).replace(/</g, '\\u003c');
  const html = `<div class="card"><div class="head"><h2>주가 차트</h2>
<div style="display:flex;gap:8px;flex-wrap:wrap"><div class="seg" role="group" aria-label="기간">
<button type="button" data-range="21">1개월</button><button type="button" data-range="63" aria-pressed="true">3개월</button><button type="button" data-range="126">6개월</button></div>
${hasOhlc ? '<div class="seg" role="group" aria-label="차트 종류"><button type="button" data-kind="candle" aria-pressed="true">캔들</button><button type="button" data-kind="line">라인</button></div>' : ''}</div></div>
<div class="legend-line" id="legend">${bars.length ? `${escape(bars.at(-1)!.date)} 종가 ${escape(won(bars.at(-1)!.close))}` : ''}</div>
<div id="chart">${fallbackSvg(bars)}</div></div>`;
  const script = `<script type="application/json" id="bars">${data}</script>
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
    layout: { background: { color: 'transparent' }, textColor: '#6a7673', fontFamily: 'inherit' },
    grid: { vertLines: { visible: false }, horzLines: { color: '#e6eceb' } },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.24 } },
    timeScale: { borderVisible: false },
    crosshair: { mode: 0 },
    localization: { locale: 'ko-KR', priceFormatter: function (v) { return Math.round(v).toLocaleString('ko-KR'); } }
  });
  var candle = chart.addCandlestickSeries({ upColor: '#e0383e', downColor: '#2b6fd6', borderVisible: false, wickUpColor: '#e0383e', wickDownColor: '#2b6fd6' });
  candle.setData(bars.map(function (b) { return { time: b.date, open: b.open, high: b.high, low: b.low, close: b.close }; }));
  var area = chart.addAreaSeries({ lineColor: '#1f7a74', topColor: 'rgba(31,122,116,.28)', bottomColor: 'rgba(31,122,116,0)', lineWidth: 2, visible: false });
  area.setData(bars.map(function (b) { return { time: b.date, value: b.close }; }));
  var volume = chart.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
  chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
  volume.setData(bars.filter(function (b) { return b.volume > 0; }).map(function (b) { return { time: b.date, value: b.volume, color: b.close >= b.open ? 'rgba(224,56,62,.35)' : 'rgba(43,111,214,.35)' }; }));
  var hasOhlc = ${hasOhlc ? 'true' : 'false'};
  if (!hasOhlc) { candle.applyOptions({ visible: false }); area.applyOptions({ visible: true }); }
  var byDate = {}; bars.forEach(function (b) { byDate[b.date] = b; });
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
  return `<div class="card"><div class="head"><h2>공시 구성</h2><span class="sub" style="margin:0">최근 30일 · ${total}건</span></div>
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
<td><span class="m-date">${escape(f.filedDate)} · ${escape(f.category)}</span><a href="${escape(f.url)}" rel="noopener" target="_blank">${escape(f.title)}</a>${fresh.has(f.receiptNo) ? '<span class="badge b-new">새 공시</span>' : ''}<div class="why">${escape(f.why)}</div></td>
<td class="col-cat nowrap">${escape(f.category)}</td><td><span class="badge b-${f.importance}">${IMPORTANCE_LABEL[f.importance]}</span></td><td class="col-filer nowrap">${escape(f.filer)}</td></tr>`).join('')}
</tbody></table></div>`;
}

export function renderReport(report: DailyReport, links: { index: string; base?: string }): string {
  const base = links.base ?? '../';
  const chart = chartCard(report, base);
  const notes = report.notes.length ? `<ul class="plain">${report.notes.map((n) => `<li>${escape(n)}</li>`).join('')}</ul>` : '<p class="empty">눈에 띄는 가격·거래량 신호는 없어요.</p>';
  const changes = report.changes?.length ? `<ul class="plain">${report.changes.map((c) => `<li>${escape(c)}</li>`).join('')}</ul>` : '<p class="empty">이 리포트에는 비교 기록이 없어요.</p>';
  const body = `<div class="top"><div class="ticker">${escape(report.name)} <span>${escape(report.symbol)} · KOSPI</span></div>
<div class="stamp">${escape(report.date)} 리포트<br>생성 ${escape(report.generatedAt.replace('T', ' ').slice(0, 16))} UTC</div></div>
<h1>${escape(report.name)} 일일 리포트</h1><p class="sub">${escape(report.headline)}</p>
${signalSection(report)}
${kpis(report)}
<div class="grid2">${chart.html}${mixCard(report.recentFilings ?? report.filings)}</div>
<div class="grid-eq"><div class="card"><div class="head"><h2>오늘의 요약</h2></div><p class="headline">${escape(report.headline)}</p>${notes}</div>
<div class="card"><div class="head"><h2>어제 대비 바뀐 점</h2></div>${changes}</div></div>
<div class="card" id="filings" style="margin-top:16px"><div class="head"><h2>공시</h2><span class="sub" style="margin:0">최근 30일 · DART 원문 링크</span></div>${filingsTable(report)}</div>
<footer id="sources">데이터: Naver 금융 일봉(가격), OpenDART(공시) · 수집 기록은 고쳐 쓰지 않고 쌓아요 · 투자 권유가 아니에요 · <a href="${escape(links.index)}">지난 리포트</a></footer>`;
  return shell('today', base, `${report.name} ${report.date} 일일 리포트 — GNM`, body, chart.script);
}

export function renderIndex(reports: readonly Pick<DailyReport, 'date' | 'headline' | 'name' | 'status'>[]): string {
  const sorted = [...reports].sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = sorted[0];
  const body = `<div class="top"><div class="ticker">SK하이닉스 <span>000660 · KOSPI</span></div><div class="stamp">리포트 ${sorted.length}건</div></div>
<h1 id="latest">SK하이닉스 일일 리포트</h1><p class="sub">평일 장 마감 뒤(18:30 KST) 자동으로 만들어져요.</p>
${latest ? `<div class="card"><div class="head"><h2>최신 리포트 · ${escape(latest.date)}</h2><a href="reports/${escape(latest.date)}.html" class="badge b-new" style="text-decoration:none;font-size:14px;padding:6px 14px">열기</a></div><p class="headline">${escape(latest.headline)}</p></div>` : '<div class="card empty">아직 리포트가 없어요.</div>'}
<div class="card" id="archive" style="margin-top:16px"><div class="head"><h2>지난 리포트</h2></div><div class="table-wrap"><table><thead><tr><th>날짜</th><th>요약</th><th>거래</th></tr></thead><tbody>
${sorted.map((r) => `<tr><td style="white-space:nowrap"><a href="reports/${escape(r.date)}.html">${escape(r.date)}</a></td><td>${escape(r.headline)}</td><td>${r.status === 'SESSION' ? '거래일' : '휴장'}</td></tr>`).join('')}
</tbody></table></div></div>
<footer id="sources">데이터: Naver 금융 일봉(가격), OpenDART(공시) · 투자 권유가 아니에요</footer>`;
  // The index has no filings section; link to the latest report's.
  return shell('archive', '', 'Gnomon Analytics — SK하이닉스 일일 리포트', body, '', latest ? `reports/${escape(latest.date)}.html#filings` : '#archive');
}
