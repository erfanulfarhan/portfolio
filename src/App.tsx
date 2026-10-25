import { useEffect } from 'react';
import { ScrollTrigger, scrollToTarget, startSmoothScroll, whenIntro } from './lib/motion';
import { Boot } from './components/Boot';
import { PageBackground } from './components/PageBackground';
import { Hud } from './components/Hud';
import { Reticle } from './components/Reticle';
import { Transmission } from './components/Transmission';
import { Hero } from './components/Hero';
import { Work } from './components/Work';
import { About } from './components/About';
import { Modes } from './components/Modes';
import { Log } from './components/Log';
import { Contact } from './components/Contact';
import { ChatWidget } from './components/ChatWidget';
import { ProjectDialogProvider } from './components/work/ProjectDialog';

export function App() {
  useEffect(() => startSmoothScroll(), []);

  useEffect(() => {
    // Each scene registers its ScrollTriggers as it mounts. Re-measure them top to
    // bottom once everything exists, and again when fonts and images change sizes.
    const refresh = () => {
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    };
    refresh();
    let alive = true;
    document.fonts?.ready.then(() => alive && refresh());
    window.addEventListener('load', refresh);
    return () => {
      alive = false;
      window.removeEventListener('load', refresh);
    };
  }, []);

  // The page always opens at the top for the intro; a link like /#contact then
  // carries on to its section.
  useEffect(() => {
    let alive = true;
    const hash = window.location.hash;
    if (!/^#[a-z]+$/.test(hash) || hash === '#home') return;
    whenIntro('done').then(() => {
      if (alive && document.querySelector(hash)) scrollToTarget(hash);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ProjectDialogProvider>
      <Boot />
      <PageBackground />
      <Hud />
      <main>
        <Hero />
        <Work />
        <About />
        <Modes />
        <Log />
        <Contact />
      </main>
      <ChatWidget />
      <Transmission />
      <Reticle />
    </ProjectDialogProvider>
  );
}
