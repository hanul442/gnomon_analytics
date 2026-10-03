// Static HTML for the daily report and the report index. No scripts, no
// external assets: the page is the report.

import type { DailyReport } from './dailyReport.js';

const escape = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const won = (value: number): string => `${Math.round(value).toLocaleString('ko-KR')}원`;
const pct = (value: number | null): string => (value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`);
const IMPORTANCE_LABEL = { HIGH: '중요', MEDIUM: '보통', LOW: '참고' } as const;

const STYLE = `
:root{--bg:#fbfaf7;--fg:#1c1b19;--muted:#6b6862;--line:#e4e1da;--card:#ffffff;--up:#c8322b;--down:#1d5fbf;--accent:#8a6d2f}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--fg:#ecebe7;--muted:#a19e97;--line:#2e2d2a;--card:#1c1c1a;--up:#ef6b62;--down:#6aa0f0;--accent:#d2b06a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 64px}
header .brand{font-size:13px;letter-spacing:.08em;color:var(--accent);text-transform:uppercase}
h1{font-size:26px;line-height:1.35;margin:6px 0 4px}h2{font-size:17px;margin:32px 0 10px}
.meta{color:var(--muted);font-size:13px}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}.stat .k{color:var(--muted);font-size:12px}.stat .v{font-size:18px;font-variant-numeric:tabular-nums}
.up{color:var(--up)}.down{color:var(--down)}ul{padding-left:20px}li{margin:4px 0}
.filing{border-top:1px solid var(--line);padding:12px 0}.filing:first-child{border-top:0;padding-top:0}
.tag{display:inline-block;font-size:12px;border:1px solid var(--line);border-radius:999px;padding:0 8px;margin-right:6px;color:var(--muted)}
.tag.HIGH{border-color:var(--accent);color:var(--accent)}a{color:inherit}svg{width:100%;height:auto;display:block}
footer{margin-top:40px;color:var(--muted);font-size:12px}`;

function chart(points: DailyReport['recentCloses']): string {
  if (points.length < 2) return '';
  const w = 720, h = 160, pad = 8;
  const closes = points.map((p) => p.close);
  const min = Math.min(...closes), max = Math.max(...closes), span = max - min || 1;
  const xy = points.map((p, i) => `${(pad + (i * (w - 2 * pad)) / (points.length - 1)).toFixed(1)},${(h - pad - ((p.close - min) / span) * (h - 2 * pad)).toFixed(1)}`);
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="최근 ${points.length}거래일 종가 추이 (${escape(won(min))}~${escape(won(max))})">
<polyline fill="none" stroke="currentColor" stroke-width="2" points="${xy.join(' ')}"/></svg>
<div class="meta">${escape(points[0]!.date)} ~ ${escape(points.at(-1)!.date)} 종가 · 최저 ${escape(won(min))} · 최고 ${escape(won(max))}</div>`;
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title><style>${STYLE}</style></head><body><main>${body}
<footer>Gnomon Analytics는 공개 데이터를 정리한 리서치 리포트이며 투자 권유가 아니에요. 가격: Naver 일봉 · 공시: OpenDART</footer></main></body></html>`;
}

export function renderReport(report: DailyReport, links: { index: string }): string {
  const p = report.price;
  const direction = p?.changePct == null ? '' : p.changePct > 0 ? 'up' : p.changePct < 0 ? 'down' : '';
  const stats = p ? `<div class="card stats">
<div class="stat"><div class="k">종가</div><div class="v">${escape(won(p.close))}</div></div>
<div class="stat"><div class="k">전일 대비</div><div class="v ${direction}">${escape(pct(p.changePct))}</div></div>
<div class="stat"><div class="k">5거래일</div><div class="v">${escape(pct(p.return5dPct))}</div></div>
<div class="stat"><div class="k">20거래일</div><div class="v">${escape(pct(p.return20dPct))}</div></div>
<div class="stat"><div class="k">거래량 (20일 평균 대비)</div><div class="v">${p.volumeRatio20 === null ? '—' : `${p.volumeRatio20.toFixed(2)}배`}</div></div>
<div class="stat"><div class="k">20일 범위</div><div class="v">${escape(won(p.low20))} ~ ${escape(won(p.high20))}</div></div>
</div>` : '';
  const notes = report.notes.length ? `<ul>${report.notes.map((n) => `<li>${escape(n)}</li>`).join('')}</ul>` : '';
  const filings = report.filings.length
    ? `<div class="card">${report.filings.map((f) => `<div class="filing">
<div><span class="tag ${f.importance}">${IMPORTANCE_LABEL[f.importance]}</span><span class="tag">${escape(f.category)}</span><span class="meta">${escape(f.filedDate)} · ${escape(f.filer)}</span></div>
<div><a href="${escape(f.url)}" rel="noopener">${escape(f.title)}</a></div>
<div class="meta">${escape(f.why)}</div></div>`).join('')}</div>`
    : '<p class="meta">이전 거래일 이후 새로 나온 공시가 없어요.</p>';
  return page(`${report.name} ${report.date} 일일 리포트`, `
<header><div class="brand">Gnomon Analytics</div><h1>${escape(report.headline)}</h1>
<div class="meta">${escape(report.name)} (${escape(report.symbol)}) · ${escape(report.date)} · 생성 ${escape(report.generatedAt.replace('T', ' ').slice(0, 16))} UTC · <a href="${escape(links.index)}">지난 리포트</a></div></header>
${notes}
<h2>가격</h2>${stats}${p ? `<div class="card" style="margin-top:12px">${chart(report.recentCloses)}</div>` : '<p class="meta">이날은 거래가 없었어요.</p>'}
<h2>공시</h2>${filings}`);
}

export function renderIndex(reports: readonly Pick<DailyReport, 'date' | 'headline' | 'name'>[]): string {
  const sorted = [...reports].sort((a, b) => (a.date < b.date ? 1 : -1));
  const items = sorted.map((r) => `<li><a href="reports/${escape(r.date)}.html">${escape(r.date)}</a> — ${escape(r.headline)}</li>`).join('');
  return page('Gnomon Analytics — 리포트 목록', `<header><div class="brand">Gnomon Analytics</div><h1>SK하이닉스 일일 리포트</h1></header>
${sorted[0] ? `<p><a href="reports/${escape(sorted[0].date)}.html">최신 리포트 보기 (${escape(sorted[0].date)})</a></p>` : '<p class="meta">아직 리포트가 없어요.</p>'}
<h2>지난 리포트</h2><ul>${items}</ul>`);
}
