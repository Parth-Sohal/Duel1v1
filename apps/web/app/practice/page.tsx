import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SplitShell } from '../../components/SplitShell';
import { Chip, Eyebrow, Headline, Stat } from '../../components/ui';
import { getCurrentUser } from '../../lib/session';
import { getChallengeList, type ChallengeListItem } from '../../lib/practice';
import { getDaily } from '../../lib/daily';

/** Empty state: real condition (no published challenges), never fake rows. */
function EmptyRoster() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-4">
        <Eyebrow dark marker="notch">
          Challenge roster
        </Eyebrow>
      </div>
      <h2 className="mb-3 font-headline text-4xl font-extrabold uppercase tracking-tight text-cream">
        No challenges yet.
      </h2>
      <p className="font-grotesk text-sm leading-relaxed text-neutral-300">
        The first problems are being calibrated and signed off. They land here the moment they are published.
      </p>
    </div>
  );
}

/** Server unreachable: designed error state, in style. */
function ArenaOffline() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-4">
        <Eyebrow dark marker="notch">
          Challenge roster
        </Eyebrow>
      </div>
      <h2 className="mb-3 font-headline text-4xl font-extrabold uppercase tracking-tight text-cream">
        Arena offline.
      </h2>
      <p className="font-grotesk text-sm leading-relaxed text-neutral-300">
        The game server did not answer. Refresh to try again.
      </p>
    </div>
  );
}

/** One roster row: number, title, difficulty chip + tags, solved marker in accent. */
function ChallengeRow({ index, challenge }: { index: number; challenge: ChallengeListItem }) {
  return (
    <Link href={`/practice/${challenge.slug}`} className="group block border-b border-line-dark py-5">
      <div className="flex items-start gap-4">
        <span className="w-8 flex-shrink-0 font-mono text-sm font-bold text-neutral-600 transition-colors group-hover:text-accent">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="break-words font-mono text-base font-bold uppercase tracking-[0.05em] text-cream transition-colors group-hover:text-accent">
              {challenge.title}
            </h3>
            {challenge.solved && (
              <span className="flex flex-shrink-0 items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-accent">
                <span aria-hidden className="inline-block h-2 w-2 bg-accent" />
                Solved
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip variant="dark">{challenge.difficulty}</Chip>
            {challenge.tags.map((tag) => (
              <span key={tag} className="font-mono text-xs text-neutral-400">
                {tag}
              </span>
            ))}
            {challenge.attempts > 0 && !challenge.solved && (
              <span className="font-mono text-xs text-neutral-500">
                {challenge.attempts} {challenge.attempts === 1 ? 'attempt' : 'attempts'}
              </span>
            )}
          </div>
        </div>
        <span aria-hidden className="flex-shrink-0 font-mono text-sm text-neutral-600 transition-colors group-hover:text-accent">
          ➔
        </span>
      </div>
    </Link>
  );
}

/**
 * Practice list (docs/features/F04-practice-mode.md): protocol on the cream
 * half, the live challenge roster on the dark half. Only published challenges
 * exist — the list is empty until the owner signs a challenge off.
 */
export default async function PracticePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const [challenges, daily] = await Promise.all([getChallengeList(), getDaily()]);
  const dailyChallenge = daily?.challenge ?? null;

  return (
    <SplitShell
      left={
        <>
          <div className="mb-4">
            <Eyebrow marker="square">Solo drills · warm-up floor</Eyebrow>
          </div>
          <Headline className="mb-6">Practice.</Headline>
          <p className="mb-10 max-w-md font-grotesk text-sm leading-relaxed text-muted">
            Read the problem, write the function, run it against the samples, submit against everything. You return
            the answer — the judge calls your function. No opponent yet; this is where the reps happen before the
            duels.
          </p>

          <div className="mb-10 grid max-w-md grid-cols-2 gap-x-8 gap-y-6">
            <Stat label="Languages" value="JS · PY · JAVA · C++" />
            <Stat label="CPU limit" value="5s base" />
            <Stat label="Memory" value="256 MB" />
            <Stat
              label="Challenges"
              value={challenges ? String(challenges.length) : '—'}
            />
          </div>

          <div className="max-w-md border border-line-light bg-sand/60 p-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-carbon">
              <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
              How judging works
            </div>
            <p className="font-grotesk text-sm leading-relaxed text-muted">
              RUN calls your function on the visible samples only and saves nothing. SUBMIT judges the hidden tests
              too — pass them all and the challenge is marked solved. You return the answer; you never parse input
              or print it.
            </p>
          </div>
        </>
      }
      right={
        challenges === null ? (
          <ArenaOffline />
        ) : challenges.length === 0 ? (
          <EmptyRoster />
        ) : (
          <div className="mx-auto w-full max-w-md">
            <div className="mb-2 flex items-center justify-between">
              <Eyebrow dark marker="notch">
                Challenge roster
              </Eyebrow>
              <span className="font-mono text-xs uppercase tracking-[0.1em] text-neutral-400">
                {challenges.filter((c) => c.solved).length}/{challenges.length} solved
              </span>
            </div>

            {/* F09: today's daily, pinned above the roster. */}
            {dailyChallenge && (
              <Link
                href={`/practice/${dailyChallenge.slug}`}
                className="group mb-6 block border border-accent/60 bg-surface p-5 transition-colors hover:border-accent"
              >
                <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-accent">
                  <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
                  Today&rsquo;s daily — everyone, same problem
                </div>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <h3 className="break-words font-mono text-base font-bold uppercase tracking-[0.05em] text-cream transition-colors group-hover:text-accent">
                    {dailyChallenge.title}
                  </h3>
                  {daily?.you?.solved && (
                    <span className="flex flex-shrink-0 items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-accent">
                      <span aria-hidden className="inline-block h-2 w-2 bg-accent" />
                      Solved
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Chip variant="dark">{dailyChallenge.difficulty}</Chip>
                  {daily?.you && daily.you.attempts > 0 && !daily.you.solved && (
                    <span className="font-mono text-xs text-neutral-500">
                      {daily.you.attempts} {daily.you.attempts === 1 ? 'attempt' : 'attempts'}
                    </span>
                  )}
                </div>
              </Link>
            )}

            <div>
              {challenges.map((challenge, i) => (
                <ChallengeRow key={challenge.slug} index={i} challenge={challenge} />
              ))}
            </div>
          </div>
        )
      }
      leftFooter="Your code runs only inside the judge sandbox — never in your browser."
      rightFooter="Runs show samples only. Submissions judge hidden tests."
    />
  );
}
