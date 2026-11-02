import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SplitShell } from '../components/SplitShell';
import { Chip, Eyebrow, Headline, Stat } from '../components/ui';
import { getCurrentUser } from '../lib/session';

/**
 * F10 landing page (docs/features/F10-hardening.md): the brutalist hero a
 * stranger sees first — what the game is, the three doors (PLAY, PRACTICE,
 * TODAY'S CHALLENGE, PLAY VS KERN), and the real duels-played counter from
 * the events table. No sample numbers — the count starts at 0 and only
 * moves with real matches. Signed-in players go straight to their profile;
 * the landing is the signed-out front door (also fully viewable signed-out).
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
          <Headline className="mb-8">
            Two players.
            <br />
            One problem.
            <br />
            Ten minutes.
          </Headline>
          <p className="mb-10 max-w-md font-grotesk text-base leading-relaxed text-muted">
            You both get the same coding challenge at the same second. First to pass every test wins the swing —
            the loser pays what they have, never more. Your code runs only inside the judge sandbox; the server
            referees everything.
          </p>

          <Link
            href="/duel"
            className="block w-full max-w-md bg-accent px-6 py-5 text-center font-mono text-sm font-bold uppercase tracking-[0.15em] text-carbon transition-colors hover:bg-[#ff6231]"
          >
            Play — duel a rival
          </Link>

          <div className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-line-light pt-6">
            <Stat label="Duels played" value={played === null ? '—' : played.toLocaleString('en-US')} />
            <Stat label="Judge" value="Sandboxed" />
            <Stat label="Points floor" value="Zero" />
          </div>
        </>
      }
      right={
        <div className="mx-auto w-full max-w-md">
          <div className="mb-4">
            <Eyebrow dark marker="notch">
              Three doors in
            </Eyebrow>
          </div>

          <Link href="/duel" className="group block border-b border-line-dark py-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-mono text-base font-bold uppercase tracking-[0.05em] text-cream transition-colors group-hover:text-accent">
                Duel a rival
              </h3>
              <Chip variant="dark">PvP</Chip>
            </div>
            <p className="mt-2 font-grotesk text-sm leading-relaxed text-neutral-400">
              Create a room, send the invite code. Both ready, host starts, the clock decides.
            </p>
          </Link>

          <Link href="/duel" className="group block border-b border-line-dark py-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-mono text-base font-bold uppercase tracking-[0.05em] text-cream transition-colors group-hover:text-accent">
                Play vs KERN
              </h3>
              <Chip variant="dark">Practice</Chip>
            </div>
            <p className="mt-2 font-grotesk text-sm leading-relaxed text-neutral-400">
              Nobody online? The house bot duels at a human pace. No points, no stats — pure reps.
            </p>
          </Link>

          <Link href="/practice" className="group block border-b border-line-dark py-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-mono text-base font-bold uppercase tracking-[0.05em] text-cream transition-colors group-hover:text-accent">
                Practice floor
              </h3>
              <Chip variant="dark">Solo</Chip>
            </div>
            <p className="mt-2 font-grotesk text-sm leading-relaxed text-neutral-400">
              Every challenge, no clock pressure. Run the samples, submit against the hidden tests.
            </p>
          </Link>

          <Link href="/daily" className="group block py-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-mono text-base font-bold uppercase tracking-[0.05em] text-cream transition-colors group-hover:text-accent">
                Today&rsquo;s challenge
              </h3>
              <Chip variant="dark">Daily</Chip>
            </div>
            <p className="mt-2 font-grotesk text-sm leading-relaxed text-neutral-400">
              One problem for the whole arena each day, no repeats while the pool lasts. Build the streak.
            </p>
          </Link>

          <div className="mt-8 flex items-center gap-4 border-t border-line-dark pt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
            <Link href="/terms" className="transition-colors hover:text-accent">
              Terms
            </Link>
            <span aria-hidden>/</span>
            <Link href="/privacy" className="transition-colors hover:text-accent">
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
