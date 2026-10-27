'use client';

/**
 * Primary "Sign in with Google" action. Uses Google's OAuth2 redirect flow
 * (response_type=id_token): a real anchor with native hover, focus, and
 * active states — the old invisible-iframe overlay can't have hover states
 * because the GIS iframe swallows every pointer event.
 *
 * The server verifies the returned ID token with Google's keys, unchanged.
 */

export function GoogleSignInButton({ authUrl }: { authUrl: string }) {
  return (
    <a
      href={authUrl}
      onClick={() => {
        // The callback verifies this against the URL's state param (login CSRF guard).
        try {
          const state = new URL(authUrl).searchParams.get('state');
          if (state) sessionStorage.setItem('arena_oauth_state', state);
        } catch {
          // storage unavailable (rare) — callback still signs in without the guard
        }
      }}
      className="group flex w-full items-center justify-between gap-3.5 border border-carbon/40 bg-accent p-1.5 pr-5 text-left transition-all duration-150 hover:bg-[#ff6231] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream active:translate-y-px"
    >
      <span className="flex items-center gap-3.5">
        {/* Google badge: the one allowed white box */}
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-white">
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
        </span>
        <span className="font-mono text-sm font-bold tracking-[0.05em] text-carbon">
          Sign in with Google
        </span>
      </span>
      <span
        aria-hidden
        className="font-mono text-xs text-carbon transition-transform duration-150 group-hover:translate-x-1"
      >
        ➔
      </span>
    </a>
  );
}
