'use client';

/**
 * Practice roster (owner mockup, 2026-11-02): progress pill, difficulty
 * filter tabs with real counts, today's daily pinned on top, numbered rows
 * with colored difficulty, and [J/K] / [Enter] keyboard navigation. Filtering
 * and focus live client-side; every number shown is computed from the real
 * challenge list — nothing is hard-coded.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ChallengeListItem } from '../lib/practice';

export type DailyTeaser = {
  slug: string;
  title: string;
  difficulty: ChallengeListItem['difficulty'];
  tags: string[];
  solved: boolean;
  attempts: number;
};

const FILTERS = ['all', 'easy', 'medium', 'hard'] as const;
type Filter = (typeof FILTERS)[number];

const DIFF_CLASS: Record<ChallengeListItem['difficulty'], string> = {
  easy: 'text-easy',
  medium: 'text-accent',
  hard: 'text-hard',
};

/** "■ SOLVED" marker in accent. */
function SolvedTag() {
  return (
    <span className="flex flex-shrink-0 items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-accent">
      <span aria-hidden className="inline-block h-2 w-2 bg-accent" />
      Solved
    </span>
  );
}

/** Thin row arrow (mockup), brightens on hover/focus. */
function RowArrow({ bright = false }: { bright?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex-shrink-0 font-mono text-sm ${bright ? 'text-accent' : 'text-neutral-600 transition-colors group-hover:text-accent'}`}
    >
      →
    </span>
  );
}

/** Meta line: colored difficulty word + bare mono tags + real attempts. */
function RowMeta({ challenge }: { challenge: ChallengeListItem }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className={`font-mono text-xs font-bold ${DIFF_CLASS[challenge.difficulty]}`}>
        {challenge.difficulty}
      </span>
      {challenge.tags.map((tag) => (
        <span key={tag} className="font-mono text-xs text-neutral-400">
          {tag}
        </span>
      ))}
      {challenge.attempts > 0 && !challenge.solved && (
        <span className="font-mono text-xs text-neutral-500">
          {challenge.attempts} {challenge.attempts === 1 ? 'attempt' : 'attempts'}
        </span>
      )}
    </div>
  );
}

export function ChallengeRoster({
  challenges,
  daily,
}: {
  challenges: ChallengeListItem[];
  daily: DailyTeaser | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [focus, setFocus] = useState(-1); // index within the filtered list
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);

  const visible = challenges
    .map((challenge, index) => ({ challenge, index }))
    .filter(({ challenge }) => filter === 'all' || challenge.difficulty === filter);
  const counts = {
    all: challenges.length,
    easy: challenges.filter((c) => c.difficulty === 'easy').length,
    medium: challenges.filter((c) => c.difficulty === 'medium').length,
    hard: challenges.filter((c) => c.difficulty === 'hard').length,
  };
  const solvedCount = challenges.filter((c) => c.solved).length;
  const status = visible.length > 0 && visible.every((v) => v.challenge.solved);

  // Reset focus whenever the band changes.
  useEffect(() => {
    setFocus(-1);
  }, [filter]);

  // Keep the focused row in view.
  useEffect(() => {
    if (focus >= 0) rowRefs.current[focus]?.scrollIntoView({ block: 'nearest' });
  }, [focus]);

  // [J/K] move, [Enter] open. Ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'j') {
        e.preventDefault();
        setFocus((f) => Math.min(f + 1, visible.length - 1));
      } else if (key === 'k') {
        e.preventDefault();
        setFocus((f) => Math.max(f - 1, 0));
      } else if (e.key === 'Enter' && focus >= 0 && focus < visible.length) {
        e.preventDefault();
        router.push(`/practice/${visible[focus].challenge.slug}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, focus, router]);

  return (
    <div className="mx-auto w-full max-w-md">
      {/* Roster header + progress pill */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2.5 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400">
          <span aria-hidden className="inline-block h-2 w-2 bg-cream" />
          Challenge roster
        </p>
        <span className="flex flex-shrink-0 items-center gap-2 border border-line-dark bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em]">
          <span className="text-neutral-400">Progress:</span>
          <span className="font-bold text-cream">
            {solvedCount} / {challenges.length} solved
          </span>
        </span>
      </div>

      {/* Difficulty filter tabs + roster status */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={active}
                className={`px-3 py-1.5 font-mono text-xs uppercase tracking-[0.1em] transition-colors ${
                  active
                    ? 'border border-line-dark bg-surface font-bold text-cream'
                    : 'border border-transparent text-neutral-400 hover:text-cream'
                }`}
              >
                {f}
                {f !== 'all' && <span className={active ? 'text-neutral-400' : ''}> ({counts[f]})</span>}
              </button>
            );
          })}
        </div>
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-400">
          Status:
          <span aria-hidden className="inline-block h-2 w-2 bg-accent" />
          <span className={status ? 'font-bold text-cream' : 'text-neutral-300'}>
            {status ? 'Complete' : 'In progress'}
          </span>
        </span>
      </div>

      {/* F09: today's daily, pinned above the roster */}
      {daily && (
        <Link
          href={`/practice/${daily.slug}`}
          className="group mb-6 block border border-accent/60 bg-surface p-4 transition-colors hover:border-accent"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-accent">
              <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
              Today&rsquo;s daily — everyone, same problem
            </span>
            {daily.solved && <SolvedTag />}
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h3 className="min-w-0 break-words font-mono text-base font-bold uppercase tracking-[0.05em] text-cream transition-colors group-hover:text-accent">
              {daily.title}
            </h3>
            <RowArrow />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`font-mono text-xs font-bold ${DIFF_CLASS[daily.difficulty]}`}>
              {daily.difficulty}
            </span>
            {daily.tags.map((tag) => (
              <span key={tag} className="font-mono text-xs text-neutral-400">
                {tag}
              </span>
            ))}
            {daily.attempts > 0 && !daily.solved && (
              <span className="font-mono text-xs text-neutral-500">
                {daily.attempts} {daily.attempts === 1 ? 'attempt' : 'attempts'}
              </span>
            )}
          </div>
        </Link>
      )}

      {/* Numbered rows */}
      <ul>
        {visible.map(({ challenge, index }, i) => {
          const focused = i === focus;
          return (
            <li
              key={challenge.slug}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className="relative"
            >
              {focused && <span aria-hidden className="absolute left-0 top-0 h-full w-0.5 bg-accent" />}
              <Link
                href={`/practice/${challenge.slug}`}
                className={`group block border-b border-line-dark py-4 pl-3 ${
                  focused ? 'bg-surface' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <span
                    className={`w-8 flex-shrink-0 font-mono text-sm font-bold transition-colors ${
                      focused ? 'text-accent' : 'text-neutral-600 group-hover:text-accent'
                    }`}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-mono text-base font-bold uppercase tracking-[0.05em] text-cream transition-colors group-hover:text-accent">
                      {challenge.title}
                    </h3>
                    <RowMeta challenge={challenge} />
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3 pt-0.5">
                    {challenge.solved && <SolvedTag />}
                    <RowArrow bright={focused} />
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 && (
        <p className="py-6 font-grotesk text-sm text-neutral-400">No challenges in this band yet.</p>
      )}
    </div>
  );
}
