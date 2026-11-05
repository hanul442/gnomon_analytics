// GitHub starts the daily.yml schedule 4–8 hours late almost every day (18:30 KST cron, first run 22:00–02:00 KST).
// Cloudflare cron triggers fire on time, so the Worker asks GitHub to start "Daily report" at 18:30 KST itself.
// The GitHub schedules stay in daily.yml as a backup; a later run only refreshes the settled day.

export interface DispatchEnv {
  /** Fine-grained GitHub token, this repository only, permission "Actions: Read and write" (GitHub secret GNM_DISPATCH_TOKEN). */
  GH_DISPATCH_TOKEN?: string;
}

export const DAILY_REPO = 'hanul442/gnomon_analytics';
export const DAILY_WORKFLOW = 'daily.yml';

export async function dispatchDaily(env: DispatchEnv, fetcher: typeof fetch): Promise<{ ok: boolean; status: number | null; reason?: string }> {
  if (!env.GH_DISPATCH_TOKEN) return { ok: false, status: null, reason: 'no GH_DISPATCH_TOKEN' };
  const r = await fetcher(`https://api.github.com/repos/${DAILY_REPO}/actions/workflows/${DAILY_WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'gnm-api',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main' }),
    signal: AbortSignal.timeout(20_000),
  });
  // 204 No Content (or 200 with the new run's id) means the run is queued.
  return r.ok ? { ok: true, status: r.status } : { ok: false, status: r.status, reason: (await r.text()).slice(0, 200) };
}
