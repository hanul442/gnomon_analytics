// G-264: the statistical base chance behind the committee number (src/analysis/baseOdds.ts), and the MAX
// ("biggest one-day gain in 20 sessions") check. Same panel as evalMore.ts: each evaluation day's most-traded
// stocks, delisted included, 20 sessions apart. No AI. Reads .cache/eval/, writes data/eval/base-<date>.json and .md.
//
//   node dist/cli/evalBase.js [--top 200] [--from 2016-01-01] [--cut 2023-01-01]

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fitOddsModel, oddsFeatures, predictOdds, type OddsModel } from '../analysis/baseOdds.js';
import { costCheck, splitCheck, subset, type Dated } from '../analysis/evalMore.js';
import { crossSection, H, liquidSets, panelStock, scoreSignal, ymd, type MarketView, type PanelStock, type RawBar } from '../analysis/evalPanel.js';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] ?? d : d; };
const TOP = Number(arg('top', '200')), FROM = arg('from', '2016-01-01'), CUT = arg('cut', '2023-01-01');
const root = process.cwd(), dir = join(root, '.cache', 'eval');
const readJson = async <T>(p: string, d: T): Promise<T> => JSON.parse(await readFile(p, 'utf8').catch(() => JSON.stringify(d))) as T;
const f = (v: number | null | undefined, k = 3) => (v != null && Number.isFinite(v) ? v.toFixed(k) : '–');
const ci = (x: { mean: number; lo: number; hi: number } | undefined, k = 3) => (x ? `${f(x.mean, k)} [${f(x.lo, k)}, ${f(x.hi, k)}]${x.lo > 0 ? ' ▲' : x.hi < 0 ? ' ▼' : ''}` : '–');

interface Obs { date: string; vol60: number; high52: number; max20: number; up: number; excess: number }

