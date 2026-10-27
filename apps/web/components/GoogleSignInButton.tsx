'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Custom-brutalist "Sign in with Google" button (owner design). Google
 * Identity Services renders its real button invisibly on top; clicks hit the
 * GIS iframe, so Google's account picker and security features stay intact.
 * GIS returns an ID token; our server verifies it with Google's keys.
 */

type CredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: CredentialResponse) => void;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/** Google "G" mark, four-color official paths. */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
        fill="#4285F4"
      />
      <path
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.36 7.35 24 12 24z"
        fill="#34A853"
      />
      <path
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
        fill="#FBBC05"
      />
      <path
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
        fill="#EA4335"
      />
    </svg>
  );
}

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
      const holder = holderRef.current;
      if (!gsi || !holder) return;
      gsi.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => void handleCredential(response),
      });
      gsi.accounts.id.renderButton(holder, {
        theme: 'outline',
        size: 'large',
        width: 400,
      });
      // Stretch the real GIS iframe over the custom button so clicks anywhere
      // go to Google's flow; the rendered pixels stay invisible.
      const iframe = holder.querySelector('iframe');
      if (iframe) {
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = '0';
      }
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
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
        Google sign-in is not configured yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="group relative w-full border border-neutral-700/80 bg-surface p-1.5 pr-5 text-left transition-colors duration-150 hover:border-neutral-500">
        <div className="flex items-center justify-between gap-3.5">
          <div className="flex items-center gap-3.5">
            {/* Google badge: the one allowed white box with slight rounding */}
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-white shadow-sm">
              <GoogleMark />
            </span>
            <span className="font-mono text-sm font-semibold tracking-wide text-neutral-100 group-hover:text-white">
              Sign in with Google
            </span>
          </div>
          <span aria-hidden className="font-mono text-xs text-neutral-500 transition-colors group-hover:text-accent">
            ➔
          </span>
        </div>
        {/* Invisible real GIS button covering the whole custom button */}
        <div
          ref={holderRef}
          aria-hidden
          className={`absolute inset-0 overflow-hidden opacity-0 ${busy ? 'pointer-events-none' : ''}`}
        />
      </div>
      {error && (
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
