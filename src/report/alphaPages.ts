import { noteItems, RELEASES, VERSION } from './releases.js';
// Alpha guidance (docs/DESIGN.md §5.20, G-58): the full menu behind the ☰ button, the rotating banner at
// the top of the home page (how-to guide, mid-term and weekly surveys, notices from banners.json), the
// guide page and the two longer surveys. The menu itself lives in ui.ts (every page). Answers go to the API's /survey (kinds "midterm" and "weekly").

import type { CreditEvent } from './events.js';
import { shell } from './renderHtml.js';
import { CREDIT_COST, TESTERS } from './plans.js';
import { esc } from './html.js';
import { BETA_YES, WRAPUP, WRAPUP_LINK } from './wrapup.js';
export { BANNER_CSS } from './ui.js';


/** A notice or ad in the home banner (banners.json, edited by hand like promos.json). */
export type BannerKind = 'notice' | 'event' | 'guide' | 'survey' | 'ad';
/** A picture banner (teasers): the words are drawn into the picture, so `title` and `text` become its alt text. Wide for desktop (4:1), narrow for phones. */
export interface BannerImage { wide: string; narrow?: string; /** A short film that opens in a pop-up when the banner is tapped. */ video?: string; poster?: string }
export interface Banner { title: string; text?: string; href?: string; cta?: string; tone?: 'navy' | 'teal' | 'amber' | 'rose'; until?: string; kind?: BannerKind; event?: string; credits?: number; benefits?: readonly string[]; brand?: 'hanul'; image?: BannerImage }
const KIND_TAG: Record<BannerKind, [string, string]> = { notice: ['공지', '📣'], event: ['이벤트', '🎁'], guide: ['사용법', '🧭'], survey: ['설문', '📝'], ad: ['광고', '🏷️'] };

/** Always on during the alpha: the guide and the two surveys. */
export const ALPHA_BANNERS: readonly Banner[] = [
  { kind: 'ad', brand: 'hanul', title: '아이디어를 실험하고, 제품으로 만듭니다.', text: 'AI 리서치부터 일상의 기록까지. HANUL의 프로젝트를 만나보세요.', href: 'hanul.html', cta: '프로젝트 둘러보기', tone: 'navy' },
  { kind: 'guide', title: '처음이면 1분 둘러보기', text: '실제 화면 위에서 결론 카드, 시나리오, 위원회 토론을 차례로 짚어 드려요.', href: 'guide.html', cta: '사용법 보기', tone: 'navy' },
  { kind: 'survey', title: '화면 설정 설문 (약 7분)', text: '투자 경험·관심 업종·궁금한 것을 알려 주시면 보이는 순서와 설명 수준이 바뀌어요. 종목 판단은 모두에게 같아요.', href: 'onboarding.html', cta: '설문 하기', tone: 'teal' },
  { kind: 'survey', title: '이번 주 설문 (1분)', text: '이번 주에 가장 좋았던 것과 불편했던 것 하나씩만 알려 주세요.', href: 'survey.html?k=weekly', cta: '주간 설문 하기', tone: 'amber' },
  { kind: 'ad', title: '프로 요금제 (가상 광고)', text: '위원회 토론 전체, 남은 쟁점, 전문가 초청까지. 알파 기간 광고 자리 시험용 가상 광고예요.', href: 'pricing.html', cta: '요금제 보기', tone: 'navy' },
  { kind: 'ad', title: '509OP 육군 부사관 지원', text: '상황간부 · 영상간부 | 상황을 판단하고, 경계를 이어가는 당신의 다음 커리어.', href: '509op.html', cta: '육군 간부 혜택 보기', tone: 'teal' },
  { kind: 'ad', title: '여기에 광고가 들어갈 수 있어요', text: '증권·핀테크 파트너 광고 자리예요. 지금은 시험용 가상 광고이고, 실제 상품이 아니에요.', cta: '광고 문의 (준비 중)', tone: 'rose' },
];

/** G-241: the wrap-up survey leads the banner from 10/24 (KST date of the build) to the alpha's last day. */
export const wrapupBanners = (today: string): Banner[] => today >= '2026-10-24' && today <= '2026-10-31'
  // G-280: a big picture banner like the 4.0.0 one (neutral glass, the button is drawn in the picture).
  ? [{ kind: 'survey', title: '알파, 고마웠어요', text: '3분 마무리 설문 · 클로즈드 베타 신청 · 10.31까지', href: WRAPUP_LINK, cta: '설문하고 신청하기', image: { wide: 'assets/banners/wrapup-wide.jpg', narrow: 'assets/banners/wrapup-narrow.jpg' } }]
  : [];