async function main() {
  const names = await readJson<Record<string, string>>(join(dir, 'names.json'), {});
  const kospi = await readJson<RawBar[]>(join(dir, 'KOSPI.json'), []);
  const calendar = kospi.map((b) => b[0]!);
  const market: MarketView = { close: new Map(kospi.map((b) => [ymd(b[0]!), b[4]!])), dates: calendar.map(ymd) };
  const listed = new Map((await readJson<{ symbol: string; market: string }[]>(join(root, 'data/universe/stocks.json'), [])).map((s) => [s.symbol, s.market]));
  const raw: { symbol: string; bars: RawBar[] }[] = [];
  for (const file of await readdir(join(dir, 'prices'))) {
    const bars = await readJson<RawBar[]>(join(dir, 'prices', file), []);
    if (bars.length >= 300 && names[file.replace('.json', '')]) raw.push({ symbol: file.replace('.json', ''), bars });
  }
  const sets = liquidSets(raw, calendar, TOP, Number(FROM.replace(/-/g, '')));
  const needed = new Set(sets.flatMap((s) => s.symbols));
  const stocks = new Map<string, PanelStock>();
  for (const r of raw) if (needed.has(r.symbol)) stocks.set(r.symbol, panelStock(r.symbol, r.bars, null, null));
  console.error(`stocks ${raw.length}, in panel ${stocks.size}, dates ${sets.length}`);
  const dates: Dated[] = sets.map((s) => ({ date: ymd(s.date), outcome: ymd(calendar[s.k + H]!), rows: crossSection(stocks, s.symbols, ymd(s.date), ymd(calendar[s.k + H]!), market) }));

  // 1. MAX: does a big one-day jump in the last 20 sessions go with lagging the next 20?
  const max = {
    split: splitCheck('max20', dates, CUT),
    cost: costCheck('max20', dates),
    kospi: scoreSignal('max20', subset(dates, (r) => listed.get(r.symbol) === 'KOSPI')),
    kosdaq: scoreSignal('max20', subset(dates, (r) => listed.get(r.symbol) === 'KOSDAQ')),
    // Within the low-volatility fifths too: is MAX more than volatility again?
    partial: partialIc(dates),
  };

  // 2. The base model: P(close higher 20 sessions on), from volatility and the 52-week-high position.
  const obs: Obs[] = [];
  for (const d of dates) for (const r of d.rows) {
    const s = stocks.get(r.symbol)!, ft = oddsFeatures(s.bars.slice(Math.max(0, r.i - 260), r.i + 1));
    if (ft) obs.push({ date: d.date, ...ft, up: r.ret > 0 ? 1 : 0, excess: r.excess });
  }
  const fit = (rows: readonly Obs[]) => fitOddsModel(rows);
  const disc = obs.filter((o) => o.date < CUT), conf = obs.filter((o) => o.date >= CUT);
  const upRate = (rows: readonly Obs[]) => rows.reduce((a, o) => a + o.up, 0) / rows.length;
  const brier = (rows: readonly Obs[], p: (o: Obs) => number) => rows.reduce((a, o) => a + (p(o) - o.up) ** 2, 0) / rows.length;
  const mDisc = fit(disc);
  const asModel = (m: OddsModel): OddsModel => m;
  const discRate = upRate(disc);
  const check = {
    discovery: { n: disc.length, upRate: discRate, brier: brier(disc, (o) => predictOdds(o, asModel(mDisc))), brierBase: brier(disc, () => discRate) },
    confirm: { n: conf.length, upRate: upRate(conf), brier: brier(conf, (o) => predictOdds(o, asModel(mDisc))), brierBase: brier(conf, () => discRate), brierHalf: brier(conf, () => 0.5) },
    bins: bins(conf, (o) => predictOdds(o, asModel(mDisc))),
  };
  const mAll = fit(obs), allRate = upRate(obs);
  const model: OddsModel = {
    method: 'gnm-base-v1', logVol: round(mAll.logVol), high52: round(mAll.high52), max20: round(mAll.max20), b: mAll.b.map((x) => Number(x.toFixed(4))) as [number, number, number, number],
    fitted: {
      from: obs[0]!.date, to: obs.at(-1)!.date, n: obs.length, upRate: Number(allRate.toFixed(4)),
      brier: Number(brier(obs, (o) => predictOdds(o, asModel(mAll))).toFixed(5)), brierBase: Number(brier(obs, () => allRate).toFixed(5)),
      confirmFrom: CUT, confirmBrier: Number(check.confirm.brier.toFixed(5)), confirmBrierBase: Number(check.confirm.brierBase.toFixed(5)),
    },
  };
  const spread = predictSpread(obs, model);
  // G-268: fifths of the model score, for "where this stock sits among the most-traded". Cut points from the
  // shipped model over all ten years; each fifth's outcome out of sample: the 2016–2022 model on 2023–2026.
  const cuts = [0.2, 0.4, 0.6, 0.8].map((q) => { const ps = obs.map((o) => predictOdds(o, model)).sort((a, b) => a - b); return Number(ps[Math.floor(q * (ps.length - 1))]!.toFixed(4)); });
  const discCuts = [0.2, 0.4, 0.6, 0.8].map((q) => { const ps = disc.map((o) => predictOdds(o, asModel(mDisc))).sort((a, b) => a - b); return ps[Math.floor(q * (ps.length - 1))]!; });
  const fifthOf = (p: number, cs: readonly number[]) => cs.filter((c) => p > c).length;
  const fifths = [0, 1, 2, 3, 4].map((k) => {
    const xs = conf.filter((o) => fifthOf(predictOdds(o, asModel(mDisc)), discCuts) === k);
    return { fifth: k, n: xs.length, excessPct: Number(((xs.reduce((a, o) => a + o.excess, 0) / Math.max(1, xs.length)) * 100).toFixed(2)), beatPct: Number(((xs.filter((o) => o.excess > 0).length / Math.max(1, xs.length)) * 100).toFixed(1)) };
  });

  const day = new Date().toISOString().slice(0, 10);
  await mkdir(join(root, 'data/eval'), { recursive: true });
  await writeFile(join(root, 'data/eval', `base-${day}.json`), `${JSON.stringify({ method: 'gnm-base-eval-v1', madeAt: new Date().toISOString(), top: TOP, from: FROM, cut: CUT, dates: dates.length, max, check, model, spread, cuts, fifths }, null, 1)}\n`);
  const skill = (b: number, base: number) => `${((1 - b / base) * 100).toFixed(2)}%`;
  const md = [
    `# 통계 기준 확률과 급등(MAX) 신호 ${day}`, '',
    `상장폐지 포함 ${raw.length}종목, 평가일마다 그날 거래대금 상위 ${TOP}종목, ${dates[0]?.date} ~ ${dates.at(-1)?.date}, 평가일 ${dates.length}개. AI는 쓰지 않았어요.`, '',
    '## 1. 최근 20일 최대 하루 상승(급등, MAX)', '',
    `- 발견 구간(~${CUT.slice(0, 4)}) IC ${ci(max.split.discovery?.ic)}, 확인 구간 IC ${ci(max.split.confirm?.ic)} → ${({ confirmed: '확인됨', weaker: '약해짐(방향은 같음)', faded: '사라짐', flipped: '뒤집힘', none: '발견 구간에서 뚜렷하지 않음' } as const)[max.split.verdict]}`,
    `- 상위 20%(가장 크게 급등) − 하위 20%: ${ci(max.cost?.spreadGross, 2)}%p (20거래일), 상위 20% − 평균: ${ci(max.cost?.longGross, 2)}%p`,
    `- 코스피(현재 상장) IC ${ci(max.kospi?.ic)}, 코스닥(현재 상장) IC ${ci(max.kosdaq?.ic)}`,
    `- 변동성을 뺀 뒤(같은 날 변동성 순위를 빼고 남은 급등 순위의 IC): ${ci(max.partial)}`, '',
    '음수 IC는 급등이 컸던 종목일수록 다음 20거래일에 같은 날 다른 종목 평균보다 덜 올랐다는 뜻이에요.', '',
    '## 2. 통계 기준 확률 (20거래일 뒤 지금보다 높을 확률)', '',
    `입력: 60거래일 하루 변동성(로그), 52주 고가 대비 위치, 최근 20일 최대 하루 상승. 로지스틱 회귀. 발견 구간에서 맞추고 확인 구간에서 채점했어요.`, '',
    '| 구간 | 건수 | 실제로 오른 비율 | 모델 Brier | 기준선 Brier(발견 구간 오른 비율) | 기준선 대비 |', '|---|---:|---:|---:|---:|---:|',
    `| 발견(~${CUT.slice(0, 4)}) | ${check.discovery.n} | ${(check.discovery.upRate * 100).toFixed(1)}% | ${f(check.discovery.brier, 4)} | ${f(check.discovery.brierBase, 4)} | ${skill(check.discovery.brier, check.discovery.brierBase)} |`,
    `| 확인(${CUT.slice(0, 4)}~) | ${check.confirm.n} | ${(check.confirm.upRate * 100).toFixed(1)}% | ${f(check.confirm.brier, 4)} | ${f(check.confirm.brierBase, 4)} | ${skill(check.confirm.brier, check.confirm.brierBase)} |`, '',
    `확인 구간에서 늘 50%라고 했을 때 Brier ${f(check.confirm.brierHalf, 4)}.`, '',
    '확인 구간 보정표:', '', '| 모델이 말한 확률 | 건수 | 실제로 오른 비율 |', '|---|---:|---:|',
    ...check.bins.map((b) => `| ${b.lo}~${b.hi}% | ${b.n} | ${b.n ? `${b.happened.toFixed(1)}%` : '–'} |`), '',
    `전체 기간으로 다시 맞춘 계수(앱에 들어가는 값): b0 ${model.b[0]}, 변동성 ${model.b[1]}, 52주 고가 ${model.b[2]}, 급등 ${model.b[3]}. 종목별 기준 확률 10%·50%·90% 지점: ${spread.map((x) => `${x.toFixed(0)}%`).join(' · ')}.`, '',
    '## 3. 같은 날 다른 종목과 비교한 위치 (모델 점수 다섯 묶음)', '',
    `2016~2022로 맞춘 모델의 점수로 다섯 묶음을 나누고, 2023~2026년에 그날 평균 대비 20거래일 초과수익을 봤어요. 앱에 들어가는 경계(전체 기간 모델): ${cuts.map((c) => `${(c * 100).toFixed(1)}%`).join(' · ')}.`, '',
    '| 묶음 | 건수 | 평균 대비 초과수익 | 평균을 이긴 비율 |', '|---|---:|---:|---:|',
    ...fifths.map((x) => `| ${['가장 낮음', '낮음', '중간', '높음', '가장 높음'][x.fifth]} | ${x.n} | ${x.excessPct > 0 ? '+' : ''}${x.excessPct}%p | ${x.beatPct}% |`), '',
  ].join('\n');
  await writeFile(join(root, 'data/eval', `base-${day}.md`), `${md}\n`);
  console.log(md);
  console.log(JSON.stringify(model, null, 1));
}

