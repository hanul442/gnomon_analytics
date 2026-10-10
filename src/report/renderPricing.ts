// Pricing and a MOCK checkout (docs/DESIGN.md §5.8, G-30). Nothing is charged:
// "paying" only changes the plan and credit balance stored in this browser.

import { CREDIT_ACTIONS, CREDIT_COST, CREDIT_PACKS, PLANS, UNLOCK, won } from './plans.js';
import { shell } from './renderHtml.js';
import { glowCta } from './glowCta.js';

const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" class="ck"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

type Cell = boolean | string;
/** One row per feature: free, plus, pro, max. */
const COMPARE: readonly [string, Cell, Cell, Cell, Cell][] = [
  ['전 종목 검색과 1년 차트', true, true, true, true],
  ['한 줄 요약 · 지표 16개 판단 · AI 표 분포', true, true, true, true],
  ['외국인·기관 수급 · 실적·밸류에이션 · 뉴스·공시', true, true, true, true],
  ['성적표 대표 숫자 · 전략 챔피언 이름', true, true, true, true],
  ['성적표 요약표 · 전략 순위표 · 모의투자 평균', false, true, true, true],
  ['기간별 신호 게이지 · 기술적 적정가', false, true, true, true],
  ['예측 가격 범위 · 분석가 예상가', false, false, true, true],
  ['수급 흔적 · 가격 구조 분석', false, true, true, true],
  ['전략 대결 전체 · 모의투자 종목별 장부', false, false, true, true],
  ['제한된 AI 위원회(결론·데스크 입장·레드팀 한 줄) · 심층 리포트 매달 5개 무료 열기', false, true, true, true],
  ['AI 위원회 리포트 전체(위원별 근거·예측·레드팀·시나리오)', false, false, true, true],
  ['성적표 종목별 상세 · 빗나간 예측', false, false, true, true],
  ['관심 종목', '5개', '30개', '100개', '무제한'],
  ['매달 포함 크레딧', false, false, '300', '1,000'],
  ['크레딧 충전 · 리포트 요청 · AI 질문', false, true, true, true],
  ['전문가 AI 초청', false, false, '크레딧', '매달 30회 포함'],
  ['전문가 정기 초청(주간 위원회 고정)', false, false, false, '5명'],
  ['충전할 때 추가 크레딧', false, false, '+10%', '+20%'],
  ['관심 종목 매주 AI 위원회 자동 리포트', false, false, false, '10종목'],
  ['스크리너', '빠른 조건 1개·5개', '조건 검색 전체', '+ 조건 백테스트(출시 예정)', '+ 조건 백테스트(출시 예정)'],
  ['차트 그리기(추세선·수평선·박스·피보나치·메모)', '저장 안 됨', '10종목 저장', '무제한', '무제한'],
  ['차트 일·주·월봉 전환 · 지수와 겹쳐 보기', true, true, true, true],
  ['아이디어 검증 · 이벤트 스터디 · 수급 랭킹 · 알림 (출시 예정)', false, false, true, true],
  ['전략 랩 · 포트폴리오 리스크 · 시점 재현 · 내보내기 (출시 예정)', false, false, false, true],
  ['알림: 매일 리포트 · 요청한 리포트 완성 (🔔)', true, true, true, true],
  ['알림: 휴대폰 푸시', false, true, true, true],
  ['알림: 관심 종목 새 리포트', false, true, true, true],
  ['알림: 가격 도달 (강세·약세 가격대 진입 등)', '1개', '5개', '20개', '50개'],
  ['알림: 스크리너 조건', false, '3개', '20개', '50개'],
  ['알림: 관심 종목 장중 급등락·거래량', false, false, true, true],
];

