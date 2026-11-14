import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../../components/Header';
import { getCurrentUser } from '../../lib/session';
import { DuelLauncher } from '../../components/DuelLauncher';

export const metadata: Metadata = {
  title: 'Play',
};

/**
 * PLAY — duel setup (docs/features/F05-friend-rooms.md). RIVAL friend rooms
 * and the KERN bot are live; ANYONE (stranger matchmaking) is still a later
 * iteration and stays disabled. The launcher keeps the only writable route
 * behavior: create room, join by invite code, or seat KERN.
 */
export default async function DuelPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return (
    <div className="relative flex min-h-screen flex-col bg-cream">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-carbon focus:px-4 focus:py-3 focus:font-mono focus:text-xs focus:font-bold uppercase tracking-[0.1em] focus:text-cream"
      >
        Skip to content
      </a>
      <div className="relative">
        <Header split="even" />
      </div>
      <DuelLauncher displayName={user.displayName} />
    </div>
  );
}
