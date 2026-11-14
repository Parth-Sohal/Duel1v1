import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SplitShell } from '../components/SplitShell';
import { Chip, Eyebrow, Headline, Stat } from '../components/ui';
import { getCurrentUser } from '../lib/session';

/**
 * Signed-out landing page: what the game is, the two primary doors, a
 * CSS-built illustrative duel preview, and concise links to every way in.
 * The duels-played count is the only number on the page and comes from the
 * real `GET /api/stats/public` request — no sample players, scores or live
 * status. Signed-in players still go straight to their profile.
 */

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000';

async function duelsPlayed(): Promise<number | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/stats/public`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { duelsPlayed?: number };
    return typeof data.duelsPlayed === 'number' ? data.duelsPlayed : null;
  } catch {
    return null;
  }
}

const DOORS = [
  {
    label: 'Duel a rival',
    href: '/duel',
    note: 'Invite a friend with a code. First accepted solution wins.',
  },
  {
    label: 'Play vs KERN',
    href: '/duel',
    note: 'The house bot. Same engine, practice only — no points.',
  },
  {
    label: 'Practice floor',
    href: '/practice',
    note: 'Every challenge, no clock. Run samples, submit for real.',
  },
  {
    label: 'Today’s challenge',
    href: '/daily',
    note: 'One problem for the whole arena, once a day.',
  },
] as const;

/** Small CSS-built mock — explicitly illustrative, not live data. */
function DuelPreview() {
  return (
    <figure aria-labelledby="duel-preview-caption" className="border border-line-dark bg-surface">
      <div aria-hidden>
        <div className="flex items-center justify-between gap-3 border-b border-line-dark px-4 py-3">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
            Same problem · same clock
          </span>
          <Chip variant="dark">Sample</Chip>
        </div>

        <div className="grid grid-cols-2">
          <div className="border-r border-line-dark p-4">
            <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
              <span className="inline-block h-1.5 w-1.5 bg-accent" />
              You
            </span>
            <div className="mt-3 space-y-1.5">
              <span className="block h-1.5 w-4/5 bg-neutral-700" />
              <span className="block h-1.5 w-3/5 bg-neutral-700" />
              <span className="block h-1.5 w-4/5 bg-neutral-700" />
            </div>
          </div>
          <div className="p-4">
            <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
              <span className="inline-block h-1.5 w-1.5 bg-neutral-600" />
              Rival
            </span>
            <div className="mt-3 space-y-1.5">
              <span className="block h-1.5 w-3/5 bg-neutral-700" />
              <span className="block h-1.5 w-4/5 bg-neutral-700" />
              <span className="block h-1.5 w-2/5 bg-neutral-700" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line-dark px-4 py-3">
          <span className="font-mono text-lg font-bold tabular-nums text-cream">10:00</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-400">Tests</span>
            <span className="flex gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className="h-2.5 w-2.5 border border-neutral-600" />
              ))}
            </span>
          </div>
        </div>
      </div>
      <figcaption
        id="duel-preview-caption"
        className="border-t border-line-dark px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-400"
      >
        Illustrative preview — not a live match
      </figcaption>
    </figure>
  );
}

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/profile');
  }
  const played = await duelsPlayed();

  return (
    <SplitShell
      left={
        <>
          <div className="mb-4">
            <Eyebrow marker="square">Coding arena · 1v1 · same problem, same clock</Eyebrow>
          </div>
          <Headline className="mb-6 text-[clamp(1.95rem,5.2vw,4.75rem)]">
            Two players.
            <br />
            One problem.
            <br />
            Ten minutes.
          </Headline>
          <p className="mb-8 max-w-md font-grotesk text-base leading-relaxed text-muted">
            Same challenge, same clock, same judge. First to pass every test takes the swing. Your
            code runs only inside the judge sandbox — the server keeps the score.
          </p>

          <div className="flex max-w-md flex-col gap-3 sm:flex-row">
            <Link
              href="/duel"
              className="flex min-h-12 flex-1 items-center justify-center bg-accent px-6 py-4 text-center font-mono text-sm font-bold uppercase tracking-[0.15em] text-carbon transition-colors hover:bg-[#ff6231]"
            >
              Start a duel
            </Link>
            <Link
              href="/practice"
              className="flex min-h-12 flex-1 items-center justify-center border border-carbon px-6 py-4 text-center font-mono text-sm font-bold uppercase tracking-[0.15em] text-carbon transition-colors hover:bg-carbon hover:text-cream"
            >
              Explore practice
            </Link>
          </div>

          <div className="mt-10 grid max-w-md grid-cols-2 gap-x-8 gap-y-6 border-t border-line-light pt-6">
            <Stat label="Duels played" value={played === null ? '—' : played.toLocaleString('en-US')} />
            <Stat label="Match clock" value="10:00" variant="fact" />
            <Stat label="Win swing" value="+29–31" variant="fact" />
            <Stat label="Points floor" value="0 — never negative" variant="fact" />
          </div>
        </>
      }
      right={
        <div className="mx-auto flex w-full max-w-md flex-col">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Eyebrow dark marker="notch">
              Inside a duel
            </Eyebrow>
            <Chip variant="dark">Illustrative</Chip>
          </div>

          <DuelPreview />

          <nav aria-label="Ways to play" className="mt-8 border-t border-line-dark">
            {DOORS.map((door) => (
              <Link
                key={door.label}
                href={door.href}
                className="group flex min-h-14 items-center justify-between gap-4 border-b border-line-dark py-3.5"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-sm font-bold uppercase tracking-[0.05em] text-cream transition-colors group-hover:text-accent">
                    {door.label}
                  </span>
                  <span className="mt-1 block font-grotesk text-xs leading-relaxed text-neutral-400">
                    {door.note}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="flex-shrink-0 font-mono text-base text-neutral-600 transition-colors group-hover:text-accent"
                >
                  →
                </span>
              </Link>
            ))}
          </nav>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
            <Link href="/terms" className="inline-flex min-h-10 items-center py-2 transition-colors hover:text-accent">
              Terms
            </Link>
            <span aria-hidden>/</span>
            <Link href="/privacy" className="inline-flex min-h-10 items-center py-2 transition-colors hover:text-accent">
              Privacy
            </Link>
            <span aria-hidden>/</span>
            <span>No ads. No tracking pixels.</span>
          </div>
        </div>
      }
      leftFooter="Sign in with Google or email — your account stores only a display name and email."
      rightFooter="Every duel runs through the same engine. The clock and the judge are the referees."
    />
  );
}
