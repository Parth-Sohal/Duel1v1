'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DRAW_PENALTY,
  FORFEIT_GRACE_MS,
  FORFEIT_PENALTY,
  FORFEIT_REWARD,
  MATCH_DURATION_MS,
  WIN_SWING_MAX,
  WIN_SWING_MIN,
} from '@coding-arena/shared';
import type { MatchmakingStatus } from '@coding-arena/shared';
import { Chip, Eyebrow, Headline } from './ui';

/**
 * PLAY launcher (owner design: compact duel setup, cream direction).
 * Left = opponent + difficulty + match facts, right = create room / join by
 * invite code / queue for a stranger, with the identical protocol rules panel.
 * RIVAL rooms, KERN, and (F09) ANYONE human matchmaking are all real; the queue
 * status is polled from the server and never simulated.
 *
 * Behavior: POST /api/duels/rooms, POST /api/duels/rooms/:code/join,
 * POST /api/duels/bot, or POST /api/duels/matchmaking, then route to the lobby
 * or the match. Error strings and the already-in-match guard stay as they were.
 */

const MATCH_MINUTES = MATCH_DURATION_MS / 60_000;
const GRACE_SECONDS = FORFEIT_GRACE_MS / 1_000;
/** Client heartbeat: also keeps a queued entry alive on the server (F09). */
const POLL_MS = 2000;

const DIFFICULTIES = [
  { value: 'ANY', label: 'ANY', hint: 'Any difficulty' },
  { value: 'easy', label: 'EASY', hint: 'Easy problems only' },
  { value: 'medium', label: 'MEDIUM', hint: 'Medium problems only' },
  { value: 'hard', label: 'HARD', hint: 'Hard problems only' },
] as const;

type Difficulty = (typeof DIFFICULTIES)[number]['value'];

/** Compact stat card: label / big value / one-line protocol note. */
function MatchFact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 bg-cream p-3.5 sm:p-4">
      <dt className="font-mono text-[10px] font-semibold uppercase leading-snug tracking-[0.1em] text-muted">
        {label}
      </dt>
      <dd className="m-0 min-w-0">
        <span className="block break-words font-headline text-[clamp(1.05rem,5.1vw,1.8rem)] font-extrabold uppercase leading-none tracking-[-0.02em] text-carbon">
          {value}
        </span>
        <span className="mt-1.5 block font-grotesk text-[11px] leading-snug text-muted">{note}</span>
      </dd>
    </div>
  );
}

/** Thin section label with a rule to the right, e.g. "01 / OPPONENT ─────". */
function FieldLabel({ index, children }: { index: string; children: string }) {
  return (
    <div className="mb-2 flex items-center gap-3">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
        {index} / {children}
      </span>
      <span aria-hidden className="h-px flex-1 bg-line-light" />
    </div>
  );
}