const round = (x: { mean: number; sd: number }) => ({ mean: Number(x.mean.toFixed(4)), sd: Number(x.sd.toFixed(4)) });

/** IC of MAX after taking out that day's volatility rank (rank residual), averaged over dates with its interval. */
function partialIc(dates: readonly Dated[]): { mean: number; lo: number; hi: number } | undefined {
  const ics: number[] = [];
  for (const d of dates) {
    const rows = d.rows.filter((r) => r.values.max20 != null && r.values.lowvol != null);
    if (rows.length < 30) continue;
    const rk = (xs: number[]) => { const o = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]); const r = new Array<number>(xs.length); o.forEach(([, i], k) => { r[i] = k / (xs.length - 1) - 0.5; }); return r; };
    const m = rk(rows.map((r) => r.values.max20!)), v = rk(rows.map((r) => r.values.lowvol!)), e = rk(rows.map((r) => r.excess));
    const beta = m.reduce((a, x, k) => a + x * v[k]!, 0) / v.reduce((a, x) => a + x * x, 0);
    const res = m.map((x, k) => x - beta * v[k]!);
    const c = res.reduce((a, x, k) => a + x * e[k]!, 0), sa = Math.sqrt(res.reduce((a, x) => a + x * x, 0)), sb = Math.sqrt(e.reduce((a, x) => a + x * x, 0));
    if (sa > 0 && sb > 0) ics.push(c / (sa * sb));
  }
  if (ics.length < 5) return undefined;
  const n = ics.length, mean = ics.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(ics.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1));
  return { mean, lo: mean - 1.96 * sd / Math.sqrt(n), hi: mean + 1.96 * sd / Math.sqrt(n) };
}

function bins(rows: readonly Obs[], p: (o: Obs) => number) {
  const edges = [0, 40, 45, 50, 55, 60, 100];
  return edges.slice(0, -1).map((lo, k) => {
    const hi = edges[k + 1]!, xs = rows.filter((o) => { const v = p(o) * 100; return v >= lo && v < hi; });
    return { lo, hi, n: xs.length, happened: xs.length ? (xs.reduce((a, o) => a + o.up, 0) / xs.length) * 100 : 0 };
  });
}

function predictSpread(rows: readonly Obs[], m: OddsModel): number[] {
  const ps = rows.map((o) => predictOdds(o, m) * 100).sort((a, b) => a - b);
  return [0.1, 0.5, 0.9].map((q) => ps[Math.floor(q * (ps.length - 1))]!);
}

main().catch((e) => { console.error(e); process.exit(1); });
