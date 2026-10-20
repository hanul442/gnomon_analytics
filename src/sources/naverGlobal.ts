// G-268: the world at a glance, from Naver's public stock pages (no key), the same provider as Korean prices.
//   index quote   https://api.stock.naver.com/index/<reuters>/basic             (.INX, .N225, .FTSE …)
//   index bars    https://api.stock.naver.com/chart/foreign/index/<reuters>/day  (domestic/index/KOSPI for Korea)
//   Korean quote  https://m.stock.naver.com/api/index/majors
//   market index  https://m.stock.naver.com/front-api/marketIndex/majors        (FX, bonds, central banks, energy, metals, shipping in one call)
//   its history   https://m.stock.naver.com/front-api/marketIndex/prices?category=&reutersCode=&page=1&pageSize=30
// Every call is best effort: a failure leaves that row out and is listed in `status`.

export const NAVER_GLOBAL_SOURCE = 'naver:global';

/** Countries the world map can colour (ISO 3166 alpha-2). */
export type WorldIso = 'KR' | 'US' | 'JP' | 'CN' | 'HK' | 'TW' | 'IN' | 'VN' | 'GB' | 'DE' | 'FR' | 'EU' | 'BR';
export type WorldRegion = '한국' | '미국' | '아시아' | '유럽' | '남미';

export interface WorldIndexDef { code: string; name: string; country: string; iso: WorldIso; region: WorldRegion; domestic?: boolean }
/** The indices on the page, in reading order. The first of each country colours the map. */
export const WORLD_INDICES: readonly WorldIndexDef[] = [
  { code: 'KOSPI', name: '코스피', country: '한국', iso: 'KR', region: '한국', domestic: true },
  { code: 'KOSDAQ', name: '코스닥', country: '한국', iso: 'KR', region: '한국', domestic: true },
  { code: '.INX', name: 'S&P 500', country: '미국', iso: 'US', region: '미국' },
  { code: '.IXIC', name: '나스닥 종합', country: '미국', iso: 'US', region: '미국' },
  { code: '.DJI', name: '다우존스', country: '미국', iso: 'US', region: '미국' },
  { code: '.SOX', name: '필라델피아 반도체', country: '미국', iso: 'US', region: '미국' },
  { code: '.N225', name: '니케이 225', country: '일본', iso: 'JP', region: '아시아' },
  { code: '.SSEC', name: '상해종합', country: '중국', iso: 'CN', region: '아시아' },
  { code: '.HSI', name: '항셍', country: '홍콩', iso: 'HK', region: '아시아' },
  { code: '.TWII', name: '가권', country: '대만', iso: 'TW', region: '아시아' },
  { code: '.BSESN', name: 'SENSEX', country: '인도', iso: 'IN', region: '아시아' },
  { code: '.VNI', name: 'VN 지수', country: '베트남', iso: 'VN', region: '아시아' },
  { code: '.FTSE', name: 'FTSE 100', country: '영국', iso: 'GB', region: '유럽' },
  { code: '.GDAXI', name: 'DAX', country: '독일', iso: 'DE', region: '유럽' },
  { code: '.FCHI', name: 'CAC 40', country: '프랑스', iso: 'FR', region: '유럽' },
  { code: '.STOXX50E', name: '유로스톡스 50', country: '유로존', iso: 'EU', region: '유럽' },
  { code: '.BVSP', name: '보베스파', country: '브라질', iso: 'BR', region: '남미' },
];