/** mm:ss for the live search timer. */
function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function DuelLauncher({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<Difficulty>('ANY');
  const [opponent, setOpponent] = useState<'rival' | 'anyone' | 'bot'>('rival');
  const [pending, setPending] = useState<'create' | 'join' | 'bot' | 'search' | 'cancel' | null>(null);
  const [queueState, setQueueState] = useState<MatchmakingStatus>({ status: 'idle' });
  const [elapsed, setElapsed] = useState(0);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const creating = pending !== null;
  const searching = queueState.status === 'searching';
  const waiting = queueState.status === 'searching' ? queueState.waiting : 0;
  const searchDifficulty = queueState.status === 'searching' ? queueState.difficulty : null;

  /** Leave the queue when this page unmounts (best effort; the server also prunes). */
  useEffect(() => {
    return () => {
      void fetch('/api/duels/matchmaking', { method: 'DELETE' }).catch(() => {});
    };
  }, []);

  /** Poll the real queue status; a `matched` answer routes into the duel. */
  useEffect(() => {
    if (queueState.status !== 'searching') return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch('/api/duels/matchmaking');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as MatchmakingStatus;
        if (cancelled) return;
        if (data.status === 'matched') {
          router.push(`/match/${data.matchId}`);
          return;
        }
        if (data.status === 'idle') {
          setQueueState({ status: 'idle' });
          setError('Your search ended — try again, or invite a friend instead.');
          return;
        }
        setQueueState(data);
      } catch {
        // Network blip: the next poll retries; the entry stays alive server-side.
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    // A background tab can have its timers throttled; refresh immediately when
    // the player returns so a real pairing is never missed silently.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [queueState.status, router]);

  /** Elapsed search seconds, derived from the server's `since` timestamp. */
  useEffect(() => {
    if (queueState.status !== 'searching') {
      setElapsed(0);
      return;
    }
    const startedAt = Date.parse(queueState.since);
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [queueState]);

  const chooseOpponent = (next: 'rival' | 'anyone' | 'bot') => {
    if (next === opponent) return;
    if (searching || pending === 'cancel') {
      void fetch('/api/duels/matchmaking', { method: 'DELETE' }).catch(() => {});
      setQueueState({ status: 'idle' });
      setPending(null);
    }
    setOpponent(next);
    setError(null);
  };

  const startBotMatch = async () => {
    setPending('bot');
    setError(null);
    try {
      const res = await fetch('/api/duels/bot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ difficulty: difficulty === 'ANY' ? null : difficulty }),
      });
      const data = (await res.json().catch(() => null)) as { matchId?: string; error?: string } | null;
      if (res.ok && data?.matchId) {
        router.push(`/match/${data.matchId}`);
        return;
      }
      if (data?.error === 'already_in_match') setError('You already have a live duel — finish it first.');
      else setError('Could not start the bot duel. Refresh and try again.');
    } catch {
      setError('Could not reach the arena. Check your connection.');
    } finally {
      setPending(null);
    }
  };

  const createRoom = async () => {
    setPending('create');
    setError(null);
    try {
      const res = await fetch('/api/duels/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ difficulty: difficulty === 'ANY' ? null : difficulty }),
      });
      const data = (await res.json().catch(() => null)) as { room?: { inviteCode: string }; error?: string } | null;
      if (res.ok && data?.room) {
        router.push(`/duel/${data.room.inviteCode}`);
        return;
      }
      if (data?.error === 'already_in_match') setError('You already have a live duel — finish it first.');
      else setError('Could not create the room. Refresh and try again.');
    } catch {
      setError('Could not reach the arena. Check your connection.');
    } finally {
      setPending(null);
    }
  };

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length === 0) return;
    setPending('join');
    setError(null);
    try {
      const res = await fetch(`/api/duels/rooms/${encodeURIComponent(code)}/join`, { method: 'POST' });
      const data = (await res.json().catch(() => null)) as { room?: { inviteCode: string }; error?: string } | null;
      if (res.ok && data?.room) {
        router.push(`/duel/${data.room.inviteCode}`);
        return;
      }
      if (data?.error === 'room_unavailable') setError('No live room with that code — check it or ask for a fresh invite.');
      else if (data?.error === 'room_full') setError('That room is already full (2 players).');
      else if (data?.error === 'already_in_match') setError('You already have a live duel — finish it first.');
      else setError('Could not join. Refresh and try again.');
    } catch {
      setError('Could not reach the arena. Check your connection.');
    } finally {
      setPending(null);
    }
  };

  const startSearch = async () => {
    setPending('search');
    setError(null);
    try {
      const res = await fetch('/api/duels/matchmaking', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ difficulty: difficulty === 'ANY' ? null : difficulty }),
      });
      const data = (await res.json().catch(() => null)) as (MatchmakingStatus & { error?: string }) | null;
      if (res.ok && data?.status === 'matched') {
        router.push(`/match/${data.matchId}`);
        return;
      }
      if (res.ok && data?.status === 'searching') {
        setQueueState(data);
        return;
      }
      if (data?.error === 'already_in_match') setError('You already have a live duel — finish it first.');
      else if (data?.error === 'rate_limited') setError('Too many queue actions — wait a moment and try again.');
      else setError('Could not join the queue. Refresh and try again.');
    } catch {
      setError('Could not reach the arena. Check your connection.');
    } finally {
      setPending(null);
    }
  };

  const cancelSearch = async () => {
    setPending('cancel');
    try {
      await fetch('/api/duels/matchmaking', { method: 'DELETE' });
    } catch {
      // The server prunes a silent entry after 30 s; cancel is best effort here.
    }
    setQueueState({ status: 'idle' });
    setPending(null);
  };

  const firstName = displayName.trim().split(/\s+/)[0] || displayName;

  const rules = [
    `Same problem, same ${MATCH_MINUTES}-minute clock. First accepted submission wins.`,
    `Win: +${WIN_SWING_MIN} to +${WIN_SWING_MAX}; loser pays the same (never below 0). Draw: −${DRAW_PENALTY} both.`,
    `Leave mid-duel: the stayer gains +${FORFEIT_REWARD}, the leaver loses ${FORFEIT_PENALTY}.`,
    `Disconnect grace: ${GRACE_SECONDS} seconds. vs KERN: practice — no points, no stats.`,
  ];

  return (
    <main id="main-content" tabIndex={-1} className="relative flex-1 bg-cream">
      <span aria-hidden className="texture-cream pointer-events-none absolute inset-0 opacity-25" />

      <div className="relative mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-8 sm:py-7 lg:px-10 lg:py-8">
        <div className="grid grid-cols-1 border border-line-light bg-cream lg:grid-cols-2">
          {/* ---------------------------------------------------------------- */}
          {/* Left: pick a duel                                                */}
          {/* ---------------------------------------------------------------- */}
          <section
            aria-labelledby="pick-duel-heading"
            className="relative flex min-w-0 flex-col border-b border-line-light px-4 py-6 sm:px-7 sm:py-8 lg:border-b-0 lg:border-r lg:px-9"
          >
            <span aria-hidden className="absolute right-0 top-0 hidden h-2 w-8 bg-accent lg:block" />

            <Eyebrow marker="square">Step 1 · Choose a format</Eyebrow>
            <Headline className="mt-3 text-[clamp(2.15rem,4.2vw,3.75rem)]">
              <span id="pick-duel-heading">Pick a duel.</span>
            </Headline>

            <div className="mt-6">
              <FieldLabel index="01">Opponent</FieldLabel>
              <div className="grid grid-cols-3 border border-carbon/20" role="group" aria-label="Opponent">
                <button
                  type="button"
                  onClick={() => chooseOpponent('rival')}
                  aria-pressed={opponent === 'rival'}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 border-r border-carbon/20 px-2 font-mono text-xs font-bold uppercase tracking-[0.08em] transition-colors last:border-r-0 ${
                    opponent === 'rival'
                      ? 'bg-accent text-carbon'
                      : 'bg-transparent text-carbon hover:bg-sand'
                  }`}
                >
                  <span>Rival</span>
                </button>
                <button
                  type="button"
                  onClick={() => chooseOpponent('anyone')}
                  aria-pressed={opponent === 'anyone'}
                  title="Queue for the next available human at your difficulty"
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 border-r border-carbon/20 px-2 font-mono text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
                    opponent === 'anyone'
                      ? 'bg-accent text-carbon'
                      : 'bg-transparent text-carbon hover:bg-sand'
                  }`}
                >
                  <span>Anyone</span>
                </button>
                <button
                  type="button"
                  onClick={() => chooseOpponent('bot')}
                  aria-pressed={opponent === 'bot'}
                  title="Play right now against KERN — practice duel, no points"
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-2 font-mono text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
                    opponent === 'bot'
                      ? 'bg-accent text-carbon'
                      : 'bg-transparent text-carbon hover:bg-sand'
                  }`}
                >
                  <span>Kern bot</span>
                </button>
              </div>
              <p className="mt-2 font-grotesk text-xs leading-relaxed text-muted">
                {opponent === 'rival'
                  ? 'Rival = a friend you invite with a code. Same problem, fastest correct solution wins.'
                  : opponent === 'anyone'
                    ? 'Anyone = the next human in the server queue at your difficulty. Real players only — no bots, no invented opponents.'
                    : 'KERN = the house bot. A full duel through the same engine — practice only: no points, no stats.'}
              </p>
            </div>

            <div className="mt-6">
              <FieldLabel index="02">Difficulty</FieldLabel>
              <div className="grid grid-cols-4 gap-2" role="group" aria-label="Difficulty">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDifficulty(d.value)}
                    aria-pressed={difficulty === d.value}
                    disabled={searching}
                    title={d.hint}
                    className={`flex min-h-11 items-center justify-center border px-1 font-mono text-xs font-bold uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      difficulty === d.value
                        ? 'border-accent bg-accent text-carbon'
                        : 'border-carbon/20 bg-transparent text-carbon hover:bg-sand'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <dl
              aria-label="Match facts"
              className="mt-6 grid grid-cols-2 gap-px border border-line-light bg-line-light"
            >
              <MatchFact label="Format" value="1v1" note="One problem for both players" />
              <MatchFact label="Clock" value={`${MATCH_MINUTES} min`} note="Server-owned countdown" />
              <MatchFact
                label="Win swing"
                value={`+${WIN_SWING_MIN}..${WIN_SWING_MAX}`}
                note="Winner gains it, loser pays it"
              />
              <MatchFact label="Draw" value={`−${DRAW_PENALTY} both`} note="Both lose points when time runs out" />
            </dl>

            <p className="mt-auto pt-6 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              Matched by invite or queue / decided by the server
            </p>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Right: your match                                                */}
          {/* ---------------------------------------------------------------- */}
          <section
            aria-labelledby="your-match-heading"
            className="relative flex min-w-0 flex-col bg-sand/40 px-4 py-6 sm:px-7 sm:py-8 lg:px-9"
          >
            <span aria-hidden className="texture-cream pointer-events-none absolute inset-0 opacity-15" />

            <div className="relative flex min-w-0 flex-1 flex-col">
              <Eyebrow marker="notch">Step 2 · Your match</Eyebrow>
              <h2
                id="your-match-heading"
                className="mt-3 break-words font-headline text-[clamp(2rem,3.6vw,3.25rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-carbon"
              >
                {opponent === 'bot'
                  ? 'Kern awaits.'
                  : opponent === 'anyone'
                    ? searching
                      ? 'Searching.'
                      : 'Anyone in?'
                    : `${firstName}’s duel.`}
              </h2>
              <p className="mt-3 max-w-md font-grotesk text-sm leading-relaxed text-muted">
                {opponent === 'bot'
                  ? `You get the same problem and the same ${MATCH_MINUTES}-minute clock as KERN. It solves at a human pace — sometimes it beats you. Practice duel: no points move.`
                  : opponent === 'anyone'
                    ? searching
                      ? 'The server is holding your spot and will pair you with the next waiting human. Keep this tab open — leaving cancels the search.'
                      : 'Join the real queue and the server pairs you with the next waiting human at your difficulty. No fake opponents: if nobody is waiting, you wait or cancel.'
                    : 'Create a room and send the invite code to a friend — or paste a code you were sent. You both ready up, the host starts, and the clock decides the rest.'}
              </p>

              <div className="mt-5">
                {opponent === 'bot' ? (
                  <button
                    type="button"
                    onClick={startBotMatch}
                    disabled={creating}
                    className="flex min-h-14 w-full items-center justify-center bg-accent px-6 py-4 font-mono text-sm font-bold uppercase tracking-[0.15em] text-carbon transition-colors hover:bg-[#ff6231] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {pending === 'bot' ? 'Seating KERN…' : 'Play vs KERN'}
                  </button>
                ) : opponent === 'anyone' ? (
                  searching ? (
                    <div className="border border-carbon/25 bg-cream/80">
                      <div className="flex items-center justify-between gap-3 border-b border-line-light px-4 py-3">
                        <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-carbon">
                          <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
                          Search live
                        </span>
                        <span className="font-mono text-sm font-bold tabular-nums text-carbon" aria-label="Elapsed search time">
                          {formatElapsed(elapsed)}
                        </span>
                      </div>
                      <div className="px-4 py-4">
                        <p
                          role="status"
                          className="font-grotesk text-sm leading-relaxed text-muted"
                        >
                          {waiting === 0
                            ? 'You are the only player waiting right now. Stay in queue for the next arrival.'
                            : `${waiting} other ${waiting === 1 ? 'player is' : 'players are'} waiting. Pairing is automatic at your difficulty.`}
                        </p>
                        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                          Difficulty · {searchDifficulty ?? 'ANY'}
                        </p>
                        <button
                          type="button"
                          onClick={cancelSearch}
                          disabled={pending === 'cancel'}
                          className="mt-4 flex min-h-12 w-full items-center justify-center border border-carbon px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.1em] text-carbon transition-colors hover:bg-carbon hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {pending === 'cancel' ? 'Cancelling…' : 'Cancel search'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={startSearch}
                        disabled={creating}
                        className="flex min-h-14 w-full items-center justify-center bg-accent px-6 py-4 font-mono text-sm font-bold uppercase tracking-[0.15em] text-carbon transition-colors hover:bg-[#ff6231] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {pending === 'search' ? 'Joining queue…' : 'Find a Match'}
                      </button>
                      <p className="mt-3 font-grotesk text-xs leading-relaxed text-muted">
                        Uses your difficulty filter. The queue is shared by every signed-in player on
                        this server.
                      </p>
                    </>
                  )
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={createRoom}
                      disabled={creating}
                      className="flex min-h-14 w-full items-center justify-center bg-accent px-6 py-4 font-mono text-sm font-bold uppercase tracking-[0.15em] text-carbon transition-colors hover:bg-[#ff6231] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {pending === 'create' ? 'Creating room…' : 'Create Room'}
                    </button>

                    <div className="my-4 flex items-center gap-3">
                      <span aria-hidden className="h-px flex-1 bg-line-light" />
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                        or join with a code
                      </span>
                      <span aria-hidden className="h-px flex-1 bg-line-light" />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <label htmlFor="invite-code" className="sr-only">
                        Invite code
                      </label>
                      <input
                        id="invite-code"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                        placeholder="INVITE CODE"
                        maxLength={9}
                        spellCheck={false}
                        autoComplete="off"
                        className="min-h-12 min-w-0 flex-1 border border-carbon/35 bg-cream px-4 py-3 font-mono text-sm font-bold uppercase tracking-[0.2em] text-carbon placeholder:text-muted/70 focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={joinRoom}
                        disabled={creating || joinCode.trim().length === 0}
                        className="flex min-h-12 flex-shrink-0 items-center justify-center border border-carbon bg-transparent px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.1em] text-carbon transition-colors hover:bg-carbon hover:text-cream disabled:cursor-not-allowed disabled:border-carbon/25 disabled:text-muted disabled:hover:bg-transparent disabled:hover:text-muted"
                      >
                        {pending === 'join' ? 'Joining…' : 'Join Room'}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {error && (
                <p
                  role="alert"
                  className="mt-4 border-l-2 border-accent bg-accent/5 px-3 py-2 font-grotesk text-sm leading-relaxed text-carbon"
                >
                  {error}
                </p>
              )}

              <div className="mt-6 border border-line-light bg-cream/80">
                <div className="flex items-center justify-between gap-3 border-b border-line-light px-4 py-2.5">
                  <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-carbon">
                    <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
                    House rules
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                    Server-enforced
                  </span>
                </div>
                <ul className="px-4">
                  {rules.map((rule, i) => (
                    <li
                      key={rule}
                      className="flex gap-3 border-b border-line-light py-2.5 last:border-b-0"
                    >
                      <span aria-hidden className="mt-0.5 font-mono text-[9px] font-bold text-accent">
                        0{i + 1}
                      </span>
                      <span className="font-grotesk text-xs leading-relaxed text-muted">{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Chip>Server referee</Chip>
                <Chip>Judge0 sandbox</Chip>
                <Chip>JS · PY</Chip>
              </div>

              <p className="mt-auto pt-6 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                Rating changes only when the match ends.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
