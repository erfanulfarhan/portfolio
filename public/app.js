/* Immersive portfolio, optimized. Native smooth-scroll, sound-on-by-default,
   a depth-fogged Three.js orb that pauses when off-screen, masked reveals, an
   infinite marquee, a coverflow carousel (swipe + dots), and the Groq chat. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import anime from 'https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.es.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover:hover) and (pointer:fine)').matches;
const isMobile = innerWidth < 720;
$('#yr').textContent = new Date().getFullYear();
// always land at the top on reload (don't restore prior scroll position)
if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
addEventListener('load', () => window.scrollTo(0, 0));

function goTo(sel) { const t = $(sel); if (t) t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }

/* ============ SOUND (on by default, armed on first gesture) ============ */
let AC = null, master = null, lp = null, reverbSend = null, soundOn = false, lastHover = 0;
function makeImpulse(dur, decay) {
  const rate = AC.sampleRate, len = Math.floor(rate * dur), buf = AC.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return buf;
}
function armAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
    lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.3; lp.connect(master);
    const conv = AC.createConvolver(); conv.buffer = makeImpulse(1.8, 2.4);
    const wet = AC.createGain(); wet.gain.value = 0.9; conv.connect(wet); wet.connect(master);
    reverbSend = AC.createGain(); reverbSend.gain.value = 0.35; reverbSend.connect(conv); lp.connect(reverbSend);
    soundOn = true;
  } catch (e) {}
}
addEventListener('pointerdown', armAudio, { once: true });
addEventListener('keydown', armAudio, { once: true });
// soft, warm sine "voice" with gentle attack + long release → premium, spacious with reverb
function voice(freq, dur, vol) {
  if (!soundOn || !AC) return;
  const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(lp); o.start(t); o.stop(t + dur + 0.05);
}
const sfx = {
  hover() { const t = performance.now(); if (t - lastHover < 220) return; lastHover = t; voice(329.63, 0.8, 0.03); },
  click() { voice(392, 0.95, 0.08); voice(587.33, 1.0, 0.04); },      // soft warm G4 + D5
  nav() { voice(329.63, 0.9, 0.05); voice(493.88, 0.95, 0.028); },    // gentle, soothing E4 + B4
};

/* ============ PRELOADER ============ */
function preloader(done) {
  const mono = $('#plMono'), line = $('#plline'), pct = $('#plpct');
  if (reduce) { $('#preload').classList.add('done'); done(); return; }
  let p = 0, loaded = document.readyState === 'complete';
  addEventListener('load', () => { loaded = true; });
  setTimeout(() => { loaded = true; }, 4500);        // safety, never hang
  const id = setInterval(() => {
    const cap = loaded ? 100 : 88;                    // ease toward 88 while loading, finish on real load
    p += (cap - p) * 0.06 + 0.5; if (p > cap) p = cap;
    mono.style.setProperty('--f', p.toFixed(1) + '%');
    mono.style.setProperty('--fg', (p / 100).toFixed(2));
    line.style.width = p + '%'; pct.textContent = Math.floor(p);
    if (loaded && p >= 99.4) {
      clearInterval(id);
      mono.style.setProperty('--f', '100%'); line.style.width = '100%'; pct.textContent = 100;
      setTimeout(() => { $('#preload').classList.add('done'); done(); }, 450);
    }
  }, 28);
}

/* ============ 3D ORB (fogged depth, pauses off-screen) ============ */
function hero3d() {
  const canvas = $('#gl'); let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { canvas.style.display = 'none'; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color('#080706'), 0.13);   // depth: far points fade to bg
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100); cam.position.z = 5.6;
  const group = new THREE.Group(); scene.add(group);

  const N = reduce ? 700 : (isMobile ? 1100 : 2000), R = 2.35;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const cA = new THREE.Color('#f7e6a6'), cB = new THREE.Color('#d4af37'), cC = new THREE.Color('#8a6a1f');
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    pos[i * 3] = Math.cos(th) * r * R; pos[i * 3 + 1] = y * R; pos[i * 3 + 2] = Math.sin(th) * r * R;
    const f = (y + 1) / 2, c = f < 0.5 ? cA.clone().lerp(cB, f * 2) : cB.clone().lerp(cC, (f - 0.5) * 2);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.038, vertexColors: true, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  group.add(pts);
  const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.4, 1)), new THREE.LineBasicMaterial({ color: 0xd4af37, transparent: true, opacity: .3, fog: true }));
  group.add(wire);

  const mo = { x: 0, y: 0, tx: 0, ty: 0 };
  if (finePointer) addEventListener('pointermove', (e) => { mo.tx = e.clientX / innerWidth - 0.5; mo.ty = e.clientY / innerHeight - 0.5; });
  function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe($('header'));
  let t = 0;
  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;                       // skip render when hero scrolled away
    t += 0.004; mo.x += (mo.tx - mo.x) * 0.04; mo.y += (mo.ty - mo.y) * 0.04;
    group.rotation.y += 0.0012 + mo.x * 0.015;
    group.rotation.x += (mo.y * 0.4 - group.rotation.x) * 0.04;
    const s = 1 + Math.sin(t * 1.4) * 0.03; group.scale.set(s, s, s);
    wire.rotation.y -= 0.0022;
    renderer.render(scene, cam);
  })();
}
try { hero3d(); } catch (e) { $('#gl').style.display = 'none'; }

