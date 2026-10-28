import {ORBS} from './ui.js';
// The AI chat (docs/DESIGN.md §5.13, G-45): a button at the bottom right of every page opens a chat.
// Each question picks a model and shows its credit cost before sending; each answer shows the
// model and the credits it used. Out of credits, the chat offers a credit request (alpha) and the
// plans. With the alpha API configured it asks the server; without it, it stays a MOCK.

import { ASK_TIERS, CREDIT_COST, PLANS, won } from './plans.js';

const TIERS = ASK_TIERS.map((t) => ({ key: t.key, label: t.label, model: t.model, hint: t.hint, cost: CREDIT_COST[t.key] }));
const MODEL_NAME: Record<string, string> = { 'claude-haiku-4-5': 'Haiku 4.5', 'claude-sonnet-5-5': 'Sonnet 5.5', 'claude-opus-5-5': 'Opus 5.5' };
const PAID = PLANS.filter((p) => p.price > 0).map((p) => ({ key: p.key, name: p.name, price: won(p.price), line: p.tagline }));

/** G-223: a filing's "AI에게 묻기" button; the chat then reads that filing's DART original. KR (DART) filings only. */
export const askFilingButton = (receiptNo: string, title: string, symbol = '') => /^\d{14}$/.test(receiptNo)
  ? `<button type="button" class="ask-filing" data-ask-filing="${receiptNo}" data-title="${title.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)}"${symbol ? ` data-sym="${symbol.replace(/[^0-9A-Z-]/g, '')}"` : ''} aria-label="이 공시 원문을 AI에게 묻기" title="AI에게 묻기">✦</button>` : '';

