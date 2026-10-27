import type { ReactNode } from 'react';

/** Small mono label above a huge headline (design-tokens.md §4, §5). */
export function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      className={`font-mono text-[11px] uppercase tracking-[0.25em] ${
        dark ? 'text-muted-dark' : 'text-muted-light'
      }`}
    >
      {children}
    </p>
  );
}

/** Huge condensed uppercase headline; always ends with a period. */
export function Headline({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <h1
      className={`font-display text-6xl uppercase leading-[0.95] tracking-tight md:text-7xl lg:text-8xl ${
        dark ? 'text-paper' : 'text-ink'
      }`}
    >
      {children}
    </h1>
  );
}

/** Outlined chip with mono caps text; `filled` for the solid dark variant. */
export function Chip({
  children,
  filled = false,
  dark = false,
}: {
  children: ReactNode;
  filled?: boolean;
  dark?: boolean;
}) {
  const base = 'inline-block px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em]';
  if (filled) return <span className={`${base} bg-ink-raised text-cream`}>{children}</span>;
  return (
    <span className={`${base} border ${dark ? 'border-rule-dark text-muted-dark' : 'border-rule-light text-muted-light'}`}>
      {children}
    </span>
  );
}

/** Mono caption under a hairline rule, pinned to the bottom of a half. */
export function FooterCaption({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div
      className={`mt-auto border-t pt-3 font-mono text-[11px] uppercase tracking-[0.2em] ${
        dark ? 'border-rule-dark text-muted-dark' : 'border-rule-light text-muted-light'
      }`}
    >
      {children}
    </div>
  );
}
