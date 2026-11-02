import type { ReactNode } from 'react';

/**
 * Shared brutalist primitives (owner design).
 * Type discipline: two body sizes only (text-sm 14px / text-xs 12px),
 * sentence case for body copy, all-caps only for labels/nav/headings.
 * Contrast: muted #57534E on cream (6.8:1), neutral-300/400 on carbon (AA+).
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
      className={`flex items-center gap-2.5 font-mono text-xs font-semibold uppercase tracking-[0.1em] ${
        dark ? 'text-neutral-400' : 'text-muted'
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

/**
 * Huge Syne headline, uppercase, ends with a period. Sizes use clamp() so a
 * long player name can never push into the other panel; pair with
 * `break-words` + min-w-0 wrappers. Default ~52–96px.
 */
export function Headline({
  children,
  dark = false,
  className = 'text-[clamp(3rem,8vw,6.5rem)]',
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <h1
      className={`font-headline font-extrabold uppercase leading-[0.95] tracking-[-0.02em] break-words ${
        dark ? 'text-cream' : 'text-carbon'
      } ${className}`}
    >
      {children}
    </h1>
  );
}

/** Stat block: small mono label over a big headline numeral. `unit` renders
 * smaller, baseline-aligned (e.g. 256 with unit "MB"). */
export function Stat({
  label,
  value,
  unit,
  dark = false,
}: {
  label: string;
  value: string | number;
  unit?: string;
  dark?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span
        className={`truncate font-mono text-xs uppercase tracking-[0.1em] ${
          dark ? 'text-neutral-400' : 'text-muted'
        }`}
      >
        {label}
      </span>
      <span
        className={`font-headline text-3xl font-extrabold leading-none md:text-4xl ${
          dark ? 'text-cream' : 'text-carbon'
        }`}
      >
        {value}
        {unit && <span className="ml-1 align-baseline text-lg font-bold">{unit}</span>}
      </span>
    </div>
  );
}

/** Mono chip. `filled` solid dark, `accent` solid orange (AA: carbon text). */
export function Chip({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'filled' | 'accent' | 'dark';
}) {
  const base = 'px-2.5 py-1 font-mono text-xs font-medium tracking-[0.05em]';
  switch (variant) {
    case 'filled':
      return <span className={`${base} bg-carbon text-cream`}>{children}</span>;
    case 'accent':
      return <span className={`${base} bg-accent font-bold text-carbon`}>{children}</span>;
    case 'dark':
      return <span className={`${base} border border-line-dark text-neutral-300`}>{children}</span>;
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
      className={`border-t pt-4 font-mono text-xs tracking-[0.05em] ${
        dark ? 'border-line-dark text-neutral-400' : 'border-line-light text-muted'
      }`}
    >
      {children}
    </div>
  );
}

/** Empty-state skill radar: dashed hexagon grid, no data — a designed skeleton. */
export function RadarSkeleton({ dark = false }: { dark?: boolean }) {
  const vertex = (r: number, i: number) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    return `${100 + r * Math.cos(a)},${100 + r * Math.sin(a)}`;
  };
  const polygon = (r: number) => Array.from({ length: 6 }, (_, i) => vertex(r, i)).join(' ');
  const stroke = dark ? '#2c2c2c' : '#c9c3b4';
  return (
    <svg viewBox="0 0 200 200" className="h-52 w-52 max-w-full" role="img" aria-label="Skill radar placeholder — unlocks after your first duels">
      {[80, 56, 32].map((r) => (
        <polygon key={r} points={polygon(r)} fill="none" stroke={stroke} strokeWidth="1" strokeDasharray="4 4" />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <line
          key={i}
          x1="100"
          y1="100"
          x2={100 + 80 * Math.cos(((-90 + i * 60) * Math.PI) / 180)}
          y2={100 + 80 * Math.sin(((-90 + i * 60) * Math.PI) / 180)}
          stroke={stroke}
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      ))}
      <rect x="96" y="96" width="8" height="8" fill="#ff4d15" />
    </svg>
  );
}
