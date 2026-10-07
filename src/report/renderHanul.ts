import { shell } from './renderHtml.js';

const PROJECTS = [
  { name: 'CURIA', category: '시장 리서치', text: '주식·ETF·코인의 가격, 수급, 실적과 뉴스를 한곳에서 읽는 리서치 서비스입니다. 기술 지표와 AI 위원회의 서로 다른 관점을 비교하고, 판단의 근거를 확인합니다.' },
  { name: 'BLACK ORACLE', category: 'AI 투자 연구', text: '시장에 대한 가설을 세우고, 근거와 시나리오를 기록하며 검증하는 AI 투자 연구 프로젝트입니다. 여러 AI의 판단과 전략 실험을 연결해 예측이 맞았는지, 어디서 틀렸는지 추적합니다.' },
  { name: 'DAYTAPE', category: '일상과 실행', text: '출석, 퀘스트, 랭킹을 통해 일상의 작은 실천을 이어가는 기록 프로젝트입니다. 해야 할 일을 지속할 수 있는 경험으로 바꾸는 것을 목표로 합니다.' },
  { name: 'SHADOW COMPUTE', category: '산업과 금융 연구', text: 'AI 인프라를 둘러싼 전력, 데이터센터와 금융의 연결을 연구합니다. 설비투자가 산업과 자금 흐름에 어떤 영향을 주는지 데이터와 계량 분석으로 살펴봅니다.' },
] as const;

/** An internal destination for the HANUL mock corporate ad. */
export function renderHanul(): string {
  const body = `<style>
.version-banner{display:none}
.hanul{max-width:1040px;margin:18px auto 32px}.hanul-intro{background:#000;color:#fff;border-radius:22px;padding:40px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:36px;align-items:center}.hanul-intro img{width:100%;height:auto;display:block}.hanul-label{font-size:14px;letter-spacing:.12em;color:#c5c5c5}.hanul h1{font-family:inherit;font-size:clamp(26px,3vw,36px);line-height:1.4;margin:16px 0}.hanul-intro p{font-size:16px;line-height:1.8;color:#d1d1d1;margin:0}.hanul-credit{display:block;margin-top:18px;font-size:14px;color:#bcbcbc}.hanul-heading{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;margin:32px 0 16px}.hanul-heading h2{font-size:24px;margin:0}.hanul-heading a,.hanul-return{font-size:16px;text-decoration:underline;text-underline-offset:4px}.hanul-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.hanul-project{padding:26px;border:1px solid var(--line);border-radius:18px;background:var(--card,#fff)}.hanul-category{font-size:14px;color:var(--muted)}.hanul-project h3{font-family:inherit;font-size:23px;line-height:1.4;margin:10px 0 12px;overflow-wrap:anywhere}.hanul-project p{font-size:16px;line-height:1.85;margin:0;color:var(--fg2)}.hanul-note{font-size:14px;line-height:1.8;color:var(--muted);margin:24px 0 16px}.hanul-return{display:inline-block;padding:10px 0}.hanul .hanul-intro,.hanul-project{min-width:0}
@media(max-width:820px){.hanul-intro{grid-template-columns:minmax(0,1fr);padding:26px 22px;gap:20px}.hanul-intro img{max-width:360px}.hanul-grid{grid-template-columns:minmax(0,1fr)}.hanul-project{padding:22px}.hanul-heading{margin-top:26px}.hanul h1{font-size:26px}}
</style><div class="hanul">
<section class="hanul-intro" aria-labelledby="hanul-title">
<img src="assets/hanul-logo.jpg" alt="HANUL by Hanseo Kim" width="1536" height="512">
<div><span class="hanul-label">IDEAS INTO PROJECTS</span><h1 id="hanul-title">아이디어를 실험하고,<br>제품으로 만듭니다.</h1><p>HANUL은 김한서의 프로젝트를 모아 소개하는 개인 브랜드입니다. AI와 데이터를 활용한 리서치, 투자 연구, 일상의 실행 도구를 만듭니다.</p><span class="hanul-credit">by Hanseo Kim</span></div>
</section>
<section aria-labelledby="hanul-projects"><div class="hanul-heading"><h2 id="hanul-projects">만들고 연구하는 것들</h2><a href="index.html">큐리아로 돌아가기</a></div>
<div class="hanul-grid">${PROJECTS.map((p) => `<article class="hanul-project"><span class="hanul-category">${p.category}</span><h3>${p.name}</h3><p>${p.text}</p></article>`).join('')}</div></section>
<p class="hanul-note">이 페이지는 HANUL 가상 기업 광고에 연결된 개인 프로젝트 소개입니다.</p>
<a class="hanul-return" href="index.html">CURIA 홈</a></div>`;
  return shell('', 'HANUL | 프로젝트 소개', body, { chat: false, noFeedback: true, bottomNav: false, ads: false });
}