const STYLE = `<style>.soon-more{margin:4px 0 8px}.soon-more summary{cursor:pointer;font-size:13px;font-weight:700;color:var(--muted);padding:6px 0}
.pr-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.plan .inherits{font-size:12px;font-weight:700;color:var(--muted)}.plan .soon{color:var(--muted)}.plan .soon em{font-style:normal;font-size:11px;font-weight:700;background:var(--soft);border-radius:999px;padding:0 6px;margin-left:4px}/* G-184: the top plan is a glass card lit from inside, with a light running round its edge (no solid blue slab). */
.plan.top{position:relative;isolation:isolate;background:linear-gradient(165deg,rgba(0,166,251,.18),rgba(5,130,202,.05) 48%,var(--surface) 100%);border:1px solid var(--accent-line);box-shadow:0 22px 60px -28px rgba(0,166,251,.55)}
.plan.top::before{content:"";position:absolute;inset:-1px;z-index:-1;border-radius:inherit;padding:1.5px;background:conic-gradient(from var(--beam,0deg),transparent 0 66%,rgba(0,166,251,.9) 80%,#8FD0FF 86%,transparent 94%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:pr-beam 7s linear infinite;pointer-events:none}
@property --beam{syntax:"<angle>";inherits:false;initial-value:0deg}@keyframes pr-beam{to{--beam:360deg}}
@media (prefers-reduced-motion:reduce){.plan.top::before{animation:none}}.plan{display:flex;flex-direction:column;gap:10px;position:relative}
.plan h3{margin:0;font-size:18px}.plan .price{font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.01em}.plan .price small{font-size:14px;font-weight:600;color:var(--muted)}
.plan ul{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-direction:column;gap:7px;font-size:14px;flex:1}.plan li{display:flex;gap:7px;align-items:flex-start}.ck{width:17px;height:17px;flex:none;color:var(--accent);margin-top:2px}
.plan.featured{border:2px solid var(--navy)}.plan .ribbon{position:absolute;top:-11px;left:16px;background:var(--navy);color:var(--on-accent);font-size:12px;font-weight:700;border-radius:999px;padding:2px 10px}
.plan .btn-primary,.pack .btn-primary{justify-content:center}.plan .is-current{display:none;text-align:center;font-weight:700;color:var(--muted);padding:12px}
html[data-plan=free] .plan[data-key=free] .is-current,html[data-plan=plus] .plan[data-key=plus] .is-current,html[data-plan=pro] .plan[data-key=pro] .is-current,html[data-plan=max] .plan[data-key=max] .is-current{display:block}
html[data-plan=free] .plan[data-key=free] .btn-primary,html[data-plan=plus] .plan[data-key=plus] .btn-primary,html[data-plan=pro] .plan[data-key=pro] .btn-primary,html[data-plan=pro] .plan[data-key=pro] .glow-cta,html[data-plan=max] .plan[data-key=max] .btn-primary{display:none}
.acct-card{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}.acct-card b{font-size:18px}.link-btn{border:0;background:none;color:var(--accent);font:inherit;font-weight:600;cursor:pointer;text-decoration:underline;padding:0}
.cmp td:not(:first-child),.cmp th:not(:first-child){text-align:center;width:13%}.cmp .val{font-weight:700}.cmp .yes{color:var(--accent);font-weight:700}.cmp .no{color:#b8c0cc}
.packs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.pack{display:flex;flex-direction:column;gap:6px}.pack b{font-size:22px}.pack .per{font-size:12px;color:var(--muted)}
.faq details{border-top:1px solid var(--line);padding:10px 0}.faq summary{font-weight:600;cursor:pointer}.faq p{margin:6px 0 0;font-size:14px;color:var(--fg2)}
.co{max-width:620px;margin:0 auto;display:flex;flex-direction:column;gap:14px}.co-row{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--line)}.co-row:first-of-type{border-top:0}.co-total{font-size:20px;font-weight:800}
.pay{display:flex;flex-direction:column;gap:8px}.pay label{display:flex;align-items:center;gap:10px;border:1px solid var(--line-strong);border-radius:12px;padding:12px 14px;cursor:pointer}.pay input{accent-color:var(--navy);width:18px;height:18px}
.co .credit-btn{width:100%;justify-content:center;padding:14px;font-size:16px}.co .credit-btn[disabled]{opacity:.45;cursor:not-allowed}.agree{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--fg2)}
.done{text-align:center}.done svg{width:52px;height:52px;color:var(--accent)}.log{font-size:13px}.log td{padding:7px 6px}
.pr-tabs{display:none}.fold>summary{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 10px;cursor:pointer;list-style:none;font-size:16px}.fold>summary::-webkit-details-marker{display:none}.fold>summary::after{content:"펼치기 ▾";font-size:13px;font-weight:700;color:var(--accent-strong)}.fold[open]>summary::after{content:"접기 ▴"}.fold[open]>summary{margin-bottom:10px}
@media (max-width:1100px){.pr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:820px){.pr-tabs{display:flex;margin-bottom:12px}.pr-tabs button{flex:1}.pr-grid>.plan{display:none}.pr-grid[data-show=free]>[data-key=free],.pr-grid[data-show=plus]>[data-key=plus],.pr-grid[data-show=pro]>[data-key=pro],.pr-grid[data-show=max]>[data-key=max]{display:flex}.packs{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px}.pack{padding:12px 10px}.pack b{font-size:16px}.pack .price{font-size:15px!important}.pack .btn-primary{padding:9px 6px;font-size:13px}}@media (max-width:820px){.pr-grid{grid-template-columns:minmax(0,1fr)}.cmp{font-size:12px}.cmp td,.cmp th{padding:6px 4px}}
</style>`;

