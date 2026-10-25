import { useEffect, useRef, useState, type FormEvent } from 'react';
import { onOpenChat } from '../lib/events';
import { useIntro } from '../lib/motion';
import { Close, Send, Spark } from './Icons';

type Message = { role: 'user' | 'assistant' | 'error'; text: string; pending?: boolean };

const GREETING = "Hi! I'm Erfanul's assistant. Ask me about his projects, his skills, or what he can build for you.";
const SUGGESTIONS = ['What can Erfanul build for me?', 'Tell me about Delta', "What's his tech stack?"];

/** The "ask about my work" assistant. Answers come from /api/chat, grounded in a profile of the projects. */
export function ChatWidget() {
  const ready = useIntro('done');
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: GREETING }]);
  const [draft, setDraft] = useState('');
  const busy = messages.some((m) => m.pending);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

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
    const history = messages
      .filter((m) => !m.pending && m.role !== 'error' && m.text !== GREETING)
      .map((m) => ({ role: m.role, text: m.text }));
    setDraft('');
    setMessages((list) => [...list, { role: 'user', text: question }, { role: 'assistant', text: '', pending: true }]);

    let reply: Message;
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(), 30000);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: question, history }),
        signal: abort.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (res.ok && data.text) reply = { role: 'assistant', text: data.text };
      else if (res.ok) reply = { role: 'error', text: 'The assistant came back without an answer. Ask again.' };
      else reply = { role: 'error', text: data.error || `The assistant returned an error (${res.status}). Try again in a moment.` };
    } catch {
      reply = abort.signal.aborted
        ? { role: 'error', text: 'The assistant took too long to answer. Try again.' }
        : { role: 'error', text: 'The assistant could not be reached. Check your connection and try again.' };
    } finally {
      window.clearTimeout(timer);
    }
    setMessages((list) => [...list.filter((m) => !m.pending), reply]);
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
            <p className="chat__sub">It answers from a profile of my projects.</p>
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
