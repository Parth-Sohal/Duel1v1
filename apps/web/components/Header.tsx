'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { UserPublic } from '@coding-arena/shared';

/**
 * Top system bar across both columns: nav links grouped left, status items
 * grouped right (never sharing a cramped row), user chip on the dark cell.
 * Secondary nav hides below xl; status hides below md; mobile gets a menu.
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

  // The sign-in callback dispatches this after a successful login.
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

  const skillMapLink = (
    <Link
      href="/profile"
      className={`flex items-center gap-1.5 whitespace-nowrap font-mono text-xs font-semibold uppercase tracking-[0.1em] text-carbon transition-colors hover:text-accent ${
        onProfile ? 'underline decoration-accent decoration-2 underline-offset-8' : ''
      }`}
    >
      <span>Skill map</span>
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
    </Link>
  );

  // Nav items from the design that have no screens yet: shown, muted, inert.
  const plannedNav = (label: string) => (
    <span
      title="Arrives in a later iteration"
      className="cursor-not-allowed whitespace-nowrap font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted"
    >
      {label}
    </span>
  );

  const chip = user ? (
    <Link
      href="/profile"
      className="max-w-52 truncate font-mono text-xs font-semibold uppercase tracking-[0.05em] text-white transition-colors hover:text-accent"
      title={`${user.displayName} / ${user.points.toLocaleString('en-US')}`}
    >
      {user.displayName} / {user.points.toLocaleString('en-US')}
    </Link>
  ) : null;

  const signInLink = loaded && !user && (
    <Link
      href="/login"
      className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-neutral-300 transition-colors hover:text-accent"
    >
      Sign in
    </Link>
  );

  const signOutButton = user && (
    <button
      type="button"
      onClick={signOut}
      className="whitespace-nowrap font-mono text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400 transition-colors hover:text-accent"
    >
      Sign out
    </button>
  );

  return (
    <header className="z-20 w-full border-b border-line-dark/20 bg-cream">
      <div className="grid w-full grid-cols-1 lg:grid-cols-12">
        {/* Cream cell: nav left, status right */}
        <div className="flex h-16 items-center justify-between gap-6 border-b border-line-light px-5 sm:px-8 lg:col-span-7 lg:border-b-0 lg:border-r lg:px-10">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <Link
              href="/"
              className="flex flex-shrink-0 items-baseline gap-1.5 font-mono text-2xl font-bold tracking-tighter text-carbon"
            >
              <span className="font-extrabold text-accent">{'{'}</span>
              <span className="text-xl font-extrabold tracking-tight sm:text-2xl">duel</span>
              <span className="font-extrabold text-accent">{'}'}</span>
            </Link>
            <div aria-hidden className="hidden h-4 w-px bg-line-light sm:block" />
            <nav aria-label="Primary" className="hidden items-center gap-5 sm:flex">
              {skillMapLink}
              <span className="hidden xl:inline">{plannedNav('Rankings')}</span>
              <span className="hidden xl:inline">{plannedNav('Compilers')}</span>
            </nav>
          </div>
          <div className="hidden flex-shrink-0 items-center gap-4 md:flex">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              Arena // v0.1
            </span>
            <span className="border border-carbon/25 bg-sand/60 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-carbon">
              PvP active
            </span>
          </div>
          {/* Mobile menu button */}
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center gap-1.5 lg:hidden"
          >
            <span className="h-0.5 w-5 bg-carbon" />
            <span className="h-0.5 w-5 bg-carbon" />
            <span className="h-0.5 w-5 bg-carbon" />
          </button>
        </div>

        {/* Dark cell: the signed-in player (desktop) */}
        <div className="hidden h-16 items-center justify-end gap-6 border-b border-line-dark bg-carbon px-6 sm:px-8 lg:col-span-5 lg:flex lg:px-10">
          {chip}
          {signInLink}
          {signOutButton}
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="absolute inset-x-0 top-full z-30 flex flex-col gap-4 border-b border-line-light bg-cream px-5 py-5 lg:hidden">
          {skillMapLink}
          <span className="sm:hidden">{plannedNav('Rankings')}</span>
          <span className="sm:hidden">{plannedNav('Compilers')}</span>
          <div className="flex flex-col items-start gap-3 border-t border-line-light pt-4">
            {chip && <span className="[&>a]:!text-carbon">{chip}</span>}
            {user ? (
              signOutButton
            ) : (
              loaded && (
                <Link
                  href="/login"
                  className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-carbon"
                >
                  Sign in
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </header>
  );
}
