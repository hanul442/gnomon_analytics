// Alpha pages (docs/DESIGN.md §5.13, G-44): sign-in, the onboarding survey, the account and the
// admin console. They talk to the alpha API through window.GNM (alpha.ts).

import { shell } from './renderHtml.js';
import { ALPHA } from './plans.js';

const PAGE_CSS = `<style>
.form-card{max-width:520px;margin:24px auto}.form-card h1{font-size:26px;margin:0 0 6px}.fld{display:flex;flex-direction:column;gap:6px;margin-top:14px}.fld label{font-weight:700;font-size:14px}
.fld input,.fld select,.fld textarea{border:1px solid var(--line-strong);border-radius:12px;padding:11px 12px;font:inherit;font-size:15px}.fld small{color:var(--muted)}
.chk{display:flex;gap:8px;align-items:flex-start;font-size:13px;margin-top:14px}.form-card .btn-primary{width:100%;justify-content:center;margin-top:16px}
.msg-ok{background:#e7f5ec;color:#1d6b3a;border-radius:12px;padding:12px 14px;margin-top:14px}.msg-err{background:#fde8e8;color:#9b1c1c;border-radius:12px;padding:12px 14px;margin-top:14px}
.q{margin-top:22px}.q h3{font-size:16px;margin:0 0 4px}.q .muted{font-size:13px}.opts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.opts label{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line-strong);border-radius:999px;padding:8px 13px;font-size:14px;cursor:pointer;background:#fff}
.opts input{position:absolute;opacity:0;pointer-events:none}.opts label:has(input:checked){border-color:var(--navy);background:var(--navy);color:#fff}.opts label:focus-within{outline:2px solid var(--accent);outline-offset:2px}
.picked{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.picked button{border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:5px 10px;font:inherit;font-size:13px;cursor:pointer}
.sugg{border:1px solid var(--line);border-radius:12px;margin-top:4px;max-height:220px;overflow:auto;background:#fff}.sugg button{display:flex;justify-content:space-between;width:100%;border:0;background:none;padding:9px 12px;font:inherit;cursor:pointer;text-align:left}.sugg button:hover{background:var(--accent-soft)}
.stepbar{height:6px;background:#e2e8f1;border-radius:999px;overflow:hidden;margin:10px 0 4px}.stepbar i{display:block;height:100%;background:var(--navy);width:0;transition:width .2s}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.kpi{border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:#fff}.kpi b{display:block;font-size:22px}.kpi span{font-size:12px;color:var(--muted)}
.adm-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:16px 0}.adm-tabs button{border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:7px 13px;font:inherit;font-size:14px;cursor:pointer}.adm-tabs button[aria-pressed=true]{background:var(--navy);color:#fff;border-color:var(--navy)}
.adm table{width:100%;border-collapse:collapse;font-size:13px}.adm th,.adm td{border-bottom:1px solid var(--line);padding:8px 6px;text-align:left;vertical-align:top}.adm th{color:var(--muted);font-weight:600;white-space:nowrap}.adm td.num{text-align:right}
.adm .act{display:flex;gap:4px;flex-wrap:wrap}.adm .act input{width:72px;border:1px solid var(--line-strong);border-radius:8px;padding:4px 6px;font:inherit}.adm .act button,.adm form button{border:1px solid var(--line-strong);background:#fff;border-radius:8px;padding:4px 9px;font:inherit;font-size:13px;cursor:pointer}.adm .act button.ok{background:var(--navy);color:#fff;border-color:var(--navy)}
.adm form.inline{display:flex;gap:6px;flex-wrap:wrap;align-items:flex-end}.adm form.inline input,.adm form.inline select{border:1px solid var(--line-strong);border-radius:8px;padding:6px 8px;font:inherit;font-size:13px}
.adm pre{white-space:pre-wrap;font-size:12px;margin:0;max-width:420px}.pill{display:inline-block;border-radius:999px;padding:0 8px;font-size:12px;font-weight:700;background:#eef1f5}.pill.pending{background:#fff3d6;color:#7a4a00}.pill.approved,.pill.done,.pill.OK{background:#e7f5ec;color:#1d6b3a}.pill.rejected,.pill.FAILED{background:#fde8e8;color:#9b1c1c}
.bars{display:flex;flex-direction:column;gap:4px}.bars div{display:grid;grid-template-columns:140px 1fr 40px;gap:8px;align-items:center;font-size:13px}.bars i{display:block;height:10px;background:var(--navy);border-radius:4px}
.adm{min-width:0}.adm-table-wrap{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
@media(max-width:820px){.adm .adm-responsive,.adm .adm-responsive tbody{display:block;width:100%}.adm .adm-responsive thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}.adm .adm-responsive tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 14px;padding:14px 0;border-bottom:1px solid var(--line)}.adm .adm-responsive tr:last-child{border-bottom:0}.adm .adm-responsive td{display:block;min-width:0;border:0;padding:3px 0;font-size:14px;white-space:normal;overflow-wrap:anywhere;text-align:left}.adm .adm-responsive td::before{content:attr(data-label);display:block;font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px}.adm .adm-responsive td[data-label="사용자"],.adm .adm-responsive td[data-label="이메일"],.adm .adm-responsive td[data-label="내용"],.adm .adm-responsive td[data-label="사유"],.adm .adm-responsive td[data-label="처리"],.adm .adm-responsive td[data-label="조정"],.adm .adm-responsive td[data-label="질문"],.adm .adm-responsive td[data-label="아쉬운 점·헷갈린 점·오류"],.adm .adm-responsive td[data-label="좋은 점·바라는 기능"],.adm .adm-responsive td[colspan]{grid-column:1/-1}.adm .act{flex-wrap:wrap;min-width:0}.adm .act input{max-width:100%;min-width:0}.adm .act button{min-height:44px}.adm table a{overflow-wrap:anywhere}}
</style>`;

const NO_API = `<div class="msg-err" data-no-api hidden>알파 서버가 아직 연결되지 않았어요. 연결되면 이 페이지에서 로그인할 수 있어요.</div><script>if(!document.querySelector('meta[name=gnm-api]'))document.querySelectorAll('[data-no-api]').forEach(function(e){e.hidden=false})</script>`;

