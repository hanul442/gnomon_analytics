// Diagnose: fetch one filing's original from OpenDART document.xml and parse it as the chat does.
// Prints only shapes (status, type, size, first bytes, parse result), never the key.
import { parseDartDocument } from '../dist/sources/dartDocument.js';
const key = process.env.OPENDART_API_KEY ?? '';
for (const no of process.argv.slice(2)) {
  const url = new URL('https://opendart.fss.or.kr/api/document.xml');
  url.searchParams.set('crtfc_key', key); url.searchParams.set('rcept_no', no);
  const res = await fetch(url);
  const bytes = new Uint8Array(await res.arrayBuffer());
  console.log(no, 'HTTP', res.status, res.headers.get('content-type'), bytes.length, 'bytes, head', Buffer.from(bytes.subarray(0, 8)).toString('hex'), JSON.stringify(new TextDecoder().decode(bytes.subarray(0, 160))));
  try {
    const f = await parseDartDocument(no, bytes);
    console.log('  OK title', JSON.stringify(f.title), 'chars', f.text.length, 'truncated', f.truncated, JSON.stringify(f.text.slice(0, 300)));
  } catch (e) { console.log('  FAIL', e instanceof Error ? e.stack : e); }
}
