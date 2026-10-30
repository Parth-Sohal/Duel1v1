'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import { Avatar } from './Avatar';
import { Chip, Eyebrow, FooterCaption } from './ui';
import { connectGameSocket, fetchRoomState, type RoomState } from '../lib/game-socket';

/**
 * Room lobby (docs/features/F05-friend-rooms.md). REST restores the state,
 * the socket keeps it live: presence dots, ready toggles, host start.
 * Postgres is authoritative; a refresh just reconnects.
 */

const DIFFICULTY_LABELS: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export function RoomLobby({ code, myUserId }: { code: string; myUserId: string }) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [readyBusy, setReadyBusy] = useState(false);
  const [startBusy, setStartBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/duel/${code}` : `/duel/${code}`;

  // Restore + connect
  useEffect(() => {
    let alive = true;
    let socket: Awaited<ReturnType<typeof connectGameSocket>> | null = null;

    (async () => {
      // 1) join by REST (idempotent: already-seated returns the room)
      try {
        const res = await fetch(`/api/duels/rooms/${encodeURIComponent(code)}/join`, { method: 'POST' });
        const data = (await res.json().catch(() => null)) as { room?: RoomState; error?: string } | null;
        if (!alive) return;
        if (res.ok && data?.room) {
          setRoom(data.room);
        } else if (data?.error === 'room_unavailable') {
          setFatal('This room is gone — invites expire. Start a fresh one.');
          return;
        } else if (data?.error === 'room_full') {
          setFatal('This room already has two players.');
          return;
        } else if (data?.error === 'already_in_match') {
          setFatal('You already have a live duel. Finish it before joining another room.');
          return;
        }
      } catch {
        if (alive) setFatal('Could not reach the arena. Refresh to retry.');
        return;
      }

      // 2) live updates over the game socket
      try {
        socket = await connectGameSocket();
        if (!alive) {
          socket.disconnect();
          return;
        }
        socketRef.current = socket;
        socket.on('room_state', (state: RoomState) => {
          setRoom(state);
          // The start broadcast can be missed (throttled tab, reconnect); the
          // room state itself carries the matchId — navigate from it too.
          if (state.status === 'in_match' && state.matchId) router.push(`/match/${state.matchId}`);
        });
        socket.on('room_error', (e: { code: string }) => {
          if (e.code === 'room_unavailable') setFatal('This room is gone — invites expire.');
        });
        socket.on('match_started', ({ matchId }: { matchId: string }) => {
          router.push(`/match/${matchId}`);
        });
        socket.on('connect', () => socket?.emit('room:join', { code }));
        socket.on('connect_error', () => setError('Live connection lost — retrying…'));
        socket.on('disconnect', () => setError('Live connection lost — retrying…'));
      } catch {
        if (alive) setError('Live updates unavailable — the page still shows the room as of now.');
      }
    })();

    return () => {
      alive = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [code, router]);

  // Poll fallback: when the socket is down, and while waiting for the host to
  // start (both seated — the window where a missed match_started would strand
  // the guest in the lobby). REST is authoritative.
  useEffect(() => {
    if (!error && room?.status !== 'full') return;
    const t = setInterval(async () => {
      const data = await fetchRoomState(code).catch(() => null);
      if (data?.room) {
        setRoom(data.room);
        if (data.room.status === 'in_match' && data.room.matchId) router.push(`/match/${data.room.matchId}`);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [code, error, room?.status, router]);

  const toggleReady = useCallback(() => {
    if (!room || readyBusy) return;
    const me = room.players.find((p) => p.userId === myUserId);
    const next = !(me?.ready ?? false);
    setReadyBusy(true);
    socketRef.current?.emit('room:ready', { ready: next });
    // optimistic — server state pushes arrive immediately after
    setRoom((r) =>
      r ? { ...r, players: r.players.map((p) => (p.userId === myUserId ? { ...p, ready: next } : p)) } : r,
    );
    setTimeout(() => setReadyBusy(false), 400);
  }, [room, readyBusy, myUserId]);

  const startMatch = useCallback(() => {
    if (!room || startBusy) return;
    setStartBusy(true);
    socketRef.current?.emit('match:start');
    setTimeout(() => setStartBusy(false), 1500);
  }, [room, startBusy]);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (fatal) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-carbon px-6 text-center">
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400">Room closed</p>
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

  const me = room?.players.find((p) => p.userId === myUserId);
  const isHost = me?.isHost ?? false;
  const bothReady = room ? room.players.length === 2 && room.players.every((p) => p.ready) : false;
  const inMatch = room?.status === 'in_match';
  const diffLabel = room?.difficulty ? (DIFFICULTY_LABELS[room.difficulty] ?? room.difficulty) : 'Any';

  return (
    <div className="grid w-full grid-cols-1 lg:grid-cols-2">
      {/* Cream half — the invite */}
      <section className="flex min-h-[50vh] flex-col justify-between border-b border-line-light px-5 py-10 sm:px-8 lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r lg:px-12">
        <div>
          <div className="mb-6">
            <Eyebrow marker="square">Room · invite a rival</Eyebrow>
          </div>
          <h1 className="mb-2 font-headline text-5xl font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-carbon">
            Seat two.
          </h1>
          <p className="mb-10 max-w-md font-grotesk text-sm leading-relaxed text-muted">
            Send this invite to your friend. They take seat two, you both hit READY, and you start. Difficulty for
            this room: <strong className="text-carbon">{diffLabel}</strong>.
          </p>

          <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted">Invite code</p>
          <div className="flex max-w-md flex-wrap items-stretch gap-3">
            <span className="flex-1 border border-carbon/25 bg-sand/60 px-5 py-4 font-mono text-2xl font-bold tracking-[0.25em] text-carbon">
              {room?.inviteCode ?? code}
            </span>
            <button
              type="button"
              onClick={copyInvite}
              className="border border-carbon bg-carbon px-5 py-4 font-mono text-xs font-bold uppercase tracking-[0.1em] text-cream transition-colors hover:border-accent hover:text-accent"
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>

          <div className="mt-10 grid max-w-md grid-cols-2 gap-x-8 gap-y-6">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate font-mono text-xs uppercase tracking-[0.1em] text-muted">Format</span>
              <span className="font-headline text-3xl font-extrabold leading-none text-carbon md:text-4xl">1v1</span>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate font-mono text-xs uppercase tracking-[0.1em] text-muted">Clock</span>
              <span className="font-headline text-3xl font-extrabold leading-none text-carbon md:text-4xl">10 MIN</span>
            </div>
          </div>
        </div>
        <FooterCaption>Invites expire in 60 minutes. Room rules: fastest accepted submission wins.</FooterCaption>
      </section>

      {/* Dark half — seats */}
      <section className="flex min-h-[50vh] flex-col justify-between bg-carbon px-5 py-10 text-cream sm:px-8 lg:min-h-[calc(100vh-4rem)] lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6">
            <Eyebrow dark marker="notch">
              The room
            </Eyebrow>
          </div>

          <div className="mb-8 space-y-4">
            {room?.players.length ? (
              room.players.map((p) => (
                <div key={p.userId} className="flex items-center gap-4 border border-line-dark bg-surface p-4">
                  <Avatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm font-bold uppercase tracking-[0.05em] text-cream">
                      {p.displayName}
                    </p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500">
                      Seat {p.seat} · {p.isHost ? 'Host' : 'Challenger'} · {p.points.toLocaleString('en-US')} pts
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-2">
                    <span
                      className={`flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] ${
                        p.online ? 'text-accent' : 'text-neutral-600'
                      }`}
                    >
                      <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${p.online ? 'bg-accent' : 'bg-neutral-700'}`} />
                      {p.online ? 'Live' : 'Offline'}
                    </span>
                    <span
                      className={`px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] ${
                        p.ready ? 'bg-accent text-carbon' : 'border border-line-dark text-neutral-500'
                      }`}
                    >
                      {p.ready ? 'Ready' : 'Not ready'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="border border-line-dark bg-surface p-4 font-grotesk text-sm text-neutral-400">
                Loading the room…
              </div>
            )}
            {room && room.players.length === 1 && (
              <div className="border border-dashed border-line-dark p-4 font-grotesk text-sm text-neutral-400">
                Empty seat — send the invite code to fill it.
              </div>
            )}
          </div>

          {inMatch && room?.matchId ? (
            <Link
              href={`/match/${room.matchId}`}
              className="block w-full bg-accent px-6 py-5 text-center font-mono text-sm font-bold uppercase tracking-[0.15em] text-carbon transition-colors hover:bg-[#ff6231]"
            >
              Return to the duel
            </Link>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={toggleReady}
                disabled={!me || readyBusy || room?.players.length !== 2}
                aria-pressed={me?.ready ?? false}
                className={`w-full px-6 py-4 font-mono text-sm font-bold uppercase tracking-[0.15em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  me?.ready ? 'border border-accent bg-transparent text-accent' : 'bg-cream text-carbon hover:bg-white'
                }`}
              >
                {me?.ready ? 'Ready — tap to unready' : 'Ready up'}
              </button>
              {isHost && (
                <button
                  type="button"
                  onClick={startMatch}
                  disabled={!bothReady || startBusy}
                  className="w-full bg-accent px-6 py-5 font-mono text-sm font-bold uppercase tracking-[0.15em] text-carbon transition-colors hover:bg-[#ff6231] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {bothReady ? 'Start duel' : 'Waiting for both to ready…'}
                </button>
              )}
              {!isHost && (
                <p className="text-center font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500">
                  The host starts the duel when both are ready.
                </p>
              )}
            </div>
          )}

          {error && <p className="mt-4 font-grotesk text-sm text-accent">{error}</p>}

          <div className="mt-10 flex flex-wrap gap-2">
            <Chip variant="dark">First accepted wins</Chip>
            <Chip variant="dark">+29..31 swing</Chip>
            <Chip variant="dark">30s grace</Chip>
          </div>
        </div>
        <FooterCaption dark>
          Refresh-proof: the room state lives on the server, not in this tab.
        </FooterCaption>
      </section>
    </div>
  );
}
