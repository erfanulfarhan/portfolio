import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { scenes } from '../data/site';
import { reducedMotion, scrollToTarget, whenIntro } from '../lib/motion';
import { soundtrack } from '../lib/soundtrack';

const pad = (n: number) => String(n).padStart(2, '0');

/** Mission elapsed time, T+HH:MM:SS, counted from when the intro ends. */
function elapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

/**
 * The display laid over the page, like a spacecraft's: corner brackets, the
 * EHF mark, the menu, a sound switch, the mission clock and a counter for the
 * current section.
 */
export function Hud() {
  const [active, setActive] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(() => soundtrack.isPlaying);
  const frameRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const lastActive = useRef(0);

  // Which section holds the middle of the screen.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrolled(window.scrollY > 40);
      const mid = window.innerHeight / 2;
      scenes.forEach(({ id }, i) => {
        const rect = document.getElementById(id)?.getBoundingClientRect();
        if (rect && rect.top <= mid && rect.bottom >= mid) setActive(i);
      });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  // The corners pull in and settle each time a new section comes into frame.
  useEffect(() => {
    if (active === lastActive.current) return;
    lastActive.current = active;
    if (reducedMotion || !frameRef.current) return;
    const corners = Array.from(frameRef.current.children) as HTMLElement[];
    const anims = corners.map((corner) => {
      const x = corner.classList.contains('viewfinder__c--tl') || corner.classList.contains('viewfinder__c--bl') ? 10 : -10;
      const y = corner.classList.contains('viewfinder__c--tl') || corner.classList.contains('viewfinder__c--tr') ? 10 : -10;
      return corner.animate(
        [{ transform: 'translate(0, 0)' }, { transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }],
        { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [active]);

  // The clock starts when the intro ends and only ticks while the tab is visible.
  useEffect(() => {
    let timer = 0;
    let started = 0;
    let alive = true;
    const tick = () => {
      if (timeRef.current) timeRef.current.textContent = elapsed(performance.now() - started);
    };
    const run = () => {
      window.clearInterval(timer);
      if (!document.hidden && started) timer = window.setInterval(tick, 250);
    };
    whenIntro('done').then(() => {
      if (!alive) return;
      started = performance.now();
      tick();
      run();
    });
    document.addEventListener('visibilitychange', run);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', run);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      menuRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  // The switch shows what is really playing, even if a file fails to start.
  useEffect(() => soundtrack.subscribe(() => setSound(soundtrack.isPlaying)), []);

  const toggleSound = () => {
    if (soundtrack.isPlaying) soundtrack.stop();
    else soundtrack.play();
  };

  const go = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    // A link inside the menu sheet disappears with it; keep focus on the menu button.
    if (open) menuRef.current?.focus({ preventScroll: true });
    setOpen(false);
    scrollToTarget(`#${id}`);
  };

  const links = (className: string) =>
    scenes.slice(1).map(({ id, label }) => (
      <li key={id}>
        <a
          href={`#${id}`}
          className={className}
          onClick={go(id)}
          aria-current={scenes[active].id === id ? 'true' : undefined}
        >
          {label}
        </a>
      </li>
    ));

  return (
    <>
      <div className="viewfinder" ref={frameRef} aria-hidden="true">
        <span className="viewfinder__c viewfinder__c--tl" />
        <span className="viewfinder__c viewfinder__c--tr" />
        <span className="viewfinder__c viewfinder__c--bl" />
        <span className="viewfinder__c viewfinder__c--br" />
      </div>

      <header className="hud" data-scrolled={scrolled || open}>
        <nav ref={navRef} className="hud__bar" aria-label="Main">
          <a href="#home" className="mark" onClick={go('home')} aria-label="Erfanul Hakim Farhan, back to the top">
            EHF<span className="mark__dot" aria-hidden="true" />
          </a>
          <div className="hud__end">
            <ul className="hud__links">{links('hud__link')}</ul>
            <button
              type="button"
              className="sound"
              aria-pressed={sound}
              title="An original piano piece, written for this site"
              onClick={toggleSound}
            >
              <span className="sound__bars" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="sound__label">Sound</span>
            </button>
            <button
              ref={menuRef}
              type="button"
              className="hud__menu"
              aria-expanded={open}
              aria-controls="hud-sheet"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? 'Close' : 'Menu'}
            </button>
          </div>
          <div id="hud-sheet" className="hud__sheet" hidden={!open}>
            <ul>{links('hud__sheet-link')}</ul>
          </div>
        </nav>
      </header>

      <div className="hud__met" aria-hidden="true">
        <span className="hud__met-dot" />
        T+<span ref={timeRef}>00:00:00</span>
      </div>
      <div className="hud__count" aria-hidden="true">
        {pad(active + 1)} / {pad(scenes.length)} <span>{scenes[active].label}</span>
      </div>
    </>
  );
}
