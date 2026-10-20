// Hidden-future evaluation, extended checks (G-247): discovery/confirm split, costs and turnover, subgroups,
// 5- and 60-session horizons, and a combined score (src/analysis/evalMore.ts). No AI. Reads .cache/eval/
// (evalFetch.ts) and data/universe/stocks.json, writes data/eval/more-<date>.json and .md.
//
//   node dist/cli/evalMore.js [--top 200] [--from 2016-01-01] [--cut 2023-01-01] [--cost 0.25]

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { addCombo, costCheck, rehorizon, splitCheck, subset, type Dated } from '../analysis/evalMore.js';
import { crossSection, H, liquidSets, panelStock, scoreSignal, SIGNALS, ymd, type MarketView, type PanelStock, type RawBar } from '../analysis/evalPanel.js';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] ?? d : d; };
const TOP = Number(arg('top', '200')), FROM = arg('from', '2016-01-01'), CUT = arg('cut', '2023-01-01'), COST = Number(arg('cost', '0.25')) / 100;
const root = process.cwd(), dir = join(root, '.cache', 'eval');
const readJson = async <T>(p: string, d: T): Promise<T> => JSON.parse(await readFile(p, 'utf8').catch(() => JSON.stringify(d))) as T;

export const COMBO = ['lowvol', 'high52', 'rev5', 'meanrev'] as const;
const FOCUS = ['combo', 'lowvol', 'high52', 'rev5', 'meanrev', 'mom12_1', 'momentum', 'trend', 'breakout', 'volsurge', 'max20'];

