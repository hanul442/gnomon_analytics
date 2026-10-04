// OpenDART corp_code list (corpCode.xml, a zip holding one XML file). Maps a
// listed stock code to the 8-digit DART corp_code that list.json needs.

import { inflateRawSync } from 'node:zlib';

export const DART_CORP_SOURCE = 'opendart:corpCode';

/** Reads the first file of a zip archive (stored or deflated). */
export function firstZipEntry(zip: Buffer): Buffer {
  if (zip.readUInt32LE(0) !== 0x04034b50) throw new Error('DART_CORP_NOT_ZIP');
  const method = zip.readUInt16LE(8);
  // Sizes may be deferred to a data descriptor; the central directory always has them.
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const central = eocd >= 0 ? zip.readUInt32LE(eocd + 16) : -1;
  const size = central >= 0 && zip.readUInt32LE(central) === 0x02014b50 ? zip.readUInt32LE(central + 20) : zip.readUInt32LE(18);
  const start = 30 + zip.readUInt16LE(26) + zip.readUInt16LE(28);
  const data = zip.subarray(start, start + size);
  if (method === 0) return data;
  if (method === 8) return inflateRawSync(data);
  throw new Error(`DART_CORP_ZIP_METHOD_${method}`);
}

/** stock_code → corp_code for listed companies only. */
export function parseCorpCodes(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of xml.matchAll(/<list>([\s\S]*?)<\/list>/g)) {
    const corp = /<corp_code>\s*(\d{8})\s*<\/corp_code>/.exec(m[1]!)?.[1];
    const stock = /<stock_code>\s*([0-9A-Z]{6})\s*<\/stock_code>/.exec(m[1]!)?.[1];
    if (corp && stock) out[stock] = corp;
  }
  return out;
}

export async function fetchCorpCodes(options: { apiKey: string; fetch?: typeof fetch }): Promise<Record<string, string>> {
  if (!options.apiKey) throw new Error('OPENDART_API_KEY_MISSING');
  const response = await (options.fetch ?? fetch)(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(options.apiKey)}`, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`DART_CORP_HTTP_${response.status}`);
  const codes = parseCorpCodes(firstZipEntry(Buffer.from(await response.arrayBuffer())).toString('utf8'));
  if (Object.keys(codes).length < 1000) throw new Error('DART_CORP_TOO_FEW');
  return codes;
}
