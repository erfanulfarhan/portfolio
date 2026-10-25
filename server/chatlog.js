// What the site's assistant hands to Erfanul: signed chat turns, the visitor's
// rough whereabouts, and the emails built from them.
//
// Every answer is signed when it is given, and the browser sends the signed
// turns back with each question and in the transcript. Only turns that verify
// are used, so nothing can be put in a transcript that the chat never said.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { esc } from './mail.js';

export const MAX_TURNS = 40;
const MAX_QUESTION = 2000;
const MAX_ANSWER = 6000;

// Derived from the Groq key, which the chat cannot run without, so signing
// needs no environment variable of its own.
const secret = () => process.env.GROQ_API_KEY || '';
const signingKey = () => createHmac('sha256', secret()).update('erfanul.me chat turns').digest();

export const isConversationId = (cid) => typeof cid === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(cid);

const digest = (cid, turn) =>
  createHmac('sha256', signingKey())
    .update(JSON.stringify([cid, turn.i, turn.q, turn.a, turn.t, turn.m ? 1 : 0]))
    .digest('base64url');

/** A turn is one question and its answer: index, question, answer, time (ms), whether a message was passed on, signature. */
export const signTurn = (cid, turn) => ({ ...turn, s: digest(cid, turn) });

/** The turns that carry a valid signature for this conversation, oldest first. */
export function verifiedTurns(cid, turns) {
  if (!secret() || !isConversationId(cid) || !Array.isArray(turns)) return [];
  const seen = new Set();
  const out = [];
  for (const turn of turns.slice(-MAX_TURNS)) {
    if (!turn || typeof turn !== 'object') continue;
    const { i, q, a, t, m, s } = turn;
    if (!Number.isInteger(i) || i < 0 || seen.has(i)) continue;
    if (typeof q !== 'string' || typeof a !== 'string' || typeof s !== 'string' || !Number.isFinite(t)) continue;
    if (q.length > MAX_QUESTION || a.length > MAX_ANSWER) continue;
    const want = Buffer.from(digest(cid, { i, q, a, t, m }));
    const got = Buffer.from(s);
    if (want.length !== got.length || !timingSafeEqual(want, got)) continue;
    seen.add(i);
    out.push({ i, q, a, t, m: m ? 1 : 0 });
  }
  return out.sort((x, y) => x.i - y.i);
}

