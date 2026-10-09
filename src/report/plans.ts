// Plans, credits and the paywall (docs/DESIGN.md §5.8, G-30). This is a MOCK:
// the site is static, so the plan and credit balance live in the visitor's
// browser (localStorage) and locked sections are only hidden on screen. Real
// enforcement needs accounts and a server (Phase 3). Payment never truly happens.
//
// Plans change depth, never the truth: every visitor sees the same signals,
// numbers and records; paying shows more of the reasoning.

export type PlanKey = 'free' | 'plus' | 'pro' | 'max';

export interface Plan {
  key: PlanKey; name: string; price: number; tagline: string; monthlyCredits: number;
  /** Extra credits on top-ups, percent. */
  topUpBonus: number;
  /** Watchlist stocks covered by the full AI committee every week (Max). */
  weeklyCoverage: number;
  /** Expert invitations included each month, no credits needed (Max). */
  includedInvites: number;
  /** Experts that can be seated permanently on a stock's weekly committee (Max). */
  standingExperts: number;
  /** What this plan adds over the one below. */
  adds: string[];
  /** Not built yet: shown as "출시 예정". */
  soon?: string[];
}

export const PLANS: readonly Plan[] = [
  { key: 'free', name: '무료', price: 0, tagline: '한 줄 요약 (크레딧 없음)', monthlyCredits: 0, topUpBonus: 0, weeklyCoverage: 0, includedInvites: 0, standingExperts: 0,
    adds: ['전 종목 검색과 1년 차트', '한 줄 요약과 지표 16개 판단', '시장 데일리 요약', '외국인·기관 수급, 실적·밸류에이션', 'AI 위원회 표 분포', '뉴스·공시', '성적표 대표 숫자 · 전략 챔피언 이름', '관심 종목 5개'] },
  { key: 'plus', name: '플러스', price: 14900, tagline: '계산 상세 + 심층 리포트 요청', monthlyCredits: 100, topUpBonus: 0, weeklyCoverage: 0, includedInvites: 0, standingExperts: 0,
    adds: ['기간별 신호 게이지(15분봉~월봉)', '기술적 적정가', '수급 흔적(매집·분산 분석)·가격 구조', '스크리너: 전 종목 조건 검색 전체', '차트 그리기 저장(10종목)', '매달 심층 리포트 5개 무료 열기', '시장 데일리 상세 열기(10크레딧)·위원회 질문', '제한된 AI 위원회: 결론 · 데스크 5곳 입장 · 레드팀 한 줄', '전략 순위표 · 전략 챔피언 레이스', '성적표 요약표(기간별 적중·분석가 순위) · 모의투자 평균 성과', '크레딧 충전과 사용: 리포트 요청·AI 질문', '관심 종목 30개'],
    soon: [] },
  { key: 'pro', name: '프로', price: 39000, tagline: 'AI 위원회 전체 + 전문가 초청', monthlyCredits: 400, topUpBonus: 10, weeklyCoverage: 0, includedInvites: 0, standingExperts: 0,
    adds: ['AI 위원회 리포트 전체(위원별 근거·예측·레드팀·시나리오)', '시장 데일리 상세 전체 열람', '전문가 AI 초청: 업종·투자 스타일 전문가를 골라 위원회에 앉혀요(크레딧)', '예측 가격 범위(5·20·60·120거래일)와 분석가 예상가', '전략 대결 전체(매매 시점·수익 곡선·몬테카를로·차트 표시)', '모의투자 종목별 장부·매매 내역', '성적표 종목별 상세·빗나간 예측 하나하나', '요약 리포트를 심층 리포트로 업그레이드', '매달 400크레딧', '충전할 때 크레딧 10% 더', '관심 종목 100개'],
    soon: ['내 매매 아이디어 검증: 레드팀이 근거로 반박', '스크리너 조건 백테스트(4년)', '공시 이벤트 스터디: 공시 뒤 N일 수익 분포', '외국인·기관 수급 랭킹', '공시·신호 변화 알림'] },
  { key: 'max', name: '맥스', price: 99000, tagline: '내 종목 전담 위원회', monthlyCredits: 1200, topUpBonus: 20, weeklyCoverage: 10, includedInvites: 30, standingExperts: 5,
    adds: ['관심 종목 10개를 매주 AI 위원회 전체로 자동 리포트', '모든 전문가 초청 매달 30회 포함(크레딧 없이)', '전문가 정기 초청: 내 종목 주간 위원회에 고정 전문가 5명', '매달 1,200크레딧', '충전할 때 크레딧 20% 더', '관심 종목 무제한'],
    soon: ['전략 랩: 내 규칙으로 백테스트·검증 구간·과최적화 경고', '내 가상 포트폴리오와 예측 실패 원인 분석', '포트폴리오 리스크: 상관·집중·변동성·시나리오', '시점 재현: 과거 그날 알았던 것만으로 다시 보기', '데이터 내보내기(CSV)·웹훅'] },
];

