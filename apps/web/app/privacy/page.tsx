import type { Metadata } from 'next';
import Link from 'next/link';
import { SplitShell } from '../../components/SplitShell';
import { Eyebrow, Headline } from '../../components/ui';

export const metadata: Metadata = {
  title: 'Privacy',
};

/**
 * F10 privacy (docs/features/F10-hardening.md): what is stored, what is NOT,
 * and the two analytics facts (own events table, no third-party trackers).
 */

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: 'What we store',
    body: 'Your display name, email, optional avatar, points and match statistics, your submissions, and your match history. That is the whole list. No marketing profile, no contacts, no location.',
  },
  {
    title: 'What we never store',
    body: 'Google passwords (we only verify the sign-in token Google hands us), payment data (there is nothing to pay), and any third-party advertising or tracking identifiers. There are no tracking pixels and no ad networks.',
  },
  {
    title: 'Usage events',
    body: 'The app keeps its own small event log (account created, match started, submission judged, daily viewed, feedback sent) so the owner can see what is working. Events hold ids and coarse facts only — never your code, and anonymous visits to public pages are not recorded.',
  },
  {
    title: 'Error tracking',
    body: 'When something breaks, an error report may be sent to Sentry. Reports carry technical details and internal ids — never your code, your email, or your session cookie.',
  },
  {
    title: 'Cookies',
    body: 'One first-party session cookie keeps you signed in. It is HttpOnly (JavaScript cannot read it) and SameSite=Lax. No consent banner, because there is nothing else to consent to.',
  },
  {
    title: 'Your data',
    body: 'Want your account or submissions deleted? Send a note through the feedback form on your profile and the owner will take care of it.',
  },
];

export default function PrivacyPage() {
  return (
    <SplitShell
      left={
        <>
          <div className="mb-4">
            <Eyebrow marker="square">The whole list</Eyebrow>
          </div>
          <Headline className="mb-8">Privacy.</Headline>
          <p className="max-w-md font-grotesk text-sm leading-relaxed text-muted">
            What {`{ duel }`} stores, and what it deliberately does not. Last updated 2026-10-30.
          </p>
          <div className="mt-10 max-w-md border border-line-light bg-sand/60 p-4 font-grotesk text-sm leading-relaxed text-muted">
            The short version: a display name, an email, your games. Nothing else, nothing sold, nothing tracked.
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
            <Link href="/terms" className="transition-colors hover:text-accent">
              Terms →
            </Link>
          </div>
        </div>
      }
      leftFooter="One first-party session cookie. No banners needed for a site with nothing to hide."
      rightFooter="Events hold ids and coarse facts — never your code."
    />
  );
}
