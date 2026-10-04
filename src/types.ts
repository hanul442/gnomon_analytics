/** One trading day for one stock. Prices in KRW. */
export interface PriceBar {
  symbol: string;
  /** KST trading date, YYYY-MM-DD. */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
  /** When this process fetched it (ISO UTC). */
  retrievedAt: string;
}

/** One DART filing. */
export interface Disclosure {
  /** DART receipt number; unique per filing. */
  receiptNo: string;
  corpName: string;
  stockCode: string;
  /** Filing title as DART shows it, e.g. "[기재정정]주요사항보고서(...)". */
  title: string;
  filer: string;
  /** KST filing date, YYYY-MM-DD. DART gives no time of day. */
  filedDate: string;
  /** DART remark flags (e.g. 유, 코, 정). */
  remark: string;
  url: string;
  source: string;
  retrievedAt: string;
}

/** One news article: headline, outlet and link only — never the body. */
export interface NewsItem {
  /** Canonical article URL (publisher link when known); the record key. */
  url: string;
  title: string;
  publisher: string;
  /** ISO UTC; when the outlet published it. */
  publishedAt: string;
  source: string;
  retrievedAt: string;
}

/** One regular-session day of minute closes (Naver gives no minute OHLC). */
export interface IntradaySession {
  symbol: string;
  /** KST trading date, YYYY-MM-DD. */
  date: string;
  /** Minute stamps HH:mm (KST), 09:00 to 15:30, ascending. */
  times: string[];
  closes: number[];
  /** Cumulative session volume at each minute. */
  cumVolumes: number[];
  source: string;
  retrievedAt: string;
}

/** Net buying by investor type for one trading day, in shares. */
export interface InvestorFlow {
  symbol: string;
  date: string;
  foreignNet: number | null;
  institutionNet: number | null;
  individualNet: number | null;
  /** Foreign holding ratio, percent of listed shares. */
  foreignHoldRatio: number | null;
  close: number | null;
  volume: number | null;
  source: string;
  retrievedAt: string;
}

/** Valuation and consensus figures as Naver showed them on one KST day. */
export interface StockSnapshot {
  symbol: string;
  /** KST date the snapshot was taken. */
  date: string;
  per: number | null;
  eps: number | null;
  estimatedPer: number | null;
  estimatedEps: number | null;
  pbr: number | null;
  bps: number | null;
  dividendYield: number | null;
  /** Market value in KRW. */
  marketCap: number | null;
  high52w: number | null;
  low52w: number | null;
  /** Securities-firm consensus (Naver), not our view. */
  consensus: { date: string; targetPriceMean: number | null; recommendationMean: number | null } | null;
  source: string;
  retrievedAt: string;
}

/** One reporting period of headline financials (KRW 100 million unless a ratio). */
export interface FinancePeriod {
  symbol: string;
  periodType: 'QUARTER' | 'ANNUAL';
  /** YYYYMM of the period end. */
  period: string;
  /** True for analyst estimates of a period not yet reported. */
  isEstimate: boolean;
  /** Row title (e.g. 매출액, 영업이익, ROE) to value; null when Naver shows "-". */
  metrics: Record<string, number | null>;
  source: string;
  retrievedAt: string;
}

/** A securities-firm report listing: title, firm and date only, never the body. */
export interface ResearchNote {
  id: string;
  symbol: string;
  broker: string;
  title: string;
  date: string;
  source: string;
  retrievedAt: string;
}
