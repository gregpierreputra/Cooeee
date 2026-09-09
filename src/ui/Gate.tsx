import { type FormEvent, useEffect, useState } from 'react';
import * as copy from '../core/copy';
import { postGate } from '../data/gate';
import Mark from './components/Mark';
import { useOnline } from './components/useOnline';

const LOCK_FALLBACK_S = 60;

/** Feature 1: the development gate. One black page, one field, one button.
 *  The server holds the password and enforces the lockout; this screen only
 *  relays its answer and counts the lockout down so the user knows when to
 *  try again. Nothing typed here is stored on the device. */
export default function Gate({ onPass }: { onPass: () => void }) {
  const online = useOnline();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const locked = secondsLeft > 0;
  const status = !online ? copy.GATE_OFFLINE : locked ? copy.GATE_LOCKED(secondsLeft) : message;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || locked || !online || !password) return;
    setBusy(true);
    try {
      const { status, body } = await postGate(password);
      if (status === 200) return onPass();
      if (status === 401) setMessage(copy.GATE_INCORRECT(body.attemptsLeft ?? 0));
      else if (status === 429) setSecondsLeft(body.retryAfterSeconds ?? LOCK_FALLBACK_S);
      else setMessage(copy.GATE_UNAVAILABLE);
    } catch {
      setMessage(copy.GATE_UNAVAILABLE);
    } finally {
      setPassword('');
      setBusy(false);
    }
  }

  return (
    <main className="page gate">
      <header className="hero first-open-hero">
        <Mark className="mark" size={44} />
        <h1>{copy.APP_NAME}</h1>
        <p className="muted">{copy.GATE_LINE}</p>
      </header>

      <form id="gate-form" className="gate-form" onSubmit={submit}>
        <label htmlFor="gate-password">{copy.GATE_TITLE}</label>
        <input
          id="gate-password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          value={password}
          disabled={locked || !online}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        <p className="muted gate-status" role="status" aria-live="polite">
          {status}
        </p>
      </form>

      <div className="actions">
        <button
          type="submit"
          form="gate-form"
          className="action main-action"
          disabled={busy || locked || !online || !password}
        >
          {copy.GATE_SUBMIT}
        </button>
      </div>
    </main>
  );
}