/**
 * Closed alpha (G-44): invited accounts get Pro features and a monthly credit allowance; more credits
 * are asked for in the app and granted by hand. Not sold, so it is not in PLANS.
 */
export const ALPHA = { key: 'alpha', name: '알파', rankAs: 'pro' as PlanKey, monthlyCredits: 400, maxRequest: 500 } as const;

/** Models behind the chat (G-45). Each answer shows the model and the credits it used. */
export const ASK_TIERS = [
  { key: 'question', label: '빠른', model: 'claude-haiku-4-5', maxTokens: 1200, hint: '짧고 빠르게' },
  { key: 'standard', label: '표준', model: 'claude-sonnet-5-5', maxTokens: 2000, hint: '근거를 꼼꼼히' },
  { key: 'deep', label: '깊은', model: 'claude-opus-5-5', maxTokens: 3000, hint: '위원회 모델로 깊게' },
] as const satisfies readonly { key: CreditAction; label: string; model: string; maxTokens: number; hint: string }[];
export type AskTier = (typeof ASK_TIERS)[number]['key'];

/**
 * Notifications by plan (G-98). Everyone hears the day's reports and their own requested reports in 🔔;
 * the phone push, watched-stock reports and more alerts come with the paid plans.
 */
export interface NotifyLimit { push: boolean; watchReport: boolean; priceAlerts: number; screenAlerts: number; intraday: boolean }
export const NOTIFY_LIMITS: Record<PlanKey, NotifyLimit> = {
  free: { push: false, watchReport: false, priceAlerts: 1, screenAlerts: 0, intraday: false },
  plus: { push: true, watchReport: true, priceAlerts: 5, screenAlerts: 3, intraday: false },
  pro: { push: true, watchReport: true, priceAlerts: 20, screenAlerts: 20, intraday: true },
  max: { push: true, watchReport: true, priceAlerts: 50, screenAlerts: 50, intraday: true },
};
/** The plan a stored plan name counts as (alpha → pro). */
export const notifyLimit = (plan: string): NotifyLimit => NOTIFY_LIMITS[(plan === 'alpha' ? ALPHA.rankAs : plan) as PlanKey] ?? NOTIFY_LIMITS.free;

/** Watchlist size per plan. */
export const WATCH_LIMIT: Record<PlanKey, number> = { free: 5, plus: 30, pro: 100, max: 1e9 };

/**
 * What a credit action costs (G-37). Credits are bought and used from Plus.
 * G-168 (v3.5.0): one report kind, the full committee, priced from its measured cost (economics.ts):
 * about 330원 a report with the retry allowance, so 30 credits keeps it under a fifth of what the cheapest credits net.
 */
/** `unlock` (G-61): opening one sealed deep report, once per user and report. */
/**
 * Opening reports (G-126, 한서님 결정 10/8): plans that unlock pay CREDIT_COST.unlock per report after a monthly
 * allowance of free opens; reports older than UNLOCK.freeAfterDays open free for everyone signed in; and when
 * someone pays to open a report another user generated, its maker gets UNLOCK.makerShare credits back, up to
 * half of what they paid for it (UNLOCK.makerCap).
 */
