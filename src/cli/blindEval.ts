// Hidden-future evaluation run (G-244, src/analysis/blindEval.ts).
//
//   node dist/cli/blindEval.js [--ai] [--samples 120] [--budget 2] [--probe 20] [--seed 20261018]
//
// Always: walks every strategy-arena rule forward over every stock in data/prices and scores its calls.
// With --ai and ANTHROPIC_API_KEY: asks the four price-and-volume PMs on the cheap analyst model about
// `samples` blind cutoffs, scores them next to the rules on the same cutoffs, and asks the model on `probe`
// of them which stock and year it thinks it is looking at (a leakage check). Stops before `budget` USD.
// Writes data/eval/blind-<date>.json and .md.

import Anthropic from '@anthropic-ai/sdk';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ANALYSTS, ANALYST_HORIZON, type AnalystId } from '../analysis/analysts.js';
import {
  anonymize, BLIND_ANALYSTS, BLIND_LENS, BLIND_METHOD, BLIND_NOTE, blindEvidence, calibrateRuleCalls, cleanBars, drawSample, evalBoard,
  outcomeOf, ruleCalls, upBrier, upChance, type EvalCall, type EvalOutcome,
} from '../analysis/blindEval.js';
import { LOCK_MODEL, LOCK_SYSTEM } from '../analysis/lockedAnalysts.js';
import { STRATEGIES, type ArenaBar } from '../analysis/strategies.js';
import { usd } from './aiBudget.js';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] ?? d : d; };
const AI = process.argv.includes('--ai');
const SAMPLES = Number(arg('samples', '120')), BUDGET = Number(arg('budget', '2')), PROBE = Number(arg('probe', '20')), SEED = Number(arg('seed', '20261018'));
/** Rule calls before this date are warm-up for their confidence and are not scored on the main board. */
const SCORE_FROM = arg('from', '2024-01-01');
const root = process.cwd();

async function loadSeries(): Promise<{ symbol: string; name: string; bars: ArenaBar[] }[]> {
  const names = new Map<string, string>((JSON.parse(await readFile(join(root, 'data/universe/stocks.json'), 'utf8')) as { symbol: string; name: string }[]).map((s) => [s.symbol, s.name]));
  const files = (await readdir(join(root, 'data/prices'))).filter((f) => f.endsWith('.jsonl') && !f.startsWith('KRW-'));
  const out = [];
  for (const f of files) {
    const rows = (await readFile(join(root, 'data/prices', f), 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l) as ArenaBar);
    const bars = cleanBars(rows);
    const symbol = f.replace('.jsonl', '');
    if (bars.length >= 300) out.push({ symbol, name: names.get(symbol) ?? symbol, bars });
  }
  return out;
}

