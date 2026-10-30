import Link from 'next/link';
import { SplitShell } from '../../components/SplitShell';
import { DailyCountdown } from '../../components/DailyCountdown';
import { Chip, Eyebrow, Headline, Stat } from '../../components/ui';
import { getCurrentUser } from '../../lib/session';
import { getDaily } from '../../lib/daily';

/**
 * F09 daily challenge (docs/features/F09-daily-challenge.md). Everyone gets
 * the same problem each UTC day. VIEWABLE signed-out — the CTA leads into the
 * practice flow, which redirects to sign-in when needed. Solving, judging,
 * rate limits and solved state are the F04 systems exactly; this page only
 * adds the banner + countdown.
 */

function Offline() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-4">
        <Eyebrow dark marker="notch">
          Today&rsquo;s challenge
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

function NoPool() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-4">
        <Eyebrow dark marker="notch">
          Today&rsquo;s challenge
        </Eyebrow>
      </div>
      <h2 className="mb-3 font-headline text-4xl font-extrabold uppercase tracking-tight text-cream">
        No challenge today.
      </h2>
      <p className="font-grotesk text-sm leading-relaxed text-neutral-300">
        Nothing is published yet. The daily starts the moment the first challenge is signed off.
      </p>
    </div>
  );
}

export default async function DailyPage() {
  const user = await getCurrentUser();
  const daily = await getDaily();

  return (
    <SplitShell
      left={
        <>
          <div className="mb-4">
            <Eyebrow marker="square">Daily challenge · one for everyone</Eyebrow>
          </div>
          <Headline className="mb-6">Today&rsquo;s pick.</Headline>
          <p className="mb-10 max-w-md font-grotesk text-sm leading-relaxed text-muted">
            The whole arena gets the same problem every day, chosen from the signed-off pool. Solve it like any
            practice challenge — run the samples, submit against everything. Come back tomorrow for the next one.
          </p>

          <div className="mb-10 grid max-w-md grid-cols-2 gap-x-8 gap-y-6">
            <Stat label="Day (UTC)" value={daily?.day ?? '—'} />
            <Stat label="Rotation" value="No repeats" />
          </div>

          {daily?.day && <DailyCountdown day={daily.day} />}

          <div className="mt-10 max-w-md border border-line-light bg-sand/60 p-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-carbon">
              <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
              Fair by design
            </div>
            <p className="font-grotesk text-sm leading-relaxed text-muted">
              The pick is fixed server-side before anyone asks — same problem, same clock, no rerolls. While the
              pool has fresh entries, nothing repeats.
            </p>
          </div>
        </>
      }
      right={
        daily === null ? (
          <Offline />
        ) : daily.challenge === null ? (
          <NoPool />
        ) : (
          <div className="mx-auto w-full max-w-md">
            <div className="mb-4">
              <Eyebrow dark marker="notch">
                Today&rsquo;s challenge
              </Eyebrow>
            </div>

            <Link
              href={`/practice/${daily.challenge.slug}`}
              className="group block border border-line-dark bg-surface p-6 transition-colors hover:border-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="break-words font-mono text-lg font-bold uppercase tracking-[0.05em] text-cream transition-colors group-hover:text-accent">
                  {daily.challenge.title}
                </h3>
                {daily.you?.solved && (
                  <span className="flex flex-shrink-0 items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-accent">
                    <span aria-hidden className="inline-block h-2 w-2 bg-accent" />
                    Solved
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Chip variant="dark">{daily.challenge.difficulty}</Chip>
                {daily.challenge.tags.map((tag) => (
                  <span key={tag} className="font-mono text-xs text-neutral-400">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-5 line-clamp-6 whitespace-pre-line font-grotesk text-sm leading-relaxed text-neutral-300">
                {daily.challenge.statement}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-line-dark pt-4">
                <span className="font-mono text-xs text-neutral-500">
                  {daily.you && daily.you.attempts > 0
                    ? `${daily.you.attempts} ${daily.you.attempts === 1 ? 'attempt' : 'attempts'} today's pick`
                    : 'Not attempted yet'}
                </span>
                <span className="font-mono text-sm font-bold uppercase tracking-[0.1em] text-accent">
                  Solve it &rarr;
                </span>
              </div>
            </Link>

            {!user && (
              <p className="mt-4 font-grotesk text-xs text-neutral-400">
                Viewing as a guest — sign in to submit. Hidden tests stay sealed either way.
              </p>
            )}
          </div>
        )
      }
      leftFooter="The daily is a pointer at a published challenge — same judge, same rules, no second code path."
      rightFooter="Resets every midnight UTC."
    />
  );
}