/* ============ HERO TEXT (word-split so the name never breaks mid-word) ============ */
function heroText() {
  const words = 'Erfanul Hakim Farhan'.split(' ');
  $('#title').innerHTML = words.map((w) => `<span class="word">${w.split('').map((c) => `<span class="l">${c}</span>`).join('')}</span>`).join('');
  if (reduce) { $$('#title .l,#hello,#role,#lead,#cta').forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; }); return; }
  anime.timeline({ easing: 'easeOutExpo' })
    .add({ targets: '#hello', opacity: [0, 1], translateY: [12, 0], duration: 500 })
    .add({ targets: '#title .l', opacity: [0, 1], translateY: [48, 0], rotate: [8, 0], duration: 850, delay: anime.stagger(24) }, '-=250')
    .add({ targets: '#role', opacity: [0, 1], translateY: [12, 0], duration: 550 }, '-=500')
    .add({ targets: '#lead', opacity: [0, 1], translateY: [12, 0], duration: 550 }, '-=350')
    .add({ targets: '#cta', opacity: [0, 1], translateY: [12, 0], duration: 550 }, '-=350');
}
const roles = ['I build AI web apps', 'RAG & embeddings', 'Automation that acts', 'Shipped live, end to end'];
(function type() { const el = $('#role'); let ri = 0, ci = 0, del = false; (function step() { const f = roles[ri]; el.textContent = f.slice(0, ci); if (!del && ci < f.length) ci++; else if (del && ci > 0) ci--; else if (!del && ci === f.length) { del = true; return setTimeout(step, 1500); } else { del = false; ri = (ri + 1) % roles.length; } setTimeout(step, del ? 34 : 68); })(); })();

/* ============ MARQUEE ============ */
const words = ['AI Web Apps', 'RAG', 'Embeddings', 'Automation', 'Three.js', 'Supabase', 'Groq', 'pgvector', 'Playwright', 'Full-Stack'];
const rowHTML = (fill) => words.map((w, i) => `<span class="${(i % 3 === (fill ? 0 : 1)) ? 'fill' : ''}">${w} <i>✦</i></span>`).join('');
$('#mrow1').innerHTML = rowHTML(true).repeat(2);
$('#mrow2').innerHTML = rowHTML(false).repeat(2);

