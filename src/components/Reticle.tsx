import { useEffect, useRef } from 'react';
import { finePointer, reducedMotion, whenIntro } from '../lib/motion';

const TARGETS = 'a, button, input, textarea, select, [data-focus]';
const SIZE = 13; // half the resting reticle
const PAD = 7; // breathing room around a locked target

type Box = { l: number; t: number; r: number; b: number };

/**
 * A focus reticle that trails the mouse and, like autofocus, locks onto
 * whatever you can click by framing it. Mouse and pen only, and only with
 * motion on.
 */
export function Reticle() {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = finePointer && !reducedMotion;

  useEffect(() => {
    if (!enabled) return;
    const root = ref.current!;
    const [tl, tr, bl, br] = Array.from(root.children) as HTMLElement[];
    let px = -100;
    let py = -100;
    let target: Element | null = null;
    let raf = 0;
    let shown = false;
    let ready = false;
    const box: Box = { l: px - SIZE, t: py - SIZE, r: px + SIZE, b: py + SIZE };

    // Runs while it is moving or locked on, and goes idle once it has caught up.
    const frame = () => {
      raf = 0;
      let goal: Box;
      if (target && target.isConnected) {
        const r = target.getBoundingClientRect();
        goal = { l: r.left - PAD, t: r.top - PAD, r: r.right + PAD, b: r.bottom + PAD };
      } else {
        goal = { l: px - SIZE, t: py - SIZE, r: px + SIZE, b: py + SIZE };
      }
      const k = target ? 0.3 : 0.38;
      box.l += (goal.l - box.l) * k;
      box.t += (goal.t - box.t) * k;
      box.r += (goal.r - box.r) * k;
      box.b += (goal.b - box.b) * k;
      tl.style.transform = `translate3d(${box.l}px, ${box.t}px, 0)`;
      tr.style.transform = `translate3d(${box.r}px, ${box.t}px, 0)`;
      bl.style.transform = `translate3d(${box.l}px, ${box.b}px, 0)`;
      br.style.transform = `translate3d(${box.r}px, ${box.b}px, 0)`;
      const moving =
        Math.abs(goal.l - box.l) > 0.1 ||
        Math.abs(goal.t - box.t) > 0.1 ||
        Math.abs(goal.r - box.r) > 0.1 ||
        Math.abs(goal.b - box.b) > 0.1;
      if (shown && (moving || target)) raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (shown && !raf) raf = requestAnimationFrame(frame);
    };

    const show = (on: boolean) => {
      if (on === shown) return;
      shown = on;
      root.classList.toggle('is-on', on);
      if (on) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const lockOn = (el: Element | null) => {
      if (el === target) return;
      target = el;
      root.classList.toggle('is-locked', Boolean(el));
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return show(false);
      px = e.clientX;
      py = e.clientY;
      if (!shown && ready) {
        // Start from the pointer, not from wherever it was last seen.
        box.l = px - SIZE;
        box.t = py - SIZE;
        box.r = px + SIZE;
        box.b = py + SIZE;
      }
      show(ready);
      const hit = (e.target as Element | null)?.closest?.(TARGETS) ?? null;
      lockOn(hit && !hit.closest('[data-no-reticle]') ? hit : null);
      wake();
    };
    const onOut = (e: PointerEvent) => {
      if (e.relatedTarget === null) show(false);
    };
    // Scrolling moves the page under a still pointer, so look again at what is under it.
    let scrollRaf = 0;
    const onScroll = () => {
      if (!shown || scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        const hit = document.elementFromPoint(px, py)?.closest(TARGETS) ?? null;
        lockOn(hit && !hit.closest('[data-no-reticle]') ? hit : null);
        wake();
      });
    };
    const onDown = () => root.classList.add('is-pressed');
    const onUp = () => root.classList.remove('is-pressed');
    const onHidden = () => {
      if (document.hidden) show(false);
    };

    let alive = true;
    whenIntro('done').then(() => {
      if (alive) ready = true;
    });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerout', onOut, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(scrollRaf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onOut);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div className="reticle" ref={ref} aria-hidden="true">
      <span className="reticle__c reticle__c--tl" />
      <span className="reticle__c reticle__c--tr" />
      <span className="reticle__c reticle__c--bl" />
      <span className="reticle__c reticle__c--br" />
    </div>
  );
}
