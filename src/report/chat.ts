// The AI chat (docs/DESIGN.md §5.13, G-45): a button at the bottom right of every page opens a chat.
// Each question picks a model and shows its credit cost before sending; each answer shows the
// model and the credits it used. Out of credits, the chat offers a credit request (alpha) and the
// plans. With the alpha API configured it asks the server; without it, it stays a MOCK.

import { ASK_TIERS, CREDIT_COST, PLANS, won } from './plans.js';

const TIERS = ASK_TIERS.map((t) => ({ key: t.key, label: t.label, model: t.model, hint: t.hint, cost: CREDIT_COST[t.key] }));
const MODEL_NAME: Record<string, string> = { 'claude-haiku-4-5': 'Haiku 4.5', 'claude-sonnet-5-5': 'Sonnet 5.5', 'claude-opus-5-5': 'Opus 5.5' };
const PAID = PLANS.filter((p) => p.price > 0).map((p) => ({ key: p.key, name: p.name, price: won(p.price), line: p.tagline }));

export const CHAT_CSS = `
.chat-fab{position:fixed;right:20px;bottom:20px;z-index:60;display:inline-flex;align-items:center;gap:8px;border:0;border-radius:999px;background:var(--navy);color:#fff;font:inherit;font-weight:700;font-size:15px;padding:13px 18px 13px 15px;box-shadow:0 10px 28px rgba(15,34,68,.35);cursor:pointer}
.chat-fab:hover{background:#1d3a6e}.chat-fab svg{width:22px;height:22px}
.chat{position:fixed;right:20px;bottom:20px;z-index:75;width:min(400px,calc(100vw - 24px));height:min(620px,calc(100vh - 40px));display:flex;flex-direction:column;background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:0 24px 60px rgba(15,27,45,.28);overflow:hidden}
.chat[hidden]{display:none}
.chat-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--navy);color:#fff}.chat-head b{font-size:15px}.chat-head .ctx{font-size:12px;opacity:.8;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chat-head .bal{font-size:12px;background:rgba(255,255,255,.14);border-radius:999px;padding:3px 9px;white-space:nowrap}.chat-x{border:0;background:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:0 4px}
.chat-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f6f8fb}
.msg{max-width:88%;border-radius:14px;padding:10px 12px;font-size:14px;line-height:1.6;word-break:break-word}.msg p{margin:0 0 6px}.msg p:last-child{margin:0}.msg ul{margin:4px 0;padding-left:18px}
.msg.me{align-self:flex-end;background:var(--navy);color:#fff;border-bottom-right-radius:4px}.msg.ai{align-self:flex-start;background:#fff;border:1px solid var(--line);border-bottom-left-radius:4px}
.msg-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;padding-top:6px;border-top:1px dashed var(--line);font-size:12px;color:var(--muted)}.msg-meta .rate{margin-left:auto;display:flex;gap:4px}.msg-meta .rate button{border:1px solid var(--line);background:#fff;border-radius:8px;padding:1px 7px;cursor:pointer;font-size:13px}.msg-meta .rate button[aria-pressed=true]{border-color:var(--accent);background:var(--accent-soft)}
.msg.sys{align-self:stretch;max-width:none;background:#fff7e6;border:1px solid #f1d9a6;color:#5b3d00}
.msg.wait{color:var(--muted)}.msg.wait i{display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:3px;animation:blink 1s infinite}.msg.wait i:nth-child(2){animation-delay:.2s}.msg.wait i:nth-child(3){animation-delay:.4s}@keyframes blink{50%{opacity:.2}}
.chat-sugg{display:flex;flex-wrap:wrap;gap:6px}.chat-sugg button{border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:6px 11px;font:inherit;font-size:13px;cursor:pointer}.chat-sugg button:hover{border-color:var(--accent);color:var(--accent)}
.chat-foot{border-top:1px solid var(--line);padding:10px 12px;display:flex;flex-direction:column;gap:8px;background:#fff}
.tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.tiers button{border:1px solid var(--line-strong);background:#fff;border-radius:10px;padding:6px 4px;font:inherit;font-size:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;line-height:1.3}.tiers button b{font-size:13px}.tiers button small{color:var(--muted)}
.tiers button[aria-pressed=true]{border-color:var(--navy);background:var(--navy);color:#fff}.tiers button[aria-pressed=true] small{color:#c9d6ee}
.chat-in{display:flex;gap:8px;align-items:flex-end}.chat-in textarea{flex:1;min-height:42px;max-height:120px;border:1px solid var(--line-strong);border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;resize:none}
.chat-send{border:0;border-radius:12px;background:var(--navy);color:#fff;font:inherit;font-weight:700;font-size:13px;padding:10px 12px;cursor:pointer;white-space:nowrap}.chat-send:disabled{opacity:.5;cursor:default}
.chat-note{font-size:11px;color:var(--muted);text-align:center}
.need{display:flex;flex-direction:column;gap:8px}.need form{display:flex;flex-direction:column;gap:6px}.need select,.need input{border:1px solid var(--line-strong);border-radius:10px;padding:8px 10px;font:inherit;font-size:13px}
.need .plans{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.need .plans a{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:10px;padding:8px;text-decoration:none;color:inherit;font-size:12px;background:#fff}.need .plans a b{font-size:13px}
.need .btn-primary{margin:0;padding:8px 12px;font-size:13px}
@media (max-width:820px){.chat-fab{bottom:78px;right:14px;padding:12px}.chat-fab span{display:none}.chat{right:0;left:0;top:0;bottom:auto;width:100vw;height:100dvh;border-radius:0;border:0}.chat-in textarea{font-size:16px}.chat-head{padding:10px 12px}
.chat.kb .chat-note,.chat.kb .chat-sugg{display:none}.chat.kb .tiers button{flex-direction:row;gap:4px;justify-content:center;padding:5px 4px}.chat.kb .tiers button small{display:none}.chat.kb .chat-foot{padding:8px 10px;gap:6px}}
html.chat-open,html.chat-open body{overflow:hidden}
@media print{.chat-fab,.chat{display:none!important}}
`;

