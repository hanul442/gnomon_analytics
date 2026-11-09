// 오늘의 한 판 on home (G-338, 목업 https://claude.ai/artifact/BBvWhef9y5oLaRaU2Ftw55): the open question with the
// committee's seats and one tap to answer, the last scored turn above it (committee and me), and this week's record
// as weekday circles. The reader's answers live in the browser (gnm-hanpan); the API only counts them, anonymously.

import { hanpanDeadline, type HanpanPick, type HanpanState } from '../analysis/hanpan.js';
import { esc } from './html.js';
import { won } from './format.js';

const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
const pct = (a: number, b: number) => (b / a - 1) * 100;
const word = (l: 'up' | 'down') => (l === 'up' ? '오른다' : '내린다');

function dots(p: HanpanPick): string {
  const cls: Record<string, string> = { u: 'u', n: 'n', d: 'd', a: 'n' };
  return `<div class="hp-seats" aria-hidden="true">${p.dots.map((d) => `<i class="hp-dot ${cls[d]}"></i>`).join('')}</div>`;
}

function result(p: HanpanPick): string {
  const m = pct(p.baseClose, p.endClose!), up = m > 0, flat = m === 0;
  return `<div class="hp-res" data-hp-res="${esc(p.baseDate)}" data-hp-move="${up ? 'up' : flat ? 'flat' : 'down'}">
<p class="hp-k">${esc(md(p.endDate!))} 한 판 · ${esc(p.name)} 종가 ${esc(won(p.endClose!))}</p>
<p class="hp-mv ${up ? 'up' : flat ? '' : 'down'}">${flat ? '그대로' : `${up ? '▲' : '▼'} ${Math.abs(m).toFixed(1)}%`}</p>
<div class="hp-two"><div><small>위원회 · ${word(p.lean)} ${p.lean === 'up' ? `${p.bull}:${p.bear}` : `${p.bear}:${p.bull}`}</small><b>${p.hit ? '맞았어요' : '틀렸어요'}</b></div><div data-hp-me><small>나</small><b>안 골랐어요</b></div></div>
</div>`;
}

function question(p: HanpanPick): string {
  const side = p.lean === 'up' ? p.bull : p.bear, total = p.dots.length;
  return `<div class="hp-q" data-hp-q="${esc(p.baseDate)}" data-hp-end="${esc(hanpanDeadline(p.baseDate))}" data-hp-sym="${esc(p.symbol)}">
<p class="hp-k">${esc(p.name)} · ${esc(md(p.baseDate))} 종가 ${esc(won(p.baseClose))}</p>
<p class="hp-t">다음 장 종가는 이보다 <b>오를까요, 내릴까요?</b></p>
${dots(p)}<p class="hp-sl">위원회 ${total}명 중 ${side}명이 ${word(p.lean)} 쪽이에요 <a href="${esc(p.symbol)}/index.html">판단 보기 ›</a></p>
${p.why ? `<p class="hp-why">${esc(p.why)}</p>` : ''}
<p class="hp-wrong">종가가 ${esc(won(p.baseClose))} ${p.lean === 'up' ? '위로' : '아래로'} 닫히지 않으면 위원회가 틀린 거예요.</p>
<div class="hp-btns"><button type="button" class="hp-b" data-hp-pick="up">오른다</button><button type="button" class="hp-b" data-hp-pick="down">내린다</button></div>
<p class="hp-foot" data-hp-foot>15:30 장 마감까지 고를 수 있어요 · 투자 권유가 아니에요</p>
</div>`;
}

