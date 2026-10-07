import { RELEASES, VERSION } from './releases.js';
// Alpha guidance (docs/DESIGN.md §5.20, G-58): the full menu behind the ☰ button, the rotating banner at
// the top of the home page (how-to guide, mid-term and weekly surveys, notices from banners.json), the
// guide page and the two longer surveys. The menu itself lives in ui.ts (every page). Answers go to the API's /survey (kinds "midterm" and "weekly").

import type { CreditEvent } from './events.js';
import { shell } from './renderHtml.js';
import { esc } from './html.js';
export { BANNER_CSS } from './ui.js';


/** A notice or ad in the home banner (banners.json, edited by hand like promos.json). */
export type BannerKind = 'notice' | 'event' | 'guide' | 'survey' | 'ad';
export interface Banner { title: string; text?: string; href?: string; cta?: string; tone?: 'navy' | 'teal' | 'amber' | 'rose'; until?: string; kind?: BannerKind; event?: string; credits?: number; benefits?: readonly string[]; brand?: 'hanul' }
const KIND_TAG: Record<BannerKind, [string, string]> = { notice: ['공지', '📣'], event: ['이벤트', '🎁'], guide: ['사용법', '🧭'], survey: ['설문', '📝'], ad: ['광고', '🏷️'] };

/** Always on during the alpha: the guide and the two surveys. */
export const ALPHA_BANNERS: readonly Banner[] = [
  { kind: 'ad', brand: 'hanul', title: '아이디어를 실험하고, 제품으로 만듭니다.', text: 'AI 리서치부터 일상의 기록까지. HANUL의 프로젝트를 만나보세요.', href: 'hanul.html', cta: '프로젝트 둘러보기', tone: 'navy' },
  { kind: 'guide', title: '처음이면 1분 둘러보기', text: '실제 화면 위에서 결론 카드, 시나리오, 위원회 토론을 차례로 짚어 드려요.', href: 'guide.html', cta: '사용법 보기', tone: 'navy' },
  { kind: 'survey', title: '맞춤 설문 (약 7분)', text: '투자 경험·스타일·궁금한 것을 알려 주시면 홈과 리포트가 그에 맞게 바뀌어요.', href: 'onboarding.html', cta: '설문 하기', tone: 'teal' },
  { kind: 'survey', title: '이번 주 설문 (1분)', text: '이번 주에 가장 좋았던 것과 불편했던 것 하나씩만 알려 주세요.', href: 'survey.html?k=weekly', cta: '주간 설문 하기', tone: 'amber' },
  { kind: 'ad', title: '프로 요금제 2주 무료 체험', text: '위원회 토론 전체, 남은 쟁점, 전문가 초청까지. 알파 기간 광고 자리 시험용 가상 광고예요.', href: 'pricing.html', cta: '요금제 보기', tone: 'navy' },
  { kind: 'ad', title: '509OP 육군 부사관 지원', text: '상황간부 · 영상간부 | 상황을 판단하고, 경계를 이어가는 당신의 다음 커리어.', href: '509op.html', cta: '육군 간부 혜택 보기', tone: 'teal' },
  { kind: 'ad', title: '여기에 광고가 들어갈 수 있어요', text: '증권·핀테크 파트너 광고 자리예요. 지금은 시험용 가상 광고이고, 실제 상품이 아니에요.', cta: '광고 문의 (준비 중)', tone: 'rose' },
];

