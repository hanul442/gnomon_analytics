// Stock themes from Naver (G-99): the theme list and each theme's member stocks with the reason Naver
// gives for including it. The old finance.naver.com theme pages now redirect to a script-rendered site,
// so this reads the JSON the mobile site uses (m.stock.naver.com/api/stocks/theme). Parsing is defensive:
// a changed shape empties the result instead of breaking the build.

export interface Theme { no: string; name: string; members: { symbol: string; name: string; reason: string }[] }

const BASE = 'https://m.stock.naver.com/api/stocks/theme';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; CuriaAnalytics/1.0; +https://hanul442.github.io/gnomon_analytics/)', Accept: 'application/json' };
const text = (v: unknown) => (typeof v === 'string' ? v.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : typeof v === 'number' ? String(v) : '');

/** One page of the theme list: `{ groups: [{ no, name, ... }] }`. */
export function parseThemeList(json: unknown): { no: string; name: string }[] {
  const groups = json && typeof json === 'object' ? (json as { groups?: unknown }).groups : null;
  if (!Array.isArray(groups)) return [];
  return groups.flatMap((g: Record<string, unknown>) => {
    const no = text(g.no), name = text(g.name);
    return /^\d+$/.test(no) && name ? [{ no, name }] : [];
  });
}

/** One theme's members: `{ stocks: [{ itemCode, stockName }], themeItemInfoMap: { code: reason } }`. */
export function parseThemeMembers(json: unknown): Theme['members'] {
  const body = json && typeof json === 'object' ? json as { stocks?: unknown; themeItemInfoMap?: unknown } : null, stocks = body?.stocks;
  if (!Array.isArray(stocks)) return [];
  const reasons = body!.themeItemInfoMap && typeof body!.themeItemInfoMap === 'object' ? body!.themeItemInfoMap as Record<string, unknown> : {};
  const seen = new Set<string>();
  return stocks.flatMap((s: Record<string, unknown>) => {
    const symbol = text(s.itemCode), name = text(s.stockName);
    if (!/^[0-9A-Z]{6}$/.test(symbol) || !name || seen.has(symbol)) return [];
    seen.add(symbol);
    const reason = text(reasons[symbol] ?? s.themeReason ?? s.reason).slice(0, 160);
    return [{ symbol, name, reason }];
  });
}

async function get(url: string, f: typeof fetch): Promise<unknown> {
  const r = await f(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`NAVER_THEME_HTTP_${r.status}`);
  return r.json();
}

/** Every theme with its members. A few at a time, so it stays polite; a failed theme is skipped. */
export async function fetchThemes(options: { fetch?: typeof fetch; maxPages?: number; concurrency?: number } = {}): Promise<{ themes: Theme[]; failed: number }> {
  const f = options.fetch ?? fetch, list: { no: string; name: string }[] = [];
  for (let p = 1; p <= (options.maxPages ?? 10); p += 1) {
    // Past the last page Naver answers with an empty body, so a page that does not parse ends the list
    // (and so does reaching the total it reports); a failure on the first page is a real error.
    let body: unknown;
    try { body = await get(`${BASE}?page=${p}&pageSize=100`, f); } catch (e) { if (p === 1) throw e; break; }
    const got = parseThemeList(body).filter((t) => !list.some((x) => x.no === t.no));
    if (!got.length) break;
    list.push(...got);
    const total = Number((body as { totalCount?: unknown }).totalCount);
    if (Number.isFinite(total) && list.length >= total) break;
  }
  const themes: Theme[] = [];
  let failed = 0;
  const n = options.concurrency ?? 4;
  for (let i = 0; i < list.length; i += n) {
    await Promise.all(list.slice(i, i + n).map(async (t) => {
      try { const members = parseThemeMembers(await get(`${BASE}/${t.no}?page=1&pageSize=100`, f)); if (members.length) themes.push({ ...t, members }); }
      catch { failed += 1; }
    }));
  }
  return { themes: themes.sort((a, b) => Number(a.no) - Number(b.no)), failed };
}
