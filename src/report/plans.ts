// Plans, credits and the paywall (docs/DESIGN.md §5.8, G-30). This is a MOCK:
// the site is static, so the plan and credit balance live in the visitor's
// browser (localStorage) and locked sections are only hidden on screen. Real
// enforcement needs accounts and a server (Phase 3). Payment never truly happens.
//
// Plans change depth, never the truth: every visitor sees the same signals,
// numbers and records; paying shows more of the reasoning.

export type PlanKey = 'free' | 'plus' | 'pro';

export interface Plan { key: PlanKey; name: string; price: number; tagline: string; monthlyCredits: number; features: string[] }

export const PLANS: readonly Plan[] = [
  { key: 'free', name: '무료', price: 0, tagline: '한 줄 요약', monthlyCredits: 0, features: ['전 종목 검색과 1년 차트', '종목마다 한 줄 요약과 종합 기술 신호', 'AI 위원회 표결 분포와 요약', '뉴스·공시', '성적표 요약(예측 적중률·분석가 순위)'] },
  { key: 'plus', name: '플러스', price: 9900, tagline: '상세 설명', monthlyCredits: 0, features: ['무료의 모든 것', '지표 16개 판단과 기간별 신호', '적정가와 예측 범위', '전략 대결과 모의투자 장부', '수급·펀더멘털 상세', 'AI 위원회 전체(분석가 근거·레드팀·시나리오)'] },
  { key: 'pro', name: '프로', price: 29000, tagline: '상세 설명 + 매달 100크레딧', monthlyCredits: 100, features: ['플러스의 모든 것', '매달 100크레딧 포함', '리포트 요청과 AI 질문에 크레딧 사용', '충전 크레딧은 그대로 쌓여요'] },
];

/** What a credit action costs. Anyone with credits can use them, whatever the plan. */
export const CREDIT_COST = { report: 30, question: 2 } as const;

export interface CreditPack { key: string; credits: number; price: number }
export const CREDIT_PACKS: readonly CreditPack[] = [
  { key: 'c50', credits: 50, price: 4900 },
  { key: 'c120', credits: 120, price: 9900 },
  { key: 'c300', credits: 300, price: 22000 },
];

export const won = (v: number) => `${v.toLocaleString('ko-KR')}원`;

/** Runs in <head> before paint so locked sections never flash open. */
export const PLAN_BOOT = `<script>try{var a=JSON.parse(localStorage.getItem('gnm-account')||'{}');if(a.plan==='plus'||a.plan==='pro')document.documentElement.setAttribute('data-plan',a.plan)}catch(e){}</script>`;

const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" class="lock"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

/** A section only Plus and Pro see in full. Free visitors get a faded preview and a way in. */
export function gate(html: string, opts: { base: string; what: string }): string {
  return `<div class="gate" data-need="plus"><div class="gate-body">${html}</div><div class="gate-cta" role="note">${LOCK}<div><b>${opts.what}</b><span>플러스부터 볼 수 있어요</span></div><a class="btn-primary" href="${opts.base}pricing.html">요금제 보기</a></div></div>`;
}

export const PLAN_CSS = `
.gate{position:relative}.gate-cta{display:none}
html[data-plan=free] .gate>.gate-body{max-height:340px;overflow:hidden;filter:blur(4px);opacity:.7;pointer-events:none;user-select:none;-webkit-mask-image:linear-gradient(#000 40%,transparent);mask-image:linear-gradient(#000 40%,transparent)}
html[data-plan=free] .gate>.gate-cta{display:flex;align-items:center;gap:12px;position:absolute;left:50%;top:120px;transform:translateX(-50%);width:min(440px,92%);background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px;box-shadow:0 12px 32px rgba(15,27,45,.14);z-index:2}
.gate-cta .lock{width:22px;height:22px;color:var(--navy)}.gate-cta div{display:flex;flex-direction:column;flex:1;min-width:0}.gate-cta b{font-size:15px}.gate-cta span{font-size:13px;color:var(--muted)}.gate-cta .btn-primary{margin:0;padding:10px 14px;font-size:14px;white-space:nowrap}
.acct{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:4px 10px;font-size:12px;font-weight:600;text-decoration:none;color:#fff}.acct:hover{background:rgba(255,255,255,.1)}.acct i{font-style:normal;opacity:.75;font-weight:500}
.mock-note{background:#fff7e6;border:1px solid #f1d9a6;color:#6d4a00;border-radius:12px;padding:10px 14px;font-size:13px}
.credit-btn{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:12px;background:var(--navy);color:#fff;font:inherit;font-weight:700;padding:11px 16px;cursor:pointer}.credit-btn:hover{background:#1d3a6e}.credit-btn small{font-weight:600;opacity:.75}
.ask{display:flex;flex-direction:column;gap:8px}.ask textarea{width:100%;min-height:76px;border:1px solid var(--line-strong);border-radius:12px;padding:10px 12px;font:inherit;resize:vertical}.ask-row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.ask-out{margin-top:10px;border-top:1px solid var(--line);padding-top:10px;font-size:14px}.ask-out li{margin:6px 0}.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:80;background:#0f1b2d;color:#fff;border-radius:12px;padding:10px 16px;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
@media (max-width:820px){html[data-plan=free] .gate>.gate-cta{flex-wrap:wrap;top:80px}.gate-cta .btn-primary{width:100%}.acct i{display:none}}
`;

