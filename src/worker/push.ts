// Web Push (G-97): the phone notification for an in-app notification. Standards only (RFC 8291 payload
// encryption, RFC 8292 VAPID), with WebCrypto, so it runs in the Worker without a library.
// The VAPID signing key is made by the Worker on first use and kept in D1 (app_config); nobody handles it.

import type { D1 } from './db.js';

const enc = new TextEncoder();
export const b64u = (b: ArrayBuffer | Uint8Array<ArrayBuffer>): string => {
  const a = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = ''; for (const x of a) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const unb64u = (s: string): Uint8Array<ArrayBuffer> => {
  const t = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(t, (c) => c.charCodeAt(0));
};
const cat = (...parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const hkdf = async (salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, bytes: number) =>
  new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bytes * 8));

export interface Vapid { publicKey: string; privateJwk: JsonWebKey }

/** The Worker's VAPID key pair, made once and kept in D1. */
export async function vapid(db: D1): Promise<Vapid> {
  const row = await db.prepare("SELECT value FROM app_config WHERE key = 'vapid'").first<{ value: string }>();
  if (row) return JSON.parse(row.value) as Vapid;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const made: Vapid = { publicKey: b64u(await crypto.subtle.exportKey('raw', pair.publicKey) as ArrayBuffer), privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey) as JsonWebKey };
  await db.prepare("INSERT OR IGNORE INTO app_config (key, value) VALUES ('vapid', ?)").bind(JSON.stringify(made)).run();
  // Two first requests at once: keep whichever landed.
  const kept = await db.prepare("SELECT value FROM app_config WHERE key = 'vapid'").first<{ value: string }>();
  return JSON.parse(kept!.value) as Vapid;
}

/** RFC 8291 aes128gcm: the body a push service forwards to the browser, readable only by that subscription. */
export async function encryptPayload(payload: string, p256dh: string, auth: string): Promise<Uint8Array<ArrayBuffer>> {
  const ua = unb64u(p256dh), secret = unb64u(auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const as = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as EcdhKeyDeriveParams, eph.privateKey, 256));
  const ikm = await hkdf(secret, shared, cat(enc.encode('WebPush: info\0'), ua, as), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(enc.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return cat(salt, rs, new Uint8Array([as.length]), as, body);
}

/** RFC 8292: the push service checks this token against the public key the browser subscribed with. */
export async function vapidHeader(v: Vapid, endpoint: string, contact: string, now: Date): Promise<string> {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now.getTime() / 1000) + 12 * 3600, sub: contact })));
  const key = await crypto.subtle.importKey('jwk', v.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${v.publicKey}`;
}

export interface PushNote { title: string; body: string; link: string; tag?: string }

/** Sends to every browser the user turned on; a subscription the service says is gone is removed. */
export async function pushTo(db: D1, fetcher: typeof fetch, userId: string, note: PushNote, contact: string, now: Date): Promise<number> {
  const subs = (await db.prepare('SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id = ?').bind(userId).all<{ endpoint: string; p256dh: string; auth: string }>()).results;
  if (!subs.length) return 0;
  const v = await vapid(db), payload = JSON.stringify(note);
  let sent = 0;
  for (const s of subs) {
    try {
      const r = await fetcher(s.endpoint, { method: 'POST', headers: { Authorization: await vapidHeader(v, s.endpoint, contact, now), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal' }, body: await encryptPayload(payload, s.p256dh, s.auth), signal: AbortSignal.timeout(8000) });
      if (r.status === 404 || r.status === 410) await db.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(s.endpoint).run();
      else if (r.ok) sent += 1;
    } catch { /* one bad endpoint never blocks the rest */ }
  }
  return sent;
}
