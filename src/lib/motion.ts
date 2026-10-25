import { useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, useGSAP);
// Mobile browsers resize the viewport as the address bar slides; re-measuring
// pins on every one of those makes the pinned scenes jump.
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, useGSAP };

const MOTION_KEY = 'motion';

function readMotionOff(): boolean {
  try {
    return localStorage.getItem(MOTION_KEY) === 'off';
  } catch {
    return false;
  }
}

/** The footer switch. Stored per browser, applied on reload. */
export const motionSwitchedOff = readMotionOff();

/** Decided once per page load, from the OS setting or the footer switch. */
export const reducedMotion =
  motionSwitchedOff || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Demo videos play unless motion is off or the visitor's browser is saving data. */
export const playDemos =
  !reducedMotion && !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

export function setMotionSwitch(off: boolean) {
  try {
    if (off) localStorage.setItem(MOTION_KEY, 'off');
    else localStorage.removeItem(MOTION_KEY);
  } catch {
    // Storage can be blocked; the reload then simply keeps the current mode.
  }
  window.location.reload();
}

/* ---------- smooth scroll ---------- */

let lenis: Lenis | null = null;
let scrollLocks = 0;

export function startSmoothScroll(): () => void {
  if (reducedMotion) return () => {};
  const instance = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis = instance;
  instance.on('scroll', ScrollTrigger.update);
  const tick = (time: number) => instance.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  if (scrollLocks > 0) instance.stop();
  return () => {
    gsap.ticker.remove(tick);
    instance.destroy();
    if (lenis === instance) lenis = null;
  };
}

/**
 * Scrolls to a section. A scene whose text is revealed by scrolling can name a
 * ScrollTrigger `land:<id>` to be landed on where that reveal is complete, or
 * `land-start:<id>` to be landed on exactly where its pin begins, so a menu
 * click never arrives at text that has not appeared yet or is already fading.
 * A pinned element is measured by its spacer, which stays in the flow.
 */
export function scrollToTarget(target: string | number) {
  let top = 0;
  if (typeof target === 'number') {
    top = target;
  } else if (target !== '#home') {
    const id = target.slice(1);
    const landEnd = ScrollTrigger.getById(`land:${id}`);
    const landStart = ScrollTrigger.getById(`land-start:${id}`);
    if (landEnd) {
      top = landEnd.end;
    } else if (landStart) {
      top = landStart.start;
    } else {
      const el = document.querySelector<HTMLElement>(target);
      if (!el) return;
      const parent = el.parentElement;
      const anchor = parent?.classList.contains('pin-spacer') ? parent : el;
      top = anchor.getBoundingClientRect().top + window.scrollY;
    }
  }
  if (lenis) {
    lenis.scrollTo(top, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  } else {
    window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' });
  }
}

/** Freezes the page behind the preloader and dialogs. Calls nest. */
export function lockScroll() {
  scrollLocks += 1;
  if (scrollLocks === 1) {
    lenis?.stop();
    document.documentElement.classList.add('is-locked');
  }
}

export function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) {
    lenis?.start();
    document.documentElement.classList.remove('is-locked');
  }
}

/* ---------- intro sequence ---------- */

export type IntroPhase = 'covered' | 'filled' | 'lifting' | 'done';
const PHASES: IntroPhase[] = ['covered', 'filled', 'lifting', 'done'];
const INTRO_EVENT = 'site:intro';

export function getIntro(): IntroPhase {
  const phase = document.documentElement.dataset.intro as IntroPhase | undefined;
  return phase && PHASES.includes(phase) ? phase : 'covered';
}

export function setIntro(phase: IntroPhase) {
  document.documentElement.dataset.intro = phase;
  window.dispatchEvent(new Event(INTRO_EVENT));
}

const reached = (phase: IntroPhase) => PHASES.indexOf(getIntro()) >= PHASES.indexOf(phase);

export function whenIntro(phase: IntroPhase): Promise<void> {
  return new Promise((resolve) => {
    if (reached(phase)) return resolve();
    const check = () => {
      if (!reached(phase)) return;
      window.removeEventListener(INTRO_EVENT, check);
      resolve();
    };
    window.addEventListener(INTRO_EVENT, check);
  });
}

export function useIntro(phase: IntroPhase): boolean {
  const [ok, setOk] = useState(() => reached(phase));
  useEffect(() => {
    if (ok) return;
    let alive = true;
    whenIntro(phase).then(() => alive && setOk(true));
    return () => {
      alive = false;
    };
  }, [ok, phase]);
  return ok;
}

/* ---------- hero black hole status, which the preloader waits on ---------- */

export type SkyStatus = 'loading' | 'ready' | 'failed';
const SKY_EVENT = 'site:sky';

export function setSkyStatus(status: SkyStatus) {
  document.documentElement.dataset.sky = status;
  window.dispatchEvent(new Event(SKY_EVENT));
}

/** Resolves once the black hole is ready or has failed, or after the timeout either way. */
export function whenSkySettled(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const settled = () => {
      const s = document.documentElement.dataset.sky;
      return s === 'ready' || s === 'failed' || s === undefined;
    };
    if (settled()) return resolve();
    const done = () => {
      window.clearTimeout(timer);
      window.removeEventListener(SKY_EVENT, check);
      resolve();
    };
    const check = () => settled() && done();
    const timer = window.setTimeout(done, timeoutMs);
    window.addEventListener(SKY_EVENT, check);
  });
}
