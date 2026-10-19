// G-250: checking what a reader drew on the chart (docs/DESIGN.md G-250). Pure functions.
//
// The reader draws with the chart's tools (chartDraw.ts) and asks for a review. Before any AI is called,
// each drawing is measured against the daily bars: are its anchors on real swing highs/lows, how many times
// did price touch it, how often did a close cut through it, did the Fibonacci start at the range's real
// extremes. The AI coach (worker/ask.ts DRAW_SYSTEM) only explains these numbers as technique.
//
// Education only (docs/BETA_PLAN.md §1): the checks describe how a drawing fits past prices. Nothing here
// says where price goes next or whether to buy or sell, and the position / buy-sell mark tools are not reviewed.

export interface DrawBar { t: string; o: number; h: number; l: number; c: number }
/** A point as chartDraw.ts stores it: a bar date, or `d` bars past the last bar (drawn into the future). */
export interface DrawPoint { t?: string; d?: number; p: number }
export interface DrawShape { k: string; pts: DrawPoint[] }

export interface DrawCheck { label: string; ok: boolean | null; detail: string }
export interface ShapeReview { n: number; k: string; name: string; checks: DrawCheck[]; facts: string[] }
export interface DrawReview { items: ShapeReview[]; skipped: { n: number; k: string; name: string; why: string }[]; bars: number; from: string; to: string }

/** Tools the review reads, with their Korean names (same labels as the chart's tool bar). */
export const REVIEWED: Record<string, string> = {
  trend: '추세선', ray: '레이', ext: '연장선', hline: '수평선', hray: '수평 레이', channel: '평행 채널',
  fib: '피보나치 되돌림', fibext: '피보나치 확장', rect: '박스',
};
/** Tools left out, and why. Positions and buy/sell marks are trading calls, not technique. */
export const SKIPPED: Record<string, [string, string]> = {
  long: ['롱 포지션', '매매 계획이라 평가하지 않아요'], short: ['숏 포지션', '매매 계획이라 평가하지 않아요'],
  up: ['위 표시', '매수·매도 표시라 평가하지 않아요'], down: ['아래 표시', '매수·매도 표시라 평가하지 않아요'],
  text: ['텍스트', '글이라 평가할 기법이 없어요'], note: ['메모', '글이라 평가할 기법이 없어요'], brush: ['펜', '자유 그림이라 평가할 기준이 없어요'],
  vline: ['수직선', '날짜 표시라 평가할 기준이 없어요'], fibtime: ['피보나치 시간대', '아직 평가하지 않는 도구예요'],
  gann: ['갠 팬', '아직 평가하지 않는 도구예요'], measure: ['가격·기간 측정', '재는 도구라 평가할 기준이 없어요'],
  arrow: ['화살표 선', '표시용 선이라 평가하지 않아요'],
};

export const MAX_SHAPES = 12;
/** About a year of daily bars: the request body stays under the API's 24 KB limit (bars go as [t,o,h,l,c]). */
export const MAX_BARS = 260;
const PIVOT = 3;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Bars from the request ([date, open, high, low, close] or {t,o,h,l,c}), kept only when well formed and in date order. */
export function cleanBars(raw: unknown): DrawBar[] {
  if (!Array.isArray(raw)) return [];
  const out: DrawBar[] = [];
  for (const b of raw.slice(-MAX_BARS)) {
    const x = (Array.isArray(b) ? { t: b[0], o: b[1], h: b[2], l: b[3], c: b[4] } : b) as Partial<DrawBar>;
    if (!x || typeof x.t !== 'string' || !DATE.test(x.t) || ![x.o, x.h, x.l, x.c].every((v) => num(v) && v > 0)) continue;
    if (x.h! < Math.max(x.o!, x.c!, x.l!) * 0.999 || x.l! > Math.min(x.o!, x.c!, x.h!) * 1.001) continue;
    if (out.length && out[out.length - 1]!.t >= x.t) continue;
    out.push({ t: x.t, o: x.o!, h: x.h!, l: x.l!, c: x.c! });
  }
  return out;
}