export function renderPricing(): string {
  const plan = (p: (typeof PLANS)[number], i: number) => `<div class="card plan${p.key === 'pro' ? ' featured' : ''}${p.key === 'max' ? ' top' : ''}" data-key="${p.key}">${p.key === 'pro' ? '<span class="ribbon">추천</span>' : ''}
<h3>${p.name}</h3><div class="muted small">${p.tagline}</div><div class="price">${p.price ? `${won(p.price)}<small> / 월</small>` : '0원'}</div>
${i ? `<div class="inherits">${PLANS[i - 1]!.name}의 모든 것에 더해</div>` : ''}<ul>${p.adds.map((f) => `<li>${CHECK}<span>${f}</span></li>`).join('')}</ul>${p.soon?.length ? `<details class="soon-more"><summary>출시 예정 ${p.soon.length}개</summary><ul>${p.soon.map((f) => `<li class="soon">${CHECK}<span>${f}</span></li>`).join('')}</ul></details>` : ''}
<div class="is-current">지금 쓰는 요금제</div>${p.price ? (p.key === 'pro' ? glowCta(`checkout.html?item=${p.key}`, `${p.name} 시작하기`) : `<a class="btn-primary" href="checkout.html?item=${p.key}">${p.name} 시작하기</a>`) : '<button type="button" class="btn-primary" data-downgrade style="border:0;cursor:pointer">무료로 바꾸기</button>'}</div>`;
  const yes = (v: Cell) => (typeof v === 'string' ? `<td class="val">${v}</td>` : v ? `<td class="yes">${CHECK}</td>` : '<td class="no">—</td>');
  const base = CREDIT_PACKS[0]!.price / CREDIT_PACKS[0]!.credits;
  const body = `${STYLE}<section class="hero" id="top"><div class="hero-main"><div class="eyebrow"><span>요금제</span></div><h1>필요한 만큼 깊이 보세요</h1>
<p class="hero-line">결제는 깊이를 바꿀 뿐, 진실을 바꾸지 않아요. 같은 종목의 신호·숫자·기록은 누구에게나 같고, 유료는 그 이유를 더 자세히 보여 줘요.</p></div></section>
<section class="block"><p class="mock-note"><b>MOCK 화면이에요.</b> 실제로 결제되지 않고, 요금제와 크레딧은 이 브라우저에만 저장돼요. 가격과 구성은 출시 전에 바뀔 수 있어요.</p></section>
<section class="block"><div class="card acct-card"><div><div class="muted small">지금 요금제</div><b data-plan-name>무료</b> · <span data-credits>0</span> 크레딧 <span class="muted small" data-trial></span></div><div><a href="#log" class="link-btn">크레딧 사용 내역</a></div></div></section>
<section class="block"><div class="seg pr-tabs" role="tablist" aria-label="요금제 고르기">${PLANS.map((p) => `<button type="button" role="tab" data-pr="${p.key}" aria-selected="${p.key === 'pro'}">${p.name}</button>`).join('')}</div><div class="pr-grid" data-show="pro">${PLANS.map(plan).join('')}</div></section>
<section class="block"><details class="card fold" data-open-wide><summary><b>요금제별로 볼 수 있는 것</b><span class="muted small">기능 ${COMPARE.length}개 비교</span></summary><div class="table-wrap"><table class="cmp"><thead><tr><th>기능</th>${PLANS.map((p) => `<th>${p.name}</th>`).join('')}</tr></thead><tbody>
${COMPARE.map(([label, ...cells]) => `<tr><td>${label}</td>${cells.map(yes).join('')}</tr>`).join('')}</tbody></table></div></details></section>
<section class="block" id="credits"><div class="block-head"><h2>크레딧 충전</h2><span class="muted">플러스부터 충전하고 쓸 수 있어요</span></div>
<div class="packs">${CREDIT_PACKS.map((k) => {
    const per = k.price / k.credits, off = Math.round((1 - per / base) * 100);
    return `<div class="card pack"><span class="muted small">${off > 0 ? `${off}% 더 저렴` : '기본'}</span><b>${k.credits}크레딧</b><div class="price" style="font-size:20px;font-weight:800">${won(k.price)}</div><span class="per">크레딧당 ${Math.round(per)}원</span><a class="btn-primary" href="checkout.html?item=${k.key}">충전하기</a></div>`;
  }).join('')}</div>
<details class="card fold" style="margin-top:12px" data-open-wide><summary><b>크레딧으로 하는 일</b><span class="muted small">${CREDIT_ACTIONS.length}가지 · 필요한 크레딧</span></summary><table class="compact"><thead><tr><th>크레딧으로 하는 일</th><th>필요한 크레딧</th><th>쓸 수 있는 요금제</th></tr></thead><tbody>
${CREDIT_ACTIONS.map((a) => `<tr><td><b>${a.label}</b>: ${a.detail}</td><td><b>${CREDIT_COST[a.key]}</b></td><td>${PLANS.find((p) => p.key === a.min)!.name}부터</td></tr>`).join('')}</tbody></table>
<p class="fine">가끔 이벤트로 체험 크레딧을 드려요. 무료 이용자도 체험 크레딧으로 AI 빠른 질문을 해 볼 수 있고, 이벤트가 끝나면 남은 체험 크레딧은 사라져요. 프로는 충전할 때 10%, 맥스는 20%를 더 받아요. 요금제에 포함된 크레딧은 매달 새로 채워지고 이월되지 않아요. 충전한 크레딧은 1년 동안 써요.</p></details></section>
<section class="block" id="log"><div class="block-head"><h2>크레딧 사용 내역</h2><span class="muted">이 브라우저 기록</span></div><div class="card"><div id="log-body"><p class="empty">아직 내역이 없어요.</p></div></div></section>
<section class="block faq"><div class="block-head"><h2>자주 묻는 것</h2></div><div class="card">
<details><summary>지금 결제하면 실제로 돈이 나가나요?</summary><p>아니요. 이 화면은 요금제 구조를 보여 주는 MOCK이에요. 결제 버튼은 이 브라우저의 요금제와 크레딧만 바꿔요.</p></details>
<details><summary>잠긴 리포트는 어떻게 열리나요?</summary><p>플러스부터 상세 내용이 보여요. AI 위원회 심층 리포트(매일 리포트와 다른 사람이 만든 리포트)는 한 번 열 때 ${CREDIT_COST.unlock}크레딧이고, 한 번 열면 계속 봐요. 플러스는 매달 5개, 알파는 10개까지 무료로 열고, 만든 지 7일이 지난 리포트는 누구나 무료예요. 프로·맥스와 리포트를 만든 사람은 크레딧 없이 바로 봐요. 다른 사람이 내가 만든 리포트를 크레딧으로 열면 나에게 ${UNLOCK.makerShare}크레딧이 돌아와요(리포트 하나에 ${UNLOCK.makerCap}크레딧까지).</p></details>
<details><summary>크레딧은 언제 사라지나요? (초안)</summary><p>프로·맥스에 포함된 크레딧은 매달 새로 채워지고, 남은 포함 크레딧은 이월되지 않아요. 따로 충전한 크레딧은 1년 동안 써요.</p></details>
<details><summary>요금제마다 무엇이 달라요?</summary><p>AI 리포트는 모두 AI 위원회 심층 리포트 한 종류예요(한 번 만들 때 ${CREDIT_COST.report}크레딧). 플러스는 계산 상세를 보고 크레딧으로 심층 리포트를 요청해요. 프로는 AI 위원회 리포트 전체·전략·모의투자를 바로 봐요. 맥스는 관심 종목 10개를 매주 AI 위원회가 알아서 분석하고, 전문가용 도구(전략 랩·포트폴리오 리스크·시점 재현)를 써요.</p></details>
<details><summary>투자 자문인가요?</summary><p>아니요. 공개 데이터로 계산한 결과와 AI 해설이고, 매수·매도를 권하지 않아요. 유료 서비스를 열기 전에 관련 법(유사투자자문업 신고 등)을 확인할 예정이에요.</p></details></div></section>
<footer id="sources" style="padding:24px 0 0"><p>가격은 부가세 포함 기준의 초안이에요. 투자 권유가 아니에요.</p></footer>`;
  return shell('', '요금제 | GNOMON', body, { active: 'pricing', scripts: PRICING_SCRIPT });
}

