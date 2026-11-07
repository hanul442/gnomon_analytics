// G-322: the daily SNS post as an info-style carousel (한서 11/3 '정보성 게시물 참고해서 다시'): one message per
// slide, a hook line on the cover picked from the day's most surprising fact, big type on white, one call to action.
// Slides: cover → 숫자 3개 → 위원회 온도 → 오늘 채점 → 종목 의견 (≤2) → [금] 주간 성적표·가장 크게 틀린 판단 → 채점 방법 → 보내기·저장 CTA
// (Instagram weighs DM sends most for reach to non-followers, 11/7).
// The story and the X image reuse the cover's hook. Captions open with the same hook.

import { ANALYST_HORIZON } from '../analysis/analysts.js';
import { bestHits, missReason, PROMO_NOTE, weekdayOf, worstMiss, type PromoCall, type PromoDay, type PromoOpinion } from './promoCards.js';

const UP = '#F04452', DOWN = '#0582CA', FLAT = '#C9C9C6';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const md = (date: string) => `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
const sgn = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`;
const SHORT = { BULLISH: '오른다', NEUTRAL: '보합', BEARISH: '내린다' } as const;
const COLOR = { BULLISH: UP, NEUTRAL: FLAT, BEARISH: DOWN } as const;

/** A piece of hook text; `tone` colours a number. */
export interface Seg { t: string; tone?: 'up' | 'down' | undefined }
/** The day's hook: a small lead-in line and the big line (with \n breaks for the cover). */
export interface Hook { kind: 'contrast' | 'scored' | 'consensus' | 'world' | 'breadth' | 'plain'; pre: Seg[]; main: Seg[] }

export const plain = (xs: readonly Seg[]) => xs.map((x) => x.t).join('');
const toneOf = (v: number): Seg['tone'] => (v > 0 ? 'up' : v < 0 ? 'down' : undefined);