/** Shapes from the request: known tool, 1–3 points (the pen is skipped anyway), numbers only. */
export function cleanShapes(raw: unknown): DrawShape[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 40).flatMap((s): DrawShape[] => {
    const x = s as { k?: unknown; pts?: unknown };
    if (!x || typeof x.k !== 'string' || !(x.k in REVIEWED || x.k in SKIPPED) || !Array.isArray(x.pts)) return [];
    const pts = x.pts.slice(0, 3).flatMap((p): DrawPoint[] => {
      const q = p as DrawPoint;
      if (!q || !num(q.p) || q.p <= 0) return [];
      if (typeof q.t === 'string' && DATE.test(q.t)) return [{ t: q.t, p: q.p }];
      if (num(q.d) && q.d >= 0 && q.d <= 500) return [{ d: Math.round(q.d), p: q.p }];
      return [];
    });
    return pts.length ? [{ k: x.k, pts }] : [];
  });
}

/** Average true range over the window, the yardstick for "near" (touch tolerance). */
export function atr(bars: DrawBar[], n = 14): number {
  if (bars.length < 2) return bars[0] ? bars[0].h - bars[0].l : 0;
  const tr = bars.slice(1).map((b, i) => Math.max(b.h - b.l, Math.abs(b.h - bars[i]!.c), Math.abs(b.l - bars[i]!.c)));
  const tail = tr.slice(-Math.max(n, Math.min(tr.length, 60)));
  return tail.reduce((s, v) => s + v, 0) / tail.length;
}

const isPivot = (bars: DrawBar[], i: number, kind: 'h' | 'l') => {
  for (let j = Math.max(0, i - PIVOT); j <= Math.min(bars.length - 1, i + PIVOT); j++) {
    if (j === i) continue;
    if (kind === 'h' ? bars[j]!.h > bars[i]!.h : bars[j]!.l < bars[i]!.l) return false;
  }
  return true;
};

const fmt = (v: number) => (v >= 1000 ? Math.round(v).toLocaleString('ko-KR') : v >= 1 ? String(+v.toFixed(2)) : String(+v.toPrecision(4)));
const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;

interface Ctx { bars: DrawBar[]; tol: number; atr: number; last: number }

/** Bar index of a point: its date (nearest earlier bar), or past the last bar. Null when before the window. */
function indexOf(ctx: Ctx, pt: DrawPoint): number | null {
  if (pt.t == null) return ctx.last + (pt.d ?? 0);
  const { bars } = ctx;
  if (pt.t < bars[0]!.t) return null;
  let lo = 0, hi = bars.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (bars[m]!.t <= pt.t) lo = m; else hi = m - 1; }
  return lo;
}

/** How well one anchor sits on a swing high or low. */
function anchorCheck(ctx: Ctx, i: number, p: number, which: string): DrawCheck {
  const { bars, atr: a } = ctx;
  if (i > ctx.last) return { label: `${which} 위치`, ok: null, detail: `${which}은 마지막 봉보다 ${i - ctx.last}봉 뒤(앞으로의 자리)라 고점·저점에 붙었는지 볼 수 없어요.` };
  const b = bars[i]!, dh = Math.abs(p - b.h) / a, dl = Math.abs(p - b.l) / a;
  const kind: 'h' | 'l' = dh <= dl ? 'h' : 'l', word = kind === 'h' ? '고점' : '저점';
  const onBar = Math.min(dh, dl) <= 0.25;
  let best = -1;
  for (let j = Math.max(0, i - 5); j <= Math.min(ctx.last, i + 5); j++) if (isPivot(bars, j, kind) && (best < 0 || Math.abs(j - i) < Math.abs(best - i))) best = j;
  if (onBar && best === i) return { label: `${which} 위치`, ok: true, detail: `${which}이 ${b.t} 봉의 ${word}(${fmt(kind === 'h' ? b.h : b.l)})에 붙어 있고, 그 봉은 앞뒤 ${PIVOT}봉 중 가장 ${kind === 'h' ? '높은' : '낮은'} 스윙 ${word}이에요.` };
  if (best >= 0) {
    const bb = bars[best]!, v = kind === 'h' ? bb.h : bb.l;
    return { label: `${which} 위치`, ok: false, detail: `${which}(${b.t}, ${fmt(p)})은 스윙 ${word}에서 벗어나 있어요. 가장 가까운 스윙 ${word}은 ${Math.abs(best - i)}봉 ${best < i ? '앞' : '뒤'}인 ${bb.t}의 ${fmt(v)}이에요.` };
  }
  return { label: `${which} 위치`, ok: false, detail: `${which}(${b.t}, ${fmt(p)}) 근처 5봉 안에 뚜렷한 스윙 ${word}이 없어요.` };
}

