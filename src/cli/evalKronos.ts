// G-286: Kronos (a price-candle foundation model) in the hidden-future panel, next to the committee's statistical
// base. Two stages around a Python step (scripts/kronos/predict.py):
//
//   node dist/cli/evalKronos.js --stage prep  [--top 100] [--from 2016-01-01] [--testFrom 2025-10-01] [--lookback 250]
//   python scripts/kronos/predict.py --kronos <Kronos checkout> --input .cache/eval/kronos/input.json --out .cache/eval/kronos/preds-0.json
//   node dist/cli/evalKronos.js --stage score
//
// prep reads .cache/eval/ (evalFetch.ts) and writes .cache/eval/kronos/input.json (bars up to each cutoff and the
// next 20 trading dates, nothing after the cutoff) and truth.json (what happened, the base chance from a model fitted
// only on outcomes before --testFrom, and the statistical range). score joins every preds-*.json and writes
// data/eval/kronos-<date>.json and .md. The window starts after the Kronos weights were last changed (2025-09-09).

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fitOddsModel, oddsFeatures, predictOdds, type OddsFeatures } from '../analysis/baseOdds.js';
import { crossSection, H, liquidSets, panelStock, ymd, type MarketView, type PanelStock, type RawBar } from '../analysis/evalPanel.js';
import { KRONOS_METHOD, scoreKronos, type KronosRow } from '../analysis/kronosEval.js';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] ?? d : d; };
const STAGE = arg('stage', 'prep'), TOP = Number(arg('top', '100')), FROM = arg('from', '2016-01-01'), TEST_FROM = arg('testFrom', '2025-10-01'), LOOKBACK = Number(arg('lookback', '250'));
const root = process.cwd(), dir = join(root, '.cache', 'eval'), out = join(dir, 'kronos');
const readJson = async <T>(p: string, d: T): Promise<T> => JSON.parse(await readFile(p, 'utf8').catch(() => JSON.stringify(d))) as T;

type Truth = Omit<KronosRow, 'paths'>;

async function prep() {
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

  // The base model sees only outcomes that were known before the scored window.
  const fitRows: (OddsFeatures & { up: number })[] = [];
  const truth: Truth[] = [];
  const input: { id: string; bars: RawBar[]; future: number[] }[] = [];
  const later: { date: string; symbol: string; i: number; ret: number; excess: number; ended: boolean; feats: OddsFeatures | null; p10: number | null; p90: number | null; sigma: number | null; future: number[] }[] = [];
  for (const s of sets) {
    const date = ymd(s.date), outcome = ymd(calendar[s.k + H]!);
    for (const r of crossSection(stocks, s.symbols, date, outcome, market)) {
      const st = stocks.get(r.symbol)!, feats = oddsFeatures(st.bars.slice(Math.max(0, r.i - 260), r.i + 1));
      if (outcome < TEST_FROM) { if (feats) fitRows.push({ ...feats, up: r.ret > 0 ? 1 : 0 }); continue; }
      if (date < TEST_FROM) continue;
      later.push({ date, symbol: r.symbol, i: r.i, ret: r.ret, excess: r.excess, ended: r.ended, feats, p10: r.p10, p90: r.p90, sigma: r.sigma, future: calendar.slice(s.k + 1, s.k + 1 + H) });
    }
  }
  const model = fitOddsModel(fitRows), constant = fitRows.reduce((a, o) => a + o.up, 0) / Math.max(1, fitRows.length);
  for (const x of later) {
    const id = `${x.date}:${x.symbol}`, bars = rawOf.get(x.symbol)!;
    // Index i in the panel bars is the same index in the raw bars (panelStock keeps them one to one).
    input.push({ id, bars: bars.slice(Math.max(0, x.i - LOOKBACK + 1), x.i + 1), future: x.future });
    truth.push({ id, date: x.date, symbol: x.symbol, ret: x.ret, excess: x.excess, ended: x.ended, base: x.feats ? predictOdds(x.feats, model) : null, p10: x.p10, p90: x.p90, sigma: x.sigma, vol60: x.feats?.vol60 ?? null });
  }
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'input.json'), JSON.stringify({ method: KRONOS_METHOD, horizon: H, lookback: LOOKBACK, rows: input }));
  await writeFile(join(out, 'truth.json'), JSON.stringify({ method: KRONOS_METHOD, top: TOP, testFrom: TEST_FROM, lookback: LOOKBACK, constant, fitRows: fitRows.length, rows: truth }));
  console.error(`stocks ${raw.length}, panel dates ${sets.length}, base fitted on ${fitRows.length} rows (up ${(constant * 100).toFixed(1)}%), scored rows ${truth.length} on ${new Set(truth.map((t) => t.date)).size} dates`);
}