/** The day 20 trading days (weekdays) after `date`: when today's calls get scored. */
export function scoreDateOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`); let left = ANALYST_HORIZON;
  while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() % 6) left--; }
  return d.toISOString().slice(0, 10);
}

/**
 * The cover's hook, the first rule that fits:
 * 1. the market and the committee disagree (코스피 up, ≥60% of its stocks '내린다', or the reverse);
 * 2. calls were scored today ("N건, 몇 개 맞았을까요?");
 * 3. a stock where ≥6 of 7 seats agree;
 * 4. a world index moved ≥1.5%;
 * 5. the committee's lean over the 코스피 stocks; else a plain title.
 */
export function hookOf(d: PromoDay, ops: readonly PromoOpinion[]): Hook {
  const kospi = d.indices.find((x) => x.name === '코스피');
  const b = d.breadth;
  if (kospi && b && Math.abs(kospi.pct) >= 0.3) {
    const downShare = b.down / b.total, upShare = b.up / b.total;
    const against = kospi.pct > 0 ? (downShare >= 0.6 ? { share: downShare, word: '내린다' } : null) : (upShare >= 0.6 ? { share: upShare, word: '오른다' } : null);
    if (against) {
      return {
        kind: 'contrast',
        pre: [{ t: '코스피는 ' }, { t: sgn(kospi.pct).replace(/^[+−]/, ''), tone: toneOf(kospi.pct) }, { t: kospi.pct > 0 ? ' 올랐는데' : ' 내렸는데' }],
        main: [{ t: 'AI 위원회는\n' }, { t: `${Math.round(against.share * 100)}%`, tone: against.word === '내린다' ? 'down' : 'up' }, { t: `가\n'${against.word}'고\n봤어요` }],
      };
    }
  }
  if (d.scored.length) return { kind: 'scored', pre: [{ t: `20거래일 전에 남긴 판단` }], main: [{ t: `${d.scored.length}건,\n몇 개나\n맞았을까요?` }] };
  const strong = ops.find((o) => o.lead !== 'NEUTRAL' && o.seats.length >= 5 && o.leadCount >= o.seats.length - 1);
  if (strong) {
    return { kind: 'consensus', pre: [{ t: `AI 위원 ${strong.seats.length}명 중 ${strong.leadCount}명이` }], main: [{ t: `${strong.name},\n` }, { t: `'${SHORT[strong.lead]}'`, tone: strong.lead === 'BULLISH' ? 'up' : 'down' }, { t: '고\n봤어요' }] };
  }
  const big = [...d.indices].filter((x) => x.name !== '코스피' && x.name !== '코스닥').sort((a, x) => Math.abs(x.pct) - Math.abs(a.pct))[0];
  if (big && Math.abs(big.pct) >= 1.5) return { kind: 'world', pre: [{ t: `밤사이 ${big.name} ` }, { t: sgn(big.pct), tone: toneOf(big.pct) }], main: [{ t: 'AI 위원회는\n어떻게\n봤을까요?' }] };
  if (b) {
    const down = b.down >= b.up;
    return { kind: 'breadth', pre: [{ t: `${b.group} ${b.total.toLocaleString('ko-KR')}종목 중` }], main: [{ t: `${(down ? b.down : b.up).toLocaleString('ko-KR')}종목을\n` }, { t: `'${down ? '내린다' : '오른다'}'`, tone: down ? 'down' : 'up' }, { t: '고\n봤어요' }] };
  }
  return { kind: 'plain', pre: [{ t: `${md(d.date)} ${d.weekday}` }], main: [{ t: '오늘의\nAI 위원회\n리포트' }] };
}

/** Hook segments as HTML; a coloured number keeps the syllables glued to it ("73%가") on one line. */
function segHtml(xs: readonly Seg[]): string {
  let out = '', skip = 0;
  xs.forEach((x, i) => {
    const t = x.t.slice(skip); skip = 0;
    if (!x.tone) { out += esc(t); return; }
    const glue = /^[^\s]+/.exec(xs[i + 1]?.t ?? '')?.[0] ?? '';
    out += `<span style="white-space:nowrap"><span class="${x.tone}">${esc(t)}</span>${esc(glue)}</span>`;
    skip = glue.length;
  });
  return out.replace(/\n/g, '<br>');
}
const oneLine = (xs: readonly Seg[]) => plain(xs).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

function shell(w: number, h: number, body: string, fontDir: string): string {
  const face = (wt: number, f: string) => `@font-face{font-family:P;font-weight:${wt};src:url('${fontDir}/Pretendard-${f}.woff2') format('woff2')}`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${face(400, 'Regular')}${face(500, 'Medium')}${face(600, 'SemiBold')}${face(700, 'Bold')}${face(800, 'ExtraBold')}
*{box-sizing:border-box;margin:0}html,body{padding:0}body{width:${w}px;height:${h}px;overflow:hidden;position:relative;background:#fff;font-family:P,sans-serif;color:#111;letter-spacing:-0.02em;word-break:keep-all}
.f{position:absolute;inset:0;display:flex;flex-direction:column;padding:84px 80px 72px}
.top{display:flex;justify-content:space-between;font-size:28px;font-weight:600;color:#8A8A87}.brand{color:#111;font-weight:800;letter-spacing:.18em}
.bot{display:flex;justify-content:space-between;align-items:center;font-size:26px;color:#8A8A87;margin-top:24px}
.dots{display:flex;gap:10px}.dots i{width:12px;height:12px;border-radius:6px;background:#DDD}.dots i.on{width:36px;background:#111}
.k{font-size:30px;font-weight:700;color:#8A8A87;margin-bottom:20px}.h{font-weight:800;line-height:1.18}
.box{background:#F5F5F3;border-radius:40px;padding:40px 48px;flex:none}.ink{background:#111;color:#fff;border-radius:40px;padding:40px 48px;flex:none}
.up{color:${UP}}.down{color:${DOWN}}.grey{color:#8A8A87}.mid{color:#555}.fill{flex:1}</style></head><body>${body}</body></html>`;
}

