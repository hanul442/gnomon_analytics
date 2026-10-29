// G-294 (한서님 10/24 'pc사이트 개선도 해야됨 지금 방향과 같게', A안 왼쪽 레일): on wide screens the phone's bottom bar becomes
// one glass rail on the left. The same element, the same links and the same scripts: the four tabs, the current screen's
// parts nested under its tab (a stock's parts under its name), and the ✦ at the bottom. No bar or tab row at the top of
// any screen. Home lays out in two columns under a big banner; a stock report keeps its 기업 part open beside the
// committee (pc-split, set by TAB_SCRIPT) so company info is never behind a tap.

/** The rail's brand and account links; hidden on phones (the bar carries tabs only there). */
export const railExtras = (base: string): { brand: string; acct: string } => ({
  brand: `<a class="nav-brand" href="${base}index.html" aria-label="GNOMON 홈"><span class="gnomon-mark"><img src="${base}assets/gnomon-mark.png" alt=""></span><span><b>GNOMON</b><small>AI COMMITTEE</small></span></a>`,
  acct: `<a class="nav-acct" href="${base}pricing.html" aria-label="요금제와 크레딧"><i aria-hidden="true">나</i><span><b data-plan-name>무료</b><small><span data-credits>0</span> 크레딧</small></span></a>`,
});