/** Distinct touches: runs of consecutive near bars count once. */
function touches(ctx: Ctx, from: number, to: number, lineAt: (i: number) => number, side: 'support' | 'resistance') {
  const { bars, tol } = ctx;
  let n = 0, prev = false, breaks = 0, firstBreak = '', lastTouch = '';
  for (let i = Math.max(0, from); i <= Math.min(ctx.last, to); i++) {
    const b = bars[i]!, y = lineAt(i), edge = side === 'support' ? b.l : b.h;
    const near = Math.abs(edge - y) <= tol || (side === 'support' ? b.l < y && b.c >= y - tol : b.h > y && b.c <= y + tol);
    if (near && !prev) { n++; lastTouch = b.t; }
    prev = near;
    const broke = side === 'support' ? b.c < y - tol : b.c > y + tol;
    if (broke) { breaks++; if (!firstBreak) firstBreak = b.t; }
  }
  return { n, breaks, firstBreak, lastTouch };
}

/** Which side of a line most closes sit on, over the bars it covers. */
function sideOf(ctx: Ctx, from: number, to: number, lineAt: (i: number) => number): 'support' | 'resistance' {
  let above = 0, below = 0;
  for (let i = Math.max(0, from); i <= Math.min(ctx.last, to); i++) { if (ctx.bars[i]!.c >= lineAt(i)) above++; else below++; }
  return above >= below ? 'support' : 'resistance';
}