/** Credit events become banners with a 받기 button (G-73). */
export const eventBanners = (events: readonly CreditEvent[]): Banner[] => events.map((e) => ({ kind: 'event', title: `${e.title} · ${e.credits}크레딧`, text: e.text, cta: '받기', tone: 'amber', event: e.id, credits: e.credits }));
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
  const slide = (b: Banner, i: number) => {
    const [tag, art] = KIND_TAG[b.kind ?? 'notice'];
    const inner = `<span class="bn-tag">${tag}${b.benefits || b.kind === 'ad' ? ' · MOCK AD' : ''}</span>${b.brand ? '<img class="bn-logo" src="assets/hanul-logo.jpg" alt="HANUL by Hanseo Kim" width="1536" height="512">' : ''}<b>${esc(b.title)}</b>${b.text ? `<span class="bn-text">${esc(b.text)}</span>` : ''}${b.cta && !b.benefits ? (b.event ? `<button type="button" class="bn-cta" data-claim="${esc(b.event)}" data-ev-credits="${b.credits ?? 0}">${esc(b.cta)} ›</button>` : `<span class="bn-cta">${esc(b.cta)} ›</span>`) : ''}${b.brand ? '' : `<span class="bn-art" aria-hidden="true">${art}</span>`}${b.benefits ? `<details class="bn-benefits"><summary class="bn-cta">${esc(b.cta ?? '혜택 보기')}</summary><ul>${b.benefits.map((benefit) => `<li>${esc(benefit)}</li>`).join('')}</ul><p>실제 모집 공고가 아닌 예시 광고입니다. 혜택은 선발·복무 조건에 따라 달라지며, 지원 접수나 외부 페이지 연결은 제공하지 않습니다.</p></details>` : ''}`;
    const attrs = `class="bn-slide bn-${b.tone ?? 'navy'} bn-k-${b.kind ?? 'notice'}${b.brand ? ' bn-hanul' : ''}" data-i="${i}"${i ? ' hidden' : ''} aria-roledescription="배너" aria-label="${i + 1} / ${list.length}"`;
    return b.href && !b.event ? `<a ${attrs} href="${esc(b.href)}">${inner}</a>` : `<div ${attrs} role="group">${inner}</div>`;
  };
  return `<section class="banner" id="banner" aria-label="공지와 이벤트">${list.map(slide).join('')}${list.length > 1 ? `<div class="bn-dots">${list.map((_, i) => `<button type="button" data-go="${i}" aria-label="${i + 1}번째 배너" aria-pressed="${i === 0}"></button>`).join('')}</div>` : ''}</section>`;
}