export const CHAT_CSS = `
.ask-filing{display:inline-flex;align-items:center;justify-content:center;margin-left:6px;width:30px;height:30px;border:0;background:var(--soft);color:var(--fg);border-radius:50%;padding:0;font:inherit;font-size:15.5px;line-height:1;cursor:pointer;vertical-align:middle}.ask-filing:hover{border-color:var(--accent)}
.chat-filing{align-self:stretch;max-width:none;display:flex;align-items:flex-start;gap:8px;background:var(--surface);border:1px solid var(--accent);border-radius:12px;padding:8px 10px;font-size:15.5px;line-height:1.5}.chat-filing div{flex:1;min-width:0}.chat-filing small{display:block;color:var(--muted)}.chat-filing button{border:0;background:none;color:var(--muted);font:inherit;font-size:15px;cursor:pointer;white-space:nowrap;text-decoration:underline}
.chat-fab{position:fixed;right:20px;bottom:20px;z-index:60;display:inline-flex;align-items:center;gap:8px;border:0;border-radius:999px;background:var(--navy);color:var(--on-accent);font:inherit;font-weight:700;font-size:17px;padding:13px 18px 13px 15px;box-shadow:0 10px 28px rgba(15,34,68,.35);cursor:pointer}
.chat-fab{transition:transform .25s var(--ease-out),opacity .2s}.chat-fab.fab-away{transform:translateY(140%);opacity:0;pointer-events:none}.chat-fab:hover{background:var(--accent-strong)}.chat-fab svg{width:22px;height:22px}
.chat{position:fixed;right:20px;bottom:20px;z-index:75;width:min(400px,calc(100vw - 24px));height:min(620px,calc(100vh - 40px));display:flex;flex-direction:column;background:var(--surface-solid);border:1px solid var(--line);border-radius:18px;box-shadow:0 24px 60px rgba(15,27,45,.28);overflow:hidden}
.chat[hidden]{display:none}
.chat-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--navy);color:var(--on-accent)}.chat-head b{font-size:17px}.chat-head .ctx{font-size:15px;opacity:.8;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chat-head .bal{font-size:15px;background:rgba(255,255,255,.14);border-radius:999px;padding:3px 9px;white-space:nowrap}.chat-x{border:0;background:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:0 4px}
.chat-log{flex:1;min-height:0;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--soft)}
.msg{flex-shrink:0;max-width:88%;border-radius:14px;padding:10px 12px;font-size:16px;line-height:1.6;word-break:break-word}.msg p{margin:0 0 6px}.msg p:last-child{margin:0}.msg ul{margin:4px 0;padding-left:18px}
.msg.me{align-self:flex-end;background:var(--navy);color:var(--on-accent);border-bottom-right-radius:4px}.msg.ai{align-self:flex-start;background:var(--surface);border:1px solid var(--line);border-bottom-left-radius:4px}
.msg-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;padding-top:6px;border-top:1px dashed var(--line);font-size:15px;color:var(--muted)}.msg-meta .rate{margin-left:auto;display:flex;gap:4px}.msg-meta .rate button{border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:1px 7px;cursor:pointer;font-size:15.5px}.msg-meta .rate button[aria-pressed=true]{border-color:var(--accent);background:var(--accent-soft)}
.msg.sys{align-self:stretch;max-width:none;background:var(--warn-soft);border:1px solid #f1d9a6;color:var(--warn-strong)}
.msg.wait{color:var(--muted)}.chat-progress .orbs,.chat-progress .orbs canvas{width:22px;height:22px;flex:none}.chat-progress{min-height:24px;display:flex;align-items:center;gap:4px;font-size:15px}.stream-answer{white-space:pre-wrap;color:var(--fg);margin-top:6px}.stream-answer:empty{display:none}.msg.wait i{display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:3px;animation:blink 1s infinite}.msg.wait i:nth-child(2){animation-delay:.2s}.msg.wait i:nth-child(3){animation-delay:.4s}@keyframes blink{50%{opacity:.2}}
.chat-sugg{display:flex;flex-wrap:wrap;gap:6px}.chat-sugg button{border:1px solid var(--line-strong);background:var(--surface);border-radius:999px;padding:6px 11px;font:inherit;font-size:15.5px;cursor:pointer}.chat-sugg button:hover{border-color:var(--accent);color:var(--accent)}
.chat-foot{border-top:1px solid var(--line);padding:10px 12px;display:flex;flex-direction:column;gap:8px;background:var(--surface)}
.tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.tiers button{border:1px solid var(--line-strong);background:var(--surface);border-radius:10px;padding:6px 4px;font:inherit;font-size:15px;cursor:pointer;display:flex;flex-direction:column;align-items:center;line-height:1.3}.tiers button b{font-size:15.5px}.tiers button small{color:var(--muted)}
.tiers button[aria-pressed=true]{border-color:var(--navy);background:var(--navy);color:var(--on-accent)}.tiers button[aria-pressed=true] small{color:#c9d6ee}
.chat-in{display:flex;gap:8px;align-items:flex-end}.chat-in textarea{flex:1;min-height:42px;max-height:120px;border:1px solid var(--line-strong);border-radius:12px;padding:10px 12px;font:inherit;font-size:16px;resize:none}
.chat-send{width:44px;min-width:44px;height:44px;border:0;border-radius:12px;background:var(--navy);color:var(--on-accent);font:inherit;font-weight:700;font-size:15.5px;padding:10px 12px;cursor:pointer;white-space:nowrap}.chat-send:disabled{opacity:.5;cursor:default}
.chat-note{font-size:14px;color:var(--muted);text-align:center}
.need{display:flex;flex-direction:column;gap:8px}.need form{display:flex;flex-direction:column;gap:6px}.need select,.need input{border:1px solid var(--line-strong);border-radius:10px;padding:8px 10px;font:inherit;font-size:15.5px}
.need .plans{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.need .plans a{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:10px;padding:8px;text-decoration:none;color:inherit;font-size:15px;background:var(--surface)}.need .plans a b{font-size:15.5px}
.need .btn-primary{margin:0;padding:8px 12px;font-size:15.5px}
@media (max-width:820px){.chat-fab{bottom:78px;right:14px;padding:12px}.chat-fab span{display:none}.chat{right:0;left:0;top:auto;bottom:0;width:100vw;height:78dvh;border-radius:20px 20px 0 0;border:0;box-shadow:0 -12px 40px rgba(15,27,45,.3)}.chat.kb{border-radius:0}.chat-scrim{position:fixed;inset:0;z-index:74;background:rgba(10,20,35,.45)}.chat-in textarea{font-size:17.5px}.chat-head{padding:10px 12px}
.chat.kb .chat-note,.chat.kb .chat-sugg{display:none}.chat.kb .tiers button{flex-direction:row;gap:4px;justify-content:center;padding:5px 4px}.chat.kb .tiers button small{display:none}.chat.kb .chat-foot{padding:8px 10px;gap:6px}}
html.chat-open,html.chat-open body{overflow:hidden}
/* G-277 (한서님 10/21 'AI 답변도 현재 ui랑 방향이 맞게'): light glass tone — no dark top bar, neutral bubbles, a segmented
   빠른·표준·깊은 switch, outline thumbs. */
html body .chat-head{background:var(--surface-solid);color:var(--fg);border-bottom:1px solid var(--line)}html body .chat-head .chat-x{color:var(--fg)!important}
html body .chat-head .bal{background:var(--soft);color:var(--fg2);font-weight:600}
html body .chat-log{background:var(--page)}
html body .msg.me{background:var(--fg);color:var(--page);border-radius:18px 18px 6px 18px}
html body .msg.ai{background:var(--surface-solid);border:0;border-radius:18px 18px 18px 6px;box-shadow:0 6px 18px -12px rgba(10,22,38,.35)}
html body .msg-meta{border-top:1px solid var(--line)}
html body .msg-meta .rate button{display:inline-grid;place-items:center;width:30px;height:30px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--muted)}html body .msg-meta .rate svg{width:17px;height:17px}
html body .msg-meta .rate button[aria-pressed=true]{background:var(--soft);color:var(--fg)}
html body .tiers{gap:2px;padding:3px;border-radius:14px;background:var(--soft)}
html body .tiers button{border:0;background:transparent;border-radius:11px;padding:6px 4px;color:var(--fg2)}
html body .tiers button[aria-pressed=true]{background:var(--surface-solid);color:var(--fg);box-shadow:0 3px 10px -5px rgba(10,22,38,.4)}html body .tiers button[aria-pressed=true] small{color:var(--muted)}
html body .chat-in textarea{border-radius:22px;background:var(--soft);border-color:transparent}
html body .chat-send{border-radius:50%;background:var(--fg);color:var(--page)}
html body .chat-foot{background:var(--surface-solid)}
html body .msg.sys{background:var(--surface-solid);border:1px solid var(--line);color:var(--fg);border-radius:18px}html body .need .plans a{background:var(--soft);border-color:transparent;border-radius:14px}
/* G-288 (한서님 10/23 'ai질문 채팅열었을때 좀 인터랙티브했으면'): the chat opens out of the ✦ button, greets the reader about the
   screen they were on with a typed line and four questions for that screen (one tap sends), shows what it is doing in
   three steps, writes the answer as it streams, and ends with the sources it read, copy and three follow-up questions.
   Neutral glass, near-black accent; no bar at the top (just back, a context pill and the credit count). */
html body .chat-head{background:transparent;border-bottom:0;padding:10px 12px 4px}
.chat-head b{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
html body .chat-head .ctx{flex:0 1 auto;margin:0 auto;opacity:1;display:inline-flex;align-items:center;gap:6px;background:var(--soft);color:var(--fg2);border-radius:999px;padding:6px 12px;font-size:15.5px;font-weight:600}
.chat-head .ctx::before{content:"";flex:none;width:7px;height:7px;border-radius:50%;background:var(--fg)}
html body .chat-head .bal{background:transparent;color:var(--muted);padding:3px 4px}
/* 한서님 10/23 '키고 끌때도 뭔가 슈루룩': the sheet grows out of the button that opened it as a widening circle and folds back into it. */
/* Curves from motionTokens.ts (G-286): open on --spring-snappy, close on --ease-exit over --d-out, like the other sheets. */
.chat{--ox:calc(100% - 40px);--oy:calc(100% - 40px)}
.chat.opening{animation:chat-in 500ms var(--spring-snappy,cubic-bezier(.3,1.25,.5,1)) both;transform-origin:var(--ox) var(--oy)}
.chat.closing{animation:chat-out var(--d-out,180ms) var(--ease-exit,cubic-bezier(.4,0,1,1)) both;transform-origin:var(--ox) var(--oy);pointer-events:none}
.chat.opening .chat-log,.chat.opening .chat-foot{animation:chat-rise .42s .12s cubic-bezier(.2,.85,.25,1) both}
[data-open-chat].launch svg{animation:chat-twirl .5s cubic-bezier(.2,.85,.25,1)}
.chat-scrim{animation:chat-fade .25s ease both}
@keyframes chat-in{from{clip-path:circle(24px at var(--ox) var(--oy));transform:scale(.96);filter:blur(4px)}60%{filter:none}to{clip-path:circle(150% at var(--ox) var(--oy));transform:none;filter:none}}
@keyframes chat-out{from{clip-path:circle(150% at var(--ox) var(--oy))}to{clip-path:circle(22px at var(--ox) var(--oy));transform:scale(.94);opacity:.6}}
@keyframes chat-twirl{from{transform:rotate(-90deg) scale(.6)}to{transform:none}}
@keyframes chat-fade{from{opacity:0}}
@keyframes chat-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes chat-breathe{50%{transform:scale(1.1)}}
@keyframes chat-spin{to{transform:rotate(360deg)}}
@keyframes chat-caret{50%{opacity:0}}
[data-open-chat]{transition:transform .14s ease}[data-open-chat]:active{transform:scale(.9)}
.msg.hello{align-self:stretch;max-width:none;background:none!important;border:0!important;box-shadow:none!important;padding:26px 4px 4px;display:flex;flex-direction:column;gap:12px}
.hello-orb{width:44px;height:44px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#fff 0,#c9cdd3 38%,#2a2e35 100%);box-shadow:0 10px 24px -10px rgba(17,20,24,.6);animation:chat-breathe 2.6s ease-in-out infinite}
.hello-t{margin:0;min-height:2.64em;font-size:26px;font-weight:800;line-height:1.32;letter-spacing:-.03em;white-space:pre-line;color:var(--fg)}
.hello-t.typing::after,.stream-answer>p:last-child::after,.stream-answer>ul:last-child>li:last-child::after{content:"";display:inline-block;width:2px;height:1em;margin-left:2px;vertical-align:-2px;background:var(--fg);animation:chat-caret .9s steps(1) infinite}
.hello-sub{margin:0;color:var(--muted);font-size:16px;line-height:1.5}
.hello-chips,.next-chips{display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.hello-chips button,.next-chips button{display:inline-flex;align-items:center;gap:8px;min-height:44px;max-width:100%;border:0;border-radius:22px;padding:0 16px;background:var(--surface-solid);color:var(--fg);font:inherit;font-size:17px;font-weight:600;text-align:left;cursor:pointer;box-shadow:0 4px 14px -10px rgba(17,20,24,.5);transition:transform .14s ease,background .2s ease}
.hello-chips button:active,.next-chips button:active{transform:scale(.96);background:var(--soft)}
.hello-chips svg{flex:none;width:16px;height:16px;color:var(--muted)}
.hello .hello-sub,.hello .hello-chips button{opacity:0}
.hello.in .hello-sub,.hello.in .hello-chips button,.msg.next button{animation:chat-rise .38s cubic-bezier(.2,.85,.25,1) both}
.hello-chips button:nth-child(2),.next-chips button:nth-child(2){animation-delay:.07s}.hello-chips button:nth-child(3),.next-chips button:nth-child(3){animation-delay:.14s}.hello-chips button:nth-child(4){animation-delay:.21s}
.msg.next{align-self:stretch;max-width:none;background:none!important;border:0!important;box-shadow:none!important;padding:2px 0 4px;display:flex;flex-direction:column;gap:8px}.msg.next>b{font-size:15.5px;color:var(--fg2)}
.msg.chat-pop{animation:chat-rise .3s cubic-bezier(.2,.85,.25,1) both}
.chat-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;font-size:15.5px}
.chat-steps li{display:flex;align-items:center;gap:8px;color:var(--fg);animation:chat-rise .3s ease both}.chat-steps li[hidden]{display:none}
.chat-steps li::before{content:"";flex:none;box-sizing:border-box;width:13px;height:13px;border-radius:50%;border:2px solid var(--line-strong);border-top-color:var(--fg);animation:chat-spin 1s linear infinite}
.chat-steps li.ok{color:var(--muted)}.chat-steps li.ok::before{width:6px;height:11px;margin:0 4px 2px 3px;border:solid var(--fg);border-width:0 2px 2px 0;border-radius:0;transform:rotate(45deg);animation:none}
html body .msg.wait .stream-answer{white-space:normal;font-size:16px;line-height:1.6;color:var(--fg)}
.msg-src{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.msg-src span{font-size:15px;font-weight:600;color:var(--fg2);background:var(--soft);border-radius:999px;padding:4px 10px}
html body .msg-meta .copy{display:inline-grid;place-items:center;width:30px;height:30px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--muted);cursor:pointer}html body .msg-meta .copy svg{width:16px;height:16px}
.msg-meta .copy+.rate{margin-left:0}.msg-meta .copy{margin-left:auto}
.chat.closing~.chat-scrim,.chat-scrim.out{opacity:0;transition:opacity .3s}
@media (prefers-reduced-motion:reduce){.chat.opening,.chat.closing,.chat.opening .chat-log,.chat.opening .chat-foot,[data-open-chat].launch svg,.chat-scrim,.msg.chat-pop,.chat-steps li,.hello.in .hello-sub,.hello.in .hello-chips button,.msg.next button{animation:none!important}.hello .hello-sub,.hello .hello-chips button{opacity:1}.hello-orb,.chat-steps li::before,.hello-t.typing::after,.stream-answer>p:last-child::after,.stream-answer>ul:last-child>li:last-child::after{animation:none}[data-open-chat],.hello-chips button,.next-chips button{transition:none}}
/* G-288 (한서님 10/23 '질문 인터페이스 자체도 좀 개선'): one glass composer. The question box on top; under it a small pill
   with the answer kind and its credits (tap: the three kinds open above), and the send arrow that turns black once there is a question. */
html body .chat-foot{position:relative;border-top:0;background:transparent;padding:6px 12px 10px;gap:6px}
html body .chat .composer{display:flex;flex-direction:column;gap:2px;background:var(--surface-solid);border-radius:24px;padding:8px 8px 8px 6px;box-shadow:0 10px 30px -18px rgba(17,20,24,.55),inset 0 0 0 1px var(--line);transition:box-shadow .2s ease}
html body .chat .composer:focus-within{box-shadow:0 14px 34px -16px rgba(17,20,24,.6),inset 0 0 0 1.5px var(--fg)}
html body .chat .composer textarea{width:100%;box-sizing:border-box;min-height:40px;max-height:120px;border:0;background:transparent;border-radius:0;padding:8px 10px 4px;font:inherit;font-size:17.5px;line-height:1.5;resize:none;outline:none;color:var(--fg)}
.composer-row{display:flex;align-items:center;gap:8px;padding-left:4px}
.tier-pick{display:inline-flex;align-items:center;gap:6px;min-height:36px;border:0;border-radius:18px;background:var(--soft);color:var(--fg);font:inherit;font-size:15.5px;font-weight:700;padding:0 10px 0 12px;cursor:pointer;transition:transform .14s ease}.tier-pick:active{transform:scale(.95)}
.tier-pick small{font-weight:600;color:var(--muted);font-size:15px}.tier-pick svg{width:14px;height:14px;color:var(--muted);transition:transform .2s ease}.tier-pick[aria-expanded=true] svg{transform:rotate(180deg)}
.q-count{font-size:15px;color:var(--muted)}
html body .chat .chat-send{margin-left:auto;width:40px;min-width:40px;height:40px;padding:0;border-radius:50%;display:grid;place-items:center;background:var(--soft);color:var(--muted);transition:background .2s ease,color .2s ease,transform .14s ease}
html body .chat .chat-send svg{width:20px;height:20px}
html body .chat .composer.ready .chat-send{background:var(--fg);color:var(--page);animation:chat-ready .28s ease}html body .chat .chat-send:active{transform:scale(.9)}
@keyframes chat-ready{50%{transform:scale(1.12)}}
html body .chat .tiers{position:absolute;left:12px;right:12px;bottom:calc(100% - 2px);z-index:3;display:flex;flex-direction:column;gap:2px;padding:6px;border-radius:20px;background:var(--surface-solid);box-shadow:0 18px 44px -18px rgba(17,20,24,.55),inset 0 0 0 1px var(--line);animation:chat-rise .24s cubic-bezier(.2,.85,.25,1) both}
html body .chat .tiers[hidden]{display:none}
html body .chat .tiers button{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;min-height:48px;padding:0 14px;border:0;border-radius:14px;background:transparent;color:var(--fg);font:inherit;text-align:left;cursor:pointer;box-shadow:none;flex-direction:row}
html body .chat .tiers button b{font-size:17px}html body .chat .tiers button span{font-size:15.5px;color:var(--muted)}html body .chat .tiers button small{font-size:15px;font-weight:700;color:var(--fg2)}
html body .chat .tiers button[aria-pressed=true]{background:var(--soft);color:var(--fg);box-shadow:none}html body .chat .tiers button[aria-pressed=true] small{color:var(--fg)}
.chat.kb .tiers button small{display:inline!important}
@media (prefers-reduced-motion:reduce){html body .chat .tiers,html body .chat .composer.ready .chat-send{animation:none}.tier-pick,.tier-pick svg,html body .chat .chat-send,html body .chat .composer{transition:none}}
@media print{.chat-fab,.chat{display:none!important}}
`;