function reviewLine(ctx: Ctx, s: DrawShape, i0: number, i1: number): Pick<ShapeReview, 'checks' | 'facts'> {
  let [a, b] = [{ i: i0, p: s.pts[0]!.p }, { i: i1, p: s.pts[1]!.p }];
  if (a.i > b.i) [a, b] = [b, a];
  const checks: DrawCheck[] = [], facts: string[] = [];
  if (a.i === b.i) return { checks: [{ label: '두 점', ok: false, detail: '두 점이 같은 봉에 있어서 기울기를 정할 수 없어요. 두 점을 서로 다른 날짜에 찍어 보세요.' }], facts };
  const slope = (b.p - a.p) / (b.i - a.i), lineAt = (i: number) => a.p + slope * (i - a.i);
  const from = s.k === 'ext' ? 0 : a.i, to = s.k === 'trend' ? b.i : ctx.last;
  const side = sideOf(ctx, a.i, Math.min(b.i, ctx.last), lineAt), word = side === 'support' ? '지지' : '저항';
  checks.push(anchorCheck(ctx, a.i, a.p, '첫 점'), anchorCheck(ctx, b.i, b.p, '둘째 점'));
  const t = touches(ctx, from, to, lineAt, side);
  checks.push({ label: '닿은 횟수', ok: t.n >= 3 ? true : t.n === 2 ? null : false, detail: `가격이 이 선에 ${t.n}번 닿았어요(평균 하루 변동폭의 0.35배 안쪽). 보통 세 번째 닿는 점이 있어야 선이 확인됐다고 봐요.` });
  const span = Math.min(b.i, ctx.last) - a.i;
  checks.push({ label: '기간', ok: span >= 10, detail: `두 점 사이가 ${b.i - a.i}봉이에요.${span < 10 ? ' 10봉보다 짧은 선은 작은 흔들림에도 쉽게 깨져서 추세선으로 보기 어려워요.' : ''}` });
  const per20 = (slope * 20) / lineAt(a.i) * 100;
  checks.push({ label: '기울기', ok: Math.abs(per20) <= 25, detail: `20봉마다 ${pct(per20)} 움직이는 기울기예요.${Math.abs(per20) > 25 ? ' 이렇게 가파른 선은 오래 지켜지기 어려워서, 더 넓은 간격의 고점·저점으로 다시 그어 보는 연습을 해 보세요.' : ''}` });
  const after = s.k === 'trend' ? ' (두 점 사이 기준)' : ' (그린 뒤 지금까지)';
  checks.push({ label: '종가 이탈', ok: t.breaks === 0 ? true : t.breaks <= 2 ? null : false, detail: t.breaks ? `종가가 선을 ${t.breaks}번 넘어 마감했어요${after}. 처음은 ${t.firstBreak}이에요. 이탈 뒤에는 선을 다시 그을지, 역할이 바뀌었는지 살펴보는 게 기법이에요.` : `종가가 선을 넘어 마감한 날이 없어요${after}.` });
  facts.push(`역할: 대부분의 종가가 선 ${side === 'support' ? '위' : '아래'}에 있어 ${word}선처럼 그려졌어요.`);
  if (t.lastTouch) facts.push(`마지막으로 닿은 날: ${t.lastTouch}`);
  return { checks, facts };
}

function reviewLevel(ctx: Ctx, s: DrawShape, i0: number): Pick<ShapeReview, 'checks' | 'facts'> {
  const p = s.pts[0]!.p, from = s.k === 'hray' ? Math.min(i0, ctx.last) : 0, last = ctx.bars[ctx.last]!;
  const side = last.c >= p ? 'support' : 'resistance';
  let n = 0, prev = false, cross = 0, lastTouch = '', was = ctx.bars[Math.min(from, ctx.last)]!.c >= p;
  for (let i = from; i <= ctx.last; i++) {
    const b = ctx.bars[i]!, near = b.l - ctx.tol <= p && b.h + ctx.tol >= p && (Math.abs(b.h - p) <= ctx.tol || Math.abs(b.l - p) <= ctx.tol || Math.abs(b.c - p) <= ctx.tol);
    if (near && !prev) { n++; lastTouch = b.t; }
    prev = near;
    const now = b.c >= p; if (now !== was) cross++; was = now;
  }
  const checks: DrawCheck[] = [
    { label: '시험받은 횟수', ok: n >= 3 ? true : n === 2 ? null : false, detail: `고가·저가·종가가 이 가격 근처(±${fmt(ctx.tol)})에 ${n}번 왔어요. 여러 번 멈춘 자리일수록 의미 있는 수평선으로 봐요.` },
    { label: '종가 교차', ok: cross <= 4, detail: `종가가 이 선을 위아래로 ${cross}번 넘나들었어요.${cross > 4 ? ' 너무 자주 넘나드는 선은 지지·저항보다는 가격대 한가운데일 수 있어요.' : ''}` },
  ];
  const facts = [`지금 종가(${fmt(last.c)})보다 ${side === 'support' ? '아래' : '위'}에 있는 선이라 ${side === 'support' ? '지지' : '저항'} 자리로 그린 셈이에요. 지금 종가와 ${pct((p / last.c - 1) * 100)} 떨어져 있어요.`];
  if (lastTouch) facts.push(`마지막으로 시험받은 날: ${lastTouch}`);
  if (s.k === 'hray' && i0 <= ctx.last) checks.unshift(anchorCheck(ctx, i0, p, '시작점'));
  return { checks, facts };
}

