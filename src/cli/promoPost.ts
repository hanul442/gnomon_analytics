// G-321: posts a promo day's cards (promo/<date>/, G-309) to X and Instagram, and hands the weekly
// Naver blog text over as a GitHub issue to copy (Naver Blog has no write API).
//   node dist/cli/promoPost.js                 the latest promo day; posts only when PROMO_POST=on
//   node dist/cli/promoPost.js --manual        a person pressed Run: posts when PROMO_POST is manual or on
//   --date=YYYY-MM-DD  --only=x,story,insta,blog  --dry (never post)
// Env: PROMO_POST (off|manual|on, default off), PROMO_X_LINK (on keeps the site link in X posts), X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET,
//      IG_ACCESS_TOKEN, IG_USER_ID (optional, default me), GITHUB_TOKEN + GITHUB_REPOSITORY (blog issue).
//      An Instagram-login token (IGAA…) goes to graph.instagram.com; a Facebook-login token (EAA…) to graph.facebook.com,
//      which needs the account ID (IG_USER_ID, else GNOMON's own account).
// What went out is kept in promo/<date>/posted.json so a day is never posted twice.

import { appendFile, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROMO_SITE } from '../report/promoCards.js';
import { checkText, modeOf, xWithoutLink, oauth1Header, planDay, type Channel, type OAuth1Keys, type PlannedPost } from '../report/promoPost.js';

type Posted = Partial<Record<Channel, { id: string; at: string; url?: string }>>;
const LABEL: Record<Channel, string> = { x: 'X', story: '인스타 스토리', insta: '인스타 게시물', blog: '네이버 블로그 글(이슈)' };
const GNOMON_IG_ID = '17841462813820948';
/** Which Graph host a token belongs to: Facebook-login tokens start with EAA. */
const igHost = (token: string) => (token.startsWith('EAA') ? 'https://graph.facebook.com/v23.0' : 'https://graph.instagram.com/v23.0');

const kstDate = (d: Date) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const readText = (p: string) => readFile(p, 'utf8').catch(() => undefined);

async function json(res: Response, what: string): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`${what} ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function postX(p: PlannedPost, dir: string, k: OAuth1Keys): Promise<{ id: string; url: string }> {
  const ids: string[] = [];
  for (const f of p.images) {
    const url = 'https://api.x.com/2/media/upload';
    const form = new FormData();
    form.append('media', new Blob([await readFile(join(dir, f))], { type: 'image/png' }), f);
    form.append('media_category', 'tweet_image');
    const r = await json(await fetch(url, { method: 'POST', headers: { authorization: oauth1Header('POST', url, k) }, body: form }), 'X 이미지 올리기');
    ids.push(String((r.data as { id?: string } | undefined)?.id ?? r.media_id_string));
  }
  const url = 'https://api.x.com/2/tweets';
  const r = await json(await fetch(url, { method: 'POST', headers: { authorization: oauth1Header('POST', url, k), 'content-type': 'application/json' }, body: JSON.stringify({ text: p.text, ...(ids.length ? { media: { media_ids: ids } } : {}) }) }), 'X 글 올리기');
  const id = String((r.data as { id: string }).id);
  return { id, url: `https://x.com/i/web/status/${id}` };
}

async function igCall(path: string, params: Record<string, string>, token: string, method = 'POST'): Promise<Record<string, unknown>> {
  const q = new URLSearchParams({ ...params, access_token: token });
  const IG = igHost(token);
  return json(await fetch(method === 'GET' ? `${IG}/${path}?${q}` : `${IG}/${path}`, method === 'GET' ? {} : { method, body: q }), `인스타 ${path.split('/').pop()}`);
}

async function igReady(id: string, token: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const r = await igCall(id, { fields: 'status_code,status' }, token, 'GET');
    if (r.status_code === 'FINISHED') return;
    if (r.status_code === 'ERROR' || r.status_code === 'EXPIRED') throw new Error(`인스타 준비 실패: ${String(r.status)}`);
    await new Promise((ok) => setTimeout(ok, 3000));
  }
  throw new Error('인스타 준비가 1분 안에 끝나지 않았어요');
}

