import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { onOpenChat } from '../lib/events';
import { useIntro } from '../lib/motion';
import { Close, Send, Spark } from './Icons';

type Message = { role: 'user' | 'assistant' | 'error' | 'note'; text: string; pending?: boolean };
/** One question and its answer, signed by /api/chat so the transcript can be trusted. */
type Turn = { i: number; q: string; a: string; t: number; m: number; s: string };

const GREETING = "Hi! I'm Erfanul's assistant. Ask me about his projects, his skills, or what he can build for you.";
const SUGGESTIONS = ['What can Erfanul build for me?', 'Tell me about Delta', "What's his tech stack?", 'Leave Erfanul a message'];

const MAX_TURNS = 40;
// A chat left open this long after its last answer is sent on anyway.
const IDLE_MS = 10 * 60 * 1000;

const randomId = (bytes: number) =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

// A random id kept in this browser, so a transcript shows when someone comes back.
function visitorTag() {
  try {
    let visitor = localStorage.getItem('chat-visitor');
    if (!visitor) {
      visitor = randomId(6);
      localStorage.setItem('chat-visitor', visitor);
    }
    const chats = Number(localStorage.getItem('chat-count') || 0) + 1;
    localStorage.setItem('chat-count', String(chats));
    return { visitor, chats };
  } catch {
    return { visitor: '', chats: 0 };
  }
}

const pageFacts = () => ({
  ref: document.referrer,
  page: location.href,
  lang: navigator.language,
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  screen: `${screen.width}x${screen.height}`,
  touch: navigator.maxTouchPoints > 0,
});

/**
 * The "ask about my work" assistant. Answers come from /api/chat, grounded in a
 * profile of the projects; it can also pass a visitor's message on by email.
 * When the visitor closes it or leaves, the chat goes to /api/transcript so it
 * reaches my inbox, which the panel says.
 */
export function ChatWidget() {
  const ready = useIntro('done');
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: GREETING }]);
  const [draft, setDraft] = useState('');
  const busy = messages.some((m) => m.pending);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // The conversation as the server signed it, and how much of it has been sent on.
  const [cid] = useState(() => randomId(16));
  const turns = useRef<Turn[]>([]);
  const visitor = useRef<{ visitor: string; chats: number } | null>(null);
  const sentTurns = useRef(0);
  const sends = useRef(0);
  const idle = useRef(0);

  const flush = useCallback(() => {
    window.clearTimeout(idle.current);
    if (turns.current.length <= sentTurns.current) return;
    sentTurns.current = turns.current.length;
    sends.current += 1;
    const meta = { ...pageFacts(), ...visitor.current, part: sends.current };
    // A beacon carries at most 64 KB, so the oldest turns go first if it is long.
    let kept = turns.current.slice(-MAX_TURNS);
    let body = JSON.stringify({ cid, turns: kept, meta });
    while (new Blob([body]).size > 60000 && kept.length > 1) {
      kept = kept.slice(1);
      body = JSON.stringify({ cid, turns: kept, meta });
    }
    const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
    let queued = false;
    try {
      queued = navigator.sendBeacon?.('/api/transcript', blob) ?? false;
    } catch {
      queued = false;
    }
    if (!queued) {
      fetch('/api/transcript', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain;charset=UTF-8' } }).catch(
        () => {},
      );
    }
  }, [cid]);

  // Sent when the visitor closes the chat, switches away or leaves the page.
  useEffect(() => {
    if (!open) flush();
  }, [open, flush]);
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      window.clearTimeout(idle.current);
    };
  }, [flush]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, open]);

  // Focus goes back to whichever button opened it: this one or the hero's.
  const returnFocus = useRef<HTMLElement | null>(null);
  const close = () => {
    setOpen(false);
    (returnFocus.current ?? toggleRef.current)?.focus();
  };

  // The hero's "Ask my AI" button opens it too.
  useEffect(
    () =>
      onOpenChat((opener) => {
        returnFocus.current = opener;
        setOpen(true);
      }),
    [],
  );

  // The hero has its own button, so the floating one waits until that has scrolled away.
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      setPastHero(window.scrollY > window.innerHeight * 0.6);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      (returnFocus.current ?? toggleRef.current)?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    visitor.current ??= visitorTag();
    setDraft('');
    setMessages((list) => [...list, { role: 'user', text: question }, { role: 'assistant', text: '', pending: true }]);

    const replies: Message[] = [];
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(), 30000);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: question,
          cid,
          turns: turns.current.slice(-MAX_TURNS),
          meta: { ...pageFacts(), ...visitor.current },
        }),
        signal: abort.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string; sent?: boolean; turn?: Turn };
      if (res.ok && data.text) {
        replies.push({ role: 'assistant', text: data.text });
        if (data.sent) replies.push({ role: 'note', text: 'Message sent to Erfanul' });
        if (data.turn) {
          turns.current = [...turns.current, data.turn];
          window.clearTimeout(idle.current);
          idle.current = window.setTimeout(flush, IDLE_MS);
        }
      } else if (res.ok) replies.push({ role: 'error', text: 'The assistant came back without an answer. Ask again.' });
      else replies.push({ role: 'error', text: data.error || `The assistant returned an error (${res.status}). Try again in a moment.` });
    } catch {
      replies.push(
        abort.signal.aborted
          ? { role: 'error', text: 'The assistant took too long to answer. Try again.' }
          : { role: 'error', text: 'The assistant could not be reached. Check your connection and try again.' },
      );
    } finally {
      window.clearTimeout(timer);
    }
    setMessages((list) => [...list.filter((m) => !m.pending), ...replies]);
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(draft);
  };

  if (!ready) return null;
  const asked = messages.some((m) => m.role === 'user');

  return (
    <>
      <div id="chat-panel" className="chat" role="dialog" aria-label="Ask about my work" hidden={!open} data-lenis-prevent>
        <div className="chat__head">
          <div>
            <p className="chat__title">Ask my AI</p>
            <p className="chat__sub">It answers from a profile of my projects and can pass a message on to me.</p>
          </div>
          <button type="button" className="chat__close" onClick={close}>
            <span className="sr-only">Close the assistant</span>
            <Close size={18} />
          </button>
        </div>

        <div className="chat__log" ref={logRef} aria-live="polite">
          {messages.map((m, i) => (
            <p key={i} className={`msg msg--${m.role}${m.pending ? ' is-pending' : ''}`}>
              {m.pending ? (
                <span className="msg__dots" aria-label="Thinking">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                m.text
              )}
            </p>
          ))}
        </div>

        {!asked && (
          <div className="chat__suggest">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        <form className="chat__form" onSubmit={submit}>
          <label className="sr-only" htmlFor="chat-input">
            Your question
          </label>
          <input
            id="chat-input"
            ref={inputRef}
            className="chat__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about a project"
            autoComplete="off"
            maxLength={600}
          />
          <button type="submit" className="chat__send" disabled={busy || !draft.trim()}>
            <span className="sr-only">Send</span>
            <Send size={16} />
          </button>
        </form>
        <p className="chat__note">I read these chats, with your IP address, location and device, to follow up and to stop abuse.</p>
      </div>

      <button
        ref={toggleRef}
        type="button"
        className={`chat-fab${pastHero || open ? '' : ' is-hidden'}`}
        aria-expanded={open}
        aria-controls="chat-panel"
        onClick={() => {
          returnFocus.current = toggleRef.current;
          setOpen((o) => !o);
        }}
      >
        <Spark size={15} />
        <span>{open ? 'Close the assistant' : 'Ask my AI'}</span>
      </button>
    </>
  );
}