function reviewChannel(ctx: Ctx, s: DrawShape, i0: number, i1: number, i2: number): Pick<ShapeReview, 'checks' | 'facts'> {
  const base = reviewLine(ctx, { k: 'ray', pts: s.pts.slice(0, 2) }, i0, i1);
  if (i0 === i1) return base;
  const [a, b] = i0 <= i1 ? [{ i: i0, p: s.pts[0]!.p }, { i: i1, p: s.pts[1]!.p }] : [{ i: i1, p: s.pts[1]!.p }, { i: i0, p: s.pts[0]!.p }];
  const slope = (b.p - a.p) / (b.i - a.i), lineAt = (i: number) => a.p + slope * (i - a.i), off = s.pts[2]!.p - lineAt(i2);
  const lo = (i: number) => lineAt(i) + Math.min(0, off), hi = (i: number) => lineAt(i) + Math.max(0, off);
  let inside = 0, total = 0;
  for (let i = a.i; i <= ctx.last; i++) { total++; const c = ctx.bars[i]!.c; if (c >= lo(i) - ctx.tol && c <= hi(i) + ctx.tol) inside++; }
  const share = total ? inside / total : 0;
  const other = touches(ctx, a.i, ctx.last, (i) => lineAt(i) + off, off > 0 ? 'resistance' : 'support');
  return {
    checks: [
      ...base.checks.filter((c) => c.label !== '종가 이탈'),
      { label: '반대쪽 선', ok: other.n >= 2 ? true : other.n === 1 ? null : false, detail: `평행한 반대쪽 선에는 가격이 ${other.n}번 닿았어요. 채널은 양쪽 선이 모두 두 번 이상 닿을 때 잘 맞는다고 봐요.` },
      { label: '채널 안 종가', ok: share >= 0.8 ? true : share >= 0.6 ? null : false, detail: `그린 뒤 구간 종가의 ${Math.round(share * 100)}%가 채널 안에 있어요.` },
    ],
    facts: [...base.facts, `채널 폭: ${fmt(Math.abs(off))} (평균 하루 변동폭의 ${(Math.abs(off) / ctx.atr).toFixed(1)}배)`],
  };
}

/** Highest high and lowest low between two bars. */
function extremes(ctx: Ctx, a: number, b: number) {
  let hi = -Infinity, lo = Infinity, hiT = '', loT = '';
  for (let i = Math.max(0, Math.min(a, b)); i <= Math.min(ctx.last, Math.max(a, b)); i++) {
    const x = ctx.bars[i]!; if (x.h > hi) { hi = x.h; hiT = x.t; } if (x.l < lo) { lo = x.l; loT = x.t; }
  }
  return { hi, lo, hiT, loT };
}

