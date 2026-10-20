// Hidden-future evaluation v2 (G-245): scores every signal on the point-in-time cross-section (src/analysis/
// evalPanel.ts) and, with --ai, asks blind PMs about 1,000 stock-dates. Reads .cache/eval/ (evalFetch.ts),
// writes data/eval/panel-<date>.json and .md.
//
//   node dist/cli/evalRun.js [--top 200] [--from 2016-01-01] [--ai] [--dates 100] [--perDate 10] [--budget 5] [--probe 30]

import Anthropic from '@anthropic-ai/sdk';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ANALYSTS } from '../analysis/analysts.js';
import { anonymize, blindEvidence } from '../analysis/blindEval.js';
import {
  crossSection, H, liquidSets, meanCI, PANEL_METHOD, panelStock, rangeScore, rng, scoreSignal, SIGNALS, spearman, ymd,
  type MarketView, type PanelStock, type RawBar, type Row,
} from '../analysis/evalPanel.js';
import { BLIND2_LENS, BLIND2_PMS, BLIND2_SYSTEM, eventEvidence, flowEvidence, parseBlind2 } from '../analysis/blindEval2.js';
import { LOCK_MODEL } from '../analysis/lockedAnalysts.js';
import { usd } from './aiBudget.js';
import { luckTest, luckVerdict, shuffle, type LuckTest } from '../analysis/monteCarlo.js';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] ?? d : d; };
const TOP = Number(arg('top', '200')), FROM = arg('from', '2016-01-01');
const AI = process.argv.includes('--ai'), DATES = Number(arg('dates', '100')), PER_DATE = Number(arg('perDate', '10')), BUDGET = Number(arg('budget', '5')), PROBE = Number(arg('probe', '30')), SEED = Number(arg('seed', '20261018'));
const root = process.cwd(), dir = join(root, '.cache', 'eval');

const readJson = async <T>(p: string, d: T): Promise<T> => JSON.parse(await readFile(p, 'utf8').catch(() => JSON.stringify(d))) as T;
const pc = (v: number, k = 1) => `${(v * 100).toFixed(k)}%`;
const f3 = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : '–');
const ci = (x: { mean: number; lo: number; hi: number }, k = 3) => `${x.mean.toFixed(k)} [${x.lo.toFixed(k)}, ${x.hi.toFixed(k)}]`;
const sig = (x: { lo: number; hi: number }) => (x.lo > 0 ? '▲' : x.hi < 0 ? '▼' : '');

