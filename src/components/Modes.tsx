import { useRef } from 'react';
import { findProject, modes } from '../data/site';
import { gsap, reducedMotion, ScrollTrigger, useGSAP } from '../lib/motion';
import { useOpenProject } from './work/ProjectDialog';

const STEP = 360 / modes.length;

// A few made-up constellations inside the ring, as on a planisphere's star map.
const CONSTELLATIONS: [number, number][][] = [
  [
    [-262, -132],
    [-208, -84],
    [-158, -128],
    [-112, -68],
    [-64, -112],
  ],
  [
    [118, -236],
    [166, -204],
    [214, -218],
    [252, -168],
    [236, -104],
    [176, -96],
    [166, -204],
  ],
  [
    [-188, 150],
    [-122, 196],
    [-58, 168],
    [-92, 102],
    [-122, 196],
  ],
  [
    [72, 132],
    [136, 182],
    [206, 128],
    [168, 64],
  ],
];

// Faint background stars, placed by a seeded generator so they never move between visits.
const FIELD = (() => {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: 64 }, () => {
    const a = rand() * Math.PI * 2;
    const r = 105 + Math.sqrt(rand()) * 210;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, size: 1.6 + Math.pow(rand(), 3) * 3 };
  });
})();

function DialFace() {
  const ticks = [];
  for (let a = 0; a < 360; a += 5) {
    const major = a % 30 === 0;
    ticks.push(
      <line
        key={a}
        className={major ? 'is-major' : undefined}
        x1={major ? 432 : 448}
        x2={470}
        y1={0}
        y2={0}
        transform={`rotate(${a})`}
      />,
    );
  }
  return (
    <svg className="dial__face" viewBox="-500 -500 1000 1000" aria-hidden="true">
      <circle className="dial__rim" r="484" />
      <circle className="dial__ring" r="330" />
      <g className="dial__ticks">{ticks}</g>
      <g className="dial__field">
        {FIELD.map((star, i) => (
          <circle key={i} cx={star.x.toFixed(1)} cy={star.y.toFixed(1)} r={star.size.toFixed(1)} />
        ))}
      </g>
      <g className="dial__constellations">
        {CONSTELLATIONS.map((points, i) => (
          <g key={i}>
            <polyline points={points.map(([x, y]) => `${x},${y}`).join(' ')} />
            {points.map(([x, y], j) => (
              <circle key={j} cx={x} cy={y} r={j === 0 ? 7 : 5} />
            ))}
          </g>
        ))}
      </g>
      {modes.map((m, i) => (
        <text
          key={m.code}
          className="dial__code"
          transform={`rotate(${i * STEP}) translate(392 0)`}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {m.code}
        </text>
      ))}
      <circle className="dial__hub" r="70" />
    </svg>
  );
}

/**
 * What I build, as the stops on a planisphere, the turning star wheel used to
 * find constellations. The section pins, the wheel turns one stop per service,
 * and the panel beside it changes.
 */
export function Modes() {
  const open = useOpenProject();
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reducedMotion) return;
      const section = sectionRef.current!;
      const pin = pinRef.current!;
      const spin = spinRef.current!;
      const panels = gsap.utils.toArray<HTMLElement>('.mode', panelsRef.current);
      const codes = gsap.utils.toArray<SVGTextElement>('.dial__code', spin);
      const last = modes.length - 1;
      const navBottom = () => document.querySelector('.hud__bar')?.getBoundingClientRect().bottom ?? 60;

      // The pinned dial: one stop per mode, the panels crossfading beside it.
      const dial = () => {
        const state = { at: 0 };
        let active = -1;
        const render = () => {
          spin.style.transform = `rotate(${(-state.at * STEP).toFixed(2)}deg)`;
          panels.forEach((panel, i) => {
            const d = state.at - i;
            const o = Math.max(0, 1 - Math.abs(d) * 2.2);
            panel.style.opacity = o.toFixed(3);
            panel.style.transform = `translate3d(0, ${(-d * 36).toFixed(1)}px, 0)`;
            panel.style.visibility = o < 0.02 ? 'hidden' : 'visible';
          });
          const now = Math.round(state.at);
          if (now !== active) {
            codes[active]?.classList.remove('is-on');
            codes[now]?.classList.add('is-on');
            active = now;
          }
        };
        gsap.to(state, {
          at: last,
          ease: 'none',
          onUpdate: render,
          scrollTrigger: {
            // The menu link lands where the dial starts, on the first mode.
            id: 'land-start:modes',
            trigger: pin,
            start: () => `top ${Math.max(navBottom() + 16, (window.innerHeight - pin.offsetHeight) / 2)}px`,
            end: () => `+=${Math.round(window.innerHeight * last * 0.62)}`,
            pin: true,
            scrub: 0.8,
            invalidateOnRefresh: true,
          },
        });
        render();
        return () => {
          spin.style.transform = '';
          codes.forEach((code) => code.classList.remove('is-on'));
          panels.forEach((panel) => {
            panel.style.opacity = '';
            panel.style.transform = '';
            panel.style.visibility = '';
          });
        };
      };

      // The dial only pins when the whole scene fits on screen. Otherwise every
      // mode is listed plainly, so nothing waits behind a scroll to be read.
      // Re-decided whenever the window changes size or turns.
      let dialling: gsap.Context | null = null;
      let layout: 'dial' | 'list' | null = null;
      const build = () => {
        section.classList.remove('is-static');
        const next = pin.offsetHeight + navBottom() + 32 <= window.innerHeight ? 'dial' : 'list';
        if (next === 'list') section.classList.add('is-static');
        if (next === layout) return false;
        dialling?.revert();
        dialling = next === 'dial' ? gsap.context(dial) : null;
        layout = next;
        return true;
      };
      build();

      let timer = 0;
      let alive = true;
      const rebuild = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => alive && build() && ScrollTrigger.refresh(), 250);
      };
      window.addEventListener('resize', rebuild);
      document.fonts?.ready.then(rebuild);

      return () => {
        alive = false;
        window.clearTimeout(timer);
        window.removeEventListener('resize', rebuild);
        dialling?.revert();
        section.classList.remove('is-static');
      };
    },
    { scope: sectionRef },
  );

  return (
    <section id="modes" ref={sectionRef} className="modes scene-light" aria-labelledby="modes-title">
      <div className="modes__pin" ref={pinRef}>
        <header className="modes__head">
          <p className="label">Services</p>
          <h2 id="modes-title" className="modes__title">
            What I build.
          </h2>
        </header>

        <div className="dial">
          <div className="dial__spin" ref={spinRef}>
            <DialFace />
          </div>
          <span className="dial__pointer" aria-hidden="true" />
        </div>

        {/* Screen readers get the whole list; the dial and its panels are a visual reading of it. */}
        {!reducedMotion && (
          <ul className="sr-only">
            {modes.map((m) => (
              <li key={m.code}>
                {m.title}. {m.line} For example: {m.examples.join(', ')}.
              </li>
            ))}
          </ul>
        )}
        <div className="modes__panels" ref={panelsRef} aria-hidden={reducedMotion ? undefined : true}>
          {modes.map((m) => (
            <article className="mode" key={m.code}>
              <p className="mode__code">{m.code}</p>
              <h3 className="mode__title">{m.title}</h3>
              <p className="mode__line">{m.line}</p>
              <ul className="mode__examples">
                {m.examples.map((name) => {
                  const project = findProject(name);
                  return (
                    <li key={name}>
                      <button
                        type="button"
                        tabIndex={reducedMotion ? undefined : -1}
                        onClick={(e) => project && open(project, e.currentTarget, 'wide')}
                      >
                        {name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
