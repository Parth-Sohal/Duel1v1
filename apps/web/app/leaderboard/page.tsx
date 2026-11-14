import type { Metadata } from 'next';
import Link from 'next/link';
import { LEADERBOARD_TOP_N, type LeaderboardEntry, type LeaderboardResult } from '@coding-arena/shared';
import { SplitShell } from '../../components/SplitShell';
import { Avatar } from '../../components/Avatar';
import { Eyebrow, Headline } from '../../components/ui';
import { getCurrentUser, getLeaderboard } from '../../lib/session';

export const metadata: Metadata = {
  title: 'Rankings',
};

const MARK_STYLES: Record<LeaderboardResult, string> = {
  W: 'bg-carbon text-cream border-carbon',
  L: 'border-carbon/30 bg-transparent text-muted',
  D: 'border-line-light bg-sand text-carbon',
};

const MARK_TITLES: Record<LeaderboardResult, string> = {
  W: 'Win',
  L: 'Loss',
  D: 'Draw',
};

/** Last-five form: letters, not color alone (accessible at a glance). */
function FormMarks({
  results,
  dark = false,
  size = 'md',
}: {
  results: LeaderboardResult[];
  dark?: boolean;
  size?: 'sm' | 'md';
}) {
  if (results.length === 0) {
    return <span className={`font-mono text-xs ${dark ? 'text-neutral-500' : 'text-muted'}`}>—</span>;
  }

  const box = size === 'sm' ? 'h-4 w-4 text-[9px]' : 'h-5 w-5 text-[10px]';

  return (
    <span className="flex items-center gap-1" role="img" aria-label={`Last five: ${results.map((r) => MARK_TITLES[r]).join(', ')}`}>
      {results.map((result, i) => (
        <span
          key={`${result}-${i}`}
          title={MARK_TITLES[result]}
          className={`inline-flex ${box} items-center justify-center border font-mono font-bold leading-none ${
            dark
              ? result === 'W'
                ? 'border-accent bg-accent text-carbon'
                : result === 'L'
                  ? 'border-neutral-600 text-neutral-400'
                  : 'border-neutral-500 text-neutral-300'
              : MARK_STYLES[result]
          }`}
        >
          {result}
        </span>
      ))}
    </span>
  );
}

