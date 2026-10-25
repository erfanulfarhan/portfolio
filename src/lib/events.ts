// Small page-wide signals between components that are not parent and child.

const OPEN_CHAT = 'site:open-chat';

/** Opens the assistant. `opener` gets focus back when it closes (Safari does not focus clicked buttons). */
export function openChat(opener?: HTMLElement | null) {
  window.dispatchEvent(new CustomEvent<HTMLElement | null>(OPEN_CHAT, { detail: opener ?? null }));
}

export function onOpenChat(handler: (opener: HTMLElement | null) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<HTMLElement | null>).detail);
  window.addEventListener(OPEN_CHAT, listener);
  return () => window.removeEventListener(OPEN_CHAT, listener);
}

const TRANSMIT = 'site:transmit';

export type Point = { x: number; y: number };

/** Rings that spread out over the page from a point, e.g. when a message is sent. */
export function transmit(from: Point) {
  window.dispatchEvent(new CustomEvent<Point>(TRANSMIT, { detail: from }));
}

export function onTransmit(handler: (from: Point) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<Point>).detail);
  window.addEventListener(TRANSMIT, listener);
  return () => window.removeEventListener(TRANSMIT, listener);
}
