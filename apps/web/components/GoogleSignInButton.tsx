'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Google Identity Services button (docs/features/F01-google-login.md):
 * GIS returns an ID token; we forward it to our server, which verifies it
 * with Google. The browser's profile fields are never trusted.
 */

type CredentialResponse = {
  credential?: string;
};

type GoogleId = {
  initialize: (config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
  }) => void;
  renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const holderRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleCredential = useCallback(
    async (response: CredentialResponse) => {
      if (!response.credential) {
        setError('Sign-in failed. Try again.');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ credential: response.credential }),
        });
        if (!res.ok) {
          setError('Sign-in failed. Try again.');
          return;
        }
        // Session cookie is set (same-origin through the /api proxy).
        router.replace('/profile');
        router.refresh();
        window.dispatchEvent(new Event('arena:session-changed'));
      } catch {
        setError('Sign-in failed. Try again.');
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!CLIENT_ID || !holderRef.current) return;

    const render = () => {
      const gsi = window.google;
      if (!gsi || !holderRef.current) return;
      gsi.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => void handleCredential(response),
      });
      gsi.accounts.id.renderButton(holderRef.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'rectangular',
        text: 'signin_with',
        width: 280,
      });
    };

    // Load the GIS script once; if it is already there, render right away.
    const GSI_SRC = 'https://accounts.google.com/gsi/client';
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (existing) {
      if (window.google) {
        render();
      } else {
        existing.addEventListener('load', render, { once: true });
      }
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [handleCredential]);

  if (!CLIENT_ID) {
    return (
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-dark">
        Google sign-in is not configured yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <div ref={holderRef} className={busy ? 'opacity-50' : undefined} aria-busy={busy} />
      {error && (
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
