// G-223: a filing's original text from OpenDART (document.xml, 공시서류원본파일), for the chat to
// read and explain. The endpoint answers with a ZIP of DART's XML documents (the main report as
// <rcept_no>.xml, attachments beside it), or with a small XML status body on errors.

export const FILING_MAX_CHARS = 20_000;

export interface FilingText {
  receiptNo: string;
  /** DOCUMENT-NAME of the main document, when present. */
  title: string;
  text: string;
  /** The original was longer than FILING_MAX_CHARS; only its start is kept. */
  truncated: boolean;
}

export const isReceiptNo = (v: unknown): v is string => typeof v === 'string' && /^\d{14}$/.test(v);

const u16 = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u32 = (b: Uint8Array, i: number) => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The files of a ZIP archive (stored or deflated entries; no ZIP64, no encryption). */
export async function unzip(bytes: Uint8Array): Promise<{ name: string; data: Uint8Array }[]> {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i -= 1) {
    if (u32(bytes, i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('DART_DOC_NOT_ZIP');
  const count = u16(bytes, end + 10);
  let at = u32(bytes, end + 16);
  const out: { name: string; data: Uint8Array }[] = [];
  for (let n = 0; n < count; n += 1) {
    if (u32(bytes, at) !== 0x02014b50) throw new Error('DART_DOC_BAD_ZIP');
    const method = u16(bytes, at + 10), size = u32(bytes, at + 20);
    const nameLen = u16(bytes, at + 28), extraLen = u16(bytes, at + 30), commentLen = u16(bytes, at + 32);
    const local = u32(bytes, at + 42);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
    if (u32(bytes, local) !== 0x04034b50) throw new Error('DART_DOC_BAD_ZIP');
    const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
    const raw = bytes.subarray(start, start + size);
    if (method === 0) out.push({ name, data: raw });
    else if (method === 8) out.push({ name, data: await inflateRaw(raw) });
  }
  return out;
}

/** Decodes an XML file by the encoding its prolog names (DART uses UTF-8; older filings EUC-KR). */
export function decodeXml(data: Uint8Array): string {
  const head = new TextDecoder('latin1').decode(data.subarray(0, 200));
  const label = /encoding=["']([\w-]+)["']/i.exec(head)?.[1] ?? 'utf-8';
  try { return new TextDecoder(label).decode(data); } catch { return new TextDecoder().decode(data); }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** DART's document XML as plain text: tables become ` | `-separated rows, paragraphs and titles lines. */
export function dartXmlToText(xml: string): string {
  return xml
    .replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[|\]\]>/g, '')
    .replace(/<(IMAGE|LIBRARY)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(TD|TH|TE|TU)>/gi, ' | ')
    .replace(/<\/?(TR|P|TITLE|BR|TABLE|SECTION-\d|DOCUMENT-NAME|COMPANY-NAME|COVER-TITLE|PGBRK)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m)
    .split('\n')
    .map((l) => l.replace(/[ \t 　]+/g, ' ').trim().replace(/^\|\s*/, '').replace(/(\s*\|\s*)+$/, ''))
    .filter((l) => l && !/^[|\s-]+$/.test(l))
    .join('\n');
}

/** The main document first (<rcept_no>.xml), then attachments, cut to FILING_MAX_CHARS. */
export async function parseDartDocument(receiptNo: string, bytes: Uint8Array): Promise<FilingText> {
  const head = new TextDecoder().decode(bytes.subarray(0, 400));
  if (/^\s*<\?xml/.test(head) && /<result>/.test(head)) {
    const status = /<status>([^<]*)<\/status>/.exec(head)?.[1] ?? 'MISSING';
    throw new Error(`DART_STATUS_${status}`);
  }
  const files = (await unzip(bytes)).filter((f) => /\.xml$/i.test(f.name))
    .sort((a, b) => (a.name.startsWith(`${receiptNo}.`) ? -1 : b.name.startsWith(`${receiptNo}.`) ? 1 : a.name < b.name ? -1 : 1));
  if (!files.length) throw new Error('DART_DOC_EMPTY');
  let title = '', text = '';
  for (const f of files) {
    const xml = decodeXml(f.data);
    if (!title) title = dartXmlToText(/<DOCUMENT-NAME\b[^>]*>([\s\S]*?)<\/DOCUMENT-NAME>/i.exec(xml)?.[1] ?? '');
    const body = dartXmlToText(xml);
    if (body) text += (text ? '\n\n[첨부]\n' : '') + body;
    if (text.length > FILING_MAX_CHARS) break;
  }
  const truncated = text.length > FILING_MAX_CHARS;
  return { receiptNo, title, text: truncated ? text.slice(0, FILING_MAX_CHARS) : text, truncated };
}

export async function fetchDartDocument(apiKey: string | undefined, receiptNo: string, fetcher: typeof fetch): Promise<FilingText> {
  if (!apiKey?.trim()) throw new Error('OPENDART_API_KEY_MISSING');
  const url = new URL('https://opendart.fss.or.kr/api/document.xml');
  url.searchParams.set('crtfc_key', apiKey);
  url.searchParams.set('rcept_no', receiptNo);
  // Workers send no User-Agent by default; some Korean public sites refuse such requests.
  const res = await fetcher(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GNOMON/1.0)', Accept: '*/*' }, signal: AbortSignal.timeout(20_000) });
  // Never echo the URL: it carries the API key.
  if (!res.ok) throw new Error(`DART_HTTP_${res.status}`);
  return parseDartDocument(receiptNo, new Uint8Array(await res.arrayBuffer()));
}

/** G-224: the committee reads the start of each new important DART filing (newest first, a few per report). */
export async function attachFilingExcerpts(
  filings: { receiptNo: string; importance: string; excerpt?: string }[],
  apiKey: string,
  fetcher: typeof fetch,
  limits: { count?: number; chars?: number } = {},
): Promise<number> {
  if (!apiKey.trim()) return 0;
  const chars = limits.chars ?? 4_000;
  let read = 0;
  for (const f of filings.filter((x) => x.importance === 'HIGH' && isReceiptNo(x.receiptNo)).slice(0, limits.count ?? 3)) {
    // Best effort: a filing DART cannot serve is discussed from its title as before.
    const doc = await fetchDartDocument(apiKey, f.receiptNo, fetcher).catch(() => null);
    if (!doc?.text) continue;
    f.excerpt = doc.text.length > chars ? `${doc.text.slice(0, chars)} …(앞부분 ${chars.toLocaleString('ko-KR')}자만)` : doc.text;
    read += 1;
  }
  return read;
}

/** The text the chat reads, wrapped as data (never instructions). */
export const filingContext = (f: FilingText) =>
  `<filing receipt="${f.receiptNo}"${f.truncated ? ` truncated="true" kept_chars="${FILING_MAX_CHARS}"` : ''}>\n${f.title ? `문서: ${f.title}\n` : ''}${f.text}\n</filing>`;
