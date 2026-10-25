import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { releases } from '../data/site';
import { finePointer, gsap, reducedMotion, useGSAP } from '../lib/motion';

type Graph = { height: number; nodes: number[] };

// Screenshots near 3:2 fill the preview; anything else (an app icon, a 16:9
// video thumbnail) is shown whole inside it rather than cropped.
const fills = (w: number, h: number) => Math.abs(w / h - 1.5) < 0.1;

/**
 * The mission log: releases newest first, threaded on a git graph that draws
 * itself as you scroll. On wide screens a preview beside the list shows the
 * release you point at; narrower screens put a thumbnail in each row instead.
 */
export function Log() {
  const sectionRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [graph, setGraph] = useState<Graph>({ height: 0, nodes: [] });
  const [active, setActive] = useState(0);

  // Where each entry sits, so the graph's commits line up with the rows.
  useLayoutEffect(() => {
    const list = listRef.current!;
    const measure = () => {
      const items = Array.from(list.children) as HTMLElement[];
      const nodes = items.map((li) => Math.round(li.offsetTop + li.offsetHeight / 2));
      setGraph((g) =>
        g.height === list.offsetHeight && g.nodes.join() === nodes.join() ? g : { height: list.offsetHeight, nodes },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, []);

  useGSAP(
    () => {
      if (reducedMotion || !graph.nodes.length) return;
      const first = graph.nodes[0];
      const last = graph.nodes[graph.nodes.length - 1];
      const nodes = gsap.utils.toArray<SVGCircleElement>('.graph__node');
      // GSAP can call onUpdate while fromTo() is still constructing the tween,
      // so the reference has to exist (as null) before the call.
      let draw: gsap.core.Tween | null = null;
      draw = gsap.fromTo(
        '.graph__progress',
        { strokeDashoffset: 1 },
        {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: { trigger: listRef.current, start: 'top 88%', end: 'bottom 80%', scrub: 0.4 },
          // Light each commit as the drawn line reaches it.
          onUpdate: () => {
            const y = first + (last - first) * (draw?.progress() ?? 0);
            nodes.forEach((node, i) => node.classList.toggle('is-lit', graph.nodes[i] <= y + 0.5));
          },
        },
      );
    },
    { scope: sectionRef, dependencies: [graph], revertOnUpdate: true },
  );

  // A touch screen wide enough for the preview has no hover, so the preview
  // follows whichever row is in the middle of the screen.
  useEffect(() => {
    if (finePointer) return;
    const list = listRef.current!;
    const wide = window.matchMedia('(min-width: 1100px)');
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!wide.matches) return;
      const mid = window.innerHeight / 2;
      let best = 0;
      let bestGap = Infinity;
      Array.from(list.children).forEach((li, i) => {
        const r = li.getBoundingClientRect();
        const gap = Math.abs(r.top + r.height / 2 - mid);
        if (gap < bestGap) {
          bestGap = gap;
          best = i;
        }
      });
      setActive(best);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
    };
  }, []);

  const first = graph.nodes[0] ?? 0;
  const last = graph.nodes[graph.nodes.length - 1] ?? 0;

  return (
    <section id="log" ref={sectionRef} className="log scene-dark" aria-labelledby="log-title">
      <header className="log__head">
        <p className="label">Mission log</p>
        <h2 id="log-title" className="log__title">
          Releases, newest first.
        </h2>
        <p className="log__sub">Real versions and launch days, taken from GitHub.</p>
      </header>

      <div className="log__body">
        <svg
          className="graph"
          width="40"
          height={graph.height}
          viewBox={`0 0 40 ${graph.height || 1}`}
          aria-hidden="true"
        >
          {graph.nodes.length > 1 && (
            <>
              <path className="graph__track" d={`M20 ${first}V${last}`} />
              <path className="graph__progress" d={`M20 ${first}V${last}`} pathLength={1} />
            </>
          )}
          {graph.nodes.map((y, i) => (
            // GSAP toggles is-lit on these, so React must not own their class list.
            <circle key={i} className="graph__node" data-active={i === active || undefined} cx="20" cy={y} r="5.5" />
          ))}
        </svg>

        <ol className="log__list" ref={listRef}>
          {releases.map((r, i) => (
            <li
              className={`entry${i === active ? ' is-active' : ''}`}
              key={`${r.tag}-${r.dateTime}`}
              onPointerEnter={(e) => e.pointerType !== 'touch' && setActive(i)}
              onFocus={() => setActive(i)}
            >
              <span className={`entry__tag${r.live ? ' is-live' : ''}`}>{r.tag}</span>
              <div className="entry__body">
                <h3 className="entry__title">
                  <a href={r.href} target="_blank" rel="noopener noreferrer">
                    {r.title}
                  </a>
                </h3>
                <p className="entry__meta">
                  <time dateTime={r.dateTime}>{r.date}</time>, {r.where}
                </p>
              </div>
              <img
                className={`entry__thumb${fills(r.image.width, r.image.height) ? '' : ' is-whole'}`}
                src={r.image.src}
                srcSet={r.image.srcSet}
                sizes="(max-width: 599px) 88px, 128px"
                width={r.image.width}
                height={r.image.height}
                alt=""
                loading="lazy"
                decoding="async"
              />
            </li>
          ))}
        </ol>

        <div className="preview" aria-hidden="true">
          <div className="preview__frame">
            {releases.map((r, i) => (
              <img
                key={`${r.tag}-${r.dateTime}`}
                className={`preview__img${i === active ? ' is-on' : ''}${fills(r.image.width, r.image.height) ? '' : ' is-whole'}`}
                src={r.image.src}
                srcSet={r.image.srcSet}
                sizes="(min-width: 1100px) 30vw, 1px"
                width={r.image.width}
                height={r.image.height}
                alt=""
                loading="lazy"
                decoding="async"
              />
            ))}
            <span className="corners" />
          </div>
        </div>
      </div>
    </section>
  );
}