export function renderLogin(): string {
  const body = `${PAGE_CSS}<style>.seg2{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#eef1f5;border-radius:12px;padding:4px;margin:12px 0 4px}.seg2 button{border:0;background:none;border-radius:9px;padding:9px;font:inherit;font-weight:700;color:var(--muted);cursor:pointer}.seg2 button[aria-selected=true]{background:#fff;color:var(--fg);box-shadow:0 1px 3px rgba(0,0,0,.08)}.form-card input{font-size:16px}.alt{margin-top:14px;font-size:13px}</style>
<section class="card form-card"><div class="eyebrow"><span>클로즈드 알파</span></div><h1>그노몬 로그인</h1>${NO_API}
<div id="verifying" class="msg-ok" hidden>로그인하고 있어요…</div>
<div class="seg2" role="tablist"><button type="button" role="tab" data-mode="login" aria-selected="true">로그인</button><button type="button" role="tab" data-mode="signup" aria-selected="false">처음이에요 (초대 코드)</button></div>
<form id="login" autocomplete="on"><div class="fld"><label for="email">이메일</label><input id="email" type="email" autocomplete="email" required placeholder="you@example.com"></div>
<div class="fld"><label for="pw">비밀번호</label><input id="pw" type="password" autocomplete="current-password" required minlength="8" maxlength="72"><small class="muted" data-only="signup" hidden>8자 이상, 영문과 숫자를 함께 넣어 주세요.</small></div>
<div class="fld" data-only="signup" hidden><label for="pw2">비밀번호 확인</label><input id="pw2" type="password" autocomplete="new-password" maxlength="72"></div>
<div class="fld" data-only="signup" hidden><label for="invite">초대 코드</label><input id="invite" autocomplete="off" placeholder="GNM-XXXXXX" style="text-transform:uppercase"></div>
<label class="chk" data-only="signup" hidden><input type="checkbox" id="terms"> <span><a href="terms.html" target="_blank">이용 약관과 면책</a>을 읽었고, 그노몬의 정보가 투자 권유가 아니며 투자 판단과 결과의 책임이 나에게 있다는 데 동의해요.</span></label>
<button class="btn-primary" type="submit" id="go">로그인</button><div id="out" aria-live="polite"></div></form>
<p class="alt muted">비밀번호를 아직 안 정했거나 잊었다면 운영자에게 로그인 링크를 받아 들어온 뒤, <b>내 계정</b>에서 비밀번호를 정할 수 있어요.</p></section>`;
  const script = `<script>
(function () {
  var out = document.getElementById('out'), form = document.getElementById('login'), qs = new URLSearchParams(location.search), mode = 'login';
  var show = function (cls, text) { out.innerHTML = '<div class="' + cls + '"></div>'; out.firstChild.textContent = text; };
  var setMode = function (m) {
    mode = m; out.innerHTML = '';
    document.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-mode') === m)); });
    document.querySelectorAll('[data-only=signup]').forEach(function (el) { el.hidden = m !== 'signup'; });
    document.getElementById('pw').setAttribute('autocomplete', m === 'signup' ? 'new-password' : 'current-password');
    document.getElementById('go').textContent = m === 'signup' ? '가입하고 시작하기' : '로그인';
  };
  document.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); }); });
  if (qs.get('invite')) { document.getElementById('invite').value = qs.get('invite'); setMode('signup'); }
  if (qs.get('return')) try { sessionStorage.setItem('gnm-return', qs.get('return')); } catch (e) {}
  if (!window.GNM || !GNM.api) { form.querySelector('button[type=submit]').disabled = true; return; }
  var done = function (r) {
    var me = Object.assign({}, r); delete me.session; delete me._status;
    GNM.signIn(r.session, me);
    var back = ''; try { back = sessionStorage.getItem('gnm-return') || ''; sessionStorage.removeItem('gnm-return'); } catch (e) {}
    location.replace(!me.survey.onboarding ? 'onboarding.html' : /^[\\w\\/.-]+(\\?[\\w=&%-]*)?$/.test(back) ? back : 'index.html');
  };
  // A one-time login link (sent by the operator) still works.
  var token = (/[#&]t=([\\w-]+)/.exec(location.hash) || [])[1];
  if (token) {
    history.replaceState(null, '', location.pathname);
    form.hidden = true; document.getElementById('verifying').hidden = false;
    GNM.call('POST', '/auth/verify', { token: token }).then(function (r) {
      document.getElementById('verifying').hidden = true;
      if (r.error) { form.hidden = false; show('msg-err', r.message); return; }
      done(r);
    });
    return;
  }
  (GNM.ready || Promise.resolve()).then(function (me) { if (me) show('msg-ok', me.user.email + '로 로그인돼 있어요. 다른 이메일로 바꾸려면 계정 페이지에서 로그아웃해 주세요.'); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('email').value, pw = document.getElementById('pw').value;
    if (mode === 'signup' && pw !== document.getElementById('pw2').value) { show('msg-err', '비밀번호 확인이 맞지 않아요.'); return; }
    var btn = document.getElementById('go'); btn.disabled = true;
    var req = mode === 'signup'
      ? GNM.call('POST', '/auth/signup', { email: email, password: pw, invite: document.getElementById('invite').value.trim(), terms: document.getElementById('terms').checked })
      : GNM.call('POST', '/auth/login', { email: email, password: pw });
    req.then(function (r) { btn.disabled = false; if (r.error) { show('msg-err', r.message); return; } done(r); });
  });
})();
</script>`;
  return shell('', '로그인 · 그노몬', body, { scripts: script, chat: false, noFeedback: true, bottomNav: false });
}

const SECTORS = ['반도체', '2차전지·소재', '바이오·헬스케어', '자동차·조선', '방산·기계', '금융', '인터넷·게임', '화학·에너지', '소비재·유통', '건설·부동산', '통신·미디어', '지주·기타'];

