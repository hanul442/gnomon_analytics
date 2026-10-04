// Pricing and a MOCK checkout (docs/DESIGN.md §5.8, G-30). Nothing is charged:
// "paying" only changes the plan and credit balance stored in this browser.

import { CREDIT_COST, CREDIT_PACKS, PLANS, won } from './plans.js';
import { shell } from './renderHtml.js';

const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" class="ck"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const COMPARE: readonly [string, boolean, boolean, boolean][] = [
  ['전 종목 검색과 1년 차트', true, true, true],
  ['한 줄 요약과 종합 기술 신호', true, true, true],
  ['AI 위원회 표결 분포와 한 단락 요약', true, true, true],
  ['뉴스·공시', true, true, true],
  ['성적표 요약(예측 적중률·분석가 순위)', true, true, true],
  ['지표 16개 판단 · 기간별 신호', false, true, true],
  ['적정가와 예측 범위', false, true, true],
  ['전략 대결 · 모의투자 장부', false, true, true],
  ['수급 · 펀더멘털 상세', false, true, true],
  ['AI 위원회 전체(위원별 근거·레드팀·시나리오)', false, true, true],
  ['매달 포함 크레딧', false, false, true],
];

const STYLE = `<style>
.pr-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.plan{display:flex;flex-direction:column;gap:10px;position:relative}
.plan h3{margin:0;font-size:18px}.plan .price{font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.01em}.plan .price small{font-size:14px;font-weight:600;color:var(--muted)}
.plan ul{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-direction:column;gap:7px;font-size:14px;flex:1}.plan li{display:flex;gap:7px;align-items:flex-start}.ck{width:17px;height:17px;flex:none;color:var(--accent);margin-top:2px}
.plan.featured{border:2px solid var(--navy)}.plan .ribbon{position:absolute;top:-11px;left:16px;background:var(--navy);color:#fff;font-size:12px;font-weight:700;border-radius:999px;padding:2px 10px}
.plan .btn-primary,.pack .btn-primary{justify-content:center}.plan .is-current{display:none;text-align:center;font-weight:700;color:var(--muted);padding:12px}
html[data-plan=free] .plan[data-key=free] .is-current,html[data-plan=plus] .plan[data-key=plus] .is-current,html[data-plan=pro] .plan[data-key=pro] .is-current{display:block}
html[data-plan=free] .plan[data-key=free] .btn-primary,html[data-plan=plus] .plan[data-key=plus] .btn-primary,html[data-plan=pro] .plan[data-key=pro] .btn-primary{display:none}
.acct-card{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}.acct-card b{font-size:18px}.link-btn{border:0;background:none;color:var(--accent);font:inherit;font-weight:600;cursor:pointer;text-decoration:underline;padding:0}
.cmp td:not(:first-child),.cmp th:not(:first-child){text-align:center;width:16%}.cmp .yes{color:var(--accent);font-weight:700}.cmp .no{color:#b8c0cc}
.packs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.pack{display:flex;flex-direction:column;gap:6px}.pack b{font-size:22px}.pack .per{font-size:12px;color:var(--muted)}
.faq details{border-top:1px solid var(--line);padding:10px 0}.faq summary{font-weight:600;cursor:pointer}.faq p{margin:6px 0 0;font-size:14px;color:var(--fg2)}
.co{max-width:620px;margin:0 auto;display:flex;flex-direction:column;gap:14px}.co-row{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--line)}.co-row:first-of-type{border-top:0}.co-total{font-size:20px;font-weight:800}
.pay{display:flex;flex-direction:column;gap:8px}.pay label{display:flex;align-items:center;gap:10px;border:1px solid var(--line-strong);border-radius:12px;padding:12px 14px;cursor:pointer}.pay input{accent-color:var(--navy);width:18px;height:18px}
.co .credit-btn{width:100%;justify-content:center;padding:14px;font-size:16px}.co .credit-btn[disabled]{opacity:.45;cursor:not-allowed}.agree{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--fg2)}
.done{text-align:center}.done svg{width:52px;height:52px;color:var(--accent)}.log{font-size:13px}.log td{padding:7px 6px}
@media (max-width:820px){.pr-grid,.packs{grid-template-columns:minmax(0,1fr)}.cmp{font-size:12px}}
</style>`;