export const BANNER_JS = `<script>
(function () {
  var box = document.getElementById('banner'); if (!box) return;
  var slides = box.querySelectorAll('.bn-slide'), dots = box.querySelectorAll('[data-go]'), at = 0, timer = 0;
  // Credit events: the API grants them once per account; without the API, this browser's mock account.
  box.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-claim]'); if (!b) return;
    e.preventDefault(); var id = b.getAttribute('data-claim'), G = window.GNM || {};
    var done = function (m) { b.disabled = true; b.textContent = '받았어요 ✓'; if (G.toast) G.toast(m); else alert(m); };
    if (G.api) {
      if (!G.me) { location.href = 'login.html?next=' + encodeURIComponent(location.pathname); return; }
      G.call('POST', '/events/claim', { id: id }).then(function (r) { if (r.error) { if (r.error === 'ALREADY') done(r.message); else if (G.toast) G.toast(r.message); return; } done(r.credits + '크레딧을 받았어요. 남은 크레딧 ' + r.balance + '개'); if (G.refresh) G.refresh(); });
    } else if (G.read && G.write) {
      var a = G.read(); if (a.claimed.indexOf(id) >= 0) return done('이미 받은 이벤트예요.');
      var n = Number(b.getAttribute('data-ev-credits')) || 50;
      a.claimed.push(id); a.grants.push({ id: id, left: n, to: '2099-12-31' }); a.log.unshift({ at: new Date().toISOString(), kind: 'trial', amount: n, note: '이벤트 ' + id }); G.write(a); if (G.paint) G.paint();
      done(n + '크레딧을 받았어요 (MOCK)');
    }
  });
  if (slides.length < 2) return;
  var show = function (i) { at = (i + slides.length) % slides.length; slides.forEach(function (s, k) { s.hidden = k !== at; }); dots.forEach(function (d, k) { d.setAttribute('aria-pressed', String(k === at)); }); };
  var start = function () { clearInterval(timer); if (box.querySelector('details[open]') || box.contains(document.activeElement)) return; timer = setInterval(function () { show(at + 1); }, 5000); };
  dots.forEach(function (d) { d.addEventListener('click', function (e) { e.preventDefault(); show(Number(d.getAttribute('data-go'))); start(); }); });
  box.querySelectorAll('.bn-benefits').forEach(function (d) { d.addEventListener('toggle', start); });
  box.addEventListener('focusin', function () { clearInterval(timer); });
  box.addEventListener('focusout', function () { setTimeout(start, 0); });
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

/** G-74: the guide, on real screenshots (site/guide/*.webp, copied from docs/guide), with a live tour per page. */
const GUIDE_STEPS: readonly { id: string; title: string; img?: string; alt?: string; body: string }[] = [
  { id: 'start', title: '시작하기', body: `<ol><li><b>가입</b>: 받은 초대 코드로 한 번 가입하면, 다음부터는 이메일과 비밀번호로 로그인해요.</li><li><b>맞춤 설문 (약 7분)</b>: 투자 경험, 스타일, 보유 기간, 관심 업종을 알려 주시면 홈의 '오늘 볼 것'과 종목 화면이 그에 맞게 바뀌어요. 언제든 전체 → 맞춤 설문에서 고칠 수 있어요.</li><li><b>보기 방식</b>: 전체 메뉴의 보기 방식에서 초보 · 단타 · 스윙 · 장기 · 전체 중 고르면 바로 바뀌어요.</li><li><b>크레딧</b>: 알파 참여자는 매달 400크레딧을 받아요. 배너의 이벤트에서 더 받을 수 있어요. 심층 리포트 생성, AI 질문(5~), 전문가 초청 등에 써요.</li></ol>` },
  { id: 'home', title: '홈 화면', img: 'g-home.webp', alt: '홈 화면: 검색, 배너, 시장 한눈에, 관심 종목, 오늘 볼 것', body: `<ol><li><b>검색</b>: 종목·ETF·코인을 이름, 코드, 초성(ㅅㅅㅈㅈ)으로 찾아요.</li><li><b>배너</b>: 공지, 크레딧 이벤트(받기를 누르면 바로 들어와요), 설문, 사용법이 돌아가요. 옆으로 밀어서 넘겨요.</li><li><b>시장 한눈에</b>: 코스피·코스닥과 <b>시장 온도</b>예요. 시장 온도는 전 종목의 기술 신호를 강세부터 약세까지 일곱 칸으로 모은 거예요.</li><li><b>관심 종목</b>: 어디서든 ☆를 누르면 모여요. 장중엔 가격이 실시간으로 바뀌어요(오르면 빨강, 내리면 파랑으로 잠깐 깜빡여요).</li><li><b>오늘 볼 것</b>: 보기 방식에 맞춰 네 개를 골라 이유를 붙여 줘요. 단타는 오늘 많이 움직인 순, 스윙은 테스트 가격에 가까운 순, 장기는 적정가 아래 순, 초보는 대표 종목과 ETF부터예요.</li></ol>` },
  { id: 'report', title: '종목 리포트: 같은 위치의 여덟 탭', body: `<p>요약 · 차트 · 기술 · 전략 · AI 위원회 · 수급 · 실적 · 뉴스·공시를 같은 위치에서 확인해요. 리포트가 없는 종목도 같은 템플릿으로 생성되어 차트 도구와 기술 지표를 동일하게 사용하고, 미생성 AI 분석에는 잠금과 모자이크가 표시됩니다.</p><p>리포트 생성 버튼을 누르면 확보된 최신 데이터로 바로 분석을 시작합니다. 창을 닫아도 작업이 계속되고 새로고침 후 확인할 수 있어요. 프로·맥스·알파는 이미 만들어진 심층 리포트를 추가 차감 없이 볼 수 있어요. 그 외에는 개별 열기 권한이 필요해요.</p>` },
  { id: 'conclusion', title: '시나리오: 조건 가격과 전망 범위', body: `<ol><li><b>큰 가격</b>: 강세 전개를 검토하는 상단 조건 또는 약세 전개를 검토하는 하단 조건이에요. 가격을 건드렸다고 상승·하락이 확정되는 것은 아니에요.</li><li><b>전망 범위</b>: 조건 가격과 별개인 예상 가격대예요. 위원회 전망, AI 분석가 목표가, 변동성 참고 범위 중 어떤 근거인지 함께 확인하세요.</li><li><b>조건과 무효화</b>: 펼치면 성립 근거와 시나리오가 틀렸다고 볼 조건을 바로 읽을 수 있어요. 무효화 가격은 진입 조건이 아니에요.</li><li><b>차트에서 비교</b>: 차트의 시나리오 레이어로 강세·기본·약세 가격대를 함께 봐요. 기술 지표도 같은 차트에서 확인할 수 있어요.</li></ol><p class="gd-note">분석 날짜와 당시 종가를 먼저 확인하세요. 과거 전망이 지금 가격보다 낮을 수 있어요. 조건 근거가 없으면 가격을 임의로 만들지 않습니다. 예측 결과는 <a href="scorecard.html">성적표</a>에서 확인해요.</p>` },
  { id: 'indicators', title: '기술 지표를 차트로 바로 보기', body: `<p>기술 탭의 피보나치 · 볼린저 · RSI · MACD · ATR · 지지·저항 버튼이나 지표 이름의 ↗를 누르면 차트 탭에서 해당 지표가 켜져요. 차트 위에 짧은 해석이 표시되고, <b>기술로 돌아가기</b>를 누르면 보던 지표로 돌아와요. 지표는 일봉 기준이므로 분봉을 보고 있었다면 일봉으로 전환해요.</p>` },
  { id: 'vote', title: 'AI 위원회: 표결', img: 'g-vote.webp', alt: '위원회 표결: 강세·중립·약세 막대와 위원별 판단과 근거', body: `<p>분석가 6명(추세, 평균회귀, 파동·구조, 거래량·수급, 실적·밸류, 이벤트)과 데스크 5곳(시장, 기술, 수급, 펀더멘털, 공시·뉴스)이 각자 판단해요. 카드마다 <b>강세/약세/중립, 확신도, 근거 한 줄</b>이 있어요. 분석가의 판단은 20거래일 뒤 실제 가격으로 채점돼요.</p>` },
  { id: 'debate', title: 'AI 위원회: 토론', img: 'g-debate.webp', alt: '위원회 토론: 채팅 형식 말풍선, 답장 인용, 근거 번호를 눌러 펼친 모습', body: `<ol><li>위원들이 <b>채팅처럼 한 마디씩</b> 서로 반박해요. 답장에는 상대 말이 인용돼요. 마지막은 레드팀이 합의한 것과 풀리지 않은 것을 정리해요.</li><li>말 끝의 <b>근거 번호</b>(P1, Q1, N8…)를 누르면 그 근거가 펼쳐지고, 원문이나 근거 정리로 갈 수 있어요.</li><li>토론 아래 <b>해설·근거 정리</b>를 열면 강세·약세 근거와 근거 자료 전체가 있어요.</li><li><b>토론에 참여</b>: 토론 바로 아래 질문을 적어요. 입력창 옆 작은 <b>+</b> 버튼을 누르면 팝업 목록에서 답변자를 고르거나 <b>+ 내 전문가</b>에서 이름·분야·관점·스타일을 저장할 수 있어요. 질문을 쓰고 위원회 전체 또는 전문가(반도체, 2차전지, 매크로…)를 골라 물어요.</li></ol>` },
  { id: 'find', title: '검색과 필터', img: 'g-find.webp', alt: '자세히 검색: 검색창과 주식·ETF·코인 탭', body: `<p><b>AI 조건</b>에서 “아직 많이 안 올랐는데 거래량이 터진 종목”처럼 적으면 AI가 지원되는 조건을 제안해요. 제안을 확인해 적용하고 직접 수정·저장하세요. 홈 검색창 아래 <b>필터 설정하기</b>를 누르면 시장(주식 · ETF · 코인)과 조건을 골라 자세히 찾을 수 있어요. 주식은 미리 만든 조건(강세 신호 상위, 바닥권 거래량 폭발, 매집 흔적…)을 누르거나 직접 조합하고, 저장하면 홈의 <b>내 조건에 걸린 종목</b>에 매일 떠요. 알림으로도 받을 수 있어요.</p>` },
  { id: 'loading', title: '로딩과 채팅', body: `<p>바로 준비되는 필터·탭·화면은 즉시 보여 줘요. 실제 데이터 요청이나 AI 생성이 0.3초 이상 이어질 때만 Thinking Orbs를 표시하며, 강제 대기는 없어요. 토론 재생은 2초 생각 → 발언 → 2초 쉼 순서예요. AI 질문은 실제 답변을 기다리는 동안 Orbs를 표시해요. 조건 적용·저장·관심 변경 후에는 완료 안내를 확인하고, 오류 안내가 나오면 저장되지 않은 상태예요.</p>` },
  { id: 'alerts', title: '전체 메뉴와 알림', body: `<p>아래의 <b>홈 · 검색 · 관심 · 성적표 · 전체</b>를 이용하세요. 넓은 화면에서는 같은 메뉴가 위에 있어요. <b>전체</b>에서 내 계정, 보기 방식, 알림 설정, FAQ·문의와 사용법을 열어요. 종목의 🔔로 가격 알림을 설정하고 전체 → 알림 설정에서 종류별로 조절하세요. 휴대폰 푸시는 지원 브라우저의 권한과 요금제 조건이 필요해요.</p>` },
  { id: 'upcoming', title: '준비 중인 데이터 기능', body: `<p><b>실적 발표·배당·임원/주요주주 지분 변화</b>를 공개 공시와 원문으로 연결하는 기능부터 준비합니다. 발표 전 예상치가 저장된 분기만 서프라이즈를 계산하고, 거래대금 비교와 테마별 종목 탐색을 이어서 추가할 예정이에요. 이 항목들은 아직 제공 완료된 기능이 아니에요.</p>` },
  { id: 'feedback', title: '의견 보내기', body: `<p>화면 곳곳의 👍👎, <a href="survey.html?k=weekly">주간 설문(1분)</a>, <a href="onboarding.html">맞춤 설문(약 7분)</a>으로 알려 주세요. 매주 바뀐 점을 배너 공지로 알려 드려요.</p>` },
];

export function renderGuide(): string {
  const toc = GUIDE_STEPS.map((s, i) => `<a href="#g-${s.id}">${i + 1}. ${s.title}</a>`).join('');
  const steps = GUIDE_STEPS.map((s, i) => `<section class="gd-step" id="g-${s.id}"><h2>${i + 1}. ${s.title}</h2><div class="gd-row${s.img ? '' : ' gd-noimg'}">${s.img ? `<figure><img src="guide/${s.img}" alt="${s.alt}" loading="lazy" width="390"><figcaption>이전 알파 화면 예시 · 최신 구성은 설명을 참고하세요</figcaption></figure>` : ''}<div class="gd-text">${s.body}</div></div></section>`).join('');
  const body = `${PAGE}<section class="hero"><div class="hero-main"><div class="eyebrow"><span>알파 테스트</span><span>5분</span></div><h1>그노몬 사용법</h1><p class="hero-line">실제 화면으로 설명해요. 직접 눌러 보며 익히려면 둘러보기를 시작하세요.</p>