/* ============ CAROUSEL (coverflow + dots + swipe) ============ */
const projects = [
  { name: 'Friday', live: 'https://friday-erfanul.vercel.app', repo: 'https://github.com/erfanulfarhan/friday-voice', b: 1, desc: 'A voice-first AI assistant you talk to and it talks back. Audio-reactive orb, real-time speech recognition and synthesis, powered by Llama 3.3 70B.', tags: ['React', 'Whisper STT', 'Motion', 'Groq'] },
  { name: 'SiteSage', live: 'https://sitesage-erfanul.vercel.app', repo: 'https://github.com/erfanulfarhan/sitesage', b: 1, desc: 'An embeddable AI chat widget for any website: create a bot, train it on text or web pages, drop it in with one line of code. Multi-tenant.', tags: ['Multi-tenant', 'Widget', 'Postgres FTS', 'Groq'] },
  { name: 'Ask My Docs', live: 'https://ask-my-docs-erfanul.vercel.app', repo: 'https://github.com/erfanulfarhan/ask-my-docs', b: 1, desc: 'A RAG knowledge base that answers with citations to the exact source passage. Semantic vector search; embeddings run in the browser.', tags: ['RAG', 'pgvector', 'Embeddings', 'Groq'] },
  { name: 'StudyBuddy', live: 'https://studybuddy-ai-pi.vercel.app', repo: 'https://github.com/erfanulfarhan/studybuddy-ai', b: 1, desc: 'An AI study companion: instant summaries, grounded Q&A, and auto-generated interactive quizzes from a PDF or notes.', tags: ['AI', 'Vercel', 'pdf.js', 'Vanilla JS'] },
  { name: 'Doomsday Tracker', live: 'https://doomsday-tracker-erfanul.vercel.app', repo: 'https://github.com/erfanulfarhan/doomsday-tracker', b: 1, desc: 'A cinematic watch-tracker: accounts with cloud-synced progress, a private leaderboard, live charts, and an animated UI.', tags: ['Supabase', 'Auth', 'Charts', 'Animation'] },
  { name: 'Cineplex Automation', live: 'https://amigo-blurred-imaging.ngrok-free.dev', repo: 'https://github.com/erfanulfarhan/cineplex-bot', desc: 'A Telegram bot + web app tracking cinema seats in real time, rendering seat maps, and auto-booking tickets on sale.', tags: ['Python', 'Playwright', 'aiohttp', 'Telegram'] },
  { name: 'Result Watchers', repo: 'https://github.com/erfanulfarhan/bracu-result-watch', desc: 'Bots that watch university result pages and a logged-in portal, alerting the instant results publish. Free on GitHub Actions.', tags: ['Python', 'Playwright', 'GitHub Actions'] },
];
const track = $('#track');
track.innerHTML = projects.map((p, i) => `
  <article class="pcard">
    <span class="num">${String(i + 1).padStart(2, '0')}</span>
    <div class="pcard__in">
      ${p.b ? '<span class="live"><span class="dot"></span>Live</span>' : ''}
      <h3>${p.name}</h3><p>${p.desc}</p>
      <div class="tags">${p.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
      <div class="plinks">${p.live ? `<a href="${p.live}" target="_blank" rel="noopener">↗ Live</a>` : ''}${p.repo ? `<a href="${p.repo}" target="_blank" rel="noopener">⌥ Code</a>` : ''}</div>
    </div>
  </article>`).join('');
const cards = $$('.pcard');
const dotsWrap = $('#dots');
let dots = [], stops = [], cflRaf = 0, rzT = 0;
const padL = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;
function setDot(a) { dots.forEach((d, i) => d.classList.toggle('on', i === a)); }
// Reachable scroll positions only. Cards that can't reach the left edge
// collapse into a single "end" stop, so there are no phantom/empty dots.
function computeStops() {
  const max = Math.max(0, track.scrollWidth - track.clientWidth), pl = padL();
  stops = [];
  cards.forEach((card) => {
    const s = Math.max(0, Math.min(card.offsetLeft - pl, max));
    if (!stops.length || s - stops[stops.length - 1] > 8) stops.push(s);
  });
  if (!stops.length) stops = [0];
  if (stops[stops.length - 1] < max - 8) stops.push(max);
  dotsWrap.innerHTML = stops.map((_, i) => `<i data-i="${i}"></i>`).join('');
  dots = $$('#dots i');
  dots.forEach((d) => (d.onclick = () => goStop(+d.dataset.i)));
  updateActive();
}
function currentStop() { let best = 0, bd = 1e9; stops.forEach((s, i) => { const d = Math.abs(s - track.scrollLeft); if (d < bd) { bd = d; best = i; } }); return best; }
function updateActive() { setDot(currentStop()); }
function goStop(i) { i = Math.max(0, Math.min(stops.length - 1, i)); track.scrollTo({ left: stops[i], behavior: 'smooth' }); sfx.nav(); }
track.addEventListener('scroll', () => { if (!cflRaf) cflRaf = requestAnimationFrame(() => { updateActive(); cflRaf = 0; }); }, { passive: true });
$('#next').onclick = () => goStop(currentStop() + 1);
$('#prev').onclick = () => goStop(currentStop() - 1);
addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(computeStops, 200); });
computeStops();
addEventListener('load', () => setTimeout(computeStops, 300));
// desktop: soft pointer glow on hover (kept flat, no 3D tilt, so orientation can't get stuck)
if (finePointer) cards.forEach((card) => {
  const inn = card.querySelector('.pcard__in');
  card.addEventListener('mousemove', (e) => { const r = card.getBoundingClientRect(); inn.style.setProperty('--mx', (e.clientX - r.left) + 'px'); inn.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
});
// mouse drag to slide the whole works track (touch keeps native scroll)
let down = false, moved = 0, sx = 0, sl = 0;
track.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; moved = 0; sx = e.clientX; sl = track.scrollLeft; track.classList.add('grabbing'); e.preventDefault(); });
addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); track.scrollLeft = sl - dx; });
const endDrag = () => { if (down) { down = false; track.classList.remove('grabbing'); } };
addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
track.addEventListener('dragstart', (e) => e.preventDefault());  // no native image/text drag
track.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);  // suppress click after a drag
requestAnimationFrame(updateActive);

