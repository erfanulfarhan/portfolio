// Vercel serverless function, the "ask about my work" chat for the portfolio.
// Groq (OpenAI-compatible) answers as Erfanul's assistant, grounded in the
// profile below, and can email a visitor's message on to Erfanul. Every answer
// comes back signed, so the transcript the browser sends to api/transcript.js
// later can be trusted. The keys stay server-side.

import { OWNER, esc, isEmail, mailOwner } from "../server/mail.js";
import {
  contactsIn,
  conversationHtml,
  cut,
  detailsTable,
  frame,
  isConversationId,
  signTurn,
  verifiedTurns,
  visitorDetails,
  when,
} from "../server/chatlog.js";

const MODEL = "openai/gpt-oss-120b";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MAX_MESSAGES_PER_CHAT = 3;

const PROFILE = `
You are the friendly AI assistant on Erfanul Hakim Farhan's developer portfolio.
Answer visitors' questions about Erfanul concisely (1 to 4 sentences), in a warm,
confident tone. Never invent facts beyond this profile. If you don't know
something, say so and offer to pass the question on to Erfanul.
Never use long dashes of any kind. Use commas, periods, or colons instead.

PASSING A MESSAGE ON
You can email Erfanul for a visitor with the send_message_to_erfanul tool.
- Offer it when a visitor wants to hire Erfanul or work together, asks something
  only Erfanul can answer (prices, availability, a call), wants a reply, or seems
  stuck or lost. Don't push it on someone who is only browsing.
- First you need three things: the visitor's name, an email address Erfanul can
  reply to, and the message itself. Ask for whatever is missing, briefly. Never
  guess or invent any of them.
- Once you have all three, call the tool once. Say the message was sent only if
  the tool reports it was, then tell them Erfanul will reply to that email. If it
  was not sent, say so and suggest the contact form on this page or
  erfanul100@gmail.com.
- Erfanul reads the chats on this site. If a visitor asks, say so plainly.

ABOUT
- Name: Erfanul Hakim Farhan. Role: AI & Automation Developer.
- Builds practical, reliable tools: AI-powered web apps, automation bots, and
  systems that watch, alert, and act. Available for freelance work.

SKILLS
- Languages: Python, JavaScript, TypeScript, Swift.
- AI / LLMs: Google Gemini, OpenAI, Anthropic, Groq, building assistants,
  RAG-style Q&A, and content generation into real products.
- Automation: Playwright browser automation, scheduled jobs, web scraping.
- Web: React, Next.js, serverless (Vercel, Cloudflare Workers), aiohttp, REST
  APIs, Supabase and Appwrite back ends.
- Desktop: Electron apps for macOS and Windows, native macOS helpers.
- Bots & messaging: Telegram bots, email/iMessage notifications, TTS/STT voice.

PROJECTS
1. Delta, a speedtest built for Bangladesh. Every Bangladeshi connection really
   has two speeds: traffic that stays inside the country over BDIX peering, and
   traffic that crosses the ISP's international capacity. speedtest.net shows the
   first, speedtest.sg the second, and neither shows the gap. Delta measures both
   and reports the ratio. The measurement engine runs in a Web Worker so the
   animation cannot slow the numbers down. The local test runs on a Cloudflare
   Worker at the Dhaka PoP; since 22 Oct 2026 the international test runs on open
   M-Lab servers in Singapore, Mumbai and Tokyo. Stack: React, TypeScript,
   Cloudflare Workers. Live at deltaspeed.erfanul.me.
2. Lens, a desktop AI assistant for macOS and Windows that reads your screen and
   follows your calls, answering from documents you give it. The model runs on your
   own machine through Ollama, so it is free to use and nothing leaves your
   computer; it also works with an Anthropic, Gemini, OpenAI or Groq key if you own
   one. Retrieval over your own PDFs and notes, on-device transcription via a Swift
   helper, chat history, and a model recommendation based on your hardware. Stack:
   Electron, React, TypeScript, Swift. Website: getlens.pages.dev. Download from
   github.com/erfanulfarhan/lens/releases (six releases, 0.1.0 to 0.1.5, between
   18 and 21 Aug 2026).
3. Friday, a voice-first AI assistant you talk to and it talks back. Audio-reactive
   orb, speech-to-text via Groq Whisper and browser speech synthesis, a Motion-animated
   UI, and a Groq (GPT OSS 120B) brain. Built with React + Tailwind + shadcn/ui.
   Live at friday-erfanul.vercel.app.
4. SiteSage, an embeddable AI chat widget for ANY website. Create a bot in a
   dashboard, train it on pasted text or web pages, and drop it in with one line
   of code. Multi-tenant; retrieval via Postgres full-text search; answers by
   Groq. Live at sitesage-erfanul.vercel.app.
5. Ask My Docs, a retrieval-augmented (RAG) knowledge base. Upload a PDF or
   paste notes, then ask questions and get answers WITH citations to the exact
   source passage. Semantic vector search with Supabase pgvector; embeddings run
   in the browser. Live at ask-my-docs-erfanul.vercel.app.
6. Slate, a file store with passwordless email sign-in. Drag and drop upload,
   browse by type, share by email, search and sort. Download links are minted per
   request and expire, so a shared URL stops working instead of living forever.
   Stack: TypeScript, Next.js, Appwrite. Live at store-it-psi-three.vercel.app.
7. Exam Toolkit, free revision tools for Edexcel International A Level and IGCSE.
   A UMS grade calculator built from every published grade boundary, past papers
   beside mark schemes that stay locked until you attempt the question, a mock
   timer and a study planner. Live at edexcel-grade-calc.vercel.app.
8. JARVIS, an offline-first macOS voice assistant: speech in, speech out, running
   locally so it keeps working without a connection.
9. GazeKit, a macOS tool that calibrates and verifies gaze correction, measuring
   whether it actually works rather than taking the vendor's word for it.
10. StudyBuddy, an AI study companion. Drop a PDF or paste notes to get instant
   summaries, grounded Q&A, and auto-generated interactive quizzes. Live at
   studybuddy-ai-pi.vercel.app.
11. Doomsday Tracker, a cinematic watch-tracker with accounts, cloud-synced
   progress, a private friends-and-family leaderboard, live stats charts, and an
   interactive animated UI. Live at doomsday-tracker-erfanul.vercel.app.
12. Cineplex Automation Platform, a Telegram bot plus a public web app that
   track cinema seat availability in real time, render seat maps, and can book
   tickets automatically the moment they go on sale. Stack: Python, Playwright.
13. Result Watchers, bots that watch university admission pages and a logged-in
   applicant portal, and alert by email/iMessage the moment results publish. Run
   free on GitHub Actions.
14. Gaming Mode, a one-click Mac app that frees memory before you play: it closes
   the apps you do not need, saves your browser tabs and opens a lean browser for
   your game; click again and everything comes back. Open source (MIT), version
   1.0.0 released 9 Oct 2026 at github.com/erfanulfarhan/gaming-mode.
15. DrJava for Mac, DrJava with Java 8 built in: a one-click download that is sharp
   on Retina, so students can compile and run Java right away. Build 2 released
   16 Oct 2026 at github.com/erfanulfarhan/drjava-mac, with a two-minute install
   video on YouTube.

CONTACT: the contact form on this page, email erfanul100@gmail.com, or GitHub
github.com/erfanulfarhan. You can also pass a message on yourself (see above).
`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "send_message_to_erfanul",
      description:
        "Emails the visitor's message to Erfanul, with their email as the reply address. Call it only when the visitor has given all three fields.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "The visitor's name, as they gave it." },
          email: { type: "string", description: "The email address the visitor typed, for Erfanul's reply." },
          message: {
            type: "string",
            description:
              "What the visitor wants Erfanul to know: the request or question, with any details they gave (project, budget, timeline, links).",
          },
        },
        required: ["name", "email", "message"],
      },
    },
  },
];

