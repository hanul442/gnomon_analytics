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