export type MacroGroup = 'fx' | 'bond' | 'policy' | 'energy' | 'metals' | 'ship' | 'fear';
export interface MacroDef { key: string; code: string; category: string; name: string; group: MacroGroup; unit: string; hint?: string; history?: boolean }
/** Rows taken from the market-index answer, by Reuters code. `history` rows also get 30 closes for a line. */
export const WORLD_MACRO: readonly MacroDef[] = [
  { key: 'USDKRW', code: 'FX_USDKRW', category: 'exchange', name: '원/달러', group: 'fx', unit: '원', hint: '1달러에 원', history: true },
  { key: 'JPYKRW', code: 'FX_JPYKRW', category: 'exchange', name: '원/엔 (100엔)', group: 'fx', unit: '원' },
  { key: 'EURKRW', code: 'FX_EURKRW', category: 'exchange', name: '원/유로', group: 'fx', unit: '원' },
  { key: 'CNYKRW', code: 'FX_CNYKRW', category: 'exchange', name: '원/위안', group: 'fx', unit: '원' },
  { key: 'USDJPY', code: 'USDJPY', category: 'exchangeWorld', name: '달러/엔', group: 'fx', unit: '엔' },
  { key: 'EURUSD', code: 'EURUSD', category: 'exchangeWorld', name: '유로/달러', group: 'fx', unit: '달러' },
  { key: 'DXY', code: '.DXY', category: 'exchange', name: '달러인덱스', group: 'fx', unit: '', hint: '주요 6개 통화 대비 달러 힘', history: true },
  { key: 'US10Y', code: 'US10YT=RR', category: 'bond', name: '미국', group: 'bond', unit: '%', history: true },
  { key: 'KR10Y', code: 'KR10YT=RR', category: 'bond', name: '한국', group: 'bond', unit: '%' },
  { key: 'DE10Y', code: 'DE10YT=RR', category: 'bond', name: '독일', group: 'bond', unit: '%' },
  { key: 'JP10Y', code: 'JP10YT=RR', category: 'bond', name: '일본', group: 'bond', unit: '%' },
  { key: 'CN10Y', code: 'CN10YT=RR', category: 'bond', name: '중국', group: 'bond', unit: '%' },
  { key: 'FED', code: 'USFOMC=ECIX', category: 'standardInterest', name: '미국 연준', group: 'policy', unit: '%' },
  { key: 'BOE', code: 'GBBOEI=ECIX', category: 'standardInterest', name: '영국은행', group: 'policy', unit: '%' },
  { key: 'BOK', code: 'KROCRT=ECIX', category: 'standardInterest', name: '한국은행', group: 'policy', unit: '%' },
  { key: 'ECB', code: 'EUECBR=ECIX', category: 'standardInterest', name: '유럽중앙은행', group: 'policy', unit: '%' },
  { key: 'BOJ', code: 'JPINTN=ECIX', category: 'standardInterest', name: '일본은행', group: 'policy', unit: '%' },
  { key: 'WTI', code: 'CLcv1', category: 'energy', name: 'WTI 유가', group: 'energy', unit: '$', history: true },
  { key: 'BRENT', code: 'LCOcv1', category: 'energy', name: '브렌트유', group: 'energy', unit: '$' },
  { key: 'NG', code: 'NGcv1', category: 'energy', name: '천연가스', group: 'energy', unit: '$' },
  { key: 'GOLD', code: 'GCcv1', category: 'metals', name: '국제 금', group: 'metals', unit: '$', history: true },
  { key: 'SILVER', code: 'SIcv1', category: 'metals', name: '은', group: 'metals', unit: '$' },
  { key: 'COPPER', code: 'HGcv1', category: 'metals', name: '구리', group: 'metals', unit: '$' },
  { key: 'SCFI', code: '.SCFIDXSSE', category: 'transport', name: '상하이 컨테이너 운임', group: 'ship', unit: '', hint: 'SCFI' },
  { key: 'BDI', code: '.BADI', category: 'transport', name: '건화물선 운임', group: 'ship', unit: '', hint: 'BDI' },
  { key: 'BDTI', code: '.BAID', category: 'transport', name: '원유 유조선 운임', group: 'ship', unit: '', hint: 'BDTI' },
];

export interface WorldQuote {
  key: string;
  name: string;
  value: number;
  /** Today's change in the asset's own unit, and in percent (null for a central bank rate). */
  change: number | null;
  changePct: number | null;
  /** Local time of the last trade, ISO with offset, as Naver gives it. */
  at: string | null;
  open: boolean;
  /** Up to 30 closes, oldest first: [YYYY-MM-DD, close]. */
  series: [string, number][];
}
export interface WorldIndexQuote extends WorldQuote { country: string; iso: WorldIso; region: WorldRegion }
export interface WorldMacroQuote extends WorldQuote { group: MacroGroup; unit: string; hint?: string }
export interface WorldMarkets { generatedAt: string; indices: WorldIndexQuote[]; macro: WorldMacroQuote[]; status: { source: string; ok: boolean; error?: string }[] }