const f = (v: number, k = 3) => (Number.isFinite(v) ? v.toFixed(k) : '–');
const ci = (x: { mean: number; lo: number; hi: number } | undefined, k = 3) => (x ? `${f(x.mean, k)} [${f(x.lo, k)}, ${f(x.hi, k)}]${x.lo > 0 ? ' ▲' : x.hi < 0 ? ' ▼' : ''}` : '–');
const icCell = (x: { ic: { mean: number; lo: number; hi: number } } | null) => (x ? `${f(x.ic.mean, 3)}${x.ic.lo > 0 ? '▲' : x.ic.hi < 0 ? '▼' : ''}` : '–');

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

  const base: Dated[] = sets.map((s) => ({ date: ymd(s.date), outcome: ymd(calendar[s.k + H]!), rows: crossSection(stocks, s.symbols, ymd(s.date), ymd(calendar[s.k + H]!), market) }));
  const { dates, weights } = addCombo(base, COMBO);
  const keys = [...SIGNALS.filter((s) => s.group === 'rule' || s.group === 'factor').map((s) => s.key), 'combo'];
  const nameOf = (k: string) => (k === 'combo' ? `조합 점수(${COMBO.map((c) => SIGNALS.find((s) => s.key === c)?.name ?? c).join(' + ')})` : SIGNALS.find((s) => s.key === k)?.name ?? k);

  // 1. Discovery / confirm
  const split = keys.map((k) => splitCheck(k, dates, CUT));
  // 2. Costs
  const costs = keys.map((k) => costCheck(k, dates, COST)).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.longNet.mean - a.longNet.mean);
  // 3. Subgroups (each measured against its own average)
  const rank = new Map(sets.map((s) => [ymd(s.date), new Map(s.symbols.map((x, n) => [x, n]))]));
  const idx = (d: string) => market.close.get(d) ?? NaN;
  const groups: Record<string, Dated[]> = {
    '전체': dates,
    '코스피(현재 상장)': subset(dates, (r) => listed.get(r.symbol) === 'KOSPI'),
    '코스닥(현재 상장)': subset(dates, (r) => listed.get(r.symbol) === 'KOSDAQ'),
    [`거래대금 상위 ${TOP / 2}`]: subset(dates, (r, d) => (rank.get(d.date)?.get(r.symbol) ?? TOP) < TOP / 2),
    [`거래대금 ${TOP / 2 + 1}~${TOP}위`]: subset(dates, (r, d) => (rank.get(d.date)?.get(r.symbol) ?? TOP) >= TOP / 2),
    '코스피가 오른 20일': dates.filter((d) => idx(d.outcome) > idx(d.date)),
    '코스피가 내린 20일': dates.filter((d) => idx(d.outcome) <= idx(d.date)),
    '하락장 해(2018, 2022)': dates.filter((d) => d.date.startsWith('2018') || d.date.startsWith('2022')),
  };
  const sub = Object.fromEntries(Object.entries(groups).map(([g, ds]) => [g, { dates: ds.length, scores: Object.fromEntries(FOCUS.map((k) => [k, scoreSignal(k, ds)])) }]));
  // 4. Other horizons: 5 sessions on every date (no overlap), 60 sessions on every third date (no overlap).
  const kAt = new Map(sets.map((s) => [ymd(s.date), s.k]));
  const outcomeAt = (h: number) => (d: string) => { const k = kAt.get(d)!; return k + h < calendar.length ? ymd(calendar[k + h]!) : undefined; };
  const horizons: Record<string, Dated[]> = {
    '5거래일': rehorizon(dates, stocks, outcomeAt(5)),
    '20거래일': dates,
    '60거래일': rehorizon(dates.filter((_, n) => n % 3 === 0), stocks, outcomeAt(60)),
  };
  const hor = Object.fromEntries(Object.entries(horizons).map(([h, ds]) => [h, { dates: ds.length, scores: Object.fromEntries(FOCUS.map((k) => [k, scoreSignal(k, ds)])) }]));
  // 5. Combined score, in full
  const combo = scoreSignal('combo', dates);
  const lastW = weights.at(-1)?.w ?? {};

  const day = new Date().toISOString().slice(0, 10);
  const verdictKo = { confirmed: '확인됨', weaker: '약해짐(방향은 같음)', faded: '사라짐', flipped: '뒤집힘', none: '발견 구간에서 뚜렷하지 않음' } as const;
  const out = { method: 'gnm-panel-more-v1', madeAt: new Date().toISOString(), top: TOP, from: FROM, cut: CUT, roundTripCost: COST, universe: raw.length, dates: dates.length, combo: { components: COMBO, score: combo, lastWeights: lastW }, split, costs, subgroups: sub, horizons: hor };
  await mkdir(join(root, 'data/eval'), { recursive: true });
  await writeFile(join(root, 'data/eval', `more-${day}.json`), `${JSON.stringify(out, null, 1)}\n`);
  const matrix = (title: string, m: Record<string, { dates: number; scores: Record<string, ReturnType<typeof scoreSignal>> }>) => [
    `| 신호 | ${Object.entries(m).map(([g, v]) => `${g} (${v.dates}일)`).join(' | ')} |`,
    `|---|${Object.keys(m).map(() => '---:').join('|')}|`,
    ...FOCUS.map((k) => `| ${k === 'combo' ? '조합 점수' : nameOf(k)} | ${Object.values(m).map((v) => icCell(v.scores[k] ?? null)).join(' | ')} |`),
    '', `값은 ${title} 순위 상관(IC) 평균, ▲/▼는 95% 구간이 0을 벗어난 것.`,
  ];
  const md = [
    `# 숨긴 미래 평가 확장 검증 ${day}`, '',
    `상장폐지 포함 ${raw.length}종목, 평가일마다 그날 거래대금 상위 ${TOP}종목, ${dates[0]?.date} ~ ${dates.at(-1)?.date}, 평가일 ${dates.length}개. 수익은 그날 평가 대상 평균 대비 초과수익이에요. AI는 쓰지 않았어요.`, '',
    `## 1. 발견 구간(~${CUT.slice(0, 4)}년 전)과 확인 구간(${CUT.slice(0, 4)}년~) 나눠 보기`, '',
    '| 신호 | 발견 구간 IC | 확인 구간 IC | 판정 |', '|---|---:|---:|---|',
    ...split.map((s) => `| ${nameOf(s.key)} | ${ci(s.discovery?.ic)} | ${ci(s.confirm?.ic)} | ${verdictKo[s.verdict]} |`), '',
    `## 2. 매매 비용(왕복 ${(COST * 100).toFixed(2)}%)과 회전율`, '',
    '상위 20%를 20거래일마다 다시 고르고, 새로 바뀐 종목만큼 비용을 뺐어요. 값은 20거래일당 %p.', '',
    '| 신호 | 상위 20% 교체율 | 상위 20% − 평균 (비용 전) | 비용 후 | 상위 − 하위 (비용 전) | 비용 후 |', '|---|---:|---:|---:|---:|---:|',
    ...costs.map((c) => `| ${nameOf(c.key)} | ${(c.turnover * 100).toFixed(0)}% | ${ci(c.longGross, 2)} | ${ci(c.longNet, 2)} | ${ci(c.spreadGross, 2)} | ${ci(c.spreadNet, 2)} |`), '',
    '## 3. 구간별', '', ...matrix('그 구간의', sub), '',
    '시장 구분은 지금 상장된 종목만 알 수 있어서, 상장폐지 종목은 시장별 줄에서 빠져요.', '',
    '## 4. 다른 기간', '', ...matrix('그 기간의', hor), '',
    '## 5. 조합 점수', '',
    `구성: ${COMBO.map(nameOf).join(', ')}. 각 평가일의 무게는 그 전 평가일들의 IC 평균(음수면 0)으로만 정했어요(처음 6번은 같은 무게).`, '',
    combo ? `- IC ${ci(combo.ic)}, IC>0 비율 ${(combo.icPositive * 100).toFixed(0)}%, 상위−하위 ${ci(combo.spread, 2)}%p, 시장 이기기 Brier ${f(combo.brier)} (기준선 대비 ${(combo.skill * 100).toFixed(2)}%)` : '- 계산할 수 없었어요.',
    `- 마지막 평가일 무게: ${Object.entries(lastW).map(([k, w]) => `${nameOf(k)} ${f(w, 3)}`).join(', ')}`,
    `- 낮은 변동성 하나만: IC ${ci(scoreSignal('lowvol', dates)?.ic)}`,
  ].join('\n');
  await writeFile(join(root, 'data/eval', `more-${day}.md`), `${md}\n`);
  console.log(md);
}

main().catch((e) => { console.error(e); process.exit(1); });
