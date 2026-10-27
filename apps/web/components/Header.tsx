'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { UserPublic } from '@coding-arena/shared';

/**
 * One nav bar across both halves: logo and primary nav left, user chip right.
 * Signed out it shows a plain SIGN IN link (docs/ui/screens.md §1: show only
 * items that exist). Mobile: nav collapses to a menu (decision D10).
 */
export function Header() {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const loadUser = useCallback(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: UserPublic } | null) => {
        setUser(d?.user ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(loadUser, [loadUser]);

  // The sign-in button dispatches this after a successful login.
  useEffect(() => {
    window.addEventListener('arena:session-changed', loadUser);
    return () => window.removeEventListener('arena:session-changed', loadUser);
  }, [loadUser]);

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setMenuOpen(false);
    router.push('/login');
    router.refresh();
  };

  const onProfile = pathname === '/profile';
  const navLink = (
    <Link
      href="/profile"
      className={`font-mono text-xs uppercase tracking-[0.2em] underline-offset-4 hover:underline ${
        onProfile ? 'underline' : ''
      } text-ink`}
    >
      Skill map
    </Link>
  );

  const chip = user ? (
    <Link
      href="/profile"
      className="font-mono text-xs uppercase tracking-[0.15em] hover:text-accent"
    >
      {user.displayName} / {user.points.toLocaleString('en-US')}
    </Link>
  ) : null;
  const chipRight = chip ? <span className="text-paper">{chip}</span> : null;

  return (
    <header
      className="relative z-10 flex h-16 items-center justify-between border-b border-rule-light bg-cream px-5 md:border-b-0 md:px-10 md:bg-[linear-gradient(90deg,var(--color-cream)_0_50%,var(--color-ink)_50%_100%)]"
    >
      <div className="flex items-center gap-8">
        <Link href="/" className="font-mono text-xl font-bold text-ink">
          {'{ duel }'}
        </Link>
        <nav className="hidden items-center gap-8 md:flex">{navLink}</nav>
      </div>

      <div className="hidden items-center gap-6 md:flex">
        {chipRight}
        {!user && loaded && (
          <Link
            href="/login"
            className="font-mono text-xs uppercase tracking-[0.2em] text-paper hover:text-accent"
          >
            Sign in
          </Link>
        )}
        {user && (
          <button
            type="button"
            onClick={signOut}
            className="font-mono text-xs uppercase tracking-[0.2em] text-muted-dark hover:text-accent"
          >
            Sign out
          </button>
        )}
      </div>

      {/* Mobile: collapsed menu (D10) */}
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
        className="flex h-8 w-8 flex-col items-center justify-center gap-1 md:hidden"
      >
        <span className="h-0.5 w-5 bg-ink" />
        <span className="h-0.5 w-5 bg-ink" />
        <span className="h-0.5 w-5 bg-ink" />
      </button>

      {menuOpen && (
        <div className="absolute inset-x-0 top-16 flex flex-col gap-4 border-b border-rule-light bg-cream px-5 py-4 md:hidden">
          {navLink}
          {user ? (
            <>
              {chip && <span className="text-ink">{chip}</span>}
              <button
                type="button"
                onClick={signOut}
                className="text-left font-mono text-xs uppercase tracking-[0.2em] text-muted-light"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="font-mono text-xs uppercase tracking-[0.2em] text-ink">
              Sign in
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
