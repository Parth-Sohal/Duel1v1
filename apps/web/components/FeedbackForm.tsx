'use client';

import { useState } from 'react';

/**
 * F10 feedback form (docs/features/F10-hardening.md): one short note per
 * send, 500-char cap, rate-limited server-side (3 per 10 min). Lives on the
 * player's profile — the owner reads the notes from the DB / counts endpoint.
 */
export function FeedbackForm() {
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const remaining = 500 - message.length;

  const send = async () => {
    const trimmed = message.trim();
    if (trimmed.length === 0 || state === 'sending') return;
    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (res.ok) {
        setMessage('');
        setState('sent');
        return;
      }
      setError(data?.message ?? 'Could not send right now — try again in a few minutes.');
      setState('error');
    } catch {
      setError('Could not reach the arena. Check your connection.');
      setState('error');
    }
  };

  return (
    <div className="max-w-md border border-line-light bg-sand/60 p-4">
      <div className="mb-2 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-carbon">
        <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
        Feedback to the owner
      </div>
      {state === 'sent' ? (
        <p className="font-grotesk text-sm leading-relaxed text-carbon">
          Sent — the owner reads every note. Thank you.
        </p>
      ) : (
        <>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
            placeholder="What works, what bugs you, what to add next…"
            rows={3}
            maxLength={500}
            aria-label="Feedback message"
            className="w-full resize-none border border-line-light bg-cream px-3 py-2.5 font-grotesk text-sm text-carbon outline-none placeholder:text-neutral-400 focus:border-accent"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className={`font-mono text-xs ${remaining < 60 ? 'text-accent' : 'text-muted'}`}>{remaining}</span>
            <button
              type="button"
              onClick={send}
              disabled={state === 'sending' || message.trim().length === 0}
              className="flex-shrink-0 border border-carbon bg-carbon px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.1em] text-cream transition-colors hover:bg-accent hover:text-carbon disabled:cursor-not-allowed disabled:opacity-40"
            >
              {state === 'sending' ? 'Sending…' : 'Send'}
            </button>
          </div>
          {state === 'error' && <p className="mt-2 font-grotesk text-xs text-accent">{error}</p>}
        </>
      )}
    </div>
  );
}