const num = (v: unknown): number | null => { if (v == null || v === '' || v === '-') return null; const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
const isoDay = (s: string) => (/^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s.slice(0, 10));

/** Daily index bars ([{localDate, closePrice}]) → the last 30 [date, close], oldest first. */
export function parseIndexBars(body: unknown): [string, number][] {
  if (!Array.isArray(body)) throw new Error('NAVER_GLOBAL_BARS_UNEXPECTED');
  const out = new Map<string, number>();
  for (const r of body as Record<string, unknown>[]) { const d = isoDay(String(r.localDate ?? '')), c = num(r.closePrice); if (/^\d{4}-\d{2}-\d{2}$/.test(d) && c != null && c > 0) out.set(d, c); }
  return [...out].sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
}

/** /index/<code>/basic → value, change and whether the market is open. */
export function parseIndexBasic(body: unknown): Pick<WorldQuote, 'value' | 'change' | 'changePct' | 'at' | 'open'> | null {
  const d = body as Record<string, unknown> | null;
  const value = num(d?.closePrice);
  if (!d || value == null) return null;
  return { value, change: num(d.compareToPreviousClosePrice), changePct: num(d.fluctuationsRatio), at: typeof d.localTradedAt === 'string' ? d.localTradedAt : null, open: d.marketStatus === 'OPEN' };
}

/** The market-index answer → its rows by Reuters code. */
export function parseMarketIndexMajors(body: unknown): Map<string, Record<string, unknown>> {
  const result = (body as { result?: Record<string, unknown> } | null)?.result;
  if (!result || typeof result !== 'object') throw new Error('NAVER_MARKET_INDEX_UNEXPECTED');
  const out = new Map<string, Record<string, unknown>>();
  for (const rows of Object.values(result)) if (Array.isArray(rows)) for (const r of rows as Record<string, unknown>[]) if (typeof r.reutersCode === 'string' && !out.has(r.reutersCode)) out.set(r.reutersCode, r);
  return out;
}

/** A market-index history page (newest first) → [date, close] oldest first. */
export function parseMarketIndexPrices(body: unknown): [string, number][] {
  const rows = (body as { result?: unknown } | null)?.result;
  if (!Array.isArray(rows)) throw new Error('NAVER_MARKET_INDEX_PRICES_UNEXPECTED');
  const out = new Map<string, number>();
  for (const r of rows as Record<string, unknown>[]) { const d = String(r.localTradedAt ?? '').slice(0, 10), c = num(r.closePrice); if (/^\d{4}-\d{2}-\d{2}$/.test(d) && c != null) out.set(d, c); }
  return [...out].sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
}

type Fetch = typeof fetch;
async function getJson(url: string, f: Fetch): Promise<unknown> {
  const r = await f(url, { signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'Mozilla/5.0 (gnomon-analytics)' } });
  if (!r.ok) throw new Error(`NAVER_GLOBAL_HTTP_${r.status}`);
  return r.json();
}
const stamp = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '') + '0000';
/** Today's live value as the line's last point, so the line ends where the big number is. */
const withLive = (series: [string, number][], value: number, at: string | null): [string, number][] => {
  const day = at?.slice(0, 10);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return series;
  return [...series.filter((p) => p[0] < day), [day, value] as [string, number]].slice(-30);
};

