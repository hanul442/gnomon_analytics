// Stock themes from Naver Finance (G-99): the theme list and each theme's member stocks with the
// reason Naver gives for including it. The pages are EUC-KR HTML; parsing is by link pattern so a
// layout change empties the result instead of breaking the build.

export interface Theme { no: string; name: string; members: { symbol: string; name: string; reason: string }[] }

const BASE = 'https://finance.naver.com';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; GnomonAnalytics/1.0; +https://hanul442.github.io/gnomon_analytics/)' };
const clean = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export function parseThemeList(html: string): { no: string; name: string }[] {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/sise_group_detail\.naver\?type=theme&(?:amp;)?no=(\d+)"[^>]*>([^<]+)<\/a>/g)) if (!out.has(m[1]!)) out.set(m[1]!, clean(m[2]!));
  return [...out].map(([no, name]) => ({ no, name }));
}

export function parseThemeMembers(html: string): Theme['members'] {
  const out: Theme['members'] = [], seen = new Set<string>();
  // Each member row: the stock link, then (in the same row) an info layer with the inclusion reason.
  const rows = html.split(/<tr[\s>]/).slice(1);
  for (const row of rows) {
    const m = /\/item\/main\.naver\?code=([0-9A-Z]{6})"[^>]*>([^<]+)<\/a>/.exec(row);
    if (!m || seen.has(m[1]!)) continue;
    seen.add(m[1]!);
    const reason = /class="info_txt"[^>]*>([\s\S]*?)<\/p>/.exec(row);
    out.push({ symbol: m[1]!, name: clean(m[2]!), reason: reason ? clean(reason[1]!).slice(0, 160) : '' });
  }
  return out;
}

async function page(path: string, f: typeof fetch): Promise<string> {
  const r = await f(`${BASE}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`NAVER_THEME_HTTP_${r.status}`);
  return new TextDecoder('euc-kr').decode(await r.arrayBuffer());
}

/** Every theme with its members. A few at a time, so it stays polite; a failed theme is skipped. */
export async function fetchThemes(options: { fetch?: typeof fetch; maxPages?: number; concurrency?: number } = {}): Promise<{ themes: Theme[]; failed: number }> {
  const f = options.fetch ?? fetch, list: { no: string; name: string }[] = [];
  for (let p = 1; p <= (options.maxPages ?? 12); p += 1) {
    const got = parseThemeList(await page(`/sise/theme.naver?&page=${p}`, f)).filter((t) => !list.some((x) => x.no === t.no));
    if (!got.length) break;
    list.push(...got);
  }
  const themes: Theme[] = [];
  let failed = 0;
  const n = options.concurrency ?? 4;
  for (let i = 0; i < list.length; i += n) {
    await Promise.all(list.slice(i, i + n).map(async (t) => {
      try { const members = parseThemeMembers(await page(`/sise/sise_group_detail.naver?type=theme&no=${t.no}`, f)); if (members.length) themes.push({ ...t, members }); }
      catch { failed += 1; }
    }));
  }
  return { themes: themes.sort((a, b) => Number(a.no) - Number(b.no)), failed };
}
