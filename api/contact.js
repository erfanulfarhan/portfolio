// Contact form → email. Receives {name, email, message} and sends it to the
// site owner via Brevo's transactional API (server/mail.js). The visitor's
// address is set as reply-to, so replying from the inbox goes straight back to them.

import { esc, isEmail, mailOwner } from '../server/mail.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.BREVO_API_KEY) return res.status(500).json({ error: 'Contact is not configured yet.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { name = '', email = '', message = '', hp = '', company = '' } = body || {};

  // Honeypot: a hidden field only bots fill in. `company` is the old site's name for it.
  if (hp || company) return res.status(200).json({ ok: true });
  if (!name.trim() || !email.trim() || !message.trim()) return res.status(400).json({ error: 'All fields are required.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (message.length > 5000) return res.status(400).json({ error: 'Message is too long.' });

  const html =
    `<h2 style="margin:0 0 12px">New message from your portfolio</h2>` +
    `<p><b>Name:</b> ${esc(name)}</p>` +
    `<p><b>Email:</b> ${esc(email)}</p>` +
    `<p><b>Message:</b></p><p style="white-space:pre-wrap">${esc(message)}</p>`;

  const sent = await mailOwner({
    from: 'Portfolio Contact',
    subject: `Portfolio message from ${name}`,
    html,
    replyTo: { email, name },
  });
  if (sent.ok) return res.status(200).json({ ok: true });
  // The page adds the email address to write to instead.
  return res.status(502).json({ error: 'The message could not be sent right now.' });
}
