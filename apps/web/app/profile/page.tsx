import { redirect } from 'next/navigation';
import { SplitShell } from '../../components/SplitShell';
import { Eyebrow, Headline, RadarSkeleton, Stat } from '../../components/ui';
import { getCurrentUser } from '../../lib/session';

/**
 * Profile (docs/ui/screens.md §3, Iteration 1 scope): left half with name,
 * a stat row, and the radar skeleton; right half is the activity empty
 * state with a Find-a-match CTA. No sample data.
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <SplitShell
      left={
        <>
          <div className="mb-4">
            <Eyebrow marker="square">Player profile</Eyebrow>
          </div>
          <Headline className="mb-8 min-w-0 text-[clamp(2.5rem,6vw,4.5rem)]">
            {user.displayName}
          </Headline>

          {/* Stat row: big numbers, small labels */}
          <div className="grid max-w-md grid-cols-2 gap-x-6 gap-y-8 border-t border-line-light pt-6 sm:grid-cols-4">
            <Stat label="Rating" value={user.points.toLocaleString('en-US')} />
            <Stat label="Wins" value={user.wins} />
            <Stat label="Losses" value={user.losses} />
            <Stat label="Draws" value={user.draws} />
          </div>

          {/* Skill radar: designed empty state until skill snapshots exist (Iteration 5) */}
          <div className="mt-10 max-w-md border-t border-line-light/80 pt-6">
            <span className="mb-4 block font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted">
              Skill map
            </span>
            <div className="flex items-center gap-6 border border-line-light bg-sand/50 p-6">
              <RadarSkeleton />
              <p className="font-grotesk text-sm leading-relaxed text-muted">
                The radar unlocks after your first duels. Every duel sharpens it.
              </p>
            </div>
          </div>
        </>
      }
      right={
        <div className="mx-auto w-full max-w-md">
          <div className="mb-4">
            <Eyebrow dark marker="notch">
              Activity
            </Eyebrow>
          </div>
          <h2 className="mb-3 font-headline text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-cream sm:text-5xl">
            No duels yet.
          </h2>
          <p className="mb-8 font-grotesk text-sm leading-relaxed text-neutral-300">
            Win your first duel to start the streak, rivals, and badges.
          </p>

          {/* Primary CTA — matchmaking arrives with the duel screens (Iteration 3) */}
          <button
            type="button"
            disabled
            title="Matchmaking arrives in Iteration 3"
            className="group flex w-full cursor-not-allowed items-center justify-between gap-3.5 border border-carbon/40 bg-accent p-1.5 pr-5 text-left opacity-80"
          >
            <span className="flex items-center gap-3.5">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-carbon font-mono text-sm font-bold text-accent">
                ⚔
              </span>
              <span className="font-mono text-sm font-bold tracking-[0.05em] text-carbon">
                Find a match
              </span>
            </span>
            <span aria-hidden className="font-mono text-xs text-carbon">➔</span>
          </button>
          <p className="mt-2 font-grotesk text-sm text-neutral-400">
            Matchmaking is coming soon — duels start in the next build.
          </p>

          <div className="mt-8 border border-line-dark bg-surface/80 p-4">
            <div className="mb-3 flex items-center justify-between border-b border-neutral-800 pb-2 font-mono text-xs">
              <span className="flex items-center gap-2 text-neutral-300">
                <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
                <span className="font-semibold uppercase tracking-[0.1em]">Next unlock</span>
              </span>
              <span className="text-[10px] uppercase tracking-[0.1em] text-neutral-400">
                Streak · Rivals · Badges
              </span>
            </div>
            <p className="font-grotesk text-sm leading-relaxed text-neutral-300">
              Duels, streaks, rivals, and badges arrive with matchmaking.
            </p>
          </div>
        </div>
      }
      leftFooter="Skill map updates after every duel."
      rightFooter="Rating changes only when the match ends."
    />
  );
}
