import type { ReactNode } from 'react';

/**
 * Shared brutalist primitives from the owner's login design.
 * Headlines: Syne, uppercase, tight tracking, end with a period.
 * Labels: JetBrains Mono, uppercase, wide letter-spacing.
 */

/** Mono label; `square` marker (cream side) or `notch` orange bar (dark side). */
export function Eyebrow({
  children,
  dark = false,
  marker = 'none',
}: {
  children: ReactNode;
  dark?: boolean;
  marker?: 'square' | 'notch' | 'none';
}) {
  return (
    <p
      className={`flex items-center gap-2.5 font-mono text-xs font-bold uppercase tracking-[0.22em] ${
        dark ? 'text-neutral-400' : 'text-carbon'
      }`}
    >
      {marker === 'square' && (
        <span aria-hidden className={`inline-block h-2 w-2 ${dark ? 'bg-cream' : 'bg-carbon'}`} />
      )}
      {marker === 'notch' && <span aria-hidden className="inline-block h-1.5 w-3.5 bg-accent" />}
      <span>{children}</span>
    </p>
  );
}

/** Huge Syne headline, uppercase, ends with a period. Size via className. */
export function Headline({
  children,
  dark = false,
  className = 'text-6xl sm:text-7xl md:text-8xl',
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <h1
      className={`font-headline font-extrabold uppercase leading-[0.9] tracking-[-0.06em] ${
        dark ? 'text-cream' : 'text-carbon'
      } ${className}`}
    >
      {children}
    </h1>
  );
}

/** Mono chip. `filled` solid dark, `accent` solid orange. */
export function Chip({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'filled' | 'accent' | 'dark';
}) {
  const base = 'px-2.5 py-1 font-mono text-xs font-medium tracking-wide';
  switch (variant) {
    case 'filled':
      return <span className={`${base} bg-carbon text-cream`}>{children}</span>;
    case 'accent':
      return <span className={`${base} bg-accent font-bold tracking-wider text-white`}>{children}</span>;
    case 'dark':
      return <span className={`${base} border border-line-dark text-neutral-400`}>{children}</span>;
    default:
      return (
        <span className={`${base} border border-line-light bg-sand/80 text-carbon`}>{children}</span>
      );
  }
}

/** Mono caption under a hairline rule, pinned to the bottom of a half. */
export function FooterCaption({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div
      className={`border-t pt-4 font-mono text-[11px] uppercase tracking-[0.18em] ${
        dark ? 'border-line-dark text-neutral-500' : 'border-line-light text-muted'
      }`}
    >
      {children}
    </div>
  );
}