export const CHAT_HTML = `<button type="button" class="chat-fab" data-open-chat aria-haspopup="dialog" aria-controls="chat" aria-label="AI에게 질문하기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M8 9.5h8M8 12.5h5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg><span>AI 질문</span></button>
<section class="chat" id="chat" role="dialog" aria-label="AI 질문" hidden><div class="chat-head"><b>AI 질문</b><span class="ctx" id="chat-ctx"></span><span class="bal"><span data-credits>0</span> 크레딧</span><button type="button" class="chat-x" aria-label="닫기">×</button></div>
<div class="chat-log" id="chat-log" aria-live="polite"></div>
<form class="chat-foot" id="chat-form"><div class="tiers" id="chat-tiers" role="group" aria-label="답 종류" hidden>${TIERS.map((t, i) => `<button type="button" data-tier="${t.key}" aria-pressed="${i === 0}" title="${MODEL_NAME[t.model]}"><b>${t.label}</b><span>${t.hint}</span><small>${t.cost}크레딧</small></button>`).join('')}</div>
<div class="composer"><textarea id="chat-q" rows="1" maxlength="1000" placeholder="궁금한 것을 물어보세요" aria-label="질문"></textarea><div class="composer-row"><button type="button" class="tier-pick" id="chat-tier" aria-haspopup="true" aria-expanded="false" aria-controls="chat-tiers"><span id="chat-tier-l">${TIERS[0]!.label}</span><small id="chat-tier-c">${TIERS[0]!.cost}크레딧</small><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14l5-5 5 5"/></svg></button><span class="q-count" id="chat-count" hidden></span><button type="submit" class="chat-send" id="chat-send" aria-label="질문 전송" title="전송"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button></div></div>
<div class="chat-note">근거를 설명할 뿐 투자 권유가 아니에요 · 답이 틀릴 수 있어요</div></form></section>`;