/** Onboarding survey: who is using this, and what their front page should lead with (G-46). */
export const ONBOARDING_QUESTIONS = [
  { key: 'experience', section: '1. 나의 투자', title: '주식 투자는 얼마나 하셨어요?', type: 'one', options: ['처음이거나 1년 미만', '1~3년', '3~10년', '10년 이상', '업으로 해요'] },
  { key: 'horizon', title: '보통 얼마나 들고 가세요?', type: 'one', options: ['며칠 안(단기 매매)', '몇 주', '몇 달', '1년 이상'] },
  { key: 'style', title: '내 투자 스타일에 가까운 것은?', note: '여러 개 골라도 돼요', type: 'many', options: ['저평가 가치주', '성장주', '추세·모멘텀', '배당', '지수·ETF 위주', '테마·이슈', '단타·스캘핑', '아직 정하지 않았어요'] },
  { key: 'assets', title: '투자하는 자산은?', note: '여러 개 골라도 돼요', type: 'many', options: ['국내 주식', '해외 주식', '국내 ETF', '해외 ETF', '코인', '채권·예금성', '아직 투자 전'] },
  { key: 'size', title: '투자 금액은 어느 정도예요?', note: '답하고 싶지 않으면 마지막을 골라 주세요', type: 'one', options: ['500만 원 미만', '500만~3천만 원', '3천만~1억 원', '1억 원 이상', '답하지 않을게요'] },
  { key: 'freq', title: '얼마나 자주 사고파세요?', type: 'one', options: ['거의 매일', '일주일에 몇 번', '한 달에 몇 번', '몇 달에 한 번', '거의 안 팔고 모아요'] },
  { key: 'when', title: '시장을 주로 보는 때는?', note: '여러 개 골라도 돼요', type: 'many', options: ['장 시작 전', '장중 틈틈이', '점심시간', '장 마감 뒤 저녁', '주말에 몰아서'] },
  { key: 'decide', section: '2. 판단하는 방식', title: '매매 결정은 주로 어떻게 하세요?', type: 'one', options: ['직접 분석해요', '리포트·뉴스를 참고해요', '유튜브·커뮤니티를 참고해요', '지인·전문가 추천을 따라요', '아직 잘 모르겠어요'] },
  { key: 'risk', title: '한 종목이 얼마나 빠지면 견디기 어려우세요?', type: 'one', options: ['-5%면 불안해요', '-10% 정도', '-20% 정도', '-30% 넘어도 기다려요', '생각해 본 적 없어요'] },
  { key: 'stop', title: '손절이나 익절 규칙이 있나요?', type: 'one', options: ['정해 두고 지켜요', '정해 두지만 잘 못 지켜요', '그때그때 판단해요', '없어요'] },
  { key: 'hard', title: '투자에서 가장 어려운 것은?', note: '최대 3개', type: 'many', options: ['살 종목 고르기', '사는 타이밍', '파는 타이밍', '뉴스·공시 해석', '재무제표 읽기', '차트 읽기', '감정 조절', '정보가 너무 많아요'] },
  { key: 'sources', title: '정보는 주로 어디서 얻으세요?', note: '여러 개 골라도 돼요', type: 'many', options: ['증권사 앱', '네이버 증권·종목토론', '증권사 리포트', '유튜브', '텔레그램·카카오 리딩방', '경제 뉴스', '지인', 'AI 챗봇'] },
  { key: 'trustAi', title: 'AI가 쓴 투자 해설을 얼마나 믿을 것 같아요?', type: 'one', options: ['거의 안 믿어요', '참고만 해요', '근거가 있으면 믿어요', '꽤 믿어요'] },
  { key: 'sectors', section: '3. 관심사', title: '관심 있는 업종을 골라 주세요', note: '여러 개 골라도 돼요', type: 'many', options: SECTORS },
  { key: 'tickers', title: '갖고 있거나 지켜보는 종목이 있나요?', note: '최대 10개 · 관심 종목에 바로 담아 드려요', type: 'tickers', options: [] },
  { key: 'interests', title: '그노몬에서 주로 보고 싶은 것은?', note: '여러 개 골라도 돼요', type: 'many', options: ['AI 해설·위원회', '기술적 신호·차트', '외국인·기관 수급', '실적·밸류에이션', '공시·뉴스', '전략·백테스트', '모의투자·성적표', '조건 검색(스크리너)'] },
  { key: 'alerts', title: '받고 싶은 알림은?', note: '여러 개 골라도 돼요', type: 'many', options: ['관심 종목 급등락', '관심 종목 공시', '강세·약세 전환 가격 돌파·이탈', '조건 검색에 새로 걸린 종목', '매일 아침 요약', '알림은 싫어요'] },
  { key: 'explain', section: '4. 그노몬에 바라는 것', title: '설명은 어느 수준이 좋아요?', type: 'one', options: ['아주 쉬운 말로', '보통', '전문 용어 그대로'] },
  { key: 'length', title: '종목 리포트는 어느 정도 길이가 좋아요?', type: 'one', options: ['결론 한 줄', '결론과 이유 세 줄', '근거까지 자세히', '데이터 전부'] },
  { key: 'tools', title: '지금 쓰는 도구는?', note: '여러 개 골라도 돼요', type: 'many', options: ['증권사 앱(MTS·HTS)', '네이버·다음 증권', '증권사 리포트', '유료 리딩방·구독', 'TradingView 같은 해외 도구', '엑셀·직접 만든 도구', '없어요'] },
  { key: 'pay', title: '이런 서비스에 한 달에 얼마까지 낼 수 있어요?', type: 'one', options: ['무료만 써요', '1만 원 안쪽', '1~3만 원', '3~5만 원', '5~10만 원', '10만 원 넘게도'] },
  { key: 'worry', title: '이런 서비스를 쓸 때 걱정되는 점은?', type: 'text', options: [] },
  { key: 'wish', title: '그노몬에 가장 바라는 것 하나', type: 'text', options: [] },
  { key: 'interview', title: '20분 화상 인터뷰에 참여해 주실 수 있나요?', note: '참여하면 크레딧 200개를 드려요', type: 'one', options: ['네, 좋아요', '아니요'] },
] as const;

