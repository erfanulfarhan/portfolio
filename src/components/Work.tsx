import { useRef, type MouseEvent } from 'react';
import { isLive, projects, reel, type Project } from '../data/site';
import { gsap, playDemos, reducedMotion, ScrollTrigger, scrollToTarget, useGSAP } from '../lib/motion';
import { ArrowDown } from './Icons';
import { DemoVideo } from './work/DemoVideo';
import { useOpenProject } from './work/ProjectDialog';

function status(p: Project) {
  if (p.links.live || p.links.site) return { label: 'Live', live: true };
  if (p.links.download) return { label: 'Download', live: false };
  return { label: 'Source', live: false };
}

/** Five selected projects on a strip that pans sideways while you scroll. */
function Reel() {
  const open = useOpenProject();
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (reducedMotion) return;
      const track = trackRef.current!;
      const frames = gsap.utils.toArray<HTMLElement>('.frame', track);
      const shots = frames.map((f) => f.querySelector<HTMLElement>('.frame__shot')!);
      const mm = gsap.matchMedia();

      mm.add({ wide: '(min-width: 768px)', narrow: '(max-width: 767px)' }, (ctx) => {
        const { wide } = ctx.conditions as { wide: boolean };
        if (!wide) {
          // Stacked on phones: each frame pulls into focus as it reaches the middle.
          shots.forEach((shot) => {
            gsap.fromTo(
              shot,
              { filter: 'blur(6px)', scale: 0.94 },
              {
                filter: 'blur(0px)',
                scale: 1,
                ease: 'none',
                scrollTrigger: { trigger: shot, start: 'top 95%', end: 'center 55%', scrub: 0.6 },
              },
            );
          });
          return;
        }

        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const wind = gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: pinRef.current,
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.8,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              if (barRef.current) barRef.current.style.transform = `scaleX(${self.progress.toFixed(4)})`;
            },
          },
        });

        // Tabbing to a frame that is still off to the side pans the strip until it is centred.
        const onFocus = (e: FocusEvent) => {
          const item = (e.target as HTMLElement).closest<HTMLElement>('.frame, .reel__intro, .reel__end');
          const st = wind.scrollTrigger;
          const d = distance();
          if (!item || !st || !d) return;
          const x = Math.min(0, Math.max(-d, window.innerWidth / 2 - (item.offsetLeft + item.offsetWidth / 2)));
          scrollToTarget(st.start + (-x / d) * (st.end - st.start));
        };
        track.addEventListener('focusin', onFocus);

        // Depth of focus: frames are sharp in the middle of the screen and soften toward the edges.
        let centres: number[] = [];
        const measure = () => {
          centres = frames.map((f) => f.offsetLeft + f.offsetWidth / 2);
        };
        measure();
        ScrollTrigger.addEventListener('refresh', measure);
        let lastX = Number.NaN;
        const pull = () => {
          const x = gsap.getProperty(track, 'x') as number;
          if (x === lastX) return;
          lastX = x;
          const mid = window.innerWidth / 2;
          const reach = window.innerWidth * 0.7;
          frames.forEach((frame, i) => {
            const off = Math.min(1, Math.abs(centres[i] + x - mid) / reach);
            const soft = Math.max(0, (off - 0.2) / 0.8);
            shots[i].style.filter = soft > 0.01 ? `blur(${(soft * 2).toFixed(2)}px)` : '';
            frame.style.setProperty('--focus', (1 - off).toFixed(3));
          });
        };
        gsap.ticker.add(pull);
        pull();
        return () => {
          track.removeEventListener('focusin', onFocus);
          gsap.ticker.remove(pull);
          ScrollTrigger.removeEventListener('refresh', measure);
          frames.forEach((frame, i) => {
            shots[i].style.filter = '';
            frame.style.removeProperty('--focus');
          });
        };
      });
    },
    { scope: pinRef },
  );

  const toRoll = (e: MouseEvent) => {
    e.preventDefault();
    scrollToTarget('#roll');
  };

  return (
    <div className="reel" ref={pinRef}>
      <div className="reel__track" ref={trackRef}>
        <header className="reel__intro">
          <p className="label">Observations</p>
          <h2 id="work-title" className="reel__title">
            Five things I shipped, and still run.
          </h2>
          <p className="reel__hint">Keep scrolling to pan across.</p>
        </header>

        {reel.map((project, i) => {
          const s = status(project);
          const picture = project.wide ?? project.tall;
          return (
            <article className="frame" key={project.slug}>
              <button
                type="button"
                className="frame__shot"
                onClick={(e) => open(project, e.currentTarget, 'wide')}
                aria-label={`Open ${project.name}`}
              >
                {project.demo && playDemos ? (
                  <DemoVideo demo={project.demo} />
                ) : (
                  picture && (
                    <img
                      src={picture.src}
                      srcSet={picture.srcSet}
                      sizes="(max-width: 767px) 92vw, min(60vw, 62rem)"
                      width={picture.width}
                      height={picture.height}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  )
                )}
                <span className="corners" aria-hidden="true" />
              </button>
              <div className="frame__caption">
                <p className="frame__meta">
                  <span>EHF {i + 1}</span>
                  <span className={`frame__status${s.live ? ' is-live' : ''}`}>{s.label}</span>
                </p>
                <h3 className="frame__name">{project.name}</h3>
                <p className="frame__line">{project.summary}</p>
              </div>
            </article>
          );
        })}

        <div className="reel__end">
          <p className="reel__end-title">{projects.length - reel.length} more in the catalogue.</p>
          <a className="btn btn--line" href="#roll" onClick={toRoll}>
            <span>See every project</span>
            <ArrowDown size={15} />
          </a>
        </div>
      </div>
      <div className="reel__bar" aria-hidden="true">
        <span ref={barRef} />
      </div>
    </div>
  );
}