<div class="gd-tours"><a class="btn-primary" href="index.html?tour=1">홈 둘러보기 시작 ›</a><a class="btn-ghost" href="000660/index.html?tour=1">종목 리포트 둘러보기 ›</a><a class="btn-ghost" href="screener.html?tour=1">검색 조건 둘러보기 ›</a></div></div></section>
<section class="block gd"><nav class="gd-toc" aria-label="목차">${toc}</nav>${steps}
<p class="gd-note">그노몬의 모든 내용은 계산 결과와 시나리오 해설이고, 투자 권유가 아니에요. 투자 판단과 결과의 책임은 투자자 본인에게 있어요.</p></section>
<style>.gd{max-width:980px}.gd-tours{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.gd-tours a{display:inline-flex;text-decoration:none}.gd-toc{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}.gd-toc a{border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:700;text-decoration:none;color:var(--fg)}
.gd-step{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px 20px;margin:14px 0;scroll-margin-top:80px}.gd-step h2{margin:0 0 12px}.gd-row{display:grid;grid-template-columns:300px 1fr;gap:22px;align-items:start}.gd-noimg{grid-template-columns:1fr}.gd-row figure{margin:0;position:sticky;top:80px}.gd-row img{width:100%;height:auto;border-radius:14px;border:1px solid var(--line);box-shadow:0 8px 24px rgba(15,34,68,.08)}.gd-row figcaption{font-size:12px;color:var(--muted);margin-top:4px;text-align:center}.gd-text li{margin:6px 0}
@media (max-width:820px){.gd-row{grid-template-columns:1fr}.gd-row figure{position:static;max-width:340px;margin:0 auto}}</style>`;
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

export function renderUpdates(): string { return shell('','업데이트 기록 · 그노몬',`<section class="hero"><h1>Alpha 업데이트 기록</h1><p>큰 변화는 첫 자리, 중간 변화는 둘째 자리, 작은 수정은 셋째 자리를 올려요.</p><p class="muted">v0.0.0~v1.4.0은 기존 커밋을 기능별로 묶은 회고 기록입니다. 당시 배포 태그와 일대일 대응하지 않습니다. 현재 버전은 v${VERSION}이며 공개된 이 화면의 릴리스 노트와 사용법을 함께 확인해 주세요.</p></section><section class="card block"><h2>v${VERSION} 주요 변화와 사용 순서</h2><ol><li><b>분석 보기</b>: 리포트가 없는 종목도 동일한 화면 구조로 열립니다. 미생성 AI 분석은 같은 위치에 잠금으로 남고, 차트와 기술 계산은 먼저 볼 수 있어요. 기술의 피보나치·볼린저·RSI·MACD·ATR을 누르면 해당 지표를 켠 차트로 이동하고, 기술로 돌아가기로 복귀할 수 있어요. 코인은 차트에서 일봉 또는 1·5·15·60분봉을 선택하세요. 시나리오를 펼치면 미니 차트를 보고, 차트 탭에서는 강세·기본·약세를 비교할 수 있어요. 수급 탭에서 거래량·OBV·매집/분산을 확인하세요.</li><li><b>리포트 만들기</b>: 생성 버튼을 누르면 바로 작업이 시작됩니다. 기존 심층 리포트는 요금제 또는 개별 열람 권한에 따라 열리며, 미권한 영역은 잠금으로 표시됩니다.</li><li><b>토론 참여</b>: AI 위원회 토론 바로 아래 질문을 적고, 입력창 옆 + 버튼으로 위원회 전체 또는 전문가를 고르세요. 보내기 전에 표시된 크레딧 비용을 확인하세요.</li><li><b>AI 검색 조건</b>: 스크리너에서 원하는 종목의 특징을 문장으로 적으세요. AI가 제안한 조건을 확인·수정한 뒤 적용하고, 다시 사용할 조건은 저장하세요.</li><li><b>진행 상태</b>: 채팅·검색·필터·탭 준비에 실제 대기가 길어질 때 Thinking Orbs가 표시됩니다. 즉시 준비되는 화면은 바로 볼 수 있습니다.</li></ol><p><a href="guide.html">전체 사용법 보기</a></p></section><section class="card block"><h2>준비 중 · 기업 이벤트와 테마</h2><p>실적 발표·배당·임원/주요주주 공시와 거래대금 비교부터 연결합니다. 발표 전 예상치 이력에 기반한 분기 서프라이즈와 근거가 확인된 테마 탐색은 후속 작업입니다. 아직 완료된 릴리스에 포함하지 않습니다.</p></section>${RELEASES.map(([v,date,text])=>`<section class="card block"><h2>Alpha v${v}</h2><small>${date}</small><p>${text}</p></section>`).join('')}`,{}); }
