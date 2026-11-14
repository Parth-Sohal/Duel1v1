import type { ReactNode } from 'react';
import { FooterCaption } from './ui';
import { Header } from './Header';

/** Bottom rules ticker — real protocol rules only (no fake stats). */
function RulesTicker() {
  return (
    <footer className="z-20 w-full overflow-hidden border-t border-line-dark bg-void px-5 py-3 select-none sm:px-10">
      <div className="flex items-center gap-4 whitespace-nowrap font-mono text-xs tracking-[0.05em] sm:gap-8">
        <span className="flex-shrink-0 font-bold text-accent">● Protocol rules</span>
        <span className="truncate text-neutral-400">One problem. First correct solution wins.</span>
        <span aria-hidden className="hidden flex-shrink-0 text-neutral-600 md:inline">/ /</span>
        <span className="hidden truncate text-neutral-300 md:inline">
          Rating changes only when the match ends.
        </span>
      </div>
    </footer>
  );
}

/**
 * The split layout (decision D9): cream left column (7/12), near-black right
 * column (5/12), one system bar across both, orange seam markers, rules
 * ticker at the bottom. Mobile: the halves stack, cream first (D10).
 *
 * Panels grow with their content and the page scrolls — nothing is clipped
 * vertically. `overflow-x-clip` only stops the dotted texture from creating a
 * horizontal scrollbar. Mobile stacking is preserved.
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
    <div className="relative flex min-h-screen flex-col bg-carbon">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-carbon focus:px-4 focus:py-3 focus:font-mono focus:text-xs focus:font-bold uppercase tracking-[0.1em] focus:text-cream"
      >
        Skip to content
      </a>
      <div className="relative">
        <Header />
      </div>
      <main id="main-content" tabIndex={-1} className="grid flex-1 grid-cols-1 lg:grid-cols-12">
        {/* Cream half */}
        <section className="relative flex min-w-0 flex-col overflow-x-clip border-b border-line-light bg-cream px-5 pb-12 pt-10 sm:px-8 lg:col-span-7 lg:border-b-0 lg:border-r lg:px-14 lg:pb-14 lg:pt-12">
          <span aria-hidden className="texture-cream pointer-events-none absolute inset-0 opacity-30" />
          {/* Orange seam marker, top of the split (owner design) */}
          <span aria-hidden className="absolute right-0 top-0 hidden h-2 w-8 bg-accent lg:block" />
          <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center">{left}</div>
          <div className="relative z-10 mt-10">
            <FooterCaption>{leftFooter}</FooterCaption>
          </div>
        </section>

        {/* Dark half */}
        <section className="relative flex min-w-0 flex-col overflow-x-clip bg-carbon px-5 pb-12 pt-10 text-white sm:px-8 lg:col-span-5 lg:px-14 lg:pb-14 lg:pt-12">
          <span aria-hidden className="texture-dark pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center">{right}</div>
          <div className="relative z-10 mt-10">
            <FooterCaption dark>{rightFooter}</FooterCaption>
          </div>
        </section>
      </main>
      <RulesTicker />
    </div>
  );
}