/** Credit events become banners with a 받기 button (G-73). */
export const eventBanners = (events: readonly CreditEvent[]): Banner[] => events.map((e) => ({ kind: 'event', title: `${e.title} · ${e.credits}크레딧`, text: e.text, cta: '받기', tone: 'amber', event: e.id, credits: e.credits }));
export function validBanners(list: unknown, today: string): Banner[] {
  if (!Array.isArray(list)) return [];
  const TONES = ['navy', 'teal', 'amber', 'rose'];
  return list.flatMap((b: Partial<Banner>) => {
    if (!b || typeof b.title !== 'string' || !b.title.trim()) return [];
    if (typeof b.until === 'string' && b.until < today) return [];
    if (b.href !== undefined && (typeof b.href !== 'string' || /^\s*javascript:/i.test(b.href))) return [];
    // Pictures must be our own files under assets/banners/.
    const pic = (v: unknown) => typeof v === 'string' && /^assets\/banners\/[\w.-]+\.(jpg|png|webp)$/.test(v);
    const film = (v: unknown) => typeof v === 'string' && /^assets\/banners\/[\w.-]+\.mp4$/.test(v);
    const image = b.image && pic(b.image.wide) ? { wide: b.image.wide, ...(pic(b.image.narrow) ? { narrow: b.image.narrow } : {}), ...(film(b.image.video) ? { video: b.image.video } : {}), ...(film(b.image.video) && pic(b.image.poster) ? { poster: b.image.poster } : {}) } : undefined;
    return [{ title: b.title.slice(0, 60), ...(typeof b.text === 'string' ? { text: b.text.slice(0, 120) } : {}), ...(b.href ? { href: b.href } : {}), ...(typeof b.cta === 'string' ? { cta: b.cta.slice(0, 16) } : {}), tone: TONES.includes(b.tone ?? '') ? b.tone! : 'navy', ...(image ? { image } : {}) }];
  });
}

/** The rotating banner at the top of the home page: notices first, then the alpha guide and surveys. */
export function bannerHtml(list: readonly Banner[]): string {
  if (!list.length) return '';
  const slide = (b: Banner, i: number) => {
    const [tag, art] = KIND_TAG[b.kind ?? 'notice'];
    const alt = esc([b.title, b.text].filter(Boolean).join(' '));
    // G-269: a teaser film says 티저, any other film (the 4.0.0 update video) says 영상.
    const film = b.image?.video && /\/teaser[\w.-]*\.mp4$/.test(b.image.video) ? '티저' : '영상';
    const inner = b.image ? `<picture>${b.image.narrow ? `<source media="(max-width:820px)" srcset="${esc(b.image.narrow)}">` : ''}<img class="bn-pic" src="${esc(b.image.wide)}" alt="${alt}" decoding="async"${i ? ' loading="lazy"' : ''}></picture><b class="bn-alt">${esc(b.title)}</b>${b.image.video ? '<span class="bn-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>' + film + ' 보기</span>' : ''}` : `<span class="bn-tag">${tag}${b.benefits || b.kind === 'ad' ? ' · MOCK AD' : ''}</span>${b.brand ? '<img class="bn-logo" src="assets/hanul-logo.jpg" alt="HANUL by Hanseo Kim" width="1536" height="512">' : ''}<b>${esc(b.title)}</b>${b.text ? `<span class="bn-text">${esc(b.text)}</span>` : ''}${b.cta && !b.benefits ? (b.event ? `<button type="button" class="bn-cta" data-claim="${esc(b.event)}" data-ev-credits="${b.credits ?? 0}">${esc(b.cta)} ›</button>` : `<span class="bn-cta">${esc(b.cta)} ›</span>`) : ''}${b.brand ? '' : `<span class="bn-art" aria-hidden="true">${art}</span>`}${b.benefits ? `<details class="bn-benefits"><summary class="bn-cta">${esc(b.cta ?? '혜택 보기')}</summary><ul>${b.benefits.map((benefit) => `<li>${esc(benefit)}</li>`).join('')}</ul><p>실제 모집 공고가 아닌 예시 광고입니다. 혜택은 선발·복무 조건에 따라 달라지며, 지원 접수나 외부 페이지 연결은 제공하지 않습니다.</p></details>` : ''}`;
    const attrs = `class="bn-slide bn-${b.tone ?? 'navy'} bn-k-${b.kind ?? 'notice'}${b.brand ? ' bn-hanul' : ''}${b.image ? ' bn-img' : ''}" data-i="${i}"${i ? ' hidden' : ''} aria-roledescription="배너"`;
    // A link is named by its own text; a group (no link) needs a name, so it keeps its place in the set.
    // A film banner is a link to the film itself (works without script); the script opens it in a pop-up instead.
    if (b.image?.video) return `<a ${attrs} href="${esc(b.image.video)}" data-video="${esc(b.image.video)}"${b.image.poster ? ` data-poster="${esc(b.image.poster)}"` : ''} aria-label="${alt} · ${film === '티저' ? '티저 영상' : '영상'} 보기">${inner}</a>`;
    return b.href && !b.event ? `<a ${attrs} href="${esc(b.href)}">${inner}</a>` : `<div ${attrs} role="group" aria-label="${i + 1} / ${list.length}">${inner}</div>`;
  };
  return `<section class="banner" id="banner" aria-label="공지와 이벤트">${list.map(slide).join('')}${list.length > 1 ? `<div class="bn-dots">${list.map((_, i) => `<button type="button" data-go="${i}" aria-label="${i + 1}번째 배너" aria-pressed="${i === 0}"></button>`).join('')}</div>` : ''}</section>`;
}


