import { redirect } from 'next/navigation';
import { SplitShell } from '../../components/SplitShell';
import { Avatar } from '../../components/Avatar';
import { AvatarEditor } from '../../components/AvatarEditor';
import { ProfileName } from '../../components/ProfileName';
import { MatchHistory } from '../../components/MatchHistory';
import { Eyebrow, RadarSkeleton, Stat } from '../../components/ui';
import { getCurrentUser } from '../../lib/session';

/**
 * Profile (docs/ui/screens.md §3 + F02/F07): avatar, name (inline-editable),
 * stat row, and the radar skeleton on the cream half; real match history
 * (F07) on the dark half. No sample data.
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
          <div className="mb-8 flex items-start gap-5">
            <div className="flex flex-shrink-0 flex-col gap-2">
              <Avatar displayName={user.displayName} avatarUrl={user.avatarUrl} size={96} />
              <AvatarEditor hasPhoto={!!user.avatarUrl} />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <ProfileName displayName={user.displayName} />
            </div>
          </div>

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
              Match history
            </Eyebrow>
          </div>
          <MatchHistory />
        </div>
      }
      leftFooter={`Joined ${new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Skill map updates after every duel.`}
      rightFooter="Rating changes only when the match ends."
    />
  );
}