async function main() {
  const names = await readJson<Record<string, string>>(join(dir, 'names.json'), {});
  const kospi = await readJson<RawBar[]>(join(dir, 'KOSPI.json'), []);
  const calendar = kospi.map((b) => b[0]!);
  const market: MarketView = { close: new Map(kospi.map((b) => [ymd(b[0]!), b[4]!])), dates: calendar.map(ymd) };
  const raw: { symbol: string; bars: RawBar[] }[] = [];
  for (const f of await readdir(join(dir, 'prices'))) {
    const bars = await readJson<RawBar[]>(join(dir, 'prices', f), []);
    if (bars.length >= 300 && names[f.replace('.json', '')]) raw.push({ symbol: f.replace('.json', ''), bars });
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
  const hasEvents = [...stocks.values()].some((s) => s.events);
  console.error(`stocks ${raw.length}, in panel ${stocks.size}, dates ${sets.length}, events ${hasEvents}`);

  const dates = sets.map((s) => ({ date: ymd(s.date), outcome: ymd(calendar[s.k + H]!), rows: crossSection(stocks, s.symbols, ymd(s.date), ymd(calendar[s.k + H]!), market) }));
  const ended = dates.reduce((a, d) => a + d.rows.filter((r) => r.ended).length, 0), total = dates.reduce((a, d) => a + d.rows.length, 0);
  const scores = SIGNALS.map((s) => scoreSignal(s.key, dates)).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.ic.mean - a.ic.mean);
  const byPeriod = (from: string, to: string) => SIGNALS.map((s) => scoreSignal(s.key, dates.filter((d) => d.date >= from && d.date < to))).filter((x): x is NonNullable<typeof x> => !!x).map((x) => ({ key: x.key, ic: x.ic.mean, spread: x.spread.mean, dates: x.dates }));
  const periods = { '2016-2019': byPeriod('2016', '2020'), '2020-2022': byPeriod('2020', '2023'), '2023-2026': byPeriod('2023', '2027') };
  const range = rangeScore(dates);
  const indexRet = meanCI(dates.map((d) => { const a = market.close.get(d.date), b = market.close.get(d.outcome); return a && b ? (b / a - 1) * 100 : 0; }), 3);

  // ---- AI, blind ----
  let ai: Record<string, unknown> | null = null;
  const key = process.env.ANTHROPIC_API_KEY;
  if (AI && key) ai = await runAi(key, dates, stocks, names);
  else if (AI) console.error('--ai given but ANTHROPIC_API_KEY is not set');

  const day = new Date().toISOString().slice(0, 10);
  const out = { method: PANEL_METHOD, madeAt: new Date().toISOString(), horizon: H, top: TOP, from: FROM, universe: raw.length, inPanel: stocks.size, dates: dates.length, stockDates: total, endedEarly: ended, indexRet, signals: scores, periods, range, ai };
  await mkdir(join(root, 'data/eval'), { recursive: true });
  await writeFile(join(root, 'data/eval', `panel-${day}.json`), `${JSON.stringify(out, null, 1)}\n`);
  const groupName = { rule: '전략 규칙', factor: '가격 요인', flow: '수급', event: '공시' } as const;
  const md = [
    `# 숨긴 미래 평가 v2 ${day} (${PANEL_METHOD})`, '',
    `상장폐지 포함 ${raw.length}종목 중, 평가일마다 그날 거래대금 상위 ${TOP}종목(그날 기준)으로 ${dates[0]?.date} ~ ${dates.at(-1)?.date}, 평가일 ${dates.length}개(20거래일 간격, 겹치지 않음), 종목·날짜 ${total.toLocaleString('ko-KR')}건. 그중 ${ended}건은 20거래일 안에 거래가 끝나(상장폐지 등) 마지막 종가로 채점했어요.`, '',
    '수익은 모두 **그날 평가 대상 종목 평균 대비 초과수익**이에요. [ ]는 날짜를 다시 뽑아 구한 95% 구간이고, ▲/▼는 0을 벗어난 것.', '',
    '## 1·2. 종목 줄 세우기 (신호별)', '',
    '| 신호 | 종류 | 평가일 | 순위 상관(IC) | IC>0 비율 | 상위 20% − 하위 20% (20일, %p) | 시장 이기기 Brier (기준선 대비 개선) |',
    '|---|---|---:|---:|---:|---:|---:|',
    ...scores.map((s) => `| ${s.name} | ${groupName[s.group]} | ${s.dates} | ${ci(s.ic)} ${sig(s.ic)} | ${pc(s.icPositive, 0)} | ${ci(s.spread, 2)} ${sig(s.spread)} | ${f3(s.brier)} (${s.skill >= 0 ? '+' : ''}${(s.skill * 100).toFixed(2)}%) |`), '',
    '## 1. 변동 폭 (통계 예측 범위 R1, 20거래일)', '',
    `- 실제 종가가 하단~상단(80% 범위) 안에 든 비율: ${pc(range.coverage)} (아래로 벗어남 ${pc(range.below)}, 위로 ${pc(range.above)}, ${range.n.toLocaleString('ko-KR')}건)`,
    `- 예측한 변동성이 큰 종목일수록 실제로 크게 움직였는지(순위 상관): ${ci(range.sizeIc)} ${sig(range.sizeIc)}`, '',
    ...(ai ? aiMarkdown(ai) : ['AI 부분은 실행하지 않았어요 (--ai와 API 키 필요).']),
  ].join('\n');
  await writeFile(join(root, 'data/eval', `panel-${day}.md`), `${md}\n`);
  console.log(md);
}