/** The home block, '' before the first pick. */
export function hanpanBlock(state: HanpanState): string {
  const picks = state.picks;
  if (!picks.length) return '';
  const open = picks.at(-1)!.endDate ? null : picks.at(-1)!;
  const last = [...picks].reverse().find((p) => p.endDate);
  // Scored turns of the last 10 for the weekday circles (the page keeps the ones of this week).
  const week = picks.filter((p) => p.endDate).slice(-10).map((p) => ({ d: p.endDate, b: p.baseDate, l: p.lean, h: p.hit ? 1 : 0, m: p.endClose! > p.baseClose ? 'up' : p.endClose! < p.baseClose ? 'down' : 'flat' }));
  return `<section class="hp" id="hanpan" aria-labelledby="hp-h">
<div class="hp-h"><h2 id="hp-h">오늘의 한 판</h2><span>${open ? '15:30 마감 · 저녁에 채점' : '다음 판은 저녁에 열려요'}</span></div>
${open ? question(open) : ''}
${last ? result(last) : ''}
<div class="hp-wk-wrap" data-hp-week='${esc(JSON.stringify(week))}' hidden><p class="hp-k">이번 주 내 기록</p><div class="hp-wk"></div><p class="hp-sc"></p></div>
</section>`;
}

export const HANPAN_CSS = `<style>
.hp{display:flex;flex-direction:column;gap:14px;margin:8px 4px 4px;font-variant-numeric:tabular-nums}
.hp-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px}.hp-h h2{margin:0;font-size:24px;letter-spacing:-.3px}.hp-h span{font-size:14px;color:var(--muted);text-align:right}
.hp p{margin:0}.hp-k{font-size:15px;color:var(--muted)}
.hp-t{margin:4px 0 14px!important;font-size:21px;line-height:1.38;font-weight:600;letter-spacing:-.3px;color:var(--fg)}.hp-t b{font-weight:700}
.hp-seats{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 6px}.hp-dot{width:11px;height:11px;border-radius:50%;background:var(--line-strong,#D6D9DE)}.hp-dot.u{background:var(--up,#F04452)}.hp-dot.d{background:var(--down,#0582CA)}
.hp-sl{font-size:14px;color:var(--fg2)}.hp-sl a{color:var(--muted);text-decoration:none;margin-left:4px}
.hp-why{margin:12px 0 4px!important;font-size:15px;line-height:1.5;color:var(--fg2)}
.hp-wrong{font-size:14px;line-height:1.5;color:var(--muted);margin:0 0 16px!important}
.hp-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.hp-b{height:52px;border-radius:44px;border:1px solid var(--line-strong,#C9CDD3);background:none;font:inherit;font-size:16px;font-weight:600;color:var(--fg);cursor:pointer;transition:transform 150ms cubic-bezier(.2,1.4,.4,1),background-color 150ms}
.hp-b:active{transform:scale(.96)}.hp-b[aria-pressed=true]{background:var(--fg);color:var(--bg,#fff);border-color:var(--fg)}.hp-b[aria-pressed=false].hp-off{color:var(--muted)}.hp-b:disabled{cursor:default}
.hp-foot{margin:10px 2px 0!important;font-size:13px;color:var(--muted)}
.hp-res{padding:16px 0 0;border-top:1px solid var(--line)}
.hp-q+.hp-res{margin-top:6px}
.hp-mv{margin:2px 0 12px!important;font-size:28px;font-weight:700;letter-spacing:-.5px;color:var(--fg)}.hp-mv.up{color:var(--up,#F04452)}.hp-mv.down{color:var(--down,#0582CA)}
.hp-two{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line);border-radius:16px;overflow:hidden}.hp-two div{padding:12px 14px;min-width:0}.hp-two div+div{border-left:1px solid var(--line)}
.hp-two small{display:block;font-size:13px;color:var(--muted);margin:0 0 2px}.hp-two b{font-size:18px}
.hp-wk{display:flex;gap:6px;margin:6px 0}.hp-wk i{font-style:normal;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:600;background:var(--soft,#F3F4F6);color:var(--muted)}
.hp-wk i.ok{background:var(--fg);color:var(--bg,#fff)}.hp-wk i.x{background:none;border:1px solid var(--line-strong,#C9CDD3)}.hp-wk i.today{outline:2px solid var(--fg);outline-offset:2px}
.hp-sc{font-size:15px;color:var(--fg2)}.hp-sc b{font-weight:700}
@media (prefers-reduced-motion:reduce){.hp-b{transition:none}}
</style>`;

