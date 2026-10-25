// Everything the page says about the work lives here. The AI chat answers from
// its own copy of this in api/chat.js, so a project change goes in both places.

/** A screenshot in several widths; the browser downloads the one its screen needs. */
export type Picture = { src: string; srcSet: string; width: number; height: number };

/** A short muted loop of the live project being used, at 1920 and 1280 wide (3:2). */
export type Demo = { video: string; small: string; poster: string };

export type Project = {
  slug: string;
  name: string;
  kind: string;
  /** One line for the strip of selected work. */
  summary: string;
  description: string;
  tags: string[];
  links: { live?: string; site?: string; download?: string; video?: string; repo?: string };
  /** Portrait phone screenshot, used in the catalogue. */
  tall?: Picture;
  /** Landscape desktop screenshot, used on the strip and in the dialog. */
  wide?: Picture;
  /** Position on the strip, if it is one of the selected five. */
  reel?: number;
  /** A recording of it in use, played on the strip and in the dialog. */
  demo?: Demo;
};

const sizes = (base: string, widths: number[]) => widths.map((w) => `/work/${base}-${w}.webp ${w}w`).join(', ');
// Captured at 4K: desktop pages at 3840x2560, phone pages at 1560x2340.
const tall = (name: string): Picture => ({
  src: `/work/${name}-800.webp`,
  srcSet: sizes(name, [480, 800, 1170, 1560]),
  width: 1560,
  height: 2340,
});
const wide = (name: string): Picture => ({
  src: `/work/${name}-wide-1600.webp`,
  srcSet: sizes(`${name}-wide`, [480, 960, 1600, 2400, 3840]),
  width: 3840,
  height: 2560,
});
const demo = (name: string): Demo => ({
  video: `/work/demo/${name}-1920.mp4`,
  small: `/work/demo/${name}-1280.mp4`,
  poster: `/work/demo/${name}-poster.webp`,
});
const drjava: Picture = { src: '/work/drjava-1600.webp', srcSet: sizes('drjava', [480, 960, 1600, 2400, 3840]), width: 3840, height: 2160 };
const gamingMode: Picture = { src: '/work/gaming-mode-720.webp', srcSet: sizes('gaming-mode', [480, 720, 1024]), width: 1024, height: 1024 };

