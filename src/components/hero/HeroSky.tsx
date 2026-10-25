import { useEffect, useRef, useState } from 'react';
import { finePointer, reducedMotion, setSkyStatus, whenIntro } from '../../lib/motion';
import type { BlackHole, SkyShared } from './BlackHole';

/**
 * Loads the black hole while the intro runs, builds its shader once the mark
 * has focused, and starts it as the intro's aperture opens. Reduced motion
 * gets a single still frame; without WebGL, a picture of one.
 */
export function HeroSky({ shared }: { shared: SkyShared }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let scene: BlackHole | null = null;

    const fail = (reason?: unknown) => {
      if (disposed) return;
      if (import.meta.env.DEV && reason) console.warn(reason);
      scene?.release();
      scene = null;
      setSkyStatus('failed');
      setFailed(true);
    };

    setSkyStatus('loading');
    (async () => {
      try {
        const { BlackHole } = await import('./BlackHole');
        if (disposed) return;
        await whenIntro('filled');
        const host = hostRef.current;
        const canvas = canvasRef.current;
        if (disposed || !host || !canvas) return;
        // Held locally: a failure during warmup clears `scene`, and this run must notice.
        const instance = new BlackHole({
          canvas,
          host,
          section: host.closest('section') ?? host,
          shared,
          finePointer,
          still: reducedMotion,
          onLost: () => fail(),
        });
        scene = instance;
        await instance.warmup();
        if (disposed || scene !== instance) return;
        setSkyStatus('ready');
        await whenIntro('lifting');
        if (!disposed && scene === instance) instance.start();
      } catch (err) {
        fail(err);
      }
    })();

    return () => {
      disposed = true;
      scene?.dispose();
      scene = null;
    };
  }, [shared]);

  return (
    <div className="sky" ref={hostRef} aria-hidden="true">
      {failed ? (
        <img className="sky__still" src="/sky/black-hole.webp" width={3200} height={2000} alt="" decoding="async" />
      ) : (
        <canvas ref={canvasRef} className="sky__canvas" />
      )}
    </div>
  );
}