export const CHAT_HTML = `<button type="button" class="chat-fab" data-open-chat aria-haspopup="dialog" aria-controls="chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M8 9.5h8M8 12.5h5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg><span>AI 질문</span></button>
<section class="chat" id="chat" role="dialog" aria-label="AI 질문" hidden><div class="chat-head"><b>AI 질문</b><span class="ctx" id="chat-ctx"></span><span class="bal"><span data-credits>0</span> 크레딧</span><button type="button" class="chat-x" aria-label="닫기">×</button></div>
<div class="chat-log" id="chat-log" aria-live="polite"></div>
<form class="chat-foot" id="chat-form"><div class="tiers" role="group" aria-label="모델">${TIERS.map((t, i) => `<button type="button" data-tier="${t.key}" aria-pressed="${i === 0}"><b>${t.label}</b><small>${MODEL_NAME[t.model]} · ${t.cost}크레딧</small></button>`).join('')}</div>
<div class="chat-in"><textarea id="chat-q" rows="1" maxlength="1000" placeholder="궁금한 것을 물어보세요" aria-label="질문"></textarea><button type="submit" class="chat-send" id="chat-send">보내기</button></div>
<div class="chat-note">근거를 설명할 뿐 투자 권유가 아니에요 · 답이 틀릴 수 있어요</div></form></section>`;

