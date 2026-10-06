// Alpha guidance (docs/DESIGN.md §5.20, G-58): the full menu behind the ☰ button, the rotating banner at
// the top of the home page (how-to guide, mid-term and weekly surveys, notices from banners.json), the
// guide page and the two longer surveys. The menu itself lives in ui.ts (every page). Answers go to the API's /survey (kinds "midterm" and "weekly").

import { shell } from './renderHtml.js';
export { BANNER_CSS } from './ui.js';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A notice or ad in the home banner (banners.json, edited by hand like promos.json). */
export interface Banner { title: string; text?: string; href?: string; cta?: string; tone?: 'navy' | 'teal' | 'amber' | 'rose'; until?: string }

/** Always on during the alpha: the guide and the two surveys. */
export const ALPHA_BANNERS: readonly Banner[] = [
  { title: '그노몬 사용법 3분 정리', text: '홈, 리포트 탭, AI 위원회, 스크리너, 관심 종목까지 한 번에 봐요.', href: 'guide.html', cta: '사용법 보기', tone: 'navy' },
  { title: '알파 중간 설문 (약 5분)', text: '지금까지 써 보신 소감을 들려주세요. 다음 개선 순서를 정하는 데 써요.', href: 'survey.html?k=midterm', cta: '중간 설문 하기', tone: 'teal' },
  { title: '이번 주 설문 (1분)', text: '이번 주에 가장 좋았던 것과 불편했던 것 하나씩만 알려 주세요.', href: 'survey.html?k=weekly', cta: '주간 설문 하기', tone: 'amber' },
];

export function validBanners(list: unknown, today: string): Banner[] {
  if (!Array.isArray(list)) return [];
  const TONES = ['navy', 'teal', 'amber', 'rose'];
  return list.flatMap((b: Partial<Banner>) => {
    if (!b || typeof b.title !== 'string' || !b.title.trim()) return [];
    if (typeof b.until === 'string' && b.until < today) return [];
    if (b.href !== undefined && (typeof b.href !== 'string' || /^\s*javascript:/i.test(b.href))) return [];
    return [{ title: b.title.slice(0, 60), ...(typeof b.text === 'string' ? { text: b.text.slice(0, 120) } : {}), ...(b.href ? { href: b.href } : {}), ...(typeof b.cta === 'string' ? { cta: b.cta.slice(0, 16) } : {}), tone: TONES.includes(b.tone ?? '') ? b.tone! : 'navy' }];
  });
}

/** The rotating banner at the top of the home page: notices first, then the alpha guide and surveys. */
export function bannerHtml(list: readonly Banner[]): string {
  if (!list.length) return '';
  const slide = (b: Banner, i: number) => `<a class="bn-slide bn-${b.tone ?? 'navy'}" ${b.href ? `href="${esc(b.href)}"` : 'role="group"'} data-i="${i}"${i ? ' hidden' : ''} aria-roledescription="배너" aria-label="${i + 1} / ${list.length}"><span class="bn-tag">${i < list.length - ALPHA_BANNERS.length ? '공지' : '알파'}</span><b>${esc(b.title)}</b>${b.text ? `<span class="bn-text">${esc(b.text)}</span>` : ''}${b.cta ? `<span class="bn-cta">${esc(b.cta)} ›</span>` : ''}</a>`;
  return `<section class="banner" id="banner" aria-label="공지와 이벤트">${list.map(slide).join('')}${list.length > 1 ? `<div class="bn-dots">${list.map((_, i) => `<button type="button" data-go="${i}" aria-label="${i + 1}번째 배너" aria-pressed="${i === 0}"></button>`).join('')}</div>` : ''}</section>`;
}