export const projects: Project[] = [
  {
    slug: 'delta',
    name: 'Delta',
    kind: 'Web app',
    summary: 'A speedtest built for Bangladesh that shows the gap between local and international internet.',
    description:
      'A speedtest built for Bangladesh. It measures both paths your connection has, local BDIX peering and real international bandwidth, and shows the gap between them. International tests run on open M-Lab servers in Singapore, Mumbai and Tokyo.',
    tags: ['TypeScript', 'Cloudflare Workers', 'Web Workers', 'M-Lab'],
    links: { live: 'https://deltaspeed.erfanul.me', repo: 'https://github.com/erfanulfarhan/delta' },
    tall: tall('delta'),
    wide: wide('delta'),
    demo: demo('delta'),
    reel: 1,
  },
  {
    slug: 'lens',
    name: 'Lens',
    kind: 'Desktop app',
    summary: 'A desktop AI assistant that reads your screen and answers from your own files, on your own machine.',
    description:
      'A desktop AI assistant that reads your screen and follows your calls, answering from your own documents. The model runs on your machine, so there is no subscription and nothing leaves your computer.',
    tags: ['Electron', 'Local LLM', 'Swift', 'RAG'],
    links: {
      site: 'https://getlens.pages.dev',
      download: 'https://github.com/erfanulfarhan/lens/releases',
      repo: 'https://github.com/erfanulfarhan/lens',
    },
    tall: tall('lens'),
    wide: wide('lens'),
    demo: demo('lens'),
    reel: 2,
  },
  {
    slug: 'friday',
    name: 'Friday',
    kind: 'Web app',
    summary: 'A voice-first AI assistant. You talk to it and it talks back.',
    description:
      'A voice-first AI assistant you talk to and it talks back. Audio-reactive orb, real-time speech recognition and synthesis, powered by GPT OSS 120B.',
    tags: ['React', 'Whisper STT', 'Motion', 'Groq'],
    links: { live: 'https://friday-erfanul.vercel.app', repo: 'https://github.com/erfanulfarhan/friday-voice' },
    tall: tall('friday'),
    wide: wide('friday'),
    demo: demo('friday'),
    reel: 3,
  },
  {
    slug: 'exam-toolkit',
    name: 'Exam Toolkit',
    kind: 'Web app',
    summary: 'Free revision tools for Edexcel IAL and IGCSE, built from every published grade boundary.',
    description:
      'Free revision tools for Edexcel International A Level and IGCSE: a UMS grade calculator built from every published boundary, past papers beside mark schemes, a mock timer and a study planner.',
    tags: ['TypeScript', 'React', 'Grade data'],
    links: { live: 'https://edexcel-grade-calc.vercel.app', repo: 'https://github.com/erfanulfarhan/exam-toolkit' },
    tall: tall('exam-toolkit'),
    wide: wide('exam-toolkit'),
    demo: demo('exam-toolkit'),
    reel: 4,
  },
  {
    slug: 'doomsday',
    name: 'Doomsday Tracker',
    kind: 'Web app',
    summary: 'A cinematic watch-tracker with accounts, a private leaderboard and live charts.',
    description:
      'A cinematic watch-tracker: accounts with cloud-synced progress, a private leaderboard, live charts and an animated UI.',
    tags: ['Supabase', 'Auth', 'Charts', 'Animation'],
    links: {
      live: 'https://doomsday-tracker-erfanul.vercel.app',
      repo: 'https://github.com/erfanulfarhan/doomsday-tracker',
    },
    tall: tall('doomsday'),
    wide: wide('doomsday'),
    demo: demo('doomsday'),
    reel: 5,
  },
  {
    slug: 'sitesage',
    name: 'SiteSage',
    kind: 'Web app',
    summary: 'An embeddable AI chat widget for any website.',
    description:
      'An embeddable AI chat widget for any website: create a bot, train it on text or web pages, and drop it in with one line of code. Multi-tenant.',
    tags: ['Multi-tenant', 'Widget', 'Postgres FTS', 'Groq'],
    links: { live: 'https://sitesage-erfanul.vercel.app', repo: 'https://github.com/erfanulfarhan/sitesage' },
    tall: tall('sitesage'),
    wide: wide('sitesage'),
  },
  {
    slug: 'ask-my-docs',
    name: 'Ask My Docs',
    kind: 'Web app',
    summary: 'A knowledge base that answers with citations to the exact passage.',
    description:
      'A RAG knowledge base that answers with citations to the exact source passage. Semantic vector search, with embeddings that run in the browser.',
    tags: ['RAG', 'pgvector', 'Embeddings', 'Groq'],
    links: { live: 'https://ask-my-docs-erfanul.vercel.app', repo: 'https://github.com/erfanulfarhan/ask-my-docs' },
    tall: tall('ask-my-docs'),
    wide: wide('ask-my-docs'),
  },
  {
    slug: 'slate',
    name: 'Slate',
    kind: 'Web app',
    summary: 'A file store with passwordless sign-in and links that expire.',
    description:
      'A file store with passwordless email sign-in. Drag and drop upload, browse by type, share by email. Download links are minted per request and expire, so a shared URL stops working instead of living forever.',
    tags: ['TypeScript', 'Next.js', 'Appwrite', 'Auth'],
    links: { live: 'https://store-it-psi-three.vercel.app', repo: 'https://github.com/erfanulfarhan/store-it' },
    tall: tall('slate'),
  },
  {
    slug: 'studybuddy',
    name: 'StudyBuddy',
    kind: 'Web app',
    summary: 'Summaries, answers and quizzes from a PDF or your notes.',
    description:
      'An AI study companion: instant summaries, grounded Q&A and auto-generated interactive quizzes from a PDF or your notes.',
    tags: ['AI', 'Vercel', 'pdf.js', 'Vanilla JS'],
    links: { live: 'https://studybuddy-ai-pi.vercel.app', repo: 'https://github.com/erfanulfarhan/studybuddy-ai' },
    tall: tall('studybuddy'),
    wide: wide('studybuddy'),
  },
  {
    slug: 'gaming-mode',
    name: 'Gaming Mode',
    kind: 'Mac app',
    summary: 'One click frees memory on your Mac before you play.',
    description:
      'One click frees up memory on your Mac before you play: it closes the apps you do not need, saves your browser tabs and opens a lean browser for your game. Click again and everything comes back.',
    tags: ['macOS', 'JavaScript for Automation', 'Swift'],
    links: {
      download: 'https://github.com/erfanulfarhan/gaming-mode/releases/latest',
      repo: 'https://github.com/erfanulfarhan/gaming-mode',
    },
    tall: gamingMode,
  },
  {
    slug: 'drjava-mac',
    name: 'DrJava for Mac',
    kind: 'Mac app',
    summary: 'DrJava with Java 8 built in, ready in one download.',
    description:
      'DrJava with Java 8 built in: a one-click download that is sharp on Retina, so you can compile and run Java right away. It comes with a two-minute install video.',
    tags: ['macOS', 'Java', 'Packaging'],
    links: {
      download: 'https://github.com/erfanulfarhan/drjava-mac/releases/latest',
      video: 'https://youtu.be/MBTZ_kf3ZDo',
      repo: 'https://github.com/erfanulfarhan/drjava-mac',
    },
    wide: drjava,
  },
  {
    slug: 'jarvis',
    name: 'JARVIS',
    kind: 'Mac app',
    summary: 'An offline-first voice assistant for macOS.',
    description:
      'An offline-first macOS voice assistant. Speech in, speech out, running locally so it keeps working without a connection.',
    tags: ['Python', 'macOS', 'Voice', 'Offline'],
    links: { repo: 'https://github.com/erfanulfarhan/Jarvis-by-Erfanul-Farhan' },
    tall: tall('jarvis'),
    wide: wide('jarvis'),
  },
  {
    slug: 'gazekit',
    name: 'GazeKit',
    kind: 'Mac tool',
    summary: 'Proves whether gaze correction is actually running.',
    description:
      "Calibrates and verifies gaze correction on macOS, measuring whether it actually works rather than taking the vendor's word for it.",
    tags: ['Python', 'macOS', 'Measurement'],
    links: { repo: 'https://github.com/erfanulfarhan/gazekit' },
    tall: tall('gazekit'),
    wide: wide('gazekit'),
  },
  {
    slug: 'cineplex',
    name: 'Cineplex Automation',
    kind: 'Bot',
    summary: 'Books cinema seats the moment they go on sale.',
    description:
      'A Telegram bot for Star Cineplex: live seat availability, seat-map images, and standing orders that book tickets the moment they go on sale.',
    tags: ['Python', 'Playwright', 'aiohttp', 'Telegram'],
    links: { repo: 'https://github.com/erfanulfarhan/cineplex-bot' },
    tall: tall('cineplex'),
    wide: wide('cineplex'),
  },
  {
    slug: 'result-watchers',
    name: 'Result Watchers',
    kind: 'Bot',
    summary: 'Alerts the instant university results are published.',
    description:
      'Bots that watch university result pages and a logged-in portal, alerting the instant results publish. They run free on GitHub Actions.',
    tags: ['Python', 'Playwright', 'GitHub Actions'],
    links: { repo: 'https://github.com/erfanulfarhan/bracu-result-watch' },
    tall: tall('result-watchers'),
    wide: wide('result-watchers'),
  },
];