/** Account state, credit spending and the mock AI question. Shared by every page. */
export const ACCOUNT_SCRIPT = `<script>
(function () {
  var KEY = 'gnm-account', NAMES = { free: '무료', plus: '플러스', pro: '프로' }, COST = ${JSON.stringify(CREDIT_COST)};
  var read = function () { try { var a = JSON.parse(localStorage.getItem(KEY) || '{}'); return { plan: a.plan || 'free', credits: a.credits || 0, log: a.log || [], requests: a.requests || [] }; } catch (e) { return { plan: 'free', credits: 0, log: [], requests: [] }; } };
  var write = function (a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} paint(); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var toast = function (msg) { var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); };
  var paint = function () {
    var a = read();
    document.documentElement.setAttribute('data-plan', a.plan);
    document.querySelectorAll('[data-plan-name]').forEach(function (el) { el.textContent = NAMES[a.plan]; });
    document.querySelectorAll('[data-credits]').forEach(function (el) { el.textContent = a.credits.toLocaleString('ko-KR'); });
  };
  var spend = function (kind, note) {
    var a = read(), cost = COST[kind];
    if (a.credits < cost) {
      if (confirm('크레딧이 ' + cost + '개 필요해요 (지금 ' + a.credits + '개). 충전하러 갈까요?')) location.href = (document.body.getAttribute('data-base') || '') + 'pricing.html#credits';
      return false;
    }
    a.credits -= cost; a.log.unshift({ at: new Date().toISOString(), kind: kind, amount: -cost, note: note }); write(a);
    return true;
  };
  window.GNM = { read: read, write: write, spend: spend, toast: toast, paint: paint };
  paint();
  // Report request: 30 credits, recorded in this browser (MOCK).
  document.querySelectorAll('[data-spend="report"]').forEach(function (b) {
    b.addEventListener('click', function () {
      var sym = b.getAttribute('data-symbol') || (new URLSearchParams(location.search).get('c') || ''), name = b.getAttribute('data-name') || sym;
      if (!sym) return;
      var a = read();
      if (a.requests.some(function (r) { return r.symbol === sym; })) { toast('이미 요청한 종목이에요.'); return; }
      if (!confirm(name + ' 리포트를 ' + COST.report + '크레딧으로 요청할까요? (MOCK: 실제로 처리되지는 않아요)')) return;
      if (!spend('report', name + ' 리포트 요청')) return;
      a = read(); a.requests.unshift({ symbol: sym, name: name, at: new Date().toISOString() }); write(a);
      toast('요청을 접수했어요 (MOCK). 남은 크레딧 ' + a.credits + '개');
    });
  });
  // AI question: 2 credits. MOCK answer: the closest sentences from this page's evidence.
  document.querySelectorAll('form.ask').forEach(function (f) {
    var out = f.querySelector('.ask-out');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = f.querySelector('textarea').value.trim();
      if (q.length < 2) { toast('질문을 적어 주세요.'); return; }
      if (!spend('question', q.slice(0, 40))) return;
      var words = q.split(/[\\s,.?!]+/).filter(function (w) { return w.length >= 2; }).map(function (w) { return w.replace(/(은|는|이|가|을|를|의|에|도|요|까|나)$/, ''); }).filter(function (w) { return w.length >= 2; });
      var pool = [].slice.call(document.querySelectorAll('.why-grid li, .claims li, .red-team p, .story-title, .pl-detail p, .headline'));
      var hits = pool.map(function (el) { var t = el.textContent.replace(/\\s+/g, ' ').trim(); return [words.filter(function (w) { return t.indexOf(w) >= 0; }).length, t]; })
        .filter(function (p) { return p[0] > 0; }).sort(function (x, y) { return y[0] - x[0]; }).slice(0, 3);
      out.hidden = false;
      out.innerHTML = '<p class="muted small">MOCK 답변이에요. AI 연결 전이라 이 페이지의 근거에서 질문과 가까운 문장을 찾아 보여 드려요. 남은 크레딧 ' + read().credits + '개.</p>' +
        (hits.length ? '<ul>' + hits.map(function (h) { return '<li>' + esc(h[1]) + '</li>'; }).join('') + '</ul>' : '<p>관련 근거를 찾지 못했어요. 다른 낱말로 물어봐 주세요.</p>');
    });
  });
})();
</script>`;