// ---------- AI ----------

async function runAi(key: string, dates: { date: string; outcome: string; rows: Row[] }[], stocks: Map<string, PanelStock>, names: Record<string, string>) {
  const client = new Anthropic({ apiKey: key, timeout: 120000, maxRetries: 2 });
  const rand = rng(SEED);
  // Dates with flows (2020+), spread evenly; on each, PER_DATE random stocks from that day's set.
  const pool = dates.filter((d) => d.rows.filter((r) => stocks.get(r.symbol)?.flows).length >= PER_DATE * 2);
  const pick = Array.from({ length: Math.min(DATES, pool.length) }, (_, k) => pool[Math.floor((k * pool.length) / Math.min(DATES, pool.length))]!);
  let spent = 0, calls = 0, failed = 0, stopped = false;
  const tokens = { input: 0, output: 0 };
  const ask = async (system: string, user: string, maxTokens = 1500) => {
    if (spent + 0.003 > BUDGET) { stopped = true; return null; }
    try {
      const r = await client.messages.create({ model: LOCK_MODEL, max_tokens: maxTokens, output_config: { effort: 'low' }, system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: user }] });
      calls += 1; tokens.input += r.usage.input_tokens; tokens.output += r.usage.output_tokens;
      spent += usd(LOCK_MODEL, r.usage.input_tokens, r.usage.output_tokens, r.usage.cache_read_input_tokens ?? 0, r.usage.cache_creation_input_tokens ?? 0);
      return r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    } catch (e) { failed += 1; console.error(String(e).slice(0, 200)); return null; }
  };
  type Answer = { pm: string; date: string; symbol: string; beat: number; p10: number; p90: number; excess: number; ret: number };
  const answers: Answer[] = [];
  const items: { date: string; row: Row; s: PanelStock }[] = [];
  for (const d of pick) {
    const cand = d.rows.filter((r) => stocks.get(r.symbol)?.flows);
    for (let k = 0; k < PER_DATE && cand.length; k += 1) { const j = Math.floor(rand() * cand.length); items.push({ date: d.date, row: cand[j]!, s: stocks.get(cand[j]!.symbol)! }); cand.splice(j, 1); }
  }
  for (let k = 0; k < items.length && !stopped; k += 5) {
    await Promise.all(items.slice(k, k + 5).map(async (it) => {
      const anon = anonymize(it.s.bars, it.row.i);
      const ev = [...blindEvidence(anon).filter((e) => e.id !== 'Q1'), ...flowEvidence(it.s, it.row.i), ...eventEvidence(it.s, it.row.i)];
      await Promise.all(BLIND2_PMS.map(async (pm) => {
        const a = ANALYSTS.find((x) => x.id === pm)!;
        const lens = ev.filter((e) => BLIND2_LENS[pm]!.some((l) => e.id === l || (l.length === 1 && e.id.startsWith(l))));
        if (!lens.some((e) => e.id !== 'P1' && e.id !== 'R1')) return; // nothing of its own to read
        const text = await ask(BLIND2_SYSTEM, `당신은 ${a.name}예요. 보는 것: ${a.focus}.\n\n${JSON.stringify({ 종목: '비공개', 기준_종가: 100, 근거_목록: lens.map(({ id, label, detail }) => ({ id, 제목: label, 내용: detail })) })}`);
        const p = text ? parseBlind2(text) : null;
        if (!p) { if (text) failed += 1; return; }
        answers.push({ pm, date: it.date, symbol: it.s.symbol, beat: p.beat, p10: p.p10, p90: p.p90, excess: it.row.excess, ret: it.row.ret });
      }));
    }));
    if (k % 50 === 0) console.error(`ai ${k + 5}/${items.length} calls ${calls} $${spent.toFixed(3)}`);
  }
  // Scoring: the same three questions as the signals.
  const pms = [...BLIND2_PMS, 'committee'] as const;
  const committee = new Map<string, Answer[]>();
  for (const a of answers) { const kk = `${a.date}|${a.symbol}`; (committee.get(kk) ?? committee.set(kk, []).get(kk)!).push(a); }
  const logit = (p: number) => Math.log(p / (1 - p));
  for (const xs of committee.values()) {
    const beat = 1 / (1 + Math.exp(-xs.reduce((s, x) => s + logit(Math.min(0.98, Math.max(0.02, x.beat))), 0) / xs.length));
    const med = (f: (x: Answer) => number) => { const v = xs.map(f).sort((p, q) => p - q); return v[Math.floor(v.length / 2)]!; };
    answers.push({ ...xs[0]!, pm: 'committee', beat, p10: med((x) => x.p10), p90: med((x) => x.p90) });
  }
  // Base rate for the Brier comparison: share of stock-dates that beat the day's average across the whole panel before 2020.
  const baseRate = (() => { const rr = dates.filter((d) => d.date < '2020').flatMap((d) => d.rows); return rr.length ? rr.filter((r) => r.excess > 0).length / rr.length : 0.5; })();
  const board = pms.map((pm) => {
    const xs = answers.filter((a) => a.pm === pm);
    if (!xs.length) return null;
    const brier = xs.reduce((s, x) => s + (x.beat - (x.excess > 0 ? 1 : 0)) ** 2, 0) / xs.length;
    const brierBase = xs.reduce((s, x) => s + (baseRate - (x.excess > 0 ? 1 : 0)) ** 2, 0) / xs.length;
    const byDate = new Map<string, Answer[]>(); for (const x of xs) (byDate.get(x.date) ?? byDate.set(x.date, []).get(x.date)!).push(x);
    const ics = [...byDate.values()].filter((v) => v.length >= 5).map((v) => spearman(v.map((x) => x.beat), v.map((x) => x.excess))).filter((v): v is number => v !== null);
    // G-275: could luck give this IC? Block bootstrap over dates plus a per-date shuffle of the answers.
    const days = [...byDate.values()].filter((v) => v.length >= 5);
    const luck = luckTest(days.map((v) => spearman(v.map((x) => x.beat), v.map((x) => x.excess)) ?? NaN), { block: 6, shuffled: (sd) => { const r = rng(sd); return days.map((v) => spearman(shuffle(v.map((x) => x.beat), r), v.map((x) => x.excess)) ?? NaN); } });
    const cov = xs.filter((x) => 1 + x.ret >= x.p10 / 100 && 1 + x.ret <= x.p90 / 100).length / xs.length;
    const width = xs.reduce((s, x) => s + (x.p90 - x.p10), 0) / xs.length;
    const years = Object.fromEntries([...new Set(xs.map((x) => x.date.slice(0, 4)))].sort().map((y) => { const ys = xs.filter((x) => x.date.startsWith(y)); return [y, { n: ys.length, brier: ys.reduce((s, x) => s + (x.beat - (x.excess > 0 ? 1 : 0)) ** 2, 0) / ys.length }]; }));
    return { pm, n: xs.length, avgBeat: xs.reduce((s, x) => s + x.beat, 0) / xs.length, brier, brierBase, skill: 1 - brier / brierBase, ic: meanCI(ics, 5), luck, coverage: cov, avgWidth: width, years };
  }).filter(Boolean);
  // Leakage probe on the latest dates (the most likely to be after the model's training).
  const probes: { name: string; year: string; guessName: string; guessYear: string; nameRight: boolean; yearRight: boolean }[] = [];
  for (const it of [...items].reverse().slice(0, PROBE)) {
    if (stopped) break;
    const anon = anonymize(it.s.bars, it.row.i);
    const text = await ask('너는 한국 주식 차트 퀴즈를 푸는 사람이에요. JSON 하나로만 답해요: {"company":"추측한 종목 이름","year":"추측한 연도 4자리"}. 모르면 가장 그럴듯한 답을 적어요.',
      `종목과 날짜를 가린 한국 상장 종목의 일봉이에요(마지막 종가 100 기준). 어느 종목의 언제일까요?\n최근 120거래일 종가: ${anon.slice(-120).map((b) => b.close.toFixed(1)).join(' ')}\n${flowEvidence(it.s, it.row.i).map((e) => e.detail).join('\n')}`, 600);
    try {
      const p = JSON.parse(text!.slice(text!.indexOf('{'), text!.lastIndexOf('}') + 1)) as { company?: string; year?: string };
      const g = String(p.company ?? '').replace(/\s/g, ''), nm = (names[it.s.symbol] ?? '').replace(/\s/g, '');
      probes.push({ name: names[it.s.symbol] ?? it.s.symbol, year: it.date.slice(0, 4), guessName: String(p.company ?? ''), guessYear: String(p.year ?? ''), nameRight: !!g && !!nm && (g.includes(nm) || nm.includes(g)), yearRight: String(p.year ?? '').includes(it.date.slice(0, 4)) });
    } catch { /* unanswered */ }
  }
  return { model: LOCK_MODEL, dates: pick.length, stockDates: items.length, calls, failed, stoppedAtBudget: stopped, budgetUsd: BUDGET, costUsd: Math.round(spent * 1e4) / 1e4, tokens, baseRate, board,
    probe: { n: probes.length, nameRight: probes.filter((p) => p.nameRight).length, yearRight: probes.filter((p) => p.yearRight).length, items: probes } };
}

