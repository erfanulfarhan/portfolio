# Erfanul Farhan — Portfolio

A dark, animated personal portfolio for an **AI &amp; Automation Developer**, with a
**Gemini-powered "ask about my work" chat** that answers visitors' questions
about my projects and skills.

**Live:** _deploying to Vercel — link here._

## Highlights
- Animated hero (aurora blurs, grid, typewriter tagline), scroll-reveal, count-up
  stats, and project cards that tilt and glow on hover — all vanilla JS/CSS.
- **AI assistant** — a serverless function (`/api/chat`) proxies Google Gemini
  with a profile of my work; the API key stays server-side.
- Fully responsive, no framework, no build step.

## Tech
Vanilla HTML/CSS/JS · Vercel serverless · Google Gemini · zero dependencies.

## Run locally
```sh
export GEMINI_API_KEY="your-key"   # https://aistudio.google.com/app/apikey
node server.js                     # http://localhost:3001
```

## Deploy
Push to GitHub, import on [vercel.com](https://vercel.com), add env var
`GEMINI_API_KEY`, deploy. Static `public/` + the `api/chat.js` function, wired
in `vercel.json`.

---
Built by Erfanul Farhan · [github.com/erfanulfarhan](https://github.com/erfanulfarhan)
