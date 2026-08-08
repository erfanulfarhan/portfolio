// Vercel serverless function — the "ask about my work" chat for the portfolio.
// Gemini answers as Erfanul's assistant, grounded in the profile below. Key
// stays server-side.

const MODEL = "gemini-flash-latest";
const ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const PROFILE = `
You are the friendly AI assistant on Erfanul Hakim Farhan's developer portfolio.
Answer visitors' questions about Erfanul concisely (1–4 sentences), in a warm,
confident tone. If asked something you don't know, say so and point them to the
contact section. Never invent facts beyond this profile.

ABOUT
- Name: Erfanul Hakim Farhan. Role: AI & Automation Developer.
- Builds practical, reliable tools: AI-powered web apps, automation bots, and
  systems that watch, alert, and act. Available for freelance work.

SKILLS
- Languages: Python, JavaScript.
- AI / LLMs: Google Gemini, OpenAI, Anthropic — building assistants, RAG-style
  Q&A, and content generation into real products.
- Automation: Playwright browser automation, scheduled jobs, web scraping.
- Web: serverless (Vercel), aiohttp, REST APIs, HTML/CSS/JS front-ends.
- Bots & messaging: Telegram bots, email/iMessage notifications, TTS/STT voice.

PROJECTS
1. StudyBuddy — an AI study companion. Drop a PDF or paste notes to get instant
   summaries, grounded Q&A, and auto-generated interactive quizzes. Live demo at
   studybuddy-ai-pi.vercel.app. Stack: vanilla JS, Vercel serverless, Gemini,
   in-browser PDF parsing.
2. Cineplex Automation Platform — a Telegram bot plus a public web app that
   track Star Cineplex seat availability in real time, render seat maps, and can
   book tickets automatically the moment they go on sale ("standing orders").
   Stack: Python, Playwright, aiohttp.
3. Result Watchers — bots that watch BRAC University and NSU admission pages and
   a logged-in applicant portal, and alert by email/iMessage the moment results
   publish. Handle Cloudflare challenges; run free on GitHub Actions.
4. JARVIS — an offline-first voice assistant (wake word, local speech
   recognition, a Gemini brain, even clap-to-launch), with a natural neural
   voice.
5. Doomsday Tracker — a polished offline-capable web app for tracking a watch
   list, no backend.

CONTACT: via the Contact section / GitHub github.com/erfanulfarhan.
`;

async function callGemini(key, message, history) {
  const contents = [];
  for (const h of (history || []).slice(-6)) {
    contents.push({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] });
  }
  contents.push({ role: "user", parts: [{ text: message }] });

  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROFILE }] },
        contents,
        generationConfig: { maxOutputTokens: 600, temperature: 0.6 },
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const msg = data?.error?.message || `HTTP ${r.status}`;
    const transient = r.status === 429 || r.status === 503 || /overload|high demand|try again/i.test(msg);
    if (transient && attempt < 2) { await new Promise((s) => setTimeout(s, 2000 * (attempt + 1))); continue; }
    throw new Error(msg);
  }
  throw new Error("busy");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "Server missing GEMINI_API_KEY." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const { message = "", history = [] } = body || {};
  if (!message.trim()) return res.status(400).json({ error: "Ask me something." });

  try {
    return res.status(200).json({ text: (await callGemini(key, message, history)).trim() });
  } catch (e) {
    const rl = /quota|rate|429|overload|busy/i.test(String(e.message));
    return res.status(rl ? 429 : 502).json({
      error: rl ? "I'm a bit busy right now — try again in a few seconds." : `Error: ${e.message}`,
    });
  }
}
