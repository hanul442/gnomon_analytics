// Sealed deep reports (docs/DESIGN.md §5.21, G-61). The repository and the site are public, so the
// paid part of a committee report is stored encrypted: AES-256-GCM, the key is SHA-256 of the secret
// GNM_DEEP_KEY (GitHub Actions and the API Worker share it). Format: base64(iv[12] ‖ ciphertext+tag).
// WebCrypto only, so the same code runs in Node and in the Worker.

const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(s); };
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function keyOf(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function seal(text: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyOf(secret), enc.encode(text)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv); out.set(ct, iv.length);
  return b64(out);
}

/** Throws when the key is wrong or the text was changed. */
export async function unseal(sealed: string, secret: string): Promise<string> {
  const bytes = unb64(sealed.trim());
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, await keyOf(secret), bytes.subarray(12));
  return dec.decode(plain);
}

/** Where the sealed paid HTML of a report lives on the site, relative to the site root. */
export const deepPath = (symbol: string, date: string) => `${symbol}/deep/${date}.txt`;
/** A Korean code, an Upbit market, the market report, or a US Reuters code like AAPL.O (G-152). */
export const DEEP_SYMBOL = /^([0-9A-Z]{6}|KRW-[A-Z0-9]{1,15}|MARKET-DAILY|[A-Z][A-Z0-9-]{0,9}(\.[A-Z])?)$/;
/** A US stock's code: starts with a letter, not a coin or the market report. */
export const isUsSymbol = (s: string) => /^[A-Z][A-Z0-9-]{0,9}(\.[A-Z])?$/.test(s) && !s.startsWith('KRW-') && !s.startsWith('MARKET-');
export const DEEP_DATE = /^\d{4}-\d{2}-\d{2}$/;
