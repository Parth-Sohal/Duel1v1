import type { StreakDay } from '../lib/daily';

/**
 * F09 streak bar (owner request, 2026-10-30): the last 14 days as one cell
 * per day. ORANGE = the daily was solved that day; outlined = the daily
 * existed but went unsolved; dashed = no daily existed (before launch).
 * Signed-out visitors get the neutral note instead of a personal bar.
 */

const STATE_STYLES: Record<StreakDay['state'], string> = {
  done: 'bg-accent',
  missed: 'border border-line-light bg-sand/70',
  none: 'border border-dashed border-line-light/80',
};

const STATE_LABEL: Record<StreakDay['state'], string> = {
  done: 'daily solved',
  missed: 'daily missed',
  none: 'no daily yet',
};

export function StreakBar({ days }: { days: StreakDay[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="img" aria-label="Last 14 days of the daily challenge">
      {days.map((d) => (
        <span
          key={d.day}
          title={`${d.day} — ${STATE_LABEL[d.state]}`}
          aria-hidden
          className={`h-4 w-4 flex-shrink-0 ${STATE_STYLES[d.state]}`}
        />
      ))}
    </div>
  );
}
