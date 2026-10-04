// Run alert (docs/DESIGN.md §4.7, G-32): reads data/status/last-run.json and
// says whether the run needs a person. The workflow opens or updates one GitHub
// issue labelled "run-alert" when it does, and closes it once a run is healthy.
//
// Alerts on: a stock that failed outright, the stock list or the all-stock
// chart pages failing, or a stock's own daily prices failing. News and other
// best-effort sources are listed but do not alert on their own.

import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export interface LastRun {
  at: string;
  selected: string | null;
  universe: { source: string; ok: boolean; count: number; error?: string }[];
  stocks: { symbol: string; report: string; failedSources: { source: string; error: string }[] }[];
  failed: { symbol: string; error: string }[];
}

/** Drops anything that looks like a credential from an error message. */
export function scrub(text: string): string {
  return text.replace(/(crtfc_key|api[_-]?key|key|token|secret|client_secret)=([^&\s]+)/gi, '$1=***').replace(/https?:\/\/\S+/g, (u) => u.split('?')[0]!).slice(0, 200);
}

const CRITICAL = /^naver:fchart:day$|^naver:fchart:day:\d{6}$/;

export function alertFor(run: LastRun): { alert: boolean; title: string; body: string } {
  const lines: string[] = [];
  const notes: string[] = [];
  for (const f of run.failed) lines.push(`- 종목 실패 \`${f.symbol}\`: ${scrub(f.error)}`);
  for (const u of run.universe) if (!u.ok) lines.push(`- 전 종목 수집 실패 \`${u.source}\`: ${scrub(u.error ?? '')}`);
  for (const s of run.stocks) for (const f of s.failedSources) {
    (CRITICAL.test(f.source) ? lines : notes).push(`- \`${s.symbol}\` \`${f.source}\`: ${scrub(f.error)}`);
  }
  const alert = lines.length > 0;
  const title = alert ? `실행 경보: ${run.at.slice(0, 16).replace('T', ' ')} UTC 실행에서 ${lines.length}건 실패` : '실행 정상';
  const body = [
    `마지막 실행: ${run.at} (UTC)${run.selected ? ` · 주간 선정 ${run.selected}` : ''}`,
    `종목 ${run.stocks.length}개 처리 · 리포트 작성 ${run.stocks.filter((s) => s.report === 'WRITTEN').length}개`,
    '',
    alert ? '## 확인이 필요한 실패' : '확인이 필요한 실패는 없어요.',
    ...lines,
    ...(notes.length ? ['', `## 참고 (경보 대상 아님, ${notes.length}건)`, ...notes.slice(0, 30)] : []),
    '',
    '_data/status/last-run.json에서 자동으로 만든 글이에요._',
  ].join('\n');
  return { alert, title, body };
}

// CLI: node dist/cli/alert.js <last-run.json> <out.md> → prints "alert=true|false" and "title=…" for $GITHUB_OUTPUT.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [input = 'data/status/last-run.json', out = 'alert.md'] = process.argv.slice(2);
  const result = alertFor(JSON.parse(await readFile(input, 'utf8')) as LastRun);
  await writeFile(out, result.body);
  console.log(`alert=${result.alert}`);
  console.log(`title=${result.title}`);
}
