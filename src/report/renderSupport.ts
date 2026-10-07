// FAQ·문의 (support) and the destination page for the 509OP mock ad.

import { shell } from './renderHtml.js';
import { CREDIT_COST } from './plans.js';
import { esc } from './html.js';


export const FAQ: readonly { group: string; items: readonly [string, string][] }[] = [
  { group: '처음 쓰실 때', items: [
    ['그노몬은 어떤 서비스예요?', '주식·ETF·코인의 가격, 수급, 실적, 공시·뉴스를 한 화면에 모으고, AI 위원회가 강세·기본·약세 시나리오와 근거를 정리해 주는 리서치 서비스예요. 매수·매도를 권하지 않아요.'],
    ['어디서부터 보면 돼요?', '홈 검색창에서 종목을 찾고, 리포트의 맨 위 시나리오 카드부터 보세요. 줄을 누르면 시나리오의 근거와 무효화 조건이 펼쳐져요. 화면 위를 따라가는 사용법은 ☰ 메뉴 → 사용법에 있어요.'],
    ['홈 화면이 사람마다 달라요?', '맞춤 설문과 ☰ 메뉴의 \'내 보기 방식\'에 따라 오늘 볼 것의 순서, 차트 기본 지표, AI 위원회에서 먼저 보이는 위원이 바뀌어요.'],
  ] },
  { group: '시나리오와 AI 위원회', items: [
    ['강세·약세 시나리오의 가격은 뭐예요?', '위원회가 앞으로 20거래일 동안 그 시나리오가 맞았을 때 예상하는 가격대예요. "이 가격을 넘으면 오른다"는 신호가 아니라, 그 전개가 펼쳐졌을 때 도달할 수 있는 범위예요. 시나리오가 틀렸다고 볼 조건은 펼친 화면의 \'무효화 조건\'에 따로 적혀 있어요.'],
    ['확률은 어떻게 정해요?', '지금 모인 근거로 본 위원회의 추정이에요. 기록해 두었다가 실제 결과로 채점하고, 성적표에서 맞힌 비율을 확인할 수 있어요.'],
    ['토론에 질문하거나 전문가를 부를 수 있어요?', `AI 위원회 탭의 토론 아래 입력창에서 위원회에 질문(일반 질문 크레딧)하거나, + 버튼으로 전문가를 초청(${CREDIT_COST.invite}크레딧, 프로 이상)할 수 있어요. 내가 한 질문과 답은 이 기기에 저장돼서 다시 들어와도 보여요.`],
  ] },
  { group: '크레딧과 요금제', items: [
    ['크레딧은 어디에 써요?', 'AI 질문, 전문가 초청, 심층 리포트 열기·즉시 생성에 써요. 쓰기 전에 필요한 크레딧이 먼저 보여요.'],
    ['리포트 생성에 실패하면요?', '쓴 크레딧은 자동으로 돌려드려요. 실패 이유(혼잡·시간 초과 등)가 함께 표시되고, 잠시 후 다시 요청할 수 있어요.'],
    ['알파 기간에 결제가 되나요?', '아니요. 알파 기간의 요금제와 결제 화면은 시험용이고, 실제로 돈이 나가지 않아요.'],
  ] },
  { group: '데이터와 개인정보', items: [
    ['가격은 실시간이에요?', '장중에는 화면의 가격이 몇 초마다 새로 고쳐져요. 리포트 본문의 분석은 리포트를 만든 날의 종가 기준이에요.'],
    ['내 기록은 어디에 저장돼요?', '관심 종목·보기 방식·AI 질문 기록은 이 브라우저에, 계정·크레딧·설문은 서버에 저장돼요. 내 계정에서 내보내기와 탈퇴를 할 수 있어요.'],
    ['광고는 뭐예요?', '알파 기간에 광고 자리를 시험하는 가상 광고예요. 광고를 눌러도 결제나 개인정보 수집은 일어나지 않아요.'],
  ] },
];

const KINDS = [['bug', '오류 신고'], ['idea', '기능 제안'], ['data', '데이터가 이상해요'], ['account', '계정·크레딧'], ['ad', '광고·제휴'], ['etc', '기타']] as const;

