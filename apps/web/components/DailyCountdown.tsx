'use client';

import { useEffect, useState } from 'react';

/**
 * F09 countdown: time until the next UTC midnight (the daily rolls over).
 * Pure client clock math — the server's `day` string only anchors which day
 * we are on, the tick itself is local.
 */
export function DailyCountdown({ day }: { day: string }) {
  const [left, setLeft] = useState<string>('…');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const nextUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      let ms = nextUtcMidnight - now.getTime();
      if (ms < 0) ms = 0;
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="max-w-md border border-line-light bg-sand/60 p-6">
      <div className="mb-2 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-carbon">
        <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
        Next challenge in
      </div>
      <p className="font-headline text-4xl font-extrabold tabular-nums tracking-tight text-carbon" suppressHydrationWarning>
        {left}
      </p>
      <p className="mt-2 font-grotesk text-xs text-muted">
        Resets at midnight UTC ({day} is live now).
      </p>
    </div>
  );
}
