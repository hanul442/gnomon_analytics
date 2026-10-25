// G-290: the model arena. Open forecasting models (data/arena/models.json) in the hidden-future panel, each next to
// the committee's statistical base on the same rows. Two stages around a Python step (scripts/arena/predict.py):
//
//   node dist/cli/evalArena.js --stage prep  [--top 100] [--from 2016-01-01] [--lookback 512]
//   python scripts/arena/predict.py --model <key> [--shard 0/2] ...        (one run per model, any order)
//   node dist/cli/evalArena.js --stage score
//
// prep reads .cache/eval/ (evalFetch.ts) and writes .cache/eval/arena/input.json (bars up to each cutoff and the
// next 20 trading dates, nothing after the cutoff) for every evaluation date from the earliest active model's
// testFrom, and truth.json (what happened; the base chance from a model refitted on the outcomes known before each
// date; the statistical range). score reads .cache/eval/arena/<key>/preds-*.json, keeps each model's rows from its
// own testFrom, and writes data/eval/arena-<date>.json and .md (a leaderboard and one section per model).

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ARENA_METHOD, scoreModel, verdict, type ArenaScore, type Forecast, type TruthRow } from '../analysis/arenaEval.js';
import { fitOddsModel, oddsFeatures, predictOdds, type OddsFeatures } from '../analysis/baseOdds.js';
import { crossSection, H, liquidSets, panelStock, ymd, type MarketView, type PanelStock, type RawBar } from '../analysis/evalPanel.js';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] ?? d : d; };
const STAGE = arg('stage', 'prep'), TOP = Number(arg('top', '100')), FROM = arg('from', '2016-01-01'), LOOKBACK = Number(arg('lookback', '512'));
const root = process.cwd(), dir = join(root, '.cache', 'eval'), out = join(dir, 'arena');
const readJson = async <T>(p: string, d: T): Promise<T> => JSON.parse(await readFile(p, 'utf8').catch(() => JSON.stringify(d))) as T;

export interface ArenaModel { key: string; name: string; org: string; hf: string; license: string; params?: string; weightsDate: string; testFrom?: string; status: 'active' | 'retired' | 'excluded'; note?: string }
const registry = async () => (await readJson<{ models: ArenaModel[] }>(join(root, 'data/arena/models.json'), { models: [] })).models;

async function prep() {
  const active = (await registry()).filter((m) => m.status !== 'excluded' && m.testFrom);
  const windowFrom = active.map((m) => m.testFrom!).sort()[0] ?? '2025-01-01';
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
  const stocks = new Map<string, PanelStock>(), rawOf = new Map(raw.map((r) => [r.symbol, r.bars]));
  for (const r of raw) if (needed.has(r.symbol)) stocks.set(r.symbol, panelStock(r.symbol, r.bars, null, null));

  // Every row of every date, with its outcome date, so the base for a date can be fitted on what was known by then.
  const obs: { date: string; outcome: string; feats: OddsFeatures | null; up: number; symbol: string; i: number; ret: number; excess: number; ended: boolean; p10: number | null; p90: number | null; sigma: number | null; future: number[] }[] = [];
  for (const s of sets) {
    const date = ymd(s.date), outcome = ymd(calendar[s.k + H]!);
    for (const r of crossSection(stocks, s.symbols, date, outcome, market)) {
      const st = stocks.get(r.symbol)!;
      obs.push({ date, outcome, feats: oddsFeatures(st.bars.slice(Math.max(0, r.i - 260), r.i + 1)), up: r.ret > 0 ? 1 : 0, symbol: r.symbol, i: r.i, ret: r.ret, excess: r.excess, ended: r.ended, p10: r.p10, p90: r.p90, sigma: r.sigma, future: calendar.slice(s.k + 1, s.k + 1 + H) });
    }
  }
  const truth: TruthRow[] = [];
  const input: { id: string; bars: RawBar[]; future: number[] }[] = [];
  const testDates = [...new Set(obs.map((o) => o.date))].filter((d) => d >= windowFrom).sort();
  for (const date of testDates) {
    const known = obs.filter((o) => o.outcome < date && o.feats) as (typeof obs[number] & { feats: OddsFeatures })[];
    const model = fitOddsModel(known.map((o) => ({ ...o.feats, up: o.up })));
    const constant = known.reduce((a, o) => a + o.up, 0) / Math.max(1, known.length);
    for (const x of obs.filter((o) => o.date === date)) {
      const id = `${x.date}:${x.symbol}`;
      // Index i in the panel bars is the same index in the raw bars (panelStock keeps them one to one).
      input.push({ id, bars: rawOf.get(x.symbol)!.slice(Math.max(0, x.i - LOOKBACK + 1), x.i + 1), future: x.future });
      truth.push({ id, date: x.date, symbol: x.symbol, ret: x.ret, excess: x.excess, ended: x.ended, base: x.feats ? predictOdds(x.feats, model) : null, constant, p10: x.p10, p90: x.p90, sigma: x.sigma, vol60: x.feats?.vol60 ?? null });
    }
  }
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'input.json'), JSON.stringify({ method: ARENA_METHOD, horizon: H, lookback: LOOKBACK, rows: input }));
  await writeFile(join(out, 'truth.json'), JSON.stringify({ method: ARENA_METHOD, top: TOP, windowFrom, lookback: LOOKBACK, rows: truth }));
  console.error(`stocks ${raw.length}, panel dates ${sets.length}, scored dates ${testDates.length} (${testDates[0]} ~ ${testDates.at(-1)}), rows ${truth.length}`);
}