export function renderOnboarding(): string {
  const q = ONBOARDING_QUESTIONS.map((x, i) => {
    const head = `${'section' in x ? `<h2 class="sv-sec">${x.section}</h2>` : ''}<h3>${i + 1}. ${x.title}</h3>${'note' in x ? `<div class="muted">${x.note}</div>` : ''}`;
    if (x.type === 'text') return `<div class="q" data-q="${x.key}">${head}<div class="fld"><textarea name="${x.key}" maxlength="500" rows="3" placeholder="예: 내 종목에 공시가 나오면 무슨 뜻인지 바로 알려 주면 좋겠어요"></textarea></div></div>`;
    if (x.type === 'tickers') return `<div class="q" data-q="${x.key}">${head}<div class="fld"><input id="tk-in" placeholder="종목 이름이나 코드" autocomplete="off"></div><div class="sugg" id="tk-sugg" hidden></div><div class="picked" id="tk-picked"></div></div>`;
    return `<div class="q" data-q="${x.key}">${head}<div class="opts">${x.options.map((o) => `<label><input type="${x.type === 'one' ? 'radio' : 'checkbox'}" name="${x.key}" value="${o}">${o}</label>`).join('')}</div></div>`;
  }).join('');
  const body = `${PAGE_CSS}<section class="card form-card" style="max-width:720px"><div class="eyebrow"><span>맞춤 설문</span><span>약 7분 · ${ONBOARDING_QUESTIONS.length}문항</span></div><h1>나에게 맞는 그노몬 만들기</h1>
<p class="muted">네 부분(나의 투자 · 판단하는 방식 · 관심사 · 바라는 것)으로 나눠 물어요. 답에 따라 보기 방식, 홈의 '오늘 볼 것', 관심 종목, 설명 수준이 정해져요. 모르는 건 건너뛰어도 되고, 언제든 ☰ 메뉴에서 다시 할 수 있어요. 답은 서비스 개선에만 써요.</p>${NO_API}
<div class="stepbar" aria-hidden="true" style="position:sticky;top:64px;z-index:3"><i id="prog"></i></div><style>.sv-sec{font-size:18px;margin:26px 0 4px;padding-top:14px;border-top:2px solid var(--navy);color:var(--accent-strong)}</style><form id="survey">${q}<button class="btn-primary" type="submit">완료하고 내 홈 보기</button><div id="out" aria-live="polite"></div></form></section>`;
  const script = `<script>
(function () {
  var form = document.getElementById('survey'), picked = [], QS = ${JSON.stringify(ONBOARDING_QUESTIONS.map((x) => ({ key: x.key, type: x.type })))};
  var prog = function () { var n = QS.filter(function (x) { return x.type === 'tickers' ? picked.length : x.type === 'text' ? form[x.key].value.trim() : form.querySelector('[name="' + x.key + '"]:checked'); }).length; document.getElementById('prog').style.width = (n / QS.length * 100) + '%'; };
  form.addEventListener('change', prog); form.addEventListener('input', prog);
  var items = []; fetch('search.json').then(function (r) { return r.json(); }).then(function (d) { items = d.items || []; }).catch(function () {});
  var inp = document.getElementById('tk-in'), sugg = document.getElementById('tk-sugg'), box = document.getElementById('tk-picked');
  var draw = function () { box.innerHTML = ''; picked.forEach(function (p, i) { var b = document.createElement('button'); b.type = 'button'; b.textContent = p[1] + ' ×'; b.addEventListener('click', function () { picked.splice(i, 1); draw(); prog(); }); box.appendChild(b); }); };
  inp.addEventListener('input', function () {
    var v = inp.value.trim(); sugg.innerHTML = '';
    if (!v) { sugg.hidden = true; return; }
    var hits = items.filter(function (x) { return x[1].indexOf(v) >= 0 || x[0].indexOf(v) === 0; }).slice(0, 8);
    hits.forEach(function (x) { var b = document.createElement('button'); b.type = 'button'; b.innerHTML = '<span></span><small class="muted"></small>'; b.firstChild.textContent = x[1]; b.lastChild.textContent = x[0] + ' · ' + x[2];
      b.addEventListener('click', function () { if (picked.length < 10 && !picked.some(function (p) { return p[0] === x[0]; })) picked.push([x[0], x[1]]); inp.value = ''; sugg.hidden = true; draw(); prog(); }); sugg.appendChild(b); });
    sugg.hidden = !hits.length;
  });
  (window.GNM && GNM.ready ? GNM.ready : Promise.resolve(null)).then(function (me) {
    if (!window.GNM || !GNM.api) return;
    if (!me) { location.replace('login.html?return=onboarding.html'); return; }
    var prev = me.survey.onboarding; if (!prev) return;
    QS.forEach(function (x) {
      var v = prev[x.key]; if (v === undefined) return;
      if (x.type === 'tickers') { picked = v.slice(0, 10); draw(); }
      else if (x.type === 'text') form[x.key].value = v;
      else [].concat(v).forEach(function (o) { var el = form.querySelector('[name="' + x.key + '"][value="' + String(o).replace(/"/g, '') + '"]'); if (el) el.checked = true; });
    });
    prog();
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var a = {};
    QS.forEach(function (x) {
      if (x.type === 'tickers') a[x.key] = picked;
      else if (x.type === 'text') a[x.key] = form[x.key].value.trim();
      else if (x.type === 'one') { var c = form.querySelector('[name="' + x.key + '"]:checked'); a[x.key] = c ? c.value : ''; }
      else a[x.key] = [].map.call(form.querySelectorAll('[name="' + x.key + '"]:checked'), function (c) { return c.value; });
    });
    try {
      localStorage.setItem('gnm-prefs', JSON.stringify(a));
      // Holdings and watched stocks go straight into the watchlist.
      var w = JSON.parse(localStorage.getItem('gnm-watch') || '[]');
      picked.forEach(function (p) { if (w.indexOf(p[0]) < 0) w.push(p[0]); });
      localStorage.setItem('gnm-watch', JSON.stringify(w)); localStorage.setItem('gnm-watch-at', String(Date.now()));
    } catch (x) {}
    if (!window.GNM || !GNM.api) { location.href = 'index.html#feed'; return; }
    GNM.call('POST', '/survey', { kind: 'onboarding', answers: a }).then(function (r) {
      if (r.error) { document.getElementById('out').innerHTML = '<div class="msg-err"></div>'; document.getElementById('out').firstChild.textContent = r.message; return; }
      GNM.track('onboarding_done', {}); GNM.refresh().then(function () { location.href = 'index.html#feed'; });
    });
  });
})();
</script>`;
  return shell('', '설문 · 그노몬', body, { scripts: script, chat: false, noFeedback: true });
}

