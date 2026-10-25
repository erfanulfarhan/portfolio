// Email to the site owner through Brevo's transactional API. Shared by the
// contact form, the assistant's "pass a message on" tool and chat transcripts.
// The Brevo key stays server-side (Vercel env var).

const BREVO = 'https://api.brevo.com/v3/smtp/email';
export const OWNER = 'erfanul100@gmail.com';

export const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

/**
 * Sends one email to the owner. `replyTo` is the visitor when there is one, so
 * replying from the inbox goes straight back to them. `once` is an idempotency
 * key (a UUID): Brevo refuses a repeat of it for a while instead of sending twice.
 */
export async function mailOwner({ from, subject, html, replyTo, once }) {
  const key = process.env.BREVO_API_KEY;
  if (!key) return { ok: false, error: 'not configured' };

  const payload = {
    sender: { name: from, email: OWNER },
    to: [{ email: OWNER, name: 'Erfanul' }],
    subject: subject.slice(0, 180),
    htmlContent: html,
  };
  if (replyTo) payload.replyTo = replyTo;
  if (once) payload.headers = { idempotencyKey: once };

  try {
    const r = await fetch(BREVO, {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) return { ok: true };
    const d = await r.json().catch(() => ({}));
    if (d.code === 'duplicate_parameter' && once) return { ok: true, duplicate: true };
    return { ok: false, error: d.message || '' };
  } catch {
    return { ok: false, error: '' };
  }
}