/** Reads and keeps the reader's answers (gnm-hanpan: { baseDate: 'up'|'down' }), locks at the deadline, fills 나 and the week. */
export const HANPAN_JS = `<script>
(function () {
  var box = document.getElementById('hanpan'); if (!box) return;
  var KEY = 'gnm-hanpan';
  var read = function () { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  var write = function (m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} };
  var mine = read();
  var q = box.querySelector('[data-hp-q]');
  var paint = function () {
    if (!q) return;
    var day = q.getAttribute('data-hp-q'), pick = mine[day], shut = Date.now() >= Date.parse(q.getAttribute('data-hp-end'));
    q.querySelectorAll('[data-hp-pick]').forEach(function (b) {
      var me = b.getAttribute('data-hp-pick') === pick;
      b.setAttribute('aria-pressed', String(me)); b.classList.toggle('hp-off', !!pick && !me); b.disabled = shut;
      b.textContent = (me ? '✓ ' : '') + (b.getAttribute('data-hp-pick') === 'up' ? '오른다' : '내린다');
    });
    var foot = q.querySelector('[data-hp-foot]');
    if (foot) foot.textContent = shut ? (pick ? '마감됐어요. 저녁에 위원회와 같이 채점해요.' : '오늘 판은 마감됐어요. 저녁에 다음 판이 열려요.') : pick ? '골랐어요. 15:30 전까지는 바꿀 수 있어요. 저녁에 채점해요.' : '15:30 장 마감까지 고를 수 있어요 · 투자 권유가 아니에요';
  };
  if (q) q.querySelectorAll('[data-hp-pick]').forEach(function (b) {
    b.addEventListener('click', function () {
      var day = q.getAttribute('data-hp-q'), s = b.getAttribute('data-hp-pick');
      if (Date.now() >= Date.parse(q.getAttribute('data-hp-end'))) return;
      mine[day] = s; write(mine); paint();
      var meta = document.querySelector('meta[name=gnm-api]'), v = ''; try { v = localStorage.getItem('gnm-vid') || ''; } catch (e) {}
      if (meta && v && !navigator.webdriver) fetch(meta.content.replace(/[/]$/, '') + '/hanpan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: v, day: day, s: s }), keepalive: true }).catch(function () {});
    });
  });
  paint();
  var res = box.querySelector('[data-hp-res]');
  if (res) {
    var day = res.getAttribute('data-hp-res'), mv = res.getAttribute('data-hp-move'), p = mine[day], cell = res.querySelector('[data-hp-me]');
    if (p && cell) cell.innerHTML = '<small>나 · ' + (p === 'up' ? '오른다' : '내린다') + '</small><b>' + (p === mv ? '맞았어요' : '틀렸어요') + '</b>';
  }
  // This KST week's turns, Monday to Friday, by the session that was scored.
  var wrap = box.querySelector('[data-hp-week]'), rows = []; try { rows = JSON.parse(wrap.getAttribute('data-hp-week')) || []; } catch (e) {}
  var k = new Date(Date.now() + 324e5), dow = (k.getUTCDay() + 6) % 7, mon = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - dow));
  var iso = function (d) { return d.toISOString().slice(0, 10); }, today = iso(k).slice(0, 10);
  var cells = [], me = 0, meN = 0, com = 0, comN = 0, any = false;
  for (var i = 0; i < 5; i++) {
    var d = iso(new Date(mon.getTime() + i * 864e5)), r = rows.filter(function (x) { return x.d === d; })[0], cls = '';
    if (r) { comN++; com += r.h; var p = mine[r.b]; if (p) { any = true; meN++; if (p === r.m) { me++; cls = 'ok'; } else cls = 'x'; } }
    if (d === today) cls += ' today';
    cells.push('<i class="' + cls + '">' + '월화수목금'[i] + '</i>');
  }
  if (wrap && (any || Object.keys(mine).length)) {
    wrap.querySelector('.hp-wk').innerHTML = cells.join('');
    wrap.querySelector('.hp-sc').innerHTML = '이번 주 <b>나 ' + me + '/' + meN + '</b> · 위원회 ' + com + '/' + comN;
    wrap.hidden = false;
  }
})();
</script>`;