async function complete(key, messages, { tools, toolChoice = "auto" } = {}) {
  // GPT OSS reasons before it answers, and the reasoning counts against max_tokens.
  // Low effort plus a roomier limit keeps a short answer from being cut to nothing.
  // If Groq ever rejects reasoning_effort, the request is retried without it. A
  // tool call the model garbles is retried once, then answered without tools.
  let reasoning = true;
  let withTools = Boolean(tools);
  let garbled = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const payload = { model: MODEL, messages, temperature: 0.6, max_tokens: 1500 };
    if (reasoning) payload.reasoning_effort = "low";
    if (withTools) {
      payload.tools = tools;
      payload.tool_choice = toolChoice;
    }
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) {
      const message = data?.choices?.[0]?.message ?? {};
      const text = (message.content ?? "").trim();
      const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      if (text || calls.length) return { text, calls };
      if (attempt < 2) continue; // an empty answer is usually a one-off
      throw new Error("The assistant came back without an answer. Ask again.");
    }
    const msg = data?.error?.message || `HTTP ${r.status}`;
    if (r.status === 400 && reasoning && /reasoning/i.test(msg)) { reasoning = false; continue; }
    if (r.status === 400 && withTools && (data?.error?.code === "tool_use_failed" || /tool/i.test(msg))) {
      if (++garbled > 1) withTools = false;
      continue;
    }
    const transient = r.status === 429 || r.status === 503 || /overload|high demand|try again/i.test(msg);
    if (transient && attempt < 2) { await new Promise((s) => setTimeout(s, 2000 * (attempt + 1))); continue; }
    throw new Error(msg);
  }
  throw new Error("busy");
}

