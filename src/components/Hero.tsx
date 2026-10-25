import { useRef, type MouseEvent } from 'react';
import { gsap, reducedMotion, scrollToTarget, useGSAP } from '../lib/motion';
import { openChat } from '../lib/events';
import { HeroSky } from './hero/HeroSky';
import type { SkyShared } from './hero/BlackHole';
import { ArrowDown, Spark } from './Icons';

/**
 * The name, beside a black hole. Scrolling pins the scene: the copy steps
 * aside, the hole glides to the middle, and the camera falls in until the
 * horizon fills the screen, then comes out at the work.
 */
export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  // Shared with the 3D scene, which reads it every frame.
  const shared = useRef<SkyShared>({ dolly: 0, hidden: false });

  useGSAP(
    () => {
      if (reducedMotion) return;
      const section = sectionRef.current!;
      const state = shared.current;
      // Declared first: GSAP may call onUpdate before timeline() has returned.
      let tl: gsap.core.Timeline | null = null;
      tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=200%',
          scrub: 0.5,
          pin: true,
          refreshPriority: 1,
        },
        onUpdate: () => {
          state.hidden = (tl?.progress() ?? 0) > 0.995;
          // The still picture, if WebGL is missing, follows the same fall in CSS.
          section.style.setProperty('--dolly', state.dolly.toFixed(3));
        },
      });
      tl.to(copyRef.current, { xPercent: -14, opacity: 0, ease: 'power2.in', duration: 0.34 }, 0)
        .to(hintRef.current, { opacity: 0, duration: 0.08 }, 0)
        .to(state, { dolly: 1, ease: 'none', duration: 0.92 }, 0.04)
        .to(skyRef.current, { opacity: 0, ease: 'power1.in', duration: 0.07 }, 0.93);
    },
    { scope: sectionRef },
  );

  const toWork = (e: MouseEvent) => {
    e.preventDefault();
    scrollToTarget('#work');
  };

  return (
    <section id="home" ref={sectionRef} className="hero scene-dark" aria-labelledby="hero-title">
      <div className="hero__sky" ref={skyRef}>
        <HeroSky shared={shared.current} />
      </div>

      <div className="hero__copy" ref={copyRef}>
        <p className="hero__meta">
          <span>Based in Bangladesh</span>
          <span>Open to freelance work</span>
        </p>
        <h1 id="hero-title" className="hero__name" aria-label="Erfanul Hakim Farhan">
          <span className="hero__line" aria-hidden="true">
            Erfanul
          </span>
          <span className="hero__line" aria-hidden="true">
            Hak
            <span className="hero__i">
              <span>i</span>
            </span>
            m Farhan
          </span>
        </h1>
        <p className="hero__role">
          AI and automation developer. I build tools that watch, alert and act, and ship them live.
        </p>
        <div className="hero__actions">
          <a className="btn btn--light" href="#work" onClick={toWork}>
            <span>See the work</span>
            <ArrowDown size={15} />
          </a>
          <button type="button" className="btn btn--line" onClick={(e) => openChat(e.currentTarget)}>
            <Spark size={15} />
            <span>Ask my AI</span>
          </button>
        </div>
      </div>

      <p className="hero__hint" ref={hintRef} aria-hidden="true">
        Scroll to fall in
      </p>
    </section>
  );
}