export const PC_RAIL_CSS = `
@media (max-width:820px){.bottom-nav .nav-brand,.bottom-nav .nav-acct,.bottom-nav>.bell-btn{display:none!important}}
@media (min-width:821px){
html{--rail-w:212px;--glass-bg:linear-gradient(180deg,rgba(255,255,255,.78),rgba(255,255,255,.6));--glass-edge:rgba(255,255,255,.85);--glass-hi:rgba(255,255,255,.9);--glass-pill:#fff;--glass-soft:rgba(255,255,255,.7)}
html[data-theme=dark]{--glass-bg:linear-gradient(180deg,rgba(40,46,56,.78),rgba(20,24,31,.72));--glass-edge:rgba(255,255,255,.1);--glass-hi:rgba(255,255,255,.12);--glass-pill:rgba(255,255,255,.14);--glass-soft:rgba(255,255,255,.07)}
body:has(>.bottom-nav){padding-left:calc(var(--rail-w) + 32px);padding-right:8px}
body:has(>.bottom-nav)>.topbar,body:has(>.bottom-nav) .mode-tabs,body:has(>.bottom-nav) .chat-fab,body:has(>.bottom-nav) .pg-ask{display:none!important}
body:has(>.bottom-nav) main#main{padding-top:18px}
body:has(>.bottom-nav) .pg-title{padding-left:4px;padding-right:4px}
body:has(>.bottom-nav) #main>.pf{margin-left:0;margin-right:auto}
.bottom-nav,html[data-theme] body .bottom-nav{position:fixed;left:16px;top:16px;bottom:16px;z-index:40;width:var(--rail-w);box-sizing:border-box;display:flex;flex-direction:column;align-items:stretch;gap:2px;
  margin:0;padding:18px 12px 12px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;border:1px solid var(--glass-edge);border-radius:28px;background:var(--glass-bg);
  box-shadow:0 24px 60px -36px rgba(10,22,38,.5),inset 0 1px 0 var(--glass-hi);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%)}
.bottom-nav::-webkit-scrollbar{display:none}
.bottom-nav .seg-thumb,.bottom-nav .nav-back,.bottom-nav .nav-return,.bottom-nav .nav-ctx>button{display:none!important}
.bottom-nav .nav-brand{order:0;display:flex;align-items:center;gap:10px;padding:0 8px 16px;color:var(--fg);text-decoration:none}
.nav-brand .gnomon-mark{width:32px;height:32px;flex:none}.nav-brand .gnomon-mark img{width:32px;height:32px}
.nav-brand b{display:block;font-size:17.5px;font-weight:600;letter-spacing:.16em}.nav-brand small{display:block;font-size:12px;letter-spacing:.12em;color:var(--muted)}
.bottom-nav .nav-tabs{display:contents}
.bottom-nav .nav-tabs a,.bottom-nav .nav-seg a,.bottom-nav .nav-parts button,.bottom-nav .nav-menu a,.bottom-nav .nav-ctx a,.bottom-nav .nav-ctx a.nav-bk,.bottom-nav .nav-ctx a.nav-read{
  position:relative;flex:none;display:flex;flex-direction:row;align-items:center;justify-content:flex-start;gap:12px;width:auto;height:46px;min-height:46px;margin:0;padding:0 14px;
  border:0;border-radius:15px;background:none;color:var(--fg2);font:inherit;font-size:17px;font-weight:600;text-align:left;text-decoration:none;white-space:nowrap;cursor:pointer;
  transition:background-color .2s,color .2s,transform .2s var(--spring-bouncy,ease-out)}
.bottom-nav .nav-tabs a svg,.bottom-nav .nav-ctx svg{position:static;width:21px;height:21px;flex:none}
.bottom-nav .nav-tabs a span,.bottom-nav .nav-ctx span{position:static;display:block;transform:none;padding:0;background:none;box-shadow:none;color:inherit;font-size:inherit;font-weight:inherit;overflow:hidden;text-overflow:ellipsis;animation:none}
.bottom-nav .nav-tabs a::before,.bottom-nav .nav-ctx a::before,.bottom-nav .nav-ctx button::before{display:none!important}
.bottom-nav .nav-tabs a:hover,.bottom-nav .nav-ctx a:hover,.bottom-nav .nav-ctx button:hover{background:var(--soft);color:var(--fg)}
.bottom-nav .nav-tabs a:active,.bottom-nav .nav-ctx a:active,.bottom-nav .nav-ctx button:active{transform:scale(.97)}
.bottom-nav .nav-tabs a[aria-current=page],.bottom-nav .nav-ctx [aria-current=page],.bottom-nav .nav-ctx [aria-selected=true]{background:var(--glass-pill);color:var(--fg);font-weight:800;box-shadow:0 8px 20px -12px rgba(10,22,38,.45),inset 0 -1px 0 rgba(0,0,0,.04)}
.bottom-nav .nav-tabs a:nth-of-type(1){order:2}.bottom-nav .nav-tabs a:nth-of-type(2){order:4}.bottom-nav .nav-tabs a:nth-of-type(3){order:6}.bottom-nav .nav-tabs a:nth-of-type(4){order:8}
/* This screen's parts sit right under its tab; a screen with no tab of its own (a stock, an issue) lists them under its name. */
.bottom-nav .nav-ctx{order:10;display:flex;flex-direction:column;align-items:stretch;gap:2px;margin:14px 0 0;padding:14px 0 0;border-top:1px solid var(--line);animation:none}
.bottom-nav .nav-ctx[data-title]::before{content:attr(data-title);display:block;padding:0 14px 6px;font-size:15.5px;font-weight:700;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bottom-nav:has(.nav-tabs a:nth-of-type(1)[aria-current]) .nav-ctx{order:3}
.bottom-nav:has(.nav-tabs a:nth-of-type(2)[aria-current]) .nav-ctx{order:5}
.bottom-nav:has(.nav-tabs a:nth-of-type(3)[aria-current]) .nav-ctx{order:7}
.bottom-nav:has(.nav-tabs a:nth-of-type(4)[aria-current]) .nav-ctx{order:9}
.bottom-nav:has(.nav-tabs a[aria-current]) .nav-ctx{margin:2px 0 6px 25px;padding:0 0 0 8px;border-top:0;border-left:1.5px solid var(--line-strong)}
.bottom-nav:has(.nav-tabs a[aria-current]) .nav-ctx::before{display:none}
.bottom-nav .nav-seg,.bottom-nav .nav-parts{position:static;display:flex;flex-direction:column;align-items:stretch;gap:2px;flex:none}
.bottom-nav .nav-ctx a,.bottom-nav .nav-ctx button,.bottom-nav .nav-menu a{height:40px;min-height:40px;padding:0 12px;font-size:17px;font-weight:600;border-radius:12px}
.bottom-nav .nav-ctx svg{width:18px;height:18px}
.bottom-nav .nav-ctx a i,.bottom-nav .nav-seg a i{position:static;margin-left:auto}
.bottom-nav .nav-menu,.bottom-nav .nav-menu[hidden]{position:static;display:flex!important;flex-direction:column;gap:2px;min-width:0;padding:0;border:0;border-radius:0;background:none;box-shadow:none;animation:none}
.bottom-nav .nav-ctx a.nav-read{white-space:normal;line-height:1.3;height:auto;padding:10px 12px;background:var(--fg);color:var(--page)}
.bottom-nav .nav-spark{order:30;position:relative;flex:none;display:flex;align-items:center;justify-content:center;gap:8px;width:auto;height:50px;margin:auto 0 0;padding:0 16px;border:0;border-radius:16px;
  background:var(--fg);color:var(--page);font:inherit;cursor:pointer;box-shadow:0 12px 24px -12px rgba(10,22,38,.7)}
.bottom-nav .nav-spark::after{content:"AI에게 묻기";font-size:17px;font-weight:700}
.bottom-nav .nav-spark svg{width:20px;height:20px}
.bottom-nav .nav-spark:active{transform:scale(.97)}
.bottom-nav .nav-acct{order:31;display:flex;align-items:center;gap:10px;margin-top:8px;padding:6px 8px;border-radius:14px;color:var(--fg);text-decoration:none}
.bottom-nav .nav-acct:hover{background:var(--soft)}
.nav-acct>i{width:32px;height:32px;flex:none;display:grid;place-items:center;border-radius:50%;background:var(--soft);font-style:normal;font-size:15.5px;font-weight:700}
.nav-acct b{display:block;font-size:16px}.nav-acct small{display:block;font-size:15px;color:var(--muted);font-weight:600}
.bottom-nav>.bell-btn{order:32;display:block;position:absolute;right:20px;bottom:20px;width:36px;height:36px;border:0;border-radius:50%;background:var(--soft);color:var(--fg)}
.bottom-nav.mini{transform:none}
body:has(.bottom-nav){padding-bottom:0}
.pop-card{left:auto;right:24px}
/* The 토론방 is a fixed layer; a frosted card around it would trap it in that card's box (narrow beside the 기업 column). */
main *:has(.db-room:not([hidden])){backdrop-filter:none!important;-webkit-backdrop-filter:none!important;transform:none!important;filter:none!important;contain:none!important;will-change:auto!important}
}
@media (min-width:1100px){html{--rail-w:232px}}
/* Home: the date line and a big banner across, then 내 종목 | 시장 and 위원회 오늘 | 오늘 이슈 side by side. */
@media (min-width:1100px){
/* G-300 (한서님 10/25): 내 종목 then 위원회 오늘 down the left, 시장 then 오늘 이슈 down the right; every card only as tall
   as what it holds (an empty 내 종목 no longer stretches to the 시장 column's height). */
.hm-p:not([hidden]){display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);grid-template-areas:"hero hero" "bn bn" "left mh" "left mk" "left ih" "left ic";column-gap:24px;align-items:start;max-width:none}
.hm-p>*{grid-column:1/-1}
.hm-p>#mkt-hero{grid-area:hero}.hm-p>.hm-bn{grid-area:bn}
.hm-p>.hm-left{grid-area:left;align-self:start}.hm-left>#watch{margin-bottom:0}.hm-left>.hm-com{margin-top:12px}
.hm-p>.hm-h:has(+.km-stats){grid-area:mh}.hm-p>.km-stats{grid-area:mk}
.hm-p>.hm-h:has(+.hm-card .ia-list){grid-area:ih}.hm-p>.hm-card:has(.ia-list){grid-area:ic}
.hm-p>.hm-bn .bn-slide{min-height:300px;width:100%;box-sizing:border-box}.hm-p>.hm-bn .bn-img{aspect-ratio:4/1;min-height:0}
.hm-p>#mkt-hero .hm-s{font-size:26px;letter-spacing:-.02em}
}
/* A stock: the 기업 part stays open on the right while 위원회 or 소식 is open (TAB_SCRIPT adds pc-split). */
@media (min-width:1200px){
html.pc-split main#main{display:grid;grid-template-columns:minmax(0,1fr) 400px;column-gap:24px;align-items:start}
html.pc-split main#main>*{grid-column:1/-1}
html.pc-split main#main>[role=tabpanel]:not([hidden]){grid-column:1;grid-row:1}
html.pc-split main#main>#tab-news:not([hidden])+#tab-filings:not([hidden]){grid-row:2}
html.pc-split main#main>#tab-fundamentals{grid-column:2;grid-row:1/span 2;position:relative}
html.pc-split #tab-fundamentals .si-wrap{column-count:1}html.pc-split #tab-fundamentals .km-stats{grid-template-columns:minmax(0,1fr)}
html.pc-split #tab-fundamentals::before{content:"기업 정보";display:block;margin:4px 4px 10px;font-size:20px;font-weight:700;color:var(--fg)}
}
/* G-308 (한서님 10/29 'Pc시인성 안고치냐'): PC readability on top of G-301's text remap. Small print (<small>, the
   browser's 'smaller') never drops under 14px; long sentences stop at about 46 characters a line instead of running
   1,100px across; the 찾기 search box lines up with the content edge; the 기업 column keeps one heading, not two. */
@media (min-width:821px){
main small{font-size:max(14px,.85em)}
main .tip{font-size:14px}
main p,main .fine,main .sc-say,main .rr-line,main .lv-guide{max-width:46em}
main .find-head{padding-left:0;padding-right:0}
html.pc-split #tab-fundamentals>.panel-title,html.pc-split #tab-fundamentals>.sub-first>.sub-h{display:none}
}
`;
