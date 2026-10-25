import { useEffect, useRef } from 'react';
import { gsap, reducedMotion, ScrollTrigger, useGSAP } from '../lib/motion';

type Segment = { start: number; end: number; from: number; to: number };

// Which ground each scene sits on: 0 is space, 1 is dust. The hero and the
// work are out in space; About is back on the ground. The page fades between
// grounds as a scene's top travels up the viewport.
const SCENES: [selector: string, ground: number][] = [
  ['#work', 0],
  ['#about', 1],
  ['#modes', 1],
  ['#log', 0],
  ['#contact', 1],
];

/** A small seeded random generator, so the sky is the same on every visit. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Paints a still field of stars: mostly faint, a few bright, some warm and some cool. */
function paintStars(canvas: HTMLCanvasElement) {
  // Stars are tiny dots: 1.5x is plenty sharp, and keeps this still image's memory down.
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const rand = seeded(1977);
  const count = Math.round((w * h) / 2600);
  for (let i = 0; i < count; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const bright = Math.pow(rand(), 7);
    const r = 0.35 + bright * 1.1;
    const alpha = 0.18 + bright * 0.75;
    const warm = rand() < 0.55;
    ctx.fillStyle = warm ? `rgba(255, 236, 214, ${alpha})` : `rgba(214, 226, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (bright > 0.35) {
      // A soft halo on the brightest few.
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
      g.addColorStop(0, `rgba(255, 240, 220, ${alpha * 0.25})`);
      g.addColorStop(1, 'rgba(255, 240, 220, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
    }
  }
}

/**
 * One fixed backdrop for the whole page, so a change of ground is a cheap
 * opacity fade. Coming out of space onto the dust glares for a moment, like
 * stepping out into daylight.
 */
export function PageBackground() {
  const starsRef = useRef<HTMLCanvasElement>(null);
  const dustRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);

  // Painted once, and again when the window really changes size. A phone's
  // address bar nudges the height on every scroll; the sky stretches for that
  // rather than repainting, but not for anything bigger.
  useEffect(() => {
    const canvas = starsRef.current!;
    let timer = 0;
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    paintStars(canvas);
    const onResize = () => {
      const small = window.innerWidth === lastWidth && Math.abs(window.innerHeight - lastHeight) < lastHeight * 0.2;
      if (small) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        lastWidth = window.innerWidth;
        lastHeight = window.innerHeight;
        paintStars(canvas);
      }, 200);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useGSAP(() => {
    const dust = dustRef.current!;
    const glare = glareRef.current!;
    const root = document.documentElement;
    const write = reducedMotion
      ? (v: number) => gsap.set(dust, { opacity: v })
      : gsap.quickTo(dust, 'opacity', { duration: 0.2, ease: 'power2.out' });
    const writeGlare = reducedMotion ? () => {} : gsap.quickTo(glare, 'opacity', { duration: 0.15, ease: 'power1.out' });

    let segments: Segment[] = [];
    let current = -1;
    let currentGlare = -1;

    const apply = (scroll: number, force = false) => {
      let value = 0;
      let flare = 0;
      for (const s of segments) {
        if (scroll < s.start) break;
        const t = Math.min(1, Math.max(0, (scroll - s.start) / (s.end - s.start)));
        const eased = t * t * t * (t * (t * 6 - 15) + 10);
        value = s.from + (s.to - s.from) * eased;
        flare = s.to > s.from ? Math.sin(Math.PI * t) * 0.14 : 0;
      }
      if (flare !== currentGlare || force) {
        currentGlare = flare;
        writeGlare(flare);
      }
      if (value === current && !force) return;
      current = value;
      write(value);
      const ground = value < 0.5 ? 'space' : 'dust';
      if (root.dataset.ground !== ground) root.dataset.ground = ground;
    };

    ScrollTrigger.create({
      start: 0,
      end: 'max',
      // Measure after every pin has added its spacing.
      refreshPriority: -1,
      onUpdate: (self) => apply(self.scroll()),
      onRefresh: (self) => {
        const vh = window.innerHeight;
        const y = self.scroll();
        segments = [];
        let previous = 0;
        for (const [selector, ground] of SCENES) {
          const el = document.querySelector(selector);
          if (!el || ground === previous) continue;
          const top = el.getBoundingClientRect().top + y;
          segments.push({ start: top - 0.95 * vh, end: top - 0.05 * vh, from: previous, to: ground });
          previous = ground;
        }
        apply(y, true);
      },
    });
  });

  return (
    <div className="page-bg" aria-hidden="true">
      <canvas className="page-bg__stars" ref={starsRef} />
      <div className="page-bg__dust" ref={dustRef} />
      <div className="page-bg__glare" ref={glareRef} />
    </div>
  );
}
