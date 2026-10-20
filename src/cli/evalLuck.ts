// G-275: Monte Carlo luck checks on the hidden-future panel (src/analysis/monteCarlo.ts). For each result we
// ship or quote, make thousands of skill-free fakes (per-date shuffles and block bootstraps of whole runs of
// dates) and see where the real result falls. Same panel as evalBase.ts/evalMore.ts: each evaluation day's
// most-traded stocks, delisted included, 20 sessions apart. No AI. Reads .cache/eval/, writes
// data/eval/luck-<date>.json and .md. Internal methodology only; never advertising.
//
//   node dist/cli/evalLuck.js [--top 200] [--from 2016-01-01] [--cut 2023-01-01] [--block 6] [--reps 4000]

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fitOddsModel, oddsFeatures, predictOdds } from '../analysis/baseOdds.js';
import { crossSection, H, liquidSets, panelStock, quintiles, ranks, rng, SIGNALS, ymd, type MarketView, type PanelStock, type RawBar, type Row } from '../analysis/evalPanel.js';
import { holm, luckTest, luckVerdict, shuffle, type LuckTest } from '../analysis/monteCarlo.js';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] ?? d : d; };
const TOP = Number(arg('top', '200')), FROM = arg('from', '2016-01-01'), CUT = arg('cut', '2023-01-01');
const BLOCK = Number(arg('block', '6')), REPS = Number(arg('reps', '4000')), SHUFFLES = Number(arg('shuffles', '1000'));
const root = process.cwd(), dir = join(root, '.cache', 'eval');
const readJson = async <T>(p: string, d: T): Promise<T> => JSON.parse(await readFile(p, 'utf8').catch(() => JSON.stringify(d))) as T;

type Dated = { date: string; rows: Row[] };
/** One date's stocks with a prediction and the outcome. */
type Pairs = { x: number[]; ex: number[]; up: number[] };

/** Rank correlation from pre-ranked outcome; x is ranked here. */
function ic(x: readonly number[], rex: readonly number[]): number {
  const rx = ranks(x), n = x.length, m = (n - 1) / 2;
  let c = 0, vx = 0, vy = 0;
  for (let k = 0; k < n; k += 1) { const a = rx[k]! - m, b = rex[k]! - m; c += a * b; vx += a * a; vy += b * b; }
  return vx > 0 && vy > 0 ? c / Math.sqrt(vx * vy) : NaN;
}
/** Top fifth minus bottom fifth average excess, percentage points. */
function spread(x: readonly number[], ex: readonly number[]): number {
  const q = quintiles(x), avg = (k: number) => { let s = 0, n = 0; q.forEach((v, t) => { if (v === k) { s += ex[t]!; n += 1; } }); return n ? s / n : NaN; };
  return (avg(4) - avg(0)) * 100;
}

/** Per-date statistic, and the same with each day's predictions shuffled, wrapped into a luck test. */
function test(days: readonly Pairs[], stat: (x: readonly number[], d: Pairs) => number, seed: number): LuckTest | null {
  const real = days.map((d) => stat(d.x, d));
  return luckTest(real, { block: BLOCK, reps: REPS, seed, shuffleReps: SHUFFLES, shuffled: (s) => { const r = rng(s); return days.map((d) => stat(shuffle(d.x, r), d)); } });
}

