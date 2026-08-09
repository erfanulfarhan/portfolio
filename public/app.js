/* Immersive portfolio — Three.js 3D hero, Web-Audio sound design, a hover-tilt
   sound carousel, scroll reveals, and the Groq-powered "ask my work" chat.
   Everything degrades gracefully (no WebGL → static hero; reduced-motion → calm). */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import anime from 'https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.es.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
$('#yr').textContent = new Date().getFullYear();

/* ============================ SOUND ============================ */
let AC = null, master = null, soundOn = false, lastHover = 0;
function initAudio() {
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain(); master.gain.value = 0.16; master.connect(AC.destination);
}
function tone(freq, dur, type = 'sine', vol = 0.5) {
  if (!soundOn || !AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(vol, AC.currentTime + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g); g.connect(master); o.start(); o.stop(AC.currentTime + dur + 0.02);
}
function whoosh() {
  if (!soundOn || !AC) return;
  const n = AC.sampleRate * 0.22, buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = AC.createBufferSource(); src.buffer = buf;
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.setValueAtTime(500, AC.currentTime);
  bp.frequency.exponentialRampToValueAtTime(2600, AC.currentTime + 0.18);
  const g = AC.createGain(); g.gain.value = 0.5;
  src.connect(bp); bp.connect(g); g.connect(master); src.start();
}
const sfx = {
  hover() { const t = performance.now(); if (t - lastHover < 60) return; lastHover = t; tone(1100, 0.06, 'sine', 0.25); },
  nav() { whoosh(); },
  click() { tone(520, 0.1, 'triangle', 0.4); },
  open() { tone(660, 0.08, 'sine', 0.35); tone(990, 0.12, 'sine', 0.25); },
};
const soundBtn = $('#soundBtn');
soundBtn.onclick = () => {
  initAudio(); if (AC.state === 'suspended') AC.resume();
  soundOn = !soundOn;
  soundBtn.classList.toggle('on', soundOn);
  soundBtn.querySelector('span').textContent = soundOn ? 'Sound on' : 'Sound';
  soundBtn.firstChild.textContent = soundOn ? '🔊 ' : '🔇 ';
  if (soundOn) sfx.open();
};
// browsers require a gesture before audio; resume on first interaction
addEventListener('pointerdown', () => { if (AC && AC.state === 'suspended') AC.resume(); }, { once: true });

/* ============================ 3D HERO ============================ */
function hero3d() {
  const canvas = $('#gl');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch (e) { canvas.style.display = 'none'; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100); cam.position.z = 5.2;

  // fibonacci-sphere point cloud with a colour gradient
  const N = reduce ? 900 : 2600, R = 2.25;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const cA = new THREE.Color('#6366f1'), cB = new THREE.Color('#a855f7'), cC = new THREE.Color('#22d3ee');
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    pos[i * 3] = Math.cos(th) * r * R; pos[i * 3 + 1] = y * R; pos[i * 3 + 2] = Math.sin(th) * r * R;
    const c = (y + 1) / 2 < 0.5 ? cA.clone().lerp(cB, (y + 1)) : cB.clone().lerp(cC, y);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  const group = new THREE.Group(); group.add(pts); scene.add(group);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => { mouse.tx = (e.clientX / innerWidth - 0.5); mouse.ty = (e.clientY / innerHeight - 0.5); });
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);

  let t = 0;
  (function loop() {
    t += 0.003;
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
    group.rotation.y += 0.0016 + mouse.x * 0.02;
    group.rotation.x += (mouse.y * 0.5 - group.rotation.x) * 0.05;
    pts.material.size = 0.032 + Math.sin(t * 2) * 0.004;
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  })();
}
try { hero3d(); } catch (e) { $('#gl').style.display = 'none'; }

