// Vercel serverless function, the "ask about my work" chat for the portfolio.
// Groq (OpenAI-compatible) answers as Erfanul's assistant, grounded in the
// profile below. The key stays server-side.

const MODEL = "llama-3.3-70b-versatile";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const PROFILE = `
You are the friendly AI assistant on Erfanul Hakim Farhan's developer portfolio.
Answer visitors' questions about Erfanul concisely (1 to 4 sentences), in a warm,
confident tone. If asked something you don't know, say so and point them to the
contact section. Never invent facts beyond this profile.
Never use long dashes of any kind. Use commas, periods, or colons instead.

ABOUT
- Name: Erfanul Hakim Farhan. Role: AI & Automation Developer.
- Builds practical, reliable tools: AI-powered web apps, automation bots, and
  systems that watch, alert, and act. Available for freelance work.

SKILLS
- Languages: Python, JavaScript.
- AI / LLMs: Google Gemini, OpenAI, Anthropic, Groq, building assistants,
  RAG-style Q&A, and content generation into real products.
- Automation: Playwright browser automation, scheduled jobs, web scraping.
- Web: serverless (Vercel), aiohttp, REST APIs, HTML/CSS/JS front-ends.
- Bots & messaging: Telegram bots, email/iMessage notifications, TTS/STT voice.

PROJECTS
1. Friday, a voice-first AI assistant you talk to and it talks back. Audio-reactive
   orb, speech-to-text via Groq Whisper and browser speech synthesis, a Motion-animated
   UI, and a Groq (Llama 3.3 70B) brain. Built with React + Tailwind + shadcn/ui.
   Live at friday-erfanul.vercel.app.
2. SiteSage, an embeddable AI chat widget for ANY website. Create a bot in a
   dashboard, train it on pasted text or web pages, and drop it in with one line
   of code. Multi-tenant; retrieval via Postgres full-text search; answers by
   Groq. Live at sitesage-erfanul.vercel.app.
3. Ask My Docs, a retrieval-augmented (RAG) knowledge base. Upload a PDF or
   paste notes, then ask questions and get answers WITH citations to the exact
   source passage. Semantic vector search with Supabase pgvector; embeddings run
   in the browser. Live at ask-my-docs-erfanul.vercel.app.
4. StudyBuddy, an AI study companion. Drop a PDF or paste notes to get instant
   summaries, grounded Q&A, and auto-generated interactive quizzes. Live at
   studybuddy-ai-pi.vercel.app.
5. Doomsday Tracker, a cinematic watch-tracker with accounts, cloud-synced
   progress, a private friends-and-family leaderboard, live stats charts, and an
   interactive animated UI. Live at doomsday-tracker-erfanul.vercel.app.
6. Cineplex Automation Platform, a Telegram bot plus a public web app that
   track cinema seat availability in real time, render seat maps, and can book
   tickets automatically the moment they go on sale. Stack: Python, Playwright.
7. Result Watchers, bots that watch university admission pages and a logged-in
   applicant portal, and alert by email/iMessage the moment results publish. Run
   free on GitHub Actions.

CONTACT: via the Contact section / GitHub github.com/erfanulfarhan.
`;

async function callGroq(key, message, history) {
  const messages = [{ role: "system", content: PROFILE }];
  for (const h of (history || []).slice(-6)) {
    messages.push({ role: h.role === "user" ? "user" : "assistant", content: h.text });
  }
  messages.push({ role: "user", content: message });

  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.6, max_tokens: 600 }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) return data?.choices?.[0]?.message?.content ?? "";
    const msg = data?.error?.message || `HTTP ${r.status}`;
    const transient = r.status === 429 || r.status === 503 || /overload|high demand|try again/i.test(msg);
    if (transient && attempt < 2) { await new Promise((s) => setTimeout(s, 2000 * (attempt + 1))); continue; }
    throw new Error(msg);
  }
  throw new Error("busy");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: "Server missing GROQ_API_KEY." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const { message = "", history = [] } = body || {};
  if (!message.trim()) return res.status(400).json({ error: "Ask me something." });

  try {
    return res.status(200).json({ text: (await callGroq(key, message, history)).trim() });
  } catch (e) {
    const rl = /quota|rate|429|overload|busy/i.test(String(e.message));
    return res.status(rl ? 429 : 502).json({
      error: rl ? "I'm a bit busy right now, try again in a few seconds." : `Error: ${e.message}`,
    });
  }
}
