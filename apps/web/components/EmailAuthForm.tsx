'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN, PASSWORD_MIN, PASSWORD_MAX } from '@coding-arena/shared';

type Mode = 'signin' | 'create';

/**
 * Manual email + password auth (F03): sign in or create an account on the
 * same form (toggle). The server re-validates everything; its verdict is
 * the one that counts. On success the player lands on /profile with the
 * same session/cookie a Google sign-in produces.
 */
export function EmailAuthForm() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const nameLength = displayName.trim().length;
  const nameOk = nameLength >= DISPLAY_NAME_MIN && nameLength <= DISPLAY_NAME_MAX;
  const passwordOk = password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const canSubmit = emailOk && passwordOk && (mode === 'signin' || nameOk) && !busy;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    const body =
      mode === 'create'
        ? { email: email.trim(), password, displayName: displayName.trim() }
        : { email: email.trim(), password };

    fetch(`/api/auth/${mode === 'create' ? 'register' : 'login'}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (res.ok) {
          window.dispatchEvent(new Event('arena:session-changed'));
          router.replace('/profile');
          return;
        }
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? 'Something went wrong. Please try again.');
        setBusy(false);
      })
      .catch(() => {
        setError('Network error — please try again.');
        setBusy(false);
      });
  };

  const field =
    'w-full border border-line-dark bg-surface/60 px-3 py-2.5 font-grotesk text-sm text-cream outline-none transition-colors placeholder:text-neutral-500 focus:border-accent';
  const label = 'mb-1.5 block font-mono text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400';

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Mode toggle */}
      <div className="flex border border-line-dark" role="tablist" aria-label="Email sign-in mode">
        {(['signin', 'create'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 py-2 font-mono text-xs font-bold uppercase tracking-[0.1em] transition-colors ${
              mode === m ? 'bg-cream text-carbon' : 'text-neutral-400 hover:text-cream'
            }`}
          >
            {m === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      {mode === 'create' && (
        <div>
          <label htmlFor="auth-name" className={label}>
            Display name
          </label>
          <input
            id="auth-name"
            type="text"
            autoComplete="nickname"
            value={displayName}
            maxLength={DISPLAY_NAME_MAX + 10}
            onChange={(e) => setDisplayName(e.target.value)}
            className={field}
            placeholder="How rivals see you"
          />
          <p className={`mt-1 font-mono text-xs tracking-[0.05em] ${nameOk || nameLength === 0 ? 'text-neutral-500' : 'text-accent'}`}>
            {nameLength}/{DISPLAY_NAME_MAX} — between {DISPLAY_NAME_MIN} and {DISPLAY_NAME_MAX} characters
          </p>
        </div>
      )}

      <div>
        <label htmlFor="auth-email" className={label}>
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="auth-password" className={label}>
          Password
        </label>
        <input
          id="auth-password"
          type="password"
          autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
          value={password}
          maxLength={PASSWORD_MAX}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
          placeholder={mode === 'create' ? `At least ${PASSWORD_MIN} characters` : 'Your password'}
        />
      </div>

      {error && (
        <p role="alert" className="border border-accent/40 bg-accent/10 p-3 font-grotesk text-sm text-cream">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full border border-carbon/40 bg-accent py-3 font-mono text-sm font-bold uppercase tracking-[0.1em] text-carbon transition-colors hover:bg-[#ff6231] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'One moment…' : mode === 'create' ? 'Create account' : 'Sign in with email'}
      </button>

      {mode === 'signin' && (
        <p className="font-grotesk text-sm text-neutral-400">
          No account yet? Switch to{' '}
          <button
            type="button"
            onClick={() => setMode('create')}
            className="font-semibold text-accent underline decoration-accent/60 underline-offset-2 hover:decoration-accent"
          >
            Create account
          </button>
          .
        </p>
      )}
    </form>
  );
}