const f = (v: number, k = 3) => (Number.isFinite(v) ? v.toFixed(k) : '–');
const iv = (x: { mean: number; lo: number; hi: number }, k = 3) => `${f(x.mean, k)} [${f(x.lo, k)}, ${f(x.hi, k)}]${x.lo > 0 ? ' ▲' : x.hi < 0 ? ' ▼' : ''}`;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

async function score() {
  const t = await readJson<{ top: number; windowFrom: string; rows: TruthRow[] }>(join(out, 'truth.json'), { top: 0, windowFrom: '', rows: [] });
  const models = await registry();
  const results: { m: ArenaModel; s: ArenaScore; runs: unknown[]; missing: number }[] = [];
  for (const m of models.filter((x) => x.status !== 'excluded')) {
    // Kept forecasts (data/arena/preds/<key>.json) plus this run's new ones; the merge is written back.
    const keptPath = join(root, 'data/arena/preds', `${m.key}.json`);
    const kept = await readJson<{ model?: string; runs: unknown[]; preds: Record<string, Forecast> }>(keptPath, { runs: [], preds: {} });
    const preds: Record<string, Forecast> = { ...kept.preds }, runs: unknown[] = [...kept.runs];
    for (const file of await readdir(join(out, m.key)).catch(() => [] as string[])) {
      if (!/^preds-.*\.json$/.test(file)) continue;
      const p = await readJson<{ meta: unknown; preds: Record<string, Forecast | number[]> }>(join(out, m.key, file), { meta: null, preds: {} });
      for (const [id, v] of Object.entries(p.preds)) preds[id] = Array.isArray(v) ? { paths: v } : v; // the first Kronos run stored bare paths
      if (!runs.some((x) => JSON.stringify(x) === JSON.stringify(p.meta))) runs.push(p.meta);
    }
    await mkdir(join(root, 'data/arena/preds'), { recursive: true });
    if (Object.keys(preds).length) await writeFile(keptPath, `${JSON.stringify({ method: ARENA_METHOD, model: m.hf, runs, preds })}\n`);
    const mine = t.rows.filter((r) => r.date >= m.testFrom!);
    const rows = mine.filter((r) => preds[r.id]).map((r) => ({ ...r, forecast: preds[r.id]! }));
    if (!rows.length) { console.error(`${m.key}: no forecasts`); continue; }
    results.push({ m, s: scoreModel(rows), runs, missing: mine.length - rows.length });
  }
  const day = new Date().toISOString().slice(0, 10);
  await mkdir(join(root, 'data/eval'), { recursive: true });
  await writeFile(join(root, 'data/eval', `arena-${day}.json`), `${JSON.stringify({ method: ARENA_METHOD, madeAt: new Date().toISOString(), top: t.top, results: results.map((r) => ({ key: r.m.key, testFrom: r.m.testFrom, missing: r.missing, runs: r.runs, verdict: verdict(r.s), score: r.s })) }, null, 1)}\n`);

  const win = (b: boolean) => (b ? '**이김**' : '–');
  const skill = (s: ArenaScore, b: number) => `${((1 - b / s.brier.constant) * 100).toFixed(1)}%`;
  const board = [...results].sort((a, b) => (a.s.brier.model - a.s.brier.base) - (b.s.brier.model - b.s.brier.base));
  const md = [
    `# 모델 대결장 ${day}`, '',
    `공개 예측 모델이 종목마다 20거래일 뒤 종가를 예측하고, 같은 종목·같은 날의 위원회 통계 기준 확률(그날 전에 결과가 나온 자료로만 다시 맞춤)과 나란히 채점했어요. 평가일마다 그날 거래대금 상위 ${t.top}종목(상장폐지 포함), 20거래일 간격. 모델마다 가중치가 마지막으로 바뀐 뒤 2주 넘게 지난 달부터만 채점해요.`, '',
    '"이김"은 같은 행에서 통계 기준보다 나은 차이의 95% 구간이 0을 넘은 경우예요. 이겨도 다음 달들 새 자료에서 다시 이겨야 위원회 후보가 돼요.', '',
    '## 순위표', '',
    '| 모델 | 채점 기간 | 건수 | 오를 확률 Brier (모델 / 통계 기준) | 종목 순위 IC (모델 / 통계 기준) | 80% 범위 적중 | 변동 폭 상관 (모델 / 통계 범위) | 방향 | 순위 | 변동 폭 |',
    '|---|---|---:|---|---|---:|---|---|---|---|',
    ...board.map(({ m, s }) => { const v = verdict(s); return `| ${m.name} | ${s.from} ~ ${s.to} (${s.dates}일) | ${s.rows} | ${f(s.brier.model, 4)} / ${f(s.brier.base, 4)} | ${f(s.ic.move.mean)} / ${f(s.ic.base.mean)} | ${pct(s.range.coverage)} | ${f(s.range.sizeIc.mean, 2)} / ${f(s.range.statSizeIc.mean, 2)} | ${win(v.direction)} | ${win(v.ranking)} | ${win(v.size)} |`; }), '',
    `통계 예측 범위(지금 화면)의 80% 범위 적중: ${board.map(({ m, s }) => `${m.name} 기간 ${pct(s.range.statCoverage)}`).join(', ')}.`, '',
    ...models.filter((m) => m.status === 'excluded').map((m) => `- 제외: ${m.name}(${m.org}) — ${m.note ?? ''}`), '',
    ...results.flatMap(({ m, s, missing }) => [
      `## ${m.name} (${m.org}, ${m.params ?? ''}, ${m.license})`, '',
      `가중치 ${m.weightsDate}, 채점 ${s.from} ~ ${s.to}, 평가일 ${s.dates}개, ${s.rows}건${missing ? `, 예측 없음 ${missing}건` : ''}. 실제로 오른 비율 ${pct(s.upRate)}.`, '',
      '| 오를 확률 | Brier | 기준선 대비 |', '|---|---:|---:|',
      `| ${m.name} | ${f(s.brier.model, 4)} | ${skill(s, s.brier.model)} |`,
      `| 통계 기준 확률 | ${f(s.brier.base, 4)} | ${skill(s, s.brier.base)} |`,
      `| 둘의 평균 | ${f(s.brier.blend, 4)} | ${skill(s, s.brier.blend)} |`,
      `| 기준선(그날까지 오른 비율) | ${f(s.brier.constant, 4)} | 0% |`,
      `| 늘 50% | ${f(s.brier.half, 4)} | ${skill(s, s.brier.half)} |`, '',
      `- 평가일별 Brier 차이(모델 − 통계 기준, 음수면 모델이 나음): ${iv(s.brierGap, 4)}`,
      `- 종목 순위 IC: 모델 예상 움직임 ${iv(s.ic.move)}, 모델 오를 확률 ${iv(s.ic.up)}, 통계 기준 ${iv(s.ic.base)}, 낮은 변동성 ${iv(s.ic.lowVol)}`,
      `- 모델 − 통계 기준 IC: ${iv(s.icGap)} · 통계 기준을 뺀 뒤 더하는 정보: ${iv(s.icAdded)} · 상위 20% − 하위 20%: ${iv(s.spread, 2)}%p`,
      `- 80% 범위 적중: 모델 ${pct(s.range.coverage)}, 통계 범위 ${pct(s.range.statCoverage)} · 변동 폭 상관: 모델 ${iv(s.range.sizeIc, 2)}, 통계 범위 ${iv(s.range.statSizeIc, 2)}, 차이 ${iv(s.range.sizeGap, 2)}`,
      `- 보정(말한 확률 → 실제 오른 비율): ${s.bands.filter((b) => b.n).map((b) => `${Math.round(b.lo * 100)}~${Math.round(b.hi * 100)}% ${b.n}건 ${pct(b.said)}→${pct(b.happened)}`).join(' · ')}`, '',
    ]),
    '## 한계', '',
    '- 평가일이 모델마다 10~23개라 구간이 넓어요. 여러 모델을 한꺼번에 시험해서 하나쯤은 우연히 "이김"이 나올 수 있어요. 그래서 이긴 모델은 다음 달들 새 자료로 다시 확인해요.',
    '- 모델마다 채점 기간이 달라 순위표의 숫자끼리 바로 비교하지 말고, 각 모델의 "통계 기준 대비"를 보세요.',
    '- 결과는 내부·방법론용이고 수익률 광고에 쓰지 않아요.', '',
  ].join('\n');
  await writeFile(join(root, 'data/eval', `arena-${day}.md`), `${md}\n`);
  console.log(md);
}

(STAGE === 'score' ? score() : prep()).catch((e) => { console.error(e); process.exit(1); });