const PRICING_SCRIPT = `<script>
(function () {
  // Phones show one plan at a time (G-122); the current paid plan opens first, otherwise 프로. Long tables open on wide screens.
  var grid = document.querySelector('.pr-grid'), tabs = [].slice.call(document.querySelectorAll('[data-pr]'));
  var pick = function (k) { grid.setAttribute('data-show', k); tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-pr') === k)); }); };
  tabs.forEach(function (t) { t.addEventListener('click', function () { pick(t.getAttribute('data-pr')); }); });
  var cur = document.documentElement.getAttribute('data-plan'); if (cur && cur !== 'free' && document.querySelector('[data-pr=' + cur + ']')) pick(cur);
  if (matchMedia('(min-width:821px)').matches) document.querySelectorAll('[data-open-wide]').forEach(function (d) { d.open = true; });
  var G = window.GNM; if (!G) return;
  var KIND = { report: '심층 리포트 요청', brief: '요약 리포트 요청(이전)', upgrade: '심층 업그레이드(이전)', idea: '아이디어 검증', question: 'AI 빠른 질문', standard: 'AI 표준 질문', deep: 'AI 심층 질문', topup: '충전', trial: '체험 크레딧', plan: '요금제' };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var draw = function () {
    var a = G.read(), el = document.getElementById('log-body');
    if (!a.log.length) { el.innerHTML = '<p class="empty">아직 내역이 없어요.</p>'; return; }
    el.innerHTML = '<table class="log"><tbody>' + a.log.slice(0, 30).map(function (x) { return '<tr><td class="muted">' + esc(x.at.slice(0, 16).replace('T', ' ')) + '</td><td>' + esc(KIND[x.kind] || x.kind) + (x.note ? ' · ' + esc(x.note) : '') + '</td><td style="text-align:right;font-weight:700">' + (x.amount > 0 ? '+' : '') + (x.amount || '') + '</td></tr>'; }).join('') + '</tbody></table>';
  };
  document.querySelectorAll('[data-downgrade]').forEach(function (b) {
    b.addEventListener('click', function () { var a = G.read(); a.plan = 'free'; a.log.unshift({ at: new Date().toISOString(), kind: 'plan', amount: 0, note: '무료로 변경' }); G.write(a); draw(); G.toast('무료 요금제로 바꿨어요.'); });
  });
  draw();
})();
</script>`;