function aiMarkdown(ai: Record<string, unknown>): string[] {
  const board = ai.board as { pm: string; n: number; avgBeat: number; brier: number; brierBase: number; skill: number; ic: { mean: number; lo: number; hi: number }; luck?: LuckTest | null; coverage: number; avgWidth: number }[];
  const probe = ai.probe as { n: number; nameRight: number; yearRight: number };
  const nm = (k: string) => (k === 'committee' ? '위원 합의' : ANALYSTS.find((a) => a.id === k)?.name ?? k);
  return [
    `## AI 위원 블라인드 v2 (${String(ai.model)}, 평가일 ${String(ai.dates)}개 × 종목, ${String(ai.stockDates)}건, 호출 ${String(ai.calls)}번, 비용 $${String(ai.costUsd)})`, '',
    '종목명·날짜를 숨기고 가격 100 기준으로 바꾼 자료에 수급(거래량 대비 비율)과 공시 종류(종목명 없이)를 더했어요. 질문은 "20거래일 동안 그날 다른 종목 평균을 이길 확률"과 "20거래일 뒤 가격의 하단·상단(80%)".', '',
    '| 위원 | 건수 | 평균 확률 | 시장 이기기 Brier | 기준선 대비 | 같은 날 순위 상관(IC) | 운 검사(G-275) | 80% 범위 적중 | 평균 범위 폭 |',
    '|---|---:|---:|---:|---:|---:|---|---:|---:|',
    ...board.map((b) => `| ${nm(b.pm)} | ${b.n} | ${pc(b.avgBeat, 0)} | ${f3(b.brier)} | ${b.skill >= 0 ? '+' : ''}${(b.skill * 100).toFixed(1)}% | ${ci(b.ic)} ${sig(b.ic)} | ${b.luck ? `p ${b.luck.p < 0.001 ? '<0.001' : b.luck.p.toFixed(3)} · ${luckVerdict(b.luck)}` : '–'} | ${pc(b.coverage)} | ${b.avgWidth.toFixed(1)} |`), '',
    `누출 점검(가장 최근 평가일 ${probe.n}건): 종목 이름 맞힘 ${probe.nameRight}건, 연도 맞힘 ${probe.yearRight}건`,
  ];
}

void main().catch((e) => { console.error(e); process.exit(1); });
