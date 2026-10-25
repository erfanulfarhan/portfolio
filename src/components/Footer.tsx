import { useEffect, useRef, type MouseEvent } from 'react';
import { footerLinks } from '../data/site';
import { finePointer, motionSwitchedOff, reducedMotion, scrollToTarget, setMotionSwitch } from '../lib/motion';
import { ArrowUp } from './Icons';

const systemReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The big EHF. Pointing at it lights the letters from inside with a glow that
 * follows the pointer and slowly shifts colour. Touch screens get one sweep of
 * the light when it scrolls into view.
 */
function Mark() {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current!;
    if (!finePointer) {
      if (reducedMotion) return;
      const io = new IntersectionObserver(
        (entries) => el.classList.toggle('is-sweep', entries[entries.length - 1].isIntersecting),
        { threshold: 0.6 },
      );
      io.observe(el);
      return () => io.disconnect();
    }

    // The light trails the pointer a little, so it glides rather than jumps.
    let raf = 0;
    let x = 50;
    let y = 50;
    let tx = 50;
    let ty = 50;
    let inside = false;
    const write = () => {
      el.style.setProperty('--mx', `${x.toFixed(2)}%`);
      el.style.setProperty('--my', `${y.toFixed(2)}%`);
    };
    const glide = () => {
      x += (tx - x) * 0.14;
      y += (ty - y) * 0.14;
      write();
      raf = Math.abs(tx - x) > 0.05 || Math.abs(ty - y) > 0.05 ? requestAnimationFrame(glide) : 0;
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 100;
      ty = ((e.clientY - r.top) / r.height) * 100;
      // Coming in from outside, the light starts under the pointer as it grows.
      if (!inside || reducedMotion) {
        inside = true;
        x = tx;
        y = ty;
        write();
        return;
      }
      if (!raf) raf = requestAnimationFrame(glide);
    };
    const onLeave = () => {
      inside = false;
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <p className="footer__mark" ref={ref} aria-hidden="true">
      EHF<span />
    </p>
  );
}

export function Footer() {
  const toTop = (e: MouseEvent) => {
    e.preventDefault();
    scrollToTarget('#home');
  };

  return (
    <footer className="footer">
      <Mark />
      <div className="footer__row">
        <p className="footer__name">Erfanul Hakim Farhan</p>
        <ul className="footer__links">
          {footerLinks.map((link) => (
            <li key={link.name}>
              <a href={link.href} {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {link.name}
              </a>
            </li>
          ))}
        </ul>
        <a href="#home" className="footer__top" onClick={toTop}>
          <span>Back to the top</span>
          <ArrowUp size={15} />
        </a>
      </div>
      <div className="footer__fine">
        <p>&copy; {new Date().getFullYear()} Erfanul Hakim Farhan</p>
        {systemReduced ? (
          <p>Animations are off because your device asks for reduced motion.</p>
        ) : (
          <button type="button" className="footer__motion" onClick={() => setMotionSwitch(!motionSwitchedOff)}>
            {motionSwitchedOff ? 'Turn animations back on' : 'Turn off animations'}
          </button>
        )}
      </div>
    </footer>
  );
}
