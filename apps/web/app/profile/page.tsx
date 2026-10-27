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
          <Eyebrow>Player profile</Eyebrow>
          <div className="mt-4">
            <Headline>{user.displayName}</Headline>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Chip>Rating {user.points.toLocaleString('en-US')}</Chip>
            <Chip>
              {user.wins} wins / {user.losses} losses
            </Chip>
            <Chip>{user.draws} draws</Chip>
          </div>

          {/* Skill map arrives in Iteration 5 (needs skill snapshots). Empty state, no fake data. */}
          <div className="mt-10 border border-rule-light p-5">
            <Eyebrow>Skill map</Eyebrow>
            <p className="mt-4 font-mono text-xs uppercase leading-relaxed tracking-[0.1em] text-muted-light">
              The radar unlocks after your first duels. Every duel sharpens it.
            </p>
          </div>
        </>
      }
      right={
        <>
          <Eyebrow dark>Activity</Eyebrow>
          <div className="mt-4">
            <Headline dark>No duels yet.</Headline>
          </div>
          <p className="mt-6 max-w-sm font-mono text-xs uppercase leading-relaxed tracking-[0.1em] text-muted-dark">
            Win your first duel to start the streak, rivals, and badges.
          </p>
        </>
      }
      leftFooter="Skill map updates after every duel."
      rightFooter="Streak, rivals, and badges unlock as you duel."
    />
  );
}
