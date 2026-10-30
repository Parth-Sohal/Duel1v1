'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar } from './Avatar';
import { Chip } from './ui';

/**
 * Real match history (docs/features/F07-history-repeat.md): the player's own
 * duels from GET /api/matches — no sample rows. Empty state when none exist.
 */

type HistoryRow = {
  id: string;
  status: 'waiting' | 'active' | 'finished';
  resultType: 'win' | 'draw' | 'forfeit' | null;
  winnerId: string | null;
  pointsDelta: number | null;
  opponent: { id: string; displayName: string; avatarUrl: string | null };
  challenge: { slug: string; title: string; difficulty: string };
  finishedAt: string | null;
};

function agoLabel(iso: string | null): string {
  if (!iso) return 'in progress';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** W / L / D / F marker for a finished match. */
function resultMarker(row: HistoryRow, myUserId: string): { letter: string; tone: 'accent' | 'cream' | 'muted' } {
  if (row.status !== 'finished' || !row.resultType) return { letter: '…', tone: 'muted' };
  if (row.resultType === 'draw') return { letter: 'D', tone: 'muted' };
  const won = row.winnerId === myUserId;
  if (row.resultType === 'forfeit') return won ? { letter: 'W', tone: 'accent' } : { letter: 'F', tone: 'cream' };
  return won ? { letter: 'W', tone: 'accent' } : { letter: 'L', tone: 'cream' };
}

export function MatchHistory() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [historyRes, meRes] = await Promise.all([fetch('/api/matches?limit=20'), fetch('/api/auth/me')]);
        const history = (await historyRes.json().catch(() => null)) as { matches?: HistoryRow[] } | null;
        const me = (await meRes.json().catch(() => null)) as { user?: { id: string } } | null;
        if (historyRes.ok) setRows(history?.matches ?? []);
        else setError(true);
        setMyUserId(me?.user?.id ?? null);
      } catch {
        setError(true);
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="border border-line-dark bg-surface p-4 font-grotesk text-sm text-neutral-400">
        Could not load your match history. Refresh to retry.
      </div>
    );
  }

  if (rows === null) {
    return <div className="border border-line-dark bg-surface p-4 font-grotesk text-sm text-neutral-400">Loading…</div>;
  }

  if (rows.length === 0) {
    return (
      <>
        <h2 className="mb-3 font-headline text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-cream sm:text-5xl">
          No duels yet.
        </h2>
        <p className="mb-8 font-grotesk text-sm leading-relaxed text-neutral-300">
          Pick a fight, invite a friend, and put your rating on the line.
        </p>
        <Link
          href="/duel"
          className="group flex w-full items-center justify-between gap-3.5 bg-accent p-1.5 pr-5 text-left transition-colors hover:bg-[#ff6231]"
        >
          <span className="flex items-center gap-3.5">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-carbon font-mono text-sm font-bold text-accent">
              ⚔
            </span>
            <span className="font-mono text-sm font-bold tracking-[0.05em] text-carbon">Find a duel</span>
          </span>
          <span aria-hidden className="font-mono text-xs text-carbon">
            ➔
          </span>
        </Link>
      </>
    );
  }

  return (
    <div>
      {rows.map((row, i) => {
        const marker = resultMarker(row, myUserId ?? '');
        const toneClass = marker.tone === 'accent' ? 'text-accent' : marker.tone === 'cream' ? 'text-cream' : 'text-neutral-500';
        return (
          <Link
            key={row.id}
            href={`/match/${row.id}`}
            className="group block border-b border-line-dark py-4"
          >
            <div className="flex items-center gap-4">
              <span className={`w-7 flex-shrink-0 font-mono text-sm font-bold ${toneClass}`}>{marker.letter}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {row.opponent && <Avatar displayName={row.opponent.displayName} avatarUrl={row.opponent.avatarUrl} size={22} />}
                  <span className="truncate font-mono text-sm font-bold uppercase tracking-[0.05em] text-cream transition-colors group-hover:text-accent">
                    {row.status !== 'finished' ? 'Live duel' : `vs ${row.opponent?.displayName ?? 'rival'}`}
                  </span>
                  {row.status !== 'finished' && (
                    <span className="flex flex-shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">
                      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                      Now
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500">
                  {String(i + 1).padStart(2, '0')} · {row.challenge.title} · {row.challenge.difficulty} ·{' '}
                  {agoLabel(row.finishedAt)}
                </p>
              </div>
              {row.pointsDelta !== null && (
                <span
                  className={`flex-shrink-0 font-headline text-xl font-extrabold ${
                    row.pointsDelta >= 0 ? 'text-accent' : 'text-neutral-400'
                  }`}
                >
                  {row.pointsDelta >= 0 ? '+' : ''}
                  {row.pointsDelta}
                </span>
              )}
            </div>
          </Link>
        );
      })}
      <div className="mt-6 flex flex-wrap gap-2">
        <Chip variant="dark">W win</Chip>
        <Chip variant="dark">L loss</Chip>
        <Chip variant="dark">D draw</Chip>
        <Chip variant="dark">F forfeit</Chip>
      </div>
    </div>
  );
}