export async function fetchWorldMarkets(options: { fetch?: Fetch; now?: () => Date } = {}): Promise<WorldMarkets> {
  const f = options.fetch ?? fetch, now = (options.now ?? (() => new Date()))();
  const status: WorldMarkets['status'] = [];
  const from = stamp(new Date(now.getTime() - 60 * 86_400_000)), to = stamp(new Date(now.getTime() + 86_400_000));
  let korea = new Map<string, Record<string, unknown>>();
  try {
    const list = await getJson('https://m.stock.naver.com/api/index/majors', f);
    if (Array.isArray(list)) korea = new Map((list as Record<string, unknown>[]).map((r) => [String(r.itemCode ?? ''), r]));
    status.push({ source: 'naver:index:majors', ok: true });
  } catch (e) { status.push({ source: 'naver:index:majors', ok: false, error: e instanceof Error ? e.message.slice(0, 80) : 'UNKNOWN' }); }
  const indices: WorldIndexQuote[] = [];
  for (const def of WORLD_INDICES) {
    try {
      const bars = parseIndexBars(await getJson(`https://api.stock.naver.com/chart/${def.domestic ? 'domestic' : 'foreign'}/index/${encodeURIComponent(def.code)}/day?startDateTime=${from}&endDateTime=${to}`, f));
      const q = def.domestic ? parseIndexBasic({ ...korea.get(def.code), marketStatus: korea.get(def.code)?.marketStatus }) : parseIndexBasic(await getJson(`https://api.stock.naver.com/index/${encodeURIComponent(def.code)}/basic`, f));
      const last = bars.at(-1), prev = bars.at(-2);
      // Without a quote the last bar stands in (a closed market's last close against the one before).
      const value = q?.value ?? last?.[1];
      if (value == null) throw new Error('NO_VALUE');
      const changePct = q?.changePct ?? (last && prev ? (last[1] / prev[1] - 1) * 100 : null);
      const at = q?.at ?? (last ? `${last[0]}T00:00:00` : null);
      indices.push({ key: def.code, name: def.name, country: def.country, iso: def.iso, region: def.region, value, change: q?.change ?? null, changePct, at, open: q?.open ?? false, series: withLive(bars, value, at) });
    } catch (e) { status.push({ source: `naver:index:${def.code}`, ok: false, error: e instanceof Error ? e.message.slice(0, 80) : 'UNKNOWN' }); }
  }
  const macro: WorldMacroQuote[] = [];
  try {
    const rows = parseMarketIndexMajors(await getJson('https://m.stock.naver.com/front-api/marketIndex/majors', f));
    status.push({ source: 'naver:marketIndex:majors', ok: true });
    for (const def of WORLD_MACRO) {
      const r = rows.get(def.code), value = num(r?.closePrice);
      if (!r || value == null) continue;
      const at = typeof r.localTradedAt === 'string' ? r.localTradedAt : null;
      let series: [string, number][] = [];
      if (def.history) {
        try { series = withLive(parseMarketIndexPrices(await getJson(`https://m.stock.naver.com/front-api/marketIndex/prices?category=${def.category}&reutersCode=${encodeURIComponent(def.code)}&page=1&pageSize=30`, f)), value, at); }
        catch (e) { status.push({ source: `naver:marketIndex:${def.code}`, ok: false, error: e instanceof Error ? e.message.slice(0, 80) : 'UNKNOWN' }); }
      }
      macro.push({ key: def.key, name: def.name, group: def.group, unit: def.unit, ...(def.hint ? { hint: def.hint } : {}), value, change: num(r.fluctuations), changePct: def.group === 'policy' ? null : num(r.fluctuationsRatio), at, open: r.marketStatus === 'OPEN', series });
    }
  } catch (e) { status.push({ source: 'naver:marketIndex:majors', ok: false, error: e instanceof Error ? e.message.slice(0, 80) : 'UNKNOWN' }); }
  // VIX lives with the indices at Naver but reads as a fear gauge, so it joins the macro rows.
  try {
    const bars = parseIndexBars(await getJson(`https://api.stock.naver.com/chart/foreign/index/.VIX/day?startDateTime=${from}&endDateTime=${to}`, f));
    const vq = parseIndexBasic(await getJson('https://api.stock.naver.com/index/.VIX/basic', f));
    const value = vq?.value ?? bars.at(-1)?.[1];
    if (value != null) macro.push({ key: 'VIX', name: 'VIX', group: 'fear', unit: '', hint: '미국 증시 공포 지수', value, change: vq?.change ?? null, changePct: vq?.changePct ?? null, at: vq?.at ?? null, open: vq?.open ?? false, series: withLive(bars, value, vq?.at ?? null) });
  } catch (e) { status.push({ source: 'naver:index:.VIX', ok: false, error: e instanceof Error ? e.message.slice(0, 80) : 'UNKNOWN' }); }
  return { generatedAt: now.toISOString(), indices, macro, status };
}
