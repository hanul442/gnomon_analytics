// English news for a US stock (G-179): Google News RSS, searched in English and clustered like Korean
// stories. The committee is told to quote an English headline in one translated line, so a reader never
// has to read the original to follow the argument.

import type { NewsItem } from '../types.js';
import { fetchRss } from './news.js';

export const US_NEWS_SOURCE = 'google:news-rss-en';

/** "Moderna, Inc." → "Moderna", "The Coca-Cola Company" → "Coca-Cola": the name people write in a headline. */
export function usNewsName(nameEng: string): string {
  return nameEng.replace(/^the\s+/i, '').replace(/,?\s+(Inc|Corp|Corporation|Co|Ltd|PLC|Holdings|Group|Company|SA|NV|AG)\.?(\s|$)/gi, ' ').replace(/[.,]+$/, '').replace(/\s+/g, ' ').trim();
}
/** The query pairs the plain name with the ticker so index notes do not drown it. */
export function usNewsQuery(ticker: string, nameEng: string): string {
  const name = usNewsName(nameEng);
  return name && name.toUpperCase() !== ticker.toUpperCase() ? `"${name}" OR "${ticker} stock"` : `"${ticker} stock"`;
}

export function usNewsSearchUrl(query: string): string {
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'en-US');
  url.searchParams.set('gl', 'US');
  url.searchParams.set('ceid', 'US:en');
  return url.toString();
}

export async function fetchUsNews(ticker: string, nameEng: string, options: { fetch?: typeof fetch; now?: () => Date } = {}): Promise<NewsItem[]> {
  return fetchRss(usNewsSearchUrl(usNewsQuery(ticker, nameEng)), US_NEWS_SOURCE, options);
}