export const BANNER_JS = `<script>
(function () {
  var box = document.getElementById('banner'); if (!box) return;
  var slides = box.querySelectorAll('.bn-slide'), dots = box.querySelectorAll('[data-go]'), at = 0, timer = 0;
  if (slides.length < 2) return;
  var show = function (i) { at = (i + slides.length) % slides.length; slides.forEach(function (s, k) { s.hidden = k !== at; }); dots.forEach(function (d, k) { d.setAttribute('aria-pressed', String(k === at)); }); };
  var start = function () { clearInterval(timer); timer = setInterval(function () { show(at + 1); }, 5000); };
  dots.forEach(function (d) { d.addEventListener('click', function (e) { e.preventDefault(); show(Number(d.getAttribute('data-go'))); start(); }); });
  // Swipe on phones.
  var x0 = null;
  box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { show(at + (dx < 0 ? 1 : -1)); start(); } x0 = null; });
  box.addEventListener('mouseenter', function () { clearInterval(timer); }); box.addEventListener('mouseleave', start);
  start();
})();
</script>`;

const PAGE = `<style>.gd{max-width:760px;margin:0 auto}.gd h2{margin:26px 0 8px;font-size:19px}.gd p,.gd li{line-height:1.7}.gd ol,.gd ul{padding-left:20px}.gd .gd-note{background:#eef3fb;border-radius:12px;padding:10px 14px;font-size:14px}
.sv{max-width:720px;margin:0 auto}.sv .q{padding:14px 0;border-top:1px solid var(--line)}.sv h3{font-size:16px;margin:0 0 8px}.sv .opts{display:flex;flex-wrap:wrap;gap:6px}.sv .opts label{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line-strong);border-radius:999px;padding:7px 12px;font-size:14px;cursor:pointer;background:#fff}
.sv .opts input{accent-color:var(--navy)}.sv .opts label:has(input:checked){border-color:var(--navy);background:#eef3fb;font-weight:700}.sv .nps{display:grid;grid-template-columns:repeat(11,1fr);gap:4px}.sv .nps label{justify-content:center;padding:8px 0;border-radius:10px}.sv .nps input{display:none}
.sv textarea{width:100%;border:1px solid var(--line-strong);border-radius:12px;padding:10px 12px;font:inherit;font-size:16px;min-height:80px}.sv .ends{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:4px}</style>`;

export function renderGuide(): string {
  const body = `${PAGE}<section class="hero"><div class="hero-main"><div class="eyebrow"><span>알파 테스트</span><span>3분</span></div><h1>그노몬 사용법</h1><p class="hero-line">처음 들어오셨다면 이 순서대로 둘러보세요. 언제든 오른쪽 위 ☰ 메뉴에서 다시 열 수 있어요.</p></div></section>
<section class="block gd"><div class="card">
<h2>1. 시작하기</h2><ol><li><b>가입</b>: 받은 초대 코드로 한 번 가입하면, 다음부터는 이메일과 비밀번호로 로그인해요.</li><li><b>1분 설문</b>: 투자 경험·보유 기간·관심 업종을 고르면 홈 화면 순서와 추천 스크리너가 맞춰져요. 홈 위쪽 <b>설문 수정하기</b>로 언제든 바꿔요.</li><li><b>크레딧</b>: 알파 동안 매달 기본 크레딧이 들어와요. 모자라면 내 계정에서 더 요청할 수 있어요.</li></ol>
<h2>2. 홈 화면</h2><ul><li>맨 위 배너: 공지, 설문, 사용법이 돌아가며 나와요.</li><li><b>검색</b>: 종목·ETF·코인 이름, 코드, 초성(ㅅㅅㅈㅈ)으로 찾아요.</li><li><b>매일 AI 리포트</b>: 평일엔 주식 5·ETF 1·코인 1, 주말엔 코인 1개를 AI가 분석해요.</li><li><b>관심 종목</b>: ☆를 누르면 담겨요. 로그인하면 다른 기기에서도 그대로 보여요.</li></ul>
<h2>3. 종목 리포트 보는 법</h2><ul><li>위쪽 탭: 홈 · 차트 · 기술 분석 · 전략 · 수급 · 펀더멘털 · 뉴스 · AI 위원회.</li><li><b>핵심 포인트</b>: 중기 기술 신호, 기술적 적정가, 수급 흔적, 증권가 평균 목표가를 먼저 보여 줘요.</li><li><b>AI 위원회</b>: 분석가 6명과 데스크 5곳이 근거를 들어 토론하고, 강세·기본·약세 시나리오와 무효화 조건을 정리해요.</li><li>차트는 지표를 하나씩 켜고 끌 수 있고, 선을 그어 볼 수 있어요.</li></ul>
<h2>4. 스크리너</h2><p>미리 만든 조건(강세 신호 상위, 거래량 급증, 매집 흔적 등)을 누르거나 조건을 직접 조합해요. 조건을 저장하면 새로 걸리는 종목을 알림으로 받아요.</p>
<h2>5. AI에게 묻기</h2><p>오른쪽 아래 말풍선을 누르면 질문창이 열려요. 질문마다 모델(빠른 답 · 표준 · 심층)을 고르고, 쓰는 크레딧이 미리 보여요.</p>
<h2>6. 의견 보내기</h2><p>화면 곳곳의 👍👎와 의견 칸, 그리고 <a href="survey.html?k=weekly">주간 설문</a> · <a href="survey.html?k=midterm">중간 설문</a>으로 알려 주세요. 매주 바뀐 점을 공지로 알려 드려요.</p>
<p class="gd-note">그노몬의 모든 내용은 계산 결과와 시나리오 해설이고, 투자 권유가 아니에요. 투자 판단과 결과의 책임은 투자자 본인에게 있어요.</p>
</div></section>`;
  return shell('', '사용법 · 그노몬', body, {});
}