const nameOf = (k: string) => STRATEGIES.find((s) => s.key === k)?.name ?? ANALYSTS.find((a) => a.id === k)?.name ?? k;
const pct = (v: number | null) => (v == null ? '–' : `${(v * 100).toFixed(1)}%`);
const sgn = (v: number | null) => (v == null ? '–' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`);

function table(rows: ReturnType<typeof evalBoard>): string {
  const head = '| 예측자 | 건수 | 상승 확률 Brier | 적중률 | 평균 확신 | 확신 Brier | 목표가 오차 중앙값 | 강세 비중 | 강세 때 평균 20일 변동 | 전체 평균 20일 변동 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|';
  return [head, ...rows.map((r) => `| ${nameOf(r.predictor)} | ${r.n} | ${r.upBrier.toFixed(4)} | ${pct(r.hitRate)} | ${r.avgConfidence.toFixed(0)} | ${r.brier.toFixed(3)} | ${r.medianErrPct.toFixed(1)}% | ${pct(r.stances.BULLISH)} | ${sgn(r.bullAvgMovePct)} | ${sgn(r.allAvgMovePct)} |`)].join('\n');
}

const LockReply = (t: string) => { const a = t.indexOf('{'), b = t.lastIndexOf('}'); return JSON.parse(t.slice(a, b + 1)) as { stance?: string; confidence?: number; target?: number }; };

async function main() {
  const series = await loadSeries();
  const bySymbol = new Map(series.map((s) => [s.symbol, s]));
  console.error(`stocks ${series.length}`);

  // ---- part 1: rules, walked forward ----
  const ruleAll = calibrateRuleCalls(series.flatMap((s) => ruleCalls(s.symbol, s.bars)));
  const ruleOut = ruleAll.map((c) => outcomeOf(c, bySymbol.get(c.symbol)!.bars)).filter((o): o is EvalOutcome => !!o);
  const main = ruleOut.filter((o) => o.baseDate >= SCORE_FROM);
  const ruleBoard = evalBoard(main);
  const years = [...new Set(main.map((o) => o.baseDate.slice(0, 4)))].sort();
  const ruleByYear = Object.fromEntries(years.map((y) => [y, evalBoard(main.filter((o) => o.baseDate.startsWith(y))).map((r) => ({ predictor: r.predictor, n: r.n, hitRate: r.hitRate, brier: r.brier, upBrier: r.upBrier, bullAvgMovePct: r.bullAvgMovePct, allAvgMovePct: r.allAvgMovePct }))]));
  const scoredFrom = main.reduce((m, o) => (o.baseDate < m ? o.baseDate : m), '9999'), scoredTo = main.reduce((m, o) => (o.baseDate > m ? o.baseDate : m), '');

  // ---- part 2: blind PMs ----
  let ai: Record<string, unknown> | null = null;
  const key = process.env.ANTHROPIC_API_KEY;
  if (AI && !key) console.error('--ai given but ANTHROPIC_API_KEY is not set; skipping the AI part');
  if (AI && key) {
    const client = new Anthropic({ apiKey: key, timeout: 120000, maxRetries: 2 });
    const sample = drawSample(series, SAMPLES, SEED);
    let spent = 0, calls = 0, failed = 0, stopped = false;
    const tokens = { input: 0, output: 0 };
    const ask = async (system: string, user: string, maxTokens = 1500): Promise<string | null> => {
      if (spent + 0.002 > BUDGET) { stopped = true; return null; }
      try {
        const r = await client.messages.create({ model: LOCK_MODEL, max_tokens: maxTokens, output_config: { effort: 'low' }, system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: user }] });
        calls += 1; tokens.input += r.usage.input_tokens; tokens.output += r.usage.output_tokens;
        spent += usd(LOCK_MODEL, r.usage.input_tokens, r.usage.output_tokens, r.usage.cache_read_input_tokens ?? 0, r.usage.cache_creation_input_tokens ?? 0);
        return r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
      } catch (e) { failed += 1; console.error(String(e).slice(0, 200)); return null; }
    };
    const pmOut: EvalOutcome[] = [];
    const consensus: { up: number; rose: boolean; year: string }[] = [];
    const items = sample.map((s) => ({ ...s, bars: bySymbol.get(s.symbol)!.bars }));
    // Four cutoffs at a time, the four PMs of each in parallel.
    for (let k = 0; k < items.length && !stopped; k += 4) {
      await Promise.all(items.slice(k, k + 4).map(async (it) => {
        const anon = anonymize(it.bars, it.cutoff);
        const ev = blindEvidence(anon);
        const base = it.bars[it.cutoff]!;
        const mine: EvalCall[] = [];
        await Promise.all(BLIND_ANALYSTS.map(async (id: AnalystId) => {
          const a = ANALYSTS.find((x) => x.id === id)!;
          const lens = ev.filter((e) => BLIND_LENS[id]!.includes(e.id));
          const text = await ask(LOCK_SYSTEM, `당신은 ${a.name}예요. 보는 것: ${a.focus}.\n${BLIND_NOTE}\n\n${JSON.stringify({ 종목: '비공개', 기준_종가: 100, 근거_목록: lens.map(({ id: i, label, detail }) => ({ id: i, 제목: label, 내용: detail })) })}`);
          if (!text) return;
          try {
            const p = LockReply(text);
            const stance = (['BULLISH', 'BEARISH', 'NEUTRAL'] as const).find((s) => s === p.stance);
            const t = Number(p.target), conf = Number(p.confidence);
            if (!stance || !(t > 0) || t > 300 || t < 33 || !Number.isFinite(conf)) { failed += 1; return; }
            // Back from the 100 scale; a direction the target contradicts is read the stance's way (as the live parser keeps the stance).
            const realT = (t / 100) * base.close;
            mine.push({ predictor: id, symbol: it.symbol, baseIdx: it.cutoff, baseDate: base.date, baseClose: base.close, stance, confidence: Math.max(0, Math.min(100, conf)), target: stance === 'BULLISH' ? Math.max(realT, base.close * 1.001) : stance === 'BEARISH' ? Math.min(realT, base.close * 0.999) : realT });
          } catch { failed += 1; }
        }));
        for (const c of mine) { const o = outcomeOf(c, it.bars); if (o) pmOut.push(o); }
        const o = it.bars[it.cutoff + ANALYST_HORIZON];
        if (mine.length && o) {
          const logit = (p: number) => Math.log(p / (1 - p));
          const up = 1 / (1 + Math.exp(-mine.reduce((s, c) => s + logit(Math.max(0.02, Math.min(0.98, upChance(c)))), 0) / mine.length));
          consensus.push({ up, rose: o.close > base.close, year: base.date.slice(0, 4) });
        }
      }));
      console.error(`ai ${Math.min(k + 4, items.length)}/${items.length} calls ${calls} $${spent.toFixed(4)}`);
    }
    // Rules on the very same cutoffs.
    const keys = new Set(sample.map((s) => `${s.symbol}|${s.cutoff}`));
    const ruleSame = ruleOut.filter((o) => keys.has(`${o.symbol}|${o.baseIdx}`));
    const sameRows = evalBoard([...pmOut, ...ruleSame]);
    // Leakage probe: can the model name the stock or the year from the blind file?
    const probes: { symbol: string; name: string; year: string; guessName: string; guessYear: string; nameRight: boolean; yearRight: boolean }[] = [];
    for (const it of items.slice(0, PROBE)) {
      if (stopped) break;
      const s = bySymbol.get(it.symbol)!;
      const anon = anonymize(it.bars, it.cutoff);
      const ev = blindEvidence(anon).filter((e) => e.id === 'P1' || e.id === 'S1');
      const raw = anon.slice(-120).map((b) => b.close.toFixed(1)).join(' ');
      const text = await ask('너는 한국 주식 차트 퀴즈를 푸는 사람이에요. JSON 하나로만 답해요: {"company":"추측한 종목 이름","year":"추측한 연도 4자리","why":"한 문장"}. 모르면 가장 그럴듯한 답을 적어요.',
        `종목과 날짜를 가린 한국 상장 종목의 일봉이에요(마지막 종가 100 기준). 어느 종목의 언제일까요?\n최근 120거래일 종가: ${raw}\n${ev.map((e) => `${e.label}: ${e.detail}`).join('\n')}`, 600);
      if (!text) continue;
      try {
        const p = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as { company?: string; year?: string };
        const g = String(p.company ?? '').replace(/\s/g, ''), nm = s.name.replace(/\s/g, ''), yr = s.bars[it.cutoff]!.date.slice(0, 4);
        probes.push({ symbol: s.symbol, name: s.name, year: yr, guessName: String(p.company ?? ''), guessYear: String(p.year ?? ''), nameRight: !!g && (g.includes(nm) || nm.includes(g)), yearRight: String(p.year ?? '').includes(yr) });
      } catch { failed += 1; }
    }
    ai = {
      model: LOCK_MODEL, samples: sample.length, calls, failed, stoppedAtBudget: stopped, budgetUsd: BUDGET, costUsd: Math.round(spent * 1e4) / 1e4, tokens,
      board: sameRows,
      committee: { n: consensus.length, upBrier: upBrier(consensus) },
      byYear: Object.fromEntries([...new Set(pmOut.map((o) => o.baseDate.slice(0, 4)))].sort().map((y) => [y, evalBoard(pmOut.filter((o) => o.baseDate.startsWith(y))).map((r) => ({ predictor: r.predictor, n: r.n, hitRate: r.hitRate, brier: r.brier, upBrier: r.upBrier }))])),
      committeeByYear: Object.fromEntries([...new Set(consensus.map((c) => c.year))].sort().map((y) => [y, { n: consensus.filter((c) => c.year === y).length, upBrier: upBrier(consensus.filter((c) => c.year === y)) }])),
      probe: { n: probes.length, nameRight: probes.filter((p) => p.nameRight).length, yearRight: probes.filter((p) => p.yearRight).length, items: probes },
    };
  }

  const date = new Date().toISOString().slice(0, 10);
  const out = { method: BLIND_METHOD, madeAt: new Date().toISOString(), horizon: ANALYST_HORIZON, stocks: series.length, rules: { scoredFrom, scoredTo, calls: main.length, board: ruleBoard, byYear: ruleByYear }, ai };
  await mkdir(join(root, 'data/eval'), { recursive: true });
  await writeFile(join(root, 'data/eval', `blind-${date}.json`), `${JSON.stringify(out, null, 1)}\n`);
  const md = [
    `# 숨긴 미래 평가 ${date} (${BLIND_METHOD})`, '',
    `종목 ${series.length}개, 기준일마다 뒤 ${ANALYST_HORIZON}거래일을 가리고 실제 위원회 채점 방식으로 채점했어요.`, '',
    `## 전략 (워크포워드, ${scoredFrom} ~ ${scoredTo}, ${main.length}건)`, '', table(ruleBoard), '',
    ...(ai ? [`## AI 위원 블라인드 (${String(ai.model)}, 표본 ${String(ai.samples)}개, 호출 ${String(ai.calls)}번, 비용 $${String(ai.costUsd)})`, '', '같은 기준일에서 전략과 나란히 채점했어요.', '', table(ai.board as ReturnType<typeof evalBoard>), '',
      `위원 4명 합의(상승 확률, 로그 오즈 평균)의 Brier: ${(ai.committee as { upBrier: number }).upBrier.toFixed(4)} (${(ai.committee as { n: number }).n}건, 0.25 = 항상 50%)`, '',
      `누출 점검: ${(ai.probe as { n: number }).n}개 중 종목 이름 맞힘 ${(ai.probe as { nameRight: number }).nameRight}개, 연도 맞힘 ${(ai.probe as { yearRight: number }).yearRight}개`] : ['AI 부분은 실행하지 않았어요 (--ai와 API 키 필요).']),
  ].join('\n');
  await writeFile(join(root, 'data/eval', `blind-${date}.md`), `${md}\n`);
  console.log(md);
}

void main().catch((e) => { console.error(e); process.exit(1); });
