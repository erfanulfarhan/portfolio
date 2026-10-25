import {
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { readouts, skillGroups } from '../data/site';
import { reducedMotion, scrollToTarget } from '../lib/motion';

/* ---------- a tiny syntax highlighter's worth of tokens ---------- */

type Token = { t: string; c?: 'kw' | 'str' | 'prop' | 'num' | 'com' | 'fn' | 'head' };
type Line = Token[];

const kw = (t: string): Token => ({ t, c: 'kw' });
const str = (t: string): Token => ({ t, c: 'str' });
const prop = (t: string): Token => ({ t, c: 'prop' });
const com = (t: string): Token => ({ t, c: 'com' });
const fn = (t: string): Token => ({ t, c: 'fn' });
const head = (t: string): Token => ({ t, c: 'head' });
const plain = (t: string): Token => ({ t });

const quote = (s: string) => `'${s}'`;

const aboutTs: Line[] = [
  [com('// whoami')],
  [kw('export'), plain(' '), kw('const'), plain(' '), fn('me'), plain(' = {')],
  [plain('  '), prop('name'), plain(': '), str(quote('Erfanul Hakim Farhan')), plain(',')],
  [plain('  '), prop('role'), plain(': '), str(quote('AI and automation developer')), plain(',')],
  [plain('  '), prop('basedIn'), plain(': '), str(quote('Bangladesh')), plain(',')],
  [plain('  '), prop('openTo'), plain(': '), str(quote('freelance work')), plain(',')],
  [plain('  '), prop('builds'), plain(': [')],
  [plain('    '), str(quote('AI tools that keep working while nobody is watching')), plain(',')],
  [plain('    '), str(quote('a speedtest that shows the gap between local and international internet')), plain(',')],
  [plain('    '), str(quote('an assistant that reads your screen')), plain(',')],
  [plain('    '), str(quote('bots that watch a page and act the moment it changes')), plain(',')],
  [plain('  ],')],
  [
    plain('  '),
    prop('process'),
    plain(': ['),
    str(quote('design it')),
    plain(', '),
    str(quote('build it')),
    plain(', '),
    str(quote('ship it live')),
    plain('],'),
  ],
  [plain('};')],
];

const skillsJson: Line[] = [
  [plain('{')],
  ...skillGroups.map(([group, items], i): Line => [
    plain('  '),
    prop(`"${group}"`),
    plain(': ['),
    ...items.flatMap((item, j) => [str(`"${item}"`), plain(j < items.length - 1 ? ', ' : '')]),
    plain(i < skillGroups.length - 1 ? '],' : ']'),
  ]),
  [plain('}')],
];

const readme: Line[] = [
  [head('# Erfanul Hakim Farhan')],
  [],
  [plain("I'm a developer from Bangladesh. I build AI tools and automation")],
  [plain('that keep working while nobody is watching.')],
  [],
  [head('- '), plain('A speedtest that shows the gap between local and international internet')],
  [head('- '), plain('An assistant that reads your screen')],
  [head('- '), plain('Bots that watch a page and act the moment it changes')],
  [],
  [plain('I design it, build it and ship it live. Open to freelance work.')],
];

const FILES = [
  { id: 'about', name: 'about.ts', lang: 'TypeScript', dot: '#3b82c4', lines: aboutTs },
  { id: 'skills', name: 'skills.json', lang: 'JSON', dot: '#e0b04c', lines: skillsJson },
  { id: 'readme', name: 'README.md', lang: 'Markdown', dot: '#8fd3c1', lines: readme },
] as const;
type FileId = (typeof FILES)[number]['id'];

const lineText = (line: Line) => line.map((tok) => tok.t).join('');
const charsIn = (line: Line) => Math.max(1, lineText(line).length);

// The first file types itself out: this many ms a character, and a short pause at each line end.
const CHAR_MS = 5;
const LINE_MS = 70;

/** When each line starts typing, and when the last one ends, in ms. */
function typing(lines: Line[]) {
  let at = 0;
  const starts = lines.map((line) => {
    const start = at;
    at += charsIn(line) * CHAR_MS + LINE_MS;
    return start;
  });
  return { starts, total: at };
}

function Code({ lines }: { lines: Line[] }) {
  const { starts } = typing(lines);
  return (
    <>
      {lines.map((line, i) => (
        <div
          className="code__line"
          key={i}
          style={
            {
              '--i': i,
              '--chars': charsIn(line),
              '--at': `${starts[i]}ms`,
              '--dur': `${charsIn(line) * CHAR_MS}ms`,
            } as CSSProperties
          }
        >
          <span className="code__no" aria-hidden="true">
            {i + 1}
          </span>
          <span className="code__text">
            {line.length === 0 ? ' ' : line.map((tok, j) => <span key={j} className={tok.c ? `tk-${tok.c}` : undefined}>{tok.t}</span>)}
          </span>
        </div>
      ))}
    </>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const intro = typing(FILES[0].lines);

/**
 * whoami, as the editor it was written in: a file explorer, three files to
 * flick between, and a terminal underneath with the numbers. The first time it
 * scrolls into view the code types itself out, then the terminal runs.
 */
export function About() {
  const [active, setActive] = useState<FileId>('about');
  // On screen yet, and whether the typing has finished (or been skipped by switching files).
  const [typed, setTyped] = useState(reducedMotion);
  const [introDone, setIntroDone] = useState(reducedMotion);
  const windowRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const file = FILES.find((f) => f.id === active)!;

  // Types the code out once, the first time the editor is on screen.
  useEffect(() => {
    if (typed || !windowRef.current) return;
    // Any overlap with the upper four fifths of the screen counts, so an editor
    // taller than the screen (at high zoom, say) still gets its turn.
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[entries.length - 1].isIntersecting) return;
        setTyped(true);
        io.disconnect();
      },
      { threshold: 0, rootMargin: '0px 0px -20% 0px' },
    );
    io.observe(windowRef.current);
    return () => io.disconnect();
  }, [typed]);

  const open = (id: FileId) => {
    setActive(id);
    setIntroDone(true);
  };

  // The intro ends when the terminal's last line has appeared.
  const onIntroEnd = (e: AnimationEvent) => {
    if (e.animationName === 'term-in' && (e.target as HTMLElement).classList.contains('term__line--last')) setIntroDone(true);
  };

  // Arrow keys move between tabs, as in any tab strip.
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = FILES.findIndex((f) => f.id === active);
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? FILES.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const target = FILES[(next + FILES.length) % FILES.length];
    open(target.id);
    tabsRef.current?.querySelector<HTMLButtonElement>(`#tab-${target.id}`)?.focus();
  };

  const go = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    scrollToTarget(id);
  };

  const lastLine = file.lines.length;
  const lastCol = lineText(file.lines[lastLine - 1]).length + 1;

  return (
    <section id="about" className="about scene-light" aria-labelledby="about-title">
      <h2 id="about-title" className="sr-only">
        About Erfanul
      </h2>
      <p className="label about__label">
        <span className="label__prompt">$</span> whoami
      </p>

      <div
        className={`ide${typed ? ' is-typed' : ''}${introDone ? '' : ' is-intro'}`}
        ref={windowRef}
        style={{ '--typed-ms': `${intro.total}ms` } as CSSProperties}
        onAnimationEnd={onIntroEnd}
      >
        <div className="ide__titlebar">
          <span className="ide__lights" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="ide__path">
            portfolio <span>/</span> src <span>/</span> {file.name}
          </span>
        </div>

        <div className="ide__body">
          <div className="ide__activity" aria-hidden="true">
            <Icon>
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
              <path d="M14 3v5h5" />
            </Icon>
            <Icon>
              <circle cx="11" cy="11" r="6" />
              <path d="m20 20-4.5-4.5" />
            </Icon>
            <Icon>
              <circle cx="6" cy="6" r="2.2" />
              <circle cx="6" cy="18" r="2.2" />
              <circle cx="18" cy="8" r="2.2" />
              <path d="M6 8.2v7.6M18 10.2c0 3.8-6 3.8-11.6 5.6" />
            </Icon>
          </div>

          <nav className="ide__explorer" aria-label="Files">
            <p className="ide__explorer-title">Explorer</p>
            <p className="ide__folder is-open">portfolio</p>
            <ul>
              {FILES.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className="ide__file"
                    aria-current={active === f.id ? 'true' : undefined}
                    onClick={() => open(f.id)}
                  >
                    <i style={{ background: f.dot }} aria-hidden="true" />
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>
            <a className="ide__folder" href="#roll" onClick={go('#roll')}>
              projects <span>15</span>
            </a>
            <a className="ide__folder" href="#log" onClick={go('#log')}>
              releases <span>6</span>
            </a>
          </nav>

          <div className="ide__main">
            <div className="ide__tabs" role="tablist" aria-label="Open files" ref={tabsRef}>
              {FILES.map((f) => (
                <button
                  key={f.id}
                  id={`tab-${f.id}`}
                  type="button"
                  role="tab"
                  className="ide__tab"
                  aria-selected={active === f.id}
                  aria-controls={`panel-${f.id}`}
                  tabIndex={active === f.id ? 0 : -1}
                  onClick={() => open(f.id)}
                  onKeyDown={onTabKey}
                >
                  <i style={{ background: f.dot }} aria-hidden="true" />
                  {f.name}
                </button>
              ))}
            </div>

            {FILES.map((f) => (
              <div
                key={f.id}
                id={`panel-${f.id}`}
                role="tabpanel"
                aria-labelledby={`tab-${f.id}`}
                className="code"
                hidden={active !== f.id}
                tabIndex={0}
              >
                <Code lines={f.lines} />
              </div>
            ))}

            <div className="term">
              <p className="term__title" aria-hidden="true">
                Terminal
              </p>
              <p className="term__line">
                <span className="term__prompt">~/portfolio $</span> ./stats.sh
              </p>
              {readouts.map((r, j) => (
                <p className="term__line term__out" key={r.label} style={{ '--j': j + 1 } as CSSProperties}>
                  <span className="term__key">{r.label.toLowerCase()}</span>
                  <span className="term__val">
                    {r.value}
                    {r.unit}
                  </span>
                  <span className="term__note">{r.note}</span>
                </p>
              ))}
              <p className="term__line term__line--last" style={{ '--j': readouts.length + 1 } as CSSProperties}>
                <span className="term__prompt">~/portfolio $</span> <span className="term__caret" aria-hidden="true" />
              </p>
            </div>
          </div>
        </div>

        <div className="ide__status" aria-hidden="true">
          <span>
            <Icon>
              <circle cx="6" cy="6" r="2.2" />
              <circle cx="6" cy="18" r="2.2" />
              <circle cx="18" cy="8" r="2.2" />
              <path d="M6 8.2v7.6M18 10.2c0 3.8-6 3.8-11.6 5.6" />
            </Icon>
            main
          </span>
          <span>0 problems</span>
          <span className="ide__status-gap" />
          <span>
            Ln {lastLine}, Col {lastCol}
          </span>
          <span>UTF-8</span>
          <span>{file.lang}</span>
          <span className="ide__status-live">Open to freelance work</span>
        </div>
      </div>
    </section>
  );
}