export const isLive = (p: Project) => Boolean(p.links.live || p.links.site);
export const isShipped = (p: Project) => Boolean(p.links.live || p.links.site || p.links.download);
export const reel = projects.filter((p) => p.reel).sort((a, b) => (a.reel ?? 0) - (b.reel ?? 0));
export const findProject = (name: string) => projects.find((p) => p.name === name);

export const readouts = [
  { value: projects.filter(isShipped).length, unit: '', label: 'Shipped', note: 'Live on the web or ready to download' },
  { value: projects.length, unit: '', label: 'Built', note: 'From one-file bots to full-stack apps' },
  { value: 24, unit: 'h', label: 'Turnaround', note: 'From an idea to a live link' },
];

/** The same tools, grouped the way the About editor's skills.json shows them. */
export const skillGroups: [group: string, items: string[]][] = [
  ['languages', ['Python', 'TypeScript', 'JavaScript', 'Swift']],
  ['web', ['React', 'Next.js', 'Three.js', 'Vercel', 'Cloudflare Workers']],
  ['ai', ['Groq', 'RAG', 'pgvector', 'Embeddings']],
  ['data', ['Supabase', 'Appwrite', 'Postgres']],
  ['automation', ['Playwright', 'Telegram bots', 'GitHub Actions']],
  ['desktop', ['Electron', 'macOS']],
];

export const skills = [
  'Python',
  'TypeScript',
  'React',
  'Next.js',
  'Electron',
  'Swift',
  'Three.js',
  'Groq',
  'RAG',
  'pgvector',
  'Supabase',
  'Playwright',
  'Cloudflare Workers',
  'Vercel',
  'Telegram bots',
];

export type Mode = { code: string; title: string; line: string; examples: string[] };