export const CHAT_SCRIPT = `<script>
(function () {
  var TIERS = ${JSON.stringify(TIERS)}, MODEL = ${JSON.stringify(MODEL_NAME)}, PAID = ${JSON.stringify(PAID)};
  var box = document.getElementById('chat'), log = document.getElementById('chat-log'), form = document.getElementById('chat-form'), q = document.getElementById('chat-q'), send = document.getElementById('chat-send');
  if (!box) return;
  var base = document.body.getAttribute('data-base') || '', tier = TIERS[0].key, busy = false, HKEY = 'gnm-chat';
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
  var symbol = function () { var el = document.querySelector('[data-symbol]'); return (el && el.getAttribute('data-symbol')) || new URLSearchParams(location.search).get('c') || ''; };
  var stockName = function () { var h = document.querySelector('.hero h1'); return h ? h.textContent.trim() : ''; };
  var pageText = function () {
    var open = (document.querySelector('.panel[hidden]') && document.querySelector('.panel:not([hidden])')) || document.querySelector('main');
    var hero = document.querySelector('.hero');
    return ((hero ? hero.innerText + '\\n' : '') + (open ? open.innerText : '')).replace(/\\n{3,}/g, '\\n\\n').slice(0, 6000);
  };
  var history = function () { try { return JSON.parse(sessionStorage.getItem(HKEY) || '[]'); } catch (e) { return []; } };
  var remember = function (h) { try { sessionStorage.setItem(HKEY, JSON.stringify(h.slice(-20))); } catch (e) {} };
  var cost = function () { return TIERS.filter(function (t) { return t.key === tier; })[0].cost; };
  var label = function () { send.textContent = cost() + '크레딧 · 보내기'; };
  var add = function (cls, html) { var d = document.createElement('div'); d.className = 'msg ' + cls; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
  var meta = function (m) {
    return '<div class="msg-meta"><span>' + esc(MODEL[m.model] || m.model) + '</span><span>' + m.credits + '크레딧 사용</span>' + (m.balance !== undefined ? '<span>남은 ' + m.balance + '</span>' : '') +
      (m.id ? '<span class="rate"><button type="button" data-rate="1" aria-label="도움이 됐어요" aria-pressed="false">👍</button><button type="button" data-rate="-1" aria-label="아쉬워요" aria-pressed="false">👎</button></span>' : '') + '</div>';
  };
  var render = function () {
    log.innerHTML = '';
    var h = history(), sym = symbol(), name = stockName();
    document.getElementById('chat-ctx').textContent = sym ? (name || sym) + ' 기준으로 답해요' : '시장·사이트 전반';
    if (!h.length) {
      add('ai', '<p>궁금한 걸 물어보세요. 모델을 고르면 쓰는 크레딧이 먼저 보여요.</p>');
      var s = sym ? ['요즘 왜 이렇게 움직였어요?', '지금 가장 큰 위험 요인은?', 'AI 위원회 결론을 쉽게 풀어 줘요', '수급은 어떤 흐름이에요?'] : ['오늘 시장 분위기 요약해 줘요', '스크리너는 어떻게 써요?', '기술적 적정가가 뭐예요?'];
      var d = add('ai', '<div class="chat-sugg">' + s.map(function (x) { return '<button type="button">' + esc(x) + '</button>'; }).join('') + '</div>');
      d.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { q.value = b.textContent; q.focus(); }); });
    }
    h.forEach(function (m) { add('me', esc(m.q)); add('ai', md(m.a) + meta(m)); });
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
    busy = true; send.disabled = true; q.value = '';
    add('me', esc(text));
    var wait = add('ai wait', '<i></i><i></i><i></i> ' + esc(MODEL[t.model]) + '이 답을 쓰고 있어요');
    var h = history();
    var done = function (m) { wait.remove(); h.push(m); remember(h); var d = add('ai', md(m.a) + meta(m)); bindRate(d, m); busy = false; send.disabled = false; };
    if (!g) {
      GNM.spend(t.key, '[채팅] ' + text.slice(0, 40));
      setTimeout(function () { var a2 = GNM.read(); done({ q: text, a: mockAnswer(text), model: t.model, credits: t.cost, balance: a2.credits + a2.trial }); }, 500);
      return;
    }
    if (g.track) g.track('ask_sent', { tier: t.key, symbol: symbol() });
    g.call('POST', '/ask', { tier: t.key, question: text, symbol: symbol() || undefined, page: pageText(), history: h.filter(function (m) { return m.sym === symbol(); }).slice(-3).map(function (m) { return { q: m.q, a: m.a }; }) }).then(function (r) {
      if (r.error) {
        wait.remove(); busy = false; send.disabled = false;
        if (r.error === 'NO_CREDITS') need(r.message, {}); else if (r.error === 'LOGIN_REQUIRED') need(r.message, { login: true }); else add('sys', esc(r.message || '답을 받지 못했어요.'));
        g.refresh(); return;
      }
      done({ q: text, a: r.answer, model: r.model, credits: r.credits, balance: r.balance, id: r.id, sym: symbol() });
      g.refresh();
    }).catch(function () { wait.remove(); busy = false; send.disabled = false; add('sys', '연결이 끊겼어요. 잠시 뒤 다시 해 주세요.'); });
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
    box.style.height = vv.height + 'px'; box.style.top = vv.offsetTop + 'px';
    box.classList.toggle('kb', vv.height < window.innerHeight * 0.78);
    var log = box.querySelector('.chat-log'); if (log) log.scrollTop = log.scrollHeight;
  };
  if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); }
  var shut = function () { box.hidden = true; document.documentElement.classList.remove('chat-open'); fit(); };
  var open = function (preset) {
    box.hidden = false; render(); label();
    if (phone()) document.documentElement.classList.add('chat-open');
    fit();
    if (preset) q.value = preset;
    q.focus();
    if (window.GNM && GNM.track) GNM.track('chat_open', { symbol: symbol() });
  };
  document.querySelectorAll('[data-open-chat]').forEach(function (b) { b.addEventListener('click', function () { open(b.getAttribute('data-ask') || ''); }); });
  box.querySelector('.chat-x').addEventListener('click', shut);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) shut(); });
  q.addEventListener('focus', function () { setTimeout(fit, 250); });
  box.querySelectorAll('[data-tier]').forEach(function (b) {
    b.addEventListener('click', function () { tier = b.getAttribute('data-tier'); box.querySelectorAll('[data-tier]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); label(); });
  });
  q.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  q.addEventListener('input', function () { q.style.height = 'auto'; q.style.height = Math.min(120, q.scrollHeight) + 'px'; });
  form.addEventListener('submit', function (e) { e.preventDefault(); var t = q.value.trim(); if (t.length < 2) { q.focus(); return; } ask(t); });
})();
</script>`;