const ITEMS = [
  ...PLANS.filter((p) => p.price).map((p) => ({ key: p.key, title: `${p.name} 요금제 (월)`, price: p.price, plan: p.key, credits: p.monthlyCredits, note: p.monthlyCredits ? `매달 ${p.monthlyCredits}크레딧 포함` : '상세 설명 전체' })),
  ...CREDIT_PACKS.map((k) => ({ key: k.key, title: `${k.credits}크레딧 충전`, price: k.price, plan: null as string | null, credits: k.credits, note: '플러스부터 사용 · 프로 +10%, 맥스 +20%' })),
];

export function renderCheckout(): string {
  const body = `${STYLE}<div class="co"><section class="hero" id="top" style="margin-bottom:0"><div class="hero-main"><div class="eyebrow"><span>결제</span></div><h1>주문 확인</h1></div></section>
<p class="mock-note"><b>MOCK 결제예요.</b> 카드 정보를 받지 않고, 실제로 결제되지 않아요. 버튼을 누르면 이 브라우저의 요금제와 크레딧만 바뀌어요.</p>
<div id="co-form"><div class="card"><div class="pl-k">주문 내용</div><div class="co-row"><span id="co-title">상품을 고르지 않았어요</span><b id="co-price">—</b></div><div class="co-row"><span class="muted" id="co-note"></span><span></span></div><div class="co-row"><span>결제 금액</span><span class="co-total" id="co-total">—</span></div></div>
<div class="card"><div class="pl-k" style="margin-bottom:8px">결제 수단 (MOCK)</div><div class="pay">
<label><input type="radio" name="pay" value="card" checked> 신용·체크카드</label><label><input type="radio" name="pay" value="easy"> 간편결제</label><label><input type="radio" name="pay" value="bank"> 계좌이체</label></div></div>
<label class="agree"><input type="checkbox" id="co-agree"> <span>MOCK 결제이고 실제로 청구되지 않는다는 것, 그리고 이 서비스가 투자 권유가 아니라는 것을 확인했어요.</span></label>
<button type="button" class="credit-btn" id="co-pay" disabled>테스트 결제하기</button>
<p class="muted small" style="text-align:center"><a href="pricing.html">요금제로 돌아가기</a></p></div>
<div id="co-done" class="card done" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
<h2 style="margin:6px 0">테스트 결제가 끝났어요</h2><p id="co-result"></p><p class="muted small">MOCK 영수증이에요. 실제 결제 기록이 아니에요.</p><p><a class="btn-primary" href="index.html">홈으로</a> <a href="pricing.html" style="margin-left:10px">요금제 보기</a></p></div></div>
<footer id="sources" style="padding:24px 0 0"><p>투자 권유가 아니에요.</p></footer>`;
  return shell('', '결제 | GNOMON', body, { active: 'pricing', scripts: `<script>
(function () {
  var G = window.GNM, ITEMS = ${JSON.stringify(ITEMS)}, BONUS = ${JSON.stringify(Object.fromEntries(PLANS.map((p) => [p.key, p.topUpBonus])))};
  var key = new URLSearchParams(location.search).get('item'), item = ITEMS.find(function (x) { return x.key === key; });
  var $ = function (id) { return document.getElementById(id); };
  var won = function (v) { return v.toLocaleString('ko-KR') + '원'; };
  if (!item || !G) return;
  if (!item.plan && G.read().plan === 'free') { document.getElementById('co-form').innerHTML = '<div class="card"><p>크레딧은 플러스 요금제부터 충전할 수 있어요.</p><p><a class="btn-primary" href="checkout.html?item=plus">플러스 시작하기</a></p></div>'; return; }
  $('co-title').textContent = item.title; $('co-price').textContent = won(item.price); $('co-note').textContent = item.note; $('co-total').textContent = won(item.price);
  $('co-agree').addEventListener('change', function (e) { $('co-pay').disabled = !e.target.checked; });
  $('co-pay').addEventListener('click', function () {
    var a = G.read(), now = new Date().toISOString();
    if (item.plan) { a.plan = item.plan; a.log.unshift({ at: now, kind: 'plan', amount: 0, note: item.title + ' 시작 (MOCK)' }); }
    var add = item.plan ? item.credits : Math.round(item.credits * (1 + (BONUS[a.plan] || 0) / 100));
    if (add) { a.credits += add; a.log.unshift({ at: now, kind: 'topup', amount: add, note: item.title + (add > item.credits ? ' +보너스' : '') + ' (MOCK)' }); }
    G.write(a);
    $('co-form').hidden = true; $('co-done').hidden = false;
    $('co-result').textContent = item.title + ' · ' + won(item.price) + '. 지금 요금제는 ' + ({ free: '무료', plus: '플러스', pro: '프로', max: '맥스' })[a.plan] + ', 크레딧은 ' + a.credits + '개예요.';
  });
})();
</script>` });
}