async function postInsta(p: PlannedPost, date: string, token: string, user: string): Promise<{ id: string }> {
  const urls = p.images.map((f) => `${PROMO_SITE}promo/${date}/${f}`);
  // Instagram fetches the images from the site, so they must be live first.
  for (const u of urls) { const r = await fetch(u, { method: 'HEAD' }); if (!r.ok) throw new Error(`사이트에 이미지가 아직 없어요 (${r.status}): ${u}`); }
  let creation: string;
  if (p.channel === 'story') {
    creation = String((await igCall(`${user}/media`, { image_url: urls[0]!, media_type: 'STORIES' }, token)).id);
  } else if (urls.length === 1) {
    creation = String((await igCall(`${user}/media`, { image_url: urls[0]!, caption: p.text }, token)).id);
  } else {
    const children: string[] = [];
    for (const u of urls) children.push(String((await igCall(`${user}/media`, { image_url: u, is_carousel_item: 'true' }, token)).id));
    for (const c of children) await igReady(c, token);
    creation = String((await igCall(`${user}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption: p.text }, token)).id);
  }
  await igReady(creation, token);
  return { id: String((await igCall(`${user}/media_publish`, { creation_id: creation }, token)).id) };
}

async function postBlogIssue(p: PlannedPost, date: string, token: string, repo: string): Promise<{ id: string; url: string }> {
  const api = `https://api.github.com/repos/${repo}`;
  const h = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' };
  const label = 'promo-blog';
  await fetch(`${api}/labels`, { method: 'POST', headers: h, body: JSON.stringify({ name: label, color: '111111', description: '네이버 블로그에 붙여 넣을 주간 글' }) });
  const open = (await (await fetch(`${api}/issues?labels=${label}&state=open&per_page=10`, { headers: h })).json()) as { number: number }[];
  for (const i of Array.isArray(open) ? open : []) await fetch(`${api}/issues/${i.number}`, { method: 'PATCH', headers: h, body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) });
  const imgs = p.images.map((f) => `![${f}](${PROMO_SITE}promo/${date}/${f})`).join('\n');
  const body = `네이버 블로그 글쓰기에 아래 글을 붙여 넣고, [이미지 n] 자리에 그림을 넣어 주세요. 그림은 길게 눌러 저장하거나 [카드 모음](${PROMO_SITE}promo/)에서 받아요.\n\n${imgs}\n\n\`\`\`\n${p.text}\n\`\`\``;
  const r = await json(await fetch(`${api}/issues`, { method: 'POST', headers: h, body: JSON.stringify({ title: `블로그 주간 글 ${date}`, body, labels: [label] }) }), '블로그 이슈');
  return { id: String(r.number), url: String(r.html_url) };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const arg = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  const root = process.cwd();
  const env = process.env;
  const mode = modeOf(env.PROMO_POST);
  const manual = args.includes('--manual');
  const send = !args.includes('--dry') && (mode === 'on' || (mode === 'manual' && manual));
  const days = (await readdir(join(root, 'promo')).catch(() => [] as string[])).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const date = arg('date') ?? days.at(-1);
  const lines: string[] = [];
  const say = (s: string) => { console.log(s); lines.push(s); };
  const finish = async (code = 0) => { if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`); process.exitCode = code; };

  say(`### SNS 자동 게시 · ${date ?? '카드 없음'} · 모드 ${mode}${send ? '' : ' (이번엔 올리지 않고 미리보기만)'}`);
  if (!date || !days.includes(date)) { say('- 올릴 카드가 없어요.'); return finish(); }
  // A scheduled run only posts the newest day while it is still fresh (today or yesterday in KST).
  const now = new Date(), today = kstDate(now), yesterday = kstDate(new Date(now.getTime() - 864e5));
  if (send && !manual && date !== today && date !== yesterday) { say(`- ${date} 카드는 지난 날이라 자동으로는 올리지 않아요.`); return finish(); }
  // A late daily run can finish in the small hours; the 08:10 KST run posts it instead.
  const hourKst = (now.getUTCHours() + 9) % 24;
  if (send && !manual && hourKst < 7) { say('- 새벽이라 아침 8시 실행 때 올려요.'); return finish(); }

  const dir = join(root, 'promo', date);
  const files = await readdir(dir);
  const plan = planDay(date, files, { x: await readText(join(dir, 'x.txt')), insta: await readText(join(dir, 'insta.txt')), blog: await readText(join(dir, 'blog.txt')) });
  const only = arg('only')?.split(',');
  const postedPath = join(dir, 'posted.json');
  const posted = JSON.parse((await readText(postedPath)) ?? '{}') as Posted;
  const xKeys = env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_SECRET
    ? { consumerKey: env.X_API_KEY, consumerSecret: env.X_API_SECRET, token: env.X_ACCESS_TOKEN, tokenSecret: env.X_ACCESS_SECRET } : null;
  // Pasted secrets sometimes carry a stray space or line break.
  const igToken = (env.IG_ACCESS_TOKEN ?? '').trim();
  let failed = 0;
  if (!plan.length) say('- 주말이거나 이날 만든 카드가 없어서 올릴 게 없어요.');
  for (const p of plan) {
    if (p.channel === 'x' && env.PROMO_X_LINK !== 'on') p.text = xWithoutLink(p.text);
    if (only && !only.includes(p.channel)) continue;
    const head = `- **${LABEL[p.channel]}** (${p.images.join(', ') || '그림 없음'})`;
    if (posted[p.channel]) { say(`${head}: 이미 올렸어요 ${posted[p.channel]!.url ?? posted[p.channel]!.id}`); continue; }
    const problems = checkText(p.text, p.channel);
    if (problems.length) { say(`${head}: 올리지 않아요. 걸린 것: ${problems.join(', ')}`); failed++; continue; }
    const missing = p.channel === 'x' ? !xKeys : p.channel === 'blog' ? !(env.GITHUB_TOKEN && env.GITHUB_REPOSITORY) : !igToken;
    // The blog only becomes an issue to copy from, so it goes out once posting is switched on at all.
    const go = send || (p.channel === 'blog' && mode !== 'off' && !args.includes('--dry'));
    if (!go || missing) {
      say(`${head}: ${missing && go ? '토큰이 없어서 건너뛰어요' : '미리보기'}`);
      if (p.text) say(`\n\`\`\`\n${p.text}\n\`\`\`\n`);
      continue;
    }
    try {
      const r = p.channel === 'x' ? await postX(p, dir, xKeys!)
        : p.channel === 'blog' ? await postBlogIssue(p, date, env.GITHUB_TOKEN!, env.GITHUB_REPOSITORY!)
          : await postInsta(p, date, igToken, env.IG_USER_ID?.trim() || (igToken.startsWith('EAA') ? GNOMON_IG_ID : 'me'));
      posted[p.channel] = { ...r, at: new Date().toISOString() };
      await writeFile(postedPath, `${JSON.stringify(posted, null, 2)}\n`);
      say(`${head}: 올렸어요 ${'url' in r ? r.url : r.id}`);
    } catch (e) {
      const msg = (e as Error).message;
      // X answers 402 when the account has no API credits left. That is a billing wait, not a breakage,
      // so it should not turn the whole run red (and send a failure email) every evening.
      if (p.channel === 'x' && /\b402\b|credits-depleted|credits depleted/.test(msg)) {
        say(`${head}: X 크레딧이 없어서 건너뛰어요 (충전되면 다음 실행부터 올라가요)`);
        continue;
      }
      failed++;
      say(`${head}: 실패 — ${msg}`);
    }
  }
  return finish(failed ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