/* ============ REVEALS / STATS / CHIPS ============ */
$$('h2[data-reveal-line]').forEach((h) => (h.innerHTML = `<span class="ln">${h.innerHTML}</span>`));
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.2 });
$$('.reveal,h2[data-reveal-line]').forEach((el) => io.observe(el));
const cio = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; cio.unobserve(e.target); const el = e.target, tg = +el.dataset.count; let n = 0; const step = () => { n += Math.ceil(tg / 26); if (n >= tg) n = tg; el.textContent = n; if (n < tg) requestAnimationFrame(step); }; step(); }), { threshold: 0.6 });
$$('[data-count]').forEach((el) => cio.observe(el));
$('#chips').innerHTML = ['Python', 'JavaScript', 'Groq', 'RAG / Embeddings', 'Supabase', 'pgvector', 'Playwright', 'Three.js', 'Vercel', 'REST APIs', 'Telegram Bots', 'Automation'].map((s) => `<span class="chip">${s}</span>`).join('');
$$('[data-scroll]').forEach((b) => (b.onclick = () => { sfx.click(); goTo(b.dataset.scroll); }));
$$('.navr a[href^="#"]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); goTo(a.getAttribute('href')); }));

/* ============ CHAT ============ */
const panel = $('#chatPanel'), msgs = $('#msgs'), chatHist = [];
const add = (role, text) => { const d = document.createElement('div'); d.className = 'm ' + (role === 'user' ? 'u' : 'a'); d.textContent = text; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; };
$('#chatBtn').onclick = () => { panel.classList.toggle('open'); sfx.click(); if (panel.classList.contains('open') && !msgs.childElementCount) add('a', "Hi! I'm Erfanul's assistant. Ask me about his projects, skills, or what he can build for you."); };
$('#chatClose').onclick = () => panel.classList.remove('open');
$('#sugg').innerHTML = ['What can Erfanul build for me?', 'Tell me about SiteSage', "What's his tech stack?"].map((s) => `<button>${s}</button>`).join('');
$$('#sugg button').forEach((b) => (b.onclick = () => { $('#cin').value = b.textContent; send(); }));
async function send() {
  const input = $('#cin'), text = input.value.trim(); if (!text) return;
  input.value = ''; add('user', text); chatHist.push({ role: 'user', text });
  const think = add('assistant', '…');
  try { const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: text, history: chatHist.slice(0, -1) }) }); const d = await r.json(); think.textContent = r.ok ? d.text : '⚠️ ' + (d.error || 'Something went wrong.'); if (r.ok) chatHist.push({ role: 'assistant', text: d.text }); }
  catch { think.textContent = '⚠️ Network error. Try again.'; }
}
$('#csend').onclick = send; $('#cin').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

/* ============ CONTACT FORM ============ */
const cform = $('#cform');
if (cform) cform.addEventListener('submit', async (e) => {
  e.preventDefault(); sfx.click();
  const btn = $('#cformBtn'), status = $('#cformStatus');
  const fd = new FormData(cform);
  const data = { name: (fd.get('name') || '').trim(), email: (fd.get('email') || '').trim(), message: (fd.get('message') || '').trim(), company: fd.get('company') || '' };
  status.className = 'cform-status';
  if (!data.name || !data.email || !data.message) { status.textContent = 'Please fill in all fields.'; status.classList.add('err'); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) { status.textContent = 'Please enter a valid email.'; status.classList.add('err'); return; }
  const label = btn.textContent; btn.disabled = true; btn.textContent = 'Sending…'; status.textContent = '';
  try {
    const r = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { status.textContent = "Thanks! Your message is on its way. I'll get back to you soon."; status.classList.add('ok'); cform.reset(); }
    else { status.textContent = '⚠️ ' + (d.error || 'Could not send. Please email me directly.'); status.classList.add('err'); }
  } catch { status.textContent = '⚠️ Network error. Please email me directly.'; status.classList.add('err'); }
  btn.disabled = false; btn.textContent = label;
});

preloader(heroText);
