import { useEffect, useRef } from 'react';
import {
  getIntro,
  gsap,
  lockScroll,
  reducedMotion,
  setIntro,
  unlockScroll,
  whenSkySettled,
} from '../lib/motion';

const BLADES = 7;
const TAU = Math.PI * 2;
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/**
 * The intro, as a telescope finding its target: the EHF mark hunts for focus,
 * the brackets lock on, and a full-screen aperture opens onto the sky.
 */
export function Boot() {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const seamsRef = useRef<SVGGElement>(null);
  const subjectRef = useRef<HTMLDivElement>(null);
  const afRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLParagraphElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current!;
    if (getIntro() === 'done') {
      root.hidden = true;
      return;
    }
    const path = pathRef.current!;
    const seams = Array.from(seamsRef.current!.children) as SVGLineElement[];
    const subject = subjectRef.current!;
    const af = afRef.current!;
    const mark = markRef.current!;
    const status = statusRef.current!;

    let cancelled = false;
    let finished = false;
    const tweens: gsap.core.Animation[] = [];
    lockScroll();

    // A full-screen sheet with a seven-sided hole: the blades of a closed iris.
    // d is the hole's apothem; the seams carry each side on past its corner.
    const iris = { d: 0, twist: 0 };
    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w / 2;
      const cy = h / 2;
      const reach = Math.hypot(w, h);
      const circum = iris.d / Math.cos(Math.PI / BLADES);
      const corners = Array.from({ length: BLADES }, (_, i) => {
        const a = iris.twist + (i / BLADES) * TAU - Math.PI / 2;
        return [cx + Math.cos(a) * circum, cy + Math.sin(a) * circum];
      });
      const hole = circum > 0.5 ? `M${corners.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}Z` : '';
      path.setAttribute('d', `M0 0H${w}V${h}H0Z${hole}`);
      seams.forEach((seam, i) => {
        const [x, y] = corners[(i + 1) % BLADES];
        const dir = iris.twist + (i / BLADES) * TAU + Math.PI / BLADES;
        seam.setAttribute('x1', x.toFixed(1));
        seam.setAttribute('y1', y.toFixed(1));
        seam.setAttribute('x2', (x + Math.cos(dir) * reach).toFixed(1));
        seam.setAttribute('y2', (y + Math.sin(dir) * reach).toFixed(1));
      });
    };
    draw();
    window.addEventListener('resize', draw);

    const finish = () => {
      if (finished) return;
      finished = true;
      root.hidden = true;
      unlockScroll();
      setIntro('done');
    };

    const play = (animation: gsap.core.Animation) =>
      new Promise<void>((resolve) => {
        tweens.push(animation);
        animation.eventCallback('onComplete', () => resolve());
      });

    const fontsReady = Promise.race([document.fonts?.ready ?? Promise.resolve(), wait(3000)]);

    const run = async () => {
      await fontsReady;
      if (cancelled) return;
      root.classList.add('is-ready');

      if (reducedMotion) {
        status.textContent = 'Ready';
        setIntro('filled');
        setIntro('lifting');
        await play(gsap.to(root, { opacity: 0, duration: 0.4, ease: 'power1.out' }));
        if (!cancelled) finish();
        return;
      }

      // Autofocus hunting: overshoot, come back, settle, lock.
      await play(
        gsap
          .timeline()
          .fromTo(subject, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' })
          .fromTo(mark, { filter: 'blur(16px)' }, { filter: 'blur(3px)', duration: 0.45, ease: 'power2.out' }, 0)
          .fromTo(af, { scale: 1.3 }, { scale: 0.9, duration: 0.45, ease: 'power2.out' }, 0)
          .to(mark, { filter: 'blur(9px)', duration: 0.3, ease: 'sine.inOut' })
          .to(af, { scale: 1.08, duration: 0.3, ease: 'sine.inOut' }, '<')
          .to(mark, { filter: 'blur(0px)', duration: 0.5, ease: 'power3.out' })
          .to(af, { scale: 1, duration: 0.5, ease: 'power3.out' }, '<'),
      );
      if (cancelled) return;
      root.classList.add('is-locked');
      status.textContent = 'Locked';
      gsap.set(mark, { clearProps: 'filter' });
      tweens.push(gsap.fromTo(mark, { scale: 1.035 }, { scale: 1, duration: 0.35, ease: 'power2.out' }));
      setIntro('filled');

      await Promise.all([whenSkySettled(6000), wait(450)]);
      if (cancelled) return;
      setIntro('lifting');

      const dMax = Math.hypot(window.innerWidth, window.innerHeight) / 2 + 60;
      await play(
        gsap
          .timeline()
          .to(subject, { opacity: 0, scale: 0.96, duration: 0.35, ease: 'power2.in' })
          .to(iris, { d: dMax, twist: -0.65, duration: 1.15, ease: 'power3.inOut', onUpdate: draw }, 0.2),
      );
      if (!cancelled) finish();
    };

    run();

    return () => {
      cancelled = true;
      tweens.forEach((t) => t.kill());
      window.removeEventListener('resize', draw);
      root.classList.remove('is-ready', 'is-locked');
      if (!finished) unlockScroll();
    };
  }, []);

  return (
    <div className="boot" ref={rootRef} aria-hidden="true">
      <svg className="boot__iris">
        <defs>
          <radialGradient id="boot-metal" cx="50%" cy="50%" r="70%">
            <stop offset="0" stopColor="#0e121b" />
            <stop offset="1" stopColor="#05070b" />
          </radialGradient>
        </defs>
        <path ref={pathRef} fill="url(#boot-metal)" fillRule="evenodd" />
        <g ref={seamsRef} className="boot__seams">
          {Array.from({ length: BLADES }, (_, i) => (
            <line key={i} />
          ))}
        </g>
      </svg>
      <div className="boot__subject" ref={subjectRef}>
        <div className="boot__focus">
          <div className="boot__af" ref={afRef}>
            <span className="corners" />
          </div>
          <p className="boot__mark" ref={markRef}>
            EHF<span className="boot__dot" />
          </p>
        </div>
        <p className="boot__name">Erfanul Hakim Farhan</p>
        <p className="boot__status">
          <span className="boot__status-dot" />
          <span ref={statusRef}>Acquiring</span>
        </p>
      </div>
    </div>
  );
}
