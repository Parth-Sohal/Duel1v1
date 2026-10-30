'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Socket } from 'socket.io-client';
import { CodePanel, SampleTests, type MatchOutcome } from './CodePanel';
import { Chip, Eyebrow, Headline } from './ui';
import { Avatar } from './Avatar';
import { connectGameSocket } from '../lib/game-socket';
import type { ChallengeDetail, VisibleTest } from '../lib/practice';

/**
 * The live duel (docs/features/F06-match-engine.md). Server-owned clock
 * (ends_at), opponent progress via socket, CodePanel with the duel submit
 * endpoint, and the result overlay (VICTORY. / DEFEAT. / DRAW. / FORFEIT.).
 * Refresh-proof: everything restores from GET /api/matches/:id.
 */

type MatchPlayer = {
  userId: string;
  seat: number;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  pointsBefore: number;
  pointsAfter: number | null;
  online: boolean;
};

type MatchState = {
  id: string;
  status: 'waiting' | 'active' | 'finished';
  resultType: 'win' | 'draw' | 'forfeit' | null;
  winnerId: string | null;
  startedAt: string | null;
  endsAt: string | null;
  finishedAt: string | null;
  challenge: ChallengeDetail & { visibleTests: VisibleTest[] };
  players: MatchPlayer[];
  mySubmission: { id: string; status: string; passed: number; total: number; language: string; sourceCode: string } | null;
  opponentProgress: { attempts: number; testsPassed: number };
};

type Outcome = {
  kind: 'victory' | 'defeat' | 'draw' | 'forfeit';
  headline: string;
  delta: number | null;
  note: string;
};

function outcomeFor(match: MatchState, myUserId: string, deltas: Record<string, number> | null): Outcome | null {
  if (match.status !== 'finished' || !match.resultType) return null;
  const delta = deltas ? (deltas[myUserId] ?? null) : null;
  if (match.resultType === 'draw') {
    return { kind: 'draw', headline: 'Draw.', delta, note: 'The clock ran out. Both duellists lose 10.' };
  }
  const won = match.winnerId === myUserId;
  if (match.resultType === 'forfeit') {
    return won
      ? { kind: 'victory', headline: 'Victory.', delta, note: 'Your rival left the arena. Stayer gains +10.' }
      : { kind: 'forfeit', headline: 'Forfeit.', delta, note: 'You left past the 30-second grace. −10.' };
  }
  return won
    ? { kind: 'victory', headline: 'Victory.', delta, note: 'First accepted submission. The swing is yours.' }
    : { kind: 'defeat', headline: 'Defeat.', delta, note: 'Your rival passed first. The swing is theirs.' };
}

