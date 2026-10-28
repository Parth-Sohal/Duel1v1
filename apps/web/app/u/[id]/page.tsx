import Link from 'next/link';
import { SplitShell } from '../../../components/SplitShell';
import { Avatar } from '../../../components/Avatar';
import { Eyebrow, Headline, RadarSkeleton, Stat } from '../../../components/ui';
import { getPublicUser, getCurrentUser } from '../../../lib/session';

/** Designed not-found state (no raw 404 page). */
function NotFound() {
  return (
    <SplitShell
      left={
        <>
          <div className="mb-4">
            <Eyebrow marker="square">Player profile</Eyebrow>
          </div>
          <Headline className="mb-6 text-[clamp(2.5rem,6vw,4.5rem)]">Not found.</Headline>
          <p className="max-w-md font-grotesk text-sm leading-relaxed text-muted">
            No player lives at this address. The id may be wrong, or the player left the arena.
          </p>
          <div className="mt-8 max-w-md border-t border-line-light pt-6">
            <Link
              href="/profile"
              className="inline-block border border-carbon/40 bg-accent px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-carbon transition-colors hover:bg-[#ff6231]"
            >
              Your profile ➔
            </Link>
          </div>
        </>
      }
      right={
        <div className="mx-auto w-full max-w-md">
          <div className="mb-4">
            <Eyebrow dark marker="notch">
              Arena protocol
            </Eyebrow>
          </div>
          <h2 className="mb-3 font-headline text-3xl font-extrabold uppercase tracking-tight text-cream sm:text-4xl">
            Empty seats.
          </h2>
          <p className="font-grotesk text-sm leading-relaxed text-neutral-300">
            Profiles only exist for players who signed in with Google.
          </p>
        </div>
      }
      leftFooter="The server is the referee."
      rightFooter="Rating changes only when the match ends."
    />
  );
}

/**
 * Public profile (F02): same design language as the own profile, but read-only —
 * no edit controls, no private fields (email/google_id never leave the server).
 * Server-rendered with a forwarded cookie, so a refresh always shows current data.
 */
export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [viewer, player] = await Promise.all([getCurrentUser(), getPublicUser(id)]);
  if (!player) {
    return <NotFound />;
  }

  const isSelf = viewer?.id === player.id;

  return (
    <SplitShell
      left={
        <>
          <div className="mb-4">
            <Eyebrow marker="square">{isSelf ? 'Player profile' : 'Rival profile'}</Eyebrow>
          </div>
          <div className="mb-8 flex items-start gap-5">
            <Avatar displayName={player.displayName} avatarUrl={player.avatarUrl} size={96} />
            <div className="min-w-0 flex-1 pt-1">
              <Headline className="min-w-0 text-[clamp(2.5rem,6vw,4.5rem)]">
                {player.displayName}
              </Headline>
            </div>
          </div>

          <div className="grid max-w-md grid-cols-2 gap-x-6 gap-y-8 border-t border-line-light pt-6 sm:grid-cols-4">
            <Stat label="Rating" value={player.points.toLocaleString('en-US')} />
            <Stat label="Wins" value={player.wins} />
            <Stat label="Losses" value={player.losses} />
            <Stat label="Draws" value={player.draws} />
          </div>

          <div className="mt-10 max-w-md border-t border-line-light/80 pt-6">
            <span className="mb-4 block font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted">
              Skill map
            </span>
            <div className="flex items-center gap-6 border border-line-light bg-sand/50 p-6">
              <RadarSkeleton />
              <p className="font-grotesk text-sm leading-relaxed text-muted">
                The radar unlocks after their first duels.
              </p>
            </div>
          </div>
        </>
      }
      right={
        <div className="mx-auto w-full max-w-md">
          <div className="mb-4">
            <Eyebrow dark marker="notch">
              Arena record
            </Eyebrow>
          </div>
          <h2 className="mb-3 font-headline text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-cream sm:text-5xl">
            {isSelf ? 'This is you.' : 'Meet your rival.'}
          </h2>
          <p className="mb-8 font-grotesk text-sm leading-relaxed text-neutral-300">
            {isSelf
              ? 'This is how other players see your profile.'
              : 'Every rating here was earned in the arena — no shortcuts.'}
          </p>

          <div className="border border-line-dark bg-surface/80 p-4">
            <div className="mb-3 flex items-center justify-between border-b border-neutral-800 pb-2 font-mono text-xs">
              <span className="flex items-center gap-2 text-neutral-300">
                <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
                <span className="font-semibold uppercase tracking-[0.1em]">Duel history</span>
              </span>
              <span className="text-[10px] uppercase tracking-[0.1em] text-neutral-400">
                Iteration 6
              </span>
            </div>
            <p className="font-grotesk text-sm leading-relaxed text-neutral-300">
              Past duels show here once match history ships.
            </p>
          </div>

          {isSelf ? (
            <p className="mt-6 font-grotesk text-sm text-neutral-400">
              Manage your name from{' '}
              <Link
                href="/profile"
                className="font-semibold text-accent underline decoration-accent/60 underline-offset-2 hover:decoration-accent"
              >
                your own profile
              </Link>
              .
            </p>
          ) : null}
        </div>
      }
      leftFooter={`Joined ${new Date(player.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Public record, server-verified.`}
      rightFooter="Rating changes only when the match ends."
    />
  );
}