export const UNLOCK = { monthlyFree: { free: 0, plus: 5, alpha: 10, pro: 0, max: 0 } as Record<string, number>, freeAfterDays: 7, makerShare: 2, makerCap: 15 } as const;
export const CREDIT_COST = { report: 30, invite: 20, idea: 20, deep: 15, standard: 10, question: 5, unlock: 10 } as const;
export type CreditAction = keyof typeof CREDIT_COST;
export const CREDIT_ACTIONS: readonly { key: CreditAction; label: string; detail: string; min: Exclude<PlanKey, 'free'> }[] = [
  { key: 'unlock', label: '심층 리포트 열기', detail: '이미 나온 AI 위원회 리포트(매일 리포트, 다른 사람이 만든 리포트)의 토론·근거·시나리오 전개·최악의 경우를 열어요. 한 번 열면 계속 봐요. 플러스는 매달 5개, 알파는 10개까지 무료이고, 7일 지난 리포트는 누구나 무료예요. 다른 사람이 만든 리포트를 열면 만든 사람에게 2크레딧이 돌아가요', min: 'plus' },
  { key: 'report', label: '심층 리포트 요청', detail: '리포트가 없는 종목에 AI 위원회 전체 리포트를 한 번 써요', min: 'plus' },
  { key: 'invite', label: '전문가 AI 초청', detail: '고른 전문가가 이 종목 리포트 근거를 보고 의견·위험·지켜볼 것을 써요. 맥스는 매달 30회까지 크레딧 없이', min: 'pro' },
  { key: 'idea', label: '아이디어 검증 (출시 예정)', detail: '내 매매 아이디어를 레드팀이 근거로 반박하고 무효화 조건을 정리해요', min: 'pro' },
  { key: 'deep', label: 'AI 심층 질문', detail: '위원회 모델(Opus)이 리포트 근거 전체를 다시 보고 답해요', min: 'plus' },
  { key: 'standard', label: 'AI 표준 질문', detail: '중간 모델(Sonnet)이 근거를 꼼꼼히 보고 답해요', min: 'plus' },
  { key: 'question', label: 'AI 빠른 질문', detail: '작은 모델(Haiku)이 리포트 근거 안에서 빠르게 답해요', min: 'plus' },
];

/**
 * Trial credits (G-38): handed out now and then through promotions in promos.json (not on a schedule),
 * so free visitors can try a little. Each promotion is claimed once per browser and lapses when it ends.
 * Free visitors can spend them on these actions; paid plans spend them before paid credits.
 */
export const TRIAL = { actions: ['question'] as readonly CreditAction[] };

export interface Promo { id: string; credits: number; from: string; to: string; title: string }

/** Promotions that are valid: positive credits, ISO dates, from ≤ to. */
export function validPromos(list: unknown): Promo[] {
  if (!Array.isArray(list)) return [];
  return list.filter((p): p is Promo => !!p && typeof p.id === 'string' && Number.isInteger(p.credits) && p.credits > 0 && p.credits <= 200
    && /^\d{4}-\d{2}-\d{2}$/.test(p.from) && /^\d{4}-\d{2}-\d{2}$/.test(p.to) && p.from <= p.to && typeof p.title === 'string');
}

/** Expert AIs that can be invited to a stock's committee (Pro, credits; Max, included and standing). */
export const EXPERTS: readonly { key: string; name: string; focus: string }[] = [
  { key: 'semis', name: '반도체 전문가', focus: '업황 사이클, 메모리 가격, 설비투자, 고객사 재고' },
  { key: 'battery', name: '2차전지·소재 전문가', focus: '수주, 원재료 가격, 증설, 정책' },
  { key: 'bio', name: '바이오·헬스케어 전문가', focus: '임상 단계, 기술이전, 허가 일정, 현금 소진' },
  { key: 'auto', name: '자동차·조선 전문가', focus: '수주잔고, 환율, 원가, 선가' },
  { key: 'finance', name: '금융 전문가', focus: '금리, 순이자마진, 건전성, 배당' },
  { key: 'internet', name: '인터넷·게임 전문가', focus: '이용자 지표, 신작 일정, 광고·결제' },
  { key: 'macro', name: '매크로·금리·환율 전문가', focus: '금리 경로, 원·달러, 외국인 자금 흐름' },
  { key: 'value', name: '가치투자 전문가', focus: '재무 건전성, 이익의 질, 저평가 근거' },
  { key: 'quant', name: '퀀트·통계 전문가', focus: '팩터, 변동성, 전략 검증의 함정' },
  { key: 'forensic', name: '공시·회계 전문가', focus: '공시 해석, 회계 위험 신호, 지배구조' },
];

export interface CreditPack { key: string; credits: number; price: number }
export const CREDIT_PACKS: readonly CreditPack[] = [
  { key: 'c100', credits: 100, price: 9900 },
  { key: 'c300', credits: 300, price: 27900 },
  { key: 'c1000', credits: 1000, price: 84900 },
];

export const won = (v: number) => `${v.toLocaleString('ko-KR')}원`;