function useCountdown(endsAt: string | null, active: boolean): string {
  const [label, setLabel] = useState('—');
  useEffect(() => {
    if (!endsAt || !active) {
      setLabel('—');
      return;
    }
    const target = new Date(endsAt).getTime();
    const tick = () => {
      const left = Math.max(0, target - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      setLabel(`${m}:${String(s).padStart(2, '0')}`);
      if (left === 0) setLabel('0:00');
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt, active]);
  return label;
}

export function MatchWorkbench({ matchId, myUserId }: { matchId: string; myUserId: string }) {
  const [match, setMatch] = useState<MatchState | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [deltas, setDeltas] = useState<Record<string, number> | null>(null);
  const [opponentProgress, setOpponentProgress] = useState<{ attempts: number; testsPassed: number } | null>(null);
  const [opponentOnline, setOpponentOnline] = useState<boolean | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}`);
    const data = (await res.json().catch(() => null)) as { match?: MatchState; error?: string } | null;
    if (!res.ok || !data?.match) {
      if (data?.error === 'not_a_participant') setFatal('This duel is not yours to watch.');
      else setFatal('This match does not exist (or the arena hiccuped).');
      return null;
    }
    setMatch(data.match);
    setOpponentProgress(data.match.opponentProgress);
    setOpponentOnline(data.match.players.find((p) => p.userId !== myUserId)?.online ?? null);
    return data.match;
  }, [matchId, myUserId]);

  // Initial load + restore outcome if already finished.
  useEffect(() => {
    void (async () => {
      const m = await load();
      if (m) {
        const o = outcomeFor(m, myUserId, null);
        if (o) setOutcome(o);
      }
    })();
  }, [load, myUserId]);

  // Live updates: opponent progress + the finish.
  useEffect(() => {
    let alive = true;
    let socket: Socket | null = null;
    void (async () => {
      try {
        socket = await connectGameSocket();
        if (!alive) {
          socket.disconnect();
          return;
        }
        socketRef.current = socket;
        socket.on('connect', () => socket?.emit('match:join', { matchId }));
        socket.on('progress', (p: { userId: string; testsPassed: number; attempts: number }) => {
          if (p.userId !== myUserId) setOpponentProgress({ testsPassed: p.testsPassed, attempts: p.attempts });
        });
        socket.on('match_ended', async (e: { resultType: string; winnerId: string | null; deltas: Record<string, number> }) => {
          setDeltas(e.deltas ?? null);
          const m = await load();
          if (m) setOutcome(outcomeFor(m, myUserId, e.deltas ?? null));
        });
      } catch {
        /* live updates unavailable; the countdown + manual refresh still work */
      }
    })();
    return () => {
      alive = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [matchId, myUserId, load]);

  // Re-check once the countdown hits zero (the server decides the draw).
  const countdown = useCountdown(match?.endsAt ?? null, match?.status === 'active');
  useEffect(() => {
    if (countdown === '0:00' && match?.status === 'active' && !outcome) {
      const t = setTimeout(() => {
        void load().then((m) => {
          if (m) setOutcome(outcomeFor(m, myUserId, deltas));
        });
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [countdown, match?.status, outcome, load, myUserId, deltas]);

  const onSubmitted = useCallback(
    (data: { matchFinished?: boolean; matchOutcome?: MatchOutcome | null }) => {
      if (data.matchOutcome) {
        setDeltas(data.matchOutcome.deltas ?? null);
        void load().then((m) => {
          if (m) setOutcome(outcomeFor(m, myUserId, data.matchOutcome?.deltas ?? null));
        });
      }
    },
    [load, myUserId],
  );

  if (fatal) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-carbon px-6 text-center">
        <h1 className="mb-6 font-headline text-4xl font-extrabold uppercase tracking-tight text-cream">{fatal}</h1>
        <Link
          href="/duel"
          className="bg-accent px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-carbon transition-colors hover:bg-[#ff6231]"
        >
          Pick a duel
        </Link>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-carbon px-6">
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-neutral-400">Loading the duel…</p>
      </main>
    );
  }

  const opponent = match.players.find((p) => p.userId !== myUserId);
  const me = match.players.find((p) => p.userId === myUserId);
  const locked = match.status !== 'active';

  return (
    <div className="grid w-full grid-cols-1 lg:grid-cols-2">
      {/* Cream half — statement + samples */}
      <section className="flex min-h-[50vh] flex-col border-b border-line-light px-5 py-10 sm:px-8 lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r lg:px-12">
        <div className="mb-6">
          <Eyebrow marker="square">Duel · {match.challenge.difficulty}</Eyebrow>
        </div>
        <Headline className="mb-8 !text-[clamp(2.5rem,6vw,4.5rem)]">{match.challenge.title}</Headline>
        <div className="max-w-xl space-y-4">
          {match.challenge.statement.split('\n').filter(Boolean).map((line, i) => (
            <p key={i} className="font-grotesk text-sm leading-relaxed text-muted">
              {line}
            </p>
          ))}
        </div>
        <SampleTests tests={match.challenge.visibleTests} entryFunction={match.challenge.entryFunctions.javascript} />
        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          Same problem, same clock. First accepted submission wins the swing.
        </p>
      </section>

      {/* Dark half — clock, opponent, workbench */}
      <section className="relative flex min-h-[50vh] flex-col bg-carbon px-5 py-10 text-cream sm:px-8 lg:min-h-[calc(100vh-4rem)] lg:px-12">
        <div className="mx-auto mb-6 w-full max-w-xl">
          <div className="flex flex-wrap items-stretch justify-between gap-4 border border-line-dark bg-surface p-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                Clock
              </span>
              <span
                className={`font-headline text-4xl font-extrabold leading-none ${
                  countdown === '0:00' ? 'text-accent' : 'text-cream'
                }`}
              >
                {match.status === 'active' ? countdown : match.status === 'finished' ? '0:00' : '—'}
              </span>
            </div>
            {opponent && (
              <div className="flex min-w-0 items-center gap-3">
                <Avatar displayName={opponent.displayName} avatarUrl={opponent.avatarUrl} size={40} />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-mono text-sm font-bold uppercase tracking-[0.05em] text-cream">
                    {opponent.displayName}
                    <span
                      aria-hidden
                      className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${
                        opponentOnline ? 'bg-accent' : 'bg-neutral-700'
                      }`}
                    />
                  </p>
                  <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500">
                    {opponentProgress?.testsPassed ?? match.opponentProgress.testsPassed} tests passed ·{' '}
                    {opponentProgress?.attempts ?? match.opponentProgress.attempts}{' '}
                    {(opponentProgress?.attempts ?? match.opponentProgress.attempts) === 1 ? 'attempt' : 'attempts'}
                  </p>
                </div>
              </div>
            )}
            <div className="flex min-w-0 flex-col items-end gap-1">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                You
              </span>
              <span className="font-headline text-2xl font-extrabold leading-none text-cream">
                {me?.points.toLocaleString('en-US') ?? '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-xl">
          <CodePanel
            challenge={match.challenge}
            submitPath={`/api/matches/${match.id}/submit`}
            onOutcome={onSubmitted}
            locked={locked}
          />
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500">
            Leave past the 30-second grace and the duel is forfeit: stayer +10, leaver −10.
          </p>
        </div>

        {/* Result overlay */}
        {outcome && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-carbon/95 px-6 text-center backdrop-blur-sm">
            <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Duel decided
            </p>
            <h2
              className={`mb-4 font-headline text-6xl font-extrabold uppercase leading-[0.95] tracking-[-0.02em] break-words sm:text-7xl ${
                outcome.kind === 'victory' ? 'text-accent' : 'text-cream'
              }`}
            >
              {outcome.headline}
            </h2>
            {outcome.delta !== null && (
              <p
                className={`mb-4 font-headline text-3xl font-extrabold ${
                  outcome.delta >= 0 ? 'text-accent' : 'text-neutral-300'
                }`}
              >
                {outcome.delta >= 0 ? '+' : ''}
                {outcome.delta} pts
              </p>
            )}
            <p className="mb-10 max-w-md font-grotesk text-sm leading-relaxed text-neutral-300">{outcome.note}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/duel"
                className="bg-accent px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-carbon transition-colors hover:bg-[#ff6231]"
              >
                Next duel
              </Link>
              <Link
                href="/profile"
                className="border border-line-dark bg-surface px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-cream transition-colors hover:border-neutral-500"
              >
                Match history
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              <Chip variant="dark">Server referee</Chip>
              <Chip variant="dark">Points updated</Chip>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
