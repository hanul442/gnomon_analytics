// Mail (G-180): every email the Worker sends goes through one template and one sender, and leaves a row
// in mail_log (who, what kind, delivered or why not), so a missing login link or a silent weekly summary
// can be traced without Resend's dashboard. Resend is the only provider; without RESEND_API_KEY nothing
// is sent and the caller decides what to tell the user.

import type { D1 } from './db.js';

export type MailKind = 'login' | 'screen' | 'weekly' | 'test';
export interface MailEnv { RESEND_API_KEY?: string; MAIL_FROM?: string; SITE_URL: string }
export interface MailBody { kind: MailKind; to: string; subject: string; /** The part between the header and the footer; already HTML. */ html: string; text: string; userId?: string | null }

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export const DEFAULT_FROM = 'GNOMON <onboarding@resend.dev>';

/** A button-shaped link for mail (inline styles only: mail clients ignore stylesheets). */
export const mailButton = (href: string, label: string): string => `<a href="${esc(href)}" style="display:inline-block;background:#18143a;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">${esc(label)}</a>`;
/** A short list block. */
export const mailList = (items: readonly string[]): string => `<ul style="margin:8px 0 0;padding-left:18px;color:#223843">${items.map((x) => `<li style="margin:4px 0">${x}</li>`).join('')}</ul>`;

/**
 * The common frame: wordmark, the title, the body, then the footer with the settings link and the disclaimer.
 * Width 520px, system sans, dark-navy wordmark; the same on every mail so a reader recognises it at a glance.
 */
export function mailLayout(site: string, title: string, body: string, options: { preheader?: string; settings?: boolean } = {}): string {
  const base = site.replace(/\/$/, '');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f5f8;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard','Segoe UI',Roboto,sans-serif;color:#223843">
${options.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(options.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#18143a;padding:18px 24px"><a href="${esc(base)}/index.html" style="color:#ffffff;text-decoration:none;font-weight:800;letter-spacing:.12em;font-size:15px">GNOMON</a> <span style="color:#b9b3ff;font-size:11px;letter-spacing:.14em">AI COMMITTEE</span></td></tr>
<tr><td style="padding:24px 24px 8px"><h1 style="margin:0 0 12px;font-size:20px;line-height:1.35">${esc(title)}</h1>${body}</td></tr>
<tr><td style="padding:16px 24px 24px;font-size:12px;line-height:1.6;color:#6b7684;border-top:1px solid #e5e8ec">
${options.settings === false ? '' : `<p style="margin:0 0 6px">이 메일은 그노몬 알림 설정에 따라 보냈어요. <a href="${esc(base)}/alerts.html" style="color:#4f46e5">알림 설정</a>에서 종류별로 끄거나 켤 수 있어요.</p>`}
<p style="margin:0">계산 결과와 AI 의견이에요. 투자 권유가 아니고, 틀릴 수 있어요. · <a href="${esc(base)}/terms.html" style="color:#6b7684">이용약관·면책</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

/**
 * Send through Resend and log the outcome. Returns true when Resend accepted the mail. Never throws on a
 * provider error: the row says what happened (status 'failed' with the error) and the caller carries on.
 */
export async function sendMail(env: MailEnv, db: D1, fetchFn: typeof fetch, now: Date, mail: MailBody): Promise<boolean> {
  const log = (status: 'sent' | 'failed' | 'skipped', error: string | null) =>
    db.prepare('INSERT INTO mail_log (user_id, email, kind, subject, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(mail.userId ?? null, mail.to, mail.kind, mail.subject.slice(0, 120), status, error, now.toISOString()).run().catch(() => undefined);
  if (!env.RESEND_API_KEY) { await log('skipped', 'NO_API_KEY'); return false; }
  try {
    const r = await fetchFn('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM || DEFAULT_FROM, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) { await log('failed', `HTTP_${r.status} ${(await r.text().catch(() => '')).slice(0, 120)}`); return false; }
    await log('sent', null);
    return true;
  } catch (e) {
    await log('failed', e instanceof Error ? e.message.slice(0, 120) : 'UNKNOWN');
    return false;
  }
}