export function renderAccount(): string {
  const body = `${PAGE_CSS}<section class="hero"><div class="hero-main"><div class="eyebrow"><span>내 계정</span></div><h1 id="acc-email">계정</h1><p class="hero-line" id="acc-line">불러오는 중이에요…</p></div></section>${NO_API}
<section class="block"><div class="kpis"><div class="kpi"><b data-credits>0</b><span>남은 크레딧</span></div><div class="kpi"><b>${ALPHA.monthlyCredits}</b><span>매달 기본 크레딧 (알파)</span></div><div class="kpi"><b id="acc-asks">0</b><span>오늘 AI 질문</span></div></div></section>
<section class="block"><div class="block-head"><h2>크레딧 더 받기</h2><span class="muted">알파 테스터는 요청하면 운영자가 확인해서 넣어 드려요</span></div><div class="card">
<form id="req" class="inline" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end"><div class="fld" style="margin:0"><label for="req-amt">크레딧</label><select id="req-amt"><option>100</option><option selected>200</option><option>300</option><option>500</option></select></div>
<div class="fld" style="margin:0;flex:1;min-width:220px"><label for="req-why">어디에 쓰실지</label><input id="req-why" maxlength="300" placeholder="예: 반도체 종목 심층 리포트 비교" required></div><button class="credit-btn" type="submit">요청하기</button></form>
<div id="req-list" style="margin-top:12px"></div></div></section>
<section class="block"><div class="block-head"><h2>크레딧 내역</h2></div><div class="card adm"><table><thead><tr><th>때</th><th>내용</th><th class="num">크레딧</th></tr></thead><tbody id="ledger"><tr><td colspan="3" class="muted">불러오는 중…</td></tr></tbody></table></div></section>
<section class="block"><div class="block-head"><h2>비밀번호</h2><span class="muted" id="pw-state"></span></div><div class="card">
<form id="pwf" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end"><div class="fld" style="margin:0" id="pw-cur-f"><label for="pw-cur">지금 비밀번호</label><input id="pw-cur" type="password" autocomplete="current-password"></div><div class="fld" style="margin:0"><label for="pw-new">새 비밀번호</label><input id="pw-new" type="password" autocomplete="new-password" minlength="8" maxlength="72" required></div><button class="credit-btn" type="submit">저장</button></form>
<p class="muted small" style="margin:8px 0 0">8자 이상, 영문과 숫자를 함께 넣어 주세요. 정해 두면 다음부터 이메일과 비밀번호로 로그인해요.</p><div id="pw-out" aria-live="polite"></div></div></section>
<section class="block"><div class="block-head"><h2>설정</h2></div><div class="card" style="display:flex;gap:8px;flex-wrap:wrap">
<a class="credit-btn ghost" href="onboarding.html">설문 다시 하기</a><button class="credit-btn ghost" type="button" id="export">내 데이터 내려받기</button><button class="credit-btn ghost" type="button" id="logout">로그아웃</button><button class="credit-btn ghost" type="button" id="delete" style="color:#9b1c1c;border-color:#9b1c1c">계정 삭제</button></div></section>`;
  const script = `<script>
(function () {
  if (!window.GNM || !GNM.api) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var when = function (t) { return t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''; };
  var STATUS = { pending: '검토 중', approved: '승인', rejected: '거절' };
  var load = function () {
    GNM.refresh().then(function (me) {
      if (!me) { location.replace('login.html?return=account.html'); return; }
      document.getElementById('acc-email').textContent = me.user.email;
      document.getElementById('acc-line').textContent = me.user.planName + ' 요금제 · ' + new Date(me.user.createdAt).toLocaleDateString('ko-KR') + ' 가입' + (me.user.viewAs ? ' · 운영자 미리보기 중' : ' · 알파 동안 프로 기능을 써요(심층 리포트는 크레딧으로 열어요)');
      // Admins: look at the site as another plan to test gates and paid unlocks (sent as X-View-As).
      if (me.user.admin || me.user.viewAs) {
        var cur = ''; try { cur = localStorage.getItem('gnm-view-as') || ''; } catch (e) {}
        var box = document.createElement('section'); box.className = 'block'; box.innerHTML = '<div class="card"><h2>요금제로 보기 (운영자)</h2><p class="muted small">이 기기에서만 다른 요금제처럼 보고 써요. 잠금·크레딧 열기·질문 한도를 그대로 시험할 수 있어요. 운영 화면은 끄고 들어가세요.</p><div class="seg" role="group" aria-label="요금제로 보기">' + [['', '운영자'], ['free', '무료'], ['plus', '플러스'], ['alpha', '알파'], ['pro', '프로'], ['max', '맥스']].map(function (o) { return '<button type="button" data-view-as="' + o[0] + '" aria-pressed="' + (o[0] === cur) + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
        document.querySelector('main, #main, body').appendChild(box);
        box.querySelectorAll('[data-view-as]').forEach(function (b) { b.onclick = function () { try { var v = b.getAttribute('data-view-as'); if (v) localStorage.setItem('gnm-view-as', v); else localStorage.removeItem('gnm-view-as'); } catch (e) {} location.reload(); }; });
      }
      document.getElementById('acc-asks').textContent = me.asks.today + ' / ' + me.asks.limit;
      document.getElementById('pw-state').textContent = me.user.hasPassword ? '설정돼 있어요' : '아직 없어요 · 정해 두면 링크 없이 로그인해요';
      document.getElementById('pw-cur-f').hidden = !me.user.hasPassword;
      document.getElementById('req-list').innerHTML = me.requests.length ? '<div class="adm"><table><thead><tr><th>요청</th><th>사유</th><th>상태</th></tr></thead><tbody>' + me.requests.map(function (r) { return '<tr><td>' + r.amount + (r.granted ? ' → ' + r.granted : '') + '</td><td>' + esc(r.reason) + (r.admin_note ? '<br><small class="muted">운영자: ' + esc(r.admin_note) + '</small>' : '') + '</td><td><span class="pill ' + r.status + '">' + STATUS[r.status] + '</span></td></tr>'; }).join('') + '</tbody></table></div>' : '';
    });
    GNM.call('GET', '/me/ledger').then(function (r) {
      if (r.error) return;
      document.getElementById('ledger').innerHTML = r.rows.length ? r.rows.map(function (x) { return '<tr><td>' + when(x.created_at) + '</td><td>' + esc(x.note || x.kind) + '</td><td class="num ' + (x.delta > 0 ? 'up' : '') + '">' + (x.delta > 0 ? '+' : '') + x.delta + '</td></tr>'; }).join('') : '<tr><td colspan="3" class="muted">아직 내역이 없어요.</td></tr>';
    });
  };
  load();
  document.getElementById('pwf').addEventListener('submit', function (e) {
    e.preventDefault();
    var o = document.getElementById('pw-out');
    GNM.call('POST', '/me/password', { password: document.getElementById('pw-new').value, current: document.getElementById('pw-cur').value || undefined }).then(function (r) {
      o.innerHTML = '<div class="' + (r.error ? 'msg-err' : 'msg-ok') + '"></div>'; o.firstChild.textContent = r.error ? r.message : '비밀번호를 저장했어요.';
      if (!r.error) { document.getElementById('pw-new').value = ''; document.getElementById('pw-cur').value = ''; load(); }
    });
  });
  document.getElementById('req').addEventListener('submit', function (e) {
    e.preventDefault();
    GNM.call('POST', '/credits/request', { amount: Number(document.getElementById('req-amt').value), reason: document.getElementById('req-why').value }).then(function (r) { GNM.toast(r.error ? r.message : '요청했어요. 승인되면 바로 쓸 수 있어요.'); if (!r.error) { document.getElementById('req-why').value = ''; load(); } });
  });
  document.getElementById('export').addEventListener('click', function () {
    GNM.call('GET', '/me/export').then(function (r) { delete r._status; var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' })); a.download = 'gnomon-my-data.json'; a.click(); });
  });
  document.getElementById('logout').addEventListener('click', function () { GNM.signOut().then(function () { location.href = 'index.html'; }); });
  document.getElementById('delete').addEventListener('click', function () {
    var v = prompt("계정과 모든 기록(크레딧, 질문, 설문)이 지워지고 되돌릴 수 없어요. 계속하려면 '삭제'라고 적어 주세요.");
    if (v !== '삭제') return;
    GNM.call('POST', '/me/delete', { confirm: '삭제' }).then(function (r) { if (r.error) { GNM.toast(r.message); return; } GNM.signOut().then(function () { location.href = 'index.html'; }); });
  });
})();
</script>`;
  return shell('', '내 계정 · 그노몬', body, { scripts: script, active: 'account', noFeedback: true });
}