export const CHAT_SCRIPT = `<script>
(function () {
  var TIERS = ${JSON.stringify(TIERS)}, MODEL = ${JSON.stringify(MODEL_NAME)}, PAID = ${JSON.stringify(PAID)};
  var box = document.getElementById('chat'), log = document.getElementById('chat-log'), form = document.getElementById('chat-form'), q = document.getElementById('chat-q'), send = document.getElementById('chat-send');
  if (!box) return;
  var base = document.body.getAttribute('data-base') || '', tier = TIERS[0].key, busy = false, HKEY = 'gnm-chat';
  // G-223: the filing the reader asked about ({ no, title, sym }); the server reads its DART original.
  var filing = null, fno = function () { return filing ? filing.no : ''; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var md = function (s) {
    var out = [], list = false;
    esc(s).split('\\n').forEach(function (line) {
      var l = line.replace(/\\*\\*(.+?)\\*\\*/g, '<b>$1</b>'), m = /^\\s*[-*•]\\s+(.*)$/.exec(l) || /^\\s*\\d+[.)]\\s+(.*)$/.exec(l);
      if (m) { if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + m[1] + '</li>'); return; }
      if (list) { out.push('</ul>'); list = false; }
      if (l.trim()) out.push('<p>' + l.replace(/^#+\\s*/, '') + '</p>');
    });
    if (list) out.push('</ul>');
    return out.join('');
  };
  // What the reader is looking at: the stock, and the open tab's text as context.
  var symbol = function () { if (filing && filing.sym) return filing.sym; var el = document.querySelector('[data-symbol]'); return (el && el.getAttribute('data-symbol')) || new URLSearchParams(location.search).get('c') || ''; };
  var stockName = function () { var h = document.querySelector('.hero h1'); return h ? h.textContent.trim() : ''; };
  var pageText = function () {
    var open = (document.querySelector('.panel[hidden]') && document.querySelector('.panel:not([hidden])')) || document.querySelector('main');
    var hero = document.querySelector('.hero');
    return ((hero ? hero.innerText + '\\n' : '') + (open ? open.innerText : '')).replace(/\\n{3,}/g, '\\n\\n').slice(0, 6000);
  };
  // G-288: which screen the chat was opened from, so the greeting, the first questions and the follow-ups fit it.
  var reduce = function () { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };
  var buzz = function () { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} };
  var CTX = {
    committee: ['위원회', ['AI 위원회 결론을 쉽게 풀어 줘요', '약세 시나리오는 어떤 조건이에요?', '무효화 가격이 무슨 뜻이에요?', '지난 판단은 맞았어요?']],
    chart: ['차트', ['지지·저항은 어디쯤이에요?', '최근 거래량은 평소보다 많아요?', 'RSI가 지금 뜻하는 건?', '이동평균선 배열은 어때요?']],
    company: ['기업', ['이 회사는 무엇으로 돈을 벌어요?', '재무에서 눈에 띄는 점은?', '투자 지표를 쉽게 풀어 줘요', '수급은 어떤 흐름이에요?']],
    news: ['소식', ['오늘 소식을 쉽게 풀어 줘요', '최근 공시 중 눈여겨볼 건?', '이 뉴스가 실적과 관련 있어요?', '같은 업종에도 영향이 있어요?']],
    sum: ['홈 · 요약', ['오늘 시장을 한 줄로 요약해 줘요', '오늘 가장 큰 이슈는 뭐예요?', '원/달러가 오르면 뭐가 달라져요?', '위원회는 시장을 어떻게 봐요?']],
    market: ['홈 · 시장', ['증시·금리·환율을 한 번에 풀어 줘요', '미국 10년 금리가 왜 중요해요?', '유가가 오르면 어떤 업종이 영향받아요?', 'VIX가 뭐예요?']],
    com: ['홈 · 위원회', ['위원회 판단을 쉽게 풀어 줘요', '강세·약세 근거는 각각 뭐예요?', '위원회는 어떻게 채점돼요?', '확률은 어떻게 정해져요?']],
    issues: ['홈 · 이슈', ['오늘 이슈 1위를 쉽게 풀어 줘요', '세계 뉴스가 한국 시장에 주는 영향은?', '이슈에 같이 나온 종목은 왜 묶였어요?', '헤드라인만 보고 판단하면 왜 위험해요?']],
    find: ['찾기', ['조건 필터는 어떻게 써요?', '기술적 적정가가 뭐예요?', '거래대금 많은 종목은 왜 봐요?', '테마는 어떻게 묶였어요?']],
    site: ['시장·사이트 전반', ['오늘 시장 분위기 요약해 줘요', 'AI 위원회는 어떻게 판단해요?', '기술적 적정가가 뭐예요?', '스크리너는 어떻게 써요?']]
  };
  var PANEL = { home: 'committee', ai: 'committee', chart: 'chart', technical: 'chart', strategy: 'chart', fundamentals: 'company', flows: 'company', news: 'news', filings: 'news', mine: 'committee' };
  var ctxInfo = function () {
    if (filing) return { key: 'filing', label: '공시 원문', greet: '이 공시를\\n같이 읽어 볼까요?', sub: '공시 원문을 읽고 적힌 내용을 풀어서 설명해요. 사고팔지는 판단하지 않아요.', steps: ['공시 원문 읽는 중', '금액·일정 찾는 중', '답 쓰는 중'], chips: ['핵심만 쉽게 요약해 줘요', '금액·비율·일정 숫자만 뽑아 줘요', '어려운 용어를 풀어 줘요', '정정이면 무엇이 바뀌었어요?'], next: ['더 쉽게 말해 줘요', '숫자만 표로 정리해 줘요', '이런 공시에서 보통 확인할 점은?'], src: ['공시 원문'] };
    var sym = symbol(), name = stockName(), key;
    if (sym) {
      var open = document.querySelector('.panel[hidden]') && document.querySelector('.panel:not([hidden])');
      key = (open && PANEL[(open.id || '').replace('tab-', '')]) || 'committee';
      var c = CTX[key];
      return { key: key, label: (name || sym) + ' · ' + c[0], greet: (name || sym) + ',\\n뭐가 궁금하세요?', sub: '보고 있던 ' + c[0] + ' 칸을 같이 읽고 답해요.', steps: ['보던 ' + c[0] + ' 칸 읽는 중', '종목 자료와 맞춰 보는 중', '답 쓰는 중'], chips: c[1], next: ['더 쉽게 말해 줘요', '반대로 보면 어떤 근거가 있어요?', '무엇이 나오면 이 판단이 틀려요?'], src: ['보던 화면 · ' + c[0], '종목 자료 · 최근 20거래일'] };
    }
    var nav = document.querySelector('.bottom-nav'), part = document.querySelector('.nav-parts [data-wd][aria-selected=true]');
    key = nav && nav.getAttribute('data-dock') === 'find' ? 'find' : part ? ({ sum: 'sum', market: 'market', com: 'com', news: 'issues' })[part.getAttribute('data-wd')] || 'site' : 'site';
    var s = CTX[key], home = key === 'sum' || key === 'market' || key === 'com' || key === 'issues';
    return { key: key, label: s[0], greet: home ? '오늘 시장,\\n뭐가 궁금하세요?' : key === 'find' ? '어떤 종목을\\n찾고 계세요?' : '무엇이\\n궁금하세요?', sub: home || key === 'find' ? '보고 있던 화면을 같이 읽고 답해요.' : '시장과 GNOMON 쓰는 법을 물어보세요.', steps: ['보던 화면 읽는 중', '근거 맞춰 보는 중', '답 쓰는 중'], chips: s[1], next: home ? ['더 쉽게 말해 줘요', '반대로 보면 어떤 근거가 있어요?', '내일 무엇을 지켜보면 돼요?'] : ['더 쉽게 말해 줘요', '예를 들어 설명해 줘요', '같이 보면 좋은 화면은 어디예요?'], src: ['보던 화면 · ' + s[0]] };
  };
  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17L17 7M9 7h8v8"/></svg>';
  var chipRow = function (cls, list) { return '<div class="' + cls + '">' + list.map(function (x) { return '<button type="button" data-chip>' + esc(x) + (cls === 'hello-chips' ? ARROW : '') + '</button>'; }).join('') + '</div>'; };
  var bindChips = function (d) { d.querySelectorAll('[data-chip]').forEach(function (b) { b.addEventListener('click', function () { if (busy) return; buzz(); ask(b.textContent); }); }); };
  var typeTimer = null;
  var typeIn = function (el, text, done) {
    clearInterval(typeTimer);
    if (reduce()) { el.textContent = text; done(); return; }
    var i = 0; el.classList.add('typing');
    typeTimer = setInterval(function () { i++; el.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(typeTimer); el.classList.remove('typing'); done(); } }, 38);
  };
  var nextChips = function () {
    log.querySelectorAll('.msg.next').forEach(function (x) { x.remove(); });
    var d = add('next', '<b>이어서 물어보기</b>' + chipRow('next-chips', ctxInfo().next)); bindChips(d);
  };
  var history = function () { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) { return []; } };
  var remember = function (h) { try { localStorage.setItem(HKEY, JSON.stringify(h.slice(-20))); } catch (e) {} };
  var cost = function () { return TIERS.filter(function (t) { return t.key === tier; })[0].cost; };
  // G-288: one composer card; the answer kind is a small pill inside it that opens the three kinds above it.
  var pick = document.getElementById('chat-tier'), pop = document.getElementById('chat-tiers'), comp = box.querySelector('.composer'), count = document.getElementById('chat-count');
  var label = function () {
    var t = TIERS.filter(function (x) { return x.key === tier; })[0];
    document.getElementById('chat-tier-l').textContent = t.label; document.getElementById('chat-tier-c').textContent = t.cost + '크레딧';
    pick.setAttribute('aria-label', '답 종류: ' + t.label + ' 답, ' + t.cost + '크레딧. 바꾸기');
    send.title = '전송 · ' + cost() + '크레딧'; send.setAttribute('aria-label', '질문 전송 · ' + cost() + '크레딧');
  };
  var tiersOpen = function (on) { pop.hidden = !on; pick.setAttribute('aria-expanded', String(on)); };
  var ready = function () {
    var n = q.value.trim().length; comp.classList.toggle('ready', n >= 2);
    count.hidden = q.value.length < 800; count.textContent = q.value.length + '/1000';
  };
  var add = function (cls, html) { var d = document.createElement('div'); d.className = 'msg ' + cls; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
  var srcs = function (m) { return m.src && m.src.length ? '<div class="msg-src">' + m.src.map(function (x) { return '<span>근거 · ' + esc(x) + '</span>'; }).join('') + '</div>' : ''; };
  var meta = function (m) {
    // G-277: the answer says which kind it was (빠른 답 · 4크레딧), not the raw model id; the model name stays in the title.
    var tk = TIERS.filter(function (t) { return t.model === m.model; })[0];
    return '<div class="msg-meta"><span title="' + esc(MODEL[m.model] || m.model || '') + '">' + esc(tk ? tk.label + ' 답' : 'AI 답') + '</span><span>' + m.credits + '크레딧 사용</span>' + (m.balance !== undefined ? '<span>남은 ' + m.balance + '</span>' : '') +
      '<button type="button" class="copy" data-copy aria-label="답 복사" title="복사"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15"/></svg></button>' + (m.id ? '<span class="rate"><button type="button" data-rate="1" aria-label="도움이 됐어요" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v10H4V10zM7 10l4-7a2 2 0 0 1 3 2l-1 4h5.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17 20H7"/></svg></button><button type="button" data-rate="-1" aria-label="아쉬워요" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="transform:scaleY(-1)"><path d="M7 10v10H4V10zM7 10l4-7a2 2 0 0 1 3 2l-1 4h5.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17 20H7"/></svg></button></span>' : '') + '</div>';
  };
  var render = function () {
    log.innerHTML = '';
    var h = history(), c = ctxInfo();
    document.getElementById('chat-ctx').textContent = c.label;
    if (filing) {
      var fc = add('chat-filing', '<div><b>' + esc(filing.title) + '</b><small>이 공시 원문을 읽고, 적힌 내용을 풀어서 설명해요. 사고팔지는 판단하지 않아요.</small></div><button type="button">공시 빼기</button>');
      fc.querySelector('button').addEventListener('click', function () { filing = null; render(); });
      h = h.filter(function (m) { return m.filing === filing.no; });
    }
    h.forEach(function (m) { add('me', esc(m.q)); bindMsg(add('ai', md(m.a) + srcs(m) + meta(m)), m); });
    if (h.length) { nextChips(); return; }
    // G-288: a typed greeting about this screen, then its four questions rise in; one tap sends.
    var d = add('hello', '<div class="hello-orb" aria-hidden="true"></div><p class="hello-t" role="heading" aria-level="2" aria-label="' + esc(c.greet.replace('\\n', ' ')) + '"></p><p class="hello-sub">' + esc(c.sub) + '</p>' + chipRow('hello-chips', c.chips));
    bindChips(d);
    typeIn(d.querySelector('.hello-t'), c.greet, function () { d.classList.add('in'); });
  };
  var api = function () { return window.GNM && GNM.api ? GNM : null; };
  // Out of credits: a request (alpha) and the plans, right in the chat.
  var need = function (msg, opts) {
    var d = add('sys need', '<b>' + esc(msg) + '</b>');
    var g = api();
    if (g && g.me && !opts.login) {
      var pend = (g.me.requests || []).filter(function (r) { return r.status === 'pending'; })[0];
      if (pend) d.insertAdjacentHTML('beforeend', '<span>크레딧 ' + pend.amount + '개 요청을 검토하고 있어요. 승인되면 바로 쓸 수 있어요.</span>');
      else {
        d.insertAdjacentHTML('beforeend', '<form><label>알파 테스터는 크레딧을 더 요청할 수 있어요</label><select name="amount"><option value="100">100크레딧</option><option value="200" selected>200크레딧</option><option value="300">300크레딧</option><option value="500">500크레딧</option></select><input name="reason" maxlength="300" placeholder="어디에 쓰실지 한 줄 (예: 반도체 종목 비교)" required><button class="btn-primary" type="submit">크레딧 요청하기</button></form>');
        d.querySelector('form').addEventListener('submit', function (e) {
          e.preventDefault(); var f = e.target;
          g.call('POST', '/credits/request', { amount: Number(f.amount.value), reason: f.reason.value }).then(function (r) {
            if (r.error) { GNM.toast(r.message); return; }
            f.outerHTML = '<span>요청했어요. 운영자가 확인하면 크레딧이 들어와요.</span>'; g.refresh(); if (g.track) g.track('credit_request', { amount: Number(f.amount.value), from: 'chat' });
          });
        });
      }
    }
    if (opts.login) d.insertAdjacentHTML('beforeend', '<a class="btn-primary" href="' + base + 'login.html">로그인하기</a>');
    d.insertAdjacentHTML('beforeend', '<div class="plans">' + PAID.map(function (p) { return '<a href="' + base + 'pricing.html#plan-' + p.key + '"><b>' + esc(p.name) + '</b><span>' + esc(p.price) + '/월</span><small class="muted">' + esc(p.line) + '</small></a>'; }).join('') + '</div><a class="muted small" href="' + base + 'pricing.html#credits">요금제와 크레딧 자세히</a>');
  };
  var mockAnswer = function (text) {
    var words = text.split(/[\\s,.?!]+/).map(function (w) { return w.replace(/(은|는|이|가|을|를|의|에|도|요|까|나)$/, ''); }).filter(function (w) { return w.length >= 2; });
    var pool = [].slice.call(document.querySelectorAll('.why-grid li, .claims li, .red-team p, .story-title, .pl-detail p, .headline, .hero-line'));
    var hits = pool.map(function (el) { var t = el.textContent.replace(/\\s+/g, ' ').trim(); return [words.filter(function (w) { return t.indexOf(w) >= 0; }).length, t]; })
      .filter(function (p) { return p[0] > 0; }).sort(function (x, y) { return y[0] - x[0]; }).slice(0, tier === 'deep' ? 6 : 3);
    return 'MOCK 답변이에요. AI 연결 전이라 이 페이지에서 질문과 가까운 문장을 골라 보여 드려요.\\n' + (hits.length ? hits.map(function (h) { return '- ' + h[1]; }).join('\\n') : '관련 근거를 찾지 못했어요.');
  };
  var ask = function (text) {
    if (busy) return;
    var g = api(), t = TIERS.filter(function (x) { return x.key === tier; })[0];
    if (g && !g.me) { need('로그인하면 AI에게 질문할 수 있어요.', { login: true }); return; }
    if (g && g.me && g.me.credits.balance < t.cost) { need('크레딧이 모자라요. 이 질문에는 ' + t.cost + '크레딧이 필요해요 (남은 ' + g.me.credits.balance + ').', {}); return; }
    if (!g) {
      var a = window.GNM && GNM.read ? GNM.read() : { plan: 'free', credits: 0, trial: 0 };
      var ok = (a.plan !== 'free' && a.credits >= t.cost) || (t.key === 'question' && a.trial >= t.cost);
      if (!ok) { need(a.plan === 'free' ? 'AI 질문은 플러스 요금제부터 크레딧으로 쓸 수 있어요.' : '크레딧이 모자라요. 이 질문에는 ' + t.cost + '크레딧이 필요해요.', {}); return; }
    }
    busy = true; send.disabled = true; q.value = ''; q.style.height = ''; ready(); tiersOpen(false); clearInterval(typeTimer);
    log.querySelectorAll('.msg.hello, .msg.next').forEach(function (x) { x.remove(); });
    var c = ctxInfo();
    add('me chat-pop', esc(text));
    // G-288: three steps tick by while the answer is prepared, then the answer is written as it streams in.
    var wait = add('ai wait chat-pop', '<div class="chat-progress">${ORBS.replace('data-orb=', 'data-size="22" data-orb=')}<ol class="chat-steps">' + c.steps.map(function (x, i) { return '<li' + (i ? ' hidden' : '') + '>' + esc(x) + '</li>'; }).join('') + '</ol></div><div class="stream-answer"></div>');
    wait.setAttribute('aria-busy','true');
    var lis = wait.querySelectorAll('.chat-steps li'), sa = wait.querySelector('.stream-answer'), at = 0, raf = 0, latest = '';
    var step = function (n) { for (; at < n && at < lis.length - 1; at++) { lis[at].classList.add('ok'); lis[at + 1].hidden = false; } };
    var t1 = setTimeout(function () { step(1); }, 700);
    var near = function () { return log.scrollHeight - log.scrollTop - log.clientHeight < 140; };
    var onText = function (txt) {
      latest = txt; if (at < 2) { clearTimeout(t1); step(2); }
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; var stick = near(); sa.innerHTML = md(latest); if (stick) log.scrollTop = log.scrollHeight; });
    };
    var h = history();
    var finish = function () { clearTimeout(t1); if (raf) cancelAnimationFrame(raf); raf = -1; busy = false; send.disabled = false; };
    var done = function (m) {
      finish(); m.src = c.src; h.push(m); remember(h);
      wait.className = 'msg ai'; wait.removeAttribute('aria-busy'); wait.innerHTML = md(m.a) + srcs(m) + meta(m); bindMsg(wait, m);
      nextChips(); log.scrollTop = log.scrollHeight;
    };
    var fail = function () { finish(); wait.remove(); };
    if (!g) {
      GNM.spend(t.key, '[채팅] ' + text.slice(0, 40));
      var mock = mockAnswer(text), n = 0;
      setTimeout(function () {
        var iv = setInterval(function () { n += 4; onText(mock.slice(0, n)); if (n >= mock.length) { clearInterval(iv); var a2 = GNM.read(); done({ q: text, a: mock, model: t.model, credits: t.cost, balance: a2.credits + a2.trial }); } }, reduce() ? 0 : 24);
      }, 900);
      return;
    }
    if (g.track) g.track('ask_sent', { tier: t.key, symbol: symbol(), from: c.key });
    g.askStream({ tier: t.key, question: text, symbol: symbol() || undefined, filing: fno() || undefined, page: filing ? undefined : pageText(), history: h.filter(function (m) { return m.sym === symbol() && (m.filing || '') === fno(); }).slice(-3).map(function (m) { return { q: m.q, a: m.a }; }) }, onText).then(function (r) {
      if (r.error) {
        fail();
        if (r.error === 'NO_CREDITS') need(r.message, {}); else if (r.error === 'LOGIN_REQUIRED') need(r.message, { login: true }); else add('sys', esc(r.message || '답을 받지 못했어요.'));
        g.refresh(); return;
      }
      done({ q: text, a: r.answer, model: r.model, credits: r.credits, balance: r.balance, id: r.id, sym: symbol(), filing: fno() || undefined });
      g.refresh();
    }).catch(function () { fail(); add('sys', '연결이 끊겼어요. 잠시 뒤 다시 해 주세요.'); });
  };
  var bindMsg = function (d, m) {
    var cp = d.querySelector('[data-copy]');
    if (cp) cp.addEventListener('click', function () {
      var ok = function () { if (window.GNM && GNM.toast) GNM.toast('답을 복사했어요.'); };
      try { navigator.clipboard.writeText(m.a).then(ok, function () {}); } catch (e) {}
    });
    bindRate(d, m);
  };
  var bindRate = function (d, m) {
    d.querySelectorAll('[data-rate]').forEach(function (b) {
      b.addEventListener('click', function () {
        var g = api(); if (!g || !m.id) return;
        d.querySelectorAll('[data-rate]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        g.call('POST', '/ask/' + m.id + '/rate', { rating: Number(b.getAttribute('data-rate')) });
      });
    });
  };
  // Phones (G-60): the chat fills the visible area above the keyboard. visualViewport shrinks when the
  // keyboard opens; the box follows it, the extra rows fold away and the latest message stays in view.
  var vv = window.visualViewport, phone = function () { return window.matchMedia('(max-width: 820px)').matches; };
  var fit = function () {
    if (box.hidden || !phone() || !vv) { box.style.height = ''; box.style.top = ''; box.classList.remove('kb'); return; }
    // G-86: a bottom sheet (about three quarters of the screen) until the keyboard opens; then it takes
    // the whole visible area above the keyboard.
    var kb = vv.height < window.innerHeight * 0.78, h = kb ? vv.height : Math.min(vv.height * 0.78, 640);
    box.style.height = h + 'px'; box.style.top = (vv.offsetTop + vv.height - h) + 'px';
    box.classList.toggle('kb', kb);
    var log = box.querySelector('.chat-log'); if (log) log.scrollTop = log.scrollHeight;
  };
  if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); }
  var scrim = null;
  // G-288 (한서님 10/23 '키고 끌때도 뭔가 슈루룩'): the sheet grows out of the button that opened it and folds back into it.
  var from = null, closing = 0;
  var aim = function () {
    var b = from && from.getBoundingClientRect && from.offsetParent !== null ? from.getBoundingClientRect() : null, r = box.getBoundingClientRect();
    if (b && b.width) { box.style.setProperty('--ox', Math.round(b.left + b.width / 2 - r.left) + 'px'); box.style.setProperty('--oy', Math.round(b.top + b.height / 2 - r.top) + 'px'); }
    else { box.style.removeProperty('--ox'); box.style.removeProperty('--oy'); }
  };
  var gone = function () { clearTimeout(closing); closing = 0; box.classList.remove('closing'); box.hidden = true; document.documentElement.classList.remove('chat-open'); if (scrim) { scrim.remove(); scrim = null; } fit(); };
  var shut = function () {
    if (box.hidden || closing) return;
    clearInterval(typeTimer);
    if (reduce()) { gone(); return; }
    aim(); box.classList.remove('opening'); box.classList.add('closing'); if (scrim) scrim.classList.add('out');
    closing = setTimeout(gone, 200);
  };
  var open = function (preset, btn) {
    if (closing) gone();
    from = btn || null;
    box.hidden = false; render(); label(); tiersOpen(false);
    var nm = stockName() || symbol(); q.placeholder = filing ? '이 공시에 대해 물어보기' : nm ? nm + '에 대해 물어보기' : '궁금한 것을 물어보세요';
    if (phone()) { document.documentElement.classList.add('chat-open'); if (!scrim) { scrim = document.createElement('div'); scrim.className = 'chat-scrim'; scrim.addEventListener('click', shut); box.parentNode.insertBefore(scrim, box); } }
    fit();
    if (!reduce()) {
      aim(); box.classList.remove('opening'); void box.offsetWidth; box.classList.add('opening');
      if (btn) { btn.classList.remove('launch'); void btn.offsetWidth; btn.classList.add('launch'); }
    }
    if (preset) q.value = preset;
    ready();
    // On phones the keyboard would cover the sheet at once; it opens when the reader taps the box.
    if (!phone()) q.focus();
    if (window.GNM && GNM.track) GNM.track('chat_open', { symbol: symbol(), from: ctxInfo().key });
  };
  box.addEventListener('animationend', function (e) { if (e.target === box && e.animationName === 'chat-in') box.classList.remove('opening'); });
  // G-298: the bar's ✦ menu (microMotion.ts) offers this screen's first questions and asks one straight away.
  window.gnmChat = { chips: function () { try { return (ctxInfo().chips || []).slice(); } catch (e) { return []; } }, ask: function (t) { filing = null; open('', null); setTimeout(function () { ask(t); }, 60); } };
  document.querySelectorAll('[data-open-chat]').forEach(function (b) { b.addEventListener('click', function () { filing = null; buzz(); open(b.getAttribute('data-ask') || '', b); }); });
  // Filing buttons can appear later (lists drawn by script), so one listener on the page.
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-ask-filing]') : null; if (!b) return;
    e.preventDefault();
    filing = { no: b.getAttribute('data-ask-filing'), title: b.getAttribute('data-title') || '공시', sym: b.getAttribute('data-sym') || '' };
    if (window.GNM && GNM.track) GNM.track('filing_ask_open', { symbol: filing.sym });
    open('', b);
  });
  box.querySelector('.chat-x').addEventListener('click', shut);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) shut(); });
  q.addEventListener('focus', function () { setTimeout(fit, 250); });
  box.querySelectorAll('[data-tier]').forEach(function (b) {
    b.addEventListener('click', function () { tier = b.getAttribute('data-tier'); box.querySelectorAll('[data-tier]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); label(); tiersOpen(false); buzz(); q.focus(); });
  });
  q.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  q.addEventListener('input', function () { q.style.height = 'auto'; q.style.height = Math.min(120, q.scrollHeight) + 'px'; ready(); });
  pick.addEventListener('click', function () { tiersOpen(pop.hidden); });
  box.addEventListener('click', function (e) { if (!pop.hidden && !e.target.closest('#chat-tiers, #chat-tier')) tiersOpen(false); });
  form.addEventListener('submit', function (e) { e.preventDefault(); var t = q.value.trim(); if (t.length < 2) { q.focus(); return; } ask(t); });
})();
</script>`;