async function score() {
  const t = await readJson<{ top: number; testFrom: string; lookback: number; constant: number; fitRows: number; rows: Truth[] }>(join(out, 'truth.json'), { top: 0, testFrom: '', lookback: 0, constant: 0.5, fitRows: 0, rows: [] });
  const preds: Record<string, number[]> = {};
  const metas: unknown[] = [];
  for (const f of (await readdir(out)).filter((f) => /^preds-.*\.json$/.test(f))) {
    const p = await readJson<{ meta: unknown; preds: Record<string, number[]> }>(join(out, f), { meta: null, preds: {} });
    Object.assign(preds, p.preds); metas.push(p.meta);
  }
  const rows: KronosRow[] = t.rows.filter((r) => preds[r.id]).map((r) => ({ ...r, paths: preds[r.id]! }));
  const s = scoreKronos(rows, t.constant);
  const day = new Date().toISOString().slice(0, 10);
  await mkdir(join(root, 'data/eval'), { recursive: true });
  await writeFile(join(root, 'data/eval', `kronos-${day}.json`), `${JSON.stringify({ method: KRONOS_METHOD, madeAt: new Date().toISOString(), top: t.top, testFrom: t.testFrom, lookback: t.lookback, missing: t.rows.length - rows.length, runs: metas, score: s }, null, 1)}\n`);
  const f = (v: number, k = 3) => (Number.isFinite(v) ? v.toFixed(k) : '–');
  const iv = (x: { mean: number; lo: number; hi: number }, k = 3) => `${f(x.mean, k)} [${f(x.lo, k)}, ${f(x.hi, k)}]${x.lo > 0 ? ' ▲' : x.hi < 0 ? ' ▼' : ''}`;
  const skill = (b: number) => `${((1 - b / s.brier.constant) * 100).toFixed(2)}%`;
  const meta = metas[0] as { model?: string; paths?: number } | undefined;
  const md = [
    `# Kronos 숨긴 미래 평가 ${day}`, '',
    `Kronos(${meta?.model ?? 'Kronos-small'}, 공개 가격 캔들 파운데이션 모델, MIT)가 종목마다 다음 20거래일 경로를 ${meta?.paths ?? '?'}개씩 그리게 하고, 그 마지막 종가들로 "오를 확률", "예상 움직임", "80% 범위"를 만들어 실제 결과와 채점했어요. 같은 종목·같은 날의 통계 기준 확률(위원회 바탕, ${t.testFrom} 전에 결과가 나온 자료로만 맞춤)과 통계 예측 범위를 나란히 봤어요.`, '',
    `- 평가일: ${s.from} ~ ${s.to}, ${s.dates}개(20거래일 간격, 겹치지 않음). 그날 거래대금 상위 ${t.top}종목, 상장폐지 포함. 채점 ${s.rows}건${t.rows.length - rows.length ? `, 예측 없음 ${t.rows.length - rows.length}건` : ''}.`,
    `- Kronos 가중치는 2025-06-30에 처음 공개되고 2025-09-09에 마지막으로 바뀌었어요. 학습 자료 기간이 공개돼 있지 않아서 그 뒤(${t.testFrom}~)만 채점해요. 모델이 본 시기는 섞이지 않아요.`,
    `- 모델에 준 것: 기준일까지 일봉 ${t.lookback}개(시가·고가·저가·종가·거래량)와 다음 20거래일 날짜. 종목 이름은 주지 않았어요.`, '',
    '## 1. 오를 확률 (20거래일 뒤 지금보다 높을까)', '',
    `실제로 오른 비율 ${(s.upRate * 100).toFixed(1)}%. Brier는 낮을수록 좋고, "기준선"은 ${t.testFrom} 전 자료의 오른 비율(${(t.constant * 100).toFixed(1)}%)을 늘 말한 경우예요.`, '',
    '| 예측 | Brier | 기준선 대비 |', '|---|---:|---:|',
    `| Kronos | ${f(s.brier.kronos, 4)} | ${skill(s.brier.kronos)} |`,
    `| 통계 기준 확률(지금 위원회 바탕) | ${f(s.brier.base, 4)} | ${skill(s.brier.base)} |`,
    `| 둘의 평균 | ${f(s.brier.blend, 4)} | ${skill(s.brier.blend)} |`,
    `| 기준선 | ${f(s.brier.constant, 4)} | 0% |`,
    `| 늘 50% | ${f(s.brier.half, 4)} | ${skill(s.brier.half)} |`, '',
    `평가일별 Brier 차이(Kronos − 통계 기준, 음수면 Kronos가 나음): ${iv(s.brierGap, 4)}`, '',
    'Kronos 확률 보정표:', '', '| Kronos가 말한 확률 | 건수 | 평균으로 말한 값 | 실제로 오른 비율 |', '|---|---:|---:|---:|',
    ...s.bands.map((b) => `| ${Math.round(b.lo * 100)}~${Math.round(b.hi * 100)}% | ${b.n} | ${b.n ? `${(b.said * 100).toFixed(1)}%` : '–'} | ${b.n ? `${(b.happened * 100).toFixed(1)}%` : '–'} |`), '',
    '## 2. 같은 날 종목 줄 세우기 (그날 평균 대비 20거래일 초과수익과의 순위 상관, IC)', '',
    '| 신호 | IC [95% 구간] |', '|---|---|',
    `| Kronos 예상 움직임(경로 중앙값) | ${iv(s.ic.kronosMove)} |`,
    `| Kronos 오를 확률 | ${iv(s.ic.kronosUp)} |`,
    `| 통계 기준 확률 | ${iv(s.ic.base)} |`,
    `| 낮은 변동성 | ${iv(s.ic.lowVol)} |`, '',
    `- Kronos − 통계 기준(평가일별 차이): ${iv(s.icGap)}`,
    `- 통계 기준 순위를 뺀 뒤 Kronos가 더하는 정보(부분 순위 상관): ${iv(s.icAdded)}`,
    `- Kronos 상위 20% − 하위 20% 초과수익: ${iv(s.spread, 2)}%p / 20거래일`, '',
    '## 3. 변동 폭', '',
    `| 범위 | 80% 범위 안에 든 비율 | 넓게 본 종목이 실제로 크게 움직인 상관 |`, '|---|---:|---|',
    `| Kronos 경로 10~90% | ${(s.range.kronosCoverage * 100).toFixed(1)}% | ${iv(s.range.kronosSizeIc)} |`,
    `| 통계 예측 범위(지금 화면) | ${(s.range.statCoverage * 100).toFixed(1)}% | ${iv(s.range.statSizeIc)} |`,
    `| 60일 변동성 그대로 | – | ${iv(s.range.volSizeIc)} |`, '',
    `상장폐지·거래정지로 끝난 종목은 범위 채점에서 뺐어요(${s.range.n}건 채점).`, '',
    '## 한계', '',
    `- 평가일이 ${s.dates}개뿐이라 구간이 넓어요. 위의 ▲/▼(95% 구간이 0을 넘지 않음)가 없으면 우연과 구별되지 않아요.`,
    '- 경로 수가 적어 확률과 범위가 거칠어요(16개면 확률 단위가 약 6%p).',
    '- 1년 남짓한 한 가지 장세만 봤어요. 다른 장세에서는 결과가 다를 수 있어요.',
    '- 결과는 내부·방법론용이고 수익률 광고에 쓰지 않아요.', '',
  ].join('\n');
  await writeFile(join(root, 'data/eval', `kronos-${day}.md`), `${md}\n`);
  console.log(md);
}

(STAGE === 'score' ? score() : prep()).catch((e) => { console.error(e); process.exit(1); });