/** Runs in <head> before paint so locked sections never flash open. */
/** With the alpha API, the plan comes from the signed-in account (cached by alpha.ts). */
export const PLAN_BOOT = `<script>try{var p;if(document.querySelector('meta[name=gnm-api]')){var m=localStorage.getItem('gnm-session')&&JSON.parse(localStorage.getItem('gnm-me')||'null');p=m&&m.user&&m.user.rankAs}else p=(JSON.parse(localStorage.getItem('gnm-account')||'{}')||{}).plan;if(p==='plus'||p==='pro'||p==='max')document.documentElement.setAttribute('data-plan',p)}catch(e){}</script>`;

const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" class="lock"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

/** A section shown in full from `need` up (Plus by default). Lower plans get a faded preview and a way in. */
export function gate(html: string, opts: { base: string; what: string; need?: 'plus' | 'pro' }): string {
  const need = opts.need ?? 'plus';
  return `<div class="gate" data-need="${need}"><div class="gate-body">${html}</div><div class="gate-cta" role="note">${LOCK}<div><b>${opts.what}</b><span>${need === 'pro' ? '프로' : '플러스'}부터 볼 수 있어요</span></div><a class="btn-primary" href="${opts.base}pricing.html">요금제 보기</a></div></div>`;
}

export const PLAN_CSS = `
.gate{position:relative}.gate-cta{display:none}
html[data-plan=free] .gate,html[data-plan=plus] .gate[data-need=pro]{min-height:170px}
html[data-plan=free] .gate>.gate-body,html[data-plan=plus] .gate[data-need=pro]>.gate-body{max-height:180px;overflow:hidden;filter:blur(4px);opacity:.7;pointer-events:none;user-select:none;-webkit-mask-image:linear-gradient(#000 40%,transparent);mask-image:linear-gradient(#000 40%,transparent)}
html[data-plan=free] .gate>.gate-cta,html[data-plan=plus] .gate[data-need=pro]>.gate-cta{display:flex;align-items:center;gap:12px;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,92%);background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px;box-shadow:0 12px 32px rgba(15,27,45,.14);z-index:2}
html[data-plan=free] .need-plus{display:none}html:not([data-plan=free]) .only-free{display:none}
.gate-cta .lock{width:22px;height:22px;color:var(--navy)}.gate-cta div{display:flex;flex-direction:column;flex:1;min-width:0}.gate-cta b{font-size:15px}.gate-cta span{font-size:13px;color:var(--muted)}.gate-cta .btn-primary{margin:0;padding:10px 14px;font-size:14px;white-space:nowrap}
.acct{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:4px 10px;font-size:12px;font-weight:600;text-decoration:none;color:#fff}.acct:hover{background:rgba(255,255,255,.1)}.acct i{font-style:normal;opacity:.75;font-weight:500}
.promo-bar{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;background:#fff3d6;color:#5b3d00;font-size:13px;padding:8px 14px;border-bottom:1px solid #f1d9a6}.promo-bar button{border:0;border-radius:999px;background:var(--accent);color:#fff;font:inherit;font-weight:700;padding:4px 12px;cursor:pointer}.promo-bar .promo-x{background:none;color:#5b3d00;font-size:16px;padding:0 4px}
.mock-note{background:#fff7e6;border:1px solid #f1d9a6;color:#6d4a00;border-radius:12px;padding:10px 14px;font-size:13px}
.credit-btn{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:12px;background:var(--navy);color:#fff;font:inherit;font-weight:700;padding:11px 16px;cursor:pointer}.credit-btn:hover{background:var(--accent-strong)}.credit-btn small{font-weight:600;opacity:.75}
.ask{display:flex;flex-direction:column;gap:8px}.ask textarea{width:100%;min-height:76px;border:1px solid var(--line-strong);border-radius:12px;padding:10px 12px;font:inherit;resize:vertical}.ask-row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.ask-btns{display:flex;gap:8px;flex-wrap:wrap}.credit-btn.ghost{background:#fff;color:var(--navy);border:1px solid var(--navy)}.credit-btn.ghost:hover{background:var(--accent-soft)}
.ask-out{margin-top:10px;border-top:1px solid var(--line);padding-top:10px;font-size:14px}.ask-out li{margin:6px 0}.toast{position:fixed;left:50%;bottom:calc(80px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:200;display:flex;align-items:center;gap:10px;width:max-content;max-width:calc(100vw - 32px);box-sizing:border-box;background:#0f1b2d;color:#fff;border-radius:14px;padding:10px 12px;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);animation:toast-in .2s ease-out}.toast span{overflow-wrap:anywhere}.toast svg{width:24px;height:24px;flex:none;color:#86efac}.toast-check{stroke-dasharray:24;animation:toast-check .3s ease-out}.toast button{border:0;background:none;color:inherit;min-width:36px;min-height:36px;cursor:pointer;font-size:20px}.toast[data-kind=error]{background:#842029}@keyframes toast-in{from{opacity:0;translate:0 8px}}@keyframes toast-check{from{stroke-dashoffset:24}}@media(prefers-reduced-motion:reduce){.toast,.toast-check{animation:none}}
@media (max-width:820px){html[data-plan=free] .gate>.gate-cta,html[data-plan=plus] .gate[data-need=pro]>.gate-cta{flex-wrap:wrap;top:80px}.gate-cta .btn-primary{width:100%}.acct i{display:none}}
`;

