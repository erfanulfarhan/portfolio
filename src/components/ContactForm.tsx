import { useRef, useState, type FormEvent } from 'react';
import { contact } from '../data/site';
import { transmit } from '../lib/events';
import { reducedMotion } from '../lib/motion';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string; field?: 'name' | 'email' | 'message' };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Sends through /api/contact, which emails it to me with your address as the reply-to. */
export function ContactForm() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const dishRef = useRef<HTMLSpanElement>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const body = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      message: String(data.get('message') ?? '').trim(),
      hp: String(data.get('hp_ref') ?? ''),
    };

    const reject = (field: 'name' | 'email' | 'message', message: string) => {
      setStatus({ kind: 'error', field, message });
      (form.elements.namedItem(field) as HTMLElement | null)?.focus();
    };
    if (!body.name) return reject('name', 'Add your name so I know who to reply to.');
    if (!EMAIL.test(body.email)) return reject('email', 'That email address looks incomplete. Check it and send again.');
    if (!body.message) return reject('message', 'Write a line or two about the project first.');
    if (body.message.length > 5000) return reject('message', 'The message is over 5,000 characters. Trim it a little.');

    setStatus({ kind: 'sending' });
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(), 20000);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: abort.signal,
      });
      const reply = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(reply.error || `The server answered ${res.status}.`);
      form.reset();
      setStatus({ kind: 'sent', email: body.email });
      const dish = dishRef.current?.getBoundingClientRect();
      if (!reducedMotion && dish) transmit({ x: dish.left + dish.width / 2, y: dish.top + dish.height / 2 });
    } catch (err) {
      const reason = abort.signal.aborted
        ? 'The server took too long to answer.'
        : err instanceof TypeError
          ? 'The message could not reach the server.'
          : (err as Error).message;
      setStatus({ kind: 'error', message: `${reason} You can also email ${contact.email} directly.` });
    } finally {
      window.clearTimeout(timer);
    }
  }

  const invalid = (field: 'name' | 'email' | 'message') =>
    status.kind === 'error' && status.field === field ? true : undefined;

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="form__row">
        <label className="field">
          <span className="field__label">Your name</span>
          <input className="field__input" name="name" autoComplete="name" aria-invalid={invalid('name')} />
        </label>
        <label className="field">
          <span className="field__label">Your email</span>
          <input
            className="field__input"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={invalid('email')}
          />
        </label>
      </div>
      <label className="field">
        <span className="field__label">What should we build?</span>
        <textarea
          className="field__input"
          name="message"
          rows={5}
          aria-invalid={invalid('message')}
          data-lenis-prevent
        />
      </label>
      {/* A trap for bots. Its name is one no browser or password manager fills in. */}
      <input
        className="form__trap"
        type="text"
        name="hp_ref"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        data-lpignore="true"
        data-1p-ignore=""
        data-bwignore=""
        data-form-type="other"
      />

      <div className="form__actions">
        <button type="submit" className="send" disabled={status.kind === 'sending'}>
          <span className="send__dish" ref={dishRef} aria-hidden="true">
            <i />
            <i />
          </span>
          <span>{status.kind === 'sending' ? 'Sending' : 'Send message'}</span>
        </button>
        <p
          className={`form__status${status.kind === 'error' ? ' is-error' : ''}${status.kind === 'sent' ? ' is-sent' : ''}`}
          role="status"
          aria-live="polite"
        >
          {status.kind === 'sent' && `Sent. I'll reply to ${status.email} soon.`}
          {status.kind === 'error' && status.message}
        </p>
      </div>
    </form>
  );
}
