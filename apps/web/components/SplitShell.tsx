import type { ReactNode } from 'react';
import { FooterCaption } from './ui';
import { Header } from './Header';

/**
 * The split layout (decision D9: final, no theme switch): cream left half,
 * near-black right half, one nav bar across both, a small orange marker where
 * the halves meet. On mobile the halves stack, cream first (D10).
 */
export function SplitShell({
  left,
  right,
  leftFooter,
  rightFooter,
}: {
  left: ReactNode;
  right: ReactNode;
  leftFooter: string;
  rightFooter: string;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="relative flex flex-1 flex-col md:flex-row">
        {/* Divider markers: where the halves meet, under the nav and at the bottom */}
        <span aria-hidden className="absolute left-1/2 top-0 hidden h-1 w-3 -translate-x-1/2 bg-accent md:block" />
        <span aria-hidden className="absolute bottom-0 left-1/2 hidden h-1 w-3 -translate-x-1/2 bg-accent md:block" />

        <section className="texture-cream flex w-full flex-1 flex-col bg-cream px-5 pb-6 pt-10 md:w-1/2 md:px-10 md:pb-8 md:pt-14">
          <div className="flex-1">{left}</div>
          <FooterCaption>{leftFooter}</FooterCaption>
        </section>

        <section className="texture-dark flex w-full flex-1 flex-col bg-ink px-5 pb-6 pt-10 text-paper md:w-1/2 md:px-10 md:pb-8 md:pt-14">
          <div className="flex-1">{right}</div>
          <FooterCaption dark>{rightFooter}</FooterCaption>
        </section>
      </main>
    </div>
  );
}