export const BANNER_JS = `<script>
(function () {
  var box = document.getElementById('banner'); if (!box) return;
  var slides = box.querySelectorAll('.bn-slide'), dots = box.querySelectorAll('[data-go]'), at = 0, timer = 0;
  // Credit events: the API grants them once per account; without the API, this browser's mock account.
  // Teaser films open in a pop-up player; closing it stops the film and puts focus back on the banner.
  box.addEventListener('click', function (e) {
    var v = e.target.closest && e.target.closest('[data-video]'); if (!v || typeof HTMLDialogElement !== 'function') return;
    e.preventDefault(); clearInterval(timer);
    var d = document.getElementById('bn-film');
    if (!d) {
      d = document.createElement('dialog'); d.id = 'bn-film'; d.className = 'bn-film'; d.setAttribute('aria-label', '티저 영상');
      d.innerHTML = '<button type="button" class="bn-film-x" aria-label="닫기">×</button><video controls playsinline preload="auto"></video>';
      document.body.appendChild(d);
      d.querySelector('.bn-film-x').addEventListener('click', function () { d.close(); });
      d.addEventListener('click', function (ev) { if (ev.target === d) d.close(); });
      d.addEventListener('close', function () { var f = d.querySelector('video'); f.pause(); if (d._from) d._from.focus(); start(); });
    }
    var film = d.querySelector('video'); film.src = v.getAttribute('data-video'); if (v.getAttribute('data-poster')) film.poster = v.getAttribute('data-poster');
    d._from = v; d.showModal(); var p = film.play(); if (p && p.catch) p.catch(function () {});
  });
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

const PAGE = `<style>.gd{max-width:760px;margin:0 auto}.gd h2{margin:26px 0 8px;font-size:19px}.gd p,.gd li{line-height:1.7}.gd ol,.gd ul{padding-left:20px}.gd .gd-note{background:var(--soft);border-radius:12px;padding:10px 14px;font-size:14px}
.sv{max-width:720px;margin:0 auto}.sv .q{padding:14px 0;border-top:1px solid var(--line)}.sv h3{font-size:16px;margin:0 0 8px}.sv .opts{display:flex;flex-wrap:wrap;gap:6px}.sv .opts label{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line-strong);border-radius:999px;padding:7px 12px;font-size:14px;cursor:pointer;background:var(--surface)}
.sv .opts input{accent-color:var(--navy)}.sv .opts label:has(input:checked){border-color:var(--navy);background:var(--soft);font-weight:700}.sv .nps{display:grid;grid-template-columns:repeat(11,1fr);gap:4px}.sv .nps label{justify-content:center;padding:8px 0;border-radius:10px}.sv .nps input{display:none}
.sv textarea{width:100%;border:1px solid var(--line-strong);border-radius:12px;padding:10px 12px;font:inherit;font-size:16px;min-height:80px}.sv .ends{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:4px}
.sv .sv-sec{font-size:18px;margin:10px 0 12px;padding-top:12px;border-top:2px solid var(--navy);color:var(--accent-strong)}.sv .sv-consent{display:flex;gap:10px;align-items:flex-start;font-size:15px;line-height:1.55;font-weight:700;cursor:pointer;min-height:40px}.sv .sv-consent input{width:20px;height:20px;flex:none;margin-top:2px;accent-color:var(--navy)}</style>`;

/** G-74/G-190: the guide, by what a reader wants to do, matching today's screens (the old alpha screenshots were dropped because they showed screens that no longer exist), with a live tour per page. */
const GUIDE_STEPS: readonly { id: string; title: string; body: string }[] = [
  { id: 'start', title: '시작하기', body: `<ol><li><b>가입</b>: 받은 초대 코드로 한 번 가입하면, 다음부터는 이메일과 비밀번호로 로그인해요.</li><li><b>화면 설정 설문 (약 7분)</b>: 투자 경험, 스타일, 보유 기간, 관심 업종을 알려 주시면 홈의 '오늘 볼 것'과 종목 화면의 보이는 순서와 설명 수준이 바뀌어요. 종목 판단은 모두에게 같아요. 전체 → 화면 설정 설문에서 언제든 고쳐요.</li><li><b>보기 방식</b>: 전체 메뉴의 보기 방식에서 초보 · 단타 · 스윙 · 장기 · 전체 중 고르면 바로 바뀌어요.</li><li><b>화면 밝기</b>: 기본은 어두운 화면이에요. 전체 메뉴(☰) 맨 위 <b>화면</b>에서 밝게 또는 기기 설정을 따라가게 바꿔요.</li><li><b>크레딧</b>: 테스트 계정은 매달 기본 크레딧을 받아요(알파 ${TESTERS.alpha.monthlyCredits}, 베타 ${TESTERS.beta.monthlyCredits}). 리포트 만들기 ${CREDIT_COST.report}, AI 질문 ${CREDIT_COST.question}, 심층 리포트 열기 ${CREDIT_COST.unlock}처럼 쓰기 전에 버튼에 필요한 양이 보여요. 작업이 실패하면 자동으로 돌려드려요.</li></ol>` },
  { id: 'menu', title: '메뉴 길잡이', body: `<ul><li><b>아래 막대</b>(휴대폰): 홈 · 찾기 · 위원회 · 나, 네 탭이 전부예요. 한 화면 안의 칸도 위쪽 줄이 아니라 이 막대에서 바꿔요. 넓은 화면에서는 같은 메뉴가 위쪽에 있어요.</li><li><b>🔔</b>: 가격 알림, 새 리포트, 조건에 걸린 종목, 업데이트 소식이 모여요. 모두 지우기로 한 번에 비워요.</li><li><b>✦ 버튼</b>: 지금 보는 화면에 대해 AI에게 바로 물어요(${CREDIT_COST.question}크레딧).</li><li><b>나</b>: 알림함, 내 리포트, 내 토론, 설정(계정, 화면 밝기, 알림), FAQ·문의, 이 사용법이 있어요.</li></ul>` },
  { id: 'home', title: '홈 화면', body: `<ol><li><b>요약</b>: 오늘 시장 한 줄, 큰 배너(공지·이벤트·설문, 옆으로 밀어 넘겨요), 내 종목 오늘, 시장·위원회·이슈 맛보기.</li><li><b>시장</b>: 증시 → 금리 → 환율 → 원자재 순서로, 숫자마다 한 번씩만 나와요. 카드를 누르면 차트가 크게 열려요.</li><li><b>위원회</b>: 시장 AI 위원회의 오늘 판단이에요.</li><li><b>이슈</b>: 한국·세계 뉴스를 한 순위로 모았어요. 누르면 앱 안에서 AI 3줄 요약과 관련 종목을 보고, 원문으로도 갈 수 있어요.</li><li>네 칸은 휴대폰에서 아래 막대로 바꿔요.</li></ol>` },
  { id: 'report', title: '종목 화면 네 칸', body: `<ul class="gd-tabs"><li><b>위원회</b>: 가격과 등락, 지금 판단, 앞으로 20거래일 가격 지도와 강세·기본·약세 확률, 표결과 토론.</li><li><b>차트</b>: 캔들 차트와 타이밍·전략. 차트를 누르면 크게 열려요.</li><li><b>기업</b>: 종목 정보(오늘 범위·거래대금), 기업 체력 한눈에, 투자 지표, 재무제표, 애널리스트 의견, 수급과 같은 테마.</li><li><b>소식</b>: 뉴스와 공시. 원문으로 바로 가요.</li></ul><p>휴대폰에서는 아래 막대에서 칸을 바꿔요. 리포트가 아직 없는 종목도 같은 칸이 있어요. 계산과 재무·뉴스는 바로 보이고, AI 부분은 리포트를 만들면 채워져요.</p>` },
  { id: 'make', title: '리포트 만들기', body: `<ol><li>종목 화면의 <b>리포트 만들기</b>를 한 번 누르면 버튼에 필요한 크레딧이 나와요. 한 번 더 누르면 시작해요.</li><li>만드는 동안 버튼 안에 물이 차오르듯 진행이 보이고, 지금 단계(접수 → 자료 확인 → 토론·분석 → 작성)와 남은 시간이 버튼에 나와요.</li><li>창을 닫아도 작업은 계속돼요. 다 되면 🔔로 알려 드리고, 버튼은 <b>리포트 보기</b>로 바뀌어요.</li><li>실패하면 쓴 크레딧은 자동으로 돌아와요.</li></ol><p>다른 사람이 만든 리포트나 매일 리포트는 <b>심층 리포트 열기</b>로 볼 수 있어요. 프로·맥스·알파는 추가 차감 없이 열려요.</p>` },
  { id: 'chart', title: '차트', body: `<ol><li>요약의 <b>차트 크게 보기</b>를 누르면 전체 화면 차트가 열려요.</li><li>아래 막대에서 기간을 바꾸고, 일봉·주봉·월봉과 분봉(1·5·15·60분)을 골라요.</li><li><b>지표</b>에서 이동평균, 볼린저, 일목균형, VWAP, 파라볼릭 SAR, RSI, MACD, MFI 등을 켜고, 상세 설정에서 기간과 값을 바꿔요.</li><li><b>그리기</b>로 추세선·수평선·피보나치를 그어요. 그린 선은 이 기기에 남아요.</li></ol>` },
  { id: 'conclusion', title: '시나리오: 조건 가격과 전망 범위', body: `<ol><li><b>큰 가격</b>: 강세 전개를 검토하는 상단 조건 또는 약세 전개를 검토하는 하단 조건이에요. 가격을 건드렸다고 상승·하락이 확정되는 것은 아니에요.</li><li><b>전망 범위</b>: 조건 가격과 별개인 예상 가격대예요. 위원회 전망, AI 분석가 목표가, 변동성 참고 범위 중 어떤 근거인지 함께 확인하세요.</li><li><b>조건과 무효화</b>: 펼치면 성립 근거와 시나리오가 틀렸다고 볼 조건이 나와요. 무효화 가격은 진입 조건이 아니에요.</li></ol><p class="gd-note">분석 날짜와 당시 종가를 먼저 확인하세요. 과거 전망이 지금 가격보다 낮을 수 있어요. 예측 결과는 <a href="scorecard.html">성적표</a>에서 채점돼요.</p>` },
  { id: 'committee', title: 'AI 위원회: 표결과 토론', body: `<ol><li><b>표결</b>: 분석가 6명(추세, 평균회귀, 파동·구조, 거래량·수급, 실적·밸류, 이벤트)과 그 종목 업종을 맡은 전문위원(예: 반도체 전문위원, 업종을 알 때만), 데스크 5곳이 각자 강세·중립·약세와 확신도, 근거 한 줄을 내요. 좌석 색은 다수 쪽을 따라가요.</li><li><b>토론</b>: 미리 보기를 누르면 채팅방처럼 전체 화면으로 열려요. 위원들이 서로 반박하고, 마지막에 레드팀이 합의한 것과 풀리지 않은 것을 정리해요.</li><li><b>근거 번호</b>(P1, Q1, N8…)를 누르면 그 근거가 펼쳐지고 원문으로 갈 수 있어요.</li><li><b>토론에 참여</b>: 토론 아래 질문을 적고, 입력창 옆 <b>+</b>로 위원회 전체나 전문가(반도체, 2차전지, 매크로… 직접 만든 전문가도)를 골라 물어요.</li></ol>` },
  { id: 'find', title: '찾기와 필터', body: `<ol><li><b>종류</b>: 아래 막대에서 주식 · 미국 · ETF · 코인 · 테마 · 공시를 골라요. 필터 시트에서 시장(코스피·코스닥), 정렬, 미리 만든 조건, 저장을 한곳에서 해요.</li><li><b>미리 만든 조건</b>: 기술 점수 상위, 바닥권 거래량 폭발, 매집 흔적 같은 조건을 눌러 바로 봐요.</li><li><b>직접 조합</b>: 항목·비교·값으로 조건을 더하고, 모두 맞을 때 또는 하나라도 맞을 때를 골라요.</li><li><b>AI 조건</b>: “아직 많이 안 올랐는데 거래량이 터진 코스닥 종목”처럼 적고 <b>조건 만들기</b>를 누르면, 조건이 말로 풀린 제안 카드가 나와요. <b>이 조건으로 찾기</b>를 누르면 적용되고, 아래에서 고칠 수 있어요.</li><li><b>저장</b>: 저장한 조건은 홈의 내 조건에 걸린 종목에 매일 뜨고, 새로 걸리면 알림으로도 받아요.</li></ol>` },
  { id: 'us', title: '미국 주식', body: `<ul><li>나스닥·뉴욕·아멕스에 상장된 종목을 모두 검색할 수 있어요.</li><li>시가총액 상위(나스닥·뉴욕 각 300개, 아멕스 40개)와 주요 ETF는 매일 미리 계산해요. 그 밖의 종목은 여는 순간 가격을 가져와 계산해요.</li><li>가격은 달러, 날짜는 미국 현지 기준이에요. AI 리포트는 SEC 공시·내부자 거래·재무와 영문 뉴스를 근거로 써요.</li></ul>` },
  { id: 'alerts', title: '관심과 알림', body: `<ol><li>어디서든 ☆를 누르면 <b>관심</b>에 모여요. 로그인하면 다른 기기에서도 보여요.</li><li>종목 화면의 🔔로 <b>가격 알림</b>을 걸어요(위로 넘을 때, 아래로 내려갈 때).</li><li>전체 → <b>알림 설정</b>에서 종류별로 켜고 끄고, 휴대폰 푸시와 조용한 시간을 정해요.</li></ol>` },
  { id: 'score', title: '성적표', body: `<p>AI 위원회의 판단과 예측은 만든 날 그대로 남고, 나중에 실제 가격으로 채점돼요. <a href="scorecard.html">성적표</a>에서 맞힌 비율과, 그대로 따라 했다면 어땠을지(모의투자)를 볼 수 있어요.</p>` },
  { id: 'feedback', title: '의견 보내기', body: `<p>화면 곳곳의 👍👎, <a href="survey.html?k=weekly">주간 설문(1분)</a>, <a href="faq.html#ask">1:1 문의</a>로 알려 주세요. 바뀐 점은 업데이트 알림으로 알려 드려요.</p>` },
];

export function renderGuide(): string {
  const toc = GUIDE_STEPS.map((s, i) => `<a href="#g-${s.id}">${i + 1}. ${s.title}</a>`).join('');
  const steps = GUIDE_STEPS.map((s, i) => `<section class="gd-step" id="g-${s.id}"><h2><span class="gd-no">${i + 1}</span>${s.title}</h2><div class="gd-text">${s.body}</div></section>`).join('');
  const body = `${PAGE}<section class="hero"><div class="hero-main"><div class="eyebrow"><span>알파 테스트</span><span>5분</span></div><h1>그노몬 사용법</h1><p>그노몬(GNOMON)은 공개 데이터로 계산한 신호와 AI 위원회의 해설을 근거와 함께 보여 주는 리서치 서비스예요. 처음이라면 아래 네 가지만 해 보세요.</p>
