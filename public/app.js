/* Portfolio interactions: typed tagline, scroll reveal, count-up stats,
   card tilt/glow, and the Gemini "ask about my work" chat. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

$("#yr").textContent = new Date().getFullYear();

// ---- typed tagline ----
const roles = ["AI & Automation Developer", "I build AI web apps", "I automate the boring stuff", "Bots · Scrapers · Assistants"];
let ri = 0, ci = 0, deleting = false;
(function type() {
  const el = $("#typed"), full = roles[ri];
  el.textContent = full.slice(0, ci);
  if (!deleting && ci < full.length) ci++;
  else if (deleting && ci > 0) ci--;
  else if (!deleting && ci === full.length) { deleting = true; return setTimeout(type, 1600); }
  else { deleting = false; ri = (ri + 1) % roles.length; }
  setTimeout(type, deleting ? 40 : 75);
})();

// ---- projects ----
const projects = [
  {
    name: "StudyBuddy", live: "https://studybuddy-ai-pi.vercel.app",
    repo: "https://github.com/erfanulfarhan/studybuddy-ai",
    desc: "An AI study companion — drop a PDF or paste notes to get instant summaries, grounded Q&A, and auto-generated interactive quizzes.",
    tags: ["Gemini", "Vercel", "pdf.js", "Vanilla JS"], badge: "Live",
  },
  {
    name: "Cineplex Automation Platform", repo: "https://github.com/erfanulfarhan/cineplex-bot",
    desc: "A Telegram bot + public web app that track cinema seat availability in real time, render seat maps, and auto-book tickets the moment they go on sale.",
    tags: ["Python", "Playwright", "aiohttp", "Telegram"],
  },
  {
    name: "Result Watchers", repo: "https://github.com/erfanulfarhan/bracu-result-watch",
    desc: "Bots that watch university result pages (and a logged-in applicant portal) and alert by email/iMessage the instant results publish. Run free on GitHub Actions.",
    tags: ["Python", "Playwright", "GitHub Actions", "Automation"],
  },
  {
    name: "Doomsday Tracker", repo: "https://github.com/erfanulfarhan/doomsday-tracker",
    desc: "A polished, offline-capable watch-list web app — no backend, add-to-home-screen, all in vanilla JS.",
    tags: ["JavaScript", "PWA", "HTML/CSS"],
  },
];
$("#cards").innerHTML = projects.map((p) => `
  <article class="pcard reveal">
    <h3>${p.name}</h3>
    ${p.badge ? `<div class="live"><span class="dot"></span>Live demo</div>` : ""}
    <p>${p.desc}</p>
    <div class="tags">${p.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
    <div class="plinks">
      ${p.live ? `<a href="${p.live}" target="_blank" rel="noopener">↗ Live demo</a>` : ""}
      <a href="${p.repo}" target="_blank" rel="noopener">⌥ Code</a>
    </div>
  </article>`).join("");

// card glow-follow + tilt
$$(".pcard").forEach((c) => {
  c.addEventListener("mousemove", (e) => {
    const r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    c.style.setProperty("--mx", x + "px"); c.style.setProperty("--my", y + "px");
    c.style.transform = `translateY(-4px) rotateX(${(y / r.height - .5) * -5}deg) rotateY(${(x / r.width - .5) * 5}deg)`;
  });
  c.addEventListener("mouseleave", () => (c.style.transform = ""));
});

// ---- skills ----
const skills = ["Python", "JavaScript", "Gemini", "OpenAI", "Anthropic", "Playwright",
  "Vercel / Serverless", "aiohttp", "REST APIs", "Telegram Bots", "Web Scraping",
  "HTML / CSS", "Git & GitHub", "TTS / STT"];
$("#chips").innerHTML = skills.map((s) => `<span class="chip reveal">${s}</span>`).join("");

// ---- scroll reveal ----
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}), { threshold: 0.14 });
$$(".reveal").forEach((el, i) => { el.style.transitionDelay = (i % 6) * 60 + "ms"; io.observe(el); });

// ---- count-up stats ----
const cio = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return; cio.unobserve(e.target);
  const el = e.target, target = +el.dataset.count; let n = 0;
  const step = () => { n += Math.ceil(target / 22); if (n >= target) n = target; el.textContent = n; if (n < target) requestAnimationFrame(step); };
  step();
}), { threshold: 0.6 });
$$("[data-count]").forEach((el) => cio.observe(el));

// ---- AI chat ----
const panel = $("#chatPanel"), msgs = $("#msgs");
const history = [];
const add = (role, text) => {
  const d = document.createElement("div");
  d.className = "m " + (role === "user" ? "u" : "a");
  d.textContent = text; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  return d;
};
$("#chatBtn").onclick = () => {
  panel.classList.toggle("open");
  if (panel.classList.contains("open") && !msgs.childElementCount) {
    add("a", "Hi! I'm Erfanul's assistant. Ask me about his projects, skills, or what he can build for you.");
  }
};
$("#chatClose").onclick = () => panel.classList.remove("open");

const suggestions = ["What can Erfanul build for me?", "Tell me about StudyBuddy", "What's his tech stack?"];
$("#sugg").innerHTML = suggestions.map((s) => `<button>${s}</button>`).join("");
$$("#sugg button").forEach((b) => (b.onclick = () => { $("#cin").value = b.textContent; send(); }));

async function send() {
  const input = $("#cin"), text = input.value.trim();
  if (!text) return;
  input.value = ""; add("user", text); history.push({ role: "user", text });
  const thinking = add("assistant", "…");
  try {
    const r = await fetch("/api/chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: text, history: history.slice(0, -1) }),
    });
    const d = await r.json();
    thinking.textContent = r.ok ? d.text : "⚠️ " + (d.error || "Something went wrong.");
    if (r.ok) history.push({ role: "assistant", text: d.text });
  } catch { thinking.textContent = "⚠️ Network error — try again."; }
}
$("#csend").onclick = send;
$("#cin").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