function bar(b: { up: number; flat: number; down: number }, h: number, r: number, gap: number): string {
  return `<div style="display:flex;height:${h}px;border-radius:${r}px;overflow:hidden;gap:${gap}px">${([[b.up, UP], [b.flat, FLAT], [b.down, DOWN]] as const).filter(([n]) => n > 0).map(([n, c]) => `<div style="flex:${n};background:${c}"></div>`).join('')}</div>`;
}

export interface Slide { role: string; html: string }

/** Extra data the deck can show when the daily run has it (한서 11/6): the biggest stocks' signal and each opinion stock's recent closes. */
export interface DeckExtras {
  /** The largest stocks of the breadth group, biggest first: today's change and the signal's side. */
  majors?: readonly { name: string; pct: number | null; stance: keyof typeof SHORT }[];
  /** Recent daily closes per opinion symbol, oldest first. */
  closes?: ReadonlyMap<string, readonly { date: string; close: number }[]>;
}

/**
 * A line chart of recent closes on a soft area, with the 'proven wrong' price as a labelled dashed line when there is one,
 * the last close labelled at the end and the first/last dates under the axis (한서 11/6: the first one looked bare).
 */
export function priceChart(xs: readonly { date: string; close: number }[], w: number, h: number, wrong: number | null, won: (v: number) => string): string {
  if (xs.length < 5) return '';
  const vals = xs.map((x) => x.close), all = wrong != null ? [...vals, wrong] : vals;
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.12 || hi * 0.02; lo -= pad; hi += pad;
  const right = 8, X = (i: number) => (i / (xs.length - 1)) * (w - right - 8) + 8, Y = (v: number) => h - ((v - lo) / (hi - lo)) * h;
  const pts = vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  const last = vals.at(-1)!, chg = (last / vals[0]! - 1) * 100, lx = X(xs.length - 1), ly = Y(last);
  const area = `<polygon points="${X(0).toFixed(1)},${h} ${pts.join(' ')} ${lx.toFixed(1)},${h}" fill="url(#g)"/>`;
  const wy = wrong != null ? Y(wrong) : null;
  const wl = wy != null ? `<line x1="0" x2="${w}" y1="${wy.toFixed(1)}" y2="${wy.toFixed(1)}" stroke="#111" stroke-opacity=".45" stroke-width="3" stroke-dasharray="12 10"/>` : '';
  return `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:18px"><span style="font-size:28px;font-weight:700" class="grey">최근 ${xs.length}거래일${wrong != null ? ' · 점선이 틀리는 가격' : ` · ${md(xs[0]!.date)}부터`}</span><span style="font-size:34px;font-weight:800">${won(last)} <span class="${chg > 0 ? 'up' : chg < 0 ? 'down' : 'grey'}" style="font-size:30px">${sgn(chg, 1)}</span></span></div>
<div style="position:relative;width:${w}px;height:${h}px"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#111" stop-opacity=".10"/><stop offset="1" stop-color="#111" stop-opacity="0"/></linearGradient></defs>${area}${wl}<polyline points="${pts.join(' ')}" fill="none" stroke="#111" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="12" fill="#fff" stroke="#111" stroke-width="5"/></svg></div>`;
}

