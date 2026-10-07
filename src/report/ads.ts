// A small ad strip at the top of every page except home (home has the large banner carousel).
// Alpha: mock ads that test the ad slot; one is picked per page view, and × hides it for the session.

import { esc } from './html.js';
const ADS: readonly { brand: string; text: string; href: string; cta: string; tone: string }[] = [
  { brand: 'HANUL', text: '아이디어를 실험하고, 제품으로 만듭니다.', href: 'hanul.html', cta: '보기', tone: 'ink' },
  { brand: '509OP', text: '육군 부사관 지원 · 상황간부 · 영상간부', href: '509op.html', cta: '혜택 보기', tone: 'teal' },
  { brand: 'CURIA 프로', text: '위원회 토론 전체와 전문가 초청, 2주 무료 체험', href: 'pricing.html', cta: '요금제', tone: 'navy' },
  { brand: '광고 자리', text: '증권·핀테크 파트너 광고가 들어갈 수 있어요', href: 'faq.html#ask', cta: '광고 문의', tone: 'rose' },
];


export function adStrip(base: string): string {
  return `<aside class="ad-strip" aria-label="광고" hidden>${ADS.map((a, i) => `<a class="ad-s ad-${a.tone}" href="${base}${a.href}" data-ad="${i}" hidden><span class="ad-tag">광고</span><b>${esc(a.brand)}</b><span class="ad-t">${esc(a.text)}</span><span class="ad-cta">${esc(a.cta)} ›</span></a>`).join('')}<button type="button" class="ad-x" aria-label="광고 닫기">×</button></aside>`;
}

export const AD_CSS = `.ad-strip{position:relative;margin:10px 0 14px}.ad-s{animation:ad-in .35s ease-out}@keyframes ad-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}.ad-strip[hidden],.ad-s[hidden]{display:none}.ad-s{display:flex;align-items:center;gap:8px;min-height:40px;padding:8px 38px 8px 12px;border-radius:12px;font-size:13px;text-decoration:none;color:#fff;overflow:hidden}.ad-s b{white-space:nowrap;font-size:13px}.ad-t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.92}.ad-cta{white-space:nowrap;font-weight:700;font-size:12.5px}.ad-tag{font-size:10.5px;font-weight:700;border:1px solid currentColor;border-radius:5px;padding:0 4px;opacity:.75;flex:none}.ad-ink{background:#111}.ad-teal{background:#1f6b5f}.ad-navy{background:#15284a}.ad-rose{background:#8c2f4b}.ad-x{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:30px;height:30px;border:0;background:none;color:#fff;font-size:18px;cursor:pointer;opacity:.8}
@media(max-width:520px){.ad-cta{display:none}}`;

export const AD_JS = `(function(){var s=document.querySelector('.ad-strip');if(!s||window.top!==window)return;try{if(sessionStorage.getItem('gnm-ad-x')==='1')return;}catch(e){}var ads=s.querySelectorAll('.ad-s');if(!ads.length)return;var i=Math.floor(Math.random()*ads.length);ads[i].hidden=false;s.hidden=false;var show=function(n){ads[i].hidden=true;i=(n+ads.length)%ads.length;ads[i].hidden=false;};var t=setInterval(function(){if(!document.hidden&&!s.matches(':hover'))show(i+1);},6000);s.querySelector('.ad-x').addEventListener('click',function(){clearInterval(t);s.remove();try{sessionStorage.setItem('gnm-ad-x','1');}catch(e){}});})();`;
