import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Project } from '../../data/site';
import { lockScroll, playDemos, reducedMotion, unlockScroll } from '../../lib/motion';
import { ArrowUpRight, Close, Code, Download, Play } from '../Icons';
import { DemoVideo } from './DemoVideo';

export type Variant = 'wide' | 'tall';

type DialogRequest = {
  project: Project;
  variant: Variant;
  /** Where the picture grows out of. */
  origin: DOMRect | null;
  /** Gets focus back when the dialog closes. */
  trigger: HTMLElement | null;
};

type Opener = (project: Project, trigger: HTMLElement | null, variant?: Variant, originEl?: Element | null) => void;

const OpenContext = createContext<Opener>(() => {});

/** Opens a project in the full-screen view, from anywhere on the page. */
export const useOpenProject = () => useContext(OpenContext);

export function ProjectDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const open = useCallback<Opener>((project, trigger, variant = 'wide', originEl) => {
    const source = originEl ?? trigger;
    setRequest({ project, variant, trigger, origin: source ? source.getBoundingClientRect() : null });
  }, []);
  const close = useCallback(() => setRequest(null), []);
  return (
    <OpenContext.Provider value={open}>
      {children}
      <ProjectDialog request={request} onClose={close} />
    </OpenContext.Provider>
  );
}

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

function linksFor(project: Project) {
  const { live, site, download, video, repo } = project.links;
  const items: { href: string; label: string; icon: ReactNode }[] = [];
  if (live) items.push({ href: live, label: 'Open the live site', icon: <ArrowUpRight size={15} /> });
  if (site) items.push({ href: site, label: 'Visit the website', icon: <ArrowUpRight size={15} /> });
  if (download) items.push({ href: download, label: 'Download', icon: <Download size={15} /> });
  if (video) items.push({ href: video, label: 'Watch the install video', icon: <Play size={14} /> });
  if (repo) items.push({ href: repo, label: 'Read the source', icon: <Code size={15} /> });
  return items;
}

function ProjectDialog({ request, onClose }: { request: DialogRequest | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const fadeOut = useRef<Animation | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const project = request?.project;
  const picture = !project
    ? undefined
    : request.variant === 'tall'
      ? (project.tall ?? project.wide)
      : (project.wide ?? project.tall);
  const aspect = picture ? picture.width / picture.height : 2 / 3;
  // The desktop view shows the project in use, when there is a recording of it.
  const demo = project?.demo && playDemos && picture === project.wide ? project.demo : undefined;

  useLayoutEffect(() => {
    if (!request) return;
    const dialog = dialogRef.current!;
    const stage = stageRef.current!;
    const media = mediaRef.current!;
    const anims: Animation[] = [];
    closing.current = false;
    lockScroll();
    dialog.showModal();
    dialog.scrollTop = 0;

    // Fit the picture inside the stage at its own aspect ratio.
    const fit = () => {
      const { width, height } = stage.getBoundingClientRect();
      if (!width || !height) return;
      const w = Math.min(width, height * aspect);
      media.style.width = `${Math.floor(w)}px`;
      media.style.height = `${Math.floor(w / aspect)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);

    if (!reducedMotion) {
      anims.push(dialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }));
      const from = request.origin;
      const to = media.getBoundingClientRect();
      if (from && to.width && to.height) {
        anims.push(
          media.animate(
            [
              {
                transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`,
                opacity: 0.35,
              },
              { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            ],
            { duration: 520, easing: EASE_OUT },
          ),
        );
      }
    }

    const onCancel = (e: Event) => {
      e.preventDefault();
      requestClose();
    };
    dialog.addEventListener('cancel', onCancel);

    return () => {
      dialog.removeEventListener('cancel', onCancel);
      ro.disconnect();
      anims.forEach((a) => a.cancel());
      // The fade-out holds its last frame; drop it or the next opening stays invisible.
      fadeOut.current?.cancel();
      fadeOut.current = null;
      if (dialog.open) dialog.close();
      unlockScroll();
      request.trigger?.focus({ preventScroll: true });
    };
  }, [request, aspect]);

  function requestClose() {
    if (closing.current) return;
    closing.current = true;
    const dialog = dialogRef.current;
    if (!dialog || reducedMotion) return onCloseRef.current();
    const fade = dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 170, easing: 'ease-out', fill: 'forwards' });
    fadeOut.current = fade;
    fade.finished.then(
      () => onCloseRef.current(),
      () => onCloseRef.current(),
    );
  }

  return (
    <dialog ref={dialogRef} className="project" aria-labelledby="project-title" data-lenis-prevent>
      {project && (
        <div className="project__inner">
          <header className="project__head">
            <p className="project__kind">{project.kind}</p>
            <button type="button" className="project__close" onClick={requestClose}>
              <span>Close</span>
              <Close size={16} />
            </button>
          </header>

          <div className="project__body">
            <div className="project__stage" ref={stageRef}>
              <div className="project__media" ref={mediaRef}>
                {demo ? (
                  <DemoVideo demo={demo} />
                ) : picture ? (
                  <img
                    src={picture.src}
                    srcSet={picture.srcSet}
                    // The stage beside the text, or the full width once they stack.
                    sizes={
                      picture.width >= picture.height
                        ? '(max-width: 899px) 100vw, 70vw'
                        : '(max-width: 899px) 60vw, calc((100vh - 7rem) * 0.667)'
                    }
                    width={picture.width}
                    height={picture.height}
                    alt={`${project.name}, screenshot`}
                    decoding="async"
                  />
                ) : (
                  <div className="project__card" aria-hidden="true">
                    <span className="project__card-tags">{project.tags.join(' / ').toLowerCase()}</span>
                    <span className="project__card-name">{project.name}</span>
                    <span className="project__card-dot" />
                  </div>
                )}
                <span className="corners" aria-hidden="true" />
              </div>
            </div>

            <div className="project__info">
              <h3 id="project-title" className="project__title">
                {project.name}
              </h3>
              <p className="project__desc">{project.description}</p>
              <ul className="project__tags" aria-label="Built with">
                {project.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
              <ul className="project__links">
                {linksFor(project).map((link) => (
                  <li key={link.href + link.label}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer">
                      <span>{link.label}</span>
                      {link.icon}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
