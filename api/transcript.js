// Chat transcript → email. When a visitor closes the assistant or leaves the
// page, the browser sends the conversation here, and it goes to Erfanul with
// roughly where it came from, so a visitor who left an email can be reached.
// Only turns signed by api/chat.js count, so this cannot be used to email
// anything the chat did not say.

import { mailOwner } from '../server/mail.js';
import {
  contactsIn,
  conversationHtml,
  cut,
  detailsTable,
  frame,
  isConversationId,
  stableUuid,
  verifiedTurns,
  visitorDetails,
  when,
} from '../server/chatlog.js';

// A transcript is taken until six hours after its last answer.
const FRESH = 6 * 60 * 60 * 1000;
// Transcripts this instance has already sent. Brevo's idempotency key covers
// the other instances.
const recent = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.BREVO_API_KEY || !process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Transcripts are not configured.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { cid = '', turns = [], meta = {} } = body || {};
  if (!isConversationId(cid)) return res.status(400).json({ error: 'No conversation.' });

  const chat = verifiedTurns(cid, turns);
  const last = chat[chat.length - 1];
  const now = Date.now();
  if (!last || now - last.t > FRESH || last.t - now > 5 * 60 * 1000) return res.status(204).end();

  const key = `${cid}:${chat.length}:${last.i}`;
  if (recent.has(key)) return res.status(200).json({ ok: true, duplicate: true });
  recent.set(key, now);
  if (recent.size > 500) recent.delete(recent.keys().next().value);

  const who = visitorDetails(req, meta);
  const contacts = contactsIn(chat.map((t) => t.q));
  const reachable = contacts.emails.length + contacts.phones.length > 0;
  const passedOn = chat.some((t) => t.m);
  const part = Number.isInteger(meta?.part) && meta.part > 1;
  const count = `${chat.length} ${chat.length === 1 ? 'question' : 'questions'}`;

  const html = frame(
    passedOn ? 'A visitor chatted with your assistant and sent you a message' : 'A visitor chatted with your assistant',
    `Started ${when(chat[0].t)}, ${count}.${part ? ' An updated copy: the whole chat, with what came after the last email.' : ''}`,
    detailsTable(who, contacts) + `<h3 style="margin:24px 0 10px;font-size:15px">The chat</h3>` + conversationHtml(chat),
    who.agent,
  );
  const first = cut(chat[0].q.replace(/\s+/g, ' '), 70);
  const sent = await mailOwner({
    from: 'Portfolio assistant',
    subject: `${reachable ? 'Chat with contact details' : 'Chat'} on erfanul.me: "${first}"`,
    html,
    replyTo: contacts.emails[0] ? { email: contacts.emails[0] } : undefined,
    once: stableUuid(key),
  });
  if (sent.ok) return res.status(200).json({ ok: true });
  recent.delete(key);
  return res.status(502).json({ error: 'Could not send right now.' });
}
