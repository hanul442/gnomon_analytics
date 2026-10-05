// Scorecard and terms pages (docs/DESIGN.md §3.8, G-33). The scorecard shows,
// across every covered stock, how the logged forecasts, AI analysts, strategy
// champions and paper ledgers actually did. The summary is free (trust comes
// from showing the record); the list of individual misses is Plus.

import type { DailyReport } from './dailyReport.js';
import { gate } from './plans.js';
import { paperPanel } from './renderArena.js';
import { shell, type HomeEntry } from './renderHtml.js';

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const won = (v: number) => `${Math.round(v).toLocaleString('ko-KR')}원`;
const pct = (v: number | null, d = 1) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`);
const tone = (v: number | null) => (v === null || v === 0 ? '' : v > 0 ? 'up' : 'down');

export function renderScorecard(entries: readonly HomeEntry[]): string {
  const live = entries.filter((e): e is HomeEntry & { report: DailyReport } => !!e.report?.market);
  // Forecast ranges by horizon.
  const byH = new Map<number, { scored: number; inside: number; err: number[] }>();
  const misses: { name: string; href: string; horizon: number; base: string; target: string; p10: number; p90: number; actual: number; err: number }[] = [];
  let pending = 0;
  for (const e of live) {
    const m = e.report.market!;
    pending += m.forecasts.length;
    for (const s of m.forecastScores) {
      const x = byH.get(s.horizon) ?? { scored: 0, inside: 0, err: [] };
      x.scored += s.scored; x.inside += (s.coverage ?? 0) * s.scored;
      if (s.medianAbsErrorPct !== null) x.err.push(s.medianAbsErrorPct);
      byH.set(s.horizon, x);
      for (const f of s.latest) if (!f.inside) misses.push({ name: e.name, href: e.href, horizon: f.horizon, base: f.baseDate, target: f.targetDate, p10: f.p10, p90: f.p90, actual: f.actual, err: f.errorPct });
    }
  }
  const horizons = [...byH.entries()].sort((a, b) => a[0] - b[0]);
  const totalScored = horizons.reduce((s, [, x]) => s + x.scored, 0);
  const forecastCard = `<section class="block"><div class="block-head"><h2>예측 범위 적중</h2><span class="muted">10~90% 범위 안에 실제 가격이 들어왔는지</span></div><div class="card">
${totalScored ? `<table class="compact"><thead><tr><th>기간</th><th>채점</th><th>범위 안</th><th>중앙값 오차(중간)</th></tr></thead><tbody>${horizons.map(([h, x]) => `<tr><td>${h}거래일</td><td>${x.scored.toLocaleString('ko-KR')}건</td><td><b>${x.scored ? Math.round((x.inside / x.scored) * 100) : 0}%</b></td><td>${x.err.length ? `${(x.err.reduce((s, v) => s + v, 0) / x.err.length).toFixed(1)}%` : '—'}</td></tr>`).join('')}</tbody></table>
<p class="fine">범위가 정직하면 약 80%가 안에 들어와요. 이보다 낮으면 범위가 너무 좁고, 훨씬 높으면 너무 넓은 거예요.</p>` : `<p class="empty">아직 채점한 예측이 없어요. 지금 기록된 예측 ${pending.toLocaleString('ko-KR')}건은 기간(5·20·60·120거래일)이 지나면 실제 가격으로 채점해요.</p>`}</div></section>`;
  // AI analysts, all stocks together.
  const by = new Map<string, { name: string; scored: number; hits: number; pending: number; err: number[] }>();
  for (const e of live) for (const a of e.report.market!.analystBoard) {
    const x = by.get(a.analyst) ?? { name: a.name, scored: 0, hits: 0, pending: 0, err: [] };
    x.scored += a.scored; x.hits += (a.hitRate ?? 0) * a.scored; x.pending += a.pending;
    if (a.medianErrorPct !== null) x.err.push(a.medianErrorPct);
    by.set(a.analyst, x);
  }
  const board = [...by.values()].sort((a, b) => (b.scored ? b.hits / b.scored : -1) - (a.scored ? a.hits / a.scored : -1) || b.pending - a.pending);
  const analystCard = `<section class="block"><div class="block-head"><h2>AI 분석가 순위</h2><span class="muted">20거래일 뒤 방향이 맞았는지 · 전 종목 합산</span></div><div class="card">
