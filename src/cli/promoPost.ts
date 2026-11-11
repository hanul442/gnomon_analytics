// G-321: posts a promo day's cards (promo/<date>/, G-309) to X and Instagram, and hands the weekly
// Naver blog text over as a GitHub issue to copy (Naver Blog has no write API).
//   node dist/cli/promoPost.js                 the latest promo day; posts only when PROMO_POST=on
//   node dist/cli/promoPost.js --manual        a person pressed Run: posts when PROMO_POST is manual or on
//   --date=YYYY-MM-DD  --only=x,story,insta,reel,blog  --skip=…  --dry (never post)
//   --approved                                 한서 said "올려" on the day's review issue: post now (PROMO_POST manual or on)
//   --review                                   handle 한서's comment on a review issue (env REVIEW_COMMENT, REVIEW_BODY, REVIEW_ISSUE)
// Review (11/7, 한서: "올리기 전에 내 검수"; 11/11 한서: "허락 맞지 말고 그냥 올려 릴스빼고" → off by default): with PROMO_REVIEW=on, a run that would post by itself instead opens a
// `promo-review` issue with the day's cards, captions and reel, and posts only after 한서 comments "올려" there.
// The weekly blog text is only an issue to copy, so it goes out without review.
// Env: PROMO_POST (off|manual|on, default off), PROMO_X_LINK (on keeps the site link in X posts), X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET,
//      IG_ACCESS_TOKEN, IG_USER_ID (optional, default me), GITHUB_TOKEN + GITHUB_REPOSITORY (blog and review issues), PROMO_REVIEW (on = review first), PROMO_REELS (on = reels Tue/Fri; off by default since 11/11).
//      An Instagram-login token (IGAA…) goes to graph.instagram.com; a Facebook-login token (EAA…) to graph.facebook.com,
//      which needs the account ID (IG_USER_ID, else GNOMON's own account).
// What went out is kept in promo/<date>/posted.json so a day is never posted twice.

import { appendFile, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROMO_SITE } from '../report/promoCards.js';
import { checkText, modeOf, xWithoutLink, oauth1Header, parseApproval, planDay, planReel, type Channel, type OAuth1Keys, type PlannedPost, type ReelItem } from '../report/promoPost.js';

type Posted = Partial<Record<Channel, { id: string; at: string; url?: string }>>;
const LABEL: Record<Channel, string> = { x: 'X', story: '인스타 스토리', insta: '인스타 게시물', reel: '인스타 릴스', blog: '네이버 블로그 글(이슈)' };
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

async function igReady(id: string, token: string, tries = 20): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const r = await igCall(id, { fields: 'status_code,status' }, token, 'GET');
    if (r.status_code === 'FINISHED') return;
    if (r.status_code === 'ERROR' || r.status_code === 'EXPIRED') throw new Error(`인스타 준비 실패: ${String(r.status)}`);
    await new Promise((ok) => setTimeout(ok, 3000));
  }
  throw new Error(`인스타 준비가 ${tries * 3}초 안에 끝나지 않았어요`);
}

const mediaUrl = (p: PlannedPost, date: string) => p.images.map((f) => (p.channel === 'reel' ? `${PROMO_SITE}promo/reels/${f}` : `${PROMO_SITE}promo/${date}/${f}`));