/* ============================ HERO TEXT ============================ */
(function heroText() {
  const name = 'Erfanul Hakim Farhan';
  $('#title').innerHTML = name.split('').map((c) => c === ' ' ? '<span class="l">&nbsp;</span>' : `<span class="l">${c}</span>`).join('');
  if (reduce) { $$('#title .l, #hello, #role, #lead, #cta').forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; }); return; }
  anime.timeline({ easing: 'easeOutExpo' })
    .add({ targets: '#hello', opacity: [0, 1], translateY: [12, 0], duration: 600 })
    .add({ targets: '#title .l', opacity: [0, 1], translateY: [40, 0], rotate: [6, 0], duration: 900, delay: anime.stagger(28) }, '-=300')
    .add({ targets: '#role', opacity: [0, 1], translateY: [12, 0], duration: 600 }, '-=500')
    .add({ targets: '#lead', opacity: [0, 1], translateY: [12, 0], duration: 600 }, '-=350')
    .add({ targets: '#cta', opacity: [0, 1], translateY: [12, 0], duration: 600 }, '-=350');
})();

// typed role
const roles = ['I build AI web apps', 'RAG & embeddings', 'Automation that acts', 'Shipped live, end to end'];
(function type() {
  const el = $('#role'); let ri = 0, ci = 0, del = false;
  (function step() {
    const full = roles[ri]; el.textContent = full.slice(0, ci);
    if (!del && ci < full.length) ci++;
    else if (del && ci > 0) ci--;
    else if (!del && ci === full.length) { del = true; return setTimeout(step, 1500); }
    else { del = false; ri = (ri + 1) % roles.length; }
    setTimeout(step, del ? 35 : 70);
  })();
})();

/* ============================ CAROUSEL ============================ */
const projects = [
  { name: 'SiteSage', live: 'https://sitesage-erfanul.vercel.app', repo: 'https://github.com/erfanulfarhan/sitesage', live_badge: true,
    desc: 'An embeddable AI chat widget for any website — create a bot, train it on text or web pages, and drop it in with one line of code. Multi-tenant, with a config dashboard.', tags: ['Multi-tenant', 'Widget', 'Postgres FTS', 'Groq'] },
  { name: 'Ask My Docs', live: 'https://ask-my-docs-erfanul.vercel.app', repo: 'https://github.com/erfanulfarhan/ask-my-docs', live_badge: true,
    desc: 'A RAG knowledge base — ask questions and get answers with citations to the exact source passage. Semantic vector search; embeddings run in the browser.', tags: ['RAG', 'pgvector', 'Embeddings', 'Groq'] },
  { name: 'StudyBuddy', live: 'https://studybuddy-ai-pi.vercel.app', repo: 'https://github.com/erfanulfarhan/studybuddy-ai', live_badge: true,
    desc: 'An AI study companion — drop a PDF or paste notes for instant summaries, grounded Q&A, and auto-generated interactive quizzes.', tags: ['AI', 'Vercel', 'pdf.js', 'Vanilla JS'] },
  { name: 'Doomsday Tracker', live: 'https://doomsday-tracker-erfanul.vercel.app', repo: 'https://github.com/erfanulfarhan/doomsday-tracker', live_badge: true,
    desc: 'A cinematic watch-tracker: accounts with cloud-synced progress, a private leaderboard, live stats charts, and an interactive animated UI.', tags: ['Supabase', 'Auth', 'Charts', 'Animation'] },
  { name: 'Cineplex Automation', live: 'https://amigo-blurred-imaging.ngrok-free.dev', repo: 'https://github.com/erfanulfarhan/cineplex-bot',
    desc: 'A Telegram bot + public web app that track cinema seat availability in real time, render seat maps, and auto-book tickets the moment they go on sale.', tags: ['Python', 'Playwright', 'aiohttp', 'Telegram'] },
  { name: 'Result Watchers', repo: 'https://github.com/erfanulfarhan/bracu-result-watch',
    desc: 'Bots that watch university result pages and a logged-in applicant portal, alerting by email/iMessage the instant results publish. Free on GitHub Actions.', tags: ['Python', 'Playwright', 'GitHub Actions'] },
];
const track = $('#track');
track.innerHTML = projects.map((p, i) => `
  <article class="pcard">
    <span class="num">${String(i + 1).padStart(2, '0')}</span>
    ${p.live_badge ? '<span class="live"><span class="dot"></span>Live</span>' : ''}
    <h3>${p.name}</h3>
    <p>${p.desc}</p>
    <div class="tags">${p.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
    <div class="plinks">
      ${p.live ? `<a href="${p.live}" target="_blank" rel="noopener">↗ Live</a>` : ''}
      ${p.repo ? `<a href="${p.repo}" target="_blank" rel="noopener">⌥ Code</a>` : ''}
    </div>
  </article>`).join('');

