import { redirect } from 'next/navigation';
import { SplitShell } from '../../components/SplitShell';
import { ChallengeRoster, type DailyTeaser } from '../../components/ChallengeRoster';
import { Eyebrow, Headline, Stat } from '../../components/ui';
import { getCurrentUser } from '../../lib/session';
import { getChallengeList } from '../../lib/practice';
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
  const dailyTeaser: DailyTeaser | null =
    daily?.challenge != null
      ? {
          slug: daily.challenge.slug,
          title: daily.challenge.title,
          difficulty: daily.challenge.difficulty,
          tags: daily.challenge.tags,
          solved: daily.you?.solved ?? false,
          attempts: daily.you?.attempts ?? 0,
        }
      : null;

  return (
    <SplitShell
      left={
        <>
          <div className="mb-4">
            <Eyebrow marker="square">Solo drills · warm-up floor</Eyebrow>
          </div>
          <Headline className="mb-6">
            Practice<span aria-hidden className="text-accent">.</span>
          </Headline>
          <p className="mb-10 max-w-md font-grotesk text-sm leading-relaxed text-muted">
            Read the problem, write the function, run it against the samples, submit against everything. You return
            the answer — the judge calls your function. No opponent yet; this is where the reps happen before the
            duels.
          </p>

          <div className="mb-10 max-w-md border-t border-line-light pt-8">
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <Stat label="Languages" value="JS · PY" />
              <Stat label="CPU limit" value={5} unit="s" />
              <Stat label="Memory" value={256} unit="MB" />
              <Stat label="Challenges" value={challenges ? challenges.length : '—'} />
            </div>
          </div>

          <div className="max-w-md border border-line-light bg-sand/60 p-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-carbon">
              <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
              How judging works
            </div>
            <p className="font-grotesk text-sm leading-relaxed text-muted">
              <code className="bg-sand px-1 font-mono font-bold text-carbon">RUN</code> calls your function on the
              visible samples only and saves nothing.{' '}
              <code className="bg-sand px-1 font-mono font-bold text-carbon">SUBMIT</code> judges the hidden tests
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
          <ChallengeRoster challenges={challenges} daily={dailyTeaser} />
        )
      }
      leftFooter="Your code runs only inside the judge sandbox — never in your browser."
      rightFooter={
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span>Synced with the arena engine.</span>
          <span className="hidden sm:inline">Keyboard: [J/K] navigate · [Enter] enter problem</span>
        </div>
      }
    />
  );
}