type Q = { key: string; title: string; type: 'one' | 'many' | 'text' | 'nps'; options?: readonly string[]; note?: string };
export const SURVEYS: Record<'midterm' | 'weekly', { title: string; lead: string; questions: readonly Q[] }> = {
  midterm: {
    title: '알파 중간 설문', lead: '지금까지 써 보신 소감을 들려주세요. 약 5분 걸려요. 답은 서비스 개선에만 써요.',
    questions: [
      { key: 'nps', title: '투자하는 친구에게 그노몬을 추천할 만한가요?', type: 'nps' },
      { key: 'use', title: '가장 자주 쓴 기능은?', type: 'many', note: '여러 개 골라도 돼요', options: ['홈 화면', '종목 검색', '종목 리포트', 'AI 위원회', '매일 AI 리포트', '차트', '스크리너', 'ETF·코인', 'AI 질문', '관심 종목·알림', '성적표·모의투자'] },
      { key: 'best', title: '가장 쓸모 있었던 것 하나와 이유', type: 'text' },
      { key: 'hard', title: '어렵거나 헷갈렸던 화면·용어', type: 'text' },
      { key: 'trust', title: 'AI 해설을 얼마나 믿을 만하다고 느꼈어요?', type: 'one', options: ['전혀', '조금', '보통', '꽤', '매우'] },
      { key: 'brief', title: '요약 리포트 길이는 어땠어요?', type: 'one', options: ['너무 짧아요', '적당해요', '조금 길어요', '너무 길어요'] },
      { key: 'pay', title: '정식 출시 때 한 달에 낼 의향이 있는 금액은?', type: 'one', options: ['무료만', '1만 원 안쪽', '1~3만 원', '3~5만 원', '5~10만 원', '10만 원 넘게도'] },
      { key: 'want', title: '꼭 있었으면 하는 기능', type: 'text' },
      { key: 'bug', title: '오류나 이상하게 보인 곳 (페이지와 상황)', type: 'text' },
    ],
  },
  weekly: {
    title: '이번 주 설문', lead: '1분이면 돼요. 이번 주에 쓴 것만 떠올려 주세요.',
    questions: [
      { key: 'nps', title: '이번 주 그노몬, 친구에게 추천할 만했나요?', type: 'nps' },
      { key: 'used', title: '이번 주에 쓴 것', type: 'many', options: ['종목 리포트', 'AI 위원회', '매일 AI 리포트', '스크리너', 'ETF·코인', 'AI 질문', '관심 종목·알림', '거의 안 썼어요'] },
      { key: 'best', title: '좋았던 것 하나', type: 'text' },
      { key: 'worst', title: '불편했던 것 하나', type: 'text' },
    ],
  },
};

