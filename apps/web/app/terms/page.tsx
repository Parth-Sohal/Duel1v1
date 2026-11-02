import type { Metadata } from 'next';
import Link from 'next/link';
import { SplitShell } from '../../components/SplitShell';
import { Eyebrow, Headline } from '../../components/ui';

export const metadata: Metadata = {
  title: 'Terms',
};

/**
 * F10 terms (docs/features/F10-hardening.md): honest, short, brutalist. No
 * legalese the product does not actually honor.
 */

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: 'What this is',
    body: '{ duel } is a 1v1 coding-duel game. Two players get the same coding challenge; the first accepted solution wins. Practice duels against the house bot (KERN) move no points.',
  },
  {
    title: 'Your account',
    body: 'You sign in with Google or an email + password. Your account stores a display name, an email, an optional avatar, and your match history. You can stop playing at any time; nothing else is required of you.',
  },
  {
    title: 'Fair play',
    body: 'The server referees every match: same challenge, same clock, points decided by fixed rules. Getting help from a person or tool during a ranked duel is on your conscience — the engine cannot watch your room. Bot duels never affect ratings, so there is nothing to grind there.',
  },
  {
    title: 'Points and ratings',
    body: 'Points move only when a ranked duel ends: the winner takes the swing, the loser pays what they have (points never go below zero), draws and forfeits cost less. Bot duels move nothing and count nothing.',
  },
  {
    title: 'Code you submit',
    body: 'Your solutions are stored so you can see your own submissions and they can be replayed as evidence of a win. We do not publish your code to other players, and we do not train anything on it.',
  },
  {
    title: 'Changes to the game',
    body: 'The challenge pool, rules, and scoring may be adjusted as the game grows. Material changes to these terms will be noted on this page.',
  },
];

export default function TermsPage() {
  return (
    <SplitShell
      left={
        <>
          <div className="mb-4">
            <Eyebrow marker="square">The deal</Eyebrow>
          </div>
          <Headline className="mb-8">Terms.</Headline>
          <p className="max-w-md font-grotesk text-sm leading-relaxed text-muted">
            Plain terms for a small arena. Last updated 2026-10-30.
          </p>
          <div className="mt-10 max-w-md border border-line-light bg-sand/60 p-4 font-grotesk text-sm leading-relaxed text-muted">
            Questions or disputes? Send feedback from your profile — the owner reads every note.
          </div>
        </>
      }
      right={
        <div className="mx-auto w-full max-w-md">
          {SECTIONS.map((s) => (
            <section key={s.title} className="border-b border-line-dark py-6 first:pt-0">
              <h2 className="font-mono text-sm font-bold uppercase tracking-[0.1em] text-accent">{s.title}</h2>
              <p className="mt-3 font-grotesk text-sm leading-relaxed text-neutral-300">{s.body}</p>
            </section>
          ))}
          <div className="pt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
            <Link href="/privacy" className="transition-colors hover:text-accent">
              Privacy →
            </Link>
          </div>
        </div>
      }
      leftFooter="Short terms on purpose — everything above is the whole deal."
      rightFooter="No ads. No third-party trackers."
    />
  );
}
