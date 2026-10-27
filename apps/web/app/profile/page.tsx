import { redirect } from 'next/navigation';
import { SplitShell } from '../../components/SplitShell';
import { Chip, Eyebrow, Headline } from '../../components/ui';
import { getCurrentUser } from '../../lib/session';

/**
 * Profile (docs/ui/screens.md §3, Iteration 1 scope): left half with name,
 * chips (rating, wins/losses — no rank title yet, decision D8) and an empty
 * state; right half is empty states in the same style. No sample data.
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
          <Headline className="mb-6 text-7xl sm:text-8xl md:text-9xl">{user.displayName}</Headline>

          <div className="flex flex-wrap gap-2">
            <Chip>Rating {user.points.toLocaleString('en-US')}</Chip>
            <Chip>
              {user.wins} wins / {user.losses} losses
            </Chip>
            <Chip variant="accent">{user.draws} draws</Chip>
          </div>

          {/* Skill map arrives in Iteration 5 (needs skill snapshots). Empty state, no fake data. */}
          <div className="mt-10 border-t border-line-light/80 pt-6">
            <span className="mb-3 block font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
              Skill map:
            </span>
            <div className="border border-line-light bg-sand/50 p-5">
              <p className="font-mono text-xs uppercase leading-relaxed tracking-[0.15em] text-muted">
                The radar unlocks after your first duels. Every duel sharpens it.
              </p>
            </div>
          </div>
        </>
      }
      right={
        <div className="mx-auto my-auto w-full max-w-md py-8">
          <div className="mb-6">
            <Eyebrow dark marker="notch">
              Activity
            </Eyebrow>
          </div>
          <h2 className="mb-4 font-headline text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-white sm:text-5xl">
            No duels yet.
          </h2>
          <p className="font-mono text-xs uppercase leading-relaxed tracking-[0.18em] text-neutral-400">
            Win your first duel to start the streak, rivals, and badges.
          </p>

          <div className="mt-10 border border-line-dark bg-surface/80 p-4">
            <div className="mb-3 flex items-center justify-between border-b border-neutral-800 pb-2 font-mono text-[11px]">
              <span className="flex items-center gap-2 text-neutral-400">
                <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
                <span className="uppercase tracking-[0.2em]">Next unlock</span>
              </span>
              <span className="text-[10px] uppercase tracking-widest text-neutral-600">Iteration 3</span>
            </div>
            <p className="font-mono text-xs uppercase leading-relaxed tracking-[0.15em] text-neutral-400">
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