export function renderAdmin(): string {
  const body = `${PAGE_CSS}<section class="hero"><div class="hero-main"><div class="eyebrow"><span>운영</span></div><h1>알파 운영</h1><p class="hero-line" id="adm-line">불러오는 중이에요…</p></div></section>${NO_API}
<div class="adm-tabs" role="group" aria-label="운영 메뉴">${[['sum', '요약'], ['credit', '크레딧 요청'], ['action', '리포트 요청'], ['users', '사용자'], ['invites', '초대 코드'], ['voice', '설문·피드백'], ['asks', 'AI 질문'], ['usage', '사용 현황']].map(([k, l], i) => `<button type="button" data-tab="${k}" aria-pressed="${i === 0}">${l}<span data-count="${k}"></span></button>`).join('')}</div>
<div class="card adm" id="adm"></div>`;
  const script = `<script>
(function () {
  if (!window.GNM || !GNM.api) return;
  var D = null, tab = 'sum', root = document.getElementById('adm');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var when = function (t) { return t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; };
  var usd = function (v) { return '$' + Number(v || 0).toFixed(2); };
  var pill = function (s) { return '<span class="pill ' + esc(s) + '">' + esc({ pending: '대기', approved: '승인', rejected: '거절', done: '완료', OK: '답함', FAILED: '실패', REFUSED: '거부' }[s] || s) + '</span>'; };
  var table = function (head, rows) {
    var labelled=rows.map(function(row){var column=0;return row.replace(/<td([^>]*)>/g,function(_,attrs){return '<td'+attrs+' data-label="'+esc(head[column++]||'')+'">';});});
    return '<div class="adm-table-wrap"><table class="adm-responsive"><thead><tr>'+head.map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody>'+(labelled.length?labelled.join(''):'<tr><td colspan="'+head.length+'" class="muted">없어요</td></tr>')+'</tbody></table></div>';
  };
  var post = function (path, body) { return GNM.call('POST', path, body).then(function (r) { if (r.error) GNM.toast(r.message); else load(); return r; }); };
  var avg = function (xs) { return xs.length ? (xs.reduce(function (s, x) { return s + x; }, 0) / xs.length).toFixed(1) : '—'; };
  var V = {
    sum: function () {
      var week = Date.now() - 7 * 864e5, active = D.users.filter(function (u) { return u.last_seen_at && Date.parse(u.last_seen_at) > week; }).length;
      var nps = D.pulses.map(function (p) { try { return JSON.parse(p.answers).nps; } catch (e) { return null; } }).filter(function (x) { return typeof x === 'number'; });
      var npsScore = nps.length ? Math.round((nps.filter(function (x) { return x >= 9; }).length - nps.filter(function (x) { return x <= 6; }).length) / nps.length * 100) : '—';
      var up = D.feedback.filter(function (f) { return f.rating === 1; }).length, down = D.feedback.filter(function (f) { return f.rating === -1; }).length;
      return '<div class="kpis">' + [[D.users.length, '가입자'], [active, '7일 활성'], [D.creditRequests.filter(function (r) { return r.status === 'pending'; }).length, '대기 중 크레딧 요청'], [D.actions.filter(function (r) { return r.status === 'pending'; }).length, '대기 중 리포트 요청'], [usd(D.spend.today) + ' / ' + usd(D.spend.dailyCap), '오늘 AI 비용 / 한도'], [usd(D.spend.month), '30일 AI 비용'], [npsScore, 'NPS (' + nps.length + '명, 평균 ' + avg(nps) + ')'], ['👍 ' + up + ' · 👎 ' + down, '화면 피드백']].map(function (k) { return '<div class="kpi"><b>' + k[0] + '</b><span>' + k[1] + '</span></div>'; }).join('') + '</div>';
    },
    credit: function () {
      return table(['때', '사용자', '요청', '사유', '상태', '처리'], D.creditRequests.map(function (r) {
        return '<tr><td>' + when(r.created_at) + '</td><td>' + esc(r.email) + '</td><td class="num">' + r.amount + (r.granted ? ' → ' + r.granted : '') + '</td><td>' + esc(r.reason) + (r.admin_note ? '<br><small class="muted">' + esc(r.admin_note) + '</small>' : '') + '</td><td>' + pill(r.status) + '</td><td>' +
          (r.status === 'pending' ? '<div class="act" data-req="' + r.id + '"><input type="number" min="1" max="5000" value="' + r.amount + '" aria-label="지급 크레딧"><input placeholder="메모" style="width:110px"><button class="ok" data-d="approve">승인</button><button data-d="reject">거절</button></div>' : when(r.decided_at)) + '</td></tr>';
      }));
    },
    action: function () {
      var K = { report: '심층 리포트', brief: '요약 리포트', upgrade: '심층 업그레이드', invite: '전문가 초청' };
      return '<p class="muted small">알파에서는 손으로 처리해요. 리포트는 requests.json에 종목을 넣고 다음 실행을 기다리면 돼요. 반려하면 크레딧이 돌아가요.</p>' + table(['때', '사용자', '종류', '종목', '내용', '크레딧', '상태', '처리'], D.actions.map(function (a) {
        return '<tr><td>' + when(a.created_at) + '</td><td>' + esc(a.email) + '</td><td>' + (K[a.kind] || a.kind) + '</td><td><a href="stock.html?c=' + esc(a.symbol) + '">' + esc(a.symbol) + '</a></td><td>' + esc(a.detail) + '</td><td class="num">' + a.credits + '</td><td>' + pill(a.status) + '</td><td>' + (a.status === 'pending' ? '<div class="act" data-act="' + a.id + '"><button class="ok" data-s="done">완료</button><button data-s="rejected">반려·환불</button></div>' : '') + '</td></tr>';
      }));
    },
    users: function () {
      return table(['가입', '이메일', '요금제', '크레딧', '질문', '비용', '마지막 접속', '설문', '조정'], D.users.map(function (u) {
        var s = null; try { s = JSON.parse(u.onboarding || 'null'); } catch (e) {}
        var survey = s ? esc([s.experience, s.horizon, (s.sectors || []).join('·'), (s.tickers || []).map(function (t) { return t[1]; }).join('·'), s.pay, s.interview === '네, 좋아요' ? '인터뷰 OK' : ''].filter(Boolean).join(' / ')) : '<span class="muted">안 함</span>';
        return '<tr><td>' + when(u.created_at) + '</td><td>' + esc(u.email) + (u.role === 'admin' ? ' <span class="pill">운영자</span>' : '') + (u.disabled ? ' <span class="pill rejected">중지</span>' : '') + '<br><small class="muted">' + esc(u.invite_code || '') + '</small></td><td>' + esc(u.plan) + '</td><td class="num">' + u.balance + '</td><td class="num">' + u.asks + '</td><td class="num">' + usd(u.usd) + '</td><td>' + when(u.last_seen_at) + '</td><td><small>' + survey + '</small></td><td><div class="act" data-user="' + esc(u.id) + '"><input type="number" placeholder="±크레딧" aria-label="크레딧 조정"><button data-u="grant">지급</button><button data-u="toggle">' + (u.disabled ? '다시 허용' : '중지') + '</button></div></td></tr>';
      }));
    },
    invites: function () {
      return '<form class="inline" id="inv-new"><label>코드 <input name="code" placeholder="비우면 자동" style="width:130px"></label><label>인원 <input name="maxUses" type="number" min="1" max="500" value="1" style="width:70px"></label><label>가입 크레딧 <input name="credits" type="number" min="0" max="1000" value="0" style="width:80px"></label><label>만료 <input name="expiresAt" type="date"></label><label>메모 <input name="note" placeholder="예: 투자 동호회"></label><button>만들기</button></form>' +
        '<form class="inline" id="link-new" style="margin-top:10px"><label>로그인 링크 직접 발급 <input name="email" type="email" placeholder="이메일" required></label><label>초대 코드(신규만) <input name="invite" style="width:130px"></label><button>발급</button><span id="link-out" class="muted small"></span></form>' +
        '<div style="margin-top:12px">' + table(['코드', '메모', '사용', '가입 크레딧', '만료', '공유 링크', ''], D.invites.map(function (i) {
          var url = location.href.replace(/admin\\.html.*$/, 'login.html?invite=' + encodeURIComponent(i.code));
          return '<tr><td><b>' + esc(i.code) + '</b></td><td>' + esc(i.note) + '</td><td class="num">' + i.uses + ' / ' + i.max_uses + '</td><td class="num">' + i.credits + '</td><td>' + (i.expires_at ? when(i.expires_at) : '—') + '</td><td><button type="button" data-copy="' + esc(url) + '">링크 복사</button></td><td>' + (i.uses < i.max_uses ? '<button type="button" data-close="' + esc(i.code) + '">마감</button>' : '<span class="muted">마감</span>') + '</td></tr>';
        })) + '</div>';
    },
    voice: function () {
      var pulses = D.pulses.map(function (p) { var a = {}; try { a = JSON.parse(p.answers); } catch (e) {} var K = { pulse: '팝업', weekly: '주간', midterm: '중간' }; return '<tr><td>' + when(p.created_at) + '</td><td>' + (K[p.kind] || '') + '</td><td>' + esc(p.email) + '</td><td class="num">' + esc(a.nps) + '</td><td>' + esc([a.worst, a.hard, a.bug].filter(Boolean).join(' / ')) + '</td><td>' + esc([a.best, a.want].filter(Boolean).join(' / ')) + '</td></tr>'; });
      var fb = D.feedback.map(function (f) { return '<tr><td>' + when(f.created_at) + '</td><td>' + esc(f.email) + '</td><td>' + esc(f.target) + '<br><small class="muted">' + esc(f.page) + '</small></td><td>' + (f.rating === 1 ? '👍' : f.rating === -1 ? '👎' : '') + '</td><td>' + esc(f.text) + '</td></tr>'; });
      var dist = function (key) { var c = {}; D.users.forEach(function (u) { var s = null; try { s = JSON.parse(u.onboarding || 'null'); } catch (e) {} if (!s) return; [].concat(s[key] || []).forEach(function (v) { if (v) c[v] = (c[v] || 0) + 1; }); }); var max = Math.max.apply(null, Object.values(c).concat([1])); return '<div class="bars">' + Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).map(function (k) { return '<div><span>' + esc(k) + '</span><i style="width:' + (c[k] / max * 100) + '%"></i><span class="num">' + c[k] + '</span></div>'; }).join('') + '</div>'; };
      return '<h3>설문 (주간·중간, NPS)</h3>' + table(['때', '종류', '사용자', '점수', '아쉬운 점·헷갈린 점·오류', '좋은 점·바라는 기능'], pulses) + '<h3 style="margin-top:18px">화면 피드백</h3>' + table(['때', '사용자', '화면', '평가', '의견'], fb) +
        '<h3 style="margin-top:18px">가입 설문 분포</h3><div class="grid-eq">' + [['experience', '경험'], ['horizon', '보유 기간'], ['interests', '보고 싶은 것'], ['sectors', '업종'], ['pay', '지불 의향'], ['tools', '쓰는 도구']].map(function (k) { return '<div><div class="pl-k">' + k[1] + '</div>' + dist(k[0]) + '</div>'; }).join('') + '</div>';
    },
    asks: function () {
      return table(['때', '사용자', '종목', '모델', '질문', '크레딧', '비용', '상태', '평가'], D.questions.map(function (x) { return '<tr><td>' + when(x.created_at) + '</td><td>' + esc(x.email) + '</td><td>' + esc(x.symbol || '') + '</td><td>' + esc(x.tier) + '<br><small class="muted">' + esc(x.model) + '</small></td><td>' + esc(x.question) + '</td><td class="num">' + x.credits + '</td><td class="num">' + usd(x.usd) + '</td><td>' + pill(x.status) + '</td><td>' + (x.rating === 1 ? '👍' : x.rating === -1 ? '👎' : '') + '</td></tr>'; }));
    },
    usage: function () {
      var max = Math.max.apply(null, D.events.map(function (e) { return e.n; }).concat([1]));
      return '<p class="muted small">최근 7일, 이벤트 이름별 횟수와 사람 수예요.</p><div class="bars">' + D.events.map(function (e) { return '<div><span>' + esc(e.name) + '</span><i style="width:' + (e.n / max * 100) + '%"></i><span class="num">' + e.n + '·' + e.users + '명</span></div>'; }).join('') + '</div>';
    },
  };
  var draw = function () {
    root.innerHTML = V[tab]();
    var pend = function (xs) { return xs.filter(function (r) { return r.status === 'pending'; }).length; };
    document.querySelector('[data-count=credit]').textContent = pend(D.creditRequests) ? ' ' + pend(D.creditRequests) : '';
    document.querySelector('[data-count=action]').textContent = pend(D.actions) ? ' ' + pend(D.actions) : '';
  };
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var row = b.closest('[data-req]'), act = b.closest('[data-act]'), user = b.closest('[data-user]');
    if (row && b.dataset.d) { var ins = row.querySelectorAll('input'); post('/admin/credit-requests/' + row.dataset.req, { decision: b.dataset.d, amount: Number(ins[0].value), note: ins[1].value }); }
    else if (act && b.dataset.s) post('/admin/actions/' + act.dataset.act, { status: b.dataset.s });
    else if (user && b.dataset.u === 'grant') { var n = Number(user.querySelector('input').value); if (n) post('/admin/grant', { userId: user.dataset.user, amount: n, note: prompt('메모 (사용자에게 보여요)', '운영자 지급') || '운영자 조정' }); }
    else if (user && b.dataset.u === 'toggle') { var u = D.users.filter(function (x) { return x.id === user.dataset.user; })[0]; if (confirm(u.email + (u.disabled ? ' 다시 허용할까요?' : ' 사용을 중지할까요? 바로 로그아웃돼요.'))) post('/admin/users/' + u.id, { disabled: !u.disabled }); }
    else if (b.dataset.copy) { navigator.clipboard.writeText(b.dataset.copy).then(function () { GNM.toast('초대 링크를 복사했어요.'); }); }
    else if (b.dataset.close && confirm(b.dataset.close + ' 코드를 마감할까요?')) post('/admin/invites/' + b.dataset.close + '/close', {});
  });
  root.addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target;
    if (f.id === 'inv-new') post('/admin/invites', { code: f.code.value.trim() || undefined, maxUses: Number(f.maxUses.value), credits: Number(f.credits.value), note: f.note.value, expiresAt: f.expiresAt.value || undefined }).then(function (r) { if (r.code) GNM.toast(r.code + ' 코드를 만들었어요.'); });
    if (f.id === 'link-new') GNM.call('POST', '/admin/login-link', { email: f.email.value, invite: f.invite.value.trim() || undefined }).then(function (r) {
      var out = document.getElementById('link-out'); if (r.error) { out.textContent = r.message; return; }
      navigator.clipboard.writeText(r.link).then(function () { out.textContent = '복사했어요 (' + r.expiresInMinutes + '분, 한 번만). 본인에게만 전해 주세요.'; }, function () { out.textContent = r.link; });
    });
  });
  document.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { tab = b.dataset.tab; document.querySelectorAll('[data-tab]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); draw(); }); });
  var load = function () {
    GNM.call('GET', '/admin/overview').then(function (r) {
      if (r.error) { document.getElementById('adm-line').textContent = r.message; if (r._status === 401) location.replace('login.html?return=admin.html'); return; }
      D = r; document.getElementById('adm-line').textContent = '가입 ' + r.users.length + '명 · 오늘 AI ' + usd(r.spend.today) + ' (하루 한도 ' + usd(r.spend.dailyCap) + ')'; draw();
    });
  };
  load();
})();
</script>`;
  return shell('', '운영 · 그노몬', body, { scripts: script, chat: false, noFeedback: true });
}