<ol class="gd-quick"><li><b>검색</b>홈 검색창에 관심 있는 종목을 적어요.</li><li><b>요약 읽기</b>종목 화면의 요약 탭에서 가격, 예측 범위, 최신 소식을 봐요.</li><li><b>☆ 관심</b>계속 볼 종목은 ☆로 모아요.</li><li><b>리포트</b>궁금하면 리포트 만들기로 AI 위원회를 불러요.</li></ol>
<p class="hero-line">직접 눌러 보며 익히려면 둘러보기를 시작하세요.</p>
<div class="gd-tours"><a class="btn-primary" href="index.html?tour=1">홈 둘러보기 시작 ›</a><a class="btn-ghost" href="000660/index.html?tour=1">종목 리포트 둘러보기 ›</a><a class="btn-ghost" href="screener.html?tour=1">검색 조건 둘러보기 ›</a></div></div></section>
<section class="block gd"><nav class="gd-toc" aria-label="목차">${toc}</nav>${steps}
<p class="gd-note">그노몬의 모든 내용은 계산 결과와 시나리오 해설이고, 투자 권유가 아니에요. 투자 판단과 결과의 책임은 투자자 본인에게 있어요.</p></section>
<style>.gd{max-width:980px}.gd-tours{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.gd-tours a{display:inline-flex;text-decoration:none}.gd-toc{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}.gd-toc a{border:1px solid var(--line-strong);background:var(--surface);border-radius:999px;padding:5px 11px;font-size:13px;font-weight:700;text-decoration:none;color:var(--fg)}
.gd-step{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:18px 20px;margin:14px 0;scroll-margin-top:90px}.gd-step h2{display:flex;align-items:center;gap:10px;margin:0 0 12px}.gd-no{flex:none;display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--accent-soft);color:var(--accent-strong);font-size:14px;font-weight:800}.gd-text ol,.gd-text ul{padding-left:20px;margin:0}.gd-text li{line-height:1.75}.gd-text p{line-height:1.75}.gd-quick{list-style:none;counter-reset:q;margin:14px 0 4px;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.gd-quick li{counter-increment:q;display:flex;flex-direction:column;gap:4px;padding:12px 14px;border-radius:14px;background:var(--soft);border:1px solid var(--line);font-size:13.5px;line-height:1.55;color:var(--fg2)}.gd-quick li::before{content:counter(q);font-size:12px;font-weight:800;color:var(--accent-strong)}.gd-quick b{font-size:15px;color:var(--fg)}.gd-text li{margin:6px 0}
@media (max-width:820px){.gd-quick{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>`;
  return shell('', '사용법 · 그노몬', body, {});
}

type Q = { key: string; title: string; type: 'one' | 'many' | 'text' | 'nps' | 'consent'; options?: readonly string[]; note?: string; section?: string };
export const SURVEYS: Record<'midterm' | 'weekly' | 'wrapup', { title: string; lead: string; questions: readonly Q[] }> = {
  midterm: {
    title: '알파 중간 설문', lead: '지금까지 써 보신 소감을 들려주세요. 약 5분 걸려요. 답은 서비스 개선에만 써요.',
    questions: [
      { key: 'nps', title: '투자하는 친구에게 그노몬을 추천할 만한가요?', type: 'nps' },
      { key: 'use', title: '가장 자주 쓴 기능은?', type: 'many', note: '여러 개 골라도 돼요', options: ['홈 화면', '종목 검색', '종목 리포트', 'AI 위원회', '매일 AI 리포트', '차트', '스크리너', 'ETF·코인', 'AI 질문', '관심 종목·알림', '성적표·모의투자'] },
      { key: 'best', title: '가장 쓸모 있었던 것 하나와 이유', type: 'text' },
      { key: 'hard', title: '어렵거나 헷갈렸던 화면·용어', type: 'text' },
      { key: 'trust', title: 'AI 해설을 얼마나 믿을 만하다고 느꼈어요?', type: 'one', options: ['전혀', '조금', '보통', '꽤', '매우'] },
      { key: 'length', title: 'AI 위원회 리포트 길이는 어땠어요?', type: 'one', options: ['너무 짧아요', '적당해요', '조금 길어요', '너무 길어요'] },
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
  // G-241: the last alpha survey, with the closed-beta application at the end (wrapup.ts).
  wrapup: {
    title: '알파 마무리 설문', lead: `알파가 ${WRAPUP.end}에 끝나요. 3분이면 돼요. 답을 보고 베타에 무엇을 남기고 뺄지 정해요.`,
    questions: [
      { key: 'nps', title: '알파를 써 보니, 투자하는 친구에게 그노몬을 추천할 만한가요?', type: 'nps' },
      // G-280: the 4.0.0 screen, why people came back, and trust in the committee's odds (beta goals: 20% return).
      { key: 'screen', title: '새 화면(4.0.0)은 어땠어요?', type: 'one', options: ['훨씬 좋아요', '좋아요', '비슷해요', '예전이 나아요', '아직 못 봤어요'] },
      { key: 'used', title: '알파 기간에 써 본 것', type: 'many', note: '여러 개 골라도 돼요', options: ['홈', '찾기(검색)', '위원회', '종목 차트', '종목 소식', '매일 AI 리포트', 'AI 질문', '관심 종목·알림', '성적표', '공시 레이더'] },
      { key: 'return', title: '그노몬을 다시 열게 된 이유, 또는 안 열게 된 이유', type: 'text' },
      { key: 'trust', title: '위원회의 확률과 시나리오, 얼마나 믿을 만했어요?', type: 'one', options: ['전혀', '조금', '보통', '꽤', '매우'] },
      { key: 'keep', title: '베타에도 꼭 남겨야 할 것 하나와 이유', type: 'text' },
      { key: 'cut', title: '빼거나 줄여도 될 것', type: 'text' },
      { key: 'hard', title: '끝까지 헷갈렸던 화면이나 용어', type: 'text' },
      { key: 'beta', section: '클로즈드 베타 신청', title: '11월 20일부터 모집하는 클로즈드 베타에 참여할래요?', type: 'one', note: '알파에 참여하신 분은 모집 때 먼저 초대해요. 신청만으로 계정이 바뀌지는 않아요.', options: [BETA_YES, '이번엔 괜찮아요'] },
      { key: 'contact', title: '가입 이메일 말고 연락받을 곳 (선택)', type: 'text', note: '비워 두면 가입 이메일로 연락드려요.' },
      { key: 'consent', title: '베타 안내 연락을 위해 이메일과 적어 주신 연락처를 베타 모집이 끝날 때까지 보관하는 데 동의해요', type: 'consent', note: '베타를 신청할 때만 필요해요. 계정을 지우면 함께 지워져요.' },
    ],
  },
};

export function renderSurvey(): string {
  const body = `${PAGE}<section class="card form-card sv"><div class="eyebrow"><span>알파 테스트</span><span id="sv-kind"></span></div><h1 id="sv-title">설문</h1><p class="muted" id="sv-lead"></p>
<div id="sv-login" hidden style="background:var(--up-soft);color:var(--up-strong);border-radius:12px;padding:10px 12px;margin:8px 0">설문은 로그인한 뒤에 할 수 있어요. <a href="login.html?return=survey.html">로그인</a></div>
<form id="sv"></form><div id="out" aria-live="polite"></div></section>`;
  const script = `<script>
(function () {
  var S = ${JSON.stringify(SURVEYS)}, k = new URLSearchParams(location.search).get('k'), s = S[k] || S.weekly; k = S[k] ? k : 'weekly';
  var esc = function (v) { return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  document.getElementById('sv-title').textContent = s.title; document.getElementById('sv-lead').textContent = s.lead; document.title = s.title + ' · 그노몬';
  var form = document.getElementById('sv');
  form.innerHTML = s.questions.map(function (q, i) {
    var head = (q.section ? '<h2 class="sv-sec">' + esc(q.section) + '</h2>' : '') + '<h3>' + (i + 1) + '. ' + esc(q.title) + '</h3>' + (q.note ? '<div class="muted small">' + esc(q.note) + '</div>' : '');
    if (q.type === 'consent') return '<div class="q">' + (q.section ? '<h2 class="sv-sec">' + esc(q.section) + '</h2>' : '') + '<label class="sv-consent"><input type="checkbox" name="' + q.key + '"> <span>' + esc(q.title) + '</span></label>' + (q.note ? '<div class="muted small">' + esc(q.note) + '</div>' : '') + '</div>';
    if (q.type === 'text') return '<div class="q">' + head + '<textarea name="' + q.key + '" maxlength="800"></textarea></div>';
    if (q.type === 'nps') { var n = ''; for (var v = 0; v <= 10; v++) n += '<label><input type="radio" name="' + q.key + '" value="' + v + '">' + v + '</label>'; return '<div class="q">' + head + '<div class="opts nps">' + n + '</div><div class="ends"><span>전혀 아님</span><span>꼭 추천</span></div></div>'; }
    return '<div class="q">' + head + '<div class="opts">' + q.options.map(function (o) { return '<label><input type="' + (q.type === 'one' ? 'radio' : 'checkbox') + '" name="' + q.key + '" value="' + esc(o) + '">' + esc(o) + '</label>'; }).join('') + '</div></div>';
  }).join('') + '<button class="btn-primary" type="submit">보내기</button>';
  var out = document.getElementById('out');
  (window.GNM && GNM.ready ? GNM.ready : Promise.resolve(null)).then(function (me) { if (!me) { var box = document.getElementById('sv-login'); box.querySelector('a').href = 'login.html?return=' + encodeURIComponent('survey.html?k=' + k); box.hidden = false; form.querySelector('button').disabled = true; } });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var a = { page: 'survey' };
    s.questions.forEach(function (q) {
      if (q.type === 'text') a[q.key] = form[q.key].value.trim();
      else if (q.type === 'consent') a[q.key] = form[q.key].checked;
      else if (q.type === 'many') a[q.key] = [].map.call(form.querySelectorAll('[name="' + q.key + '"]:checked'), function (c) { return c.value; });
      else { var c = form.querySelector('[name="' + q.key + '"]:checked'); a[q.key] = c ? (q.type === 'nps' ? Number(c.value) : c.value) : null; }
    });
    if (a.nps === null) { out.innerHTML = '<div class="msg-err">첫 번째 질문(0~10)을 골라 주세요.</div>'; return; }
    if (k === 'wrapup' && a.beta === ${JSON.stringify(BETA_YES)} && !a.consent) { out.innerHTML = '<div class="msg-err">베타를 신청하려면 마지막 연락처 보관 동의에 체크해 주세요.</div>'; return; }
    GNM.call('POST', '/survey', { kind: k, answers: a }).then(function (r) {
      if (r.error) { out.innerHTML = '<div class="msg-err"></div>'; out.firstChild.textContent = r.message; return; }
      if (k === 'wrapup') { try { localStorage.setItem('gnm-pop-wrap', '9e15'); } catch (e) {} }
      form.hidden = true; out.innerHTML = k === 'wrapup' ? '<div class="msg-ok">고마워요! 알파에 함께해 주셔서 정말 고마워요.' + (a.beta === ${JSON.stringify(BETA_YES)} ? ' 베타 신청도 받았어요. 11월 20일 모집을 열 때 이메일로 먼저 알려 드릴게요.' : '') + ' <a href="index.html">홈으로</a></div>' : '<div class="msg-ok">고마워요! 보내 주신 내용은 다음 개선에 반영하고, 바뀐 점은 공지로 알려 드릴게요. <a href="index.html">홈으로</a></div>';
    });
  });
})();
</script>`;
  return shell('', '설문 · 그노몬', body, { scripts: script, noFeedback: true });
}

export function renderUpdates(): string { return shell('','업데이트 기록 · 그노몬',`<div class="pg-title"><h1>업데이트 기록</h1></div><section class="hero"><p>큰 변화는 첫 자리, 중간 변화는 둘째 자리, 작은 수정은 셋째 자리를 올려요.</p><p class="muted">v0.0.0~v1.4.0은 기존 커밋을 기능별로 묶은 회고 기록입니다. 당시 배포 태그와 일대일 대응하지 않습니다. 현재 버전은 v${VERSION}이며 공개된 이 화면의 릴리스 노트와 사용법을 함께 확인해 주세요.</p></section><section class="card block"><h2>사용 순서</h2><ol><li><b>분석 보기</b>: 리포트가 없는 종목도 동일한 화면 구조로 열립니다. 미생성 AI 분석은 같은 위치에 잠금으로 남고, 차트와 기술 계산은 먼저 볼 수 있어요. 기술의 피보나치·볼린저·RSI·MACD·ATR을 누르면 해당 지표를 켠 차트로 이동하고, 기술로 돌아가기로 복귀할 수 있어요. 코인은 차트에서 일봉 또는 1·5·15·60분봉을 선택하세요. 시나리오를 펼치면 미니 차트를 보고, 차트 탭에서는 강세·기본·약세를 비교할 수 있어요. 수급 탭에서 거래량·OBV·매집/분산을 확인하세요.</li><li><b>리포트 만들기</b>: 생성 버튼을 누르면 바로 작업이 시작됩니다. 기존 심층 리포트는 요금제 또는 개별 열람 권한에 따라 열리며, 미권한 영역은 잠금으로 표시됩니다.</li><li><b>토론 참여</b>: AI 위원회 토론 바로 아래 질문을 적고, 입력창 옆 + 버튼으로 위원회 전체 또는 전문가를 고르세요. 보내기 전에 표시된 크레딧 비용을 확인하세요.</li><li><b>AI 검색 조건</b>: 스크리너에서 원하는 종목의 특징을 문장으로 적으세요. AI가 제안한 조건을 확인·수정한 뒤 적용하고, 다시 사용할 조건은 저장하세요.</li><li><b>진행 상태</b>: 채팅·검색·필터·탭 준비에 실제 대기가 길어질 때 Thinking Orbs가 표시됩니다. 즉시 준비되는 화면은 바로 볼 수 있습니다.</li></ol><p><a href="guide.html">전체 사용법 보기</a></p></section><section class="card block"><h2>준비 중 · 기업 이벤트와 테마</h2><p>실적 발표·배당·임원/주요주주 공시와 거래대금 비교부터 연결합니다. 발표 전 예상치 이력에 기반한 분기 서프라이즈와 근거가 확인된 테마 탐색은 후속 작업입니다. 아직 완료된 릴리스에 포함하지 않습니다.</p></section>${(()=>{const rel=([v,date,text]:readonly [string,string,string])=>`<section class="card block rel"><h2>v${v} <small>${date}</small></h2><ul class="rel-list">${noteItems(text).map((x)=>`<li>${x}</li>`).join('')}</ul></section>`;return RELEASES.slice(0,3).map(rel).join('')+(RELEASES.length>3?`<details class="rel-old"><summary>지난 업데이트 ${RELEASES.length-3}개 보기</summary>${RELEASES.slice(3).map(rel).join('')}</details>`:'');})()}`,{}); }