export function renderSupport(): string {
  const faq = FAQ.map((g) => `<section class="sp-group"><h2>${esc(g.group)}</h2>${g.items.map(([q, a]) => `<details class="sp-q"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>`).join('');
  const body = `<style>
.sp{max-width:820px;margin:16px auto 32px}.sp-hero{padding:22px}.sp-hero h1{font-size:24px;margin:2px 0 6px}.sp-hero p{margin:0;color:var(--fg2);line-height:1.6}.sp-tabs{display:flex;gap:8px;margin:14px 0}.sp-tabs a{flex:1;text-align:center;padding:10px;border-radius:12px;border:1px solid var(--line-strong);font-weight:700;background:#fff}
.sp-search{width:100%;padding:12px 14px;border:1.5px solid var(--line-strong);border-radius:12px;font:inherit;margin-bottom:6px}
.sp-group{margin-top:18px}.sp-group h2{font-size:15px;color:var(--muted);margin:0 0 8px}.sp-q{background:#fff;border:1px solid var(--line);border-radius:12px;margin-bottom:8px}.sp-q summary{padding:13px 14px;font-weight:700;cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:10px}.sp-q summary::after{content:'+';color:var(--muted);font-weight:400}.sp-q[open] summary::after{content:'−'}.sp-q p{margin:0;padding:0 14px 14px;line-height:1.7;color:var(--fg2)}.sp-q[hidden]{display:none}
.sp-form{margin-top:26px;padding:20px}.sp-form h2{margin:0 0 4px;font-size:19px}.sp-kinds{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.sp-kinds label{display:inline-flex}.sp-kinds input{position:absolute;opacity:0}.sp-kinds span{padding:7px 12px;border:1px solid var(--line-strong);border-radius:999px;font-size:13.5px;cursor:pointer}.sp-kinds input:checked+span{background:var(--navy);color:#fff;border-color:var(--navy)}.sp-kinds input:focus-visible+span{outline:2px solid var(--accent)}
.sp-form textarea{width:100%;min-height:120px;border:1.5px solid var(--line-strong);border-radius:12px;padding:12px;font:inherit;resize:vertical}.sp-row{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap}.sp-row button{padding:11px 18px;border:0;border-radius:12px;background:var(--navy);color:#fff;font:inherit;font-weight:700;cursor:pointer}.sp-msg{font-size:13.5px;color:var(--muted)}.sp-msg.ok{color:#0f766e;font-weight:700}
</style><div class="sp">
<section class="card sp-hero"><div class="pl-k">고객 지원</div><h1>자주 묻는 질문 · 문의</h1><p>궁금한 걸 먼저 찾아보고, 없으면 아래에서 바로 문의해 주세요. 알파 기간에는 운영자가 직접 읽고 답해요.</p></section>
<nav class="sp-tabs" aria-label="지원 메뉴"><a href="#faq">FAQ</a><a href="#ask">1:1 문의</a><a href="guide.html">사용법</a></nav>
<div id="faq"><input class="sp-search" type="search" placeholder="질문 검색 (예: 크레딧, 시나리오)" aria-label="FAQ 검색">${faq}<p class="muted small" id="sp-none" hidden>찾는 질문이 없어요. 아래에서 문의해 주세요.</p></div>
<form class="card sp-form" id="ask"><h2>1:1 문의 · Q&amp;A</h2><p class="muted small">로그인한 계정으로 접수돼요. 답변은 계정 알림(🔔)으로 드려요.</p>
<div class="sp-kinds" role="radiogroup" aria-label="문의 종류">${KINDS.map(([k, l], i) => `<label><input type="radio" name="kind" value="${k}"${i === 0 ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
<textarea name="text" maxlength="2000" placeholder="어떤 화면에서 무엇이 궁금하거나 불편했는지 적어 주세요." aria-label="문의 내용"></textarea>
<div class="sp-row"><span class="sp-msg" id="sp-msg">최대 2,000자</span><button type="submit">문의 보내기</button></div></form>
</div><script>
(function(){
 var s=document.querySelector('.sp-search'),qs=[].slice.call(document.querySelectorAll('.sp-q'));
 s.addEventListener('input',function(){var t=s.value.trim(),n=0;qs.forEach(function(q){var on=!t||q.textContent.indexOf(t)>=0;q.hidden=!on;if(on)n++;if(t&&on)q.open=true;});document.querySelectorAll('.sp-group').forEach(function(g){g.hidden=!g.querySelector('.sp-q:not([hidden])');});document.getElementById('sp-none').hidden=n>0;});
 var f=document.getElementById('ask'),msg=document.getElementById('sp-msg');
 f.addEventListener('submit',function(e){e.preventDefault();var G=window.GNM,text=f.text.value.trim();
  if(text.length<2){msg.textContent='내용을 적어 주세요.';f.text.focus();return;}
  if(!G||!G.me){location.href='login.html?return=faq.html%23ask';return;}
  var b=f.querySelector('button');b.disabled=true;msg.className='sp-msg';msg.textContent='보내는 중…';
  G.call('POST','/feedback',{target:'inquiry:'+f.kind.value,page:'faq.html',text:text}).then(function(r){b.disabled=false;if(r&&r.error){msg.textContent=r.message||'보내지 못했어요.';return;}f.text.value='';msg.className='sp-msg ok';msg.textContent='접수됐어요. 답변은 알림으로 드릴게요.';}).catch(function(){b.disabled=false;msg.textContent='연결을 확인해 주세요.';});
 });
})();
</script>`;
  return shell('', 'FAQ·문의 | GNOMON', body, { noFeedback: true });
}

const BENEFITS: readonly [string, string, string][] = [
  ['💰', '급여·수당', '계급과 복무 조건에 따른 급여와 각종 수당이 있어요.'],
  ['🏠', '주거 지원', '자격과 배정 여건에 따라 간부 숙소·관사 등을 지원받을 수 있어요.'],
  ['🎓', '교육·성장', '직무 교육과 자기계발 기회가 주어져요.'],
  ['🏥', '군 복지', '이용 자격에 따라 군 복지시설을 이용할 수 있어요.'],
  ['📈', '장기 경력', '장기복무로 선발되면 군 전문 경력을 이어 갈 수 있어요.'],
];

/** Destination for the 509OP mock ad: the benefits, clearly marked as a mock with the official source to check. */
export function render509(): string {
  const body = `<style>
.op{max-width:860px;margin:16px auto 32px}.op-hero{border-radius:22px;padding:30px 26px;background:linear-gradient(135deg,#0f3d3a,#1f6b5f);color:#fff}.op-hero small{letter-spacing:.12em;opacity:.8}.op-hero h1{font-size:clamp(24px,4vw,34px);line-height:1.35;margin:10px 0}.op-hero p{margin:0;line-height:1.7;opacity:.92}.op-roles{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.op-roles span{border:1px solid rgba(255,255,255,.45);border-radius:999px;padding:6px 12px;font-size:13.5px}
.op h2{font-size:19px;margin:26px 0 12px}.op-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}.op-b{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px}.op-b i{font-style:normal;font-size:24px}.op-b b{display:block;font-size:16px;margin:8px 0 4px}.op-b p{margin:0;color:var(--fg2);line-height:1.6;font-size:14.5px}
.op-steps{counter-reset:s;list-style:none;padding:0;margin:0;display:grid;gap:8px}.op-steps li{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px 12px 48px;position:relative;line-height:1.55}.op-steps li::before{counter-increment:s;content:counter(s);position:absolute;left:14px;top:12px;width:24px;height:24px;border-radius:50%;background:#1f6b5f;color:#fff;font-weight:800;font-size:13px;display:grid;place-items:center}
.op-note{margin-top:22px;padding:14px 16px;border-radius:12px;background:#fff8e6;border:1px solid #f1d58a;font-size:13.5px;line-height:1.7}.op-back{display:inline-block;margin-top:16px;text-decoration:underline}
</style><div class="op">
<section class="op-hero"><small>509OP · 가상 광고</small><h1>상황을 판단하고, 경계를 이어가는<br>당신의 다음 커리어</h1><p>육군 부사관(상황간부·영상간부) 지원을 소개하는 광고 자리 시험용 페이지예요.</p><div class="op-roles"><span>상황간부</span><span>영상간부</span></div></section>
<h2>지원 혜택</h2><div class="op-grid">${BENEFITS.map(([i, t, d]) => `<div class="op-b"><i aria-hidden="true">${i}</i><b>${t}</b><p>${d}</p></div>`).join('')}</div>
<h2>하는 일</h2><div class="op-grid"><div class="op-b"><b>상황간부</b><p>부대 상황을 실시간으로 파악하고 보고·전파해 지휘 판단을 돕는 역할이에요.</p></div><div class="op-b"><b>영상간부</b><p>감시 장비 영상을 분석해 경계 작전의 빈틈을 줄이는 역할이에요.</p></div></div>
<h2>지원 절차 (일반적인 흐름)</h2><ol class="op-steps"><li>모집 공고에서 자격 요건과 일정 확인</li><li>온라인 지원서 접수</li><li>필기·체력·면접 등 선발 평가</li><li>최종 합격 후 양성 교육</li></ol>
<p class="op-note"><b>꼭 확인하세요.</b> 이 페이지는 GNOMON 알파 기간의 광고 자리 시험용 가상 광고예요. 실제 지원 자격, 혜택, 일정은 해마다 바뀔 수 있으니 반드시 육군 모집 공식 안내에서 확인해 주세요. 이 페이지는 지원서를 받거나 개인정보를 모으지 않아요.</p>
<a class="op-back" href="index.html">GNOMON 홈으로 돌아가기</a></div>`;
  return shell('', '509OP 육군 부사관 지원 | 광고', body, { chat: false, noFeedback: true, ads: false });
}
