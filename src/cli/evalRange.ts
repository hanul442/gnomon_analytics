// G-305: ten years of the statistical price range, split by market regime (src/analysis/rangeEval.ts).
// Every 5 sessions from 2016, the 200 most-traded stocks of that day (point in time, delisted included) get the
// live range inputs; each candidate band is scored on what followed. No AI. Reads .cache/eval/ (evalFetch.js),
// writes data/eval/range-<date>.json and .md.
//
//   node dist/cli/evalRange.js [--top 200] [--step 5] [--from 2016-01-01] [--cut 2024-01-01]

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { liquidSets, ymd, type RawBar } from '../analysis/evalPanel.js';
import { PRIOR_LABEL, REGIME_LABEL, rangeReport, verdict, type Cell, type RangeSample, type Regime } from '../analysis/rangeEval.js';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] ?? d : d; };
const TOP = Number(arg('top', '200')), STEP = Number(arg('step', '5')), FROM = arg('from', '2016-01-01'), CUT = arg('cut', '2024-01-01');
const root = process.cwd(), dir = join(root, '.cache', 'eval');
const readJson = async <T>(p: string, d: T): Promise<T> => JSON.parse(await readFile(p, 'utf8').catch(() => JSON.stringify(d))) as T;

/** EWMA variance after each daily return, the same recursion as forecastRanges. */
function ewma(r: readonly number[]): number[] {
  const out: number[] = [];
  let v = r.slice(0, 20).reduce((s, x) => s + x * x, 0) / 20;
  r.forEach((x, j) => { if (j >= 20) v = 0.94 * v + 0.06 * x * x; out.push(v); });
  return out;
}

async function main() {
  const names = await readJson<Record<string, string>>(join(dir, 'names.json'), {});
  const kospi = await readJson<RawBar[]>(join(dir, 'KOSPI.json'), []);
  const calendar = kospi.map((b) => b[0]!), kc = kospi.map((b) => b[4]!);
  const raw: { symbol: string; bars: RawBar[] }[] = [];
  for (const file of await readdir(join(dir, 'prices'))) {
    const bars = await readJson<RawBar[]>(join(dir, 'prices', file), []);
    if (bars.length >= 300 && names[file.replace('.json', '')]) raw.push({ symbol: file.replace('.json', ''), bars });
  }
  const sets = liquidSets(raw, calendar, TOP, Number(FROM.replace(/-/g, '')), STEP);
  const prep = new Map(raw.map((s) => {
    const c = s.bars.map((b) => b[4]!), r = c.slice(1).map((x, i) => Math.log(x / c[i]!));
    return [s.symbol, { d: s.bars.map((b) => b[0]!), c, r, v: ewma(r), at: new Map(s.bars.map((b, i) => [b[0]!, i])) }] as const;
  }));
  const samples: RangeSample[] = [];
  for (const set of sets) {
    const k = set.k;
    const prior60 = Math.log(kc[k]! / kc[Math.max(0, k - 60)]!);
    for (const sym of set.symbols) {
      const p = prep.get(sym)!, i = p.at.get(set.date)!;
      if (i < 251) continue;
      const sigS = Math.sqrt(p.v[i - 1]!), lr = p.r.slice(i - 250, i), m = lr.reduce((a, x) => a + x, 0) / lr.length;
      const sigL = Math.sqrt(lr.reduce((a, x) => a + (x - m) ** 2, 0) / (lr.length - 1));
      const recent = p.r.slice(i - 120, i), drift = (recent.reduce((a, x) => a + x, 0) / recent.length) * 0.25;
      if (!(sigS > 0) || !(sigL > 0)) continue;
      for (const h of [5, 20, 60, 120]) {
        if (k + h >= calendar.length) continue;
        const target = calendar[k + h]!;
        let j = p.at.get(target);
        if (j === undefined) { j = -1; for (let t = p.d.length - 1; t >= 0; t -= 1) if (p.d[t]! <= target) { j = t; break; } if (j <= i) continue; }
        samples.push({ date: ymd(set.date), h, sigS, sigL, drift, ret: Math.log(p.c[j]! / p.c[i]!), mkt: Math.log(kc[k + h]! / kc[k]!), prior60 });
      }
    }
  }
  console.error(`stocks ${raw.length}, dates ${sets.length}, samples ${samples.length}`);
  const reports = rangeReport(samples, CUT);
  const base = reports.find((r) => r.key === 'v1')!;
  const verdicts = reports.map((r) => ({ key: r.key, ...verdict(r, base) }));
  const today = new Date().toISOString().slice(0, 10);
  await mkdir(join(root, 'data', 'eval'), { recursive: true });
  await writeFile(join(root, 'data', 'eval', `range-${today}.json`), JSON.stringify({ method: 'gnm-range-eval-v1', top: TOP, step: STEP, from: FROM, cut: CUT, samples: samples.length, reports, verdicts }, null, 1));
  const p = (c: Cell | undefined) => (c ? `${(c.inside * 100).toFixed(1)}%` : '–');
  const lines = [
    `# 예측 범위 10년 국면별 검증 (${today})`, '',
    `거래 많은 상위 ${TOP}종목(그날 기준, 상장폐지 포함), ${STEP}거래일마다, ${samples[0]?.date ?? '–'} ~ ${samples.at(-1)?.date ?? '–'}, 표본 ${samples.length.toLocaleString('ko-KR')}개. ${CUT} 전은 맞추는 데만 쓰고 그 뒤는 시험용으로 남겨 둬요. 목표는 80% 안팎이고, 국면은 같은 기간 코스피가 얼마나 움직였는지로 나눠요.`, '',
  ];
  for (const r of reports) {
    const v = verdicts.find((x) => x.key === r.key)!;
    lines.push(`## ${r.label} (${r.key}) — ${r.key === 'v1' ? '지금 방법' : v.pass ? '통과' : '탈락'}`, '');
    if (!v.pass && r.key !== 'v1') lines.push(...v.reasons.map((x) => `- ${x}`), '');
    lines.push(`| 기간 | 전체 | 맞춘 해 | 시험 해 | ${(Object.keys(REGIME_LABEL) as Regime[]).map((k) => REGIME_LABEL[k]).join(' | ')} | ${Object.values(PRIOR_LABEL).join(' | ')} | 평균 폭 | 범위 점수(시험) |`);
    lines.push(`|${' --- |'.repeat(4 + 5 + 3 + 2)}`);
    for (const x of r.byHorizon) lines.push(`| ${x.h}일 | ${p(x.all)} | ${p(x.dev)} | ${p(x.hold)} | ${(Object.keys(REGIME_LABEL) as Regime[]).map((k) => p(x.regimes[k])).join(' | ')} | ${p(x.prior.bull)} | ${p(x.prior.bear)} | ${p(x.prior.side)} | ${(x.all.width * 100).toFixed(1)}%p | ${x.hold.score.toFixed(4)} |`);
    lines.push('');
  }
  lines.push('범위 점수는 범위 폭에 빗나간 거리의 10배를 더한 값이라 낮을수록 좋아요(너무 넓어도, 자주 빗나가도 나빠져요). 통과 조건: 모든 기간에서 시험 해 적중 78~85%, 급락 구간 적중이 지금 방법 이상, 범위 점수가 지금 방법 이하.');
  await writeFile(join(root, 'data', 'eval', `range-${today}.md`), `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
}

void main().catch((e) => { console.error(e); process.exit(1); });