/** The signed-in viewer's own ladder card on the carbon half. */
function ViewerPanel({
  viewer,
  signedIn,
}: {
  viewer: LeaderboardEntry | null;
  signedIn: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-md">
      <Eyebrow dark marker="notch">
        Your rank
      </Eyebrow>

      {viewer ? (
        <>
          <div className="mt-4 flex min-w-0 items-end gap-4">
            <span
              aria-label={`Rank ${viewer.rank}`}
              className="font-headline text-6xl font-extrabold leading-none tracking-[-0.03em] text-cream sm:text-7xl"
            >
              #{viewer.rank}
            </span>
            <div className="min-w-0 pb-1">
              <p className="truncate font-grotesk text-sm font-bold text-white">{viewer.displayName}</p>
              <p className="mt-1 font-mono text-xs uppercase tracking-[0.08em] text-neutral-400">
                {viewer.points.toLocaleString('en-US')} points · {viewer.wins}W {viewer.losses}L {viewer.draws}D
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-line-dark pt-5">
            <span className="mb-3 block font-mono text-xs uppercase tracking-[0.1em] text-neutral-400">
              Last five
            </span>
            <FormMarks results={viewer.lastFive} dark />
          </div>

          {viewer.rank > LEADERBOARD_TOP_N && (
            <p className="mt-5 font-grotesk text-sm leading-relaxed text-neutral-300">
              You are #{viewer.rank} overall. The left panel shows the top {LEADERBOARD_TOP_N}.
            </p>
          )}

          <Link
            href="/duel"
            className="mt-6 flex min-h-12 w-full items-center justify-center bg-accent px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-carbon transition-colors hover:bg-[#ff6231]"
          >
            Play a duel
          </Link>
        </>
      ) : (
        <div className="mt-4 border border-line-dark p-5">
          <p className="font-headline text-3xl font-extrabold uppercase leading-none tracking-[-0.02em] text-cream">
            {signedIn ? 'Unranked.' : 'Sign in.'}
          </p>
          <p className="mt-3 font-grotesk text-sm leading-relaxed text-neutral-300">
            {signedIn
              ? 'Finish one human duel to enter the ladder. Bot duels and practice runs never count.'
              : 'Sign in to see your own rank, record, and last five duels on the ladder.'}
          </p>
          <Link
            href={signedIn ? '/duel' : '/login'}
            className="mt-5 flex min-h-12 w-full items-center justify-center bg-accent px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-carbon transition-colors hover:bg-[#ff6231]"
          >
            {signedIn ? 'Find a duel' : 'Sign in'}
          </Link>
        </div>
      )}

      <div className="mt-8 border-t border-line-dark pt-5">
        <Eyebrow dark>How the ladder works</Eyebrow>
        <ul className="mt-4">
          {[
            'Points decide rank; wins break ties.',
            'Only finished human duels count — bots and practice are excluded.',
            `The left panel shows the top ${LEADERBOARD_TOP_N}; your real rank is always shown here.`,
          ].map((line, i) => (
            <li key={line} className="flex gap-3 border-b border-line-dark py-2.5 last:border-b-0">
              <span aria-hidden className="mt-0.5 font-mono text-[10px] font-bold text-accent">
                0{i + 1}
              </span>
              <span className="font-grotesk text-sm leading-relaxed text-neutral-300">{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default async function LeaderboardPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getLeaderboard()]);

  const playerCount = data?.totalPlayers ?? 0;
  const viewer = data?.viewer ?? null;

  return (
    <SplitShell
      left={
        <>
          <Eyebrow marker="square">Rankings / Global ladder</Eyebrow>
          <Headline className="mt-3 text-[clamp(2.6rem,5vw,4.75rem)]">The ladder.</Headline>
          <p className="mt-4 max-w-md font-grotesk text-sm leading-relaxed text-muted">
            Every finished human duel moves the number. Points are the real rating from your
            profile; the top {LEADERBOARD_TOP_N} are listed here.
          </p>

          {data === null ? (
            <div role="alert" className="mt-8 border-l-2 border-accent bg-accent/5 px-4 py-4">
              <p className="font-grotesk text-sm leading-relaxed text-carbon">
                The ladder could not be loaded right now. Refresh the page to try again.
              </p>
            </div>
          ) : data.entries.length === 0 ? (
            <div className="mt-8 border border-dashed border-line-light bg-sand/40 px-5 py-6">
              <p className="font-headline text-2xl font-extrabold uppercase leading-none tracking-[-0.02em] text-carbon">
                No ranked duels yet.
              </p>
              <p className="mt-3 max-w-sm font-grotesk text-sm leading-relaxed text-muted">
                The first finished human duel opens the ladder. Bot duels and practice runs do not
                count.
              </p>
              <Link
                href={user ? '/duel' : '/login'}
                className="mt-5 inline-flex min-h-12 items-center justify-center border border-carbon px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.1em] text-carbon transition-colors hover:bg-carbon hover:text-cream"
              >
                {user ? 'Find a duel' : 'Sign in to play'}
              </Link>
            </div>
          ) : (
            <div
              role="table"
              aria-label={`Global ladder, top ${LEADERBOARD_TOP_N}`}
              className="mt-8 border border-line-light"
            >
              <div
                role="row"
                className="grid grid-cols-[2.25rem_minmax(0,1fr)_4rem] items-center gap-3 border-b border-line-light bg-sand/60 px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted sm:grid-cols-[2.75rem_minmax(0,1fr)_4.5rem_5.5rem] md:grid-cols-[3rem_minmax(0,1fr)_4.5rem_6rem_7.5rem]"
              >
                <span role="columnheader">#</span>
                <span role="columnheader">Player</span>
                <span role="columnheader" className="text-right">Points</span>
                <span role="columnheader" className="hidden text-center sm:block">W–L–D</span>
                <span role="columnheader" className="hidden text-center md:block">Last 5</span>
              </div>

              {data.entries.map((entry) => {
                const isViewer = viewer?.userId === entry.userId;
                return (
                  <div
                    key={entry.userId}
                    role="row"
                    className={`grid grid-cols-[2.25rem_minmax(0,1fr)_4rem] items-center gap-3 border-b border-line-light px-3 py-3 last:border-b-0 sm:grid-cols-[2.75rem_minmax(0,1fr)_4.5rem_5.5rem] md:grid-cols-[3rem_minmax(0,1fr)_4.5rem_6rem_7.5rem] ${
                      isViewer ? 'bg-accent/10' : ''
                    }`}
                  >
                    <span
                      role="cell"
                      aria-label={`Rank ${entry.rank}`}
                      className={`font-mono text-sm font-bold ${
                        entry.rank <= 3 ? 'text-accent' : 'text-carbon'
                      }`}
                    >
                      {String(entry.rank).padStart(2, '0')}
                    </span>

                    <div role="cell" className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar
                          displayName={entry.displayName}
                          avatarUrl={entry.avatarUrl}
                          size={28}
                          className="hidden sm:inline-flex"
                        />
                        <Link
                          href={`/u/${entry.userId}`}
                          className="truncate font-grotesk text-sm font-bold text-carbon transition-colors hover:text-accent"
                        >
                          {entry.displayName}
                        </Link>
                        {isViewer && (
                          <span className="flex-shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-accent">
                            You
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 md:hidden">
                        <FormMarks results={entry.lastFive} size="sm" />
                      </div>
                    </div>

                    <span role="cell" className="text-right font-mono text-sm font-bold text-carbon">
                      {entry.points.toLocaleString('en-US')}
                    </span>

                    <span
                      role="cell"
                      aria-label={`${entry.wins} wins, ${entry.losses} losses, ${entry.draws} draws`}
                      className="hidden text-center font-mono text-xs text-muted sm:block"
                    >
                      {entry.wins}–{entry.losses}–{entry.draws}
                    </span>

                    <div role="cell" className="hidden justify-center md:flex">
                      <FormMarks results={entry.lastFive} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      }
      right={<ViewerPanel viewer={viewer} signedIn={!!user} />}
      leftFooter={
        data === null
          ? 'Rankings unavailable · refresh to retry.'
          : `${playerCount} ranked ${playerCount === 1 ? 'player' : 'players'} · Top ${LEADERBOARD_TOP_N} shown.`
      }
      rightFooter="Points decide rank. Wins break ties. Bots and practice excluded."
    />
  );
}