/** The carousel for one day. `fontDir` as in promoCards.page. */
export function deckSlides(d: PromoDay, ops: readonly PromoOpinion[], fontDir: string, weekly: boolean, more: DeckExtras = {}): Slide[] {
  const hook = hookOf(d, ops);
  const scoreDate = ops[0]?.scoreDate ?? scoreDateOf(d.date);
  const head = `<div class="top"><span class="brand">GNOMON</span><span>${md(d.date)} ${d.weekday} · 오늘의 AI 위원회</span></div>`;
  const parts: { role: string; body: string }[] = [];

  parts.push({ role: 'cover', body: `<div class="fill" style="display:flex;flex-direction:column;justify-content:center">
<div class="h grey" style="font-size:72px">${segHtml(hook.pre)}</div>
<div class="h" style="font-size:${plain(hook.main).split('\n').some((l) => l.length > 9) ? 96 : 116}px;margin-top:24px">${segHtml(hook.main)}</div>
<div style="font-size:38px;font-weight:600;color:#555;margin-top:48px">왜 그렇게 봤는지, 20거래일 뒤에 맞았는지까지</div></div>` });

  const kospi = d.indices.find((x) => x.name === '코스피'), kosdaq = d.indices.find((x) => x.name === '코스닥');
  const other = [...d.indices].filter((x) => x !== kospi && x !== kosdaq).sort((a, x) => Math.abs(x.pct) - Math.abs(a.pct))[0];
  const three = [kospi, kosdaq, other].filter((x): x is NonNullable<typeof x> => !!x);
  if (three.length) {
    // The whole summary (≤150 chars, whole sentences), not just its first line (한서 11/6 '왜 짤리지').
    const lead = d.summary;
    parts.push({ role: 'market', body: `<div style="margin-top:96px"><div class="k">오늘 시장, 숫자 ${three.length}개</div></div>
${three.map((x) => `<div style="border-top:2px solid #EAEAEA;padding:32px 0;display:flex;justify-content:space-between;align-items:baseline"><span class="h" style="font-size:56px">${esc(x.name)}</span><span class="h ${toneOf(x.pct) ?? ''}" style="font-size:96px">${sgn(x.pct)}</span></div>`).join('')}
${lead ? `<div class="box" style="margin-top:8px;font-size:${lead.length > 110 ? 32 : 34}px;line-height:1.55;color:#333">${esc(lead)}</div>` : ''}<div class="fill"></div>` });
  }

  if (d.breadth) {
    const b = d.breadth, down = b.down >= b.up, word = down ? '내린다' : '오른다', majors = (more.majors ?? []).slice(0, 5);
    const against = kospi && Math.abs(kospi.pct) >= 0.3 && (kospi.pct > 0) === down;
    const title = against ? `시장은 ${kospi!.pct > 0 ? '올랐지만' : '내렸지만'}<br>위원 다수는 '${word}'였어요` : `위원 다수는<br>'${word}'였어요`;
    parts.push({ role: 'breadth', body: `<div style="margin-top:96px"><div class="k">AI 위원회 온도 · ${esc(b.group)} ${b.total.toLocaleString('ko-KR')}종목</div>
<div class="h" style="font-size:72px">${title}</div></div>
${majors.length ? `<div style="margin-top:56px">${bar(b, 88, 24, 8)}</div>
<div style="display:flex;justify-content:space-between;margin-top:20px;font-size:36px;font-weight:700"><span class="up">오른다 ${b.up}</span><span class="grey">보합 ${b.flat}</span><span class="down">내린다 ${b.down}</span></div>
<div style="margin-top:48px"><div style="font-size:28px;font-weight:700;color:#8A8A87;margin-bottom:6px">시가총액 큰 종목은</div>${majors.map((m) => `<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:36px;padding:16px 0;border-top:2px solid #EAEAEA"><b style="min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(m.name)}</b><span style="flex:none">${m.pct == null ? '' : `<span class="grey" style="font-size:30px">오늘 ${sgn(m.pct, 1)}</span> · `}<b class="${m.stance === 'BULLISH' ? 'up' : m.stance === 'BEARISH' ? 'down' : 'grey'}">${SHORT[m.stance]}</b></span></div>`).join('')}</div>
<div style="font-size:28px;color:#666;margin-top:20px">위원회는 오늘 하루가 아니라 20거래일 뒤를 봐요</div>` : `<div style="margin-top:80px">${bar(b, 120, 30, 8)}</div>
<div style="display:flex;justify-content:space-between;margin-top:28px;font-size:40px;font-weight:700"><span class="up">오른다 ${b.up}</span><span class="grey">보합 ${b.flat}</span><span class="down">내린다 ${b.down}</span></div>
<div class="box" style="margin-top:72px;font-size:36px;line-height:1.55;color:#333">위원회는 오늘 하루가 아니라 <b>20거래일 뒤</b>를 봐요. 그래서 시장과 반대로 볼 때도 있어요.</div>`}<div class="fill"></div>` });
  }

  if (d.scored.length) {
    const ok = d.scored.filter((x) => x.hit).length, hits = bestHits(d.scored, 3), miss = worstMiss(d.scored);
    const line = (x: PromoCall) => `<div style="display:flex;justify-content:space-between;gap:24px;font-size:36px;padding:22px 0;border-top:2px solid #EAEAEA"><span style="min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"><b>${esc(x.name)}</b> <span class="grey">· ${SHORT[x.stance]}</span></span><b class="${x.hit ? '' : 'grey'}" style="flex:none">${x.hit ? '✓ 맞음' : '✗ 틀림'}</b></div>`;
    parts.push({ role: 'scored', body: `<div style="margin-top:96px"><div class="k">오늘 채점 · 20거래일 전 판단</div>
<div class="h" style="font-size:80px">${d.scored.length}건 중<br>${ok}건 맞혔어요</div></div>
<div style="margin-top:56px">${[...hits, ...(miss && !hits.includes(miss) ? [miss] : [])].slice(0, 4).map(line).join('')}</div>
<div style="font-size:30px;color:#666;margin-top:24px">틀림 ${d.scored.length - ok}건도 사이트에 그대로 있어요</div><div class="fill"></div>` });
  }

  ops.forEach((o, i) => {
    const leadTone = o.lead === 'BULLISH' ? 'up' : o.lead === 'BEARISH' ? 'down' : '';
    const others = o.seats.length - o.leadCount;
    const cond = o.invalidation != null && o.lead !== 'NEUTRAL'
      ? `종가가 ${/\.[A-Z]+$/.test(o.symbol) ? `$${o.invalidation.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `${Math.round(o.invalidation).toLocaleString('ko-KR')}원`}${o.lead === 'BULLISH' ? ' 아래로<br>내려가면' : ' 위로<br>올라가면'} 틀린 판단`
      : `${md(o.scoreDate)} 종가로<br>맞았는지 채점해요`;
    const won = (v: number) => (/\.[A-Z]+$/.test(o.symbol) ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `${Math.round(v).toLocaleString('ko-KR')}원`);
    const chart = priceChart((more.closes?.get(o.symbol) ?? []).slice(-60), 920, 150, o.lead !== 'NEUTRAL' ? o.invalidation : null, won);
    const size = Math.max(32, Math.min(96, Math.floor(880 / o.seats.length) - 22));
        if (chart) {
      // With a chart: the seats stay full size (한서 11/6 '위원회 애들이 작게 바뀐거'), the chart takes the room under
      // them and the 'proven wrong' box gets one line.
      parts.push({ role: `opinion${i + 1}`, body: `<div style="margin-top:96px"><div class="k">종목 의견 ${i + 1} / ${ops.length}${others ? ` · 다른 의견 ${others}명` : ''}</div>
<div class="h" style="font-size:${o.name.length > 12 ? 64 : 96}px;overflow-wrap:anywhere">${esc(o.name)}</div>
<div class="h" style="font-size:64px;margin-top:28px">위원 ${o.seats.length}명 중 <span class="${leadTone}">${o.leadCount}명</span>이<br>${o.lead === 'NEUTRAL' ? '크게 안 움직인다고 봤어요' : `'${SHORT[o.lead]}'고 봤어요`}</div></div>
<div style="display:flex;gap:22px;margin-top:48px">${o.seats.map((s) => `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${COLOR[s.stance]}"></div>`).join('')}</div>
<div style="font-size:28px;margin-top:16px" class="grey">위원 한 명이 점 하나 · <span class="up">●</span> 오른다 <span style="color:${FLAT}">●</span> 보합 <span class="down">●</span> 내린다</div>
<div class="fill"></div><div style="margin-bottom:28px">${chart}</div>
<div class="ink" style="padding:28px 44px"><div style="font-size:26px;font-weight:700;color:#9A9A97">이러면 틀린 거예요 · ${md(o.scoreDate)} 채점</div><div style="font-size:34px;font-weight:600;line-height:1.4;margin-top:8px">${cond.replace('<br>', ' ')}</div></div>` });
      return;
    }
    parts.push({ role: `opinion${i + 1}`, body: `<div style="margin-top:96px"><div class="k">종목 의견 ${i + 1} / ${ops.length}${others ? ` · 다른 의견 ${others}명` : ''}</div>
<div class="h" style="font-size:${o.name.length > 12 ? 64 : 96}px;overflow-wrap:anywhere">${esc(o.name)}</div>
<div class="h" style="font-size:64px;margin-top:28px">위원 ${o.seats.length}명 중 <span class="${leadTone}">${o.leadCount}명</span>이<br>${o.lead === 'NEUTRAL' ? '크게 안 움직인다고 봤어요' : `'${SHORT[o.lead]}'고 봤어요`}</div></div>
<div style="display:flex;gap:22px;margin-top:64px">${o.seats.map((s) => `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${COLOR[s.stance]}"></div>`).join('')}</div>
<div style="font-size:28px;margin-top:20px" class="grey">위원 한 명이 점 하나 · <span class="up">●</span> 오른다 <span style="color:${FLAT}">●</span> 보합 <span class="down">●</span> 내린다</div>
<div class="fill"></div>
<div class="ink"><div style="font-size:28px;font-weight:700;color:#9A9A97">이러면 틀린 거예요 · ${md(o.scoreDate)} 채점</div><div style="font-size:40px;font-weight:600;line-height:1.45;margin-top:12px">${cond}</div></div>` });
  });

  if (weekly && d.week.length) {
    const ok = d.week.filter((x) => x.hit).length, hits = bestHits(d.week, 4);
    parts.push({ role: 'week', body: `<div style="margin-top:96px"><div class="k">이번 주 성적표 · ${md(d.weekFrom)}–${md(d.date)}</div>
<div class="h" style="font-size:80px">${d.week.length ? `채점 ${d.week.length}건 중<br>${ok}건 맞혔어요` : '이번 주는<br>채점할 판단이 없었어요'}</div></div>
<div style="margin-top:56px">${hits.map((x) => `<div style="font-size:36px;padding:22px 0;border-top:2px solid #EAEAEA;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">✓ <b>${esc(x.name)}</b> <span class="grey">· ${esc(x.member)} · ${md(x.baseDate)}에 '${SHORT[x.stance]}'</span></div>`).join('')}</div>
${d.week.length ? `<div style="font-size:30px;color:#666;margin-top:24px">틀린 ${d.week.length - ok}건 중 가장 크게 틀린 건 다음 장에</div>` : ''}<div class="fill"></div>` });
    const x = worstMiss(d.week);
    if (x) {
      parts.push({ role: 'miss', body: `<div style="margin-top:96px"><div class="k">이번 주 가장 크게 틀린 판단</div>
<div class="h" style="font-size:88px">${esc(x.name)}</div>
<div class="h" style="font-size:56px;margin-top:24px">${esc(x.member)}가<br>${md(x.baseDate)}에 '${SHORT[x.stance]}'</div></div>
<div class="ink" style="margin-top:64px"><div style="font-size:28px;font-weight:700;color:#9A9A97">어떻게 틀렸나</div><div style="font-size:40px;font-weight:600;line-height:1.5;margin-top:12px">${esc(missReason(x))}</div></div>
<div style="font-size:32px;line-height:1.5;color:#555;margin-top:40px">판단은 미리 기록되고 고칠 수 없어요. 그래서 틀린 것도 이렇게 남아요.</div><div class="fill"></div>` });
    }
  }

  parts.push({ role: 'how', body: `<div style="margin-top:96px"><div class="k">그노몬은 이렇게 채점해요</div>
<div class="h" style="font-size:72px">맞힌 것도 틀린 것도<br>전부 공개해요</div></div>
<div style="display:flex;flex-direction:column;gap:28px;margin-top:72px">${[['1', '오늘 판단을 기록하고 잠가요', '나중에 고칠 수 없어요'], ['2', '20거래일 뒤 종가로 채점', `오늘 판단은 ${md(scoreDate)}에`], ['3', '틀린 판단은 이유까지 공개', '매주 금요일 성적표로']].map(([a, t, s]) => `<div class="box" style="display:flex;gap:36px;align-items:center"><div class="h" style="font-size:72px;width:64px">${a}</div><div><div class="h" style="font-size:44px">${t}</div><div style="font-size:32px;color:#666;margin-top:6px">${s}</div></div></div>`).join('')}</div><div class="fill"></div>` });

  parts.push({ role: 'cta', body: `<div class="fill" style="display:flex;flex-direction:column;justify-content:center">
<div class="h" style="font-size:104px">${md(scoreDate)}에<br>맞았는지<br>같이 확인해요</div>
<div style="display:flex;gap:20px;margin-top:64px"><div class="ink" style="font-size:40px;font-weight:700;padding:28px 44px">주식하는 친구에게 보내기</div><div class="box" style="font-size:40px;font-weight:700;padding:28px 44px">저장</div></div>
<div style="font-size:36px;color:#555;margin-top:56px;line-height:1.5">전체 리포트와 위원들의 토론은<br>프로필 링크의 그노몬에서 봐요 (무료)<br>베타 준비 중 · 팔로우하면 모집 소식을 먼저 알려드려요</div></div>` });

  const n = parts.length;
  return parts.map((p, i) => ({
    role: p.role,
    html: shell(1080, 1350, `<div class="f">${head}${p.body}<div class="bot"><div class="dots">${parts.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div><span>${i < n - 1 ? '넘겨서 보기 →' : PROMO_NOTE}</span></div></div>`, fontDir),
  }));
}

export function deckStoryHtml(d: PromoDay, ops: readonly PromoOpinion[], fontDir: string): string {
  const hook = hookOf(d, ops), b = d.breadth;
  return shell(1080, 1920, `<div class="f" style="padding:120px 80px 140px"><div class="top"><span class="brand">GNOMON</span><span>${md(d.date)} ${d.weekday}</span></div>
<div class="fill" style="display:flex;flex-direction:column;justify-content:center">
<div class="k" style="font-size:36px">오늘의 AI 위원회</div>
<div class="h grey" style="font-size:76px">${segHtml(hook.pre)}</div>
<div class="h" style="font-size:${plain(hook.main).split('\n').some((l) => l.length > 9) ? 108 : 128}px;margin-top:20px">${segHtml(hook.main)}</div>
${b ? `<div style="margin-top:72px">${bar(b, 72, 24, 6)}</div><div style="font-size:34px;color:#555;margin-top:20px">${esc(b.group)} ${b.total.toLocaleString('ko-KR')}종목 · 오른다 ${b.up} · 보합 ${b.flat} · 내린다 ${b.down}</div>` : ''}</div>
<div class="ink" style="font-size:40px;font-weight:700;text-align:center">이유와 종목 의견은 프로필의 게시물에서</div>
<div style="font-size:26px;text-align:center;margin-top:24px" class="grey">${PROMO_NOTE}</div></div>`, fontDir);
}

export function deckXHtml(d: PromoDay, ops: readonly PromoOpinion[], fontDir: string): string {
  const hook = hookOf(d, ops), b = d.breadth;
  const side = [
    b ? `<div style="font-size:24px;font-weight:700" class="grey">${esc(b.group)} ${b.total.toLocaleString('ko-KR')}종목 위원회 판단</div><div style="margin-top:20px">${bar(b, 56, 18, 5)}</div><div style="display:flex;justify-content:space-between;font-size:26px;font-weight:700;margin-top:14px"><span class="up">${b.up}</span><span class="grey">${b.flat}</span><span class="down">${b.down}</span></div>` : '',
    ops.length ? `<div style="${b ? 'border-top:2px solid #E3E3E0;margin-top:28px;padding-top:24px;' : ''}font-size:28px;line-height:1.7">${ops.map((o) => `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b>${esc(o.name)}</b> ${o.seats.length}명 중 ${o.leadCount}명 <span class="${o.lead === 'BULLISH' ? 'up' : o.lead === 'BEARISH' ? 'down' : 'grey'}">${SHORT[o.lead]}</span></div>`).join('')}</div>` : '',
  ].join('');
  return shell(1200, 675, `<div style="position:absolute;inset:0;display:grid;grid-template-columns:${side ? '1.15fr 1fr' : '1fr'};gap:56px;padding:64px 72px;align-items:center">
<div style="min-width:0"><div class="top" style="font-size:24px;margin-bottom:36px"><span class="brand">GNOMON</span></div><div class="h grey" style="font-size:44px">${segHtml(hook.pre)}</div><div class="h" style="font-size:72px;margin-top:12px">${segHtml(hook.main.map((s) => ({ ...s, t: s.t.replace(/\n/g, ' ') })))}</div><div style="font-size:24px;margin-top:36px" class="grey">${md(d.date)} ${d.weekday} · 20거래일 뒤 채점 · 교육용 자료</div></div>
${side ? `<div class="box" style="padding:40px;min-width:0">${side}</div>` : ''}</div>`, fontDir);
}

/** Instagram caption: the hook, three short points, one call to action, the note, four tags. */
export function deckInstaCaption(d: PromoDay, ops: readonly PromoOpinion[]): string {
  const hook = hookOf(d, ops), b = d.breadth;
  const kospi = d.indices.find((x) => x.name === '코스피'), kosdaq = d.indices.find((x) => x.name === '코스닥');
  const scoreDate = ops[0]?.scoreDate ?? scoreDateOf(d.date);
  const pts = [
    kospi ? `· 코스피 ${sgn(kospi.pct)}${kosdaq ? `, 코스닥 ${sgn(kosdaq.pct)}` : ''}` : '',
    b ? `· 위원회 판단: ${b.group} ${b.total.toLocaleString('ko-KR')}종목 중 ${b.down >= b.up ? `${b.down}종목 '내린다'` : `${b.up}종목 '오른다'`}` : '',
    d.scored.length ? `· 20거래일 전 판단 채점: ${d.scored.length}건 중 ${d.scored.filter((x) => x.hit).length}건 맞음` : '',
    ops.length ? `· ${ops.map((o) => `${o.name} ${o.seats.length}명 중 ${o.leadCount}명 '${SHORT[o.lead]}'`).join(', ')}` : '',
  ].filter(Boolean);
  return [`${oneLine(hook.pre)} ${oneLine(hook.main)}`.replace(/봤어요$/, '봤어요.'), '', `${md(d.date)} ${weekdayOf(d.date)} 코스피·코스닥 마감, 그노몬 AI 위원회 기록이에요.`, ...pts, '',
    `모든 판단은 잠가 두고 20거래일 뒤(${md(scoreDate)})에 채점해요. 틀려도 그대로 공개해요.`, `🔖 저장해 두고 ${md(scoreDate)}에 같이 확인해요. 주식하는 친구에게도 보내 주세요.`, '📝 한 주 채점 정리는 매주 금요일 블로그에, 짧은 기록은 X(@gnomonanalytics)에 올려요. 링크는 프로필에.', '',
    `${PROMO_NOTE}. 투자 판단과 책임은 본인에게 있어요.`, '#코스피 #주식공부 #오늘의증시 #AI주식 #그노몬'].join('\n');
}

/** X post (≤280 weighted; the site line is swapped for the profile pointer when posting without links). */
export function deckXCaption(d: PromoDay, ops: readonly PromoOpinion[], site: string): string {
  const hook = hookOf(d, ops);
  const scoreDate = ops[0]?.scoreDate ?? scoreDateOf(d.date);
  const lines = [
    ...(d.scored.length ? [`· 20거래일 전 판단 ${d.scored.length}건 중 ${d.scored.filter((x) => x.hit).length}건 맞음`] : []),
    ...ops.map((o) => `· ${o.name}: ${o.seats.length}명 중 ${o.leadCount}명 '${SHORT[o.lead]}'`),
  ].slice(0, 3);
  return [`${oneLine(hook.pre)} ${oneLine(hook.main)}`, '', `${md(d.date)} 기록`, ...lines, '', `${md(scoreDate)}에 채점하고, 틀려도 공개해요.`, `${site}?utm_source=x`, `(${PROMO_NOTE})`].join('\n');
}