$$('.pcard').forEach((card) => {
  card.addEventListener('mouseenter', () => sfx.hover());
  card.addEventListener('mousemove', (e) => {
    const r = card.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    card.style.setProperty('--mx', x + 'px'); card.style.setProperty('--my', y + 'px');
    if (!reduce) card.style.transform = `translateY(-6px) rotateX(${(y / r.height - 0.5) * -8}deg) rotateY(${(x / r.width - 0.5) * 10}deg) translateZ(20px)`;
  });
  card.addEventListener('mouseleave', () => (card.style.transform = ''));
});
function scrollByCard(dir) {
  const card = $('.pcard'); if (!card) return;
  track.scrollBy({ left: dir * (card.offsetWidth + 20), behavior: 'smooth' });
  sfx.nav();
}
$('#next').onclick = () => scrollByCard(1);
$('#prev').onclick = () => scrollByCard(-1);
// drag to scroll
let down = false, sx = 0, sl = 0;
track.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sl = track.scrollLeft; track.setPointerCapture(e.pointerId); });
track.addEventListener('pointermove', (e) => { if (down) track.scrollLeft = sl - (e.clientX - sx); });
track.addEventListener('pointerup', () => (down = false));

/* ============================ SCROLL REVEAL + STATS + CHIPS ============================ */
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.15 });
$$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 5) * 60 + 'ms'; io.observe(el); });

const cio = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return; cio.unobserve(e.target);
  const el = e.target, target = +el.dataset.count; let n = 0;
  const step = () => { n += Math.ceil(target / 26); if (n >= target) n = target; el.textContent = n; if (n < target) requestAnimationFrame(step); };
  step();
}), { threshold: 0.6 });
$$('[data-count]').forEach((el) => cio.observe(el));

$('#chips').innerHTML = ['Python', 'JavaScript', 'Groq', 'RAG / Embeddings', 'Supabase', 'pgvector', 'Playwright', 'Three.js', 'Vercel', 'REST APIs', 'Telegram Bots', 'Automation']
  .map((s) => `<span class="chip">${s}</span>`).join('');

// smooth-scroll CTA
$$('[data-scroll]').forEach((b) => (b.onclick = () => { sfx.click(); $(b.dataset.scroll).scrollIntoView({ behavior: 'smooth' }); }));

/* ============================ CHAT ============================ */
const panel = $('#chatPanel'), msgs = $('#msgs'), history = [];
const add = (role, text) => { const d = document.createElement('div'); d.className = 'm ' + (role === 'user' ? 'u' : 'a'); d.textContent = text; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; };
$('#chatBtn').onclick = () => {
  panel.classList.toggle('open'); sfx.click();
  if (panel.classList.contains('open') && !msgs.childElementCount) add('a', "Hi! I'm Erfanul's assistant. Ask me about his projects, skills, or what he can build for you.");
};
$('#chatClose').onclick = () => panel.classList.remove('open');
$('#sugg').innerHTML = ['What can Erfanul build for me?', 'Tell me about SiteSage', "What's his tech stack?"].map((s) => `<button>${s}</button>`).join('');
$$('#sugg button').forEach((b) => (b.onclick = () => { $('#cin').value = b.textContent; send(); }));
async function send() {
  const input = $('#cin'), text = input.value.trim(); if (!text) return;
  input.value = ''; add('user', text); history.push({ role: 'user', text });
  const think = add('assistant', '…');
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: text, history: history.slice(0, -1) }) });
    const d = await r.json();
    think.textContent = r.ok ? d.text : '⚠️ ' + (d.error || 'Something went wrong.');
    if (r.ok) history.push({ role: 'assistant', text: d.text });
  } catch { think.textContent = '⚠️ Network error — try again.'; }
}
$('#csend').onclick = send;
$('#cin').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