/** What I build, as the stops on the Services star wheel. */
export const modes: Mode[] = [
  {
    code: 'AI',
    title: 'AI web apps and assistants',
    line: 'Chat and voice assistants that answer from what you give them.',
    examples: ['Friday', 'SiteSage', 'StudyBuddy'],
  },
  {
    code: 'RAG',
    title: 'Answers grounded in your documents',
    line: 'Search that cites the exact passage it used.',
    examples: ['Ask My Docs', 'Lens'],
  },
  {
    code: 'BOT',
    title: 'Bots that watch, alert and act',
    line: 'They check a page every few minutes and act the moment it changes.',
    examples: ['Cineplex Automation', 'Result Watchers'],
  },
  {
    code: 'APP',
    title: 'Full-stack apps with sign-in',
    line: 'Accounts, storage and data that sync, deployed and live.',
    examples: ['Slate', 'Doomsday Tracker'],
  },
  {
    code: 'MAC',
    title: 'Desktop apps for macOS and Windows',
    line: 'Installers people download and run, not just web pages.',
    examples: ['Lens', 'Gaming Mode', 'DrJava for Mac'],
  },
  {
    code: 'LAB',
    title: 'Tools that measure instead of guessing',
    line: 'When a number matters, measure it properly and show the gap.',
    examples: ['Delta', 'GazeKit'],
  },
];

export type Release = {
  tag: string;
  live?: boolean;
  title: string;
  date: string;
  dateTime: string;
  /** Finishes the sentence that starts with the date, e.g. "9 Oct 2026, for macOS". */
  where: string;
  href: string;
  image: Picture & { alt: string };
};

// Newest first. Versions and dates are the published GitHub releases and launch days.
export const releases: Release[] = [
  {
    tag: 'live',
    live: true,
    title: 'Delta moves to deltaspeed.erfanul.me',
    date: '22 Oct 2026',
    dateTime: '2026-10-22',
    where: 'on the web, with international tests on M-Lab',
    href: 'https://deltaspeed.erfanul.me',
    image: { ...wide('delta'), alt: 'Delta speedtest start screen' },
  },
  {
    tag: 'build-2',
    title: 'DrJava for Mac, build 2',
    date: '16 Oct 2026',
    dateTime: '2026-10-16',
    where: 'for macOS, with a two-minute install video',
    href: 'https://github.com/erfanulfarhan/drjava-mac/releases/tag/build-2',
    image: { ...drjava, alt: 'DrJava for Mac video thumbnail' },
  },
  {
    tag: 'v1.0.0',
    title: 'Gaming Mode 1.0',
    date: '9 Oct 2026',
    dateTime: '2026-10-09',
    where: 'for macOS',
    href: 'https://github.com/erfanulfarhan/gaming-mode/releases/tag/v1.0.0',
    image: { ...gamingMode, alt: 'Gaming Mode app icon' },
  },
  {
    tag: 'v0.1.5',
    title: 'Lens 0.1.5, the sixth release in four days',
    date: '21 Aug 2026',
    dateTime: '2026-08-21',
    where: 'for macOS and Windows',
    href: 'https://github.com/erfanulfarhan/lens/releases/tag/v0.1.5',
    image: { ...wide('lens'), alt: 'Lens website' },
  },
  {
    tag: 'v0.1.0',
    title: 'Lens 0.1.0, the first public build',
    date: '18 Aug 2026',
    dateTime: '2026-08-18',
    where: 'with macOS and Windows installers',
    href: 'https://github.com/erfanulfarhan/lens/releases/tag/v0.1.0',
    image: { ...wide('lens'), alt: 'Lens website' },
  },
  {
    tag: 'live',
    live: true,
    title: 'Exam Toolkit goes public under my name',
    date: '13 Aug 2026',
    dateTime: '2026-08-13',
    where: 'on the web',
    href: 'https://edexcel-grade-calc.vercel.app',
    image: { ...wide('exam-toolkit'), alt: 'Exam Toolkit home page' },
  },
];

export const contact = {
  email: 'erfanul100@gmail.com',
  github: 'https://github.com/erfanulfarhan',
};

export const footerLinks = [
  { name: 'GitHub', href: contact.github, external: true },
  { name: 'Email', href: `mailto:${contact.email}`, external: false },
  { name: 'Site source', href: 'https://github.com/erfanulfarhan/portfolio', external: true },
];

/** The sections, in order, for the menu and the frame counter. */
export const scenes = [
  { id: 'home', label: 'Home' },
  { id: 'work', label: 'Work' },
  { id: 'about', label: 'About' },
  { id: 'modes', label: 'Services' },
  { id: 'log', label: 'Log' },
  { id: 'contact', label: 'Contact' },
];
