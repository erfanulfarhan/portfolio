import { useEffect, useRef } from 'react';
import { onTransmit } from '../lib/events';

/**
 * Two rings that spread out across the page from wherever a message was sent.
 * Each is drawn once at its full size and scaled up from a dot, so the
 * animation is a cheap transform; the line keeps its width as it grows.
 */
export function Transmission() {
  const ringsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let anims: Animation[] = [];
    const off = onTransmit(({ x, y }) => {
      const rings = Array.from(ringsRef.current?.children ?? []) as SVGSVGElement[];
      anims.forEach((a) => a.cancel());
      // Far enough to clear the furthest corner of the screen.
      const reach = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      anims = rings.map((ring, i) => {
        ring.style.left = `${x - reach}px`;
        ring.style.top = `${y - reach}px`;
        ring.style.width = ring.style.height = `${reach * 2}px`;
        return ring.animate(
          [
            { transform: `scale(${12 / reach})`, opacity: 0.9 },
            { transform: 'scale(1)', opacity: 0 },
          ],
          { duration: 1500, delay: i * 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
        );
      });
    });
    return () => {
      off();
      anims.forEach((a) => a.cancel());
    };
  }, []);

  return (
    <div ref={ringsRef} aria-hidden="true">
      {[0, 1].map((i) => (
        <svg key={i} className="transmission" viewBox="-50 -50 100 100">
          <circle r="49" vectorEffect="non-scaling-stroke" />
        </svg>
      ))}
    </div>
  );
}