function reviewFib(ctx: Ctx, s: DrawShape, i0: number, i1: number): Pick<ShapeReview, 'checks' | 'facts'> {
  const p0 = s.pts[0]!.p, p1 = s.pts[1]!.p, up = p1 > p0, checks: DrawCheck[] = [], facts: string[] = [];
  if (i0 > ctx.last || i1 > ctx.last) return { checks: [{ label: '구간', ok: false, detail: '두 점 중 하나가 마지막 봉보다 뒤에 있어요. 되돌림은 이미 지나간 한 번의 움직임(시작과 끝)에 그려요.' }], facts };
  const ex = extremes(ctx, i0, i1);
  const startWant = up ? ex.lo : ex.hi, endWant = up ? ex.hi : ex.lo, near = (x: number, w: number) => Math.abs(x - w) <= ctx.atr * 0.3;
  checks.push({ label: '시작점', ok: near(p0, startWant), detail: `구간의 ${up ? '최저가' : '최고가'}는 ${fmt(startWant)}(${up ? ex.loT : ex.hiT})이고, 시작점은 ${fmt(p0)}이에요.${near(p0, startWant) ? '' : ' 되돌림은 움직임이 시작된 가장 낮은(높은) 자리에서 그어야 비율이 맞아요.'}` });
  checks.push({ label: '끝점', ok: near(p1, endWant), detail: `구간의 ${up ? '최고가' : '최저가'}는 ${fmt(endWant)}(${up ? ex.hiT : ex.loT})이고, 끝점은 ${fmt(p1)}이에요.${near(p1, endWant) ? '' : ' 끝점은 움직임이 끝난 꼭짓점에 맞춰요.'}` });
  const move = Math.abs(p1 - p0) / ctx.atr;
  checks.push({ label: '움직임 크기', ok: move >= 3, detail: `되돌림을 그린 움직임은 평균 하루 변동폭의 ${move.toFixed(1)}배예요.${move < 3 ? ' 너무 작은 움직임에 그리면 레벨끼리 붙어서 읽기 어려워요.' : ''}` });
  const end = Math.max(i0, i1);
  if (end < ctx.last) {
    const hits = [0.382, 0.5, 0.618].map((f) => { const lv = p1 - (p1 - p0) * f; const t = touches(ctx, end + 1, ctx.last, () => lv, up ? 'support' : 'resistance'); return `${f * 100}%(${fmt(lv)}) ${t.n}번`; });
    facts.push(`끝점 뒤로 가격이 닿은 횟수: ${hits.join(', ')}`);
  }
  facts.push(`${up ? '오름' : '내림'} 움직임 ${pct((p1 / p0 - 1) * 100)}에 그렸어요.`);
  return { checks, facts };
}

function reviewFibExt(ctx: Ctx, s: DrawShape, i0: number, i1: number, i2: number): Pick<ShapeReview, 'checks' | 'facts'> {
  const base = reviewFib(ctx, { k: 'fib', pts: s.pts.slice(0, 2) }, i0, i1);
  const p0 = s.pts[0]!.p, p1 = s.pts[1]!.p, p2 = s.pts[2]!.p;
  const within = (p2 - Math.min(p0, p1)) * (p2 - Math.max(p0, p1)) <= 0, retr = Math.abs(p1 - p2) / (Math.abs(p1 - p0) || 1);
  return {
    checks: [...base.checks, { label: '세 번째 점', ok: within && i2 >= Math.max(i0, i1), detail: within ? `세 번째 점은 움직임의 ${Math.round(retr * 100)}%를 되돌린 자리예요.${i2 < Math.max(i0, i1) ? ' 다만 끝점보다 앞 날짜예요. 확장은 시작 → 끝 → 그 뒤의 되돌림 순서로 찍어요.' : ''}` : '세 번째 점이 처음 움직임 범위 밖이에요. 확장은 되돌림이 끝난 자리(범위 안)에서 찍어요.' }],
    facts: base.facts,
  };
}

function reviewRect(ctx: Ctx, s: DrawShape, i0: number, i1: number): Pick<ShapeReview, 'checks' | 'facts'> {
  const top = Math.max(s.pts[0]!.p, s.pts[1]!.p), bot = Math.min(s.pts[0]!.p, s.pts[1]!.p);
  const a = Math.min(i0, i1), b = Math.min(Math.max(i0, i1), ctx.last);
  if (a > ctx.last) return { checks: [{ label: '구간', ok: null, detail: '박스가 모두 마지막 봉보다 뒤에 있어서 지난 가격과 비교할 수 없어요.' }], facts: [] };
  const ex = extremes(ctx, a, b);
  let inside = 0; for (let i = a; i <= b; i++) { const c = ctx.bars[i]!.c; if (c >= bot && c <= top) inside++; }
  const share = inside / (b - a + 1), fit = (x: number, w: number) => Math.abs(x - w) <= ctx.atr * 0.5;
  return {
    checks: [
      { label: '박스 안 종가', ok: share >= 0.8 ? true : share >= 0.6 ? null : false, detail: `박스 기간 종가의 ${Math.round(share * 100)}%가 박스 안에 있어요.` },
      { label: '윗변·아랫변', ok: fit(top, ex.hi) && fit(bot, ex.lo), detail: `기간 최고가 ${fmt(ex.hi)}, 최저가 ${fmt(ex.lo)}에 견줘 윗변 ${fmt(top)}, 아랫변 ${fmt(bot)}이에요. 박스권을 표시할 때는 여러 번 멈춘 고점·저점 쪽에 변을 맞춰요.` },
    ],
    facts: [`기간 ${b - a + 1}봉, 높이 ${pct((top / bot - 1) * 100)}`],
  };
}