async function postInsta(p: PlannedPost, date: string, token: string, user: string): Promise<{ id: string }> {
  const urls = mediaUrl(p, date);
  // Instagram fetches the images from the site, so they must be live first.
  for (const u of urls) { const r = await fetch(u, { method: 'HEAD' }); if (!r.ok) throw new Error(`사이트에 이미지가 아직 없어요 (${r.status}): ${u}`); }
  let creation: string;
  if (p.channel === 'reel') {
    creation = String((await igCall(`${user}/media`, { media_type: 'REELS', video_url: urls[0]!, caption: p.text, share_to_feed: 'true' }, token)).id);
    // Instagram processes a video for a while before it can be published.
    await igReady(creation, token, 100);
  } else if (p.channel === 'story') {
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

function gh(token: string, repo: string) {
  const api = `https://api.github.com/repos/${repo}`;
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' };
  return (path: string, method = 'GET', body?: unknown) => fetch(`${api}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

const REVIEW_LABEL = 'promo-review';
const reviewMark = (date: string) => `<!-- promo-review:${date} -->`;

/** The issue 한서 checks on the phone before anything goes out. */
export function reviewBody(date: string, items: readonly PlannedPost[]): string {
  const block = (p: PlannedPost) => {
    const urls = mediaUrl(p, date);
    const media = p.channel === 'reel' ? `▶ [영상 보기](${urls[0]})` : urls.map((u, i) => `<img src="${u}" width="${p.channel === 'story' ? 160 : 220}" alt="${i + 1}">`).join(' ');
    return `### ${LABEL[p.channel]}\n\n${media}${p.text ? `\n\n\`\`\`\n${p.text}\n\`\`\`` : ''}`;
  };
  return [reviewMark(date), `${date} 그노몬 SNS에 올릴 것들이에요. 확인하고 댓글로 답해 주세요.`, '',
    '- `올려` → 전부 올려요', '- `스토리만 올려`, `릴스 빼고 올려`처럼 골라도 돼요 (스토리·캐러셀·릴스·X)', '- `취소` → 오늘은 안 올려요', '- 글을 고치고 싶으면 Claude에게 말해 주세요', '',
    items.map(block).join('\n\n')].join('\n');
}

async function openReviewIssue(date: string, items: readonly PlannedPost[], token: string, repo: string): Promise<{ id: string; url: string }> {
  const call = gh(token, repo);
  await call('/labels', 'POST', { name: REVIEW_LABEL, color: '111111', description: 'SNS에 올리기 전 한서 검수' });
  const r = await json(await call('/issues', 'POST', { title: `SNS 검수 ${date} · 댓글로 '올려'`, body: reviewBody(date, items), labels: [REVIEW_LABEL], assignees: [repo.split('/')[0]] }), '검수 이슈');
  return { id: String(r.number), url: String(r.html_url) };
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
  const lines: string[] = [];
  const say = (s: string) => { console.log(s); lines.push(s); };
  const finish = async (code = 0) => { if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`); process.exitCode = code; };

  // 한서 answered on a review issue.
  let reviewIssue: string | undefined;
  let only = arg('only')?.split(',') as Channel[] | undefined;
  let skip = (arg('skip')?.split(',') ?? []) as Channel[];
  let approved = args.includes('--approved');
  let date = arg('date');
  if (args.includes('--review')) {
    reviewIssue = env.REVIEW_ISSUE;
    date = /promo-review:(\d{4}-\d{2}-\d{2})/.exec(env.REVIEW_BODY ?? '')?.[1];
    const a = parseApproval(env.REVIEW_COMMENT ?? '');
    const call = env.GITHUB_TOKEN && env.GITHUB_REPOSITORY && reviewIssue ? gh(env.GITHUB_TOKEN, env.GITHUB_REPOSITORY) : null;
    if (!date) { say('- 검수 이슈에서 날짜를 찾지 못했어요.'); return finish(1); }
    if (!a.go) {
      if (a.cancel && call) { await call(`/issues/${reviewIssue}/comments`, 'POST', { body: '알겠어요. 이날 것은 올리지 않아요.' }); await call(`/issues/${reviewIssue}`, 'PATCH', { state: 'closed', state_reason: 'not_planned' }); }
      say(a.cancel ? `- ${date}: 취소해서 올리지 않아요.` : '- 올려/취소 답이 아니라서 그냥 둬요.');
      return finish();
    }
    approved = true; only = a.only ?? undefined; skip = a.skip;
  }

  const manual = args.includes('--manual') || approved;
  const send = !args.includes('--dry') && (mode === 'on' || (mode === 'manual' && manual));
  const review = env.PROMO_REVIEW === 'on';
  const days = (await readdir(join(root, 'promo')).catch(() => [] as string[])).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  date ??= days.at(-1);

  say(`### SNS 자동 게시 · ${date ?? '카드 없음'} · 모드 ${mode}${approved ? ' · 한서 승인' : ''}${send ? '' : ' (이번엔 올리지 않고 미리보기만)'}`);
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
  const reelsDir = join(root, 'promo', 'reels'), reelsDonePath = join(reelsDir, 'posted.json');
  const reelsDone = JSON.parse((await readText(reelsDonePath)) ?? '{}') as Record<string, { id: string; at: string; date: string }>;
  const reelQueue = JSON.parse((await readText(join(reelsDir, 'reels.json'))) ?? '[]') as ReelItem[];
  const postedPath = join(dir, 'posted.json');
  const posted = JSON.parse((await readText(postedPath)) ?? '{}') as Posted;
  // A day keeps the reel it was given, even after that reel has been marked done.
  const reel = posted.reel || env.PROMO_REELS !== 'on' ? null : planReel(date, reelQueue, reelsDone);
  if (reel) plan.splice(plan.findIndex((p) => p.channel === 'blog') >>> 0, 0, reel);
  const xKeys = env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_SECRET
    ? { consumerKey: env.X_API_KEY, consumerSecret: env.X_API_SECRET, token: env.X_ACCESS_TOKEN, tokenSecret: env.X_ACCESS_SECRET } : null;
  // Pasted secrets sometimes carry a stray space or line break.
  const igToken = (env.IG_ACCESS_TOKEN ?? '').trim();
  const hold = send && review && !approved;
  const held: PlannedPost[] = [];
  let failed = 0;
  if (!plan.length) say('- 주말이거나 이날 만든 카드가 없어서 올릴 게 없어요.');
  for (const p of plan) {
    if (p.channel === 'x' && env.PROMO_X_LINK !== 'on') p.text = xWithoutLink(p.text);
    if ((only && !only.includes(p.channel)) || skip.includes(p.channel)) continue;
    const head = `- **${LABEL[p.channel]}** (${p.images.join(', ') || '그림 없음'})`;
    if (posted[p.channel]) { say(`${head}: 이미 올렸어요 ${posted[p.channel]!.url ?? posted[p.channel]!.id}`); continue; }
    const problems = checkText(p.text, p.channel);
    if (problems.length) { say(`${head}: 올리지 않아요. 걸린 것: ${problems.join(', ')}`); failed++; continue; }
    const missing = p.channel === 'x' ? !xKeys : p.channel === 'blog' ? !(env.GITHUB_TOKEN && env.GITHUB_REPOSITORY) : !igToken;
    // The blog only becomes an issue to copy from, so it goes out once posting is switched on at all, without review.
    const go = send || (p.channel === 'blog' && mode !== 'off' && !args.includes('--dry'));
    if (go && !missing && hold && p.channel !== 'blog') { held.push(p); say(`${head}: 한서 검수 기다림`); continue; }
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
      if (p.channel === 'reel') { reelsDone[p.images[0]!] = { id: r.id, at: new Date().toISOString(), date }; await writeFile(reelsDonePath, `${JSON.stringify(reelsDone, null, 2)}\n`); }
      say(`${head}: 올렸어요 ${'url' in r ? r.url : r.id}`);
    } catch (e) {
      failed++;
      say(`${head}: 실패 — ${(e as Error).message}`);
    }
  }

  // Held posts wait in one review issue per day (the 08:10 rerun finds review.json and does not open another).
  if (held.length) {
    const reviewPath = join(dir, 'review.json');
    const open = JSON.parse((await readText(reviewPath)) ?? 'null') as { id: string; url: string } | null;
    if (open) say(`- 검수 이슈가 이미 있어요: ${open.url}`);
    else if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) say('- 검수 이슈를 열 토큰이 없어요.');
    else {
      try {
        const r = await openReviewIssue(date, held, env.GITHUB_TOKEN, env.GITHUB_REPOSITORY);
        await writeFile(reviewPath, `${JSON.stringify({ ...r, at: new Date().toISOString() }, null, 2)}\n`);
        say(`- 검수 이슈를 열었어요: ${r.url}`);
      } catch (e) { failed++; say(`- 검수 이슈 실패 — ${(e as Error).message}`); }
    }
  }

  // Tell 한서 on the review issue what went out, and close it.
  if (reviewIssue && env.GITHUB_TOKEN && env.GITHUB_REPOSITORY) {
    const call = gh(env.GITHUB_TOKEN, env.GITHUB_REPOSITORY);
    await call(`/issues/${reviewIssue}/comments`, 'POST', { body: lines.slice(1).filter((l) => l.startsWith('- ')).join('\n') || '올릴 게 없었어요.' });
    if (!failed) await call(`/issues/${reviewIssue}`, 'PATCH', { state: 'closed', state_reason: 'completed' });
  }
  return finish(failed ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