/** A UUID-shaped key that is the same every time for the same input. */
export function stableUuid(input) {
  const h = createHash('sha256').update(input).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// First match wins, so the browsers built on Chrome come before Chrome itself.
const SYSTEMS = [[/iPhone/, 'iPhone'], [/iPad/, 'iPad'], [/Android/, 'Android'], [/Macintosh|Mac OS X/, 'Mac'], [/Windows/, 'Windows'], [/CrOS/, 'ChromeOS'], [/Linux/, 'Linux']];
const BROWSERS = [[/Edg(A|iOS)?\//, 'Edge'], [/OPR\/|Opera/, 'Opera'], [/SamsungBrowser/, 'Samsung Internet'], [/CriOS|Chrome\//, 'Chrome'], [/FxiOS|Firefox\//, 'Firefox'], [/Safari\//, 'Safari']];
const pick = (list, ua, fallback) => list.find(([re]) => re.test(ua))?.[1] ?? fallback;

function describeAgent(ua, touch) {
  if (!ua) return 'Unknown';
  let os = pick(SYSTEMS, ua, 'an unknown device');
  if (os === 'Mac' && touch) os = 'iPad'; // iPads ask for the desktop site as a Mac
  return `${pick(BROWSERS, ua, 'A browser')} on ${os}`;
}

const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

/**
 * Who is chatting, roughly: Vercel's geolocation headers (city and country, no
 * IP address is kept), the browser, and what the page itself reported.
 */
export function visitorDetails(req, meta = {}) {
  const header = (name) => {
    const v = req.headers?.[name];
    return (Array.isArray(v) ? v[0] : v) || '';
  };
  const decode = (v) => {
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  const code = header('x-vercel-ip-country');
  let country = code;
  try {
    if (code) country = new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch {
    // An unknown code stays as it is.
  }
  const ua = header('user-agent');
  const m = meta && typeof meta === 'object' ? meta : {};
  return {
    place: [decode(header('x-vercel-ip-city')), country].filter(Boolean).join(', '),
    device: describeAgent(ua, m.touch === true),
    agent: ua.slice(0, 300),
    screen: text(m.screen, 20),
    lang: text(m.lang, 40),
    tz: text(m.tz, 60),
    ref: text(m.ref, 300),
    page: text(m.page, 300),
    visitor: text(m.visitor, 40),
    chats: Number.isInteger(m.chats) && m.chats > 0 && m.chats < 10000 ? m.chats : 0,
  };
}

/** Email addresses and phone numbers the visitor typed. */
export function contactsIn(texts) {
  const emails = new Set();
  const phones = new Set();
  for (const s of texts) {
    for (const e of s.match(/[^\s@<>()[\]"',;:]+@[^\s@<>()[\]"',;:]+\.[a-z]{2,}/gi) || []) emails.add(e.toLowerCase());
    for (const p of s.match(/\+?\d[\d\s().-]{7,}\d/g) || []) {
      const digits = p.replace(/\D/g, '');
      const intl = p.trim().startsWith('+') && digits.length >= 8 && digits.length <= 15;
      const local = digits.startsWith('0') && digits.length >= 10 && digits.length <= 11;
      if (intl || local) phones.add(p.trim());
    }
  }
  return { emails: [...emails], phones: [...phones] };
}

const dhaka = (ms, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', ...opts }).format(new Date(ms));
const stamp = (ms) => dhaka(ms, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const clock = (ms) => dhaka(ms, { hour: '2-digit', minute: '2-digit', hour12: false });

export const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 3).trimEnd()}...` : s);

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

function referrer(ref) {
  if (!ref) return 'No referrer (typed in, a bookmark or an app)';
  try {
    const u = new URL(ref);
    return u.hostname === 'erfanul.me' || u.hostname === 'www.erfanul.me' ? 'Another page of the site' : u.hostname + u.pathname.replace(/\/$/, '');
  } catch {
    return ref;
  }
}

const row = (label, value) =>
  value
    ? `<tr><td style="padding:3px 16px 3px 0;color:#6b6b6b;vertical-align:top;white-space:nowrap">${esc(label)}</td><td style="padding:3px 0">${value}</td></tr>`
    : '';

/** The facts table at the top of both emails. */
export function detailsTable(who, contacts, extra = '') {
  const reach = [
    ...contacts.emails.map((e) => `<a href="mailto:${esc(e)}">${esc(e)}</a>`),
    ...contacts.phones.map((p) => esc(p)),
  ].join(', ');
  const visitor = who.visitor ? `${esc(who.visitor)}${who.chats > 1 ? `, their ${ordinal(who.chats)} chat` : ''}` : '';
  return (
    `<table style="border-collapse:collapse;font-size:14px;margin:0 0 20px">` +
    row('Contact', reach || 'None given in the chat') +
    extra +
    row('From', esc(who.place || 'Unknown')) +
    row('Device', esc([who.device, who.screen].filter(Boolean).join(', '))) +
    row('Language', esc([who.lang, who.tz].filter(Boolean).join(', '))) +
    row('Came from', esc(referrer(who.ref))) +
    row('Visitor', visitor) +
    `</table>`
  );
}

/** The conversation, question by question. */
export function conversationHtml(turns, pending) {
  const bubble = (who, body, time, tint) =>
    `<div style="margin:0 0 12px;padding:10px 12px;border-radius:10px;background:${tint}">` +
    `<div style="font-size:12px;color:#6b6b6b;margin:0 0 4px">${who}${time ? `, ${clock(time)}` : ''}</div>` +
    `<div style="white-space:pre-wrap">${esc(body)}</div></div>`;
  let html = '';
  for (const t of turns) {
    html += bubble('Visitor', t.q, t.t, '#f1efe9');
    html += bubble(t.m ? 'Assistant (passed a message on to you)' : 'Assistant', t.a, 0, '#f7f7f7');
  }
  if (pending) html += bubble('Visitor', pending, Date.now(), '#f1efe9');
  return html;
}

export const frame = (title, sub, body, agent) =>
  `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#161616;max-width:640px">` +
  `<h2 style="margin:0 0 2px;font-size:19px">${title}</h2>` +
  `<p style="margin:0 0 18px;color:#6b6b6b;font-size:13px">${sub}</p>` +
  body +
  (agent ? `<p style="margin:20px 0 0;color:#9a9a9a;font-size:11px">${esc(agent)}</p>` : '') +
  `</div>`;

export const when = (ms) => `${stamp(ms)} Dhaka time`;
