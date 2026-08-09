// Contact form → email. Receives {name, email, message} and sends it to the
// site owner via Brevo's transactional API. The visitor's address is set as
// reply-to, so replying from the inbox goes straight back to them.
// The Brevo key stays server-side (Vercel env var).

const BREVO = 'https://api.brevo.com/v3/smtp/email';
const OWNER = 'erfanul100@gmail.com';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.BREVO_API_KEY;
  if (!key) return res.status(500).json({ error: 'Contact is not configured yet.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { name = '', email = '', message = '', company = '' } = body || {};

  if (company) return res.status(200).json({ ok: true });          // honeypot: bots fill this → silently drop
  if (!name.trim() || !email.trim() || !message.trim()) return res.status(400).json({ error: 'All fields are required.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (message.length > 5000) return res.status(400).json({ error: 'Message is too long.' });

  const html =
    `<h2 style="margin:0 0 12px">New message from your portfolio</h2>` +
    `<p><b>Name:</b> ${esc(name)}</p>` +
    `<p><b>Email:</b> ${esc(email)}</p>` +
    `<p><b>Message:</b></p><p style="white-space:pre-wrap">${esc(message)}</p>`;

  try {
    const r = await fetch(BREVO, {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Portfolio Contact', email: OWNER },
        to: [{ email: OWNER, name: 'Erfanul' }],
        replyTo: { email, name },
        subject: `Portfolio message from ${name}`.slice(0, 180),
        htmlContent: html,
      }),
    });
    if (r.ok) return res.status(200).json({ ok: true });
    const d = await r.json().catch(() => ({}));
    return res.status(502).json({ error: d.message || 'Could not send right now.' });
  } catch (e) {
    return res.status(502).json({ error: 'Could not send right now.' });
  }
}
