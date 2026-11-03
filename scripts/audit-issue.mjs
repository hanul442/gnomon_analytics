// G-312 (매일 사이트 자동 점검): after the live audit, keep ONE GitHub issue labelled `live-audit` in step with what is
// broken today. Only serious findings count: script errors and failed requests (404 and so on), pages that do not
// open, sideways overflow, broken images, repeated ids, failed AI text, and data that stopped updating. Known noise
// (slow API loading lines, small tap targets, many '없음') stays in the log only. Clean day = the issue is closed.
// Usage: AUDIT_OUT=findings.json node scripts/audit-issue.mjs  (GITHUB_TOKEN + GITHUB_REPOSITORY in Actions)
import { readFile } from 'node:fs/promises';

const SERIOUS = ['fatal', 'errors', 'overflowPx', 'overflowBy', 'brokenImages', 'duplicateIds', 'aiFailed', 'wording', 'notLoggedIn'];
// 11/1~11/19 the alpha is paused (G-306): every non-admin session gets 401 on /me. Expected until the beta opens.
const EXPECTED = [/^401 GET \/me\b/, /^401 .*gnm-api.*\/me\b/];

/** The serious part of each audit row; rows with nothing serious left are dropped. */
export function serious(rows) {
  const out = [];
  for (const r of rows) {
    const keep = {};
    for (const k of SERIOUS) {
      if (r[k] === undefined) continue;
      if (k === 'errors') { const e = r.errors.filter((x) => !EXPECTED.some((re) => re.test(x))); if (e.length) keep.errors = e; continue; }
      if (k === 'notLoggedIn' && (r.errors ?? []).some((x) => EXPECTED.some((re) => re.test(x)))) continue;
      keep[k] = r[k];
    }
    if (Object.keys(keep).length) out.push({ as: r.as, width: r.width, path: r.path, ...keep });
  }
  return out;
}

/** Data that stopped: the last daily run is over 30 hours old on a weekday, or a source came back not ok. */
export function staleData(lastRun, now = new Date()) {
  const problems = [];
  const at = new Date(lastRun.at ?? 0), hours = (now.getTime() - at.getTime()) / 36e5;
  const kstDay = new Date(now.getTime() + 9 * 36e5).getUTCDay();
  if (kstDay >= 2 && kstDay <= 6 && hours > 30) problems.push(`마지막 매일 실행이 ${Math.round(hours)}시간 전(${lastRun.at})이에요.`);
  const bad = (lastRun.universe ?? []).filter((u) => u && u.ok === false).map((u) => u.source);
  if (bad.length) problems.push(`가져오지 못한 출처: ${bad.join(', ')}`);
  return problems;
}

export function issueBody(rows, stale, runUrl) {
  const lines = ['매일 라이브 점검(Live audit)에서 찾은 문제예요. 다음 점검에서 문제가 없으면 이 이슈는 저절로 닫혀요.', ''];
  if (stale.length) lines.push('## 멈춘 데이터', ...stale.map((x) => `- ${x}`), '');
  if (rows.length) {
    lines.push('## 화면 문제', '| 계정 | 폭 | 페이지 | 문제 |', '|---|---|---|---|');
    for (const r of rows.slice(0, 40)) {
      const { as, width, path, ...rest } = r;
      const what = Object.entries(rest).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' / ') : typeof v === 'object' ? JSON.stringify(v) : v}`).join('<br>').replace(/\|/g, '\\|');
      lines.push(`| ${as} | ${width} | \`${path}\` | ${what} |`);
    }
    if (rows.length > 40) lines.push('', `그 밖에 ${rows.length - 40}건은 실행 기록에 있어요.`);
  }
  if (runUrl) lines.push('', `실행 기록: ${runUrl}`);
  return lines.join('\n');
}

async function main() {
  const rows = serious(JSON.parse(await readFile(process.env.AUDIT_OUT ?? 'audit-findings.json', 'utf8')));
  let stale = [];
  try { stale = staleData(JSON.parse(await readFile('data/status/last-run.json', 'utf8'))); } catch { stale = ['data/status/last-run.json을 읽지 못했어요.']; }
  const repo = process.env.GITHUB_REPOSITORY, token = process.env.GITHUB_TOKEN;
  const runUrl = repo && process.env.GITHUB_RUN_ID ? `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : '';
  console.log(`serious: ${rows.length} rows, stale: ${stale.length}`);
  if (!repo || !token) { console.log(issueBody(rows, stale, runUrl)); return; }
  const gh = async (method, path, body) => {
    const r = await fetch(`https://api.github.com/repos/${repo}${path}`, { method, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
    return r.json();
  };
  const open = (await gh('GET', '/issues?state=open&labels=live-audit&per_page=5')).filter((i) => !i.pull_request);
  const has = rows.length || stale.length;
  if (has) {
    const title = `라이브 점검: 문제 ${rows.length + stale.length}건 (${new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10)})`;
    const body = issueBody(rows, stale, runUrl);
    if (open[0]) await gh('PATCH', `/issues/${open[0].number}`, { title, body });
    else await gh('POST', '/issues', { title, body, labels: ['live-audit'] });
  } else {
    for (const i of open) {
      await gh('POST', `/issues/${i.number}/comments`, { body: `오늘 점검에서는 문제가 없어서 닫아요.${runUrl ? ` ${runUrl}` : ''}` });
      await gh('PATCH', `/issues/${i.number}`, { state: 'closed', state_reason: 'completed' });
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