/** Account state, credit spending and the mock AI question. Shared by every page. */
export const ACCOUNT_SCRIPT = `<script>
(function () {
  var KEY = 'gnm-account', NAMES = { free: '무료', plus: '플러스', pro: '프로', max: '맥스' }, COST = ${JSON.stringify(CREDIT_COST)}, MIN = ${JSON.stringify(Object.fromEntries(CREDIT_ACTIONS.map((x) => [x.key, x.min])))}, RANK = { free: 0, plus: 1, pro: 2, max: 3 }, TRIAL = ${JSON.stringify(TRIAL)};
  var today = function () { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); };
  var read = function () {
    var a; try { a = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { a = {}; }
    var grants = (a.grants || []).filter(function (g) { return g.left > 0 && g.to >= today(); });
    return { plan: a.plan || 'free', credits: a.credits || 0, grants: grants, claimed: a.claimed || [], trial: grants.reduce(function (s, g) { return s + g.left; }, 0), log: a.log || [], requests: a.requests || [] };
  };
  var write = function (a) { var o = { plan: a.plan, credits: a.credits, grants: a.grants, claimed: a.claimed, log: a.log.slice(0, 200), requests: a.requests }; try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} paint(); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var toast = function (msg, kind) {
    document.querySelectorAll('.toast').forEach(function(t){t.remove();});
    var t=document.createElement('div');t.className='toast';t.dataset.kind=kind||'info';t.setAttribute('role',kind==='error'?'alert':'status');
    if(kind==='success')t.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor"/><path class="toast-check" d="m6 12 4 4 8-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var label=document.createElement('span');label.textContent=msg;t.appendChild(label);
    var close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','알림 닫기');close.onclick=function(){t.remove();};t.appendChild(close);
    document.body.appendChild(t);setTimeout(function(){t.remove();},kind==='error'?5000:3200);
  };
  // With the alpha API, accounts and credits live on the server (alpha.ts takes over from here).
  // G-66: the debate's one box. "위원회 전체" opens the chat with the question (and stops the invite
  // handlers, which run on the form itself); an expert goes on as an invitation carrying the question.
  document.addEventListener('submit', function (e) {
    var f = e.target; if (!f.matches || !f.matches('form.join') || document.querySelector('meta[name=gnm-api]')) return;
    var pick = f.querySelector('input[name=expert]:checked');
    if (pick && pick.value !== 'committee') return;
    e.preventDefault(); e.stopPropagation();
    var fab = document.querySelector('.chat-fab'), q = f.querySelector('textarea').value.trim();
    if (fab) { fab.setAttribute('data-ask', q); fab.click(); fab.removeAttribute('data-ask'); }
  }, true);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('form.join [data-fill]'); if (!b) return;
    var t = b.closest('form').querySelector('textarea'); t.value = b.getAttribute('data-fill'); t.focus();
  });
  if (document.querySelector('meta[name=gnm-api]')) { window.GNM = { toast: toast }; return; }
  var paint = function () {
    var a = read();
    document.documentElement.setAttribute('data-plan', a.plan);
    document.querySelectorAll('[data-plan-name]').forEach(function (el) { el.textContent = NAMES[a.plan]; });
    document.querySelectorAll('[data-credits]').forEach(function (el) { el.textContent = (a.credits + a.trial).toLocaleString('ko-KR'); });
    document.querySelectorAll('[data-trial]').forEach(function (el) { el.textContent = a.trial ? '(체험 ' + a.trial + ' 포함)' : ''; });
  };
  var spend = function (kind, note) {
    var a = read(), cost = COST[kind], min = MIN[kind] || 'plus';
    var trialOk = TRIAL.actions.indexOf(kind) >= 0;
    // Free visitors can use trial credits on trial actions only; paid plans need the action's plan.
    if (RANK[a.plan] < RANK[min] && !(trialOk && a.trial >= cost)) {
      var msg = trialOk ? '체험 크레딧이 모자라요 (남은 ' + a.trial + '개). ' + NAMES[min] + ' 요금제부터 충전해서 쓸 수 있어요. 요금제를 볼까요?' : '이 기능은 ' + NAMES[min] + ' 요금제부터 크레딧으로 쓸 수 있어요. 요금제를 볼까요?';
      if (confirm(msg)) location.href = (document.body.getAttribute('data-base') || '') + 'pricing.html';
      return false;
    }
    var fromTrial = trialOk ? Math.min(a.trial, cost) : 0, fromPaid = cost - fromTrial;
    if (a.credits < fromPaid) {
      if (confirm('크레딧이 ' + cost + '개 필요해요 (지금 ' + (a.credits + (trialOk ? a.trial : 0)) + '개). 충전하러 갈까요?')) location.href = (document.body.getAttribute('data-base') || '') + 'pricing.html#credits';
      return false;
    }
    // Trial credits that end soonest go first.
    var need = fromTrial;
    a.grants.sort(function (x, y) { return x.to < y.to ? -1 : 1; }).forEach(function (g) { var take = Math.min(g.left, need); g.left -= take; need -= take; });
    a.credits -= fromPaid;
    a.log.unshift({ at: new Date().toISOString(), kind: kind, amount: -cost, note: note + (fromTrial ? ' · 체험 ' + fromTrial : '') }); write(a);
    return true;
  };
  window.GNM = { read: read, write: write, spend: spend, toast: toast, paint: paint };
  paint();
  // Promotions: a banner to claim trial credits while one runs (once per browser).
  fetch((document.body.getAttribute('data-base') || '') + 'promos.json').then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
    var a = read(), d = today();
    var open = (list || []).filter(function (p) { return p.from <= d && d <= p.to && a.claimed.indexOf(p.id) < 0; })[0];
    if (!open) return;
    var bar = document.createElement('div'); bar.className = 'promo-bar'; bar.setAttribute('role', 'status');
    bar.innerHTML = '<span><b>' + esc(open.title) + '</b> 체험 크레딧 ' + open.credits + '개 · ' + esc(open.to) + '까지</span><button type="button">받기</button><button type="button" class="promo-x" aria-label="닫기">×</button>';
    document.body.insertBefore(bar, document.body.firstChild);
    bar.querySelector('button').addEventListener('click', function () {
      var b = read(); if (b.claimed.indexOf(open.id) >= 0) { bar.remove(); return; }
      b.claimed.push(open.id); b.grants.push({ id: open.id, left: open.credits, to: open.to });
      b.log.unshift({ at: new Date().toISOString(), kind: 'trial', amount: open.credits, note: open.title + ' (' + open.to + '까지)' });
      write(b); bar.remove(); toast('체험 크레딧 ' + open.credits + '개를 받았어요. AI 빠른 질문에 쓸 수 있어요.');
    });
    bar.querySelector('.promo-x').addEventListener('click', function () { bar.remove(); });
  }).catch(function () {});
  // Report requests: recorded in this browser (MOCK).
  var WORD = { report: '심층 리포트 요청' };
  document.querySelectorAll('[data-spend]').forEach(function (b) {
    var kind = b.getAttribute('data-spend');
    if (!WORD[kind]) return;
    b.addEventListener('click', function () {
      var sym = b.getAttribute('data-symbol') || (new URLSearchParams(location.search).get('c') || ''), name = b.getAttribute('data-name') || sym;
      if (!sym) return;
      var a = read();
      if (a.requests.some(function (r) { return r.symbol === sym && r.kind === kind; })) { toast('이미 요청했어요.'); return; }
      if ((RANK[a.plan] >= RANK[MIN[kind]] || (TRIAL.actions.indexOf(kind) >= 0 && a.trial >= COST[kind])) && !confirm(name + ' ' + WORD[kind] + ': ' + COST[kind] + '크레딧을 쓸까요? (MOCK: 실제로 처리되지는 않아요)')) return;
      if (!spend(kind, name + ' ' + WORD[kind])) return;
      a = read(); a.requests.unshift({ symbol: sym, name: name, kind: kind, at: new Date().toISOString() }); write(a);
      toast('접수했어요 (MOCK). 남은 크레딧 ' + (a.credits + a.trial) + '개');
    });
  });
  // Expert invitations: Max uses its monthly allowance first (and may seat a standing expert); Pro pays credits.
  document.querySelectorAll('form.invite').forEach(function (f) {
    var out = f.querySelector('.ask-out');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var a = read(), pick = f.querySelector('input[name=expert]:checked'), st = f.querySelector('input[name=standing]'), standing = !!(st && st.checked);
      var who = pick ? pick.closest('label').querySelector('b').textContent : '전문가', name = f.getAttribute('data-name'), qa = f.querySelector('textarea'), q = qa ? qa.value.trim() : '';
      var m = new Date().toISOString().slice(0, 7), raw = {}; try { raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (x) {}
      var used = raw.inviteMonth === m ? raw.invitesUsed || 0 : 0;
      if (standing && a.plan !== 'max') { toast('정기 초청은 맥스 요금제부터예요.'); return; }
      if (a.plan === 'max' && used < ${PLANS.find((p) => p.key === 'max')!.includedInvites}) {
        raw.inviteMonth = m; raw.invitesUsed = used + 1;
        raw.log = [{ at: new Date().toISOString(), kind: 'invite', amount: 0, note: name + ' · ' + who + (standing ? ' (정기)' : '') + (q ? ' · ' + q : '') + ' · 포함 ' + (used + 1) + '/30' }].concat(raw.log || []);
        try { localStorage.setItem(KEY, JSON.stringify(raw)); } catch (x) {}
        paint();
      } else if (!spend('invite', name + ' · ' + who + (q ? ' · ' + q : ''))) return;
      out.hidden = false;
      out.innerHTML = '<p><b>' + esc(who) + '</b>를 ' + esc(name) + ' 위원회에 초청했어요' + (standing ? ' (매주 고정)' : '') + (q ? '. 질문: ' + esc(q) : '') + '. MOCK이라 답과 의견은 서버가 붙으면 다음 리포트에 실려요.</p>';
    });
  });
  // AI questions (quick / deep). MOCK answer: the closest sentences from this page's evidence.
  document.querySelectorAll('form.ask').forEach(function (f) {
    var out = f.querySelector('.ask-out');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = f.querySelector('textarea').value.trim();
      if (q.length < 2) { toast('질문을 적어 주세요.'); return; }
      var kind = (e.submitter && e.submitter.value) || 'question';
      if (!spend(kind, (kind === 'deep' ? '[심층] ' : '') + q.slice(0, 40))) return;
      var words = q.split(/[\\s,.?!]+/).filter(function (w) { return w.length >= 2; }).map(function (w) { return w.replace(/(은|는|이|가|을|를|의|에|도|요|까|나)$/, ''); }).filter(function (w) { return w.length >= 2; });
      var pool = [].slice.call(document.querySelectorAll('.why-grid li, .claims li, .red-team p, .story-title, .pl-detail p, .headline'));
      var hits = pool.map(function (el) { var t = el.textContent.replace(/\\s+/g, ' ').trim(); return [words.filter(function (w) { return t.indexOf(w) >= 0; }).length, t]; })
        .filter(function (p) { return p[0] > 0; }).sort(function (x, y) { return y[0] - x[0]; }).slice(0, kind === 'deep' ? 6 : 3);
      out.hidden = false;
      out.innerHTML = '<p class="muted small">' + (kind === 'deep' ? '심층 질문 · ' : '') + 'MOCK 답변이에요. AI 연결 전이라 이 페이지의 근거에서 질문과 가까운 문장을 찾아 보여 드려요. 남은 크레딧 ' + (read().credits + read().trial) + '개.</p>' +
        (hits.length ? '<ul>' + hits.map(function (h) { return '<li>' + esc(h[1]) + '</li>'; }).join('') + '</ul>' : '<p>관련 근거를 찾지 못했어요. 다른 낱말로 물어봐 주세요.</p>');
    });
  });
})();
</script>`;