${board.length ? `<table class="compact"><thead><tr><th>분석가</th><th>채점</th><th>방향 적중</th><th>목표가 오차(중간)</th><th>채점 대기</th></tr></thead><tbody>${board.map((x) => `<tr><td>${esc(x.name)}</td><td>${x.scored}</td><td><b>${x.scored ? `${Math.round((x.hits / x.scored) * 100)}%` : '—'}</b></td><td>${x.err.length ? `${(x.err.reduce((s, v) => s + v, 0) / x.err.length).toFixed(1)}%` : '—'}</td><td>${x.pending}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">아직 분석가 예측이 없어요.</p>'}
<p class="fine">분석가는 같은 AI가 서로 다른 관점을 맡아 쓴 의견이에요. 예측은 쓴 날 그대로 기록하고 고치지 않아요.</p></div></section>`;
  // Strategy champions and paper ledgers, one row per stock.
  const rows = live.map((e) => {
    const m = e.report.market!, champ = m.arena?.results.find((r) => r.key === m.arena?.championKey), hold = m.arena?.results.find((r) => r.key === 'hold');
    const books = m.paper ?? [], pc = books.find((b) => b.follower === 'champion'), ph = books.find((b) => b.follower === 'hold');
    const bestAi = books.filter((b) => b.follower.startsWith('analyst:')).sort((a, b) => b.totalReturn - a.totalReturn)[0];
    return `<tr><td><a href="${esc(e.href)}">${esc(e.name)}</a></td><td>${champ ? esc(champ.name) : '—'}</td><td class="${tone(champ ? champ.oosReturn * 100 : null)}">${champ ? pct(champ.oosReturn * 100) : '—'}</td><td class="${tone(hold ? hold.oosReturn * 100 : null)}">${hold ? pct(hold.oosReturn * 100) : '—'}</td><td class="${tone(pc ? pc.totalReturn * 100 : null)}">${pc ? pct(pc.totalReturn * 100, 2) : '—'}</td><td class="${tone(ph ? ph.totalReturn * 100 : null)}">${ph ? pct(ph.totalReturn * 100, 2) : '—'}</td><td>${bestAi ? `${esc(bestAi.label)} <span class="${tone(bestAi.totalReturn * 100)}">${pct(bestAi.totalReturn * 100, 2)}</span>` : '—'}</td></tr>`;
  }).join('');
  const beat = live.filter((e) => { const a = e.report.market!.arena; const c = a?.results.find((r) => r.key === a.championKey), h = a?.results.find((r) => r.key === 'hold'); return !!c && !!h && c.oosReturn > h.oosReturn; }).length;
  const strategyCard = `<section class="block"><div class="block-head"><h2>전략 챔피언과 모의투자</h2><span class="muted">챔피언이 검증 구간에서 보유보다 나았던 종목 ${beat}/${live.length}</span></div><div class="card table-wrap"><table class="compact"><thead><tr><th>종목</th><th>전략 챔피언</th><th>챔피언 (검증 구간)</th><th>보유 (검증 구간)</th><th>장부: 챔피언</th><th>장부: 보유</th><th>장부: 최고 AI 분석가</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="empty">아직 기록이 없어요.</td></tr>'}</tbody></table>
<p class="fine">검증 구간은 백테스트의 마지막 30%예요. 장부는 기록을 시작한 날부터 다음 거래일 수익으로 쌓고, 사고팔 때 비용을 빼요.</p></div></section>`;
  misses.sort((a, b) => (a.target < b.target ? 1 : -1));
  const missCard = `<section class="block"><div class="block-head"><h2>빗나간 예측</h2><span class="muted">범위 밖으로 나간 최근 예측</span></div><div class="card table-wrap">${misses.length ? `<table class="compact"><thead><tr><th>종목</th><th>기간</th><th>예측 범위</th><th>실제</th><th>중앙값 대비</th></tr></thead><tbody>${misses.slice(0, 40).map((x) => `<tr><td><a href="${esc(x.href)}">${esc(x.name)}</a><div class="muted small">${esc(x.base)} → ${esc(x.target)}</div></td><td>${x.horizon}거래일</td><td>${won(x.p10)} ~ ${won(x.p90)}</td><td><b>${won(x.actual)}</b></td><td class="${tone(x.err)}">${pct(x.err)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">아직 범위 밖으로 나간 예측이 없어요.</p>'}</div></section>`;
  // Free: one headline number. Plus: the summary tables. Pro: per-stock records and every miss.
  const teaser = `<section class="block"><div class="card paper-link"><div><div class="pl-k">예측 범위 적중 (전체)</div><b style="font-size:24px">${totalScored ? `${Math.round((horizons.reduce((s, [, x]) => s + x.inside, 0) / totalScored) * 100)}%` : '채점 전'}</b><p class="muted small">${totalScored ? `채점 ${totalScored.toLocaleString('ko-KR')}건 · ` : ''}기간별 적중과 분석가 순위는 플러스, 종목별 상세와 빗나간 예측은 프로부터 볼 수 있어요.</p></div></div></section>`;
  const body = `<section class="hero" id="top"><div class="hero-main"><div class="eyebrow"><span>성적표</span><span>리포트 종목 ${live.length}개</span></div><h1>맞았는지, 기록으로 보여 드려요</h1>
<p class="hero-line">예측과 판단은 만든 날 그대로 기록하고, 기간이 지나면 실제 가격으로 채점해요. 틀린 기록도 지우지 않아요.</p></div></section>
${teaser}${gate(forecastCard + analystCard, { base: '', what: '기간별 예측 적중 · AI 분석가 순위' })}${gate(strategyCard + missCard, { base: '', what: '종목별 전략·모의투자 성적 · 빗나간 예측 하나하나', need: 'pro' })}
<footer id="sources" style="padding:24px 0 0"><p>매일 장 마감 뒤 다시 계산해요. 과거 성적이 앞으로의 결과를 보장하지 않아요. 투자 권유가 아니에요.</p></footer>`;
  return shell('', '성적표 | Gnomon Analytics', body, { active: 'scorecard' });
}

export function renderTerms(): string {
  const sec = (id: string, title: string, items: string[]) => `<section class="block" id="${id}"><div class="card terms"><h2>${title}</h2><ul class="plain">${items.map((i) => `<li>${i}</li>`).join('')}</ul></div></section>`;
  const body = `<section class="hero" id="top"><div class="hero-main"><div class="eyebrow"><span>이용약관 · 면책</span><span>초안</span></div><h1>이용약관과 면책</h1>
<p class="hero-line">법률 검토 전 초안이에요. 유료 서비스를 열기 전에 검토를 거쳐 바뀔 수 있어요.</p></div></section>
<section class="block"><p class="mock-note"><b>초안이에요.</b> 지금 Gnomon Analytics는 무료 시험 운영 중이고, 요금제와 결제는 MOCK이에요.</p></section>
${sec('nature', '서비스의 성격', [
    'Gnomon Analytics는 공개 데이터로 계산한 기술 지표, 적정가·예측 범위, AI 해설을 보여 주는 리서치 도구예요.',
    '<b>투자 자문이나 매매 권유가 아니에요.</b> 특정 종목을 사고팔라고 권하지 않고, 매수·매도 신호나 목표가를 제시하지 않아요.',
    '투자 판단과 그 결과는 이용자 본인의 책임이에요.',
    '유료로 정보를 제공하기 전에 자본시장법상 유사투자자문업 신고 등 필요한 절차를 확인하고 따를 예정이에요.',
  ])}
${sec('data', '데이터와 계산의 한계', [
    '가격·수급·실적은 Naver 금융·네이버 증권, 공시는 OpenDART, 뉴스는 네이버 뉴스 검색과 RSS에서 가져와요. 출처의 오류나 지연이 그대로 반영될 수 있어요.',
    '데이터를 받지 못한 날은 페이지에 그 사실을 표시하고, 없는 숫자를 만들어 넣지 않아요.',
    '기술 신호는 지표를 요약한 값이고 오를 확률이 아니에요. 예측 범위는 최근 변동성으로 계산한 범위이고 목표가가 아니에요.',
    '백테스트와 모의투자 성과는 과거 데이터로 계산한 가상의 결과이고, 실제 수익을 보장하지 않아요.',
  ])}
${sec('ai', 'AI 해설의 한계', [
    'AI 해설은 그 리포트에 모은 근거만 보고 쓰도록 하고, 주장마다 근거 표시를 달아요. 그래도 틀리거나 빠뜨릴 수 있어요.',
    'AI 분석가들은 같은 AI가 서로 다른 관점을 맡아 쓴 의견이에요. 실제 사람의 의견이 아니에요.',
    '예측과 판단은 만든 날 그대로 기록하고, 나중에 실제 가격으로 채점해 성적표에 공개해요.',
  ])}
${sec('plans', '요금제와 크레딧 (초안)', [
    '지금 요금제와 결제는 MOCK이에요. 실제로 결제되지 않고, 요금제와 크레딧은 이용자 브라우저에만 저장돼요.',
    '정식 운영 때의 가격, 크레딧 유효기간, 환불 기준은 출시 전에 이 페이지에 확정해서 알려요.',
    '결제는 볼 수 있는 깊이만 바꿔요. 같은 종목의 신호·숫자·기록은 누구에게나 같아요.',
  ])}
${sec('privacy', '개인정보', [
    '지금은 회원가입이 없고, 이름·연락처·결제 정보를 받지 않아요.',
    '관심 종목, 요금제(MOCK), 크레딧(MOCK)은 이용자 브라우저의 저장소(localStorage)에만 남아요. 브라우저 데이터를 지우면 함께 사라져요.',
    '로그인이 생기면 수집 항목과 보관 기간을 이 페이지에 먼저 알려요.',
  ])}
${sec('contact', '문의', ['오류 신고와 리포트 요청은 GitHub 이슈로 받아요.'])}
<footer id="sources" style="padding:24px 0 0"><p>마지막 수정: 초안. 투자 권유가 아니에요.</p></footer>`;
  return shell('', '이용약관·면책 | Gnomon Analytics', body, {});
}

/** Paper trading, all covered stocks (moved out of the stock tabs, G-36). Summary free, ledgers Pro. */
export function renderPaper(entries: readonly HomeEntry[]): string {
  const live = entries.filter((e): e is HomeEntry & { report: DailyReport } => !!e.report?.market?.paper?.length);
  const avg = (follower: (f: string) => boolean) => {
    const xs = live.flatMap((e) => e.report.market!.paper!.filter((b) => follower(b.follower)).map((b) => b.totalReturn));
    return xs.length ? (xs.reduce((s, v) => s + v, 0) / xs.length) * 100 : null;
  };
  const card = (label: string, v: number | null, sub: string) => `<div class="card ix"><div class="pl-k">${label}</div><div class="ix-v ${tone(v)}">${pct(v, 2)}</div><div class="muted small">${sub}</div></div>`;
  const summary = `<section class="block"><div class="ix-row pp-row">${card('전략 챔피언 따라 하기', avg((f) => f === 'champion'), '종목 평균')}${card('매수 후 보유', avg((f) => f === 'hold'), '비교 기준 · 종목 평균')}${card('AI 분석가 따라 하기', avg((f) => f.startsWith('analyst:')), '분석가 전체 평균')}</div></section>`;
  const ledgers = live.map((e) => `<section class="block"><div class="block-head"><h2><a href="${esc(e.href)}">${esc(e.name)}</a></h2></div>${paperPanel(e.report.market!.paper)}</section>`).join('');
  const body = `<section class="hero" id="top"><div class="hero-main"><div class="eyebrow"><span>모의투자</span><span>리포트 종목 ${live.length}개</span></div><h1>따라 했다면 어땠을까요</h1>
<p class="hero-line">전략 챔피언과 AI 분석가의 판단을 그날 종가부터 따라 한 가상 계좌예요. 기록은 고치지 않고, 사고팔 때 비용을 빼요.</p></div></section>
<style>.pp-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.ix-v{font-size:22px;font-weight:800}@media (max-width:820px){.pp-row{grid-template-columns:minmax(0,1fr)}}</style>
<section class="block"><div class="card"><p class="muted small" style="margin:0">평균 성과는 플러스, 종목별 장부·매매 내역은 프로부터 볼 수 있어요. 내 가상 포트폴리오는 맥스에 출시 예정이에요.</p></div></section>
${gate(summary, { base: '', what: '따라 하기 평균 성과' })}${gate(ledgers || '<div class="card"><p class="empty">아직 장부 기록이 없어요.</p></div>', { base: '', what: '종목별 장부 · 매매 내역 · 수익 곡선', need: 'pro' })}
<footer id="sources" style="padding:24px 0 0"><p>가상 계좌예요. 과거 성과가 앞으로의 결과를 보장하지 않아요. 투자 권유가 아니에요.</p></footer>`;
  return shell('', '모의투자 | Gnomon Analytics', body, { active: 'paper' });
}
