import type { ReactNode } from 'react';
import { FooterCaption } from './ui';
import { Header } from './Header';

/** Bottom rules ticker — real protocol rules only (no fake stats). */
function RulesTicker() {
  return (
    <footer className="z-20 w-full overflow-hidden border-t border-line-dark bg-void px-5 py-3 select-none sm:px-10">
      <div className="flex items-center gap-6 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.22em] sm:gap-8">
        <span className="font-bold text-accent">● Protocol rules</span>
        <span className="text-neutral-400">One problem. First correct solution wins.</span>
        <span aria-hidden className="hidden text-neutral-600 md:inline">/ /</span>
        <span className="hidden text-neutral-300 md:inline">
          Rating changes only when the match ends.
        </span>
      </div>
    </footer>
  );
}

/**
 * The split layout (decision D9): cream left column (7/12), near-black right
 * column (5/12), one system bar across both, orange seam markers, rules
 * ticker at the bottom. On mobile the halves stack, cream first (D10).
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
    <div className="flex min-h-screen flex-col bg-carbon">
      <div className="relative">
        <Header />
      </div>
      <main className="grid flex-1 grid-cols-1 lg:grid-cols-12">
        {/* Cream half */}
        <section className="relative flex flex-col border-b border-line-light bg-cream px-5 py-10 sm:px-12 lg:col-span-7 lg:border-b-0 lg:border-r lg:px-16 lg:py-14">
          <span aria-hidden className="texture-cream pointer-events-none absolute inset-0 opacity-30" />
          {/* Orange seam marker, top of the split (owner design) */}
          <span aria-hidden className="absolute right-0 top-0 hidden h-2 w-8 bg-accent lg:block" />
          <div className="relative z-10 flex flex-1 flex-col">
            {left}
          </div>
          <div className="relative z-10">
            <FooterCaption>{leftFooter}</FooterCaption>
          </div>
        </section>

        {/* Dark half */}
        <section className="relative flex flex-col bg-carbon px-5 py-10 text-white sm:px-12 lg:col-span-5 lg:px-16 lg:py-14">
          <span aria-hidden className="texture-dark pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative z-10 flex flex-1 flex-col">
            {right}
          </div>
          <div className="relative z-10">
            <FooterCaption dark>{rightFooter}</FooterCaption>
          </div>
        </section>
      </main>
      <RulesTicker />
    </div>
  );
}