export function renderSurvey(): string {
  const body = `${PAGE}<section class="card form-card sv"><div class="eyebrow"><span>알파 테스트</span><span id="sv-kind"></span></div><h1 id="sv-title">설문</h1><p class="muted" id="sv-lead"></p>
<div id="sv-login" hidden style="background:#fde8e8;color:#9b1c1c;border-radius:12px;padding:10px 12px;margin:8px 0">설문은 로그인한 뒤에 할 수 있어요. <a href="login.html?return=survey.html">로그인</a></div>
<form id="sv"></form><div id="out" aria-live="polite"></div></section>`;
  const script = `<script>
(function () {
  var S = ${JSON.stringify(SURVEYS)}, k = new URLSearchParams(location.search).get('k'), s = S[k] || S.weekly; k = S[k] ? k : 'weekly';
  var esc = function (v) { return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  document.getElementById('sv-title').textContent = s.title; document.getElementById('sv-lead').textContent = s.lead; document.title = s.title + ' · 그노몬';
  var form = document.getElementById('sv');
  form.innerHTML = s.questions.map(function (q, i) {
    var head = '<h3>' + (i + 1) + '. ' + esc(q.title) + '</h3>' + (q.note ? '<div class="muted small">' + esc(q.note) + '</div>' : '');
    if (q.type === 'text') return '<div class="q">' + head + '<textarea name="' + q.key + '" maxlength="800"></textarea></div>';
    if (q.type === 'nps') { var n = ''; for (var v = 0; v <= 10; v++) n += '<label><input type="radio" name="' + q.key + '" value="' + v + '">' + v + '</label>'; return '<div class="q">' + head + '<div class="opts nps">' + n + '</div><div class="ends"><span>전혀 아님</span><span>꼭 추천</span></div></div>'; }
    return '<div class="q">' + head + '<div class="opts">' + q.options.map(function (o) { return '<label><input type="' + (q.type === 'one' ? 'radio' : 'checkbox') + '" name="' + q.key + '" value="' + esc(o) + '">' + esc(o) + '</label>'; }).join('') + '</div></div>';
  }).join('') + '<button class="btn-primary" type="submit">보내기</button>';
  var out = document.getElementById('out');
  (window.GNM && GNM.ready ? GNM.ready : Promise.resolve(null)).then(function (me) { if (!me) { document.getElementById('sv-login').hidden = false; form.querySelector('button').disabled = true; } });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var a = { page: 'survey' };
    s.questions.forEach(function (q) {
      if (q.type === 'text') a[q.key] = form[q.key].value.trim();
      else if (q.type === 'many') a[q.key] = [].map.call(form.querySelectorAll('[name="' + q.key + '"]:checked'), function (c) { return c.value; });
      else { var c = form.querySelector('[name="' + q.key + '"]:checked'); a[q.key] = c ? (q.type === 'nps' ? Number(c.value) : c.value) : null; }
    });
    if (a.nps === null) { out.innerHTML = '<div class="msg-err">첫 번째 질문(0~10)을 골라 주세요.</div>'; return; }
    GNM.call('POST', '/survey', { kind: k, answers: a }).then(function (r) {
      if (r.error) { out.innerHTML = '<div class="msg-err"></div>'; out.firstChild.textContent = r.message; return; }
      form.hidden = true; out.innerHTML = '<div class="msg-ok">고마워요! 보내 주신 내용은 다음 개선에 반영하고, 바뀐 점은 공지로 알려 드릴게요. <a href="index.html">홈으로</a></div>';
    });
  });
})();
</script>`;
  return shell('', '설문 · 그노몬', body, { scripts: script, noFeedback: true });
}