async function main() {
  const names = await readJson<Record<string, string>>(join(dir, 'names.json'), {});
  const kospi = await readJson<RawBar[]>(join(dir, 'KOSPI.json'), []);
  const calendar = kospi.map((b) => b[0]!);
  const market: MarketView = { close: new Map(kospi.map((b) => [ymd(b[0]!), b[4]!])), dates: calendar.map(ymd) };
  const raw: { symbol: string; bars: RawBar[] }[] = [];
  for (const file of await readdir(join(dir, 'prices'))) {
    const bars = await readJson<RawBar[]>(join(dir, 'prices', file), []);
    if (bars.length >= 300 && names[file.replace('.json', '')]) raw.push({ symbol: file.replace('.json', ''), bars });
  }
  const sets = liquidSets(raw, calendar, TOP, Number(FROM.replace(/-/g, '')));
  const needed = new Set(sets.flatMap((s) => s.symbols));
  const stocks = new Map<string, PanelStock>();
  for (const r of raw) {
    if (!needed.has(r.symbol)) continue;
    const flows = await readJson<RawBar[] | null>(join(dir, 'flows', `${r.symbol}.json`), null);
    const events = await readJson<[number, string][] | null>(join(dir, 'events', `${r.symbol}.json`), null);
    stocks.set(r.symbol, panelStock(r.symbol, r.bars, flows, events));
  }
  console.error(`stocks ${raw.length}, in panel ${stocks.size}, dates ${sets.length}`);
  const dates: Dated[] = sets.map((s) => ({ date: ymd(s.date), rows: crossSection(stocks, s.symbols, ymd(s.date), ymd(calendar[s.k + H]!), market) }));
  const pairs = (ds: readonly Dated[], value: (r: Row, date: string) => number | null, min = 30): Pairs[] => ds.map((d) => {
    const rows = d.rows.map((r) => [r, value(r, d.date)] as const).filter((p): p is readonly [Row, number] => p[1] != null && Number.isFinite(p[1]));
    return { x: rows.map((p) => p[1]), ex: rows.map((p) => p[0].excess), up: rows.map((p) => (p[0].ret > 0 ? 1 : 0)) };
  }).filter((p) => p.x.length >= min);
  const withRanks = (ps: Pairs[]) => ps.map((p) => ({ ...p, rex: ranks(p.ex) }));
  const icStat = (x: readonly number[], d: Pairs) => ic(x, (d as Pairs & { rex: number[] }).rex);
  const spreadStat = (x: readonly number[], d: Pairs) => spread(x, d.ex);
  const conf = dates.filter((d) => d.date >= CUT);

  // 1. The MAX finding: a big one-day jump went with lagging (the −3.2%p top-minus-bottom spread).
  const maxAll = withRanks(pairs(dates, (r) => r.values.max20 ?? null)), maxConf = withRanks(pairs(conf, (r) => r.values.max20 ?? null));
  const max = { ic: test(maxAll, icStat, 101), spread: test(maxAll, spreadStat, 102), icConfirm: test(maxConf, icStat, 103), spreadConfirm: test(maxConf, spreadStat, 104) };

  // 2. The committee's base model, fitted on the discovery years and scored only on the confirm years.
  const feat = new Map<string, ReturnType<typeof oddsFeatures>>();
  const key = (d: string, r: Row) => `${d}|${r.symbol}`;
  for (const d of dates) for (const r of d.rows) feat.set(key(d.date, r), oddsFeatures(stocks.get(r.symbol)!.bars.slice(Math.max(0, r.i - 260), r.i + 1)));
  const disc = dates.filter((d) => d.date < CUT).flatMap((d) => d.rows.flatMap((r) => { const f = feat.get(key(d.date, r)); return f ? [{ ...f, up: r.ret > 0 ? 1 : 0 }] : []; }));
  const model = fitOddsModel(disc), discRate = disc.reduce((a, o) => a + o.up, 0) / disc.length;
  const scored = withRanks(pairs(conf, (r, date) => { const f = feat.get(key(date, r)); return f ? predictOdds(f, model) : null; }));
  const discP = disc.map((o) => predictOdds(o, model)).sort((a, b) => a - b);
  const cuts = [0.2, 0.4, 0.6, 0.8].map((q) => discP[Math.floor(q * (discP.length - 1))]!);
  const fifth = (p: number) => cuts.filter((c) => p > c).length;
  // Fixed cut points (as on the screen), not that day's fifths: top fifth minus bottom fifth, and the lowest
  // fifth against the day's average.
  const fixedSpread = (x: readonly number[], d: Pairs) => { const g = (k: number) => { let s = 0, n = 0; x.forEach((p, t) => { if (fifth(p) === k) { s += d.ex[t]!; n += 1; } }); return n ? s / n : NaN; }; return (g(4) - g(0)) * 100; };
  const lowest = (x: readonly number[], d: Pairs) => { let s = 0, n = 0; x.forEach((p, t) => { if (fifth(p) === 0) { s += d.ex[t]!; n += 1; } }); return n ? (s / n) * 100 : NaN; };
  const brierGap = (x: readonly number[], d: Pairs) => { let a = 0, b = 0; x.forEach((p, t) => { a += (discRate - d.up[t]!) ** 2; b += (p - d.up[t]!) ** 2; }); return ((a - b) / x.length) * 1000; };
  const base = { ic: test(scored, icStat, 201), fifths: test(scored, fixedSpread, 202), lowest: test(scored, lowest, 203), brier: test(scored, brierGap, 204) };

  // 3. Every price signal tried, full period: how many survive once we allow for having tried so many.
  const family = SIGNALS.map((s, k) => ({ key: s.key, name: s.name, group: s.group, t: test(withRanks(pairs(dates, (r) => r.values[s.key] ?? null)), icStat, 300 + k) }))
    .filter((x): x is typeof x & { t: LuckTest } => x.t !== null);
  const pass = holm(family.map((x) => x.t.p));

  const day = new Date().toISOString().slice(0, 10);
  await mkdir(join(root, 'data/eval'), { recursive: true });
  const out = { method: 'gnm-luck-v1', madeAt: new Date().toISOString(), top: TOP, from: FROM, cut: CUT, block: BLOCK, reps: REPS, shuffles: SHUFFLES, dates: dates.length, max, base, family: family.map((x, k) => ({ ...x, holmPass: pass[k] })) };
  await writeFile(join(root, 'data/eval', `luck-${day}.json`), `${JSON.stringify(out, null, 1)}\n`);
  const f = (v: number | null | undefined, k = 3) => (v != null && Number.isFinite(v) ? v.toFixed(k) : '–');
  const p = (v: number | null | undefined) => (v == null ? '–' : v < 0.001 ? '<0.001' : v.toFixed(3));
  const row = (label: string, t: LuckTest | null, k = 3, unit = '') => t
    ? `| ${label} | ${t.dates} | ${f(t.mean, k)}${unit} | [${f(t.lo, k)}, ${f(t.hi, k)}] | ${t.percentile.toFixed(1)} | ${p(t.pShuffle)} | ${p(t.pBlock)} | ${luckVerdict(t)} |`
    : `| ${label} | – | – | – | – | – | – | 자료 부족 |`;
  const head = ['| 결과 | 평가일 | 실제 값 | 95% 범위(블록) | 운만 있을 때 분포에서 위치(%) | 섞기 p | 블록 p | 판정 |', '|---|---:|---:|---|---:|---:|---:|---|'];
  const md = [
    `# 몬테카를로 검증: 이 성적이 운으로도 나올까 ${day}`, '',
    `상장폐지 포함 ${raw.length}종목, 평가일마다 그날 거래대금 상위 ${TOP}종목, ${dates[0]?.date} ~ ${dates.at(-1)?.date}, 평가일 ${dates.length}개(20거래일 간격).`, '',
    '두 가지 가짜(실력 없는) 판단을 만들어 실제 결과와 비교했어요.', '',
    `- **섞기**: 평가일마다 그날 종목들에게 예측을 무작위로 다시 나눠 줘요(${SHUFFLES}번). 예측과 결과의 연결만 끊어요.`,
    `- **블록 부트스트랩**: 평가일별 결과를 평균 0으로 옮긴 뒤, 연속된 평가일 ${BLOCK}개(약 ${BLOCK}개월)씩 통째로 이어 붙여 가짜 10년을 ${REPS}번 만들어요. 시장은 몇 달씩 같은 흐름이 이어져서, 날짜를 하나씩 섞으면 운이 너무 드물어 보여요.`, '',
    '판정은 두 p 중 큰 값(더 엄격한 쪽)으로 해요. p는 실력이 없을 때 이만큼(또는 더 크게) 나올 확률이에요.', '',
    '## 1. 급등(MAX) 뒤에 덜 오른다', '', ...head,
    row('IC, 전체 기간', max.ic), row('상위−하위 20% 초과수익(%p), 전체', max.spread, 2), row(`IC, 확인 구간(${CUT.slice(0, 4)}~)`, max.icConfirm), row(`상위−하위(%p), 확인 구간`, max.spreadConfirm, 2), '',
    `## 2. 위원회 통계 기준 (2016~${Number(CUT.slice(0, 4)) - 1}로 맞추고 ${CUT.slice(0, 4)}~에만 채점)`, '', ...head,
    row('점수와 초과수익의 IC', base.ic), row('가장 높은 묶음 − 가장 낮은 묶음(%p, 화면의 고정 경계)', base.fifths, 2), row('가장 낮은 묶음 − 그날 평균(%p)', base.lowest, 2), row('Brier 개선(기준선 − 모델, ×1000)', base.brier, 3), '',
    `## 3. 시험한 신호 전체 (전체 기간 IC, ${family.length}개)`, '',
    `여러 신호를 시험하면 몇 개는 운으로도 통과해요. 실력이 하나도 없어도 p<0.05가 평균 ${(family.length * 0.05).toFixed(1)}개 나와요. 그래서 Holm 보정(가장 작은 p부터 더 엄격한 기준)을 함께 봐요.`, '',
    '| 신호 | 평가일 | IC | 섞기 p | 블록 p | p<0.05 | Holm 보정 후 |', '|---|---:|---:|---:|---:|:---:|:---:|',
    ...family.map((x, k) => `| ${x.name} | ${x.t.dates} | ${f(x.t.mean)} | ${p(x.t.pShuffle)} | ${p(x.t.pBlock)} | ${x.t.p < 0.05 ? '○' : ''} | ${pass[k] ? '○' : ''} |`), '',
    `p<0.05 ${family.filter((x) => x.t.p < 0.05).length}개, Holm 보정 후 남은 것 ${pass.filter(Boolean).length}개. 수급·공시 신호는 그 자료(.cache/eval/flows, events)가 있을 때만 표에 들어가요.`, '',
    'IC 부호는 방향만 말해요. 음수로 남은 신호(추세 추종, 60일 모멘텀, 급등)는 "그 신호가 강할수록 덜 올랐다"가 운이 아니라는 뜻이에요.', '',
    'AI 위원은 이 표에 없어요. 지난 블라인드 평가가 종목별 답을 저장하지 않아서, 다음 AI 평가(evalRun --ai, panel-<날짜>.md의 "운 검사" 열)부터 같은 검사가 붙어요.', '',
  ].join('\n');
  await writeFile(join(root, 'data/eval', `luck-${day}.md`), `${md}\n`);
  console.log(md);
}

main().catch((e) => { console.error(e); process.exit(1); });
