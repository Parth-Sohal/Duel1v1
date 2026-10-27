import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { SplitShell } from '../../components/SplitShell';
import { Chip, Eyebrow, Headline } from '../../components/ui';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { getCurrentUser } from '../../lib/session';

/** Real protocol facts (decisions D3/D6) — no sample stats. */
function ProtocolCard() {
  const rows: Array<[string, ReactNode]> = [
    ['Supported runtimes', <>JavaScript · Python</>],
    ['Match clock', <>10:00 server-owned</>],
    ['Verdicts', <>Server is the referee</>],
  ];
  return (
    <div className="border border-line-dark bg-surface/80 p-4">
      <div className="mb-3 flex items-center justify-between border-b border-neutral-800 pb-2 font-mono text-[11px]">
        <span className="flex items-center gap-2 text-neutral-400">
          <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
          <span className="uppercase tracking-[0.2em]">Arena protocol</span>
        </span>
        <span className="text-[10px] uppercase tracking-widest text-neutral-600">Fixed rules</span>
      </div>
      <div className="space-y-2 font-mono text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <span className="text-neutral-500 uppercase tracking-wider">{label}:</span>
            <span className="text-right font-bold text-neutral-300">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Login screen (owner brutalist design, 2026-10-27): giant "SIGN IN." on the
 * cream half, authentication portal on the dark half. GitHub and guest modes
 * are not built (F01 is Google only); sample stats are omitted by rule.
 */
export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/profile');
  }

  return (
    <SplitShell
      left={
        <>
          <div className="mb-4">
            <Eyebrow marker="square">Coding Arena // Round protocol</Eyebrow>
          </div>
          <Headline className="mb-6 text-7xl sm:text-8xl md:text-9xl">Sign in.</Headline>

          {/* The rules, straight from the product */}
          <div className="my-6 space-y-2 border-l-2 border-carbon pl-4">
            <p className="font-mono text-sm font-bold uppercase leading-relaxed tracking-wider text-carbon sm:text-base">
              Two players. One challenge. Ten minutes.
            </p>
            <p className="font-mono text-xs font-medium uppercase leading-relaxed tracking-wider text-muted sm:text-sm">
              First to pass all automated test cases wins.
            </p>
            <p className="font-mono text-xs font-medium uppercase leading-relaxed tracking-wider text-muted sm:text-sm">
              Rating changes only when the match ends.
            </p>
          </div>

          {/* Real launch facts instead of sample divisions */}
          <div className="mt-8 border-t border-line-light/80 pt-6">
            <span className="mb-3 block font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
              Languages at launch:
            </span>
            <div className="flex flex-wrap gap-2">
              <Chip>JavaScript</Chip>
              <Chip>Python</Chip>
              <Chip variant="accent">Rated 1v1</Chip>
            </div>
          </div>
        </>
      }
      right={
        <div className="mx-auto my-auto w-full max-w-md py-8">
          <div className="mb-6">
            <Eyebrow dark marker="notch">
              Google account / SSO gate
            </Eyebrow>
          </div>
          <h2 className="mb-3 font-headline text-2xl font-extrabold uppercase tracking-tight text-white sm:text-3xl">
            Authenticate protocol
          </h2>
          <p className="mb-8 font-mono text-xs uppercase leading-relaxed tracking-[0.18em] text-neutral-400">
            Sign in with your Google account. No passwords stored.
          </p>

          <GoogleSignInButton />

          <div className="mt-10">
            <ProtocolCard />
          </div>

          <p className="mt-6 text-center font-mono text-[10px] uppercase leading-relaxed tracking-[0.22em] text-neutral-600">
            Sessions last 30 days. HTTP-only cookie. Sign out any time.
          </p>
        </div>
      }
      leftFooter="Two players. One challenge. Ten minutes."
      rightFooter="The server is the referee. Outcomes are decided server-side."
    />
  );
}