/** Reviews every drawing against the bars. Needs at least 30 bars. */
export function reviewDrawings(bars: DrawBar[], shapes: DrawShape[]): DrawReview {
  const a = atr(bars), lastBar = bars[bars.length - 1];
  const ctx: Ctx = { bars, atr: a || 1, tol: Math.max(a * 0.35, (lastBar?.c ?? 0) * 0.003), last: bars.length - 1 };
  const out: DrawReview = { items: [], skipped: [], bars: bars.length, from: bars[0]?.t ?? '', to: lastBar?.t ?? '' };
  shapes.forEach((s, j) => {
    const n = j + 1;
    if (!(s.k in REVIEWED)) { const [name, why] = SKIPPED[s.k] ?? [s.k, '평가하지 않는 도구예요']; out.skipped.push({ n, k: s.k, name, why }); return; }
    const name = REVIEWED[s.k]!;
    const need = s.k === 'hline' || s.k === 'hray' ? 1 : s.k === 'channel' || s.k === 'fibext' ? 3 : 2;
    if (s.pts.length < need) { out.skipped.push({ n, k: s.k, name, why: '점이 모자라 그리다 만 그림 같아요' }); return; }
    const idx = s.pts.map((p) => indexOf(ctx, p));
    if (idx.some((i) => i == null)) { out.skipped.push({ n, k: s.k, name, why: '받은 차트 기간보다 앞에 찍은 점이 있어요' }); return; }
    if (out.items.length >= MAX_SHAPES) { out.skipped.push({ n, k: s.k, name, why: `한 번에 ${MAX_SHAPES}개까지 평가해요` }); return; }
    const [i0, i1, i2] = idx as number[];
    const r = s.k === 'hline' || s.k === 'hray' ? reviewLevel(ctx, s, i0!)
      : s.k === 'channel' ? reviewChannel(ctx, s, i0!, i1!, i2!)
      : s.k === 'fib' ? reviewFib(ctx, s, i0!, i1!)
      : s.k === 'fibext' ? reviewFibExt(ctx, s, i0!, i1!, i2!)
      : s.k === 'rect' ? reviewRect(ctx, s, i0!, i1!)
      : reviewLine(ctx, s, i0!, i1!);
    out.items.push({ n, k: s.k, name, ...r });
  });
  return out;
}

/** The review as plain text for the AI coach (worker/ask.ts DRAW_SYSTEM reads it as data). */
export function reviewText(r: DrawReview): string {
  const mark = (ok: boolean | null) => (ok === true ? '맞음' : ok === false ? '고칠 점' : '애매');
  const lines = [`일봉 ${r.bars}개(${r.from}~${r.to})로 계산했어요.`];
  for (const it of r.items) {
    lines.push(`\n[그림 ${it.n}] ${it.name}`);
    for (const c of it.checks) lines.push(`- ${c.label} (${mark(c.ok)}): ${c.detail}`);
    for (const f of it.facts) lines.push(`- ${f}`);
  }
  if (r.skipped.length) lines.push(`\n평가하지 않은 그림: ${r.skipped.map((s) => `${s.n}번 ${s.name}(${s.why})`).join(', ')}`);
  return lines.join('\n');
}
