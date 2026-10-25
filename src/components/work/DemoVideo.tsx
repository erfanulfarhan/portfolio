import { useEffect, useRef } from 'react';
import type { Demo } from '../../data/site';

/**
 * A muted loop of a project being used. It starts loading as it comes near,
 * plays only while it is on screen, and picks the smaller file when the slot
 * it fills does not need the full one.
 */
export function DemoVideo({ demo, className }: { demo: Demo; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current!;
    let loaded = false;
    const load = () => {
      if (loaded) return;
      loaded = true;
      const needed = video.clientWidth * (window.devicePixelRatio || 1);
      video.src = needed > 1400 ? demo.video : demo.small;
    };
    const near = new IntersectionObserver(
      (entries) => {
        if (!entries[entries.length - 1].isIntersecting) return;
        load();
        near.disconnect();
      },
      { rootMargin: '50%' },
    );
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries[entries.length - 1].isIntersecting) {
          load();
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.35 },
    );
    near.observe(video);
    seen.observe(video);
    return () => {
      near.disconnect();
      seen.disconnect();
      video.pause();
    };
  }, [demo]);

  return (
    <video
      ref={ref}
      className={className}
      poster={demo.poster}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      aria-hidden="true"
    />
  );
}