export function renderPricing(): string {
  const plan = (p: (typeof PLANS)[number]) => `<div class="card plan${p.key === 'plus' ? ' featured' : ''}" data-key="${p.key}">${p.key === 'plus' ? '<span class="ribbon">추천</span>' : ''}
<h3>${p.name}</h3><div class="muted small">${p.tagline}</div><div class="price">${p.price ? `${won(p.price)}<small> / 월</small>` : '0원'}</div>
<ul>${p.features.map((f) => `<li>${CHECK}<span>${f}</span></li>`).join('')}</ul>
<div class="is-current">지금 쓰는 요금제</div>${p.price ? `<a class="btn-primary" href="checkout.html?item=${p.key}">${p.name} 시작하기</a>` : '<button type="button" class="btn-primary" data-downgrade style="border:0;cursor:pointer">무료로 바꾸기</button>'}</div>`;
  const yes = (v: boolean) => (v ? `<td class="yes">${CHECK}</td>` : '<td class="no">—</td>');
  const base = CREDIT_PACKS[0]!.price / CREDIT_PACKS[0]!.credits;
  const body = `${STYLE}<section class="hero" id="top"><div class="hero-main"><div class="eyebrow"><span>요금제</span></div><h1>필요한 만큼 깊이 보세요</h1>
<p class="hero-line">결제는 깊이를 바꿀 뿐, 진실을 바꾸지 않아요. 같은 종목의 신호·숫자·기록은 누구에게나 같고, 유료는 그 이유를 더 자세히 보여 줘요.</p></div></section>
<section class="block"><p class="mock-note"><b>MOCK 화면이에요.</b> 실제로 결제되지 않고, 요금제와 크레딧은 이 브라우저에만 저장돼요. 가격과 구성은 출시 전에 바뀔 수 있어요.</p></section>
<section class="block"><div class="card acct-card"><div><div class="muted small">지금 요금제</div><b data-plan-name>무료</b> · <span data-credits>0</span> 크레딧</div><div><a href="#log" class="link-btn">크레딧 사용 내역</a></div></div></section>
<section class="block"><div class="pr-grid">${PLANS.map(plan).join('')}</div></section>
<section class="block"><div class="block-head"><h2>요금제별로 볼 수 있는 것</h2></div><div class="card table-wrap"><table class="cmp"><thead><tr><th>기능</th>${PLANS.map((p) => `<th>${p.name}</th>`).join('')}</tr></thead><tbody>
${COMPARE.map(([label, a, b, c]) => `<tr><td>${label}</td>${yes(a)}${yes(b)}${label.startsWith('매달') ? '<td class="yes">100</td>' : yes(c)}</tr>`).join('')}</tbody></table></div></section>
<section class="block" id="credits"><div class="block-head"><h2>크레딧 충전</h2><span class="muted">요금제와 상관없이 누구나 충전해서 써요</span></div>
<div class="packs">${CREDIT_PACKS.map((k) => {
    const per = k.price / k.credits, off = Math.round((1 - per / base) * 100);
    return `<div class="card pack"><span class="muted small">${off > 0 ? `${off}% 더 저렴` : '기본'}</span><b>${k.credits}크레딧</b><div class="price" style="font-size:20px;font-weight:800">${won(k.price)}</div><span class="per">크레딧당 ${Math.round(per)}원</span><a class="btn-primary" href="checkout.html?item=${k.key}">충전하기</a></div>`;
  }).join('')}</div>
<div class="card" style="margin-top:12px"><table class="compact"><thead><tr><th>크레딧으로 하는 일</th><th>필요한 크레딧</th></tr></thead><tbody>
<tr><td>리포트 요청: 리포트가 없는 종목에 AI 위원회 리포트를 한 번 써요</td><td><b>${CREDIT_COST.report}</b></td></tr>
<tr><td>AI 질문: 종목 페이지에서 리포트 근거로 답을 받아요</td><td><b>${CREDIT_COST.question}</b></td></tr></tbody></table></div></section>
<section class="block" id="log"><div class="block-head"><h2>크레딧 사용 내역</h2><span class="muted">이 브라우저 기록</span></div><div class="card"><div id="log-body"><p class="empty">아직 내역이 없어요.</p></div></div></section>
<section class="block faq"><div class="block-head"><h2>자주 묻는 것</h2></div><div class="card">
<details><summary>지금 결제하면 실제로 돈이 나가나요?</summary><p>아니요. 이 화면은 요금제 구조를 보여 주는 MOCK이에요. 결제 버튼은 이 브라우저의 요금제와 크레딧만 바꿔요.</p></details>
<details><summary>잠긴 내용은 어떻게 열리나요?</summary><p>플러스부터 상세 내용이 보여요. 지금은 화면에서만 가리는 MOCK이고, 실제 서비스에서는 로그인한 계정으로 확인해요.</p></details>
<details><summary>크레딧은 언제 사라지나요? (초안)</summary><p>프로에 포함된 100크레딧은 매달 새로 채워지고, 남은 포함 크레딧은 이월되지 않아요. 따로 충전한 크레딧은 1년 동안 써요.</p></details>
<details><summary>투자 자문인가요?</summary><p>아니요. 공개 데이터로 계산한 결과와 AI 해설이고, 매수·매도를 권하지 않아요. 유료 서비스를 열기 전에 관련 법(유사투자자문업 신고 등)을 확인할 예정이에요.</p></details></div></section>
<footer id="sources" style="padding:24px 0 0"><p>가격은 부가세 포함 기준의 초안이에요. 투자 권유가 아니에요.</p></footer>`;
  return shell('', '요금제 | Gnomon Analytics', body, { bottomNav: true, scripts: PRICING_SCRIPT });
}

