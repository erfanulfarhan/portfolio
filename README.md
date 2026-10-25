# Erfanul Hakim Farhan, portfolio

The site at **https://erfanul.me**. The page is a voyage: it opens on a black
hole, falls into it, and comes out among the work.

## What happens on the page

- **Intro.** The EHF mark acquires focus, the brackets lock on, and a
  seven-blade aperture opens onto the sky.
- **Display.** Corner brackets frame the screen, with a mission clock, a counter
  for the current section and a Sound switch. On a mouse, a reticle trails the
  pointer and locks onto anything you can click.
- **Hero.** A black hole beside the name, traced on the GPU: light bends around
  it, the disk swirls, and the stars behind it are lensed. It swings into place
  as the intro opens. Scrolling glides it to the middle and falls in until the
  horizon fills the screen.
- **Observations.** Five projects on a strip that pans sideways as you scroll,
  each playing a short recording of the app being used. Below it, the catalogue:
  all fifteen projects, numbered, with the live ones tagged.
- **whoami.** An editor window: an explorer, three files to flick between, the
  first one typing itself out, and a terminal with the numbers.
- **Services.** What I build, as the stops on a star wheel that turns as you
  scroll.
- **Mission log.** Releases and launch days from GitHub on a git graph that
  draws itself, with a steady preview of the release you point at.
- **Contact.** A form whose send button sends a transmission across the page,
  an assistant that answers questions about the work, and an EHF that lights up
  under the pointer.

Smooth scrolling is Lenis and the scroll scenes are GSAP ScrollTrigger. The
black hole is one WebGL2 fragment shader (`src/components/hero/`), loaded on
its own while the intro runs. It times itself once while the intro still covers
the page and renders as sharp as the GPU allows, falling back to a still
picture where WebGL is missing or too slow. Menu links land where a section's
text is already fully shown, and a scene that cannot fit on a short screen does
not pin; it shows its content plainly instead.

With reduced motion turned on (by the system, or the switch in the footer) the
page is still: no pinning, no smooth scroll, a single frame of the black hole
and screenshots in place of the recordings.

The background music is `public/audio/soundtrack.m4a`, played through Web Audio
with fades (`src/lib/soundtrack.ts`). It is off until the Sound switch is pressed,
and only downloads then.

## Stack

Vite, React, TypeScript, Tailwind CSS 4, GSAP, Lenis and WebGL2. Two Vercel
functions in `api/`: `chat.js` (Groq) and `contact.js` (Brevo).

## Run it

```sh
npm install
cp .env.example .env   # optional: add GROQ_API_KEY and BREVO_API_KEY
npm run dev            # http://localhost:5173, with /api served by Vite
```

`npm run check` type-checks and builds. Without keys the page works and the
chat and form explain that they are not configured.

## Changing the content

Projects, releases, services and skills live in `src/data/site.ts`. The chat
answers from its own profile in `api/chat.js`, so update both when a project
changes. Screenshots go in `public/work/` in the sizes listed at the top of
`site.ts`, and recordings in `public/work/demo/` (MP4, 3:2, 1920 and 1280 wide,
with a poster).

## Deploy

Pushing to `main` deploys to Vercel. `vercel.json` sets the Vite build, and
`GROQ_API_KEY` and `BREVO_API_KEY` are project environment variables.
