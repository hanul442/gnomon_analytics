// Ownership reports from OpenDART (G-99): 임원·주요주주 소유보고 (elestock.json) and 5% 대량보유
// (majorstock.json). Numbers come as strings with commas; a missing value stays null.

import type { HolderReport, InsiderReport } from '../analysis/edge.js';

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number | null => {
  const t = text(v).replace(/,/g, '');
  if (!t || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const isoDate = (v: unknown) => { const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(text(v)); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };

function rows(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== 'object') throw new Error('DART_UNEXPECTED_RESPONSE');
  const r = body as Record<string, unknown>, status = text(r.status);
  if (status === '013') return [];
  if (status !== '000') throw new Error(`DART_STATUS_${status || 'MISSING'}:${text(r.message).slice(0, 80)}`);
  return Array.isArray(r.list) ? r.list as Record<string, unknown>[] : [];
}

export function parseInsider(body: unknown, symbol: string, retrievedAt: Date, since: string): InsiderReport[] {
  return rows(body).flatMap((x) => {
    const date = isoDate(x.rcept_dt), receiptNo = text(x.rcept_no);
    if (!date || date < since || !/^\d{14}$/.test(receiptNo)) return [];
    return [{
      symbol, receiptNo, date, reporter: text(x.repror), position: text(x.isu_exctv_ofcps) || text(x.isu_main_shrholdr),
      isExec: /등기|비등기/.test(text(x.isu_exctv_rgist_at)), isMajor: !!text(x.isu_main_shrholdr) && text(x.isu_main_shrholdr) !== '-',
      shares: num(x.sp_stock_lmp_cnt), delta: num(x.sp_stock_lmp_irds_cnt), ratio: num(x.sp_stock_lmp_rate), retrievedAt: retrievedAt.toISOString(),
    }];
  });
}

export function parseHolders(body: unknown, symbol: string, retrievedAt: Date, since: string): HolderReport[] {
  return rows(body).flatMap((x) => {
    const date = isoDate(x.rcept_dt), receiptNo = text(x.rcept_no);
    if (!date || date < since || !/^\d{14}$/.test(receiptNo)) return [];
    return [{ symbol, receiptNo, date, reporter: text(x.repror), shares: num(x.stkqy), delta: num(x.stkqy_irds), ratio: num(x.stkrt), ratioDelta: num(x.stkrt_irds), reason: text(x.report_resn).slice(0, 80), retrievedAt: retrievedAt.toISOString() }];
  });
}

/** Both reports for one company; each one failing alone leaves the other. Never echoes the URL (it carries the key). */
export async function fetchOwnership(options: { apiKey: string; corpCode: string; symbol: string; since: string; fetch?: typeof fetch; now?: () => Date }): Promise<{ insider: InsiderReport[]; holders: HolderReport[]; errors: string[] }> {
  const f = options.fetch ?? fetch, now = (options.now ?? (() => new Date()))(), errors: string[] = [];
  const get = async (path: string) => {
    const url = new URL(`https://opendart.fss.or.kr/api/${path}`);
    url.searchParams.set('crtfc_key', options.apiKey);
    url.searchParams.set('corp_code', options.corpCode);
    const r = await f(url, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`DART_HTTP_${r.status}`);
    return r.json();
  };
  let insider: InsiderReport[] = [], holders: HolderReport[] = [];
  try { insider = parseInsider(await get('elestock.json'), options.symbol, now, options.since); } catch (e) { errors.push(`elestock:${e instanceof Error ? e.message.slice(0, 60) : 'unknown'}`); }
  try { holders = parseHolders(await get('majorstock.json'), options.symbol, now, options.since); } catch (e) { errors.push(`majorstock:${e instanceof Error ? e.message.slice(0, 60) : 'unknown'}`); }
  return { insider, holders, errors };
}
