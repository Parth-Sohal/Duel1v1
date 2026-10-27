'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * OAuth redirect target: Google returns the ID token in the URL fragment
 * (#id_token=...). We verify the anti-CSRF state, send the token to our
 * server (which verifies it with Google's keys), then go to the profile.
 */
export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const idToken = hash.get('id_token');
    const state = hash.get('state');
    const savedState = sessionStorage.getItem('arena_oauth_state');
    sessionStorage.removeItem('arena_oauth_state');

    if (!idToken) {
      setError('Sign-in was cancelled or failed. No token came back from Google.');
      return;
    }
    if (!state || state !== savedState) {
      setError('Sign-in could not be verified. Please try again.');
      return;
    }

    fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential: idToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          setError('The server rejected the sign-in. Please try again.');
          return;
        }
        window.dispatchEvent(new Event('arena:session-changed'));
        router.replace('/profile');
      })
      .catch(() => setError('Network error during sign-in. Please try again.'));
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-carbon px-6 text-center">
      {error ? (
        <>
          <h1 className="font-headline text-4xl font-extrabold uppercase tracking-tight text-cream">
            Sign-in failed.
          </h1>
          <p className="max-w-sm font-grotesk text-sm text-neutral-300">{error}</p>
          <Link
            href="/login"
            className="border border-line-dark bg-surface px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.1em] text-cream transition-colors hover:border-neutral-500"
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400">
            Verifying your Google token…
          </p>
          <span aria-hidden className="h-2 w-2 animate-pulse bg-accent" />
        </>
      )}
    </main>
  );
}