/** Every project as a numbered catalogue. Live ones carry a small tag. */
function Roll() {
  const open = useOpenProject();
  const rollRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reducedMotion) return;
      const grid = rollRef.current!.querySelector('.roll__grid');
      gsap.fromTo(
        '.tile',
        { y: 26, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.05,
          ease: 'power3.out',
          scrollTrigger: { trigger: grid, start: 'top 82%' },
        },
      );
    },
    { scope: rollRef },
  );

  return (
    <div id="roll" className="roll" ref={rollRef}>
      <header className="roll__head">
        <p className="label">Catalogue</p>
        <h2 className="roll__title">All fifteen projects, catalogued.</h2>
      </header>
      <ol className="roll__grid">
        {projects.map((project, i) => {
          const picture = project.tall ?? project.wide;
          return (
            <li key={project.slug}>
              <button
                type="button"
                className="tile"
                onClick={(e) =>
                  open(project, e.currentTarget, 'tall', e.currentTarget.querySelector('.tile__shot'))
                }
              >
                <span className="tile__frame">
                  <span className="tile__shot">
                    {picture ? (
                      <img
                        src={picture.src}
                        srcSet={picture.srcSet}
                        sizes="(max-width: 560px) 46vw, (max-width: 860px) 31vw, (max-width: 1100px) 23vw, 18vw"
                        width={picture.width}
                        height={picture.height}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="tile__type" aria-hidden="true">
                        {project.name}
                      </span>
                    )}
                  </span>
                  {isLive(project) && (
                    <span className="tile__live" aria-hidden="true">
                      Live
                    </span>
                  )}
                </span>
                <span className="tile__no" aria-hidden="true">
                  EHF {i + 1}
                </span>
                <span className="tile__name">{project.name}</span>
                <span className="tile__kind">
                  {project.kind}
                  {isLive(project) && <span className="sr-only">, live</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function Work() {
  return (
    <section id="work" className="work scene-dark" aria-labelledby="work-title">
      <Reel />
      <Roll />
    </section>
  );
}
