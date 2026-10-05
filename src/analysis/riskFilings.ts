// Filing risk flags (docs/DESIGN.md §5.14, G-49): a rule-based check over every listed company's
// filings of the last 30 days, so a buy-side screener signal carries a warning when a dilutive or
// troubling filing came out. No AI; titles are matched against a fixed list. Pure.

export type RiskLevel = 1 | 2 | 3;
export interface RiskRule { key: string; label: string; level: RiskLevel; pattern: RegExp }

/** 3: trading or listing at stake; 2: dilution or governance trouble; 1: worth a look. */
export const RISK_RULES: readonly RiskRule[] = [
  { key: 'halt', label: '거래정지', level: 3, pattern: /매매거래정지|거래정지/ },
  { key: 'admin', label: '관리종목', level: 3, pattern: /관리종목지정/ },
  { key: 'delist', label: '상장적격성', level: 3, pattern: /상장적격성|상장폐지/ },
  { key: 'audit', label: '감사의견', level: 3, pattern: /감사의견\s*(거절|한정|부적정)|의견거절/ },
  { key: 'embezzle', label: '횡령·배임', level: 3, pattern: /횡령|배임/ },
  { key: 'rehab', label: '회생·파산', level: 3, pattern: /회생절차|파산/ },
  { key: 'unfaithful', label: '불성실공시', level: 3, pattern: /불성실공시법인/ },
  { key: 'warning', label: '투자경고·위험', level: 2, pattern: /투자(경고|위험)종목/ },
  { key: 'cb', label: '전환사채', level: 2, pattern: /전환사채권?발행결정/ },
  { key: 'bw', label: '신주인수권부사채', level: 2, pattern: /신주인수권부사채권?발행결정/ },
  { key: 'rights', label: '유상증자', level: 2, pattern: /유상증자결정/ },
  { key: 'reduction', label: '감자', level: 2, pattern: /감자결정/ },
  { key: 'owner', label: '최대주주 변경', level: 2, pattern: /최대주주(의)?\s*변경/ },
  { key: 'eb', label: '교환사채', level: 1, pattern: /교환사채권?발행결정/ },
  { key: 'suit', label: '소송', level: 1, pattern: /소송등의제기|소송\s*등의\s*제기/ },
  { key: 'caution', label: '투자주의', level: 1, pattern: /투자주의종목/ },
];

/** A filing that matched a rule, kept in data/risk-filings/. */
export interface RiskFiling { symbol: string; date: string; title: string; receiptNo: string; key: string }

export function riskOf(title: string): RiskRule | null {
  // Corrections and cancellations still count; withdrawals of a warning do not.
  if (/해제|철회|취소/.test(title) && !/결정/.test(title)) return null;
  return RISK_RULES.find((r) => r.pattern.test(title)) ?? null;
}

export interface RiskFlag { level: RiskLevel; labels: string[]; latest: string }

/** Per stock: the highest level and the distinct labels of filings since `since` (YYYY-MM-DD). */
export function riskFlags(filings: readonly RiskFiling[], since: string): Map<string, RiskFlag> {
  const out = new Map<string, RiskFlag>();
  for (const f of filings) {
    if (f.date < since) continue;
    const rule = RISK_RULES.find((r) => r.key === f.key);
    if (!rule) continue;
    const cur = out.get(f.symbol) ?? { level: 1 as RiskLevel, labels: [], latest: f.date };
    cur.level = Math.max(cur.level, rule.level) as RiskLevel;
    if (!cur.labels.includes(rule.label)) cur.labels.push(rule.label);
    if (f.date > cur.latest) cur.latest = f.date;
    out.set(f.symbol, cur);
  }
  return out;
}