const PRICING_SCRIPT = `<script>
(function () {
  var G = window.GNM; if (!G) return;
  var KIND = { report: '리포트 요청', question: 'AI 질문', topup: '충전', plan: '요금제' };
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
  ...CREDIT_PACKS.map((k) => ({ key: k.key, title: `${k.credits}크레딧 충전`, price: k.price, plan: null as string | null, credits: k.credits, note: '요금제와 상관없이 사용' })),
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
  return shell('', '결제 | Gnomon Analytics', body, { bottomNav: true, scripts: `<script>
(function () {
  var G = window.GNM, ITEMS = ${JSON.stringify(ITEMS)};
  var key = new URLSearchParams(location.search).get('item'), item = ITEMS.find(function (x) { return x.key === key; });
  var $ = function (id) { return document.getElementById(id); };
  var won = function (v) { return v.toLocaleString('ko-KR') + '원'; };
  if (!item || !G) return;
  $('co-title').textContent = item.title; $('co-price').textContent = won(item.price); $('co-note').textContent = item.note; $('co-total').textContent = won(item.price);
  $('co-agree').addEventListener('change', function (e) { $('co-pay').disabled = !e.target.checked; });
  $('co-pay').addEventListener('click', function () {
    var a = G.read(), now = new Date().toISOString();
    if (item.plan) { a.plan = item.plan; a.log.unshift({ at: now, kind: 'plan', amount: 0, note: item.title + ' 시작 (MOCK)' }); }
    if (item.credits) { a.credits += item.credits; a.log.unshift({ at: now, kind: 'topup', amount: item.credits, note: item.title + ' (MOCK)' }); }
    G.write(a);
    $('co-form').hidden = true; $('co-done').hidden = false;
    $('co-result').textContent = item.title + ' · ' + won(item.price) + '. 지금 요금제는 ' + ({ free: '무료', plus: '플러스', pro: '프로' })[a.plan] + ', 크레딧은 ' + a.credits + '개예요.';
  });
})();
</script>` });
}
