'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { UserPublic } from '@coding-arena/shared';

/**
 * Top system bar across both columns (owner login design):
 * left cream cell — logo `{ duel }` with accent braces, nav, version pill;
 * right dark cell — the signed-in user chip (real data; the mockup's fake
 * telemetry numbers are omitted per the no-sample-data rule).
 * Mobile: single cream bar, nav collapses to a menu (decision D10).
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

  const skillMapLink = (
    <Link
      href="/profile"
      className={`flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.18em] transition-colors hover:text-accent ${
        onProfile ? 'text-carbon' : 'text-carbon'
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
      className="cursor-not-allowed font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted"
    >
      {label}
    </span>
  );

  const chip = user ? (
    <Link
      href="/profile"
      className="font-mono text-xs font-semibold uppercase tracking-[0.15em] text-white hover:text-accent"
    >
      {user.displayName} / {user.points.toLocaleString('en-US')}
    </Link>
  ) : null;

  const signInOut = user ? (
    <button
      type="button"
      onClick={signOut}
      className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 transition-colors hover:text-accent"
    >
      Sign out
    </button>
  ) : (
    loaded && (
      <Link
        href="/login"
        className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400 transition-colors hover:text-accent"
      >
        Sign in
      </Link>
    )
  );

  return (
    <header className="z-20 w-full border-b border-line-dark/20 bg-cream">
      <div className="grid w-full grid-cols-1 lg:grid-cols-12">
        {/* Cream brand cell */}
        <div className="flex items-center justify-between border-b border-line-light px-5 py-4 sm:px-10 lg:col-span-7 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-baseline gap-1.5 font-mono text-2xl font-bold tracking-tighter text-carbon">
              <span className="font-extrabold text-accent">{'{'}</span>
              <span className="text-xl font-extrabold tracking-tight sm:text-2xl">duel</span>
              <span className="font-extrabold text-accent">{'}'}</span>
            </Link>
            <div aria-hidden className="hidden h-4 w-px bg-line-light sm:block" />
            <nav className="hidden items-center gap-6 sm:flex">
              {skillMapLink}
              {plannedNav('Rankings')}
              {plannedNav('Compilers')}
            </nav>
          </div>
          <div className="hidden items-center gap-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted md:flex">
            <span>Arena // v0.1</span>
            <span className="border border-carbon/25 bg-sand/60 px-2 py-0.5 text-[10px] text-carbon">
              PvP active
            </span>
          </div>
          {/* Mobile menu button */}
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-8 w-8 flex-col items-center justify-center gap-1 lg:hidden"
          >
            <span className="h-0.5 w-5 bg-carbon" />
            <span className="h-0.5 w-5 bg-carbon" />
            <span className="h-0.5 w-5 bg-carbon" />
          </button>
        </div>

        {/* Dark user cell (desktop) */}
        <div className="hidden items-center justify-end gap-6 border-b border-line-dark bg-carbon px-6 py-4 sm:px-10 lg:col-span-5 lg:flex">
          {chip}
          {signInOut}
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="absolute inset-x-0 top-full z-30 flex flex-col gap-4 border-b border-line-light bg-cream px-5 py-4 lg:hidden">
          {skillMapLink}
          {plannedNav('Rankings')}
          {plannedNav('Compilers')}
          <div className="flex flex-col gap-3 border-t border-line-light pt-3 text-carbon">
            {chip && <span className="[&>a]:!text-carbon">{chip}</span>}
            {user ? (
              <button
                type="button"
                onClick={signOut}
                className="text-left font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted"
              >
                Sign out
              </button>
            ) : (
              <Link href="/login" className="font-mono text-xs font-semibold uppercase tracking-[0.18em]">
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