// The tool itself. The model's arguments are checked before anything is sent:
// the reply address has to be one the visitor actually typed in this chat.
async function passMessageOn(rawArgs, { req, meta, past, question }) {
  let args;
  try {
    args = JSON.parse(rawArgs || "{}");
  } catch {
    return { sent: false, reason: "The details could not be read. Ask the visitor for them again." };
  }
  const name = String(args?.name ?? "").trim().slice(0, 70);
  const email = String(args?.email ?? "").trim();
  const note = String(args?.message ?? "").trim().slice(0, 3000);
  if (!name || !email || !note) {
    return { sent: false, reason: "A name, an email address and the message are all needed. Ask for whatever is missing." };
  }
  const typed = [...past.map((t) => t.q), question];
  if (!isEmail(email) || email.toLowerCase() === OWNER) {
    return { sent: false, reason: "That is not an email address Erfanul can reply to. Ask the visitor for theirs." };
  }
  if (!typed.join("\n").toLowerCase().includes(email.toLowerCase())) {
    return { sent: false, reason: "The visitor has not typed that email address in this chat. Ask them for it." };
  }
  if (past.filter((t) => t.m).length >= MAX_MESSAGES_PER_CHAT) {
    return { sent: false, reason: "Enough messages have gone to Erfanul from this chat. Suggest the contact form for anything more." };
  }

  const who = visitorDetails(req, meta);
  const html = frame(
    `${esc(name)} left you a message`,
    `Through the assistant on erfanul.me, ${when(Date.now())}. Reply to this email to answer them.`,
    `<div style="margin:0 0 20px;padding:14px 16px;border-left:3px solid #f6a453;background:#fbf6ee;white-space:pre-wrap">${esc(note)}</div>` +
      detailsTable(who, contactsIn(typed)) +
      `<h3 style="margin:24px 0 10px;font-size:15px">The chat so far</h3>` +
      conversationHtml(past, question),
    who.agent,
  );
  const sent = await mailOwner({
    from: "Portfolio assistant",
    subject: `${cut(name, 60)} left you a message on erfanul.me`,
    html,
    replyTo: { email, name },
  });
  return sent.ok
    ? { sent: true }
    : { sent: false, reason: "The email service failed. Suggest the contact form on this page or erfanul100@gmail.com." };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: "Server missing GROQ_API_KEY." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const { message = "", cid = "", turns = [], history = [], meta = {} } = body || {};
  const question = typeof message === "string" ? message.trim().slice(0, 2000) : "";
  if (!question) return res.status(400).json({ error: "Ask me something." });

  // Earlier turns: the signed ones the page sends back. A page loaded before
  // signing existed sends plain `history` instead, which is only used as context.
  const signed = isConversationId(cid);
  const past = signed ? verifiedTurns(cid, turns) : [];
  const context = past.length
    ? past.slice(-6).flatMap((t) => [{ role: "user", content: t.q }, { role: "assistant", content: t.a }])
    : (Array.isArray(history) ? history : []).slice(-6).map((h) => ({
        role: h?.role === "user" ? "user" : "assistant",
        content: String(h?.text ?? "").slice(0, 4000),
      }));
  const messages = [{ role: "system", content: PROFILE }, ...context, { role: "user", content: question }];

  try {
    let { text, calls } = await complete(key, messages, { tools: TOOLS });
    let sent = false;
    const call = calls.find((c) => c?.function?.name === "send_message_to_erfanul");
    if (call) {
      const result = await passMessageOn(call.function.arguments, { req, meta, past, question });
      sent = result.sent === true;
      const echo = { id: call.id, type: "function", function: { name: call.function.name, arguments: call.function.arguments } };
      messages.push(text ? { role: "assistant", content: text, tool_calls: [echo] } : { role: "assistant", tool_calls: [echo] });
      messages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: JSON.stringify(result) });
      text = (await complete(key, messages, { tools: TOOLS, toolChoice: "none" }).catch(() => ({ text: "" }))).text;
      if (!text) {
        text = sent
          ? "Done. Your message is on its way to Erfanul, who will reply by email."
          : "I couldn't send that just now. The contact form on this page reaches Erfanul too.";
      }
    }
    if (!text) throw new Error("The assistant came back without an answer. Ask again.");

    const next = past.length ? past[past.length - 1].i + 1 : 0;
    const turn = signed ? signTurn(cid, { i: next, q: question, a: text, t: Date.now(), m: sent ? 1 : 0 }) : undefined;
    return res.status(200).json({ text, sent, turn });
  } catch (e) {
    const rl = /quota|rate|429|overload|busy/i.test(String(e.message));
    const empty = /without an answer/.test(String(e.message));
    return res.status(rl ? 429 : 502).json({
      error: rl ? "I'm a bit busy right now, try again in a few seconds." : empty ? e.message : `Error: ${e.message}`,
    });
  }
}
